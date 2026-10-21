---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Pool of Radiance

Part of the [specification](../../README.md), part A. *Pool of Radiance* (SSI, 1988), DOS 1.3 as
sold by GOG, is the game that defines the engine: [the engine files](../../README.md#part-a-the-original-games)
describe it, and the files here hold what belongs to this game alone.

## Identity

| Item | Value |
|---|---|
| `START.EXE` SHA-256 | `d825df2b174675c9088ba1489488bdeebe66ad2a22943f17d3a198e60b6a07bd` |
| `GAME.OVR` SHA-256 | `872964a32cef0fc32bbf83bab68b15e04ad36d59076f37b00a179dfee7928614` |
| Compiler | Borland Turbo Pascal (runtime "1983,91", likely 6.0) with FBOV overlays |
| Addresses in this spec | `seg:off` as Ghidra names them in the merged image (`POOL_MERGED.EXE`, load segment 0x1000) |

Function references use Ghidra's `FUN_seg_off` names from the merged image produced by
`tools/mergeovr.py` ([containers.md](../engine/containers.md)), so they can be re-found.

## Files

| File | Covers |
|---|---|
| [title-and-credits.md](title-and-credits.md) | the credits screen and the code wheel (start-up steps 6 and 7) |
| [commissions.md](commissions.md) | commissions, rewards, the graveyard bounty, proclamations (all in ECL variables) |
| [ending.md](ending.md) | the ending sequence (`PROGRAM 8`) |

The tile wilderness ([overland.md](../engine/overland.md)) is engine code but only Pool of
Radiance uses it; Curse of the Azure Bonds replaces it with a picture
([coab/assets.md](../coab/assets.md) §4).

To be written: the scenario variables the engine and the port read by name (the commission and
journal variables are in [commissions.md](commissions.md); the rest are spread over the engine
files, [engine/ecl.md, "Engine-visible variables"](../engine/ecl.md#engine-visible-variables-o-unless-marked)).

## External reference

Stephen S. Lee, *Pool of Radiance: Exhaustive Game Information*, v2.00 (April 2026),
[GameFAQs](https://gamefaqs.gamespot.com/pc/564785-pool-of-radiance/faqs/73869). Written for PC
1.3 (the GOG version). Player-side facts to cross-check against: area maps and walkthrough
(section 6), mechanics (sections 7–10), interface and combat commands (2.6), cheat mode (2.9.3).
Version 2.00 adds a technical analysis (section 12: script opcodes and flag list, save format,
annotated executable and overlay code, data segment) and a bug list (section 13). An earlier v1.50
(2021) lacks sections 12 and 13. A local copy lives outside the repository (freely distributable
with credit, but kept out of git with the other third-party material). Statements taken from it
and not checked in code are marked **G**.

Facts confirmed against it so far: the Area map (walls only, no doors, everything shown, refused
in some areas, [maps-and-view.md](../engine/maps-and-view.md)); diagonal moves cost 1½ squares
([combat-rules.md](../engine/combat-rules.md)); the harbour's wilderness destinations (New Phlan
script `ECL3` #0: local positions (7,29), (13,27) in area 26 and (9,29) in area 27 are its global
(20,29), (26,27), (35,29), i.e. 13 columns per region); the `STING` cheat parameter.
