// An OPL2 (Yamaha YM3812, the AdLib card's chip) synthesiser for the AdLib music of later Gold Box
// games (Secret of the Silver Blades' title, spec/A-games/sotsb/music.md). Written for this port from
// the chip's documented behaviour (its register map, the rate, frequency, level and envelope rules of
// the YM3812 manual and the AdLib programming guide); no emulator's code is used. Where it simplifies
// the chip (arithmetic in floating point rather than the chip's log/exp tables, the rhythm-mode
// voices, the timers and CSM), spec/C-port/audio.md §6 says so.

/** The chip's sample rate: its 3.579545 MHz clock / 72. */
export const OPL_RATE = 3579545 / 72

/** the register offset of each channel's modulator; its carrier is 3 further */
const MOD_SLOT = [0x00, 0x01, 0x02, 0x08, 0x09, 0x0a, 0x10, 0x11, 0x12]
/** frequency multiple × 2 (MULT 0 is ½; 11 and 13 repeat 10 and 12, 15 repeats 14 as 15) */
const MULT2 = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 20, 24, 24, 30, 30]
/** the feedback modulation for FB 1–7, in cycles: π/16 … 4π */
const FEEDBACK = [0, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2]
/** the modulator's full-scale output shifts the carrier's phase by 4π (I: as the chip's phase input) */
const FM_DEPTH = 2
/** attenuation in dB at which an operator falls silent */
const SILENT = 96
/** attack and decay times (ms) of effective rate 4 (rate 1, no key scaling): the manual's tables */
const ATTACK_MS = 2826.24
const DECAY_MS = 39280.64

type Phase = 'off' | 'attack' | 'decay' | 'sustain' | 'release'

/** the time (ms) an envelope takes at effective rate r (4–63): halved every 4 steps, quartered between */
const rateMs = (base: number, r: number) => (base * 4) / (4 + (r & 3)) / 2 ** ((r >> 2) - 1)

class Operator {
  // register fields
  am = false; vib = false; sustainHold = false; ksr = false; mult = 1
  ksl = 0; tl = 0; ar = 0; dr = 0; sl = 0; rr = 0; wave = 0
  // state
  phase = 0
  env = SILENT
  state: Phase = 'off'
  keyed = false
  /** the last two outputs, for the modulator's feedback */
  prev = [0, 0]

  /** effective rate: 4R + the key-scaling offset, at most 63; 0 for R = 0 */
  rate(r: number, keycode: number) {
    if (r === 0) return 0
    return Math.min(63, 4 * r + (this.ksr ? keycode : keycode >> 2))
  }

  keyOn(on: boolean, keycode: number) {
    if (on && !this.keyed) {
      this.phase = 0
      const r = this.rate(this.ar, keycode)
      if (r >= 60) { this.env = 0; this.state = 'decay' } else this.state = 'attack'
    } else if (!on && this.keyed && this.state !== 'off') this.state = 'release'
    this.keyed = on
  }

  /** one sample of the envelope (dB of attenuation), from the rates and the key code */
  stepEnvelope(keycode: number) {
    const slDb = this.sl === 15 ? 93 : this.sl * 3
    switch (this.state) {
      case 'attack': {
        const r = this.rate(this.ar, keycode)
        if (r === 0) return
        if (r >= 60) { this.env = 0; this.state = 'decay'; return }
        // the attack falls exponentially in dB, from 96 dB to the floor in the rate's attack time
        const k = Math.log(960) / ((rateMs(ATTACK_MS, r) / 1000) * OPL_RATE)
        this.env -= this.env * k
        if (this.env < 0.1) { this.env = 0; this.state = 'decay' }
        return
      }
      case 'decay': {
        const r = this.rate(this.dr, keycode)
        if (r > 0) this.env += SILENT / ((rateMs(DECAY_MS, r) / 1000) * OPL_RATE)
        if (this.env >= slDb) { this.env = slDb; this.state = this.sustainHold ? 'sustain' : 'release' }
        return
      }
      case 'sustain': return
      case 'release': {
        const r = this.rate(this.rr, keycode)
        if (r > 0) this.env += SILENT / ((rateMs(DECAY_MS, r) / 1000) * OPL_RATE)
        if (this.env >= SILENT) { this.env = SILENT; this.state = 'off' }
        return
      }
      case 'off': return
    }
  }

  /** total attenuation (dB): envelope, total level (0.75 dB steps), key-scale level, tremolo */
  attenuation(kslDb: number, tremoloDb: number) {
    const ksl = [0, 0.5, 0.25, 1][this.ksl] * kslDb // KSL 1: 3 dB/oct, 2: 1.5, 3: 6 (bits 7–6 of 0x40)
    return this.env + this.tl * 0.75 + ksl + (this.am ? tremoloDb : 0)
  }
}

/** one cycle of waveform w at phase p (cycles) */
function waveform(w: number, p: number): number {
  const q = p - Math.floor(p)
  const s = Math.sin(2 * Math.PI * q)
  switch (w) {
    case 1: return s > 0 ? s : 0 // half sine
    case 2: return Math.abs(s) // absolute sine
    case 3: return (q < 0.25 || (q >= 0.5 && q < 0.75)) ? Math.abs(s) : 0 // quarter (pulse) sine
    default: return s
  }
}

/**
 * The OPL2: write registers, then render. Writes take effect from the next chip sample; a sequencer
 * renders up to a tick, writes, renders on (`renderWrites` does this for a timed list).
 */
export class Opl2 {
  private readonly ops = Array.from({ length: 0x16 }, () => new Operator())
  private readonly fnum = new Array(9).fill(0)
  private readonly block = new Array(9).fill(0)
  private readonly keyOnReg = new Array(9).fill(false)
  private readonly feedback = new Array(9).fill(0)
  private readonly additive = new Array(9).fill(false)
  private waveSelect = false
  private nts = false
  private deepAm = false
  private deepVib = false
  private rhythm = false
  private drums = 0
  private lfsr = 1
  private t = 0 // chip samples since the start, for the LFOs
  // resampling: the last two chip samples and the position between them
  private s0 = 0
  private s1 = 0
  private pos = 1

  /** the master gain applied to the mixed channels (9 full-scale channels would exceed 1) */
  gain = 0.15

  write(reg: number, value: number) {
    reg &= 0xff
    value &= 0xff
    const group = reg & 0xe0, o = reg & 0x1f
    if (reg === 0x01) { this.waveSelect = (value & 0x20) !== 0; return }
    if (reg === 0x08) { this.nts = (value & 0x40) !== 0; return } // CSM (bit 7) not emulated
    if (reg === 0xbd) {
      this.deepAm = (value & 0x80) !== 0
      this.deepVib = (value & 0x40) !== 0
      const was = this.rhythm
      this.rhythm = (value & 0x20) !== 0
      this.drums = value & 0x1f
      if (this.rhythm || was) this.keyDrums()
      return
    }
    if (group >= 0x20 && group <= 0x80 || group === 0xe0) {
      if (o > 0x15 || (o & 7) > 5) return // no operator at offsets 6, 7, 0xE, 0xF …
      const op = this.ops[o]
      switch (group) {
        case 0x20: op.am = !!(value & 0x80); op.vib = !!(value & 0x40); op.sustainHold = !!(value & 0x20); op.ksr = !!(value & 0x10); op.mult = MULT2[value & 15] / 2; break
        case 0x40: op.ksl = value >> 6; op.tl = value & 0x3f; break
        case 0x60: op.ar = value >> 4; op.dr = value & 15; break
        case 0x80: op.sl = value >> 4; op.rr = value & 15; break
        case 0xe0: op.wave = value & 3; break
      }
      return
    }
    const ch = reg & 0x0f
    if (ch > 8) return
    if (group === 0xa0 && reg < 0xb0) { this.fnum[ch] = (this.fnum[ch] & 0x300) | value; return }
    if (reg >= 0xb0 && reg <= 0xb8) {
      this.fnum[ch] = (this.fnum[ch] & 0xff) | ((value & 3) << 8)
      this.block[ch] = (value >> 2) & 7
      this.keyOnReg[ch] = (value & 0x20) !== 0
      this.keyChannel(ch)
      return
    }
    if (reg >= 0xc0 && reg <= 0xc8) { this.feedback[ch] = (value >> 1) & 7; this.additive[ch] = (value & 1) !== 0 }
    // 0x02–0x04, the timers, are not emulated: the port's sequencer keeps its own time
  }

  private keycode(ch: number) {
    const f = this.fnum[ch]
    return (this.block[ch] << 1) | (this.nts ? (f >> 8) & 1 : (f >> 9) & 1)
  }

  private keyChannel(ch: number) {
    const k = this.keycode(ch), m = MOD_SLOT[ch]
    if (this.rhythm && ch >= 6) { this.keyDrums(); return }
    this.ops[m].keyOn(this.keyOnReg[ch], k)
    this.ops[m + 3].keyOn(this.keyOnReg[ch], k)
  }

  /** rhythm mode: 0xBD bits 4–0 key bass drum (both operators of channel 6), snare (7's carrier),
   *  tom-tom (8's modulator), cymbal (8's carrier) and hi-hat (7's modulator), each or the channel's own key */
  private keyDrums() {
    const d = this.rhythm ? this.drums : 0
    const on = (ch: number, bit: number) => this.keyOnReg[ch] || (d & bit) !== 0
    const k6 = this.keycode(6), k7 = this.keycode(7), k8 = this.keycode(8)
    this.ops[0x10].keyOn(on(6, 0x10), k6); this.ops[0x13].keyOn(on(6, 0x10), k6)
    this.ops[0x11].keyOn(on(7, 0x01), k7); this.ops[0x14].keyOn(on(7, 0x08), k7)
    this.ops[0x12].keyOn(on(8, 0x04), k8); this.ops[0x15].keyOn(on(8, 0x02), k8)
  }

  /** key-scale level base for a channel (dB at 6 dB/octave): 6 dB an octave from the top 4 F-number bits */
  private kslDb(ch: number) {
    const n = this.fnum[ch] >> 6
    if (n === 0) return 0
    return Math.max(0, 18 + 6 * Math.log2(n) - 6 * (7 - this.block[ch]))
  }

  /** one chip sample */
  private sample(): number {
    const t = this.t++
    // LFOs: tremolo (≈3.7 Hz, 1 or 4.8 dB) and vibrato (≈6.1 Hz, 7 or 14 cents), both triangles
    const triangle = (period: number) => { const x = (t % period) / period; return x < 0.5 ? 2 * x : 2 - 2 * x }
    const tremoloDb = (this.deepAm ? 4.8 : 1) * triangle(13432)
    const vibCents = (this.deepVib ? 14 : 7) * (2 * triangle(8192) - 1)
    const vibFactor = 2 ** (vibCents / 1200)
    // the noise generator: a 23-bit shift register
    const bit = ((this.lfsr >> 22) ^ (this.lfsr >> 17)) & 1
    this.lfsr = ((this.lfsr << 1) | bit) & 0x7fffff
    const noise = bit ? 1 : -1

    let mix = 0
    const phaseOf = (op: Operator, ch: number) => {
      const inc = (this.fnum[ch] * 2 ** this.block[ch] * op.mult) / 2 ** 20
      op.phase += inc * (op.vib ? vibFactor : 1)
      if (op.phase >= 1) op.phase -= Math.floor(op.phase)
    }
    const level = (op: Operator, ch: number) => {
      op.stepEnvelope(this.keycode(ch))
      const att = op.attenuation(this.kslDb(ch), tremoloDb)
      return att >= SILENT ? 0 : 10 ** (-att / 20)
    }
    const wave = (op: Operator) => (this.waveSelect ? op.wave : 0)

    for (let ch = 0; ch < 9; ch++) {
      const mod = this.ops[MOD_SLOT[ch]], car = this.ops[MOD_SLOT[ch] + 3]
      phaseOf(mod, ch); phaseOf(car, ch)
      const ml = level(mod, ch), cl = level(car, ch)
      if (this.rhythm && ch === 7) {
        // hi-hat (modulator) and snare (carrier): noise mixed with the operators' own tones (approximated)
        const hh = ml * (0.5 * noise + 0.5 * metal(mod.phase, this.ops[0x15].phase))
        const sd = cl * (0.5 * waveform(wave(car), car.phase) + 0.5 * noise)
        mix += 2 * (hh + sd)
        continue
      }
      if (this.rhythm && ch === 8) {
        // tom-tom (modulator) a plain tone, cymbal (carrier) the metallic mix of 7's and 8's phases
        mix += 2 * (ml * waveform(wave(mod), mod.phase) + cl * metal(this.ops[0x11].phase, car.phase))
        continue
      }
      const fb = this.feedback[ch] ? FEEDBACK[this.feedback[ch]] * ((mod.prev[0] + mod.prev[1]) / 2) : 0
      const m = ml * waveform(wave(mod), mod.phase + fb)
      mod.prev[1] = mod.prev[0]; mod.prev[0] = m
      const c = cl * waveform(wave(car), car.phase + (this.additive[ch] ? 0 : FM_DEPTH * m))
      const out = this.additive[ch] ? m + c : c
      mix += this.rhythm && ch === 6 ? 2 * out : out // the bass drum's output is doubled
    }
    return mix * this.gain
  }

  /** Render `out.length` samples at `rate` (start..end), resampled linearly from the chip's rate. */
  generate(out: Float32Array, rate: number, start = 0, end = out.length) {
    const step = OPL_RATE / rate
    for (let i = start; i < end; i++) {
      while (this.pos >= 1) { this.s0 = this.s1; this.s1 = this.sample(); this.pos -= 1 }
      out[i] = this.s0 + (this.s1 - this.s0) * this.pos
      this.pos += step
    }
  }
}

/** a two-square ring of 7's modulator and 8's carrier phases: the cymbal's and hi-hat's metallic part (approximated) */
function metal(p7: number, p8: number) {
  const a = (p7 * 8) % 1 < 0.5, b = (p8 * 32) % 1 < 0.5
  return a !== b ? 1 : -1
}

/** A register write at a time (seconds from the start). */
export interface OplWrite { at: number; reg: number; value: number }

/** Render a timed list of writes (sorted by `at`) for `seconds` at `rate` into a buffer. */
export function renderWrites(writes: OplWrite[], seconds: number, rate: number, chip = new Opl2()): Float32Array {
  const out = new Float32Array(Math.ceil(seconds * rate))
  let at = 0
  for (const w of writes) {
    const i = Math.min(out.length, Math.round(w.at * rate))
    if (i > at) { chip.generate(out, rate, at, i); at = i }
    chip.write(w.reg, w.value)
  }
  chip.generate(out, rate, at, out.length)
  return out
}
