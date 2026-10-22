// Spell handler kinds that work the same in and out of combat (spec/A-games/engine/spells.md, "Per spell"): the
// handlers reach the world through the effect host, so the battle and the camp share them. Each game's
// profile names a kind and its parameters for every spell id (games/spellrules.ts); the battle adds
// the kinds that need the battlefield (rules/combat.ts), the camp its own heal and Apply (rules/magic.ts).
import type { Engine } from '../vm/engine'
import type { Spell } from '../data/spells'
import type { Amount, SpellSpec, Term } from '../games/spellrules'
import { game } from '../games/profile'
import { Tables } from './chargen'
import { derive, levelLimit, xpFor } from './training'
import { addEffect, addRaw, fire, fx, ids, removeEffect, removeFirst, removeOne, setStr, strEnc, type FxHost } from './effects'
import { effectiveStat } from './effectkinds'
import { F } from '../games/fields'
import { msg } from '../games/strings'
import { lineText } from '../data/gametext'

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

const s8 = (v: number) => (v << 24) >> 24
const num = (p: SpellSpec, k: string, dflt = 0) => (p[k] as number | undefined) ?? dflt
/** a spell's line (`msg`), read from the game's files; '' when it has none */
export const msgOf = (p: SpellSpec) => lineText(p.msg)
/** another text parameter of a spell (an address; 0 or absent: none) */
export const textOf = (a: unknown) => (typeof a === 'number' || Array.isArray(a) ? lineText(a as number | number[]) : '')

/** FUN_4e53_228a, Cure Disease: each removal says "is Cured"; true if anything went. */
export async function cureDisease(h: FxHost, t: Uint8Array): Promise<boolean> {
  let any = false
  fx.noRearm = true
  for (const [type, ...partners] of ids().diseases) {
    if (!(await removeOne(h, t, type))) continue
    any = true
    for (const q of partners) await removeFirst(h, t, q)
  }
  fx.noRearm = false
  return any
}

/** Dispel chance for an effect of level lv against caster level L (FUN_4e53_2385). */
const dispelChance = (L: number, lv: number) => (L > lv ? 50 + 5 * (L - lv) : L < lv ? 50 - 2 * (lv - L) : 50)

/**
 * CotAB 0x4C1D8: the new STR beats the **base** STR (+0x10), or is 18 with a higher % than the base %
 * (+0x1D) whatever the base STR (O: 0x4C1EA); the power is then the encoded STR (0x4C160: str + 100, or
 * % + 1 at 18).
 */
export function overBase(t: Uint8Array, str: number, pct: number): number | null {
  return str > t[F.baseStat[0]] || (str === 18 && pct > t[F.baseStrPct]) ? strEnc(str, pct) : null
}

/**
 * STR set to str/pct as an effect (Enlarge, Strength, Giant Strength), by the game's rule
 * (`spells.strength`). `setCurrent` (PoR FUN_5216_115c): the current STR is set when that raises it
 * (the line), the effect is added either way with the STR to restore. `overBase` (CotAB 0x4C1D8): only
 * a STR above the base one adds the effect (the line, power the new STR, flag 1) and the current STR
 * is worked out again (0x4C389); otherwise `unaffected` is said, if given, and nothing is added.
 */
async function strengthEffect(h: FxHost, t: Uint8Array, str: number, pct: number, effect: number, dur: number, msg: string, unaffected?: string, power?: number, viaAdd = false) {
  if (game().spells.strength === 'overBase') {
    const pw = overBase(t, str, pct)
    if (pw === null) { if (unaffected) say(h, t, unaffected); return }
    // `viaAdd` (SotSB Enlarge 0x499AF): through the add-effect routine with its line (I: power and flag as the raw add's)
    if (viaAdd) await addEffect(h, t, effect, dur, power ?? pw, 1, 0, false, false, msg)
    else {
      if (msg) say(h, t, msg)
      addRaw(h, t, effect, dur, power ?? pw, 1)
    }
    await effectiveStat(h, t, 0)
    return
  }
  const { ok, pw } = setStr(h, t, str, pct)
  if (ok) say(h, t, msg)
  addRaw(h, t, effect, dur, pw, 1)
  h.recalc(t)
}

/** the creature's immunity flags (SotSB +0x15E, F.immunity) have `flag` */
const immune = (t: Uint8Array, flag: number) => F.immunity >= 0 && (t[F.immunity] & flag) !== 0

/** The kinds shared by the battle and the camp. */
export const SHARED_KINDS: Record<string, SpellKind> = {
  /** an empty handler (SotSB 78 Faerie Fire 0x4BFFB, 101–109 0x4970D): nothing happens */
  async none() {},
  /**
   * Heal (SotSB 0x4A84E): the first of each of `diseases` removed ("cured", STR worked out again if any
   * went), `blind` removed (`blindMsg`), `feeble` removed (`feebleMsg`, INT and WIS worked out again);
   * then d = 1d`die`: unforced healing of max HP − HP − d, or nothing when HP + d is above the maximum,
   * with the line when it healed (so HP ends at max − d, CotAB's temple Heal quirk)
   */
  async healAll({ h, targets: [t] }, p) {
    if (!t) return
    let any = false
    fx.noRearm = true
    for (const type of p.diseases as number[]) if (await removeFirst(h, t, type)) any = true
    fx.noRearm = false
    if (any) { say(h, t, textOf(p.curedMsg)); await effectiveStat(h, t, 0) }
    if (await removeFirst(h, t, num(p, 'blind'))) say(h, t, textOf(p.blindMsg))
    if (await removeFirst(h, t, num(p, 'feeble'))) { say(h, t, textOf(p.feebleMsg)); await effectiveStat(h, t, 1); await effectiveStat(h, t, 2) }
    const d = h.roll(1, num(p, 'die'))
    const n = t[F.hp] + d > t[F.maxHp] ? 0 : (t[F.maxHp] - t[F.hp] - d) & 0xff
    if (h.heal(t, n, false)) say(h, t, msgOf(p))
  },
  /**
   * Harm (SotSB 0x4B702): damage type `dmgType`; the first target gets `effect` through the add-effect
   * routine (no line there) and the line; then damage HP − 1d`die` (type 0), so HP ends at 1d`die`
   */
  async harm({ h, targets: [t] }, p) {
    if (!t) return
    fx.dmgType = num(p, 'dmgType')
    await addEffect(h, t, num(p, 'effect'), 0, 0, 0, 0, false, false, '')
    say(h, t, msgOf(p))
    const d = h.roll(1, num(p, 'die'))
    h.damage(t, (t[F.hp] - d) & 0xff, 0, false)
  },
  /** SotSB 63 (0x4B9C8): 1d`die` years younger, not below `floor`: `floorMsg` at the floor, else the line */
  async younger({ h, targets: [t] }, p) {
    if (!t) return
    const age = (t[F.age] | (t[F.age + 1] << 8)) - h.roll(1, num(p, 'die'))
    const v = age < num(p, 'floor') ? num(p, 'floor') : age
    t[F.age] = v & 0xff; t[F.age + 1] = (v >> 8) & 0xff
    say(h, t, v === num(p, 'floor') && age < num(p, 'floor') ? textOf(p.floorMsg) : msgOf(p))
  },
  /**
   * Stone to Flesh (SotSB 0x4D2D5): a stoned (status 7) first target is Okay and in play with 1 HP and the
   * line, in a battle put back on the field; another is told `notMsg` (I: the rest of the original's
   * branches, an Apply when the menu answers otherwise, not followed)
   */
  async stoneToFlesh({ h, targets: [t] }, p) {
    if (!t) return
    if (t[F.status] !== 7) { say(h, t, textOf(p.notMsg)); return }
    t[F.status] = 0; t[F.inPlay] = 1; t[F.hp] = 1
    say(h, t, msgOf(p))
    if (h.inCombat()) h.revive(t, 1)
  },
  /**
   * Disintegrate, Flesh to Stone (SotSB 0x4D211, 0x4D4D8): the event-9 probe (damage type `probeType`,
   * damage `probe`: a handler that zeroes it vetoes); then a failed save vs `saveType` gives `status` with
   * the line, through the set-status routine
   */
  async saveOrStatus({ h, targets: [t] }, p) {
    if (!t) return
    fx.dmgType = num(p, 'probeType'); fx.dmg = num(p, 'probe')
    await fire(h, t, 9)
    if (fx.dmg === 0) return
    if (!h.save(t, num(p, 'saveType'), 0)) h.setStatus(t, num(p, 'status'), line(h.name(t), msgOf(p)))
  },
  /**
   * Death Spell (SotSB 0x4D0E5): damage type `probeType`; a pool of `pool` dice; each target in order costs
   * by its hit dice (`costs`[hd], past the list `other`; `hd6`: [max HP at most, cost, cost above] for hit
   * dice 6) and, unless immune (`immuneFlag`), when the pool still covers it, pays and gets status 6 with
   * the line (the set-status routine)
   */
  async slayByPool({ h, L, targets }, p) {
    fx.dmgType = num(p, 'probeType')
    let pool = amount(p.pool as Amount, L, h.roll.bind(h)).total
    const costs = p.costs as number[], hd6 = p.hd6 as number[]
    for (const t of targets) {
      const hd = s8(t[F.hitDice])
      const cost = hd === 6 && hd6 ? (t[F.maxHp] <= hd6[0] ? hd6[1] : hd6[2]) : hd >= 0 && hd < costs.length ? costs[hd] : num(p, 'other')
      if (immune(t, num(p, 'immuneFlag')) || pool < cost) continue
      pool -= cost
      h.setStatus(t, 6, line(h.name(t), msgOf(p)))
    }
  },
  /**
   * Power Word Stun (SotSB 0x4D8ED): the first target's HP picks the dice of the rounds (`bands`: [lowest
   * HP, highest, n, d]; none: 0, the effect then lasts for good as the original's); the spell's effect
   * through the add-effect routine for that long, power L, with the line
   */
  async stun({ h, s, L, targets: [t] }, p) {
    if (!t) return
    const band = (p.bands as number[][]).find(([lo, hi]) => t[F.hp] >= lo && t[F.hp] <= hi)
    const rounds = band ? h.roll(band[2], band[3]) : 0
    await addEffect(h, t, num(p, 'effect', s.effect), rounds, L, 0, s.save, false, false, msgOf(p))
  },
  /**
   * Enlarge (PoR 12a5, CotAB 0x45F75): the first target's STR and % by caster level (`levels`[L] =
   * [STR, %]); past the table `beyond` (CotAB 18/00, from its reset globals DS:4CCD/4CCE), or without
   * it the last entry (PoR keeps a stale %, taken as the last); the game's STR rule decides
   */
  async enlarge({ h, L, dur, targets: [t] }, p) {
    const levels = p.levels as number[][]
    const [str, pct] = L < levels.length ? levels[L] : ((p.beyond as number[] | undefined) ?? levels[levels.length - 1])
    if (t) await strengthEffect(h, t, str, pct, num(p, 'effect'), dur, msgOf(p), textOf(p.unaffected) || undefined, undefined, !!p.viaAdd)
  },
  /**
   * Reduce (PoR 136e, CotAB 0x460AA): on a failed save, ends one of the effect ("is Cured", or with
   * `silent` without it, CotAB, whose removal works out the STR again)
   */
  async reduce({ h, targets: [t] }, p) {
    if (!t || h.save(t, num(p, 'saveType'), 0)) return
    if (p.silent ? await removeFirst(h, t, num(p, 'effect')) : await removeOne(h, t, num(p, 'effect'))) say(h, t, msgOf(p))
  },
  /** Friends (13d8): CHA + the amount (capped); the effect holds the old CHA */
  async friends({ h, L, dur, targets: [t] }, p) {
    if (!t) return
    const old = t[F.stat[5]]
    t[F.stat[5]] = Math.min(num(p, 'cap'), old + amount(p.amount as Amount, L, h.roll.bind(h)).total)
    await addEffect(h, t, num(p, 'effect'), dur, old || L, 1, 0, false, false, msgOf(p))
  },
  /**
   * Slow Poison (185b): only on a poisoned target that is not Animated; with `direct` (SotSB 0x49ED9) any
   * poisoned target, set Okay and in play itself instead of through handler 0x4E
   */
  async slowPoison({ h, dur, targets: [t] }, p) {
    if (!t || (!p.direct && t[F.status] === 1) || !h.effectsOf(t).some((x) => x.type === ids().poisoned)) return
    if (t[F.hp] === 0) t[F.hp] = 1
    if (p.direct) { t[F.status] = 0; t[F.inPlay] = 1 }
    await addEffect(h, t, ids().slowPoison, dur, 0xff, 1, 0, false, false, msgOf(p))
    if (!p.direct) h.revive(t, t[F.hp]) // handler 0x4E with arg 1, whatever the status
    addRaw(h, t, ids().poisonTick, 10, 0xff, 1)
  },
  /**
   * The spell's effect (or `effect`) on the caster or the first target (`to`), with power L (or `power`,
   * a number or a rolled amount, or L plus the caster's side shifted by `sideShift`), `flag`, a fixed
   * `duration`, run at once with `runNow`; `stat` is worked out again on the caster afterwards (Spiritual
   * Hammer 19c3, Prayer 24d6, the Manual of Bodily Health; CotAB Friends 0x4614A)
   */
  async applyTo({ h, caster, s, L, dur, targets }, p) {
    const t = p.to === 'caster' ? caster : targets[0]
    if (!t) return
    const power = typeof p.power === 'object' ? amount(p.power as Amount, L, h.roll.bind(h)).total & 0xff
      : p.power !== undefined ? num(p, 'power') : p.sideShift !== undefined ? (L + (caster[F.side] << num(p, 'sideShift'))) & 0xff : L
    await addEffect(h, t, num(p, 'effect', s.effect), p.duration !== undefined ? num(p, 'duration') : dur, power, num(p, 'flag'), 0, false, !!p.runNow, msgOf(p))
    // CotAB Friends (0x4614A): the caster's (DS:6520) stat `stat` worked out again (0x4C389)
    if (p.stat !== undefined) await effectiveStat(h, caster, num(p, 'stat'))
  },
  /**
   * Strength (PoR 1f41, CotAB 0x46BCB): a die per class group (`bonus`, in order: the classes and the
   * die), the last group that applies wins; PoR rolls every die first, with `rollCounting` (CotAB) only a
   * group that applies rolls (none: the original's bonus is uninitialised, I: 0). A class applies with a
   * level above 0 (PoR, unsigned), or with `counts: 'levelOrFormer'` (CotAB) a level above 0 or a former
   * dual-class level above the level kept at the change (+0xE6), both signed. Over 18 the classes
   * `pctClasses` get 18/(% + 10 × excess, at most 100), others 18. The game's STR rule decides; with
   * `bonusPower` the effect's power is the bonus + that (CotAB: 0x26 holds the bonus, which the stat
   * routine 0x4C389 adds to STR), and without `msg` nothing is said (CotAB)
   */
  async strengthByClass({ h, dur, targets: [t] }, p) {
    if (!t) return
    const former = p.counts === 'levelOrFormer'
    const counts = (k: number) => former ? s8(t[F.levels + k]) > 0 || s8(t[F.prevLevels + k]) > s8(t[F.hpLevel]) : t[F.levels + k] > 0
    const groups = p.bonus as { cls: number[]; d: number }[]
    const rolled = p.rollCounting ? groups.map((b) => ({ cls: b.cls, r: 0 })) : groups.map((b) => ({ cls: b.cls, r: h.roll(1, b.d) }))
    let bonus = 0
    rolled.forEach((b, i) => { if (b.cls.some(counts)) bonus = p.rollCounting ? h.roll(1, groups[i].d) : b.r })
    let n = t[F.stat[0]] + bonus, pct = 0
    if (n > 18) { if ((p.pctClasses as number[]).some(counts)) pct = Math.min(100, t[F.strPct] + 10 * (n - 18)); n = 18 }
    const power = p.bonusPower !== undefined ? (bonus + num(p, 'bonusPower')) & 0xff : undefined
    await strengthEffect(h, t, n, pct, num(p, 'effect'), dur, msgOf(p), textOf(p.unaffected) || undefined, power)
  },
  /**
   * Neutralize Poison (CotAB 0x4814A): nothing on an Animated (status 1) first target; a poisoned one
   * (`effect`) has 0 HP made 1, `removes` taken out without re-arming (DS:6FB6), the line, and is up and
   * in play again; anyone else is `unaffected`
   */
  async curePoison({ h, targets: [t] }, p) {
    if (!t || t[F.status] === 1) return
    if (!h.effectsOf(t).some((x) => x.type === num(p, 'effect'))) { say(h, t, textOf(p.unaffected)); return }
    if (t[F.hp] === 0) t[F.hp] = 1
    fx.noRearm = true
    for (const type of p.removes as number[]) await removeFirst(h, t, type)
    fx.noRearm = false
    say(h, t, msgOf(p))
    t[F.inPlay] = 1; t[F.status] = 0
  },
  /**
   * Raise Dead (CotAB 0x4848A): a first target of one of `statuses` with a base CON above 0 and not of a
   * race in `races` loses `removes` without re-arming, is up and in play, loses a point of base CON (the
   * current one worked out again), has 1 HP and the line; no survival roll. ?: on the battlefield the
   * port puts no fallen body back on its square
   */
  async raise({ h, targets: [t] }, p) {
    if (!t || !(p.statuses as number[]).includes(t[F.status]) || t[F.baseStat[4]] === 0 || (p.races as number[]).includes(t[F.race])) return
    fx.noRearm = true
    for (const type of p.removes as number[]) await removeFirst(h, t, type)
    fx.noRearm = false
    t[F.status] = 0; t[F.inPlay] = 1
    t[F.baseStat[4]]--
    await effectiveStat(h, t, 4)
    t[F.hp] = 1
    say(h, t, msgOf(p))
  },
  /**
   * Slay Living (CotAB 0x4856D): a probe through event 9 with damage `probe` of type `probeType`; zeroed,
   * `unaffected`; else a failed save vs `saveType` is status 6 with the line, a saved one takes the
   * amount (type `dmgType`, the dice count kept, no save)
   */
  async slay({ h, L, targets: [t] }, p) {
    if (!t) return
    fx.dmgType = num(p, 'probeType'); fx.dmg = num(p, 'probe')
    await fire(h, t, 9)
    if (p.immuneFlag !== undefined && immune(t, num(p, 'immuneFlag'))) fx.dmg = 0 // SotSB 0x4BF4F
    if (fx.dmg === 0) { say(h, t, textOf(p.unaffected)); return }
    if (!h.save(t, num(p, 'saveType'), 0)) { h.setStatus(t, 6, line(h.name(t), msgOf(p))); return }
    fx.dmgType = num(p, 'dmgType')
    const { n, total } = amount(p.amount as Amount, L, h.roll.bind(h))
    fx.dice = n
    h.damage(t, total, 0, false)
  },
  /**
   * Fire Shield (CotAB 0x48BB2): the caster picks one of `options` (the computer: the first when 1d`aiPick.d`
   * is above `aiPick.above`, else the second; a player from the menu `prompt`) and gets its effects
   * through the add-effect routine (power 0, flag 0, each with its line, '' none: Cold has none, as the
   * original); a player who picks neither is asked `abort` (yes: the spell is lost), else asked again
   * (IMP-071: the web menus always return a choice, so a player cannot reach the question)
   */
  async flameShield({ h, caster, dur }, p) {
    const opts = p.options as { name: string; effects: [number, number | number[]][] }[]
    const ai = p.aiPick as { d: number; above: number }
    for (;;) {
      const k = caster[F.quick] || !h.choose ? (h.roll(1, ai.d) > ai.above ? 0 : 1) : await h.choose(textOf(p.prompt), opts.map((o) => o.name))
      const o = opts[k]
      if (o) {
        for (const [type, said] of o.effects) await addEffect(h, caster, type, dur, 0, 0, 0, false, false, textOf(said))
        return
      }
      if (!h.ask || (await h.ask(textOf(p.abort).trimEnd()))) return
    }
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
  /**
   * Remove Curse (PoR 2540, CotAB 0x47575): the effect ("is Cured", then "is un-cursed"), else the first
   * cursed item: PoR clears its curse flag; with `item: 'unready'` (CotAB) it stays cursed but is
   * unreadied (whether it was readied or not, as the original); when its +0x3E is above 0x7F the generic
   * item handler runs with arg 1 (DS:759C = 1 sends 0x4AB77 to handler 147, 0x29A23, whatever the item's
   * kind: the first effect of type item +0x3D goes) and the six stats are worked out again (0x4C389);
   * then `itemMsg` (default PoR's "'s item is un-cursed")
   */
  async removeCurse({ h, targets: [t] }, p) {
    if (!t) return
    if (await removeOne(h, t, num(p, 'effect'))) { good(h, t, msg('unCursed')); return }
    const it = h.itemsOf(t).find((x) => x.cursed)
    if (!it) return
    if (p.item === 'unready') {
      it.ready = false
      if (it.raw[0x3e] > 0x7f) {
        await removeFirst(h, t, it.raw[0x3d])
        for (let k = 0; k < 6; k++) await effectiveStat(h, t, k)
      }
    } else it.raw[0x36] = 0
    good(h, t, p.itemMsg !== undefined ? textOf(p.itemMsg) : msg('itemUnCursed'))
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
    for (let k = 0; k < F.classCount; k++) {
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
    if (await removeOne(h, t, ids().poisoned)) { fx.noRearm = true; await removeFirst(h, t, ids().slowPoison); fx.noRearm = false; return }
    if (await cureDisease(h, t)) return
    if (h.heal(t, amount(p.amount as Amount, L, h.roll.bind(h)).total, false)) good(h, t, msgOf(p))
  },
  /** Potion of Giant Strength (2ee5): STR str/pct as the effect */
  async setStrength({ h, dur, targets: [t] }, p) {
    if (t) await strengthEffect(h, t, num(p, 'str'), num(p, 'pct'), num(p, 'effect'), dur, msgOf(p), textOf(p.unaffected) || undefined)
  },
  /**
   * Mirror Image (PoR 1a8a, CotAB 0x466B8): the effect with the amount (the images) as its power; with
   * `levelShift` shifted up with L below (CotAB (1d4 << 4) | L); with `msg` added as Apply adds it (event
   * 9, the old record by the game's rule, the line: CotAB), else raw (PoR)
   */
  async images({ h, s, L, dur, targets: [t] }, p) {
    if (!t) return
    const n = amount(p.amount as Amount, L, h.roll.bind(h)).total
    const shift = num(p, 'levelShift')
    const power = shift ? ((n << shift) | L) & 0xff : n
    if (p.msg !== undefined) await addEffect(h, t, num(p, 'effect', s.effect), dur, power, 0, s.save, false, false, msgOf(p))
    else addRaw(h, t, num(p, 'effect', 0x1c), dur, power, 0)
  },
}

/** Run a shared kind; false if the kind is not one of them. */
export async function castShared(x: Cast, p: SpellSpec): Promise<boolean> {
  const k = SHARED_KINDS[p.k]
  if (!k) return false
  await k(x, p)
  return true
}
