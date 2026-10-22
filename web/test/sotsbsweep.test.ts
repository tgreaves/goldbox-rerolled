// Secret of the Silver Blades' scripts in the shared VM (docs/multi-game.md, SotSB step 4): every area from
// every third square, as CotAB's sweep (coabsweep.test.ts). Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { POR, SOTSB, setGame, wants } from '../src/games/profile'
import { JOURNAL } from '../src/rules/journal'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)

function load(): GameFiles {
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (wants(SOTSB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p)))
    }
  }
  walk(dir)
  return new GameFiles(m, SOTSB)
}

// every journal entry number the scripts print ("… AS JOURNAL ENTRY " then the number)
const printed = new Set<number>()
let tail = ''

function headless(answer: (n: number) => number) {
  return {
    print: (t: string) => {
      tail = (tail + t).slice(-80)
      const m = /JOURNAL ENTRY\s*(\d+)\D$/.exec(tail)
      if (m) printed.add(Number(m[1]))
    }, menu: async (items: unknown[]) => answer(items.length), inputNumber: async () => 0,
    inputText: async () => 'TEST', picture: () => {}, sprite: () => {}, refresh: async () => {},
    pause: async () => {}, sound: () => {}, engine: async () => {},
  } as unknown as Io
}

describe.skipIf(!have)('Secret of the Silver Blades scripts', () => {
  afterAll(() => setGame(POR))
  it('run every area from every third square without interpreter errors', async () => {
    setGame(SOTSB)
    const files = load()
    const party = [1, 2, 3, 4, 5, 6].map((n) => files.get(`CHRDATA${n}.SAV`)!)
    let runs = 0, asking = 0
    const failures = new Map<string, string[]>()
    for (let block = 1; block <= 3; block++) {
      const dax = files.dax(`ECL${block}`)
      if (!dax) continue
      for (const { id } of dax.entries) {
        for (let sq = 0; sq < 256; sq += 3) {
          // random answers, then the last choice: a script still asking after 50 menus waits on the player
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
    // every entry the scripts announce is in the transcribed journal
    expect(printed.size).toBeGreaterThan(0)
    expect([...printed].filter((n) => !JOURNAL.journal.some((j) => j.n === n))).toEqual([])
  }, 300000)
})
