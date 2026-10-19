// Spell handlers shared by combat and camp (spec/spells.md, "Per spell"); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { castOutside, targetKind } from '../src/rules/magic'
import { addRaw, drain, removeType } from '../src/rules/effects'
import { Tables } from '../src/rules/chargen'
import { xpFor } from '../src/rules/training'
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
  const fighter = e.party().find((x) => x[0x98] > 0 && x[0x10] < 18)!
  return { e, st: e.spells!, fighter, cast: (id: number, t: Uint8Array) => castOutside(e, e.party()[0], e.spells!.get(id)!, [t], true) }
}
const has = (e: Engine, c: Uint8Array, t: number) => e.effectsOf(c).some((x) => x.type === t)

describe.skipIf(!have)('shared spells', () => {
  it('aims by the side byte', () => {
    const { st } = setup()
    expect(targetKind(st.get(35)!)).toBe('one') // Strength
    expect(targetKind(st.get(41)!)).toBe('one') // Dispel Magic
    expect(targetKind(st.get(42)!)).toBe('self') // Prayer
  })

  it('Enlarge and Giant Strength stack; the strongest holds and STR comes back', async () => {
    const { e, fighter: c, cast } = setup()
    const str = c[0x10], pct = c[0x16]
    const out = await cast(12, c) // from an item: level 6, 18/00
    expect(out.some((s) => s.endsWith('is stronger'))).toBe(true)
    expect([c[0x10], c[0x16]]).toEqual([18, 100])
    await cast(59, c)
    expect(c[0x10]).toBe(21)
    const h = new WorldHost(e, () => {})
    await removeType(h, c, 0x26)
    expect([c[0x10], c[0x16]]).toEqual([18, 100]) // Enlarge takes over again
    await removeType(h, c, 0x0c)
    expect([c[0x10], c[0x16]]).toEqual([str, pct])
  })

  it('Cure Disease lifts the helplessness only with the disease that caused it', async () => {
    const { e, fighter: c, cast } = setup()
    const h = new WorldHost(e, () => {})
    addRaw(h, c, 0x2c, 0, 0xff, 0)
    await cast(39, c)
    expect(has(e, c, 0x2c)).toBe(true)
    addRaw(h, c, 0x2b, 0, 0xff, 0)
    const out = await cast(39, c)
    expect(out.some((s) => s.endsWith('is Cured'))).toBe(true)
    expect(has(e, c, 0x2b) || has(e, c, 0x2c)).toBe(false)
  })

  it('Remove Curse frees the first cursed item', async () => {
    const { e, fighter: c, cast } = setup()
    const it = e.itemsOf(c)[0]
    it.raw[0x36] = 1
    const out = await cast(43, c)
    expect(it.cursed).toBe(false)
    expect(out).toContain(`${String.fromCharCode(...c.subarray(1, 1 + c[0]))}'s item is un-cursed`)
  })

  it('energy drain takes a level, its hit points and the experience above it (FUN_3723_2122)', () => {
    const { e, fighter: c } = setup()
    const out: string[] = []
    const h = new WorldHost(e, (t) => out.push(t))
    const tb = new Tables(e.startImage!)
    for (let k = 0; k < 8; k++) c[0x96 + k] = 0
    c[0x98] = 3; c[0x73] = 3; c[0x32] = 30; c[0x11b] = 30; c[0x74] = 0; c[0x75] = 0
    drain(h, c, 1)
    expect(out.join(' ')).toContain('is drained a level')
    expect(c[0x98]).toBe(2)
    expect([c[0x74], c[0x75], c[0x32]]).toEqual([1, 10, 20])
    expect(c[0x73]).toBe(2)
    const xp = (c[0xac] | (c[0xad] << 8) | (c[0xae] << 16) | (c[0xaf] << 24)) >>> 0
    expect(xp).toBe(xpFor(tb, 2, 2))
  })

  it('a character drained below level 2 is gone, max HP 0; two levels at once also clear the class', () => {
    const { e, fighter: c } = setup()
    const h = new WorldHost(e, () => {})
    for (let k = 0; k < 8; k++) c[0x96 + k] = 0
    c[0x98] = 1; c[0x73] = 1; c[0x10c] = 0
    drain(h, c, 2)
    expect(c[0x10c]).toBe(8)
    expect(c[0x32]).toBe(0)
    expect(c[0x98]).toBe(0)
    expect(c[0x74]).toBe(1) // the second level is skipped once gone
  })

  it('Restoration gives back a drained level', async () => {
    const { e, fighter: c, cast } = setup()
    const hp = c[0x32]
    c[0x98] = 3
    const lv3 = 3
    c[0x98]--; c[0x74] = 1; c[0x75] = 4; c[0x32] -= 4
    await cast(56, c)
    expect(c[0x98]).toBe(lv3)
    expect(c[0x32]).toBe(hp)
    expect(c[0x74]).toBe(0)
    void e
  })
})
