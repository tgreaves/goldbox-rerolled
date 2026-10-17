// Images (spec/graphics.md): 17-byte header, 4 bits per pixel, default EGA palette

export const EGA: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170],
  [170, 85, 0], [170, 170, 170], [85, 85, 85], [85, 85, 255], [85, 255, 85],
  [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
]

/**
 * The combat screen's colours: drawing it (FUN_10ba_2b88 → FUN_577f_00e3) swaps EGA palette
 * registers 0 and 8, so black shows dark grey and dark grey black, until the battle's cleanup
 * (FUN_320c_0000 → FUN_577f_0105) puts them back.
 */
export const COMBAT_EGA: ReadonlyArray<readonly [number, number, number]> = EGA.map((c, i) => (i === 0 ? EGA[8] : i === 8 ? EGA[0] : c))

export interface Picture {
  width: number
  height: number
  x: number
  y: number
  /** palette index per pixel, row-major */
  pixels: Uint8Array
}

export interface Frame {
  /** display time in tenths of a second (animated records) */
  delay: number
  picture: Picture
}

function header(d: Uint8Array, o: number) {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength)
  return {
    h: dv.getUint16(o, true),
    w8: dv.getUint16(o + 2, true),
    x: dv.getUint16(o + 4, true),
    y: dv.getUint16(o + 6, true),
    count: d[o + 8],
  }
}

function parseBlock(d: Uint8Array, o: number): { pictures: Picture[]; end: number } {
  const { h, w8, x, y, count } = header(d, o)
  o += 17
  const bytesPerRow = w8 * 4
  const pictures: Picture[] = []
  for (let k = 0; k < count; k++) {
    const pixels = new Uint8Array(h * w8 * 8)
    for (let i = 0; i < h * bytesPerRow; i++) {
      const b = d[o + i]
      pixels[i * 2] = b >> 4
      pixels[i * 2 + 1] = b & 15
    }
    o += h * bytesPerRow
    pictures.push({ width: w8 * 8, height: h, x, y, pixels })
  }
  return { pictures, end: o }
}

/**
 * Decode a graphics record: a single block, or an animated record
 * (u8 frames, then per frame u32 delay + block). PIC and FINAL frames after the
 * first are stored XORed with frame 1; pass xorFrames to undo that.
 */
export function parseRecord(d: Uint8Array, xorFrames = false): { animated: boolean; frames: Frame[] } {
  const { h, w8, count } = header(d, 0)
  if (17 + count * h * w8 * 4 === d.length) {
    return { animated: false, frames: parseBlock(d, 0).pictures.map((picture) => ({ delay: 0, picture })) }
  }
  const n = d[0]
  let o = 1
  const frames: Frame[] = []
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength)
  for (let i = 0; i < n; i++) {
    const delay = dv.getUint32(o, true)
    const block = parseBlock(d, o + 4)
    for (const picture of block.pictures) frames.push({ delay, picture })
    o = block.end
  }
  if (o !== d.length) throw new Error(`image layout mismatch: used ${o} of ${d.length} bytes`)
  if (xorFrames && frames.length > 1) {
    const base = frames[0].picture
    for (const f of frames.slice(1)) {
      const p = f.picture
      if (p.width === base.width && p.height === base.height) {
        for (let i = 0; i < p.pixels.length; i++) p.pixels[i] ^= base.pixels[i]
      }
    }
  }
  return { animated: true, frames }
}

export function toImageData(p: Picture, palette = EGA): ImageData {
  const data = new Uint8ClampedArray(p.width * p.height * 4)
  for (let i = 0; i < p.pixels.length; i++) {
    const c = palette[p.pixels[i]]
    data[i * 4] = c[0]
    data[i * 4 + 1] = c[1]
    data[i * 4 + 2] = c[2]
    data[i * 4 + 3] = 255
  }
  return new ImageData(data, p.width, p.height)
}

/**
 * Encounter sprite (`SPRIT`) as drawn on EGA (spec/graphics.md, "Encounter sprites"): colour 0 is
 * transparent, then colour 13 is remapped to black (`FUN_1464_1e5c`, tables `DS:0C6C` / `DS:0C7C`).
 * Colour 13 is the artist's opaque black: outlines, boots, drop shadows.
 */
export function spriteImage(p: Picture, palette = EGA): ImageData {
  const img = toImageData(p, palette)
  for (let i = 0; i < p.pixels.length; i++) {
    if (p.pixels[i] === 0) img.data[i * 4 + 3] = 0
    else if (p.pixels[i] === 13) img.data.set(palette[0], i * 4)
  }
  return img
}

/** Bounding box of a sprite's drawn (non-transparent) pixels. */
export function spriteBox(p: Picture): { left: number; right: number; top: number; bottom: number } {
  let left = p.width, right = -1, top = p.height, bottom = -1
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
    if (p.pixels[y * p.width + x] === 0) continue
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  return right < 0 ? { left: 0, right: p.width - 1, top: 0, bottom: p.height - 1 } : { left, right, top, bottom }
}
