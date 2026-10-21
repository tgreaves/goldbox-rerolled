// The current game's messages (games/stringtable.ts holds the addresses; spec/D-appendices/strings.md §4).
import { game } from './profile'
import { text } from '../data/gametext'
export type { StringId, Strings } from './stringtable'
import type { StringId } from './stringtable'

/**
 * The current game's message `id`, read from its files. A message the game has no address for shows as
 * `#id`, one that cannot be read (no START.EXE or GAME.OVR) as `#` and its address.
 */
export function msg(id: StringId): string {
  const a = game().strings[id]
  return a === undefined ? `#${id}` : text(a)
}

/** whether the current game prints message `id` at all */
export const hasMsg = (id: StringId) => game().strings[id] !== undefined
