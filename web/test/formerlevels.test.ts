// Where a dual-class character's former levels count in combat and at doors (spec/A-games/coab/combat.md
// "The former class in battle", spec/A-games/coab/chargen-and-progression.md §2), and each game's
// backstab (R.backstab: PoR FUN_3aae_2574, CotAB 0x2CE27). Scripted dice. Needs COAB and POOLRAD.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, backstabFactor, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { Item } from '../src/data/items'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { recalc } from '../src/rules/equip'

const OPEN = 1
const cells: CellInfo[] = Array.from({ length: 0x42 }, () => ({ move: 1, sight: 0, image: 0 }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

function field(files: GameFiles) {
  const e = new Engine(files, io, 7)
  const dice: number[] = []
  e.roll = (n: number) => dice.length ? dice.shift()! : n
  const printed: string[] = []
  const ui = { print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {}, menu: async () => 0, confirm: async () => false } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
  const b = new Battle(e, ui, bf, cells)
  const add = (x: number, y: number, side: number, size = 1) => {
    const c = new Uint8Array(F.size)
    c[F.name] = 1; c[F.name + 1] = 65 + b.fighters.length
    c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = 50; c[F.sizeFlags] = size; c[F.race] = 7
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: side === 1, target: null }
    b.fighters.push(f)
    return f
  }
  return { e, b, add, dice, printed }
}

/** a thief behind a target that two others have engaged (R[0xF] = 2), facing away from it */
function setUp(files: GameFiles) {
  const x = field(files)
  const t = x.add(5, 5, 1), a = x.add(4, 5, 0)
  t.r[0xf] = 2
  t.r[9] = x.b.dirTo(a, t)
  a.c[F.levels + 6] = 4
  return { ...x, t, a }
}
const armour = (type: number) => { const r = new Uint8Array(63); r[0x2e] = type; r[0x34] = 1; return new Item(r) }

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''

describe.skipIf(!por || !existsSync(por) || !coab || !existsSync(coab))('the backstab by game', () => {
  afterAll(() => setGame(POR))

  it('PoR: leather armour only, any size of target, × level div 4 + 2', () => {
    const files = load(por, POR)
    const { b, a, t, e } = setUp(files)
    expect(b.backstab(a, t)).toBe(true)
    const plate = armour(e.items!.base.findIndex((x, i) => x.slot === 2 && i !== 50))
    e.itemsOf(a.c).push(plate)
    expect(b.backstab(a, t)).toBe(false)
    t.c[F.sizeFlags] = 2
    e.itemsOf(a.c).length = 0
    expect(b.backstab(a, t)).toBe(true)
    expect([1, 3, 4, 7, 8].map((L) => { a.c[F.levels + 6] = L; return backstabFactor(a.c) })).toEqual([2, 2, 3, 3, 4])
  })

  it('CotAB: any armour, not a large target, × (level − 1) div 4 + 2, a former thief once it counts', () => {
    const files = load(coab, COAB)
    const { b, a, t, e } = setUp(files)
    e.itemsOf(a.c).push(armour(e.items!.base.findIndex((x, i) => x.slot === 2 && i !== 50)))
    expect(b.backstab(a, t)).toBe(true)
    t.c[F.sizeFlags] = 2
    expect(b.backstab(a, t)).toBe(false)
    t.c[F.sizeFlags] = 1
    expect([1, 4, 5, 8, 9].map((L) => { a.c[F.levels + 6] = L; return backstabFactor(a.c) })).toEqual([2, 2, 3, 3, 4])
    // a thief 6 who became a fighter: nothing until the fighter passes 6, then the thief's 6
    a.c[F.levels + 6] = 0; a.c[F.prevLevels + 6] = 6; a.c[F.hpLevel] = 6; a.c[F.levels + 2] = 6
    expect(b.backstab(a, t)).toBe(false)
    a.c[F.levels + 2] = 7
    expect(b.backstab(a, t)).toBe(true)
    expect(backstabFactor(a.c)).toBe(3)
  })

  it('CotAB: a former fighter sweeps at the fighter level once it counts; a former cleric turns at its old band', async () => {
    const files = load(coab, COAB)
    const { b, a, e, add, printed, dice } = setUp(files)
    const c = a.c
    c[F.levels + 6] = 0; c[F.prevLevels + 2] = 5; c[F.hpLevel] = 5; c[F.levels + 0] = 5
    recalc(c, e.itemsOf(c), e.items!)
    expect(c[F.sweep]).toBe(1)
    c[F.levels + 0] = 6
    recalc(c, e.itemsOf(c), e.items!)
    expect(c[F.sweep]).toBe(5)
    // a cleric 5 turned magic-user: at magic-user 6 the cleric counts, but the column is the current
    // cleric level, 0, which reads before the table: nothing is turned
    const d = add(9, 9, 0)
    d.c[F.prevLevels + 0] = 5; d.c[F.hpLevel] = 5; d.c[F.levels + 5] = 6
    const z = add(10, 9, 1); z.c[F.undead] = 1
    dice.push(12, 20)
    printed.length = 0
    await b.turnUndead(d)
    expect(z.r[0x10]).toBe(0)
    expect(printed.at(-1)).toMatch(/nothing/i)
  })
})
