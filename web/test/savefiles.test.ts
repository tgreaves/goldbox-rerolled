// Saved games as original files, through a ZIP and back (IMP-006); needs POOLRAD for a real save.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { charStem, crc32, rosterFrom, saveFiles, savesFrom, unzip, zip } from '../src/store/savefiles'
import { parseSave } from '../src/data/save'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { itemsFile } from '../src/data/items'
import { effectsFile } from '../src/data/effects'
import { readdirSync } from 'node:fs'

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
    expect(files.map((f) => f.name)).not.toContain('SAVGAMA.GBR') // nothing extra to keep
  })

  it('keeps the journal in a sidecar beside the untouched original files', async () => {
    const dat = new Uint8Array(readFileSync(join(dir, 'SAVGAMA.DAT')))
    const stems = parseSave(dat).party
    const read = (n: string) => existsSync(join(dir, n)) ? new Uint8Array(readFileSync(join(dir, n))) : undefined
    const known = ['journal:30', 'tale:7', 'proc:CI', 'kovel']
    const g = { slot: 'A', dat, label: 'x', savedAt: 0, known, chars: stems.map((s) => ({ sav: read(`${s}.SAV`)!, itm: read(`${s}.ITM`), spc: read(`${s}.SPC`) })) }
    const files = saveFiles(g)
    expect(files.map((f) => f.name)).toContain('SAVGAMA.GBR')
    expect([...files.find((f) => f.name === 'SAVGAMA.DAT')!.data]).toEqual([...dat])
    const back = savesFrom(await unzip(zip(files))).games[0]
    expect(back.known).toEqual(known)
    expect([...back.dat]).toEqual([...dat])
    // without the sidecar (a save straight from DOSBox) the game still loads, with nothing extra
    expect(savesFrom(files.filter((f) => !f.name.endsWith('.GBR'))).games[0].known).toBeUndefined()
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

describe.skipIf(!have)('original format', () => {
  it('writes a loaded save back as the original files', () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    for (const slot of 'AJ') {
      const dat = files.get(`SAVGAM${slot}.DAT`)!
      const stems = parseSave(dat).party
      const e = new Engine(files, {} as Io, 1)
      e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
      stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
      const out = e.toSave(stems)
      expect(out.length).toBe(dat.length)
      // identical except the unused bytes of the 8 × 41-byte stem table (after each name, and unused slots),
      // where the original leaves whatever was in memory
      for (let i = 0; i < dat.length; i++) {
        if (dat[i] === out[i]) continue
        const k = i - 0x3209, slotNo = Math.floor(k / 41)
        expect(k >= 0 && k < 8 * 41 && (slotNo >= stems.length || k % 41 > dat[0x3209 + 41 * slotNo])).toBe(true)
      }
      e.party().forEach((c, i) => {
        expect([...c]).toEqual([...files.get(`${stems[i]}.SAV`)!])
        expect([...itemsFile(e.itemsOf(c))]).toEqual([...(files.get(`${stems[i]}.ITM`) ?? [])])
        // effects: the same records; the in-memory next pointer (bytes 5–8) is written as 0, which the
        // loader ignores (FUN_45c5_0aec reads 9-byte records to end of file and relinks them)
        const spc = files.get(`${stems[i]}.SPC`) ?? new Uint8Array(0)
        const mine = effectsFile(e.effectsOf(c))
        expect(mine.length).toBe(spc.length)
        for (let k = 0; k < spc.length; k++) if (k % 9 < 5) expect(mine[k]).toBe(spc[k])
      })
    }
  })
})
