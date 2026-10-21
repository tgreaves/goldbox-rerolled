# GoldBox Rerolled specification

> **Status: being restructured.** Part A (the original games) is written; parts B, C and D and the
> companion documents are stubs that list what each will contain. The plan and the coverage
> matrix that scoped the work are in [AUDIT.md](AUDIT.md) (Phase 1, kept for provenance); step 1
> of its work plan (this layout, the moves, links, simple fixes) is done.

This is the normative specification of **GoldBox Rerolled**, a reimplementation of SSI's Gold Box
engine for the web browser. It is the **single source of truth**: a builder, human or AI, should be
able to rebuild the whole port from this specification **plus the player's own game files**,
without reading the reference implementation (`web/`, `server/`, `tools/`). Game data is never
copied here: the spec says where each value lives in the game files and how to decode it.

Back to the [project README](../README.md).

## Scope

- **In scope:** the original games as the port needs them (engine behaviour, data formats, rules,
  scripts, presentation), the engine model that lets one engine run every game from data, and the
  port's own design (interface, 3D view, storage, accounts and sync, offline app).
- **Games:** *Pool of Radiance* (DOS 1.3, the GOG release) is described in full;
  *Curse of the Azure Bonds* (DOS, GOG 1.0) as differences from it. A later game is added as
  another set of differences plus its profile ([B-model/adding-a-game.md](B-model/adding-a-game.md)).
- **Out of scope:** the game files' contents (read from the player's copy); the development tools
  and tests (reference implementations, [xref.md](xref.md)); deployment of the server
  ([docs/server.md](../docs/server.md)); the working method of the repository
  ([CLAUDE.md](../CLAUDE.md)); project status ([docs/multi-game.md](../docs/multi-game.md)).

**Authority.** For the original games the binaries and data files are the authority: the spec
describes them, and a disagreement found later is a spec error, fixed with its evidence. For
everything the port adds, this spec is normative and the reference implementation follows it;
while a part-C file is still a stub, the reference implementation stands in for it, and
[IMPROVEMENTS.md](../IMPROVEMENTS.md) is the register of every departure from the original.

## How to read this spec

- Start here, then part A for the game, part B for how the engine is parametrised, part C for the
  port. Each file opens with a line saying which part it belongs to; open points are collected at
  the end of each file ("Open") and in the register [open-questions.md](open-questions.md).
- **Normative language.** Statements are normative unless marked *informative*. Where
  **MUST / SHOULD / MAY** appear they have their RFC 2119 meaning.
- **A conforming build**
  1. implements the rules, scripts and formats of part A as written, the original's bugs included,
     except the departures part C specifies (listed in [IMPROVEMENTS.md](../IMPROVEMENTS.md));
  2. loads the original save files and writes them back byte-compatible; port-only data goes in
     sidecar files (`.GBR`), never in the original records;
  3. reads game data and game text from the player's files (D1 below);
  4. takes every random draw that affects the game from the injected dice source (D2);
  5. passes the checklist in [CONFORMANCE.md](CONFORMANCE.md).

### Evidence marks

Every statement about the original carries a mark, with the routine or address that shows it:

| Mark | Meaning |
|---|---|
| **O** | observed: read in the engine code, or checked against every record of the shipped data |
| **I** | inferred: consistent with the code and data, not proven; a hypothesis |
| **?** | unknown: not yet examined or not settled |
| **G** | from Stephen Lee's GameFAQs guide (below), not checked in code |
| **Bug** | behaviour of the original that looks unintended; a conforming build reproduces it unless a departure fixes it |

Where the port implements an **I** or **?** item it states its choice next to it, so a builder and
the reference cannot differ silently.

### Notations

| Notation | Meaning |
|---|---|
| `seg:off`, `FUN_seg_off` | PoR: Ghidra address and function name in the merged image (`START.EXE` unpacked, `GAME.OVR` overlays merged by `tools/mergeovr.py`; load segment 0x1000; linear = seg·16 + off) |
| `0x2555D` | CotAB: offset in the engine image with overlays merged ([coab/README.md](A-games/coab/README.md), "Working image") |
| `DS:x` | offset x in the game's data segment (PoR and CotAB have different DS bases) |
| ECL `0x49F2` | an ECL (script) address: A space from 0x4900, B from 0x6B00 in PoR ([engine/ecl.md](A-games/engine/ecl.md), "Memory map") |
| `A[x]`, `B[x]` | byte offset x into the word array behind ECL A or B (`x = 2·(var − base)`) |
| `char[x]`, `c[x]` | byte x of the character/monster record; `item[x]` of an item record; `R[x]` of a combat record |
| `ITEMS[t][k]` | byte k of item type t in the `ITEMS` table |
| `dN`, `roll(n, s)` | one die of N sides (1..N); the sum of n dice of s sides |

### Normative and informative

- **Game data (D5).** A value that can be read from the game files is **informative** in the spec:
  its address, size and decoding are normative, and dumps of the values themselves go to
  appendices as expected values for checking a decoder
  ([D-appendices/expected-values.md](D-appendices/expected-values.md)). A value the port authors
  (spell notes, the rules reference, landmark patterns …) is **normative** and is stated in full
  ([D-appendices/port-data.md](D-appendices/port-data.md)).
- **Game text (D1).** Text that is in the game files is read from them by address, as the ending
  captions and CotAB's start-up menu already are. The spec gives the address
  ([D-appendices/strings.md](D-appendices/strings.md)), not a copy; quotations in the text are
  there to identify a message, not to define it.
- **User interface (D4).** The normative part is the **behaviour contract**: every screen, its
  states, its controls and keys, its texts, what each does, and its layout described in words per
  screen class. Exact CSS and pixel values are informative. [CONFORMANCE.md](CONFORMANCE.md)
  checks the look.
- **3D view (D6).** The original's drawn view ([engine/maps-and-view.md](A-games/engine/maps-and-view.md))
  is the normative conformance target, pixel-exact for a given map, position, facing and wall
  sets. The port's WebGL view is an optional enhancement, checked against a reference render
  within a tolerance ([C-port/exploration-view.md](C-port/exploration-view.md)).

### Randomness: the dice tape (D2)

Every random draw that can change the game state comes from **one injected source**: a request
`(count, sides)` answered with the sum of `count` dice of `sides` faces. A draw the original makes
as Turbo Pascal `Random(n)` is the request `(1, n)` minus 1. The order in which the procedures of
this spec make their requests is normative: it is the original's order of calls where observed.
The sequence of requests and results of a run is its **dice tape**. Feeding a recorded tape to
another conforming build reproduces the run roll for roll, which is how battles, battlefields and
random treasure are compared ([VALIDATION.md](VALIDATION.md),
[D-appendices/test-vectors.md](D-appendices/test-vectors.md)).

The generator behind the source is **informative**: the original uses Turbo Pascal's `Random`
(`FUN_1af8_11c0` in PoR); the reference implementation uses a seeded xorshift. Draws that only
affect presentation (the title's lightning, sound noise) may use any generator.

### Links

Plain Markdown links, relative to the file: `[text](file.md#anchor)`, the anchor being the
heading as GitHub renders it. `tools/speclinks.py` checks every link and anchor in the
repository's Markdown files.

## Part A: the original games

### Engine, as Pool of Radiance defines it ([A-games/engine/](A-games/engine/))

| File | Covers | Status |
|---|---|---|
| [containers.md](A-games/engine/containers.md) | EXEPACK, overlays, DAX archives, RLE | complete |
| [graphics.md](A-games/engine/graphics.md) | image blocks, record shapes, animation, sprites, transparency, font, screen layout | partial: `x, y` and `cga_map` of the image header undecoded |
| [maps-and-view.md](A-games/engine/maps-and-view.md) | GEO maps, coordinates, movement, wall sets, the drawn 3D view, the overhead map | complete |
| [records.md](A-games/engine/records.md) | character, monster, item and effect records; ITEMS; random items; inventory, readying, derived statistics | partial: the effect record layout is I; data dumps to move to appendices (D5) |
| [savegame.md](A-games/engine/savegame.md) | save slot files and the world state | complete |
| [ecl.md](A-games/engine/ecl.md) | the ECL script VM: encoding, memory map, opcodes, CALL targets | complete |
| [main-loop.md](A-games/engine/main-loop.md) | engine and data, the main adventure loop, command menu, moving and doors, area entry, built-in screens | partial: starting a new game is I |
| [input-and-menus.md](A-games/engine/input-and-menus.md) | input widgets, start-up sequence, party screen, Modify, combat-icon editor | complete |
| [chargen-and-progression.md](A-games/engine/chargen-and-progression.md) | character creation, experience, levels, training, saving throws, thief skills | complete |
| [camp-and-time.md](A-games/engine/camp-and-time.md) | encamp, magic, memorise, scribe, rest, the game clock | complete |
| [town.md](A-games/engine/town.md) | shops, temples, items menu, money, appraisal, game modes | complete |
| [overland.md](A-games/engine/overland.md) | the tile wilderness: map, view, river cleansing, moving | complete |
| [combat-rules.md](A-games/engine/combat-rules.md) | battle start, rounds, player turn, movement, attacks, statuses, aftermath, known bugs | complete |
| [battlefield.md](A-games/engine/battlefield.md) | the battle grid, cell table, line of sight, wilderness and map-area generators | complete |
| [combat-ai.md](A-games/engine/combat-ai.md) | computer-controlled combatants: targets, morale, spells and items, weapons, movement | complete |
| [combat-visuals.md](A-games/engine/combat-visuals.md) | what a battle draws: poses, missiles, sparkle, skull, side panel, palette | complete |
| [spells.md](A-games/engine/spells.md) | the spell table, casting, memorisation, per-spell effects | complete |
| [effects.md](A-games/engine/effects.md) | effect types 1–139: events, handlers, durations, item effects | partial: a few types undeciphered (§3); its port status moves to part B |
| [sound.md](A-games/engine/sound.md) | the sound driver: bytecode, timer, PC speaker and Tandy, effects and call sites | complete |

"Complete" means a builder can implement the subject from the file; open points are listed in
it. Every part A file still gets the step 5 clean-up of [AUDIT.md](AUDIT.md) §8 (statements about
the port move to part C, data dumps to appendices, game text to addresses).

### Pool of Radiance ([A-games/por/](A-games/por/README.md))

| File | Covers | Status |
|---|---|---|
| [README.md](A-games/por/README.md) | identity (hashes, compiler, addresses), the external reference | complete |
| [title-and-credits.md](A-games/por/title-and-credits.md) | the credits screen and the code wheel | complete |
| [commissions.md](A-games/por/commissions.md) | commissions, rewards, the graveyard bounty, proclamations | complete |
| [ending.md](A-games/por/ending.md) | the ending sequence | complete |

### Curse of the Azure Bonds ([A-games/coab/](A-games/coab/README.md))

Differences from the engine files above. Status **partial** throughout: complete as a diff, but
the "Port" sections are to move to part B.

| File | Covers |
|---|---|
| [README.md](A-games/coab/README.md) | identity, the working image, tools, open questions |
| [ecl.md](A-games/coab/ecl.md) | the script VM: address spaces, new and changed opcodes, CALL targets, start-up menu and demo |
| [records.md](A-games/coab/records.md) | the 422-byte character record, items, effects, SAVGAM, monsters, the roster, the PoR import, random treasure, joining |
| [tables.md](A-games/coab/tables.md) | DS base and every rules table, PoR → CotAB addresses; rule differences with values |
| [spells.md](A-games/coab/spells.md) | spell handlers by id, the new spells, durations, quirks |
| [effects.md](A-games/coab/effects.md) | event lists, changed and new handlers, item kinds, monster-class flags, the target hook |
| [combat.md](A-games/coab/combat.md) | the battlefield generators, the cell table, casting |
| [assets.md](A-games/coab/assets.md) | DAX families, the 3D view's sky and ground, BIGPIC, title and start-up, sound |

## Part B: the engine model ([B-model/](B-model/))

How one engine runs every game from data (work-plan step 2).

| File | Covers | Status |
|---|---|---|
| [profile.md](B-model/profile.md) | the game profile, field by field | stub |
| [records-and-tables.md](B-model/records-and-tables.md) | field maps, table maps, records kept native | stub |
| [script-vm-map.md](B-model/script-vm-map.md) | ECL memory regions, canonical numbering, opcode variants | stub |
| [procedures.md](B-model/procedures.md) | each parametric rules procedure once, with each game's source | stub |
| [vocabularies.md](B-model/vocabularies.md) | effect, item and spell behaviours, monster specials | stub |
| [host-contracts.md](B-model/host-contracts.md) | the engine-to-screen interfaces, the dice source, the headless harness | stub |
| [files-and-detection.md](B-model/files-and-detection.md) | required and kept files, detection, stores | stub |
| [adding-a-game.md](B-model/adding-a-game.md) | the method for a new game | stub |

## Part C: GoldBox Rerolled ([C-port/](C-port/))

The port's own design (work-plan steps 3 and 4).

| File | Covers | Status |
|---|---|---|
| [overview.md](C-port/overview.md) | requirements, constraints, conformance | stub |
| [app-flow.md](C-port/app-flow.md) | games screen, import, title, party screen, play, demo, ending | stub |
| [ui-contract.md](C-port/ui-contract.md) | layouts, panels, command bar, input map, text log (D4) | stub |
| [screens.md](C-port/screens.md) | every screen's states, inputs and texts | stub |
| [exploration-view.md](C-port/exploration-view.md) | the 3D view (D6), sprites, wilderness view, area map | stub |
| [combat-ui.md](C-port/combat-ui.md) | the battle screen | stub |
| [rendering.md](C-port/rendering.md) | pixel scaling, frames, the font, icons, palette | stub |
| [audio.md](C-port/audio.md) | device choice, the cut-off rule, Tandy | stub |
| [storage.md](C-port/storage.md) | browser storage, the `.GBR` sidecar, ZIP export and import | stub |
| [accounts-and-sync.md](C-port/accounts-and-sync.md) | the optional server and sync | stub |
| [pwa-and-build.md](C-port/pwa-and-build.md) | the offline app, the single-file build, the version line | stub |
| [departures.md](C-port/departures.md) | each IMP id → the section that specifies it | stub |

## Part D: appendices ([D-appendices/](D-appendices/))

| File | Covers | Status |
|---|---|---|
| [addresses.md](D-appendices/addresses.md) | index of routines and tables, both games (informative) | stub |
| [strings.md](D-appendices/strings.md) | game messages by id and address (D1) | stub |
| [port-data.md](D-appendices/port-data.md) | data the port authors (normative) | stub |
| [expected-values.md](D-appendices/expected-values.md) | dumps of game-file values for checking (informative) | stub |
| [glossary.md](D-appendices/glossary.md) | terms | stub |
| [test-vectors.md](D-appendices/test-vectors.md) | dice tapes and expected outputs | stub |

## Companion documents

- [CONFORMANCE.md](CONFORMANCE.md): a self-audit for a finished build (stub).
- [CLEANROOM.md](CLEANROOM.md): how to run a build by a fresh builder who has only the spec and the
  game files (stub).
- [VALIDATION.md](VALIDATION.md): the record of cross-checks, test suites and clean-room runs; kept
  out of clean-room file sets (stub).
- [xref.md](xref.md): spec section → reference implementation; kept out of clean-room file sets
  (stub).
- [open-questions.md](open-questions.md): the register of open questions (living).
- [AUDIT.md](AUDIT.md): the Phase 1 audit, its decisions and work plan (provenance, not normative).

## External reference

Stephen S. Lee, *Pool of Radiance: Exhaustive Game Information*, v2.00 (April 2026),
[GameFAQs](https://gamefaqs.gamespot.com/pc/564785-pool-of-radiance/faqs/73869): the source of
**G** statements. Details in [A-games/por/README.md](A-games/por/README.md).
