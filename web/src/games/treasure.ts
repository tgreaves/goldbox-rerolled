// Random treasure items per game (docs/multi-game.md): the TREASURE type choice and the item
// builder's tables. The procedure is the same in both games (PoR FUN_4c2d_1010 and the TREASURE
// handler 29c3:19B0, spec/records.md "Random items"; CotAB 0x42D97 and 0x1A5A3, spec/coab/records.md §7).

/** A roll: a value, the previous item's type, the band's own roll, or a die whose result picks a band
 *  (the first whose upper bound it does not exceed) */
export type Pick = number | 'prev' | 'roll' | { die: number; plus?: number; bands: [number, Pick][] }

export interface TreasureRules {
  /** the type of one item */
  type: Pick
  /** a band's own roll that is replaced (45 → 0x3B, a long sword +n) */
  rollOverride: Record<number, number>
  /** the plus of weapons and armour */
  plus: { die: number; bands: [number, number][] }
  /** a javelin that is sometimes a magic record (PoR's points one record short of Javelin of Lightning) */
  javelin: { type: number; die: number; on: number; record: number }
  /** scrolls: the spell-level die, and per level [sides, offset] of the spell id for each kind */
  scrollLevelDie: number
  scrollSpells: { mu: [number, number][]; cleric: [number, number][] }
  /** magic items: type → record (word index into T.randomItems; 0 = a blank item) */
  magic: Record<number, Pick>
  /** records whose plus and saving-throw bonus are 2 (PoR's Cloak of Displacement) */
  plusTwo: number[]
}

const d10 = { die: 10, bands: [[4, 0x24], [7, 0x23], [8, 0x22], [9, 0x25], [10, 0x26]] } as const

export const POR_TREASURE: TreasureRules = {
  type: { die: 100, bands: [
    [60, { die: 100, bands: [[47, 'roll'], [49, 'prev'], [59, 'roll'], [90, d10 as unknown as Pick], [94, 0x49], [97, 0x5d], [100, 0x4d]] }],
    [85, 0x3d], [92, 0x3e],
    [98, { die: 16, bands: [[7, 0x47], [9, 0x46], [10, 0x54], [12, 0x4e], [14, 0x4f], [15, 0x5c], [16, 0x43]] }],
    [100, 0x45],
  ] },
  rollOverride: { 45: 0x3b },
  plus: { die: 20, bands: [[14, 1], [19, 2], [20, 3]] },
  javelin: { type: 0x15, die: 5, on: 5, record: 0x90 }, // the original's bug: one word before Javelin of Lightning
  scrollLevelDie: 3,
  scrollSpells: { mu: [[13, 8], [7, 28], [11, 44]], cleric: [[8, 0], [7, 21], [9, 35]] },
  magic: {
    0x47: { die: 11, bands: [[5, 0x11], [8, 0x01], [9, 0x19], [10, 0x51], [11, 0]] },
    0x46: { die: 10, bands: [[7, 0x59], [10, 0x89]] },
    0x54: 0x09,
    0x4e: { die: 3, plus: 1, bands: [[1, 0], [2, 0x41], [3, 0x71], [4, 0]] },
    0x4f: 0x39, 0x5c: 0x61, 0x43: 0x91,
    0x45: { die: 10, bands: [[1, 0x29], [6, 0x79], [10, 0x81]] },
    0x3f: 0x49,
  },
  plusTwo: [0x61],
}

export const COAB_TREASURE: TreasureRules = {
  type: { die: 100, bands: [
    [60, { die: 100, bands: [[47, 'roll'], [49, 0x3b], [59, 'roll'], [90, d10 as unknown as Pick], [94, 0x49], [97, 0x5d], [100, 0x4d]] }],
    [85, 0x3d], [92, 0x3e],
    [98, { die: 15, bands: [[9, 0x47], [10, 0x54], [15, 0x4f]] }],
    [100, 0x3b],
  ] },
  rollOverride: { 45: 0x3b },
  plus: { die: 20, bands: [[14, 1], [20, 2]] },
  javelin: { type: 0x15, die: 5, on: 5, record: 0x31 },
  scrollLevelDie: 5,
  scrollSpells: { mu: [[13, 8], [7, 28], [11, 44], [9, 80], [4, 90]], cleric: [[8, 0], [7, 21], [8, 36], [5, 65], [6, 70]] },
  magic: { 0x3f: 0x29, 0x43: 0x29, 0x4e: 0x21, 0x4f: 0x21, 0x54: 0x09, 0x5c: 0x09, 0x47: { die: 8, bands: [[5, 0x11], [8, 0x01]] } },
  plusTwo: [],
}

/** Resolve a pick with dice d (1..sides). */
export function pick(p: Pick, d: (sides: number) => number, prev: number, own = 0, override: Record<number, number> = {}): number {
  if (typeof p === 'number') return p
  if (p === 'prev') return prev
  if (p === 'roll') return override[own] ?? own
  const v = d(p.die) + (p.plus ?? 0)
  const band = p.bands.find(([hi]) => v <= hi) ?? p.bands[p.bands.length - 1]
  return pick(band[1], d, prev, v, override)
}
