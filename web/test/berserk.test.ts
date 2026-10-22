// CotAB's berserk search (0x553D8, sorted by 0x54B33): the nearest combatant the berserker sees, ties
// by the lower direction (of no greater parity); Battle.nearestInSight. Needs COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { COAB, POR, setGame, wants } from '../src/games/profile'
import { F } from '../src/games/fields'

const OPEN = 1, WALL = 2
const cells: CellInfo[] = Array.from({ length: 0x42 }, (_, i) => ({ move: i === WALL ? 0xff : 1, sight: i === WALL ? 2 : 0, image: 0 }))
const coab = process.env.COAB ?? ''

describe.skipIf(!coab || !existsSync(coab))('the berserk search', () => {
  afterAll(() => setGame(POR))
  const field = () => {
    setGame(COAB)
    const m = new Map<string, Uint8Array>()
    const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(COAB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
    walk(coab)
    const e = new Engine(new GameFiles(m, COAB), { print: () => {}, menu: async () => 0 } as unknown as Io, 7)
    const bf = new Battlefield(false)
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
    const b = new Battle(e, { print: () => {}, redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi, bf, cells)
    const add = (x: number, y: number) => {
      const c = new Uint8Array(F.size)
      c[F.inPlay] = 1; c[F.hp] = c[F.maxHp] = 10; c[F.sizeFlags] = 1
      const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: true, target: null }
      b.fighters.push(f)
      return f
    }
    return { b, bf, add }
  }
  it('skips a nearer combatant behind a wall', () => {
    const { b, bf, add } = field()
    const me = add(5, 5), hidden = add(8, 5), seen = add(5, 9)
    bf.set(5, 6, WALL)
    expect(b.dist(me, hidden)).toBeLessThan(b.dist(me, seen))
    expect(b.nearestInSight(me.c)).toBe(seen.c)
  })
  it('of two as near, takes the lower direction (north before east)', () => {
    const { b, add } = field()
    const me = add(5, 5), east = add(7, 5), north = add(5, 3)
    expect(b.dist(me, east)).toBe(b.dist(me, north))
    expect(b.nearestInSight(me.c)).toBe(north.c)
  })
})
