// Pool of Radiance characters into Curse of the Azure Bonds (games/imports.ts, rules/import.ts; 323c:14b3).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { importsFrom } from '../src/store/savefiles'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'
import { COAB_FIELDS, F, POR_FIELDS } from '../src/games/fields'
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

// CotAB characters into SotSB (Add's "Curse", 0x405E3): the pre-made party's records, as roster .GUY files
const sotsb = process.env.SOTSB ?? ''
describe.skipIf(!coab || !existsSync(coab) || !sotsb || !existsSync(sotsb))('CotAB characters into SotSB', () => {
  afterAll(() => setGame(POR))
  it('moves each field to its SotSB place, renumbers the race, brings no money, items or save-slot files', () => {
    setGame(SOTSB)
    const t = new Tables(unexepack(new Uint8Array(readFileSync(join(sotsb, 'START.EXE')))).image)
    const dir = join(coab, 'SAVE')
    const src = readdirSync(dir).filter((n) => /^CHRDATA\d\.SAV$/.test(n)).map((n) => new Uint8Array(readFileSync(join(dir, n))))
    const files = src.map((data, i) => ({ name: `C${i}.GUY`, data }))
    const { chars, from } = importsFrom([...files, { name: 'CHRDATA1.SAV', data: src[0] }, { name: 'C0.FX', data: new Uint8Array(9) }], t)
    expect(from).toEqual(['Curse of the Azure Bonds'])
    expect(chars.length).toBe(src.length) // the save-slot file is not a source
    const C = COAB_FIELDS
    const race: Record<number, number> = { 1: 3, 2: 1, 3: 4, 4: 2, 5: 5, 7: 6 }
    for (const [i, ch] of chars.entries()) {
      const p = src[i], s = ch.sav
      expect(s.length).toBe(0x1b7)
      expect(String.fromCharCode(...s.subarray(1, 1 + s[0]))).toBe(String.fromCharCode(...p.subarray(1, 1 + p[0])).trim())
      expect(s[F.race]).toBe(race[p[C.race]])
      expect([...s.subarray(F.levels, F.levels + 7)]).toEqual([...p.subarray(C.levels, C.levels + 7)])
      expect([...s.subarray(F.clericSlots, F.clericSlots + 5)]).toEqual([...p.subarray(C.clericSlots, C.clericSlots + 5)])
      expect([s[F.hp], s[F.maxHp], s[F.xp], s[F.itemMask], s[F.thac0]]).toEqual([p[C.hp], p[C.maxHp], p[C.xp], p[C.itemMask], p[C.thac0]])
      for (let k = 1; k < 6; k++) expect([s[F.stat[k]], s[F.baseStat[k]]]).toEqual([p[C.stat[k]], p[C.baseStat[k]]])
      expect(s[F.baseStat[0]]).toBeLessThanOrEqual(p[C.baseStat[0]])
      expect([...s.subarray(F.money, F.money + 14)].every((v) => v === 0)).toBe(true)
      expect(s[F.itemCount]).toBe(0)
      for (const id of [36, 56, 63, 90, 96, 98, 100]) expect(s[F.known + id]).toBe(0)
      const fx = parseEffects(ch.spc).map((e) => e.type)
      expect(fx).toEqual([...(s[F.levels + 4] > 0 ? [0x69] : []), ...(s[F.levels + 3] > 0 ? [8] : [])]) // no .FX read
      expect(s[F.abilityUses]).toBe(s[F.levels + 3] > 0 ? 1 : 0)
    }
  })
})
