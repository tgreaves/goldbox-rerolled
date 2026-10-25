// Travel on the area map (IMP-103): the shortest walk from the party's square to another of the same map,
// through open passages only (GeoMap.passage 1), as the step does (vm/engine.ts: the side of the square
// stood on decides). Locked doors (2, 3) and the map's edges are not crossed: a door is for the player
// to open, and a step off the edge leaves the area. Not in the original.
import { STEP, type GeoMap } from '../data/geo'

/** The directions (0 N, 1 E, 2 S, 3 W) of each step from `from` to `to`; [] when already there, null when no way. */
export function route(geo: GeoMap, from: { x: number; y: number }, to: { x: number; y: number }): number[] | null {
  const key = (x: number, y: number) => y * 16 + x
  if (to.x < 0 || to.x > 15 || to.y < 0 || to.y > 15) return null
  const came = new Map<number, { prev: number; d: number }>()
  const start = key(from.x, from.y), goal = key(to.x, to.y)
  if (start === goal) return []
  const queue = [start]
  came.set(start, { prev: -1, d: -1 })
  while (queue.length) {
    const k = queue.shift()!
    const x = k % 16, y = k >> 4
    for (let d = 0; d < 4; d++) {
      if (geo.passage(x, y, d) !== 1) continue
      const nx = x + STEP[d][0], ny = y + STEP[d][1]
      if (nx < 0 || nx > 15 || ny < 0 || ny > 15) continue
      const n = key(nx, ny)
      if (came.has(n)) continue
      came.set(n, { prev: k, d })
      if (n === goal) {
        const dirs: number[] = []
        for (let c = goal; c !== start; c = came.get(c)!.prev) dirs.push(came.get(c)!.d)
        return dirs.reverse()
      }
      queue.push(n)
    }
  }
  return null
}

/** The squares a route passes through, after the start. */
export function routeSquares(from: { x: number; y: number }, dirs: number[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  let { x, y } = from
  for (const d of dirs) { x += STEP[d][0]; y += STEP[d][1]; out.push({ x, y }) }
  return out
}
