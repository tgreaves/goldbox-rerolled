// The original's window frames (IMP-051): the yellow corner square and the red rope of 8X8D1.DAX
// #202, tiles 20–22 (frame style 0 of FUN_13f1_0000: corner, vertical, horizontal), built in the
// browser from the player's file into a CSS border image, with a switch back to plain borders.
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, toImageData } from '../data/image'

const KEY = 'poolrad.frames'
let available = false

export type FrameChoice = 'original' | 'modern'

export function frameChoice(): FrameChoice {
  try { return localStorage.getItem(KEY) === 'modern' ? 'modern' : 'original' } catch { return 'original' }
}

function apply() {
  document.documentElement.classList.toggle('frames-original', available && frameChoice() === 'original')
}

export function setFrameChoice(c: FrameChoice) {
  try { localStorage.setItem(KEY, c) } catch { /* private mode: this page only */ }
  apply()
}

export const framesAvailable = () => available

/** Each tile pixel drawn as S × S, so the border stays sharp at 2× and 4× scales. */
const S = 4

/** A 3 × 3-tile border image: corners at the four corners, rope along the edges, the middle empty. */
export function installFrames(files: GameFiles) {
  if (available) return apply()
  const rec = files.record('8X8D1', 202)
  if (!rec) return
  try {
    const tiles = parseRecord(rec).frames.map((f) => f.picture)
    const [corner, vertical, horizontal] = [tiles[20], tiles[21], tiles[22]]
    if (!corner || !vertical || !horizontal) return
    const c = document.createElement('canvas')
    c.width = c.height = 24 * S
    const g = c.getContext('2d')!
    const put = (p: typeof corner, cx: number, cy: number) => {
      const img = toImageData(p)
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if (p.pixels[y * 8 + x] === 0) continue // colour 0 lets the panel show through
        const i = (y * 8 + x) * 4
        g.fillStyle = `rgb(${img.data[i]},${img.data[i + 1]},${img.data[i + 2]})`
        g.fillRect((cx * 8 + x) * S, (cy * 8 + y) * S, S, S)
      }
    }
    for (const [cx, cy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) put(corner, cx, cy)
    put(horizontal, 1, 0)
    put(horizontal, 1, 2)
    put(vertical, 0, 1)
    put(vertical, 2, 1)
    document.documentElement.style.setProperty('--rope', `url(${c.toDataURL()})`)
    available = true
  } catch { /* plain borders stay */ }
  apply()
}
