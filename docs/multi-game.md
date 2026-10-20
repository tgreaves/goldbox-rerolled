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

The standing rule (2026-10-19): nothing is hard-coded that can be read from the game's files or held
as data in its profile ([`../CLAUDE.md`](../CLAUDE.md)).

## Order of work

1. **Profiles and detection.** The profile type, PoR's profile (today's constants moved into it),
   game detection on import, game files and saves stored per game. PoR behaves exactly as before.
   *Done 2026-10-19*: `web/src/games/` (profile type, PoR and CotAB profiles, `detect()`, the active
   game). A folder is identified by its configuration file (`POOL.CFG`, `CURSE.CFG`), else by files
   only one game has; each game keeps its own databases (PoR's keep their old names, so existing
   imports and saves stay); the import screen lists every imported game. CotAB opens in the asset
   viewer until it is playable. DS and table addresses move into the profile with step 3.
2. **Record fields.** The field map and the mechanical conversion; PoR tests green.
   *Done 2026-10-19*: `web/src/games/fields.ts` (both games' maps; `test/fields.test.ts` reads CotAB's
   pre-made party through its map). About 730 accesses converted; each checked to give PoR's old offset.
   Left for later steps:
   - the script VM's view of the current character (`charRead`/`charWrite` in `vm/engine.ts`, ECL
     address → record offset) stays PoR-shaped until step 4;
   - CotAB stores base and current stats: code that changes a stat permanently (creation, Modify,
     Raise Dead's CON loss, the debug editor) writes only the current value today, and must write the
     base too (step 6);
   - spell slots are indexed `clericSlots + spellClass × slotLevels`, true for PoR's two classes; CotAB
     puts druid slots between cleric and magic-user, so step 6 maps spell class to slot array.
3. **Executable tables.** Named table lookups replace raw DS offsets; PoR tests green.
   *Done 2026-10-19*: `web/src/games/tables.ts` (`T`: the data segment and about 45 tables with their
   row sizes, for both games; `test/tables.test.ts` reads CotAB's own START.EXE through its map).
   Three values the port hard-coded (class item bits, trainer bits, sky colours) are now read from
   the tables. Tables only PoR has (overland map, NPC portrait picks, portrait records) are marked
   absent for CotAB, and the code that needs them stands down. Table *lengths* that are rules (56
   spells, 3 spell levels in the slot code, the 17 classes) and CotAB's different slot and hit-point
   models are step 6.
4. **Script VM.** Addresses, variable spaces and opcodes from the profile; CotAB's scripts run
   headless over every area and square without errors (the PoR proof, repeated).
   *Done 2026-10-19*: `web/src/games/ecl.ts`. The engine keeps PoR's addresses; a CotAB script's
   addresses are translated where operands become addresses (A, B, C and code regions each moved
   by a constant). The character view, opcode variants (DIVIDE remainder, RETURN → EXIT,
   PASS_TIME, FIND_SPELL, the code wheel, REDRAW_SCREEN, DROP_CHARACTER, FIND_EFFECT,
   DESTROY_ITEMS), IF-skip counts, CALL targets and the start block are profile data.
   `test/coabsweep.test.ts`: 2 150 runs over every CotAB area from every third square, no
   interpreter errors (31 end still waiting on town or travel menus, which the test allows). Found
   on the way: operand slots must hold 63 (CotAB has a 33-way ON_GOTO), and in two-slot
   LOAD_WALLSETS CotAB skips an operand of 0xFF while PoR loads it (both checked in the binaries,
   profile flag `twoSlotSkipsFF`). Not yet: B+0xC9 and the load-past-end flag in the character
   view, the CALL 0x6803 picture frame, CotAB's own PICTURE (BIGPIC), DAMAGE and ADD_NPC changes,
   and its random-treasure table (step 5/6).
5. **CotAB data.** Characters (.SAV/.SWG/.FX), saves (13 149 bytes), the roster, the pre-made party,
   monsters.
   *Done 2026-10-19*: `web/src/games/files.ts`: each game's item/effect/roster extensions (PoR
   .ITM/.SPC/.CHA, CotAB .SWG/.FX/.GUY; the 63- and 9-byte records are the same), save size, the
   party list's place and the wall sets (CotAB keeps them after the position, PoR in A). Saves are
   read and written in the active game's layout; exports and imports use its extensions; the
   roster import scans `*.GUY` for CotAB (no charlist). A save naming area 0 starts at area 1 with
   that script loaded, as the original's loader does (image 0x1C001), which is how the shipped
   SAVGAMA.DAT starts a game. Tested: the shipped save with the pre-made party (and TRAVIS's
   three racial effects from his .FX) loads, starts and saves back at 13 149 bytes. Monster records
   already load through the field map (the sweep loads them). Not yet: seeding `*.GUY` roster files
   from the game folder (only the pre-made CHRDAT files are), and CotAB stays view-only until its
   rules (step 6).
6. **CotAB rules.** Spells (100, five levels), slots, levels and caps, hit points, classes, temple Heal.
   *Done 2026-10-19* (6a–6e), in `web/src/games/rules.ts` and tested against CotAB's START.EXE:
   spell counts, levels and class codes (0 cleric, 1 druid, 2 magic-user, 3 item); slots looked up
   by spell class; the slot model (PoR absolute tables, CotAB summed increments with paladin rows
   from level 9 and ranger rows from level 8, rangers knowing every druid spell); extra attacks
   (paladin > 6, ranger > 7); the hit-point model (best of two, fixed from DS:3EBB, the replace
   quirk); demi-human level limits as data (CotAB's elf/half-elf magic-users and half-elf rangers);
   300 platinum to start; base abilities kept with the current ones; the temple's services and
   diseases read from START.EXE, with CotAB's Heal as its code does it. Classes and alignments
   offered come from the tables, so paladins and rangers are offered in CotAB. Not yet: the paladin
   and ranger party checks in the Add menu, thief-skill item hooks, CotAB's DAMAGE flag 0x10 and
   random-treasure table, the casting level of druid spells (ranger level assumed, I).
   **Hard-coded audit (2026-10-19)**, applying the data-driven rule. Now read from START.EXE: race,
   class, alignment, status (with Gone, which the port's list lacked), gender and coin names, and the
   coin values (PoR DS:0D24, CotAB DS:0CA4). Now profile data, because each is code rather than a
   table in both binaries: the race menu, the multi-class components, age columns and cleric
   multi-classes, the training fee, a new magic-user's spells, the CHA reaction values the scripts
   read (B + 0x2CF). Per game: the printed journal (PoR's; CotAB none yet, so its Journal entry is
   hidden) and the one-line spell notes (CotAB has PoR's for spells 1–56). The PoR sky colours used
   without START.EXE are gone. Checked and left in code: the gem values (code in both games). Still
   PoR content in shared code, for step 7: the Rules reference text, the City Council commissions,
   the ending, the title sequence, and messages written into the port.
   **Effects (2026-10-20)**: each game's event lists, and for CotAB a behaviour per changed effect
   type (`games/effectrules.ts` `handlers`, `rules/coabeffects.ts`), the monster-class flags (+0x14B),
   the new events 20–22, the current-stat routine on removal, and readied items by CotAB's item kinds
   (Gauntlets of Ogre Power, girdles, Ring of Wizardry, Gloves of Thievery…). Not yet: event 14 (monster
   specials, unfired in PoR too) and the area breaths and eye rays (spec/coab/effects.md, "Port status").
7. **CotAB presentation.** Sky and ground in the 3D view, the BIGPIC overland, title, code wheel.
   *Done 2026-10-19* (7a–7c), profile data in `games/view.ts`, `title.ts`, `sound.ts`: the floor
   colour and the cobbled ground (SKY #252) tiled on the WebGL floor (IMP-069); BIGPIC pictures from
   0x78 at their own 304 × 120 shape, and the overland map with the blinking city cursor read from
   DS:0A4A/0A6A; the title sequence and credits as a per-game script (TITLE #2 with the #3 and #4
   logos, no lightning, CURSE.CFG line 4); the sound driver at its own segment with the −0xBD shift
   (its effects render as PoR's where the data match), and CotAB's CALL sound mapping. PoR-only
   panels follow the profile: the journal and the commissions are hidden for CotAB. CotAB is now
   playable, marked early. Not yet: the sun and clouds, the code wheel (skipped, IMP-068), the
   Rules reference text and the ending for CotAB; nothing has been played through in a browser yet.
8. **Importing PoR characters**, by the game's own "Pool" import (spec/coab/records.md), with its
   STR bug fixed and logged.

Each step is committed separately with PoR's tests passing, so PoR stays playable throughout.
