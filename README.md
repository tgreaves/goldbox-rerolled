# GoldBox Rerolled

A reimplementation of SSI's Gold Box engine for the web browser, and the reverse-engineering work behind it: a specification of each game detailed enough to recreate it, plus Python tools that read the original data files.

- ***Pool of Radiance*** (1988, MS-DOS) is playable in the browser from start to finish: exploration, combat, camp, shops, training, character creation, saves compatible with the original, the ending.
- ***Curse of the Azure Bonds*** (1989) is being added and is playable at an early stage: its records, tables, scripts, saves, rules (its own shop prices, battle details and the end of the game, read from its binary) and presentation (3D view ground, full-width pictures, overland map, title, its demo (Watch the demo on the party screen), the ending, sound) run on the shared engine, and every area's scripts run without errors. It has not yet been played through. See [`docs/multi-game.md`](docs/multi-game.md).
- ***Secret of the Silver Blades*** (1990) is playable at an early stage: its own rules, spells, effects, scripts, items, vault and the import of CotAB characters, each read from its binary, and its AdLib title music played through the port's own OPL2 synthesiser. It has not yet been played through.
- The aim is one engine for every Gold Box game (*Secret of the Silver Blades*, *Pools of Darkness* and beyond), each game described by a profile of data (record layout, rules tables, script map, save layout, rules) rather than special cases in the code.

The work concentrates on the split between the engine and the data that drives the adventure: maps, scripts, text, monsters, items and graphics.

## Layout

- [`spec/`](spec/README.md): the specification, the single normative source the port can be rebuilt from with the player's own game files: part A the original games, part B the engine model, part C the port's own design, part D appendices. Every statement about the originals is marked **O** (observed in the engine code or data), **I** (inferred) or **?** (unknown). Start at `spec/README.md`.
- `tools/`: Python 3, standard library only.
- [`web/`](web/README.md): the browser port (TypeScript, Vite).
- [`server/`](docs/server.md): the optional server: serves the app and keeps players' accounts and data (Node 24, no dependencies).
- [`docs/requirements.md`](docs/requirements.md): requirements and design for the browser port.
- [`docs/multi-game.md`](docs/multi-game.md): how the engine supports several games, and the status of each step.
- [`spec/A-games/coab/`](spec/A-games/coab/README.md): *Curse of the Azure Bonds*, as differences from the PoR spec; `tools/coab/`: its extractors.
- [`CLAUDE.md`](CLAUDE.md): standing rules and method for working in the repository (data-driven first, faithful to the original, evidence marks, commits, testing).
- [`IMPROVEMENTS.md`](IMPROVEMENTS.md): every deliberate departure from the original.

The spec files use plain Markdown links; `python3 tools/speclinks.py` checks every link and anchor.

## Tools

Game files are not included. Point the tools at an extracted `POOLRAD/` folder from your own copy (the GOG release works: unpack the `.pkg` with `xar_extract.py`).

| Tool | Purpose |
|---|---|
| `xar_extract.py` | unpack the GOG Mac `.pkg` |
| `unexepack.py` | unpack the EXEPACK-compressed `START.EXE` |
| `mergeovr.py` | merge `GAME.OVR` overlays into one EXE for Ghidra |
| `dax.py` | DAX container and RLE decoder |
| `ecl.py` | ECL script disassembler |
| `eclvm.py` | headless ECL interpreter: runs area scripts from a save game, menus answered from a list, engine screens logged |
| `eclsweep.py` | runs every area's scripts from every square and facing; reports failures and the variables touched |
| `geo.py` | map decoder, ASCII and SVG renderer |
| `automap.py` | annotated automap HTML (areas, doors, events with their text and actions) |
| `gfx.py` | image decoder to PNG (EGA palette, animation frames) |
| `chars.py` | character and monster record decoder |
| `spells.py` | spell table extractor (from the unpacked `START.EXE`) |
| `speclinks.py` | checks every link and heading anchor in the repository's Markdown files |

Examples:

```sh
python3 tools/ecl.py POOLRAD/ECL2.DAX 20          # disassemble area 20 of block 2
python3 tools/eclvm.py POOLRAD --moves fffLrff    # walk from the shipped save
python3 tools/eclsweep.py POOLRAD                 # every area, every square
```

Output from `automap.py`, `gfx.py` and the interpreter contains game text and art; keep it local.

## Method

- Engine: `START.EXE` + `GAME.OVR` (Borland Turbo Pascal with overlays), unpacked and merged into one image, then analysed in Ghidra through REA and with objdump; CotAB the same way, diffed against the PoR findings
- Data formats confirmed against every shipped file (all 1,245 DAX records decode exactly)
- Script semantics checked by running all 29 areas through `eclvm.py`; see `spec/A-games/engine/ecl.md`, Validation
- The browser port repeats these checks in its tests: every PoR and every CotAB area run headless from many squares, and each game's profile is tested against that game's own files

## Server and accounts (optional)

The app works on its own, with everything kept in the browser. The small server in `server/` serves it and adds accounts: each player's saved games, autosave, characters, party, journal finds and settings are kept on the server (per game, in the original file formats) and synced to every browser they sign in on, with offline changes queued and clashes kept as conflict copies. The game files are never uploaded. Players sign up in Settings → Account (or by invite, or the admin CLI makes accounts); there is a recovery code instead of email, data export and account deletion.

```sh
cd web && npm ci && npm run build && cd ..
COOKIE_SECURE=0 node server/main.ts            # http://localhost:8080/ on a LAN (plain HTTP)
node server/admin.ts help                      # accounts, invites, stats
docker compose up -d --build                   # or with Docker (docker-compose.yml is an example to adapt)
```

[`docs/server.md`](docs/server.md) has the design, API, data layout, security model, configuration, the systemd unit, Docker, and what to do before running it publicly.

## Status

Open items are listed in [`spec/open-questions.md`](spec/open-questions.md) and, for the multi-game work, in [`docs/multi-game.md`](docs/multi-game.md). Nothing has been compared against the running original (DOSBox) yet.

## Credits and legal

*Pool of Radiance* and the Gold Box games were made by Strategic Simulations, Inc. under licence from TSR; the engine was led by Chuck Kroegel and the game designed with George MacDonald. *Advanced Dungeons & Dragons* and *Forgotten Realms* belong to Wizards of the Coast. This is an independent fan project, not affiliated with or endorsed by any of them. It contains no game data: to play, you need your own copy of the game. The journal entries, proclamations and tavern tales (from the printed Adventurer's Journal) and their maps come from the [Pool of Radiance Wiki](https://poolofradiance.fandom.com/wiki/Journal_Entries) on Fandom, used under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); sources in `web/src/data/journal.json`. *Curse of the Azure Bonds*' journal text comes from the [Gold Box Wiki](https://goldbox.fandom.com/wiki/Curse_of_the_Azure_Bonds/Journal) on Fandom, under the same licence (`web/src/data/coab-journal.json`).
