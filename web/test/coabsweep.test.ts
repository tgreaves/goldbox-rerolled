// Curse of the Azure Bonds' scripts in the shared VM (docs/multi-game.md, step 4): every area from
// every third square, as the Pool of Radiance sweep in engine.test.ts. Needs COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, setGame, wants } from '../src/games/profile'
import { parseSave, saveArea, saveBlock } from '../src/data/save'
import { parseCharacter } from '../src/data/character'

const dir = process.env.COAB ?? ''
const have = dir !== '' && existsSync(dir)

function load(): GameFiles {
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (wants(COAB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p)))
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

  it('loads the shipped save with the pre-made party, starts, and saves back in its own layout', async () => {
    setGame(COAB)
    const files = load()
    const dat = files.get('SAVGAMA.DAT')!
    expect(dat.length).toBe(13149)
    const sv = parseSave(dat)
    expect(sv.party).toEqual(['CHRDATA1', 'CHRDATA2', 'CHRDATA3', 'CHRDATA4', 'CHRDATA5', 'CHRDATA6'])
    expect([saveBlock(sv), sv.x, sv.y, sv.facing2]).toEqual([2, 7, 13, 0])
    const chars = sv.party.map((st) => files.get(`${st}.SAV`)!)
    expect(chars.map((c) => parseCharacter(c).name)).toEqual(['MATHEW', 'MARK', 'TRAVIS', 'LEDERA', 'SHARA', 'PHILIPPE'])
    const shown: unknown[] = []
    const e = new Engine(files, { ...headless(() => 0), picture: (p: unknown) => shown.push(p), clearView: () => shown.push('view') } as unknown as Io, 1)
    e.loadSave(dat, chars)
    sv.party.forEach((st, i) => e.attachFiles(i, files.get(`${st}.SWG`), files.get(`${st}.FX`)))
    expect(e.effectsOf(e.party()[2]).length).toBe(3) // TRAVIS, the dwarf: racial effects from CHRDATA3.FX
    await e.start()
    expect(e.party().length).toBe(6)
    expect(shown).toContainEqual({ pic: 10 }) // the marked arm, not a portrait (the save's selector is 0; the reset sets 0xFF)
    expect(shown.slice(shown.findIndex((x) => JSON.stringify(x) === '{"pic":10}'))).toContain('view') // then the 3D view again (CALL 0x2E10)
    const back = e.toSave(sv.party)
    expect(back.length).toBe(13149)
    const again = parseSave(back)
    expect(again.party).toEqual(sv.party)
    expect([saveBlock(again), saveArea(again)]).toEqual([saveBlock(sv), e.area])
  })

  it('shows the overland map as a BIGPIC, with the city cursor from its tables', async () => {
    setGame(COAB)
    const files = load()
    const shown: unknown[] = []
    const io = { ...headless(() => 0), picture: (p: unknown) => shown.push(p) } as unknown as Io
    const e = new Engine(files, io, 1)
    e.newGame([1, 2, 3, 4, 5, 6].map((n) => files.get(`CHRDATA${n}.SAV`)!))
    ;(e as unknown as { setBlock(b: number): void }).setBlock(1)
    e.area = 81
    ;(e as unknown as { loadEcl(r: number): void }).loadEcl(81)
    ;(e as unknown as { resetVm(k: boolean): void }).resetVm(false)
    await e.enter().catch(() => {})
    expect(shown).toContainEqual({ big: 121 })
    expect(e.overland).toBe(false) // no tile wilderness in CotAB
    e.write(0x4aa1, 0)
    expect(e.cityCursor).toEqual([4, 15])
    e.write(0x4aa1, 31)
    expect(e.cityCursor).toEqual([34, 1])
  })

  it('puts the sun and clouds in the day sky (spec/coab/assets.md §3)', () => {
    setGame(COAB)
    const files = load()
    const e = new Engine(files, headless(() => 0), 1)
    e.newGame([1, 2].map((n) => files.get(`CHRDATA${n}.SAV`)!))
    const set = (hour: number, facing2: number, sky: number) => { e.write(0x49c9, hour); e.facing2 = facing2; e.write(0x49fd, sky); e.write(0x49fe, sky) }
    set(3, 2, 3) // 3 am facing east, sky index 3 = colour 11
    expect(e.skyArt).toEqual({ record: 251, x: 56, y: 16 })
    set(14, 6, 3)
    expect(e.skyArt).toEqual({ record: 251, x: 0, y: 8 })
    set(10, 0, 3)
    expect(e.skyArt).toEqual({ record: 250, x: 0, y: 0 })
    set(10, 0, 0) // night sky: nothing
    expect(e.skyArt).toBeNull()
  })
})
