// Pool of Radiance characters into Curse of the Azure Bonds (games/imports.ts, rules/import.ts; 323c:14b3).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { importsFrom } from '../src/store/savefiles'
import { COAB, POR, setGame } from '../src/games/profile'
import { F, POR_FIELDS } from '../src/games/fields'
import { parseEffects } from '../src/data/effects'

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''
describe.skipIf(!por || !existsSync(por) || !coab || !existsSync(coab))('Pool of Radiance characters into CotAB', () => {
  afterAll(() => setGame(POR))
  it('converts the save-slot characters as the original does, without its STR bug', () => {
    setGame(COAB)
    const t = new Tables(unexepack(new Uint8Array(readFileSync(join(coab, 'START.EXE')))).image)
    const files = readdirSync(por).filter((n) => /^CHRDATA\d\.SAV$/.test(n)).map((n) => ({ name: n, data: new Uint8Array(readFileSync(join(por, n))) }))
    const { chars, from } = importsFrom(files, t)
    expect(from).toEqual(['Pool of Radiance'])
    expect(chars.length).toBe(files.length)
    for (const [i, c] of chars.entries()) {
      const p = files[i].data, s = c.sav
      const name = (r: Uint8Array) => String.fromCharCode(...r.subarray(1, 1 + r[0]))
      expect(s.length).toBe(F.size)
      expect(name(s)).toBe(name(p))
      expect([...s.subarray(F.levels, F.levels + 8)]).toEqual([...p.subarray(POR_FIELDS.levels, POR_FIELDS.levels + 8)])
      expect(s[F.hp]).toBe(p[POR_FIELDS.hp])
      expect(s[F.money + 8] | (s[F.money + 9] << 8)).toBe(300) // 300 platinum
      expect(s[F.money + 6] | (s[F.money + 7] << 8)).toBe(0)
      expect(s[F.known + 36]).toBe(0) // Animate Dead forgotten
      for (let k = 0; k < 6; k++) { expect(s[F.baseStat[k]]).toBe(s[F.stat[k]]); expect(s[F.stat[k]]).toBeLessThanOrEqual(19) } // no STR 100 (IMP-070)
      expect(parseEffects(c.spc).length).toBe(0) // save-slot characters bring no effects
    }
  })
})
