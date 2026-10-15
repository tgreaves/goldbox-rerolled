---
created: 2026-10-15
tags: [reverse-engineering, retro, gold-box]
---

# Pool of Radiance reverse engineering

Experiment using REA (Ghidra 12.1.4 backend) to understand how SSI's Gold Box engine separates the engine from the adventure data.

## Goal

- Work out the engine/data boundary: what the executable hardcodes vs what the data files drive (maps, events, encounters, text, graphics)

## Platform decision

- **MS-DOS version** chosen (2026-10-15)
  - Ghidra handles DOS MZ executables; REA verifies MZ load images
  - DOSBox-X debugger available for runtime confirmation
  - Prior art: Simeon Pilgrim's *coab* (C# rebuild of DOS *Curse of the Azure Bonds*, same engine generation); Gold Box modding community docs on `.DAX` files
- Rejected: C64 (original, but weak 6502 decompilation, disk loaders), Amiga/Mac (68k decompiles well but non-built-in loaders, little prior art), NES (heavily reworked port)
- Source for files: GOG *Forgotten Realms: The Archives* bundle (unconfirmed which collection) or original disks

## Outcome wanted (2026-10-15)

- A formal specification complete enough to recreate the game in a web browser: [[spec/README]]
- Then modern helper features, e.g. a better automap (`tools/geo.py` already renders maps with events and door types as SVG)

## Layout

- `spec/`: the specification (observed vs inferred marked throughout)
- `tools/`: Python tools, stdlib only. Game files are not in the vault; point the tools at an extracted `POOLRAD/` folder
  - `xar_extract.py`: unpack the GOG `.pkg`
  - `unexepack.py`: unpack `START.EXE`
  - `mergeovr.py`: merge `GAME.OVR` into one EXE for Ghidra
  - `dax.py`: DAX container + RLE
  - `ecl.py`: ECL disassembler
  - `geo.py`: map decoder, ASCII/SVG renderer
  - `gfx.py`: image decoder → PNG (EGA palette)
  - `chars.py`: character / monster record decoder

## Plan

1. Inventory the install: which files are code, which are data
2. `.DAX` container format: header, record IDs, compression; find the decompressor in the exe and write a matching decoder
3. Maps (`GEO*` per community naming): grid layout, wall/door flags, link to wall graphics sets
4. ECL scripts: find the interpreter's opcode dispatch in the exe, list opcodes and operand encoding, build a script disassembler
5. Hooks: how scripts attach to map squares/areas, and how they call into combat, shops, text, monsters
6. Boundary summary: what stays hardcoded (rules, combat, spells?) vs data-driven

## Findings

### Source files (2026-10-15)

- GOG Mac release `pool_of_radiance_enUS_1_3_31236.pkg` = DOSBox wrapper around the original DOS game
  - Unpacked by hand: xar → `package.pkg/Scripts` (gzip cpio) → `payload/Contents/Resources/game/POOLRAD/`
- Engine: `START.EXE` (65 KB) + `GAME.OVR` (206 KB). Everything else is data: 113 `.DAX` files numbered 1–8 per family, plus `ITEMS`, `CHRDAT*`, `SAVGAM*.DAT`, `POOL.CFG`

### Engine build

- Borland Turbo Pascal with Borland overlays (`FBOV` signature; runtime says "Copyright 1983,91 Borland", probably TP 6.0)
- `START.EXE` is **EXEPACK-compressed**: Ghidra sees only the packed bytes until it's unpacked
  - Wrote an unpacker; 561 relocations, decompression ends with source and destination pointers meeting exactly
- `GAME.OVR` = 35 overlay units, merged back into one EXE (stubs patched to `JMP FAR`, overlay fixups added as relocations) so Ghidra sees the whole engine
- Data filenames built at runtime: prefix + block digit + `.dax` (e.g. `"ECL" + "3" + ".dax"`)

### DAX container (confirmed in data and in engine code)

- `u16 header_len`, then `header_len/9` entries of `id:u8, offset:u32, raw_size:u16, comp_size:u16`; data starts at `2 + header_len`
- Compression is byte RLE: `n < 0x7F` → copy next `n+1` bytes; `n > 0x80` → repeat next byte `256-n` times (`0x7F`/`0x80` never emitted)
- Decoder validated: all 1245 records in all 113 files decode to exactly their stated size
- Engine side: generic loader `FUN_1802_0716(&ptr,&size,id,filename)` scans header for record id, refuses comp size > 36000, calls RLE routine `FUN_1802_050f`
- GEO records are 1026 bytes = 2 + 16×16×4 (16×16 grid, 4 bytes per square)

### ECL scripts

- Loader `FUN_2fea_0341(id)`: clears a fixed 0x1E00 (7.5 KB) buffer, loads `ECL<block>.dax` record, skips first 2 bytes, copies rest in
- **Interpreter dispatch** `FUN_29c3_2f2d`: opcode byte at `DS:0x6F7F`, opcodes 0x00–0x3D, one handler per opcode or group (0x04–07, 0x11–12, 0x16–1B, 0x21/37, 0x25–26, 0x2F–30 shared; 0x1F has no handler)
- Opcode 0x20 runs `FUN_29c3_0bd1`, which loads a new area + its ECL: scripts themselves drive area transitions
- Inferred, not yet confirmed: 0x16–0x1B = the six comparison IFs, 0x04–0x07 = arithmetic
