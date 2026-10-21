// Training and derived statistics (spec/A-games/engine/chargen-and-progression.md) against the shipped characters; needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Tables } from '../src/rules/chargen'
import { installNames } from '../src/data/character'
import { unexepack } from '../src/data/exepack'
import { checkTraining, derive, train, xpFor } from '../src/rules/training'
import { installText } from '../src/data/gametext'
import { msg } from '../src/games/strings'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('training', () => {
  const img = have ? unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image : null
  if (img) installNames(img) // names and coin values
  if (have) installText(new Uint8Array(readFileSync(join(dir, 'START.EXE'))), new Uint8Array(readFileSync(join(dir, 'GAME.OVR'))))
  const t = img ? new Tables(img) : (null as unknown as Tables)
  const chars = () => readdirSync(dir).filter((n) => /^CHRDAT.+\.SAV$/.test(n)).map((f) => ({ f, c: new Uint8Array(readFileSync(join(dir, f))) }))

  it('derives the stored THAC0, slots, saves and thief skills of every pre-made character', () => {
    const fields = [0x2d, 0x73, 0xa1, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0x6d, 0x6e, 0x6f, 0x70, 0x71, ...Array.from({ length: 8 }, (_, i) => 0x77 + i)]
    for (const { f, c } of chars()) {
      const d = c.slice()
      derive(t, d)
      expect(fields.map((o) => d[o]), f).toEqual(fields.map((o) => c[o]))
    }
  })

  it('trains a fighter with enough experience and gold in the fighters’ hall', () => {
    const { c } = chars().find(({ c }) => c[0x98] === 1 && c[0x2f] === 2)!
    const xp = xpFor(t, 2, 2)
    c[0xac] = xp & 0xff; c[0xad] = (xp >> 8) & 0xff; c[0xae] = 0; c[0xaf] = 0
    c[0x8e] = 1000 & 0xff; c[0x8f] = 1000 >> 8 // 1000 gp
    expect(checkTraining(t, c, 114).message).toBe(msg('notThatClass'))
    const chk = checkTraining(t, c, 120)
    expect(chk.ok).toBe(true)
    const hp = c[0x32]
    const value = () => [1, 10, 100, 200, 1000].reduce((a, v, i) => a + v * (c[0x88 + 2 * i] | (c[0x89 + 2 * i] << 8)), 0)
    const before = value()
    train(t, { roll: (n: number, s: number) => n * s }, c, chk.train) // every die its highest face
    expect(c[0x98]).toBe(2)
    expect(60 - c[0x2d]).toBe(19) // fighter level 2 THAC0
    expect(c[0x32]).toBeGreaterThan(hp)
    expect(before - value()).toBe(1000 * 200) // 1000 gp in copper units
  })
})

describe.skipIf(!have)('level caps', () => {
  it('reads the game caps from the experience table', async () => {
    const { readFileSync: rf } = await import('node:fs')
    const { unexepack } = await import('../src/data/exepack')
    const { Tables } = await import('../src/rules/chargen')
    const { maxLevel } = await import('../src/rules/training')
    const t = new Tables(unexepack(new Uint8Array(rf(join(dir, 'START.EXE')))).image)
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((k) => maxLevel(t, k))).toEqual([6, 1, 8, 1, 1, 6, 9, 1])
  })
})
