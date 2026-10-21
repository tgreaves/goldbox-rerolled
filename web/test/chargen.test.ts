// Character creation against the rules tables in START.EXE.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { Tables, alignmentsFor, begin, classesFor, rollAbilities } from '../src/rules/chargen'
import { parseCharacter } from '../src/data/character'
import { generator } from '../src/rules/dice'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(join(dir, 'START.EXE'))

describe.skipIf(!have)('character creation', () => {
  const t = () => new Tables(unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image)

  it('offers the classes and alignments of the original menus', () => {
    const tb = t()
    expect(classesFor(tb, 1)).toEqual([2, 6, 14]) // Dwarf: Fighter, Thief, Fighter/Thief
    expect(classesFor(tb, 7)).toEqual([0, 2, 5, 6]) // Human
    expect(classesFor(tb, 4)).toHaveLength(11) // Half-Elf
    expect(alignmentsFor(tb, 6)).toEqual([1, 2, 3, 4, 5, 7, 8]) // Thief: no LG, no CG
  })

  it('rolls characters within racial and class limits', () => {
    const tb = t()
    const rng = generator(7)
    for (let i = 0; i < 300; i++) {
      const race = [1, 2, 3, 4, 5, 7][i % 6]
      const classes = classesFor(tb, race)
      const cls = classes[i % classes.length]
      const c = begin(tb, rng, race, i % 2, cls, alignmentsFor(tb, cls)[0])
      rollAbilities(tb, rng, c)
      const p = parseCharacter(c)
      for (const v of Object.values(p.stats)) { expect(v).toBeGreaterThanOrEqual(3); expect(v).toBeLessThanOrEqual(19) }
      expect(p.hp).toBeGreaterThan(0)
      expect(p.hp).toBe(p.hpMax)
      expect(p.ac).toBeLessThanOrEqual(10)
      expect(p.money[3]).toBeGreaterThan(0)
      if (cls === 2) expect(p.thac0).toBeLessThanOrEqual(20)
      if (p.stats.STR !== 18 || c[0x98] === 0) expect(c[0x16]).toBe(0)
    }
  })
})

describe.skipIf(!have)('creation draws from the dice source', () => {
  it('makes the original\'s requests in its order (host-contracts.md §6.2)', () => {
    const tb = new Tables(unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image)
    let eighteens = 0
    for (let seed = 1; seed <= 80; seed++) {
      const asked: [number, number][] = []
      const g = generator(seed)
      const dice = { roll: (n: number, s: number) => { asked.push([n, s]); return g.roll(n, s) } }
      // human male fighter: the id tag Random(256), age 15 + 1d4, six abilities of six 3d6 each, STR
      // 18/xx only on a STR of 18, gold 5d4, hit points 1d10 (PoR's tables)
      const c = begin(tb, dice, 7, 0, 2, 0)
      expect(asked).toEqual([[1, 256], [1, 4]])
      asked.length = 0
      rollAbilities(tb, dice, c)
      const six = Array.from({ length: 6 }, () => [3, 6])
      const str18 = c[0x10] === 18 ? [[1, 100]] : [] // straight after STR's rolls
      if (str18.length) eighteens++
      expect(asked).toEqual([...six, ...str18, ...six, ...six, ...six, ...six, ...six, [5, 4], [1, 10]])
    }
    expect(eighteens).toBeGreaterThan(0)
  })
})

describe.skipIf(!have)('modify and icons', () => {
  it('keeps abilities inside racial limits and HP inside its range', async () => {
    const { hpMin, hpMax, modifyStep, abilityRange } = await import('../src/rules/chargen')
    const tb = new Tables(unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image)
    const rng = generator(3)
    const c = begin(tb, rng, 7, 0, 2, 0) // human male fighter
    rollAbilities(tb, rng, c)
    for (let i = 0; i < 30; i++) modifyStep(tb, c, 0, 1)
    expect(c[0x10]).toBe(18)
    expect(c[0x16]).toBeLessThanOrEqual(100)
    // quirk: STR below the fighter minimum (9) snaps to the racial minimum (3)
    c[0x16] = 0
    c[0x10] = 9
    modifyStep(tb, c, 0, -1)
    expect(c[0x10]).toBe(abilityRange(tb, c, 0)[0])
    for (let i = 0; i < 40; i++) modifyStep(tb, c, 6, 1)
    expect(c[0x32]).toBe(hpMax(tb, c))
    for (let i = 0; i < 40; i++) modifyStep(tb, c, 6, -1)
    expect(c[0x32]).toBe(hpMin(tb, c))
  })
})
