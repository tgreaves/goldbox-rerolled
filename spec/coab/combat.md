# CotAB combat: differences from Pool of Radiance

Differences from [[spec/combat]]; anything not listed works as there. Addresses are CotAB image
offsets ([[spec/coab/README]], "Working image"); DS = image 0xABE0.

## Battlefield (O, 0x25CC0)

The grid builder 0x25CC0 (called by the battle start 0x268CB at 0x26985, before the combat records
0x25D70 and placement 0x2648E):

1. Loads `DungCom` (record 1, slots from 0) when A word 0x1CC (ECL 0x4BE6, the engine's 0x49E6) is
   set, else `WildCom` (slots from 0; the file holds 34 images, 0x00–0x21); then `RandCom` (6 images
   from slot 0x22). Strings at 0x25CA8, 0x25CB0, 0x25CB8.
2. Allocates the grid (0x4E9 bytes at DS:6EAC: 7-byte header, then `grid[7 + row·50 + col]`, 25 rows
   of 50); header bytes 4, 5, 6 = 0, 1, 0.
3. Map flag set → map generator **0x2555D**; else → wilderness generator **0x25C58** (below).

There is **no finishing pass** in either path (O: 0x25C58 and 0x2555D call none, and the battle start
calls nothing on the grid between 0x25CC0 and placement). PoR's `FUN_34c7_0000` (rocks, bones and
potted flowers on open ground) has no CotAB counterpart here. In CotAB's `RandCom` the cells 0x1A and
0x1B are a **table** and a **chair** (images R0, R1), so running PoR's finishing pass on a CotAB field
puts furniture outdoors (the bug this section was written to fix).

The map generator 0x2555D is a different procedure from PoR's `FUN_34c7_0810` (per square 0x24D63;
it furnishes rooms itself with tables 0x1A and chairs 0x1B: 0x24EA5, d10 ≤ 5, then a chair beside on
d10 ≤ 9 for each of four neighbours from DS:034B/DS:034F). **Not transcribed (?)**: the port still
builds CotAB map fields with PoR's generator and finishing pass.

### Dice (O, 0xE3:0x4D → 0x4BE31)

`roll(count, sides)` = Σ count × (Random(sides) + 1), as PoR's `FUN_5216_0de3`; the caller pushes the
count first (`[bp+8]`), then the sides (`[bp+6]`). Below, `dN` = `roll(1, N)` and `5d4` one call
`roll(5, 4)`.

### Blank ground (O)

The tree and scatter passes test a cell by its **image slot**: `DS:26A7[cell·4]` (byte 3 of the cell
table) = 0x16. Cells 0x17 (the fill) and 0x36 have slot 0x16; no pass writes 0x36 before they run, so
in practice the test is "still 0x17". PoR's tree and scatter passes make the same test
(`DS:2747[cell·4]` = 0x16 at 0x25A08 / 0x25BA5 of PoR's image).

### Wilderness generator (O, 0x25C58)

1. Fill the 1250 cells with 0x17 (FillChar 0x8F7:0x1AD2, 0x4E2 bytes).
2. Reads A bytes 0x186, 0x188 (the overland x, y) into locals it never uses; terrain type
   **DS:4A2C = A byte 0x342** (ECL 0x4CA1, the overland place).
3. Runs the river 0x25690, the tree pass 0x2579B and the scatter pass 0x25ADA, in that order. No
   finishing pass.

Every pass reads the flags through **0x25621**: `DS:0354[DS:4A2C]` (the place table, `T.placeTerrain`).
The flag bits mean what PoR's do ([[spec/combat]], "Terrain flags"); the passes use them differently.

All loops are Pascal `for` loops over bytes; the grid stride is 50 (`mul 0x32`).

#### River (O, 0x25690)

The same course as PoR's river (`FUN_34c7_0bde`), different cells, fords and no sure crossing:

- chance: 0; flag 0x20 → 35; flag 0x10 → 75 (later wins); runs if d100 ≤ chance (as PoR)
- start column `c` = 34 − 5d4 (one call `roll(5, 4)`; the port draws five d4), then decreased while
  `(c + 2) mod 7 > 0` (12, 19 or 26; as PoR). The start is saved in a local that nothing reads.
- for row 0–24, while `c` ≤ 49:
  - (row, c) = **0x3B + d2** (left half of the water, 0x3C or 0x3D)
  - if `c` < 49: (row, c + 1) = **0x3D + d2** (right half, 0x3E or 0x3F)
  - **d20 = 1** (rolled even when `c` = 49): ford, nested procedure 0x2563C(row, c):
    if `c` < 49, (row, c + 1) = **0x40**; if row < 24 and `c` < 49, (row + 1, c + 1) = **0x41**
  - c + 1
- no crossing after the loop (PoR adds one at row 16 − d9 when it made no ford).

Quirk (O, follows from the loop): the ford's lower cell (row + 1, c + 1) is the next row's left half,
which the next iteration overwrites with 0x3C/0x3D. So 0x41 never survives; a ford is the single cell
0x40 in place of a right half. The water cells cost 4 to enter, not blocked (cell table byte 0; the
port reads only "blocked or not", [[spec/coab/tables]] §3.12).

Against PoR's river (`FUN_34c7_0bde`, [[spec/combat]] "River pass"): PoR's banks are fixed cells (0x32,
0x33), its ford replaces both cells of the row (0x34, 0x35) and repeats on the next row (an odd count
of fords forces one), and it adds a crossing when no ford was made; PoR writes the second bank at
column 49 too (it spills into the next row's column 0), CotAB tests for it. The chance, the d100, the
start column and the d20 after the row's cells are the same.

#### Trees and logs (O, 0x2579B)

- flag 0x80 → the pass does nothing (no dice)
- chance = 10; flag 0x02 → −5; 0x04 → −2; 0x40 → +5; 0x08 → +10 (all that apply, added); if the
  result is below 0 it becomes 1 (unreachable: the least is 3)
- for column 0–49 (outer), row 1–24 (inner): if the cell and the cell above are blank ground and
  d100 ≤ chance:
  - a second d100 ≤ chance → **log**: (row, col) = **0x29 + d2** (0x2A, 0x2B; blocked)
  - otherwise a **tree**: crown (row − 1, col) = **0x1F + d5** (0x20–0x24), then trunk (row, col) =
    **0x24 + d5** (0x25–0x29). The two d5 are separate rolls, so a crown and trunk need not match.

PoR's tree pass (`FUN_34c7_0d13`) sets the chance by flags (1, 3, 4, 7, 0, last wins), sizes a tree
by d10 and draws its crown and trunk from that one size (logs as sizes 5–6, no crown).

#### Scatter (O, 0x25ADA with 0x25932)

A score from the flags picks a row of five odds; each blank cell then rolls once against them.

- score (a word) = 50; flag 0x10 → +10; 0x20 → +30; 0x40 → +20; 0x04 → −10; 0x02 → −20;
  0x80 → −50 (all that apply). Range −30 … 110.
- odds (a, b, c, d, e) by score:

| Score | a | b | c | d | e |
|---|---|---|---|---|---|
| −30 … 9 | 0 | 0 | 0 | 30 | 15 |
| 10 … 29 | 0 | 1 | 5 | 20 | 10 |
| 30 … 69 | 0 | 2 | 5 | 10 | 5 |
| 70 … 89 | 10 | 2 | 10 | 10 | 1 |
| 90 … 110 | 15 | 5 | 15 | 10 | 1 |
| other | no cell changes (no dice; unreachable) |

- for column 0–49 (outer), row 0–24 (inner), on blank ground: 0x25932(col, row, a, b, c, d, e) rolls
  `r` = d100 and sets the cell by the first band that holds:

| r ≤ | Cell | What it is (WildCom image) |
|---|---|---|
| a | 0x39 + d2 (0x3A, 0x3B) | pond with reeds (cost 2) |
| a + b | 0x2F + d2 (0x30, 0x31) | tall grass, a bush (cost 2) |
| a + b + c | 0x2B + d4 (0x2C–0x2F) | grass tufts |
| a + b + c + d | 0x36 + d3 (0x37–0x39) | pebbles |
| a + b + c + d + e | 0x31 + d4 (0x32–0x35) | rocks and boulders (cost 2) |
| higher | unchanged | |

Plain ground (flags 0, 0x01: score 50) gets 2 % grass and bushes, 5 % tufts, 10 % pebbles, 5 % rocks.

PoR's scatter (`FUN_34c7_0e9e`) rolls d255 against four values set by the flags, with cactus, marsh
plants and puddles that CotAB's WildCom does not have.

### Cell table (O, DS:26A4, 4 bytes a cell)

Byte 0: cost to enter, 1, 2 or 4, or 0xFF blocked (PoR: 1 or 0xFF); byte 1: 1 for most cells, 0 for
the water, 2 for the table (PoR: always 0; read by line of sight as eye height, **I**); byte 2: sight
block 2 or 0; byte 3: image slot. Image names are from WildCom and RandCom as drawn (**I** for what
they depict).

| Cells | Slot | Image | Cost | Sight |
|---|---|---|---|---|
| 0x1A | 0x22 | table (RandCom 0) | 2 | clear |
| 0x1B | 0x23 | chair (RandCom 1) | 1 | clear |
| 0x1C | 0x24 | cloud, blue (RandCom 2) | 1 | clear |
| 0x1D | 0x25 | blank (RandCom 3) | 1 | clear |
| 0x1E | 0x26 | cloud, green (RandCom 4) | 1 | clear |
| 0x1F | 0x27 | fallen body (RandCom 5) | 1 | clear |
| 0x20–0x24 | 0x00–0x04 | tree crowns | blocked | blocks |
| 0x25–0x29 | 0x05–0x09 | tree trunks | 1 | clear |
| 0x2A, 0x2B | 0x0A, 0x0B | fallen logs | blocked | blocks |
| 0x2C–0x2F | 0x0C–0x0F | grass tufts | 1 | clear |
| 0x30, 0x31 | 0x10, 0x11 | tall grass, bush | 2 | clear |
| 0x32–0x35 | 0x12–0x15 | rocks, boulders | 2 | clear |
| 0x36 | 0x16 | blank ground | 1 | clear |
| 0x37–0x39 | 0x17–0x19 | pebbles | 1 | clear |
| 0x3A, 0x3B | 0x1A, 0x1B | ponds with reeds | 2 | clear |
| 0x3C, 0x3D | 0x1C, 0x1D | water, left half | 4 | clear |
| 0x3E, 0x3F | 0x1E, 0x1F | water, right half | 4 | clear |
| 0x40 | 0x20 | ford, right half | 1 | clear |
| 0x41 | 0x21 | ford, left half (never left on the field, above) | 1 | clear |

Cells 0x00–0x19 are the map-area set (DungCom), as PoR's.

### Port

The map-area generator (0x2555D) is not transcribed: CotAB map fields are still PoR's map generator and
finishing pass (**?** how far they differ).

`rules/battlefield.ts` `wildField(flags, roll, spec)`: one driver (fill, then the passes the profile
lists, `R.wildField`), the passes named by what they do; CotAB: `river`, `treesOrLogs`,
`scatterOdds`, no finishing pass; PoR: `river`, `treesBySize`, `scatterTerrain`, `finishing`. The river
is one procedure for both games (the course, two cells a row, the d20 after them, a ford procedure with
its cells as offsets): CotAB's numbers are the halves by d2, no pairs, no crossing and `edge: 'clip'`.
Shared as data: the flag arithmetic (`FlagValue`: a base, then set or add per flag) and the river's
course. Tested cell for cell against this transcription with scripted dice (`test/wildfield.test.ts`).
