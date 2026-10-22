// Secret of the Silver Blades' sound driver: CotAB's, its variables moved by −0xBF and its code by +0x20D2,
// the effect tables at CS:0x04A0 and CS:0x0508 (games/sound.ts, spec/A-games/sotsb/assets.md §6.3).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { renderEffect } from '../src/audio/driver'
import { COAB, POR, SOTSB, setGame } from '../src/games/profile'

const dir = process.env.SOTSB ?? ''
describe.skipIf(!dir || !existsSync(dir))('Secret of the Silver Blades sound', () => {
  afterAll(() => setGame(POR))
  // the effects the game plays: PlaySound 2–12, effects 1–11 (DS:19C4's arguments)
  const USED = 11
  const render = (g: typeof POR, d: string) => {
    setGame(g)
    const img = unexepack(new Uint8Array(readFileSync(join(d, 'START.EXE')))).image
    return Array.from({ length: USED }, (_, k) => renderEffect(img, k + 1, 22050))
  }
  it('renders the effects it uses, 2–11 audible (effect 1 is silent, as in CotAB)', () => {
    const s = render(SOTSB, dir)
    expect(s.map((a) => a.some((v) => v !== 0))).toEqual([false, ...new Array(USED - 1).fill(true)])
  })
  it('sounds as CotAB does where the data match', () => {
    const coab = process.env.COAB ?? ''
    if (!coab || !existsSync(coab)) return
    const s = render(SOTSB, dir), c = render(COAB, coab)
    const same = s.filter((a, k) => a.length === c[k].length && a.every((v, i) => v === c[k][i])).length
    expect(same).toBeGreaterThanOrEqual(USED - 2)
  })
})
