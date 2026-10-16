// Money rules (spec/town.md, "Money"); no game files needed.
import { describe, expect, it } from 'vitest'
import { coinValue, sellOffer, appraiseGem } from '../src/rules/money'
import { Item, ITEM_SIZE } from '../src/data/items'

const item = (value: number, count: number) => {
  const r = new Uint8Array(ITEM_SIZE)
  r[0x3a] = value & 0xff; r[0x3b] = value >> 8; r[0x39] = count
  return new Item(r)
}

describe('money', () => {
  it('values coins in gp, rounding to nearest', () => {
    expect(coinValue([0, 0, 0, 10, 0])).toBe(10)
    expect(coinValue([0, 0, 0, 0, 1])).toBe(5) // 1 pp = 5 gp
    expect(coinValue([0, 0, 1, 0, 0])).toBe(1) // 1 ep rounds up to 1 gp
    expect(coinValue([0, 1, 0, 0, 0])).toBe(0) // 1 sp rounds down
    expect(coinValue([0, 20, 0, 0, 0])).toBe(1) // 20 sp = 1 gp
  })
  it('offers half the value, stacks at 1/40 per unit (original bug)', () => {
    expect(sellOffer(item(90, 0))).toBe(45)
    expect(sellOffer(item(20, 20))).toBe(10) // a stack of 20 worth 20: (10 × 20) div 20, value × count / 40
  })
  it('rolls gem values from the table', () => {
    expect([1, 26, 51, 71, 91, 100].map(appraiseGem)).toEqual([10, 50, 100, 500, 1000, 5000])
  })
})
