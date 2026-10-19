// A game's printed journal (entries, proclamations, tavern tales) the scripts refer to by number
// (IMP-055). Each game's profile carries its own, or none.
import porJournal from '../data/journal.json'

export interface JournalEntry { n: number; text: string; images: string[] }
export interface Proclamation { id: string; text: string }
export interface Tale { n: number; text: string }
export interface JournalData {
  source: Record<string, string>
  preface: string
  proclamations: Proclamation[]
  journal: JournalEntry[]
  tales: Tale[]
}

const EMPTY: JournalData = { source: {}, preface: '', proclamations: [], journal: [], tales: [] }

/** The active game's journal (empty when it has none); Pool of Radiance's until setGame chooses another. */
export const JOURNAL: JournalData = { ...(porJournal as JournalData) }

export function useJournal(d: JournalData | null) {
  Object.assign(JOURNAL, d ?? EMPTY)
}
