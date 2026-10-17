# GoldBox Rerolled: the web port

Browser reimplementation of the Gold Box engine, running *Pool of Radiance* first; see [`../docs/requirements.md`](../docs/requirements.md) for the design and [`../IMPROVEMENTS.md`](../IMPROVEMENTS.md) for departures from the original.

No game data is included. On first start the app asks for the player's `POOLRAD` folder (or its files); they are stored in the browser (IndexedDB) so it then works offline.

```sh
npm install
npm run dev            # development server
npm run build          # installable offline web app (PWA) → dist/
npm run build:single   # one self-contained HTML file → dist-single/index.html
POOLRAD=/path/to/POOLRAD npm test   # decoder tests against your game files and ../tools
```

Current state: delivery step 1. Game file import and an asset viewer: pictures with their animation timing, sprites, portraits, combat icons, 3D-view tiles and top-down GEO maps.

Note: `npm audit` reports a denial-of-service issue in `braces`, pulled in by `vite-plugin-singlefile`. It only runs at build time on your own files.
