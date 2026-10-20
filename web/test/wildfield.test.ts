// Wilderness battlefields (spec/combat.md, "Wilderness battlefields"; spec/coab/combat.md).
// Both games: the passes with scripted dice, and whole fields cell for cell against a statement-by-
// statement transcription of the original's routines.
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

// every flag byte PoR's tile table gives (FUN_34c7_08a4), plus 0
const POR_FLAGS = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x08, 0x09, 0x11, 0x12, 0x14, 0x18, 0x20, 0x21, 0x28, 0x40, 0x41, 0x44, 0x48, 0x60, 0x80, 0x81, 0x88, 0x90, 0xa0]

/**
 * PoR's wilderness generator transcribed from the disassembly, one statement per instruction group:
 * FUN_34c7_11b4 (fill), FUN_34c7_0bde + FUN_34c7_0b97 (river), FUN_34c7_0d13 (trees), FUN_34c7_0e9e
 * (scatter), FUN_34c7_0000 (finishing; the area, DS:84DC, is an overland one, never 10). The grid is the
 * original's flat array (row·50 + col); roll(count, sides) is the game's FUN_5216_0de3.
 */
function porReference(flags: number, d: Roll): Uint8Array {
  const g = new Uint8Array(1250).fill(0x17)
  const roll = (count: number, sides: number) => { let s = 0; for (let i = 0; i < count; i++) s += d(sides); return s }
  const slot16 = (v: number) => v === 0x17 || v === 0x36 // DS:2747[v·4] = 0x16
  const flag = (b: number) => (flags & b) !== 0 // FUN_34c7_08a4 on the tile
  const put = (i: number, v: number) => { if (i >= 0 && i < 1250) g[i] = v }
  // FUN_34c7_0bde (image 0x2584E)
  let fords = 0, chance = 0
  if (flag(0x20)) chance = 0x23
  if (flag(0x10)) chance = 0x4b
  if (roll(1, 0x64) <= chance) {
    let c = 0x22 - roll(5, 4)
    while ((c + 2) % 7 > 0) c--
    const start = c
    const ford = (row: number, col: number) => { put(row * 50 + col, 0x34); put(row * 50 + col + 1, 0x35); fords++ } // FUN_34c7_0b97
    for (let row = 0; row <= 0x18; row++) {
      if (c > 0x31) continue
      put(row * 50 + c, 0x32)
      put(row * 50 + c + 1, 0x33)
      if (roll(1, 0x14) === 1 || (fords & 1) === 1) ford(row, c)
      c++
    }
    if (fords === 0) {
      const r = 0x0c - roll(1, 9) + 4
      const col = r + start
      ford(r, col)
      ford(r + 1, col + 1)
    }
  }
  // FUN_34c7_0d13 (0x25983)
  let ch = 1
  if (flag(0x02)) ch = 1
  if (flag(0x04)) ch = 3
  if (flag(0x40)) ch = 4
  if (flag(0x08)) ch = 7
  if (flag(0x80)) ch = 0
  for (let col = 0; col <= 0x31; col++) for (let row = 1; row <= 0x18; row++) {
    if (!slot16(g[row * 50 + col]) || !slot16(g[(row - 1) * 50 + col])) continue
    if (roll(1, 0x64) > ch) continue
    let size = roll(1, 0x0a)
    if (size > 8) size = roll(1, 2) + 4
    else size = (size + 1) >> 1
    if (flag(0x40)) size = roll(1, 3) + 3
    g[row * 50 + col] = size + 0x1f + 4
    if (size < 5) g[(row - 1) * 50 + col] = size + 0x1f
  }
  // FUN_34c7_0e9e (0x25B0E)
  let a = 0, b = 15, dd = 40, c = 0
  const shrubs = 6
  if (flag(0x02)) { b = 0x2d; dd = 0x0a }
  if (flag(0x04)) b = 0x19
  if (flag(0x40)) { dd = 5; c = 0x1e }
  if (flag(0x80)) { a = 0x0f; dd = 0x19; b = 0x0a }
  for (let col = 0; col <= 0x31; col++) for (let row = 0; row <= 0x18; row++) {
    if (!slot16(g[row * 50 + col])) continue
    const r = roll(1, 0xff)
    if (r <= a) {
      const k = roll(1, 4)
      if (k === 4 && row > 0 && slot16(g[(row - 1) * 50 + col])) { g[(row - 1) * 50 + col] = 0x41; g[row * 50 + col] = 0x40 }
      if (k < 4) g[row * 50 + col] = k + 0x1f + 0x1d
    } else if (r <= a + shrubs) g[row * 50 + col] = roll(1, 3) + 0x1f + 0x17
    else if (r <= a + shrubs + b) g[row * 50 + col] = roll(1, 4) + 0x1f + 0x0a
    else if (r <= a + shrubs + b + c) g[row * 50 + col] = Math.floor((roll(1, 0x0a) - 1) / 3) + 1 + 0x1f + 0x19
    else if (r <= a + shrubs + b + c + dd) {
      let k = roll(1, 4)
      if (k === 4 && !flag(0x40)) k = roll(1, 3)
      g[row * 50 + col] = k + 0x1f + 0x0e
    }
  }
  // FUN_34c7_0000 (0x24C70)
  for (let col = 0; col <= 0x31; col++) for (let row = 0; row <= 0x18; row++) {
    if (!slot16(g[row * 50 + col])) continue
    const r = roll(1, 0x64)
    if (r >= 1 && r <= 0x61) continue
    if (r === 0x62) g[row * 50 + col] = 0x1a
    else if (r === 0x63) g[row * 50 + col] = 0x1b
    else if (r === 0x64 && roll(1, 0x64) === 1) g[row * 50 + col] = roll(1, 0x0a) <= 6 ? 0x1c : 0x1d
  }
  return g
}

// fingerprints of porReference (not of the port): every flag byte, three seeds
const POR_PRINTS: Record<string, string> = {
  '0/1': '1e955efe', '0/77': '495f3f01', '0/4242': '3e881d90', '1/1': '1e955efe', '1/77': '495f3f01', '1/4242': '3e881d90',
  '2/1': 'e23ac61e', '2/77': '35376bc9', '2/4242': '63acbfc1', '3/1': 'e23ac61e', '3/77': '35376bc9', '3/4242': '63acbfc1',
  '4/1': '97084316', '4/77': 'aa45a2ad', '4/4242': 'e14f7014', '5/1': '97084316', '5/77': 'aa45a2ad', '5/4242': 'e14f7014',
  '8/1': 'e261fe3c', '8/77': '746a4dc4', '8/4242': 'abe3c24d', '9/1': 'e261fe3c', '9/77': '746a4dc4', '9/4242': 'abe3c24d',
  '11/1': '3639e2fc', '11/77': 'f9c51054', '11/4242': '3e881d90', '12/1': 'f4490536', '12/77': '2f361201', '12/4242': '63acbfc1',
  '14/1': '5bbdbd41', '14/77': 'ef92e42d', '14/4242': 'e14f7014', '18/1': 'b2de42ed', '18/77': 'b8b01d0b', '18/4242': 'abe3c24d',
  '20/1': '1e955efe', '20/77': '495f3f01', '20/4242': '3e881d90', '21/1': '1e955efe', '21/77': '495f3f01', '21/4242': '3e881d90',
  '28/1': 'e261fe3c', '28/77': '746a4dc4', '28/4242': 'abe3c24d', '40/1': '08a399ed', '40/77': 'e8743079', '40/4242': '389e3ff3',
  '41/1': '08a399ed', '41/77': 'e8743079', '41/4242': '389e3ff3', '44/1': '21e48e6c', '44/77': 'e8830053', '44/4242': 'a67de596',
  '48/1': 'a987bcf5', '48/77': '7f2188ae', '48/4242': '3e1dbd3c', '60/1': '08a399ed', '60/77': 'e8743079', '60/4242': '389e3ff3',
  '80/1': '6a45c596', '80/77': '442dacae', '80/4242': '1dad8ee7', '81/1': '6a45c596', '81/77': '442dacae', '81/4242': '1dad8ee7',
  '88/1': '6a45c596', '88/77': '442dacae', '88/4242': '1dad8ee7', '90/1': '38dc7690', '90/77': '45fa92e8', '90/4242': '1dad8ee7',
  'a0/1': '6a45c596', 'a0/77': '442dacae', 'a0/4242': '1dad8ee7',
}

const POR_FIELD = POR_RULES.wildField
const porOnly = (pass: WildPass['pass']): WildFieldSpec => ({ ...POR_FIELD, passes: POR_FIELD.passes.filter((p) => p.pass === pass) })

describe('PoR wilderness battlefield (FUN_34c7_11b4)', () => {
  it('matches the transcription for every flag byte with seeded dice', () => {
    for (let flags = 0; flags < 0x100; flags++) for (const seed of [5, 2024]) {
      const a = wildField(flags, seeded(seed * 263 + flags), POR_FIELD).cells
      const b = porReference(flags, seeded(seed * 263 + flags))
      expect(Array.from(a), `flags ${flags.toString(16)} seed ${seed}`).toEqual(Array.from(b))
    }
  })

  it('the transcription\'s fields for PoR\'s flag bytes are the recorded ones', () => {
    const got: Record<string, string> = {}
    for (const f of POR_FLAGS) for (const seed of [1, 77, 4242]) got[`${f.toString(16)}/${seed}`] = fingerprint(porReference(f, seeded(seed)))
    expect(got).toEqual(POR_PRINTS)
  })

  it('classifies the overland tile first (arid tile with ECL 0x4AB3 = 0xFF)', () => {
    expect(fingerprint(wildBattlefield(0x6d, 0xff, seeded(5), POR_FIELD).cells)).toBe(fingerprint(wildField(0x01, seeded(5), POR_FIELD).cells))
  })

  it('river FUN_34c7_0bde: banks, then the d20; fords in pairs of rows; no crossing after a ford', () => {
    // flag 0x10; d100 = 75; 5d4 = 5 → 29 → 26. Row 0: d20 = 1, a ford; row 1: d20 = 7, but one ford so
    // far: a ford again; row 2: two fords, d20 = 2: banks
    const s = scripted([[100, 75], [4, 1], [4, 1], [4, 1], [4, 1], [4, 1], [20, 1], [20, 7], [20, 2]], () => 20)
    const bf = wildField(0x10, s.roll, porOnly('river'))
    expect([cell(bf, 0, 26), cell(bf, 0, 27), cell(bf, 1, 27), cell(bf, 1, 28)]).toEqual([0x34, 0x35, 0x34, 0x35])
    for (let row = 2; row <= 22; row++) expect([cell(bf, row, 26 + row), cell(bf, row, 27 + row)], `row ${row}`).toEqual([0x32, 0x33])
    // row 23 at column 49: the second bank spills into (24, 0); row 24 would be column 50: nothing
    expect(cell(bf, 23, 49)).toBe(0x32)
    expect(cell(bf, 24, 0)).toBe(0x33)
    expect(Array.from(bf.cells).filter((v) => v !== 0x17)).toHaveLength(2 * 24)
    expect(s.asked).toEqual([100, 4, 4, 4, 4, 4, ...Array(24).fill(20)])
  })

  it('river: without a ford, the crossing at rows r and r + 1 (r = 16 − d9), the ford\'s four cells', () => {
    // start 12 (5d4 = 20); every d20 = 20; d9 = 9 → r = 7, columns 19 and 20
    const s = scripted([[100, 1], [4, 4], [4, 4], [4, 4], [4, 4], [4, 4], ...Array(25).fill([20, 20]), [9, 9]])
    const bf = wildField(0x10, s.roll, porOnly('river'))
    expect(s.left()).toBe(0)
    expect([cell(bf, 7, 19), cell(bf, 7, 20), cell(bf, 8, 20), cell(bf, 8, 21)]).toEqual([0x34, 0x35, 0x34, 0x35])
    expect([cell(bf, 6, 18), cell(bf, 6, 19), cell(bf, 9, 21), cell(bf, 9, 22)]).toEqual([0x32, 0x33, 0x32, 0x33])
    expect(cell(bf, 24, 36)).toBe(0x32)
  })

  it('river: the d100 is rolled whatever the flags; above the chance nothing more', () => {
    for (const [flags, d] of [[0x00, 1], [0x01, 1], [0x20, 36]] as const) {
      const s = scripted([[100, d]])
      const bf = wildField(flags, s.roll, porOnly('river'))
      expect(bf.cells.every((v) => v === 0x17)).toBe(true)
      expect(s.asked).toEqual([100])
    }
  })

  it('trees FUN_34c7_0d13 and scatter FUN_34c7_0e9e scan columns outer', () => {
    // flag 0x08: 7 %. (1,0) d100 = 7, d10 = 3 → size 2: trunk 0x25, crown 0x21 at (0,0); then (2,0)'s d100
    const t = scripted([[100, 7], [10, 3], [100, 100]], () => 100)
    const bf = wildField(0x08, t.roll, porOnly('treesBySize'))
    expect([cell(bf, 0, 0), cell(bf, 1, 0)]).toEqual([0x21, 0x25])
    expect(t.asked.length).toBe(1 + 23 + 49 * 24) // column 0: no d100 at (2,0), the trunk above
    // scatter, flags 0: rocks (r ≤ 21) at (0,0) and (1,0) take the first two cells of column 0
    const sc = scripted([[255, 21], [4, 1], [255, 7], [4, 2]], () => 255)
    const f = wildField(0, sc.roll, porOnly('scatterTerrain'))
    expect([cell(f, 0, 0), cell(f, 1, 0), cell(f, 0, 1)]).toEqual([0x2a, 0x2b, 0x17])
  })
})

// ---------------------------------------------------------------------------------------------------
// CotAB (spec/coab/combat.md): its own passes, cell for cell against the transcription.

const COAB_FIELD = COAB_RULES.wildField
const only = (pass: WildPass['pass']): WildFieldSpec => ({ ...COAB_FIELD, passes: COAB_FIELD.passes.filter((p) => p.pass === pass) })


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
    const bf = wildField(0x10, s.roll, only('river'))
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
      const bf = wildField(flags, s.roll, only('river'))
      expect(bf.cells.every((v) => v === 0x17)).toBe(true)
      expect(s.asked).toEqual([100])
    }
    // the start column: 34 − 5d4 lowered to 12, 19 or 26
    for (const [sum, start] of [[20, 12], [15, 19], [9, 19], [8, 26], [5, 26]] as const) {
      const dice: [number, number][] = [[100, 1]]
      let left = sum
      for (let i = 0; i < 5; i++) { const k = Math.min(4, left - (4 - i)); dice.push([4, k]); left -= k }
      const bf = wildField(0x10, scripted(dice, (n) => (n === 20 ? 20 : 1)).roll, only('river'))
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
