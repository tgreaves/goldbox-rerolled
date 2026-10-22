// Money (spec/A-games/engine/town.md, "Money" and "Appraise"): seven u16 words per character (copper, silver,
// electrum, gold, platinum, gems, jewelry) and the pool, the treasure money table.
import { COIN_VALUES } from '../data/character'
import { Item, ITEM_SIZE, type ItemTables } from '../data/items'
import { capacity, recalc } from './equip'
import { F } from '../games/fields'
import { R } from '../games/rules'
import { msg } from '../games/strings'

export const COINS = ['copper', 'silver', 'electrum', 'gold', 'platinum', 'gems', 'jewelry']
const UNITS = COIN_VALUES // T.coinValues, read from START.EXE: gold is 200

const get = (c: Uint8Array, i: number) => c[F.money + 2 * i] | (c[F.money + 2 * i + 1] << 8)
const set = (c: Uint8Array, i: number, v: number) => { c[F.money + 2 * i] = v & 0xff; c[F.money + 2 * i + 1] = (v >> 8) & 0xff }
export const moneyOf = (c: Uint8Array) => [0, 1, 2, 3, 4, 5, 6].map((i) => get(c, i))
const encumbrance = (c: Uint8Array) => c[F.load] | (c[F.load + 1] << 8)

/** Coin value in gp, rounded to nearest (gems and jewelry excluded). */
/**
 * What a shop asks for an item (R.shopPrice; CotAB 0x1F0F6, 0x1F531): its value shifted by the price
 * factor the scripts set, as a 16-bit word; the value itself without a factor or for one not listed (IMP-078)
 */
export function shopPrice(read: (a: number) => number, value: number): number {
  const sp = R.shopPrice
  const k = sp ? sp.shifts[read(sp.variable)] : undefined
  if (k === undefined) return value
  return (k < 0 ? value >> -k : value << k) & 0xffff
}

/** The shop's listing (PoR 0x1F768, CotAB 0x1F0E2) gives a stock item of value 0 the value 1, kept in the stock. */
export function priceStock(stock: Item[]): Item[] {
  for (const it of stock) if (it.value === 0) { it.raw[0x3a] = 1; it.raw[0x3b] = 0 }
  return stock
}

export function coinValue(m: number[]): number {
  return Math.floor((m[0] * UNITS[0] + m[1] * UNITS[1] + m[2] * UNITS[2] + m[3] * UNITS[3] + m[4] * UNITS[4] + UNITS[3] / 2) / UNITS[3])
}

/**
 * Pay `price` gp from the character's coins, else from the pool, never both
 * (FUN_4c2d_0130 / 0185): the coins left become platinum and gold. The original reads the value as
 * a u16 and loses anything above 65 535 gp; here it is kept (IMP-028). Returns false for "Not enough money.".
 */
export function pay(c: Uint8Array, pool: number[], price: number, t: ItemTables, items: Item[]): boolean {
  const g = coinValue(moneyOf(c))
  if (price <= g) {
    const left = g - price
    for (let i = 0; i < 5; i++) set(c, i, 0)
    set(c, 4, Math.min(0xffff, Math.floor(left / 5)))
    set(c, 3, left % 5)
    recalc(c, items, t)
    return true
  }
  if (price <= coinValue(pool)) {
    const left = coinValue(pool) - price
    for (let i = 0; i < 5; i++) pool[i] = 0
    pool[4] = Math.floor(left / 5)
    pool[3] = left % 5
    return true
  }
  return false
}

/** Members that pool money: player characters (char[0x84] = 0) and NPCs that handle money (0xB3). */
const pools = (c: Uint8Array) => c[F.morale] === 0 || c[F.morale] === 0xb3

/** Pool (FUN_4c2d_0508): everyone who may pools all seven kinds. */
export function poolAll(party: { c: Uint8Array; items: Item[] }[], pool: number[], t: ItemTables) {
  for (const m of party) {
    if (!pools(m.c)) continue
    for (let i = 0; i < 7; i++) { pool[i] += get(m.c, i); set(m.c, i, 0) }
    recalc(m.c, m.items, t)
  }
}

/**
 * Share (FUN_4c2d_063a): equal shares to player characters, jewelry first, as far as they can carry;
 * the remainder to anyone with room, in list order. Shares counted for money-handling NPCs (0xB3)
 * are never paid out and vanish (original behaviour). What nobody can carry stays in the pool.
 */
export function share(party: { c: Uint8Array; items: Item[] }[], pool: number[], t: ItemTables) {
  const n = party.filter((m) => pools(m.c)).length
  if (!n) return
  const room = (c: Uint8Array) => Math.max(0, capacity(c) - encumbrance(c))
  const add = (m: { c: Uint8Array; items: Item[] }, i: number, v: number) => {
    set(m.c, i, Math.min(0xffff, get(m.c, i) + v))
    recalc(m.c, m.items, t)
  }
  const shares = pool.map((v) => Math.floor(v / n))
  const rem = pool.map((v) => v % n)
  for (const m of party) {
    if (m.c[F.morale] >= 0x80) continue
    for (let i = 6; i >= 0; i--) {
      if (shares[i] <= room(m.c)) {
        add(m, i, shares[i])
        if (rem[i] > 0 && room(m.c) >= 1) { add(m, i, 1); rem[i]-- }
      } else {
        const fit = room(m.c)
        add(m, i, fit)
        rem[i] += shares[i] - fit
      }
    }
  }
  for (let i = 6; i >= 0; i--) {
    for (const m of party) {
      if (rem[i] <= 0) break
      const fit = Math.min(rem[i], room(m.c))
      if (fit > 0) { add(m, i, fit); rem[i] -= fit }
    }
    pool[i] = rem[i]
  }
}

/** Take `amount` of kind `i` from the pool (FUN_4c2d_0ceb); "Overloaded" if it does not fit. */
export function take(c: Uint8Array, items: Item[], pool: number[], i: number, amount: number, t: ItemTables): string {
  amount = Math.min(amount, pool[i])
  if (amount <= 0) return ''
  if (encumbrance(c) + amount > capacity(c)) return msg('moneyOverloaded')
  pool[i] -= amount
  set(c, i, get(c, i) + amount)
  recalc(c, items, t)
  return ''
}

/** Add platinum and gold for a sale or appraisal; platinum that does not fit goes to the pool. */
export function receive(c: Uint8Array, items: Item[], pool: number[], gp: number, t: ItemTables, keepGold = true, overloaded: 'sellOverloaded' | 'appraiseOverloaded' = 'sellOverloaded'): string {
  const pp = Math.floor(gp / 5)
  const fit = Math.max(0, Math.min(pp, capacity(c) - encumbrance(c)))
  set(c, 4, get(c, 4) + fit)
  if (keepGold) set(c, 3, get(c, 3) + (gp % 5))
  recalc(c, items, t)
  if (fit < pp) { pool[4] += pp - fit; return msg(overloaded) }
  return ''
}

/** Appraise rolls (FUN_4c2d_19b2). `d100` is 1..100; `rnd(n)` is 0..n−1. */
export function appraiseGem(d100: number): number {
  return d100 <= 25 ? 10 : d100 <= 50 ? 50 : d100 <= 70 ? 100 : d100 <= 90 ? 500 : d100 <= 99 ? 1000 : 5000
}
export function appraiseJewel(d100: number, rnd: (n: number) => number): number {
  return d100 <= 10 ? 100 + rnd(900) : d100 <= 20 ? 200 + rnd(1000) : d100 <= 40 ? 300 + rnd(1500)
    : d100 <= 50 ? 500 + rnd(2500) : d100 <= 70 ? 1000 + rnd(5000) : d100 <= 90 ? 2000 + rnd(6000) : 2000 + rnd(10000)
}

/** Take one gem (5) or jewel (6) out of the character's money for appraising. */
export function takeOne(c: Uint8Array, kind: 5 | 6): boolean {
  if (get(c, kind) === 0) return false
  set(c, kind, get(c, kind) - 1)
  return true
}

/** Keep an appraised gem or jewel as an item (type 70, word "Gem" 0x65 / "Jewelry" 0xD6). */
export function keepAsItem(items: Item[], kind: 5 | 6, value: number): Item {
  const r = new Uint8Array(ITEM_SIZE)
  r[0x2e] = 70
  r[0x31] = kind === 5 ? 0x65 : 0xd6
  r[0x37] = 1
  r[0x3a] = value & 0xff
  r[0x3b] = (value >> 8) & 0xff
  const it = new Item(r)
  items.push(it) // the original loses it when the character had no items at all (bug, not reproduced: IMP-028)
  return it
}

/** Sell offer (FUN_4894_1cee): half the value; any stack sells at 1/40 of its value per unit (bug). */
export function sellOffer(it: Item): number {
  let offer = Math.floor(it.value / 2)
  if (it.count > 1) offer = Math.floor(((offer * it.count) % 65536) / 20)
  return offer
}

/** The coin words of the money prompts ("How much <word>will you trade? "), the game's (FUN_4c2d_0b93, CotAB 0x4293B), by coin. */
const COIN_WORDS = ['coinCopper', 'coinSilver', 'coinElectrum', 'coinGold', 'coinPlatinum', 'coinGems', 'coinJewelry'] as const
export const coinPrompt = (i: number) => msg(COIN_WORDS[i])
/** "How much <coin>will you trade? " / "… drop? ", from the game's pieces (FUN_4894_2156, FUN_4894_24a7) */
export const moneyPrompt = (op: 'trade' | 'drop', i: number) => `${msg(op === 'trade' ? 'tradeHowMuch' : 'dropHowMuch')}${coinPrompt(i)}${msg(op === 'trade' ? 'tradeWillYou' : 'dropWillYou')}`

/**
 * Trade money (FUN_4894_2156 → FUN_4c2d_044c): `n` coins of `type` (clamped to what the giver has) to
 * `to`, unless the recipient cannot carry them ("Overloaded"). The original updates the giver's
 * encumbrance twice and leaves the recipient's stale until the next recalculation; both are recalculated here.
 */
export function tradeMoney(from: Uint8Array, fromItems: Item[], to: Uint8Array, toItems: Item[], type: number, n: number, t: ItemTables): string {
  n = Math.min(n, get(from, type))
  if (n <= 0) return ''
  if (from !== to && encumbrance(to) + n > capacity(to)) return msg('moneyOverloaded')
  set(from, type, get(from, type) - n)
  set(to, type, get(to, type) + n)
  recalc(from, fromItems, t)
  if (to !== from) recalc(to, toItems, t)
  return ''
}

/**
 * Drop money (FUN_4894_24a7 → FUN_4c2d_0a01): the coins leave the character; only in a shop, temple
 * or on the treasure screen do they go to the pool, anywhere else they are gone.
 */
export function dropMoney(c: Uint8Array, items: Item[], type: number, n: number, pool: number[] | null, t: ItemTables) {
  n = Math.min(n, get(c, type))
  if (n <= 0) return
  set(c, type, get(c, type) - n)
  if (pool) pool[type] += n
  recalc(c, items, t)
}
