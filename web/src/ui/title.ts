// Title sequence: the game's title script (games/title.ts): the first screens, then with the
// configuration file's long-intro flag the rest and the credits. A key or tap skips each screen.
import type { GameFiles } from '../store/gamefiles'
import type { TitleScreen } from '../games/title'
import { borderTiles, frameMask, screenFrame } from '../games/frametiles'
import { unexepack } from '../data/exepack'
import { EGA, parseRecord, toImageData, type Picture } from '../data/image'
import { parseFont } from '../data/font'
import { charMap } from '../data/ttf'
import { blit, sizeCanvas } from '../render/upscale'
import { reducedMotion } from './settings'
import { initSound, play, unlockAudio } from '../audio/sfx'
import { textOrNull } from '../data/gametext'

/** The configuration file's long-intro flag (PoR POOL.CFG line 5, CotAB CURSE.CFG line 4: 'F'). */
function longIntro(files: GameFiles): boolean {
  const cfg = files.get(files.game.config)
  if (!cfg) return true
  const line = new TextDecoder().decode(cfg).split(/\r?\n/)[files.game.title.configLine] ?? ''
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
  /** a screen's pictures in order: the first sets the canvas size, the rest go over it */
  const screen = (pics: { pic: Picture; x: number; y: number }[], colour1 = 1) => {
    if (!pics.length) return
    picture(pics[0].pic, colour1)
    const g = canvas.getContext('2d')!
    for (const { pic, x, y } of pics.slice(1)) blit(g, toImageData(pic), x, y)
  }
  /** 290c:06AD: palette register 1 goes 9, 11, 15, 11, 9, 1, two to four times, now and then */
  const lightning = (p: { pic: Picture; x: number; y: number }[]) => {
    if (reducedMotion()) return
    const STEPS: [number, number][] = [[9, 150], [11, 100], [15, 50], [11, 100], [9, 150], [1, 0]]
    const burst = () => {
      let t = 0
      const n = 2 + Math.floor(Math.random() * 3)
      for (let k = 0; k < n; k++) for (const [c, ms] of STEPS) { const at = t; later(at, () => screen(p, c)); t += ms }
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
    const mask = frameMask() // undrawn: shown as the black background
    const tiles = fr ? parseRecord(fr).frames.map((f) => toImageData(f.picture, mask >= 0 ? EGA.map((c, i) => (i === mask ? EGA[0] : c)) : EGA)) : []
    const exe = files.get('START.EXE')
    let img: Uint8Array | null = null
    try { img = exe ? unexepack(exe).image : null } catch { img = null }
    const spec = files.game.title.credits.frame
    if ('boxes' in spec) {
      // FUN_13f1_02e8 → 13f1_0000, frame style 0: corner, vertical rope, horizontal rope, one cell outside the box
      const b = borderTiles(img)
      const frame = (x1: number, y1: number, x2: number, y2: number) => {
        const [corner, vert, horiz] = b ? [tiles[b.tl], tiles[b.l], tiles[b.t]] : []
        if (!corner || !vert || !horiz) return
        for (let x = x1; x <= x2; x++) { blit(g, horiz, x * 8, (y1 - 1) * 8); blit(g, horiz, x * 8, (y2 + 1) * 8) }
        for (let y = y1; y <= y2; y++) { blit(g, vert, (x1 - 1) * 8, y * 8); blit(g, vert, (x2 + 1) * 8, y * 8) }
        for (const [x, y] of [[x1 - 1, y1 - 1], [x2 + 1, y1 - 1], [x1 - 1, y2 + 1], [x2 + 1, y2 + 1]]) blit(g, corner, x * 8, y * 8)
      }
      for (const [x1, y1, x2, y2] of spec.boxes) frame(x1, y1, x2, y2)
    } else {
      const sf = screenFrame(img, spec.screen.dividers)
      if (sf) for (let row = 0; row < 24; row++) for (let col = 0; col < 40; col++) {
        const n = sf.at(col, row)
        if (n >= 0 && tiles[n]) blit(g, tiles[n], col * 8, row * 8)
      }
    }
    const r = files.record(files.game.view.font.file, files.game.view.font.record)
    if (!r) return
    const font = parseFont(r).glyphs, map = charMap()
    for (const [row, col, colour, at] of files.game.title.credits.lines) {
      // the line read from the game's files (spec/D-appendices/strings.md); without START.EXE, none
      const text = textOrNull(at)
      if (text === null) continue
      g.fillStyle = `rgb(${EGA[colour].join(',')})`
      ;[...text].forEach((ch, i) => {
        const bits = font[map.get(ch.charCodeAt(0)) ?? 0x20]
        if (bits) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (bits[y] & (0x80 >> x)) g.fillRect((col + i) * 8 + x, row * 8 + y, 1, 1)
      })
    }
  }

  const script = files.game.title
  const screens: { show: () => void; ms: number }[] = []
  const add = (s: TitleScreen) => {
    const pics = s.pictures.flatMap((p) => { const pic = rec(p.record); return pic ? [{ pic, x: p.x, y: p.y }] : [] })
    if (pics.length) screens.push({ show: () => { screen(pics); if (s.lightning) lightning(pics); if (s.sound) play(s.sound, 'transient') }, ms: s.ms })
  }
  script.first.forEach(add)
  if (longIntro(files)) {
    script.long.forEach(add)
    screens.push({ show: credits, ms: script.credits.ms })
  }
  if (!screens.length) return next()
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
  // audio can only start after a key or tap (browsers block it before)
  const onKey = (e: KeyboardEvent) => {
    e.preventDefault()
    unlockAudio()
    advance()
  }
  window.addEventListener('keydown', onKey)
  box.addEventListener('click', () => { unlockAudio(); advance() })
  initSound(files.get('START.EXE'))
  advance()
  box.focus()
}
