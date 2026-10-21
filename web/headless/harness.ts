// The headless harness (spec/B-model/host-contracts.md §8): a script host and a combat host that answer
// from a list, a dice source (a tape replayed, or the reference generator, recorded as it goes), and
// the transcript of what the rules asked for, one JSON event per line. Used by headless/run.ts (the
// command line) and web/test/headless.test.ts; nothing of the browser is involved.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { byId, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { parseSave } from '../src/data/save'
import { fight, type Battle, type CombatUi } from '../src/rules/combat'
import { Divergence, TapePlayer, TapeRecorder, generator, type Dice, type Tape } from '../src/rules/dice'
import { renderFrame, type ShownSprite, type ViewFrame } from './frame'

/** One answer: a menu index, a number, a text, a step (0–7, `end`, `undo`), an aim (index or null), a yes/no. */
export type Answer = number | string | boolean | null

/** What a run does (host-contracts.md §8.1). */
export interface Script {
  /** the game profile's id: `por`, `coab` */
  game: string
  /** the save slot letter (`SAVGAM<x>.DAT` and its party files in the game folder); default A */
  save?: string
  /** a debug jump before play starts (IMP-025): block, area, x, y, facing (0–3) */
  jump?: [number, number, number, number, number?]
  /** commands after play starts, in order (§8.1) */
  commands?: string[]
  /** the answers, taken in order by every question the hosts are asked */
  answers?: Answer[]
}

/** One transcript event (host-contracts.md §8.2): `event` names it, the other members are its fields. */
export type Event = { event: string } & Record<string, unknown>

/** The run ran out of answers: it ends there (`end`, reason `answers`, with the question left unanswered). */
class OutOfAnswers extends Error {
  readonly waiting: Record<string, unknown>
  constructor(waiting: Record<string, unknown>) { super('out of answers'); this.waiting = waiting }
}

const nameOf = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + Math.min(c[F.name], 15)))

/** Every file the game keeps from a folder, by upper-case name (the importer's view). */
export function loadFolder(g: GameProfile, dir: string): GameFiles {
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p)))
    }
  }
  walk(dir)
  return new GameFiles(m, g)
}

export interface RunOptions {
  files: GameFiles
  script: Script
  /** the dice source: a tape to replay, else the reference generator with this seed (default 1) */
  tape?: Tape
  seed?: number
  /** each transcript event as it happens */
  out: (e: Event) => void
  /** render the drawn view at the end of the run (V9): `RunResult.frame` and a `frame` event */
  frame?: boolean
}

export interface RunResult {
  /** why the run ended: `script` (commands done), `answers`, `quit` (the game ended), `divergence`, `error` */
  end: string
  /** the dice tape of the run (the replayed one's entries used, or what the generator answered) */
  tape: Tape
  /** the drawn view's frame at the end (with `frame`), null where the party has no 3D view */
  frame?: ViewFrame | null
}

/** Run a script headless (host-contracts.md §8). */
export async function runScript(o: RunOptions): Promise<RunResult> {
  const g = byId(o.script.game)
  if (!g) throw new Error(`no game "${o.script.game}"`)
  setGame(g)
  const files = o.files
  const answers = [...(o.script.answers ?? [])]
  const next = (waiting: Record<string, unknown>): Answer => {
    if (!answers.length) throw new OutOfAnswers(waiting)
    return answers.shift()!
  }
  /** a menu answer: the index, or the item's text (trimmed); `allowExit`: −1 too (a spell or item list) */
  const index = (items: string[], prompt: string, allowExit = false): number => {
    const a = next({ kind: 'menu', items, prompt })
    if (typeof a === 'string') {
      const k = items.findIndex((t) => t.trim() === a.trim())
      if (k < 0) throw new Error(`answer "${a}" is not one of ${items.map((t) => t.trim()).join(', ')}`)
      return k
    }
    if (typeof a !== 'number' || !Number.isInteger(a) || a >= items.length || a < (allowExit ? -1 : 0)) throw new Error(`answer ${JSON.stringify(a)} is not one of ${items.length} choices`)
    return a
  }
  const out = o.out
  const source: Dice = o.tape ? new TapePlayer(o.tape) : generator(o.seed ?? 1)
  const recorder = new TapeRecorder(source, g.id)

  let battle: Battle | null = null
  const combatUi: CombatUi = {
    print: (text) => out({ event: 'combat', text, round: battle?.round ?? 0, current: battle?.current() ? nameOf(battle.current()!) : null }),
    redraw: () => {},
    pause: async () => {},
    menu: async (items, opts) => { const answer = index(items, opts?.prompt ?? ''); out({ event: 'menu', items, prompt: opts?.prompt ?? '', answer }); return answer },
    step: async (_f, left) => {
      const a = next({ kind: 'step', left })
      if (!(a === 'end' || a === 'undo' || (typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < 8))) throw new Error(`answer ${JSON.stringify(a)} is not a step`)
      out({ event: 'input', kind: 'step', left, answer: a })
      return a
    },
    aim: async (_f, entries, prompt) => {
      const a = next({ kind: 'aim', prompt })
      if (a !== null && (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a >= entries.length)) throw new Error(`answer ${JSON.stringify(a)} is not one of ${entries.length} targets`)
      out({ event: 'input', kind: 'aim', prompt, targets: entries.map((x) => ({ name: x.f ? nameOf(x.f.c) : null, x: x.x, y: x.y, ok: x.ok })), answer: a })
      return a === null ? null : entries[a]
    },
    confirm: async (prompt) => {
      const a = next({ kind: 'confirm', prompt })
      if (typeof a !== 'boolean') throw new Error(`answer ${JSON.stringify(a)} is not yes or no`)
      out({ event: 'input', kind: 'confirm', prompt, answer: a })
      return a
    },
    view: async () => {},
    sound: (n) => out({ event: 'sound', n }),
    pick: async (prompt, items) => { const answer = index(items, prompt, true); out({ event: 'menu', items, prompt, answer }); return answer },
  }

  let e!: Engine
  /** the encounter sprite over the view, until the view is cleared or a picture replaces it */
  let shown: ShownSprite | null = null
  const io: Io = {
    print: (text, clear) => out({ event: 'text', text, clear }),
    menu: async (items, opts) => { const answer = index(items, opts?.prompt ?? ''); out({ event: 'menu', items, prompt: opts?.prompt ?? '', answer }); return answer },
    inputNumber: async () => {
      const a = next({ kind: 'number' })
      if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a > 0xffff) throw new Error(`answer ${JSON.stringify(a)} is not a number 0–65535`)
      out({ event: 'input', kind: 'number', answer: a })
      return a
    },
    inputText: async () => {
      const a = next({ kind: 'text' })
      if (typeof a !== 'string') throw new Error(`answer ${JSON.stringify(a)} is not a text`)
      out({ event: 'input', kind: 'text', answer: a })
      return a
    },
    picture: (picture) => { shown = null; out({ event: 'picture', picture }) },
    sprite: (sprite, picture, distance) => { shown = { sprite, picture, distance }; out({ event: 'sprite', sprite, picture, distance }) },
    clearView: () => { shown = null },
    refresh: async () => {},
    sound: (n) => out({ event: 'sound', n }),
    pause: async () => {},
    async engine(what, info) {
      out({ event: 'screen', what, info: info ?? null })
      if (what !== 'combat') return // every other screen is handed over and comes back at once (§8.1)
      try {
        const r = await fight(e, combatUi, (b) => { battle = b })
        out({ event: 'combat', outcome: e.read(0x6dc7), survived: r.survived, round: battle?.round ?? 0 })
      } finally { battle = null }
    },
  }

  const area = () => out({ event: 'area', block: e.block, area: e.area, x: e.x, y: e.y, facing2: e.facing2 })
  let end = 'script'
  let waiting: Record<string, unknown> | undefined
  try {
    const slot = (o.script.save ?? 'A').toUpperCase()
    const dat = files.get(`SAVGAM${slot}.DAT`)
    if (!dat) throw new Error(`no SAVGAM${slot}.DAT in the game folder`)
    const L = g.saves
    const stems = parseSave(dat).party
    e = new Engine(files, io, recorder)
    e.loadSave(dat, stems.map((s) => {
      const sav = files.get(`${s}.SAV`)
      if (!sav) throw new Error(`no ${s}.SAV for the save's party`)
      return sav
    }))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.${L.items}`), files.get(`${s}.${L.effects}`)))
    e.trace = { store: (address, value) => out({ event: 'write', address, value }), entered: area }
    await e.start()
    area()
    if (o.script.jump) {
      const [block, ar, x, y, facing] = o.script.jump
      await e.jump(block, ar, x, y, facing ?? e.facing)
    }
    for (const c of o.script.commands ?? []) {
      if (e.quit) break
      out({ event: 'command', command: c })
      await command(e, c)
    }
    if (e.quit) end = 'quit'
  } catch (err) {
    if (err instanceof OutOfAnswers) { end = 'answers'; waiting = err.waiting }
    else if (err instanceof Divergence) { end = 'divergence'; out({ event: 'end', reason: end, message: err.message }); return { end, tape: recorder.tape() } }
    else { end = 'error'; out({ event: 'end', reason: end, message: (err as Error).message }); return { end, tape: recorder.tape() } }
  }
  let frame: ViewFrame | null | undefined
  if (o.frame && e) {
    frame = renderFrame(e, files, shown)
    out({ event: 'frame', block: e.block, area: e.area, x: e.x, y: e.y, facing2: e.facing2, sprite: shown, sha256: frame?.sha256 ?? null })
  }
  out(waiting ? { event: 'end', reason: end, waiting } : { event: 'end', reason: end })
  return { end, tape: recorder.tape(), frame }
}

/**
 * One script command (§8.1): an exploration command (`f` `l` `r` `b` `s` `L` `e`), `travel <dir>`
 * (the tile wilderness), `monsters <id> <count> <picture>` (as LOAD_MONSTER), `combat` (the battle
 * with the monsters loaded, handed over as COMBAT does).
 */
async function command(e: Engine, c: string) {
  const [verb, ...args] = c.trim().split(/\s+/)
  const n = args.map(Number)
  if (/^[flrbsLe]$/.test(verb)) await e.command(verb)
  else if (verb === 'travel') await e.travel(n[0])
  else if (verb === 'monsters') e.addMonsters(n[0], n[1] ?? 1, n[2] ?? 0)
  else if (verb === 'combat') {
    if (!e.monsters) throw new Error('combat: no monsters loaded')
    await e.combatNow()
  } else throw new Error(`unknown command "${c}"`)
}
