// Camp screens (spec/A-games/engine/camp-and-time.md): Encamp menu, Magic, Rest, Alter.
import { R, slots, bookSpell, casterClasses } from '../games/rules'
import { game } from '../games/profile'
import { F } from '../games/fields'
import { spellText } from '../rules/spelltext'
import type { Engine } from '../vm/engine'
import { parseCharacter } from '../data/character'
import type { Spell } from '../data/spells'
import { clearPending, freeSlots, knows, memorise, memorised, preparation, readableScrolls, restStep, startRest, isScroll, fix as fixParty } from '../rules/camp'
import { castOutside, targetKind, forget, mayCast } from '../rules/magic'
import { msg, menu, word, ask, type StringId, type MenuOpts, type MenuWord } from '../games/strings'
import { text } from '../data/gametext'

export interface CampUi {
  engine: Engine
  menu(items: string[], opts?: MenuOpts): Promise<number>
  print(text: string, clear?: boolean): void
  view(): Promise<void>
  save(): Promise<void>
  refresh(): void
  /** show a Stop button while a rest runs; `stopped()` turns true once it is pressed */
  stopper(): { stopped(): boolean; done(): void }
  pause(ms: number): Promise<void>
  /** Memorize as one panel (IMP-043); without it the original's lists */
  memorizePanel?(): Promise<void>
  /** the combat icon editor (FUN_417f_382d, IMP-017) on a character; true when the new icon is kept */
  iconEditor?(c: Uint8Array): Promise<boolean>
}

const nameOf = (c: Uint8Array) => parseCharacter(c).name
/** the Yes/No question (PoR FUN_53aa_10d1, CotAB 0x52A54): the game's "Yes No" */
export const yes = async (ui: Pick<CampUi, 'menu'>, prompt: string) => (await ask((l, o) => ui.menu(l, o), menu('yesNo'), { prompt })) === 'Y'
/**
 * A vertical list (PoR FUN_53aa_0d9a, CotAB 0x5270F) of `names` and the list's Exit, the game's word:
 * the index chosen, `names.length` for Exit.
 */
export async function list(ui: Pick<CampUi, 'menu'>, names: string[], opts: MenuOpts = {}): Promise<number> {
  const x = word('listExit', 'E')
  return ui.menu([...names, x.text.toUpperCase()], { vertical: true, ...opts, keys: [...names.map(() => ''), x.key] })
}

/** the Display window's fixed names (PoR FUN_3f81_0fbc, CotAB 0x30DDA): the game's string for an effect type */
const effectName = (type: number) => { const a = game().effects.names[type]; return a === undefined ? '' : text(a) }
const SPELL_NAMED = new Set([1, 2, 5, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21, 22, 23, 24, 25, 28, 29, 32, 33, 34, 36, 37, 38, 39, 41, 42, 45, 46, 49, 51, 52, 53])

/**
 * The camp screen (FUN_3f81_1e6f). Sets engine.campInterrupted when a rest was interrupted. Resolves
 * true when the player answered Yes to "Quit TO DOS" after Save (the game is to end there).
 */
export async function camp(ui: CampUi): Promise<boolean> {
  const e = ui.engine
  if (!e.items || !e.spells) { ui.print(`The camp needs START.EXE and ITEMS: re-import the ${game().folder} folder.`, false); return false }
  let quit = false
  const state = { heal: 0 }
  for (const c of e.party()) clearPending(c, e.itemsOf(c), e.items)
  ui.print(msg('makesCamp'), true)
  // the game's camp menu; Pool of Radiance has no Fix, the port adds the later games' (IMP-048)
  const words: MenuWord[] = [...menu('camp')]
  if (!words.some((w) => w.key === 'F')) words.splice(Math.max(0, words.length - 1), 0, { text: 'Fix', key: 'F' })
  for (;;) {
    const o = await ask((l, op) => ui.menu(l, op), words, { prompt: msg('camp').trimEnd() })
    if (o === 'S') {
      // Save, then "Quit TO DOS" Yes/No, asked even after a cancelled save (PoR FUN_3f81_1e6f at
      // 0x31766, CotAB 0x322D0); Yes ends the game
      await ui.save()
      if (await yes(ui, msg('quitToDos').trimEnd())) { quit = true; break }
    } else if (o === 'V') await ui.view()
    else if (o === 'M') { if (await magic(ui, state)) break }
    else if (o === 'R') { if (await rest(ui, state)) break }
    else if (o === 'A') await alter(ui)
    else if (o === 'F') { if (await fix(ui, state)) break }
    else break
  }
  for (const c of e.party()) clearPending(c, e.itemsOf(c), e.items)
  ui.refresh()
  return quit
}

/** Magic menu; returns true when a rest was interrupted. */
async function magic(ui: CampUi, state: { heal: number }): Promise<boolean> {
  for (;;) {
    const o = await ask((l, op) => ui.menu(l, op), menu('magic'), { prompt: 'Magic:' })
    if (o === 'C') await cast(ui)
    else if (o === 'M') await memorize(ui)
    else if (o === 'S') await scribe(ui)
    else if (o === 'D') display(ui)
    else if (o === 'R') { if (await rest(ui, state)) return true }
    else return false
  }
}

/** the spell-activity check (FUN_3f81_036c): `what` is the activity's line */
function activity(ui: CampUi, what: StringId & ('castAny' | 'memorizeAny' | 'scribeAny')): boolean {
  const e = ui.engine, c = e.cur
  if (what === 'castAny' && e.read(0x49e5) !== 0) { ui.print(msg('noCastHere'), false); return false }
  if (c[F.status] === 1 || ![0, 1].includes(c[F.status])) { ui.print(`${nameOf(c)} ${msg('noCondition')}${msg(what)}`, false); return false }
  return true
}

/** Cast (FUN_3f81_04a1), also the explore-mode Cast command. */
export async function cast(ui: CampUi) {
  const e = ui.engine, st = e.spells!
  if (!activity(ui, 'castAny')) return
  for (;;) {
    const c = e.cur
    const ready = memorised(c).filter((v) => v > 0 && v < 0x80)
    if (!ready.length) { ui.print(`${nameOf(c)} ${msg('noSpells')}`, false); return }
    const spells = ready.map((id) => st.get(id)!).filter((s) => s && mayCast(c, s, false, true)) // CotAB 0x43F8E (SotSB's cast-list flag)
    const i = await list(ui, spells.map((s) => s.name.toUpperCase()), { prompt: 'Spells in Memory:', notes: spells.map(spellText) })
    if (i >= spells.length) return
    const s = spells[i]
    if (s.side === 0) {
      ui.print(`${s.name} ${msg('combatOnlySpell')}`, false)
      if (await yes(ui, msg('loseIt').trimEnd())) forget(c, s.id)
      continue
    }
    const kind = targetKind(s)
    let targets = [c]
    if (kind === 'party') targets = e.party()
    else if (kind === 'one') {
      const party = e.party()
      const k = await list(ui, party.map((m) => nameOf(m).toUpperCase()), { prompt: `Cast ${s.name} on:`, vertical: false })
      if (k >= party.length) continue
      targets = [party[k]]
    }
    for (const m of await castOutside(e, c, s, targets)) ui.print(m, false)
    ui.refresh()
  }
}

/** Memorize (FUN_3f81_090a). */
async function memorize(ui: CampUi) {
  const e = ui.engine, st = e.spells!
  if (!activity(ui, 'memorizeAny')) return
  if (ui.memorizePanel) return ui.memorizePanel()
  const c = e.cur
  const pending = () => memorised(c).filter((v) => v >= 0x80).map((v) => st.get(v)!.name)
  if (pending().length) {
    ui.print(`Spells to be memorized: ${pending().join(', ')}`, true)
    if (await yes(ui, msg('memorizeThese').trimEnd())) return
    for (let k = 0; k < F.memorisedCount; k++) if (c[F.memorised + k] >= 0x80) c[F.memorised + k] = 0
  }
  let picked = false
  for (;;) {
    const levels = Array.from({ length: R.spells.levels }, (_, i) => i + 1)
    const row = (cls: number) => levels.map((l) => (slots(c, cls, l) ? String(freeSlots(c, cls, l, st)) : '-')).join(' ')
    const has = casterClasses().filter((k) => levels.some((l) => slots(c, k.cls, l)))
    if (!has.length) { ui.print(`${nameOf(c)} ${msg('cannotMemorize')}`, false); return }
    ui.print(`${nameOf(c)} can memorize:${has.map((k) => `  ${k.name} Spells: ${row(k.cls)}`).join('')}`, true)
    const book: Spell[] = st.spells.filter((s) => bookSpell(s) && knows(c, s.id) && mayCast(c, s))
    const short = (cls: number) => casterClasses().find((k) => k.cls === cls)?.short ?? ''
    const i = await list(ui, book.map((s) => `${s.name.toUpperCase()} (${short(s.cls)} ${s.level})`), { prompt: 'Spells in Spell Book:', notes: book.map(spellText) })
    if (i >= book.length) break
    if (memorise(c, book[i], st)) picked = true
  }
  if (picked && pending().length) {
    ui.print(`Spells to be memorized: ${pending().join(', ')}`, true)
    if (!await yes(ui, msg('memorizeThese2').trimEnd())) for (let k = 0; k < F.memorisedCount; k++) if (c[F.memorised + k] >= 0x80) c[F.memorised + k] = 0
  }
}

/** Scribe (FUN_3f81_0b5b): mark scroll spells to be copied while resting. */
async function scribe(ui: CampUi) {
  const e = ui.engine, st = e.spells!, t = e.items!
  if (!activity(ui, 'scribeAny')) return
  const c = e.cur, items = e.itemsOf(c)
  const marked = () => items.filter((it) => isScroll(it, t)).flatMap((it) => it.props.filter((p) => p > 0x80).map((p) => st.get(p)!.name))
  if (marked().length) {
    ui.print(`Spells to be scribed: ${marked().join(', ')}`, true)
    if (await yes(ui, msg('scribeThese').trimEnd())) return
    for (const it of items) if (isScroll(it, t)) for (let j = 0; j < 3; j++) it.raw[0x3c + j] &= 0x7f
  }
  for (;;) {
    const scrolls = readableScrolls(c, items, e.effectsOf(c), t)
    const entries = scrolls.flatMap((it) => it.props.map((p, j) => ({ it, j, id: p & 0x7f, mark: p > 0x80 })).filter((x) => x.id > 0))
    if (!entries.length) { ui.print(`${nameOf(c)} ${msg('noScrolls')}`, false); break }
    const i = await list(ui, entries.map((x) => `${st.get(x.id)!.name.toUpperCase()}${x.mark ? ' (MARKED)' : ''}`), { prompt: 'Spells on Scrolls:' })
    if (i >= entries.length) break
    const x = entries[i], s = st.get(x.id)!
    if (knows(c, x.id)) ui.print(msg('knowSpell'), false)
    else if (entries.some((y) => y.mark && y.id === x.id)) ui.print(msg('scribingSpell'), false)
    else if (!slots(c, s.cls, s.level)) ui.print(msg('cannotScribe'), false)
    else x.it.raw[0x3c + x.j] |= 0x80
  }
  if (marked().length) {
    ui.print(`Spells to be scribed: ${marked().join(', ')}`, true)
    if (!await yes(ui, msg('scribeThese2').trimEnd())) for (const it of items) if (isScroll(it, t)) for (let j = 0; j < 3; j++) it.raw[0x3c + j] &= 0x7f
  }
}

/** Effect names as the Display window gives them (FUN_3f81_0fbc); also used by the roster cards. */
export function effectNames(e: Engine, c: Uint8Array): string[] {
  const st = e.spells
  if (!st) return []
  return [...new Set(e.effectsOf(c).map((f) => {
    if (SPELL_NAMED.has(f.type)) return st.spells.find((s) => s.effect === f.type)?.name ?? ''
    return effectName(f.type)
  }).filter(Boolean))]
}

/** Display (FUN_3f81_0fbc): the current character's effects. */
function display(ui: CampUi) {
  const e = ui.engine, st = e.spells!
  const fx = e.effectsOf(e.cur)
  const names = fx.map((f) => {
    if (SPELL_NAMED.has(f.type)) {
      return st.spells.find((s) => s.effect === f.type)?.name ?? `${msg('funky')}${f.type}`
    }
    return effectName(f.type)
  }).filter(Boolean)
  ui.print(`Display: ${names.length ? names.join(', ') : msg('noSpellEffects').trim()}`, true)
}

/** Rest (FUN_3f81_077a, FUN_4b46_0721, FUN_4b46_0c9a). Returns true when interrupted. */
export async function rest(ui: CampUi, state: { heal: number }): Promise<boolean> {
  const e = ui.engine, t = e.items!, st = e.spells!
  let minutes = 0
  for (const c of e.party()) minutes = Math.max(minutes, preparation(c, e.itemsOf(c), t, st))
  // the duration prompt (PoR FUN_4b46_0721, CotAB 0x415F1): the game's seven words in its order, start,
  // days, hours, minutes, more, less, exit (PoR "… daYs … Inc Dec …", CotAB "… Days … Add Subtract …");
  // the selected field, Mins at first, changes by a step (5 minutes, an hour, a day); days capped at 99
  const w = menu('rest')
  let field = 3
  for (;;) {
    const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60
    const two = (v: number, f: number) => (f === field ? `[${String(v).padStart(2, '0')}]` : String(v).padStart(2, '0'))
    const label = `${msg('restTime')} ${two(d, 1)}:${two(h, 2)}:${two(m, 3)}`
    const o = await ui.menu(w.map((x) => x.text.toUpperCase()), { prompt: label, keys: w.map((x) => x.key) })
    if (w.length !== 7 || o === 6) return false
    if (o === 0) break
    if (o <= 3) { field = o; continue }
    const delta = (o === 4 ? 1 : -1) * [0, 1440, 60, 5][field]
    minutes = Math.max(0, Math.min(99 * 1440 + 1439, minutes + delta))
  }
  if (minutes <= 0) return false
  const r = startRest(e, minutes)
  const stop = ui.stopper()
  let interrupted = false
  try {
    let n = 0
    while (r.minutes > 0) {
      if (stop.stopped()) break
      const res = await restStep(e, r, state)
      for (const msg of res.messages) ui.print(msg, false)
      if (res.messages.length) ui.refresh()
      if (res.interrupted) { interrupted = true; break }
      if (++n % 12 === 0) { ui.refresh(); await ui.pause(25) }
    }
  } finally {
    stop.done()
  }
  ui.refresh()
  if (interrupted) e.campInterrupted = true
  return interrupted
}

/**
 * Fix (CotAB 0x320D8; spec/A-games/coab/camp.md §1; Pool of Radiance has none, the port offers CotAB's,
 * IMP-048): rules/camp.ts `fix`. Returns true when its rest was interrupted.
 */
async function fix(ui: CampUi, state: { heal: number }): Promise<boolean> {
  const e = ui.engine
  const r = await fixParty(e, state)
  for (const m of r.messages) ui.print(m, false)
  ui.refresh()
  if (r.interrupted) e.campInterrupted = true
  return r.interrupted
}

/** Alter (FUN_3f81_1c59, CotAB 0x31AD0): Order, Drop, Speed, Icon, Pics (SotSB: Level for Pics). */
async function alter(ui: CampUi) {
  const e = ui.engine
  for (;;) {
    const o = await ask((l, op) => ui.menu(l, op), menu('alter'), { prompt: msg('alter').trimEnd() })
    if (o === 'O') {
      // Order (FUN_3f81_1780, CotAB 0x31604): the game's "Select Exit", then "Place Exit"; the port
      // picks from a list and moves the one picked a step at a time (UP, DOWN: the port's words)
      const party = e.party(), sel = word('orderSelect', 'S'), ex = word('orderSelect', 'E')
      const i = await ui.menu([...party.map((c) => nameOf(c).toUpperCase()), ex.text.toUpperCase()],
        { prompt: `${msg('partyOrder')}${sel.text}`, keys: [...party.map(() => ''), ex.key] })
      if (i >= party.length) continue
      const px = word('orderPlace', 'E')
      const p = await ui.menu(['UP', 'DOWN', px.text.toUpperCase()], { prompt: `${nameOf(party[i])} ${msg('selected')}`, keys: ['U', 'D', px.key] })
      if (p < 2) e.moveMember(i, p === 0 ? -1 : 1)
      ui.refresh()
    } else if (o === 'D') {
      const c = e.cur
      if (e.party().length === 1) { ui.print('The last character cannot leave the party here.', false); continue }
      if (await yes(ui, msg('dropFromParty').trimEnd())) {
        ui.print(`${nameOf(c)} ${msg(c[F.inPlay] ? 'bidsFarewell' : 'dumpedInDitch')}`, false)
        e.dropMember(c)
        ui.refresh()
      } else ui.print(msg('sighOfRelief'), false)
    } else if (o === 'S') {
      // Speed (FUN_3f81_1a97, CotAB 0x3191B): " Faster" while above 0, " Slower" while below 9, " Exit"
      for (;;) {
        const w = [...(e.speed > 0 ? menu('campFaster') : []), ...(e.speed < 9 ? menu('campSlower') : []), ...menu('campSpeedExit')]
        const k = await ask((l, op) => ui.menu(l, op), w, { prompt: `${msg('gameSpeed')}${e.speed}${msg('speedRange')}` })
        if (k === 'F') e.speed = Math.max(0, e.speed - 1)
        else if (k === 'S') e.speed = Math.min(9, e.speed + 1)
        else break
      }
    } else if (o === 'I') {
      // Icon: the editor on the selected character, then the screen redrawn (PoR 0x314FE → FUN_417f_382d,
      // CotAB 0x31B6D → its editor in overlay 0x3685)
      if (ui.iconEditor && (await ui.iconEditor(e.cur))) ui.refresh()
    }
    else if (o === 'L' && R.difficulty) {
      // Level (SotSB, spec/A-games/sotsb/camp.md): the difficulty variable 0-4, Novice ... Champion;
      // the original opens the menu on the current level (the port names it in the prompt); any other answer keeps it
      const d = R.difficulty, w = menu('alterLevel'), cur = e.read(d.variable)
      const k = await ask((l, op) => ui.menu(l, op), w, { prompt: w[cur]?.text ?? '', cancel: true }) // Escape: any other key, the level kept
      const i = w.findIndex((x) => x.key[0] === k)
      if (i >= 0) e.write(d.variable, i)
    }
    else if (o === 'P') ui.print('Monster pictures and portraits are always shown here.', false)
    else return
  }
}
