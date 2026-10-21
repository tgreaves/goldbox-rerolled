---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Rendering

Part of the [specification](../README.md), part C: GoldBox Rerolled. How the port draws the game's
own art: picture decoding (pointers to part A), the two scaling modes, the palettes, the window frames
from the game's tiles, the game font turned into a TrueType font, and the combat icons. **Normative**
where it says what is drawn from which data and by which rule; sizes in CSS pixels and the reference's
canvas mechanics are informative. The 3D view is [exploration-view.md](exploration-view.md), the
battlefield [combat-ui.md](combat-ui.md). Observed in the reference implementation
(`web/src/render/upscale.ts`, `render/icon.ts`, `ui/frames.ts`, `ui/gamefont.ts`, `data/ttf.ts`,
`games/frametiles.ts`, `data/image.ts`, **O**).

No art ships with the port: every picture, tile, glyph and frame is decoded in the browser from the
player's files (decision D5; [overview.md, "Constraints"](overview.md#constraints)).

## 1. Decoding pictures

| What | Part A |
|---|---|
| DAX containers, RLE | [containers.md](../A-games/engine/containers.md) |
| the image block, record shapes, animated records, XOR delta frames | [graphics.md, "Image block"](../A-games/engine/graphics.md#image-block-o), ["Record shapes"](../A-games/engine/graphics.md#record-shapes-o), ["Animation"](../A-games/engine/graphics.md#animation-o) |
| transparency and the mask colours (tiles 13, sprites 0 with 13 → black) | [graphics.md, "Transparency"](../A-games/engine/graphics.md#transparency-o) |
| wall pieces and the tile bank | [maps-and-view.md](../A-games/engine/maps-and-view.md#wall-pieces) |
| the font | [graphics.md, "Font"](../A-games/engine/graphics.md#font-o) |
| CotAB's families, BIGPIC, SKY, frames | [coab/assets.md](../A-games/coab/assets.md) |

Pictures are decoded once and kept for the session (by record).

## 2. Scaling

Every picture is drawn at its own pixel size into a canvas (its **logical** size), and the canvas is
stretched by the layout to its region. The **Graphics** setting (IMP-047,
[ui-contract.md §9](ui-contract.md#9-settings)) chooses how:

| Mode | Rule |
|---|---|
| **Pixel** (default, `pixel`) | the canvas holds the picture at 1 × and is stretched with nearest-neighbour sampling (no smoothing). Each original pixel stays a hard-edged block; at a fractional stretch neighbouring blocks may differ by one screen pixel |
| **Sharp** (`sharp`) | every picture is first enlarged **4 ×** by whole pixels (nearest neighbour: each source pixel becomes a 4 × 4 block, nothing invented), and only the last, small stretch to the screen is smoothed (bilinear). Each pixel is an even square with soft edges |

- The mode applies to every picture: the title and credits, the drawn 3D view's frame, pictures,
  portraits, BIGPIC, the sky layer, the wilderness tiles, the battlefield's tiles, icons and sprites, the cards' portraits and
  icons, the creation and icon-editor canvases, the ending; and to the 3D view's textures (nearest
  filtering in Pixel; linear filtering of the 4 × texture in Sharp, no mipmaps).
- The drawn view's frame (88 × 88, [exploration-view.md §2](exploration-view.md#2-the-drawn-view-normative))
  is drawn whole at every refresh: in Pixel its canvas holds it at 1 ×, in Sharp at 4 ×.
- It is read once per page load (the enlarged pictures are cached): a change applies after a reload
  ([ui-contract.md §9](ui-contract.md#9-settings)).
- Not affected: the journal's scans (photographs of the printed book, always smoothed) and the area
  map (drawn as lines at its own resolution).
- Scale2x and similar pixel-art filters are **not** used: on EGA art with one-pixel details and
  dithering they smear outlines into blobs (IMP-047).

## 3. Palettes

- **EGA**: the default 16-colour palette, as RGB (the standard EGA/VGA text palette): 0 `000000`,
  1 `0000AA`, 2 `00AA00`, 3 `00AAAA`, 4 `AA0000`, 5 `AA00AA`, 6 `AA5500`, 7 `AAAAAA`, 8 `555555`,
  9 `5555FF`, 10 `55FF55`, 11 `55FFFF`, 12 `FF5555`, 13 `FF55FF`, 14 `FFFF55`, 15 `FFFFFF`. Every picture
  index maps through it ([graphics.md, "Image block"](../A-games/engine/graphics.md#image-block-o)).
  Only EGA is drawn: the original's CGA and Tandy video modes (CGA maps through the image header's
  `cga_map`) are not offered.
- **The battle palette**: colours 0 and 8 swapped, as the original's combat screen sets the EGA
  palette registers ([combat-visuals.md, "Palette"](../A-games/engine/combat-visuals.md#palette-o)).
  Used for the battlefield's tiles, icons and sprites.
- **Palette effects**: the PoR title's lightning changes colour 1 of the picture (9, 11, 15, 11, 9, 1;
  [app-flow.md §4](app-flow.md#4-the-title)); nothing else changes the palette.
- **The interface's colours** are EGA colours chosen by role ([ui-contract.md §2](ui-contract.md#2-colours-as-roles)).

## 4. Frames

The original draws its windows with frame tiles from `8X8D1` #202 ([input-and-menus.md §1](../A-games/engine/input-and-menus.md#1-start-up-sequence)
step 6, [coab/assets.md §6](../A-games/coab/assets.md#6-fonts-tiles-screen-frames)). The port draws
its panels with the same tiles (IMP-051), built in the browser; the **Borders** setting chooses
**Original rope** (default) or **Plain**.

### 4.1 Which tiles

From the profile's `view.frame`:

- **PoR** (`rope`): tile 20 (the yellow corner square) at the four corners, 21 (the vertical red rope)
  on the left and right edges, 22 (the horizontal rope) on the top and bottom.
- **CotAB** (`tables`): the screen frame's tables in `START.EXE` (`T.frameTop`, `T.frameBottom`,
  `T.frameLeft`, `T.frameRight`, [B-model/records-and-tables.md](../B-model/records-and-tables.md)), each
  value counted from tile 30 (the white set); the tiles' colour 13 is not drawn. A panel's corners are
  the screen frame's corners as they end up after its rows and columns overlap (top left = the left
  table's row 0, top right = the right table's row 0, bottom left and right = the bottom table's
  columns 0 and 39); each **edge** is the **most common** value of that table (top and bottom over 40
  columns, left and right over 24 rows; on a tie the value met first). Port data:
  [port-data.md §7](../D-appendices/port-data.md#7-view-choices).

### 4.2 Panels

- The eight tiles are laid out as a 3 × 3 image (corners, edges, an empty middle), each tile pixel drawn
  as a 4 × 4 block (so the border stays sharp at 2 × and 4 ×); colour 0 and the game's mask colour are
  left transparent so the panel's black shows through.
- That image is every panel's border: each tile 16 CSS px (2 × the 8-pixel tile; 12 px in class N), corners fixed, edge tiles repeated whole along each side (stretched slightly to fit a whole
  number). Square corners.
- **Shared lines**: the play screen's panels touch, and each leaves out the edge its neighbour draws,
  so every dividing line is drawn once and the corner squares fall where frames meet, as on the
  original screen. Per class: in the W row layout the cards' frame closes the top and the view, the map
  and the text share its bottom line; in the W column layout the party and the map leave out their left
  edges and the map and text their top edges; in N the party, map and text leave out their top edges
  and the map its left edge.
- The framed panels: the view, the cards, the area map, the text log, and every dialog.
- **Plain**: a 2-px border in the frame colour (EGA 11) with square corners.
- Without `8X8D1` #202 (or, for CotAB, without `START.EXE`) the borders are Plain and the setting is
  not offered.

### 4.3 Full-screen frames

The credits screen draws the original's own frames tile by tile on its 320 × 200 picture: PoR's two
rope boxes (cells 1–38 × 1–3 and 1–38 × 5–23, the ropes one cell outside each box, corners where they
meet), CotAB's screen frame (top row, the columns 0 and 39, the bottom row 23, from the tables, plus the
divider rows 3 and 8 from the divider table) ([app-flow.md §4](app-flow.md#4-the-title)).

## 5. The game font

IMP-038. The interface's text uses the game's 8 × 8 font, `8X8D1` #201 (177 glyphs, capitals only,
[graphics.md, "Font"](../A-games/engine/graphics.md#font-o)), turned into a TrueType font in the browser
and installed as the family "Pool of Radiance" (for every game). The **Font** setting chooses
**Original 8×8** (default) or **Modern** (the system's sans-serif).

**Glyph shapes** (normative): each lit horizontal run of pixels in a glyph row is one rectangle; a
pixel is 128 font units, so the em is 1024 (8 pixels); the baseline is under row 6 (rows 0–6 above it,
row 7 a descender row); ascent 896, descent 128; every glyph advances 8 pixels (1024 units); glyph 0 is
an empty `.notdef`. Rectangles are clockwise outer contours.

**Character map** (normative):

| Characters | Glyph |
|---|---|
| space … `?` (0x20–0x3F) except `%` | the same code |
| `%` (0x25) | none: the game's 0x25 is a solid block |
| `@` (0x40) | 0x40 (glyph 0x00 is a framed box) |
| `A`–`Z` and `a`–`z` | 1–26: lower case shows as capitals, as the game has no lower case |

Characters outside the map fall back to the next font in the list (a monospace system font).

**Use**: the play screen, the party screen, every panel and the title prompt, at **16 px** (24 px with
Large text), line height 1.5, without font smoothing and without letter spacing, so each font pixel is
2 × 2 (3 × 3) screen pixels; sizes in the game font are whole multiples of 8 px. The games screen and
the asset viewer keep the system font. Where the original prints raw glyphs (the rune passwords,
PRINT_LIST) the glyph bitmaps are drawn directly ([exploration-view.md §5](exploration-view.md#5-pictures-and-the-picture-layer)).

The TTF tables (`head`, `hhea`, `maxp`, `OS/2`, `name`, `cmap` format 4, `post`, `glyf`, `loca`,
`hmtx`) are standard and informative; a build MAY reach the same glyphs another way (a bitmap font,
canvas text) as long as the shapes, metrics and map are these.

## 6. Combat icons

The original's icon build (`FUN_45c5_0482`, [input-and-menus.md §3.2](../A-games/engine/input-and-menus.md#32-combat-icon-editor-fun_417f_382d-also-from-camp-alter-o)):

1. Record number = part + 0x40 when the icon size is large (char size byte 2) + 0x80 for the action
   pose.
2. The body is `CBODY` record (weapon part + offset), the head `CHEAD` record (head part + offset);
   the head's pixels are OR-ed into the body's top rows (pixel by pixel, the head's width being the
   body's).
3. Colours: art colours 1, 2, 3, 4, 6, 7 become the low nibbles, and 9, 10, 11, 12, 14, 15 the high
   nibbles, of the six colour bytes (Body, Arm, Leg, Hair/Face, Shield, Weapon, `DS:3CF5`); other
   colours stay.
4. Drawn with colour 0 transparent (on the battlefield and over the portrait) or on black (the cards,
   the sheet, the editor), 24 × 24 logical pixels.

Monsters use their `CPIC<block>` record and record + 128 for the action pose. The cards' and sheet's
icons are cached by the character's icon bytes.

## 7. Other drawing

- **Portraits**: `HEAD3`/`BODY3` records (the party screen, cards, creation) or `HEAD<block>`/`BODY<block>`
  (script portraits), head at (0, 0) and body at (0, 40) of an 88 × 88 picture on black; the record
  numbers through the game's portrait tables ([B-model/records-and-tables.md](../B-model/records-and-tables.md)).
- **Encounter sprites**: colour 0 transparent, colour 13 opaque black ([graphics.md, "Encounter sprites"](../A-games/engine/graphics.md#encounter-sprites-o)).
- **Pictures** (`PIC`, `BIGPIC`, `TITLE`, `FINAL`): opaque.

## Validation

- `web/test/upscale.test.ts` ("turns every pixel into a k × k square and invents nothing"),
  `ttf.test.ts` (the font's checksum), `decoders.test.ts` (the records).
- [CONFORMANCE.md](../CONFORMANCE.md), "User interface", the look per class: frames, palette, font,
  scaling.

## Open

- The font family is named "Pool of Radiance" in every game (cosmetic).
- The CotAB edge rule (the most common tile) approximates the original's knotted frame, which varies
  along each side; drawing the exact sequence needs fixed-size panels.
