// Travel on the area map (IMP-103): the shortest walk through open passages, never through a locked door
// or across the map's edge.
import { describe, expect, it } from 'vitest'
import { GeoMap } from '../src/data/geo'
import { route, routeSquares } from '../src/rules/travel'

/** an open 16 × 16 map; `wall` puts a wall of type 1 on a side, with passage `p` (0 wall, 1 open, 2 locked) */
function map() {
  const raw = new Uint8Array(1026)
  const geo = new GeoMap(raw)
  const wall = (x: number, y: number, d: number, p = 0) => {
    const i = y * 16 + x, plane = geo.planes[d >> 1]
    plane[i] = d % 2 === 0 ? (plane[i] & 0x0f) | 0x10 : (plane[i] & 0xf0) | 0x01
    geo.planes[3][i] = (geo.planes[3][i] & ~(3 << (2 * d))) | (p << (2 * d))
  }
  return { geo, wall }
}

describe('travel route', () => {
  it('goes straight on an open map, and never wraps over the edge', () => {
    const { geo } = map()
    expect(route(geo, { x: 0, y: 0 }, { x: 3, y: 0 })).toEqual([1, 1, 1])
    expect(route(geo, { x: 0, y: 0 }, { x: 15, y: 0 })).toHaveLength(15) // not one step west across the edge
    expect(route(geo, { x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([])
  })

  it('goes round a wall, as the side of the square stood on decides', () => {
    const { geo, wall } = map()
    wall(0, 0, 1) // east of (0,0)
    const r = route(geo, { x: 0, y: 0 }, { x: 1, y: 0 })!
    expect(r).toEqual([2, 1, 0])
    expect(routeSquares({ x: 0, y: 0 }, r)).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }])
  })

  it('does not go through a locked door, and says when there is no way', () => {
    const { geo, wall } = map()
    // shut (5,5) in: three walls and a locked door to the north
    wall(5, 5, 1); wall(5, 5, 2); wall(5, 5, 3); wall(5, 5, 0, 2)
    expect(route(geo, { x: 5, y: 5 }, { x: 5, y: 4 })).toBeNull()
    wall(5, 5, 0, 1) // the door opened
    expect(route(geo, { x: 5, y: 5 }, { x: 5, y: 4 })).toEqual([0])
  })
})
