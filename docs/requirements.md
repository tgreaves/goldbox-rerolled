# Browser port: requirements and design

The aim is a browser reimplementation of *Pool of Radiance*, and then of the other Gold Box games on the same engine ([`multi-game.md`](multi-game.md)), built on the specification in [`spec/`](../spec/README.md). Rules and scripts stay faithful to the original. Presentation and interface are modernised, and every deliberate departure from the original goes in [`IMPROVEMENTS.md`](../IMPROVEMENTS.md).

## Requirements (agreed 2026-10-15)

| # | Requirement | Decision |
|---|---|---|
| R1 | Runs in a browser, online and offline | Installable PWA (service worker caches the app); also a single-file `.html` build that runs from disk |
| R2 | Load and save games, including offline | Saves in browser storage; export/import in the original `SAVGAM*.DAT` format; **save anywhere** allowed |
| R3 | 3D engine for exploring | **Real 3D** (WebGL) view built from the GEO maps, replacing the original pre-drawn tile view |
| R4 | Modernised graphics, keeping the 2D/3D feel | Original pixel art kept and scaled sharply; 2D combat battlefield kept with modern overlays; optional art packs later |
| R5 | Modernised interface | Mouse and touch for everything; keyboard layout of the original kept as default bindings |
| R6 | Responsive | Works from phone to desktop; layout adapts rather than scaling a fixed 320×200 screen |
| R7 | Track improvements | Every departure from the original is logged in `IMPROVEMENTS.md`, with a toggle where it changes gameplay |

Assumed unless changed: the full game is in scope (exploration, combat, character creation, ending); the AD&D rules and script behaviour follow the spec exactly, with a "fixed" option for the original's known bugs. Sound: the original's effects where it plays them, plus a few additions logged in `IMPROVEMENTS.md` (decided 2026-10-15). The effects are emulated from the driver data in the player's `START.EXE` (IMP-013), the PC-speaker data having been decoded since.

## Constraints

- **No game data in the repository or the build.** The player imports their own `POOLRAD` folder (or its files); the app decodes it in the browser and stores the original files locally. Importing the GOG `.pkg` itself is not implemented: it is unpacked first (`tools/xar_extract.py`). Nothing is uploaded.
- **The original memory model is the game state**: ECL word arrays A, B, C, the script buffer and the party records, as in [`spec/A-games/engine/savegame.md`](../spec/A-games/engine/savegame.md). This keeps original saves loadable.
- **No network at runtime.** Fonts, libraries and assets are bundled.

## Architecture

The plan of 2026-10-15, kept as the record of intent (it is not a description of the code: there is no
`engine/` directory; the exploration loop is in `vm/engine.ts`, the screens in `ui/`, the game profiles
in `games/`, sound in `audio/`).

```
web/
  src/
    data/      decoders: DAX/RLE, GEO, ECL, images, font, records (ports of tools/*.py)
    vm/        ECL interpreter (port of tools/eclvm.py), async so menus can await input
    rules/     character rules, combat, spells, effects (spec/A-games/engine/combat-rules.md, spells.md, effects.md, ...)
    engine/    exploration loop, camp, shops, party screen (spec/A-games/engine/main-loop.md, camp-and-time.md, town.md)
    render/    3D view (WebGL), 2D combat view, pictures and sprites
    ui/        responsive layout, menus, message log, automap, settings
    store/     game files and saves (OPFS / IndexedDB), import/export
```

- Engine code never touches storage or the DOM directly: `store/` and `ui/` are behind small interfaces, so a desktop wrapper or a test harness can replace them.
- Script input (menus, number and text entry) is `await`ed by the interpreter; the UI resolves it.
- Random numbers: the specification defines one injected dice source, the dice tape ([`spec/README.md`](../spec/README.md), "Randomness"). Not there yet: the rules use the engine's seeded generator, but character creation on the party screen, the title and the sound use `Math.random`, and nothing records or replays a run.
- Original bugs that a port could fix are switches in one settings object, defaulting to classic behaviour.

## Tooling

- TypeScript, Vite, Vitest
- `vite-plugin-pwa` for the service worker and manifest; a second Vite build inlines everything into one `.html`
- three.js for the 3D view (bundled, works offline)

## Testing

- Decoders: byte-for-byte comparison with the Python tools' output
- Interpreter: the `eclsweep` area sweep as a test (every area, every square)
- Seeded replays for regression tests
- Comparison of scripted walks with the original in DOSBox (still to set up)

## Delivery order

1. Game file import and an asset viewer (decoders checked against the Python tools)
2. Exploration: 3D view, movement and doors, the interpreter, text and menus, from a shipped save; combat resolved automatically at first
3. Party management: character sheet, items, camp and rest, shops, temples, training
4. Combat: battlefield, turns, commands, AI, spells, effects
5. Character creation, party screen, save and load, ending
6. Modern helpers: automap, event log, speed controls, art packs
