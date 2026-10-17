// The commissions panel's reading of the ECL variables (spec/commissions.md); no game files needed.
import { describe, expect, it } from 'vitest'
import { report, revealedBy } from '../src/rules/commissions'

const vars = (v: Record<number, number>) => (a: number) => v[a] ?? 0

describe('commissions', () => {
  it('recognises offers and the proclamation wall from the printed text', () => {
    expect(revealedBy('THE SLUMS IMMEDIATELY TO OUR WEST NEED TO BE CLEARED OF MONSTERS.\'')).toEqual(['slums'])
    expect(revealedBy("'I HAVE BEEN AUTHORIZED TO GIVE YOU AN ENCHANTED WEAPON IF YOU ACCEPT")).toEqual(['graveyard'])
    expect(revealedBy('PROCLAMATIONS ARE POSTED ON THE WALLS, IN YOUR JOURNAL YOU NOTE ')).toEqual(['proclamations'])
    expect(revealedBy('YOU SPY A GROUP OF SEEDY-LOOKING ORCS.')).toEqual([])
  })

  it('lists nothing at the start of a game', () => {
    expect(report(vars({}), new Set()).lines).toEqual([])
  })

  it('reports states from the commission table', () => {
    const r = report(vars({ [0x4aa6 + 21]: 2, [0x4aa6 + 1]: 254, [0x4aa6 + 12]: 255, 0x4a97: 254, 0x4a39: 5, 0x4a8f: 2, 0x4ac1: 2 }),
      new Set(['kovel', 'nomads', 'proclamations']))
    expect(r.lines.map((l) => [l.state, l.title])).toEqual([
      ['reward', 'Clear Sokal Keep on Thorn Island'],
      ['summoned', "Cadorna's family treasure in the textile house"],
      ['open', 'Clear the slums west of City Hall'],
      ['open', 'Stop the nomads joining the enemy'],
      ['closed', 'Clean out the thieves in Kovel Mansion'],
    ])
    expect(r.bounty).toBe(3)
    expect(r.lines.find((l) => l.title.startsWith('Clear the slums'))?.progress).toBe('2 of 25 fights won in the slums')
    expect(r.proclamations).toBe('CXXVI and CX')
  })
})
