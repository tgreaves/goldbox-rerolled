// Battlefield view: a window onto the 25 x 50 combat grid (spec/combat.md, "Battlefield"), drawn
// from the game's tile sets (DUNGCOM or WILDCOM, then RANDCOM from image slot 0x22) with the
// combatants' icons on top. One cell is one 24 x 24 tile.
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, toImageData, spriteImage, type Picture } from '../data/image'
import { COLS, ROWS, type Battlefield, type CellInfo } from '../rules/battlefield'

export const CELL = 24

export interface Figure {
  row: number
  col: number
  /** icon in its normal and action poses; colour 0 transparent */
  icon: Picture | null
  action?: Picture | null
  /** 1 × 1 or 2 × 2 cells */
  big?: boolean
  /** the party's or the enemy's */
  side: 0 | 1
  /** lying down: not drawn standing (bodies are a cell, 0x1F) */
  down?: boolean
  /** facing left (mirrored) */
  left?: boolean
}

function canvasOf(p: Picture, sprite: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = p.width
  c.height = p.height
  c.getContext('2d')!.putImageData(sprite ? spriteImage(p) : toImageData(p), 0, 0)
  return c
}

export class CombatView {
  private tiles: (HTMLCanvasElement | null)[] = []
  private iconCache = new WeakMap<Picture, HTMLCanvasElement>()
  readonly canvas: HTMLCanvasElement
  /** visible window in cells */
  cols: number
  rows: number

  constructor(canvas: HTMLCanvasElement, files: GameFiles, outdoors: boolean, cols = 15, rows = 9) {
    this.canvas = canvas
    this.cols = cols
    this.rows = rows
    canvas.width = cols * CELL
    canvas.height = rows * CELL
    const set = (name: string, from: number) => {
      const raw = files.record(name, 1)
      if (!raw) return
      parseRecord(raw).frames.forEach((f, i) => { this.tiles[from + i] = canvasOf(f.picture, false) })
    }
    set(outdoors ? 'WILDCOM' : 'DUNGCOM', 0)
    set('RANDCOM', 0x22)
  }

  private icon(p: Picture): HTMLCanvasElement {
    let c = this.iconCache.get(p)
    if (!c) this.iconCache.set(p, (c = canvasOf(p, true)))
    return c
  }

  /**
   * Size the window to the space on screen: about 56 CSS pixels a cell, at least the original's 7 × 7
   * cells (FUN_577f_06e9 tests 0–6 on both axes), at most the whole 25 × 50 field. True if it changed.
   */
  fit(width: number, height: number): boolean {
    if (width <= 0 || height <= 0) return false
    const rows = Math.max(7, Math.min(ROWS, Math.round(height / 56)))
    const cols = Math.max(7, Math.min(COLS, Math.round((rows * width) / height)))
    if (rows === this.rows && cols === this.cols) return false
    this.rows = rows; this.cols = cols
    this.canvas.width = cols * CELL
    this.canvas.height = rows * CELL
    return true
  }

  /** Top-left cell of a window centred on (row, col), kept inside the grid. */
  origin(row: number, col: number): [number, number] {
    const r0 = Math.max(0, Math.min(ROWS - this.rows, row - (this.rows >> 1)))
    const c0 = Math.max(0, Math.min(COLS - this.cols, col - (this.cols >> 1)))
    return [r0, c0]
  }

  draw(bf: Battlefield, cells: CellInfo[], figures: Figure[], focus: { row: number; col: number },
    marks: { row: number; col: number; colour: string }[] = [], acting?: Figure) {
    const g = this.canvas.getContext('2d')!
    const [r0, c0] = this.origin(focus.row, focus.col)
    g.fillStyle = '#000'
    g.fillRect(0, 0, this.canvas.width, this.canvas.height)
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const v = bf.get(r0 + r, c0 + c)
      const t = v ? this.tiles[cells[v]?.image ?? -1] : null
      if (t) g.drawImage(t, c * CELL, r * CELL)
    }
    for (const f of figures) {
      if (f.down) continue
      const pic = f === acting && f.action ? f.action : f.icon
      if (!pic) continue
      const x = (f.col - c0) * CELL, y = (f.row - r0) * CELL
      if (x < -2 * CELL || y < -2 * CELL || x > this.canvas.width || y > this.canvas.height) continue
      const img = this.icon(pic)
      g.save()
      if (f.left) { g.translate(x + img.width, y); g.scale(-1, 1); g.drawImage(img, 0, 0) } else g.drawImage(img, x, y)
      g.restore()
    }
    for (const m of marks) {
      g.strokeStyle = m.colour
      g.lineWidth = 2
      g.strokeRect((m.col - c0) * CELL + 1, (m.row - r0) * CELL + 1, CELL - 2, CELL - 2)
    }
  }

  /** The grid cell under a pointer event, for the window last drawn around `focus`. */
  cellAt(e: MouseEvent, focus: { row: number; col: number }): { row: number; col: number } {
    const r = this.canvas.getBoundingClientRect()
    const [r0, c0] = this.origin(focus.row, focus.col)
    const k = Math.min(r.width / this.canvas.width, r.height / this.canvas.height)
    const ox = (r.width - this.canvas.width * k) / 2, oy = (r.height - this.canvas.height * k) / 2
    return { row: r0 + Math.floor((e.clientY - r.top - oy) / k / CELL), col: c0 + Math.floor((e.clientX - r.left - ox) / k / CELL) }
  }
}
