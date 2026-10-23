// The treasure screen after the summary (R.battleSummary.treasureScreen): PoR and CotAB always come to it
// (PoR 0x1F5E9, CotAB 0x1EF66, after a flight as well), SotSB only when the pile holds money or items
// (0x24D30, DS:59C2/59C3). Needs POOLRAD and SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { POR, SOTSB, setGame, type GameProfile } from '../src/games/profile'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { treasure, type TownUi } from '../src/ui/town'
import { loadFiles } from './playtest'

const io = { print: () => {}, menu: async () => 0 } as unknown as Io
async function menus(g: GameProfile, dir: string, gold: number) {
  setGame(g)
  const files = loadFiles(g, dir)
  const dat = files.get('SAVGAMA.DAT')!
  const e = new Engine(files, io, 1)
  e.loadSave(dat, parseSave(dat).party.map((st) => files.get(`${st}.SAV`)!.slice()))
  e.money = [0, 0, 0, gold, 0, 0, 0]
  e.treasure = []
  const shown: string[][] = []
  const ui = {
    engine: e, print: () => {}, inputNumber: async () => 0, view: async () => {}, refresh: () => {},
    // the last item is Exit on every treasure menu; Take with money would ask more, so leave at once
    menu: async (items: string[]) => { shown.push(items); return items.length - 1 },
  } as unknown as TownUi
  await treasure(ui)
  return shown.length
}

describe('the treasure screen after the summary', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('PoR: shown with an empty pile', async () => {
    expect(await menus(POR, process.env.POOLRAD!, 0)).toBeGreaterThan(0)
  })
  it.skipIf(!process.env.SOTSB || !existsSync(process.env.SOTSB))('SotSB: not shown with an empty pile, shown with gold', async () => {
    expect(await menus(SOTSB, process.env.SOTSB!, 0)).toBe(0)
    expect(await menus(SOTSB, process.env.SOTSB!, 10)).toBeGreaterThan(0)
  })
})
