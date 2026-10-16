// A whole battle on computer control (spec/combat.md); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { fight, type CombatUi } from '../src/rules/combat'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('combat', () => {
  it('fights the slums orcs to an end and hands out experience and loot', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const outcomes: string[] = []
    for (const seed of [1, 2, 3, 4, 5]) {
      const e = new Engine(files, io, seed)
      e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
      stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
      await e.start()
      e.addMonsters(13, 1, 4)
      e.addMonsters(4, 3, 4)
      const ui: CombatUi = {
        print: () => {}, redraw: () => {}, pause: async () => {},
        menu: async (items) => Math.max(0, items.indexOf('QUICK')), step: async () => 'end',
        aim: async (_f, entries) => entries.find((x) => x.ok) ?? null, confirm: async () => false,
        view: async () => {}, sound: () => {}, pick: async () => -1,
      }
      const r = await fight(e, ui)
      outcomes.push(r.survived ? 'survived' : 'lost')
      expect(e.nodes.length).toBe(stems.length - (r.survived ? 0 : stems.length)) // monsters left the list
      if (e.read(0x6dc7) === 0) expect(r.share).toBeGreaterThan(0)
    }
    expect(outcomes).toContain('survived')
  })
})
