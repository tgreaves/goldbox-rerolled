// Top-down map drawing, shared by the asset viewer and the Area command.
import { STEP, type GeoMap } from '../data/geo'

export function drawMap(c: HTMLCanvasElement, geo: GeoMap, cell: number, you?: { x: number; y: number; facing: number }) {
  c.width = c.height = 16 * cell + 1
  const g = c.getContext('2d')!
  g.fillStyle = '#0b1218'
  g.fillRect(0, 0, c.width, c.height)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (geo.event(x, y) && !you) {
      g.fillStyle = '#203040'
      g.fillRect(x * cell + 1, y * cell + 1, cell - 1, cell - 1)
    }
    for (let d = 0; d < 4; d++) {
      if (!geo.wall(x, y, d)) continue
      const p = geo.passage(x, y, d)
      g.strokeStyle = p === 0 ? '#c9d4de' : p === 1 ? '#4c8bd6' : '#f2c94c'
      g.lineWidth = Math.max(2, cell / 6)
      const [dx, dy] = STEP[d]
      const cx = x * cell + cell / 2 + 0.5, cy = y * cell + cell / 2 + 0.5
      const ex = cx + (dx * cell) / 2, ey = cy + (dy * cell) / 2
      g.beginPath()
      g.moveTo(ex - (dy * cell) / 2, ey - (dx * cell) / 2)
      g.lineTo(ex + (dy * cell) / 2, ey + (dx * cell) / 2)
      g.stroke()
    }
  }
  if (you) {
    const cx = you.x * cell + cell / 2 + 0.5, cy = you.y * cell + cell / 2 + 0.5
    const [dx, dy] = STEP[you.facing]
    const r = cell * 0.35
    g.fillStyle = '#f2c94c'
    g.beginPath()
    g.moveTo(cx + dx * r, cy + dy * r)
    g.lineTo(cx - dx * r - dy * r * 0.8, cy - dy * r + dx * r * 0.8)
    g.lineTo(cx - dx * r + dy * r * 0.8, cy - dy * r - dx * r * 0.8)
    g.closePath()
    g.fill()
  }
}
