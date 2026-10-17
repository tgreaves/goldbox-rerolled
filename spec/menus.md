---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Start-up, party screen, character creation

Part of [[spec/README]]. Rules tables for creation are in [[spec/chargen]] and [[spec/progression]]; this file covers the screens, their flow and the record bytes creation sets.

O = observed in code/data (address given), I = inferred. Addresses are `seg:off` (linear = seg·16 + off). Colours are EGA indices; text grid 40 × 25. `print(text, colour, row, col)` = `FUN_1709_0626`.

## 0. Shared input widgets (needed by every screen below)

### Horizontal menu `FUN_53aa_03bd(prompt, items, promptCol, normalCol, hlCol, extKeys, animate, &isExt)` (O)

- Prompt printed at row 24, col 0 in `promptCol`; `items` (space-separated words) follow it on row 24.
- Drawing (`53aa:01da`): the highlighted word (`DS:6B2B`, 1-based) in `hlCol`; in the other words, capitals/digits (set `53aa:01ba`) in `hlCol`, other characters in `normalCol`. With `hlCol = normalCol = 0` (party screen) the items are invisible.
- Keys: a key (upper-cased) that equals **any** character of the items string selects that word and returns the key (so `1`/`2` are hotkeys in "color-1 color-2"); `,`/`.` move the highlight left/right (wrap); Space returns at once; Esc returns 0; Enter returns 0x0D only if `hlCol` or `normalCol` ≠ 0 (callers of horizontal menus act only on letters, so Enter is effectively ignored there, I).
- `extKeys`: an extended key returns its scan code with `isExt = 1`; digits 1–9 then act as a keypad via `DS:288C` (1 End 0x4F, 2 Down 0x50, 3 PgDn 0x51, 4 Left 0x4B, 5 → 0x20, 6 Right 0x4D, 7 Home 0x47, 8 Up 0x48, 9 PgUp 0x49); `\` → 0x37.
- While waiting, the picture animation runs (spec/graphics).

### Yes/No `FUN_53aa_10d1(prompt, …)` (O)

Items "Yes No", highlight starts on **No**; loops until **Y** or **N** is pressed (set `53aa:10b1`); Esc and Enter do nothing.

### Vertical list `FUN_53aa_0d9a` (O)

- Linked list of 0x2E-byte entries: string[40], +0x29 header flag, +0x2A next. Entry 0 is a non-selectable header (the title, e.g. "Pick Race").
- Window rows 2–22, columns 1–38 for every list in this document. Bottom line = caller's items plus " Next" / " Prev" (when more rows exist below / above, strings `53aa:0D88`, `0D8E`) and " Exit" (`0D94`) when the caller asks.
- **Home / keypad 7** = highlight up, **End / keypad 1** = highlight down (`53aa:0cc5`, skips headers; Up/Down arrows are *not* handled); **PgUp/PgDn** (9/3) or **P/N** = page; **Enter** selects the highlighted row (returns 0x0D and the entry); **Esc** or **E** returns 0.

### Text input `FUN_1709_09e3(maxLen, promptCol, prompt)` (O)

Prompt at row 24 col 0; accepts characters 0x20–0x7A up to `maxLen`, echoed in white (15); Backspace deletes; **Enter or Esc** ends input (Esc does not cancel); result upper-cased.

## 1. Start-up sequence

Main program `1000:00F6` (O):

| Step | What | Where |
|---|---|---|
| 1 | Read `POOL.CFG` (5 lines): line 1 `E` → EGA (`DS:4A1E`=1), `T` → Tandy (2), else CGA (0); line 2 `T`/`P`/other → `DS:5372` = 0/1/2 (sound device, I); line 3 → data path `DS:547C`; line 4 → save path `DS:537A`; line 5 `F` → `DS:49D1` = 1 (I: "fixed disk", enables the long intro). Shipped file: `E P C:\POOLRAD\ C:\POOLRAD\ F` | `142b` area, O |
| 2 | Allocate and clear the ECL arrays | `FUN_36c1_002d`, O/I |
| 3 | If command-line argument 1 is `STING` (string at `1000:0000`) skip steps 4–6 (developer bypass) | `0x10102`, O |
| 4 | Title: TITLE.DAX record **1** full screen at (0,0); wait **5 s** or a key; flush keys. If `DS:49D1` = 0 stop here (no record 2, no credits) | `FUN_290c_0627`, O |
| 5 | Title record **2**; up to **5 s** or a key. In EGA mode random "lightning": a counter grows by Random(4) per loop pass and when it exceeds 50 000 the palette register 1 is set 9 → 11 → 15 → 11 → 9 → 1 with 150/100/50/100/150 ms delays, repeated Random(3)+2 times (2–4 flashes) (O). The rate depends on CPU speed (I: pick ~one burst every 1–3 s). Flush keys | `290c:06AD–07FC`, O |
| 6 | Credits screen (below), wait **10 s** or a key. The boxes are `FUN_13f1_02e8(title, title colour, frame style, x1, y1, x2, y2)`: clear, then frame glyphs `0x114 + 3·style + k` around the box (`FUN_13f1_0000`, drawn with `FUN_1428_002a`), the title centred on the top row | `FUN_290c_0206`, O |
| 7 | Code-wheel check (below) | `FUN_298d_00fd` (= `290c:090D`), O |
| 8 | Party screen `FUN_417f_0161`; returns on Begin/Load | O |
| 9 | `FUN_55a0_0155(6,7,0,0x0B)` (**?**), main adventure loop `FUN_29c3_32f8`, then exit to DOS | O |

No other intro text exists in the executable.

### Credits screen (O, `290c:0206`; strings `290c:004B–01E2`)

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

### Copy protection (translation wheel) (O, `298d:00FD`; table `DS:0002`)

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

## 2. Party screen (`FUN_417f_0161`)

### Entry (O)

`DS:5376` (block) = 3, training cheat `DS:470C` = 0, game mode `DS:49F3` = 0.

### Layout (O)

- Frame rows 1–22, cols 1–38 (`FUN_13f1_02e8("",0,0,22,38,1,1)`), redrawn after every action.
- Roster (`FUN_10ba_0767`, only if a current character exists): row 2 headings "Name" / "AC  HP" (white), one row per member from row 4 (name, AC, HP; current character white). See spec/graphics. Rows 4–11 leave room for **8** members.
- Function list from row 12: each **enabled** entry on its own row (`12 + n`), first letter at col 2 in white (15), rest at col 3 in green (10).
- Row 24: prompt "Choose a function " (colour 13) followed by the invisible hotkey menu "C D M T V A R L S B E J" (`DS:05F0`, colours 0).

### Menu table (O, `DS:0619 + 0x2A·i`: string[40], enabled byte at +0x29)

| Key | Text | Enabled when |
|---|---|---|
| C | Create New Character | always |
| D | Drop Character | current character exists |
| M | Modify Character | current character exists |
| T | Train Character | current character exists **and** (`B[0x550]` ≠ 0 or cheat) — i.e. only when the party screen is opened by a training hall script; never at start-up (I) |
| V | View Character | current character exists |
| A | Add Character to Party | always (limits checked inside) |
| R | Remove Character from Party | current character exists |
| L | Load Saved Game | **only when the party is empty** |
| S | Save Current Game | current character exists |
| B | BEGIN Adventuring | current character exists |
| E | Exit to DOS | always |
| J | (hidden) | only when started as `START STING`: "I Understand, master..." and free training ([[spec/progression]]); nothing is typed after J |

"Current character exists" = `DS:5D92` ≠ nil (always true when the party is non-empty).

### Keys (O)

- Letters above. A disabled letter does nothing.
- **Home / keypad 7**: previous party member (wraps to last); **End / keypad 1**: next (wraps to first) (`FUN_4894_27df`, set `417f:00F6` = {0x47, 0x4F}); roster redrawn.
- Any key except E, S and the two cursor keys clears the "saved" flag `DS:557D` (set `417f:0116`).

### Actions

| Action | Behaviour |
|---|---|
| Create | §3. The new character is written to disk and **not** added to the party (O: `FUN_45c5_069e` at `417f:1EAD`, then FreeMem at `417f:1EC9`) |
| Drop (`417f:1F37`) | Yes/No "Drop NAME forever? " then "Are you sure? ". Both Y: message "You dump NAME out back." if char[0x10D] = 0 (unconscious/dead, I) else "NAME bids you farewell."; remove from party, free combat-icon slot, free record. **No file is deleted or written**; its charlist entry was already removed when it joined (below). Otherwise "NAME breathes a sigh of relief." (O) |
| Modify (`417f:209F`) | §4 |
| Train (`417f:29AE`) | spec/progression |
| View | character sheet viewer `FUN_4894_0ab3` (O) |
| Add (`417f:306D`) | §2.1 |
| Remove | save the character to its own files and append it to `charlist.txt` (`FUN_45c5_069e("", char)`), then unlink and free it (`FUN_417f_3291(1,0)`): party count `B[0x67C]` − 1, combat-icon slot freed, current = previous member (or new head) (O) |
| Load (`FUN_45c5_1602`) | spec/savegame. If a game was loaded (`DS:49F3` ≠ 0 afterwards) the party screen **returns immediately** with `DS:49F8` = 1 — the game resumes without pressing Begin (O; corrects spec/savegame step 7) |
| Save (`FUN_45c5_1d58`) | needs a non-empty party. "Save Which Game: " menu "A B C D E F G H I J" (13/10/15); Esc cancels; writes `SAVGAM<x>.DAT` + `CHRDAT<x><n>.SAV/.ITM/.SPC` in the save path; sets `DS:557D` = 1 (O) |
| Begin | needs a non-empty party: `DS:49F3` = 4 (map mode), return → main loop in block 3 (O). Nothing else is set here; area 0 comes from the cleared ECL arrays (I) |
| Exit | Yes/No "Quit to DOS " (prompt yellow 14). Y: while the game is unsaved (`DS:557D` = 0) and the party is non-empty, run Save again (Esc just re-prompts), then exit to DOS (O) |

### 2.1 Add Character (O)

- Clears the box, reads `charlist.txt` from the save path (`FUN_45c5_0010`): one name per line; names matching a current party member get the prefix `* `. Empty or missing file → returns immediately (a fresh install has none: the pre-made party is only reachable through **Load** slot A).
- List menu, header none, prompt "Add a character: ", items "Add Exit".
- Enter or **A** on a name without `*`: load `<savepath><stem>.CHA/.ITM/.SPC` (`FUN_45c5_0aec`, stem below), rename the list entry to `* NAME`.
- Refused silently if a member with the same name **and** the same id byte char[0xAB] is already in the party, or if the limit is reached: **6 player characters** (char[0x84] < 0x80) and **8 members in total** including NPCs (`B[0x67C]`).
- Join (`FUN_45c5_1446`): append to the end of the party list, becomes current, combat-icon slot char[0xBF] = lowest free of 0–7, `B[0x67C]` + 1, `FUN_51cf_0000` recomputes level-derived stats, then the combat icon is built (`FUN_45c5_0482(1)`).
- Loop until Exit/Esc, 6 PCs or 8 members; then `charlist.txt` is rewritten **without** the `*` entries (`FUN_45c5_01b8`), so party members are never listed.

### 2.2 Character files (O, `FUN_45c5_069e`, `FUN_1802_0425`)

| Kind | Files (in save path `DS:537A`) |
|---|---|
| Roster index | `charlist.txt` (text, one name per line) |
| Created / removed character | `<stem>.cha`, `<stem>.itm`, `<stem>.spc` (record 0x11D bytes; items 63 each; effects 9 each; empty .itm/.spc files are deleted rather than written) |
| Party in a save slot | `CHRDAT<slot><n>.sav/.itm/.spc` (spec/savegame) |

`stem` = character name with every ` . * , ? / \ : ;` and `|` removed (table `DS:0D1A`), first 8 characters. Two names with the same stem overwrite each other. On a write error: "Put save disk in X:" (X = drive letter of the save path) and retry.

## 3. Character creation (`FUN_417f_056c`)

### 3.1 Sequence (O)

1. GetMem 0x11D, zero-fill, set the defaults in §3.4.
2. **Race** list "Pick Race": Dwarf, Elf, Gnome, Half-Elf, Halfling, Human (entry 6 → race 7; Half-Orc never offered). Entries are `"  " + name`. Size byte char[0xC0] = 1 (Dwarf, Gnome, Halfling) else 2; racial effects added (spec/chargen table) via `FUN_5216_0e52`.
3. **Gender** list "Pick Gender": Male, Female (`DS:0FEC + 7i`) → char[0x9E] = 0/1.
4. **Class** list "Pick Class": from `DS:3E17 + race·12` (count, ids) — **race only, no ability prerequisites** (table 3.2). Levels: 1 in every component class (char[0x96 + c]); char[0x73] = 1; thief skills `FUN_51cf_0329` if thief (runs before abilities exist, so the DEX term uses DEX 0; recomputed on joining, I); char[0x2D] = max over classes of `DS:3C7C[c·11 + 1]`; char[0xB0] = Σ class bits `DS:05D6` (Cleric 2, Druid 16, Fighter 8, Paladin 64, Ranger 128, MU 1, Thief 4, Monk 32); saving throws `FUN_51cf_0255`.
5. **Alignment** list "Pick Alignment": `DS:3FE7 + class·10` (table 3.2) → char[0xA0].
6. **Age**: single class `base + NdS` (`DS:3E5B + race·0x1C + class·4`). Multi-class: maximum `base + N·S` of one column: C/F, C/F/MU, C/MU, C/T → Cleric; F/MU, F/MU/T, MU/T → Magic-User; F/T → Fighter. Age is **not** re-rolled with the abilities.
7. Show the sheet (`FUN_4894_004a`, name blank). Roll loop:
   - each ability: best of six 3d6 rolls; then age adjustments, racial min/max clamp (STR min/max by gender), raise to class minimum (`DS:3F81 + class·6`, table 3.3); WIS < 13 for a cleric multi-class (classes 8–12, set `417f:0525`) → 13; STR 18 with a Fighter level (char[0x98] > 0; Paladin/Ranger do not count) → char[0x16] = 1d100 capped by `DS:3DA7 + race·16 + gender`.
   - **Racial ability adjustments never apply** (bug): the code tests the race-menu loop variable `[bp-0x17]`, which is always 7 after the menu loop (`417f:1236`), not char[0x2E]. Dwarf CON+1 CHA−1, Elf DEX+1 CON−1, Halfling STR−1 DEX+1, Half-Orc STR+1 CON+1 CHA−2 are dead code. Reproduce: **no** racial adjustment.
   - HP, gold, spells, slots, natural attack (§3.4); sheet panels redrawn (`FUN_4894_0608` also runs `FUN_10ba_0bb8`, so AC/THAC0/damage/movement are filled).
   - Yes/No "Keep this character? " (prompt 13). **N** re-rolls abilities, HP and gold (race, class, alignment, age kept). Abilities cannot be swapped or edited here (use Modify).
8. **Name**: "Character name: " (prompt 13), max **15**, characters 0x20–0x7A, upper-cased; repeated while empty.
9. **Portrait** (`FUN_417f_33e7`): frame rows 1–11, cols 28–38; head over body drawn at col 28, row 1 (`FUN_5523_04f9`). Menu "Head Body Keep": **H** next head (1–14, wraps to 1), **B** next body (1–12, wraps), **K** keep. No previous key; Esc does nothing. Head n → HEAD3.DAX record `DS:286F[n]` = 0, 8, 9, 13, 16, 18, 22, 34, 45, 51, 53, 57, 67, 68; body n → BODY3.DAX record `DS:287D[n]` = 1, 2, 3, 4, 7, 8, 18, 24, 26, 33, 35, 37 (file digit = `DS:5376`, which is 3 on the party screen). Stored in char[0xBB] / char[0xBC].
10. **Combat icon** editor (§4.2).
11. Save to `<stem>.cha/.itm/.spc` + append to `charlist.txt` (`FUN_45c5_069e("", char)`), free the record. To play it the player must **Add** it.

Esc/Exit in any of the four lists abandons creation: the code jumps to `417f:1ECE`, past the FreeMem, so the record leaks (O).

### 3.2 Class and alignment availability (O)

| Race | Classes offered (menu order) |
|---|---|
| Dwarf | Fighter, Thief, Fighter/Thief |
| Elf | Fighter, Magic-User, Thief, Fighter/Magic-User, Fighter/Thief, Fighter/Magic-User/Thief, Magic-User/Thief |
| Gnome | Fighter, Thief, Fighter/Thief |
| Half-Elf | Cleric, Fighter, Magic-User, Thief, Cleric/Fighter, Cleric/Fighter/Magic-User, Cleric/Magic-User, Fighter/Magic-User, Fighter/Thief, Fighter/Magic-User/Thief, Magic-User/Thief |
| Halfling | Fighter, Thief, Fighter/Thief |
| Human | Cleric, Fighter, Magic-User, Thief |
| (Half-Orc, data only) | Cleric, Fighter, Thief, Cleric/Fighter, Cleric/Thief, Fighter/Thief |

| Class | Alignments |
|---|---|
| Cleric, Fighter, Magic-User, C/F, C/F/MU, C/MU, F/MU, Cleric/Thief | all nine (Cleric/Thief included, although AD&D would forbid LG/CG) |
| Thief, Fighter/Thief, Fighter/Magic-User/Thief, Magic-User/Thief | LN, LE, NG, TN, NE, CN, CE (no LG, no CG), in that menu order |
| (Druid / Paladin / Ranger / Monk, not offered) | LN NG TN NE CN / LG / all / all |

### 3.3 Class minimums incl. multi-class (O, `DS:3F81 + class·6`, STR INT WIS DEX CON CHA)

C/F 9 – 9 – – –; C/F/MU 9 9 9 – – –; C/MU – 9 9 – – –; C/T – – 9 9 – –; F/MU 9 9 – – – –; F/T 9 – – 9 – –; F/MU/T 9 9 – 9 – –; MU/T – 9 – 9 – –; C/R – 13 14 – 14 –. (Single classes as in spec/chargen.)

### 3.4 Record bytes set by creation (O unless marked)

| Offset | Value |
|---|---|
| all | 0 first |
| 0x00 | name (≤ 15, upper case) |
| 0x10–0x15, 0x16 | abilities, exceptional STR (0 unless STR 18 + Fighter) |
| 0x2D | 40, then max `DS:3C7C[class·11 + 1]` (= 60 − 20) |
| 0x2E, 0x2F, 0x30 | race, class, age |
| 0x32, 0x11B | max HP = current HP: `FUN_417f_4235` roll (spec/progression) with CON bonus `FUN_417f_3f31`: `(roll + bonus) / classes`; negative bonus with `|bonus| + classes ≥ roll` → 1 |
| 0x33–0x6A | spells known: Cleric every level-1 cleric spell (`DS:31FA + 16·id`: class 0, level 1); Magic-User 11, 18, 19, 21 |
| 0x6C | 1 |
| 0x6D–0x71 | saves (`FUN_51cf_0255`) |
| 0x72 | 12 (base movement → char[0x11C]) |
| 0x73 | 1 |
| 0x77–0x7E | thief skills (see step 4 caveat) |
| 0x7F | effect list: racial innate effects, permanent |
| 0x8E | gold = `10 · Σ roll(DS:4263/4264 dice) / classes` (u16) |
| 0x96–0x9D | 1 for each component class |
| 0x9E, 0xA0 | gender, alignment |
| 0xA1 | 2 (one attack per round) |
| 0xA3, 0xA5 | 1, 2 → natural attack 1d2 (0xA7 bonus 0; second hand 0) |
| 0xA9 | 50 → base AC 10 (60 − AC), copied to char[0x111] by `FUN_10ba_0bb8` |
| 0xAA | 1 (STR to-hit/damage apply; not set for monsters) |
| 0xAB | Random(256): identity tag used by Add's duplicate check |
| 0xB0 | class-use bitmask |
| 0xB1 | HP roll / classes (before CON) |
| 0xB2 / 0xB5 | 1 cleric / magic-user level-1 slot; cleric WIS bonus `FUN_51cf_01af` |
| 0xBB, 0xBC | portrait head 1–14, body 1–12 (1, 1 by default) |
| 0xBD, 0xBE | combat icon head 0–13, weapon pose 0–31 (0, 0 by default) |
| 0xBF | combat-icon slot: 0 at creation, lowest free 0–7 when joining |
| 0xC0 | icon size 1 small / 2 large (race default; editable) |
| 0xC1–0xC6 | icon colours (low nibble colour-1, high nibble colour-2) for Body, Arm, Leg, Hair/Face, Shield, Weapon. Default `c | (c+8)<<4` with c = 1, 2, 3, 4, 6, 7 → 0x91, 0xA2, 0xB3, 0xC4, 0xE6, 0xF7 (identity) |
| 0x10C | 0 (Okay) |
| 0x10D | 1 (I: conscious/alive flag; cleared when knocked out, set on revival) |
| 0x110–0x11C | AC, THAC0, damage, movement, encumbrance from `FUN_10ba_0bb8` (spec/combat) |

Not set: experience 0, no items, char[0x84] = 0 (player character), char[0x10E] = 0.

## 4. Modify Character and the icon editor

### 4.1 Modify (`FUN_417f_209f`, O)

- Only when experience char[0xAC] = 0, else "NAME can't be modified." (yellow).
- Sheet shown; a cursor (`FUN_417f_2033`) on field 0–5 = STR…CHA or 6 = HP. Menu "Modify character: " / "Keep Exit" with extended keys.

| Key | Effect |
|---|---|
| Down / 2 | next field (6 → 0) |
| Up / 8 | previous field (0 → 6) |
| Right / 6 | +1. STR above the racial max: if STR would exceed 18, the character has a Fighter level and char[0x16] < cap → char[0x16] + 1; STR stays at the max. Other stats capped at the racial max |
| Left / 4 | −1. STR with char[0x16] > 0 lowers char[0x16] instead. If the stat drops below the racial min **or the class min**, it is set to the **racial min** (quirk: one step below the class minimum jumps down to the racial minimum, e.g. a human fighter's STR 9 → 3) |
| HP field ±1 | between `FUN_417f_3fb3` (min: (number of hit dice + CON bonus)/classes, at least 1; Ranger and Monk count one extra die) and `FUN_417f_408c` (max: Σ level × die size, I for the CON term) |
| WIS change | if char[0xB2] ≠ 0 it is reset to 1, then WIS bonus spells recomputed |
| CON change | max HP clamped into the new min/max range |
| K (Keep) | accept; char[0x85] = 1 (I: "modified" flag) |
| E / Esc | restore abilities, char[0x16], max HP |

Current HP always = max HP. No point budget: any stat can be set anywhere inside the racial range. Name, race, class, alignment, portrait and icon cannot be changed here (the icon can via camp Alter → Icon).

### 4.2 Combat icon editor (`FUN_417f_382d`, also from camp Alter, O)

- Frame rows 1–22, cols 1–38. "old" (row 6, col 8) and "new" (row 12, col 8) icons, each with "ready   action" labels (rows 10 and 16, col 3): old = the character's slot char[0xBF], new = preview slot 12.
- Menus (`DS:07BF + 0x29·level`; prompt colours 13/10/15):

| Level | Menu | Keys |
|---|---|---|
| 1 | "Parts color-1 color-2 Size Exit" | **P** → 2; **1** → 3 (colour-1, the third word reads "Hair"); **2** → 3 (colour-2, word "Face"); **S** → 4; **E**/Esc leaves the editor |
| 2 | "Head Weapon Exit" | **H** / **W** → 5 on that part; **E** → 1 |
| 3 | "Weapon Body Hair\|Face Shield Arm Leg Exit" | W → C6, B → C1, H/F → C4, S → C5, A → C2, L → C3, then 5; **E** → 1 |
| 4 | "Small Keep Exit" when large, "Large Keep Exit" when small | **S** size 1, **L** size 2 (preview updates), **K** keep, **E**/Esc revert → 1 |
| 5 | "Next Prev Keep Exit" | head: N/P cycle 0–13 (wrap); weapon: 0–31; colour: the chosen nibble 0–15 (wrap). **K** keeps (back to level 2/3), **E**/Esc reverts the part (colours: all six bytes revert to the last kept set) |

- After leaving: Yes/No "Is this icon ok? " (prompt 13); **N** restarts the editor from the kept values.
- Icon build (`FUN_45c5_0482`): head from CHEAD.DAX, body/weapon from CBODY.DAX. Record = part index, + 0x40 when large (`DS:08C5`: size 1 'S', size 2 'T'), + 0x80 for the action pose (ready = +0) (`FUN_58af_01c8`). Head composited onto body (`FUN_45c5_032f`), then pixel colour c ∈ {1,2,3,4,6,7} → low nibble and c + 8 → high nibble of the matching byte C1…C6 (`FUN_1464_1e5c`).

## 5. Corrections and additions to the existing specs

| Spec | Item |
|---|---|
| chargen | Racial ability adjustments are never applied (dead code, wrong variable). Remove them or flag them as not reproduced |
| chargen | Class menu depends on race only (table 3.2); multi-class combos and alignment lists are now complete |
| chargen | Age is rolled once, before abilities, and kept on re-roll; multi-class age column mapping (step 6) |
| chargen | WIS forced to ≥ 13 for cleric multi-classes; multi-class minimums (3.3) |
| chargen | Exceptional STR needs a **Fighter** level byte (Paladin/Ranger excluded) |
| chargen | Created characters are written to `<stem>.CHA/.ITM/.SPC` + `charlist.txt` and are **not** placed in the party |
| chargen | Defaults: 0xA9 = 50 (AC 10), 0xAA = 1, 0xAB random id, 0xBB/0xBC portrait, 0xC0 size, 0xC1–0xC6 icon colours, 0x10D = 1, 0x6C = 1 |
| records | Add 0x72 (base movement 12), 0x85 (modified), 0xA9, 0xAA, 0xAB, 0xBB–0xBE, 0xC0–0xC6, 0x10D |
| architecture | Party screen: Load only with an empty party; Train only when `B[0x550]` ≠ 0; Create/Add/Exit always on; max 6 PCs / 8 members; Home/End select the member; Exit forces a save if unsaved |
| savegame | A successful Load returns from the party screen straight into the game (`DS:49F8` = 1); no Begin needed |
| graphics | Hotkeys match any character of the items string (digits included); list menus move with Home/End (keypad 7/1), not Up/Down; Yes/No accepts only Y/N |
| new | Start-up: POOL.CFG fields, `STING` command-line bypass, TITLE 1 (5 s), TITLE 2 (5 s, EGA lightning) and credits (10 s) only when CFG line 5 is `F`, code wheel (patched to accept anything) |
