// The WIS bonus cleric slots (R.slots.wisBonus): PoR FUN_51cf_01af ends at WIS 17; CotAB 0x50AF6 adds a
// fourth-level slot at WIS 18 (0x50C4B), each step only where that level already has a slot.
import { afterAll, describe, expect, it } from 'vitest'
import { wisdomBonus } from '../src/rules/chargen'
import { COAB, POR, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'

const slotsAfter = (wis: number, slots: number[]) => {
  const c = new Uint8Array(F.size)
  c[F.stat[2]] = wis
  slots.forEach((n, i) => { c[F.clericSlots + i] = n })
  wisdomBonus(c)
  return slots.map((_, i) => c[F.clericSlots + i])
}

describe('WIS bonus slots', () => {
  afterAll(() => setGame(POR))
  it('PoR: WIS 18 gives 2, 2, 1 on levels 1–3', () => {
    setGame(POR)
    expect(slotsAfter(18, [1, 1, 1])).toEqual([3, 3, 2])
    expect(slotsAfter(18, [1, 0, 0])).toEqual([3, 0, 0])
  })
  it('CotAB: WIS 18 also gives a fourth-level slot, only with one already', () => {
    setGame(COAB)
    expect(slotsAfter(18, [1, 1, 1, 1, 0])).toEqual([3, 3, 2, 2, 0])
    expect(slotsAfter(18, [1, 1, 1, 0, 0])).toEqual([3, 3, 2, 0, 0])
    expect(slotsAfter(17, [1, 1, 1, 1, 0])).toEqual([3, 3, 2, 1, 0])
  })
})
