---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Architecture: engine vs data

Part of [[spec/README]].

## The split

| Lives in the engine (code) | Lives in data (`.DAX` etc.) |
|---|---|
| ECL virtual machine | Area scripts (ECL bytecode) |
| 3D view renderer, movement, doors | Maps (GEO), wall art sets (WALLDEF, 8X8D tiles) |
| Combat engine, spell effects, character rules (see [[spec/combat]], [[spec/effects]], [[spec/progression]]) | Monster stats/items/spells (MON*CHA/ITM/SPC), item tables |
| Menus, text window, input | All adventure text (packed inside ECL) |
| Native routines reachable via ECL `CALL` | Pictures, sprites, portraits |

The engine contains no knowledge of specific places. Area identity, exits, encounters, shops and story all live in ECL scripts, which pick the map and wall sets to load (`LOAD_AREA`, `LOAD_WALLSETS`) and jump to other areas (`NEW_ECL`).

## Areas and blocks (observed)

- An **area** is a record id shared across families: ECL record *n* (script), GEO record *n* (map, if it has one)
- Records are grouped into 8 **blocks**, one file per family per block (`ECL1..8`, `GEO1..8`, ...). The current block digit is `DS:5376`
- Some ECL areas have no GEO record of the same id (8, 11, 19); some GEO records have no ECL (30, 31, 32) and are loaded by another area's `LOAD_AREA`
- **Inferred:** blocks mirror the original C64 disk sides

## C64 heritage (inferred, strong)

- ECL addresses are a 16-bit address space where code is loaded at 0x9900 and variables live at 0x4900–0x4CFF and 0x6B00–0x6EFF, with engine registers at 0xC04B+
- Text uses 6-bit codes that map onto Commodore screen codes
- `CALL` dispatches on fixed addresses, consistent with the DOS port emulating C64 machine-code entry points
- ECL records start with `88 13` before the code, skipped by the loader; possibly a vestigial C64 load address or marker

## Main adventure loop (O, `FUN_29c3_32f8`)

Vectors are cached in `DS:49E3` (`on_move`), `49E5` (`on_step`), `49E7` (`camp_menu`), `49E9` (`camp_confirmed`), `49EB` (`on_enter`).

**Start**

1. Game mode 4 (map); current area `DS:84DC` = ECL 0x49F2. Areas 25–27 with ECL 0x49E6 = 0 are overland travel (mode 3).
2. Load the area's ECL record unless resuming a save (`DS:49F8`), reset the VM, run `on_enter`, draw the view.

**Each command**

1. Read a command (`FUN_3e76_0989`, below). It returns only for a move, Encamp or Look. A forward move first sets ECL 0x6DD5 = 1 if the square ahead is open but outside the 16×16 map (`FUN_3e76_068d`), so `on_move` can handle edge exits.
2. While Look is pending (ECL 0x6DCA > 1) or the command is Encamp:
   - Encamp: the camp screen ([[spec/camp]])
   - Look: remember Search (bit 0), set 0x6DCA = 1, run **`on_step`** on the current square, re-enter if the area changed, then restore 0x6DCA to the remembered Search bit
   - then read the next command
3. Run **`on_move`**.
4. If the script changed area (`DS:442F`): re-enter (below). Otherwise:
   - save X, Y to ECL 0x49F0/0x49F1 and try the move (`FUN_3e76_0d6d`, below); play the step sound if the position changed
   - run **`on_step`**; re-enter if the area changed
5. Stop when the quit/party-dead flag `DS:49FF` is set.

So `on_move` and `on_step` run only when the player tries to move forward (or picks a direction outdoors). Turning does not run any script.

### Command menu (O, `FUN_3e76_0989`)

Map areas (`DS:49FA` = 1): "Area Cast View Encamp Search Look", plus the cursor keys.

| Input | Effect | Returns? |
|---|---|---|
| **A**rea | toggle the overhead map (`DS:6AAC`) unless ECL 0x49FB ≠ 0 ("Not Here"); see [[spec/maps]], "Overhead map" | no |
| **C**ast | camp-style cast for the current character if status Okay | no |
| **V**iew | character sheet | no |
| **E**ncamp | | yes |
| **S**earch | toggle bit 0 of ECL 0x6DCA | no |
| **L**ook | set bit 1 of ECL 0x6DCA, short delay | yes |
| Up | move forward | yes |
| Down | turn around (no sound) | no |
| Left / Right | turn 90° (with sound) | no |
| other keys | select another party member | no |

Overland (`DS:49FA` 2–4): "Cast View Encamp Search Look"; the cursor keys set the facing to N/E/S/W and return a move in that direction. The overland icon set (`ICON`) is loaded on first entry.

Command keys are read by the menu loop in [[spec/graphics]] (number keys work as a keypad).

### Moving (O, `FUN_3e76_0d6d`)

- If `on_move` set ECL 0x6DC9 ≥ 0xFF, the move is cancelled and 0x6DC9 reset to 0.
- Map areas: `passage()` from [[spec/maps]]:
  - 1: step forward (`FUN_3e76_073b`)
  - 0: bump sound
  - 2 or 3, locked: "Locked." menu with **Bash**, **Pick** (only if `DS:6DDF` is set and a member has the thief skill, `FUN_3e76_0236(6)`) and **Knock** (only if `DS:6DE0` is set and someone has spell 0x1F, Knock), then Exit. Bash is `FUN_3e76_0294`, Pick `FUN_3e76_04df`, Knock `FUN_3e76_0648`. On a type-3 door, Pick just removes the Pick option (it cannot be picked). A success steps forward.
- Overland: `FUN_3e76_0818`.
- Afterwards any picture animation and encounter sprite are cleared.

### Re-entering after an area change (O, `FUN_29c3_31b4`)

Repeated while scripts keep changing area:

1. Read the square's event byte; clear ECL 0x6DD5; remember the current character.
2. Area kind `DS:49FA` = 1, run **`on_enter`**, game mode 4.
3. If ECL 0x49E6 = 0: area 25 → kind 2, area 26 → kind 3, area 27 → kind 4, all in mode 3 (overland). On entering area 26 with ECL 0x4AB3 = 0xFE and 0x4AA2 = 0, `FUN_4804_06b3(1)` also runs (**?** a story event).
4. Run **`on_move`**, then, if the area did not change again, **`on_step`**. Restore the current character and redraw.

## Starting a new game (I)

"Begin adventuring" on the party screen switches to block 3 (O) and enters the main loop with fresh ECL variables, so the current area (ECL 0x49F2) is 0: New Phlan, `ECL3` record 0. Its `on_enter` loads GEO 0 and wall sets (`LOAD_WALLSETS 127,127,127` → WALLDEF3 #0, three sets) and, while script variable 0x4AC5 is 0, plays the opening tour: Rolf (sprite 12, portrait head 8 / body 9) greets the party, then the script walks it through a 34-step waypoint table (x, y, facing and a stop number at `0xB5B4`, `0xB5D6`, `0xB5F8`, `0xB592`), printing commentary at five stops, and sets 0x4AC5 = 1. The browser port's new game reproduces this and plays the same way (tested).

## Built-in screens (O)

Entered through ECL `PROGRAM n` (0x38) or the main loop:

| Mode | Screen | Routine |
|---|---|---|
| 0 | Party / training hall screen; switches to block 3 (New Phlan) | `FUN_417f_0161` |
| 8 | Ending sequence: `FINAL` pictures and text, extra pictures for larger parties | `FUN_4804_02a4` |

### Ending (O, `FUN_4804_02a4`, animation helper `FUN_4804_0006`)

Game mode 7 while it runs, then restored; pictures from `FINAL<block>` (records decoded with XOR frames), positions in pixels within a 120×120 area:
1. Text rows 17–19: "Mortally wounded, the dragon roars!" / "The spirit of Tyranthraxus flares up" / "from the dragon's body."
2. Record 1 at (0, 0); record 2 (88×88, 4 frames) animated at (16, 32) for `(10 − speed) × 5 / 2` cycles.
3. Record 3 at (0, 0); with 2+ in the party record 4 at (0, 88), 3+ record 5 at (104, 72), 4+ record 6 at (0, 72).
4. Six rows: Tyranthraxus's speech ("Fools, you have but slain the body" … "of you!""); record 7 animated at (16, 0) for the same number of cycles.
5. Four rows: "\"No Lord Bane!  I can still rule here!" … "Noooo..."; record 8 animated at (16, 0) once.
6. Three calls to `FUN_1709_0dbe`, then the view is redrawn and the script continues (PROGRAM acts as EXIT).

A frame stays up while the timer (`FUN_1709_0c3f`) has advanced by at most (speed + 3) × its delay; the helper counts a cycle each time the frame index wraps.
| 9 | Encamp (runs the area's camp vectors) | `FUN_29c3_2dd3` |
| `E` key while exploring | Encamp | main loop |

### Party screen (`FUN_417f_0161`)

Menu "Choose a function": **C**reate character (`FUN_417f_056c`), **D**rop (`1f37`), **M**odify (`209f`), **T**rain (`29ae`, see [[spec/progression]]), **V**iew, **A**dd character from disk (`306d`), **R**emove, **L**oad game (`FUN_45c5_1602`), **S**ave game (`FUN_45c5_1d58`, see [[spec/savegame]]), **B**egin adventuring, **E**xit ("Quit to DOS", saves first if needed). Items are enabled per state (no current character → only Create/Load/Add…; Train only if the area's class mask `B[0x550]` is set).

Hidden: **J** on the party screen, when the game was started with the command-line parameter `STING`, prints "I Understand, master..." and sets `DS:470C`, which makes training free and skips the status, money, experience and hall checks (developer cheat; nothing is typed after J, see [[spec/progression]]).

Cheat mode (O for the keys below): when the first command-line parameter is `STING` (`START STING`), the shared key reader (load-image 0x89E9) also accepts **Ctrl-C** (quit to DOS at once, 0x8990) and **Ctrl-D** (toggle `DS:49F7`, hit-point debugging). **Ctrl-S** toggles sound in any mode. The GameFAQs guide ([[spec/README]], External references) adds **Alt-X** to win a combat at once, and says the introduction and copy protection are skipped (**?** not yet traced).

## Sound (O)

See [[spec/sound]]. Effects are played by number with `FUN_18ae_00dc(n)` from a table at `DS:2610`; the game uses 2–12 (10 footstep, 7 bump, 11 script effect via `CALL 0xBA03`). By default each effect is **cut off after about 0.1 s**; only some code sections let effects play in full.
