// Class abilities used from the character sheet, by the game's rules (R.paladin): CotAB's paladin
// Lay on Hands and Cure Disease (View menu, image 0x3D530: availability 0x35F0 / 0x3655, use 0x36D7 /
// 0x37EC, refill on the weekly effect's removal 0x27350 + 0x28EF).
import { F } from '../games/fields'
import { R, classLevel, formerLevelsCount } from '../games/rules'
import { T } from '../games/tables'
import type { Engine } from '../vm/engine'
import { addRaw, type FxHost } from './effects'
import { msg } from '../games/strings'

export type Ability = 'layOnHands' | 'cureDisease'
const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))

/** A paladin (class 3), or a dual-class former paladin whose old levels count. */
function paladin(c: Uint8Array): boolean {
  return c[F.cls] === 3 || (F.prevLevels >= 0 && c[F.prevLevels + 3] > 0 && formerLevelsCount(c))
}

/** The abilities `c` can use now (outside combat, status Okay). */
export function abilities(e: Engine, c: Uint8Array, inCombat: boolean): Ability[] {
  const p = R.paladin
  if (!p || inCombat || c[F.status] !== 0 || !paladin(c)) return []
  const out: Ability[] = []
  if (!e.effectsOf(c).some((x) => x.type === p.layOnHands.effect)) out.push('layOnHands')
  if (F.abilityUses >= 0 && c[F.abilityUses] > 0) out.push('cureDisease')
  return out
}

export const abilityName: Record<Ability, string> = { layOnHands: 'Lay on Hands', cureDisease: 'Cure Disease' }

/** The disease effects (T.diseases, entries 1–6; CotAB DS:082A holds the same six). */
export function diseases(e: Engine): number[] {
  const img = e.startImage
  return img ? Array.from({ length: 6 }, (_, i) => img[T.ds + T.diseases.at + 1 + i]) : []
}

export function diseased(e: Engine, t: Uint8Array): boolean {
  const ds = diseases(e)
  return e.effectsOf(t).some((x) => ds.includes(x.type))
}

/** Use an ability on target t; the lines to print. Cure Disease on someone not diseased only when `anyway`. */
export function useAbility(h: FxHost, e: Engine, c: Uint8Array, a: Ability, t: Uint8Array): string[] {
  const p = R.paladin!
  const level = classLevel(c, 3)
  if (a === 'layOnHands') {
    const before = t[F.hp]
    const ok = [0, 1, 4, 5].includes(t[F.status]) && t[F.hp] < t[F.maxHp] && h.heal(t, p.layOnHands.perLevel * level, false)
    addRaw(h, c, p.layOnHands.effect, p.layOnHands.minutes, 0, 0) // the day's wait, even when it did nothing
    return [ok && t[F.hp] !== before ? `${name(t)}${msg('feelsBetter')}` : `${name(t)}${msg('handsUnaffected')}`]
  }
  const ds = diseases(e), list = e.effectsOf(t)
  for (const type of ds) { const i = list.findIndex((x) => x.type === type); if (i >= 0) list.splice(i, 1) } // one of each
  if (c[F.abilityUses] > 0) c[F.abilityUses]--
  if (!e.effectsOf(c).some((x) => x.type === p.cureDisease.effect)) addRaw(h, c, p.cureDisease.effect, p.cureDisease.minutes, 0, 1)
  return [`${name(t)}${msg('diseaseCured')}`]
}

/** The weekly effect's removal (0x27350 + 0x28EF): the uses back to (level − 1) div 5 + 1. */
export function refillUses(c: Uint8Array) {
  const p = R.paladin
  if (!p || F.abilityUses < 0) return
  c[F.abilityUses] = Math.floor((classLevel(c, 3) - 1) / p.cureDisease.levelsPerUse) + 1
}
