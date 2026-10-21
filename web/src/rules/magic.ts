// Casting outside combat (spec/spells.md, "Casting outside combat" and "Spell effects").
import { R, classLevel } from '../games/rules'
import type { Engine } from '../vm/engine'
import type { Spell } from '../data/spells'
import { recalc } from './equip'
import { heal } from './camp'
import { WorldHost } from './worldfx'
import { addEffect as fxAdd } from './effects'
import { amount, castShared, spellSpec } from './spellkinds'
import { game } from '../games/profile'
import type { Amount } from '../games/spellrules'
import { F } from '../games/fields'
import { T } from '../games/tables'

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

/**
 * Duration in minutes (FUN_4e53_07d6): the game's special cases (games/spellrules.ts), else d0 + d1 ×
 * level. A case naming a `record` takes d0 and d1 from that spell record instead, read from START.EXE
 * (CotAB Entangle's Duration(0x88), a bug kept; I: at the cast's level, which the original leaves
 * uninitialised for that record's class byte unless its caster gate or an item gives 6, as here)
 */
export function duration(e: Engine, s: Spell, level: number, inCombat = false): number {
  const special = game().spells.durations[s.id]
  if (special && 'record' in special) {
    const img = e.startImage
    if (!img) return s.duration[0] + s.duration[1] * level
    const at = T.ds + T.spellRecords.at + special.record * T.spellRecords.row
    return img[at + 4] + img[at + 5] * level
  }
  if (special) {
    const r = !inCombat && special.outside ? special.outside : special
    return e.roll(r.n, r.d) * (r.mul ?? 1) + (r.add ?? 0)
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
  // CotAB 0x45373 (R.casting.miscast): a caster with the effect who rolls 1 miscasts; nothing else, the spell kept
  const mis = R.casting.miscast
  if (mis && e.effectsOf(caster).some((x) => x.type === mis.effect) && e.roll(1, mis.sides) === 1) return [`${name(caster)} miscasts ${s.name}.`]
  if (!fromItem) forget(caster, s.id)
  if (s.name) out.push(`${name(caster)} casts ${s.name}.`)
  const dur = duration(e, s, L)
  const p = spellSpec(s.id)
  if (p.k === 'heal') {
    // out of combat the line always follows (FUN_10ba_234a), the healing revives (no combat flag)
    if (first) {
      heal(first, e.effectsOf(first), amount(p.amount as Amount, L, (n, d) => e.roll(n, d)).total, false)
      out.push(`${name(first)} is ${first[F.hp] === first[F.maxHp] ? 'fully' : 'partially'} healed.`)
    }
  } else if (!(await castShared({ h, e, caster, s, L, dur, targets }, p))) {
    // the kinds that need the battlefield add the spell's effect at power L through FUN_5216_1656, as Apply does
    if (s.effect) for (const c of targets) await fxAdd(h, c, s.effect, dur, L, 0, 0, false, false, p.msg ?? '')
  }
  for (const c of targets) recalc(c, e.itemsOf(c), t)
  return out
}

/** The spell id an item's +0x3D names (PoR FUN_4894_1a8a 0x3A468, CotAB 0x3FA0D; `spells.itemSpell`). */
export function itemSpellId(v: number): number {
  const { mask, above, minus } = R.spells.itemSpell
  const id = v & mask
  return id > above ? id - minus : id
}

/**
 * Spells an item can cast with Use (FUN_4894_1a8a, CotAB 0x3F9F1): a scroll lists its spells; another
 * item casts item[0x3D] (`itemSpellId`) when item[0x3E] < 0x80. Empty if the item casts nothing.
 */
export function itemSpells(it: import('../data/items').Item, scroll: boolean): number[] {
  if (scroll) return it.props.filter((p) => p > 0).map((p) => p & 0x7f)
  const [, id, flags] = it.props
  if (id > 0 && flags < 0x80) return [itemSpellId(id)]
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
