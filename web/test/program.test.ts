// PROGRAM 0 and 8 return and the script goes on (PoR 0x1CA40, CotAB 0x1B94E); only 9 (camp) and CotAB's
// 3 then act as EXIT. PoR's final script (ECL5 #7) runs the walk back to New Phlan right after the ending.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('PROGRAM 8 in PoR', () => {
  it('after the ending the script goes on: the walk back and NEW_ECL to New Phlan', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const said: string[] = [], screens: string[] = []
    const io = { print: (t: string) => { said.push(t) }, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async (w: string) => { screens.push(w) }, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 1)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    await e.jump(5, 7, 1, 4, 1)
    said.length = 0
    await e.run(0xa80e) // ECL5 #7 after the win: the victory flags, PROGRAM 8, then the walk
    expect(screens).toContain('ending')
    expect(said.join(' ')).toMatch(/TYRANTHRAXUS HAS FINALLY BEEN DEFEATED/)
  })
})

describe.skipIf(!have)('an NPC leaving through LOAD_CHARACTER (0x19F92)', () => {
  it('after B 0x6B00 and B 0x6C00 are set to 0, LOAD_CHARACTER with bit 7 drops that character', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const run = async (flags: boolean) => {
      const e = new Engine(files, io, 1)
      e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
      const leaving = e.party()[2]
      const at = 0x9920 // over the loaded script, past its vectors: LOAD_CHARACTER #0x82, EXIT
      ;[0x0a, 0x00, 0x82, 0x00].forEach((b, i) => e.write(at + i, b))
      e.cur = leaving
      if (flags) { e.write(0x6b00, 0); e.write(0x6c00, 0) }
      await e.run(at)
      return { n: e.party().length, gone: !e.party().includes(leaving) }
    }
    expect(await run(true)).toEqual({ n: 5, gone: true })
    expect(await run(false)).toEqual({ n: 6, gone: false })
  })
})

describe.skipIf(!have)('ON_GOTO with 64 targets (SotSB ECL2 #51 0x8728)', () => {
  it('takes the 64th target: the operand tables hold 64 operands, as the original\'s (0x1F8B5)', async () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const e = new Engine(files, io, 1)
    e.loadSave(dat, parseSave(dat).party.map((s) => files.get(`${s}.SAV`)!))
    const at = 0x9920, exit = at + 2 * 2 + 3 * 64 + 1 // just after the instruction: an EXIT
    const ops = [0x25, 0x00, 63, 0x00, 64]
    for (let k = 0; k < 64; k++) ops.push(0x01, k === 63 ? exit & 0xff : 0, k === 63 ? exit >> 8 : 0)
    ops.push(0x00)
    ops.forEach((b, i) => e.write(at + i, b))
    await e.run(at) // the 64th target, not a jump to 0 (which throws)
  })
})
