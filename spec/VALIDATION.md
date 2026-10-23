# Validation record

> **Status: complete for the record so far** (work-plan step 7, [AUDIT.md](AUDIT.md) §8; the
> clean-room runs of step 8 are to come). Informative, a companion document, not part of the
> normative spec; kept out of clean-room file sets ([CLEANROOM.md §2](CLEANROOM.md#2-the-file-sets)).
> Part of the [specification](README.md).

How the specification has been checked: the cross-checks against the binaries, the test suites of
the reference implementation, the headless sweeps and play-tests, the reference hashes, and the
clean-room runs. The open questions stay in [open-questions.md](open-questions.md) and each file's
"Open" block.

## 1. Method

The spec was written from three sources, and a statement was kept only where they agree: the original
binaries (PoR's `START.EXE` with `GAME.OVR` merged, disassembled; CotAB's working image), the game
data (every record decoded, every script listed), and the reference implementation (`web/`,
`server/`, `tools/`), which follows the spec and is tested against the game files. Where the reference
differed from the binaries the binaries won and the code was fixed (the findings of
[AUDIT.md §6.9](AUDIT.md#69-state-after-work-plan-step-1-2026-10-21): C, SY, EM, UI, PA and AP). The
cross-reference from each spec section to the code is [xref.md](xref.md).

## 2. Cross-checks against the binaries

| Area | What was checked | Result |
|---|---|---|
| Containers | `tools/unexepack.py` and `mergeovr.py` against the TypeScript decoders: the unpacked and merged images byte for byte (the overlay stubs aside) | agree (`exepack.test.ts`, `gametext.test.ts`) |
| DAX records | every record of every PoR DAX file decoded to its stated size (1245 records); the images like `tools/gfx.py`, frame for frame | agree (`decoders.test.ts`) |
| Tables | every table of the table map read from each game's `START.EXE` through the map and checked against part A's values | agree (`tables.test.ts`, `fields.test.ts`); hashes in [expected-values.md §7](D-appendices/expected-values.md#7-decoded-files-and-tables-v1) |
| Script VM | `tools/eclvm.py` over every PoR area: 29 ECL records, 1024 starts each, 29 696 runs, no decode error and no missing handler; 101 runs loop with "first option" answers, each a genuine in-game loop | agree ([engine/ecl.md, "Validation"](A-games/engine/ecl.md#validation)); two open south-edge squares of block 1 area 24 have no exit (**I**, [open-questions.md](open-questions.md)) |
| Engine routines | the 2026-10-17 audit: 773 functions reachable from the main loops (500 covered by the spec or the port then), the data files loaded, the sound call sites, the engine's own strings | every gap was fixed or specified ([open-questions.md, "Port gaps from the 2026-10-17 audit"](open-questions.md#port-gaps-from-the-2026-10-17-audit)) |
| Game text | every message, effect and spell line, name list, the credits and the wipe banner read by address from the merged images, each the copy its routine references; each string checked against the copy it replaced | 182 message ids at C24 (203 now), both games ([strings.md](D-appendices/strings.md), `gametext.test.ts`) |
| Sound | the TypeScript driver against `tools/sound.py`: every effect, full and cut, PC speaker and Tandy, sample for sample (within 10⁻³); the cut-off by call site read in both binaries | agree (`sound.test.ts`, `soundcut.test.ts`; C23) |
| Drawn view | the drawing order transcribed from `FUN_55a0_05fd` and CotAB 0x53EC0 (the same routine instruction for instruction); the harness's frames equal the browser's at the same position | agree (`drawnview.test.ts`, headless Chromium) |
| Battlefields | PoR's wilderness generator against a statement-by-statement transcription of `FUN_34c7_11b4` for every flag byte, two seeds each; CotAB's against its own | agree (`wildfield.test.ts`, `mapfield.test.ts`) |
| Saves | the shipped saves written back byte for byte, both games | agree (`engine.test.ts`, `coabsweep.test.ts`, `savefiles.test.ts`) |
| The guide | the GameFAQs guide's claims against the code: cheat mode, the rest cap, training, loading | corrected in part A ([open-questions.md, "Cross-checks against the GameFAQs guide"](open-questions.md#cross-checks-against-the-gamefaqs-guide-porreadmemd-external-reference)) |

Against the running original in DOSBox: the drawn view of all three games, a scripted walk across
an area boundary, and the rest counters (§4, with the harness in `tools/dosbox/`). The south-edge
exits of block 1 area 24 were settled from the map data instead (the squares cannot be entered,
[open-questions.md](open-questions.md)).

## 3. Test suites

The reference implementation's tests (`web/test/`, vitest, run from `web/` with the game files in
`POOLRAD` and `COAB`; without them the tests that need the files skip). On 2026-10-21 (commit
after `7711e75`): **67 files, 389 tests, all passing** with both games' files; without them 130
pass and 259 skip.

| Area | Files (tests) | What they cover |
|---|---|---|
| Containers and data | `exepack` (1), `decoders` (6), `text` (2), `walls` (2), `fields` (4), `tables` (9), `profile` (5), `gametext` (6), `ttf` (1), `upscale` (1) | EXEPACK, DAX, RLE, images, wall sets, the field and table maps against each game's files, detection, game text by address, the font |
| Script VM | `engine` (4), `coabsweep` (4), `eclmap` (2), `eclops` (5), `door` (2), `npc` (7), `damage` (2), `demo` (5), `finale` (2), `ending` (2), `journal` (3), `landmarks` (3), `commissions` (3) | the opening tour, the sweeps, the debug jump, save write-back, the script map, opcodes, doors, ADD_NPC, DAMAGE, the demo, the ending, the journal and landmarks, PoR's commissions |
| Character rules | `chargen` (4), `training` (3), `abilities` (3), `joining` (2), `import` (1), `spellrules` (7), `temple` (4), `money` (3), `treasure` (1), `randitem` (1), `coabtreasure` (2), `camp` (4), `fix` (4) | creation and its draws, training, paladin abilities, joining, PoR import into CotAB, the spell books, the temple, money, the treasure split, random items, camp, the camp's Fix |
| Effects and spells | `effectmap` (8), `effectkinds` (11), `porhandlers` (9), `itemfx` (3), `fxchain` (1), `spellmap` (5), `spells2` (7), `coabspells` (41), `spellpaths` (5), `specials` (9) | the handler maps against each game's data, the handlers as the original computes them, item handlers, spell kinds, bolts and clouds, monster specials |
| Combat | `combat` (7), `casting` (35), `battlefield` (2), `battlemove` (6), `wildfield` (18), `mapfield` (4), `ux` (2) | battles, casting in both games, the battlefield generators against transcriptions, movement costs, the hit odds |
| Sound | `sound` (2), `soundcut` (4), `coabsound` (1) | the driver against `tools/sound.py`, the cut-off by call site |
| View | `drawnview` (13), `view` (2) | the drawn view's placements on made-up maps, the piece tables, the V9 reference frames |
| Harness and dice | `dice` (5), `headless` (7), `vectors` (6) | the dice source (no gameplay draw bypasses it), tape recording and replay, the headless runner, the 549 test vectors |
| The spec itself | `xref` (2) | every path [xref.md](xref.md) names exists; [addresses.md](D-appendices/addresses.md)'s generated lists are current |
| Play-tests | `porplay` (1), `coabplay` (1) | §4 |
| Storage and sync | `savefiles` (7), `server` (29), `sync` (14) | the save round trip and the sidecar, export and import, the server's API, sessions, quotas and headers, the admin command line, sync merging, deletions and the queue |

Also run before every commit: `npx tsc --noEmit -p .`, `npm run build`, and
`python3 tools/speclinks.py` (every link and anchor of the repository's Markdown).

## 4. Sweeps, play-tests and reference hashes

- **Script sweeps.** PoR (`engine.test.ts`): every ECL record of the 8 blocks entered from every third
  square, the scripts' menus answered by a seeded choice: no interpreter error (WALLDEF5 records 24
  and 25 need a variable Valjevo's entrance sets: allowed). CotAB (`coabsweep.test.ts`): every area of
  its 6 blocks from every third square, random answers then the last choice: no interpreter error. The
  Python sweep (`tools/eclsweep.py`) did every square of PoR (§2).
- **Play-tests.** `web/test/playtest.ts` plays each game from its shipped save with its pre-made party,
  by seeded random choices, through the engine's movement and every screen's rules (combat with the
  computer or random commands, shops, temples, treasure, camp, training), saving and loading back now
  and then, and checks the game's state after each step: 8 seeds of 300 steps per game by default
  (`porplay.test.ts`, `coabplay.test.ts`; more with `POR_PLAY_SEEDS`, `COAB_PLAY_SEEDS`).
- **Test vectors** ([test-vectors.md](D-appendices/test-vectors.md)): 565, replayed against the
  reference on every test run (`vectors.test.ts`):

  | Kind | Count | Procedures (vectors) |
  |---|---|---|
  | S (no game files) | 73 | the dice source (7 tape cases, 1 `Random`), the line walker (8), hit points (11), caster level (16), joining (14), the strength encoding (1), appraisal (2), terrain flags (2), wilderness battlefields (8), PoR's map battlefields (3) |
  | E (the executable) | 63 | the derived statistics (16), creation (11), training (8), dual-classing (4), coin values (2), sharing (3), CotAB's furnished map battlefields (3), spells on a battlefield (10), attacks (4), saving throws (2) |
  | F (hashed) | 429 | random treasure (8), map battlefields of the games' own maps (6), headless runs and battles (7), the sound driver (87), the images (4), the tables (118), the DAX files (199) |

- **V9 frames** (`web/test/view-frames.json`): the SHA-256 of 1024 drawn-view frames (every square
  and facing) for each of eleven areas (PoR 6, CotAB 5), from the GOG files; the harness's frames equal
  them (`drawnview.test.ts`).
- **Game text** (`web/test/text-hashes.json`): the SHA-256 of every string read by address (PoR 403,
  CotAB 430).
- **The original in DOSBox Staging** (2026-10-22): PoR run unattended (`SDL_VIDEODRIVER=dummy`, the
  game's folder copied and mounted as `C:`, keys typed by DOSBox's `AUTOTYPE` from a batch file under
  250 characters, `start sting`), observed through the saves it writes (the clock A 0x49C6–0x49CC, each
  member's HP). From save A with the game speed set to 0 and the rest-encounter chance (code 0x9A42)
  patched (save offsets 0x1545 = 100 and 0x1F9 = 0; rerun with the harness on 2026-10-23, the orcs at
  the 24th step overall, `tools/dosbox/README.md`): the heal counter `DS:6DD8` adds up across rests in one camp and starts again with a camp; the
  rest-encounter counter `DS:49FB` carries over between rests and camps. Both as camp-and-time.md and the
  port. Screen frames come from a small resident program started before the game (F12, typed by
  AUTOTYPE, writes the EGA planes and palette to a file once DOS is idle): 7 frames of the 3D view in
  save A's area equal the reference's drawn view exactly (0 of 7 744 pixels differing each), and showed
  the view at pixels 24–111, not 16–103 as graphics.md had it. CotAB the same way (save A, Tilverton's room at (7,13): 7 frames, four
  facings, a step into a wall): the wall set, the cobbled ground (SKY #252) and the view at 24–111, exact;
  its outdoor sky and clouds not yet seen. The harness is in `tools/dosbox/` (rebuilt on the server the
same day, the Mac's not having been committed): `viewcheck.py por|coab` repeats the view check from
save A (as loaded, four turns, a step), 5 of 5 frames exact for each game. **SotSB** the same way
(2026-10-23, save A after its opening, block 1 area 16 at (3,3) facing south, four turns in Move and a
step): 5 of 5 frames exact; it showed that the original's arrows move only in Move
([sotsb/README.md](A-games/sotsb/README.md), "The main menu"). **CotAB outdoors** (2026-10-23): from
save A out of the inn into Tilverton's street, (6,12), all four facings, with the save's clock (save
offset 0x193, ECL 0x4BC9) at 0, 3 and 14 in copies of the folder: 12 of 12 frames exact, among them the
cloud strip (SKY #250) facing north and the sun (#251) facing east at 03:00 behind the wall's edge
([coab/assets.md](A-games/coab/assets.md) §3); at 14:00 both draw a black sky, so no afternoon sun there. **A scripted walk** (PoR, 2026-10-23,
`viewcheck.py por --moves fblfrffrfffffffrfffblfff`): 24 moves from save A with no menus on the way,
through the gateway from New Phlan (block 2 area 20) into the unsettled areas (block 3 area 0) and
back, a frame after each: 25 of 25 exact. Not run: the Sell, Share and Appraise
  checks (no shop from save A; decided not worth a route); register 0x035F (no debugger).
- **The interface** was checked against part C in headless Chromium (2026-10-21; each part C file's
  "Validation" section says what): every screen class, PoR's game-file save A, the games screen, the
  import, the party screen, the play screen, the panels. Again on 2026-10-22 (Playwright with Chrome,
  each game's GOG folder imported, its save A loaded, Debug jumps): PoR's ending as steps (captions,
  the FINAL pictures, a figure per member); CotAB's ending and what follows it (the party screen with
  Exit for Begin, "You've won. Save before quitting?", Save to slot B, the end at the party screen);
  CotAB's shop prices against the stock's values (ECL4 #37, factor 32: every price twice the value,
  and Buy charges it; Tilverton's factor 16: the values, IMP-078) and PoR's New Phlan store (the
  values). Then: CotAB's camp menus (View, Magic, Rest, Alter, Fix) and its final battle on Quick,
  about 25 minutes of rounds without an end (the script refights it while ECL 0x7EC7 > 128). No page
  or console errors.
- **Escape in menus** (IMP-081, 2026-10-23, headless Chromium against the built app, PoR save A):
  Encamp, Save, Escape at the slot list (no save; "Quit to DOS" follows, as the original asks it after a
  cancelled save), Escape answers No, Escape at the camp menu leaves camp. Every menu with the game's
  Exit backs out through it, in all three games (`escape.test.ts`).
- **Silver Blades in the browser** (2026-10-22, Playwright with headless Chrome, the GOG folder
  imported). From save A: the title with its music, the party screen, the load, the opening's
  treasure (Take all, the split offered, Confirm); walking, the area map, Look, Search; camp: View,
  Magic (PAINE memorises Detect Magic, rests 4 h 15 min, casts it: "PAINE is Affected"), Rest, Alter,
  Level, Fix; Debug jumps into the town (block 1, area 16): the shop's Buy prices, Sell, Identify at
  100; the temple's free healing; the vault (Deposit, View, Take); the Hall of Training (a refusal,
  "Not Enough Experience", then with experience from the debug editor "will become: a level 9
  Paladin", "Congratulations...", no fee); a battle (block 2, area 68: the fighter's scene, then a
  patrol while resting): Aim's targets with their chances, Exit, Quick to the end, "Continue Battle:"
  with only the dying left, the treasure; save to slot B in camp ("Quit TO DOS" answered No), quit
  to the party screen, load B. A new game from the party screen: the CotAB import (CotAB's
  `CHRDATAn.SAV` given as `.GUY` files to Import: six characters, races renumbered), a party of three
  from save A and three from Curse, Begin, the opening's treasure; the item sheet: Ready and Unready,
  Halve ("Can't halve that") and Join ("There are no similar items to join with.") on a single scroll,
  as records.md §3.2. No page or console errors. Found and fixed: "#camp" and "#alter" printed as
  the camp and Alter prompts (SotSB has none); Level could not be left with Escape; the Debug jump
  capped areas at 63 (SotSB has 68 and more); a text a script prints in pieces was split into a line
  per piece (PRINT goes on along the line, host-contracts.md `print`); SotSB's shop factor 16 written
  into its data (Buy 0x25385). Not reached: Cast in a battle (no spells memorised by those at hand)
  and a real bundle of two scrolls (one scroll in the opening).

## 5. Clean-room runs

None yet (work-plan step 8). The plan, the file sets and the brief are [CLEANROOM.md](CLEANROOM.md).
Each run adds a row here, and its findings below.

| Run | Date | Spec commit | Builder | File set | Validations passed | Findings ([RULES] [DATA] [HARNESS] [UX] [SERVER] [BUG]) | Log |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### Findings and their fixes

| Finding | Tag | Section | Resolution | Commit |
|---|---|---|---|---|
| | | | | |

## 6. Residual gaps

- **Little DOSBox comparison** of running behaviour yet: the drawn view (all three games), one scripted
  walk and the rest counters (§4); the **I** items that only the running original can settle are in
  [open-questions.md](open-questions.md).
- **The Enhanced (3D) view** is checked by eye only: its tolerance check needs WebGL
  ([exploration-view.md §3.6](C-port/exploration-view.md#36-what-it-must-preserve-the-tolerance)).
- **V11** needs a black-box mode of the server suites (AP4, [AUDIT.md §6.9](AUDIT.md#69-state-after-work-plan-step-1-2026-10-21)).
- **Releases.** Every hash and every E and F vector is of the GOG releases; with another release of
  either game they do not apply.
