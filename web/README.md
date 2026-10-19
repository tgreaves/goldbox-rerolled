# GoldBox Rerolled: the web port

Browser reimplementation of the Gold Box engine: *Pool of Radiance* playable, *Curse of the Azure Bonds* in progress, one engine driven by per-game profiles (`src/games/`, [`../docs/multi-game.md`](../docs/multi-game.md)); see [`../docs/requirements.md`](../docs/requirements.md) for the design and [`../IMPROVEMENTS.md`](../IMPROVEMENTS.md) for departures from the original.

No game data is included. On first start the app asks for a game folder from the player's own copy (`POOLRAD` for *Pool of Radiance*, `CURSE` for *Curse of the Azure Bonds*), works out which game it is, and stores its files in the browser (IndexedDB, one database per game, with each game's roster and saves kept apart) so it then works offline. *Curse of the Azure Bonds* is playable at an early stage (see [`docs/multi-game.md`](../docs/multi-game.md)).

```sh
npm install
npm run dev            # development server
npm run build          # installable offline web app (PWA) → dist/
npm run build:single   # one self-contained HTML file → dist-single/index.html
POOLRAD=/path/to/POOLRAD COAB=/path/to/CURSE npm test   # decoder tests against your game files and ../tools
```

Current state: *Pool of Radiance* plays from start to finish in the browser (delivery steps 1–5 of [`../docs/requirements.md`](../docs/requirements.md), and of step 6 the area map, journal and speed controls; art packs are not started). *Curse of the Azure Bonds*: steps 1–7 of [`../docs/multi-game.md`](../docs/multi-game.md) are done (detection, record fields, rules tables, script VM, characters and saves, rules, presentation); it is playable at an early stage, not yet played through. Working rules are in [`../CLAUDE.md`](../CLAUDE.md).

Note: `npm audit` reports a denial-of-service issue in `braces`, pulled in by `vite-plugin-singlefile`. It only runs at build time on your own files.
