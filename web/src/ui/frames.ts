// The original's window frames (IMP-051), from 8X8D1.DAX #202 by the game's frame data
// (games/frametiles.ts: PoR's yellow corner and red rope, CotAB's white frame), built in the browser
// from the player's files into a CSS border image, with a switch back to plain borders.
import { borderTiles, frameMask } from '../games/frametiles'
import { unexepack } from '../data/exepack'
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
  available = false // rebuilt for each game
  const rec = files.record('8X8D1', 202)
  const exe = files.get('START.EXE')
  let img: Uint8Array | null = null
  try { img = exe ? unexepack(exe).image : null } catch { img = null }
  const want = borderTiles(img)
  if (!rec || !want) return apply()
  try {
    const tiles = parseRecord(rec).frames.map((f) => f.picture)
    const pick = (n: number) => tiles[n]
    if (Object.values(want).some((n) => !pick(n))) return apply()
    const c = document.createElement('canvas')
    c.width = c.height = 24 * S
    const g = c.getContext('2d')!
    const put = (p: (typeof tiles)[number], cx: number, cy: number) => {
      const img = toImageData(p)
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = p.pixels[y * 8 + x]
        if (v === 0 || v === frameMask()) continue // colour 0 (and the game's mask colour) let the panel show through
        const i = (y * 8 + x) * 4
        g.fillStyle = `rgb(${img.data[i]},${img.data[i + 1]},${img.data[i + 2]})`
        g.fillRect((cx * 8 + x) * S, (cy * 8 + y) * S, S, S)
      }
    }
    put(pick(want.tl), 0, 0); put(pick(want.t), 1, 0); put(pick(want.tr), 2, 0)
    put(pick(want.l), 0, 1); put(pick(want.r), 2, 1)
    put(pick(want.bl), 0, 2); put(pick(want.b), 1, 2); put(pick(want.br), 2, 2)
    document.documentElement.style.setProperty('--rope', `url(${c.toDataURL()})`)
    available = true
  } catch { /* plain borders stay */ }
  apply()
}
