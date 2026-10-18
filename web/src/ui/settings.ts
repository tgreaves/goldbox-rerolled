// One Settings panel (IMP-046): game speed (in a game), sound device, font, window borders and text size. Speed is
// the game's own (saved with the game); the rest are per-browser conveniences in localStorage.
import { play, setSoundDevice, soundAvailable, soundDevice, unlockAudio, type Device } from '../audio/sfx'
import { fontChoice, gameFontAvailable, setFontChoice } from './gamefont'
import { frameChoice, framesAvailable, setFrameChoice, type FrameChoice } from './frames'
import { onClose } from './sheet'
import { gfxMode, savedGfx, setGfx, type Gfx } from '../render/upscale'

const SIZE_KEY = 'poolrad.textsize'
const MOTION_KEY = 'poolrad.motion'
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
      ${framesAvailable() ? seg<FrameChoice>('Borders', [['original', 'Original rope'], ['modern', 'Plain']], frameChoice()) : ''}
      ${seg<Motion>('Motion', [['full', 'Full'], ['reduced', 'Reduced (no flashing)']], motionChoice())}
      ${seg<TextSize>('Text size', [['normal', 'Normal'], ['large', 'Large']], textSize())}
      ${seg<Gfx>('Graphics', [['pixel', 'Pixel (original)'], ['sharp', 'Sharp (even pixels, soft fit)']], savedGfx())}
      ${savedGfx() !== gfxMode() ? '<p class="message">The graphics change takes effect when the page reloads. <button type="button" data-reload="1">Reload now</button> (save first if you are in a game)</p>' : ''}
      <form method="dialog"><button class="primary">Done</button></form>`
  }
  return new Promise((resolve) => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest('button')
      if (!b || b.closest('form')) return
      e.preventDefault()
      const d = b.dataset
      if (d.speed && host.speed) host.speed.set(Math.max(0, Math.min(9, host.speed.get() + Number(d.speed))))
      else if (d.sound) { setSoundDevice(d.sound as Device); unlockAudio(); if (d.sound !== 'off') play(10) }
      else if (d.font) setFontChoice(d.font as 'original' | 'modern')
      else if (d.borders) setFrameChoice(d.borders as FrameChoice)
      else if (d.textsize) setTextSize(d.textsize as TextSize)
      else if (d.motion) setMotion(d.motion as Motion)
      else if (d.graphics) setGfx(d.graphics as Gfx)
      else if (d.reload) { location.reload(); return }
      host.changed?.()
      render()
    }
    dialog.addEventListener('click', onClick)
    onClose(dialog, () => { dialog.removeEventListener('click', onClick); resolve() })
    render()
    dialog.showModal()
  })
}
