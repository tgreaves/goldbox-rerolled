// NPCs joining (ADD_NPC), duels and solo fights (CALL 0x8000 / 0x8001), a destroyed party; needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { fight, type CombatUi } from '../src/rules/combat'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('NPCs and duels', () => {
  const m = new Map<string, Uint8Array>()
  if (have) for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  const files = new GameFiles(m)
  const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
    picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
  const ui: CombatUi = {
    print: () => {}, redraw: () => {}, pause: async () => {},
    menu: async (items) => Math.max(0, items.indexOf('QUICK')), step: async () => 'end',
    aim: async (_f, entries) => entries.find((x) => x.ok) ?? null, confirm: async () => false,
    view: async () => {}, sound: () => {}, pick: async () => -1,
  }
  const game = async (seed: number) => {
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, seed)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
    await e.start()
    return e
  }
  const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(1, 1 + c[0]))

  it('adds an NPC at the end of the party as the current character', async () => {
    const e = await game(1)
    const before = e.party().length
    const id = Array.from({ length: 120 }, (_, i) => i).find((i) => files.record(`MON${e.block}CHA`, i))!
    e.addNpc(id, 100)
    expect(e.party().length).toBe(before + 1)
    const npc = e.party()[before]
    expect(e.cur).toBe(npc)
    expect(npc[0x84]).toBe(0x80 | 50)
    expect(npc[0x10e]).toBe(0)
    expect(npc[0xbb]).toBeGreaterThan(0)
  })

  it('makes PoR\'s draws (FUN_45c5_1262): icon colours, the tag, the class pick, body, head; 0x18 is an enemy', async () => {
    const e = await game(1)
    const asked: [number, number][] = []
    e.roll = (n, s) => { asked.push([n, s]); return 1 }
    const id = Array.from({ length: 120 }, (_, i) => i).find((i) => i !== 0x18 && files.record(`MON${e.block}CHA`, i))!
    e.addNpc(id, 100)
    const classes = [0, 1, 2, 3, 4, 5, 6].filter((k) => ((e.cur[0x96 + k] << 24) >> 24) > 0).length
    expect(asked).toEqual([...Array(5).fill([1, 6]), [1, 256], ...(classes ? [[1, classes]] : []), [1, 5], [1, 8]])
    expect(e.cur[0xab]).toBe(0)
    expect(e.combatPicture.has(e.cur)).toBe(false) // its icon is built from its parts
    if (files.record(`MON${e.block}CHA`, 0x18)) { e.addNpc(0x18, 100); expect(e.cur[0x10e]).toBe(1) }
  })

  it('duels a copy of the current character and puts the bystanders back', async () => {
    for (const seed of [1, 2, 3]) {
      const e = await game(seed)
      const me = e.party()[0]
      e.cur = me
      const xp = (c: Uint8Array) => (c[0xac] | (c[0xad] << 8) | (c[0xae] << 16) | (c[0xaf] << 24)) >>> 0
      const before = xp(me)
      e.setupDuel(true)
      const rolf = e.nodes[e.nodes.length - 1]
      expect(name(rolf)).toBe('ROLF')
      expect(e.party().filter((c) => c !== me).every((c) => c[0x10d] === 0)).toBe(true)
      const r = await fight(e, ui)
      expect(r.survived).toBe(true) // a lost duel never ends the game
      expect(e.read(0x6dc7)).toBe(0)
      expect(e.nodes.includes(rolf)).toBe(false)
      expect(e.party().filter((c) => c !== me && c[0x10c] === 0).every((c) => c[0x10d] === 1)).toBe(true)
      // the duel share is 100 × hit dice, plus the prime-requisite 10 % when it applies
      const base = (me[0x73] * 100) & 0xffff
      if (me[0x10c] === 0) expect([base, base + Math.floor(base / 10)]).toContain(xp(me) - before)
      else expect(xp(me)).toBe(before)
      expect(e.duel).toBe(false)
    }
  })

  it('trades and drops money as the view menu does', async () => {
    const { tradeMoney, dropMoney, moneyOf } = await import('../src/rules/money')
    const e = await game(8)
    const [a, b] = e.party()
    const t = e.items!
    a[0x88 + 6] = 100; a[0x89 + 6] = 0 // 100 gold
    const before = moneyOf(b)[3]
    expect(tradeMoney(a, e.itemsOf(a), b, e.itemsOf(b), 3, 500, t)).toBe('') // clamped to the 100 held
    expect(moneyOf(a)[3]).toBe(0)
    expect(moneyOf(b)[3]).toBe(before + 100)
    const pool = [0, 0, 0, 0, 0, 0, 0]
    dropMoney(b, e.itemsOf(b), 3, 40, pool, t)
    expect(pool[3]).toBe(40)
    dropMoney(b, e.itemsOf(b), 3, 10, null, t) // outside a shop or treasure screen the coins are gone
    expect(moneyOf(b)[3]).toBe(before + 50)
  })

  it('never destroys the party in a brawl (ECL 0x6DE6 = 1)', async () => {
    for (const seed of [5, 6, 7]) {
      const e = await game(seed)
      const n = e.party().length
      for (const c of e.party()) { c[0x11b] = 1; c[0x10c] = 0 }
      e.addMonsters(13, 8, 4)
      e.addMonsters(4, 8, 4)
      e.write(0x6de6, 1)
      const r = await fight(e, ui)
      expect(r.survived).toBe(true)
      expect(e.party().length).toBe(n)
      expect(e.party().some((c) => c[0x10c] === 5)).toBe(false) // Dying became Unconscious
    }
  })

  it('ends with the party gone when it is destroyed', async () => {
    const e = await game(4)
    for (const c of e.party()) { c[0x11b] = 1; c[0x10c] = 0 }
    e.addMonsters(13, 6, 4)
    e.addMonsters(4, 6, 4)
    const r = await fight(e, ui)
    if (!r.survived) {
      expect(e.party().length).toBe(0)
      expect(e.read(0x6dc7)).toBe(0x80)
      expect(e.quit).toBe(true)
    }
  })
})

const coab = process.env.COAB ?? ''
describe.skipIf(!(coab && existsSync(coab)))('CotAB ADD_NPC (0x1B61A, 0x3593D)', () => {
  it('rolls nothing, tags the NPC with its monster id, leaves its side alone and shows its combat picture', async () => {
    const { COAB, POR, F, setGame } = await import('../src/games/profile')
    const { loadFolder } = await import('../headless/harness')
    setGame(COAB)
    try {
      const files = loadFolder(COAB, coab)
      const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
        picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
      const asked: [number, number][] = []
      const e = new Engine(files, io, { roll: (n, s) => { asked.push([n, s]); return n } })
      e.newDemo(COAB.startMenu!.demo!) // block 1, nobody in the party
      const raw = files.record('MON1CHA', 85)!
      e.addNpc(85, 100) // RUSTLE, who joins in the demo
      const c = e.cur
      expect(asked).toEqual([])
      expect(c[F.id]).toBe(85)
      expect(c[F.morale]).toBe(0x80 | 50)
      expect(c[F.side]).toBe(raw[F.side]) // no side written
      for (let k = F.iconSize; k < F.iconColours + 6; k++) expect(c[k]).toBe(raw[k]) // icon size and colours as stored
      expect(e.combatPicture.get(c)).toBe(85)
    } finally { setGame(POR) }
  })
})
