// Curse of the Azure Bonds' camp Cast with a combat-only spell (0x45251, spec/A-games/engine/camp-and-time.md):
// the game's own "can't be cast here..." then "Lose it?". Needs COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COAB, POR, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { cast, type CampUi } from '../src/ui/camp'
import { loadFiles } from './playtest'

const dir = process.env.COAB ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('Curse of the Azure Bonds camp Cast', () => {
  afterAll(() => setGame(POR))
  it('a combat-only spell: the game text, then Lose it? (No keeps it)', async () => {
    setGame(COAB)
    const files = loadFiles(COAB, dir)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 1)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    const sleep = e.spells!.spells.find((s) => s.name === 'Sleep')!
    expect(sleep.side).toBe(0) // record byte 7 = 0: combat only
    const c = e.party()[0]
    c[F.memorised] = sleep.id
    e.cur = c
    const printed: string[] = [], asked: string[] = []
    const ui = {
      engine: e, print: (t: string) => { printed.push(t) }, refresh: () => {},
      // the spell list: the spell; Lose it?: No; the list again: Exit
      menu: async (items: string[], o?: { prompt?: string }) => {
        asked.push(o?.prompt ?? '')
        if (/Lose it/.test(o?.prompt ?? '')) return items.indexOf('NO') >= 0 ? items.indexOf('NO') : items.findIndex((x) => /^n/i.test(x))
        return asked.length === 1 ? 0 : items.length - 1
      },
    } as unknown as CampUi
    await cast(ui)
    expect(printed).toContain("Sleep can't be cast here...")
    expect(printed.join(' ')).not.toMatch(/#/)
    expect(asked.some((p) => /^Lose it\?/.test(p))).toBe(true)
    expect(c[F.memorised]).toBe(sleep.id)
  })
})

describe.skipIf(!have)('Curse of the Azure Bonds camp Memorize, as seen in DOSBox (spec/VALIDATION.md §4)', () => {
  afterAll(() => setGame(POR))
  it('SHARA: a level without slots left blank, Find Traps, Rest Time 00:04:30', async () => {
    const { loadFolder, runScript } = await import('../headless/harness')
    const texts: string[] = [], prompts: string[] = []
    const r = await runScript({
      files: loadFolder(COAB, dir), seed: 1,
      script: { game: 'coab', camp: true, commands: ['cur 5', 'e'], answers: [0, 0, 'MAGIC', 'MEMORIZE', 'FIND TRAPS (CL 2)', 'EXIT', 0, 'REST'] },
      out: (ev) => {
        if (ev.event === 'text') texts.push(String(ev.text))
        if (ev.event === 'end' && ev.waiting) prompts.push(String((ev.waiting as { prompt?: string }).prompt))
      },
    })
    expect(r.end).toBe('answers')
    expect(texts).toContain('SHARA can memorize:  Cleric Spells: 5 5 2')
    expect(texts).toContain('SHARA can memorize:  Cleric Spells: 5 4 2')
    expect(prompts[0]).toBe('Rest Time: 00:04:[30]')
  })
})
