# CotAB data files and presentation (vs PoR)

> **Status: complete as a set of differences.** Normative. Part A of the
> [specification](../../README.md): Curse of the Azure Bonds v1.3 (GOG 1.0). Read the engine files
> of each subject first ([graphics.md](../engine/graphics.md), [maps-and-view.md](../engine/maps-and-view.md),
> [sound.md](../engine/sound.md), [input-and-menus.md](../engine/input-and-menus.md) §1). Evidence
> marks as in the README. The engine model's presentation data for CotAB is
> [B-model/profile.md §4.1](../../B-model/profile.md#41-cotabs-presentation-differences).

Scope: every DAX family, graphics, 3D view, overland, BIGPIC, title/start-up, copy protection, fonts, sound, palette.

**Conventions.** Addresses are offsets in the merged load image `coab/img.bin` (seg:ofs → seg·16+ofs; overlays already merged). **DS = image 0xABE0**, so `DS:x` = image 0xABE0+x (O: sky table found at both). PoR references point at the engine files. Names in brackets (`ovr031:0820` etc.) are the segment labels of the reference rebuild's IDA listing, used only to find routines. Every claim below was checked in the CotAB binary or data.


## 1. Containers

- All 86 `.DAX` files use the PoR container and RLE unchanged. `tools/dax.py`: 86/86 headers sum to the file size, and all **824/824** records decode exactly with the PoR RLE variant (O).
- Other files: `START.EXE` (EXEPACK, engine), `GAME.OVR` (Borland overlays, 36 units), `ITEMS` (2050 bytes, not a DAX, differs from PoR's), `CURSE.CFG` (4 lines, §8), `COPYCURS.EXE` (DOS utility that moves characters between PoR, CotAB and Hillsfar save disks), `INSTALL.BAT`, `codewheel.exe` (GOG Windows helper, UPX PE32, not used by the game), DOSBox confs (`autoexec`: `mount c "game"`, `start`), `SAVE/` (CHRDATAn.SAV/.FX, SAVGAMA.DAT).
- Block digit = `DS:5C08` ("game_area"; PoR `DS:5376`). The start-up code sets 1 for the demo and 2 for a real game (O, image 0x1F5–0x210). The file names are built at run time from lower-case Pascal strings followed by `.dax`: `"8x8d"`, `"bigpic"`, `"WALLDEF"`, `"GEO"`, `"PIC"`, `"SPRIT"`, `"CPIC"`, `"HEAD"`, `"BODY"`, `"ECL"`, `"ITEM"`, `"MON"`, `"sky"`, `"tiles"`, `"Title"`, `"COMSPR"`, `"CHEAD"`, `"CBODY"`, `"DungCom"/"WildCom"/"RandCom"` (O, strings at 0x26A94, 0x1C26B, 0x53606, 0x4E52, 0x54679 …).
- Loader `load_dax(record, flags, maskColour, &ptr, name)` = image **0x2371** (`0226:0111`). Picture draw `draw_picture(col, row, ptr)` = **0x3347** (`0226:10E7`; first pushed argument = text column, second = row, O from the title placements). Masked overlay `0x2C23` (`0226:09C3`). Free = `0x3F4C` (`0226:1CEC`). Recolour by 16-entry map = **0x3853** (`0226:15F3`).

## 2. Inventory

Graphics = PoR image block (17-byte header, 4 bpp, default EGA palette), so `tools/gfx.py` decodes every graphics record (O, all of them parse; samples rendered).

| Family | Files | Records (ids) | Shape | vs PoR |
|---|---|---|---|---|
| `TITLE` | 1 | 1, 2: 320×200; **3: 240×112**; **4: 320×112** | single | PoR has only #1, #2. #3/#4 are logo overlays (§7) |
| `BIGPIC` | **1, 2, 6** | 1: #121 (overland map), #123 (demon skull); 2: #120 (three hags); 6: #122 (night village) | single **304×120** | **new**; full-width pictures (§5) |
| `SKY` | 1 | #250 88×16 cloud strip, #251 24×24 sun, #252 88×48 horizon+cobbled ground | single, mask 13 | **new** (§3) |
| `TILES` | 1 | #1: 26 × 24×24 Espruar runes; #2: 22 × 24×24 Dethek runes | single, many sub-images | **new**; code-wheel only (§7) |
| `PIC1–6` | 6 | 56 records; #1 and #29 repeated in every block | animated 88×88, 1–8 frames, XOR deltas | same format. PIC2 #7 = PoR PIC2 #31; PIC4 #49 and PIC6 #64 = PoR records |
| `SPRIT1–6` | 6 | 46 | animated, 3 frames (one per distance), 8–88 × 49–80 | same format; 8 records identical to PoR ones |
| `HEAD2–6` / `BODY2–6` | 5+5 | 40 / 31 | 88×40 / 88×48 | same; no block 1 |
| `CHEAD` / `CBODY` / `COMSPR` | 1 each | 56 / 128 / 26 | 24×10 or 24×8 / 24×24 / 24×24 | **byte-identical to PoR** |
| `CPIC1–6` | 6 | 156 (pairs *n* and *n*+128) | 24×24, 48×24, 24×48, 48×48 | same scheme; 12 records identical to PoR |
| `DUNGCOM` / `WILDCOM` / `RANDCOM` | 1 each | #1: 25 / 34 / 6 tiles of 24×24 | single, many sub-images | same layout and counts, **new art** (1 tile in each equals PoR's) |
| `8X8D1` | 1 | #201 font, #202 **40** tiles, #203 45 tiles | 8×8 | #201 identical to PoR; #202: tiles 0–19 = PoR, 20–39 new; #203: 32 of 45 equal to PoR. **No wall sets** (PoR 8X8D1 had #1, #3, #5) |
| `8X8D2–6` | 5 | 70-tile wall-set banks: 2: 1–4; 3: 3, 5–7; 4: 3, 8–11; 5: 12, 8, **141, 142**; 6: 13, 16, 3, **171, 172** | 8×8 ×70 | same format; #3 is shared by blocks 2/3/4/6, #8 by 4/5 (identical bytes) |
| `WALLDEF2–6` | 5 | 2: 1–4; 3: 3, 5–7; 4: 3, 8–11; 5: 12, 8, **14 (2 sets)**; 6: 13, 16, 3, **17 (2 sets)** | 780 B per set (0x30C) | same format |
| `GEO2–6` | 5 | 16 records (2: 1, 3, 4; 3: 16, 17, 21; 4: 32, 33, 37; 5: 50, 51, 53; 6: 64, 66, 67, 69) | 1026 B | same (§3) |
| `ECL1–6` | 6 | 25 (1: **80, 81, 82** = overland, §4) | script | [ecl.md](ecl.md) |
| `ITEM1–6`, `MON1–6 CHA/ITM/SPC` | 30 | records of 126–3654 B (ITEM), 422 B (CHA) | data | [records.md](records.md) |

**Missing vs PoR (O: no file, no load string):** `SQRPACI` (PoR overland tiles), `BACPAC`, `ICON` and `FINAL`, plus block 1 of `GEO`/`WALLDEF`/`HEAD`/`BODY` and blocks 7–8 of everything. The strings `"ICON"` (0x56C4C) and `"FINAL"` (0x52EEB) survive only as name *comparisons* inside the shared loaders (combat-icon builder `0x56C50`, picture loader `0x52F03`). No code passes them as file names (I: dead PoR leftovers).

## 3. 3D view

### GEO and WALLDEF: unchanged (O)
- GEO loader `Load3DMap` **0x549AD** (`ovr031:130D`) still aborts unless the size is 0x402, then copies 4 planes of 0x100. PoR `tools/geo.py` decodes all 16 maps. Edge consistency is 100% in 12 maps and 88–99.6% in GEO5 #50/#51 and GEO6 #69. Header bytes are `00 04` in all of them. Passability values 0/1/2 are common; 3 occurs once. 2837 squares have event bit 7 set (indoor sky).
- `LoadWalldef` **0x546C5** (`ovr031:1025`): size / 0x30C sets, error if sets + slot > 4, tile bytes ≥ `DS:268C` (= 45) rebased by `DS:2682[slot] − DS:2684`. Bank bases `DS:2682` = [1, 46, 116, 186, 256], same as PoR `DS:2722` (O).
- **Tile record for multi-set WALLDEF:** `record·10 + k` (k = 1…n) (O, 0x54914–0x5492C: `mul 10; add k`). PoR's "(r or 10)" special case is not there. The data agree: WALLDEF5 #14 → 8X8D5 #141/#142, WALLDEF6 #17 → 8X8D6 #171/#172.
- `Load8x8D(slot, record)` **0x579C5** (`ovr038:0045`): `"8x8d"` + block digit, mask colour **13**. At init: bank 4 ← 8X8D1 **#202**, bank 0 ← 8X8D1 **#203**, with the block digit at 1 (O, 0x26FE5–0x26FF6).
- Piece tables are identical to PoR: start `DS:0ADA`, W `DS:0AE4`, H `DS:0AEE`, base column `DS:0AF8` (words), row `DS:0B0C` (= PoR `DS:0C8C…0CBE`, O byte compare). Direction vectors `DS:2696` (PoR `DS:2736`).
- Renderer `Draw3dWorld` **0x53EC0** (`ovr031:0820`) against PoR `FUN_55a0_05fd`: the same routine instruction for instruction, with the same constants (column offsets, walk lengths, piece kinds), so the same drawing order ([engine/maps-and-view.md, "Drawing order"](../engine/maps-and-view.md#drawing-order-painters-algorithm)). The only differences: `div` for `idiv` in the facing arithmetic (the same results for facings 0–6) and the final copy to the screen (`0226:12E8`) (O, normalised listing compare). Its wall lookup **0x53D42** returns 0 outside the map in areas 0 and 10 (`DS:8B78`, the current area, as NEW_ECL sets it) and otherwise wraps by one map, as PoR's; the piece blitter **0x53AD4** draws through the tile stub `019c:002a` with the same flags (O). Piece blitter **0x53AD4** (`ovr031:0434`). Overhead map **0x536AF** (`ovr031:000F`): wall tile `0x104 + mask`, party arrow `0x100 + facing/2` (O, 0x537E4).

### Background: the main change (O, `0x53824` = `ovr031:0184`)
`fill(col, y_px, w_cells, h_px, colour)` = `0226:1D67`. The view is 11 cells wide at screen pixels 24–111 on both axes (O: DOSBox screen dumps, 2026-10-22; earlier given as cell column 2, y 16–103), so view rows 0–87:

| Mode (`DS:5000`, §8) | Bands | Overlays |
|---|---|---|
| **CGA (0)** | sky `DS:7224` rows 0–42, line `DS:7225` row 43, band `DS:7226` rows 44–45, floor `DS:7227` rows 46–87 (= PoR's 4 bands) | none |
| **EGA (1) / Tandy (2)** | sky `DS:7224` rows 0–43, `DS:7226` rows 44–45, `DS:7227` rows 46–87 | SKY images, below |

EGA/Tandy overlays, drawn with `0226:09C3` (mask 13), at text cell (col, row):
1. Only if the **party's square** has event-byte bit 7 **clear** (`0116:0034` = `ovr031:07A5` < 0x80, i.e. outdoors) **and** the sky colour is **11** (day):
   - hour h = area word +0x192 (**ECL 0x4BC9**), facing `DS:722B`:
   - h 1–5: facing E → **sun #251** at (9, 7−h); facing S and h > 2 → at (h−1, 7−h)
   - h 13–18: facing W → sun at (2, h−11); facing S and **h < 16** → at (h−6, h−11). The binary tests `jae 16`; the reference rebuild has `>= 16`, which is wrong.
   - facing N → **cloud strip #250** at (2, 2), the top of the view
2. Always, day or night, indoors too: **ground #252** at (2, 7), view rows 40–87. The order is therefore bands, sun or clouds, ground, then the walls (`Draw3dWorld` calls 0x53824 first), and the sun can be hidden by the ground and by walls. Its rows 0–2 are colour 13 (transparent). Rows 3–7 are black / grey / grey / dark grey / black (the horizon), then cobbles. So on EGA the ground image hides the band and floor colours completely; only the sky colour and the sun or clouds show. `agents/png/view_bg_ega.png` shows N by day, E at h 3, W at h 15, and night.

Colours (O, `RedrawView` **0x52D0A** = `ovr029:00BA`):
- Sky = `DS:0A8A[v]`, with v = area word +0x1FC (**ECL 0x4BFE**) if the party square's event byte > 0x7F, else +0x1FA (**ECL 0x4BFD**). Table `DS:0A8A` = **0, 15, 4, 11, 13, 2, 9, 14** (repeated). PoR has 0, 15, **12**, 11, 13, **10**, 9, 14, so CotAB uses dark red and dark green where PoR uses the light ones.
- CGA, and only while `DS:8B81` ≠ 0: line/band/floor come from `DS:7603`/`DS:7602` through `0x52C64` (8 or 0x41 → 0, else 15), `0x52C98` (8 → 8, else 7) and `0x52CCC` (0x0B → 8, 6 → 1, 9/0xDB/other → 6). Same rules as PoR.
- EGA/Tandy: `DS:7227` := 8, and `DS:7225`/`7226` are never written (BSS 0). They are hidden by the ground image anyway.
- Area word +0x1F6 (**ECL 0x4BFB**) ≠ 0 → `DS:7228` := 0, which turns the overhead map off ("Not Here", as PoR 0x49FB).
- ECL area variables are **0x4B00–0x4EFF**, stored as *words* at area + (addr−0x4B00)·2 (O, writer 0x20722). PoR uses 0x4900 bytes. Writing 0x4BFD/0x4BFE sets `DS:8B84` (0x20749), PoR's DS:84E8: the main loop (0x1B7B9–0x1B7DA) tests it with DS:8B7C, 8B7F, 8B81 and 8B82 and, if any is set, redraws (DS:759A := 1, `10d:25`, `ed:d4`) and clears them all (0x1B7EB–0x1B7FF) (O). Writing **0x4BE6** switches `DS:4FD3` between 3 (overland) and 4 (3D).

### Sprites and pictures (O)
- `Show3DSprite` **0x5354D** (`ovr030:074D`): frame 1–3, drawn at header (x+2, y+2) through the masked overlay, as in PoR.
- Sprite remap tables `DS:0ABA` (identity) → `DS:0ACA` (identity except **13 → 0**), applied with `0x3853` unless CGA (0x532B4–0x532E0). Same as PoR.
- `load_pic_final` **0x52F03**: PIC frames 2+ are XORed with frame 1 (visual check with PIC2 #7). PIC1 #1 = treasure. `DS:72A4` = 0x50 (PIC #80, a farmhouse in PIC1) suppresses the overland redraw and cursor (§4).

## 4. Overland: no tile map (O)

CotAB has **no tile wilderness**. There is no SQRPACI, no 5×5 tile view and no movement-blocking table. The overland is **BIGPIC1 #121** (304×120 painted map of the Forgotten Realms region), driven by ECL menus:
- `0x4BE6` = 0 → `DS:4FD3` = 3 (overland state). `RedrawView` (0x52D0A) then draws the bigpic instead of the 3D view whenever `DS:759A` is set (0x52DE0 → `0110:0048`), and nothing otherwise: with A[0x1CC] = 0 it never draws the 3D view; it clears `DS:759A` first when the last PIC loaded is #80 (`DS:72A4` = 0x50, 0x52D10), and after drawing (O). `SETUP_MONSTER`'s sprite and picture are not loaded with no map (0x1FF88: A[0x1CC] = 0 skips the load at 0x1FFAF, O). Combat icons are `"CPIC"` + the block digit (`DS:5C08`, 0x56E91) like the other pictures, so a monster whose icon is in another block's file has none in this block (the forest patrols of ECL1 #80, I: what the screen shows then is not traced).
- `load_bigpic(id)` **0x5360C** (`ovr030:080C`): frees the current PIC animation, then loads `"bigpic"` + `DS:5C08` record *id*, unmasked, cached by id in `DS:72AA` (pointer `DS:72A6`). `draw_bigpic` **0x5367A**: frame layout `0x1582` (outer frame plus a divider row at text row 16, all from 8X8D1 #202 tiles 0x11E+), then the picture at **col 1, row 1**, i.e. pixels (8, 8)–(311, 127). Text uses rows 17–23.
- **City cursor** (`ovr028`, **0x52BD5 / 0x52BFE / 0x52C2D**): index = area byte +0x342 (**ECL 0x4CA1**). Cell x = `DS:0A4A[i]`, cell y = `DS:0A6A[i]`, 33 entries:
  - x: 4 12 21 11 29 20 38 21 30 31 25 37 28 29 3 12 25 29 29 33 19 16 9 16 20 21 25 25 26 31 37 34 15
  - y: 15 8 11 4 10 4 1 2 13 15 3 5 2 8 12 13 10 12 9 9 8 6 6 3 2 2 3 2 3 4 2 1 0
  - Screen position = (x·8, y·8). Entries 0–31 land on the map's town and road nodes (overlay check `overland_cursor_check.png`); entry 32 (15, 0) is on the frame (I: unused).
  - The cursor image is an 8×8 block filled with 0xFF (white; built at init, 0x26B6B–0x26B98, `DS:8C90`); the background is saved in `DS:65E4`.
- Blink, in the menu input loop `displayInput` **0x51C48** (`ovr027:03D8`), only when `DS:4FD3` = 3, `DS:72AA` = 0x79 and `DS:72A4` ≠ 0x50: on entry SetPosition, Draw, Restore. Then, against the centisecond clock (`04CE:0988`): draw when t ≥ T_on and set T_on = T_off + 30; restore when t ≥ T_off and set T_off = T_on + 50. On exit the cursor is restored (O; I: about 0.5 s on, 0.3 s off).
- **Travel logic lives in ECL1 #80/#81** (block 1). `on_enter` does `SAVE #0 → 0x4BE6`, `PICTURE #121`; `GET_TABLE … → 0x4CA1`; HMENU "ENTER CITY / JOURNEY ON / CAMP / SEARCH AREA" (O, from the script). After combat or `LOAD_AREA` with 0x4BE6 = 0 the engine reloads BIGPIC 0x79 (0x19527, 0x1A2B2, 0x3614A).
- So PoR's [engine/overland.md](../engine/overland.md) (tile grid, 12 h per step, river recolouring, party icon) does **not apply**: CotAB's travel is a picture, a blinking cursor and the script's menu.

## 5. BIGPIC uses (O)
| Id | File | Content | Shown by |
|---|---|---|---|
| 120 | BIGPIC2 | three hag/witch faces | ECL2 #4 `PICTURE #120` |
| 121 | BIGPIC1 | overland map | ECL1 #80/#81/#82; engine 0x19527, 0x1A2B2, 0x3614A |
| 122 | BIGPIC6 | night village under stars | engine end-game 0x3D459 (`ovr019`) |
| 123 | BIGPIC1 | horned demon skull | ECL1 #80, #82 `PICTURE #123` |

ECL `PICTURE` (0x0E) handler **0x190C3**: id ≥ **0x78** → `load_bigpic` + `draw_bigpic` (`0110:0043/0048`), else the PIC path (O, cmp at 0x19101).

## 6. Fonts, tiles, screen frames

**Frames (O, image 0x1330–0x1581).** 8X8D1 #202 has 40 tiles: 0–19 as PoR, **20–29 a yellow frame set, 30–39 a white one**. Bank 4 (#202) starts at tile id 0x100, so a frame routine's `0x11E + v` is tile 30 + v (white) and `0x114 + v` tile 20 + v (yellow). The screen frame `0x1330` draws, in this order, the top row (row 0) from `DS:0B50[col]`, the columns 0 and 39 over rows 0–23 from `DS:0BE2[row]` / `DS:0C0B[row]`, then the bottom row 23 from `DS:0BA0[col]`, all as 0x11E + value (white); the values are 0–9 (1 horizontal, 2 vertical, 0/3 corners, the rest knots). `0x1403` (the credits) adds rows 3 and 8 from `DS:0B78[col]`. `0x1466` adds yellow parts (0x114 + `DS:0BC6/0BD3/0C21/0C2E`). Mask colour 13 (`Load8x8D`). PoR's title credits use its rope tiles 20–22 instead.
- Font: only `8X8D1` #201 (`load_8x8d1_201` **0x4E5C**, file name fixed to `"8X8d1"`). **Byte-identical to PoR** (177 glyphs). 8X8D2–6 hold no font (O).
- 8X8D1 #202 (bank 4, ids 256–295): 0–3 facing arrows, 4–19 overhead-map wall masks (both = PoR), **20–29 (0x114–0x11D) and 30–39 (0x11E–0x127): two frame styles**. Style 0x114 is yellow on top, style 0x11E white; both have grey/black bevels. PoR has 11 frame tiles (20–30). Frames are drawn tile by tile from tables: outer frame `0x1330` (`seg037`): top `DS:0B50`, bottom `DS:0BA0`, left `DS:0BE2`, right `DS:0C0B` (+0x11E). Credits frame `0x1403`, overland frame `0x1582`, 3D-screen frame `0x1466` (O for the code; I for which screen uses `0x1466`; full set in `seg037` at 0x1330–0x17FD).

## 7. Start-up, title, copy protection (O)
Main program (image 0x2F–0x360):
1. TP unit inits; config reader (§8, 0x1FE0–0x225F).
2. Sound ISR on (`0x6A64`); InitFirst **0x26AA9** (`ovr012`): allocations, cursor images, game_area := 1, **SKY #250/#251/#252** (mask 13) into `DS:723A/723E/7242`, 8X8D1 #202/#203, COMSPR, ITEMS, font.
3. If ParamStr(1) = `"STING"` (string at image 0x1) skip the title (O: 0x169–0x17A, as PoR).
4. `title_screen` **0x18702** (`ovr002:0632`), with `delay_or_key(n)` = **0x180D0** (n s, key flush before and after):
   - TITLE #1 at (0, 0); wait 5. If `DS:4FB1` = 0 (CFG line 4 ≠ `F`) stop here.
   - TITLE #2 at (0, 0); immediately TITLE #3 overlaid at **col 6, row 11** (48, 88); wait 10.
   - **PlaySound(13)** (`DS:25C8`), TITLE #4 at **col 0, row 11** (0, 88); wait 10.
   - Clear; credits **0x182AD**; wait 10; clear.
   - **No lightning** (PoR flashes palette register 1 on title 2).
5. Credits (frame `0x1403`, then `print(str, colour, row, col)` = `04CE:0349`). (col, row, colour):

   | Text | Placement |
   |---|---|
   | `based on the tsr novel "azure bonds"` | (2, 1, 10) |
   | `by:`, `kate novak`, `and`, `jeff grubb` | (6, 2, 10), (9, 2, 11), (20, 2, 10), (24, 2, 11) |
   | `scenario created by:` | (10, 4, 10) |
   | `tsr, inc.`, `and`, `ssi` | (11, 5, 14), (21, 5, 10), (25, 5, 14) |
   | `jeff grubb`, `george mac donald` | (14, 6, 11), (11, 7, 11) |
   | `game created by:`, `ssi special projects` | (1, 9, 10), (18, 9, 14) |
   | left column: `project leader:`, `george mac donald`, `programming:`, `scot bayless`, `russ brown`, `michael mancuso`, `development:`, `david shelley`, `michael mancuso`, `oran kangas` | col 2, rows 11/12, 14–17, 19–22; headings colour 14, names 11 |
   | right column: `graphic arts:`, `tom wahl`, `fred butts`, `susan manley`, `mark johnson`, `cyrus lum`, `playtesting:`, `jim jennings`, `james kucera`, `rick white`, `robert daly` | col 22, rows 11–16, 18–22; same colours |
6. `displayInput` (0x51C48) with the "Play Demo" menu, timeout default `'D'` (`DS:72B4`) after 30 s (DS:72B0 = 3000 hundredths of a second, O: the DOS clock 0x5668). **D** → demo (`DS:4FD5` = 1, block 1, speed 9; [`ecl.md`, "Start-up menu and demo"](ecl.md#start-up-menu-and-demo-o)). Otherwise **copy protection**, then block 2 and `startGameMenu` **0x36A1C**. The loop re-runs the title after a demo.
7. **Copy protection** **0x1C378** (`ovr004:0118`):
   - Loads TILES #1 into icon slots 0–25 and #2 into slots 26–47 (`012A:0025`); outer frame.
   - Text "Align the espruar and dethek runes / shown below, on translation wheel / like this:".
   - Random Espruar rune a (0–25) and Dethek rune b (0–21) drawn as 24×24 tiles; random path p (0–2: `-..-..-..`, `- - - - -`, `.........`); random ring r (0–5).
   - Asks for "the character in box number 6−r".
   - Expected = `DS:0002`-table row r, index (a + 34 − b + 12p + 2(5−r)) mod 36. The table is six 36-character Pascal strings at **DS:0002** (image 0xABE2), starting `CWLNRTESSCEDCSHS…`; the last row is `A…Z1…0`.
   - 3 tries. On failure PlaySound(1), PlaySound(5), "An unseen force hurls you into the abyss!", exit (O: constants 0x1A, 0x16, 0xC, 0x22, ±0x24 at 0x1C422–0x1C5B3).
   - **This binary is patched** (O, the GOG release, 0x1C621–0x1C658): the compare of the typed character with the expected one is followed by `JNE` (75 1C) to the success exit, so any character **but the right one** is accepted at once; the right one prints "Sorry, that's incorrect." and counts a try. As PoR's patched check ([por/title-and-credits.md](../por/title-and-credits.md), "Copy protection"), a crack in the shipped files; `#` (never in the table) always passes (checked in DOSBox, 2026-10-22, `tools/dosbox/`). The same routine serves script opcode 0x3C ([ecl.md](ecl.md)).

## 8. Config, video, palette, sound
**CURSE.CFG** (shipped `E`, `P`, `C:\SAVE\`, `F`), reader at 0x1FE0–0x225F (O):

| Line | Values | Effect |
|---|---|---|
| 1 | `E` / `T` / other | `DS:5000` = 1 EGA (mode 0Dh), 2 Tandy (mode 09h; top-of-memory pointer lowered by 0x400 paragraphs), 0 CGA (mode 04h) |
| 2 | `T` / `P` / other | `DS:5C04` = **1 Tandy / 0 PC speaker** / 2 none. The codes are swapped vs PoR (`DS:5372`: T=0, P=1); the behaviour is the same |
| 3 | path | save path → `DS:5C0A` |
| 4 | `F` / other | `DS:4FB1` = 1 enables the full intro (PoR line 5 `DS:49D1`) |

CotAB has no separate data-path line (PoR has 5 lines).

**Palette.** Default EGA palette; no palette data in any file. Changes go through INT 10h AX=1000h via TP `Intr` (`0x43A2`, colours ≥ 8 sent +8; raw variant `0x43DF` for Tandy):
- combat swap reg 0 ↔ colour 8 and reg 8 ↔ colour 0, and restore, in `ovr033` 0x557AC–0x5580C (same as PoR, O);
- end-game flash `0x3BF78`: reg 9 := 15, Delay(1), reg 9 := 9 (EGA via 0x43A2, Tandy via 0x43DF), called twice from the end-game animation (0x3C6A2, 0x3C77B).

There are no other palette writes and no port 3C0h access (O).

**Sound driver.** Resident `seg044` at **image 0x6990**, data segment = its own paragraph `0x0699` (PoR `0x08AE`). Code and data are **identical to PoR's** after a −0xBD offset shift: CotAB offset = PoR CS offset − 0xBD.
- Entry points: install 0x7C4F (PoR 137C), uninstall 0x7C84 (13B1), ISR 0x7CBD (13EA), PC tick 0x7D4A, Tandy tick 0x7DBF, step 0x7E4D, interpreter 0x7EDE, start-PC **0x8015** (1742), start-Tandy **0x8081** (17AE), enable 0x80ED.
- **All 21 effects** in both the PC table (`0699:04A2`) and the Tandy table (`0699:054A`) point at the same bytecode as PoR's after normalisation. All 155 remaining byte differences in 0x1D8–0x1830 are pointer words shifted by 0xBD or the segment constant (O, `agents/cmp`-style diff). `tools/sound.py` renders can be reused unchanged.
- Pascal `PlaySound(n)` **0x69B0** differs from PoR:
  - n ∈ set check, return if mode 2;
  - 0 → start(0) on both devices;
  - 1 → enable;
  - **0xFF → start(0) on both, uninstall the INT 08h hook, `DS:5C06` := 0**;
  - 2–14 → start effect n−1 on the PC (mode 0) or Tandy (mode 1);
  - **15 → watchdog `0699:011E` := 5000** ticks, about 21 s to the fake "Run-time Error 209". No caller pushes 15 (?).
  - **There is no PoR-style 10-cs "transient" cut-off** (no `DS:5374` logic). Reinstall = `0x6A64` (`DS:5C06` := 1). The main program brackets its overlay calls with PlaySound(0xFF) and `0x6A64` when `DS:5C06` says so (O; I: keeps the timer hook out of disk and overlay loads). Effects otherwise play to the end (O: 0x69B0 starts the effect and returns, with no delay and no stop).
- Constant table `DS:25AC` = 0xFF, `25AE` = 0, `25B0` = 1, …, `25CC` = 15. Call counts: 0×4, 1×5, 2×2, 3×1, 4×1, 5×3, 6×2, 7×2, 8×1, 9×3, 10×7, 11×2, 12×2, 13×1 (title).

## 9. Summary of differences

Each difference above is profile data in part B: [B-model/profile.md §4.1](../../B-model/profile.md#41-cotabs-presentation-differences).

## Open
- ~~`DS:8B81` and `DS:8B84`~~: 8B81 is PoR's DS:84E5, set by the VM reset (0x1FBDC, after DS:7602 := 0x41
  and DS:7603 := 9) and by script writes to registers 0xC059 and 0xC05F (0x208C2, 0x208D4), read only by
  the band recompute (0x52D75) and only when DS:5000 = 0 (CGA); 8B84 is set only by writes to ECL
  0x4BFD/0x4BFE (§5, O). The demo prompt's timeout is 30 s (§7 step 6).
- ~~Who calls PlaySound(15)~~: nobody: all 55 far calls of 0x69B0 push a word of DS:25AC–25C8 (255 and
  0–13); DS:25CC, which holds 15, is never referenced and no caller indexes the table (O, byte search).
- ~~The frame routines `0x16C7`/`0x17BD`~~: 0x16C7 is the combat screen's frame: it clears the screen
  (0x17FD with 0, 0, 0x27, 0x17), then draws rows 0 (DS:0B50) and 22 (DS:0BA0) and columns 0, 22 and 39
  over rows 0–22 (DS:0C3D, 0C54, 0C6B) as tile 0x11E + v (white); its only caller is the combat screen
  draw 0x4FE10 (`133:397`). 0x17BD is the outer frame (0x1330) plus row 2 from DS:0B78: the character
  display 0x409AC calls it at 0x40AA9 outside combat with an argument other than 2 (in combat,
  DS:4FD3 = 5, 0x1330 alone; with argument 2 `133:292`), and 0x3DBC7 at 0x3ED5C (an item-list screen,
  I) (O).
