// SotSB's roster loader (0x40FF4, R.addRefill): a native character joining with a paladin level, or a
// former paladin whose former levels count, gets its ability use (+0x6D) set to 1. Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { POR, SOTSB, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'
import { Engine, type Io } from '../src/vm/engine'
import { loadFiles } from './playtest'

const dir = process.env.SOTSB ?? ''

describe.skipIf(!dir || !existsSync(dir))('SotSB: joining from the roster', () => {
  afterAll(() => setGame(POR))
  const join = (setup: (c: Uint8Array) => void) => {
    setGame(SOTSB)
    const files = loadFiles(SOTSB, dir)
    const e = new Engine(files, { print: () => {}, menu: async () => 0 } as unknown as Io, 1)
    const sav = files.get('CHRDATA1.SAV')!.slice()
    for (let k = 0; k < F.classCount; k++) sav[F.levels + k] = 0
    sav[F.abilityUses] = 0
    setup(sav)
    return e.addMember(sav)
  }
  it('a paladin gets its ability use; a fighter does not', () => {
    expect(join((c) => { c[F.levels + 3] = 5 })[F.abilityUses]).toBe(1)
    expect(join((c) => { c[F.levels + 2] = 5 })[F.abilityUses]).toBe(0)
  })
})
