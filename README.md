# Pool of Radiance reverse engineering

A specification of SSI's *Pool of Radiance* (1988, MS-DOS release), detailed enough to recreate the game, for example in a web browser, plus Python tools that read the original data files.

The work concentrates on the split between the engine and the data that drives the adventure: maps, scripts, text, monsters, items and graphics.

## Layout

- [`spec/`](spec/README.md): the specification. Every statement is marked **O** (observed in the engine code or data), **I** (inferred) or **?** (unknown). Start at `spec/README.md`.
- `tools/`: Python 3, standard library only.
- [`docs/requirements.md`](docs/requirements.md): requirements and design for the browser port.
- [`IMPROVEMENTS.md`](IMPROVEMENTS.md): every deliberate departure from the original.

The spec files use Obsidian-style `[[spec/name]]` links; they map to `spec/name.md`.

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

Examples:

```sh
python3 tools/ecl.py POOLRAD/ECL2.DAX 20          # disassemble area 20 of block 2
python3 tools/eclvm.py POOLRAD --moves fffLrff    # walk from the shipped save
python3 tools/eclsweep.py POOLRAD                 # every area, every square
```

Output from `automap.py`, `gfx.py` and the interpreter contains game text and art; keep it local.

## Method

- Engine: `START.EXE` + `GAME.OVR` (Borland Turbo Pascal with overlays), unpacked and merged into one image, then analysed in Ghidra through REA
- Data formats confirmed against every shipped file (all 1,245 DAX records decode exactly)
- Script semantics checked by running all 29 areas through `eclvm.py`; see `spec/ecl.md`, Validation

## Status

Open items are listed in [`spec/open-questions.md`](spec/open-questions.md). Nothing has been compared against the running original (DOSBox) yet.
