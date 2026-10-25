---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Departures from the original

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative**: the list of the
port's departures from the original games. [IMPROVEMENTS.md](../../IMPROVEMENTS.md) stays the
**register** (ids are stable; the code cites them); this file maps each id to the section of the spec
that now specifies it, says how binding it is, and names the setting that changes it. A conforming
build departs from part A exactly as listed here, and in no other way
([overview.md, "Conformance for part C"](overview.md#conformance-for-part-c)).

**Level**: **required**: a conforming build does it as specified; **optional**: a build MAY do it (and
then as specified); **setting**: required, with a setting as listed. **Status** is the reference
implementation's: *done*, or what remains.

## 1. Original bugs fixed

| Id | Specified in | Level | Status |
|---|---|---|---|
| IMP-028 (payment) | [town.md, "Money"](../A-games/engine/town.md#money-o-overlay-4c2d-fun_4894_28be); [screens.md §5](screens.md#5-shops-and-temples) | required | done; a switch back to the original is planned |
| IMP-028 (appraisal keep) | [town.md, "Appraise"](../A-games/engine/town.md#appraise-o-fun_4c2d_19b2); [screens.md §5.4](screens.md#54-take-pool-share-appraise) | required | done, as above |
| IMP-028 (max HP 1) | [chargen-and-progression.md, "Training"](../A-games/engine/chargen-and-progression.md#training-o-fun_417f_29ae); [screens.md §7.6](screens.md#76-training-hall) | required | done, as above |
| IMP-031 (Drop) | [camp-and-time.md, "Alter"](../A-games/engine/camp-and-time.md#alter-o-fun_3f81_1c59); [screens.md §6.8](screens.md#68-alter) | required | done |
| IMP-049 | [ecl.md](../A-games/engine/ecl.md) ROB | required | done |
| IMP-075 | [combat-ai.md, "Spells and items"](../A-games/engine/combat-ai.md#spells-and-items-o-fun_3334_02ebc-spell-pri) | required | done |
| IMP-067 | [effects.md](../A-games/engine/effects.md) types 85/86 | required | done |
| IMP-070 | [coab/records.md §7.2](../A-games/coab/records.md#72-engine-conversion-o-323c14b3-caller-323c23f82481) | required | done |
| IMP-082 | [combat-rules.md, "Cleanup"](../A-games/engine/combat-rules.md#cleanup-o-fun_2e08_11ac) | required | done |
| IMP-078 | [coab/ecl.md](../A-games/coab/ecl.md) 0x7F6D; [B-model/procedures.md §9.1](../B-model/procedures.md#91-shop-prices) | required | done |
| IMP-034 | [effects.md](../A-games/engine/effects.md) effect 0x28 | required | done |

## 2. Interface and presentation

| Id | Subject | Specified in | Level | Setting | Status |
|---|---|---|---|---|---|
| IMP-001 | the 3D view | [exploration-view.md §1](exploration-view.md#1-the-two-views), [§3](exploration-view.md#3-the-webgl-view-optional) | optional (D6) | View: Original (the required drawn view, §2) / Enhanced (3D) (default where WebGL 2 is available, 2026-10-23) | done; the drawn view built (UI1 resolved) |
| IMP-003 | mouse and touch everywhere, pad, tap zones | [ui-contract.md §4.4](ui-contract.md#44-the-pad), [§8](ui-contract.md#8-input-map) | required | — | done |
| IMP-004 | the original arrangement | superseded by IMP-064 and IMP-060: [ui-contract.md §3](ui-contract.md#3-screen-classes) (W column) | — | Party: Column | superseded |
| IMP-007 | light, fog, colours, textures of the 3D view | [exploration-view.md §3.2](exploration-view.md#32-textures-and-colours) | optional (D6) | — | done |
| IMP-008 | the text log, "Blocked." | [ui-contract.md §6](ui-contract.md#6-the-text-log) | required | — | done ("Locked." is the original's own door prompt, not a port note) |
| IMP-010 | menus as buttons and lists | [ui-contract.md §6.3](ui-contract.md#63-menus-and-prompts) | required | — | done |
| IMP-011 | script-driven moves slide | [exploration-view.md §3.4](exploration-view.md#34-slides) | optional (D6) | — | done |
| IMP-012 | pauses cut short | [ui-contract.md §6.4](ui-contract.md#64-pauses-and-press-any-key) | required | — | done |
| IMP-020 | sprites in the 3D scene | [exploration-view.md §3.5](exploration-view.md#35-encounter-sprites) | optional (D6) | — | done |
| IMP-021 | sprite glide | [exploration-view.md §3.5](exploration-view.md#35-encounter-sprites) | optional (D6) | — | done |
| IMP-022 | the area map on screen | [exploration-view.md §6](exploration-view.md#6-the-area-map), [ui-contract.md §4.3](ui-contract.md#43-the-area-map) | required | — | done |
| IMP-024 | landmarks | [exploration-view.md §6.2](exploration-view.md#62-landmarks), [port-data.md §3](../D-appendices/port-data.md#3-landmark-patterns), [§10](../D-appendices/port-data.md#10-landmark-icons) | required | — | done |
| IMP-026 | the wilderness view and its controls | [exploration-view.md §4.1](exploration-view.md#41-pool-of-radiance-the-tile-wilderness) | required | — | done |
| IMP-029 | the cards choose whose turn; tappable lists | [ui-contract.md §4.1](ui-contract.md#41-party-cards), [screens.md §4](screens.md#4-treasure), [§5](screens.md#5-shops-and-temples) | required | — | done |
| IMP-035 | the party destroyed | [app-flow.md §9](app-flow.md#9-the-party-destroyed-and-the-game-over) | required | — | done |
| IMP-036 | the ending panel | [app-flow.md §8](app-flow.md#8-the-ending) | required | — | done |
| IMP-038 | the game font | [rendering.md §5](rendering.md#5-the-game-font) | setting | Font: Original 8×8 (default) / Modern | done |
| IMP-045 | party cards | [ui-contract.md §4.1](ui-contract.md#41-party-cards), [app-flow.md §5](app-flow.md#5-the-party-screen) | required | — | done |
| IMP-046 | one Settings panel | [ui-contract.md §9](ui-contract.md#9-settings) | required | — | done |
| IMP-047 | sharp scaling | [rendering.md §2](rendering.md#2-scaling) | setting | Graphics: Pixel (default, the original's pixels) / Sharp | done |
| IMP-050 | the title prompt | [app-flow.md §4](app-flow.md#4-the-title) | required | — | done |
| IMP-051 | rope frames | [rendering.md §4](rendering.md#4-frames) | setting | Borders: Original (default) / Plain | done |
| IMP-052 | the battle summary in the log | [combat-ui.md §8](combat-ui.md#8-the-end-of-a-battle) | required | — | done |
| IMP-057 | the classic look, ☰, ✕ and Esc | [ui-contract.md §2](ui-contract.md#2-colours-as-roles), [§5](ui-contract.md#5-the-command-bar), [§7](ui-contract.md#7-dialogs), [§10](ui-contract.md#10-motion-focus-and-accessibility), [screens.md §2](screens.md#2-the--menu) | setting | Motion: Full / Reduced (no flashing) | done |
| IMP-060 | autosave, Continue, phone layouts, 44-px controls | [storage.md §5](storage.md#5-saved-games-and-the-autosave), [app-flow.md §7](app-flow.md#7-play-new-game-load-continue), [ui-contract.md §3](ui-contract.md#3-screen-classes) | required | — | done |
| IMP-061 | no View or Area on the bar | [ui-contract.md §5](ui-contract.md#5-the-command-bar) | required | — | done |
| IMP-063 | the experience gauge | [ui-contract.md §4.1](ui-contract.md#41-party-cards) | required | — | done |
| IMP-064 | the cards in a row | [ui-contract.md §3](ui-contract.md#3-screen-classes) | setting | Party: Row across the top (default) / Column beside the view (the original's arrangement) | done |
| IMP-065 | reorder by dragging | [ui-contract.md §8.4](ui-contract.md#84-drags) | required | — | done |
| IMP-066 | slides cut short | [ui-contract.md §8.1](ui-contract.md#81-exploring-nothing-pending-no-dialog-no-script-running), [exploration-view.md §3.4](exploration-view.md#34-slides) | required (with the WebGL view) | — | done |
| IMP-077 | EGA drawing only | [rendering.md §3](rendering.md#3-palettes) | required | — | done |
| IMP-069 | CotAB's ground in the 3D view | [exploration-view.md §3.2](exploration-view.md#32-textures-and-colours) | optional (D6) | — | done |
| IMP-074 | the demo on the party screen | [app-flow.md §6](app-flow.md#6-the-demo) | required | — | done |
| IMP-081 | Escape backs out of every menu | [ui-contract.md §7](ui-contract.md#7-dialogs), [§8](ui-contract.md#8-input-map) | required | — | done |
| IMP-089 | the CRT look | [ui-contract.md §9](ui-contract.md#9-settings) | setting | Screen: Clean (default) / Scanlines / CRT | done |
| IMP-090 | controllers | [ui-contract.md §8.5](ui-contract.md#85-controllers-imp-090), [§9](ui-contract.md#9-settings) | required | — | done |
| IMP-091 | big pictures across the top; the ending's wide picture | [exploration-view.md §5](exploration-view.md#5-pictures-and-the-picture-layer), [app-flow.md §8](app-flow.md#8-the-ending) | required | — | done |
| IMP-092 | the party screen in the game's frame | [rendering.md §4.2](rendering.md#42-panels) | setting | Borders: Original (default) / Plain | done |
| IMP-093 | the games screen in the boxes' colours, the covers | [app-flow.md §2.2](app-flow.md#22-the-games-screen), [B-model/profile.md](../B-model/profile.md) `title.cover` | required | — | done |
| IMP-094 | the party screen and ☰ in the parchment look | [app-flow.md §5](app-flow.md#5-the-party-screen), [screens.md §2](screens.md#2-the--menu) | required | — | done |
| IMP-095 | the paper pages (Journal, Rules reference, Commissions, the ending, Load); the play screen's surround | [screens.md §8](screens.md#8-the-journal), [§9](screens.md#9-commissions), [§10](screens.md#10-rules-reference), [§1.7](screens.md#17-load-saved-game), [app-flow.md §8](app-flow.md#8-the-ending), [ui-contract.md §3](ui-contract.md#3-screen-classes) | required | — | done |
| IMP-096 | the party screen's tools and Debug in the parchment look | [screens.md §1](screens.md#1-the-party-screens-functions), [§12](screens.md#12-debug) | required | — | done |

## 3. Characters, party, town and camp

| Id | Subject | Specified in | Level | Status |
|---|---|---|---|---|
| IMP-016 | the roster in browser storage | [storage.md §3.1](storage.md#31-characters), [§4](storage.md#4-roster-seeding) | required | done |
| IMP-017 | the icon editor panel | [screens.md §1.6](screens.md#16-the-combat-icon-editor) | required | done (from Alter → Icon, UI2 resolved) |
| IMP-018 | Modify with −/+ | [screens.md §1.2](screens.md#12-modify-character) | required | done |
| IMP-019 | Load always on the party screen | [screens.md §1.7](screens.md#17-load-saved-game) | required | done |
| IMP-023 | the Commissions panel | [screens.md §9](screens.md#9-commissions), [port-data.md §5](../D-appendices/port-data.md#5-the-commissions-panel) | required (PoR) | done |
| IMP-027 | the items menu as buttons | [screens.md §3.3](screens.md#33-item-actions) | required | done |
| IMP-030 | quick rest with Stop, rest time ±, Order buttons | [screens.md §6.7](screens.md#67-rest), [§6.8](screens.md#68-alter) | required | done |
| IMP-031 (Alter) | Pics | [screens.md §6.8](screens.md#68-alter) | required | done |
| IMP-032 | the training hall's party screen | [screens.md §7.6](screens.md#76-training-hall) | required | done |
| IMP-039 | commission progress | [screens.md §9](screens.md#9-commissions), [port-data.md §5](../D-appendices/port-data.md#5-the-commissions-panel) | required (PoR) | done |
| IMP-040 | creation on one screen | [screens.md §1.1](screens.md#11-create-character) | required | done |
| IMP-041 | the sheet with equipment | [screens.md §3](screens.md#3-the-character-sheet) | required | done |
| IMP-042 | the Buy panel | [screens.md §5.2](screens.md#52-buy) | required | done |
| IMP-043 | the Memorize panel | [screens.md §6.4](screens.md#64-memorize) | required | done |
| IMP-048 | Fix in Pool of Radiance, as CotAB's ([A-games/coab/camp.md](../A-games/coab/camp.md) §1) | [screens.md §6.9](screens.md#69-fix) | required | done (UI5) |
| IMP-055 | the Journal | [screens.md §8](screens.md#8-the-journal), [port-data.md §4](../D-appendices/port-data.md#4-the-journal), [storage.md §6](storage.md#6-journal-finds-and-the-gbr-sidecar) | required (a game with a journal) | done |
| IMP-056 | the treasure panel, Take all | [screens.md §4](screens.md#4-treasure) | required | done |
| IMP-058 | the numbers explained, the rules reference | [screens.md §3](screens.md#3-the-character-sheet), [§10](screens.md#10-rules-reference), [combat-ui.md §6](combat-ui.md#6-aiming-and-targets), [§7](combat-ui.md#7-information), [port-data.md §1](../D-appendices/port-data.md#1-spell-notes), [§2](../D-appendices/port-data.md#2-rules-reference), [§9](../D-appendices/port-data.md#9-interface-tooltips) | required | done |
| IMP-062 | casting from the sheet | [screens.md §3.5](screens.md#35-spells-casting-outside-battles) | required | done |
| IMP-068 | CotAB's code wheel asks nothing | [coab/ecl.md](../A-games/coab/ecl.md), [app-flow.md §4](app-flow.md#4-the-title) | required | done |
| IMP-076 | PoR's translation-wheel screen not shown | [title-and-credits.md](../A-games/por/title-and-credits.md), [app-flow.md §4](app-flow.md#4-the-title) | required | done |
| IMP-073 | the party screen's groups | [app-flow.md §5](app-flow.md#5-the-party-screen) | required | done |
| IMP-086 | Fix says what it did | [screens.md §6.9](screens.md#69-fix) | required | done |
| IMP-087 | Add character in columns | [screens.md §1.3](screens.md#13-add-character) | required | done |
| IMP-097 | the sheet, treasure, shops, Settings and Account in the parchment look; the temple's Heal panel | [screens.md §3](screens.md#3-the-character-sheet), [§4](screens.md#4-treasure), [§5](screens.md#5-shops-and-temples), [§5.3](screens.md#53-heal), [§11](screens.md#11-settings-and-account) | required | done |
| IMP-098 | spell sets in Memorize | [screens.md §6.4](screens.md#64-memorize), [storage.md §6](storage.md#6-journal-finds-and-the-gbr-sidecar) `loadouts` | required | done |
| IMP-099 | money on the Buy and Heal panels; the vault as a panel | [screens.md §5](screens.md#5-shops-and-temples), [§5.6](screens.md#56-the-vault-sotsb) | required | done |
| IMP-100 | shops and temples as one window each | [screens.md §5](screens.md#5-shops-and-temples) | required | done |
| IMP-101 | the training hall as one window | [screens.md §7.6](screens.md#76-training-hall) | required | done |
| IMP-102 | camp as one window; the save slot window | [screens.md §6](screens.md#6-camp), [app-flow.md §7](app-flow.md#7-play-new-game-load-continue) | required | done |
| IMP-103 | travel on the area map | [exploration-view.md §6.3](exploration-view.md#63-the-large-view) | required | done |
| IMP-104 | save lists with a picture, the place, the party and the game's day | [screens.md §1.7](screens.md#17-load-saved-game), [storage.md §6](storage.md#6-journal-finds-and-the-gbr-sidecar) `info` | required | done |

## 4. Combat

| Id | Subject | Specified in | Level | Status |
|---|---|---|---|---|
| IMP-033 | the battle screen | [combat-ui.md §1](combat-ui.md#1-layout)–[§3](combat-ui.md#3-what-is-drawn) | required | done |
| IMP-079 | missile sprites not overwritten by a sixth monster type | [combat-ui.md §3](combat-ui.md#3-what-is-drawn); [engine/combat-visuals.md](../A-games/engine/combat-visuals.md) | required | done |
| IMP-037 | pacing, waits cut short | [combat-ui.md §9](combat-ui.md#9-pacing) | required | done |
| IMP-044 | walk planner, condition, turn strip | [combat-ui.md §5](combat-ui.md#5-input), [§7](combat-ui.md#7-information) | required | done |
| IMP-053 | movement without MOVE | [combat-ui.md §4](combat-ui.md#4-the-command-row), [§5](combat-ui.md#5-input) | required | done |
| IMP-054 | one command row, Quick and Magic | [combat-ui.md §4](combat-ui.md#4-the-command-row), [§10](combat-ui.md#10-quick-and-magic) | required | done |
| IMP-059 | reach, area templates, drag to give | [combat-ui.md §3](combat-ui.md#3-what-is-drawn), [§6](combat-ui.md#6-aiming-and-targets), [ui-contract.md §8.4](ui-contract.md#84-drags) | required | done |
| IMP-071 | CotAB's Fire Shield menu | [coab/spells.md](../A-games/coab/spells.md) 85 | required | done |
| IMP-080 | SotSB's Delayed Blast Fireball delay as a menu | [sotsb/spells.md](../A-games/sotsb/spells.md) (`delayedBlast`) | required | done |
| IMP-083 | tap to attack, the action bar, drag to walk | [combat-ui.md §4.1](combat-ui.md#41-the-action-bar-imp-083), [§5](combat-ui.md#5-input) | required | done |
| IMP-084 | health bars, danger squares, the radial menu | [combat-ui.md §3](combat-ui.md#3-what-is-drawn), [§7](combat-ui.md#7-information) | required | done |
| IMP-085 | numbers over heads, MISS | [combat-ui.md §3](combat-ui.md#3-what-is-drawn) | required | done |
| IMP-088 | All on Quick | [combat-ui.md §10](combat-ui.md#10-quick-and-magic), [§5](combat-ui.md#5-input) | required | done |

## 5. Sound, saving, platform, development

| Id | Subject | Specified in | Level | Setting | Status |
|---|---|---|---|---|---|
| IMP-013 | effects from the driver, without pausing | [audio.md §1](audio.md#1-how-an-effect-is-produced) | required | — | done; the cut-off by call site (C23 resolved, [audio.md §3](audio.md#3-the-cut-off-rule)) |
| IMP-014 | footstep on APPROACH | [audio.md §5](audio.md#5-additions) | required | — | done |
| IMP-015 | device switch, Tandy emulated | [audio.md §2](audio.md#2-device-choice), [§1](audio.md#1-how-an-effect-is-produced) | setting | Sound: PC speaker / Tandy / Off | done |
| IMP-002 | save anywhere | [storage.md §5](storage.md#5-saved-games-and-the-autosave), [app-flow.md §7](app-flow.md#7-play-new-game-load-continue) | required | — | done; a quicksave (with a setting) is planned |
| IMP-005 | offline app, single file | [pwa-and-build.md](pwa-and-build.md), [storage.md §2](storage.md#2-the-game-files-database) | required | — | done; importing GOG's `.pkg` installer directly is not (folder or files only) |
| IMP-006 | export and import as the original's files | [storage.md §6](storage.md#6-journal-finds-and-the-gbr-sidecar), [§7](storage.md#7-export-and-import), [screens.md §1.8](screens.md#18-export-and-import) | required | — | done |
| IMP-072 | accounts and server storage | [accounts-and-sync.md](accounts-and-sync.md) | optional (needs a server) | — | done |
| IMP-025 | the Debug panel | [screens.md §12](screens.md#12-debug), [port-data.md §6](../D-appendices/port-data.md#6-debug-jumps-and-finale), [B-model/host-contracts.md §3.1](../B-model/host-contracts.md#31-life-cycle) | optional (not part of the game) | — | done |

**IMP-009** was never assigned: the register skips from IMP-008 to IMP-010.

## 6. Departures without an IMP row

None. The five found while writing part C (2026-10-21, [AUDIT.md](../AUDIT.md) §6.9 UI3, UI6) were
settled: PoR's translation wheel is IMP-076 and the EGA-only drawing IMP-077; Ctrl-S and camp Save's
"Quit TO DOS" are now as the original ([audio.md §2](audio.md#2-device-choice),
[screens.md §6.1](screens.md#61-the-camp-menu)); the battle's View is not a departure (the original
restores the normal palette for the View screen in battle, [combat-ui.md](combat-ui.md), Open). The
party screen's Exit goes to the games screen instead of DOS, as there is no DOS
([app-flow.md §5](app-flow.md#5-the-party-screen)); so does CotAB's return to DOS after the ending and
its save question ([app-flow.md §8](app-flow.md#8-the-ending)), whose party screen leaves Begin out as
the original switches its entry off (0x36DCD).

## Validation

- Every IMP id of the register appears in §1–§5 (103 ids; IMP-009 unassigned), checked by listing
  `^| IMP-` in [IMPROVEMENTS.md](../../IMPROVEMENTS.md) against this file (2026-10-25).
- [CONFORMANCE.md](../CONFORMANCE.md), "Departures".
