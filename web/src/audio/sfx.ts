// Sound effects from the original driver: effect data is read from the player's START.EXE and
// rendered by an emulation of the driver and the PC speaker (src/audio/driver.ts, spec/sound.md).

import { renderEffect, renderTandy } from './driver'
import { unexepack } from '../data/exepack'

const KEY = 'poolrad.sound'
let ctx: AudioContext | null = null
let image: Uint8Array | null = null
/** The sound device, as chosen in the original's POOL.CFG ('P' PC speaker, 'T' Tandy/PCjr). */
export type Device = 'pc' | 'tandy' | 'off'
let device: Device = 'pc'
const cache = new Map<string, AudioBuffer>()
try {
  const v = localStorage.getItem(KEY)
  device = v === 'tandy' || v === 'off' ? v : 'pc'
} catch { /* storage unavailable: default PC speaker */ }

/** Load the driver data from START.EXE; returns false when it is missing or unreadable. */
export function initSound(startExe: Uint8Array | undefined): boolean {
  image = null
  cache.clear()
  if (!startExe) return false
  try {
    image = unexepack(startExe).image
    return true
  } catch {
    return false
  }
}

export const soundAvailable = () => image !== null
export const soundDevice = () => device

export function setSoundDevice(d: Device) {
  device = d
  try {
    localStorage.setItem(KEY, d)
  } catch { /* ignore */ }
}

/** Browsers only allow audio after a user gesture; call from input handlers. */
export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
  }
  if (ctx.state === 'suspended') ctx.resume()
}

/**
 * Play effect n. By default the game stops an effect after about 0.1 s: PlaySound waits
 * 10 centiseconds of BIOS time, which is 14-26 driver ticks depending on the clock phase.
 * full: play to the end (the game does this only in some sections, spec/sound.md).
 */
export function play(n: number, full = false) {
  if (device === 'off' || !ctx || !image) return
  const cut = full ? undefined : 14 + Math.floor(Math.random() * 13)
  const key = `${device}/${n}/${cut ?? 'full'}`
  let buf = cache.get(key)
  if (!buf) {
    const render = device === 'tandy' ? renderTandy : renderEffect
    const samples = render(image, n, ctx.sampleRate, cut)
    buf = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    cache.set(key, buf)
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
}
