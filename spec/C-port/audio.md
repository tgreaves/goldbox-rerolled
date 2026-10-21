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

The games have no music ([sound.md, "No music"](../A-games/engine/sound.md#no-music-o)); the port adds
none.

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
- The original's **Ctrl-S** (mute and restore, [sound.md §2](../A-games/engine/sound.md#2-device-selection-ds5372))
  is not offered; the setting replaces it.
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
  `PlaySound` has no transient mode: every effect plays to its end (**I**: no cut-off code was found).

So a conforming build plays effect *n* to its end exactly when the game has no cut-off, or the
original's call site for that play is a full one; otherwise it stops the effect at the cut tick. The
call site travels with the request: the engine's and the battle's `sound(n)` calls are made at the
places the table names ([B-model/host-contracts.md §2](../B-model/host-contracts.md#2-the-script-host-io),
§4.2), so the host knows which length each call has.

### 3.2 The reference implementation (known deviation)

The reference decides **by effect number**: effects 2, 3, 4, 5, 6, 8, 11 and 12 play in full,
every other effect is cut, in both games (`sfx.ts`, `FULL`). Against §3.1 this differs in:

| Game | Case | Original | Reference |
|---|---|---|---|
| PoR | effect 11 from the script's CALL sound | cut | full |
| CotAB | effects 7, 9, 10 (hits, misses, footsteps, the bump, IMP-014's footstep) and 13 (the title's) | full | cut |

Everything else agrees. This is a code task ([AUDIT.md](../AUDIT.md) §6.9, C23 and UI8): the call
sites pass the length (or the profile states the game's cut-off and each call site its kind), and the
`FULL` list goes.

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

## Validation

- `web/test/sound.test.ts`: every effect, both devices, against `tools/sound.py` sample for sample;
  `web/test/coabsound.test.ts`: CotAB's driver gives the same effects where the data match.
- The cut-off by call site: to be tested when the code task is done (a test that plays each call
  site's effect and checks its length).

## Open

- C23/UI8: §3.2.
- Whether CotAB really never cuts an effect off is **I** ([coab/assets.md §8](../A-games/coab/assets.md#8-config-video-palette-sound)).
- IMP-014's "*In progress*" marker: the footstep on APPROACH is done; nothing else is planned
  ([departures.md](departures.md)).
