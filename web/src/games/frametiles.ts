// The tiles of a game's frames, from its profile and START.EXE (games/view.ts, games/tables.ts).
import { game } from './profile'
import { T } from './tables'

/** The colour a game's frame tiles leave undrawn (−1: none). */
export function frameMask(): number {
  const f = game().view.frame
  return 'tables' in f ? f.tables.mask : -1
}

export interface ScreenFrame {
  /** tile number (of 8X8D1 #202) at each cell of a 40 × 24 frame, or −1 where none is drawn */
  at(col: number, row: number): number
}

/** The 3 × 3 border tiles for a window: corners and edges. */
export function borderTiles(img: Uint8Array | null): { tl: number; t: number; tr: number; l: number; r: number; bl: number; b: number; br: number } | null {
  const f = game().view.frame
  if ('rope' in f) {
    const { corner: c, vertical: v, horizontal: h } = f.rope
    return { tl: c, t: h, tr: c, l: v, r: v, bl: c, b: h, br: c }
  }
  if (!img) return null
  const read = (ref: { at: number }, i: number) => f.tables.tile0 + img[T.ds + ref.at + i]
  const most = (ref: { at: number }, n: number) => {
    const counts = new Map<number, number>()
    for (let i = 0; i < n; i++) counts.set(read(ref, i), (counts.get(read(ref, i)) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1])[0][0]
  }
  // corners as the screen frame ends up after its rows and columns overlap (0x1330)
  return { tl: read(T.frameLeft, 0), t: most(T.frameTop, 40), tr: read(T.frameRight, 0), l: most(T.frameLeft, 24),
    r: most(T.frameRight, 24), bl: read(T.frameBottom, 0), b: most(T.frameBottom, 40), br: read(T.frameBottom, 39) }
}

/** The full-screen frame (CotAB 0x1330), with divider rows (0x1403); null for a game without one. */
export function screenFrame(img: Uint8Array | null, dividers: number[] = []): ScreenFrame | null {
  const f = game().view.frame
  if (!('tables' in f) || !img) return null
  const read = (ref: { at: number }, i: number) => f.tables.tile0 + img[T.ds + ref.at + i]
  return {
    at(col, row) {
      if (row === 23) return read(T.frameBottom, col)
      if (dividers.includes(row)) return read(T.frameDivider, col)
      if (col === 0) return read(T.frameLeft, row)
      if (col === 39) return read(T.frameRight, row)
      if (row === 0) return read(T.frameTop, col)
      return -1
    },
  }
}
