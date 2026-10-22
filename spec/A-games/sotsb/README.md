# Secret of the Silver Blades (SotSB)

> **Status: research started (2026-10-22).** Part A of the [specification](../../README.md):
> *Secret of the Silver Blades* (DOS, GOG 1.0). Evidence marks as in the README (**O** here means
> observed in the SotSB binary or data); addresses are image offsets in the working image below.
> Like [coab/](../coab/README.md), the files here are to be read as differences from the engine files
> of the same subject; so far only the identity, the working image and the containers are written.

## Identity

| | |
|---|---|
| Release | GOG `secret_of_the_silver_blades_enUS_1_0_33010.pkg`, game folder `payload/Contents/Resources/game/` (the files sit there directly, not in a sub-folder) |
| Configuration file | `BLADES.CFG` (`E`, `A`, `M`, `C:\SAVE\`, `F`, then a run of `0` lines; **?** for the meaning of the later lines) |
| `START.EXE` | 72 097 bytes, SHA-256 `8b937984878ec72aa531335dd381a21bda67675408b5fd8e716a35ccd049999e`; Microsoft EXEPACK as PoR's ([engine/containers.md](../engine/containers.md#startexe-microsoft-exepack)): 82 208 bytes unpacked, entry `008B:0000`, SS:SP `1876:4000` |
| `GAME.OVR` | 278 528 bytes, SHA-256 `d4f900391703bbfd5a4f66703871b64782dff2307224cd2560e40e1b60779c80`; **TPOV** overlays, 37 units ([engine/containers.md, "GAME.OVR"](../engine/containers.md#gameovr-borland-overlays)) |
| Compiler | Turbo Pascal with the older TPOV overlay manager (**I**: 5.x/6.0; PoR and CotAB have Borland Pascal 7's FBOV). No runtime copyright string is left in the image |
| Data segment | the System start-up at image 0xC5D0: `mov dx, 0x0DE2; mov ds, dx`, so DS = paragraph 0x0DE2 and DS:x = image 0xDE20 + x (PoR 0x0C7C, CotAB 0x0ABE) (O) |
| Strings of note | `SOUND TYPE:  [1] AdLib` (a new sound device, **?**), `CURSE` (I: the import of Curse of the Azure Bonds characters, as CotAB's "Pool"), `vault.dat` (a new file, **?**), `*.guy` (the roster, as CotAB), `blades.cfg`; the names of the script opcodes (`ECL CLOCK`, `PICTURE`, `INPUT NUMBER`, `INPUT STRING` …) are in the image |

## Working image

Built from the player's files as for Pool of Radiance and CotAB:

1. `python3 tools/unexepack.py START.EXE start.exe`
2. `python3 tools/mergeovr.py start.exe GAME.OVR merged.exe` (37 stubs; TPOV, overlay segments from paragraph 0x1D00, 6 972 relocations)
3. drop the MZ header (`e_cparhdr` × 16 = 27 920 bytes): `img.bin` (386 384 bytes); `objdump -D -b binary -mi8086 img.bin`

Image paragraph S is Ghidra segment S + 0x1000. The output contains game code: it stays outside the
repository (`out/`).

## Files and DAX families (O)

Every DAX file uses the containers and RLE rule of [engine/containers.md](../engine/containers.md)
(36 files, 665 records, each decoding to its size; the port's reader agrees).

| Family | Files (records) | Against CotAB |
|---|---|---|
| `8X8D` | 1 (10), 2 (6), 3 (5), 5 (1) | |
| `BIGPIC` | 1 (2), 2 (2), 3 (4) | |
| `CBODY`, `CHEAD` | 128, 56 | CotAB also has `BODY`, `HEAD` |
| `COMSPR` | 26 | |
| `CPIC` | 1 (106) | |
| `DUNGCOM` | 1 | no `WILDCOM`, `RANDCOM`, `TILES` |
| `ECL`, `GEO` | blocks 1–3: ECL 5, 10, 7; GEO 4, 7, 6 | CotAB has blocks 1–6 |
| `ITEM` | 1 (16), 2 (17), 3 (6) | |
| `MON1CHA`, `MON1ITM`, `MON1SPC` | 70, 29, 50 | one monster block (CotAB 1–6) |
| `PIC` | 1–5 (8, 9, 10, 7, 4) | |
| `SKY`, `SOUND`, `SPRIT1`, `TITLE` | 3, 2, 34, 4 | |
| `WALLDEF` | 1 (4), 2 (4), 3 (2) | |

Other files: `ITEMS` (2 050 bytes, the size of PoR's and CotAB's), `SAVGAMA.DAT` (**5 469** bytes;
CotAB 13 149), the pre-made party `CHRDATA1–6.SAV` (**439** bytes each, a new record size: CotAB's
is 422) with effects in `CHRDATA*.SFX` (9-byte records, as `.SPC`/`.FX`; only for members with
effects), and no item files for the pre-made party.

## Tools

`tools/mergeovr.py` (takes TPOV since 2026-10-22), `tools/unexepack.py`, `tools/dax.py`. No
SotSB-specific tool yet.

## Open

- Every subject has its file ([records.md](records.md), [tables.md](tables.md), [ecl.md](ecl.md),
  [assets.md](assets.md), [music.md](music.md), [spells.md](spells.md), [effects.md](effects.md),
  [combat.md](combat.md), [camp.md](camp.md), [chargen-and-progression.md](chargen-and-progression.md)),
  each with its own "Open".
- The register of open questions: [open-questions.md](../../open-questions.md).
