---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Title, credits and code wheel

Part of the [specification](../../README.md), part A: Pool of Radiance. Steps 4–7 of the start-up sequence ([input-and-menus.md](../engine/input-and-menus.md) §1): the credits screen and the copy-protection check. The title pictures and their timing are in that sequence. Curse of the Azure Bonds: [coab/assets.md](../coab/assets.md) §7.

## Credits screen (O, `290c:0206`; strings `290c:004B–01E2`)

Two framed boxes (rows 1–3 and 5–23, columns 1–38, `FUN_13f1_02e8`). All text lower-case in the data (font is upper-case only, I).

| Row | Col 1–19 (colour) | Col 20+ (colour) |
|---|---|---|
| 1 | col 5 "scenario created by:" (10) | col 26 "tsr, inc." (14) |
| 2 | col 15 "jim ward" (10) | |
| 3 | col 2 "david cook,steve winter,mike breault" (10) | |
| 5 | col 1 "game created by:" (10) | col 18 "ssi special projects" (14) |
| 6 | col 14 "version 1.3" (11) | |
| 7 | "programming:" (14) | "original" (14) |
| 8 | "scot bayless" (11) | "programming:" (14) |
| 9 | "brad myers" (11) | "keith brors" (11) |
| 10 | "russ brown" (11) | "brad myers" (11) |
| 11 | "ted greer" (11) | |
| 13 | "graphic arts:" (14) | "encounter coding:" (14) |
| 14 | "tom wahl" (11) | "paul murray" (11) |
| 15 | "fred butts" (11) | "russ brown" (11) |
| 16 | "darla marasco" (11) | "victor penman" (11) |
| 17 | "susan halbleib" (11) | "dave shelley" (11) |
| 19 | "project manager" (14) | "developer:" (14) |
| 20 | "victor penman" (11) | "george mac donald" (11) |
| 22 | "testing:" (14) | col 11 "joel billings,steve salyer" (11) |
| 23 | "james kucera,robert daly,rick white" (11) | |

Left column text starts at col 2, right column at col 20 unless stated.

## Copy protection (translation wheel) (O, `298d:00FD`; table `DS:0002`)

- Up to **3 attempts**; each picks `r = Random(13)` and redraws the framed screen:
  - row 1 "USE THE TRANSLATION WHEEL TO DECIPHER", row 2 "THE CODE WORD." (10)
  - row 5 "MATCH THE ESPRUAR RUNE (OUTER RING)"; row 6 cols 8–9: two rune glyphs (colour 12)
  - row 8 "WITH THE DETHEK RUNE (INNER RING)"; row 9 cols 8(–9): one or two rune glyphs (12)
  - row 11 "AND READ THE CODE WORD UNDER THE PATH:"; row 13: five spaces + path pattern (12)
  - row 14 "READ FROM THE INSIDE TO THE OUTSIDE."
  - row 24 input "INPUT THE CODE WORD: ", max 6 characters
- Table: 13 records of 21 bytes at `DS:0002 + 21·r`: word string[6], Espruar rune 1, rune 2, Dethek rune 1, rune 2 (0xFF = none), path string[9] (`- - - - -` solid, `-..-..-..` dash-dot, `.........` dotted). Glyph = rune byte + 0x40 in the 8X8D1 font. Words: BEWARE, ZOMBIE, NOTNOW, COPPER, DRAGON, EFREET, FRIEND, JUNGLE, KNIGHT, SAVIOR, TEMPLE, VULCAN, WYVERN.
- Validation: input string = word. Wrong → "Sorry, that's incorrect." (14) and retry; third failure exits to DOS.
- **This binary is patched**: the branch after the compare at `298d:032C` is `90 90` (NOPs) followed by `jmp` to the success exit, so any input is accepted. The port can skip the screen.
