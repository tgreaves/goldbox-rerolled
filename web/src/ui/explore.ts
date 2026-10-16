// Exploration screen in the original's arrangement (spec/architecture.md, spec/graphics.md
// "Screen layout"): 3D view top left, party roster to its right, text window below,
// command line at the bottom. Area scripts run through the ECL engine (src/vm/engine.ts).
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter, MONEY, type Character } from '../data/character'
import { parseRecord, toImageData, type Picture } from '../data/image'
import { World } from '../render/world'
import { Engine, A0, type Io } from '../vm/engine'
import { drawMap, landmarkAt } from './areamap'
import type { GeoMap } from '../data/geo'
import { listSaves, writeSave } from '../store/user'
import { report, revealedBy, type State } from '../rules/commissions'
import { ICONS, landmarks, type Landmark } from '../rules/landmarks'
import { initSound, play, setSoundDevice, soundAvailable, soundDevice, unlockAudio } from '../audio/sfx'

const FACING = ['North', 'East', 'South', 'West']
const STAT_KEYS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'] as const
const CONTINUE_PROMPTS = ['PRESS <RETURN> OR BUTTON TO CONTINUE', 'PRESS <ENTER>/<RETURN> TO CONTINUE']

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

type CharFiles = { sav: Uint8Array; itm?: Uint8Array; spc?: Uint8Array }
export type Start =
  | { kind: 'new'; party: CharFiles[] }
  | { kind: 'load'; dat: Uint8Array; party: CharFiles[]; label: string; known?: string[] }

export function showExplore(app: HTMLElement, files: GameFiles, start: Start, back: () => void) {

  app.innerHTML = `
    <div class="game">
      <section class="view" aria-label="3D view">
        <canvas class="view3d"></canvas>
        <div class="wild" hidden></div>
        <canvas class="overlay" width="88" height="88" hidden></canvas>
        <div class="where"></div>
      </section>
      <div class="side">
        <aside class="party" aria-label="Party">
          <table>
            <thead><tr><th>Name</th><th>AC</th><th>HP</th></tr></thead>
            <tbody></tbody>
          </table>
        </aside>
        <section class="map" aria-label="Area map" title="Area map (click to enlarge)">
          <canvas class="minimap"></canvas>
          <p class="nomap" hidden>Not here.</p>
        </section>
      </div>
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
  const wild = app.querySelector<HTMLDivElement>('.wild')!
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
  /** Pictures and portraits are opaque; encounter sprites stand in the 3D scene instead (World.showSprite). */
  function paint(pics: { pic: Picture; x: number; y: number }[]) {
    const g = overlay.getContext('2d')!
    g.clearRect(0, 0, 88, 88)
    for (const { pic, x, y } of pics) {
      const img = toImageData(pic)
      const tmp = document.createElement('canvas')
      tmp.width = pic.width
      tmp.height = pic.height
      tmp.getContext('2d')!.putImageData(img, 0, 0)
      g.drawImage(tmp, x, y)
    }
    overlay.hidden = pics.length === 0
  }
  function showPicture(p: { pic: number } | { head: number; body: number } | null) {
    if (!p) {
      world.showSprite(null)
      return paint([])
    }
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
    print: (text, clear) => {
      print(text, clear)
      for (const id of revealedBy(text)) known.add(id)
    },
    menu,
    inputNumber: async () => Math.min(Number((await input('number')).replace(/\D/g, '') || 0), 65535),
    inputText: () => input('text'),
    picture: showPicture,
    sprite(sprite, picture, distance) {
      const f = frames('SPRIT', sprite)
      if (distance === 0 && picture !== 255) {
        world.showSprite(null)
        const portrait = engine.B[0x6de1 - 0x6b00]
        showPicture(portrait === 0xff ? { pic: picture } : { head: portrait, body: picture })
      } else if (f) {
        paint([])
        world.showSprite(f, distance)
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
      chars: members.map((c, n) => ({ sav: c.slice(), ...extras[n] })), known: [...known] })
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
    drawMinimap()
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
    if (engine.overland) {
      const [wx, wy] = engine.wildPosition
      where.textContent = `Wilderness · ${wx},${wy}`
      wild.hidden = false
      wild.innerHTML = `<p><strong>Wilderness</strong>, area ${engine.area}, position ${wx},${wy}</p>
        <p>Overland travel is not built yet: its map view and movement come next. The area's script still runs, so its prompts (such as the boat back to New Phlan) work. The Debug menu can jump elsewhere.</p>`
      return
    }
    wild.hidden = true
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

  /**
   * The area map stays on screen beside the 3D view (IMP-022). Where the original's Area command
   * answers "Not Here." (ECL 0x49FB set by the area's script) the panel says so too.
   */
  const minimap = app.querySelector<HTMLCanvasElement>('.minimap')!
  const nomap = app.querySelector<HTMLElement>('.nomap')!
  function drawMinimap() {
    const allowed = engine.A[0x49fb - A0] === 0 && engine.geo && !engine.overland
    minimap.hidden = !allowed
    nomap.hidden = !!allowed
    if (allowed) drawMap(minimap, engine.geo!, 24, { x: engine.x, y: engine.y, facing: engine.facing }, areaMarks())
  }
  minimap.addEventListener('click', () => command('A'))
  minimap.addEventListener('mousemove', (e) => { minimap.title = landmarkAt(minimap, e, areaMarks())?.detail ?? 'Area map (click to enlarge)' })

  /** Shops, temples and the like, read from the area's script; worked out once per area (IMP-024). */
  let marks: { code: Uint8Array; geo: GeoMap; list: Landmark[] } | null = null
  function areaMarks(): Landmark[] {
    if (!engine.geo) return []
    if (marks?.code !== engine.code || marks.geo !== engine.geo) {
      const record = (n: number) => {
        const raw = files.record(`ECL${engine.block}`, n)
        if (!raw) return null
        const c = new Uint8Array(0x1e00)
        c.set(raw.subarray(2, 2 + 0x1e00))
        return c
      }
      let list: Landmark[] = []
      try { list = landmarks(engine.code, engine.geo, record) } catch { /* unreadable script: no landmarks */ }
      marks = { code: engine.code, geo: engine.geo, list }
    }
    return marks.list
  }

  // ------------------------------------------------------------ debug menu
  /** Debug menu (IMP-025): jumps that skip whatever the scripts would do on the way. */
  const JUMPS: { label: string; to: [number, number, number, number, number] }[] = [
    // [block, area, x, y, facing]; wilderness positions as the harbour script writes them (ECL3 #0)
    { label: 'Wilderness: west boat landing (20,29)', to: [7, 26, 7, 29, 0] },
    { label: 'Wilderness: north side of the bay (26,27)', to: [7, 26, 13, 27, 0] },
    { label: 'Wilderness: east boat landing (35,29)', to: [8, 27, 9, 29, 0] },
    { label: 'New Phlan: end of the pier (15,1)', to: [3, 0, 15, 1, 3] },
  ]
  function debugMenu() {
    const pos = engine.overland ? `wilderness ${engine.wildPosition.join(',')}` : `${engine.x},${engine.y} facing ${FACING[engine.facing]}`
    dialog.innerHTML = `<h2>Debug</h2>
      <p class="muted">Not part of the game. Now: block ${engine.block}, area ${engine.area}, ${pos}.</p>
      <ul class="debug">${JUMPS.map((j, i) => `<li><button data-i="${i}">${escape(j.label)}</button></li>`).join('')}</ul>
      <form class="jump">
        <label>Block <input name="block" type="number" min="1" max="8" value="${engine.block}"></label>
        <label>Area <input name="area" type="number" min="0" max="63" value="${engine.area}"></label>
        <label>X <input name="x" type="number" min="0" max="43" value="0"></label>
        <label>Y <input name="y" type="number" min="0" max="35" value="0"></label>
        <label>Facing <select name="facing">${FACING.map((f, i) => `<option value="${i}">${f}</option>`).join('')}</select></label>
        <button>Jump</button>
      </form>
      <p class="muted">For areas 25–27 (wilderness), X and Y are the area's own position (0–12 across).</p>
      <form method="dialog"><button>Close</button></form>`
    const go = (to: [number, number, number, number, number]) => {
      dialog.close()
      if (!files.record(`ECL${to[0]}`, to[1])) { note(`There is no area ${to[1]} in block ${to[0]}.`); return }
      note(`Debug: jumping to block ${to[0]}, area ${to[1]}.`)
      act(() => engine.jump(...to))
    }
    dialog.querySelectorAll<HTMLButtonElement>('ul.debug button').forEach((b) => b.addEventListener('click', () => go(JUMPS[Number(b.dataset.i)].to)))
    const f = dialog.querySelector<HTMLFormElement>('form.jump')!
    f.addEventListener('submit', (e) => {
      e.preventDefault()
      const v = (n: string) => Number((f.elements.namedItem(n) as HTMLInputElement).value) || 0
      go([v('block'), v('area'), v('x'), v('y'), v('facing')])
    })
    dialog.showModal()
  }

  // ------------------------------------------------------------ commissions
  /** commissions the clerk has offered, and whether the proclamation wall was read (IMP-023) */
  const known = new Set<string>(start.kind === 'load' ? start.known ?? [] : [])
  const commissionReport = () => report((a) => engine.read(a), known)
  function commissionsDue(): boolean {
    const r = commissionReport()
    return r.bounty > 0 || r.lines.some((l) => l.state === 'reward' || l.state === 'summoned')
  }
  const STATE_LABEL: Record<State, string> = { reward: 'Reward due', summoned: 'Summoned', open: 'Open', failed: 'Failed', closed: 'Closed' }
  function commissions() {
    const r = commissionReport()
    const rows = r.lines.map((l) => `<li class="${l.state}"><span class="state">${STATE_LABEL[l.state]}</span>
      <span>${escape(l.title)}${l.detail ? `<small>${escape(l.detail)}</small>` : ''}</span></li>`).join('')
    dialog.innerHTML = `<h2>Commissions</h2>
      ${rows ? `<ul class="commissions">${rows}</ul>` : '<p class="muted">No commissions yet. The City Clerk in City Hall awards them.</p>'}
      ${r.bounty ? `<p>Graveyard bounty: ${r.bounty} undead slain and not yet paid for. See the City Clerk.</p>` : ''}
      ${r.proclamations ? `<p class="muted">Proclamations to read in the Adventurer's Journal: ${r.proclamations}.</p>` : ''}
      <form method="dialog"><button>Close</button></form>`
    dialog.showModal()
  }

  function areaMap() {
    if (engine.A[0x49fb - A0] !== 0 || !engine.geo) {
      note('Not Here.')
      return
    }
    const list = areaMarks()
    const legend = [...new Map(list.map((m) => [m.label, m])).values()]
      .map((m) => `<li><span class="icon">${ICONS[m.kind]}</span>${escape(m.label)}</li>`).join('')
    dialog.innerHTML = `<h2>Area</h2><canvas class="areamap"></canvas>${legend ? `<ul class="legend">${legend}</ul>` : ''}<form method="dialog"><button>Close</button></form>`
    const c = dialog.querySelector<HTMLCanvasElement>('canvas')!
    drawMap(c, engine.geo, 24, { x: engine.x, y: engine.y, facing: engine.facing }, list)
    c.addEventListener('mousemove', (e) => { c.title = landmarkAt(c, e, list)?.detail ?? '' })
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
      `<button data-cmd="commissions" title="Commissions and rewards (not in the original)">Commissions${commissionsDue() ? ' <span class="due">•</span>' : ''}</button>` +
      '<button data-cmd="save" title="Save the game (any time)">Save</button>' +
      '<button class="assets" data-cmd="debug" title="Debug menu (not part of the game)">Debug</button>' +
      '<button class="assets" data-cmd="assets" title="Leave the game">Quit</button>'
    menuBar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => command(b.dataset.cmd!)))
  }

  function move(c: string) {
    if (engine.quit) return
    if (engine.overland) { note('Overland travel is not implemented yet. Use the Debug menu to jump elsewhere.'); return }
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
      case 'commissions': commissions(); break
      case 'save':
        if (engine.overland) note('Saving in the wilderness is not supported yet.')
        else act(() => saveGame())
        break
      case 'debug': debugMenu(); break
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
