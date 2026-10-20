// Each game's rules where they differ (docs/multi-game.md, step 6). Values first; where a procedure
// differs the profile names which one, and both live in rules/. PoR: spec/; CotAB: spec/coab/tables.md §3.
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
}

export interface GameRules {
  spells: SpellRules
  /** how spell slots are worked out (PoR FUN_51cf_0000, CotAB FUN 0x50480, spec/coab/tables.md §3.5):
   *  optionally clear every slot first; then per source, if the class has a level: one first-level slot
   *  (`first`), and the table's rows from level `from` either set (the class's own level's row) or added
   *  (rows from..level), each column into a pool and spell level; the WIS bonus after the cleric source
   *  or always; then the spells learnt (those of a class with slots, or all of a class) */
  slots: {
    clear: boolean
    sources: { cls: number; table: 'clericSlots' | 'muSlots' | 'paladinSlots' | 'rangerSlots'; from: number; first: boolean; add: boolean; columns: { pool: 'cleric' | 'druid' | 'mu'; level: number }[] }[]
    wisdom: 'afterCleric' | 'always'
    learn: { classes: number[]; spellClass: 'cleric' | 'druid'; all: boolean }[]
    /** a readied item with this effect byte (+0x3E) doubles the magic-user slots of levels 1..levels */
    doubler: { effect: number; levels: number } | null
  }
  /** base class → the level above which it gets 3 attacks per 2 rounds */
  extraAttacks: Record<number, number>
  /** how a level's hit points are rolled, per class (PoR: the class's dice every level, at least 2/3 of
   *  a die at level 1; CotAB FUN 0x3b230: the dice at level 1 and `laterDice` after, the best of `rolls`
   *  rolls, and from the stop level (T.hitDiceStop) a fixed amount that replaces the sum so far) */
  hitPoints: { laterDice: number | null; rolls: number; firstLevelMin: [number, number] | null; fixed: number[] | null }
  /** demi-human level limits: race, base class, the ability that sets the band, and the limit with
   *  that ability below 17, at 17 and at 18 or more (18/xx counts as 18) */
  levelLimits: { race: number; cls: number; by: 0 | 1; limits: [number, number, number] }[]
  /** starting money in one coin (index into the money words): the class dice × 10 shared over the
   *  classes (PoR, gold), or a fixed amount (CotAB 300 platinum; the dice are still rolled, then dropped) */
  startMoney: { coin: number; fixed: number | null }
  /** the temple's healing services in the order of the game's name table (T.templeNames), with
   *  their prices (immediates in the game's code, not a table) */
  temple: { kind: TempleService; gp: number }[]
  /** caster level by spell class: the best of its terms (a class's level, plus its former dual-class
   *  level when that counts, minus `minus`; never below 0); item-only spells cast at 12 and anything
   *  cast from an item at 6 (PoR FUN_10ba_26c2; CotAB 0x4F8BF, spec/coab/tables.md §3.7) */
  casterTerms: Record<number, { cls: number; minus: number }[]>
  /** CotAB: characters with none of these levels high enough cast everything at 6 (0x4F8C5) */
  casterGate: { atLeast: Record<number, number>; level: number } | null
  /** former dual-class levels count once the new class's level has passed them (CotAB FUN 0x51841) */
  dualClass: boolean
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
  /** CotAB: a CON bonus added to one saving throw (0 death/poison) for some races or a readied item
   *  effect, and for everyone at CON 19+; bands are [highest CON, bonus] (0x50C6B) */
  /** who may join the party (CotAB Add, 0x36848+0x3815): player characters and members at most, and
   *  CotAB's paladin and ranger rules (null: none) */
  join: { pcs: number; members: number; maxRangers: number | null; evil: number[]; paladins: boolean }
  /** innate effects a new character gets, permanent, power 0xFF, in this order: by race, then by class id
   *  (PoR spec/chargen.md; CotAB 0x371F6, 0x37647) */
  startEffects: { race: Record<number, number[]>; cls: Record<number, number[]> }
  /** CotAB's paladin abilities from the View menu (0x3D530 + 0x35F0 …): Lay on Hands heals 2 × level once a
   *  day (effect 0x8C), Cure Disease has uses that a weekly effect 0x8D refills to (level − 1) div 5 + 1 */
  paladin: { layOnHands: { perLevel: number; effect: number; minutes: number }; cureDisease: { effect: number; minutes: number; levelsPerUse: number; initial: number } } | null
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
   * caster, with bounces; spec/combat.md "Lightning Bolt", spec/coab/effects.md §7): PoR FUN_4e53_28bc /
   * FUN_4e53_295b, CotAB 0x478F6 / 0x479B4. `lightning`: Lightning Bolt's length in squares (PoR 8 at
   * 0x4111A, CotAB 7 at 0x47C7F); `skipLast`: a stop does not hit the creature the previous stop hit;
   * `mapAreaOnly`: bounces only where ECL 0x49E6 (CotAB 0x4BE6) = 1; `noRepeatBounce`: not twice without
   * crossing a cell of movement 1; `chargeSinceLast`: each stop costs what the line added since the
   * previous stop (PoR: the line's whole cost, every stop)
   */
  bolt: { lightning: number; skipLast: boolean; mapAreaOnly: boolean; noRepeatBounce: boolean; chargeSinceLast: boolean }
}

export type TempleService = 'blind' | 'disease' | 'clw' | 'csw' | 'ccw' | 'heal' | 'poison' | 'raise' | 'curse' | 'stone'


// creation and training values both games share (O: same code in both, spec/chargen.md and spec/coab/tables.md §3.9)
const SHARED = {
  raceMenu: [1, 2, 3, 4, 5, 7], // Dwarf, Elf, Gnome, Half-Elf, Halfling, Human (Half-Orc never offered)
  components: [[0], [1], [2], [3], [4], [5], [6], [7], [0, 2], [0, 2, 5], [0, 4], [0, 5], [0, 6], [2, 5], [2, 6], [2, 5, 6], [5, 6]],
  ageColumns: { 8: 0, 9: 0, 11: 0, 12: 0, 13: 5, 15: 5, 16: 5, 14: 2 },
  clericMultis: [8, 9, 10, 11, 12],
  trainingCost: 1000,
  startSpells: [11, 18, 19, 21], // Detect Magic, Read Magic, Shield, Sleep
  // CHA 3 … 25 (index 0 = CHA 0)
  chaReaction: [0, 0, 0, 0, 5, 10, 15, 20, 25, 25, 25, 25, 25, 30, 35, 40, 50, 55, 60, 60, 60, 60, 60, 60, 60, 60],
}

export const POR_RULES: GameRules = {
  ...SHARED,
  spells: { records: 67, named: 56, book: 55, levels: 3, cleric: 0, druid: -1, magicUser: 1, item: 2 },
  slots: {
    clear: false,
    sources: [
      { cls: 0, table: 'clericSlots', from: 2, first: false, add: false, columns: [{ pool: 'cleric', level: 1 }, { pool: 'cleric', level: 2 }, { pool: 'cleric', level: 3 }] },
      { cls: 5, table: 'muSlots', from: 2, first: false, add: false, columns: [{ pool: 'mu', level: 1 }, { pool: 'mu', level: 2 }, { pool: 'mu', level: 3 }] },
    ],
    wisdom: 'afterCleric',
    learn: [{ classes: [0], spellClass: 'cleric', all: false }],
    doubler: null,
  },
  extraAttacks: { 2: 6 },
  hitPoints: { laterDice: null, rolls: 1, firstLevelMin: [2, 3], fixed: null },
  // spec/progression.md; races 1 dwarf, 2 elf, 3 gnome, 4 half-elf, 5 halfling; classes 0 cleric, 2 fighter
  levelLimits: [
    { race: 1, cls: 2, by: 0, limits: [7, 8, 9] }, { race: 2, cls: 2, by: 0, limits: [5, 6, 7] },
    { race: 3, cls: 2, by: 0, limits: [5, 5, 6] }, { race: 4, cls: 2, by: 0, limits: [6, 7, 8] },
    { race: 5, cls: 2, by: 0, limits: [4, 5, 6] }, { race: 4, cls: 0, by: 0, limits: [5, 5, 5] },
  ],
  startMoney: { coin: 3, fixed: null },
  casterTerms: { 0: [{ cls: 0, minus: 0 }], 1: [{ cls: 5, minus: 0 }] },
  casterGate: null,
  dualClass: false,
  bolt: { lightning: 8, skipLast: false, mapAreaOnly: false, noRepeatBounce: false, chargeSinceLast: false },
  thief: { dualClass: false, bonus: 0, clampWithBonus: false, gloves: null, gauntlets: null },
  saveCon: null,
  startEffects: { race: { 1: [0x5a, 0x61, 0x1a, 0x2f], 2: [0x6b], 3: [0x61, 0x12, 0x2f, 0x30], 4: [0x7c], 5: [0x5a, 0x61] }, cls: {} },
  paladin: null,
  join: { pcs: 6, members: 8, maxRangers: null, evil: [], paladins: false },
  temple: [{ kind: 'blind', gp: 1000 }, { kind: 'disease', gp: 1000 }, { kind: 'clw', gp: 100 }, { kind: 'csw', gp: 350 },
    { kind: 'ccw', gp: 600 }, { kind: 'poison', gp: 1000 }, { kind: 'raise', gp: 5500 }, { kind: 'curse', gp: 3500 }, { kind: 'stone', gp: 2000 }],
}

export const COAB_RULES: GameRules = {
  ...SHARED,
  // 100 spells, five levels; class byte 0 cleric, 1 druid, 2 magic-user, 3 item/monster (§3.7)
  spells: { records: 100, named: 100, book: 100, levels: 5, cleric: 0, druid: 1, magicUser: 2, item: 3 },
  slots: {
    clear: true,
    sources: [
      { cls: 0, table: 'clericSlots', from: 2, first: true, add: true, columns: [{ pool: 'cleric', level: 1 }, { pool: 'cleric', level: 2 }, { pool: 'cleric', level: 3 }, { pool: 'cleric', level: 4 }, { pool: 'cleric', level: 5 }] },
      { cls: 3, table: 'paladinSlots', from: 9, first: false, add: true, columns: [{ pool: 'cleric', level: 1 }, { pool: 'cleric', level: 2 }, { pool: 'cleric', level: 3 }, { pool: 'cleric', level: 4 }, { pool: 'cleric', level: 5 }] },
      { cls: 4, table: 'rangerSlots', from: 8, first: false, add: true, columns: [{ pool: 'druid', level: 1 }, { pool: 'druid', level: 2 }, { pool: 'druid', level: 3 }, { pool: 'mu', level: 1 }, { pool: 'mu', level: 2 }] },
      { cls: 5, table: 'muSlots', from: 2, first: true, add: true, columns: [{ pool: 'mu', level: 1 }, { pool: 'mu', level: 2 }, { pool: 'mu', level: 3 }, { pool: 'mu', level: 4 }, { pool: 'mu', level: 5 }] },
    ],
    wisdom: 'always',
    learn: [{ classes: [0, 3], spellClass: 'cleric', all: false }, { classes: [4], spellClass: 'druid', all: true }],
    doubler: { effect: 0x81, levels: 3 }, // Ring of Wizardry (0x507C3)
  },
  extraAttacks: { 2: 6, 3: 6, 4: 7 }, // fighter > 6, paladin > 6, ranger > 7 (§3.3)
  // §3.4: fixed from the stop level: fighter and paladin 3, cleric, ranger and thief 2, magic-user 1 (druid, monk: 2, I)
  hitPoints: { laterDice: 1, rolls: 2, firstLevelMin: null, fixed: [2, 2, 3, 3, 2, 1, 2, 2] },
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
  dualClass: true,
  bolt: { lightning: 7, skipLast: true, mapAreaOnly: true, noRepeatBounce: true, chargeSinceLast: true }, // 0x478F6, 0x479B4
  // 0x50F5A: Gloves of Thievery (effect 0x0B), Gauntlets of Dexterity (effect 0x02)
  thief: { dualClass: true, bonus: 7, clampWithBonus: true, gloves: { effect: 0x0b, raise: { 1: 5, 2: 7 }, bonus: 5 }, gauntlets: { effect: 0x02, minLevel: 4, bonus: 10 } },
  // 0x50C6B: dwarves, halflings or the Girdle of the Dwarves (effect 6): CON 4–6 +1 … 18 +5; everyone CON 19+ +1 … +4.
  // Added to the stored save number, which makes the save harder (the shipped TRAVIS: 12 + 4 = 16; I: a bug)
  // a paladin joins no party with an evil member, nor an evil character a party with a paladin; three rangers at most
  join: { pcs: 6, members: 8, maxRangers: 3, evil: [2, 5, 8], paladins: true },
  startEffects: { race: { 1: [0x61, 0x1a, 0x2f], 2: [0x6b], 3: [0x61, 0x12, 0x2f, 0x30], 4: [0x7c], 5: [0x61] }, cls: { 3: [8], 4: [0x86], 10: [0x86] } },
  paladin: { layOnHands: { perLevel: 2, effect: 0x8c, minutes: 1440 }, cureDisease: { effect: 0x8d, minutes: 10080, levelsPerUse: 5, initial: 1 } },
  saveCon: { save: 0, races: [1, 5], itemEffect: 6, from: 4, bands: [[6, 1], [10, 2], [13, 3], [17, 4], [18, 5]], all: [[20, 1], [22, 2], [24, 3], [25, 4]] },
  temple: [{ kind: 'blind', gp: 1000 }, { kind: 'disease', gp: 1000 }, { kind: 'clw', gp: 100 }, { kind: 'csw', gp: 350 },
    { kind: 'ccw', gp: 600 }, { kind: 'heal', gp: 5000 }, { kind: 'poison', gp: 1000 }, { kind: 'raise', gp: 5500 },
    { kind: 'curse', gp: 3500 }, { kind: 'stone', gp: 2000 }],
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
  if (!R.dualClass || F.prevLevels < 0 || F.hpLevel < 0 || c[F.race] !== 7) return false
  let cur = c[F.levels + 7]
  for (let k = 0; k < 7; k++) if (c[F.levels + k] !== 0) { cur = c[F.levels + k]; break }
  return ((cur << 24) >> 24) > ((c[F.hpLevel] << 24) >> 24)
}

/** A class's level for casting, with its former dual-class level when that counts. */
export function classLevel(c: Uint8Array, k: number): number {
  const s8 = (v: number) => (v << 24) >> 24
  return s8(c[F.levels + k]) + (formerLevelsCount(c) && F.prevLevels >= 0 ? s8(c[F.prevLevels + k]) : 0)
}
