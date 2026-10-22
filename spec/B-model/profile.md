# The game profile

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

A **game profile** (`GameProfile`) describes one Gold Box game to the shared engine. Everything that
differs between games is in it: the record layout, the tables, the script VM's map, the rules values
and which procedure each rule uses, the presentation, the files. This file defines every top-level
field and the modules that have no file of their own; the large modules each have one
([records-and-tables.md](records-and-tables.md), [script-vm-map.md](script-vm-map.md),
[procedures.md](procedures.md), [vocabularies.md](vocabularies.md),
[files-and-detection.md](files-and-detection.md)).

## 1. Rules of the model

1. **One engine, many profiles.** Exactly one profile is active at a time: the game whose files were
   opened. Shared code asks the active profile; it MUST NOT branch on the game (`if (game is …)`), and
   a game's `id` is only a label.
2. **Data first.** A difference between games is, in order of preference: a value read from the
   game's own files (START.EXE tables through the table map, DAX records, GAME.OVR strings); a value
   held in the profile; or, only where the original's *procedure* differs, a named procedure the
   profile selects or parameterises ([procedures.md](procedures.md), [vocabularies.md](vocabularies.md)).
3. **Profiles are data.** A profile holds numbers, strings, lists, maps and text patterns (regular
   expressions), never functions. A procedure is named by what it does, never by the game that
   first needed it, so a later game picks from the same vocabulary and adds only what is new.
4. **Every field is filled.** There are no defaults inherited from another game; a profile may be
   built by copying another's values and changing some (CotAB's maps start from PoR's), but the
   result lists every entry.

### 1.1 Where a value comes from

Every value in this part is one of three kinds, marked in the tables:

| Mark | Kind | Normative part |
|---|---|---|
| **F** | read at run time from the player's files | the address and reading rule; the value itself is informative (D5) and may be dumped in [D-appendices/expected-values.md](../D-appendices/expected-values.md) |
| **C** | a value of the original's **code** (an immediate, a branch, a handler table) that the profile holds because the port does not read it from the executable | the value, with the routine that shows it (**O** unless marked) |
| **P** | written for the port (not in the original) | the value, stated in this part or in [D-appendices/port-data.md](../D-appendices/port-data.md) |

Game **text** is never a C or P value: a message, name or caption that is in the game's files is read
from them by address (D1, [D-appendices/strings.md](../D-appendices/strings.md)); the profile holds the
address (C), the text is F. A message, name or caption in the profile data (effect and spell lines,
monster names, credits, the camp Display names, the wipe banner) is likewise an address
([strings.md §5](../D-appendices/strings.md#5-texts-in-the-profile-data)).

### 1.2 Activation

Making a profile active (`setGame`) switches, in this order, the live field map `F`, table map `T`,
rules `R` and journal the rest of the code reads, then records the game as the last one played
([C-port/storage.md](../C-port/storage.md)). Nothing else holds per-game state: a module that needs a
profile value reads it from the active profile when it runs.

## 2. Top-level fields

| Field | Type | Meaning | Kind | PoR | CotAB |
|---|---|---|---|---|---|
| `id` | string | a short label; nothing tests it | P | `por` | `coab` |
| `name` | string | the game's name, shown to the player | P | Pool of Radiance | Curse of the Azure Bonds |
| `folder` | string | the game's folder in the GOG release, named in the import help | P | `POOLRAD` | `CURSE` |
| `config` | file name | the game's own configuration file, which identifies it | F | `POOL.CFG` | `CURSE.CFG` |
| `markers` | file names | files only this game has, used when the configuration file is missing | F | `GEO1.DAX`, `SQRPACI.DAX`, `BACPAC.DAX` | `SKY.DAX`, `BIGPIC1.DAX`, `TILES.DAX` |
| `required` | file names | the minimum set for the port to start | P | [files-and-detection.md §2](files-and-detection.md#2-required-and-kept-files) | same |
| `keep` | patterns | the files the port keeps from an imported folder | P | [files-and-detection.md §2](files-and-detection.md#2-required-and-kept-files) | same |
| `stores` | `{ files, user }` | the names of the game's two browser databases | P | `poolrad`, `poolrad-user` | `goldbox-coab`, `goldbox-coab-user` |
| `imageFamilies` | DAX family names | the asset viewer's families, in order | P | [files-and-detection.md §4](files-and-detection.md#4-the-asset-viewers-families) | same |
| `fields` | `CharFields` | the character record layout | C | [records-and-tables.md §2](records-and-tables.md#2-the-field-map-charfields) | same |
| `tables` | `TableMap` | the START.EXE tables | F (addresses C) | [records-and-tables.md §3](records-and-tables.md#3-the-table-map-tablemap) | same |
| `ecl` | `EclMap` | the script VM's map and variants | C | [script-vm-map.md](script-vm-map.md) | same |
| `saves` | `SaveFiles` | character and save files | C | [records-and-tables.md §4](records-and-tables.md#4-save-files-savefiles) | same |
| `rules` | `GameRules` | rules values and procedure choices | C | [procedures.md](procedures.md) | same |
| `spells` | `SpellRules` | each spell id's handler kind and parameters, durations, the STR rule | C | [vocabularies.md §4](vocabularies.md#4-spell-kinds) | same |
| `effects` | `EffectRules` | event lists, area effects, the effect and item handler maps, the add and heal rules | C | [vocabularies.md §2](vocabularies.md#2-the-effect-system-effectrules) | same |
| `treasure` | `TreasureRules` | random treasure | C | [procedures.md §14](procedures.md#14-random-treasure) | same |
| `view` | `ViewArt` | the 3D view's dressing, pictures, overland kind, frames, sky art | C, P | §3.1 | §3.1 |
| `title` | `TitleScript` | the title sequence and credits | C | §3.2 | §3.2 |
| `startMenu` | `StartMenu` or null | the menu after the title and the demo it runs | C | null | §3.3 |
| `sound` | `SoundDriver` | where the sound driver sits in START.EXE, whether it cuts effects off | C | §3.4 | §3.4 |
| `strings` | id → image address | the engine's messages: the address of each string the shared procedures print | F (addresses C) | [D-appendices/strings.md §4](../D-appendices/strings.md#4-engine-messages) | same |
| `menus` | id → image address | the original's menus: the address of each menu string (or piece of one) the menus show, split by the original's rule | F (addresses C) | [D-appendices/strings.md §4.1](../D-appendices/strings.md#41-menus) | same |
| `ending` | `EndingScript` | the ending (PROGRAM 8) | C | §3.5 | §3.5 |
| `imports` | `CharacterImport[]` | characters this game takes from other games | C | none | [procedures.md §13](procedures.md#13-character-import) |
| `commissions` | boolean | shows the commissions panel (PoR's City Council quests, read from its script variables) | P | true | false |
| `journal` | `JournalData` or null | the printed journal the scripts refer to (PoR, CotAB, SotSB) | P | [D-appendices/port-data.md §4](../D-appendices/port-data.md#4-the-journal) | same |
| `spellNotes` | id → string | one-line spell notes | P | [D-appendices/port-data.md §1](../D-appendices/port-data.md#1-spell-notes) | same |
| `rulesText` | `RulesText` | the Rules reference's text | P | [D-appendices/port-data.md §2](../D-appendices/port-data.md#2-rules-reference) | same |
| `landmarks` | `LandmarkRules` | what the area map's landmarks look for in script text | P | [D-appendices/port-data.md §3](../D-appendices/port-data.md#3-landmark-patterns) | same |
| `debug` | `DebugTools` | the Debug panel's jumps and finale | P | [D-appendices/port-data.md §6](../D-appendices/port-data.md#6-debug-jumps-and-finale) | same |
| `playable` | boolean | false while the port can show the game's assets but not play it | P | true | true |
| `note` | string or null | a word on how far along the game is, shown when choosing it | P | null | "early: being built, expect gaps" |

The profile is assembled from one value per module per game; the order of the fields does not
matter.

## 3. Presentation modules

### 3.1 The view (`ViewArt`)

What the 3D view and the screens take from the game's own pictures and colours. The drawn view
itself is part A ([engine/maps-and-view.md](../A-games/engine/maps-and-view.md)) and part C
([C-port/exploration-view.md §2](../C-port/exploration-view.md#2-the-drawn-view-normative)); the port's
WebGL view is part C ([§3](../C-port/exploration-view.md#3-the-webgl-view-optional)).

| Field | Meaning | Kind | PoR | CotAB |
|---|---|---|---|---|
| `bands` | the drawn view's background: view rows (inclusive) and a colour, `sky`, `line`, `band`, `floor` (the backdrop's) or a fixed EGA colour, top to bottom | C | 0–42 sky, 43 line, 44–45 band, 46–87 floor (`FUN_55a0_0174`) | 0–43 sky, 44–45 colour 0, 46–87 floor (0x53824, EGA: `DS:7226` is never written) |
| `closedEdges` | areas where the view's wall lookup finds no wall outside the map (elsewhere it wraps by one map) | C | 0, 10 (`DS:84DC`, `FUN_55a0_047b`) | 0, 10 (`DS:8B78`, 0x53D42) |
| `floor` | EGA colour of the floor, in place of the one the floor register (0xC059) gives; null: the register decides (0x0B → 8, 6 → 1, else 6) | C | null | 8 ([coab/assets.md §3](../A-games/coab/assets.md#3-3d-view)) |
| `ground` | a ground picture: DAX family and record, `at` (the view pixel where the drawn view puts it, after the sky pictures, before the walls) and `mask` (the colour left undrawn); for the WebGL floor the picture rows used and how often they repeat along one square; null: none | C (file, record, at, mask), P (rows, repeat) | null | SKY #252 at (0, 40), mask 13; rows 32–48, repeat 2 |
| `bigFrom` | script picture ids from this one are full-width `BIGPIC<block>` records; null: none | C | null | 0x78 |
| `overlandPicture` | the BIGPIC that is the overland map, shown with the city cursor (`T.cursorX/Y` by place, canonical ECL 0x4AA1); null: none | C | null | 0x79 |
| `tileOverland` | areas that are the tile wilderness ([engine/overland.md](../A-games/engine/overland.md)) | C | 25, 26, 27 | none |
| `frame` | window and screen frames from `8X8D1` #202: fixed rope tiles `{ corner, vertical, horizontal }`, the frame tables (`T.frameTop` …) whose values count from tile `tile0`, or bars `{ horizontal, vertical, below, above }` (whole rows of `horizontal` at the top, bottom and dividers, columns of `vertical` with `below` under a row and `above` over one: SotSB 55, 53, 52, 54, 0x19D0 and 0x1A90), drawn with colour `mask` left undrawn | C | rope: corner 20, vertical 21, horizontal 22 (frame style 0 of `FUN_13f1_0000`) | tables: tile0 30, mask 13 (0x1330: tile 0x11E + value in bank 4, which starts at 0x100) |
| `skyArt` | pictures in the sky by day: `daySky` (the sky colour that counts as day), `mask` (the colour left undrawn), and rules `{ facing2, hours, record, col, row }`; null: none | C | null | below |

**Sky art** (**O**, CotAB 0x53824, [coab/assets.md §3](../A-games/coab/assets.md#background-the-main-change-o-0x53824--ovr0310184)).
A picture is shown when the view's sky colour (`T.sky` indexed by ECL 0x49FD, or 0x49FE when the
party's square has event bit 7, & 7) equals `daySky`, the party's square has event bit 7 clear, and a
rule matches the party's facing × 2 and the clock's hour *h* (ECL 0x49C9) within `hours`; the first
matching rule wins. It is SKY record `record` drawn at view pixel ((`col[0]` + `col[1]`·*h*) · 8,
(`row[0]` + `row[1]`·*h*) · 8), colour `mask` transparent. CotAB: `daySky` 11, `mask` 13, rules in order:
facing2 2, hours 1–5, #251, col (7, 0), row (5, −1); facing2 4, hours 3–5, #251, col (−3, 1), row (5, −1);
facing2 6, hours 13–18, #251, col (0, 0), row (−13, 1); facing2 4, hours 13–15, #251, col (−8, 1),
row (−13, 1); facing2 0, hours 0–23, #250, col (0, 0), row (0, 0).

**Window borders** (P). A window's border uses the game's frame: rope tiles at the corners and
edges, or, with frame tables, the corners as the screen frame ends up after its rows and columns
overlap (top left = left column's row 0, top right = right column's row 0, bottom left and right =
the bottom row's columns 0 and 39) and each edge the tile that occurs most often along that side of
the screen frame (40 columns, 24 rows). The full-screen frame (CotAB 0x1330, with divider rows
0x1403) is: row 23 the bottom table, a divider row the divider table, column 0 the left table,
column 39 the right table, row 0 the top table, in that order of precedence, nothing elsewhere.

`font` (2026-10-22): the 8 × 8 font's DAX family and record: 8X8D1 #201 (PoR, CotAB), 8X8D5 #201 (SotSB).

### 3.2 The title (`TitleScript`)

The start-up sequence is part A ([engine/input-and-menus.md §1](../A-games/engine/input-and-menus.md#1-start-up-sequence);
[coab/assets.md §7](../A-games/coab/assets.md#7-start-up-title-copy-protection-o)). The profile holds:

| Field | Meaning | PoR | CotAB |
|---|---|---|---|
| `first` | screens always shown: TITLE records at pixel positions, a duration in ms | TITLE #1 at (0, 0), 5 000 ms | the same |
| `long` | screens shown when line `configLine` (0-based) of the configuration file starts with `F` (case-insensitive, after trimming); also when the file is missing | TITLE #2 at (0, 0), 5 000 ms, with lightning | TITLE #2 at (0, 0) + #3 at (48, 88) for 10 000 ms; then #2 + #3 + #4 at (0, 88) for 10 000 ms with sound 13 at its start |
| `configLine` | the line that holds the long-intro flag | 4 (POOL.CFG line 5, `DS:49D1`) | 3 (CURSE.CFG line 4, `DS:4FB1`) |
| `credits.ms` | how long the credits stay | 10 000 | 10 000 |
| `credits.frame` | rope boxes as text cells (x1, y1, x2, y2), or the screen frame with divider rows | boxes (1, 1)–(38, 3) and (1, 5)–(38, 23) | screen frame, dividers at rows 3 and 8 |
| `credits.lines` | (row, column, colour, image address of the line's string) per line | [por/title-and-credits.md](../A-games/por/title-and-credits.md#credits-screen-o-290c0206-strings-290c004b01e2) | [coab/assets.md §7](../A-games/coab/assets.md#7-start-up-title-copy-protection-o) step 5 |

A screen's `lightning` (PoR) flashes palette register 1 at irregular moments (presentation only:
any generator, [host-contracts.md §6](host-contracts.md#6-randomness-the-dice-source)); a screen's
`sound` plays once the game's sound driver is mapped. The credits' text is game text: the routine
prints Pascal strings from the overlay (PoR `290c:004B–01E2`, CotAB 0x182AD), each at its row,
column and colour; a conforming build reads them there (the profile gives each line's address,
[D-appendices/strings.md §5](../D-appendices/strings.md#5-texts-in-the-profile-data)).

### 3.3 The start-up menu and demo (`StartMenu`)

A game with a menu after the title (CotAB's "Play / Demo") has a `StartMenu`; PoR has none
(`null`: no "Demo" in its START.EXE or GAME.OVR, **O**). The original's behaviour is part A
([coab/ecl.md, "Start-up menu and demo"](../A-games/coab/ecl.md#start-up-menu-and-demo-o)); the port
offers the demo as **Watch the demo** on the party screen instead of the menu (IMP-074,
[C-port/app-flow.md](../C-port/app-flow.md)), and keeps the menu's data.

| Field | Meaning | CotAB |
|---|---|---|
| `title`, `choices` | offsets in START.EXE's load image of two Pascal strings: the menu's title, and its choices (each run of letters and digits is a choice; its key is its capital letter, else its first character) | 0x06, 0x25 (CS:0006 and CS:0025 of the main segment, image paragraph 0) |
| `timeout.first`, `timeout.again` | hundredths of a second after which the menu answers `timeoutKey` itself: after the title sequence, after a demo | 3 000, 1 000 |
| `timeoutKey`, `demoKey` | the key the timeout answers; the key that runs the demo (any other answer starts the game) | `D`, `D` |
| `titleAgain` | the title sequence runs again after a demo, before the menu | true (0x2C7) |
| `demo.block`, `demo.record` | the demo's script | 1, 82 (0x1FD sets DS:5C08 = 1; 0x1C001 record 0x52) |
| `demo.speed` | the game speed the demo runs at | 9 (DS:4FC2 = 9, 0x202) |
| `demo.keysWait` | key reads wait for a key; false: they take one that is waiting and never wait (and text input stops after one read) | false (0x6819, 0x5514) |
| `demo.continueBattle` | "Continue Battle:" is asked when the enemy side is gone | false (0x227EF) |
| `demo.aftermath` | after a battle: outcome, experience, NPC shares and treasure; false: only the monsters leave the list | false (0x1EE98, 0x1EEAC, 0x1EF4E) |

The demo run itself is the engine's ([host-contracts.md §3](host-contracts.md#3-the-engines-entry-points)).
Each demo flag is read by the procedure it changes; a later game's demo is its profile entry.

### 3.4 The sound driver (`SoundDriver`)

| Field | Meaning | PoR | CotAB | SotSB |
|---|---|---|---|---|
| `segment` | image offset of the driver's code segment in START.EXE's load image | 0x8AE0 (segment 0x18AE) | 0x6990 (segment 0x0699) | 0x7E40 (segment 0x07E4) |
| `data` | added to PoR's offsets of the driver's variables and its channel and frequency tables (pointers inside the tables are the game's own) | 0 | −0xBD (**O**: 5 211 of 5 955 bytes equal at that shift) | −0xBF (**O**: the start routines 0xB654, 0xB6C0 and the timer routine) |
| `code` | added to PoR's offsets of the command handlers, the targets of the driver's jump table | 0 | −0xBD | +0x20D2 (**O**: the jump table at CS:0x162) |
| `tables` | the PC-speaker and Tandy effect tables, CS offsets: per effect four words, a channel's data or 0 | 0x55F, 0x607 | 0x4A2, 0x54A | 0x4A0 (13 effects), 0x508 |
| `transient` | whether `PlaySound` has a transient mode: outside the sections that play in full it stops the effect after `delay(10)` ([C-port/audio.md §3](../C-port/audio.md#3-the-cut-off-rule)) | true (`FUN_18ae_00dc`, `DS:5374`, **O**) | false (0x69B0 starts the effect and returns, **O**) | false (0x7E60, as CotAB's, **O**) |

The driver and its effects are part A ([engine/sound.md](../A-games/engine/sound.md),
[coab/assets.md §8](../A-games/coab/assets.md#8-config-video-palette-sound)); the port's playback is
part C ([C-port/audio.md](../C-port/audio.md)).

### 3.5 The ending (`EndingScript`)

The ending is overlay code; its captions are Pascal strings in GAME.OVR, read at run time: caption
offset *o* is the string at **GAME.OVR file offset `cs` + *o***.

| Field | Meaning | PoR | CotAB |
|---|---|---|---|
| `cs` | file offset in GAME.OVR of the overlay segment that holds the captions | 0x2069D (merged image 0x38040) | 0x2593F (merged image 0x3BF10) |
| `steps` | a list of steps: `text` (captions replacing the last ones), `picture`, `wait` ("Press any key to continue.") | below | below |

A `picture` is record `record` of `file` (PIC, BIGPIC or FINAL) + the block number; `animate` runs its
frames `loops` times (default ((10 − speed) × 5) / 2, `FUN_4804_0006`); with `at` [x, y] it is drawn
there over the picture shown, else it replaces it and the window takes its size; with `fromParty` *n*
it is drawn only for a party of at least *n*.

PoR's steps (**O**, `FUN_4804_02a4`, [por/ending.md](../A-games/por/ending.md)): text 0x114, 0x138,
0x15D; FINAL 1 at (0, 0); FINAL 2 at (16, 32) animated; FINAL 3 at (0, 0); FINAL 4 at (0, 88) from 2
members, 5 at (104, 72) from 3, 6 at (0, 72) from 4; text 0x17B, 0x19F, 0x1C4, 0x1EB, 0x20B, 0x230;
FINAL 7 at (16, 0) animated; text 0x239, 0x260, 0x288, 0x29B; FINAL 8 at (16, 0) animated once; wait.

`after` (null: PoR, whose PROGRAM 8 at 0x1CA86 plays the ending and returns): what PROGRAM 8 does next,
`{ set, restoreParty, won, savePrompt }`: the script variables `set` ([canonical address, value]), every
member restored (HP := max, status 0, in play 1), the party screen with Begin refused while `won` is not
0, the question at `savePrompt` and Save on Yes, then the game left. CotAB (**O**, 0x1B9AD): set
[[0x4AFD, 0xFF], [0x6DA8, 0xFF]] (its ECL 0x4CFD and 0x7EA8), restoreParty, won 0x4AFD, savePrompt 0x1B92B.

CotAB's steps (**O**, image 0x3D02C): text 0xC87, 0xCB6, 0xCEB, 0xD21; wait; text 0xD76, 0xDA7, 0xDE0,
0xE15; PIC 0x4A animated; wait; text 0xE4F, 0xE81, 0xEBB, 0xEF2; PIC 0x4B animated; wait; text 0xEFF,
0xF2D, 0xF62, 0xF95; PIC 0x4D animated; PIC 0x41; text 0xF9B, 0xFC2, 0xFF7, 0x102A; wait; BIGPIC 122;
text 0x104E, 0x1083, 0x10BE, 0x10F4; wait.

The dialog that shows the ending is part C ([C-port/app-flow.md](../C-port/app-flow.md)).

## 4. Per-game listing

*Informative.* Where each game's values are stated:

| Module | PoR | CotAB |
|---|---|---|
| identity, files, stores | §2, [files-and-detection.md](files-and-detection.md) | same |
| fields, tables, saves | [records-and-tables.md](records-and-tables.md) §2.2, §3.2, §4 | same |
| ecl | [script-vm-map.md](script-vm-map.md) | same |
| rules, treasure, imports | [procedures.md](procedures.md) | same |
| spells, effects | [vocabularies.md](vocabularies.md) §6–§7 | same |
| view, title, startMenu, sound, ending | §3 | same |
| journal, spellNotes, rulesText, landmarks, debug | [D-appendices/port-data.md](../D-appendices/port-data.md) | same |

### 4.1 CotAB's presentation differences

*Informative.* Moved from [coab/assets.md §9](../A-games/coab/assets.md#9-summary-of-differences),
the CotAB research's checklist; each item is now profile data or a part A fact:

1. New families: SKY overlays and the three-band EGA background (`view.ground`, `view.skyArt`);
   BIGPIC full-width pictures (`view.bigFrom`); TITLE #3/#4 overlays (`title.long`); TILES only for
   the code wheel (skipped, IMP-068).
2. 8X8D1 #202 grows to 40 tiles (the second frame style from 0x11E, `view.frame.tables`). Multi-set
   wall tiles are `r·10 + k`, without PoR's `r or 10` (part A, [coab/assets.md §3](../A-games/coab/assets.md#3-3d-view)).
3. The overland is a BIGPIC plus a city cursor plus ECL menus (`view.overlandPicture`, `T.cursorX/Y`);
   no SQRPACI/ICON tile path (`view.tileOverland` empty).
4. ECL area variables at 0x4B00 (sky 0x4BFD/0x4BFE, hour 0x4BC9, mode 0x4BE6, city 0x4CA1, no-map
   0x4BFB): the canonical translation ([script-vm-map.md §2](script-vm-map.md#2-regions-and-translation)).
5. Sky table entries 2 and 5 are dark colours (`T.sky`); sun and cloud placement (`view.skyArt`).
6. The font, CHEAD/CBODY/COMSPR, the sound driver and its effects are reused (`sound`); the
   configuration file's sound codes are swapped and it has four lines (`title.configLine`).

## Open


- None.
