// Casting outside combat (spec/spells.md, "Casting outside combat" and "Spell effects").
import { R, classLevel } from '../games/rules'
import type { Engine } from '../vm/engine'
import type { Spell } from '../data/spells'
import { recalc } from './equip'
import { heal } from './camp'
import { WorldHost } from './worldfx'
import { addEffect as fxAdd, addRaw } from './effects'
import { sharedSpell } from './spellfx'
import { F } from '../games/fields'

/**
 * The line each spell prints on a creature its effect took hold on (FUN_5216_1656's message, passed by the
 * 4e53 handlers; spec/combat.md "Combat visuals": in combat it comes with the sparkle and sound 4).
 */
export const SPELL_MSG: Record<number, string> = {
  1: 'is Blessed', 2: 'is Cursed', 5: 'is affected', 11: 'is affected', 18: 'is affected', 22: 'is affected', 29: 'is affected',
  26: 'is affected', 41: 'is affected', 46: 'is affected',
  6: 'is protected', 7: 'is protected', 16: 'is protected', 17: 'is protected', 52: 'is protected', 53: 'is protected', 54: 'is protected',
  8: 'is cold-resistant', 24: 'is fire resistant', 12: 'is stronger', 35: 'is stronger', 59: 'is stronger', 13: 'has been reduced',
  14: 'is friendly', 19: 'is shielded', 21: 'falls asleep', 23: 'is held', 49: 'is held', 25: 'is silenced', 10: 'is charmed', 27: 'is charmed',
  30: 'is invisible', 50: 'is invisible', 63: 'is invisible', 32: 'is duplicated', 33: 'is weakened', 36: 'is animated', 38: 'is blind',
  40: 'is diseased', 42: 'is praying', 44: 'has been cursed!', 45: 'is blinking', 48: 'is Hasted', 55: 'is Slowed', 56: 'is restored',
  57: 'is Speedy', 67: 'is Reading',
}

/** Caster level (PoR FUN_10ba_26c2, CotAB 0x4F8BF): the game's terms for the spell class (R.casterTerms),
 *  12 for item-only spells, 6 when nothing qualifies under the game's gate, 6 from an item. */
export function casterLevel(c: Uint8Array, s: Spell, fromItem = false): number {
  const gate = R.casterGate
  const gated = gate !== null && Object.entries(gate.atLeast).every(([k, min]) => ((c[F.levels + Number(k)] << 24) >> 24) < min)
  const terms = R.casterTerms[s.cls]
  let L = gated ? gate.level : terms ? Math.max(0, ...terms.map((t) => classLevel(c, t.cls) - t.minus)) : 12
  if (fromItem && s.cls !== R.spells.item) L = 6
  return L
}

/** Duration in minutes (FUN_4e53_07d6). */
export function duration(e: Engine, s: Spell, level: number, inCombat = false): number {
  switch (s.id) {
    case 63: return inCombat ? e.roll(2, 10) * 10 : (e.roll(1, 10) + 10) * 10
    case 40: return e.roll(1, 6) * 10
    case 57: case 61: return e.roll(5, 4)
    case 59: return e.roll(1, 4) * 10 + 40
    case 67: return 1440
  }
  return s.duration[0] + s.duration[1] * level
}

/** Remove the first memorised copy of a spell (FUN_10ba_148b). */
export function forget(c: Uint8Array, id: number) {
  for (let k = 0; k < F.memorisedCount; k++) if (c[F.memorised + k] === id) { c[F.memorised + k] = 0; return }
}

/** Who a spell can be aimed at outside combat, by its side byte (FUN_4e53_0c20): 1 the caster, 2 one picked, 4 the party. */
export function targetKind(s: Spell): 'self' | 'one' | 'party' {
  if (s.side === 4) return 'party'
  if (s.side === 2) return 'one'
  return 'self'
}

/**
 * Cast a spell outside combat (FUN_4e53_0c20 with the out-of-combat target hook). The caller has
 * already refused combat-only spells (side byte 0). Returns the messages to print.
 */
export async function castOutside(e: Engine, caster: Uint8Array, s: Spell, targets: Uint8Array[], fromItem = false): Promise<string[]> {
  const t = e.items!
  const L = casterLevel(caster, s, fromItem)
  const out: string[] = []
  const h = new WorldHost(e, (m) => out.push(m))
  const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
  const first = targets[0]
  if (!fromItem) forget(caster, s.id)
  if (s.name) out.push(`${name(caster)} casts ${s.name}.`)
  const dur = duration(e, s, L)
  switch (s.id) {
    case 3: case 62: { // Cure Light Wounds, Potion of Healing
      if (!first) break
      const amount = s.id === 3 ? e.roll(1, 8) : e.roll(2, 4) + 2
      heal(first, e.effectsOf(first), amount, false)
      out.push(`${name(first)} is ${first[F.hp] === first[F.maxHp] ? 'fully' : 'partially'} healed.`)
      break
    }
    case 32: if (first) addRaw(h, first, 0x1c, dur, e.roll(1, 4), 0); break // Mirror Image
    default:
      if (await sharedSpell(h, e, caster, s, L, dur, targets)) break
      // the plain handlers: the effect at power L through FUN_5216_1656, with the spell's line
      if (s.effect) for (const c of targets) await fxAdd(h, c, s.effect, dur, L, 0, 0, false, false, SPELL_MSG[s.id] ?? '')
  }
  for (const c of targets) recalc(c, e.itemsOf(c), t)
  return out
}

/**
 * Spells an item can cast with Use (FUN_4894_1a8a): a scroll lists its spells; another item casts
 * item[0x3D] (ids above 0x38 lose 0x17) when item[0x3E] < 0x80. Empty if the item casts nothing.
 */
export function itemSpells(it: import('../data/items').Item, scroll: boolean): number[] {
  if (scroll) return it.props.filter((p) => p > 0).map((p) => p & 0x7f)
  const [, id, flags] = it.props
  if (id > 0 && flags < 0x80) return [id > 0x38 ? id - 0x17 : id]
  return []
}

/** After a cast from an item: a scroll loses that spell; a charged stack loses a unit, a single item a charge (gone at 0). */
export function spendUse(items: import('../data/items').Item[], it: import('../data/items').Item, scroll: boolean, id: number) {
  if (scroll) {
    for (let j = 0; j < 3; j++) if ((it.raw[0x3c + j] & 0x7f) === id) { it.raw[0x3c + j] = 0; break }
    return
  }
  if (it.raw[0x3c] === 0) return
  if (it.count > 1) it.count--
  else if (--it.raw[0x3c] === 0) items.splice(items.indexOf(it), 1)
}
