// Combat battlefield (spec/combat.md, "Battlefield"): a 25 x 50 grid of cell values, the cell table
// from START.EXE, and the terrain generators.
import { T } from '../games/tables'

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

const OPEN = 0x17

/** Wilderness battlefield (FUN_34c7_11b4) for the overland tile the party stands on. */
export function wildBattlefield(tile: number, read4AB3: number, roll: Roll): Battlefield {
  const bf = new Battlefield(true)
  bf.cells.fill(OPEN)
  const flags = terrainFlags(tile, read4AB3)
  riverPass(bf, flags, roll)
  treePass(bf, flags, roll)
  scatterPass(bf, flags, roll)
  finishingPass(bf, roll, -1)
  return bf
}

/** River (FUN_34c7_0bde): a diagonal river with fords and one sure crossing. */
function riverPass(bf: Battlefield, flags: number, roll: Roll) {
  const chance = flags & 0x10 ? 75 : flags & 0x20 ? 35 : 0
  if (!chance || roll(100) > chance) return
  let start = 34 - roll(4) - roll(4) - roll(4) - roll(4) - roll(4)
  while ((start + 2) % 7 !== 0) start--
  let col = start
  for (let row = 0; row < ROWS && col < COLS; row++, col++) {
    const ford = roll(20) === 1
    bf.set(row, col, ford ? 0x34 : 0x32)
    bf.set(row, col + 1, ford ? 0x35 : 0x33)
  }
  const r = 16 - roll(9)
  bf.set(r, start + r, 0x34)
  bf.set(r + 1, start + r + 1, 0x35)
}

/** Trees and logs (FUN_34c7_0d13). */
function treePass(bf: Battlefield, flags: number, roll: Roll) {
  let chance = 1
  if (flags & 0x04) chance = 3
  if (flags & 0x40) chance = 4
  if (flags & 0x08) chance = 7
  if (flags & 0x80) chance = 0
  for (let row = 1; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    if (bf.get(row, col) !== OPEN || bf.get(row - 1, col) !== OPEN) continue
    if (roll(100) > chance) continue
    const r = roll(10)
    let size = r <= 8 ? Math.floor((r + 1) / 2) : 4 + roll(2)
    if (flags & 0x40) size = 3 + roll(3)
    bf.set(row, col, 0x23 + size)
    if (size < 5) bf.set(row - 1, col, 0x1f + size)
  }
}

/** Rocks, shrubs, marsh plants, tufts and cactus (FUN_34c7_0e9e). */
function scatterPass(bf: Battlefield, flags: number, roll: Roll) {
  let a = 0, b = 15, c = 0, d = 40
  if (flags & 0x02) { b = 45; d = 10 }
  if (flags & 0x04) b = 25
  if (flags & 0x40) { d = 5; c = 30 }
  if (flags & 0x80) { a = 15; d = 25; b = 10 }
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    if (bf.get(row, col) !== OPEN) continue
    const r = roll(255)
    if (r <= a) {
      const k = roll(4)
      if (k === 4 && row > 0 && bf.get(row - 1, col) === OPEN) { bf.set(row, col, 0x40); bf.set(row - 1, col, 0x41) }
      else if (k < 4) bf.set(row, col, 0x3c + k)
    } else if (r <= a + 6) bf.set(row, col, 0x36 + roll(3))
    else if (r <= a + 6 + b) bf.set(row, col, 0x29 + roll(4))
    else if (r <= a + 6 + b + c) bf.set(row, col, 0x39 + Math.floor((roll(10) - 1) / 3))
    else if (r <= a + 6 + b + c + d) {
      const k = roll(4)
      bf.set(row, col, k === 4 && !(flags & 0x40) ? 0x2d + roll(3) : 0x2d + k)
    }
  }
}

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
 * Map-area battlefield (FUN_34c7_0810): 13 × 5 map squares around the party, each a sheared 6 × 5
 * block of cells, north up. Edge classes: 0 open, 1 wall, 3 door.
 */
export function mapBattlefield(geo: import('../data/geo').GeoMap, X: number, Y: number, roll: Roll, area: number): Battlefield {
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
      ? (g7 === 0 ? 0x17 : g7 === 3 ? (E === 0 && g8 !== 0 ? 0x19 : 0x02) : (E === 0 && g8 !== 0 ? 0x0c : 0x04))
      : E !== 0 ? 0x0a : g8 !== 0 ? 0x06 : g7 === 0 ? 0x12 : 0x14)
    plot(5, 1, N === 0 ? 0x17 : N === 3 ? 0x11 : 0x0b)
    plot(6, 1, N === 0 ? (g7 === 0 ? 0x17 : E !== 0 ? 0x05 : g8 === 0 ? 0x09 : 0x0d) : E !== 0 ? 0x0f : g8 === 0 ? 0x18 : 0x0b)
  }
  finishingPass(bf, roll, area)
  return bf
}
