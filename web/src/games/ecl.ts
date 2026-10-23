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
  /** B-view writes to B + from … to land at memorised + (offset − from) + `offset` (PoR 0x20–0x70, 0; CotAB
   *  0x20–0x70, 1: 1-based; SotSB 0x1B–0x65, 0) */
  memorisedView: { from: number; to: number; offset: number }
  /** B-view reads this game adds to the shared ones (offset from B → value) */
  viewReads: Record<number, ViewRead>
  /** B-view writes this game adds (offset from B → the field written, a byte or with `word` a u16) */
  viewWrites: Record<number, { field: keyof CharFields; word?: boolean }>
  /** how many money words the view shows from B + 0xBB, two bytes apart (PoR, CotAB 5; SotSB 6, to 0xC5) */
  moneyWords: number
  /** B + 0x100: read as in play (0x80 out, 1 in: PoR, CotAB) or as the status byte through a table, the value
   *  by status 0, 1, 2 ... (SotSB 0x263D8: Okay 1, Running 6, Unconscious 5, Dying 4, Dead 3, Stoned 7, Gone 2,
   *  else 0); with a LOAD_CHARACTER past the end before it (`loadPastEnd`) the read is 0 either way; written
   *  `outOfPlay` (at least 0x80 out of play, 0x87 stoned, 0 the second leave flag: PoR, CotAB) or `okayInPlay`
   *  (1: Okay and in play; SotSB 0x265BD) */
  view100: { read: 'inPlay' | number[]; write: 'outOfPlay' | 'okayInPlay' }
  /** an A address the engine answers with the facing byte instead of the array (SotSB A 0x4BEA, 0x269A9); null: none */
  facingInA: number | null
  /** the PROGRAM operand that plays the ending (PoR, CotAB 8); null: none (SotSB's PROGRAM knows only 0 and 9) */
  endingProgram: number | null
  /** ADD_EP everyone, amount (SotSB 0x41, 0x21324): the lines (`party` for everyone; `one` + the name + `gains`
   *  for the current character), each character's share amount / the number of its first `classes` class levels
   *  above 0, given to those in play; null: no such opcode */
  addExperience: { party: number; one: number; gains: number; classes: number } | null
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
  /** DAMAGE's dice: `once`, one roll before the victims are chosen, the attack mode's next one after each
   *  (PoR, CotAB); `perVictim`, a roll for each victim just before its save or attack, the victim pick
   *  first (SotSB 0x208B2: 0x20973, 0x20A01, 0x20A69, 0x20B07) */
  damageRolls: 'once' | 'perVictim'
  /** LOAD_CHARACTER past the end of the list sets a flag that the next B+0x100 read returns as 0 and
   *  clears (CotAB DS:8B87: 0x18B39, 0x20390) */
  loadPastEnd: boolean
  /** shown before "The entire party is killed!" when DAMAGE kills everyone (PoR "The END!", 0x1C667) */
  wipeBanner: number | null
  /** the DAX file digit for the value scripts write to B + 0x312 (ECL 0x6E12, the block): floor((v + add) /
   *  divide); PoR and CotAB { 0, 1 }: the value is the digit; SotSB { 1, 2 } (0x26763 → 0x6EB0: two values a file) */
  blockFile: { add: number; divide: number }
  /** where a new game's scripts start: ECL block and record */
  start: { block: number; area: number }
  /** a save whose area is 0 starts here, with that area's script loaded (CotAB 1; PoR has an area 0) */
  areaZero: number | null
  /** the block that start goes to as well (SotSB 2: 0x21934 sets the block digit DS:7420 := 2); null: the save's */
  areaZeroBlock: number | null
  /** LOAD_WALLSETS in two-slot mode (A 0x49E7 and 0x49E8 set): an operand of 0xFF leaves its slot as
   *  it is (CotAB, image 0x19563/0x19575) or is loaded like any record (PoR, image 0x1A96D: no test) */
  twoSlotSkipsFF: boolean
  /** LOAD_WALLSETS operands meaning "no set": the slot is emptied (one-slot mode) or left (two-slot mode)
   *  (PoR, CotAB 0xFF; SotSB 0xFF and 0x7F, 0x1E812–0x1E949) */
  wallSetNone: number[]
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
  /** DESTROY_ITEMS puts a readied item away through the ready routine first (SotSB 0x21276 → 0x4431F: "It's
   *  Cursed!" for a cursed one, else unreadied with its item handler), each member current meanwhile */
  destroyUnreadies: boolean
  /**
   * CHECK_PARTY by the selector's offset s from B (SotSB 0x1F051: operand 1's address, or its value, − B):
   * over the party, min, max and average (sum div count, signed) of a byte, written to operands 3, 4, 5, and
   * a found flag to 6. `effect`: s for "anyone has effect operand 2" (min, max, average 0); `equals`: s →
   * field, found = anyone whose byte equals operand 2 (min 0xFF, max 0, the average unset: 0 here);
   * `bytes`: s → [field, index] read directly; `range`: s in from … to reads field + (s − from); `levels`:
   * s → class, the level (or the former level when it is higher and counts), min and max only of those of at
   * least operand 2. null: the shared PoR procedure
   */
  /** the digit of the monster files MON<n>CHA/ITM/SPC: null, the current block's (PoR, CotAB); SotSB always 1
   *  ("MON" + the constant "1", 0x4150D) */
  monsterFile: number | null
  /** FIND_SPELL's index of the first memorised slot (CotAB 1: 0x1B6E7; SotSB 0: 0x20E4D, slots 0–0x4A) */
  findSpellFirst: number
  /** COMBAT with no monsters opens the vault ('vault' screen) when this A word is 1, cleared first, before the
   *  shop and temple flags (SotSB 0x1F5C2: ECL 0x4CFC → 0x21C90, vault.dat's View, Take, Pool); null: no vault */
  combatVault: number | null
  checkParty: {
    effect: number
    equals: Record<number, keyof CharFields>
    bytes: Record<number, [keyof CharFields, number]>
    range: { from: number; to: number; field: keyof CharFields }
    levels: Record<number, number>
  } | null
}

/** One B-view read: a character field (element `index` of an array field; `signed` sign-extends a byte;
 *  `mask` keeps those bits), a raw record byte, or a class's level with its dual-class part. */
export type ViewRead =
  | { field: keyof CharFields; index?: number; signed?: boolean; mask?: number; word?: boolean }
  | { raw: number; mask?: number }
  | { classLevel: number }

export type EclVariant = 'passTime' | 'findSpell' | 'protection' | 'redrawScreen' | 'dropCharacter' | 'findEffect' |
  'destroyItems' | 'returnOrExit' | 'divideRemainder' | 'nothing' | 'addExperience'

export const POR_ECL: EclMap = {
  a: 0x4900, b: 0x6b00, c: 0x9700, code: 0x9900, memorisedView: { from: 0x20, to: 0x70, offset: 0 }, viewReads: {}, viewWrites: {},
  moneyWords: 5, view100: { read: 'inPlay', write: 'outOfPlay' }, facingInA: null, endingProgram: 8, addExperience: null,
  ops: {}, skip: {}, operands: {},
  calls: { refresh: 0x2c90, sound: 0xba03, frame: -1 },
  callSounds: { by: { 8: 10, 10: 11 }, other: null },
  refreshAfterPicture: false,
  damageDespiteSave: 0,
  damageRolls: 'once',
  loadPastEnd: false,
  wipeBanner: 0x1c35d, // "The END!" (FUN_29c3_2775)
  blockFile: { add: 0, divide: 1 },
  start: { block: 3, area: 0 },
  areaZero: null,
  areaZeroBlock: null,
  twoSlotSkipsFF: false,
  wallSetNone: [0xff],
  pauseMs: 225,
  quitProgram: null,
  addNpc: { enemyId: 0x18, tag: 'random', loaderRolls: true, iconPicture: false },
  destroyUnreadies: false,
  monsterFile: null,
  findSpellFirst: 1,
  combatVault: null,
  checkParty: null,
}

// spec/A-games/coab/ecl.md, "B as a view of the current character"; B+0x100's "loaded past the end" flag is
// loadPastEnd below.
export const COAB_ECL: EclMap = {
  a: 0x4b00, b: 0x7c00, c: 0x7a00, code: 0x8000, memorisedView: { from: 0x20, to: 0x70, offset: 1 }, viewWrites: {},
  moneyWords: 5, view100: { read: 'inPlay', write: 'outOfPlay' }, facingInA: null, endingProgram: 8, addExperience: null,
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
  damageRolls: 'once',
  loadPastEnd: true,
  wipeBanner: null,
  // the start-up code sets block 2 for a real game (spec/A-games/coab/assets.md); record 1 is block 2's first (I)
  blockFile: { add: 0, divide: 1 },
  start: { block: 2, area: 1 },
  // image 0x1C001–0x1C050: area 0 → record 1 (82 in the demo: games/startup.ts), loaded rather than restored
  areaZero: 1,
  areaZeroBlock: null,
  twoSlotSkipsFF: true,
  wallSetNone: [0xff],
  pauseMs: 100,
  quitProgram: 3,
  // 0x1B61A → 0x3593D: the record as stored (0x3565C rolls nothing), char[0x126] = id, CPIC record id as
  // the combat icon, no side, no portrait
  addNpc: { enemyId: null, tag: 'monster', loaderRolls: false, iconPicture: true },
  destroyUnreadies: false, // 0x1BB49: the items freed at once
  monsterFile: null,
  findSpellFirst: 1, // 0x1B6E7
  combatVault: null,
  checkParty: null, // I: CotAB's 0x19CA4 (the port runs PoR's selectors)
}

// spec/A-games/sotsb/ecl.md: CotAB's spaces; the view follows the 439-byte record; PROTECTION reads nothing;
// ADD_EP (0x41) new; PROGRAM knows only 0 and 9; the second leave flag is never set (B+0x100 written 1 revives).
// Handlers not yet read (CHECK_PARTY, TREASURE, LOAD_MONSTER, COMBAT, DAMAGE ...) keep CotAB's behaviour (?)
export const SOTSB_ECL: EclMap = {
  a: 0x4b00, b: 0x7c00, c: 0x7a00, code: 0x8000, memorisedView: { from: 0x1b, to: 0x65, offset: 0 },
  viewReads: {
    0x15: { field: 'stat', index: 1 }, // INT
    0x19: { field: 'stat', index: 5 }, // +0x1B
    0x72: { field: 'race', signed: true },
    0x73: { field: 'cls', signed: true },
    0x76: { field: 'maxHp' }, // +0x70
    0xac: { field: 'undead' }, // +0xF2
    0xc9: { classLevel: 5 }, 0xca: { classLevel: 0 }, 0xcb: { classLevel: 6 }, 0xcc: { classLevel: 2 }, 0xcf: { classLevel: 3 }, 0xd0: { classLevel: 4 },
    0xd6: { field: 'gender', signed: true },
    0x119: { field: 'hp' }, // +0x1B5
  },
  viewWrites: { 0x119: { field: 'hp' } },
  moneyWords: 6,
  view100: { read: [1, 0, 0, 6, 5, 4, 3, 7, 2], write: 'okayInPlay' }, // 0x263D8
  facingInA: 0x49ea, // A 0x4BEA in SotSB's numbering
  endingProgram: null,
  // CS:0x37A4, 0x37D0, 0x37E1 in the VM's segment (image 0x1DB30): the levels +0x111 ... +0x116, the thief's not counted
  addExperience: { party: 0x212d4, one: 0x21300, gains: 0x21311, classes: 6 },
  ops: {
    0x06: 'divideRemainder', 0x13: 'returnOrExit', 0x34: 'passTime', 0x3b: 'findSpell', 0x3c: 'nothing',
    0x3d: 'redrawScreen', 0x3e: 'dropCharacter', 0x3f: 'findEffect', 0x40: 'destroyItems', 0x41: 'addExperience',
  },
  // 0x27864: CotAB's lists with 0x41 among the two-operand ones; 0x3C keeps its 1 though it reads none
  skip: { 0x0c: 3, 0x3f: 1, 0x40: 1, 0x41: 2 },
  operands: { 0x34: [2], 0x3c: [0], 0x3e: [0], 0x3f: [1], 0x40: [1], 0x41: [2] },
  calls: { refresh: 0x2dcb, sound: 0xb203, frame: 0x6803 },
  callSounds: { by: { 8: 10, 10: 11 }, other: 10 }, // DS:19DA, 19DC (I: their values CotAB's)
  refreshAfterPicture: true, // I: as CotAB
  damageDespiteSave: 0x10, // 0x2091A: flags & 0x10, as CotAB's
  damageRolls: 'perVictim',
  loadPastEnd: true, // I
  wipeBanner: null,
  // 0x21934: a new game at record 17 (block 2); the demo at record 3 (block 1, games/startup.ts)
  blockFile: { add: 1, divide: 2 },
  start: { block: 2, area: 17 },
  areaZero: 17,
  areaZeroBlock: 2,
  twoSlotSkipsFF: true, // I
  wallSetNone: [0xff, 0x7f],
  pauseMs: 100, // I
  quitProgram: null,
  addNpc: { enemyId: null, tag: 'monster', loaderRolls: false, iconPicture: true }, // I: as CotAB
  destroyUnreadies: true,
  monsterFile: 1,
  findSpellFirst: 0,
  combatVault: 0x4afc, // ECL 0x4CFC
  // 0x1F051: s 0 (−0x7C00 = 0x8400) the effect; 0x72 race; 0x19 CHA; 0xA5–0xAC thief skills from +0xF3;
  // 0x9F movement +0x1B6; 0xC9–0xD0 class levels (0xCD, 0xCE read no class: not listed)
  checkParty: {
    effect: 0x8400,
    equals: { 0x72: 'race' },
    bytes: { 0x19: ['stat', 5], 0x9f: ['move', 0] },
    range: { from: 0xa5, to: 0xac, field: 'thief' },
    levels: { 0xc9: 5, 0xca: 0, 0xcb: 6, 0xcc: 2, 0xcf: 3, 0xd0: 4 },
  },
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
  if (r.word) return c[at] | (c[at + 1] << 8)
  const v = c[at] & (r.mask ?? 0xff)
  return r.signed ? ((v << 24) >> 24) & 0xffff : v
}

export function native(g: EclMap, a: number): number {
  if (g === POR_ECL) return a
  for (const [k, n] of SIZES) if (a >= POR_ECL[k] && a < POR_ECL[k] + n) return g[k] + (a - POR_ECL[k])
  return a
}
