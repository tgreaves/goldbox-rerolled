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

## Main adventure loop (observed, `FUN_29c3_32f8`)

1. On area entry: load `ECL<block>` record (`FUN_2fea_0341`), reset the VM and read the 5 vectors (`FUN_2fea_01b6`), run `on_enter`
2. Loop:
   - read a command key (`FUN_3e76_0989`)
   - `E` (Encamp): run `camp_menu`; if confirmed, run `camp_confirmed`
   - after a move/turn: run `on_move`; if no area change, apply the move (`FUN_3e76_0d6d`, door handling) and run `on_step` at the new square
   - if a script requested an area change (`DS:442F`), re-enter (`FUN_29c3_31b4`): recompute the square, run `on_enter`, `on_move`, `on_step`
3. Exit when `DS:49FF` is set

See [[spec/ecl]] for the vectors and [[spec/maps]] for movement.

## Built-in screens (O)

Entered through ECL `PROGRAM n` (0x38) or the main loop:

| Mode | Screen | Routine |
|---|---|---|
| 0 | Party / training hall screen; switches to block 3 (New Phlan) | `FUN_417f_0161` |
| 8 | Ending sequence: `FINAL` pictures and text, extra pictures for larger parties | `FUN_4804_02a4` |
| 9 | Encamp (runs the area's camp vectors) | `FUN_29c3_2dd3` |
| `E` key while exploring | Encamp | main loop |

### Party screen (`FUN_417f_0161`)

Menu "Choose a function": **C**reate character (`FUN_417f_056c`), **D**rop (`1f37`), **M**odify (`209f`), **T**rain (`29ae`, see [[spec/progression]]), **V**iew, **A**dd character from disk (`306d`), **R**emove, **L**oad game (`FUN_45c5_1602`), **S**ave game (`FUN_45c5_1d58`, see [[spec/savegame]]), **B**egin adventuring, **E**xit ("Quit to DOS", saves first if needed). Items are enabled per state (no current character → only Create/Load/Add…; Train only if the area's class mask `B[0x550]` is set).

Hidden: **J** then typing `STING` prints "I Understand, master..." and sets `DS:470C`, which makes training free and skips the experience and class checks (developer cheat).
