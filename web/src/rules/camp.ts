// Camp, rest, memorisation, scribing and the game clock (spec/A-games/engine/camp-and-time.md).
import { R, slots } from '../games/rules'
import type { Engine } from '../vm/engine'
import type { Item, ItemTables } from '../data/items'
import type { Spell, SpellTables } from '../data/spells'
import type { Effect } from '../data/effects'
import { removeEffect, type FxHost } from './effects'
import { WorldHost } from './worldfx'
import { F } from '../games/fields'
import { game } from '../games/profile'

// ------------------------------------------------------------------ clock
/** Clock words in ECL array A: segment, minute, ten-minutes, hour, day, month, year. */
export const CLOCK = 0x49c6
const LIMITS = [10, 10, 6, 24, 30, 12, 256]
export const MINUTE = 1, HOUR = 3

/** Minutes in one unit (for effect time-out). */
const unitMinutes = (unit: number) => [0, 1, 10, 60, 1440, 43200, 518400][unit] ?? 1

/** Normalise (FUN_4b46_02f2): one carry per unit, in order; past 256 years everyone ages (original). */
function normalise(w: number[], party: Uint8Array[]) {
  for (let u = 0; u < 6; u++) {
    if (w[u] >= LIMITS[u]) { w[u] -= LIMITS[u]; w[u + 1]++ }
  }
  if (w[6] >= 256) for (const c of party) { const a = (c[F.age] | (c[F.age + 1] << 8)) + 1; c[F.age] = a & 0xff; c[F.age + 1] = a >> 8 }
}

/** Advance the clock by `count` units (FUN_4b46_03d5), then time out effects by as much. */
export async function advanceClock(e: Engine, count: number, unit: number, host?: FxHost, who?: Uint8Array[]) {
  const w = Array.from({ length: 7 }, (_, i) => e.read(CLOCK + i))
  for (let i = 0; i < count; i++) { w[unit]++; normalise(w, e.party()) }
  w.forEach((v, i) => e.write(CLOCK + i, v))
  await timeOutEffects(e, count * unitMinutes(unit), host, who)
}

/**
 * Effect time-out (FUN_4b46_0000): chunks of up to 10 minutes; an effect whose remaining time a chunk
 * reaches is removed through FUN_5216_0026, which runs its removal callback. In combat `who` is every
 * combatant (the monsters are linked into the party list then) and `host` the battle.
 */
export async function timeOutEffects(e: Engine, minutes: number, host: FxHost = new WorldHost(e), who: Uint8Array[] = e.party()) {
  while (minutes > 0) {
    const chunk = Math.min(minutes, 10)
    minutes -= chunk
    for (const c of who) {
      const list = e.effectsOf(c)
      for (const eff of [...list].reverse()) {
        if (eff.duration === 0 || !list.includes(eff)) continue
        if (chunk < eff.duration) eff.duration -= chunk
        else await removeEffect(host, c, eff)
      }
    }
  }
}

export function clockText(e: Engine): string {
  const hh = e.read(CLOCK + 3), mm = 10 * e.read(CLOCK + 2) + e.read(CLOCK + 1)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// ------------------------------------------------------------------ spells and slots
export const memorised = (c: Uint8Array) => Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k])
export const knows = (c: Uint8Array, id: number) => c[F.known + id] !== 0

/** Free slots of a spell class and level: the class's slots at that level − memorised (ready or pending). */
export function freeSlots(c: Uint8Array, cls: number, level: number, st: SpellTables): number {
  if (level < 1 || level > R.spells.levels) return 0
  let used = 0
  for (const v of memorised(c)) {
    if (!v) continue
    const s = st.get(v)
    if (s && s.cls === cls && s.level === level) used++
  }
  return slots(c, cls, level) - used
}

/** Memorise: store id + 0x80 in the first empty slot and sort by id (FUN_3f81_0824). */
export function memorise(c: Uint8Array, s: Spell, st: SpellTables): boolean {
  if (freeSlots(c, s.cls, s.level, st) <= 0) return false
  const k = memorised(c).indexOf(0)
  if (k < 0) return false
  c[F.memorised + k] = s.id + 0x80
  const sorted = memorised(c).sort((a, b) => (a & 0x7f) - (b & 0x7f))
  sorted.forEach((v, i) => { c[F.memorised + i] = v })
  return true
}

/** Clear pending spells (FUN_3f81_0214): pending memorisations, base hours, scribe marks. */
export function clearPending(c: Uint8Array, items: Item[], t: ItemTables) {
  for (let k = 0; k < F.memorisedCount; k++) if (c[F.memorised + k] >= 0x80) c[F.memorised + k] = 0
  c[F.studyHours] = 0
  for (const it of items) if (isScroll(it, t)) for (let j = 0; j < 3; j++) it.raw[0x3c + j] &= 0x7f
}

export function isScroll(it: Item, t: ItemTables) {
  const slot = t.baseOf(it)?.slot ?? 0
  return slot >= 11 && slot <= 13
}

/** Spells listed from readable scrolls (FUN_4e53_044e): identified, or made readable now. */
export function readableScrolls(c: Uint8Array, items: Item[], fx: Effect[], t: ItemTables): Item[] {
  return items.filter((it) => {
    if (!isScroll(it, t)) return false
    const cleric = c[F.levels] > 0 && t.baseOf(it)?.slot === 12
    if (fx.some((f) => f.type === 0x10) || cleric) it.hidden = 0
    return it.hidden === 0
  })
}

/** Preparation (FUN_3f81_0000): sets char[0x2C] base hours, returns minutes needed. */
export function preparation(c: Uint8Array, items: Item[], t: ItemTables, st: SpellTables): number {
  const pending: number[] = []
  for (const v of memorised(c)) if (v >= 0x80) pending.push(st.get(v)?.level ?? 1)
  for (const it of items) if (isScroll(it, t)) for (const p of it.props) if (p & 0x80) pending.push(st.get(p)?.level ?? 1)
  if (!pending.length) { c[F.studyHours] = 0; return 0 }
  c[F.studyHours] = pending.some((l) => l >= 3) ? 6 : 4
  return 60 * c[F.studyHours] + 15 * pending.reduce((a, b) => a + b, 0)
}

// ------------------------------------------------------------------ rest
export interface RestState {
  /** remaining rest in minutes */
  minutes: number
  /** per party member learning countdown (5-minute steps) */
  countdown: number[]
  hourTick: number
}

/** The level of the next spell to finish: scribes first, then memorisations. */
function nextPendingLevel(c: Uint8Array, items: Item[], t: ItemTables, st: SpellTables): number {
  for (const it of items) if (isScroll(it, t)) for (const p of it.props) if (p > 0x80) return st.get(p)?.level ?? 1
  for (const v of memorised(c)) if (v >= 0x80) return st.get(v)?.level ?? 1
  return 0
}

/** Finish one spell (scribe before memorise); returns the message, or ''. */
function finishOne(c: Uint8Array, items: Item[], t: ItemTables, st: SpellTables): string {
  const name = String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
  for (const it of items) {
    if (!isScroll(it, t)) continue
    for (let j = 0; j < 3; j++) {
      const p = it.raw[0x3c + j]
      if (p <= 0x80) continue
      const id = p & 0x7f
      c[F.known + id] = 1
      // remove the spell (FUN_4e53_328a): the last byte holding it, and one "With n Spells" word
      for (let k = 2; k >= 0; k--) if ((it.raw[0x3c + k] & 0x7f) === id) { it.raw[0x3c + k] = 0; break }
      it.raw[0x30]--
      if (it.raw[0x30] < 210) items.splice(items.indexOf(it), 1)
      return `${name} has scribed ${st.get(id)?.name ?? id}`
    }
  }
  for (let k = 0; k < F.memorisedCount; k++) {
    if (c[F.memorised + k] >= 0x80) {
      c[F.memorised + k] &= 0x7f
      return `${name} has memorized ${st.get(c[F.memorised + k])?.name ?? c[F.memorised + k]}`
    }
  }
  return ''
}

export function startRest(e: Engine, minutes: number): RestState {
  return { minutes, countdown: e.party().map(() => 0), hourTick: 0 }
}

/**
 * One 5-minute rest step (FUN_4b46_0c9a). Returns messages and whether the rest was interrupted
 * by an encounter. `heal` is the camp's healing step counter (DS:6DD8), kept across rests.
 */
export async function restStep(e: Engine, r: RestState, camp: { heal: number }): Promise<{ messages: string[]; interrupted: boolean }> {
  const t = e.items!, st = e.spells!
  const messages: string[] = []
  r.minutes = Math.max(0, r.minutes - 5)
  await advanceClock(e, 5, MINUTE, new WorldHost(e, (t) => messages.push(t)))
  // healing: 1 HP every 24 hours of rest
  if (++camp.heal >= 288) {
    camp.heal = 0
    for (const c of e.party()) heal(c, e.effectsOf(c), 1, false)
    messages.push('The Whole Party Is Healed')
  }
  // learning countdowns
  e.party().forEach((c, n) => {
    const items = e.itemsOf(c)
    r.countdown[n] = (r.countdown[n] - 1) & 0xff
    if (r.countdown[n] === 0 && c[F.studyHours] === 0) {
      const m = finishOne(c, items, t, st)
      if (m) messages.push(m)
      r.countdown[n] = 3 * nextPendingLevel(c, items, t, st)
    }
  })
  // base hours
  if (++r.hourTick >= 12) {
    r.hourTick = 0
    e.party().forEach((c, n) => {
      if (c[F.studyHours] > 0 && --c[F.studyHours] === 0) r.countdown[n] = 3 * nextPendingLevel(c, e.itemsOf(c), t, st)
    })
  }
  // encounter check
  const every = e.read(0x6dd2)
  if (every > 0) {
    e.restSteps++
    if (e.restSteps >= every) {
      e.restSteps = 0
      if (e.roll(1, 100) <= e.read(0x6dd3)) return { messages: [...messages, 'The Party is rudely interrupted!'], interrupted: true }
    }
  }
  return { messages, interrupted: false }
}

/**
 * Heal (FUN_5216_175d, CotAB 0x4CE85): statuses Okay, Animated, Unconscious, Dying; the game's blocking
 * effects (`effects.healBlock`: PoR's mummy rot) stop it unless forced. Then, for someone out of play
 * (char in-play byte 0): Dying becomes Unconscious, and outside combat an Unconscious character is
 * revived by effect 0x4E's removal (FUN_3723_19d9 → FUN_5216_1869, CotAB 0x4CFAD): Okay and back in
 * play with the HP it has now. `revive` does that last step (a host prints "gets back up").
 */
export function heal(c: Uint8Array, fx: Effect[], amount: number, force: boolean, inCombat = false, revive?: (c: Uint8Array) => void): boolean {
  if (![0, 1, 4, 5].includes(c[F.status])) return false
  const block = game().effects.healBlock
  if (!force && fx.some((f) => block.includes(f.type))) return false
  c[F.hp] = Math.min(c[F.maxHp], (c[F.hp] + amount) & 0xff) // the sum stored as a byte, then capped (0x4392F, 0x4CEDD)
  if (c[F.inPlay] === 0) {
    if (c[F.status] === 5) c[F.status] = 4
    if (c[F.status] === 4 && !inCombat) {
      if (revive) revive(c)
      else { c[F.status] = 0; c[F.inPlay] = 1 }
    }
  }
  return true
}
