// Movement costs on the battlefield (spec/B-model/procedures.md §15.5): a step costs the cell's move byte
// × 3 diagonally, × 2 straight; what is compared with the movement left and what a short step does are
// each game's (R.battleMove). Needs POOLRAD and COAB (their START.EXE cell tables).
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, cellTable } from '../src/rules/battlefield'
import { COAB, POR, setGame, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { loadFolder } from '../headless/harness'
import { msg } from '../src/games/strings'

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''
const have = !!por && existsSync(por) && !!coab && existsSync(coab)

/** an open field of `ground` cells, the game's own cell table; a fighter of 12 half-squares at (10, 10) */
function field(g: GameProfile, dir: string, ground: number) {
  setGame(g)
  const files = loadFolder(g, dir)
  const e = new Engine(files, { print: () => {}, menu: async () => 0 } as unknown as Io, 1)
  const printed: string[] = []
  const ui = { print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {}, confirm: async () => false } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, ground)
  const b = new Battle(e, ui, bf, cellTable(e.startImage!))
  const add = (x: number, y: number, side: number) => {
    const c = new Uint8Array(F.size)
    c[F.name] = 1; c[F.name + 1] = 65 + b.fighters.length
    c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = 50; c[F.sizeFlags] = 1; c[F.hitDice] = 1
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: side === 1, target: null }
    f.r[3] = 5; f.r[6] = 12
    b.fighters.push(f)
    return f
  }
  const me = add(10, 10, 0)
  return { b, bf, me, add, printed }
}

describe.skipIf(!have)('battlefield movement costs', () => {
  afterAll(() => setGame(POR))
  const ROCK = 0x32, WATER = 0x3c, GRASS = 0x36 // CotAB: byte 0 = 2, 4, 1 (spec/A-games/coab/combat.md, "Cell table")

  it('CotAB: a cell costs its byte × 2 straight, × 3 diagonally', async () => {
    const { b, bf, me } = field(COAB, coab, GRASS)
    bf.set(10, 11, ROCK); bf.set(9, 11, WATER)
    expect([b.stepCost(11, 10, 2), b.stepCost(11, 10, 3), b.stepCost(11, 9, 1), b.stepCost(9, 10, 6), b.stepCost(9, 9, 7)]).toEqual([4, 6, 12, 2, 3])
    await b.moveStep(me, 2) // east onto the rock
    expect([me.x, me.y, me.r[6]]).toEqual([11, 10, 8])
  })

  it('CotAB: Move says Blocked when the step costs more than is left (0x22B2C)', async () => {
    const { b, bf, me, printed } = field(COAB, coab, GRASS)
    bf.set(10, 11, ROCK)
    me.r[6] = 3
    await b.moveStep(me, 2)
    expect(printed).toContain(msg('blocked')) // CotAB's own words for it
    expect([me.x, me.y, me.r[6]]).toEqual([10, 10, 3])
  })

  it('CotAB: the step routine moves even when short, taking the rest (0x2AD78)', async () => {
    const { b, bf, me } = field(COAB, coab, GRASS)
    bf.set(10, 11, ROCK)
    me.r[6] = 3
    await b.stepF(me, 2)
    expect([me.x, me.y, me.r[6]]).toEqual([11, 10, 0])
  })

  it('CotAB: the computer refuses a step costing as much as is left and tries the next direction (0x238DA)', async () => {
    const { b, bf, me, add } = field(COAB, coab, GRASS)
    const foe = add(14, 10, 1)
    me.target = foe
    bf.set(10, 11, ROCK) // east costs 4
    me.r[6] = 4
    await b.aiStep(me, false)
    expect([me.x, me.y, me.r[6]]).toEqual([11, 9, 1]) // preference 1: ahead, then −45° (north-east, 3)
  })

  it('PoR: every cell is 1 or blocked, so a step is 2 or 3; a short diagonal is lost on the spot', async () => {
    const { b, me, printed } = field(POR, por, 0x17)
    const t = cellTable((b as unknown as { e: Engine }).e.startImage!)
    expect(new Set(t.map((c) => c.move))).toEqual(new Set([1, 0xff]))
    expect([b.stepCost(11, 10, 2), b.stepCost(11, 11, 3)]).toEqual([2, 3])
    me.r[6] = 2
    await b.moveStep(me, 3) // FUN_320c_09df compares the byte (1), FUN_3aae_0712 the cost (3)
    expect(printed).not.toContain(msg('blocked'))
    expect([me.x, me.y, me.r[6]]).toEqual([10, 10, 0])
  })

  it('PoR: the computer tries the next direction when a diagonal costs more than is left (FUN_3334_0675)', async () => {
    const { b, me, add } = field(POR, por, 0x17)
    me.target = add(12, 8, 1) // north-east
    me.r[6] = 2
    await b.aiStep(me, false)
    expect([me.x, me.y, me.r[6]]).toEqual([10, 9, 0]) // preference 1: ahead (NE, 3), then −45° (N, 2)
  })
})
