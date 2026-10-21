---
created: 2026-10-16
tags: [reverse-engineering, gold-box, spec]
---

# Overland travel (wilderness)

Areas 25–27 are the western, central and eastern wilderness once their `on_enter` has cleared ECL 0x49E6 (see [[spec/architecture]], re-entering). The same three areas also hold the lair maps: `on_enter` loads a GEO map instead when ECL 0x4A9E = 255 ("entered a lair"), and the lair's exit sets it back to 0. All of this page is observed (O) unless marked.

## Tables (data segment of `START.EXE`)

| Address | Size | Contents |
|---|---|---|
| `DS:3648` | 36 rows × 44 | tile id per square, row-major (the whole wilderness, all three areas) |
| `DS:0C36` | 9 × 6 bytes | plot-dependent squares 1–9: x, y, tile (u16 each); see below |
| `DS:3C76` | 5 bytes | first global column per area kind `DS:49FA`: kinds 2, 3, 4 (areas 25, 26, 27) → 0, 13, 26 |
| `DS:2736`, `DS:273F` | 8 signed bytes each | x and y step per facing ×2 (0 = N, 2 = E, 4 = S, 6 = W; odd values are diagonals, unused) |

The party's position is the area's own x in ECL 0x49C3 (0–15) and y in ECL 0x49C4 (0–35). The global column is `DS:3C76[kind] + x`, so neighbouring areas overlap by three columns. The GameFAQs guide numbers squares globally: its west boat landing (20,29) is area 26 at x = 7.

## Graphics

- Tiles are 24 × 24, 4 bpp, from `SQRPACI.DAX`: tile id t is frame t − 1 of record 1 (ids 1–128) or frame (t − 1) − 128 of record 2 (ids 129–255). Loaded into `DS:5E52` and `DS:5E56` (load-image 0x270EB, 0x2710D) and drawn by `FUN_58af_00f1`, which takes ids above 127 from the second image.
- The party marker is three images with two frames each from `ICON.DAX` records 0/128, 1/129 and 2/130, loaded into icon slots 9–11 with mask colour 0.

## The view (O, `FUN_54cf_0000`, `FUN_54fa_0000`)

A 5 × 5 window of tiles, 120 × 120 pixels (each tile 3 × 3 character cells). The party's cell in the window is

- column: x < 2 → x; x < 42 → 2; x = 42 → 3; else 4 (global x)
- row: y < 2 → y; y < 34 → 2; y = 34 → 3; else 4

so the window is centred on the party except at the map's edges, and its top-left square is (global x − column, y − row).

Each square shows its map tile, except the nine plot-dependent squares, which show their own tile when their condition holds (checked in order 1–9, no early exit):

| Square | Condition for the special tile |
|---|---|
| 1, 2 | never (no handler) |
| 3 | ECL 0x4A8C ≠ 255 |
| 4 | 0x4AD2 ≠ 0, or 0x4A7C bit 3 set, or 0x4A9F = 0 |
| 5 | 0x4AA0 bit 1 clear (the guide: kobold caves not yet found) |
| 6 | always |
| 7 | 0x4AA0 bit 0 clear (the guide: lizardman keep not yet found) |
| 8, 9 | 0x4AB3 > 253 (river pollution commission finished) |

The party marker (`FUN_58af_04fc`) is drawn in its cell, cycling through the six frames: slot 9 + phase / 2, frame phase mod 2, with phase `DS:6DDC` advanced by 1 (mod 6) on every redraw. When the facing ×2 (`DS:6AAF`) is above 3 (south or west) the image is mirrored left to right (`FUN_1464_15c7`).

## River cleansing (O, `FUN_4804_06b3`)

After the pyramid's sorcerer is beaten (ECL 0x4AB3 = 0xFE), entering area 26 with 0x4AA2 = 0 runs `FUN_4804_06b3(1)` between `on_enter` and `on_move` ([[spec/architecture]]). The script then prints "AS YOU LEAVE THE SORCERER'S PYRAMID..." and sets 0x4AA2 = 255 (ECL7 0x9AE0 → 0xAE8F, 0xAF35), which also opens the river to travel.

- `FUN_1464_1e5c(image, partial, frame, to, from)` recolours one frame of a tile image in place by a 16-entry colour map. With `partial` ≠ 0 each matching pixel changes only if `Random(4)` = 0.
- River frames (`DS:0900`, 11 bytes; above 0x7F = frame & 0x7F of the second image): 0x65–0x6B, 0x71, 0xE0–0xE2, so tile ids 0x66–0x6C, 0x72, 0xE1–0xE3. Map `DS:091D` → `DS:092D`: colour 0 → 1, 7 → 2 (black pollution to blue water, grey dead land to green).
- Bank frames (`DS:090B`, 18 bytes): 0x56–0x59, 0x6C–0x70, 0x72–0x77, 0xDF, 0xF3, 0xF5 (tile ids 0x57–0x5A, 0x6D–0x71, 0x73–0x78, 0xE0, 0xF4, 0xF6). Map → `DS:093D`: 7 → 2.
- Sequence with argument 1: the view drawn at (17, 15) (`FUN_54fa_0000(x, y)` then the screen flip `FUN_1464_1b52`); nine times: a partial pass over every listed frame, then the view at the next position of `DS:094D`/`DS:095F`: (17, 15) ×3, (19, 20) ×3, (23, 25) ×3. Then a full pass, the view at (23, 25) and two message pauses. No delay of its own between passes (the recolouring is slow on the original hardware; the port waits 150 ms).
- With argument 0 (loading a save with 0x4AA2 ≠ 0) only the full pass runs, so the river stays clean.

## Moving (O, `FUN_3e76_0818`)

The command menu offers Cast, View, Encamp, Search, Look; the cursor keys set the facing to N/E/S/W and return a move. The main loop then runs `on_move` (which can cancel the move with ECL 0x6DC9 = 255 or change area), resolves the move, and runs `on_step`, as in map areas.

1. New x = clamp(0x49C3 + dx, 0, 15), new y = clamp(0x49C4 + dy, 0, 35); the tile is read from the raw map at the global column (plot-dependent tiles are not consulted).
2. Blocked, no message: tiles 0x4E, 0x7E–0x80, 0x82–0x84, 0xA8–0xAC, 0xAE–0xB3, 0xBC, 0xDD–0xDE, 0xE1–0xE9, 0xF5 (sea, lake and similar).
3. River tiles 0x66–0x6C and 0x72: while ECL 0x4AA2 = 0, "The river's stench drives you back." and no move.
4. Otherwise the position is stored and 12 hours pass (`FUN_4b46_03d5(12, 3)`: 12 units of hours).

No sound is played. Crossing between areas is done by the scripts' `on_move`: at the area's edge columns they set the new area's x and block (ECL 0x6E12) and `NEW_ECL` to the neighbouring area. Their own destination-tile check (`CALL 0xC01B`, then reading 0x035F) is dead code in the DOS version ([[spec/ecl]], CALL targets).

## Encounters

Encounter sprites in the wilderness always use the middle frame (frame 2) instead of one per distance (`FUN_2fea_054e` tests `DS:49FA` = 1).
