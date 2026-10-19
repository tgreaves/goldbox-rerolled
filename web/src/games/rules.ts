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
  /** how spell slots are worked out: absolute per-level tables (PoR FUN_51cf_0000) or summed
   *  increments with paladin and ranger rows (CotAB FUN 0x50480, spec/coab/tables.md §3.5) */
  slotModel: 'absolute' | 'increments'
  /** base class → the level above which it gets 3 attacks per 2 rounds */
  extraAttacks: Record<number, number>
  /** how a level's hit points are rolled: PoR (every level's dice, 2/3 minimum at level 1) or CotAB
   *  (FUN 0x3b230: full dice at level 1, one die after, best of two rolls, fixed from DS:3EBB) */
  hpModel: 'por' | 'coab'
  /** CotAB: the fixed hit points per level from the stop level, by base class */
  fixedHp: number[]
  /** demi-human level limits: race, base class, the ability that sets the band, and the limit with
   *  that ability below 17, at 17 and at 18 or more (18/xx counts as 18) */
  levelLimits: { race: number; cls: number; by: 0 | 1; limits: [number, number, number] }[]
  /** starting money: PoR's gold dice × 10 shared over the classes, or CotAB's 300 platinum (the
   *  dice are still rolled, and the sum dropped) */
  startMoney: 'gold' | 'platinum300'
}

export const POR_RULES: GameRules = {
  spells: { records: 67, named: 56, book: 55, levels: 3, cleric: 0, druid: -1, magicUser: 1, item: 2 },
  slotModel: 'absolute',
  extraAttacks: { 2: 6 },
  hpModel: 'por',
  fixedHp: [],
  // spec/progression.md; races 1 dwarf, 2 elf, 3 gnome, 4 half-elf, 5 halfling; classes 0 cleric, 2 fighter
  levelLimits: [
    { race: 1, cls: 2, by: 0, limits: [7, 8, 9] }, { race: 2, cls: 2, by: 0, limits: [5, 6, 7] },
    { race: 3, cls: 2, by: 0, limits: [5, 5, 6] }, { race: 4, cls: 2, by: 0, limits: [6, 7, 8] },
    { race: 5, cls: 2, by: 0, limits: [4, 5, 6] }, { race: 4, cls: 0, by: 0, limits: [5, 5, 5] },
  ],
  startMoney: 'gold',
}

export const COAB_RULES: GameRules = {
  // 100 spells, five levels; class byte 0 cleric, 1 druid, 2 magic-user, 3 item/monster (§3.7)
  spells: { records: 100, named: 100, book: 100, levels: 5, cleric: 0, druid: 1, magicUser: 2, item: 3 },
  slotModel: 'increments',
  extraAttacks: { 2: 6, 3: 6, 4: 7 }, // fighter > 6, paladin > 6, ranger > 7 (§3.3)
  hpModel: 'coab',
  // §3.4: fighter and paladin 3, cleric, ranger and thief 2, magic-user 1 (druid and monk are not playable: 2, I)
  fixedHp: [2, 2, 3, 3, 2, 1, 2, 2],
  // §3.2: PoR's, plus elf and half-elf magic-users by INT and half-elf rangers as fighters (classes 4 ranger, 5 MU)
  levelLimits: [
    { race: 1, cls: 2, by: 0, limits: [7, 8, 9] }, { race: 2, cls: 2, by: 0, limits: [5, 6, 7] },
    { race: 3, cls: 2, by: 0, limits: [5, 5, 6] }, { race: 4, cls: 2, by: 0, limits: [6, 7, 8] },
    { race: 5, cls: 2, by: 0, limits: [4, 5, 6] }, { race: 4, cls: 0, by: 0, limits: [5, 5, 5] },
    { race: 2, cls: 5, by: 1, limits: [9, 10, 11] }, { race: 4, cls: 4, by: 0, limits: [6, 7, 8] },
    { race: 4, cls: 5, by: 1, limits: [6, 7, 8] },
  ],
  startMoney: 'platinum300',
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

/** The base class whose level casts a spell class: cleric, ranger for druid spells (I), magic-user. */
export function castingClass(cls: number): number {
  const s = R.spells
  return cls === s.cleric ? 0 : cls === s.magicUser ? 5 : cls === s.druid ? 4 : -1
}
