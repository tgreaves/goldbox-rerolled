// The original sound driver (in START.EXE; where, from the game's profile) emulated tick by tick,
// and the PC speaker (8253 timer channel 2 + port 61h) it drives. A port of the reference
// renderer; format and behaviour in spec/A-games/engine/sound.md.

import { game } from '../games/profile'
import type { SoundDriver } from '../games/sound'

const PIT_HZ = 1193182
const TICK_DIV = 0x13b1 // timer interrupt every 5041 PIT clocks: 236.7 Hz
export const TICK_MS = (TICK_DIV * 1000) / PIT_HZ

// driver variables, tables and command handlers, CS-relative in PoR's driver; a game whose driver is
// moved adds its shift (games/sound.ts; CotAB −0xBD, spec/A-games/coab/assets.md "Sound driver")
const OFFSETS = {
  V_BUSY: 0x1d8, V_CHLOOP: 0x1d9, V_STRUCTSZ: 0x1da, V_EFFECT: 0x1ff, V_CURCH: 0x201,
  V_CHBASE: 0x203, V_FREQTAB: 0x205, V_RETADDR: 0x207, V_CHEFFECT: 0x209, V_ENABLE: 0x20d,
  V_JUMPTAB: 0x221, V_PCSEL: 0x3c5,
  PC_CHAN: 0x22d, PC_FREQ: 0x3ad, PC_TABLE: 0x55f,
  TY_CHAN: 0x3c7, TY_FREQ: 0x547, TY_TABLE: 0x607,
  J_FA: 0x164e, J_FB: 0x16ac, J_FC: 0x16b3, J_FD: 0x1645, J_FE: 0x162e, J_FF: 0x167f,
}
const TANDY_CLOCK = 3579545
export const NUM_EFFECTS = 21

const s16 = (v: number) => ((v & 0xffff) << 16) >> 16

class Driver {
  readonly m = new Uint8Array(0x10000)
  out42: number[] = []
  port61 = 0

  /** the driver's offsets in this game (PoR's plus the game's shift) */
  readonly c: Record<string, number>

  constructor(image: Uint8Array, drv: SoundDriver = game().sound) {
    this.m.set(image.subarray(drv.segment, drv.segment + 0x10000))
    this.c = Object.fromEntries(Object.entries(OFFSETS).map(([k, v]) => [k, v + drv.shift]))
  }

  b(a: number) { return this.m[a & 0xffff] }
  sb(a: number, v: number) { this.m[a & 0xffff] = v & 0xff }
  w(a: number) { a &= 0xffff; return this.m[a] | (this.m[(a + 1) & 0xffff] << 8) }
  sw(a: number, v: number) {
    a &= 0xffff
    this.m[a] = v & 0xff
    this.m[(a + 1) & 0xffff] = (v >> 8) & 0xff
  }

  /** CS:1742 (PC speaker) / CS:17AE (Tandy): start effect index e (= effect number - 1). */
  start(e: number, tandy = false) {
    const table = tandy ? this.c.TY_TABLE : this.c.PC_TABLE
    this.sw(this.c.V_EFFECT, e)
    let si = (e * 8) & 0xffff
    this.sb(this.c.V_BUSY, 1)
    this.sb(this.c.V_CHLOOP, 4)
    let di = tandy ? this.c.TY_CHAN : this.c.PC_CHAN
    for (;;) {
      const ax = this.w(table + si)
      if (ax !== 0) {
        for (let bx = 0x2e; bx >= 0; bx -= 2) this.sw(di + bx, 0)
        this.sw(di + 2, ax)
        this.sb(this.c.V_CHEFFECT + (4 - this.b(this.c.V_CHLOOP)), this.w(this.c.V_EFFECT))
        this.sw(di, 1)
      }
      di += 0x30
      si += 2
      this.sb(this.c.V_CHLOOP, this.b(this.c.V_CHLOOP) - 1)
      if (this.b(this.c.V_CHLOOP) === 0) break
    }
    this.sb(this.c.V_BUSY, 0)
  }

  snWrites: number[] = []

  /** CS:13EA timer interrupt: PC speaker part (CS:1477), then Tandy part (CS:14EC). */
  tick() {
    this.out42 = []
    this.snWrites = []
    if (this.b(this.c.V_BUSY) !== 0) return
    this.sb(this.c.V_BUSY, 1)
    this.pcTick()
    this.tandyTick()
    this.sb(this.c.V_BUSY, 0)
  }

  private pcTick() {
    let bl = 0
    if (this.w(this.c.V_EFFECT) !== 0) {
      this.sw(this.c.V_PCSEL, 0)
      this.sb(this.c.V_CHLOOP, 4)
      this.sw(this.c.V_FREQTAB, this.c.PC_FREQ)
      let si = this.c.PC_CHAN
      this.sw(this.c.V_CHBASE, si)
      for (;;) {
        if (this.w(si) !== 0) {
          this.step(si)
          if (this.w(this.c.V_PCSEL) === 0 && this.w(si + 0xa) !== 0 && this.w(si) !== 0) this.sw(this.c.V_PCSEL, si)
        }
        si += 0x30
        this.sb(this.c.V_CHLOOP, this.b(this.c.V_CHLOOP) - 1)
        if (this.b(this.c.V_CHLOOP) === 0) break
      }
      bl = this.b(this.c.V_ENABLE)
      if (bl !== 0) {
        const sel = this.w(this.c.V_PCSEL)
        if (sel === 0) bl = 0
        else {
          this.out42.push(this.w(sel + 8))
          bl = this.w(sel + 0xa) & 3
        }
      }
    }
    this.port61 = (this.port61 & 0xfc) | bl
  }

  /** CS:14EC: step the Tandy channels and write all four SN76489 voices. */
  private tandyTick() {
    const silence = [0x9f, 0xbf, 0xdf, 0xff]
    if (this.w(this.c.V_EFFECT) === 0) { this.snWrites.push(...silence); return }
    this.sb(this.c.V_CHLOOP, 4)
    this.sw(this.c.V_FREQTAB, this.c.TY_FREQ)
    let si = this.c.TY_CHAN
    this.sw(this.c.V_CHBASE, si)
    for (;;) {
      if (this.w(si) !== 0) this.step(si)
      si += 0x30
      this.sb(this.c.V_CHLOOP, this.b(this.c.V_CHLOOP) - 1)
      if (this.b(this.c.V_CHLOOP) === 0) break
    }
    if (this.b(this.c.V_ENABLE) === 0) { this.snWrites.push(...silence); return }
    si = this.c.TY_CHAN
    let dl = 0x80
    for (let v = 0; v < 4; v++) {
      const ax = (this.w(si + 8) >> 2) & 0xffff
      this.snWrites.push(((ax & 0xff) >> 4) ^ dl)
      if (dl !== 0xe0) this.snWrites.push(ax >> 8)
      const att = ((0xffff - this.w(si + 0xa)) & 0xffff) >> 12
      this.snWrites.push(((att ^ dl) + 0x10) & 0xff)
      dl += 0x20
      si += 0x30
    }
  }

  /** CS:157A: one channel step. */
  private step(si: number) {
    this.sw(si + 0xa, this.w(si + 0xa) + this.w(si + 0xc))
    this.sw(si + 0x4, this.w(si + 0x4) + this.w(si + 0x6))
    let dx = 0
    let ax = (this.w(si + 0x1e) + this.w(si + 0x20)) & 0xffff
    if (ax !== 0) {
      if (ax >= this.w(si + 0x24)) ax = (ax - this.w(si + 0x24)) & 0xffff
      this.sw(si + 0x1e, ax)
      const di = ((s16(ax) >> 4) + this.w(si + 0x1c)) & 0xffff
      const sample = s16(this.b(di) << 8)
      const prod = sample * s16(this.w(si + 0x22))
      dx = Math.floor(prod / 65536) & 0xffff
    }
    this.sw(si + 0x8, dx + this.w(si + 0x4))
    if (this.w(si + 0x14) !== 0) {
      this.sw(si + 0x14, this.w(si + 0x14) - 1)
      if (this.w(si + 0x14) === 0) {
        this.sw(si + 0x18, 0x10)
        this.sw(si + 0x1a, 1)
      }
    }
    this.sw(si, this.w(si) - 1)
    if (this.w(si) === 0) this.parse(si)
    if (this.w(si + 0x1a) !== 0) {
      this.sw(si + 0x1a, this.w(si + 0x1a) - 1)
      if (this.w(si + 0x1a) === 0) {
        for (;;) {
          const bx = (this.w(si + 0x16) + this.w(si + 0x18)) & 0xffff
          if (this.w(bx + 2) === 0xffff) {
            const v = this.w(bx)
            this.sw(si + 0xa, v)
            if (v === 0) this.sw(si + 0xc, 0)
            this.sw(si + 0x18, this.w(si + 0x18) + 4)
            continue
          }
          this.sw(si + 0xc, this.w(bx))
          this.sw(si + 0x1a, this.w(bx + 2))
          this.sw(si + 0x18, this.w(si + 0x18) + 4)
          break
        }
      }
    }
  }

  /** CS:160B: bytecode interpreter. */
  private parse(si: number) {
    let di = this.w(si + 2)
    if (di === 0) return
    this.sw(this.c.V_CURCH, si)
    let state: 'fetch' | 'note' | 'note1' | 'finish' = 'fetch'
    let bl = 0
    for (let guard = 0; ; guard++) {
      if (guard > 100000) throw new Error('sound bytecode runaway')
      if (state === 'fetch') {
        bl = this.b(di)
        di = (di + 1) & 0xffff
        if (bl < 0xfa) { state = 'note'; continue }
        const target = this.w(this.c.V_JUMPTAB + (bl - 0xfa) * 2)
        if (target === this.c.J_FA) this.reset(si) // FA
        else if (target === this.c.J_FB) di = this.w(this.c.V_RETADDR) // FB
        else if (target === this.c.J_FC) { // FC
          const a = this.w(di)
          di = (di + 2) & 0xffff
          this.sw(this.c.V_RETADDR, di)
          di = a
        } else if (target === this.c.J_FD) { // FD
          si = (this.w(di) + this.w(this.c.V_CHBASE)) & 0xffff
          di = (di + 2) & 0xffff
          this.reset(si)
        } else if (target === this.c.J_FE) { // FE
          const f = this.b(di)
          di = (di + 1) & 0xffff
          const a = this.w(di)
          di = (di + 2) & 0xffff
          if (this.w(si + f) !== 0) {
            this.sw(si + f, this.w(si + f) - 1)
            if (this.w(si + f) === 0) continue
          }
          di = a
        } else if (target === this.c.J_FF) { // FF
          const f = this.b(di)
          di = (di + 1) & 0xffff
          const a = this.w(di)
          di = (di + 2) & 0xffff
          this.sw(si + f, a)
          if (f === 0) state = 'finish'
        } else throw new Error(`sound: unexpected jump target ${target.toString(16)}`)
      } else if (state === 'note1') {
        bl = this.b(di)
        di = (di + 1) & 0xffff
        state = 'note'
      } else if (state === 'note') {
        const saved = di
        const cl = bl >> 5
        const tgt = (cl * this.b(this.c.V_STRUCTSZ) + this.w(this.c.V_CHBASE)) & 0xffff
        const tempo = this.w(si + 0xe) & 0xff
        this.sw(si, tempo <= 1 ? this.b(saved + 1) : tempo * this.b(saved + 1))
        let a = this.b(saved) & 0x7f
        if (a !== 0x7f && cl === 0) {
          const cx = this.w(si)
          this.sw(tgt, cx)
          this.sw(tgt + 0x14, cx)
          a = (a + this.w(tgt + 0x12)) & 0xffff
          this.sw(tgt + 0x18, 0)
          this.sw(tgt + 0x1a, 1)
          let octave = 0xff
          for (;;) {
            octave = (octave + 1) & 0xff
            const borrow = a < 12
            a = (a - 12) & 0xffff
            if (borrow) break
          }
          a = (a + 12) & 0xffff
          let v = this.w((a * 2 + this.w(this.c.V_FREQTAB)) & 0xffff)
          v = octave < 16 ? v >> octave : 0
          this.sw(tgt + 4, v)
          this.sw(tgt + 8, v)
        }
        di = saved
        const al = this.b(di)
        di = (di + 2) & 0xffff
        state = al & 0x80 ? 'finish' : 'note1'
      } else {
        si = this.w(this.c.V_CURCH)
        if (this.w(si) === 0) {
          this.sb(this.c.V_CHEFFECT + ((4 - this.b(this.c.V_CHLOOP)) & 0xff), 0)
          di = 0
        }
        this.sw(si + 2, di)
        return
      }
    }
  }

  private reset(si: number) {
    for (const f of [4, 6, 8, 0xa, 0xc, 0x10, 0x12, 0x16, 0x18, 0x1a, 0x1c, 0x1e, 0x20, 0x22, 0x24]) this.sw(si + f, 0)
  }

  active(tandy = false) {
    const base = tandy ? this.c.TY_CHAN : this.c.PC_CHAN
    for (let c = 0; c < 4; c++) if (this.w(base + c * 0x30) !== 0) return true
    return false
  }
}

/** 8253 channel 2 in mode 3 driving the speaker; a new count loads at the end of the half-cycle. */
class Pit2 {
  private cr: number | null = null
  private gate = 0
  private out = 1
  private running = false
  private nextEdge = 0
  private curHalf = 1
  private spk = 0
  readonly events: [number, number][] = []

  private half(level: number) {
    const n = this.cr || 0x10000
    if (n & 1) return level ? (n + 1) / 2 : (n - 1) / 2
    return n / 2
  }

  private emit(t: number) {
    const lvl = this.spk && this.out ? 1 : 0
    if (!this.events.length || this.events[this.events.length - 1][1] !== lvl) this.events.push([t, lvl])
  }

  advance(t: number) {
    while (this.running && this.nextEdge <= t) {
      const te = this.nextEdge
      this.out ^= 1
      this.emit(te)
      this.curHalf = Math.max(1, this.half(this.out))
      this.nextEdge = te + this.curHalf
    }
  }

  private start(t: number) {
    this.running = true
    this.out = 1
    this.emit(t)
    this.curHalf = Math.max(1, this.half(1))
    this.nextEdge = t + this.curHalf
  }

  writeCount(t: number, n: number) {
    const first = this.cr === null
    this.cr = n
    if (this.gate && (first || !this.running)) this.start(t)
  }

  write61(t: number, v: number) {
    const g = v & 1
    this.spk = (v >> 1) & 1
    if (g && !this.gate) {
      this.gate = 1
      if (this.cr !== null) this.start(t)
    } else if (!g && this.gate) {
      this.gate = 0
      this.running = false
      this.out = 1
    }
    this.emit(t)
  }
}

/**
 * Render effect n (1-21) as the PC speaker would play it, at `rate` Hz.
 * cut: stop after this many timer ticks, as the game's default play mode does (about 0.1 s).
 */
export function renderEffect(image: Uint8Array, n: number, rate: number, cut?: number): Float32Array {
  const d = new Driver(image)
  const pit = new Pit2()
  d.start(n - 1)
  let last = 0
  for (let k = 0; k < 2400; k++) {
    const t = k * TICK_DIV
    pit.advance(t)
    if (cut !== undefined && k >= cut) {
      pit.write61(t, 0)
      last = k
      break
    }
    d.tick()
    for (const v of d.out42) pit.writeCount(t, v)
    pit.write61(t, d.port61)
    last = k + 1
    if (!d.active()) break
  }
  const tEnd = last * TICK_DIV + Math.floor(0.02 * PIT_HZ)
  pit.advance(tEnd)
  // box-filter the 0/1 speaker level into samples, then a DC blocker (the speaker is AC coupled)
  const n2 = Math.ceil((tEnd * rate) / PIT_HZ) + 1
  const acc = new Float32Array(n2)
  const clkPer = PIT_HZ / rate
  const ev = [...pit.events, [tEnd, pit.events.length ? pit.events[pit.events.length - 1][1] : 0] as [number, number]]
  for (let i = 0; i < ev.length - 1; i++) {
    const [t0, lvl] = ev[i]
    const t1 = ev[i + 1][0]
    if (t1 <= t0 || !lvl) continue
    const a = t0 / clkPer, b = t1 / clkPer
    for (let s = Math.floor(a); s < b && s < n2; s++) acc[s] += Math.min(b, s + 1) - Math.max(a, s)
  }
  const r = 1 - (2 * Math.PI * 10) / rate
  let px = -1, py = 0
  const out = new Float32Array(n2)
  for (let i = 0; i < n2; i++) {
    const x = 2 * acc[i] - 1
    py = x - px + r * py
    px = x
    out[i] = py * 0.35
  }
  return out
}

/**
 * Texas Instruments SN76489 as in the Tandy 1000 / PCjr: three square-wave voices and a noise
 * channel, 2 dB attenuation steps. An approximation: the Tandy chip's noise taps may differ
 * (spec/A-games/engine/sound.md).
 */
class SN76489 {
  private reg = [0, 0xf, 0, 0xf, 0, 0xf, 0, 0xf] // tone0, att0, tone1, att1, tone2, att2, noise, att3
  private latch = 0
  private cnt = [1, 1, 1, 1]
  private out = [1, 1, 1, 1]
  private lfsr = 0x4000
  private readonly vol = [...Array.from({ length: 15 }, (_, i) => 10 ** ((-2 * i) / 20)), 0]

  write(v: number) {
    let r: number
    if (v & 0x80) {
      this.latch = (v >> 4) & 7
      r = this.latch
      this.reg[r] = r === 0 || r === 2 || r === 4 ? (this.reg[r] & 0x3f0) | (v & 0xf) : v & 0xf
    } else {
      r = this.latch
      this.reg[r] = r === 0 || r === 2 || r === 4 ? (this.reg[r] & 0xf) | ((v & 0x3f) << 4) : v & 0xf
    }
    if (r === 6) this.lfsr = 0x4000 // a write to the noise register resets the shift register
  }

  private shift() {
    const fb = this.reg[6] & 4 ? (this.lfsr ^ (this.lfsr >> 1)) & 1 : this.lfsr & 1
    this.lfsr = (this.lfsr >> 1) | (fb << 14)
  }

  /** One internal clock (master / 16); returns the mixed output. */
  clock(): number {
    for (let ch = 0; ch < 3; ch++) {
      if (--this.cnt[ch] <= 0) {
        this.cnt[ch] = this.reg[ch * 2] & 0x3ff || 0x400
        this.out[ch] ^= 1
        if (ch === 2 && (this.reg[6] & 3) === 3 && this.out[2]) this.shift()
      }
    }
    if ((this.reg[6] & 3) !== 3 && --this.cnt[3] <= 0) {
      this.cnt[3] = 0x10 << (this.reg[6] & 3)
      this.out[3] ^= 1
      if (this.out[3]) this.shift()
    }
    let s = 0
    for (let ch = 0; ch < 3; ch++) s += this.vol[this.reg[ch * 2 + 1]] * (this.out[ch] ? 1 : -1)
    s += this.vol[this.reg[7]] * (this.lfsr & 1 ? 1 : -1)
    return s / 4
  }
}

/** Render effect n on the Tandy / PCjr sound chip (same driver, Tandy tables). */
export function renderTandy(image: Uint8Array, n: number, rate: number, cut?: number): Float32Array {
  const d = new Driver(image)
  const sn = new SN76489()
  for (const v of [0x9f, 0xbf, 0xdf, 0xff]) sn.write(v)
  d.start(n - 1, true)
  const internal = TANDY_CLOCK / 16
  const perTick = (internal * TICK_DIV) / PIT_HZ
  const perSample = internal / rate
  const acc: number[] = []
  let clocks = 0, due = 0
  for (let k = 0; k < 2400; k++) {
    if (cut !== undefined && k >= cut) break
    d.tick()
    for (const v of d.snWrites) sn.write(v)
    due += perTick
    while (clocks < due) {
      const v = sn.clock()
      const idx = Math.floor(clocks / perSample)
      while (acc.length <= idx) acc.push(0)
      acc[idx] += v / perSample
      clocks++
    }
    if (!d.active(true)) break
  }
  for (let i = 0; i < Math.floor(0.02 * rate); i++) acc.push(0)
  const r = 1 - (2 * Math.PI * 10) / rate
  let px = 0, py = 0
  const out = new Float32Array(acc.length)
  for (let i = 0; i < acc.length; i++) {
    py = acc[i] - px + r * py
    px = acc[i]
    out[i] = py * 2.5 * 0.875
  }
  return out
}
