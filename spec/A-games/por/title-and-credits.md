---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Title, credits and code wheel

> **Status: complete.** Normative. Part A of the [specification](../../README.md): Pool of
> Radiance. Evidence marks as in the README; addresses are PoR's. Texts are read by address (D1);
> values the game files hold are checked against
> [D-appendices/expected-values.md](../../D-appendices/expected-values.md) §3.

Steps 4–7 of the start-up sequence ([input-and-menus.md](../engine/input-and-menus.md) §1): the credits screen and the copy-protection check. The title pictures and their timing are in that sequence. Curse of the Azure Bonds: [coab/assets.md](../coab/assets.md) §7.

## Credits screen (O, `290c:0206`; strings `290c:004B–01E2`)

Two framed boxes (rows 1–3 and 5–23, columns 1–38, `FUN_13f1_02e8`). Each text is a Pascal string
in the code segment `290c` (image 0x190C0 + offset; the code-wheel texts below are in `298d`, image 0x198D0 + offset), lower-case in the data and shown in capitals
by the font (I). Columns: the left text starts at column 2 and the right at column 20 unless stated.

| Row | Left: string (colour) | Right: string (colour) |
|---|---|---|
| 1 | col 5, `004B` (10) | col 26, `0060` (14) |
| 2 | col 15, `006A` (10) | |
| 3 | `0073` (10) | |
| 5 | col 1, `0098` (10) | col 18, `00A9` (14) |
| 6 | col 14, `00BE` (11) | |
| 7 | `00CA` (14) | `00D7` (14) |
| 8 | `00E0` (11) | `00CA` (14) |
| 9 | `00ED` (11) | `00F8` (11) |
| 10 | `0104` (11) | `00ED` (11) |
| 11 | `010F` (11) | |
| 13 | `0119` (14) | `0127` (14) |
| 14 | `0139` (11) | `0142` (11) |
| 15 | `014E` (11) | `0104` (11) |
| 16 | `0159` (11) | `0167` (11) |
| 17 | `0175` (11) | `0184` (11) |
| 19 | `0191` (14) | `01A1` (14) |
| 20 | `0167` (11) | `01AC` (11) |
| 22 | `01BE` (14) | col 11, `01C7` (11) |
| 23 | `01E2` (11) | |

The 29 strings run contiguously from `290c:004B` to `290c:0205`; four are printed twice (`00CA`,
`00ED`, `0104`, `0167`). Row 1 left is the scenario credit, row 6 the version line.

## Copy protection (translation wheel) (O, `298d:00FD`; table `DS:0002`)

- Up to **3 attempts**; each picks `r = Random(13)` and redraws the framed screen:
  - row 1 `298d:0001` ("USE THE TRANSLATION WHEEL…"), row 2 `298d:0027` (10)
  - row 5 `298d:0036` ("MATCH THE ESPRUAR RUNE…"); row 6 cols 8–9: two rune glyphs (colour 12)
  - row 8 `298d:005A` ("WITH THE DETHEK RUNE…"); row 9 cols 8(–9): one or two rune glyphs (12)
  - row 11 `298d:007C` ("AND READ THE CODE WORD…"); row 13: five spaces + path pattern (12)
  - row 14 `298d:00A9` ("READ FROM THE INSIDE…")
  - row 24 input, prompt `298d:00CE`, max 6 characters
- Table: 13 records of 21 bytes at `DS:0002 + 21·r`: word string[6], Espruar rune 1, rune 2, Dethek rune 1, rune 2 (0xFF = none), path string[9] (three patterns: solid, dash-dot, dotted). Glyph = rune byte + 0x40 in the 8X8D1 font. The values are informative ([expected-values.md §3](../../D-appendices/expected-values.md#3-pool-of-radiance-credits-and-code-wheel)).
- Validation: input string = word. Wrong → `298d:00E4` ("Sorry, that's incorrect.", 14) and retry; third failure exits to DOS.
- **This binary is patched**: the branch after the compare at `298d:032C` is `90 90` (NOPs) followed by `jmp` to the success exit, so any input is accepted. (Whether GoldBox Rerolled shows the screen is part C: [app-flow.md §4](../../C-port/app-flow.md#4-the-title).)

## Open

- None.
