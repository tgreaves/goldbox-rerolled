// GEO maps (spec/A-games/engine/maps-and-view.md): 16x16 squares, four 256-byte planes after a 2-byte header

export const DIRS = ['N', 'E', 'S', 'W'] as const
export const STEP: ReadonlyArray<readonly [number, number]> = [[0, -1], [1, 0], [0, 1], [-1, 0]]

export class GeoMap {
  readonly planes: Uint8Array[]

  constructor(raw: Uint8Array) {
    if (raw.length !== 1026) throw new Error(`GEO record is ${raw.length} bytes, expected 1026`)
    this.planes = [0, 1, 2, 3].map((i) => raw.subarray(2 + i * 256, 2 + (i + 1) * 256))
  }

  private idx(x: number, y: number): number {
    return (y & 15) * 16 + (x & 15)
  }

  /** Wall type 0..15 on side d (0 N, 1 E, 2 S, 3 W). */
  wall(x: number, y: number, d: number): number {
    const v = this.planes[d >> 1][this.idx(x, y)]
    return d % 2 === 0 ? v >> 4 : v & 15
  }

  /** FUN_55a0_0350: 0 blocked, 1 open, 2 locked door, 3 locked door (cannot be picked). */
  passage(x: number, y: number, d: number): number {
    if (this.wall(x, y, d) === 0) return 1
    return (this.planes[3][this.idx(x, y)] >> (2 * d)) & 3
  }

  /** Set side d's passage (FUN_3e76_0109: an unlocked door becomes 1); the record is the area's own copy. */
  setPassage(x: number, y: number, d: number, v: number) {
    const i = this.idx(x, y)
    this.planes[3][i] = (this.planes[3][i] & ~(3 << (2 * d))) | ((v & 3) << (2 * d))
  }

  event(x: number, y: number): number {
    return this.planes[2][this.idx(x, y)]
  }
}
