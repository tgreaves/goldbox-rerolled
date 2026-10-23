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
import { msg } from '../games/strings'
import { text } from '../data/gametext'
import { parseCharacter } from '../data/character'
import { spellOn } from './magic'
import { diseases } from './abilities'

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
    if (fx.some((f) => f.type === game().effects.ids.readMagic) || cleric) it.hidden = 0
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
      return `${name} ${msg('hasScribed')} ${st.get(id)?.name ?? id}`
    }
  }
  for (let k = 0; k < F.memorisedCount; k++) {
    if (c[F.memorised + k] >= 0x80) {
      c[F.memorised + k] &= 0x7f
      return `${name} ${msg('hasMemorized')} ${st.get(c[F.memorised + k])?.name ?? c[F.memorised + k]}`
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
    messages.push(msg('partyHealed'))
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
    e.session.restSteps++
    if (e.session.restSteps >= every) {
      e.session.restSteps = 0
      if (e.roll(1, 100) <= e.read(0x6dd3)) return { messages: [...messages, msg('interrupted')], interrupted: true }
    }
  }
  return { messages, interrupted: false }
}

/**
 * SotSB's condition pass of Fix (0x387CE, spec/A-games/sotsb/camp.md §3; R.fix.conditions): after the rest,
 * before the hit points are shared, each member in party order takes each entry while its count lasts.
 * Effects go through their removal as the original's 145:2A does (I: its callbacks). After the hit points are
 * shared it runs again after a second rest (R.fix.second, `secondRest`).
 */
async function fixConditions(e: Engine, conds: number[]): Promise<string[]> {
  const out: string[] = [], host = new WorldHost(e, (m) => out.push(m))
  const has = (c: Uint8Array, t: number) => e.effectsOf(c).some((x) => x.type === t)
  const drop = async (c: Uint8Array, t: number) => { const x = e.effectsOf(c).find((f) => f.type === t); if (x) { await removeEffect(host, c, x); return true } return false }
  const name = (c: Uint8Array) => parseCharacter(c).name
  for (const c of e.party()) {
    let marked = false
    for (const [i, k] of R.fix.conditions.entries()) {
      if (conds[i] <= 0 || (k.unlessMarked && marked)) continue
      if (k.needs !== null && !has(c, k.needs)) continue
      if (k.status !== null && c[F.status] !== k.status) continue
      if (k.notRaces?.includes(c[F.race])) continue
      const who = k.on === 'selected' ? e.cur : c
      let removed = false
      for (const t of k.removes) removed = (await drop(who, t)) || removed
      if (k.diseases) for (const t of diseases(e)) removed = (await drop(who, t)) || removed
      if (k.cure === 'cureDisease' && !removed) continue
      if (k.cure === 'stoneToFlesh') { c[F.status] = 0; c[F.inPlay] = 1; c[F.hp] = 1 } // 0x388E1
      else if (k.cure === 'neutralizePoison') { if (c[F.hp] === 0) c[F.hp] = 1; c[F.inPlay] = 1; c[F.status] = 0 } // 0x3894A
      else if (k.cure === 'raiseDead') { c[F.hp] = 1; c[F.status] = 0; c[F.inPlay] = 1; raiseDeadHp(c, k.fighters ?? [2], false) } // 0x38A30
      else if (k.cure === 'removeCurse') out.push(...(await spellOn(e, c, k.spells[0]))) // 0x38BB9: the spell's handler on the member
      if (k.marks) marked = true
      out.push(`${name(who)} ${text(k.msg)}`)
      if (k.used) conds[i]--
    }
  }
  return out
}

/**
 * Raise Dead's loss (the temple's, PoR FUN_2d14_0510 to 0x1D84B, CotAB to 0x1CEF6; SotSB's Fix 0x38A4B): CON −1 (and the base CON with
 * `setBase`), then with CON 14 or more the maximum HP above the rolled HP, divided by the CON bonus's
 * units (`fighters`' levels × (CON − 14), the others' levels, twice above CON 15), is lost; with CON 17 or
 * more only by a fighter (a byte subtraction). I (SotSB): a non-fighter whose fighter level is above the
 * dual-class level byte would lose it too; the port leaves that out.
 */
export function raiseDeadHp(c: Uint8Array, fighters: number[], setBase: boolean) {
  if (c[F.stat[4]] > 0) { c[F.stat[4]]--; if (setBase) c[F.baseStat[4]] = c[F.stat[4]] }
  const con = c[F.stat[4]]
  if (con < 14) return
  const b = Math.max(0, c[F.maxHp] - c[F.hpRolled])
  let t = 0
  for (let k = 0; k < F.classCount; k++) {
    const L = c[F.levels + k]
    if (L <= 0) continue
    t += fighters.includes(k) ? L * (con - 14) : con > 15 ? 2 * L : L
  }
  const loss = t > 0 ? Math.floor(b / t) : b
  if (con < 17 || c[F.levels + 2] > 0) c[F.maxHp] = (c[F.maxHp] - loss) & 0xff
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

// ------------------------------------------------------------------ fix
/** the party's wounds (CotAB 0x31E2F): Σ max HP − HP over every member, as a 16-bit word */
export function wounds(e: Engine): number {
  let w = 0
  for (const c of e.party()) w = (w + ((c[F.maxHp] - c[F.hp]) & 0xffff)) & 0xffff
  return w
}

/**
 * Fix (CotAB 0x320D8; spec/A-games/coab/camp.md §1), the cures as `R.fix` gives them. Nothing when the
 * party has no wounds. Otherwise the healing pool is rolled for every cure memorised by an Okay member
 * (0x31CC2: the spells stay memorised); the rest the cleric slots need to be learnt again is worked
 * out (0x31E8D) and rested at once, silently, through the ordinary rest steps (encounters, natural
 * healing, effects and pending spells as in any rest; 0x41B8F with no prompt); if it is not
 * interrupted, one cure per cleric slot of each cure's level is rolled into the pool (0x31D7D), and
 * the pool is shared out in party order, each member healed by what they lack, as far as it goes
 * (0x32020). Prints nothing of its own. Returns the rest's messages and whether it was interrupted.
 */
export async function fix(e: Engine, camp: { heal: number }): Promise<{ messages: string[]; interrupted: boolean }> {
  const { cures, start } = R.fix
  const messages: string[] = []
  if (wounds(e) === 0) return { messages, interrupted: false }
  const okay = (c: Uint8Array) => c[F.status] === 0 // 0x31CA2
  const cureRoll = (k: (typeof cures)[number]) => e.roll(k.dice, k.sides) + k.bonus
  // 0x31CC2: the memorised cures, member by member, slot by slot
  let pool = 0
  const conds = R.fix.conditions.map(() => 0)
  for (const c of e.party()) {
    if (!okay(c)) continue
    for (const v of memorised(c)) {
      const k = cures.find((x) => x.spell === v); if (k) pool = (pool + cureRoll(k)) & 0xffff
      const j = R.fix.conditions.findIndex((x) => x.spells.includes(v)); if (j >= 0) conds[j]++ // SotSB 0x3802C
    }
  }
  // 0x31E8D: the slots to learn again, the longest member's rest, and the estimate it is shortened by.
  // The per-level minutes are kept from the last Okay member: a member who is not Okay counts them again
  let estimate = start, time = 0
  const count = cures.map(() => 0), last = cures.map(() => 0)
  for (const c of e.party()) {
    const wise = R.fix.slotsAboveWis === undefined || c[F.stat[2]] > R.fix.slotsAboveWis // SotSB 0x3831C
    if (okay(c) && wise) cures.forEach((k, i) => { const n = c[(k.pool === 'druid' ? F.druidSlots : F.clericSlots) + k.level - 1]; count[i] += n; last[i] = (n * k.minutes) & 0xffff })
    let t = 0
    const groups = new Map<number, number>()
    cures.forEach((k, i) => { if (last[i] > 0) { t = Math.max(t, k.base); groups.set(k.group, Math.max(groups.get(k.group) ?? 0, k.weight)) } })
    for (const g of groups.values()) estimate = (estimate + g) & 0xffff
    t = (t + last.reduce((a, b) => a + b, 0)) & 0xffff
    time = Math.max(time, t)
  }
  const w = wounds(e)
  if (w < estimate) {
    // 0x31FD3: the quotient is kept as a byte; the original divides by zero when it is a multiple of 256 (Bug: the port skips the division)
    const k = Math.floor(estimate / w) & 0xff
    if (k) time = Math.floor(time / k)
  }
  // 0x41B8F with no prompt: rest that long
  const r = startRest(e, time)
  while (r.minutes > 0) {
    const res = await restStep(e, r, camp)
    messages.push(...res.messages)
    if (res.interrupted) return { messages, interrupted: true }
  }
  // 0x31D7D: one cure per cleric slot of its level, all of the first cure, then the next
  cures.forEach((k, i) => { for (let n = 0; n < count[i]; n++) pool = (pool + cureRoll(k)) & 0xffff })
  if (conds.some((n) => n > 0)) messages.push(...(await fixConditions(e, conds)))
  // 0x32020: shared out in party order; the amount reaches the heal routine as a byte (0x32096)
  for (const c of e.party()) {
    let need = (c[F.maxHp] - c[F.hp]) & 0xffff
    if (need > pool) need = pool
    if (need >= 1 && heal(c, e.effectsOf(c), need & 0xff, false) && need <= pool) pool -= need
  }
  // SotSB 0x38F17: the second rest for those still in need, then the conditions again with the counts left
  const t2 = secondRest(e)
  if (t2 !== null) {
    const r2 = startRest(e, t2)
    while (r2.minutes > 0) {
      const res = await restStep(e, r2, camp)
      messages.push(...res.messages)
      if (res.interrupted) return { messages, interrupted: true }
    }
    if (conds.some((n) => n > 0)) messages.push(...(await fixConditions(e, conds)))
  }
  return { messages, interrupted: false }
}

/** SotSB 0x38D11 and 0x384BC (R.fix.second): the second rest's minutes; null without a second pass. */
export function secondRest(e: Engine): number | null {
  const tests = R.fix.second
  if (!tests) return null
  const need = tests.map(() => 0), have = tests.map(() => 0)
  const has = (c: Uint8Array, t: number) => e.effectsOf(c).some((x) => x.type === t)
  for (const c of e.party()) {
    for (let i = 0; i < tests.length; i++) {
      const k = tests[i]
      const hit = k.status !== undefined ? c[F.status] === k.status && !k.notRaces?.includes(c[F.race]) : has(c, k.effect!)
      if (hit) { need[i]++; i += k.skip ?? 0 }
    }
    if (c[F.status] !== 0) continue // 0x38009: the slots of Okay members
    tests.forEach((k, i) => { for (const [pool, lv] of k.slots) have[i] += c[(pool === 'mu' ? F.muSlots : F.clericSlots) + lv - 1] })
  }
  return tests.reduce((t, k, i) => (t + Math.min(have[i], need[i]) * k.minutes) & 0xffff, 0)
}
