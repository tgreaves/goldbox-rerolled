// Rules tables by name (docs/multi-game.md, step 3): each game's map read against that game's own
// START.EXE. Needs POOLRAD and COAB.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { COAB_TABLES, POR_TABLES, type TableMap } from '../src/games/tables'
import { ALIGNMENTS, CLASSES, COIN_VALUES, GENDERS, MONEY, RACES, STATUS, installNames } from '../src/data/character'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'

// a describe that skips still collects its body: without the folder, an empty image (its tests do not run)
const image = (dir: string) => (dir && existsSync(dir) ? unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image : new Uint8Array(0))
const bytes = (t: Tables, at: number, n: number) => Array.from({ length: n }, (_, i) => t.b(at + i))
const u32 = (t: Tables, o: number) => (t.w(o) | (t.w(o + 2) << 16)) >>> 0
const pstr = (img: Uint8Array, m: TableMap, at: number) => String.fromCharCode(...img.subarray(m.ds + at + 1, m.ds + at + 1 + img[m.ds + at]))
const xp = (t: Tables, m: TableMap, k: number, L: number) => u32(t, m.xp.at + k * m.xp.row + L * 4)
const thac0 = (t: Tables, m: TableMap, k: number, L: number) => 60 - t.b(m.thac0.at + k * m.thac0.row + L)

const por = process.env.POOLRAD ?? ''
describe.skipIf(!por || !existsSync(por))('Pool of Radiance tables', () => {
  const img = image(por), m = POR_TABLES, t = new Tables(img, m.ds)
  it('hold the values the port used to hard-code', () => {
    expect(bytes(t, m.classBits.at, 8)).toEqual([2, 16, 8, 64, 128, 1, 4, 32])
    expect(bytes(t, m.trainerBits.at, 8)).toEqual([2, 2, 8, 10, 10, 1, 4, 6])
    expect(bytes(t, m.sky.at, 8)).toEqual([0, 15, 12, 11, 13, 10, 9, 14])
  })
  it('name the first spell and item word', () => {
    expect(pstr(img, m, m.spellNames.at)).toBe('Bless')
    expect(pstr(img, m, m.itemWords.at).length).toBeGreaterThan(0)
  })
})

const coab = process.env.COAB ?? ''
describe.skipIf(!coab || !existsSync(coab))('Curse of the Azure Bonds tables (spec/A-games/coab/tables.md)', () => {
  const img = image(coab), m = COAB_TABLES, t = new Tables(img, m.ds)
  it('read the class bits, trainer bits and sky', () => {
    expect(bytes(t, m.classBits.at, 8)).toEqual([0x02, 0x10, 0x08, 0x40, 0x40, 0x01, 0x04, 0x20])
    expect(bytes(t, m.trainerBits.at, 8)).toEqual([2, 2, 8, 0x10, 0x20, 1, 4, 4])
    expect(bytes(t, m.sky.at, 8)).toEqual([0, 15, 4, 11, 13, 2, 9, 14])
  })
  it('read spell 1 and 100, the XP table and THAC0 by their own strides', () => {
    expect(pstr(img, m, m.spellNames.at)).toBe('Bless')
    expect(pstr(img, m, m.spellNames.at + 99 * m.spellNames.row)).toBe('Bestow Curse')
    expect(xp(t, m, 2, 2)).toBe(2001) // fighter level 2
    expect(xp(t, m, 2, 12)).toBe(1000001)
    expect(xp(t, m, 3, 11)).toBe(1050001) // paladin
    expect(xp(t, m, 3, 12)).toBe(0xffffffff)
    expect(thac0(t, m, 2, 12)).toBe(9) // fighter
    expect(thac0(t, m, 5, 1)).toBe(21) // magic-user
  })
  it('read the race classes, with paladin and ranger for humans', () => {
    const o = m.raceClasses.at + 7 * m.raceClasses.row
    const ids = bytes(t, o + 1, t.b(o))
    expect(ids).toContain(3)
    expect(ids).toContain(4)
  })
  it('read the hit dice and saves', () => {
    expect(bytes(t, m.hitDiceSides.at, 8)).toEqual(bytes(new Tables(por && existsSync(por) ? image(por) : img, POR_TABLES.ds), POR_TABLES.hitDiceSides.at, 8))
    expect(bytes(t, m.saves.at + 0 * m.saves.row + 1 * 5, 5)).toEqual([10, 13, 14, 16, 15]) // cleric level 1
  })
})

describe('name and coin tables', () => {
  it.each([['POOLRAD', POR], ['COAB', COAB]] as const)('read from %s START.EXE', (env, g) => {
    const dir = process.env[env] ?? ''
    if (!dir || !existsSync(dir)) return
    setGame(g)
    installNames(image(dir))
    expect(RACES).toEqual(['Monster', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling', 'Half-Orc', 'Human'])
    expect(CLASSES.length).toBe(18)
    expect([CLASSES[3], CLASSES[9], CLASSES[17]]).toEqual(['Paladin', 'Cleric/Fighter/Magic-User', 'Monster'])
    expect([ALIGNMENTS[0], ALIGNMENTS[8]]).toEqual(['Lawful Good', 'Chaotic Evil'])
    expect(STATUS[8]).toBe('Gone')
    expect(GENDERS).toEqual(['Male', 'Female'])
    expect(MONEY).toEqual(['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum', 'Gems', 'Jewelry'])
    expect(COIN_VALUES).toEqual([1, 10, 100, 200, 1000])
    setGame(POR)
  })
})

describe('frame tiles', () => {
  it('PoR keeps its rope; CotAB reads its white frame from the tables (0x1330)', async () => {
    const { borderTiles, screenFrame } = await import('../src/games/frametiles')
    setGame(POR)
    expect(borderTiles(null)).toEqual({ tl: 20, t: 22, tr: 20, l: 21, r: 21, bl: 20, b: 22, br: 20 })
    const dir = process.env.COAB ?? ''
    if (!dir || !existsSync(dir)) return
    setGame(COAB)
    const img = image(dir)
    expect(borderTiles(img)).toEqual({ tl: 30, t: 31, tr: 32, l: 32, r: 32, bl: 31, b: 31, br: 33 })
    const sf = screenFrame(img, [3, 8])!
    expect([sf.at(5, 3), sf.at(5, 5), sf.at(0, 23)]).toEqual([31, -1, 31])
    setGame(POR)
  })
  it('SotSB draws bars of fixed tiles, capped where a column meets a row (0x19D0, 0x1A90)', async () => {
    const { borderTiles, screenFrame, frameMask } = await import('../src/games/frametiles')
    setGame(SOTSB)
    expect(borderTiles(null)).toEqual({ tl: 55, t: 55, tr: 55, l: 53, r: 53, bl: 55, b: 55, br: 55 })
    expect(frameMask()).toBe(13)
    const sf = screenFrame(null, [16])!
    expect([0, 1, 2, 15, 16, 17, 22, 23].map((r) => sf.at(0, r))).toEqual([55, 52, 53, 54, 55, 52, 54, 55])
    expect([sf.at(39, 1), sf.at(20, 16), sf.at(20, 5)]).toEqual([52, 55, -1])
    setGame(POR)
  })
})

// battle placement's scan tables (PoR FUN_34c7_1577, CotAB 0x26010): the same values in both games
const PLACE = {
  ring: [8, 4, 6, 2, 8, 6, 4, 0, 8, 0, 6, 2, 8, 2, 0, 4], orient: [0, 0, 2, 6, 2, 2, 0, 4, 4, 4, 2, 6, 6, 6, 4, 0], vec: [7, 2, 3, 6],
  ox: [5, 4, 5, 6, 3, 8, 7, 2], oy: [3, 2, 2, 3, 0, 2, 5, 3],
  allow: [1, 0, 1, 0, 1, 0, 2, 9, 3, 10, 4, 10, 0, 2, 0, 3, 1, 4, 2, 5, 3, 6, 4, 7, 0, 6, 0, 7, 1, 8, 1, 0, 1, 0, 1, 0, 3, 6, 4, 7, 5, 8, 6, 9, 7, 10, 8, 10, 0, 6, 0, 7, 1, 8, 2, 9, 3, 10, 4, 10],
}
for (const [dir, m, name] of [[por, POR_TABLES, 'PoR'], [coab, COAB_TABLES, 'CotAB']] as const) {
  describe.skipIf(!dir || !existsSync(dir))(`${name} placement tables`, () => {
    it('read the ring directions, orientations, vectors, origins and allowed columns', () => {
      const t = new Tables(image(dir), m.ds)
      expect(bytes(t, m.placeRing.at, 16)).toEqual(PLACE.ring)
      expect(bytes(t, m.placeOrient.at, 16)).toEqual(PLACE.orient)
      expect(bytes(t, m.placeVec.at, 4)).toEqual(PLACE.vec)
      expect(bytes(t, m.placeOriginX.at, 8)).toEqual(PLACE.ox)
      expect(bytes(t, m.placeOriginY.at, 8)).toEqual(PLACE.oy)
      expect(bytes(t, m.placeAllow.at, 60)).toEqual(PLACE.allow)
    })
  })
}
