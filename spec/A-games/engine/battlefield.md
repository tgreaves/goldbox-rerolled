---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Battlefield (O, `FUN_34c7_1e31`)

Part of the [specification](../../README.md), part A. The battle grid and how it is built from a map area or a wilderness square. Conventions (evidence marks, `c[x]`, `R[x]`, distances, the combat record) are those of [combat-rules.md](combat-rules.md#conventions). Curse of the Azure Bonds: [coab/combat.md](../coab/combat.md).


1. Load combat icon set: `DUNGCOM` when `DS:49FA` = 1 (map area), otherwise `WILDCOM`/`RANDCOM` (`FUN_34c7_1244`)
2. Allocate the grid: 0x4E9 bytes = 7-byte header + **25 rows × 50 columns** (`cell = grid[7 + row·50 + col]`); header [2],[3] = view origin (first party member's position − 3)
3. Build terrain: map areas `FUN_34c7_0810`, wilderness `FUN_34c7_11b4` (**?**)
4. Create a 22-byte combat record per list entry (`FUN_34c7_12e1`); entries after the first `B[0x67C]` (party size) are monsters (record [0x13] = 1); record [9] = facing from `DS:02F2[party facing / 2]`, monsters face the opposite way; monsters with morale byte 0 or > 102 get `B[0x58C]` (encounter morale) + NPC bit
5. Place combatants (`FUN_34c7_19f5`): deployment zones per side from `DS:0306` (12 bytes per direction: 6 rows of [min col, max col]); `FUN_34c7_1577` finds a free spot; a monster that cannot be placed is removed; party members who cannot act are laid down as bodies (cell set to 0x1F, original cell remembered in `DS:66D6`)
6. Effect hook 8 for everyone, `FUN_3aae_2879`, game mode `DS:49F3` = 5

## Wilderness battlefields (O, `FUN_34c7_11b4`)

1. Fill all 1250 cells with cell 0x17 (open ground)
2. Terrain type `DS:465A` = overland tile at `DS:3648 + y·44 + x + region·13`, with x = `A[byte 0x186]` (ECL 0x49C3), y = `A[byte 0x188]` (ECL 0x49C4), region 0/1/2 for area kind `DS:49FA` = 2/3/4 (areas 25–27)
3. Classify the tile into feature flags (`FUN_34c7_08a4`, below)
4. Run the river, tree and scatter passes, then the finishing pass shared with map areas

`DS:3648` is the overland map of the three wilderness regions (13 columns each, rows of 44 bytes; values are overland tile ids, **I**).

### Terrain flags (O, `FUN_34c7_08a4`)

A hard-coded range table maps the overland tile id to a flag byte. The names are inferred from what each flag makes the passes generate:

| Bit | Inferred meaning | Effect |
|---|---|---|
| 0x01 | plain | none of its own |
| 0x02 | rocky | rocks 45/255, tufts 10/255 |
| 0x04 | light woods | trees 3 %, rocks 25/255 |
| 0x08 | forest | trees 7 % |
| 0x10 | river | river 75 % |
| 0x20 | stream | river 35 % |
| 0x40 | swamp | trees 4 % (swamp trees and logs), marsh plants 30/255, tufts 5/255, puddles possible |
| 0x80 | arid | no trees; cactus 15/255, tufts 25/255, rocks 10/255 |

| Tile ids | Flags |
|---|---|
| 1–2, 0x28–0x29, 0x2B, 0x4F–0x56, 0x5B–0x5C, 0xF1 | 0x01 |
| 0xA8–0xB1 | 0x21 |
| 0xB9, 0xBC–0xC0 | 0x11 |
| 3–4, 6–9, 0x13–0x15, 0x17–0x19 (first match wins) | 0x03 |
| 7, 0x0A–0x12, 0x16, 0x1A–0x24, 0xC9–0xD0 | 0x02 |
| 0xD1–0xD5 | 0x12 |
| 0x25, 0x39, 0x40, 0x9A–0x9E, 0xA4–0xA5, 0xB4, 0xEF–0xF0, 0xF3, 0xFA, 0xFC | 0x04 |
| 0x27–0x2C, 0x99, 0x9F | 0x05 |
| 0x2D–0x2E, 0x33–0x38, 0x43–0x4D, 0x5D–0x61 | 0x44 |
| 0xB5–0xB8, 0xBA, 0xC1–0xC8 | 0x14 |
| 0x2F–0x32, 0x62–0x65, 0xF2 | 0x40 |
| 0x26 | 0x41 |
| 0xB2–0xB3 | 0x60 |
| 0x3A–0x3C, 0x41–0x42 | 0x48 |
| 0x3D–0x3F, 0x79–0x7C, 0x87–0x89, 0x8B, 0x8D, 0x90–0x93, 0x95, 0x97–0x98, 0xA0–0xA2, 0xA6–0xA7, 0xD6–0xD8, 0xEE | 0x08 |
| 0x57–0x5A, 0xA3, 0xE0 | 0x88 |
| 0x7C–0x7D, 0x8A, 0x8C, 0x8E–0x8F, 0x94, 0x96 | 0x09 |
| 0x7E–0x85, 0xE5–0xE7 | 0x28 |
| 0xD9–0xDF | 0x18 |
| 0x4E, 0xF5, 0xE8–0xE9 | 0x20 |
| 0x6D, 0xF4–0xF6 | 0x80 |
| 0x6E–0x71, 0x73–0x78 | 0x81 |
| 0x66–0x6C, 0x72 | 0x90 |
| 0xE1–0xE4, 0xEA–0xED | 0xA0 |
| anything else (including 0) | not set: the original returns an uninitialised byte; use 0 |

The tests run in the order listed, so the first matching row wins. If the result has bit 0x80 and ECL word `A` 0x4AB3 (byte offset 0x366) is 0xFF, the value becomes `(flags + 0x80) | 1`, which clears 0x80 and sets 0x01 (**I**: a story state that changes the arid terrain).

### River pass (O, `FUN_34c7_0bde`)

Runs if d100 ≤ 75 (flag 0x10) or ≤ 35 (flag 0x20); the d100 is rolled whatever the flags (chance 0).

- Start column = `34 − 5d4` (one `roll(5, 4)`), then decreased until `(col + 2) mod 7 = 0` (so 12, 19 or 26)
- For each row 0–24, while the column is at most 49: (row, col) = 0x32 and (row, col+1) = 0x33 (the two
  water banks; at column 49 the second write lands on the next row's column 0, the grid being one flat
  array: with start 26, row 23 puts 0x33 at (24, 0)); then d20 = 1 **or an odd number of fords so far**
  → a ford (nested `FUN_34c7_0b97`): (row, col) = 0x34, (row, col+1) = 0x35, fords + 1. So fords come
  in pairs of rows. Then col + 1. The river runs diagonally down and to the right.
- Only if no ford was made: a crossing at row `r = 16 − d9`, col = start + r: the ford procedure at
  (r, col) and at (r + 1, col + 1) (four cells)
- Columns outer, rows inner in the tree and scatter passes below too (PoR image 0x25B01, 0x25E17).

The d20 is rolled in every row the river crosses, also when an odd count forces the ford. The ford
procedure takes the row and column it is called with and writes through the flat grid too.

Port: matches this since 2026-10-20 (`rules/battlefield.ts` `river`, the procedure CotAB's river uses
too, with PoR's numbers in the profile: fixed banks, `pairs`, the crossing, `edge: 'spill'`); the tree,
scatter and finishing passes scan columns outer. Before that the port rolled single-row fords before
the banks, always added a two-cell crossing, skipped the d100 without a river flag, clipped the
column-49 write and scanned rows outer. Tested whole field for field against a statement-by-statement
transcription of `FUN_34c7_11b4` and its passes (`test/wildfield.test.ts`).

### Tree pass (O, `FUN_34c7_0d13`)

Chance per cell: 1 %; flag 0x04 → 3 %; 0x40 → 4 %; 0x08 → 7 %; 0x80 → 0 (later tests override earlier ones). For every cell in rows 1–24 where the cell and the cell above are both open ground, roll d100 ≤ chance:

- size = d10 ≤ 8 → `(d10 + 1) / 2` (1–4), else `4 + d2` (5–6); with flag 0x40, size = `3 + d3`
- cell = `0x23 + size` (trunks 0x24–0x27, logs 0x28–0x29); for size < 5 the cell above = `0x1F + size` (crown 0x20–0x23)

### Scatter pass (O, `FUN_34c7_0e9e`)

Parameters: `a` = 0, `b` = 15, `c` = 0, `d` = 40. Flag 0x02 → b 45, d 10; 0x04 → b 25; 0x40 → d 5, c 30; 0x80 → a 15, d 25, b 10. For every open-ground cell roll `r` = d255:

| r | Result |
|---|---|
| ≤ a | cactus: d4 = 4 and the cell above is open → tall cactus (0x40, with top 0x41 above); d4 < 4 → 0x3C + d4 |
| ≤ a + 6 | shrub or low grass `0x36 + d3` |
| ≤ a + 6 + b | rocks `0x29 + d4` |
| ≤ a + 6 + b + c | marsh plant `0x39 + (d10 − 1) / 3` |
| ≤ a + 6 + b + c + d | grass tuft `0x2D + d4`; a 4 (puddle 0x31) stays only with flag 0x40, otherwise `0x2D + d3` |
| higher | nothing |

## Cell table (O, `DS:2744`, 4 bytes per cell value)

| Byte | Meaning |
|---|---|
| 0 | movement: 1 = enterable, 0xFF = blocked (**I**: values fit the images; reader not yet traced) |
| 1 | eye height used by line of sight (0 for every cell) |
| 2 | sight block: 2 = blocks line of sight, 0 = see-through |
| 3 | image slot to draw |

Image slots are filled at battle start (`FUN_34c7_1244`): `DungCom` (25 images) or `WildCom` (34 images) into slots from 0, then `RandCom` (6 images) into slots 0x22–0x27. Cells 0x00–0x1F are the map-area set and cells 0x20–0x41 the wilderness set; cells 0x1A–0x1F are shared (RandCom).

| Cells | Image | Move | Sight |
|---|---|---|---|
| 0x01–0x16, 0x19 | dungeon wall and door pieces (slots 0–0x15, 0x18) | doors and partial pieces 0x05, 0x09, 0x0B, 0x0D, 0x0F, 0x11 enterable; the rest blocked | blocked pieces block |
| 0x17 | open ground (slot 0x16, blank) | yes | clear |
| 0x18 | slot 0x17 | yes | clear |
| 0x1A, 0x1B | rocks (RandCom 0, 1) | yes | clear |
| 0x1C | bone (RandCom 2) | yes | clear |
| 0x1D | potted flower (RandCom 3) | yes | clear |
| 0x1E | cloud (RandCom 4) | yes | clear |
| 0x1F | fallen body (RandCom 5) | yes | clear |
| 0x20–0x23 | tree crowns (Wild 0–3) | no | blocks |
| 0x24–0x27 | tree trunks, 0x27 = swamp tree (Wild 4–7) | yes | clear |
| 0x28, 0x29 | fallen logs (Wild 8, 9) | no | clear |
| 0x2A–0x2D | rocks and a boulder (Wild 10–13) | yes | clear |
| 0x2E–0x30 | grass tufts (Wild 14–16) | yes | clear |
| 0x31 | puddles (Wild 17) | yes | clear |
| 0x32, 0x33 | river, left and right bank (Wild 18, 19) | no | clear |
| 0x34, 0x35 | ford (Wild 20, 21) | yes | clear |
| 0x36 | open ground (Wild 22) | yes | clear |
| 0x37, 0x38 | shrubs (Wild 23, 24) | no | clear |
| 0x39 | low grass (Wild 25) | yes | clear |
| 0x3A, 0x3B | reeds (Wild 26, 27) | yes | clear |
| 0x3C | marsh weed (Wild 28) | no | clear |
| 0x3D–0x3F | cactus (Wild 29–31) | no | blocks |
| 0x40 | tall cactus base (Wild 32) | yes | clear |
| 0x41 | tall cactus top (Wild 33) | no | blocks |

The two-cell objects (trees, tall cactus) put the obstacle in the upper cell and leave the lower cell walkable.

## Line of sight and range (O, `FUN_56c1_0422`)

`los(grid, &range, &x1, &y1, x0, y0)` walks a Bresenham line from (x0, y0) towards (x1, y1) (`FUN_56c1_01a0` sets it up, `FUN_56c1_02cc` steps it):

- each straight step costs 2, each diagonal step 3 (distance in half squares; a diagonal counts 1½)
- a second Bresenham line interpolates eye height between the two ends' cell byte 1 (always 0 in practice)
- the walk stops at a cell whose sight byte exceeds the eye height, unless grid header byte 6 is set (then terrain is ignored; it is 0 after setup)
- it also stops once the cost exceeds `2 × range + 1`

Returns true if the target was reached, with `range` set to the cost; otherwise false, with (x1, y1) set to the blocking cell. The step direction (0–7) is kept from `DS:25C1[(sy + 1)·3 + sx + 1]` (**I**).

## Map areas: squares → cells (`FUN_34c7_0810`)

All of this subsection is **O**. Called from `FUN_34c7_1244` when `DS:49FA` = 1 (otherwise `FUN_34c7_11b4`), right after the grid is allocated with `GetMem(0x4E9)` (not cleared) and header bytes [4] = 0, [5] = 1, [6] = 0 are set. Reference implementation: `tools/battlefield.py`.

**Orientation.** The party's facing (`DS:6AAF`) is never read: the grid is always north-up, with columns running east and rows running south. Each map square is a parallelogram sheared one column right per row. Facing only matters later, for the combatants' facing and deployment zones.

### Driver

```
X, Y = DS:6AAD, DS:6AAE                     // party square, signed bytes
for dy in -2..2:                            // outer loop
  for dx in -6..6:                          // inner loop
    x, y = X+dx, Y+dy                       // no wrap-around
    W = classify(x, y, 6); N = classify(x, y, 0); E = classify(x, y, 2)
    stamp_floor_west(); stamp_north(); stamp_nw(); stamp_ne()   // 02ba, 0377, 040f, 0615
finish()                                    // 0000, below
```

`plot(c, r, piece)` (`FUN_34c7_0221`) writes `piece + 1` to `grid[dy·5 + 10 + r][dx·6 + dy·5 + 21 + c]`, skipped if the row is outside 0–24 or the column outside 0–49. The tables below give the cell values (`piece + 1`) at block offsets (r, c). The party's square has its block origin at row 10, column 21.

### Edge classes (`FUN_34c7_012b`, `FUN_34c7_01ad`)

Direction `d` is 0 N, 2 E, 4 S, 6 W; the neighbour across is `(x + DS:2736[d], y + DS:273F[d])`.

```
edge(x, y, d):                              // 012b: one side of the edge
  if 0 ≤ x ≤ 15 and 0 ≤ y ≤ 15:
    if passage(x, y, d) == 0: return 1      // FUN_55a0_0350 (stub 3d5:2f)
    if walltype(x, y, d) == 0: return 0     // FUN_55a0_047b (stub 3d5:2a)
    return 3
  return (y == DS:6AAE and d in {2, 6}) ? 0 : 1
classify(x, y, d) = edge(x, y, d) | edge(nx, ny, (d + 4) mod 8)   // 01ad
```

Classes: 0 open, 1 wall, 3 door. A door is any wall side whose passage value is not 0, so passable walls and locked doors (2, 3) both count. Since 1 | 3 = 3, a door seen from either side makes a door. Off-map edges are walls, except the east and west edges of squares on the party's own row. The game's movement code wraps coordinates at 0–15, but this code never wraps.

### Floor and west edge (`FUN_34c7_02ba`)

```
for r in 2..4, c in 0..5: cell 0x17           // floor
if W == 1: for r in 2..4: (r, r−1) = 0x05; (r, r) = 0x04; (r, r+1) = 0x0E
if W == 3: (2, 1) = 0x09; (4, 5) = 0x01       // door posts; the middle stays floor
```

### North edge (`FUN_34c7_0377`)

`N == 1`: (0, 3) = (0, 4) = 0x06 and (1, 3) = (1, 4) = 0x0B. Otherwise all four cells are 0x17. A door on the north edge looks open here; only the corner pieces show it.

### North-west corner (`FUN_34c7_040f`), cells (0,1) (0,2) (1,1) (1,2)

`f` = 1 when `classify(x, y−1, 6)` = 0 and `classify(x−1, y, 0)` = 0 (the corner's other two arms are open).

| Cell | Rule (first match) |
|---|---|
| (0,1) | N=0: W=0 → 17, W=3 → 0E, W=1 → f ? 01 : 0E. N≠0: W=0 → f ? 10 : 06, W≠0 → f ? 13 : 03 |
| (0,2) | N=0 → 17, N=3 → 12, N=1 → 06 |
| (1,1) | W=0: N=0 → 17, else f ? 11 : 0B. W=3 → f ? 15 : 08. W=1 → f ? 02 : 04 |
| (1,2) | W≠1: N=0 → 17, N=3 → 18, N=1 → 0B. W=1: N=0 → 0E, N=3 → 16, N=1 → 07 |

### North-east corner (`FUN_34c7_0615`), cells (0,5) (0,6) (1,5) (1,6)

`g7 = classify(x, y−1, 2)` (east edge of the north neighbour), `g8 = classify(x+1, y, 0)` (north edge of the east neighbour).

| Cell | Rule (first match) |
|---|---|
| (0,5) | N=0: g7=1 → 05, else 17. N=3 → 10. N=1 → 06 |
| (0,6) | N=0: g7=0 → 17; g7=3 → (E=0 and g8≠0) ? 19 : 02; g7=1 → (E=0 and g8≠0) ? 0C : 04. N≠0: E≠0 → 0A; g8≠0 → 06; g7=0 → 12; else 14 |
| (1,5) | N=0 → 17, N=3 → 11, N=1 → 0B |
| (1,6) | N=0: g7=0 → 17; E≠0 → 05; g8=0 → 09; else 0D. N≠0: E≠0 → 0F; g8=0 → 18; else 0B |

The E class is only used here. No routine draws an east or south edge: square x+1's west edge is the same edge as square x's east edge (`classify` ORs both sides), and the next row's north edge does the same for south edges. The south edges of the last row (dy = 2) are never drawn.

### Coverage and order

- A block writes rows 2–4 at columns 0–5 and rows 0–1 at columns 1–6. Column 0 of rows 0–1 is the previous block's column 6, and blocks never overlap, so the only overwrite is the west-edge pieces on top of the floor.
- For dx = −6, column 0 of rows 0–1 falls left of grid column 0, and for dx = 6, column 6 of rows 2–4 falls right of column 49, so every one of the 1250 cells gets written. This is checked by `tools/battlefield.py` on New Phlan (GEO3 #0 at (15,1)) and on GEO2 #20 at (9,6).
- Every edge of an off-map square is a wall, so it becomes a closed block. The exception is the party's row, where east and west edges are open (the north edge stays a wall), so the party's row carries on as an open corridor past the east or west map border (New Phlan at (15,1): rows 10–14 open from column 28 to 49). The north and south map borders are always walls.

### Finishing pass (`FUN_34c7_0000`)

Columns 0–49 outer, rows 0–24 inner. On each cell whose image slot `DS:2747[cell·4]` = 0x16 (only cell 0x17), roll `FUN_5216_0de3(1, 100)`:

- 98 → 0x1A
- 99 → 0x1B
- 100 → if area `DS:84DC` ≠ 10 and another d100 = 1, then d10 ≤ 6 → bone 0x1C, else potted flower 0x1D
- 1–97 → no change

Wilderness battlefields also run this pass.

Port: `rules/battlefield.ts` `mapBattlefield`, one procedure with CotAB's 0x2555D (coab/combat.md
"Map-area generator"); PoR's profile (`R.mapField`) gives the corner cell 0x04, the finishing pass and
no furnishing.
