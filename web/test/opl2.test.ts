// The OPL2 synthesiser (src/audio/opl2.ts; spec/C-port/audio.md §6) against the chip's documented
// behaviour: pitch from F-number and block, envelope times from the rate tables, levels in dB,
// waveforms, feedback, rhythm-mode noise, and determinism.
import { describe, expect, it } from 'vitest'
import { OPL_RATE, Opl2, renderWrites, type OplWrite } from '../src/audio/opl2'

const R = OPL_RATE

/** channel 0 as a single carrier tone: silent modulator, carrier AR 15, the given DR/SL/RR, sustain held */
function tone(o: { fnum: number; block: number; tl?: number; dr?: number; sl?: number; rr?: number; hold?: boolean; wave?: number; fb?: number; modTl?: number }): OplWrite[] {
  const w: [number, number][] = [
    [0x01, 0x20],
    [0x20, 0x01], [0x40, o.modTl ?? 0x3f], [0x60, 0xf0], [0x80, 0x00], // modulator: MULT 1, silent unless modTl
    [0x23, (o.hold ?? true ? 0x20 : 0) | 0x01], [0x43, o.tl ?? 0], [0x63, 0xf0 | (o.dr ?? 0)], [0x83, ((o.sl ?? 0) << 4) | (o.rr ?? 0)],
    [0xe3, o.wave ?? 0], [0xe0, 0], [0xc0, (o.fb ?? 0) << 1],
    [0xa0, o.fnum & 0xff], [0xb0, 0x20 | (o.block << 2) | (o.fnum >> 8)],
  ]
  return w.map(([reg, value]) => ({ at: 0, reg, value }))
}

const zeroCrossings = (s: Float32Array) => { let n = 0; for (let i = 1; i < s.length; i++) if ((s[i - 1] < 0) !== (s[i] < 0)) n++; return n }
const peak = (s: Float32Array, a: number, b: number) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(s[i])); return m }

describe('OPL2 synthesiser', () => {
  it('pitch: F-number 580, block 4 is 440 Hz (freq = fnum · 49716 / 2^(20 − block))', () => {
    const s = renderWrites(tone({ fnum: 580, block: 4 }), 1, R)
    const hz = zeroCrossings(s.subarray(Math.round(0.1 * R))) / 2 / 0.9
    expect(hz).toBeGreaterThan(436)
    expect(hz).toBeLessThan(444)
  })

  it('resamples to another output rate at the same pitch', () => {
    const s = renderWrites(tone({ fnum: 580, block: 4 }), 1, 44100)
    const hz = zeroCrossings(s.subarray(4410)) / 2 / 0.9
    expect(Math.abs(hz - 440)).toBeLessThan(4)
  })

  it('total level: TL 8 is 6 dB (half amplitude) below TL 0', () => {
    const a = peak(renderWrites(tone({ fnum: 580, block: 4 }), 0.2, R), 2000, 9000)
    const b = peak(renderWrites(tone({ fnum: 580, block: 4, tl: 8 }), 0.2, R), 2000, 9000)
    expect(b / a).toBeGreaterThan(0.48)
    expect(b / a).toBeLessThan(0.52)
  })

  it('decay: DR 8 at block 4 (rate 34) falls 48 dB in about 102 ms', () => {
    // effective rate 4·8 + (keycode 8 >> 2 = 2) = 34: 39 280 ms · 4/6 / 2^7 = 205 ms for 96 dB
    const s = renderWrites(tone({ fnum: 580, block: 4, dr: 8, sl: 15, hold: false }), 0.4, R)
    const ref = peak(s, 0, 200)
    const win = 120
    let t = -1
    for (let i = 200; i + win < s.length; i += win) if (peak(s, i, i + win) < ref * 10 ** (-48 / 20)) { t = i / R; break }
    expect(t).toBeGreaterThan(0.092)
    expect(t).toBeLessThan(0.113)
  })

  it('release: RR 6 after key-off silences the tone at the rate-table time', () => {
    const w = tone({ fnum: 580, block: 4, rr: 6 })
    w.push({ at: 0.1, reg: 0xb0, value: (4 << 2) | 2 }) // key off
    const s = renderWrites(w, 1.4, R)
    // rate 4·6 + 2 = 26: 39 280 · 4/6 / 2^5 = 818 ms for 96 dB; at 409 ms after key-off about −48 dB
    const ref = peak(s, Math.round(0.05 * R), Math.round(0.1 * R))
    const at = (sec: number) => peak(s, Math.round(sec * R), Math.round(sec * R) + 200) / ref
    expect(20 * Math.log10(at(0.1 + 0.409))).toBeGreaterThan(-53)
    expect(20 * Math.log10(at(0.1 + 0.409))).toBeLessThan(-43)
    expect(at(1.35)).toBe(0)
  })

  it('attack: AR 4 rises in about the rate-table time, exponentially (loud early)', () => {
    const w = tone({ fnum: 580, block: 4 })
    const i = w.findIndex((x) => x.reg === 0x63); w[i].value = 0x40 // AR 4: rate 18, 2826 · 4/6 / 2^3 = 236 ms
    const s = renderWrites(w, 0.5, R)
    const full = peak(s, Math.round(0.4 * R), Math.round(0.45 * R))
    expect(peak(s, Math.round(0.24 * R), Math.round(0.25 * R)) / full).toBeGreaterThan(0.95)
    expect(peak(s, Math.round(0.08 * R), Math.round(0.09 * R)) / full).toBeLessThan(0.5)
  })

  it('waveforms 1–3: half sine, absolute sine, quarter sine', () => {
    const s = (wave: number) => renderWrites(tone({ fnum: 580, block: 4, wave }), 0.1, R).subarray(500)
    const min = (a: Float32Array) => a.reduce((m, v) => Math.min(m, v), 0)
    const zeros = (a: Float32Array) => a.filter((v) => Math.abs(v) < 1e-4).length / a.length
    expect(min(s(1))).toBeGreaterThan(-1e-3)
    expect(zeros(s(1))).toBeGreaterThan(0.4)
    expect(min(s(2))).toBeGreaterThan(-1e-3)
    expect(zeros(s(2))).toBeLessThan(0.05)
    expect(zeros(s(3))).toBeGreaterThan(0.45)
    // without the waveform-select enable (register 1 bit 5) every operator is a sine
    const w = tone({ fnum: 580, block: 4, wave: 1 }); w[0].value = 0
    expect(min(renderWrites(w, 0.1, R).subarray(500))).toBeLessThan(-0.05)
  })

  it('feedback adds harmonics to the modulator heard alone (additive connection)', () => {
    const roughness = (fb: number) => {
      const w = tone({ fnum: 580, block: 4, tl: 0x3f, modTl: 0, fb })
      w.push({ at: 0, reg: 0xc0, value: (fb << 1) | 1 }) // additive: the modulator is heard
      const s = renderWrites(w, 0.1, R).subarray(500)
      let v = 0; for (let i = 1; i < s.length; i++) v += Math.abs(s[i] - s[i - 1])
      return v
    }
    expect(roughness(7)).toBeGreaterThan(roughness(0) * 1.3)
  })

  it('rhythm mode: the hi-hat is noise, not periodic', () => {
    const w: OplWrite[] = [
      [0x31, 0x01], [0x51, 0x00], [0x71, 0xf0], [0x91, 0x00], [0x35, 0x01], [0x55, 0x3f],
      [0xa7, 0x00], [0xb7, 0x0a], [0xa8, 0x00], [0xb8, 0x0a], [0xbd, 0x21],
    ].map(([reg, value]) => ({ at: 0, reg, value }))
    const s = renderWrites(w, 0.2, R).subarray(1000, 9000)
    const e = s.reduce((a, v) => a + v * v, 0)
    expect(e).toBeGreaterThan(0)
    let best = 0
    for (let lag = 1; lag < 2000; lag++) { let c = 0; for (let i = 0; i + lag < s.length; i++) c += s[i] * s[i + lag]; best = Math.max(best, c / e) }
    expect(best).toBeLessThan(0.6)
  })

  it('is deterministic for a fixed write sequence', () => {
    const w = tone({ fnum: 345, block: 5, modTl: 10, fb: 3 })
    w.push({ at: 0.05, reg: 0xbd, value: 0xc0 }, { at: 0.1, reg: 0xb0, value: 0x15 })
    const a = renderWrites(w, 0.3, 48000), b = renderWrites(w, 0.3, 48000)
    expect(a).toEqual(b)
  })

  it('ignores registers with no operator and keys channels independently', () => {
    const chip = new Opl2()
    for (const reg of [0x26, 0x27, 0x2e, 0x2f, 0x36, 0xa9, 0xb9, 0xc9]) chip.write(reg, 0xff)
    const out = new Float32Array(1000)
    chip.generate(out, R)
    expect(out.every((v) => v === 0)).toBe(true)
  })
})
