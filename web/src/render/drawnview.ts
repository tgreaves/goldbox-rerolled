// The original's drawn 3D view (decision D6; spec/C-port/exploration-view.md §2): the 88 × 88 frame the
// DOS game composes from the wall sets' 8 × 8 tiles, as PoR's FUN_55a0_05fd and CotAB's Draw3dWorld
// (image 0x53EC0) draw it: the same procedure in both games (spec/A-games/engine/maps-and-view.md,
// "3D view renderer"). Pure: no DOM, so the V9 harness renders frames headless with it.
import type { GeoMap } from '../data/geo'
import type { Picture } from '../data/image'

/** The view is 11 × 11 cells of 8 × 8 pixels, at screen cell (2, 2). */
export const VIEW = 88
export const VIEW_CELLS = 11

/**
 * The piece tables (spec/A-games/engine/maps-and-view.md, "Wall pieces"): per kind 0–9 the first tile
 * index in a wall type's 156 bytes, the width and height in cells, the base column and the row (PoR
 * DS:0C8C, 0C96, 0CA0, 0CAA words, 0CBE words; CotAB DS:0ADA …), and the direction vectors by
 * facing 0–7 (PoR DS:2736 / 273F, CotAB DS:2696 / 269F). Read from START.EXE where it is there.
 */
export interface ViewTables {
  start: number[]
  width: number[]
  height: number[]
  col: number[]
  row: number[]
  dx: number[]
  dy: number[]
}

/** Part A's values (the same bytes in both games, O): the fallback without START.EXE. */
export const PART_A_TABLES: ViewTables = {
  start: [0, 2, 6, 10, 22, 38, 54, 110, 132, 154],
  width: [1, 1, 1, 3, 2, 2, 7, 2, 2, 1],
  height: [2, 4, 4, 4, 8, 8, 8, 11, 11, 2],
  col: [5, 4, 6, 4, 2, 7, 2, 0, 9, 5],
  row: [4, 3, 3, 3, 1, 1, 1, 0, 0, 4],
  dx: [0, 1, 1, 1, 0, -1, -1, -1],
  dy: [-1, -1, 0, 1, 1, 1, 0, -1],
}

/** One piece drawn: kind 0–9 of wall type 1–15, its top-left cell in the view. */
export interface DrawCall { kind: number; type: number; col: number; row: number }

/**
 * The wall type on side `dir` (0, 2, 4, 6 = N, E, S, W) of square (x, y) as the view looks it up
 * (PoR FUN_55a0_047b, CotAB 0x53D42): outside 0–15 a coordinate wraps by one map only (above 15 → 0,
 * below 0 → 15, not modulo 16), except that in the areas whose edges are closed every lookup
 * outside the map is 0 (areas 0 and 10: DS:84DC, CotAB DS:8B78).
 */
export function viewWall(geo: GeoMap, x: number, y: number, dir: number, closed: boolean): number {
  const inside = x >= 0 && x <= 15 && y >= 0 && y <= 15
  if (!inside && closed) return 0
  if (x > 15) x = 0
  if (x < 0) x = 15
  if (y > 15) y = 0
  if (y < 0) y = 15
  return geo.wall(x, y, dir >> 1)
}

/**
 * The pieces the original draws for a position, in its order (the painter's algorithm, far to near).
 * `facing2` is 0, 2, 4, 6. The calls are those of FUN_55a0_05fd → FUN_55a0_0211 (O).
 */
export function viewCalls(geo: GeoMap, x: number, y: number, facing2: number, closed: boolean, t: ViewTables = PART_A_TABLES): DrawCall[] {
  const calls: DrawCall[] = []
  const f = facing2 & 7
  const L = (f + 6) % 8, B = (f + 4) % 8, R = (f + 2) % 8
  const { dx, dy, col } = t
  const wall = (cx: number, cy: number, d: number) => viewWall(geo, cx, cy, d, closed)
  const inside = (cx: number, cy: number) => cx >= 0 && cx <= 15 && cy >= 0 && cy <= 15
  const piece = (kind: number, type: number, c: number) => calls.push({ kind, type, col: c, row: t.row[kind] })
  // the square two ahead; each depth then steps one square back (DS:2736 / 273F by facing (f + 4) % 8)
  let px = x + 2 * dx[f], py = y + 2 * dy[f]
  for (let depth = 2; depth >= 0; depth--) {
    if (depth === 2) {
      // front walls (kind 0) of the square ahead and four to each side, the left walk then the
      // right: a run of front walls is joined by edge pieces (kind 9) in the column between two;
      // `prev` is the last front wall's type (0x6BF–0x7C4, 0x7E0–0x8E5)
      for (const [side, other, step] of [[L, R, -2], [R, L, 2]]) {
        let cx = px, cy = py, off = 0, prev = 0
        const edge = () => col[9] + off + (step < 0 ? 1 : -1)
        for (let k = 0; k < 4; k++) {
          const w = wall(cx, cy, f)
          if (!inside(cx, cy) && wall(cx, cy, other) === 0) prev = 0
          if (w) {
            if (prev > 0) piece(9, prev, edge())
            prev = w
            piece(0, w, col[0] + off)
          } else {
            if (prev > 0 && wall(cx - dx[side], cy - dy[side], side)) piece(9, prev, edge())
            prev = 0
          }
          off += step
          cx += dx[side]
          cy += dy[side]
        }
      }
      // side walls (kinds 1, 2) of the square ahead and two to each side; beyond the first, one
      // column further out (0x8FD–0x97C, 0x994–0xA13)
      for (const [side, kind, step] of [[L, 1, -2], [R, 2, 2]]) {
        let cx = px, cy = py, off = 0
        for (let k = 0; k < 3; k++) {
          const w = wall(cx, cy, side)
          if (w) piece(kind, w, col[kind] + off + (k === 0 ? 0 : step < 0 ? -1 : 1))
          off += step
          cx += dx[side]
          cy += dy[side]
        }
      }
    } else {
      // depth 1: from two squares left inwards, front (kind 3) and left side (kind 4), columns 3
      // apart, then from two squares right inwards, front and right side (kind 5) (0xA20–0xBEC);
      // depth 0 the same with one square each side, 7 columns apart, kinds 6, 7, 8 (0xBF6–0xD77)
      const n = depth === 1 ? 2 : 1, gap = depth === 1 ? 3 : 7
      const front = depth === 1 ? 3 : 6, left = depth === 1 ? 4 : 7, right = depth === 1 ? 5 : 8
      for (const [from, side, kind, sign] of [[L, L, left, -1], [R, R, right, 1]]) {
        const back = from === L ? R : L
        let cx = px + n * dx[from], cy = py + n * dy[from], off = sign * n * gap
        for (let k = 0; k <= n; k++) {
          const w = wall(cx, cy, f)
          if (w) piece(front, w, col[front] + off)
          const s = wall(cx, cy, side)
          if (s) piece(kind, s, col[kind] + off)
          off -= sign * gap
          cx += dx[back]
          cy += dy[back]
        }
      }
    }
    px += dx[B]
    py += dy[B]
  }
  return calls
}

/** What one frame is made of (spec/C-port/exploration-view.md §2.1). */
export interface ViewScene {
  geo: GeoMap
  /** the wall types' tile ids: 15 × 156 bytes (DS:6A58) */
  table: Uint8Array
  /** a tile by id (the tile bank, FUN_5924_015d); undefined: not drawn */
  tile(id: number): Picture | undefined
  x: number
  y: number
  facing2: number
  /** lookups outside the map return no wall (areas 0 and 10) */
  closed: boolean
  tables: ViewTables
  /** the background bands, view rows inclusive, EGA colours (FUN_55a0_0174; CotAB 0x53824) */
  bands: { from: number; to: number; colour: number }[]
  /** pictures over the bands before the walls, in order (CotAB's sun or clouds, then the ground) */
  overlays: { pic: Picture; x: number; y: number; mask: number }[]
  /** the tiles' mask colour (13, FUN_5924_003b) */
  tileMask: number
  /** an encounter sprite's frame over the finished view, at its header (x, y) cells (FUN_5523_0708) */
  sprite?: Picture | null
}

/** Draw a piece (FUN_55a0_0211): cells row by row, clipped to the 11 × 11 view; tile 0 is skipped. */
function drawPiece(out: Uint8Array, s: ViewScene, c: DrawCall) {
  const t = s.tables
  let idx = t.start[c.kind]
  const base = (c.type - 1) * 156
  for (let r = c.row; r < c.row + t.height[c.kind]; r++) {
    for (let q = c.col; q < c.col + t.width[c.kind]; q++, idx++) {
      if (r < 0 || r >= VIEW_CELLS || q < 0 || q >= VIEW_CELLS) continue
      const id = s.table[base + idx]
      if (!id) continue
      const tile = s.tile(id)
      if (tile) blit(out, tile, q * 8, r * 8, s.tileMask)
    }
  }
}

/** A masked draw (FUN_1464_08d4): pixels of the mask colour leave what is under them. */
function blit(out: Uint8Array, p: Picture, x0: number, y0: number, mask: number, remap13 = false) {
  for (let y = 0; y < p.height; y++) {
    const vy = y0 + y
    if (vy < 0 || vy >= VIEW) continue
    for (let x = 0; x < p.width; x++) {
      const vx = x0 + x
      if (vx < 0 || vx >= VIEW) continue
      let v = p.pixels[y * p.width + x]
      if (v === mask) continue
      if (remap13 && v === 13) v = 0
      out[vy * VIEW + vx] = v
    }
  }
}

/** One frame as 88 × 88 EGA indices: bands, overlays, the walls far to near, the sprite. */
export function drawView(s: ViewScene, out: Uint8Array = new Uint8Array(VIEW * VIEW)): Uint8Array {
  for (const b of s.bands) out.fill(b.colour & 15, Math.max(0, b.from) * VIEW, (Math.min(VIEW - 1, b.to) + 1) * VIEW)
  for (const o of s.overlays) blit(out, o.pic, o.x, o.y, o.mask)
  for (const c of viewCalls(s.geo, s.x, s.y, s.facing2, s.closed, s.tables)) drawPiece(out, s, c)
  // SPRIT frames: colour 0 transparent, colour 13 drawn black (FUN_1464_1e5c's 13 → 0)
  if (s.sprite) blit(out, s.sprite, s.sprite.x * 8, s.sprite.y * 8, 0, true)
  return out
}

/** The frame as RGBA bytes through a palette (the EGA one). */
export function frameRGBA(indices: Uint8Array, palette: ReadonlyArray<readonly [number, number, number]>): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(new ArrayBuffer(indices.length * 4))
  for (let i = 0; i < indices.length; i++) {
    const c = palette[indices[i] & 15]
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255
  }
  return rgba
}
