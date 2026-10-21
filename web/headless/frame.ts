// V9 (spec/AUDIT.md §8.1, spec/C-port/exploration-view.md §2.3): one drawn-view frame, headless. The
// engine's state after a run (a save, a debug jump, commands) gives the scene; the frame is the
// original's 88 × 88 EGA indices, written as a PNG or compared by hash. Nothing of the game's art is
// kept: a frame exists only where the player's files are.
import { createHash } from 'node:crypto'
import { crc32, deflateSync } from 'node:zlib'
import type { Engine } from '../src/vm/engine'
import type { GameFiles } from '../src/store/gamefiles'
import { EGA, parseRecord } from '../src/data/image'
import { VIEW, drawView, frameRGBA } from '../src/render/drawnview'
import { sceneOf, spriteFrame } from '../src/render/viewscene'

/** An encounter sprite on show (Io.sprite's arguments), as the frame draws it. */
export interface ShownSprite { sprite: number; picture: number; distance: number }

export interface ViewFrame {
  width: number
  height: number
  /** EGA index per pixel, row-major */
  indices: Uint8Array
  /** SHA-256 of the indices, hex: what a clean-room build's frame is compared by */
  sha256: string
}

/** The drawn view of the engine's position now, with the sprite on show; null: no 3D view here. */
export function renderFrame(e: Engine, files: GameFiles, shown: ShownSprite | null = null): ViewFrame | null {
  let sprite = null
  if (shown && !(shown.distance === 0 && shown.picture !== 255)) {
    const raw = files.record(`SPRIT${e.block}`, shown.sprite)
    try { if (raw) sprite = spriteFrame(parseRecord(raw).frames.map((f) => f.picture), shown.distance) } catch { sprite = null }
  }
  const scene = sceneOf(e, files, sprite)
  if (!scene) return null
  const indices = drawView(scene)
  return { width: VIEW, height: VIEW, indices, sha256: createHash('sha256').update(indices).digest('hex') }
}

/** A PNG of a frame through the EGA palette, each pixel `scale` × `scale` (RGBA, 8 bits, no filter). */
export function framePng(f: ViewFrame, scale = 1): Uint8Array {
  const rgba = frameRGBA(f.indices, EGA)
  const w = f.width * scale, h = f.height * scale
  const raw = new Uint8Array((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    const o = y * (w * 4 + 1)
    raw[o] = 0
    for (let x = 0; x < w; x++) raw.set(rgba.subarray(((Math.floor(y / scale) * f.width) + Math.floor(x / scale)) * 4, ((Math.floor(y / scale) * f.width) + Math.floor(x / scale)) * 4 + 4), o + 1 + x * 4)
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)) >>> 0)
    return out
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w); dv.setUint32(4, h)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(raw))), chunk('IEND', new Uint8Array(0))]
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { png.set(p, o); o += p.length }
  return png
}
