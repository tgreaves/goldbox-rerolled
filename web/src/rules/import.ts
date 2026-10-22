// Bringing a character from another game (games/imports.ts, spec/B-model/procedures.md §13): CotAB's "Pool"
// import (323c:14b3), field by field through both games' maps, then the target's class bonuses worked out again
// (5047:03c6); SotSB's "Curse" import (0x405E3), its fields as copied.
import type { CharacterImport } from '../games/imports'
import { GAMES } from '../games/profile'
import { F } from '../games/fields'
import { T } from '../games/tables'
import { R } from '../games/rules'
import { parseEffects, effectsFile } from '../data/effects'
import { derive } from './training'
import { keepBase, type Tables } from './chargen'
import { currentLevel } from './dualclass'

/** A source record this import takes: the source game's size, and not an NPC. */
export function importable(imp: CharacterImport, raw: Uint8Array): boolean {
  const src = GAMES.find((g) => g.id === imp.from)!.fields
  return raw.length === src.size && raw[src.morale] <= imp.maxMorale
}

/** Convert a source record (and its effect file, when found by name) to the active game's. */
export function convert(imp: CharacterImport, raw: Uint8Array, effects: Uint8Array | undefined, t: Tables): { sav: Uint8Array; spc: Uint8Array } {
  const S = GAMES.find((g) => g.id === imp.from)!.fields
  const c = new Uint8Array(F.size)
  for (const [field, n] of imp.copy) {
    const from = S[field] as number, to = F[field] as number
    if (from < 0 || to < 0) continue
    for (let i = 0; i < n; i++) c[to + i] = raw[from + i]
  }
  // known spells: byte known + id, for the source's ids
  for (let id = 1; id <= S.knownCount && id <= F.knownCount; id++) c[F.known + id] = raw[S.known + id]
  for (const id of imp.forget) c[F.known + id] = 0
  if (imp.trimName) {
    let nm = String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + Math.min(c[F.name], 15))).replace(/ +$/, '')
    if (nm.startsWith(' ')) nm = nm.slice(1)
    c.fill(0, F.name, F.name + 16)
    c[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
  }
  if (imp.raceMap) c[F.race] = imp.raceMap[raw[S.race]] ?? 0
  // stats clamped to the race (and, for STR, sex) limits: min first, then max
  const lim = T.raceLimits.at + c[F.race] * T.raceLimits.row
  const sex = c[F.gender] ? 1 : 0
  if (imp.stats === 'strMax') {
    // both copied (0x406DD), then base STR lowered to the race and sex maximum (0x40E6A)
    for (let i = 0; i < 6; i++) { c[F.stat[i]] = raw[S.stat[i]]; c[F.baseStat[i]] = raw[S.baseStat[i]] }
    c[F.strPct] = raw[S.strPct]
    c[F.baseStrPct] = raw[S.baseStrPct]
    c[F.baseStat[0]] = Math.min(c[F.baseStat[0]], t.b(lim + 2 + sex))
  } else {
    for (let i = 0; i < 6; i++) {
      const [lo, hi] = i === 0 ? [t.b(lim + sex), t.b(lim + 2 + sex)] : [t.b(lim + 4 + 2 * i), t.b(lim + 5 + 2 * i)]
      c[F.stat[i]] = Math.min(Math.max(raw[S.stat[i]], lo), hi)
    }
    // exceptional STR, clamped to the race and sex cap (IMP-070: the original compared that cap with base
    // STR and wrote it there, so a converted human fighter's base STR became 100)
    c[F.strPct] = Math.min(raw[S.strPct], t.b(lim + 4 + sex))
    keepBase(c)
  }
  if (imp.hpLevelFromHitDice && F.hpLevel >= 0) c[F.hpLevel] = c[F.hitDice]
  // money: what a new character of this game gets (CotAB 300 platinum); no items
  const m = R.startMoney
  if (m.fixed !== null) { c[F.money + 2 * m.coin] = m.fixed & 0xff; c[F.money + 2 * m.coin + 1] = m.fixed >> 8 }
  c[F.itemCount] = 0
  if (imp.recompute) {
    // the class mask (5047:03c6) and the derived statistics: THAC0, attacks, slots, saves, thief skills
    let mask = 0
    for (let k = 0; k < F.classCount; k++) if (c[F.levels + k] > 0) mask |= t.b(T.classBits.at + k)
    c[F.itemMask] = mask
    derive(t, c)
  }
  const fx = parseEffects(effects).filter((e) => imp.keepEffects.includes(e.type))
  // 0x410DF: a class level, or the former class (+0x101) while former levels count (0x573EB: the current
  // level above hpLevel, for the race that changes class)
  const former = R.dualClass !== null && c[F.race] === R.dualClass.race && F.hpLevel >= 0 && currentLevel(c) > c[F.hpLevel]
  for (const g of imp.grants) {
    if (!(c[F.levels + g.level] > 0 || (c[F.misc86] === g.former && former))) continue
    if (g.abilityUses && F.abilityUses >= 0) c[F.abilityUses] = 1
    fx.push({ type: g.effect, duration: 0, power: 0xff, flag: 0 })
  }
  return { sav: c, spc: effectsFile(fx) }
}
