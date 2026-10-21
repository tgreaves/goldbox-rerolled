---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Save games

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Evidence marks as in the README; addresses are PoR's. Curse of the
> Azure Bonds: [coab/records.md](../coab/records.md). How GoldBox Rerolled stores, exports and
> extends saves is part C ([storage.md](../../C-port/storage.md)).

## Files (O, save routine `FUN_45c5_1d58`)

A save slot is a letter `A`–`J` (`DS:537A` + letter). One slot = one `SAVGAM<x>.DAT` plus three files per party member:

| File | Content |
|---|---|
| `SAVGAM<x>.DAT` | world state, 13 137 bytes (below) |
| `CHRDAT<x><n>.SAV` | character record, 285 bytes ([records.md](records.md)) |
| `CHRDAT<x><n>.ITM` | item records, 63 bytes each |
| `CHRDAT<x><n>.SPC` | effect records, 9 bytes each |

`n` = 1-based position in the party.

Loading (`FUN_45c5_0aec`) reads `.ITM` and `.SPC` as fixed-size records until end of file and relinks them in memory, clearing each record's stored next pointer (item +0x2A, effect +5), so those pointer bytes are never read back (O). Unused bytes of the stem table (after each Pascal string, and slots beyond the party count) are whatever was in memory.

Writing back a loaded save therefore reproduces every byte the original reads; the never-read
bytes carry no meaning. The port's write-back rule and its sidecar file are part C
([storage.md §5](../../C-port/storage.md#5-saved-games-and-the-autosave),
[§6](../../C-port/storage.md#6-journal-finds-and-the-gbr-sidecar)).

## `SAVGAM<x>.DAT` layout (O)

Validated: both shipped saves (`SAVGAMA.DAT`, `SAVGAMJ.DAT`) parse to exactly 13 137 bytes.

| Offset | Size | Content |
|---|---|---|
| 0 | 1 | current block digit (`DS:5376`, selects `ECLn`/`GEOn`/… files) |
| 1 | 0x800 | ECL word array A (0x4900–0x4CFF) |
| 0x801 | 0x800 | ECL word array B (0x6B00–0x6EFF) |
| 0x1001 | 0x400 | ECL word array C (0x9700–0x98FF) |
| 0x1401 | 0x1E00 | the loaded ECL code buffer (0x9900–0xB6FF), including any self-modification |
| 0x3201 | 5 | party X, Y, facing (0/2/4/6), wall ahead, square event (`DS:6AAD`) |
| 0x3206 | 1 | `DS:49FA` area kind: 1 = map area (dungeon/city combat icons); 2–4 for areas 25–27 (wilderness combat terrain) |
| 0x3207 | 1 | `DS:49F3` game mode (**?**; 2 in saves; combat sets 5/6) |
| 0x3208 | 1 | party member count |
| 0x3209 | 8 × 41 | party member file stems (Pascal strings, e.g. `CHRDATA1`) |

Before writing, the engine copies a few engine globals into array A so they persist:

- `A[0x4AFA..0x4AFC]` = wall-set slot record ids, `A[0x4AFD..0x4AFF]` = slot numbers (`DS:6AAE + 4i`, `DS:6AB0 + 4i`)
- ECL 0x49FC (A byte offset 0x1F8) = `DS:49E2` game speed
- ECL 0x49FF (A byte offset 0x1FE) = `DS:49F6 × 2 + DS:49F5` (monster pictures, portraits)
- ECL 0x6E12 (B byte offset 0x624) = block digit

Checked against both shipped saves: speed 4, toggles 3, block 2, wall sets (2, 4, 1) in slots (1, 2, 3), current area 20 (0x49F2) with GEO record 20 (0x49C5).

Because the whole ECL VM (code + all three arrays) is saved, a reimplementation that keeps the same memory model can load original saves directly.

## Shipped saves

| File | Block | Position | Party |
|---|---|---|---|
| `SAVGAMA.DAT` | 2 | (15, 4) facing W | `CHRDATA1–6` (the six pre-made characters) |
| `SAVGAMJ.DAT` | 2 | (14, 5) facing S | `CHRDATJ1–6` |

## Loading (O, `FUN_45c5_1602`)

1. List slots A–J for which `SAVGAM<x>.DAT` exists; the player picks one
2. Read the fields in the same order as above
3. Restore `DS:49F6 = A[byte 0x1FE] >> 1`, `DS:49F5 = A[byte 0x1FE] & 1`, `DS:49E2 = A[byte 0x1F8]`; `B[0x67C]` (party size) = 0, then load each `CHRDAT<x><n>.SAV/.ITM/.SPC` (`FUN_45c5_0aec`, `FUN_45c5_1446`)
4. Block digit `DS:5376` = `B[byte 0x624]`
5. Map areas (`DS:49FA` < 2): reload GEO record `A[byte 0x18A]` and the three wall sets from `A[0x4AFA..0x4AFF]`; wilderness: load the overland icon set
6. If `A[byte 0x344]` (ECL 0x4AA2) ≠ 0 run `FUN_4804_06b3(0)`: the cleansed river's tile colours ([overland.md](overland.md))
7. The party screen returns at once after a successful load (`DS:49F3` ≠ 0), with `DS:49F8` = 1: the game resumes without Begin, and the VM reset keeps the saved ECL buffer and per-area variables instead of reloading the script from the DAX ([input-and-menus.md](input-and-menus.md) §2, "Actions", Load)

## Open

- ~~Meaning of `DS:49FA`, `DS:49F3` values~~ answered: `DS:49FA` is the area kind (1 = map area,
  2–4 = wilderness areas 25–27; [main-loop.md, "Re-entering after an area change"](main-loop.md#re-entering-after-an-area-change-o-fun_29c3_31b4));
  `DS:49F3` is the game mode ([town.md, "Game modes"](town.md#game-modes-o-ds49f3)). The shipped
  saves hold 2 (camp).
