// The original 8 × 8 font for the whole interface (IMP-038), built from the player's 8X8D1.DAX, with
// a switch back to the modern font. The choice is a per-browser convenience kept in localStorage.
import type { GameFiles } from '../store/gamefiles'
import { buildTtf } from '../data/ttf'

const KEY = 'poolrad.font'
let available = false

export type FontChoice = 'original' | 'modern'

export function fontChoice(): FontChoice {
  try { return localStorage.getItem(KEY) === 'modern' ? 'modern' : 'original' } catch { return 'original' }
}

function apply() {
  document.documentElement.classList.toggle('font-original', available && fontChoice() === 'original')
}

export function setFontChoice(c: FontChoice) {
  try { localStorage.setItem(KEY, c) } catch { /* private mode: this page only */ }
  apply()
}

export const gameFontAvailable = () => available

/** Build and register the font once the game files are known. */
export async function installGameFont(files: GameFiles) {
  if (available) return apply()
  const rec = files.record('8X8D1', 201)
  if (!rec) return
  try {
    const ttf = buildTtf(rec)
    const face = new FontFace('Pool of Radiance', ttf.buffer as ArrayBuffer)
    await face.load()
    document.fonts.add(face)
    available = true
  } catch { /* the modern font stays */ }
  apply()
}
