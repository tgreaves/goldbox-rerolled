// Random treasure items (spec/records.md, "Random items"): the type choice of the TREASURE handler
// and FUN_4c2d_1010, which builds the 63-byte record. Tables come from the player's START.EXE.
import { T } from '../games/tables'
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

/** The type choice for one item (TREASURE handler 29c3:19B0); `prev` is the previous item's type (the 48/49 bug). */
export function chooseType(d: D, prev: number): number {
  const r1 = d(100)
  if (r1 <= 60) {
    const r2 = d(100)
    if (r2 <= 47 || (r2 >= 50 && r2 <= 59)) return r2 === 45 ? 0x3b : r2
    if (r2 === 48 || r2 === 49) return prev
    if (r2 <= 90) return [0x24, 0x24, 0x24, 0x24, 0x23, 0x23, 0x23, 0x22, 0x25, 0x26][d(10) - 1]
    if (r2 <= 94) return 0x49
    if (r2 <= 97) return 0x5d
    return 0x4d
  }
  if (r1 <= 85) return 0x3d
  if (r1 <= 92) return 0x3e
  if (r1 <= 98) {
    const k = d(16)
    return k <= 7 ? 0x47 : k <= 9 ? 0x46 : k === 10 ? 0x54 : k <= 12 ? 0x4e : k <= 14 ? 0x4f : k === 15 ? 0x5c : 0x43
  }
  return 0x45
}

/** Build the item (FUN_4c2d_1010). */
export function buildItem(t: number, d: D, image: Uint8Array): Item {
  const r = new Uint8Array(ITEM_SIZE)
  r[0x35] = 6
  r[0x2e] = t
  const set16 = (o: number, v: number) => { r[o] = v & 0xff; r[o + 1] = (v >> 8) & 0xff }
  let m = 0
  if ((t >= 1 && t <= 0x3b) || t === 0x49 || t === 0x4d || t === 0x5d) {
    const roll = d(20)
    const p = roll <= 14 ? 1 : roll <= 19 ? 2 : 3
    r[0x32] = p
    const P = 0xa1 + p
    if (t === 0x15 && d(5) === 5) m = 0x90 // javelin bug: one word before Javelin of Lightning
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
    const n = d(3)
    const mu = t === 0x3d
    r[0x31] = mu ? 0xd1 : 0xd0
    r[0x30] = 0xd1 + n
    r[0x32] = 1
    set16(0x37, 25)
    let value = 0
    for (let i = 1; i <= n; i++) {
      const L = d(3)
      const id = mu ? (L === 1 ? d(13) + 8 : L === 2 ? d(7) + 28 : d(11) + 44) : (L === 1 ? d(8) : L === 2 ? d(7) + 21 : d(9) + 35)
      r[0x3b + i] = id
      value += 300 * L
    }
    set16(0x3a, value)
  } else {
    switch (t) {
      case 0x47: { const k = d(11); m = k <= 5 ? 0x11 : k <= 8 ? 0x01 : k === 9 ? 0x19 : k === 10 ? 0x51 : 0; break }
      case 0x46: m = d(10) <= 7 ? 0x59 : 0x89; break
      case 0x54: m = 0x09; break
      case 0x4e: { const k = d(3) + 1; m = k === 2 ? 0x41 : k === 3 ? 0x71 : 0; break }
      case 0x4f: m = 0x39; break
      case 0x5c: m = 0x61; break
      case 0x43: m = 0x91; break
      case 0x45: { const k = d(10); m = k === 1 ? 0x29 : k <= 6 ? 0x79 : 0x81; break }
      case 0x3f: m = 0x49; break
    }
  }
  if (m) {
    const W = (i: number) => image[T.ds + T.randomItems.at + 2 * i] | (image[T.ds + T.randomItems.at + 2 * i + 1] << 8)
    for (let j = 0; j < 3; j++) r[0x2f + j] = W(m + j) & 0xff
    r[0x32] = m === 0x61 ? 2 : 1
    r[0x33] = m === 0x61 ? 2 : 1
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
