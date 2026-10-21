// CotAB's map-area battlefield (spec/A-games/coab/combat.md, "Map-area generator"): the shared generator with
// CotAB's profile, cell for cell against a statement-by-statement transcription of 0x2555D and the
// routines it calls, on real GEO maps with scripted and seeded dice. PoR's map fields are checked
// against tools/battlefield.py in battlefield.test.ts. Needs COAB.
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readDax, daxRecords } from '../src/data/dax'
import { GeoMap } from '../src/data/geo'
import { unexepack } from '../src/data/exepack'
import { cellTable, mapBattlefield, type Roll } from '../src/rules/battlefield'
import { COAB_RULES, POR_RULES } from '../src/games/rules'
import { COAB_TABLES, T } from '../src/games/tables'

const s8 = (v: number) => (v << 24) >> 24

/** deterministic 1dN from a seed (a 32-bit LCG; not the original's RNG) */
function seeded(seed: number): Roll {
  let s = seed >>> 0
  return (n: number) => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return ((s >>> 16) % n) + 1
  }
}

/**
 * 0x2555D transcribed from the disassembly. `raw` is the GEO record (2-byte header, then the planes the
 * pointer DS:7220 points at); `img` the CotAB image (DS = 0xABE0); (X, Y) the party (DS:7229, DS:722A);
 * `area` DS:8B78. The grid starts as 0xEE (GetMem does not clear it; the squares cover every cell).
 * Values pushed to the plot routine are the cell − 1, as in the binary.
 */
function coabMapReference(raw: Uint8Array, X: number, Y: number, area: number, d: Roll, img: Uint8Array): Uint8Array {
  const ds = 0xabe0
  const g = new Uint8Array(1250).fill(0xee)
  const plane = (p: number, x: number, y: number) => raw[2 + p * 0x100 + y * 16 + x]
  const roll = (count: number, sides: number) => { let s = 0; for (let i = 0; i < count; i++) s += d(sides); return s }
  const inMap = (x: number, y: number) => x <= 15 && x >= 0 && y <= 15 && y >= 0 // 0x53BE2
  /** the out-of-map rule at the head of 0x53C13, 0x53D42, 0x53E45: null → the routine returns 0 */
  const wrap = (x: number, y: number): [number, number] | null => {
    if (!inMap(x, y) && (area === 0 || area === 10)) return null
    if (x > 15) x = 0; else if (x < 0) x = 15
    if (y > 15) y = 0; else if (y < 0) y = 15
    return [x, y]
  }
  const wallType = (x0: number, y0: number, dir: number) => { // 0x53D42
    const w = wrap(x0, y0)
    if (!w) return 0
    const [x, y] = w
    if (dir === 0) return (plane(0, x, y) & 0xf0) >> 4
    if (dir === 2) return plane(0, x, y) & 0x0f
    if (dir === 4) return (plane(1, x, y) & 0xf0) >> 4
    if (dir === 6) return plane(1, x, y) & 0x0f
    return 0
  }
  const passage = (x0: number, y0: number, dir: number) => { // 0x53C13
    const w = wrap(x0, y0)
    if (!w) return 0
    const [x, y] = w
    let v = 1
    if (wallType(x, y, dir) > 0) {
      if (dir === 6) v = (plane(3, x, y) & 0xc0) >> 6
      else if (dir === 4) v = (plane(3, x, y) & 0x30) >> 4
      else if (dir === 2) v = (plane(3, x, y) & 0x0c) >> 2
      else if (dir === 0) v = plane(3, x, y) & 0x03
    }
    return v
  }
  const mapByte = (x0: number, y0: number) => { // 0x53E45
    const w = wrap(x0, y0)
    if (!w) return 0
    return plane(2, w[0], w[1])
  }
  const edge = (x: number, y: number, dir: number) => { // 0x24F96
    if (x >= 0 && x <= 15 && y >= 0 && y <= 15) {
      if (passage(x, y, dir) === 0) return 1
      if (wallType(x, y, dir) === 0) return 0
      return 3
    }
    if (y === Y && (dir === 2 || dir === 6)) return 0
    return 1
  }
  const classify = (x: number, y: number, dir: number) => { // 0x25018
    const back = (dir + 4) % 8
    const a = edge(x, y, dir)
    const b = edge(x + s8(img[ds + 0x2696 + dir]), y + s8(img[ds + 0x269f + dir]), back)
    return a | b
  }
  let dx = 0, dy = 0, N = 0, W = 0, E = 0, S = 0, flag = 0
  const plot = (c: number, r: number, v: number) => { // 0x24CD6
    const col = dy * 5 + dx * 6 + 0x15 + c, row = dy * 5 + 0x0a + r
    if (col < 0 || col > 0x31 || row < 0 || row > 0x18) return
    g[row * 50 + col] = (v + 1) & 0xff
  }
  const slot16 = (v: number) => v === 0x17 || v === 0x36 // DS:26A7[v·4] = 0x16
  const furnish = () => { // 0x24D63
    let room: boolean
    if (N === 1 || E === 1 || S === 1 || W === 1) {
      if (N === 1 && S === 1 && (E !== 1 || W !== 1)) room = false
      else if (E === 1 && W === 1 && (N !== 1 || S !== 1)) room = false
      else room = !(N === 3 || E === 3 || S === 3 || W === 3)
    } else room = false
    for (let i = 2; i <= 3; i++) for (let j = 2; j <= 4; j++) {
      const col = dy * 5 + dx * 6 + 0x15 + i + j, row = dy * 5 + 0x0a + j
      if (col < 0 || col > 0x31 || row < 0 || row > 0x18) continue
      if (!slot16(g[row * 50 + col])) continue
      if (flag === 0 || !room) continue
      if (roll(1, 0x0a) > 5) continue
      g[row * 50 + col] = 0x1a
      for (let k = 1; k <= 4; k++) {
        const c2 = col + s8(img[ds + 0x34b + k]), r2 = row + s8(img[ds + 0x34f + k])
        if (c2 < 0 || c2 > 0x31 || r2 < 0 || r2 > 0x18) continue
        if (!slot16(g[r2 * 50 + c2])) continue
        if (roll(1, 0x0a) <= 9) g[r2 * 50 + c2] = 0x1b
      }
    }
  }
  for (dy = -2; dy <= 2; dy++) for (dx = -6; dx <= 6; dx++) {
    const x = dx + X, y = dy + Y
    W = classify(x, y, 6); N = classify(x, y, 0); E = classify(x, y, 2); S = classify(x, y, 4)
    // 0x2508C
    for (let r = 2; r <= 4; r++) for (let c = 0; c <= 5; c++) plot(c, r, 0x16)
    if (W === 1) for (let r = 2; r <= 4; r++) { plot(r - 1, r, 4); plot(r, r, 3); plot(r + 1, r, 0x0d) }
    else if (W === 3) { plot(1, 2, 8); plot(5, 4, 0) }
    // 0x25131
    if (N === 1) { plot(3, 0, 5); plot(4, 0, 5); plot(3, 1, 0x0a); plot(4, 1, 0x0a) }
    else { plot(3, 0, 0x16); plot(4, 0, 0x16); plot(3, 1, 0x16); plot(4, 1, 0x16) }
    { // 0x251AE
      const f = classify(x, y - 1, 6) === 0 && classify(x - 1, y, 0) === 0
      let v2 = 0, v3 = 0, v4 = 0, v5 = 0
      if (N === 0) { if (W === 0) v2 = 0x16; else if (W === 3) v2 = 0x0d; else if (W === 1) v2 = f ? 0 : 0x0d }
      else if (N === 3 || N === 1) { if (W === 0) v2 = f ? 0x0f : 5; else v2 = f ? 0x12 : 2 }
      if (N === 0) v4 = 0x16; else if (N === 3) v4 = 0x11; else if (N === 1) v4 = 5
      if (W === 0) v3 = N === 0 ? 0x16 : f ? 0x10 : 0x0a
      else if (W === 3) v3 = f ? 0x14 : 7
      else if (W === 1) v3 = f ? 1 : 3
      if (W === 0 || W === 3) { if (N === 0) v5 = 0x16; else if (N === 3) v5 = 0x17; else if (N === 1) v5 = 0x0a }
      else if (W === 1) { if (N === 0) v5 = 0x0d; else if (N === 3) v5 = 0x15; else if (N === 1) v5 = 6 }
      plot(1, 0, v2); plot(2, 0, v4); plot(1, 1, v3); plot(2, 1, v5)
    }
    { // 0x25386
      const g7 = classify(x, y - 1, 2), g8 = classify(x + 1, y, 0)
      const f6 = g7 === 0 && g8 === 0
      let v2 = 0, v3 = 0, v4 = 0, v5 = 0
      if (N === 0) v2 = g7 === 1 ? 4 : 0x16; else if (N === 3) v2 = 0x0f; else if (N === 1) v2 = 5
      if (N === 0) {
        if (g7 === 0) v4 = 0x16
        else if (g7 === 3) v4 = E === 0 && g8 !== 0 ? 0x18 : 1
        else if (g7 === 1) v4 = E === 0 ? (g8 !== 0 ? 0x0b : 7) : 3
      } else if (E !== 0) v4 = 9
      else if (g8 !== 0) v4 = 5
      else v4 = f6 ? 0x11 : 0x13
      if (N === 0) v3 = 0x16; else if (N === 3) v3 = 0x10; else if (N === 1) v3 = 0x0a
      if (N === 0) v5 = g7 === 0 ? 0x16 : E !== 0 ? 4 : g8 === 0 ? 8 : 0x0c
      else v5 = E !== 0 ? 0x0e : g8 === 0 ? 0x17 : 0x0a
      plot(5, 0, v2); plot(6, 0, v4); plot(5, 1, v3); plot(6, 1, v5)
    }
    flag = mapByte(x, y) & 0x40
    furnish()
  }
  return g
}

const dir = process.env.COAB ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('CotAB map-area battlefield (0x2555D)', () => {
  let img: Uint8Array
  const prev = { ...T }
  const geos = new Map<string, Uint8Array>()
  const geo = (file: string, rec: number) => {
    const key = `${file}/${rec}`
    if (!geos.has(key)) geos.set(key, [...daxRecords(readDax(new Uint8Array(readFileSync(join(dir, file)))))].find(([id]) => id === rec)![1])
    return geos.get(key)!
  }
  beforeAll(() => {
    img = unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
    Object.assign(T, COAB_TABLES)
  })
  afterAll(() => { Object.assign(T, prev) })

  // GEO records with rooms flagged 0x40 in plane 2, and positions in and around them (edges too);
  // the area id is the record number (I), 0 and 10 for the out-of-map rule
  const places: [string, number, number, number, number][] = [
    ['GEO2.DAX', 1, 12, 1, 1], ['GEO2.DAX', 1, 9, 3, 1], ['GEO2.DAX', 1, 4, 5, 1], ['GEO2.DAX', 4, 1, 1, 4], ['GEO2.DAX', 4, 7, 8, 0],
    ['GEO3.DAX', 21, 8, 2, 21], ['GEO3.DAX', 21, 9, 4, 10], ['GEO4.DAX', 32, 1, 2, 32], ['GEO4.DAX', 37, 13, 2, 37],
    ['GEO5.DAX', 53, 3, 0, 53], ['GEO5.DAX', 53, 10, 7, 53], ['GEO5.DAX', 53, 15, 15, 0], ['GEO6.DAX', 66, 5, 5, 66],
  ]

  it('matches the transcription cell for cell with seeded dice, asking the same dice', () => {
    let furniture = 0
    for (const [file, rec, x, y, area] of places) for (const seed of [1, 99, 2026]) {
      const raw = geo(file, rec)
      const asked: number[][] = [[], []]
      const dice = (k: number) => { const d = seeded(seed); return (n: number) => { asked[k].push(n); return d(n) } }
      const a = mapBattlefield(new GeoMap(raw), x, y, dice(0), area, COAB_RULES.mapField, img).cells
      const b = coabMapReference(raw, x, y, area, dice(1), img)
      expect(b.includes(0xee), 'every cell plotted').toBe(false)
      expect(Array.from(a), `${file} #${rec} at ${x},${y} seed ${seed}`).toEqual(Array.from(b))
      expect(asked[0]).toEqual(asked[1])
      expect(asked[0].every((n) => n === 10)).toBe(true)
      furniture += a.filter((v) => v === 0x1a || v === 0x1b).length
    }
    expect(furniture).toBeGreaterThan(0)
  })

  it('draws the north-east wall end as 0x08 where PoR draws 0x04 (0x25467; GEO2 #1 at 4,5)', () => {
    const raw = geo('GEO2.DAX', 1)
    const coab = mapBattlefield(new GeoMap(raw), 4, 5, () => 10, 1, COAB_RULES.mapField, img).cells
    const por = mapBattlefield(new GeoMap(raw), 4, 5, () => 10, 1, { ...COAB_RULES.mapField, cornerWallEnd: POR_RULES.mapField.cornerWallEnd }, img).cells
    const diff = [...coab.keys()].filter((i) => coab[i] !== por[i])
    expect(diff.length).toBeGreaterThan(0)
    expect(diff.every((i) => coab[i] === 0x08 && por[i] === 0x04)).toBe(true)
  })

  it('matches it with every die low (all tables and chairs) and every die high (no furniture)', () => {
    for (const [file, rec, x, y, area] of places) for (const die of [() => 1, (n: number) => n]) {
      const raw = geo(file, rec)
      const a = mapBattlefield(new GeoMap(raw), x, y, die, area, COAB_RULES.mapField, img).cells
      expect(Array.from(a), `${file} #${rec} at ${x},${y}`).toEqual(Array.from(coabMapReference(raw, x, y, area, die, img)))
    }
  })
})

describe.skipIf(!have)('CotAB map-area battlefield: the parts that differ from PoR', () => {
  it('furnishes rooms only, never in PoR, and reads the chair offsets from START.EXE', () => {
    const img = unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
    const prev = { ...T }
    Object.assign(T, COAB_TABLES)
    try {
      expect([1, 2, 3, 4].map((k) => s8(img[T.ds + T.furnishDx.at + k]))).toEqual([0, 1, 0, -1])
      expect([1, 2, 3, 4].map((k) => s8(img[T.ds + T.furnishDy.at + k]))).toEqual([-1, 0, 1, 0])
      // blank ground: the cells drawn with image slot 0x16 (DS:26A7), as 0x24D63 tests
      const cells = cellTable(img)
      expect(cells.map((c, i) => [c, i] as const).filter(([c]) => c.image === 0x16).map(([, i]) => i)).toEqual(COAB_RULES.mapField.furnish!.blank)
      const raw = [...daxRecords(readDax(new Uint8Array(readFileSync(join(dir, 'GEO5.DAX')))))].find(([id]) => id === 53)![1]
      let tables = 0
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const c = mapBattlefield(new GeoMap(raw), x, y, () => 1, 53, COAB_RULES.mapField, img).cells
        tables += c.filter((v) => v === 0x1a).length
        const p = mapBattlefield(new GeoMap(raw), x, y, () => 2, 53, { ...POR_RULES.mapField, finishing: false }, null).cells
        expect(p.some((v) => v === 0x1a || v === 0x1b)).toBe(false)
      }
      expect(tables).toBeGreaterThan(0)
    } finally { Object.assign(T, prev) }
  })
})
