// The journal texts and the reveals found in the game's own lines (IMP-055).
import { describe, expect, it } from 'vitest'
import { JOURNAL, journalReveals, roman } from '../src/rules/journal'

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
})
