// Exploration screen (the original's commands: spec/A-games/engine/main-loop.md; its fixed layout:
// spec/A-games/engine/graphics.md "Screen layout"). The port's layout is IMP-064: party cards in a
// row across the top (or a column beside the view, a setting), the 3D view and the area map below,
// then the text log and the command bar; phones get their own (IMP-060). Area scripts run through
// the ECL engine (src/vm/engine.ts).
import { R, slots, bookSpell, casterClasses } from '../games/rules'
import { joinRefusal } from '../rules/joining'
import { abilities, abilityName, diseased, useAbility, type Ability } from '../rules/abilities'
import { startEffects } from '../rules/chargen'
import { game } from '../games/profile'
import { F } from '../games/fields'
import { T } from '../games/tables'
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter, MONEY, type Character } from '../data/character'
import { parseRecord, spriteImage, toImageData, type Picture } from '../data/image'
import { World } from '../render/world'
import { VIEW, drawView, frameRGBA } from '../render/drawnview'
import { sceneOf, spriteFrame } from '../render/viewscene'
import { EGA } from '../data/image'
import { F as SCALE, blit, blitCanvas, pixels, sizeCanvas, upscale } from '../render/upscale'
import { parseFont } from '../data/font'
import { editCharacters } from './debugedit'
import { enhancePanel } from './panel'
import { rulesReference } from './rulesref'
import { Engine, A0, type Io } from '../vm/engine'
import type { Dice } from '../rules/dice'
import { drawMap, landmarkAt } from './areamap'
import type { GeoMap } from '../data/geo'
import { getVaultFile, listCharacters, listSaves, saveCharacter, setVaultFile, writeAutosave, writeSave } from '../store/user'
import { parseVault, vaultFile } from '../data/vault'
import { newerSidecarNote, type SidecarExtra } from '../store/savefiles'
import { report, revealedBy, type State } from '../rules/commissions'
import { JOURNAL, journalReveals, revealNote, roman } from '../rules/journal'
import { spellText } from '../rules/spelltext'
import { ICONS, landmarks, type Landmark } from '../rules/landmarks'
import { Overland } from '../rules/overland'
import { characterItemsFile, type Item, type ItemTables } from '../data/items'
import { buildIcon } from '../render/icon'
import { effectsFile } from '../data/effects'
import { canTakeItem, capacity, ready, readyItem, recalc, unready, unreadyItem } from '../rules/equip'
import { WorldHost } from '../rules/worldfx'
import { drop, halve, join, scribing, trade, unavailable } from '../rules/inventory'
import { moneyPrompt, COINS, coinValue, dropMoney, moneyOf, pay, poolAll, receive, priceStock, sellOffer, share, shopPrice, take, tradeMoney } from '../rules/money'
import { shop, temple, treasure, vault, type TownUi } from './town'
import { proposeSplit } from '../rules/treasure'
import { camp, effectNames, type CampUi } from './camp'
import { runBattle, type BattleControls } from './combat'
import { clockText, freeSlots, isScroll, knows, memorise, memorised, preparation } from '../rules/camp'
import { castOutside, itemSpells, mayCast, readsScroll, spendUse, targetKind } from '../rules/magic'
import { Tables, bodyRecord, fileStem, headRecord } from '../rules/chargen'
import { creatorTools } from './creator'
import { msg, entry, word, ask, type MenuOpts } from '../games/strings'
import { wordButton, yesNo, listExit } from './sheet'
import { yes } from './camp'
import { playEnding } from './ending'
import { text } from '../data/gametext'
import { onClose } from './sheet'
import { openSettings, reducedMotion, viewMode } from './settings'
import { accountLabel, openAccount } from './account'
import { accountStatus, onSettingsPulled } from '../store/account'
import { unexepack } from '../data/exepack'
import { checkTraining, levelLimit, newSpellChoices, train, willBecome, xpFor } from '../rules/training'
import { changeClass, changeClassChoices, className, offersChangeClass } from '../rules/dualclass'
import { initSound, play, unlockAudio } from '../audio/sfx'
import type { DemoMode } from '../games/startup'

const FACING = ['North', 'East', 'South', 'West']
const STAT_KEYS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'] as const
/** readied slots 0–8 (char 0xCC + 4·slot, spec/A-games/engine/records.md) */
const SLOT_NAMES = ['Weapon', 'Shield', 'Armour', 'Gauntlets', 'Helm', 'Belt/Necklace', 'Robe', 'Cloak', 'Boots']
const SLOT_LABEL = (n: number) => n <= 8 ? SLOT_NAMES[n] : n === 9 ? 'Ring' : n === 11 || n === 12 || n === 13 ? 'Scroll' : 'Other'
const CONTINUE_PROMPTS = ['PRESS <RETURN> OR BUTTON TO CONTINUE', 'PRESS <ENTER>/<RETURN> TO CONTINUE']

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

type CharFiles = { sav: Uint8Array; itm?: Uint8Array; spc?: Uint8Array }
export type Start =
  | { kind: 'new'; party: CharFiles[] }
  | { kind: 'load'; dat: Uint8Array; party: CharFiles[]; label: string; known?: string[]; sidecar?: SidecarExtra }
  /** the game's demo (games/startup.ts), from the party screen: its script with its own NPCs; nothing is saved */
  | { kind: 'demo'; demo: DemoMode }

const CLASS_NAMES = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk']

/** The 1988 numbers in plain words (IMP-058), as tooltips on the sheet and the cards. */
const TIPS: Record<string, string> = {
  STR: 'Strength: to-hit and damage bonuses at 17 and above, and how much can be carried. Fighters can have 18/01 to 18/00.',
  INT: 'Intelligence: magic-users need it.',
  WIS: 'Wisdom: clerics with 13 or more get extra spells.',
  DEX: 'Dexterity: better AC and missile to-hit at 15 and above.',
  CON: 'Constitution: extra hit points per level at 15 and above.',
  CHA: 'Charisma: how people react to the party.',
  HP: 'Hit points: at 0 a character is down; below that, dying, and dead at −10.',
  AC: 'Armour class: lower is better. 10 is unarmoured, 0 is excellent, below 0 takes magic.',
  THAC0: 'To Hit Armour Class 0: the d20 roll needed to hit AC 0. To hit AC n you need THAC0 − n or more. Lower is better.',
  Damage: 'Damage dice with the readied weapon (or fists) against man-sized foes.',
  Movement: 'Squares per combat round. Heavy loads cut it.',
  Experience: 'Experience points: train at a training hall when there are enough for the next level.',
  Load: 'Everything carried, weighed in coins (each coin counts 1). Heavier loads lower movement.',
}

export function showExplore(app: HTMLElement, files: GameFiles, start: Start, back: () => void, dice?: Dice) {

  app.innerHTML = `
    <div class="game">
      <section class="view" aria-label="3D view">
        <canvas class="view3d"></canvas>
        <canvas class="drawnview" width="88" height="88" hidden></canvas>
        <canvas class="wildview" width="120" height="120" hidden></canvas>
        <canvas class="combatview" hidden></canvas>
        <div class="combat-info" hidden></div>
        <div class="turnstrip" hidden></div>
        <div class="wild" hidden></div>
        <canvas class="skylayer" width="88" height="88" hidden></canvas>
        <canvas class="overlay" width="88" height="88" hidden></canvas>
        <div class="where"></div>
      </section>
      <div class="side">
        <aside class="party" aria-label="Party"><div class="roster-cards"></div></aside>
        <section class="map" aria-label="Area map" title="Area map (click to enlarge)">
          <canvas class="minimap"></canvas>
          <p class="nomap" hidden>Not here.</p>
        </section>
      </div>
      <section class="text" aria-live="polite" aria-label="Messages"></section>
      <nav class="commands" aria-label="Commands">
        <div class="menu"></div>
        <button class="take-control" title="Space. Every character on Quick comes back under your control" hidden>Take control</button>
        <button class="magic-toggle" hidden>Magic: Off</button>
        <button class="assets debug-combat" title="Debug menu (not part of the game)">Debug</button>
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
  const skylayer = app.querySelector<HTMLCanvasElement>('.skylayer')!
  /** the sun or clouds over the view (CotAB), in the original's 88 × 88 view coordinates */
  function drawSky() {
    const art = game().view.skyArt, at = engine.overland ? null : engine.skyArt
    skylayer.hidden = !at || drawnMode // the drawn view has the sky pictures in its frame
    if (!art || !at || drawnMode) return
    const g = sizeCanvas(skylayer, 88, 88)
    g.clearRect(0, 0, 88, 88)
    const pic = frames('SKY', at.record)?.[0] ?? (() => { const r = files.record('SKY', at.record); return r ? parseRecord(r).frames[0]?.picture : undefined })()
    if (!pic) return
    const img = toImageData(pic)
    for (let i = 0; i < pic.pixels.length; i++) if (pic.pixels[i] === art.mask) img.data[i * 4 + 3] = 0
    const tmp = document.createElement('canvas')
    tmp.width = pic.width; tmp.height = pic.height
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    g.drawImage(tmp, at.x, at.y)
  }
  const where = app.querySelector<HTMLDivElement>('.where')!
  const wild = app.querySelector<HTMLDivElement>('.wild')!
  const log = app.querySelector<HTMLElement>('.text')!
  const roster = app.querySelector<HTMLElement>('.party .roster-cards')!
  const menuBar = app.querySelector<HTMLDivElement>('.menu')!
  const pad = app.querySelector<HTMLDivElement>('.pad')!
  app.querySelector<HTMLButtonElement>('.debug-combat')!.addEventListener('click', () => debugMenu())
  app.querySelector<HTMLButtonElement>('.take-control')!.addEventListener('click', () => battleControls?.takeControl())
  app.querySelector<HTMLButtonElement>('.magic-toggle')!.addEventListener('click', () => battleControls?.toggleMagic())
  const dialog = app.querySelector<HTMLDialogElement>('dialog.panel')!
  enhancePanel(dialog)
  dialog.addEventListener('close', () => dialog.classList.remove('wide'))
  // ------------------------------------------------------------- the 3D view
  // Two views (D6, spec/C-port/exploration-view.md §1): the original's drawn view (render/drawnview.ts)
  // and the enhanced WebGL view (render/world.ts, IMP-001), chosen by the View setting. Both answer the
  // same Io calls: refresh (sync), clearView, sprite, picture.
  const drawn = app.querySelector<HTMLCanvasElement>('.drawnview')!
  let drawnMode = viewMode() === 'original'
  /** the WebGL view, made the first time it is shown */
  let world: World | null = null
  /** the map or wall sets changed while the WebGL view was not drawing */
  let worldStale = true
  /** the encounter sprite over the view (Io.sprite), until clearView or a picture */
  let viewSprite: { frames: Picture[]; distance: number } | null = null
  function ensureWorld(): World {
    if (world) return world
    world = new World(canvas)
    // the game's ground picture on the floor (games/view.ts; CotAB SKY #252)
    const ground = game().view.ground
    if (ground) {
      const rec = files.record(ground.file, ground.record)
      const pic = rec ? parseRecord(rec).frames[0]?.picture : undefined
      if (pic) {
        const [from, to] = ground.rows
        world.ground(toImageData({ ...pic, height: to - from, pixels: pic.pixels.slice(from * pic.width, to * pic.width) }), ground.repeat)
      }
    }
    resize()
    return world
  }
  /** the view region shows the 3D view (not a battle, not the tile wilderness) */
  let viewShown = true
  function showView(on: boolean) {
    viewShown = on
    canvas.hidden = !on || drawnMode
    drawn.hidden = !on || !drawnMode
  }
  /** The drawn view's frame now (§2): the party's view with the sprite on show, scaled as pictures are. */
  function drawFrame() {
    const scene = sceneOf(engine, files, viewSprite ? spriteFrame(viewSprite.frames, viewSprite.distance) : null)
    if (!scene) return
    const img = new ImageData(frameRGBA(drawView(scene), EGA), VIEW, VIEW)
    if (drawn.width !== VIEW * SCALE) { drawn.width = VIEW * SCALE; drawn.height = VIEW * SCALE }
    drawn.getContext('2d')!.putImageData(upscale(img), 0, 0)
  }
  function viewSpriteShow(frames: Picture[] | null, distance = 0) {
    viewSprite = frames?.length ? { frames, distance } : null
    if (drawnMode) { if (!engine.overland) drawFrame() } else world?.showSprite(frames, distance)
  }
  /** The View setting changed: show the other view, at once. */
  function applyView() {
    const want = viewMode() === 'original'
    if (want === drawnMode) return
    drawnMode = want
    if (!drawnMode) {
      const w = ensureWorld()
      w.showSprite(viewSprite?.frames ?? null, viewSprite?.distance ?? 0)
    }
    showView(viewShown)
    void sync(0)
  }

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
  const pictureCache = new Map<string, { picture: Picture; delay: number }[] | null>()
  function animFrames(family: string, id: number): { picture: Picture; delay: number }[] | null {
    const key = `${family}${engine.block}#${id}`
    if (!pictureCache.has(key)) {
      const raw = files.record(`${family}${engine.block}`, id)
      let pics: { picture: Picture; delay: number }[] | null = null
      try {
        if (raw) pics = parseRecord(raw, family === 'PIC').frames.map((f) => ({ picture: f.picture, delay: f.delay }))
      } catch { /* not an image */ }
      pictureCache.set(key, pics)
    }
    return pictureCache.get(key)!
  }
  const frames = (family: string, id: number): Picture[] | null => animFrames(family, id)?.map((f) => f.picture) ?? null
  const imageOf = new WeakMap<Picture, ImageData>()
  const imageData = (p: Picture, sprite = false) => {
    if (sprite) return spriteImage(p)
    let d = imageOf.get(p)
    if (!d) imageOf.set(p, (d = toImageData(p)))
    return d
  }
  /** the running picture animation (spec/A-games/engine/graphics.md, "Animation"): a frame stays up delay × 0.1 s, then the next, wrapping to the first */
  let animTimer: number | null = null
  /** the PIC on show and its frame, for a script that steps it (CALL frame) */
  let shownPic: { f: { picture: Picture }[]; i: number } | null = null
  /** CotAB 0x6803: the next frame of the current picture, wrapping to the first; the script holds it */
  function nextFrame() {
    if (!shownPic || shownPic.f.length < 2) return
    stopAnimation()
    shownPic.i = (shownPic.i + 1) % shownPic.f.length
    paint([{ pic: shownPic.f[shownPic.i].picture, x: 0, y: 0 }])
  }
  const stopAnimation = () => { if (animTimer !== null) { window.clearTimeout(animTimer); animTimer = null } }
  /** Pictures and portraits are opaque; encounter sprites stand in the 3D scene instead (World.showSprite). */
  function paint(pics: { pic: Picture; x: number; y: number; sprite?: boolean }[], w = 88, h = 88) {
    const g = sizeCanvas(overlay, w, h)
    g.clearRect(0, 0, w, h)
    for (const { pic, x, y, sprite } of pics) {
      blit(g, imageData(pic, sprite), x, y)
    }
    overlay.classList.toggle('wide', w !== h) // a full-width BIGPIC keeps its own shape
    overlay.hidden = pics.length === 0
  }
  function showPicture(p: { pic: number } | { big: number } | { head: number; body: number } | null) {
    stopAnimation()
    shownPic = null
    if (!p) {
      viewSpriteShow(null)
      return paint([])
    }
    if ('big' in p) { // CotAB: a 304 × 120 BIGPIC (spec/A-games/coab/assets.md §5)
      const pic = frames('BIGPIC', p.big)?.[0]
      if (!pic) return
      const show = (cursor: boolean) => {
        paint([{ pic, x: 0, y: 0 }], pic.width, pic.height)
        const at = cursor && p.big === game().view.overlandPicture ? engine.cityCursor : null
        if (at) { // the city cursor, an 8 × 8 white block; the picture sits at screen (8, 8)
          const g = overlay.getContext('2d')!
          g.fillStyle = '#ffffff'
          g.fillRect(at[0] * 8 - 8, at[1] * 8 - 8, 8, 8)
        }
      }
      show(true)
      if (p.big === game().view.overlandPicture && engine.cityCursor) { // blinks about 0.5 s on, 0.3 s off (0x51C48)
        let on = true
        const blink = () => { animTimer = window.setTimeout(() => { on = !on; show(on); blink() }, on ? 500 : 300) }
        blink()
      }
      return
    }
    if ('pic' in p) {
      const f = animFrames('PIC', p.pic)
      if (!f?.length) return
      let i = 0
      paint([{ pic: f[0].picture, x: 0, y: 0 }])
      shownPic = { f, i: 0 }
      if (f.length > 1) {
        const next = () => {
          animTimer = window.setTimeout(() => {
            i = (i + 1) % f.length
            paint([{ pic: f[i].picture, x: 0, y: 0 }])
            next()
          }, Math.max(50, f[i].delay * 100))
        }
        next()
      }
    } else {
      const head = frames('HEAD', p.head)?.[0], body = frames('BODY', p.body)?.[0]
      paint([...(head ? [{ pic: head, x: 0, y: 0 }] : []), ...(body ? [{ pic: body, x: 0, y: 40 }] : [])])
    }
  }

  // ----------------------------------------- CLEAR_TOP and PRINT_LIST glyphs
  // The rune passwords and the elven scroll: the game's own font glyphs, drawn raw in colour 15.
  let topBlank = false
  let glyphFont: Uint8Array[] | null | undefined
  function drawGlyphs(g: CanvasRenderingContext2D, codes: number[], x: number, y: number) {
    if (glyphFont === undefined) { const r = files.record(files.game.view.font.file, files.game.view.font.record); glyphFont = r ? parseFont(r).glyphs : null }
    if (!glyphFont) return
    g.fillStyle = '#ffffff'
    codes.forEach((code, i) => {
      const bits = glyphFont![code]
      if (bits) for (let r = 0; r < 8; r++) for (let b = 0; b < 8; b++) if (bits[r] & (0x80 >> b)) g.fillRect(x + i * 8 + b, y + r, 1, 1)
    })
  }
  /** FUN_29c3_2b14 blanks the 15 × 15 cells at the top left, the view and its frame */
  function clearTop(on: boolean) {
    if (!on) { if (topBlank) { topBlank = false; paint([]) } return }
    stopAnimation()
    viewSpriteShow(null)
    const g = sizeCanvas(overlay, 120, 120)
    g.fillStyle = '#000000'
    g.fillRect(0, 0, 120, 120)
    overlay.hidden = false
    topBlank = true
  }
  function glyphs(codes: number[], at: { col: number; row: number } | null) {
    if (at && topBlank) { drawGlyphs(sizeCanvas(overlay, 120, 120), codes, at.col * 8, at.row * 8); return }
    const c = document.createElement('canvas')
    c.className = 'glyphs'
    const g = sizeCanvas(c, codes.length * 8, 8)
    g.fillStyle = '#000000'
    g.fillRect(0, 0, codes.length * 8, 8)
    drawGlyphs(g, codes, 0, 0)
    const last = screen?.lastElementChild
    if (last && !newBlock) last.append(c)
    else { print('\u00a0', false); screen?.lastElementChild?.replaceChildren(c) }
  }

  // -------------------------------------------------------------- the demo
  /** thrown through the script when the player leaves the demo (IMP-074) */
  class DemoLeft extends Error {}
  let demoLeft = false
  /** ends the pause the demo's script is waiting in, when the player leaves */
  let stopDemo: (() => void) | null = null
  /** in a demo whose key reads never wait (CotAB 0x6819, 0x5514) a menu or an input answers at once */
  const noWait = () => !!engine.demo && !engine.demo.keysWait
  /** the answer then: the first choice (I: the shipped demo asks nothing) */
  const demoAnswer = (): Promise<number> => (demoLeft ? Promise.reject(new DemoLeft()) : Promise.resolve(0))
  function leaveDemo() {
    if (demoLeft) return
    demoLeft = true
    stopDemo?.()
    leave()
  }

  // ---------------------------------------------------------------- menus
  let pending: { resolve: (n: number) => void; items: string[]; keys?: string[] } | null = null
  /** a click, tap or key skips the current script pause */
  let skipPause: (() => void) | null = null
  function menu(items: string[], opts: MenuOpts = {}): Promise<number> {
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
          // a line under the choice: what a spell does (IMP-058)
          const note = opts.notes?.[i]
          if (note) { const sm = document.createElement('small'); sm.textContent = note; b.append(sm) }
          b.addEventListener('click', () => choose(i))
          li.append(b)
          list.append(li)
        })
        ;(screen ?? log).append(list)
        log.scrollTop = log.scrollHeight
        menuBar.innerHTML = ''
      } else {
        const label = (t: string) => (single && CONTINUE_PROMPTS.includes(t) ? 'Continue' : t)
        // the hot key underlined: the choice's own (the game's capital, spec/D-appendices/strings.md §4.1), else its first letter
        const at = (t: string, i: number) => { const k = opts.keys?.[i]?.[0]; const j = k ? label(t).toUpperCase().indexOf(k) : 0; return j < 0 ? 0 : j }
        menuBar.innerHTML = items.map((t, i) => { const l = label(t), j = at(t, i)
          return `<button class="${single ? 'primary' : ''}" data-i="${i}">${escape(l.slice(0, j))}<u>${escape(l[j] ?? '')}</u>${escape(l.slice(j + 1))}</button>` }).join('')
        menuBar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.i))))
        menuBar.querySelector<HTMLButtonElement>('button')?.focus()
      }
      pending = { resolve, items, keys: opts.keys }
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
  /** the text of the current screen, for journal reveals */
  let screenText = ''
  const io: Io = {
    print: (text, clear) => {
      print(text, clear)
      if (engine.demo) return // the demo finds nothing for the journal
      for (const id of revealedBy(text)) known.add(id)
      // the journal (IMP-055): the whole screen is scanned, as a number can come in a print of its own
      screenText = clear ? text : `${screenText} ${text}`
      for (const id of journalReveals(screenText)) {
        if (known.has(id)) continue
        known.add(id)
        note(revealNote(id))
      }
    },
    menu: (items, opts) => (noWait() ? demoAnswer() : menu(items, opts)),
    inputNumber: async () => (noWait() ? demoAnswer() : Math.min(Number((await input('number')).replace(/\D/g, '') || 0), 65535)),
    inputText: async () => (noWait() ? (await demoAnswer(), '') : input('text')),
    nextFrame: () => nextFrame(),
    picture: (p) => { topBlank = false; showPicture(p) },
    clearView: () => { topBlank = false; showPicture(null) },
    clearTop,
    glyphs,
    river: cleanseRiver,
    sprite(sprite, picture, distance) {
      const f = frames('SPRIT', sprite)
      if (distance === 0 && picture !== 255) {
        viewSpriteShow(null)
        const portrait = engine.B[0x6de1 - 0x6b00]
        showPicture(portrait === 0xff ? { pic: picture } : { head: portrait, body: picture })
      } else if (f && engine.overland) {
        // wilderness: always the middle frame, drawn flat at its place in the view (FUN_2fea_054e)
        const pic = f[Math.min(1, f.length - 1)]
        paint([{ pic, x: pic.x * 8, y: pic.y * 8, sprite: true }])
      } else if (f) {
        paint([])
        viewSpriteShow(f, distance)
      }
    },
    refresh: () => (demoLeft ? Promise.reject(new DemoLeft()) : sync()),
    sound: play,
    pause(ms) {
      return new Promise((resolve, reject) => {
        if (demoLeft) return reject(new DemoLeft())
        stopDemo = () => { window.clearTimeout(timer); skipPause = null; reject(new DemoLeft()) }
        const timer = window.setTimeout(done, ms)
        function done() {
          window.clearTimeout(timer)
          skipPause = null
          stopDemo = null
          resolve()
        }
        skipPause = done
      })
    },
    async engine(what, info) {
      if (what === 'blocked') return note('Blocked.')
      if (what === 'party dead') { print(msg('partyKilled'), true); return gameOver() } // FUN_29c3_2775
      if (what === 'combat') {
        townMode = 'camp'
        const combatCanvas = app.querySelector<HTMLCanvasElement>('.combatview')!
        showView(false)
        wildview.hidden = true
        // the battlefield replaces the encounter picture or sprite (the overlay sits above every view)
        showPicture(null)
        app.querySelector('.game')!.classList.add('in-combat')
        try {
          const r = await runBattle({
            engine, files, canvas: combatCanvas, menu, print: (t, clear) => print(t, !!clear), view: (c) => new Promise<void>((resolve) => {
              sheet(parseCharacter(c), { combat: true })
              onClose(dialog, () => resolve())
            }),
            sound: play, pause: (ms) => io.pause!(ms), input: battleInput,
            info: app.querySelector<HTMLElement>('.combat-info')!, strip: app.querySelector<HTMLElement>('.turnstrip')!, refreshRoster: () => drawRoster(), cancelMenu: () => cancelMenu(), onSkip: (w) => { winBattle = w }, onControls: (c) => { battleControls = c; drawControls() }, controlsChanged: () => drawControls(),
          })
          // after a battle (game mode 6) the view shows PIC<block> #1, the treasure chest (FUN_10ba_27d9)
          if (engine.demo && !engine.demo.aftermath) { /* CotAB 0x1EEAC: nothing after the clean-up */ }
          else if (r.survived) {
            showView(!engine.overland)
            wildview.hidden = !engine.overland
            showPicture({ pic: 1 })
            try { await treasure(townUi) } finally { showPicture(null) }
          } else await gameOver()
        } catch (err) {
          if (err instanceof DemoLeft) throw err
          note(`Combat error: ${(err as Error).message}`)
        } finally {
          app.querySelector('.game')!.classList.remove('in-combat')
          townMode = null
          showView(!engine.overland)
          wildview.hidden = !engine.overland
          for (const k of Object.keys(battleInput)) delete (battleInput as Record<string, unknown>)[k]
          drawRoster()
        }
        return
      }
      if (what === 'ending') {
        await playEnding(dialog, files, engine.block, engine.party().length, engine.speed)
        const after = files.game.ending.after
        if (!after) return
        for (const [a, v] of after.set) engine.write(a, v)
        if (after.restoreParty) for (const c of engine.party()) { c[F.hp] = c[F.maxHp]; c[F.status] = 0; c[F.inPlay] = 1 }
        drawRoster()
        townMode = 'camp'
        try { await trainingHall() } finally { townMode = null }
        const y = word('yesNo', 'Y')
        if ((await ask(menu, [y, word('yesNo', 'N')], { prompt: text(after.savePrompt).trimEnd() })) === y.key) await saveGame()
        // the original returns to DOS; the port's way out is the party screen, as for "Quit TO DOS"
        engine.quit = true
        setTimeout(leave, 0)
        return
      }
      if (what === 'party screen') {
        townMode = 'camp'
        try { await trainingHall() } finally {
          townMode = null
          // PROGRAM 0 then redraws the screen for the map (FUN_10ba_27d9) and the script goes on
          // (0x1CA7F): the hall's picture goes and the 3D view is back
          showPicture(null)
          await sync(0)
        }
        return
      }
      if (what === 'camp') {
        // the camp screen shows PIC<block> #29, the campfire, animated (FUN_10ba_27d9 in game mode 2)
        townMode = 'camp'
        showPicture({ pic: 29 })
        let quit = false
        try { quit = await camp(campUi) } finally { townMode = null; showPicture(null) }
        // "Quit TO DOS": the game ends there; the port's way out is the party screen (spec/C-port/screens.md §6.1)
        if (quit) { engine.quit = true; setTimeout(leave, 0) }
        return
      }
      if (what === 'vault') {
        // SotSB's vault (0x21C90): VAULT.DAT (this device's, else the imported folder's) into the pile, the
        // screen, then the pile written back (0x220DA); what is left in the pile stays there, as in the original
        const sv = game().saves
        const v = parseVault((await getVaultFile()) ?? files.get('VAULT.DAT'), sv.itemRecord, sv.bundleType)
        engine.money = v.money
        engine.treasure = v.items
        townMode = 'treasure'
        try { await vault(townUi) } finally { townMode = null }
        await setVaultFile(vaultFile({ money: engine.money, items: engine.treasure }, sv.itemRecord, sv.bundleType))
        engine.treasure = []
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
  const engine = new Engine(files, io, dice)
  if (start.kind === 'demo') engine.newDemo(start.demo)
  else {
    if (start.kind === 'new') engine.newGame(start.party.map((c) => c.sav))
    else engine.loadSave(start.dat, start.party.map((c) => c.sav))
    start.party.forEach((c, i) => engine.attachFiles(i, c.itm, c.spc))
  }

  /** Save anywhere (IMPROVEMENTS.md IMP-002): slots A-J, the original file layout. */
  /** Autosave (IMP-060): the same files as a slot save, kept in their own record. */
  let autosavedAt = ''
  async function autosave(why: string) {
    const members = engine.party()
    if (!members.length || engine.quit || engine.demo) return // the demo saves nothing
    try {
      await writeAutosave({ slot: 'A', dat: engine.toSave(members.map((_, n) => `CHRDATA${n + 1}`)), savedAt: Date.now(), known: [...known], sidecar: sidecarExtra,
        label: `${parseCharacter(members[0]).name}'s party, block ${engine.block} area ${engine.area} (${why})`,
        chars: members.map((c) => ({ sav: c.slice(), itm: characterItemsFile(engine.itemsOf(c)), spc: effectsFile(engine.effectsOf(c)) })) })
      autosavedAt = `${engine.block}:${engine.area}`
    } catch { /* storage full or unavailable: the game goes on */ }
  }

  async function saveGame() {
    if (engine.demo) return
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
      chars: members.map((c) => ({ sav: c.slice(), itm: characterItemsFile(engine.itemsOf(c)), spc: effectsFile(engine.effectsOf(c)) })), known: [...known], sidecar: sidecarExtra })
    note(`Game saved in slot ${slot}.`)
  }

  // ------------------------------------------------------------- view sync
  let animDone: (() => void) | null = null
  function sync(ms = 180): Promise<void> {
    if (engine.mapDirty && engine.geo) {
      worldStale = true
      engine.mapDirty = false
      ms = 0
    }
    const outdoors = engine.overland
    showView(!outdoors)
    wildview.hidden = !outdoors || !engine.wild
    padLabels(outdoors)
    if (outdoors) {
      drawWild()
      ms = 0
    } else if (drawnMode) {
      // the original redraws the whole frame in one go: no slides (§2.2)
      drawFrame()
      ms = 0
    } else {
      const w = ensureWorld()
      if (worldStale && engine.geo) { w.build(engine.geo, engine.walls); worldStale = false; ms = 0 }
      const bd = engine.backdrop
      w.colours(bd.sky, bd.floor)
      w.go({ x: engine.x, y: engine.y, facing: engine.facing }, ms)
    }
    drawSky()
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
      if (!engine.wild) wild.innerHTML = `<p><strong>Wilderness</strong></p><p>The wilderness map needs START.EXE from the game files: re-import the ${game().folder} folder.</p>`
      return
    }
    wild.hidden = true
    const pos = engine.A[0x49fb - A0] !== 0 ? '' : `${engine.x},${engine.y} · ` // hidden where the Area map is refused
    where.textContent = `${FACING[engine.facing]} · ${pos}${clockText(engine)}${searching ? ' · Searching' : ''}`
  }

  function drawRoster() {
    const cur = engine.nodes.indexOf(engine.cur)
    // roster cards (IMP-045): portrait, combat icon, name, AC, HP bar, readied weapon, spells ready,
    // effects as the camp Display names them, and whether a training hall would train them now
    const list = party()
    const t = getTables(), st = engine.spells, it = engine.items
    // a portrait from HEAD/BODY where the game has the portrait record tables (PoR); CotAB characters
    // have none (its creation shows the combat icon, spec/A-games/coab/tables.md)
    const portraits = T.headRecords.at >= 0
    roster.innerHTML = list.map((c, i) => {
      const raw = c.raw
      const up = c.status === 'Okay' || c.status === 'Animated'
      const pct = up ? Math.round((100 * c.hp) / Math.max(1, c.hpMax)) : 0
      const cls = ['rcard', i === cur ? 'current' : '', c.npc ? 'npc' : '', c.hp < c.hpMax ? 'hurt' : '', up ? '' : 'down'].join(' ')
      const weapon = it ? engine.itemsOf(raw).find((x) => x.ready && it.baseOf(x)?.slot === 0) : undefined
      const counts = new Map<string, number>()
      if (st) for (const v of memorised(raw)) if (v > 0 && v < 0x80) { const n = st.get(v)?.name; if (n) counts.set(n, (counts.get(n) ?? 0) + 1) }
      const spells = [...counts].map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join(', ')
      const effects = effectNames(engine, raw)
      // the combat panel's "(Helpless)" (FUN_10ba_09e3)
      const helpless = up && engine.effectsOf(raw).some((e) => game().effects.ids.helpless.includes(e.type))
      const train = t ? canTrain(t, raw) : false
      const xpp = t ? xpProgress(t, raw) : null
      const xpBar = t ? `<span class="xpbar${train ? ' ready' : ''}" title="${escape(xpp ? xpp.text : 'Every class is at its highest level')}"><span style="width:${xpp ? xpp.pct : 100}%"></span></span>` : ''
      // on Quick (c[0x10F]): the computer plays them in battle until Space / Take control
      const quick = raw[F.quick] !== 0 && raw[F.morale] < 0x80
      return `<button class="${cls}" data-i="${i}" title="${i === cur ? 'View' : 'Select'} ${escape(c.name)}">
        ${portraits ? '<canvas class="pixel rc-portrait" width="88" height="88"></canvas>' : ''}
        <span class="rc-body">
          <span class="rc-top"><span class="rc-name">${escape(c.name)}</span><span class="rc-ac" title="${escape(TIPS.AC)}">AC ${c.ac}</span></span>
          <span class="hpbar${pct < 50 ? ' low' : ''}"><span style="width:${pct}%"></span></span>
          ${xpBar}
          <span class="rc-line"><span class="rc-hp">${up ? `HP ${c.hp}/${c.hpMax}` : c.status}</span><span class="rc-ac2" title="${escape(TIPS.AC)}"> · AC ${c.ac}</span>${helpless ? ' (Helpless)' : ''}</span>
          ${weapon && it ? `<span class="rc-line rc-weapon" title="${escape(it.name(weapon))}">${escape(it.name(weapon))}</span>` : ''}
          ${spells ? `<span class="rc-line rc-spells" title="${escape(spells)}">✦ ${escape(spells)}</span>` : ''}
          ${effects.length || train || quick ? `<span class="rc-badges">${quick ? '<span class="badge quick" title="The computer plays them in battle. Open their sheet and choose Play by hand, or press Space / Take control in a battle">Quick</span>' : ''}${effects.map((n) => `<span class="badge">${escape(n)}</span>`).join('')}${train ? '<span class="badge train">Ready to train</span>' : ''}</span>` : ''}
        </span>
        <canvas class="pixel rc-icon" width="24" height="24"></canvas></button>`
    }).join('')
    const pic = (family: string, id: number) => { const r = files.record(family, id); try { return r ? parseRecord(r).frames[0].picture : null } catch { return null } }
    // outside battles a card can be dragged onto another's place: Alter → Order, step by step (IMP-065)
    const inBattle = app.querySelector('.game')!.classList.contains('in-combat')
    roster.querySelectorAll<HTMLElement>('.rcard').forEach((card, i) => {
      card.draggable = !inBattle
      if (inBattle) return
      card.addEventListener('dragstart', (ev) => { ev.dataTransfer?.setData('text/x-party', String(i)); card.classList.add('dragging') })
      card.addEventListener('dragend', () => card.classList.remove('dragging'))
      card.addEventListener('dragover', (ev) => { if (ev.dataTransfer?.types.includes('text/x-party')) { ev.preventDefault(); card.classList.add('drop-here') } })
      card.addEventListener('dragleave', () => card.classList.remove('drop-here'))
      card.addEventListener('drop', (ev) => {
        ev.preventDefault()
        card.classList.remove('drop-here')
        let from = Number(ev.dataTransfer?.getData('text/x-party'))
        if (Number.isNaN(from) || from === i || busy || pending) return
        while (from < i) { engine.moveMember(from, 1); from++ }
        while (from > i) { engine.moveMember(from, -1); from-- }
        drawRoster()
      })
    })
    roster.querySelectorAll<HTMLElement>('.rcard').forEach((card, i) => {
      const raw = list[i].raw
      const key = Array.from(raw.subarray(F.iconHead, F.iconColours + 6)).join(',')
      let img = rosterIcons.get(key)
      if (img === undefined) { const p = buildIcon(files, raw, false); img = p ? toImageData(p) : null; rosterIcons.set(key, img) }
      const g = sizeCanvas(card.querySelector<HTMLCanvasElement>('canvas.rc-icon')!, 24, 24)
      g.fillStyle = '#000'; g.fillRect(0, 0, 24, 24)
      if (img) blit(g, img, 0, 0)
      const portrait = card.querySelector<HTMLCanvasElement>('canvas.rc-portrait')
      if (!portrait) return
      const pg = sizeCanvas(portrait, 88, 88)
      pg.fillStyle = '#000'; pg.fillRect(0, 0, 88, 88)
      if (t) {
        const pk = `${raw[F.head]},${raw[F.body]}`
        let pp = rosterPortraits.get(pk)
        if (pp === undefined) { const h = pic('HEAD3', headRecord(t, raw[F.head])), b = pic('BODY3', bodyRecord(t, raw[F.body])); pp = [h ? toImageData(h) : null, b ? toImageData(b) : null]; rosterPortraits.set(pk, pp) }
        if (pp[0]) blit(pg, pp[0], 0, 0)
        if (pp[1]) blit(pg, pp[1], 0, 40)
      }
    })
  }
  const rosterPortraits = new Map<string, [ImageData | null, ImageData | null]>()
  /** a training hall would train this character now: enough experience for a class below its limit */
  /**
   * Progress to the next level (IMP-063): the one experience total against each class's table
   * (DS:409B), for the class that levels soonest; null when every class is at its cap.
   */
  function xpProgress(t: Tables, c: Uint8Array): { pct: number; text: string } | null {
    const xp = (c[F.xp] | (c[F.xp + 1] << 8) | (c[F.xp + 2] << 16) | (c[F.xp + 3] << 24)) >>> 0
    let best: { pct: number; text: string; left: number } | null = null
    for (let k = 0; k < F.classCount; k++) {
      const L = c[F.levels + k]
      if (L <= 0 || L >= levelLimit(c, k)) continue
      const next = xpFor(t, k, L + 1)
      if (next === 0 || next === 0xffffffff) continue
      const from = L > 1 ? xpFor(t, k, L) : 0
      const pct = Math.max(0, Math.min(100, Math.round((100 * (xp - from)) / Math.max(1, next - from))))
      const left = next - xp
      const text = left <= 0 ? `${xp.toLocaleString()} XP: ready to train as a level ${L + 1} ${CLASS_NAMES[k]}` : `${xp.toLocaleString()} XP: ${left.toLocaleString()} to level ${L + 1} ${CLASS_NAMES[k]} (${next.toLocaleString()})`
      if (!best || left < best.left) best = { pct, text, left }
    }
    return best ? { pct: best.pct, text: best.text } : null
  }
  function canTrain(t: Tables, c: Uint8Array) {
    const xp = (c[F.xp] | (c[F.xp + 1] << 8) | (c[F.xp + 2] << 16) | (c[F.xp + 3] << 24)) >>> 0
    for (let k = 0; k < F.classCount; k++) {
      const L = c[F.levels + k]
      if (L <= 0 || L >= levelLimit(c, k)) continue
      const need = xpFor(t, k, L + 1)
      if (need !== 0 && need !== 0xffffffff && xp >= need) return true
    }
    return false
  }
  const rosterIcons = new Map<string, ImageData | null>()

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
      onClose(dialog, () => resolve())
    }),
    refresh: () => drawRoster(),
    buy: () => shopPanel(),
    treasurePanel: () => treasurePanel(),
  }

  /**
   * The shop's Buy on one panel (IMP-042): pick the buyer, filter the stock, see the price, weight,
   * whether the buyer's class can use it and what readying it in place of the current item would
   * change; buying follows the original (FUN_4c2d_09ae: room, weight, then payment from the buyer's coins).
   */
  /** What readying `it` instead of the same-slot item would change (IMP-042, IMP-056), or why it can't be readied. */
  function readyChange(t: ItemTables, c: Uint8Array, items: Item[], it: Item): string {
    return readyCompare(t, c, items, it).text
  }
  /** How much better readying `it` would make them: AC and THAC0 points plus average damage (0 if not better). */
  function readyGain(t: ItemTables, c: Uint8Array, items: Item[], it: Item): number {
    return readyCompare(t, c, items, it).gain
  }
  function readyCompare(t: ItemTables, c: Uint8Array, items: Item[], it: Item): { text: string; gain: number } {
      const b = t.baseOf(it)
      if (!b || (b.slot > 9 && it.type !== R.itemTypes.arrows && it.type !== R.itemTypes.quarrels)) return { text: '', gain: 0 }
      const cc = c.slice(), copies = items.map((x) => x.copy()), mine = it.copy()
      copies.push(mine)
      // take off what the new item would replace (same slot; a weapon also frees a shield's hand if it needs two)
      for (const x of copies) {
        const xb = t.baseOf(x)
        if (x === mine || !x.ready || !xb || x.cursed) continue
        if (xb.slot === b.slot && b.slot !== 9 && b.slot !== 10) x.ready = false
        if (b.hands === 2 && xb.slot === 1) x.ready = false
      }
      recalc(cc, copies, t)
      const why = ready(cc, copies, mine, t)
      if (why) return { text: `can't ready: ${why}`, gain: 0 }
      const before = parseCharacter(c), after = parseCharacter(cc)
      const d = ([['AC', before.ac, after.ac], ['THAC0', before.thac0, after.thac0], ['Dmg', before.damage, after.damage], ['Move', before.movement, after.movement]] as [string, number | string, number | string][])
        .filter(([, x, y]) => x !== y).map(([k, x, y]) => `${k} ${x}→${y}`)
      const avg = (v: number | string) => { const m = /(\d+)d(\d+)([+-]\d+)?/.exec(String(v)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 + Number(m[3] ?? 0) : Number(v) || 0 }
      const gain = (Number(before.ac) - Number(after.ac)) + (Number(before.thac0) - Number(after.thac0)) + (avg(after.damage) - avg(before.damage))
      return { text: d.length ? d.join(', ') : 'no change', gain: Math.max(0, gain) }
    }

  /**
   * Treasure after a battle on one panel (IMP-056), the original's rules underneath: coins taken with
   * FUN_4c2d_0ceb's limits, Pool and Share as FUN_4c2d_063a, items to anyone who can carry them
   * (16 items, capacity), Detect Magic as the menu's " Detect", the leftover warning.
   */
  function treasurePanel(): Promise<void> {
    const t = engine.items!
    let message = ''
    let split: Map<number, number> | null = null // item index → party index (−1 leave), while the split is shown
    let leaving = false
    const members = () => engine.party()
    const load = (c: Uint8Array) => c[F.load] | (c[F.load + 1] << 8)
    const usable = (c: Uint8Array, it: Item) => ((t.baseOf(it)?.classes ?? 0) & c[F.itemMask]) !== 0
    const nameOf = (c: Uint8Array) => parseCharacter(c).name
    /** movement after taking this extra (an item, or n coins) */
    const moveAfter = (c: Uint8Array, items: Item[], it: Item | null, coins = 0) => {
      const cc = c.slice(), list = items.map((x) => x.copy())
      if (it) list.push(it.copy())
      if (coins) { const g = Math.min(0xffff, (cc[F.money + 6] | (cc[F.money + 7] << 8)) + coins); cc[F.money + 6] = g & 0xff; cc[F.money + 7] = g >> 8 } // weighed as gold: every coin counts 1
      recalc(cc, list, t)
      return cc[F.move]
    }
    const detectCaster = () => members().find((c) => c[F.status] === 0 && Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k]).some((v) => v === 5 || v === 11))
    const leftovers = () => [...engine.money.some((v) => v > 0) ? [moneyLine(engine.money)] : [], ...engine.treasure.map((it) => t.name(it))]
    const moneyLine = (m: number[]) => COINS.map((n, i) => (m[i] ? `${m[i]} ${n}` : '')).filter(Boolean).join(', ')
    /** "Take all" (not in the original), rules/treasure.ts */
    const propose = () => proposeSplit(members().map((c) => ({ c, items: engine.itemsOf(c) })), engine.treasure, t, (c, items, it) => readyGain(t, c, items, it))
    return new Promise((resolve) => {
      const render = () => {
        const party = members()
        const taker = engine.cur
        // the party with their load and movement
        const cards = party.map((c, k) => {
          const pct = Math.min(100, Math.round((100 * load(c)) / Math.max(1, capacity(c))))
          return `<button data-who="${k}" class="tr-member${c === taker ? ' on' : ''}" title="Coins go to the one selected">
            <span>${escape(nameOf(c))}</span><span class="loadbar${pct > 90 ? ' full' : ''}"><span style="width:${pct}%"></span></span>
            <small>${load(c)}/${capacity(c)} · move ${c[F.move]} · ${engine.itemsOf(c).length}/16 items</small></button>`
        }).join('')
        const coins = COINS.map((n, i) => ({ n, i, v: engine.money[i] })).filter((x) => x.v > 0)
        const coinRows = coins.map(({ n, i, v }) => {
          const slower = moveAfter(taker, engine.itemsOf(taker), null, v) < taker[F.move]
          return `<tr><td>${escape(n)}</td><td class="num">${v}</td>
            <td><input type="number" min="1" max="${v}" value="${v}" data-amount="${i}"></td>
            <td><button data-coin="${i}">Take</button>${slower ? '<small class="cant"> slows them</small>' : ''}</td></tr>`
        }).join('')
        const rows = engine.treasure.map((it, i) => {
          const give = party.map((c, k) => {
            const why = c[F.status] !== 0 ? 'cannot take things now' : canTakeItem(c, engine.itemsOf(c), it)
            const can = usable(c, it)
            const slower = !why && moveAfter(c, engine.itemsOf(c), it) < c[F.move]
            const tip = why || `${nameOf(c)}${can ? '' : ' (cannot use it)'}${slower ? ', moves slower with it' : ''}`
            return `<button data-give="${i}:${k}" class="${can ? '' : 'unusable'}${slower ? ' slower' : ''}" ${why ? `disabled title="${escape(why === 'Overloaded' ? 'OverLoaded' : why)}"` : `title="${escape(tip)}"`}>${escape(nameOf(c).split(' ')[0])}${slower ? ' ↓' : ''}</button>`
          }).join('')
          const better = party.filter((c) => c[F.status] === 0 && usable(c, it)).map((c) => {
            const r = readyCompare(t, c, engine.itemsOf(c), it)
            return r.gain > 0 ? `better for ${nameOf(c)}: ${r.text}` : ''
          }).filter(Boolean)
          const who = party.filter((c) => usable(c, it)).map(nameOf)
          return `<tr><td>${escape(t.name(it))}<small class="muted">${who.length ? `usable by ${escape(who.join(', '))}` : 'no one in the party can use it'}</small>
            ${better.length ? `<small class="cmp">${escape(better.join(' · '))}</small>` : ''}</td>
            <td class="num">${it.weight * Math.max(1, it.count)}</td><td class="give">${give}</td></tr>`
        }).join('')
        const caster = engine.treasure.length ? detectCaster() : undefined
        let body = ''
        if (leaving) {
          body = `<p>These will be left behind:</p><ul>${leftovers().map((x) => `<li>${escape(x)}</li>`).join('')}</ul>
            <p><button data-leave="yes" class="primary">Leave them</button> <button data-leave="no">Go back</button></p>`
        } else if (split) {
          const opts = (i: number) => [-1, ...party.map((_, k) => k)].map((k) => `<option value="${k}"${split!.get(i) === k ? ' selected' : ''}>${k < 0 ? 'leave it' : escape(nameOf(party[k]))}</option>`).join('')
          body = `<p class="muted">A suggested split (not in the original): each item to someone who can use it and gains most, else to whoever has most room; coins shared evenly as Share does. Change anything, then confirm.</p>
            <table class="shop"><tbody>${engine.treasure.map((it, i) => `<tr><td>${escape(t.name(it))}</td><td><select data-split="${i}">${opts(i)}</select></td></tr>`).join('')}
            ${coins.length ? `<tr><td>${escape(moneyLine(engine.money))}</td><td>shared evenly</td></tr>` : ''}</tbody></table>
            <p><button data-split-ok="1" class="primary">Confirm</button> <button data-split-cancel="1">Cancel</button></p>`
        } else {
          body = `<div class="tr-party">${cards}</div>
            ${coins.length ? `<h3>Coins</h3><p class="muted">Each coin counts 1 towards the load. Take gives the selected character the amount; Share splits all coins evenly; Pool gathers the party's coins here.</p>
              <table class="shop"><tbody>${coinRows}</tbody></table>` : ''}
            <p class="tr-actions">${coins.length ? '<button data-share="1">Share evenly</button>' : ''}<button data-pool="1">Pool the party's coins</button>
              ${caster ? `<button data-detect="1">Detect Magic (${escape(nameOf(caster))}): magic items get a *</button>` : ''}
              ${engine.treasure.length || coins.length ? '<button data-propose="1">Take all…</button>' : ''}</p>
            ${engine.treasure.length ? `<h3>Items</h3><table class="shop treasure"><thead><tr><th>Item</th><th class="num">Weight</th><th>Give to</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
            ${!coins.length && !engine.treasure.length ? '<p class="muted">Nothing left.</p>' : ''}`
        }
        dialog.innerHTML = `<h2>Treasure</h2>${body}
          ${message ? `<p class="message">${escape(message)}</p>` : ''}
          ${leaving || split ? '' : '<p><button data-done="1" class="primary">Done</button></p>'}`
      }
      const finish = () => { dialog.close() }
      const onClick = async (e: MouseEvent) => {
        const b = (e.target as HTMLElement).closest('button')
        if (!b || b.disabled) return
        e.preventDefault()
        const d = b.dataset
        message = ''
        if (d.who) { engine.cur = members()[Number(d.who)]; drawRoster() }
        else if (d.coin) {
          const i = Number(d.coin)
          const n = Number(dialog.querySelector<HTMLInputElement>(`[data-amount="${i}"]`)?.value) || 0
          const c = engine.cur
          const before = engine.money[i]
          message = take(c, engine.itemsOf(c), engine.money, i, n, t) || `${nameOf(c)} takes ${before - engine.money[i]} ${COINS[i]}.`
          if (message === msg('moneyOverloaded') || message === msg('takeOverloaded')) message = msg('shopOverloaded')
          drawRoster()
        } else if (d.share) { share(members().map((c) => ({ c, items: engine.itemsOf(c) })), engine.money, t); message = engine.money.some((v) => v > 0) ? `Shared; what nobody could carry is still here.` : 'Shared.'; drawRoster() }
        else if (d.pool) { poolAll(members().map((c) => ({ c, items: engine.itemsOf(c) })), engine.money, t); message = 'The party\'s coins are pooled here.'; drawRoster() }
        else if (d.detect) {
          const c = detectCaster()
          const id = c ? Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k]).find((v) => v === 5 || v === 11) : undefined
          if (c && id && engine.spells) {
            engine.cur = c
            const out = await castOutside(engine, c, engine.spells.get(id)!, [c])
            for (const m of out.slice(1)) print(m, false)
            message = 'Magic items now show a *.'
            drawRoster()
          }
        } else if (d.give) {
          const [i, k] = d.give.split(':').map(Number)
          const it = engine.treasure[i], c = members()[k], items = engine.itemsOf(c)
          const why = canTakeItem(c, items, it)
          if (why) message = why === msg('takeOverloaded') ? msg('shopOverloaded') : why
          else { engine.treasure.splice(i, 1); items.push(it); recalc(c, items, t); message = `${nameOf(c)} takes ${t.name(it)}.`; drawRoster() }
        } else if (d.propose) split = propose()
        else if (d.splitCancel) split = null
        else if (d.splitOk && split) {
          const plan = [...split.entries()].filter(([, k]) => k >= 0).sort((a, b) => b[0] - a[0]) // high indices first, so splicing keeps the rest in place
          const missed: string[] = []
          for (const [i, k] of plan) {
            const it = engine.treasure[i], c = members()[k], items = engine.itemsOf(c)
            if (canTakeItem(c, items, it)) { missed.push(t.name(it)); continue }
            engine.treasure.splice(i, 1); items.push(it); recalc(c, items, t)
          }
          share(members().map((c) => ({ c, items: engine.itemsOf(c) })), engine.money, t)
          split = null
          message = missed.length ? `No room for: ${missed.join(', ')}.` : 'Done.'
          drawRoster()
        } else if (d.done) {
          if (leftovers().length) leaving = true
          else return finish()
        } else if (d.leave === 'yes') return finish()
        else if (d.leave === 'no') leaving = false
        render()
      }
      const onChange = (e: Event) => {
        const el = e.target as HTMLSelectElement
        if (el.dataset.split && split) split.set(Number(el.dataset.split), Number(el.value))
      }
      dialog.classList.add('wide')
      dialog.addEventListener('click', onClick)
      dialog.addEventListener('change', onChange)
      onClose(dialog, () => { dialog.removeEventListener('click', onClick); dialog.removeEventListener('change', onChange); resolve() })
      render()
      dialog.showModal()
    })
  }

  function shopPanel(): Promise<void> {
    const t = engine.items!
    let filter: 'all' | 'weapons' | 'armour' | 'other' = 'all'
    let onlyUsable = false
    let message = ''
    const kind = (it: Item) => {
      const b = t.baseOf(it)
      if (!b) return 'other'
      if (b.slot === 0 || it.type === R.itemTypes.arrows || it.type === R.itemTypes.quarrels) return 'weapons'
      if (b.slot >= 1 && b.slot <= 9) return 'armour'
      return 'other'
    }
    const compare = (c: Uint8Array, items: Item[], it: Item) => readyChange(t, c, items, it)
    return new Promise((resolve) => {
      const render = () => {
        const buyer = engine.cur, items = engine.itemsOf(buyer), name = parseCharacter(buyer).name
        const gold = coinValue(moneyOf(buyer)), pooled = coinValue(engine.money)
        const stock = priceStock(engine.treasure).map((it, i) => ({ it, i })).filter(({ it }) =>
          (filter === 'all' || kind(it) === filter) && (!onlyUsable || ((t.baseOf(it)?.classes ?? 0) & buyer[F.itemMask]) !== 0))
        const rows = stock.map(({ it, i }) => {
          const usable = ((t.baseOf(it)?.classes ?? 0) & buyer[F.itemMask]) !== 0
          const cost = shopPrice((a) => engine.read(a), it.value)
          const why = canTakeItem(buyer, items, it) || (cost > gold && cost > pooled ? 'Not enough money' : '')
          return `<tr class="${usable ? '' : 'unusable'}"><td>${escape(t.name(it))}${usable ? '' : '<small class="cant">not for this class</small>'}</td>
            <td class="num">${cost}</td><td class="num">${it.weight * Math.max(1, it.count)}</td><td class="cmp">${usable ? escape(compare(buyer, items, it)) : ''}</td>
            <td><button data-buy="${i}" ${why ? `disabled title="${escape(why)}"` : ''}>Buy</button></td></tr>`
        }).join('')
        dialog.innerHTML = `<h2>Buy</h2>
          <div class="shop-buyer">${engine.party().map((c) => `<button data-who="${engine.party().indexOf(c)}" class="${c === buyer ? 'on' : ''}">${escape(parseCharacter(c).name)}</button>`).join('')}</div>
          <p>${escape(name)} has <strong>${gold}</strong> gp in coins${pooled ? ` · ${pooled} gp in the pool` : ''} · carrying ${buyer[F.load] | (buyer[F.load + 1] << 8)} of ${capacity(buyer)}</p>
          <div class="shop-filter">${(['all', 'weapons', 'armour', 'other'] as const).map((f) => `<button data-f="${f}" class="${f === filter ? 'on' : ''}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
            <label><input type="checkbox" ${onlyUsable ? 'checked' : ''} data-usable> Only what ${escape(name)} can use</label></div>
          <table class="shop"><thead><tr><th>Item</th><th class="num">Price</th><th class="num">Weight</th><th>If readied instead</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Nothing here.</td></tr>'}</tbody></table>
          ${message ? `<p class="message">${escape(message)}</p>` : ''}
          <form method="dialog"><button class="primary">Done</button></form>`
        dialog.querySelector<HTMLInputElement>('[data-usable]')!.addEventListener('change', (e) => { onlyUsable = (e.target as HTMLInputElement).checked; render() })
      }
      const onClick = (e: MouseEvent) => {
        const b = (e.target as HTMLElement).closest('button')
        if (!b || b.closest('form') || b.disabled) return
        e.preventDefault()
        const d = b.dataset
        if (d.who) { engine.cur = engine.party()[Number(d.who)]; message = ''; drawRoster() }
        else if (d.f) filter = d.f as typeof filter
        else if (d.buy) {
          const it = engine.treasure[Number(d.buy)], buyer = engine.cur, items = engine.itemsOf(buyer)
          const why = canTakeItem(buyer, items, it)
          if (why) message = why === msg('takeOverloaded') ? msg('shopOverloaded') : why
          else if (!pay(buyer, engine.money, shopPrice((a) => engine.read(a), it.value), t, items)) message = msg('shopNoMoney')
          else {
            const copy = it.copy()
            items.push(copy)
            recalc(buyer, items, t)
            message = `${parseCharacter(buyer).name} buys ${t.name(copy)}.`
            print(message, false)
            drawRoster()
          }
        }
        render()
      }
      dialog.classList.add('wide')
      dialog.addEventListener('click', onClick)
      onClose(dialog, () => { dialog.removeEventListener('click', onClick); resolve() })
      render()
      dialog.showModal()
    })
  }

  /**
   * Memorize on one panel (IMP-043): the character's slots per class and level, filled with ready
   * spells and pending ones (id + 0x80), the spell book beside them; a tap memorises (FUN_3f81_090a's
   * rule: a free slot of that class and level) or clears a pending one, and the rest needed is shown.
   */
  function memorizePanel(): Promise<void> {
    const st = engine.spells!, t = engine.items!
    let message = ''
    const slotLevels = Array.from({ length: R.spells.levels }, (_, i) => i + 1)
    const sortSlots = (c: Uint8Array) => memorised(c).sort((a, b) => (a & 0x7f) - (b & 0x7f)).forEach((v, i) => { c[F.memorised + i] = v })
    return new Promise((resolve) => {
      const render = () => {
        const c = engine.cur, name = parseCharacter(c).name
        const casters = engine.party().filter((m) => m[F.status] === 0 && slotLevels.some((l) => casterClasses().some((k) => slots(m, k.cls, l))))
        const groups: string[] = []
        for (const { cls } of casterClasses()) {
          if (!slotLevels.some((l) => slots(c, cls, l))) continue
          const levels = slotLevels.filter((l) => slots(c, cls, l)).map((l) => {
            const total = slots(c, cls, l)
            const inSlots = memorised(c).map((v, k) => ({ v, k })).filter(({ v }) => v && st.get(v & 0x7f)?.cls === cls && st.get(v & 0x7f)?.level === l)
            const chips = inSlots.map(({ v, k }) => v >= 0x80
              ? `<button class="spell pending" data-clear="${k}" title="Pending: tap to clear">${escape(st.get(v & 0x7f)!.name)} ✕</button>`
              : `<span class="spell ready">${escape(st.get(v)!.name)}</span>`).join('')
            const empty = Array.from({ length: Math.max(0, total - inSlots.length) }, () => '<span class="spell empty">empty</span>').join('')
            const book = st.spells.filter((s) => bookSpell(s) && s.cls === cls && s.level === l && knows(c, s.id) && mayCast(c, s))
            const free = freeSlots(c, cls, l, st)
            return `<div class="mem-level"><h4>Level ${l} <span class="muted">${total - free} of ${total} slots</span></h4>
              <div class="mem-slots">${chips}${empty}</div>
              <div class="mem-book">${book.map((s) => `<button data-mem="${s.id}" ${free > 0 ? '' : 'disabled'} title="${escape(spellText(s))}">+ ${escape(s.name)}</button>`).join('') || '<span class="muted">No spells of this level in the book.</span>'}</div></div>`
          }).join('')
          groups.push(`<section class="mem-class"><h3>${cls ? 'Magic-User' : 'Cleric'} spells</h3>${levels}</section>`)
        }
        const mins = preparation(c, engine.itemsOf(c), t, st)
        const pendingN = memorised(c).filter((v) => v >= 0x80).length
        dialog.innerHTML = `<h2>Memorize</h2>
          <div class="shop-buyer">${casters.map((m) => `<button data-who="${engine.party().indexOf(m)}" class="${m === c ? 'on' : ''}">${escape(parseCharacter(m).name)}</button>`).join('')}</div>
          ${groups.length ? `<div class="mem">${groups.join('')}</div>` : `<p class="muted">${escape(name)} cannot memorize any spells.</p>`}
          <p>${pendingN ? `${pendingN} spell${pendingN > 1 ? 's' : ''} to learn: rest ${Math.floor(mins / 60)} h ${mins % 60} min to memorize ${pendingN > 1 ? 'them' : 'it'} (Rest in the camp menu).` : 'Nothing pending.'}</p>
          ${message ? `<p class="message">${escape(message)}</p>` : ''}
          <form method="dialog" class="yn">${pendingN ? '<button type="button" data-clearall="1">Clear pending</button>' : ''}<button class="primary">Done</button></form>`
      }
      const onClick = (e: MouseEvent) => {
        const b = (e.target as HTMLElement).closest('button')
        if (!b || b.disabled) return
        const d = b.dataset
        if (b.closest('form') && !d.clearall) return
        e.preventDefault()
        message = ''
        const c = engine.cur
        if (d.who) { engine.cur = engine.party()[Number(d.who)]; drawRoster() }
        else if (d.mem) { const s = st.get(Number(d.mem))!; if (!memorise(c, s, st)) message = 'No free slot of that level.' }
        else if (d.clear) { c[F.memorised + Number(d.clear)] = 0; sortSlots(c) }
        else if (d.clearall) for (let k = 0; k < F.memorisedCount; k++) if (c[F.memorised + k] >= 0x80) c[F.memorised + k] = 0
        render()
      }
      dialog.classList.add('wide')
      dialog.addEventListener('click', onClick)
      onClose(dialog, () => { dialog.removeEventListener('click', onClick); resolve() })
      render()
      dialog.showModal()
    })
  }

  const campUi: CampUi = {
    get engine() { return engine },
    menu,
    print: (text, clear) => print(text, !!clear),
    view: () => new Promise<void>((resolve) => {
      sheet(parseCharacter(engine.cur))
      onClose(dialog, () => resolve())
    }),
    save: () => saveGame(),
    memorizePanel: () => memorizePanel(),
    iconEditor: (c) => creatorTools(dialog, files, engine, getTables()).iconEditor(c),
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
   * The party screen a training hall opens (PROGRAM 0; spec/A-games/engine/input-and-menus.md, spec/A-games/engine/chargen-and-progression.md): Create,
   * Drop, Modify, Train, View, Add, Remove, Save and Begin. Load needs an empty party, which this
   * screen never leaves, so it is not offered. Created and removed characters go to the roster
   * (browser storage), as the original writes their files.
   */
  let tables: Tables | null | undefined
  function getTables(): Tables | null {
    if (tables === undefined) {
      const exe = files.get('START.EXE')
      try { tables = exe ? new Tables(unexepack(exe).image) : null } catch { tables = null }
    }
    return tables
  }
  async function trainingHall() {
    if (tables === undefined) {
      const exe = files.get('START.EXE')
      try { tables = exe ? new Tables(unexepack(exe).image) : null } catch { tables = null }
    }
    if (!tables) { note(`The party screen needs START.EXE: re-import the ${game().folder} folder.`); return }
    const t = tables
    const tools = creatorTools(dialog, files, engine, t)
    const nameOf = (c: Uint8Array) => parseCharacter(c).name
    for (;;) {
      const party = engine.party()
      drawRoster()
      print(`${nameOf(engine.cur)} is selected (choose from the party list).`, true)
      // the party screen's functions as the game names them (its table, PoR DS:0619, CotAB DS:0553;
      // FUN_417f_0161, CotAB 0x36A1C), the key each one's first letter
      // CotAB's Human Change Classes only for a human who never changed class (0x36A93)
      const change = game().menus.partyChangeClass !== undefined && offersChangeClass(engine.cur)
      // Begin is refused once the game is won (CotAB 0x36DCD: ending.after.won set, a party, not the demo);
      // the screen's Exit is offered instead, the original's way out of it
      const won = game().ending.after
      const begin = !(won && engine.read(won.won) !== 0 && party.length && !engine.demo)
      const fns = (['partyCreate', 'partyDrop', 'partyModify', 'partyTrain', ...(change ? ['partyChangeClass'] as const : []), 'partyView', 'partyAdd', 'partyRemove', 'partySave', ...(begin ? ['partyBegin'] as const : ['partyExit'] as const)] as const).map(entry)
      const o = await ask(menu, fns, { prompt: 'Choose a function:' })
      const c = engine.cur
      if (o === 'B' || o === '' || (!begin && o === 'E')) return // with Begin refused, Exit leaves (I: the original's Exit quits to DOS)
      if (o === 'V') await campUi.view()
      else if (o === 'S') await saveGame()
      else if (o === 'C') {
        const made = await tools.create(t)
        if (made) {
          await saveCharacter({ stem: fileStem(nameOf(made)), sav: made, spc: effectsFile(startEffects(made)) })
          print(`${nameOf(made)} has been created. Use Add to put them in the party.`, false)
        }
      } else if (o === 'A') {
        if (party.length >= R.join.members || party.filter((m) => m[F.morale] < 0x80).length >= R.join.pcs) { print('The party is full.', false); continue }
        const inParty = new Set(party.map(nameOf))
        const roster = (await listCharacters()).filter((r) => !inParty.has(nameOf(r.sav)))
        const pick = await tools.chooseFrom('Add character', roster)
        const refused = pick ? joinRefusal(party, pick.sav) : null
        if (refused !== null) { if (refused) print(refused, false); continue }
        if (pick) {
          const added = engine.addMember(pick.sav, pick.itm, pick.spc)
          if (engine.items) recalc(added, engine.itemsOf(added), engine.items)
          print(`${nameOf(added)} joins the party.`, false)
        }
      } else if (o === 'R') {
        if (party.length <= 1) { print('The party needs at least one character.', false); continue }
        await saveCharacter({ stem: fileStem(nameOf(c)), sav: c.slice(), itm: characterItemsFile(engine.itemsOf(c)), spc: effectsFile(engine.effectsOf(c)) })
        engine.dropMember(c)
        print(`${nameOf(c)} leaves the party (still available to Add).`, false)
      } else if (o === 'D') {
        if (party.length <= 1) { print('The party needs at least one character.', false); continue }
        if (await tools.confirm(`${nameOf(c)} will be gone forever. Drop this character?`)) {
          engine.dropMember(c)
          print(`${nameOf(c)} has been dropped.`, false)
        }
      } else if (o === 'M') {
        if ((c[F.xp] | c[F.xp + 1] | c[F.xp + 2] | c[F.xp + 3]) !== 0) print(`${nameOf(c)}${msg('cantModify')}`, false)
        else if (await tools.modify(c)) { if (engine.items) recalc(c, engine.itemsOf(c), engine.items); print(`${nameOf(c)} has been modified.`, false) }
      } else if (o === 'H' && change) {
        // 0x5135D: the classes allowed, or "doesn't qualify"; the change on Select, nothing on Exit
        const choices = changeClassChoices(t, c)
        if (!choices.length) { print(`${nameOf(c)}${msg('doesntQualify')}`, false); continue }
        const exit = word('listExit', 'E').text.trim().toUpperCase()
        const k = await menu([...choices.map((x) => className(x).toUpperCase()), exit], { prompt: msg('pickNewClass'), vertical: true })
        if (k < 0 || k >= choices.length) continue
        changeClass(t, c, choices[k], engine.itemsOf(c), engine.items ?? undefined)
        if (engine.items) recalc(c, engine.itemsOf(c), engine.items)
        drawRoster()
        print(`${nameOf(c)}${msg('nowFirstLevel')}${className(choices[k])}${msg('nowFirstLevelEnd')}`, false)
      } else if (o === 'T') {
        const chk = checkTraining(t, c, engine.read(0x6da8))
        drawRoster()
        if (!chk.ok) { print(chk.message, false); continue }
        print(`${nameOf(c)}${msg('willBecome')}`, true)
        for (const line of willBecome(c, chk.train)) print(line, false)
        if (!(await yes({ menu }, msg('wishToTrain').trimEnd()))) continue
        print(msg('congratulations'), false)
        if (train(t, engine, c, chk.train)) {
          const choices = newSpellChoices(t, c)
          // the original's empty list writes char[0x32] = 1 (max HP 1); skipped here (IMP-028)
          if (choices.length) {
            const st = engine.spells
            const k = await menu(choices.map((id) => (st?.get(id)?.name ?? `#${id}`).toUpperCase()), { prompt: 'Spells to choose from:', vertical: true })
            c[F.known + choices[k]] = 1
          }
        }
        if (engine.items) recalc(c, engine.itemsOf(c), engine.items)
      }
    }
  }

  /** Character sheet with the items menu (spec/A-games/engine/town.md, "Items menu"); IMP-027 for the panel. */
  /** steps of a money Trade or Drop (FUN_4894_2156 / 24a7): recipient, coin type, amount */
  interface MoneyStep { op: 'trade' | 'drop'; to?: number; type?: number }
  /** steps of Use on the sheet: which spell, then whom */
  interface UseStep { scroll: boolean; ids: number[]; spell?: number; combatOnly?: boolean }
  function sheet(c: Character, opts: { selected?: number; message?: string; confirm?: 'drop' | 'trade' | 'sell' | 'id' | 'use' | 'scribe'; use?: UseStep; after?: 'drop' | 'trade' | 'sell'; money?: MoneyStep; combat?: boolean; mode?: 'shop' | 'temple' | 'treasure' | 'vault'; castOn?: number; abilityOn?: Ability } = {}) {
    const node = c.raw
    const t = engine.items
    const items = engine.itemsOf(node)
    const sel = opts.selected ?? -1
    const it = items[sel]
    const str = c.stats.STR === 18 && c.strPct ? `/${String(c.strPct % 100).padStart(2, '0')}` : ''
    // equipment panel (IMP-041): readied items by slot, the rest carried
    const usable = (x: Item) => !!t && ((t.baseOf(x)?.classes ?? 0) & node[F.itemMask]) !== 0
    const wt = (x: Item) => x.weight * Math.max(1, x.count)
    const itemCell = (x: Item | undefined, label: string) => x
      ? `<button class="slot${items.indexOf(x) === sel ? ' sel' : ''}${x.cursed && x.hidden === 0 ? ' cursed' : ''}" data-i="${items.indexOf(x)}"><span class="slot-name">${label}</span>${escape(t!.name(x))}</button>`
      : `<div class="slot empty"><span class="slot-name">${label}</span>—</div>`
    let equipped = '', carried = ''
    if (t) {
      const readied = items.filter((x) => x.ready)
      const bySlot = (n: number) => readied.filter((x) => t.baseOf(x)?.slot === n)
      const placed = new Set<Item>()
      const cells: string[] = []
      SLOT_NAMES.forEach((label, n) => { const x = bySlot(n)[0]; if (x) placed.add(x); cells.push(itemCell(x, label)) })
      const rings = bySlot(9)
      for (let k = 0; k < 2; k++) { if (rings[k]) placed.add(rings[k]); cells.push(itemCell(rings[k], 'Ring')) }
      for (const x of readied) if (!placed.has(x)) cells.push(itemCell(x, x.type === R.itemTypes.arrows || x.type === R.itemTypes.quarrels ? 'Ammunition' : 'Also readied'))
      equipped = cells.join('')
      carried = items.filter((x) => !x.ready).map((x) => {
        const i = items.indexOf(x)
        return `<li><button class="carried${i === sel ? ' sel' : ''}" data-i="${i}" draggable="true" data-drag="${i}"><span>${escape(t.name(x))}</span>
          ${usable(x) ? '' : '<span class="cant">not for this class</span>'}<span class="w">${wt(x)}</span></button></li>`
      }).join('')
    }
    // what readying or unreadying the selected item would change, worked out on copies
    let preview = ''
    if (it && t && !opts.confirm) {
      const cc = node.slice(), copies = items.map((x) => x.copy())
      const target = copies[sel]
      const why = it.ready ? unready(cc, copies, target, t) : ready(cc, copies, target, t)
      const before = parseCharacter(node), after = parseCharacter(cc)
      const diffs = ([['AC', before.ac, after.ac], ['THAC0', before.thac0, after.thac0], ['Damage', before.damage, after.damage], ['Movement', before.movement, after.movement]] as [string, number | string, number | string][])
        .filter(([, x, y]) => x !== y).map(([k, x, y]) => `${k} ${x} → ${y}`)
      const b = t.baseOf(it)
      const info = [b ? `${SLOT_LABEL(b.slot)}` : '', b && b.hands ? `${b.hands} hand${b.hands > 1 ? 's' : ''}` : '', `weight ${wt(it)}`, usable(it) ? '' : 'not usable by this class']
        .filter(Boolean).join(' · ')
      preview = `<div class="item-info"><strong>${escape(t.name(it))}</strong><span class="muted">${escape(info)}</span>
        <span>${why ? `Can't ${it.ready ? 'unready' : 'ready'}: ${escape(why)}` : `${it.ready ? 'Unready' : 'Ready'}: ${diffs.length ? escape(diffs.join(', ')) : 'no change to AC, THAC0, damage or movement'}`}</span></div>`
    }
    const others = engine.party().filter((n) => n !== node)
    let actions = ''
    if (it && t) {
      const store = opts.mode === 'shop' || opts.mode === 'temple'
      if (opts.confirm === 'drop') actions = `<p>Your ${escape(t.name(it))} ${escape(opts.mode === 'vault' ? msg('leftInVault') : 'will be gone forever')}. ${escape(msg('dropIt').trimEnd())}</p>
        ${yesNo('data-a="drop-yes"')}`
      else if (opts.confirm === 'sell') actions = `<p>${escape(msg('illGiveYou'))}${sellOffer(it)}${escape(msg('goldForYour'))}${escape(t.name(it))} ${escape(msg('isItADeal').trimEnd())}</p>
        ${yesNo('data-a="sell-yes"')}`
      else if (opts.confirm === 'id') actions = `<p>${escape(msg('identifyFor'))}${escape(t.name(it))} ${escape(msg('identifyDeal').trimEnd())}</p>
        ${yesNo('data-a="id-yes"')}`
      else if (opts.confirm === 'use' && opts.use) {
        const u = opts.use, st = engine.spells
        if (u.spell === undefined) actions = '<p>Cast which spell?</p>' + u.ids.map((id, k) =>
          `<button data-a="use-spell-${k}">${escape(st?.get(id)?.name ?? `#${id}`)}</button>`).join('') + listExit('data-a="cancel"')
        else if (u.combatOnly) actions = '<p>That Item is a combat-only item... Use it?</p>' + yesNo('data-a="use-waste"')
        else actions = `<p>Cast ${escape(st?.get(u.spell)?.name ?? '')} on:</p>` + engine.party().map((n, k) =>
          `<button data-a="use-on-${k}">${escape(parseCharacter(n).name)}</button>`).join('') + listExit('data-a="cancel"')
      }
      else if (opts.confirm === 'scribe') actions = `<p>${escape(c.name)} was going to scribe from that scroll</p><p>${escape(msg('okayToLose').trimEnd())}</p>
        ${yesNo('data-a="scribe-yes"')}`
      else if (opts.confirm === 'trade') actions = `<p>${escape(msg('tradeWithWhom'))}</p>` + others.map((n, k) =>
        `<button data-a="trade-${k}">${escape(parseCharacter(n).name)}</button>`).join('') + listExit('data-a="cancel"')
      // the items menu's words (FUN_4894_0ef8, CotAB 0x3EAB3): "Ready", " Use", " Trade", " Drop", " Halve", " Join", " Sell", " Id";
      // "Un" before Ready on a readied item is the port's
      else {
        const ready = word('itemReady', 'R')
        actions = wordButton('data-a="ready"', it.ready ? { ...ready, text: ready.text.toLowerCase() } : ready, it.ready ? 'Un' : '') + wordButton('data-a="use"', word('itemUse', 'U')) +
          (others.length ? wordButton('data-a="trade"', word('itemTrade', 'T')) : '') +
          wordButton('data-a="drop"', opts.mode === 'vault' ? word('itemDeposit', 'D') : word('itemDrop', 'D')) + wordButton('data-a="halve"', word('itemHalve', 'H')) + wordButton('data-a="join"', word('itemJoin', 'J')) +
          (store ? wordButton('data-a="sell"', word('itemSell', 'S')) + wordButton('data-a="id"', word('itemId', 'I')) : '')
      }
    }
    const enc = node[F.load] | (node[F.load + 1] << 8), cap = capacity(node)
    const tb = getTables(), xpNext = tb ? xpProgress(tb, node) : null
    const sheetXp = tb ? (xpNext ? xpNext.text.replace(/^[\d,.\s]+XP: /, '') : 'highest level reached') : ''
    // c[0x10F]: Quick (computer control), kept in the record between battles; NPCs are always computer-run
    const quick = node[F.quick] !== 0 && node[F.morale] < 0x80
    dialog.classList.add('wide')
    dialog.innerHTML = `
      <div class="sheet-head"><canvas class="pixel ic sheet-icon" width="24" height="24"></canvas><div>
        <h2>${escape(c.name)}</h2>
        <p>${c.gender} ${c.race} · age ${c.age} · ${c.alignment}<br>${c.cls}${c.levels.length ? ' · level ' + c.levels.map((l) => l.level).join('/') : ''} · ${c.status}</p>
        ${quick ? `<p class="quick-note">On Quick: the computer plays ${escape(c.name)} in battle. ${opts.combat ? 'Space or Take control to play them yourself.' : '<button data-quick="off">Play by hand</button>'}</p>` : ''}
      </div></div>
      <div class="sheet2">
        <section>
          <div class="sheet">
            <table>${STAT_KEYS.map((k) => `<tr><th title="${escape(TIPS[k] ?? '')}">${k}</th><td>${c.stats[k]}${k === 'STR' ? str : ''}</td></tr>`).join('')}</table>
            <table>
              <tr><th title="${escape(TIPS.HP)}">HP</th><td>${c.hp} / ${c.hpMax}</td></tr>
              <tr><th title="${escape(TIPS.AC)}">AC</th><td>${c.ac}</td></tr>
              <tr><th title="${escape(TIPS.THAC0)}">THAC0</th><td>${c.thac0}</td></tr>
              <tr><th title="${escape(TIPS.Damage)}">Damage</th><td>${c.damage}</td></tr>
              <tr><th title="${escape(TIPS.Movement)}">Movement</th><td>${c.movement}</td></tr>
              <tr><th title="${escape(TIPS.Experience)}">Experience</th><td>${c.exp}${sheetXp ? `<small class="muted"> · ${escape(sheetXp)}</small>` : ''}</td></tr>
            </table>
            <table>${MONEY.map((m, i) => `<tr><th>${m}</th><td>${c.money[i]}</td></tr>`).join('')}</table>
          </div>
        </section>
        ${t ? `<section class="gear">
          <h3>Equipped</h3><div class="slots">${equipped}</div>
          <h3>Carried</h3>${carried ? `<ul class="carried-list">${carried}</ul>` : '<p class="muted">Nothing else.</p>'}
          ${carried && others.length ? `<div class="give-strip"><span class="muted">Drag an item onto a name to give it:</span>${others.map((n, k) => `<span class="drop-to" data-to="${k}">${escape(parseCharacter(n).name)}</span>`).join('')}</div>` : ''}
          <div class="enc" title="${escape(TIPS.Load)}"><span>Encumbrance ${enc} of ${cap} coins</span><meter min="0" max="${cap}" high="${Math.round(cap * 0.75)}" value="${enc}"></meter></div>
        </section>` : `<section><p class="muted">Items need the ITEMS file and START.EXE: re-import the ${game().folder} folder.</p></section>`}
      </div>
      ${t ? `${preview}
        ${opts.message ? `<p class="message">${escape(opts.message)}</p>` : ''}
        <div class="item-actions">${actions || (items.length ? '<span class="muted">Pick an item to ready, use, trade or drop it.</span>' : '')}</div>` : ''}
      ${spellsPanel()}
      ${abilitiesPanel()}
      ${moneyPanel()}
      <form method="dialog"><button>Close</button></form>`
    { const p = buildIcon(files, node, false), g = sizeCanvas(dialog.querySelector<HTMLCanvasElement>('canvas.sheet-icon')!, 24, 24)
      g.fillStyle = '#000'; g.fillRect(0, 0, 24, 24); if (p) blit(g, toImageData(p), 0, 0) }
    /**
     * Cast from the sheet (IMP-062), outside battles: the main menu's and camp's Cast (FUN_3f81_04a1)
     * for this character, with its rules: no casting where the area forbids it (ECL 0x49E5), only
     * when Okay, combat-only spells refused, targets by the spell's side byte.
     */
    /** Class abilities (CotAB's paladin Lay on Hands and Cure Disease), outside battles (rules/abilities.ts). */
    function abilitiesPanel(): string {
      const list = abilities(engine, node, !!opts.combat)
      if (!list.length) return ''
      if (opts.abilityOn) return `<div class="ability-actions"><p>${escape(abilityName[opts.abilityOn])}: ${opts.abilityOn === 'layOnHands' ? 'heal' : 'cure'} whom?</p>${engine.party().map((n, k) =>
        `<button data-ab="on-${k}">${escape(parseCharacter(n).name)}</button>`).join('')}<button data-ab="cancel">Cancel</button></div>`
      return `<div class="ability-actions"><h3>Abilities</h3>${list.map((a) => `<button data-ab="use-${a}">${escape(abilityName[a])}</button>`).join('')}</div>`
    }

    function spellsPanel(): string {
      const st = engine.spells
      if (!st || opts.combat) return ''
      const ready = [...new Set(memorised(node).filter((v) => v > 0 && v < 0x80))].map((id) => st.get(id)!).filter((s) => s && mayCast(node, s, false, true))
      if (!ready.length) return ''
      if (opts.castOn !== undefined) {
        const s = st.get(opts.castOn)!
        return `<div class="spell-actions"><p>Cast ${escape(s.name)} on:</p>${engine.party().map((n, k) =>
          `<button data-sp="on-${k}">${escape(parseCharacter(n).name)}</button>`).join('')}<button data-sp="cancel">Cancel</button></div>`
      }
      const why = engine.read(0x49e5) !== 0 ? msg('noCastHere') : node[F.status] !== 0 ? `${c.name} ${msg('noCondition')}${msg('castAny')}` : ''
      const count = (id: number) => memorised(node).filter((v) => v === id).length
      return `<div class="spell-actions"><h3>Spells</h3>${why ? `<p class="muted">${escape(why)}</p>` : ''}${ready.map((s) => {
        const combatOnly = s.side === 0
        const n = count(s.id)
        return `<button data-sp="cast-${s.id}" ${why || combatOnly ? 'disabled' : ''} title="${escape(combatOnly ? 'Only in combat. ' + spellText(s) : spellText(s))}">${escape(s.name)}${n > 1 ? ` ×${n}` : ''}${combatOnly ? ' <small>(combat)</small>' : ''}</button>`
      }).join('')}</div>`
    }
    function moneyPanel(): string {
      // the view menu's Trade and Drop of coins (FUN_4894_0ab3): Trade not in combat, nor for an NPC in play
      const coins = c.money.map((v, i) => ({ v, i })).filter((x) => x.v > 0)
      if (!coins.length || !t) return ''
      const npcInPlay = node[F.morale] >= 0x80 && node[F.inPlay] !== 0 && node[F.status] !== 1
      const canTrade = !opts.combat && !npcInPlay
      const m = opts.money
      if (!m) return `<div class="money-actions">${canTrade ? '<button data-m="trade">Trade money</button>' : ''}<button data-m="drop">${opts.mode === 'vault' ? 'Deposit money' : 'Drop money'}</button></div>`
      const party = engine.party()
      if (m.op === 'trade' && m.to === undefined) return `<div class="money-actions"><p>${escape(msg('tradeTo'))}</p>${party.map((n, k) =>
        `<button data-m="to-${k}">${escape(parseCharacter(n).name)}</button>`).join('')}${listExit('data-m="exit"')}</div>`
      if (m.type === undefined) return `<div class="money-actions"><p>${escape(msg('selectCoin').trimEnd())}</p>${coins.map((x) =>
        `<button data-m="type-${x.i}">${MONEY[x.i]} ${x.v}</button>`).join('')}${listExit('data-m="exit"')}</div>`
      return `<div class="money-actions"><form class="money-amount"><label>${escape(moneyPrompt(m.op, m.type))}<input type="number" min="0" max="${c.money[m.type]}" value="${c.money[m.type]}"></label>
        <button>OK</button>${listExit('type="button" data-m="exit"')}</form></div>`
    }
    const again = (o: { selected?: number; message?: string; confirm?: 'drop' | 'trade' | 'sell' | 'id' | 'use' | 'scribe'; use?: UseStep; after?: 'drop' | 'trade' | 'sell'; money?: MoneyStep; combat?: boolean; castOn?: number; abilityOn?: Ability }) => {
      drawRoster()
      sheet(parseCharacter(node), { ...o, mode: opts.mode, combat: opts.combat })
    }
    dialog.querySelector<HTMLButtonElement>('button[data-quick]')?.addEventListener('click', () => {
      node[F.quick] = 0 // as the battle's Space does for this character (FUN_3334_0fc1), outside a battle (IMP-054)
      again({ message: `${c.name} will be played by hand in battle.` })
    })
    dialog.querySelectorAll<HTMLButtonElement>('.ability-actions button').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.ab!
      if (a === 'cancel') return again({})
      if (a.startsWith('use-')) return again({ abilityOn: a.slice(4) as Ability })
      if (a.startsWith('on-') && opts.abilityOn) {
        const t = engine.party()[Number(a.slice(3))]
        // Cure Disease on someone not diseased: "is not diseased", then "cure anyway"
        if (opts.abilityOn === 'cureDisease' && !diseased(engine, t) && !confirm(`${parseCharacter(t).name} is not diseased. Cure anyway?`)) return again({})
        const out = useAbility(new WorldHost(engine), engine, node, opts.abilityOn, t)
        for (const m of out) print(m, false)
        again({ message: out.join(' ') })
      }
    }))
    dialog.querySelectorAll<HTMLButtonElement>('.spell-actions button').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.sp!, st = engine.spells
      if (!st) return
      if (a === 'cancel') return again({})
      const go = (s: NonNullable<ReturnType<typeof st.get>>, targets: Uint8Array[]) => {
        void castOutside(engine, node, s, targets).then((out) => {
          for (const m of out) print(m, false)
          again({ message: out.join(' ') })
        })
      }
      if (a.startsWith('cast-')) {
        const s = st.get(Number(a.slice(5)))!
        const kind = targetKind(s)
        if (kind === 'one') return again({ castOn: s.id })
        go(s, kind === 'party' ? engine.party() : [node])
      } else if (a.startsWith('on-') && opts.castOn !== undefined) {
        go(st.get(opts.castOn)!, [engine.party()[Number(a.slice(3))]])
      }
    }))
    // drag a carried item onto a party member's name: the Trade action without the menu (IMP-059)
    dialog.querySelectorAll<HTMLElement>('[data-drag]').forEach((el) => el.addEventListener('dragstart', (ev) => {
      ev.dataTransfer?.setData('text/plain', el.dataset.drag!)
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    }))
    dialog.querySelectorAll<HTMLElement>('.drop-to').forEach((el) => {
      el.addEventListener('dragover', (ev) => { ev.preventDefault(); el.classList.add('over') })
      el.addEventListener('dragleave', () => el.classList.remove('over'))
      el.addEventListener('drop', (ev) => {
        ev.preventDefault()
        el.classList.remove('over')
        const x = items[Number(ev.dataTransfer?.getData('text/plain'))]
        if (!x || !t) return
        const why = unavailable(x)
        if (why) return again({ selected: items.indexOf(x), message: why })
        if (scribing(x, t)) return again({ selected: items.indexOf(x), message: 'That scroll is marked for scribing: use Trade to give it.' })
        const to = others[Number(el.dataset.to)]
        const m = trade({ c: node, items }, { c: to, items: engine.itemsOf(to) }, x, t)
        again(m ? { message: m } : { message: `Traded to ${parseCharacter(to).name}.` })
      })
    })
    dialog.querySelectorAll<HTMLButtonElement>('.gear [data-i]').forEach((r) =>
      r.addEventListener('click', () => again({ selected: Number(r.dataset.i) === sel ? -1 : Number(r.dataset.i) })))
    dialog.querySelectorAll<HTMLButtonElement>('.item-actions button').forEach((b) => b.addEventListener('click', () => {
      if (!it || !t) return
      const a = b.dataset.a!
      const keep = items.indexOf(it)
      if (a === 'ready') {
        // item handlers (Gauntlets of Ogre Power, alignment-locked weapons, rings and cloaks) run here
        const said: string[] = []
        const host = new WorldHost(engine, (m) => said.push(m))
        void (it.ready ? unreadyItem(host, node, items, it, t) : readyItem(host, node, items, it, t))
          .then((m) => again({ selected: keep, message: [m, ...said].filter(Boolean).join(' ') }))
      } else if (a === 'use' || a.startsWith('use-')) {
        // Use outside combat (FUN_4894_1a8a); it does not end anything (spec/A-games/engine/town.md, "Items menu")
        const st = engine.spells
        if (!it.ready) { again({ selected: keep, message: msg('mustBeReadied') }); return }
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
        // CotAB 0x3FADB: who may read a scroll; "oops!" and nothing cast; outside battle the scroll is kept (View clears the result, 0x3E0BA)
        if (u.scroll && !readsScroll(node, (n, sd) => engine.roll(n, sd))) { again({ selected: keep, message: `${c.name} ${msg('scrollOops')}` }); return }
        print(`${c.name} ${msg('usesItem')}`, false)
        void castOutside(engine, node, s, targets, true).then((out) => {
          spendUse(items, it, u.scroll, s.id)
          for (const m of out) print(m, false)
          again({ selected: Math.min(keep, items.length - 1), message: out.join(' ') })
        })
      }
      else if (a === 'scribe-yes') again({ selected: keep, confirm: opts.after, after: opts.after })
      else if (a === 'trade') {
        const why = unavailable(it)
        if (!why && scribing(it, t) && !opts.after) return again({ selected: keep, confirm: 'scribe', after: 'trade' })
        again(why ? { selected: keep, message: why } : { selected: keep, confirm: 'trade' })
      } else if (a.startsWith('trade-')) {
        const to = others[Number(a.slice(6))]
        const m = trade({ c: node, items }, { c: to, items: engine.itemsOf(to) }, it, t)
        again(m ? { selected: keep, message: m } : { message: `Traded to ${parseCharacter(to).name}.` })
      } else if (a === 'drop') {
        const why = unavailable(it)
        if (!why && scribing(it, t) && !opts.after) return again({ selected: keep, confirm: 'scribe', after: 'drop' })
        again(why ? { selected: keep, message: why } : { selected: keep, confirm: 'drop' })
      } else if (a === 'drop-yes') {
        // in the vault (game mode 8, 0x4357E) a dropped item is deposited: it goes into the pile
        if (opts.mode === 'vault') { items.splice(items.indexOf(it), 1); it.ready = false; engine.treasure.push(it); recalc(node, items, t); return again({}) }
        const m = drop(node, items, it, t)
        again({ message: m })
      } else if (a === 'sell') {
        const why = unavailable(it) || (node[F.morale] >= 0x80 && node[F.inPlay] ? 'NPCs cannot sell' : '')
        if (!why && scribing(it, t) && !opts.after) return again({ selected: keep, confirm: 'scribe', after: 'sell' })
        again(why ? { selected: keep, message: why } : { selected: keep, confirm: 'sell' })
      } else if (a === 'sell-yes') {
        const offer = sellOffer(it)
        items.splice(items.indexOf(it), 1)
        const m = receive(node, items, engine.money, offer, t)
        again({ message: m || msg('sold') })
      } else if (a === 'id') again({ selected: keep, confirm: 'id' })
      else if (a === 'id-yes') {
        if (!pay(node, engine.money, R.identifyFee, t, items)) again({ selected: keep, message: msg('idNoMoney') })
        else if (it.hidden === 0) again({ selected: keep, message: `${msg('nothingNew')}${t.name(it)}` })
        else { it.hidden = 0; again({ selected: keep, message: `${msg('looksLike')}${t.name(it)}` }) }
      } else if (a === 'halve') again({ selected: keep, message: halve(node, items, it, t) })
      else if (a === 'join') {
        const n = join(node, items, it, t)
        again({ selected: items.indexOf(it), message: n ? '' : 'Nothing to join.' })
      } else again({ selected: keep })
    }))
    dialog.querySelectorAll<HTMLButtonElement>('.money-actions [data-m]').forEach((b) => b.addEventListener('click', () => {
      const d = b.dataset.m!, m = opts.money
      if (d === 'exit') return again({})
      if (d === 'trade' || d === 'drop') return again({ money: { op: d } })
      if (d.startsWith('to-') && m) return again({ money: { ...m, to: Number(d.slice(3)) } })
      if (d.startsWith('type-') && m) return again({ money: { ...m, type: Number(d.slice(5)) } })
    }))
    dialog.querySelector<HTMLFormElement>('form.money-amount')?.addEventListener('submit', (ev) => {
      ev.preventDefault()
      const m = opts.money
      if (!m || m.type === undefined || !t) return
      const n = Math.max(0, Math.floor(Number(dialog.querySelector<HTMLInputElement>('form.money-amount input')!.value) || 0))
      let message = ''
      if (m.op === 'trade') {
        const to = engine.party()[m.to ?? 0]
        message = tradeMoney(node, items, to, engine.itemsOf(to), m.type, n, t)
      } else {
        const pool = opts.mode === 'shop' || opts.mode === 'temple' || opts.mode === 'treasure' || opts.mode === 'vault' ? engine.money : null
        dropMoney(node, items, m.type, n, pool, t)
      }
      // back to the coin list while there is money left (the original loops)
      const left = moneyOf(node).some((v) => v > 0)
      again(left ? { money: { op: m.op, to: m.to }, message } : { message })
    })
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
  const asCanvas = (img: ImageData) => pixels(img)
  /** Tile id 1-255: frame id-1 of SQRPACI #1 (ids 1-128) or #2 (129-255). */
  function tilePicture(id: number): Picture | null {
    const f = id - 1
    const raw = files.record('SQRPACI', f > 127 ? 2 : 1)
    try { return raw ? parseRecord(raw).frames[f & 127].picture : null } catch { return null }
  }
  /** the cleansed river tiles, recoloured as far as the cleansing has gone (FUN_1464_1e5c) */
  const riverPics = new Map<number, Picture>()
  function recolour(id: number, all: boolean) {
    const map = Overland.CLEANSED.get(id)
    let p = riverPics.get(id)
    if (!p) { const base = tilePicture(id); if (!base || !map) return; p = { ...base, pixels: base.pixels.slice() }; riverPics.set(id, p) }
    // a partial pass takes one matching pixel in four (Random(4) = 0)
    for (let i = 0; i < p.pixels.length; i++) {
      const to = map!.get(p.pixels[i])
      if (to !== undefined && (all || Math.random() < 0.25)) p.pixels[i] = to
    }
    tileCache.delete(id)
  }
  function wildTile(id: number): HTMLCanvasElement | null {
    if (!riverPics.has(id) && engine.read(0x4aa2) !== 0 && Overland.CLEANSED.has(id)) recolour(id, true) // reapplied on load
    if (!tileCache.has(id)) {
      const p = riverPics.get(id) ?? tilePicture(id)
      let c: HTMLCanvasElement | null = null
      try { if (p) c = asCanvas(toImageData(p)) } catch { /* missing frame */ }
      tileCache.set(id, c)
    }
    return tileCache.get(id)!
  }
  /** FUN_4804_06b3(1): nine partial passes while the view moves down the river, then a full one */
  async function cleanseRiver() {
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
    if (!engine.wild) return
    showView(false)
    wildview.hidden = false
    drawWild([17, 15])
    if (!reducedMotion()) for (const at of Overland.CLEANSING_VIEW) {
      for (const id of Overland.CLEANSED.keys()) recolour(id, false)
      drawWild(at)
      await sleep(150)
    }
    for (const id of Overland.CLEANSED.keys()) recolour(id, true)
    drawWild([23, 25])
    await sleep(engine.speed * 225)
    await sleep(engine.speed * 225)
  }
  /** The party marker: ICON records 0, 128, 1, 129, 2, 130 in turn, colour 0 transparent. */
  const partyFrames: HTMLCanvasElement[] = []
  for (const r of [0, 128, 1, 129, 2, 130]) {
    const raw = files.record('ICON', r)
    try { if (raw) partyFrames.push(asCanvas(spriteImage(parseRecord(raw).frames[0].picture))) } catch { /* missing */ }
  }
  let partyPhase = 0
  /** The 5x5 view (FUN_54cf_0000, FUN_54fa_0000); the marker advances a frame per redraw. */
  function drawWild(at?: [number, number]) {
    const w = engine.wild
    if (!w) return
    const g = sizeCanvas(wildview, 120, 120)
    const [gx, gy] = at ?? engine.wildPosition
    const { x0, y0, col, row } = Overland.window(gx, gy)
    g.fillStyle = '#000'
    g.fillRect(0, 0, 120, 120)
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const t = wildTile(w.tile(x0 + c, y0 + r, (a) => engine.read(a)))
      if (t) blitCanvas(g, t, c * 24, r * 24)
    }
    const p = partyFrames[partyPhase % partyFrames.length]
    partyPhase = (partyPhase + 1) % 6
    if (!p) return
    g.save()
    if (engine.facing2 > 3) { // facing south or west: mirrored
      g.translate(col * 24 + 24, row * 24)
      g.scale(-1, 1)
      blitCanvas(g, p, 0, 0)
    } else blitCanvas(g, p, col * 24, row * 24)
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
  /** set while a battle runs: Quick and Magic (IMP-054) */
  let battleControls: BattleControls | null = null
  const takeBtn = app.querySelector<HTMLButtonElement>('.take-control')!
  const magicBtn = app.querySelector<HTMLButtonElement>('.magic-toggle')!
  function drawControls() {
    const st = battleControls?.state()
    takeBtn.hidden = !st?.quick
    magicBtn.hidden = !st
    if (st) {
      magicBtn.textContent = `Magic: ${st.magic ? 'On' : 'Off'}`
      magicBtn.classList.toggle('on', st.magic)
      magicBtn.title = `Alt-M. ${st.magic ? 'Characters on Quick may cast spells; click to stop them' : 'Characters on Quick will not cast spells; click to allow it'}`
    }
  }
  /** set while a battle runs: debug "Win this battle" */
  let winBattle: (() => void) | null = null
  function debugMenu() {
    const finale = game().debug.finale
    const pos = engine.overland ? `wilderness ${engine.wildPosition.join(',')}` : `${engine.x},${engine.y} facing ${FACING[engine.facing]}`
    dialog.innerHTML = `<h2>Debug</h2>
      <p class="muted">Not part of the game. Now: block ${engine.block}, area ${engine.area}, ${pos}.</p>
      ${winBattle ? `<p><button class="primary" data-win="1">Win this battle</button> <span class="muted">every enemy falls; experience and treasure as for a won fight</span></p>
      <form method="dialog"><button>Close</button></form>` : `
      <p><button type="button" data-edit="1">Edit characters…</button> <span class="muted">abilities, HP, experience, levels, money, items</span></p>
      ${finale ? `<p><button type="button" data-finale="ending">Play the ending</button> <button type="button" data-finale="fight">Fight ${escape(finale.foe)}</button>
        <span class="muted">${escape(finale.note)}</span></p>` : ''}
      <ul class="debug">${game().debug.jumps.map((j, i) => `<li><button data-i="${i}">${escape(j.label)}</button></li>`).join('')}</ul>
      <form class="jump">
        <label>Block <input name="block" type="number" min="1" max="8" value="${engine.block}"></label>
        <label>Area <input name="area" type="number" min="0" max="63" value="${engine.area}"></label>
        <label>X <input name="x" type="number" min="0" max="43" value="0"></label>
        <label>Y <input name="y" type="number" min="0" max="35" value="0"></label>
        <label>Facing <select name="facing">${FACING.map((f, i) => `<option value="${i}">${f}</option>`).join('')}</select></label>
        <button>Jump</button>
      </form>
      ${game().view.tileOverland.length ? `<p class="muted">For areas ${game().view.tileOverland.join(', ')} (wilderness), X and Y are the area's own position (0–12 across).</p>` : ''}
      <form method="dialog"><button>Close</button></form>`}`
    const go = (to: [number, number, number, number, number]) => {
      dialog.close()
      if (!files.record(`ECL${to[0]}`, to[1])) { note(`There is no area ${to[1]} in block ${to[0]}.`); return }
      note(`Debug: jumping to block ${to[0]}, area ${to[1]}.`)
      act(() => engine.jump(...to))
    }
    dialog.querySelector<HTMLButtonElement>('button[data-win]')?.addEventListener('click', () => {
      dialog.close()
      note('Debug: battle skipped as won.')
      winBattle?.()
    })
    // the finale (games/debug.ts): the final area, then the script of the battle or of what follows a win
    dialog.querySelectorAll<HTMLButtonElement>('button[data-finale]').forEach((b) => b.addEventListener('click', () => {
      if (!finale) return
      dialog.close()
      const fight = b.dataset.finale === 'fight'
      note(fight ? `Debug: the battle with ${finale.foe}.` : `Debug: the ending, as after ${finale.foe} falls.`)
      act(async () => {
        await engine.jump(...finale.at)
        await engine.run(fight ? finale.fight : finale.ending)
        // the script goes on after PROGRAM 8 (PoR: the walk back to New Phlan, NEW_ECL); enter where it
        // left the party, as the main loop would
        if (!engine.quit) await engine.enter()
      })
    }))
    dialog.querySelector<HTMLButtonElement>('button[data-edit]')?.addEventListener('click', () => {
      dialog.close()
      void editCharacters(dialog, engine, getTables(), () => drawRoster())
    })
    dialog.querySelectorAll<HTMLButtonElement>('ul.debug button').forEach((b) => b.addEventListener('click', () => go(game().debug.jumps[Number(b.dataset.i)].to)))
    const f = dialog.querySelector<HTMLFormElement>('form.jump')
    f?.addEventListener('submit', (e) => {
      e.preventDefault()
      const v = (n: string) => Number((f!.elements.namedItem(n) as HTMLInputElement).value) || 0
      go([v('block'), v('area'), v('x'), v('y'), v('facing')])
    })
    dialog.showModal()
  }

  // ------------------------------------------------------------ commissions
  /** commissions the clerk has offered, and whether the proclamation wall was read (IMP-023) */
  const known = new Set<string>(start.kind === 'load' ? start.known ?? [] : [])
  /** the loaded sidecar's fields this build does not know, written back with every save (storage.md §6) */
  const sidecarExtra = start.kind === 'load' ? start.sidecar : undefined
  const commissionReport = () => report((a) => engine.read(a), known)
  function commissionsDue(): boolean {
    if (!game().commissions) return false
    const r = commissionReport()
    return r.bounty > 0 || r.lines.some((l) => l.state === 'reward' || l.state === 'summoned')
  }
  const STATE_LABEL: Record<State, string> = { reward: 'Reward due', summoned: 'Summoned', open: 'Open', failed: 'Failed', closed: 'Closed' }
  // ------------------------------------------------------------ journal (IMP-055)
  let journalTab: 'journal' | 'proclamations' | 'tales' | 'background' = 'journal'
  let journalAll = false
  function journal() {
    const paras = (t: string) => t.split(/\n{2,}/).map((p) => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`).join('')
    const has = (id: string) => journalAll || known.has(id)
    const base = import.meta.env.BASE_URL
    const render = () => {
      const entries = JOURNAL.journal.filter((j) => has(`journal:${j.n}`))
      const procs = JOURNAL.proclamations.filter((p) => has(`proc:${p.id}`)).sort((a, b) => roman(a.id) - roman(b.id))
      const tales = JOURNAL.tales.filter((t) => has(`tale:${t.n}`))
      const bg = JOURNAL.background ?? []
      // a tab only for what the game's journal has (CotAB has no proclamations; background is read from the start)
      if ((journalTab === 'proclamations' && !JOURNAL.proclamations.length) || (journalTab === 'background' && !bg.length)) journalTab = 'journal'
      const tab = (k: typeof journalTab, label: string, n: number, of: number) => !of ? '' :
        `<button type="button" data-tab="${k}" class="${journalTab === k ? 'on' : ''}">${label} (${n}${journalAll || k === 'background' ? '' : ` of ${of}`})</button>`
      const empty = JOURNAL.empty ?? {}
      let body = ''
      if (journalTab === 'journal') body = entries.map((j) => `<article><h3>Journal entry ${j.n}</h3>${paras(j.text)}${j.images.map((src) =>
        `<img class="journal-map" src="${base}${src}" alt="Map from journal entry ${j.n}" loading="lazy">`).join('')}</article>`).join('')
        || `<p class="muted">${escape(empty.journal ?? 'Nothing yet.')}</p>`
      else if (journalTab === 'proclamations') body = procs.map((p) => `<article><h3>Proclamation ${p.id}</h3><p class="muted">${escape(JOURNAL.preface)}</p>${paras(p.text)}</article>`).join('')
        || `<p class="muted">${escape(empty.proclamations ?? 'Nothing yet.')}</p>`
      else if (journalTab === 'background') body = bg.map((b) => `<article><h3>${escape(b.title)}</h3>${paras(b.text)}</article>`).join('')
      else body = tales.map((t) => `<article><h3>Tavern tale ${t.n}</h3>${paras(t.text)}</article>`).join('')
        || `<p class="muted">${escape(empty.tales ?? 'Nothing yet.')}</p>`
      const maps = JOURNAL.journal.some((j) => j.images.length)
      dialog.innerHTML = `<h2>Journal</h2>
        <div class="nc-opts">${tab('journal', 'Entries', entries.length, JOURNAL.journal.length)}${tab('proclamations', 'Proclamations', procs.length, JOURNAL.proclamations.length)}${tab('tales', 'Tavern tales', tales.length, JOURNAL.tales.length)}${tab('background', 'Background', bg.length, bg.length)}</div>
        <div class="journal">${body}</div>
        <p class="muted"><label><input type="checkbox" data-all="1"${journalAll ? ' checked' : ''}> Show everything, like the printed journal (some entries are false; the original asked you not to read ahead)</label></p>
        <p class="muted small">Text${maps ? ' and maps' : ''} from the <a href="${JOURNAL.source.journal}" target="_blank" rel="noopener">${escape(JOURNAL.source.name ?? '')}</a>, CC BY-SA.</p>
        <form method="dialog"><button>Close</button></form>`
    }
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
      if (b) { journalTab = b.dataset.tab as typeof journalTab; render() }
    }
    const onChange = (e: Event) => {
      const c = e.target as HTMLInputElement
      if (c.dataset.all) { journalAll = c.checked; render() }
    }
    dialog.addEventListener('click', onClick)
    dialog.addEventListener('change', onChange)
    onClose(dialog, () => { dialog.removeEventListener('click', onClick); dialog.removeEventListener('change', onChange) })
    render()
    dialog.showModal()
  }

  function commissions() {
    const r = commissionReport()
    const rows = r.lines.map((l) => `<li class="${l.state}"><span class="state">${STATE_LABEL[l.state]}</span>
      <span>${escape(l.title)}${l.detail ? `<small>${escape(l.detail)}</small>` : ''}${l.progress ? `<small class="progress">${escape(l.progress)}</small>` : ''}</span></li>`).join('')
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
      if (engine.quit) note('The game has ended here: ☰ Menu, Quit to the party screen, to start again.')
      commandBar()
      // autosave between actions, never inside a script: on every area change, else at most every 30 s
      const where = `${engine.block}:${engine.area}`
      if (where !== autosavedAt || Date.now() - lastAutosave > 30_000) { lastAutosave = Date.now(); void autosave(where !== autosavedAt ? 'new area' : 'on the way') }
      if (queuedMove) { const q = queuedMove; queuedMove = null; if (!pending && !dialog.open && !engine.quit) setTimeout(() => move(q), 0) }
    }
  }
  let lastAutosave = Date.now()

  function commandBar() {
    if (engine.demo) { // the demo takes no commands; it can be left (IMP-074)
      menuBar.innerHTML = '<button class="primary" data-cmd="leave" title="Escape: back to the party screen">Leave demo</button>'
      menuBar.querySelector('button')!.addEventListener('click', () => leaveDemo())
      app.querySelector('.game')!.classList.add('demo') // no movement pad, no Debug
      return
    }
    pad.classList.remove('disabled')
    // View and Area are left out (IMP-061): a party card opens the sheet, the map is on screen; the
    // keys V and A still work, and Area shows where the map is hidden (phones held sideways)
    // the game's words (its main menu, PoR FUN_3e76_0989, CotAB 0x2F7EF: "Area Cast View Encamp Search Look")
    menuBar.innerHTML = ['A', 'E', 'S', 'L'].map((k) => word('main', k))
      .map(({ text: c, key: k }) => { const j = Math.max(0, c.toUpperCase().indexOf(k))
        return `<button data-cmd="${k}" class="${k === 'A' ? 'area-only' : ''}${k === 'S' && engine.B[0x6dca - 0x6b00] & 1 ? ' on' : ''}">${escape(c.slice(0, j))}<u>${escape(c[j] ?? '')}</u>${escape(c.slice(j + 1))}</button>` }).join('') +
      // everything that is not a game command sits behind ☰ (IMP-057)
      `<button class="menu-btn" data-cmd="menu" title="Journal, commissions, save, settings, rules, quit (Esc)">☰ Menu${commissionsDue() ? ' <span class="due">•</span>' : ''}</button>`
    menuBar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => command(b.dataset.cmd!)))
  }

  /** a move pressed while the last one was still sliding: done as soon as that step is over (IMP-066) */
  let queuedMove: string | null = null
  function move(c: string) {
    if (engine.quit) return
    if (busy) {
      // pressing faster than the slide: finish it now and take this move next
      if (animDone && !pending && !dialog.open) { world?.finish(); queuedMove = c }
      return
    }
    if (engine.overland) {
      // the arrows are compass directions in the wilderness (FUN_3e76_0989)
      if (!engine.wild) { note(`Wilderness travel needs START.EXE: re-import the ${game().folder} folder.`); return }
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
      case 'C': sheet(parseCharacter(engine.cur)); break // Cast is on the sheet (IMP-062)
      case 'E': act(() => engine.command('e')); break
      case 'L': act(() => engine.command('L')); break
      case 'settings':
        void openSettings(dialog, { speed: { get: () => engine.speed, set: (v) => { engine.speed = v } }, changed: () => { commandBar(); applyView() } })
        break
      case 'commissions': commissions(); break
      case 'journal': journal(); break
      case 'save': act(() => saveGame()); break
      case 'debug': debugMenu(); break
      case 'account': openAccount(dialog); break
      case 'assets': quitAsk(); break
      case 'menu': mainMenu(); break
      case 'rules': void rulesReference(dialog, engine.spells); break
    }
  }

  /** ☰ (IMP-057): the port's own pages and the things around the game. */
  function mainMenu() {
    const due = commissionsDue()
    const found = [...known].filter((k) => /^(journal|tale|proc):/.test(k)).length
    const item = (cmd: string, label: string, note: string) => `<li><button data-go="${cmd}">${label}<small>${note}</small></button></li>`
    dialog.innerHTML = `<h2>Menu</h2>
      <ul class="mainmenu">
        ${!JOURNAL.journal.length ? '' : item('journal', 'Journal', found ? `${found} found` : JOURNAL.proclamations.length ? 'entries, proclamations and tavern tales' : 'entries and tavern tales')}
        ${!game().commissions ? '' : item('commissions', `Commissions${due ? ' <span class="due">•</span>' : ''}`, due ? 'a reward is waiting' : 'the City Council\'s commissions and progress')}
        ${accountStatus().available ? item('account', accountLabel(), accountStatus().user ? 'your saves on the server, sync, password' : 'keep your saves on the server and play on any device') : ''}
        ${item('save', 'Save', 'any time, slots A–J')}
        ${item('settings', 'Settings', 'speed, sound, font, borders, motion, text size, graphics')}
        ${item('rules', 'Rules reference', 'classes, races, abilities, combat numbers, spells')}
        ${item('debug', 'Debug', 'not part of the game')}
        ${item('assets', 'Quit to the party screen', '')}
      </ul>
      <form method="dialog"><button>Back to the game</button></form>`
    dialog.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
      dialog.close()
      const go = b.dataset.go!
      setTimeout(() => command(go), 0)
    }))
    dialog.showModal()
  }

  const keys: Record<string, string> = {
    ArrowUp: 'f', '8': 'f', ArrowLeft: 'l', '4': 'l', ArrowRight: 'r', '6': 'r', ArrowDown: 'b', '2': 'b',
  }
  const onKey = (e: KeyboardEvent) => {
    unlockAudio()
    if (engine.demo && !dialog.open && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // the demo: Escape leaves it (IMP-074); another key cuts a pause short (IMP-012)
      if (e.key === 'Escape') { e.preventDefault(); leaveDemo() }
      else if (skipPause && !battleInput.key) { e.preventDefault(); skipPause() }
      return
    }
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
      // a key chooses the choice it is a hot key of (the last one, as FUN_53aa_03bd's scan), else the first letter
      const K = e.key.toUpperCase(), keys = pending.keys
      const hot = (j: number) => keys?.[j] || (items[j][0]?.toUpperCase() ?? '')
      const i = K.length !== 1 ? -1 : keys ? items.reduce((f, _, j) => (hot(j).includes(K) ? j : f), -1) : items.findIndex((_, j) => hot(j) === K)
      if (i >= 0) { e.preventDefault(); choose(i) }
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= items.length) { e.preventDefault(); choose(Number(e.key) - 1) }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); command('menu'); return }
    if (keys[e.key]) {
      e.preventDefault()
      move(keys[e.key])
    } else if (e.key.length === 1 && 'ACVESL'.includes(e.key.toUpperCase())) {
      e.preventDefault()
      command(e.key.toUpperCase())
    }
  }
  window.addEventListener('keydown', onKey)
  // a View setting that comes with the account applies at once, as the settings panel's does
  const stopSettings = onSettingsPulled(() => applyView())
  pad.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => move(b.dataset.c!)))
  app.addEventListener('pointerdown', unlockAudio)
  // a tap on the view: left third turns left, right third right, the middle steps forward
  const viewTap = (e: PointerEvent) => {
    if (skipPause && !pending) return skipPause()
    if (pending && pending.items.length === 1) return choose(0)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    move(fx < 1 / 3 ? 'l' : fx > 2 / 3 ? 'r' : 'f')
  }
  canvas.addEventListener('pointerup', viewTap)
  drawn.addEventListener('pointerup', viewTap)
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
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    if (!row || (!townMode && (busy || pending))) return
    const c = engine.nodes[Number(row.dataset.i)]
    // a tap selects; a tap on the selected character opens the sheet (IMP-045)
    if (c === engine.cur) { if (!dialog.open) sheet(parseCharacter(c)) }
    else {
      engine.cur = engine.savedCur = c
      drawRoster()
    }
  })

  let running = true
  function resize() {
    if (!world) return
    const r = canvas.getBoundingClientRect()
    world.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)))
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()
  const loop = (now: number) => {
    if (!running) return
    if (world && !drawnMode) world.frame(now)
    if (animDone && !(world && !drawnMode && world.busy())) {
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

  /** Quit to the party screen, asked first: what happened since the last autosave or save is lost (a game already over, or the demo, goes at once). */
  function quitAsk() {
    if (engine.quit || engine.demo) { leave(); return }
    const ago = Math.max(0, Math.round((Date.now() - lastAutosave) / 1000))
    dialog.innerHTML = `<h2>Quit</h2><p>Quit to the party screen? The game was last saved automatically ${ago} s ago; anything since then is lost unless you save first.</p>
      <form method="dialog" class="yn">${wordButton('value="y" class="primary"', word('yesNo', 'Y'))}${wordButton('value="n"', word('yesNo', 'N'))}</form>`
    onClose(dialog, () => { if (dialog.returnValue === 'y') leave() })
    dialog.showModal()
  }

  function leave() {
    stopAnimation()
    running = false
    observer.disconnect()
    window.removeEventListener('keydown', onKey)
    stopSettings()
    world?.renderer.dispose()
    back()
  }

  commandBar()
  sync(0)
  if (start.kind === 'demo') {
    // the demo (CotAB 0x1C061): its on_enter, then back to the start-up loop; nothing is saved
    note('The demo. Escape or Leave demo goes back to the party screen.')
    busy = true
    void (async () => {
      try { await engine.runDemo() } catch (err) {
        if (!(err instanceof DemoLeft)) { note(`Script error: ${(err as Error).message}`); return } // left by Leave demo
      }
      if (!demoLeft) { demoLeft = true; leave() }
    })()
    return
  }
  if (start.kind === 'new') note('A new game: Begin Adventuring from the party screen.')
  else note(`Loaded: ${start.label}.`)
  if (start.kind === 'load') { const n = newerSidecarNote(start.sidecar); if (n) note(n) }
  act(() => engine.start())
}
