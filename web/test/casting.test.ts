// Casting in combat for both games (spec/combat.md "Cast", spec/coab/combat.md "Casting"): "Begins
// Casting" and the spell going off when the caster is picked again later in the round, the spell lost
// to damage before then (PoR forgets it from the current character, CotAB from the caster), the
// computer's delayed cast and its spell choice, casting at once, the camp-only refusal, Abort Spell?,
// CotAB's miscast (0x45373) and Feeblemind's lost spell (0x288D9). Real battlefields from each game's
// files, scripted dice (each roll takes the next value, else its count; every d100 is a 1, so turn-order
// ties go to the later entry). Needs POOLRAD and COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { addRaw } from '../src/rules/effects'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import type { Spell } from '../src/data/spells'

const OPEN = 1
const cells: CellInfo[] = Array.from({ length: 0x42 }, (_, i) => ({ move: 1, sight: 0, image: i }))
const io = { print: () => {}, menu: async () => 0 } as unknown as Io

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

const FIREBALL = 47, MAGIC_MISSILE = 15, READ_MAGIC = 18, CLW = 3

/**
 * An open field. The UI answers by label: `menus` the command menus (e.g. 'CAST', 'DONE', 'QUIT'),
 * `picks` the spell lists, `aims` the target picks (null: cancel), `confirms` the yes/no questions.
 * Every spell that goes off is recorded in `went` instead of being applied.
 */
function field(files: GameFiles) {
  const e = new Engine(files, io, 7)
  const dice: number[] = []
  e.roll = (n: number, d: number) => d === 100 ? 1 : dice.length ? dice.shift()! : n
  const printed: string[] = [], menus: string[] = [], picks: string[] = [], confirms: boolean[] = [], aims: (Fighter | null)[] = []
  const shown: string[][] = []
  const ui = {
    print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {},
    menu: async (items: string[]) => { shown.push(items); return items.indexOf(menus.shift() ?? (items.includes('QUIT') ? 'QUIT' : 'DONE')) },
    pick: async (_p: string, items: string[]) => items.indexOf(picks.shift() ?? ''),
    confirm: async () => confirms.shift() ?? true,
    aim: async (_f: Fighter, entries: { f: Fighter | null; x: number; y: number }[]) => {
      const t = aims.shift()
      return t ? entries.find((en) => en.f === t) ?? { f: t, x: t.x, y: t.y, cost: 0, ok: true } : null
    },
  } as unknown as CombatUi
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
  const b = new Battle(e, ui, bf, cells)
  const went: [string, string, string[]][] = []
  const b2 = b as unknown as { applySpell: (f: Fighter, s: Spell, L: number, t: Fighter[]) => Promise<void> }
  let during: ((f: Fighter) => void) | null = null
  b2.applySpell = async (f, s, _L, t) => { went.push([b.name(f.c), s.name, t.map((x) => b.name(x.c))]); during?.(f) }
  const add = (x: number, y: number, side: number, nm: string, init: number, spells: number[] = [], opts: { hp?: number; quick?: boolean; from?: number } = {}) => {
    const c = new Uint8Array(F.size)
    c[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) c[F.name + 1 + i] = nm.charCodeAt(i)
    c[F.inPlay] = 1; c[F.side] = side; c[F.maxHp] = 100; c[F.hp] = opts.hp ?? 100; c[F.sizeFlags] = 1
    c[F.levels + 5] = 5 // a 5th-level magic-user
    for (let i = 0; i < 6; i++) c[F.baseStat[i]] = c[F.stat[i]] = 10
    for (let i = 0; i < 5; i++) c[F.saves + i] = 15
    spells.forEach((id, k) => { c[F.memorised + (opts.from ?? 0) + k] = id })
    if (opts.quick) c[F.quick] = 1
    const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: side === 1, target: null }
    f.r[1] = 1; f.r[2] = 1; f.r[3] = init
    b.fighters.push(f)
    return f
  }
  const memorised = (f: Fighter) => Array.from({ length: F.memorisedCount }, (_, k) => f.c[F.memorised + k]).filter((v) => v > 0)
  /** the rest of the round: `play` returns true for a turn it played itself (else the turn is the game's) */
  const round = async (play: (f: Fighter) => Promise<boolean> | boolean = () => false) => {
    const order: string[] = []
    for (let n = 0; n < 40; n++) {
      const f = b.pickNext()
      if (!f) break
      order.push(b.name(f.c))
      if (!(await play(f))) await b.turn(f)
    }
    return order
  }
  /** a combatant that does nothing on its turn */
  const pass = (f: Fighter) => { b.endTurnF(f); return true }
  return { e, b, add, printed, dice, menus, picks, confirms, aims, shown, went, memorised, round, pass, during: (fn: (f: Fighter) => void) => { during = fn } }
}

const por = process.env.POOLRAD ?? '', coab = process.env.COAB ?? ''
const games = [
  { name: 'Pool of Radiance', g: POR, dir: por, slot: 0 },
  { name: 'Curse of the Azure Bonds', g: COAB, dir: coab, slot: 1 },
] as const

for (const game of games) {
  const have = !!game.dir && existsSync(game.dir)
  describe.skipIf(!have)(`${game.name}: casting in combat`, () => {
    const files = have ? load(game.dir, game.g) : null
    afterAll(() => setGame(POR))
    const make = () => { setGame(game.g); return field(files!) }

    it('reads the casting data from the spell records', () => {
      const { e } = make()
      const st = e.spells!
      expect(st.get(FIREBALL)!.name).toBe('Fireball')
      expect(Math.floor(st.get(FIREBALL)!.castTime / 3)).toBe(1)
      expect(Math.floor(st.get(MAGIC_MISSILE)!.castTime / 3)).toBe(0)
      expect(st.get(READ_MAGIC)!.where).toBe(0)
      expect(st.get(CLW)!.aiHostile).toBe(0)
    })

    it('Begins Casting, picked again later in the round: the spell goes off then and leaves the list', async () => {
      const { add, printed, menus, picks, aims, went, memorised, round, pass } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL, MAGIC_MISSILE])
      const orc = add(10, 5, 1, 'ORC', 5)
      const ally = add(2, 7, 0, 'ALLY', 3)
      menus.push('CAST'); picks.push('Fireball'); aims.push(orc)
      const order = await round((f) => f === mage ? false : pass(f))
      expect(order).toEqual(['MAGE', 'ORC', 'MAGE', 'ALLY']) // 6 − 1 = 5 ties the orc, which comes later
      expect(printed).toContain('MAGE Begins Casting')
      expect(went).toEqual([['MAGE', 'Fireball', ['ORC']]])
      expect(printed.indexOf('MAGE Casts a Spell')).toBeGreaterThan(printed.indexOf('MAGE Begins Casting'))
      expect(memorised(mage)).toEqual([MAGIC_MISSILE])
      expect(mage.r[0]).toBe(0)
      expect(mage.r[3]).toBe(0)
      void ally
    })

    it('damage before then: "lost a spell", nothing cast, and the spell leaves the ' + (game.g === POR ? 'attacker (the original\'s bug)' : 'caster'), async () => {
      const { b, add, printed, menus, picks, aims, shown, went, memorised, round } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL])
      const orc = add(3, 5, 1, 'ORC', 5, [FIREBALL])
      menus.push('CAST'); picks.push('Fireball'); aims.push(orc)
      const order = await round(async (f) => {
        if (f !== orc) return false
        b.current_ = orc // the orc hits the mage
        b.inflict(mage, 3)
        b.endTurnF(orc)
        return true
      })
      expect(order).toEqual(['MAGE', 'ORC', 'MAGE'])
      expect(printed).toContain('MAGE lost a spell')
      expect(went).toEqual([])
      expect(mage.r[0]).toBe(0)
      expect(mage.r[1]).toBe(0) // no more casting this round: the menu on its next turn has no CAST
      expect(shown.at(-1)).not.toContain('CAST')
      if (game.g === POR) { expect(memorised(mage)).toEqual([FIREBALL]); expect(memorised(orc)).toEqual([]) }
      else { expect(memorised(mage)).toEqual([]); expect(memorised(orc)).toEqual([FIREBALL]) }
    })

    it('held at its next turn (event 7 ends it): the spell is not cast and stays memorised', async () => {
      const { b, add, menus, picks, aims, went, memorised, round, pass } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL])
      const orc = add(10, 5, 1, 'ORC', 5)
      menus.push('CAST'); picks.push('Fireball'); aims.push(orc)
      await round((f) => {
        if (f === orc) { b.endTurnF(mage); return pass(f) } // as a hold's event 7 does (FUN_10ba_2637)
        return false
      })
      expect(went).toEqual([])
      expect(memorised(mage)).toEqual([FIREBALL])
      expect(mage.r[0]).toBe(0)
    })

    it('a spell with no casting time goes off at once and ends the turn', async () => {
      const { add, printed, menus, picks, aims, went, memorised, round, pass } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [MAGIC_MISSILE])
      const orc = add(6, 5, 1, 'ORC', 5)
      menus.push('CAST'); picks.push('Magic Missile'); aims.push(orc)
      const order = await round((f) => f === mage ? false : pass(f))
      expect(order).toEqual(['MAGE', 'ORC'])
      expect(printed).not.toContain('MAGE Begins Casting')
      expect(went).toEqual([['MAGE', 'Magic Missile', ['ORC']]])
      expect(memorised(mage)).toEqual([])
    })

    it('a camp-only spell is refused and the turn goes on', async () => {
      const { add, printed, menus, picks, shown, memorised, round, pass } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [READ_MAGIC])
      add(6, 5, 1, 'ORC', 5)
      menus.push('CAST', 'DONE', 'QUIT'); picks.push('Read Magic')
      await round((f) => f === mage ? false : pass(f))
      expect(printed).toContain('Camp Only Spell')
      expect(shown.length).toBe(3) // the command menu again after the refusal, then Done
      expect(mage.r[0]).toBe(0)
      expect(memorised(mage)).toEqual([READ_MAGIC])
    })

    it('Abort Spell? No aims again (announced again); Yes aborts and forgets', async () => {
      const run = async (answer: boolean) => {
        const { b, add, printed, confirms, aims, went, memorised } = make()
        const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL])
        const orc = add(10, 5, 1, 'ORC', 5)
        mage.r[0] = FIREBALL
        aims.push(null, orc); confirms.push(answer)
        await b.turn(mage)
        return { printed, went, memorised: memorised(mage), casts: printed.filter((t) => t === 'MAGE Casts a Spell').length }
      }
      const no = await run(false)
      expect(no.casts).toBe(2)
      expect(no.went).toEqual([['MAGE', 'Fireball', ['ORC']]])
      const yes = await run(true)
      expect(yes.printed).toContain('Spell Aborted')
      expect(yes.went).toEqual([])
      expect(yes.memorised).toEqual([])
    })

    it("the player's queued spell is not lost to its own damage; the computer's costs another copy", async () => {
      const run = async (quick: boolean) => {
        const { b, add, printed, aims, went, memorised, during } = make()
        const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL, FIREBALL], { quick, from: game.slot })
        const orc = add(10, 5, 1, 'ORC', 5)
        b.magicOn = true
        mage.r[0] = FIREBALL
        aims.push(orc)
        during((f) => b.inflict(f, 1)) // its own fireball reaches it
        await b.turn(mage)
        return { lost: printed.includes('MAGE lost a spell'), went: went.length, left: memorised(mage).length }
      }
      expect(await run(false)).toEqual({ lost: false, went: 1, left: 1 })
      expect(await run(true)).toEqual({ lost: true, went: 1, left: 0 })
    })

    it("the computer's delayed cast: chosen, begun, then aimed and cast when picked again", async () => {
      const { b, add, printed, dice, went, memorised, round, pass } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL], { quick: true, from: game.slot })
      add(10, 5, 1, 'ORC', 5)
      b.magicOn = true
      dice.push(1, 1, 1) // the turn's d8 and d4 (FUN_3334_000f), then one pass, at priority 7 (Fireball's)
      const order = await round((f) => f === mage ? false : pass(f))
      expect(order).toEqual(['MAGE', 'ORC', 'MAGE'])
      expect(printed).toContain('MAGE Begins Casting')
      expect(went).toEqual([['MAGE', 'Fireball', ['ORC']]])
      expect(memorised(mage)).toEqual([])
    })

    it('the computer turns an area spell down when any enemy in reach has one of its side near it', async () => {
      const { b, add, dice } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL], { quick: true, from: game.slot })
      add(14, 5, 1, 'ORC', 5)
      add(8, 9, 1, 'GOBLIN', 5)
      add(8, 10, 0, 'ALLY', 5)
      b.magicOn = true
      dice.push(1)
      expect(await b.aiCast(mage)).toBe(false)
      expect(mage.r[0]).toBe(0)
    })

    it('the computer casts Cure Light Wounds on a wounded neighbour with no enemy in reach (the patient finder)', async () => {
      const { b, add, dice, went, round, pass, printed } = make()
      const priest = add(2, 5, 0, 'PRIEST', 6, [CLW], { quick: true, from: game.slot })
      add(3, 5, 0, 'HURT', 2, [], { hp: 50 })
      add(14, 5, 1, 'ORC', 5)
      b.magicOn = true
      dice.push(1, 1, 7) // the turn's d8 and d4 (FUN_3334_000f), then seven passes: Cure Light Wounds has priority 1
      const order = await round((f) => f === priest ? false : pass(f))
      expect(order).toEqual(['PRIEST', 'ORC', 'PRIEST', 'HURT'])
      expect(printed).toContain('PRIEST Begins Casting')
      expect(went).toEqual([['PRIEST', 'Cure Light Wounds', ['HURT']]])
    })

    it('the patient: the fewest HP below 8, else a body; the caster itself when under half', () => {
      const { b, add } = make()
      const priest = add(5, 5, 0, 'PRIEST', 6, [], { hp: 40 })
      const worse = add(6, 5, 0, 'WORSE', 1, [], { hp: 9 })
      expect(b.patient(priest)).toBe(priest) // 9 < 40, but the caster under half its HP is taken too
      priest.c[F.hp] = 60
      expect(b.patient(priest)).toBe(worse)
      const down = add(5, 6, 0, 'DOWN', 0)
      down.c[F.status] = 4; down.c[F.inPlay] = 0; down.c[F.hp] = 0
      b.downF(down)
      expect(b.patient(priest)).toBe(down) // a body beats a patient with 8 HP or more
      worse.c[F.hp] = 7
      expect(b.patient(priest)).toBe(worse)
    })

    it('Use: no casting time, not announced, not forgotten', async () => {
      const { b, e, add, printed, aims, went, memorised } = make()
      const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL])
      const orc = add(10, 5, 1, 'ORC', 5)
      aims.push(orc)
      b.current_ = mage
      await b.castSpell(mage, e.spells!.get(FIREBALL)!, { fromItem: true, announce: false })
      expect(went).toEqual([['MAGE', 'Fireball', ['ORC']]])
      expect(printed).not.toContain('MAGE Casts a Spell')
      expect(memorised(mage)).toEqual([FIREBALL])
    })

    if (game.g === POR) {
      it('the computer reads every memorised slot, the first included; no miscast', async () => {
        const { b, e, add, dice, went, memorised } = make()
        const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL], { quick: true })
        const orc = add(10, 5, 1, 'ORC', 5)
        b.magicOn = true
        dice.push(1)
        expect(await b.aiCast(mage)).toBe(true)
        expect(mage.r[0]).toBe(FIREBALL)
        addRaw(b, mage.c, 0x4a, 0, 0xff, 0)
        await b.castSpell(mage, e.spells!.get(FIREBALL)!, { auto: true })
        expect(went).toEqual([['MAGE', 'Fireball', ['ORC']]])
        expect(memorised(mage)).toEqual([])
        void orc
      })
    } else {
      it('the computer never chooses memorised slot 0 (0x236E4)', async () => {
        const { b, add, dice } = make()
        const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL], { quick: true })
        add(10, 5, 1, 'ORC', 5)
        b.magicOn = true
        dice.push(1)
        expect(await b.aiCast(mage)).toBe(false)
      })

      it('the computer begins a camp-only spell it accepts: refused, and its turn goes on', async () => {
        const { b, e, add, printed, dice } = make()
        const RAISE_DEAD = 75
        expect(e.spells!.get(RAISE_DEAD)!.where).toBe(0)
        const priest = add(2, 5, 0, 'PRIEST', 6, [RAISE_DEAD], { quick: true, from: 1 })
        add(10, 5, 1, 'ORC', 5)
        b.magicOn = true
        dice.push(7)
        expect(await b.aiCast(priest)).toBe(false)
        expect(printed).toContain('Camp Only Spell')
        expect(priest.r[0]).toBe(0)
      })

      it('a caster with effect 0x4A miscasts on 1 in 1d2 (0x45373): announced, nothing else, the spell kept', async () => {
        const run = async (d2: number) => {
          const { b, add, printed, dice, aims, went, memorised } = make()
          const mage = add(2, 5, 0, 'MAGE', 6, [FIREBALL])
          const orc = add(10, 5, 1, 'ORC', 5)
          addRaw(b, mage.c, 0x4a, 0, 0xff, 0)
          mage.r[0] = FIREBALL
          aims.push(orc); dice.push(d2)
          await b.turn(mage)
          return { printed, went: went.length, left: memorised(mage), r0: mage.r[0] }
        }
        const mis = await run(1)
        expect(mis.printed).toEqual(expect.arrayContaining(['MAGE Casts a Spell', 'Spell: Fireball']))
        expect(mis.went).toBe(0)
        expect(mis.left).toEqual([FIREBALL])
        expect(mis.r0).toBe(0)
        const ok = await run(2)
        expect(ok.went).toBe(1)
        expect(ok.left).toEqual([])
      })

      it('Feeblemind on a caster in the middle of casting: "is stupid", "lost a spell" (0x288D9), from the caster', async () => {
        const { b, e, add, printed, memorised } = make()
        const mage = add(2, 5, 0, 'MAGE', 4, [FIREBALL])
        const enemy = add(6, 5, 1, 'ENEMY', 6, [FIREBALL])
        mage.r[0] = FIREBALL
        b.current_ = enemy
        const real = Object.getPrototypeOf(b).applySpell as (f: Fighter, s: Spell, L: number, t: Fighter[]) => Promise<void>
        b.aimed = { x: mage.x, y: mage.y }
        await real.call(b, enemy, e.spells!.get(93)!, 9, [mage])
        expect(printed).toEqual(expect.arrayContaining(['MAGE is stupid', 'MAGE lost a spell']))
        expect(mage.r[0]).toBe(0)
        expect(mage.r[1]).toBe(0)
        expect(memorised(mage)).toEqual([])
        expect(memorised(enemy)).toEqual([FIREBALL])
      })
    }
  })
}
