// Character creation on one screen (IMP-040): race, gender, class and alignment as button rows
// (combinations the rules forbid are greyed out with the reason), the rolled character with Reroll
// and inline Modify steppers, and the name, portrait and combat icon beside it, all at once.
// The rules are the original's (spec/chargen.md, FUN_417f_056c; Modify FUN_417f_209f; icon editor
// FUN_417f_382d); only the order of the questions is gone.
import type { GameFiles } from '../store/gamefiles'
import { ALIGNMENTS, CLASSES, RACES, parseCharacter } from '../data/character'
import { EGA, parseRecord, toImageData, type Picture } from '../data/image'
import { buildIcon } from '../render/icon'
import {
  RACE_MENU, Tables, abilityRange, alignmentsFor, begin, bodyRecord, classesFor, combatStats, headRecord, hpMax, hpMin,
  modifyStep, rollAbilities, setName, type Rng,
} from '../rules/chargen'
import { escape, onClose } from './sheet'

const STATS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA']
const ICON_PARTS = ['Body', 'Arm', 'Leg', 'Hair/Face', 'Shield', 'Weapon']
const GENDERS = ['Male', 'Female']

export function createCharacter(dialog: HTMLDialogElement, files: GameFiles, rng: Rng, t: Tables): Promise<Uint8Array | null> {
  const picture = (family: string, id: number): Picture | null => {
    const raw = files.record(family, id)
    try { return raw ? parseRecord(raw).frames[0].picture : null } catch { return null }
  }
  const allClasses = [...new Set(RACE_MENU.flatMap((r) => classesFor(t, r)))].sort((a, b) => a - b)

  let race = 7, gender = 0, cls = classesFor(t, 7)[0], align = alignmentsFor(t, cls)[0]
  let c = begin(t, rng, race, gender, cls, align)
  rollAbilities(t, rng, c)
  let name = ''
  let sizeTouched = false
  let part = 0
  let notice = ''

  /** Race, gender or class changed: start again and roll, keeping the name and the looks. */
  const restart = () => {
    const looks = c.slice(0xbb, 0xc7)
    const size = c[0xc0]
    c = begin(t, rng, race, gender, cls, align)
    rollAbilities(t, rng, c)
    c.set(looks, 0xbb)
    if (sizeTouched) c[0xc0] = size
    else c[0xc0] = race === 1 || race === 3 || race === 5 ? 1 : 2
  }

  const row = (label: string, items: { v: number; text: string; ok: boolean; why?: string }[], cur: number, key: string) =>
    `<div class="nc-row"><span class="nc-label">${label}</span><div class="nc-opts">${items.map((i) =>
      `<button type="button" data-${key}="${i.v}" class="${i.v === cur ? 'on' : ''}" ${i.ok ? '' : 'disabled'} title="${escape(i.why ?? '')}">${escape(i.text)}</button>`).join('')}</div></div>`

  const paint = (canvas: HTMLCanvasElement | null, pics: { p: Picture | null; x: number; y: number }[]) => {
    if (!canvas) return
    const g = canvas.getContext('2d')!
    g.fillStyle = '#000'
    g.fillRect(0, 0, canvas.width, canvas.height)
    for (const { p, x, y } of pics) if (p) g.putImageData(toImageData(p), x, y)
  }

  function render() {
    const ch = parseCharacter(c)
    const classOk = classesFor(t, race), alignOk = alignmentsFor(t, cls)
    const statRows = STATS.map((n, f) => {
      const [lo, hi] = abilityRange(t, c, f)
      const v = c[0x10 + f]
      const pct = f === 0 && v === 18 && c[0x16] ? `/${String(c[0x16] % 100).padStart(2, '0')}` : ''
      return `<tr><th>${n}</th><td><button type="button" data-mod="${f}" data-d="-1" aria-label="lower ${n}">−</button></td>
        <td class="v">${v}${pct}</td><td><button type="button" data-mod="${f}" data-d="1" aria-label="raise ${n}">+</button></td><td class="muted">${lo}–${hi}</td></tr>`
    }).join('')
    const gold = c[0x8e] | (c[0x8f] << 8)
    dialog.innerHTML = `<h2>Create a character</h2>
      <div class="newchar">
        <section class="nc-choices">
          ${row('Race', RACE_MENU.map((r) => ({ v: r, text: RACES[r], ok: true })), race, 'race')}
          ${row('Gender', GENDERS.map((g, i) => ({ v: i, text: g, ok: true })), gender, 'gender')}
          ${row('Class', allClasses.map((k) => ({ v: k, text: CLASSES[k], ok: classOk.includes(k), why: classOk.includes(k) ? '' : `Not open to a ${RACES[race]}` })), cls, 'cls')}
          ${row('Alignment', ALIGNMENTS.map((a, i) => ({ v: i, text: a, ok: alignOk.includes(i), why: alignOk.includes(i) ? '' : `Not allowed for a ${CLASSES[cls]}` })), align, 'align')}
          <p class="muted nc-hint">Changing race, gender or class rolls the character again, as the original rolls after those choices. Alignment does not.</p>
          ${notice ? `<p class="message">${escape(notice)}</p>` : ''}
        </section>
        <section class="nc-stats">
          <table class="modify"><tbody>${statRows}
            <tr><th>HP</th><td><button type="button" data-mod="6" data-d="-1" aria-label="lower HP">−</button></td><td class="v">${c[0x32]}</td>
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
              <span>Head</span><button type="button" data-x="ph-">◀</button><output>${c[0xbb]}</output><button type="button" data-x="ph+">▶</button>
              <span>Body</span><button type="button" data-x="pb-">◀</button><output>${c[0xbc]}</output><button type="button" data-x="pb+">▶</button>
            </div>
          </div>
          <div class="nc-icon">
            <canvas class="pixel ic" width="24" height="24"></canvas><canvas class="pixel ic" width="24" height="24"></canvas>
            <div class="iconctl">
              <span>Head</span><button type="button" data-x="head-">◀</button><output>${c[0xbd]}</output><button type="button" data-x="head+">▶</button>
              <span>Weapon</span><button type="button" data-x="weapon-">◀</button><output>${c[0xbe]}</output><button type="button" data-x="weapon+">▶</button>
              <span>Size</span><button type="button" data-x="size" class="wide">${c[0xc0] === 2 ? 'Large' : 'Small'}</button>
            </div>
            <div class="parts">${ICON_PARTS.map((n, i) => `<button type="button" data-part="${i}" class="${i === part ? 'on' : ''}">${n}</button>`).join('')}</div>
            <div class="palette"><span>Colour 1</span>${EGA.map((rgb, i) => `<button type="button" class="sw ${(c[0xc1 + part] & 0xf) === i ? 'on' : ''}" data-c1="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
            <div class="palette"><span>Colour 2</span>${EGA.map((rgb, i) => `<button type="button" class="sw ${c[0xc1 + part] >> 4 === i ? 'on' : ''}" data-c2="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
          </div>
        </section>
      </div>
      <form method="dialog" class="yn"><button value="e">Cancel</button><button value="k" class="primary" data-act="create">Create</button></form>`
    paint(dialog.querySelector<HTMLCanvasElement>('canvas.portrait'), [
      { p: picture('HEAD3', headRecord(t, c[0xbb])), x: 0, y: 0 }, { p: picture('BODY3', bodyRecord(t, c[0xbc])), x: 0, y: 40 }])
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
      } else if (d.align) { align = Number(d.align); c[0xa0] = align }
      else if (d.act === 'reroll') { rollAbilities(t, rng, c); c[0x85] = 0 }
      else if (d.mod) {
        modifyStep(t, c, Number(d.mod), Number(d.d) as 1 | -1)
        c[0x85] = 1 // as Modify's Keep
        c[0x11b] = c[0x32]
        combatStats(c)
      } else if (d.x) {
        const x = d.x
        if (x === 'ph+') c[0xbb] = (c[0xbb] % 14) + 1
        else if (x === 'ph-') c[0xbb] = ((c[0xbb] + 12) % 14) + 1
        else if (x === 'pb+') c[0xbc] = (c[0xbc] % 12) + 1
        else if (x === 'pb-') c[0xbc] = ((c[0xbc] + 10) % 12) + 1
        else if (x === 'head+') c[0xbd] = (c[0xbd] + 1) % 14
        else if (x === 'head-') c[0xbd] = (c[0xbd] + 13) % 14
        else if (x === 'weapon+') c[0xbe] = (c[0xbe] + 1) % 32
        else if (x === 'weapon-') c[0xbe] = (c[0xbe] + 31) % 32
        else if (x === 'size') { c[0xc0] = c[0xc0] === 2 ? 1 : 2; sizeTouched = true }
      } else if (d.part) part = Number(d.part)
      else if (d.c1) c[0xc1 + part] = (c[0xc1 + part] & 0xf0) | Number(d.c1)
      else if (d.c2) c[0xc1 + part] = (c[0xc1 + part] & 0x0f) | (Number(d.c2) << 4)
      render()
    }
    const onKey = (e: KeyboardEvent) => {
      if (!dialog.open || document.activeElement instanceof HTMLInputElement) return
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); e.stopPropagation(); rollAbilities(t, rng, c); c[0x85] = 0; render() }
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
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('.nc-name input')?.focus()
  })
}
