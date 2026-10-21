---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Maps, movement and wall sets

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Evidence marks as in the README; addresses are PoR's (`FUN_seg_off`).
> The drawn view here is the conformance target of D6. *Informative:* reference decoder and
> renderer `tools/geo.py`. Curse of the Azure Bonds: [coab/assets.md](../coab/assets.md).

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
- Exception: in areas 0 and 10 (current area id `DS:84DC`) out-of-bounds lookups return 0

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
| 9 | 154 | 1 | 2 | 5 | 4 | far edge piece: the column between two far front walls (Drawing order) |

`draw_piece(kind, walltype, row, col)`: for each cell in the W×H block, tile id = `walls[(walltype-1)*156 + start + i]`; tile 0 = transparent; cells outside 0..10 are clipped.

### Drawing order (painter's algorithm)

(**O**, `FUN_55a0_05fd`, read instruction by instruction; CotAB's `Draw3dWorld` 0x53EC0 is the same
routine with the same constants, [coab/assets.md §3](../coab/assets.md#geo-and-walldef-unchanged-o).)
The routine takes the party's x, y and facing *f* (0, 2, 4, 6). Let `L = (f+6)%8`, `R = (f+2)%8`,
`B = (f+4)%8`, `dx`/`dy` the vectors above, `col[k]`/`row[k]` the base column and row of kind *k*, and
`wall(x, y, d)` the view's wall lookup `FUN_55a0_047b` (below). `piece(k, t, c)` draws kind *k* of wall
type *t* at column *c* and row `row[k]` (`FUN_55a0_0211`).

1. If `DS:6AAC` ≠ 0, draw the overhead map instead ([below](#overhead-map-o-fun_55a0_0000)) and stop.
2. Draw the background bands (`FUN_55a0_0174`, "Background colours").
3. (*px*, *py*) = (x + 2·dx[f], y + 2·dy[f]), the square two ahead. For depth 2, 1, 0 in turn, draw that
   depth's pieces (below), then step (*px*, *py*) one square back by dx[B], dy[B].
4. Copy the finished view to the screen (`FUN_55a0_05f3` → `FUN_1464_1b52`).

**Depth 2.**

- *Front walls, left walk*: from (*px*, *py*), *k* = 0 … 3 squares to the left (each step adds dx[L],
  dy[L]), with column offset *o* = −2*k* and `prev` = 0 at the start. For each square, w = `wall(x, y, f)`;
  if the square is outside the map (x or y outside 0–15) and `wall(x, y, R)` = 0, `prev` := 0. Then:
  - w ≠ 0: if `prev` > 0, `piece(9, prev, col[9] + o + 1)`; `prev` := w; `piece(0, w, col[0] + o)`.
  - w = 0: if `prev` > 0 and the previous square (x − dx[L], y − dy[L]) has `wall(…, L)` ≠ 0,
    `piece(9, prev, col[9] + o + 1)`; `prev` := 0.
- *Front walls, right walk*: the same from (*px*, *py*) to the right (dx[R], dy[R]), *o* = +2*k*, the
  outside test with `wall(x, y, L)`, the previous square's `wall(…, R)`, and the edge piece at
  `col[9] + o − 1`. The front wall of the square ahead is thus drawn twice, once by each walk.
- *Side walls*: from (*px*, *py*), *k* = 0 … 2 squares to the left: `wall(x, y, L)` ≠ 0 → `piece(1, w,
  col[1] − 2k)` for *k* = 0, `col[1] − 2k − 1` beyond; then *k* = 0 … 2 to the right: `wall(x, y, R)` → `piece(2,
  w, col[2] + 2k)` for *k* = 0, `col[2] + 2k + 1` beyond.

Kind 9 thus fills the column between two adjacent far front walls (columns 5, 3, 1 and 5, 7, 9 are the
front walls; 4, 2 and 6, 8 the gaps), in the type of the wall nearer the centre.

**Depth 1.** From the square two to the left of (*px*, *py*), three squares stepping right, column offset
*o* = −6, −3, 0: `wall(x, y, f)` → `piece(3, w, col[3] + o)`, then `wall(x, y, L)` → `piece(4, w,
col[4] + o)`. Then from the square two to the right, three squares stepping left, *o* = 6, 3, 0: `piece(3,
…, col[3] + o)` for the front wall, `wall(x, y, R)` → `piece(5, w, col[5] + o)`.

**Depth 0.** The same with one square each side and steps of 7 columns: from the square to the left, *o* =
−7, 0: front → `piece(6, w, col[6] + o)`, `wall(x, y, L)` → `piece(7, w, col[7] + o)`; from the square to
the right, *o* = 7, 0: front → kind 6, `wall(x, y, R)` → `piece(8, w, col[8] + o)`.

The centre square's front wall is drawn by both halves of each depth; later pieces overwrite earlier ones
where they overlap (everything at depth 0 last).

**The view's wall lookup** (`FUN_55a0_047b(x, y, d)`, signed bytes): if (x, y) is outside 0–15 and the
area (`DS:84DC`) is 0 or 10, the result is 0; otherwise a coordinate above 15 becomes 0 and one below 0
becomes 15 (not modulo 16: x + 4 = 18 reads column 0), and the result is the wall nibble of side *d*
(0 N, 2 E, 4 S, 6 W) of that square.

**A piece** (`FUN_55a0_0211(col, row, type, kind)`): rows *r* = `row` … `row` + H − 1, and within each
row columns *c* = `col` … `col` + W − 1; a counter starting at `start[kind]` advances one per cell,
**clipped cells included**. A cell with *r* and *c* in 0–10 and tile id `walls[(type − 1)·156 + counter]`
≠ 0 is drawn by `FUN_5924_015d(c + 2, r + 2, id, 1, 1)`: the tile from the tile bank (below) at screen
cell (*c* + 2, *r* + 2), masked (`FUN_1464_08d4`, colour 13 leaves the pixel under it) into the back
buffer `DS:4A20`. A tile id whose bank is not loaded is skipped.

**Encounter sprites** are drawn after the view ([graphics.md, "Encounter sprites"](graphics.md#encounter-sprites-o)):
`FUN_2fea_054e` first redraws the view (`FUN_54cf_016d`) when a sprite is already on show and no
picture is, so a sprite that comes nearer replaces its farther frame.

**Background colours** (O, the redraw `FUN_54cf_016d` (stub `03ca:0025`) → `FUN_55a0_0155`/`0174`). Four bands fill the 88-pixel view before the walls (`FUN_1464_2632` fills at cell column 2, 11 cells wide: y 16, 43 rows; y 59, 1 row; y 60, 2 rows; y 62, 42 rows): sky rows 0–42, a 1-pixel horizon line (row 43), a 2-pixel band (rows 44–45), floor rows 46–87. Map areas only (`DS:49FA` = 1 or ECL 0x49E6 ≠ 0).

- Sky: `DS:0C26[v]` (0, 15, 12, 11, 13, 10, 9, 14, repeated for 8–15), v = ECL 0x49FD, or 0x49FE when the **party's** square has event byte bit 7 set (`FUN_55a0_057a`). The index is the whole stored word (no mask); scripts store values below 16 (**I**). Scripts set 8 (black) indoors and at night, 11 (light cyan) by day, 9, 10, 13 elsewhere.
- Horizon line (`FUN_54cf_00c7`) and band (`00fb`) from engine register 0xC05F (`DS:6F69`): line 0 for 8 or 0x41, else 15; band 8 for 8, else 7.
- Floor (`FUN_54cf_012f`) from register 0xC059 (`DS:6F68`): 0x0B → 8, 6 → 1, anything else (0x41, 9, 0xDB) → 6, brown.
- Both registers are recomputed only after a write (`DS:84E5`); the VM reset (`FUN_2fea_01b6`) sets 0xC059 = 0x41 and 0xC05F = 9, the game start 0xDB and 0xE8. Only ECL8 writes them (0xC05F = 65 or 8, 0xC059 from a table).
- The light-magenta parts of wall tiles show these bands ([graphics.md](graphics.md)).

When `DS:6AAC` ≠ 0 the overhead map (`FUN_55a0_0000`, [below](#overhead-map-o-fun_55a0_0000)) is drawn instead.

### Tile bank (O, `FUN_5924_015d`, `FUN_5924_003b`, `FUN_55a0_0e08`)

Tile ids select one of five banks by range; each bank is an image record of 8×8 sub-images (pointer at `DS:5E3A + bank·4`), and the tile is sub-image `id − base[bank]` with `base` = DS:2722 = [1, 46, 116, 186, 256]:

| Bank | Ids | Source |
|---|---|---|
| 0 | 1–45 | shared tiles, `8X8D1` record 203 (45 tiles) |
| 1–3 | 46–115, 116–185, 186–255 | wall-set slots 1–3, 70 tiles each (below) |
| 4 | 256–286 | `8X8D1` record 202 (31 tiles) (**?** use) |

Loading wall-set record *r* into slot *s* (`LOAD_WALLSETS`, `FUN_55a0_0e08`):

1. `WALLDEF<block>` record *r* holds n = size / 0x30C sets; set *k* (1-based) goes into slot s + k − 1 (n + s − 1 > 4 is an error)
2. Every tile byte ≥ 45 (DS:272C) is increased by `base[s] − base[1]`, computed once from the starting slot. Multi-set records therefore store their later sets' ids already in slot-2/slot-3 numbering (bytes up to 255)
3. Tiles: with one set, `8X8D<block>` record *r*; with several, record `(r or 10)·10 + k` for set *k* (e.g. WALLDEF3 #0 → 8X8D3 #101–103; WALLDEF4 #21 → #211–212)
4. Slot bookkeeping: `DS:6AAE + 4s` = r, `DS:6AB0 + 4s` = s; slots filled by later sets get 0xFFFF (saved to ECL 0x4AFA–0x4AFF)

Wall type *t* (1–15) indexes the 0x30C × 3 table directly: `(t − 1)·156`, i.e. slot `(t − 1) div 5 + 1`, entry `(t − 1) mod 5` (O).

The kind-6 piece (7 × 8 tiles, the wall directly ahead) of every wall type is a complete flat wall face, with tile 0 cells transparent; how GoldBox Rerolled's optional WebGL view uses it is part C ([exploration-view.md](../../C-port/exploration-view.md)).

## Overhead map (O, `FUN_55a0_0000`)

The **A**rea command toggles `DS:6AAC`. While it is set, every redraw of the 3D view (`FUN_55a0_05fd`) draws the overhead map in its place, so the map follows the party as it moves until Area is pressed again. It is switched off when an encounter sprite is drawn, on starting a game, and whenever ECL 0x49FB is non-zero ("Not Here").

- **Window.** 11 × 11 squares, one 8 × 8 cell each, filling the 88-pixel view. The window is centred on the party and clamped to the map: its left column is `x − 5` limited to 0–5, and the same for the top row.
- **Squares.** Each square is drawn as tile `0x104 + mask` from the tile bank, where the mask has bit 0 for a wall on the north side, bit 1 east, bit 2 south and bit 3 west. A wall counts if its wall type (`FUN_55a0_047b`) is non-zero, so doors look the same as walls, and locked doors are not marked.
- **Party.** Tile `0x100 + facing` at the party's square.
- **No fog of war.** Every wall inside the window is shown, explored or not. The engine keeps no record of visited squares, and the save file has none.
- **Edges.** Squares outside 0–15 show no walls, unless `DS:84DC` is neither 0 nor 10. In that case coordinates wrap (**I**: which areas set it).

## Open

- Which areas make the overhead map wrap its coordinates ("Edges" above: `DS:84DC`, the current area id, neither 0 nor 10; **I**). `DS:84DC` is the ECL record number of the area, saved as A word 0x49F2; areas 0, 10 and 25–27 are special-cased in code.

Answered since the first draft: the background (Background colours, above), the view drawn while `DS:6AAC` is set (Overhead map) and the tile bank loader (Tile bank).
