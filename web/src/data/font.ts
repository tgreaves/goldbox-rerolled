// 8x8 font: 8X8D1.DAX record 201, 177 glyphs x 8 bytes, 1 bit per pixel, MSB left (spec/A-games/engine/graphics.md)

export interface Font {
  glyphs: Uint8Array[]
}

export function parseFont(record: Uint8Array): Font {
  const glyphs: Uint8Array[] = []
  for (let g = 0; g + 8 <= record.length; g += 8) glyphs.push(record.subarray(g, g + 8))
  return { glyphs }
}

/** Glyph index for an ASCII character, as ECL text codes map (spec/A-games/engine/graphics.md). */
export function glyphIndex(ch: string): number {
  const c = ch.toUpperCase().charCodeAt(0)
  if (c >= 0x40 && c < 0x60) return c - 0x40
  if (c >= 0x20 && c < 0x40) return c
  return 0x20
}
