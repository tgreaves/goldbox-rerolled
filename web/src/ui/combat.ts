// The battle screen: the battlefield in the view panel, combat menus in the command bar, movement by
// arrow keys or by tapping a neighbouring cell, aiming from a list or by tapping (IMP-033).
import type { Engine } from '../vm/engine'
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, type Picture } from '../data/image'
import { buildIcon } from '../render/icon'
import { CombatView, type Figure, type Sprite } from '../render/combatview'
import { F } from '../games/fields'
import type { SoundMode } from '../games/sound'
import { Line, cycle, fight, footprint, type AimEntry, type Battle, type CombatUi, type Fighter, type Flight, type SpriteFrame } from '../rules/combat'

export interface BattleScreen {
  engine: Engine
  files: GameFiles
  canvas: HTMLCanvasElement
  menu(items: string[], opts?: { prompt?: string; vertical?: boolean; notes?: string[] }): Promise<number>
  print(text: string, clear?: boolean): void
  /** a skippable wait (a click, tap or key ends it early) */
  pause(ms: number): Promise<void>
  view(c: Uint8Array): Promise<void>
  sound(n: number, mode: SoundMode): void
  /** set while a step or aim waits for a tap or key; the screen routes input here */
  input: { key?: (e: KeyboardEvent) => boolean; tap?: (e: MouseEvent) => void; hover?: (e: MouseEvent) => void }
  refreshRoster(): void
  /** dismiss a menu that a key or tap answered instead */
  cancelMenu(): void
  /** a box over the battlefield for the combatant pointed at (IMP-044) */
  info?: HTMLElement
  /** the turn-order strip (IMP-044) */
  strip?: HTMLElement
  /** receives the battle's Quick and Magic controls (null when the battle ends) */
  onControls?(c: BattleControls | null): void
  /** the state behind those controls may have changed: redraw the buttons */
  controlsChanged?(): void
  /** debug (IMP-025): receives the function that wins the battle at once */
  onSkip?(win: (() => void) | null): void
}

/** Quick and Magic for the screen's buttons (IMP-054) */
export interface BattleControls {
  /** Space: every party member on Quick comes back under the player's control */
  takeControl(): void
  /** Alt-M: whether party members on Quick may cast */
  toggleMagic(): void
  state(): { quick: boolean; magic: boolean }
}

const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
const s8 = (v: number) => (v << 24) >> 24
const nameOf = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))

/** How a combatant looks (IMP-044): the party's HP exactly, monsters only roughly. */
function condition(b: Battle, f: Fighter): string {
  const c = f.c, hp = c[F.hp], max = Math.max(1, c[F.maxHp])
  const status = ['', 'animated', '', 'running', 'unconscious', 'dying', 'dead', 'stoned', 'gone'][c[F.status]] ?? ''
  const fx = b.effectsOf(c).map((e) => e.type)
  const extra = [fx.some((t) => [31, 51, 52, 53].includes(t)) ? 'helpless' : '', fx.includes(0x1e) ? 'coughing' : '', fx.includes(0x0b) ? 'charmed' : '']
  if (!f.monster) return [`HP ${hp}/${max}`, status, ...extra].filter(Boolean).join(', ')
  const r = hp / max
  const health = status || (r >= 1 ? 'unhurt' : r > 0.66 ? 'lightly wounded' : r > 0.33 ? 'wounded' : 'badly wounded')
  return [health, ...extra].filter(Boolean).join(', ')
}

const KEY_DIRS: Record<string, number> = {
  ArrowUp: 0, '8': 0, PageUp: 1, '9': 1, ArrowRight: 2, '6': 2, PageDown: 3, '3': 3,
  ArrowDown: 4, '2': 4, End: 5, '1': 5, ArrowLeft: 6, '4': 6, Home: 7, '7': 7,
}

export async function runBattle(s: BattleScreen) {
  const e = s.engine
  let battle: Battle | null = null
  let view: CombatView | null = null
  let focus = { row: 12, col: 25 }
  let marks: { row: number; col: number; colour: string; fill?: string }[] = []
  let acting: Fighter | null = null
  /** combatants shown in their action frame, and COMSPR sprites over the battlefield (spec/A-games/engine/combat-visuals.md, "Combat visuals") */
  const poses = new Set<Fighter>()
  /** combatants already out of play whose skull is still queued, and where they stood */
  const falling = new Map<Fighter, { x: number; y: number }>()
  let sprites: Sprite[] = []
  /** messages and animations queue: each shows, then holds before the next */
  let queue: Promise<void> = Promise.resolve()
  const later = (job: () => Promise<void>) => { queue = queue.then(job) }
  /** FUN_10ba_1a29: the frames fly from cell to cell in 8-pixel steps along a Bresenham line */
  const fly = async (from: { x: number; y: number }, to: { x: number; y: number }, how: Flight) => {
    const line = new Line(from.x * 3, from.y * 3, to.x * 3, to.y * 3)
    const steps: [number, number][] = []
    while (line.step()) steps.push([line.x, line.y])
    if (!steps.length) return
    const keep = focus
    focus = { row: Math.round((from.y + to.y) / 2), col: Math.round((from.x + to.x) / 2) }
    try {
      let i = 0
      for (const [px, py] of steps) {
        const fr = how.frames[i++ % how.frames.length]
        sprites = [{ x: px * 8, y: py * 8, rec: fr.rec, mirror: fr.mirror }]
        draw()
        await new Promise((r) => setTimeout(r, Math.max(8, how.delay)))
      }
    } finally { sprites = []; focus = keep; draw() }
  }
  /** FUN_10ba_1feb's frames at a combatant's top-left cell, 70 ms each, `cycles` times */
  const flicker = async (cells: { row: number; col: number }[], frames: SpriteFrame[], cycles: number) => {
    try {
      for (let k = 0; k < cycles; k++) for (const fr of frames) {
        sprites = cells.map((c) => ({ x: c.col * 24, y: c.row * 24, rec: fr.rec, mirror: fr.mirror }))
        draw()
        await s.pause(70)
      }
    } finally { sprites = []; draw() }
  }
  /** The screen keeps one input object and routes keys and taps through it: fill it in place. */
  const setInput = (v: BattleScreen['input']) => {
    for (const k of Object.keys(s.input)) delete (s.input as Record<string, unknown>)[k]
    Object.assign(s.input, v)
  }
  const icons = new Map<Uint8Array, { icon: Picture | null; action: Picture | null }>()
  const iconOf = (f: Fighter) => {
    let v = icons.get(f.c)
    if (!v) {
      // a monster's picture from LOAD_MONSTER, or a CotAB NPC's from ADD_NPC (ecl.addNpc.iconPicture)
      if (e.combatPicture.has(f.c)) {
        const id = e.combatPicture.get(f.c) ?? 0
        const pic = (r: number) => { const raw = s.files.record(`CPIC${e.block}`, r); try { return raw ? parseRecord(raw).frames[0].picture : null } catch { return null } }
        v = { icon: pic(id), action: pic(id + 128) }
      } else v = { icon: buildIcon(s.files, f.c, false), action: buildIcon(s.files, f.c, true) }
      icons.set(f.c, v)
    }
    return v
  }
  /** a planned walk (IMP-044): the cells to the tapped destination and the directions still to take */
  let plan: { cells: { x: number; y: number }[]; dirs: number[]; to: { x: number; y: number } } | null = null
  let walking: { dirs: number[]; at: { x: number; y: number } } | null = null
  /** cheapest route for f within its movement (half-squares: each step's cost, Battle.stepCost), free cells only */
  const route = (f: Fighter, tx: number, ty: number): { cells: { x: number; y: number }[]; dirs: number[] } | null => {
    if (!battle) return null
    const b = battle, budget = f.r[6]
    const key = (x: number, y: number) => y * 64 + x
    const best = new Map<number, number>([[key(f.x, f.y), 0]])
    const prev = new Map<number, [number, number]>() // key → [from key, dir]
    const open: [number, number, number][] = [[0, f.x, f.y]]
    while (open.length) {
      open.sort((a, b2) => a[0] - b2[0])
      const [cost, x, y] = open.shift()!
      if (x === tx && y === ty) break
      if (cost > (best.get(key(x, y)) ?? Infinity)) continue
      for (let d = 0; d < 8; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nc = cost + b.stepCost(nx, ny, d)
        if (nc > budget || !b.passable(nx, ny, f.size || 1) || b.occupied(nx, ny, f.size || 1, f)) continue
        if (nc < (best.get(key(nx, ny)) ?? Infinity)) { best.set(key(nx, ny), nc); prev.set(key(nx, ny), [key(x, y), d]); open.push([nc, nx, ny]) }
      }
    }
    if (!best.has(key(tx, ty)) || (tx === f.x && ty === f.y)) return null
    const dirs: number[] = [], cells: { x: number; y: number }[] = []
    for (let k = key(tx, ty); prev.has(k);) { const [from, d] = prev.get(k)!; dirs.unshift(d); cells.unshift({ x: k % 64, y: Math.floor(k / 64) }); k = from }
    return { cells, dirs }
  }
  /** every square f can walk to with the movement left (IMP-059), by the same costs as route() */
  const reachable = (f: Fighter): { x: number; y: number }[] => {
    if (!battle) return []
    const b = battle, budget = f.r[6]
    const key = (x: number, y: number) => y * 64 + x
    const best = new Map<number, number>([[key(f.x, f.y), 0]])
    const open: [number, number, number][] = [[0, f.x, f.y]]
    while (open.length) {
      open.sort((a, b2) => a[0] - b2[0])
      const [cost, x, y] = open.shift()!
      if (cost > (best.get(key(x, y)) ?? Infinity)) continue
      for (let d = 0; d < 8; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1], nc = cost + b.stepCost(nx, ny, d)
        if (nc > budget || !b.passable(nx, ny, f.size || 1) || b.occupied(nx, ny, f.size || 1, f)) continue
        if (nc < (best.get(key(nx, ny)) ?? Infinity)) { best.set(key(nx, ny), nc); open.push([nc, nx, ny]) }
      }
    }
    return [...best.keys()].filter((k) => k !== key(f.x, f.y)).map((k) => ({ x: k % 64, y: Math.floor(k / 64) }))
  }
  const figureAt = (row: number, col: number) => battle?.fighters.find((o) => battle!.inPlay(o) &&
    footprint(o.size).some(([dx, dy]) => o.x + dx === col && o.y + dy === row)) ?? null
  const showInfo = (f: Fighter | null, ev?: MouseEvent) => {
    const box = s.info
    if (!box) return
    if (!f || !battle) { box.hidden = true; return }
    // with a party member to act by hand: the odds of hitting an enemy with their weapon (IMP-058)
    const odds = acting && !acting.monster && !acting.c[F.quick] && battle.side(f) !== battle.side(acting) && battle.inPlay(f)
      ? battle.hitOdds(acting, f) : null
    box.textContent = `${nameOf(f.c)}: ${condition(battle, f)}${odds ? ` · ≈${Math.round(odds.chance * 100)}% to hit, ${odds.damage}` : ''}`
    box.className = `combat-info ${battle.side(f) ? 'enemy' : 'ally'}`
    box.hidden = false
    if (ev) {
      const r = s.canvas.getBoundingClientRect()
      box.style.left = `${Math.min(r.width - 160, Math.max(4, ev.clientX - r.left + 12))}px`
      box.style.top = `${Math.max(4, ev.clientY - r.top - 34)}px`
    }
  }
  const strip = () => {
    const el = s.strip
    if (!el || !battle) return
    const b = battle
    const left = b.fighters.filter((f) => b.inPlay(f) && s8(f.r[3]) > 0 && f !== acting).sort((a, c) => s8(c.r[3]) - s8(a.r[3]))
    const order = [...(acting && b.inPlay(acting) ? [acting] : []), ...left]
    el.innerHTML = `<span class="ts-label">Round ${b.round + 1}</span>` + order.map((f, i) =>
      `<span class="ts ${b.side(f) ? 'enemy' : 'ally'}${i === 0 && f === acting ? ' now' : ''}">${nameOf(f.c)}</span>`).join('')
    el.hidden = false
  }
  const draw = () => {
    strip()
    if (!battle || !view) return
    const figures: Figure[] = battle.fighters.filter((f) => battle!.inPlay(f) || falling.has(f)).map((f) => {
      const ic = iconOf(f)
      const at = falling.get(f) ?? { x: f.x, y: f.y }
      return { row: at.y, col: at.x, icon: ic.icon, action: ic.action, side: f.c[F.side] ? 1 : 0, left: f.r[9] >= 4, pose: poses.has(f) } as Figure
    })
    const planMarks = plan ? [...plan.cells.map((p) => ({ row: p.y, col: p.x, colour: '#4c8bd6' })), { row: plan.to.y, col: plan.to.x, colour: '#55ff55' }] : []
    // the grey cursor tile (COMSPR 25) lies under the combatant whose turn it is
    const cursor = acting && battle.inPlay(acting) ? [{ row: acting.y, col: acting.x }] : []
    view.draw(battle.bf, battle.cells, figures, focus, [...marks, ...planMarks], cursor, sprites)
  }
  type StepResult = number | 'end' | 'undo' | { choice: number }
  /**
   * A step by key, tap or planned walk (IMP-044). With `menu` the commands stay up at the same time
   * (IMP-053): a choice resolves as { choice }, Enter is left to the menu.
   */
  const awaitStep = (f: Fighter, left: number, menu: { items: string[]; prompt: string } | null) => new Promise<StepResult>((resolve) => {
      // carrying on along a planned walk, unless something stopped the combatant on the way
      if (walking && walking.dirs.length && walking.at.x === f.x && walking.at.y === f.y && f.r[6] > 1) {
        const d = walking.dirs.shift()!
        walking.at = { x: f.x + DIRS[d][0], y: f.y + DIRS[d][1] }
        resolve(d)
        return
      }
      walking = null
      plan = null
      // every square in reach lightly filled, the neighbouring ones outlined (IMP-059)
      marks = reachable(f).map((p) => ({ row: p.y, col: p.x, colour: '', fill: 'rgba(85, 85, 255, 0.22)' }))
      for (let d = 0; d < 8; d++) {
        const [dx, dy] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][d]
        marks.push({ row: f.y + dy, col: f.x + dx, colour: '#4c8bd6' })
      }
      draw()
      let settled = false
      const done = (v: StepResult, fromMenu = false) => {
        if (settled) return
        settled = true
        setInput({})
        marks = []
        if (!fromMenu) s.cancelMenu()
        resolve(v)
      }
      setInput({
        key: (ev) => {
          if (ev.key in KEY_DIRS) { done(KEY_DIRS[ev.key]); return true }
          if (ev.key === 'Enter' && !menu) { done('end'); return true }
          if (ev.key === 'Escape') { if (plan) { plan = null; draw(); return true } done('undo'); return true }
          return false
        },
        tap: (ev) => {
          ev.preventDefault()
          const cell = view!.cellAt(ev, focus)
          const dx = cell.col - f.x, dy = cell.row - f.y
          if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
            const d = DIRS.findIndex(([x, y]) => x === Math.sign(dx) && y === Math.sign(dy))
            plan = null
            done(d)
            return
          }
          // a second tap on the planned square walks there; a first tap plans (IMP-044)
          if (plan && plan.to.x === cell.col && plan.to.y === cell.row) {
            const dirs = plan.dirs.slice()
            plan = null
            const d = dirs.shift()!
            walking = { dirs, at: { x: f.x + DIRS[d][0], y: f.y + DIRS[d][1] } }
            done(d)
            return
          }
          const who = figureAt(cell.row, cell.col)
          if (who) { showInfo(who, ev); return }
          const r = route(f, cell.col, cell.row)
          if (!r) { plan = null; s.print(`Can't get there (Move Left = ${left})`); draw(); return }
          plan = { ...r, to: { x: cell.col, y: cell.row } }
          const cost = r.dirs.reduce((a, d, i) => a + battle!.stepCost(r.cells[i].x, r.cells[i].y, d), 0)
          s.print(`Path: ${r.dirs.length} step${r.dirs.length > 1 ? 's' : ''}, ${cost >> 1} of ${left} movement. Tap the green square again to go.`)
          draw()
        },
      })
      if (menu) void s.menu(menu.items, { prompt: menu.prompt }).then((i) => done({ choice: i }, true))
      else void s.menu(['END MOVE', 'UNDO'], { prompt: `Move/Attack, Move Left = ${left}` }).then((i) => done(i === 0 ? 'end' : 'undo', true))
    })

  const ui: CombatUi = {
    print: (t, hold) => {
      later(async () => {
        s.print(t)
        if (hold?.ms) await s.pause(hold.ms)
      })
    },
    settle: () => queue,
    // FUN_577f_0e11: the skull (COMSPR 11) on every cell the combatant covered, sound 5, the pause
    fall: (cells, ms, who) => {
      // FUN_577f_0e11 replaces the figure by the skull at once: until its turn in the queue comes,
      // the fallen combatant is still drawn where it stood
      if (who) falling.set(who, { x: who.x, y: who.y })
      later(async () => {
        if (who) falling.delete(who)
        sprites = cells.map((c) => ({ x: c.col * 24, y: c.row * 24, rec: 11 }))
        draw()
        s.sound(5, 'full') // FUN_577f_0e11: inside SetResident(0)
        try { await s.pause(ms) } finally { sprites = []; draw() }
      })
    },
    pose: (f, on) => later(async () => { if (on) poses.add(f); else poses.delete(f); draw() }),
    flight: (from, to, how) => later(async () => {
      // the missile and spell sounds are made inside SetResident(0) sections (FUN_3aae_26b0, FUN_4e53_0c20)
      if (how.sounds?.[0]) s.sound(how.sounds[0], 'full')
      await fly(from, to, how)
      if (how.sounds?.[1]) s.sound(how.sounds[1], 'full')
    }),
    // FUN_10ba_1feb: sparkle (COMSPR 9, sound 4) or starburst (COMSPR 10, sound 3) at the top-left cell
    effect: (f, kind, cycles, holdAfter) => later(async () => {
      s.sound(kind === 'sparkle' ? 4 : 3, 'full') // inside SetResident(0)
      await flicker([{ row: f.y, col: f.x }], cycle(kind === 'sparkle' ? 9 : 10), cycles)
      if (holdAfter > 0) await s.pause(holdAfter)
    }),
    show: () => later(async () => draw()),
    hold: (ms) => later(async () => { await s.pause(ms) }),
    look: (at) => later(async () => { focus = { row: at.y, col: at.x }; draw() }),
    redraw: (f) => {
      if (f) { acting = f; focus = { row: f.y, col: f.x } }
      draw()
      s.refreshRoster()
      s.controlsChanged?.()
    },
    pause: (ms = 120) => s.pause(ms),
    menu: (items, opts) => s.menu(items, opts),
    step: (f, left) => awaitStep(f, left, null) as Promise<number | 'end' | 'undo'>,
    command: (f, items, prompt, left) => awaitStep(f, left, { items, prompt }),
    aim: (f, entries, prompt, allowCell, area) => new Promise<AimEntry | null>((resolve) => {
      const ok = entries.filter((x) => x.ok)
      const base = ok.map((x) => ({ row: x.y, col: x.x, colour: '#e05050' }))
      marks = base
      draw()
      // an area spell shows the squares it would cover; a second tap on the same square casts (IMP-059)
      let previewAt: { x: number; y: number } | null = null
      const preview = (x: number, y: number) => {
        if (!area) return
        marks = [...area(x, y).map((p) => ({ row: p.y, col: p.x, colour: '', fill: 'rgba(255, 85, 85, 0.35)' })), ...base, { row: y, col: x, colour: '#ffff55' }]
        draw()
      }
      let settled = false
      const finish = (v: AimEntry | null, fromMenu = false) => {
        if (settled) return
        settled = true
        setInput({})
        marks = []
        if (!fromMenu) s.cancelMenu()
        draw()
        resolve(v)
      }
      setInput({
        tap: (ev) => {
          ev.preventDefault()
          const cell = view!.cellAt(ev, focus)
          const hit = ok.find((x) => x.f && x.f.y === cell.row && x.f.x === cell.col)
          const pick = hit ?? (allowCell ? { f: null, x: cell.col, y: cell.row, cost: battle!.cost(f.x, f.y, cell.col, cell.row), ok: true } : null)
          if (!pick) return
          if (area && !(previewAt && previewAt.x === pick.x && previewAt.y === pick.y)) {
            previewAt = { x: pick.x, y: pick.y }
            preview(pick.x, pick.y)
            s.print('Tap the yellow square again to cast there.')
            return
          }
          finish(pick)
        },
        hover: (ev) => {
          if (!area) return
          const cell = view!.cellAt(ev, focus)
          preview(cell.col, cell.row)
        },
      })
      const labels = ok.map((x) => `${x.f ? String.fromCharCode(...x.f.c.subarray(F.name + 1, F.name + 1 + x.f.c[F.name])) : 'there'} (range ${x.cost >> 1}${x.note ? `, ${x.note}` : ''})`)
      void s.menu([...labels, 'EXIT'], { prompt: ok.length ? prompt : `${prompt} nobody in range`, vertical: true })
        .then((i) => finish(i < ok.length ? ok[i] : null, true))
    }),
    confirm: async (prompt) => (await s.menu(['YES', 'NO'], { prompt })) === 0,
    view: (c) => s.view(c),
    sound: (n, mode) => s.sound(n, mode),
    pick: async (prompt, items, notes) => {
      if (!items.length) return -1
      const i = await s.menu([...items, 'EXIT'], { prompt, vertical: true, notes })
      return i < items.length ? i : -1
    },
  }
  // debug (IMP-025): "Win this battle" answers whatever the battle is waiting for, then it ends
  let skipNow: () => void = () => {}
  const skipped = new Promise<void>((r) => { skipNow = r })
  const raced = <T,>(p: Promise<T>, v: T): Promise<T> => Promise.race([p, skipped.then(() => { s.cancelMenu(); setInput({}); return v })])
  const [menu0, step0, aim0, confirm0, pick0] = [ui.menu.bind(ui), ui.step.bind(ui), ui.aim.bind(ui), ui.confirm.bind(ui), ui.pick.bind(ui)]
  ui.menu = (items, opts) => raced(menu0(items, opts), items.length - 1)
  ui.step = (f, left) => raced(step0(f, left), 'end' as const)
  ui.aim = (f, entries, prompt, allowCell, area) => raced(aim0(f, entries, prompt, allowCell, area), null)
  ui.confirm = (prompt) => raced(confirm0(prompt), false)
  ui.pick = (prompt, items, notes) => raced(pick0(prompt, items, notes), -1)
  const command0 = ui.command!.bind(ui)
  ui.command = (f, items, prompt, left) => raced(command0(f, items, prompt, left), { choice: Math.max(0, items.indexOf('END TURN')) })
  s.onSkip?.(() => { if (battle) { battle.debugWin(); skipNow() } })
  s.canvas.hidden = false
  // the hidden "Magic On/Off" key (DS:6E30): Alt-M, or '2' during a computer-run turn; whether
  // party members on Quick may cast spells. Off at every battle start (FUN_34c7_1e31).
  /** Space (FUN_3334_0fc1) or the Take control button: the party's Quick members come back to you */
  const takeControl = () => {
    if (!battle) return
    const back = battle.takeControl()
    s.print(back.length ? `${back.join(', ')}: under your control again` : 'Nobody is on Quick')
    s.controlsChanged?.()
    s.refreshRoster()
  }
  /** Alt-M (DS:6E30): whether party members on Quick may cast spells */
  const toggleMagic = () => {
    if (!battle) return
    battle.magicOn = !battle.magicOn
    s.print(battle.magicOn ? 'Magic On: characters on Quick may cast spells' : 'Magic Off: characters on Quick will not cast spells')
    s.controlsChanged?.()
  }
  s.onControls?.({
    takeControl, toggleMagic,
    state: () => ({ quick: !!battle && battle.fighters.some((f) => !f.monster && f.c[F.morale] < 0x80 && f.c[F.quick] !== 0), magic: !!battle?.magicOn }),
  })
  const onMagicKey = (ev: KeyboardEvent) => {
    if (!battle) return
    if (ev.key === ' ' && !s.input.key && !s.input.tap && !(ev.target instanceof HTMLButtonElement || ev.target instanceof HTMLInputElement)) {
      ev.preventDefault()
      ev.stopPropagation()
      takeControl()
      return
    }
    const altM = ev.altKey && ev.key.toLowerCase() === 'm'
    const two = ev.key === '2' && !s.input.key && !s.input.tap
    if (!altM && !two) return
    ev.preventDefault()
    ev.stopPropagation()
    toggleMagic()
  }
  window.addEventListener('keydown', onMagicKey, true)
  const onHover = (ev: PointerEvent) => {
    if (!view || ev.pointerType === 'touch') return
    s.input.hover?.(ev)
    const cell = view.cellAt(ev, focus)
    showInfo(figureAt(cell.row, cell.col), ev)
  }
  const onLeave = () => showInfo(null)
  const onIdleTap = (ev: PointerEvent) => {
    if (ev.defaultPrevented || s.input.tap || !view) return
    const cell = view.cellAt(ev, focus)
    showInfo(figureAt(cell.row, cell.col), ev)
  }
  s.canvas.addEventListener('pointermove', onHover)
  s.canvas.addEventListener('pointerleave', onLeave)
  s.canvas.addEventListener('pointerup', onIdleTap)
  // the window grows with the space the battle screen gets (IMP-033)
  const resize = new ResizeObserver(() => {
    const r = s.canvas.getBoundingClientRect()
    if (view?.fit(r.width, r.height)) draw()
  })
  try {
    const result = await fight(e, ui, (b) => {
      battle = b
      view = new CombatView(s.canvas, s.files, b.bf.outdoors) // WILDCOM for a wilderness field, whatever the area
      const r = s.canvas.getBoundingClientRect()
      view.fit(r.width, r.height)
      resize.observe(s.canvas)
      focus = { row: b.fighters[0]?.y ?? 12, col: b.fighters[0]?.x ?? 25 }
      draw()
    })
    await queue
    // FUN_2e08_0916: the summary in its own framed screen, then "press <enter>/<return> to continue"
    result.messages.forEach((m, i) => s.print(m, i === 0))
    if (result.messages.length && !e.quit) await s.menu(['CONTINUE'], { prompt: 'Press Enter to continue' })
    return result
  } finally {
    s.onSkip?.(null)
    s.onControls?.(null)
    resize.disconnect()
    window.removeEventListener('keydown', onMagicKey, true)
    s.canvas.removeEventListener('pointermove', onHover)
    s.canvas.removeEventListener('pointerleave', onLeave)
    s.canvas.removeEventListener('pointerup', onIdleTap)
    showInfo(null)
    if (s.strip) s.strip.hidden = true
    s.canvas.hidden = true
    setInput({})
  }
}
