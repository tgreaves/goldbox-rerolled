// The sound cut-off by call site (spec/C-port/audio.md §3): the game's transient mode is profile data,
// each call site says how the original plays its effect. The engine part needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { cutTick } from '../src/audio/sfx'
import { COAB, POR } from '../src/games/profile'
import type { SoundMode } from '../src/games/sound'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { CODE, Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe('sound cut-off', () => {
  it('PoR has a transient mode (FUN_18ae_00dc), CotAB none (0x69B0)', () => {
    expect(POR.sound.transient).toBe(true)
    expect(COAB.sound.transient).toBe(false)
  })

  it('cuts a transient call after 14–26 driver ticks in a game with a transient mode, never a full one', () => {
    expect(cutTick('transient', true, () => 0)).toBe(14)
    expect(cutTick('transient', true, () => 0.9999)).toBe(26)
    expect(cutTick('full', true, () => 0)).toBeUndefined()
    expect(cutTick('transient', false, () => 0)).toBeUndefined()
    expect(cutTick('full', false, () => 0)).toBeUndefined()
  })
})

describe.skipIf(!have)('sound call sites', () => {
  const setup = () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const sounds: [number, SoundMode][] = []
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {},
      sound: (n: number, mode: SoundMode) => sounds.push([n, mode]),
      picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, 1)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    return { e, sounds }
  }

  it("the script's CALL sound is transient, effect 11 as well as the footstep (FUN_29c3_2ccf)", async () => {
    const { e, sounds } = setup()
    const call = [0x2d, 2, POR.ecl.calls.sound & 0xff, POR.ecl.calls.sound >> 8, 0x00]
    for (const r of [8, 10]) {
      e.regs.set(0x3de, r)
      e.code.fill(0); e.code.set(call); await e.run(CODE)
    }
    expect(sounds).toEqual([[10, 'transient'], [11, 'transient']])
  })
})
