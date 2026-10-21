// A headless player for any Gold Box game (docs/multi-game.md, "Play-testing"): from the game's
// shipped save with its pre-made party it plays by seeded random choices through the engine's own
// movement and the rules code behind every screen the engine hands to the front end (combat with
// the computer on both sides or the player's commands chosen at random, shops, temples, treasure,
// camp, training), saves and loads back now and then, and checks the game's state after each step.
// Not a test file itself: coabplay.test.ts and porplay.test.ts run it for each game. PLAY_WATCH=<byte
// offset> traces every write to that byte of a party record (with the trace on); PLAY_TRACE_FILE=<path>
// writes the trace there as it goes (console output is lost if the worker dies).
import { appendFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { game, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'
import { parseSave } from '../src/data/save'
import { itemsFile } from '../src/data/items'
import { effectsFile } from '../src/data/effects'
import { fight, footprint, type Battle, type CombatUi } from '../src/rules/combat'
import { shop, temple, treasure, type TownUi } from '../src/ui/town'
import { camp, type CampUi } from '../src/ui/camp'
import { Tables } from '../src/rules/chargen'
import { checkTraining, newSpellChoices, train, xpFor } from '../src/rules/training'
import { changeClass, changeClassChoices, offersChangeClass } from '../src/rules/dualclass'
import { readyItem, recalc, unreadyItem } from '../src/rules/equip'
import { WorldHost } from '../src/rules/worldfx'
import { drop, halve, join as joinStacks, trade } from '../src/rules/inventory'
import { castOutside, itemSpells, spendUse, targetKind } from '../src/rules/magic'
import { isScroll, knows, memorise } from '../src/rules/camp'
import { bookSpell } from '../src/games/rules'

export interface PlayOptions {
  game: GameProfile
  files: GameFiles
  seed: number
  steps: number
  /** print every message and choice (COAB_PLAY_TRACE=1) */
  trace?: boolean
  /**
   * start somewhere else: after the shipped start, a debug jump (IMP-025) to a random area of a
   * random block, so that one run reaches what a party fresh from the start would take hours to
   */
  jump?: boolean
  /** start as the app's New Game does with the pre-made party (Engine.newGame), not from the save */
  fresh?: boolean
  /**
   * exceptions that only a jumped start can raise, because the area expects what the areas before it
   * set (the sweep tests allow the same ones); listed with the run's stuck notes, not failed
   */
  jumpArtifacts?: RegExp[]
}

export interface PlayReport {
  seed: number
  steps: number
  /** invariant breaks and exceptions, each with where it happened; the run stops at an exception */
  failures: string[]
  /** scripts that ran out of instructions while still asking (towns waiting on the player) */
  stuck: string[]
  /** how far it got: areas visited, battles, screens */
  stats: { areas: Set<string>; battles: number; won: number; lost: number; fled: number; rounds: number; saves: number; screens: Map<string, number>; menus: number; ended: string }
}

/** Every file the game keeps from a folder, by upper-case name (the importer's view). */
export function loadFiles(g: GameProfile, dir: string): GameFiles {
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

const BATTLE_ROUNDS = 400 // a battle of fifty that keeps hurting someone can take a couple of hundred rounds
const STALEMATE = 30
const STEP_MENUS = 150 // after this many menus in one step the player takes the last choice (usually EXIT or LEAVE)
const nameOf = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + Math.min(c[F.name], 15)))
const BAD_TEXT = /undefined|NaN|\[object|Infinity/

export async function play(o: PlayOptions): Promise<PlayReport> {
  setGame(o.game)
  const files = o.files
  const L = o.game.saves
  let s = (o.seed * 2654435761) >>> 0 || 1
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 }
  const pick = (n: number) => Math.floor(rnd() * n)
  const chance = (p: number) => rnd() < p

  const report: PlayReport = {
    seed: o.seed, steps: 0, failures: [], stuck: [],
    stats: { areas: new Set(), battles: 0, won: 0, lost: 0, fled: 0, rounds: 0, saves: 0, screens: new Map(), menus: 0, ended: '' },
  }
  const recent: string[] = []
  const traceFile = process.env.PLAY_TRACE_FILE
  const out = (t: string) => { if (traceFile) appendFileSync(traceFile, t + '\n'); else console.log(t) }
  const say = (t: string) => {
    recent.push(t)
    if (recent.length > 12) recent.shift()
    if (o.trace) out(t)
  }
  let e!: Engine
  let step = 0
  const where = () => `seed ${o.seed} step ${step} block ${e.block} area ${e.area} at ${e.x},${e.y} facing ${e.facing} party ${e.party().length}`
  const failed = new Set<string>()
  const fail = (what: string) => {
    if (failed.has(what)) return // once per run: the same break is not reported again at every step
    failed.add(what)
    const msg = `${what} (${where()}; last text: ${recent.slice(-4).join(' | ')})`
    report.failures.push(msg)
    if (o.trace) out(`FAIL ${msg}`)
  }
  const screen = (what: string) => report.stats.screens.set(what, (report.stats.screens.get(what) ?? 0) + 1)
  const checkText = (t: string, kind: string) => { if (BAD_TEXT.test(t)) fail(`${kind} shows "${t}"`) }

  // ------------------------------------------------------------- records watched
  // party records are wrapped so that a NaN, undefined or fraction written into them is caught where
  // it happens (a Uint8Array would store 0 or truncate without a word)
  const wrapped = new WeakSet<Uint8Array>()
  const watch = (c: Uint8Array): Uint8Array => {
    if (wrapped.has(c)) return c
    const p = new Proxy(c, {
      get(t, k) { const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v },
      set(t, k, v) {
        if (typeof k === 'string' && /^\d+$/.test(k) && (typeof v !== 'number' || !Number.isInteger(v))) {
          fail(`record of ${nameOf(t)}: byte ${Number(k).toString(16)} set to ${String(v)} at ${caller()}`)
        }
        if (process.env.PLAY_WATCH && Number(k) === Number(process.env.PLAY_WATCH)) say(`  WATCH ${nameOf(t)}[${Number(k).toString(16)}] ${t[Number(k)]} -> ${String(v)} at ${caller()}`)
        return Reflect.set(t, k, v, t)
      },
    })
    wrapped.add(p)
    return p
  }
  const caller = () => (new Error().stack ?? '').split('\n').slice(3, 5).map((l) => l.trim().replace(/^at /, '').replace(/\(.*\/src\//, '(')).join(' < ')
  /** swap the engine's party records for watched ones (after a load, and when someone joins) */
  const watchParty = () => {
    e.nodes.forEach((c, i) => {
      if (wrapped.has(c) || i >= e.party().length) return
      const p = watch(c)
      e.nodes[i] = p
      for (const m of [e.inventory, e.effects] as Map<Uint8Array, unknown>[]) if (m.has(c)) { m.set(p, m.get(c)); m.delete(c) }
      if (e.cur === c) e.cur = p
      if (e.savedCur === c) e.savedCur = p
    })
  }
  const watchEngine = () => {
    const write = e.write.bind(e)
    e.write = (a: number, v: number) => {
      if (typeof v !== 'number' || !Number.isInteger(v)) fail(`ECL write of ${String(v)} to ${a.toString(16)} at ${caller()}`)
      write(a, v)
    }
    watchParty()
  }

  // ------------------------------------------------------------------ choices
  let stepMenus = 0, asked = 0
  /** answers wanted next, each taken when a menu offers it (the heal macro: camp, FIX) */
  let plan: string[] = []
  const choose = (items: string[], prompt = '', quick = false): number => {
    report.stats.menus++
    asked++
    if (!items.length) { fail(`an empty menu${prompt ? ` (${prompt})` : ''}`); return 0 }
    for (const t of items) { checkText(String(t), 'a menu'); if (/^#\d+$/.test(String(t).trim())) fail(`a menu offers "${t}" (a name not found)`) }
    const n = items.length
    const planned = plan.length ? items.indexOf(plan[0]) : -1
    if (planned >= 0) plan.shift()
    // in a battle Quick comes before the menu limit: the last choice there (DONE, then EXIT) goes round
    const k = planned >= 0 ? planned : quick && items.includes('QUICK') ? items.indexOf('QUICK') : ++stepMenus > STEP_MENUS ? n - 1 : sensible(items, prompt)
    say(`  [${prompt}] ${items.join('/')} -> ${items[k]}`)
    return k
  }
  /**
   * A random choice, as a player trying things would make it, except that throwing the party away
   * is rare: dropping members and losing things forever are mostly declined (else every run ends
   * with a party of one).
   */
  const sensible = (items: string[], prompt: string): number => {
    if (/drop from party|gone forever|lose it\?|drop this character/i.test(prompt) && items.includes('NO')) return chance(0.95) ? items.indexOf('NO') : pick(items.length)
    // choices taken less often at this menu are likelier, so that menu trees are explored and a
    // town's menu loop is left in the end
    const seen = (tried.get(items.join('/')) ?? new Map<string, number>())
    tried.set(items.join('/'), seen)
    const weights = items.map((t) => (/^(DROP|REMOVE)$/.test(t) ? 0.05 : 1) / (1 + (seen.get(t) ?? 0)))
    let r = rnd() * weights.reduce((a, b) => a + b, 0)
    let k = items.length - 1
    for (let i = 0; i < items.length; i++) if ((r -= weights[i]) < 0) { k = i; break }
    seen.set(items[k], (seen.get(items[k]) ?? 0) + 1)
    return k
  }
  const tried = new Map<string, Map<string, number>>()
  const number = () => [0, 1, 2, 5, 10, 100, pick(1000), pick(65536)][pick(8)]
  const WORDS = ['', 'YES', 'NO', 'TEST', 'TYRANTHRAXUS', 'DRAGON', 'TILVERTON', 'AZURE', 'BOND', 'SWORD', 'KING', 'PHLAN']

  // ---------------------------------------------------------------- screens
  const townUi = (): TownUi => ({
    get engine() { return e },
    menu: async (items, opts) => choose(items, opts?.prompt),
    print: (t) => { checkText(t, 'a town screen'); say(t) },
    inputNumber: async () => number(),
    view: async () => { await fiddle() },
    refresh: () => {},
  })
  const campUi = (): CampUi => ({
    get engine() { return e },
    menu: async (items, opts) => choose(items, opts?.prompt),
    print: (t) => { checkText(t, 'the camp'); say(t) },
    view: async () => { await fiddle() },
    save: async () => { await roundTrip(false) },
    refresh: () => {},
    stopper: () => { const stop = chance(0.1); return { stopped: () => stop, done: () => {} } },
    pause: async () => {},
    memorizePanel: () => memorizePanel(),
  })
  /**
   * The character sheet's item commands as the sheet runs them (explore.ts): ready or put away, Use
   * (the item's spell outside combat), Trade to another member, Halve, Join, now and then Drop
   */
  const fiddle = async () => {
    const t = e.items, st = e.spells
    const party = e.party()
    if (!t || !party.length) return
    const c = party[pick(party.length)], items = e.itemsOf(c)
    if (!items.length || c[F.status] !== 0) return
    const it = items[pick(items.length)]
    const host = new WorldHost(e, (m) => say(m))
    const r = rnd(), what = `${nameOf(c)}, ${t.name(it)}:`
    if (r < 0.5) {
      const was = it.ready
      const m = was ? await unreadyItem(host, c, items, it, t) : await readyItem(host, c, items, it, t)
      say(`  ${what} ${was ? 'put away' : 'readied'}${m ? ` (${m})` : ''}`)
    } else if (r < 0.7 && st && it.ready) {
      const scroll = isScroll(it, t)
      const ids = itemSpells(it, scroll)
      const s = ids.length ? st.get(ids[pick(ids.length)]) : undefined
      if (!s || s.side === 0) return
      const kind = targetKind(s)
      const targets = kind === 'party' ? party : kind === 'one' ? [party[pick(party.length)]] : [c]
      const out = await castOutside(e, c, s, targets, true)
      spendUse(items, it, scroll, s.id)
      for (const m of out) checkText(m, 'an item used')
      say(`  ${what} used: ${out.join(' ')}`)
    } else if (r < 0.8 && party.length > 1) {
      const to = party.filter((x) => x !== c)[pick(party.length - 1)]
      const m = trade({ c, items }, { c: to, items: e.itemsOf(to) }, it, t)
      say(`  ${what} traded to ${nameOf(to)}${m ? ` (${m})` : ''}`)
    } else if (r < 0.88) { const m = halve(c, items, it, t); say(`  ${what} halved${m ? ` (${m})` : ''}`) }
    else if (r < 0.96) say(`  ${what} joined with ${joinStacks(c, items, it, t)} others`)
    else { const m = drop(c, items, it, t); say(`  ${what} dropped${m ? ` (${m})` : ''}`) }
  }

  let ending = false
  let battle: Battle | null = null
  let battleMenus = 0
  const combatUi: CombatUi = {
    print: (t) => { checkText(t, 'combat'); say(`  ${t} (r${battle?.round})`); roundCap() },
    redraw: () => roundCap(),
    pause: async () => {},
    // the party plays by Quick mostly; now and then a member's own commands are chosen at random
    menu: async (items, opts) => choose(items, opts?.prompt, ++battleMenus > 400 || !chance(0.3)),
    step: async () => (chance(0.3) ? 'end' : pick(8)),
    aim: async (_f, entries) => { const ok = entries.filter((x) => x.ok); return ok.length && !chance(0.1) ? ok[pick(ok.length)] : null },
    confirm: async (p) => { const y = chance(0.3); say(`  [${p}] ${y ? 'YES' : 'NO'} (round ${battle?.round})`); return y },
    view: async () => {},
    sound: () => {},
    pick: async (_p, items) => (items.length && !chance(0.2) ? pick(items.length) : -1),
  }
  /** the battlefield as text (trace): # impassable, P a party member, M a monster */
  const drawField = () => {
    const b = battle!
    for (let y = 0; y < 25; y++) {
      let line = ''
      for (let x = 0; x < 50; x++) {
        const f = b.fighters.find((g) => b.inPlay(g) && footprint(g.size).some(([dx, dy]) => g.x + dx === x && g.y + dy === y))
        line += f ? (f.monster ? 'M' : 'P') : b.passable(x, y, 1) ? '.' : '#'
      }
      out(line)
    }
  }
  const describe = (f: Battle['fighters'][number]) => `${nameOf(f.c)} side ${f.c[F.side]} at ${f.x},${f.y} size ${f.size} status ${f.c[F.status]} in ${f.c[F.inPlay]} hp ${f.c[F.hp]} quick ${f.c[F.quick]} r ${[...f.r].join(',')} fx ${battle!.effectsOf(f.c).map((x) => x.type).join(',')} move ${f.c[F.move]}`
  let capped = false
  /** the standing fighters' HP and status, and the round they last changed: no change for STALEMATE rounds is a stalemate */
  let lastState = '', changedAt = 0
  function roundCap() {
    if (!battle || capped) return
    // those still standing and their HP (positions can see-saw for ever; the dying bleed on their own)
    const b = battle
    const state = b.fighters.map((f) => (b.inPlay(f) ? `${f.c[F.hp]}/${f.c[F.status]}` : '-')).join(' ')
    if (state !== lastState) { if (process.env.PLAY_STATE) say(`  state r${b.round}: ${state}`); lastState = state; changedAt = battle.round }
    else if (battle.round - changedAt >= STALEMATE) {
      // nobody is hurt any more: both sides on computer control cannot reach each other (the
      // original's step AI tries five directions towards the target, no path finding); a player would
      // take control and walk round, which this player cannot, so the battle is called off as won
      report.stuck.push(`stalemate in a battle (${where()})`)
      say('  <stalemate: the battle is called off>')
      if (o.trace) { drawField(); for (const f of battle.fighters) if (battle.inPlay(f)) out(describe(f)) }
      changedAt = battle.round
      battle.debugWin()
      return
    }
    if (battle.round > BATTLE_ROUNDS) {
      capped = true
      const who = battle.fighters.map(describe)
      if (o.trace) drawField()
      throw new Error(`a battle still going after ${BATTLE_ROUNDS} rounds: ${who.join('; ')}`)
    }
  }

  const tables = () => { const img = e.startImage; return img ? new Tables(img) : null }
  /** the party screen of a training hall (explore.ts trainingHall): train someone, or begin */
  const hall = async () => {
    const t = tables()
    if (!t) return
    for (const c of e.party()) {
      if (chance(0.2)) continue
      // now and then a human changes class where the game offers it (CotAB, rules/dualclass.ts)
      if (game().menus.partyChangeClass !== undefined && offersChangeClass(c) && chance(0.15)) {
        const to = changeClassChoices(t, c)
        if (to.length) {
          const k = to[pick(to.length)]
          changeClass(t, c, k, e.itemsOf(c), e.items ?? undefined)
          say(`  ${nameOf(c)} changes class to ${k}`)
          if (e.items) recalc(c, e.itemsOf(c), e.items)
          continue
        }
      }
      const chk = checkTraining(t, c, e.read(0x6da8))
      if (!chk.ok) { checkText(chk.message, 'training'); say(`  ${nameOf(c)}: ${chk.message}`); continue }
      say(`  ${nameOf(c)} trains`)
      if (train(t, e, c, chk.train)) {
        const choices = newSpellChoices(t, c)
        if (choices.length) c[F.known + choices[pick(choices.length)]] = 1
      }
      if (e.items) recalc(c, e.itemsOf(c), e.items)
    }
  }

  const io: Io = {
    print: (t) => { checkText(t, 'the text window'); say(t) },
    menu: async (items, opts) => choose(items, opts?.prompt),
    inputNumber: async () => number(),
    inputText: async () => WORDS[pick(WORDS.length)],
    picture: () => {}, sprite: () => {}, clearView: () => {}, clearTop: () => {}, glyphs: () => {},
    river: async () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {},
    async engine(what) {
      screen(what)
      say(`  <${what}>`)
      if (what === 'combat') {
        report.stats.battles++
        battleMenus = 0
        capped = false
        lastState = ''
        changedAt = 0
        const ready = (c: Uint8Array) => Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k]).filter((v) => v > 0 && v < 0x80).length
        say(`  party: ${e.party().map((c) => `${nameOf(c)} ${c[F.hp]}/${c[F.maxHp]} st${c[F.status]} in${c[F.inPlay]} sp${ready(c)}`).join(', ')}`)
        try {
          // Magic On for the party's Quick members in half the battles (Alt-M), so their spells are cast
          const r = await fight(e, combatUi, (b) => { battle = b; b.magicOn = chance(0.5) })
          report.stats.rounds += battle?.round ?? 0
          const out = e.read(0x6dc7)
          if (!r.survived) report.stats.lost++
          else if (out === 0x81) report.stats.fled++
          else report.stats.won++
          for (const m of r.messages) { checkText(m, 'the battle summary'); say(m) }
          if (r.survived && !e.quit) await treasure(townUi())
        } finally { battle = null }
      } else if (what === 'shop') await shop(townUi())
      else if (what === 'temple') await temple(townUi())
      else if (what === 'treasure') await treasure(townUi())
      else if (what === 'camp') await camp(campUi())
      else if (what === 'party screen') await hall()
      else if (what === 'ending') ending = true
    },
  }

  // ------------------------------------------------------------ save and load
  const stemsOf = () => e.party().map((_, n) => `CHRDATA${n + 1}`) // as the app names them
  const load = (dat: Uint8Array, chars: { sav: Uint8Array; itm?: Uint8Array; spc?: Uint8Array }[], seed: number) => {
    const n = new Engine(files, io, seed)
    n.loadSave(dat, chars.map((c) => c.sav))
    chars.forEach((c, i) => n.attachFiles(i, c.itm, c.spc))
    return n
  }
  /**
   * Save (the game's writer) and load it back: the files must come out the same. With `resume` play
   * goes on from the load, as after Load in the app; a save from the camp menu only saves.
   */
  const roundTrip = async (resume = true) => {
    const party = e.party()
    if (!party.length || e.quit) return
    report.stats.saves++
    const stems = stemsOf()
    const dat = e.toSave(stems)
    if (dat.length !== L.saveSize) fail(`the save is ${dat.length} bytes, not ${L.saveSize}`)
    const chars = party.map((c) => ({ sav: c.slice(), itm: itemsFile(e.itemsOf(c)), spc: effectsFile(e.effectsOf(c)) }))
    const n = load(dat, chars, o.seed * 1000 + step)
    const again = n.toSave(stems)
    // bytes 0x3204-0x3205 are the wall ahead and the square's event, which the loader does not read
    // (the map is loaded again from the saved GEO number, and on the overland map there is none)
    const diff = dat.findIndex((v, i) => again[i] !== v && i !== 0x3204 && i !== 0x3205)
    if (diff >= 0) fail(`a save loaded and saved again differs at byte ${diff.toString(16)}: ${dat[diff]} then ${again[diff]}`)
    n.party().forEach((c, i) => {
      if (c.some((v, k) => chars[i].sav[k] !== v)) fail(`${nameOf(c)}'s record changes in a save and load`)
      if (itemsFile(n.itemsOf(c)).some((v, k) => chars[i].itm[k] !== v)) fail(`${nameOf(c)}'s items change in a save and load`)
      if (effectsFile(n.effectsOf(c)).some((v, k) => chars[i].spc[k] !== v)) fail(`${nameOf(c)}'s effects change in a save and load`)
    })
    if (n.party().length !== party.length) fail(`the party is ${n.party().length} after loading, not ${party.length}`)
    lastSave = { dat, chars }
    if (!resume) return
    n.speed = e.speed
    n.restSteps = e.restSteps
    e = n
    watchEngine()
    say('  <saved and loaded>')
    await e.start()
  }

  // ------------------------------------------------------------- invariants
  const check = () => {
    if (e.quit) return
    const party = e.party()
    if (!party.length) fail('the party is empty but the game goes on')
    if (e.monsters !== 0 || e.monstersLoaded) fail(`${e.monsters} monsters still in the list between steps`)
    if (e.nodes.length !== party.length) fail(`${e.nodes.length} records in the list for a party of ${party.length}`)
    if (!(e.x >= 0 && e.x <= 15 && e.y >= 0 && e.y <= 15) || ![0, 2, 4, 6].includes(e.facing2)) fail(`the party stands at ${e.x},${e.y} facing ${e.facing2}`)
    if (!files.record(`ECL${e.block}`, e.area)) fail(`no script for area ${e.area} of block ${e.block}`)
    if (!e.money.every((v) => Number.isInteger(v) && v >= 0)) fail(`the money pool holds ${e.money.join(',')}`)
    if (new Set(party).size !== party.length) fail('a record is in the party twice')
    if (!party.includes(e.cur)) fail('the current character is not in the party')
    const t = e.items
    for (const c of party) {
      const who = nameOf(c)
      if (c[F.hp] > c[F.maxHp]) fail(`${who} has ${c[F.hp]} of ${c[F.maxHp]} HP`)
      if (c[F.status] > 8) fail(`${who} has status ${c[F.status]}`)
      if (c[F.inPlay] > 1) fail(`${who} has in-play ${c[F.inPlay]}`)
      if (c[F.status] === 0 && !c[F.inPlay]) fail(`${who} is Okay but out of play`)
      if (c[F.status] === 3) fail(`${who} is still Running after the battle`)
      if (c[F.status] >= 4 && c[F.status] <= 6 && c[F.hp] !== 0) fail(`${who} has status ${c[F.status]} with ${c[F.hp]} HP`)
      if (c[F.side] !== 0) fail(`${who} is on side ${c[F.side]}`)
      const items = e.itemsOf(c)
      if (items.length > 16) fail(`${who} carries ${items.length} items`)
      if (t) for (const it of items) if (!t.baseOf(it)) fail(`${who} carries an item of type ${it.type}, not in the item table`)
      if (t && items.filter((x) => x.ready && t.baseOf(x)?.slot === 0).length > 1) fail(`${who} has two weapons readied`)
      if (t) {
        // the record agrees with what is carried: item count and hands worked out again change nothing
        // (THAC0, AC, the load and the like may lag behind a stat an effect gave back or coins a script
        // took, as in the original, which works them out again on the next item change and every
        // combat turn)
        const copy = c.slice()
        recalc(copy, items.map((x) => x.copy()), t)
        for (const k of [F.itemCount, F.hands]) if (copy[k] !== c[k]) fail(`${who}'s record byte ${k.toString(16)} is ${c[k]}, worked out again ${copy[k]}`)
      }
      for (const x of e.effectsOf(c)) {
        if (![x.type, x.power, x.flag].every((v) => Number.isInteger(v) && v >= 0 && v <= 255) || !Number.isInteger(x.duration) || x.duration < 0 || x.duration > 0xffff) {
          fail(`${who} has effect ${JSON.stringify(x)}`)
        }
      }
      if (e.effectsOf(c).length > 40) fail(`${who} has ${e.effectsOf(c).length} effects`)
      // coins as 16-bit counts: a payment gone below 0 would show as about 65 000
      for (let i = 0; i < 7; i++) { const v = c[F.money + 2 * i] | (c[F.money + 2 * i + 1] << 8); if (v > 60000) fail(`${who} has ${v} of coin ${i}`) }
      // memorised spells (pending ones with bit 7) are spells of the game; the spell book holds 0 or 1
      const st = e.spells
      if (st) for (let k = 0; k < F.memorisedCount; k++) { const v = c[F.memorised + k]; if (v && !st.get(v & 0x7f)) fail(`${who} has spell ${v} memorised`) }
      for (let id = 1; id < F.knownCount; id++) if (c[F.known + id] > 1) fail(`${who}'s spell book holds ${c[F.known + id]} for spell ${id}`)
      if (c[F.status] <= 1 && c[F.maxHp] === 0) fail(`${who} stands with 0 maximum HP`)
    }
  }

  // ------------------------------------------------------------------- play
  /** the last save made, where a lost party starts again (a player loads it) */
  let lastSave: { dat: Uint8Array; chars: { sav: Uint8Array; itm?: Uint8Array; spc?: Uint8Array }[] }
  const dat = files.get('SAVGAMA.DAT')
  if (!dat) throw new Error('no SAVGAMA.DAT')
  const stems = parseSave(dat).party
  lastSave = { dat, chars: stems.map((st) => ({ sav: files.get(`${st}.SAV`)!, itm: files.get(`${st}.${L.items}`), spc: files.get(`${st}.${L.effects}`) })) }
  if (o.fresh) {
    e = new Engine(files, io, o.seed)
    e.newGame(lastSave.chars.map((c) => c.sav))
    lastSave.chars.forEach((c, i) => e.attachFiles(i, c.itm, c.spc))
  } else e = load(lastSave.dat, lastSave.chars, o.seed)
  watchEngine()
  /**
   * Memorize as the camp's Memorize panel does (IMP-043: memorise() into free slots, spells from the
   * book at random); `prepare` camps, memorizes and rests for as long as learning them takes
   */
  const memorizePanel = async () => {
    const st = e.spells
    if (!st) return
    for (const c of e.party()) {
      if (c[F.status] !== 0) continue
      const book = st.spells.filter((sp) => bookSpell(sp) && knows(c, sp.id))
      for (let n = 0; n < 30 && book.length; n++) memorise(c, book[pick(book.length)], st)
    }
  }
  const prepare = async () => {
    plan = ['MAGIC', 'MEMORIZE', 'REST', 'REST', 'EXIT', 'EXIT']
    await e.command('e')
    plan = []
  }
  /** someone standing has less than half their HP, or someone is down */
  const hurt = () => e.party().some((c) => (c[F.status] === 0 && c[F.hp] * 2 < c[F.maxHp]) || c[F.status] === 4 || c[F.status] === 5)
  /** squares stepped on, so that the walk goes where it has not been (towards exits and new areas) */
  const visits = new Map<string, number>()
  const key = (x: number, y: number) => `${e.block}/${e.area}/${x & 15},${y & 15}`
  const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  /** the command towards the least visited open neighbour: forward if facing it, else the turn */
  const explore = (): string => {
    const g = e.geo
    visits.set(key(e.x, e.y), (visits.get(key(e.x, e.y)) ?? 0) + 1)
    if (!g) return 'f'
    const open = [0, 1, 2, 3].filter((d) => g.passage(e.x, e.y, d) !== 0)
    if (!open.length) return 'f'
    const score = (d: number) => (visits.get(key(e.x + STEPS[d][0], e.y + STEPS[d][1])) ?? 0) * 4 + (d === e.facing ? 0 : 1) + rnd() * 3
    const d = open.reduce((a, b) => (score(b) < score(a) ? b : a))
    const turn = (d - e.facing + 4) & 3
    // a try counts as a visit of where it leads, so a door that turns the party back is soon left alone
    if (turn === 0) { const k = key(e.x + STEPS[d][0], e.y + STEPS[d][1]); visits.set(k, (visits.get(k) ?? 0) + 1) }
    return turn === 0 ? 'f' : turn === 1 ? 'r' : turn === 3 ? 'l' : 'b'
  }
  /** one action; false when the run cannot go on */
  const act = async (what: string, f: () => Promise<void>): Promise<boolean> => {
    stepMenus = 0
    asked = 0
    say(`> ${what}  (${where()})`)
    try {
      await f()
    } catch (err) {
      const msg = (err as Error).message
      if (o.jump && o.jumpArtifacts?.some((r) => r.test(msg))) {
        report.stuck.push(`after the jump: ${msg} (${where()})`)
        return false
      }
      if (/^runaway script/.test(msg) && asked > 0) {
        // still asking after the last choice every time: a town or travel menu waiting for the player
        report.stuck.push(`${msg} (${where()})`)
        return true
      }
      fail(`${/^runaway script/.test(msg) ? 'a script loops without asking anything' : 'exception'}: ${msg}${(err as Error).stack?.split('\n').slice(1, 3).join(' ') ?? ''}`)
      return false
    }
    return true
  }
  let ok = await act('start', () => e.start())
  if (ok && o.fresh && !e.quit) await roundTrip(false) // the save to come back to: the new game's start
  if (ok && o.jump) {
    // a random area with a script, at a random square (the debug jump, IMP-025)
    const areas: [number, number][] = []
    for (let b = 1; b <= 9; b++) for (const { id } of files.dax(`ECL${b}`)?.entries ?? []) areas.push([b, id])
    const [b, a] = areas[pick(areas.length)]
    // a party met mid-game has earned a level in each class and the fee (so a training hall trains)
    const t = tables()
    if (t) for (const c of e.party()) {
      let xp = 0
      for (let k = 0; k < 8; k++) if (c[F.levels + k] > 0) { const need = xpFor(t, k, c[F.levels + k] + 1); if (need !== 0xffffffff) xp = Math.max(xp, need) }
      for (let i = 0; i < 4; i++) c[F.xp + i] = (xp >>> (8 * i)) & 0xff
      c[F.money + 8] = 0xe8; c[F.money + 9] = 0x03 // 1000 platinum
    }
    ok = await act(`jump to block ${b} area ${a}`, () => e.jump(b, a, pick(16), pick(16), pick(4)))
    if (ok && !e.quit) await roundTrip(false) // the save to come back to is here, not at the start
  }
  if (o.trace && e.geo) {
    // the area as passages: # wall, D locked door, L locked door that cannot be picked; event bytes in hex
    const g = e.geo, ch = '# DL'
    for (let y = 0; y < 16; y++) {
      out(Array.from({ length: 16 }, (_, x) => '+' + ch[g.passage(x, y, 0)].repeat(2)).join('') + '+')
      out(Array.from({ length: 16 }, (_, x) => ch[g.passage(x, y, 3)] + (g.event(x, y) ? g.event(x, y).toString(16).padStart(2, '0') : '  ')).join('') + ch[g.passage(15, y, 1)])
    }
  }
  let reloads = 0, healedAt = -100
  for (step = 1; ok && step <= o.steps; step++) {
    if (e.quit) {
      // the party was lost: load the last save, as a player would (a few times per run)
      if (ending || ++reloads > 8) break
      say('  <party lost: the last save is loaded>')
      e = load(lastSave.dat, lastSave.chars, o.seed * 7919 + step)
      watchEngine()
      ok = await act('load after a loss', () => e.start())
      if (!ok) break
    }
    report.steps = step
    watchParty()
    report.stats.areas.add(`${e.block}/${e.area}`)
    const r = rnd()
    if (r < 0.02) ok = await act('save and load', () => roundTrip())
    else if (r < 0.04) ok = await act('fiddle with items', fiddle)
    else if (r < 0.05) ok = await act('memorize and rest', prepare)
    else if (r < 0.06) {
      const party = e.party()
      e.cur = party[pick(party.length)]
      continue
    } else if (hurt() && step - healedAt > 20) {
      // a player whose party is hurt camps and lets the clerics heal it (FIX), then rests a day
      healedAt = step
      plan = ['FIX', 'REST', 'DAYS +', 'REST', 'EXIT']
      ok = await act('camp to heal', () => e.command('e'))
      plan = []
    } else if (e.overland) ok = await act('travel', () => e.travel(pick(4)))
    else {
      const c = r < 0.8 ? explore() : r < 0.86 ? 'lrbf'[pick(4)] : r < 0.88 ? 's' : r < 0.94 ? 'L' : 'e'
      ok = await act(`command ${c}`, () => e.command(c))
    }
    if (ok) check()
  }
  if (o.trace) out(`squares visited: ${visits.size}`)
  report.stats.ended = ending ? 'the ending was reached' : e.quit ? `the party was lost (${reloads} reloads)` : !ok ? 'stopped by an exception' : `step limit (${reloads} reloads)`
  return report
}
