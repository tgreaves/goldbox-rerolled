---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Pool of Radiance engine specification

Formal description of the DOS *Pool of Radiance* engine (GOG release 1.3) and its data, written so the game can be reimplemented (target: a web browser). Back to the [project README](../README.md).

## Status legend

- **Observed**: read directly from engine code, or validated against every record in the shipped data
- **Inferred**: consistent with code and data but not proven; treat as a hypothesis
- **Unknown**: not yet examined

## Documents

| File | Covers | State |
|---|---|---|
| [[spec/architecture]] | Engine/data split, main loop, event model | v0.1 |
| [[spec/containers]] | EXE packing, overlays, DAX archives, RLE | v1.0 (complete) |
| [[spec/ecl]] | ECL virtual machine: encoding, memory map, opcodes | v0.5 |
| [[spec/maps]] | GEO maps, passability, wall sets | v0.5 |
| [[spec/graphics]] | Image blocks, animations, font, palette | v0.5 |
| [[spec/menus]] | Start-up (title, credits, code wheel), party screen, character creation flow, Modify, combat-icon editor | v0.1 |
| [[spec/sound]] | Sound driver: effect bytecode, timer, PC speaker and Tandy output | v0.1 |
| [[spec/records]] | Characters, monsters, items, item types, effects | v0.4 |
| [[spec/spells]] | Spell table (56 spells), casting, targeting, saves | v0.4 |
| [[spec/effects]] | Effect types 1–139: event hooks, handlers, durations, item effects | v0.8 |
| [[spec/town]] | Shops, temples (prices), items menu, appraisal, game modes | v0.6 |
| [[spec/commissions]] | Commissions, rewards, graveyard bounty, proclamations (all in ECL variables) | v0.5 |
| [[spec/camp]] | Encamp, memorise, rest (healing, spell learning, encounters), time units | v0.6 |
| [[spec/savegame]] | Save slot files and the 13 137-byte world state | v0.8 |
| [[spec/chargen]] | Character creation: rolling, racial/class/age tables, starting spells and gold | v0.6 |
| [[spec/progression]] | Experience table, level caps, demi-human limits, training | v0.5 |
| [[spec/combat]] | Dice, attack, to-hit, damage, backstab, ranges, saves | v0.3 |
| [[spec/open-questions]] | What remains, in priority order | living |

## External references

- Stephen S. Lee, *Pool of Radiance: Exhaustive Game Information*, v1.50 (2021), [GameFAQs](https://gamefaqs.gamespot.com/pc/564785-pool-of-radiance/faqs/73869). Written for PC 1.3 (the GOG version). Player-side facts to cross-check against: area maps and walkthrough (section 6), mechanics (sections 7–10), interface and combat commands (2.6), cheat mode (2.9.3). Version 2.00 (April 2026) adds a technical analysis (section 12: script opcodes and flag list, save format, annotated executable and overlay code, data segment) and a bug list (section 13). A local copy lives outside the repo at `/home/tmg/poolrad-reference/gamefaqs-lee-v2.00.md` (freely distributable with credit, but kept out of git with the other third-party material). Facts confirmed against it so far: the Area map (walls only, no doors, everything shown, refused in some areas, [[spec/maps]]); diagonal moves cost 1½ squares ([[spec/combat]]); the harbour's wilderness destinations ([[spec/commissions]] area scripts: local positions (7,29), (13,27) in area 26 and (9,29) in area 27 are its global (20,29), (26,27), (35,29), i.e. 13 columns per region); the `STING` cheat parameter.

## Engine identity

| Item | Value |
|---|---|
| `START.EXE` SHA-256 | `d825df2b174675c9088ba1489488bdeebe66ad2a22943f17d3a198e60b6a07bd` |
| `GAME.OVR` SHA-256 | `872964a32cef0fc32bbf83bab68b15e04ad36d59076f37b00a179dfee7928614` |
| Compiler | Borland Turbo Pascal (runtime "1983,91", likely 6.0) with FBOV overlays |
| Addresses in this spec | `seg:off` as Ghidra names them in the merged image (`POOL_MERGED.EXE`, load segment 0x1000) |

Function references use Ghidra's `FUN_seg_off` names from the merged image produced by `tools/mergeovr.py`, so they can be re-found.
