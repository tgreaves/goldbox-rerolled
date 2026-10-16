// Camp, rest, memorisation, scribing and the game clock (spec/camp.md).
import type { Engine } from '../vm/engine'
import type { Item, ItemTables } from '../data/items'
import type { Spell, SpellTables } from '../data/spells'
import type { Effect } from '../data/effects'

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
  if (w[6] >= 256) for (const c of party) { const a = (c[0x30] | (c[0x31] << 8)) + 1; c[0x30] = a & 0xff; c[0x31] = a >> 8 }
}

/** Advance the clock by `count` units (FUN_4b46_03d5), then time out effects by as much. */
export function advanceClock(e: Engine, count: number, unit: number) {
  const w = Array.from({ length: 7 }, (_, i) => e.read(CLOCK + i))
  for (let i = 0; i < count; i++) { w[unit]++; normalise(w, e.party()) }
  w.forEach((v, i) => e.write(CLOCK + i, v))
  timeOutEffects(e, count * unitMinutes(unit))
}

/** Effect durations are minutes; they run down in chunks of at most 10 (FUN_4b46_0000). */
export function timeOutEffects(e: Engine, minutes: number) {
  while (minutes > 0) {
    const chunk = Math.min(minutes, 10)
    minutes -= chunk
    for (const c of e.party()) {
      const fx = e.effectsOf(c)
      for (let i = fx.length - 1; i >= 0; i--) {
        if (fx[i].duration === 0) continue
        if (chunk < fx[i].duration) fx[i].duration -= chunk
        else fx.splice(i, 1) // removal callbacks come with the effect handlers (combat)
      }
    }
  }
}

export function clockText(e: Engine): string {
  const hh = e.read(CLOCK + 3), mm = 10 * e.read(CLOCK + 2) + e.read(CLOCK + 1)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// ------------------------------------------------------------------ spells and slots
export const memorised = (c: Uint8Array) => Array.from({ length: 21 }, (_, k) => c[0x17 + k])
export const knows = (c: Uint8Array, id: number) => c[0x32 + id] !== 0

/** Free slots of a class (0 cleric, 1 MU) and level: char[0xB1 + class·3 + level] − memorised (ready or pending). */
export function freeSlots(c: Uint8Array, cls: number, level: number, st: SpellTables): number {
  if (level < 1 || level > 3) return 0
  let used = 0
  for (const v of memorised(c)) {
    if (!v) continue
    const s = st.get(v)
    if (s && s.cls === cls && s.level === level) used++
  }
  return c[0xb1 + cls * 3 + level] - used
}

/** Memorise: store id + 0x80 in the first empty slot and sort by id (FUN_3f81_0824). */
export function memorise(c: Uint8Array, s: Spell, st: SpellTables): boolean {
  if (freeSlots(c, s.cls, s.level, st) <= 0) return false
  const k = memorised(c).indexOf(0)
  if (k < 0) return false
  c[0x17 + k] = s.id + 0x80
  const sorted = memorised(c).sort((a, b) => (a & 0x7f) - (b & 0x7f))
  sorted.forEach((v, i) => { c[0x17 + i] = v })
  return true
}

/** Clear pending spells (FUN_3f81_0214): pending memorisations, base hours, scribe marks. */
export function clearPending(c: Uint8Array, items: Item[], t: ItemTables) {
  for (let k = 0; k < 21; k++) if (c[0x17 + k] >= 0x80) c[0x17 + k] = 0
  c[0x2c] = 0
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
    const cleric = c[0x96] > 0 && t.baseOf(it)?.slot === 12
    if (fx.some((f) => f.type === 0x10) || cleric) it.hidden = 0
    return it.hidden === 0
  })
}

/** Preparation (FUN_3f81_0000): sets char[0x2C] base hours, returns minutes needed. */
export function preparation(c: Uint8Array, items: Item[], t: ItemTables, st: SpellTables): number {
  const pending: number[] = []
  for (const v of memorised(c)) if (v >= 0x80) pending.push(st.get(v)?.level ?? 1)
  for (const it of items) if (isScroll(it, t)) for (const p of it.props) if (p & 0x80) pending.push(st.get(p)?.level ?? 1)
  if (!pending.length) { c[0x2c] = 0; return 0 }
  c[0x2c] = pending.some((l) => l >= 3) ? 6 : 4
  return 60 * c[0x2c] + 15 * pending.reduce((a, b) => a + b, 0)
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
  const name = String.fromCharCode(...c.subarray(1, 1 + c[0]))
  for (const it of items) {
    if (!isScroll(it, t)) continue
    for (let j = 0; j < 3; j++) {
      const p = it.raw[0x3c + j]
      if (p <= 0x80) continue
      const id = p & 0x7f
      c[0x32 + id] = 1
      // remove the spell (FUN_4e53_328a): the last byte holding it, and one "With n Spells" word
      for (let k = 2; k >= 0; k--) if ((it.raw[0x3c + k] & 0x7f) === id) { it.raw[0x3c + k] = 0; break }
      it.raw[0x30]--
      if (it.raw[0x30] < 210) items.splice(items.indexOf(it), 1)
      return `${name} has scribed ${st.get(id)?.name ?? id}`
    }
  }
  for (let k = 0; k < 21; k++) {
    if (c[0x17 + k] >= 0x80) {
      c[0x17 + k] &= 0x7f
      return `${name} has memorized ${st.get(c[0x17 + k])?.name ?? c[0x17 + k]}`
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
export function restStep(e: Engine, r: RestState, camp: { heal: number }): { messages: string[]; interrupted: boolean } {
  const t = e.items!, st = e.spells!
  const messages: string[] = []
  r.minutes = Math.max(0, r.minutes - 5)
  advanceClock(e, 5, MINUTE)
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
    if (r.countdown[n] === 0 && c[0x2c] === 0) {
      const m = finishOne(c, items, t, st)
      if (m) messages.push(m)
      r.countdown[n] = 3 * nextPendingLevel(c, items, t, st)
    }
  })
  // base hours
  if (++r.hourTick >= 12) {
    r.hourTick = 0
    e.party().forEach((c, n) => {
      if (c[0x2c] > 0 && --c[0x2c] === 0) r.countdown[n] = 3 * nextPendingLevel(c, e.itemsOf(c), t, st)
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

/** Heal (FUN_5216_175d): statuses Okay, Animated, Unconscious, Dying; mummy rot blocks unless forced. */
export function heal(c: Uint8Array, fx: Effect[], amount: number, force: boolean, inCombat = false): boolean {
  if (![0, 1, 4, 5].includes(c[0x10c])) return false
  if (!force && fx.some((f) => f.type === 0x32)) return false
  c[0x11b] = Math.min(c[0x32], c[0x11b] + amount)
  if (c[0x10c] === 5) c[0x10c] = 4
  if (c[0x10c] === 4 && !inCombat && c[0x11b] > 0) c[0x10c] = 0
  return true
}
