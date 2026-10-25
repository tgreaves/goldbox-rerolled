// Character creation, combat-icon editor and Modify (spec/A-games/engine/input-and-menus.md, spec/A-games/engine/chargen-and-progression.md), shared by the
// start-up party screen and the party screen a training hall opens.
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter } from '../data/character'
import type { StoredCharacter } from '../store/user'
import { escape, onClose, wordButton, listExit, parchmentPanel } from './sheet'
import { word } from '../games/strings'
import { toImageData, EGA, battlePalette, type Picture } from '../data/image'
import { blit, sizeCanvas } from '../render/upscale'
import { Tables, abilityRange, combatStats, hpMax, hpMin, modifyStep } from '../rules/chargen'
import { buildIcon } from '../render/icon'
import { createCharacter, iconWords } from './newchar'
import { F } from '../games/fields'
import type { Dice } from '../rules/dice'

export function creatorTools(dialog: HTMLDialogElement, files: GameFiles, dice: Dice, tables: Tables | null) {
  /** "Cleric/Fighter/Magic-User" → "C/F/MU": each class's initials (the full name in the cell's title) */
  const shortClass = (cls: string) => cls.split('/').map((c) => c.split(/[- ]/).map((w) => w[0] ?? '').join('').toUpperCase()).join('/')

  /** The roster to pick from, a row a character in columns (IMP-087); resolves to the one picked, or null. */
  function chooseFrom(title: string, list: StoredCharacter[]): Promise<StoredCharacter | null> {
    return new Promise((resolve) => {
      const rows = list.map((c) => {
        const p = parseCharacter(c.sav)
        // a character seeded from a save slot that came with the game keeps its slot stem (CHRDAT<x><n>): say which
        return { p, slot: /^CHRDAT([A-J])\d$/i.exec(c.stem)?.[1]?.toUpperCase() ?? '' }
      })
      // Status and Save only when some row has something to show there
      const status = rows.some((r) => r.p.raw[F.status] !== 0), slots = rows.some((r) => r.slot)
      const head = ['Name', 'Race', 'Class', 'Level', 'HP', 'AC', ...(status ? ['Status'] : []), ...(slots ? ['Save'] : [])]
      const body = rows.map(({ p, slot }, i) => `<tr data-i="${i}">
        <td class="nm"><button data-i="${i}">${escape(p.name)}</button></td><td>${escape(p.race)}</td><td title="${escape(p.cls)}">${escape(shortClass(p.cls))}</td>
        <td class="n" data-h="Level">${p.levels.map((l) => l.level).join('/')}</td><td class="n" data-h="HP">${p.hp}/${p.hpMax}</td><td class="n" data-h="AC">${p.ac}</td>
        ${status ? `<td>${escape(p.status)}</td>` : ''}${slots ? `<td data-h="Save">${slot}</td>` : ''}</tr>`).join('')
      dialog.innerHTML = `<h2>${title}</h2>${list.length
        ? `<div class="rosterwrap"><table class="roster"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`
        : '<p class="muted">No characters to add.</p>'}<form method="dialog"><button>Cancel</button></form>`
      const stop = onClose(dialog, () => resolve(null))
      const choose = (i: number) => { stop(); dialog.close(); resolve(list[i]) }
      // the whole row picks; the name's button is there for the keyboard
      dialog.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => tr.addEventListener('click', () => choose(Number(tr.dataset.i))))
      parchmentPanel(dialog, 'newchar-panel') // the party screen's tools in the parchment look (IMP-096)
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('tbody button')?.focus()
    })
  }

  function confirm(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      dialog.innerHTML = `<p>${escape(text)}</p><form method="dialog" class="yn">${wordButton('value="y" class="primary"', word('yesNo', 'Y'))}${wordButton('value="n"', word('yesNo', 'N'))}</form>`
      onClose(dialog, () => resolve(dialog.returnValue === 'y'))
      parchmentPanel(dialog, 'newchar-panel') // the party screen's tools in the parchment look (IMP-096)
      dialog.showModal()
    })
  }

  /** A vertical list ("Pick Race" etc.); resolves to the index, or null on Exit/Esc (abandons creation). */
  function pick(title: string, items: string[]): Promise<number | null> {
    return new Promise((resolve) => {
      let done = false
      dialog.innerHTML = `<h2>${title}</h2><ol class="pick">${items.map((t, i) =>
        `<li><button data-i="${i}">${escape(t)}</button></li>`).join('')}</ol><form method="dialog">${listExit('')}</form>`
      const stop = onClose(dialog, () => { if (!done) resolve(null) })
      dialog.querySelectorAll<HTMLButtonElement>('ol button').forEach((b) => b.addEventListener('click', () => {
        done = true
        stop()
        dialog.close()
        resolve(Number(b.dataset.i))
      }))
      parchmentPanel(dialog, 'newchar-panel') // the party screen's tools in the parchment look (IMP-096)
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('ol button')?.focus()
    })
  }

  /** Character creation (FUN_417f_056c; spec/A-games/engine/chargen-and-progression.md) on one screen (IMP-040). */
  function create(t: Tables): Promise<Uint8Array | null> {
    return createCharacter(dialog, files, dice, t)
  }

  /** an icon in the battle palette: PoR's and CotAB's editor swaps EGA registers 0 and 8 while it runs (0x3504A); SotSB's battles keep the plain palette */
  function paintIcon(canvas: HTMLCanvasElement, p: Picture | null) {
    const w = Number(canvas.getAttribute('width')), h = Number(canvas.getAttribute('height'))
    const g2 = sizeCanvas(canvas, w, h)
    const pal = battlePalette(files.game.view.combatSwap)
    g2.fillStyle = `rgb(${pal[0].join(',')})`
    g2.fillRect(0, 0, w, h)
    if (p) blit(g2, toImageData(p, pal), 0, 0)
  }

  /** Combat icon editor (FUN_417f_382d), as one panel; returns false if cancelled. */
  function iconEditor(c: Uint8Array): Promise<boolean> {
    const kept = c.slice(F.iconHead, F.iconColours + 6)
    const iw = iconWords(), PARTS = iw.parts
    let part = 0
    return new Promise((resolve) => {
      let done = false
      dialog.innerHTML = `<h2>Combat icon</h2>
        <div class="icons">
          <figure><canvas class="pixel ic" width="24" height="24"></canvas><canvas class="pixel ic" width="24" height="24"></canvas><figcaption>old: ready, action</figcaption></figure>
          <figure><canvas class="pixel ic" width="24" height="24"></canvas><canvas class="pixel ic" width="24" height="24"></canvas><figcaption>new: ready, action</figcaption></figure>
        </div>
        <div class="iconctl">
          <span>${escape(iw.head)}</span><button data-x="head-">◀</button><output data-o="head"></output><button data-x="head+">▶</button>
          <span>${escape(iw.weapon)}</span><button data-x="weapon-">◀</button><output data-o="weapon"></output><button data-x="weapon+">▶</button>
          <span>${escape(iw.size)}</span><button data-x="size" class="wide"></button>
        </div>
        <div class="parts">${PARTS.map((n, i) => `<button data-part="${i}">${n}</button>`).join('')}</div>
        <div class="palette"><span>${escape(iw.colour1)}</span>${EGA.map((rgb, i) => `<button class="sw" data-c1="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
        <div class="palette"><span>${escape(iw.colour2)}</span>${EGA.map((rgb, i) => `<button class="sw" data-c2="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
        <form method="dialog" class="yn">${wordButton('value="e"', word('iconEdit', 'E'))}${wordButton('value="k" class="primary"', word('iconEdit', 'K'))}</form>`
      const [o1, o2, n1, n2] = [...dialog.querySelectorAll<HTMLCanvasElement>('canvas.ic')]
      const old = c.slice()
      paintIcon(o1, buildIcon(files, old, false))
      paintIcon(o2, buildIcon(files, old, true))
      const draw = () => {
        paintIcon(n1, buildIcon(files, c, false))
        paintIcon(n2, buildIcon(files, c, true))
        dialog.querySelector('[data-o="head"]')!.textContent = String(c[F.iconHead])
        dialog.querySelector('[data-o="weapon"]')!.textContent = String(c[F.iconBody])
        dialog.querySelector('[data-x="size"]')!.textContent = iw.sizeName(c[F.iconSize])
        dialog.querySelectorAll<HTMLButtonElement>('[data-part]').forEach((b) => b.classList.toggle('on', Number(b.dataset.part) === part))
        dialog.querySelectorAll<HTMLButtonElement>('[data-c1]').forEach((b) => b.classList.toggle('on', Number(b.dataset.c1) === (c[F.iconColours + part] & 0xf)))
        dialog.querySelectorAll<HTMLButtonElement>('[data-c2]').forEach((b) => b.classList.toggle('on', Number(b.dataset.c2) === c[F.iconColours + part] >> 4))
      }
      const onClick = (e: MouseEvent) => {
        const b = (e.target as HTMLElement).closest('button')
        if (!b || b.closest('form')) return
        e.preventDefault()
        const x = b.dataset.x
        if (x === 'head+') c[F.iconHead] = (c[F.iconHead] + 1) % 14
        else if (x === 'head-') c[F.iconHead] = (c[F.iconHead] + 13) % 14
        else if (x === 'weapon+') c[F.iconBody] = (c[F.iconBody] + 1) % 32
        else if (x === 'weapon-') c[F.iconBody] = (c[F.iconBody] + 31) % 32
        else if (x === 'size') c[F.iconSize] = c[F.iconSize] === 2 ? 1 : 2
        else if (b.dataset.part) part = Number(b.dataset.part)
        else if (b.dataset.c1) c[F.iconColours + part] = (c[F.iconColours + part] & 0xf0) | Number(b.dataset.c1)
        else if (b.dataset.c2) c[F.iconColours + part] = (c[F.iconColours + part] & 0x0f) | (Number(b.dataset.c2) << 4)
        draw()
      }
      dialog.addEventListener('click', onClick)
      onClose(dialog, () => {
        dialog.removeEventListener('click', onClick)
        if (done) return
        done = true
        const keep = dialog.returnValue === 'k'
        if (!keep) c.set(kept, F.iconHead)
        resolve(keep)
      })
      draw()
      parchmentPanel(dialog, 'newchar-panel') // the party screen's tools in the parchment look (IMP-096)
      dialog.showModal()
    })
  }

  /** Modify character (FUN_417f_209f): abilities and HP, only before any experience. */
  function modify(c: Uint8Array): Promise<boolean> {
    const before = c.slice()
    const FIELDS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA', 'HP']
    let field = 0
    return new Promise((resolve) => {
      const t = tables!
      const draw = () => {
        const rows = FIELDS.map((n, f) => {
          const v = f === 6 ? c[F.maxHp] : c[F.stat[f]]
          const pct = f === 0 && c[F.stat[0]] === 18 && c[F.strPct] ? `/${String(c[F.strPct] % 100).padStart(2, '0')}` : ''
          const range = f === 6 ? `${hpMin(t, c)}–${hpMax(t, c)}` : abilityRange(t, c, f).join('–')
          return `<tr class="${f === field ? 'current' : ''}" data-f="${f}"><th>${n}</th>
            <td><button data-d="-1" aria-label="lower ${n}">−</button></td><td class="v">${v}${pct}</td>
            <td><button data-d="1" aria-label="raise ${n}">+</button></td><td class="muted">${range}</td></tr>`
        }).join('')
        dialog.querySelector('tbody')!.innerHTML = rows
      }
      dialog.innerHTML = `<h2>Modify ${escape(parseCharacter(c).name)}</h2>
        <table class="modify"><tbody></tbody></table>
        <form method="dialog" class="yn">${wordButton('value="e"', word('modify', 'E'))}${wordButton('value="k" class="primary"', word('modify', 'K'))}</form>`
      dialog.querySelector('tbody')!.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('button')
        const row = (e.target as HTMLElement).closest('tr')
        if (!row) return
        field = Number(row.dataset.f)
        if (b) modifyStep(t, c, field, Number(b.dataset.d) as 1 | -1)
        draw()
      })
      const onArrow = (e: KeyboardEvent) => {
        if (!dialog.open) return
        const k = e.key
        if (k === 'ArrowDown' || k === '2') field = (field + 1) % 7
        else if (k === 'ArrowUp' || k === '8') field = (field + 6) % 7
        else if (k === 'ArrowRight' || k === '6') modifyStep(t, c, field, 1)
        else if (k === 'ArrowLeft' || k === '4') modifyStep(t, c, field, -1)
        else return
        e.preventDefault()
        e.stopPropagation()
        draw()
      }
      window.addEventListener('keydown', onArrow, true)
      onClose(dialog, async () => {
        window.removeEventListener('keydown', onArrow, true)
        const kept = dialog.returnValue === 'k'
        if (kept) {
          c[F.npcShare] = 1
          c[F.hp] = c[F.maxHp]
          combatStats(c)
        } else c.set(before)
        resolve(kept)
      })
      draw()
      parchmentPanel(dialog, 'newchar-panel') // the party screen's tools in the parchment look (IMP-096)
      dialog.showModal()
    })
  }

  return { chooseFrom, confirm, pick, create, iconEditor, modify }
}
