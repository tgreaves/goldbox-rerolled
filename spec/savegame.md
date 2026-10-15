---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Save games

Part of [[spec/README]].

## Files (O, save routine `FUN_45c5_1d58`)

A save slot is a letter `A`–`J` (`DS:537A` + letter). One slot = one `SAVGAM<x>.DAT` plus three files per party member:

| File | Content |
|---|---|
| `SAVGAM<x>.DAT` | world state, 13 137 bytes (below) |
| `CHRDAT<x><n>.SAV` | character record, 285 bytes ([[spec/records]]) |
| `CHRDAT<x><n>.ITM` | item records, 63 bytes each |
| `CHRDAT<x><n>.SPC` | effect records, 9 bytes each |

`n` = 1-based position in the party.

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
- `A[0x4A7C]` (byte offset 0x1F8) = `DS:49E2`
- `A[0x4A7F]` (byte offset 0x1FE) = `DS:49F6 × 2 + DS:49F5`
- `B[0x6E12]` (byte offset 0x624) = block digit

Because the whole ECL VM (code + all three arrays) is saved, a reimplementation that keeps the same memory model can load original saves directly.

## Shipped saves

| File | Block | Position | Party |
|---|---|---|---|
| `SAVGAMA.DAT` | 2 | (15, 4) facing W | `CHRDATA1–6` (the six pre-made characters) |
| `SAVGAMJ.DAT` | 2 | (14, 5) facing S | `CHRDATJ1–6` |

## Open

- Load routine (assumed symmetric; not yet traced)
- Meaning of `DS:49FA`, `DS:49F3` values
