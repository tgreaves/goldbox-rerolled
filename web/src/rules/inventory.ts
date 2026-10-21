// Items menu actions (spec/A-games/engine/town.md, "Items menu", FUN_4894_0ef8): available test, trade, halve, join.
import type { Item, ItemTables } from '../data/items'
import { canTakeItem, recalc } from './equip'

/** Available test for Trade, Drop and Sell (FUN_4894_0d70): readied items must be unreadied first. */
export function unavailable(it: Item): string {
  return it.ready ? 'Must be unreadied' : ''
}

/** A scroll holding a spell flagged for scribing (bit 7 of a spell byte): ask before losing it. */
export function scribing(it: Item, t: ItemTables): boolean {
  const slot = t.baseOf(it)?.slot ?? 0
  return slot >= 11 && slot <= 13 && it.props.some((p) => p & 0x80) // FUN_4e53_323d: ITEMS slot 11–13
}

/** Trade (FUN_4894_1734): move the item to the end of the recipient's list. */
export function trade(from: { c: Uint8Array; items: Item[] }, to: { c: Uint8Array; items: Item[] }, it: Item, t: ItemTables): string {
  const why = unavailable(it)
  if (why) return why
  if (canTakeItem(to.c, to.items, it)) return 'Overloaded'
  from.items.splice(from.items.indexOf(it), 1)
  to.items.push(it)
  recalc(from.c, from.items, t)
  recalc(to.c, to.items, t)
  return ''
}

/** Halve (FUN_4894_17ed): split off half a stack, unreadied, right after the item. */
export function halve(c: Uint8Array, items: Item[], it: Item, t: ItemTables): string {
  if (items.length >= 16) return 'You have too many items'
  const n = Math.floor(it.count / 2)
  if (n === 0) return "Can't halve that"
  const half = it.copy()
  half.count = n
  half.ready = false
  it.count -= n
  items.splice(items.indexOf(it) + 1, 0, half)
  recalc(c, items, t)
  return ''
}

/**
 * Join (FUN_4894_189d): merge into `target` every other stack with the same name words, type, plus,
 * save bonus, cursed flag and weight whose charges byte is below 2. Counts cap at 255; on overflow
 * the remainder stays and becomes the target for the rest of the scan (original behaviour).
 */
export function join(c: Uint8Array, items: Item[], target: Item, t: ItemTables): number {
  const same = (a: Item, b: Item) => [0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x36].every((o) => a.raw[o] === b.raw[o]) && a.weight === b.weight
  let merged = 0
  let into = target
  for (const it of [...items]) {
    if (it === into || it.count === 0 || it.props[0] >= 2 || !same(it, into)) continue
    const total = into.count + it.count
    if (total > 255) {
      it.count = total - 255
      into.count = 255
      into = it
      continue
    }
    into.count = total
    items.splice(items.indexOf(it), 1)
    merged++
  }
  recalc(c, items, t)
  return merged
}

/** Drop: the item is destroyed. */
export function drop(c: Uint8Array, items: Item[], it: Item, t: ItemTables): string {
  const why = unavailable(it)
  if (why) return why
  items.splice(items.indexOf(it), 1)
  recalc(c, items, t)
  return ''
}
