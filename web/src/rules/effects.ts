// Effects ("affects", spec/A-games/engine/effects.md): per-event dispatch of effect handlers (FUN_5216_02fa), adding and
// removing effects, and the helpers the handlers share. Each game's handlers are named in its profile
// (games/effectrules.ts) and run as behaviours (rules/effectkinds.ts). Globals of the original
// (DS:6816..6826) live in the Fx context.
import type { Effect } from '../data/effects'
import type { Item } from '../data/items'
import { F } from '../games/fields'
import { game } from '../games/profile'
import { R } from '../games/rules'
import { behave, effectiveStat, itemBehave } from './effectkinds'
import type { Tables } from './chargen'
import { derive, xpFor } from './training'
import { msg } from '../games/strings'

/** What a handler can reach: the engine-wide globals and the battle helpers. */
export interface FxHost {
  effectsOf(c: Uint8Array): Effect[]
  itemsOf(c: Uint8Array): import('../data/items').Item[]
  print(text: string): void
  roll(count: number, sides: number): number
  name(c: Uint8Array): string
  /** list of everyone (party then monsters) */
  all(): Uint8Array[]
  inCombat(): boolean
  /** squares between two combatants (0 if not in combat) */
  distance(a: Uint8Array, b: Uint8Array): number
  /** the combatant's current target (combat record +0xA) */
  targetOf(c: Uint8Array): Uint8Array | null
  /** current character DS:5D92 */
  current(): Uint8Array | null
  /** end the turn (FUN_10ba_2637) */
  endTurn(c: Uint8Array): void
  /** combat record byte */
  rec(c: Uint8Array, i: number): number
  setRec(c: Uint8Array, i: number, v: number): void
  /** the set-status routine (FUN_3723_0058, CotAB 0x4AAC4): `setStatusOf`, then the host's fall */
  setStatus(c: Uint8Array, status: number, msg: string): void
  /** the berserk search's target (CotAB 0x553D8, 0x54B33); in battle only */
  nearestInSight?(c: Uint8Array): Uint8Array | null
  /** a combatant leaves the field (FUN_5216_0f06, CotAB 0x4BF57); in battle only */
  takeOff?(c: Uint8Array, status: number, msg: string): void
  /** damage (FUN_5216_1344) */
  damage(c: Uint8Array, dmg: number, mode: number, saved: boolean): void
  save(c: Uint8Array, type: number, bonus: number): boolean
  /** FUN_5216_175d: false when the status or mummy rot blocks it */
  heal(c: Uint8Array, amount: number, force: boolean): boolean
  revive(c: Uint8Array, hp: number): boolean
  recalc(c: Uint8Array): void
  /** the rules tables from START.EXE, when the player's files include it */
  tables?(): Tables | null
  /** enemies of c in sight within range */
  enemiesNear(c: Uint8Array, range: number): Uint8Array[]
  /** the combatant at a list index (for grab/drain victims) */
  byIndex(i: number): Uint8Array | null
  indexOf(c: Uint8Array): number
  attack(attacker: Uint8Array, target: Uint8Array): Promise<void>
  /** the readied weapon (or ammunition being fired, FUN_3723_101d) */
  weapon(c: Uint8Array): import('../data/items').Item | null
  /** ITEMS byte 7 of a type: 0 slashing, 1 piercing, 0x80 bashing */
  weaponKind(type: number): number
  /** an effect took hold in combat: the sparkle (FUN_5216_1656 → FUN_10ba_1feb) */
  sparkle?(c: Uint8Array): void
  /** the line for an effect that took hold, then the sparkle in combat (FUN_10ba_1feb with "good") */
  announce?(c: Uint8Array, msg: string): void
  /** a gaze (the spell bolt, 45 ms) or acid spit (COMSPR 10, 30 ms) flies from one to the other (combat only) */
  fly?(from: Uint8Array, to: Uint8Array, kind: 'gaze' | 'spit'): void
  /** the owner's cloud zone numbered power >> 4 of the cells `cell` (default 0x1E) lifts, `say` first; true if there was one (combat only) */
  clearCloud?(c: Uint8Array, power: number, cell?: number, say?: string): boolean
  /** make t the combatant's target (combat record +0xA; combat only) */
  setTarget?(c: Uint8Array, t: Uint8Array): void
  // the battlefield, for the monster specials of event 14 (rules/specials.ts; combat only)
  /** the aimed square (PoR DS:6DB9/6DBA, CotAB DS:7573/7574) */
  aimed?: { x: number; y: number }
  /** the cell a combatant stands on (its top-left) */
  cellOf?(c: Uint8Array): { x: number; y: number } | null
  /**
   * The computer's spell target pick (PoR DS:6B84[0] = FUN_3aae_20c3(spell, ai 1, &ok); CotAB
   * *DS:72BA): aims and sets the combatant's target; false without a target
   */
  aimSpell?(c: Uint8Array, spell: number): Promise<boolean>
  /** the AI target finder over the whole field (FUN_3aae_37e4(c, 0xFF, 0, forceNew); CotAB 0x2E394): sets the target */
  pickTarget?(c: Uint8Array, forceNew: boolean): Uint8Array | null
  /** cast a spell as the computer does (PoR FUN_4e53_0c20, CotAB 0x45251) */
  castAs?(c: Uint8Array, spell: number): Promise<void>
  /** a flight between cells (FUN_10ba_1a29) with the first `count` frames of COMSPR cycle `slot` (FUN_10ba_19de) */
  flyCells?(from: { x: number; y: number }, to: { x: number; y: number }, slot: number, count: number, delay: number): void
  /** the bolt hit on a cell (PoR FUN_4e53_28bc, CotAB 0x478F6): damage type 0x0C, a save of `save` halves */
  boltHit?(x: number, y: number, dmg: number, save: number): void
  /** the bolt path from the aimed square away from c (PoR FUN_4e53_295b, CotAB 0x479B4) */
  bolt?(c: Uint8Array, len: number, dmg: number, save: number, bounceBonus: boolean): void
  /** CotAB's area template 0x4573F: who stands on `width` lines from c towards (x, y), `len` squares or more */
  fan?(c: Uint8Array, x: number, y: number, width: number, len: number): Uint8Array[]
  /** a player's choice from a menu (index; anything else: none), and a yes/no question */
  choose?(prompt: string, items: string[]): Promise<number>
  ask?(prompt: string): Promise<boolean>
}

/** The original's globals during one dispatch chain. */
export const fx = {
  roll: 0, // DS:6822 attack roll
  save: 0, // DS:6816 save roll
  saveType: 0, // DS:682A
  dmg: 0, // DS:6818
  dmgType: 0, // DS:6819: 1 fire, 2 cold, 4 electric, 8 magic, 0x10 acid
  rate: 0, // DS:681A
  rateIsMove: false, // DS:681D
  spell: 0, // DS:681B spell resolving
  dice: 0, // DS:681C
  untargetable: false, // DS:681E
  noRearm: false, // DS:681F
  area: false, // DS:6820
  adding: 0, // DS:6817 effect being added
  morale: 0, // DS:6825
  hits: [0, 0, 0], // DS:6823/6824 hits per hand
  round: 0, // DS:6DE3
  saved: false, // CotAB DS:6FC2: the last saving throw succeeded (1 while its event 12 runs)
}

/** the active game's named effect types (games/effectrules.ts `ids`) */
export const ids = () => game().effects.ids

/**
 * Going down (PoR FUN_5216_100a, CotAB 0x4C05B): the first record of each `goingDown` type, in order,
 * through the removal routine (its callbacks' synchronous part runs here, the record goes at once);
 * then (`downRejoins`) one holding the effect with that morale byte goes back to side 0.
 */
export function goingDown(h: FxHost, c: Uint8Array) {
  const list = h.effectsOf(c)
  for (const type of ids().goingDown) {
    const e = list.find((x) => x.type === type)
    if (!e) continue
    void removeEffect(h, c, e)
    const j = list.indexOf(e)
    if (j >= 0) list.splice(j, 1)
  }
  const back = ids().downRejoins
  if (back && list.some((x) => x.type === back.effect) && c[F.morale] === back.morale) c[F.side] = 0
}

/**
 * The set-status routine's rules part (PoR FUN_3723_0058, CotAB 0x4AAC4): the message, printed first;
 * unless the character is already dead, stoned or gone (6–8), the status, out of play with HP 0, going
 * down and the game's event (R.setStatusEvent: 13; SotSB 0x508C0 none). True when the status was set;
 * the host then draws the fall (FUN_577f_0e11).
 */
export function setStatusOf(h: FxHost, c: Uint8Array, status: number, msg: string): boolean {
  if (msg) h.print(msg)
  if ([6, 7, 8].includes(c[F.status])) return false
  c[F.status] = status
  c[F.inPlay] = 0
  c[F.hp] = 0
  goingDown(h, c)
  const ev = R.setStatusEvent // 13 (PoR, CotAB); SotSB 0x50929 fires none
  if (ev !== null) void fire(h, c, ev)
  return true
}

export const has = (h: FxHost, c: Uint8Array, t: number) => h.effectsOf(c).some((e) => e.type === t)

/**
 * Fire an event on a character (FUN_5216_02fa): each listed type in order, the holder's record or, for
 * area effects, a neighbour's. A handler that has nothing to wait for runs at once, so a chain of them
 * is complete when this returns (the save, damage and attack events read the globals straight after).
 */
export function fire(h: FxHost, c: Uint8Array, event: number): Promise<void> {
  const rules = game().effects
  const types = rules.events[event] ?? []
  const from = (i: number): Promise<void> => {
    for (; i < types.length; i++) {
      const type = types[i]
      let eff = h.effectsOf(c).find((e) => e.type === type)
      if (!eff && rules.area.includes(type)) {
        for (const o of h.all()) {
          const e = h.effectsOf(o).find((x) => x.type === type)
          if (!e) continue
          if (h.inCombat() && h.distance(o, c) > (rules.areaRadius[type] ?? 1)) continue
          eff = e
          break
        }
      }
      if (!eff) continue
      const r = handle(h, type, eff, c, event, false)
      if (r) { const next = i + 1; return r.then(() => from(next)) }
    }
    return Promise.resolve()
  }
  return from(0)
}

/** Run an effect's handler directly (a "run at once" call through FUN_5216_0000, arg 0). */
export function runEffect(h: FxHost, type: number, eff: Effect, c: Uint8Array): void | Promise<void> {
  return handle(h, type, eff, c, -1, false)
}

/** Remove an effect record, running its removal callback when flagged (FUN_5216_0026). */
export async function removeEffect(h: FxHost, c: Uint8Array, eff: Effect) {
  const list = h.effectsOf(c)
  const i = list.indexOf(eff)
  if (i < 0) return
  if (eff.flag) await handle(h, eff.type, eff, c, -1, true)
  const j = list.indexOf(eff)
  if (j >= 0) list.splice(j, 1)
  // CotAB 0x4ABBA: some removals recompute a stat (PoR's handlers restore it themselves)
  // (the current-stat routine, CotAB 0x4C389: a game whose handlers restore the stat themselves lists none)
  for (const stat of game().effects.removalStat[eff.type] ?? []) await effectiveStat(h, c, stat)
}

export async function removeType(h: FxHost, c: Uint8Array, type: number, silent = false) {
  for (const e of h.effectsOf(c).filter((x) => x.type === type)) {
    const keep = fx.noRearm
    if (silent) fx.noRearm = true
    await removeEffect(h, c, e)
    fx.noRearm = keep
  }
}

/** Add an effect raw (FUN_5216_0e52). */
export function addRaw(h: FxHost, c: Uint8Array, type: number, duration: number, power: number, flag: number): Effect {
  const e = { type, duration, power, flag }
  h.effectsOf(c).push(e)
  return e
}

/**
 * Add an effect through event 9 (FUN_5216_1656, CotAB 0x4CD91): blocked by immunities or a negating save
 * ("is Unaffected"); an old record of the same type goes by the game's rule (`effects.replaces`).
 */
export async function addEffect(h: FxHost, c: Uint8Array, type: number, duration: number, power: number, flag: number,
  saveKind = 0, saved = false, runNow = false, said = ''): Promise<boolean> {
  fx.adding = type
  await fire(h, c, 9)
  if (fx.adding === 0 || (saved && saveKind === 1)) {
    h.print(`${h.name(c)} ${msg('unaffected')}`)
    fx.adding = 0
    return false
  }
  fx.adding = 0
  const old = h.effectsOf(c).find((e) => e.type === type)
  const replace = game().effects.replaces === 'anyTimed' ? old && old.duration > 0 : old && ((old.duration > 0 && duration > old.duration) || duration === 0)
  if (old && replace) await removeEffect(h, c, old)
  const e = addRaw(h, c, type, duration, power, flag)
  // FUN_5216_1656: a non-empty message is shown with the sparkle (sound 4) in combat; none, nothing
  if (said) { if (h.announce) h.announce(c, said); else h.print(`${h.name(c)} ${said}`) }
  if (runNow) await handle(h, type, e, c, -1, false)
  return true
}

/**
 * The damage line of FUN_5216_1344: the kind matches the type exactly (bit 3 ignored), and a
 * type of 0 or 8 adds "from Magic".
 */
export function damageText(name: string, d: number, type: number): string {
  const k = type & 0xf7
  const kind = k === 1 ? msg('fromFire') : k === 2 ? msg('fromCold') : k === 4 ? msg('fromElectricity') : k === 0x10 ? msg('fromAcid') : ''
  const magic = (type & 8) === type ? msg('fromMagic') : ''
  // FUN_5216_1344's pieces: "takes 1 point of damage ", or "takes ", d, " points of damage "
  return `${name} ${d === 1 ? msg('takesOnePoint') : `${msg('takes')}${d}${msg('pointsOfDamageLine')}`}${kind}${magic}`.trimEnd()
}

/** FUN_10ba_234a: "is fully healed" at full HP, else "is partially healed", with the pause. */
export function healedLine(h: FxHost, c: Uint8Array) {
  h.print(`${h.name(c)} is ${c[F.hp] === c[F.maxHp] ? 'fully' : 'partially'} healed`)
}

/** FUN_3723_0000(t) (CotAB 0x27369): negate damage (event 6) or block the effect being added (event 9). */
export function negate(t: number) {
  if (t === 0 || fx.adding === t) { fx.dmg = 0; fx.adding = 0 }
}

/** FUN_3723_001f: re-arm a periodic effect unless suppressed. */
export function rearm(h: FxHost, c: Uint8Array, type: number, duration: number, power: number): boolean {
  if (fx.noRearm) return false
  addRaw(h, c, type, duration, power, 1)
  return true
}

/** Missile deflection (FUN_3723_0fac). */
export function deflect(h: FxHost, c: Uint8Array, pct: number) {
  const a = h.current()
  if (!a || !weaponOf(h, a) || h.distance(a, c) <= 1) return
  if (h.roll(1, 100) <= pct) {
    h.print(`${h.name(c)} ${msg('avoidsIt')}`)
    fx.dmg = 0
    fx.roll = -1
    if (fx.hits[1] > 0) fx.hits[1]--
  }
}

const weaponOf = (h: FxHost, c: Uint8Array) => h.weapon(c)

/**
 * The class a drain takes a level from, and the experience that level starts at (FUN_3723_2002): the
 * highest level, ties to the later class, compared by the experience the level needs (DS:409B,
 * 0 below level 2).
 */
function drainPick(tb: Tables, t: Uint8Array): { best: number; xp: number } {
  let best = 0, xp = 0, top = 0
  for (let k = 0; k < F.classCount; k++) {
    const lv = (t[F.levels + k] << 24) >> 24
    const need = lv > 1 ? xpFor(tb, k, lv) : 0
    if (lv >= top && (need >= xp || need === 0xffffffff)) { xp = need; best = k; top = lv }
  }
  return { best, xp }
}

/** Energy drain of n levels (FUN_3723_2122). */
export function drain(h: FxHost, t: Uint8Array, n: number) {
  h.print(`${h.name(t)} ${msg('isDrained')}${n > 1 ? `${n}${msg('drainLevels')}` : msg('drainALevel')}`)
  if (t[F.status] === 1) { h.setStatus(t, 8, `${h.name(t)} ${msg('deadForever')}`); t[F.maxHp] = 0; return }
  const tb = h.tables?.()
  for (let i = 0; i < n; i++) {
    if (t[F.status] === 8) continue
    t[F.drainLevels]++
    let total = 0
    for (let k = 0; k < F.classCount; k++) total += t[F.levels + k]
    if (total <= 0) break // the original divides by zero here
    const loss = Math.floor(t[F.maxHp] / total)
    // IMP-067: the lost-HP counter stops at 255 instead of wrapping
    t[F.drainHp] = Math.min(255, t[F.drainHp] + loss)
    t[F.maxHp] = Math.max(0, t[F.maxHp] - loss)
    t[F.hpRolled] = Math.max(0, t[F.hpRolled] - loss)
    t[F.hp] = Math.max(0, t[F.hp] - loss)
    if (!tb) { // no START.EXE: the level comes off the highest class, as before
      let best = 0
      for (let k = 1; k < F.classCount; k++) if (t[F.levels + k] > t[F.levels + best]) best = k
      if (t[F.levels + best] <= 1) { h.setStatus(t, 8, `${h.name(t)} ${msg('deadForever')}`); t[F.maxHp] = 0; continue }
      t[F.levels + best]--
      if (t[F.hp] === 0 && t[F.status] !== 6) h.setStatus(t, 6, `${h.name(t)} ${msg('drainKilled')}`)
      h.recalc(t)
      continue
    }
    if (((t[F.hitDice] << 24) >> 24) < 2) {
      h.setStatus(t, 8, `${h.name(t)} ${msg('deadForever')}`)
      t[F.maxHp] = 0
      const { best } = drainPick(tb, t)
      if (t[F.levels + best] > 0 && n === 2) t[F.levels + best] = 0
    } else {
      t[F.levels + drainPick(tb, t).best]--
      if (t[F.hp] === 0 && t[F.status] !== 6) h.setStatus(t, 6, `${h.name(t)} ${msg('drainKilled')}`)
      derive(tb, t)
    }
    const { best, xp } = drainPick(tb, t)
    t[F.hitDice] = t[F.levels + best]
    t[F.xp] = xp & 0xff; t[F.xp + 1] = (xp >> 8) & 0xff; t[F.xp + 2] = (xp >> 16) & 0xff; t[F.xp + 3] = (xp >>> 24) & 0xff
    h.recalc(t)
  }
}

/**
 * One handler call (FUN_5216_0000; CotAB 0x4AB77). event −1 = removal (arg 1) or a direct run. The
 * game's profile names the behaviour for the type (games/effectrules.ts `handlers`, rules/effectkinds.ts).
 * A behaviour that waits for something (an attack, a removal, an effect added through its event) is
 * async; the others are synchronous, so the rest of the event's chain follows at once, as the original's
 * does, and the save, damage and attack routines see every handler.
 */
export function handle(h: FxHost, type: number, eff: Effect, c: Uint8Array, event: number, removal: boolean): void | Promise<void> {
  const spec = game().effects.handlers[type]
  if (spec) return behave(h, spec, eff, c, removal, event, type)
}

// ---------------------------------------------------------------- Strength effects (12 Enlarge, 38 Strength)
/** STR in an effect's power (FUN_5216_10e4 / 110d): 18/p is p + 1, other STR is STR + 100; bit 7 marks a dormant record. */
export const strEnc = (str: number, pct: number) => (str === 18 ? pct + 1 : str + 100) & 0x7f
export function strDec(v: number): [number, number] {
  v &= 0x7f
  return v <= 101 ? [18, v - 1] : [v - 100, 0]
}
export const strKey = ([s, p]: [number, number]) => s * 101 + (s === 18 ? p : 0)

/**
 * FUN_5216_115c: try to set STR to str/pct. Weaker than now: nothing changes, and the power to store is
 * the new STR, dormant (bit 7). Otherwise the active STR record (power < 0x80) turns dormant holding the
 * current STR, the character gets the new STR, and the power to store is the STR to restore later.
 */
export function setStr(h: FxHost, c: Uint8Array, str: number, pct: number): { ok: boolean; pw: number } {
  const cs = c[F.stat[0]], cp = c[F.strPct]
  if (str < cs || (str === 18 && cs === 18 && pct < cp)) return { ok: false, pw: strEnc(str, pct) | 0x80 }
  const prev = h.effectsOf(c).find((e) => ids().strength.includes(e.type) && e.power < 0x80)
  let pw = strEnc(cs, cp)
  if (prev) { pw = prev.power & 0x7f; prev.power = strEnc(cs, cp) | 0x80 }
  c[F.stat[0]] = str
  c[F.strPct] = str === 18 ? pct : 0
  h.recalc(c)
  return { ok: true, pw }
}

/**
 * FUN_3723_04ba, removal of 12/38 (`types`): an active record restores the STR it holds; the strongest
 * other record then takes over.
 */
export function restoreStr(h: FxHost, c: Uint8Array, eff: Effect, types = [12, 38]) {
  if (eff.power >= 0x80) return
  let [s, p] = strDec(eff.power)
  c[F.stat[0]] = s; c[F.strPct] = p
  const others = h.effectsOf(c).filter((x) => x !== eff && types.includes(x.type))
  if (others.length) {
    const best = others.reduce((a, b) => (strKey(strDec(b.power)) > strKey(strDec(a.power)) ? b : a))
    const [bs, bp] = strDec(best.power)
    best.power = strEnc(s, p)
    s = bs; p = bp
    c[F.stat[0]] = s; c[F.strPct] = p
  }
  h.recalc(c)
}

/** Remove the first (oldest) record of a type through FUN_5216_0026; true if there was one. */
export async function removeFirst(h: FxHost, c: Uint8Array, type: number): Promise<boolean> {
  const e = h.effectsOf(c).find((x) => x.type === type)
  if (!e) return false
  await removeEffect(h, c, e)
  return true
}
/** FUN_5216_1081 (CotAB 0x4C0FD): say "<name> is Cured", then remove the first record of a type. */
export async function removeOne(h: FxHost, c: Uint8Array, type: number): Promise<boolean> {
  const e = h.effectsOf(c).find((x) => x.type === type)
  if (!e) return false
  h.print(`${h.name(c)} ${msg('isCured')}`)
  await removeEffect(h, c, e)
  return true
}

// ---------------------------------------------------------------- item handlers
/**
 * The handler of an item with item[0x3E] ≥ 0x80, run by Ready (arg 0, after readying) and Unready
 * (arg 1, after unreadying) only (PoR FUN_4894_14d0 → FUN_5216_0000, CotAB 0x3F034): the behaviour the
 * game's profile names for +0x3E & 0x7F (games/effectrules.ts `items`, rules/effectkinds.ts).
 */
export async function itemHandler(h: FxHost, c: Uint8Array, it: Item, arg: 0 | 1) {
  const spec = game().effects.items[it.raw[0x3e] & 0x7f]
  if (spec) await itemBehave(h, spec, c, it, arg === 0)
}
