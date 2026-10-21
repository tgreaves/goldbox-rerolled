---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# GoldBox Rerolled: overview

Part of the [specification](../README.md), part C. **Normative** where it states a requirement or a
constraint; the architecture section is informative (a builder may structure the code differently,
as long as the contracts it points to hold).

GoldBox Rerolled is a reimplementation of SSI's Gold Box engine that runs in a web browser. It plays
the player's own copy of a game (Pool of Radiance, then Curse of the Azure Bonds and later games)
from the original files, with the original's rules and scripts, a modern interface, and optional
accounts that keep the player's saves on a server.

## Requirements

Agreed 2026-10-15 ([docs/requirements.md](../../docs/requirements.md) is the record).

| # | Requirement | Specified in |
|---|---|---|
| R1 | Runs in a browser, online and offline: an installable web app, and a single HTML file that runs from disk | [pwa-and-build.md](pwa-and-build.md) |
| R2 | Loads and saves games, offline too; saves in browser storage, export and import in the original's files; save anywhere | [storage.md](storage.md) |
| R3 | A 3D view for exploring, built from the game's maps | [exploration-view.md](exploration-view.md) (D6: the original's drawn view is the conformance target) |
| R4 | Modernised graphics that keep the 2D and 3D feel: the original pixel art, scaled sharply; the 2D battlefield with modern overlays | [rendering.md](rendering.md), [combat-ui.md](combat-ui.md) |
| R5 | A modernised interface: mouse and touch for everything, the original's keys as the default bindings | [ui-contract.md](ui-contract.md), [screens.md](screens.md) |
| R6 | Responsive, phone to desktop: the layout adapts instead of scaling a 320 × 200 screen | [ui-contract.md](ui-contract.md) |
| R7 | Every departure from the original is logged, with a setting where it changes play | [departures.md](departures.md), [IMPROVEMENTS.md](../../IMPROVEMENTS.md) |

Accounts and sync (IMP-072, [accounts-and-sync.md](accounts-and-sync.md)) came later; they are
optional, and nothing in R1–R7 depends on them.

## Constraints

- **No game data in the repository or the build.** The player imports their own game folder; the
  app decodes it in the browser and keeps the files locally ([storage.md §2](storage.md#2-the-game-files-database)).
  Nothing from it is uploaded. Text and values in the game files are read from them (decisions D1,
  D5 in [README.md](../README.md)). The only data the build ships is the port's own (the journal
  text and maps, CC BY-SA; the port-authored data of [D-appendices/port-data.md](../D-appendices/port-data.md)).
- **The original memory model is the game state**: the script VM's word arrays, the script buffer
  and the party records, in each game's native layout, so the original's saves load and are written
  back byte-compatible ([A-games/engine/savegame.md](../A-games/engine/savegame.md)). Port-only data
  goes in sidecar files ([storage.md §6](storage.md#6-journal-finds-and-the-gbr-sidecar)).
- **No network at run time** except the optional server on the app's own origin
  ([pwa-and-build.md §5](pwa-and-build.md#5-offline-behaviour)).
- **One engine for every game, driven by data**: a game differs only by its profile and, where its
  procedure differs, a named procedure ([B-model/profile.md](../B-model/profile.md)).
- **Randomness** that affects the game comes from the injected dice source (D2).

## Conformance for part C

A build conforms to part C when, besides the conditions of [README.md](../README.md):

1. its departures from the original are exactly those [departures.md](departures.md) lists, each as
   its section specifies, and no others;
2. its screens meet the behaviour contract (D4): every screen, its states, controls, keys and texts
   as [app-flow.md](app-flow.md), [ui-contract.md](ui-contract.md), [screens.md](screens.md) and
   [combat-ui.md](combat-ui.md) give them; exact CSS and pixels are informative;
3. it stores, exports and imports as [storage.md](storage.md) says, so its saves and exports are
   interchangeable with the reference build's and with the original's;
4. with a server, its client and server follow [accounts-and-sync.md](accounts-and-sync.md), so
   either can be paired with the reference implementation's other half;
5. its offline app and builds behave as [pwa-and-build.md](pwa-and-build.md) says.

[CONFORMANCE.md](../CONFORMANCE.md) is the checklist.

## Architecture (informative)

How the reference implementation divides the work.

| Layer | Directory | Does | Specified by |
|---|---|---|---|
| Decoders | `web/src/data/` | containers, DAX and RLE, maps (GEO), wall sets, script text, images, the font, character, item and effect records, saves, the font as TTF | [A-games/engine/](../A-games/engine/containers.md) (formats) |
| Profiles | `web/src/games/` | one profile per game: identity, files, record field maps, table maps into `START.EXE`, the script VM map, rules values, procedure choices, presentation data | [B-model/](../B-model/profile.md) |
| Script VM | `web/src/vm/` | the ECL interpreter and the exploration loop (moving, doors, area entry, menus), async so that menus and input await the screen | [ecl.md](../A-games/engine/ecl.md), [main-loop.md](../A-games/engine/main-loop.md), [B-model/script-vm-map.md](../B-model/script-vm-map.md) |
| Rules | `web/src/rules/` | creation, training, camp and time, shops and temples, combat, the battlefield, the AI, spells, effects, treasure, joining, the wilderness, the commissions and journal reveals | part A rules files, [B-model/procedures.md](../B-model/procedures.md), [B-model/vocabularies.md](../B-model/vocabularies.md) |
| Render | `web/src/render/` | the 3D view (three.js, WebGL), the battlefield, icons, upscaling | [exploration-view.md](exploration-view.md), [rendering.md](rendering.md), [combat-ui.md](combat-ui.md) |
| Audio | `web/src/audio/` | an emulation of the original's sound driver from `START.EXE`, PC speaker and Tandy | [sound.md](../A-games/engine/sound.md), [audio.md](audio.md) |
| Store | `web/src/store/` | the game files, the roster, saves, export and import, the sync client | [storage.md](storage.md), [accounts-and-sync.md](accounts-and-sync.md) |
| Interface | `web/src/ui/`, `web/src/style.css`, `web/src/main.ts` | every screen, the layout, input, settings, the account section | [app-flow.md](app-flow.md), [ui-contract.md](ui-contract.md), [screens.md](screens.md) |
| Offline app | `web/src/pwa/`, `web/src/version.ts`, `web/vite.config.ts` | service worker registration, the update bar, the version stamp, the builds | [pwa-and-build.md](pwa-and-build.md) |
| Server | `server/` | accounts and records over HTTP, serving the built app, the admin CLI (Node 24, no dependencies) | [accounts-and-sync.md](accounts-and-sync.md) |

`tools/` (Python decoders, extractors and a headless interpreter) are reference implementations used
to check the decoders and the VM; they are not part of the port.

**Data flow.**

1. The player picks a game folder; the game is detected and its files kept in IndexedDB.
2. On start the decoders read the files on demand (DAX records, `START.EXE` tables through the
   profile's table map); the profile becomes the active game.
3. The VM runs the area's scripts against the game state (the VM's word arrays and the party
   records, kept in the original's layout). It reaches the screen only through host interfaces
   (text, menus, input, frames, combat), and the rules draw dice from the injected source
   ([B-model/host-contracts.md](../B-model/host-contracts.md)). Neither the VM nor the rules touch the
   DOM or browser storage.
4. The interface draws what the VM and rules report, and turns clicks, taps and keys into the
   original's commands.
5. Saving writes the state back in the original's file layout into the player's database; the
   autosave does so on its own schedule. With an account, the sync sends those records, in the same
   file formats, to the server.

**What is normative where.** The original games: part A (the binaries and data are the authority).
How one engine runs them from data: part B. The port's own behaviour: part C, this file's siblings.
Values: game-file values are informative with normative addresses, port-authored values normative
(D5, part D). Development tools, tests and deployment are outside the specification
([README.md](../README.md), "Scope").
