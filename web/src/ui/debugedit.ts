// Debug character editor (IMP-025): change a party member's record directly. Not part of the game.
// After a change the derived statistics are worked out again with the original rules
// (FUN_51cf_0000 and the item recalculation), so THAC0, saves, spell slots and AC follow.
import { R, bookSpell } from '../games/rules'
import type { Engine } from '../vm/engine'
import { ALIGNMENTS, CLASSES, GENDERS, MONEY, STATUS } from '../data/character'
import { Item } from '../data/items'
import { buildItem } from '../rules/randitem'
import { recalc } from '../rules/equip'
import { derive, levelHp, maxLevel, xpFor } from '../rules/training'
import { keepBase, type Tables } from '../rules/chargen'
import { onClose } from './sheet'
import { F } from '../games/fields'
import { game } from '../games/profile'

const STATS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA']
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)
const nameOf = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
const u16 = (c: Uint8Array, o: number) => c[o] | (c[o + 1] << 8)
const set16 = (c: Uint8Array, o: number, v: number) => { c[o] = v & 0xff; c[o + 1] = (v >> 8) & 0xff }
const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0
const set32 = (c: Uint8Array, o: number, v: number) => { c[o] = v & 0xff; c[o + 1] = (v >> 8) & 0xff; c[o + 2] = (v >> 16) & 0xff; c[o + 3] = (v >>> 24) & 0xff }

export function editCharacters(dialog: HTMLDialogElement, e: Engine, tables: Tables | null, changed: () => void): Promise<void> {
  const party = e.party()
  let who = Math.max(0, party.indexOf(e.cur))
  let message = ''
  const it = e.items
  // weapons, armour and shields as FUN_4c2d_1010 builds them (types 1–47, 50–59; 48 and 49 are not items);
  // the "+n" word is n1 for armour (types 0x32–0x3A), n2 otherwise
  const plusWord = (t: number) => (t >= 0x32 && t <= 0x3a ? 0x2f : 0x30)
  const types: [number, string][] = []
  // scrolls as the treasure builder makes them (1–3 spells rolled from the game's lists), so bundles can be tried
  const scrolls = game().treasure.scrolls.map((k) => k.type)
  if (it && e.startImage) for (let t = 1; t <= 0x3b; t++) {
    if (t === 48 || t === 49 || scrolls.includes(t)) continue
    try { const x = buildItem(t, () => 1, e.startImage); x.raw[0x32] = 0; x.raw[plusWord(t)] = 0; const n = it.name(x, true).trim(); if (n) types.push([t, n]) } catch { /* not buildable */ }
  }
  if (it && e.startImage) for (const t of scrolls) {
    try { const x = buildItem(t, () => 1, e.startImage); types.push([t, `${it.name(x, true).replace(/ 1 Spell$/, '')} (random spells)`]) } catch { /* not buildable */ }
  }

  const num = (label: string, name: string, v: number, min: number, max: number) =>
    `<label>${label} <input name="${name}" type="number" min="${min}" max="${max}" value="${v}"></label>`
  const select = (label: string, name: string, opts: string[], v: number) =>
    `<label>${label} <select name="${name}">${opts.map((o, i) => `<option value="${i}"${i === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`

  const render = () => {
    const c = party[who]
    dialog.innerHTML = `<h2>Edit character</h2>
      <p class="muted">Debug, not part of the game. Derived values (THAC0, saves, AC, spell slots) are worked out again on Apply.</p>
      <div class="nc-opts">${party.map((p, i) => `<button type="button" data-who="${i}" class="${i === who ? 'on' : ''}">${esc(nameOf(p))}</button>`).join('')}</div>
      <form class="charedit">
        <fieldset><legend>Character</legend>
          <label>Name <input name="name" maxlength="15" value="${esc(nameOf(c))}"></label>
          ${select('Status', 'status', STATUS, c[F.status])}
          ${select('Alignment', 'align', ALIGNMENTS, c[F.alignment])}
          ${select('Gender', 'gender', GENDERS, c[F.gender])}
          ${num('Age', 'age', u16(c, F.age), 1, 999)}
        </fieldset>
        <fieldset><legend>Abilities</legend>
          ${STATS.map((s, i) => num(s, `s${i}`, c[F.stat[i]], 3, 25)).join('')}
          ${num('STR %', 'pct', c[F.strPct], 0, 100)}
        </fieldset>
        <fieldset><legend>Hit points and experience</legend>
          ${num('HP', 'hp', c[F.hp], 0, 255)} ${num('Max HP', 'maxhp', c[F.maxHp], 1, 255)}
          ${num('Experience', 'xp', u32(c, F.xp), 0, 99999999)}
        </fieldset>
        <fieldset><legend>Levels</legend>
          ${CLASSES.slice(0, F.classCount).map((n, k) => num(`${n} (max ${tables ? maxLevel(tables, k) : 1})`, `l${k}`, c[F.levels + k], 0, tables ? maxLevel(tables, k) : 1)).join('')}
        </fieldset>
        <fieldset><legend>Money</legend>
          ${MONEY.map((n, k) => num(n, `m${k}`, u16(c, F.money + 2 * k), 0, 65535)).join('')}
        </fieldset>
        <p><button class="primary">Apply</button></p>
      </form>
      <div class="nc-opts">
        <button type="button" data-act="heal">Heal fully</button>
        <button type="button" data-act="effects">Clear effects (${e.effectsOf(c).length})</button>
        <button type="button" data-act="ready">Ready memorised spells</button>
        <button type="button" data-act="learn">Learn every magic-user spell</button>
      </div>
      ${types.length ? `<form class="additem">
        <label>Add item ${`<select name="type">${types.map(([t, n]) => `<option value="${t}">${esc(n)}</option>`).join('')}</select>`}</label>
        ${num('plus', 'plus', 0, 0, 3)} <button>Add</button>
      </form>` : ''}
      ${message ? `<p class="message">${esc(message)}</p>` : ''}
      <form method="dialog"><button>Close</button></form>`
  }

  const finish = (c: Uint8Array, msg: string) => {
    if (tables) derive(tables, c)
    if (it) recalc(c, e.itemsOf(c), it)
    message = msg
    changed()
    render()
  }

  return new Promise((resolve) => {
    const onClick = (ev: MouseEvent) => {
      const b = (ev.target as HTMLElement).closest('button')
      if (!b || b.closest('form')) return
      const c = party[who]
      if (b.dataset.who) { who = Number(b.dataset.who); message = ''; render(); return }
      switch (b.dataset.act) {
        case 'heal':
          c[F.hp] = c[F.maxHp]; c[F.status] = 0; c[F.inPlay] = 1
          finish(c, `${nameOf(c)} is fully healed.`)
          break
        case 'effects':
          e.effectsOf(c).length = 0
          finish(c, `${nameOf(c)} has no effects now (the stats they changed stay as they are).`)
          break
        case 'ready':
          for (let k = 0; k < F.memorisedCount; k++) if (c[F.memorised + k] > 0x80) c[F.memorised + k] -= 0x80
          finish(c, 'Every pending spell is ready.')
          break
        case 'learn': {
          const st = e.spells
          if (st) for (const s of st.spells) if (s.cls === R.spells.magicUser && bookSpell(s)) c[F.known + s.id] = 1
          finish(c, `${nameOf(c)} knows every magic-user spell.`)
          break
        }
      }
    }
    const onSubmit = (ev: SubmitEvent) => {
      const f = ev.target as HTMLFormElement
      if (f.method === 'dialog') return
      ev.preventDefault()
      const c = party[who]
      const v = (n: string) => Number((f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? 0) || 0
      const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(x)))
      if (f.classList.contains('additem')) {
        if (!it || !e.startImage) return
        const items = e.itemsOf(c)
        if (items.length >= 16) { message = 'No room: 16 items is the most a character can carry.'; render(); return }
        const scroll = scrolls.includes(v('type'))
        const x: Item = buildItem(v('type'), scroll ? (sides) => e.roll(1, sides) : () => 1, e.startImage)
        const plus = clamp(v('plus'), 0, 3) // the word table has +1 to +3
        if (!scroll) {
          x.raw[0x32] = plus & 0xff
          x.raw[plusWord(x.type)] = plus > 0 ? 0xa1 + plus : 0
        }
        x.raw[0x35] = 0 // identified
        items.push(x)
        finish(c, `${nameOf(c)} now carries ${it.name(x, true)}.`)
        return
      }
      const name = String((f.elements.namedItem('name') as HTMLInputElement).value).toUpperCase().slice(0, 15)
      c[F.name] = name.length
      for (let k = 0; k < 15; k++) c[F.name + 1 + k] = k < name.length ? name.charCodeAt(k) & 0x7f : 0
      c[F.status] = clamp(v('status'), 0, STATUS.length - 1)
      c[F.inPlay] = c[F.status] === 0 || c[F.status] === 1 ? 1 : 0
      c[F.alignment] = clamp(v('align'), 0, ALIGNMENTS.length - 1)
      c[F.gender] = clamp(v('gender'), 0, 1)
      set16(c, F.age, clamp(v('age'), 1, 999))
      for (let i = 0; i < 6; i++) c[F.stat[i]] = clamp(v(`s${i}`), 3, 25)
      c[F.strPct] = c[F.stat[0]] === 18 ? clamp(v('pct'), 0, 100) : 0
      keepBase(c)
      c[F.maxHp] = clamp(v('maxhp'), 1, 255)
      c[F.hp] = clamp(v('hp'), 0, c[F.maxHp])
      set32(c, F.xp, clamp(v('xp'), 0, 99999999))
      // levels up to the game's caps; each level gained rolls its hit points as training does, and
      // experience comes up to that level's minimum (lowering a level leaves max HP alone)
      let gained = 0
      const hpBefore = c[F.maxHp]
      for (let k = 0; k < F.classCount; k++) {
        const to = clamp(v(`l${k}`), 0, tables ? maxLevel(tables, k) : 1)
        if (tables && c[F.levels + k] > 0) while (c[F.levels + k] < to) {
          c[F.levels + k]++
          levelHp(tables, e, c, [k])
          gained++
          const min = xpFor(tables, k, c[F.levels + k])
          if (min !== 0xffffffff && u32(c, F.xp) < min) set32(c, F.xp, min)
        }
        c[F.levels + k] = to
      }
      for (let k = 0; k < 7; k++) set16(c, F.money + 2 * k, clamp(v(`m${k}`), 0, 65535))
      finish(c, gained ? `${nameOf(c)} updated: ${gained} level${gained > 1 ? 's' : ''} gained, max HP ${hpBefore} → ${c[F.maxHp]}.` : `${nameOf(c)} updated.`)
    }
    dialog.addEventListener('click', onClick)
    dialog.addEventListener('submit', onSubmit)
    onClose(dialog, () => { dialog.removeEventListener('click', onClick); dialog.removeEventListener('submit', onSubmit); resolve() })
    render()
    dialog.showModal()
  })
}
