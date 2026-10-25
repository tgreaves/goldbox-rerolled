// The wilderness view's window (IMP-109): 120 pixels wide it is the original's 5 × 5 window
// (FUN_54cf_0000); wider, the party stays in the middle until the view meets the map's edge.
import { describe, expect, it } from 'vitest'
import { Overland, WIDTH } from '../src/rules/overland'

describe('the wilderness window', () => {
  it('is the original window at 120 pixels', () => {
    for (let gx = 0; gx < WIDTH; gx++) expect(Overland.left(gx, 120)).toBe(Overland.window(gx, 0).x0 * 24)
  })

  it('keeps the party in the middle of a wider view, and stops at the edges', () => {
    const width = 349
    expect(Overland.left(20, width)).toBe(20 * 24 + 12 - 175)
    expect(Overland.left(1, width)).toBe(0)
    expect(Overland.left(WIDTH - 1, width)).toBe(WIDTH * 24 - width)
    expect(Overland.left(10, WIDTH * 24)).toBe(0) // the whole map
  })
})
