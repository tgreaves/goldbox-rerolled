# One engine for every Gold Box game

GoldBox Rerolled began as Pool of Radiance (PoR). Curse of the Azure Bonds (CotAB) is next, and the
aim is the whole series with each game's own rules respected. This note sets out how the code is
organised for that. The research behind it: [CotAB spec](../spec/coab/README.md).

## What changes between games

From the CotAB research (2026-10-19), most of the engine is shared; what differs falls into a few
kinds:

| Kind | PoR → CotAB example | Where it lives |
|---|---|---|
| Record layouts | character record 285 → 422 bytes, fields moved, memorised spells 21 → 84 slots, known spells 56 → 100 | data |
| Executable tables | every rules table at a new DS address; THAC0 rows 11 → 13 bytes, XP rows 0x38 → 0x63 | data |
| Rule values | level caps 6/8/6/9 → 10/12/11/12, paladins and rangers, spell class codes, 5 spell levels | data |
| Rule procedures | hit points (dice only at level 1, best of two rolls, fixed HP past the cap), spell slots (cumulative per level), starting money (300 pp) | code, chosen per game |
| Script VM | code at 0x9900 → 0x8000, variable spaces moved, opcodes 0x3E–0x40 new, a dozen changed, CALL targets renumbered | data + small handlers |
| Files and presentation | SKY ground and sky in the 3D view, overland as a BIGPIC map instead of tiles, title sequence, code wheel, save files (.SWG items, .FX effects, *.guy roster) | data + per-game modules |

## The game profile

A **profile** describes one game. Exactly one is active (the game whose files were imported), set
once at start-up; the rest of the code asks the profile instead of assuming PoR.

```
profile
  id, name, config file (POOL.CFG / CURSE.CFG), detection (file set, START.EXE signature)
  fields      character record: size, and the offset (and length) of every named field
  tables      DS base and the address + stride of every executable table, by name
  rules       level caps, classes and races allowed, spell class codes, spell levels, slot model,
              hit-point model, starting money, … (values, plus a handful of per-game functions)
  ecl         code base, variable spaces, B-view field map, opcode table (shared handlers + per-game
              variants), CALL targets, engine registers
  files       DAX families present, overland kind (PoR tiles / CotAB map), sky, title sequence,
              save-file layout and extensions
```

## Records stay native

Characters are kept in memory in their own game's byte layout, exactly as the files hold them, and
code reaches fields through the profile's field map: `c[0x11b]` becomes `c[F.hp]`, where `F` is the
active profile's field table. So:

- saves and imports stay byte-for-byte compatible with the original without converting back and
  forth (the property the PoR saves already have, now for every game);
- a field that moved is one entry in a table, not a code change;
- arrays that grew (memorised spells, known spells) take their length from the profile; the few
  loops over them go through the existing helpers (`memorised()`, `knows()`).

Converting the ~1 050 raw offsets is mechanical: each PoR offset in use is mapped to a field name
once (the record maps in spec/records.md and spec/coab/records.md), then replaced. PoR's tests must
pass unchanged after it, which proves nothing moved for PoR.

Items keep their 63-byte record in both games, and effects their 9-byte one, so those stay as they
are until a later game changes them.

## Rules as data first

Where a game differs only in numbers (caps, tables, costs) the profile holds the numbers. Where the
procedure differs (CotAB's hit-point rule, slot model), the profile names which procedure, and both
live side by side in `rules/`, each with the routine address it follows. A game is never a branch
deep inside shared code (`if (coab) …`); it is a choice made in the profile.

## Order of work

1. **Profiles and detection.** The profile type, PoR's profile (today's constants moved into it),
   game detection on import, game files and saves stored per game. PoR behaves exactly as before.
   *Done 2026-10-19*: `web/src/games/` (profile type, PoR and CotAB profiles, `detect()`, the active
   game). A folder is identified by its configuration file (`POOL.CFG`, `CURSE.CFG`), else by files
   only one game has; each game keeps its own databases (PoR's keep their old names, so existing
   imports and saves stay); the import screen lists every imported game. CotAB opens in the asset
   viewer until it is playable. DS and table addresses move into the profile with step 3.
2. **Record fields.** The field map and the mechanical conversion; PoR tests green.
3. **Executable tables.** Named table lookups replace raw DS offsets; PoR tests green.
4. **Script VM.** Addresses, variable spaces and opcodes from the profile; CotAB's scripts run
   headless over every area and square without errors (the PoR proof, repeated).
5. **CotAB data.** Characters (.SAV/.SWG/.FX), saves (13 149 bytes), the roster, the pre-made party,
   monsters.
6. **CotAB rules.** Spells (100, five levels), slots, levels and caps, hit points, classes, temple Heal.
7. **CotAB presentation.** Sky and ground in the 3D view, the BIGPIC overland, title, code wheel.
8. **Importing PoR characters**, by the game's own "Pool" import (spec/coab/records.md), with its
   STR bug fixed and logged.

Each step is committed separately with PoR's tests passing, so PoR stays playable throughout.
