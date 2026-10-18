// Combat (spec/combat.md): battle setup and placement, rounds, turns, attacks, movement, morale, the
// computer's AI and the aftermath. The screen is behind CombatUi so the rules can run headless.
import type { Engine } from '../vm/engine'
import type { Item } from '../data/items'
import type { Spell } from '../data/spells'
import type { Effect } from '../data/effects'
import { COLS, ROWS, cellTable, mapBattlefield, wildBattlefield, type Battlefield, type CellInfo } from './battlefield'
import { dexMissile, recalc } from './equip'
import { fx, fire, damageText, healedLine, addEffect, addRaw, removeEffect, removeType, type FxHost } from './effects'
import { heal as healChar } from './camp'
import { line, sharedSpell } from './spellfx'
import { spellText } from './spelltext'
import { SPELL_MSG, casterLevel, duration as spellDuration, forget } from './magic'

const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1]

export interface Fighter {
  c: Uint8Array
  /** the 22-byte combat record */
  r: Uint8Array
  x: number
  y: number
  /** icon size 1–4 (0 = not on the field) */
  size: number
  index: number
  monster: boolean
  target: Fighter | null
}

export interface AimEntry { f: Fighter | null; x: number; y: number; cost: number; ok: boolean; note?: string }

/** A COMSPR frame: record (0–11, +128 for the second image) and whether it is drawn mirrored. */
export interface SpriteFrame { rec: number; mirror?: boolean }
/** A flight: its frames, the delay per 8-pixel step, and the sounds before and after (spec/combat.md, "Combat visuals"). */
export interface Flight { frames: SpriteFrame[]; delay: number; sounds?: [number, number] }

/** The standard 4-frame cycle of a COMSPR slot (FUN_10ba_19de): image, mirrored, second image mirrored, second image. */
export const cycle = (rec: number): SpriteFrame[] => [{ rec }, { rec, mirror: true }, { rec: rec + 128, mirror: true }, { rec: rec + 128 }]

/** The sprite a thrown or fired item flies as (FUN_3aae_26b0); `dir` 0 = N, clockwise. */
export function missileFlight(type: number, dir: number): Flight {
  const sounds: [number, number] = [6, 12]
  if ([9, 21, 28, 31, 73].includes(type)) {
    const ARROW: SpriteFrame[] = [{ rec: 0 }, { rec: 1 }, { rec: 2 }, { rec: 129 }, { rec: 128 }, { rec: 129, mirror: true }, { rec: 130 }, { rec: 1, mirror: true }]
    return { frames: [ARROW[dir & 7]], delay: 10, sounds }
  }
  if ([2, 7, 20].includes(type)) return { frames: cycle(3), delay: 50, sounds }
  if (type === 85 || type === 86) return { frames: cycle(4), delay: 50, sounds }
  if (type === 47) return { frames: [{ rec: 8 }, { rec: 136 }], delay: 20, sounds }
  return { frames: [{ rec: 7 }, { rec: 135 }], delay: 20, sounds }
}

/** How long a message holds before the next (combat pacing, spec/combat.md "Pacing"). */
export interface Hold {
  ms: number
  /** flash this combatant meanwhile (the hit display, FUN_10ba_1feb) */
  flash?: Fighter
}

export interface CombatUi {
  /** show a message; the screen shows the next only after `hold` (messages queue) */
  print(text: string, hold?: Hold): void
  /** resolves once every queued message has been shown and held */
  settle?(): Promise<void>
  /** queued like a message: the skull on these cells, sound 5, then a hold of `ms` (FUN_577f_0e11) */
  fall?(cells: { row: number; col: number }[], ms: number, who?: Fighter): void
  /** queued: show the combatant in its action frame (true) or its normal frame (FUN_577f_0af8) */
  pose?(f: Fighter, action: boolean): void
  /** queued: a missile or spell flies from one cell to another (FUN_10ba_1a29), sounds before and after */
  flight?(from: { x: number; y: number }, to: { x: number; y: number }, how: Flight): void
  /** queued: sparkle (an effect took hold) or starburst (spell/effect damage) at a combatant (FUN_10ba_1feb) */
  effect?(f: Fighter, kind: 'sparkle' | 'burst', cycles: number, holdAfter: number): void
  redraw(focus?: Fighter): void
  /** queued: redraw the battlefield as it is now (the Stinking Cloud cells) */
  show?(): void
  /** queued: hold before what follows */
  hold?(ms: number): void
  /** queued: centre the view on a cell (Fireball, FUN_4e53_266b) */
  look?(at: { x: number; y: number }): void
  pause(ms?: number): Promise<void>
  menu(items: string[], opts?: { prompt?: string }): Promise<number>
  /** a step direction 0–7, 'end' (done moving) or 'undo' (Escape) */
  step(f: Fighter, left: number): Promise<number | 'end' | 'undo'>
  /**
   * The command menu with movement live at the same time (IMP-053): a step direction, 'undo'
   * (Escape), 'end', or the menu choice. Without it the player chooses MOVE first, as in the original.
   */
  command?(f: Fighter, items: string[], prompt: string, left: number): Promise<number | 'end' | 'undo' | { choice: number }>
  /** pick a target among entries (nearest first); −1 = exit */
  /** `area`: for an area spell, the squares it would cover if centred there (a preview) */
  aim(f: Fighter, entries: AimEntry[], prompt: string, allowCell: boolean, area?: (x: number, y: number) => { x: number; y: number }[]): Promise<AimEntry | null>
  confirm(prompt: string): Promise<boolean>
  view(c: Uint8Array): Promise<void>
  sound(n: number): void
  /** a spell or item list; −1 = exit */
  pick(prompt: string, items: string[], notes?: string[]): Promise<number>
}

/** 'spared': nobody won or fled but ECL 0x6DE6 = 1 kept the party from being destroyed (brawls) */
export type Outcome = 'won' | 'fled' | 'destroyed' | 'spared'

const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(1, 1 + c[0]))
const u16 = (c: Uint8Array, o: number) => c[o] | (c[o + 1] << 8)
const s8 = (v: number) => (v << 24) >> 24

/** Footprint cells (FUN_577f_0000): 1 = 1×1, 2 = 1 wide × 2 tall, 3 = 2 wide × 1 tall, 4 = 2×2. */
function footprint(size: number): [number, number][] {
  return size === 2 ? [[0, 0], [0, 1]] : size === 3 ? [[0, 0], [1, 0]] : size === 4 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]
}

/** The line walker (FUN_46c1_01a0 init, FUN_46c1_02cc step): Bresenham, cost 2 straight, 3 diagonal (byte). */
export class Line {
  x: number
  y: number
  cost = 0
  private err: number
  private readonly dx: number
  private readonly dy: number
  private readonly sx: number
  private readonly sy: number
  private readonly diag: number
  private readonly straight: number
  private readonly x1: number
  private readonly y1: number
  constructor(x0: number, y0: number, x1: number, y1: number) {
    this.x = x0; this.y = y0; this.x1 = x1; this.y1 = y1
    this.dx = Math.abs(x1 - x0); this.dy = Math.abs(y1 - y0)
    this.sx = Math.sign(x1 - x0); this.sy = Math.sign(y1 - y0)
    const [a, b] = this.dx > this.dy ? [this.dx, this.dy] : [this.dy, this.dx]
    this.err = 2 * b - a; this.diag = 2 * (b - a); this.straight = 2 * b
  }
  /** one cell along; false at the end */
  step(): boolean {
    const xMajor = this.dx > this.dy
    if (xMajor ? this.x === this.x1 : this.y === this.y1) return false
    if (this.err >= 0) {
      if (xMajor) this.y += this.sy; else this.x += this.sx
      this.err += this.diag
      this.cost = (this.cost + 3) & 0xff
    } else {
      this.err += this.straight
      this.cost = (this.cost + 2) & 0xff
    }
    if (xMajor) this.x += this.sx; else this.y += this.sy
    return true
  }
}

/** A Stinking Cloud (19-byte record at DS:6DBB): its owner, number and the 4 cells it replaced. */
interface Cloud { owner: Uint8Array; n: number; cells: { x: number; y: number; old: number }[] }

export class Battle implements FxHost {
  readonly fighters: Fighter[] = []
  bodies: { f: Fighter; x: number; y: number; cell: number }[] = []
  clouds: Cloud[] = []
  /** the square a spell was aimed at (DS:6DB9/6DBA) */
  aimed = { x: 0, y: 0 }
  /** items thrown or fired and left on the field (DS:6810 additions) */
  dropped: Item[] = []
  round = 0
  enemyPct = 100
  current_: Fighter | null = null
  magicOn = false
  ended = false
  private readonly e: Engine
  private readonly ui: CombatUi
  readonly bf: Battlefield
  readonly cells: CellInfo[]

  constructor(e: Engine, ui: CombatUi, bf: Battlefield, cells: CellInfo[]) {
    this.e = e
    this.ui = ui
    this.bf = bf
    this.cells = cells
  }

  // ------------------------------------------------------------ FxHost
  effectsOf(c: Uint8Array): Effect[] { return this.e.effectsOf(c) }
  itemsOf(c: Uint8Array): Item[] { return this.e.itemsOf(c) }
  /** a combat message: held speed × 225 ms (FUN_10ba_16ec with its pause flag, PAUSE = FUN_1709_0dbe) */
  print(t: string, hold: Hold = { ms: this.e.speed * 225 }) { this.ui.print(t, hold) }
  /** wait until the messages so far have been shown */
  async settle() { await this.ui.settle?.() }
  roll(n: number, s: number) { return this.e.roll(n, s) }
  name(c: Uint8Array) { return name(c) }
  all() { return this.fighters.map((f) => f.c) }
  inCombat() { return true }
  distance(a: Uint8Array, b: Uint8Array) { const fa = this.of(a), fb = this.of(b); return fa && fb ? this.dist(fa, fb) : 99 }
  targetOf(c: Uint8Array) { return this.of(c)?.target?.c ?? null }
  current() { return this.current_?.c ?? null }
  endTurn(c: Uint8Array) { const f = this.of(c); if (f) this.endTurnF(f) }
  rec(c: Uint8Array, i: number) { return this.of(c)?.r[i] ?? 0 }
  setRec(c: Uint8Array, i: number, v: number) { const f = this.of(c); if (f) { f.r[i] = v & 0xff; if (i === 0xa && !v) f.target = null } }
  setStatus(c: Uint8Array, status: number, msg: string) {
    if ([6, 7, 8].includes(c[0x10c])) return
    this.print(msg)
    c[0x10c] = status
    if (status !== 0 && status !== 1) { c[0x10d] = 0; c[0x11b] = 0; const f = this.of(c); if (f) this.downF(f) }
  }
  damage(c: Uint8Array, dmg: number, mode: number, saved: boolean) { this.damageSync(c, dmg, mode, saved) }
  save(c: Uint8Array, type: number, bonus: number) { return this.saveSync(c, type, bonus) }
  heal(c: Uint8Array, amount: number, force: boolean) { return healChar(c, this.e.effectsOf(c), amount, force, true) }
  revive(c: Uint8Array, hp: number) {
    const f = this.of(c)
    if (!f || this.occupied(f.x, f.y, f.size || 1, f)) return false
    c[0x10c] = 0; c[0x10d] = 1; c[0x11b] = Math.min(hp, c[0x32])
    f.size = (c[0x6c] & 7) || 1
    this.print(`${name(c)} ${c[0x10e] ? 'stands up and grins' : 'gets back up'}`) // FUN_5216_1869
    return true
  }
  recalc(c: Uint8Array) { if (this.e.items) recalc(c, this.e.itemsOf(c), this.e.items) }
  enemiesNear(c: Uint8Array, range: number) { const f = this.of(c); return f ? this.enemiesWithin(f, range).map((x) => x.c) : [] }
  byIndex(i: number) { return this.fighters[i]?.c ?? null }
  indexOf(c: Uint8Array) { return this.of(c)?.index ?? 0 }
  async attack(a: Uint8Array, t: Uint8Array) { const fa = this.of(a), ft = this.of(t); if (fa && ft) await this.attackF(fa, ft, false, null) }
  /** the weapon, or the ammunition being fired by the current attacker (FUN_3723_101d) */
  weapon(c: Uint8Array) { return c === this.current_?.c && this.firing ? this.firing : this.weaponOf(c) }
  private firing: Item | null = null
  weaponKind(type: number) { return this.e.items?.base[type]?.kind ?? 0 }
  /** effect 0x28 expiring (spec/effects.md): the owner's cloud lifts; other clouds are redrawn over it */
  clearCloud(c: Uint8Array, power: number) {
    const i = this.clouds.findIndex((z) => z.owner === c && z.n === power >> 4)
    if (i < 0) return
    const [z] = this.clouds.splice(i, 1)
    for (const t of z.cells) {
      const body = this.bodies.find((b) => b.x === t.x && b.y === t.y && b.f.size === 0)
      if (body) { body.cell = t.old; this.bf.set(t.y, t.x, 0x1f) } else this.bf.set(t.y, t.x, t.old)
    }
    for (const o of this.clouds) for (const t of o.cells) this.bf.set(t.y, t.x, 0x1e)
    this.ui.redraw()
  }
  /** Stinking Cloud occupant check (FUN_5216_0ae7) */
  cloudCheck(t: Fighter) {
    if (!this.inPlay(t) || !footprint(t.size).some(([dx, dy]) => this.bf.get(t.y + dy, t.x + dx) === 0x1e)) return
    if (this.e.effectsOf(t.c).some((x) => [0x1e, 0x1f, 0x20, 0x6f, 0x7d].includes(x.type))) return
    if (this.saveSync(t.c, 0, 0)) { this.print(`${name(t.c)} starts to cough`); addRaw(this, t.c, 0x1e, 1, 0xff, 0) }
    else { this.print(`${name(t.c)} chokes and gags from nausea`); addRaw(this, t.c, 0x1f, this.e.roll(1, 4) + 1, 0xff, 0); this.endTurnF(t) }
  }

  // ------------------------------------------------------------ basics
  of(c: Uint8Array) { return this.fighters.find((f) => f.c === c) ?? null }
  fly(from: Uint8Array, to: Uint8Array, kind: 'gaze' | 'spit') {
    const a = this.of(from), b = this.of(to)
    if (!a || !b) return
    this.ui.flight?.({ x: a.x, y: a.y }, { x: b.x, y: b.y }, kind === 'gaze' ? { frames: cycle(5), delay: 45 } : { frames: [{ rec: 10 }], delay: 30 })
  }
  inPlay(f: Fighter) { return f.c[0x10d] !== 0 && f.size > 0 }
  side(f: Fighter) { return f.c[0x10e] }
  enemies(f: Fighter) { return this.fighters.filter((o) => o !== f && this.inPlay(o) && this.side(o) !== this.side(f)) }
  count(side: number) { return this.fighters.filter((f) => this.inPlay(f) && this.side(f) === side).length }
  weaponOf(c: Uint8Array): Item | null {
    const t = this.e.items
    return this.e.itemsOf(c).find((it) => it.ready && t?.baseOf(it)?.slot === 0) ?? null
  }

  /** half-square cost between two cells: straight 2, diagonal 3 (Line of sight cost metric) */
  cost(x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
    const d = Math.min(dx, dy), s = Math.max(dx, dy) - d
    return 3 * d + 2 * s
  }
  /** squares between combatants, over every pair of footprint cells (terrain ignored) */
  dist(a: Fighter, b: Fighter) {
    let best = 999
    for (const [ax, ay] of footprint(a.size || 1)) for (const [bx, by] of footprint(b.size || 1)) best = Math.min(best, this.cost(a.x + ax, a.y + ay, b.x + bx, b.y + by))
    return best >> 1
  }
  /** Bresenham line of sight (FUN_56c1_0422): cells whose sight byte is 2 block. */
  sees(x0: number, y0: number, x1: number, y1: number): boolean {
    let x = x0, y = y0
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      if (x === x1 && y === y1) return true
      if ((x !== x0 || y !== y0) && (this.cells[this.bf.get(y, x)]?.sight ?? 2) > 0) return false
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x += sx }
      if (e2 <= dx) { err += dx; y += sy }
    }
  }
  seesF(a: Fighter, b: Fighter) {
    for (const [ax, ay] of footprint(a.size || 1)) for (const [bx, by] of footprint(b.size || 1)) if (this.sees(a.x + ax, a.y + ay, b.x + bx, b.y + by)) return true
    return false
  }
  /** enemies in sight within `range` squares, nearest first (FUN_10ba_2433) */
  enemiesWithin(f: Fighter, range: number) {
    return this.enemies(f).filter((o) => this.dist(f, o) <= range && (range >= 255 || this.seesF(f, o))).sort((a, b) => this.dist(f, a) - this.dist(f, b))
  }
  occupied(x: number, y: number, size: number, except?: Fighter) {
    for (const [dx, dy] of footprint(size)) {
      for (const o of this.fighters) {
        if (o === except || !this.inPlay(o)) continue
        if (footprint(o.size).some(([ox, oy]) => o.x + ox === x + dx && o.y + oy === y + dy)) return o
      }
    }
    return null
  }
  passable(x: number, y: number, size: number) {
    return footprint(size).every(([dx, dy]) => {
      const v = this.bf.get(y + dy, x + dx)
      return v !== 0 && (this.cells[v]?.move ?? 0xff) !== 0xff
    })
  }
  dirToCell(a: Fighter, x: number, y: number) {
    const dx = Math.sign(x - a.x), dy = Math.sign(y - a.y)
    return Math.max(0, DX.findIndex((v, i) => v === dx && DY[i] === dy))
  }
  dirTo(a: Fighter, b: Fighter) {
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y)
    return DX.findIndex((x, i) => x === dx && DY[i] === dy)
  }

  // ------------------------------------------------------------ setup
  /** Combat records, placement (FUN_34c7_12e1, FUN_34c7_19f5). */
  setup(partySize: number, facing: number, distance: number, inMapArea: boolean) {
    const party = this.e.nodes.slice(0, partySize)
    const monsters = this.e.nodes.slice(partySize)
    const all = [...party, ...monsters]
    const face = [7, 2, 3, 6][facing]
    all.forEach((c, i) => {
      this.recalc(c)
      const r = new Uint8Array(22)
      r[0x13] = i >= partySize ? 1 : 0
      r[9] = c[0x10e] ? (face + 4) % 8 : face
      if (c[0x10e] === 0 && r[0x13] && ((c[0x84] & 0x7f) === 0 || (c[0x84] & 0x7f) > 102)) c[0x84] = Math.min(100, this.e.read(0x6dc6)) + 0x80
      this.fighters.push({ c, r, x: 0, y: 0, size: 0, index: i, monster: !!r[0x13], target: null })
    })
    // placement
    const F = [facing, (facing + 2) % 4]
    const inPlay = [0, 1].map((s) => this.fighters.filter((f) => f.c[0x10d] && this.side(f) === s).length)
    const lim = inPlay.map((n) => Math.floor((n + 1) / 2))
    const blocks: [number, number][] = [[0, 0], [DX[facing * 2] * distance, DY[facing * 2] * distance]]
    const T: [number, number][][] = [
      [[1, 0], [1, 0], [1, 0], [2, 9], [3, 10], [4, 10]],
      [[0, 2], [0, 3], [1, 4], [2, 5], [3, 6], [4, 7]],
      [[0, 6], [0, 7], [1, 8], [1, 0], [1, 0], [1, 0]],
      [[3, 6], [4, 7], [5, 8], [6, 9], [7, 10], [8, 10]],
      [[0, 6], [0, 7], [1, 8], [2, 9], [3, 10], [4, 10]],
    ]
    const used = new Set<string>()
    const V: [number, number][] = [[-1, -1], [1, 0], [1, 1], [-1, 0]]
    const D4 = [[0, 0, 1, 3], [1, 1, 0, 2], [2, 2, 1, 3], [3, 3, 2, 0]]
    const RING_DIR = [[4, 6, 2], [6, 4, 0], [0, 6, 2], [2, 0, 4]] // ring 1–3 map directions per F (S, W, E for F0 …)
    const ORIGIN0: [number, number][] = [[5, 3], [4, 2], [5, 2], [6, 3]]
    const ORIGIN1: [number, number][] = [[3, 0], [8, 2], [7, 5], [2, 3]]
    const toArena = (col: number, row: number, bx: number, by: number) => [22 + col + 6 * bx + 5 * by, 10 + row + 5 * by]
    const tryCell = (f: Fighter, s: number, t: number, col: number, row: number, bx: number, by: number) => {
      if (row < 0 || row > 5 || col < 0 || col > 10) return false
      const [mn, mx] = T[t][row]
      if (col < mn || col > mx) return false
      const [X, Y] = toArena(col, row, bx, by)
      const key = `${s}:${t}:${bx}:${by}:${col}:${row}`
      if (used.has(key)) return false
      const size = (f.c[0x6c] & 7) || 1
      if (this.occupied(X, Y, size) || !this.passable(X, Y, size)) return false
      used.add(key)
      f.x = X; f.y = Y
      return true
    }
    const place = (f: Fighter) => {
      const s = this.side(f)
      const Fs = F[s]
      for (let ring = 0; ring < 4; ring++) {
        let [bx, by] = blocks[s]
        if (ring > 0) {
          const d = RING_DIR[Fs][ring - 1]
          bx += DX[d]; by += DY[d]
        }
        const t = ring === 1 ? 4 : Fs
        const d4 = D4[Fs][ring]
        const [ox, oy] = ring === 0 ? ORIGIN0[d4] : ORIGIN1[d4]
        const skipSecond = ring === 0 && Fs % 2 === 1 && !inMapArea
        for (let step = 0; step < 12; step++) {
          if (step === 1 && skipSecond) continue
          const lx = ox + step * V[(d4 + 2) % 4][0], ly = oy + step * V[(d4 + 2) % 4][1]
          if ((lx < 0 || lx > 10) && (ly < 0 || ly > 10)) break
          let n = 0
          for (let k = 0; ; k++) {
            const cands: [number, number][] = k === 0 ? [[lx, ly]]
              : [[lx + k * V[(d4 + 1) % 4][0], ly + k * V[(d4 + 1) % 4][1]], [lx + k * V[(d4 + 3) % 4][0], ly + k * V[(d4 + 3) % 4][1]]]
            let outOne = false
            for (const [cx, cy] of cands) {
              n++
              const outX = cx < 0 || cx > 10, outY = cy < 0 || cy > 10
              if (outX !== outY) outOne = true
              if (!outX && !outY && tryCell(f, s, t, cx, cy, bx, by)) return true
              if (step === 0 ? n >= lim[s] : n > 11) { outOne = true; break }
            }
            if (outOne || k > 12) break
          }
        }
      }
      return false
    }
    for (const f of [...this.fighters]) {
      const ok = place(f)
      const canAct = f.c[0x10d] !== 0
      if (ok && canAct) f.size = (f.c[0x6c] & 7) || 1
      else if (ok && !canAct) {
        f.size = 0
        if (!this.e.duel) { // in a duel the bystanders sit out and leave no body
          this.bodies.push({ f, x: f.x, y: f.y, cell: this.bf.get(f.y, f.x) })
          this.bf.set(f.y, f.x, 0x1f)
        }
      } else if (f.monster) this.removeFighter(f)
      else f.size = 0
    }
    this.fighters.forEach((f, i) => { f.index = i })
  }

  removeFighter(f: Fighter) {
    const i = this.fighters.indexOf(f)
    if (i >= 0) this.fighters.splice(i, 1)
    const j = this.e.nodes.indexOf(f.c)
    if (j >= 0) this.e.nodes.splice(j, 1)
  }

  // ------------------------------------------------------------ battle loop
  async run(surprise: number): Promise<Outcome> {
    this.print('A battle begins...')
    this.e.write(0x6e33, 0)
    for (const f of this.fighters) { fx.round = 0; fx.roll = 0; this.current_ = f; await fire(this, f.c, 8) }
    this.enemyHp()
    this.ui.redraw(this.fighters[0])
    let first = true
    for (let guard = 0; guard < 500 && !this.ended; guard++) {
      for (const f of this.fighters) await this.roundStart(f, first ? surprise : 0)
      first = false
      for (let n = 0; n < 200; n++) {
        const f = this.pickNext()
        if (!f) break
        await this.turn(f)
        if (this.count(0) === 0 || this.ended) break
      }
      if (this.ended || await this.roundEnd()) break
    }
    await this.settle()
    return this.outcome()
  }

  enemyHp() {
    let hp = 0, max = 0
    for (const f of this.fighters) {
      if (this.side(f) !== 1) continue
      if (this.inPlay(f)) hp += f.c[0x11b]
      max += f.c[0x32]
    }
    this.enemyPct = max ? Math.floor((20 * hp) / max) * 5 : 0
  }

  /** Round start (FUN_3aae_0000). */
  async roundStart(f: Fighter, surprise: number) {
    const r = f.r, c = f.c
    r[0] = 0; r[1] = 1; r[2] = 1; r[8] = 0; r[4] = 2
    await this.attacks(f, true)
    r[5] = c[0x6b]
    if (!c[0x10d]) r[3] = 0
    else {
      let init = Math.max(1, this.e.roll(1, 6) + dexMissile(c[0x13]))
      if (surprise & (1 << this.side(f))) init -= 6
      r[3] = init < 0 || init > 20 ? 0 : init
    }
    let m = c[0x11c] + (this.side(f) === 0 ? s8(this.e.read(0x6e72)) : 0)
    if (m < 1 || m > 96) m = 1
    fx.rate = 2 * m; fx.rateIsMove = true
    this.current_ = f
    await fire(this, c, 18)
    fx.rateIsMove = false
    r[6] = Math.min(255, fx.rate)
  }

  /** Attacks per round (FUN_3aae_0d23). */
  async attacks(f: Fighter, roundStart: boolean) {
    const c = f.c, t = this.e.items
    const prev = c[0x113]
    let x2 = c[0xa1]
    const w = this.weaponOf(c)
    const b = w && t ? t.baseOf(w) : undefined
    const missile = w && b && b.range > 1 ? this.ammo(c, w) : null
    if (missile && b) x2 = Math.max(2, b.rate)
    fx.rate = x2; fx.rateIsMove = false
    await fire(this, c, 18)
    let n = Math.floor((fx.rate + (this.round & 1)) / 2)
    if (missile) n = Math.min(n, Math.max(1, missile.count))
    if (f.r[8] === 0 || n < prev || (n < 2 * prev && !missile)) c[0x113] = n
    if (roundStart) {
      fx.rate = c[0xa2]
      await fire(this, c, 18)
      c[0x114] = Math.floor((fx.rate + (this.round & 1)) / 2)
    }
  }

  /** The ammunition a ranged weapon uses (FUN_10ba_2e8b): itself if thrown, arrows, quarrels; a sling needs none. */
  ammo(c: Uint8Array, w: Item): Item | null {
    const b = this.e.items?.baseOf(w)
    if (!b) return null
    if (b.flags & 0x10) return w
    if (b.flags & 0x01) return this.e.itemsOf(c).find((it) => it.ready && it.type === 73) ?? null
    if (b.flags & 0x80) return this.e.itemsOf(c).find((it) => it.ready && it.type === 28) ?? null
    if (b.flags === 0x0a) return w
    return null
  }

  /** Turn order (FUN_320c_0131): highest initiative, ties to the higher d100, then the later entry. */
  pickNext(): Fighter | null {
    let best: Fighter | null = null, bestInit = 0, bestRoll = -1
    for (const f of this.fighters) {
      const d = this.e.roll(1, 100)
      const init = s8(f.r[3])
      if (init <= 0) continue
      if (init > bestInit || (init === bestInit && d >= bestRoll)) { best = f; bestInit = init; bestRoll = d }
    }
    return best
  }

  endTurnF(f: Fighter) { f.r[3] = 0; f.r[0] = 0; f.r[6] = 0; f.r[7] = 0 }

  /** A turn (FUN_320c_01f6). */
  async turn(f: Fighter) {
    f.r[0xf] = 0; f.r[0x12] = 0; f.r[7] = 0
    this.current_ = f
    await fire(this, f.c, 7)
    if (s8(f.r[3]) <= 0) return
    if (f.r[3] === 20) f.r[3] = 19
    this.recalc(f.c)
    this.ui.redraw(f)
    await fire(this, f.c, 15)
    if (s8(f.r[3]) <= 0) return
    if (f.c[0x10f]) await this.ai(f)
    else await this.player(f)
    await this.settle()
    this.ui.redraw(f)
  }

  /** Round end (FUN_320c_0880). Returns true when the battle is over. */
  async roundEnd(): Promise<boolean> {
    const { advanceClock, MINUTE } = await import('./camp')
    await advanceClock(this.e, 1, MINUTE, this, this.fighters.map((f) => f.c))
    this.round = (this.round + 1) & 0xff
    fx.round = this.round
    this.enemyHp()
    for (const f of this.fighters) {
      this.current_ = f
      await fire(this, f.c, 19)
      this.cloudCheck(f)
      if (f.c[0x10c] === 5) {
        f.r[0xe]++
        if (f.r[0xe] >= 10) { f.c[0x10c] = 6; this.print(`${name(f.c)} has died`) }
      }
    }
    if (this.fighters.some((f) => !f.monster && this.side(f) === 0 && f.c[0x10c] === 5)) this.print('Your Teammate is Dying')
    this.ui.redraw()
    await this.settle()
    if (this.count(0) === 0 || this.count(1) === 0) {
      if (this.count(0) > 0 && this.count(1) === 0) return !(await this.ui.confirm('Continue Battle:'))
      return true
    }
    return false
  }

  // ------------------------------------------------------------ player turn
  async player(f: Fighter) {
    const c = f.c
    if (!c[0x10d]) { this.endTurnF(f); return }
    if (f.r[0]) { await this.castSpell(f, this.e.spells!.get(f.r[0])!, false); this.endTurnF(f); return }
    /** where the steps since the last other action began (Escape undoes them) */
    let moved = { x: f.x, y: f.y, m: f.r[6], face: f.r[9] }
    const undo = () => { f.x = moved.x; f.y = moved.y; f.r[6] = moved.m; f.r[9] = moved.face; this.ui.redraw(f) }
    while (s8(f.r[3]) > 0 && this.inPlay(f) && !c[0x10f] && !this.ended) {
      const st = this.e.spells
      const canCast = !!st && f.r[1] === 1 && this.e.read(0x49e5) === 0 && Array.from({ length: 21 }, (_, k) => c[0x17 + k]).some((v) => v > 0 && v < 0x80)
      const flat = !!this.ui.command
      const doneRow = (): [string, string][] => {
        const { canGuard, dying } = this.doneChoices(f)
        const stepped = f.x !== moved.x || f.y !== moved.y
        return [...(canGuard ? [['GUARD', 'g'] as [string, string]] : []), ['DELAY', 'l'], ...(dying ? [['BANDAGE', 'b'] as [string, string]] : []),
          ...(stepped ? [['UNDO', 'z'] as [string, string]] : []), ['QUICK', 'q'], ['END TURN', 'e'], ['SPEED', 's']]
      }
      const opts: [string, string][] = [
        ...(f.r[6] > 1 && !flat ? [['MOVE', 'm'] as [string, string]] : []), ['VIEW', 'v'], ['AIM', 'a'],
        ...(this.e.itemsOf(c).length ? [['USE', 'u'] as [string, string]] : []),
        ...(canCast ? [['CAST', 'c'] as [string, string]] : []),
        ...(c[0x96] > 0 && !f.r[0x11] ? [['TURN', 't'] as [string, string]] : []),
        // IMP-054: with the live command prompt the Done choices sit in the same row
        ...(flat ? doneRow() : [['QUICK', 'q'], ['DONE', 'd']] as [string, string][]),
      ]
      this.ui.redraw(f)
      await this.settle()
      let k: string | undefined
      if (this.ui.command && f.r[6] > 1) {
        // IMP-053: no MOVE to choose; a step is taken straight from the command prompt
        const cmds = opts.filter((o) => o[1] !== 'm')
        const r = await this.ui.command(f, cmds.map((o) => o[0]), `${name(c)}: Move Left = ${f.r[6] >> 1}`, f.r[6] >> 1)
        if (r === 'end') continue
        if (r === 'undo') { undo(); continue }
        if (typeof r === 'number') { if (await this.moveStep(f, r)) moved = { x: f.x, y: f.y, m: f.r[6], face: f.r[9] }; continue }
        k = cmds[r.choice]?.[1]
      } else k = opts[await this.ui.menu(opts.map((o) => o[0]), { prompt: `${name(c)}:` })]?.[1]
      if (k === 'z') { undo(); continue }
      moved = { x: f.x, y: f.y, m: f.r[6], face: f.r[9] }
      if (k === 'm') await this.playerMove(f)
      else if (k === 'v') { await this.ui.view(c); this.recalc(c); await this.attacks(f, false) }
      else if (k === 'a') await this.playerAim(f)
      else if (k === 'u') await this.playerUse(f)
      else if (k === 'c') { await this.playerCast(f); if (f.r[0]) return } // "Begins Casting": the turn ends, the spell goes off when picked again
      else if (k === 't') await this.turnUndead(f)
      else if (k === 'q') {
        c[0x10f] = 1
        // not in the original: how to get them back, and whether they may cast (IMP-054)
        const spells = Array.from({ length: 21 }, (_, i) => c[0x17 + i]).some((v) => v > 0 && v < 0x80)
        this.print(`${name(c)} is on Quick: the computer plays them. Space or TAKE CONTROL to play them yourself.`, { ms: 0 })
        if (spells) this.print(this.magicOn ? 'Magic is On: they may cast spells (Alt-M or MAGIC to stop).' : 'Magic is Off: they will not cast spells (Alt-M or MAGIC to allow).', { ms: 0 })
        await this.ai(f)
        return
      }
      else if (k === 'd') { if (await this.done(f)) return }
      else if (k === 'g') await this.doneAction(f, 'GUARD')
      else if (k === 'l') { await this.doneAction(f, 'DELAY'); return }
      else if (k === 'b') await this.doneAction(f, 'BANDAGE')
      else if (k === 'e') await this.doneAction(f, 'QUIT')
      else if (k === 's') await this.doneAction(f, 'SPEED')
    }
  }

  /** What the Done submenu offers (FUN_320c_0e45): Guard without a non-throwing missile weapon, Bandage while a party member is Dying. */
  doneChoices(f: Fighter) {
    const w = this.weaponOf(f.c)
    const b = w ? this.e.items?.baseOf(w) : undefined
    const canGuard = !b || b.range <= 1 || !!(b.flags & 0x10)
    const dying = this.fighters.some((o) => !o.monster && this.side(o) === 0 && o.c[0x10c] === 5)
    return { canGuard, dying }
  }

  async done(f: Fighter): Promise<boolean> {
    const { canGuard, dying } = this.doneChoices(f)
    const opts = [...(canGuard ? ['GUARD'] : []), 'DELAY', 'QUIT', ...(dying ? ['BANDAGE'] : []), 'SPEED', 'EXIT']
    return this.doneAction(f, opts[await this.ui.menu(opts, { prompt: 'Done:' })])
  }

  /** A Done choice: GUARD, DELAY, QUIT, BANDAGE or SPEED. True when the turn is over for now (Delay). */
  async doneAction(f: Fighter, o: string | undefined): Promise<boolean> {
    if (o === 'SPEED') { // FUN_320c_10f6: S(lower) +1, F(aster) −1, 0–9
      for (;;) {
        const k = await this.ui.menu(['SLOWER', 'FASTER', 'EXIT'], { prompt: `Game Speed = ${this.e.speed} (0=fastest 9=slowest)` })
        if (k === 0) this.e.speed = Math.min(9, this.e.speed + 1)
        else if (k === 1) this.e.speed = Math.max(0, this.e.speed - 1)
        else break
      }
      return false
    }
    if (o === 'GUARD') { this.endTurnF(f); f.r[7] = 1; this.print(`${name(f.c)} is Guarding`) }
    else if (o === 'DELAY') { f.r[3] = 1; return true } // picked again after everyone with higher initiative
    else if (o === 'QUIT') this.endTurnF(f)
    else if (o === 'BANDAGE') {
      const d = this.fighters.find((x) => !x.monster && this.side(x) === 0 && x.c[0x10c] === 5)
      if (d) { d.c[0x10c] = 4; d.r[0xe] = 0; this.print(`${name(d.c)} is bandaged`) }
      this.endTurnF(f)
    }
    return false
  }

  async playerMove(f: Fighter) {
    const start = { x: f.x, y: f.y, m: f.r[6], face: f.r[9] }
    while (f.r[6] > 1 && s8(f.r[3]) > 0 && this.inPlay(f)) {
      const d = await this.ui.step(f, f.r[6] >> 1)
      if (d === 'end') break
      if (d === 'undo') { f.x = start.x; f.y = start.y; f.r[6] = start.m; f.r[9] = start.face; this.ui.redraw(f); continue }
      if (await this.moveStep(f, d)) return
    }
    if (f.r[6] < 2) f.r[6] = 0
  }

  /**
   * One step of Move (FUN_3aae_08b2 and the move loop): into an occupant attacks it, off the field
   * asks "Flee:", a blocked square says so. True when the move is over (an attack or a flight).
   */
  async moveStep(f: Fighter, d: number): Promise<boolean> {
    const nx = f.x + DX[d], ny = f.y + DY[d]
    const o = this.occupied(nx, ny, f.size, f)
    if (o) { await this.meleeByMoving(f, o); return true }
    if (this.bf.get(ny, nx) === 0) {
      if (await this.ui.confirm('Flee:')) { await this.flee(f); return true }
      return false
    }
    if (!this.passable(nx, ny, f.size)) { this.print('Blocked'); return false }
    await this.stepF(f, d)
    this.ui.redraw(f)
    if (f.r[6] < 2) f.r[6] = 0
    return false
  }

  async meleeByMoving(f: Fighter, o: Fighter) {
    const w = this.weaponOf(f.c)
    const b = w ? this.e.items?.baseOf(w) : undefined
    if (b && b.range > 1 && !(b.flags & 0x10)) { this.print('Not with that weapon'); return }
    if (this.side(o) === this.side(f) && !(await this.attackAlly(f))) return
    f.target = o
    if (await this.sweep(f, o)) return
    this.engage(f, o)
    await this.attackF(f, o, false, null)
  }

  async attackAlly(f: Fighter): Promise<boolean> {
    if (!(await this.ui.confirm('Attack Ally:'))) return false
    this.e.write(0x6e33, 1)
    for (const o of this.fighters) if (!o.monster && o.c[0x84] >= 0x80 && o.c[0x10c] === 0) { o.c[0x10e] = 1; o.target = null }
    void f
    return true
  }

  /** Aim (FUN_3aae_3558) for a weapon attack. */
  async playerAim(f: Fighter) {
    const w = this.weaponOf(f.c)
    const b = w ? this.e.items?.baseOf(w) : undefined
    let rng = b ? b.range - 1 : 1
    if (rng <= 0 || rng >= 255) rng = 1
    const missile = !!b && b.range > 1
    const ammo = missile && w ? this.ammo(f.c, w) : null
    const adjacentEnemy = this.enemiesWithin(f, 1).length > 0
    const thrownStr = !!b && (b.flags & 0x14) === 0x14
    const entries = this.aimEntries(f).map((en) => {
      const d = en.cost >> 1
      let ok = !!en.f && en.f !== f && d <= rng && this.canTarget(f, en.f)
      if (ok && missile) ok = !!ammo && (!adjacentEnemy || thrownStr)
      const odds = ok && en.f ? this.hitOdds(f, en.f) : null
      return { ...en, ok, note: odds ? `≈${Math.round(odds.chance * 100)}% to hit, ${odds.damage}` : undefined }
    })
    const pick = await this.ui.aim(f, entries, 'Aim:', false)
    if (!pick || !pick.f) return
    const t = pick.f
    if (this.side(t) === this.side(f) && !(await this.attackAlly(f))) return
    f.target = t
    if (await this.sweep(f, t)) return
    this.engage(f, t)
    const useAmmo = thrownStr && this.dist(f, t) === 1 ? null : missile ? ammo : null
    await this.attackF(f, t, false, useAmmo)
  }

  /** Candidates for Aim: everyone in sight, nearest first, orthogonal before diagonal. */
  aimEntries(f: Fighter): AimEntry[] {
    const list = this.fighters.filter((o) => this.inPlay(o) && (o === f || this.seesF(f, o)))
      .map((o) => ({ f: o, x: o.x, y: o.y, cost: this.cost(f.x, f.y, o.x, o.y), ok: false }))
    list.sort((a, b) => a.cost - b.cost)
    return list
  }

  /** Can target (FUN_3aae_1085): effect events 1 on the target and 0 on the attacker. */
  canTarget(a: Fighter, t: Fighter): boolean {
    if (a === t) return true
    fx.untargetable = false
    const save = a.target
    a.target = t
    const keep = this.current_
    this.current_ = a
    void fire(this, t.c, 1)
    if (!fx.untargetable) void fire(this, a.c, 0)
    this.current_ = keep
    a.target = save
    return !fx.untargetable
  }

  async playerUse(f: Fighter) {
    const st = this.e.spells, t = this.e.items
    if (!st || !t) return
    const items = this.e.itemsOf(f.c).filter((it) => it.ready && (it.props[1] > 0 && it.props[2] < 0x80 || (t.baseOf(it)?.slot ?? 0) >= 11 && (t.baseOf(it)?.slot ?? 0) <= 12))
    if (!items.length) { this.print('Nothing to use'); return }
    const i = await this.ui.pick('Use:', items.map((it) => t.name(it)))
    if (i < 0) return
    const it = items[i]
    const slot = t.baseOf(it)?.slot ?? 0
    let id: number
    if (slot === 11 || slot === 12) {
      const spells = it.props.filter((p) => p > 0).map((p) => p & 0x7f)
      const k = await this.ui.pick('Cast from scroll:', spells.map((s) => st.get(s)?.name ?? `#${s}`), spells.map((s) => { const sp = st.get(s); return sp ? spellText(sp) : '' }))
      if (k < 0) return
      id = spells[k]
      for (let j = 0; j < 3; j++) if ((it.raw[0x3c + j] & 0x7f) === id) { it.raw[0x3c + j] = 0; break }
    } else {
      id = it.props[1] > 0x38 ? it.props[1] - 0x17 : it.props[1]
      if (it.count > 1) it.count--
      else if (it.props[0] > 0 && --it.raw[0x3c] === 0) this.e.itemsOf(f.c).splice(this.e.itemsOf(f.c).indexOf(it), 1)
    }
    const s = st.get(id)
    if (!s) return
    this.print(`${name(f.c)} uses an item`)
    await this.castSpell(f, s, true)
    this.endTurnF(f)
  }

  async playerCast(f: Fighter) {
    const st = this.e.spells!
    const ready = Array.from({ length: 21 }, (_, k) => f.c[0x17 + k]).filter((v) => v > 0 && v < 0x80)
    const i = await this.ui.pick('Cast:', ready.map((id) => st.get(id)?.name ?? `#${id}`), ready.map((id) => { const s = st.get(id); return s ? spellText(s) : '' }))
    if (i < 0) return
    await this.beginCast(f, st.get(ready[i])!)
  }

  /** Cast (FUN_3aae_2414): casting time delays the spell. */
  async beginCast(f: Fighter, s: Spell) {
    if (s.where === 0) { this.print('Camp Only Spell'); return }
    const t = Math.floor(s.castTime / 3)
    if (t === 0) { await this.castSpell(f, s, false); this.endTurnF(f); return }
    this.print(`${name(f.c)} Begins Casting`)
    f.r[0] = s.id
    f.r[3] = Math.max(1, s8(f.r[3]) - t)
  }

  // ------------------------------------------------------------ attacks
  /** Engage (FUN_3aae_17f6). */
  engage(a: Fighter, t: Fighter) {
    t.r[0xf]++
    const toA = this.dirTo(t, a)
    let diff = (toA - t.r[9] + 8) % 8
    if (diff > 4) diff = 8 - diff
    t.r[0x12] = (t.r[0x12] + diff) % 8
  }

  /** Sweep (FUN_3aae_0e82): fighters against creatures under 1 hit die. Returns true if it happened. */
  async sweep(f: Fighter, t: Fighter): Promise<boolean> {
    if (!(f.c[0x113] < f.r[5] && t.c[0x73] === 0 && this.dist(f, t) === 1)) return false
    const near = this.enemiesWithin(f, 1).filter((o) => o.c[0x73] === 0)
    if (near.length <= f.c[0x113]) return false
    const n = Math.min(near.length, f.r[5])
    this.print(`${name(f.c)} sweeps`)
    const order = [t, ...near.filter((o) => o !== t)].slice(0, n)
    for (const o of order) {
      if (!this.inPlay(o)) continue
      f.c[0x113] = 1
      this.engage(f, o)
      await this.attackF(f, o, false, null)
    }
    this.endTurnF(f)
    return true
  }

  /** Attack (FUN_3aae_1884): facing, the attack loop, missile use. */
  async attackF(a: Fighter, t: Fighter, fromBehind: boolean, missile: Item | null) {
    if (t.r[0xf] < 3 && !fromBehind) t.r[9] = this.dirTo(t, a)
    a.r[9] = this.dirTo(a, t)
    a.target = t
    if (a.c[0x113] <= 0 && a.c[0x114] <= 0) return
    const keep = this.current_
    this.current_ = a
    const made = await this.attackLoop(a, t, fromBehind, missile)
    this.current_ = keep
    if (missile && made > 0) {
      const items = this.e.itemsOf(a.c)
      if (missile.count > 0) missile.count = Math.max(0, missile.count - made)
      if (missile.count === 0) {
        const b = this.e.items?.baseOf(missile)
        if (b && b.flags & 0x10 && missile.raw[0x3e] !== 0x89) { const copy = missile.copy(); copy.ready = false; copy.count = 0; this.dropped.push(copy) }
        const i = items.indexOf(missile)
        if (i >= 0) items.splice(i, 1)
      }
      this.recalc(a.c)
    }
    if (a.c[0x113] <= 0 && a.c[0x114] <= 0) this.endTurnF(a)
  }

  helpless(c: Uint8Array) { return this.e.effectsOf(c).some((e) => [31, 51, 52, 53].includes(e.type)) }
  large(c: Uint8Array) { return c[0x6c] > 0x80 || (c[0x6c] & 7) > 1 }

  /** Attack loop (FUN_3aae_1406); returns the attacks made with hand 1. */
  async attackLoop(a: Fighter, t: Fighter, fromBehind: boolean, missile: Item | null): Promise<number> {
    this.firing = missile
    // FUN_3aae_1884: the attacker faces the target in its action frame, Delay(100), the missile flies
    this.ui.redraw()
    this.ui.pose?.(a, true)
    await this.settle()
    await this.ui.pause(100)
    if (missile && (a.x !== t.x || a.y !== t.y)) this.ui.flight?.({ x: a.x, y: a.y }, { x: t.x, y: t.y }, missileFlight(missile.type, a.r[9]))
    try { return await this.attackRolls(a, t, fromBehind) } finally {
      this.firing = null
      this.ui.pose?.(a, false)
    }
  }

  private async attackRolls(a: Fighter, t: Fighter, fromBehind: boolean): Promise<number> {
    fx.hits = [0, 0, 0]
    let made = 0
    a.r[8] = 1
    const ac = a.c, tc = t.c
    if (this.helpless(tc)) {
      this.ui.sound(7)
      this.print(`${name(ac)} slays helpless ${name(tc)} with one cruel blow`)
      this.inflict(t, tc[0x11b] + 5)
      await removeType(this, ac, 25)
      ac[0x113] = ac[0x114] = 0
      return 0
    }
    this.recalc(tc)
    const w = this.weaponOf(ac)
    const b = w ? this.e.items?.baseOf(w) : undefined
    if (this.large(tc) && b) { ac[0x115] = b.large[0]; ac[0x117] = b.large[1]; ac[0x119] = (ac[0x119] + b.large[2] - b.small[2]) & 0xff }
    await fire(this, tc, 11)
    const backstab = this.backstab(a, t)
    let acByte: number
    let kind = 0
    if (backstab) { acByte = tc[0x112] - 2; kind = 2 }
    else if (fromBehind || (t.r[0xf] > 1 && this.dirTo(a, t) === t.r[9] && t.r[0x12] > 4)) { acByte = tc[0x112]; kind = 1 }
    else acByte = tc[0x111]
    if (b && b.range > 1) {
      const band = Math.floor((b.range - 1) / 3), d = this.dist(a, t)
      if (d > band) acByte += 2
      if (d > 2 * band) acByte += 3
    }
    let hit = false
    for (let h = a.r[4] || 2; h >= 1; h--) {
      while (ac[0x112 + h] > 0 && this.inPlay(t)) {
        ac[0x112 + h]--
        a.r[4] = h
        if (h === 1) made++
        if (this.helpless(tc) || await this.toHit(ac, tc, acByte)) {
          hit = true
          fx.hits[h]++
          let dmg = this.e.roll(ac[0x114 + h], ac[0x116 + h]) + s8(ac[0x118 + h])
          if (backstab) dmg *= Math.floor(ac[0x9c] / 4) + 2
          fx.dmg = dmg & 0xff; fx.dmgType = 0; fx.spell = 0
          await fire(this, ac, 4)
          await fire(this, tc, 5)
          const verb = kind === 2 ? '-Backstabs-' : 'Attacks'
          const n = fx.dmg
          // a hit: the line, sound 7 and the message pause; weapons have no flash (FUN_3aae_1406)
          this.print(`${name(ac)} ${verb} ${name(tc)}${kind === 1 ? ' (from behind)' : ''} Hitting for ${n} point${n === 1 ? '' : 's'} of damage`)
          this.ui.sound(7)
          await this.settle() // the target falls after its hit display
          this.inflict(t, n)
          if (this.inPlay(t)) await fire(this, ac, h + 1)
        }
      }
    }
    // all missed: the line, sound 9 and the pause
    if (!hit) { this.print(`${name(ac)} Attacks ${name(tc)} and Misses`); this.ui.sound(9) }
    a.r[5] = 0
    this.recalc(ac)
    await this.settle()
    return made
  }

  /**
   * The odds of one weapon attack (IMP-058): the AC byte the attack would use (FUN_3aae_1884: back-
   * stab, from behind, missile range bands), then the d20 rolls 2–20 (20 counts as 100) that reach it
   * with the attacker's THAC0 byte and its side's bonus. Effects that change the roll (Bless, Prayer,
   * Invisibility and the like) are left out, hence "≈". Damage: the weapon's dice for the target's size.
   */
  hitOdds(a: Fighter, t: Fighter): { chance: number; damage: string } {
    const ac = a.c, tc = t.c
    const w = this.weaponOf(ac)
    const b = w ? this.e.items?.baseOf(w) : undefined
    let acByte = this.backstab(a, t) ? tc[0x112] - 2
      : t.r[0xf] > 1 && this.dirTo(a, t) === t.r[9] && t.r[0x12] > 4 ? tc[0x112] : tc[0x111]
    if (b && b.range > 1) {
      const band = Math.floor((b.range - 1) / 3), d = this.dist(a, t)
      if (d > band) acByte += 2
      if (d > 2 * band) acByte += 3
    }
    const bonus = s8(this.e.read(ac[0x10e] ? 0x6e70 : 0x6e71))
    let n = 0
    for (let r = 2; r <= 20; r++) if (acByte <= (r === 20 ? 100 : r) + ac[0x110] + bonus) n++
    const chance = this.helpless(tc) ? 1 : n / 20
    const [cnt, sides, plus] = this.large(tc) && b ? [b.large[0], b.large[1], s8(ac[0x119]) + b.large[2] - b.small[2]] : [ac[0x115], ac[0x117], s8(ac[0x119])]
    return { chance, damage: `${cnt}d${sides}${plus ? (plus > 0 ? '+' : '') + plus : ''}` }
  }

  backstab(a: Fighter, t: Fighter): boolean {
    const c = a.c
    if (c[0x9c] <= 0) return false
    const items = this.e.itemsOf(c), tb = this.e.items
    const armour = items.find((it) => it.ready && tb?.baseOf(it)?.slot === 2)
    if (armour && armour.type !== 50) return false
    const w = this.weaponOf(c)
    if (w && ![7, 8, 35, 36, 37].includes(w.type)) return false
    return t.r[0xf] > 1 && this.dirTo(a, t) === t.r[9]
  }

  /** To-hit (FUN_5216_0cb7). */
  async toHit(a: Uint8Array, t: Uint8Array, acByte: number): Promise<boolean> {
    await removeType(this, a, 25)
    let r = this.e.roll(1, 20)
    if (r <= 1) return false
    if (r === 20) r = 100
    fx.roll = r
    await fire(this, a, 10)
    await fire(this, t, 16)
    if (fx.roll < 0) return false
    const bonus = s8(this.e.read(a[0x10e] ? 0x6e70 : 0x6e71))
    return acByte <= fx.roll + a[0x110] + bonus
  }

  /** Saving throw (FUN_5216_0d63). */
  saveSync(c: Uint8Array, type: number, bonus: number): boolean {
    const r = this.e.roll(1, 20)
    if (r === 1) return false
    if (r === 20) return true
    fx.save = r + s8(c[0x101]) + bonus
    fx.saveType = type
    void fire(this, c, 12)
    return c[0x6d + type] <= fx.save
  }

  /** Non-weapon damage (FUN_5216_1344). */
  damageSync(c: Uint8Array, dmg: number, mode: number, saved: boolean) {
    fx.dmg = dmg
    void fire(this, c, 6)
    let d = fx.dmg
    if (saved) d = mode === 1 ? 0 : mode === 2 ? d >> 1 : d
    const f = this.of(c)
    if (f && d > 0) {
      // FUN_5216_1344 → FUN_10ba_1feb: the line, the starburst once with sound 3, then the pause
      this.print(damageText(name(c), d, fx.dmgType), { ms: 0 })
      this.ui.effect?.(f, 'burst', 1, this.e.speed * 225)
    }
    if (f) this.inflict(f, d)
    else c[0x11b] = Math.max(0, c[0x11b] - d)
  }
  /** an effect's line without a pause, then the sparkle (FUN_10ba_1feb with "good") */
  announce(c: Uint8Array, msg: string) {
    this.print(line(name(c), msg), { ms: 0 })
    this.sparkle(c)
  }
  /** an effect took hold on c (FUN_5216_1656 → FUN_10ba_1feb): the sparkle, (speed + 1) cycles, sound 4 */
  sparkle(c: Uint8Array) {
    const f = this.of(c)
    if (f && this.inPlay(f)) this.ui.effect?.(f, 'sparkle', this.e.speed + 1, this.e.speed === 0 ? this.e.speed * 225 : 0)
  }

  /** inflict (FUN_10ba_2228) and its consequences (FUN_3aae_02f9). */
  inflict(t: Fighter, dmg: number) {
    const c = t.c
    const hp = c[0x11b]
    let left = hp - dmg, over = 0
    if (left < 0) { over = -left; left = 0 }
    if (over > 9 || (left === 0 && c[0x10c] === 1)) c[0x10c] = 6
    else if (over > 0) { c[0x10c] = 5; t.r[0xe] = over }
    else if (left === 0) c[0x10c] = 4
    if (dmg > 0) {
      t.r[1] = 0
      if (t.r[0]) { this.print(`${name(c)} lost a spell`); if (this.current_) forget(this.current_.c, t.r[0]); t.r[0] = 0 }
    }
    if (c[0x10c] !== 0 && c[0x10c] !== 1) {
      c[0x11b] = 0
      c[0x10d] = 0
      this.print(c[0x10c] === 4 ? `${name(c)} goes down` : c[0x10c] === 5 ? `${name(c)} goes down and is Dying` : `${name(c)} is killed`)
      // FUN_5216_100a removes through FUN_5216_0026, so removal callbacks run (a grab frees its victim,
      // a charm ends); the callbacks' synchronous part runs here, the record goes at once
      const list = this.e.effectsOf(c)
      for (const e of [...list]) {
        if (![7, 11, 30, 31, 32, 51, 52, 53, 54, 58, 59, 74, 75, 95, 98, 137].includes(e.type)) continue
        void removeEffect(this, c, e)
        const j = list.indexOf(e)
        if (j >= 0) list.splice(j, 1)
      }
      void fire(this, c, 13)
      this.downF(t)
    } else c[0x11b] = left
  }

  /**
   * The fall (FUN_577f_0e11): the fallen-body picture (RandCom frame 5) over every cell the combatant
   * covered, sound 5 and the message pause. Only a party entry (R[0x13] = 0) leaves a body: its cell
   * becomes 0x1F (kept 0x1E under a Stinking Cloud) and the old cell is remembered. A monster's body
   * goes again when the window is redrawn from the cells.
   */
  downF(t: Fighter) {
    this.endTurnF(t)
    if (t.size > 0) {
      const cells = footprint(t.size).map(([dx, dy]) => ({ row: t.y + dy, col: t.x + dx }))
      if (!t.r[0x13]) {
        this.bodies.push({ f: t, x: t.x, y: t.y, cell: this.bf.get(t.y, t.x) })
        const v = this.bf.get(t.y, t.x)
        if (v !== 0 && v !== 0x1e) this.bf.set(t.y, t.x, 0x1f)
      }
      this.ui.fall?.(cells, this.e.speed * 225, t)
    }
    t.size = 0
    this.ui.redraw()
  }

  // ------------------------------------------------------------ movement
  /** A step with attacks of opportunity (FUN_3aae_08b2) and guards (FUN_3aae_0712). */
  async stepF(f: Fighter, d: number) {
    const cost = d % 2 ? 3 : 2
    if (cost > f.r[6]) { f.r[6] = 0; return }
    const nx = f.x + DX[d], ny = f.y + DY[d]
    // attacks of opportunity from enemies left behind
    const adjacent = this.enemiesWithin(f, 1)
    for (const e of adjacent) {
      if (!this.inPlay(f)) break
      const still = Math.max(Math.abs(e.x - nx), Math.abs(e.y - ny)) <= 1
      if (still || this.helpless(e.c) || !this.canTarget(e, f)) continue
      if (this.e.effectsOf(e.c).some((x) => x.type === 0x4a || x.type === 0x4b)) continue
      let toward = (this.dirTo(e, f) - e.r[9] + 8) % 8
      if (toward > 4) toward = 8 - toward
      if (!(s8(e.r[3]) > 0 || e.r[0xf] === 0 || toward <= 2)) continue
      const hand = e.c[0x114] > 0 ? 2 : 1
      if (e.c[0x112 + hand] <= 0) e.c[0x112 + hand] = 1
      const keep = e.target
      e.r[4] = hand
      await this.attackF(e, f, true, null)
      e.target = keep
    }
    if (!this.inPlay(f)) return
    f.r[6] -= cost
    f.x = nx; f.y = ny
    f.r[0xf] = 0; f.r[0x12] = 0 // walking does not change the facing R[9] (FUN_3aae_0712)
    // guards
    for (const g of this.enemiesWithin(f, 1)) {
      if (!g.r[7] || this.helpless(g.c) || !this.inPlay(f)) continue
      g.r[7] = 0
      this.print(`${name(g.c)} reacts`)
      await this.attackF(g, f, false, null)
    }
    this.cloudCheck(f)
    if (!this.inPlay(f) || this.helpless(f.c)) f.r[6] = 0
    // each step plays the footstep (sound 10) in transient mode, which holds the game for delay(10 cs)
    this.ui.sound(10)
    this.ui.redraw(f)
    await this.settle()
    await this.ui.pause(100)
  }

  /** Fleeing (FUN_3aae_0c6a). */
  async flee(f: Fighter) {
    const own = this.moveOf(f) >> 1
    let ok: boolean
    if (this.enemiesWithin(f, 255).every((e) => !this.seesF(f, e))) ok = true
    else {
      const fast = Math.max(0, ...this.enemies(f).map((e) => this.moveOf(e) >> 1))
      ok = fast < own || (fast === own && this.e.roll(1, 2) === 1)
    }
    if (ok) {
      this.print(`${name(f.c)} Got Away`)
      f.c[0x10c] = 3; f.c[0x10d] = 0
      f.size = 0
    } else this.print('Escape is blocked')
    this.endTurnF(f)
    this.ui.redraw()
  }

  moveOf(f: Fighter) {
    let m = f.c[0x11c] + (this.side(f) === 0 ? s8(this.e.read(0x6e72)) : 0)
    if (m < 1 || m > 96) m = 1
    if (this.e.effectsOf(f.c).some((x) => x.type === 0x27)) m *= 2
    if (this.e.effectsOf(f.c).some((x) => x.type === 0x2a)) m >>= 1
    return 2 * m
  }

  // ------------------------------------------------------------ turn undead
  async turnUndead(f: Fighter) {
    this.print(`${name(f.c)} turns undead...`)
    f.r[0x11] = 1
    let count = this.e.roll(1, 12), minimum = 6
    const r = this.e.roll(1, 20)
    const L = f.c[0x96]
    const col = L >= 1 && L <= 8 ? L - 1 : L <= 13 && L >= 9 ? 8 : 9
    const TABLE = [
      [10, 7, 4, 1, 1, 0, 0, -1, -1, -1], [13, 10, 7, 1, 1, 0, 0, 0, -1, -1], [16, 13, 10, 4, 1, 1, 0, 0, 0, -1],
      [19, 16, 13, 7, 4, 1, 1, 0, 0, -1], [20, 19, 16, 10, 7, 4, 1, 1, 0, 0], [99, 20, 19, 13, 10, 7, 4, 1, 1, 0],
      [99, 99, 20, 16, 13, 10, 7, 4, 1, 0], [99, 99, 99, 20, 16, 13, 10, 7, 4, 1], [99, 99, 99, 99, 20, 16, 13, 10, 7, 1],
      [99, 99, 99, 99, 99, 20, 16, 13, 10, 4],
    ]
    let any = false
    while (count > 0) {
      const t = this.enemiesWithin(f, 255).filter((e) => !e.r[0x10] && e.c[0x76] > 0).sort((a, b) => a.c[0x76] - b.c[0x76])[0]
      if (!t) break
      const v = TABLE[Math.min(t.c[0x76], 10) - 1][col]
      if (r < Math.abs(v)) break
      any = true
      if (v >= 1) { this.announce(t.c, 'is turned'); t.r[0x10] = 1 }
      else { this.print(`${name(t.c)} Is destroyed`); t.c[0x10c] = 8; t.c[0x10d] = 0; this.downF(t) }
      if (minimum > 0) minimum--
      count--
      if (count === 0 && minimum > 0 && v < 0) count = 1
    }
    if (!any) this.print('Nothing Happens...')
    this.endTurnF(f)
  }

  // ------------------------------------------------------------ spells
  /** Cast a spell now (FUN_4e53_0c20): choose targets, then apply. */
  async castSpell(f: Fighter, s: Spell, fromItem: boolean) {
    const c = f.c
    const L = casterLevel(c, s, fromItem)
    let range = s.range[0] === 0xff ? 1 : (s.range[0] + s.range[1] * L) & 0xff
    if (range === 0 && (s.target & 0xf) !== 0) range = 1
    const targets = await this.spellTargets(f, s, range)
    if (targets === null) {
      if (!c[0x10f] && (await this.ui.confirm('Abort Spell?'))) { this.print('Spell Aborted'); if (!fromItem) forget(c, s.id) }
      return
    }
    if (!fromItem) forget(c, s.id)
    // FUN_4e53_331a in combat: "Casts a Spell" with the pause, then "Spell: name" on the status line
    this.print(`${name(c)} Casts a Spell`)
    this.print(`Spell: ${s.name}`, { ms: 0 })
    // FUN_4e53_0c20: the caster turns to the aim point in its action frame, the spell bolt flies there
    const aim = this.aimed
    if (aim && (aim.x !== f.x || aim.y !== f.y)) {
      f.r[9] = this.dirToCell(f, aim.x, aim.y)
      this.ui.pose?.(f, true)
      this.ui.flight?.({ x: f.x, y: f.y }, aim, { frames: cycle(5), delay: 30, sounds: [s.id === 47 ? 11 : s.id === 51 ? 8 : 2, 0] })
      this.ui.pose?.(f, false)
    } else this.ui.sound(s.id === 47 ? 11 : s.id === 51 ? 8 : 2)
    fx.spell = s.id
    fx.area = (s.target & 0xf) >= 8 && (s.target & 0xf) <= 14
    try { await this.applySpell(f, s, L, targets) } finally { fx.spell = 0; fx.area = false }
    await this.ui.pause(200)
  }

  /** Targets (FUN_3aae_20c3): self, one or several picks, or an area around the aimed square. */
  async spellTargets(f: Fighter, s: Spell, range: number): Promise<Fighter[] | null> {
    const mode = s.target & 0xf
    this.aimed = { x: f.x, y: f.y }
    if (mode === 0 || s.target === 240) return [f]
    const ai = !!f.c[0x10f]
    const pickOne = async (allowEmpty: boolean, area?: (x: number, y: number) => { x: number; y: number }[]): Promise<AimEntry | null> => {
      if (ai) {
        if (!s.aiHostile) {
          if (s.id === 3) {
            const near = this.fighters.filter((o) => this.inPlay(o) && this.side(o) === this.side(f) && this.dist(f, o) <= 1 && o.c[0x11b] < o.c[0x32])
            near.sort((a, b) => a.c[0x11b] - b.c[0x11b])
            const p = near[0] ?? f
            return { f: p, x: p.x, y: p.y, cost: 0, ok: true }
          }
          return { f, x: f.x, y: f.y, cost: 0, ok: true }
        }
        for (let i = 0; i < 20; i++) {
          const list = this.enemiesWithin(f, range)
          if (!list.length) return null
          const t = list[this.e.roll(1, list.length) - 1]
          if (s.area > 0 && this.fighters.some((o) => this.inPlay(o) && this.side(o) === this.side(f) && this.dist(t, o) <= s.area)) continue
          if (this.helpless(t.c) && [51, 52, 53, 31].includes(s.effect)) continue
          return { f: t, x: t.x, y: t.y, cost: 0, ok: true }
        }
        return null
      }
      const entries = this.aimEntries(f).map((en) => ({ ...en, ok: (en.cost >> 1) <= range && !!en.f && this.canTarget(f, en.f) }))
      return this.ui.aim(f, entries, `Target for ${s.name}:`, allowEmpty, area)
    }
    if (mode === 0xf) { const p = await pickOne(false); if (p) this.aimed = { x: p.x, y: p.y }; return p?.f ? [p.f] : null }
    if (mode >= 8 && mode <= 14) {
      let radius = mode & 7
      if (s.id === 47 && this.e.read(0x49e6) === 0) radius = Math.min(radius, 2)
      // the squares the spell would cover from a centre, for the preview (IMP-059); Stinking Cloud
      // takes the aimed square and those E, SE and S of it
      const area = (x: number, y: number) => {
        if (s.id === 34) return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((p) => this.passable(p.x, p.y, 1))
        const out: { x: number; y: number }[] = []
        for (let dy = -radius - 1; dy <= radius + 1; dy++) for (let dx = -radius - 1; dx <= radius + 1; dx++) {
          const cx = x + dx, cy = y + dy
          if (this.bf.get(cy, cx) === 0) continue
          if (this.cost(x, y, cx, cy) <= 2 * radius + 1 && this.sees(x, y, cx, cy)) out.push({ x: cx, y: cy })
        }
        return out
      }
      const p = await pickOne(true, area)
      if (!p) return null
      const centre = { x: p.x, y: p.y }
      this.aimed = centre
      return this.fighters.filter((o) => this.inPlay(o) && footprint(o.size).some(([dx, dy]) =>
        this.cost(centre.x, centre.y, o.x + dx, o.y + dy) <= 2 * radius + 1 && this.sees(centre.x, centre.y, o.x + dx, o.y + dy)))
    }
    const n = (mode & 3) + 1
    const out: Fighter[] = []
    for (let i = 0; i < n; i++) {
      const p = await pickOne(false)
      if (!p?.f) continue
      if (out.includes(p.f)) { if (!ai) { this.print('Already been targeted'); i-- } continue }
      if (!out.length) this.aimed = { x: p.x, y: p.y }
      out.push(p.f)
    }
    return out.length ? out : null
  }

  /** Spell effects in combat (spec/spells.md, "Per spell"). */
  async applySpell(f: Fighter, s: Spell, L: number, targets: Fighter[]) {
    const c = f.c
    const dur = spellDuration(this.e, s, L, true)
    const add = async (t: Fighter, saved = false, type = s.effect, d = dur, pw = L, flag = 0) => {
      if (type) await addEffect(this, t.c, type, d, pw, flag, s.save, saved, false, SPELL_MSG[s.id] ?? '')
    }
    const saveOf = (t: Fighter, bonus = 0) => (s.save ? this.saveSync(t.c, s.saveType, bonus) : false)
    const touch = async (t: Fighter) => s.range[0] !== 0xff || await this.toHit(c, t.c, t.c[0x111])
    if (await sharedSpell(this, this.e, c, s, L, dur, targets.map((t) => t.c))) { for (const t of targets) this.recalc(t.c); return }
    switch (s.id) {
      case 27: { // Snake Charm (190f): ignores targeting; snakes (type 0x0E) while the caster's HP lasts
        let pool = c[0x11b]
        for (const t of this.fighters) {
          if (t.c[0x9f] !== 0x0e || t.c[0x11b] > pool) continue
          pool -= t.c[0x11b]
          await addEffect(this, t.c, 0x33, 0, L, 0, 0, false, false, 'is charmed')
        }
        break
      }
      case 1: case 2: { // Bless / Curse
        const mine = targets.filter((t) => (s.id === 1 ? this.side(t) === this.side(f) && (this.enemiesWithin(t, 1).length === 0) : this.side(t) !== this.side(f)))
        for (const t of mine) await add(t)
        break
      }
      case 3: case 62: { // 4e53_106b: no sparkle; FUN_10ba_234a's line when the healing took
        const t = targets[0]
        if (t && healChar(t.c, this.e.effectsOf(t.c), s.id === 3 ? this.e.roll(1, 8) : this.e.roll(2, 4) + 2, false, true)) healedLine(this, t.c)
        break
      }
      case 4: case 20: { // Cause Light Wounds, Shocking Grasp
        const t = targets[0]
        if (!t) break
        if (!(await touch(t))) { this.print(`${name(c)} misses`); break }
        fx.dmgType = s.id === 4 ? 8 : 0x0c
        this.damageSync(t.c, s.id === 4 ? this.e.roll(1, 8) : L + this.e.roll(1, 8), 0, false)
        break
      }
      case 9: { const t = targets[0]; if (t) { fx.dmgType = 9; this.damageSync(t.c, L, 0, false) } break }
      case 15: case 65: { // Magic Missile, Wand of Magic Missiles
        const t = targets[0]
        if (!t) break
        fx.dmgType = 8
        const dmg = s.id === 15 ? this.e.roll(L >> 1, 4) + (L >> 1) : this.e.roll(2, 4) + 2
        this.damageSync(t.c, dmg, 0, false)
        break
      }
      case 21: { // Sleep
        let pool = this.e.roll(4, 4)
        const costOf = (t: Uint8Array) => { const hd = s8(t[0x73]); return hd <= 1 ? (hd < 0 ? 20 : 1) : hd === 2 ? 2 : hd === 3 ? 4 : hd === 4 ? 6 : hd === 5 ? (t[0x2e] === 0 ? 10 : 20) : 20 }
        for (const t of targets.sort((a, b) => this.dist(f, a) - this.dist(f, b))) {
          if (t.c[0x10c] === 1 || this.e.effectsOf(t.c).some((x) => x.type === 0x35)) continue
          const k = costOf(t.c)
          if (k > pool) continue
          pool -= k
          await addEffect(this, t.c, 0x35, dur, L, 0, 0, false, false, 'falls asleep')
        }
        break
      }
      case 23: case 49: { // Hold Person
        const n = targets.length
        const bonus = n === 1 ? (s.id === 23 ? -2 : -3) : n === 2 ? -1 : 0
        for (const t of [...targets].reverse()) {
          // 4e53_1658: sound 2 and a bolt to each target before its save, except the last-listed one (I: a bug)
          if (t !== targets[targets.length - 1]) this.ui.flight?.({ x: f.x, y: f.y }, { x: t.x, y: t.y }, { frames: cycle(5), delay: 30, sounds: [2, 0] })
          const saved = t.c[0x9f] > 1 || t.c[0x6c] > 1 || this.saveSync(t.c, s.saveType, bonus)
          await addEffect(this, t.c, 0x34, dur, L, 0, 1, saved, false, 'is held')
        }
        break
      }
      case 10: { // Charm Person
        const t = targets[0]
        if (!t) break
        if (t.c[0x9f] > 1 || t.c[0x6c] > 1) { this.print(`${name(t.c)} is unaffected`); break }
        await addEffect(this, t.c, 0x0b, dur, (L + this.side(f) * 128) & 0xff, 1, 1, saveOf(t), true, 'is charmed')
        break
      }
      case 47: case 64: { // Fireball, Necklace of Missiles
        const n = s.id === 47 ? L : this.e.roll(1, 3) * 2 + 1
        const dmg = this.e.roll(n, 6)
        fx.dice = n
        if (s.id === 47) this.ui.look?.(this.aimed) // the view centres on the aim point; no burst graphic of its own
        for (const t of targets) { fx.dmgType = 9; this.damageSync(t.c, dmg, 2, saveOf(t)) }
        break
      }
      case 51: { // Lightning Bolt (FUN_4e53_2bb7, path FUN_4e53_295b, hit FUN_4e53_28bc)
        const dmg = this.e.roll(L, 6)
        const at = (x: number, y: number) => ({ occ: this.occupied(x, y, 1), v: this.bf.get(y, x) })
        const hit = (x: number, y: number) => {
          const { occ, v } = at(x, y)
          if (occ) { fx.dmgType = 0x0c; this.damageSync(occ.c, dmg, 2, this.saveSync(occ.c, 4, 0)); fx.dmgType = 0 }
          return v > 0 && (this.cells[v]?.move ?? 0xff) === 0xff
        }
        let { x: ox, y: oy } = this.aimed
        hit(ox, oy)
        if (f.x === ox && f.y === oy) break
        let last = at(ox, oy).occ
        let segFrom = { x: ox, y: oy }
        let sign = 1, first = true, remaining = 16
        while (remaining > 0) {
          const line = new Line(ox, oy, ox + sign * (ox - f.x) * remaining, oy + sign * (oy - f.y) * remaining)
          for (;;) {
            let here = at(line.x, line.y)
            for (;;) {
              const ok = line.step()
              here = at(line.x, line.y)
              if (!ok || (here.occ && here.occ !== last) || here.v === 0 || (this.cells[here.v]?.move ?? 0xff) > 1 || line.cost >= remaining) break
            }
            last = here.occ
            // each segment of the bolt flies as lightning, 4 frames at 50 ms (FUN_4e53_295b)
            if (line.x !== segFrom.x || line.y !== segFrom.y) this.ui.flight?.(segFrom, { x: line.x, y: line.y }, { frames: cycle(6), delay: 50 })
            segFrom = { x: line.x, y: line.y }
            if (here.v === 0) remaining = 0
            const bounce = hit(line.x, line.y)
            if (bounce) {
              // the bolt comes straight back through the caster (bug: not at the angle of incidence)
              ox = line.x; oy = line.y
              const back = new Line(ox, oy, f.x, f.y)
              while (back.step());
              if (first && back.cost <= 8) line.cost = (line.cost + 8) & 0xff
              sign = -sign; first = false; last = null
            }
            // bug kept: the cumulative cost is taken off at every stop
            remaining = line.cost < remaining ? remaining - line.cost : 0
            if (bounce || remaining === 0) break
          }
        }
        this.ui.redraw()
        break
      }
      case 48: case 55: { // Haste / Slow
        const mine = targets.filter((t) => (s.id === 48 ? this.side(t) === this.side(f) : this.side(t) !== this.side(f))).slice(0, L)
        const opposite = s.id === 48 ? 0x2a : 0x27
        for (const t of mine) {
          if (this.e.effectsOf(t.c).some((x) => x.type === opposite)) { await removeType(this, t.c, opposite); continue }
          await add(t)
          await this.attacks(t, false)
        }
        break
      }
      case 34: { // Stinking Cloud (FUN_4e53_1b11): the aimed square is the upper left of 4 (DS:290D: here, E, SE, S)
        const n = this.clouds.length ? Math.max(...this.clouds.map((z) => z.n)) + 1 : 1
        const z: Cloud = { owner: c, n: n & 0x0f, cells: [] }
        for (const [dx, dy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
          const x = this.aimed.x + dx, y = this.aimed.y + dy
          const v = this.bf.get(y, x)
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS || (this.cells[v]?.move ?? 0xff) === 0xff) continue
          z.cells.push({ x, y, old: v })
          this.bf.set(y, x, 0x1e)
        }
        this.clouds.push(z)
        addRaw(this, c, 0x28, L, ((z.n << 4) + L) & 0xff, 1)
        // the line without a pause, the redraw showing the cloud, then the pause
        this.print(`${name(c)} Creates a noxious cloud`, { ms: 0 })
        this.ui.show?.()
        this.ui.hold?.(this.e.speed * 225)
        this.ui.redraw()
        for (const t of z.cells) {
          const o = this.occupied(t.x, t.y, 1)
          if (o) this.cloudCheck(o)
        }
        break
      }
      case 32: if (targets[0]) addRaw(this, targets[0].c, 0x1c, dur, this.e.roll(1, 4), 0); break
      case 33: case 38: case 40: case 44: { // touch / save effects
        const t = targets[0]
        if (!t) break
        if (s.range[0] === 0xff && !(await touch(t))) { this.print(`${name(c)} misses`); break }
        await add(t, saveOf(t), s.effect, dur, L, s.id === 40 ? 1 : 0)
        break
      }
      case 60: { const t = targets[0]; if (t) { fx.dmgType = 0x0c; this.damageSync(t.c, 20 + this.e.roll(1, 6), 2, this.saveSync(t.c, 4, 0)) } break }
      case 61: for (const t of targets) await addEffect(this, t.c, 0x34, this.e.roll(5, 4), L, 0, 1, this.saveSync(t.c, 0, 0)); break
      default:
        for (const t of targets) await add(t, saveOf(t))
    }
    for (const t of targets) this.recalc(t.c)
  }

  // ------------------------------------------------------------ computer AI
  /** The computer's turn (FUN_3334_000f), simplified where marked. */
  async ai(f: Fighter) {
    const c = f.c
    if (!c[0x10d]) { this.endTurnF(f); return }
    let p = f.r[0x15]
    if (p === 0 || p > 4 || this.e.roll(1, 4) === 1) p = this.e.roll(1, 8) === 8 ? 4 + this.e.roll(1, 2) : this.e.roll(1, 4)
    f.r[0x15] = p
    if (await this.morale(f)) return
    if (f.r[0x14] && !f.r[0x10]) this.print(`${name(c)} flees in panic`)
    if (f.r[0]) { await this.castSpell(f, this.e.spells!.get(f.r[0])!, false); this.endTurnF(f); return }
    if (c[0x96] > 0 && !f.r[0x11] && this.enemiesWithin(f, 255).some((e) => e.c[0x76] > 0 && !e.r[0x10])) { await this.turnUndead(f); return }
    if (await this.aiCast(f)) return
    this.chooseWeapon(f)
    for (let tries = 0; tries < 20 && s8(f.r[3]) > 0 && this.inPlay(f); tries++) {
      while (f.r[0x14] && f.r[6] > 1 && s8(f.r[3]) > 0 && s8(f.r[3]) < 20) {
        if (!(await this.aiStep(f, true))) break
        if (!this.inPlay(f)) return
      }
      if (!this.inPlay(f) || s8(f.r[3]) <= 0) return
      const w = this.weaponOf(c)
      const b = w ? this.e.items?.baseOf(w) : undefined
      let reach = b ? b.range - 1 : 1
      if (reach <= 0 || reach >= 255) reach = 1
      let t = f.target && this.inPlay(f.target) && this.side(f.target) !== this.side(f) && this.dist(f, f.target) <= reach && this.seesF(f, f.target) && this.canTarget(f, f.target) ? f.target : null
      if (!t) {
        const near = this.enemiesWithin(f, reach).filter((e) => this.canTarget(f, e))
        if (!near.length) {
          const goal = this.findTarget(f)
          if (!goal) { this.finishRound(f); return }
          f.target = goal
          if (!(await this.aiStep(f, false))) { this.finishRound(f); return }
          continue
        }
        t = near[this.e.roll(1, near.length) - 1]
        if (b && b.range > 1 && !(b.flags & 0x10) && this.enemiesWithin(f, 1).length) { this.chooseWeapon(f, true); continue }
      }
      f.target = t
      if (await this.sweep(f, t)) return
      this.engage(f, t)
      const missile = b && b.range > 1 && w ? (this.dist(f, t) === 1 && (b.flags & 0x14) === 0x14 ? null : this.ammo(c, w)) : null
      await this.attackF(f, t, false, missile)
      return
    }
    this.finishRound(f)
  }

  finishRound(f: Fighter) {
    const w = this.weaponOf(f.c)
    const b = w ? this.e.items?.baseOf(w) : undefined
    if (this.helpless(f.c) || (b && b.range > 1) || s8(f.r[3]) <= 0) { this.endTurnF(f); return }
    this.endTurnF(f)
    f.r[7] = 1
  }

  /** Target finder (FUN_3aae_37e4): keep a valid target, else a random enemy (terrain ignored on a second pass). */
  findTarget(f: Fighter): Fighter | null {
    if (f.target && this.inPlay(f.target) && this.side(f.target) !== this.side(f) && this.canTarget(f, f.target)) return f.target
    for (const pass of [0, 1]) {
      const list = this.enemies(f).filter((e) => pass === 1 || this.seesF(f, e))
      for (let i = 0; i < 20 && list.length; i++) {
        const t = list[this.e.roll(1, list.length) - 1]
        if (this.canTarget(f, t)) return t
      }
    }
    return null
  }

  /** One AI step towards the target, or away when fleeing (FUN_3334_07f2). */
  async aiStep(f: Fighter, fleeing: boolean): Promise<boolean> {
    if (f.r[6] < 2 || s8(f.r[3]) <= 0) return false
    if (f.c[0x2f] === 5 && !fleeing) return false
    let base: number
    if (fleeing) {
      const face = [7, 2, 3, 6][this.e.facing]
      base = this.side(f) === 0 ? (face + 4) % 8 : face
    } else {
      if (!f.target) return false
      base = this.dirTo(f, f.target)
    }
    const PREFS = [[0, -1, -2, 1, 2], [0, 1, 2, -1, -2], [-1, 1, 0, -2, 2], [1, -1, 0, 2, -2], [0, -1, -2, -3, 4], [0, 1, 2, 3, 4]]
    for (const off of PREFS[(f.r[0x15] || 1) - 1]) {
      const d = (base + off + 8) % 8
      const nx = f.x + DX[d], ny = f.y + DY[d]
      if (this.bf.get(ny, nx) === 0) { if (fleeing) { await this.flee(f); return false } continue }
      if (this.occupied(nx, ny, f.size, f) || !this.passable(nx, ny, f.size)) continue
      if (this.bf.get(ny, nx) === 0x1e && !this.e.effectsOf(f.c).some((x) => [0x20, 0x1e, 0x6f, 0x7d].includes(x.type))) continue
      if ((d % 2 ? 3 : 2) > f.r[6]) return false
      await this.stepF(f, d) // paced there, as for the player
      return true
    }
    return false
  }

  /** Morale (FUN_3334_10d7); true if the creature surrendered (ends the turn). */
  async morale(f: Fighter): Promise<boolean> {
    const c = f.c
    f.r[0x14] = 0
    if (f.r[0x10]) { f.r[0x14] = 1; this.print(`${name(c)} is forced to flee`); return false }
    if (c[0x84] < 0x80) return false
    let m = (c[0x84] & 0x7f) * 2
    if (m > 102) m = 0
    fx.morale = m
    await fire(this, c, 17)
    m = fx.morale
    const lost = 100 - Math.floor((100 * c[0x11b]) / Math.max(1, c[0x32]))
    if (m !== 0 && m >= lost) return false
    fx.morale = this.enemyPct
    await fire(this, c, 17)
    if (fx.morale !== 0 && fx.morale >= 100 - this.e.read(0x6dc6) && this.side(f) !== 0) return false
    const fast = Math.max(0, ...this.enemies(f).map((e) => this.moveOf(e) >> 1))
    if (fast <= this.moveOf(f) >> 1) { f.r[0x14] = 1; return false }
    if (c[0x11] > 5) {
      this.print(`${name(c)} Surrenders`)
      c[0x10c] = 4; c[0x11b] = 0; c[0x10d] = 0
      this.downF(f)
      return true
    }
    return false
  }

  /** Spell choice for the AI (FUN_3334_0545 with FUN_3334_02eb). */
  async aiCast(f: Fighter): Promise<boolean> {
    const c = f.c, st = this.e.spells
    // FUN_3334_0545: R[1], a ready spell, an NPC or monster or "Magic On" (DS:6E30), and enemies still in
    // play; the area's no-magic flag 0x49E5 is not tested here (only the player's Cast and AI item use check it)
    if (!st || !f.r[1]) return false
    if (c[0x84] <= 0x7f && !this.magicOn) return false
    if (!this.enemies(f).length) return false
    const mem = Array.from({ length: 21 }, (_, k) => c[0x17 + k]).filter((v) => v > 0 && v < 0x80)
    if (!mem.length) return false
    const passes = this.e.roll(1, 7)
    for (let pass = 0; pass < passes; pass++) {
      const pri = 7 - pass
      for (let k = 0; k < 3; k++) {
        const s = st.get(mem[this.e.roll(1, mem.length) - 1])
        if (!s || s.aiPriority < pri) continue
        if (!s.aiHostile && s.id !== 3) { await this.beginCast(f, s); return true }
        const L = casterLevel(c, s)
        const range = s.range[0] === 0xff ? 1 : s.range[0] + s.range[1] * L
        const enemies = this.enemiesWithin(f, range)
        if (!enemies.length) continue
        if (s.area > 0 && enemies.every((e) => this.fighters.some((o) => this.inPlay(o) && this.side(o) === this.side(f) && this.dist(e, o) <= s.area))) continue
        await this.beginCast(f, s)
        return true
      }
    }
    return false
  }

  /** Weapon score (FUN_3334_128d), in byte arithmetic. `otherHands` = hands in use apart from weapon and shield. */
  weaponScore(f: Fighter, it: Item, otherHands: number): number {
    const b = this.e.items!.baseOf(it)!
    let v = (b.small[0] * b.small[1]) & 0xff
    if (it.plus > 0) v = (v + 8 * it.plus) & 0xff
    if (b.small[2] > 0) v = (v + 2 * b.small[2]) & 0xff
    if (it.type === 0x55 && f.target && s8(f.target.c[0x76]) > 0) v = 8 // holy water against undead
    if (b.flags & 8) v = (v + 2 * (b.rate - 1)) & 0xff
    if (b.hands <= 1) v = (v + 3) & 0xff
    if (otherHands + b.hands > 3) v = 0
    if (it.props[2] === 0x84 && (it.props[1] & 0x0f) !== f.c[0xa0]) v = 0 // alignment-locked
    if (it.props[1] === 0x53) v = 0 // Javelin of Lightning
    if (it.cursed) v = 0
    return v
  }

  /**
   * Weapon choice (FUN_3334_13ca): best ranged (flag 8 or 0x10) and best melee (no flag 8) against
   * the natural attack; the ranged weapon wins if it scores more than half the melee score, has
   * ammunition and either can be thrown in melee or no enemy is adjacent. Then hands and the shield.
   */
  chooseWeapon(f: Fighter, _meleeOnly = false) {
    const t = this.e.items
    if (!t) return
    const c = f.c
    const items = this.e.itemsOf(c)
    const base = (it: Item) => t.baseOf(it)
    const weapon = () => items.find((it) => it.ready && base(it)?.slot === 0) ?? null
    const shield = () => items.find((it) => it.ready && base(it)?.slot === 1) ?? null
    const cur = weapon(), curShield = shield()
    const otherHands = c[0x100] - (cur ? base(cur)!.hands : 0) - (curShield ? base(curShield)!.hands : 0)
    let ranged: Item | null = null, rangedScore = 1
    let melee: Item | null = null
    let meleeScore = (c[0xa3] * c[0xa5]) & 0xff
    if (s8(c[0xa7]) > 0) meleeScore = (meleeScore + 2 * s8(c[0xa7])) & 0xff
    let bestShield: Item | null = null, shieldScore = 0
    for (const it of items) {
      const b = base(it)
      if (!b || !(b.classes & c[0xb0])) continue
      if (b.slot === 0) {
        const v = this.weaponScore(f, it, otherHands)
        if ((b.flags & 0x18) && v > rangedScore) { ranged = it; rangedScore = v }
        if (!(b.flags & 8) && v > meleeScore) { melee = it; meleeScore = v }
      } else if (b.slot === 1) {
        const v = it.plus >= 0 ? (it.plus + 1) & 0xff : 0
        if (v > shieldScore) { bestShield = it; shieldScore = v }
      }
    }
    let pick = melee
    if (ranged) {
      const b = base(ranged)!
      const throwMelee = b.range > 1 && (b.flags & 0x14) === 0x14
      let ammo: Item | null = null
      if (b.flags & 0x10) ammo = ranged
      if (b.flags & 8) {
        if (b.flags & 1) ammo = items.find((it) => it.ready && it.type === 73) ?? null // arrows (char+0xF8)
        if (b.flags & 0x80) ammo = items.find((it) => it.ready && it.type === 28) ?? null // quarrels (char+0xFC)
      }
      const hasAmmo = !!ammo || b.flags === 0x0a
      if (rangedScore > meleeScore >> 1 && hasAmmo && (throwMelee || this.enemiesWithin(f, 1).length === 0)) pick = ranged
    }
    let changed = false
    if (cur !== pick && !(cur && cur.cursed)) {
      if (cur) cur.ready = false
      if (pick) pick.ready = true
      changed = true
    }
    this.recalc(c)
    const sh = shield()
    const swapShield = !(sh === bestShield || (sh && sh.cursed))
    if (c[0x100] > 2) {
      if (sh && sh.cursed) { if (pick) pick.ready = false } else if (sh) sh.ready = false
      changed = true
    } else if (c[0x100] < 2 && swapShield) {
      if (sh) sh.ready = false
      this.recalc(c)
      if (bestShield) bestShield.ready = true
      changed = true
    }
    this.recalc(c)
    if (changed) this.ui.redraw()
  }

  // ------------------------------------------------------------ outcome
  /**
   * Space during a computer-run turn (FUN_3334_0fc1): every party member who is not an NPC and not
   * Animated comes back under the player's control. Returns their names. The original polls the key
   * as a computer-run turn starts (a party member's turn then goes on by hand with initiative 20);
   * here it takes effect at once, so their next turn is played by hand.
   */
  takeControl(): string[] {
    const back: string[] = []
    for (const f of this.fighters) {
      const c = f.c
      if (f.monster || c[0x84] >= 0x80 || c[0x10c] === 1 || !c[0x10f]) continue
      c[0x10f] = 0
      back.push(name(c))
    }
    return back
  }

  /** Debug (IMP-025): every enemy still standing falls at once; the aftermath runs as for a won battle. */
  debugWin() {
    for (const f of this.fighters) {
      if (this.side(f) !== 1 || f.c[0x10c] === 3) continue
      f.c[0x10c] = 6; f.c[0x10d] = 0; f.c[0x11b] = 0; f.size = 0
    }
    this.ended = true
  }

  outcome(): Outcome {
    const party = this.fighters.filter((f) => !f.monster)
    if (party.some((f) => [0, 1].includes(f.c[0x10c]))) return 'won'
    if (party.some((f) => f.c[0x10c] === 3 && f.c[0x84] < 0x80)) return 'fled'
    // FUN_2e08_04c9: with ECL 0x6DE6 = 1 any non-NPC on the party's side keeps the party from defeat
    if (this.e.read(0x6de6) === 1 && party.some((f) => f.c[0x10e] === 0 && f.c[0x84] < 0x80)) return 'spared'
    return 'destroyed'
  }
}

/**
 * Aftermath (FUN_2e08_1527): outcome in ECL 0x6DC7, experience (FUN_2e08_0000, FUN_2e08_0355),
 * cleanup (FUN_2e08_11ac) and NPC shares (FUN_2e08_12e8). Monster loot goes to the treasure list.
 * Returns the experience share shown in the summary, and whether the party survived.
 */
export function aftermath(e: Engine, b: Battle, outcome: Outcome): { share: number; survived: boolean; messages: string[] } {
  const msgs: string[] = []
  const party = b.fighters.filter((f) => !f.monster)
  e.write(0x6dc7, 0)
  let share = 0
  /** Experience (FUN_2e08_0000) with its loot, and the award (FUN_2e08_0355). */
  const experience = (noXP: number) => {
    if (e.duel && e.read(0x6de6)) return ((e.duelist ?? e.cur)[0x73] * 100) & 0xffff // duel: no loot, no division
    let total = 0, taken = 0
    const loot: Item[] = []
    for (const f of b.fighters) {
      const c = f.c
      if (c[0x10e] !== 1 || c[0x10c] === 3) continue
      for (let i = 0; i < 7; i++) e.money[i] += u16(c, 0x88 + 2 * i)
      total += u16(c, 0xb8) + s8short(c[0xb1] * c[0xba])
      if (e.read(0x6de3) !== 1) {
        for (const it of e.itemsOf(c)) {
          if (it.value > 0 || (taken < 8 && e.roll(1, 10) <= 3)) { const copy = it.copy(); copy.ready = false; loot.unshift(copy); taken++ }
        }
      }
    }
    const m = e.money
    total += Math.floor(m[0] / 200) + Math.floor(m[1] / 20) + Math.floor(m[2] / 2) + m[3] + 5 * m[4] + 250 * m[5] + 2200 * m[6]
    for (const it of loot) if (it.plus > 0) total += 400 * it.plus
    e.treasure = [...loot, ...b.dropped, ...e.treasure]
    const eligible = party.length - noXP
    return eligible > 0 ? Math.floor(total / eligible) : 0
  }
  const award = (share: number) => {
    for (const f of party) {
      const c = f.c
      if (!c[0x10d] || c[0x10c] === 1) continue
      const prime: Record<number, number> = { 0: 0x12, 2: 0x10, 5: 0x11, 6: 0x13 }
      let add = share
      if (c[0x2f] in prime) { if (c[prime[c[0x2f]]] > 15) add += Math.floor(share / 10) }
      else if ([8, 10, 11, 12, 13, 14, 16].includes(c[0x2f])) add = Math.floor(share / 2)
      else if ([9, 15].includes(c[0x2f])) add = Math.floor(share / 3)
      const xp = (c[0xac] | (c[0xad] << 8) | (c[0xae] << 16) | (c[0xaf] << 24)) >>> 0
      const v = xp + add
      c[0xac] = v & 0xff; c[0xad] = (v >> 8) & 0xff; c[0xae] = (v >> 16) & 0xff; c[0xaf] = (v >>> 24) & 0xff
    }
  }
  if (e.duel) {
    // duel branch (FUN_2e08_04c9 with DS:84D4 set): never a defeat; each one standing on the party's
    // side earns the experience; then the bystanders come back into play and Dying becomes Unconscious
    let won = false
    for (const f of b.fighters) {
      const c = f.c
      if (c[0x10d] === 1 && c[0x10c] === 0 && c[0x10e] !== 1) { won = true; share = experience(0); award(share) }
    }
    for (const f of party) {
      if (f.c[0x10c] === 0 || f.c[0x10c] === 1) f.c[0x10d] = 1
      if (f.c[0x10c] === 5) f.c[0x10c] = 4
    }
    // FUN_2e08_0916 for a duel
    if (won) {
      msgs.push('You have won the duel.')
      if (e.treasure.length || e.money.some((v) => v > 0)) msgs.push('The party has found Treasure!')
      msgs.push(`The duelist receives ${share} experience points.`)
    } else msgs.push('You have lost the duel.')
  } else if (outcome === 'spared') {
    // not defeated, nobody standing: the same status changes as a win, but no experience or loot
    for (const f of party) {
      const c = f.c
      if (c[0x10c] === 5) c[0x10c] = 4
      else if (c[0x10c] === 4 && c[0x11b] > 0) { c[0x10c] = 0; c[0x10d] = 1 }
    }
  } else if (outcome === 'won') {
    let noXP = 0
    for (const f of party) {
      const c = f.c
      if (c[0x10c] === 3) { c[0x10c] = 0; c[0x10d] = 1 }
      else if (c[0x10c] === 5) c[0x10c] = 4
      else if (c[0x10c] === 4 && c[0x11b] > 0) { c[0x10c] = 0; c[0x10d] = 1 }
      if (c[0x10d] === 0 || c[0x10c] === 1) noXP++
    }
    share = experience(noXP)
    award(share)
    msgs.push('The party has won.')
    if (e.treasure.length || e.money.some((v) => v > 0)) msgs.push('The party has found Treasure!')
    msgs.push(`Each character receives ${share} experience points.`)
  } else if (outcome === 'fled') {
    e.write(0x6dc7, 0x81)
    for (const f of party) {
      if (f.c[0x10c] === 3) { f.c[0x10c] = 0; f.c[0x10d] = 1 }
      else { const i = e.nodes.indexOf(f.c); if (i >= 0) e.nodes.splice(i, 1); e.inventory.delete(f.c) }
    }
    msgs.push('The party has fled.', 'Each character receives 0 experience points.')
  } else {
    e.write(0x6dc7, 0x80)
    msgs.push('The END!', 'The monsters rejoice for the party has been destroyed')
    // every party entry leaves the list; party size 0 (spec/combat.md, Results)
    for (const f of party) { const i = e.nodes.indexOf(f.c); if (i >= 0) e.nodes.splice(i, 1); e.inventory.delete(f.c); e.effects.delete(f.c) }
    e.write(0x6e3e, 0)
    e.quit = true
  }
  // cleanup: monsters and side-1 entries leave the list; 0x6DC8 counts those out of play
  let defeated = 0
  for (const f of b.fighters) {
    if (!f.monster && f.c[0x10e] !== 1) continue
    if (!f.c[0x10d]) defeated++
    const i = e.nodes.indexOf(f.c)
    if (i >= 0) e.nodes.splice(i, 1)
    e.inventory.delete(f.c)
    e.effects.delete(f.c)
  }
  e.write(0x6dc8, defeated)
  // only the party is left in the list now: the party size follows it (members lost when the party
  // fled, or gone over to the other side, are no longer counted; FUN_417f_3291 lowers it per member)
  if (!e.quit) e.write(0x6e3e, e.nodes.length)
  // NPC shares: an Okay NPC's cut of the money disappears
  const npcs = e.party().filter((c) => c[0x84] >= 0x80 && c[0x10c] === 0)
  const npcShares = npcs.reduce((a, c) => a + (c[0x85] & 7), 0)
  if (npcShares > 0) {
    const totalShares = npcShares + e.party().length - npcs.length
    for (let i = 0; i < 7; i++) {
      if (!e.money[i]) continue
      const per = Math.floor(e.money[i] / totalShares) & 0xff
      e.money[i] = Math.max(0, e.money[i] - per * npcShares)
    }
    for (const c of npcs) if (c[0x85]) msgs.push(`${name(c)} takes and hides his share.`)
  }
  for (const a of [0x6e70, 0x6e71, 0x6e72, 0x6de3, 0x6de6]) e.write(a, 0)
  e.monstersCleared()
  const survived = e.duel || outcome !== 'destroyed'
  e.duel = false
  e.duelist = null
  return { share, survived, messages: msgs }
}

/** A signed 16-bit product, as the original multiplies (never large with shipped data). */
const s8short = (v: number) => ((v & 0xffff) << 16) >> 16

/**
 * A whole battle (ECL COMBAT with monsters, FUN_29c3_179b): battlefield, placement, rounds and the
 * aftermath. Returns the battle (for the screen) and the aftermath result.
 */
export async function fight(e: Engine, ui: CombatUi, onReady?: (b: Battle) => void) {
  const img = e.startImage
  if (!img || !e.items) throw new Error('combat needs START.EXE and ITEMS')
  const roll = (n: number) => e.roll(1, n)
  let bf: Battlefield
  if (e.overland && e.wild) {
    const [gx, gy] = e.wildPosition
    bf = wildBattlefield(e.wild.map[gy * 44 + gx], e.read(0x4ab3), roll)
  } else if (e.geo) bf = mapBattlefield(e.geo, e.x, e.y, roll, e.area)
  else bf = wildBattlefield(1, 0, roll)
  const b = new Battle(e, ui, bf, cellTable(img))
  const partySize = e.party().length
  const distance = Math.min(2, e.read(0x6dc1))
  b.setup(partySize, e.facing, distance, !e.overland)
  onReady?.(b)
  const surprise = e.read(0x6dcb)
  e.write(0x6dcb, 0)
  const outcome = await b.run(surprise)
  return { battle: b, ...aftermath(e, b, outcome) }
}

export { footprint, COLS, ROWS, u16 }
