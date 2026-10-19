// Money rules (spec/town.md, "Money"); coin values come from START.EXE (POOLRAD), the rest needs no files.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { coinValue, sellOffer, appraiseGem } from '../src/rules/money'
import { COIN_VALUES, installNames } from '../src/data/character'
import { unexepack } from '../src/data/exepack'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)
import { Item, ITEM_SIZE } from '../src/data/items'

const item = (value: number, count: number) => {
  const r = new Uint8Array(ITEM_SIZE)
  r[0x3a] = value & 0xff; r[0x3b] = value >> 8; r[0x39] = count
  return new Item(r)
}

describe('money', () => {
  it.skipIf(!have)('values coins in gp, rounding to nearest', () => {
    installNames(unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image)
    expect(COIN_VALUES).toEqual([1, 10, 100, 200, 1000]) // DS:0D24
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
