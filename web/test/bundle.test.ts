// SotSB's scroll bundles (spec/A-games/sotsb/records.md §3.2): the items menu's Join (0x44940) and
// Halve (0x44638) on scrolls and "Bundle of n Scrolls"; the regular Join's SotSB differences. Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'
import { R } from '../src/games/rules'
import { Item, characterItems, characterItemsFile } from '../src/data/items'
import { Engine, type Io } from '../src/vm/engine'
import { halve, join } from '../src/rules/inventory'
import { loadFiles } from './playtest'

const dir = process.env.SOTSB ?? ''

/** a 67-byte record of `type`, its words 0x2F–0x31, value and count */
function item(type: number, value: number, count = 0, words = [0x28, 0, 0]) {
  const r = new Uint8Array(67)
  r[0x2e] = type; r[0x2f] = words[0]; r[0x30] = words[1]; r[0x31] = words[2]
  r[0x3a] = value & 0xff; r[0x3b] = value >> 8; r[0x39] = count; r[0x37] = 25
  return new Item(r)
}

describe.skipIf(!dir || !existsSync(dir))('SotSB: scroll bundles', () => {
  afterAll(() => setGame(POR))
  const setup = () => {
    setGame(SOTSB)
    const files = loadFiles(SOTSB, dir)
    const e = new Engine(files, { print: () => {}, menu: async () => 0 } as unknown as Io, 1)
    return { c: files.get('CHRDATA1.SAV')!.slice(), t: e.items! }
  }

  it('Join makes the scrolls one bundle: name, count, weight and value (0x44A44, 0x44C46)', () => {
    const { c, t } = setup()
    const sword = item(0x01, 10)
    const items = [item(0x27, 300), sword, item(0x28, 500), item(0x27, 200)]
    const j = join(c, items, items[0], t)
    expect(j).toEqual({ merged: 2, message: '' })
    expect(items.length).toBe(2)
    const b = items[0]
    expect([b.type, b.count, b.raw[0x2f], b.raw[0x30], b.raw[0x31], b.weight, b.value]).toEqual([0x49, 3, 0x27, 3, 0x4d, 3, 1000])
    expect(b.bundle.map((s) => s.value)).toEqual([300, 500, 200])
    expect(t.name(b, true)).toMatch(/^Bundle of 3 Scrolls?$/)
    expect(items[1]).toBe(sword)
  })

  it('bundles of up to 10; a full one, or no other scroll, is refused with its line', () => {
    const { c, t } = setup()
    const scrolls = (n: number) => Array.from({ length: n }, (_, i) => item(0x27, i + 1))
    const items = scrolls(12)
    join(c, items, items[0], t)
    expect([items.length, items[0].count, items[0].bundle.length]).toEqual([3, 10, 10])
    expect(join(c, items, items[0], t).message).toBe('Bundles are limited to 10 scrolls.')
    const alone = [item(0x27, 1), item(0x01, 1)]
    expect(join(c, alone, alone[0], t).message).toBe('There are no similar items to join with.')
    // a bundle joins whole, or not at all, when it would pass 10
    const a = scrolls(6), b = scrolls(6)
    join(c, a, a[0], t); join(c, b, b[0], t)
    const both = [a[0], b[0], item(0x28, 7)]
    join(c, both, both[0], t)
    expect([both.length, both[0].count]).toEqual([2, 7])
  })

  it('Halve splits the chain: the first half goes after it; two scrolls become two scrolls (0x44666)', () => {
    const { c, t } = setup()
    const items = Array.from({ length: 5 }, (_, i) => item(0x27, 100 * (i + 1)))
    join(c, items, items[0], t)
    expect(halve(c, items, items[0], t)).toBe('')
    expect(items.map((x) => [x.type, x.count, x.value])).toEqual([[0x49, 3, 1200], [0x49, 2, 300]])
    expect(items[1].bundle.map((s) => s.value)).toEqual([100, 200])
    halve(c, items, items[1], t)
    expect(items.map((x) => [x.type, x.value])).toEqual([[0x49, 1200], [0x27, 200], [0x27, 100]])
  })

  it('a bundle saves and loads back with its scrolls after it', () => {
    const { c, t } = setup()
    const items = [item(0x27, 1), item(0x28, 2), item(0x01, 3)]
    join(c, items, items[0], t)
    const back = characterItems(characterItemsFile(items))
    expect(back.map((x) => [x.type, x.count, x.bundle.length])).toEqual([[0x49, 2, 2], [0x01, 0, 0]])
  })

  it('the regular Join: a single item is refused; weight is not compared (0x44CCA, 0x44D32)', () => {
    const { c, t } = setup()
    const one = [item(0x01, 1), item(0x01, 1)]
    expect(join(c, one, one[0], t).message).toBe('That cannot be joined with other items.')
    const arrows = [item(0x19, 1, 10, [5, 0, 0]), item(0x19, 1, 5, [5, 0, 0])]
    arrows[1].raw[0x37] = 3
    expect(join(c, arrows, arrows[0], t).merged).toBe(1)
    expect(arrows[0].count).toBe(15)
  })
})

describe('Join and Halve across games', () => {
  afterAll(() => setGame(POR))
  it('CotAB joins as PoR: the same R.itemJoin (0x3F7B5 is FUN_4894_189d instruction for instruction)', () => {
    setGame(POR)
    const por = { ...R.itemJoin }
    setGame(COAB)
    expect({ ...R.itemJoin }).toEqual(por)
  })
  it('Halve with 16 items does nothing (the menu leaves it out: 0x399B2, 0x3EC2D, 0x43C1A)', () => {
    setGame(POR)
    const items = Array.from({ length: 16 }, () => { const r = new Uint8Array(63); r[0x2e] = 1; r[0x39] = 10; return new Item(r) })
    expect(halve(new Uint8Array(400), items, items[0], { baseOf: () => undefined } as never)).toBe('')
    expect(items.length).toBe(16)
    expect(items[0].count).toBe(10)
  })
})
