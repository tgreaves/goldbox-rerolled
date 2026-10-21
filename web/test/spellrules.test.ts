// Spell rules per game (docs/multi-game.md, step 6): the spell book each game's START.EXE gives.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SpellTables } from '../src/data/spells'
import { COAB, POR, setGame } from '../src/games/profile'
import { R, bookSpell, casterClasses } from '../src/games/rules'
import { casterLevel } from '../src/rules/magic'
import { F } from '../src/games/fields'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { derive, levelLimit } from '../src/rules/training'
import { alignmentsFor, begin, classesFor, rollHitDice, rollAbilities, saves, thiefSkills } from '../src/rules/chargen'
import { T } from '../src/games/tables'
import { generator } from '../src/rules/dice'

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
describe.skipIf(!coab || !existsSync(coab))('Curse of the Azure Bonds spell book (spec/A-games/coab/tables.md §3.7)', () => {
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

  it('sums slot increments by class and level (§3.5), with paladin and ranger rows', () => {
    setGame(COAB)
    const t = new Tables(unexepack(new Uint8Array(readFileSync(join(coab, 'START.EXE')))).image)
    const at = (k: number, L: number) => {
      const c = new Uint8Array(F.size)
      c[F.levels + k] = L
      c[F.stat[2]] = 10 // no WIS bonus
      derive(t, c)
      return { cl: [...c.subarray(F.clericSlots, F.clericSlots + 5)], dr: [...c.subarray(F.druidSlots, F.druidSlots + 5)], mu: [...c.subarray(F.muSlots, F.muSlots + 5)], att: c[F.attacksBase] }
    }
    expect(at(0, 5).cl).toEqual([3, 3, 1, 0, 0])
    expect(at(0, 9).cl).toEqual([4, 4, 3, 2, 1])
    expect(at(5, 5).mu).toEqual([4, 2, 1, 0, 0])
    expect(at(5, 11).mu).toEqual([4, 4, 4, 3, 3])
    expect(at(3, 8).cl).toEqual([0, 0, 0, 0, 0])
    expect(at(3, 9).cl.slice(0, 2)).toEqual([1, 0])
    expect(at(3, 11).cl.slice(0, 2)).toEqual([2, 1])
    expect([at(4, 8).dr[0], at(4, 8).mu[0]]).toEqual([1, 0])
    expect([at(4, 11).dr[0], at(4, 11).mu[0]]).toEqual([2, 2])
    expect([at(2, 7).att, at(3, 7).att, at(4, 7).att, at(4, 8).att]).toEqual([3, 3, 2, 3]) // fighter/paladin > 6, ranger > 7
  })

  it('rolls hit points the CotAB way (§3.4): best of two below the stop level, fixed from it', () => {
    setGame(COAB)
    const t = new Tables(unexepack(new Uint8Array(readFileSync(join(coab, 'START.EXE')))).image)
    expect(Array.from({ length: 8 }, (_, k) => t.b(T.hitDiceStop.at + k))).toEqual([10, 15, 10, 10, 11, 12, 11, 19])
    const c = new Uint8Array(F.size)
    const rolls: [number, number][] = []
    const rng = { roll: (n: number, s: number) => { rolls.push([n, s]); return rolls.length % 2 ? 3 : 7 } } // dice show 3, then 7
    c[F.levels + 2] = 1
    expect(rollHitDice(t, rng, c, [2])).toBe(7) // fighter level 1: 1d10 twice, the higher
    expect(rolls).toEqual([[1, 10], [1, 10]])
    c[F.levels + 2] = 5
    expect(rollHitDice(t, rng, c, [2])).toBe(7) // one die after level 1
    c[F.levels + 2] = 10
    expect(rollHitDice(t, rng, c, [2])).toBe(3) // fighter from level 10: 3 hit points
    c[F.levels + 5] = 4
    expect(rollHitDice(t, rng, c, [5, 2])).toBe(3) // the fixed value replaces the magic-user's roll (quirk)
  })

  it('creates a human paladin with 300 platinum and base stats (§3.1, §3.10, §2.1)', () => {
    setGame(COAB)
    const t = new Tables(unexepack(new Uint8Array(readFileSync(join(coab, 'START.EXE')))).image)
    expect(classesFor(t, 7)).toEqual(expect.arrayContaining([0, 2, 3, 4, 5, 6])) // human
    expect(classesFor(t, 4)).toEqual(expect.arrayContaining([4, 10])) // half-elf: ranger, cleric/ranger
    expect(alignmentsFor(t, 3)).toEqual([0]) // paladin: lawful good only
    expect(alignmentsFor(t, 4)).toEqual([0, 3, 6]) // ranger: LG, NG, CG
    const rng = generator(7)
    const c = begin(t, rng, 7, 0, 3, 0)
    rollAbilities(t, rng, c)
    expect(c.length).toBe(F.size)
    expect(c[F.levels + 3]).toBe(1)
    expect(c[F.money + 8] | (c[F.money + 9] << 8)).toBe(300)
    expect(c[F.money + 6] | (c[F.money + 7] << 8)).toBe(0)
    for (let i = 0; i < 6; i++) expect(c[F.baseStat[i]]).toBe(c[F.stat[i]])
    expect(c[F.stat[4 /* CON */]]).toBeGreaterThanOrEqual(9) // paladin minimum
    expect(c[F.stat[5 /* CHA */]]).toBeGreaterThanOrEqual(17)
    const he = new Uint8Array(F.size)
    he[F.race] = 4; he[F.stat[0]] = 18; he[F.stat[1]] = 17
    expect([levelLimit(he, 4), levelLimit(he, 5), levelLimit(he, 2)]).toEqual([8, 7, 8]) // half-elf ranger, MU by INT, fighter
  })

  it('works out the caster level as CotAB does (0x4F8BF)', () => {
    setGame(COAB)
    const st = tables(coab)
    const who = (levels: Record<number, number>, race = 7) => {
      const c = new Uint8Array(F.size)
      c[F.race] = race
      for (const [k, v] of Object.entries(levels)) c[F.levels + Number(k)] = v
      return c
    }
    const bless = st.get(1)!, mm = st.get(15)!, entangle = st.get(78)!, item = st.spells.find((s) => s.cls === R.spells.item)!
    expect(casterLevel(who({ 3: 9 }), bless)).toBe(1) // paladin 9: level − 8
    expect(casterLevel(who({ 0: 5, 3: 9 }), bless)).toBe(5) // the better of cleric and paladin − 8
    expect(casterLevel(who({ 4: 8 }), entangle)).toBe(1) // ranger 8: druid spells at level − 7
    expect(casterLevel(who({ 4: 9 }), mm)).toBe(1) // ranger 9: magic-user spells at level − 8
    expect(casterLevel(who({ 5: 5 }), mm)).toBe(5)
    expect(casterLevel(who({ 2: 7 }), item)).toBe(6) // a fighter: no caster level, everything at 6
    expect(casterLevel(who({ 5: 5 }), item)).toBe(12)
    expect(casterLevel(who({ 5: 5 }), mm, true)).toBe(6) // from an item
  })

  it('recomputes the shipped thief\'s skills and saves exactly as the original stored them (0x50F5A, 0x50C6B)', () => {
    setGame(COAB)
    const t = new Tables(unexepack(new Uint8Array(readFileSync(join(coab, 'START.EXE')))).image)
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const c = new Uint8Array(readFileSync(join(coab, 'SAVE', `CHRDATA${n}.SAV`)))
      const skills = [...c.subarray(F.thief, F.thief + 8)], sv = [...c.subarray(F.saves, F.saves + 5)]
      saves(t, c)
      expect([...c.subarray(F.saves, F.saves + 5)], `CHRDATA${n} saves`).toEqual(sv)
      if (c[F.levels + 6]) {
        thiefSkills(t, c)
        expect([...c.subarray(F.thief, F.thief + 8)], `CHRDATA${n} thief skills`).toEqual(skills) // TRAVIS: +7 everywhere
      }
    }
  })
})
