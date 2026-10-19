// The game profiles and the active one (docs/multi-game.md). Exactly one game is active: the one
// whose files were imported, set once at start-up.
import { POR } from './por'
import { COAB } from './coab'
import type { GameProfile } from './types'

export type { GameProfile } from './types'
export { POR, COAB }

export const GAMES: GameProfile[] = [POR, COAB]

const LAST_KEY = 'goldbox.game'

/** Which game a set of files belongs to: by its configuration file, else by files only it has. */
export function detect(names: Iterable<string>): GameProfile | undefined {
  const has = new Set([...names].map((n) => n.toUpperCase()))
  return GAMES.find((g) => has.has(g.config)) ?? GAMES.find((g) => g.markers.some((m) => has.has(m)))
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
  try { localStorage.setItem(LAST_KEY, g.id) } catch { /* this page only */ }
}

/** The game played last on this device, if any. */
export function lastGame(): GameProfile | undefined {
  try { return byId(localStorage.getItem(LAST_KEY)) } catch { return undefined }
}
