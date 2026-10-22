// SAVGAM*.DAT (spec/A-games/engine/savegame.md; CotAB spec/A-games/coab/records.md §5), in the active game's layout
import { game } from '../games/profile'

export interface SaveGame {
  A: Uint16Array
  B: Uint16Array
  C: Uint16Array
  code: Uint8Array
  x: number
  y: number
  /** facing x 2 (0 N, 2 E, 4 S, 6 W) */
  facing2: number
  areaKind: number
  party: string[]
  /** wall-set record per slot 1–3 (0xFFFF = filled by a multi-set record) */
  wallSets: number[]
}

export const A0 = 0x4900
export const B0 = 0x6b00

export function parseSave(d: Uint8Array): SaveGame {
  const words = (o: number, n: number) => {
    const out = new Uint16Array(n)
    for (let i = 0; i < n; i++) out[i] = d[o + 2 * i] | (d[o + 2 * i + 1] << 8)
    return out
  }
  const L = game().saves
  const party: string[] = []
  for (let i = 0; i < d[L.partyAt]; i++) {
    const o = L.partyAt + 1 + 41 * i
    party.push(String.fromCharCode(...d.subarray(o + 1, o + 1 + d[o])))
  }
  const pos = 0x1401 + L.codeSize // the position after the code buffer (none in SotSB)
  return {
    A: words(1, 0x400),
    B: words(0x801, 0x400),
    C: words(0x1001, 0x200),
    code: d.slice(0x1401, pos),
    x: d[pos],
    y: d[pos + 1],
    facing2: d[pos + 2],
    areaKind: d[pos + 5],
    party,
    wallSets: [0, 1, 2].map((i) => {
      if (L.wallSetsAt < 0) return d[1 + 2 * (0x1fa + i)] | (d[2 + 2 * (0x1fa + i)] << 8) // A[0x4AFA + i]
      const r = d[L.wallSetsAt + 4 * i] | (d[L.wallSetsAt + 4 * i + 1] << 8)
      return r === 0 ? 0xffff : r // CotAB loads a slot only when its record is > 0
    }),
  }
}

export const saveBlock = (s: SaveGame) => s.B[0x6e12 - B0]
export const saveArea = (s: SaveGame) => s.A[0x49f2 - A0]
export const saveGeo = (s: SaveGame) => s.A[0x49c5 - A0]
/** Wall-set records per slot 1-3 (0xFFFF = filled by a multi-set record). */
export const saveWallSets = (s: SaveGame) => s.wallSets
