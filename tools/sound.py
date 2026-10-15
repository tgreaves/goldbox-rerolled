#!/usr/bin/env python3
"""Pool of Radiance (DOS, 1988) sound-effect reference renderer.

Emulates the SSI sound driver in code segment 0x18AE (linear 0x18AE0) of
POOL_MERGED.EXE tick by tick, operating directly on a copy of that segment's
memory (so pointer arithmetic, FD channel switching, FE loops etc. behave
exactly like the original), and renders WAV files:

  effect_N.wav        PC speaker, effect N played to completion
  effect_N_short.wav  PC speaker, cut off after --cut ticks (the game's default
                      "transient" mode stops every effect after ~0.1 s; see
                      sound_driver.md)
  tandy_effect_N.wav  Tandy/PCjr SN76489 rendering (approximate chip model)

Usage: python3 render.py IMG.BIN [OUTDIR] [--ideal] [--cut TICKS] [--no-tandy]
       python3 render.py IMG.BIN --trace N      (print per-tick PC state)

IMG.BIN is either START.EXE (unpacked on the fly) or a flat memory image where
linear address L is at file offset L-0x10000 (the driver segment sits at offset
0x8AE0 in both). Format and behaviour: ../spec/sound.md. Python 3 stdlib only.
"""
import struct
import sys
import os
import wave
import math

SEG_LINEAR = 0x18AE0           # driver CS = paragraph 0x18AE (0x08AE unrelocated)
IMG_BASE = 0x10000             # img.bin file offset = linear - 0x10000

PIT_HZ = 1193182               # 14.31818 MHz / 12
TICK_DIV = 0x13B1              # PIT ch0 divisor programmed by CS:137C (5041)
TANDY_CLOCK = 3579545          # SN76489 master clock on Tandy 1000 / PCjr
RATE = 44100

# --- CS-relative driver variables ------------------------------------------
V_TICKDIV = 0x1D7   # byte: chains to BIOS INT 8 every 13 ticks
V_BUSY = 0x1D8      # byte: set while an effect is being started
V_CHLOOP = 0x1D9    # byte: channel loop counter 4..1 (channel index = 4 - it)
V_STRUCTSZ = 0x1DA  # byte: 0x30, channel struct size
V_EFFECT = 0x1FF    # word: current effect index (0 = nothing playing)
V_CURCH = 0x201     # word: channel struct being parsed
V_CHBASE = 0x203    # word: base of channel struct array for this device
V_FREQTAB = 0x205   # word: note -> divisor table (12 words)
V_RETADDR = 0x207   # word: return address for FC/FB (single global level)
V_CHEFFECT = 0x209  # 4 bytes: effect index per channel
V_ENABLE = 0x20D    # byte: sound on/off (effect 1 / effect 0 set it)
V_JUMPTAB = 0x221   # 6 words: handlers for opcodes FA..FF
V_PCSEL = 0x3C5     # word: PC speaker: channel chosen this tick

PC_CHAN = 0x22D     # 4 x 0x30 channel structs, PC speaker
PC_FREQ = 0x3AD     # 12-entry divisor table, PC speaker
TY_CHAN = 0x3C7     # 4 x 0x30 channel structs, Tandy
TY_FREQ = 0x547     # 12-entry table, Tandy
PC_TABLE = 0x55F    # effect table (8 bytes = 4 channel ptrs per effect), PC
TY_TABLE = 0x607    # effect table, Tandy
NUM_EFFECTS = 21    # table entries e = 0..20  <=>  effect numbers n = e+1


def s16(v):
    v &= 0xFFFF
    return v - 0x10000 if v & 0x8000 else v


class Driver:
    def __init__(self, img):
        off = SEG_LINEAR - IMG_BASE
        self.m = bytearray(img[off:off + 0x10000])
        self.m.extend(b'\0' * (0x10000 - len(self.m)))
        self.out42 = []      # PIT ch2 writes this tick
        self.port61 = 0
        self.sn_writes = []  # SN76489 bytes this tick

    # memory helpers (16-bit wrap like the 8086)
    def b(self, a):
        return self.m[a & 0xFFFF]

    def sb(self, a, v):
        self.m[a & 0xFFFF] = v & 0xFF

    def w(self, a):
        a &= 0xFFFF
        return self.m[a] | (self.m[(a + 1) & 0xFFFF] << 8)

    def sw(self, a, v):
        a &= 0xFFFF
        self.m[a] = v & 0xFF
        self.m[(a + 1) & 0xFFFF] = (v >> 8) & 0xFF

    # ---- CS:1742 (PC speaker) / CS:17AE (Tandy): start effect e -----------
    def start(self, e, tandy=False):
        table, chans = (TY_TABLE, TY_CHAN) if tandy else (PC_TABLE, PC_CHAN)
        self.sw(V_EFFECT, e)
        si = (e * 8) & 0xFFFF
        self.sb(V_BUSY, 1)
        self.sb(V_CHLOOP, 4)
        di = chans
        while True:
            ax = self.w(table + si)
            if ax != 0:
                for bx in range(0x2E, -1, -2):
                    self.sw(di + bx, 0)
                self.sw(di + 2, ax)
                idx = 4 - self.b(V_CHLOOP)
                self.sb(V_CHEFFECT + idx, self.w(V_EFFECT) & 0xFF)
                self.sw(di, 1)
            di += 0x30
            si += 2
            self.sb(V_CHLOOP, self.b(V_CHLOOP) - 1)
            if self.b(V_CHLOOP) == 0:
                break
        self.sb(V_BUSY, 0)

    # ---- CS:13EA timer ISR body ------------------------------------------
    def tick(self):
        self.out42 = []
        self.sn_writes = []
        if self.b(V_BUSY) == 0:
            self.sb(V_BUSY, 1)
            self.pc_tick()
            self.tandy_tick()
            self.sb(V_BUSY, 0)
        # CS:1458: every 13th tick chain to the BIOS handler (no audio effect)
        self.sb(V_TICKDIV, self.b(V_TICKDIV) - 1)
        if self.b(V_TICKDIV) == 0:
            self.sb(V_TICKDIV, 13)

    # ---- CS:1477 PC speaker --------------------------------------------
    def pc_tick(self):
        bl = 0
        if self.w(V_EFFECT) != 0:
            self.sw(V_PCSEL, 0)
            self.sb(V_CHLOOP, 4)
            self.sw(V_FREQTAB, PC_FREQ)
            si = PC_CHAN
            self.sw(V_CHBASE, si)
            while True:
                if self.w(si) != 0:
                    self.step(si)
                    if (self.w(V_PCSEL) == 0 and self.w(si + 0xA) != 0
                            and self.w(si) != 0):
                        self.sw(V_PCSEL, si)
                si += 0x30
                self.sb(V_CHLOOP, self.b(V_CHLOOP) - 1)
                if self.b(V_CHLOOP) == 0:
                    break
            bl = self.b(V_ENABLE)
            if bl != 0:
                sel = self.w(V_PCSEL)
                if sel == 0:
                    bl = 0
                else:
                    self.out42.append(self.w(sel + 8))
                    bl = self.w(sel + 0xA) & 3
        self.port61 = (self.port61 & 0xFC) | bl

    # ---- CS:14EC Tandy / PCjr SN76489 -----------------------------------
    def tandy_tick(self):
        if self.w(V_EFFECT) == 0:
            self.sn_writes += [0x9F, 0xBF, 0xDF, 0xFF]
            return
        self.sb(V_CHLOOP, 4)
        self.sw(V_FREQTAB, TY_FREQ)
        si = TY_CHAN
        self.sw(V_CHBASE, si)
        while True:
            if self.w(si) != 0:
                self.step(si)
            si += 0x30
            self.sb(V_CHLOOP, self.b(V_CHLOOP) - 1)
            if self.b(V_CHLOOP) == 0:
                break
        if self.b(V_ENABLE) == 0:
            self.sn_writes += [0x9F, 0xBF, 0xDF, 0xFF]
            return
        si = TY_CHAN
        dl = 0x80
        for _ in range(4):
            ax = (self.w(si + 8) >> 2) & 0xFFFF
            al = (ax & 0xFF) >> 4
            self.sn_writes.append(al ^ dl)
            if dl != 0xE0:
                self.sn_writes.append(ax >> 8)
            att = ((0xFFFF - self.w(si + 0xA)) & 0xFFFF) >> 12
            self.sn_writes.append(((att ^ dl) + 0x10) & 0xFF)
            dl += 0x20
            si += 0x30

    # ---- CS:157A per-channel step ---------------------------------------
    def step(self, si):
        self.sw(si + 0xA, self.w(si + 0xA) + self.w(si + 0xC))   # volume slope
        self.sw(si + 0x4, self.w(si + 0x4) + self.w(si + 0x6))   # pitch slide
        dx = 0
        ax = (self.w(si + 0x1E) + self.w(si + 0x20)) & 0xFFFF    # LFO phase
        if ax != 0:
            if ax >= self.w(si + 0x24):
                ax = (ax - self.w(si + 0x24)) & 0xFFFF
            self.sw(si + 0x1E, ax)
            di = ((s16(ax) >> 4) + self.w(si + 0x1C)) & 0xFFFF
            sample = s16(self.b(di) << 8)
            prod = sample * s16(self.w(si + 0x22))
            dx = (prod >> 16) & 0xFFFF
        self.sw(si + 0x8, dx + self.w(si + 0x4))                 # output divisor
        if self.w(si + 0x14) != 0:                               # note-off timer
            self.sw(si + 0x14, self.w(si + 0x14) - 1)
            if self.w(si + 0x14) == 0:
                self.sw(si + 0x18, 0x10)
                self.sw(si + 0x1A, 1)
        self.sw(si, self.w(si) - 1)                              # duration
        if self.w(si) == 0:
            self.parse(si)
        if self.w(si + 0x1A) != 0:                               # envelope
            self.sw(si + 0x1A, self.w(si + 0x1A) - 1)
            if self.w(si + 0x1A) == 0:
                while True:
                    bx = (self.w(si + 0x16) + self.w(si + 0x18)) & 0xFFFF
                    if self.w(bx + 2) == 0xFFFF:
                        ax = self.w(bx)
                        self.sw(si + 0xA, ax)
                        if ax == 0:
                            self.sw(si + 0xC, 0)
                        self.sw(si + 0x18, self.w(si + 0x18) + 4)
                        continue
                    self.sw(si + 0xC, self.w(bx))
                    self.sw(si + 0x1A, self.w(bx + 2))
                    self.sw(si + 0x18, self.w(si + 0x18) + 4)
                    break

    # ---- CS:160B bytecode interpreter -----------------------------------
    def parse(self, si):
        di = self.w(si + 2)
        if di == 0:
            return
        self.sw(V_CURCH, si)
        guard = 0
        state = 'fetch'
        bl = 0
        while True:
            guard += 1
            if guard > 100000:
                raise RuntimeError('bytecode runaway')
            if state == 'fetch':                      # CS:1618
                bl = self.b(di)
                di = (di + 1) & 0xFFFF
                if bl < 0xFA:
                    state = 'note'
                    continue
                target = self.w(V_JUMPTAB + (bl - 0xFA) * 2)
                if target == 0x164E:                  # FA: reset current channel
                    self.reset(si)
                elif target == 0x16AC:                # FB: return
                    di = self.w(V_RETADDR)
                elif target == 0x16B3:                # FC: call
                    ax = self.w(di)
                    di = (di + 2) & 0xFFFF
                    self.sw(V_RETADDR, di)
                    di = ax
                elif target == 0x1645:                # FD: select+reset channel
                    si = (self.w(di) + self.w(V_CHBASE)) & 0xFFFF
                    di = (di + 2) & 0xFFFF
                    self.reset(si)
                elif target == 0x162E:                # FE: loop on counter field
                    f = self.b(di)
                    di = (di + 1) & 0xFFFF
                    ax = self.w(di)
                    di = (di + 2) & 0xFFFF
                    if self.w(si + f) != 0:
                        self.sw(si + f, self.w(si + f) - 1)
                        if self.w(si + f) == 0:
                            continue
                    di = ax
                elif target == 0x167F:                # FF: set field
                    f = self.b(di)
                    di = (di + 1) & 0xFFFF
                    ax = self.w(di)
                    di = (di + 2) & 0xFFFF
                    self.sw(si + f, ax)
                    if f == 0:
                        state = 'finish'
                else:
                    raise RuntimeError('unexpected jump table entry %x' % target)
            elif state == 'note1':                    # CS:16C1
                bl = self.b(di)
                di = (di + 1) & 0xFFFF
                state = 'note'
            elif state == 'note':                     # CS:16C4
                saved = di
                cl = bl >> 5
                tgt = ((cl * self.b(V_STRUCTSZ)) + self.w(V_CHBASE)) & 0xFFFF
                bx = saved
                tempo = self.w(si + 0xE) & 0xFF
                if tempo <= 1:
                    dur = self.b(bx + 1)
                else:
                    dur = tempo * self.b(bx + 1)
                self.sw(si, dur)
                ax = self.b(bx) & 0x7F
                if ax != 0x7F and cl == 0:
                    cx = self.w(si)
                    self.sw(tgt, cx)
                    self.sw(tgt + 0x14, cx)
                    ax = (ax + self.w(tgt + 0x12)) & 0xFFFF
                    self.sw(tgt + 0x18, 0)
                    self.sw(tgt + 0x1A, 1)
                    octave = 0xFF
                    while True:
                        octave = (octave + 1) & 0xFF
                        borrow = ax < 12
                        ax = (ax - 12) & 0xFFFF
                        if borrow:
                            break
                    ax = (ax + 12) & 0xFFFF
                    val = self.w(((ax * 2) + self.w(V_FREQTAB)) & 0xFFFF)
                    val = val >> octave if octave < 16 else 0
                    self.sw(tgt + 4, val)
                    self.sw(tgt + 8, val)
                di = saved
                al = self.b(di)
                di = (di + 2) & 0xFFFF
                state = 'finish' if al & 0x80 else 'note1'
            elif state == 'finish':                   # CS:168F
                si = self.w(V_CURCH)
                if self.w(si) == 0:
                    idx = (4 - self.b(V_CHLOOP)) & 0xFF
                    self.sb(V_CHEFFECT + idx, 0)
                    di = 0
                self.sw(si + 2, di)
                return

    def reset(self, si):                              # CS:164E
        for f in (4, 6, 8, 0xA, 0xC, 0x10, 0x12, 0x16, 0x18, 0x1A, 0x1C,
                  0x1E, 0x20, 0x22, 0x24):
            self.sw(si + f, 0)

    def active(self, tandy=False):
        base = TY_CHAN if tandy else PC_CHAN
        return any(self.w(base + c * 0x30) != 0 for c in range(4))


# ---------------------------------------------------------------------------
# PC speaker: 8253 channel 2 in mode 3 + port 61h
# ---------------------------------------------------------------------------
class PIT2:
    """Event-driven 8253 counter 2, mode 3 (square wave), times in PIT clocks.

    ideal=False: a newly written count only takes effect at the end of the
    current half-cycle (8253/8254 mode 3 behaviour); gate rising edge reloads.
    ideal=True:  a new count takes effect immediately (phase kept)."""

    def __init__(self, ideal=False):
        self.ideal = ideal
        self.cr = None
        self.gate = 0
        self.out = 1
        self.running = False
        self.next_edge = None
        self.events = []      # (time, speaker level 0/1)
        self.spk = 0

    def _half(self, level):
        n = self.cr or 0x10000
        if n & 1:
            return (n + 1) // 2 if level else (n - 1) // 2
        return n // 2

    def _emit(self, t):
        lvl = 1 if (self.spk and self.out) else 0
        if not self.events or self.events[-1][1] != lvl:
            self.events.append((t, lvl))

    def advance(self, t):
        while self.running and self.next_edge is not None and self.next_edge <= t:
            te = self.next_edge
            self.out ^= 1
            self._emit(te)
            self._cur_half = max(1, self._half(self.out))
            self.next_edge = te + self._cur_half

    def _start(self, t):
        self.running = True
        self.out = 1
        self._emit(t)
        self._cur_half = max(1, self._half(1))
        self.next_edge = t + self._cur_half

    def write_count(self, t, n):
        first = self.cr is None
        self.cr = n
        if self.gate and (first or not self.running):
            self._start(t)
        elif self.ideal and self.running and self.next_edge is not None:
            # apply the new period immediately, keeping the phase fraction
            old_half = getattr(self, '_cur_half', None) or self._half(self.out)
            self.cr = n
            new_half = max(1, self._half(self.out))
            rem = self.next_edge - t
            self.next_edge = t + max(1, rem * new_half // max(1, old_half))

    def write_61(self, t, v):
        g, s = v & 1, (v >> 1) & 1
        self.spk = s
        if g and not self.gate:
            self.gate = 1
            if self.cr is not None:
                self._start(t)
        elif not g and self.gate:
            self.gate = 0
            self.running = False
            self.out = 1
        self._emit(t)


def render_events(events, t_end, rate=RATE):
    """Box-filter the 0/1 level timeline into samples, centred, DC-blocked."""
    n = int(math.ceil(t_end * rate / PIT_HZ)) + 1
    out = [0.0] * n
    clk_per = PIT_HZ / rate
    ev = events + [(t_end, events[-1][1] if events else 0)]
    for i in range(len(ev) - 1):
        t0, lvl = ev[i]
        t1 = ev[i + 1][0]
        if t1 <= t0 or not lvl:
            continue
        a, bnd = t0 / clk_per, t1 / clk_per
        s = int(a)
        while s < bnd and s < n:
            lo, hi = max(a, s), min(bnd, s + 1)
            out[s] += hi - lo
            s += 1
    # map 0/1 -> -1/+1 and apply a 1-pole DC blocker (speaker is AC coupled)
    r = 1.0 - 2 * math.pi * 10.0 / rate
    y = []
    px = -1.0
    py = 0.0
    for v in out:
        x = 2 * v - 1
        py = x - px + r * py
        px = x
        y.append(py)
    return y


def write_wav(path, samples, gain=0.4):
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        buf = bytearray()
        for v in samples:
            iv = int(max(-1.0, min(1.0, v * gain)) * 32767)
            buf += struct.pack('<h', iv)
        wf.writeframes(bytes(buf))


def load_image(path):
    """START.EXE (EXEPACK-packed) or a flat image -> load image bytes."""
    data = open(path, 'rb').read()
    if data[:2] != b'MZ':
        return data
    import subprocess, tempfile
    here = os.path.dirname(os.path.abspath(__file__))
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, 'start.exe')
        subprocess.run([sys.executable, os.path.join(here, 'unexepack.py'), path, out],
                       check=True, stdout=subprocess.DEVNULL)
        u = open(out, 'rb').read()
    return u[struct.unpack_from('<H', u, 8)[0] * 16:]


MAX_TICKS = 2400          # 10 s safety cap (infinite loops)


def run_pc(img, n, ideal=False, cut=None, trace=False):
    d = Driver(img)
    pit = PIT2(ideal)
    d.start(n - 1, tandy=False)
    k = 0
    last = 0
    while k < MAX_TICKS:
        t = k * TICK_DIV
        pit.advance(t)
        if cut is not None and k >= cut:
            pit.write_61(t, 0)          # game: effect 0/0xff + CS:13B1 cut-off
            last = k
            break
        d.tick()
        for v in d.out42:
            pit.write_count(t, v)
        pit.write_61(t, d.port61)
        if trace:
            sel = d.w(V_PCSEL)
            div = d.w(sel + 8) if sel else None
            print('tick %4d  t=%7.2fms  gate=%d  div=%s  f=%s' % (
                k, t * 1000 / PIT_HZ, d.port61 & 3, div,
                ('%.1fHz' % (PIT_HZ / (div or 65536))) if sel else '-'))
        k += 1
        last = k
        if not d.active(False):
            break
    t_end = last * TICK_DIV + int(0.02 * PIT_HZ)
    pit.advance(t_end)
    return render_events(pit.events, t_end), last


# ---------------------------------------------------------------------------
# Tandy / PCjr: approximate SN76489 model (tone N = 10 bit, f = clk/(32N))
# ---------------------------------------------------------------------------
class SN76489:
    def __init__(self):
        self.reg = [0] * 8          # tone0,att0,tone1,att1,tone2,att2,noise,att3
        self.reg[1] = self.reg[3] = self.reg[5] = self.reg[7] = 0xF
        self.latch = 0
        self.cnt = [1, 1, 1, 1]
        self.out = [1, 1, 1, 1]
        self.lfsr = 0x4000
        self.vol = [10 ** (-2 * i / 20) for i in range(15)] + [0.0]

    def write(self, v):
        if v & 0x80:
            self.latch = (v >> 4) & 7
            r = self.latch
            if r in (0, 2, 4):
                self.reg[r] = (self.reg[r] & 0x3F0) | (v & 0xF)
            else:
                self.reg[r] = v & 0xF
        else:
            r = self.latch
            if r in (0, 2, 4):
                self.reg[r] = (self.reg[r] & 0xF) | ((v & 0x3F) << 4)
            else:
                self.reg[r] = v & 0xF
        if r == 6:
            self.lfsr = 0x4000      # any noise-register write resets the LFSR

    def period(self, ch):
        if ch < 3:
            n = self.reg[ch * 2] & 0x3FF
            return n or 0x400
        return None

    def clock(self):
        """One internal clock (master/16). Returns mixed output."""
        for ch in range(3):
            self.cnt[ch] -= 1
            if self.cnt[ch] <= 0:
                self.cnt[ch] = self.period(ch)
                self.out[ch] ^= 1
                if ch == 2 and (self.reg[6] & 3) == 3 and self.out[2]:
                    self._shift()
        if (self.reg[6] & 3) != 3:
            self.cnt[3] -= 1
            if self.cnt[3] <= 0:
                self.cnt[3] = 0x10 << (self.reg[6] & 3)
                self.out[3] ^= 1
                if self.out[3]:
                    self._shift()
        s = 0.0
        for ch in range(3):
            s += self.vol[self.reg[ch * 2 + 1]] * (1 if self.out[ch] else -1)
        s += self.vol[self.reg[7]] * (1 if (self.lfsr & 1) else -1)
        return s / 4

    def _shift(self):
        if self.reg[6] & 4:   # white noise: 15-bit, taps bit0 ^ bit1
            fb = (self.lfsr ^ (self.lfsr >> 1)) & 1
        else:                 # periodic
            fb = self.lfsr & 1
        self.lfsr = (self.lfsr >> 1) | (fb << 14)


def run_tandy(img, n, cut=None):
    d = Driver(img)
    sn = SN76489()
    for v in (0x9F, 0xBF, 0xDF, 0xFF):
        sn.write(v)
    d.start(n - 1, tandy=True)
    internal = TANDY_CLOCK / 16.0
    per_tick = internal * TICK_DIV / PIT_HZ
    per_sample = internal / RATE
    out = []
    clocks = 0          # chip clocks run so far
    due = 0.0           # chip clocks that should have run by the current tick
    k = 0
    while k < MAX_TICKS:
        if cut is not None and k >= cut:
            break
        d.tick()
        for v in d.sn_writes:
            sn.write(v)
        k += 1
        due += per_tick
        # run the chip until the next tick, box-filtering into samples
        while clocks < due:
            val = sn.clock()
            idx = int(clocks / per_sample)
            while len(out) <= idx:
                out.append(0.0)
            out[idx] += val / per_sample
            clocks += 1
        if not d.active(True):
            break
    for v in (0x9F, 0xBF, 0xDF, 0xFF):
        sn.write(v)
    out += [0.0] * int(0.02 * RATE)
    # DC block
    r = 1.0 - 2 * math.pi * 10.0 / RATE
    y, px, py = [], 0.0, 0.0
    for x in out:
        py = x - px + r * py
        px = x
        y.append(py)
    return [v * 2.5 for v in y], k


def main(argv):
    args = [a for a in argv[1:]]
    if not args:
        print(__doc__)
        return 1
    ideal = '--ideal' in args
    tandy = '--no-tandy' not in args
    cut = 20
    trace = None
    if '--cut' in args:
        cut = int(args[args.index('--cut') + 1])
        del args[args.index('--cut'):args.index('--cut') + 2]
    if '--trace' in args:
        trace = int(args[args.index('--trace') + 1])
        del args[args.index('--trace'):args.index('--trace') + 2]
    args = [a for a in args if not a.startswith('--')]
    img = load_image(args[0])
    outdir = args[1] if len(args) > 1 else os.path.dirname(os.path.abspath(__file__))
    if trace is not None:
        run_pc(img, trace, ideal, trace=True)
        return 0
    os.makedirs(outdir, exist_ok=True)
    for n in range(2, NUM_EFFECTS + 1):
        smp, ticks = run_pc(img, n, ideal)
        write_wav(os.path.join(outdir, 'effect_%d.wav' % n), smp)
        smp2, _ = run_pc(img, n, ideal, cut=cut)
        write_wav(os.path.join(outdir, 'effect_%d_short.wav' % n), smp2)
        line = 'effect %2d  PC: %4d ticks (%6.1f ms)' % (
            n, ticks, ticks * TICK_DIV * 1000 / PIT_HZ)
        if tandy:
            try:
                ts, tt = run_tandy(img, n)
                write_wav(os.path.join(outdir, 'tandy_effect_%d.wav' % n), ts)
                line += '   Tandy: %4d ticks (%6.1f ms)' % (
                    tt, tt * TICK_DIV * 1000 / PIT_HZ)
            except RuntimeError as ex:
                line += '   Tandy: %s' % ex
        print(line)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
