// How each game's 3D view is dressed (docs/multi-game.md, step 7): which of the game's own pictures
// and colours go where, in the drawn view (render/drawnview.ts, D6) and the WebGL view (IMP-001).

/** A band's colour: one of the backdrop's (Engine.backdrop) or a fixed EGA colour. */
export type BandColour = 'sky' | 'line' | 'band' | 'floor' | number

export interface ViewArt {
  /** the drawn view's background, view rows `rows` inclusive, top to bottom (PoR FUN_55a0_0174,
   *  CotAB 0x53824 on EGA) */
  bands: { rows: [number, number]; colour: BandColour }[]
  /** areas where the view's wall lookups outside the map find no wall (FUN_55a0_047b: DS:84DC 0 or
   *  10; CotAB 0x53D42, DS:8B78); elsewhere a coordinate wraps by one map */
  closedEdges: number[]
  /** EGA floor colour, instead of the one the script's floor key gives (null: the key decides) */
  floor: number | null
  /** a ground picture: DAX family and record; `at`, the view pixel where the drawn view puts it (over
   *  the bands and sky pictures, under the walls; mask colour `mask`); for the WebGL floor (IMP-069) the
   *  rows used (the least foreshortened, nearest the viewer) and how many times they repeat along one square */
  ground: { file: string; record: number; at: [number, number]; mask: number; rows: [number, number]; repeat: number } | null
  /** script pictures from this id are full-width BIGPIC<block> records (null: none) */
  bigFrom: number | null
  /** the BIGPIC that is the overland map, shown with the city cursor (T.cursorX/Y by ECL 0x4CA1) */
  overlandPicture: number | null
  /** areas that are the tile wilderness (PoR's 25–27; spec/A-games/engine/overland.md) */
  tileOverland: number[]
  /** window and screen frames, from 8X8D1 #202: PoR's fixed rope tiles (frame style 0 of
   *  FUN_13f1_0000), CotAB's frame tables (T.frameTop …), whose values count from tile `tile0`, or SotSB's
   *  bars: whole rows of `horizontal` (top, bottom, dividers), columns of `vertical`, with `below` in the
   *  column's cell under a row and `above` in the cell over one */
  frame: { rope: { corner: number; vertical: number; horizontal: number } } | { tables: { tile0: number; mask: number } }
    | { bars: { horizontal: number; vertical: number; below: number; above: number; mask: number } }
  /** pictures in the sky of the view, by day (sky colour `daySky`) where the party's square has event
   *  bit 7 clear: for a facing (0 N … 3 E … 6 W, ×2) and hours, a SKY record at view cell
   *  (col0 + col·hour, row0 + row·hour), 8-pixel cells from the view's top left; masked colour 13 */
  skyArt: { daySky: number; mask: number; rules: { facing2: number; hours: [number, number]; record: number; col: [number, number]; row: [number, number] }[] } | null
  /** the 8 × 8 font: DAX family and record (PoR, CotAB 8X8D1 #201; SotSB 8X8D5 #201, loaded by name at 0x5579) */
  font: { file: string; record: number }
}

export const POR_VIEW: ViewArt = {
  // FUN_55a0_0174: sky rows 0–42, the horizon line 43, the band 44–45, the floor 46–87
  bands: [{ rows: [0, 42], colour: 'sky' }, { rows: [43, 43], colour: 'line' }, { rows: [44, 45], colour: 'band' }, { rows: [46, 87], colour: 'floor' }],
  closedEdges: [0, 10],
  floor: null, ground: null, bigFrom: null, overlandPicture: null, tileOverland: [25, 26, 27],
  frame: { rope: { corner: 20, vertical: 21, horizontal: 22 } }, skyArt: null, font: { file: '8X8D1', record: 201 } }

// spec/A-games/coab/assets.md §3: in EGA the floor is colour 8 under SKY #252, the cobbled ground drawn at
// view rows 40–87 in every square, indoors too
// §4–5: PICTURE ids from 0x78 load BIGPIC (handler 0x190C3); the overland is BIGPIC #121 (0x79) with a
// blinking 8 × 8 white city cursor; there is no tile wilderness
export const COAB_VIEW: ViewArt = {
  // 0x53824, EGA: sky DS:7224 rows 0–43, DS:7226 (never written: 0) rows 44–45, DS:7227 (8) rows 46–87
  bands: [{ rows: [0, 43], colour: 'sky' }, { rows: [44, 45], colour: 0 }, { rows: [46, 87], colour: 'floor' }],
  closedEdges: [0, 10],
  // the ground #252 at screen cell (2, 7), view (0, 40), always, mask 13 (loaded at InitFirst 0x26AA9)
  floor: 8, ground: { file: 'SKY', record: 252, at: [0, 40], mask: 13, rows: [32, 48], repeat: 2 }, bigFrom: 0x78, overlandPicture: 0x79, tileOverland: [],
  // 0x1330: tile id 0x11E + table value, bank 4 (#202) starting at 0x100, so tile 30 + value (the white set)
  // the tiles are loaded with mask colour 13 (Load8x8D 0x579C5): those pixels are not drawn
  frame: { tables: { tile0: 30, mask: 13 } },
  // §3 (0x53824): the sun #251 east in hours 1–5 at (9, 7 − h), south at (h − 1, 7 − h) for hours 3–5;
  // west in hours 13–18 at (2, h − 11), south at (h − 6, h − 11) for hours 13–15; clouds #250 north at (2, 2)
  // (screen cells; the view starts at cell (2, 2))
  skyArt: { daySky: 11, mask: 13, rules: [
    { facing2: 2, hours: [1, 5], record: 251, col: [7, 0], row: [5, -1] },
    { facing2: 4, hours: [3, 5], record: 251, col: [-3, 1], row: [5, -1] },
    { facing2: 6, hours: [13, 18], record: 251, col: [0, 0], row: [-13, 1] },
    { facing2: 4, hours: [13, 15], record: 251, col: [-8, 1], row: [-13, 1] },
    { facing2: 0, hours: [0, 23], record: 250, col: [0, 0], row: [0, 0] },
  ] },
  font: { file: '8X8D1', record: 201 },
}

// spec/A-games/sotsb/assets.md §2–3, §5: the background is CotAB's routine (0x59FEB, the same SKY records and
// rules); PICTURE ids from 0x70 load BIGPIC; no overland picture (no record 121); the frame drawn with fixed
// tiles, no tables (0x19D0, 0x1A90: glyphs 0x134–0x137, 8X8D1 #202 tiles 52–55; §5); the font in 8X8D5 #201
export const SOTSB_VIEW: ViewArt = {
  ...COAB_VIEW,
  bigFrom: 0x70, overlandPicture: null,
  frame: { bars: { horizontal: 55, vertical: 53, below: 52, above: 54, mask: 13 } },
  font: { file: '8X8D5', record: 201 },
}
