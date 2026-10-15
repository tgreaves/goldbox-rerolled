# Browser port: requirements and design

The aim is a browser reimplementation of *Pool of Radiance* built on the specification in [`spec/`](../spec/README.md). Rules and scripts stay faithful to the original. Presentation and interface are modernised, and every deliberate departure from the original goes in [`IMPROVEMENTS.md`](../IMPROVEMENTS.md).

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

Assumed unless changed: the full game is in scope (exploration, combat, character creation, ending); the AD&D rules and script behaviour follow the spec exactly, with a "fixed" option for the original's known bugs. Sound: the original's effects where it plays them, synthesised until the PC-speaker data is decoded, plus a few additions logged in `IMPROVEMENTS.md` (decided 2026-10-15).

## Constraints

- **No game data in the repository or the build.** The player imports their own `POOLRAD` folder or GOG `.pkg`; the app decodes it in the browser and stores the original files locally. Nothing is uploaded.
- **The original memory model is the game state**: ECL word arrays A, B, C, the script buffer and the party records, as in [`spec/savegame.md`](../spec/savegame.md). This keeps original saves loadable.
- **No network at runtime.** Fonts, libraries and assets are bundled.

## Architecture

```
web/
  src/
    data/      decoders: DAX/RLE, GEO, ECL, images, font, records (ports of tools/*.py)
    vm/        ECL interpreter (port of tools/eclvm.py), async so menus can await input
    rules/     character rules, combat, spells, effects (spec/combat.md, spells.md, effects.md, ...)
    engine/    exploration loop, camp, shops, party screen (spec/architecture.md, camp.md, town.md)
    render/    3D view (WebGL), 2D combat view, pictures and sprites
    ui/        responsive layout, menus, message log, automap, settings
    store/     game files and saves (OPFS / IndexedDB), import/export
```

- Engine code never touches storage or the DOM directly: `store/` and `ui/` are behind small interfaces, so a desktop wrapper or a test harness can replace them.
- Script input (menus, number and text entry) is `await`ed by the interpreter; the UI resolves it.
- Random numbers come from one seedable generator; inputs can be recorded and replayed.
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
