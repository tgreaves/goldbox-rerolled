// The title music's sequencer (Secret of the Silver Blades' SOUND.DAX song driver, spec/A-games/sotsb/music.md):
// a GLBR parts file of instruments followed by an SLBR song file, played on the AdLib (OPL2). This turns a
// song into the timed register writes the original driver makes, counter tick by counter tick (72.826 Hz,
// the sequencer on even ticks, §3), for the synthesiser (audio/opl2.ts) to render.

import { Opl2, renderWrites } from './opl2'
import { outputRate, playStream } from './sfx'

/** One OPL2 register write at a counter tick (1/72.826 s). */
export interface RegWrite { tick: number; reg: number; value: number }

/** the driver's timer: PIT divisor 0x4000 (§3) */
export const SONG_TICK_HZ = 1193182 / 16384

const be16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1]

/** operator register offsets by operator number − 1 (D:DC) */
const OPS = [0, 1, 2, 3, 4, 5, 8, 9, 0x0a, 0x0b, 0x0c, 0x0d, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15]
/** voice → operator number in rhythm mode (D:109; voices 0–6 melodic) */
const VOICE_OP = [1, 2, 3, 7, 8, 9, 13, 17, 15, 18, 14]
/** F-number by semitone C … B (D:114) */
const FNUM = [0x157, 0x16d, 0x181, 0x198, 0x1b1, 0x1cb, 0x1e6, 0x203, 0x222, 0x243, 0x266, 0x28a]
/** the constant tempo (0x621) */
const TEMPO = 118

/** The AdLib's instruments (GLBR parts 0–7, 12 bytes each, §4.1) and the song file's offset. */
function parts(rec: Uint8Array): { instruments: Uint8Array[]; slbr: number } {
  if (String.fromCharCode(...rec.subarray(0, 4)) !== 'GLBR') throw new Error('not a GLBR parts file')
  const count = be16(rec, 10)
  let at = 12 + 2 * count
  const instruments: Uint8Array[] = []
  for (let n = 0; n < count; n++) {
    const size = be16(rec, 12 + 2 * n)
    if (n < 8) instruments.push(rec.subarray(at, at + size))
    at += size
  }
  return { instruments, slbr: be16(rec, 4) << 16 | be16(rec, 6) }
}

/** a duration byte's length in tempo units (0x629, 16-bit integer arithmetic) */
function units(b: number): number {
  let base = 0x6900 >> (b & 7)
  if (b & 8) base = ((base >> 1) * 3) & 0xffff
  if (b & 0x30) { const m = (b & 0x30) >> 3; base = (Math.floor(base / (m + 1)) * m) & 0xffff }
  return base
}

interface Slot { time: number; p: number; frac: number; vol: number; state: number; voice: number; inst: number }

/**
 * Song `n` of a SOUND.DAX record (GLBR + SLBR) as the AdLib register writes of the original driver, from
 * the initialiser (tick 0) to the stop after the last track ends (§2, §5). Played once, effect set 0 (the
 * title's: no echo, no doubling).
 */
export function songWrites(rec: Uint8Array, n = 0): RegWrite[] {
  const { instruments, slbr } = parts(rec)
  const s0 = slbr || 0x1b2
  const songs = rec[s0 + 8]
  if (n >= songs) return []
  const table = s0 + 10, after = table + 2 * (songs + 1)
  const song = after + be16(rec, table + 2 * n)
  const startVol = rec[song + 2], tracks = rec[song + 3]
  const out: RegWrite[] = []
  let tick = 0
  const w = (reg: number, value: number) => out.push({ tick, reg, value: value & 0xff })

  // the AdLib's start (0x11DB): rhythm mode on, note-select, sine waveforms, waveform select off
  w(0xbd, 0x20); w(0x08, 0x40)
  for (const op of OPS) w(0xe0 + op, 0)
  w(0x01, 0)

  let used = 0 // voices taken (D:39C)
  const slots: Slot[] = []
  // tracks 1 … t − 1 in slots 0 …; the counter's first non-zero value (1) starts them (§5, Start)
  for (let i = 1; i < tracks; i++) slots.push({ time: 1, p: song + 0x0e + be16(rec, song + 4 + 2 * i), frac: 0, vol: startVol, state: 3, voice: i - 1, inst: 0 })

  const opsOf = (v: number) => { const m = VOICE_OP[v]; return { mod: OPS[m - 1], car: OPS[m + 2] } }
  const assign = (k: number, s: Slot) => { // §5.1
    used &= ~(1 << s.voice)
    const inst = k < 4 ? k : 1
    const ins = instruments[inst]
    let v = ins[1]
    if (!v) { v = 0; while (v < 7 && used & (1 << v)) v++ }
    used |= 1 << v
    s.voice = v; s.inst = inst
    const { mod, car } = opsOf(v)
    for (const [op, x] of [[mod, 0], [car, 1]]) {
      w(0xbd, 0x20); w(0x08, 0x40)
      w(0x40 + op, ins[4 + x])
      if (x === 0) w(0xc0 + v, ins[10])
      w(0x60 + op, ins[6 + x]); w(0x80 + op, ins[8 + x]); w(0x20 + op, ins[2 + x])
    }
  }
  const noteOn = (s: Slot, note: number, vol: number) => { // §5.2, §5.3 (vol < 0: off)
    const ch = s.voice, ins = instruments[s.inst]
    w(0xa0 + ch, 0x4a); w(0xb0 + ch, 0x0e)
    if (vol < 0) return
    const tl = (0x3f - (((0x3f - (ins[5] & 0x3f)) * vol) >> 7)) | (ins[5] & 0xc0)
    w(0x40 + opsOf(ch).car, tl)
    const semi = note % 12, block = Math.min(7, Math.max(0, Math.floor(note / 12) - 1)), f = FNUM[semi]
    w(0xa0 + ch, f & 0xff)
    w(0xb0 + ch, ((f >> 8) & 3) | (block << 2) | 0x20)
  }
  const off = (s: Slot) => { if (s.state < 3) noteOn(s, 0, -1); s.state = 3 }

  for (tick = 2; tick < 1 << 20; tick += 2) { // the sequencer on even counter values (§3)
    let ended = false
    slots.forEach((s, k) => {
      if (!s.time || s.time > tick) return
      if (s.state === 0) { noteOn(s, 0, -1); s.state = 3; s.time += 1; return }
      while (rec[s.p] > 0x80 && rec[s.p] !== 0xff) {
        if (rec[s.p] === 0x81) { off(s); assign(k, s) } else if (rec[s.p] === 0x84) s.vol = 0x7f
        s.p += 2
      }
      const a = rec[s.p], b = rec[s.p + 1]
      if (a === 0xff) { s.time = 0; off(s); ended = true; return }
      const u = units(b)
      s.time += Math.floor(u / TEMPO); s.frac += u % TEMPO
      if (s.frac >= TEMPO) { s.time += 1; s.frac -= TEMPO }
      if (a === 0x80) off(s)
      else {
        if (s.state !== 2) { if (s.state < 3) noteOn(s, 0, -1); noteOn(s, a, s.vol) }
        if (b & 0x40) s.state = 2
        else if (rec[s.p + 2] === a) { s.time -= 1; s.state = 0 }
        else s.state = 1
      }
      s.p += 2
    })
    if (ended && slots.every((s) => !s.time)) { // §5.4: stop
      for (let ch = 0; ch < 9; ch++) w(0xb0 + ch, 0x0e)
      w(0xbd, 0x20)
      break
    }
  }
  return out
}

/** The song's writes as audio at `rate` (audio/opl2.ts), to the last write and two seconds of release. */
export function renderSong(writes: RegWrite[], rate: number): Float32Array {
  const end = (writes.at(-1)?.tick ?? 0) / SONG_TICK_HZ + 2
  return renderWrites(writes.map((x) => ({ at: x.tick / SONG_TICK_HZ, reg: x.reg, value: x.value })), end, rate)
}

/** The song as audio at `rate`, a chunk of `size` samples per call (null at the end): what playSong streams. */
export function songChunks(writes: RegWrite[], rate: number, size = rate): () => Float32Array | null {
  const chip = new Opl2()
  const end = Math.ceil(((writes.at(-1)?.tick ?? 0) / SONG_TICK_HZ + 2) * rate)
  let i = 0, pos = 0
  return () => {
    if (pos >= end) return null
    const len = Math.min(size, end - pos), out = new Float32Array(len)
    let at = 0
    for (; i < writes.length; i++) {
      const k = Math.round((writes[i].tick / SONG_TICK_HZ) * rate) - pos
      if (k >= len) break
      if (k > at) { chip.generate(out, rate, at, k); at = k }
      chip.write(writes[i].reg, writes[i].value)
    }
    chip.generate(out, rate, at, len)
    pos += len
    return out
  }
}

/**
 * Play song `n` of a SOUND.DAX record (the title music, spec/C-port/audio.md §7), rendered a second at a
 * time as it plays; returns the function that stops it (as the title's end does, the driver's Stop).
 */
export function playSong(rec: Uint8Array, n = 0): () => void {
  const rate = outputRate()
  return rate ? playStream(songChunks(songWrites(rec, n), rate)) : () => {}
}
