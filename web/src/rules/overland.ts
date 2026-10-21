// Overland travel in the wilderness (areas 25-27), spec/A-games/engine/overland.md. The tables are read at runtime
// from the data segment of the player's START.EXE; nothing from the game is shipped.
import { T } from '../games/tables'
import { unexepack } from '../data/exepack'

export const WIDTH = 44
export const HEIGHT = 36

type Read = (addr: number) => number

export class Overland {
  /** tile id per square, row-major, DS:3648 */
  readonly map: Uint8Array
  /** plot-dependent squares 1-9, DS:0C36 (6 bytes each) */
  private specials: { x: number; y: number; tile: number }[]
  private dx: Int8Array
  private dy: Int8Array
  /** first global column of each area kind 0-4 (DS:3C76); areas 25-27 are kinds 2-4 */
  private offsets: Uint8Array

  constructor(image: Uint8Array) {
    const at = (o: number, n: number) => image.subarray(T.ds + o, T.ds + o + n)
    this.map = at(T.overlandMap.at, WIDTH * HEIGHT).slice()
    const sp = at(T.overlandSpecials.at, 9 * T.overlandSpecials.row)
    const w = (o: number) => sp[o] | (sp[o + 1] << 8)
    const r = T.overlandSpecials.row
    this.specials = Array.from({ length: 9 }, (_, i) => ({ x: w(i * r), y: w(i * r + 2), tile: w(i * r + 4) }))
    this.dx = new Int8Array(at(T.wallDx.at, 8))
    this.dy = new Int8Array(at(T.wallDy.at, 8))
    this.offsets = at(T.overlandColumns.at, 5).slice()
  }

  static fromStartExe(exe: Uint8Array | undefined): Overland | null {
    if (!exe) return null
    if (T.overlandMap.at < 0) return null // a game without the tile overland
    try { return new Overland(unexepack(exe).image) } catch { return null }
  }

  /** Global column of an area's own x (spec: 13 columns per area). */
  column(area: number, x: number): number {
    return this.offsets[area - 23] + x
  }

  /**
   * Tile shown at a global square (FUN_54fa_0000): the map's tile, or a plot-dependent one where
   * its condition holds. Squares 1 and 2 have no condition and never change.
   */
  tile(gx: number, gy: number, read: Read): number {
    let t = this.map[gy * WIDTH + gx]
    this.specials.forEach((s, i) => {
      if (s.x !== gx || s.y !== gy) return
      const n = i + 1
      const use =
        n === 3 ? read(0x4a8c) !== 0xff
        : n === 4 ? read(0x4ad2) !== 0 || (read(0x4a7c) & 8) !== 0 || read(0x4a9f) === 0
        : n === 5 ? (read(0x4aa0) & 2) === 0
        : n === 6 ? true
        : n === 7 ? (read(0x4aa0) & 1) === 0
        : n === 8 || n === 9 ? read(0x4ab3) > 0xfd
        : false
      if (use) t = s.tile
    })
    return t
  }

  /** Squares the party can never enter (FUN_3e76_0818): sea, lake and similar tiles. */
  static blocked(t: number): boolean {
    return t === 0x4e || (t >= 0x7e && t <= 0x80) || (t >= 0x82 && t <= 0x84) || (t >= 0xa8 && t <= 0xac) ||
      (t >= 0xae && t <= 0xb3) || t === 0xbc || (t >= 0xdd && t <= 0xde) || (t >= 0xe1 && t <= 0xe9) || t === 0xf5
  }

  /** The polluted Stojanow: passable only once ECL 0x4AA2 is set. */
  static river(t: number): boolean {
    return (t >= 0x66 && t <= 0x6c) || t === 0x72
  }

  /**
   * The river cleansing's recolouring (FUN_4804_06b3): tile id → colour map. The river itself
   * (frames DS:0900) turns black to blue and grey to green (DS:091D → 092D); its banks (DS:090B)
   * grey to green (→ 093D). Frame bytes above 0x7F are frames of SQRPACI #2.
   */
  static readonly CLEANSED: ReadonlyMap<number, ReadonlyMap<number, number>> = (() => {
    const id = (f: number) => (f > 0x7f ? 129 + (f & 0x7f) : f + 1)
    const river = new Map([[0, 1], [7, 2]]), banks = new Map([[7, 2]])
    const m = new Map<number, ReadonlyMap<number, number>>()
    for (const f of [0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x71, 0xe0, 0xe1, 0xe2]) m.set(id(f), river)
    for (const f of [0x56, 0x57, 0x58, 0x59, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0xdf, 0xf3, 0xf5]) m.set(id(f), banks)
    return m
  })()
  /** The view positions the cleansing shows, one per pass (DS:094D, DS:095F), then the last one. */
  static readonly CLEANSING_VIEW: readonly [number, number][] = [[17, 15], [17, 15], [17, 15], [19, 20], [19, 20], [19, 20], [23, 25], [23, 25], [23, 25]]

    /** Step for a facing ×2 (0-7). */
  step(facing2: number): [number, number] {
    return [this.dx[facing2 & 7], this.dy[facing2 & 7]]
  }

  /**
   * The 5x5 window of the view (FUN_54cf_0000): the party's cell is the centre except near the
   * map's edges, where the window stops at the edge.
   */
  static window(gx: number, gy: number): { x0: number; y0: number; col: number; row: number } {
    const col = gx < 2 ? gx : gx < 42 ? 2 : gx < 43 ? 3 : 4
    const row = gy < 2 ? gy : gy < 34 ? 2 : gy < 35 ? 3 : 4
    return { x0: gx - col, y0: gy - row, col, row }
  }
}
