// The temple's services from each game's own tables (docs/multi-game.md, step 6).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { COAB, POR, setGame } from '../src/games/profile'
import { R } from '../src/games/rules'
import { T } from '../src/games/tables'

const names = (dir: string) => {
  const img = unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
  const name = (i: number) => { const o = T.ds + T.templeNames.at + i * T.templeNames.row; return String.fromCharCode(...img.subarray(o + 1, o + 1 + img[o])) }
  return { list: R.temple.map((_, i) => name(i)), after: name(R.temple.length), diseases: Array.from({ length: 6 }, (_, i) => img[T.ds + T.diseases.at + 1 + i]) }
}

describe('temple tables', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('Pool of Radiance: nine services, then Exit', () => {
    setGame(POR)
    const n = names(process.env.POOLRAD!)
    expect(n.list[5]).toBe('Neutralize Poison')
    expect(n.after).toBe('Exit')
    expect(n.diseases).toEqual([31, 34, 43, 44, 50, 57])
  })
  it.skipIf(!process.env.COAB || !existsSync(process.env.COAB))('Curse of the Azure Bonds: Heal after Cure Critical Wounds', () => {
    setGame(COAB)
    const n = names(process.env.COAB!)
    expect(n.list[R.temple.findIndex((x) => x.kind === 'heal')]).toBe('Heal')
    expect(n.list[R.temple.findIndex((x) => x.kind === 'stone')]).toBe('Stone to Flesh')
    expect(n.after).toBe('Exit')
    expect(n.diseases).toEqual([31, 34, 43, 44, 50, 57])
  })
})
