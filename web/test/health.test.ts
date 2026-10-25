// The imported files' health (IMP-105): clean imports pass; a missing, empty, damaged or other-edition
// file is named with what it costs. Needs POOLRAD (and COAB, SOTSB for theirs).
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'
import { GameFiles } from '../src/store/gamefiles'
import { checkImport } from '../src/store/health'
import { loadFiles } from './playtest'

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? '', sotsb = process.env.SOTSB ?? ''

describe.skipIf(!por || !existsSync(por))('import health', () => {
  afterAll(() => setGame(POR))
  it('finds nothing wrong with the games as GOG sells them', async () => {
    expect(await checkImport(loadFiles(POR, por))).toEqual([])
    if (coab && existsSync(coab)) expect(await checkImport(loadFiles(COAB, coab))).toEqual([])
    if (sotsb && existsSync(sotsb)) expect(await checkImport(loadFiles(SOTSB, sotsb))).toEqual([])
  })

  it('names what is missing, empty, damaged or of another edition', async () => {
    const good = loadFiles(POR, por)
    const m = new Map(good.files)
    m.delete('GAME.OVR')
    m.set('ITEMS', new Uint8Array(0))
    const pic = m.get('PIC1.DAX')!
    m.set('PIC1.DAX', pic.subarray(0, Math.floor(pic.length / 2))) // cut short
    const p = await checkImport(new GameFiles(m, POR))
    expect(p.map((x) => x.level)).toEqual(['error', 'error', 'warning'])
    expect(p.map((x) => x.text.split(' ')[0])).toEqual(expect.arrayContaining(['ITEMS', 'PIC1.DAX', 'GAME.OVR']))
    if (coab && existsSync(coab)) {
      // Pool of Radiance's code under Curse of the Azure Bonds' name: the text is not where CotAB's is
      const c = new Map(loadFiles(COAB, coab).files)
      c.set('START.EXE', good.get('START.EXE')!); c.set('GAME.OVR', good.get('GAME.OVR')!)
      const q = await checkImport(new GameFiles(c, COAB))
      expect(q.some((x) => x.text.includes('not from the edition the port reads'))).toBe(true)
    }
  })
})
