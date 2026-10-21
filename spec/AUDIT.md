# Specification audit and coverage matrix (Phase 1)

> **Status: Phase 1 deliverable, not normative.** This document maps everything GoldBox Rerolled
> does to where it is specified today, and lists what is missing, wrong or stale. It scopes the
> restructuring of `spec/` into a specification a builder can implement from alone. Once that
> restructuring is done and its findings are folded in, this file is **retired and kept as
> provenance** (as `docs/spec/AUDIT.md` was in Compunet Reborn). Do not use it to judge what the
> spec covers after that point.
>
> Audited at commit `1721f1a` (2026-10-21). Read-only audit: nothing else was changed.
>
> **Since then:** the decisions are recorded in §6.8. Work-plan step 1 (the layout of §7, the
> moves, the links, the documentation-only fixes of §6.4) is done; §6.9 says which findings it
> fixed and which stay open. Paths in this file are those of the audit (`spec/combat.md` …); §7.1
> maps them to the new files.

## Purpose

The goal, in Tristan's words: *"I want the specs/ to be able to fully re-create what you have
built, as it defines EVERYTHING required (obviously not duplicating data that can be extracted from
the game files)."* The model is Compunet Reborn's `docs/spec/`: a normative specification, a
conformance self-audit, and clean-room builds by a fresh agent that has only the spec.

This audit answers, for every part of the port:

1. Where is it specified now?
2. What is missing (the code does it, no document says so)?
3. What is wrong or stale (documents disagree with each other or with the code)?

**Authority order** when sources disagree:

1. For the original games: the binaries and data files (observed, **O**). The spec describes them.
2. For the port's own design (layout, controls, storage, sync, the engine model): the reference
   implementation (`web/src/`, `server/`), because no normative description exists yet.
3. Spec prose (`spec/`), then design notes (`docs/`), then `IMPROVEMENTS.md`.

A prose statement that contradicts the code is listed as stale unless the code contradicts the
binary, in which case the code is the bug.

## Method and sampling

| Read in full | Read in part (sampled) |
|---|---|
| `spec/README.md`, `architecture.md`, `containers.md`, `graphics.md`, `maps.md`, `menus.md`, `savegame.md`, `ecl.md`, `commissions.md`, `open-questions.md`; most of `records.md` | `combat.md` (Dice, Aftermath, Combat statistics, Still open, headings), `effects.md` (Port status, §3), `spells.md`, `camp.md`, `town.md` (Temple), `progression.md` (Payment, Combat experience, Open), `chargen.md`, `sound.md` §6 |
| `IMPROVEMENTS.md`, `docs/multi-game.md`, `docs/requirements.md`, `docs/server.md` (to "Running it publicly"), every README, `CLAUDE.md` | `spec/coab/*.md`: headings, open sections, `tables.md` §2 and §4, `README.md` |
| `web/src/games/`: `types`, `profile`, `por`, `coab`, `files`, `debug`, `sound`, `view`, `frametiles`, `ecl`, `startup`, `title`, `ending`, `journal`, `landmarkrules`, `imports`; most of `rules.ts` | `fields.ts`, `tables.ts`, `effectrules.ts`, `spellrules.ts`, `treasure.ts`, `rulestext.ts`, `spellnotes.ts` (heads and shapes) |
| `main.ts`, `version.ts`, `vite.config.ts`, `pwa/*`, `ui/settings.ts`, `store/savefiles.ts` (head), `store/records.ts` (head), `rules/journal.ts`, `rules/joining.ts`, `rules/commissions.ts` (head) | every other module: header comment, exported names, spec/IMP references (counted by grep), and targeted greps (RNG, storage keys, strings, constants). `ui/explore.ts`: structure and command bar. `render/world.ts`: constants. `server/*`: routes, limits, validation, cookie, names (grep) |

Claims marked "checked" below were confirmed by reading code and spec side by side; everything
else is from headers and references, and is graded conservatively.

## Legend

| Mark | Meaning |
|---|---|
| **A** | fully specified: a builder could implement this from the documents |
| **P** | partially: the behaviour is named or partly described; numbers, states, layout or formats are missing |
| **—** | not specified anywhere outside the code |
| **⚠** | a document and the code (or two documents) disagree |
| S / P / N | for IMPs (§3): Specified enough to rebuild / Partly / only Named |

## Summary

| Measure | Result |
|---|---|
| Source modules graded (`web/src`: 99 `.ts` + 2 JSON + `style.css`; `server/`: 10 files) | **112**: A 46 · P 57 · — 9 (`build.d.ts` not graded) |
| By layer | original-game layers (`data/`, `vm/`, `rules/`, `audio/driver`) mostly **A**; profiles (`games/`) mostly **P**; the port's own layers (`ui/`, `render/`, `store/`, `pwa/`, `main.ts`, CSS) almost entirely **P** or **—** |
| IMPROVEMENTS entries (73 ids) | **S 14 · P 52 · N 7**; plus IMP-034 described only in prose and IMP-009 cited but never defined |
| Port-authored data sets (§4) | 25 listed: **3** stated in the spec, **12** partly, **9** only in code, **1** disputed |
| `GameProfile` fields (§5, 31 top-level) | meaning, unit and source specified: **A 8 · P 15 · — 8** |
| Contradictions and stale statements (§6) | **24** recorded, each checked |
| Open questions | `open-questions.md`: 38 items, 8 struck through, at least 6 of the rest already answered elsewhere; about 81 **?** and 111 **I** marks across the spec |

**The short version.** Part A (the original games) is strong: the PoR engine is described to the
routine, with evidence marks, and CotAB as a diff. What a clean-room builder could not get from the
spec today is everything the port **adds**: the engine model that makes it data-driven (the game
profile, its procedure vocabularies, the engine-to-UI contracts), the whole user interface (only
named, one paragraph per IMP), the 3D view, the browser storage formats, and about twenty sets of
data written for the port. The server is the exception: `docs/server.md` is close to normative.

---

## 1. Document inventory

Dispositions: **Fold** = the content moves into the normative spec (and the source is retired or
reduced to a pointer); **Provenance** = kept as the research record, cited, marked non-normative;
**Project** = a working document of the repository, not part of the spec.

| Document | Role today | Disposition |
|---|---|---|
| `spec/README.md` | index, status legend, engine identity, external references | **Fold** into the new front matter (part 0); the per-file version labels go (stale, §6 S10) |
| `spec/architecture.md` | main loop, command menu, moving, doors, area entry, built-in screens, ending, party screen, sound note | **Fold** into A (main loop); party screen merges with `menus.md` §2; ending with the PoR scenario file |
| `spec/containers.md` | EXEPACK, FBOV overlays, DAX, RLE | **Fold** as is (A, complete) |
| `spec/ecl.md` | ECL VM | **Fold**; its *Validation* section becomes provenance in `VALIDATION.md` |
| `spec/maps.md` | GEO, movement, wall sets, the original 3D view, overhead map | **Fold**; remove its stale "Still to decode" (§6 C3–C5) and the IMP-007 note (port matter → part C) |
| `spec/graphics.md` | image blocks, shapes, animation, sprites, menu loop, transparency, font, screen layout | **Fold**; menu loop merges with `menus.md` §0 (two descriptions of `FUN_53aa_03bd`) |
| `spec/menus.md` | input widgets, start-up, credits, code wheel, party screen, creation flow, Modify, icon editor; §5 a corrections list | **Fold**; §5 is a to-do list already applied (§6 S8): drop it |
| `spec/sound.md` | sound driver | **Fold** |
| `spec/records.md` | character/item/effect records, ITEMS table, random items, inventory, derived statistics | **Fold**; the ITEMS and random-item dumps become informative appendices (they are data from the files); "Derived statistics" and `combat.md` "Combat statistics" describe the same routine twice: keep one |
| `spec/spells.md`, `effects.md`, `combat.md`, `camp.md`, `town.md`, `overland.md`, `progression.md`, `chargen.md`, `commissions.md`, `savegame.md` | the rules | **Fold**; move every "the port …" statement to part C; split `combat.md` (1 258 lines: rules, battlefield generation, AI, visuals); resolve §6 C1, C2 |
| `spec/open-questions.md` | the open list, mixed with an audit log (2026-10-17) and resolved items | **Fold** the live items into per-section "Open" blocks plus one register; the audit log → provenance |
| `spec/coab/*.md` (8 files) | CotAB as a diff from PoR, with "Port" status sections | **Fold** into part A (per-game files); the "Port"/"Port status" sections and `tables.md` §4 go to part B |
| `docs/multi-game.md` | engine-model design, where each game is described, step log with status, play-testing, backlog | **Fold** the design ("The game profile", "Records stay native", "Rules as data first", "Where a game is described", "Adding a game") into part B; the step log, "Tracking to the goal" and backlog stay **Project** (they are status, and stale in places, §6 S4) |
| `docs/requirements.md` | requirements R1–R7, constraints, intended architecture, delivery order | **Fold** R1–R7 and the constraints into part C's introduction; the architecture sketch is **Provenance** (stale, §6 C11) |
| `docs/server.md` | server design, API, data layout, security, configuration, deployment | **Fold** design, API, sync rules, data layout, security and configuration into part C (accounts and sync); deployment (systemd, Docker, proxies) stays **Project** |
| `IMPROVEMENTS.md` | the register of departures (73 ids), one row each | **Keep** as the register, but each row must point to the part-C section that specifies it; the rows themselves are too short to build from (§3) |
| `README.md` (root), `web/README.md` | project overview, tools, server quick start, credits | **Project**; the tools table is incomplete (no `battlefield.py`, `randitem.py`, `sound.py`, `sounddis.py`, `tools/coab/`) |
| `CLAUDE.md` | standing rules and method | **Project**; rule 3 (evidence marks) and rule 6 (saves stay compatible) are spec conventions and should also be stated in the spec front matter |
| `tools/*.py`, `tools/coab/*.py` docstrings | reference implementations with format notes (`gfx.py`, `geo.py`, `ecl.py`, `eclvm.py`, `sound.py`, `randitem.py`, `battlefield.py`) | **Provenance** and **reference implementation**: never given to a clean-room builder. Docstrings that state formats duplicate the spec; `tools/coab/ecl_coab.py` points to a wrong path (§6 S12) |
| `web/test/*.ts` (57 files) | the port's tests; several compare against the Python tools or transcriptions of the originals | **Project**, and the seed of the conformance suite (§8) |
| Code comments in `web/src/games/*.ts` | the only description of the profile schema (JSDoc on every field, with addresses) | **Fold** into part B; this is the largest body of unspecified-but-documented design |

---

## 2. Coverage matrix by source module

Columns: module · what it implements · where the spec covers it · grade · the gap in a sentence.

### 2.1 `web/src/data/`: decoders

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `dax.ts` | DAX container, RLE | containers §DAX, §RLE | A | — |
| `exepack.ts` | EXEPACK unpacking | containers §START.EXE | A | — |
| `font.ts` | 8×8 font record, glyph index | graphics §Font | A | — |
| `geo.ts` | GEO planes, walls, passage, wrap | maps §GEO, §Coordinates, §Movement | A | — |
| `image.ts` | image block, frames, XOR deltas, EGA palette, combat palette swap, sprite remap | graphics §Image block, §Animation, §Transparency; combat §Palette | A | — |
| `walls.ts` | wall sets, tile banks, rebasing | maps §Wall sets, §Tile bank | A | — |
| `text.ts` | 6-bit packed text | ecl §Packed text | A | — |
| `save.ts` | SAVGAM layout per game | savegame; coab/records §5 | A | — |
| `effects.ts` | 9-byte effect records | records §Effect record (marked I) | A | the record layout is still marked inferred |
| `spells.ts` | spell names and records from START.EXE | spells §Tables | A | its comment gives PoR's class codes only (CotAB's are 0 cl / 1 dr / 2 MU / 3 item) |
| `items.ts` | 63-byte items, ITEMS, name words, display name | records §Item record, §Item types, §Display name | A | the slot labels (`SLOTS`, "as the guide lists them") are port text |
| `character.ts` | name tables, coin values from START.EXE | records §Enumerations; coab/tables §2 | A | — |
| `ttf.ts` | builds a TrueType font from the 8×8 glyphs at run time | IMP-038 (named); the algorithm only in the file header | P | glyph-to-outline rule, metrics (128 units a pixel, em 1024, baseline) and the character map are code-only |
| `journal.json` | PoR journal text and maps (CC BY-SA) | README credits; IMP-055 | P | schema only in `games/journal.ts`; no build tool for PoR's file (CotAB has `tools/coab/journal_coab.py`) |
| `coab-journal.json` | CotAB journal (CC BY-SA) | IMP-055; `journal_coab.py` | P | schema in code |

### 2.2 `web/src/vm/`

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `engine.ts` (1 649 lines) | ECL VM, the exploration loop, area entry, moves and doors, new game, saves, demo, CotAB opcode variants | ecl (all opcodes, checked: DIVIDE, SURPRISE, DELAY, PAUSE); architecture §Main adventure loop; coab/ecl | P | the VM is **A**; not specified: the host contract (`Io`: 14 methods, which the UI implements), the seed and RNG, `newGame`/`newDemo`/`runDemo` as port entry points, autosave points, the debug finale's re-entry (open-questions "Smaller loose ends", I) |

### 2.3 `web/src/rules/`

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `abilities.ts` | CotAB paladin Lay on Hands, Cure Disease | coab/records §9 | A | — |
| `battlefield.ts` | battle grid, cell table, map-area and wilderness generators | combat §Battlefield (all subsections); coab/combat | A | the parametric form (passes, `FlagValue`) is part B, below |
| `camp.ts` | camp, memorise, scribe, rest, clock | camp | A | — |
| `chargen.ts` | creation rolls, derived stats | chargen; menus §3 | A | two overlapping descriptions (chargen and menus §3) |
| `combat.ts` (2 444 lines) | battle start, placement, rounds, turns, attacks, movement, AI, aftermath, spells in combat | combat (most sections), spells, effects; IMP-053/054/059/075 | P | rules are largely **A**; not specified: the `CombatUi` contract (≈20 methods, queued messages, holds), the movement planner (IMP-044), live movement with the command menu (IMP-053); the computer's item use is not ported (multi-game backlog) |
| `commissions.ts` | the Commissions panel model | commissions (variables, A); IMP-023, IMP-039 | P | the panel's commission list (titles, which entries, summons variables, the offer lines that mark one as known, progress texts) is port data in code only; it is PoR content in shared `rules/` with functions in it |
| `effectkinds.ts` (1 146 lines) | 125 named effect behaviours, the stat routine, item kinds | effects §2 (per type, PoR); coab/effects §2, §5, §6 | P | per-type behaviour is **A**; the behaviour vocabulary and parameter names (the engine model) are code-only |
| `effects.ts` | event dispatch, add/remove, shared globals | effects §1 | A | — |
| `equip.ts` | ready/unready, derived statistics | records §Inventory and readying, §Derived statistics | A | — |
| `import.ts` | PoR → CotAB character import | coab/records §7; IMP-070 | A | — |
| `inventory.ts` | items-menu actions | town §Items menu | A | — |
| `joining.ts` | who may join (party size, CotAB paladin/ranger) | menus §2.1; coab/records §8 | A | checked: implemented, though two documents still list it as open (§6 S4) |
| `journal.ts` | which text reveals a journal entry, tale or proclamation | IMP-055 (examples only) | P | the matching rules (regular expressions, roman numerals, id format `journal:n`, `tale:n`, `proc:X`) are code-only |
| `landmarks.ts` | static walk of the area script to classify squares | IMP-024 (kinds named) | P | the walk (from the `on_step` ON_GOTO, following GOSUB/IF) and the classification order are code-only; a third copy of the operand-count table |
| `magic.ts` | casting outside combat | spells §Casting outside combat | A | — |
| `money.ts` | coins, pool, payment, appraise | town §Money, §Appraise; progression §Payment; IMP-028 | A | — |
| `overland.ts` | tile wilderness | overland | A | — |
| `randitem.ts` | random treasure | records §Random items; coab/records §7 | A | — |
| `specials.ts` | event-14 monster specials (breath, eye rays, gaze) | effects §2 (88); coab/effects §2, §7 | P | PoR's event 14 is described as unfired; the shared target hook is described only for CotAB |
| `spellkinds.ts` | spell handler kinds shared by combat and camp | spells §Per spell; coab/spells §2 | P | per-spell behaviour **A**; the 37 kinds and their parameters are code-only |
| `spelltext.ts` | spell descriptions for Cast, Memorize, Rules reference | IMP-058 | P | how the line is composed from the record (range, duration, targets, save) is code-only |
| `training.ts` | training, level-up stats | progression | A | — |
| `treasure.ts` | "Take all" split suggestion | IMP-056 (one sentence) | P | the ranking ("gains most", "most room", coin split) is code-only |
| `worldfx.ts` | effect host outside combat | effects §1 (handlers) | P | the host interface (what handlers reach out of combat) is code-only |

### 2.4 `web/src/games/`: the profiles (see §5 for field level)

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `types.ts` | `GameProfile` (31 fields) | multi-game §"The game profile" (an older sketch), §"Where a game is described" | P | no normative schema; the sketch lists `config file`, `detection` but not half the fields now present |
| `profile.ts` | game list, detection, the active game, last game | multi-game step 1 | P | detection order (config file, then markers) is stated; `wants()`, `setGame` side effects, the `goldbox.game` key are code-only |
| `por.ts`, `coab.ts` | the two profiles | multi-game; coab/README | P | values are spread across the spec; no per-game profile listing exists |
| `fields.ts` | character field map, both games | records §Character record; coab/records §2 (with a PoR column) | A | field *names* are the port's; meanings and offsets are specified |
| `tables.ts` | 61 named START.EXE tables per game | coab/tables §2 (45 rows, both games); PoR addresses across the spec | P | 16 tables (frames, city cursor, place terrain, furnishing offsets …) are only in other coab files or code; §2's "hc" column is stale (§6 S5) |
| `ecl.ts` | VM memory map per game, opcode variants, CALL targets, flags | ecl; coab/ecl | A | the variant names (`passTime` …) and `canonical()` translation are part B |
| `files.ts` | save and character files per game | savegame; coab/records §1, §5 | A | — |
| `rules.ts` (407 lines) | rules values and the parametric procedures (slots, hit points, money, casting, bolt, clouds, wilderness and map fields, joining, temple, thief skills …) | values: progression, chargen, town, combat, coab/tables §3, coab/combat; shapes: JSDoc only | P | every value is specified; the parametric procedure each one feeds is defined only in code comments |
| `spellrules.ts` | handler kind + parameters per spell id, durations | spells; coab/spells | P | as `spellkinds.ts` |
| `effectrules.ts` | event lists, area effects, handler and item maps, add rule | effects §1–2; coab/effects §1–2 | P | as `effectkinds.ts`; contains transcribed engine strings and monster-name lists that are in START.EXE (§4) |
| `treasure.ts` | random-treasure bands per game | records §Random items; coab/records §7 | A | — |
| `view.ts` | 3D-view dressing: floor, ground picture, BIGPIC, overland kind, frames, sky art | coab/assets §3–§6; maps §Background colours | P | the values are specified; how the port's WebGL view uses them (IMP-069 rows and repeats) is not |
| `frametiles.ts` | window and screen frame tiles | menus §1 step 6 (PoR); coab/assets §6 | P | the "most common tile" rule for a resizable border is port design |
| `title.ts` | title screens and credits | menus §1; coab/assets §7 | A ⚠ | specified, but the credits are transcribed game text while ending and start-up menu read theirs by offset (§6 C24) |
| `ending.ts` | ending steps, caption offsets in GAME.OVR | architecture §Ending; coab/assets | P | caption offsets and CotAB's step list are code-only |
| `startup.ts` | CotAB start-up menu and demo mode flags | coab/ecl §"Start-up menu and demo" | A | — |
| `sound.ts` | driver location and shift | coab/assets §8; coab/tables §2 | A | — |
| `debug.ts` | debug jumps and finale | IMP-025 | P | positions and script addresses are code-only |
| `journal.ts` | journal schema, empty-tab texts | IMP-055 | P | schema and texts are code-only |
| `landmarkrules.ts` | text patterns for landmarks | IMP-024 | — | patterns are code-only |
| `spellnotes.ts` | one-line spell notes | IMP-058 | — | text written for the port, not in the spec |
| `rulestext.ts` | the Rules reference text | IMP-058 | — | text written for the port, not in the spec |
| `imports.ts` | PoR → CotAB conversion as data | coab/records §7 | A | — |

### 2.5 `web/src/render/`

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `world.ts` | WebGL 3D view: walls, floor, sky, fog, light, sprites, camera slides | IMP-001, 007, 020, 021 (named) | — | nothing beyond the IMP rows; geometry is code-only: FOV 70°, eye at half wall height, wall height 64/56 of a square, camera 0.35 squares back, fog 3–9, 180 ms slide, 450 ms sprite glide, sprite scale 0.016 a pixel, lights |
| `combatview.ts` | battlefield window and icons | graphics §Screen layout (combat), combat §Combat visuals; IMP-033 | P | the original's 7×7 window is specified; the port's "as many cells as fit, centred on whoever acts" is not dimensioned |
| `icon.ts` | combat icon composition | menus §4.2 (icon build) | A | — |
| `upscale.ts` | 4× whole-pixel enlargement | IMP-047 | P | the algorithm is stated in IMP-047; which images it applies to and the final smoothing are code-only |

### 2.6 `web/src/audio/`

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `driver.ts` | sound driver emulation, PC speaker, Tandy | sound §1–§8; coab/assets §8 | A | Tandy noise is "approximate" (IMP-015) without saying how |
| `sfx.ts` | play an effect, device choice, cut-off | sound §6–§7; IMP-013, IMP-015 | P ⚠? | the port plays effects 2, 3, 4, 5, 6, 8, 11, 12 to the end **by effect number**; sound §6 says the original does so **by call site** (`SetResident(0)` sections). Possibly an unlogged departure: to check (§6 C23) |

### 2.7 `web/src/ui/`

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `explore.ts` (2 043 lines) | the play screen: layout, text log, pictures, menus, command bar and ☰ menu, roster cards, shop/treasure/memorize panels, sheet, area map, wilderness view, debug, journal, commissions, keys and pad | architecture (commands), graphics §Screen layout (original); 25 IMPs | P ⚠ | only named per IMP; no layout, breakpoints, states or key map. Its header still describes the original arrangement ("party roster to its right"), not IMP-064 (§6 C8) |
| `party.ts` | party screen (IMP-073 groups) | menus §2; architecture §Party screen; IMP-073, 019, 032, 006 | P | groups and functions listed; states, texts and layout code-only |
| `creator.ts`, `newchar.ts` | character creation on one screen, icon editor, Modify | menus §3–§4 (original flows); IMP-040, 017, 018 | P | the original is **A**; the one-screen layouts are only described in IMP rows |
| `sheet.ts` | character sheet | graphics §Screen layout; IMP-041, 027, 062, 063 | P | as above |
| `camp.ts` | camp screens | camp; IMP-043, 030, 048, 031 | P | as above |
| `town.ts` | shop, temple, treasure | town; IMP-042, 056, 029 | P | as above |
| `combat.ts` | battle screen | combat §Player turn; IMP-033, 044, 053, 054, 059 | P | as above |
| `title.ts` | title sequence and credits, lightning | menus §1; coab/assets §7; IMP-050 | A | — |
| `ending.ts` | ending dialog | architecture §Ending; IMP-036 | P | the dialog form is only named |
| `settings.ts` | Settings panel | IMP-046, 051, 064, 057, 047, 015 | P ⚠ | IMP-046's list is out of date (§6 C10); storage keys code-only |
| `account.ts` | sign in, sign up, recovery, sync status, conflicts | docs/server.md; IMP-072 | P | the API is specified; the UI states and texts are not |
| `areamap.ts` | top-down map | IMP-022, 024; maps §Overhead map (original) | P | door colours, landmark icons placement, large view are code-only |
| `frames.ts` | rope/white frames as CSS border images | IMP-051; menus §1 (tiles) | P | the CSS construction is code-only |
| `gamefont.ts` | installs the TTF font | IMP-038 | P | — beyond the switch |
| `debugedit.ts` | debug character editor | IMP-025 | P | the field list is in IMP-025; limits code-only |
| `panel.ts` | close button and Escape for every panel | IMP-057 | — | one line in IMP-057 |
| `rulesref.ts` | Rules reference panel | IMP-058 | — | content is `rulestext.ts`, structure unspecified |
| `viewer.ts` | asset viewer (delivery step 1, view-only games) | requirements "Delivery order" | — | not described |

### 2.8 `web/src/store/`, `pwa/` and the top level

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `store/gamefiles.ts` | imported game files in IndexedDB | requirements constraints; profile `keep`, `stores` | P ⚠ | database and store names code-only; requirements.md promises GOG `.pkg` import, which is not implemented (§6 C11) |
| `store/user.ts` | roster, party, saves, autosave, conflicts in IndexedDB | docs/server.md "What syncs" (store names) | P | the object stores, keys and value shapes (`StoredSave`) are code-only |
| `store/savefiles.ts` | export/import of original files, ZIP, `.GBR` sidecar | savegame §Files; IMP-006 | P | the sidecar is described as "JSON"; its schema (`format: "goldbox-rerolled-save"`, `version: 1`, `known: string[]` of journal ids and commission offers) is code-only; ZIP writer/reader rules code-only |
| `store/records.ts` | records for sync: meta and files | docs/server.md (records, validation) | P | the `meta` of each kind (`slot`, `label`, `savedAt`, `members`, `modifiedAt`, conflict fields) is code-only; it cites a "Records" heading that does not exist |
| `store/sync.ts` | merge rules, queue, conflicts | docs/server.md "Sync rules" | A | the local bookkeeping (`goldbox.sync.<game>`) is code-only; harmless for interoperability |
| `store/account.ts` | session state, synced settings list | docs/server.md; IMP-072 | P | the synced keys (`poolrad.*`, seven) and owner key are code-only; see §6 C22 |
| `store/api.ts` | API client | docs/server.md "API" | A | — |
| `store/changes.ts` | change notifications | — | — | internal |
| `pwa/register.ts`, `pwa/stub.ts` | service worker and update prompt; single-file build | requirements R1; IMP-005 | P | manifest, cache set, the update prompt and the API exclusion are in `vite.config.ts` only |
| `main.ts` | start-up: last game, import screen, title, party screen, viewer | web/README; IMP-005, 072, 074 | P | the games screen and first-run flow are not described |
| `version.ts` | version line | IMP-073 (one clause) | P | format code-only |
| `style.css` (703 lines) | the visual design: EGA colour tokens, layouts, breakpoints (600, 700, 760 px or aspect ≤ 4:5, 900, 1200 px and ≥ 4:3, landscape ≤ 520 px high, coarse pointer) | IMP-057, 060, 064 (named) | — | the layout contract lives only here |

### 2.9 `server/`

| Module | Implements | Covered by | Grade | Gap |
|---|---|---|---|---|
| `main.ts` | entry | docs/server.md "Running it" | A | — |
| `app.ts` | routes, CSRF header, body limits, rate limits, cookies | docs/server.md API, Security model (checked: routes, `X-GoldBox`, 8 MB / 8 KB, 409/503/507) | A | cookie name (`__Host-gbr_session` / `gbr_session`) unstated; not needed by a browser client |
| `accounts.ts` | accounts, scrypt, sessions, recovery and invite codes | docs/server.md Security model (checked: scrypt N 2^15, r 8, p 1) | P | account-name rule (3–24 of `a-z 0-9 _ -`, lower-cased), the reserved names, NFKC normalisation and the code format (20 characters of a 32-letter alphabet) are code-only |
| `storage.ts` | per-account records, validation, quotas, atomic versions | docs/server.md Validation, Data layout (checked: regexes, limits) | A | — |
| `config.ts` | environment | docs/server.md Configuration | A | — |
| `static.ts` | static files, security headers, caching | docs/server.md Security model | A | MIME list code-only (trivial) |
| `fsutil.ts` | atomic writes | docs/server.md Data layout | P | described in prose only |
| `zip.ts` | export ZIP | docs/server.md "GET export" | P | `record.json` contents unstated |
| `admin.ts` | admin CLI | docs/server.md Admin CLI | A | — |
| `goldbox-rerolled.service` | systemd unit | docs/server.md systemd | A | — |

**Totals** (lowest grade counted where a row shows two): `data/` A 12 P 3 · `vm/` P 1 · `rules/`
A 14 P 10 · `games/` A 8 P 13 — 3 · `render/` A 1 P 2 — 1 · `audio/` A 1 P 1 · `ui/` A 1 P 15 — 3
· `store/` A 2 P 5 — 1 · `pwa/` P 2 · top level P 2 — 1 (CSS) · `server/` A 7 P 3. Overall **A 46,
P 57, — 9** of 112 (the ⚠ rows are counted under their grade).

---

## 3. The port's own design: IMPROVEMENTS.md

Graded on whether a builder could reproduce the behaviour (layout, controls, states, numbers) from
the IMP row plus any document it cites. **S** specified, **P** partly (behaviour described, details
missing), **N** named only.

| Group | S | P | N |
|---|---|---|---|
| Original bugs fixed (6 ids, 8 rows) | IMP-028 (3 rows), 031, 049, 075 | | |
| Screen and layout (11) | 050 | 045, 008, 022, 024, 038, 047, 051, 052, 046 ⚠ | 004 ⚠ |
| Controls (6) | 012, 074 | 003, 010, 029, 026 | |
| Exploration and presentation (7) | 021 | 020, 035, 036 | 001, 007 ⚠, 011 |
| Characters and party (9) | | 040, 017, 018, 041, 027, 016, 019, 032, 073 | |
| Town and camp (21) | 067, 068, 070 | 042, 056, 057, 058, 059, 060, 061, 062, 063, 064, 065, 066, 069, 043, 030, 048, 023, 039 | |
| Combat (7) | 037, 071 | 033, 044, 053, 054, 055 ⚠ | |
| Sound (3) | 013 | 015 | 014 |
| Saving and platform (4) | | 006, 072 | 002 ⚠, 005 |
| Development (1) | | 025 | |
| **Total (73)** | **14** | **52** | **7** |

What the groups share:

- **The fixed bugs are well specified**: each states the original's behaviour (with an address) and
  the port's, so a builder knows exactly what to change. IMP-067, 068, 070, 071 and IMP-034's one
  departure (prose under the bug table) are of the same kind and should move into that table.
- **Every UI IMP lacks the same four things**: where it sits (per layout), its states (enabled,
  disabled with reason, selected, pending), its input map (keys, taps, drags), and its texts. A
  typical row (IMP-056, the treasure panel) names a dozen features in one sentence and gives none of
  the four.
- **Numbers that are given**: IMP-012 (225/100 ms), IMP-021 (0.45 s), IMP-037 (0.1 s a step),
  IMP-047 (4×), IMP-060 (30 s, 44 px), IMP-008 (120 blocks). Numbers in code but not in the rows:
  the 3D view (§2.5), the slide length (180 ms), the breakpoints (§2.8), the sync debounce (in
  docs/server.md, 1.5 s).
- **"In progress" markers** on IMP-001, 002, 003, 004, 005, 007, 008, 010, 011, 012, 014, 033 do not
  say what remains, so a builder cannot tell the target from the current state.
- **Superseded rows are not marked**: IMP-004 by IMP-064, the command-bar parts of IMP-002 and
  IMP-055 by IMP-057 (§6 C7, C8).
- **Ids**: IMP-028 and IMP-031 are each used for two rows (deliberate, but a builder cannot cite one
  of them precisely); IMP-045 cites IMP-009, which does not exist; IMP-034 has no row.
- IMP-072 is the exception among the P rows: its server half is specified in `docs/server.md`
  (§2.9); only its UI half is P.

---

## 4. Port-authored data

Data the port needs that cannot be extracted from the game files. "Spec" says whether the spec
states the data or the rule that derives it.

| Data | Lives in | Spec | Note |
|---|---|---|---|
| Spell notes (one line per spell, PoR 1–56, CotAB 1–100) | `games/spellnotes.ts` | — | written from the handlers; CotAB reuses PoR's for 1–56 |
| Rules reference (basics, classes, combat, keys) | `games/rulestext.ts` | — | text, per game |
| Spell description composition | `rules/spelltext.ts` | — | from the spell record; the rule is code-only |
| Journals (PoR, CotAB) | `data/journal.json`, `data/coab-journal.json`, `public/journal/*.png` (14 scans) | P | third-party (CC BY-SA), sources credited; schema and the PoR build process unstated |
| Journal reveal patterns | `rules/journal.ts` | P | examples in IMP-055 |
| Empty-tab texts of the journal | `games/journal.ts` | — | |
| Landmark text patterns (shops, gods, places) | `games/landmarkrules.ts` | — | |
| Landmark kinds, icons and legend | `rules/landmarks.ts`, `ui/areamap.ts` | P | IMP-024 names the kinds and icons |
| Commissions panel (16 commissions: titles, entries, offer lines, summons, progress) | `rules/commissions.ts` | P | the variables are in commissions.md; the panel data is not; the offer lines are short quotations of game text used as match keys |
| Effect behaviour vocabulary (125 keys) and parameters | `rules/effectkinds.ts`, `games/effectrules.ts` | P | behaviour per type is O in effects.md; the mapping is port design |
| Item behaviours (by +0x3E & 0x7F) | `games/effectrules.ts` `items` | P | PoR 128–139 in effects.md; CotAB kinds in coab/effects §6 |
| Spell handler kinds (37) and parameters | `rules/spellkinds.ts`, `games/spellrules.ts` | P | as above |
| Engine message strings (≈190 distinct lines in `rules/`, `vm/`, `games/`, `ui/town.ts`, `ui/camp.ts`: "is silenced", "The party has won." …) | code | P | the spec quotes many of them; they are game text from START.EXE/GAME.OVR, transcribed rather than read by offset (§6 C24) |
| Monster-name lists in racial handlers | `games/effectrules.ts` | A | in effects.md with their DS addresses (DS:342 …); transcribed rather than read |
| Credits text (both games) | `games/title.ts` | A | in menus.md §1 and coab; transcribed rather than read |
| Debug jumps and finale | `games/debug.ts` | P | IMP-025 names them; positions code-only |
| Start-up/demo data | `games/startup.ts` | A | coab/ecl; strings read from START.EXE by offset |
| Ending caption offsets and steps | `games/ending.ts` | P | offsets code-only |
| View dressing (floor, ground rows and repeat, sky art) | `games/view.ts` | P | the original's placement is in coab/assets §3; rows `[32, 48]` and repeat 2 are port choices |
| 3D view constants | `render/world.ts` | — | §2.5 |
| UI labels: equipment slots, class names, facing names | `data/items.ts` `SLOTS`, `ui/explore.ts` `SLOT_NAMES`, `CLASS_NAMES`, `FACING` | — | `CLASS_NAMES` duplicates START.EXE's class table, against CLAUDE rule 1 |
| Sound: effects played in full | `audio/sfx.ts` `FULL` | ⚠ | §6 C23 |
| Storage names: IndexedDB databases and stores, localStorage keys (`poolrad.*`, `goldbox.*`), the sidecar format id | `games/*.ts` `stores`, `store/*`, `ui/*` | — | legacy `poolrad` names kept on purpose for existing data; unstated |
| Kept-file patterns, required files, markers | `games/por.ts`, `coab.ts` | P | detection order in multi-game step 1 |
| Account-name rule, reserved names, code alphabet | `server/accounts.ts` | — | §2.9 |

Two derivation rules the spec does state well: random treasure (records §Random items) and the
CotAB import (coab/records §7). Those are the pattern to follow: the spec states the procedure and
its numbers, the profile holds them, and a test checks one against the other.

---

## 5. Engine model: `GameProfile` and its modules

For each field: is its meaning, unit and source (binary address or table, or the rule) specified
in a document? Today the only complete description is the JSDoc in `web/src/games/*.ts`, which is
good (most fields cite an address) but not normative and not given to a builder.

### 5.1 Top level (`games/types.ts`)

| Field | Spec | Note |
|---|---|---|
| `id`, `name`, `folder`, `note`, `playable` | P | multi-game; README; labels only |
| `config`, `markers` | P | detection rule in multi-game step 1; values code-only (CotAB markers backed by coab/assets inventory) |
| `required`, `keep` | — | file patterns code-only |
| `stores` | — | IndexedDB names, with PoR's legacy names |
| `imageFamilies` | — | asset viewer order |
| `fields` | A | records; coab/records §2 |
| `tables` | P | §2.4 |
| `ecl` | A | ecl; coab/ecl |
| `saves` | A | savegame; coab/records |
| `rules` | P | values A, procedure shapes code-only (§5.2) |
| `journal`, `spellNotes`, `rulesText` | — | port data (§4) |
| `view` | P | values A, use in the WebGL view not |
| `title` | A | menus §1; coab/assets §7 |
| `startMenu` | A | coab/ecl |
| `sound` | A | coab/assets §8 |
| `commissions` | P | a boolean switching a PoR-only panel |
| `treasure` | A | records; coab/records §7 |
| `spells`, `effects` | P | behaviour A; vocabulary code-only |
| `landmarks` | — | §4 |
| `debug` | P | IMP-025 |
| `ending` | P | §2.4 |
| `imports` | A | coab/records §7 |

Counted per field (31): **A 8 · P 15 · — 8**.

### 5.2 `GameRules` (`games/rules.ts`): values versus procedures

| Field | Value specified | Procedure specified |
|---|---|---|
| `spells` (records, named, book, levels, class codes, `itemSpell`) | A (spells; coab/tables §3.7) | A |
| `slots` (sources, pools, `from`, `add`, wisdom, learn, doubler) | A (progression §Spell slots; coab/tables §3.5) | — as one parametric procedure |
| `extraAttacks`, `levelLimits`, `trainingCost`, `startSpells`, `raceMenu`, `components`, `ageColumns`, `clericMultis`, `chaReaction` | A | A |
| `hitPoints` (`laterDice`, `rolls`, `firstLevelMin`, `fixed`) | A (progression; coab/tables §3.4) | — as one procedure |
| `startMoney` | A | P |
| `temple` | A (town §Temple; coab/tables §3.11) | A |
| `casterTerms`, `casterGate`, `dualClass` | A (coab/tables §3.7a) | P |
| `thief` | A (progression; coab/tables §3.8) | P |
| `join` | A | A |
| `startEffects`, `paladin`, `saveCon` | A (chargen; coab/records §9; coab/tables §3.6a) | A |
| `bolt` | A (combat; coab/effects §7) | P (the five flags are defined only in JSDoc) |
| `wildBattle`, `wildField` (passes: `river`, `treesBySize`, `treesOrLogs`, `scatterTerrain`, `scatterOdds`, `finishing`; `FlagValue`, `CellDie`, `RiverCourse`) | A (combat §Wilderness; coab/combat) | — the pass vocabulary is port design |
| `mapField` (`cornerWallEnd`, `finishing`, `furnish`) | A | P |
| `clouds` (`gas`, `kill`) | A | P |
| `casting` (`lostFrom`, `miscast`, `aiFirstSlot`) | A (coab/combat §Casting) | P |

The pattern holds throughout: the **numbers** are in the spec with addresses; the **shape** that
lets one procedure serve every game (which is the point of the data-driven engine) is only in code
comments. Part B has to state each procedure once, with its parameters, and say which binary
routine each game's parameters come from.

### 5.3 The other modules

| Module | What part B must state | Today |
|---|---|---|
| `fields.ts` `CharFields` | each field: offset, size, meaning, base/current pairs, arrays and counts; the rule that code reaches fields by name | A in records + coab/records; the naming is P |
| `tables.ts` `TableMap` | each table: DS address, row size, entry format, absent marker (−1), image offset of DS | P (§2.4) |
| `ecl.ts` `EclMap` | regions, translation to canonical numbering (`canonical`, `native`, `NOWHERE`), B-view reads, the nine opcode variants, skip and operand overrides, CALL targets and sounds, the flags | A for values; the translation scheme is P (multi-game step 4) |
| `files.ts` `SaveFiles` | extensions, sizes, offsets | A |
| `spellrules.ts` `SpellRules` | kinds, `Term`, `Amount`, `Rolled`, durations, `strength` rule, `aiTarget` | P |
| `effectrules.ts` `EffectRules` | events order, area effects and radius, handlers, `removalStat`, items, `replaces`, `healBlock` | P |
| `treasure.ts` `TreasureRules` | `Pick` bands, overrides, plus, javelin, scrolls, magic | A (values), P (the `Pick` notation) |
| `view.ts` `ViewArt` | as §5.1 | P |
| `title.ts`, `ending.ts`, `startup.ts`, `sound.ts`, `debug.ts`, `imports.ts`, `journal.ts`, `landmarkrules.ts` | as §5.1 | mixed |

Also unspecified at the model level, and needed by any reimplementation that wants to be
data-driven: the **host contracts** between the rules and the screen (`Io` in `vm/engine.ts`,
`CombatUi` in `rules/combat.ts`, the effect hosts in `rules/worldfx.ts` and combat), and the
**RNG** (the engine's xorshift seeded per `Engine`; `ui/party.ts`, `ui/title.ts`, `audio/sfx.ts`
call `Math.random`). These decide whether the clean-room validations of §8 can compare outputs.

---

## 6. Cross-cutting findings

### 6.1 Front matter and conventions

- **No single-source-of-truth statement.** `spec/README.md` says the spec is "written so the game
  can be reimplemented", but the port's design lives in `IMPROVEMENTS.md`, `docs/` and code. Nothing
  says which document wins.
- **No "how to read" section**: no normative language (MUST/SHOULD), no conformance levels, no
  statement of what a conforming build must do (faithful rules, saves byte-compatible, departures
  only as listed).
- **Evidence marks are incomplete.** The README legend has Observed / Inferred / Unknown; CLAUDE.md
  has O / I / ?; the files also use **G** (the GameFAQs guide) and **Bug** without a legend entry.
- **The original and the port are mixed** in many files: `savegame.md` ("The port writes…"),
  `architecture.md` ("The browser port's new game reproduces this"), `maps.md` (IMP-007),
  `effects.md` "Port status", `coab/*` "Port" sections, `open-questions.md` "Port gaps".
- **Addresses use three notations**: Ghidra `seg:off` / `FUN_seg_off` (PoR), image offsets (CotAB),
  and DS offsets; plus ECL addresses versus byte offsets into A/B/C (`A[0x1CA]`, explained once in
  ecl.md). The front matter needs one table of notations.
- **Links**: `[[spec/name]]` Obsidian links in most files, plain Markdown links in `coab/`,
  `IMPROVEMENTS.md` and `docs/`. A builder reading files as plain Markdown cannot follow the former.
- Front matter blocks (`created`, `tags`) exist in the PoR files only.

### 6.2 Structure and numbering

- Section numbering is inconsistent: `menus.md` §0–5, `effects.md` §1–3, `sound.md` §1–8, the coab
  files numbered, the rest unnumbered. `coab/records.md` has §7 and §8 **twice** (§7 PoR → CotAB
  transfer, §8 Open, then §7 Random treasure, §8 Joining, §9); `coab/tables.md` has §3.6a after §3.8.
- Two descriptions of one routine: `FUN_10ba_0bb8` (records "Derived statistics", combat "Combat
  statistics"); `FUN_53aa_03bd` (graphics "Menu input loop", menus §0); creation (chargen "Steps",
  menus §3).
- `combat.md` is 1 258 lines covering four subjects (rules, battlefield generation, AI, visuals).
- Data dumps inside the spec (ITEMS table, random-item array, credits, code-wheel words, chargen
  tables) duplicate what the files hold. They are valuable as **expected values** for validation and
  should become informative appendices, not normative text.

### 6.3 Terminology

Terms used without a glossary, or several ways: *affects* / *effects*; *area* / *record* / *ECL
record* / *block*; *map area* / *wilderness* / *overland* / *area kind* (`DS:49FA`); *current
character*; *party list* (which holds monsters too); *in play* (char[0x10D]); *the port* / *the
browser port* / *GoldBox Rerolled*; *departure* / *improvement* / *IMP*; *profile* / *configuration*;
*behaviour* / *handler* / *kind* (three words for the vocabulary entries of effects, items and
spells).

### 6.4 Contradictions (each checked)

| # | Where | What |
|---|---|---|
| C1 | `progression.md` "Combat experience" vs `combat.md` Aftermath | progression has money experience "(**?** exact rates)", "at most 8 such drops", "(**?** split rule)"; combat gives integer rates, an 8-item cap counting every item taken, and the Award table. Already listed as open-questions 12a, still unfixed |
| C2 | `savegame.md` Loading step 7 vs `menus.md` §2 Actions | savegame: "Begin sets `DS:49F8` = 1"; menus: a successful Load returns at once with 49F8 = 1, "corrects spec/savegame step 7". savegame was not corrected |
| C3 | `maps.md` 3D view renderer vs `maps.md` Overhead map | "When `DS:6AAC` ≠ 0 a different view (`FUN_55a0_0000`) … (**?**, possibly wilderness/dark)" against "Overhead map (O, `FUN_55a0_0000`)" in the same file |
| C4 | `ecl.md` Engine registers vs `maps.md` Background colours | ecl: 0xC059, 0xC05F "two display parameters (**?**)"; maps: the floor and horizon registers (O) |
| C5 | `graphics.md` and `maps.md` "Still to decode" vs their own bodies | graphics: "How WALLDEF tables index 8X8D tiles" (answered in maps §Wall pieces, §Tile bank); maps: background drawing and the alternate view (answered in the same file) |
| C6 | `records.md` vs `combat.md` | records says combat's step 4 misnames the weapon routine; combat now names `FUN_10ba_0000` correctly. The cross-reference and open-questions' item on it are stale; the routine is described twice |
| C7 | IMP-002, IMP-055 vs IMP-057 and `ui/explore.ts` | "Save in the command bar", "A Journal on the command bar"; IMP-057 and the code put both behind ☰ (the bar holds Area, Encamp, Search, Look, ☰) |
| C8 | IMP-004 vs IMP-064; `ui/explore.ts` header | IMP-004: party to the right, map beside the roster; IMP-064: party cards in a row across the top by default. The explore header still says "party roster to its right" |
| C9 | IMP-007 vs `render/world.ts`, `maps.md` | "a sky colour, a grey floor"; the code uses the original's floor and sky colours (registers 0xC059/0xC05F, `DS:0C26`), or CotAB's ground picture (IMP-069) |
| C10 | IMP-046 vs `ui/settings.ts` | IMP-046 lists speed, sound, font, text size, graphics; the panel also has Borders (IMP-051), Party (IMP-064) and Motion (IMP-057) |
| C11 | `docs/requirements.md` vs code | GOG `.pkg` import (not implemented: folder or files only); `web/src/engine/` (no such directory); "Random numbers come from one seedable generator; inputs can be recorded and replayed" (`Math.random` in creation, title, sound; no record/replay); "synthesised until the PC-speaker data is decoded" (decoded, IMP-013) |
| C12 | `combat.md` Dice vs the validation goal | "exact sequence reproduction is not required": right for faithfulness, but it leaves seeded comparisons undefined (§6.7 D2) |
| C13 | `open-questions.md` vs the spec | resolved but listed open: the name-word numbering (records now has 162–166, 167, 201–203); "menus and architecture still say type STING" (both now say J only); the scroll test appears twice (line 43 open, line 65 answered) |
| C14 | `docs/multi-game.md` "Not yet" vs code | implemented but listed as not done: paladin and ranger Add checks (`R.join`, `rules/joining.ts`), CotAB DAMAGE flag 0x10 (`ecl.damageDespiteSave`), CotAB random treasure (`COAB_TREASURE`), B+0xC9 and the load-past-end flag (`COAB_ECL.viewReads`, `loadPastEnd`), the sun and clouds (`COAB_VIEW.skyArt`), CotAB's Rules reference and ending (`COAB_RULES_TEXT`, `COAB_ENDING`), area breaths and eye rays (`rules/specials.ts`). `spec/coab/README.md` also still lists the Add checks as open |
| C15 | `coab/tables.md` §2 "hc" column and §4 item 6 | CLASS_BITS, TRAINER_BITS, SKY, temple names and others marked "the port hard-codes"; they are read through `T` now |
| C16 | `spec/README.md` versions | combat "v0.3" while open-questions calls it v0.6; menus and architecture "v0.1" though detailed; no versioning rule |
| C17 | dangling references | `store/records.ts` and `store/sync.ts` cite docs/server.md "Records" and "Sync" (headings are "What syncs", "Sync rules"); `tools/coab/ecl_coab.py` says "see ecl.md next to this file" (it is `spec/coab/ecl.md`) |
| C18 | `IMPROVEMENTS.md` ids | IMP-045 cites IMP-009 (undefined); IMP-034 has no row |
| C19 | "Open" sections vs bodies | combat "Still open: spell targeting and area templates (`FUN_3aae_20c3`)" against combat "Spell targets (O, `FUN_3aae_20c3`)"; progression "Open: STR/DEX to-hit, damage and AC adjustments" against combat "Ability adjustments (O)" |
| C20 | `menus.md` §5 | "Corrections and additions to the existing specs": applied (chargen now says no racial adjustment, etc.), still written as a to-do list |
| C21 | `coab/records.md` | duplicate section numbers (§6.2) |
| C22 | `docs/server.md` "What syncs" vs `store/account.ts` | settings are kept "per game" on the server, but the browser keys (`poolrad.sound` …) are shared by every game, so pulling one game's settings changes all games in that browser. Intended or not, neither document says |
| C23 | `sound.md` §6 vs `audio/sfx.ts` | full-length playback by call site in the original, by effect number in the port; not in IMPROVEMENTS. To check whether the listed effects are ever played outside those sections (if so, an unlogged departure) |
| C24 | CLAUDE rules 1 and 4 vs `games/title.ts`, `rules/*`, `games/effectrules.ts` | the start-up menu and ending read their text from START.EXE/GAME.OVR by offset; the credits, the monster-name lists and ≈190 engine messages are transcribed into code. A decision is needed (§6.7 D1) |

### 6.5 Stale statements (not contradictions, but no longer true)

- **S1** `spec/README.md` external reference: the guide is cited as v1.50 (2021) and v2.00 in the
  same paragraph.
- **S2** `docs/requirements.md` delivery order and "Testing" ("Comparison of scripted walks with the
  original in DOSBox (still to set up)"): still true, but nothing in the plan says when.
- **S3** `open-questions.md` "Port gaps from the 2026-10-17 audit" is an audit log, not a question.
- **S4** `docs/multi-game.md` step log: see C14; the "Plan, in order" still lists "the PoR ending
  procedure" and "named ids for effect types" (both still true: `ending.por`, effect type numbers in
  `rules/specials.ts`, `effectkinds.ts` effectiveStat, temple, combat).
- **S5** `coab/tables.md` §2/§4: see C15.
- **S6** `IMPROVEMENTS.md`: the "In progress" markers (§3).
- **S7** `web/README.md` "Current state" and root README "Status": both say nothing has been
  compared with DOSBox; correct, but the CotAB status sentence repeats in three places
  (README, web/README, multi-game).
- **S8** `menus.md` §5: see C20.
- **S9** `ui/explore.ts` header: see C8.
- **S10** `spec/README.md` version column: see C16.
- **S11** `data/spells.ts`: class codes comment is PoR's only.
- **S12** `tools/coab/ecl_coab.py`, `records_coab.py`: default paths `/home/tmg/coab-files`.

### 6.6 Open questions still open

`open-questions.md` lists 38 items; 8 are struck through; of the 30 others at least 6 are answered
elsewhere (C13, C19). The live ones that matter for a rebuild, by area:

- **Rules** (a port must pick a behaviour, and the spec should say which the port picked): effect 7's
  HP recalculation (approximate), the uninitialised first random-item type (the spec says the port
  "must pick a rule"; which it picked is code-only), stack Sell price and the vanishing NPC share
  (DOSBox checks), ammunition round-start formula (summarised only), the shop/temple "Pool" key
  condition, Appraise Escape.
- **Script VM**: 0x035F, the `88 13` prefix, odd operand kinds at two addresses, GEO 31's exit (all
  harmless; the port's choices are in code).
- **Original bugs a port must decide on** (camp and training list): decided by IMP-028 for one of
  four; the other three (Train truncation, ageing after 256 years, clock normalisation) are kept as
  the original, which the spec should say.
- **CotAB** (`coab/README`, `coab/ecl`, `coab/assets`, `coab/records` Open): mostly variable
  meanings; the Add checks item is answered (C14).
- About 81 **?** and 111 **I** marks remain across the spec. Each I that the port implements is a
  place where a clean-room builder and the reference may legitimately differ; part A should make the
  port's choice explicit next to each.

### 6.7 Decisions needed before writing

| # | Decision | Options |
|---|---|---|
| D1 | Game text in code (credits, monster names, ≈190 engine messages) | (a) read every string by offset, with a strings table per game in the profile and the spec listing ids and offsets; (b) accept the quotations as normative text in the spec. (a) matches CLAUDE rules 1 and 4 and what ending/start-up already do |
| D2 | RNG and seeded comparisons | (a) specify the port's RNG (xorshift32, `rand(n) = floor(u·n)`) and the order of draws; (b) specify a **dice tape**: every random draw goes through one injectable `roll`/`rand`, and validations feed an explicit sequence (the tests already do this: `coabspells`, `wildfield`, `randitem`). (b) is RNG-independent and matches the original's order of draws |
| D3 | Link style | Obsidian `[[…]]` or plain relative Markdown links (a builder reads plain Markdown) |
| D4 | What is normative in part C | the full UI (layouts, states, texts) or a behavioural contract (what must be reachable, what each screen shows, inputs) with presentation left free. Compunet chose a contract plus a conformance checklist for the details that are "load-bearing" |
| D5 | Data dumps in part A | normative tables or informative "expected values" appendices |
| D6 | The 3D view | specify the WebGL view as built (camera, geometry, light) or specify the original pre-drawn view (fully O in maps.md, pixel-comparable with DOSBox) as the conformance target and the WebGL view as a permitted presentation |

### 6.8 Decisions (taken 2026-10-21)

Tristan's decisions on §6.7 and on the two flagged findings. Where they set policy they are also
stated in the spec's front matter ([README.md](README.md), "How to read this spec").

| # | Decision |
|---|---|
| D1 | **Game text** that is in the game files is read from them by address, as the ending and the start-up menu already are. Strings copied into the code are to be replaced (a later code task); the spec gives addresses, not copies ([D-appendices/strings.md](D-appendices/strings.md)). |
| D2 | **Randomness**: the spec defines dice as an injected source, the **dice tape** (the sequence of (count, sides) requests and their results), so builds are comparable roll for roll. The engine's own RNG is informative. |
| D3 | **Links**: plain Markdown links `[text](file.md#anchor)` everywhere; every `[[wikilink]]` is converted. |
| D4 | **User interface**: normative is the behaviour contract (every screen, its states, controls and keys, texts, what each does, and its layout described in words per screen class); exact CSS and pixels are informative; [CONFORMANCE.md](CONFORMANCE.md) covers the look. |
| D5 | **Data**: values extractable from the game files go in informative appendices, with their addresses as the normative part; values that cannot be extracted (port-authored) are normative. |
| D6 | **3D view**: the original's drawn view is the normative conformance target (pixel-exact); the port's WebGL, upscaled rendering is an optional enhancement checked within a tolerance. |
| C23 | **Ruling**: sound effects follow the original, by call site as [sound.md](A-games/engine/sound.md) §6 says. To verify and fix in a later code task. |
| C24 | **Ruling**: the copied engine messages, credits and monster-name lists are read from the game files by address (D1). A later code task. |

### 6.9 State after work-plan step 1 (2026-10-21)

**Where the files went** (all renames with `git mv`, so `git log --follow` works):

| Was | Now |
|---|---|
| `spec/README.md` | rewritten as the front matter; PoR's identity and the guide reference → `A-games/por/README.md` |
| `containers`, `graphics`, `records`, `savegame`, `ecl`, `sound`, `spells`, `effects`, `town`, `overland` | `A-games/engine/` (same names) |
| `maps.md`, `camp.md` | `A-games/engine/maps-and-view.md`, `camp-and-time.md` |
| `architecture.md` | `A-games/engine/main-loop.md`; its party-screen summary and cheat keys → `input-and-menus.md` §2; the ending → `A-games/por/ending.md` |
| `menus.md` | `A-games/engine/input-and-menus.md` (§0–2; §4 is now §3); §3 creation → `chargen-and-progression.md`; credits and code wheel → `A-games/por/title-and-credits.md`; §5 dropped |
| `chargen.md`, `progression.md` | `A-games/engine/chargen-and-progression.md` (one creation sequence) |
| `combat.md` | `A-games/engine/combat-rules.md`, `battlefield.md`, `combat-ai.md`, `combat-visuals.md` |
| `commissions.md` | `A-games/por/commissions.md` |
| `coab/*.md` | `A-games/coab/*.md` |
| `open-questions.md` | unchanged (the register; answered items struck with where) |

Duplicates merged: `FUN_10ba_0bb8` (kept in records), `FUN_53aa_03bd` (kept in input-and-menus §0),
creation (one sequence), the AI target finder `FUN_3aae_37e4` (kept in combat-ai).

**Contradictions and stale statements (§6.4).** Fixed in the documents, each checked against the
code or the spec's own observed sections:

| # | Fix |
|---|---|
| C1 | chargen-and-progression "Combat experience" now points to combat-rules "Experience" and "Award" |
| C2 | savegame "Loading" step 7: a successful Load returns from the party screen at once with `DS:49F8` = 1 |
| C3 | maps-and-view: the view drawn while `DS:6AAC` is set is the overhead map |
| C4 | ecl "Engine registers": 0xC059/0xC05F are the floor and horizon colour registers |
| C5 | graphics and maps-and-view "Still to decode": answered items removed (maps-and-view now has an "Open" block) |
| C6 | records no longer refers to combat's summary, which is gone |
| C7 | IMP-002 and IMP-055: Save and Journal are in the ☰ menu (checked in `ui/explore.ts`) |
| C8 | IMP-004 marked superseded by IMP-064 and IMP-060; the `ui/explore.ts` header describes IMP-064 |
| C9 | IMP-007: the original's sky and floor colours, not "a sky colour, a grey floor" (checked in `render/world.ts`) |
| C10 | IMP-046 lists every setting of `ui/settings.ts` (borders, party layout, motion, account added) |
| C11 | requirements.md: `.pkg` import not implemented, the architecture sketch marked as the original plan, randomness per D2 with what is not yet there, the sound sentence |
| C12 | combat-rules "Dice": the injected dice source and the order of requests (D2) |
| C13 | open-questions: the name-word numbering, "type STING" and the scroll test struck as answered |
| C14 | multi-game.md: the "Not yet" items since done are marked with where they are; coab/README's Add-check question struck |
| C15 | coab/tables §2 and §4: tables now read through `T` are marked so; "hc" kept only where the code still hard-codes |
| C16 | the per-file version column is gone with the new README |
| C17 | `tools/coab/ecl_coab.py` and `records_coab.py` point to `spec/A-games/coab/` |
| C18 | IMP-045 cites IMP-061 (not the undefined IMP-009); IMP-034's departure has its own row |
| C19 | combat-rules "Open" and chargen-and-progression "Open": the answered items removed, with where they are answered |
| C20 | menus §5 dropped (every item was applied) |
| C21 | coab/records renumbered: §8 random treasure, §9 joining, §10 creation effects and paladin abilities, §11 Open (references updated); coab/tables §3.6a moved after §3.6 |
| S1 | the guide is cited once, as v2.00 (`A-games/por/README.md`) |
| S3 | open-questions' 2026-10-17 audit log marked as a record that moves to VALIDATION.md |

Still open:

| # | Why | Decision |
|---|---|---|
| C17 (part) | `web/src/store/records.ts` and `store/sync.ts` cite docs/server.md headings "Records" and "Sync" that do not exist ("What syncs", "Sync rules") | a code-comment fix, for a later code task |
| C22 | docs/server.md now states the behaviour (settings per game on the server, one set of browser keys for every game); whether it is intended is not decided | for part C storage and sync (work-plan step 3) |
| C23 | the port cuts effects off by effect number, the original by call site | ruling §6.8: follow the original; verify and fix in a code task |
| C24 | credits, monster-name lists and about 190 engine messages copied into code | ruling §6.8 (D1): read by address; a code task, with [D-appendices/strings.md](D-appendices/strings.md) |
| S2, S4, S6, S7 | project status (DOSBox comparison not set up, the multi-game plan, "In progress" markers without what remains, the repeated CotAB status sentence) | for the part C writing (step 4) and the project notes |
| S11, S12 | `data/spells.ts` class-code comment (PoR only); default paths in `tools/coab/` | code tasks |
| §6.6 | open questions that need research (effect 7's HP recalculation, DOSBox checks, the ECL loose ends, Alt-X during AI turns) | stay in [open-questions.md](open-questions.md) and the per-file "Open" blocks |

**Work-plan step 3 (2026-10-21): part C storage, accounts and sync, offline app, overview.**
[C-port/storage.md](C-port/storage.md), [accounts-and-sync.md](C-port/accounts-and-sync.md),
[pwa-and-build.md](C-port/pwa-and-build.md) and [overview.md](C-port/overview.md) are written from
the code. The contract text of `docs/server.md` (design, what syncs, sync rules, API, validation,
data layout, security model, configuration) moved into accounts-and-sync.md, checked against
`server/` and `web/src/store/`; `docs/server.md` is now the operator's guide and points to the spec.

| # | Resolution |
|---|---|
| C17 (rest) | `web/src/store/records.ts` cites accounts-and-sync.md §1.2–1.3, `store/sync.ts` §5 (comment-only change) |
| C22 | the behaviour is the specification: one set of `poolrad.*` keys for every game in the browser, one settings record per game on the server, and the settings merged last apply to every game ([storage.md §8](C-port/storage.md#8-localstorage-keys), [accounts-and-sync.md §5.9](C-port/accounts-and-sync.md#59-settings)) |

Found while writing (code, `docs/server.md` and the spec compared; numbered SY to keep them apart
from the C and S series):

| # | Where | What | Next |
|---|---|---|---|
| SY1 | `server/app.ts`, `accounts.ts`, `web/src/store/api.ts`, `account.ts`, `web/vite.config.ts` | their comments cite `docs/server.md` sections now in the spec ("API", "Security model"; `app.ts` also "Rate limits", a heading that never existed). `storage.ts`, `config.ts`, `admin.ts`, the Dockerfile and the systemd unit cite sections that remain | comment-only fix: point them at accounts-and-sync.md §2, §3, §3.6 **Resolved 2026-10-21:** the comments cite accounts-and-sync.md sections |
| SY2 | `server/app.ts` `setCookie` vs old `docs/server.md` "30 days, renewed by use" | the server renews a session's expiry by use, but the cookie's `Max-Age` is sent only at sign-in, so the browser drops the cookie one lifetime after sign-in however active the player is | decide: send the cookie again on renewal, or call sessions fixed-length; specified as is (accounts-and-sync.md §3.3) **Resolved 2026-10-21:** the cookie is sent again on renewal (`Accounts.session(token, renewed)`), test in server.test.ts |
| SY3 | §2.9 `accounts.ts` row; the accounts-and-sync stub | "NFKC normalisation" was listed under the account-name rule: names are only trimmed and lower-cased; NFKC is applied to passwords before hashing | spec states the code (§3.1, §3.2) |
| SY4 | old `docs/server.md` | recovery and invite codes were "stored as their SHA-256": it is the SHA-256 of `goldbox-code:` + the normalised code. The "16 KB of metadata" is 16 384 characters of `JSON.stringify` (UTF-16 units); the password minimum counts code points, the maximum (256) UTF-16 units | spec states the code |
| SY5 | `server/storage.ts` vs the client | the `docs` id `journal` is accepted and listed but never written by the client (journal finds travel in each save's `.GBR`); the old data layout listed only `party.json` and `settings.json` | kept, marked unused (accounts-and-sync.md §1.3) |
| SY6 | `web/src/store/user.ts` `writeAutosave` comment | "written on area changes and before battles": the code writes after actions, on an area change or after 30 s, not before battles (IMP-060 matches the code) | comment-only fix |
| SY7 | IMP-073 vs `main.ts`, `ui/settings.ts` | IMP-073 (the party screen) says "the page foot shows the running version": it is at the foot of the games screen and in Settings, not on the party screen | IMPROVEMENTS.md wording |
| SY8 | `ui/party.ts` export | the export ZIP is named `poolrad-save-<x>.zip` for every game, like PoR's database names | specified as is (storage.md §7.1); a per-game name would be a change |
| SY9 | export vs records vs the original | the export always writes the item and effect files (empty when there are none), a server record leaves absent ones out, and the original's roster write deletes empty ones ([input-and-menus.md §2.2](A-games/engine/input-and-menus.md#22-character-files-o-fun_45c5_069e-fun_1802_0425)); every reader reads to the end of the file, so all three load the same | specified (storage.md §7.1, accounts-and-sync.md §1.3) |
| SY10 | `web/src/store/savefiles.ts` vs `server/zip.ts` | the browser's ZIP writer sets no flags, the server's the UTF-8 flag `0x0800`; harmless, the names are ASCII | specified (storage.md §7.3) |
| SY11 | `server/storage.ts` `put` | a write for an account deleted while the request ran answers 507 `too many records` | specified (accounts-and-sync.md §2.5) |
| SY12 | `A-games/engine/savegame.md` "Files", last paragraph | a port statement (the `.GBR` sidecar on export) in part A; its contract is now storage.md §6 | for the step 5 clean-up of part A |

**Work-plan step 2 (2026-10-21): part B, the engine model.** Every file of [B-model/](B-model/) is
written from `web/src/games/`, `rules/`, `vm/engine.ts` and `store/gamefiles.ts`, checked against
part A: [profile.md](B-model/profile.md), [records-and-tables.md](B-model/records-and-tables.md),
[script-vm-map.md](B-model/script-vm-map.md), [procedures.md](B-model/procedures.md),
[vocabularies.md](B-model/vocabularies.md) (with both games' handler maps, generated from the
profiles), [host-contracts.md](B-model/host-contracts.md), [files-and-detection.md](B-model/files-and-detection.md),
[adding-a-game.md](B-model/adding-a-game.md); the port-authored data in
[D-appendices/port-data.md](D-appendices/port-data.md), part B's routines in
[D-appendices/addresses.md](D-appendices/addresses.md). Moved out of part A into part B, each leaving
a link: engine/effects.md "Port status", coab/effects.md "Port status", coab/spells.md "Port status"
(→ vocabularies.md §8), the two "Port" sections of coab/combat.md (→ procedures.md §17),
coab/tables.md §4 (→ records-and-tables.md §5), coab/assets.md §9 (→ profile.md §4.1). The design
sections of `docs/multi-game.md` ("The game profile", "Records stay native", "Rules as data first",
"Where a game is described", "Adding a game") are now in part B; that note can point there.

Found while writing (numbered EM, engine model):

| # | Where | What | Next |
|---|---|---|---|
| EM1 | `ui/party.ts` (character creation on the party screen) | uses `Math.random` for gameplay draws (abilities, gold, hit points), against D2; the training hall's creation uses the engine's generator | code task: creation takes its dice from the engine's source ([host-contracts.md §6.2](B-model/host-contracts.md#62-where-the-dice-are-rolled)) |
| EM2 | `vm/engine.ts` `rand(n)` | RANDOM, a new NPC's id, appraisal's jewels and the debug editor draw from the generator directly, not through `roll`, so a tape recorded at `roll` misses them | code task: `rand(n)` as the request (1, n) − 1 |
| EM3 | host-contracts.md §6.4, §8 | the dice-tape format and the headless transcript are specified; the reference implementation records and replays neither (its tests replace `roll` with scripted dice) | code and tools task, before the V3/V5 validations |
| EM4 | `vm/engine.ts` `addNpc` vs [coab/ecl.md](A-games/coab/ecl.md#opcodes) ADD_NPC | the port puts monster id 0x18 on the enemy side and rolls the class pick for the random portrait in every game; CotAB's ADD_NPC has neither ("PoR's enemy side for id 0x18 is gone"), so CotAB's dice tape gains a draw | code task: both as profile data ([adding-a-game.md §4](B-model/adding-a-game.md#4-what-is-still-a-paired-procedure)) |
| EM5 | `rules/combat.ts` movement vs [coab/combat.md, "Cell table"](A-games/coab/combat.md#cell-table-o-ds26a4-4-bytes-a-cell) | CotAB's battlefield cells cost 1, 2 or 4 to enter (byte 0); the port treats every cell other than 0xFF as an ordinary step in both games; coab/tables.md §3.12 left it to "the move code" | research (CotAB's move routine) and a code task: the cost as a procedure parameter |
| EM6 | coab/tables.md §3.7a, §3.8 | stale port statements: the Ring of Wizardry "not yet in the port" (it is `rules.slots.doubler` and item kind 1) and the thief item hooks "need the items passed (later)" (they are the item behaviour `recomputeStats` with `thief`) | for the step 5 clean-up of part A |
| EM7 | the moved coab/effects.md "Port status" | stale: "the three spell handlers that use the template are not ported" (they are 84, 92, 98: `scare`, `beam`) and "the ECL DAMAGE save does not set DS:6FC2" (it does); annotated where the notes now stand (vocabularies.md §8.2) | none further |
| EM8 | `games/rules.ts` | the doc comment of `saveCon` stands above `join`, and the CotAB `saveCon` value's comment above `join`'s value | comment-only fix |
| EM9 | `vm/engine.ts` DIVIDE | PoR's DIVIDE stops on a divisor of 0 (run-time error 200, as the original), CotAB's `divideRemainder` variant writes 0 and 0; no shipped script divides by 0 | none needed; stated in script-vm-map.md §5.1 |
| EM10 | `games/fields.ts`, `tables.ts`, `rules.ts`, `effectrules.ts`, `spellrules.ts` | the JSDoc in these modules was the only description of the profile schema; it now duplicates part B | when code is next touched, the comments can cite part B sections instead of restating them |

---

## 7. Proposed target structure

```
spec/
  README.md          front matter: scope, single source of truth, how to read, MUST/SHOULD,
                     evidence marks (O, I, ?, G, Bug), notations, conformance levels, file map
  CONFORMANCE.md     self-audit for a finished build: the load-bearing details (party screen
                     groups, command bar contents, autosave rules, save byte-compatibility …)
  CLEANROOM.md       how to run an isolated build: the file set, the brief, the game files, the harness
  VALIDATION.md      the record: cross-checks against the binaries (from ecl.md "Validation"), test
                     suites, clean-room runs and their findings, residual gaps
  xref.md            spec section → reference implementation location (kept out of clean-room sets)
  AUDIT.md           this file, retired after the restructure
  A-games/           Part A: the original games, normative
    engine/          the Gold Box engine as PoR defines it
      containers, graphics, maps-and-view, records, savegame, ecl, main-loop, input-and-menus,
      chargen-and-progression, camp-and-time, town, overland, combat-rules, battlefield,
      combat-ai, combat-visuals, spells, effects, sound
    por/             PoR identity (hashes, DS, segments), title and credits, commissions,
                     proclamations, tile wilderness, ending, scenario variables
    coab/            the existing diff files (ecl, records, tables, spells, effects, combat, assets)
  B-model/           Part B: the engine model
    profile          GameProfile field by field: meaning, unit, source (§5)
    records-and-tables   field maps, table maps, absent tables
    script-vm-map    regions, canonical numbering, view reads, opcode variants
    procedures       each parametric procedure once (slots, hit points, money, casting, bolt, clouds,
                     wilderness passes, map fields, treasure picks) with each game's source routine
    vocabularies     effect behaviours, item behaviours, spell kinds, monster specials
    host-contracts   Io, CombatUi, effect hosts; randomness (D2); the headless harness
    files-and-detection  kept files, required set, markers, stores
    adding-a-game    the method (from CLAUDE.md "Method for a new game" and multi-game "Adding a game")
  C-port/            Part C: GoldBox Rerolled
    overview         requirements R1–R7, constraints, conformance (from requirements.md)
    app-flow         games screen, import, title, party screen, play, demo, ending, game over
    ui-contract      layouts and breakpoints, panels, command bar, ☰, keys/touch/drag, the text log
    screens          creation, sheet, shop, treasure, temple, camp, memorize, rest, commissions,
                     journal, rules reference, settings, debug: each IMP's states, inputs, texts
    exploration-view the 3D view (D6), sprites, slides, wilderness view, area map, landmarks
    combat-ui        battle screen, live movement, planner, aim, cards and badges
    rendering        pixel scaling, frames, font as TTF, icons, palette tokens
    audio            device choice, cut-off rule, Tandy
    storage          IndexedDB schema, localStorage keys, .GBR sidecar, ZIP export/import,
                     roster seeding, autosave
    accounts-and-sync   API, records and meta, merge rules, data layout, security, configuration
                     (from docs/server.md)
    pwa-and-build    manifest, service worker, single-file build, version line
    departures       the IMP register: each id → its section (IMPROVEMENTS.md points here)
  D-appendices/
    addresses        index of routines and tables, both games
    strings          message ids → offsets per game (if D1 a)
    port-data        spell notes, rules text, landmark patterns, commissions panel, debug jumps, labels
    expected-values  ITEMS, random items, chargen tables, credits (informative, for validation)
    glossary
    test-vectors     dice tapes and their expected outputs
```

### 7.1 Where the existing files go

| Existing | Target |
|---|---|
| `README.md` | `README.md` (rewritten front matter) |
| `containers.md`, `graphics.md`, `maps.md`, `records.md`, `savegame.md`, `ecl.md`, `sound.md`, `spells.md`, `effects.md`, `camp.md`, `town.md`, `overland.md` | `A-games/engine/` (same names), port statements moved to C |
| `architecture.md` | `A-games/engine/main-loop`; party screen → `input-and-menus`; ending → `A-games/por/` |
| `menus.md` | `A-games/engine/input-and-menus` (§0–2, §4), creation §3 merged into `chargen-and-progression`; credits and code wheel → `A-games/por/`; §5 dropped |
| `chargen.md`, `progression.md` | `A-games/engine/chargen-and-progression` |
| `combat.md` | split: `combat-rules`, `battlefield`, `combat-ai`, `combat-visuals` |
| `commissions.md` | `A-games/por/commissions` |
| `open-questions.md` | per-section Open blocks + a register in `VALIDATION.md` |
| `coab/*.md` | `A-games/coab/`; "Port" sections and `tables.md` §4 → B |
| `docs/multi-game.md` design sections | `B-model/` |
| `docs/requirements.md` R1–R7 | `C-port/overview` |
| `docs/server.md` (design to configuration) | `C-port/accounts-and-sync` |
| `IMPROVEMENTS.md` rows | `C-port/` sections; the register stays at the root and points into C |
| JSDoc in `web/src/games/*.ts` | `B-model/` |

---

## 8. Work plan

Ordered so that each step can be validated before the next. Sizes are rough line counts of new or
moved text.

| # | Step | Size | Depends on |
|---|---|---|---|
| 0 | Decide D1–D6 (§6.7) | one session | — |
| 1 | Skeleton: new front matter, directory layout, files moved without content changes, links converted (D3), the §6.4 contradictions C1–C6, C13, C15, C19–C21 fixed in place | 300 new, ≈7 000 moved | 0 |
| 2 | **Part B** (highest value: today code-only): profile schema, procedures, vocabularies, host contracts with the randomness rule (D2) | 1 200–1 800 | 1 |
| 3 | **Part C storage and sync**: mostly folding `docs/server.md`, plus the IndexedDB schema, keys, `.GBR`, ZIP, the missing account rules | 500 (300 folded) | 1 |
| 4 | **Part C UI** (largest new writing): app flow, UI contract, screens, combat UI, rendering, exploration view (D4, D6); every IMP given its states, inputs and texts | 2 000–3 000 | 1, 2 |
| 5 | Part A clean-up: dedupe (records/combat statistics, chargen/menus, the menu loop), split combat, move port statements out, mark each **I** the port implements with its choice, data dumps to appendices (D5), strings (D1) | 800 changed | 1 |
| 6 | Appendices: addresses, strings, port data, expected values, glossary, test vectors | 600 | 2, 5 |
| 7 | `CONFORMANCE.md`, `CLEANROOM.md`, `VALIDATION.md`, `xref.md` | 500 | 2–6 |
| 8 | Clean-room runs (below), findings folded back, repeated after each large change | per run | 7 |

Part B comes first because it is the part only the code knows, and because parts A and C both
refer to it (a rule in A names a procedure in B; a screen in C reads a profile field).

### 8.1 Clean-room validations that are practical

The builder gets the spec set (`README`, parts A–D, `CONFORMANCE.md`) and the **game files**
(`POOLRAD`, `CURSE`), which the spec does not duplicate, and nothing else: no `web/`, `server/`,
`tools/` (the Python tools are reference implementations), `docs/`, `VALIDATION.md`, `xref.md` or
this file. Each validation compares the build's output with the reference implementation's on the
same input.

| # | Validation | Input | Compare | Golden from |
|---|---|---|---|---|
| V1 | Decoders | every DAX record, START.EXE, GAME.OVR | decoded sizes and SHA-256 of decoded records, unpacked image, merged overlays | `web/test/decoders.test.ts`, `tools/` |
| V2 | Save round trip | `SAVGAMA.DAT` + `CHRDATA1–6` (both games) | byte-identical write-back except the never-read bytes | `savefiles.test.ts` |
| V3 | Load a save and run a script headless | a save, an area, a square, menu answers | the transcript: text lines, menus offered, variable writes, area changes | the reference engine through a small CLI around `vm/engine.ts` (and `tools/eclvm.py`) |
| V4 | Script sweep | every area, every square (PoR), every third (CotAB) | no interpreter errors; same list of looping runs | `engine.test.ts`, `coabsweep.test.ts` |
| V5 | Seeded battle | combatants from a save and a monster record, a **dice tape** (D2) | the event log: initiative, attacks, rolls, damage, statuses, morale, experience | `combat.test.ts` style, with the tape |
| V6 | Battlefield generation | GEO + position, or terrain flags, and a dice tape | the 25 × 50 cell grid | `battlefield.test.ts`, `wildfield.test.ts`, `mapfield.test.ts` |
| V7 | Random treasure | a `TREASURE` operand and a dice tape | the 63-byte records | `randitem.test.ts`, `coabtreasure.test.ts`, `tools/randitem.py` |
| V8 | Sound | effect n, device | PCM samples, sample for sample | `sound.test.ts`, `tools/sound.py` |
| V9 | One 3D view frame | GEO, wall sets, position, facing, time | for the original view (maps.md): exact 88 × 88 pixels; for the WebGL view: a tolerance (structural similarity) against a reference render | new: a render harness for each |
| V10 | Profile from the spec | `spec/` and the CotAB files | the builder writes CotAB's profile; diff against `games/coab.ts` values | `fields`, `tables`, `eclmap`, `spellmap`, `effectmap` tests run on the builder's profile |
| V11 | Server from the spec | `C-port/accounts-and-sync` | run the existing `server.test.ts` and `sync.test.ts` black-box against the clean-room server | the tests (they talk HTTP to a real server) |
| V12 | Server API client | the same section and the reference server (API only, no static files) | sign up, push, pull, conflict, export, against `server/` | `sync.test.ts` scenarios |
| V13 | Visual build | parts C and A | a person goes through `CONFORMANCE.md` with the build running | — |

**Golden outputs** contain game data (decoded records, text), so they cannot be committed. Proposed:
a `web/tools/golden.ts` CLI (or vitest mode) that writes them from the player's files into a local
folder, and a committed **manifest of hashes** per case, so a run can be checked without the data
leaving the machine. V3, V5–V7 need the dice tape and a transcript format; both belong in part B
(host contracts) so the builder produces them in the same form.

V11 is the cheapest strong test (the suites exist and are black-box), V3 and V5 are the most
valuable (they exercise most of part A through part B), V13 is the only check of part C's UI that
does not depend on a harness.

---

*End of the Phase 1 audit.*
