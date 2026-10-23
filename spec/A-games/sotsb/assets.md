# SotSB data files and presentation (vs CotAB)

> **Status: first pass (2026-10-22).** Part A of the [specification](../../README.md): Secret of the
> Silver Blades v1.30 (GOG 1.0). Read [coab/assets.md](../coab/assets.md) first: this file gives the
> differences from Curse of the Azure Bonds, which in turn differs from the engine files
> ([graphics.md](../engine/graphics.md), [maps-and-view.md](../engine/maps-and-view.md),
> [sound.md](../engine/sound.md), [input-and-menus.md](../engine/input-and-menus.md)). Evidence
> marks as in the README; **O** is read in the SotSB binary or data.

Scope: every graphics DAX family, the 3D view's background, BIGPIC, start-up and title, credits,
fonts and frame tiles, the configuration file, video and sound.

**Conventions.** Addresses are offsets in SotSB's working image (`img.bin`, [README.md](README.md#working-image));
**DS = image 0xDE20**, so `DS:x` = image 0xDE20 + x. A far call `seg:off` goes to image seg·16 + off
(through an overlay stub where the target is an overlay unit). The disassembler prints DS offsets of
0x8000 and above as negative numbers (`-0x7618` is `DS:89E8`); they are given here unsigned.

## 1. Graphics inventory (O)

Every graphics record is the PoR image block (17-byte header, 4 bits a pixel, default EGA palette) and
decodes with `tools/gfx.py`; "= CotAB" means byte-identical records.

| Family | Records (ids) | Shape | Against CotAB |
|---|---|---|---|
| `TITLE` | 1, 2: 320×200; 3: 288×88; 4: 248×88 | single | new art; #1 the SSI and AD&D screen, #2 the ice castle under the mountains, #3 the "Forgotten Realms … Vol. III" banner and #4 the game's title, both with the castle picture behind (**I**, art) |
| `BIGPIC1–3` | 1: #112, #113; 2: #114, #119; 3: #115–118 | single 304×120 | 8 new pictures (CotAB's are #120–123); #119 is a valley under a glacier, the others scenes in caves and the glacier (**I**, art) |
| `SKY` | #250 88×16, #251 24×24, #252 88×48 | single, mask 13 | **= CotAB** (all three) |
| `PIC1–5` | 38 records, 1–8 frames | animated 88×88, XOR deltas | new; PIC2 #31 = CotAB PIC6 #69 |
| `SPRIT1` | 34 records, 3 frames | 24–88 × 65–88 | new, one block only |
| `CPIC1` | 106 (pairs *n*, *n* + 128) | 24×24, 48×24, 24×48, 48×48 | 14 = CotAB; one block only |
| `CHEAD` / `CBODY` / `COMSPR` | 56 / 128 / 26 | as CotAB | = CotAB except CHEAD #74, #202 and CBODY #11, #139; COMSPR = CotAB = PoR |
| `DUNGCOM` | #1: 30 tiles of 24×24 | single, many sub-images | new art (CotAB 25 tiles); none equal to PoR's or CotAB's |
| `8X8D1` | #202 **101** tiles, #203 45 tiles; wall-set banks #19, #71, #72, #101, #102, #211–213 | 8×8 | #202 tiles 0–30 = PoR's #202 (arrows, map masks, the rope frame); #203: 41 of 45 = CotAB's; wall sets in block 1 again (CotAB's 8X8D1 has none) |
| `8X8D2`, `8X8D3` | 2: #6, #9, #11, #12, #151, #152; 3: #31–33, #131, #132 | 8×8 × 70 | wall-set banks |
| `8X8D5` | **#201 only: the font** | 177 glyphs | = CotAB's 8X8D1 #201 = PoR's |

Not in SotSB: `HEAD`/`BODY` (the large portraits), `WILDCOM`, `RANDCOM`, `TILES` (CotAB's code-wheel
runes), PoR's `SQRPACI`, `FINAL`, and blocks 4–6. The loaders' names `"HEAD"`/`"BODY"` survive
(0x59B73, "head not found"), with no file behind them (**I**: a dead leftover, as CotAB's `ICON`).

**Wall sets.** WALLDEF records of *n* sets take their tiles from 8X8D records `record·10 + k`
(k = 1…*n*), CotAB's rule (O by the data: WALLDEF1 #7, #10, #21 → 8X8D1 #71/72, #101/102, #211–213;
WALLDEF2 #1, #15 → 8X8D2 #11/12, #151/152; WALLDEF3 #3, #13 → 8X8D3 #31–33, #131/132; single sets by
their own id). The WALLDEF set size is 0x30C (0x5AF0A) and a GEO record must be 0x402 bytes
(0x5B1DE), as before.

**Which file a picture comes from** (O). The files are named by the block digit `DS:7420`, but two
loaders override it, so the one-block families serve every block:

- the picture loader (0x595CD–0x597A1, the strings "PIC", "FINAL", "SPRIT", "1", "4", "5" at 0x595E3):
  digit := Str(`DS:7420`) (0x596CE); a `SPRIT` load takes "1" (0x596ED–0x59707); a `PIC` load of record
  0x06, 0x3B, 0x3C, 0x42, 0x45, 0x47 or 0x59 takes "4" (0x5970C–0x59755), of record 0x01, 0x11, 0x4D or
  0x1B "5" (0x5975A–0x59791). The data agree: PIC4 holds exactly the first set and PIC5 the second;
- the combat-picture loader (0x5D3BF; strings "CHEAD", "CBODY", "COMSPR", "ICON", "CPIC", "1" at
  0x5D3A0): CHEAD and CBODY (the icon parts) take a path of their own (0x5D427), COMSPR and ICON another (0x5D4F2); for the rest the digit := Str(`DS:7420`) (0x5D59E) and
  `CPIC` takes "1" (0x5D5BF–0x5D5DA). LOAD_MONSTER calls it with "CPIC" (0x1E0A6 → stub `195:39`).

CotAB's picture loader has no such override (its strings at 0x52EE6 are "PIC", "FINAL", ".dax" only).
*Port:* the profile's `pictureFiles` ([B-model/files-and-detection.md §4](../../B-model/files-and-detection.md#4-the-asset-viewers-families)), read by `GameFiles.picture`.

**Banks.** `Load8x8D(record, slot)` (stub `20c:2a`): #202 into slot 4, #203 into slot 0 at start-up
(0x2CD9C–0x2CDAD), as CotAB. The font is loaded from the fixed name `"8X8d5"` (0x5579), record #201
(0x55A8).

## 2. The 3D view's background (O, 0x59FEB)

The background routine is CotAB's 0x53824 transcribed: the same fills and the same SKY overlays at
the same text cells, through the fill `2bc:1b87(col, y_px, w_cells, h_px, colour)` and the masked
draw `2bc:9e3`.

- **CGA** (`DS:6816` = 0): sky `DS:89D2` from y 16 for 43 rows, line `DS:89D3` at y 59, then the band
  (y 60–61) and the floor (y 62–103) both in the constant colour **3** (0x5A047–0x5A08C; CotAB takes
  them from its band and floor variables), 11 cells wide from cell column 2.
- **EGA / Tandy** (`DS:6816` ≠ 0): sky 44 rows (y 16–59), band `DS:89D4` 2 rows, floor `DS:89D5` 42 rows;
  then, when the party's square has event byte < 0x80 and the sky colour is 11: the hour *h* is the
  area word +0x192 and the facing `DS:89D9`: *h* 1–5 facing E → sun #251 at (9, 7 − *h*), facing S
  and *h* > 2 → (*h* − 1, 7 − *h*); *h* 13–18 facing W → (2, *h* − 11), facing S and *h* < 16 →
  (*h* − 6, *h* − 11); facing N → clouds #250 at (2, 2); then, always, ground #252 at (2, 7). These are
  CotAB's rules, constant for constant (0x5A123–0x5A290).
- The SKY images are loaded at start-up only in EGA or Tandy (0x2CE01), into `DS:89E8`, `89EC`, `89F0`.
- **Sky colour** (0x5944B): `DS:0AA8[v]`, *v* = area word +0x1FC when the square's event byte > 0x7F,
  else +0x1FA, as CotAB. The table `DS:0AA8` holds CotAB's values (0, 15, 4, 11, 13, 2, 9, 14, twice).
- **Screen position.** The fills start at cell column 2 and y 16, so the background lies at pixels
  16–103 on both axes (O for the fills). The walls' origin is not traced (**?**). PoR's view was found
  at 24–111 in the running game ([engine/graphics.md](../engine/graphics.md)).
- The overhead map draws its walls as tile 0x104 + mask (0x59F01), as CotAB.
- **Closed edges.** The view's wall lookup (0x5A507) and the passage test (0x5A3D8) find no wall and no
  passage outside the map when the area (`DS:A4C2`) is **0 or 0x50** (0x5A51D–0x5A524, 0x5A3EE–0x5A3F5);
  elsewhere a coordinate wraps by one map. CotAB's areas are 0 and 10. The port: `view.closedEdges`.

## 3. BIGPIC and PICTURE (O)

ECL `PICTURE` (handler around 0x1E3FA): id ≥ **0x70** → the big-picture load and draw (stubs
`178:4d`, `178:52`); otherwise the PIC path. The threshold is 0x70, where CotAB's is 0x78, to take ids
112–119. Id 0x79 still has its own branch (0x1E42A → `dd:2f`, CotAB's overland map), but SotSB has no
record 121 (**I**: a leftover).

## 4. Start-up, title and credits (O)

Main program (image 0x18A–0x3E0):
1. Initialisation (`a1:25`), the sound driver installed (`7e4:cb`).
2. If ParamStr(1) is **`"Hoop"`** (the Pascal string at image 0x0; PoR and CotAB's `STING`), the title is
   skipped and `DS:67C5` := 1; otherwise the title (stub `47:25` → **0x1D631**).
3. The start-up menu: the two lines at image 0x5 and 0x2D (the game's name, "Version 1.30" and its
   date), menu "Play Demo" (image 0x64) through `16b:2f` with a timeout of 3 000 hundredths of a
   second (`DS:8A63` = 0x0BB8) answering **D** (`DS:8A67`). **D**: the demo, `DS:67E9` := 1, block digit
   `DS:7420` := **2**, game speed `DS:67D6` := 9. Otherwise block **1** and the game. (CotAB: demo block 1,
   game block 2.) `DS:7420` is the digit of the DAX names (O: the ECL loader reads it at 0x25C6C).

**Title** (0x1D631):
1. PlaySound(0xFF) (the effects driver unhooked), the sound device kept.
2. Unless the device is "none": the song driver loaded from `SOUND.DAX` and started (§6.3), song 0.
3. TITLE #1 at (0, 0); wait 15. TITLE #2 at (0, 0); wait 50. TITLE #3 at **column 2, row 5** (pixels
   16, 40); wait 50. TITLE #2 again; TITLE #4 at **column 5, row 5** (40, 40); wait 60. The screen
   cleared (`540:ae4`), the credits (0x1D35C), wait 80; the song stopped (0x1D12F).
4. A wait (0x1D0C0) is *n* × 100 units of the clock `540:a6b` (**I**: hundredths of a second, so *n*
   seconds) or a key; a key at any wait stops the song and ends the title.

There is no lightning, no logo overlay on a kept background (each logo picture carries the castle), no
copy-protection screen and no code wheel (no `TILES` file, **I**: no check).

**Credits** (0x1D35C): the frame 0x1BBA, then 21 lines printed by `540:35d(col, row, colour, 0, text)`,
texts in the overlay unit's code segment (CS = image 0x1D0C0, offsets 0x9B–0x279): the game's name at
(7, 0) in colour 5, then two columns from columns 2 and 22, headings in colour 5 (magenta), names in
colour 14 (yellow), rows 3–21 (O; the texts are read by address, D1). CotAB uses colours 10, 11 and 14.

## 5. Fonts, tiles, frames

- Font: 8X8D5 #201, PoR's and CotAB's font (O, byte compare).
- 8X8D1 #202 (bank 4, ids 0x100–0x164): 0–3 facing arrows, 4–19 the overhead map's wall masks and
  20–30 PoR's rope frame, all byte-identical to PoR's tiles (O); 31–48 large digits and punctuation
  (`.` `/` 0–9 `:` `;` `<` `=` `>` `?`, **I**, art), 49–51 blank, 52–55 the frame's bars (below), 56–59
  coloured frame pieces, 60–100 brown, white and blue pieces (**?**: their screens).
- **Frames: fixed tiles, no tables** (O). The frame routines draw glyphs 0x134–0x137 (#202 tiles 52–55)
  through the tile call `20c:2f(column, row, glyph, 0, 0)` (CotAB's `19c:2a`), with no table read:
  - the screen frame 0x19D0: rows 0 and 23 tile 55 (a horizontal bar) across all 40 columns; columns 0
    and 39 on rows 1–22 tile 53 (a vertical bar), with tile 52 on row 1 (the bar's top end, under a row)
    and 54 on row 22 (its bottom end, over a row);
  - a divider 0x1A90(row): tile 55 across the row, then in columns 0 and 39 tile 54 on the row above and
    52 on the row below;
  - 0x1B26 redraws the columns from row 2 (tile 53, 54 on row 22) and the bottom row;
  - the credits frame 0x1BBA clears the screen, draws rows 1 and 23 in tile 55 and the columns between
    with 52 on row 2 and 54 on row 22 (glyph 0xF1 + 0x43 … 0x45).
  The rows run the whole width, so a corner is a row tile. The colour left undrawn is CotAB's (13, **I**:
  the same tile call); tiles 52–55 hold no colour 13. Tiles 56–100: **?** (their screens).

## 6. Configuration, video and sound

### 6.1 BLADES.CFG (O, reader 0x2911–0x2BB0)

Shipped: `E`, `A`, `M`, `C:\SAVE\`, `F`, then twelve `0` lines.

| Line | Values | Effect |
|---|---|---|
| 1 | `E` / `T` / other | `DS:6816` = 1 EGA, 2 Tandy, 0 CGA (CotAB's `DS:5000`) |
| 2 | `A` / `T` / `P` / other | sound device `DS:741A` = **2 AdLib**, 3 Tandy, 4 PC speaker, 5 none |
| 3 | `J` / `M` / `N` | `DS:A64A` = 1 joystick or `DS:A602` = 1 mouse, or neither |
| 4 | path | the save path |
| 5 | `F` / other | `DS:67C4` := 1 or 0; nothing reads it (O, byte search: only the two writes at 0x2B4A, 0x2B51) |
| 6–17 | numbers | read only with a joystick, two a line for six lines (0x2B62–0x2BAE; **I**: the joystick's calibration) |

The image also holds the set-up questions ("SOUND TYPE: [1] AdLib, [2] Tandy 1000, [3] PC speaker, [4]
Silent", "ALTERNATE INPUT TYPE: joystick, mouse, neither", "PATH TO SAVE DATA", at 0x218F–0x2390); when
they are asked is not traced (**?**; I: when BLADES.CFG is missing).

### 6.2 Palette

Not traced (**?**). The BIOS calls go through Turbo Pascal's `Intr` (`bdb:b`, 13 calls; those read
are the cursor and character writes), as in CotAB.

### 6.3 Sound (O unless marked)

**Effects: CotAB's driver.** The PC-speaker and Tandy driver sits in the segment of image 0x7E40
(CS 0x07E4), its code CotAB's moved by 0x218F within the segment: install 0x7E40 + 0x344E
(CotAB 0x12BF), uninstall + 0x3483, start PC **+ 0x3814**, start Tandy **+ 0x3880**, enable + 0x38EC,
the same distances apart as CotAB's. The driver's data moved differently from its code: its variables and the channel and
frequency tables are PoR's offsets **− 0xBF** (CotAB − 0xBD: effect number CS:0x140, busy 0x119, channel
loop 0x11A, PC channels 0x16E, Tandy channels 0x308, the frequency tables 0x2EE and 0x488, in the start
routines 0xB654 (PC) and 0xB6C0 (Tandy) and the timer routine), while the command handlers its jump table
(CS:0x162) points at are PoR's **+ 0x20D2** (0x3700 … 0x3785). The effect tables, four words an effect, are
at **CS:0x04A0** (PC; 13 effects, 0x68 bytes, PoR's and CotAB's 21) and **CS:0x0508** (Tandy). Rendered
through the driver, effects 1–12 sound as CotAB's (the port's test, `test/sotsbsound.test.ts`; effect 1 is
silent in both); 20 of the 21 Tandy effects start with CotAB's bytes.

`PlaySound(n)` = **0x7E60** (`7e4:20`), CotAB's 0x69B0 with a fourth device:
- 0 → stop on both drivers; 1 → enable; 0xFF → stop both, unhook the timer, `DS:741C` := 0 (each
  unless the device is 5, none); 15 → the watchdog word (`*DS:67B6`) := 5 000 whatever the device; as
  CotAB;
- 2–14 → effect *n* − 1 on the **Tandy driver when the device is 3**, otherwise on the **PC speaker,
  for AdLib (2) as for the speaker (4)**. So with AdLib chosen the game's sound effects play on the PC
  speaker.
- Arguments come from the word table `DS:19C4` (= 255, 0, 1, …, 15, CotAB's `DS:25AC`): 54 calls, 20 of
  them 0xFF (the overlay and disk brackets); effects 1–11 are used; 13, 14 and 15 never (CotAB plays 13
  at the title).
- Ctrl-S (key 0x13, 0x719B), unless the title music is on (`DS:741E`): sound off (the device kept in
  `DS:741B`, then 5) or back on, with PlaySound(0) or (1).

**Music: a new driver in SOUND.DAX.** `SOUND.DAX` holds two records:
- **#1, 11 964 bytes of x86 code**, a resident song driver (compiled C: its strings name the outputs
  `adlib`, `innov` (the Innovation SSI-2001 card), `covox`, and errors "Invalid Parts File", "Song out
  of range"). It writes the AdLib ports through 0x388, the Tandy sound chip (port 0xC0) and the PC
  speaker (ports 0x42, 0x43, 0x61), so it plays on any of the devices (**I** for how it chooses).
- **#2, 2 684 bytes, a "parts file"** beginning `GLBR` (the driver checks the two words, `BR` `GL`),
  then a count of 0x1F and per-part data that look like OPL2 instrument registers (**I**).

The overlay unit at image **0x1D830** (stubs `4b:…`) runs it: load both records into paragraph-aligned
memory (`+0x88`, 0x1D8B8; "unable to load sound data"), start (`+0x246`, 0x1DA76: port 0x61 saved, the
driver's entry point `DS:59A6` = the code + 0x100 − 0x1000 paragraphs, i.e. an origin of 0x100, then
function 0 with the parts file), play (`+0x2b9`, function 1, the song), stop (`+0x2d3`, function 3, port
0x61 restored), free (`+0x1f`). Every driver call is a far call through `DS:59A6` with (function, two
arguments). It plays only at the title, song 0 (0x1D673), and only when the device is not "none".

## 7. What the port needs

- **Profile data**, as CotAB's: the families above (no HEAD/BODY, WILDCOM, RANDCOM, TILES); the font
  in 8X8D5 #201; the block digits (game 1, demo 2); the start-up menu's texts and timeout by address;
  the cheat parameter; the title as a script (TITLE #1–#4 at the cells and waits of §4, no lightning)
  and the credits by address; BIGPIC ids from 0x70; the background as CotAB's (SKY #250–252, the sky
  table `DS:0AA8`); `BLADES.CFG`'s lines (§6.1).
- **Sound effects**: CotAB's driver at its new place (`sound` in the profile: the segment of image
  0x7E40, its data and code shifts, the tables CS:0x04A0 and CS:0x0508; done), and the device mapping (AdLib plays effects on the
  speaker).
- **A gap: the title music.** The port plays effects only ([C-port/audio.md](../../C-port/audio.md)); it
  has no song player. Playing SotSB's music means either documenting the GLBR parts format and the
  driver's sequencing and writing an OPL2 (AdLib) synthesiser for the browser, or running the driver
  code in an 8086 emulator with an OPL2 emulation. Neither exists yet; until then the title is silent
  (a departure to register when the profile is written).

## Open

- The walls' screen origin in the 3D view (§2); the palette changes (§6.2); the roles of 8X8D1 #202
  tiles 31–51 and 56–100 (§5).
- When the set-up questions are asked (§6.1); the meaning of BLADES.CFG lines 6–17.
- The song driver: how it picks its output, the GLBR parts format, the song list (§6.3).
- The effect bytecode compared in full after normalising its pointers (§6.3).
