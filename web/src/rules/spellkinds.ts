// Spell handler kinds that work the same in and out of combat (spec/spells.md, "Per spell"): the
// handlers reach the world through the effect host, so the battle and the camp share them. Each game's
// profile names a kind and its parameters for every spell id (games/spellrules.ts); the battle adds
// the kinds that need the battlefield (rules/combat.ts), the camp its own heal and Apply (rules/magic.ts).
import type { Engine } from '../vm/engine'
import type { Spell } from '../data/spells'
import type { Amount, SpellSpec, Term } from '../games/spellrules'
import { game } from '../games/profile'
import { Tables } from './chargen'
import { derive, levelLimit, xpFor } from './training'
import { addEffect, addRaw, fx, removeEffect, removeFirst, removeOne, setStr, type FxHost } from './effects'
import { F } from '../games/fields'

const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0
const setU32 = (c: Uint8Array, o: number, v: number) => { c[o] = v & 0xff; c[o + 1] = (v >> 8) & 0xff; c[o + 2] = (v >> 16) & 0xff; c[o + 3] = (v >>> 24) & 0xff }

/** "<name> msg", or "<name>'s ..." when the message starts with an apostrophe. */
export const line = (name: string, msg: string) => (msg.startsWith("'") ? `${name}${msg}` : `${name} ${msg}`)

/** FUN_10ba_16ec: the line and the pause, no sparkle. */
const say = (h: FxHost, c: Uint8Array, msg: string) => h.print(line(h.name(c), msg))
/** FUN_10ba_1feb with "good": the line, with the sparkle in combat. */
const good = (h: FxHost, c: Uint8Array, msg: string) => { if (h.announce) h.announce(c, msg); else say(h, c, msg) }

/** The handler the active game gives spell id (an unlisted id adds the spell's effect, as Apply does). */
export function spellSpec(id: number): SpellSpec {
  return game().spells.handlers[id] ?? { k: 'apply' }
}

/** A term's value at caster level L. */
export function term(t: Term, L: number, roll: (n: number, d: number) => number): number {
  if (typeof t === 'number') return t
  if (t === 'L') return L
  if (t === 'L/2') return L >> 1
  if (t === '(L+1)/2') return (L + 1) >> 1
  return roll(t.roll[0], t.roll[1]) * (t.mul ?? 1) + (t.add ?? 0)
}

/** n d d + plus at caster level L, and the dice count (FUN_5216_0e2e keeps it in DS:681C). */
export function amount(a: Amount, L: number, roll: (n: number, d: number) => number): { n: number; total: number } {
  const n = term(a.n, L, roll)
  const dice = roll(n, a.d)
  const plus = a.plus === undefined ? 0 : a.plus === 'n' ? n : term(a.plus, L, roll)
  return { n, total: dice + plus }
}

/** One cast: the host, the caster, the spell at level L with its duration, and its targets. */
export interface Cast { h: FxHost; e: Engine; caster: Uint8Array; s: Spell; L: number; dur: number; targets: Uint8Array[] }
export type SpellKind = (x: Cast, p: SpellSpec) => Promise<void>

const num = (p: SpellSpec, k: string, dflt = 0) => (p[k] as number | undefined) ?? dflt
const msgOf = (p: SpellSpec) => p.msg ?? ''

/** FUN_4e53_228a, Cure Disease: each removal says "is Cured"; true if anything went. */
export async function cureDisease(h: FxHost, t: Uint8Array): Promise<boolean> {
  let any = false
  fx.noRearm = true
  if (await removeOne(h, t, 0x22)) any = true
  if (await removeOne(h, t, 0x2b)) { any = true; await removeFirst(h, t, 0x2c); await removeFirst(h, t, 0x1f) }
  if (await removeOne(h, t, 0x32)) { any = true; await removeFirst(h, t, 0x39) }
  fx.noRearm = false
  return any
}

/** Dispel chance for an effect of level lv against caster level L (FUN_4e53_2385). */
const dispelChance = (L: number, lv: number) => (L > lv ? 50 + 5 * (L - lv) : L < lv ? 50 - 2 * (lv - L) : 50)

/** STR set to str/pct as an effect (Enlarge, Strength, Giant Strength): the line when it rose. */
function strengthEffect(h: FxHost, t: Uint8Array, str: number, pct: number, effect: number, dur: number, msg: string) {
  const { ok, pw } = setStr(h, t, str, pct)
  if (ok) say(h, t, msg)
  addRaw(h, t, effect, dur, pw, 1)
  h.recalc(t)
}

/** The kinds shared by the battle and the camp. */
export const SHARED_KINDS: Record<string, SpellKind> = {
  /** Enlarge (PoR 12a5): STR 18 with a % by level; past the table the original keeps a stale % (taken as the last) */
  async enlarge({ h, L, dur, targets: [t] }, p) {
    const pct = p.pct as number[]
    if (t) strengthEffect(h, t, 18, pct[Math.min(L, pct.length - 1)], num(p, 'effect'), dur, msgOf(p))
  },
  /** Reduce (136e): on a failed save, ends one of the effect */
  async reduce({ h, targets: [t] }, p) {
    if (t && !h.save(t, num(p, 'saveType'), 0) && (await removeOne(h, t, num(p, 'effect')))) say(h, t, msgOf(p))
  },
  /** Friends (13d8): CHA + the amount (capped); the effect holds the old CHA */
  async friends({ h, L, dur, targets: [t] }, p) {
    if (!t) return
    const old = t[F.stat[5]]
    t[F.stat[5]] = Math.min(num(p, 'cap'), old + amount(p.amount as Amount, L, h.roll.bind(h)).total)
    await addEffect(h, t, num(p, 'effect'), dur, old || L, 1, 0, false, false, msgOf(p))
  },
  /** Slow Poison (185b): only on a poisoned target that is not Animated */
  async slowPoison({ h, dur, targets: [t] }, p) {
    if (!t || t[F.status] === 1 || !h.effectsOf(t).some((x) => x.type === 0x37)) return
    if (t[F.hp] === 0) t[F.hp] = 1
    await addEffect(h, t, 0x16, dur, 0xff, 1, 0, false, false, msgOf(p))
    h.revive(t, t[F.hp]) // handler 0x4E with arg 1, whatever the status
    addRaw(h, t, 0x0f, 10, 0xff, 1)
  },
  /**
   * The spell's effect (or `effect`) on the caster or the first target (`to`), with power L (or `power`,
   * or L plus the caster's side shifted by `sideShift`), `flag`, a fixed `duration`, run at once with
   * `runNow` (Spiritual Hammer 19c3, Prayer 24d6, the Manual of Bodily Health)
   */
  async applyTo({ h, caster, s, L, dur, targets }, p) {
    const t = p.to === 'caster' ? caster : targets[0]
    if (!t) return
    const power = p.power !== undefined ? num(p, 'power') : p.sideShift !== undefined ? (L + (caster[F.side] << num(p, 'sideShift'))) & 0xff : L
    await addEffect(h, t, num(p, 'effect', s.effect), p.duration !== undefined ? num(p, 'duration') : dur, power, num(p, 'flag'), 0, false, !!p.runNow, msgOf(p))
  },
  /**
   * Strength (1f41): every class bonus is rolled (`bonus`, in order: the classes and the die), and the
   * last that applies wins; over 18, the classes `pctClasses` get 18/(% + 10 × excess), others 18
   */
  async strengthByClass({ h, dur, targets: [t] }, p) {
    if (!t) return
    const rolled = (p.bonus as { cls: number[]; d: number }[]).map((b) => ({ cls: b.cls, r: h.roll(1, b.d) }))
    let bonus = 0
    for (const b of rolled) if (b.cls.some((k) => t[F.levels + k] > 0)) bonus = b.r
    let n = t[F.stat[0]] + bonus, pct = 0
    if (n > 18) { if ((p.pctClasses as number[]).some((k) => t[F.levels + k] > 0)) pct = Math.min(100, t[F.strPct] + 10 * (n - 18)); n = 18 }
    strengthEffect(h, t, n, pct, num(p, 'effect'), dur, msgOf(p))
  },
  /** Animate Dead (206f): ignores targeting; every dead creature of type 0, while L lasts */
  async animateDead({ h, caster, L }, p) {
    let n = L
    fx.area = true
    for (const d of h.all()) {
      if (n <= 0) break
      if (d[F.status] !== 6 || d[F.monsterType] !== 0) continue
      const pw = (L + (d[F.side] << 4)) & 0xff
      d[F.side] = caster[F.side]; d[F.quick] = 1; d[F.undead] = 2; d[F.sweep] = 0; d[F.baseMove] = 6
      for (let k = F.memorised; k < F.memorised + F.memorisedCount; k++) d[k] = 0
      d[F.morale] = d[F.morale] > 0x7f ? 0xb2 : 0xb3
      d[F.monsterType] = 4
      for (let i = 0x0a; i <= 0x0d; i++) h.setRec(d, i, 0)
      n-- // bug kept: spent and converted even when the body's square is taken
      if (h.revive(d, d[F.maxHp])) {
        await addEffect(h, d, num(p, 'effect'), 0, pw, 1, 0, false, false, msgOf(p))
        d[F.status] = 1
      }
    }
    fx.area = false
  },
  /** Cure Blindness (2217): removes one of the effect ("is Cured"), then the line with the sparkle */
  async cure({ h, targets: [t] }, p) {
    if (t && (await removeOne(h, t, num(p, 'effect')))) good(h, t, msgOf(p))
  },
  async cureDisease({ h, targets: [t] }) { if (t) await cureDisease(h, t) },
  /** Dispel Magic (2385): passes on the first target, one per target (bug kept) */
  async dispel({ h, L, targets }, p) {
    const t = targets[0]
    if (!t) return
    for (let pass = 0; pass < targets.length; pass++) {
      let any = false
      for (const x of [...h.effectsOf(t)]) {
        if (x.power >= 0xff || !h.effectsOf(t).includes(x)) continue
        if (h.roll(1, 100) <= dispelChance(L, x.power & 0x0f)) { await removeEffect(h, t, x); any = true }
      }
      if (any) good(h, t, msgOf(p))
    }
  },
  /** Remove Curse (2540): the effect, else the first cursed item's flag */
  async removeCurse({ h, targets: [t] }, p) {
    if (!t) return
    if (await removeOne(h, t, num(p, 'effect'))) { good(h, t, 'is un-cursed'); return }
    const it = h.itemsOf(t).find((x) => x.cursed)
    if (it) { it.raw[0x36] = 0; good(h, t, "'s item is un-cursed") }
  },
  /** Restoration (2c43): one drained level back, to the class whose next level is cheapest */
  async restore({ h, e, targets: [t] }, p) {
    if (!t || t[F.drainLevels] === 0 || !e.startImage) return
    const tb = new Tables(e.startImage)
    const hp = Math.floor(t[F.drainHp] / t[F.drainLevels])
    t[F.maxHp] = (t[F.maxHp] + hp) & 0xff; t[F.hp] = (t[F.hp] + hp) & 0xff; t[F.hpRolled] = (t[F.hpRolled] + hp) & 0xff
    t[F.drainHp] -= hp
    t[F.drainLevels]--
    let best = 13, min = 10_000_000, pick = -1
    for (let k = 0; k < 8; k++) {
      const lv = t[F.levels + k]
      if (lv <= 0 || lv > best) continue
      const xp = xpFor(tb, k, lv + 1)
      if (xp > 0 && xp < min && levelLimit(t, k) > lv) { best = lv; min = xp; pick = k }
    }
    if (pick >= 0) {
      t[F.levels + pick]++
      if (u32(t, F.xp) < min) setU32(t, F.xp, min)
    }
    derive(tb, t)
    h.recalc(t)
    say(h, t, msgOf(p))
  },
  /** Potion of Speed (2e02): ends `remove` (Slow) if there, else adds the effect (Haste) at `power` */
  async toggle({ h, dur, targets: [t] }, p) {
    if (t && !(await removeOne(h, t, num(p, 'remove')))) await addEffect(h, t, num(p, 'effect'), dur, num(p, 'power'), 0, 0, false, false, msgOf(p))
  },
  /** Keoghtum's Ointment (2e4d): poison, else disease, else the amount healed */
  async ointment({ h, L, targets: [t] }, p) {
    if (!t) return
    if (await removeOne(h, t, 0x37)) { fx.noRearm = true; await removeFirst(h, t, 0x16); fx.noRearm = false; return }
    if (await cureDisease(h, t)) return
    if (h.heal(t, amount(p.amount as Amount, L, h.roll.bind(h)).total, false)) good(h, t, msgOf(p))
  },
  /** Potion of Giant Strength (2ee5): STR str/pct as the effect */
  async setStrength({ h, dur, targets: [t] }, p) {
    if (t) strengthEffect(h, t, num(p, 'str'), num(p, 'pct'), num(p, 'effect'), dur, msgOf(p))
  },
  /** Mirror Image (1a8a): the effect with the amount (the images) as its power; with `levelShift`, shifted up and L below */
  async images({ h, L, dur, targets: [t] }, p) {
    if (!t) return
    const n = amount(p.amount as Amount, L, h.roll.bind(h)).total
    const shift = num(p, 'levelShift')
    addRaw(h, t, num(p, 'effect', 0x1c), dur, shift ? ((n << shift) | L) & 0xff : n, 0)
  },
}

/** Run a shared kind; false if the kind is not one of them. */
export async function castShared(x: Cast, p: SpellSpec): Promise<boolean> {
  const k = SHARED_KINDS[p.k]
  if (!k) return false
  await k(x, p)
  return true
}
