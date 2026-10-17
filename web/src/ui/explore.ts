// Exploration screen in the original's arrangement (spec/architecture.md, spec/graphics.md
// "Screen layout"): 3D view top left, party roster to its right, text window below,
// command line at the bottom. Area scripts run through the ECL engine (src/vm/engine.ts).
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter, MONEY, type Character } from '../data/character'
import { parseRecord, spriteImage, toImageData, type Picture } from '../data/image'
import { World } from '../render/world'
import { Engine, A0, type Io } from '../vm/engine'
import { drawMap, landmarkAt } from './areamap'
import type { GeoMap } from '../data/geo'
import { listCharacters, listSaves, saveCharacter, writeSave } from '../store/user'
import { report, revealedBy, type State } from '../rules/commissions'
import { ICONS, landmarks, type Landmark } from '../rules/landmarks'
import { Overland } from '../rules/overland'
import { itemsFile } from '../data/items'
import { effectsFile } from '../data/effects'
import { capacity, ready, recalc, unready } from '../rules/equip'
import { drop, halve, join, trade, unavailable } from '../rules/inventory'
import { pay, receive, sellOffer } from '../rules/money'
import { shop, temple, treasure, type TownUi } from './town'
import { camp, cast, type CampUi } from './camp'
import { runBattle } from './combat'
import { clockText, isScroll } from '../rules/camp'
import { castOutside, itemSpells, spendUse, targetKind } from '../rules/magic'
import { Tables, fileStem } from '../rules/chargen'
import { creatorTools } from './creator'
import { playEnding } from './ending'
import { fontChoice, gameFontAvailable, setFontChoice } from './gamefont'
import { unexepack } from '../data/exepack'
import { checkTraining, newSpellChoices, train, willBecome } from '../rules/training'
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
        <canvas class="wildview" width="120" height="120" hidden></canvas>
        <canvas class="combatview" hidden></canvas>
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
  function paint(pics: { pic: Picture; x: number; y: number; sprite?: boolean }[]) {
    const g = overlay.getContext('2d')!
    g.clearRect(0, 0, 88, 88)
    for (const { pic, x, y, sprite } of pics) {
      const img = sprite ? spriteImage(pic) : toImageData(pic)
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
  /** Dismiss a pending menu without choosing (a battle answered it by key or tap). */
  function cancelMenu() {
    pending = null
    log.querySelectorAll('ol.choices').forEach((l) => l.remove())
    menuBar.innerHTML = ''
  }
  /** Battle input: arrow keys and taps on the battlefield go here while a battle waits for them. */
  const battleInput: { key?: (e: KeyboardEvent) => boolean; tap?: (e: MouseEvent) => void } = {}

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
      } else if (f && engine.overland) {
        // wilderness: always the middle frame, drawn flat at its place in the view (FUN_2fea_054e)
        const pic = f[Math.min(1, f.length - 1)]
        paint([{ pic, x: pic.x * 8, y: pic.y * 8, sprite: true }])
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
      if (what === 'party dead') { print('The END!', true); print('The party has been destroyed', false); return gameOver() }
      if (what === 'locked door') return note('Locked.')
      if (what === 'combat') {
        townMode = 'camp'
        const combatCanvas = app.querySelector<HTMLCanvasElement>('.combatview')!
        canvas.hidden = true
        wildview.hidden = true
        // the battlefield replaces the encounter picture or sprite (the overlay sits above every view)
        showPicture(null)
        app.querySelector('.game')!.classList.add('in-combat')
        try {
          const r = await runBattle({
            engine, files, canvas: combatCanvas, menu, print: (t) => print(t, false), view: (c) => new Promise<void>((resolve) => {
              sheet(parseCharacter(c))
              dialog.addEventListener('close', () => resolve(), { once: true })
            }),
            sound: play, pause: (ms) => io.pause!(ms), input: battleInput, refreshRoster: () => drawRoster(), cancelMenu: () => cancelMenu(),
          })
          if (r.survived) await treasure(townUi)
          else await gameOver()
        } catch (err) {
          note(`Combat error: ${(err as Error).message}`)
        } finally {
          app.querySelector('.game')!.classList.remove('in-combat')
          townMode = null
          canvas.hidden = engine.overland
          wildview.hidden = !engine.overland
          for (const k of Object.keys(battleInput)) delete (battleInput as Record<string, unknown>)[k]
          drawRoster()
        }
        return
      }
      if (what === 'ending') {
        await playEnding(dialog, files, engine.block, engine.party().length, engine.speed)
        return
      }
      if (what === 'party screen') {
        townMode = 'camp'
        try { await trainingHall() } finally { townMode = null }
        return
      }
      if (what === 'camp') {
        townMode = 'camp'
        try { await camp(campUi) } finally { townMode = null }
        return
      }
      if (what === 'shop' || what === 'temple' || what === 'treasure') {
        townMode = what
        try { await (what === 'shop' ? shop : what === 'temple' ? temple : treasure)(townUi) } finally { townMode = null }
        return
      }
      const details = info ? ' (' + Object.entries(info).map(([k, v]) => `${k}: ${v}`).join(', ') + ')' : ''
      note(`[${what}${details} is not implemented yet${what === 'combat' ? '; the party is treated as winning' : ''}]`)
    },
  }

  initSound(files.get('START.EXE'))
  const engine = new Engine(files, io)
  if (start.kind === 'new') engine.newGame(start.party.map((c) => c.sav))
  else engine.loadSave(start.dat, start.party.map((c) => c.sav))
  start.party.forEach((c, i) => engine.attachFiles(i, c.itm, c.spc))

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
      chars: members.map((c) => ({ sav: c.slice(), itm: itemsFile(engine.itemsOf(c)), spc: effectsFile(engine.effectsOf(c)) })), known: [...known] })
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
    const outdoors = engine.overland
    canvas.hidden = outdoors
    wildview.hidden = !outdoors || !engine.wild
    padLabels(outdoors)
    if (outdoors) {
      drawWild()
      ms = 0
    } else world.go({ x: engine.x, y: engine.y, facing: engine.facing }, ms)
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
      where.textContent = `Wilderness · ${wx},${wy} · facing ${FACING[engine.facing]} · ${clockText(engine)}${searching ? ' · Searching' : ''}`
      wild.hidden = !!engine.wild
      if (!engine.wild) wild.innerHTML = '<p><strong>Wilderness</strong></p><p>The wilderness map needs START.EXE from the game files: go back to Assets and re-import the POOLRAD folder.</p>'
      return
    }
    wild.hidden = true
    const pos = engine.A[0x49fb - A0] !== 0 ? '' : `${engine.x},${engine.y} · ` // hidden where the Area map is refused
    where.textContent = `${FACING[engine.facing]} · ${pos}${clockText(engine)}${searching ? ' · Searching' : ''}`
  }

  function drawRoster() {
    const cur = engine.nodes.indexOf(engine.cur)
    roster.innerHTML = party().map((c, i) => {
      const cls = [i === cur ? 'current' : '', c.npc ? 'npc' : '', c.hp < c.hpMax ? 'hurt' : ''].join(' ')
      const hp = c.status === 'Okay' || c.status === 'Animated' ? String(c.hp) : c.status
      return `<tr class="${cls}" data-i="${i}"><td>${escape(c.name)}</td><td>${c.ac}</td><td>${hp}</td></tr>`
    }).join('')
  }

  // ------------------------------------------------------------ shops, temples, treasure
  /** set while a shop, temple or treasure screen runs: the roster then picks the current character */
  let townMode: 'shop' | 'temple' | 'treasure' | 'camp' | null = null
  const townUi: TownUi = {
    get engine() { return engine },
    menu,
    print: (text, clear) => print(text, !!clear),
    inputNumber: async () => Math.min(Number((await input('number')).replace(/\D/g, '') || 0), 65535),
    view: (mode) => new Promise<void>((resolve) => {
      sheet(parseCharacter(engine.cur), { mode })
      dialog.addEventListener('close', () => resolve(), { once: true })
    }),
    refresh: () => drawRoster(),
  }

  const campUi: CampUi = {
    get engine() { return engine },
    menu,
    print: (text, clear) => print(text, !!clear),
    view: () => new Promise<void>((resolve) => {
      sheet(parseCharacter(engine.cur))
      dialog.addEventListener('close', () => resolve(), { once: true })
    }),
    save: () => saveGame(),
    refresh: () => { drawRoster(); showWhere() },
    stopper: () => {
      let stopped = false
      menuBar.innerHTML = '<button class="primary">Stop resting</button>'
      menuBar.querySelector('button')!.addEventListener('click', () => { stopped = true })
      return { stopped: () => stopped, done: () => { menuBar.innerHTML = '' } }
    },
    pause: (ms) => new Promise((r) => setTimeout(r, ms)),
  }

  /**
   * The party screen a training hall opens (PROGRAM 0; spec/menus.md, spec/progression.md): Create,
   * Drop, Modify, Train, View, Add, Remove, Save and Begin. Load needs an empty party, which this
   * screen never leaves, so it is not offered. Created and removed characters go to the roster
   * (browser storage), as the original writes their files.
   */
  let tables: Tables | null | undefined
  async function trainingHall() {
    if (tables === undefined) {
      const exe = files.get('START.EXE')
      try { tables = exe ? new Tables(unexepack(exe).image) : null } catch { tables = null }
    }
    if (!tables) { note('The party screen needs START.EXE: re-import the POOLRAD folder.'); return }
    const t = tables
    const rng = (n: number) => engine.rand(n)
    const tools = creatorTools(dialog, files, rng, t)
    const nameOf = (c: Uint8Array) => parseCharacter(c).name
    for (;;) {
      const party = engine.party()
      drawRoster()
      print(`${nameOf(engine.cur)} is selected (choose from the party list).`, true)
      const opts = ['CREATE', 'DROP', 'MODIFY', 'TRAIN', 'VIEW', 'ADD', 'REMOVE', 'SAVE', 'BEGIN']
      const o = opts[await menu(opts, { prompt: 'Choose a function:' })]
      const c = engine.cur
      if (o === 'BEGIN') return
      if (o === 'VIEW') await campUi.view()
      else if (o === 'SAVE') await saveGame()
      else if (o === 'CREATE') {
        const made = await tools.create(t)
        if (made) {
          await saveCharacter({ stem: fileStem(nameOf(made)), sav: made })
          print(`${nameOf(made)} has been created. Use Add to put them in the party.`, false)
        }
      } else if (o === 'ADD') {
        if (party.length >= 8 || party.filter((m) => m[0x84] < 0x80).length >= 6) { print('The party is full.', false); continue }
        const inParty = new Set(party.map(nameOf))
        const roster = (await listCharacters()).filter((r) => !inParty.has(nameOf(r.sav)))
        const pick = await tools.chooseFrom('Add character', roster)
        if (pick) {
          const added = engine.addMember(pick.sav, pick.itm, pick.spc)
          if (engine.items) recalc(added, engine.itemsOf(added), engine.items)
          print(`${nameOf(added)} joins the party.`, false)
        }
      } else if (o === 'REMOVE') {
        if (party.length <= 1) { print('The party needs at least one character.', false); continue }
        await saveCharacter({ stem: fileStem(nameOf(c)), sav: c.slice(), itm: itemsFile(engine.itemsOf(c)), spc: effectsFile(engine.effectsOf(c)) })
        engine.dropMember(c)
        print(`${nameOf(c)} leaves the party (still available to Add).`, false)
      } else if (o === 'DROP') {
        if (party.length <= 1) { print('The party needs at least one character.', false); continue }
        if (await tools.confirm(`${nameOf(c)} will be gone forever. Drop this character?`)) {
          engine.dropMember(c)
          print(`${nameOf(c)} has been dropped.`, false)
        }
      } else if (o === 'MODIFY') {
        if ((c[0xac] | c[0xad] | c[0xae] | c[0xaf]) !== 0) print(`${nameOf(c)} can't be modified.`, false)
        else if (await tools.modify(c)) { if (engine.items) recalc(c, engine.itemsOf(c), engine.items); print(`${nameOf(c)} has been modified.`, false) }
      } else if (o === 'TRAIN') {
        const chk = checkTraining(t, c, engine.read(0x6da8))
        drawRoster()
        if (!chk.ok) { print(chk.message, false); continue }
        print(`${nameOf(c)} will become:`, true)
        for (const line of willBecome(c, chk.train)) print(line, false)
        if ((await menu(['YES', 'NO'], { prompt: 'Do you wish to train?' })) !== 0) continue
        print('Congratulations...', false)
        if (train(t, rng, c, chk.train)) {
          const choices = newSpellChoices(t, c)
          // the original's empty list writes char[0x32] = 1 (max HP 1); skipped here (IMP-028)
          if (choices.length) {
            const st = engine.spells
            const k = await menu(choices.map((id) => (st?.get(id)?.name ?? `#${id}`).toUpperCase()), { prompt: 'Spells to choose from:', vertical: true })
            c[0x32 + choices[k]] = 1
          }
        }
        if (engine.items) recalc(c, engine.itemsOf(c), engine.items)
      }
    }
  }

  /** Character sheet with the items menu (spec/town.md, "Items menu"); IMP-027 for the panel. */
  /** steps of Use on the sheet: which spell, then whom */
  interface UseStep { scroll: boolean; ids: number[]; spell?: number; combatOnly?: boolean }
  function sheet(c: Character, opts: { selected?: number; message?: string; confirm?: 'drop' | 'trade' | 'sell' | 'id' | 'use'; use?: UseStep; mode?: 'shop' | 'temple' | 'treasure' } = {}) {
    const node = c.raw
    const t = engine.items
    const items = engine.itemsOf(node)
    const sel = opts.selected ?? -1
    const it = items[sel]
    const str = c.stats.STR === 18 && c.strPct ? `/${String(c.strPct % 100).padStart(2, '0')}` : ''
    const rows = t ? items.map((x, i) => `<tr class="${i === sel ? 'sel' : ''}" data-i="${i}"><td>${x.ready ? 'Yes' : 'No'}</td>
      <td>${escape(t.name(x))}</td><td>${x.weight * Math.max(1, x.count)}</td></tr>`).join('') : ''
    const others = engine.party().filter((n) => n !== node)
    let actions = ''
    if (it && t) {
      const store = opts.mode === 'shop' || opts.mode === 'temple'
      if (opts.confirm === 'drop') actions = `<p>Your ${escape(t.name(it))} will be gone forever. Drop It?</p>
        <button data-a="drop-yes">Yes</button><button data-a="cancel">No</button>`
      else if (opts.confirm === 'sell') actions = `<p>I'll give you ${sellOffer(it)} gold pieces for your ${escape(t.name(it))}. Is It a Deal?</p>
        <button data-a="sell-yes">Yes</button><button data-a="cancel">No</button>`
      else if (opts.confirm === 'id') actions = `<p>For 200 gold pieces I'll identify your ${escape(t.name(it))}. Is It a Deal?</p>
        <button data-a="id-yes">Yes</button><button data-a="cancel">No</button>`
      else if (opts.confirm === 'use' && opts.use) {
        const u = opts.use, st = engine.spells
        if (u.spell === undefined) actions = '<p>Cast which spell?</p>' + u.ids.map((id, k) =>
          `<button data-a="use-spell-${k}">${escape(st?.get(id)?.name ?? `#${id}`)}</button>`).join('') + '<button data-a="cancel">Exit</button>'
        else if (u.combatOnly) actions = '<p>That Item is a combat-only item... Use it?</p><button data-a="use-waste">Yes</button><button data-a="cancel">No</button>'
        else actions = `<p>Cast ${escape(st?.get(u.spell)?.name ?? '')} on:</p>` + engine.party().map((n, k) =>
          `<button data-a="use-on-${k}">${escape(parseCharacter(n).name)}</button>`).join('') + '<button data-a="cancel">Exit</button>'
      }
      else if (opts.confirm === 'trade') actions = `<p>Trade with Whom?</p>` + others.map((n, k) =>
        `<button data-a="trade-${k}">${escape(parseCharacter(n).name)}</button>`).join('') + '<button data-a="cancel">Exit</button>'
      else actions = `<button data-a="ready"><u>R</u>eady</button><button data-a="use"><u>U</u>se</button>` +
        (others.length ? '<button data-a="trade"><u>T</u>rade</button>' : '') +
        '<button data-a="drop"><u>D</u>rop</button><button data-a="halve"><u>H</u>alve</button><button data-a="join"><u>J</u>oin</button>' +
        (store ? '<button data-a="sell"><u>S</u>ell</button><button data-a="id"><u>I</u>d</button>' : '')
    }
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
      ${t ? `<h3>Items</h3>
        ${items.length ? `<table class="items"><thead><tr><th>Ready</th><th>Item</th><th>Weight</th></tr></thead><tbody>${rows}</tbody></table>`
          : '<p class="muted">No items.</p>'}
        <p class="muted">Encumbrance ${node[0x102] | (node[0x103] << 8)} of ${capacity(node)} coins.</p>
        ${opts.message ? `<p class="message">${escape(opts.message)}</p>` : ''}
        <div class="item-actions">${actions}</div>` : '<p class="muted">Items need the ITEMS file and START.EXE: re-import the POOLRAD folder.</p>'}
      <form method="dialog"><button>Close</button></form>`
    const again = (o: { selected?: number; message?: string; confirm?: 'drop' | 'trade' | 'sell' | 'id' | 'use'; use?: UseStep }) => {
      drawRoster()
      sheet(parseCharacter(node), { ...o, mode: opts.mode })
    }
    dialog.querySelectorAll<HTMLTableRowElement>('table.items tbody tr').forEach((r) =>
      r.addEventListener('click', () => again({ selected: Number(r.dataset.i) })))
    dialog.querySelectorAll<HTMLButtonElement>('.item-actions button').forEach((b) => b.addEventListener('click', () => {
      if (!it || !t) return
      const a = b.dataset.a!
      const keep = items.indexOf(it)
      if (a === 'ready') {
        const m = it.ready ? unready(node, items, it, t) : ready(node, items, it, t)
        again({ selected: keep, message: m })
      } else if (a === 'use' || a.startsWith('use-')) {
        // Use outside combat (FUN_4894_1a8a); it does not end anything (spec/town.md, "Items menu")
        const st = engine.spells
        if (!it.ready) { again({ selected: keep, message: 'Must be Readied' }); return }
        if (!st) return
        const scroll = isScroll(it, t)
        const u: UseStep = opts.use ?? { scroll, ids: itemSpells(it, scroll) }
        if (!u.ids.length) { again({ selected: keep, message: 'Nothing happens.' }); return }
        if (a === 'use') u.spell = u.ids.length === 1 ? u.ids[0] : undefined
        else if (a.startsWith('use-spell-')) u.spell = u.ids[Number(a.slice(10))]
        const s = u.spell === undefined ? undefined : st.get(u.spell)
        if (u.spell !== undefined && !s) return
        if (s && s.side === 0 && a !== 'use-waste') u.combatOnly = true
        if (a === 'use-waste' && s) { spendUse(items, it, u.scroll, s.id); again({ message: 'The item is used up.' }); return }
        if (!s || u.combatOnly) { again({ selected: keep, confirm: 'use', use: u }); return }
        const kind = targetKind(s)
        let targets = [node]
        if (kind === 'party') targets = engine.party()
        else if (kind === 'one') {
          if (!a.startsWith('use-on-')) { again({ selected: keep, confirm: 'use', use: u }); return }
          targets = [engine.party()[Number(a.slice(7))]]
        }
        print(`${c.name} uses an item`, false)
        const out = castOutside(engine, node, s, targets, true)
        spendUse(items, it, u.scroll, s.id)
        for (const m of out) print(m, false)
        again({ selected: Math.min(keep, items.length - 1), message: out.join(' ') })
      }
      else if (a === 'trade') {
        const why = unavailable(it)
        again(why ? { selected: keep, message: why } : { selected: keep, confirm: 'trade' })
      } else if (a.startsWith('trade-')) {
        const to = others[Number(a.slice(6))]
        const m = trade({ c: node, items }, { c: to, items: engine.itemsOf(to) }, it, t)
        again(m ? { selected: keep, message: m } : { message: `Traded to ${parseCharacter(to).name}.` })
      } else if (a === 'drop') {
        const why = unavailable(it)
        again(why ? { selected: keep, message: why } : { selected: keep, confirm: 'drop' })
      } else if (a === 'drop-yes') {
        const m = drop(node, items, it, t)
        again({ message: m })
      } else if (a === 'sell') {
        const why = unavailable(it) || (node[0x84] >= 0x80 && node[0x10d] ? 'NPCs cannot sell' : '')
        again(why ? { selected: keep, message: why } : { selected: keep, confirm: 'sell' })
      } else if (a === 'sell-yes') {
        const offer = sellOffer(it)
        items.splice(items.indexOf(it), 1)
        const m = receive(node, items, engine.money, offer, t)
        again({ message: m || 'Sold!' })
      } else if (a === 'id') again({ selected: keep, confirm: 'id' })
      else if (a === 'id-yes') {
        if (!pay(node, engine.money, 200, t, items)) again({ selected: keep, message: 'Not Enough Money' })
        else if (it.hidden === 0) again({ selected: keep, message: `I can't tell anything new about your ${t.name(it)}` })
        else { it.hidden = 0; again({ selected: keep, message: `It looks like some sort of ${t.name(it)}` }) }
      } else if (a === 'halve') again({ selected: keep, message: halve(node, items, it, t) })
      else if (a === 'join') {
        const n = join(node, items, it, t)
        again({ selected: items.indexOf(it), message: n ? '' : 'Nothing to join.' })
      } else again({ selected: keep })
    }))
    if (!dialog.open) dialog.showModal()
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

  // ------------------------------------------------------------ wilderness view
  const wildview = app.querySelector<HTMLCanvasElement>('.wildview')!
  const tileCache = new Map<number, HTMLCanvasElement | null>()
  const asCanvas = (img: ImageData) => {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    c.getContext('2d')!.putImageData(img, 0, 0)
    return c
  }
  /** Tile id 1-255: frame id-1 of SQRPACI #1 (ids 1-128) or #2 (129-255). */
  function wildTile(id: number): HTMLCanvasElement | null {
    if (!tileCache.has(id)) {
      const f = id - 1
      const raw = files.record('SQRPACI', f > 127 ? 2 : 1)
      let c: HTMLCanvasElement | null = null
      try { if (raw) c = asCanvas(toImageData(parseRecord(raw).frames[f & 127].picture)) } catch { /* missing frame */ }
      tileCache.set(id, c)
    }
    return tileCache.get(id)!
  }
  /** The party marker: ICON records 0, 128, 1, 129, 2, 130 in turn, colour 0 transparent. */
  const partyFrames: HTMLCanvasElement[] = []
  for (const r of [0, 128, 1, 129, 2, 130]) {
    const raw = files.record('ICON', r)
    try { if (raw) partyFrames.push(asCanvas(spriteImage(parseRecord(raw).frames[0].picture))) } catch { /* missing */ }
  }
  let partyPhase = 0
  /** The 5x5 view (FUN_54cf_0000, FUN_54fa_0000); the marker advances a frame per redraw. */
  function drawWild() {
    const w = engine.wild
    if (!w) return
    const g = wildview.getContext('2d')!
    const [gx, gy] = engine.wildPosition
    const { x0, y0, col, row } = Overland.window(gx, gy)
    g.fillStyle = '#000'
    g.fillRect(0, 0, 120, 120)
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const t = wildTile(w.tile(x0 + c, y0 + r, (a) => engine.read(a)))
      if (t) g.drawImage(t, c * 24, r * 24)
    }
    const p = partyFrames[partyPhase % partyFrames.length]
    partyPhase = (partyPhase + 1) % 6
    if (!p) return
    g.save()
    if (engine.facing2 > 3) { // facing south or west: mirrored
      g.translate(col * 24 + 24, row * 24)
      g.scale(-1, 1)
      g.drawImage(p, 0, 0)
    } else g.drawImage(p, col * 24, row * 24)
    g.restore()
  }
  const padButtons = [...pad.querySelectorAll<HTMLButtonElement>('button')]
  function padLabels(outdoors: boolean) {
    const labels: Record<string, [string, string]> = outdoors
      ? { l: ['◀', 'West'], f: ['▲', 'North'], r: ['▶', 'East'], b: ['▼', 'South'] }
      : { l: ['⟲', 'Turn left'], f: ['▲', 'Forward'], r: ['⟳', 'Turn right'], b: ['▼', 'Turn around'] }
    for (const b of padButtons) {
      const [t, a] = labels[b.dataset.c!]
      b.textContent = t
      b.setAttribute('aria-label', a)
    }
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
      (gameFontAvailable() ? `<button class="sound" data-cmd="font" title="Text in the game's own font, or a modern one">Aa ${fontChoice() === 'original' ? 'Original' : 'Modern'}</button>` : '') +
      `<button data-cmd="commissions" title="Commissions and rewards (not in the original)">Commissions${commissionsDue() ? ' <span class="due">•</span>' : ''}</button>` +
      '<button data-cmd="save" title="Save the game (any time)">Save</button>' +
      '<button class="assets" data-cmd="debug" title="Debug menu (not part of the game)">Debug</button>' +
      '<button class="assets" data-cmd="assets" title="Leave the game">Quit</button>'
    menuBar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => command(b.dataset.cmd!)))
  }

  function move(c: string) {
    if (engine.quit) return
    if (engine.overland) {
      // the arrows are compass directions in the wilderness (FUN_3e76_0989)
      if (!engine.wild) { note('Wilderness travel needs START.EXE: re-import the POOLRAD folder.'); return }
      const dir = ({ f: 0, r: 1, b: 2, l: 3 } as Record<string, number>)[c]
      act(() => engine.travel(dir))
      return
    }
    act(() => engine.command(c))
  }

  function command(c: string) {
    if (busy || pending || dialog.open) return
    switch (c) {
      case 'A': areaMap(); break
      case 'V': sheet(parseCharacter(engine.cur)); break
      case 'S': engine.command('s'); commandBar(); showWhere(); break
      case 'C': act(async () => { townMode = 'camp'; try { await cast(campUi) } finally { townMode = null } }); break
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
      case 'font': setFontChoice(fontChoice() === 'original' ? 'modern' : 'original'); commandBar(); break
      case 'nosound': note('Sound needs START.EXE: go back to Assets and re-import the POOLRAD folder.'); break
      case 'commissions': commissions(); break
      case 'save': act(() => saveGame()); break
      case 'debug': debugMenu(); break
      case 'assets': leave(); break
    }
  }

  const keys: Record<string, string> = {
    ArrowUp: 'f', '8': 'f', ArrowLeft: 'l', '4': 'l', ArrowRight: 'r', '6': 'r', ArrowDown: 'b', '2': 'b',
  }
  const onKey = (e: KeyboardEvent) => {
    unlockAudio()
    if (battleInput.key && !dialog.open && battleInput.key(e)) { e.preventDefault(); return }
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
  app.querySelector<HTMLCanvasElement>('.combatview')!.addEventListener('pointerup', (e) => { battleInput.tap?.(e) })
  wildview.addEventListener('pointerup', (e) => {
    if (skipPause && !pending) return skipPause()
    if (pending && pending.items.length === 1) return choose(0)
    // tap towards a side of the party's square to walk that way
    const r = wildview.getBoundingClientRect()
    const { col, row } = Overland.window(...engine.wildPosition)
    const dx = (e.clientX - r.left) / r.width * 5 - (col + 0.5), dy = (e.clientY - r.top) / r.height * 5 - (row + 0.5)
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 'f'))
  })
  roster.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('tr')
    if (!row || (!townMode && (busy || pending))) return
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

  /** The party is gone: as the original, back to the start (the party screen there loads a game). */
  async function gameOver() {
    await menu(['CONTINUE'], { prompt: 'Press any key to continue' })
    leave()
  }

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
