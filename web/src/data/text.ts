// 6-bit packed ECL text (spec/A-games/engine/ecl.md)

export function unpackText(data: Uint8Array): string {
  let out = ''
  let bits = 0
  let n = 0
  for (const b of data) {
    bits = ((bits << 8) | b) & 0xffffff
    n += 8
    while (n >= 6) {
      n -= 6
      const c = (bits >> n) & 0x3f
      if (c) out += String.fromCharCode(c < 0x20 ? c + 0x40 : c)
    }
  }
  return out
}
