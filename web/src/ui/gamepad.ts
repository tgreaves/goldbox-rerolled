// Controller support (IMP-090; spec/C-port/ui-contract.md §6.5). A standard-mapping gamepad is read every
// frame while one is connected and turned into the keys the screens already answer, so no screen has its
// own controller code: the D-pad and left stick are the arrow keys (diagonals PageUp, PageDown, End and
// Home, the battle's), A Enter, B Escape (closing a dialog no screen closed), X Space, Y "v". Where a screen does not use an arrow, it moves
// the focus to the nearest button that way instead, and A then presses the focused button; LB and RB step
// through the buttons in order. The right stick scrolls, Start opens ☰ and Select is the battle's All on
// Quick / Take control button.

/** standard mapping (https://w3c.github.io/gamepad/#remapping) */
const A = 0, B = 1, X = 2, Y = 3, LB = 4, RB = 5, SELECT = 8, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15
const DEAD = 0.5
/** a held direction or button repeats after this long, then this often (ms) */
const DELAY = 380, REPEAT = 150

let running = false
const held = new Map<string, number>() // what is held → when it fires next

/** Start reading controllers when the first one connects; nothing runs without one. */
export function startGamepad() {
  if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return
  window.addEventListener('gamepadconnected', () => { if (!running) { running = true; requestAnimationFrame(poll) } })
  // the focus ring shows only while the controller is in use
  for (const ev of ['pointerdown', 'pointermove', 'keydown'] as const) {
    window.addEventListener(ev, (e) => { if (!(e as Event & { pad?: boolean }).pad) document.documentElement.classList.remove('pad') }, true)
  }
}

/** the controllers connected now, for Settings */
export function gamepads(): Gamepad[] {
  try { return [...navigator.getGamepads()].filter((p): p is Gamepad => !!p && p.connected) } catch { return [] }
}

function poll(now: number) {
  const pads = gamepads()
  if (!pads.length) { running = false; held.clear(); return }
  const down = new Set<string>()
  let scroll = 0
  for (const p of pads) {
    const b = (i: number) => !!p.buttons[i]?.pressed
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0
    const up = b(UP) || ay < -DEAD, dn = b(DOWN) || ay > DEAD, lf = b(LEFT) || ax < -DEAD, rt = b(RIGHT) || ax > DEAD
    const dir = up && rt ? 'PageUp' : dn && rt ? 'PageDown' : dn && lf ? 'End' : up && lf ? 'Home'
      : up ? 'ArrowUp' : dn ? 'ArrowDown' : lf ? 'ArrowLeft' : rt ? 'ArrowRight' : null
    if (dir) down.add(dir)
    for (const [i, name] of [[A, 'A'], [B, 'B'], [X, 'X'], [Y, 'Y'], [LB, 'LB'], [RB, 'RB'], [START, 'Start'], [SELECT, 'Select']] as const) if (b(i)) down.add(name)
    const ry = p.axes[3] ?? 0
    if (Math.abs(ry) > 0.2) scroll += ry
  }
  for (const k of [...held.keys()]) if (!down.has(k)) held.delete(k)
  for (const k of down) {
    const next = held.get(k)
    if (next === undefined) { held.set(k, now + DELAY); press(k) }
    else if (now >= next && repeats(k)) { held.set(k, now + REPEAT); press(k) }
  }
  if (scroll) scrollBy(scroll * 14)
  requestAnimationFrame(poll)
}

const repeats = (k: string) => k.startsWith('Arrow') || k.startsWith('Page') || k === 'End' || k === 'Home' || k === 'LB' || k === 'RB'

function press(k: string) {
  document.documentElement.classList.add('pad')
  switch (k) {
    case 'A': {
      const f = focused()
      if (f && !(f instanceof HTMLInputElement && f.type === 'text')) f.click()
      else key('Enter')
      return
    }
    case 'B': back(); return
    case 'X': key(' ', document.body); return
    case 'Y': key('v'); return
    case 'LB': step(-1); return
    case 'RB': step(1); return
    case 'Start': {
      const menu = visible(document.querySelector<HTMLElement>('.menu-btn'))
      if (menu && !openDialog()) menu.click()
      else back()
      return
    }
    case 'Select': visible(document.querySelector<HTMLElement>('.take-control'))?.click(); return
  }
  // a direction: the screen's own use of the key first; an arrow nobody used moves the focus
  if (!key(k) && k.startsWith('Arrow')) spatial(k)
}

/**
 * B: Escape, as the screens answer it; a dialog that no screen closed for it closes as the browser's own
 * Escape would close it (a made-up key press does not), through its cancel event.
 */
function back() {
  if (key('Escape')) return
  const d = openDialog()
  if (!d) return
  if (typeof d.requestClose === 'function') d.requestClose()
  else if (d.dispatchEvent(new Event('cancel', { cancelable: true }))) d.close()
}

/** A key as the screens see it; true when one of them took it (preventDefault). */
function key(k: string, at?: Element): boolean {
  const ev = new KeyboardEvent('keydown', { key: k, code: k === ' ' ? 'Space' : k, bubbles: true, cancelable: true })
  ;(ev as KeyboardEvent & { pad?: boolean }).pad = true
  ;(at ?? document.activeElement ?? document.body).dispatchEvent(ev)
  return ev.defaultPrevented
}

// ------------------------------------------------------------------ focus

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'

function openDialog(): HTMLDialogElement | null {
  const all = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')]
  return all[all.length - 1] ?? null
}
function visible<T extends HTMLElement>(el: T | null): T | null {
  if (!el || (el as unknown as HTMLButtonElement).disabled || el.closest('[hidden], [inert]')) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' ? el : null
}
/** what the controller can reach: the open dialog's controls, else the page's */
function candidates(): HTMLElement[] {
  const scope: ParentNode = openDialog() ?? document
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => visible(el))
}
function focused(): HTMLElement | null {
  const f = document.activeElement
  return f instanceof HTMLElement && f !== document.body && candidates().includes(f) ? f : null
}
function focus(el: HTMLElement | undefined) {
  if (!el) return
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
/** the first control when nothing has the focus: the game's menu (the command prompt), else a primary one, else the first */
function first(list: HTMLElement[]) {
  return list.find((el) => el.closest('.menu')) ?? list.find((el) => el.classList.contains('primary')) ?? list[0]
}

/** LB / RB: the previous or next control in page order */
function step(d: number) {
  const list = candidates(), f = focused()
  if (!f) { focus(first(list)); return }
  focus(list[(list.indexOf(f) + d + list.length) % list.length])
}

/** an arrow no screen used: the nearest control that way (distance along it, sideways counted double) */
function spatial(k: string) {
  const list = candidates(), f = focused()
  if (!f) { focus(first(list)); return }
  const r = f.getBoundingClientRect()
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2
  const [dx, dy] = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, number[]>)[k]
  let best: HTMLElement | undefined, bestScore = Infinity
  for (const el of list) {
    if (el === f) continue
    const o = el.getBoundingClientRect()
    const ox = o.left + o.width / 2, oy = o.top + o.height / 2
    const along = (ox - cx) * dx + (oy - cy) * dy
    if (along <= 1) continue
    const side = Math.abs((ox - cx) * dy) + Math.abs((oy - cy) * dx)
    const score = along + side * 2
    if (score < bestScore) { bestScore = score; best = el }
  }
  focus(best)
}

/** the right stick: the open dialog, else the page */
function scrollBy(px: number) {
  const d = openDialog()
  if (d) d.scrollTop += px
  else window.scrollBy(0, px)
}
