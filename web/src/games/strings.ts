// The current game's messages and menus (games/stringtable.ts holds the addresses;
// spec/D-appendices/strings.md §4).
import { game } from './profile'
import { text, textOrNull } from '../data/gametext'
export type { StringId, Strings, MenuId, Menus } from './stringtable'
import type { StringId, MenuId } from './stringtable'

/**
 * The current game's message `id`, read from its files. A message the game has no address for shows as
 * `#id`, one that cannot be read (no START.EXE or GAME.OVR) as `#` and its address.
 */
export function msg(id: StringId): string {
  const a = game().strings[id]
  return a === undefined ? `#${id}` : Array.isArray(a) ? a.map(text).join('') : text(a)
}

/** whether the current game prints message `id` at all */
export const hasMsg = (id: StringId) => game().strings[id] !== undefined

/** a port menu's options: a prompt, a vertical list, a line under each choice, each choice's hot keys (else its first letter) */
/** … and `cancel`: Escape answers it with no choice (-1; `ask` gives ''), for a menu the original leaves on any other key */
/** `again`: the prompt redraws the one the same menu printed last, as the original redraws its line, rather than adding a line */
export interface MenuOpts { prompt?: string; vertical?: boolean; notes?: string[]; keys?: string[]; cancel?: boolean; again?: boolean }

/** One choice of a menu: its text as the game has it, and its hot keys (capitals and digits). */
export interface MenuWord { text: string; key: string }

const HOT = /[A-Z0-9]/

/**
 * A menu string split as the original splits it (strings.md §4.1). The ECL menu rule first (PoR
 * FUN_2fea_156d, CotAB 0x21063), for a string with `~`: every capital or digit is lowered by 0x20,
 * each `~` dropped and the character after it raised; those characters are the keys. Then the menu
 * routine's rule (PoR FUN_53aa_00cb, CotAB 0x5194A): a word begins at every capital or digit, and the
 * key pressed (upper-cased) chooses the word that begins with it. Here each space-separated run is
 * one choice, its capitals and digits its hot keys (a run with none, which no key reaches, is left out).
 */
export function menuWords(s: string): MenuWord[] {
  if (s.includes('~')) {
    let t = ''
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (c === '~') { if (i + 1 < s.length) t += s[++i].toUpperCase(); continue }
      t += HOT.test(c) ? String.fromCharCode(c.charCodeAt(0) + 0x20) : c
    }
    s = t
  }
  return s.split(' ').filter((w) => HOT.test(w)).map((w) => ({ text: w, key: [...w].filter((c) => HOT.test(c)).join('') }))
}

/**
 * The current game's menu `id`, read from its files and split (`menuWords`). A game without the menu
 * gives none; one that cannot be read gives one word, `#` and its address, with no key (choosing it
 * does what Esc does).
 */
export function menu(id: MenuId): MenuWord[] {
  const a = game().menus[id]
  if (a === undefined) return []
  const s = textOrNull(a)
  return s === null ? [{ text: text(a), key: '' }] : menuWords(s)
}

/**
 * The word of menu `id` whose hot key is `key` (the original's callers act on the key). When the menu
 * cannot be read: `#` and its address, with that key; when the game has no such word: `#id`.
 */
export function word(id: MenuId, key: string): MenuWord {
  const w = menu(id)
  if (w.length === 1 && w[0].key === '' && w[0].text.startsWith('#')) return { text: w[0].text, key }
  return w.find((x) => x.key.includes(key)) ?? { text: `#${id}`, key }
}

/** a menu function's own text (the party screen's function table: one string per entry, its first letter the key) */
export function entry(id: MenuId): MenuWord {
  const a = game().menus[id]
  if (a === undefined) return { text: `#${id}`, key: '' }
  const s = textOrNull(a)
  return s === null ? { text: text(a), key: '' } : { text: s.trim(), key: s.trim()[0]?.toUpperCase() ?? '' }
}

/**
 * The choice Escape makes in a port menu of these labels (spec/C-port/ui-contract.md §7): the menu's way
 * back, read from the game's own words, never a word of the port's. The game's Exit (the aim menu's,
 * every game has it); No when the menu is the game's Yes and No; the only choice of a one-choice prompt
 * ("press any key"). null: the menu has no way back (a story choice, a list of slots) and Escape does
 * nothing. A menu that the original leaves on any other key passes `cancel` and is answered -1 instead.
 */
export function backChoice(labels: string[]): number | null {
  if (labels.length === 1) return 0
  const up = labels.map((l) => l.trim().toUpperCase())
  const exit = up.lastIndexOf(word('aim', 'E').text.toUpperCase())
  if (exit >= 0) return exit
  const yes = word('yesNo', 'Y').text.toUpperCase(), no = up.indexOf(word('yesNo', 'N').text.toUpperCase())
  return no >= 0 && up.includes(yes) ? no : null
}

/** what a port menu takes: the labels (the game's words in capitals) and their hot keys */
export const items = (w: MenuWord[]) => ({ labels: w.map((x) => x.text.toUpperCase()), keys: w.map((x) => x.key) })

/**
 * Show `w` with a port menu (`menu(labels, { keys, … })`) and give back the hot key of the choice
 * ('' for a word without one, or for Esc).
 */
export async function ask(show: (labels: string[], opts: MenuOpts) => Promise<number>, w: MenuWord[], opts: MenuOpts = {}): Promise<string> {
  const { labels, keys } = items(w)
  const i = await show(labels, { ...opts, keys })
  return w[i]?.key[0] ?? ''
}
