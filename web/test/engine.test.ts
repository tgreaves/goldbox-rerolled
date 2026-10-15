// The TypeScript interpreter against the shipped scripts (POOLRAD).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

function load(): GameFiles {
  const m = new Map<string, Uint8Array>()
  for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  return new GameFiles(m)
}

function headless(answer: (n: number) => number = () => 0) {
  const text: string[] = []
  const stops: string[] = []
  let engine!: Engine
  const io: Io = {
    print: (t) => { if (t) text.push(t) },
    menu: async (items) => answer(items.length),
    inputNumber: async () => 0,
    inputText: async () => 'TEST',
    picture: () => {},
    sprite: () => {},
    refresh: async () => { stops.push(`${engine.x},${engine.y},${engine.facing}`) },
    pause: async () => { stops.push('pause') },
    sound: () => {},
    engine: async () => {},
  }
  return { io, text, stops, bind: (e: Engine) => (engine = e) }
}

describe.skipIf(!have)('ECL engine', () => {
  it('plays the opening tour of New Phlan in a new game', async () => {
    const files = load()
    const h = headless()
    const party = parseSave(files.get('SAVGAMA.DAT')!).party.map((s) => files.get(`${s}.SAV`)!)
    const e = h.bind(new Engine(files, h.io, 1))
    e.newGame(party)
    await e.start()
    expect(e.block).toBe(3)
    expect(e.area).toBe(0)
    expect(h.text[0]).toMatch(/^'GREETINGS, COURAGEOUS ONES, I AM ROLF/)
    // view drawn, then Rolf's sprite approaches over three pauses before he speaks
    expect(h.stops.slice(0, 4)).toEqual(['15,1,3', 'pause', 'pause', 'pause'])
    expect(h.text.some((t) => t.startsWith("'OUR TOUR IS ENDED"))).toBe(true)
    // the tour walks the waypoint table at 0xB5B4/0xB5D6/0xB5F8 in ECL3 #0
    expect(h.stops).toContain('15,1,3')
    expect(h.stops).toContain('0,4,3')
    expect(e.read(0x4ac5)).toBe(1) // tour done flag
  })

  it('runs every area from every square without interpreter errors', async () => {
    const files = load()
    const party = parseSave(files.get('SAVGAMA.DAT')!).party.map((s) => files.get(`${s}.SAV`)!)
    let runs = 0
    const failures: string[] = []
    for (let block = 1; block <= 8; block++) {
      for (const { id } of files.dax(`ECL${block}`)!.entries) {
        for (let sq = 0; sq < 256; sq += 3) {
          let seed = sq * 7 + id
          const h = headless((n) => (seed = (seed * 1103515245 + 12345) >>> 0) % n)
          const e = h.bind(new Engine(files, h.io, sq + 1))
          e.newGame(party)
          ;(e as unknown as { setBlock(b: number): void }).setBlock(block)
          e.area = id
          ;(e as unknown as { loadEcl(r: number): void }).loadEcl(id)
          ;(e as unknown as { resetVm(k: boolean): void }).resetVm(false)
          try {
            await e.enter()
            e.x = sq & 15
            e.y = sq >> 4
            e.facing2 = (sq % 4) * 2
            await e.command('f')
          } catch (err) {
            const msg = (err as Error).message
            // record 255: the known missing exit (spec/ecl.md, Validation); WALLDEF5 #25: needs flags
            // 0x49E7/0x49E8 that another area sets first (the sweep starts every area fresh)
            if (!/no ECL record 255|WALLDEF5 has no record 25/.test(msg)) failures.push(`block ${block} area ${id} square ${sq}: ${msg}`)
          }
          runs++
        }
      }
    }
    expect(failures).toEqual([])
    expect(runs).toBeGreaterThan(2000)
  }, 120000)
})

describe.skipIf(!have)('save games', () => {
  it('writes back the shipped saves byte for byte', async () => {
    const files = load()
    for (const slot of ['A', 'J']) {
      const dat = files.get(`SAVGAM${slot}.DAT`)!
      const stems = parseSave(dat).party
      const h = headless()
      const e = h.bind(new Engine(files, h.io, 1))
      e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
      const out = e.toSave(stems)
      const diffs: string[] = []
      // stem fields are 41-byte Pascal strings; bytes after each name, and unused fields, hold leftovers
      const padding = (i: number) => i >= 0x3209 + 41 * dat[0x3208] ||
        (i >= 0x3209 && (i - 0x3209) % 41 > dat[0x3209 + 41 * Math.floor((i - 0x3209) / 41)])
      for (let i = 0; i < dat.length; i++) if (out[i] !== dat[i] && !padding(i)) diffs.push(`${i.toString(16)}: ${dat[i]} -> ${out[i]}`)
      expect(diffs.slice(0, 10), slot).toEqual([])
    }
  })
})
