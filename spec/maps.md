---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Maps, movement and wall sets

Part of [[spec/README]]. Decoder/renderer: `tools/geo.py`.

## GEO record (O)

1026 bytes, loaded by `FUN_55a0_10c7` (aborts unless size is exactly 0x402):

| Bytes | Plane | Per-square byte (index `y*16 + x`) |
|---|---|---|
| 0–1 | header | skipped |
| 2–257 | 0 | walls: high nibble north, low nibble east |
| 258–513 | 1 | walls: high nibble south, low nibble west |
| 514–769 | 2 | event byte (ECL `0xC04F`); scripts use `& 0x7F` as event number |
| 770–1025 | 3 | passability, 2 bits per side: N bits 0–1, E 2–3, S 4–5, W 6–7 |

- Wall nibble 0 = open; 1–15 = wall type (see wall sets)
- Validated: 29 records; in most, both sides of a shared edge agree on wall presence (95–100%). Lower scores (64.8–86%) in a few records are **?** (one-way walls or wilderness)

## Coordinates (O)

- Party position `DS:6AAD` (X), `DS:6AAE` (Y), facing `DS:6AAF` ∈ {0,2,4,6} = N,E,S,W
- Lookups wrap: x or y < 0 → 15, > 15 → 0
- Exception: in area types 0 and 10 (`DS:84DC`) out-of-bounds lookups return 0 (no wall / blocked)

## Movement (O, `FUN_3e76_0d6d`, `FUN_55a0_0350`)

`passage(x, y, facing)`:

1. if wall nibble on that side is 0 → 1
2. else → plane-3 bits for that side

| Value | Result |
|---|---|
| 0 | blocked ("bump" sound) |
| 1 | move |
| 2 | locked door: menu **B**ash / **P**ick / **K**nock |
| 3 | locked door, variant: Pick behaves differently (**?** likely wizard-locked) |

## Wall sets (O, `FUN_55a0_0e08`)

- Three slots (1–3), filled by ECL `LOAD_WALLSETS a, b, c` from `WALLDEF<block>.DAX`
- A WALLDEF record holds one or more 0x30C-byte sets, filling consecutive slots
- Each set = 5 wall types × 0x9C (156) bytes of tile indices for the 3D view
- Wall type *t* (1–15) → slot `(t-1)/5 + 1`, type `(t-1)%5` (**I**)
- Tile indices ≥ a threshold (`DS:272C`) are rebased per slot (`DS:2722` table) so each slot's 8×8 tiles (`8X8D` files, loaded by `FUN_5924_003b`) don't collide

## 3D view renderer (O, `FUN_55a0_05fd`, `FUN_55a0_0211`)

The view is an **11×11 grid of 8×8 tiles** (88×88 px), placed at tile offset (+2, +2) on screen. Direction vectors (DS:2736 = dx, DS:273F = dy, index = facing 0–7):

| facing | 0 N | 1 | 2 E | 3 | 4 S | 5 | 6 W | 7 |
|---|---|---|---|---|---|---|---|---|
| dx | 0 | 1 | 1 | 1 | 0 | -1 | -1 | -1 |
| dy | -1 | -1 | 0 | 1 | 1 | 1 | 0 | -1 |

### Wall pieces

A wall type's 156 bytes are tile ids for 10 **piece kinds**, row-major. Constants from DS:0C8C/0C96/0CA0 (start, width, height in tiles), DS:0CAA (base column, word) and DS:0CBE (row, stride 2):

| Kind | Start | W | H | Base col | Row | Used for |
|---|---|---|---|---|---|---|
| 0 | 0 | 1 | 2 | 5 | 4 | front wall, 2 squares ahead |
| 1 | 2 | 1 | 4 | 4 | 3 | left side wall, 2 ahead |
| 2 | 6 | 1 | 4 | 6 | 3 | right side wall, 2 ahead |
| 3 | 10 | 3 | 4 | 4 | 3 | front wall, 1 ahead |
| 4 | 22 | 2 | 8 | 2 | 1 | left side wall, 1 ahead |
| 5 | 38 | 2 | 8 | 7 | 1 | right side wall, 1 ahead |
| 6 | 54 | 7 | 8 | 2 | 1 | front wall, current square |
| 7 | 110 | 2 | 11 | 0 | 0 | left side wall, current square |
| 8 | 132 | 2 | 11 | 9 | 0 | right side wall, current square |
| 9 | 154 | 1 | 2 | 5 | 4 | far edge piece (end of a run of far walls) |

`draw_piece(kind, walltype, row, col)`: for each cell in the W×H block, tile id = `walls[(walltype-1)*156 + start + i]`; tile 0 = transparent; cells outside 0..10 are clipped.

### Drawing order (painter's algorithm)

Let `L = (f+6)%8`, `R = (f+2)%8`, `B = (f+4)%8`; `wall(dir, x, y)` = [[spec/maps]] wall lookup.

1. **Depth 2** (square 2 ahead): walk 4 squares left and 4 right from it. For each square with a front wall (`wall(f)`), draw kind 0 at column `5 ± 2k`; maintain an edge-piece rule (kind 9 at ±1) where a run of front walls ends. For the 3 nearest squares on each side, draw side walls `wall(L)` as kind 1 and `wall(R)` as kind 2, column offsets `-2k-1` / `+2k+1`
2. **Depth 1**: from 2 squares to the left to 2 to the right (3 each side, step 3 columns): front walls kind 3 (col 4 ± 3k), side walls kinds 4/5
3. **Depth 0** (current square): 2 each side, step 7 columns: front walls kind 6, side walls kinds 7/8
4. Blit (`FUN_55a0_05f3`). Background (floor/sky, `FUN_55a0_0174`) is drawn first (**?** details)

When `DS:6AAC` ≠ 0 a different view (`FUN_55a0_0000`) is used instead (**?**, possibly wilderness/dark).

### Tile bank (O, constants; I, interpretation)

- Tile ids < 45 (DS:272C) are shared; ids ≥ 45 are offset by `base[slot] - base[1]` with `base` = DS:2722 = [1, 46, 116, 186] → +0, +70, +140 for slots 1–3
- Each slot's 8X8D record holds 70 tiles (header `count = 0x46`)

## Still to decode

- Background drawing and the alternate view (`FUN_55a0_0174`, `FUN_55a0_0000`)
- Exact bank layout built by `FUN_5924_003b` (which 8X8D record lands where)
- Area types (`DS:84DC`): values 0, 10, 0x19–0x1B seen in code
