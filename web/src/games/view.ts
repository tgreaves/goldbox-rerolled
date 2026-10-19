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
}

export const POR_VIEW: ViewArt = { floor: null, ground: null, bigFrom: null, overlandPicture: null, tileOverland: [25, 26, 27] }

// spec/coab/assets.md §3: in EGA the floor is colour 8 under SKY #252, the cobbled ground drawn at
// view rows 40–87 in every square, indoors too
// §4–5: PICTURE ids from 0x78 load BIGPIC (handler 0x190C3); the overland is BIGPIC #121 (0x79) with a
// blinking 8 × 8 white city cursor; there is no tile wilderness
export const COAB_VIEW: ViewArt = {
  floor: 8, ground: { file: 'SKY', record: 252, rows: [32, 48], repeat: 2 }, bigFrom: 0x78, overlandPicture: 0x79, tileOverland: [],
}
