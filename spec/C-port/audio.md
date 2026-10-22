---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Audio

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative**: how the port
plays the original's sound effects from the player's `START.EXE`, the device choice, the cut-off rule,
and the port's additions (IMP-013, IMP-014, IMP-015). The driver itself, its bytecode, timer, devices,
effect table and call sites are part A ([engine/sound.md](../A-games/engine/sound.md); CotAB
[coab/assets.md §8](../A-games/coab/assets.md#8-config-video-palette-sound)). Observed in the reference
implementation (`web/src/audio/sfx.ts`, `audio/driver.ts`, the `sound` calls of `vm/engine.ts` and
`rules/combat.ts`, **O**).

PoR and CotAB have no music ([sound.md, "No music"](../A-games/engine/sound.md#no-music-o)); the port adds
none. Secret of the Silver Blades plays AdLib music for its title ([sotsb/assets.md](../A-games/sotsb/assets.md));
the port's OPL2 synthesiser for it is §6.

## 1. How an effect is produced

IMP-013. For effect *n* on the chosen device:

1. Copy the driver's 64 KB segment out of the unpacked `START.EXE` image (profile `sound`: its segment,
   and the game's offset shift, CotAB −0xBD, [B-model/profile.md](../B-model/profile.md)).
2. Start effect *n* − 1 on the device's channels (PC speaker table or Tandy table) and run the driver's
   timer routine tick by tick (236.696 Hz, 5041 PIT clocks a tick), as [sound.md §3](../A-games/engine/sound.md#3-timer-engine)
   specifies, until no channel is active, the cut-off tick (§3) or 2400 ticks.
3. Turn the device's output into samples at the audio output's rate:
   - **PC speaker** ([sound.md §4](../A-games/engine/sound.md#4-pc-speaker-output-cs1477-o)): the
     8253 channel-2 square wave gated by port 61h, as a 0/1 level over PIT time; box-filtered into
     samples, mapped to −1 … +1, through a DC blocker (a one-pole high-pass at 10 Hz: the speaker is AC
     coupled), × 0.35; 20 ms of tail.
   - **Tandy / PCjr** ([sound.md §5](../A-games/engine/sound.md#5-tandy--pcjr-output-cs14ec-o)): an
     SN76489 at 3 579 545 Hz / 16: three square voices with 10-bit periods, a noise channel, 2 dB
     attenuation steps (15 = off), averaged into samples, the same DC blocker, × 2.19; 20 ms of tail.
     **The noise is approximate** (IMP-015): a 15-bit shift register with taps 0 and 1, reset on every
     write to the noise register (which the driver rewrites every tick); the Tandy chip's real taps may
     differ (**I**, sound.md §5).
4. Play the samples at once, as one buffer, **without pausing the game** (the original busy-waits
   during the cut-off delay, IMP-013). Effects may overlap.

The rendering of steps 1–3 is deterministic: the same effect, device and cut-off give the same samples
sample for sample (V8; `web/test/sound.test.ts` against `tools/sound.py`). A build MAY cache rendered
effects. Output levels are informative.

## 2. Device choice

IMP-015. The **Sound** setting ([ui-contract.md §9](ui-contract.md#9-settings)): **PC speaker**
(default), **Tandy / PCjr**, **Off**, key `poolrad.sound` = `pc`, `tandy`, `off`
([storage.md §8](storage.md#8-localstorage-keys)). The original chose the device once, in its
installer's configuration file (`POOL.CFG` line 2, [sound.md §2](../A-games/engine/sound.md#2-device-selection-ds5372)).

- It can be changed at any time; the next effect uses the new device. Choosing PC speaker or Tandy
  plays effect 10 (the footstep) as a sample.
- **Off** plays nothing (the original's mode 2).
- Without `START.EXE` (or with an unreadable one) there is no sound, and the setting row says "needs
  START.EXE among the game files".
- Browsers allow sound only after a user gesture: the first key, click or tap unlocks it; an effect
  requested before that is dropped.
- **Ctrl-S**, as the original's key reader ([sound.md §2](../A-games/engine/sound.md#2-device-selection-ds5372);
  CotAB 0x6841): on any screen, the first press stops every effect still sounding and turns the sound
  off, the next turns it on again with the device the setting names. It shows nothing, as the
  original, does not change the setting and is not kept (a reload starts with the sound on). The
  browser's own Ctrl-S (save the page) is suppressed.
- With an account the setting travels like the others ([accounts-and-sync.md §5.9](accounts-and-sync.md#59-settings)).

## 3. The cut-off rule

Ruling C23 ([AUDIT.md §6.8](../AUDIT.md#68-decisions-taken-2026-10-21)): the port follows the original,
**by call site**.

### 3.1 The original (normative)

- **Pool of Radiance** ([sound.md §6–§7](../A-games/engine/sound.md#6-playsoundn-cs00dc-and-the-01-s-cut-off-o)):
  `PlaySound` cuts an effect off after `delay(10)` (10 hundredths of a second) unless the call is
  inside a `SetResident(0)` section, where it plays to its end. Which calls are which:

  | Effect | Call site | Length |
  |---|---|---|
  | 2 | the spell sound routine's default branch, Hold Person (`FUN_4e53_0c20`, `FUN_4e53_1658`) | full |
  | 3, 4 | the starburst and the sparkle (`FUN_10ba_1feb`) | full |
  | 5 | the skull (`FUN_577f_0e11`) | full |
  | 6, 12 | spell casting (`FUN_3aae_26b0`) | full |
  | 8, 11 | spell sounds (`FUN_4e53_0c20`, arguments 33h and 2Fh) | full |
  | 7 | an attack that hits, the bump (`FUN_3aae_1406`, `FUN_3e76_0d6d`) | cut |
  | 9 | an attack that misses (`FUN_3aae_1406`) | cut |
  | 10 | the footsteps: moving, turning, combat steps (`FUN_29c3_32f8`, `FUN_3e76_0989`, `FUN_3aae_0712`, `FUN_3e76_073b`), the script's CALL sound (`FUN_29c3_2ccf`) | cut |
  | 11 | the script's CALL sound (`FUN_29c3_2ccf`) | cut |

  The cut comes at the second BIOS tick after the call, 14–26 driver ticks (≈ 59–110 ms) depending on
  the clock's phase (**I**); the port picks a length in 14 … 26 at random for each play (presentation
  only, any generator, D2).
- **Curse of the Azure Bonds** ([coab/assets.md §8](../A-games/coab/assets.md#8-config-video-palette-sound)):
  `PlaySound` (0x69B0) has no transient mode: it starts the effect and returns, with no delay and no
  stop, so every effect plays to its end (**O**). Its only stops are `PlaySound(0)` at start-up and in
  the resident code, and `PlaySound(0xFF)` around the main program's overlay calls (0x1A073 …), which
  a conforming build need not model (presentation only).

So a conforming build plays effect *n* to its end exactly when the game has no transient mode
(profile `sound.transient`, [B-model/profile.md §3.4](../B-model/profile.md#34-the-sound-driver-sounddriver)),
or the original's call site for that play is a full one; otherwise it stops the effect at the cut tick.
The call site travels with the request: the engine's and the battle's `sound(n, mode)` calls are made
at the places the table names, each with its mode `full` or `transient`
([B-model/host-contracts.md §2](../B-model/host-contracts.md#2-the-script-host-io), §4.2), and the
host cuts a `transient` effect only in a game with a transient mode. The call sites are the engine's
(they are the same routines in every game); whether they cut is the game's.

### 3.2 The reference implementation

`audio/sfx.ts` `play(n, mode)` and `cutTick` decide as §3.1 says, from the call site's mode and the
profile's `sound.transient`. The modes at the call sites: the footsteps, the bump, the script's CALL
sound (effects 10 and 11), hits and misses (7, 9), IMP-014's footstep, the title's effect and the
Sound setting's sample are `transient`; the skull, the starburst and the sparkle, spell casts and the
missile and spell flights are `full`. So PoR's script effect 11 is cut and its spell effect 11 is not,
and in CotAB every effect plays to its end. (Until 2026-10-21 the reference decided by effect number,
playing PoR's script effect 11 in full and cutting CotAB's 7, 9, 10 and 13: C23, UI8, resolved.)

## 4. Where the port plays effects

| Effect | Played by | Original |
|---|---|---|
| 10 | a step forward or a quarter turn (turning round is silent); a combat step; the script's CALL sound by register 0x3DE | as the original |
| 7 | a forward move into a wall or a held door (bump); a weapon hit | as the original |
| 9 | an attack in which every swing missed | as the original |
| 11 | the script's CALL sound (other register values) | as the original |
| 5 | a combatant's fall (the skull); outside battles a character going down | as the original |
| 3, 4 | the starburst, the sparkle | as the original |
| 2, 6, 8, 12 and the missile sounds | spell casts and flights, by the rules ([combat-visuals.md](../A-games/engine/combat-visuals.md)) | as the original |
| 13 | CotAB's title, with the third title screen | as the original |
| 10 | each APPROACH step that brings an encounter sprite nearer | **added** (IMP-014) |
| 10 | a sample when the Sound setting is changed | added (settings only) |

## 5. Additions

- **IMP-014**: a footstep (effect 10, cut as the original's footsteps are in PoR) each time an
  encounter's APPROACH brings the sprite one square nearer. The original's APPROACH is silent. The
  encounter menu's Advance does not play it.
- The sample on the Sound setting (§2).

## 6. OPL2 synthesis

The AdLib card's chip, the Yamaha YM3812 (OPL2), is synthesised by `web/src/audio/opl2.ts`, written
for the port from the chip's documented behaviour; a game's music driver (part A) turns its song
into register writes, which the synthesiser renders. *Informative* where it simplifies the chip.

- **Interface**: `Opl2.write(register, value)` takes effect from the next chip sample;
  `Opl2.generate(out, rate, start, end)` renders samples at the chip's rate, 3 579 545 / 72 =
  49 716 Hz, resampled linearly to `rate`. `renderWrites(writes, seconds, rate)` renders a timed list
  of writes. The result is played as the effects are (`playSamples` in `audio/sfx.ts`: not with the
  sound off or muted; Ctrl-S stops it).
- **Registers**: 0x01 (bit 5, waveform select), 0x08 (bit 6, the note select of the key code),
  0x20–0x35 (AM, VIB, EG type, KSR, MULT), 0x40–0x55 (KSL, TL), 0x60–0x75 (AR, DR), 0x80–0x95 (SL,
  RR), 0xA0–0xA8 and 0xB0–0xB8 (F-number, block, key-on), 0xBD (AM and VIB depth, rhythm mode, the
  five drum keys), 0xC0–0xC8 (feedback, connection), 0xE0–0xF5 (waveform); offsets with no operator
  are ignored.
- **Pitch**: an operator's frequency is F-number · 2^block · MULT / 2^20 of the chip rate (MULT 0 is
  ½; 11, 13 and 15 as 10, 12 and 15).
- **Level**: attenuation in dB = envelope + 0.75 · TL + KSL + tremolo; silent at 96 dB. KSL is
  6 dB an octave of the top four F-number bits and the block (18 + 6 log₂ n − 6 (7 − block), at
  least 0), scaled ½, ¼ or 1 by KSL 1, 2, 3.
- **Envelope**: the effective rate is 4 · R + the key code (block · 2 + the note-select bit of the
  F-number), or the key code / 4 without KSR, at most 63; R = 0 holds. A 96 dB decay or release takes
  39 281 ms at rate 4, an attack 2 826 ms, halved every four rate steps and times 4 / (4 + rate mod 4)
  between; attack at rate 60 and above is instant. Decay and release are linear in dB, attack
  exponential (the attenuation shrinks by a constant fraction each sample, from 96 dB to 0.1 dB in the
  attack time, then 0). After the decay to the
  sustain level (3 dB steps, 15 = 93 dB) an operator with the EG-type bit holds it until key-off,
  without it goes on at the release rate. Key-on restarts the phase and the attack from the current
  level.
- **Modulation**: the modulator's output shifts the carrier's phase by up to 4π (FM), or both are
  heard (connection 1); feedback adds the mean of the modulator's last two outputs times π/16 … 4π
  (FB 1–7). Waveforms: sine, half sine, absolute sine, quarter sine (only with register 1's bit 5).
- **LFOs**: tremolo, a triangle of 13 432 chip samples (≈ 3.7 Hz), 1 or 4.8 dB; vibrato, a triangle of
  8 192 (≈ 6.1 Hz), ±7 or ±14 cents.
- **Rhythm mode** (approximated): channel 6 is the bass drum (both operators, output doubled); channel
  7's modulator the hi-hat and carrier the snare, channel 8's modulator the tom-tom and carrier the
  cymbal, each keyed by its 0xBD bit or the channel's key and doubled. The hi-hat and snare mix the
  23-bit noise generator with a tone, the cymbal and hi-hat a ring of square waves at 8 × channel 7's
  modulator phase and 32 × channel 8's carrier phase. The chip's exact drum phase logic is not
  reproduced.
- **Not emulated**: the timers (0x02–0x04, the status register) and CSM speech mode (0x08 bit 7). The
  arithmetic is floating point, not the chip's log and exponent tables, so levels and the attack curve
  are close to the chip's rather than bit-exact.
- **Mix**: the channels summed × 0.15.

## 7. Title music

A game whose profile names a song (Secret of the Silver Blades: `SOUND.DAX` record 2, song 0) plays it
at its title through `audio/song.ts`: the song file's events become the original driver's AdLib register
writes, counter tick by counter tick at 72.826 Hz with the sequencer on even ticks, exactly as
[sotsb/music.md](../A-games/sotsb/music.md) §2–§5 specifies (the initialiser's writes at tick 0, the
tracks from tick 1, the stop after the last track), and §6's synthesiser renders them. The writes equal
a register log made separately from that procedure (3 589 writes over 6 152 ticks; its SHA-256 in
`web/test/song.test.ts`). Effect set 0 only (the title's: no echo, no doubling); the other output
devices (speaker, Tandy, CMS, Innovation, Covox) are not played: the AdLib stands for them all. The title
starts it at the first moment the browser lets audio play (the first key or tap) and stops it when the
title ends, as the original's 0x1D12F; the device setting Off and Ctrl-S silence it. Until a game is
playable its asset viewer offers the song ([app-flow.md §10](app-flow.md#10-the-asset-viewer)).

## Validation

- `web/test/sound.test.ts`: every effect, both devices, against `tools/sound.py` sample for sample;
  `web/test/coabsound.test.ts`: CotAB's driver gives the same effects where the data match.
- The cut-off by call site: `web/test/soundcut.test.ts` (the profile's `transient`, the cut tick per
  mode and game, the script's CALL sound transient for effects 10 and 11); `headless.test.ts` checks
  the mode of every sound of a scripted walk and battle.
- `web/test/opl2.test.ts`: pitch from F-number and block (440 Hz at 580, block 4) at the chip's rate
  and resampled; TL in dB; decay, release and attack times against the rate rule; waveforms 1–3 and the
  select bit; feedback; rhythm-mode noise not periodic; the same output for the same writes.

## Open

- IMP-014's "*In progress*" marker: the footstep on APPROACH is done; nothing else is planned
  ([departures.md](departures.md)).
