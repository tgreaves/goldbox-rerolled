---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Open questions

Part of [[spec/README]]. Ordered by what a browser reimplementation needs first.

## Needed to walk around

1. ~~8X8D tile format and EGA palette~~ done, see [[spec/graphics]]
2. ~~WALLDEF view layout~~ done in [[spec/maps]]; remaining: background, alternate view, tile bank loader
3. ~~Area types~~ `DS:84DC` is the current area id; areas 0, 10, 25–27 special-cased
4. Text window geometry (`FUN_1709_*`); font done

## Needed for events

5. ~~Picture formats, animation timing, SPRIT distance mapping~~ done ([[spec/graphics]])
6. ~~Remaining opcodes~~ all 61 named; 0x3C semantics inferred
7. Semantics of word array B reads/writes with side effects (`FUN_2fea_07bc`, `0a74`): likely current-character fields

## Needed for the rules

8. ~~Character, item, monster records~~ main fields done in [[spec/records]]; remaining: unlabelled character bytes, item fields 0x32–0x3E, ITEMS bytes 5–8/12–15, effect types
11. ~~Combat engine, spells, saving throws, experience~~ done in [[spec/combat]], [[spec/spells]], [[spec/progression]]; remaining: overland tile ids behind the wilderness terrain flags, the cell table's movement byte reader
12. ~~Save game format and load routine~~ done in [[spec/savegame]]

## Effects (from [[spec/effects]])

- Exact HP recalculation in effect 7; creature classes behind effects 3/6; one save-bonus condition in effect 82; item weapon-class flags
- Effect 88 is fired at event 14 but has no handler (original behaviour: nothing)

## Interpreter vs the original

- Confirm in DOSBox: walking off the south edge of block 1 area 24's second map (GEO 31) at (4,15) — the exit table has no destination ([[spec/ecl]], Validation)
- What engine address 0x035F reads in practice (stack garbage) when the overland scripts compare it against their impassable-tile table; a port can treat it as never matching
- Compare scripted walks between `tools/eclvm.py` and the original

## Cross-checks against the GameFAQs guide ([[spec/README]], External references)

- Cheat mode: the guide starts it with a `STING` command-line option (Ctrl-C quits, Alt-X wins a combat, J trains free in a training hall). [[spec/architecture]] has only J followed by typing STING in a training hall. Look for a command-line check and an Alt-X handler.
- Loading: the guide says a game can be loaded only from the main menu or after dropping every character in a training hall, and that loading deletes the files of characters who had been Removed from the party.

## Smaller loose ends

- Edge-consistency outliers in GEO records 30, 23, 16, 7, 0
- ECL operand kinds other than 0/1/2/3/0x80/0x81 at ECL2/15 0x9B5B and ECL8/16 0x9B00
- Meaning of the `88 13` prefix on ECL records
