// The temple's services from each game's own tables (docs/multi-game.md, step 6).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'
import { R } from '../src/games/rules'
import { T } from '../src/games/tables'
import { F } from '../src/games/fields'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { temple, type TownUi } from '../src/ui/town'
import { loadFiles } from './playtest'

const names = (dir: string) => {
  const img = unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
  const name = (i: number) => { const o = T.ds + T.templeNames.at + i * T.templeNames.row; return String.fromCharCode(...img.subarray(o + 1, o + 1 + img[o])) }
  return { list: R.temple.map((_, i) => name(i)), after: name(R.temple.length), diseases: Array.from({ length: 6 }, (_, i) => img[T.ds + T.diseases.at + 1 + i]) }
}

describe('temple tables', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('Pool of Radiance: nine services, then Exit', () => {
    setGame(POR)
    const n = names(process.env.POOLRAD!)
    expect(n.list[5]).toBe('Neutralize Poison')
    expect(n.after).toBe('Exit')
    expect(n.diseases).toEqual([31, 34, 43, 44, 50, 57])
  })
  it.skipIf(!process.env.COAB || !existsSync(process.env.COAB))('Curse of the Azure Bonds: Heal after Cure Critical Wounds', () => {
    setGame(COAB)
    const n = names(process.env.COAB!)
    expect(n.list[R.temple.findIndex((x) => x.kind === 'heal')]).toBe('Heal')
    expect(n.list[R.temple.findIndex((x) => x.kind === 'stone')]).toBe('Stone to Flesh')
    expect(n.after).toBe('Exit')
    expect(n.diseases).toEqual([31, 34, 43, 44, 50, 57])
  })
})

/** The temple screen for the shipped party's first member, answering by the menu items' names. */
async function cure(game: typeof POR, dir: string, service: string, setup: (c: Uint8Array, e: Engine) => void) {
  setGame(game)
  const files = loadFiles(game, dir)
  const io = { print: () => {}, menu: async () => 0 } as unknown as Io
  const dat = files.get('SAVGAMA.DAT')!
  const stems = parseSave(dat).party
  const e = new Engine(files, io, 1)
  e.loadSave(dat, stems.map((st) => files.get(`${st}.SAV`)!))
  stems.forEach((st, i) => e.attachFiles(i, files.get(`${st}.${game.saves.items}`), files.get(`${st}.${game.saves.effects}`)))
  const c = e.party()[0]
  c[F.money + 8] = 0x10; c[F.money + 9] = 0x27 // 10 000 platinum
  setup(c, e)
  const answers = ['HEAL', service, 'YES', 'YES', 'EXIT', 'EXIT']
  const ui: TownUi = {
    engine: e, print: () => {}, inputNumber: async () => 0, view: async () => {}, refresh: () => {},
    menu: async (items) => { const k = items.indexOf(answers[0]); if (k >= 0) answers.shift(); return k >= 0 ? k : items.length - 1 },
  }
  await temple(ui)
  return c
}

describe('temple cures go through the heal routine', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('Pool of Radiance: no hit points for the dead; the unconscious get up (FUN_2d14_0401)', async () => {
    const dead = await cure(POR, process.env.POOLRAD!, 'CURE SERIOUS WOUNDS', (c) => { c[F.status] = 6; c[F.hp] = 0; c[F.inPlay] = 0 })
    expect([dead[F.status], dead[F.hp]]).toEqual([6, 0])
    const down = await cure(POR, process.env.POOLRAD!, 'CURE LIGHT WOUNDS', (c) => { c[F.status] = 4; c[F.hp] = 0; c[F.inPlay] = 0 })
    expect([down[F.status], down[F.inPlay], down[F.hp] > 0]).toEqual([0, 1, true])
    const raised = await cure(POR, process.env.POOLRAD!, 'RAISE DEAD', (c) => { c[F.status] = 6; c[F.hp] = 0; c[F.inPlay] = 0 })
    expect([raised[F.status], raised[F.inPlay], raised[F.hp]]).toEqual([0, 1, 1]) // FUN_2d14_0510 (0x1D739)
    // the hit points lost (0x1D84B): with CON 17 or more after the raise, a fighter loses them, a magic-user not
    const lost = (k: number, con: number) => async () => {
      let before = 0
      const c = await cure(POR, process.env.POOLRAD!, 'RAISE DEAD', (c) => {
        c[F.status] = 6; c[F.hp] = 0; c[F.inPlay] = 0
        for (let i = 0; i < 8; i++) c[F.levels + i] = 0
        c[F.levels + k] = 4; c[F.stat[4]] = c[F.baseStat[4]] = con + 1; c[F.maxHp] = 40; c[F.hpRolled] = 20
        before = c[F.maxHp]
      })
      return before - c[F.maxHp]
    }
    expect(await lost(2, 17)()).toBe(Math.floor(20 / (4 * 3))) // fighter: t = L × (CON − 14)
    expect(await lost(5, 17)()).toBe(0)
    expect(await lost(5, 16)()).toBe(Math.floor(20 / 8)) // CON 16: 2L
    const stone = await cure(POR, process.env.POOLRAD!, 'STONE TO FLESH', (c) => { c[F.status] = 7; c[F.hp] = 0; c[F.inPlay] = 0 })
    expect([stone[F.status], stone[F.inPlay], stone[F.hp]]).toEqual([0, 1, 1]) // 0x1DAD7
  })
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('Remove Curse runs the spell (FUN_4e53_2540): only the first cursed item', async () => {
    let items: { cursed: boolean; raw: Uint8Array }[] = []
    await cure(POR, process.env.POOLRAD!, 'REMOVE CURSE', (c, e) => {
      items = e.itemsOf(c)
      expect(items.length).toBeGreaterThanOrEqual(2)
      items[0].raw[0x36] = 1; items[1].raw[0x36] = 1
    })
    expect(items.slice(0, 2).map((x) => x.cursed)).toEqual([false, true])
  })
  it.skipIf(!process.env.COAB || !existsSync(process.env.COAB))('Curse of the Azure Bonds: Heal leaves max − 1d4 even from nearly full (0x1CC34)', async () => {
    const c = await cure(COAB, process.env.COAB!, 'HEAL', (c) => { c[F.hp] = c[F.maxHp] - 1 })
    expect(c[F.maxHp] - c[F.hp]).toBeGreaterThanOrEqual(1)
    expect(c[F.maxHp] - c[F.hp]).toBeLessThanOrEqual(4)
    const dead = await cure(COAB, process.env.COAB!, 'CURE CRITICAL WOUNDS', (c) => { c[F.status] = 6; c[F.hp] = 0; c[F.inPlay] = 0 })
    expect([dead[F.status], dead[F.hp]]).toEqual([6, 0])
  })
})

/** SotSB's free temple (0x22FA5): the shipped party's first member, service `kind`; its lines and the money. */
async function freeCure(kind: string, setup: (c: Uint8Array, e: Engine) => void) {
  setGame(SOTSB)
  const files = loadFiles(SOTSB, process.env.SOTSB!)
  const io = { print: () => {}, menu: async () => 0 } as unknown as Io
  const dat = files.get('SAVGAMA.DAT')!
  const stems = parseSave(dat).party
  const e = new Engine(files, io, 1)
  e.loadSave(dat, stems.map((st) => files.get(`${st}.SAV`)!))
  stems.forEach((st, i) => e.attachFiles(i, files.get(`${st}.${SOTSB.saves.items}`), files.get(`${st}.${SOTSB.saves.effects}`)))
  const c = e.party()[0]
  setup(c, e)
  const money = [...c.subarray(F.money, F.money + 14)]
  const said: string[] = []
  const at = R.temple.findIndex((x) => x.kind === kind)
  let step = 0
  const ui: TownUi = {
    engine: e, print: (t: string) => { if (t) said.push(t) }, inputNumber: async () => 0, view: async () => {}, refresh: () => {},
    // the temple menu: Heal, then the service, then Exit at both
    menu: async (items) => { step++; return step === 1 ? items.findIndex((x) => /^HEAL/i.test(x)) : step === 2 ? at : items.length - 1 },
  }
  await temple(ui)
  return { c, said: said.filter((l) => !/gp in coins/.test(l)), paid: money.some((v, i) => c[F.money + i] !== v), e }
}

describe.skipIf(!process.env.SOTSB || !existsSync(process.env.SOTSB))('Secret of the Silver Blades: the free temple', () => {
  afterAll(() => setGame(POR))
  it('Cure Blindness: "can see!" or "is not blind", no price asked or paid (0x225F6)', async () => {
    const blind = await freeCure('blind', (c, e) => { e.effectsOf(c).push({ type: 0x21, duration: 0, power: 0, flag: 0 } as never) })
    expect(blind.said.at(-1)).toMatch(/can see!$/)
    expect(blind.e.effectsOf(blind.c).some((x) => x.type === 0x21)).toBe(false)
    expect(blind.paid).toBe(false)
    expect((await freeCure('blind', () => {})).said.at(-1)).toMatch(/is not blind$/)
  })
  it('the cures: full HP needs nothing, the dead must be raised, elves cannot be raised (0x227E1, 0x22AA7)', async () => {
    expect((await freeCure('clw', (c) => { c[F.hp] = c[F.maxHp] })).said.at(-1)).toMatch(/has no need of healing$/)
    const dead = await freeCure('csw', (c) => { c[F.status] = 6; c[F.hp] = 0; c[F.inPlay] = 0 })
    expect(dead.said.at(-1)).toMatch(/must be raised from dead$/)
    expect(dead.c[F.status]).toBe(6)
    const elf = await freeCure('raise', (c) => { c[F.status] = 6; c[F.hp] = 0; c[F.inPlay] = 0; c[F.race] = 1 })
    expect(elf.said.at(-1)).toMatch(/cannot be raised$/)
    const human = await freeCure('raise', (c) => { c[F.status] = 6; c[F.hp] = 0; c[F.inPlay] = 0; c[F.race] = 6 })
    expect(human.said.at(-1)).toMatch(/is ressurected$/)
    expect([human.c[F.status], human.c[F.inPlay], human.c[F.hp]]).toEqual([0, 1, 1])
  })
  it('Stone to Flesh and Neutralize Poison (0x22F0B, 0x22D12)', async () => {
    const st = await freeCure('stone', (c) => { c[F.status] = 7; c[F.hp] = 0; c[F.inPlay] = 0 })
    expect(st.said.at(-1)).toMatch(/is turned to flesh$/)
    expect((await freeCure('poison', () => {})).said.at(-1)).toMatch(/is not poisoned$/)
  })
})
