// The training hall's window (IMP-101): which classes a hall trains, and each member's status with the
// hall's class rule before the fee, worked out without changing the character. Needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { POR, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'
import { msg } from '../src/games/strings'
import { hallClasses, trainingStatus } from '../src/rules/training'
import { installNames } from '../src/data/character'

const dir = process.env.POOLRAD ?? ''

describe.skipIf(!dir || !existsSync(dir))('training hall status (PoR)', () => {
  setGame(POR)
  const img = () => unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE')))).image
  installNames(img()) // the coin values the fee is counted in
  const t = () => new Tables(img())
  /** a level-1 character of base class k with `xp` experience and `pp` platinum */
  const char = (k: number, xp: number, pp: number) => {
    const c = new Uint8Array(0x200)
    c[F.levels + k] = 1
    new DataView(c.buffer).setUint32(F.xp, xp, true)
    c[F.money + 8] = pp & 0xff; c[F.money + 9] = pp >> 8
    return c
  }

  it('names the classes a hall trains (cleric hall: mask 2)', () => {
    expect(hallClasses(t(), 2, [0, 2, 5, 6])).toEqual([0])
    expect(hallClasses(t(), 8, [0, 2, 5, 6])).toEqual([2])
  })

  it('puts the hall\'s class before the fee, and changes nothing', () => {
    const tb = t()
    const fighter = char(2, 50000, 0) // far past level 2, no money
    const before = fighter.slice()
    expect(trainingStatus(tb, fighter, 2).message).toBe(msg('notThatClass'))
    expect(fighter).toEqual(before) // the check proper would cap the experience
    const poorCleric = char(0, 1600, 0)
    const s = trainingStatus(tb, poorCleric, 2)
    expect([s.ok, s.message, s.train]).toEqual([false, msg('trainingCosts'), [0]])
    const cleric = char(0, 1600, 200)
    expect(trainingStatus(tb, cleric, 2)).toMatchObject({ ok: true, train: [0] })
    expect(trainingStatus(tb, char(0, 10, 200), 2).message).toBe(msg('notEnoughXp'))
  })
})
