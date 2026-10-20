// CotAB paladin abilities (rules/abilities.ts) and creation effects, on the shipped characters.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, setGame, wants } from '../src/games/profile'
import { F } from '../src/games/fields'
import { WorldHost } from '../src/rules/worldfx'
import { abilities, useAbility } from '../src/rules/abilities'
import { removeEffect } from '../src/rules/effects'
import { startEffects } from '../src/rules/chargen'

const dir = process.env.COAB ?? ''
const io = { print: () => {}, menu: async () => 0, inputNumber: async () => 0, inputText: async () => '', picture: () => {},
  sprite: () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {}, engine: async () => {} } as unknown as Io

describe.skipIf(!dir || !existsSync(dir))('CotAB paladin abilities', () => {
  afterAll(() => setGame(POR))
  const engine = () => {
    setGame(COAB)
    const m = new Map<string, Uint8Array>()
    const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(COAB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
    walk(dir)
    const files = new GameFiles(m, COAB)
    const e = new Engine(files, io, 3)
    e.newGame([1, 2, 3].map((n) => files.get(`CHRDATA${n}.SAV`)!))
    return e
  }

  it('Lay on Hands heals 2 × level, then waits a day', () => {
    const e = engine(), h = new WorldHost(e)
    const [mathew, , travis] = e.party()
    expect(abilities(e, mathew, false)).toContain('layOnHands')
    expect(abilities(e, travis, false)).toEqual([]) // not a paladin
    expect(abilities(e, mathew, true)).toEqual([]) // not in combat
    travis[F.hp] = 10
    expect(useAbility(h, e, mathew, 'layOnHands', travis)).toEqual(['TRAVIS feels better'])
    expect(travis[F.hp]).toBe(20) // paladin 5
    expect(abilities(e, mathew, false)).not.toContain('layOnHands')
  })

  it('Cure Disease spends a use; the weekly effect refills it by level', async () => {
    const e = engine(), h = new WorldHost(e)
    const [mathew] = e.party()
    mathew[F.abilityUses] = 1
    expect(abilities(e, mathew, false)).toContain('cureDisease')
    useAbility(h, e, mathew, 'cureDisease', e.party()[1])
    expect(mathew[F.abilityUses]).toBe(0)
    const week = e.effectsOf(mathew).find((x) => x.type === 0x8d)!
    await removeEffect(h, mathew, week)
    expect(mathew[F.abilityUses]).toBe(1) // (5 − 1) div 5 + 1
  })

  it('gives new characters their race and class effects', () => {
    setGame(COAB)
    const c = new Uint8Array(F.size)
    c[F.race] = 1; c[F.cls] = 4 // dwarf ranger (as the data allows it, for the test)
    expect(startEffects(c).map((x) => x.type)).toEqual([0x61, 0x1a, 0x2f, 0x86])
    expect(startEffects(c).every((x) => x.duration === 0 && x.power === 0xff)).toBe(true)
  })
})
