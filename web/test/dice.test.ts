// The dice source (spec/B-model/host-contracts.md §6): one injected source of requests (count, sides);
// Random(n) is the request (1, n) − 1. The engine part needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { generator, random, type Dice } from '../src/rules/dice'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { CODE, Engine, type Io } from '../src/vm/engine'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

/** a source that answers every request with its highest face sum and logs it */
function logging() {
  const asked: [number, number][] = []
  const d: Dice = { roll: (n, s) => { asked.push([n, s]); return n * s } }
  return { d, asked }
}

describe('dice source', () => {
  it('Random(n) is the request (1, n) − 1', () => {
    const { d, asked } = logging()
    expect(random(d, 256)).toBe(255)
    expect(random(d, 0)).toBe(0) // Random(0) is 0, and still a request
    expect(asked).toEqual([[1, 256], [1, 0]])
  })

  it('the reference generator answers in range and is repeatable', () => {
    const a = generator(42), b = generator(42)
    for (let i = 0; i < 500; i++) {
      const r = a.roll(3, 6)
      expect(r).toBeGreaterThanOrEqual(3)
      expect(r).toBeLessThanOrEqual(18)
      expect(b.roll(3, 6)).toBe(r)
    }
    expect(a.roll(2, 0)).toBe(0)
    expect(a.roll(0, 6)).toBe(0)
  })
})

describe('no gameplay draw bypasses the source', () => {
  // host-contracts.md §6.2: these Math.random calls only affect presentation or are not dice draws
  const allowed: Record<string, number> = {
    'ui/title.ts': 3, // the title's lightning
    'ui/explore.ts': 1, // the river cleansing's pixel choice
    'audio/sfx.ts': 1, // the sound effects' cut-off phase
    'store/sync.ts': 1, // the sync client's record ids
  }
  it('lists every Math.random in web/src', () => {
    const root = join(__dirname, '../src')
    const found: Record<string, number> = {}
    const walk = (d: string) => {
      for (const n of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, n.name)
        if (n.isDirectory()) walk(p)
        else if (n.name.endsWith('.ts')) {
          const k = (readFileSync(p, 'utf8').match(/Math\.random\(/g) ?? []).length
          if (k) found[p.slice(root.length + 1)] = k
        }
      }
    }
    walk(root)
    expect(found).toEqual(allowed)
  })
})

describe.skipIf(!have)('the engine takes every draw from its source', () => {
  const files = () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    return new GameFiles(m)
  }

  it('RANDOM asks (1, m) and writes the result − 1', async () => {
    const { d, asked } = logging()
    const e = new Engine(files(), {} as Io, d)
    e.code.fill(0)
    // RANDOM 9, [0x4A10]: m = 9 + 1
    e.code.set([0x08, 0, 9, 1, 0x10, 0x4a, 0x00])
    await e.run(CODE)
    expect(asked).toEqual([[1, 10]])
    expect(e.read(0x4a10)).toBe(9)
  })

  it('rand(n) goes through roll, so a replaced roll answers it', () => {
    const e = new Engine(files(), {} as Io, 1)
    const asked: [number, number][] = []
    e.roll = (n, s) => { asked.push([n, s]); return 1 }
    expect(e.rand(256)).toBe(0)
    expect(asked).toEqual([[1, 256]])
  })
})
