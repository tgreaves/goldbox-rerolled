// Effects ("affects", spec/effects.md): per-event dispatch of effect handlers (FUN_5216_02fa) and the
// handlers themselves. Globals of the original (DS:6816..6826) live in the Fx context.
import type { Effect } from '../data/effects'

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
  heal(c: Uint8Array, amount: number, force: boolean): void
  revive(c: Uint8Array, hp: number): boolean
  recalc(c: Uint8Array): void
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
  /** effect 0x28 expired: lift that Stinking Cloud (combat only) */
  clearCloud?(c: Uint8Array, power: number): void
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
}

const has = (h: FxHost, c: Uint8Array, t: number) => h.effectsOf(c).some((e) => e.type === t)

/** Event → effect types listening to it (FUN_5216_02fa). */
const EVENTS: Record<number, number[]> = {
  0: [126], 1: [25, 37, 63, 71], 2: [68, 73, 76, 77, 79, 80, 85, 86, 87],
  3: [64, 65, 66, 67, 68, 69, 70, 79, 85, 86, 87], 4: [3, 6, 29],
  5: [28, 41, 60, 94, 96, 101, 104, 115, 116, 117, 119, 120, 122, 123],
  6: [10, 17, 20, 28, 60, 61, 91, 93, 101, 105, 106, 112, 113, 114, 118, 122],
  7: [31, 51, 52, 53], 8: [56, 72, 81, 82, 89, 99], 9: [105, 106, 107, 108, 109, 110, 111, 112, 124, 125],
  10: [1, 2, 3, 6, 18, 26, 33, 36, 49], 11: [8, 45, 9, 46, 17, 30, 33],
  12: [8, 45, 9, 46, 10, 17, 20, 33, 36, 49, 61, 90, 97, 111, 125], 13: [74, 75, 99, 100, 103],
  14: [83, 84, 121], 15: [11, 21, 30, 74, 75], 16: [25, 37, 47, 48, 71, 89], 17: [1, 2, 11], 18: [39, 42, 58],
  19: [11, 23, 56, 72, 98],
}
/** Area effects found on any holder (Silence 15', PfE/PfG 10', Prayer). */
const AREA = new Set([21, 45, 46, 49])

/** Fire an event on a character (FUN_5216_02fa). */
export async function fire(h: FxHost, c: Uint8Array, event: number) {
  for (const type of EVENTS[event] ?? []) {
    let eff = h.effectsOf(c).find((e) => e.type === type)
    if (!eff && AREA.has(type)) {
      for (const o of h.all()) {
        const e = h.effectsOf(o).find((x) => x.type === type)
        if (!e) continue
        if (h.inCombat() && h.distance(o, c) > (type === 49 ? 6 : 1)) continue
        eff = e
        break
      }
    }
    if (eff) await handle(h, type, eff, c, event, false)
  }
}

/** Remove an effect record, running its removal callback when flagged (FUN_5216_0026). */
export async function removeEffect(h: FxHost, c: Uint8Array, eff: Effect) {
  const list = h.effectsOf(c)
  const i = list.indexOf(eff)
  if (i < 0) return
  if (eff.flag) await handle(h, eff.type, eff, c, -1, true)
  const j = list.indexOf(eff)
  if (j >= 0) list.splice(j, 1)
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
 * Add an effect through event 9 (FUN_5216_1656): blocked by immunities or a negating save
 * ("is Unaffected"); replaces one of the same type when the new duration is longer or 0.
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
  if (old && ((old.duration > 0 && duration > old.duration) || duration === 0)) await removeEffect(h, c, old)
  const e = addRaw(h, c, type, duration, power, flag)
  // FUN_5216_1656: a non-empty message is shown with the sparkle (sound 4) in combat; none, nothing
  if (msg) { if (h.announce) h.announce(c, msg); else h.print(`${h.name(c)} ${msg}`) }
  if (runNow) await handle(h, type, e, c, -1, false)
  return true
}

/** FUN_3723_0000(t): negate damage (event 6) or block the effect being added (event 9). */
function negate(t: number) {
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

const nameIs = (c: Uint8Array, names: string[]) => names.includes(String.fromCharCode(...c.subarray(1, 1 + c[0])))
const alignmentIn = (c: Uint8Array | null, set: number[]) => !!c && set.includes(c[0xa0])

async function poisonOnHit(h: FxHost, bonus: number) {
  const t = h.targetOf(h.current()!)
  if (!t || !t[0x10d]) return
  if (!h.save(t, 0, bonus)) {
    await addEffect(h, t, 55, 0, 0xff, 0)
    h.setStatus(t, 6, `${h.name(t)} is Poisoned`)
  }
}
async function paralyse(h: FxHost, duration: number) {
  const t = h.targetOf(h.current()!)
  if (!t || !t[0x10d]) return
  if (!h.save(t, 0, 0)) {
    if (h.announce) h.announce(t, 'is Paralyzed'); else h.print(`${h.name(t)} is Paralyzed`)
    await addEffect(h, t, 52, duration, 0x0c, 0)
  }
}

/** Energy drain (FUN_3723_2122). */
function drain(h: FxHost, t: Uint8Array, n: number) {
  if (t[0x10c] === 1) { h.setStatus(t, 8, `${h.name(t)} is dead forever`); return }
  for (let i = 0; i < n; i++) {
    let total = 0
    for (let k = 0; k < 8; k++) total += t[0x96 + k]
    if (total <= 0) break
    t[0x74]++
    const loss = Math.floor(t[0x32] / total)
    t[0x75] += loss
    t[0x32] = Math.max(0, t[0x32] - loss)
    t[0xb1] = Math.max(0, t[0xb1] - loss)
    t[0x11b] = Math.max(0, t[0x11b] - loss)
    let best = 0
    for (let k = 1; k < 8; k++) if (t[0x96 + k] > t[0x96 + best]) best = k
    if (t[0x96 + best] <= 1) { h.setStatus(t, 8, `${h.name(t)} is drained`); return }
    t[0x96 + best]--
    if (t[0x11b] === 0) { h.setStatus(t, 6, `${h.name(t)} dies`); return }
  }
  h.recalc(t)
}

/** One handler call (FUN_5216_0000). event −1 = removal (arg 1) or a direct run. */
async function handle(h: FxHost, type: number, eff: Effect, c: Uint8Array, event: number, removal: boolean) {
  const cur = h.current()
  switch (type) {
    case 1: if (event === 10) fx.roll++; else if (event === 17) fx.morale += 5; break
    case 2: if (event === 10) fx.roll--; else if (event === 17) fx.morale = Math.max(0, fx.morale - 5); break
    case 3: { const t = h.targetOf(c); if (t && t[0x9f] === 4) { if (event === 10) fx.roll += 2; else fx.dmg += 2 } break }
    case 4: if (removal) { h.print(`${h.name(c)} starts to train`); addRaw(h, c, 7, 43200, 0xff, 1) } break
    case 6: {
      const t = h.targetOf(c)
      const b = !t ? 0 : t[0x9f] === 10 ? 1 : t[0x9f] === 9 || t[0x9f] === 12 ? 2 : t[0x9f] === 4 ? 3 : 0
      if (event === 10) fx.roll += b
      else { fx.dmg += b; fx.dmgType = 9 }
      break
    }
    case 7: if (removal) { h.print(`${h.name(c)} is hardier`); c[0x14]++; if (c[0x14] >= 20) addRaw(h, c, 62, 60, 0, 1) } break
    case 8: case 45: if (alignmentIn(cur, [2, 5, 8])) { if (event === 12) fx.save += 2 } break
    case 9: case 46: if (alignmentIn(cur, [0, 3, 6])) { if (event === 12) fx.save += 2 } break
    case 10: if (event === 6 && fx.dmgType & 2) fx.dmg = Math.floor(fx.dmg / 2); else if (event === 12) fx.save += 3; break
    case 11: { // Charm Person
      if (removal) { c[0x10e] = (eff.power >> 6) & 1; if (c[0x84] === 0xb3) c[0x84] = 0; break }
      if (!(eff.power & 0x20)) {
        eff.power = (eff.power + 0x20 + c[0x10e] * 0x40) & 0xff
        c[0x10e] = eff.power >> 7
        c[0x10f] = 1
        if (c[0x84] < 0x80) c[0x84] = 0xb3
        h.setRec(c, 0xa, 0)
      }
      if (event === 17) fx.morale = 100
      break
    }
    case 12: case 38: if (removal) { /* the strongest remaining STR effect wins; power holds the STR to restore */ c[0x10] = eff.power & 0x7f } break
    case 14: if (removal) c[0x15] = eff.power; break
    case 15: if (removal && rearm(h, c, 15, 10, 0xff) && c[0x11b] > 1) { fx.dmgType = 0; h.damage(c, 1, 0, false) } break
    case 17: // Shield
      if (event === 11) c[0x111] = Math.max(c[0x111], 57)
      else if (event === 12) fx.save += 1
      else if (event === 6 && fx.spell === 15) fx.dmg = 0
      break
    case 18: { const t = h.targetOf(c); if (t && t[0x9f] === 1 && t[0x6c] === 1 && nameIs(t, ['KOBOLD', 'KOBOLD LEADER', 'GOBLIN', 'GOBLIN LEADER'])) fx.roll++; break }
    case 20: if (event === 6 && fx.dmgType & 1) fx.dmg = Math.floor(fx.dmg / 2); else if (event === 12) fx.save += 3; break
    case 21: if (h.rec(c, 2)) h.print(`${h.name(c)} is silenced`); h.setRec(c, 1, 0); h.setRec(c, 2, 0); break
    case 22: if (removal) { if (has(h, c, 55)) h.setStatus(c, 6, `${h.name(c)} dies from poison`); await removeType(h, c, 15, true) } break
    case 25: // Invisibility
      if (event === 1 && cur && !has(h, cur, 24)) fx.untargetable = true
      else if (event === 16) fx.roll -= 4
      break
    case 26: { const t = h.targetOf(c); if (t && t[0x9f] === 1 && t[0x6c] === 1 && nameIs(t, ['ORC', 'ORC LEADER', 'GOBLIN', 'GOBLIN LEADER', 'HOBGOBLIN', 'HOBGOBLIN CHIEF', 'GAGOOL', 'MACE'])) fx.roll++; break }
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
      if (event === 11) { c[0x112] = Math.max(0x32, c[0x112] - 2); c[0x111] = c[0x112] }
      break
    case 31: case 51: case 52: case 53: if (event === 7) h.endTurn(c); break
    case 32: if (removal && !fx.noRearm) {
      h.setStatus(c, 6, `${h.name(c)} collapses`)
      c[0x10e] = eff.power >> 4; c[0x10f] = 1; c[0x76] = 0; c[0x6b] = c[0x98]; c[0x72] = 12
      if (c[0x84] === 0xb3) c[0x84] = 0
      c[0x9f] = 0
    } break
    case 33: if (event === 10) fx.roll -= 4; else if (event === 11) { c[0x111] = Math.max(0, c[0x111] - 4); c[0x112] = Math.max(0, c[0x112] - 4) } else if (event === 12) fx.save -= 4; break
    case 34: await handle(h, 43, eff, c, event, removal); await handle(h, 44, eff, c, event, removal); break
    case 35: if (event === 12) fx.save += 1; else fx.roll += 1; break
    case 36: if (event === 10) fx.roll -= 4; else if (event === 12) fx.save -= 4; break
    case 37: if (h.rec(c, 3) > 0) { if (event === 1) fx.untargetable = true; else fx.roll = -1 } break
    case 39: // Haste
      if (!(eff.power & 0x10)) { eff.power |= 0x10; h.print(`${h.name(c)} ages`); const a = (c[0x30] | (c[0x31] << 8)) + 1; c[0x30] = a & 0xff; c[0x31] = a >> 8 }
      fx.rate *= 2
      break
    case 40: if (removal && h.inCombat()) { h.print('The air clears a little...'); h.clearCloud?.(c, eff.power) } break // zones are freed at the end of combat (FUN_320c_0000)
    case 41: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (w && w.raw[0x32] === 0) deflect(h, c, 100); break }
    case 42: fx.rate = Math.floor(fx.rate / 2); break
    case 43: if (removal || event === -1) {
      if (removal && !rearm(h, c, 43, 60, eff.power)) break
      if (c[0x10] > 3) { h.print(`${h.name(c)} is weakened`); c[0x10]-- } else addRaw(h, c, 31, 0, 0xff, 0)
    } break
    case 44: if (removal || event === -1) {
      if (removal && !rearm(h, c, 44, 10, eff.power)) break
      if (c[0x11b] < 2) { if (!has(h, c, 31)) addRaw(h, c, 31, 0, 0xff, 0) } else h.damage(c, 1, 0, false)
    } break
    case 47: { const a = h.current(); if (a && a[0x9f] === 1 && (a[0x6c] & 0x7f) === 2 && nameIs(a, ['OGRE', 'OGRE LEADER', 'TROLL', 'FIRE GIANT', 'HILL GIANT', 'FROST GIANT', 'STONE GIANT'])) fx.roll -= 4; break }
    case 48: { const a = h.current(); if (a && a[0x9f] === 1 && nameIs(a, ['BUGBEAR', 'GNOLL'])) fx.roll -= 4; break }
    case 49: { // Prayer: allies of the caster +1/+1, enemies −1/−1
      const side = (eff.power & 0x10) >> 4
      if (c[0x10e] === side) { if (event === 12) fx.save += 1; else fx.roll += 1 } else if (event === 12) fx.save -= 1; else fx.roll -= 1
      break
    }
    case 50: if (removal && rearm(h, c, 50, 14400, eff.power)) h.heal(c, 1, true); break
    case 56: addRaw(h, c, 25, 1, 0x0c, 0); break
    case 57: if (removal && !fx.noRearm) {
      h.print(`${h.name(c)} Rots...`)
      c[0x15] = Math.max(3, c[0x15] - 2)
      if (eff.power >> 4 > 1) addRaw(h, c, 57, 43200, eff.power - 0x10, 1)
      else h.setStatus(c, 6, `${h.name(c)} Dies rots away`)
    } break
    case 58: h.setRec(c, 6, 0); if (fx.rateIsMove) fx.rate = 0; break
    case 59: if (removal) addRaw(h, c, 98, 0, 0xff, 0); break
    case 61: if (event === 6 && fx.dmgType & 1) { fx.dmg = Math.max(fx.dice, fx.dmg - 2 * fx.dice); if (!(fx.dmgType & 8)) fx.dmg = 0 } else if (event === 12) fx.save += 4; break
    case 62: if (removal && rearm(h, c, 62, 60, eff.power)) h.heal(c, 1, false); break
    case 64: await poisonOnHit(h, 0); break
    case 65: await poisonOnHit(h, 4); break
    case 66: await poisonOnHit(h, 2); break
    case 67: await paralyse(h, h.roll(2, 8)); break
    case 68: { const t = h.targetOf(c); if (t && t[0x2e] !== 2) await paralyse(h, 63); break }
    case 69: await paralyse(h, h.roll(1, 9) + 10); break
    case 70: await poisonOnHit(h, -2); break
    case 71: if (event === 1) fx.untargetable = true; else fx.roll -= 4; break
    case 72: if (h.roll(1, 100) < 96) addRaw(h, c, 25, 1, 0x0c, 0); break
    case 73: { // rake
      const t = h.targetOf(c)
      if (fx.hits[1] === 2 && t && t[0x10d]) {
        c[0x114] = 2; c[0x116] = 2; c[0x118] = 4; c[0x113] = 0
        h.setRec(c, 4, 2) // the follow-up attack loop starts at hand 2
        h.print(`${h.name(c)} Rakes...`)
        await h.attack(c, t)
        h.endTurn(c)
      }
      break
    }
    case 74: case 75: { // grab / blood drain
      const v = h.byIndex(eff.power & 0x3f)
      if (event === 15 && v && v[0x10d] && c[0x10d]) {
        if (type === 74) {
          // crush: one 3d4 attack with hand 1 (FUN_3aae_3a86); the hold ends if the victim goes down
          c[0x113] = 1; c[0x115] = 3; c[0x117] = 4
          h.setRec(c, 4, 1)
          await h.attack(c, v)
          if (!v[0x10d]) { await removeType(h, v, 58); await removeEffect(h, c, eff) }
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
    case 76: { const t = h.targetOf(c); if (t && t[0x10d]) { addRaw(h, c, 75, 0xcf, h.indexOf(t), 1); addRaw(h, t, 58, 0, 0, 0); h.setRec(t, 6, 0) } break }
    case 77: { const t = h.targetOf(c); if (t && t[0x10d] && t[0x10] < 19) { addRaw(h, c, 74, 0, h.indexOf(t), 1); addRaw(h, t, 58, 0, 0, 0); h.print(`${h.name(t)} is held fast`) } break }
    case 78: if (removal && !h.revive(c, c[0x11b])) addRaw(h, c, 78, 1, eff.power, 1); break
    case 79: { const t = h.targetOf(c); if (t && t[0x10d]) { fx.dmgType = 9; h.damage(t, h.roll(2, 10), 0, false) } break }
    case 80: { const t = h.targetOf(c); if (t && t[0x10d]) { fx.dmgType = 0x10; h.damage(t, h.roll(1, 4), 0, false) } break }
    case 81: { // fear aura
      for (const e of h.enemiesNear(c, 255)) {
        if (!e[0x10d] || h.save(e, 4, 0)) continue
        if (e[0x73] <= 3) { h.print(`${h.name(e)} is paralyzed with fear`); addRaw(h, e, 52, 0, 0x0c, 0) }
        else if (e[0x73] <= 5) { h.print(`${h.name(e)} is weakened by fear`); addRaw(h, e, 2, 0, 0x0c, 0) }
      }
      break
    }
    case 82: { // paralysing aura
      for (const o of h.all()) for (const e of h.effectsOf(o).filter((x) => x.type === 82 && o !== c)) h.effectsOf(o).splice(h.effectsOf(o).indexOf(e), 1)
      for (const e of h.enemiesNear(c, 255)) {
        if (!e[0x10d]) continue
        const bonus = 1 + (e[0x2e] === 7 ? 2 : 0)
        if (!h.save(e, 0, bonus)) { h.print(`${h.name(e)} is Paralyzed`); addRaw(h, e, 52, h.roll(1, 4), 0x0c, 0) }
      }
      break
    }
    case 83: { // petrifying gaze
      const t = h.targetOf(c)
      if (!t || !t[0x10d]) break
      h.print(`${h.name(c)} gazes...`)
      let victim = t
      if (has(h, c, 127) && h.itemsOf(t).some((it) => it.ready && it.raw[0x31] === 0x76)) { h.print(`${h.name(t)} reflects it!`); victim = c }
      if (!h.save(victim, 1, 0)) h.setStatus(victim, 7, `${h.name(victim)} is Stoned`)
      break
    }
    case 84: { // charm gaze
      const t = h.targetOf(c)
      if (!t || !t[0x10d]) break
      h.print(`${h.name(c)} Gazes...`)
      fx.spell = 10
      if (!h.save(t, 4, -2)) await addEffect(h, t, 11, 0, (c[0x10e] << 7) | 0x0c, 1, 1, false, true)
      fx.spell = 0
      break
    }
    case 85: case 86: { const t = h.targetOf(c); if (t && t[0x10d]) drain(h, t, type - 84); break }
    case 87: {
      const t = h.targetOf(c)
      if (t && !has(h, t, 50)) { addRaw(h, t, 50, 14400, 0, 1); addRaw(h, t, 57, 43200, (h.roll(1, 6) << 4) + 0x0f, 1); h.print(`${h.name(t)} is Diseased`) }
      break
    }
    case 89: // displacement
      if (event === 8) eff.power &= ~0x10
      else if (event === 16 && !(eff.power & 0x10)) { fx.roll = -1; eff.power |= 0x10 }
      break
    case 90: if (fx.saveType === 0) fx.save += conSave(c[0x14]); break
    case 91: if (fx.spell === 15) { fx.dmg = 0; h.print(`${h.name(c)} is unaffected`) } else if (fx.dmgType & 4) fx.dmg = 0; break
    case 93: if (fx.dmgType & 1) fx.dmg = Math.floor(fx.dmg / 2); break
    case 94: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (w && [0x80, 1].includes(h.weaponKind(w.raw[0x2e]))) fx.dmg = Math.floor(fx.dmg / 2); break }
    case 95: if (removal && c[0x10d]) h.setStatus(c, 6, `${h.name(c)} Falls dead`); break
    case 96: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if (!w || (w.raw[0x32] <= 0 && w.raw[0x31] !== 0xb1)) fx.dmg = 0; break }
    case 97: if (fx.saveType === 2 || fx.saveType === 4) fx.save += conSave(c[0x14]); break
    case 98: c[0x11b] = Math.min(c[0x32], c[0x11b] + 3); break
    case 99: {
      const n = c[0x10c] === 5 ? 6 - h.rec(c, 0xe) : c[0x10c] === 4 ? 6 : 0
      if (n > 0 && h.revive(c, n)) { addRaw(h, c, 95, h.roll(1, 4) + 1, 0, 1); await removeEffect(h, c, eff) }
      break
    }
    case 100: if (!(fx.dmgType & 0x11)) addRaw(h, c, 102, h.roll(3, 6), 0, 1); break
    case 101: if (!has(h, c, 98) && !has(h, c, 59)) addRaw(h, c, 59, 3, 0, 1); break
    case 102: if (removal && !h.revive(c, c[0x32])) addRaw(h, c, 102, 1, 0, 1); break
    case 103: eff.flag = 0; h.print(`${h.name(c)} Turns gaseous and escapes`); c[0x10c] = 3; c[0x10d] = 0; break
    case 104: deflect(h, c, 60); break
    case 105: case 106: { // magic resistance 50 % / 15 %
      const a = h.current()
      const lvl = a ? Math.max(a[0x96], a[0x9b], 1) : 1
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
    case 119: { const a = h.current(); const w = a ? weaponOf(h, a) : null; if ((!w || w.raw[0x32] === 0) && a && (a[0x2e] > 0 || a[0x73] < 4)) fx.dmg = 0; break }
    case 120: { const a = h.current(); if (a && h.itemsOf(a).some((it) => it.ready && (it.raw[0x2e] === 0x57 || it.raw[0x2e] === 0x58))) deflect(h, c, 50); break }
    case 121: {
      const t = h.targetOf(c)
      if (t && t[0x10d] && h.roll(1, 100) <= 25 && h.distance(c, t) < 4) {
        h.endTurn(c)
        h.print(`${h.name(c)} Spits Acid`)
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
