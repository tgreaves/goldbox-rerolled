// The journal texts and the reveals found in the game's own lines (IMP-055).
import { describe, expect, it } from 'vitest'
import { JOURNAL, journalReveals, roman } from '../src/rules/journal'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'

describe('journal', () => {
  it('has the printed journal: 58 entries, 23 tales, the proclamations', () => {
    expect(JOURNAL.journal.map((j) => j.n)).toEqual(Array.from({ length: 58 }, (_, i) => i + 1))
    expect(JOURNAL.tales).toHaveLength(23)
    expect(JOURNAL.proclamations.map((p) => p.id)).toEqual(expect.arrayContaining(['LIX', 'LXIV', 'LXXVIII', 'CI', 'CIX', 'CX', 'CXIV', 'CXXVI', 'CXXIX', 'CXXXIV', 'CLIV', 'CCI', 'CCIV']))
    expect(roman('LXXVIII')).toBe(78)
    expect(roman('CXIV')).toBe(114)
  })

  it('finds what the scripts reveal', () => {
    expect(journalReveals('INSIDE THE CABINET YOU FIND SOME FILES.  YOU STUFF THE PAPERS INTO YOUR JOURNAL UNDER ENTRIES 23 AND 14.')).toEqual(['journal:23', 'journal:14'])
    expect(journalReveals('A LETTER FROM THE BOSS, TELLING YARASH TO JOIN OR DIE. (ENTRY 33)')).toEqual(['journal:33'])
    expect(journalReveals(' YOU RECORD IT IN YOUR JOURNAL UNDER ENTRY  2')).toEqual(['journal:2'])
    expect(journalReveals('YOU OVERHEAR TAVERN TALE  7')).toEqual(['tale:7'])
    expect(journalReveals('PROCLAMATIONS ARE POSTED ON THE WALLS, IN YOUR JOURNAL YOU NOTE  PROCLAMATION  CXXVI AND CX.')).toEqual(['proc:CXXVI', 'proc:CX'])
    expect(journalReveals('PROCLAMATIONS ARE POSTED ON THE WALLS, IN YOUR JOURNAL YOU NOTE  PROCLAMATIONS LXIV, LXXVIII, CIX, AND LIX.')).toEqual(['proc:LXIV', 'proc:LXXVIII', 'proc:CIX', 'proc:LIX'])
    expect(journalReveals("'WE ARE JUST OUTSIDE THE CITY HALL. PROCLAMATIONS ARE POSTED ON THESE WALLS.'")).toEqual([])
  })

  it("has CotAB's journal when CotAB is the game: 59 entries, 62 tales, four background notes, no proclamations", () => {
    setGame(COAB)
    try {
      expect(JOURNAL.journal.map((j) => j.n)).toEqual(Array.from({ length: 59 }, (_, i) => i + 1))
      expect(JOURNAL.tales.map((t) => t.n)).toEqual(Array.from({ length: 62 }, (_, i) => i + 1))
      expect(JOURNAL.proclamations).toEqual([])
      expect(JOURNAL.background?.map((b) => b.title)).toHaveLength(4)
      expect(JOURNAL.journal[0].text).toMatch(/^I am beginning a new journal\./)
      expect(JOURNAL.journal[3].text).toMatch(/picture in the printed journal/) // entry 4 is a map
      expect(JOURNAL.tales[25].text).toMatch(/^Dragons have been heading south/) // its heading lost the 26
      // CotAB's phrasings (ECL text): "TAVERN TALE #", the entry number on its own line
      expect(journalReveals('YOU OVERHEAR TAVERN TALE #12')).toEqual(['tale:12'])
      expect(journalReveals('YOU FIND INFORMATION ON HIS BODY AND LOG IT AS JOURNAL ENTRY 4.')).toEqual(['journal:4'])
      expect(journalReveals('YOU RECORD THE FIND AT JOURNAL ENTRY 59.')).toEqual(['journal:59'])
      expect(journalReveals('YOUR ENTRY IS GREETED BY HUNGRY SNARLS.')).toEqual([])
    } finally {
      setGame(POR)
    }
    expect(JOURNAL.journal).toHaveLength(58)
    expect(JOURNAL.background).toEqual([])
  })

  it("has SotSB's journal when SotSB is the game: 72 titled entries, the opening story and bestiary, no tales", () => {
    setGame(SOTSB)
    try {
      expect(JOURNAL.journal.map((j) => j.n)).toEqual(Array.from({ length: 72 }, (_, i) => i + 1))
      expect(JOURNAL.tales).toEqual([])
      expect(JOURNAL.proclamations).toEqual([])
      expect(JOURNAL.background?.map((b) => b.title)).toEqual(['How the Heroes Arrive', 'Creatures of the Forgotten Realms'])
      for (const j of JOURNAL.journal) expect(j.text.trim(), `entry ${j.n}`).not.toBe('')
      // the rumours (ECL1 record 16's table at 0x9B58: 6, 8, 20, 30) have no printed heading
      expect(JOURNAL.journal.filter((j) => !j.title).map((j) => j.n)).toEqual([6, 8, 20, 30])
      expect(JOURNAL.journal[0].text).toMatch(/map in the printed journal/) // entry 1 is a map
      expect(JOURNAL.journal[36].title).toBe("Mayor's Introduction")
      // SotSB's phrasings (ECL text): the number printed after the subroutine's "AS JOURNAL ENTRY "
      expect(journalReveals('HE CONTINUES, AND YOU RECORD IT IN JOURNAL ENTRY 37.')).toEqual(['journal:37'])
      expect(journalReveals('YOU TAKE THE LETTER THAT SHE WAS READING AND YOU RECORD IT AS JOURNAL ENTRY 69.')).toEqual(['journal:69'])
      expect(journalReveals('YOUR ENTRY HAS DISTURBED THEIR CHANTING.')).toEqual([])
    } finally {
      setGame(POR)
    }
  })
})
