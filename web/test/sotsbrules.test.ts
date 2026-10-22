// Secret of the Silver Blades' rules values and procedures (SOTSB_RULES; spec/A-games/sotsb/chargen-and-progression.md,
// combat.md, camp.md): extra attacks in two steps, the WIS and INT slot limits, creation money and slots, the
// item plural rule, the backstab's reach, difficulty, the new game's variables and Fix's condition pass. Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, SOTSB, setGame, wants } from '../src/games/profile'
import { F } from '../src/games/fields'
import { R } from '../src/games/rules'
import { Tables, rollAbilities } from '../src/rules/chargen'
import { derive } from '../src/rules/training'
import { fix, memorised } from '../src/rules/camp'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { Item } from '../src/data/items'
import { menu } from '../src/games/strings'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)
const io = {
  print: () => {}, menu: async () => 0, inputNumber: async () => 0, inputText: async () => 'TEST', picture: () => {},
  sprite: () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {}, engine: async () => {},
} as unknown as Io

function load(): GameFiles {
  setGame(SOTSB)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(SOTSB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, SOTSB)
}

describe('Silver Blades rules values', () => {
  afterAll(() => setGame(POR))
  it('keep PoR and CotAB as they were and set SotSB its own', () => {
    setGame(POR)
    expect([R.turnUndead, R.setStatusEvent, R.difficulty, R.newGame, R.startClericSlots, R.diseaseCount]).toEqual([true, 13, null, [], 1, 6])
    setGame(COAB)
    expect([R.turnUndead, R.setStatusEvent, R.difficulty, R.extraAttacks, R.dualClass?.spells]).toEqual([true, 13, null, { 2: [6], 3: [6], 4: [7] }, [11, 18, 12, 21]])
    setGame(SOTSB)
    expect([R.turnUndead, R.setStatusEvent, R.difficulty, R.startClericSlots, R.diseaseCount, R.wildBattle.kind]).toEqual([false, null, { variable: 0x4af4, start: 2 }, 2, 4, 'none'])
    expect(R.startSpells).toEqual([11, 18, 19, 21]) // creation 0x3B1C8; dual-classing keeps Enlarge (0x578B6)
    expect(R.dualClass?.spells).toEqual([11, 18, 12, 21])
  })
})

describe.skipIf(!have)('Silver Blades rules on its files', () => {
  afterAll(() => setGame(POR))
  const party = () => {
    const files = load()
    const e = new Engine(files, io, 1)
    e.newGame([1, 2, 3, 4, 5, 6].map((n) => files.get(`CHRDATA${n}.SAV`)!))
    e.write(0x6dd2, 0) // no encounters while resting
    return { e, files, t: new Tables(e.startImage!, 0xde20) }
  }

  it('a new game sets the map flag and the difficulty Veteran (0x2CB1D, 0x2CB28)', () => {
    const { e } = party()
    expect([e.read(0x49e6), e.read(0x4af4)]).toEqual([1, 2])
    expect(menu('alterLevel').map((w) => w.key)).toEqual(['N', 'S', 'V', 'A', 'C'])
    expect(menu('alter').map((w) => w.key)).toContain('L')
  })

  it('scales a loaded monster by the difficulty: × (level + 2) div 4, at least 1 (0x1DF9C)', () => {
    const { e } = party()
    const scale = (lv: number, hp: number, side = 1) => {
      e.write(0x4af4, lv)
      const m = new Uint8Array(F.size); m[F.side] = side; m[F.hp] = m[F.maxHp] = hp
      ;(e as unknown as { scaleForDifficulty(m: Uint8Array): void }).scaleForDifficulty(m)
      return m[F.hp]
    }
    expect([0, 1, 2, 3, 4, 5].map((lv) => scale(lv, 20))).toEqual([10, 15, 20, 25, 30, 20])
    expect(scale(0, 1)).toBe(1)
    expect(scale(0, 20, 0)).toBe(20) // the party's side is left alone
  })

  it('half-attacks: fighters and paladins above 6 and 12, rangers above 7 and 14 (0x56A64)', () => {
    const { e, t } = party()
    const c = e.party()[0]
    // the recalculation only raises the count (recalc.attacksReset false): start each from 2
    const at = (k: number, L: number) => { for (let i = 0; i < F.classCount; i++) c[F.levels + i] = c[F.prevLevels + i] = 0; c[F.levels + k] = L; c[F.attacksBase] = 2; derive(t, c); return c[F.attacksBase] }
    expect([6, 7, 12, 13].map((L) => at(2, L))).toEqual([2, 3, 3, 4])
    expect([7, 13].map((L) => at(3, L))).toEqual([3, 4])
    expect([7, 8, 14, 15].map((L) => at(4, L))).toEqual([2, 3, 3, 4])
  })

  it('clears high spell levels below a WIS or INT (0x56E15, 0x56E3E)', () => {
    const { e, t } = party()
    const c = e.party()[0]
    for (let i = 0; i < F.classCount; i++) c[F.levels + i] = 0
    c[F.levels + 5] = 15
    c[F.stat[1]] = 13; derive(t, c)
    expect([c[F.muSlots + 5], c[F.muSlots + 6]]).toEqual([expect.any(Number), 0])
    expect(c[F.muSlots + 5]).toBeGreaterThan(0)
    c[F.stat[1]] = 11; derive(t, c)
    expect([c[F.muSlots + 5], c[F.muSlots + 6]]).toEqual([0, 0])
    c[F.stat[1]] = 14; derive(t, c)
    expect(c[F.muSlots + 6]).toBeGreaterThan(0)
    c[F.levels + 5] = 0; c[F.levels] = 15
    c[F.stat[2]] = 18; derive(t, c)
    expect(c[F.clericSlots + 5]).toBeGreaterThan(0)
    c[F.stat[2]] = 16; derive(t, c)
    expect(c[F.clericSlots + 5]).toBe(0)
  })

  it('creation: two cleric slots; 2d6 gold for a thief only (0x3B0F0)', () => {
    const { t } = party()
    const make = (k: number) => {
      const c = new Uint8Array(F.size); c[F.race] = 6; c[F.levels + k] = 1
      const rolls: [number, number][] = []
      rollAbilities(t, { roll: (n, s) => { rolls.push([n, s]); return n } }, c)
      return { c, rolls, gold: c[F.money + 6] | (c[F.money + 7] << 8) }
    }
    const cleric = make(0), thief = make(6), fighter = make(2)
    expect(cleric.c[F.clericSlots]).toBe(2)
    expect([cleric.gold, fighter.gold, thief.gold]).toEqual([0, 0, 2])
    expect(thief.rolls).toContainEqual([2, 6])
  })

  it('plural names: ammunition on the third word, type 0x49 on the first (0x53224)', () => {
    const { e } = party()
    const t = e.items!
    const item = (type: number) => { const r = new Uint8Array(63); r[0x2e] = type; r[0x2f] = 1; r[0x31] = 2; r[0x39] = 10; return new Item(r) }
    const [w1, w2] = [t.words[0], t.words[1]]
    expect(t.name(item(0x1e), true)).toBe(`10 ${w2}s ${w1}`)
    expect(t.name(item(0x49), true)).toBe(`10 ${w2} ${w1}s`)
  })

  it('the backstab needs the target within reach (0x33889)', () => {
    const files = load()
    const e = new Engine(files, io, 7)
    const ui = { print: () => {}, redraw: () => {}, pause: async () => {}, sound: () => {}, menu: async () => 0, confirm: async () => false } as unknown as CombatUi
    const bf = new Battlefield(false)
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, 1)
    const cells: CellInfo[] = Array.from({ length: 0x42 }, () => ({ move: 1, sight: 0, image: 0 }))
    const b = new Battle(e, ui, bf, cells)
    const add = (x: number, y: number, side: number) => {
      const c = new Uint8Array(F.size)
      c[F.name] = 1; c[F.name + 1] = 65 + b.fighters.length
      c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = 50; c[F.sizeFlags] = 1; c[F.race] = 7
      const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: side === 1, target: null }
      b.fighters.push(f)
      return f
    }
    const t = add(5, 5, 1), a = add(4, 5, 0)
    t.r[0xf] = 2; a.c[F.levels + 6] = 4
    t.r[9] = b.dirTo(a, t)
    expect(b.backstab(a, t)).toBe(true)
    a.x = 3
    t.r[9] = b.dirTo(a, t)
    expect(b.backstab(a, t)).toBe(false)
  })

  it("Fix's condition pass: Stone to Flesh, Raise Dead (not an elf) and the counts (0x387CE)", async () => {
    const { e } = party()
    const [a, cleric, stone, dead] = e.party()
    for (const c of e.party()) { c[F.status] = 0; c[F.hp] = c[F.maxHp]; for (let l = 0; l < 7; l++) c[F.clericSlots + l] = 0; for (let k = 0; k < F.memorisedCount; k++) c[F.memorised + k] = 0 }
    a[F.hp] = a[F.maxHp] - 3
    stone[F.status] = 7; stone[F.hp] = 0; stone[F.inPlay] = 0
    dead[F.status] = 6; dead[F.hp] = 0; dead[F.inPlay] = 0; dead[F.race] = 6
    cleric[F.memorised] = 113; cleric[F.memorised + 1] = 75
    const con = dead[F.stat[4]]
    const r = await fix(e, { heal: 0 })
    expect(r.interrupted).toBe(false)
    expect([stone[F.status], stone[F.inPlay], stone[F.hp] > 0]).toEqual([0, 1, true])
    expect([dead[F.status], dead[F.inPlay], dead[F.stat[4]]]).toEqual([0, 1, Math.max(0, con - 1)])
    const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
    expect(r.messages).toContain(`${name(stone)} is changed back to flesh`)
    expect(r.messages).toContain(`${name(dead)} has been raised from the dead`)
    expect(memorised(cleric).slice(0, 2)).toEqual([113, 75]) // the spells stay memorised
  })

  it("Fix's Raise Dead passes over an elf", async () => {
    const { e } = party()
    const [a, cleric, dead] = e.party()
    for (const c of e.party()) { c[F.status] = 0; c[F.hp] = c[F.maxHp]; for (let k = 0; k < F.memorisedCount; k++) c[F.memorised + k] = 0 }
    a[F.hp] = a[F.maxHp] - 3
    dead[F.status] = 6; dead[F.hp] = 0; dead[F.race] = 1
    cleric[F.memorised] = 75
    await fix(e, { heal: 0 })
    expect(dead[F.status]).toBe(6)
  })
})
