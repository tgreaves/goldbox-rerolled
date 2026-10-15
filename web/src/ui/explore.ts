// Exploration screen in the original's arrangement (spec/architecture.md, spec/graphics.md
// "Screen layout"): 3D view top left, party roster to its right, text window below,
// command line at the bottom. Area scripts run through the ECL engine (src/vm/engine.ts).
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter, MONEY, type Character } from '../data/character'
import { parseRecord, toImageData, type Picture } from '../data/image'
import { World } from '../render/world'
import { Engine, A0, type Io } from '../vm/engine'
import { drawMap } from './areamap'
import { listSaves, writeSave } from '../store/user'
import { initSound, play, setSoundDevice, soundAvailable, soundDevice, unlockAudio } from '../audio/sfx'

const FACING = ['North', 'East', 'South', 'West']
const STAT_KEYS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'] as const
const CONTINUE_PROMPTS = ['PRESS <RETURN> OR BUTTON TO CONTINUE', 'PRESS <ENTER>/<RETURN> TO CONTINUE']

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

type CharFiles = { sav: Uint8Array; itm?: Uint8Array; spc?: Uint8Array }
export type Start =
  | { kind: 'new'; party: CharFiles[] }
  | { kind: 'load'; dat: Uint8Array; party: CharFiles[]; label: string }

export function showExplore(app: HTMLElement, files: GameFiles, start: Start, back: () => void) {

  app.innerHTML = `
    <div class="game">
      <section class="view" aria-label="3D view">
        <canvas class="view3d"></canvas>
        <canvas class="overlay" width="88" height="88" hidden></canvas>
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
        <div class="menu"></div>
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
  const overlay = app.querySelector<HTMLCanvasElement>('.overlay')!
  const where = app.querySelector<HTMLDivElement>('.where')!
  const log = app.querySelector<HTMLElement>('.text')!
  const roster = app.querySelector<HTMLTableSectionElement>('.party tbody')!
  const menuBar = app.querySelector<HTMLDivElement>('.menu')!
  const pad = app.querySelector<HTMLDivElement>('.pad')!
  const dialog = app.querySelector<HTMLDialogElement>('dialog.panel')!
  const world = new World(canvas)

  // ------------------------------------------------------------ text window
  let screen: HTMLElement | null = null
  /** PRINT_CLEAR starts a new block, created lazily so empty clears leave no trace */
  let newBlock = true
  function print(text: string, clear: boolean, kind = '') {
    if (clear) newBlock = true
    if (!text) return
    if (newBlock || !screen) {
      screen = document.createElement('div')
      screen.className = 'screen'
      log.append(screen)
      while (log.childElementCount > 120) log.firstElementChild!.remove()
      newBlock = false
    }
    const p = document.createElement('p')
    if (kind) p.className = kind
    p.textContent = text
    screen.append(p)
    log.scrollTop = log.scrollHeight
  }
  const note = (text: string) => print(text, false, 'note')

  // ------------------------------------------------------- pictures, sprites
  const pictureCache = new Map<string, Picture[] | null>()
  function frames(family: string, id: number): Picture[] | null {
    const key = `${family}${engine.block}#${id}`
    if (!pictureCache.has(key)) {
      const raw = files.record(`${family}${engine.block}`, id)
      let pics: Picture[] | null = null
      try {
        if (raw) pics = parseRecord(raw, family === 'PIC').frames.map((f) => f.picture)
      } catch { /* not an image */ }
      pictureCache.set(key, pics)
    }
    return pictureCache.get(key)!
  }
  /** mask: palette index drawn as transparent (sprites are loaded with mask colour 0, spec/graphics.md) */
  function paint(pics: { pic: Picture; x: number; y: number }[], mask = -1) {
    const g = overlay.getContext('2d')!
    g.clearRect(0, 0, 88, 88)
    for (const { pic, x, y } of pics) {
      const img = toImageData(pic)
      if (mask >= 0) for (let i = 0; i < pic.pixels.length; i++) if (pic.pixels[i] === mask) img.data[i * 4 + 3] = 0
      const tmp = document.createElement('canvas')
      tmp.width = pic.width
      tmp.height = pic.height
      tmp.getContext('2d')!.putImageData(img, 0, 0)
      g.drawImage(tmp, x, y)
    }
    overlay.hidden = pics.length === 0
  }
  function showPicture(p: { pic: number } | { head: number; body: number } | null) {
    if (!p) return paint([])
    if ('pic' in p) {
      const f = frames('PIC', p.pic)
      if (f) paint([{ pic: f[0], x: 0, y: 0 }])
    } else {
      const head = frames('HEAD', p.head)?.[0], body = frames('BODY', p.body)?.[0]
      paint([...(head ? [{ pic: head, x: 0, y: 0 }] : []), ...(body ? [{ pic: body, x: 0, y: 40 }] : [])])
    }
  }

  // ---------------------------------------------------------------- menus
  let pending: { resolve: (n: number) => void; items: string[] } | null = null
  /** a click, tap or key skips the current script pause */
  let skipPause: (() => void) | null = null
  function menu(items: string[], opts: { prompt?: string; vertical?: boolean } = {}): Promise<number> {
    return new Promise((resolve) => {
      if (opts.prompt) print(opts.prompt, false)
      const single = items.length === 1
      if (opts.vertical) {
        const list = document.createElement('ol')
        list.className = 'choices'
        items.forEach((t, i) => {
          const li = document.createElement('li')
          const b = document.createElement('button')
          b.textContent = t
          b.addEventListener('click', () => choose(i))
          li.append(b)
          list.append(li)
        })
        ;(screen ?? log).append(list)
        log.scrollTop = log.scrollHeight
        menuBar.innerHTML = ''
      } else {
        const label = (t: string) => (single && CONTINUE_PROMPTS.includes(t) ? 'Continue' : t)
        menuBar.innerHTML = items.map((t, i) =>
          `<button class="${single ? 'primary' : ''}" data-i="${i}"><u>${escape(label(t)[0])}</u>${escape(label(t).slice(1))}</button>`).join('')
        menuBar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.i))))
        menuBar.querySelector<HTMLButtonElement>('button')?.focus()
      }
      pending = { resolve, items }
      pad.classList.add('disabled')
    })
  }
  function choose(i: number) {
    if (!pending) return
    const p = pending
    pending = null
    log.querySelectorAll('ol.choices').forEach((l) => l.remove())
    p.resolve(i)
  }

  function input(kind: 'number' | 'text'): Promise<string> {
    return new Promise((resolve) => {
      const form = document.createElement('form')
      form.className = 'entry'
      form.innerHTML = `<input ${kind === 'number' ? 'inputmode="numeric" pattern="[0-9]*" maxlength="6"' : 'maxlength="40"'} autocomplete="off"><button>OK</button>`
      const field = form.querySelector('input')!
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        form.remove()
        print(field.value, false)
        resolve(field.value)
      })
      ;(screen ?? log).append(form)
      field.focus()
      log.scrollTop = log.scrollHeight
    })
  }

  // ------------------------------------------------------------------ io
  const io: Io = {
    print: (text, clear) => print(text, clear),
    menu,
    inputNumber: async () => Math.min(Number((await input('number')).replace(/\D/g, '') || 0), 65535),
    inputText: () => input('text'),
    picture: showPicture,
    sprite(sprite, picture, distance) {
      const f = frames('SPRIT', sprite)
      if (distance === 0 && picture !== 255) {
        const portrait = engine.B[0x6de1 - 0x6b00]
        showPicture(portrait === 0xff ? { pic: picture } : { head: portrait, body: picture })
      } else if (f) {
        const pic = f[Math.min(distance, f.length - 1)]
        paint([{ pic, x: pic.x * 8, y: pic.y * 8 }], 0)
      }
    },
    refresh: () => sync(),
    sound: play,
    pause(ms) {
      return new Promise((resolve) => {
        const timer = window.setTimeout(done, ms)
        function done() {
          window.clearTimeout(timer)
          skipPause = null
          resolve()
        }
        skipPause = done
      })
    },
    async engine(what, info) {
      if (what === 'blocked') return note('Blocked.')
      if (what === 'locked door') return note('Locked.')
      const details = info ? ' (' + Object.entries(info).map(([k, v]) => `${k}: ${v}`).join(', ') + ')' : ''
      note(`[${what}${details} is not implemented yet${what === 'combat' ? '; the party is treated as winning' : ''}]`)
    },
  }

  initSound(files.get('START.EXE'))
  const engine = new Engine(files, io)
  if (start.kind === 'new') engine.newGame(start.party.map((c) => c.sav))
  else engine.loadSave(start.dat, start.party.map((c) => c.sav))
  /** item and effect files travel with each member; only the records are live in the engine */
  const extras = start.party.map((c) => ({ itm: c.itm, spc: c.spc }))

  /** Save anywhere (IMPROVEMENTS.md IMP-002): slots A-J, the original file layout. */
  async function saveGame() {
    const saves = await listSaves()
    const slots = [...'ABCDEFGHIJ'].map((slot) => {
      const g = saves.find((x) => x.slot === slot)
      return `${slot}: ${g ? `${g.label} (${new Date(g.savedAt).toLocaleString()})` : 'empty'}`
    })
    const i = await menu(slots, { prompt: 'Save in which slot?', vertical: true })
    const slot = 'ABCDEFGHIJ'[i]
    const members = engine.party()
    const stems = members.map((_, n) => `CHRDAT${slot}${n + 1}`)
    const label = `${parseCharacter(members[0]).name}'s party, block ${engine.block} area ${engine.area}`
    await writeSave({ slot, dat: engine.toSave(stems), label, savedAt: Date.now(),
      chars: members.map((c, n) => ({ sav: c.slice(), ...extras[n] })) })
    note(`Game saved in slot ${slot}.`)
  }

  // ------------------------------------------------------------- view sync
  let animDone: (() => void) | null = null
  function sync(ms = 180): Promise<void> {
    if (engine.mapDirty && engine.geo) {
      world.build(engine.geo, engine.walls)
      engine.mapDirty = false
      ms = 0
    }
    world.go({ x: engine.x, y: engine.y, facing: engine.facing }, ms)
    drawRoster()
    showWhere()
    if (ms === 0) return Promise.resolve()
    return new Promise((resolve) => { animDone = resolve })
  }

  function party(): Character[] {
    const n = engine.B[0x6e3e - 0x6b00] || engine.nodes.length
    return engine.nodes.slice(0, n).map(parseCharacter)
  }

  function showWhere() {
    const searching = engine.B[0x6dca - 0x6b00] & 1
    where.textContent = `${FACING[engine.facing]} · ${engine.x},${engine.y}${searching ? ' · Searching' : ''}`
  }

  function drawRoster() {
    const cur = engine.nodes.indexOf(engine.cur)
    roster.innerHTML = party().map((c, i) => {
      const cls = [i === cur ? 'current' : '', c.npc ? 'npc' : '', c.hp < c.hpMax ? 'hurt' : ''].join(' ')
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
    if (engine.A[0x49fb - A0] !== 0 || !engine.geo) {
      note('Not Here.')
      return
    }
    dialog.innerHTML = `<h2>Area</h2><canvas class="areamap"></canvas><form method="dialog"><button>Close</button></form>`
    drawMap(dialog.querySelector<HTMLCanvasElement>('canvas')!, engine.geo, 24, { x: engine.x, y: engine.y, facing: engine.facing })
    dialog.showModal()
  }

  // --------------------------------------------------------------- commands
  let busy = false
  async function act(f: () => Promise<void>) {
    if (busy || pending || dialog.open) return
    busy = true
    pad.classList.add('disabled')
    try {
      await f()
    } catch (e) {
      note(`Script error: ${(e as Error).message}`)
    } finally {
      busy = false
      if (engine.quit) note('The game has ended here. Go back to Assets to start again.')
      commandBar()
    }
  }

  function commandBar() {
    pad.classList.remove('disabled')
    menuBar.innerHTML = ['Area', 'Cast', 'View', 'Encamp', 'Search', 'Look']
      .map((c) => `<button data-cmd="${c[0]}"${c === 'Search' && engine.B[0x6dca - 0x6b00] & 1 ? ' class="on"' : ''}><u>${c[0]}</u>${c.slice(1)}</button>`).join('') +
      (soundAvailable()
        ? `<button class="sound" data-cmd="sound" title="Sound device: PC speaker, Tandy/PCjr or off">♪ ${({ pc: 'PC speaker', tandy: 'Tandy', off: 'Off' })[soundDevice()]}</button>`
        : '<button class="sound" data-cmd="nosound" title="Re-import the POOLRAD folder with START.EXE for sound">♪ n/a</button>') +
      '<button data-cmd="save" title="Save the game (any time)">Save</button>' +
      '<button class="assets" data-cmd="assets" title="Leave the game">Quit</button>'
    menuBar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => command(b.dataset.cmd!)))
  }

  function move(c: string) {
    if (engine.quit) return
    act(() => engine.command(c))
  }

  function command(c: string) {
    if (busy || pending || dialog.open) return
    switch (c) {
      case 'A': areaMap(); break
      case 'V': sheet(parseCharacter(engine.cur)); break
      case 'S': engine.command('s'); commandBar(); showWhere(); break
      case 'C': note('Casting is not implemented yet.'); break
      case 'E': act(() => engine.command('e')); break
      case 'L': act(() => engine.command('L')); break
      case 'sound': {
        const next = ({ pc: 'tandy', tandy: 'off', off: 'pc' } as const)[soundDevice()]
        setSoundDevice(next)
        unlockAudio()
        commandBar()
        if (next !== 'off') play(10)
        break
      }
      case 'nosound': note('Sound needs START.EXE: go back to Assets and re-import the POOLRAD folder.'); break
      case 'save': act(() => saveGame()); break
      case 'assets': leave(); break
    }
  }

  const keys: Record<string, string> = {
    ArrowUp: 'f', '8': 'f', ArrowLeft: 'l', '4': 'l', ArrowRight: 'r', '6': 'r', ArrowDown: 'b', '2': 'b',
  }
  const onKey = (e: KeyboardEvent) => {
    unlockAudio()
    if (dialog.open || e.ctrlKey || e.metaKey || e.altKey) return
    if (document.activeElement instanceof HTMLInputElement) return
    if (skipPause && !pending) {
      e.preventDefault()
      skipPause()
      return
    }
    if (pending) {
      const items = pending.items
      if ((e.key === 'Enter' || e.key === ' ') && items.length === 1) { e.preventDefault(); choose(0); return }
      const i = items.findIndex((t) => t[0]?.toUpperCase() === e.key.toUpperCase())
      if (i >= 0) { e.preventDefault(); choose(i) }
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= items.length) { e.preventDefault(); choose(Number(e.key) - 1) }
      return
    }
    if (keys[e.key]) {
      e.preventDefault()
      move(keys[e.key])
    } else if (e.key.length === 1 && 'ACVESL'.includes(e.key.toUpperCase())) {
      e.preventDefault()
      command(e.key.toUpperCase())
    }
  }
  window.addEventListener('keydown', onKey)
  pad.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => move(b.dataset.c!)))
  app.addEventListener('pointerdown', unlockAudio)
  canvas.addEventListener('pointerup', (e) => {
    if (skipPause && !pending) return skipPause()
    if (pending && pending.items.length === 1) return choose(0)
    const r = canvas.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    move(fx < 1 / 3 ? 'l' : fx > 2 / 3 ? 'r' : 'f')
  })
  roster.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('tr')
    if (!row || busy || pending) return
    const c = engine.nodes[Number(row.dataset.i)]
    if (c === engine.cur) sheet(parseCharacter(c))
    else {
      engine.cur = engine.savedCur = c
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
    if (animDone && !world.busy()) {
      const done = animDone
      animDone = null
      done()
    }
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

  commandBar()
  sync(0)
  if (start.kind === 'new') note('A new game: Begin Adventuring from the party screen.')
  else note(`Loaded: ${start.label}.`)
  act(() => engine.start())
}
