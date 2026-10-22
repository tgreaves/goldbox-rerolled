---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Input widgets, start-up and the party screen

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Evidence marks as in the README; addresses are PoR's (`seg:off`, `FUN_seg_off`).
> Curse of the Azure Bonds: its start-up menu is in [coab/ecl.md](../coab/ecl.md), its title in
> [coab/assets.md](../coab/assets.md); the party screen is as here unless those say otherwise.

The shared input widgets, the start-up sequence, the party screen, Modify and the combat-icon editor. Character creation (its flow, tables and the record bytes it sets) is in [chargen-and-progression.md](chargen-and-progression.md); Pool of Radiance's credits screen and code wheel are in [title-and-credits.md](../por/title-and-credits.md).

Addresses are `seg:off` (linear = seg·16 + off). Colours are EGA indices; text grid 40 × 25. `print(text, colour, row, col)` = `FUN_1709_0626`.

## 0. Shared input widgets (needed by every screen below)

### Horizontal menu `FUN_53aa_03bd(prompt, items, promptCol, normalCol, hlCol, extKeys, animate, &isExt)` (O)

- Prompt printed at row 24, col 0 in `promptCol`; `items` (space-separated words) follow it on row 24.
- Drawing (`53aa:01da`): the highlighted word (`DS:6B2B`, 1-based) in `hlCol`; in the other words, capitals/digits (set `53aa:01ba`) in `hlCol`, other characters in `normalCol`. With `hlCol = normalCol = 0` (party screen) the items are invisible.
- Keys: a key (upper-cased) that equals **any** character of the items string selects that word and returns the key (so `1`/`2` are hotkeys in "color-1 color-2"); `,`/`.` move the highlight left/right (wrap); Space returns at once; Esc returns 0; Enter returns 0x0D only if `hlCol` or `normalCol` ≠ 0 (callers of horizontal menus act only on letters, so Enter is effectively ignored there, I).
- `extKeys`: an extended key returns its scan code with `isExt = 1`; digits 1–9 then act as a keypad via `DS:288C` (1 End 0x4F, 2 Down 0x50, 3 PgDn 0x51, 4 Left 0x4B, 5 → 0x20, 6 Right 0x4D, 7 Home 0x47, 8 Up 0x48, 9 PgUp 0x49); `\` → 0x37.
- An optional timeout (`DS:6B2E`, u32, hundredths of a second) returns the default key `DS:6B32` when it expires; a negative value disables it.
- Extended keys pass through the table at `DS:285B` when the caller accepts them (cursor movement, **I**).
- While waiting, the picture animation runs ([graphics.md, "Animation"](graphics.md#animation-o)).

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
| 6 | Credits screen ([title-and-credits.md](../por/title-and-credits.md)), wait **10 s** or a key. The boxes are `FUN_13f1_02e8(title, title colour, frame style, x1, y1, x2, y2)`: clear, then frame glyphs `0x114 + 3·style + k` around the box (`FUN_13f1_0000`, drawn with `FUN_1428_002a`), the title centred on the top row. The glyph table maps indices 0x100–0x11E to `8X8D1` #202 (31 colour tiles); style 0 is tiles 20 (yellow corner square), 21 (vertical red rope), 22 (horizontal red rope) | `FUN_290c_0206`, O |
| 7 | Code-wheel check ([title-and-credits.md](../por/title-and-credits.md)) | `FUN_298d_00fd` (= `290c:090D`), O |
| 8 | Party screen `FUN_417f_0161`; returns on Begin/Load | O |
| 9 | `FUN_55a0_0155(0x0B, 0, 7, 6)` (0x12C: the default view band colours DS:6A60–6A63, sky 11, line 0, band 7, floor 6), main adventure loop `FUN_29c3_32f8`, then exit to DOS | O |

No other intro text exists in the executable.

## 2. Party screen (`FUN_417f_0161`)

### Entry (O)

`DS:5376` (block) = 3, training cheat `DS:470C` = 0, game mode `DS:49F3` = 0.

### Layout (O)

- Frame rows 1–22, cols 1–38 (`FUN_13f1_02e8("",0,0,22,38,1,1)`), redrawn after every action.
- Roster (`FUN_10ba_0767`, only if a current character exists): row 2 headings "Name" / "AC  HP" (white), one row per member from row 4 (name, AC, HP; current character white). See [graphics.md](graphics.md), "Screen layout". Rows 4–11 leave room for **8** members.
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
| J | (hidden) | only when started as `START STING`: "I Understand, master..." and free training ([chargen-and-progression.md](chargen-and-progression.md)); nothing is typed after J |

"Current character exists" = `DS:5D92` ≠ nil (always true when the party is non-empty).

### Keys (O)

- Letters above. A disabled letter does nothing.
- **Home / keypad 7**: previous party member (wraps to last); **End / keypad 1**: next (wraps to first) (`FUN_4894_27df`, set `417f:00F6` = {0x47, 0x4F}); roster redrawn.
- Any key except E, S and the two cursor keys clears the "saved" flag `DS:557D` (set `417f:0116`).

### Actions

| Action | Behaviour |
|---|---|
| Create | [chargen-and-progression.md](chargen-and-progression.md). The new character is written to disk and **not** added to the party (O: `FUN_45c5_069e` at `417f:1EAD`, then FreeMem at `417f:1EC9`) |
| Drop (`417f:1F37`) | Yes/No "Drop NAME forever? " then "Are you sure? ". Both Y: message "You dump NAME out back." if char[0x10D] = 0 (unconscious/dead, I) else "NAME bids you farewell."; remove from party, free combat-icon slot, free record. **No file is deleted or written**; its charlist entry was already removed when it joined (below). Otherwise "NAME breathes a sigh of relief." (O) |
| Modify (`417f:209F`) | §3 |
| Train (`417f:29AE`) | [chargen-and-progression.md, "Training"](chargen-and-progression.md#training-o-fun_417f_29ae) |
| View | character sheet viewer `FUN_4894_0ab3` (O) |
| Add (`417f:306D`) | §2.1 |
| Remove | save the character to its own files and append it to `charlist.txt` (`FUN_45c5_069e("", char)`), then unlink and free it (`FUN_417f_3291(1,0)`): party count `B[0x67C]` − 1, combat-icon slot freed, current = previous member (or new head) (O) |
| Load (`FUN_45c5_1602`) | [savegame.md](savegame.md). If a game was loaded (`DS:49F3` ≠ 0 afterwards) the party screen **returns immediately** with `DS:49F8` = 1 — the game resumes without pressing Begin (O; [savegame.md](savegame.md), "Loading" step 7) |
| Save (`FUN_45c5_1d58`) | needs a non-empty party. "Save Which Game: " menu "A B C D E F G H I J" (13/10/15); Esc cancels; writes `SAVGAM<x>.DAT` + `CHRDAT<x><n>.SAV/.ITM/.SPC` in the save path; sets `DS:557D` = 1 (O) |
| Begin | needs a non-empty party: `DS:49F3` = 4 (map mode), return → main loop in block 3 (O). Nothing else is set here; area 0 comes from the cleared ECL arrays (I) |
| Exit | Yes/No "Quit to DOS " (prompt yellow 14). Y: while the game is unsaved (`DS:557D` = 0) and the party is non-empty, run Save again (Esc just re-prompts), then exit to DOS (O) |

### Cheat keys

Cheat mode (O for the keys below): when the first command-line parameter is `STING` (`START STING`), the shared key reader (load-image 0x89E9) also accepts **Ctrl-C** (quit to DOS at once, 0x8990) and **Ctrl-D** (toggle `DS:49F7`, hit-point debugging). **Ctrl-S** toggles sound in any mode. The GameFAQs guide ([por/README.md, "External reference"](../por/README.md#external-reference)) adds **Alt-X** to win a combat at once, and says the introduction and copy protection are skipped. In the code: `STING` skips the title pictures and the credits (§1 step 3, O) but not the code wheel, which this binary accepts anything at anyway ([title-and-credits.md](../por/title-and-credits.md)); Alt-X and `−` are read during computer-controlled turns ([combat-ai.md, "Keyboard during AI turns"](combat-ai.md#keyboard-during-ai-turns-o-fun_3334_0fc1)); there the cheat (`FUN_3aae_3b93`, O) does nothing unless started as `START STING`; then it prints "The Gods intervene!" (`3aae:3B7F`) and every combatant on the enemy side (char[0x10E] = 1) is killed: out of play (char[0x10D] = 0), status 6, its icon cleared from the battlefield, its turn ended (the battle then ends at the next side check, [combat-rules.md](combat-rules.md#battle-flow-o)).

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
| Party in a save slot | `CHRDAT<slot><n>.sav/.itm/.spc` ([savegame.md](savegame.md)) |

`stem` = character name with every ` . * , ? / \ : ;` and `|` removed (table `DS:0D1A`), first 8 characters. Two names with the same stem overwrite each other. On a write error: "Put save disk in X:" (X = drive letter of the save path) and retry.

## 3. Modify Character and the icon editor

### 3.1 Modify (`FUN_417f_209f`, O)

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

### 3.2 Combat icon editor (`FUN_417f_382d`, also from camp Alter, O)

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

## Open

- ~~Start-up step 9's background call~~: `FUN_55a0_0155(0x0B, 0, 7, 6)` stores the default band colours
  (DS:6A60–6A63), which `FUN_55a0_0174` fills; the redraw `FUN_54cf_016d` sets the sky from DS:0C26 every
  time and line, band and floor while DS:84E5 is set, which the VM reset does (0x2007A), so the start-up
  values last until the first reset (O; [maps-and-view.md](maps-and-view.md)). CotAB makes no such call.
- Inferred (**I**): `POOL.CFG` line 2 as the sound device and line 5 as "fixed disk"; the extended-key
  table `DS:285B`; Enter in horizontal menus being ignored by their callers; Modify's maximum-HP CON
  term; char[0x85] as the "modified" flag; the Drop message's test of char[0x10D].
