// Spell handlers that work the same in and out of combat (spec/spells.md, "Per spell"): the 4e53
// handlers reach the world through the effect host, so the battle and the camp share them.
import type { Engine } from '../vm/engine'
import type { Spell } from '../data/spells'
import { Tables } from './chargen'
import { derive, levelLimit, xpFor } from './training'
import { addEffect, addRaw, fx, removeEffect, removeFirst, removeOne, setStr, type FxHost } from './effects'

const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0
const setU32 = (c: Uint8Array, o: number, v: number) => { c[o] = v & 0xff; c[o + 1] = (v >> 8) & 0xff; c[o + 2] = (v >> 16) & 0xff; c[o + 3] = (v >>> 24) & 0xff }

/** "<name> msg", or "<name>'s ..." when the message starts with an apostrophe. */
export const line = (name: string, msg: string) => (msg.startsWith("'") ? `${name}${msg}` : `${name} ${msg}`)

/** FUN_10ba_16ec: the line and the pause, no sparkle. */
const say = (h: FxHost, c: Uint8Array, msg: string) => h.print(line(h.name(c), msg))
/** FUN_10ba_1feb with "good": the line, with the sparkle in combat. */
const good = (h: FxHost, c: Uint8Array, msg: string) => { if (h.announce) h.announce(c, msg); else say(h, c, msg) }

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

/**
 * Run the handler for spell s at caster level L with duration dur. Returns false for spells this
 * module does not handle (the caller's own cases and the plain effect-adding default).
 */
export async function sharedSpell(h: FxHost, e: Engine, caster: Uint8Array, s: Spell, L: number, dur: number, targets: Uint8Array[]): Promise<boolean> {
  const t = targets[0]
  switch (s.id) {
    case 12: { // Enlarge (12a5): STR 18 with a % by level; L ≥ 7 keeps a stale % in the original (taken as 100)
      if (!t) break
      const { ok, pw } = setStr(h, t, 18, [0, 0, 1, 51, 76, 91, 100][Math.min(L, 6)])
      if (ok) say(h, t, 'is stronger')
      addRaw(h, t, 0x0c, dur, pw, 1)
      h.recalc(t)
      break
    }
    case 13: // Reduce (136e): on a failed save, ends one Enlarge
      if (t && !h.save(t, 4, 0) && (await removeOne(h, t, 0x0c))) say(h, t, 'has been reduced')
      break
    case 14: { // Friends (13d8): CHA + 2d4 (cap 25); the effect holds the old CHA
      if (!t) break
      const old = t[0x15]
      t[0x15] = Math.min(25, old + h.roll(2, 4))
      await addEffect(h, t, 0x0e, dur, old || L, 1, 0, false, false, 'is friendly')
      break
    }
    case 26: // Slow Poison (185b): only on a poisoned target that is not Animated
      if (!t || t[0x10c] === 1 || !h.effectsOf(t).some((x) => x.type === 0x37)) break
      if (t[0x11b] === 0) t[0x11b] = 1
      await addEffect(h, t, 0x16, dur, 0xff, 1, 0, false, false, 'is affected')
      h.revive(t, t[0x11b]) // handler 0x4E with arg 1, whatever the status
      addRaw(h, t, 0x0f, 10, 0xff, 1)
      break
    case 28: await addEffect(h, caster, 0x17, dur, L, 1, 0, false, true); break // Spiritual Hammer (19c3)
    case 35: { // Strength (1f41): every bonus is rolled, the later class checks win
      if (!t) break
      let bonus = 0
      const r4 = h.roll(1, 4), r6 = h.roll(1, 6), r8 = h.roll(1, 8)
      if (t[0x9b] > 0) bonus = r4
      if (t[0x96] > 0 || t[0x9c] > 0) bonus = r6
      if (t[0x98] > 0) bonus = r8
      let n = t[0x10] + bonus, pct = 0
      if (n > 18) { if (t[0x98] > 0) pct = Math.min(100, t[0x16] + 10 * (n - 18)); n = 18 }
      const { ok, pw } = setStr(h, t, n, pct)
      if (ok) say(h, t, 'is stronger')
      addRaw(h, t, 0x26, dur, pw, 1)
      h.recalc(t)
      break
    }
    case 36: { // Animate Dead (206f): ignores targeting; every dead creature of type 0, while L lasts
      let n = L
      fx.area = true
      for (const d of h.all()) {
        if (n <= 0) break
        if (d[0x10c] !== 6 || d[0x9f] !== 0) continue
        const pw = (L + (d[0x10e] << 4)) & 0xff
        d[0x10e] = caster[0x10e]; d[0x10f] = 1; d[0x76] = 2; d[0x6b] = 0; d[0x72] = 6
        for (let k = 0x17; k <= 0x2b; k++) d[k] = 0
        d[0x84] = d[0x84] > 0x7f ? 0xb2 : 0xb3
        d[0x9f] = 4
        for (let i = 0x0a; i <= 0x0d; i++) h.setRec(d, i, 0)
        n-- // bug kept: spent and converted even when the body's square is taken
        if (h.revive(d, d[0x32])) {
          await addEffect(h, d, 0x20, 0, pw, 1, 0, false, false, 'is animated')
          d[0x10c] = 1
        }
      }
      fx.area = false
      break
    }
    case 37: if (t && (await removeOne(h, t, 0x21))) good(h, t, 'can see'); break // Cure Blindness (2217)
    case 39: if (t) await cureDisease(h, t); break
    case 41: case 46: { // Dispel Magic (2385): passes on the first target, one per target (bug)
      if (!t) break
      for (let pass = 0; pass < targets.length; pass++) {
        let any = false
        for (const x of [...h.effectsOf(t)]) {
          if (x.power >= 0xff || !h.effectsOf(t).includes(x)) continue
          if (h.roll(1, 100) <= dispelChance(L, x.power & 0x0f)) { await removeEffect(h, t, x); any = true }
        }
        if (any) good(h, t, 'is affected')
      }
      break
    }
    case 42: // Prayer (24d6): the caster, power L + side × 16
      await addEffect(h, caster, 0x31, dur, (L + (caster[0x10e] << 4)) & 0xff, 0, 0, false, false, 'is praying')
      break
    case 43: { // Remove Curse (2540)
      if (!t) break
      if (await removeOne(h, t, 0x24)) { good(h, t, 'is un-cursed'); break }
      const it = h.itemsOf(t).find((x) => x.cursed)
      if (it) { it.raw[0x36] = 0; good(h, t, "'s item is un-cursed") }
      break
    }
    case 56: { // Restoration (2c43): one drained level back, to the class whose next level is cheapest
      if (!t || t[0x74] === 0 || !e.startImage) break
      const tb = new Tables(e.startImage)
      const hp = Math.floor(t[0x75] / t[0x74])
      t[0x32] = (t[0x32] + hp) & 0xff; t[0x11b] = (t[0x11b] + hp) & 0xff; t[0xb1] = (t[0xb1] + hp) & 0xff
      t[0x75] -= hp
      t[0x74]--
      let best = 13, min = 10_000_000, pick = -1
      for (let k = 0; k < 8; k++) {
        const lv = t[0x96 + k]
        if (lv <= 0 || lv > best) continue
        const xp = xpFor(tb, k, lv + 1)
        if (xp > 0 && xp < min && levelLimit(t, k) > lv) { best = lv; min = xp; pick = k }
      }
      if (pick >= 0) {
        t[0x96 + pick]++
        if (u32(t, 0xac) < min) setU32(t, 0xac, min)
      }
      derive(tb, t)
      h.recalc(t)
      say(h, t, 'is restored')
      break
    }
    case 57: // Potion of Speed (2e02): ends Slow, else Haste
      if (t && !(await removeOne(h, t, 0x2a))) await addEffect(h, t, 0x27, dur, 12, 0, 0, false, false, 'is Speedy')
      break
    case 58: { // Keoghtum's Ointment (2e4d): poison, else disease, else 1d4 + 8 healing
      if (!t) break
      if (await removeOne(h, t, 0x37)) { fx.noRearm = true; await removeFirst(h, t, 0x16); fx.noRearm = false; break }
      if (await cureDisease(h, t)) break
      if (h.heal(t, h.roll(1, 4) + 8, false)) good(h, t, 'is Healed')
      break
    }
    case 59: { // Potion of Giant Strength (2ee5): STR 21
      if (!t) break
      const { ok, pw } = setStr(h, t, 21, 0)
      if (ok) say(h, t, 'is stronger')
      addRaw(h, t, 0x26, dur, pw, 1)
      h.recalc(t)
      break
    }
    case 67: if (t) await addEffect(h, t, 0x04, 1440, 0xff, 1, 0, false, false, 'is Reading'); break // Manual of Bodily Health
    default: return false
  }
  return true
}
