// The per-game spell handler map (games/spellrules.ts): every spell id a game has names a kind that
// exists, the duration special cases are data, and CotAB's own spells are not read as PoR's.
import { describe, expect, it } from 'vitest'
import { COAB, POR, setGame } from '../src/games/profile'
import { R } from '../src/games/rules'
import { SHARED_KINDS, amount, spellSpec, term } from '../src/rules/spellkinds'
import { Battle } from '../src/rules/combat'
import { duration } from '../src/rules/magic'
import type { Engine } from '../src/vm/engine'
import type { Spell } from '../src/data/spells'

const kinds = new Set([...Object.keys(SHARED_KINDS), ...Object.keys(Battle.spellKinds)])

describe('spell handler map', () => {
  for (const g of [POR, COAB]) {
    it(`${g.name}: every spell id 1–${g.rules.spells.records} names a handler kind`, () => {
      setGame(g)
      for (let id = 1; id <= R.spells.records; id++) {
        expect(g.spells.handlers[id], `id ${id}`).toBeDefined()
        expect(kinds.has(g.spells.handlers[id].k), `id ${id}: ${g.spells.handlers[id].k}`).toBe(true)
      }
    })
  }

  it('reads the right spell per game: CotAB 58 is Cure Serious Wounds, PoR 58 the ointment', () => {
    expect(POR.spells.handlers[58].k).toBe('ointment')
    expect(COAB.spells.handlers[58]).toEqual({ k: 'heal', amount: { n: 2, d: 8, plus: 1 } })
    setGame(COAB)
    expect(spellSpec(66).k).toBe('damage')
    setGame(POR)
    expect(spellSpec(66).k).toBe('apply')
  })

  it('evaluates terms and amounts at a caster level', () => {
    const fixed = (n: number, d: number) => n * d // every die at its maximum
    expect(term('L/2', 5, fixed)).toBe(2)
    expect(term('(L+1)/2', 5, fixed)).toBe(3)
    expect(term({ roll: [1, 3], mul: 2, add: 1 }, 1, fixed)).toBe(7)
    expect(amount({ n: 'L/2', d: 4, plus: 'L/2' }, 5, fixed)).toEqual({ n: 2, total: 10 })
    expect(amount({ n: '(L+1)/2', d: 4, plus: 'n' }, 5, fixed)).toEqual({ n: 3, total: 15 })
  })

  it('takes the duration special cases from the profile (FUN_4e53_07d6)', () => {
    setGame(POR)
    const e = { roll: (n: number, d: number) => n * d } as unknown as Engine
    const s = (id: number) => ({ id, duration: [4, 5] }) as unknown as Spell
    expect(duration(e, s(63), 1, true)).toBe(200) // 2d10 × 10
    expect(duration(e, s(63), 1, false)).toBe(200) // (1d10 + 10) × 10
    expect(duration(e, s(59), 1)).toBe(80) // 1d4 × 10 + 40
    expect(duration(e, s(67), 1)).toBe(1440)
    expect(duration(e, s(5), 3)).toBe(19) // 4 + 5 × 3
  })
})
