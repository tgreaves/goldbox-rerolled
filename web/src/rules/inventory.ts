// Items menu actions (spec/A-games/engine/town.md, "Items menu", FUN_4894_0ef8): available test, trade, halve, join.
import type { Item, ItemTables } from '../data/items'
import { canTakeItem, recalc } from './equip'
import { msg } from '../games/strings'
import { game } from '../games/profile'
import { R } from '../games/rules'

/** Available test for Trade, Drop and Sell (FUN_4894_0d70): readied items must be unreadied first. */
export function unavailable(it: Item): string {
  return it.ready ? msg('mustUnready') : ''
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
  if (canTakeItem(to.c, to.items, it)) return msg('takeOverloaded')
  from.items.splice(from.items.indexOf(it), 1)
  to.items.push(it)
  recalc(from.c, from.items, t)
  recalc(to.c, to.items, t)
  return ''
}

/**
 * Halve (FUN_4894_17ed): split off half a stack, unreadied, right after the item. A bundle (SotSB 0x44638)
 * splits its scrolls. The items menu offers it only below 16 items (PoR 0x399B2, CotAB 0x3EC2D, SotSB
 * 0x43C1A), so with 16 it does nothing.
 */
export function halve(c: Uint8Array, items: Item[], it: Item, t: ItemTables): string {
  if (items.length >= 16) return ''
  const n = Math.floor(it.count / 2)
  if (n === 0) return msg('cantHalve')
  if (it.type === game().saves.bundleType) return halveBundle(c, items, it, n, t)
  const half = it.copy()
  half.count = n
  half.ready = false
  it.count -= n
  items.splice(items.indexOf(it) + 1, 0, half)
  recalc(c, items, t)
  return ''
}

/** a record's 16-bit word (weight +0x37, value +0x3A), kept to 16 bits as the original's word arithmetic */
const setWord = (it: Item, o: number, v: number) => { it.raw[o] = v & 0xff; it.raw[o + 1] = (v >> 8) & 0xff }
/** a bundle's count, also its name word 2 and its weight (SotSB 0x44C7B, 0x446BC) */
const setBundleCount = (it: Item, n: number) => { it.count = n; it.raw[0x30] = n; setWord(it, 0x37, n) }
/** a scroll taken out of a chain or put at its end: its +0x3F pointer cleared (0x44A7A, 0x4480C) */
const unchained = (it: Item) => { const s = it.copy(); s.bundle = []; if (s.raw.length > 0x42) s.raw.fill(0, 0x3f, 0x43); return s }

/**
 * Halve a bundle (SotSB 0x44666): the first `n` scrolls go into a new bundle after it (one scroll alone
 * stays a scroll), valued at their sum; the rest stay, the bundle's value less theirs; a bundle left with
 * one scroll becomes that scroll.
 */
function halveBundle(c: Uint8Array, items: Item[], it: Item, n: number, t: ItemTables): string {
  const chain = it.bundle.slice(0, it.count)
  const rest = it.count - n
  const sum = (l: Item[]) => l.reduce((a, b) => a + b.value, 0)
  let half: Item
  if (n === 1) half = unchained(chain[0])
  else {
    half = it.copy()
    setBundleCount(half, n)
    half.bundle = chain.slice(0, n)
    setWord(half, 0x3a, sum(half.bundle))
  }
  half.ready = false
  let at = items.indexOf(it)
  if (rest === 1) items[at] = unchained(chain[1]) // count 2 (0x4474D)
  else {
    setBundleCount(it, rest)
    setWord(it, 0x3a, it.value - sum(chain.slice(0, n)))
    it.bundle = chain.slice(n)
  }
  items.splice(++at, 0, half)
  recalc(c, items, t)
  return ''
}

/**
 * Join (FUN_4894_189d): merge into `target` every other stack with the same name words, type, plus,
 * save bonus and cursed flag (and weight, R.itemJoin.weight) whose charges byte is below 2. Counts cap
 * at 255; on overflow the remainder stays and becomes the target for the rest of the scan (original
 * behaviour). A game with bundles (R.itemJoin.bundle) joins scrolls into one instead.
 */
export function join(c: Uint8Array, items: Item[], target: Item, t: ItemTables): { merged: number; message: string } {
  const J = R.itemJoin, bt = game().saves.bundleType
  if (J.bundle && bt !== null && (J.bundle.of.includes(target.type) || target.type === bt)) return joinBundle(c, items, target, t, J.bundle, bt)
  if (J.refuseSingle && target.count === 0) return { merged: 0, message: msg('joinCannot') } // SotSB 0x44CCA
  const same = (a: Item, b: Item) => [0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x36].every((o) => a.raw[o] === b.raw[o]) && (!J.weight || a.weight === b.weight)
  let merged = 0
  let into = target
  for (const it of [...items]) {
    if (it === into || (J.weight && it.count === 0) || it.props[0] >= 2 || !same(it, into)) continue
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
  return { merged, message: '' }
}

/**
 * Join scrolls into a bundle (SotSB 0x44973): refused when the target holds `limit` already, or when fewer
 * than two scrolls or bundles below the limit are carried (the target among them). A scroll target becomes
 * a bundle of one, its copy the first in the chain; then, while it holds fewer than `limit`, each scroll and
 * each bundle that fits whole is chained on, its value added (16 bits), and destroyed.
 */
function joinBundle(c: Uint8Array, items: Item[], target: Item, t: ItemTables, B: { of: number[]; limit: number; words: [number, number] }, bt: number) {
  if (target.count >= B.limit) return { merged: 0, message: `${msg('bundleLimited')}${B.limit}${msg('bundleScrolls')}` }
  const joinable = (it: Item) => (it.type === bt && it.count < B.limit) || B.of.includes(it.type)
  if (items.filter(joinable).length < 2) return { merged: 0, message: msg('joinNothing') }
  if (target.type !== bt) {
    target.bundle = [unchained(target)]
    target.raw[0x34] = 0; target.raw[0x31] = B.words[1]; target.raw[0x2f] = B.words[0]
    target.raw.fill(0, 0x3c, 0x3f)
    target.raw[0x2e] = bt; target.hidden = 0
    setBundleCount(target, 1)
  } else target.bundle = target.bundle.slice(0, target.count)
  let merged = 0
  for (const it of [...items]) {
    if (target.count >= B.limit) break
    if (it === target) continue
    if (it.type === bt && it.count < B.limit && target.count + it.count <= B.limit) target.bundle.push(...it.bundle.slice(0, it.count))
    else if (B.of.includes(it.type)) target.bundle.push(unchained(it))
    else continue
    setWord(target, 0x3a, target.value + it.value)
    setBundleCount(target, target.count + (it.type === bt ? it.count : 1))
    items.splice(items.indexOf(it), 1)
    merged++
  }
  recalc(c, items, t)
  return { merged, message: '' }
}

/** Drop: the item is destroyed. */
export function drop(c: Uint8Array, items: Item[], it: Item, t: ItemTables): string {
  const why = unavailable(it)
  if (why) return why
  items.splice(items.indexOf(it), 1)
  recalc(c, items, t)
  return ''
}
