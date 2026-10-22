// ECL opcodes ROB, CHECK_PARTY, FIND_ITEM, PRINT, NEWLINE, CLEAR_TOP, PRINT_LIST (spec/A-games/engine/ecl.md); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { CODE, Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

function setup() {
  const m = new Map<string, Uint8Array>()
  for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  const files = new GameFiles(m)
  const text: string[] = []
  const glyphs: { codes: number[]; at: { col: number; row: number } | null }[] = []
  const tops: boolean[] = []
  const runs: [string, boolean | undefined][] = []
  const io = { print: (t: string, _c: boolean, run?: boolean) => { if (t) text.push(t); runs.push([t, run]) }, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
    picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '',
    clearTop: (on: boolean) => tops.push(on), glyphs: (codes: number[], at: { col: number; row: number } | null) => glyphs.push({ codes, at }) } as unknown as Io
  const dat = files.get('SAVGAMA.DAT')!
  const stems = parseSave(dat).party
  const e = new Engine(files, io, 1)
  e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
  stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
  const run = async (bytes: number[]) => { e.code.fill(0); e.code.set(bytes); await e.run(CODE) }
  return { e, run, text, glyphs, tops, runs }
}
const imm = (v: number) => [0, v]
const mem = (a: number) => [1, a & 0xff, a >> 8]
const ptr = (a: number) => [2, a & 0xff, a >> 8]

describe.skipIf(!have)('ECL opcodes', () => {
  it('ROB takes money and, for light items, everything at 100%', async () => {
    const { e, run } = setup()
    const c = e.party()[0]
    for (const it of e.itemsOf(c)) { it.raw[0x37] = 1; it.raw[0x38] = 0 }
    c[0x88] = 50
    await run([0x28, ...imm(0), ...imm(100), ...imm(0), 0x00])
    expect(c[0x88]).toBe(0)
    expect(e.itemsOf(c)).toHaveLength(0)
  })

  it('CHECK_PARTY selector 0 tests for an effect', async () => {
    const { e, run } = setup()
    const D = 0x4a10
    const prog = [0x1e, ...imm(0), ...imm(0x13), ...mem(D), ...mem(D + 1), ...mem(D + 2), ...mem(D + 3), 0x00]
    await run(prog)
    expect(e.read(D + 3)).toBe(0)
    e.effectsOf(e.party()[1]).push({ type: 0x13, duration: 10, power: 1, flag: 0 })
    await run(prog)
    expect(e.read(D + 3)).toBe(1)
  })

  it('FIND_ITEM finds a carried type', async () => {
    const { e, run } = setup()
    const t = e.itemsOf(e.party()[0])[0].type
    await run([0x32, ...imm(t), 0x00])
    expect(e.flags.EQ).toBe(1)
    await run([0x32, ...imm(0xfe), 0x00])
    expect(e.flags.NE).toBe(1)
  })

  it('PRINT goes on along the line a PRINT left open; PRINT_CLEAR, NEWLINE and the end of the script start one', async () => {
    // SotSB 0x1E593 / CotAB 0x1926C: only PRINT_CLEAR sets the cursor; the text routine wraps past the edge only
    const { run, runs } = setup()
    await run([0x12, ...imm(1), 0x11, ...imm(2), 0x33, 0x11, ...imm(3), 0x00])
    await run([0x11, ...imm(4), 0x00])
    expect(runs).toEqual([['1', false], ['2', true], ['3', false], ['4', false]])
  })

  it('PRINT_LIST draws glyphs inline, or in the view after CLEAR_TOP', async () => {
    const { run, glyphs, tops } = setup()
    const data = CODE + 0x100
    const prog = [0x3c, ...ptr(data), 0x00]
    const bytes = [...prog]; bytes[0x100] = 0x4f; bytes[0x101] = 0x50; bytes[0x102] = 0
    await run(bytes)
    expect(glyphs[0]).toEqual({ codes: [0x50, 0x51], at: null })
    const two = [0x3d, 0x3c, ...ptr(data), 0x33, 0x3c, ...ptr(data), 0x00]
    const b2 = [...two]; b2[0x100] = 0x4f; b2[0x101] = 0
    await run(b2)
    expect(glyphs[1].at).toEqual({ col: 2, row: 5 })
    expect(glyphs[2].at).toEqual({ col: 1, row: 7 })
    expect(tops).toEqual([true, false])
  })
})

describe.skipIf(!have)('3D backdrop', () => {
  it('takes the sky from 0x49FD/0x49FE and the floor from register 0xC059', async () => {
    const { e, run } = setup()
    await run([0x00])
    e.write(0x49fd, 11)
    e.write(0xc059, 0x41)
    const bd = e.backdrop
    expect(bd.sky).toBe(11) // light cyan
    expect(bd.floor).toBe(6) // brown
    e.write(0xc059, 0x0b)
    e.write(0xc05f, 8)
    expect(e.backdrop).toMatchObject({ floor: 8, line: 0, band: 8 })
  })
})
