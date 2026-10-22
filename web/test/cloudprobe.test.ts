// The computer's movement probe on cloud squares (R.clouds `probe`; PoR FUN_3334_0675, CotAB 0x237FB):
// PoR refuses a gas square unless the mover holds 0x20, 0x1E, 0x6F or 0x7D; CotAB adds 0x81 and 0x3F, a
// turned undead and a save vs 0 (0x238EE), and refuses its kill cloud to hit dice below 7 unless 0x81,
// 0x6F, 0x85 or 0x7D, or turned (0x239BD). Needs POOLRAD and COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, type CellInfo } from '../src/rules/battlefield'
import { addRaw } from '../src/rules/effects'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'

const cells: CellInfo[] = Array.from({ length: 0x42 }, () => ({ move: 1, sight: 0, image: 0 }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io
const GAS = 0x1e, KILL = 0x1c

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

/** whether a mover holding `types` is refused `cell`; `rolls` answer the dice in turn */
function refused(files: GameFiles, cell: number, types: number[], o: { hd?: number; turned?: boolean; rolls?: number[] } = {}) {
  const e = new Engine(files, io, 7)
  const rolls = [...(o.rolls ?? [])]
  let drawn = 0
  e.roll = (n: number) => { drawn++; return rolls.length ? rolls.shift()! : n }
  const ui = { print: () => {}, redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi
  const b = new Battle(e, ui, new Battlefield(false), cells)
  const c = new Uint8Array(F.size)
  c[F.inPlay] = 1; c[F.side] = 1; c[F.hp] = c[F.maxHp] = 10; c[F.hitDice] = o.hd ?? 3
  for (let i = 0; i < 5; i++) c[F.saves + i] = 15
  const f: Fighter = { c, r: new Uint8Array(22), x: 5, y: 5, size: 1, index: 0, monster: true, target: null }
  if (o.turned) f.r[0x10] = 1
  b.fighters.push(f)
  for (const t of types) addRaw(b, c, t, 10, 0xff, 0)
  return { no: b.cloudRefuses(f, cell), drawn }
}

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''

describe.skipIf(!por || !existsSync(por))('PoR: the AI probe on gas', () => {
  it('only the four effects let it in; no save, no turned exemption, no kill cloud', () => {
    const files = load(por, POR)
    expect(refused(files, GAS, [])).toEqual({ no: true, drawn: 0 })
    for (const t of [0x20, 0x1e, 0x6f, 0x7d]) expect(refused(files, GAS, [t]).no).toBe(false)
    expect(refused(files, GAS, [0x81]).no).toBe(true)
    expect(refused(files, GAS, [], { turned: true }).no).toBe(true)
    expect(refused(files, KILL, []).no).toBe(false)
  })
})

describe.skipIf(!coab || !existsSync(coab))('CotAB: the AI probe on gas and the kill cloud', () => {
  afterAll(() => setGame(POR))

  it('gas: six effects or turned let it in at no draw; else a save vs 0', () => {
    const files = load(coab, COAB)
    for (const t of [0x20, 0x1e, 0x6f, 0x7d, 0x81, 0x3f]) expect(refused(files, GAS, [t])).toEqual({ no: false, drawn: 0 })
    expect(refused(files, GAS, [], { turned: true })).toEqual({ no: false, drawn: 0 })
    expect(refused(files, GAS, [], { rolls: [20] })).toEqual({ no: false, drawn: 1 })
    expect(refused(files, GAS, [], { rolls: [1] })).toEqual({ no: true, drawn: 1 })
  })

  it('kill cloud: hit dice below 7 refused unless 0x81, 0x6F, 0x85, 0x7D or turned; no save', () => {
    const files = load(coab, COAB)
    expect(refused(files, KILL, [], { hd: 6 })).toEqual({ no: true, drawn: 0 })
    expect(refused(files, KILL, [], { hd: 7 }).no).toBe(false)
    for (const t of [0x81, 0x6f, 0x85, 0x7d]) expect(refused(files, KILL, [t], { hd: 6 }).no).toBe(false)
    expect(refused(files, KILL, [], { hd: 6, turned: true }).no).toBe(false)
  })
})
