// How each game's 3D view is dressed (docs/multi-game.md, step 7). The port draws the view in
// WebGL (IMP-001); these say which of the game's own pictures and colours go where.

export interface ViewArt {
  /** EGA floor colour, instead of the one the script's floor key gives (null: the key decides) */
  floor: number | null
  /** a ground picture laid on the floor (IMP-069): DAX family and record, the rows used (the least
   *  foreshortened, nearest the viewer) and how many times they repeat along one square */
  ground: { file: string; record: number; rows: [number, number]; repeat: number } | null
  /** script pictures from this id are full-width BIGPIC<block> records (null: none) */
  bigFrom: number | null
  /** the BIGPIC that is the overland map, shown with the city cursor (T.cursorX/Y by ECL 0x4CA1) */
  overlandPicture: number | null
  /** areas that are the tile wilderness (PoR's 25–27; spec/overland.md) */
  tileOverland: number[]
  /** window and screen frames, from 8X8D1 #202: PoR's fixed rope tiles (frame style 0 of
   *  FUN_13f1_0000), or CotAB's frame tables (T.frameTop …), whose values count from tile `tile0` */
  frame: { rope: { corner: number; vertical: number; horizontal: number } } | { tables: { tile0: number; mask: number } }
  /** pictures in the sky of the view, by day (sky colour `daySky`) where the party's square has event
   *  bit 7 clear: for a facing (0 N … 3 E … 6 W, ×2) and hours, a SKY record at view cell
   *  (col0 + col·hour, row0 + row·hour), 8-pixel cells from the view's top left; masked colour 13 */
  skyArt: { daySky: number; mask: number; rules: { facing2: number; hours: [number, number]; record: number; col: [number, number]; row: [number, number] }[] } | null
}

export const POR_VIEW: ViewArt = { floor: null, ground: null, bigFrom: null, overlandPicture: null, tileOverland: [25, 26, 27],
  frame: { rope: { corner: 20, vertical: 21, horizontal: 22 } }, skyArt: null }

// spec/coab/assets.md §3: in EGA the floor is colour 8 under SKY #252, the cobbled ground drawn at
// view rows 40–87 in every square, indoors too
// §4–5: PICTURE ids from 0x78 load BIGPIC (handler 0x190C3); the overland is BIGPIC #121 (0x79) with a
// blinking 8 × 8 white city cursor; there is no tile wilderness
export const COAB_VIEW: ViewArt = {
  floor: 8, ground: { file: 'SKY', record: 252, rows: [32, 48], repeat: 2 }, bigFrom: 0x78, overlandPicture: 0x79, tileOverland: [],
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
}
