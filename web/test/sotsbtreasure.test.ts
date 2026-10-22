// Secret of the Silver Blades' random treasure (the TREASURE handler's type choice from 0x1FB2F, the builder
// 0x4F6D2) with scripted dice: spec/A-games/sotsb/records.md §3.1.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { buildItem, chooseType } from '../src/rules/randitem'
import { POR, SOTSB, setGame } from '../src/games/profile'
import { T } from '../src/games/tables'

const dir = process.env.SOTSB ?? ''
const dice = (...rolls: number[]) => () => { const v = rolls.shift(); if (v === undefined) throw new Error('out of dice'); return v }
const u16 = (r: Uint8Array, o: number) => r[o] | (r[o + 1] << 8)
const names = (r: Uint8Array) => [r[0x2f], r[0x30], r[0x31]]

describe.skipIf(!dir || !existsSync(dir))('Secret of the Silver Blades random treasure', () => {
  afterAll(() => setGame(POR))
  const image = () => unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
  const word = (img: Uint8Array, n: number) => { const a = T.ds + T.itemWords.at + T.itemWords.row * (n - 1); return String.fromCharCode(...img.subarray(a + 1, a + 1 + img[a])) }

  it('chooses types by its own table', () => {
    setGame(SOTSB)
    expect(chooseType(dice(10, 5, 1), 7)).toBe(6)
    expect(chooseType(dice(31, 30, 3), 7)).toBe(0x1e)
    expect(chooseType(dice(1, 70, 2, 14), 7)).toBe(0x0d) // d4 < 4: the d20 list
    expect(chooseType(dice(1, 70, 4, 8), 7)).toBe(0x47) // d4 = 4: the d8 list
    expect(chooseType(dice(50), 7)).toBe(0x27)
    expect(chooseType(dice(85), 7)).toBe(0x3b)
    expect(chooseType(dice(90, 4), 7)).toBe(0x23)
    expect(chooseType(dice(99, 3), 7)).toBe(0x2f)
  })

  it('builds 67-byte records: weapons and armour by its own words, weights and values', () => {
    setGame(SOTSB)
    const img = image()
    const mail = buildItem(0x22, dice(10), img).raw // d10 = 10: +3
    expect(mail.length).toBe(67)
    expect([...names(mail), mail[0x32], mail[0x35], u16(mail, 0x37), u16(mail, 0x3a)]).toEqual([0x71, 0x2f, 0x22, 3, 4, 300, 5250])
    expect([word(img, 0x22), word(img, 0x2f), word(img, 0x71)]).toEqual(['Chain', 'Mail', '+3'])
    expect(buildItem(1, dice(7), img).raw[0x32]).toBe(2)
    const bracers = buildItem(0x32, dice(1), img).raw
    expect([...names(bracers), bracers[0x32], u16(bracers, 0x3a)]).toEqual([0x6b, 0x5a, 0x32, 4, 6000])
    expect([word(img, 0x32), word(img, 0x5a), word(img, 0x6b)]).toEqual(['Bracers', 'of', 'AC 6'])
    const ring = buildItem(0x3b, dice(10), img).raw // the plus is always 1
    expect([...names(ring), ring[0x32], ring[0x33], u16(ring, 0x37), u16(ring, 0x3a)]).toEqual([0x6f, 0x31, 0x2e, 1, 1, 1, 1000])
    const t25 = buildItem(0x25, dice(1), img).raw // listed with weight 50, count 0
    expect([u16(t25, 0x37), t25[0x39], u16(t25, 0x3a)]).toEqual([50, 0, 1250])
    const arrows = buildItem(2, dice(1), img).raw // not listed: weight 4, count 20
    expect([u16(arrows, 0x37), arrows[0x39]]).toEqual([4, 20])
  })

  it('reads scroll spells from its lists, and copies its magic records', () => {
    setGame(SOTSB)
    const img = image()
    const mage = buildItem(0x27, dice(2, 7, 3, 1, 1), img).raw // two spells: level 7 third, level 1 first
    expect([...names(mage), mage[0x3c], mage[0x3d], mage[0x35], u16(mage, 0x3a), u16(mage, 0x37)]).toEqual([0x65, 0x27, 0x28, 117, 9, 4, 1200, 25])
    expect([word(img, 0x28), word(img, 0x27), word(img, 0x65)]).toEqual(['Mage', 'Scroll', '2 Spells'])
    const cleric = buildItem(0x28, dice(1, 6, 2), img).raw
    expect([...names(cleric), cleric[0x3c], cleric[0x35], u16(cleric, 0x3a)]).toEqual([0x64, 0x27, 0x26, 56, 0, 900])
    const javelin = buildItem(7, dice(1, 5), img).raw // d5 = 5: record 0x31
    expect([word(img, javelin[0x31]), word(img, javelin[0x30]), word(img, javelin[0x2f])]).toEqual(['Javelin', 'of', 'Lightning'])
    expect([javelin[0x32], javelin[0x33], u16(javelin, 0x37), u16(javelin, 0x3a)]).toEqual([1, 0, 20, 1500])
    const potion = buildItem(0x2f, dice(8), img).raw // d8 7–8: record 0x29
    expect([word(img, potion[0x31]), word(img, potion[0x30]), word(img, potion[0x2f]), u16(potion, 0x3a)]).toEqual(['Potion', 'of', 'Invisibility', 500])
  })
})
