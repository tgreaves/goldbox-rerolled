// The script VM's memory map per game (docs/multi-game.md, step 4). The engine keeps Pool of
// Radiance's addresses internally; a game whose regions sit elsewhere has the addresses its scripts
// use translated on the way in. Offsets inside each region are the same in both games
// (spec/A-games/coab/ecl.md, "Memory map").
import { F, type CharFields } from './fields'
import { classLevel } from './rules'

export interface EclMap {
  /** start of the A word array (0x400 words), B (0x400, with the character view), C (0x200), code (0x1E00 bytes) */
  a: number
  b: number
  c: number
  code: number
  /** B-view writes to B + 0x20…0x70 land at memorised + (offset − 0x20) + this (PoR 0, CotAB 1: 1-based) */
  memorisedView: number
  /** B-view reads this game adds to the shared ones (offset from B → value) */
  viewReads: Record<number, ViewRead>
  /** opcodes this game handles its own way (opcode → variant the engine implements) */
  ops: Record<number, EclVariant>
  /** IF-skip operand counts that differ from PoR's table */
  skip: Record<number, number>
  /** operand counts for reading scripts statically (rules/landmarks.ts) that differ from PoR's:
   *  opcode → [fixed operands, index of the operand holding a count of further ones] */
  operands: Record<number, [number, number?]>
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
  /** LOAD_CHARACTER past the end of the list sets a flag that the next B+0x100 read returns as 0 and
   *  clears (CotAB DS:8B87: 0x18B39, 0x20390) */
  loadPastEnd: boolean
  /** shown before "The entire party is killed!" when DAMAGE kills everyone (PoR "The END!", 0x1C667) */
  wipeBanner: string | null
  /** where a new game's scripts start: ECL block and record */
  start: { block: number; area: number }
  /** a save whose area is 0 starts here, with that area's script loaded (CotAB 1; PoR has an area 0) */
  areaZero: number | null
  /** LOAD_WALLSETS in two-slot mode (A 0x49E7 and 0x49E8 set): an operand of 0xFF leaves its slot as
   *  it is (CotAB, image 0x19563/0x19575) or is loaded like any record (PoR, image 0x1A96D: no test) */
  twoSlotSkipsFF: boolean
  /** PAUSE and CALL frame wait the game speed times this many ms (PoR FUN_1709_0dbe 225; CotAB 0x1B15B
   *  and 0x6803 → 0x57F9: Delay(DS:4FC2 · 100)) */
  pauseMs: number
  /** the PROGRAM operand that ends the game (CotAB 3: DS:4FE0 = 1, then EXIT, 0x1BA7E); null: none */
  quitProgram: number | null
  /**
   * ADD_NPC (spec/B-model/script-vm-map.md §5.2): `enemyId` the monster id that joins on the enemy side
   * (PoR 0x18, handler 29c3:2B7E; CotAB none, 0x1B61A); `tag` the identity tag char[id]: `random`
   * Random(256) (PoR FUN_45c5_1262) or `monster` the monster id (CotAB 0x35974); `loaderRolls` the record
   * is finished as LOAD_MONSTER's loader does (PoR FUN_45c5_0ec4: icon size by race, icon colours
   * rolled), else kept as stored (CotAB 0x3565C); `iconPicture` its combat icon is the combat picture
   * (CPIC) record of its monster id, as LOAD_MONSTER's picture (CotAB 0x3599F → 0x56C50), else built from
   * its icon parts (PoR). The random portrait follows T.npcHeads/npcBodies*.
   */
  addNpc: { enemyId: number | null; tag: 'random' | 'monster'; loaderRolls: boolean; iconPicture: boolean }
}

/** One B-view read: a character field (element `index` of an array field; `signed` sign-extends a byte;
 *  `mask` keeps those bits), a raw record byte, or a class's level with its dual-class part. */
export type ViewRead =
  | { field: keyof CharFields; index?: number; signed?: boolean; mask?: number }
  | { raw: number; mask?: number }
  | { classLevel: number }

export type EclVariant = 'passTime' | 'findSpell' | 'protection' | 'redrawScreen' | 'dropCharacter' | 'findEffect' |
  'destroyItems' | 'returnOrExit' | 'divideRemainder'

export const POR_ECL: EclMap = {
  a: 0x4900, b: 0x6b00, c: 0x9700, code: 0x9900, memorisedView: 0, viewReads: {}, ops: {}, skip: {}, operands: {},
  calls: { refresh: 0x2c90, sound: 0xba03, frame: -1 },
  callSounds: { by: { 8: 10, 10: 11 }, other: null },
  refreshAfterPicture: false,
  damageDespiteSave: 0,
  loadPastEnd: false,
  wipeBanner: 'The END!',
  start: { block: 3, area: 0 },
  areaZero: null,
  twoSlotSkipsFF: false,
  pauseMs: 225,
  quitProgram: null,
  addNpc: { enemyId: 0x18, tag: 'random', loaderRolls: true, iconPicture: false },
}

// spec/A-games/coab/ecl.md, "B as a view of the current character"; B+0x100's "loaded past the end" flag is
// loadPastEnd below.
export const COAB_ECL: EclMap = {
  a: 0x4b00, b: 0x7c00, c: 0x7a00, code: 0x8000, memorisedView: 1,
  viewReads: {
    0x15: { field: 'stat', index: 1 }, // INT
    0x72: { field: 'race', signed: true },
    0x73: { field: 'cls', signed: true },
    0xd6: { field: 'gender', signed: true },
    0xe4: { raw: 0x192, mask: 1 }, // CotAB record byte 0x192 (set by the Hillsfar import), no field yet
    0xc9: { classLevel: 5 }, // the magic-user level with its dual-class part (FUN 0x51841)
  },
  // spec/A-games/coab/ecl.md, "Opcodes"
  ops: {
    0x06: 'divideRemainder', 0x13: 'returnOrExit', 0x34: 'passTime', 0x3b: 'findSpell', 0x3c: 'protection',
    0x3d: 'redrawScreen', 0x3e: 'dropCharacter', 0x3f: 'findEffect', 0x40: 'destroyItems',
  },
  skip: { 0x0c: 3, 0x3f: 1, 0x40: 1 },
  // the handlers' operand-reader counts (0x1FA02; tools/coab/ecl_coab.py): PASS_TIME takes 2, three new opcodes
  operands: { 0x34: [2], 0x3e: [0], 0x3f: [1], 0x40: [1] },
  calls: { refresh: 0x2e10, sound: 0xb200, frame: 0x6803 },
  callSounds: { by: { 8: 10, 10: 11 }, other: 10 }, // 0x069B0: DS:25C2 = 10, DS:25C4 = 11
  refreshAfterPicture: true, // PICTURE sets DS:8B7C (0x190EA)
  damageDespiteSave: 0x10,
  loadPastEnd: true,
  wipeBanner: null,
  // the start-up code sets block 2 for a real game (spec/A-games/coab/assets.md); record 1 is block 2's first (I)
  start: { block: 2, area: 1 },
  // image 0x1C001–0x1C050: area 0 → record 1 (82 in the demo: games/startup.ts), loaded rather than restored
  areaZero: 1,
  twoSlotSkipsFF: true,
  pauseMs: 100,
  quitProgram: 3,
  // 0x1B61A → 0x3593D: the record as stored (0x3565C rolls nothing), char[0x126] = id, CPIC record id as
  // the combat icon, no side, no portrait
  addNpc: { enemyId: null, tag: 'monster', loaderRolls: false, iconPicture: true },
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
/** Read a B-view entry for character c. */
export function viewRead(r: ViewRead, c: Uint8Array): number {
  if ('classLevel' in r) return classLevel(c, r.classLevel) & 0xff
  if ('raw' in r) return c[r.raw] & (r.mask ?? 0xff)
  const at = r.field === 'stat' ? F.stat[r.index ?? 0] : (F[r.field] as number) + (r.index ?? 0)
  const v = c[at] & (r.mask ?? 0xff)
  return r.signed ? ((v << 24) >> 24) & 0xffff : v
}

export function native(g: EclMap, a: number): number {
  if (g === POR_ECL) return a
  for (const [k, n] of SIZES) if (a >= POR_ECL[k] && a < POR_ECL[k] + n) return g[k] + (a - POR_ECL[k])
  return a
}
