// The drawn view's inputs from the engine and the game's files (spec/C-port/exploration-view.md §2.1):
// the GEO map, the wall sets' tiles, the party's square and facing, the backdrop colours, CotAB's sky
// pictures and ground. Shared by the play screen (ui/explore.ts) and the V9 harness (headless/frame.ts).
import type { Engine } from '../vm/engine'
import type { GameFiles } from '../store/gamefiles'
import { game } from '../games/profile'
import { T } from '../games/tables'
import { parseRecord, type Picture } from '../data/image'
import { TILE_MASK_COLOUR } from '../data/walls'
import { PART_A_TABLES, type ViewScene, type ViewTables } from './drawnview'

/** The piece tables and direction vectors from START.EXE (T.viewPieces, T.wallDx/Dy), else Part A's. */
export function viewTables(img: Uint8Array | null): ViewTables {
  if (!img || T.viewPieces.at < 0) return PART_A_TABLES
  const b = (o: number) => img[T.ds + o]
  const w = (o: number) => { const v = b(o) | (b(o + 1) << 8); return v > 0x7fff ? v - 0x10000 : v }
  const s8 = (v: number) => (v > 0x7f ? v - 0x100 : v)
  const p = T.viewPieces.at, n = [...Array(10).keys()]
  return {
    start: n.map((k) => b(p + k)),
    width: n.map((k) => b(p + 10 + k)),
    height: n.map((k) => b(p + 20 + k)),
    col: n.map((k) => w(p + 30 + 2 * k)),
    row: n.map((k) => w(p + 50 + 2 * k)),
    dx: [...Array(8).keys()].map((k) => s8(b(T.wallDx.at + k))),
    dy: [...Array(8).keys()].map((k) => s8(b(T.wallDy.at + k))),
  }
}

const pictures = new WeakMap<GameFiles, Map<string, Picture | null>>()
/** A single-picture record's first picture, decoded once per file set. */
function picture(files: GameFiles, file: string, record: number): Picture | null {
  let m = pictures.get(files)
  if (!m) pictures.set(files, (m = new Map()))
  const key = `${file}#${record}`
  if (!m.has(key)) {
    let p: Picture | null = null
    try { const r = files.record(file, record); p = r ? parseRecord(r).frames[0]?.picture ?? null : null } catch { p = null }
    m.set(key, p)
  }
  return m.get(key)!
}

const tablesOf = new WeakMap<Uint8Array, ViewTables>()

/**
 * The scene of the party's view now, or null where there is no 3D view (no map, or a tile
 * wilderness). `sprite`: the encounter sprite's frame on show (frame distance + 1, FUN_2fea_054e).
 */
export function sceneOf(e: Engine, files: GameFiles, sprite: Picture | null = null): ViewScene | null {
  if (!e.geo || e.overland) return null
  const art = game().view
  const bd = e.backdrop
  const img = e.startImage
  let tables = img ? tablesOf.get(img) : PART_A_TABLES
  if (!tables) { tables = viewTables(img); tablesOf.set(img!, tables) }
  const colour = (c: number | string) => (typeof c === 'number' ? c : bd[c as 'sky' | 'line' | 'band' | 'floor'])
  const overlays: ViewScene['overlays'] = []
  const sky = e.skyArt
  if (sky && art.skyArt) {
    const p = picture(files, 'SKY', sky.record)
    if (p) overlays.push({ pic: p, x: sky.x, y: sky.y, mask: art.skyArt.mask })
  }
  if (art.ground) {
    const p = picture(files, art.ground.file, art.ground.record)
    if (p) overlays.push({ pic: p, x: art.ground.at[0], y: art.ground.at[1], mask: art.ground.mask })
  }
  return {
    geo: e.geo,
    table: e.walls.table,
    tile: (id) => e.walls.tile(id),
    x: e.x,
    y: e.y,
    facing2: e.facing2,
    closed: art.closedEdges.includes(e.area),
    tables,
    bands: art.bands.map((b) => ({ from: b.rows[0], to: b.rows[1], colour: colour(b.colour) })),
    overlays,
    tileMask: TILE_MASK_COLOUR,
    sprite,
  }
}

/** The frame of a SPRIT record shown at `distance` (FUN_2fea_054e: distance + 1 in map areas). */
export function spriteFrame(frames: Picture[] | null | undefined, distance: number): Picture | null {
  if (!frames?.length) return null
  return frames[Math.max(0, Math.min(frames.length - 1, distance))]
}
