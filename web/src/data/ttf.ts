// The game's 8 × 8 font (8X8D1.DAX #201, spec/graphics.md "Font") turned into a TrueType font at run
// time, so ordinary HTML text can use it (IMP-038). The font comes from the player's files; nothing of
// it is shipped. Each lit run of pixels becomes a square outline: 128 units a pixel, 1024 to the em,
// baseline under row 6 (row 7 holds descenders), every glyph 8 pixels wide.
import { parseFont } from './font'

const PX = 128, EM = 8 * PX, ASC = 7 * PX, DESC = PX

/** Characters drawn, as the original's text codes map (spec/graphics.md): no lowercase in the game. */
export function charMap(): Map<number, number> {
  const m = new Map<number, number>()
  for (let c = 0x20; c <= 0x3f; c++) if (c !== 0x25) m.set(c, c) // 0x25 is a solid block in the game, not %
  m.set(0x40, 0x40) // @
  for (let i = 0; i < 26; i++) { m.set(0x41 + i, 1 + i); m.set(0x61 + i, 1 + i) } // A–Z, a–z → the capitals
  return m
}

class Buf {
  private b: number[] = []
  u8(v: number) { this.b.push(v & 0xff); return this }
  u16(v: number) { return this.u8(v >> 8).u8(v) }
  i16(v: number) { return this.u16(v & 0xffff) }
  u32(v: number) { return this.u16((v >>> 16) & 0xffff).u16(v & 0xffff) }
  tag(s: string) { for (const ch of s) this.u8(ch.charCodeAt(0)); return this }
  bytes(a: ArrayLike<number>) { for (let i = 0; i < a.length; i++) this.b.push(a[i] & 0xff); return this }
  pad4() { while (this.b.length % 4) this.b.push(0); return this }
  get length() { return this.b.length }
  out() { return Uint8Array.from(this.b) }
}

function checksum(d: Uint8Array) {
  let s = 0
  for (let i = 0; i < d.length; i += 4) s = (s + (((d[i] << 24) | ((d[i + 1] ?? 0) << 16) | ((d[i + 2] ?? 0) << 8) | (d[i + 3] ?? 0)) >>> 0)) >>> 0
  return s
}

interface Outline { contours: [number, number][][]; xMin: number; yMin: number; xMax: number; yMax: number }

function outline(g: Uint8Array): Outline {
  const contours: [number, number][][] = []
  let xMin = EM, yMin = EM, xMax = 0, yMax = -EM
  for (let r = 0; r < 8; r++) {
    const row = g[r]
    for (let x = 0; x < 8;) {
      if (!((row >> (7 - x)) & 1)) { x++; continue }
      let e = x
      while (e < 8 && (row >> (7 - e)) & 1) e++
      const x0 = x * PX, x1 = e * PX, top = (7 - r) * PX, bot = (6 - r) * PX
      contours.push([[x0, bot], [x0, top], [x1, top], [x1, bot]]) // clockwise: TrueType outer contour
      xMin = Math.min(xMin, x0); xMax = Math.max(xMax, x1); yMin = Math.min(yMin, bot); yMax = Math.max(yMax, top)
      x = e
    }
  }
  return contours.length ? { contours, xMin, yMin, xMax, yMax } : { contours, xMin: 0, yMin: 0, xMax: 0, yMax: 0 }
}

function nameTable(family: string) {
  const recs: [number, string][] = [[1, family], [2, 'Regular'], [3, `${family} Regular`], [4, family], [5, 'Version 1.0'], [6, `${family}-Regular`]]
  const strings = recs.map(([, s]) => { const b = new Buf(); for (const ch of s) b.u16(ch.charCodeAt(0)); return b.out() })
  const b = new Buf().u16(0).u16(recs.length).u16(6 + recs.length * 12)
  let off = 0
  recs.forEach(([id], i) => { b.u16(3).u16(1).u16(0x409).u16(id).u16(strings[i].length).u16(off); off += strings[i].length })
  for (const s of strings) b.bytes(s)
  return b.out()
}

/** A TrueType font from the game's font record. */
export function buildTtf(record: Uint8Array, family = 'Pool of Radiance'): Uint8Array {
  const font = parseFont(record)
  const map = charMap()
  const used = [...new Set(map.values())].sort((a, b) => a - b) // game glyph indexes in the font
  const gid = new Map(used.map((g, i) => [g, i + 1])) // glyph 0 is .notdef
  const outlines: Outline[] = [{ contours: [], xMin: 0, yMin: 0, xMax: 0, yMax: 0 }, ...used.map((g) => outline(font.glyphs[g] ?? new Uint8Array(8)))]
  const n = outlines.length

  // glyf + loca
  const glyf = new Buf()
  const loca: number[] = []
  let maxPoints = 0, maxContours = 0
  for (const o of outlines) {
    loca.push(glyf.length)
    if (!o.contours.length) continue
    maxContours = Math.max(maxContours, o.contours.length)
    maxPoints = Math.max(maxPoints, o.contours.length * 4)
    glyf.i16(o.contours.length).i16(o.xMin).i16(o.yMin).i16(o.xMax).i16(o.yMax)
    o.contours.forEach((_, i) => glyf.u16(i * 4 + 3))
    glyf.u16(0) // no instructions
    const pts = o.contours.flat()
    for (let i = 0; i < pts.length; i++) glyf.u8(0x01) // on curve, 16-bit deltas
    let px = 0
    for (const [x] of pts) { glyf.i16(x - px); px = x }
    let py = 0
    for (const [, y] of pts) { glyf.i16(y - py); py = y }
    glyf.pad4()
  }
  loca.push(glyf.length)
  const bbox = outlines.reduce((a, o) => o.contours.length ? { xMin: Math.min(a.xMin, o.xMin), yMin: Math.min(a.yMin, o.yMin), xMax: Math.max(a.xMax, o.xMax), yMax: Math.max(a.yMax, o.yMax) } : a,
    { xMin: 0, yMin: 0, xMax: 0, yMax: 0 })

  const head = new Buf().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(EM)
    .u32(0).u32(0).u32(0).u32(0).i16(bbox.xMin).i16(bbox.yMin).i16(bbox.xMax).i16(bbox.yMax)
    .u16(0).u16(8).i16(2).i16(1).i16(0)
  const hhea = new Buf().u32(0x00010000).i16(ASC).i16(-DESC).i16(0).u16(EM).i16(0).i16(0).i16(bbox.xMax)
    .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(n)
  const maxp = new Buf().u32(0x00010000).u16(n).u16(maxPoints).u16(maxContours).u16(0).u16(0)
    .u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0)
  const codes = [...map.keys()].sort((a, b) => a - b)
  const os2 = new Buf().u16(4).i16(EM).u16(400).u16(5).u16(0)
    .i16(EM / 2).i16(EM / 2).i16(0).i16(PX).i16(EM / 2).i16(EM / 2).i16(0).i16(3 * PX).i16(PX).i16(3 * PX).i16(0)
    .bytes([2, 0, 6, 9, 0, 0, 0, 0, 0, 0]) // panose: Latin text, monospaced
    .u32(1).u32(0).u32(0).u32(0).tag('PRAD').u16(0x40).u16(codes[0]).u16(codes[codes.length - 1])
    .i16(ASC).i16(-DESC).i16(0).u16(ASC).u16(DESC).u32(1).u32(0).i16(5 * PX).i16(6 * PX).u16(0).u16(0x20).u16(1)
  const hmtx = new Buf()
  for (const o of outlines) hmtx.u16(EM).i16(o.xMin)
  const locaB = new Buf()
  for (const v of loca) locaB.u32(v)
  // cmap format 4: one segment per run of codes with consecutive glyphs
  const segs: [number, number, number][] = [] // start, end, delta
  for (const c of codes) {
    const g = gid.get(map.get(c)!)!
    const last = segs[segs.length - 1]
    if (last && c === last[1] + 1 && ((last[2] + c) & 0xffff) === g) last[1] = c
    else segs.push([c, c, (g - c) & 0xffff])
  }
  segs.push([0xffff, 0xffff, 1])
  const segX2 = segs.length * 2
  const sr = 2 * 2 ** Math.floor(Math.log2(segs.length))
  const sub = new Buf().u16(4).u16(16 + segs.length * 8).u16(0).u16(segX2).u16(sr).u16(Math.log2(sr / 2)).u16(segX2 - sr)
  for (const s of segs) sub.u16(s[1])
  sub.u16(0)
  for (const s of segs) sub.u16(s[0])
  for (const s of segs) sub.u16(s[2])
  for (let i = 0; i < segs.length; i++) sub.u16(0)
  const cmap = new Buf().u16(0).u16(1).u16(3).u16(1).u32(12).bytes(sub.out())
  const post = new Buf().u32(0x00030000).u32(0).i16(-PX).i16(PX / 2).u32(1).u32(0).u32(0).u32(0).u32(0)

  const tables: [string, Uint8Array][] = ([
    ['OS/2', os2.out()], ['cmap', cmap.out()], ['glyf', glyf.out()], ['head', head.out()], ['hhea', hhea.out()],
    ['hmtx', hmtx.out()], ['loca', locaB.out()], ['maxp', maxp.out()], ['name', nameTable(family)], ['post', post.out()],
  ] as [string, Uint8Array][]).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const num = tables.length
  const es = Math.floor(Math.log2(num)), range = 16 * 2 ** es
  const dir = new Buf().u32(0x00010000).u16(num).u16(range).u16(es).u16(num * 16 - range)
  let offset = 12 + num * 16
  const body = new Buf()
  for (const [tag, data] of tables) {
    dir.tag(tag).u32(checksum(data)).u32(offset).u32(data.length)
    body.bytes(data).pad4()
    offset = 12 + num * 16 + body.length
  }
  const out = new Uint8Array(dir.length + body.length)
  out.set(dir.out(), 0)
  out.set(body.out(), dir.length)
  // head.checkSumAdjustment = 0xB1B0AFBA − checksum of the whole font
  const headAt = 12 + num * 16 + tables.slice(0, tables.findIndex(([t]) => t === 'head')).reduce((a, [, d]) => a + ((d.length + 3) & ~3), 0)
  const adj = (0xb1b0afba - checksum(out)) >>> 0
  out[headAt + 8] = adj >>> 24; out[headAt + 9] = (adj >> 16) & 0xff; out[headAt + 10] = (adj >> 8) & 0xff; out[headAt + 11] = adj & 0xff
  return out
}
