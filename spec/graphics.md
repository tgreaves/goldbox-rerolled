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
| `SPRIT1–8` | animated | 24–88 × 73–88 | encounter sprites, one frame per distance (I) |
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

## Font (O)

`8X8D1.DAX` record 201 has no header: 177 glyphs × 8 bytes, 1 bit per pixel, MSB = leftmost.

- Glyph index = ECL text code: 0x00–0x1F = `@A–Z[\]^_`, 0x20–0x3F = space, punctuation, digits
- Further glyphs: runes (code-wheel protection, **I**), window frame pieces

## Still to decode

- Exact use of `x, y` and `cga_map`
- SPRIT frame-to-distance mapping, PIC animation timing units
- How WALLDEF tables index 8X8D tiles to build the 3D view
