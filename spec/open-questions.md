---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Open questions

Part of [[spec/README]]. Ordered by what a browser reimplementation needs first.

## Needed to walk around

1. ~~8X8D tile format and EGA palette~~ done, see [[spec/graphics]]
2. ~~WALLDEF view layout~~ done in [[spec/maps]]; remaining: background, alternate view, tile bank loader
3. Area types (`DS:84DC`) and how they change movement/drawing
4. Text window geometry (`FUN_1709_*`); font done

## Needed for events

5. ~~Picture formats~~ done; remaining: SPRIT distance mapping, animation timing
6. Remaining opcodes: 0x34, 0x3C, 0x3D, `CALL` targets, `PROGRAM` modes 0 and 8
7. Semantics of word array B reads/writes with side effects (`FUN_2fea_07bc`, `0a74`): likely current-character fields

## Needed for the rules

8. Character record layout (party list nodes are 0x11D bytes, linked via +0x104; `CHRDATn.SAV` are 285 = 0x11D bytes)
9. Item record (0x3F = 63 bytes, linked via +0x2A), `ITEMS` file, `CHRDATn.ITM`
10. Monster files MON*CHA / ITM / SPC
11. Combat engine, spells, saving throws, experience
12. Save game format (`SAVGAM*.DAT`, 13137 bytes)

## Smaller loose ends

- Edge-consistency outliers in GEO records 30, 23, 16, 7, 0
- ECL operand kinds other than 0/1/2/3/0x80/0x81 at ECL2/15 0x9B5B and ECL8/16 0x9B00
- Meaning of the `88 13` prefix on ECL records
