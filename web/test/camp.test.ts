// Camp rules against the shipped party (spec/camp.md); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { clockText, memorise, memorised, preparation, restStep, startRest } from '../src/rules/camp'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('camp', () => {
  it('memorises after the preparation time and heals after 24 hours of rest', async () => {
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
    const st = e.spells!, t = e.items!
    // a cleric: empty its memory, then pick Cure Light Wounds
    const cleric = e.party().find((c) => c[0x96] > 0 && c[0xb2] > 0)!
    for (let k = 0; k < 21; k++) cleric[0x17 + k] = 0
    expect(memorise(cleric, st.get(3)!, st)).toBe(true)
    expect(memorised(cleric).filter((v) => v === 3 + 0x80)).toHaveLength(1)
    const need = preparation(cleric, e.itemsOf(cleric), t, st)
    expect(need).toBe(4 * 60 + 15) // 4 base hours + 15 minutes for a level-1 spell
    // wound someone, then rest a full day without encounters
    e.write(0x6dd2, 0)
    const hurt = e.party()[0]
    hurt[0x11b] = Math.max(1, hurt[0x32] - 3)
    const before = hurt[0x11b]
    const clock0 = clockText(e)
    const r = startRest(e, 1440)
    const camp = { heal: 0 }
    const messages: string[] = []
    while (r.minutes > 0) messages.push(...(await restStep(e, r, camp)).messages)
    expect(memorised(cleric)).toContain(3)
    expect(messages.some((s) => s.endsWith('has memorized Cure Light Wounds'))).toBe(true)
    expect(messages).toContain('The Whole Party Is Healed')
    expect(hurt[0x11b]).toBe(before + 1)
    expect(clockText(e)).toBe(clock0) // a full day later, same time of day
  })
})

describe.skipIf(!have)('camp Fix (IMP-048)', () => {
  it('heals the party with its clerics, resting between casts', async () => {
    const { camp } = await import('../src/ui/camp')
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 2)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
    e.write(0x6dd2, 0) // no wandering monsters while resting
    for (const c of e.party()) c[0x11b] = Math.max(1, c[0x32] - 4)
    const lines: string[] = []
    let calls = 0
    const ui = {
      engine: e, print: (t: string) => { lines.push(t) }, refresh: () => {}, pause: async () => {},
      menu: async (items: string[]) => (calls++ === 0 ? items.indexOf('FIX') : items.indexOf('EXIT')),
      view: async () => {}, save: async () => {}, stopper: () => ({ stopped: () => false, done: () => {} }),
    }
    await camp(ui as never)
    expect(e.party().every((c) => c[0x11b] === c[0x32])).toBe(true)
    expect(lines).toContain('The party is fully healed.')
  })
})
