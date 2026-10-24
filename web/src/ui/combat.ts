// The battle screen: the battlefield in the view panel, combat menus in the command bar, movement by
// arrow keys or by tapping a neighbouring cell, aiming from a list or by tapping (IMP-033). For touch and
// mouse (IMP-083): a tap on an enemy, then a second, attacks it; the action bar casts a memorised spell or
// uses an item in one tap; a drag from the acting character plans a walk live and a release walks it.
// Each goes through the rules' own commands (AIM, CAST, USE and steps), answering their lists. Shown over the
// field (IMP-084): health bars, the squares in an enemy's reach, the squares a blow would land from behind;
// a tap on the acting character opens its commands in a ring around it. Numbers over heads (IMP-085): each
// combatant's change of HP since the message before, shown with the message that tells of it.
import type { Engine } from '../vm/engine'
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, type Picture } from '../data/image'
import { buildIcon } from '../render/icon'
import { CombatView, type Figure, type Sprite } from '../render/combatview'
import { F } from '../games/fields'
import type { SoundMode } from '../games/sound'
import { Line, cycle, fight, footprint, type AimEntry, type Battle, type CombatUi, type Fighter, type Flight, type SpriteFrame } from '../rules/combat'
import { msg, word, type MenuOpts } from '../games/strings'
import { yes, list } from './camp'
import { motionChoice } from './settings'

export interface BattleScreen {
  engine: Engine
  files: GameFiles
  canvas: HTMLCanvasElement
  menu(items: string[], opts?: MenuOpts): Promise<number>
  print(text: string, clear?: boolean): void
  /** a skippable wait (a click, tap or key ends it early) */
  pause(ms: number): Promise<void>
  view(c: Uint8Array): Promise<void>
  sound(n: number, mode: SoundMode): void
  /** set while a step or aim waits for a tap or key; the screen routes input here */
  input: { key?: (e: KeyboardEvent) => boolean; tap?: (e: MouseEvent) => void; hover?: (e: MouseEvent) => void; down?: (e: PointerEvent) => void; move?: (e: PointerEvent) => void }
  refreshRoster(): void
  /** dismiss a menu that a key or tap answered instead */
  cancelMenu(): void
  /** a box over the battlefield for the combatant pointed at (IMP-044) */
  info?: HTMLElement
  /** the turn-order strip (IMP-044) */
  strip?: HTMLElement
  /** the action bar: the acting character's spells and items, one tap each (IMP-083) */
  bar?: HTMLElement
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
  /** Shift-Q: every party member in play goes on Quick (IMP-088) */
  quickAll(): void
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
  let marks: { row: number; col: number; colour: string; fill?: string; dash?: boolean }[] = []
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
      const at = e.combatIcon(f.c)
      if (at !== undefined) {
        const pic = (r: number) => { const raw = at && s.files.picture('CPIC', at.block, r); try { return raw ? parseRecord(raw).frames[0].picture : null } catch { return null } }
        v = { icon: at && pic(at.id), action: at && pic(at.id + 128) }
      } else v = { icon: buildIcon(s.files, f.c, false), action: buildIcon(s.files, f.c, true) }
      icons.set(f.c, v)
    }
    return v
  }
  /** a planned walk (IMP-044): the cells to the tapped destination and the directions still to take */
  let plan: { cells: { x: number; y: number }[]; dirs: number[]; to: { x: number; y: number }; danger: { x: number; y: number }[] } | null = null
  /** IMP-083: the enemy a first tap picked (a second attacks it), the target the next Aim takes, the
   *  answers the next lists take (the action bar's spell or item), and a drag from the acting character */
  let armed: Fighter | null = null
  let presetAim: Fighter | null = null
  let presetPick: string[] = []
  let drag: { moved: boolean; key: string } | null = null
  let radial: HTMLElement | null = null
  const closeRadial = () => { radial?.remove(); radial = null }
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
  /** the enemies in play next to a square for f (footprints touching, any size) */
  const foesNear = (f: Fighter, x: number, y: number): Fighter[] => {
    if (!battle) return []
    const mine = footprint(f.size || 1).map(([dx, dy]) => [x + dx, y + dy])
    return battle.fighters.filter((o) => o !== f && battle!.inPlay(o) && battle!.side(o) !== battle!.side(f) &&
      footprint(o.size || 1).some(([ox, oy]) => mine.some(([mx, my]) => Math.max(Math.abs(o.x + ox - mx), Math.abs(o.y + oy - my)) <= 1)))
  }
  /** a walk with the squares where a step may draw a blow (combat-rules.md, "Attacks of opportunity":
   *  an enemy left behind strikes at the rear; "Steps" 5: a guard beside the new square strikes once) */
  const withDanger = (f: Fighter, r: { cells: { x: number; y: number }[]; dirs: number[] }) => {
    const danger: { x: number; y: number }[] = []
    let blows = 0
    let at = { x: f.x, y: f.y }
    for (const next of r.cells) {
      const before = foesNear(f, at.x, at.y), after = foesNear(f, next.x, next.y)
      const left = before.filter((o) => !after.includes(o)).length
      const guards = after.filter((o) => o.r[7]).length
      if (left + guards) { danger.push(left ? at : next); blows += left + guards }
      at = next
    }
    return { danger, blows }
  }
  /** the HP each combatant had when the last message was queued (IMP-085) */
  const lastHp = new Map<Fighter, number>()
  /** those a blow or spell struck since the last message (CombatUi.struck): their number is already shown */
  let struckSince = new Set<Fighter>()
  /** the message last queued and not yet shown: a struck notice joins its job */
  let lastPrint: { hits: { f: Fighter; d: number | null }[]; sounds: [number, SoundMode][] } | null = null
  /** who lost or gained HP since the last message queued, by any other means (a script's DAMAGE, an effect):
   *  the rules change HP, then print what happened */
  const hpChanges = (): { f: Fighter; d: number | null }[] => {
    if (!battle) return []
    const out: { f: Fighter; d: number | null }[] = []
    for (const f of battle.fighters) {
      const hp = f.c[F.hp], was = lastHp.get(f)
      lastHp.set(f, hp)
      if (was !== undefined && hp !== was && !struckSince.has(f)) out.push({ f, d: hp - was })
    }
    struckSince = new Set()
    return out
  }
  /** the numbers over heads: damage to an enemy yellow, to the party red, healing green; they rise and
   *  fade, or only fade with reduced motion (IMP-057) */
  const floaters = (hits: { f: Fighter; d: number | null }[]) => {
    if (!view || !hits.length || s.canvas.hidden) return
    const host = s.canvas.parentElement!, hr = host.getBoundingClientRect()
    const still = motionChoice() === 'reduced'
    for (const { f, d } of hits) {
      const a = view.cellCentre(f.y, f.x, focus), b = (f.size || 1) > 1 ? view.cellCentre(f.y + 1, f.x + 1, focus) : a
      const el = document.createElement('div')
      el.className = `floater ${d === null ? 'miss' : d > 0 ? 'heal' : f.monster ? 'hurt-foe' : 'hurt-ally'}${still ? ' still' : ''}`
      el.textContent = d === null ? 'MISS' : d > 0 ? `+${d}` : `−${-d}`
      el.style.left = `${(a.x + b.x) / 2 - hr.left}px`
      el.style.top = `${(a.y + b.y) / 2 - hr.top}px`
      host.append(el)
      setTimeout(() => el.remove(), 1400)
    }
  }
  /** a health bar's share and colour (IMP-084): the party's exact, a monster's only in the info box's bands */
  const healthBar = (f: Fighter): { frac: number; colour: string } => {
    const r = f.c[F.hp] / Math.max(1, f.c[F.maxHp])
    const frac = !f.monster ? r : r >= 1 ? 1 : r > 0.66 ? 0.83 : r > 0.33 ? 0.5 : 0.2
    return { frac, colour: frac >= 0.5 ? '#55ff55' : frac >= 0.25 ? '#ffff55' : '#ff5555' }
  }
  /** an enemy a melee blow from straight behind would strike at rear AC (combat-rules.md, "Engagement and
   *  facing" and the attack loop's step 5: engaged twice already, so it does not turn, and the angle summed
   *  with the 4 of a blow from behind over 4) */
  const openBehind = (o: Fighter) => (o.size || 1) === 1 && o.r[0xf] >= 2 && ((o.r[0x12] + 4) & 7) > 4
  /** the free squares straight behind the enemies open from behind, for f to strike from (IMP-084) */
  const rearSquares = (f: Fighter): { x: number; y: number }[] => {
    if (!battle) return []
    const b = battle
    return b.fighters.filter((o) => b.inPlay(o) && b.side(o) !== b.side(f) && openBehind(o)).map((o) => {
      const [dx, dy] = DIRS[o.r[9] & 7]
      return { x: o.x - dx, y: o.y - dy }
    }).filter((p) => (p.x === f.x && p.y === f.y) || (b.passable(p.x, p.y, f.size || 1) && !b.occupied(p.x, p.y, f.size || 1, f)))
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
    const rear = odds && openBehind(f) ? ' · open from behind' : ''
    box.textContent = `${nameOf(f.c)}: ${condition(battle, f)}${odds ? ` · ≈${Math.round(odds.chance * 100)}% to hit, ${odds.damage}` : ''}${rear}`
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
      return { row: at.y, col: at.x, icon: ic.icon, action: ic.action, side: f.c[F.side] ? 1 : 0, left: f.r[9] >= 4, pose: poses.has(f), hp: battle!.inPlay(f) ? healthBar(f) : undefined } as Figure
    })
    const planMarks = plan ? [...plan.cells.map((p) => ({ row: p.y, col: p.x, colour: '#5555ff' })), ...plan.danger.map((p) => ({ row: p.y, col: p.x, colour: '#ff5555', fill: 'rgba(255, 85, 85, 0.3)' })), { row: plan.to.y, col: plan.to.x, colour: '#55ff55' }] : []
    const armedMarks = armed && battle.inPlay(armed) ? footprint(armed.size || 1).map(([dx, dy]) => ({ row: armed!.y + dy, col: armed!.x + dx, colour: '#ffff55' })) : []
    // the grey cursor tile (COMSPR 25) lies under the combatant whose turn it is
    const cursor = acting && battle.inPlay(acting) ? [{ row: acting.y, col: acting.x }] : []
    view.draw(battle.bf, battle.cells, figures, focus, [...marks, ...planMarks, ...armedMarks], cursor, sprites)
  }
  type StepResult = number | 'end' | 'undo' | { choice: number }
  /**
   * A step by key, tap or planned walk (IMP-044). With `menu` the commands stay up at the same time
   * (IMP-053): a choice resolves as { choice }, Enter is left to the menu.
   */
  const awaitStep = (f: Fighter, left: number, menu: { items: string[]; prompt: string; keys?: string[] } | null) => new Promise<StepResult>((resolve) => {
      // carrying on along a planned walk, unless something stopped the combatant on the way
      if (walking && walking.dirs.length && walking.at.x === f.x && walking.at.y === f.y && f.r[6] > 1) {
        const d = walking.dirs.shift()!
        walking.at = { x: f.x + DIRS[d][0], y: f.y + DIRS[d][1] }
        resolve(d)
        return
      }
      walking = null
      plan = null
      armed = null
      presetAim = null
      presetPick = []
      drag = null
      // every square in reach lightly filled, the neighbouring ones outlined (IMP-059)
      // in an enemy's reach (a step away from there draws a blow): red rather than blue (IMP-084)
      marks = reachable(f).map((p) => ({ row: p.y, col: p.x, colour: '', fill: foesNear(f, p.x, p.y).length ? 'rgba(255, 85, 85, 0.25)' : 'rgba(85, 85, 255, 0.22)' }))
      if (!f.monster && !f.c[F.quick]) marks.push(...rearSquares(f).map((p) => ({ row: p.y, col: p.x, colour: '#ffff55', fill: 'rgba(255, 255, 85, 0.15)', dash: true })))
      for (let d = 0; d < 8; d++) {
        const [dx, dy] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][d]
        marks.push({ row: f.y + dy, col: f.x + dx, colour: '#5555ff' })
      }
      draw()
      let settled = false
      const done = (v: StepResult, fromMenu = false) => {
        if (settled) return
        settled = true
        setInput({})
        marks = []
        armed = null
        closeRadial()
        if (s.bar) s.bar.hidden = true
        if (!fromMenu) s.cancelMenu()
        draw()
        resolve(v)
      }
      // the rules' own commands, found by the game's words (FUN_320c_0666's pieces)
      const command = (id: 'battleViewAim' | 'battleCast' | 'battleUse', key: string) => menu ? menu.items.indexOf(word(id, key).text.toUpperCase()) : -1
      const by = !f.monster && !f.c[F.quick]
      // the action bar (IMP-083): the memorised spells and the items Use offers, each a tap away
      const bar = s.bar
      if (bar) {
        const st = e.spells, t = e.items
        const cast = command('battleCast', 'C'), use = command('battleUse', 'U')
        const counts = new Map<number, number>()
        if (st && cast >= 0) for (let k = 0; k < F.memorisedCount; k++) { const v = f.c[F.memorised + k]; if (v > 0 && v < 0x80) counts.set(v, (counts.get(v) ?? 0) + 1) }
        // Use's own list (Battle.playerUse): readied items with charges, scrolls among them
        const usable = t && use >= 0 ? e.itemsOf(f.c).filter((it) => it.ready && (it.props[1] > 0 && it.props[2] < 0x80 || (t.baseOf(it)?.slot ?? 0) >= 11 && (t.baseOf(it)?.slot ?? 0) <= 12)) : []
        const spells = [...counts].map(([id, n]) => ({ name: st!.get(id)?.name ?? `#${id}`, n }))
        const attr = (v: string) => v.replace(/[&"<>]/g, (ch) => `&#${ch.charCodeAt(0)};`)
        bar.innerHTML = by && (spells.length || usable.length) ? [
          ...spells.map((x) => `<button data-cast="${attr(x.name)}" title="Cast ${attr(x.name)}">✦ ${attr(x.name)}${x.n > 1 ? ` ×${x.n}` : ''}</button>`),
          ...usable.map((it) => `<button data-use="${attr(t!.name(it))}" title="Use ${attr(t!.name(it))}">◆ ${attr(t!.name(it))}</button>`),
        ].join('') : ''
        bar.hidden = !bar.innerHTML
        bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => {
          if (b.dataset.cast) { presetPick = [b.dataset.cast]; done({ choice: cast }) }
          else if (b.dataset.use) { presetPick = [b.dataset.use]; done({ choice: use }) }
        }))
      }
      /** the commands in a ring round the acting character (IMP-084), the command row's own choices */
      const openRadial = () => {
        closeRadial()
        if (!menu || !view) return
        const host = s.canvas.parentElement!, hr = host.getBoundingClientRect()
        const c = view.cellCentre(f.y, f.x, focus)
        const ring = document.createElement('div')
        ring.className = 'radial'
        const n = menu.items.length, rad = Math.max(64, Math.min(110, 22 * n))
        const cx = Math.min(hr.width - rad - 40, Math.max(rad + 40, c.x - hr.left)), cy = Math.min(hr.height - rad - 20, Math.max(rad + 20, c.y - hr.top))
        ring.innerHTML = `<button class="radial-centre" title="Close (Esc)" style="left:${cx}px;top:${cy}px">✕</button>` + menu.items.map((t, i) => {
          const a = -Math.PI / 2 + (2 * Math.PI * i) / n
          return `<button data-i="${i}" style="left:${cx + rad * Math.cos(a)}px;top:${cy + rad * Math.sin(a)}px">${t.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)}</button>`
        }).join('')
        ring.addEventListener('click', (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button')
          ev.stopPropagation()
          if (!b || b.classList.contains('radial-centre')) { closeRadial(); return }
          done({ choice: Number(b.dataset.i) })
        })
        host.append(ring)
        radial = ring
      }
      /** the walk planned to a square, with its cost and the blows it may draw, told in the log */
      const planTo = (col: number, row: number, how: string) => {
        const r = route(f, col, row)
        if (!r) { plan = null; s.print(`Can't get there (Move Left = ${left})`); draw(); return false }
        const { danger, blows } = withDanger(f, r)
        plan = { ...r, to: { x: col, y: row }, danger }
        const cost = r.dirs.reduce((a, d, i) => a + battle!.stepCost(r.cells[i].x, r.cells[i].y, d), 0)
        s.print(`Path: ${r.dirs.length} step${r.dirs.length > 1 ? 's' : ''}, ${cost >> 1} of ${left} movement${blows ? `; ${blows} enemy blow${blows > 1 ? 's' : ''} may fall on the way (red)` : ''}. ${how}`)
        draw()
        return true
      }
      const walkPlan = () => {
        if (!plan) return
        const dirs = plan.dirs.slice()
        plan = null
        const d = dirs.shift()!
        walking = { dirs, at: { x: f.x + DIRS[d][0], y: f.y + DIRS[d][1] } }
        done(d)
      }
      setInput({
        // a drag from the acting character plans the walk as it goes; the release walks it (IMP-083)
        down: (ev) => {
          if (!by || ev.button > 0) return
          const cell = view!.cellAt(ev, focus)
          if (!footprint(f.size || 1).some(([dx, dy]) => f.x + dx === cell.col && f.y + dy === cell.row)) return
          drag = { moved: false, key: `${cell.col},${cell.row}` }
          try { s.canvas.setPointerCapture(ev.pointerId) } catch { /* a synthetic event */ }
        },
        move: (ev) => {
          if (!drag) return
          const cell = view!.cellAt(ev, focus), k = `${cell.col},${cell.row}`
          if (k === drag.key) return
          drag.key = k
          drag.moved = true
          if (cell.col === f.x && cell.row === f.y) { plan = null; draw(); return }
          planTo(cell.col, cell.row, 'Let go to walk it.')
        },
        key: (ev) => {
          if (ev.key in KEY_DIRS) { done(KEY_DIRS[ev.key]); return true }
          if (ev.key === 'Enter' && !menu) { done('end'); return true }
          if (ev.key === 'Escape') { if (radial) { closeRadial(); return true } if (plan) { plan = null; draw(); return true } done('undo'); return true }
          return false
        },
        tap: (ev) => {
          ev.preventDefault()
          // the end of a drag: walk the plan drawn (none when let go on the character or out of reach)
          if (drag) { const was = drag; drag = null; if (was.moved) { if (plan) walkPlan(); return } }
          const cell = view!.cellAt(ev, focus)
          const dx = cell.col - f.x, dy = cell.row - f.y
          if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) {
            const d = DIRS.findIndex(([x, y]) => x === Math.sign(dx) && y === Math.sign(dy))
            plan = null
            done(d)
            return
          }
          // a second tap on the planned square walks there; a first tap plans (IMP-044)
          if (plan && plan.to.x === cell.col && plan.to.y === cell.row) { walkPlan(); return }
          const who = figureAt(cell.row, cell.col)
          if (who === f && by && menu) { if (radial) closeRadial(); else openRadial(); return }
          closeRadial()
          // an enemy: the first tap shows it and the odds, the second attacks it through Aim (IMP-083)
          const aim = command('battleViewAim', 'A')
          if (who && by && aim >= 0 && battle!.side(who) !== battle!.side(f)) {
            showInfo(who, ev)
            if (armed === who) { presetAim = who; done({ choice: aim }); return }
            armed = who
            plan = null
            s.print(`Tap ${nameOf(who.c)} again to attack.`)
            draw()
            return
          }
          if (who) { showInfo(who, ev); return }
          armed = null
          planTo(cell.col, cell.row, 'Tap the green square again to go, or drag from your character.')
        },
      })
      if (menu) void s.menu(menu.items, { prompt: menu.prompt, keys: menu.keys }).then((i) => done({ choice: i }, true))
      else void s.menu(['END MOVE', 'UNDO'], { prompt: `${msg('moveLeft')}${left}` }).then((i) => done(i === 0 ? 'end' : 'undo', true))
    })

  const ui: CombatUi = {
    print: (t, hold) => {
      const hits = hpChanges() // now, as the rules print: the change belongs to this message
      // the blow this message tells of (struck, called right after) joins it: shown with it, before its pause
      const job = { hits, sounds: [] as [number, SoundMode][] }
      lastPrint = job
      later(async () => {
        if (lastPrint === job) lastPrint = null
        s.print(t)
        floaters(job.hits)
        for (const [n, mode] of job.sounds) s.sound(n, mode)
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
    // a blow or spell's number with its message and sound, a miss as MISS (IMP-085); the HP it takes off
    // afterwards is not shown again
    struck: (t, damage) => {
      if (damage !== null) struckSince.add(t)
      const hit = { f: t, d: damage === null ? null : -damage }
      // with the message just printed, before its pause; queued on its own only if that has already shown
      if (lastPrint) lastPrint.hits.push(hit)
      else later(async () => floaters([hit]))
    },
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
    command: (f, items, prompt, left, keys) => awaitStep(f, left, { items, prompt, keys }),
    aim: (f, entries, prompt, allowCell, area) => new Promise<AimEntry | null>((resolve) => {
      const ok = entries.filter((x) => x.ok)
      // a target picked by tapping it twice (IMP-083): taken at once when Aim offers it
      if (presetAim) {
        const want = presetAim
        presetAim = null
        const hit = ok.find((x) => x.f === want)
        if (hit) { resolve(hit); return }
        // not in reach with the readied weapon: said, and back to the commands rather than Aim's list
        s.print(`${nameOf(want.c)} is out of reach for ${nameOf(f.c)} with the weapon readied.`)
        resolve(null)
        return
      }
      const base = ok.map((x) => ({ row: x.y, col: x.x, colour: '#ff5555' }))
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
          const hit = ok.find((x) => x.f && x.y === cell.row && x.x === cell.col)
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
      const labels = ok.map((x) => `${x.f ? String.fromCharCode(...x.f.c.subarray(F.name + 1, F.name + 1 + x.f.c[F.name])) : 'there'} (${x.body ? 'body, ' : ''}range ${x.cost >> 1}${x.note ? `, ${x.note}` : ''})`)
      // the list replaces the original's Next/Prev/Manual/Center; its Exit is the aim menu's (FUN_3aae_2aa0, CotAB 0x2D577)
      const ex = word('aim', 'E')
      void s.menu([...labels, ex.text.toUpperCase()], { prompt: ok.length ? prompt : `${prompt} nobody in range`, vertical: true, keys: [...labels.map(() => ''), ex.key] })
        .then((i) => finish(i < ok.length ? ok[i] : null, true))
    }),
    confirm: (prompt) => yes(s, prompt),
    view: (c) => s.view(c),
    // a sound plays with what it belongs to (IMP-085): the message just printed (the hit's 7, the miss's 9),
    // else in its turn among the queued animations, never ahead of them
    sound: (n, mode) => { if (lastPrint) lastPrint.sounds.push([n, mode]); else later(async () => s.sound(n, mode)) },
    pick: async (prompt, items, notes) => {
      if (!items.length) return -1
      // the action bar's spell or item (IMP-083): its own line in the rules' list, else the list as ever
      const want = presetPick.shift()
      const at = want === undefined ? -1 : items.indexOf(want)
      if (at >= 0) return at
      presetPick = []
      const i = await list(s, items, { prompt, notes })
      return i < items.length ? i : -1
    },
  }
  // debug (IMP-025): "Win this battle" answers whatever the battle is waiting for, then it ends
  let skipNow: () => void = () => {}
  const skipped = new Promise<void>((r) => { skipNow = r })
  const raced = <T,>(p: Promise<T>, v: T): Promise<T> => Promise.race([p, skipped.then(() => { s.cancelMenu(); setInput({}); return v })])
  const [menu0, step0, aim0, confirm0, pick0] = [ui.menu.bind(ui), ui.step.bind(ui), ui.aim.bind(ui), ui.confirm.bind(ui), ui.pick.bind(ui)]
  // All on Quick leaves the turn's prompt with nothing chosen (IMP-088); the rules then hand the turn over
  let leaveTurn: (() => void) | null = null
  const leavable = <T,>(p: Promise<T>, none: T): Promise<T> => {
    let done = false
    return Promise.race([p, new Promise<T>((r) => { leaveTurn = () => { if (!done) { s.cancelMenu(); setInput({}); r(none) } } })])
      .finally(() => { done = true; leaveTurn = null })
  }
  ui.menu = (items, opts) => raced(battle?.atTurnPrompt ? leavable(menu0(items, opts), -1) : menu0(items, opts), items.length - 1)
  ui.step = (f, left) => raced(step0(f, left), 'end' as const)
  ui.aim = (f, entries, prompt, allowCell, area) => raced(aim0(f, entries, prompt, allowCell, area), null)
  ui.confirm = (prompt) => raced(confirm0(prompt), false)
  ui.pick = (prompt, items, notes) => raced(pick0(prompt, items, notes), -1)
  const command0 = ui.command!.bind(ui)
  ui.command = (f, items, prompt, left, keys) => raced(leavable(command0(f, items, prompt, left, keys), 'end' as const), { choice: Math.max(0, items.indexOf('END TURN')) })
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
  /** Shift-Q or the All on Quick button (IMP-088): the computer plays the whole party until Space / Take control */
  const quickAll = () => {
    if (!battle) return
    const on = battle.quickAll()
    if (!on.length) { s.print('Everyone is already on Quick'); return }
    s.print('All on Quick: the computer plays the party. Space or TAKE CONTROL to play them yourself.')
    const casters = battle.fighters.some((f) => !f.monster && f.c[F.quick] && Array.from({ length: F.memorisedCount }, (_, i) => f.c[F.memorised + i]).some((v) => v > 0 && v < 0x80))
    if (casters) s.print(battle.magicOn ? 'Magic is On: they may cast spells (Alt-M or MAGIC to stop).' : 'Magic is Off: they will not cast spells (Alt-M or MAGIC to allow).')
    if (battle.atTurnPrompt) leaveTurn?.()
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
    takeControl, toggleMagic, quickAll,
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
    if (ev.shiftKey && !ev.altKey && !ev.ctrlKey && !ev.metaKey && ev.key.toLowerCase() === 'q' && !(ev.target instanceof HTMLInputElement)) {
      ev.preventDefault()
      ev.stopPropagation()
      quickAll()
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
  const onDown = (ev: PointerEvent) => s.input.down?.(ev)
  const onHover = (ev: PointerEvent) => {
    s.input.move?.(ev)
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
  s.canvas.addEventListener('pointerdown', onDown)
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
      for (const f of b.fighters) lastHp.set(f, f.c[F.hp])
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
    s.canvas.removeEventListener('pointerdown', onDown)
    s.canvas.removeEventListener('pointermove', onHover)
    s.canvas.removeEventListener('pointerleave', onLeave)
    s.canvas.removeEventListener('pointerup', onIdleTap)
    showInfo(null)
    if (s.strip) s.strip.hidden = true
    if (s.bar) s.bar.hidden = true
    closeRadial()
    s.canvas.hidden = true
    setInput({})
  }
}
