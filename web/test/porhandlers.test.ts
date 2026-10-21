// PoR effect handlers transcribed exactly (spec/A-games/engine/effects.md, "Port status"): 61 and 113's byte
// arithmetic per die, 117 and 122 on the current character's weapon, and the handlers whose rolls keep
// the dice count (FUN_5216_0e2e → DS:681C). A stub host, no game files needed.
import { describe, expect, it } from 'vitest'
import { addRaw, fx, handle, type FxHost } from '../src/rules/effects'
import { F } from '../src/games/fields'
import { POR, setGame } from '../src/games/profile'
import type { Effect } from '../src/data/effects'
import { text } from '../src/data/gametext'

const c = new Uint8Array(512)
const eff = (type: number): Effect => ({ type, duration: 0, power: 0, flag: 0 })

function host(weaponType: number | null, rolls: number[] = []) {
  const attacker = new Uint8Array(512)
  return {
    current: () => attacker,
    weapon: () => (weaponType === null ? null : { raw: Object.assign(new Uint8Array(63), { [0x2e]: weaponType }) }),
    roll: (n: number, d: number) => rolls.shift() ?? n * d,
  } as unknown as FxHost
}

describe('PoR effect handlers as the original', () => {
  setGame(POR)

  it('61 takes 2 a die off fire as a byte, kept up to the dice count; save +4; non-magic fire negated (1490)', () => {
    fx.dmgType = 9; fx.dice = 3; fx.dmg = 20; fx.save = 0
    void handle(host(null), 61, eff(61), c, 6, false)
    expect([fx.dmg, fx.save]).toEqual([14, 4])
    fx.dmgType = 9; fx.dice = 1; fx.dmg = 1 // 1 − 2 wraps to 255, which is not below the count
    void handle(host(null), 61, eff(61), c, 6, false)
    expect(fx.dmg).toBe(255)
    fx.dmgType = 1; fx.dice = 2; fx.dmg = 10; fx.save = 0 // fire without the magic bit
    void handle(host(null), 61, eff(61), c, 12, false)
    expect([fx.dmg, fx.save]).toEqual([0, 4])
    fx.dmgType = 2; fx.dmg = 10; fx.save = 0 // not fire: nothing, the save neither
    void handle(host(null), 61, eff(61), c, 12, false)
    expect([fx.dmg, fx.save]).toEqual([10, 0])
  })

  it('113 takes 1 a die off fire, a 0 wrapping to 255 (2a28)', () => {
    fx.dmgType = 1; fx.dice = 4; fx.dmg = 10
    void handle(host(null), 113, eff(113), c, 6, false)
    expect(fx.dmg).toBe(6)
    fx.dice = 1; fx.dmg = 0
    void handle(host(null), 113, eff(113), c, 6, false)
    expect(fx.dmg).toBe(255)
  })

  it('122 looks at the weapon, rolls 3d8 keeping the count, and fire or magic gains it (2d38)', () => {
    fx.dmgType = 9; fx.dice = 7; fx.dmg = 1
    void handle(host(0x56, [10]), 122, eff(122), c, 5, false)
    expect([fx.dmg, fx.dice]).toEqual([13, 3])
    fx.dmgType = 0; fx.dice = 7; fx.dmg = 1 // another weapon: nothing rolled
    void handle(host(0x55), 122, eff(122), c, 5, false)
    expect([fx.dmg, fx.dice]).toEqual([1, 7])
  })

  it('117 holy water as the weapon does 1d6 + 1, keeping a count of 1 (2b20)', () => {
    fx.dmgType = 0; fx.dice = 5; fx.dmg = 9
    void handle(host(0x55, [4]), 117, eff(117), c, 5, false)
    expect([fx.dmg, fx.dice]).toEqual([5, 1])
  })

  it('the handlers rolling through FUN_5216_0e2e name it', () => {
    for (const t of [75, 79, 80, 117, 121, 122]) expect(POR.effects.handlers[t].keep, `type ${t}`).toBe(1)
  })

  /** a holder and its victim, the victim held (58) and the holder carrying `type` with flag 1 */
  function grip(type: number, duration = 0) {
    const people: Uint8Array[] = [new Uint8Array(F.size), new Uint8Array(F.size)]
    const fxs = new Map<Uint8Array, Effect[]>(people.map((p) => [p, []]))
    const recs = new Map<Uint8Array, Uint8Array>(people.map((p) => [p, new Uint8Array(22)]))
    const said: string[] = []
    const h = {
      effectsOf: (x: Uint8Array) => fxs.get(x)!, byIndex: (i: number) => people[i] ?? null, print: (t: string) => said.push(t),
      name: () => 'X', roll: () => 2, damage: (x: Uint8Array, d: number) => { x[F.hp] = Math.max(0, x[F.hp] - d) },
      endTurn: () => {}, setRec: (x: Uint8Array, i: number, v: number) => { recs.get(x)![i] = v }, attack: async () => {},
    } as unknown as FxHost
    const [holder, victim] = people
    holder[F.inPlay] = victim[F.inPlay] = 1
    victim[F.hp] = 20
    addRaw(h, victim, 58, 0, 0, 0)
    const e = addRaw(h, holder, type, duration, 1, 1)
    return { h, holder, victim, e, fxs, recs, said }
  }

  it('74 and 75 let go once their victim is out of play, without calling themselves back (0x2E5C6, 0x289FF)', async () => {
    for (const type of [74, 75]) {
      const g = grip(type, 0xcf)
      g.victim[F.inPlay] = 0
      await handle(g.h, type, g.e, g.holder, 15, false) // the turn of a holder whose victim is down
      expect([g.fxs.get(g.holder)!.length, g.fxs.get(g.victim)!.length], `type ${type}`).toEqual([0, 0])
    }
  })

  it('75 drains from its pool, then lets go and the sated stirge flees (0x28AB5, 0x28A37)', async () => {
    const g = grip(75, 0x30) // a pool of 3
    await handle(g.h, 75, g.e, g.holder, 15, false) // 2 damage: 3 > 2, the pool goes down to 1
    expect([g.victim[F.hp], g.e.duration, g.said]).toEqual([18, 0x10, [`X ${text(POR.effects.handlers[75].msg as number)}`]])
    await handle(g.h, 75, g.e, g.holder, 15, false) // 2 more: 1 is not above 2, the record goes
    expect([g.victim[F.hp], g.fxs.get(g.holder)!.length, g.fxs.get(g.victim)!.length, g.recs.get(g.holder)![0x10]]).toEqual([16, 0, 0, 1])
  })

  /** 7's removal on a character with these class levels (index 0–7), CON, max HP and rolled HP */
  async function trained(levels: Record<number, number>, con: number, maxHp: number, rolled: number) {
    const x = new Uint8Array(F.size)
    for (const [i, L] of Object.entries(levels)) x[F.levels + Number(i)] = L
    x[F.stat[4]] = con; x[F.maxHp] = maxHp; x[F.hp] = maxHp - 3; x[F.hpRolled] = rolled
    const fxs: Effect[] = [], said: string[] = []
    const h = { effectsOf: () => fxs, print: (t: string) => said.push(t), name: () => 'X' } as unknown as FxHost
    await handle(h, 7, eff(7), x, 0, true)
    return { con: x[F.stat[4]], maxHp: x[F.maxHp], hp: x[F.hp], fxs, said }
  }

  it('7 raises CON and gives the hit points the original computes (0x37463)', async () => {
    // fighter 5, CON 15 → 16: a = 60 − 50 = 10, b = 5·(16 − 15) = 5, + 2
    expect(await trained({ 2: 5 }, 15, 60, 50)).toMatchObject({ con: 16, maxHp: 62, hp: 59, said: [`X ${text(POR.effects.handlers[7].msg as number)}`] })
    // magic-user 4, CON 15 → 16: b = 4·2 = 8, a = 9, + 1
    expect(await trained({ 5: 4 }, 15, 30, 21)).toMatchObject({ con: 16, maxHp: 31, hp: 28 })
    // CON 14 → 15: b = 4·1, a = 9, + 2
    expect(await trained({ 5: 4 }, 14, 30, 21)).toMatchObject({ con: 15, maxHp: 32, hp: 29 })
    // CON 16 → 17 with no fighter level: no gain; with one, fighter 3 and cleric 3: b = 3·2 + 3·2 = 12, a = 25, + 2
    expect(await trained({ 5: 4 }, 16, 30, 21)).toMatchObject({ con: 17, maxHp: 30 })
    expect(await trained({ 0: 3, 2: 3 }, 16, 45, 20)).toMatchObject({ con: 17, maxHp: 47, hp: 44 })
    // below 15 nothing but the CON
    expect(await trained({ 2: 5 }, 12, 60, 50)).toMatchObject({ con: 13, maxHp: 60, hp: 57 })
    // 20: effect 62 (dur 60, power FF, flag 1) and no hit points
    const r = await trained({ 2: 5 }, 19, 60, 50)
    expect([r.con, r.maxHp, r.fxs]).toEqual([20, 60, [{ type: 62, duration: 60, power: 0xff, flag: 1 }]])
  })

  it('82 gives the +1 save only to a side of 6 or more in play, +2 to humans (0x38DD8, DS:6814)', async () => {
    const run = async (size: number, race = 1) => {
      const owner = new Uint8Array(F.size), foes = Array.from({ length: size }, () => new Uint8Array(F.size))
      owner[F.inPlay] = 1
      for (const f of foes) { f[F.inPlay] = 1; f[F.side] = 1; f[F.race] = race }
      const bonuses: number[] = []
      const h = {
        all: () => [owner, ...foes], effectsOf: () => [], enemiesNear: () => foes,
        save: (_x: Uint8Array, _t: number, b: number) => { bonuses.push(b); return true },
      } as unknown as FxHost
      await handle(h, 82, eff(82), owner, 8, false)
      return bonuses
    }
    expect(await run(5)).toEqual([0, 0, 0, 0, 0])
    expect(await run(6)).toEqual(Array(6).fill(1))
    expect(await run(2, 7)).toEqual([2, 2])
  })
})
