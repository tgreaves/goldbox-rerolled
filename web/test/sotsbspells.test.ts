// SotSB's spell handlers (spec/A-games/sotsb/spells.md §3, §4) on a real battlefield, each by its kind and
// the parameters in games/spellrules.ts SOTSB_SPELLS; scripted dice as in coabspells.test.ts (an unscripted
// roll is its count, so an unscripted d20 is a 1 and every save fails). Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { addRaw, fx } from '../src/rules/effects'
import { POR, SOTSB, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { SHARED_KINDS } from '../src/rules/spellkinds'
import { SOTSB_SPELLS } from '../src/games/spellrules'
import { installText, textOrNull } from '../src/data/gametext'

const cells: CellInfo[] = Array.from({ length: 0x42 }, (_, i) => ({ move: i === 2 ? 0xff : 1, sight: i === 2 ? 2 : 0, image: 0 }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

function field(files: GameFiles) {
  const e = new Engine(files, io, 7)
  const dice: number[] = []
  e.roll = (n: number) => dice.length ? dice.shift()! : n
  const printed: string[] = []
  const ui = { print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {}, menu: async () => 0, confirm: async () => false } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, 1)
  const b = new Battle(e, ui, bf, cells)
  const add = (x: number, y: number, side: number, nm: string, opts: { hp?: number; hd?: number } = {}) => {
    const c = new Uint8Array(F.size)
    c[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
    c[F.inPlay] = 1; c[F.side] = side; c[F.hp] = c[F.maxHp] = opts.hp ?? 100; c[F.sizeFlags] = 1
    c[F.hitDice] = opts.hd ?? 1
    for (let i = 0; i < 6; i++) c[F.baseStat[i]] = c[F.stat[i]] = 10
    for (let i = 0; i < 5; i++) c[F.saves + i] = 15
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: side === 1, target: null }
    f.r[3] = 5
    b.fighters.push(f)
    return f
  }
  b.damageSync = () => {}
  const cast = async (f: Fighter, id: number, L: number, targets: Fighter[]) => {
    b.current_ = f
    b.aimed = targets[0] ? { x: targets[0].x, y: targets[0].y } : { x: f.x, y: f.y }
    fx.spell = id
    try { await b.applySpell(f, e.spells!.get(id)!, L, targets) } finally { fx.spell = 0 }
  }
  const has = (f: Fighter, type: number) => b.effectsOf(f.c).filter((x) => x.type === type)
  return { e, b, add, printed, dice, cast, has }
}

const sotsb = process.env.SOTSB ?? ''
const have = !!sotsb && existsSync(sotsb)

describe.skipIf(!have)('SotSB spells (SOTSB_SPELLS)', () => {
  const files = have ? load(sotsb, SOTSB) : null
  afterAll(() => setGame(POR))
  const game = () => { setGame(SOTSB); return field(files!) }

  it('every id 1–117 names a kind of the battle or the shared ones', () => {
    const battle = (Battle as unknown as { spellKinds: Record<string, unknown> }).spellKinds
    for (let id = 1; id <= 117; id++) {
      const h = SOTSB_SPELLS.handlers[id]
      expect(h, `id ${id}`).toBeDefined()
      expect(SHARED_KINDS[h.k] ?? battle[h.k], `id ${id}: ${h.k}`).toBeTypeOf('function')
    }
  })

  it('every line is SotSB\'s own text (each piece reads as a string)', () => {
    setGame(SOTSB)
    installText(files!.get('START.EXE'), files!.get('GAME.OVR'))
    const KEYS = ['msg', 'unaffected', 'itemMsg', 'immuneMsg', 'castMsg', 'prompt', 'abort', 'curedMsg', 'blindMsg', 'feebleMsg', 'floorMsg', 'notMsg']
    for (const [id, h] of Object.entries(SOTSB_SPELLS.handlers)) for (const k of KEYS) {
      const v = (h as Record<string, unknown>)[k]
      if (v === undefined) continue
      for (const a of Array.isArray(v) ? v : [v]) expect(textOrNull(a as number), `id ${id} ${k} ${(a as number).toString(16)}`).toMatch(/^[ -~]+$/)
    }
  })

  it('Heal (36, 0x4A84E): diseases, blindness and feeblemind go; HP to max − 1d4', async () => {
    const { b, add, cast, has, dice, printed } = game()
    const cleric = add(5, 5, 0, 'CLERIC')
    const t = add(6, 5, 0, 'T', { hp: 40 })
    t.c[F.hp] = 10
    for (const type of [31, 0x21, 0x44]) addRaw(b, t.c, type, 0, 0, 0)
    dice.push(3)
    await cast(cleric, 36, 9, [t])
    expect([has(t, 31), has(t, 0x21), has(t, 0x44)].map((x) => x.length)).toEqual([0, 0, 0])
    expect(t.c[F.hp]).toBe(37)
    expect(printed.filter((l) => l.startsWith('T '))).toEqual(['T is cured', 'T is no longer blind', 'T regains intellect', 'T is Healed'])
  })

  it('Death Spell (110, 0x4D0E5): the pool pays by hit dice, the immunity flag 8 is spared', async () => {
    const { add, cast, dice } = game()
    const mage = add(5, 5, 0, 'MAGE')
    const a = add(6, 5, 1, 'A', { hd: 2 }), z = add(7, 5, 1, 'Z', { hd: 2 }), c = add(8, 5, 1, 'C', { hd: 4 })
    z.c[F.immunity] = 8
    dice.push(12) // the pool: 4d20 = 12
    await cast(mage, 110, 12, [a, z, c])
    expect([a.c[F.status], z.c[F.status], c.c[F.status]]).toEqual([6, 0, 0]) // A pays 8; Z is immune; C's 16 is not covered
  })

  it('Disintegrate (111) and Flesh to Stone (114): a failed save is status 6 or 7', async () => {
    const { add, cast } = game()
    const mage = add(5, 5, 0, 'MAGE')
    const a = add(6, 5, 1, 'A'), s = add(7, 5, 1, 'S')
    await cast(mage, 111, 12, [a])
    await cast(mage, 114, 12, [s])
    expect([a.c[F.status], s.c[F.status]]).toEqual([6, 7])
  })

  it('Power Word Stun (117, 0x4D8ED): the rounds by HP band, power L', async () => {
    const { e, add, cast, has, dice } = game()
    const mage = add(5, 5, 0, 'MAGE')
    const t = add(6, 5, 1, 'T', { hp: 45 })
    dice.push(7) // 2d4 for HP 31–60
    await cast(mage, 117, 12, [t])
    const effect = e.spells!.get(117)!.effect
    expect(has(t, effect).map((x) => [x.duration, x.power])).toEqual([[7, 12]])
  })

  it('Charm Person (10, 0x498D1): a monster race refused unless its immunity flag 2', async () => {
    const { add, cast, printed } = game()
    const mage = add(5, 5, 0, 'MAGE')
    const m = add(6, 5, 1, 'M'), p = add(7, 5, 1, 'P')
    m.c[F.race] = 7; p.c[F.race] = 7; p.c[F.immunity] = 2
    await cast(mage, 10, 5, [m])
    expect(printed).toContain('M is Unaffected')
    printed.length = 0
    await cast(mage, 10, 5, [p])
    expect(printed).not.toContain('P is Unaffected')
  })
})
