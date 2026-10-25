// One Settings panel (IMP-046): game speed (in a game), sound device, font, window borders, the 3D view, the CRT look and text size. Speed is
// the game's own (saved with the game); the rest are per-browser conveniences in localStorage, which travel
// with an account when signed in (the Account section, IMP-072).
import { play, setSoundDevice, soundAvailable, soundDevice, unlockAudio, type Device } from '../audio/sfx'
import { fontChoice, gameFontAvailable, setFontChoice } from './gamefont'
import { frameChoice, framesAvailable, setFrameChoice, type FrameChoice } from './frames'
import { onClose, parchmentPanel } from './sheet'
import { gfxMode, savedGfx, setGfx, type Gfx } from '../render/upscale'
import { SYNCED_SETTINGS } from '../store/account'
import { localChanged } from '../store/changes'
import { mountAccount } from './account'
import { versionHtml } from '../version'
import { gamepads } from './gamepad'

const SIZE_KEY = 'poolrad.textsize'
const MOTION_KEY = 'poolrad.motion'
const PARTY_KEY = 'poolrad.partylayout'
const VIEW_KEY = 'poolrad.view'
export type PartyLayout = 'top' | 'side'
export type ViewMode = 'original' | 'enhanced'

let webgl2: boolean | undefined
/** whether this browser can draw the WebGL view (three.js needs WebGL 2), tested once */
function canDrawWorld(): boolean {
  if (webgl2 === undefined) {
    try { webgl2 = !!document.createElement('canvas').getContext('webgl2') } catch { webgl2 = false }
  }
  return webgl2
}
/**
 * The 3D view (decision D6, spec/C-port/exploration-view.md §1): the enhanced WebGL view (IMP-001, the
 * default) or the original's drawn view, pixel for pixel; the drawn view whatever the setting where the
 * browser has no WebGL 2.
 */
export function viewMode(): ViewMode {
  let stored: string | null = null
  try { stored = localStorage.getItem(VIEW_KEY) } catch { /* this page only */ }
  return stored !== 'original' && canDrawWorld() ? 'enhanced' : 'original'
}
function setViewMode(v: ViewMode) {
  try { localStorage.setItem(VIEW_KEY, v) } catch { /* this page only */ }
}

/** Where the party cards go (IMP-064): a row across the top, or the original's column beside the view. */
export function partyLayout(): PartyLayout {
  try { return localStorage.getItem(PARTY_KEY) === 'side' ? 'side' : 'top' } catch { return 'top' }
}
export function applyPartyLayout() {
  document.documentElement.classList.toggle('party-top', partyLayout() === 'top')
}
function setPartyLayout(p: PartyLayout) {
  try { localStorage.setItem(PARTY_KEY, p) } catch { /* this page only */ }
  applyPartyLayout()
}
export type Motion = 'full' | 'reduced'

/** Reduced motion (IMP-057): the title's lightning and the river's flashes are left out. Follows the system setting unless chosen here. */
export function motionChoice(): Motion {
  try {
    const v = localStorage.getItem(MOTION_KEY)
    if (v === 'full' || v === 'reduced') return v
  } catch { /* storage unavailable */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'
}
export const reducedMotion = () => motionChoice() === 'reduced'
function setMotion(m: Motion) {
  try { localStorage.setItem(MOTION_KEY, m) } catch { /* this page only */ }
}
export type TextSize = 'normal' | 'large'

export function textSize(): TextSize {
  try { return localStorage.getItem(SIZE_KEY) === 'large' ? 'large' : 'normal' } catch { return 'normal' }
}
export function applyTextSize() {
  document.documentElement.classList.toggle('text-large', textSize() === 'large')
}
function setTextSize(s: TextSize) {
  try { localStorage.setItem(SIZE_KEY, s) } catch { /* this page only */ }
  applyTextSize()
}

const SCREEN_KEY = 'poolrad.screen'
export type Screen = 'off' | 'scanlines' | 'crt'

/** The CRT look (IMP-089): off, scanlines over everything, or scanlines with a phosphor grille, darkened corners and glow. */
export function screenChoice(): Screen {
  try {
    const v = localStorage.getItem(SCREEN_KEY)
    if (v === 'scanlines' || v === 'crt') return v
  } catch { /* storage unavailable */ }
  return 'off'
}
export function applyScreen() {
  const v = screenChoice(), root = document.documentElement
  root.classList.toggle('screen-scan', v !== 'off')
  root.classList.toggle('screen-crt', v === 'crt')
}
function setScreen(v: Screen) {
  try { localStorage.setItem(SCREEN_KEY, v) } catch { /* this page only */ }
  applyScreen()
}

/** Controller (IMP-090): what is connected and what its buttons do; nothing to choose */
function controllerRow(): string {
  const pads = gamepads()
  const name = pads[0]?.id.replace(/\s*\(.*$/, '') || ''
  return `<div class="set-row"><span class="set-label">Controller</span><span class="muted">${pads.length
    ? `${name.replace(/[<>&]/g, '')}: D-pad or stick move and pick, A choose, B back, X continue, Y character, LB / RB next button, right stick scroll, Start menu, Select All on Quick / Take control in battle`
    : 'none connected: plug one in or press a button on it'}</span></div>`
}

export interface SettingsHost {
  /** the game speed 0 (fastest) – 9 (slowest), when a game is running */
  speed?: { get(): number; set(v: number): void }
  /** called after any change, e.g. to redraw a command bar */
  changed?(): void
}

export function openSettings(dialog: HTMLDialogElement, host: SettingsHost = {}): Promise<void> {
  const seg = <T extends string>(name: string, opts: [T, string][], cur: T) =>
    `<div class="set-row"><span class="set-label">${name}</span><div class="nc-opts">${opts.map(([v, l]) =>
      `<button type="button" data-${name.toLowerCase().replace(/\s/g, '')}="${v}" class="${v === cur ? 'on' : ''}">${l}</button>`).join('')}</div></div>`
  const render = () => {
    const sp = host.speed?.get()
    dialog.innerHTML = `<h2>Settings</h2>
      ${host.speed ? `<div class="set-row"><span class="set-label">Game speed</span><div class="nc-opts">
        <button type="button" data-speed="-1">Faster</button><output>${sp}</output><button type="button" data-speed="1">Slower</button>
        <span class="muted">0 fastest, 9 slowest: how long messages and hits hold in combat and scripts</span></div></div>` : ''}
      ${soundAvailable() ? seg<Device>('Sound', [['pc', 'PC speaker'], ['tandy', 'Tandy / PCjr'], ['off', 'Off']], soundDevice())
        : '<div class="set-row"><span class="set-label">Sound</span><span class="muted">needs START.EXE among the game files</span></div>'}
      ${gameFontAvailable() ? seg('Font', [['original', 'Original 8×8'], ['modern', 'Modern']], fontChoice()) : ''}
      ${framesAvailable() ? seg<FrameChoice>('Borders', [['original', 'Original'], ['modern', 'Plain']], frameChoice()) : ''}
      ${canDrawWorld() ? seg<ViewMode>('View', [['original', 'Original'], ['enhanced', 'Enhanced (3D)']], viewMode()) : ''}
      ${seg<PartyLayout>('Party', [['top', 'Row across the top'], ['side', 'Column beside the view']], partyLayout())}
      ${seg<Motion>('Motion', [['full', 'Full'], ['reduced', 'Reduced (no flashing)']], motionChoice())}
      ${seg<Screen>('Screen', [['off', 'Clean'], ['scanlines', 'Scanlines'], ['crt', 'CRT']], screenChoice())}
      ${seg<TextSize>('Text size', [['normal', 'Normal'], ['large', 'Large']], textSize())}
      ${seg<Gfx>('Graphics', [['pixel', 'Pixel (original)'], ['sharp', 'Sharp (even pixels, soft fit)']], savedGfx())}
      ${savedGfx() !== gfxMode() ? '<p class="message">The graphics change takes effect when the page reloads. <button type="button" data-reload="1">Reload now</button> (save first if you are in a game)</p>' : ''}
      ${controllerRow()}
      <section class="account-sec" aria-label="Account"></section>
      <p class="muted small version">${versionHtml()}</p>
      <form method="dialog"><button class="primary">Done</button></form>`
    mountAccount(dialog.querySelector<HTMLElement>('.account-sec')!)
  }
  // the settings that travel with an account (IMP-072): reported when the panel closes changed
  const snapshot = () => SYNCED_SETTINGS.map((k) => { try { return localStorage.getItem(k) } catch { return null } }).join('\n')
  const before = snapshot()
  return new Promise((resolve) => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest('button')
      if (!b || b.closest('form') || b.closest('.account-sec')) return
      e.preventDefault()
      const d = b.dataset
      if (d.speed && host.speed) host.speed.set(Math.max(0, Math.min(9, host.speed.get() + Number(d.speed))))
      else if (d.sound) { setSoundDevice(d.sound as Device); unlockAudio(); if (d.sound !== 'off') play(10, 'transient') }
      else if (d.font) setFontChoice(d.font as 'original' | 'modern')
      else if (d.borders) setFrameChoice(d.borders as FrameChoice)
      else if (d.textsize) setTextSize(d.textsize as TextSize)
      else if (d.motion) setMotion(d.motion as Motion)
      else if (d.party) setPartyLayout(d.party as PartyLayout)
      else if (d.view) setViewMode(d.view as ViewMode)
      else if (d.graphics) setGfx(d.graphics as Gfx)
      else if (d.screen) setScreen(d.screen as Screen)
      else if (d.reload) { location.reload(); return }
      host.changed?.()
      render()
    }
    dialog.addEventListener('click', onClick)
    onClose(dialog, () => {
      dialog.removeEventListener('click', onClick)
      if (snapshot() !== before) localChanged('docs/settings')
      resolve()
    })
    parchmentPanel(dialog, 'settings-panel') // IMP-097
    render()
    dialog.showModal()
  })
}
