// Saved games as original files, through a ZIP and back (IMP-006); needs POOLRAD for a real save.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { charStem, crc32, rosterFrom, saveFiles, savesFrom, unzip, zip } from '../src/store/savefiles'
import { parseSave } from '../src/data/save'

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('reads back what it writes', async () => {
    const files = [{ name: 'A.TXT', data: new Uint8Array([1, 2, 3]) }, { name: 'B.BIN', data: new Uint8Array(0) }]
    const back = await unzip(zip(files))
    expect(back.map((f) => [f.name, [...f.data]])).toEqual([['A.TXT', [1, 2, 3]], ['B.BIN', []]])
  })
})

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('save files', () => {
  it('exports a shipped save under its own names and imports it again', async () => {
    const dat = new Uint8Array(readFileSync(join(dir, 'SAVGAMA.DAT')))
    const stems = parseSave(dat).party
    const read = (n: string) => existsSync(join(dir, n)) ? new Uint8Array(readFileSync(join(dir, n))) : undefined
    const g = { slot: 'A', dat, label: 'x', savedAt: 0, chars: stems.map((s) => ({ sav: read(`${s}.SAV`)!, itm: read(`${s}.ITM`), spc: read(`${s}.SPC`) })) }
    const files = saveFiles(g)
    expect(files[0].name).toBe('SAVGAMA.DAT')
    expect(files.map((f) => f.name)).toContain(`${stems[0]}.SAV`)
    const { games, missing } = savesFrom(await unzip(zip(files)))
    expect(missing).toEqual([])
    expect(games).toHaveLength(1)
    expect(games[0].slot).toBe('A')
    expect([...games[0].dat]).toEqual([...dat])
    expect([...games[0].chars[0].sav]).toEqual([...g.chars[0].sav])
  })
})

describe('roster files', () => {
  it('reads <stem>.CHA/.ITM/.SPC as charlist.txt names them', () => {
    const rec = (name: string) => { const r = new Uint8Array(0x11d); r[0] = name.length; r.set([...name].map((ch) => ch.charCodeAt(0)), 1); return r }
    expect(charStem('SIR BOB.THE, BOLD')).toBe('SIRBOBTH')
    const files = [
      { name: 'charlist.txt', data: new TextEncoder().encode('SIR BOB\r\nELMO\r\n') },
      { name: 'SIRBOB.CHA', data: rec('SIR BOB') }, { name: 'SIRBOB.ITM', data: new Uint8Array(63) },
      { name: 'OTHER.CHA', data: rec('OTHER') },
    ]
    const { chars, missing } = rosterFrom(files)
    expect(chars.map((c) => c.stem)).toEqual(['SIRBOB'])
    expect(chars[0].itm?.length).toBe(63)
    expect(missing).toEqual(['ELMO.CHA'])
    expect(rosterFrom(files.slice(1)).chars.map((c) => c.stem).sort()).toEqual(['OTHER', 'SIRBOB'])
  })
})
