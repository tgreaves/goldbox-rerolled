// Items (spec/A-games/engine/records.md): 63-byte item records (CHRDAT*.ITM, ITEM<n>.DAX, MON<n>ITM.DAX), the
// 16-byte base item table in ITEMS, and the name words in START.EXE's data segment.
import { T } from '../games/tables'
import { game } from '../games/profile'
import { R } from '../games/rules'
import { unexepack } from './exepack'

export const ITEM_SIZE = 63

const u16 = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8)
const s8 = (v: number) => (v << 24) >> 24

/** Base item slots (ITEMS byte 0), as the guide lists them. */
export const SLOTS: Record<number, string> = {
  0: 'main hand', 1: 'off hand', 2: 'body armour', 3: 'gauntlets', 4: 'helm', 5: 'belt or necklace', 6: 'robe',
  7: 'cloak', 8: 'boots', 9: 'ring', 10: 'miscellaneous', 11: 'magic-user scroll', 12: 'clerical scroll',
  74: 'holy symbol', 75: 'key', 77: 'bracers', 78: 'wand', 80: 'potion', 82: 'bottle', 91: 'pass',
}

export interface BaseItem {
  slot: number
  hands: number
  /** damage vs large: dice count, sides, bonus */
  large: [number, number, number]
  /** rate of fire ×2 for missile weapons */
  rate: number
  /** AC descriptor: ≥ 178 armour/bracers bonus (v − 178), ≥ 128 other AC bonus (v − 128) */
  ac: number
  /** 0 slashing, 1 piercing, 128 bashing */
  kind: number
  /** damage vs small/medium: dice count, sides, bonus */
  small: [number, number, number]
  /** range in squares (exclusive), 0 for melee */
  range: number
  /** class bitmask: 1 MU, 2 cleric, 4 thief, 8 fighter, 16 druid, 32 monk, 64 paladin, 128 ranger */
  classes: number
  /** 1 arrows, 2 dex to-hit, 4 str to-hit and damage, 8 AI missile, 16 thrown, 128 bolts */
  flags: number
}

export class ItemTables {
  readonly base: BaseItem[] = []
  readonly words: string[] = []

  constructor(itemsFile: Uint8Array, startImage: Uint8Array) {
    for (let t = 0; 2 + t * 16 + 16 <= itemsFile.length; t++) {
      const b = itemsFile.subarray(2 + t * 16, 2 + t * 16 + 16)
      this.base.push({
        slot: b[0], hands: b[1], large: [b[2], b[3], s8(b[4])], rate: b[5], ac: b[6], kind: b[7],
        small: [b[9], b[10], s8(b[11])], range: b[12], classes: b[13], flags: b[14],
      })
    }
    for (let i = 0; i < 255; i++) {
      const o = T.ds + T.itemWords.at + i * T.itemWords.row
      this.words.push(String.fromCharCode(...startImage.subarray(o + 1, o + 1 + startImage[o])))
    }
  }

  static load(itemsFile: Uint8Array | undefined, startExe: Uint8Array | undefined): ItemTables | null {
    if (!itemsFile || !startExe) return null
    try { return new ItemTables(itemsFile, unexepack(startExe).image) } catch { return null }
  }

  /**
   * Display name (FUN_10ba_0442): visible words n3, n2, n1 (bytes 0x31, 0x30, 0x2F), with a count
   * prefix and a plural "s" on the noun for stacks. Hidden words (mask bit 3 − n) are left out until
   * identified.
   */
  /** set while someone in the party has Detect Magic (effect 5): magic items get "* " (FUN_10ba_0442) */
  detect = false

  name(it: Item, identified = false): string {
    const r = it.raw
    const word = [0, r[0x2f], r[0x30], r[0x31]] // word[n], n = 1..3
    let mask = 0
    for (let n = 1; n <= 3; n++) if (word[n] && (identified || !((r[0x35] >> (3 - n)) & 1))) mask |= 1 << (n - 1)
    const count = it.count
    // the plural rule (R.itemTypes.plural; PoR 0x1239, CotAB 0x4D70D, SotSB 0x53224)
    const { oil, firstWord, ammo, at, except } = R.itemTypes.plural
    const pluralHere = (n: number) => (1 << (n - 1)) === mask || (n === 1 && mask > 4 && it.type !== oil) ||
      (n === 1 && firstWord.includes(it.type)) || (n === 2 && !(mask & 1)) || (n === 3 && it.type === oil) ||
      ((at === null || n === at) && ammo.includes(it.type) && word[3] !== except)
    let s = count > 0 ? `${count} ` : ''
    let plural = false
    for (let n = 3; n >= 1; n--) {
      if (!(mask & (1 << (n - 1)))) continue
      s += this.words[word[n] - 1] ?? `#${word[n]}`
      if (count >= 2 && !plural && pluralHere(n)) { s += 's'; plural = true }
      s += ' '
    }
    const mark = this.detect && (s8(r[0x32]) > 0 || s8(r[0x33]) > 0 || r[0x36] !== 0) ? '* ' : ''
    return mark + s.trim()
  }

  baseOf(it: Item): BaseItem | undefined {
    return this.base[it.type]
  }
}

/**
 * One item, kept as its record (63 bytes, or 67 in SotSB's files: its +0x3F chain pointer) so it saves back
 * unchanged apart from what the game edits. `bundle`: the items joined into it, for a game whose bundle item
 * type (games/files.ts `bundleType`, SotSB 0x49 "Bundle of" scrolls) chains them at +0x3F (0x4495x).
 */
export class Item {
  readonly raw: Uint8Array
  bundle: Item[] = []
  constructor(raw: Uint8Array) { this.raw = raw }

  get type() { return this.raw[0x2e] }
  get plus() { return s8(this.raw[0x32]) }
  get saveBonus() { return s8(this.raw[0x33]) }
  get ready() { return this.raw[0x34] !== 0 }
  set ready(v: boolean) { this.raw[0x34] = v ? 1 : 0 }
  /** bit n−1 hides name component n */
  get hidden() { return this.raw[0x35] }
  set hidden(v: number) { this.raw[0x35] = v }
  get cursed() { return this.raw[0x36] !== 0 }
  get weight() { return u16(this.raw, 0x37) }
  /** 0 = a single item that does not stack */
  get count() { return this.raw[0x39] }
  set count(v: number) { this.raw[0x39] = v }
  get value() { return u16(this.raw, 0x3a) }
  get props(): [number, number, number] { return [this.raw[0x3c], this.raw[0x3d], this.raw[0x3e]] }
  /** weight counted for encumbrance: weight × count for stacks */
  get totalWeight() { return this.weight * Math.max(1, this.count) }
  /** magical for Detect Magic: a bonus or the magic/cursed flag */
  get magic() { return this.plus !== 0 || this.saveBonus !== 0 || this.cursed }

  copy(): Item { const c = new Item(this.raw.slice()); c.bundle = this.bundle.map((b) => b.copy()); return c }
}

/**
 * Items from records of `size` bytes (DAX records 63; a character's item file the game's `saves.itemRecord`),
 * each kept whole. With `bundleType` (SotSB 0x49): an item of that type is followed by its count of joined
 * items, read into its bundle (the loader 0x412B4, the vault 0x21DF7); a short record ends the list, as the
 * original's read loop does.
 */
export function parseItems(d: Uint8Array | undefined, size = ITEM_SIZE, bundleType: number | null = null): Item[] {
  const out: Item[] = []
  if (!d) return out
  let o = 0
  while (o + size <= d.length) {
    const it = new Item(d.slice(o, o + size))
    o += size
    out.push(it)
    if (bundleType === null || it.type !== bundleType) continue
    for (let k = 0; k < it.count && o + size <= d.length; k++, o += size) it.bundle.push(new Item(d.slice(o, o + size)))
  }
  return out
}

/** Items back to the file layout: each record as kept (stale pointer bytes included; a 63-byte record in a 67-byte file is padded with 0, as the item loader clears +0x3F), then its bundle (the saver 0x40486). */
export function itemsFile(items: Item[], size = ITEM_SIZE, bundleType: number | null = null): Uint8Array {
  const recs: Uint8Array[] = []
  for (const it of items) {
    recs.push(it.raw)
    if (bundleType !== null && it.type === bundleType) for (const b of it.bundle.slice(0, it.count)) recs.push(b.raw)
  }
  const d = new Uint8Array(recs.length * size)
  recs.forEach((r, i) => d.set(r.subarray(0, size), i * size))
  return d
}

/** A character's item file in the active game's record size and bundle type (games/files.ts). */
export const characterItems = (d: Uint8Array | undefined) => parseItems(d, game().saves.itemRecord, game().saves.bundleType)
export const characterItemsFile = (items: Item[]) => itemsFile(items, game().saves.itemRecord, game().saves.bundleType)
