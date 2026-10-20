// CotAB's effect handlers (spec/coab/effects.md §2), its current-stat routine (0x4C389) and item kinds
// (0x3F034), against the shipped game's tables and monsters; needs COAB.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { COAB, POR, setGame, wants } from '../src/games/profile'
import { F } from '../src/games/fields'
import { T } from '../src/games/tables'
import { GameFiles } from '../src/store/gamefiles'
import { unexepack } from '../src/data/exepack'
import { Item, ITEM_SIZE, ItemTables } from '../src/data/items'
import type { Effect } from '../src/data/effects'
import { Tables } from '../src/rules/chargen'
import { addEffect, addRaw, fire, fx, removeEffect, type FxHost } from '../src/rules/effects'
import { readyItem, recalc, unreadyItem } from '../src/rules/equip'

const dir = process.env.COAB ?? ''
const have = dir !== '' && existsSync(dir)

/** A combat-like host over plain records: scripted dice (each die takes the next value, else 1). */
class Host implements FxHost {
  people: Uint8Array[] = []
  fxs = new Map<Uint8Array, Effect[]>()
  inv = new Map<Uint8Array, Item[]>()
  recs = new Map<Uint8Array, Uint8Array>()
  targets = new Map<Uint8Array, Uint8Array>()
  said: string[] = []
  dice: number[] = []
  ended: Uint8Array[] = []
  cur: Uint8Array | null = null
  combat = true
  readonly tb: Tables
  readonly it: ItemTables
  constructor(tb: Tables, it: ItemTables) { this.tb = tb; this.it = it }
  effectsOf(c: Uint8Array) { if (!this.fxs.has(c)) this.fxs.set(c, []); return this.fxs.get(c)! }
  itemsOf(c: Uint8Array) { if (!this.inv.has(c)) this.inv.set(c, []); return this.inv.get(c)! }
  print(t: string) { this.said.push(t) }
  roll(n: number, s: number) { let t = 0; for (let i = 0; i < n; i++) t += Math.min(s, this.dice.shift() ?? 1); return t }
  name(c: Uint8Array) { return String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name])) }
  all() { return this.people }
  inCombat() { return this.combat }
  distance() { return 1 }
  targetOf(c: Uint8Array) { return this.targets.get(c) ?? null }
  setTarget(c: Uint8Array, t: Uint8Array) { this.targets.set(c, t) }
  current() { return this.cur }
  endTurn(c: Uint8Array) { this.setRec(c, 3, 0); this.ended.push(c) }
  r(c: Uint8Array) { if (!this.recs.has(c)) this.recs.set(c, new Uint8Array(22)); return this.recs.get(c)! }
  rec(c: Uint8Array, i: number) { return this.r(c)[i] }
  setRec(c: Uint8Array, i: number, v: number) { this.r(c)[i] = v & 0xff; if (i === 0xa && !v) this.targets.delete(c) }
  setStatus(c: Uint8Array, status: number, msg: string) {
    if ([6, 7, 8].includes(c[F.status])) return
    if (msg) this.print(msg)
    c[F.status] = status
    if (status > 1) { c[F.inPlay] = 0; c[F.hp] = 0 }
  }
  damage(c: Uint8Array, dmg: number, mode: number, saved: boolean) {
    fx.dmg = dmg
    void fire(this, c, 6)
    if (!saved) void fire(this, c, 20)
    let d = fx.dmg
    if (saved) d = mode === 1 ? 0 : mode === 2 ? d >> 1 : d
    c[F.hp] = Math.max(0, c[F.hp] - d)
  }
  save(c: Uint8Array, type: number, bonus: number) {
    fx.saved = true
    const r = this.roll(1, 20)
    if (r === 1) return (fx.saved = false)
    if (r === 20) return (fx.saved = true)
    fx.save = r + bonus
    fx.saveType = type
    void fire(this, c, 12)
    return (fx.saved = c[F.saves + type] <= fx.save)
  }
  heal() { return false }
  revive() { return false }
  recalc(c: Uint8Array) { recalc(c, this.itemsOf(c), this.it) }
  tables() { return this.tb }
  enemiesNear(c: Uint8Array) { return this.people.filter((o) => o[F.side] !== c[F.side]) }
  byIndex(i: number) { return this.people[i] ?? null }
  indexOf(c: Uint8Array) { return this.people.indexOf(c) }
  async attack() {}
  weapon(c: Uint8Array) { return this.itemsOf(c).find((x) => x.ready && this.it.baseOf(x)?.slot === 0) ?? null }
  weaponKind(type: number) { return this.it.base[type]?.kind ?? 0 }
}

let files: GameFiles, tb: Tables, items: ItemTables
const host = () => new Host(tb, items)
function person(h: Host, nm: string, side = 0): Uint8Array {
  const c = new Uint8Array(F.size)
  c[F.name] = nm.length
  for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
  c[F.side] = side
  c[F.inPlay] = 1
  c[F.hp] = c[F.maxHp] = c[F.hpRolled] = 20
  for (let i = 0; i < 6; i++) c[F.stat[i]] = c[F.baseStat[i]] = 12
  for (let i = 0; i < 5; i++) c[F.saves + i] = 15
  c[F.itemMask] = 0xff
  h.people.push(c)
  return c
}
/** the first monster of MON1–6CHA with this name */
function monster(nm: string): Uint8Array | undefined {
  for (let b = 1; b <= 6; b++) for (let id = 0; id < 256; id++) {
    const r = files.record(`MON${b}CHA`, id)
    if (r && String.fromCharCode(...r.subarray(F.name + 1, F.name + 1 + r[F.name])) === nm) return new Uint8Array(r.subarray(0, F.size))
  }
  return undefined
}
const spellsOfLevel = (lvl: number) => Array.from({ length: 99 }, (_, i) => i + 1).filter((id) => tb.b(T.spellRecords.at + id * T.spellRecords.row + 1) === lvl)
function item(type: number, handler: number, v: number) {
  const r = new Uint8Array(ITEM_SIZE)
  r[0x2e] = type; r[0x3d] = v; r[0x3e] = handler
  return new Item(r)
}
const slotType = (slot: number) => items.base.findIndex((b) => b.slot === slot && b.hands === 0)

describe.skipIf(!have)('CotAB effect handlers', () => {
  beforeAll(() => {
    setGame(COAB)
    const m = new Map<string, Uint8Array>()
    const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(COAB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
    walk(dir)
    files = new GameFiles(m, COAB)
    tb = new Tables(unexepack(files.get('START.EXE')!).image)
    items = ItemTables.load(files.get('ITEMS'), files.get('START.EXE'))!
  })
  afterAll(() => setGame(POR))

  it('PoR has no handler overrides; CotAB names a behaviour for each changed type', () => {
    expect(POR.effects.handlers).toEqual({})
    expect(POR.effects.items).toBe('handlers')
    expect(COAB.effects.handlers[134]).toEqual({ b: 'rangerVsGiants', flag: 8 })
  })

  it('a ranger adds the ranger level against the giant class (+0x14B & 8, ETTIN in the data)', async () => {
    const h = host()
    const ranger = person(h, 'RANGER'), ettin = monster('ETTIN')!, orc = person(h, 'ORC', 1)
    expect(ettin[F.classFlags] & 8).toBe(8)
    ettin[F.side] = 1; ettin[F.inPlay] = 1
    h.people.push(ettin)
    ranger[F.levels + 4] = 5
    addRaw(h, ranger, 134, 0, 0xff, 0)
    h.targets.set(ranger, ettin)
    fx.dmg = 10
    await fire(h, ranger, 4)
    expect(fx.dmg).toBe(15)
    h.targets.set(ranger, orc)
    fx.dmg = 10
    await fire(h, ranger, 4)
    expect(fx.dmg).toBe(10)
  })

  it('the gnome and dwarf bonuses read the class flags, not names (18, 26)', async () => {
    const h = host()
    const gnome = person(h, 'GNOME'), troll = monster('TROLL')!
    expect(troll[F.classFlags]).toBe(0x0e)
    addRaw(h, gnome, 18, 0, 0xff, 0)
    addRaw(h, gnome, 26, 0, 0xff, 0)
    h.targets.set(gnome, troll)
    fx.roll = 10
    await fire(h, gnome, 10)
    expect(fx.roll).toBe(12)
  })

  it('Confusion: runs away, is confused, goes berserk, is enraged; a save ends it', async () => {
    const h = host()
    const c = person(h, 'DORA'), foe = person(h, 'FOE', 1)
    const confused = () => addRaw(h, c, 35, 0, 0xff, 0)
    // 1–10: runs away (35 goes, 0x8E for 10, computer control, forced to flee)
    confused()
    h.dice = [5, 1] // d100, then the save (a natural 1 fails)
    await fire(h, c, 21)
    expect(h.said.at(-1)).toBe('DORA runs away')
    expect(h.effectsOf(c).map((e) => e.type)).toEqual([0x8e])
    expect([c[F.quick], h.rec(c, 0x10), c[F.morale]]).toEqual([1, 1, 0xb3])
    await removeEffect(h, c, h.effectsOf(c)[0]) // 142's removal gives control back
    expect([c[F.quick], h.rec(c, 0x10), c[F.morale]]).toEqual([0, 0, 0])
    // 11–60: the turn is lost; a natural 20 saves and ends the confusion
    confused()
    h.dice = [30, 20]
    await fire(h, c, 21)
    expect(h.said.at(-1)).toBe('DORA is confused')
    expect(h.ended).toContain(c)
    expect(h.effectsOf(c).some((e) => e.type === 35)).toBe(false)
    // 61–80: berserk (0x89 holds the side), attacks the nearest combatant, its side the opposite
    confused()
    h.dice = [70, 1]
    await fire(h, c, 21)
    expect(h.said).toContain('DORA goes berserk')
    expect(h.effectsOf(c).find((e) => e.type === 0x89)?.power).toBe(0)
    expect(h.targetOf(c)).toBe(foe)
    expect(c[F.side]).toBe(0)
    // 81–100: only a line
    h.dice = [90, 1]
    await fire(h, c, 21)
    expect(h.said.at(-1)).toBe('DORA is enraged')
  })

  it('Minor Globe negates spells below level 4', async () => {
    const h = host()
    const c = person(h, 'GLOBE')
    addRaw(h, c, 63, 0, 0xff, 0)
    const [l3] = spellsOfLevel(3), [l4] = spellsOfLevel(4)
    expect(l3 && l4).toBeTruthy()
    for (const [spell, left] of [[l3, 0], [l4, 12]]) {
      fx.spell = spell; fx.dmgType = 1
      h.damage(c, 12, 0, false)
      expect(20 - c[F.hp]).toBe(left)
      c[F.hp] = 20
    }
    fx.spell = 0
  })

  it('100 % magic resistance (129): every effect blocked, magic damage negated, fire not', async () => {
    const h = host()
    const c = person(h, 'GOLEM')
    addRaw(h, c, 129, 0, 0xff, 0)
    expect(await addEffect(h, c, 11, 0, 0x0c, 1)).toBe(false)
    expect(h.said.at(-1)).toBe('GOLEM is Unaffected')
    fx.spell = 0; fx.dmgType = 8
    h.damage(c, 6, 0, false)
    expect(c[F.hp]).toBe(20)
    fx.dmgType = 1
    h.damage(c, 6, 0, false)
    expect(c[F.hp]).toBe(14)
  })

  it('unsaved fire hurts 50\'s holder twice (event 20); a save against cold is easier', async () => {
    const h = host()
    const c = person(h, 'ICE')
    addRaw(h, c, 50, 0, 0xff, 0)
    fx.dmgType = 1; fx.spell = 0; fx.saved = false
    h.damage(c, 4, 0, false)
    expect(c[F.hp]).toBe(12)
    fx.dmgType = 2
    h.dice = [13] // 13 + 2 = 15 reaches the save of 15
    expect(h.save(c, 4, 0)).toBe(true)
  })

  it('an item of kind 0 grants its effect while readied (handler 147)', async () => {
    const h = host()
    h.combat = false
    const c = person(h, 'RINGER')
    const ring = item(slotType(9), 0x80, 0x70)
    h.itemsOf(c).push(ring)
    expect(await readyItem(h, c, h.itemsOf(c), ring, items)).toBe('')
    expect(h.effectsOf(c)).toEqual([{ type: 0x70, duration: 0, power: 0xff, flag: 1 }])
    await unreadyItem(h, c, h.itemsOf(c), ring, items)
    expect(h.effectsOf(c)).toEqual([])
  })

  it('stat items work through the current-stat routine (Gauntlets of Ogre Power, Girdle of the Dwarves)', async () => {
    const h = host()
    const c = person(h, 'STRONG')
    const [s1, s2] = [...new Set(items.base.filter((x) => x.hands === 0 && x.slot > 0 && x.slot < 9).map((x) => x.slot))]
    const gauntlets = item(slotType(s1), 0x85, 0), girdle = item(slotType(s2), 0x86, 0)
    h.itemsOf(c).push(gauntlets, girdle)
    await readyItem(h, c, h.itemsOf(c), gauntlets, items)
    expect([c[F.stat[0]], c[F.strPct], c[F.baseStat[0]]]).toEqual([18, 100, 12])
    await readyItem(h, c, h.itemsOf(c), girdle, items)
    expect([c[F.stat[4]], c[F.stat[5]]]).toEqual([13, 11])
    await unreadyItem(h, c, h.itemsOf(c), gauntlets, items)
    expect([c[F.stat[0]], c[F.strPct]]).toEqual([12, 0])
  })

  it('a Ring of Wizardry doubles magic-user slots 1–3, and putting it away works them out again', async () => {
    const h = host()
    const c = person(h, 'MAGE')
    c[F.levels + 5] = 3
    const ring = item(slotType(9), 0x81, 0)
    h.itemsOf(c).push(ring)
    c[F.muSlots] = 2; c[F.muSlots + 1] = 1
    await readyItem(h, c, h.itemsOf(c), ring, items)
    expect([c[F.muSlots], c[F.muSlots + 1], c[F.muSlots + 2]]).toEqual([4, 2, 0])
    await unreadyItem(h, c, h.itemsOf(c), ring, items)
    const want = [1, 0, 0, 0, 0]
    for (let L = 2; L <= 3; L++) for (let i = 1; i <= 5; i++) want[i - 1] += tb.b(T.muSlots.at + L * T.muSlots.row + i)
    expect(Array.from(c.subarray(F.muSlots, F.muSlots + 5))).toEqual(want)
  })

  it('removing Enlarge (0x0C) or Friends (0x0E) recomputes STR or CHA from the base', async () => {
    const h = host()
    const c = person(h, 'BIG')
    const enlarge = addRaw(h, c, 0x0c, 10, 18 + 0 /* 18/17 */, 1)
    const other = addRaw(h, c, 0x92, 10, 105 /* STR 5 */, 1)
    c[F.stat[0]] = 18; c[F.strPct] = 17
    await removeEffect(h, c, enlarge)
    expect([c[F.stat[0]], c[F.strPct]]).toEqual([12, 0]) // 0x92's 5 is below the base
    other.power = 117 // STR 17
    await removeEffect(h, c, addRaw(h, c, 0x0c, 10, 50, 1))
    expect([c[F.stat[0]], c[F.strPct]]).toEqual([17, 0])
    const friends = addRaw(h, c, 0x0e, 10, 3, 1)
    addRaw(h, c, 0x0e, 10, 2, 1)
    c[F.stat[5]] = 15
    await removeEffect(h, c, friends)
    expect(c[F.stat[5]]).toBe(14) // the base 12 + the other record's 2
  })
})
