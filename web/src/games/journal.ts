// A game's printed journal (entries, proclamations, tavern tales, background notes) the scripts refer
// to by number (IMP-055). Each game's profile carries its own, or none.
import porJournal from '../data/journal.json'
import coabJournal from '../data/coab-journal.json'
import sotsbJournal from '../data/sotsb-journal.json'

/** title: the entry's printed heading, where the source keeps it */
export interface JournalEntry { n: number; title?: string; text: string; images: string[] }
export interface Proclamation { id: string; text: string }
export interface Tale { n: number; text: string }
/** a section of the printed journal that is read from the start, not revealed by the scripts */
export interface Background { title: string; text: string }
export interface JournalData {
  source: Record<string, string>
  preface: string
  proclamations: Proclamation[]
  journal: JournalEntry[]
  tales: Tale[]
  background?: Background[]
  /** what each tab says while nothing in it has been found yet */
  empty?: { journal?: string; proclamations?: string; tales?: string }
}

const EMPTY: JournalData = { source: {}, preface: '', proclamations: [], journal: [], tales: [], background: [], empty: {} }

/** Pool of Radiance's Adventurer's Journal (text via the Pool of Radiance Wiki). */
export const POR_JOURNAL: JournalData = {
  ...(porJournal as JournalData),
  empty: {
    journal: 'Nothing yet. Papers, books and maps found on your travels are copied in here.',
    proclamations: 'Nothing yet. The proclamations are posted on the walls of City Hall.',
    tales: 'Nothing yet. Listen in the taverns of New Phlan.',
  },
}

/** Curse of the Azure Bonds' Adventurer's Journal (text via the Gold Box Wiki, tools/coab/journal_coab.py). */
export const COAB_JOURNAL: JournalData = {
  ...(coabJournal as JournalData),
  empty: {
    journal: 'Nothing yet. What you learn on your travels is copied in here.',
    tales: 'Nothing yet. Listen in the taverns.',
  },
}

/** Secret of the Silver Blades' Adventurer's Journal (transcribed from a scan of the printed journal, SSI 1990). */
export const SOTSB_JOURNAL: JournalData = {
  ...(sotsbJournal as JournalData),
  empty: { journal: 'Nothing yet. What you learn on your travels is copied in here.' },
}

/** The active game's journal (empty when it has none); Pool of Radiance's until setGame chooses another. */
export const JOURNAL: JournalData = { ...EMPTY, ...POR_JOURNAL }

export function useJournal(d: JournalData | null) {
  Object.assign(JOURNAL, EMPTY, d ?? {})
}
