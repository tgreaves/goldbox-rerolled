// Character sheet dialog content, shared by the party screen and exploration.
import { MONEY, type Character } from '../data/character'
import { word, type MenuWord } from '../games/strings'

const STAT_KEYS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'] as const
export const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** a button with a game word, its hot key underlined (spec/D-appendices/strings.md §4.1) */
export function wordButton(attrs: string, w: MenuWord, before = ''): string {
  const t = before + w.text, k = w.key ? w.text.toUpperCase().indexOf(w.key[0]) : -1, j = k < 0 ? 0 : before.length + k
  return `<button ${attrs}>${escape(t.slice(0, j))}<u>${escape(t[j] ?? '')}</u>${escape(t.slice(j + 1))}</button>`
}
export const yesNo = (yesAttrs: string, noAttrs = 'data-a="cancel"') => wordButton(yesAttrs, word('yesNo', 'Y')) + wordButton(noAttrs, word('yesNo', 'N'))
export const listExit = (attrs: string) => wordButton(attrs, word('listExit', 'E'))

export function sheetHtml(c: Character): string {
  const str = c.stats.STR === 18 && c.strPct ? `/${String(c.strPct % 100).padStart(2, '0')}` : ''
  return `
    <h2>${escape(c.name)}</h2>
    <p>${c.gender} ${c.race} · age ${c.age}<br>${c.alignment}<br>${c.cls}${c.levels.length ? ' · level ' + c.levels.map((l) => l.level).join('/') : ''}</p>
    <div class="sheet">
      <table>${STAT_KEYS.map((k) => `<tr><th>${k}</th><td>${c.stats[k]}${k === 'STR' ? str : ''}</td></tr>`).join('')}</table>
      <table>
        <tr><th>HP</th><td>${c.hp} / ${c.hpMax}</td></tr>
        <tr><th>AC</th><td>${c.ac}</td></tr>
        <tr><th>THAC0</th><td>${c.thac0}</td></tr>
        <tr><th>Damage</th><td>${c.damage}</td></tr>
        <tr><th>Movement</th><td>${c.movement}</td></tr>
        <tr><th>Status</th><td>${c.status}</td></tr>
        <tr><th>Experience</th><td>${c.exp}</td></tr>
      </table>
      <table>${MONEY.map((m, i) => `<tr><th>${m}</th><td>${c.money[i]}</td></tr>`).join('')}</table>
    </div>`
}

/**
 * Run `fn` on the dialog's next real close. `dialog.close()` delivers its close event later, as a
 * task; when the next step has already reopened the dialog that late event must not end the new
 * step, so an event arriving while the dialog is open is ignored and the listener waits on.
 */
export function onClose(dialog: HTMLDialogElement, fn: () => void): () => void {
  const h = () => {
    if (dialog.open) return
    dialog.removeEventListener('close', h)
    fn()
  }
  dialog.addEventListener('close', h)
  return () => dialog.removeEventListener('close', h)
}
