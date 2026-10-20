// CotAB's spell handlers on a real battlefield (spec/coab/spells.md §2), each by its kind and the
// parameters in games/spellrules.ts; scripted dice (each roll takes the next value, else its count, so
// an unscripted d20 is a 1 and every save fails). Needs COAB (and POOLRAD for the PoR comparisons).
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { addEffect, addRaw, fx } from '../src/rules/effects'
import { heal } from '../src/rules/camp'
import { Item, ITEM_SIZE } from '../src/data/items'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { spellSpec } from '../src/rules/spellkinds'
import { removeEffect } from '../src/rules/effects'

const OPEN = 1, WALL = 2
const cells: CellInfo[] = Array.from({ length: 0x42 }, (_, i) => ({ move: i === WALL ? 0xff : 1, sight: i === WALL ? 2 : 0, image: 0 }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

/** an open field; `menu` answers the UI's menus in turn, `confirm` its yes/no questions */
function field(files: GameFiles) {
  const e = new Engine(files, io, 7)
  const dice: number[] = []
  e.roll = (n: number) => dice.length ? dice.shift()! : n
  const printed: string[] = []
  const menus: number[] = [], confirms: boolean[] = [], aims: (Fighter | null)[] = []
  const ui = {
    print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {},
    menu: async () => menus.shift() ?? 0, confirm: async () => confirms.shift() ?? false,
    // the player's picks in turn (null: cancel)
    aim: async (_f: Fighter, entries: { f: Fighter | null; x: number; y: number }[]) => {
      const t = aims.shift()
      return t ? entries.find((en) => en.f === t) ?? { f: t, x: t.x, y: t.y, cost: 0, ok: true } : null
    },
  } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
  const b = new Battle(e, ui, bf, cells)
  const add = (x: number, y: number, side: number, nm: string, opts: { size?: number; hp?: number; str?: number; hd?: number } = {}) => {
    const c = new Uint8Array(F.size)
    c[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
    c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = opts.hp ?? 100; c[F.sizeFlags] = opts.size ?? 1
    c[F.hitDice] = opts.hd ?? 1
    for (let i = 0; i < 6; i++) c[F.baseStat[i]] = c[F.stat[i]] = 10
    if (opts.str !== undefined) c[F.baseStat[0]] = c[F.stat[0]] = opts.str
    for (let i = 0; i < 5; i++) c[F.saves + i] = 15
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size: opts.size ?? 1, index: b.fighters.length, monster: side === 1, target: null }
    f.r[3] = 5
    b.fighters.push(f)
    return f
  }
  const hits: [string, number, boolean][] = []
  b.damageSync = (c: Uint8Array, dmg: number, _mode: number, saved: boolean) => { hits.push([b.name(c), dmg, saved]) }
  const cast = async (f: Fighter, id: number, L: number, targets: Fighter[], aim?: { x: number; y: number }) => {
    b.current_ = f
    b.aimed = aim ?? (targets[0] ? { x: targets[0].x, y: targets[0].y } : { x: f.x, y: f.y })
    fx.spell = id
    try { await b.applySpell(f, e.spells!.get(id)!, L, targets) } finally { fx.spell = 0 }
  }
  const has = (f: Fighter, type: number) => b.effectsOf(f.c).filter((x) => x.type === type)
  return { e, b, bf, add, hits, printed, dice, menus, confirms, aims, cast, has }
}

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''
const haveCoab = !!coab && existsSync(coab)

describe.skipIf(!haveCoab)('CotAB spells done as parameters (6da4862)', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('Enlarge (12): 19–22 past level 6, 18/00 past 11, only over the base STR (0x45F75, 0x4C1D8)', async () => {
    const { add, cast, has, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 0, 'T', { str: 16 })
    await cast(mage, 12, 8, [t])
    expect(has(t, 0x0c).map((x) => [x.power, x.flag])).toEqual([[120, 1]]) // 20 + 100
    expect([t.c[F.stat[0]], t.c[F.baseStat[0]]]).toEqual([20, 16]) // worked out again, base untouched
    expect(printed).toContain('T is stronger')
    const u = add(7, 5, 0, 'U', { str: 16 })
    await cast(mage, 12, 13, [u])
    expect(has(u, 0x0c).map((x) => x.power)).toEqual([1]) // 18/00: % + 1
    expect([u.c[F.stat[0]], u.c[F.strPct]]).toEqual([18, 0])
    const strong = add(8, 5, 0, 'STRONG', { str: 20 })
    await cast(mage, 12, 8, [strong])
    expect(has(strong, 0x0c)).toEqual([])
    expect(printed).toContain('STRONG is unaffected')
  })

  it('Reduce (13): a failed save ends Enlarge without "is Cured"; STR from the base again', async () => {
    const { add, cast, has, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 1, 'T', { str: 16 })
    await cast(mage, 12, 8, [t])
    printed.length = 0
    await cast(mage, 13, 5, [t])
    expect(has(t, 0x0c)).toEqual([])
    expect(t.c[F.stat[0]]).toBe(16)
    expect(printed).toEqual(['T has been reduced'])
  })

  it('Friends (14): Apply with power 2d4 and flag 1, CHA worked out from the base (no cap)', async () => {
    const { add, cast, has, dice } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    mage.c[F.baseStat[5]] = 18
    dice.push(8)
    await cast(mage, 14, 3, [mage])
    expect(has(mage, 0x0e).map((x) => [x.power, x.flag])).toEqual([[8, 1]])
    expect(mage.c[F.stat[5]]).toBe(26)
  })

  it('Magic Missile (15): (L + 1) div 2 missiles of d4 + 1', async () => {
    const { add, cast, hits, dice } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const orc = add(9, 5, 1, 'ORC')
    dice.push(7) // 3d4
    await cast(mage, 15, 5, [orc])
    expect(hits).toEqual([['ORC', 10, false]])
    expect(fx.dice).toBe(3)
    hits.length = 0
    await cast(mage, 15, 1, [orc]) // level 1: one missile (PoR's L div 2 gives none)
    expect(hits).toEqual([['ORC', 2, false]])
  })

  it('Mirror Image (32): power (1d4 << 4) | L through Apply, "is duplicated"', async () => {
    const { e, add, cast, has, dice, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    dice.push(3)
    await cast(mage, 32, 5, [mage])
    expect(has(mage, e.spells!.get(32)!.effect).map((x) => x.power)).toEqual([0x35])
    expect(printed).toContain('MAGE is duplicated')
  })

  it('adding an effect takes out a timed record of its type whatever the new duration (0x4CD91)', async () => {
    const { b, add } = cotab()
    const t = add(5, 5, 0, 'T')
    addRaw(b, t.c, 0x07, 10, 1, 0)
    await addEffect(b, t.c, 0x07, 2, 2, 0)
    expect(b.effectsOf(t.c).map((x) => [x.duration, x.power])).toEqual([[2, 2]])
    const u = add(6, 5, 0, 'U')
    addRaw(b, u.c, 0x07, 0, 1, 0) // a permanent record stays beside the new one
    await addEffect(b, u.c, 0x07, 3, 2, 0)
    expect(b.effectsOf(u.c).map((x) => x.duration)).toEqual([0, 3])
  })

  it('healing is not blocked by 0x32, which is the Hot Fire Shield here (0x4CE85)', () => {
    setGame(COAB)
    const c = new Uint8Array(F.size)
    c[F.maxHp] = 20; c[F.hp] = 5
    expect(heal(c, [{ type: 0x32, duration: 5, power: 0, flag: 0 }], 4, false, true)).toBe(true)
    expect(c[F.hp]).toBe(9)
    setGame(POR)
    c[F.hp] = 5
    expect(heal(c, [{ type: 0x32, duration: 5, power: 0, flag: 0 }], 4, false, true)).toBe(false) // PoR's mummy rot
  })
})

describe.skipIf(!haveCoab)('CotAB changed handlers', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('Strength (35): only the group that applies rolls; 18/xx for fighters; power = bonus + 100, no line (0x46BCB)', async () => {
    const { add, cast, has, dice, printed } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    const t = add(6, 5, 0, 'T', { str: 17 })
    t.c[F.levels + 2] = 3 // fighter 3
    dice.push(4, 99) // the fighter's d8 only
    await cast(cleric, 35, 5, [t])
    expect(dice).toEqual([99])
    expect(has(t, 0x26).map((x) => [x.power, x.flag])).toEqual([[104, 1]])
    expect([t.c[F.stat[0]], t.c[F.strPct]]).toEqual([18, 30]) // 17 + 4 = 21: 18/(0 + 30)
    expect(printed).toEqual([])
  })

  it('Strength (35): a former dual-class level counts once past +0xE6', async () => {
    const { add, cast, has, dice } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    const dual = (kept: number) => {
      const t = add(6, 5, 0, 'DUAL', { str: 12 })
      t.c[F.levels + 0] = 6; t.c[F.prevLevels + 2] = 5; t.c[F.hpLevel] = kept // fighter 5, then cleric
      return t
    }
    const a = dual(4)
    dice.push(3, 7) // cleric's d6, then the fighter's d8 wins
    await cast(cleric, 35, 5, [a])
    expect(has(a, 0x26).map((x) => x.power)).toEqual([107])
    const b = dual(5)
    dice.push(3, 7)
    await cast(cleric, 35, 5, [b])
    expect(has(b, 0x26).map((x) => x.power)).toEqual([103]) // the former fighter level no longer counts
  })

  it('Remove Curse (43, 89): the first cursed item is unreadied, still cursed; its effect goes (0x47575)', async () => {
    const { b, add, cast, has, printed } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    const t = add(6, 5, 0, 'T')
    const raw = new Uint8Array(ITEM_SIZE)
    raw[0x34] = 1; raw[0x36] = 1; raw[0x3e] = 0x80; raw[0x3d] = 0x07
    const it = new Item(raw)
    b.itemsOf(t.c).push(it)
    addRaw(b, t.c, 0x07, 0, 0xff, 0)
    await cast(cleric, 89, 9, [t])
    expect([it.ready, it.cursed]).toEqual([false, true])
    expect(has(t, 0x07)).toEqual([])
    expect(printed).toContain('T has an item un-cursed')
    addRaw(b, t.c, 0x24, 0, 0xff, 0) // the curse effect goes first, and only it
    it.ready = true
    await cast(cleric, 43, 9, [t])
    expect([has(t, 0x24).length, it.ready]).toEqual([0, true])
    expect(printed.slice(-2)).toEqual(['T is Cured', 'T is un-cursed'])
  })

  it('Haste (48) and Slow (55): no event-18 pass after Apply (0x477EB)', async () => {
    const { add, cast, has } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 0, 'T')
    t.c[F.attacksBase] = 2; t.c[F.attacksLeft] = 7
    await cast(mage, 48, 3, [t])
    expect(has(t, 0x27).length).toBe(1)
    expect(t.c[F.attacksLeft]).toBe(7)
    const o = add(9, 5, 1, 'ORC')
    o.c[F.attacksBase] = 2; o.c[F.attacksLeft] = 7
    await cast(mage, 55, 3, [o, t]) // only the enemy side
    expect([has(o, 0x2a).length, has(t, 0x2a).length, o.c[F.attacksLeft]]).toEqual([1, 0, 7])
  })

  it('Haste (48) on a slowed ally: "is Cured", its first Slow record gone, no Haste (0x4C0FD)', async () => {
    const { b, add, cast, has, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 0, 'T')
    const u = add(7, 5, 0, 'U')
    addRaw(b, t.c, 0x2a, 5, 0, 0); addRaw(b, t.c, 0x2a, 9, 0, 0)
    await cast(mage, 48, 2, [t, u])
    expect([has(t, 0x2a).map((x) => x.duration), has(t, 0x27).length, has(u, 0x27).length]).toEqual([[9], 0, 1])
    expect(printed).toEqual(['T is Cured', 'U is Hasted'])
  })
})

describe.skipIf(!haveCoab)('CotAB clouds and Dispel Magic', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }
  const GAS = 0x1e, KILL = 0x1c

  it('reads the cloud squares from START.EXE (DS:27D9, DS:27DD)', () => {
    const { b } = cotab()
    expect(b.cloudCells(spellSpec(34))).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]])
    expect(b.cloudCells(spellSpec(91))).toEqual([[0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]])
  })

  it('Stinking Cloud (34): each occupant checked once; the add-effect routine, then the handler (0x4675B, 0x4B8F7)', async () => {
    const { b, bf, add, cast, has, dice, printed } = cotab()
    const mage = add(2, 2, 0, 'MAGE')
    const ogre = add(10, 10, 1, 'OGRE', { size: 4 }) // 2×2: on all four squares
    dice.push(1) // one save, failed; then 1d4 + 1 = 2
    await cast(mage, 34, 5, [], { x: 10, y: 10 })
    expect([bf.get(10, 10), bf.get(10, 11), bf.get(11, 11), bf.get(11, 10)]).toEqual([GAS, GAS, GAS, GAS])
    expect(has(ogre, 0x1f).map((x) => x.duration)).toEqual([2])
    expect(printed.filter((t) => t.startsWith('OGRE'))).toEqual(['OGRE chokes and gags from nausea'])
    expect(ogre.r[3]).toBe(0) // handler 0x1F (0x273C1) ends the turn at once
    expect(has(mage, 0x28).map((x) => [x.duration, x.power, x.flag])).toEqual([[5, 0x15, 1]])
    // at round end (flag 0) the gas does nothing; a step into it does
    const orc = add(11, 11, 1, 'ORC')
    printed.length = 0
    await b.cloudCheck(orc, false)
    expect(printed).toEqual([])
    dice.push(20)
    await b.cloudCheck(orc, true)
    expect(printed).toEqual(['ORC starts to cough'])
    expect(has(orc, 0x1e).length).toBe(1)
  })

  it('Cloudkill (91): 9 squares; by hit dice, each square its own check; the owner\'s 0x5B lifts it', async () => {
    const { b, bf, add, cast, has, dice, printed } = cotab()
    const mage = add(2, 2, 0, 'MAGE')
    const kobold = add(9, 9, 1, 'KOBOLD', { hd: 3 })
    const ogre = add(10, 10, 1, 'OGRE', { hd: 5, size: 4 }) // on 4 of the squares
    const troll = add(11, 9, 1, 'TROLL', { hd: 7 })
    dice.push(20, 20, 20, 20) // the ogre saves on each of its squares
    await cast(mage, 91, 9, [], { x: 10, y: 10 })
    expect(dice).toEqual([])
    expect(printed).toContain('MAGE Creates a poisonous cloud')
    expect([kobold.c[F.status], ogre.c[F.status], troll.c[F.status]]).toEqual([6, 0, 0])
    expect(printed.filter((t) => t.startsWith('KOBOLD'))).toEqual(['KOBOLD is Poisoned', 'KOBOLD is killed'])
    expect([bf.get(9, 10), bf.get(9, 9)]).toEqual([KILL, 0x1f]) // a body takes a Cloudkill square (0x5671C keeps only 0x1E)
    // round end: the killing cloud still works (an unscripted save is a 1)
    await b.cloudCheck(ogre, false)
    expect(ogre.c[F.status]).toBe(6)
    const owner = has(mage, 0x5b)
    expect(owner.map((x) => [x.duration, x.power])).toEqual([[9, 0x19]])
    printed.length = 0
    await removeEffect(b, mage.c, owner[0])
    expect(printed).toEqual(['The air clears a little...'])
    expect([bf.get(9, 10), bf.get(9, 9)]).toEqual([1, 0x1f])
  })

  it('Dispel Magic (41): the zones round the aimed square against the owner\'s magic-user level; a failure is final', async () => {
    const { bf, add, cast, dice, has } = cotab()
    const enemy = add(2, 2, 1, 'MAGE')
    enemy.c[F.levels + 5] = 5
    const cleric = add(20, 20, 0, 'CLERIC')
    await cast(enemy, 34, 5, [], { x: 10, y: 10 })
    dice.push(80) // L 9 against 5: 70 %
    await cast(cleric, 41, 9, [], { x: 12, y: 10 }) // (11, 10) is the zone's second square
    expect(dice).toEqual([])
    expect(bf.get(10, 11)).toBe(GAS)
    await cast(cleric, 41, 9, [], { x: 12, y: 10 }) // resisted: no roll again
    expect(bf.get(10, 11)).toBe(GAS)
    await cast(enemy, 34, 5, [], { x: 10, y: 14 })
    dice.push(70)
    await cast(cleric, 41, 9, [], { x: 10, y: 14 })
    expect([bf.get(14, 10), bf.get(15, 11)]).toEqual([1, 1])
    expect(has(enemy, 0x28).length).toBe(1)
  })

  it('Dispel Magic (41): Cloudkill zones are matched through Stinking Cloud\'s table (quirk kept)', async () => {
    const { b, bf, add, cast, dice } = cotab()
    const enemy = add(2, 2, 1, 'MAGE')
    const cleric = add(20, 20, 0, 'CLERIC')
    await cast(enemy, 91, 5, [], { x: 10, y: 10 })
    dice.push(1)
    await cast(cleric, 41, 9, [], { x: 8, y: 10 }) // only the zone's west column: never matched
    expect(dice).toEqual([1])
    await cast(cleric, 41, 9, [], { x: 12, y: 10 }) // its east column: matched, dispelled
    expect(dice).toEqual([])
    expect(bf.get(10, 10)).toBe(1)
    expect(b.clouds).toEqual([])
  })
})

describe.skipIf(!haveCoab)('CotAB new spells: 67, 68, 70, 73, 75, 76', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('Neutralize Poison (67): not on the Animated; a poisoned one is up with 1 HP (0x4814A)', async () => {
    const { b, add, cast, has, printed } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    const t = add(6, 5, 0, 'T')
    t.c[F.hp] = 0; t.c[F.status] = 6; t.c[F.inPlay] = 0
    for (const type of [0x37, 0x16, 0x0f]) addRaw(b, t.c, type, 0, 0xff, 0)
    await cast(cleric, 67, 9, [t])
    expect([t.c[F.hp], t.c[F.status], t.c[F.inPlay]]).toEqual([1, 0, 1])
    expect([0x37, 0x16, 0x0f].map((x) => has(t, x).length)).toEqual([0, 0, 0])
    expect(printed).toEqual(['T is unpoisoned'])
    await cast(cleric, 67, 9, [t])
    expect(printed.at(-1)).toBe('T is unaffected')
    const z = add(7, 5, 0, 'ZOMBIE')
    z.c[F.status] = 1
    addRaw(b, z.c, 0x37, 0, 0xff, 0)
    printed.length = 0
    await cast(cleric, 67, 9, [z])
    expect([printed, has(z, 0x37).length]).toEqual([[], 1])
  })

  it('Poison (68): only a save on the target; handler 0x40 kills the caster\'s combat target (quirk, 0x48240)', async () => {
    const { add, cast, dice, printed } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    const kobold = add(6, 5, 1, 'KOBOLD')
    const orc = add(9, 5, 1, 'ORC')
    cleric.target = orc
    dice.push(5, 1) // the target's save (nothing follows it), then the orc's save vs 0
    await cast(cleric, 68, 9, [kobold])
    expect(dice).toEqual([])
    expect([kobold.c[F.status], orc.c[F.status]]).toEqual([0, 6])
    expect(printed).toContain('ORC is Poisoned')
  })

  it('Sticks to Snakes (70): 6 hit dice smash them; else effect 3 for 2L, run at once (0x482CA)', async () => {
    const { add, cast, has, printed } = cotab()
    const druid = add(5, 5, 0, 'DRUID')
    const giant = add(6, 5, 1, 'GIANT', { hd: 6 })
    await cast(druid, 70, 5, [giant])
    expect([has(giant, 3).length, printed]).toEqual([0, ['GIANT smashes them flat']])
    const orc = add(7, 5, 1, 'ORC', { hd: 1 })
    orc.c[F.attacksLeft] = 1
    await cast(druid, 70, 5, [orc])
    expect(has(orc, 3).map((x) => [x.duration, x.power])).toEqual([[10, 4]]) // 5 snakes, one taken by the attack left
    expect(printed).toContain('ORC is fighting with snakes')
    expect(orc.r[3]).toBe(0)
  })

  it('Dispel Evil (73): effect 4 on the caster (power 0), then 0x91 at L "is affected" (0x483E9)', async () => {
    const { add, cast, has, printed } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    await cast(cleric, 73, 9, [cleric])
    expect(has(cleric, 4).map((x) => [x.duration, x.power])).toEqual([[9, 0]])
    expect(has(cleric, 0x91).map((x) => [x.duration, x.power])).toEqual([[9, 9]])
    expect(printed).toContain('CLERIC is affected')
  })

  it('Raise Dead (75): not an elf; a CON point lost, 1 HP, no survival roll (0x4848A)', async () => {
    const { b, add, cast, has, printed } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    const dead = (race: number) => {
      const t = add(6, 5, 0, 'T')
      t.c[F.race] = race; t.c[F.status] = 6; t.c[F.inPlay] = 0; t.c[F.hp] = 0
      t.c[F.baseStat[4]] = t.c[F.stat[4]] = 12
      addRaw(b, t.c, 0x37, 0, 0xff, 0)
      return t
    }
    const elf = dead(2)
    await cast(cleric, 75, 9, [elf])
    expect(elf.c[F.status]).toBe(6)
    const man = dead(7)
    await cast(cleric, 75, 9, [man])
    expect([man.c[F.status], man.c[F.inPlay], man.c[F.hp], man.c[F.baseStat[4]], man.c[F.stat[4]]]).toEqual([0, 1, 1, 11, 11])
    expect(has(man, 0x37).length).toBe(0)
    expect(printed).toEqual(['T is raised'])
  })

  it('Slay Living (76): a failed save slays; a saved one takes 2d8 + 1 (0x4856D)', async () => {
    const { add, cast, dice, hits, printed } = cotab()
    const cleric = add(5, 5, 0, 'CLERIC')
    const a = add(6, 5, 1, 'A')
    await cast(cleric, 76, 9, [a])
    expect([a.c[F.status], printed]).toEqual([6, ['A is slain']])
    const c = add(7, 5, 1, 'C')
    dice.push(20, 9)
    await cast(cleric, 76, 9, [c])
    expect(hits).toEqual([['C', 10, false]])
    expect([fx.dice, fx.dmgType]).toEqual([2, 8])
  })
})

describe.skipIf(!haveCoab)('CotAB new spells: 78, 79, 81, 82', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('Entangle (78): only outside a map area; Duration(0x88) = 6 + 3·L (bug kept, 0x4862B)', async () => {
    const { e, add, cast, has, dice, printed } = cotab()
    const druid = add(5, 5, 0, 'DRUID')
    const a = add(8, 5, 1, 'A'), b2 = add(9, 5, 1, 'B')
    e.write(0x49e6, 1)
    await cast(druid, 78, 5, [a, b2])
    expect(has(a, 0x88).length).toBe(0)
    e.write(0x49e6, 0)
    dice.push(1, 20)
    await cast(druid, 78, 5, [a, b2])
    expect(has(a, 0x88).map((x) => [x.duration, x.power, x.flag])).toEqual([[21, 0, 0]])
    expect(has(b2, 0x88).length).toBe(0)
    expect(printed).toEqual(['A is entangled', 'B is Unaffected'])
  })

  it('Faerie Fire (79): targets bought from a pool of L by size; the last one always saves (0x2C7EA, 0x45B4D)', async () => {
    const { b, e, add, cast, has, aims, printed } = cotab()
    const druid = add(5, 5, 0, 'DRUID')
    druid.c[F.levels + 4] = 10 // ranger 10: druid spells at 3
    druid.c[F.quick] = 0
    const a = add(7, 5, 1, 'A'), b2 = add(8, 5, 1, 'B'), c = add(9, 5, 1, 'C', { size: 2 })
    aims.push(a, a, b2, c, a)
    const targets = await b.spellTargets(druid, e.spells!.get(79)!, 10)
    expect(targets).toEqual([a, b2, c]) // 1 + 1 + 2 > 3: C counts and ends it
    expect(printed).toEqual(['Already been targeted'])
    expect(b.aimed).toEqual({ x: 9, y: 5 })
    printed.length = 0
    await cast(druid, 79, 3, targets!, b.aimed)
    expect([a, b2, c].map((t) => has(t, 7).map((x) => [x.duration, x.power]))).toEqual([[[12, 3]], [[12, 3]], []])
    expect(printed).toEqual(['C is Unaffected', 'B is highlighted', 'A is highlighted'])
  })

  it('Charm Monsters (81): a pool of 2d4 by hit dice; the charmed change sides at once (0x4874C)', async () => {
    const { b, e, add, cast, aims, dice, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    mage.c[F.levels + 5] = 9
    mage.c[F.quick] = 0
    const ogre = add(7, 5, 1, 'OGRE', { hd: 3 }), kob = add(8, 5, 1, 'KOBOLD', { hd: 0 }), orc = add(9, 5, 1, 'ORC', { hd: 1 })
    dice.push(3)
    aims.push(ogre, kob, orc)
    const targets = await b.spellTargets(mage, e.spells!.get(81)!, 10)
    expect(targets).toEqual([ogre, kob]) // 4 (alone it counts) + 1 > 3
    await cast(mage, 81, 9, targets!, b.aimed)
    expect([ogre.c[F.side], kob.c[F.side], orc.c[F.side]]).toEqual([0, 1, 1])
    expect(printed).toEqual(['KOBOLD is Unaffected', 'OGRE is charmed'])
  })

  it('Confusion (82): up to 2d8 targets, each saves or is confused (power 0, 2 + L)', async () => {
    const { add, cast, has, dice } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const a = add(8, 5, 1, 'A'), b2 = add(9, 5, 1, 'B')
    dice.push(1) // 2d8 → 1: the first target only
    await cast(mage, 82, 7, [a, b2])
    expect(has(a, 0x23).map((x) => [x.duration, x.power])).toEqual([[9, 0]])
    expect(has(b2, 0x23).length).toBe(0)
  })
})

describe.skipIf(!haveCoab)('CotAB new spells: 83, 84, 85, 86', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('Dimension Door (83): a hugged caster is let go, then moves to the aimed square (0x488A1)', async () => {
    const { b, add, cast, has, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const bear = add(6, 5, 1, 'BEAR')
    addRaw(b, mage.c, 0x3a, 0, 0, 0)
    addRaw(b, bear.c, 0x90, 0, mage.index, 1)
    await cast(mage, 83, 9, [], { x: 15, y: 5 })
    expect([has(bear, 0x90).length, has(mage, 0x3a).length]).toEqual([0, 0])
    expect([mage.x, mage.y]).toEqual([15, 5])
    expect(printed).toEqual(['MAGE teleports'])
  })

  it('Fear (84): the area template; a failure flees under computer control (0x48A52)', async () => {
    const { add, cast, has, dice, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const a = add(7, 5, 1, 'A'), b2 = add(9, 5, 1, 'B')
    a.target = mage
    dice.push(1, 20)
    await cast(mage, 84, 7, [], { x: 8, y: 5 })
    expect(has(a, 0x8e).map((x) => [x.duration, x.power, x.flag])).toEqual([[7, 0, 1]])
    expect([a.r[0x10], a.c[F.quick], a.c[F.morale], a.target]).toEqual([1, 1, 0xb3, null])
    expect(has(b2, 0x8e).length).toBe(0)
    expect(printed).toEqual(['A runs in terror', 'B is unaffected'])
  })

  it('Fire Shield (85): the player picks Hot or Cold; the computer Hot on 1d10 > 5 (0x48BB2)', async () => {
    const { add, cast, has, menus, confirms, dice, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    menus.push(1)
    await cast(mage, 85, 7, [mage])
    expect([0x32, 0x36, 0x8f].map((t) => has(mage, t).map((x) => [x.duration, x.power]))).toEqual([[], [[9, 0]], [[9, 0]]])
    expect(printed).toEqual([]) // Cold has no line
    const ai = add(9, 5, 1, 'EFREET')
    ai.c[F.quick] = 1
    dice.push(6)
    await cast(ai, 85, 7, [ai])
    expect([has(ai, 0x32).length, has(ai, 0x36).length, has(ai, 0x8f).length]).toEqual([1, 0, 1])
    expect(printed).toEqual(['EFREET is protected'])
    const quitter = add(12, 5, 0, 'QUITTER')
    menus.push(-1, -1); confirms.push(false, true) // neither twice: asked to abort, no, then yes
    await cast(quitter, 85, 7, [quitter])
    expect([menus.length, confirms.length, has(quitter, 0x8f).length]).toEqual([0, 0, 0])
  })

  it('Fumble (86): clumsy or, saved, slowed, at once; then Apply again (0x48D66)', async () => {
    const { add, cast, has, dice, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 1, 'T')
    await cast(mage, 86, 7, [t])
    expect(has(t, 0x1b).map((x) => [x.duration, x.power, x.flag])).toEqual([[7, 7, 1]]) // Apply's record replaced the first
    expect(t.r[3]).toBe(0) // 0x1B's handler (0x273C1) ended the turn
    expect(printed).toEqual(['T is clumsy', 'T is clumsy'])
    const u = add(7, 5, 1, 'U')
    dice.push(20, 20)
    printed.length = 0
    await cast(mage, 86, 7, [u])
    expect([has(u, 0x2a).length, has(u, 0x1b).length]).toEqual([1, 0])
    expect(printed).toEqual(['U is slowed', 'U is Unaffected'])
  })
})

describe.skipIf(!haveCoab)('CotAB new spells: 92, 93, 98', () => {
  const files = haveCoab ? load(coab, COAB) : null
  afterAll(() => setGame(POR))
  const cotab = () => { setGame(COAB); return field(files!) }

  it('Cone of Cold (92): width 2, max(1, L div 2) squares; L d4 + L, type 0x0A (0x494C0)', async () => {
    const { add, cast, hits, dice } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    add(7, 5, 1, 'A')
    add(11, 5, 1, 'B') // past 3 squares
    dice.push(10)
    await cast(mage, 92, 6, [], { x: 6, y: 5 }) // aimed next to the caster, the cone runs on to 3 squares
    expect(hits).toEqual([['A', 16, false]])
    expect([fx.dice, fx.dmgType]).toEqual([6, 0x0a])
    hits.length = 0
    await cast(mage, 92, 1, [], { x: 6, y: 5 }) // one square: A is two away
    expect(hits).toEqual([])
  })

  it('Feeblemind (93): the spell save moved by class while Apply runs, then put back (0x49562)', async () => {
    const { add, cast, has, dice, printed } = cotab()
    const mage = add(5, 5, 0, 'MAGE')
    const mu = add(6, 5, 1, 'MU'), cl = add(7, 5, 1, 'CL')
    mu.c[F.cls] = 5; cl.c[F.cls] = 0
    dice.push(17)
    await cast(mage, 93, 9, [mu])
    expect([has(mu, 0x44).length, mu.c[F.stat[1]], mu.c[F.stat[2]], mu.c[F.saves + 4]]).toEqual([1, 7, 7, 15])
    expect(printed).toContain('MU is stupid')
    dice.push(14)
    await cast(mage, 93, 9, [cl]) // 15 − 1: 14 saves
    expect([has(cl, 0x44).length, cl.c[F.saves + 4]]).toEqual([0, 15])
  })

  it('98: the template, width 1, 3 squares; 6d6 each to monster type 0x12 only (0x49697)', async () => {
    const { add, cast, hits, dice } = cotab()
    const caster = add(5, 5, 0, 'CASTER')
    const a = add(6, 5, 1, 'A'); a.c[F.monsterType] = 0x12
    add(7, 5, 1, 'B')
    const c = add(8, 5, 1, 'C'); c.c[F.monsterType] = 0x12
    dice.push(20, 5, 30)
    await cast(caster, 98, 12, [], { x: 8, y: 5 })
    expect(hits).toEqual([['A', 20, false], ['B', 5, true], ['C', 30, false]])
  })
})

describe.skipIf(!por || !existsSync(por))('PoR keeps its own rules', () => {
  const files = por && existsSync(por) ? load(por, POR) : null
  it('reads Stinking Cloud\'s squares from START.EXE (DS:290D)', () => {
    setGame(POR)
    const { b } = field(files!)
    expect(b.cloudCells(spellSpec(34))).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]])
  })
  it('adds beside a longer timed record and replaces only for a longer or permanent new one', async () => {
    setGame(POR)
    const { b, add } = field(files!)
    const t = add(5, 5, 0, 'T')
    addRaw(b, t.c, 0x07, 10, 1, 0)
    await addEffect(b, t.c, 0x07, 2, 2, 0)
    expect(b.effectsOf(t.c).map((x) => x.duration)).toEqual([10, 2])
    await addEffect(b, t.c, 0x07, 20, 3, 0)
    expect(b.effectsOf(t.c).map((x) => x.duration)).toEqual([2, 20])
  })
  it('Haste (48) and Slow (55): the opposite effect "is Cured" (FUN_5216_1081), Apply on the rest, then event 18', async () => {
    setGame(POR)
    const { b, add, cast, has, printed } = field(files!)
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 0, 'T'), u = add(7, 5, 0, 'U'), v = add(8, 5, 0, 'V')
    addRaw(b, t.c, 0x2a, 5, 0, 0); addRaw(b, t.c, 0x2a, 9, 0, 0)
    u.c[F.attacksBase] = 2; u.c[F.attacksLeft] = 7
    await cast(mage, 48, 2, [t, u, v]) // L 2: T uses a slot, V gets none
    expect([has(t, 0x2a).map((x) => x.duration), has(t, 0x27).length, has(u, 0x27).length, has(v, 0x27).length]).toEqual([[9], 0, 1, 0])
    expect(printed).toEqual(['T is Cured', 'U is Hasted', 'U ages']) // the event-18 pass ages U after every Apply
    expect(u.c[F.attacksLeft]).toBe(7) // the doubled rate is not kept
    const o = add(9, 5, 1, 'ORC')
    printed.length = 0
    await cast(mage, 55, 3, [u, o])
    expect([has(u, 0x27).length, has(o, 0x2a).length]).toEqual([1, 1])
    expect(printed).toEqual(['ORC is Slowed'])
  })
  it('keeps the dice count (DS:681C) where the handler rolls through FUN_5216_0e2e: 4, 15, 20, 47/64, 65', async () => {
    setGame(POR)
    const { add, cast, hits } = field(files!)
    const mage = add(5, 5, 0, 'MAGE')
    const orc = add(6, 5, 1, 'ORC')
    const count = async (id: number, L: number) => { fx.dice = 99; await cast(mage, id, L, [orc]); return fx.dice }
    expect(await count(4, 5)).toBe(1) // 1d8
    expect(await count(15, 6)).toBe(3) // (L div 2) d4
    expect(await count(20, 5)).toBe(1) // 1d8 + L
    expect(await count(65, 6)).toBe(2) // 2d4 + 2
    expect(await count(64, 6)).toBe(3) // (1d3 × 2 + 1) d6, the 1d3 a 1
    expect(await count(9, 5)).toBe(99) // Burning Hands: no dice
    expect(await count(60, 6)).toBe(99) // the Javelin rolls through FUN_5216_0de3
    expect(hits.length).toBeGreaterThan(0) // the count is kept before the touch roll, hit or miss
  })
})
