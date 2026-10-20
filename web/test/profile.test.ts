// Game profiles (docs/multi-game.md, step 1): which game a folder is, and what the port keeps from it.
// The folder tests need POOLRAD and COAB (the Curse of the Azure Bonds folder).
import { describe, expect, it } from 'vitest'
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { detect, COAB, POR, wants } from '../src/games/profile'
import { GameFiles } from '../src/store/gamefiles'

/** every file name under a folder, subfolders flattened as the folder picker gives them */
function names(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? names(join(dir, n)) : [n]))
}

describe('game detection', () => {
  it('goes by the configuration file, else by files only one game has', () => {
    expect(detect(['ECL1.DAX', 'POOL.CFG'])).toBe(POR)
    expect(detect(['ecl1.dax', 'curse.cfg'])).toBe(COAB)
    expect(detect(['ECL1.DAX', 'GEO1.DAX', 'SQRPACI.DAX'])).toBe(POR)
    expect(detect(['ECL1.DAX', 'GEO2.DAX', 'SKY.DAX'])).toBe(COAB)
    expect(detect(['README.TXT'])).toBeUndefined()
  })

  it('needs each game\'s own minimum set', () => {
    const m = (list: string[]) => new Map(list.map((n) => [n, new Uint8Array(0)]))
    expect(new GameFiles(m(['POOL.CFG', 'ECL1.DAX', 'GEO1.DAX', '8X8D1.DAX', 'WALLDEF1.DAX'])).complete()).toBe(true)
    // CotAB has no block 1 of GEO or WALLDEF
    expect(new GameFiles(m(['CURSE.CFG', 'ECL1.DAX', 'GEO2.DAX', '8X8D1.DAX', 'WALLDEF2.DAX', 'SKY.DAX'])).complete()).toBe(true)
    expect(new GameFiles(m(['CURSE.CFG', 'ECL1.DAX', 'GEO2.DAX', '8X8D1.DAX', 'WALLDEF2.DAX', 'SKY.DAX'])).game).toBe(COAB)
    expect(new GameFiles(m(['ECL1.DAX', 'GEO2.DAX', '8X8D1.DAX', 'WALLDEF2.DAX']), POR).complete()).toBe(false)
  })

  it('keeps the two games apart in storage', () => {
    expect(POR.stores).toEqual({ files: 'poolrad', user: 'poolrad-user' }) // as before profiles existed
    expect(COAB.stores.files).not.toBe(POR.stores.files)
    expect(COAB.stores.user).not.toBe(POR.stores.user)
  })
})

const por = process.env.POOLRAD ?? ''
const coab = process.env.COAB ?? ''

describe.skipIf(!por || !existsSync(por))('Pool of Radiance folder', () => {
  it('is detected and complete', () => {
    const list = names(por)
    expect(detect(list)).toBe(POR)
    const kept = list.filter((n) => wants(POR, n))
    expect(new GameFiles(new Map(kept.map((n) => [n.toUpperCase(), new Uint8Array(0)]))).complete()).toBe(true)
  })
})

describe.skipIf(!coab || !existsSync(coab))('Curse of the Azure Bonds folder', () => {
  it('is detected and complete, with the pre-made party from SAVE/', () => {
    const list = names(coab)
    expect(detect(list)).toBe(COAB)
    const kept = list.filter((n) => wants(COAB, n)).map((n) => n.toUpperCase())
    const f = new GameFiles(new Map(kept.map((n) => [n, new Uint8Array(0)])))
    expect(f.game).toBe(COAB)
    expect(f.complete()).toBe(true)
    for (const n of ['CHRDATA1.SAV', 'CHRDATA1.FX', 'SAVGAMA.DAT', 'GAME.OVR', 'START.EXE', 'ITEMS']) expect(kept).toContain(n)
    expect(kept.some((n) => n.endsWith('.PDF') || n.endsWith('.EXE') && n !== 'START.EXE')).toBe(false)
  })
})
