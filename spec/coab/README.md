# Curse of the Azure Bonds (CotAB)

The second Gold Box game for GoldBox Rerolled. These files describe CotAB (DOS, GOG 1.0) as
differences from the Pool of Radiance spec in [[spec/README]]: anything not mentioned works as in
Pool of Radiance. Every finding is marked **O** (observed in the CotAB binary or data), **I**
(inferred) or **?** (unknown), with image addresses.

| File | Covers |
|---|---|
| [[spec/coab/ecl]] | the ECL script VM: code at 0x8000, address spaces A 0x4B00 / B 0x7C00 / C 0x7A00, opcodes 0x3E–0x40 new, changed opcodes, CALL targets |
| [[spec/coab/records]] | the 422-byte character record, items (.SWG), effects (.FX), SAVGAM (13 149 bytes), monsters, the roster (*.guy), the Pool of Radiance character import |
| [[spec/coab/tables]] | DS base 0x0ABE (image 0xABE0); every rules table the port reads, PoR → CotAB addresses; level caps, classes, spells (100 ids, 5 levels), hit points, slots |
| [[spec/coab/assets]] | DAX families (new SKY, BIGPIC, TILES; no SQRPACI/BACPAC/ICON/FINAL), the 3D view's sky, the BIGPIC overland, title and start-up, code wheel, sound |

## Working image

Addresses are offsets in the CotAB engine image with the overlays merged in, built from the
player's files as for Pool of Radiance:

1. `python3 tools/unexepack.py START.EXE start.exe`
2. `python3 tools/mergeovr.py start.exe GAME.OVR merged.exe` (36 overlay stubs, overlay segments from paragraph 0x1800)
3. drop the MZ header (`e_cparhdr` × 16 bytes): `img.bin`; `objdump -D -b binary -mi8086 img.bin`

Image paragraph S is Ghidra segment S + 0x1000. DS = paragraph 0x0ABE, so DS:x = image 0xABE0 + x.

## Tools

`tools/coab/ecl_coab.py` (ECL disassembler: all 25 records of ECL1–6 decode),
`tools/coab/records_coab.py` (characters, monsters, the Pool of Radiance import),
`tools/coab/tables_coab.py` (dumps the rules tables from `img.bin`).

Research 2026-10-19. Simeon Pilgrim's C# rebuild of CotAB was used only to find routines; it has
no licence, so nothing from it is copied and every fact here is checked in the CotAB files.
