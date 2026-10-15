// Exploration screen: the 3D view, movement and touch controls (delivery step 2, no scripts yet).
import type { GameFiles } from '../store/gamefiles'
import { GeoMap, STEP } from '../data/geo'
import { WallSets } from '../data/walls'
import { parseSave, saveArea, saveBlock, saveGeo, saveWallSets, type SaveGame } from '../data/save'
import { World, type View } from '../render/world'

const FACING = ['North', 'East', 'South', 'West']

export function showExplore(app: HTMLElement, files: GameFiles, saveName: string, back: () => void) {
  const raw = files.get(saveName)
  if (!raw) throw new Error(`${saveName} not imported`)
  const save: SaveGame = parseSave(raw)
  const block = saveBlock(save)
  const geo = new GeoMap(files.record(`GEO${block}`, saveGeo(save))!)
  const walls = new WallSets(files, block)
  saveWallSets(save).forEach((rec, i) => {
    if (rec !== 0xffff) walls.load(i + 1, rec)
  })

  app.innerHTML = `
    <div class="explore">
      <canvas class="view3d"></canvas>
      <div class="hud">
        <button class="back" aria-label="Back to the asset viewer">◀ Assets</button>
        <span class="where"></span>
      </div>
      <div class="message" role="status" aria-live="polite"></div>
      <div class="pad" aria-label="Movement">
        <button data-c="l" aria-label="Turn left">⟲</button>
        <button data-c="f" aria-label="Forward">▲</button>
        <button data-c="r" aria-label="Turn right">⟳</button>
        <button data-c="b" aria-label="Turn around">▼</button>
      </div>
    </div>`
  const canvas = app.querySelector<HTMLCanvasElement>('.view3d')!
  const where = app.querySelector<HTMLSpanElement>('.where')!
  const message = app.querySelector<HTMLDivElement>('.message')!
  const world = new World(canvas)
  world.build(geo, walls)

  const view: View = { x: save.x, y: save.y, facing: save.facing2 >> 1 }
  world.go(view, 0)
  const area = saveArea(save)

  function status(text = '') {
    where.textContent = `Block ${block} · area ${area} · (${view.x}, ${view.y}) facing ${FACING[view.facing]}`
    message.textContent = text
    message.classList.toggle('show', text !== '')
  }

  /** Map-area movement (spec/architecture.md, "Moving"); scripts are not run yet. */
  function command(c: string) {
    if (world.busy()) return
    if (c === 'l' || c === 'r' || c === 'b') {
      view.facing = (view.facing + ({ l: 3, r: 1, b: 2 } as Record<string, number>)[c]) % 4
      world.go(view)
      status()
      return
    }
    const p = geo.passage(view.x, view.y, view.facing)
    if (p === 1) {
      const [dx, dy] = STEP[view.facing]
      view.x = (view.x + dx) & 15
      view.y = (view.y + dy) & 15
      world.go(view)
      status()
    } else {
      status(p === 0 ? 'Blocked.' : 'Locked.')
    }
  }

  const keys: Record<string, string> = {
    ArrowUp: 'f', w: 'f', W: 'f', '8': 'f',
    ArrowLeft: 'l', a: 'l', A: 'l', '4': 'l',
    ArrowRight: 'r', d: 'r', D: 'r', '6': 'r',
    ArrowDown: 'b', s: 'b', S: 'b', '2': 'b',
  }
  const onKey = (e: KeyboardEvent) => {
    const c = keys[e.key]
    if (c) {
      e.preventDefault()
      command(c)
    }
  }
  window.addEventListener('keydown', onKey)
  app.querySelectorAll<HTMLButtonElement>('.pad button').forEach((b) =>
    b.addEventListener('click', () => command(b.dataset.c!)))
  // tap the view: left third turns left, right third turns right, middle moves forward
  canvas.addEventListener('pointerup', (e) => {
    const r = canvas.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    command(fx < 1 / 3 ? 'l' : fx > 2 / 3 ? 'r' : 'f')
  })

  let running = true
  const resize = () => {
    const r = canvas.getBoundingClientRect()
    world.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)))
  }
  new ResizeObserver(resize).observe(canvas)
  resize()
  const loop = (now: number) => {
    if (!running) return
    world.frame(now)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  app.querySelector('.back')!.addEventListener('click', () => {
    running = false
    window.removeEventListener('keydown', onKey)
    world.renderer.dispose()
    back()
  })
  status()
}
