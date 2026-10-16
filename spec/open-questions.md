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

8. ~~Character, item, monster records~~ main fields done in [[spec/records]]; item fields, the `ITEMS` table, readying and the stat recalculation are done too. Remaining: unlabelled character bytes, `ITEMS` byte 8 (0x80 on weapons; no reader found), what types 0, 60, 64–66, 80, 81, 83, 89, 94–96 and 127 were for (no instance in the shipped data)
11. ~~Combat engine, spells, saving throws, experience~~ done in [[spec/combat]] (v0.6: placement, rounds, actions, attacks, statuses, AI, aftermath), [[spec/spells]], [[spec/progression]]; remaining: Aim target list and keys, spell targeting/area templates and per-spell immediate effects, overland tile ids behind the wilderness terrain flags. The cell table's movement byte is read by the Move command and the AI probe (1 = open, 0xFF = blocked).
12a. [[spec/progression]] experience notes disagree with the code ([[spec/combat]] Aftermath): money experience is integer (cp/200, sp/20, ep/2, gp, 5·pp, 250·gems, 2200·jewelry), and the 8-item cap counts every item taken, not only value-0 drops
12. ~~Save game format and load routine~~ done in [[spec/savegame]]

## Effects (from [[spec/effects]])

- Exact HP recalculation in effect 7; creature classes behind effects 3/6; one save-bonus condition in effect 82; item weapon-class flags
- Effect 88 is fired at event 14 but has no handler (original behaviour: nothing)

## Items, shops, money (from [[spec/records]] and [[spec/town]])

- [[spec/combat]] "Combat statistics" calls `FUN_10ba_01fb` the weapon routine; it is the armour-movement routine (the weapon routine is `FUN_10ba_0000`). The records spec now holds the full recalculation; the combat summary should point there.
- Haste/Slow and spell AC/THAC0 changes vs the recalculation: `FUN_10ba_0bb8` resets char[0x110], [0x111], [0x112] and [0x11C] from base values, so an effect that writes them directly (Shield sets char[0x111] := max(…, 57); Cause Blindness subtracts 4) is lost when items are changed mid-combat unless the effect hook re-applies it. Check which effects run again after the recalculation (event 11 is fired right after it before a melee to-hit roll, [[spec/effects]]).
- Meaning of ECL 0x6EF6 = 1 and 0x6E6D = 16, set by every shop script before `COMBAT`.
- The shop/temple "Pool" key is skipped while a local flag (passed to the menu and to View) is set; when that happens **?**.
- Appraise: whether Escape at "Sell Keep" sells the gem (every key other than K does in the code path seen).
- Confirm in DOSBox: stack Sell price (value/2 × count / 20 for every stack), the vanishing share of 0xB3 NPCs in Share, and the lost gem when keeping it with an empty inventory.
- Scroll test `0x96:0x3E` (slot 11–14 per the guide) and the Remove Curse spell handler used by the temple: not traced here.
- Combat use of ammunition: the round-start formula (`FUN_3aae_0d23`, `FUN_3aae_0e52`) is only summarised in [[spec/records]].

## Interpreter vs the original

- Confirm in DOSBox: walking off the south edge of block 1 area 24's second map (GEO 31) at (4,15) — the exit table has no destination ([[spec/ecl]], Validation)
- What engine address 0x035F reads in practice (stack garbage) when the overland scripts compare it against their impassable-tile table; a port can treat it as never matching
- Compare scripted walks between `tools/eclvm.py` and the original

## Cross-checks against the GameFAQs guide ([[spec/README]], External references)

- Cheat mode: the `STING` command-line option is confirmed for Ctrl-C and Ctrl-D ([[spec/architecture]]) and for the party-screen **J** free training ([[spec/progression]]: J compares `ParamStr(1)` with "STING"; nothing is typed). [[spec/menus]] (menu table, J row) and [[spec/architecture]] (party screen, "Hidden") still say "type STING" and need correcting. Still to trace: Alt-X (win a combat), and skipping the introduction and copy protection.
- Guide claims corrected by the code ([[spec/camp]], [[spec/progression]]): the rest-time cap is 99 **days**, not hours; the 2/3 minimum hit-point roll never applies at training; base preparation time has only the 4 h / 6 h steps.
- Loading: the guide says a game can be loaded only from the main menu or after dropping every character in a training hall, and that loading deletes the files of characters who had been Removed from the party.

## Camp, clock and training (from [[spec/camp]], [[spec/progression]])

- Original bugs a port must decide on (reproduce, or fix and log in IMPROVEMENTS.md): pressing Train truncates excess experience before the hall check and the Yes/No; an empty new-spell list at a magic-user level-up sets max HP to 1; every clock advance ages the party once 256 years have passed; script writes to the clock words are only normalised at the next advance
- `DS:6DB5`/`DS:6DB7`, cleared by camp exit and by Cast
- Whether `FUN_5216_1656` scales spell durations (they look like plain minutes)
- The scroll test `0x96:0x3E` is `FUN_4e53_323d`: `ITEMS` byte 0 in 11–13 (types 61 and 62 in the data), not 11–14
- Confirm in DOSBox: the rest-encounter counter `DS:49FB` carrying over between rests; the heal counter `DS:6DD8` adding up across rests in one camp

## Smaller loose ends

- Edge-consistency outliers in GEO records 30, 23, 16, 7, 0
- ECL operand kinds other than 0/1/2/3/0x80/0x81 at ECL2/15 0x9B5B and ECL8/16 0x9B00
- Meaning of the `88 13` prefix on ECL records
