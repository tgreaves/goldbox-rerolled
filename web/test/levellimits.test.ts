// Demi-human training limits as the originals test them (PoR FUN_417f_29ae, CotAB 0x3B631, SotSB 0x3DD4C;
// spec/A-games/engine/chargen-and-progression.md, sotsb/chargen-and-progression.md §1). Needs no game files.
import { afterAll, describe, expect, it } from 'vitest'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'
import { atLevelLimit } from '../src/rules/training'

function char(race: number, k: number, level: number, str: number, int = 10): Uint8Array {
  const c = new Uint8Array(F.size)
  c[F.race] = race; c[F.levels + k] = level; c[F.stat[0]] = str; c[F.stat[1]] = int
  return c
}
const refused = (race: number, k: number, str: number, int = 10) =>
  Array.from({ length: 15 }, (_, i) => i + 1).filter((L) => atLevelLimit(char(race, k, L, str, int), k))

describe('demi-human level limits', () => {
  afterAll(() => setGame(POR))

  it('refuses PoR’s banded rows only at the band’s limit or the top one', () => {
    setGame(POR)
    expect(refused(1, 2, 16)).toEqual([7]) // dwarf fighter: 7 below STR 17; 9 is not tested (0x34276)
    expect(refused(1, 2, 17)).toEqual([8])
    expect(refused(1, 2, 18)).toEqual([])
    expect(refused(2, 2, 16)).toEqual([5, 7]) // elf fighter: 5 below STR 17, and 7 always
    expect(refused(3, 2, 17)).toEqual([5, 6]) // gnome: < 18 is the lower band
    expect(refused(4, 0, 3)).toEqual([5]) // half-elf cleric
    expect(refused(6, 2, 3)).toEqual([]) // half-orc: no limit coded
  })

  it('refuses CotAB’s dwarf fighter at 9 too, and its elf magic-user by INT (0x3B657, 0x3B6B8)', () => {
    setGame(COAB)
    expect(refused(1, 2, 16)).toEqual([7, 9])
    expect(refused(2, 5, 10, 16)).toEqual([9, 11])
    expect(refused(2, 5, 10, 17)).toEqual([10, 11])
    expect(refused(2, 5, 10, 18)).toEqual([11])
  })

  it('refuses SotSB’s dwarf, elf and gnome clerics at their limit and above (0x3DD80, 0x3DDF7, 0x3DE2E)', () => {
    setGame(SOTSB)
    expect(refused(3, 0, 18)).toEqual([8, 9, 10, 11, 12, 13, 14, 15])
    expect(refused(1, 0, 18)[0]).toBe(7)
    expect(refused(4, 0, 18)[0]).toBe(7)
    expect(refused(2, 0, 18)).toEqual([5]) // half-elf cleric: level 5 only
    expect(refused(3, 2, 16)).toEqual([7, 9]) // dwarf fighter as PoR's, re-keyed
    expect(refused(2, 4, 17)).toEqual([7, 8]) // half-elf ranger with the fighter
    expect(refused(6, 0, 3)).toEqual([]) // human
  })
})
