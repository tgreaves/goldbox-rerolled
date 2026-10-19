// The rules tables in each game's START.EXE data segment, by name (docs/multi-game.md, step 3).
// Code reads `t.b(T.thac0.at + k * T.thac0.row + L)` instead of `t.b(0x3c7c + k * 11 + L)`, and T
// holds the active game's addresses. PoR: the spec files cited in the port; CotAB:
// spec/coab/tables.md §2. `at` is the DS offset of entry 0 (−1: the game has no such table); `row`
// is the size of one row where the table is indexed by a first key (class, race, level …).

export interface TableRef { at: number; row: number }
const absent: TableRef = { at: -1, row: 0 }
const t = (at: number, row = 0): TableRef => ({ at, row })

export interface TableMap {
  /** image offset of the data segment */
  ds: number
  /** item-use bit per base class (8 bytes) */
  classBits: TableRef
  /** training-hall bit per base class (8 bytes) */
  trainerBits: TableRef
  /** hit dice per base class: count, sides (8 bytes each) */
  hitDiceCount: TableRef
  hitDiceSides: TableRef
  /** CotAB: the level from which a class's hit points are fixed (8 bytes) */
  hitDiceStop: TableRef
  /** random NPC portraits: heads [gender·8 + 1..8]; bodies by class [gender·5 + 1..5] (PoR only) */
  npcHeads: TableRef
  npcBodiesCleric: TableRef
  npcBodiesFighter: TableRef
  npcBodiesMagicUser: TableRef
  npcBodiesThief: TableRef
  /** name tables, Pascal strings: races (8), classes (17; 17 "Monster" is race 0's name), alignments
   *  (9), statuses (9), genders (2), coins (7) */
  raceNames: TableRef
  classNames: TableRef
  alignmentNames: TableRef
  statusNames: TableRef
  genderNames: TableRef
  coinNames: TableRef
  /** coin values in copper-equivalent units, u32 × 5 (copper … platinum); gold is 200 */
  coinValues: TableRef
  /** temple service names, Pascal strings in menu order (the last is Exit) */
  templeNames: TableRef
  /** the disease effect types, entries 1–6 */
  diseases: TableRef
  /** random-item records: u16 words, record m from word m */
  randomItems: TableRef
  /** sky colours, 16 bytes */
  sky: TableRef
  /** item name words, Pascal strings; word 1 at `at`, `row` bytes each */
  itemWords: TableRef
  /** direction vectors, 9 signed bytes each */
  wallDx: TableRef
  wallDy: TableRef
  /** battlefield cells, 4 bytes each: move, ?, sight, image */
  battleCells: TableRef
  /** portrait number → HEAD3 / BODY3 record (PoR only) */
  headRecords: TableRef
  bodyRecords: TableRef
  /** spell names, Pascal strings; spell 1 at `at` */
  spellNames: TableRef
  /** spell records, 16 bytes; spell id at `at + id · row` */
  spellRecords: TableRef
  /** overland map, plot squares, area columns (PoR only) */
  overlandMap: TableRef
  overlandSpecials: TableRef
  overlandColumns: TableRef
  /** 60 − THAC0 by class and level */
  thac0: TableRef
  /** thief skills: base by level (·8 + skill), race adjustment (·8 + skill), DEX adjustment (·5 + skill) */
  thiefBase: TableRef
  thiefRace: TableRef
  thiefDex: TableRef
  /** race ability limits (16 bytes a race) */
  raceLimits: TableRef
  /** classes a race may take: count, then ids */
  raceClasses: TableRef
  /** starting age by race and class column: u16 base, dice count, dice sides */
  startAge: TableRef
  /** ageing thresholds by race, 5 words */
  ageing: TableRef
  /** class ability minimums, 6 bytes a class */
  classMins: TableRef
  /** alignments a class may take: count, then ids */
  alignments: TableRef
  /** s8 hit-point bonus by CON */
  conHp: TableRef
  /** u32 experience needed by class and level; `levels` entries a class */
  xp: TableRef & { levels: number }
  /** spell slots by level (PoR: absolute; CotAB: increments), cleric and magic-user */
  clericSlots: TableRef
  muSlots: TableRef
  /** CotAB slot increments for paladins (cleric spells) and rangers (druid, then magic-user) */
  paladinSlots: TableRef
  rangerSlots: TableRef
  /** starting gold dice by class: count, sides */
  startGold: TableRef
  /** saving throws by class (row), level (·5) and kind */
  saves: TableRef
}

export const POR_TABLES: TableMap = {
  ds: 0xc7c0,
  classBits: t(0x05d6), trainerBits: t(0x05de), hitDiceCount: t(0x08b6), hitDiceSides: t(0x08be), hitDiceStop: absent,
  npcHeads: t(0x08c7), npcBodiesCleric: t(0x08d7), npcBodiesFighter: t(0x08e1), npcBodiesMagicUser: t(0x08eb), npcBodiesThief: t(0x08f5),
  raceNames: t(0x0f03, 10), classNames: t(0x0d38, 27), alignmentNames: t(0x0f53, 17), statusNames: t(0x1047, 13),
  genderNames: t(0x0fec, 7), coinNames: t(0x0ffa, 11), coinValues: t(0x0d24, 4),
  templeNames: t(0x011a, 41), diseases: t(0x0113), randomItems: t(0x0970), sky: t(0x0c26), itemWords: t(0x10bc, 21), wallDx: t(0x2736), wallDy: t(0x273f),
  battleCells: t(0x2744, 4), headRecords: t(0x286f), bodyRecords: t(0x287d), spellNames: t(0x2912, 41), spellRecords: t(0x31fa, 16),
  overlandMap: t(0x3648), overlandSpecials: t(0x0c36, 6), overlandColumns: t(0x3c76),
  thac0: t(0x3c7c, 11), thiefBase: t(0x3cf3, 8), thiefRace: t(0x3d3b, 8), thiefDex: t(0x3d4e, 5), raceLimits: t(0x3da3, 16),
  raceClasses: t(0x3e17, 12), startAge: t(0x3e5b, 0x1c), ageing: t(0x3f31, 10), classMins: t(0x3f81, 6), alignments: t(0x3fe7, 10),
  conHp: t(0x408e), xp: { at: 0x409b, row: 0x38, levels: 14 }, clericSlots: t(0x40bc, 3), muSlots: t(0x41d4, 3), paladinSlots: absent, rangerSlots: absent,
  startGold: t(0x4263, 2), saves: t(0x426e, 0x2d),
}

export const COAB_TABLES: TableMap = {
  ds: 0xabe0,
  classBits: t(0x3ea2), trainerBits: t(0x3eaa), hitDiceCount: t(0x081a), hitDiceSides: t(0x0822), hitDiceStop: t(0x3ebb),
  npcHeads: absent, npcBodiesCleric: absent, npcBodiesFighter: absent, npcBodiesMagicUser: absent, npcBodiesThief: absent,
  raceNames: t(0x0e9e, 10), classNames: t(0x0cb8, 27), alignmentNames: t(0x0eee, 17), statusNames: t(0x0fe2, 13),
  genderNames: t(0x0f87, 7), coinNames: t(0x0f95, 11), coinValues: t(0x0ca4, 4),
  templeNames: t(0x00e6, 41), diseases: t(0x00df), randomItems: t(0x082e), sky: t(0x0a8a), itemWords: t(0x1057, 21), wallDx: t(0x2696), wallDy: t(0x269f),
  battleCells: t(0x26a4, 4), headRecords: absent, bodyRecords: absent, spellNames: t(0x27e8, 41), spellRecords: t(0x37dc, 16),
  overlandMap: absent, overlandSpecials: absent, overlandColumns: absent,
  thac0: t(0x3e3a, 13), thiefBase: t(0x3ec0, 8), thiefRace: t(0x3f20, 8), thiefDex: t(0x3f33, 5), raceLimits: t(0x3f88, 16),
  raceClasses: t(0x3ffa, 14), startAge: t(0x404e, 0x1c), ageing: t(0x4124, 10), classMins: t(0x4174, 6), alignments: t(0x41da, 10),
  conHp: t(0x4281), xp: { at: 0x4293, row: 0x63, levels: 13 }, clericSlots: t(0x42bc, 5), muSlots: t(0x44ab, 5), paladinSlots: t(0x43e5, 5), rangerSlots: t(0x4448, 5),
  startGold: t(0x45b3, 2), saves: t(0x45be, 0x3c),
}

/** The active game's tables; start-up (setGame) switches them. */
export const T: TableMap = { ...POR_TABLES }

export function useTables(m: TableMap) {
  Object.assign(T, m)
}
