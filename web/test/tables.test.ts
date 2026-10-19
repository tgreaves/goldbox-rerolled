// Rules tables by name (docs/multi-game.md, step 3): each game's map read against that game's own
// START.EXE. Needs POOLRAD and COAB.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { COAB_TABLES, POR_TABLES, type TableMap } from '../src/games/tables'

const image = (dir: string) => unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
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
describe.skipIf(!coab || !existsSync(coab))('Curse of the Azure Bonds tables (spec/coab/tables.md)', () => {
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
