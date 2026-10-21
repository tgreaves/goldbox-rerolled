// Items that act when readied (spec/A-games/engine/effects.md, "Item handlers") and the Spiritual Hammer; needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { Item, ITEM_SIZE } from '../src/data/items'
import { readyItem, unreadyItem } from '../src/rules/equip'
import { addEffect, removeType } from '../src/rules/effects'
import { WorldHost } from '../src/rules/worldfx'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

function setup() {
  const m = new Map<string, Uint8Array>()
  for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  const files = new GameFiles(m)
  const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
    picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
  const dat = files.get('SAVGAMA.DAT')!
  const stems = parseSave(dat).party
  const e = new Engine(files, io, 1)
  e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
  stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
  const said: string[] = []
  return { e, t: e.items!, host: new WorldHost(e, (s) => said.push(s)), said }
}

function make(type: number, handler: number, p3d = 0): Item {
  const r = new Uint8Array(ITEM_SIZE)
  r[0x2e] = type
  r[0x31] = type
  r[0x3d] = p3d
  r[0x3e] = handler
  return new Item(r)
}

describe.skipIf(!have)('item handlers', () => {
  it('Gauntlets of Ogre Power give 18/00 and give it back when taken off', async () => {
    const { e, t, host, said } = setup()
    const c = e.party().find((x) => x[0x98] > 0 && x[0x10] < 18)!
    const str = c[0x10], pct = c[0x16]
    const type = t.base.findIndex((b) => b.slot === 3 && (b.classes & c[0xb0]))
    for (const x of e.itemsOf(c)) if (t.baseOf(x)?.slot === 3) x.ready = false
    const g = make(type, 131)
    e.itemsOf(c).push(g)
    expect(await readyItem(host, c, e.itemsOf(c), g, t)).toBe('')
    expect([c[0x10], c[0x16]]).toEqual([18, 100])
    expect(said.some((s) => s.endsWith('is stronger'))).toBe(true)
    expect(e.effectsOf(c).some((f) => f.type === 38)).toBe(true)
    expect(await unreadyItem(host, c, e.itemsOf(c), g, t)).toBe('')
    expect([c[0x10], c[0x16]]).toEqual([str, pct])
    expect(e.effectsOf(c).some((f) => f.type === 38)).toBe(false)
  })

  it('an alignment-locked sword refuses the wrong alignment and hurts', async () => {
    const { e, t, host, said } = setup()
    const c = e.party().find((x) => x[0x98] > 0 && x[0x11b] > 6)!
    const type = t.base.findIndex((b) => b.slot === 0 && b.hands === 1 && (b.classes & c[0xb0]))
    for (const x of e.itemsOf(c)) x.ready = t.baseOf(x)?.slot === 0 ? false : x.ready
    c[0x100] = 0
    const sw = make(type, 132, (5 << 4) | ((c[0xa0] + 1) % 9))
    e.itemsOf(c).push(sw)
    const hp = c[0x11b]
    await readyItem(host, c, e.itemsOf(c), sw, t)
    expect(sw.ready).toBe(false)
    expect(c[0x11b]).toBe(hp - 5)
    expect(said.some((s) => s.includes('5 points of damage from Magic'))).toBe(true)
  })

  it('Spiritual Hammer makes the hammer and takes it away', async () => {
    const { e, host, said } = setup()
    const c = e.party()[0]
    const n = e.itemsOf(c).length
    await addEffect(host, c, 0x17, 5, 1, 1, 0, false, true)
    const hammer = e.itemsOf(c).find((x) => x.type === 20 && x.raw[0x31] === 0xf3)
    expect(hammer).toBeDefined()
    expect(said.some((s) => s.endsWith('Gains an item'))).toBe(true)
    await removeType(host, c, 0x17, true)
    expect(e.itemsOf(c).length).toBe(n)
  })
})
