// CotAB's spell handlers on a real battlefield (spec/coab/spells.md §2), each by its kind and the
// parameters in games/spellrules.ts; scripted dice (each roll takes the next value, else its count, so
// an unscripted d20 is a 1 and every save fails). Needs COAB (and POOLRAD for the PoR comparisons).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { addEffect, addRaw, fx } from '../src/rules/effects'
import { heal } from '../src/rules/camp'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'

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

/** an open field; `menu` answers the UI's menus in turn, `confirm` its yes/no questions */
function field(files: GameFiles) {
  const e = new Engine(files, io, 7)
  const dice: number[] = []
  e.roll = (n: number) => dice.length ? dice.shift()! : n
  const printed: string[] = []
  const menus: number[] = [], confirms: boolean[] = []
  const ui = {
    print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {},
    menu: async () => menus.shift() ?? 0, confirm: async () => confirms.shift() ?? false,
  } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
  const b = new Battle(e, ui, bf, cells)
  const add = (x: number, y: number, side: number, nm: string, opts: { size?: number; hp?: number; str?: number; hd?: number } = {}) => {
    const c = new Uint8Array(F.size)
    c[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
    c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = opts.hp ?? 100; c[F.sizeFlags] = opts.size ?? 1
    c[F.hitDice] = opts.hd ?? 1
    for (let i = 0; i < 6; i++) c[F.baseStat[i]] = c[F.stat[i]] = 10
    if (opts.str !== undefined) c[F.baseStat[0]] = c[F.stat[0]] = opts.str
    for (let i = 0; i < 5; i++) c[F.saves + i] = 15
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size: opts.size ?? 1, index: b.fighters.length, monster: side === 1, target: null }
    f.r[3] = 5
    b.fighters.push(f)
    return f
  }
  const hits: [string, number, boolean][] = []
  b.damageSync = (c: Uint8Array, dmg: number, _mode: number, saved: boolean) => { hits.push([b.name(c), dmg, saved]) }
  const cast = async (f: Fighter, id: number, L: number, targets: Fighter[], aim?: { x: number; y: number }) => {
    b.current_ = f
    b.aimed = aim ?? (targets[0] ? { x: targets[0].x, y: targets[0].y } : { x: f.x, y: f.y })
    fx.spell = id
    try { await b.applySpell(f, e.spells!.get(id)!, L, targets) } finally { fx.spell = 0 }
  }
  const has = (f: Fighter, type: number) => b.effectsOf(f.c).filter((x) => x.type === type)
  return { e, b, bf, add, hits, printed, dice, menus, confirms, cast, has }
}

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''
const haveCoab = !!coab && existsSync(coab)

describe.skipIf(!haveCoab)('CotAB spells done as parameters (6da4862)', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('Enlarge (12): 19–22 past level 6, 18/00 past 11, only over the base STR (0x45F75, 0x4C1D8)', async () => {
    const { add, cast, has, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 0, 'T', { str: 16 })
    await cast(mage, 12, 8, [t])
    expect(has(t, 0x0c).map((x) => [x.power, x.flag])).toEqual([[120, 1]]) // 20 + 100
    expect([t.c[F.stat[0]], t.c[F.baseStat[0]]]).toEqual([20, 16]) // worked out again, base untouched
    expect(printed).toContain('T is stronger')
    const u = add(7, 5, 0, 'U', { str: 16 })
    await cast(mage, 12, 13, [u])
    expect(has(u, 0x0c).map((x) => x.power)).toEqual([1]) // 18/00: % + 1
    expect([u.c[F.stat[0]], u.c[F.strPct]]).toEqual([18, 0])
    const strong = add(8, 5, 0, 'STRONG', { str: 20 })
    await cast(mage, 12, 8, [strong])
    expect(has(strong, 0x0c)).toEqual([])
    expect(printed).toContain('STRONG is unaffected')
  })

  it('Reduce (13): a failed save ends Enlarge without "is Cured"; STR from the base again', async () => {
    const { add, cast, has, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 1, 'T', { str: 16 })
    await cast(mage, 12, 8, [t])
    printed.length = 0
    await cast(mage, 13, 5, [t])
    expect(has(t, 0x0c)).toEqual([])
    expect(t.c[F.stat[0]]).toBe(16)
    expect(printed).toEqual(['T has been reduced'])
  })

  it('Friends (14): Apply with power 2d4 and flag 1, CHA worked out from the base (no cap)', async () => {
    const { add, cast, has, dice } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    mage.c[F.baseStat[5]] = 18
    dice.push(8)
    await cast(mage, 14, 3, [mage])
    expect(has(mage, 0x0e).map((x) => [x.power, x.flag])).toEqual([[8, 1]])
    expect(mage.c[F.stat[5]]).toBe(26)
  })

  it('Magic Missile (15): (L + 1) div 2 missiles of d4 + 1', async () => {
    const { add, cast, hits, dice } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const orc = add(9, 5, 1, 'ORC')
    dice.push(7) // 3d4
    await cast(mage, 15, 5, [orc])
    expect(hits).toEqual([['ORC', 10, false]])
    expect(fx.dice).toBe(3)
    hits.length = 0
    await cast(mage, 15, 1, [orc]) // level 1: one missile (PoR's L div 2 gives none)
    expect(hits).toEqual([['ORC', 2, false]])
  })

  it('Mirror Image (32): power (1d4 << 4) | L through Apply, "is duplicated"', async () => {
    const { e, add, cast, has, dice, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    dice.push(3)
    await cast(mage, 32, 5, [mage])
    expect(has(mage, e.spells!.get(32)!.effect).map((x) => x.power)).toEqual([0x35])
    expect(printed).toContain('MAGE is duplicated')
  })

  it('adding an effect takes out a timed record of its type whatever the new duration (0x4CD91)', async () => {
    const { b, add } = cotab()
    const t = add(5, 5, 0, 'T')
    addRaw(b, t.c, 0x07, 10, 1, 0)
    await addEffect(b, t.c, 0x07, 2, 2, 0)
    expect(b.effectsOf(t.c).map((x) => [x.duration, x.power])).toEqual([[2, 2]])
    const u = add(6, 5, 0, 'U')
    addRaw(b, u.c, 0x07, 0, 1, 0) // a permanent record stays beside the new one
    await addEffect(b, u.c, 0x07, 3, 2, 0)
    expect(b.effectsOf(u.c).map((x) => x.duration)).toEqual([0, 3])
  })

  it('healing is not blocked by 0x32, which is the Hot Fire Shield here (0x4CE85)', () => {
    setGame(COAB)
    const c = new Uint8Array(F.size)
    c[F.maxHp] = 20; c[F.hp] = 5
    expect(heal(c, [{ type: 0x32, duration: 5, power: 0, flag: 0 }], 4, false, true)).toBe(true)
    expect(c[F.hp]).toBe(9)
    setGame(POR)
    c[F.hp] = 5
    expect(heal(c, [{ type: 0x32, duration: 5, power: 0, flag: 0 }], 4, false, true)).toBe(false) // PoR's mummy rot
  })
})

describe.skipIf(!por || !existsSync(por))('PoR keeps its own rules', () => {
  const files = por && existsSync(por) ? load(por, POR) : null
  it('adds beside a longer timed record and replaces only for a longer or permanent new one', async () => {
    setGame(POR)
    const { b, add } = field(files!)
    const t = add(5, 5, 0, 'T')
    addRaw(b, t.c, 0x07, 10, 1, 0)
    await addEffect(b, t.c, 0x07, 2, 2, 0)
    expect(b.effectsOf(t.c).map((x) => x.duration)).toEqual([10, 2])
    await addEffect(b, t.c, 0x07, 20, 3, 0)
    expect(b.effectsOf(t.c).map((x) => x.duration)).toEqual([2, 20])
  })
})
