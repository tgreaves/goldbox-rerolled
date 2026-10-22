// The rules tables in each game's START.EXE data segment, by name (docs/multi-game.md, step 3).
// Code reads `t.b(T.thac0.at + k * T.thac0.row + L)` instead of `t.b(0x3c7c + k * 11 + L)`, and T
// holds the active game's addresses. PoR: the spec files cited in the port; CotAB:
// spec/A-games/coab/tables.md §2. `at` is the DS offset of entry 0 (−1: the game has no such table); `row`
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
  /** CotAB screen frame: tile per column of the top, bottom and divider rows (40 each) and per row of
   *  the left and right columns (24 each), drawn by 0x1330 / 0x1403 */
  frameTop: TableRef
  frameBottom: TableRef
  frameLeft: TableRef
  frameRight: TableRef
  frameDivider: TableRef
  /** CotAB overland city cursor: cell x and y by place (33 bytes each) */
  cursorX: TableRef
  cursorY: TableRef
  /** CotAB wilderness battlefields: terrain feature flags by overland place (ECL 0x4CA1), read at 0x25621 */
  placeTerrain: TableRef
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
  /**
   * CotAB's area template 0x4573F: by the direction of the step onto the last creature of its centre
   * line, s8 offsets of the end point for the second line (`fanDx1`/`fanDy1`, DS:0A22/0A2A) and the
   * third (`fanDx2`/`fanDy2`, DS:0A12/0A1A), 8 bytes each (PoR has no such template)
   */
  fanDx1: TableRef
  fanDy1: TableRef
  fanDx2: TableRef
  fanDy2: TableRef
  /**
   * The gas clouds' squares: direction indices (into wallDx/wallDy; 8 is the square itself) from entry 1,
   * offsets from the aimed square. `gasCloud`: Stinking Cloud's 4 (PoR DS:290D, FUN_4e53_1b11; CotAB
   * DS:27D9, 0x4675B); `killCloud`: CotAB Cloudkill's 9 (DS:27DD, 0x48F05), which overlaps the first
   */
  gasCloud: TableRef
  killCloud: TableRef
  /** CotAB's room furnishing 0x24D63: s8 column and row offsets of the four cells beside a table where
   *  chairs go, entries 1–4 (DS:034C, DS:0350: up, right, down, left; PoR furnishes no rooms) */
  furnishDx: TableRef
  furnishDy: TableRef
  /** the drawn view's piece tables (spec/A-games/engine/maps-and-view.md, "Wall pieces"), contiguous:
   *  10 bytes first tile index, 10 widths, 10 heights (cells), 10 words base column, 10 words row */
  viewPieces: TableRef
  /**
   * Battle placement's scan (PoR FUN_34c7_1577, CotAB 0x26010; spec/A-games/engine/combat-rules.md
   * "Placement"), by a side's orientation F and ring: `placeRing` [4·F + ring] the 8-way direction of the
   * ring's square from the side's own (entry 0 unused) and, entries 1–3, the party's neighbours the second
   * line's skip tests; `placeOrient` [4·F + ring] twice the line orientation d4; `placeVec` [d4] the 8-way
   * direction of the line vector V[d4]; `placeOriginX` / `placeOriginY` [4·(ring > 0) + d4] s8 line
   * origins; `placeAllow` [t] six rows of [first, last] allowed columns (t = F, all = 4 for ring 1)
   */
  placeRing: TableRef
  placeOrient: TableRef
  placeVec: TableRef
  placeOriginX: TableRef
  placeOriginY: TableRef
  placeAllow: TableRef
}

export const POR_TABLES: TableMap = {
  ds: 0xc7c0,
  classBits: t(0x05d6), trainerBits: t(0x05de), hitDiceCount: t(0x08b6), hitDiceSides: t(0x08be), hitDiceStop: absent,
  npcHeads: t(0x08c7), npcBodiesCleric: t(0x08d7), npcBodiesFighter: t(0x08e1), npcBodiesMagicUser: t(0x08eb), npcBodiesThief: t(0x08f5),
  raceNames: t(0x0f03, 10), classNames: t(0x0d38, 27), alignmentNames: t(0x0f53, 17), statusNames: t(0x1047, 13),
  genderNames: t(0x0fec, 7), coinNames: t(0x0ffa, 11), coinValues: t(0x0d24, 4),
  frameTop: absent, frameBottom: absent, frameLeft: absent, frameRight: absent, frameDivider: absent,
  cursorX: absent, cursorY: absent, placeTerrain: absent,
  templeNames: t(0x011a, 41), diseases: t(0x0113), randomItems: t(0x0970), sky: t(0x0c26), itemWords: t(0x10bc, 21), wallDx: t(0x2736), wallDy: t(0x273f),
  battleCells: t(0x2744, 4), headRecords: t(0x286f), bodyRecords: t(0x287d), spellNames: t(0x2912, 41), spellRecords: t(0x31fa, 16),
  overlandMap: t(0x3648), overlandSpecials: t(0x0c36, 6), overlandColumns: t(0x3c76),
  thac0: t(0x3c7c, 11), thiefBase: t(0x3cf3, 8), thiefRace: t(0x3d3b, 8), thiefDex: t(0x3d4e, 5), raceLimits: t(0x3da3, 16),
  raceClasses: t(0x3e17, 12), startAge: t(0x3e5b, 0x1c), ageing: t(0x3f31, 10), classMins: t(0x3f81, 6), alignments: t(0x3fe7, 10),
  conHp: t(0x408e), xp: { at: 0x409b, row: 0x38, levels: 14 }, clericSlots: t(0x40bc, 3), muSlots: t(0x41d4, 3), paladinSlots: absent, rangerSlots: absent,
  startGold: t(0x4263, 2), saves: t(0x426e, 0x2d),
  fanDx1: absent, fanDy1: absent, fanDx2: absent, fanDy2: absent,
  gasCloud: t(0x290d), killCloud: absent, furnishDx: absent, furnishDy: absent,
  viewPieces: t(0x0c8c),
  placeRing: t(0x02d2, 4), placeOrient: t(0x02e2, 4), placeVec: t(0x02f2), placeOriginX: t(0x02f6), placeOriginY: t(0x02fe), placeAllow: t(0x0306, 12),
}

export const COAB_TABLES: TableMap = {
  ds: 0xabe0,
  classBits: t(0x3ea2), trainerBits: t(0x3eaa), hitDiceCount: t(0x081a), hitDiceSides: t(0x0822), hitDiceStop: t(0x3ebb),
  npcHeads: absent, npcBodiesCleric: absent, npcBodiesFighter: absent, npcBodiesMagicUser: absent, npcBodiesThief: absent,
  raceNames: t(0x0e9e, 10), classNames: t(0x0cb8, 27), alignmentNames: t(0x0eee, 17), statusNames: t(0x0fe2, 13),
  genderNames: t(0x0f87, 7), coinNames: t(0x0f95, 11), coinValues: t(0x0ca4, 4),
  frameTop: t(0x0b50), frameBottom: t(0x0ba0), frameLeft: t(0x0be2), frameRight: t(0x0c0b), frameDivider: t(0x0b78),
  cursorX: t(0x0a4a), cursorY: t(0x0a6a), placeTerrain: t(0x0354),
  templeNames: t(0x00e6, 41), diseases: t(0x00df), randomItems: t(0x082e), sky: t(0x0a8a), itemWords: t(0x1057, 21), wallDx: t(0x2696), wallDy: t(0x269f),
  battleCells: t(0x26a4, 4), headRecords: absent, bodyRecords: absent, spellNames: t(0x27e8, 41), spellRecords: t(0x37dc, 16),
  overlandMap: absent, overlandSpecials: absent, overlandColumns: absent,
  thac0: t(0x3e3a, 13), thiefBase: t(0x3ec0, 8), thiefRace: t(0x3f20, 8), thiefDex: t(0x3f33, 5), raceLimits: t(0x3f88, 16),
  raceClasses: t(0x3ffa, 14), startAge: t(0x404e, 0x1c), ageing: t(0x4124, 10), classMins: t(0x4174, 6), alignments: t(0x41da, 10),
  conHp: t(0x4281), xp: { at: 0x4293, row: 0x63, levels: 13 }, clericSlots: t(0x42bc, 5), muSlots: t(0x44ab, 5), paladinSlots: t(0x43e5, 5), rangerSlots: t(0x4448, 5),
  startGold: t(0x45b3, 2), saves: t(0x45be, 0x3c),
  fanDx1: t(0x0a22), fanDy1: t(0x0a2a), fanDx2: t(0x0a12), fanDy2: t(0x0a1a),
  gasCloud: t(0x27d9), killCloud: t(0x27dd), furnishDx: t(0x034b), furnishDy: t(0x034f),
  viewPieces: t(0x0ada),
  placeRing: t(0x02dc, 4), placeOrient: t(0x02ec, 4), placeVec: t(0x02fc), placeOriginX: t(0x0300), placeOriginY: t(0x0308), placeAllow: t(0x0310, 12),
}

// spec/A-games/sotsb/tables.md §2 (DS = paragraph 0x0DE2): O where the reading code was found, else a
// data match (I). Not found yet (?): the frame tables, the overland cursor and terrain, randomItems and the
// temple's disease list (I: DS:1B3D[1..4]), marked absent
export const SOTSB_TABLES: TableMap = {
  ds: 0xde20,
  classBits: t(0x4c92), trainerBits: t(0x4c99), hitDiceCount: t(0x09b0), hitDiceSides: t(0x09b7), hitDiceStop: t(0x4ca9),
  npcHeads: absent, npcBodiesCleric: absent, npcBodiesFighter: absent, npcBodiesMagicUser: absent, npcBodiesThief: absent,
  raceNames: t(0x0d71, 9), classNames: t(0x0b8b, 27), alignmentNames: t(0x0db9, 17), statusNames: t(0x0ead, 13),
  genderNames: t(0x0e52, 7), coinNames: t(0x0e60, 11), coinValues: t(0x0b40, 4),
  frameTop: absent, frameBottom: absent, frameLeft: absent, frameRight: absent, frameDivider: absent,
  cursorX: absent, cursorY: absent, placeTerrain: absent,
  // diseases: DS:1B3D[1..4], read by Cure Disease and Fix (0x226AC, 0x3885E; I: the temple's too)
  templeNames: t(0x014c, 41), diseases: t(0x1b3d), randomItems: absent, sky: t(0x0aa8), itemWords: t(0x0f22, 21), wallDx: t(0x1a90), wallDy: t(0x1a99),
  battleCells: t(0x1a9e, 4), headRecords: absent, bodyRecords: absent, spellNames: t(0x34ae, 35), spellRecords: t(0x449d, 16),
  overlandMap: absent, overlandSpecials: absent, overlandColumns: absent,
  thac0: t(0x4c0c, 19), thiefBase: t(0x4cad, 8), thiefRace: t(0x4d3d, 8), thiefDex: t(0x4d48, 5), raceLimits: t(0x4d9d, 16),
  raceClasses: t(0x4dff, 14), startAge: t(0x4e45, 0x1c), ageing: t(0x4eff, 10), classMins: t(0x4f45, 6), alignments: t(0x4fab, 10),
  conHp: t(0x5052), xp: { at: 0x5064, row: 0xbb, levels: 19 }, clericSlots: t(0x50a1, 7), muSlots: t(0x5448, 7), paladinSlots: t(0x52d2, 7), rangerSlots: t(0x538d, 7),
  startGold: t(0x5589, 2), saves: t(0x5592, 0x5a),
  fanDx1: t(0x0a1a), fanDy1: t(0x0a22), fanDx2: t(0x0a0a), fanDy2: t(0x0a12),
  gasCloud: t(0x349f), killCloud: t(0x34a3), furnishDx: t(0x03bf), furnishDy: t(0x03c3),
  viewPieces: t(0x0ad8),
  placeRing: t(0x0350, 4), placeOrient: t(0x0360, 4), placeVec: t(0x0370), placeOriginX: t(0x0374), placeOriginY: t(0x037c), placeAllow: t(0x0384, 12),
}

/** The active game's tables; start-up (setGame) switches them. */
export const T: TableMap = { ...POR_TABLES }

export function useTables(m: TableMap) {
  Object.assign(T, m)
}
