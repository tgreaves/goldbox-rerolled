// Effect records (spec/A-games/engine/records.md, "Effect record"): 9 bytes each in .SPC files and MON<n>SPC.DAX:
// u8 type, u16 duration in minutes (0 = permanent), u8 power, u8 call-on-removal flag, ptr next.
export const EFFECT_SIZE = 9

export interface Effect {
  type: number
  duration: number
  power: number
  flag: number
}

export function parseEffects(d: Uint8Array | undefined): Effect[] {
  const out: Effect[] = []
  if (!d) return out
  for (let o = 0; o + EFFECT_SIZE <= d.length; o += EFFECT_SIZE) {
    out.push({ type: d[o], duration: d[o + 1] | (d[o + 2] << 8), power: d[o + 3], flag: d[o + 4] })
  }
  return out
}

export function effectsFile(list: Effect[]): Uint8Array {
  const d = new Uint8Array(list.length * EFFECT_SIZE)
  list.forEach((e, i) => {
    const o = i * EFFECT_SIZE
    d[o] = e.type
    d[o + 1] = e.duration & 0xff
    d[o + 2] = (e.duration >> 8) & 0xff
    d[o + 3] = e.power
    d[o + 4] = e.flag
  })
  return d
}
