// The script VM memory map per game (docs/multi-game.md, step 4; spec/A-games/coab/ecl.md "Memory map").
import { describe, expect, it } from 'vitest'
import { canonical, native, COAB_ECL, POR_ECL } from '../src/games/ecl'

describe('script addresses', () => {
  it('are unchanged for Pool of Radiance', () => {
    for (const a of [0x4900, 0x49f2, 0x6dc7, 0x9700, 0x9914, 0xc04b]) expect(canonical(POR_ECL, a)).toBe(a)
  })
  it('move CotAB\'s regions onto the engine\'s, keeping offsets', () => {
    expect(canonical(COAB_ECL, 0x4bf2)).toBe(0x49f2) // area id
    expect(canonical(COAB_ECL, 0x7f3e)).toBe(0x6e3e) // party size
    expect(canonical(COAB_ECL, 0x7ca7)).toBe(0x6ba7) // a thief skill in the character view
    expect(canonical(COAB_ECL, 0x7a10)).toBe(0x9710) // C
    expect(canonical(COAB_ECL, 0x8014)).toBe(0x9914) // the "nothing" vector
    expect(canonical(COAB_ECL, 0x9dff)).toBe(0xb6ff) // last code byte
    expect(canonical(COAB_ECL, 0xc04d)).toBe(0xc04d) // engine register
    expect(canonical(COAB_ECL, 0x4900)).toBe(0xfff0) // PoR's A, not CotAB's
    expect(native(COAB_ECL, canonical(COAB_ECL, 0x7ec7))).toBe(0x7ec7)
  })
})
