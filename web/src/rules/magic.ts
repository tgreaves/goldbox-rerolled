// Casting outside combat (spec/spells.md, "Casting outside combat" and "Spell effects").
import type { Engine } from '../vm/engine'
import type { Spell } from '../data/spells'
import type { Effect } from '../data/effects'
import { recalc } from './equip'
import { heal } from './camp'

/** Caster level (FUN_10ba_26c2): cleric level, magic-user level, 12 for item-only spells; 6 from an item. */
export function casterLevel(c: Uint8Array, s: Spell, fromItem = false): number {
  if (fromItem && s.cls <= 1) return 6
  return s.cls === 0 ? c[0x96] : s.cls === 1 ? c[0x9b] : 12
}

/** Duration in minutes (FUN_4e53_07d6). */
export function duration(e: Engine, s: Spell, level: number): number {
  switch (s.id) {
    case 40: return e.roll(1, 6) * 10
    case 57: case 61: return e.roll(5, 4)
    case 59: return e.roll(1, 4) * 10 + 40
    case 63: return (e.roll(1, 10) + 10) * 10
    case 67: return 1440
  }
  return s.duration[0] + s.duration[1] * level
}

/** Remove the first memorised copy of a spell (FUN_10ba_148b). */
export function forget(c: Uint8Array, id: number) {
  for (let k = 0; k < 21; k++) if (c[0x17 + k] === id) { c[0x17 + k] = 0; return }
}

/** Add an effect (FUN_5216_1656): replace one of the same type only if the new duration is longer or 0. */
export function addEffect(fx: Effect[], type: number, minutes: number, power: number, flag = 0) {
  const old = fx.find((f) => f.type === type)
  if (old && (minutes === 0 || minutes > old.duration)) { old.duration = minutes; old.power = power; old.flag = flag; return }
  fx.push({ type, duration: minutes, power, flag })
}

const removeEffects = (fx: Effect[], types: number[]) => {
  let n = 0
  for (let i = fx.length - 1; i >= 0; i--) if (types.includes(fx[i].type)) { fx.splice(i, 1); n++ }
  return n
}

/** Who a spell can be aimed at outside combat: the caster, or a chosen party member, or the whole party. */
export function targetKind(s: Spell): 'self' | 'one' | 'party' {
  if (s.target === 0) return 'self'
  if (s.target >= 8 && s.target <= 14) return 'party'
  return 'one'
}

/**
 * Cast a spell outside combat (FUN_4e53_0c20 with the out-of-combat target hook). The caller has
 * already refused combat-only spells (side byte 0). Returns the messages to print.
 */
export function castOutside(e: Engine, caster: Uint8Array, s: Spell, targets: Uint8Array[], fromItem = false): string[] {
  const t = e.items!
  const L = casterLevel(caster, s, fromItem)
  const out: string[] = []
  const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(1, 1 + c[0]))
  const first = targets[0]
  if (!fromItem) forget(caster, s.id)
  out.push(`${name(caster)} casts ${s.name}.`)
  const dur = duration(e, s, L)
  switch (s.id) {
    case 3: case 62: { // Cure Light Wounds, Potion of Healing
      if (!first) break
      const fx = e.effectsOf(first)
      const amount = s.id === 3 ? e.roll(1, 8) : e.roll(2, 4) + 2
      const before = first[0x11b]
      heal(first, fx, amount, false)
      out.push(`${name(first)} is ${first[0x11b] === first[0x32] ? 'fully' : 'partially'} healed.`)
      void before
      break
    }
    case 26: { // Slow Poison
      const fx = first ? e.effectsOf(first) : []
      if (!first || !fx.some((f) => f.type === 0x37) || first[0x10c] === 1) break
      if (first[0x11b] === 0) first[0x11b] = 1
      addEffect(fx, 0x16, dur, 0xff, 1)
      if (first[0x10c] === 4 || first[0x10c] === 5) first[0x10c] = 0
      addEffect(fx, 0x0f, 10, 0xff)
      break
    }
    case 37: if (first) removeEffects(e.effectsOf(first), [0x21]); break
    case 39: if (first) removeEffects(e.effectsOf(first), [0x22, 0x2b, 0x2c, 0x1f, 0x32, 0x39]); break
    case 43: { // Remove Curse: the curse effect, else the first cursed item
      if (!first) break
      if (!removeEffects(e.effectsOf(first), [0x24])) {
        const it = e.itemsOf(first).find((x) => x.cursed)
        if (it) it.raw[0x36] = 0
      }
      break
    }
    case 14: { // Friends: CHA + 2d4 (cap 25), effect power = old CHA
      if (!first) break
      const old = first[0x15]
      first[0x15] = Math.min(25, old + e.roll(2, 4))
      addEffect(e.effectsOf(first), 0x0e, dur, old, 1)
      break
    }
    case 32: if (first) addEffect(e.effectsOf(first), 0x1c, dur, e.roll(1, 4)); break
    case 35: { // Strength
      if (!first) break
      const fighter = first[0x98] > 0
      const bonus = fighter ? e.roll(1, 8) : first[0x96] > 0 || first[0x9c] > 0 ? e.roll(1, 6) : e.roll(1, 4)
      const old = first[0x10], oldPct = first[0x16]
      const str = old + bonus
      if (str > 18) { first[0x10] = 18; if (fighter) first[0x16] = Math.min(100, oldPct + 10 * (str - 18)) }
      else first[0x10] = str
      addEffect(e.effectsOf(first), 0x26, dur, old, 1)
      break
    }
    case 12: { // Enlarge: STR 18 with % by level
      if (!first) break
      const pct = [0, 0, 1, 51, 76, 91, 100][Math.min(L, 6)]
      addEffect(e.effectsOf(first), 0x0c, dur, first[0x10], 1)
      first[0x10] = 18
      first[0x16] = pct
      break
    }
    default:
      if (s.effect) for (const c of targets) addEffect(e.effectsOf(c), s.effect, dur, L)
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
