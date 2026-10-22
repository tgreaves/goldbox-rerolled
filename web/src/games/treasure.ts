// Random treasure items per game (docs/multi-game.md): the TREASURE type choice and the item
// builder's constants. One procedure (PoR FUN_4c2d_1010 and the TREASURE handler 29c3:19B0,
// spec/A-games/engine/records.md "Random items"; CotAB 0x42D97 and 0x1A5A3, spec/A-games/coab/records.md §8;
// SotSB 0x4F6D2 and 0x1F8B5, spec/A-games/sotsb/records.md §3.1), described here as data
// (spec/B-model/procedures.md §14).

/** A roll: a value, the previous item's type, the band's own roll, or a die whose result picks a band
 *  (the first whose upper bound it does not exceed) */
export type Pick = number | 'prev' | 'roll' | { die: number; plus?: number; bands: [number, Pick][] }

/** A name word of a built item: a word number, the item's type, the plus's word (`plusName` + the rolled
 *  plus), the scroll's spell-count word (`countName` + the count), or a word by the rolled plus */
export type Word = number | 'type' | 'plus' | 'count' | { byPlus: number[] }

/** How a weapon or armour type is built: words for +0x2F, +0x30, +0x31; the mask (+0x35, else 6); the
 *  plus replaced by times × plus + add; the save bonus (+0x33, else 0) */
export interface Shape { names: [Word, Word, Word]; mask?: number; plus?: { times: number; add: number }; save?: number }

/** A scroll type: its name words, the spell lists by spell level ([sides, offset]: the id is 1dsides +
 *  offset, or with `scrollTable` the byte of T.scrollSpells at offset + 1dsides; the level die has as
 *  many sides as there are levels) and the mask each spell sets (null: the mask stays 6) */
export interface ScrollKind { type: number; names: [Word, Word, Word]; spells: [number, number][]; mask: number | null }

export interface TreasureRules {
  /** the type of one item */
  type: Pick
  /** a band's own roll that is replaced (45 → 0x3B, a long sword +n) */
  rollOverride: Record<number, number>
  /** the types that take a plus (weapons and armour): inclusive ranges */
  plusTypes: [number, number][]
  /** the plus of weapons and armour */
  plus: { die: number; bands: [number, number][] }
  /** the word before "+1": the plus's name word is plusName + plus */
  plusName: number
  /** how a type is built (the first entry listing it), else `shape` */
  shapes: [number[], Shape][]
  shape: Shape
  /** weight per unit by type (the first entry listing it), the count of listed types that have one, and
   *  [weight, count] of the rest */
  weights: [number, number[]][]
  counts: Record<number, number>
  unlisted: [number, number]
  /** value per plus by type, else `value` */
  values: Record<number, number>
  value: number
  /** a javelin that is sometimes a magic record (PoR's points one record short of Javelin of Lightning) */
  javelin: { type: number; die: number; on: number; record: number }
  /** scrolls: the kinds, the word before "1 spell" (countName + count), the value per spell level, and
   *  whether the ids come from T.scrollSpells */
  scrolls: ScrollKind[]
  countName: number
  scrollValue: number
  scrollTable: boolean
  /** magic items: type → record (word index into T.randomItems; 0 = a blank item) */
  magic: Record<number, Pick>
  /** the save bonus (+0x33) of a magic record; records whose plus and save bonus are 2 (PoR's Cloak of
   *  Displacement) */
  magicSave: number
  plusTwo: number[]
}

const d10 = { die: 10, bands: [[4, 0x24], [7, 0x23], [8, 0x22], [9, 0x25], [10, 0x26]] } as const

// The builder's constants as PoR's FUN_4c2d_1010 and CotAB's 0x42D97 have them (the same in both)
const POR_BUILD = {
  plusTypes: [[1, 0x3b], [0x49, 0x49], [0x4d, 0x4d], [0x5d, 0x5d]] as [number, number][],
  plusName: 0xa1,
  shapes: [
    [[0x32, 0x33], { names: ['plus', 0x31, 'type'], mask: 4 }],
    [[0x34], { names: ['plus', 0x32, 'type'], mask: 4 }],
    [[0x35, 0x36, 0x37, 0x38, 0x39, 0x3a], { names: ['plus', 0x30, 'type'], mask: 4 }],
    [[0x49], { names: [0, 'plus', 0x3d] }],
    [[0x4d], { names: [{ byPlus: [0, 0xdd, 0xde, 0xdc] }, 0xa7, 0x4f], plus: { times: 2, add: 2 } }],
    [[0x5d], { names: ['plus', 0xe0, 0x42] }],
  ] as [number[], Shape][],
  shape: { names: [0, 'plus', 'type'] } as Shape,
  weights: [
    [1, [0x5d]], [10, [8, 0x4d]], [15, [6]], [20, [21]], [25, [9]], [30, [7]], [35, [37]], [40, [22, 30]],
    [50, [2, 20, 29, 31, 32, 33, 39, 42, 44, 46, 59]], [60, [10, 26, 36]], [75, [1, 13, 14, 35]],
    [80, [11, 16, 25, 27, 41, 47]], [100, [4, 15, 23, 34, 43, 45, 51]], [125, [3, 24, 40]], [150, [5, 12, 17, 19, 50]],
    [175, [18]], [200, [52]], [250, [38, 53]], [300, [55]], [350, [57]], [400, [54, 56]], [450, [58]],
  ] as [number, number[]][],
  counts: { 9: 5 },
  unlisted: [40, 10] as [number, number],
  values: { 0x3b: 2500, 0x1c: 150, 0x49: 150, 0x35: 3000, 0x36: 3000, 0x37: 3500, 0x38: 3500, 0x39: 4000, 0x3a: 5000, 0x4d: 3000 },
  value: 2000,
  countName: 0xd1,
  scrollValue: 300,
  scrollTable: false,
  magicSave: 1,
}

export const POR_TREASURE: TreasureRules = {
  ...POR_BUILD,
  type: { die: 100, bands: [
    [60, { die: 100, bands: [[47, 'roll'], [49, 'prev'], [59, 'roll'], [90, d10 as unknown as Pick], [94, 0x49], [97, 0x5d], [100, 0x4d]] }],
    [85, 0x3d], [92, 0x3e],
    [98, { die: 16, bands: [[7, 0x47], [9, 0x46], [10, 0x54], [12, 0x4e], [14, 0x4f], [15, 0x5c], [16, 0x43]] }],
    [100, 0x45],
  ] },
  rollOverride: { 45: 0x3b },
  plus: { die: 20, bands: [[14, 1], [19, 2], [20, 3]] },
  javelin: { type: 0x15, die: 5, on: 5, record: 0x90 }, // the original's bug: one word before Javelin of Lightning
  scrolls: [
    { type: 0x3d, names: [0, 'count', 0xd1], spells: [[13, 8], [7, 28], [11, 44]], mask: null },
    { type: 0x3e, names: [0, 'count', 0xd0], spells: [[8, 0], [7, 21], [9, 35]], mask: null },
  ],
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
  ...POR_BUILD,
  type: { die: 100, bands: [
    [60, { die: 100, bands: [[47, 'roll'], [49, 0x3b], [59, 'roll'], [90, d10 as unknown as Pick], [94, 0x49], [97, 0x5d], [100, 0x4d]] }],
    [85, 0x3d], [92, 0x3e],
    [98, { die: 15, bands: [[9, 0x47], [10, 0x54], [15, 0x4f]] }],
    [100, 0x3b],
  ] },
  rollOverride: { 45: 0x3b },
  plus: { die: 20, bands: [[14, 1], [20, 2]] },
  javelin: { type: 0x15, die: 5, on: 5, record: 0x31 },
  scrolls: [
    { type: 0x3d, names: [0, 'count', 0xd1], spells: [[13, 8], [7, 28], [11, 44], [9, 80], [4, 90]], mask: null },
    { type: 0x3e, names: [0, 'count', 0xd0], spells: [[8, 0], [7, 21], [8, 36], [5, 65], [6, 70]], mask: null },
  ],
  magic: { 0x3f: 0x29, 0x43: 0x29, 0x4e: 0x21, 0x4f: 0x21, 0x54: 0x09, 0x5c: 0x09, 0x47: { die: 8, bands: [[5, 0x11], [8, 0x01]] } },
  plusTwo: [],
}

// SotSB: the type choice of the TREASURE handler (0x1FB2F … 0x1FE2B), the builder 0x4F6D2 and its plus
// 0x4F690 (spec/A-games/sotsb/records.md §3.1): its own item types, name words, weights and values
export const SOTSB_TREASURE: TreasureRules = {
  type: { die: 100, bands: [
    [31, { die: 100, bands: [
      [20, { die: 10, bands: [[2, 6], [6, 8], [8, 0x46], [9, 0x0f], [10, 0x1d]] }],
      [44, { die: 3, bands: [[1, 5], [2, 0x0c], [3, 0x1e]] }],
      [60, { die: 20, bands: [[3, 7], [6, 0x18], [9, 0x16], [12, 0x19], [14, 0x17], [17, 0x1c], [20, 0x0f]] }],
      [100, { die: 4, bands: [
        [3, { die: 20, bands: [[8, 0x12], [13, 0x11], [14, 0x0d], [15, 0x10], [18, 0x13], [20, 0x14]] }],
        [4, { die: 8, bands: [[1, 1], [3, 4], [5, 9], [6, 0x0a], [7, 0x0e], [8, 0x47]] }],
      ] }],
    ] }],
    [62, 0x27], [70, 0x28], [80, 0x25], [85, 0x3b],
    [95, { die: 20, bands: [[3, 0x1f], [11, 0x23], [16, 0x24], [17, 0x20], [18, 0x21], [20, 0x22]] }],
    [100, { die: 6, bands: [[2, 0x32], [4, 0x2f], [5, 0x34], [6, 0x35]] }],
  ] },
  rollOverride: {},
  plusTypes: [[1, 0x25], [0x32, 0x32], [0x3b, 0x3b], [0x46, 0x47]],
  plus: { die: 10, bands: [[6, 1], [9, 2], [10, 3]] },
  plusName: 0x6e,
  shapes: [
    [[0x1d], { names: ['plus', 0x1c, 'type'], mask: 4 }],
    [[0x1f], { names: ['plus', 0x30, 'type'], mask: 4 }],
    [[0x20, 0x21, 0x22, 0x23, 0x24], { names: ['plus', 0x2f, 'type'], mask: 4 }],
    [[0x32], { names: [0x6b, 0x5a, 'type'], plus: { times: 0, add: 4 } }],
    [[0x3b], { names: [0x6f, 0x31, 0x2e], plus: { times: 0, add: 1 }, save: 1 }], // 0x2F: 0x6E + its plus, 1
  ],
  shape: { names: [0, 'plus', 'type'] },
  weights: [
    [75, [1, 0x11]], [50, [6, 0x0e, 0x0f, 0x17, 0x19, 0x25, 0x1d]], [125, [9]], [100, [8, 0x10, 0x18]], [150, [0x46, 0x1f]],
    [175, [0x47]], [10, [4, 0x32]], [5, [5]], [60, [0x0a, 0x12]], [80, [0x16]], [20, [7]], [40, [0x0d]], [35, [0x13]],
    [250, [0x14, 0x20]], [400, [0x21]], [300, [0x22]], [350, [0x23]], [450, [0x24]], [1, [0x1c, 0x3b]],
  ],
  counts: { 5: 20 },
  unlisted: [4, 20],
  values: { 0x0c: 50, 0x05: 50, 0x1e: 50, 0x25: 1250, 0x20: 1500, 0x21: 1500, 0x22: 1750, 0x23: 2000, 0x24: 2500, 0x32: 1500 },
  value: 1000,
  javelin: { type: 7, die: 5, on: 5, record: 0x31 },
  scrolls: [
    { type: 0x27, names: ['count', 0x27, 0x28], spells: [[10, 0x50], [7, 0x5b], [11, 0x66], [10, 0x71], [4, 0x7c], [5, 0x87], [3, 0x92]], mask: 4 },
    { type: 0x28, names: ['count', 0x27, 0x26], spells: [[8, 0x00], [7, 0x0a], [8, 0x14], [6, 0x1e], [6, 0x28], [2, 0x32]], mask: 0 },
  ],
  countName: 0x63,
  scrollValue: 150,
  scrollTable: true,
  magic: { 0x34: 0x21, 0x35: 0x09, 0x2f: { die: 8, bands: [[2, 0x01], [4, 0x11], [6, 0x19], [8, 0x29]] } },
  magicSave: 0,
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
