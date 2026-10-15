// Asset viewer: checks the decoders against the player's files (delivery step 1)
import type { GameFiles } from '../store/gamefiles'
import { daxRecords } from '../data/dax'
import { parseRecord, toImageData, type Frame } from '../data/image'
import { GeoMap, STEP } from '../data/geo'

const IMAGE_FAMILIES = ['TITLE', 'PIC', 'FINAL', 'SPRIT', 'HEAD', 'BODY', 'CHEAD', 'CBODY', 'CPIC',
  'ICON', 'COMSPR', 'SQRPACI', 'BACPAC', 'DUNGCOM', 'WILDCOM', 'RANDCOM', '8X8D']

let timers: number[] = []

export function showViewer(app: HTMLElement, files: GameFiles, reimport: () => void) {
  const families = new Map<string, string[]>()
  for (const n of files.names()) {
    if (!n.endsWith('.DAX')) continue
    const fam = n.replace(/\d*\.DAX$/, '')
    families.set(fam, [...(families.get(fam) ?? []), n])
  }
  const shown = [...IMAGE_FAMILIES.filter((f) => families.has(f)), ...(families.has('GEO') ? ['GEO'] : [])]

  app.innerHTML = `
    <div class="viewer">
      <nav>
        <select aria-label="Asset family">${shown.map((f) => `<option>${f}</option>`).join('')}</select>
        ${shown.map((f) => `<button data-f="${f}">${f}</button>`).join('')}
        ${files.get('SAVGAMA.DAT') ? '<button id="newgame" class="primary">New game</button><button id="loadsave">Continue save A</button>' : ''}
        ${files.get('START.EXE') ? '' : '<p class="muted hint">Sound needs START.EXE: re-import the POOLRAD folder to include it.</p>'}
        <button id="reimport" class="muted">Re-import files…</button>
      </nav>
      <main><div class="grid"></div></main>
    </div>`
  const grid = app.querySelector<HTMLDivElement>('.grid')!
  const select = app.querySelector<HTMLSelectElement>('nav select')!

  function open(fam: string) {
    timers.forEach(clearInterval)
    timers = []
    grid.innerHTML = ''
    app.querySelectorAll('nav button[data-f]').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.f === fam))
    select.value = fam
    for (const name of families.get(fam) ?? []) {
      const recs = daxRecords(files.dax(name)!)
      for (const [id, d] of recs) {
        const label = `${name} #${id}`
        if (fam === 'GEO') grid.append(mapFigure(d, label))
        else {
          try {
            const { frames } = parseRecord(d, fam === 'PIC' || fam === 'FINAL')
            grid.append(imageFigure(frames, label))
          } catch {
            // not an image record (e.g. the font in 8X8D1 #201)
          }
        }
      }
    }
  }

  app.querySelectorAll<HTMLButtonElement>('nav button[data-f]').forEach((b) => b.addEventListener('click', () => open(b.dataset.f!)))
  select.addEventListener('change', () => open(select.value))
  app.querySelector('#reimport')!.addEventListener('click', reimport)
  const play = (start: { kind: 'new' } | { kind: 'save'; name: string }) => {
    timers.forEach(clearInterval)
    import('./explore').then((m) => m.showExplore(app, files, start, () => showViewer(app, files, reimport)))
  }
  app.querySelector('#newgame')?.addEventListener('click', () => play({ kind: 'new' }))
  app.querySelector('#loadsave')?.addEventListener('click', () => play({ kind: 'save', name: 'SAVGAMA.DAT' }))
  if (shown.length) open(shown[0])
}

function canvasFor(w: number, h: number, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.className = 'pixel'
  c.style.width = `${w * scale}px`
  return c
}

function imageFigure(frames: Frame[], label: string): HTMLElement {
  const fig = document.createElement('figure')
  const animated = frames.length > 1 && frames.some((f) => f.delay > 0)
  const shown = animated ? frames.slice(0, 1) : frames.slice(0, 64)
  for (const f of shown) {
    const p = f.picture
    const c = canvasFor(p.width, p.height, p.width > 160 ? 2 : 3)
    c.getContext('2d')!.putImageData(toImageData(p), 0, 0)
    fig.append(c)
    if (animated) animate(c, frames)
  }
  const cap = document.createElement('figcaption')
  cap.textContent = `${label} · ${frames.length} ${animated ? 'animation frames' : 'image(s)'} · ${frames[0].picture.width}×${frames[0].picture.height}`
  fig.append(cap)
  return fig
}

/** Animation timing from spec/graphics.md: delay in tenths of a second, cycle wraps to frame 1. */
function animate(c: HTMLCanvasElement, frames: Frame[]) {
  const ctx = c.getContext('2d')!
  const images = frames.map((f) => toImageData(f.picture))
  let i = 0
  let due = 0
  const id = window.setInterval(() => {
    due -= 50
    if (due > 0) return
    i = (i + 1) % frames.length
    ctx.putImageData(images[i], 0, 0)
    due = Math.max(frames[i].delay, 1) * 100
  }, 50)
  timers.push(id)
}

function mapFigure(raw: Uint8Array, label: string): HTMLElement {
  const fig = document.createElement('figure')
  let geo: GeoMap
  try {
    geo = new GeoMap(raw)
  } catch {
    return fig
  }
  const cell = 12
  const c = document.createElement('canvas')
  c.width = c.height = 16 * cell + 1
  c.style.border = '1px solid var(--line)'
  const g = c.getContext('2d')!
  g.fillStyle = '#0b1218'
  g.fillRect(0, 0, c.width, c.height)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (geo.event(x, y)) {
        g.fillStyle = '#203040'
        g.fillRect(x * cell + 1, y * cell + 1, cell - 1, cell - 1)
      }
      for (let d = 0; d < 4; d++) {
        if (!geo.wall(x, y, d)) continue
        const p = geo.passage(x, y, d)
        g.strokeStyle = p === 0 ? '#c9d4de' : p === 1 ? '#4c8bd6' : '#f2c94c'
        g.lineWidth = p === 0 ? 2 : 3
        const [dx, dy] = STEP[d]
        const cx = x * cell + cell / 2 + 0.5, cy = y * cell + cell / 2 + 0.5
        const ex = cx + (dx * cell) / 2, ey = cy + (dy * cell) / 2
        g.beginPath()
        g.moveTo(ex - (dy * cell) / 2, ey - (dx * cell) / 2)
        g.lineTo(ex + (dy * cell) / 2, ey + (dx * cell) / 2)
        g.stroke()
      }
    }
  }
  fig.append(c)
  const cap = document.createElement('figcaption')
  cap.textContent = `${label} · walls white, open doorways blue, locked doors gold`
  fig.append(cap)
  return fig
}
