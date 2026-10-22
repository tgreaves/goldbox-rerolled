// Each game's rules where they differ (docs/multi-game.md, step 6). Values first; where a procedure
// differs the profile names which one, and both live in rules/. PoR: spec/; CotAB: spec/A-games/coab/tables.md §3.
import { F } from './fields'

export interface SpellRules {
  /** spell records read from START.EXE, and how many of them have names */
  records: number
  named: number
  /** highest id a player can have in a spell book (PoR 55: Restoration and the item spells are not) */
  book: number
  /** spell levels a player casts */
  levels: number
  /** spell class codes in the spell records (−1: the game has none) */
  cleric: number
  druid: number
  magicUser: number
  item: number
  /**
   * The spell an item casts with Use (PoR FUN_4894_1a8a, CotAB 0x3F9F1): item[0x3D] & `mask`, and an
   * id above `above` loses `minus` (PoR: its item spells are records 0x39–0x43, stored as 0x50–0x5A).
   * PoR 0x3A468: above 0x38 less 0x17; CotAB 0x3FA0D: & 0x7F, no shift (its items hold spell ids)
   */
  itemSpell: { mask: number; above: number; minus: number }
}

/** A number worked out from a wilderness field's terrain flags: `base`, then each step whose flag is set,
 *  in order (`=` sets, `+` adds); `under`: a result below its first number becomes its second */
/** the computer's movement probe on a cloud square (`clouds`): who may step there */
export interface CloudProbe { immune: number[]; turned: boolean; save: number | null; below?: number }

export interface FlagValue { base: number; steps: [flag: number, op: '=' | '+', n: number][]; under?: [number, number] }
/** a cell drawn from a run: `base` + 1d`sides` (`sides` 0: `base`, no die) */
export type CellDie = [base: number, sides: number]
/** a river's course: d100 ≤ `chance` to run (the d100 rolled whatever the chance); start column `from` −
 *  `count`d`sides`, then lowered until (column + `offset`) mod `every` = 0; one column right per row */
export interface RiverCourse { chance: FlagValue; from: number; count: number; sides: number; every: number; offset: number }
/**
 * One pass of a wilderness battlefield (spec/A-games/engine/battlefield.md, "Wilderness battlefields"; spec/A-games/coab/combat.md).
 * Each names a procedure in rules/battlefield.ts by what it does; its numbers are the game's. The passes
 * that visit every cell scan columns outer, rows inner (both originals).
 * - `river`: each row while the column is on the field, the two `cells` of the water, then d`fordDie`
 *   (always rolled): 1, or with `pairs` an odd count of fords so far, → a ford, its `ford` cells at
 *   [row + dr, column + dc]; then a `crossing` (the ford at rows r and r + 1, r = `from` − d`die`) if no
 *   ford was made. `edge`: `spill`, the grid is one flat array and a cell past column 49 lands in the
 *   next row's column 0 (PoR FUN_34c7_0bde, FUN_34c7_0b97); `clip`, a cell past the edge, and the
 *   second cell's die, are skipped (CotAB 0x25690, 0x2563C)
 * - `treesBySize`: a d10 size gives the trunk (`trunk` + size) and, below 5, the crown above (`crown` +
 *   size); with flag `swamp` the size is 3 + d3 (PoR FUN_34c7_0d13)
 * - `treesOrLogs`: nothing with flag `skip`; else d100 ≤ chance again → a `log`, otherwise a `crown`
 *   above and a `trunk`, each its own roll (CotAB 0x2579B)
 * - `scatterTerrain`: d255 against cactus (`a`), shrubs (6), rocks (`b`), marsh plants (`c`), tufts (`d`),
 *   tall cactus and puddles (PoR FUN_34c7_0e9e)
 * - `scatterOdds`: a flag `score` picks a row of `odds`; d`die` falls in the first band whose running
 *   sum holds it, band i setting `cells[i]` (CotAB 0x25ADA, 0x25932)
 * - `finishing`: odd rocks, bones and flowers on blank ground (PoR FUN_34c7_0000, shared with map areas)
 */
export type WildPass =
  | {
    pass: 'river'; course: RiverCourse; cells: [CellDie, CellDie]; fordDie: number; pairs: boolean
    ford: [dr: number, dc: number, cell: number][]; crossing: { from: number; die: number } | null; edge: 'spill' | 'clip'
  }
  | { pass: 'treesBySize'; chance: FlagValue; swamp: number; trunk: number; crown: number }
  | { pass: 'treesOrLogs'; skip: number; chance: FlagValue; log: CellDie; crown: CellDie; trunk: CellDie }
  | {
    pass: 'scatterTerrain'; a: FlagValue; b: FlagValue; c: FlagValue; d: FlagValue; shrubs: number
    cactus: number; tallCactus: [number, number]; shrub: CellDie; rocks: CellDie; marsh: number; tuft: number; puddleFlag: number
  }
  | { pass: 'scatterOdds'; score: FlagValue; die: number; odds: { from: number; to: number; odds: number[] }[]; cells: CellDie[] }
  | { pass: 'finishing' }
/** a wilderness battlefield: every cell `fill`, then the passes in order; `blank` are the cells drawn as
 *  blank ground (image slot 0x16 in T.battleCells), the ones the passes may change */
export interface WildFieldSpec { fill: number; blank: number[]; passes: WildPass[] }

/**
 * How a map-area battlefield is built (rules/battlefield.ts mapBattlefield; PoR FUN_34c7_0810, CotAB
 * 0x2555D, one procedure: 13 × 5 squares around the party, each a sheared block of cells by its walls
 * and doors). `cornerWallEnd`: the north-east corner's top-right cell where the square's north and east
 * are open, the edge north of the corner a wall and the east square's north open (PoR 0x04, the
 * 0x03 + 1 at image 0x25373; CotAB 0x08, the 0x07 + 1 at 0x25467). `finishing`: PoR's finishing pass
 * (FUN_34c7_0000) over the field afterwards. `furnish`: after each square (CotAB 0x24D63), in a room (a
 * wall on some side, not two opposite walls alone, no door) whose map byte (GEO plane 2) has `flag`,
 * each `blank` interior cell takes a `table` cell on d`die` ≤ `atMost`, then each blank neighbour
 * (T.furnishDx/Dy) a `chair` the same way; null: no furnishing (PoR)
 */
export interface MapFieldSpec {
  cornerWallEnd: number
  finishing: boolean
  furnish: { flag: number; blank: number[]; table: [cell: number, die: number, atMost: number]; chair: [cell: number, die: number, atMost: number] } | null
}

export interface GameRules {
  spells: SpellRules
  /** how spell slots are worked out (PoR FUN_51cf_0000, CotAB FUN 0x50480, spec/A-games/coab/tables.md §3.5):
   *  optionally clear every slot first; then per source, if the class has a level: one first-level slot
   *  (`first`), and the table's rows from level `from` either set (the class's own level's row) or added
   *  (rows from..level), each column into a pool and spell level, a dual-class character's former level
   *  standing in for a class's own once it counts (CotAB 0x50480); the WIS bonus right after the cleric
   *  source (PoR FUN_51cf_01af, CotAB 0x50AF6), so a paladin's cleric slots never get it; then the
   *  spells learnt (those of a class with slots, or all of a class) */
  slots: {
    clear: boolean
    sources: { cls: number; table: 'clericSlots' | 'muSlots' | 'paladinSlots' | 'rangerSlots'; from: number; first: boolean; add: boolean; columns: { pool: 'cleric' | 'druid' | 'mu'; level: number }[] }[]
    wisdom: 'afterCleric'
    /** the WIS bonus: [WIS above, cleric spell level], each +1 slot when that level has one (PoR FUN_51cf_01af, CotAB 0x50AF6) */
    wisBonus: [number, number][]
    learn: { classes: number[]; spellClass: 'cleric' | 'druid'; all: boolean }[]
    /** a readied item with this effect byte (+0x3E) doubles the magic-user slots of levels 1..levels */
    doubler: { effect: number; levels: number } | null
  }
  /** base class → the level above which it gets 3 attacks per 2 rounds */
  extraAttacks: Record<number, number>
  /** how a level's hit points are rolled, per class (PoR: the class's dice every level, at least 2/3 of
   *  a die at level 1; CotAB FUN 0x3b230: the dice at level 1 and `laterDice` after, the best of `rolls`
   *  rolls, and from the stop level (T.hitDiceStop) a fixed amount that replaces the sum so far) */
  hitPoints: { laterDice: number | null; rolls: number; firstLevelMin: [number, number] | null; fixed: (number | null)[] | null }
  /** demi-human level limits: race, base class, the ability that sets the band, and the limit with
   *  that ability below 17, at 17 and at 18 or more (18/xx counts as 18) */
  levelLimits: { race: number; cls: number; by: 0 | 1; limits: [number, number, number] }[]
  /** starting money in one coin (index into the money words): the class dice × 10 shared over the
   *  classes (PoR, gold), or a fixed amount (CotAB 300 platinum; the dice are still rolled, then dropped) */
  startMoney: { coin: number; fixed: number | null }
  /** the temple's healing services in the order of the game's name table (T.templeNames), with
   *  their prices (immediates in the game's code, not a table) */
  /** the temple's services in menu order; `spell`: the service runs that spell's handler on the character (Remove Curse: PoR FUN_4e53_2540, CotAB 0x47575) */
  temple: { kind: TempleService; gp: number; spell?: number }[]
  /** caster level by spell class: the best of its terms (a class's level, plus its former dual-class
   *  level when that counts, minus `minus`; never below 0); item-only spells cast at 12 and anything
   *  cast from an item at 6 (PoR FUN_10ba_26c2; CotAB 0x4F8BF, spec/A-games/coab/tables.md §3.7) */
  casterTerms: Record<number, { cls: number; minus: number }[]>
  /** CotAB: characters with none of these levels high enough cast everything at 6 (0x4F8C5) */
  casterGate: { atLeast: Record<number, number>; level: number } | null
  /**
   * Dual-classing (CotAB's "Human Change Classes", 0x5135D; spec/B-model/procedures.md §7.2): who may
   * (`race`, checked by 0x51822), and the ability rule of the eligibility test 0x511AE: every ability
   * whose class minimum (T.classMins) is at least `primeFrom` must be at least `oldAtLeast` for the
   * current class and `newAtLeast` for the new one. Former dual-class levels count once the new
   * class's level has passed them (FUN 0x51841). Null: the game has no dual-classing (PoR).
   */
  dualClass: { race: number; primeFrom: number; oldAtLeast: number; newAtLeast: number } | null
  /**
   * The recalculation after creation and training (PoR FUN_51cf_0000, CotAB 0x50836):
   * `attacksReset`: the fighter's attacks are set back to 2 below the extra-attack level (PoR); CotAB
   * only ever raises them to 3. `classMask`: the item class mask (char item mask) is worked out again
   * from T.classBits over the classes with a level, and former levels below the highest level, and
   * readied items it no longer allows are put away unless cursed (CotAB; PoR sets it at creation only).
   */
  recalc: { attacksReset: boolean; classMask: boolean }
  /**
   * The backstab (PoR FUN_3aae_2574, CotAB 0x2CE27; damage PoR FUN_3aae_0191, CotAB 0x2A6E2): `armour`, the
   * one body armour a thief may wear (null: any, CotAB reads the slot but never tests it); `weapons`,
   * the weapon types allowed (no weapon always is); `notLarge`, the target must not be large
   * (size flags & 0x7F ≤ 1); damage × ((thief level − `minus`) div 4 + 2), the level with its former
   * dual-class part.
   */
  backstab: { armour: number | null; weapons: number[]; notLarge: boolean; minus: number }
  /**
   * Item types (ITEMS) the shared procedures name: the launchers' ammunition (the recalculation's
   * char+0xF8 / +0xFC), holy water (the computer's weapon score against undead), flasks of oil and the
   * ammunition in the name's plural rule, the weapons an elf gets +1 to hit with, and the sprite a
   * missile flies as (`flight`: the arrow by direction, the thrown weapon and the flask cycles of COMSPR
   * 3 and 4, the sling stone of 8; anything else 7)
   */
  /**
   * A shop's price factor (CotAB 0x1F0F6 listing, 0x1F531 Buy): the script variable `variable` (canonical
   * address) names a shift of the item's value, `shifts` factor → bits (negative: right); a factor not
   * listed prices at the value (IMP-078); null: the value itself (PoR, whose engine never reads 0x6E6D)
   */
  shopPrice: { variable: number; shifts: Record<number, number> } | null
  itemTypes: {
    arrows: number; quarrels: number; holyWater: number; oil: number; elfBonus: number[]
    /** the name word (item +0x2F) of a Bag of Holding, whose readying lightens the load by 5 000; null: none does */
    bagOfHolding: number | null
    flight: { arrow: number[]; thrown: number[]; flask: number[]; stone: number[] }
  }
  /** thief skills (PoR FUN_51cf_0329, CotAB 0x50F5A): the level (with former dual-class levels in
   *  CotAB), a bonus on every skill (CotAB: an uninitialised variable that holds 7 from the saves
   *  routine, confirmed by the shipped characters), whether the race clamp counts it, and the first
   *  readied item with a thief effect: gloves (raise PP/OL to a level, else +bonus) or gauntlets
   *  (at least a level, else +bonus on every skill) */
  thief: {
    dualClass: boolean
    bonus: number
    clampWithBonus: boolean
    gloves: { effect: number; raise: Record<number, number>; bonus: number } | null
    gauntlets: { effect: number; minLevel: number; bonus: number } | null
  }
  /** who may join the party (CotAB Add, 0x36848+0x3815): player characters and members at most, and
   *  CotAB's paladin and ranger rules (null: none) */
  join: { pcs: number; members: number; maxRangers: number | null; evil: number[]; paladins: boolean }
  /** innate effects a new character gets, permanent, power 0xFF, in this order: by race, then by class id
   *  (PoR spec/A-games/engine/chargen-and-progression.md; CotAB 0x371F6, 0x37647) */
  startEffects: { race: Record<number, number[]>; cls: Record<number, number[]> }
  /**
   * The camp's Fix (CotAB 0x320D8, spec/A-games/coab/camp.md), one procedure (rules/camp.ts `fix`): the
   * healing the party's cures can give. `cures`: each counted spell (its memorised copies in Okay members,
   * then, after the rest, one per cleric slot of its `level`), the dice it rolls, the rest minutes per slot
   * (`minutes`), the rest's base when any slot of it is counted (`base`, the larger wins), and the weight it
   * adds to the estimate the rest is shortened by (per `group`, the largest present); `start`: that
   * estimate's first value (CotAB: 14, an uninitialised variable, I). Pool of Radiance has no Fix: its
   * profile gives CotAB's procedure its own cure (IMP-048).
   */
  fix: { cures: { spell: number; level: number; dice: number; sides: number; bonus: number; minutes: number; base: number; group: number; weight: number }[]; start: number }
  /** CotAB's paladin abilities from the View menu (0x3D530 + 0x35F0 …): Lay on Hands heals 2 × level once a
   *  day (effect 0x8C), Cure Disease has uses that a weekly effect 0x8D refills to (level − 1) div 5 + 1 */
  paladin: { layOnHands: { perLevel: number; effect: number; minutes: number }; cureDisease: { effect: number; minutes: number; levelsPerUse: number; initial: number } } | null
  /** CotAB: a CON bonus added to one saving throw (0 death/poison) for some races or a readied item
   *  effect, and for everyone at CON 19+; bands are [highest CON, bonus] (0x50C6B) */
  saveCon: { save: number; races: number[]; itemEffect: number; from: number; bands: [number, number][]; all: [number, number][] } | null
  /** races offered at creation, in menu order (code, not a table: PoR FUN_417f_056c, CotAB 3708f) */
  raceMenu: number[]
  /** base classes of each class id 0–16 (single classes, then the multi-classes) */
  components: number[][]
  /** multi-classes: the class column of the starting-age table they use */
  ageColumns: Record<number, number>
  /** multi-classes with a cleric part, whose WIS is at least 13 */
  clericMultis: number[]
  /** training fee in gp (a code immediate) */
  trainingCost: number
  /** spells a new magic-user knows */
  startSpells: number[]
  /** the reaction adjustment scripts read for CHA 3–25 (B + 0x2CF; a code branch, not a table) */
  chaReaction: number[]
  /**
   * The bolt routines, one procedure (hit a cell, then the path from the aimed square away from the
   * caster, with bounces; spec/A-games/engine/combat-rules.md "Lightning Bolt", spec/A-games/coab/effects.md §7): PoR FUN_4e53_28bc /
   * FUN_4e53_295b, CotAB 0x478F6 / 0x479B4. `lightning`: Lightning Bolt's length in squares (PoR 8 at
   * 0x4111A, CotAB 7 at 0x47C7F); `skipLast`: a stop does not hit the creature the previous stop hit;
   * `mapAreaOnly`: bounces only where ECL 0x49E6 (CotAB 0x4BE6) = 1; `noRepeatBounce`: not twice without
   * crossing a cell of movement 1; `chargeSinceLast`: each stop costs what the line added since the
   * previous stop (PoR: the line's whole cost, every stop)
   */
  bolt: { lightning: number; skipLast: boolean; mapAreaOnly: boolean; noRepeatBounce: boolean; chargeSinceLast: boolean }
  /**
   * When a battle is fought on a wilderness battlefield and what decides its terrain:
   * `overlandTile`, on the tile wilderness, the overland tile the party stands on (PoR FUN_34c7_11b4);
   * `placeFlags`, whenever the map flag (ECL, engine numbering) is 0, the terrain flags of the overland
   * place (ECL `place`) from T.placeTerrain (CotAB 0x25CC0: A 0x1CC = 0 → WILDCOM and 0x25C58)
   */
  wildBattle: { kind: 'overlandTile' } | { kind: 'placeFlags'; mapFlag: number; place: number }
  /**
   * Movement on the battlefield (spec/B-model/procedures.md §15.5): a step onto a cell costs the cell's
   * move byte (T.battleCells byte 0) × 3 half-squares diagonally, × 2 straight. `test`: what the Move
   * command's "Blocked" (more than the movement left) and the computer's step probe (as much as or more
   * than the movement left) compare: the cell's byte (PoR FUN_320c_09df, FUN_3334_0675) or the step's
   * cost (CotAB 0x22B2C, 0x238DA). `shortStep`: a step that costs more than is left takes the rest and
   * does not move (PoR FUN_3aae_0712) or moves anyway (CotAB 0x2AD78)
   */
  battleMove: { test: 'byte' | 'cost'; shortStep: 'stay' | 'move' }
  /** how a wilderness battlefield is built from its terrain flags (rules/battlefield.ts wildField) */
  wildField: WildFieldSpec
  /** how a map-area battlefield is built from the GEO map around the party (rules/battlefield.ts mapBattlefield) */
  mapField: MapFieldSpec
  /**
   * The cloud occupant check, one procedure (PoR FUN_5216_0ae7; CotAB 0x4B8F7, which takes a flag: 1 when
   * moving or from a cast, 0 at round end). `gas`: a creature on a `cell` square, not under any of
   * `immune`, saves vs 0: success "starts to cough" (0x1E for 1 round), failure "chokes and gags from
   * nausea" (0x1F for 1d4 + 1); `roundEnd`: also at round end (CotAB: not, its flag is 0 there);
   * `apply`: through the add-effect routine with its line and event 9, the cloud's owner the current
   * character meanwhile, then the record's handler at once (CotAB), else raw, the turn ended on a
   * failure (PoR). `kill` (CotAB): a creature on a `cell` square dies by its hit dice: `bands`
   * [lowest, highest, save bonus or null for no save] (saves vs `save`), "is Poisoned" (`poison` added
   * raw), then status 6 "is killed"; null: the game has no such cloud. `probe`: the computer's movement
   * probe (PoR FUN_3334_0675, CotAB 0x237FB), once a step is affordable, refuses a `cell` square unless
   * the mover holds one of `immune`, or (`turned`) was turned and must flee (combat record +0x10), or
   * saves vs `save` (null: no save); the kill cloud's only when its hit dice are below `below`
   */
  clouds: {
    gas: { cell: number; immune: number[]; probe: CloudProbe; roundEnd: boolean; apply: boolean }
    kill: { cell: number; save: number; bands: [number, number, number | null][]; poison: number; probe: CloudProbe } | null
  }
  /**
   * Casting in combat, one procedure (spec/A-games/engine/combat-rules.md "Cast", spec/A-games/coab/combat.md "Casting"): the cast
   * routine (PoR FUN_3aae_2414, CotAB 0x2CCBD), the spell going off (FUN_4e53_0c20, 0x45251) and the
   * lost spell on damage (FUN_3aae_02f9 / FUN_5216_1344, 0x2AA62 / 0x4CC3C). `lostFrom`: whose memorised
   * list loses the queued spell when damage interrupts it: 'current', the current character's (PoR's
   * FUN_10ba_148b takes no character: during an attack that is the attacker, a bug), or 'target', the
   * interrupted caster's (CotAB's 0xED:0x66 takes it). `miscast`: a caster with effect `effect` who
   * rolls 1 on 1d`sides` "miscasts": the spell does not go off and stays memorised (CotAB 0x45373);
   * null: no such check. `aiFirstSlot`: the first memorised slot the computer's spell choice reads
   * (PoR FUN_3334_0545 from 0; CotAB 0x236E4 from 1, so slot 0 is never chosen). `aiItemSpell`: the
   * computer's item choice (PoR FUN_3334_03e4, CotAB 0x2356A) judges an item's power item[0x3D] as the
   * spell id it gives, less `minus` above `above` (both 0x38, 0x17; CotAB's Use then casts the power as
   * it stands, spec/A-games/coab/spells.md). `aiPick`: the computer's pick of a hostile spell's target
   * (PoR FUN_3aae_1e16, CotAB 0x2C56C): up to `tries` times the finder, a pick refused when the target is
   * helpless and the spell's effect a helpless one, or (`areaCheck`) an area spell would reach the
   * caster's own side
   */
  casting: {
    lostFrom: 'current' | 'target'; miscast: { effect: number; sides: number } | null; aiFirstSlot: number; aiItemSpell: { above: number; minus: number }
    aiPick: { tries: number; areaCheck: boolean }
    /**
     * Who may cast a spell of each spell class, the filter of every player spell list (CotAB 0x43F8E,
     * called by the list builder 0x449E4; procedures.md §15.1): the ability `stat` must be above
     * `above`; then a level term [class, above] passes with the class's level above it, or the former
     * level when former levels count; `any` null: no class test. `armoured`: in combat, for a character
     * of `race` with body armour readied, only these terms count, a former one only together with a
     * level, current or former, in class `formerWith`. A spell class without an entry: never.
     * Null: no filter (PoR's lists, FUN_4894_299c, take every memorised or known spell).
     */
    allowed: Record<number, { stat: number; above: number; any: [number, number][] | null; armoured: { race: number; any: [number, number][]; formerWith: number } | null }> | null
    /**
     * Who may read a scroll (CotAB 0x3FADB in the item-use routine 0x3F9A8): one of `classes` as its
     * current or former class, or with a level in one; else a level in `thief.cls` above
     * `thief.above` and the request (1, 100) at most `thief.chance`; else "oops!" and nothing is
     * cast. Null: anyone who has the scroll readied (PoR).
     */
    scrollReaders: { classes: number[]; thief: { cls: number; above: number; chance: number } } | null
  }
}

export type TempleService = 'blind' | 'disease' | 'clw' | 'csw' | 'ccw' | 'heal' | 'poison' | 'raise' | 'curse' | 'stone'


// creation and training values both games share (O: same code in both, spec/A-games/engine/chargen-and-progression.md and spec/A-games/coab/tables.md §3.9)
const SHARED = {
  raceMenu: [1, 2, 3, 4, 5, 7], // Dwarf, Elf, Gnome, Half-Elf, Halfling, Human (Half-Orc never offered)
  components: [[0], [1], [2], [3], [4], [5], [6], [7], [0, 2], [0, 2, 5], [0, 4], [0, 5], [0, 6], [2, 5], [2, 6], [2, 5, 6], [5, 6]],
  ageColumns: { 8: 0, 9: 0, 11: 0, 12: 0, 13: 5, 15: 5, 16: 5, 14: 2 },
  clericMultis: [8, 9, 10, 11, 12],
  trainingCost: 1000,
  startSpells: [11, 18, 19, 21], // Detect Magic, Read Magic, Shield, Sleep (PoR 417f creation)
  // CHA 3 … 25 (index 0 = CHA 0)
  chaReaction: [0, 0, 0, 0, 5, 10, 15, 20, 25, 25, 25, 25, 25, 30, 35, 40, 50, 55, 60, 60, 60, 60, 60, 60, 60, 60],
}

export const POR_RULES: GameRules = {
  ...SHARED,
  spells: { records: 67, named: 56, book: 55, levels: 3, cleric: 0, druid: -1, magicUser: 1, item: 2, itemSpell: { mask: 0xff, above: 0x38, minus: 0x17 } },
  slots: {
    clear: false,
    sources: [
      { cls: 0, table: 'clericSlots', from: 2, first: false, add: false, columns: [{ pool: 'cleric', level: 1 }, { pool: 'cleric', level: 2 }, { pool: 'cleric', level: 3 }] },
      { cls: 5, table: 'muSlots', from: 2, first: false, add: false, columns: [{ pool: 'mu', level: 1 }, { pool: 'mu', level: 2 }, { pool: 'mu', level: 3 }] },
    ],
    wisdom: 'afterCleric',
    wisBonus: [[12, 1], [13, 1], [14, 2], [15, 2], [16, 3]], // 0x41E9F–0x41F42
    learn: [{ classes: [0], spellClass: 'cleric', all: false }],
    doubler: null,
  },
  extraAttacks: { 2: 6 },
  hitPoints: { laterDice: null, rolls: 1, firstLevelMin: [2, 3], fixed: null },
  // spec/A-games/engine/chargen-and-progression.md; races 1 dwarf, 2 elf, 3 gnome, 4 half-elf, 5 halfling; classes 0 cleric, 2 fighter
  levelLimits: [
    { race: 1, cls: 2, by: 0, limits: [7, 8, 9] }, { race: 2, cls: 2, by: 0, limits: [5, 6, 7] },
    { race: 3, cls: 2, by: 0, limits: [5, 5, 6] }, { race: 4, cls: 2, by: 0, limits: [6, 7, 8] },
    { race: 5, cls: 2, by: 0, limits: [4, 5, 6] }, { race: 4, cls: 0, by: 0, limits: [5, 5, 5] },
  ],
  startMoney: { coin: 3, fixed: null },
  casterTerms: { 0: [{ cls: 0, minus: 0 }], 1: [{ cls: 5, minus: 0 }] },
  casterGate: null,
  dualClass: null,
  recalc: { attacksReset: true, classMask: false },
  backstab: { armour: 50, weapons: [7, 8, 35, 36, 37], notLarge: false, minus: 0 }, // Leather Armor; Club, Dagger, the swords
  // FUN_10ba_0bb8 (0x18A0, 0x18BD), FUN_3334_128d (0x24644), the name 0x1239–0x126A, the elf bonus
  // 0xD1B–0xD48, the flight FUN_3aae_26b0 (0x2D190)
  shopPrice: null,
  itemTypes: {
    arrows: 0x49, quarrels: 0x1c, holyWater: 0x55, oil: 0x56, elfBonus: [36, 37, 41, 42, 43, 44],
    bagOfHolding: 0xba, // 0x18DA
    flight: { arrow: [9, 21, 28, 31, 73], thrown: [2, 7, 20], flask: [85, 86], stone: [47] },
  },
  bolt: { lightning: 8, skipLast: false, mapAreaOnly: false, noRepeatBounce: false, chargeSinceLast: false },
  wildBattle: { kind: 'overlandTile' },
  battleMove: { test: 'byte', shortStep: 'stay' }, // every cell's byte 0 is 1 or 0xFF
  // FUN_34c7_11b4: open ground, river FUN_34c7_0bde (ford FUN_34c7_0b97), trees 0d13, scatter 0e9e, finishing 0000
  wildField: {
    fill: 0x17, blank: [0x17, 0x36],
    passes: [
      { pass: 'river', course: { chance: { base: 0, steps: [[0x20, '=', 35], [0x10, '=', 75]] }, from: 34, count: 5, sides: 4, every: 7, offset: 2 },
        cells: [[0x32, 0], [0x33, 0]], fordDie: 20, pairs: true, ford: [[0, 0, 0x34], [0, 1, 0x35]], crossing: { from: 16, die: 9 }, edge: 'spill' },
      { pass: 'treesBySize', chance: { base: 1, steps: [[0x02, '=', 1], [0x04, '=', 3], [0x40, '=', 4], [0x08, '=', 7], [0x80, '=', 0]] }, swamp: 0x40, trunk: 0x23, crown: 0x1f },
      { pass: 'scatterTerrain', a: { base: 0, steps: [[0x80, '=', 15]] }, b: { base: 15, steps: [[0x02, '=', 45], [0x04, '=', 25], [0x80, '=', 10]] },
        c: { base: 0, steps: [[0x40, '=', 30]] }, d: { base: 40, steps: [[0x02, '=', 10], [0x40, '=', 5], [0x80, '=', 25]] }, shrubs: 6,
        cactus: 0x3c, tallCactus: [0x40, 0x41], shrub: [0x36, 3], rocks: [0x29, 4], marsh: 0x39, tuft: 0x2d, puddleFlag: 0x40 },
      { pass: 'finishing' },
    ],
  },
  // FUN_34c7_0810, then the finishing pass FUN_34c7_0000
  mapField: { cornerWallEnd: 0x04, finishing: true, furnish: null },
  clouds: { gas: { cell: 0x1e, immune: [0x1e, 0x1f, 0x20, 0x6f, 0x7d], probe: { immune: [0x20, 0x1e, 0x6f, 0x7d], turned: false, save: null }, roundEnd: true, apply: false }, kill: null }, // FUN_5216_0ae7
  // FUN_3aae_02f9 → FUN_10ba_148b; FUN_3334_0545; FUN_3334_03e4 (3334:04D6)
  casting: { lostFrom: 'current', miscast: null, aiFirstSlot: 0, aiItemSpell: { above: 0x38, minus: 0x17 }, aiPick: { tries: 20, areaCheck: true }, allowed: null, scrollReaders: null }, // aiPick 0x2C9BC, 0x2CA1B
  thief: { dualClass: false, bonus: 0, clampWithBonus: false, gloves: null, gauntlets: null },
  saveCon: null,
  startEffects: { race: { 1: [0x5a, 0x61, 0x1a, 0x2f], 2: [0x6b], 3: [0x61, 0x12, 0x2f, 0x30], 4: [0x7c], 5: [0x5a, 0x61] }, cls: {} },
  paladin: null,
  // no Fix in PoR: CotAB's procedure (0x320D8) with PoR's one cure, Cure Light Wounds (IMP-048)
  fix: { cures: [{ spell: 3, level: 1, dice: 1, sides: 8, bonus: 0, minutes: 15, base: 240, group: 0, weight: 27 }], start: 14 },
  join: { pcs: 6, members: 8, maxRangers: null, evil: [], paladins: false },
  temple: [{ kind: 'blind', gp: 1000 }, { kind: 'disease', gp: 1000 }, { kind: 'clw', gp: 100 }, { kind: 'csw', gp: 350 },
    { kind: 'ccw', gp: 600 }, { kind: 'poison', gp: 1000 }, { kind: 'raise', gp: 5500 }, { kind: 'curse', gp: 3500, spell: 43 }, { kind: 'stone', gp: 2000 }],
}

export const COAB_RULES: GameRules = {
  ...SHARED,
  // 100 spells, five levels; class byte 0 cleric, 1 druid, 2 magic-user, 3 item/monster (§3.7)
  spells: { records: 100, named: 100, book: 100, levels: 5, cleric: 0, druid: 1, magicUser: 2, item: 3, itemSpell: { mask: 0x7f, above: 0xff, minus: 0 } },
  startSpells: [11, 18, 12, 21], // Detect Magic, Read Magic, Enlarge, Sleep (creation 0x389B7, dual-classing 0x515F9)
  slots: {
    clear: true,
    sources: [
      { cls: 0, table: 'clericSlots', from: 2, first: true, add: true, columns: [{ pool: 'cleric', level: 1 }, { pool: 'cleric', level: 2 }, { pool: 'cleric', level: 3 }, { pool: 'cleric', level: 4 }, { pool: 'cleric', level: 5 }] },
      { cls: 3, table: 'paladinSlots', from: 9, first: false, add: true, columns: [{ pool: 'cleric', level: 1 }, { pool: 'cleric', level: 2 }, { pool: 'cleric', level: 3 }, { pool: 'cleric', level: 4 }, { pool: 'cleric', level: 5 }] },
      { cls: 4, table: 'rangerSlots', from: 8, first: false, add: true, columns: [{ pool: 'druid', level: 1 }, { pool: 'druid', level: 2 }, { pool: 'druid', level: 3 }, { pool: 'mu', level: 1 }, { pool: 'mu', level: 2 }] },
      { cls: 5, table: 'muSlots', from: 2, first: true, add: true, columns: [{ pool: 'mu', level: 1 }, { pool: 'mu', level: 2 }, { pool: 'mu', level: 3 }, { pool: 'mu', level: 4 }, { pool: 'mu', level: 5 }] },
    ],
    wisdom: 'afterCleric', // 0x50568: inside the cleric branch, before the paladin's rows
    wisBonus: [[12, 1], [13, 1], [14, 2], [15, 2], [16, 3], [17, 4]], // 0x50AF6: WIS 18 also a fourth-level slot (0x50C4B)
    learn: [{ classes: [0, 3], spellClass: 'cleric', all: false }, { classes: [4], spellClass: 'druid', all: true }],
    doubler: { effect: 0x81, levels: 3 }, // Ring of Wizardry (0x507C3)
  },
  extraAttacks: { 2: 6, 3: 6, 4: 7 }, // fighter > 6, paladin > 6, ranger > 7 (§3.3)
  // §3.4: fixed from the stop level: fighter and paladin 3, cleric, ranger and thief 2, magic-user 1 (druid, monk: 2, I)
  hitPoints: { laterDice: 1, rolls: 2, firstLevelMin: null, fixed: [2, null, 3, 3, 2, 1, 2, null] }, // 0x3B2ED: druid and monk get nothing set, the sum kept
  // §3.2: PoR's, plus elf and half-elf magic-users by INT and half-elf rangers as fighters (classes 4 ranger, 5 MU)
  levelLimits: [
    { race: 1, cls: 2, by: 0, limits: [7, 8, 9] }, { race: 2, cls: 2, by: 0, limits: [5, 6, 7] },
    { race: 3, cls: 2, by: 0, limits: [5, 5, 6] }, { race: 4, cls: 2, by: 0, limits: [6, 7, 8] },
    { race: 5, cls: 2, by: 0, limits: [4, 5, 6] }, { race: 4, cls: 0, by: 0, limits: [5, 5, 5] },
    { race: 2, cls: 5, by: 1, limits: [9, 10, 11] }, { race: 4, cls: 4, by: 0, limits: [6, 7, 8] },
    { race: 4, cls: 5, by: 1, limits: [6, 7, 8] },
  ],
  startMoney: { coin: 4, fixed: 300 },
  // DS:00E6: Heal added after Cure Critical Wounds (§3.11)
  // cleric: cleric, or paladin − 8; druid: ranger − 7; magic-user: magic-user, or ranger − 8
  casterTerms: { 0: [{ cls: 0, minus: 0 }, { cls: 3, minus: 8 }], 1: [{ cls: 4, minus: 7 }], 2: [{ cls: 5, minus: 0 }, { cls: 4, minus: 8 }] },
  // no cleric or magic-user level, paladin below 9 and ranger below 8
  casterGate: { atLeast: { 0: 1, 5: 1, 3: 9, 4: 8 }, level: 6 },
  // 0x511AE: abilities with a class minimum of 9 or more, 15 for the old class and 17 for the new
  dualClass: { race: 7, primeFrom: 9, oldAtLeast: 15, newAtLeast: 17 },
  recalc: { attacksReset: false, classMask: true }, // 0x50836
  backstab: { armour: null, weapons: [0x61, 7, 8, 35, 36, 37], notLarge: true, minus: 1 }, // 0x2CE27, 0x2A74C
  // 0x4DDB8, 0x2466C, the name 0x4D70D–0x4D748, the elf bonus 0x4D1EE (not the Drow Long Sword 97), the
  // flight 0x2D141: the Dart of Hornets Nest (100) flies as an arrow, the Staff Sling (101) and Spine (98) as a stone
  shopPrice: { variable: 0x6e6d, shifts: { 1: -4, 2: -3, 4: -2, 8: -1, 32: 1, 64: 2, 128: 3 } }, // B + 0x6DA (ECL 0x7F6D)
  itemTypes: {
    arrows: 0x49, quarrels: 0x1c, holyWater: 0x55, oil: 0x56, elfBonus: [36, 37, 41, 42, 43, 44],
    // the bag's flag is cleared (0x4DC9E) and never set, so the − 5 000 at 0x4DFEE never runs
    bagOfHolding: null,
    flight: { arrow: [9, 21, 100, 28, 31, 73], thrown: [2, 7, 20], flask: [85, 86], stone: [101, 47, 98] },
  },
  bolt: { lightning: 7, skipLast: true, mapAreaOnly: true, noRepeatBounce: true, chargeSinceLast: true }, // 0x478F6, 0x479B4
  // 0x25D56: the grid builder takes the map generator only when A 0x1CC (ECL 0x4BE6, the engine's 0x49E6)
  // is set; the place is A byte 0x342 (ECL 0x4CA1, the engine's 0x4AA1)
  wildBattle: { kind: 'placeFlags', mapFlag: 0x49e6, place: 0x4aa1 },
  // cells cost 1, 2 (table, tall grass, rocks, ponds) or 4 (water): the step routine 0x2AC98
  battleMove: { test: 'cost', shortStep: 'move' },
  // 0x25C58: open ground, river 0x25690, trees and logs 0x2579B, scatter 0x25ADA (0x25932); no finishing
  // pass, which in CotAB's RandCom would put tables and chairs outdoors (spec/A-games/coab/combat.md)
  wildField: {
    fill: 0x17, blank: [0x17, 0x36],
    passes: [
      { pass: 'river', course: { chance: { base: 0, steps: [[0x20, '=', 35], [0x10, '=', 75]] }, from: 34, count: 5, sides: 4, every: 7, offset: 2 },
        cells: [[0x3b, 2], [0x3d, 2]], fordDie: 20, pairs: false, ford: [[0, 1, 0x40], [1, 1, 0x41]], crossing: null, edge: 'clip' },
      { pass: 'treesOrLogs', skip: 0x80, chance: { base: 10, steps: [[0x02, '+', -5], [0x04, '+', -2], [0x40, '+', 5], [0x08, '+', 10]], under: [0, 1] },
        log: [0x29, 2], crown: [0x1f, 5], trunk: [0x24, 5] },
      { pass: 'scatterOdds', score: { base: 50, steps: [[0x10, '+', 10], [0x20, '+', 30], [0x40, '+', 20], [0x04, '+', -10], [0x02, '+', -20], [0x80, '+', -50]] },
        die: 100,
        odds: [{ from: -30, to: 9, odds: [0, 0, 0, 30, 15] }, { from: 10, to: 29, odds: [0, 1, 5, 20, 10] }, { from: 30, to: 69, odds: [0, 2, 5, 10, 5] },
          { from: 70, to: 89, odds: [10, 2, 10, 10, 1] }, { from: 90, to: 110, odds: [15, 5, 15, 10, 1] }],
        cells: [[0x39, 2], [0x2f, 2], [0x2b, 4], [0x36, 3], [0x31, 4]] },
    ],
  },
  // 0x2555D: PoR's squares (one corner cell differs), no finishing pass; rooms furnished by 0x24D63 with
  // tables (RandCom 0) on d10 ≤ 5 and chairs (RandCom 1) beside them on d10 ≤ 9 (spec/A-games/coab/combat.md)
  mapField: { cornerWallEnd: 0x08, finishing: false, furnish: { flag: 0x40, blank: [0x17, 0x36], table: [0x1a, 10, 5], chair: [0x1b, 10, 9] } },
  // 0x4B8F7: no 0x1E immunity; HD 0–4 die, 5 save at −4, 6 save, 7 and up (and below 0) unaffected
  clouds: { gas: { cell: 0x1e, immune: [0x1f, 0x20, 0x6f, 0x7d], probe: { immune: [0x20, 0x1e, 0x6f, 0x7d, 0x81, 0x3f], turned: true, save: 0 }, roundEnd: false, apply: true }, kill: { cell: 0x1c, save: 0, bands: [[0, 4, null], [5, 5, -4], [6, 6, 0]], poison: 0x37, probe: { immune: [0x81, 0x6f, 0x85, 0x7d], turned: true, save: null, below: 7 } } }, // probe 0x238EE, 0x239BD
  // 0x2AAB4 / 0x4CC8A forget(target, spell); 0x45373 effect 0x4A, 1d2; 0x236E4 slots 1–0x53
  casting: { lostFrom: 'target', miscast: { effect: 0x4a, sides: 2 }, aiFirstSlot: 1, aiItemSpell: { above: 0x38, minus: 0x17 }, // 0x23651
    aiPick: { tries: 1, areaCheck: false }, // 0x2C642: one try, no check of the caster's side
    // 0x43F8E: cleric spells WIS > 8 and a cleric or a paladin above 8; druid spells WIS > 8 and a ranger
    // above 6; magic-user spells INT > 8, and an armoured human in combat a ranger above 8 (or a former one, with a magic-user level)
    allowed: { 0: { stat: 2, above: 8, any: [[0, 0], [3, 8]], armoured: null }, 1: { stat: 2, above: 8, any: [[4, 6]], armoured: null },
      2: { stat: 1, above: 8, any: null, armoured: { race: 7, any: [[4, 8]], formerWith: 5 } } },
    scrollReaders: { classes: [5, 0], thief: { cls: 6, above: 9, chance: 75 } } }, // 0x3FADB
  // 0x50F5A: Gloves of Thievery (effect 0x0B), Gauntlets of Dexterity (effect 0x02)
  thief: { dualClass: true, bonus: 7, clampWithBonus: true, gloves: { effect: 0x0b, raise: { 1: 5, 2: 7 }, bonus: 5 }, gauntlets: { effect: 0x02, minLevel: 4, bonus: 10 } },
  // a paladin joins no party with an evil member, nor an evil character a party with a paladin; three rangers at most
  join: { pcs: 6, members: 8, maxRangers: 3, evil: [2, 5, 8], paladins: true },
  startEffects: { race: { 1: [0x61, 0x1a, 0x2f], 2: [0x6b], 3: [0x61, 0x12, 0x2f, 0x30], 4: [0x7c], 5: [0x61] }, cls: { 3: [8], 4: [0x86], 10: [0x86] } },
  paladin: { layOnHands: { perLevel: 2, effect: 0x8c, minutes: 1440 }, cureDisease: { effect: 0x8d, minutes: 10080, levelsPerUse: 5, initial: 1 } },
  // 0x31CC2 / 0x31D7D: Cure Light 1d8, Serious 2d8+1, Critical 3d8+3; 0x31E8D: minutes 15/60/75 per cleric
  // slot of levels 1/4/5, base 4 h (level 1) or 6 h (4 or 5), weights 0x1B, 0x22, 0x4E
  fix: { cures: [{ spell: 3, level: 1, dice: 1, sides: 8, bonus: 0, minutes: 15, base: 240, group: 0, weight: 27 },
    { spell: 58, level: 4, dice: 2, sides: 8, bonus: 1, minutes: 60, base: 360, group: 1, weight: 34 },
    { spell: 71, level: 5, dice: 3, sides: 8, bonus: 3, minutes: 75, base: 360, group: 1, weight: 78 }], start: 14 },
  // 0x50C6B: dwarves, halflings or the Girdle of the Dwarves (effect 6): CON 4–6 +1 … 18 +5; everyone CON 19+ +1 … +4.
  // Added to the stored save number, which makes the save harder (the shipped TRAVIS: 12 + 4 = 16; I: a bug)
  saveCon: { save: 0, races: [1, 5], itemEffect: 6, from: 4, bands: [[6, 1], [10, 2], [13, 3], [17, 4], [18, 5]], all: [[20, 1], [22, 2], [24, 3], [25, 4]] },
  temple: [{ kind: 'blind', gp: 1000 }, { kind: 'disease', gp: 1000 }, { kind: 'clw', gp: 100 }, { kind: 'csw', gp: 350 },
    { kind: 'ccw', gp: 600 }, { kind: 'heal', gp: 5000 }, { kind: 'poison', gp: 1000 }, { kind: 'raise', gp: 5500 },
    { kind: 'curse', gp: 3500, spell: 43 }, { kind: 'stone', gp: 2000 }],
}

/** The active game's rules; start-up (setGame) switches them. */
export const R: GameRules = { ...POR_RULES, spells: { ...POR_RULES.spells } }

export function useRules(r: GameRules) {
  Object.assign(R, { ...r, spells: R.spells })
  Object.assign(R.spells, r.spells)
}

/** The character-record slot array for a spell class (−1 when the class has none). */
export function slotBase(cls: number): number {
  const s = R.spells
  return cls === s.cleric ? F.clericSlots : cls === s.magicUser ? F.muSlots : cls === s.druid && s.druid >= 0 ? F.druidSlots : -1
}

/** Slots of a spell class and level (0 outside the game's levels or classes). */
export function slots(c: Uint8Array, cls: number, level: number): number {
  const b = slotBase(cls)
  return b < 0 || level < 1 || level > R.spells.levels ? 0 : c[b + level - 1]
}

/** Spell classes a player can have slots in, with their names. */
export function casterClasses(): { cls: number; name: string; short: string }[] {
  const s = R.spells
  return [
    { cls: s.cleric, name: 'Cleric', short: 'CL' },
    { cls: s.druid, name: 'Druid', short: 'DR' },
    { cls: s.magicUser, name: 'Magic-User', short: 'MU' },
  ].filter((x) => x.cls >= 0)
}

/** A spell a player can hold in a spell book: in range, not item-only, of a level players cast. */
export function bookSpell(s: { id: number; cls: number; level: number }): boolean {
  return s.id <= R.spells.book && s.cls !== R.spells.item && s.level >= 1 && s.level <= R.spells.levels
}

/**
 * Whether a character's former dual-class levels count (CotAB FUN 0x51841): a human whose first
 * class with a level has passed the level they had when they changed class (+0xE6).
 */
export function formerLevelsCount(c: Uint8Array): boolean {
  if (!R.dualClass || F.prevLevels < 0 || F.hpLevel < 0 || c[F.race] !== R.dualClass.race) return false
  let cur = c[F.levels + 7]
  for (let k = 0; k < 7; k++) if (c[F.levels + k] !== 0) { cur = c[F.levels + k]; break }
  return ((cur << 24) >> 24) > ((c[F.hpLevel] << 24) >> 24)
}

/** A class's level for casting, with its former dual-class level when that counts. */
export function classLevel(c: Uint8Array, k: number): number {
  const s8 = (v: number) => (v << 24) >> 24
  return s8(c[F.levels + k]) + (formerLevelsCount(c) && F.prevLevels >= 0 ? s8(c[F.prevLevels + k]) : 0)
}
