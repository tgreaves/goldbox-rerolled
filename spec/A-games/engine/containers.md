---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Containers and compression

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Everything here is **O** (observed), checked against every file of
> the release. *Informative:* reference decoders in `tools/` (`xar_extract.py`, `unexepack.py`,
> `mergeovr.py`, `dax.py`). Curse of the Azure Bonds uses the same containers
> ([coab/assets.md](../coab/assets.md) §1; its working image: [coab/README.md](../coab/README.md#working-image));
> Secret of the Silver Blades the same but for its overlay file's header (TPOV, below;
> [sotsb/README.md](../sotsb/README.md)).

## Distribution (GOG Mac package)

- `.pkg` is a xar archive (`tools/xar_extract.py`): zlib TOC, heap after it
- `package.pkg/Scripts` is gzip+cpio; game lives at `payload/Contents/Resources/game/POOLRAD/`
- The Mac app is DOSBox; the game itself is the unmodified DOS release

## START.EXE: Microsoft EXEPACK

- Packed MZ: zero relocations in header, entry at `CS:0012` of a 1455-byte stub with `RB` signature and "Packed file is corrupt"
- Stub header at `CS:0`: `real_IP, real_CS, mem_start, exepack_size, real_SP, real_SS, dest_len(paras), skip_len, "RB"`
- Unpack (`tools/unexepack.py`): decompress backwards from `CS*16 - (skip_len-1)*16`, skipping `0xFF` padding; commands `0xB0` fill / `0xB2` copy with 16-bit length, bit 0 = last
- Relocation table follows the error message: 16 groups of `count:u16, offsets:u16[count]`, group *i* has segment `i*0x1000`
- Result: 561 relocations, real entry `0000:0006`, SS:SP `14F2:4000`; decompression ends with source == destination (0x151)

## GAME.OVR: Borland overlays

- File: `"FBOV"`, `u32 size`, then overlay code blobs
- Each overlaid unit has a stub segment in the EXE:

| Offset | Field |
|---|---|
| 0x00 | `CD 3F` (INT 3Fh) |
| 0x02 | `u16` 0 |
| 0x04 | `u32` offset of code in `GAME.OVR` |
| 0x08 | `u16` code size |
| 0x0A | `u16` fixup size (bytes, list of `u16` offsets) |
| 0x0C | `u16` entry count |
| 0x0E | `u16` previous stub segment |
| 0x20 | entries, 5 bytes each: `CD 3F <ofs:u16> 00` |

- Fixups are offsets within the overlay code of segment words relative to the image start (same convention as MZ relocations)
- 35 units; blobs are contiguous and cover all 206,105 bytes
- `tools/mergeovr.py` places each unit in a new paragraph-aligned segment above the stack (from para 0x1900), rewrites each entry to `EA ofs seg` (JMP FAR) and adds all fixups as MZ relocations (5195 total). Analysis only; the merged EXE is not intended to run.

**TPOV** (Secret of the Silver Blades, O): the file is `"TPOV"` and the overlay code blobs, with no size
word: the first blob is at offset 4. Its START.EXE's overlay manager (`OvrInit`, unpacked image 0xC0F1)
compares the words `'TP'`, `'OV'` at the base of the overlay data, keeps that base (DS:5962/5964) and
reads each unit at base + the stub's offset. The stubs are FBOV's (the table above). 37 units,
contiguous from offset 4 over all 278 528 bytes; some entries hold the offset 0xFFFF (an entry with no
code), which `mergeovr.py` leaves as `INT 3Fh`. Merged from paragraph 0x1D00, 6 972 relocations. The
older Turbo Pascal overlay header (**I**: TPOV is the Turbo Pascal 5.x/6.0 manager's, FBOV Borland
Pascal 7's).

## DAX archives

All adventure data uses one container.

```
u16  header_len                  // multiple of 9
repeat header_len/9:
  u8   id                        // record id
  u32  offset                    // from start of data area
  u16  raw_size                  // decompressed size
  u16  comp_size                 // stored size
data area starts at 2 + header_len
```

- Engine loader `FUN_1802_0716(&ptr, &size, id, filename)`: linear scan for `id`; aborts if `comp_size > 36000`
- Filenames are built at runtime: `<family><block digit>.DAX`, e.g. `ECL3.DAX`; the block digit is a global (`DS:5376`), values 1–8
- Validated: 113 files, header sums equal file size in all of them (SotSB: 36 files, 665 records, the same format and RLE rule)

## RLE

Engine routine `FUN_1802_050f`. For each control byte `n` in the stored stream:

| `n` | Action |
|---|---|
| `0x00–0x7E` | copy the next `n+1` bytes literally |
| `0x81–0xFF` | write the next byte `256-n` times |
| `0x7F`, `0x80` | not handled by the engine (would loop forever); never present in data |

Validated: all 1245 records decode to exactly `raw_size` while consuming exactly `comp_size`.

## Open

- None.
