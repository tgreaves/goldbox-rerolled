// Character fields by name (docs/multi-game.md, step 2): each game's map read against that game's own
// characters. Needs POOLRAD and COAB.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { COAB_FIELDS, POR_FIELDS, type CharFields } from '../src/games/fields'

const name = (c: Uint8Array, f: CharFields) => String.fromCharCode(...c.subarray(f.name + 1, f.name + 1 + c[f.name]))
const u16 = (c: Uint8Array, o: number) => c[o] | (c[o + 1] << 8)
const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0

describe('field maps', () => {
  it('every scalar field lies inside its record', () => {
    for (const f of [POR_FIELDS, COAB_FIELDS]) {
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === 'number' && !k.endsWith('Count') && k !== 'slotLevels' && k !== 'size') expect(v, k).toBeLessThan(f.size)
      }
      expect(f.hp).toBe(f.size - 2)
      expect(f.move).toBe(f.size - 1)
    }
  })
})

const coab = process.env.COAB ?? ''
describe.skipIf(!coab || !existsSync(coab))('Curse of the Azure Bonds pre-made party (spec/A-games/coab/records.md §2.3)', () => {
  const F = COAB_FIELDS
  const load = (n: number) => new Uint8Array(readFileSync(join(coab, 'SAVE', `CHRDATA${n}.SAV`)))

  it('reads names, classes, hit points, experience and money', () => {
    const want = [
      ['MATHEW', 7, 3, 5, 49, 25000], ['MARK', 7, 3, 5, 51, 25000], ['TRAVIS', 1, 14, 5, 34, 12500],
      ['LEDERA', 2, 13, 4, 28, 12500], ['SHARA', 7, 0, 5, 29, 25000], ['PHILIPPE', 7, 5, 5, 27, 25000],
    ] as const
    want.forEach(([nm, race, cls, top, hp, xp], i) => {
      const c = load(i + 1)
      expect(c.length).toBe(F.size)
      expect(name(c, F)).toBe(nm)
      expect(c[F.race]).toBe(race)
      expect(c[F.cls]).toBe(cls)
      expect(Math.max(...c.subarray(F.levels, F.levels + 8))).toBe(top)
      expect(c[F.hitDice]).toBe(top)
      expect(c[F.hp]).toBe(hp)
      expect(c[F.maxHp]).toBe(hp)
      expect(u32(c, F.xp)).toBe(xp)
      expect(u16(c, F.money + 2 * 4)).toBe(300) // platinum
      expect(c[F.status]).toBe(0)
      expect(c[F.itemCount]).toBe(0)
      for (let s = 0; s < 6; s++) expect(c[F.stat[s]]).toBe(c[F.baseStat[s]])
    })
  })

  it('places the paladins\' level and STR 18/00, and the magic-users\' slots', () => {
    const m = load(1)
    expect(m[F.levels + 3]).toBe(5) // paladin
    expect(m[F.stat[0]]).toBe(18)
    expect(m[F.strPct]).toBe(100)
    const l = load(4)
    expect([l[F.levels + 2], l[F.levels + 5]]).toEqual([4, 4]) // fighter 4, magic-user 4
    expect([...l.subarray(F.muSlots, F.muSlots + 2)]).toEqual([3, 2])
    const s = load(5)
    expect([...s.subarray(F.clericSlots, F.clericSlots + 3)]).toEqual([5, 5, 2])
    expect(60 - s[F.thac0Base]).toBe(18)
  })
})

const por = process.env.POOLRAD ?? ''
describe.skipIf(!por || !existsSync(por))('Pool of Radiance characters', () => {
  it('read through the PoR map as before', () => {
    const c = new Uint8Array(readFileSync(join(por, 'CHRDATA1.SAV')))
    expect(c.length).toBe(POR_FIELDS.size)
    expect(name(c, POR_FIELDS)).toMatch(/^[A-Z ]+$/)
    expect(c[POR_FIELDS.hp]).toBeLessThanOrEqual(c[POR_FIELDS.maxHp])
  })
})
