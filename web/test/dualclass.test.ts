// Dual-classing (CotAB "Human Change Classes", 0x5135D; spec/B-model/procedures.md §7.2,
// spec/A-games/coab/chargen-and-progression.md): who may, which classes, what the change does, and how the former
// class comes back once the new class passes it. Needs COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { COAB, POR, setGame } from '../src/games/profile'
import { F } from '../src/games/fields'
import { T } from '../src/games/tables'
import { unexepack } from '../src/data/exepack'
import { Tables } from '../src/rules/chargen'
import { derive, train } from '../src/rules/training'
import { changeClass, changeClassChoices, canChangeTo, offersChangeClass, formerClass, NO_CLASS } from '../src/rules/dualclass'
import { formerLevelsCount, classLevel } from '../src/games/rules'
import { installNames, parseCharacter } from '../src/data/character'
import { installText } from '../src/data/gametext'
import { msg } from '../src/games/strings'
import { ItemTables, Item } from '../src/data/items'
import { mayCast } from '../src/rules/magic'

const dir = process.env.COAB ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('dual-classing (CotAB 0x5135D)', () => {
  afterAll(() => setGame(POR))
  if (have) setGame(COAB)
  const exe = have ? new Uint8Array(readFileSync(join(dir, 'START.EXE'))) : new Uint8Array(0)
  const img = have ? unexepack(exe).image : new Uint8Array(0)
  const t = have ? new Tables(img) : (null as unknown as Tables)
  /** a human of class k at level L with these base and current abilities */
  const human = (k: number, L: number, stat: number[], alignment = 0) => {
    setGame(COAB)
    const c = new Uint8Array(F.size)
    c[F.race] = 7; c[F.cls] = k; c[F.levels + k] = L; c[F.alignment] = alignment
    stat.forEach((v, a) => { c[F.stat[a]] = v; c[F.baseStat[a]] = v })
    c[F.xp] = 0x70; c[F.xp + 1] = 0x11; c[F.xp + 2] = 0x01 // 70000
    c[F.maxHp] = 50; c[F.hp] = 50; c[F.hpRolled] = 44
    derive(t, c)
    return c
  }

  it('is offered to a human who never changed class, and nowhere in PoR', () => {
    const c = human(2, 7, [16, 10, 17, 12, 14, 10])
    expect(offersChangeClass(c)).toBe(true)
    c[F.race] = 1
    expect(offersChangeClass(c)).toBe(false) // a dwarf
    c[F.race] = 7; c[F.prevLevels + 6] = 3
    expect(formerClass(c)).toBe(6)
    expect(offersChangeClass(c)).toBe(false) // changed once already
    c[F.prevLevels + 6] = 0
    expect(formerClass(c)).toBe(NO_CLASS)
    setGame(POR)
    expect(offersChangeClass(new Uint8Array(F.size))).toBe(false)
  })

  it('wants 15 in the old class\'s prime abilities, 17 in the new one\'s, and the new class\'s alignment', () => {
    // fighter (prime STR) to cleric (prime WIS): STR 15 and WIS 17
    expect(canChangeTo(t, human(2, 5, [15, 10, 17, 10, 10, 10]), 0)).toBe(true)
    expect(canChangeTo(t, human(2, 5, [14, 10, 17, 10, 10, 10]), 0)).toBe(false)
    expect(canChangeTo(t, human(2, 5, [15, 10, 16, 10, 10, 10]), 0)).toBe(false)
    expect(canChangeTo(t, human(2, 5, [18, 18, 18, 18, 18, 18]), 2)).toBe(false) // not the same class
    // to paladin: every ability its minima name at 9 or more (STR, INT, WIS, CON, CHA) at 17, and lawful good
    expect(canChangeTo(t, human(2, 5, [17, 17, 17, 10, 17, 17], 0), 3)).toBe(true)
    expect(canChangeTo(t, human(2, 5, [17, 17, 17, 10, 17, 17], 1), 3)).toBe(false)
    // the list in the race's class order: cleric, fighter, magic-user, thief, paladin, ranger
    expect(changeClassChoices(t, human(0, 4, [17, 17, 17, 17, 17, 17], 0))).toEqual([2, 5, 3, 4]) // no lawful good thief
    expect(changeClassChoices(t, human(0, 4, [17, 17, 17, 17, 17, 17], 4))).toEqual([2, 5, 6]) // true neutral: no paladin or ranger
    expect(changeClassChoices(t, human(2, 4, [14, 17, 17, 17, 17, 17], 0))).toEqual([])
  })

  it('reads its texts from the game', () => {
    setGame(COAB)
    installText(exe, new Uint8Array(readFileSync(join(dir, 'GAME.OVR'))))
    expect(msg('pickNewClass')).toBe('Pick New Class')
    expect(msg('doesntQualify')).toBe(' doesn\'t qualify.')
    expect(msg('nowFirstLevel') + 'Thief' + msg('nowFirstLevelEnd')).toBe(' is now a 1st level Thief.')
  })

  it('keeps the old level, starts the new class at 1 with no experience, and clears the spells', () => {
    const c = human(5, 6, [17, 15, 10, 14, 12, 10], 4)
    c[F.memorised] = 11; c[F.known + 30] = 1
    const hp = c[F.maxHp]
    changeClass(t, c, 2)
    expect(c[F.cls]).toBe(2)
    expect([c[F.levels + 5], c[F.levels + 2], c[F.prevLevels + 5]]).toEqual([0, 1, 6])
    expect([c[F.hpLevel], c[F.hitDice]]).toEqual([6, 1])
    expect(c[F.xp] | c[F.xp + 1] | c[F.xp + 2] | c[F.xp + 3]).toBe(0)
    expect(c[F.memorised]).toBe(0)
    expect(c[F.known + 30]).toBe(1) // the spell book is kept
    expect([...c.subarray(F.muSlots, F.muSlots + 5)]).toEqual([0, 0, 0, 0, 0])
    expect(c[F.maxHp]).toBe(hp)
    expect(c[F.itemMask]).toBe(t.b(T.classBits.at + 2)) // a fighter's items only
    expect(formerLevelsCount(c)).toBe(false)
    // a fighter who becomes a magic-user gets the first-level slot and the starting spells
    const f = human(2, 5, [15, 17, 10, 10, 10, 10])
    changeClass(t, f, 5)
    expect(f[F.muSlots]).toBe(1)
    expect([11, 18, 12, 21].map((id) => f[F.known + id])).toEqual([1, 1, 1, 1])
  })

  it('puts away readied items the new class may not use, unless cursed', () => {
    setGame(COAB)
    const items = ItemTables.load(new Uint8Array(readFileSync(join(dir, 'ITEMS'))), exe)!
    const c = human(2, 6, [16, 10, 17, 10, 10, 10])
    const typeFor = (ok: (m: number) => boolean) => items.base.findIndex((b) => ok(b.classes))
    const fighterOnly = typeFor((m) => (m & t.b(T.classBits.at + 2)) !== 0 && (m & t.b(T.classBits.at + 0)) === 0)
    const make = (type: number, cursed: boolean) => { const r = new Uint8Array(63); r[0x2e] = type; r[0x34] = 1; r[0x36] = cursed ? 1 : 0; return new Item(r) }
    const sword = make(fighterOnly, false), cursedSword = make(fighterOnly, true)
    changeClass(t, c, 0, [sword, cursedSword], items)
    expect([sword.ready, cursedSword.ready]).toEqual([false, true])
  })

  it('lists only the spells the caster may cast (0x43F8E): WIS or INT above 8, the class, armour in battle', () => {
    const cleric = { cls: 0 }, druid = { cls: 1 }, mu = { cls: 2 }, item = { cls: 3 }
    const c = human(0, 3, [10, 10, 9, 10, 10, 10])
    expect([mayCast(c, cleric), mayCast(c, druid), mayCast(c, item)]).toEqual([true, false, false])
    c[F.stat[2]] = 8
    expect(mayCast(c, cleric)).toBe(false) // WIS 8
    const p = human(3, 9, [17, 10, 13, 10, 10, 17])
    expect(mayCast(p, cleric)).toBe(true) // a paladin above 8
    p[F.levels + 3] = 8
    expect(mayCast(p, cleric)).toBe(false)
    // a magic-user's spells need INT above 8 only; in battle in body armour a human needs a ranger
    // above 8, or a former one (counting) with a magic-user level
    const m = human(5, 5, [10, 9, 10, 10, 10, 10])
    expect([mayCast(m, mu), mayCast(m, mu, true)]).toEqual([true, false])
    m[F.stat[1]] = 8
    expect(mayCast(m, mu)).toBe(false)
    const r = human(4, 9, [17, 13, 14, 10, 14, 10])
    expect([mayCast(r, druid), mayCast(r, mu, true)]).toEqual([true, true])
    const d = human(5, 10, [17, 13, 14, 10, 14, 10]) // a ranger 9 who became a magic-user, now level 10
    d[F.levels + 5] = 10; d[F.prevLevels + 4] = 9; d[F.hpLevel] = 9
    expect(formerLevelsCount(d)).toBe(true)
    expect([mayCast(d, mu, true), mayCast(d, druid)]).toEqual([true, true])
    d[F.levels + 5] = 9
    expect([mayCast(d, mu, true), mayCast(d, druid)]).toEqual([false, false]) // not counting yet
  })

  it('gains no hit points until the new class passes the old level, then the old class counts again', () => {
    const c = human(2, 4, [16, 10, 17, 10, 10, 10])
    changeClass(t, c, 0)
    const dice = { roll: (n: number) => n * 5 }
    for (let L = 2; L <= 4; L++) {
      const hp = c[F.maxHp]
      train(t, dice, c, [0], true)
      expect([c[F.levels], c[F.maxHp]]).toEqual([L, hp])
      expect(c[F.itemMask]).toBe(t.b(T.classBits.at + 0))
      expect(parseCharacter(c).levels.map((l) => l.level)).toEqual([L])
    }
    const hp = c[F.maxHp]
    train(t, dice, c, [0], true) // cleric 5 passes fighter 4
    expect(c[F.maxHp]).toBeGreaterThan(hp)
    expect(formerLevelsCount(c)).toBe(true)
    expect(classLevel(c, 2)).toBe(4)
    expect(c[F.itemMask]).toBe(t.b(T.classBits.at + 0) + t.b(T.classBits.at + 2))
    expect(c[F.thac0Base]).toBe(Math.max(t.b(T.thac0.at + 2 * T.thac0.row + 4), t.b(T.thac0.at + 0 * T.thac0.row + 5)))
    setGame(COAB)
    installNames(img)
    expect(parseCharacter(c).levels.map((l) => `${l.cls} ${l.level}`)).toEqual(['Cleric 5', 'Fighter 4'])
  })
})
