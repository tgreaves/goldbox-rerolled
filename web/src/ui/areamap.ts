// Top-down map drawing, shared by the asset viewer and the Area command.
import { STEP, type GeoMap } from '../data/geo'
import { ICONS, type Landmark } from '../rules/landmarks'

export function drawMap(c: HTMLCanvasElement, geo: GeoMap, cell: number, you?: { x: number; y: number; facing: number }, marks: Landmark[] = []) {
  c.width = c.height = 16 * cell + 1
  const g = c.getContext('2d')!
  g.fillStyle = '#000000'
  g.fillRect(0, 0, c.width, c.height)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (geo.event(x, y) && !you) {
      g.fillStyle = '#0000aa'
      g.fillRect(x * cell + 1, y * cell + 1, cell - 1, cell - 1)
    }
    for (let d = 0; d < 4; d++) {
      if (!geo.wall(x, y, d)) continue
      const p = geo.passage(x, y, d)
      g.strokeStyle = p === 0 ? '#aaaaaa' : p === 1 ? '#5555ff' : '#ffff55'
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
  // landmarks (IMP-024) under the party marker
  g.font = `${Math.round(cell * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const m of marks) g.fillText(ICONS[m.kind], m.x * cell + cell / 2 + 0.5, m.y * cell + cell / 2 + 1)
  if (you) {
    const cx = you.x * cell + cell / 2 + 0.5, cy = you.y * cell + cell / 2 + 0.5
    const [dx, dy] = STEP[you.facing]
    const r = cell * 0.35
    g.fillStyle = '#ffff55'
    g.beginPath()
    g.moveTo(cx + dx * r, cy + dy * r)
    g.lineTo(cx - dx * r - dy * r * 0.8, cy - dy * r + dx * r * 0.8)
    g.lineTo(cx - dx * r + dy * r * 0.8, cy - dy * r - dx * r * 0.8)
    g.closePath()
    g.fill()
  }
}

/** The map square under a pointer position on a map canvas drawn by drawMap (CSS-scaled, object-fit contain). */
export function squareAt(c: HTMLCanvasElement, e: MouseEvent): { x: number; y: number } {
  const r = c.getBoundingClientRect()
  const k = Math.min(r.width / c.width, r.height / c.height)
  const ox = (r.width - c.width * k) / 2, oy = (r.height - c.height * k) / 2
  const cell = (c.width - 1) / 16
  return { x: Math.floor((e.clientX - r.left - ox) / k / cell), y: Math.floor((e.clientY - r.top - oy) / k / cell) }
}

/** The landmark under a pointer position on a map canvas drawn by drawMap. */
export function landmarkAt(c: HTMLCanvasElement, e: MouseEvent, marks: Landmark[]): Landmark | undefined {
  const { x, y } = squareAt(c, e)
  return marks.find((m) => m.x === x && m.y === y)
}

/** A planned walk over a map drawn by drawMap (IMP-103): dots on the squares passed, a ring on the last. */
export function drawRoute(c: HTMLCanvasElement, squares: { x: number; y: number }[]) {
  const g = c.getContext('2d')!, cell = (c.width - 1) / 16
  g.fillStyle = '#ffff55'
  squares.forEach(({ x, y }, i) => {
    const cx = x * cell + cell / 2 + 0.5, cy = y * cell + cell / 2 + 0.5
    if (i === squares.length - 1) {
      g.strokeStyle = '#ffff55'; g.lineWidth = Math.max(2, cell / 8)
      g.beginPath(); g.arc(cx, cy, cell * 0.32, 0, Math.PI * 2); g.stroke()
    } else { g.beginPath(); g.arc(cx, cy, Math.max(2, cell * 0.1), 0, Math.PI * 2); g.fill() }
  })
}
