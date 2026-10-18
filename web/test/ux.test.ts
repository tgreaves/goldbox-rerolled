// Hit odds and spell descriptions (IMP-058); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { fight, type CombatUi } from '../src/rules/combat'
import { spellText } from '../src/rules/spelltext'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('information for the player', () => {
  it('works out the odds of a weapon attack from the original rules', async () => {
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
    await e.start()
    e.addMonsters(13, 1, 4)
    let odds: { chance: number; damage: string } | null = null
    const ui: CombatUi = {
      print: () => {}, redraw: () => {}, pause: async () => {}, menu: async (items) => items.length - 1, step: async () => 'end',
      aim: async () => null, confirm: async () => false, view: async () => {}, sound: () => {}, pick: async () => -1,
    }
    await fight(e, ui, (b) => {
      const me = b.fighters.find((f) => !f.monster)!, foe = b.fighters.find((f) => f.monster)!
      odds = b.hitOdds(me, foe)
      b.debugWin()
    })
    expect(odds!.chance).toBeGreaterThan(0)
    expect(odds!.chance).toBeLessThanOrEqual(1)
    expect(Math.round(odds!.chance * 20)).toBe(odds!.chance * 20) // whole d20 faces
    expect(odds!.damage).toMatch(/^\d+d\d+([+-]\d+)?$/)
  })

  it('describes spells from the spell table', () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const e = new Engine(new GameFiles(m), {} as Io, 1)
    const st = e.spells!
    expect(spellText(st.get(47)!)).toMatch(/save for half/)
    expect(spellText(st.get(3)!)).toMatch(/^Heals 1d8/)
    expect(spellText(st.get(4)!)).toMatch(/range touch/)
    for (const s of st.spells) expect(spellText(s).length).toBeGreaterThan(10)
  })
})
