---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Sound driver

Part of [[spec/README]]. The driver lives in the resident part of `START.EXE` (it is not an overlay), so the browser port reads it from the player's own file.
Driver code segment 0x18AE, linear base 0x18AE0. `CS:x` below means linear 0x18AE0+x.
The code loads `DS = 0x08AE` (the unrelocated value of the same paragraph), so all
driver variables are CS-relative. O = observed in code/data, I = inferred.

Tools: `tools/sound.py` renders every effect to WAV (PC speaker exactly, Tandy approximately) from `START.EXE`; `tools/sounddis.py` lists every effect's bytecode. The browser port's `web/src/audio/driver.ts` is a port of `tools/sound.py` and is tested against it sample for sample.

## 1. Entry points

| CS off | linear | role |
|---|---|---|
| 0000 | 18AE0 | Pascal: `now()` in centiseconds (DOS 2Ch; h*360000+m*6000+s*100+cs) (O) |
| 006C | 18B4C | Pascal: `delay(n)`, busy-waits until `now() >= start+n` centiseconds (midnight guard) (O) |
| 00DC | 18BBC | Pascal: `PlaySound(n)` (O, see §6) |
| 017B | 18C5B | Pascal: sound re-init: `DS:5373 := DS:5372`; if mode≠2: install, start effect 0 on both devices, uninstall (O) |
| 01A5 | 18C85 | Pascal: `SetResident(x)`: if mode≠2: x=0 → install ISR; x>0 and DS:5374=0 → uninstall. Then `DS:5374 := x` (O) |
| 137C | 19E5C | install: save INT 08h vector at CS:1378, hook INT 08h → CS:13EA, `out 43h,B6h` (PIT ch2 = mode 3, lo/hi), `out 40h` = 0x13B1 (ch0 divisor 5041) (O) |
| 13B1 | 19E91 | uninstall: restore INT 08h, ch0 divisor 0xFFFF, port 61h &= FCh (speaker off), SN76489 `9F BF DF FF` (all attenuations off) (O) |
| 13EA | 19ECA | timer ISR (§3) (O) |
| 1477 | 19F57 | PC speaker tick (§4) (O) |
| 14EC | 19FCC | Tandy tick (§5) (O) |
| 157A | 1A05A | per-channel step (§3.2) (O) |
| 160B | 1A0EB | bytecode interpreter (§3.3) (O) |
| 1742 | 1A222 | start effect e on PC-speaker channels (table CS:055F, structs CS:022D) (O) |
| 17AE | 1A28E | start effect e on Tandy channels (table CS:0607, structs CS:03C7) (O) |
| 181A | 1A2FA | `CS:020D := arg` (sound enable flag) (O) |

## 2. Device selection (DS:5372)

- Set at linear 0x1457B from the POOL.CFG character read into DS:484C: `'T'` → 0, `'P'` → 1, anything else → 2 (O).
- **0 = Tandy/PCjr (SN76489 at port C0h), 1 = PC speaker, 2 = no sound** (O). `PlaySound` calls 17AE (Tandy) for mode 0 and 1742 (PC) for mode 1.
- Ctrl-S (key 13h) handler at 0x189FE toggles sound: stores the mode in DS:5373, plays 0xFF (stop), sets mode 2; pressing it again restores the mode and calls 017B. 0x18990 also restores DS:5372 from DS:5373 and plays 0xFF (O).
- Both device tick routines run on every ISR tick whatever the mode. Only the device whose structs were started has active channels (O).

## 3. Timer engine

### 3.1 ISR CS:13EA (O)
- Tick rate: PIT ch0 divisor 0x13B1 = 5041 → **1193182/5041 = 236.696 Hz (4.2249 ms/tick)**.
- Per tick:
  1. If word CS:01DB ≠ 0, decrement it. On reaching 0, set the video mode, print the 33-char string at CS:01DD (bit 7 set on each char, masked with 7Fh: `"Run-time  Error 209 at 0BAD:0038"`) and exit to DOS with code FFh. A fake-crash watchdog. Initial value is 0 (disabled). No writer found inside the image (I: set by protection code through a far pointer).
  2. If busy byte CS:01D8 = 0: set it, call 1477 (PC), then 14EC (Tandy), clear it. CS:01D8 is also set while 1742/17AE fill the channels.
  3. `--CS:01D7`. When it reaches 0, reload 13 and far-jump to the old INT 08h, which does the EOI and keeps the BIOS clock at 236.7/13 = 18.21 Hz. Otherwise send EOI (20h → port 20h) and IRET.

### 3.2 Channel struct (0x30 bytes; 4 per device; PC at CS:022D, Tandy at CS:03C7)

| off | name | meaning |
|---|---|---|
| +00 | dur | ticks left until the next bytecode fetch. **≠0 = channel active** (O) |
| +02 | ptr | bytecode pointer (CS offset). 0 = ended (O) |
| +04 | base | pitch value: PC = PIT ch2 divisor, Tandy = 16-bit value whose top 10 bits are the SN76489 period (O) |
| +06 | slide | added to +04 every tick (O) |
| +08 | out | value actually sent to hardware = +04 + LFO offset (O) |
| +0A | vol | PC: bits 0-1 go to port 61h (3 = sound). Tandy: attenuation = (FFFFh − vol) >> 12 (O) |
| +0C | vold | added to +0A every tick (O) |
| +0E | tempo | low byte multiplies note durations (≤1 → ×1) (O) |
| +10 | — | never read by the driver. Effect 21 sets it (I: for an external music player) |
| +12 | transp | semitones added to note numbers (O) |
| +14 | gate | note-off countdown, loaded with the note duration. At 0 → envelope jumps to entry 4 (offset +10h) (O) |
| +16/+18/+1A | env ptr / env offset / env step countdown (O) |
| +1C | lfo table ptr (O) |
| +1E | lfo phase (12.4 fixed point index) (O) |
| +20 | lfo phase increment (O) |
| +22 | lfo depth (signed) (O) |
| +24 | lfo table length ×16 (phase wraps here) (O) |
| +26, +28 | free words used by the data as FE loop counters (O) |

Start (1742/17AE, effect index e = n−1): `CS:01FF := e`. For c = 0..3: `p = word[table + e*8 + c*2]`. If p≠0: zero all 0x30 bytes, set +02 = p, `byte CS:0209+c := e`, +00 = 1. Channels with p = 0 are **not touched** (O).

Step CS:157A, called only when +00 ≠ 0 (O, in this exact order):
```
vol  += vold                     (16-bit wrap)
base += slide
dx = 0
ph = lfo_phase + lfo_inc         (16-bit)
if ph != 0:                      (ph == 0 → no LFO, phase not stored)
    if ph >= lfo_len (unsigned): ph -= lfo_len
    lfo_phase = ph
    s = signed byte at [ (ph sar 4) + lfo_tab ]
    dx = high16( (s<<8) * lfo_depth )     signed 16x16 imul
out = base + dx
if gate: gate--; if gate == 0: env_off = 0x10; env_cnt = 1
dur--; if dur == 0: interpret bytecode (3.3)
if env_cnt: env_cnt--; if env_cnt == 0:
    loop: e = env_ptr + env_off
          if word[e+2] == 0xFFFF: vol = word[e]; if vol == 0: vold = 0; env_off += 4; continue
          else: vold = word[e]; env_cnt = word[e+2]; env_off += 4; break
```
Consequence (O): `out` is computed **before** the fetch. On an effect's first tick the hardware gets the cleared value: PC divisor 0 (= 65536, 18.2 Hz), Tandy period 0.

Envelope entries (O) are 4 bytes `(value, count)`. count = FFFFh sets vol = value and continues with the next entry. Otherwise vold = value for `count` ticks. count 0 leaves the slope running forever. Entry 4 (+10h) is the release that note-off jumps to.

LFO tables (O):
- CS:06AF (linear 1918F): 256-byte signed sine, amplitude ±126 (len 1000h).
- CS:07AF: 16×00 + 16×78h square (len 200h).
- CS:07CF (linear 192AF): 512 bytes of random noise (len 2000h). With inc 10h the index steps by 1 per tick, so each tick gets a new pseudo-random offset of ±depth/2. Most effects get their noisy sound this way.

### 3.3 Bytecode (interpreter CS:160B) (O)

Called when +00 reaches 0. Saves si in CS:0201. A fetch loop at CS:1618 reads one byte `b`:

| byte | operands | action |
|---|---|---|
| < FAh | 2 more bytes (§3.4) | note record |
| FA | — | reset current channel: zero +04 +06 +08 +0A +0C +10 +12 +16 +18 +1A +1C +1E +20 +22 +24 (not +00 +02 +0E +14 +26 +28). Continue |
| FB | — | return: ptr := word CS:0207 (one global level, shared by all channels). Continue |
| FC | w addr | call: CS:0207 := ptr after operand; ptr := addr. Continue |
| FD | w off | **switch the "current channel"** to `CS:0203 + off` (0, 30h, 60h, 90h = channel 0-3), then reset it as FA. Later FF/FE/FA in this fetch apply to that channel. Continue |
| FE | b field, w addr | loop: if word[ch+field] ≠ 0: decrement it, and if it is now 0 fall through (continue). Otherwise (was 0, or still nonzero) ptr := addr. A zero counter makes FE an unconditional jump |
| FF | b field, w value | word[ch+field] := value. If field ≠ 0 continue. **field 0 = set duration and end this fetch** |

Jump table CS:0221 (linear 18D01): FA→164E, FB→16AC, FC→16B3, FD→1645, FE→162E, FF→167F.

End of fetch (CS:168F): ch := saved channel (CS:0201). If its +00 = 0: `byte CS:0209+idx := 0` and ptr := 0 (channel ended). Store ptr in +02.
- `FF 00 nn nn` = "wait nnnn ticks". `FF 00 00 00` = end of channel. Every effect ends with `FF 0A 00 00 / FF 00 00 00` (vol 0, end).
- If FF 00 targets a channel picked by FD, the duration lands on that channel. The end check still uses the original channel (that is how effect 21 ends after its setup).

### 3.4 Note records (O; no effect sequence uses them)

3 bytes `b0 b1 b2`. Duration = b2 if tempo ≤ 1, else tempo×b2. It is stored in the **current** channel's +00.
- If `b1&7Fh` = 7Fh (rest) or `b0>>5` ≠ 0, nothing more happens.
- Otherwise, on struct `CS:0203 + (b0>>5)*30h` (which is always channel 0, because of the previous condition): +00 = +14 = duration, +18 = 0, +1A = 1 (envelope restarts on the next envelope step). Then `k = (b1&7Fh) + transp`, octave = k div 12 (unsigned), `base = out = freqtab[k mod 12] >> octave`.
- If `b1&80h`, the fetch ends. Otherwise the next 3-byte record is read immediately as a note, with no FA..FF dispatch (chords).
- Frequency tables: PC CS:03AD = C1..B1 PIT divisors (8E84h = 32.70 Hz …). Tandy CS:0547 = FFC0h, F140h, … (period = value>>6; FFC0h → 1023 → 109.3 Hz ≈ A2, so the Tandy table starts on A).
- The `b0>>5 ≠ 0 → skip` test looks like a bug (I). Notes only reach channel 0.

## 4. PC speaker output (CS:1477) (O)

```
if word CS:01FF == 0:  bits = 0
else:
  CS:03C5 = 0; CS:0203 = 022D; CS:0205 = 03AD
  for ch in 0..3 (CS:01D9 = 4..1):
     if ch.dur: step(ch); if CS:03C5==0 and ch.vol!=0 and ch.dur!=0: CS:03C5 = ch
  if byte CS:020D == 0 or CS:03C5 == 0: bits = 0
  else: out 42h, sel.out (lo, hi); bits = sel.vol & 3
port 61h = (in 61h & FCh) | bits
```
- Mixing (O): **no mixing**. The lowest-numbered channel that is active with vol≠0 owns the speaker. All shipped PC effects use only channel 0 (channels 1-3 point at the null sequence CS:0D2B).
- Frequency = 1193182 / divisor (divisor 0 = 65536). vol is used only as a 2-bit gate: the data writes 3 (on) or 0 (off).
- PIT behaviour (I, Intel 8253/8254 mode 3 datasheet, not tested on hardware): a new count written while the counter runs only loads at the end of the current half-cycle. A rising gate (port 61h bit 0) restarts the count with the output high. Every effect's first tick raises the gate with count 0, which holds the output high for 32768 clocks (27.5 ms) before the real pitches load. Effects therefore start with a click and ~27 ms of silence. The footstep (9 ticks, 38 ms) comes out as little more than a thump. `tools/sound.py` models this by default; `--ideal` applies divisors at once (`ideal/`).

## 5. Tandy / PCjr output (CS:14EC) (O)

- Steps all 4 Tandy structs (CS:0205 = 0547 note table).
- If CS:01FF = 0 or CS:020D = 0, writes `9F BF DF FF` (silence).
- Otherwise, for channel c = 0..3, with `dl = 80h + 20h*c`:
  - `v = out >> 2`. Write `(v&FFh)>>4 | dl` (latch, low 4 period bits). For c<3 also write `v>>8` (high 6 bits). So **period N = out >> 6** (10 bits).
  - Then write `((FFFFh−vol)>>12) | dl | 10h` (attenuation, 2 dB per step, 15 = off).
- Channel 3 is the noise generator: control = `(out>>6)&0Fh`. The data uses 0x0100 (white, clock/512), 0x0180 (white, clock/2048) and 0x01C0 (white, clocked by tone 3). In the third case channel 2 sets the pitch with vol 0, so it acts only as the noise clock.
- The noise register is rewritten every tick. On an SN76489 any write to it resets the shift register (I). That gives the noise a 236.7 Hz periodic component. `tools/sound.py` models it.
- All 4 voices are written every tick even when inactive, so a channel that ended without vol 0 would keep sounding (O; every shipped sequence zeroes vol).
- Tone f = 3579545 / (32·N). `tools/sound.py` uses a TI-style 15-bit LFSR with taps 0,1 (I; the Tandy NCR/SN76496 taps may differ).

## 6. PlaySound(n) (CS:00DC) and the 0.1 s cut-off (O)

```
if DS:5372 == 2: return
if DS:5374 != 0: install()                      ("transient" mode)
n==0:    start(0) on both devices; CS:020D=0    (stop + mute)
n==1:    CS:020D = 1                            (unmute)
n==0xFF: start(0) on both devices               (stop)
else:    mode 1 → 1742(n-1); mode 0 → 17AE(n-1)
if DS:5374 != 0: delay(10 cs); start(0) both; uninstall()
```
- Effect 0 in both tables is the null sequence (vol 0, end), and `CS:01FF := 0` silences output.
- DS:5374 is set to 100 at init (linear 0x3706D, then SetResident(100) at 0x37074) and back to 10 after each special section. So **by default every effect is cut off after `delay(10)`**. DOS time moves in 5-6 cs steps per BIOS tick, so this ends at the 2nd BIOS tick after the call: 14-26 driver ticks (≈59-110 ms) depending on phase (I). `effect_N_short.wav` uses 20 ticks.
- `SetResident(0)` (ISR left installed, effects play to the end) is called around these call sites: 0x12BB1…0x12D07 (effects 4, 3), 0x3D2F6…0x3D34E (6, 12), 0x4F320…0x4F36E (11/8/2), 0x4FC0D…0x4FC66 (2), 0x5860A…0x5888C (5).

## 7. Effect numbers and call sites (O)

The game always pushes a word constant from DS:2610+ (2612=FFh, 2614=0, 2616=1, 2618=2, … 262C=12, 262E=13). Far calls to 08AE:00DC:

| n | DS const | call sites (linear) [containing Ghidra fn] | mode at call |
|---|---|---|---|
| FFh | 2612 | 1899D [FUN_1899_0000], 18A0F (Ctrl-S) | — |
| 2 | 2618 | 4F34A [FUN_4e53_0c20, default branch], 4FC16 [FUN_4e53_1658, Hold Person] | full |
| 3 | 261A | 12C18 [FUN_10ba_1feb] | full |
| 4 | 261C | 12C0D [FUN_10ba_1feb] | full |
| 5 | 261E | 5861A, 587FE [FUN_577f_0e11] | full |
| 6 | 2620 | 3D2FF [FUN_3aae_26b0] | full |
| 7 | 2622 | 3BF3D, 3C1DA [FUN_3aae_1406], 3F797 [FUN_3e76_0d6d] | transient |
| 8 | 2624 | 4F33F [FUN_4e53_0c20, arg 33h] | full |
| 9 | 2626 | 3C258 [FUN_3aae_1406] | transient |
| 10 | 2628 | 2C9BC [FUN_29c3_2ccf], 2D103 [FUN_29c3_32f8], 3B356 [FUN_3aae_0712], 3EEA2 [FUN_3e76_073b], 3F274, 3F2B9 [FUN_3e76_0989] | transient |
| 11 | 262A | 2C9CC [FUN_29c3_2ccf], 4F330 [FUN_4e53_0c20, arg 2Fh] | transient / full |
| 12 | 262C | 3D345 [FUN_3aae_26b0] | full |

Effects 13-21 exist in both tables but have no call site. Effect 21 is an instrument setup with no sound. Effect 1 is never "played" (it unmutes).

## 8. Data (O)

- PC effect table CS:055F (linear 1903F), Tandy CS:0607 (linear 190E7). Each has 21 entries × 4 word pointers (entry e = effect n−1).
- Sequences: PC ≈ CS:09CF-0E96, Tandy ≈ CS:0E97-137B. Envelopes for effect 21 at CS:0E1F-0E7E and CS:12FC-135B. Full listing in `sequences.txt`.
- Data anomaly (O): Tandy effect 19, ch0 at CS:0F73, reads `FF 04 581B` then `FB` where the pattern of the other effects expects `FF 0A A028 …`. FB jumps to CS:0207 (0 on a fresh start), so the channel then interprets code bytes as notes. Unused by the game; render with care.

Effect summaries (PC, from the sequences; tick = 4.225 ms; f = 1193182/divisor; "rnd ±d" = random LFO, offset ≈ ±d/2 per tick):

| n | PC sequence | ticks |
|---|---|---|
| 2 | div 5000 (239 Hz) sine LFO depth 500; 40× [2 hold, 1 slide −595, 2 hold, 1 slide +500] (warble) | 241 |
| 3 | div 4300 +10/t, rnd ±1600, 30 t; then div 1300 (918 Hz) +80/t rnd ±900, 5 t | 36 |
| 4 | div 6523, 10× [−45/t for 20, +500 for 1] (rising siren steps) | 211 |
| 5 | div 12000 rnd ±10000, 44× [−3600/t 2, +3720/t 2] | 177 |
| 6 | div 6200, 5× [hold 6, 12× (−930, +900)] (trill) | 151 |
| 7 | div 6000 (199 Hz) rnd ±2600, −160/t for 30 (→div 1200, 994 Hz) then +70/t for 35 (→3650, 327 Hz) | 66 |
| 8 | div 16308 (73 Hz), 30× [−452/t 12, +631/t 8] | 601 |
| 9 | div 4000 (298 Hz) 5 t, div 1000 (1193 Hz) 4 t | 10 |
| 10 | div 14000 (85 Hz) +200/t, rnd ±6000 → ≈72-98 Hz random, 8 t | 9 |
| 11 | div 30000 (40 Hz) rnd ±10000, 28 t; silence 12 t; div 4100 (291 Hz) +16/t → 8900 (134 Hz) rnd ±2200, 300 t | 341 |
| 12 | div 3300 (362 Hz) −20/t, sine LFO depth 1000 inc 256, 30 t | 31 |
| 13-20 | see `sequences.txt` | |

Renderer tick counts include the final tick that reads the end command.

## No music (O)

The DOS version has no music, title or otherwise. Every call to `PlaySound` is listed in §7 and none is in the title or intro code; the longest effect is 8 (2.5 s). The driver can play note sequences (bytes below FAh), but no effect data uses them, so that part is unused in this release.
