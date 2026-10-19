// The script VM's memory map per game (docs/multi-game.md, step 4). The engine keeps Pool of
// Radiance's addresses internally; a game whose regions sit elsewhere has the addresses its scripts
// use translated on the way in. Offsets inside each region are the same in both games
// (spec/coab/ecl.md, "Memory map").

export interface EclMap {
  /** start of the A word array (0x400 words), B (0x400, with the character view), C (0x200), code (0x1E00 bytes) */
  a: number
  b: number
  c: number
  code: number
}

export const POR_ECL: EclMap = { a: 0x4900, b: 0x6b00, c: 0x9700, code: 0x9900 }
export const COAB_ECL: EclMap = { a: 0x4b00, b: 0x7c00, c: 0x7a00, code: 0x8000 }

const SIZES: [keyof EclMap, number][] = [['a', 0x400], ['b', 0x400], ['c', 0x200], ['code', 0x1e00]]
/** an address no region or engine register uses: reads 0, writes are dropped */
const NOWHERE = 0xfff0

/** A script address in game g's numbering → the engine's (PoR) numbering. */
export function canonical(g: EclMap, a: number): number {
  if (g === POR_ECL) return a
  for (const [k, n] of SIZES) if (a >= g[k] && a < g[k] + n) return POR_ECL[k] + (a - g[k])
  for (const [k, n] of SIZES) if (a >= POR_ECL[k] && a < POR_ECL[k] + n) return NOWHERE
  return a // engine registers (0xC04B …) are the same in both games
}

/** The engine's address back in game g's numbering (for logs and tools). */
export function native(g: EclMap, a: number): number {
  if (g === POR_ECL) return a
  for (const [k, n] of SIZES) if (a >= POR_ECL[k] && a < POR_ECL[k] + n) return g[k] + (a - POR_ECL[k])
  return a
}
