// Random treasure items (spec/A-games/engine/records.md, "Random items"): the type choice of the TREASURE handler
// and FUN_4c2d_1010, which builds the 63-byte record. Tables come from the player's START.EXE.
import { T } from '../games/tables'
import { game } from '../games/profile'
import { pick } from '../games/treasure'
import { Item, ITEM_SIZE } from '../data/items'

type D = (sides: number) => number // 1..sides

/** Weight per unit by type (the table in the spec); 40 with count 10 for anything unlisted. */
const WEIGHTS: [number, number[]][] = [
  [1, [0x5d]], [10, [8, 0x4d]], [15, [6]], [20, [21]], [25, [9]], [30, [7]], [35, [37]], [40, [22, 30]],
  [50, [2, 20, 29, 31, 32, 33, 39, 42, 44, 46, 59]], [60, [10, 26, 36]], [75, [1, 13, 14, 35]],
  [80, [11, 16, 25, 27, 41, 47]], [100, [4, 15, 23, 34, 43, 45, 51]], [125, [3, 24, 40]], [150, [5, 12, 17, 19, 50]],
  [175, [18]], [200, [52]], [250, [38, 53]], [300, [55]], [350, [57]], [400, [54, 56]], [450, [58]],
]
const VALUE_K: Record<number, number> = { 0x3b: 2500, 0x1c: 150, 0x49: 150, 0x35: 3000, 0x36: 3000, 0x37: 3500, 0x38: 3500, 0x39: 4000, 0x3a: 5000, 0x4d: 3000 }

/** The type choice for one item (the game's treasure.type: PoR 29c3:19B0, CotAB 0x1A5A3); `prev` is the previous item's type (PoR's 48/49 bug). */
export function chooseType(d: D, prev: number): number {
  const r = game().treasure
  return pick(r.type, d, prev, 0, r.rollOverride)
}

/** Build the item (FUN_4c2d_1010). */
export function buildItem(t: number, d: D, image: Uint8Array): Item {
  const r = new Uint8Array(ITEM_SIZE)
  r[0x35] = 6
  r[0x2e] = t
  const set16 = (o: number, v: number) => { r[o] = v & 0xff; r[o + 1] = (v >> 8) & 0xff }
  let m = 0
  if ((t >= 1 && t <= 0x3b) || t === 0x49 || t === 0x4d || t === 0x5d) {
    const tr = game().treasure
    const roll = d(tr.plus.die)
    const p = (tr.plus.bands.find(([hi]) => roll <= hi) ?? tr.plus.bands[tr.plus.bands.length - 1])[1]
    r[0x32] = p
    const P = 0xa1 + p
    if (t === tr.javelin.type && d(tr.javelin.die) === tr.javelin.on) m = tr.javelin.record
    if (t === 0x32 || t === 0x33) { r[0x31] = t; r[0x30] = 0x31; r[0x2f] = P; r[0x35] = 4 }
    else if (t === 0x34) { r[0x31] = t; r[0x30] = 0x32; r[0x2f] = P; r[0x35] = 4 }
    else if (t >= 0x35 && t <= 0x3a) { r[0x31] = t; r[0x30] = 0x30; r[0x2f] = P; r[0x35] = 4 }
    else if (t === 0x49) { r[0x31] = 0x3d; r[0x30] = P }
    else if (t === 0x4d) { r[0x32] = 2 * p + 2; r[0x31] = 0x4f; r[0x30] = 0xa7; r[0x2f] = [0, 0xdd, 0xde, 0xdc][p] }
    else if (t === 0x5d) { r[0x31] = 0x42; r[0x30] = 0xe0; r[0x2f] = P }
    else { r[0x31] = t; r[0x30] = P }
    const w = WEIGHTS.find(([, ts]) => ts.includes(t))
    set16(0x37, w ? w[0] : 40)
    r[0x39] = w ? (t === 9 ? 5 : 0) : 10
    set16(0x3a, (r[0x32] * (VALUE_K[t] ?? 2000)) & 0xffff)
  } else if (t === 0x3d || t === 0x3e) {
    const tr = game().treasure
    const n = d(3)
    const mu = t === 0x3d
    r[0x31] = mu ? 0xd1 : 0xd0
    r[0x30] = 0xd1 + n
    r[0x32] = 1
    set16(0x37, 25)
    let value = 0
    for (let i = 1; i <= n; i++) {
      const L = d(tr.scrollLevelDie)
      const [sides, offset] = (mu ? tr.scrollSpells.mu : tr.scrollSpells.cleric)[L - 1]
      const id = d(sides) + offset
      r[0x3b + i] = id
      value += 300 * L
    }
    set16(0x3a, value)
  } else {
    const how = game().treasure.magic[t]
    if (how !== undefined) m = pick(how, d, 0)
  }
  if (m) {
    const W = (i: number) => image[T.ds + T.randomItems.at + 2 * i] | (image[T.ds + T.randomItems.at + 2 * i + 1] << 8)
    for (let j = 0; j < 3; j++) r[0x2f + j] = W(m + j) & 0xff
    const two = game().treasure.plusTwo.includes(m)
    r[0x32] = two ? 2 : 1
    r[0x33] = two ? 2 : 1
    r[0x37] = W(m + 3) & 0xff
    r[0x38] = W(m + 3) >> 8
    r[0x39] = 0
    set16(0x3a, W(m + 4))
    for (let j = 0; j < 3; j++) r[0x3c + j] = W(m + 5 + j) & 0xff
  }
  return new Item(r)
}

/** TREASURE with 0x80 + n: n random items, each prepended to the treasure list. */
export function randomTreasure(n: number, d: D, image: Uint8Array, list: Item[]): void {
  let prev = 0
  for (let i = 0; i < n; i++) {
    const t = chooseType(d, prev)
    prev = t
    list.unshift(buildItem(t, d, image))
  }
}
