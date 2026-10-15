// SAVGAM*.DAT (spec/savegame.md)

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
}

export const A0 = 0x4900
export const B0 = 0x6b00

export function parseSave(d: Uint8Array): SaveGame {
  const words = (o: number, n: number) => {
    const out = new Uint16Array(n)
    for (let i = 0; i < n; i++) out[i] = d[o + 2 * i] | (d[o + 2 * i + 1] << 8)
    return out
  }
  const party: string[] = []
  for (let i = 0; i < d[0x3208]; i++) {
    const o = 0x3209 + 41 * i
    party.push(String.fromCharCode(...d.subarray(o + 1, o + 1 + d[o])))
  }
  return {
    A: words(1, 0x400),
    B: words(0x801, 0x400),
    C: words(0x1001, 0x200),
    code: d.slice(0x1401, 0x3201),
    x: d[0x3201],
    y: d[0x3202],
    facing2: d[0x3203],
    areaKind: d[0x3206],
    party,
  }
}

export const saveBlock = (s: SaveGame) => s.B[0x6e12 - B0]
export const saveArea = (s: SaveGame) => s.A[0x49f2 - A0]
export const saveGeo = (s: SaveGame) => s.A[0x49c5 - A0]
/** Wall-set records per slot 1-3 (0xFFFF = filled by a multi-set record). */
export const saveWallSets = (s: SaveGame) => [0x4afa, 0x4afb, 0x4afc].map((a) => s.A[a - A0])
