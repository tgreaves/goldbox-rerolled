// SotSB's item files (spec/A-games/sotsb/records.md §3): 67-byte records kept whole, and a "Bundle of"
// item (type 0x49) followed by its count of joined scrolls, chained at +0x3F (the saver 0x40486, the loader
// 0x412B4). PoR and CotAB keep 63-byte records and no bundles.
import { afterAll, describe, expect, it } from 'vitest'
import { Item, characterItems, characterItemsFile, parseItems } from '../src/data/items'
import { COAB, POR, setGame } from '../src/games/profile'
import { SOTSB } from '../src/games/sotsb'

const rec = (type: number, count: number, fill: number) => {
  const r = new Uint8Array(67).fill(fill)
  r[0x2e] = type; r[0x39] = count
  return r
}

describe('item files with bundles', () => {
  afterAll(() => setGame(POR))
  it('SotSB: a bundle and its scrolls round-trip byte for byte, stale pointers included', () => {
    setGame(SOTSB)
    const file = new Uint8Array([...rec(0x10, 0, 1), ...rec(0x49, 2, 2), ...rec(0x27, 0, 3), ...rec(0x28, 0, 4), ...rec(0x1e, 12, 5)])
    const items = characterItems(file)
    expect(items.map((x) => x.type)).toEqual([0x10, 0x49, 0x1e])
    expect(items[1].bundle.map((x) => x.type)).toEqual([0x27, 0x28])
    expect([...characterItemsFile(items)]).toEqual([...file])
    expect([...characterItemsFile(items.map((x) => x.copy()))]).toEqual([...file])
  })
  it('SotSB: a 63-byte item (from a DAX record) is written padded to 67 with 0', () => {
    setGame(SOTSB)
    const it = new Item(new Uint8Array(63).fill(9))
    const out = characterItemsFile([it])
    expect(out.length).toBe(67)
    expect([...out.subarray(63)]).toEqual([0, 0, 0, 0])
  })
  it('a bundle whose scrolls are cut short ends the list, as the loader\'s read does', () => {
    const file = new Uint8Array([...rec(0x49, 3, 2), ...rec(0x27, 0, 3)])
    const items = parseItems(file, 67, 0x49)
    expect(items.length).toBe(1)
    expect(items[0].bundle.length).toBe(1)
  })
  it('PoR and CotAB: 63-byte records, type 0x49 is no bundle', () => {
    for (const g of [POR, COAB]) {
      setGame(g)
      const r = new Uint8Array(126); r[0x2e] = 0x49; r[0x39] = 1; r[63 + 0x2e] = 7
      expect(characterItems(r).length).toBe(2)
      expect([...characterItemsFile(characterItems(r))]).toEqual([...r])
    }
  })
})
