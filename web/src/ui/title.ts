// Title sequence (spec/menus.md, "Start-up sequence"): TITLE #1 for 5 s, then, with POOL.CFG's
// fixed-disk flag, TITLE #2 for 5 s with its lightning and the credits for 10 s. A key or tap
// skips each screen.
import type { GameFiles } from '../store/gamefiles'
import { EGA, parseRecord, toImageData, type Picture } from '../data/image'
import { parseFont } from '../data/font'
import { charMap } from '../data/ttf'
import { blit, sizeCanvas } from '../render/upscale'

/** The credits (FUN_290c_0206): row, column, colour, text; the font has capitals only. */
const CREDITS: [number, number, number, string][] = [
  [1, 5, 10, 'scenario created by:'], [1, 26, 14, 'tsr, inc.'], [2, 15, 10, 'jim ward'],
  [3, 2, 10, 'david cook,steve winter,mike breault'],
  [5, 1, 10, 'game created by:'], [5, 18, 14, 'ssi special projects'], [6, 14, 11, 'version 1.3'],
  [7, 2, 14, 'programming:'], [7, 20, 14, 'original'], [8, 2, 11, 'scot bayless'], [8, 20, 14, 'programming:'],
  [9, 2, 11, 'brad myers'], [9, 20, 11, 'keith brors'], [10, 2, 11, 'russ brown'], [10, 20, 11, 'brad myers'],
  [11, 2, 11, 'ted greer'],
  [13, 2, 14, 'graphic arts:'], [13, 20, 14, 'encounter coding:'], [14, 2, 11, 'tom wahl'], [14, 20, 11, 'paul murray'],
  [15, 2, 11, 'fred butts'], [15, 20, 11, 'russ brown'], [16, 2, 11, 'darla marasco'], [16, 20, 11, 'victor penman'],
  [17, 2, 11, 'susan halbleib'], [17, 20, 11, 'dave shelley'],
  [19, 2, 14, 'project manager'], [19, 20, 14, 'developer:'], [20, 2, 11, 'victor penman'], [20, 20, 11, 'george mac donald'],
  [22, 2, 14, 'testing:'], [22, 11, 11, 'joel billings,steve salyer'], [23, 2, 11, 'james kucera,robert daly,rick white'],
]

/** POOL.CFG line 5 'F' sets DS:49D1, the "fixed disk" flag that allows the long intro; the shipped file has it. */
function longIntro(files: GameFiles): boolean {
  const cfg = files.get('POOL.CFG')
  if (!cfg) return true
  const line = new TextDecoder().decode(cfg).split(/\r?\n/)[4] ?? ''
  return line.trim().toUpperCase().startsWith('F')
}

export function showTitle(app: HTMLElement, files: GameFiles, next: () => void) {
  const rec = (n: number): Picture | null => {
    const d = files.record('TITLE', n)
    try { return d ? parseRecord(d).frames[0].picture : null } catch { return null }
  }
  app.innerHTML = `<div class="title" role="button" tabindex="0" aria-label="Continue">
    <canvas class="pixel"></canvas><p class="muted">Press any key or tap to continue</p></div>`
  const box = app.querySelector<HTMLDivElement>('.title')!
  const canvas = box.querySelector('canvas')!
  const timers: number[] = []
  const clear = () => { while (timers.length) clearTimeout(timers.pop()) }
  const later = (ms: number, f: () => void) => { timers.push(window.setTimeout(f, ms)) }

  const picture = (p: Picture, colour1 = 1) => {
    const pal = EGA.map((c, i) => (i === 1 ? EGA[colour1] : c))
    blit(sizeCanvas(canvas, p.width, p.height), toImageData(p, pal), 0, 0)
  }
  /** 290c:06AD: palette register 1 goes 9, 11, 15, 11, 9, 1, two to four times, now and then */
  const lightning = (p: Picture) => {
    const STEPS: [number, number][] = [[9, 150], [11, 100], [15, 50], [11, 100], [9, 150], [1, 0]]
    const burst = () => {
      let t = 0
      const n = 2 + Math.floor(Math.random() * 3)
      for (let k = 0; k < n; k++) for (const [c, ms] of STEPS) { const at = t; later(at, () => picture(p, c)); t += ms }
      later(t + 1000 + Math.random() * 2000, burst) // I: the original's rate depends on the CPU
    }
    later(500 + Math.random() * 1500, burst)
  }
  const credits = () => {
    const g = sizeCanvas(canvas, 320, 200)
    g.fillStyle = '#000'
    g.fillRect(0, 0, 320, 200)
    // the two boxes, frame style 0 (FUN_13f1_02e8 → 13f1_0000): 8X8D1 #202 tiles 20 corner,
    // 21 vertical rope, 22 horizontal rope, one cell outside the box; they share the corner at row 4
    const fr = files.record('8X8D1', 202)
    const tiles = fr ? parseRecord(fr).frames.map((f) => toImageData(f.picture)) : []
    const frame = (x1: number, y1: number, x2: number, y2: number) => {
      const [corner, vert, horiz] = [tiles[20], tiles[21], tiles[22]]
      if (!corner || !vert || !horiz) return
      for (let x = x1; x <= x2; x++) { blit(g, horiz, x * 8, (y1 - 1) * 8); blit(g, horiz, x * 8, (y2 + 1) * 8) }
      for (let y = y1; y <= y2; y++) { blit(g, vert, (x1 - 1) * 8, y * 8); blit(g, vert, (x2 + 1) * 8, y * 8) }
      for (const [x, y] of [[x1 - 1, y1 - 1], [x2 + 1, y1 - 1], [x1 - 1, y2 + 1], [x2 + 1, y2 + 1]]) blit(g, corner, x * 8, y * 8)
    }
    frame(1, 1, 38, 3)
    frame(1, 5, 38, 23)
    const r = files.record('8X8D1', 201)
    if (!r) return
    const font = parseFont(r).glyphs, map = charMap()
    for (const [row, col, colour, text] of CREDITS) {
      g.fillStyle = `rgb(${EGA[colour].join(',')})`
      ;[...text].forEach((ch, i) => {
        const bits = font[map.get(ch.charCodeAt(0)) ?? 0x20]
        if (bits) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (bits[y] & (0x80 >> x)) g.fillRect((col + i) * 8 + x, row * 8 + y, 1, 1)
      })
    }
  }

  const screens: { show: () => void; ms: number }[] = []
  const t1 = rec(1), t2 = rec(2)
  if (t1) screens.push({ show: () => picture(t1), ms: 5000 })
  if (longIntro(files)) {
    if (t2) screens.push({ show: () => { picture(t2); lightning(t2) }, ms: 5000 })
    screens.push({ show: credits, ms: 10000 })
  }
  if (!t1 && !t2) return next()
  let i = -1
  const advance = () => {
    clear()
    if (++i < screens.length) {
      screens[i].show()
      later(screens[i].ms, advance)
    } else {
      window.removeEventListener('keydown', onKey)
      next()
    }
  }
  const onKey = (e: KeyboardEvent) => {
    e.preventDefault()
    advance()
  }
  window.addEventListener('keydown', onKey)
  box.addEventListener('click', advance)
  advance()
  box.focus()
}
