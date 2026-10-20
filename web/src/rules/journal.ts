// The Adventurer's Journal (IMP-055): the journal entries, proclamations and tavern tales the game
// refers to by number, from the active game's printed journal (games/journal.ts: PoR's via the Pool of
// Radiance Wiki, CotAB's via the Gold Box Wiki). The scripts announce each one in their text; the port
// notes it as revealed.
import { JOURNAL } from '../games/journal'

export { JOURNAL }
export type { JournalEntry, Proclamation, Tale } from '../games/journal'

/** Roman numeral value, for ordering proclamations. */
export function roman(s: string): number {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]] ?? 0, b = v[s[i + 1]] ?? 0
    n += a < b ? -a : a
  }
  return n
}

/**
 * Ids revealed by a screen of game text: "journal:n" for "…AS ENTRY 30" / "UNDER ENTRIES 23 AND 14" /
 * "(ENTRY 33)", "tale:n" for "YOU OVERHEAR TAVERN TALE 7" / "TAVERN TALE #12" (CotAB), "proc:CI" for "PROCLAMATION CI." and
 * "PROCLAMATIONS LXIV, LXXVIII, CIX, AND LIX.". A number printed separately (ECL8's
 * "UNDER ENTRY " then the number) is caught because the whole screen is scanned.
 */
export function journalReveals(screen: string): string[] {
  const t = screen.toUpperCase()
  const out: string[] = []
  for (const m of t.matchAll(/ENTR(?:Y|IES)\s*(\d+(?:(?:[\s,]|AND)+\d+)*)/g)) {
    for (const n of m[1].split(/\D+/).map(Number)) if (JOURNAL.journal.some((j) => j.n === n)) out.push(`journal:${n}`)
  }
  for (const m of t.matchAll(/TAVERN TALE\s*#?\s*(\d+)/g)) {
    const n = Number(m[1])
    if (JOURNAL.tales.some((x) => x.n === n)) out.push(`tale:${n}`)
  }
  for (const m of t.matchAll(/PROCLAMATIONS?\s*([IVXLCDM]+(?:(?:[\s,]|AND)+[IVXLCDM]+)*)/g)) {
    for (const id of m[1].split(/[^IVXLCDM]+/)) if (JOURNAL.proclamations.some((p) => p.id === id)) out.push(`proc:${id}`)
  }
  return [...new Set(out)]
}

/** A short line for the message log when something new goes into the journal. */
export function revealNote(id: string): string {
  const [kind, key] = id.split(':')
  if (kind === 'tale') return `Tavern tale ${key}: ${JOURNAL.tales.find((t) => String(t.n) === key)?.text ?? ''}`
  if (kind === 'proc') return `Proclamation ${key} is in your Journal.`
  return `Journal entry ${key} is in your Journal.`
}
