// What the originals were seen to do in DOSBox (spec/VALIDATION.md §4), checked headless: SotSB's opening
// gives experience for the mayor's treasure through the aftermath and its camp Save counts saves; CotAB
// and SotSB saves keep the wall sets in their own slots, never in ECL A; the summary's lines by game.
// Needs SOTSB, COAB and POOLRAD for their parts.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'
import { loadFolder, runScript } from '../headless/harness'
import { parseCharacter } from '../src/data/character'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { treasureAftermath } from '../src/rules/combat'

const sotsb = process.env.SOTSB ?? '', coab = process.env.COAB ?? '', por = process.env.POOLRAD ?? ''
const word = (d: Uint8Array, ecl: number) => d[1 + 2 * (ecl - 0x4900)] | (d[2 + 2 * (ecl - 0x4900)] << 8)

afterAll(() => setGame(POR))

describe.skipIf(!sotsb || !existsSync(sotsb))('SotSB against the original (DOSBox)', () => {
  it('the opening\'s treasure gives each member 2500 experience and the save matches the original\'s', async () => {
    setGame(SOTSB)
    const events: { event: string; [k: string]: unknown }[] = []
    const r = await runScript({ files: loadFolder(SOTSB, sotsb), script: { game: 'sotsb', answers: Array(11).fill(0) }, out: (e) => events.push(e), saveAs: 'B' })
    expect(r.end).toBe('script')
    // the original's screen after "WE SCRAPED TOGETHER…": EACH CHARACTER RECEIVES 2500 EXPERIENCE POINTS. THE PARTY HAS FOUND TREASURE!
    expect(events.find((e) => e.event === 'summary')?.messages).toEqual(['Each character receives 2500 experience points.', 'The party has found treasure!'])
    const xp = r.saved!.filter((f) => f.name.endsWith('.SAV')).map((f) => parseCharacter(f.data).exp)
    // the original's CHRDATB*.SAV: the paladin and the ranger take the 10 % too (0x2381E), MALACHITE's two classes half
    expect(xp).toEqual([202750, 202750, 202750, 101250, 202750, 202750])
    const dat = r.saved!.find((f) => f.name === 'SAVGAMB.DAT')!.data
    expect(word(dat, 0x4a3c)).toBe(1) // the camp Save's counter (0x390C5)
    expect(word(dat, 0x4afd)).toBe(0xff) // the opening's SAVE #255, not a wall-set slot number
    expect([...dat.subarray(0x1408, 0x1414)]).toEqual([0x15, 0, 1, 0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
  })
})

describe.skipIf(!sotsb || !existsSync(sotsb))('SotSB saves in the mines', () => {
  it('put the file digit in B 0x6E12, which the original\'s loader takes as the block (0x4243A, 0x41F66)', async () => {
    setGame(SOTSB)
    const files = loadFolder(SOTSB, sotsb)
    // block 2's entry record 48 loads the mine's map and wall sets and goes on to the temple level (51)
    const r = await runScript({ files, script: { game: 'sotsb', answers: Array(19).fill(0), jump: [2, 48, 3, 3, 1] }, out: () => {}, saveAs: 'B' })
    const dat = r.saved!.find((f) => f.name === 'SAVGAMB.DAT')!.data
    expect([dat[0], dat[0x801 + 2 * 0x312]]).toEqual([2, 2])
    const e = new Engine(files, new Proxy({}, { get: () => async () => 0 }) as unknown as Io)
    e.loadSave(dat, r.saved!.filter((f) => f.name.endsWith('.SAV')).map((f) => f.data))
    expect([e.block, e.area]).toEqual([2, 51])
  })
})

describe.skipIf(!coab || !existsSync(coab))('CotAB saves', () => {
  it('keep the wall sets out of ECL A, where 0x4AFD is the won flag', async () => {
    setGame(COAB)
    const r = await runScript({ files: loadFolder(COAB, coab), script: { game: 'coab', answers: [0, 0] }, out: () => {}, saveAs: 'B' })
    const dat = r.saved!.find((f) => f.name === 'SAVGAMB.DAT')!.data
    for (let a = 0x4afa; a < 0x4b00; a++) expect(word(dat, a)).toBe(0)
    const sets = [0, 1, 2].map((i) => dat[0x3208 + 4 * i + 2] | (dat[0x3208 + 4 * i + 3] << 8))
    const recs = parseSave(dat).wallSets
    sets.forEach((s, i) => expect(s).toBe(recs[i] === 0xffff ? 0xffff : i + 1))
  })
})

describe.skipIf(!por || !existsSync(por))('the summary without enemies (PoR FUN_2e08_0916)', () => {
  it('says "found Treasure!" in place of the outcome', async () => {
    setGame(POR)
    const files = loadFolder(POR, por)
    const dat = files.get('SAVGAMA.DAT')!
    const io = new Proxy({}, { get: () => async () => 0 }) as unknown as Io
    const e = new Engine(files, io)
    e.loadSave(dat, parseSave(dat).party.map((s) => files.get(`${s}.SAV`)!))
    e.money = [0, 0, 0, 600, 0, 0, 0]
    const before = e.party().map((c) => parseCharacter(c).exp)
    const r = treasureAftermath(e)
    expect(r.messages[0]).toBe('The party has found Treasure!')
    expect(r.messages).not.toContain('The party has won.')
    expect(r.share).toBe(Math.floor(600 / e.party().length))
    expect(e.party().map((c) => parseCharacter(c).exp).some((x, i) => x > before[i])).toBe(true)
  })
})

// the previous game state byte (CotAB 0x3206, SotSB 0x1406), as the originals wrote it in DOSBox
// (spec/VALIDATION.md §4): CotAB 0 begun from save A (its state byte 0), SotSB 4 after the opening (its
// area change entered: 0x2187C), both 2 after loading a save made in camp (the loader: 0x3615C, 0x41FF7)
describe('the previous game state in a save', () => {
  const io = new Proxy({}, { get: () => async () => 0 }) as unknown as Io
  const again = (files: ReturnType<typeof loadFolder>, saved: { name: string; data: Uint8Array }[], dat: Uint8Array) => {
    const e = new Engine(files, io)
    e.loadSave(dat, saved.filter((f) => f.name.endsWith('.SAV')).map((f) => f.data))
    return e.toSave(parseSave(dat).party)
  }
  it.skipIf(!sotsb || !existsSync(sotsb))('SotSB: 4 after the opening, 2 after a load', async () => {
    setGame(SOTSB)
    const files = loadFolder(SOTSB, sotsb)
    const r = await runScript({ files, script: { game: 'sotsb', answers: Array(11).fill(0) }, out: () => {}, saveAs: 'B' })
    const dat = r.saved!.find((f) => f.name === 'SAVGAMB.DAT')!.data
    expect([dat[0x1406], dat[0x1407]]).toEqual([4, 2])
    expect(again(files, r.saved!, dat)[0x1406]).toBe(2)
  })
  it.skipIf(!coab || !existsSync(coab))('CotAB: 0 from save A, 2 after a load', async () => {
    setGame(COAB)
    const files = loadFolder(COAB, coab)
    const r = await runScript({ files, script: { game: 'coab', answers: [0, 0] }, out: () => {}, saveAs: 'B' })
    const dat = r.saved!.find((f) => f.name === 'SAVGAMB.DAT')!.data
    expect([dat[0x3206], dat[0x3207]]).toEqual([0, 2])
    expect(again(files, r.saved!, dat)[0x3206]).toBe(2)
  })
})
