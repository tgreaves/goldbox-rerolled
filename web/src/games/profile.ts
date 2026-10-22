// The game profiles and the active one (docs/multi-game.md). Exactly one game is active: the one
// whose files were imported, set once at start-up.
import { POR } from './por'
import { COAB } from './coab'
import { SOTSB } from './sotsb'
import type { GameProfile } from './types'
import { useFields } from './fields'
import { useTables } from './tables'
import { useRules } from './rules'
import { useJournal } from './journal'

export type { GameProfile } from './types'
export { POR, COAB, SOTSB }
export { F } from './fields'
export { T } from './tables'

export const GAMES: GameProfile[] = [POR, COAB, SOTSB]

const LAST_KEY = 'goldbox.game'

/** Whether game g keeps a file of this name from an imported folder. */
export function wants(g: GameProfile, name: string): boolean {
  const n = name.toUpperCase()
  return g.keep.some((r) => r.test(n))
}

/**
 * Which game a set of files belongs to: by its configuration file, else by the game with the most of its
 * marker files present (the first in GAMES on a tie). Games share some files (SotSB has PoR's GEO1 and
 * CotAB's SKY), so one marker alone does not decide.
 */
export function detect(names: Iterable<string>): GameProfile | undefined {
  const has = new Set([...names].map((n) => n.toUpperCase()))
  const byConfig = GAMES.find((g) => has.has(g.config))
  if (byConfig) return byConfig
  let best: GameProfile | undefined, most = 0
  for (const g of GAMES) {
    const n = g.markers.filter((m) => has.has(m)).length
    if (n > most) { best = g; most = n }
  }
  return best
}

export function byId(id: string | null | undefined): GameProfile | undefined {
  return GAMES.find((g) => g.id === id)
}

let active: GameProfile = POR

/** The active game. Pool of Radiance until start-up (or a test) chooses another. */
export function game(): GameProfile {
  return active
}

export function setGame(g: GameProfile) {
  active = g
  useFields(g.fields)
  useTables(g.tables)
  useRules(g.rules)
  useJournal(g.journal)
  try { localStorage.setItem(LAST_KEY, g.id) } catch { /* this page only */ }
}

/** The game played last on this device, if any. */
export function lastGame(): GameProfile | undefined {
  try { return byId(localStorage.getItem(LAST_KEY)) } catch { return undefined }
}
