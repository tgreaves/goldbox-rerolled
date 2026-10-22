// Sound effects from the original driver: effect data is read from the player's START.EXE and
// rendered by an emulation of the driver and the PC speaker (src/audio/driver.ts, spec/A-games/engine/sound.md).

import { renderEffect, renderTandy } from './driver'
import { unexepack } from '../data/exepack'
import { game } from '../games/profile'
import type { SoundMode } from '../games/sound'

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

/** The driver ticks after which a transient effect stops, or undefined when it plays to its end. */
export function cutTick(mode: SoundMode, transient = game().sound.transient, rand = () => Math.random()): number | undefined {
  // PoR's PlaySound in transient mode waits delay(10) (10 cs of BIOS time), then stops the effect: the
  // second BIOS tick after the call, 14–26 driver ticks depending on the clock's phase (I); the phase
  // is presentation only, any generator (spec/C-port/audio.md §3.1)
  return mode === 'transient' && transient ? 14 + Math.floor(rand() * 13) : undefined
}

/** Ctrl-S has turned the sound off (the original's mode 2 with the device kept in DS:5373) */
let muted = false
/** the effects still sounding, so that Ctrl-S can stop them (PlaySound(0xFF)) */
const playing = new Set<AudioBufferSourceNode>()
export const soundMuted = () => muted

/**
 * Ctrl-S (PoR linear 0x189FE, CotAB 0x6841): the first press stops whatever plays and turns the sound off,
 * the next turns it back on with the device chosen; not kept between sessions (spec/C-port/audio.md §2).
 */
export function toggleMute(): boolean {
  muted = !muted
  if (muted) for (const s of [...playing]) { try { s.stop() } catch { /* already ended */ } }
  return muted
}

/** The audio context's sample rate, for rendering music to it (null before the first gesture). */
export const outputRate = () => ctx?.sampleRate ?? null

/**
 * Play rendered samples (the OPL2 music, src/audio/opl2.ts) as the effects are played: not with the
 * sound off or muted; Ctrl-S stops it. Returns a function that stops it.
 */
export function playSamples(samples: Float32Array): () => void {
  if (device === 'off' || muted || !ctx) return () => {}
  const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate)
  buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  playing.add(src)
  src.onended = () => playing.delete(src)
  src.start()
  return () => { try { src.stop() } catch { /* already ended */ } }
}

/** Play effect n as its call site does (`mode`, spec/C-port/audio.md §3). */
export function play(n: number, mode: SoundMode) {
  if (device === 'off' || muted || !ctx || !image) return
  const cut = cutTick(mode)
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
  playing.add(src)
  src.onended = () => playing.delete(src)
  src.start()
}
