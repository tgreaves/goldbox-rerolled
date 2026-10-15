// Exploration screen in the original's arrangement (spec/architecture.md, spec/graphics.md
// "Screen layout"): 3D view top left, party roster to its right, text window below,
// command line at the bottom. Scripts are not run yet.
import type { GameFiles } from '../store/gamefiles'
import { GeoMap, STEP } from '../data/geo'
import { WallSets } from '../data/walls'
import { A0, parseSave, saveArea, saveBlock, saveGeo, saveWallSets, type SaveGame } from '../data/save'
import { parseCharacter, MONEY, type Character } from '../data/character'
import { World, type View } from '../render/world'
import { drawMap } from './areamap'

const FACING = ['North', 'East', 'South', 'West']
const STAT_KEYS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'] as const

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

export function showExplore(app: HTMLElement, files: GameFiles, saveName: string, back: () => void) {
  const raw = files.get(saveName)
  if (!raw) throw new Error(`${saveName} not imported`)
  const save: SaveGame = parseSave(raw)
  const block = saveBlock(save)
  const area = saveArea(save)
  const geo = new GeoMap(files.record(`GEO${block}`, saveGeo(save))!)
  const walls = new WallSets(files, block)
  saveWallSets(save).forEach((rec, i) => {
    if (rec !== 0xffff) walls.load(i + 1, rec)
  })
  const party: Character[] = save.party
    .map((stem) => files.get(`${stem}.SAV`))
    .filter((d): d is Uint8Array => !!d)
    .map(parseCharacter)
  let current = 0
  let searching = false

  app.innerHTML = `
    <div class="game">
      <section class="view" aria-label="3D view">
        <canvas class="view3d"></canvas>
        <div class="where"></div>
      </section>
      <aside class="party" aria-label="Party">
        <table>
          <thead><tr><th>Name</th><th>AC</th><th>HP</th></tr></thead>
          <tbody></tbody>
        </table>
      </aside>
      <section class="text" aria-live="polite" aria-label="Messages"></section>
      <nav class="commands" aria-label="Commands">
        <div class="menu">
          ${['Area', 'Cast', 'View', 'Encamp', 'Search', 'Look']
            .map((c) => `<button data-cmd="${c[0]}"><u>${c[0]}</u>${c.slice(1)}</button>`).join('')}
          <button class="assets" data-cmd="assets" title="Back to the asset viewer">Assets</button>
        </div>
        <div class="pad" aria-label="Movement">
          <button data-c="l" aria-label="Turn left">⟲</button>
          <button data-c="f" aria-label="Forward">▲</button>
          <button data-c="r" aria-label="Turn right">⟳</button>
          <button data-c="b" aria-label="Turn around">▼</button>
        </div>
      </nav>
      <dialog class="panel"></dialog>
    </div>`
  const canvas = app.querySelector<HTMLCanvasElement>('.view3d')!
  const where = app.querySelector<HTMLDivElement>('.where')!
  const log = app.querySelector<HTMLElement>('.text')!
  const roster = app.querySelector<HTMLTableSectionElement>('.party tbody')!
  const dialog = app.querySelector<HTMLDialogElement>('dialog.panel')!
  const searchButton = app.querySelector<HTMLButtonElement>('[data-cmd="S"]')!

  const world = new World(canvas)
  world.build(geo, walls)
  const view: View = { x: save.x, y: save.y, facing: save.facing2 >> 1 }
  world.go(view, 0)

  function say(text: string, kind: 'text' | 'note' = 'text') {
    const p = document.createElement('p')
    p.className = kind
    p.textContent = text
    log.append(p)
    while (log.childElementCount > 200) log.firstElementChild!.remove()
    log.scrollTop = log.scrollHeight
  }

  function showWhere() {
    where.textContent = `${FACING[view.facing]} · ${view.x},${view.y}${searching ? ' · Searching' : ''}`
  }

  function drawRoster() {
    roster.innerHTML = party.map((c, i) => {
      const cls = [i === current ? 'current' : '', c.npc ? 'npc' : '', c.hp < c.hpMax ? 'hurt' : ''].join(' ')
      const hp = c.status === 'Okay' || c.status === 'Animated' ? String(c.hp) : c.status
      return `<tr class="${cls}" data-i="${i}"><td>${escape(c.name)}</td><td>${c.ac}</td><td>${hp}</td></tr>`
    }).join('')
  }

  function sheet(c: Character) {
    const str = c.stats.STR === 18 && c.strPct ? `/${String(c.strPct % 100).padStart(2, '0')}` : ''
    dialog.innerHTML = `
      <h2>${escape(c.name)}</h2>
      <p>${c.gender} ${c.race} · age ${c.age}<br>${c.alignment}<br>${c.cls}${c.levels.length ? ' · level ' + c.levels.map((l) => l.level).join('/') : ''}</p>
      <div class="sheet">
        <table>${STAT_KEYS.map((k) => `<tr><th>${k}</th><td>${c.stats[k]}${k === 'STR' ? str : ''}</td></tr>`).join('')}</table>
        <table>
          <tr><th>HP</th><td>${c.hp} / ${c.hpMax}</td></tr>
          <tr><th>AC</th><td>${c.ac}</td></tr>
          <tr><th>THAC0</th><td>${c.thac0}</td></tr>
          <tr><th>Damage</th><td>${c.damage}</td></tr>
          <tr><th>Movement</th><td>${c.movement}</td></tr>
          <tr><th>Status</th><td>${c.status}</td></tr>
          <tr><th>Experience</th><td>${c.exp}</td></tr>
        </table>
        <table>${MONEY.map((m, i) => `<tr><th>${m}</th><td>${c.money[i]}</td></tr>`).join('')}</table>
      </div>
      <form method="dialog"><button>Close</button></form>`
    dialog.showModal()
  }

  function areaMap() {
    if (save.A[0x49fb - A0] !== 0) {
      say('Not Here.', 'note')
      return
    }
    dialog.innerHTML = `<h2>Area</h2><canvas class="areamap"></canvas><form method="dialog"><button>Close</button></form>`
    drawMap(dialog.querySelector<HTMLCanvasElement>('canvas')!, geo, 24, view)
    dialog.showModal()
  }

  /** Map-area movement (spec/architecture.md, "Moving"). */
  function move(c: string) {
    if (world.busy() || dialog.open) return
    if (c === 'l' || c === 'r' || c === 'b') {
      view.facing = (view.facing + ({ l: 3, r: 1, b: 2 } as Record<string, number>)[c]) % 4
      world.go(view)
      showWhere()
      return
    }
    const p = geo.passage(view.x, view.y, view.facing)
    if (p === 1) {
      const [dx, dy] = STEP[view.facing]
      view.x = (view.x + dx) & 15
      view.y = (view.y + dy) & 15
      world.go(view)
      showWhere()
    } else {
      say(p === 0 ? 'Blocked.' : 'Locked.', 'note')
    }
  }

  function command(c: string) {
    if (dialog.open) return
    switch (c) {
      case 'A': areaMap(); break
      case 'V': sheet(party[current]); break
      case 'S':
        searching = !searching
        searchButton.classList.toggle('on', searching)
        showWhere()
        break
      case 'C': say('Casting is not implemented yet.', 'note'); break
      case 'E': say('Camp is not implemented yet.', 'note'); break
      case 'L': say('Look runs the area script, which is not connected yet.', 'note'); break
      case 'assets': leave(); break
    }
  }

  const keys: Record<string, string> = {
    ArrowUp: 'f', '8': 'f',
    ArrowLeft: 'l', '4': 'l',
    ArrowRight: 'r', '6': 'r',
    ArrowDown: 'b', '2': 'b',
  }
  const onKey = (e: KeyboardEvent) => {
    if (dialog.open || e.ctrlKey || e.metaKey || e.altKey) return
    if (keys[e.key]) {
      e.preventDefault()
      move(keys[e.key])
    } else if (e.key.length === 1 && 'ACVESL'.includes(e.key.toUpperCase())) {
      // the original's command hotkeys (first letter of each menu item)
      e.preventDefault()
      command(e.key.toUpperCase())
    }
  }
  window.addEventListener('keydown', onKey)
  app.querySelectorAll<HTMLButtonElement>('.pad button').forEach((b) => b.addEventListener('click', () => move(b.dataset.c!)))
  app.querySelectorAll<HTMLButtonElement>('.menu button').forEach((b) => b.addEventListener('click', () => command(b.dataset.cmd!)))
  canvas.addEventListener('pointerup', (e) => {
    const r = canvas.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    move(fx < 1 / 3 ? 'l' : fx > 2 / 3 ? 'r' : 'f')
  })
  roster.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('tr')
    if (!row) return
    const i = Number(row.dataset.i)
    if (i === current) sheet(party[i])
    else {
      current = i
      drawRoster()
    }
  })

  let running = true
  const resize = () => {
    const r = canvas.getBoundingClientRect()
    world.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)))
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  const loop = (now: number) => {
    if (!running) return
    world.frame(now)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  function leave() {
    running = false
    observer.disconnect()
    window.removeEventListener('keydown', onKey)
    world.renderer.dispose()
    back()
  }

  drawRoster()
  showWhere()
  say(`Block ${block}, area ${area}. The party: ${party.map((c) => c.name).join(', ')}.`, 'note')
  say('Scripts are not connected yet, so no events happen while you explore.', 'note')
}
