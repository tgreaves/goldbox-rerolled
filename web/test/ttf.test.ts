// The game font as TrueType (IMP-038): structure checks here; tools/ checks it with fontTools.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { buildTtf, charMap } from '../src/data/ttf'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('game font as TrueType', () => {
  it('builds a font whose checksum adjusts to the magic value', () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const rec = new GameFiles(m).record('8X8D1', 201)!
    const ttf = buildTtf(rec)
    let s = 0
    for (let i = 0; i < ttf.length; i += 4) s = (s + (((ttf[i] << 24) | ((ttf[i + 1] ?? 0) << 16) | ((ttf[i + 2] ?? 0) << 8) | (ttf[i + 3] ?? 0)) >>> 0)) >>> 0
    expect(s).toBe(0xb1b0afba)
    expect(charMap().get(0x61)).toBe(1)
    if (process.env.TTF_OUT) writeFileSync(process.env.TTF_OUT, ttf)
  })
})
