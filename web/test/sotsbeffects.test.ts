// SotSB's effect handlers (spec/A-games/sotsb/effects.md §3) by their behaviours and the parameters in
// games/effectrules.ts SOTSB_EFFECTS, on a plain host: no game files needed (the lines are addresses).
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { Effect } from '../src/data/effects'
import { fx, has, setStatusOf, type FxHost } from '../src/rules/effects'
import { BEHAVIOURS } from '../src/rules/effectkinds'
import { POR, SOTSB, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'

function world() {
  const fx_: Map<Uint8Array, Effect[]> = new Map()
  const people: Uint8Array[] = []
  const dice: number[] = []
  const printed: string[] = []
  const targets = new Map<Uint8Array, Uint8Array>()
  let current: Uint8Array | null = null
  const saves: boolean[] = []
  const add = (nm: string, side: number, opts: { hp?: number; hd?: number } = {}) => {
    const c = new Uint8Array(F.size)
    c[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
    c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = opts.hp ?? 50; c[F.hitDice] = opts.hd ?? 1
    people.push(c); fx_.set(c, [])
    return c
  }
  const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
  const base: Partial<FxHost> = {
    effectsOf: (c) => fx_.get(c)!, itemsOf: () => [], print: (t) => printed.push(t),
    roll: (n) => (dice.length ? dice.shift()! : n), name, all: () => people, inCombat: () => true,
    distance: () => 1, targetOf: (c) => targets.get(c) ?? null, current: () => current,
    endTurn: () => {}, rec: () => 0, setRec: () => {},
    setStatus: (c, s, m) => { setStatusOf(h, c, s, m) },
    damage: (c, d) => { c[F.hp] = Math.max(0, c[F.hp] - d) },
    save: () => saves.shift() ?? false, heal: () => true, revive: () => true, recalc: () => {},
    enemiesNear: (c) => people.filter((o) => o[F.side] !== c[F.side]), byIndex: () => null, indexOf: (c) => people.indexOf(c),
    attack: async () => {}, weapon: () => null, weaponKind: () => 0,
  }
  const h = base as FxHost
  const run = (type: number, holder: Uint8Array, event: number, power = 0, removal = false) =>
    BEHAVIOURS[SOTSB.effects.handlers[type].b](h, { type, duration: 0, power, flag: 0 }, holder, removal, SOTSB.effects.handlers[type], event, type)
  return { h, add, dice, printed, targets, saves, run, setCurrent: (c: Uint8Array | null) => { current = c } }
}

describe('SotSB effects (SOTSB_EFFECTS)', () => {
  beforeEach(() => { setGame(SOTSB); Object.assign(fx, { roll: 0, save: 0, dmg: 0, dmgType: 0, spell: 0, area: false, adding: 0, round: 0 }) })
  afterAll(() => setGame(POR))

  it('the event lists as read at 0x50D26: 13, 16 and 23 gone, 15 with the turn-start types', () => {
    const ev = SOTSB.effects.events
    expect([ev[13], ev[16], ev[23]]).toEqual([undefined, undefined, undefined])
    expect(ev[15]).toEqual([3, 5, 11, 21, 27, 30, 77, 106, 25, 37, 47, 48, 69, 89])
    expect(SOTSB.effects.ids.goingDown).toHaveLength(14)
  })

  it('13 (0x2D6DC): the save +1 unless magic, the roll −1', () => {
    const { add, run } = world()
    const c = add('A', 0)
    fx.dmgType = 1; run(13, c, 12); fx.dmgType = 8; run(13, c, 12)
    expect([fx.save, fx.roll]).toEqual([1, -2])
  })

  it('28 Mirror Image (0x2DBB3): a weapon attack loses an image too', () => {
    const { add, dice, run, printed } = world()
    const c = add('M', 0)
    dice.push(2)
    fx.dmg = 9
    run(28, c, 5, 0x22)
    expect(fx.dmg).toBe(0)
    expect(printed).toHaveLength(1)
  })

  it('64 poison on hit (0x2EB97): "is POISONED" (0x37) and status 6', async () => {
    const { h, add, run, targets, setCurrent } = world()
    const a = add('SNAKE', 1), t = add('T', 0)
    targets.set(a, t); setCurrent(a)
    await run(64, a, 3)
    expect([has(h, t, 0x37), t[F.status]]).toEqual([true, 6])
  })

  it('66 swallow whole (0x2ED56): only a natural 20 (roll 100) swallows; the victim is killed', () => {
    const { add, run, targets, dice } = world()
    const a = add('WORM', 1), t = add('T', 0)
    targets.set(a, t)
    fx.roll = 19; run(66, a, 4)
    expect(t[F.inPlay]).toBe(1)
    fx.roll = 100; dice.push(80); run(66, a, 4)
    expect([t[F.inPlay], t[F.status]]).toEqual([0, 6])
  })

  it('79 (0x2F7B9): magical fire heals, electricity slows (0x2A for 3), all else negated', () => {
    const { h, add, run } = world()
    const c = add('G', 1, { hp: 40 })
    c[F.hp] = 20
    fx.dmg = 15; fx.dmgType = 9; run(79, c, 6)
    expect([c[F.hp], fx.dmg]).toEqual([35, 0])
    fx.dmg = 15; fx.dmgType = 4; run(79, c, 6)
    expect([h.effectsOf(c).map((e) => [e.type, e.duration]), fx.dmg]).toEqual([[[0x2a, 3]], 0])
  })

  it('82 (0x2FB66): enemies below 5 HD without 0x5C or 0x6F are terrified (0x6F)', async () => {
    const { h, add, run } = world()
    const m = add('DRAGON', 1), a = add('A', 0, { hd: 3 }), b = add('B', 0, { hd: 6 }), c = add('C', 0, { hd: 2 })
    h.effectsOf(c).push({ type: 0x5c, duration: 0, power: 0, flag: 0 })
    await run(82, m, 8)
    expect([a, b, c].map((x) => h.effectsOf(x).some((e) => e.type === 0x6f))).toEqual([true, false, false])
  })

  it('81 spit (0x2F9EC): 10 % in round 0, else (11 − distance) × 10 %; 4d8 acid, half on a save', async () => {
    const { add, run, targets, dice, printed } = world()
    const s = add('S', 1), t = add('T', 0, { hp: 60 })
    targets.set(s, t)
    dice.push(11) // d100 above 10 in round 0
    await run(81, s, 14)
    expect(printed).toHaveLength(1) // "Spits and misses"
    fx.round = 2; dice.push(100, 20) // (11 − 1) × 10 = 100 %, then 4d8 = 20
    await run(81, s, 14)
    expect(t[F.hp]).toBe(40)
  })

  it('15 (0x2D705): when called, not on removal, re-armed as 0x1A for 10 at its power; 1 point above 1 HP', () => {
    const { h, add, run } = world()
    const c = add('P', 0, { hp: 20 })
    run(15, c, 0, 0x33, true)
    expect([h.effectsOf(c).length, c[F.hp]]).toEqual([0, 20])
    run(15, c, 0, 0x33)
    expect([h.effectsOf(c).map((e) => [e.type, e.duration, e.power, e.flag]), c[F.hp]]).toEqual([[[0x1a, 10, 0x33, 1]], 19])
  })

  it('94 (0x3001F): saves 4, 2, 0 better by CON 4–20 in bands; none outside them', () => {
    const { add, run } = world()
    const c = add('D', 0)
    const at = (con: number, type = 4) => { c[F.stat[4]] = con; fx.save = 0; fx.saveType = type; run(94, c, 12); return fx.save }
    expect([3, 4, 6, 7, 10, 11, 13, 14, 17, 18, 20, 21, 25].map((n) => at(n))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 0, 0])
    expect([at(18, 0), at(18, 2), at(18, 1)]).toEqual([5, 5, 0])
  })

  it('110 (0x308B4): the paladin\'s uses back on removal, (level − 1) idiv 5 + 1, level 0 giving 1', () => {
    const { add, run } = world()
    const c = add('PAL', 0)
    const at = (lv: number) => { c[F.levels + 3] = lv; c[F.abilityUses] = 0; run(110, c, 0, 0, true); return c[F.abilityUses] }
    expect([0, 1, 5, 6, 11].map(at)).toEqual([1, 1, 1, 2, 3])
  })
})
