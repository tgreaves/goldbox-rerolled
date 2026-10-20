// Combat (spec/combat.md): battle setup and placement, rounds, turns, attacks, movement, morale, the
// computer's AI and the aftermath. The screen is behind CombatUi so the rules can run headless.
import type { Engine } from '../vm/engine'
import type { Item } from '../data/items'
import type { Spell } from '../data/spells'
import type { Effect } from '../data/effects'
import { COLS, ROWS, cellTable, mapBattlefield, wildBattlefield, type Battlefield, type CellInfo } from './battlefield'
import { dexMissile, recalc } from './equip'
import { fx, fire, damageText, healedLine, addEffect, addRaw, removeEffect, removeFirst, removeType, runEffect, type FxHost } from './effects'
import { heal as healChar } from './camp'
import { amount, castShared, line, spellSpec, term } from './spellkinds'
import type { Amount, SpellSpec } from '../games/spellrules'
import { spellText } from './spelltext'
import { casterLevel, duration as spellDuration, forget } from './magic'
import { F } from '../games/fields'
import { R, formerLevelsCount } from '../games/rules'
import { T } from '../games/tables'
import { Tables } from './chargen'

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

const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
const u16 = (c: Uint8Array, o: number) => c[o] | (c[o + 1] << 8)
const s8 = (v: number) => (v << 24) >> 24

/** A spell's range (FUN_4e53_0729): byte 2 + byte 3 × level as a byte; touch (0xFF) 1; 0 with targets 1. */
function spellRange(s: Spell, L: number) {
  const range = s.range[0] === 0xff ? 1 : (s.range[0] + s.range[1] * L) & 0xff
  return range === 0 && (s.target & 0xf) !== 0 ? 1 : range
}

/** Footprint cells (FUN_577f_0000): 1 = 1×1, 2 = 1 wide × 2 tall, 3 = 2 wide × 1 tall, 4 = 2×2. */
function footprint(size: number): [number, number][] {
  return size === 2 ? [[0, 0], [0, 1]] : size === 3 ? [[0, 0], [1, 0]] : size === 4 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]
}

/** The line walker (FUN_46c1_01a0 init, FUN_46c1_02cc step): Bresenham, cost 2 straight, 3 diagonal (byte). */
export class Line {
  x: number
  y: number
  cost = 0
  /** the direction of the last step, 0 N … 7 NW clockwise (the record's +0x17, CotAB 0x54EE4); 8 before any */
  dir = 8
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
    const x = this.x, y = this.y
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
    this.dir = DX.findIndex((v, i) => v === Math.sign(this.x - x) && DY[i] === Math.sign(this.y - y))
    return true
  }
}

/**
 * A cloud zone (PoR's 19-byte records at DS:6DBB; CotAB's 0x1E-byte ones, Stinking Cloud at DS:7575 and
 * Cloudkill at DS:7579): its owner, number, the cell value it draws (one list per value), the aimed
 * square it was laid from, the cells it replaced, and CotAB's "resisted" byte (+0x1D, Dispel Magic).
 */
interface Cloud { owner: Uint8Array; n: number; cell: number; x: number; y: number; cells: { x: number; y: number; old: number }[]; resisted: boolean }
/** One cast in combat: the caster, the spell at level L with its duration, and its targets. */
interface BattleCast { f: Fighter; s: Spell; L: number; dur: number; targets: Fighter[] }

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
    if ([6, 7, 8].includes(c[F.status])) return
    if (msg) this.print(msg)
    c[F.status] = status
    if (status !== 0 && status !== 1) { c[F.inPlay] = 0; c[F.hp] = 0; const f = this.of(c); if (f) this.downF(f) }
  }
  setTarget(c: Uint8Array, t: Uint8Array) { const f = this.of(c); if (f) f.target = this.of(t) }
  damage(c: Uint8Array, dmg: number, mode: number, saved: boolean) { this.damageSync(c, dmg, mode, saved) }
  save(c: Uint8Array, type: number, bonus: number) { return this.saveSync(c, type, bonus) }
  heal(c: Uint8Array, amount: number, force: boolean) { return healChar(c, this.e.effectsOf(c), amount, force, true) }
  revive(c: Uint8Array, hp: number) {
    const f = this.of(c)
    if (!f || this.occupied(f.x, f.y, f.size || 1, f)) return false
    c[F.status] = 0; c[F.inPlay] = 1; c[F.hp] = Math.min(hp, c[F.maxHp])
    f.size = (c[F.sizeFlags] & 7) || 1
    this.print(`${name(c)} ${c[F.side] ? 'stands up and grins' : 'gets back up'}`) // FUN_5216_1869
    return true
  }
  recalc(c: Uint8Array) { if (this.e.items) recalc(c, this.e.itemsOf(c), this.e.items) }
  tables() { return this.e.startImage ? new Tables(this.e.startImage) : null }
  enemiesNear(c: Uint8Array, range: number) { const f = this.of(c); return f ? this.enemiesWithin(f, range).map((x) => x.c) : [] }
  byIndex(i: number) { return this.fighters[i]?.c ?? null }
  indexOf(c: Uint8Array) { return this.of(c)?.index ?? 0 }
  async attack(a: Uint8Array, t: Uint8Array) { const fa = this.of(a), ft = this.of(t); if (fa && ft) await this.attackF(fa, ft, false, null) }
  /** the weapon, or the ammunition being fired by the current attacker (FUN_3723_101d) */
  weapon(c: Uint8Array) { return c === this.current_?.c && this.firing ? this.firing : this.weaponOf(c) }
  private firing: Item | null = null
  weaponKind(type: number) { return this.e.items?.base[type]?.kind ?? 0 }
  /**
   * The owner's zone expiring (effect 0x28, spec/effects.md; CotAB 0x5B, 0x28E09): the zone of cells
   * `cell` numbered power >> 4 lifts, a body's square going back to the body cell; the other zones of
   * that list are drawn again over it. False when there is no such zone.
   */
  clearCloud(c: Uint8Array, power: number, cell = 0x1e) {
    const i = this.clouds.findIndex((z) => z.owner === c && z.n === power >> 4 && z.cell === cell)
    if (i < 0) return false
    const [z] = this.clouds.splice(i, 1)
    for (const t of z.cells) {
      const body = this.bodies.find((b) => b.x === t.x && b.y === t.y && b.f.size === 0)
      if (body) { body.cell = t.old; this.bf.set(t.y, t.x, 0x1f) } else this.bf.set(t.y, t.x, t.old)
    }
    for (const o of this.clouds) if (o.cell === cell) for (const t of o.cells) this.bf.set(t.y, t.x, o.cell)
    this.ui.redraw()
    return true
  }
  /**
   * The cloud occupant check (PoR FUN_5216_0ae7, CotAB 0x4B8F7), by the game's rule (R.clouds): `gas`
   * only when `moving` (a step or a cast; at round end too where the rule says so), CotAB's `kill` always
   */
  async cloudCheck(t: Fighter, moving = true) {
    const rule = R.clouds
    const on = (cell: number) => this.inPlay(t) && footprint(t.size).some(([dx, dy]) => this.bf.get(t.y + dy, t.x + dx) === cell)
    if (moving && on(rule.gas.cell) && !this.e.effectsOf(t.c).some((x) => rule.gas.immune.includes(x.type))) {
      const saved = this.saveSync(t.c, 0, 0)
      if (rule.gas.apply) {
        // 0x4B9C3: the zone over the creature's square (0x4B7B3) is the current character meanwhile;
        // the add-effect routine (event 9, its line with the sparkle), then the record's handler
        const z = this.clouds.find((o) => o.cell === rule.gas.cell && o.cells.some((q) => q.x === t.x && q.y === t.y))
        const keep = this.current_
        if (z) this.current_ = this.of(z.owner) ?? keep
        const [type, dur, msg] = saved ? [0x1e, 1, 'starts to cough'] : [0x1f, this.e.roll(1, 4) + 1, 'chokes and gags from nausea']
        await addEffect(this, t.c, type, dur, 0xff, 0, 0, saved, true, msg) // I: runs the new record (the original the first of its type)
        this.current_ = keep
      } else if (saved) { this.print(`${name(t.c)} starts to cough`); addRaw(this, t.c, 0x1e, 1, 0xff, 0) }
      else { this.print(`${name(t.c)} chokes and gags from nausea`); addRaw(this, t.c, 0x1f, this.e.roll(1, 4) + 1, 0xff, 0); this.endTurnF(t) }
    }
    const kill = rule.kill
    if (kill && on(kill.cell)) {
      // 0x4BB2F: by hit dice; a band without a save dies, else a failed save does
      const hd = s8(t.c[F.hitDice])
      const band = kill.bands.find(([lo, hi]) => hd >= lo && hd <= hi)
      if (band && (band[2] === null || !this.saveSync(t.c, kill.save, band[2]))) {
        this.print(`${name(t.c)} is Poisoned`)
        addRaw(this, t.c, kill.poison, 0, 0xff, 0)
        this.setStatus(t.c, 6, `${name(t.c)} is killed`)
      }
    }
  }
  /**
   * A cloud's squares from the aimed square: the spec's `cells`, or `count` direction indices from entry 1
   * of the table `dirs` (T.gasCloud, T.killCloud) through the direction vectors (T.wallDx / wallDy; 8 is
   * the square itself). Null for a spell that lays no cloud, or without START.EXE.
   */
  cloudCells(p: SpellSpec): number[][] | null {
    if (p.cells) return p.cells as number[][]
    const t = this.tables(), ref = p.dirs ? T[p.dirs as 'gasCloud' | 'killCloud'] : null
    if (!t || !ref || ref.at < 0) return null
    return Array.from({ length: p.count as number }, (_, i) => { const d = t.b(ref.at + 1 + i); return [s8(t.b(T.wallDx.at + d)), s8(t.b(T.wallDy.at + d))] })
  }

  // ------------------------------------------------------------ the battlefield for the monster specials
  cellOf(c: Uint8Array) { const f = this.of(c); return f ? { x: f.x, y: f.y } : null }
  choose(prompt: string, items: string[]) { return this.ui.menu(items, { prompt }) }
  ask(prompt: string) { return this.ui.confirm(prompt) }
  async aimSpell(c: Uint8Array, id: number) {
    const f = this.of(c), s = this.e.spells?.get(id)
    if (!f || !s) return false
    return (await this.spellTargets(f, s, spellRange(s, casterLevel(c, s, false)), true)) !== null
  }
  pickTarget(c: Uint8Array, forceNew: boolean) {
    const f = this.of(c)
    if (!f) return null
    f.target = this.findTarget(f, forceNew)
    return f.target?.c ?? null
  }
  async castAs(c: Uint8Array, id: number) {
    const f = this.of(c), s = this.e.spells?.get(id)
    if (f && s) await this.castSpell(f, s, false, true)
  }
  flyCells(from: { x: number; y: number }, to: { x: number; y: number }, slot: number, count: number, delay: number) {
    this.ui.flight?.(from, to, { frames: cycle(slot - 13).slice(0, count), delay })
  }
  /** the bolt hit on a cell (PoR FUN_4e53_28bc, CotAB 0x478F6 with no creature to skip) */
  boltHit(x: number, y: number, dmg: number, save: number) { this.boltCell(x, y, dmg, save, null, false) }
  /**
   * One stop of a bolt (PoR FUN_4e53_28bc, CotAB 0x478F6): the creature on the cell is hit (with
   * R.bolt.skipLast not the one hit at the previous stop, `last`); the bolt bounces off a cell of
   * movement 0xFF (with mapAreaOnly only in a map area, ECL 0x49E6 = 1; with noRepeatBounce not when
   * `bounced` is still set). Damage type 0x0C, a save of `save` halves.
   */
  private boltCell(x: number, y: number, dmg: number, save: number, last: Fighter | null, bounced: boolean): boolean {
    const rule = R.bolt
    const occ = this.occupied(x, y, 1), v = this.bf.get(y, x)
    const bounce = v > 0 && (this.cells[v]?.move ?? 0xff) === 0xff && (!rule.mapAreaOnly || this.e.read(0x49e6) === 1) && !(rule.noRepeatBounce && bounced)
    if (occ && !(rule.skipLast && occ === last)) {
      fx.dmgType = 0x0c
      this.damageSync(occ.c, dmg, 2, this.saveSync(occ.c, save, 0))
      fx.dmgType = 0
    }
    return bounce
  }
  /**
   * The bolt path (PoR FUN_4e53_295b, CotAB 0x479B4, spec/combat.md "Lightning Bolt"): from the aimed
   * square away from c, 2·len half-squares; it stops at each new creature, a cell 0 (the end), a cell of
   * movement above 1 or the length, and hits there (boltCell). A bounce makes that cell the new origin
   * and sends the bolt straight back through c (the last-hit memory cleared); on the first bounce, with
   * `bounceBonus`, a wall within 8 half-squares of c costs 8 more. PoR takes the line's cumulative cost
   * off at every stop (a bug); with R.bolt.chargeSinceLast (CotAB) only what was added since the previous
   * stop, which after a bounce (a new line whose cost starts at 0) wraps below zero as a byte and ends
   * the bolt (O, 0x47C01); noRepeatBounce clears its flag on each cell of movement 1 crossed.
   */
  bolt(c: Uint8Array, len: number, dmg: number, save: number, bounceBonus: boolean) {
    const f = this.of(c)
    if (!f || (f.x === this.aimed.x && f.y === this.aimed.y)) return
    const rule = R.bolt
    const move = (v: number) => this.cells[v]?.move ?? 0xff
    const at = (x: number, y: number) => ({ occ: this.occupied(x, y, 1), v: this.bf.get(y, x) })
    let { x: ox, y: oy } = this.aimed
    let last = at(ox, oy).occ
    let sign = 1, first = bounceBonus, remaining = (2 * len) & 0xff, bounced = false, prev = 0
    fx.area = true
    while (remaining > 0) {
      const line = new Line(ox, oy, ox + sign * (ox - f.x) * remaining, oy + sign * (oy - f.y) * remaining)
      for (;;) {
        const from = { x: line.x, y: line.y }
        let here = at(line.x, line.y)
        for (;;) {
          const ok = line.step()
          here = at(line.x, line.y)
          if (move(here.v) === 1) bounced = false
          if (!ok || (here.occ && here.occ !== last) || here.v === 0 || move(here.v) > 1 || line.cost >= remaining) break
        }
        const before = last
        last = here.occ
        if (here.v === 0) remaining = 0
        // each segment flies as lightning, 4 frames at 50 ms (FUN_10ba_19de(19))
        if (line.x !== from.x || line.y !== from.y) this.ui.flight?.(from, { x: line.x, y: line.y }, { frames: cycle(6), delay: 50 })
        const bounce = this.boltCell(line.x, line.y, dmg, save, before, bounced)
        bounced = bounce
        if (bounce) {
          // the bolt comes straight back through the caster (bug: not at the angle of incidence)
          ox = line.x; oy = line.y
          this.aimed = { x: ox, y: oy }
          const back = new Line(ox, oy, f.x, f.y)
          while (back.step());
          if (first && back.cost <= 8) line.cost = (line.cost + 8) & 0xff
          sign = -sign; first = false; last = null
        }
        const spent = rule.chargeSinceLast ? (line.cost - prev) & 0xff : line.cost
        prev = line.cost
        remaining = spent < remaining ? remaining - spent : 0
        if (bounce || remaining === 0) break
      }
    }
    fx.area = false
  }
  /**
   * CotAB's area template 0x4573F(x0, y0, x, y, width, len): the line from c's cell to (x, y) is walked
   * and its step directions repeated past the end until the cost reaches 2·len half-squares or the end
   * leaves 1..48 × 1..23; the end is clamped to the field and brought back to where the line of sight
   * stops (the routine 11c:39, whose range is an uninitialised word, ?: taken as unlimited); then who
   * stands on that line, in order (once a creature is met a second time, nobody further is added: the
   * repeat flag is never cleared, a quirk, O 0x458F0); with width 2 also on the line to the end moved
   * by T.fanDx1/fanDy1, with 3 also T.fanDx2/fanDy2, both by the direction of the step onto the last
   * creature of the first line (I: the last step's when there was none; the original reads an unset
   * variable). c itself (the current combatant) is left out.
   */
  fan(c: Uint8Array, x: number, y: number, width: number, len: number): Uint8Array[] {
    const f = this.of(c)
    if (!f) return []
    const x0 = f.x, y0 = f.y
    const dirs: number[] = []
    let l = new Line(x0, y0, x, y)
    while (l.step()) dirs.push(l.dir)
    let cost = l.cost, i = 0
    while (dirs.length && cost < ((2 * len) & 0xff)) {
      if (!(x > 0 && x < 0x31 && y > 0 && y < 0x18)) break
      const d = dirs[i]
      cost = (cost + (d & 1 ? 3 : 2)) & 0xff
      x += DX[d]; y += DY[d]
      i = i === dirs.length - 1 ? 0 : i + 1
    }
    const clamp = (p: { x: number; y: number }) => ({ x: Math.min(0x31, Math.max(0, p.x)), y: Math.min(0x18, Math.max(0, p.y)) })
    const end = this.sightEnd(x0, y0, clamp({ x, y }))
    const list: Fighter[] = []
    let repeat = false, onLast = 8
    l = new Line(x0, y0, end.x, end.y)
    while (l.step()) {
      const o = this.occupied(l.x, l.y, 1)
      if (!o) continue
      if (!list.length) repeat = false
      else if (list.includes(o)) repeat = true
      if (!repeat) list.push(o)
      onLast = l.dir
    }
    const lastDir = onLast < 8 ? onLast : l.dir
    const t = this.tables()
    const side = (tx: number, ty: number) => {
      if (!t || T.fanDx1.at < 0 || lastDir > 7) return
      const p = clamp({ x: end.x + s8(t.b(tx + lastDir)), y: end.y + s8(t.b(ty + lastDir)) })
      const s = new Line(x0, y0, p.x, p.y)
      while (s.step()) { const o = this.occupied(s.x, s.y, 1); if (o && !list.includes(o)) list.push(o) }
    }
    if (width > 1) side(T.fanDx1.at, T.fanDy1.at)
    if (width > 2) side(T.fanDx2.at, T.fanDy2.at)
    return list.filter((o) => o !== this.current_).map((o) => o.c)
  }
  /** Where the line of sight from (x0, y0) towards p stops: the first cell that blocks it, else p (I: the
   *  sight rule of `sees`, on the line walker as the original's routine uses) */
  sightEnd(x0: number, y0: number, p: { x: number; y: number }) {
    const l = new Line(x0, y0, p.x, p.y)
    while (l.step()) if ((this.cells[this.bf.get(l.y, l.x)]?.sight ?? 2) > 0) return { x: l.x, y: l.y }
    return p
  }

  // ------------------------------------------------------------ basics
  of(c: Uint8Array) { return this.fighters.find((f) => f.c === c) ?? null }
  fly(from: Uint8Array, to: Uint8Array, kind: 'gaze' | 'spit') {
    const a = this.of(from), b = this.of(to)
    if (!a || !b) return
    this.ui.flight?.({ x: a.x, y: a.y }, { x: b.x, y: b.y }, kind === 'gaze' ? { frames: cycle(5), delay: 45 } : { frames: [{ rec: 10 }], delay: 30 })
  }
  inPlay(f: Fighter) { return f.c[F.inPlay] !== 0 && f.size > 0 }
  side(f: Fighter) { return f.c[F.side] }
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
      r[9] = c[F.side] ? (face + 4) % 8 : face
      if (c[F.side] === 0 && r[0x13] && ((c[F.morale] & 0x7f) === 0 || (c[F.morale] & 0x7f) > 102)) c[F.morale] = Math.min(100, this.e.read(0x6dc6)) + 0x80
      this.fighters.push({ c, r, x: 0, y: 0, size: 0, index: i, monster: !!r[0x13], target: null })
    })
    // placement
    const FD = [facing, (facing + 2) % 4]
    const inPlay = [0, 1].map((s) => this.fighters.filter((f) => f.c[F.inPlay] && this.side(f) === s).length)
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
    const RING_DIR = [[4, 6, 2], [6, 4, 0], [0, 6, 2], [2, 0, 4]] // ring 1–3 map directions per FD (S, W, E for FD0 …)
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
      const size = (f.c[F.sizeFlags] & 7) || 1
      if (this.occupied(X, Y, size) || !this.passable(X, Y, size)) return false
      used.add(key)
      f.x = X; f.y = Y
      return true
    }
    const place = (f: Fighter) => {
      const s = this.side(f)
      const Fs = FD[s]
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
      const canAct = f.c[F.inPlay] !== 0
      if (ok && canAct) f.size = (f.c[F.sizeFlags] & 7) || 1
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
    // event 8, then (CotAB 0x26A1A) event 22, combat starts, for each character in turn
    for (const f of this.fighters) { fx.round = 0; fx.roll = 0; this.current_ = f; await fire(this, f.c, 8); await fire(this, f.c, 22) }
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
      if (this.inPlay(f)) hp += f.c[F.hp]
      max += f.c[F.maxHp]
    }
    this.enemyPct = max ? Math.floor((20 * hp) / max) * 5 : 0
  }

  /** Round start (FUN_3aae_0000). */
  async roundStart(f: Fighter, surprise: number) {
    const r = f.r, c = f.c
    r[0] = 0; r[1] = 1; r[2] = 1; r[8] = 0; r[4] = 2
    await this.attacks(f, true)
    r[5] = c[F.sweep]
    if (!c[F.inPlay]) r[3] = 0
    else {
      let init = Math.max(1, this.e.roll(1, 6) + dexMissile(c[F.stat[3]]))
      if (surprise & (1 << this.side(f))) init -= 6
      r[3] = init < 0 || init > 20 ? 0 : init
    }
    let m = c[F.move] + (this.side(f) === 0 ? s8(this.e.read(0x6e72)) : 0)
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
    const prev = c[F.attacksLeft]
    let x2 = c[F.attacksBase]
    const w = this.weaponOf(c)
    const b = w && t ? t.baseOf(w) : undefined
    const missile = w && b && b.range > 1 ? this.ammo(c, w) : null
    if (missile && b) x2 = Math.max(2, b.rate)
    fx.rate = x2; fx.rateIsMove = false
    await fire(this, c, 18)
    let n = Math.floor((fx.rate + (this.round & 1)) / 2)
    if (missile) n = Math.min(n, Math.max(1, missile.count))
    if (f.r[8] === 0 || n < prev || (n < 2 * prev && !missile)) c[F.attacksLeft] = n
    if (roundStart) {
      fx.rate = c[F.attacksBase + 1]
      await fire(this, c, 18)
      c[F.attacksLeft + 1] = Math.floor((fx.rate + (this.round & 1)) / 2)
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
    if (f.r[0] === 0) await fire(this, f.c, 21) // CotAB 0x2209E: not in the middle of casting
    if (s8(f.r[3]) <= 0) return
    if (f.c[F.quick]) await this.ai(f)
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
      await this.cloudCheck(f, R.clouds.gas.roundEnd) // CotAB 0x2272D: flag 0, only the killing cloud
      if (f.c[F.status] === 5) {
        f.r[0xe]++
        if (f.r[0xe] >= 10) { f.c[F.status] = 6; this.print(`${name(f.c)} has died`) }
      }
    }
    if (this.fighters.some((f) => !f.monster && this.side(f) === 0 && f.c[F.status] === 5)) this.print('Your Teammate is Dying')
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
    if (!c[F.inPlay]) { this.endTurnF(f); return }
    if (f.r[0]) { await this.castSpell(f, this.e.spells!.get(f.r[0])!, false); this.endTurnF(f); return }
    /** where the steps since the last other action began (Escape undoes them) */
    let moved = { x: f.x, y: f.y, m: f.r[6], face: f.r[9] }
    const undo = () => { f.x = moved.x; f.y = moved.y; f.r[6] = moved.m; f.r[9] = moved.face; this.ui.redraw(f) }
    while (s8(f.r[3]) > 0 && this.inPlay(f) && !c[F.quick] && !this.ended) {
      const st = this.e.spells
      const canCast = !!st && f.r[1] === 1 && this.e.read(0x49e5) === 0 && Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k]).some((v) => v > 0 && v < 0x80)
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
        ...(c[F.levels] > 0 && !f.r[0x11] ? [['TURN', 't'] as [string, string]] : []),
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
        c[F.quick] = 1
        // not in the original: how to get them back, and whether they may cast (IMP-054)
        const spells = Array.from({ length: F.memorisedCount }, (_, i) => c[F.memorised + i]).some((v) => v > 0 && v < 0x80)
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
    const dying = this.fighters.some((o) => !o.monster && this.side(o) === 0 && o.c[F.status] === 5)
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
      const d = this.fighters.find((x) => !x.monster && this.side(x) === 0 && x.c[F.status] === 5)
      if (d) { d.c[F.status] = 4; d.r[0xe] = 0; this.print(`${name(d.c)} is bandaged`) }
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
    for (const o of this.fighters) if (!o.monster && o.c[F.morale] >= 0x80 && o.c[F.status] === 0) { o.c[F.side] = 1; o.target = null }
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
    const ready = Array.from({ length: F.memorisedCount }, (_, k) => f.c[F.memorised + k]).filter((v) => v > 0 && v < 0x80)
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
    if (!(f.c[F.attacksLeft] < f.r[5] && t.c[F.hitDice] === 0 && this.dist(f, t) === 1)) return false
    const near = this.enemiesWithin(f, 1).filter((o) => o.c[F.hitDice] === 0)
    if (near.length <= f.c[F.attacksLeft]) return false
    const n = Math.min(near.length, f.r[5])
    this.print(`${name(f.c)} sweeps`)
    const order = [t, ...near.filter((o) => o !== t)].slice(0, n)
    for (const o of order) {
      if (!this.inPlay(o)) continue
      f.c[F.attacksLeft] = 1
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
    if (a.c[F.attacksLeft] <= 0 && a.c[F.attacksLeft + 1] <= 0) return
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
    if (a.c[F.attacksLeft] <= 0 && a.c[F.attacksLeft + 1] <= 0) this.endTurnF(a)
  }

  helpless(c: Uint8Array) { return this.e.effectsOf(c).some((e) => [31, 51, 52, 53].includes(e.type)) }
  large(c: Uint8Array) { return c[F.sizeFlags] > 0x80 || (c[F.sizeFlags] & 7) > 1 }

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
      this.inflict(t, tc[F.hp] + 5)
      await removeType(this, ac, 25)
      ac[F.attacksLeft] = ac[F.attacksLeft + 1] = 0
      return 0
    }
    this.recalc(tc)
    const w = this.weaponOf(ac)
    const b = w ? this.e.items?.baseOf(w) : undefined
    if (this.large(tc) && b) { ac[F.dice] = b.large[0]; ac[F.sides] = b.large[1]; ac[F.bonus] = (ac[F.bonus] + b.large[2] - b.small[2]) & 0xff }
    await fire(this, tc, 11)
    const backstab = this.backstab(a, t)
    let acByte: number
    let kind = 0
    if (backstab) { acByte = tc[F.acRear] - 2; kind = 2 }
    else if (fromBehind || (t.r[0xf] > 1 && this.dirTo(a, t) === t.r[9] && t.r[0x12] > 4)) { acByte = tc[F.acRear]; kind = 1 }
    else acByte = tc[F.ac]
    if (b && b.range > 1) {
      const band = Math.floor((b.range - 1) / 3), d = this.dist(a, t)
      if (d > band) acByte += 2
      if (d > 2 * band) acByte += 3
    }
    let hit = false
    for (let h = a.r[4] || 2; h >= 1; h--) {
      while (ac[F.attacksLeft - 1 + h] > 0 && this.inPlay(t)) {
        ac[F.attacksLeft - 1 + h]--
        a.r[4] = h
        if (h === 1) made++
        if (this.helpless(tc) || await this.toHit(ac, tc, acByte)) {
          hit = true
          fx.hits[h]++
          let dmg = this.e.roll(ac[F.dice - 1 + h], ac[F.sides - 1 + h]) + s8(ac[F.bonus - 1 + h])
          if (backstab) dmg *= Math.floor(ac[F.levels + 6] / 4) + 2
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
    let acByte = this.backstab(a, t) ? tc[F.acRear] - 2
      : t.r[0xf] > 1 && this.dirTo(a, t) === t.r[9] && t.r[0x12] > 4 ? tc[F.acRear] : tc[F.ac]
    if (b && b.range > 1) {
      const band = Math.floor((b.range - 1) / 3), d = this.dist(a, t)
      if (d > band) acByte += 2
      if (d > 2 * band) acByte += 3
    }
    const bonus = s8(this.e.read(ac[F.side] ? 0x6e70 : 0x6e71))
    let n = 0
    for (let r = 2; r <= 20; r++) if (acByte <= (r === 20 ? 100 : r) + ac[F.thac0] + bonus) n++
    const chance = this.helpless(tc) ? 1 : n / 20
    const [cnt, sides, plus] = this.large(tc) && b ? [b.large[0], b.large[1], s8(ac[F.bonus]) + b.large[2] - b.small[2]] : [ac[F.dice], ac[F.sides], s8(ac[F.bonus])]
    return { chance, damage: `${cnt}d${sides}${plus ? (plus > 0 ? '+' : '') + plus : ''}` }
  }

  backstab(a: Fighter, t: Fighter): boolean {
    const c = a.c
    if (c[F.levels + 6] <= 0) return false
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
    const bonus = s8(this.e.read(a[F.side] ? 0x6e70 : 0x6e71))
    return acByte <= fx.roll + a[F.thac0] + bonus
  }

  /** Saving throw (FUN_5216_0d63). */
  saveSync(c: Uint8Array, type: number, bonus: number): boolean {
    // CotAB DS:6FC2 (0x4BDA1): set while event 12 runs, then the outcome
    fx.saved = true
    const r = this.e.roll(1, 20)
    if (r === 1) return (fx.saved = false)
    if (r === 20) return (fx.saved = true)
    fx.save = r + s8(c[F.saveBonus]) + bonus
    fx.saveType = type
    void fire(this, c, 12)
    return (fx.saved = c[F.saves + type] <= fx.save)
  }

  /** Non-weapon damage (FUN_5216_1344). */
  damageSync(c: Uint8Array, dmg: number, mode: number, saved: boolean) {
    fx.dmg = dmg
    void fire(this, c, 6)
    if (!saved) void fire(this, c, 20) // CotAB 0x4CAB2: damage not saved
    let d = fx.dmg
    if (saved) d = mode === 1 ? 0 : mode === 2 ? d >> 1 : d
    const f = this.of(c)
    if (f && d > 0) {
      // FUN_5216_1344 → FUN_10ba_1feb: the line, the starburst once with sound 3, then the pause
      this.print(damageText(name(c), d, fx.dmgType), { ms: 0 })
      this.ui.effect?.(f, 'burst', 1, this.e.speed * 225)
    }
    if (f) this.inflict(f, d)
    else c[F.hp] = Math.max(0, c[F.hp] - d)
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
    const hp = c[F.hp]
    let left = hp - dmg, over = 0
    if (left < 0) { over = -left; left = 0 }
    if (over > 9 || (left === 0 && c[F.status] === 1)) c[F.status] = 6
    else if (over > 0) { c[F.status] = 5; t.r[0xe] = over }
    else if (left === 0) c[F.status] = 4
    if (dmg > 0) {
      t.r[1] = 0
      if (t.r[0]) { this.print(`${name(c)} lost a spell`); if (this.current_) forget(this.current_.c, t.r[0]); t.r[0] = 0 }
    }
    if (c[F.status] !== 0 && c[F.status] !== 1) {
      c[F.hp] = 0
      c[F.inPlay] = 0
      this.print(c[F.status] === 4 ? `${name(c)} goes down` : c[F.status] === 5 ? `${name(c)} goes down and is Dying` : `${name(c)} is killed`)
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
    } else c[F.hp] = left
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
      const hand = e.c[F.attacksLeft + 1] > 0 ? 2 : 1
      if (e.c[F.attacksLeft - 1 + hand] <= 0) e.c[F.attacksLeft - 1 + hand] = 1
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
    await this.cloudCheck(f)
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
      f.c[F.status] = 3; f.c[F.inPlay] = 0
      f.size = 0
    } else this.print('Escape is blocked')
    this.endTurnF(f)
    this.ui.redraw()
  }

  moveOf(f: Fighter) {
    let m = f.c[F.move] + (this.side(f) === 0 ? s8(this.e.read(0x6e72)) : 0)
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
    const L = f.c[F.levels]
    const col = L >= 1 && L <= 8 ? L - 1 : L <= 13 && L >= 9 ? 8 : 9
    const TABLE = [
      [10, 7, 4, 1, 1, 0, 0, -1, -1, -1], [13, 10, 7, 1, 1, 0, 0, 0, -1, -1], [16, 13, 10, 4, 1, 1, 0, 0, 0, -1],
      [19, 16, 13, 7, 4, 1, 1, 0, 0, -1], [20, 19, 16, 10, 7, 4, 1, 1, 0, 0], [99, 20, 19, 13, 10, 7, 4, 1, 1, 0],
      [99, 99, 20, 16, 13, 10, 7, 4, 1, 0], [99, 99, 99, 20, 16, 13, 10, 7, 4, 1], [99, 99, 99, 99, 20, 16, 13, 10, 7, 1],
      [99, 99, 99, 99, 99, 20, 16, 13, 10, 4],
    ]
    let any = false
    while (count > 0) {
      const t = this.enemiesWithin(f, 255).filter((e) => !e.r[0x10] && e.c[F.undead] > 0).sort((a, b) => a.c[F.undead] - b.c[F.undead])[0]
      if (!t) break
      const v = TABLE[Math.min(t.c[F.undead], 10) - 1][col]
      if (r < Math.abs(v)) break
      any = true
      if (v >= 1) { this.announce(t.c, 'is turned'); t.r[0x10] = 1 }
      else { this.print(`${name(t.c)} Is destroyed`); t.c[F.status] = 8; t.c[F.inPlay] = 0; this.downF(t) }
      if (minimum > 0) minimum--
      count--
      if (count === 0 && minimum > 0 && v < 0) count = 1
    }
    if (!any) this.print('Nothing Happens...')
    this.endTurnF(f)
  }

  // ------------------------------------------------------------ spells
  /** Cast a spell now (FUN_4e53_0c20): choose targets, then apply. */
  async castSpell(f: Fighter, s: Spell, fromItem: boolean, ai = false) {
    const c = f.c
    const L = casterLevel(c, s, fromItem)
    const targets = await this.spellTargets(f, s, spellRange(s, L), ai)
    if (targets === null) {
      if (!ai && !c[F.quick] && (await this.ui.confirm('Abort Spell?'))) { this.print('Spell Aborted'); if (!fromItem) forget(c, s.id) }
      return
    }
    if (!fromItem) forget(c, s.id)
    // FUN_4e53_331a in combat: "Casts a Spell" with the pause, then "Spell: name" on the status line
    this.print(`${name(c)} Casts a Spell`)
    this.print(`Spell: ${s.name}`, { ms: 0 })
    // FUN_4e53_0c20: the caster turns to the aim point in its action frame, the spell bolt flies there
    const aim = this.aimed
    const sound = spellSpec(s.id).sound ?? 2
    if (aim && (aim.x !== f.x || aim.y !== f.y)) {
      f.r[9] = this.dirToCell(f, aim.x, aim.y)
      this.ui.pose?.(f, true)
      this.ui.flight?.({ x: f.x, y: f.y }, aim, { frames: cycle(5), delay: 30, sounds: [sound, 0] })
      this.ui.pose?.(f, false)
    } else this.ui.sound(sound)
    fx.spell = s.id
    fx.area = (s.target & 0xf) >= 8 && (s.target & 0xf) <= 14
    try { await this.applySpell(f, s, L, targets) } finally { fx.spell = 0; fx.area = false }
    await this.ui.pause(200)
  }

  /** Targets (FUN_3aae_20c3): self, one or several picks, or an area around the aimed square. */
  async spellTargets(f: Fighter, s: Spell, range: number, forceAi = false): Promise<Fighter[] | null> {
    const mode = s.target & 0xf
    this.aimed = { x: f.x, y: f.y }
    if (mode === 0 || s.target === 240) return [f]
    const ai = forceAi || !!f.c[F.quick]
    const pickOne = async (allowEmpty: boolean, area?: (x: number, y: number) => { x: number; y: number }[]): Promise<AimEntry | null> => {
      if (ai) {
        if (!s.aiHostile) {
          if (spellSpec(s.id).aiTarget === 'woundedNear') {
            const near = this.fighters.filter((o) => this.inPlay(o) && this.side(o) === this.side(f) && this.dist(f, o) <= 1 && o.c[F.hp] < o.c[F.maxHp])
            near.sort((a, b) => a.c[F.hp] - b.c[F.hp])
            const p = near[0] ?? f
            return { f: p, x: p.x, y: p.y, cost: 0, ok: true }
          }
          return { f, x: f.x, y: f.y, cost: 0, ok: true }
        }
        // up to 20 × the finder FUN_3aae_37e4(caster, range, 0, 1), which clears the target and sets its
        // pick; a rejected pick stays the target
        for (let i = 0; i < 20; i++) {
          const list = this.enemiesWithin(f, range)
          if (!list.length) { f.target = null; return null }
          const t = list[this.e.roll(1, list.length) - 1]
          f.target = t
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
      const spec = spellSpec(s.id)
      // Fireball outdoors (ECL 0x49E6 = 0) is held to its outdoor radius
      if (spec.outdoorRadius !== undefined && this.e.read(0x49e6) === 0) radius = Math.min(radius, spec.outdoorRadius as number)
      // the squares the spell would cover from a centre, for the preview (IMP-059); a cloud takes its
      // own cells from the aimed square (Stinking Cloud: here, E, SE and S)
      const cloud = this.cloudCells(spec)
      const area = (x: number, y: number) => {
        if (cloud) return cloud.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((q) => this.passable(q.x, q.y, 1))
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
    const out: Fighter[] = []
    const pool = spellSpec(s.id).pool as { size: import('../games/spellrules').Term; by: 'sizeFlags' | 'hitDice'; costs: number[]; other: number } | undefined
    if (pool) {
      // CotAB 0x2C7EA (target mode 5): picks are bought from a pool (L, or a roll) by each one's size
      // or hit dice; the pick that goes over still counts and ends it (from the second on), as does
      // a cancel or an empty pool; the computer picking one again loses a point of the pool
      let left = term(pool.size, casterLevel(f.c, s, false), (k, d) => this.e.roll(k, d)) & 0xff, spent = 0
      for (;;) {
        const p = await pickOne(false)
        if (!p?.f) break
        if (out.includes(p.f)) { if (ai) left = (left - 1) & 0xff; else this.print('Already been targeted') }
        else {
          out.push(p.f)
          this.aimed = { x: p.x, y: p.y }
          const v = p.f.c[F[pool.by]]
          spent = (spent + (v < pool.costs.length ? pool.costs[v] : pool.other)) & 0xff
          if (out.length > 1 && spent > left) break
        }
        if (left === 0) break
      }
      return out.length ? out : null
    }
    const n = (mode & 3) + 1
    for (let i = 0; i < n; i++) {
      const p = await pickOne(false)
      if (!p?.f) continue
      if (out.includes(p.f)) { if (!ai) { this.print('Already been targeted'); i-- } continue }
      if (!out.length) this.aimed = { x: p.x, y: p.y }
      out.push(p.f)
    }
    return out.length ? out : null
  }

  /** Spell effects in combat (spec/spells.md, "Per spell"): the kind the game gives the spell id. */
  async applySpell(f: Fighter, s: Spell, L: number, targets: Fighter[]) {
    const dur = spellDuration(this.e, s, L, true)
    const p = spellSpec(s.id)
    const kind = Battle.spellKinds[p.k]
    if (kind) await kind.call(this, { f, s, L, dur, targets }, p)
    else await castShared({ h: this, e: this.e, caster: f.c, s, L, dur, targets: targets.map((t) => t.c) }, p)
    for (const t of targets) this.recalc(t.c)
  }

  /** each target's first record of `type` runs its handler at once (CotAB 0x4AB77 with arg 0) */
  private async runAfter(targets: Fighter[], type: number) {
    for (const t of targets) {
      const e = this.e.effectsOf(t.c).find((x) => x.type === type)
      if (e) await runEffect(this, type, e, t.c)
    }
  }
  /** Add the spell's effect (or `type`) at power L through FUN_5216_1656, with the spell's line. */
  private async addSpellEffect(t: Fighter, s: Spell, p: SpellSpec, saved: boolean, dur: number, L: number, type = s.effect, flag = 0) {
    if (type) await addEffect(this, t.c, type, dur, L, flag, s.save, saved, false, p.msg ?? '')
  }
  private spellSave(t: Fighter, s: Spell, bonus = 0) { return s.save ? this.saveSync(t.c, s.saveType, bonus) : false }
  /** a touch spell (range byte 0xFF) rolls to hit against the target's AC */
  private async spellTouch(c: Uint8Array, s: Spell, t: Fighter) { return s.range[0] !== 0xff || await this.toHit(c, t.c, t.c[F.ac]) }

  /** The kinds that need the battlefield (the shared ones are in rules/spellkinds.ts). */
  static readonly spellKinds: Record<string, (this: Battle, x: BattleCast, p: SpellSpec) => Promise<void>> = {
    /**
     * Apply (PoR FUN_4e53_08c3, CotAB 0x44EEF) for an effect-only spell: touch, the save, the effect (flag
     * `flag`; `rollDuration` per target). Before it: with `immuneHd`, a first target of at least that many
     * hit dice (+0xE5) only says `immuneMsg` and nothing happens (CotAB Sticks to Snakes 0x482CA); with
     * `casterEffect`, the caster first gets that effect through the add-effect routine, power 0, no line
     * (CotAB Dispel Evil 0x483E9). After it, with `runAfter`, the first target's ('first') or each target's
     * ('each') first record of the effect runs its handler at once (Sticks to Snakes; Charm Monsters)
     */
    async apply({ f, s, L, dur, targets }, p) {
      if (p.immuneHd !== undefined && targets[0] && s8(targets[0].c[F.hitDice]) >= (p.immuneHd as number)) {
        this.print(line(name(targets[0].c), p.immuneMsg as string))
        return
      }
      if (p.casterEffect !== undefined) await addEffect(this, f.c, p.casterEffect as number, dur, 0, 0, 0, false, false, '')
      for (const t of targets) {
        const d = p.rollDuration ? amount(p.rollDuration as Amount, L, (n, k) => this.e.roll(n, k)).total : dur
        if (!(await this.spellTouch(f.c, s, t))) { this.print(`${name(f.c)} misses`); continue }
        await this.addSpellEffect(t, s, p, this.spellSave(t, s), d, L, s.effect, (p.flag as number | undefined) ?? 0)
      }
      if (p.runAfter) await this.runAfter(p.runAfter === 'first' ? targets.slice(0, 1) : targets, s.effect)
    },
    /**
     * Apply, then a probe on the caster's combat target (CotAB Poison 0x48240): event 9 there with effect
     * `probe` being added; unless something blocks it, handler `probe` runs as the caster's (64: the
     * current combatant's target saves vs 0 or dies). I: no combat target, nothing (the original reads
     * through the empty pointer); the effect record the handler gets is a blank one (the original's is
     * uninitialised)
     */
    async applyProbe(x, p) {
      await Battle.spellKinds.apply.call(this, x, p)
      const t = this.targetOf(x.f.c)
      if (!t) return
      const probe = p.probe as number
      fx.adding = probe
      await fire(this, t, 9)
      const ok = fx.adding === probe
      fx.adding = 0
      if (ok) await runEffect(this, probe, { type: probe, duration: 0, power: 0, flag: 0 }, x.f.c)
    },
    /** Bless / Curse (0f4f): only the caster's side, not next to an enemy (`notEngaged`), or only the enemy */
    async applySide({ f, s, L, dur, targets }, p) {
      const mine = targets.filter((t) => (p.side === 'ally' ? this.side(t) === this.side(f) && (!p.notEngaged || this.enemiesWithin(t, 1).length === 0) : this.side(t) !== this.side(f)))
      for (const t of mine) await this.addSpellEffect(t, s, p, false, dur, L)
    },
    /** heal the first target by the amount (no revive in combat); FUN_10ba_234a's line, or `msg`, when it took */
    async heal({ L, targets }, p) {
      const t = targets[0]
      if (t && healChar(t.c, this.e.effectsOf(t.c), amount(p.amount as Amount, L, (n, k) => this.e.roll(n, k)).total, false, true)) {
        if (p.msg) this.announce(t.c, p.msg); else healedLine(this, t.c)
      }
    },
    /**
     * Apply with damage: one roll of the amount for every target (`recordDice` keeps its dice count for
     * the resistances), damage type `dmgType`, a touch roll for touch spells, the save byte's mode (half
     * or negates); `look` centres the view on the aim point (Fireball has no burst graphic of its own)
     */
    async damage({ f, s, L, targets }, p) {
      if (!targets.length) return
      const { n, total } = amount(p.amount as Amount, L, (k, d) => this.e.roll(k, d))
      if (p.recordDice) fx.dice = n
      if (p.look) this.ui.look?.(this.aimed)
      for (const t of targets) {
        if (!(await this.spellTouch(f.c, s, t))) { this.print(`${name(f.c)} misses`); continue }
        fx.dmgType = p.dmgType as number
        this.damageSync(t.c, total, s.save, this.spellSave(t, s))
      }
    },
    /** Sleep (151b): a pool of hit dice, nearest first; the Animated, the asleep and the too costly are skipped */
    async sleep({ f, L, dur, targets }, p) {
      let pool = amount(p.pool as Amount, L, (n, k) => this.e.roll(n, k)).total
      const hdCost = p.hdCost as number[], hd5 = p.hd5 as number[], other = p.other as number
      const costOf = (t: Uint8Array) => {
        const hd = s8(t[F.hitDice])
        if (hd < 0) return other
        if (hd < hdCost.length) return hdCost[hd]
        if (hd === hdCost.length) return t[F.race] === 0 ? hd5[0] : hd5[1]
        return other
      }
      for (const t of targets.sort((a, b) => this.dist(f, a) - this.dist(f, b))) {
        if (t.c[F.status] === 1 || this.e.effectsOf(t.c).some((x) => x.type === (p.effect as number))) continue
        const k = costOf(t.c)
        if (k > pool) continue
        pool -= k
        await addEffect(this, t.c, p.effect as number, dur, L, 0, 0, false, false, p.msg ?? '')
      }
    },
    /**
     * Hold (PoR 1658; CotAB's loop 0x45A94 for Hold Person, Hold Monsters, Faerie Fire, Charm Monsters):
     * last to first, a save bonus by the number of targets (`bonus`: 1, 2, more; I: CotAB's Hold Person
     * leaves it uninitialised past 4 targets); with `sizeImmune` only man-sized or smaller (the whole size
     * byte > 1, 4e53:1760) can be held; with `lastSaves` the last-listed target counts as saved without
     * a roll (CotAB 0x45B4D for 79 and 81: the pool target that went over, or the last pick; quirk
     * kept). The effect is `effect` or the spell's, power L; with `runAfter` each target's record of it
     * runs its handler at once afterwards (Charm Monsters 0x4874C)
     */
    async hold({ f, s, L, dur, targets }, p) {
      const n = targets.length
      const bonus = (p.bonus as number[])[Math.min(n, 3) - 1]
      const last = targets[targets.length - 1]
      const effect = (p.effect as number | undefined) ?? s.effect
      for (const t of [...targets].reverse()) {
        // 4e53_1658: sound 2 and a bolt to each target before its save, except the last-listed one (I: a bug)
        if (t !== last) this.ui.flight?.({ x: f.x, y: f.y }, { x: t.x, y: t.y }, { frames: cycle(5), delay: 30, sounds: [2, 0] })
        let saved = p.lastSaves && t === last ? true : this.saveSync(t.c, s.saveType, bonus)
        if (p.sizeImmune && (t.c[F.monsterType] > 1 || t.c[F.sizeFlags] > 1)) saved = true
        await addEffect(this, t.c, effect, dur, L, 0, 1, saved, false, p.msg ?? '')
      }
      if (p.runAfter) await this.runAfter(targets, effect)
    },
    /**
     * Dimension Door (CotAB 0x488A1): a caster held (`heldBy`, 0x3A) frees itself from every combatant
     * next to it whose first `releases` record (0x90, else 0x8B) holds it (power = its index): both of
     * that holder's records go, whose removal lets go of the victim; then the caster moves to the aimed
     * square and the line. ?: the original moves it whatever is there; the port only to a free square
     */
    async teleport({ f }, p) {
      const [first, second] = p.releases as number[]
      if (this.e.effectsOf(f.c).some((x) => x.type === (p.heldBy as number))) {
        for (const o of this.fighters.filter((x) => x !== f && this.inPlay(x) && this.dist(f, x) <= 1)) {
          const fx0 = this.e.effectsOf(o.c)
          const e = fx0.find((x) => x.type === first) ?? fx0.find((x) => x.type === second)
          if (!e || this.byIndex(e.power) !== f.c) continue
          await removeFirst(this, o.c, first)
          await removeFirst(this, o.c, second)
        }
      }
      const { x, y } = this.aimed
      if (this.passable(x, y, f.size || 1) && !this.occupied(x, y, f.size || 1, f)) { f.x = x; f.y = y }
      this.ui.redraw(f)
      this.print(line(name(f.c), p.msg ?? ''))
    },
    /**
     * Fear (CotAB 0x48A52): who stands in the area template (fan: `width`, `len`, towards the aimed
     * square, the spell's own targets ignored) saves vs `saveType`; a failure gets the effect through the
     * add-effect routine (power 0, flag 1, negates) with the line and, whatever that did, flees: combat
     * record +0x10 = 1, computer control, morale 0xB3 unless above 0x7F, no target; a success `unaffected`
     */
    async scare({ f, dur }, p) {
      for (const c of this.fan(f.c, this.aimed.x, this.aimed.y, p.width as number, p.len as number)) {
        if (this.saveSync(c, p.saveType as number, 0)) { this.print(line(name(c), p.unaffected as string)); continue }
        await addEffect(this, c, p.effect as number, dur, 0, 1, 1, false, false, p.msg ?? '')
        this.setRec(c, 0x10, 1)
        c[F.quick] = 1
        if (c[F.morale] <= 0x7f) c[F.morale] = 0xb3
        this.setRec(c, 0xa, 0)
      }
    },
    /**
     * Fumble (CotAB 0x48D66): damage type `dmgType` while the first target saves vs `saveType`: a failure
     * gets `fail`'s effect, a success `pass`'s (add-effect, power 0, flag 0, the line), its first record's
     * handler run at once (I: the original passes no record); then Apply with `flag` and `msg` (a
     * second save; on a failure the spell's effect replaces the first with power L)
     */
    async saveOrElse(x, p) {
      const t = x.targets[0]
      if (!t) return
      fx.dmgType = p.dmgType as number
      const o = (this.saveSync(t.c, p.saveType as number, 0) ? p.pass : p.fail) as { effect: number; msg: string }
      await addEffect(this, t.c, o.effect, x.dur, 0, 0, 0, false, false, o.msg)
      await this.runAfter([t], o.effect)
      fx.dmgType = 0 // Apply with no damage clears it (0x44F0E)
      await Battle.spellKinds.apply.call(this, x, p)
    },
    /**
     * Save or be affected (CotAB Entangle 0x4862B, Confusion 0x487DD): each target saves vs `saveType`;
     * the effect through the add-effect routine (power 0, flag 0, negated by the save) with the line.
     * `outdoorsOnly`: nothing in a map area (A 0x1CC, ECL 0x49E6, not 0); `upTo`: only the first that
     * many targets (a roll made first)
     */
    async saveEach({ L, dur, targets }, p) {
      if (p.outdoorsOnly && this.e.read(0x49e6) !== 0) return
      const n = p.upTo ? amount(p.upTo as Amount, L, (k, d) => this.e.roll(k, d)).total : targets.length
      for (const t of targets.slice(0, n)) {
        const saved = this.saveSync(t.c, p.saveType as number, 0)
        await addEffect(this, t.c, p.effect as number, dur, 0, 0, 1, saved, false, p.msg ?? '')
      }
    },
    /** Charm Person (11dd): power L + the caster's side × `sideMul`, run at once; only man-sized or smaller */
    async charm({ f, s, L, dur, targets }, p) {
      const t = targets[0]
      if (!t) return
      if (t.c[F.monsterType] > 1 || t.c[F.sizeFlags] > 1) { this.print(`${name(t.c)} is unaffected`); return } // as Hold Person (4e53:11f3)
      await addEffect(this, t.c, s.effect, dur, (L + this.side(f) * (p.sideMul as number)) & 0xff, 1, 1, this.spellSave(t, s), true, p.msg ?? '')
    },
    /** Snake Charm (190f): ignores targeting; creatures of `monsterType` while the caster's HP lasts */
    async charmByHp({ f, L }, p) {
      let pool = f.c[F.hp]
      for (const t of this.fighters) {
        if (t.c[F.monsterType] !== (p.monsterType as number) || t.c[F.hp] > pool) continue
        pool -= t.c[F.hp]
        await addEffect(this, t.c, p.effect as number, 0, L, 0, 0, false, false, p.msg ?? '')
      }
    },
    /** Lightning Bolt (PoR FUN_4e53_2bb7, CotAB 0x47C49): the aimed square, then the bolt (R.bolt) */
    async bolt({ f, L }, p) {
      const dmg = amount(p.amount as Amount, L, (n, k) => this.e.roll(n, k)).total
      this.boltHit(this.aimed.x, this.aimed.y, dmg, p.saveType as number)
      this.bolt(f.c, R.bolt.lightning, dmg, p.saveType as number, true)
      this.ui.redraw()
    },
    /**
     * Haste / Slow (2764): up to L targets of the caster's side (`ally`) or the enemy's; one with the
     * `opposite` effect only loses it; with `attacksAfter`, event 18 recounts the attacks
     */
    async hasteSlow({ f, s, L, dur, targets }, p) {
      const mine = targets.filter((t) => (p.side === 'ally' ? this.side(t) === this.side(f) : this.side(t) !== this.side(f))).slice(0, L)
      for (const t of mine) {
        if (this.e.effectsOf(t.c).some((x) => x.type === (p.opposite as number))) { await removeType(this, t.c, p.opposite as number); continue }
        await this.addSpellEffect(t, s, p, false, dur, L)
        if (p.attacksAfter) await this.attacks(t, false)
      }
    },
    /**
     * A gas cloud (PoR Stinking Cloud FUN_4e53_1b11; CotAB Stinking Cloud 0x4675B, Cloudkill 0x48F05): a
     * zone of `cell` squares (cloudCells) from the aimed square, owned through effect `owner` (duration L,
     * power n × 16 + L, flag 1); then the occupant check on whoever stands there, each creature once
     * with `dedupe` (CotAB Stinking Cloud 0x46B40), else once per square (Cloudkill, PoR). I: the zone
     * number and the replaced cells as before (the port's simplification of both games' bookkeeping)
     */
    async cloud({ f, L }, p) {
      const c = f.c
      const cell = p.cell as number
      const mine = this.clouds.filter((z) => z.cell === cell)
      const n = mine.length ? Math.max(...mine.map((z) => z.n)) + 1 : 1
      const z: Cloud = { owner: c, n: n & 0x0f, cell, x: this.aimed.x, y: this.aimed.y, cells: [], resisted: false }
      const squares = (this.cloudCells(p) ?? []).map(([dx, dy]) => ({ x: this.aimed.x + dx, y: this.aimed.y + dy }))
      for (const { x, y } of squares) {
        const v = this.bf.get(y, x)
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS || (this.cells[v]?.move ?? 0xff) === 0xff) continue
        z.cells.push({ x, y, old: v })
        this.bf.set(y, x, cell)
      }
      this.clouds.push(z)
      addRaw(this, c, p.owner as number, L, ((z.n << 4) + L) & 0xff, 1)
      // the line without a pause, the redraw showing the cloud, then the pause
      this.print(`${name(c)} ${p.msg ?? ''}`, { ms: 0 })
      this.ui.show?.()
      this.ui.hold?.(this.e.speed * 225)
      this.ui.redraw()
      const occupants: Fighter[] = []
      for (const t of z.cells) {
        const o = this.occupied(t.x, t.y, 1)
        if (o && !(p.dedupe && occupants.includes(o))) occupants.push(o)
      }
      for (const o of occupants) await this.cloudCheck(o)
    },
    /**
     * Dispel Magic (PoR 2385, CotAB 0x47154): the shared part on the effects; then with `zones` (CotAB,
     * DS:6FB7 = 1) each square of the 3×3 round the aimed square, in the original's order (here, N, NE, E,
     * SE, S, SW, W, NW): on a cell of a listed zone kind, each zone of that kind not yet `resisted` that
     * has one of its `count` squares (from the direction table `dirs`, entry 1 on) there rolls d100 against
     * the chance of L against its owner's magic-user level (with the former dual-class level when the
     * **current** character's count, 0x47096; the chance a byte): success removes the owner's `owner`
     * effect of the zone's number (which lifts it), failure marks the zone resisted for good. Quirk kept:
     * Cloudkill zones are matched through Stinking Cloud's table read on for 9 entries (DS:27D9)
     */
    async dispel(x, p) {
      const { f, L, targets } = x
      await castShared({ h: this, e: this.e, caster: f.c, s: x.s, L, dur: x.dur, targets: targets.map((t) => t.c) }, p)
      const zones = p.zones as { cell: number; owner: number; dirs: 'gasCloud' | 'killCloud'; count: number }[] | undefined
      if (!zones) return
      const t = this.tables()
      const area = fx.area
      fx.area = true
      const { x: ax, y: ay } = this.aimed
      for (const [dx, dy] of [[0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
        const sx = ax + dx, sy = ay + dy
        const kind = zones.find((k) => k.cell === this.bf.get(sy, sx))
        if (!kind || !t) continue
        const ref = T[kind.dirs]
        for (const z of this.clouds.filter((o) => o.cell === kind.cell)) {
          for (let i = 1; i <= kind.count; i++) {
            const d = t.b(ref.at + i)
            if (z.x + s8(t.b(T.wallDx.at + d)) !== sx || z.y + s8(t.b(T.wallDy.at + d)) !== sy || z.resisted) continue
            const o = z.owner
            const lv = s8(o[F.levels + 5]) + (formerLevelsCount(f.c) ? s8(o[F.prevLevels + 5]) : 0)
            const chance = (L > lv ? 50 + 5 * (L - lv) : L < lv ? 50 - 2 * (lv - L) : 50) & 0xff
            if (this.e.roll(1, 100) > chance) { z.resisted = true; continue }
            const eff = this.e.effectsOf(o).find((e) => e.type === kind.owner && e.power >> 4 === z.n)
            if (eff) await removeEffect(this, o, eff)
          }
        }
      }
      fx.area = area
    },
  }

  // ------------------------------------------------------------ computer AI
  /** The computer's turn (FUN_3334_000f), simplified where marked. */
  async ai(f: Fighter) {
    const c = f.c
    if (!c[F.inPlay]) { this.endTurnF(f); return }
    let p = f.r[0x15]
    if (p === 0 || p > 4 || this.e.roll(1, 4) === 1) p = this.e.roll(1, 8) === 8 ? 4 + this.e.roll(1, 2) : this.e.roll(1, 4)
    f.r[0x15] = p
    if (await this.morale(f)) return
    if (f.r[0x14] && !f.r[0x10]) this.print(`${name(c)} flees in panic`)
    if (f.r[0]) { await this.castSpell(f, this.e.spells!.get(f.r[0])!, false); this.endTurnF(f); return }
    if (c[F.levels] > 0 && !f.r[0x11] && this.enemiesWithin(f, 255).some((e) => e.c[F.undead] > 0 && !e.r[0x10])) { await this.turnUndead(f); return }
    if (await this.aiCast(f)) return
    this.chooseWeapon(f)
    await fire(this, c, 14) // FUN_3334_0b3c: the gaze, breath and spit specials first (spec/combat.md)
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

  /**
   * Target finder (FUN_3aae_37e4): keep a valid target, else a random enemy (terrain ignored on a second
   * pass); with forceNew always a new one, in sight, in one pass.
   */
  findTarget(f: Fighter, forceNew = false): Fighter | null {
    if (!forceNew && f.target && this.inPlay(f.target) && this.side(f.target) !== this.side(f) && this.canTarget(f, f.target)) return f.target
    for (const pass of forceNew ? [0] : [0, 1]) {
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
    if (f.c[F.cls] === 5 && !fleeing) return false
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
    if (c[F.morale] < 0x80) return false
    let m = (c[F.morale] & 0x7f) * 2
    if (m > 102) m = 0
    fx.morale = m
    await fire(this, c, 17)
    m = fx.morale
    const lost = 100 - Math.floor((100 * c[F.hp]) / Math.max(1, c[F.maxHp]))
    if (m !== 0 && m >= lost) return false
    fx.morale = this.enemyPct
    await fire(this, c, 17)
    if (fx.morale !== 0 && fx.morale >= 100 - this.e.read(0x6dc6) && this.side(f) !== 0) return false
    const fast = Math.max(0, ...this.enemies(f).map((e) => this.moveOf(e) >> 1))
    if (fast <= this.moveOf(f) >> 1) { f.r[0x14] = 1; return false }
    if (c[F.stat[1]] > 5) {
      this.print(`${name(c)} Surrenders`)
      c[F.status] = 4; c[F.hp] = 0; c[F.inPlay] = 0
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
    if (c[F.morale] <= 0x7f && !this.magicOn) return false
    if (!this.enemies(f).length) return false
    const mem = Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k]).filter((v) => v > 0 && v < 0x80)
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
    if (it.type === 0x55 && f.target && s8(f.target.c[F.undead]) > 0) v = 8 // holy water against undead
    if (b.flags & 8) v = (v + 2 * (b.rate - 1)) & 0xff
    if (b.hands <= 1) v = (v + 3) & 0xff
    if (otherHands + b.hands > 3) v = 0
    if (it.props[2] === 0x84 && (it.props[1] & 0x0f) !== f.c[F.alignment]) v = 0 // alignment-locked
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
    const otherHands = c[F.hands] - (cur ? base(cur)!.hands : 0) - (curShield ? base(curShield)!.hands : 0)
    let ranged: Item | null = null, rangedScore = 1
    let melee: Item | null = null
    let meleeScore = (c[F.natDice] * c[F.natSides]) & 0xff
    if (s8(c[F.natBonus]) > 0) meleeScore = (meleeScore + 2 * s8(c[F.natBonus])) & 0xff
    let bestShield: Item | null = null, shieldScore = 0
    for (const it of items) {
      const b = base(it)
      if (!b || !(b.classes & c[F.itemMask])) continue
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
    if (c[F.hands] > 2) {
      if (sh && sh.cursed) { if (pick) pick.ready = false } else if (sh) sh.ready = false
      changed = true
    } else if (c[F.hands] < 2 && swapShield) {
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
      if (f.monster || c[F.morale] >= 0x80 || c[F.status] === 1 || !c[F.quick]) continue
      c[F.quick] = 0
      back.push(name(c))
    }
    return back
  }

  /** Debug (IMP-025): every enemy still standing falls at once; the aftermath runs as for a won battle. */
  debugWin() {
    for (const f of this.fighters) {
      if (this.side(f) !== 1 || f.c[F.status] === 3) continue
      f.c[F.status] = 6; f.c[F.inPlay] = 0; f.c[F.hp] = 0; f.size = 0
    }
    this.ended = true
  }

  outcome(): Outcome {
    const party = this.fighters.filter((f) => !f.monster)
    if (party.some((f) => [0, 1].includes(f.c[F.status]))) return 'won'
    if (party.some((f) => f.c[F.status] === 3 && f.c[F.morale] < 0x80)) return 'fled'
    // FUN_2e08_04c9: with ECL 0x6DE6 = 1 any non-NPC on the party's side keeps the party from defeat
    if (this.e.read(0x6de6) === 1 && party.some((f) => f.c[F.side] === 0 && f.c[F.morale] < 0x80)) return 'spared'
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
    if (e.duel && e.read(0x6de6)) return ((e.duelist ?? e.cur)[F.hitDice] * 100) & 0xffff // duel: no loot, no division
    let total = 0, taken = 0
    const loot: Item[] = []
    for (const f of b.fighters) {
      const c = f.c
      if (c[F.side] !== 1 || c[F.status] === 3) continue
      for (let i = 0; i < 7; i++) e.money[i] += u16(c, F.money + 2 * i)
      total += u16(c, F.xpBase) + s8short(c[F.hpRolled] * c[F.xpPerHp])
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
      if (!c[F.inPlay] || c[F.status] === 1) continue
      const prime: Record<number, number> = { 0: F.stat[2], 2: F.stat[0], 5: F.stat[1], 6: F.stat[3] }
      let add = share
      if (c[F.cls] in prime) { if (c[prime[c[F.cls]]] > 15) add += Math.floor(share / 10) }
      else if ([8, 10, 11, 12, 13, 14, 16].includes(c[F.cls])) add = Math.floor(share / 2)
      else if ([9, 15].includes(c[F.cls])) add = Math.floor(share / 3)
      const xp = (c[F.xp] | (c[F.xp + 1] << 8) | (c[F.xp + 2] << 16) | (c[F.xp + 3] << 24)) >>> 0
      const v = xp + add
      c[F.xp] = v & 0xff; c[F.xp + 1] = (v >> 8) & 0xff; c[F.xp + 2] = (v >> 16) & 0xff; c[F.xp + 3] = (v >>> 24) & 0xff
    }
  }
  if (e.duel) {
    // duel branch (FUN_2e08_04c9 with DS:84D4 set): never a defeat; each one standing on the party's
    // side earns the experience; then the bystanders come back into play and Dying becomes Unconscious
    let won = false
    for (const f of b.fighters) {
      const c = f.c
      if (c[F.inPlay] === 1 && c[F.status] === 0 && c[F.side] !== 1) { won = true; share = experience(0); award(share) }
    }
    for (const f of party) {
      if (f.c[F.status] === 0 || f.c[F.status] === 1) f.c[F.inPlay] = 1
      if (f.c[F.status] === 5) f.c[F.status] = 4
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
      if (c[F.status] === 5) c[F.status] = 4
      else if (c[F.status] === 4 && c[F.hp] > 0) { c[F.status] = 0; c[F.inPlay] = 1 }
    }
  } else if (outcome === 'won') {
    let noXP = 0
    for (const f of party) {
      const c = f.c
      if (c[F.status] === 3) { c[F.status] = 0; c[F.inPlay] = 1 }
      else if (c[F.status] === 5) c[F.status] = 4
      else if (c[F.status] === 4 && c[F.hp] > 0) { c[F.status] = 0; c[F.inPlay] = 1 }
      if (c[F.inPlay] === 0 || c[F.status] === 1) noXP++
    }
    share = experience(noXP)
    award(share)
    msgs.push('The party has won.')
    if (e.treasure.length || e.money.some((v) => v > 0)) msgs.push('The party has found Treasure!')
    msgs.push(`Each character receives ${share} experience points.`)
  } else if (outcome === 'fled') {
    e.write(0x6dc7, 0x81)
    for (const f of party) {
      if (f.c[F.status] === 3) { f.c[F.status] = 0; f.c[F.inPlay] = 1 }
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
    if (!f.monster && f.c[F.side] !== 1) continue
    if (!f.c[F.inPlay]) defeated++
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
  const npcs = e.party().filter((c) => c[F.morale] >= 0x80 && c[F.status] === 0)
  const npcShares = npcs.reduce((a, c) => a + (c[F.npcShare] & 7), 0)
  if (npcShares > 0) {
    const totalShares = npcShares + e.party().length - npcs.length
    for (let i = 0; i < 7; i++) {
      if (!e.money[i]) continue
      const per = Math.floor(e.money[i] / totalShares) & 0xff
      e.money[i] = Math.max(0, e.money[i] - per * npcShares)
    }
    for (const c of npcs) if (c[F.npcShare]) msgs.push(`${name(c)} takes and hides his share.`)
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
