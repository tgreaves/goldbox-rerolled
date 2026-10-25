// Character creation on one screen (IMP-040): race, gender, class and alignment as button rows
// (combinations the rules forbid are greyed out with the reason), the rolled character with Reroll
// and inline Modify steppers, and the name, portrait and combat icon beside it, all at once.
// The rules are the original's (spec/A-games/engine/chargen-and-progression.md, FUN_417f_056c; Modify FUN_417f_209f; icon editor
// FUN_417f_382d); only the order of the questions is gone.
import { R } from '../games/rules'
import type { GameFiles } from '../store/gamefiles'
import { ALIGNMENTS, CLASSES, GENDERS, RACES, parseCharacter } from '../data/character'
import { EGA, parseRecord, toImageData, type Picture } from '../data/image'
import { blit, sizeCanvas } from '../render/upscale'
import { buildIcon } from '../render/icon'
import {
  Tables, abilityRange, alignmentsFor, begin, bodyRecord, classesFor, combatStats, headRecord, hpMax, hpMin,
  modifyStep, rollAbilities, setName,
} from '../rules/chargen'
import type { Dice } from '../rules/dice'
import { escape, onClose, parchmentPanel } from './sheet'
import { word } from '../games/strings'
import { game } from '../games/profile'

/** The portrait picker's words, PoR's "Head Body Keep" (FUN_417f_33e7); a game without one (CotAB has
 *  no portraits) keeps the port's. */
const portraitWord = (key: string, port: string) => (game().menus.portrait !== undefined ? word('portrait', key).text : port)
import { F } from '../games/fields'

const STATS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA']
/**
 * The combat icon editor's words (FUN_417f_382d, CotAB 0x3A716; spec/D-appendices/strings.md §4.1): the
 * parts of its level-3 menu in colour-byte order (C1 … C6, Hair and Face as one part), Head and Weapon
 * (level 2), Size and the two colours (level 1), Small and Large.
 */
export function iconWords() {
  const p = (k: string) => word('iconParts', k).text
  return {
    parts: [p('B'), p('A'), p('L'), `${word('iconHair', 'H').text}/${word('iconFace', 'F').text}`, p('S'), p('W')],
    head: word('iconHeadWeapon', 'H').text, weapon: word('iconHeadWeapon', 'W').text, size: word('iconMain', 'S').text,
    colour1: word('iconMain', '1').text, colour2: word('iconMain', '2').text,
    sizeName: (size: number) => (size === 2 ? word('iconLarge', 'L') : word('iconSmall', 'S')).text,
  }
}

export function createCharacter(dialog: HTMLDialogElement, files: GameFiles, dice: Dice, t: Tables): Promise<Uint8Array | null> {
  const iw = iconWords()
  const picture = (family: string, id: number): Picture | null => {
    const raw = files.record(family, id)
    try { return raw ? parseRecord(raw).frames[0].picture : null } catch { return null }
  }
  const allClasses = [...new Set(R.raceMenu.flatMap((r) => classesFor(t, r)))].sort((a, b) => a - b)

  let race = 7, gender = 0, cls = classesFor(t, 7)[0], align = alignmentsFor(t, cls)[0]
  let c = begin(t, dice, race, gender, cls, align)
  rollAbilities(t, dice, c)
  let name = ''
  let sizeTouched = false
  let part = 0
  let notice = ''

  /** Race, gender or class changed: start again and roll, keeping the name and the looks. */
  const restart = () => {
    const looks = c.slice(F.head, F.iconColours + 6)
    const size = c[F.iconSize]
    c = begin(t, dice, race, gender, cls, align)
    rollAbilities(t, dice, c)
    c.set(looks, F.head)
    if (sizeTouched) c[F.iconSize] = size
    else c[F.iconSize] = race === 1 || race === 3 || race === 5 ? 1 : 2
  }

  const row = (label: string, items: { v: number; text: string; ok: boolean; why?: string }[], cur: number, key: string) =>
    `<div class="nc-row"><span class="nc-label">${label}</span><div class="nc-opts">${items.map((i) =>
      `<button type="button" data-${key}="${i.v}" class="${i.v === cur ? 'on' : ''}" ${i.ok ? '' : 'disabled'} title="${escape(i.why ?? '')}">${escape(i.text)}</button>`).join('')}</div></div>`

  const paint = (canvas: HTMLCanvasElement | null, pics: { p: Picture | null; x: number; y: number }[]) => {
    if (!canvas) return
    const w = Number(canvas.getAttribute('width')), h = Number(canvas.getAttribute('height'))
    const g = sizeCanvas(canvas, w, h)
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    for (const { p, x, y } of pics) if (p) blit(g, toImageData(p), x, y)
  }

  function render() {
    const ch = parseCharacter(c)
    const classOk = classesFor(t, race), alignOk = alignmentsFor(t, cls)
    const statRows = STATS.map((n, f) => {
      const [lo, hi] = abilityRange(t, c, f)
      const v = c[F.stat[f]]
      const pct = f === 0 && v === 18 && c[F.strPct] ? `/${String(c[F.strPct] % 100).padStart(2, '0')}` : ''
      return `<tr><th>${n}</th><td><button type="button" data-mod="${f}" data-d="-1" aria-label="lower ${n}">−</button></td>
        <td class="v">${v}${pct}</td><td><button type="button" data-mod="${f}" data-d="1" aria-label="raise ${n}">+</button></td><td class="muted">${lo}–${hi}</td></tr>`
    }).join('')
    const gold = c[F.money + 6] | (c[F.money + 7] << 8)
    dialog.innerHTML = `<h2>Create a character</h2>
      <div class="newchar">
        <section class="nc-choices">
          ${row('Race', R.raceMenu.map((r) => ({ v: r, text: RACES[r], ok: true })), race, 'race')}
          ${row('Gender', GENDERS.map((g, i) => ({ v: i, text: g, ok: true })), gender, 'gender')}
          ${row('Class', allClasses.map((k) => ({ v: k, text: CLASSES[k], ok: classOk.includes(k), why: classOk.includes(k) ? '' : `Not open to a ${RACES[race]}` })), cls, 'cls')}
          ${row('Alignment', ALIGNMENTS.map((a, i) => ({ v: i, text: a, ok: alignOk.includes(i), why: alignOk.includes(i) ? '' : `Not allowed for a ${CLASSES[cls]}` })), align, 'align')}
          <p class="muted nc-hint">Changing race, gender or class rolls the character again, as the original rolls after those choices. Alignment does not.</p>
          ${notice ? `<p class="message">${escape(notice)}</p>` : ''}
        </section>
        <section class="nc-stats">
          <table class="modify"><tbody>${statRows}
            <tr><th>HP</th><td><button type="button" data-mod="6" data-d="-1" aria-label="lower HP">−</button></td><td class="v">${c[F.maxHp]}</td>
              <td><button type="button" data-mod="6" data-d="1" aria-label="raise HP">+</button></td><td class="muted">${hpMin(t, c)}–${hpMax(t, c)}</td></tr>
          </tbody></table>
          <p class="nc-derived">AC ${ch.ac} · THAC0 ${ch.thac0} · Age ${ch.age} · ${gold} gold</p>
          <button type="button" data-act="reroll"><u>R</u>eroll</button>
        </section>
        <section class="nc-looks">
          <label class="nc-name">Name <input maxlength="15" autocomplete="off" value="${escape(name)}" placeholder="up to 15 letters"></label>
          <div class="nc-portrait">
            <canvas class="pixel portrait" width="88" height="88"></canvas>
            <div class="iconctl">
              <span>${escape(portraitWord('H', 'Head'))}</span><button type="button" data-x="ph-">◀</button><output>${c[F.head]}</output><button type="button" data-x="ph+">▶</button>
              <span>${escape(portraitWord('B', 'Body'))}</span><button type="button" data-x="pb-">◀</button><output>${c[F.body]}</output><button type="button" data-x="pb+">▶</button>
            </div>
          </div>
          <div class="nc-icon">
            <canvas class="pixel ic" width="24" height="24"></canvas><canvas class="pixel ic" width="24" height="24"></canvas>
            <div class="iconctl">
              <span>${escape(iw.head)}</span><button type="button" data-x="head-">◀</button><output>${c[F.iconHead]}</output><button type="button" data-x="head+">▶</button>
              <span>${escape(iw.weapon)}</span><button type="button" data-x="weapon-">◀</button><output>${c[F.iconBody]}</output><button type="button" data-x="weapon+">▶</button>
              <span>${escape(iw.size)}</span><button type="button" data-x="size" class="wide">${escape(iw.sizeName(c[F.iconSize]))}</button>
            </div>
            <div class="parts">${iw.parts.map((n, i) => `<button type="button" data-part="${i}" class="${i === part ? 'on' : ''}">${n}</button>`).join('')}</div>
            <div class="palette"><span>${escape(iw.colour1)}</span>${EGA.map((rgb, i) => `<button type="button" class="sw ${(c[F.iconColours + part] & 0xf) === i ? 'on' : ''}" data-c1="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
            <div class="palette"><span>${escape(iw.colour2)}</span>${EGA.map((rgb, i) => `<button type="button" class="sw ${c[F.iconColours + part] >> 4 === i ? 'on' : ''}" data-c2="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
          </div>
        </section>
      </div>
      <form method="dialog" class="yn"><button value="e">Cancel</button><button value="k" class="primary" data-act="create">Create</button></form>`
    paint(dialog.querySelector<HTMLCanvasElement>('canvas.portrait'), [
      { p: picture('HEAD3', headRecord(t, c[F.head])), x: 0, y: 0 }, { p: picture('BODY3', bodyRecord(t, c[F.body])), x: 0, y: 40 }])
    const [i1, i2] = dialog.querySelectorAll<HTMLCanvasElement>('canvas.ic')
    paint(i1, [{ p: buildIcon(files, c, false), x: 0, y: 0 }])
    paint(i2, [{ p: buildIcon(files, c, true), x: 0, y: 0 }])
    const input = dialog.querySelector<HTMLInputElement>('.nc-name input')!
    input.addEventListener('input', () => { name = input.value })
  }

  return new Promise((resolve) => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest('button')
      if (!b || b.disabled) return
      const d = b.dataset
      if (d.act === 'create') {
        const n = name.toUpperCase().replace(/[^ -z]/g, '').trim()
        if (!n) { e.preventDefault(); notice = 'Give the character a name.'; render(); dialog.querySelector<HTMLInputElement>('.nc-name input')?.focus(); return }
        return // the form closes the dialog with "k"
      }
      if (b.closest('form')) return
      e.preventDefault()
      notice = ''
      if (d.race) {
        race = Number(d.race)
        const ok = classesFor(t, race)
        if (!ok.includes(cls)) { notice = `${CLASSES[cls]} is not open to a ${RACES[race]}: now ${CLASSES[ok[0]]}.`; cls = ok[0] }
        const al = alignmentsFor(t, cls)
        if (!al.includes(align)) align = al[0]
        restart()
      } else if (d.gender) { gender = Number(d.gender); restart() }
      else if (d.cls) {
        cls = Number(d.cls)
        const al = alignmentsFor(t, cls)
        if (!al.includes(align)) { notice = `${ALIGNMENTS[align]} is not allowed for a ${CLASSES[cls]}: now ${ALIGNMENTS[al[0]]}.`; align = al[0] }
        restart()
      } else if (d.align) { align = Number(d.align); c[F.alignment] = align }
      else if (d.act === 'reroll') { rollAbilities(t, dice, c); c[F.npcShare] = 0 }
      else if (d.mod) {
        modifyStep(t, c, Number(d.mod), Number(d.d) as 1 | -1)
        c[F.npcShare] = 1 // as Modify's Keep
        c[F.hp] = c[F.maxHp]
        combatStats(c)
      } else if (d.x) {
        const x = d.x
        if (x === 'ph+') c[F.head] = (c[F.head] % 14) + 1
        else if (x === 'ph-') c[F.head] = ((c[F.head] + 12) % 14) + 1
        else if (x === 'pb+') c[F.body] = (c[F.body] % 12) + 1
        else if (x === 'pb-') c[F.body] = ((c[F.body] + 10) % 12) + 1
        else if (x === 'head+') c[F.iconHead] = (c[F.iconHead] + 1) % 14
        else if (x === 'head-') c[F.iconHead] = (c[F.iconHead] + 13) % 14
        else if (x === 'weapon+') c[F.iconBody] = (c[F.iconBody] + 1) % 32
        else if (x === 'weapon-') c[F.iconBody] = (c[F.iconBody] + 31) % 32
        else if (x === 'size') { c[F.iconSize] = c[F.iconSize] === 2 ? 1 : 2; sizeTouched = true }
      } else if (d.part) part = Number(d.part)
      else if (d.c1) c[F.iconColours + part] = (c[F.iconColours + part] & 0xf0) | Number(d.c1)
      else if (d.c2) c[F.iconColours + part] = (c[F.iconColours + part] & 0x0f) | (Number(d.c2) << 4)
      render()
    }
    const onKey = (e: KeyboardEvent) => {
      if (!dialog.open || document.activeElement instanceof HTMLInputElement) return
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); e.stopPropagation(); rollAbilities(t, dice, c); c[F.npcShare] = 0; render() }
    }
    dialog.classList.add('wide')
    dialog.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey, true)
    onClose(dialog, () => {
      dialog.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKey, true)
      dialog.classList.remove('wide')
      if (dialog.returnValue !== 'k') return resolve(null)
      setName(c, name.toUpperCase().replace(/[^ -z]/g, '').trim())
      resolve(c)
    })
    render()
    dialog.returnValue = ''
    parchmentPanel(dialog, 'newchar-panel') // creation in the parchment look (IMP-096)
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('.nc-name input')?.focus()
  })
}
