// The camp's Fix (CotAB 0x320D8, spec/A-games/coab/camp.md §1; PoR: the same procedure, IMP-048), with
// scripted dice. Needs COAB (and POOLRAD for Pool of Radiance's camp).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { CLOCK, fix, memorised } from '../src/rules/camp'
import { parseSave } from '../src/data/save'

const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
  picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

const coab = process.env.COAB ?? '', por = process.env.POOLRAD ?? ''
/** minutes on the game clock (minute, ten-minutes, hour, day words) */
const minutes = (e: Engine) => e.read(CLOCK + 1) + 10 * e.read(CLOCK + 2) + 60 * e.read(CLOCK + 3) + 1440 * e.read(CLOCK + 4)

describe.skipIf(!coab || !existsSync(coab))('CotAB Fix (0x320D8)', () => {
  afterAll(() => setGame(POR))
  /** the shipped party, everyone Okay and unhurt, no cleric slots or spells; `dice` answers each roll in turn */
  const party = () => {
    const files = load(coab, COAB)
    const e = new Engine(files, io, 1)
    e.newGame([1, 2, 3, 4, 5, 6].map((n) => files.get(`CHRDATA${n}.SAV`)!))
    e.write(0x6dd2, 0) // no encounters while resting
    for (const c of e.party()) {
      c[F.status] = 0; c[F.hp] = c[F.maxHp]
      for (let l = 0; l < 5; l++) c[F.clericSlots + l] = 0
      for (let k = 0; k < F.memorisedCount; k++) c[F.memorised + k] = 0
    }
    const dice: number[] = [], rolled: [number, number][] = []
    e.roll = (n: number, s: number) => { rolled.push([n, s]); return dice.shift() ?? 1 }
    return { e, dice, rolled }
  }

  it('does nothing without wounds', async () => {
    const { e, rolled } = party()
    const t0 = minutes(e)
    expect(await fix(e, { heal: 0 })).toEqual({ messages: [], interrupted: false })
    expect([minutes(e), rolled.length]).toEqual([t0, 0])
  })

  it('rolls the memorised cures, rests for the slots (shortened by the estimate), rolls a cure per slot and shares it out', async () => {
    const { e, dice, rolled } = party()
    const [hurt, cleric] = e.party()
    hurt[F.hp] = hurt[F.maxHp] - 10
    cleric[F.clericSlots] = 2 // two first-level slots
    cleric[F.memorised] = 3 // Cure Light Wounds, memorised
    dice.push(4, 3, 5) // the memorised cure, then one per slot
    const t0 = minutes(e)
    const r = await fix(e, { heal: 0 })
    expect(r.interrupted).toBe(false)
    // wounds 10 < estimate 14 + 27 → the rest (240 + 2 × 15 minutes) divided by 41 div 10 = 4: 67 minutes,
    // rested in 5-minute steps (14 steps)
    expect(minutes(e) - t0).toBe(70)
    expect(rolled).toEqual([[1, 8], [1, 8], [1, 8]])
    expect(hurt[F.hp]).toBe(hurt[F.maxHp]) // 12 in the pool, 10 needed
    expect(memorised(cleric)[0]).toBe(3) // the cure is not used up
  })

  it('counts Cure Serious (2d8+1, level 4) and Cure Critical (3d8+3, level 5); the pool runs out in party order', async () => {
    const { e, dice, rolled } = party()
    const [a, b, cleric] = e.party()
    a[F.hp] = a[F.maxHp] - 30; b[F.hp] = b[F.maxHp] - 30
    cleric[F.clericSlots + 3] = 1; cleric[F.clericSlots + 4] = 1
    cleric[F.memorised] = 58; cleric[F.memorised + 1] = 71
    dice.push(10, 20, 9, 13)
    const t0 = minutes(e)
    await fix(e, { heal: 0 })
    // wounds 60 < estimate 14 + 78, but 92 div 60 = 1: the full rest, 360 + 60 + 75 minutes (99 steps)
    expect(minutes(e) - t0).toBe(495)
    expect(rolled).toEqual([[2, 8], [3, 8], [2, 8], [3, 8]])
    // pool (10 + 1) + (20 + 3) + (9 + 1) + (13 + 3) = 60: both healed in full
    expect([a[F.maxHp] - a[F.hp], b[F.maxHp] - b[F.hp]]).toEqual([0, 0])
  })
})

describe.skipIf(!por || !existsSync(por))('Pool of Radiance Fix (IMP-048)', () => {
  it('is offered as the port\'s word and heals with the clerics\' cures, which stay memorised', async () => {
    const files = load(por, POR)
    const { camp } = await import('../src/ui/camp')
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 2)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
    e.write(0x6dd2, 0)
    for (const c of e.party()) c[F.hp] = Math.max(1, c[F.maxHp] - 4)
    const spells = e.party().map(memorised)
    const shown: string[][] = []
    const ui = {
      engine: e, print: () => {}, refresh: () => {}, pause: async () => {},
      menu: async (items: string[]) => { shown.push(items); return shown.length === 1 ? items.indexOf('FIX') : items.indexOf('EXIT') },
      view: async () => {}, save: async () => {}, stopper: () => ({ stopped: () => false, done: () => {} }),
    }
    await camp(ui as never)
    expect(shown[0]).toEqual(['SAVE', 'VIEW', 'MAGIC', 'REST', 'ALTER', 'FIX', 'EXIT'])
    expect(e.party().every((c) => c[F.hp] === c[F.maxHp])).toBe(true)
    expect(e.party().map(memorised)).toEqual(spells)
  })
})
