// The item types the shared code names come from the profile (games/rules.ts `itemTypes`): CotAB's
// missile flight (0x2D141) adds the Dart of Hornets Nest to the arrows and the Staff Sling and Spine to
// the sling stone; its Bag of Holding step never runs (0x4DC9E).
import { afterAll, describe, expect, it } from 'vitest'
import { missileFlight } from '../src/rules/combat'
import { COAB, POR, setGame } from '../src/games/profile'
import { R } from '../src/games/rules'

describe('item types by game', () => {
  afterAll(() => setGame(POR))
  it('PoR: 100, 101 and 98 fly as the default stone; 47 as the sling stone', () => {
    setGame(POR)
    for (const t of [100, 101, 98]) expect(missileFlight(t, 0).frames[0].rec).toBe(7)
    expect(missileFlight(47, 0).frames[0].rec).toBe(8)
    expect(R.itemTypes.bagOfHolding).toBe(0xba)
  })
  it('CotAB: 100 flies as an arrow, 101 and 98 as the sling stone; no Bag of Holding', () => {
    setGame(COAB)
    expect(missileFlight(100, 2).frames[0].rec).toBe(2)
    for (const t of [101, 47, 98]) expect(missileFlight(t, 0).frames[0].rec).toBe(8)
    expect(R.itemTypes.bagOfHolding).toBeNull()
  })
})
