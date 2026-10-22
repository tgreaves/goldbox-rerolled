// A shop's price (R.shopPrice; CotAB 0x1F0F6, 0x1F531): the item's value shifted by the factor the
// scripts put in ECL 0x7F6D (canonical 0x6E6D); PoR has none.
import { afterAll, describe, expect, it } from 'vitest'
import { shopPrice } from '../src/rules/money'
import { COAB, POR, setGame } from '../src/games/profile'

describe('shop prices', () => {
  afterAll(() => setGame(POR))
  const at = (factor: number) => (a: number) => (a === 0x6e6d ? factor : 0)
  it('PoR: the value, whatever 0x6E6D holds', () => {
    setGame(POR)
    expect(shopPrice(at(64), 300)).toBe(300)
  })
  it('CotAB: 1 → ÷16 … 8 → ÷2, 32 → ×2, 64 → ×4, 128 → ×8; others the value (IMP-078)', () => {
    setGame(COAB)
    const v = 1000
    expect([1, 2, 4, 8, 32, 64, 128].map((f) => shopPrice(at(f), v))).toEqual([62, 125, 250, 500, 2000, 4000, 8000])
    for (const f of [0, 16, 3]) expect(shopPrice(at(f), v)).toBe(v)
    expect(shopPrice(at(128), 0x3000)).toBe(0x8000 & 0xffff) // a word, as the original's shl
  })
})
