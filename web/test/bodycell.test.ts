// The cell marking a fallen combatant's square (R.bodyCell): PoR's and CotAB's 0x1F whatever the status;
// SotSB's 0x1C for status 7, else 0x1E (the fall 0x5CE5B), not on its gas cell 0x1D; a zone lifting off a
// body puts back the mark by the zone owner's status in SotSB (0x2E334, a bug), the body's elsewhere.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { POR, SOTSB, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'

const cells: CellInfo[] = Array.from({ length: 0x42 }, () => ({ move: 1, sight: 0, image: 0 }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io
const OPEN = 1

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

function field(files: GameFiles) {
  const e = new Engine(files, io, 7)
  const ui = { print: () => {}, redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
  const b = new Battle(e, ui, bf, cells)
  const add = (x: number, y: number) => {
    const c = new Uint8Array(F.size)
    c[F.inPlay] = 1; c[F.side] = 1; c[F.hp] = c[F.maxHp] = 10; c[F.sizeFlags] = 1
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: true, target: null }
    b.fighters.push(f)
    return f
  }
  return { b, bf, add }
}
/** f goes down with `status`: the cell its square is left with */
const fall = (b: Battle, bf: Battlefield, f: Fighter, status: number) => { f.c[F.status] = status; f.c[F.inPlay] = 0; b.downF(f); return bf.get(f.y, f.x) }

const por = process.env.POOLRAD ?? '', sotsb = process.env.SOTSB ?? ''

describe('body cells', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!por || !existsSync(por))('PoR: 0x1F whatever the status', () => {
    const files = load(por, POR)
    const { b, bf, add } = field(files)
    expect(fall(b, bf, add(3, 3), 6)).toBe(0x1f)
    expect(fall(b, bf, add(5, 3), 7)).toBe(0x1f)
  })
  it.skipIf(!sotsb || !existsSync(sotsb))('SotSB: 0x1C stoned, else 0x1E; none on the gas cell; a lift marks by the owner', () => {
    const files = load(sotsb, SOTSB)
    const { b, bf, add } = field(files)
    expect(fall(b, bf, add(3, 3), 6)).toBe(0x1e)
    expect(fall(b, bf, add(5, 3), 7)).toBe(0x1c)
    bf.set(7, 3, 0x1d)
    expect(fall(b, bf, add(3, 7), 6)).toBe(0x1d)
    // a gas zone over the dead body at (3, 3), its owner stoned: the lift writes the stoned mark
    const owner = add(9, 9)
    owner.c[F.status] = 7
    b.clouds.push({ owner: owner.c, n: 0, cell: 0x1d, x: 3, y: 3, cells: [{ x: 3, y: 3, old: 0x1e, laid: true }], resisted: false })
    bf.set(3, 3, 0x1d)
    expect(b.clearCloud(owner.c, 0, 0x1d)).toBe(true)
    expect(bf.get(3, 3)).toBe(0x1c)
  })
})
