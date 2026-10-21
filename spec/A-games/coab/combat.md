# CotAB combat: differences from Pool of Radiance

> **Status: complete as a set of differences.** Normative. Part A of the
> [specification](../../README.md): Curse of the Azure Bonds. Evidence marks as in the README. The
> engine model's combat procedures, one per subject with each game's parameters, are
> [B-model/procedures.md §15](../../B-model/procedures.md#15-combat-procedures) (notes in its §17).

Differences from [engine/battlefield.md](../engine/battlefield.md) and [engine/combat-rules.md](../engine/combat-rules.md); anything not listed works as there. Addresses are CotAB image
offsets ([README.md, "Working image"](README.md#working-image)); DS = image 0xABE0.

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

The map generator 0x2555D is PoR's `FUN_34c7_0810` with one corner cell changed and a furnishing step
per square (tables 0x1A and chairs 0x1B in rooms), below.

### Map-area generator (O, 0x2555D)

PoR's squares → cells procedure ([engine/battlefield.md, "Map areas: squares → cells"](../engine/battlefield.md#map-areas-squares--cells-fun_34c7_0810)), statement for
statement, except where marked **new**. The parent's locals are globals here: dx DS:4A24, dy DS:4A25,
edge classes N DS:4A26, W DS:4A27, E DS:4A28, S DS:4A29; party x, y DS:7229, DS:722A.

```
for dy in -2..2: for dx in -6..6:              // 0x2555D
  x, y = DS:7229 + dx, DS:722A + dy
  W = classify(x, y, 6); N = classify(x, y, 0); E = classify(x, y, 2)
  S = classify(x, y, 4)                         // new: read only by the furnishing
  floor_west(); north(); nw(); ne()             // 0x2508C, 0x25131, 0x251AE, 0x25386
  DS:4A2D = mapbyte(x, y) & 0x40                // new: 0x116:0x34 → 0x53E45
  furnish()                                     // new: 0x24D63
// no finishing pass
```

- `classify` 0x25018 and `edge` 0x24F96: as PoR's `FUN_34c7_01ad` / `012b`, the neighbour from
  DS:2696 / DS:269F (`T.wallDx` / `T.wallDy`, the same vectors); passage 0x116:0x2F → 0x53C13, wall
  type 0x116:0x2A → 0x53D42 (GEO planes 0 and 1 for the wall types, plane 3 for the passages, as PoR).
- `plot(c, r, piece)` 0x24CD6: as PoR's `FUN_34c7_0221` (`piece + 1` at row dy·5 + 10 + r, column
  dx·6 + dy·5 + 21 + c, nothing outside the grid).
- Floor and west edge, north edge, north-west corner: as PoR, cell for cell.
- North-east corner 0x25386: as PoR except cell (0, 6) with N = 0 and g7 = 1: E = 0 and g8 ≠ 0 → 0x0C
  (as PoR), **E = 0 and g8 = 0 → 0x08** (0x25467: piece 7; PoR 0x04, its piece 3 at PoR image
  0x25373), E ≠ 0 → 0x04 (as PoR). The case: open north and east, a wall running north from the
  square's north-east corner and ending there, the east square's north open. (Part B's parameter `cornerWallEnd`.)
- `mapbyte(x, y)` 0x53E45: the square's byte in GEO plane 2 (`DS:7220` + 0x200 + y·16 + x). Outside
  0–15 it is 0 in areas 0 and 10 (DS:8B78, the current area), else the coordinate moves to the far edge
  (above 15 → 0, below 0 → 15); the wall routines 0x53C13 and 0x53D42 start with the same rule. Bit 0x40
  marks the squares that may be furnished (**I**: rooms the map maker meant to furnish; GEO2 #1, #4,
  GEO3 #21, GEO4 #32, #37 and GEO5 #53 have such squares).

#### Furnishing (O, 0x24D63)

```
room = (N = 1 or E = 1 or S = 1 or W = 1)       // a wall somewhere
       and not (N = 1 and S = 1 and not (E = 1 and W = 1))   // not two walls facing alone:
       and not (E = 1 and W = 1 and not (N = 1 and S = 1))   //   a corridor
       and none of N, E, S, W is 3              // no door
for i in 2..3: for j in 2..4:                   // outer i, inner j
  row = dy·5 + 10 + j; col = dx·6 + dy·5 + 21 + i + j        // block cell (r = j, c = i + j)
  if row, col on the grid and blank(row, col) and DS:4A2D ≠ 0 and room:
    if d10 ≤ 5:
      (row, col) = 0x1A                          // table
      for k in 1..4:                             // up, right, down, left
        r2 = row + DS:034F[k]; c2 = col + DS:034B[k]   // s8: DS:034C.. = 0, 1, 0, −1; DS:0350.. = −1, 0, 1, 0
        if (r2, c2) on the grid and blank(r2, c2) and d10 ≤ 9: (r2, c2) = 0x1B   // chair
```

`blank` is the image-slot test (`DS:26A7[cell·4]` = 0x16: cells 0x17 and 0x36). The d10s are rolled
only for cells that pass every test, so a field with no flagged room uses no dice at all. The six cells
are the interior of the square's block, right of where its west wall would stand; chairs beside them
can land in a block drawn later, which then overwrites them, and an interior cell already given a
chair is no longer blank, so it gets no table.

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
The flag bits mean what PoR's do ([engine/battlefield.md, "Terrain flags"](../engine/battlefield.md#terrain-flags-o-fun_34c7_08a4)); the passes use them differently.

All loops are Pascal `for` loops over bytes; the grid stride is 50 (`mul 0x32`).

#### River (O, 0x25690)

The same course as PoR's river (`FUN_34c7_0bde`), different cells, fords and no sure crossing:

- chance: 0; flag 0x20 → 35; flag 0x10 → 75 (later wins); runs if d100 ≤ chance (as PoR)
- start column `c` = 34 − 5d4 (one call `roll(5, 4)`; on the dice tape five d4 requests, as part B's `RiverCourse`), then decreased while
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
0x40 in place of a right half. The water cells cost 4 to enter, not blocked (cell table byte 0, [tables.md](tables.md) §3.12;
the cost rule is [B-model/procedures.md §15.5](../../B-model/procedures.md#155-battlefield-movement)).

Against PoR's river (`FUN_34c7_0bde`, [engine/battlefield.md, "River pass"](../engine/battlefield.md#river-pass-o-fun_34c7_0bde)): PoR's banks are fixed cells (0x32,
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

Byte 0: cost to enter, 1, 2 or 4, or 0xFF blocked (PoR: 1 or 0xFF, checked on every cell); a step costs
byte 0 × 3 half-squares diagonally and × 2 straight (the step routine 0x2AC98 at 0x2AD05; the Move
command 0x22ADD and the computer's probe 0x237FB compute the same), "Blocked" for the player when that
is more than the movement left (0x22B2C), refused for the computer when it is as much or more
(0x238DA); a step routine call short of movement zeroes it and still moves (0x2AD78); the procedure
is [B-model/procedures.md §15.5](../../B-model/procedures.md#155-battlefield-movement) (O); byte 1: 1 for most cells, 0 for
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

The engine model's generators: [B-model/procedures.md §15.4](../../B-model/procedures.md#154-battlefields).

## Casting (O)

PoR's casting in combat ([engine/combat-rules.md, "Cast"](../engine/combat-rules.md#cast-o-fun_3aae_2414var-result-auto-spell)), routine for routine, with three changes.

| PoR | CotAB | Same / changed |
|---|---|---|
| Cast `FUN_3aae_2414` | 0x2CCBD | same: "Camp Only Spell" (byte 11 = 0, DS:37E7 + 16·id), `t` = casting time (byte 12, DS:37E8) / 3, `t` = 0 casts at once (0xC2:0x39 = 0x45251) and ends the turn (0xED:0xC0), else "Begins Casting", rec[0] = spell, initiative −= `t` (at least 1); the redraw with auto = 0 also sets DS:7600 and DS:75FF |
| player's queued cast (`FUN_320c_031a` 0x22412) | 0x2213E | same: rec[0] cleared, then 0x45251(spell, announce 1, auto 0) |
| computer's queued cast (`FUN_3334_000f` 0x2347C) | 0x23238 | same: after item use (0x2356A), rec[0] still set, (spell, 1, 1) |
| the spell going off `FUN_4e53_0c20` | 0x45251 | **changed**: the miscast first (below); then as PoR: announce (DS:757D = 0, from an item, as PoR's 6DBF), the target hook DS:72BA with auto, forget on going off or abort, "Abort Spell?" / "Spell Aborted" (0x4556B) |
| forget `FUN_10ba_148b(spell)` (current character) | 0xED:0x66 = 0x4E570(character, spell), slots 0–0x53 | **changed**: takes the character |
| damage `FUN_3aae_02f9` / `FUN_5216_1344` | 0x2AA62 / 0x4CC3C | **changed**: rec[1] = 0 and "lost a spell" as PoR, but the copy is forgotten from the **damaged caster** (0x2AAB4 and 0x4CC8A pass the target, [bp+0xE] / [bp+0xC]): PoR's bug is fixed |
| spell choice `FUN_3334_0545` | 0x236CB | **changed**: the memorised list is slots **1**–0x53 (0x236E4 starts at 1, the loop ends after 0x53), so slot 0 is never chosen by the computer (I: an off-by-one when the 21 slots became 84); otherwise the same (d7 always rolled, morale byte +0xF7 > 0x7F or Magic On DS:75F4, the enemy side's count DS:6FAA, 3 picks a pass) |
| acceptance `FUN_3334_02eb` | 0x23471 | same, spell 3 hard-coded (Cure Light Wounds), priority DS:37E9, hostile DS:37EA |
| patient finder `FUN_3aae_1bf8` | 0x2C34E | same (directions DS:2696/269F, side +0x197, HP +0x1A4 against max +0x78, bodies DS:6E6C + 7n, count DS:6EAB, statuses 6–8 excluded, HP below 8) |

- **Miscast** (0x45373, new): before the loop, a caster with effect 0x4A (has-effect 0xED:0x9D) who rolls 1 on 1d2 (0xE3:0x4D) "miscasts": `0x4A3FD`("miscasts", spell), which in combat shows "*name* Casts a Spell" and "Spell: *spell*" as for any cast (the verb is shown only outside combat), then nothing: no target, no effect, **not forgotten** (so the earlier note "loses the spell" in [spells.md](spells.md) was wrong). Checked for every cast, from an item too, in and out of combat. Who carries 0x4A (O, data): only the cursed **Robe of Vermin** (ITEM6 record 64, its third item: type 66, +0x3D = 0x4A, +0x3E = 0x80, the item kind that grants effect +0x3D while readied, [effects.md](effects.md) §6); no monster record, save or spell carries it, and its handler 0x28A5E is empty.
- **Feeblemind** (effect 68, 0x288E5, the third "lost a spell" string at 0x288D9): INT +0x13 and WIS +0x15 := 7, "is stupid"; in combat (DS:4FD3 = 5) rec[1] = 0 and, with a spell queued, "lost a spell", the spell forgotten from the feebleminded character (0x2896F) and rec[0] = 0. So a caster feebleminded while casting loses the spell and the rest of its casting this round.
- **Event 21** (0x2209E): fired at a turn's start only when rec[0] = 0, so not on the turn a queued spell goes off.

The engine model's casting parameters: [B-model/procedures.md §15.1](../../B-model/procedures.md#151-casting).

## The backstab (O, 0x2CE27; damage 0x2A6E2)

PoR's ([engine/combat-rules.md, "Backstab"](../engine/combat-rules.md#backstab-o-fun_3aae_2574)) with
these differences:

- the attacker is a thief (+0x10F > 0) or a former thief whose levels count (+0x117 > 0 and 0x51841,
  [chargen-and-progression.md §2](chargen-and-progression.md#2-dual-classing-o-0x5135d));
- **no armour test**: the body-armour slot (+0x159) is read and never tested;
- the weapon: none, or type 0x61, Club (7), Dagger (8), or 35–37 (0x22 < type < 0x26);
- the target must not be large: size flags (+0xDE) & 0x7F ≤ 1;
- then PoR's position test (R[0xF] > 1, straight behind the target's facing, 0x2CF0C);
- damage × (((L − 1) as a word) div 4 + 2), L = the thief level with its former part (0x2A74C):
  ×2 at levels 1–4, ×3 at 5–8, ×4 at 9–12 (PoR L div 4 + 2: ×2 at 1–3, ×3 at 4–7).

## The former class in battle (O)

Where a dual-class character's former levels count once they do (0x51841), besides the backstab:

| What | Where | Rule |
|---|---|---|
| the Turn command | 0x225D4 | offered with a cleric level, or a former cleric level when it counts (and Turn not used this battle) |
| Turn Undead | 0x2B778 (band 0x2B7EE) | L = f·former cleric + cleric level: 1–8 → the column is the **current** cleric level (`DS:0369` + undead·10 + column), 9–13 → 9, else 10. A former cleric's current level is 0, so the entry read is the one before the row: the previous row's last, or before the first row `DS:0373` (0x20, which no d20 reaches). **Bug**: a former cleric of level 1–8 turns at the wrong column or not at all |
| the computer's Turn | 0x2330B | a cleric level, or a former cleric level above the change level +0xE6 (never true after a change, since +0xE6 is then the cleric's level) |
| the sweep level | 0x4E0BC | (+0xDD) a fighter, or a former fighter when it counts, of a race above 0: f·former + fighter level; else 1 |
| the sweep of a creature an effect brings in | 0x27BEE | f·former + fighter level |
| the locked-door menu | 0x2F185 | Pick and Knock look for a party member with the class, or the former class when it counts |

## Open

- ~~Who carries effect 0x4A (the miscast)~~ answered: the Robe of Vermin ("Casting").
