// Who may join the party (CotAB Add 0x36848 + 0x3815; PoR: party size only).
import { afterAll, describe, expect, it } from 'vitest'
import { COAB, POR, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'
import { joinRefusal } from '../src/rules/joining'
import { msg } from '../src/games/strings'

const who = (nm: string, cls: Record<number, number>, alignment = 0, id = 0) => {
  const c = new Uint8Array(F.size)
  c[F.name] = nm.length
  for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
  for (const [k, v] of Object.entries(cls)) c[F.levels + Number(k)] = v
  c[F.alignment] = alignment
  c[F.id] = id
  return c
}

describe('joining the party', () => {
  afterAll(() => setGame(POR))
  it('CotAB: paladins, evil and rangers', () => {
    setGame(COAB)
    const pal = who('MATHEW', { 3: 5 }), thug = who('THUG', { 2: 3 }, 8), r = (n: string) => who(n, { 4: 2 })
    expect(joinRefusal([], thug)).toBeNull() // the first member: no checks
    expect(joinRefusal([thug], pal)).toBe(msg('noEvilScum'))
    expect(joinRefusal([pal], thug)).toBe(`MATHEW${msg('toleratesNoEvil')}`)
    expect(joinRefusal([r('A'), r('B'), r('C')], r('D'))).toBe(msg('tooManyRangers'))
    expect(joinRefusal([r('A'), r('B')], r('C'))).toBeNull()
    expect(joinRefusal([pal], who('MATHEW', { 3: 5 }))).toBe('') // already there (name and id)
  })
  it('PoR: only the party size', () => {
    setGame(POR)
    const evil = who('THUG', { 2: 3 }, 8)
    expect(joinRefusal([who('P', { 3: 1 })], evil)).toBeNull()
    const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => who(n, { 2: 1 }))
    expect(joinRefusal(six, who('G', { 2: 1 }))).toBe('The party is full.')
  })
})
