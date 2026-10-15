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

## Still to decode

- Layout of the 156-byte view tables (which tile goes where for each distance/side)
- 8X8D tile format and palette
- Area types (`DS:84DC`): values 0, 10, 0x19–0x1B seen in code
