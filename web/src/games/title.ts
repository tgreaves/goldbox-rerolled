// Each game's title sequence (docs/multi-game.md, step 7): which TITLE records go where and for how
// long, the credits, and the configuration line that allows the long intro. PoR: spec/menus.md,
// "Start-up sequence"; CotAB: spec/coab/assets.md §7.

export interface TitleScreen {
  /** TITLE records drawn in order at pixel positions */
  pictures: { record: number; x: number; y: number }[]
  ms: number
  /** PoR: palette register 1 flashes on this screen (290c:06AD) */
  lightning?: boolean
  /** a sound effect when the screen starts (CotAB 13; played once the game's sound driver is mapped) */
  sound?: number
}

export interface TitleScript {
  /** always shown */
  first: TitleScreen[]
  /** shown when line `configLine` (0-based) of the game's configuration file starts with F */
  long: TitleScreen[]
  configLine: number
  credits: {
    ms: number
    /** PoR: rope boxes (the game's border tiles) as cells x1, y1, x2, y2; CotAB: the screen frame
     *  (games/frametiles.ts) with divider rows */
    frame: { boxes: [number, number, number, number][] } | { screen: { dividers: number[] } }
    /** row, column, colour, text (the font has capitals only) */
    lines: [number, number, number, string][]
  }
}

export const POR_TITLE: TitleScript = {
  first: [{ pictures: [{ record: 1, x: 0, y: 0 }], ms: 5000 }],
  long: [{ pictures: [{ record: 2, x: 0, y: 0 }], ms: 5000, lightning: true }],
  configLine: 4, // POOL.CFG line 5 sets DS:49D1, the fixed-disk flag
  credits: {
    ms: 10000,
    frame: { boxes: [[1, 1, 38, 3], [1, 5, 38, 23]] },
    // FUN_290c_0206
    lines: [
  [1, 5, 10, 'scenario created by:'], [1, 26, 14, 'tsr, inc.'], [2, 15, 10, 'jim ward'],
  [3, 2, 10, 'david cook,steve winter,mike breault'],
  [5, 1, 10, 'game created by:'], [5, 18, 14, 'ssi special projects'], [6, 14, 11, 'version 1.3'],
  [7, 2, 14, 'programming:'], [7, 20, 14, 'original'], [8, 2, 11, 'scot bayless'], [8, 20, 14, 'programming:'],
  [9, 2, 11, 'brad myers'], [9, 20, 11, 'keith brors'], [10, 2, 11, 'russ brown'], [10, 20, 11, 'brad myers'],
  [11, 2, 11, 'ted greer'],
  [13, 2, 14, 'graphic arts:'], [13, 20, 14, 'encounter coding:'], [14, 2, 11, 'tom wahl'], [14, 20, 11, 'paul murray'],
  [15, 2, 11, 'fred butts'], [15, 20, 11, 'russ brown'], [16, 2, 11, 'darla marasco'], [16, 20, 11, 'victor penman'],
  [17, 2, 11, 'susan halbleib'], [17, 20, 11, 'dave shelley'],
  [19, 2, 14, 'project manager'], [19, 20, 14, 'developer:'], [20, 2, 11, 'victor penman'], [20, 20, 11, 'george mac donald'],
  [22, 2, 14, 'testing:'], [22, 11, 11, 'joel billings,steve salyer'], [23, 2, 11, 'james kucera,robert daly,rick white'],
],
  },
}

export const COAB_TITLE: TitleScript = {
  first: [{ pictures: [{ record: 1, x: 0, y: 0 }], ms: 5000 }],
  // 0x18702: TITLE #2 with the #3 logo at (48, 88) for 10 s; then sound 13 and the #4 logo at (0, 88)
  // over it for 10 s; no lightning
  long: [
    { pictures: [{ record: 2, x: 0, y: 0 }, { record: 3, x: 48, y: 88 }], ms: 10000 },
    { pictures: [{ record: 2, x: 0, y: 0 }, { record: 3, x: 48, y: 88 }, { record: 4, x: 0, y: 88 }], ms: 10000, sound: 13 },
  ],
  configLine: 3, // CURSE.CFG line 4 sets DS:4FB1
  credits: {
    ms: 10000,
    frame: { screen: { dividers: [3, 8] } }, // 0x1403: the screen frame (0x1330) plus rows 3 and 8
    // 0x182AD
    lines: [
      [1, 2, 10, 'based on the tsr novel "azure bonds"'],
      [2, 6, 10, 'by:'], [2, 9, 11, 'kate novak'], [2, 20, 10, 'and'], [2, 24, 11, 'jeff grubb'],
      [4, 10, 10, 'scenario created by:'], [5, 11, 14, 'tsr, inc.'], [5, 21, 10, 'and'], [5, 25, 14, 'ssi'],
      [6, 14, 11, 'jeff grubb'], [7, 11, 11, 'george mac donald'],
      [9, 1, 10, 'game created by:'], [9, 18, 14, 'ssi special projects'],
      [11, 2, 14, 'project leader:'], [12, 2, 11, 'george mac donald'],
      [14, 2, 14, 'programming:'], [15, 2, 11, 'scot bayless'], [16, 2, 11, 'russ brown'], [17, 2, 11, 'michael mancuso'],
      [19, 2, 14, 'development:'], [20, 2, 11, 'david shelley'], [21, 2, 11, 'michael mancuso'], [22, 2, 11, 'oran kangas'],
      [11, 22, 14, 'graphic arts:'], [12, 22, 11, 'tom wahl'], [13, 22, 11, 'fred butts'], [14, 22, 11, 'susan manley'],
      [15, 22, 11, 'mark johnson'], [16, 22, 11, 'cyrus lum'],
      [18, 22, 14, 'playtesting:'], [19, 22, 11, 'jim jennings'], [20, 22, 11, 'james kucera'], [21, 22, 11, 'rick white'],
      [22, 22, 11, 'robert daly'],
    ],
  },
}
