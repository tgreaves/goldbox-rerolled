// Curse of the Azure Bonds' random treasure (0x1A5A3 type choice, 0x42D97 builder) with scripted dice.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { buildItem, chooseType } from '../src/rules/randitem'
import { COAB, POR, setGame } from '../src/games/profile'

const dir = process.env.COAB ?? ''
const dice = (...rolls: number[]) => () => { const v = rolls.shift(); if (v === undefined) throw new Error('out of dice'); return v }

describe.skipIf(!dir || !existsSync(dir))('Curse of the Azure Bonds random treasure', () => {
  afterAll(() => setGame(POR))
  const image = () => unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image

  it('chooses types by its own table', () => {
    setGame(COAB)
    expect(chooseType(dice(10, 45), 7)).toBe(0x3b) // 45 → long sword
    expect(chooseType(dice(10, 48), 7)).toBe(0x3b) // 48/49: not the previous type
    expect(chooseType(dice(10, 70, 9), 7)).toBe(0x25)
    expect(chooseType(dice(95, 10), 7)).toBe(0x54) // d15
    expect(chooseType(dice(99), 7)).toBe(0x3b)
  })

  it('builds weapons +1/+2 only, level 4 and 5 scrolls, and its magic records', () => {
    setGame(COAB)
    const img = image()
    expect(buildItem(0x22, dice(20), img).raw[0x32]).toBe(2) // d20 = 20: +2 (PoR: +3)
    const scroll = buildItem(0x3e, dice(1, 5, 6), img) // one cleric spell, level 5, d6 = 6
    expect([scroll.raw[0x3c], scroll.raw[0x3a] | (scroll.raw[0x3b] << 8)]).toEqual([76, 1500])
    const potion = buildItem(0x47, dice(6), img) // d8 6–8: Potion of Extra Healing
    expect([potion.raw[0x2f], potion.raw[0x30], potion.raw[0x31], potion.raw[0x3a] | (potion.raw[0x3b] << 8)]).toEqual([185, 187, 64, 800])
    const javelin = buildItem(0x15, dice(1, 5), img) // d5 = 5: the real Javelin of Lightning record
    expect(javelin.raw[0x3a] | (javelin.raw[0x3b] << 8)).toBe(3000)
  })
})
