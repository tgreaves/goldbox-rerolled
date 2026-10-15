---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Graphics

Part of [[spec/README]]. Decoder: `tools/gfx.py` (writes PNGs).

## Image block (O)

Engine reader `FUN_1464_0111`; validated against every graphics record (811 records, 17 families) and visually (title screen, pictures).

```
u16 height        // pixels
u16 width         // in 8-pixel units
u16 x, y          // screen placement hint (8-pixel units for x)
u8  count         // number of sub-images of this size that follow
u8  cga_map[8]    // 16 colours → pairs of CGA colours (all nibbles 0–3) (I)
count × height × (width*4) bytes: 4 bits per pixel, high nibble = left pixel
```

Colours are indices into the **default EGA 16-colour palette** (O: renders correctly with it).

## Record shapes (O)

| Family | Shape | Size(s) | Content |
|---|---|---|---|
| `TITLE` | single | 320×200 | title screens |
| `PIC1–8` | animated | 88×88 | event pictures |
| `FINAL5` | mixed | 120×120, 88×88, … | ending |
| `SPRIT1–8` | animated | 24–88 × 73–88 | encounter sprites, one frame per distance |
| `HEAD1–8`, `BODY1–8` | single | 88×40, 88×48 | character-creation portraits |
| `CHEAD`, `CBODY` | single | 24×8/10, 24×24 | combat icon parts |
| `CPIC1–8` | single | 24/48 × 24/48 | combat icons for monsters |
| `ICON`, `COMSPR`, `SQRPACI`, `BACPAC`, `DUNGCOM`, `WILDCOM`, `RANDCOM` | single, many sub-images | 24×24 | combat tiles and effects |
| `8X8D1–8` | single, many sub-images | 8×8 | tiles for the 3D view (WALLDEF references them) |

Animated records:

```
u8 frames
repeat frames: u32 delay, image block
```

## Animation (O)

Frames are loaded into a table at `DS:6ABE`: byte count, byte current frame (1-based, 0 = no animation running), then for frame *n* a u32 delay at `DS:6AB8 + 8n` and a far image pointer at `DS:6ABC + 8n`.

- **Delta frames.** In `PIC` and `FINAL` records every frame after the first is stored XORed with frame 1 (decoder `5523:00a2`). A player must XOR each later frame with frame 1 before display. `SPRIT` frames are stored whole.
- **Timing.** The menu input loop (`FUN_53aa_03bd`) drives the animation while it waits for a key. The clock is DOS time in **hundredths of a second** (`FUN_1709_0c3f`: `cs + 100·s + 6000·min + 360000·h`). A frame stays up for **delay × 10** hundredths, so the stored delay is in **tenths of a second**. Observed delays are 0–20 (0–2 s), mostly 0–6.
- **Cycle.** When the delay has elapsed the current frame advances; after the last frame it wraps to **frame 1**, so the cycle includes the base frame. A frame is drawn at text cell (3, 3), the top-left of the 3D view area.
- A flag in the far structure at `DS:49D2` (+0x3FE) forces an immediate advance and redraw; it is cleared when the loop returns (**I**: set after a screen redraw).

### Encounter sprites (O)

`SPRIT` records hold one frame per distance; the frame drawn is **distance + 1**, so frame 1 is the nearest view. The image is placed at its header `x, y` offset by (+2, +2) cells, inside the 3D view.

### Portraits (O)

`HEAD` and `BODY` records are drawn by `5523:05d9`, head above body, to make the character-creation portrait. `B[0x5C2]` selects which portrait the script-driven screens show (**I** for its exact encoding).

## Menu input loop (O, `FUN_53aa_03bd`)

All horizontal menus share one loop. It returns the chosen key:

| Input | Result |
|---|---|
| an option's hotkey letter | that option |
| `,` / `.` | move the highlight left / right (wrapping); the highlighted option is `DS:6B2B` |
| Enter | the highlighted option, when the menu allows it |
| Space | returns at once (used by "press a key" prompts) |
| Esc | returns 0 |
| extended key (0 prefix) | mapped through `DS:285B` when the caller accepts them (cursor movement, **I**) |

An optional timeout (`DS:6B2E` u32, hundredths) returns the default key `DS:6B32` when it expires; a negative value disables it.

## Font (O)

`8X8D1.DAX` record 201 has no header: 177 glyphs × 8 bytes, 1 bit per pixel, MSB = leftmost.

- Glyph index = ECL text code: 0x00–0x1F = `@A–Z[\]^_`, 0x20–0x3F = space, punctuation, digits
- Further glyphs: runes (code-wheel protection, **I**), window frame pieces

## Screen layout (O for coordinates passed in code; I for roles)

- 320 × 200, EGA 16 colours; text on a **40 × 25 grid of 8 × 8 cells** using the font above
- `FUN_1709_0626(text, colour, row, col)` prints one line; `FUN_1709_0768(text, …, top, left, bottom, right)` prints wrapped text in a box; `FUN_1709_0dd3(bottom, right, top, left)` clears a box
- Exploration: 3D view = 11 × 11 tiles at tile (2, 2), i.e. pixels 16–103; text window = rows 17–22, columns 1–38 (text cursor `DS:5E25` row, `DS:5E24` column, reset to row 17 / column 1); event pictures (88 × 88) occupy the 3D view area
- Colours used for text: 10 (light green) normal, 13 (light magenta) highlight/NPC, 14 (yellow) wounded, 15 (white) headings
- Character sheet: name row 1, race/age row 3, alignment row 4, class row 5, stats rows 7–12, money from row 7 column 26, combat stats from row 17
- Party roster (O, `FUN_10ba_0767`): starts at column 17 while exploring (column 1 on the party screen). Row 2: "Name" (column 17) and "AC  HP" (column 33) in white. From row 4, one row per party-list entry: name (the current character in white, others coloured by `FUN_10ba_1816`, **?** rule), AC right-aligned ending at column 34, HP right-aligned ending at column 38

## Still to decode

- Exact use of `x, y` and `cga_map`
- How WALLDEF tables index 8X8D tiles to build the 3D view
