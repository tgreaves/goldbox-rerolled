// The script VM's memory map per game (docs/multi-game.md, step 4). The engine keeps Pool of
// Radiance's addresses internally; a game whose regions sit elsewhere has the addresses its scripts
// use translated on the way in. Offsets inside each region are the same in both games
// (spec/coab/ecl.md, "Memory map").
import { F } from './fields'

export interface EclMap {
  /** start of the A word array (0x400 words), B (0x400, with the character view), C (0x200), code (0x1E00 bytes) */
  a: number
  b: number
  c: number
  code: number
  /** B-view writes to B + 0x20…0x70 land at memorised + (offset − 0x20) + this (PoR 0, CotAB 1: 1-based) */
  memorisedView: number
  /** B-view reads this game adds to the shared ones (offset from B → value) */
  viewReads: Record<number, (c: Uint8Array) => number>
  /** opcodes this game handles its own way (opcode → variant the engine implements) */
  ops: Record<number, EclVariant>
  /** IF-skip operand counts that differ from PoR's table */
  skip: Record<number, number>
  /** CALL targets, compared with the operand's raw value */
  calls: { refresh: number; sound: number; frame: number }
  /** CALL sound: register 0x3DE value → sound effect, and the effect for any other value (null: none) */
  callSounds: { by: Record<number, number>; other: number | null }
  /** when CALL refresh draws the view again over pictures: PoR when the view changed (FUN_29c3 2C90);
   *  CotAB also after a PICTURE, once the area's walls are loaded (0x1B7B2: flags DS:8B7C … 8B84, DS:47FB) */
  refreshAfterPicture: boolean
  /** DAMAGE: flag bits that make a successful save still take the damage (CotAB 0x10, which is also
   *  part of the save bonus; 0x1B22A) */
  damageDespiteSave: number
  /** shown before "The entire party is killed!" when DAMAGE kills everyone (PoR "The END!", 0x1C667) */
  wipeBanner: string | null
  /** where a new game's scripts start: ECL block and record */
  start: { block: number; area: number }
  /** a save whose area is 0 starts here, with that area's script loaded (CotAB 1; PoR has an area 0) */
  areaZero: number | null
  /** LOAD_WALLSETS in two-slot mode (A 0x49E7 and 0x49E8 set): an operand of 0xFF leaves its slot as
   *  it is (CotAB, image 0x19563/0x19575) or is loaded like any record (PoR, image 0x1A96D: no test) */
  twoSlotSkipsFF: boolean
}

export type EclVariant = 'passTime' | 'findSpell' | 'protection' | 'redrawScreen' | 'dropCharacter' | 'findEffect' |
  'destroyItems' | 'returnOrExit' | 'divideRemainder'

const s8 = (v: number) => ((v << 24) >> 24) & 0xffff

export const POR_ECL: EclMap = {
  a: 0x4900, b: 0x6b00, c: 0x9700, code: 0x9900, memorisedView: 0, viewReads: {}, ops: {}, skip: {},
  calls: { refresh: 0x2c90, sound: 0xba03, frame: -1 },
  callSounds: { by: { 8: 10, 10: 11 }, other: null },
  refreshAfterPicture: false,
  damageDespiteSave: 0,
  wipeBanner: 'The END!',
  start: { block: 3, area: 0 },
  areaZero: null,
  twoSlotSkipsFF: false,
}

// spec/coab/ecl.md, "B as a view of the current character". Not yet: B+0xC9 (a class level with the
// dual-class part, FUN 0x51841) and B+0x100's "loaded past the end" flag; both read the B word.
export const COAB_ECL: EclMap = {
  a: 0x4b00, b: 0x7c00, c: 0x7a00, code: 0x8000, memorisedView: 1,
  viewReads: {
    0x15: (c) => c[F.stat[1]],
    0x72: (c) => s8(c[F.race]),
    0x73: (c) => s8(c[F.cls]),
    0xd6: (c) => s8(c[F.gender]),
    0xe4: (c) => c[0x192] & 1, // CotAB record byte 0x192 (set by the Hillsfar import), no field yet
  },
  // spec/coab/ecl.md, "Opcodes"
  ops: {
    0x06: 'divideRemainder', 0x13: 'returnOrExit', 0x34: 'passTime', 0x3b: 'findSpell', 0x3c: 'protection',
    0x3d: 'redrawScreen', 0x3e: 'dropCharacter', 0x3f: 'findEffect', 0x40: 'destroyItems',
  },
  skip: { 0x0c: 3, 0x3f: 1, 0x40: 1 },
  calls: { refresh: 0x2e10, sound: 0xb200, frame: 0x6803 },
  callSounds: { by: { 8: 10, 10: 11 }, other: 10 }, // 0x069B0: DS:25C2 = 10, DS:25C4 = 11
  refreshAfterPicture: true, // PICTURE sets DS:8B7C (0x190EA)
  damageDespiteSave: 0x10,
  wipeBanner: null,
  // the start-up code sets block 2 for a real game (spec/coab/assets.md); record 1 is block 2's first (I)
  start: { block: 2, area: 1 },
  // image 0x1C001–0x1C050: area 0 → record 1 (82 when DS:4FD5 is set, ?), loaded rather than restored
  areaZero: 1,
  twoSlotSkipsFF: true,
}

const SIZES: ['a' | 'b' | 'c' | 'code', number][] = [['a', 0x400], ['b', 0x400], ['c', 0x200], ['code', 0x1e00]]
/** an address no region or engine register uses: reads 0, writes are dropped */
const NOWHERE = 0xfff0

/** A script address in game g's numbering → the engine's (PoR) numbering. */
export function canonical(g: EclMap, a: number): number {
  if (g === POR_ECL) return a
  for (const [k, n] of SIZES) if (a >= g[k] && a < g[k] + n) return POR_ECL[k] + (a - g[k])
  for (const [k, n] of SIZES) if (a >= POR_ECL[k] && a < POR_ECL[k] + n) return NOWHERE
  return a // engine registers (0xC04B …) are the same in both games
}

/** The engine's address back in game g's numbering (for logs and tools). */
export function native(g: EclMap, a: number): number {
  if (g === POR_ECL) return a
  for (const [k, n] of SIZES) if (a >= POR_ECL[k] && a < POR_ECL[k] + n) return g[k] + (a - POR_ECL[k])
  return a
}
