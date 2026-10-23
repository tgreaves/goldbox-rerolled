// A whole battle on computer control (spec/A-games/engine/combat-rules.md); needs POOLRAD.
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

  it('debug: winning at once ends the battle as won, with experience', async () => {
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
    e.cur = e.savedCur = e.nodes[3] // someone other than the first is current going in
    e.addMonsters(13, 1, 4)
    let battle: import('../src/rules/combat').Battle | null = null
    const ui: CombatUi = {
      print: () => {}, redraw: () => {}, pause: async () => {},
      // the first time the player is asked anything, the debug win is used (the screen then answers the last item)
      menu: async (items) => { battle?.debugWin(); return items.length - 1 }, step: async () => 'end',
      aim: async () => null, confirm: async () => false, view: async () => {}, sound: () => {}, pick: async () => -1,
    }
    const r = await fight(e, ui, (b) => { battle = b })
    expect(r.survived).toBe(true)
    expect(e.read(0x6dc7)).toBe(0)
    expect(r.share).toBeGreaterThan(0)
    expect(r.messages).toContain('The party has won.')
    expect(e.nodes.length).toBe(stems.length)
    // the clean-up makes the head of the list current (0x1F316)
    expect(e.cur).toBe(e.nodes[0])
  })

  it('takes steps straight from the command prompt (IMP-053)', async () => {
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
    await e.start()
    e.addMonsters(13, 1, 4)
    const seen: { items: string[]; left: number; at: string }[] = []
    let battle: import('../src/rules/combat').Battle | null = null
    const ui: CombatUi = {
      print: () => {}, redraw: () => {}, pause: async () => {},
      menu: async (items) => Math.max(0, items.indexOf('QUICK')), step: async () => 'end',
      command: async (f, items, _p, left) => {
        seen.push({ items, left, at: `${f.x},${f.y}` })
        if (seen.length === 1) { for (let d = 0; d < 8; d++) if (battle!.passable(f.x + [0, 1, 1, 1, 0, -1, -1, -1][d], f.y + [-1, -1, 0, 1, 1, 1, 0, -1][d], f.size) && !battle!.occupied(f.x + [0, 1, 1, 1, 0, -1, -1, -1][d], f.y + [-1, -1, 0, 1, 1, 1, 0, -1][d], f.size, f)) return d }
        if (seen.length === 2) battle!.debugWin()
        return { choice: items.indexOf('END TURN') }
      },
      aim: async () => null, confirm: async () => false, view: async () => {}, sound: () => {}, pick: async () => -1,
    }
    await fight(e, ui, (b) => { battle = b })
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(seen[0].items).not.toContain('MOVE')
    expect(seen[0].items).toEqual(expect.arrayContaining(['DELAY', 'END TURN']))
    expect(seen[0].items).not.toContain('DONE')
    expect(seen[1].items).toContain('UNDO') // after a step
    expect(seen[1].at).not.toBe(seen[0].at) // the step was taken
    expect(seen[1].left).toBeLessThan(seen[0].left)
  })

  it('Quick hands a character to the computer and Space takes them back', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 3)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
    await e.start()
    e.addMonsters(13, 1, 4)
    let battle: import('../src/rules/combat').Battle | null = null
    const asked: string[] = []
    let quick = 0
    const ui: CombatUi = {
      print: () => {}, redraw: () => {}, pause: async () => {},
      // everyone goes on Quick; after a few computer turns, Space; then manual turns come back
      menu: async (items, opts) => {
        asked.push(opts?.prompt ?? '')
        if (quick < 6 && items.includes('QUICK')) { quick++; return items.indexOf('QUICK') }
        battle?.debugWin()
        return items.length - 1
      },
      step: async () => 'end', aim: async () => null, confirm: async () => false, view: async () => {}, sound: () => {}, pick: async () => -1,
    }
    const done = fight(e, ui, (b) => { battle = b })
    // once the whole party is on Quick, take them back
    for (let i = 0; i < 200 && quick < 6; i++) await new Promise((r) => setTimeout(r, 0))
    const back = battle!.takeControl()
    await done
    expect(back.length).toBeGreaterThan(0)
    expect(e.party().every((c) => c[0x10f] === 0 || c[0x84] >= 0x80)).toBe(true)
  })

  it('flees off the edge of the battlefield (FUN_3aae_0c6a)', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 4)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
    await e.start()
    e.addMonsters(13, 1, 4)
    let battle: import('../src/rules/combat').Battle | null = null
    const said: string[] = []
    const asked: string[] = []
    const ui: CombatUi = {
      print: (t) => { said.push(t) }, redraw: () => {}, pause: async () => {},
      menu: async (items) => items.indexOf('END TURN') >= 0 ? items.indexOf('END TURN') : items.length - 1,
      // every party member: stand on the west edge and step off it
      command: async (f, items) => {
        if (f.c[0x10c] !== 0) return { choice: items.indexOf('END TURN') }
        const b = battle!
        let x = f.x
        while (x > 0 && b.bf.get(f.y, x - 1) !== 0) x--
        if (!b.occupied(x, f.y, f.size, f)) f.x = x
        return b.bf.get(f.y, f.x - 1) === 0 ? 6 : { choice: items.indexOf('END TURN') }
      },
      step: async () => 'end', aim: async () => null,
      confirm: async (p) => { asked.push(p); return p === 'Flee:' }, view: async () => {}, sound: () => {}, pick: async () => -1,
    }
    const r = await fight(e, ui, (b) => { battle = b })
    expect(asked).toContain('Flee:')
    expect(said.some((t) => t.endsWith('Got Away') || t === 'Escape is blocked')).toBe(true)
    // everyone who got away ran (status Running in battle); a party that all ran has fled (0x81)
    if (r.messages.includes('The party has fled.')) expect(e.read(0x6dc7)).toBe(0x81)
  })

  it('a member lost in a flight leaves as the remove-current routine takes it: the one before becomes current (SotSB 0x23CCC → 0x3CAA4)', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 2)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    await e.start()
    const [a, b, c] = e.party()
    e.cur = e.savedCur = c
    e.removeEntry(c)
    expect([e.cur, e.savedCur]).toEqual([b, b]) // the one before
    e.removeEntry(e.party()[e.party().length - 1]) // not the current one: the current stays
    expect(e.cur).toBe(b)
    e.cur = a
    e.removeEntry(a)
    expect(e.cur).toBe(b) // the first gone: the new head
    expect(e.party()).not.toContain(a)
  })

  it('never counts loaded monsters as party members, and recounts the party after a battle', async () => {
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
    await e.start()
    // a party size left too high (the old fled bug): the guards loaded after the party stay monsters
    e.nodes.splice(1)
    e.write(0x6e3e, 6)
    e.addMonsters(13, 1, 4)
    expect(e.party()).toHaveLength(1)
    let battle: import('../src/rules/combat').Battle | null = null
    const ui: CombatUi = {
      print: () => {}, redraw: () => {}, pause: async () => {}, menu: async (items) => items.length - 1, step: async () => 'end',
      aim: async () => null, confirm: async () => false, view: async () => {}, sound: () => {}, pick: async () => -1,
    }
    await fight(e, ui, (b) => { battle = b; expect(b.fighters.filter((f) => !f.monster)).toHaveLength(1); b.debugWin() })
    expect(battle).not.toBeNull()
    expect(e.read(0x6e3e)).toBe(e.nodes.length) // recounted
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
      // weapon results: the line and the message pause, no flash (spec/A-games/engine/combat-visuals.md, "Combat visuals")
      for (const h of [...hits, ...misses]) expect(h).toMatchObject({ ms: speed * 225, flash: false })
      expect(holds.find((h) => h.text === 'A battle begins...')?.ms).toBe(speed * 225)
      expect(steps).toBeGreaterThan(0)
      expect(poses).toBeGreaterThan(0) // attackers show their action frame
      expect(falls).toBeGreaterThan(0) // the skull for each combatant who falls
    }
  })
})
