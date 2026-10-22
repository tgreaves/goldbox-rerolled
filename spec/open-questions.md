---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Open questions

Part of the [specification](README.md). Ordered by what a browser reimplementation needs first.

## Needed to walk around

1. ~~8X8D tile format and EGA palette~~ done, see [engine/graphics.md](A-games/engine/graphics.md)
2. ~~WALLDEF view layout~~ done in [engine/maps-and-view.md](A-games/engine/maps-and-view.md); ~~background, alternate view, tile bank loader~~ answered there ("Background colours", "Overhead map", "Tile bank")
3. ~~Area types~~ `DS:84DC` is the current area id; areas 0, 10, 25–27 special-cased
4. ~~Text window geometry (`FUN_1709_*`)~~ answered in [engine/graphics.md, "Screen layout"](A-games/engine/graphics.md#screen-layout-o-for-coordinates-passed-in-code-i-for-roles) (rows 17–22, columns 1–38, the print and box routines); font done

## Needed for events

5. ~~Picture formats, animation timing, SPRIT distance mapping~~ done ([engine/graphics.md](A-games/engine/graphics.md))
6. ~~Remaining opcodes~~ all 61 named; 0x3C semantics inferred
7. ~~Semantics of word array B reads/writes with side effects (`FUN_2fea_07bc`, `0a74`)~~ answered in [engine/ecl.md, "B as a view of the current character"](A-games/engine/ecl.md#b-as-a-view-of-the-current-character-o-fun_2fea_07bc-read-fun_2fea_0a74-write)

## Needed for the rules

8. ~~Character, item, monster records~~ main fields done in [engine/records.md](A-games/engine/records.md); item fields, the `ITEMS` table, readying and the stat recalculation are done too. Remaining: unlabelled character bytes, `ITEMS` byte 8 (0x80 on weapons; no reader found), what types 0, 60, 64–66, 80, 81, 83, 89, 94–96 and 127 were for (no instance in the shipped data)
11. ~~Combat engine, spells, saving throws, experience~~ done in [engine/combat-rules.md](A-games/engine/combat-rules.md) (v0.6: placement, rounds, actions, attacks, statuses, AI, aftermath), [engine/spells.md](A-games/engine/spells.md), [engine/chargen-and-progression.md](A-games/engine/chargen-and-progression.md); ~~Aim target list and keys, spell targeting/area templates and per-spell immediate effects~~ answered in [engine/combat-rules.md](A-games/engine/combat-rules.md) ("Aim", "Spell targets", "Spell handlers in combat") and [engine/spells.md](A-games/engine/spells.md) ("Per spell"); remaining: overland tile ids behind the wilderness terrain flags ([engine/battlefield.md](A-games/engine/battlefield.md)). The cell table's movement byte is read by the Move command and the AI probe (1 = open, 0xFF = blocked).
12a. ~~[engine/chargen-and-progression.md](A-games/engine/chargen-and-progression.md) experience notes disagree with the code: money experience is integer, and the 8-item cap counts every item taken~~ fixed: its "Combat experience" now points to the one description, [engine/combat-rules.md, "Experience"](A-games/engine/combat-rules.md#experience-o-fun_2e08_0000)
12. ~~Save game format and load routine~~ done in [engine/savegame.md](A-games/engine/savegame.md)

## Effects (from [engine/effects.md](A-games/engine/effects.md))

- ~~Exact HP recalculation in effect 7; creature classes behind effects 3/6; one save-bonus condition in effect 82; item weapon-class flags~~ answered in [engine/effects.md §3](A-games/engine/effects.md#3-formulas-creature-classes-odd-cases-and-hasteslow) (2026-10-21), with the strength encoding of 12/38
- ~~Effect 88 is fired at event 14 but has no handler~~ it has one (0x41609, the breath bolt; engine/effects.md, row 88)

## Items, shops, money (from [engine/records.md](A-games/engine/records.md) and [engine/town.md](A-games/engine/town.md))

- ~~The combat summary of `FUN_10ba_0bb8` calls `FUN_10ba_01fb` the weapon routine~~ fixed: the summary is gone, [engine/records.md, "Derived statistics"](A-games/engine/records.md#derived-statistics-o-fun_10ba_0bb8) is the only description and combat points there.
- ~~Haste/Slow and spell AC/THAC0 changes vs the recalculation~~ answered (2026-10-22, O in both games): `FUN_10ba_0bb8` (CotAB 0x4DC70) fires no event, but every to-hit roll, a weapon's (0x2C069 → event 11 at 0x2C077; CotAB 0x2BBC0, 0x2BBCE) and a touch spell's (0x3EEDD, 0x3EEEB; CotAB 0x44FCC, 0x44FD9), recalculates the target and fires event 11 first, where Shield (17) and Cause Blindness (33) put their AC back; Haste and Slow act through event 18 when movement is worked out, not on +0x11C. Nothing is lost for a roll; only readers without that pair (the AC shown, ECL DAMAGE's `FUN_5216_0c4f`) see the base value. The port's touch roll lacked the pair (fixed).
- ~~Meaning of ECL 0x6EF6 = 1 and 0x6E6D = 16, set by every shop script before `COMBAT`~~ script-private: no engine code refers to them ([engine/town.md](A-games/engine/town.md#how-scripts-open-them-o), **I**)
- The shop/temple "Pool" key is skipped while a local flag (passed to the menu and to View) is set; when that happens **?**.
- Appraise: whether Escape at "Sell Keep" sells the gem (every key other than K does in the code path seen).
- Confirm in DOSBox: stack Sell price (value/2 × count / 20 for every stack), the vanishing share of 0xB3 NPCs in Share, and the lost gem when keeping it with an empty inventory.
- ~~Scroll test `0x96:0x3E` (slot 11–14 per the guide)~~ answered below (Camp, clock and training: `FUN_4e53_323d`, slots 11–13). The Remove Curse spell handler used by the temple: not traced here.
- Combat use of ammunition: the round-start formula (`FUN_3aae_0d23`, `FUN_3aae_0e52`) is only summarised in [engine/records.md](A-games/engine/records.md).
- Random items ([engine/records.md](A-games/engine/records.md) Random items): the type a `TREASURE` gets for its first item when the second d100 is 48–49 is an uninitialised stack byte (`29c3:19B0`, `bp−0x65`). The rule for a conforming build is stated in [engine/records.md, "Type choice"](A-games/engine/records.md#type-choice-o-in-the-treasure-handler): type 0, a blank item. Confirm in DOSBox: random arrow and quarrel stacks weigh 40 per unit (400 per stack of 10) against 4 for shop arrows.
- ~~[engine/records.md, "Name words"](A-games/engine/records.md#name-words-o) numbers some words one too low~~ fixed there (162–166, 167, 201–203): from the table (word w at DS:10A7 + 21·w), "+1".."+5" are 162–166 (0xA2–0xA6), "of" is 167 (0xA7) and "-1".."-3" are 201–203 (0xC9–0xCB). The random-item code confirms this, since it writes 0xA1 + plus.

## Interpreter vs the original

- Confirm in DOSBox: walking off the south edge of block 1 area 24's second map (GEO 31) at (4,15) — the exit table has no destination ([engine/ecl.md](A-games/engine/ecl.md), Validation)
- What engine address 0x035F reads in practice (stack garbage) when the overland scripts compare it against their impassable-tile table; a conforming build reads 0 ([engine/ecl.md, "Engine registers"](A-games/engine/ecl.md#engine-registers-o))
- Compare scripted walks between `tools/eclvm.py` and the original

## Cross-checks against the GameFAQs guide ([por/README.md, "External reference"](A-games/por/README.md#external-reference))

- Cheat mode: the `STING` command-line option is confirmed for Ctrl-C and Ctrl-D ([engine/input-and-menus.md, "Cheat keys"](A-games/engine/input-and-menus.md#cheat-keys)) and for the party-screen **J** free training ([engine/chargen-and-progression.md](A-games/engine/chargen-and-progression.md): J compares `ParamStr(1)` with "STING"; nothing is typed). ~~The menu table and the party-screen notes still say "type STING"~~ fixed: both say J only. Skipping the introduction is answered (start-up step 3 skips the title and credits, not the code wheel); ~~Alt-X during computer-controlled turns~~ traced: with `STING` it kills every enemy-side combatant (`FUN_3aae_3b93`, [engine/input-and-menus.md, "Cheat keys"](A-games/engine/input-and-menus.md#cheat-keys)).
- Guide claims corrected by the code ([engine/camp-and-time.md](A-games/engine/camp-and-time.md), [engine/chargen-and-progression.md](A-games/engine/chargen-and-progression.md)): the rest-time cap is 99 **days**, not hours; the 2/3 minimum hit-point roll never applies at training; base preparation time has only the 4 h / 6 h steps.
- Loading: the guide says a game can be loaded only from the main menu or after dropping every character in a training hall, and that loading deletes the files of characters who had been Removed from the party.

## Camp, clock and training (from [engine/camp-and-time.md](A-games/engine/camp-and-time.md), [engine/chargen-and-progression.md](A-games/engine/chargen-and-progression.md))

- ~~Original bugs a port must decide on~~ decided for GoldBox Rerolled: an empty new-spell list at a magic-user level-up setting max HP to 1 is fixed (IMP-028); pressing Train truncating excess experience before the hall check and the Yes/No, the party ageing at every clock advance once 256 years have passed, and script writes to the clock words being normalised only at the next advance are kept as the original ([IMPROVEMENTS.md](../IMPROVEMENTS.md): only bugs that destroy money, items or characters are fixed)
- `DS:6DB5`/`DS:6DB7`, cleared by camp exit and by Cast
- Whether `FUN_5216_1656` scales spell durations (they look like plain minutes)
- The scroll test `0x96:0x3E` is `FUN_4e53_323d`: `ITEMS` byte 0 in 11–13 (types 61 and 62 in the data), not 11–14
- Confirm in DOSBox: the rest-encounter counter `DS:49FB` carrying over between rests; the heal counter `DS:6DD8` adding up across rests in one camp

## Port gaps from the 2026-10-17 audit

A record, not a question (it moves to [VALIDATION.md](VALIDATION.md)). Four audits compared the original with the port: data files loaded, engine routines reachable from the main loops (773 functions, 500 covered by spec or port), sound call sites, and the engine's own strings. Fixed straight away: the combat visuals ([engine/combat-visuals.md](A-games/engine/combat-visuals.md)), hit/miss sounds, long sounds played in full, combat footsteps, the damage and spell-result lines, script DAMAGE messages and status, duel texts, the after-battle chest picture, ROLF's icon. Since then: money Trade and Drop, treasure Detect, the scribing warning, Magic On/Off, item handlers on readying with the Spiritual Hammer, every spell handler (shared by combat and camp), ROB taking items, CHECK_PARTY's effect test, FIND_ITEM, NEWLINE, REDRAW, CLEAR_TOP and the PRINT_LIST rune glyphs, the river cleansing, the combat extras (Hold Person bolts, Fireball centring, the noxious cloud line, gaze and spit flights; the aim cursor slide is replaced by IMP-033), the combat palette swap, the 3D sky and floor colours, the cast and healing lines, the title sequence with its lightning and the credits, the combat panel's colours and "(Helpless)" on the cards, roster import of `.CHA` characters with `charlist.txt`. Nothing from the audit is still open.

**Spec corrections made**: `FUN_10ba_1feb` is the spell/effect display, not the weapon hit display; the fall picture is the skull (COMSPR 11), not RandCom 5; [engine/sound.md](A-games/engine/sound.md) §7's "FUN_4e53_169d" is inside `FUN_4e53_1658` (Hold Person).

## Smaller loose ends

- ~~After the final battle (ECL5 #7, 0xA80E): what re-runs on_enter after the ending~~: nothing needs to; PROGRAM 8 returns and the script goes on at 0xA82D with the walk back to New Phlan and `NEW_ECL #0` (0x1CA86, O; [engine/ecl.md](A-games/engine/ecl.md) opcode 0x38). The on_enter branch on ECL 0x4AE0 is for a game saved or re-entered with the flag set. The port had stopped the script at every PROGRAM (fixed 2026-10-22).

- Edge-consistency outliers in GEO records 30, 23, 16, 7, 0
- ECL operand kinds other than 0/1/2/3/0x80/0x81 at ECL2/15 0x9B5B and ECL8/16 0x9B00
- Meaning of the `88 13` prefix on ECL records

## Answered by the part A clean-up (2026-10-21)

Each was an **I** or **?** in a part A file; the file now states it (AUDIT §6.9, PA findings):

- ~~The image header's `x, y` and `cga_map`~~ [engine/graphics.md, "Image block"](A-games/engine/graphics.md#image-block-o); ~~the roster's colour rule~~ there, "Screen layout".
- ~~Starting a new game (I)~~ [engine/main-loop.md, "Starting a new game"](A-games/engine/main-loop.md#starting-a-new-game-o).
- ~~The effect record's layout (I)~~ [engine/records.md, "Effect record"](A-games/engine/records.md#effect-record-9-bytes-o).
- ~~The meaning of `DS:49FA` and `DS:49F3`~~ [engine/savegame.md, "Open"](A-games/engine/savegame.md#open).
- ~~Which creature carries CotAB's miscast effect 0x4A~~ only the cursed Robe of Vermin ([coab/combat.md, "Casting"](A-games/coab/combat.md#casting-o)).
- ~~ECL 0x4AB3's arid-terrain change (I)~~ the river-pollution commission, rewarded ([engine/battlefield.md, "Terrain flags"](A-games/engine/battlefield.md#terrain-flags-o-fun_34c7_08a4)).

Still open from that pass, each in its file's "Open" section: the fifth age threshold
([chargen-and-progression.md](A-games/engine/chargen-and-progression.md#open)), the remaining engine
globals in [ecl.md](A-games/engine/ecl.md#open) (B 0x6B00/0x6C00 answered: the leave flags), start-up step 9's
background call ([input-and-menus.md](A-games/engine/input-and-menus.md#open)), CotAB's WIS bonus
routine ([coab/tables.md](A-games/coab/tables.md#open)).
