// "Take all" after a battle (IMP-056, not in the original): a suggested split of the treasure items.
import type { Item, ItemTables } from '../data/items'
import { canTakeItem, capacity, recalc } from './equip'

export interface Member { c: Uint8Array; items: Item[] }

/**
 * Each item, in list order, to the party member who can use it and gains most by readying it
 * (`gain`), else to whoever has most room; only members who are Okay and can carry it (16 items,
 * capacity) are considered. Returns item index → party index, −1 when nobody can take it.
 */
export function proposeSplit(party: Member[], treasure: Item[], t: ItemTables,
  gain: (c: Uint8Array, items: Item[], it: Item) => number): Map<number, number> {
  const plan = new Map<number, number>()
  const sim = party.map((m) => ({ c: m.c.slice(), items: m.items.map((x) => x.copy()) }))
  const load = (c: Uint8Array) => c[0x102] | (c[0x103] << 8)
  treasure.forEach((it, i) => {
    let best = -1, bestScore = -Infinity
    sim.forEach((m, k) => {
      if (party[k].c[0x10c] !== 0 || canTakeItem(m.c, m.items, it)) return
      const usable = ((t.baseOf(it)?.classes ?? 0) & m.c[0xb0]) !== 0
      const score = (usable ? 500 + 100 * gain(m.c, m.items, it) : 0) + (capacity(m.c) - load(m.c)) / 100
      if (score > bestScore) { bestScore = score; best = k }
    })
    plan.set(i, best)
    if (best >= 0) { sim[best].items.push(it.copy()); recalc(sim[best].c, sim[best].items, t) }
  })
  return plan
}
