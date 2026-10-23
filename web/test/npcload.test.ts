// Loading a saved game with an NPC in the party (spec/B-model/script-vm-map.md §5.4, ADD_NPC
// iconPicture): CotAB's loader (0x35B75) gives an NPC the combat picture of its identity tag; PoR
// builds every icon from its parts. Needs COAB and POOLRAD.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COAB, POR, setGame, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { loadFiles } from './playtest'

const io = { print: () => {}, menu: async () => 0 } as unknown as Io
function loaded(g: GameProfile, dir: string) {
  setGame(g)
  const files = loadFiles(g, dir)
  const dat = files.get('SAVGAMA.DAT')!
  const recs = parseSave(dat).party.map((st) => files.get(`${st}.SAV`)!.slice())
  recs[1][F.morale] = 0x90; recs[1][F.id] = 0x2c // the second member made an NPC
  const e = new Engine(files, io, 1)
  e.loadSave(dat, recs)
  return e
}

describe('an NPC\'s combat picture after loading', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.COAB || !existsSync(process.env.COAB))('CotAB: the CPIC of its tag; player characters none', () => {
    const e = loaded(COAB, process.env.COAB!)
    const [a, b] = e.party()
    expect(e.combatPicture.get(b)).toBe(0x2c)
    expect(e.combatPicture.has(a)).toBe(false)
  })
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('PoR: built from its parts', () => {
    const e = loaded(POR, process.env.POOLRAD!)
    expect(e.combatPicture.size).toBe(0)
  })
})

describe('a monster keeps the icon read when it was loaded (CotAB 0x18D97, 0x33010)', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.COAB || !existsSync(process.env.COAB))('loaded in block 5, fought in block 1: CPIC5; a record no file has: an empty slot', () => {
    const e = loaded(COAB, process.env.COAB!)
    e.write(0x6e12, 5) // B + 0x312: the block digit (0x066DC)
    e.addMonsters(57, 2, 57) // salamanders, CPIC5 #57
    e.write(0x6e12, 1) // the party travels on, the monsters unfought
    const sal = e.nodes[e.nodes.length - 1]
    expect(e.block).toBe(1)
    expect(e.combatIcon(sal)).toEqual({ block: 5, id: 57 })
    e.write(0x6e12, 6)
    e.addMonsters(65, 1, 66) // ECL6 #69's phase spider: CPIC6 has no #66
    expect(e.combatIcon(e.nodes[e.nodes.length - 1])).toBeNull()
    expect(e.combatIcon(e.party()[0])).toBeUndefined() // a player character's icon is built
  })
})
