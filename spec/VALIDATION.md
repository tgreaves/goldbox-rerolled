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
back, a frame after each: 25 of 25 exact. **CotAB walks and saves** (2026-10-23): five walks with
`viewcheck.py coab --save B --moves …` (pauses answered, [tools/dosbox/README.md](../tools/dosbox/README.md)):
two along Tilverton's streets (block 2 area 1, from (6,12), 12 and 14 moves, past signs, the rumour
squares and the street texts), and three in areas the port's own save put both sides in after a debug
jump (block 2 areas 3 and 4, block 6 area 67, 14, 16 and 13 moves): 74 of 74 frames exact. Saves: the
original's camp save after loading save A, after a reload, and after the area-67 and street walks, each
against the port's save (`headless/run.ts --save`) after the same play and a camp: equal byte for byte
but for the stack garbage after the party stems, the list pointers in `.SAV` and `.FX`, the inert byte
0x3206 ([coab/records.md](A-games/coab/records.md) §5) and, on the street, the rumour counter and
scratch word that follow the dice (ECL 0x4C0C, 0x7F79). A camp rest of 1 day 02:15 in the inn room
(`rules/camp.ts` `restStep` on the port's side) saves the same clock words (0, 5, 1, 2, 1, 0, 0) and the
same records; with MATHEW's hit points lowered from 49 to 40 in the copied save, both give him 41
(1 HP a day of rest). They found that every save the port wrote
set ECL 0x4CFD, the game won, through PoR's wall-set copy into A, so the original refused Begin from
it (and the port's own party screen after any save); fixed, the original resumes the port's saves,
empty `.SWG`/`.FX` files included, and saves them again as from its own. Also seen: ECL 0x4BFB ≠ 0
hides the coordinates and stops Area ([coab/ecl.md](A-games/coab/ecl.md)); HMENU's lone "PRESS
BUTTON OR RETURN TO CONTINUE." shown as "PRESS <ENTER>/<RETURN> TO CONTINUE". Not crossed yet: an
area boundary in CotAB (every way out of the walked areas meets a question or a battle). **Longer PoR walks and saves** (2026-10-23, the Mac,
`viewcheck.py --save`/`--save-to`, `longwalk.py` and `savecompare.py`, `tools/dosbox/README.md`):
walks found with the headless runner (`web/headless/walk.ts`) so that nothing but the walk happens, each run in pieces of about 24 moves that
end by camping and saving in the next slot, the next piece loading the original's own save in both
(so the port loads every one of them). In save A's slums (block 2 area 20, ECL 0x4A80 set to 15 in a
copy of the save so that the script's wandering monsters stay away): a 70-move walk (73 frames, 3
saves) and a 160-move one over 50 squares (167 frames, 7 saves), one 24-move piece again at night
(the clock's hour set to 15: the black sky, 25 frames, 1 save); in New Phlan's streets (block 3 area
0, through the gateway): an 83-move walk over 43 squares (87 frames, 4 saves); through the gateway and back, unpatched
(20 frames, 1 save). The walks, from save A: `flffflflfflflffrfffrffrfrflflfffflffflflffrfrffflfffflffffffrffrfrffrf`,
`flfffrfffrffrffrfrffrfrfflffflffffbfrfrflffffflffffffrffrfrfflfffflffrfrfrfrfrfrfffrflfflfrfrffflflffflflffflflflflflflffflffflfrfrflfflfrfrfrffrffffffrffrfrfrf`,
`fblfrffrffflfflffrfflfflffbffrflfrfflffffflfffrffbfflfffrffflffffffffflffflfffrffff` and
`fblfrffrfffffffrfff`. Every frame exact; every save equal to the port's in every byte a load reads,
except the script variables that hold a dice result where the original's random generator and the
port's differ, as they must (ECL 0x980F, the slums' wandering-monster roll; 0x6E79, 0x9802 and the
name at 0x9890 after New Phlan's street roll came up 19 in the original). **Rests and saves**: from
save A with the rest-encounter chance at 0, camp, rest 1 day 2 hours and 3 days 5 hours, save: both
saves equal (the clock, the healing, every record), and an immediate camp and save from save A
equal. The saves showed what the original writes ([engine/savegame.md](A-games/engine/savegame.md),
"Files"): no `.SPC` for a member without effects (the port's export writes an empty one, IMP-006),
the stem table's slack (the whole of each slot past the party count). **A shop** (2026-10-23, `scriptcheck.py`,
[tools/dosbox/README.md](../tools/dosbox/README.md)): from save A, 28 moves to New Phlan's arms shop, Yes,
Buy, a Hand Axe for 1 gp, Exit, Exit, camp and save in slot B, typed into the original from the port's
transcript: the saves equal but for the street event's dice (ECL 0x980F, 0x9890) and the axe's name
cache. It found two things: the original's Buy list opens on the second stock entry (the bridge allows
for it; the port's panel shows the whole stock, IMP-042), and the buyer's encumbrance is recomputed
when the copy is given, before the price is taken (588 = 500 + 50 + the 38 coins paid out, where the
port had recomputed after paying, 553; fixed, `rules/money.ts` `buy`, [engine/town.md](A-games/engine/town.md), "Shop").
**Training** (the same day and way): save A with BROTHER SEAN moved first (his files swapped with
member 1's), 1600 experience and 200 platinum, ECL 0x4A80 at 15; 26 moves to New Phlan's clerics' hall,
Yes, Train, Yes, Begin, camp and save: the screens' texts the port's, and the saves equal but for the
hit-point roll (char[0x32], [0x11B] and the roll counter [0xB1]). It found two things, both fixed: the
port recomputed the items after training (the encumbrance then lost the 1000 gp paid; the original
leaves it, 638), and the original renumbers the members' icon slots char[0xBF] by party order when
they join, a load included (`Engine.joinSlot`, [engine/records.md](A-games/engine/records.md)).
**The temple** (the same way): BROTHER SEAN first with 5 HP, 14 moves to New Phlan's temple, Heal,
Cure Light Wounds, Yes, Exit, Exit, camp and save: equal but for the hit points healed (1d8). Found and
fixed: the original's Heal list comes back after each service until its Exit (the port went back to
the temple's menu), its title is "*name*, how can we help you?" (0x1DAF6; the port had its own), and no
items' recompute follows a cure (the encumbrance keeps the fee paid; [engine/town.md](A-games/engine/town.md), "Temple").
Not run: the Sell, Share and Appraise checks (decided not worth it); register 0x035F (no debugger).
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
- **Silver Blades: casting in a battle and a real bundle** (2026-10-23, Playwright with headless
  Chrome against the built app, save A). Bundle: the opening's Mage Scroll given to MALACHITE, two
  more from the debug editor's Add item (now offering the game's scrolls); Join on the first: "Bundle
  of 3 Scrolls", weight 9 (3², the kept quirk), encumbrance 13 with the 4 gold; Halve: "Bundle of 2
  Scrolls" (weight 4) and the first scroll after it (the opening's, weight 10); Halve again: the two
  scrolls, the bundle's second in its place and its first after it (0x4474D); Join again: "Bundle of 3
  Scrolls"; Use needs it readied ("Must be Readied"), then "Nothing happens." (its spell bytes are
  cleared, 0x44A44). Casting: DOMINIC (cleric) and MORGAINE (magic-user) memorise on the Memorize
  panel, rest 9 h ("has memorized" for each), Debug jump to block 2, area 68, Attack the fighter, rest
  until "YOU ARE SPOTTED BY A PATROL." (three necromancers, six hell hounds); in the battle Cast:
  the list with each spell's line, Magic Missile aimed at a necromancer (18 and 20 points "from
  Magic", "lost a spell" when it was casting), Cure Light Wounds ("Begins Casting", the aim at its
  later turn in the round: self and the adjacent allies only) on DOMINIC ("fully healed") and on
  MALACHITE ("partially healed", 12 → 13); the turn passes after each. No page or console errors.
  Found and fixed: the monsters were drawn as nothing in block 2 (SotSB has CPIC1 only; its loaders
  take CPIC and SPRIT from file 1 and some PIC records from PIC4 and PIC5, assets.md §1: profile
  `pictureFiles`); the Memorize panel headed a ranger's druid slots "Magic-User spells"; each step of
  Rest Time added a line to the log (now redrawn, as "Camp:" and "Magic:" coming back); the debug Add
  item listed nameless types and no scrolls.
- **Silver Blades toured headless** (2026-10-23, `sotsbtour.test.ts`, the play-test's `tour`): every
  area of the three blocks but the demo's record entered by the Debug jump at the open square nearest
  the middle, the party made sturdy (200 HP, money), then a walk to the nearest square not yet stood
  on, with the play-test's fights, camps, shops and saves on the way; every picture, sprite and combat
  icon asked for, and the drawn view at every step (every wall in sight with its wall set and tiles),
  checked against the files. 1 500 steps an area: no failures; the mine levels 2/49–2/51 and the
  ruins 1/32–1/33 are reached by their stairs and teleports, so a walk covers a part of each. Found
  and fixed: the demo's three NPCs had no combat picture (ADD_NPC swaps their pictures in the demo,
  ecl.md "Start-up and new game"); a jump into an area whose map an earlier script loads (2/49–2/51)
  kept the last area's map, and after a save and load the party could not move (the jump now loads the
  area's own map, IMP-025); SotSB's view closes its edges in areas 0 and 80, not CotAB's 0 and 10
  (assets.md §2); after a flight that lost members the current character could be one of the lost
  (the remove-current routine's rule now applies, combat-rules.md "Results"; all games).
- **Silver Blades in the browser, later blocks** (2026-10-23, Playwright with headless Chrome against
  the built app, a fresh profile): the title music (8 sound buffers started), save A, the Enhanced
  view as the default and the Original view after the setting, both walking; a Debug jump to block 3
  area 80 and a battle there (cloud giants and Black Circle wizards drawn, Quick for all, the
  treasure screen after it); camp, Save to slot B ("Game saved in slot B.", then "Quit TO DOS" as the
  original), Quit to the party screen, Load B; Watch the demo to its red dragons' battle with its three
  NPCs drawn. No page or console errors. Found and fixed: the demo's NPCs drawn as nothing (above), and
  their party cards showed an icon built from parts (now their combat picture, ui-contract.md §4). The demo itself runs in `demo.test.ts`, every picture and icon in the files.
- **Silver Blades: a save the original wrote** (2026-10-23, DOSBox Staging on the Mac, `tools/dosbox/run.py`
  from save A: the opening, Encamp, Save to slot B, "Quit to DOS" No), compared byte for byte with the
  port's save after the same steps (the headless runner's `--save`, host-contracts.md §8.1). Found and
  fixed: the opening's mayor's treasure gives experience (2500 each, "EACH CHARACTER RECEIVES 2500
  EXPERIENCE POINTS. THE PARTY HAS FOUND TREASURE!"), because COMBAT without monsters runs the
  aftermath in all three games (PoR FUN_29c3_179b, CotAB 0x1A198, SotSB 0x1F722), which the port skipped;
  the paladin's and the ranger's bonus (CotAB 0x1DA97, SotSB 0x2381E; the port had PoR's four classes);
  the summary's lines by game (PoR 0x1E9C9, CotAB 0x1E1AD, SotSB 0x23E8B: the outcome only when an enemy
  was counted, so a won battle in PoR and CotAB has no treasure line); the port's save copied the wall sets
  into ECL A 0x4AFA–0x4AFF in every game, overwriting script variables in CotAB and SotSB (CotAB's won flag
  0x4AFD among them), and wrote an empty wall-set slot's number as its slot; SotSB's camp Save counts saves
  in ECL 0x4A3C (0x390C5). Then equal: `SAVGAMB.DAT` to the last party stem, and every `CHRDATB*.SAV` and
  `.SFX` but for the run-time pointers the original writes from memory (records.md §4). **Walks** from
  saves past the opening (`viewcheck.py sotsb … --start … --moves …`, a frame after each move): from the
  original's own save B, 16 moves through the town (block 1 area 16, from (3,3) south to (3,14) and
  back round), 17 of 17 frames exact; from a save the port wrote after a debug jump to the ruins (block
  1 area 32, (11,2)), which the original loaded, 18 moves out of the ruins into the town across the area
  boundary (32 → 16 at (15,8)) and along its street past the temple and the vault, 19 of 19 exact.
  A port save in the mines (block 2, entered by its entry record 48, which loads the map and wall sets
  and goes on to the temple level, area 51) left the original on "Loading...Please Wait" for good:
  the port kept the scripts' block value in B 0x6E12 (1 after the jump; 3 in play for ECL2), which the
  original's loader takes as the file digit (0x41F66), and ECL1 has no record 51. Fixed (the save
  writes the digit there in every game, as the originals' writers do; ecl.md); then the original
  loads it, 5 of 5 frames exact there, and 18 of 18 on a 17-move walk round the temple level. Saved
  there by the original (Encamp, Save to B) and by the port after the same load: the DAT is equal
  but for byte 0x1406, the previous game state (2 in the original's, 4 in the port's), which the
  loader overwrites at once (records.md §4); the character files equal but for the run-time pointers
  (three of the six written byte for byte as the port's). The previous-state byte (CotAB 0x3206, SotSB
  0x1406) is now written as the originals do, from their writers (records.md §4; `Engine.prevMode`): 0 begun
  from save A, 4 after SotSB's opening, 2 after a load (`savecompare.test.ts`).
- **Silver Blades: the vault** (2026-10-23, DOSBox Staging, `run.py` from the original's own save past the
  opening, given coins and two items by the port's writers in the copy): the route from (3,3) to the bank
  (block 1 area 16, (7,9), `fffflffffrff`, found headless), DEPOSIT, the vault screen "View Pool Exit", the
  character view "Items Trade Deposit Heal Cure Exit" and the item list "Ready Trade Deposit Halve Join
  Exit", without Use, which the original offers only in game modes 2–5 (town.md, "Items menu"; the port
  showed it on the sheet in a shop, temple, treasure screen and the vault: fixed); the camp menu "Save View
  Magic Rest Alter Fix Exit" as the port's. Deposit put each item in at once, with no question, which the port asked (fixed, records.md §5);
  the `vault.dat` written on leaving, with two items, and another with the coins pooled from two members, go
  through the port's `parseVault`/`vaultFile` byte for byte; the item records equal the port's deposit but
  for the display-name cache and the stale next pointer (`vault.test.ts`).
- **Silver Blades: Fix** (2026-10-23, the same save, three members' hit points lowered and DOMINIC given
  four memorised Cure Light Wounds in the copy; the port's side the headless runner's `camp`): Encamp, Fix,
  Save. The original rested to 10:15; the port to 12:45, reading the druid term of the estimate from the
  cleric's first-level slots instead of the druid's (+0x13A, 0x3834B). Fixed, with the estimate's WIS test
  (0x3831C, SotSB only); then the clock words are equal, the hit points as the cures' dice give
  (`sotsbrules.test.ts`).

- **Curse of the Azure Bonds played further** (2026-10-23). Headless: the tour (`coabtour.test.ts`, every
  area of every block by the Debug jump, the sturdy party walking every square it reaches, 2 seeds × 1 500
  steps each, pictures, icons and the drawn view checked), 24 seeds × 2 000 steps of seeded play and 26
  areas × 2 000 steps with a party that could not die: no failures besides combat icons the block's CPIC
  file lacks (TODO.md). Browser (Playwright with headless Chrome against the built app, save A, Debug
  jumps): the enhanced and the original view in Tilverton's first room and the streets; the temple's
  healing list; the Cormyr steel shop (Buy, prices, the readied-instead column); the Hall of Training
  (Not Enough Experience, Human Change Classes' "Pick New Class", Begin back to the street); the
  Memorize panel for a magic-user and a cleric, rest, "has memorized"; Yulash's edge from block 3
  (ENTER CITY / JOURNEY ON / CAMP, the overland map with its cursor, camp and back); the guild battle in
  the sewers (2/2): Magic Missile at thieves from two casters, Cure Light Wounds asked for at the
  cleric's later turn, allied thieves green in the turn strip. No page or console errors. Found and fixed:
  with no map, camp and battles redrew the last area's 3D
  view instead of the overland map; the area map's "Not here." left the map drawn; after a battle the
  current character was not the first member; camp Cast of a combat-only spell showed
  "#combatOnlySpell". The hall refusing Begin after the first save (the autosave too) was found here as
  well; the DOSBox comparison above fixed it.
- **Curse of the Azure Bonds in its order** (2026-10-23; `coabchain.test.ts`, `COAB_CHAIN=1`): from save A
  with no Debug jump, the tour's walk (an area's squares first, then each step off the map's edge, which is
  how the scripts' exits are taken: the edge flag B 0x6DD5) and the scripts' own menus, the party made
  undying for the run (`PlayOptions.undying`: healed at every round, its saves made, not held or charmed,
  cured and raised after each battle), so that the route and not the dice decides how far a run gets. The
  scripts' area graph (NEW_ECL and the block writes to B 0x312) is Tilverton 2/1 → the guild 2/2 → the
  sewers 2/3 → the Fire Knives 2/4 (their defeat sets ECL 0x4C2A, which opens the sewers' way out) → the
  wilderness 1/80–1/81 → Yulash 3/16–3/18 and 3/21, Zhentil Keep 4/32–4/35 and 4/37, Myth Drannor
  5/48–5/51 and 5/53, Dracandros 6/64–6/67 and 6/69. Reached, 3 seeds × 30 000 steps: seed 1 Tilverton,
  the Fire Knives, the wilderness, Yulash 3/16–3/18, 6/69, 5/53 and Myth Drannor 5/49–5/51 (231 battles
  won); seed 2 the same as far as Yulash, then 6/69, 3/21, 5/53 and Zhentil Keep 4/32 (212 won); seed 3
  stays in the sewers. No failures. Further (80 000 steps, the undying run also taking an older save after
  3 000 steps with nothing new, never dropping a member, and counting a battle it would lose as won, which
  its levels decide, not the route): all three seeds pass Zhentil Keep (4/32–4/34, 4/37), Yulash
  (3/16–3/18, 3/21), 6/69, 5/53 and Myth Drannor (5/49–5/51); none reached Dracandros' tower (6/64, place
  13 of the wilderness, ECL 0x4C9B). Found: ECL4 #32's tavern has a one-way door, (13,7)'s east side a
  locked door and (14,7)'s west side a wall, and its only other way out (the bar, ECL4 #35's 0x8043) puts
  the party back on the square it came from, so a party that picks that lock stays inside (the port as
  the data, I: the original not tried); Scribe's used-up scroll leaves the item count as it was, as the
  original (camp-and-time.md, Rest). Followed up (2026-10-23): the effects piling up in 6/69 were the
  harness's: a failed save against the phase spiders' poison adds the poisoned marker 0x37 and kills
  (status 6), and the undying run stood the dead up without removing it, where the game's Raise Dead
  (0x4848A) removes 0x20 and 0x37; the run now raises as Raise Dead does. Place 13 (the tower) is the
  fourth choice, MYTH DRANNOR, of the Standing Stones' travel menu (ECL1 #80, 0x8DDD), offered with the
  three bonds' flags (0x4C59 = 1, 0x4C5A = 1, 0x4C5B ≠ 0); 0x4C59 is set by beating Dracandros in 5/51's
  courtyard (0x8FB6), which is reached from the roof only by the stairs at (3,1), taken facing the wall
  north (on_move 0x87A3 by the table at 0x9C81): the tour now tries each wall of a square with an event,
  as on_move runs on a move into a wall too. With that, 3 seeds × 150 000 steps from save A all set the
  three bonds (Dexam 4/34, 3/18, Dracandros 5/51), take MYTH DRANNOR at the Standing Stones, climb
  Dracandros' tower 6/64–6/67 and win the final battle (6/67's (6,1), 0x9280: PROGRAM 8, the ending).
  More harness gaps found on the way and closed: a flight that leaves members down removes them for good
  (the aftermath, 0x23CCC), which an undying party now counts as a battle won; Cause Blindness's 0x21
  stacks one per cast (engine/spells.md 37, 38), which a final battle replayed many times piled up, so the
  run's after-battle cure takes what the game's cure spells remove. One game-data gap, not the port's:
  ECL5 #51's dark elves are set up with the portrait selector 0x7EE1 = 49 and approach after it is back
  at 0xFF, so their close-up is PIC5 #49, which the file lacks; the sprite routine 0x1FF50 loads the
  picture only at distance 0 with the selector of that moment (0x20022), so the original shows none
  either. Left open: a potion's last charge spent in camp leaves its item count and hands as they were
  in the port (seed 2); whether the original recounts is in `TODO.md`. In the browser (headless Chrome,
  the built app, the CotAB folder with seed 1's save made on 6/67's (6,2) by `saveAt`): one step north
  starts Tyranthraxus' speech and the final battle (his picture, then the battlefield with the margoyles
  and high priests, the turn strip, "Tyranthraxus throws lightning"); the party's levels cannot win it, so
  after its first rounds the Debug panel's Win this battle; then PROGRAM 8: "8301 experience points", the
  ending's four panels (Tyranthraxus' spirit over the storm giant, the Pool, "Tyranthraxus is slain this
  day", the Knights of Myth Drannor) and the party screen. Two of the party's cards drew no icon and a
  pink name: the undying run strips Charm in battle without undoing what it set, leaving those members
  with an NPC's morale (`TODO.md`).
- **Curse of the Azure Bonds: a battle in DOSBox** (2026-10-23, `tools/dosbox/run.py` on a save the port wrote at
  2/3 (15,0) after a Debug jump, `SAVGAMB.DAT`): one step north, ECL2 #3's otyughs "attack immediately". An
  empty icon slot draws nothing: with LOAD_MONSTER's icon operand (save offset 0x2604) patched to a record
  CPIC2 lacks, the four otyughs fight unseen and the neo-otyugh is drawn, as the port's `combatIcon` null
  does. The party as loaded (no gear) is destroyed: "The monsters rejoice for the party has been
  destroyed", "Press any key to continue", as the port's aftermath. With its HP raised to 250 in the copy
  (`CHRDATB<n>.SAV` 0x78 and 0x1A4) and the game speed 0 (offset 0x1F9), on Quick: "Continue battle: Yes No"
  with the last otyugh at 1 HP, then "The party has won." and "Each character receives 1665 experience
  points." with no treasure line, the port's `R.battleSummary` for CotAB. The share itself follows the
  monsters' rolled HP, so it is not compared. Lowering the otyughs' count operand (offset 0x2603) skips the
  fight in both the original and the port.
- **Curse of the Azure Bonds: Memorize and a rest in DOSBox** (2026-10-23): save A, camp, Magic, End four times
  to SHARA (the original's Home/End; the headless runner's `cur 5`), Memorize, Enter on the highlighted Find
  Traps ("Cleric Spells: 5 5 2" then "5 4 2"), Exit, "Memorize these spells? Yes", Rest: both propose "Rest
  Time: 00:04:30"; Rest, Exit, Save in slot C. The two saves are equal but for what a load never reads (the
  records' and effects' list pointers, 0x3206, the stem table's slack): the memorised spell and the clock
  (04:30) alike. Found: the port's list printed "-" for a spell level without slots ("5 5 2 - -"), where the
  original leaves it blank (FUN_3f81_05a4); fixed.
- **Curse of the Azure Bonds: Tilverton's temple and a shop in DOSBox** (2026-10-23, saves the port wrote at 2/1
  (0,6) and (1,2) facing south): the temple, "Heal View Pool Appraise Exit"; Heal, "MATHEW, how can we help you?"
  with Cure Blindness, Cure Disease, Cure Light, Serious and Critical Wounds, Heal, Neutralize Poison, Raise
  Dead, Remove Curse, Stone to Flesh (no prices in the list) and "Heal Exit", the port's list and prompt
  (`ui/town.ts` heal). The shop: "Good day to you, gentle persons. Do you wish to make a purchase? Yes No",
  "Buy View Pool Appraise Exit" (the pool empty), Buy: Silver Mirror 25, 1 Flask of Oil 20, the stock the port
  offers. No boundary walk was typed: Tilverton's ways out are behind the scripts' questions.

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

- **Little DOSBox comparison** of running behaviour yet: the drawn view (all three games), walks and
  saves in PoR (save A's two areas) and CotAB (four areas), rests and PoR's rest counters (§4); no
  battle, shop or menu beyond a "press Enter" pause, as a walk is typed blind and the two games' dice
  differ. The **I** items that only the running
  original can settle are in [open-questions.md](open-questions.md).
- **The Enhanced (3D) view** is checked by eye only: its tolerance check needs WebGL
  ([exploration-view.md §3.6](C-port/exploration-view.md#36-what-it-must-preserve-the-tolerance)).
- **V11** needs a black-box mode of the server suites (AP4, [AUDIT.md §6.9](AUDIT.md#69-state-after-work-plan-step-1-2026-10-21)).
- **Releases.** Every hash and every E and F vector is of the GOG releases; with another release of
  either game they do not apply.
