// Character creation against the rules tables in START.EXE.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { Tables, alignmentsFor, begin, classesFor, rollAbilities } from '../src/rules/chargen'
import { parseCharacter } from '../src/data/character'

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
    let seed = 7
    const rng = (n: number) => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) % n
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

describe.skipIf(!have)('modify and icons', () => {
  it('keeps abilities inside racial limits and HP inside its range', async () => {
    const { hpMin, hpMax, modifyStep, abilityRange } = await import('../src/rules/chargen')
    const tb = new Tables(unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image)
    let seed = 3
    const rng = (n: number) => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) % n
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
