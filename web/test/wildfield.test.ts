// Wilderness battlefields (spec/combat.md, "Wilderness battlefields"; spec/coab/combat.md).
// PoR: a regression check with seeded dice, so a change to the shared generator leaves PoR's fields as
// they were (fingerprints taken from the port before the generator became parametric, 2026-10-20).
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { cellTable, wildField, wildBattlefield, type Roll } from '../src/rules/battlefield'
import { COAB_RULES, POR_RULES, type WildFieldSpec, type WildPass } from '../src/games/rules'
import { COAB_TABLES, POR_TABLES, T } from '../src/games/tables'
import { unexepack } from '../src/data/exepack'

/** deterministic 1dN from a seed (a 32-bit LCG; not the original's RNG) */
export function seeded(seed: number): Roll {
  let s = seed >>> 0
  return (n: number) => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return ((s >>> 16) % n) + 1
  }
}

/** FNV-1a over the cells */
export function fingerprint(cells: Uint8Array): string {
  let h = 0x811c9dc5
  for (const v of cells) h = Math.imul(h ^ v, 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0')
}

// every flag byte PoR's tile table gives (FUN_34c7_08a4), plus 0
const POR_FLAGS = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x08, 0x09, 0x11, 0x12, 0x14, 0x18, 0x20, 0x21, 0x28, 0x40, 0x41, 0x44, 0x48, 0x60, 0x80, 0x81, 0x88, 0x90, 0xa0]

const POR_PRINTS: Record<string, string> = {
  '0/1': '41b1bbc4', '0/77': '52b485ad', '0/4242': 'c314b8aa', '1/1': '41b1bbc4', '1/77': '52b485ad', '1/4242': 'c314b8aa',
  '2/1': 'ab12c132', '2/77': 'b12f41e1', '2/4242': '87e47c37', '3/1': 'ab12c132', '3/77': 'b12f41e1', '3/4242': '87e47c37',
  '4/1': 'a2f11db3', '4/77': '7df0a085', '4/4242': 'd4e00379', '5/1': 'a2f11db3', '5/77': '7df0a085', '5/4242': 'd4e00379',
  '8/1': '273ab0f2', '8/77': '99633fbf', '8/4242': '4c012994', '9/1': '273ab0f2', '9/77': '99633fbf', '9/4242': '4c012994',
  '11/1': 'b9a46d51', '11/77': 'e7b645b6', '11/4242': '4f2cd5e6', '12/1': 'da5204ed', '12/77': '96bce668', '12/4242': '804f5c4f',
  '14/1': '7fa1a85e', '14/77': 'd717b096', '14/4242': '5244a5b7', '18/1': '5638de7a', '18/77': '1c90cc90', '18/4242': '65ac5309',
  '20/1': '5f5f2a32', '20/77': '81034375', '20/4242': '4f2cd5e6', '21/1': '5f5f2a32', '21/77': '81034375', '21/4242': '4f2cd5e6',
  '28/1': 'acdb7adc', '28/77': 'e9e48d5a', '28/4242': '65ac5309', '40/1': '30321a33', '40/77': 'd50ab00d', '40/4242': '59b056a9',
  '41/1': '30321a33', '41/77': 'd50ab00d', '41/4242': '59b056a9', '44/1': '23487a84', '44/77': '55302adb', '44/4242': 'c7b8a77a',
  '48/1': '7988dc90', '48/77': '87202e24', '48/4242': '39ab9fc6', '60/1': '381385f7', '60/77': '97da1707', '60/4242': 'c705ea8d',
  '80/1': 'b5e16ab9', '80/77': 'dc1520e8', '80/4242': '523ccd3c', '81/1': 'b5e16ab9', '81/77': 'dc1520e8', '81/4242': '523ccd3c',
  '88/1': 'b5e16ab9', '88/77': 'dc1520e8', '88/4242': '523ccd3c', '90/1': '496cf86f', '90/77': '11e19da1', '90/4242': 'deace1a6',
  'a0/1': '7178db6d', 'a0/77': 'eaac129a', 'a0/4242': 'deace1a6',
}

describe('PoR wilderness battlefield (seeded regression)', () => {
  it('builds the same fields as before for every flag byte and three seeds', () => {
    const got: Record<string, string> = {}
    for (const f of POR_FLAGS) for (const seed of [1, 77, 4242]) got[`${f.toString(16)}/${seed}`] = fingerprint(wildField(f, seeded(seed), POR_RULES.wildField).cells)
    expect(got).toEqual(POR_PRINTS)
  })

  it('classifies the overland tile first (arid tile with ECL 0x4AB3 = 0xFF)', () => {
    expect(fingerprint(wildBattlefield(0x6d, 0xff, seeded(5), POR_RULES.wildField).cells)).toBe(fingerprint(wildField(0x01, seeded(5), POR_RULES.wildField).cells))
  })
})

// ---------------------------------------------------------------------------------------------------
// CotAB (spec/coab/combat.md): its own passes, cell for cell against the transcription.

const COAB_FIELD = COAB_RULES.wildField
const only = (pass: WildPass['pass']): WildFieldSpec => ({ ...COAB_FIELD, passes: COAB_FIELD.passes.filter((p) => p.pass === pass) })

/** dice from a script of [sides, value]; each call must ask for the sides scripted; then `rest(sides)` */
function scripted(script: [number, number][], rest: (sides: number) => number = (n) => n) {
  const asked: number[] = []
  const roll: Roll = (n) => {
    asked.push(n)
    const next = script.shift()
    if (!next) return rest(n)
    expect(n, `die ${asked.length}`).toBe(next[0])
    return next[1]
  }
  return { roll, asked, left: () => script.length }
}

const cell = (bf: { get(r: number, c: number): number }, r: number, c: number) => bf.get(r, c)

/**
 * The CotAB wilderness generator transcribed from the disassembly, one statement per instruction group:
 * 0x25C58 (fill), 0x25690 + 0x2563C (river), 0x2579B (trees), 0x25ADA + 0x25932 (scatter). The grid is
 * the original's flat array (row·50 + col); roll(count, sides) is the game's 0xE3:0x4D.
 */
function coabReference(flags: number, d: Roll): Uint8Array {
  const g = new Uint8Array(1250).fill(0x17)
  const roll = (count: number, sides: number) => { let s = 0; for (let i = 0; i < count; i++) s += d(sides); return s }
  const slot16 = (v: number) => v === 0x17 || v === 0x36 // DS:26A7[v·4] = 0x16
  const flag = (b: number) => (flags & b) !== 0 // 0x25621
  // 0x25690
  let chance = 0
  if (flag(0x20)) chance = 0x23
  if (flag(0x10)) chance = 0x4b
  if (roll(1, 0x64) <= chance) {
    let c = 0x22 - roll(5, 4)
    while ((c + 2) % 7 > 0) c--
    for (let row = 0; row <= 0x18; row++) {
      if (c <= 0x31) {
        g[row * 50 + c] = roll(1, 2) + 0x3b
        if (c < 0x31) g[row * 50 + c + 1] = roll(1, 2) + 0x3d
        if (roll(1, 0x14) === 1) { // 0x2563C(row, c)
          if (c < 0x31) g[row * 50 + c + 1] = 0x40
          if (row < 0x18 && c < 0x31) g[(row + 1) * 50 + c + 1] = 0x41
        }
        c++
      }
    }
  }
  // 0x2579B
  if (!flag(0x80)) {
    let ch = 0x0a
    if (flag(0x02)) ch -= 5
    if (flag(0x04)) ch -= 2
    if (flag(0x40)) ch += 5
    if (flag(0x08)) ch += 0x0a
    if (ch < 0) ch = 1
    for (let col = 0; col <= 0x31; col++) for (let row = 1; row <= 0x18; row++) {
      if (!slot16(g[row * 50 + col]) || !slot16(g[(row - 1) * 50 + col])) continue
      if (ch < roll(1, 0x64)) continue
      if (ch >= roll(1, 0x64)) g[row * 50 + col] = roll(1, 2) + 0x29
      else {
        g[(row - 1) * 50 + col] = roll(1, 5) + 0x1f
        g[row * 50 + col] = roll(1, 5) + 0x24
      }
    }
  }
  // 0x25ADA
  let v = 0x32
  if (flag(0x10)) v += 0x0a
  if (flag(0x20)) v += 0x1e
  if (flag(0x40)) v += 0x14
  if (flag(0x04)) v -= 0x0a
  if (flag(0x02)) v -= 0x14
  if (flag(0x80)) v -= 0x32
  const put = (col: number, row: number, a: number, b: number, c: number, dd: number, e: number) => { // 0x25932
    const r = roll(1, 0x64)
    let x = -1
    if (r <= a) x = roll(1, 2) + 0x39
    else if (r <= a + b) x = roll(1, 2) + 0x2f
    else if (r <= a + b + c) x = roll(1, 4) + 0x2b
    else if (r <= a + b + c + dd) x = roll(1, 3) + 0x36
    else if (r <= a + b + c + dd + e) x = roll(1, 4) + 0x31
    if (x >= 0) g[row * 50 + col] = x
  }
  for (let col = 0; col <= 0x31; col++) for (let row = 0; row <= 0x18; row++) {
    if (!slot16(g[row * 50 + col])) continue
    if (v >= -0x1e && v <= 9) put(col, row, 0, 0, 0, 0x1e, 0x0f)
    else if (v >= 0x0a && v <= 0x1d) put(col, row, 0, 1, 5, 0x14, 0x0a)
    else if (v >= 0x1e && v <= 0x45) put(col, row, 0, 2, 5, 0x0a, 5)
    else if (v >= 0x46 && v <= 0x59) put(col, row, 0x0a, 2, 0x0a, 0x0a, 1)
    else if (v >= 0x5a && v <= 0x6e) put(col, row, 0x0f, 5, 0x0f, 0x0a, 1)
  }
  return g
}

describe('CotAB wilderness battlefield (0x25C58)', () => {
  it('river 0x25690: halves by d2, a ford by d20 whose lower cell the next row overwrites, no crossing', () => {
    // flag 0x10: 75 %; d100 = 75 runs; 5d4 = 5 → 29 → lowered to 26
    const s = scripted([[100, 75], [4, 1], [4, 1], [4, 1], [4, 1], [4, 1],
      [2, 1], [2, 2], [20, 1], // row 0, col 26: 0x3C, 0x3F, then the ford: (0,27) = 0x40, (1,27) = 0x41
      [2, 2], [2, 1], [20, 2], // row 1, col 27: 0x3D overwrites the 0x41, 0x3E
    ], (n) => (n === 20 ? 20 : 1))
    const bf = wildField(0x10, s.roll, only('riverHalves'))
    expect([cell(bf, 0, 26), cell(bf, 0, 27)]).toEqual([0x3c, 0x40])
    expect([cell(bf, 1, 27), cell(bf, 1, 28)]).toEqual([0x3d, 0x3e])
    for (let row = 2; row <= 22; row++) expect([cell(bf, row, 26 + row), cell(bf, row, 27 + row)], `row ${row}`).toEqual([0x3c, 0x3e])
    // row 23 at column 49: the left half only, the d20 still rolled; row 24 would be column 50: nothing
    expect(cell(bf, 23, 49)).toBe(0x3c)
    expect(cell(bf, 24, 0)).toBe(0x17)
    expect(Array.from(bf.cells).filter((v) => v !== 0x17)).toHaveLength(2 * 23 + 1)
    expect(s.asked.length).toBe(6 + 23 * 3 + 2)
    expect(s.asked.slice(-2)).toEqual([2, 20])
  })

  it('river: d100 above the chance (35 for flag 0x20) or no river flag draws nothing, after one d100', () => {
    for (const [flags, d] of [[0x20, 36], [0x00, 1], [0x01, 1]] as const) {
      const s = scripted([[100, d]])
      const bf = wildField(flags, s.roll, only('riverHalves'))
      expect(bf.cells.every((v) => v === 0x17)).toBe(true)
      expect(s.asked).toEqual([100])
    }
    // the start column: 34 − 5d4 lowered to 12, 19 or 26
    for (const [sum, start] of [[20, 12], [15, 19], [9, 19], [8, 26], [5, 26]] as const) {
      const dice: [number, number][] = [[100, 1]]
      let left = sum
      for (let i = 0; i < 5; i++) { const k = Math.min(4, left - (4 - i)); dice.push([4, k]); left -= k }
      const bf = wildField(0x10, scripted(dice, (n) => (n === 20 ? 20 : 1)).roll, only('riverHalves'))
      expect(cell(bf, 0, start), `5d4 = ${sum}`).toBe(0x3c)
      expect(cell(bf, 0, start - 1)).toBe(0x17)
    }
  })

  it('trees 0x2579B: columns outer, a log on a second d100 ≤ chance, crown and trunk rolled apart', () => {
    // flags 0: chance 10. (1,0): tree, crown d5 = 3 → (0,0) 0x22, trunk d5 = 5 → (1,0) 0x29; (2,0) has a
    // trunk above: no dice; (3,0): a log, d2 = 2 → 0x2B; every other cell d100 = 100
    const s = scripted([[100, 10], [100, 11], [5, 3], [5, 5], [100, 10], [100, 10], [2, 2]], () => 100)
    const bf = wildField(0, s.roll, only('treesOrLogs'))
    expect([cell(bf, 0, 0), cell(bf, 1, 0), cell(bf, 2, 0), cell(bf, 3, 0)]).toEqual([0x22, 0x29, 0x17, 0x2b])
    expect(Array.from(bf.cells).filter((v) => v !== 0x17)).toHaveLength(3)
    // dice: 7 scripted, then a d100 for every other cell of rows 1–24 with blank ground above; in column 0
    // rows 2 and 4 have the trunk and the log above them, so rows 5–24
    const col0 = 20
    expect(s.asked.length).toBe(7 + col0 + 49 * 24)
    expect(s.asked.slice(7).every((n) => n === 100)).toBe(true)
  })

  it('trees: chance by flags (added), none at all with flag 0x80', () => {
    const s = scripted([])
    wildField(0x80, s.roll, only('treesOrLogs'))
    expect(s.asked).toEqual([])
    for (const [flags, chance] of [[0x02, 5], [0x04, 8], [0x06, 3], [0x40, 15], [0x08, 20], [0x48, 25], [0x4e, 18]] as const) {
      // the first cell's d100 at the chance plants something, one above it does not
      const hit = wildField(flags, scripted([[100, chance], [100, 100], [5, 1], [5, 1]], () => 100).roll, only('treesOrLogs'))
      expect(cell(hit, 1, 0), `flags ${flags}`).toBe(0x25)
      const miss = wildField(flags, scripted([[100, chance + 1]], () => 100).roll, only('treesOrLogs'))
      expect(miss.cells.every((v) => v === 0x17)).toBe(true)
    }
  })

  it('scatter 0x25ADA/0x25932: one d100 per blank cell against the odds the flag score picks', () => {
    // flags 0: score 50 → odds 0, 2, 5, 10, 5. Column 0: rows 0–4 get d100 = 1, 7, 17, 22, 23
    const s = scripted([[100, 1], [2, 2], [100, 7], [4, 4], [100, 17], [3, 3], [100, 22], [4, 1], [100, 23]], () => 100)
    const bf = wildField(0, s.roll, only('scatterOdds'))
    expect([0, 1, 2, 3, 4].map((r) => cell(bf, r, 0))).toEqual([0x31, 0x2f, 0x39, 0x32, 0x17])
    expect(s.asked.length).toBe(9 + 1250 - 5)
    // score 110 (0x10 + 0x20 + 0x40): odds 15, 5, 15, 10, 1 (sum 46)
    const one = (flags: number, script: [number, number][]) => cell(wildField(flags, scripted(script, () => 100).roll, only('scatterOdds')), 0, 0)
    expect(one(0x70, [[100, 15], [2, 1]])).toBe(0x3a)
    expect(one(0x70, [[100, 20], [2, 2]])).toBe(0x31)
    expect(one(0x70, [[100, 35], [4, 1]])).toBe(0x2c)
    expect(one(0x70, [[100, 45], [3, 2]])).toBe(0x38)
    expect(one(0x70, [[100, 46], [4, 4]])).toBe(0x35)
    expect(one(0x70, [[100, 47]])).toBe(0x17)
    // score −30 (0x80 + 0x02 + 0x04): odds 0, 0, 0, 30, 15: pebbles, rocks
    expect(one(0x86, [[100, 1], [3, 1]])).toBe(0x37)
    expect(one(0x86, [[100, 31], [4, 2]])).toBe(0x33)
    expect(one(0x86, [[100, 46]])).toBe(0x17)
  })
})

describe('CotAB wilderness battlefield: whole fields against the transcription', () => {
  it('matches the reference for every flag byte with seeded dice', () => {
    for (let flags = 0; flags < 0x100; flags++) for (const seed of [3, 1001]) {
      const a = wildField(flags, seeded(seed * 257 + flags), COAB_FIELD).cells
      const b = coabReference(flags, seeded(seed * 257 + flags))
      expect(Array.from(a), `flags ${flags.toString(16)} seed ${seed}`).toEqual(Array.from(b))
    }
  })

  it('never writes PoR\'s finishing cells (table 0x1A, chair 0x1B) or anything outside 0x17, 0x20–0x41', () => {
    for (let flags = 0; flags < 0x100; flags += 7) {
      const v = new Set(wildField(flags, seeded(flags + 9), COAB_FIELD).cells)
      for (const c of v) expect(c === 0x17 || (c >= 0x20 && c <= 0x41), `cell ${c.toString(16)}`).toBe(true)
    }
  })
})

const coabDir = process.env.COAB ?? '', porDir = process.env.POOLRAD ?? ''
describe.skipIf(!coabDir || !existsSync(coabDir))('CotAB wilderness battlefield and START.EXE', () => {
  let image: Uint8Array | null = null
  const exe = () => (image ??= unexepack(new Uint8Array(readFileSync(join(coabDir, 'START.EXE')))).image)
  const cells = () => { const img = exe(), prev = { ...T }; Object.assign(T, COAB_TABLES); try { return cellTable(img) } finally { Object.assign(T, prev) } }

  it('blank ground is the cells drawn with image slot 0x16 (DS:26A7)', () => {
    const t = cells()
    expect(t.map((c, i) => [c, i] as const).filter(([c]) => c.image === 0x16).map(([, i]) => i)).toEqual(COAB_FIELD.blank)
  })

  it('every cell the passes write is a WildCom picture (slot below 0x22)', () => {
    const t = cells()
    for (let flags = 0; flags < 0x100; flags += 3) for (const v of wildField(flags, seeded(flags), COAB_FIELD).cells) expect(t[v].image).toBeLessThan(0x22)
  })

  it('places from the place table DS:0354 (the demo\'s place 0 has flags 0) match the reference', () => {
    const img = exe()
    const flagsOf = (place: number) => img[COAB_TABLES.ds + COAB_TABLES.placeTerrain.at + place]
    expect(flagsOf(0)).toBe(0)
    for (let place = 0; place < 40; place++) {
      const f = flagsOf(place)
      expect(Array.from(wildField(f, seeded(place), COAB_FIELD).cells), `place ${place}`).toEqual(Array.from(coabReference(f, seeded(place))))
    }
  })
})

describe.skipIf(!porDir || !existsSync(porDir))('PoR wilderness battlefield and START.EXE', () => {
  it('blank ground is the cells drawn with image slot 0x16 (DS:2747)', () => {
    const img = unexepack(new Uint8Array(readFileSync(join(porDir, 'START.EXE')))).image
    const prev = { ...T }
    Object.assign(T, POR_TABLES)
    try {
      const t = cellTable(img)
      expect(t.map((c, i) => [c, i] as const).filter(([c]) => c.image === 0x16).map(([, i]) => i)).toEqual(POR_RULES.wildField.blank)
    } finally { Object.assign(T, prev) }
  })
})
