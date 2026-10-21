// The test vectors of spec/D-appendices/test-vectors.md: each procedure of part B run by the reference
// implementation on a stated input and a dice tape (spec/B-model/host-contracts.md §6.4), its output
// compared with the committed manifest spec/D-appendices/test-vectors.json. Three kinds:
//   S  synthetic: no game files at all; input and output in full
//   E  the game's executable (START.EXE, GAME.OVR) for its tables; synthetic records; output in full
//      (rules values only: numbers, no game text)
//   F  the player's game files (saves, maps, records); output as a SHA-256 (no game data in the repository)
// The generator (headless/vectors-run.ts) makes the inputs' tapes from the reference generator and writes
// the manifest; web/test/vectors.test.ts replays every tape and checks the outputs against it.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { COAB, POR, byId, setGame, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { T } from '../src/games/tables'
import { R } from '../src/games/rules'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { TapePlayer, TapeRecorder, generator, random, type Dice, type Draw, type Tape } from '../src/rules/dice'
import { Tables, begin, rollAbilities, rollHitDice } from '../src/rules/chargen'
import { derive, train } from '../src/rules/training'
import { casterLevel } from '../src/rules/magic'
import { joinRefusal } from '../src/rules/joining'
import { msg } from '../src/games/strings'
import { appraiseGem, appraiseJewel, coinValue, share } from '../src/rules/money'
import { strDec, strEnc } from '../src/rules/effects'
import { Battle, Line, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, mapBattlefield, terrainFlags, wildField, type CellInfo } from '../src/rules/battlefield'
import { randomTreasure } from '../src/rules/randitem'
import { GeoMap } from '../src/data/geo'
import { ItemTables, type Item } from '../src/data/items'
import { readDax, daxRecords } from '../src/data/dax'
import { unexepack } from '../src/data/exepack'
import { mergedImage } from '../src/data/gametext'
import { installNames } from '../src/data/character'
import type { Spell } from '../src/data/spells'
import { driverTrace } from '../src/audio/driver'
import { loadFolder, runScript, type Event, type Script } from './harness'

export type Kind = 'S' | 'E' | 'F'

/** One vector as the manifest holds it. */
export interface Vector {
  id: string
  kind: Kind
  game: string
  /** the procedure (the keys of PROCEDURES) */
  procedure: string
  input: Record<string, unknown>
  /** the dice tape when the procedure rolls, as runs: [count, sides, result, result …] is that many draws of
   *  the same request in a row (`fromRuns` gives the host-contracts.md §6.4 draws) */
  tape?: number[][]
  /** S and E: the output in full */
  output?: unknown
  /** F: the SHA-256 of the canonical output, and its length in bytes */
  sha256?: string
  bytes?: number
}

export interface Manifest {
  format: 'goldbox-test-vectors'
  version: 1
  /** per game, the SHA-256 of the START.EXE the E and F vectors were computed with (another release skips them) */
  releases: Record<string, { startExe: string }>
  vectors: Vector[]
}

/** The game folders the E and F vectors read (null: not available, those vectors skip). */
export interface Folders { por: string | null; coab: string | null }

export const sha256 = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex')
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')

/** The canonical bytes of an output: bytes as they are, anything else as its JSON (JSON.stringify, no spaces). */
export function canonical(out: unknown): Uint8Array {
  if (out instanceof Uint8Array) return out
  return new TextEncoder().encode(typeof out === 'string' ? out : JSON.stringify(out))
}

// ------------------------------------------------------------------ game context

const profile = (id: string): GameProfile => {
  const g = byId(id)
  if (!g) throw new Error(`no game ${id}`)
  setGame(g)
  return g
}

const filesCache = new Map<string, GameFiles>()
function folderFiles(g: GameProfile, dir: string): GameFiles {
  const key = `${g.id}:${dir}`
  let f = filesCache.get(key)
  if (!f) { f = loadFolder(g, dir); filesCache.set(key, f) }
  return f
}

/** The game's START.EXE and GAME.OVR only (what E vectors may read). */
function exeFiles(g: GameProfile, dir: string): GameFiles {
  const all = folderFiles(g, dir)
  const m = new Map<string, Uint8Array>()
  for (const n of ['START.EXE', 'GAME.OVR']) { const b = all.get(n); if (b) m.set(n, b) }
  return new GameFiles(m, g)
}

/** The SHA-256 of a folder's START.EXE as the game's profile reads it (null without one). */
export function startExeHash(g: GameProfile, dir: string): string | null {
  if (!existsSync(dir)) return null
  const b = folderFiles(g, dir).get('START.EXE')
  return b ? sha256(b) : null
}

interface Ctx { g: GameProfile; dir: string | null; dice: Dice }

/** A data segment of zeros with the given table bytes set (S vectors): [table, offset in it, bytes]. */
function syntheticImage(ds: [string, number, number[]][] = []): Uint8Array {
  const img = new Uint8Array(T.ds + 0x8000)
  for (const [name, off, bytes] of ds) {
    const ref = (T as unknown as Record<string, { at: number }>)[name]
    if (!ref || ref.at < 0) throw new Error(`the game has no table ${name}`)
    img.set(bytes, T.ds + ref.at + off)
  }
  return img
}

const exeImage = (x: Ctx) => {
  const b = folderFiles(x.g, x.dir!).get('START.EXE')
  if (!b) throw new Error('no START.EXE')
  return unexepack(b).image
}

// ------------------------------------------------------------------ records by field name

type Fields = Record<string, unknown>

/** A record of the active game's layout with the named fields set (records-and-tables.md §2 names). */
export function record(fields: Fields): Uint8Array {
  const c = new Uint8Array(F.size)
  const fm = F as unknown as Record<string, number | number[]>
  for (const [k, v] of Object.entries(fields)) {
    const at = fm[k]
    if (at === undefined || at === -1) throw new Error(`the game's record has no field ${k}`)
    if (k === 'name') {
      const s = String(v)
      c[F.name] = s.length
      for (let i = 0; i < s.length; i++) c[F.name + 1 + i] = s.charCodeAt(i)
    } else if (Array.isArray(at)) (v as number[]).forEach((x, i) => (c[at[i]] = x))
    else if (k === 'money') (v as number[]).forEach((x, i) => { c[at + 2 * i] = x & 0xff; c[at + 2 * i + 1] = x >> 8 })
    else if (k === 'age' || k === 'xp') { const n = v as number; for (let i = 0; i < (k === 'xp' ? 4 : 2); i++) c[at + i] = (n >>> (8 * i)) & 0xff }
    else if (Array.isArray(v)) (v as number[]).forEach((x, i) => (c[at + i] = x & 0xff))
    else c[at] = (v as number) & 0xff
  }
  return c
}

const bytes = (c: Uint8Array, at: number, n: number) => Array.from(c.subarray(at, at + n))
const u16 = (c: Uint8Array, at: number) => c[at] | (c[at + 1] << 8)

/** The derived statistics a vector reports (numbers only). */
function derived(c: Uint8Array) {
  const o: Record<string, unknown> = {
    thac0Base: c[F.thac0Base], hitDice: c[F.hitDice], attacksBase: c[F.attacksBase],
    saves: bytes(c, F.saves, 5),
    clericSlots: bytes(c, F.clericSlots, F.slotLevels),
  }
  if (F.druidSlots >= 0) o.druidSlots = bytes(c, F.druidSlots, F.slotLevels)
  o.muSlots = bytes(c, F.muSlots, F.slotLevels)
  o.thief = bytes(c, F.thief, 8)
  o.known = Array.from({ length: F.knownCount }, (_, i) => i + 1).filter((id) => c[F.known + id])
  return o
}

/** A new character's numbers (creation, training). */
function character(c: Uint8Array) {
  return {
    id: c[F.id], age: u16(c, F.age), stat: F.stat.map((a) => c[a]), strPct: c[F.strPct], levels: bytes(c, F.levels, 8),
    hp: c[F.hp], maxHp: c[F.maxHp], hpRolled: c[F.hpRolled], money: Array.from({ length: 7 }, (_, i) => u16(c, F.money + 2 * i)),
    itemMask: c[F.itemMask], ...derived(c),
  }
}

// ------------------------------------------------------------------ battles on a made-up field

const quietIo = {
  print: () => {}, menu: async () => 0, inputNumber: async () => 0, inputText: async () => '', picture: () => {},
  sprite: () => {}, clearView: () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {}, engine: async () => {},
} as unknown as Io
const quietUi = new Proxy({}, { get: (_t, k) => (k === 'menu' ? async () => 0 : k === 'confirm' ? async () => false : () => {}) }) as unknown as CombatUi

interface FighterIn { x: number; y: number; side: number; hp?: number; saves?: number[]; ac?: number; thac0?: number; attacks?: number; dice?: [number, number, number]; size?: number }
const OPEN = 1, WALL = 2

/** An engine on the game's executable, a field of open cells (walls where given) and the fighters. */
function arena(x: Ctx, input: { walls?: [number, number][]; fighters: FighterIn[] }) {
  const e = new Engine(exeFiles(x.g, x.dir!), quietIo, x.dice)
  const cells: CellInfo[] = Array.from({ length: 0x42 }, (_, i) => ({ move: i === WALL ? 0xff : 1, sight: i === WALL ? 2 : 0, image: 0 }))
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
  for (const [wx, wy] of input.walls ?? []) bf.set(wy, wx, WALL)
  const b = new Battle(e, quietUi, bf, cells)
  input.fighters.forEach((d, i) => {
    const c = record({ name: String.fromCharCode(65 + i), inPlay: 1, side: d.side, hp: d.hp ?? 200, maxHp: d.hp ?? 200, saves: d.saves ?? [20, 20, 20, 20, 20],
      ac: d.ac ?? 50, thac0: d.thac0 ?? 40, attacksLeft: [d.attacks ?? 2, 0], dice: [d.dice?.[0] ?? 1, 0], sides: [d.dice?.[1] ?? 6, 0], bonus: [d.dice?.[2] ?? 0, 0] })
    const f: Fighter = { c, r: new Uint8Array(0x1e), x: d.x, y: d.y, size: d.size ?? 1, index: i, monster: d.side === 1, target: null }
    b.fighters.push(f)
  })
  const hits: [number, number, boolean][] = []
  const inner = b.damageSync.bind(b)
  b.damageSync = (c, dmg, mode, saved) => { hits.push([b.fighters.findIndex((f) => f.c === c), dmg, saved]); inner(c, dmg, mode, saved) }
  return { e, b, bf, hits }
}

/** What a battle vector reports: who took what, hit points after, the cells that changed, the effects. */
function battleOutput(a: ReturnType<typeof arena>, walls: [number, number][] = []) {
  const changed: [number, number, number][] = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = a.bf.get(r, c)
    if (v !== (walls.some(([x, y]) => x === c && y === r) ? WALL : OPEN)) changed.push([c, r, v])
  }
  return {
    damage: a.hits,
    hp: a.b.fighters.map((f) => f.c[F.hp]),
    cells: changed,
    effects: a.b.fighters.map((f) => a.e.effectsOf(f.c).map((x) => [x.type, x.duration, x.power, x.flag])),
  }
}

// ------------------------------------------------------------------ the procedures

type Run = (x: Ctx, input: any) => Promise<unknown> | unknown // eslint-disable-line @typescript-eslint/no-explicit-any

interface Procedure {
  kind: Kind
  /** the spec section that defines it */
  spec: string
  /** whether it rolls (the vector carries a tape) */
  rolls: boolean
  run: Run
}

/** A synthetic GEO map: [x, y, side 0–3 (N E S W), wall type], doors [x, y, side, passage], event bytes [x, y, value]. */
function geo(input: { walls?: number[][]; doors?: number[][]; events?: number[][] }): GeoMap {
  const raw = new Uint8Array(1026)
  for (const [x, y, d, t] of input.walls ?? []) {
    const i = 2 + (d >> 1) * 256 + y * 16 + x
    raw[i] = d % 2 === 0 ? (raw[i] & 0x0f) | (t << 4) : (raw[i] & 0xf0) | t
  }
  const m = new GeoMap(raw)
  for (const [x, y, d, p] of input.doors ?? []) m.setPassage(x, y, d, p)
  for (const [x, y, v] of input.events ?? []) m.planes[2][y * 16 + x] = v
  return m
}

const rows = (cells: Uint8Array) => Array.from({ length: ROWS }, (_, r) => hex(cells.subarray(r * COLS, r * COLS + COLS)))
const sides = (d: Dice) => (s: number) => d.roll(1, s)

export const PROCEDURES: Record<string, Procedure> = {
  // ---- the dice source itself (host-contracts.md §6)
  'tape.replay': {
    kind: 'S', spec: 'B-model/host-contracts.md#64-the-tape-format', rolls: false,
    run: (_x, i: { draws: Draw[]; requests: [number, number][] }) => {
      let p: TapePlayer
      try { p = new TapePlayer({ format: 'goldbox-dice-tape', version: 1, game: 'por', draws: i.draws }) } catch { return { refused: true } }
      const results: number[] = []
      for (const [n, s] of i.requests) {
        try { results.push(p.roll(n, s)) } catch (err) { return { refused: false, results, divergence: (err as { index: number }).index } }
      }
      return { refused: false, results, divergence: null }
    },
  },
  'dice.random': {
    kind: 'S', spec: 'B-model/host-contracts.md#61-the-rule-d2', rolls: true,
    run: (x, i: { n: number[] }) => ({ values: i.n.map((n) => random(x.dice, n)) }),
  },
  'line.walk': {
    kind: 'S', spec: 'A-games/engine/battlefield.md#line-of-sight-and-range-o-fun_56c1_0422', rolls: false,
    run: (_x, i: { from: [number, number]; to: [number, number] }) => {
      const l = new Line(i.from[0], i.from[1], i.to[0], i.to[1])
      const steps: number[][] = []
      while (l.step()) steps.push([l.x, l.y, l.cost, l.dir])
      return { steps }
    },
  },
  // ---- character procedures (procedures.md §1–§8)
  'hitPoints': {
    kind: 'S', spec: 'B-model/procedures.md#2-hit-points', rolls: true,
    run: (x, i: { tables: [string, number, number[]][]; levels: number[]; classes: number[] }) =>
      ({ sum: rollHitDice(new Tables(syntheticImage(i.tables)), x.dice, record({ levels: i.levels }), i.classes) }),
  },
  'casterLevel': {
    kind: 'S', spec: 'B-model/procedures.md#4-caster-level', rolls: false,
    run: (_x, i: { record: Fields; spellClass: number; fromItem?: boolean }) =>
      ({ level: casterLevel(record(i.record), { cls: i.spellClass } as Spell, i.fromItem ?? false) }),
  },
  'join': {
    kind: 'S', spec: 'B-model/procedures.md#8-joining-the-party', rolls: false,
    run: (_x, i: { party: Fields[]; candidate: Fields }) => {
      const party = i.party.map(record)
      const r = joinRefusal(party, record(i.candidate))
      const named: Record<string, string> = { noEvilScum: msg('noEvilScum'), tooManyRangers: msg('tooManyRangers'), full: 'The party is full.' }
      if (r === null) return { joins: true }
      if (r === '') return { joins: false, refusal: 'silent' }
      const k = Object.keys(named).find((n) => named[n] === r)
      if (k) return { joins: false, refusal: k }
      const pal = [...party].reverse().findIndex((p) => p[F.levels + 3] > 0)
      return { joins: false, refusal: 'toleratesNoEvil', paladin: party.length - 1 - pal }
    },
  },
  'strength.encoding': {
    kind: 'S', spec: 'B-model/procedures.md#123-the-strength-spells', rolls: false,
    run: (_x, i: { values: [number, number][] }) => ({ encoded: i.values.map(([s, p]) => strEnc(s, p)), decoded: i.values.map(([s, p]) => strDec(strEnc(s, p))) }),
  },
  'money.appraise': {
    kind: 'S', spec: 'A-games/engine/town.md#appraise-o-fun_4c2d_19b2', rolls: true,
    run: (x, i: { kinds: (5 | 6)[] }) => ({ values: i.kinds.map((k) => (k === 5 ? appraiseGem(x.dice.roll(1, 100)) : appraiseJewel(x.dice.roll(1, 100), (n) => random(x.dice, n)))) }),
  },
  'derive': {
    kind: 'E', spec: 'B-model/procedures.md#1-spell-slots', rolls: false,
    run: (x, i: { record: Fields }) => { const c = record(i.record); derive(new Tables(exeImage(x)), c); return derived(c) },
  },
  'creation': {
    kind: 'E', spec: 'A-games/engine/chargen-and-progression.md#sequence-o', rolls: true,
    run: (x, i: { race: number; gender: number; cls: number; alignment: number }) => {
      const t = new Tables(exeImage(x))
      const c = begin(t, x.dice, i.race, i.gender, i.cls, i.alignment)
      rollAbilities(t, x.dice, c)
      return character(c)
    },
  },
  'training': {
    kind: 'E', spec: 'B-model/procedures.md#2-hit-points', rolls: true,
    run: (x, i: { record: Fields; classes: number[] }) => {
      const t = new Tables(exeImage(x))
      const c = record(i.record)
      derive(t, c)
      train(t, x.dice, c, i.classes, true)
      return character(c)
    },
  },
  'money.coinValue': {
    kind: 'E', spec: 'A-games/engine/town.md#money-o-overlay-4c2d-fun_4894_28be', rolls: false,
    run: (x, i: { money: number[][] }) => { installNames(exeImage(x)); return { gp: i.money.map(coinValue) } },
  },
  'money.share': {
    kind: 'E', spec: 'A-games/engine/town.md#money-o-overlay-4c2d-fun_4894_28be', rolls: false,
    run: (x, i: { party: Fields[]; pool: number[] }) => {
      const img = exeImage(x)
      installNames(img)
      const t = new ItemTables(new Uint8Array(2 + 16 * 0x80), img)
      const party = i.party.map((f) => ({ c: record(f), items: [] as Item[] }))
      const pool = [...i.pool]
      share(party, pool, t)
      return { money: party.map((m) => Array.from({ length: 7 }, (_, k) => u16(m.c, F.money + 2 * k))), pool }
    },
  },
  // ---- battlefields (procedures.md §15.4)
  'battlefield.terrain': {
    kind: 'S', spec: 'A-games/engine/battlefield.md#terrain-flags-o-fun_34c7_08a4', rolls: false,
    run: (_x, i: { read4AB3: number }) => ({ flags: hex(Uint8Array.from({ length: 256 }, (_, tile) => terrainFlags(tile, i.read4AB3))) }),
  },
  'battlefield.wild': {
    kind: 'S', spec: 'B-model/procedures.md#154-battlefields', rolls: true,
    run: (x, i: { flags: number }) => ({ rows: rows(wildField(i.flags, sides(x.dice)).cells) }),
  },
  'battlefield.map': {
    kind: 'S', spec: 'B-model/procedures.md#154-battlefields', rolls: true,
    run: (x, i: { map: { walls?: number[][]; doors?: number[][]; events?: number[][] }; x: number; y: number; area: number }) =>
      ({ rows: rows(mapBattlefield(geo(i.map), i.x, i.y, sides(x.dice), i.area, R.mapField, null).cells) }),
  },
  'battlefield.furnished': {
    kind: 'E', spec: 'B-model/procedures.md#154-battlefields', rolls: true,
    run: (x, i: { map: { walls?: number[][]; doors?: number[][]; events?: number[][] }; x: number; y: number; area: number }) =>
      ({ rows: rows(mapBattlefield(geo(i.map), i.x, i.y, sides(x.dice), i.area, R.mapField, exeImage(x)).cells) }),
  },
  // ---- battles on a made-up field (procedures.md §15)
  'combat.spell': {
    kind: 'E', spec: 'B-model/procedures.md#15-combat-procedures', rolls: true,
    run: async (x, i: { walls?: [number, number][]; fighters: FighterIn[]; spells: { caster: number; id: number; level: number; aim: [number, number] }[] }) => {
      const a = arena(x, i)
      for (const s of i.spells) {
        a.b.aimed = { x: s.aim[0], y: s.aim[1] }
        await a.b.applySpell(a.b.fighters[s.caster], a.e.spells!.get(s.id)!, s.level, [])
      }
      return battleOutput(a, i.walls)
    },
  },
  'combat.attack': {
    kind: 'E', spec: 'A-games/engine/combat-rules.md#attack-loop-o-fun_3aae_1406attacker-target-from_behind', rolls: true,
    run: async (x, i: { fighters: FighterIn[]; attacks: [number, number][] }) => {
      const a = arena(x, i)
      const made: number[] = []
      for (const [p, q] of i.attacks) made.push(await a.b.attackLoop(a.b.fighters[p], a.b.fighters[q], false, null))
      return { made, ...battleOutput(a) }
    },
  },
  'combat.save': {
    kind: 'E', spec: 'A-games/engine/combat-rules.md#saving-throws-o-fun_5216_0d63char-type-bonus', rolls: true,
    run: (x, i: { fighters: FighterIn[]; saves: [number, number, number][] }) => {
      const a = arena(x, i)
      return { saved: i.saves.map(([f, type, bonus]) => a.b.saveSync(a.b.fighters[f].c, type, bonus)) }
    },
  },
  // ---- the player's files (outputs hashed)
  'treasure.random': {
    kind: 'F', spec: 'B-model/procedures.md#14-random-treasure', rolls: true,
    run: (x, i: { items: number }) => {
      const list: Item[] = []
      randomTreasure(i.items, sides(x.dice), exeImage(x), list)
      const out = new Uint8Array(list.length * 63)
      list.forEach((it, k) => out.set(it.raw, k * 63))
      return out
    },
  },
  'battlefield.area': {
    kind: 'F', spec: 'B-model/procedures.md#154-battlefields', rolls: true,
    run: (x, i: { geo: string; record: number; x: number; y: number; area: number }) => {
      const raw = folderFiles(x.g, x.dir!).record(i.geo, i.record)
      if (!raw) throw new Error(`no ${i.geo} #${i.record}`)
      return mapBattlefield(new GeoMap(raw), i.x, i.y, sides(x.dice), i.area, R.mapField, exeImage(x)).cells
    },
  },
  'headless.run': {
    kind: 'F', spec: 'B-model/host-contracts.md#8-the-headless-harness', rolls: true,
    run: async (x, i: { script: Script }) => {
      const lines: string[] = []
      await runScript({ files: folderFiles(x.g, x.dir!), script: i.script, out: (e: Event) => lines.push(JSON.stringify(e)), dice: x.dice })
      return lines.join('\n') + '\n'
    },
  },
  'sound.driver': {
    kind: 'F', spec: 'A-games/engine/sound.md#3-timer-engine', rolls: false,
    run: (x, i: { effect: number; device: 'pc' | 'tandy'; cut?: number }) => driverTrace(exeImage(x), i.effect, i.device === 'tandy', i.cut),
  },
  'decode.dax': {
    kind: 'F', spec: 'A-games/engine/containers.md#dax-archives', rolls: false,
    run: (x, i: { file: string }) => {
      const b = folderFiles(x.g, x.dir!).get(i.file)
      if (!b) throw new Error(`no ${i.file}`)
      const recs = [...daxRecords(readDax(b)).entries()].sort((p, q) => p[0] - q[0])
      return recs.map(([id, d]) => `${id} ${d.length} ${sha256(d)}`).join('\n') + '\n'
    },
  },
  'decode.image': {
    kind: 'F', spec: 'A-games/engine/containers.md#startexe-microsoft-exepack', rolls: false,
    run: (x, i: { merged: boolean }) => {
      const f = folderFiles(x.g, x.dir!)
      return i.merged ? mergedImage(f.get('START.EXE')!, f.get('GAME.OVR')) : exeImage(x)
    },
  },
  'tables.bytes': {
    kind: 'F', spec: 'B-model/records-and-tables.md#32-the-maps', rolls: false,
    run: (x, i: { table: string; length: number }) => {
      const img = exeImage(x)
      const ref = (T as unknown as Record<string, { at: number }>)[i.table]
      return img.subarray(T.ds + ref.at, T.ds + ref.at + i.length)
    },
  },
}

// ------------------------------------------------------------------ computing a vector

/** Draws → runs of the same request (the manifest's tape encoding). */
export function toRuns(draws: Draw[]): number[][] {
  const out: number[][] = []
  for (const [n, s, r] of draws) {
    const last = out.at(-1)
    if (last && last[0] === n && last[1] === s) last.push(r)
    else out.push([n, s, r])
  }
  return out
}
/** Runs → draws. */
export function fromRuns(runs: number[][]): Draw[] {
  return runs.flatMap(([n, s, ...rs]) => rs.map((r) => [n, s, r] as Draw))
}
/** The reference generator's seed for a case's seed (a small seed's first xorshift values are all tiny). */
const mix = (seed: number) => (Math.imul(seed, 0x9e3779b1) ^ 0x5bd1e995) >>> 0

/** Run one vector's procedure: with `tape`, replaying it (every entry must be used); else recording from `seed`. */
export async function compute(v: { game: string; procedure: string; input: Record<string, unknown> }, folders: Folders, tape?: number[][], seed = 1): Promise<{ output: unknown; tape: Draw[] }> {
  const p = PROCEDURES[v.procedure]
  if (!p) throw new Error(`no procedure ${v.procedure}`)
  const g = profile(v.game)
  const dir = p.kind === 'S' ? null : folders[g.id as keyof Folders]
  if (p.kind !== 'S' && !dir) throw new Error(`${v.procedure} needs the ${g.id} files`)
  const player = tape ? new TapePlayer({ format: 'goldbox-dice-tape', version: 1, game: g.id, draws: fromRuns(tape) }) : null
  const rec = new TapeRecorder(player ?? generator(mix(seed)), g.id)
  try {
    const output = await p.run({ g, dir, dice: rec }, v.input)
    if (player && player.left) throw new Error(`${player.left} tape entries left over`)
    return { output, tape: rec.tape().draws }
  } finally { setGame(POR) }
}

/** The manifest entry for a computed vector. */
export function entry(id: string, game: string, procedure: string, input: Record<string, unknown>, r: { output: unknown; tape: Draw[] }): Vector {
  const p = PROCEDURES[procedure]
  const v: Vector = { id, kind: p.kind, game, procedure, input }
  if (p.rolls) v.tape = toRuns(r.tape)
  if (p.kind === 'F') { const b = canonical(r.output); v.sha256 = sha256(b); v.bytes = b.length }
  else v.output = r.output
  return v
}

/** Whether a computed output matches the manifest's entry. */
export function matches(v: Vector, output: unknown): boolean {
  if (v.kind === 'F') return sha256(canonical(output)) === v.sha256
  return JSON.stringify(output) === JSON.stringify(v.output)
}

export { POR, COAB }
export type { Tape }
