// The computer's movement (spec/A-games/engine/combat-ai.md "Movement"): the base direction is the first
// of 0–7 whose cone holds the target (FUN_3aae_263d → FUN_56c1_057b, CotAB 0x5504A), and the step routine
// counts stalls (FUN_3334_07f2 0x23D27–0x23DD6, CotAB 0x23A91). Needs POOLRAD for the stall test.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, inCone, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, cellTable } from '../src/rules/battlefield'
import { POR, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'
import { loadFolder } from '../headless/harness'

const first = (dx: number, dy: number) => { for (let d = 0; d < 8; d++) if (inCone(20, 10, 20 + dx, 10 + dy, d)) return d; return -1 }

describe('the cone search', () => {
  it('takes the first direction whose cone from the next square holds the target', () => {
    expect(first(1, -3)).toBe(0) // north, where the signs would say north-east
    expect(first(2, 1)).toBe(2) // east, where the signs would say south-east
    expect(first(1, -1)).toBe(1)
    expect(first(0, 3)).toBe(4)
    expect(first(-3, 1)).toBe(5) // the south-west quadrant comes before west
    expect(first(-3, 0)).toBe(6)
    expect(first(-1, 1)).toBe(5)
    expect(first(0, 0)).toBe(0) // on the mover's own square
  })
  it('is false off the battlefield', () => {
    expect(inCone(20, 10, 50, 10, 2)).toBe(false)
    expect(inCone(20, 10, 20, 25, 4)).toBe(false)
  })
})

const por = process.env.POOLRAD ?? ''
describe.skipIf(!por || !existsSync(por))('stalls (FUN_3334_07f2)', () => {
  afterAll(() => setGame(POR))
  it('no direction working: a stall each call, p cycles, the target is sought again at 2, the movement ends at 3', async () => {
    setGame(POR)
    const files = loadFolder(POR, por)
    const e = new Engine(files, { print: () => {}, menu: async () => 0 } as unknown as Io, 1)
    const cells = cellTable(e.startImage!)
    const open = cells.findIndex((c, i) => i > 0 && c.move === 1), wall = cells.findIndex((c, i) => i > 0 && c.move === 0xff)
    const bf = new Battlefield(false)
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, open)
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) bf.set(10 + dy, 10 + dx, wall)
    const ui = { print: () => {}, redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi
    const b = new Battle(e, ui, bf, cells)
    const add = (x: number, y: number, side: number) => {
      const c = new Uint8Array(F.size)
      c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = 50; c[F.sizeFlags] = 1
      const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: side === 1, target: null }
      f.r[3] = 5; f.r[6] = 12
      b.fighters.push(f)
      return f
    }
    const me = add(10, 10, 1), foe = add(20, 10, 0)
    me.target = foe; me.r[0x15] = 6
    await b.aiStep(me, false)
    expect([me.x, me.y, me.r[0x15], me.r[6]]).toEqual([10, 10, 1, 12]) // 6 mod 6 + 1
    await b.aiStep(me, false)
    expect([me.r[0x15], me.target]).toEqual([2, foe]) // dropped, and found again
    await b.aiStep(me, false)
    expect([me.r[0x15], me.r[6], me.target]).toEqual([3, 0, null]) // the third: no movement left
  })
})
