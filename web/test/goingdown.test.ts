// A combatant that goes down loses the first record of each type of its game's list, in order (PoR
// FUN_5216_100a, CotAB 0x4C05B; games/effectrules.ts `goingDown`), and in CotAB a berserk NPC goes
// back to the party's side (0x4F395, `downRejoins`). Needs POOLRAD and COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { addRaw } from '../src/rules/effects'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'

const cells: CellInfo[] = Array.from({ length: 0x42 }, () => ({ move: 1, sight: 0, image: 0 }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

/** a battle with one combatant of `side` holding `types` (each a timed record) */
function battle(files: GameFiles, side: number, types: number[], morale = 0) {
  const e = new Engine(files, io, 7)
  const ui = { print: () => {}, redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, 1)
  const b = new Battle(e, ui, bf, cells)
  const c = new Uint8Array(F.size)
  c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = 10; c[F.morale] = morale; c[F.sizeFlags] = 1
  const f: Fighter = { c, r: new Uint8Array(22), x: 5, y: 5, size: 1, index: 0, monster: side === 1, target: null }
  b.fighters.push(f)
  for (const t of types) addRaw(b, c, t, 10, 0xff, 0)
  return { b, f, c, left: () => b.effectsOf(c).map((x) => x.type) }
}

/** the same, then 50 damage */
function downed(files: GameFiles, side: number, types: number[], morale = 0) {
  const { b, f, c, left } = battle(files, side, types, morale)
  b.inflict(f, 50)
  return { left: left(), c }
}

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''

describe.skipIf(!por || !existsSync(por))('PoR: going down (FUN_5216_100a)', () => {
  it('takes the first record of each listed type; others stay', () => {
    const files = load(por, POR)
    const { left, c } = downed(files, 1, [74, 54, 54, 13, 75])
    expect(c[F.status]).toBe(6)
    expect(left).toEqual([54, 13]) // one 54 of two; 13 is not in PoR's list
  })

  it('the morale check (FUN_3334_10d7) first takes off the first 74 (grab) and 75 (blood drain)', async () => {
    const files = load(por, POR)
    const { b, f, left } = battle(files, 0, [74, 13, 75, 74])
    await b.morale(f)
    expect(left()).toEqual([13, 74])
  })
})

describe.skipIf(!coab || !existsSync(coab))('CotAB: going down (0x4C05B)', () => {
  afterAll(() => setGame(POR))

  it('takes its own list: 13, 139 and 144 go, 54, 74 and 75 stay', () => {
    const files = load(coab, COAB)
    const { left } = downed(files, 1, [13, 54, 74, 75, 139, 144])
    expect(left).toEqual([54, 74, 75])
  })

  it('the morale check (0x2443F) first takes off 13, 58, 139 and 144', async () => {
    const files = load(coab, COAB)
    const { b, f, left } = battle(files, 0, [13, 74, 58, 139, 144, 75])
    await b.morale(f)
    expect(left()).toEqual([74, 75])
  })

  it('a berserk NPC (77, morale 0xB3) goes back to side 0; another morale does not', () => {
    const files = load(coab, COAB)
    expect(downed(files, 1, [77], 0xb3).c[F.side]).toBe(0)
    expect(downed(files, 1, [77], 0x33).c[F.side]).toBe(1)
    expect(downed(files, 1, [], 0xb3).c[F.side]).toBe(1)
  })
})
