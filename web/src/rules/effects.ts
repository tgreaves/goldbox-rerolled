// Effects ("affects", spec/effects.md): per-event dispatch of effect handlers (FUN_5216_02fa) and the
// handlers themselves. Globals of the original (DS:6816..6826) live in the Fx context.
import type { Effect } from '../data/effects'
import { Item, ITEM_SIZE } from '../data/items'
import { F } from '../games/fields'
import { R } from '../games/rules'
import { game } from '../games/profile'
import type { ItemProcedure } from '../games/effectrules'
import { refillUses } from './abilities'
import { behave, effectiveStat, itemKind } from './effectkinds'
import { breathBolt } from './specials'
import type { Tables } from './chargen'
import { derive, xpFor } from './training'

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
  /** set status with a message, unless already dead/stoned/gone (FUN_3723_0058) */
  setStatus(c: Uint8Array, status: number, msg: string): void
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
  saveKind = 0, saved = false, runNow = false, msg = ''): Promise<boolean> {
  fx.adding = type
  await fire(h, c, 9)
  if (fx.adding === 0 || (saved && saveKind === 1)) {
    h.print(`${h.name(c)} is Unaffected`)
    fx.adding = 0
    return false
  }
  fx.adding = 0
  const old = h.effectsOf(c).find((e) => e.type === type)
  const replace = game().effects.replaces === 'anyTimed' ? old && old.duration > 0 : old && ((old.duration > 0 && duration > old.duration) || duration === 0)
  if (old && replace) await removeEffect(h, c, old)
  const e = addRaw(h, c, type, duration, power, flag)
  // FUN_5216_1656: a non-empty message is shown with the sparkle (sound 4) in combat; none, nothing
  if (msg) { if (h.announce) h.announce(c, msg); else h.print(`${h.name(c)} ${msg}`) }
  if (runNow) await handle(h, type, e, c, -1, false)
  return true
}

/**
 * The damage line of FUN_5216_1344: the kind matches the type exactly (bit 3 ignored), and a
 * type of 0 or 8 adds "from Magic".
 */
export function damageText(name: string, d: number, type: number): string {
  const k = type & 0xf7
  const kind = k === 1 ? 'from Fire' : k === 2 ? 'from Cold' : k === 4 ? 'from Electricity' : k === 0x10 ? 'from Acid' : ''
  const magic = (type & 8) === type ? 'from Magic' : ''
  return `${name} takes ${d === 1 ? '1 point' : `${d} points`} of damage ${kind}${magic}`.trimEnd()
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
function rearm(h: FxHost, c: Uint8Array, type: number, duration: number, power: number): boolean {
  if (fx.noRearm) return false
  addRaw(h, c, type, duration, power, 1)
  return true
}

/** Missile deflection (FUN_3723_0fac). */
function deflect(h: FxHost, c: Uint8Array, pct: number) {
  const a = h.current()
  if (!a || !weaponOf(h, a) || h.distance(a, c) <= 1) return
  if (h.roll(1, 100) <= pct) {
    h.print(`${h.name(c)} Avoids it`)
    fx.dmg = 0
    fx.roll = -1
    if (fx.hits[1] > 0) fx.hits[1]--
  }
}

const weaponOf = (h: FxHost, c: Uint8Array) => h.weapon(c)

const nameIs = (c: Uint8Array, names: string[]) => names.includes(String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name])))
const alignmentIn = (c: Uint8Array | null, set: number[]) => !!c && set.includes(c[F.alignment])

async function poisonOnHit(h: FxHost, bonus: number) {
  const t = h.targetOf(h.current()!)
  if (!t || !t[F.inPlay]) return
  if (!h.save(t, 0, bonus)) {
    await addEffect(h, t, 55, 0, 0xff, 0)
    h.setStatus(t, 6, `${h.name(t)} is Poisoned`)
  }
}
async function paralyse(h: FxHost, duration: number) {
  const t = h.targetOf(h.current()!)
  if (!t || !t[F.inPlay]) return
  if (!h.save(t, 0, 0)) {
    if (h.announce) h.announce(t, 'is Paralyzed'); else h.print(`${h.name(t)} is Paralyzed`)
    await addEffect(h, t, 52, duration, 0x0c, 0)
  }
}

/**
 * The class a drain takes a level from, and the experience that level starts at (FUN_3723_2002): the
 * highest level, ties to the later class, compared by the experience the level needs (DS:409B,
 * 0 below level 2).
 */
function drainPick(tb: Tables, t: Uint8Array): { best: number; xp: number } {
  let best = 0, xp = 0, top = 0
  for (let k = 0; k < 8; k++) {
    const lv = (t[F.levels + k] << 24) >> 24
    const need = lv > 1 ? xpFor(tb, k, lv) : 0
    if (lv >= top && (need >= xp || need === 0xffffffff)) { xp = need; best = k; top = lv }
  }
  return { best, xp }
}

/** Energy drain of n levels (FUN_3723_2122). */
export function drain(h: FxHost, t: Uint8Array, n: number) {
  h.print(`${h.name(t)} is drained ${n > 1 ? `${n} levels` : 'a level'}`)
  if (t[F.status] === 1) { h.setStatus(t, 8, `${h.name(t)} is dead forever`); t[F.maxHp] = 0; return }
  const tb = h.tables?.()
  for (let i = 0; i < n; i++) {
    if (t[F.status] === 8) continue
    t[F.drainLevels]++
    let total = 0
    for (let k = 0; k < 8; k++) total += t[F.levels + k]
    if (total <= 0) break // the original divides by zero here
    const loss = Math.floor(t[F.maxHp] / total)
    // IMP-067: the lost-HP counter stops at 255 instead of wrapping
    t[F.drainHp] = Math.min(255, t[F.drainHp] + loss)
    t[F.maxHp] = Math.max(0, t[F.maxHp] - loss)
    t[F.hpRolled] = Math.max(0, t[F.hpRolled] - loss)
    t[F.hp] = Math.max(0, t[F.hp] - loss)
    if (!tb) { // no START.EXE: the level comes off the highest class, as before
      let best = 0
      for (let k = 1; k < 8; k++) if (t[F.levels + k] > t[F.levels + best]) best = k
      if (t[F.levels + best] <= 1) { h.setStatus(t, 8, `${h.name(t)} is dead forever`); t[F.maxHp] = 0; continue }
      t[F.levels + best]--
      if (t[F.hp] === 0 && t[F.status] !== 6) h.setStatus(t, 6, `${h.name(t)} is killed`)
      h.recalc(t)
      continue
    }
    if (((t[F.hitDice] << 24) >> 24) < 2) {
      h.setStatus(t, 8, `${h.name(t)} is dead forever`)
      t[F.maxHp] = 0
      const { best } = drainPick(tb, t)
      if (t[F.levels + best] > 0 && n === 2) t[F.levels + best] = 0
    } else {
      t[F.levels + drainPick(tb, t).best]--
      if (t[F.hp] === 0 && t[F.status] !== 6) h.setStatus(t, 6, `${h.name(t)} is killed`)
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
 * game's profile may name another behaviour for the type (rules/coabeffects.ts); else PoR's handler.
 */
function handle(h: FxHost, type: number, eff: Effect, c: Uint8Array, event: number, removal: boolean): void | Promise<void> {
  const spec = game().effects.handlers[type]
  if (spec) return behave(h, spec, eff, c, removal)
  // PoR's handler is async, but it runs to the end synchronously unless its type waits for something
  // (an attack, a removal, an effect added through its event): the rest of the event's chain must then
  // follow at once, as the original's does, so the save, damage and attack routines see every handler
  const p = porHandle(h, type, eff, c, event, removal)
  return POR_WAITS.has(type) || removal ? p : undefined
}

/** PoR handler types that wait (await) inside their case of porHandle. */
const POR_WAITS = new Set([22, 28, 34, 64, 65, 66, 67, 68, 69, 70, 73, 74, 75, 84, 88, 99, 121])

/** PoR's handlers (spec/effects.md), by type. */
async function porHandle(h: FxHost, type: number, eff: Effect, c: Uint8Array, event: number, removal: boolean) {
  if (removal && R.paladin && type === R.paladin.cureDisease.effect) return refillUses(c) // the game's weekly refill
  const cur = h.current()
  switch (type) {
    case 1: if (event === 10) fx.roll++; else if (event === 17) fx.morale += 5; break
    case 2: if (event === 10) fx.roll--; else if (event === 17) fx.morale = Math.max(0, fx.morale - 5); break
    case 3: { const t = h.targetOf(c); if (t && t[F.monsterType] === 4) { if (event === 10) fx.roll += 2; else fx.dmg += 2 } break }
    case 4: if (removal) { h.print(`${h.name(c)} starts to train`); addRaw(h, c, 7, 43200, 0xff, 1) } break
    case 6: {
      const t = h.targetOf(c)
      const b = !t ? 0 : t[F.monsterType] === 10 ? 1 : t[F.monsterType] === 9 || t[F.monsterType] === 12 ? 2 : t[F.monsterType] === 4 ? 3 : 0
      if (event === 10) fx.roll += b
      else { fx.dmg += b; fx.dmgType = 9 }
      break
    }
    case 7: if (removal) { h.print(`${h.name(c)} is hardier`); c[F.stat[4]]++; if (c[F.stat[4]] >= 20) addRaw(h, c, 62, 60, 0, 1) } break
    case 8: case 45: if (alignmentIn(cur, [2, 5, 8])) { if (event === 12) fx.save += 2 } break
    case 9: case 46: if (alignmentIn(cur, [0, 3, 6])) { if (event === 12) fx.save += 2 } break
    case 10: if (event === 6 && fx.dmgType & 2) fx.dmg = Math.floor(fx.dmg / 2); else if (event === 12) fx.save += 3; break
    case 11: { // Charm Person
      if (removal) { c[F.side] = (eff.power >> 6) & 1; if (c[F.morale] === 0xb3) c[F.morale] = 0; break }
      if (!(eff.power & 0x20)) {
        eff.power = (eff.power + 0x20 + c[F.side] * 0x40) & 0xff
        c[F.side] = eff.power >> 7
        c[F.quick] = 1
        if (c[F.morale] < 0x80) c[F.morale] = 0xb3
        h.setRec(c, 0xa, 0)
      }
      if (event === 17) fx.morale = 100
      break
    }
    case 12: case 38: if (removal) restoreStr(h, c, eff); break
    case 23: spiritualHammer(h, c, removal); break
    case 14: if (removal) c[F.stat[5]] = eff.power; break
    case 15: if (removal && rearm(h, c, 15, 10, 0xff) && c[F.hp] > 1) { fx.dmgType = 0; h.damage(c, 1, 0, false) } break
    case 17: // Shield
      if (event === 11) c[F.ac] = Math.max(c[F.ac], 57)
      else if (event === 12) fx.save += 1
      else if (event === 6 && fx.spell === 15) fx.dmg = 0
      break
    case 18: { const t = h.targetOf(c); if (t && t[F.monsterType] === 1 && t[F.sizeFlags] === 1 && nameIs(t, ['KOBOLD', 'KOBOLD LEADER', 'GOBLIN', 'GOBLIN LEADER'])) fx.roll++; break }
    case 20: if (event === 6 && fx.dmgType & 1) fx.dmg = Math.floor(fx.dmg / 2); else if (event === 12) fx.save += 3; break
    case 21: if (h.rec(c, 2)) h.print(`${h.name(c)} is silenced`); h.setRec(c, 1, 0); h.setRec(c, 2, 0); break
    case 22: if (removal) { if (has(h, c, 55)) h.setStatus(c, 6, `${h.name(c)} dies from poison`); await removeType(h, c, 15, true) } break
    case 25: // Invisibility
      if (event === 1 && cur && !has(h, cur, 24)) fx.untargetable = true
      else if (event === 16) fx.roll -= 4
      break
    case 26: { const t = h.targetOf(c); if (t && t[F.monsterType] === 1 && t[F.sizeFlags] === 1 && nameIs(t, ['ORC', 'ORC LEADER', 'GOBLIN', 'GOBLIN LEADER', 'HOBGOBLIN', 'HOBGOBLIN CHIEF', 'GAGOOL', 'MACE'])) fx.roll++; break }
    case 28: // Mirror Image
      if ((event === 5 || event === 6) && fx.spell !== 0 && !fx.area && h.roll(1, eff.power + 1) > 1) {
        fx.dmg = 0
        h.print(`${h.name(c)} lost an image`)
        if (--eff.power <= 0) await removeEffect(h, c, eff)
      }
      break
    case 29: if (event === 4) fx.dmg -= Math.floor(fx.dmg / 4); break
    case 30: // Stinking Cloud
      if (event === 15 && h.rec(c, 2)) h.print(`${h.name(c)} is coughing`)
      h.setRec(c, 1, 0); h.setRec(c, 2, 0)
      if (event === 11) { c[F.acRear] = Math.max(0x32, c[F.acRear] - 2); c[F.ac] = c[F.acRear] }
      break
    case 31: case 51: case 52: case 53: if (event === 7) h.endTurn(c); break
    case 32: if (removal && !fx.noRearm) { // an animated body falls; sweep = fighter level, even 0, as 3723:0b7d (the next recalc sets it ≥ 1)
      h.setStatus(c, 6, `${h.name(c)} collapses`)
      c[F.side] = eff.power >> 4; c[F.quick] = 1; c[F.undead] = 0; c[F.sweep] = c[F.levels + 2]; c[F.baseMove] = 12
      if (c[F.morale] === 0xb3) c[F.morale] = 0
      c[F.monsterType] = 0
    } break
    case 33: if (event === 10) fx.roll -= 4; else if (event === 11) { c[F.ac] = Math.max(0, c[F.ac] - 4); c[F.acRear] = Math.max(0, c[F.acRear] - 4) } else if (event === 12) fx.save -= 4; break
    case 34: await handle(h, 43, eff, c, event, removal); await handle(h, 44, eff, c, event, removal); break
    case 35: if (event === 12) fx.save += 1; else fx.roll += 1; break
    case 36: if (event === 10) fx.roll -= 4; else if (event === 12) fx.save -= 4; break
    case 37: if (h.rec(c, 3) > 0) { if (event === 1) fx.untargetable = true; else fx.roll = -1 } break
    case 39: // Haste
      if (!(eff.power & 0x10)) { eff.power |= 0x10; h.print(`${h.name(c)} ages`); const a = (c[F.age] | (c[F.age + 1] << 8)) + 1; c[F.age] = a & 0xff; c[F.age + 1] = a >> 8 }
      fx.rate *= 2
      break
    case 40: if (removal && h.inCombat()) h.clearCloud?.(c, eff.power, 0x1e, 'The air clears a little...'); break // FUN_3723_0cc3; zones are freed at the end of combat (FUN_320c_0000)
    case 41: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (w && w.raw[0x32] === 0) deflect(h, c, 100); break }
    case 42: fx.rate = Math.floor(fx.rate / 2); break
    case 43: if (removal || event === -1) {
      if (removal && !rearm(h, c, 43, 60, eff.power)) break
      if (c[F.stat[0]] > 3) { h.print(`${h.name(c)} is weakened`); c[F.stat[0]]-- } else addRaw(h, c, 31, 0, 0xff, 0)
    } break
    case 44: if (removal || event === -1) {
      if (removal && !rearm(h, c, 44, 10, eff.power)) break
      if (c[F.hp] < 2) { if (!has(h, c, 31)) addRaw(h, c, 31, 0, 0xff, 0) } else h.damage(c, 1, 0, false)
    } break
    case 47: { const a = h.current(); if (a && a[F.monsterType] === 1 && (a[F.sizeFlags] & 0x7f) === 2 && nameIs(a, ['OGRE', 'OGRE LEADER', 'TROLL', 'FIRE GIANT', 'HILL GIANT', 'FROST GIANT', 'STONE GIANT'])) fx.roll -= 4; break }
    case 48: { const a = h.current(); if (a && a[F.monsterType] === 1 && nameIs(a, ['BUGBEAR', 'GNOLL'])) fx.roll -= 4; break }
    case 49: { // Prayer: allies of the caster +1/+1, enemies −1/−1
      const side = (eff.power & 0x10) >> 4
      if (c[F.side] === side) { if (event === 12) fx.save += 1; else fx.roll += 1 } else if (event === 12) fx.save -= 1; else fx.roll -= 1
      break
    }
    case 50: if (removal && rearm(h, c, 50, 14400, eff.power) && h.heal(c, 1, true)) healedLine(h, c); break
    case 56: addRaw(h, c, 25, 1, 0x0c, 0); break
    case 57: if (removal && !fx.noRearm) {
      h.print(`${h.name(c)} Rots...`)
      c[F.stat[5]] = Math.max(3, c[F.stat[5]] - 2)
      if (eff.power >> 4 > 1) addRaw(h, c, 57, 43200, eff.power - 0x10, 1)
      else h.setStatus(c, 6, `${h.name(c)} Dies rots away`)
    } break
    case 58: h.setRec(c, 6, 0); if (fx.rateIsMove) fx.rate = 0; break
    case 59: if (removal) addRaw(h, c, 98, 0, 0xff, 0); break
    case 61: if (event === 6 && fx.dmgType & 1) { fx.dmg = Math.max(fx.dice, fx.dmg - 2 * fx.dice); if (!(fx.dmgType & 8)) fx.dmg = 0 } else if (event === 12) fx.save += 4; break
    case 62: if (removal && rearm(h, c, 62, 60, eff.power) && h.heal(c, 1, false)) healedLine(h, c); break
    case 64: await poisonOnHit(h, 0); break
    case 65: await poisonOnHit(h, 4); break
    case 66: await poisonOnHit(h, 2); break
    case 67: await paralyse(h, h.roll(2, 8)); break
    case 68: { const t = h.targetOf(c); if (t && t[F.race] !== 2) await paralyse(h, 63); break }
    case 69: await paralyse(h, h.roll(1, 9) + 10); break
    case 70: await poisonOnHit(h, -2); break
    case 71: if (event === 1) fx.untargetable = true; else fx.roll -= 4; break
    case 72: if (h.roll(1, 100) < 96) addRaw(h, c, 25, 1, 0x0c, 0); break
    case 73: { // rake
      const t = h.targetOf(c)
      if (fx.hits[1] === 2 && t && t[F.inPlay]) {
        c[F.attacksLeft + 1] = 2; c[F.dice + 1] = 2; c[F.sides + 1] = 4; c[F.attacksLeft] = 0
        h.setRec(c, 4, 2) // the follow-up attack loop starts at hand 2
        h.print(`${h.name(c)} Rakes...`)
        await h.attack(c, t)
        h.endTurn(c)
      }
      break
    }
    case 74: case 75: { // grab / blood drain
      const v = h.byIndex(eff.power & 0x3f)
      if (event === 15 && v && v[F.inPlay] && c[F.inPlay]) {
        if (type === 74) {
          // crush: one 3d4 attack with hand 1 (FUN_3aae_3a86); the hold ends if the victim goes down
          c[F.attacksLeft] = 1; c[F.dice] = 3; c[F.sides] = 4
          h.setRec(c, 4, 1)
          await h.attack(c, v)
          if (!v[F.inPlay]) { await removeType(h, v, 58); await removeEffect(h, c, eff) }
        }
        else {
          h.print(`${h.name(c)} Sucks some Blood`)
          const d = h.roll(1, 4)
          fx.dmgType = 0
          h.damage(v, d, 0, false)
          eff.duration = Math.max(0, eff.duration - d * 16)
          if (eff.duration >> 4 <= d) await removeEffect(h, c, eff)
        }
        h.endTurn(c)
      } else {
        if (v) await removeType(h, v, 58)
        await removeEffect(h, c, eff)
      }
      break
    }
    case 76: { const t = h.targetOf(c); if (t && t[F.inPlay]) { addRaw(h, c, 75, 0xcf, h.indexOf(t), 1); addRaw(h, t, 58, 0, 0, 0); h.setRec(t, 6, 0) } break }
    case 77: { const t = h.targetOf(c); if (t && t[F.inPlay] && t[F.stat[0]] < 19) { addRaw(h, c, 74, 0, h.indexOf(t), 1); addRaw(h, t, 58, 0, 0, 0); h.print(`${h.name(t)} is held fast`) } break }
    case 78: if (removal && !h.revive(c, c[F.hp])) addRaw(h, c, 78, 1, eff.power, 1); break
    case 79: { const t = h.targetOf(c); if (t && t[F.inPlay]) { fx.dmgType = 9; h.damage(t, h.roll(2, 10), 0, false) } break }
    case 80: { const t = h.targetOf(c); if (t && t[F.inPlay]) { fx.dmgType = 0x10; h.damage(t, h.roll(1, 4), 0, false) } break }
    case 81: { // fear aura
      for (const e of h.enemiesNear(c, 255)) {
        if (!e[F.inPlay] || h.save(e, 4, 0)) continue
        if (e[F.hitDice] <= 3) { h.print(`${h.name(e)} is paralyzed with fear`); addRaw(h, e, 52, 0, 0x0c, 0) }
        else if (e[F.hitDice] <= 5) { h.print(`${h.name(e)} is weakened by fear`); addRaw(h, e, 2, 0, 0x0c, 0) }
      }
      break
    }
    case 82: { // paralysing aura
      for (const o of h.all()) for (const e of h.effectsOf(o).filter((x) => x.type === 82 && o !== c)) h.effectsOf(o).splice(h.effectsOf(o).indexOf(e), 1)
      for (const e of h.enemiesNear(c, 255)) {
        if (!e[F.inPlay]) continue
        const bonus = 1 + (e[F.race] === 7 ? 2 : 0)
        if (!h.save(e, 0, bonus)) { h.print(`${h.name(e)} is Paralyzed`); addRaw(h, e, 52, h.roll(1, 4), 0x0c, 0) }
      }
      break
    }
    case 83: { // petrifying gaze
      const t = h.targetOf(c)
      if (!t || !t[F.inPlay]) break
      h.print(`${h.name(c)} gazes...`)
      h.fly?.(c, t, 'gaze')
      let victim = t
      if (has(h, c, 127) && h.itemsOf(t).some((it) => it.ready && it.raw[0x31] === 0x76)) { h.print(`${h.name(t)} reflects it!`); h.fly?.(t, c, 'gaze'); victim = c }
      if (!h.save(victim, 1, 0)) h.setStatus(victim, 7, `${h.name(victim)} is Stoned`)
      break
    }
    case 84: { // charm gaze
      const t = h.targetOf(c)
      if (!t || !t[F.inPlay]) break
      h.print(`${h.name(c)} Gazes...`)
      h.fly?.(c, t, 'gaze')
      fx.spell = 10
      if (!h.save(t, 4, -2)) await addEffect(h, t, 11, 0, (c[F.side] << 7) | 0x0c, 1, 1, false, true)
      fx.spell = 0
      break
    }
    case 85: case 86: { const t = h.targetOf(c); if (t && t[F.inPlay]) drain(h, t, type - 84); break }
    case 87: {
      const t = h.targetOf(c)
      if (t && !has(h, t, 50)) { addRaw(h, t, 50, 14400, 0, 1); addRaw(h, t, 57, 43200, (h.roll(1, 6) << 4) + 0x0f, 1); h.print(`${h.name(t)} is Diseased`) }
      break
    }
    case 88: await breathBolt(h, eff, c, { b: 'breathBolt', pct: 50, spell: 51, len: 10, save: 3 }); break // FUN_4e53_30d9 (image 0x41609)
    case 89: // displacement
      if (event === 8) eff.power &= ~0x10
      else if (event === 16 && !(eff.power & 0x10)) { fx.roll = -1; eff.power |= 0x10 }
      break
    case 90: if (fx.saveType === 0) fx.save += conSave(c[F.stat[4]]); break
    case 91: if (fx.spell === 15) { fx.dmg = 0; h.print(`${h.name(c)} is unaffected`) } else if (fx.dmgType & 4) fx.dmg = 0; break
    case 93: if (fx.dmgType & 1) fx.dmg = Math.floor(fx.dmg / 2); break
    case 94: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (w && [0x80, 1].includes(h.weaponKind(w.raw[0x2e]))) fx.dmg = Math.floor(fx.dmg / 2); break }
    case 95: if (removal && c[F.inPlay]) h.setStatus(c, 6, `${h.name(c)} Falls dead`); break
    case 96: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (!w || (w.raw[0x32] <= 0 && w.raw[0x31] !== 0xb1)) fx.dmg = 0; break }
    case 97: if (fx.saveType === 2 || fx.saveType === 4) fx.save += conSave(c[F.stat[4]]); break
    case 98: c[F.hp] = Math.min(c[F.maxHp], c[F.hp] + 3); break
    case 99: {
      const n = c[F.status] === 5 ? 6 - h.rec(c, 0xe) : c[F.status] === 4 ? 6 : 0
      if (n > 0 && h.revive(c, n)) { addRaw(h, c, 95, h.roll(1, 4) + 1, 0, 1); await removeEffect(h, c, eff) }
      break
    }
    case 100: if (!(fx.dmgType & 0x11)) addRaw(h, c, 102, h.roll(3, 6), 0, 1); break
    case 101: if (!has(h, c, 98) && !has(h, c, 59)) addRaw(h, c, 59, 3, 0, 1); break
    case 102: if (removal && !h.revive(c, c[F.maxHp])) addRaw(h, c, 102, 1, 0, 1); break
    case 103: eff.flag = 0; h.print(`${h.name(c)} Turns gaseous and escapes`); c[F.status] = 3; c[F.inPlay] = 0; break
    case 104: deflect(h, c, 60); break
    case 105: case 106: { // magic resistance 50 % / 15 %
      const a = h.current()
      const lvl = a ? Math.max(a[F.levels], a[F.levels + 5], 1) : 1
      const pct = (type === 105 ? 50 : 15) - 5 * (11 - lvl)
      if ((fx.adding !== 0 || fx.dmgType & 8) && h.roll(1, 100) <= pct) negate(0)
      break
    }
    case 107: if (h.roll(1, 100) <= 90) { negate(53); negate(11) } break
    case 108: negate(11); negate(53); break
    case 109: negate(52); break
    case 110: if (fx.dmgType & 2) negate(fx.adding); break
    case 111: if (event === 9) { negate(55); negate(52) } else if (fx.saveType === 0) fx.save = 100; break
    case 112: if (fx.dmgType & 1) { if (event === 6) fx.dmg = 0; else negate(fx.adding) } break
    case 113: if (fx.dmgType & 1) fx.dmg = Math.max(fx.dice, fx.dmg - fx.dice); break
    case 114: if (fx.dmgType & 4) fx.dmg = Math.floor(fx.dmg / 2); break
    case 115: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (!w || [0, 1].includes(h.weaponKind(w.raw[0x2e]))) fx.dmg = Math.floor(fx.dmg / 2); break }
    case 116: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (w && (w.raw[0x32] << 24 >> 24) > 0) fx.dmg = Math.floor(fx.dmg / 2); break }
    case 117: { const a = h.current(); if (a && h.itemsOf(a).some((it) => it.ready && it.raw[0x2e] === 0x55)) fx.dmg = h.roll(1, 6) + 1; break }
    case 118: if (fx.dmgType & 2) fx.dmg = Math.floor(fx.dmg / 2); break
    case 119: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if ((!w || w.raw[0x32] === 0) && a && (a[F.race] > 0 || a[F.hitDice] < 4)) fx.dmg = 0; break }
    case 120: { const a = h.current(); if (a && h.itemsOf(a).some((it) => it.ready && (it.raw[0x2e] === 0x57 || it.raw[0x2e] === 0x58))) deflect(h, c, 50); break }
    case 121: {
      const t = h.targetOf(c)
      if (t && t[F.inPlay] && h.roll(1, 100) <= 25 && h.distance(c, t) < 4) {
        h.endTurn(c)
        h.print(`${h.name(c)} Spits Acid`)
        h.fly?.(c, t, 'spit')
        fx.dmgType = 0x10
        h.damage(t, h.roll(8, 4), 2, h.save(t, 3, 0))
        await removeEffect(h, c, eff)
        await removeType(h, c, 80)
      }
      break
    }
    case 122: { const a = h.current(); if (a && h.itemsOf(a).some((it) => it.ready && it.raw[0x2e] === 0x56)) fx.dmg = h.roll(3, 8); if (fx.dmgType & 9) fx.dmg += fx.dice; break }
    case 123: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (!w) fx.dmg = 0; else if (w.raw[0x32] === 0) fx.dmg = w.raw[0x31] === 0xb1 ? Math.floor(fx.dmg / 2) : 0; break }
    case 124: if (h.roll(1, 100) <= 30) { negate(11); negate(53) } break
    case 125: if (event === 9) { negate(11); negate(53); negate(52); negate(55) } else if (fx.saveType === 0) fx.save = 100; break
    case 126: { const t = h.targetOf(c); if (t && h.itemsOf(t).some((it) => it.ready && (it.raw[0x31] === 0x76 || (it.raw[0x30] === 0x98 && it.raw[0x31] === 0xfc)))) fx.untargetable = true; break }
  }
}

const conSave = (con: number) => con >= 18 ? 5 : con >= 14 ? 4 : con >= 11 ? 3 : con >= 7 ? 2 : con >= 4 ? 1 : 0

// ---------------------------------------------------------------- Strength effects (12 Enlarge, 38 Strength)
/** STR in an effect's power (FUN_5216_10e4 / 110d): 18/p is p + 1, other STR is STR + 100; bit 7 marks a dormant record. */
export const strEnc = (str: number, pct: number) => (str === 18 ? pct + 1 : str + 100) & 0x7f
export function strDec(v: number): [number, number] {
  v &= 0x7f
  return v <= 101 ? [18, v - 1] : [v - 100, 0]
}
const strKey = ([s, p]: [number, number]) => s * 101 + (s === 18 ? p : 0)

/**
 * FUN_5216_115c: try to set STR to str/pct. Weaker than now: nothing changes, and the power to store is
 * the new STR, dormant (bit 7). Otherwise the active STR record (power < 0x80) turns dormant holding the
 * current STR, the character gets the new STR, and the power to store is the STR to restore later.
 */
export function setStr(h: FxHost, c: Uint8Array, str: number, pct: number): { ok: boolean; pw: number } {
  const cs = c[F.stat[0]], cp = c[F.strPct]
  if (str < cs || (str === 18 && cs === 18 && pct < cp)) return { ok: false, pw: strEnc(str, pct) | 0x80 }
  const prev = h.effectsOf(c).find((e) => (e.type === 12 || e.type === 38) && e.power < 0x80)
  let pw = strEnc(cs, cp)
  if (prev) { pw = prev.power & 0x7f; prev.power = strEnc(cs, cp) | 0x80 }
  c[F.stat[0]] = str
  c[F.strPct] = str === 18 ? pct : 0
  h.recalc(c)
  return { ok: true, pw }
}

/** FUN_3723_04ba, removal of 12/38: an active record restores the STR it holds; the strongest other record then takes over. */
function restoreStr(h: FxHost, c: Uint8Array, eff: Effect) {
  if (eff.power >= 0x80) return
  let [s, p] = strDec(eff.power)
  c[F.stat[0]] = s; c[F.strPct] = p
  const others = h.effectsOf(c).filter((x) => x !== eff && (x.type === 12 || x.type === 38))
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
  h.print(`${h.name(c)} is Cured`)
  await removeEffect(h, c, e)
  return true
}

// ---------------------------------------------------------------- Spiritual Hammer (effect 23)
/**
 * Handler 23 (FUN_3723_07e0): while the effect lasts the character has a Spiritual Hammer +1 (type 20,
 * words 0x14 "Hammer" and 0xF3 "Spiritual", item handler 137); a thrown one comes back at round end
 * (event 19). When the effect goes, so does the hammer.
 */
function spiritualHammer(h: FxHost, c: Uint8Array, removal: boolean) {
  const items = h.itemsOf(c)
  const hammer = items.find((i) => i.type === 20 && i.raw[0x31] === 0xf3)
  if (removal) { if (hammer) items.splice(items.indexOf(hammer), 1) }
  else if (!hammer && items.length < 16) {
    const r = new Uint8Array(ITEM_SIZE)
    r[0x2e] = 20; r[0x30] = 0x14; r[0x31] = 0xf3; r[0x32] = 1; r[0x3d] = 0x17; r[0x3e] = 0x89
    items.push(new Item(r))
    h.print(`${h.name(c)} Gains an item`)
  }
  h.recalc(c)
}

// ---------------------------------------------------------------- item handlers 128–139
/**
 * The handler of an item with item[0x3E] ≥ 0x80, run by Ready (arg 0, after readying) and Unready
 * (arg 1, after unreadying) only (FUN_4894_14d0 → FUN_5216_0000; spec/effects.md, "Item handlers").
 */
export async function itemHandler(h: FxHost, c: Uint8Array, it: Item, arg: 0 | 1) {
  await ITEMS[game().effects.items](h, c, it, arg)
}

/** The item procedures a profile can name (games/effectrules.ts `items`). */
const ITEMS: Record<ItemProcedure, (h: FxHost, c: Uint8Array, it: Item, arg: 0 | 1) => Promise<void>> = {
  handlers: itemHandlers,
  kinds: (h, c, it, arg) => itemKind(h, c, it, arg === 0),
}

/** Item handlers 128–139 by item +0x3E (PoR FUN_5216_0000). */
async function itemHandlers(h: FxHost, c: Uint8Array, it: Item, arg: 0 | 1) {
  const p = it.raw[0x3d]
  switch (it.raw[0x3e]) {
    case 131: { // Gauntlets of Ogre Power (FUN_3723_2f57): STR 18/00 as effect 38
      if (arg === 0) {
        const { ok, pw } = setStr(h, c, 18, 100)
        if (ok) h.print(`${h.name(c)} is stronger`)
        addRaw(h, c, 38, 0, pw, 1)
      } else {
        const is1800 = c[F.stat[0]] === 18 && c[F.strPct] === 100
        // bug kept: with 18/00 the original takes the first 38 record of any kind
        const e = h.effectsOf(c).find((x) => x.type === 38 && (is1800 || strKey(strDec(x.power)) === strKey([18, 100])))
        if (e) await removeEffect(h, c, e)
      }
      break
    }
    case 132: // alignment-locked weapon (FUN_3723_30a5): the wrong alignment cannot hold it and is hurt
      if (arg === 0 && (p & 0x0f) !== c[F.alignment]) {
        it.ready = false
        fx.dmgType = 8
        h.damage(c, p >> 4, 0, false)
      }
      break
    case 135: // Boulder (FUN_3723_3134)
      if (arg === 0 && c[F.stat[0]] < 19) { it.ready = false; h.print('Must have Giant Strength') }
      break
    case 137: // Spiritual Hammer (FUN_3723_317a): putting it away ends the effect, and with it the hammer
      if (arg === 1) await removeFirst(h, c, 23)
      break
    default: // 128–130, 133, 134, 136, 138, 139 (FUN_3723_2eda): the item grants effect item[0x3D] while readied
      if (arg === 0) {
        const e = addRaw(h, c, p, 0, 0x0c, 0)
        await handle(h, p, e, c, -1, false)
      } else {
        const list = h.effectsOf(c)
        const e = list.find((x) => x.type === p)
        if (e) list.splice(list.indexOf(e), 1)
      }
  }
}
