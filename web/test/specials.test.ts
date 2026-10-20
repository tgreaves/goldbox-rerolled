// The monster specials of effect event 14 on a real battlefield (rules/specials.ts): PoR's breath bolt
// (88, FUN_4e53_30d9) and CotAB's eye rays (87), area breaths (90, 128), thrown lightning (132), the
// hooked gaze (83) and its bolt routines (0x478F6 / 0x479B4); scripted dice. Needs POOLRAD and COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { addRaw, fire, fx } from '../src/rules/effects'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { T } from '../src/games/tables'
import { Tables } from '../src/rules/chargen'
import { unexepack } from '../src/data/exepack'

const OPEN = 1, WALL = 2
const cells: CellInfo[] = Array.from({ length: 0x42 }, (_, i) => ({ move: i === WALL ? 0xff : 1, sight: i === WALL ? 2 : 0, image: 0 }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

/** an open field; each die takes the next scripted value (else its minimum, a total of `count`) */
function field(files: GameFiles) {
  const e = new Engine(files, io, 7)
  const dice: number[] = []
  e.roll = (n: number) => dice.length ? dice.shift()! : n
  const printed: string[] = []
  const ui = { print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
  const b = new Battle(e, ui, bf, cells)
  const add = (x: number, y: number, side: number, nm: string, size = 1, hp = 100) => {
    const c = new Uint8Array(F.size)
    c[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
    c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = hp; c[F.sizeFlags] = size
    for (let i = 0; i < 5; i++) c[F.saves + i] = 15
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size, index: b.fighters.length, monster: side === 1, target: null }
    f.r[3] = 5
    b.fighters.push(f)
    return f
  }
  const hits: [string, number, boolean][] = []
  b.damageSync = (c: Uint8Array, dmg: number, _mode: number, saved: boolean) => { hits.push([b.name(c), dmg, saved]) }
  /** the special's turn: event 14 for f */
  const turn = async (f: Fighter, round = 0) => { b.current_ = f; fx.round = round; await fire(b, f.c, 14) }
  return { e, b, bf, add, hits, printed, dice, turn }
}

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''

describe.skipIf(!por || !existsSync(por))('PoR breath bolt (88)', () => {
  const files = por && existsSync(por) ? load(por, POR) : null

  it('breathes from the square past its own 2×2 footprint, max HP, three times', async () => {
    setGame(POR)
    const { b, add, hits, printed, dice, turn } = field(files!)
    const dragon = add(10, 10, 1, 'TYRANITHRAXUS', 4, 80)
    add(12, 10, 0, 'A')
    add(14, 10, 0, 'B')
    const eff = addRaw(b, dragon.c, 88, 0, 0xff, 0)
    dice.push(1, 2, 20) // the hook's pick (A, the nearest), A fails its save, B rolls a natural 20
    await turn(dragon)
    expect(printed[0]).toBe('TYRANITHRAXUS Breathes!')
    expect(hits).toEqual([['A', 80, false], ['B', 80, true]])
    expect(b.aimed).toEqual({ x: 12, y: 10 })
    expect(eff.power).toBe(0xfe)
    expect(dragon.r[3]).toBe(0) // the turn ends
    await turn(dragon)
    expect(eff.power).toBe(0xfd)
    await turn(dragon)
    expect(b.effectsOf(dragon.c).some((x) => x.type === 88)).toBe(false) // the third breath removes it
  })

  it('after round 0 breathes only on d100 above 50', async () => {
    setGame(POR)
    const { b, add, hits, dice, turn } = field(files!)
    const dragon = add(10, 10, 1, 'TYRANITHRAXUS', 4, 80)
    add(12, 10, 0, 'A')
    const eff = addRaw(b, dragon.c, 88, 0, 0xff, 0)
    dice.push(50)
    await turn(dragon, 3)
    expect(hits).toEqual([])
    expect(eff.power).toBe(0xff)
  })
})

describe.skipIf(!coab || !existsSync(coab))('CotAB monster specials', () => {
  const files = coab && existsSync(coab) ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('reads the template offsets from START.EXE', () => {
    setGame(COAB)
    const t = new Tables(unexepack(files!.get('START.EXE')!).image)
    const row = (at: number) => Array.from({ length: 8 }, (_, i) => (t.b(at + i) << 24) >> 24)
    expect(row(T.fanDx1.at)).toEqual([1, 1, 0, 0, -1, -1, 0, 0])
    expect(row(T.fanDy1.at)).toEqual([0, 0, 1, 1, 0, 0, -1, -1])
    expect(row(T.fanDx2.at)).toEqual([-1, 0, 0, 1, 1, 0, 0, -1])
    expect(row(T.fanDy2.at)).toEqual([0, -1, -1, 0, 0, 1, 1, 0])
  })

  it('Lightning Bolt: 7 squares; bounces only in a map area; skips the creature it just hit', async () => {
    const run = async (indoors: number) => {
      const { e, b, bf, add, hits } = cotab()
      e.write(0x49e6, indoors)
      const caster = add(2, 5, 0, 'MAGE')
      add(5, 5, 1, 'ORC')
      add(9, 5, 1, 'X')
      bf.set(5, 7, WALL)
      b.aimed = { x: 5, y: 5 }
      await b.applySpell(caster, e.spells!.get(51)!, 5, [])
      return hits.map((h) => h[0])
    }
    // back off the wall: the orc again, then the caster; the bolt ends when the cost since the last
    // stop wraps below zero
    expect(await run(1)).toEqual(['ORC', 'ORC', 'MAGE'])
    expect(await run(0)).toEqual(['ORC', 'X']) // outdoors it runs on through the wall
  })

  it('132 throws lightning in rounds 0–3: two 16d6 rolls, the aimed square first', async () => {
    const { b, add, hits, printed, dice, turn } = cotab()
    const tyr = add(10, 10, 1, 'TYRANTHRAXUS', 4, 100)
    add(14, 10, 0, 'A')
    add(16, 10, 0, 'B')
    addRaw(b, tyr.c, 132, 0, 0xff, 0)
    dice.push(1, 50, 2, 40, 2) // pick A; 16d6 = 50 on A (fails); 16d6 = 40 down the bolt, B fails
    await turn(tyr)
    expect(printed[0]).toBe('TYRANTHRAXUS throws lightning')
    expect(hits).toEqual([['A', 50, false], ['B', 40, false]])
    expect(tyr.r[3]).toBe(0)
    hits.length = 0
    tyr.r[3] = 5
    await turn(tyr, 4)
    expect(hits).toEqual([])
  })

  it('90 acid breath: a line of 6 squares, 3 uses from round 0, held back with its own side in it', async () => {
    const { b, add, hits, printed, dice, turn } = cotab()
    const dragon = add(10, 10, 1, 'BLACK DRAGON', 1, 48)
    add(12, 10, 0, 'A')
    add(15, 10, 0, 'B')
    add(18, 10, 0, 'C') // past 6 squares
    const eff = addRaw(b, dragon.c, 90, 0, 0xff, 0)
    dice.push(1, 2, 2) // pick A (B is in range too), both fail
    await turn(dragon)
    expect(printed[0]).toBe('BLACK DRAGON breathes acid')
    expect(hits).toEqual([['A', 48, false], ['B', 48, false]])
    expect(eff.power).toBe(2)
    await turn(dragon, 1)
    await turn(dragon, 2)
    expect(eff.power).toBe(0)
    hits.length = 0
    await turn(dragon, 3)
    expect(hits).toEqual([]) // none left
    // an ally in the line: no breath, no use spent
    const g = cotab()
    const d2 = g.add(10, 10, 1, 'BLACK DRAGON', 1, 48)
    g.add(12, 10, 0, 'A')
    g.add(14, 10, 1, 'KOBOLD')
    const e2 = addRaw(g.b, d2.c, 90, 0, 0xff, 0)
    await g.turn(d2)
    expect(g.hits).toEqual([])
    expect(e2.power).toBe(3)
    expect(d2.r[3]).toBe(5)
  })

  it('128 fire breath: three lines of 9 squares, the side lines by the direction onto the last creature', async () => {
    const { b, add, hits, printed, turn } = cotab()
    const lich = add(10, 10, 1, 'DRACOLICH', 1, 66)
    add(13, 10, 0, 'A')
    add(17, 11, 0, 'B') // on the line to (19, 11)
    add(17, 9, 0, 'C') // on the line to (19, 9)
    add(17, 12, 0, 'D') // on none
    add(15, 10, 1, 'FRIEND') // no own-side check
    addRaw(b, lich.c, 128, 0, 0xff, 0)
    await turn(lich) // the only enemy within 6 is A; every save rolls 1 and fails
    expect(printed[0]).toBe('DRACOLICH breathes fire')
    expect(hits.map((h) => h[0])).toEqual(['A', 'FRIEND', 'B', 'C'])
    expect(fx.dmgType).toBe(0x21)
  })

  it('87 eye rays: disintegrate, stone, death and wounding by distance, each once, a new target after each', async () => {
    const { b, add, hits, printed, dice, turn } = cotab()
    const eye = add(10, 10, 1, 'BEHOLDER', 1, 75)
    const t = add(12, 10, 0, 'T') // 2 squares
    const u = add(10, 13, 0, 'U') // 3
    const v = add(5, 10, 0, 'V') // 5
    addRaw(b, eye.c, 87, 0, 0xff, 0)
    // finder: T; T fails; finder: U; U saves (20); U fails the death ray; finder: V; 2d8 = 10
    dice.push(1, 2, 1, 20, 2, 1, 10)
    await turn(eye)
    expect(printed).toEqual(['BEHOLDER fires a disintegrate ray', 'T is disintergrated', 'BEHOLDER fires a stone to flesh ray',
      'BEHOLDER fires a death ray', 'U is killed', 'BEHOLDER wounds you'])
    expect([t.c[F.status], u.c[F.status]]).toEqual([8, 6])
    expect(hits).toEqual([['V', 11, false]])
    expect(b.targetOf(eye.c)).toBe(v.c)
  })

  it('83 gaze: the hook picks a target in range, not the current one', async () => {
    const { b, add, printed, dice, turn } = cotab()
    const medusa = add(10, 10, 1, 'HOODED MEDUSA')
    const far = add(30, 10, 0, 'FAR')
    const near = add(12, 10, 0, 'NEAR')
    medusa.target = far
    addRaw(b, medusa.c, 83, 0, 0xff, 0)
    dice.push(1, 2) // the only one within 12 squares; it fails
    await turn(medusa)
    expect(printed).toEqual(['HOODED MEDUSA gazes...', 'NEAR is Stoned'])
    expect(near.c[F.status]).toBe(7)
    expect(b.targetOf(medusa.c)).toBe(near.c)
  })
})
