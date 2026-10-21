// Combat battlefield (spec/A-games/engine/battlefield.md, "Battlefield"): a 25 x 50 grid of cell values, the cell table
// from START.EXE, and the terrain generators.
import { T } from '../games/tables'
import { R, type CellDie, type FlagValue, type MapFieldSpec, type RiverCourse, type WildFieldSpec, type WildPass } from '../games/rules'
import type { GeoMap } from '../data/geo'

export const ROWS = 25
export const COLS = 50

/** Cell properties (DS:2744, 4 bytes per cell value). */
export interface CellInfo {
  /** 1 enterable, 0xFF blocked */
  move: number
  /** 2 blocks line of sight */
  sight: number
  /** image slot: DUNGCOM/WILDCOM frames from 0, RANDCOM frames from 0x22 */
  image: number
}

export function cellTable(startImage: Uint8Array): CellInfo[] {
  const out: CellInfo[] = []
  for (let c = 0; c < 0x42; c++) {
    const o = T.ds + T.battleCells.at + c * T.battleCells.row
    out.push({ move: startImage[o], sight: startImage[o + 2], image: startImage[o + 3] })
  }
  return out
}

export type Roll = (sides: number) => number // 1..sides

export class Battlefield {
  readonly cells = new Uint8Array(ROWS * COLS)
  /** DUNGCOM for map areas, WILDCOM outdoors (spec: FUN_34c7_1244) */
  readonly outdoors: boolean

  constructor(outdoors: boolean) {
    this.outdoors = outdoors
  }

  get(row: number, col: number): number {
    return row < 0 || row >= ROWS || col < 0 || col >= COLS ? 0 : this.cells[row * COLS + col]
  }

  set(row: number, col: number, v: number) {
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) this.cells[row * COLS + col] = v
  }
}

/** Overland tile id → terrain feature flags (FUN_34c7_08a4); first matching row wins. */
export function terrainFlags(tile: number, read4AB3: number): number {
  const rows: [number[][], number][] = [
    [[[1, 2], [0x28, 0x29], [0x2b, 0x2b], [0x4f, 0x56], [0x5b, 0x5c], [0xf1, 0xf1]], 0x01],
    [[[0xa8, 0xb1]], 0x21],
    [[[0xb9, 0xb9], [0xbc, 0xc0]], 0x11],
    [[[3, 4], [6, 9], [0x13, 0x15], [0x17, 0x19]], 0x03],
    [[[7, 7], [0x0a, 0x12], [0x16, 0x16], [0x1a, 0x24], [0xc9, 0xd0]], 0x02],
    [[[0xd1, 0xd5]], 0x12],
    [[[0x25, 0x25], [0x39, 0x39], [0x40, 0x40], [0x9a, 0x9e], [0xa4, 0xa5], [0xb4, 0xb4], [0xef, 0xf0], [0xf3, 0xf3], [0xfa, 0xfa], [0xfc, 0xfc]], 0x04],
    [[[0x27, 0x2c], [0x99, 0x99], [0x9f, 0x9f]], 0x05],
    [[[0x2d, 0x2e], [0x33, 0x38], [0x43, 0x4d], [0x5d, 0x61]], 0x44],
    [[[0xb5, 0xb8], [0xba, 0xba], [0xc1, 0xc8]], 0x14],
    [[[0x2f, 0x32], [0x62, 0x65], [0xf2, 0xf2]], 0x40],
    [[[0x26, 0x26]], 0x41],
    [[[0xb2, 0xb3]], 0x60],
    [[[0x3a, 0x3c], [0x41, 0x42]], 0x48],
    [[[0x3d, 0x3f], [0x79, 0x7c], [0x87, 0x89], [0x8b, 0x8b], [0x8d, 0x8d], [0x90, 0x93], [0x95, 0x95], [0x97, 0x98], [0xa0, 0xa2], [0xa6, 0xa7], [0xd6, 0xd8], [0xee, 0xee]], 0x08],
    [[[0x57, 0x5a], [0xa3, 0xa3], [0xe0, 0xe0]], 0x88],
    [[[0x7c, 0x7d], [0x8a, 0x8a], [0x8c, 0x8c], [0x8e, 0x8f], [0x94, 0x94], [0x96, 0x96]], 0x09],
    [[[0x7e, 0x85], [0xe5, 0xe7]], 0x28],
    [[[0xd9, 0xdf]], 0x18],
    [[[0x4e, 0x4e], [0xf5, 0xf5], [0xe8, 0xe9]], 0x20],
    [[[0x6d, 0x6d], [0xf4, 0xf6]], 0x80],
    [[[0x6e, 0x71], [0x73, 0x78]], 0x81],
    [[[0x66, 0x6c], [0x72, 0x72]], 0x90],
    [[[0xe1, 0xe4], [0xea, 0xed]], 0xa0],
  ]
  let flags = 0 // the original returns an uninitialised byte here
  for (const [ranges, f] of rows) {
    if (ranges.some(([a, b]) => tile >= a && tile <= b)) { flags = f; break }
  }
  if (flags & 0x80 && read4AB3 === 0xff) flags = ((flags + 0x80) & 0xff) | 1
  return flags
}

/** Wilderness battlefield (FUN_34c7_11b4) for the overland tile the party stands on. */
export function wildBattlefield(tile: number, read4AB3: number, roll: Roll, spec: WildFieldSpec = R.wildField): Battlefield {
  return wildField(terrainFlags(tile, read4AB3), roll, spec)
}

/** A number from the terrain flags (FlagValue: a base, then set or add for each flag present, in order). */
export function flagValue(v: FlagValue, flags: number): number {
  let n = v.base
  for (const [flag, op, k] of v.steps) if (flags & flag) n = op === '=' ? k : n + k
  if (v.under && n < v.under[0]) n = v.under[1]
  return n
}

/**
 * A wilderness battlefield from its terrain feature flags: every cell `spec.fill`, then the game's passes
 * in order (R.wildField; PoR FUN_34c7_11b4: river FUN_34c7_0bde, trees 0d13, scatter 0e9e, finishing
 * 0000; CotAB 0x25C58: river 0x25690, trees 0x2579B, scatter 0x25ADA, no finishing pass. spec/A-games/engine/battlefield.md,
 * spec/A-games/coab/combat.md).
 */
export function wildField(flags: number, roll: Roll, spec: WildFieldSpec = R.wildField): Battlefield {
  const bf = new Battlefield(true)
  bf.cells.fill(spec.fill)
  const blank = (row: number, col: number) => spec.blank.includes(bf.get(row, col))
  for (const p of spec.passes) {
    switch (p.pass) {
      case 'river': river(bf, p, flags, roll); break
      case 'treesBySize': treesBySize(bf, p, flags, roll, blank); break
      case 'treesOrLogs': treesOrLogs(bf, p, flags, roll, blank); break
      case 'scatterTerrain': scatterTerrain(bf, p, flags, roll, blank); break
      case 'scatterOdds': scatterOdds(bf, p, flags, roll, blank); break
      case 'finishing': finishingPass(bf, roll, -1); break
    }
  }
  return bf
}

type Pass<K extends WildPass['pass']> = Extract<WildPass, { pass: K }>
type Blank = (row: number, col: number) => boolean

/** every cell, columns outer and rows inner (as both originals' passes); rows from `first` */
function scan(first: number, fn: (row: number, col: number) => void) {
  for (let col = 0; col < COLS; col++) for (let row = first; row < ROWS; row++) fn(row, col)
}

/** A river's start column, or null when it does not run: d100 ≤ chance (rolled whatever the chance);
 *  from − count·dN, lowered to the period. */
function riverStart(c: RiverCourse, flags: number, roll: Roll): number | null {
  const chance = flagValue(c.chance, flags)
  if (roll(100) > chance) return null
  let start = c.from
  for (let i = 0; i < c.count; i++) start -= roll(c.sides)
  while ((start + c.offset) % c.every > 0) start--
  return start
}

const cellOf = (c: CellDie, roll: Roll) => (c[1] ? c[0] + roll(c[1]) : c[0])

/**
 * A river running down and to the right, one column a row, with fords (PoR FUN_34c7_0bde with the ford
 * FUN_34c7_0b97; CotAB 0x25690 with 0x2563C; spec/A-games/engine/battlefield.md "River pass", spec/A-games/coab/combat.md "River").
 * Edge `spill`: the original's grid is one flat array, so a cell at column 50 is the next row's column 0
 * (PoR: start 26, row 23 puts the second bank at (24, 0)); `clip`: the original tests the edge first.
 */
function river(bf: Battlefield, p: Pass<'river'>, flags: number, roll: Roll) {
  const start = riverStart(p.course, flags, roll)
  if (start === null) return
  const put = (row: number, col: number, v: number) => {
    if (p.edge === 'clip') bf.set(row, col, v)
    else { const i = row * COLS + col; if (i >= 0 && i < ROWS * COLS) bf.cells[i] = v }
  }
  let fords = 0
  const ford = (row: number, col: number) => {
    for (const [dr, dc, v] of p.ford) put(row + dr, col + dc, v)
    fords++
  }
  let col = start
  for (let row = 0; row < ROWS; row++) {
    if (col > COLS - 1) continue
    put(row, col, cellOf(p.cells[0], roll))
    if (p.edge === 'spill' || col < COLS - 1) put(row, col + 1, cellOf(p.cells[1], roll))
    if (roll(p.fordDie) === 1 || (p.pairs && fords % 2 === 1)) ford(row, col)
    col++
  }
  if (p.crossing && fords === 0) {
    const r = p.crossing.from - roll(p.crossing.die)
    ford(r, start + r)
    ford(r + 1, start + r + 1)
  }
}

/** Trees and logs by size (PoR FUN_34c7_0d13). */
function treesBySize(bf: Battlefield, p: Pass<'treesBySize'>, flags: number, roll: Roll, blank: Blank) {
  const chance = flagValue(p.chance, flags)
  scan(1, (row, col) => {
    if (!blank(row, col) || !blank(row - 1, col)) return
    if (roll(100) > chance) return
    const r = roll(10)
    let size = r <= 8 ? Math.floor((r + 1) / 2) : 4 + roll(2)
    if (flags & p.swamp) size = 3 + roll(3)
    bf.set(row, col, p.trunk + size)
    if (size < 5) bf.set(row - 1, col, p.crown + size)
  })
}

/** A log, or a tree whose crown and trunk are drawn apart (CotAB 0x2579B). */
function treesOrLogs(bf: Battlefield, p: Pass<'treesOrLogs'>, flags: number, roll: Roll, blank: Blank) {
  if (flags & p.skip) return
  const chance = flagValue(p.chance, flags)
  scan(1, (row, col) => {
    if (!blank(row, col) || !blank(row - 1, col)) return
    if (roll(100) > chance) return
    if (roll(100) <= chance) { bf.set(row, col, p.log[0] + roll(p.log[1])); return }
    bf.set(row - 1, col, p.crown[0] + roll(p.crown[1]))
    bf.set(row, col, p.trunk[0] + roll(p.trunk[1]))
  })
}

/** Rocks, shrubs, marsh plants, tufts and cactus (PoR FUN_34c7_0e9e). */
function scatterTerrain(bf: Battlefield, p: Pass<'scatterTerrain'>, flags: number, roll: Roll, blank: Blank) {
  const a = flagValue(p.a, flags), b = flagValue(p.b, flags), c = flagValue(p.c, flags), d = flagValue(p.d, flags)
  scan(0, (row, col) => {
    if (!blank(row, col)) return
    const r = roll(255)
    if (r <= a) {
      const k = roll(4)
      if (k === 4 && row > 0 && blank(row - 1, col)) { bf.set(row, col, p.tallCactus[0]); bf.set(row - 1, col, p.tallCactus[1]) }
      else if (k < 4) bf.set(row, col, p.cactus + k)
    } else if (r <= a + p.shrubs) bf.set(row, col, p.shrub[0] + roll(p.shrub[1]))
    else if (r <= a + p.shrubs + b) bf.set(row, col, p.rocks[0] + roll(p.rocks[1]))
    else if (r <= a + p.shrubs + b + c) bf.set(row, col, p.marsh + Math.floor((roll(10) - 1) / 3))
    else if (r <= a + p.shrubs + b + c + d) {
      const k = roll(4)
      bf.set(row, col, k === 4 && !(flags & p.puddleFlag) ? p.tuft + roll(3) : p.tuft + k)
    }
  })
}

/** One roll a blank cell against a row of odds chosen by a flag score (CotAB 0x25ADA, 0x25932). */
function scatterOdds(bf: Battlefield, p: Pass<'scatterOdds'>, flags: number, roll: Roll, blank: Blank) {
  const score = flagValue(p.score, flags)
  const odds = p.odds.find((o) => score >= o.from && score <= o.to)?.odds
  scan(0, (row, col) => {
    if (!blank(row, col) || !odds) return
    const r = roll(p.die)
    let sum = 0
    for (let i = 0; i < odds.length; i++) {
      sum += odds[i]
      if (r <= sum) { bf.set(row, col, p.cells[i][0] + roll(p.cells[i][1])); return }
    }
  })
}

const OPEN = 0x17

/** Finishing pass (FUN_34c7_0000): columns outer, rows inner; odd rocks, rarely a bone or a potted flower, on open ground. */
export function finishingPass(bf: Battlefield, roll: Roll, area: number) {
  for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) {
    const v = bf.get(row, col)
    if (v !== OPEN && v !== 0x36) continue // the cells drawn as blank ground (image slot 0x16)
    const r = roll(100)
    if (r === 98) bf.set(row, col, 0x1a)
    else if (r === 99) bf.set(row, col, 0x1b)
    else if (r === 100 && area !== 10 && roll(100) === 1) bf.set(row, col, roll(10) <= 6 ? 0x1c : 0x1d)
  }
}

/**
 * A map square's byte in GEO plane 2 (CotAB 0x53E45; PoR's map lookups do the same, spec/A-games/engine/maps-and-view.md):
 * outside 0–15, 0 in areas 0 and 10, else the coordinate is moved to the far edge (above 15 → 0,
 * below 0 → 15).
 */
function squareByte(geo: GeoMap, x: number, y: number, area: number): number {
  if (x < 0 || x > 15 || y < 0 || y > 15) {
    if (area === 0 || area === 10) return 0
    x = x > 15 ? 0 : x < 0 ? 15 : x
    y = y > 15 ? 0 : y < 0 ? 15 : y
  }
  return geo.event(x, y)
}

/**
 * Map-area battlefield (PoR FUN_34c7_0810, CotAB 0x2555D; one procedure, R.mapField): 13 × 5 map squares
 * around the party, rows of squares outer, each a sheared 6 × 5 block of cells, north up. Edge classes:
 * 0 open, 1 wall, 3 door. Per square: floor and west edge, north edge, north-west and north-east
 * corners (PoR 0x24F2A, 0x24FE7, 0x2507F, 0x25285; CotAB 0x2508C, 0x25131, 0x251AE, 0x25386), then the
 * furnishing (CotAB 0x24D63); after all squares the finishing pass (PoR). spec/A-games/engine/battlefield.md "Map-area
 * battlefields", spec/A-games/coab/combat.md "Map-area generator".
 */
export function mapBattlefield(geo: GeoMap, X: number, Y: number, roll: Roll, area: number,
  spec: MapFieldSpec = R.mapField, img: Uint8Array | null = null): Battlefield {
  const bf = new Battlefield(false)
  const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1]
  const edge = (x: number, y: number, d: number): number => {
    if (x >= 0 && x <= 15 && y >= 0 && y <= 15) {
      if (geo.passage(x, y, d >> 1) === 0) return 1
      if (geo.wall(x, y, d >> 1) === 0) return 0
      return 3
    }
    return y === Y && (d === 2 || d === 6) ? 0 : 1
  }
  const classify = (x: number, y: number, d: number) => edge(x, y, d) | edge(x + DX[d], y + DY[d], (d + 4) % 8)
  const fu = spec.furnish
  if (fu && !img) throw new Error('furnishing a map battlefield needs START.EXE')
  const s8 = (v: number) => (v << 24) >> 24
  const around = fu ? [1, 2, 3, 4].map((k) => [s8(img![T.ds + T.furnishDx.at + k]), s8(img![T.ds + T.furnishDy.at + k])]) : []
  for (let dy = -2; dy <= 2; dy++) for (let dx = -6; dx <= 6; dx++) {
    const x = X + dx, y = Y + dy
    const plot = (c: number, r: number, cell: number) => bf.set(dy * 5 + 10 + r, dx * 6 + dy * 5 + 21 + c, cell)
    const W = classify(x, y, 6), N = classify(x, y, 0), E = classify(x, y, 2)
    // floor and west edge (02ba)
    for (let r = 2; r <= 4; r++) for (let c = 0; c <= 5; c++) plot(c, r, 0x17)
    if (W === 1) for (let r = 2; r <= 4; r++) { plot(r - 1, r, 0x05); plot(r, r, 0x04); plot(r + 1, r, 0x0e) }
    if (W === 3) { plot(1, 2, 0x09); plot(5, 4, 0x01) }
    // north edge (0377)
    if (N === 1) { plot(3, 0, 0x06); plot(4, 0, 0x06); plot(3, 1, 0x0b); plot(4, 1, 0x0b) }
    else { plot(3, 0, 0x17); plot(4, 0, 0x17); plot(3, 1, 0x17); plot(4, 1, 0x17) }
    // north-west corner (040f)
    const f = classify(x, y - 1, 6) === 0 && classify(x - 1, y, 0) === 0
    plot(1, 0, N === 0 ? (W === 0 ? 0x17 : W === 3 ? 0x0e : f ? 0x01 : 0x0e) : W === 0 ? (f ? 0x10 : 0x06) : f ? 0x13 : 0x03)
    plot(2, 0, N === 0 ? 0x17 : N === 3 ? 0x12 : 0x06)
    plot(1, 1, W === 0 ? (N === 0 ? 0x17 : f ? 0x11 : 0x0b) : W === 3 ? (f ? 0x15 : 0x08) : f ? 0x02 : 0x04)
    plot(2, 1, W !== 1 ? (N === 0 ? 0x17 : N === 3 ? 0x18 : 0x0b) : N === 0 ? 0x0e : N === 3 ? 0x16 : 0x07)
    // north-east corner (0615)
    const g7 = classify(x, y - 1, 2), g8 = classify(x + 1, y, 0)
    plot(5, 0, N === 0 ? (g7 === 1 ? 0x05 : 0x17) : N === 3 ? 0x10 : 0x06)
    plot(6, 0, N === 0
      ? (g7 === 0 ? 0x17 : g7 === 3 ? (E === 0 && g8 !== 0 ? 0x19 : 0x02) : E !== 0 ? 0x04 : g8 !== 0 ? 0x0c : spec.cornerWallEnd)
      : E !== 0 ? 0x0a : g8 !== 0 ? 0x06 : g7 === 0 ? 0x12 : 0x14)
    plot(5, 1, N === 0 ? 0x17 : N === 3 ? 0x11 : 0x0b)
    plot(6, 1, N === 0 ? (g7 === 0 ? 0x17 : E !== 0 ? 0x05 : g8 === 0 ? 0x09 : 0x0d) : E !== 0 ? 0x0f : g8 === 0 ? 0x18 : 0x0b)
    if (!fu) continue
    // furnishing (CotAB 0x24D63): a room has a wall, not just two opposite ones, and no door
    const S = classify(x, y, 4), sides = [N, E, S, W]
    const room = sides.includes(1) && !(N === 1 && S === 1 && !(E === 1 && W === 1))
      && !(E === 1 && W === 1 && !(N === 1 && S === 1)) && !sides.includes(3)
    const flagged = (squareByte(geo, x, y, area) & fu.flag) !== 0
    const blank = (row: number, col: number) => fu.blank.includes(bf.get(row, col))
    const inside = (row: number, col: number) => row >= 0 && row < ROWS && col >= 0 && col < COLS
    for (let i = 2; i <= 3; i++) for (let j = 2; j <= 4; j++) {
      const row = dy * 5 + 10 + j, col = dx * 6 + dy * 5 + 21 + i + j
      if (!inside(row, col) || !blank(row, col) || !flagged || !room) continue
      if (roll(fu.table[1]) > fu.table[2]) continue
      bf.set(row, col, fu.table[0])
      for (const [dc, dr] of around) {
        const r2 = row + dr, c2 = col + dc
        if (inside(r2, c2) && blank(r2, c2) && roll(fu.chair[1]) <= fu.chair[2]) bf.set(r2, c2, fu.chair[0])
      }
    }
  }
  if (spec.finishing) finishingPass(bf, roll, area)
  return bf
}
