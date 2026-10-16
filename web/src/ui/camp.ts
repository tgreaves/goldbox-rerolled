// Camp screens (spec/camp.md): Encamp menu, Magic, Rest, Alter.
import type { Engine } from '../vm/engine'
import { parseCharacter } from '../data/character'
import type { Spell } from '../data/spells'
import { clearPending, freeSlots, knows, memorise, memorised, preparation, readableScrolls, restStep, startRest, isScroll } from '../rules/camp'
import { castOutside, targetKind, forget } from '../rules/magic'

export interface CampUi {
  engine: Engine
  menu(items: string[], opts?: { prompt?: string; vertical?: boolean }): Promise<number>
  print(text: string, clear?: boolean): void
  view(): Promise<void>
  save(): Promise<void>
  refresh(): void
  /** show a Stop button while a rest runs; `stopped()` turns true once it is pressed */
  stopper(): { stopped(): boolean; done(): void }
  pause(ms: number): Promise<void>
}

const nameOf = (c: Uint8Array) => parseCharacter(c).name
const yes = async (ui: CampUi, prompt: string) => (await ui.menu(['YES', 'NO'], { prompt })) === 0

/** Fixed names in the Display window (FUN_3f81_0fbc). */
const EFFECT_NAMES: Record<number, string> = {
  4: 'Studying Manual of Bodily Health', 7: 'Training with Manual of Bodily Health', 27: 'Feather Fall', 31: 'Helpless',
  35: 'Prayer', 44: 'Cause Disease', 50: 'Dreaded Mummy Disease', 54: 'Repulsed', 55: 'Poisoned', 59: 'Regenerating',
  61: 'Fire Resistance', 71: 'Invisible', 72: 'Camouflaged', 89: 'Displaced',
}
const SPELL_NAMED = new Set([1, 2, 5, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21, 22, 23, 24, 25, 28, 29, 32, 33, 34, 36, 37, 38, 39, 41, 42, 45, 46, 49, 51, 52, 53])

/** The camp screen (FUN_3f81_1e6f). Sets engine.campInterrupted when a rest was interrupted. */
export async function camp(ui: CampUi) {
  const e = ui.engine
  if (!e.items || !e.spells) { ui.print('The camp needs START.EXE and ITEMS: re-import the POOLRAD folder.', false); return }
  const state = { heal: 0 }
  for (const c of e.party()) clearPending(c, e.itemsOf(c), e.items)
  ui.print('The party makes camp...', true)
  for (;;) {
    const o = await ui.menu(['SAVE', 'VIEW', 'MAGIC', 'REST', 'ALTER', 'EXIT'], { prompt: 'Camp:' })
    if (o === 0) await ui.save()
    else if (o === 1) await ui.view()
    else if (o === 2) { if (await magic(ui, state)) break }
    else if (o === 3) { if (await rest(ui, state)) break }
    else if (o === 4) await alter(ui)
    else break
  }
  for (const c of e.party()) clearPending(c, e.itemsOf(c), e.items)
  ui.refresh()
}

/** Magic menu; returns true when a rest was interrupted. */
async function magic(ui: CampUi, state: { heal: number }): Promise<boolean> {
  for (;;) {
    const o = await ui.menu(['CAST', 'MEMORIZE', 'SCRIBE', 'DISPLAY', 'REST', 'EXIT'], { prompt: 'Magic:' })
    if (o === 0) await cast(ui)
    else if (o === 1) await memorize(ui)
    else if (o === 2) await scribe(ui)
    else if (o === 3) display(ui)
    else if (o === 4) { if (await rest(ui, state)) return true }
    else return false
  }
}

function activity(ui: CampUi, what: 'cast any spells' | 'memorize spells' | 'scribe any scrolls'): boolean {
  const e = ui.engine, c = e.cur
  if (what === 'cast any spells' && e.read(0x49e5) !== 0) { ui.print('cannot cast spells in this area', false); return false }
  if (c[0x10c] === 1 || ![0, 1].includes(c[0x10c])) { ui.print(`${nameOf(c)} is in no condition to ${what}`, false); return false }
  return true
}

/** Cast (FUN_3f81_04a1), also the explore-mode Cast command. */
export async function cast(ui: CampUi) {
  const e = ui.engine, st = e.spells!
  if (!activity(ui, 'cast any spells')) return
  for (;;) {
    const c = e.cur
    const ready = memorised(c).filter((v) => v > 0 && v < 0x80)
    if (!ready.length) { ui.print(`${nameOf(c)} has no spells memorized`, false); return }
    const list = ready.map((id) => st.get(id)!).filter(Boolean)
    const i = await ui.menu([...list.map((s) => s.name.toUpperCase()), 'EXIT'], { prompt: 'Spells in Memory:', vertical: true })
    if (i >= list.length) return
    const s = list[i]
    if (s.side === 0) {
      ui.print(`${s.name} is a combat-only spell...`, false)
      if (await yes(ui, 'Lose it?')) forget(c, s.id)
      continue
    }
    const kind = targetKind(s)
    let targets = [c]
    if (kind === 'party') targets = e.party()
    else if (kind === 'one') {
      const party = e.party()
      const k = await ui.menu([...party.map((m) => nameOf(m).toUpperCase()), 'EXIT'], { prompt: `Cast ${s.name} on:` })
      if (k >= party.length) continue
      targets = [party[k]]
    }
    for (const m of castOutside(e, c, s, targets)) ui.print(m, false)
    ui.refresh()
  }
}

/** Memorize (FUN_3f81_090a). */
async function memorize(ui: CampUi) {
  const e = ui.engine, st = e.spells!
  if (!activity(ui, 'memorize spells')) return
  const c = e.cur
  const pending = () => memorised(c).filter((v) => v >= 0x80).map((v) => st.get(v)!.name)
  if (pending().length) {
    ui.print(`Spells to be memorized: ${pending().join(', ')}`, true)
    if (await yes(ui, 'Memorize These Spells?')) return
    for (let k = 0; k < 21; k++) if (c[0x17 + k] >= 0x80) c[0x17 + k] = 0
  }
  let picked = false
  for (;;) {
    const row = (cls: number) => [1, 2, 3].map((l) => (c[0xb1 + cls * 3 + l] ? String(freeSlots(c, cls, l, st)) : '-')).join(' ')
    const hasCleric = [1, 2, 3].some((l) => c[0xb1 + l]), hasMU = [1, 2, 3].some((l) => c[0xb4 + l])
    if (!hasCleric && !hasMU) { ui.print(`${nameOf(c)} cannot memorize any spells`, false); return }
    ui.print(`${nameOf(c)} can memorize:${hasCleric ? `  Cleric Spells: ${row(0)}` : ''}${hasMU ? `  Magic-User Spells: ${row(1)}` : ''}`, true)
    const book: Spell[] = st.spells.filter((s) => s.id <= 55 && knows(c, s.id))
    const i = await ui.menu([...book.map((s) => `${s.name.toUpperCase()} (${s.cls ? 'MU' : 'CL'} ${s.level})`), 'EXIT'], { prompt: 'Spells in Spell Book:', vertical: true })
    if (i >= book.length) break
    if (memorise(c, book[i], st)) picked = true
  }
  if (picked && pending().length) {
    ui.print(`Spells to be memorized: ${pending().join(', ')}`, true)
    if (!await yes(ui, 'Memorize these spells?')) for (let k = 0; k < 21; k++) if (c[0x17 + k] >= 0x80) c[0x17 + k] = 0
  }
}

/** Scribe (FUN_3f81_0b5b): mark scroll spells to be copied while resting. */
async function scribe(ui: CampUi) {
  const e = ui.engine, st = e.spells!, t = e.items!
  if (!activity(ui, 'scribe any scrolls')) return
  const c = e.cur, items = e.itemsOf(c)
  const marked = () => items.filter((it) => isScroll(it, t)).flatMap((it) => it.props.filter((p) => p > 0x80).map((p) => st.get(p)!.name))
  if (marked().length) {
    ui.print(`Spells to be scribed: ${marked().join(', ')}`, true)
    if (await yes(ui, 'Scribe These Spells?')) return
    for (const it of items) if (isScroll(it, t)) for (let j = 0; j < 3; j++) it.raw[0x3c + j] &= 0x7f
  }
  for (;;) {
    const scrolls = readableScrolls(c, items, e.effectsOf(c), t)
    const entries = scrolls.flatMap((it) => it.props.map((p, j) => ({ it, j, id: p & 0x7f, mark: p > 0x80 })).filter((x) => x.id > 0))
    if (!entries.length) { ui.print(`${nameOf(c)} has no copyable scrolls`, false); break }
    const i = await ui.menu([...entries.map((x) => `${st.get(x.id)!.name.toUpperCase()}${x.mark ? ' (MARKED)' : ''}`), 'EXIT'], { prompt: 'Spells on Scrolls:', vertical: true })
    if (i >= entries.length) break
    const x = entries[i], s = st.get(x.id)!
    if (knows(c, x.id)) ui.print('You already know that spell', false)
    else if (entries.some((y) => y.mark && y.id === x.id)) ui.print('You are already scibing that spell', false)
    else if (!c[0xb1 + s.cls * 3 + s.level]) ui.print('You can not scribe that spell.', false)
    else x.it.raw[0x3c + x.j] |= 0x80
  }
  if (marked().length) {
    ui.print(`Spells to be scribed: ${marked().join(', ')}`, true)
    if (!await yes(ui, 'Scribe these spells?')) for (const it of items) if (isScroll(it, t)) for (let j = 0; j < 3; j++) it.raw[0x3c + j] &= 0x7f
  }
}

/** Display (FUN_3f81_0fbc): the current character's effects. */
function display(ui: CampUi) {
  const e = ui.engine, st = e.spells!
  const fx = e.effectsOf(e.cur)
  const names = fx.map((f) => {
    if (SPELL_NAMED.has(f.type)) {
      return st.spells.find((s) => s.effect === f.type)?.name ?? `Funky--${f.type}`
    }
    return EFFECT_NAMES[f.type] ?? ''
  }).filter(Boolean)
  ui.print(`Display: ${names.length ? names.join(', ') : '<No Spell Effects>'}`, true)
}

/** Rest (FUN_3f81_077a, FUN_4b46_0721, FUN_4b46_0c9a). Returns true when interrupted. */
export async function rest(ui: CampUi, state: { heal: number }): Promise<boolean> {
  const e = ui.engine, t = e.items!, st = e.spells!
  let minutes = 0
  for (const c of e.party()) minutes = Math.max(minutes, preparation(c, e.itemsOf(c), t, st))
  // duration prompt: days capped at 99
  for (;;) {
    const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60
    const label = `Rest Time: ${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const o = await ui.menu(['REST', 'DAYS +', 'DAYS -', 'HOURS +', 'HOURS -', 'MINS +', 'MINS -', 'EXIT'], { prompt: label })
    if (o === 0) break
    if (o === 7) return false
    const delta = [0, 1440, -1440, 60, -60, 5, -5][o]
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
      const res = restStep(e, r, state)
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

/** Alter (FUN_3f81_1c59): Order, Drop, Speed. */
async function alter(ui: CampUi) {
  const e = ui.engine
  for (;;) {
    const o = await ui.menu(['ORDER', 'DROP', 'SPEED', 'ICON', 'PICS', 'EXIT'], { prompt: 'Alter:' })
    if (o === 0) {
      const party = e.party()
      const i = await ui.menu([...party.map((c) => nameOf(c).toUpperCase()), 'EXIT'], { prompt: 'Party Order: Select' })
      if (i >= party.length) continue
      const p = await ui.menu(['UP', 'DOWN', 'EXIT'], { prompt: `${nameOf(party[i])} has been selected` })
      if (p < 2) e.moveMember(i, p === 0 ? -1 : 1)
      ui.refresh()
    } else if (o === 1) {
      const c = e.cur
      if (e.party().length === 1) { ui.print('The last character cannot leave the party here.', false); continue }
      if (await yes(ui, 'Drop from party?')) {
        ui.print(c[0x10d] ? `${nameOf(c)} bids you farewell` : `${nameOf(c)} is dumped in a ditch`, false)
        e.dropMember(c)
        ui.refresh()
      } else ui.print('Breathes A sigh of relief', false)
    } else if (o === 2) {
      for (;;) {
        const k = await ui.menu(['FASTER', 'SLOWER', 'EXIT'], { prompt: `Game Speed = ${e.speed} (0=fastest 9=slowest)` })
        if (k === 0) e.speed = Math.max(0, e.speed - 1)
        else if (k === 1) e.speed = Math.min(9, e.speed + 1)
        else break
      }
    } else if (o === 3) ui.print('The combat icon editor is on the party screen (Modify, Icon).', false)
    else if (o === 4) ui.print('Monster pictures and portraits are always shown here.', false)
    else return
  }
}
