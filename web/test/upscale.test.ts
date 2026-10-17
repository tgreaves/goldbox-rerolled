// Whole-pixel enlargement for the Sharp graphics option (IMP-047).
import { describe, expect, it } from 'vitest'

// ImageData is a browser type; a minimal stand-in is enough for the algorithm
class FakeImageData {
  data: Uint8ClampedArray
  width: number
  height: number
  constructor(width: number, height: number) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4) }
}
;(globalThis as unknown as { ImageData: unknown }).ImageData = FakeImageData

describe('nearest', async () => {
  const { nearest } = await import('../src/render/upscale')
  const img = (rows: string[]) => {
    const d = new FakeImageData(rows[0].length, rows.length)
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') d.data.set([255, 255, 255, 255], (y * d.width + x) * 4) }))
    return d as unknown as ImageData
  }
  const rows = (d: ImageData) => Array.from({ length: d.height }, (_, y) => Array.from({ length: d.width }, (_, x) => (d.data[(y * d.width + x) * 4] ? '#' : '.')).join(''))

  it('turns every pixel into a k × k square and invents nothing', () => {
    expect(rows(nearest(img(['#.', '.#']), 2))).toEqual(['##..', '##..', '..##', '..##'])
  })
})
