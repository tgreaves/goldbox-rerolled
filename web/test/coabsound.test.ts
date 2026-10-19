// Curse of the Azure Bonds' sound driver: PoR's code moved by −0xBD (games/sound.ts).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { NUM_EFFECTS, renderEffect } from '../src/audio/driver'
import { COAB, POR, setGame } from '../src/games/profile'

const dir = process.env.COAB ?? ''
describe.skipIf(!dir || !existsSync(dir))('Curse of the Azure Bonds sound', () => {
  afterAll(() => setGame(POR))
  it('renders every effect through its own driver, as Pool of Radiance does where the data match', () => {
    const por = process.env.POOLRAD ?? ''
    if (!por || !existsSync(por)) return
    const render = (g: typeof POR, d: string) => {
      setGame(g)
      const img = unexepack(new Uint8Array(readFileSync(join(d, 'START.EXE')))).image
      return Array.from({ length: NUM_EFFECTS }, (_, k) => renderEffect(img, k + 1, 22050))
    }
    const p = render(POR, por), c = render(COAB, dir)
    const same = p.filter((a, k) => a.length === c[k].length && a.every((v, i) => v === c[k][i])).length
    const audible = (xs: Float32Array[]) => xs.filter((a) => a.some((v) => v !== 0)).length
    expect(audible(c)).toBe(audible(p))
    expect(same).toBeGreaterThanOrEqual(NUM_EFFECTS - 3)
})
})
