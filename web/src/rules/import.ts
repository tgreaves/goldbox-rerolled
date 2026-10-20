// Bringing a character from another game (games/imports.ts): CotAB's "Pool" import (323c:14b3), field by
// field through both games' maps, then the target's class bonuses worked out again (5047:03c6).
import type { CharacterImport } from '../games/imports'
import { GAMES } from '../games/profile'
import { F } from '../games/fields'
import { T } from '../games/tables'
import { R } from '../games/rules'
import { parseEffects, effectsFile } from '../data/effects'
import { derive } from './training'
import { keepBase, type Tables } from './chargen'

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
  // stats clamped to the race (and, for STR, sex) limits: min first, then max
  const lim = T.raceLimits.at + c[F.race] * T.raceLimits.row
  const sex = c[F.gender] ? 1 : 0
  for (let i = 0; i < 6; i++) {
    let v = raw[S.stat[i]]
    if (imp.clampStats) {
      const [lo, hi] = i === 0 ? [t.b(lim + sex), t.b(lim + 2 + sex)] : [t.b(lim + 4 + 2 * i), t.b(lim + 5 + 2 * i)]
      v = Math.min(Math.max(v, lo), hi)
    }
    c[F.stat[i]] = v
  }
  // exceptional STR, clamped to the race and sex cap (IMP-070: the original compared that cap with base
  // STR and wrote it there, so a converted human fighter's base STR became 100)
  const cap = t.b(lim + 4 + sex)
  c[F.strPct] = imp.clampStats ? Math.min(raw[S.strPct], cap) : raw[S.strPct]
  keepBase(c)
  if (imp.hpLevelFromHitDice && F.hpLevel >= 0) c[F.hpLevel] = c[F.hitDice]
  // money: what a new character of this game gets (CotAB 300 platinum); no items
  const m = R.startMoney
  if (m.fixed !== null) { c[F.money + 2 * m.coin] = m.fixed & 0xff; c[F.money + 2 * m.coin + 1] = m.fixed >> 8 }
  c[F.itemCount] = 0
  // the class mask (5047:03c6) and the derived statistics: THAC0, attacks, slots, saves, thief skills
  let mask = 0
  for (let k = 0; k < 8; k++) if (c[F.levels + k] > 0) mask |= t.b(T.classBits.at + k)
  c[F.itemMask] = mask
  derive(t, c)
  const fx = parseEffects(effects).filter((e) => imp.keepEffects.includes(e.type))
  return { sav: c, spc: effectsFile(fx) }
}
