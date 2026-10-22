// Random treasure items (spec/A-games/engine/records.md, "Random items"; spec/B-model/procedures.md §14): the type
// choice of the TREASURE handler and the item builder (PoR FUN_4c2d_1010, CotAB 0x42D97, SotSB 0x4F6D2), with
// the game's constants from its treasure rules. Tables come from the player's START.EXE.
import { T } from '../games/tables'
import { game } from '../games/profile'
import { pick, type Word } from '../games/treasure'
import { Item } from '../data/items'

type D = (sides: number) => number // 1..sides

/** The type choice for one item (the game's treasure.type: PoR 29c3:19B0, CotAB 0x1A5A3); `prev` is the previous item's type (PoR's 48/49 bug). */
export function chooseType(d: D, prev: number): number {
  const r = game().treasure
  return pick(r.type, d, prev, 0, r.rollOverride)
}

/** Build the item (FUN_4c2d_1010), a record of the game's item size. */
export function buildItem(t: number, d: D, image: Uint8Array): Item {
  const tr = game().treasure
  const r = new Uint8Array(game().saves.itemRecord)
  r[0x35] = 6
  r[0x2e] = t
  const set16 = (o: number, v: number) => { r[o] = v & 0xff; r[o + 1] = (v >> 8) & 0xff }
  const name = (words: Word[], p: number, n: number) => words.forEach((w, j) => {
    r[0x2f + j] = typeof w === 'number' ? w : w === 'type' ? t : w === 'plus' ? tr.plusName + p : w === 'count' ? tr.countName + n : w.byPlus[p]
  })
  const scroll = tr.scrolls.find((k) => k.type === t)
  let m = 0
  if (tr.plusTypes.some(([lo, hi]) => t >= lo && t <= hi)) {
    const roll = d(tr.plus.die)
    const p = (tr.plus.bands.find(([hi]) => roll <= hi) ?? tr.plus.bands[tr.plus.bands.length - 1])[1]
    if (t === tr.javelin.type && d(tr.javelin.die) === tr.javelin.on) m = tr.javelin.record
    const shape = tr.shapes.find(([ts]) => ts.includes(t))?.[1] ?? tr.shape
    r[0x32] = shape.plus ? shape.plus.times * p + shape.plus.add : p
    r[0x33] = shape.save ?? 0
    r[0x35] = shape.mask ?? 6
    name(shape.names, p, 0)
    const w = tr.weights.find(([, ts]) => ts.includes(t))
    set16(0x37, w ? w[0] : tr.unlisted[0])
    r[0x39] = w ? (tr.counts[t] ?? 0) : tr.unlisted[1]
    set16(0x3a, (r[0x32] * (tr.values[t] ?? tr.value)) & 0xffff)
  } else if (scroll) {
    const n = d(3)
    name(scroll.names, 0, n)
    r[0x32] = 1
    set16(0x37, 25)
    let value = 0
    for (let i = 1; i <= n; i++) {
      const L = d(scroll.spells.length)
      const [sides, offset] = scroll.spells[L - 1]
      const roll = d(sides)
      r[0x3b + i] = tr.scrollTable ? image[T.ds + T.scrollSpells.at + offset + roll] : roll + offset
      if (scroll.mask !== null) r[0x35] = scroll.mask
      value += tr.scrollValue * L
    }
    set16(0x3a, value & 0xffff)
  } else {
    const how = tr.magic[t]
    if (how !== undefined) m = pick(how, d, 0)
  }
  if (m) {
    const W = (i: number) => image[T.ds + T.randomItems.at + 2 * i] | (image[T.ds + T.randomItems.at + 2 * i + 1] << 8)
    for (let j = 0; j < 3; j++) r[0x2f + j] = W(m + j) & 0xff
    const two = tr.plusTwo.includes(m)
    r[0x32] = two ? 2 : 1
    r[0x33] = two ? 2 : tr.magicSave
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
