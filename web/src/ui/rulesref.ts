// The Rules reference (IMP-058): what the printed rule book and journal told players, in short, for
// the game as the port runs it (spec/). Opened from ☰.
import { R, bookSpell, casterClasses } from '../games/rules'
import type { SpellTables } from '../data/spells'
import { spellText } from '../rules/spelltext'
import { onClose } from './sheet'
import { game } from '../games/profile'

type Tab = 'basics' | 'classes' | 'combat' | 'spells' | 'keys'
let tab: Tab = 'basics'

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)
const dl = (rows: [string, string][]) => `<dl class="rules">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`

export function rulesReference(dialog: HTMLDialogElement, spells: SpellTables | null): Promise<void> {
  const render = () => {
    const tabs: [Tab, string][] = [['basics', 'Basics'], ['classes', 'Classes'], ['combat', 'Combat'], ['spells', 'Spells'], ['keys', 'Keys']]
    let body = ''
    const T = game().rulesText
    if (tab === 'basics') body = dl(T.basics)
    else if (tab === 'classes') body = dl(T.classes)
    else if (tab === 'combat') body = dl(T.combat)
    else if (tab === 'keys') body = dl(T.keys)
    else if (spells) {
      for (const { cls, name: title } of casterClasses()) for (let lvl = 1; lvl <= R.spells.levels; lvl++) {
        const list = spells.spells.filter((s) => bookSpell(s) && s.cls === cls && s.level === lvl)
        if (!list.length) continue
        body += `<h3>${title} level ${lvl}</h3>${dl(list.map((s) => [s.name, spellText(s)]))}`
      }
    } else body = '<p class="muted">The spell list needs START.EXE among the game files.</p>'
    dialog.innerHTML = `<h2>Rules reference</h2>
      <div class="nc-opts">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="rules-body">${body}</div>
      <form method="dialog"><button>Close</button></form>`
  }
  return new Promise((resolve) => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
      if (b) { tab = b.dataset.tab as Tab; render() }
    }
    dialog.addEventListener('click', onClick)
    onClose(dialog, () => { dialog.removeEventListener('click', onClick); resolve() })
    dialog.classList.add('wide')
    render()
    dialog.showModal()
  })
}
