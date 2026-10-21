// The start-up menu and the demo (games/startup.ts, spec/A-games/coab/ecl.md "Start-up menu and demo"): the
// menu's strings read from START.EXE, the demo script run headless from start to end in demo mode,
// and Pool of Radiance without either. Needs COAB (and POOLRAD for the Pool of Radiance check).
import { afterAll, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COAB, POR, setGame } from '../src/games/profile'
import { startMenuText } from '../src/games/startup'
import { unexepack } from '../src/data/exepack'
import { Engine, type Io } from '../src/vm/engine'
import { fight, type CombatUi } from '../src/rules/combat'
import { F } from '../src/games/fields'
import { loadFiles } from './playtest'

const coab = process.env.COAB ?? ''
const por = process.env.POOLRAD ?? ''
const haveCoab = coab !== '' && existsSync(coab)
const havePor = por !== '' && existsSync(por)
const nameOf = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))

describe('start-up menus in the profiles', () => {
  it('Pool of Radiance has none: the title goes to the party screen', () => {
    expect(POR.startMenu).toBeNull()
  })
  it('Curse of the Azure Bonds: Play / Demo, the demo at ECL1 #82', () => {
    const m = COAB.startMenu!
    expect(m.demoKey).toBe('D')
    expect(m.demo.block).toBe(1)
    expect(m.demo.record).toBe(82)
    expect(m.timeout).toEqual({ first: 3000, again: 1000 })
  })
})

describe.skipIf(!havePor)('Pool of Radiance has no demo', () => {
  it('no "Demo" in its START.EXE or GAME.OVR', () => {
    for (const f of ['START.EXE', 'GAME.OVR']) {
      const p = join(por, f)
      if (!existsSync(p)) continue
      expect(readFileSync(p).toString('latin1').toLowerCase()).not.toContain('demo')
    }
  })
})

describe.skipIf(!haveCoab)('Curse of the Azure Bonds start-up menu and demo', () => {
  afterAll(() => setGame(POR))

  it('reads the menu title and choices from START.EXE', () => {
    const img = unexepack(new Uint8Array(readFileSync(join(coab, 'START.EXE')))).image
    const t = startMenuText(img, COAB.startMenu!)
    expect(t).toEqual({ title: 'Curse of the Azure Bonds v1.3', choices: [{ label: 'Play', key: 'P' }, { label: 'Demo', key: 'D' }] })
    expect(t!.choices.map((c) => c.key)).toContain(COAB.startMenu!.demoKey)
  })

  it('runs the demo from its start to its end in demo mode', async () => {
    setGame(COAB)
    const files = loadFiles(COAB, coab)
    const text: string[] = []
    const menus: string[] = []
    let waited = 0, frames = 0, battles = 0, rounds = 0
    const pictures: string[] = []
    const combatUi: CombatUi = {
      print: (t) => { text.push(t) },
      redraw: () => {},
      pause: async (ms) => { waited += ms ?? 0 },
      menu: async (items, opts) => { menus.push(`${opts?.prompt ?? ''}: ${items.join('/')}`); return items.length - 1 },
      step: async () => 'end',
      aim: async () => null,
      confirm: async (p) => { menus.push(p); return false },
      view: async () => {},
      sound: () => {},
      pick: async () => -1,
    }
    let e!: Engine
    const io: Io = {
      print: (t) => { text.push(t) },
      menu: async (items, opts) => { menus.push(`${opts?.prompt ?? ''}: ${items.join('/')}`); return 0 },
      inputNumber: async () => 0,
      inputText: async () => '',
      picture: (p) => { pictures.push(JSON.stringify(p)) },
      sprite: () => {}, clearView: () => {}, clearTop: () => {}, glyphs: () => {},
      refresh: async () => {},
      sound: () => {},
      pause: async (ms) => { waited += ms },
      nextFrame: () => { frames++ },
      async engine(what) {
        if (what !== 'combat') throw new Error(`the demo asked for ${what}`)
        battles++
        const r = await fight(e, combatUi)
        rounds += r.battle.round
        // 0x4BE6 is 0 before COMBAT: CotAB builds a wilderness field (WILDCOM, 0x25CC0) whose terrain is
        // the place table's entry for ECL 0x4CA1 (0 here: plain ground), not a map area
        expect(r.battle.bf.outdoors).toBe(true)
        expect(r.messages).toEqual([]) // no outcome, experience or treasure in the demo
        expect(r.survived).toBe(true)
      },
    }
    e = new Engine(files, io, 82)
    const toSave = vi.spyOn(e, 'toSave')
    e.newDemo(COAB.startMenu!.demo)
    expect(e.block).toBe(1)
    expect(e.area).toBe(82)
    expect(e.speed).toBe(9)
    // the party during the demo: the script's NPCs
    const joined: string[] = []
    const addNpc = e.addNpc.bind(e)
    e.addNpc = (id, morale) => { addNpc(id, morale); joined.push(nameOf(e.cur)) }
    await e.runDemo()
    expect(joined).toEqual(['RUSTLE', 'CYNTHIA', 'GRENDEL'])
    expect(battles).toBe(1)
    expect(rounds).toBeGreaterThan(0)
    expect(frames).toBe(11) // CALL 0x6803 eleven times over PIC 29
    expect(pictures.slice(0, 1)).toEqual([JSON.stringify({ pic: 80 })])
    expect(pictures).toContain(JSON.stringify({ big: 121 }))
    expect(pictures).toContain(JSON.stringify({ big: 123 }))
    expect(text[0]).toMatch(/^ON YOUR WAY TO THE TOWN OF TILVERTON/)
    expect(text.join(' ')).toMatch(/FREE OF THE CURSE OF THE AZURE BONDS\.$/)
    // its 26 PAUSEs and 11 frames at speed 9: 9 × 100 ms each
    expect(waited).toBeGreaterThanOrEqual(37 * 900)
    expect(menus).toEqual([]) // nothing asked: no "Continue Battle:", no summary, no prompts
    expect(e.quit).toBe(true) // PROGRAM 3 at the end
    expect(e.nodes).toEqual([]) // every member left
    expect(e.party()).toEqual([])
    expect(toSave).not.toHaveBeenCalled()
  }, 120000)
})
