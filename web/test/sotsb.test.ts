// Secret of the Silver Blades' profile against its own files (docs/multi-game.md, SotSB steps 1–5): detection,
// the character map on the pre-made party, the table map on START.EXE, and the shipped save. Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { POR, COAB, SOTSB, detect, setGame, wants } from '../src/games/profile'
import { SOTSB_FIELDS as F } from '../src/games/fields'
import { SOTSB_TABLES as m } from '../src/games/tables'
import { parseSave, saveBlock } from '../src/data/save'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { GameText, mergedImage } from '../src/data/gametext'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)

describe('Silver Blades detection', () => {
  it('by BLADES.CFG, else by the most marker files', () => {
    expect(detect(['ECL1.DAX', 'blades.cfg'])).toBe(SOTSB)
    expect(detect(['SOUND.DAX', 'SKY.DAX', 'BIGPIC1.DAX', 'GEO1.DAX', 'WALLDEF1.DAX', 'ECL1.DAX'])).toBe(SOTSB)
    expect(detect(['GEO1.DAX', 'SQRPACI.DAX', 'BACPAC.DAX', 'WALLDEF1.DAX'])).toBe(POR)
    expect(detect(['SKY.DAX', 'BIGPIC1.DAX', 'TILES.DAX'])).toBe(COAB)
  })
})

function load(): GameFiles {
  const files = new Map<string, Uint8Array>()
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (wants(SOTSB, n)) files.set(n.toUpperCase(), new Uint8Array(readFileSync(p)))
    }
  }
  walk(dir)
  return new GameFiles(files, SOTSB)
}

const io = {
  print: () => {}, menu: async () => 0, inputNumber: async () => 0, inputText: async () => 'TEST', picture: () => {},
  sprite: () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {}, engine: async () => {},
} as unknown as Io

describe.skipIf(!have)('Silver Blades files', () => {
  afterAll(() => setGame(POR))
  const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
  const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0

  it('pictures come from the files the loaders name: SPRIT1 and CPIC1 in every block, PIC4 and PIC5 for theirs (0x596CE, 0x5D59E)', () => {
    const f = load()
    for (const block of [1, 2, 3]) {
      expect(f.picture('CPIC', block, 1)).toBeDefined()
      expect(f.picture('SPRIT', block, 1)).toBeDefined()
    }
    for (const [id, file] of [[0x06, 4], [0x59, 4], [0x01, 5], [0x4d, 5], [0x13, 2]]) {
      expect(f.picture('PIC', 2, id)).toEqual(f.record(`PIC${file}`, id))
      expect(f.picture('PIC', 2, id)).toBeDefined()
    }
    // every PIC record is reached from some block, and each file holds only the records sent to it
    for (const n of [4, 5]) for (const { id } of f.dax(`PIC${n}`)!.entries) expect(f.picture('PIC', 1, id)).toEqual(f.record(`PIC${n}`, id))
  })

  it('read the pre-made party through the 439-byte map (spec/A-games/sotsb/records.md §2.1)', () => {
    const want = [
      ['Guy de Valois ', 6, 3, [0, 0, 0, 8, 0, 0, 0], 95, 200000], ['PAINE', 6, 4, [0, 0, 0, 0, 8, 0, 0], 74, 200000],
      ['EPONA', 6, 2, [0, 0, 8, 0, 0, 0, 0], 91, 200000], ['MALACHITE', 3, 14, [0, 0, 7, 0, 0, 0, 8], 58, 100000],
      ['DOMINIC', 6, 0, [8, 0, 0, 0, 0, 0, 0], 78, 200000], ['MORGAINE', 6, 5, [0, 0, 0, 0, 0, 9, 0], 35, 200000],
    ] as const
    want.forEach(([nm, race, cls, levels, hp, xp], i) => {
      const c = new Uint8Array(readFileSync(join(dir, `CHRDATA${i + 1}.SAV`)))
      expect(c.length).toBe(F.size)
      expect(name(c)).toBe(nm)
      expect([c[F.race], c[F.cls]]).toEqual([race, cls])
      expect([...c.subarray(F.levels, F.levels + F.classCount)]).toEqual(levels)
      expect(c[F.hitDice]).toBe(Math.max(...levels))
      expect([c[F.maxHp], c[F.hp]]).toEqual([hp, hp])
      expect(u32(c, F.xp)).toBe(xp)
      expect([c[F.status], c[F.itemCount]]).toEqual([0, 0])
    })
    const guy = new Uint8Array(readFileSync(join(dir, 'CHRDATA1.SAV')))
    expect([guy[F.stat[0]], guy[F.strPct]]).toEqual([18, 100])
  })

  it('read START.EXE through the table map (spec/A-games/sotsb/tables.md)', () => {
    const img = unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
    const t = new Tables(img, m.ds)
    const b = (at: number, n: number) => Array.from({ length: n }, (_, i) => t.b(at + i))
    const p = (at: number) => String.fromCharCode(...img.subarray(m.ds + at + 1, m.ds + at + 1 + img[m.ds + at]))
    const u32t = (o: number) => (t.w(o) | (t.w(o + 2) << 16)) >>> 0
    expect(b(m.classBits.at, 7)).toEqual([2, 16, 8, 64, 64, 1, 4]) // no monk
    expect(b(m.trainerBits.at, 7)).toEqual([2, 2, 8, 16, 32, 1, 4])
    expect(b(m.sky.at, 8)).toEqual([0, 15, 4, 11, 13, 2, 9, 14])
    expect(b(m.hitDiceSides.at, 7)).toEqual([8, 8, 10, 10, 8, 4, 6])
    expect(b(m.hitDiceStop.at, 7)).toEqual([10, 15, 10, 10, 11, 12, 11])
    expect([p(m.spellNames.at), p(m.spellNames.at + 115 * m.spellNames.row)]).toEqual(['Bless', 'Mass Invisibility'])
    expect([p(m.raceNames.at + m.raceNames.row), p(m.raceNames.at + 6 * m.raceNames.row)]).toEqual(['Elf', 'Human'])
    expect([p(m.classNames.at), p(m.statusNames.at + 7 * m.statusNames.row), p(m.templeNames.at)]).toEqual(['Cleric', 'Petrified', 'Cure Blindness'])
    const xp = (k: number, L: number) => u32t(m.xp.at + k * m.xp.row + L * 4)
    expect([xp(2, 2), xp(2, 15), xp(2, 16)]).toEqual([2001, 1750001, 0xffffffff]) // fighter to level 15
    expect(60 - t.b(m.thac0.at + 2 * m.thac0.row + 12)).toBe(9)
    expect(b(m.saves.at + 1 * 5, 5)).toEqual([10, 13, 14, 16, 15]) // cleric level 1
  })

  it('load the shipped save (5 469 bytes, no code buffer) and write it back in its own layout', () => {
    setGame(SOTSB)
    const files = load()
    const dat = files.get('SAVGAMA.DAT')!
    expect(dat.length).toBe(5469)
    const sv = parseSave(dat)
    expect(sv.party).toEqual(['CHRDATA1', 'CHRDATA2', 'CHRDATA3', 'CHRDATA4', 'CHRDATA5', 'CHRDATA6'])
    expect(sv.code.length).toBe(0)
    const e = new Engine(files, io, 1)
    e.loadSave(dat, sv.party.map((st) => files.get(`${st}.SAV`)!))
    sv.party.forEach((st, i) => e.attachFiles(i, files.get(`${st}.STF`), files.get(`${st}.SFX`)))
    expect(e.effectsOf(e.party()[3]).map((x) => x.type)).toEqual([0x2f, 0x1a, 0x61]) // MALACHITE's .SFX
    expect([saveBlock(sv), e.block, e.area]).toEqual([1, 2, 17]) // area 0: the new game's start, record 17 of block 2 (0x21934)
    const back = e.toSave(sv.party)
    expect(back.length).toBe(5469)
    // the shipped save is a start-of-game save (area 0): written back after the start-up's conversion it holds
    // block 2 and record 17 (as the original's would), so the round trip is checked field by field
    const again = parseSave(back)
    expect(again.party).toEqual(sv.party)
    expect([again.x, again.y, again.facing2]).toEqual([sv.x, sv.y, sv.facing2])
    expect([back[0], saveBlock(again)]).toEqual([2, 2]) // the file digit DS:7420, also in B + 0x312 (0x4243A), which the loader reads (0x41F66)
    expect(again.A.subarray(0, 0xf0)).toEqual(sv.A.subarray(0, 0xf0))
    const e2 = new Engine(files, io, 1)
    e2.loadSave(back, again.party.map((st) => files.get(`${st}.SAV`)!))
    expect([e2.block, e2.area]).toEqual([2, 17]) // loaded back where it was saved
  })

  it("the view's closed-edge areas are the two the wall lookup tests (0x5A51D, 0x5A524: cmpb $n, DS:A4C2)", () => {
    const img = mergedImage(new Uint8Array(readFileSync(join(dir, 'START.EXE'))), new Uint8Array(readFileSync(join(dir, 'GAME.OVR'))))
    const cmp = (at: number) => { expect([...img.subarray(at, at + 4)]).toEqual([0x80, 0x3e, 0xc2, 0xa4]); return img[at + 4] }
    expect(SOTSB.view.closedEdges).toEqual([cmp(0x5a51d), cmp(0x5a524)])
  })

  it('every message and menu the profile addresses reads as a string of the merged image', () => {
    const t = new GameText(mergedImage(new Uint8Array(readFileSync(join(dir, 'START.EXE'))), new Uint8Array(readFileSync(join(dir, 'GAME.OVR')))))
    const all: [string, number][] = [
      ...Object.entries(SOTSB.strings).flatMap(([id, a]) => (Array.isArray(a) ? a : [a as number]).map((x): [string, number] => [id, x])),
      ...Object.entries(SOTSB.menus).map(([id, a]): [string, number] => [`menu ${id}`, a as number]),
    ]
    for (const [id, a] of all) expect(t.read(a), `${id} at ${a.toString(16)}`).not.toBeNull()
    expect(t.read(0x225e0)).toBe('is not blind')
    expect([0x21c3a, 0x21c3f, 0x21c45].map((a) => t.read(a)).join('')).toBe('View Take Pool Exit')
  })
})
