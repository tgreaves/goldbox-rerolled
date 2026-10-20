// Every handler of an event counts before the caller reads the globals (FUN_5216_02fa calls them in turn),
// even when the caller does not wait (a saving throw's event 12).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { WorldHost } from '../src/rules/worldfx'
import { fire, fx } from '../src/rules/effects'
import { POR, setGame } from '../src/games/profile'

const dir = process.env.POOLRAD ?? ''
describe.skipIf(!dir || !existsSync(dir))('effect chains', () => {
  it('Resist Cold and Resist Fire both add to the same save at once', () => {
    setGame(POR)
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const e = new Engine(files, { print: () => {} } as unknown as Io, 1)
    e.newGame([files.get('CHRDATA1.SAV')!])
    const c = e.party()[0]
    e.effectsOf(c).push({ type: 10, duration: 60, power: 0, flag: 0 }, { type: 20, duration: 60, power: 0, flag: 0 })
    fx.save = 0
    void fire(new WorldHost(e), c, 12)
    expect(fx.save).toBe(6)
  })
})
