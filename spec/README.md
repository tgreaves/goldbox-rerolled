---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Pool of Radiance engine specification

Formal description of the DOS *Pool of Radiance* engine (GOG release 1.3) and its data, written so the game can be reimplemented (target: a web browser). Back to [[pool-of-radiance-re/index]].

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
| [[spec/records]] | Characters, monsters, items, item types, effects | v0.4 |
| [[spec/spells]] | Spell table (56 spells), casting, targeting, saves | v0.4 |
| [[spec/effects]] | Effect types 1–139: event hooks, handlers, durations, item effects | v0.8 |
| [[spec/savegame]] | Save slot files and the 13 137-byte world state | v0.8 |
| [[spec/chargen]] | Character creation: rolling, racial/class/age tables, starting spells and gold | v0.6 |
| [[spec/progression]] | Experience table, level caps, demi-human limits, training | v0.5 |
| [[spec/combat]] | Dice, attack, to-hit, damage, backstab, ranges, saves | v0.3 |
| [[spec/open-questions]] | What remains, in priority order | living |

## Engine identity

| Item | Value |
|---|---|
| `START.EXE` SHA-256 | `d825df2b174675c9088ba1489488bdeebe66ad2a22943f17d3a198e60b6a07bd` |
| `GAME.OVR` SHA-256 | `872964a32cef0fc32bbf83bab68b15e04ad36d59076f37b00a179dfee7928614` |
| Compiler | Borland Turbo Pascal (runtime "1983,91", likely 6.0) with FBOV overlays |
| Addresses in this spec | `seg:off` as Ghidra names them in the merged image (`POOL_MERGED.EXE`, load segment 0x1000) |

Function references use Ghidra's `FUN_seg_off` names from the merged image produced by `tools/mergeovr.py`, so they can be re-found.
