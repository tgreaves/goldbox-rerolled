// Curse of the Azure Bonds' scripts in the shared VM (docs/multi-game.md, step 4): every area from
// every third square, as the Pool of Radiance sweep in engine.test.ts. Needs COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, setGame } from '../src/games/profile'

const dir = process.env.COAB ?? ''
const have = dir !== '' && existsSync(dir)

function load(): GameFiles {
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (COAB.wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p)))
    }
  }
  walk(dir)
  return new GameFiles(m, COAB)
}

function headless(answer: (n: number) => number) {
  const io = {
    print: () => {}, menu: async (items: unknown[]) => answer(items.length), inputNumber: async () => 0,
    inputText: async () => 'TEST', picture: () => {}, sprite: () => {}, refresh: async () => {},
    pause: async () => {}, sound: () => {}, engine: async () => {},
  } as unknown as Io
  return io
}

describe.skipIf(!have)('Curse of the Azure Bonds scripts', () => {
  afterAll(() => setGame(POR))
  it('run every area from every third square without interpreter errors', async () => {
    setGame(COAB)
    const files = load()
    const party = [1, 2, 3, 4, 5, 6].map((n) => files.get(`CHRDATA${n}.SAV`)!)
    let runs = 0, asking = 0
    const failures = new Map<string, string[]>()
    for (let block = 1; block <= 6; block++) {
      const dax = files.dax(`ECL${block}`)
      if (!dax) continue
      for (const { id } of dax.entries) {
        for (let sq = 0; sq < 256; sq += 3) {
          // random answers, then the last choice (usually LEAVE). A script still asking after that is
          // waiting on the player (towns, overland travel), not stuck: only a runaway without menus fails
          let seed = sq * 7 + id, menus = 0
          const e = new Engine(files, headless((n) => (++menus > 50 ? n - 1 : (seed = (seed * 1103515245 + 12345) >>> 0) % n)), sq + 1)
          try {
            e.newGame(party)
            ;(e as unknown as { setBlock(b: number): void }).setBlock(block)
            e.area = id
            ;(e as unknown as { loadEcl(r: number): void }).loadEcl(id)
            ;(e as unknown as { resetVm(k: boolean): void }).resetVm(false)
            await e.enter()
            e.x = sq & 15
            e.y = sq >> 4
            e.facing2 = (sq % 4) * 2
            await e.command('f')
          } catch (err) {
            const msg = (err as Error).message
            if (/^runaway script/.test(msg) && menus > 50) { asking++; runs++; continue }
            const where = `${block}/${id}/${sq}`
            failures.set(msg, [...(failures.get(msg) ?? []), where])
          }
          runs++
        }
      }
    }
    const summary = [...failures].map(([m, w]) => `${m} ×${w.length} (first ${w[0]})`)
    expect(summary).toEqual([])
    expect(runs).toBeGreaterThan(1500)
    expect(asking).toBeLessThan(runs / 10)
  }, 300000)
})
