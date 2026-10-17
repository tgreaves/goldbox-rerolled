// Readying items and the derived statistics (spec/records.md, "Inventory and readying").
// All AC and THAC0 values are stored as 60 − value in the character record.
import type { Item, ItemTables } from '../data/items'
import { itemHandler, type FxHost } from './effects'

const ARROW = 73
const QUARREL = 28
const BAG_OF_HOLDING = 0xba
const MAX_ITEMS = 16

const u16 = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8)

/** Strength index (FUN_10ba_11ea): exceptional strength spreads 18 over 18–23; 19–25 → +5. */
export function strengthIndex(str: number, pct: number): number {
  if (str < 18) return str
  if (str === 18) return pct === 0 ? 18 : pct <= 50 ? 19 : pct <= 75 ? 20 : pct <= 90 ? 21 : pct <= 99 ? 22 : 23
  return Math.min(str, 25) + 5
}

/** Weight allowance in coins (FUN_10ba_13ab). */
export function weightAllowance(si: number): number {
  const t: [number, number][] = [[3, -350], [5, -250], [7, -150], [11, 0], [13, 100], [15, 200], [16, 350], [17, 500],
    [18, 750], [19, 1000], [20, 1250], [21, 1500], [22, 2000], [23, 3000], [24, 4000], [25, 5000], [26, 6000],
    [27, 7500], [28, 9000], [29, 12000], [30, 15000]]
  for (const [max, wa] of t) if (si <= max) return wa
  return 15000
}

const strToHit = (si: number) => si <= 3 ? -3 : si <= 5 ? -2 : si <= 7 ? -1 : si <= 16 ? 0 : si <= 19 ? 1 : si <= 22 ? 2 : si <= 25 ? 3 : si <= 27 ? 4 : si - 23
const strDamage = (si: number) => si <= 2 ? -2 : si <= 5 ? -1 : si <= 15 ? 0 : si <= 17 ? 1 : si === 18 ? 2 : si <= 20 ? 3 : si <= 29 ? si - 17 : 14
const dexAC = (d: number) => d >= 1 && d <= 3 ? -4 : d === 4 ? -3 : d === 5 ? -2 : d === 6 ? -1 : d <= 14 ? 0 : d === 15 ? 1 : d === 16 ? 2 : d === 17 ? 3 : d <= 20 ? 4 : d <= 23 ? 5 : d <= 25 ? 6 : 0
/** DEX missile to-hit and initiative adjustment (FUN_10ba_1168). */
export const dexMissile = (d: number) => d <= 2 ? -4 : d === 3 ? -3 : d === 4 ? -2 : d === 5 ? -1 : d <= 15 ? 0 : d === 16 ? 1 : d === 17 ? 2 : d <= 20 ? 3 : d <= 23 ? 4 : d <= 25 ? 5 : 0

export function strIndexOf(c: Uint8Array) { return strengthIndex(c[0x10], c[0x16]) }

/** Coins and items the character carries (encumbrance), and the most allowed (capacity). */
export function capacity(c: Uint8Array): number {
  return weightAllowance(strIndexOf(c)) + 1500
}

export function moneyWeight(c: Uint8Array): number {
  let w = 0
  for (let i = 0; i < 7; i++) w += u16(c, 0x88 + 2 * i)
  return w
}

/**
 * Recalculate the derived statistics (FUN_10ba_0bb8) from the base fields, readied items and money:
 * AC front and rear, THAC0, damage, movement, encumbrance, hands in use, save bonus.
 */
export function recalc(c: Uint8Array, items: Item[], t: ItemTables) {
  let readiedWeight = 0, enc = 0, hands = 0, bag = false
  let weapon: Item | null = null, arrows: Item | null = null, quarrels: Item | null = null
  for (const it of items) {
    const w = it.weight * Math.max(1, it.count)
    enc += w
    if (!it.ready) continue
    readiedWeight += w
    const b = t.baseOf(it)
    if (!b) continue
    if (b.slot === 0) weapon = it
    if (it.type === ARROW) arrows = it
    if (it.type === QUARREL) quarrels = it
    if (it.raw[0x2f] === BAG_OF_HOLDING) bag = true
    hands += b.hands
  }
  c[0xc7] = items.length
  c[0x100] = hands
  enc += moneyWeight(c)
  // natural attacks and base values
  for (let i = 0; i < 6; i++) c[0x115 + i] = c[0xa3 + i]
  c[0x111] = c[0xa9]
  c[0x11c] = c[0x72]
  c[0x110] = c[0x2d]
  c[0x101] = 0
  let shield = 0, misc = 0, ring = 0, body = 0, magicArmour = false
  const dex = dexAC(c[0x13])
  const si = strIndexOf(c)
  const strOn = c[0xaa] !== 0
  if (!weapon) {
    if (strOn) {
      c[0x110] += strToHit(si)
      c[0x119] = (c[0x119] + strDamage(si)) & 0xff
    }
  } else {
    const b = t.baseOf(weapon)!
    let hit = c[0x2d]
    if (b.flags & 0x02) hit += dexMissile(c[0x13])
    let dmg = b.small[2]
    if (b.flags & 0x04 && strOn) { hit += strToHit(si); dmg += strDamage(si) }
    let plus = weapon.plus
    if (b.flags & 0x80 && quarrels) plus += quarrels.plus
    if (b.flags & 0x01 && arrows) plus += arrows.plus
    dmg += plus
    if (c[0x2e] === 2 && [36, 37, 41, 42, 43, 44].includes(weapon.type)) plus += 1 // elves: swords and plain bows
    hit += plus
    c[0x110] = hit & 0xff
    c[0x119] = dmg & 0xff
    c[0x115] = b.small[0]
    c[0x117] = b.small[1]
  }
  for (const it of items) {
    if (!it.ready) continue
    const b = t.baseOf(it)
    if (!b) continue
    const p = it.plus
    // armour movement (FUN_10ba_01fb)
    if (b.slot === 2) {
      let m = it.weight <= 150 ? c[0x72] : it.weight < 400 ? 9 : 6
      if (p !== 0 && m <= 9) m += 3 // a negative plus also gets the +3 (original bug)
      c[0x11c] = m
    }
    // AC (FUN_10ba_0282)
    const d = b.ac
    if (d < 0x80) continue
    if (b.slot === 1) shield = (d & 0x7f) + p
    else if (d === 0x80) {
      if (b.slot === 9) ring = Math.max(ring, p)
      else misc += p
      c[0x101] = (c[0x101] + it.saveBonus) & 0xff
    } else if ((d & 0x7f) + p > body) {
      body = (d & 0x7f) + p
      if (b.slot === 2 && p > 0) magicArmour = true
    }
  }
  if (magicArmour) ring = 0
  if (bag) enc = Math.max(readiedWeight, enc - 5000 < 0 ? 0 : enc - 5000)
  c[0x102] = enc & 0xff
  c[0x103] = (enc >> 8) & 0xff
  // encumbrance movement (FUN_10ba_03a0)
  const excess = Math.max(0, enc - weightAllowance(si))
  const limit = excess <= 512 ? 255 : excess <= 768 ? 9 : excess <= 1024 ? 6 : 3
  c[0x11c] = Math.min(c[0x11c], limit)
  body = Math.max(body, c[0xa9])
  c[0x111] = (dex + shield + misc + ring + body) & 0xff
  c[0x112] = (body + misc + ring - 2) & 0xff
  c[0x6b] = c[0x2e] !== 0 && c[0x98] > 0 ? c[0x98] : 1
}

/** Ready an unreadied item (FUN_4894_14d0); returns the message to show, or '' when it worked. */
export function ready(c: Uint8Array, items: Item[], it: Item, t: ItemTables): string {
  const b = t.baseOf(it)
  if (!b) return 'Wrong Class'
  let err = 0
  let using: Item | undefined
  if (b.hands + c[0x100] > 2) err = 3
  const readied = items.filter((x) => x.ready && x !== it)
  if (b.slot <= 8) {
    using = readied.find((x) => t.baseOf(x)?.slot === b.slot)
    if (using) err = 2
  } else if (b.slot === 9) {
    const rings = readied.filter((x) => t.baseOf(x)?.slot === 9)
    if (rings.length >= 2) { err = 2; using = rings[1] }
  }
  if (it.type === ARROW || it.type === QUARREL) {
    const other = readied.find((x) => x.type === it.type)
    if (other) { err = 2; using = other }
  }
  if ((b.classes & c[0xb0]) === 0) err = 1
  if (err === 1) return 'Wrong Class'
  if (err === 2) return `already using ${using ? t.name(using) : 'one'}`
  if (err === 3) return 'Your hands are full!'
  it.ready = true
  recalc(c, items, t)
  return ''
}

/** Unready a readied item; cursed items stay (returns the message, or ''). */
export function unready(c: Uint8Array, items: Item[], it: Item, t: ItemTables): string {
  if (it.cursed) return "It's Cursed"
  it.ready = false
  recalc(c, items, t)
  return ''
}

/** Whether the character can take on `weight` more coins (FUN_4c2d_0000). */
export function canCarry(c: Uint8Array, weight: number): boolean {
  return u16(c, 0x102) + weight <= capacity(c)
}

export function canTakeItem(c: Uint8Array, items: Item[], it: Item): string {
  if (items.length >= MAX_ITEMS) return 'You have too many items'
  if (!canCarry(c, it.weight * Math.max(1, it.count))) return 'Overloaded'
  return ''
}


/** Ready with the item's handler (FUN_4894_14d0): an item with item[0x3E] ≥ 0x80 acts once readied. */
export async function readyItem(h: FxHost, c: Uint8Array, items: Item[], it: Item, t: ItemTables): Promise<string> {
  const m = ready(c, items, it, t)
  if (m) return m
  if (it.raw[0x3e] >= 0x80) await itemHandler(h, c, it, 0)
  recalc(c, items, t)
  return ''
}

/** Unready with the item's handler (arg 1, after unreadying); cursed items stay. */
export async function unreadyItem(h: FxHost, c: Uint8Array, items: Item[], it: Item, t: ItemTables): Promise<string> {
  const m = unready(c, items, it, t)
  if (m) return m
  if (it.raw[0x3e] >= 0x80) await itemHandler(h, c, it, 1)
  recalc(c, items, t)
  return ''
}
