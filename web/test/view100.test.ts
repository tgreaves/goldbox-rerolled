// B + 0x100 read through the character view (EclMap.view100): PoR and CotAB answer in play (1) or out (0x80);
// SotSB maps the status byte through a table (0x263D8: Okay 1, Running 6, Unconscious 5, Dying 4, Dead 3,
// Stoned 7, Gone 2, else 0), so 2/66's screaming illusion (0x9C32: a member reading 1 may break free) frees
// an Okay member. Needs SOTSB and POOLRAD.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { POR, SOTSB, setGame, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { loadFiles } from './playtest'

const io = { print: () => {}, menu: async () => 0 } as unknown as Io
const B100 = 0x6c00 // B + 0x100 in the port's numbering (SotSB's scripts write 0x7D00)
function loaded(g: GameProfile, dir: string) {
  setGame(g)
  const files = loadFiles(g, dir)
  const dat = files.get('SAVGAMA.DAT')!
  const e = new Engine(files, io, 1)
  e.loadSave(dat, parseSave(dat).party.map((st) => files.get(`${st}.SAV`)!.slice()))
  return e
}

describe('B + 0x100 read', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.SOTSB || !existsSync(process.env.SOTSB))('SotSB: the status through its table', () => {
    const e = loaded(SOTSB, process.env.SOTSB!)
    const c = e.cur
    const by = (s: number) => { c[F.status] = s; return e.read(B100) }
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(by)).toEqual([1, 0, 0, 6, 5, 4, 3, 7, 2, 0])
  })
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('PoR: in play 1, out 0x80', () => {
    const e = loaded(POR, process.env.POOLRAD!)
    expect(e.read(B100)).toBe(1)
    e.cur[F.inPlay] = 0
    expect(e.read(B100)).toBe(0x80)
  })
})
