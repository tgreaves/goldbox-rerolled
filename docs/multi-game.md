# One engine for every Gold Box game

GoldBox Rerolled began as Pool of Radiance (PoR). Curse of the Azure Bonds (CotAB) is next, and the
aim is the whole series with each game's own rules respected. This note sets out how the code is
organised for that. The research behind it: the engine as PoR defines it in
[`spec/A-games/engine/`](../spec/README.md#part-a-the-original-games), CotAB as differences in
[`spec/A-games/coab/`](../spec/A-games/coab/README.md).

The design sections below ("The game profile", "Records stay native", "Rules as data first", "Where a
game is described", "Adding a game") are being moved into the specification's part B, the engine
model ([`spec/B-model/`](../spec/README.md#part-b-the-engine-model-b-model)), which will be normative;
until then they stay here. The step log, "Tracking to the goal" and the backlog are project status and
stay in this note.

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
once (the record maps in spec/A-games/engine/records.md and spec/A-games/coab/records.md), then replaced. PoR's tests must
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

## Where a game is described (the configuration)

Everything that differs between games lives in **`web/src/games/`**, one module per concern, each
exporting one value per game (`POR_…`, `COAB_…`). `por.ts` and `coab.ts` assemble them into the game's
**profile** (`GameProfile`, `types.ts`); `profile.ts` lists the games, detects which one a folder is
and makes one active (`setGame`), switching the live objects the rest of the code reads.

| Module | What it holds | Read as |
|---|---|---|
| `profile.ts`, `types.ts` | the game list, detection (config file, marker files), the active game | `game()` |
| `fields.ts` | the character record: size and the offset of every named field | `F.hp`, `F.levels + k` |
| `tables.ts` | START.EXE tables: data segment, address and row size of each (rules, names, frames, temple …) | `T.thac0.at` |
| `ecl.ts` | the script VM: memory regions, character view, opcode variants, CALL targets, start area | `game().ecl` |
| `files.ts` | character and save files: extensions, save size, where the party list and wall sets are | `game().saves` |
| `rules.ts` | rules values and procedure choices: spells, slots, hit points, caster level, thief skills, level limits, money, temple, joining, creation effects, paladin abilities, when a battle is fought on a wilderness field and how that field is built (`wildBattle`, `wildField`: the passes in order with their numbers), casting in combat (`casting`) | `R` |
| `spellrules.ts` | spell handlers: every spell id's handler kind and parameters (as the original's handler table), the duration special cases | `game().spells` |
| `landmarkrules.ts` | what the area map's landmarks look for in the script text (shopkeepers' lines, the temple's god, named places) | `game().landmarks` |
| `effectrules.ts` | the effect system: event lists in the original's order, area effects, per-type handler map, item kinds | `game().effects` |
| `treasure.ts` | random treasure: the type choice (nested dice bands), plus roll, scrolls, magic records | `game().treasure` |
| `view.ts` | the 3D view and screens: the drawn view's bands and closed-edge areas, floor and ground, BIGPIC, overland kind, frames, sun and clouds | `game().view` |
| `title.ts`, `ending.ts`, `sound.ts` | title script and credits; ending script (captions read from GAME.OVR); sound driver location | `game().title` … |
| `startup.ts` | the menu after the title (its title and choices read from START.EXE by offset, the timeouts in hundredths of a second and the key they answer) and the demo it runs: block, record, game speed and the demo mode's flags (key reads that never wait, no "Continue Battle:", no battle aftermath); `null` for a game without one (PoR) | `game().startMenu` |
| `rulestext.ts`, `spellnotes.ts`, `journal.ts` | text written for the port: Rules reference, spell notes, the printed journal | `game().rulesText` … |
| `imports.ts` | characters taken from another game (CotAB's "Pool" import) | `game().imports` |

The profile is applied once at start-up and whenever the player switches game (the ⇄ Games button).
Values come first from the player's own files (START.EXE tables through `T`, DAX records, GAME.OVR
strings); what is code rather than a table in the original is profile data; only where a game's
*procedure* differs does the profile name one of several implementations in `rules/`.

## Adding a game

The engine is meant for **every** Gold Box game, not only these two (Tristan, 2026-10-20). So:
- a game is a set of profile modules in `web/src/games/` (one value per module) plus its entry in
  `GAMES`; nothing in shared code names a game, and a game's id is only a label;
- procedures are named by **what they do** (an ECL opcode variant, an effect behaviour, a spell
  handler kind, a slot source), never by the game that first needed them, so a later game picks from
  the same vocabulary and adds only what is new;
- per-game choices are parameters of those procedures, kept in the profile;
- the values come from the game's own files wherever they are there (START.EXE tables, DAX records,
  GAME.OVR strings), found by the same research method (CLAUDE.md, "Method for a new game").

Procedure keys follow that rule (2026-10-20): every effect type and every item handler (+0x3E & 0x7F)
names a behaviour with its parameters in the game's profile (`games/effectrules.ts` `handlers`,
`items`; the behaviours in `rules/effectkinds.ts`), and the bolt routines are one procedure whose
differences are flags (`R.bolt`).

## Tracking to the goal (assessed 2026-10-20)

The goal (Tristan, 2026-10-20): **one engine for every Gold Box game, fully data-driven, with no
hard-coded alternative paths.** Where things stand:

**Done as data.** Record layouts, START.EXE tables, the script VM's memory map and opcode variants,
save layouts, rules values (spells, caps, limits, money, temple, joining, creation effects), effect
event lists, random treasure, title, start-up menu and demo, ending, view dressing, sound driver, character import, and the
names of races, classes, alignments, statuses and coins. Game text (2026-10-21, C24): the engine's
messages (`strings`), the effect and spell lines, the monster-name lists, the camp Display names, the
credits and the wipe banner are addresses into the player's merged START.EXE + GAME.OVR, each the copy
its routine prints (`spec/D-appendices/strings.md`); the menus too (`menus`, split by the original's
rule, the code acting on the hot keys); only the port's rewordings and its own words are port text.
The camp's Fix is one procedure with its cures as data (`R.fix`, CotAB's 0x320D8, PoR the same with
its one cure, IMP-048). Nothing branches on the game's id in shared code (checked by grep).

**Procedure choices, named in the profile.** These are allowed by the design but are the places to
watch, because each is an alternative path in code:
- ~~`R.slotModel`, `R.hpModel`, `R.startMoney`~~: done 2026-10-20, each is now one parametric
  procedure with per-game data (`R.slots`: slot sources set or added from a start level into pools;
  `R.hitPoints`: dice after level 1, rolls kept best, level-1 minimum, fixed amounts from the stop
  level; `R.startMoney`: a coin and a fixed amount or the dice).
- ~~`game().effects.handlers` and `items`~~: done 2026-10-20. Each game's map is complete for the
  types of its original's handler table (PoR FUN_5216_0000 1–127, CotAB DS:6FC0 1–146), and
  `test/effectmap.test.ts` checks that every effect type its events, spells, monsters, characters and
  items can add names an existing behaviour. PoR's ~120-case switch is gone: its handlers are
  behaviours named by what they do (`rollMorale`, `resist`, `poisonOnHit`, `paralyseOnHit`,
  `drainOnHit`, `regenerate`, `blocks`, `immunities`, `stoneGaze`, `vulnerableTo`…), the switch's
  values (effect types, monster names, item types and words, dice, damage types, percentages, the
  spell Shield stops) their parameters; CotAB's map starts from PoR's entries and overrides its
  changed types, so the same handlers name the same entries. Where both games' procedures are one
  (end the turn, no movement, damage on a hit, blocked effects, a cloud zone lifting) they share a
  behaviour. A behaviour that waits (an attack, a removal, an effect added through its event) is
  async; that replaces the list of PoR types that waited. The item handlers are a map by +0x3E &
  0x7F in both games (PoR's 128–139, CotAB's kinds).
- ~~`ending.por`~~: done 2026-10-22, PoR's ending is steps like CotAB's (pictures `at` a position, `fromParty`, `loops`).
- `R.wildField` (2026-10-20): one wilderness driver (fill, then the passes the profile lists with their
  numbers; the flag arithmetic `FlagValue` and the river's course are shared data). The passes are
  named by what they do: one `river` for both games (PoR FUN_34c7_0bde, CotAB 0x25690: the cells, the
  ford's cells, fords in pairs, the crossing and the edge as data), CotAB's `treesOrLogs`, `scatterOdds`
  (0x2579B, 0x25ADA; no finishing pass) and PoR's `treesBySize`, `scatterTerrain`, `finishing`; both
  games' fields are tested against transcriptions of the originals.
- `R.mapField` (2026-10-20): one map-area generator (PoR FUN_34c7_0810, CotAB 0x2555D, the same
  squares → cells procedure): the one corner cell that differs, the finishing pass (PoR) and the room
  furnishing (CotAB 0x24D63: flag, cells, dice; the chair offsets from START.EXE, `T.furnishDx/Dy`) are
  profile data.
- `R.casting` (2026-10-21): casting in combat, one procedure for both games (PoR FUN_3aae_2414 /
  FUN_4e53_0c20, CotAB 0x2CCBD / 0x45251): whose list loses a spell interrupted by damage (PoR the
  current character, its bug; CotAB the caster), CotAB's miscast (effect 0x4A, 1d2) and the first
  memorised slot the computer reads (CotAB 1). Cure Light Wounds' patient test is the spell map's
  `aiTarget`, no longer a spell id in `aiCast`.
- Optional content modules switched by data: the PoR commissions panel, the tile wilderness.

**Still hard-coded game knowledge in shared code (the gaps).**
1. ~~Spell handlers keyed by PoR's spell ids~~: done 2026-10-20. Each game lists a handler kind and
   its parameters for every spell id (`games/spellrules.ts`, from the original's table: PoR DS:6B84,
   CotAB DS:72BA). The kinds are named by what they do: `apply`, `damage`, `heal`, `hold`, `sleep`,
   `cloud`, `bolt` and others in the battle (`rules/combat.ts`), the rest shared with the camp
   (`rules/spellkinds.ts`); durations are data too. CotAB's 58 and 66–100 no longer run PoR's
   handlers. CotAB's changed and new handlers are transcribed (2026-10-20) as parameters on the
   shared kinds or as new kinds named by what they do (`curePoison`, `raise`, `slay`, `applyProbe`,
   `saveEach`, `teleport`, `scare`, `flameShield`, `saveOrElse`, `beam`; the Hold loop's `lastSaves`
   and `runAfter`, the target picker's `pool`, the clouds' squares from START.EXE, Dispel Magic's
   `zones`), with the cloud occupant check one procedure on `R.clouds`. What is inferred is listed in
   spec/A-games/coab/spells.md (port status). The effect handlers' tests of spell 15 (Shield 17, type 91) are
   a parameter of their behaviours (`spell`).
2. ~~Effect type numbers named in shared code~~: done 2026-10-22. The handlers' own types were
   parameters already (2026-10-20); the types the shared procedures add, test or remove are now
   named in the profile, `game().effects.ids` (`games/effectrules.ts`): the temple's cures, Raise
   Dead, Cure Disease's groups, Slow Poison, the gas cloud's 0x1E/0x1F, haste and slow, invisibility,
   Read Magic and Detect Magic, the helpless and going-down lists, the gazer's reflection, the STR
   records and the current-stat routine's types (null for PoR, which has no such routine); the AI's
   gas probe is `R.clouds.gas.probe`. `test/effectmap.test.ts` checks every id is a type of its game's
   table. CotAB's lists read in its binary (2026-10-22): `goingDown` is its own (0x4C05B, with the
   berserk NPC's return, `downRejoins`), `helpless` and `noOpportunity` are PoR's (0x4DC2B, 0x2B08D);
   the AI's cloud probe is `R.clouds` `probe` data (CotAB 0x237FB: two more exemptions, turned undead,
   a save on gas, and a kill-cloud probe PoR lacks).
3. ~~Functions inside profiles~~: done 2026-10-20 (the character view's reads are declarative entries,
   the kept files a list of patterns); profiles now hold only data.
4. ~~Procedure keys named after games~~: done 2026-10-20 (the item handlers as a map, `R.bolt` flags,
   the stat routine runs for the types the profile lists).

**Plan, in order:** ~~CotAB's changed and new spell handlers as kinds~~ (done); ~~PoR's effect handler map made
explicit~~ (done); ~~PoR's effect handlers checked against the binary~~ (done, spec/A-games/engine/effects.md "Port
status"); ~~profile functions replaced by data~~ (done); the paired procedures made parametric where
the originals allow it (~~the PoR ending procedure~~, done); ~~named ids for effect types~~ (done 2026-10-22). When those are done, a third game should
need only its profile modules and any procedure the earlier games do not have.

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
   and its random-treasure table (step 5/6). *Since done* (checked 2026-10-21): B+0xC9 and the load-past-end
   flag (`COAB_ECL.viewReads`, `loadPastEnd`), CALL 0x6803 (`calls.frame`), BIGPIC pictures, DAMAGE's
   flag (`ecl.damageDespiteSave`), the random-treasure table (`COAB_TREASURE`), ADD_NPC (`ecl.addNpc`,
  2026-10-21: CotAB's draws nothing, has no enemy-side id and shows the NPC's CPIC picture).
  Battlefield movement costs (`R.battleMove`, 2026-10-21): a step costs the cell's move byte × 3
  diagonally, × 2 straight in both games; what is tested against the movement left and what a short
  step does are profile data.
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
   random-treasure table, the casting level of druid spells (ranger level assumed, I). *Since done*: the
   paladin and ranger Add checks (`R.join`, `rules/joining.ts`), DAMAGE's flag 0x10 and the treasure table.
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
   type (`games/effectrules.ts` `handlers`, `rules/effectkinds.ts`), the monster-class flags (+0x14B),
   the new events 20–22, the current-stat routine on removal, and readied items by CotAB's item kinds
   (Gauntlets of Ogre Power, girdles, Ring of Wizardry, Gloves of Thievery…). Not yet: event 14 (monster
   specials, unfired in PoR too) and the area breaths and eye rays (spec/A-games/coab/effects.md, "Port status").
   *Since done*: event 14's specials, the area breaths and the eye rays (`rules/specials.ts`).
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
   *Since done*: the sun and clouds (`COAB_VIEW.skyArt`), the Rules reference (`COAB_RULES_TEXT`) and
   the ending (`COAB_ENDING`); the code wheel stays skipped (IMP-068).
8. **Importing PoR characters**, by the game's own "Pool" import (spec/A-games/coab/records.md), with its
   STR bug fixed and logged.
   *Done 2026-10-20*: `games/imports.ts` holds the conversion as data (fields copied by name through
   both games' maps, stats clamped to CotAB's race limits, 300 platinum, no items, Animate Dead
   forgotten, seven effect types kept when the effect file is found by the name's stem); `rules/
   import.ts` runs it and then the class bonuses. The party screen's Import takes PoR roster `.CHA`
   files and save-slot `CHRDAT??.SAV` characters when CotAB is the game. The STR bug is fixed (IMP-070).

**Start-up menu and demo (2026-10-20).** `games/startup.ts`: a game with a menu after the title
(CotAB's "Curse of the Azure Bonds v1.3" / Play / Demo, read from START.EXE) shows it; Play goes to
the party screen as before, the demo key runs the demo: `Engine.newDemo` (block, record and speed
from the profile, no party) and `Engine.runDemo` (the record's on_enter, then the party disbanded),
in the explore screen with nothing saved. Since 2026-10-21 the port offers it as **Watch the demo** on
the party screen instead of the original's menu after the title (IMP-074); the menu's text and
timeouts stay in the profile as the original's data. The demo mode's behaviours are flags read by the procedures
they change (key reads, "Continue Battle:", the battle aftermath), so a later game's demo is its
profile entry. PoR's `startMenu` is null and its start-up is unchanged. spec/A-games/coab/ecl.md, "Start-up
menu and demo"; tests `test/demo.test.ts`.

**Play-testing (2026-10-20).** A headless player (`web/test/playtest.ts`, one module, the game a
parameter; `coabplay.test.ts` and `porplay.test.ts` run it, 4 seeds × 250 steps by default,
`COAB_PLAY_SEEDS`/`COAB_PLAY_STEPS` and `POR_PLAY_…` for longer runs, `…_TRACE=1` for the whole game).
From the shipped `SAVGAMA.DAT` and pre-made party, as the app loads them, it plays by seeded random
choices: moves and turns through `Engine.command` (towards the squares it has visited least),
Search, Look, Encamp, wilderness travel; random answers to script menus, numbers and text (rarely
dropping a member); every screen the engine hands over runs its rules code: battles through `fight`
with the party on Quick or a member's commands chosen at random (aim, cast, use, move), shops,
temples and treasure through `ui/town.ts`, camp through `ui/camp.ts`, the training hall's Train;
items readied and put away; a hurt party camps to heal; saves (the game's writer) loaded back, and
after a lost battle the last save loaded again. Every other seed starts with a debug jump to a
random area (that party has its next level's experience and the training fee), and every fourth
as the app's New Game with the pre-made party. After each step: no exception; no script looping without asking; HP within max,
statuses, in-play and side bytes valid, no NaN, undefined or fraction written into a party record
or an ECL variable (the records are watched), item and effect lists sane, money whole and not
negative, the party in an area with a script and on the map; no text with `undefined`/`NaN`; a save
loads and saves back the same; a battle ends within 400 rounds (a stalemate, both sides on computer
control unable to reach each other: nobody standing hurt for 30 rounds, is called off and listed,
not failed; so is WALLDEF5 #25 after a jump into Valjevo past the area that sets 0x49E7/0x49E8, as
in the script sweep). Found and fixed:
healing an unconscious character left it out of play (both games); CotAB items cast PoR-shifted
spell ids; the debug jump took CotAB's areas 25–27 for PoR's wilderness; grab and blood drain
(PoR 74, 75) called their own removal for ever. Found, not changed: in large map-area battles
(New Phlan's city watch, the Tilverton kennel) monsters placed in the neighbouring squares can be
walled off from the party, and with everyone on Quick nobody reaches anybody: the placement's scan is now
the original's (2026-10-22: the ring wall check from the side's own square, rows 0–5, the next ring at once
for a candidate outside both ways, the first line's limit and the second-line skip, spec/A-games/engine/combat-rules.md
"Placement"); one stalemate at New Phlan (15,10) remains in an 8 × 1000 run, so its cause is elsewhere. Not covered: rendering, the DOM panels (the
treasure split, Buy, Memorize), the town and overland menus beyond random play, anything past
where random play gets (CotAB: Tilverton and the jumped-to areas).

## Backlog

- ~~CotAB dual-classing~~: done 2026-10-21 ("Human Change Classes" 0x5135D in the training hall's
  party screen, `rules/dualclass.ts`, `R.dualClass`; the recalculation's CotAB parts as `R.recalc`:
  the item class mask again and no attack reset; spec/B-model/procedures.md §7.1, §7.2,
  spec/A-games/coab/chargen-and-progression.md).

- ~~The computer's item use in combat~~: done 2026-10-21 (PoR `FUN_3334_03e4`, CotAB 0x2356A,
  `Battle.aiUseItem`, `R.casting.aiItemSpell`; spec/B-model/procedures.md §15.1).

- ~~CotAB journal~~: done 2026-10-20, from the Gold Box Wiki's transcription (source from Tristan):
  entries 1–59, tavern tales 1–62 and the four background notes (`data/coab-journal.json`, built by
  `tools/coab/journal_coab.py`); CotAB has no proclamations. Eight entries are only a picture in
  the printed journal and say so.
- ~~CotAB add-effect rule~~: done 2026-10-20 (`effects.replaces`).

Each step is committed separately with PoR's tests passing, so PoR stays playable throughout.
