// The Adventurer's Journal (IMP-055): the journal entries, City Hall proclamations and tavern tales
// the game refers to by number, from the printed journal (text via the Pool of Radiance Wiki, see
// data/journal.json). The scripts announce each one in their text; the port notes it as revealed.
import data from '../data/journal.json'

export interface JournalEntry { n: number; text: string; images: string[] }
export interface Proclamation { id: string; text: string }
export interface Tale { n: number; text: string }

export const JOURNAL = data as {
  source: Record<string, string>
  preface: string
  proclamations: Proclamation[]
  journal: JournalEntry[]
  tales: Tale[]
}

const PROC_IDS = new Set(JOURNAL.proclamations.map((p) => p.id))

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
 * "(ENTRY 33)", "tale:n" for "YOU OVERHEAR TAVERN TALE 7", "proc:CI" for "PROCLAMATION CI." and
 * "PROCLAMATIONS LXIV, LXXVIII, CIX, AND LIX.". A number printed separately (ECL8's
 * "UNDER ENTRY " then the number) is caught because the whole screen is scanned.
 */
export function journalReveals(screen: string): string[] {
  const t = screen.toUpperCase()
  const out: string[] = []
  for (const m of t.matchAll(/ENTR(?:Y|IES)\s*(\d+(?:(?:[\s,]|AND)+\d+)*)/g)) {
    for (const n of m[1].split(/\D+/).map(Number)) if (n >= 1 && n <= JOURNAL.journal.length) out.push(`journal:${n}`)
  }
  for (const m of t.matchAll(/TAVERN TALE\s*(\d+)/g)) {
    const n = Number(m[1])
    if (n >= 1 && n <= JOURNAL.tales.length) out.push(`tale:${n}`)
  }
  for (const m of t.matchAll(/PROCLAMATIONS?\s*([IVXLCDM]+(?:(?:[\s,]|AND)+[IVXLCDM]+)*)/g)) {
    for (const id of m[1].split(/[^IVXLCDM]+/)) if (PROC_IDS.has(id)) out.push(`proc:${id}`)
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
