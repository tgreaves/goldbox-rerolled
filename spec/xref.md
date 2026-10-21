# Cross-reference to the reference implementation

> **Status: complete** (work-plan step 7, [AUDIT.md](AUDIT.md) §8). Informative, a companion document
> for maintainers; kept out of clean-room file sets ([CLEANROOM.md §2](CLEANROOM.md#2-the-file-sets)).
> Part of the [specification](README.md).

Each spec file (or section) → where the reference implementation does it (`web/src/`, `web/headless/`,
`server/`, `tools/`) and the tests that check it (`web/test/`). When code here changes, check the
section; when a statement of the spec is doubted, go to the code. Paths are from the repository root;
the function or table names are the stable anchors (line numbers drift). `web/test/xref.test.ts`
checks that every path named here exists.

## Part A: the original games

| Spec | Implementation | Tests |
|---|---|---|
| [engine/containers.md](A-games/engine/containers.md) | `web/src/data/exepack.ts` (`unexepack`), `web/src/data/gametext.ts` (`mergedImage`), `web/src/data/dax.ts` (`readDax`, `unrle`); `tools/unexepack.py`, `tools/mergeovr.py`, `tools/dax.py`, `tools/xar_extract.py` | `exepack`, `decoders`, `gametext` |
| [engine/graphics.md](A-games/engine/graphics.md) | `web/src/data/image.ts` (blocks, frames, XOR deltas, palette, transparency), `web/src/data/font.ts`, `web/src/render/icon.ts`; `tools/gfx.py` | `decoders`, `ttf` |
| [engine/maps-and-view.md](A-games/engine/maps-and-view.md) | `web/src/data/geo.ts` (`GeoMap`), `web/src/data/walls.ts`, `web/src/render/drawnview.ts` (`drawView`, `viewCalls`), `web/src/render/viewscene.ts`, `web/src/ui/areamap.ts`; `tools/geo.py`, `tools/automap.py` | `walls`, `drawnview`, `view` |
| [engine/records.md](A-games/engine/records.md) | `web/src/data/items.ts`, `web/src/data/effects.ts`, `web/src/data/character.ts`, `web/src/games/fields.ts`, `web/src/rules/equip.ts` (`recalc`, `ready`), `web/src/rules/randitem.ts`; `tools/chars.py`, `tools/randitem.py` | `fields`, `decoders`, `randitem`, `itemfx` |
| [engine/savegame.md](A-games/engine/savegame.md) | `web/src/data/save.ts` (`parseSave`), `web/src/games/files.ts`, `web/src/vm/engine.ts` (`loadSave`, `toSave`) | `engine` (save games), `savefiles` |
| [engine/ecl.md](A-games/engine/ecl.md) | `web/src/vm/engine.ts` (the VM, opcodes, memory map), `web/src/games/ecl.ts`, `web/src/data/text.ts`; `tools/ecl.py`, `tools/eclvm.py`, `tools/eclsweep.py` | `engine`, `eclops`, `eclmap`, `door`, `npc`, `damage` |
| [engine/main-loop.md](A-games/engine/main-loop.md) | `web/src/vm/engine.ts` (`start`, `command`, `enter`, moves and doors), `web/src/ui/explore.ts` (the command bar) | `engine`, `door`, `view` |
| [engine/input-and-menus.md](A-games/engine/input-and-menus.md) | `web/src/ui/party.ts`, `web/src/ui/creator.ts` (Modify, the icon editor), `web/src/ui/title.ts`, `web/src/store/savefiles.ts` (character files) | `chargen`, `savefiles` |
| [engine/chargen-and-progression.md](A-games/engine/chargen-and-progression.md) | `web/src/rules/chargen.ts` (`begin`, `rollAbilities`, `saves`, `thiefSkills`), `web/src/rules/training.ts` (`train`, `derive`, `levelHp`), `web/src/ui/newchar.ts` | `chargen`, `training`, `vectors` (creation, training, derive) |
| [engine/camp-and-time.md](A-games/engine/camp-and-time.md) | `web/src/rules/camp.ts`, `web/src/ui/camp.ts`, `web/src/rules/magic.ts` (casting outside combat) | `camp`, `spells2` |
| [engine/town.md](A-games/engine/town.md) | `web/src/ui/town.ts` (shop, temple, treasure), `web/src/rules/money.ts`, `web/src/rules/inventory.ts`, `web/src/rules/treasure.ts` | `money`, `temple`, `treasure`, `vectors` (money) |
| [engine/overland.md](A-games/engine/overland.md) | `web/src/rules/overland.ts`, `web/src/ui/explore.ts` (the wilderness view) | `engine` (debug jump) |
| [engine/combat-rules.md](A-games/engine/combat-rules.md) | `web/src/rules/combat.ts` (`Battle`, `fight`, `aftermath`, `Line`), `web/src/ui/combat.ts` | `combat`, `casting`, `battlemove`, `vectors` (combat) |
| [engine/battlefield.md](A-games/engine/battlefield.md) | `web/src/rules/battlefield.ts` (`wildField`, `mapBattlefield`, `terrainFlags`, `cellTable`); `tools/battlefield.py` | `battlefield`, `wildfield`, `mapfield`, `vectors` (battlefields) |
| [engine/combat-ai.md](A-games/engine/combat-ai.md) | `web/src/rules/combat.ts` (`ai`, `aiCast`, `aiUseItem`, `findTarget`, `morale`, `chooseWeapon`) | `combat`, `casting` |
| [engine/combat-visuals.md](A-games/engine/combat-visuals.md) | `web/src/render/combatview.ts`, `web/src/ui/combat.ts`, `web/src/rules/combat.ts` (`missileFlight`) | `combat` |
| [engine/spells.md](A-games/engine/spells.md) | `web/src/data/spells.ts`, `web/src/games/spellrules.ts`, `web/src/rules/spellkinds.ts`, `web/src/rules/combat.ts` (`spellKinds`), `web/src/rules/spelltext.ts`; `tools/spells.py` | `spellmap`, `spells2`, `spellpaths`, `casting`, `spellrules` |
| [engine/effects.md](A-games/engine/effects.md) | `web/src/rules/effects.ts` (`fire`, `addEffect`, `removeEffect`), `web/src/rules/effectkinds.ts`, `web/src/games/effectrules.ts`, `web/src/rules/worldfx.ts` | `effectmap`, `porhandlers`, `fxchain`, `itemfx` |
| [engine/sound.md](A-games/engine/sound.md) | `web/src/audio/driver.ts` (`renderEffect`, `renderTandy`, `driverTrace`), `web/src/games/sound.ts`; `tools/sound.py`, `tools/sounddis.py` | `sound`, `soundcut`, `vectors` (sound.driver) |
| [por/README.md](A-games/por/README.md), [por/title-and-credits.md](A-games/por/title-and-credits.md) | `web/src/games/por.ts`, `web/src/games/title.ts`, `web/src/ui/title.ts` | `profile`, `gametext` |
| [por/commissions.md](A-games/por/commissions.md) | `web/src/rules/commissions.ts` | `commissions` |
| [por/ending.md](A-games/por/ending.md) | `web/src/games/ending.ts`, `web/src/ui/ending.ts` | `ending`, `finale` |
| [coab/README.md](A-games/coab/README.md) | `web/src/games/coab.ts`; `tools/coab/` | `profile` |
| [coab/ecl.md](A-games/coab/ecl.md) | `web/src/games/ecl.ts` (CotAB's map and variants), `web/src/games/startup.ts`, `web/src/vm/engine.ts`; `tools/coab/ecl_coab.py` | `coabsweep`, `demo`, `npc` |
| [coab/records.md](A-games/coab/records.md) | `web/src/games/fields.ts` (`COAB_FIELDS`), `web/src/games/files.ts`, `web/src/games/imports.ts`, `web/src/rules/import.ts`, `web/src/rules/joining.ts`, `web/src/rules/abilities.ts`, `web/src/games/treasure.ts`; `tools/coab/records_coab.py` | `fields`, `import`, `joining`, `abilities`, `coabtreasure` |
| [coab/chargen-and-progression.md](A-games/coab/chargen-and-progression.md) | `web/src/rules/dualclass.ts`, `web/src/rules/training.ts` (`derive`, `train`), `web/src/games/rules.ts` (`dualClass`, `recalc`, `startSpells`), `web/src/ui/explore.ts` (the training hall's party screen) | `dualclass`, `training`, `spellrules`, `vectors` |
| [coab/tables.md](A-games/coab/tables.md) | `web/src/games/tables.ts` (`COAB_TABLES`), `web/src/games/rules.ts` (`COAB_RULES`); `tools/coab/tables_coab.py` | `tables`, `spellrules`, `training` |
| [coab/spells.md](A-games/coab/spells.md) | `web/src/games/spellrules.ts` (`COAB_SPELLS`), `web/src/rules/spellkinds.ts` | `coabspells`, `spellmap` |
| [coab/effects.md](A-games/coab/effects.md) | `web/src/games/effectrules.ts` (CotAB's maps), `web/src/rules/effectkinds.ts`, `web/src/rules/specials.ts` | `effectkinds`, `specials`, `effectmap` |
| [coab/combat.md](A-games/coab/combat.md) | `web/src/rules/battlefield.ts`, `web/src/rules/combat.ts` | `mapfield`, `wildfield`, `casting` |
| [coab/assets.md](A-games/coab/assets.md) | `web/src/games/view.ts`, `web/src/games/frametiles.ts`, `web/src/games/title.ts`, `web/src/render/world.ts`, `web/src/audio/sfx.ts` | `coabsweep`, `coabsound`, `drawnview` |
| [coab/camp.md](A-games/coab/camp.md) | `web/src/ui/camp.ts` (Fix), `web/src/rules/camp.ts` | `camp` |

## Part B: the engine model

| Spec | Implementation | Tests |
|---|---|---|
| [profile.md](B-model/profile.md) | `web/src/games/types.ts` (`GameProfile`), `web/src/games/profile.ts` (`setGame`, `detect`), `web/src/games/por.ts`, `web/src/games/coab.ts` | `profile` |
| [records-and-tables.md](B-model/records-and-tables.md) | `web/src/games/fields.ts`, `web/src/games/tables.ts` (`TableMap`, `T`), `web/src/games/files.ts`, `web/src/rules/chargen.ts` (`Tables`) | `fields`, `tables`, `vectors` (tables.bytes) |
| [script-vm-map.md](B-model/script-vm-map.md) | `web/src/games/ecl.ts` (`canonical`), `web/src/vm/engine.ts` (the regions, the view) | `eclmap`, `eclops`, `coabsweep` |
| [procedures.md](B-model/procedures.md) §1–§7 | `web/src/games/rules.ts` (`slots`, `hitPoints`, `startMoney`, `casterTerms`, `thief`, `saveCon`), `web/src/rules/training.ts` (`derive`), `web/src/rules/chargen.ts`, `web/src/rules/magic.ts` (`casterLevel`) | `chargen`, `training`, `spellrules`, `vectors` |
| procedures.md §8–§13 | `web/src/rules/joining.ts`, `web/src/ui/town.ts` (temple), `web/src/rules/abilities.ts`, `web/src/rules/effectkinds.ts` (the current-stat routine), `web/src/rules/effects.ts`, `web/src/rules/import.ts` | `joining`, `temple`, `abilities`, `import`, `vectors` (join, strength.encoding) |
| procedures.md §14 | `web/src/rules/randitem.ts`, `web/src/games/treasure.ts` | `randitem`, `coabtreasure`, `vectors` (treasure.random) |
| procedures.md §15 | `web/src/rules/combat.ts` (casting, `bolt`, `spellKinds.cloud`, `stepCost`), `web/src/rules/battlefield.ts` | `casting`, `spellpaths`, `battlemove`, `wildfield`, `mapfield`, `vectors` |
| procedures.md §16 | `web/src/games/startup.ts`, `web/src/vm/engine.ts` (demo) | `demo` |
| [vocabularies.md](B-model/vocabularies.md) | `web/src/rules/effectkinds.ts`, `web/src/games/effectrules.ts`, `web/src/rules/spellkinds.ts`, `web/src/games/spellrules.ts`, `web/src/rules/specials.ts` | `effectmap`, `effectkinds`, `porhandlers`, `spellmap`, `specials` |
| [host-contracts.md](B-model/host-contracts.md) §1–§5, §7 | `web/src/vm/engine.ts` (`Io`), `web/src/rules/combat.ts` (`CombatUi`), `web/src/rules/effects.ts` (`FxHost`), `web/src/rules/worldfx.ts` | `engine`, `combat` |
| host-contracts.md §6 | `web/src/rules/dice.ts` (`random`, `generator`, `TapeRecorder`, `TapePlayer`), `web/src/main.ts` (the page's dice source) | `dice`, `headless`, `vectors` (tape.replay, dice.random) |
| host-contracts.md §8 | `web/headless/harness.ts` (`runScript`), `web/headless/run.ts`, `web/headless/frame.ts`, `web/headless/node-ts.mjs` | `headless`, `drawnview`, `vectors` (headless.run) |
| [files-and-detection.md](B-model/files-and-detection.md) | `web/src/games/profile.ts` (`detect`, `wants`), `web/src/store/gamefiles.ts` | `profile` |
| [adding-a-game.md](B-model/adding-a-game.md) | the method; `tools/unexepack.py`, `tools/mergeovr.py`, `tools/coab/` | `tables`, `fields`, `eclmap` |

## Part C: GoldBox Rerolled

| Spec | Implementation | Tests |
|---|---|---|
| [overview.md](C-port/overview.md) | `web/src/main.ts` | — |
| [app-flow.md](C-port/app-flow.md) | `web/src/main.ts`, `web/src/ui/party.ts`, `web/src/ui/title.ts`, `web/src/ui/ending.ts`, `web/src/ui/viewer.ts` | `demo`, `ending` |
| [ui-contract.md](C-port/ui-contract.md) | `web/src/ui/explore.ts`, `web/src/ui/panel.ts`, `web/src/ui/settings.ts`, `web/src/style.css` | `ux` |
| [screens.md](C-port/screens.md) | `web/src/ui/creator.ts`, `web/src/ui/newchar.ts`, `web/src/ui/sheet.ts`, `web/src/ui/town.ts`, `web/src/ui/camp.ts`, `web/src/ui/rulesref.ts`, `web/src/ui/debugedit.ts`, `web/src/ui/explore.ts` (journal, commissions, memorize, treasure), `web/src/rules/journal.ts`, `web/src/rules/treasure.ts` | `camp`, `journal`, `commissions`, `treasure` |
| [exploration-view.md](C-port/exploration-view.md) | `web/src/render/drawnview.ts`, `web/src/render/viewscene.ts`, `web/src/render/world.ts`, `web/src/ui/areamap.ts`, `web/src/rules/landmarks.ts`, `web/src/games/landmarkrules.ts` | `drawnview`, `view`, `landmarks` |
| [combat-ui.md](C-port/combat-ui.md) | `web/src/ui/combat.ts`, `web/src/render/combatview.ts` | `combat`, `ux` |
| [rendering.md](C-port/rendering.md) | `web/src/render/upscale.ts`, `web/src/data/ttf.ts`, `web/src/ui/gamefont.ts`, `web/src/ui/frames.ts`, `web/src/games/frametiles.ts` | `upscale`, `ttf`, `tables` (frame tiles) |
| [audio.md](C-port/audio.md) | `web/src/audio/sfx.ts`, `web/src/audio/driver.ts` | `sound`, `soundcut`, `coabsound` |
| [storage.md](C-port/storage.md) | `web/src/store/gamefiles.ts`, `web/src/store/user.ts`, `web/src/store/savefiles.ts` (export, import, ZIP, `.GBR`), `web/src/store/changes.ts` | `savefiles` |
| [accounts-and-sync.md](C-port/accounts-and-sync.md) §1–§4, §7–§10 | `server/app.ts`, `server/accounts.ts`, `server/storage.ts`, `server/config.ts`, `server/static.ts`, `server/fsutil.ts`, `server/zip.ts`, `server/admin.ts`, `server/main.ts`, `server/goldbox-rerolled.service` | `server` |
| accounts-and-sync.md §5–§6 | `web/src/store/sync.ts`, `web/src/store/records.ts`, `web/src/store/api.ts`, `web/src/store/account.ts`, `web/src/ui/account.ts` | `sync` |
| [pwa-and-build.md](C-port/pwa-and-build.md) | `web/vite.config.ts`, `web/src/pwa/register.ts`, `web/src/pwa/stub.ts`, `web/src/version.ts` | — |
| [departures.md](C-port/departures.md) | `IMPROVEMENTS.md` (the register) | — |

## Part D and the companion documents

| Spec | Implementation | Tests |
|---|---|---|
| [addresses.md](D-appendices/addresses.md) | `tools/specaddresses.py` (the routine lists), `web/headless/vectors-run.ts` (the table index) | `vectors` (the generated sections) |
| [strings.md](D-appendices/strings.md) | `web/src/games/stringtable.ts`, `web/src/games/strings.ts` (`msg`), `web/src/data/gametext.ts` | `gametext` (`web/test/text-hashes.json`) |
| [port-data.md](D-appendices/port-data.md) | `web/src/games/spellnotes.ts`, `web/src/games/rulestext.ts`, `web/src/games/landmarkrules.ts`, `web/src/games/journal.ts`, `web/src/games/debug.ts`, `web/src/rules/commissions.ts`, `web/src/ui/explore.ts` (`TIPS`) | `journal`, `landmarks`, `commissions` |
| [expected-values.md](D-appendices/expected-values.md) | `web/headless/vectors-run.ts` (§7) | `vectors`, `tables`, `decoders` |
| [test-vectors.md](D-appendices/test-vectors.md) | `web/headless/vectors.ts`, `web/headless/vector-cases.ts`, `web/headless/vectors-run.ts` | `vectors` |
| [CONFORMANCE.md](CONFORMANCE.md) | the whole build | — |
| [VALIDATION.md](VALIDATION.md) | `web/test/`, `web/test/playtest.ts`, `web/test/view-frames.json` | all |
| links | `tools/speclinks.py` | — |
