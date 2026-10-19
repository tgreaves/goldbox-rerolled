// Spell rules per game (docs/multi-game.md, step 6): the spell book each game's START.EXE gives.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SpellTables } from '../src/data/spells'
import { COAB, POR, setGame } from '../src/games/profile'
import { R, bookSpell, casterClasses } from '../src/games/rules'

const tables = (dir: string) => SpellTables.load(new Uint8Array(readFileSync(join(dir, 'START.EXE'))))!
const count = (st: SpellTables, cls: number) => Array.from({ length: R.spells.levels }, (_, l) => st.spells.filter((s) => bookSpell(s) && s.cls === cls && s.level === l + 1).length)

const por = process.env.POOLRAD ?? ''
describe.skipIf(!por || !existsSync(por))('Pool of Radiance spell book', () => {
  it('is the spells up to 55, as before', () => {
    setGame(POR)
    const st = tables(por)
    expect(st.spells.length).toBe(67)
    expect(st.spells.filter(bookSpell).map((s) => s.id)).toEqual(st.spells.filter((s) => s.id <= 55).map((s) => s.id))
    expect(casterClasses().map((k) => k.name)).toEqual(['Cleric', 'Magic-User'])
  })
})

const coab = process.env.COAB ?? ''
describe.skipIf(!coab || !existsSync(coab))('Curse of the Azure Bonds spell book (spec/coab/tables.md §3.7)', () => {
  afterAll(() => setGame(POR))
  it('has 100 spells over five levels, by its own class codes', () => {
    setGame(COAB)
    const st = tables(coab)
    expect(st.spells.length).toBe(100)
    expect(st.get(100)!.name).toBe('Bestow Curse')
    expect(count(st, R.spells.cleric)).toEqual([8, 7, 8, 6, 6])
    expect(count(st, R.spells.druid)).toEqual([4, 0, 0, 0, 0])
    expect(count(st, R.spells.magicUser)).toEqual([13, 7, 11, 10, 4])
    expect(bookSpell(st.get(36)!)).toBe(false) // Animate Dead: item/monster only in CotAB
    expect(casterClasses().map((k) => k.name)).toEqual(['Cleric', 'Druid', 'Magic-User'])
  })
})
