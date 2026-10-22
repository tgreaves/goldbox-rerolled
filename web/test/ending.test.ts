// The endings' captions are read from GAME.OVR by offset (games/ending.ts): every offset must hold text.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { COAB_ENDING, POR_ENDING, type EndingScript } from '../src/games/ending'

const captions = (dir: string, s: EndingScript) => {
  const img = new Uint8Array(readFileSync(join(dir, 'GAME.OVR')))
  const offsets = s.steps.flatMap((x) => ('text' in x ? x.text : []))
  return offsets.map((o) => String.fromCharCode(...img.subarray(s.cs + o + 1, s.cs + o + 1 + img[s.cs + o])))
}

describe('ending captions', () => {
  it.skipIf(!process.env.POOLRAD || !existsSync(process.env.POOLRAD))('Pool of Radiance', () => {
    const t = captions(process.env.POOLRAD!, POR_ENDING)
    expect(t[0]).toBe('Mortally wounded, the dragon roars!')
    expect(t[t.length - 1]).toBe('Noooo...')
    expect(t.every((x) => /^[\x20-\x7e]+$/.test(x))).toBe(true)
  })
  it.skipIf(!process.env.COAB || !existsSync(process.env.COAB))('Curse of the Azure Bonds', () => {
    const t = captions(process.env.COAB!, COAB_ENDING)
    expect(t[0]).toMatch(/^Tyranthraxus' spirit/)
    expect(t[t.length - 1]).toMatch(/You have won!'$/)
    expect(t.every((x) => /^[\x20-\x7e]+$/.test(x))).toBe(true)
  })
})
