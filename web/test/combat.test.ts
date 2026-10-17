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

  it('paces messages, hits and misses by the game speed', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    for (const speed of [0, 4, 9]) {
      const e = new Engine(files, io, 11)
      e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
      stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
      await e.start()
      e.speed = speed
      e.addMonsters(4, 3, 4)
      const holds: { text: string; ms: number; flash: boolean }[] = []
      let steps = 0, poses = 0, falls = 0
      const ui: CombatUi = {
        pose: (_f, on) => { if (on) poses++ },
        fall: () => { falls++ },
        print: (text, hold) => { holds.push({ text, ms: hold?.ms ?? -1, flash: !!hold?.flash }) },
        redraw: () => {}, pause: async (ms) => { if (ms === 100) steps++ },
        menu: async (items) => Math.max(0, items.indexOf('QUICK')), step: async () => 'end',
        aim: async (_f, entries) => entries.find((x) => x.ok) ?? null, confirm: async () => false,
        view: async () => {}, sound: () => {}, pick: async () => -1,
      }
      await fight(e, ui)
      const hits = holds.filter((h) => / Hitting for /.test(h.text))
      const misses = holds.filter((h) => / and Misses$/.test(h.text))
      expect(hits.length + misses.length).toBeGreaterThan(0)
      // weapon results: the line and the message pause, no flash (spec/combat.md, "Combat visuals")
      for (const h of [...hits, ...misses]) expect(h).toMatchObject({ ms: speed * 225, flash: false })
      expect(holds.find((h) => h.text === 'A battle begins...')?.ms).toBe(speed * 225)
      expect(steps).toBeGreaterThan(0)
      expect(poses).toBeGreaterThan(0) // attackers show their action frame
      expect(falls).toBeGreaterThan(0) // the skull for each combatant who falls
    }
  })
})
