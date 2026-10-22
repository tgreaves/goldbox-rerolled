// Silver Blades' script handlers where they differ from CotAB's (spec/A-games/sotsb/ecl.md, "Handlers read"):
// LOAD_MONSTER's difficulty scaling, CHECK_PARTY by B offset, FIND_SPELL from slot 0, COMBAT's vault, DAMAGE's
// roll per victim, DESTROY_ITEMS. Each runs a few hand-made script bytes over the shipped save. Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { POR, SOTSB, setGame, wants } from '../src/games/profile'
import { F } from '../src/games/fields'
import { parseSave } from '../src/data/save'
import { daxRecords } from '../src/data/dax'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)

function load(): GameFiles {
  const files = new Map<string, Uint8Array>()
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (wants(SOTSB, n)) files.set(n.toUpperCase(), new Uint8Array(readFileSync(p)))
    }
  }
  walk(dir)
  return new GameFiles(files, SOTSB)
}

/** operands: a byte value, or [address] (kind 1, the script's own numbering) */
const imm = (v: number) => [0, v]
const at = (a: number) => [1, a & 0xff, a >> 8]

describe.skipIf(!have)('Silver Blades script handlers', () => {
  afterAll(() => setGame(POR))
  const start = () => {
    setGame(SOTSB)
    const files = load()
    const screens: string[] = []
    const io = {
      print: () => {}, menu: async () => 0, inputNumber: async () => 0, inputText: async () => '', picture: () => {},
      sprite: () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {}, engine: async (w: string) => { screens.push(w) },
    } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const sv = parseSave(dat)
    const e = new Engine(files, io, 1)
    e.loadSave(dat, sv.party.map((st) => files.get(`${st}.SAV`)!))
    const run = async (bytes: number[]) => {
      const base = 0x9920 // over the loaded script, past its vectors
      ;[...bytes, 0x00].forEach((b, i) => e.write(base + i, b))
      await e.run(base)
    }
    return { e, files, screens, run }
  }
  // the engine's (PoR) numbering of SotSB's ECL 0x7F79…: B 0x7C00 → 0x6B00, A 0x4B00 → 0x4900
  const B = (a: number) => a - 0x7c00 + 0x6b00, A = (a: number) => a - 0x4b00 + 0x4900

  it('LOAD_MONSTER scales a monster\'s HP by the difficulty level, (level + 2) / 4 (0x1DF9F)', async () => {
    const { e, files, run } = start()
    const ids = [...daxRecords(files.dax('MON1CHA.DAX')!).keys()]
    const raw = files.record('MON1CHA', ids[0])!
    const hp0 = raw[F.hp], max0 = raw[F.maxHp]
    for (const [level, num] of [[0, 2], [2, 4], [4, 6]] as const) {
      e.write(A(0x4cf4), level)
      const before = e.nodes.length
      await run([0x0b, ...imm(ids[0]), ...imm(1), ...imm(0)])
      const m = e.nodes[before]
      if (raw[F.side] === 1) {
        expect(m[F.hp]).toBe(Math.max(1, Math.floor((hp0 * num) / 4) & 0xff))
        expect(m[F.maxHp]).toBe(Math.max(1, Math.floor((max0 * num) / 4) & 0xff))
      } else expect(m[F.hp]).toBe(hp0) // only side 1 is scaled
    }
  })

  it('CHECK_PARTY by B offset (0x1F051): race found, a thief skill\'s min/max/average', async () => {
    const { e, run } = start()
    const party = e.party()
    const race = party[0][F.race]
    await run([0x1e, ...at(0x7c72), ...imm(race), ...at(0x7f79), ...at(0x7f7a), ...at(0x7f7b), ...at(0x7f7c)])
    expect([e.read(B(0x7f79)), e.read(B(0x7f7a)), e.read(B(0x7f7c))]).toEqual([0xff, 0, 1])
    await run([0x1e, ...at(0x7c72), ...imm(99), ...at(0x7f79), ...at(0x7f7a), ...at(0x7f7b), ...at(0x7f7c)])
    expect(e.read(B(0x7f7c))).toBe(0)
    const skill = party.map((c) => c[F.thief + 2])
    await run([0x1e, ...at(0x7ca7), ...imm(0), ...at(0x7f79), ...at(0x7f7a), ...at(0x7f7b), ...at(0x7f7c)])
    expect([e.read(B(0x7f79)), e.read(B(0x7f7a)), e.read(B(0x7f7b))])
      .toEqual([Math.min(...skill), Math.max(...skill), Math.trunc(skill.reduce((a, b) => a + b, 0) / skill.length)])
  })

  it('FIND_SPELL counts memorised slots from 0 (0x20E4D)', async () => {
    const { e, run } = start()
    const c = e.party()[2]
    for (let i = 0; i < F.memorisedCount; i++) c[F.memorised + i] = 0
    c[F.memorised + 4] = 7
    await run([0x3b, ...imm(7), ...at(0x7f79), ...at(0x7f7a)])
    expect([e.read(B(0x7f79)), e.read(B(0x7f7a))]).toEqual([4, 2])
    await run([0x3b, ...imm(9), ...at(0x7f79), ...at(0x7f7a)])
    expect(e.read(B(0x7f79))).toBe(0xff)
  })

  it('COMBAT with no monsters and ECL 0x4CFC = 1 opens the vault, the flag cleared (0x1F5C2)', async () => {
    const { e, screens, run } = start()
    e.write(A(0x4cfc), 1)
    await run([0x24])
    expect(screens).toContain('vault')
    expect(e.read(A(0x4cfc))).toBe(0)
  })

  it('DAMAGE rolls the dice once for each victim, before its save (0x20973)', async () => {
    const { e, run } = start()
    const draws: [number, number][] = []
    const roll = e.roll.bind(e)
    e.roll = (n: number, s: number) => { draws.push([n, s]); return roll(n, s) }
    for (const c of e.party()) c[F.hp] = c[F.maxHp] = 200
    // everyone (0x40), no save (0x20), saving mode (0x80): 1d6 each
    await run([0x2e, ...imm(0xe0), ...imm(1), ...imm(6), ...imm(0), ...imm(0)])
    expect(draws.filter(([, s]) => s === 6).length).toBe(e.nodes.length)
  })
})
