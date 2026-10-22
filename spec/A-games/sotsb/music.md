# SotSB title music: the song driver and its parts file

> **Status: first pass (2026-10-22).** Part A of the [specification](../../README.md): Secret of the
> Silver Blades v1.30 (GOG 1.0). New in this game (PoR and CotAB play effects only,
> [engine/sound.md](../engine/sound.md)); [assets.md §6](assets.md) places it among the game's files.
> Evidence marks as in the README; **O** is read in the driver's code or the game's.

Scope: the music driver (`SOUND.DAX` record 1), its data (`SOUND.DAX` record 2: a `GLBR` parts file
followed by an `SLBR` song file), how the game drives it, and the procedure in enough detail to
reproduce, register for register, what it sends to an AdLib (OPL2). The other output devices it
supports are described only in outline (§7).

**Conventions.** *Driver addresses* are offsets in the driver's own code segment: the game loads record
1 so that the record's first byte is at CS:0x100 (§1), so driver address *a* is record 1 byte *a* −
0x100. Its data segment is CS + 0x2B0 paragraphs, so **`D:x`** = driver address 0x2B00 + x = record 1
byte 0x2A00 + x. *Game addresses* are offsets in SotSB's working image ([README.md](README.md#working-image)).
The driver is compiled C (cdecl: arguments pushed last to first, the caller pops). Words in the parts
and song files are **big-endian**; the driver swaps them (`xchg ah,al`, 0x29D2).

## 1. How the game uses it (O)

The overlay unit at game image 0x1D830 (far stub segment 0x4B, entries listed at image 0x4D0) holds
the music procedures:

| Stub | Routine | Does |
|---|---|---|
| 0x4B:0x3E | 0x1D8B8 | loads `SOUND.DAX` records 1 and 2 into memory (the driver paragraph-aligned) |
| 0x4B:0x25 | 0x1DA76 | **Init**(driver, data): saves port 0x61; the driver's far entry is driver segment − 0x10 : 0x100 (0x1DA95, the record must start on a paragraph, else a run-time error); calls the entry with (0, data offset, data segment) |
| 0x4B:0x2A | 0x1DAE9 | **Play**(n): the entry with (1, n, n) |
| 0x4B:0x34 | 0x1DB03 | **Stop**: the entry with (3, 0, 0); restores port 0x61 |
| 0x4B:0x39 | 0x1D84F | frees the two records |

The title routine (0x1D631) runs Load, Init and Play(0) at its start, and the routine that ends the
title (0x1D12F) runs Stop and Free; both are skipped when **`DS:741A` = 5**. `DS:741A` comes from
`BLADES.CFG` line 2 (0x2AB0): `A` → 2, `T` → 3, `P` → 4, anything else → 5 (no sound). The letter only
decides whether music plays: the driver chooses its output device itself (§2), so with `T` or `P` on a
machine that has an AdLib the music still plays on the AdLib (O).

The far entry (driver 0x100) sets DS = ES = CS + 0x2B0 and calls the dispatcher 0x349(fn, a, b):

| fn | Does |
|---|---|
| 0 | **Initialise** with the data at far pointer (b:a): choose the device (§2), install the timer (§3), load the parts (§4.1) and the songs (§4.2) |
| 1 | **Play**: `0x2141(D:0[a])` (the effect set, §5.5), then start song **0** (0x948(0)) — *a* only selects the effect set; the title passes 0 |
| 2 | returns 1 while any track is playing (0x5B7), else 0 |
| 3 | **Stop**: restore the timer (0x322), stop the tracks and silence the device (0x585) |

## 2. The output device (O, 0x3EE, 0x28B7, 0x285D)

The initialiser parses an argument list (device names `adlib`, `cms`, `innov`, `covox`, `tsnd`, `psnd`,
`D:2D`–`D:48`, with a port); the game passes none, so the device is detected, in this order: AdLib at
port 0x388 (0x2584 → 0x2550: status-register probe) → **2**; CMS (Game Blaster) at 0x220–0x260 (0x2616)
→ 3; Innovation (0x273F) → 4; Covox (0x280F) → 5; a PCjr or Tandy (0x2CC: F000:FFFE = 0xFD; 0x2E6:
FC00:0000 = 0x21) → 1; otherwise the PC speaker → 0. The device number is `D:22E`; `D:260` := 1 for the
speaker (one voice), else 0. An implementation of the AdLib path plays the AdLib device (2).

Then (0x1FFF, the device's start): stop everything (§5.4), `D:4BA` := 1 (output enabled), and for the
AdLib (0x1258 → 0x11DB): write **0xBD** ← 0x20 (rhythm mode on, as `D:BC` = 0), **0x08** ← 0x40, **0xE0 +
op** ← 0 for all 18 operators (op offsets `D:DC`, §8), **0x01** ← 0; `D:DB` (rhythm bits) := 0, `D:39C`
(voices in use) := 0. The six track slots are cleared, the loop song `D:276` := −1, the sequencer gate
`D:27A` := 1, the tick hook `D:278` := none.

## 3. The timer (O, 0x2FF, 0x2941, 0x2993)

The driver reprograms PIT channel 0 to divisor **0x4000** (port 0x43 ← 0x36, 0x40 ← 0x00, 0x40 ← 0x40):
1 193 182 / 16 384 = **72.826 Hz**. It hooks **INT 1Ch** (vector 0000:0070; the BIOS INT 8 handler calls
it at that rate) and clears a 32-bit counter (`CS:293D`). Each call increments the counter; when the
new value is **even** the hook calls the tick routine with the counter (0x33E → 0x609 → `[D:278]`, the
sequencer 0x98A once songs are loaded) and then chains to the old INT 1Ch; on odd values it returns at
once. So the sequencer runs at 36.4 Hz, but every time in the songs is in **counter ticks of 1/72.826 s**,
compared with the counter (an event due at an odd tick sounds one tick late). Stop restores divisor 0
and the old vector (0x322).

## 4. The data: SOUND.DAX record 2

The record is a `GLBR` parts file of 434 bytes immediately followed by an `SLBR` song file
(fn 0 reads the songs at data + 0x1B2, 0x3A0).

### 4.1 GLBR, the parts (O, 0x124)

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | `GLBR` (tested as words 0x4C47, 0x5242) |
| 4 | 4 | the file's size (BE; 0x1B2), not read |
| 8 | 2 | 0xFFFF, not read |
| 10 | 2 | *count* of parts (BE; 31) |
| 12 | 2·count | each part's size (BE) |
| 12 + 2·count | | the parts, in order: part *n* starts at 12 + 2·count + Σ size[0..n−1] |

Each output device has eight parts: device *d* (2–5) loads parts 8·(d − 2) … 8·(d − 2) + 7 (0x2109).
For the **AdLib** (0x207F → 0x1029(0), 0x1277): `D:BC` := 0 (rhythm mode), and part *n* (0–7, 12 bytes
each) is copied to **instrument *n*** at `D:33C + 12n`:

| Byte | Field |
|---|---|
| 0 | not read |
| 1 | fixed voice (0: any free voice 0–6, §5.1) |
| 2, 3 | register 0x20 for the modulator, the carrier (AM, VIB, EG type, KSR, multiple) |
| 4, 5 | register 0x40, modulator and carrier (KSL, total level) |
| 6, 7 | register 0x60 (attack, decay) |
| 8, 9 | register 0x80 (sustain level, release) |
| 10 | register 0xC0 (feedback, connection) |
| 11 | not read |

The waveform registers (0xE0) are never written but with 0 (§2), and register 0x01 is 0, so every
operator is a sine. Parts 8–15 (18 bytes) are CMS voices, 16–30 (8 bytes) Innovation and Covox ones
(not described here).

### 4.2 SLBR, the songs (O, 0x682, 0x739)

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | `SLBR` (not tested) |
| 4 | 4 | size (BE), not read |
| 8 | 1 | *n*: the number of songs (`D:283`; 1 in SotSB) |
| 9 | 1 | not read |
| 10 | 2·(n + 1) | song offsets (BE) from the end of this table; the last is the end |

**A song** (at its offset):

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | not read (the tempo routine 0x621 returns the constant **118** whatever it is) |
| 2 | 1 | the starting volume of every track (0x7F) |
| 3 | 1 | *t*: the number of tracks (4) |
| 4 | 2·t | each track's offset (BE) from song + 0x0E |
| 0x0E | | the tracks' data |

**Track 0** is a one-voice arrangement for the PC speaker: it is played only when `D:260` is set. On
every other device tracks 1 … t − 1 are played, track *i* in **slot i − 1** (0x7E7). The same track
also plays in slot (i − 1) + 3, `D:303`[i − 1] ticks later, when `D:303`[i] is not 0 (**Bug**: the test
reads the next slot's delay, 0x7EF, the start uses the slot's own, 0x87D; so the last track never
echoes); the delays come from the effect sets (§5.5).

**A track** is a list of two-byte events [*a*, *b*], read in order:

| *a* | Event |
|---|---|
| 0x00–0x7F | **note** *a* (a semitone number: 12·(octave + 1) + semitone), duration *b* |
| 0x80 | **rest**, duration *b* |
| 0x81 | (re)assign the slot's instrument: slot *k* < 4 takes instrument *k*, a later slot instrument 1 (*b* not read) |
| 0x84 | volume := 0x7F (*b* not read) |
| 0x82, 0x83, 0x85–0xFE | ignored (*b* not read) |
| 0xFF | end of the track |

**Duration byte** *b* (0x629): base = 0x6900 >> (*b* & 7) (whole note = 26 880 units, a half 13 440 …);
if *b* & 8 (dotted), base := (base >> 1) × 3; if *b* & 0x30, with *m* = (*b* & 0x30) >> 3 (2, 4 or 6),
base := (base div (m + 1)) × m (integer arithmetic, 16 bits); *b* & 0x40 = **tie** (the next note is not
struck again). The time advances by base div 118 ticks, the remainder accumulating in the slot (frac):
when frac ≥ 118, one tick more and frac −= 118 (0xA89). So a quarter note is 6 720 / 118 ≈ 56.9 ticks
≈ 0.78 s.

## 5. The sequencer (O, 0x98A)

A **slot** (14 bytes at `D:2AF` + 14k, k = 0–5): +0 the time of its next event (32 bits; 0 = idle), +4
the track pointer, +8 the tempo (118), +0xA frac, +0xC the volume, +0xD the state (3 = silent, 1 = a
note sounding, 0 = a note to be released one tick early, 2 = tied). **Start** (0x948 → 0x739): wait
until the counter is not 0; every used slot gets time := the counter (+ its delay, §5.5), the track's
first event, tempo 118, frac 0, the song's volume, state 3. Song 0 is played once: `D:276` stays −1, so
when the tracks end nothing restarts it.

At each sequencer call with counter *c* (guarded against re-entry by `D:2C`), for slots k = 0 … 5 in
order, a slot whose time is not 0 and ≤ *c*:

1. **State 0**: release (note off, §5.3), state := 3, time += 1; next slot.
2. **Commands**: while the event's *a* is above 0x80 and not 0xFF: 0x81 → if state < 3 note off; state
   := 3; assign the instrument (§5.1); 0x84 → volume := 0x7F; others nothing; the pointer += 2.
3. **0xFF**: time := 0; if state < 3 note off; state := 3; the track has ended.
4. **A note or rest** [*a*, *b*]: the time advances by the duration (§4.2). A rest: if state < 3 note
   off; state := 3. A note: unless state is 2, if state < 3 note off, then **note on** (§5.2) with the
   slot's volume; then state := 2 if *b* & 0x40; else, when the **next** event's *a* equals this note,
   time −= 1 and state := 0 (a repeated note is released one tick before it is struck again); else
   state := 1. The pointer += 2.

After the six slots: if a track ended this call and no slot is still playing, stop (§5.4) (or restart
the loop song when `D:276` ≥ 0, which the title never sets).

### 5.1 Instrument assignment (O, 0x1527, 0xF55, 0x1050)

The slot's voice (`D:BD + k`, initially k) is freed (bit voice of `D:39C`); the instrument's fixed voice
(byte 1) is taken if not 0 (an error message if already taken, then taken anyway), else the lowest free
voice 0–6 (the bits of `D:39C`); the slot's voice := it, its instrument (`D:C9 + k`) := the instrument.
The instrument is then written to the voice's operators: for a melodic voice *v* (any voice while
`D:BC` ≠ 0, else voices 0–6) the operator numbers are m = `D:109`[v] (`D:100` with `D:BC` ≠ 0) and the
modulator is operator `D:DC`[m − 1], the carrier `D:DC`[m + 2]; a percussion voice (7–10 in rhythm mode)
has the single operator `D:DC`[`D:109`[v] − 1]. For each operator in turn (modulator, then carrier):

    0xBD ← 0x20 (0 with D:BC ≠ 0);  0x08 ← 0x40
    0x40 + op ← instrument[4 + s]
    (modulator only) 0xC0 + v ← instrument[10]
    0x60 + op ← instrument[6 + s];  0x80 + op ← instrument[8 + s];  0x20 + op ← instrument[2 + s]

(s = 0 for the modulator, 1 for the carrier.)

### 5.2 Note on (O, 0x23CE → 0x14C1 → 0x12B7)

Only while `D:4BA` (output) is set. Slot *k* < 3 plays its voice at the volume with detune 0, and, if
`D:D5`[k] ≠ 0 (§5.5), also the voice of slot k + 3 at volume × 100 >> 7 with detune `D:D5`[k]; a slot ≥ 3
(an echo) plays at volume × 100 >> 7 with detune `D:D5`[k] (detune *t* adds `D:12C`[s] × t to the
F-number). Playing voice *v* (`D:BD`[slot]), instrument *i*
(`D:C9`[slot]), note *n*, volume *vol*, detune *t*:

- **Melodic voice** (channel ch = v): carrier operator op = `D:DC`[m + 2] (m as in §5.1);
  write **0xA0 + ch ← 0x4A**, **0xB0 + ch ← 0x0E** (the old note off);
  TL = 0x3F − (((0x3F − (instrument[5] & 0x3F)) × vol) >> 7), with instrument[5]'s KSL bits (& 0xC0)
  kept; write **0x40 + op ← TL**.
- **Percussion voice** (v = 7–10; ch = 7 for v ≤ 8, else 8): `D:DB` &= ~(1 << (10 − v)); op =
  `D:DC`[`D:109`[v] − 1]; TL as above from instrument[4]; write **0xBD ← `D:DB` | 0x20**, then **0x40 +
  op ← TL**.
- (a volume below 0 stops here: that is **note off**, §5.3.)
- semitone s = n mod 12, block = n div 12 − 1, clamped to 0–7; F-number f = `D:114`[s] + `D:12C`[s] × t
  (§8); write **0xA0 + ch ← f & 0xFF**; melodic: **0xB0 + ch ← (f >> 8 & 3) | block << 2 | 0x20** (key
  on); percussion: **0xB0 + ch ← (f >> 8 & 3) | block << 2**, `D:DB` |= 1 << (10 − v), **0xBD ← `D:DB` |
  0x20**.

### 5.3 Note off

The note-on routine with note 0 and volume −1 (0x23CE(k, 0, −1)): a melodic voice gets 0xA0 + ch ← 0x4A,
0xB0 + ch ← 0x0E; a percussion voice its bit cleared and 0xBD rewritten. Slots ≥ 3 and doubled voices
are not released separately (a doubled voice k + 3 sounds until its own slot's next event).

### 5.4 Stop (0x22EA → 0x1223)

Port 0x61 &= 0xFC (the speaker off), then for the AdLib: **0xB0 + ch ← 0x0E** for ch = 0–8, and in
rhythm mode **0xBD ← 0x20**, `D:DB` := 0.

### 5.5 Effect sets (O, 0x2141, 0xF2C)

Play's argument selects, through `D:0`[a] (bytes 0, 2, 3 for a = 0, 1, 2), an effect set (AdLib only).
0xF2C(slot, delay, x): with a delay, `D:303`[slot] := delay (the slot's track is also played, *delay*
ticks later, in slot + 3: an echo) and `D:D5`[slot + 3] := x (written as `D:D8`[slot]: the echo's
detune); without one, `D:D5`[slot] := x (a detuned doubling of slot *k* < 3 in voice slot + 3, §5.2).
Set 1: (0, 4, 1), (1, 4, 1), (2, 6, 0); set 2: (0, 8, 1), (1, 8, 1), (2, 0x0C, 0); set 3: (0, 0x10, 1),
(1, 0x10, 1), (2, 0x12, 0); set 4: (0, 0x20, 2), (1, 0x20, 2), (2, 0x14, 0); set 9: (0, 8, 1), (1, 8,
1), (2, 5, 0); any other value (the title's 0): (k, 0, 0) for k = 0–2, no doubling (the delays stay as
the initialiser left them, 0). So every set is echoes: slots 0 and 1 echo with detune 1 or 2, slot 2
without detune; no set doubles a voice.

## 6. What the title plays (O, from the data and §5)

Song 0: tracks 1–3 in slots 0–2 with instruments 0, 1, 2 (each track begins with 0x81), voices 0, 1, 2
(their fixed voice is 0), all melodic: no percussion voice and no echo or doubling. The instruments use
feedback/connection, AM and vibrato bits, KSL and total levels, attack/decay/sustain/release, with the
sine waveform only; register 0xBD stays 0x20 (rhythm mode on, no drum struck; the AM and vibrato depth
bits 0). The song runs about 6 150 counter ticks (≈ 84 s) unless the title ends first, when Stop cuts
it.

## 7. The other devices (outline, O for the dispatch)

Each sequencer call goes through a per-device table (note on 0x23F4, instrument 0x22BC, stop 0x2302,
start 0x2019, parts 0x2099): device 0 (speaker) and 1 (PCjr/Tandy SN76496 at port 0xC0, 0x2331: three
tone voices from `D:248`/`D:230`, the speaker for a fourth) play from F-number-like divisor tables; 3
CMS, 4 Innovation and 5 Covox have routines of their own (0x1CF7…, 0x164F…, 0xC9D…) and parts 8–30.
The GOG release runs the game with an AdLib, so the port needs the AdLib path only.

## 8. Tables (informative)

| Table | Address | Contents |
|---|---|---|
| operator offsets | `D:DC`, 18 words | 0, 1, 2, 3, 4, 5, 8, 9, 0x0A, 0x0B, 0x0C, 0x0D, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15 |
| voice → operator number, melodic | `D:100`, 9 bytes | 1, 2, 3, 7, 8, 9, 13, 14, 15 |
| voice → operator number, rhythm mode | `D:109`, 11 bytes | 1, 2, 3, 7, 8, 9, 13, 17, 15, 18, 14 (voices 7 snare, 8 tom, 9 cymbal, 10 hi-hat) |
| F-number by semitone (C … B) | `D:114`, 12 words | 0x157, 0x16D, 0x181, 0x198, 0x1B1, 0x1CB, 0x1E6, 0x203, 0x222, 0x243, 0x266, 0x28A |
| detune multiplier by semitone | `D:12C`, 12 words | 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2 |
| effect set by Play's argument | `D:0`, 3 bytes | 0, 2, 3 |

## Validation

A register log of the title (every OPL2 write with its counter tick, from the procedure above) was
produced locally from the player's own files as a test oracle: 3 589 writes over 6 152 ticks. It is
not in the repository (it is derived game data); an implementation should reproduce it from
`SOUND.DAX` exactly.

## Open

- The meaning of the song header's first word and of events 0x82, 0x83, 0x85–0xFE (ignored on every
  device here, I: commands for another player of the same format).
- The CMS, Innovation and Covox paths are not traced beyond their dispatch.
