// The start-up menu after the title sequence (games/startup.ts): the game's own title line and
// choices from START.EXE, as keys and taps. The original's menu answers the demo key itself when no
// key comes in time (CotAB DS:72B0 / DS:72B4, 0x51E1F), so an unattended game shows its demo again.
import type { GameFiles } from '../store/gamefiles'
import { startMenuText, type StartMenu } from '../games/startup'
import { unexepack } from '../data/exepack'
import { unlockAudio } from '../audio/sfx'

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)

/**
 * Shows the menu; `again` after a demo (the shorter timeout). Calls `play` or `demo` once. Escape and
 * Enter on Play play, as the original's menu returns 0 or the highlighted choice's key (0x51E8B,
 * 0x51E9D) and anything but the demo key starts the game (0x1C3).
 */
export function showStartMenu(app: HTMLElement, files: GameFiles, m: StartMenu, again: boolean, go: { play: () => void; demo: () => void }) {
  let img: Uint8Array | null = null
  try { const exe = files.get('START.EXE'); img = exe ? unexepack(exe).image : null } catch { img = null }
  // without START.EXE's strings the choices are named by their keys
  const text = startMenuText(img, m) ?? { title: files.game.name, choices: [{ label: 'Play', key: 'P' }, { label: 'Demo', key: m.demoKey }] }
  const label = (l: string, k: string) => { const i = l.indexOf(k); return i < 0 ? esc(l) : `${esc(l.slice(0, i))}<u>${esc(k)}</u>${esc(l.slice(i + 1))}` }
  const wait = again ? m.timeout.again : m.timeout.first
  app.innerHTML = `<section class="startmenu" aria-label="Start-up menu">
    <h1>${esc(text.title)}</h1>
    <div class="actions">${text.choices.map((c, i) => `<button data-key="${esc(c.key)}" class="${i === 0 ? 'primary' : ''}">${label(c.label, c.key)}</button>`).join('')}</div>
    ${wait > 0 ? `<p class="muted small">With no choice in ${Math.round(wait / 100)} seconds the ${esc(text.choices.find((c) => c.key === m.timeoutKey)?.label.toLowerCase() ?? 'demo')} starts.</p>` : ''}
  </section>`
  let done = false
  const timer = wait > 0 ? window.setTimeout(() => answer(m.timeoutKey), wait * 10) : null // hundredths of a second
  function answer(key: string) {
    if (done) return
    done = true
    if (timer !== null) clearTimeout(timer)
    window.removeEventListener('keydown', onKey)
    unlockAudio()
    if (key === m.demoKey) go.demo()
    else go.play()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key
    if (k === 'Escape') { e.preventDefault(); answer('') }
    else if (text.choices.some((c) => c.key === k)) { e.preventDefault(); answer(k) }
  }
  window.addEventListener('keydown', onKey)
  app.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.key!)))
  app.querySelector<HTMLButtonElement>('.startmenu button')?.focus()
}
