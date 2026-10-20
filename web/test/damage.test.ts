// ECL DAMAGE (PoR 0x1C3A5, CotAB 0x1B1A8) on a hand-assembled instruction.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, setGame, type GameProfile, wants } from '../src/games/profile'
import { F } from '../src/games/fields'

const io = { print: () => {}, menu: async () => 0, inputNumber: async () => 0, inputText: async () => '', picture: () => {},
  sprite: () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {}, engine: async () => {} } as unknown as Io

function engine(dir: string, g: GameProfile, stems: string[]) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  const files = new GameFiles(m, g)
  const e = new Engine(files, io, 7)
  e.newGame(stems.map((s) => files.get(`${s}.SAV`)!))
  return e
}
/** DAMAGE flags, dice count, sides, bonus, save; then EXIT */
async function damage(e: Engine, flags: number, count: number, sides: number, bonus: number, save: number) {
  const x = e as unknown as { code: Uint8Array; run(pc: number): Promise<void> }
  x.code.set([0x2e, 0, flags, 0, count, 0, sides, 0, bonus, 0, save, 0x00], 0)
  await x.run(0x9900)
}

describe('DAMAGE', () => {
  afterAll(() => setGame(POR))
  const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''

  it.skipIf(!por || !existsSync(por))('rolls once for every victim (PoR too)', async () => {
    const e = engine(por, POR, ['CHRDATA1', 'CHRDATA2', 'CHRDATA3'])
    const before = e.party().map((c) => c[F.hp])
    await damage(e, 0xe0, 1, 4, 0, 0) // everyone, no save, 1d4
    const lost = e.party().map((c, i) => before[i] - c[F.hp])
    expect(new Set(lost).size).toBe(1)
  })

  it.skipIf(!coab || !existsSync(coab))('CotAB flag 0x10: a successful save still takes the damage', async () => {
    const e = engine(coab, COAB, ['CHRDATA1', 'CHRDATA2', 'CHRDATA3'])
    const before = e.party().map((c) => c[F.hp])
    await damage(e, 0xc0 | 0x10 | 0x0f, 1, 1, 2, 0) // everyone, save +31 (all save), despite: 3 each
    expect(e.party().map((c, i) => before[i] - c[F.hp])).toEqual([3, 3, 3])
    setGame(POR)
  })
})
