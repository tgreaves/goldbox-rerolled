# Adding a game

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

The procedure for describing another Gold Box game to the engine. The engine is meant for every game
of the series; Pool of Radiance defines the engine ([A-games/engine/](../A-games/engine/)) and Curse
of the Azure Bonds was added as differences ([A-games/coab/](../A-games/coab/README.md)), which is the
pattern a later game follows.

## 1. What a new game needs

1. **Its profile**: one value per profile module ([profile.md](profile.md)), every field filled, and
   the game appended to the list of games.
2. **Only genuinely new procedures**: where the game's code does something no existing procedure
   does, a new procedure (or a new parameter of an existing one, or a new behaviour, kind or
   variant in a vocabulary) named by **what it does**, never by the game, so that a later game can
   pick it too ([procedures.md](procedures.md), [vocabularies.md](vocabularies.md),
   [script-vm-map.md §5](script-vm-map.md#5-opcodes)).
3. **Nothing else**: shared code does not name the game, and no existing game's behaviour changes
   (both games' checks, §3, still pass).

Values come from the game's own files wherever they are there; what the original holds as code
becomes profile data; text the game has is read from its files by address
([profile.md §1.1](profile.md#11-where-a-value-comes-from)).

## 2. The method

Each step has a result that the next step uses. Tools named are the repository's reference tools
(informative: any tools that give the same result will do).

| Step | Do | Result |
|---|---|---|
| 1. Unpack | Undo START.EXE's EXEPACK ([engine/containers.md](../A-games/engine/containers.md); `tools/unexepack.py`); merge the GAME.OVR overlays into the image (`tools/mergeovr.py`); disassemble the merged image | the **working image**, with a stated notation for its addresses (CotAB: image offsets, [coab/README.md, "Working image"](../A-games/coab/README.md#working-image)) |
| 2. Data segment | Find the Turbo Pascal start-up's `mov dx,…; mov ds,dx` | `tables.ds` |
| 3. Containers and files | Check the DAX families, the configuration file, the character and save files against part A | `config`, `markers`, `required`, `keep`, `imageFamilies`, `saves` ([files-and-detection.md](files-and-detection.md), [records-and-tables.md §4](records-and-tables.md#4-save-files-savefiles)) |
| 4. Diff the engine | For each part A subject (records, tables, ECL, rules, spells, effects, combat, assets), find the routine that does the same job and compare it with PoR's; write what differs, with addresses for both games, as part A files `A-games/<game>/` | the game's part A diff, marked **O/I/?** ([README.md, "Evidence marks"](../README.md#evidence-marks)) |
| 5. Records | Map every character-record field the engine names (the field map); check it against the game's own characters | `fields` ([records-and-tables.md §2](records-and-tables.md#2-the-field-map-charfields)) |
| 6. Tables | Locate every table of the table map, with its row size; mark the ones the game lacks absent (−1) | `tables` ([records-and-tables.md §3](records-and-tables.md#3-the-table-map-tablemap)) |
| 7. Script VM | The four regions; the character view's changed reads; opcodes handled differently (variants), skip and operand counts, CALL targets and sounds, the behaviour flags; the start block and record | `ecl` ([script-vm-map.md](script-vm-map.md)) |
| 8. Rules | For each procedure of [procedures.md](procedures.md): the game's parameters, from its routine; a procedure the game does differently becomes a new parameter or a new procedure (§1) | `rules`, `treasure`, `imports` |
| 9. Handlers | Map every spell id and effect type of the game's handler tables, and every item kind, to a kind or behaviour with its parameters; give the event lists in the original's call order | `spells`, `effects` ([vocabularies.md](vocabularies.md)) |
| 10. Presentation | View dressing, frames, title, start-up menu, sound driver, ending | `view`, `title`, `startMenu`, `sound`, `ending` ([profile.md §3](profile.md#3-presentation-modules)) |
| 11. Port data | Spell notes, the Rules reference, landmark patterns, journal, debug jumps | [D-appendices/port-data.md](../D-appendices/port-data.md) |
| 12. Check | §3 | a profile that passes |

## 3. Checks

A new game's profile MUST pass, against the game's own files:

1. **Field map**: every pre-made and shipped character read through the map gives sane names,
   levels, HP and statuses, and writes back byte-identical.
2. **Table map**: every table read through the map gives values in range (names are printable
   Pascal strings, counts within their rows); the dumps go to
   [D-appendices/expected-values.md](../D-appendices/expected-values.md) for later checks.
3. **Save files**: the shipped save loads and saves back at the game's size; a save of area 0 starts
   where the game's loader starts it.
4. **Script sweep**: every area entered, and from every square (or a regular sample of them) a move
   run through `on_move` and `on_step` with menus answered at random, shows **no interpreter errors**
   (no missing handler, no jump outside the script); runs that loop waiting for a menu or travel are
   listed, not failed ([engine/ecl.md, "Validation"](../A-games/engine/ecl.md#validation)).
5. **Handler maps**: every effect type the game's events, spells, monsters, characters and items can
   add names an existing behaviour; every spell id names an existing kind.
6. **Procedures**: each procedure with new parameters reproduces a transcription of the original's
   routine on scripted dice (the pattern of the battlefield and casting checks,
   [VALIDATION.md](../VALIDATION.md)).
7. **Earlier games**: every check of every earlier game still passes unchanged.

## 4. What is still a paired procedure

*Informative*, the state at this writing. These places still hold a game's knowledge in shared code
or as a game's own procedure; a new game will meet them, and each is to become data or a parametric
procedure:

- **The ending**: PoR's sequence is its own procedure (`ending.por`) beside the generic steps
  ([profile.md §3.5](profile.md#35-the-ending-endingscript)).
- **Effect type numbers in shared code**: the temple's types (33, 55, 36, 22, 15, 68), combat's
  hold and sleep types, the cloud occupant check's 0x1E/0x1F, the current-stat routine's types
  ([procedures.md §11](procedures.md#11-the-current-stat-routine)) and the monster specials' 25 and
  0x7F are the same in both games and named in code; they belong in the profile as named ids.
- **Optional content switched by data**: the commissions panel (`commissions`, PoR's quests) and the
  tile wilderness (`view.tileOverland` with the `overlandTile` battlefield and its terrain table,
  [procedures.md §15.4](procedures.md#154-battlefields)) are PoR content kept in shared modules.
- **Text**: read by address (C24 done): a new game gives its own addresses for the engine's messages
  (`strings`) and in its handler maps, title and ECL map, each found at the routine that prints it
  ([D-appendices/strings.md](../D-appendices/strings.md)); the menu words and the port's rewordings
  stay port texts (strings.md §6).

The project's step log and this list's current state are kept in
[docs/multi-game.md](../../docs/multi-game.md) ("Tracking to the goal").
