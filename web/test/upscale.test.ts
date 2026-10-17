// Scale2x (EPX) for the smoothed graphics option (IMP-047).
import { describe, expect, it } from 'vitest'

// ImageData is a browser type; a minimal stand-in is enough for the algorithm
class FakeImageData { data: Uint8ClampedArray; constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4) } }
;(globalThis as unknown as { ImageData: unknown }).ImageData = FakeImageData

describe('scale2x', async () => {
  const { scale2x } = await import('../src/render/upscale')
  const img = (rows: string[]) => {
    const d = new FakeImageData(rows[0].length, rows.length)
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') d.data.set([255, 255, 255, 255], (y * d.width + x) * 4) }))
    return d as unknown as ImageData
  }
  const rows = (d: ImageData) => Array.from({ length: d.height }, (_, y) => Array.from({ length: d.width }, (_, x) => (d.data[(y * d.width + x) * 4] ? '#' : '.')).join(''))

  it('doubles flat areas unchanged', () => {
    expect(rows(scale2x(img(['##', '##'])))).toEqual(['####', '####', '####', '####'])
  })
  it('fills the corner of a diagonal step', () => {
    // a staircase: Scale2x rounds the inside corner of the step
    expect(rows(scale2x(img(['#..', '##.', '...'])))).toEqual(['##....', '###...', '####..', '####..', '......', '......'])
  })
})
