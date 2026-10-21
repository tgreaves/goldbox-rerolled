// Each game's title sequence (docs/multi-game.md, step 7): which TITLE records go where and for how
// long, the credits, and the configuration line that allows the long intro. PoR: spec/A-games/engine/input-and-menus.md,
// "Start-up sequence", and spec/A-games/por/title-and-credits.md; CotAB: spec/A-games/coab/assets.md §7.

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
    /** row, column, colour, and the image address of the line's string (the font has capitals only;
     *  spec/A-games/por/title-and-credits.md, CotAB 0x182AD) */
    lines: [number, number, number, number][]
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
  [1, 5, 10, 0x1910b], [1, 26, 14, 0x19120], [2, 15, 10, 0x1912a],
  [3, 2, 10, 0x19133],
  [5, 1, 10, 0x19158], [5, 18, 14, 0x19169], [6, 14, 11, 0x1917e],
  [7, 2, 14, 0x1918a], [7, 20, 14, 0x19197], [8, 2, 11, 0x191a0], [8, 20, 14, 0x1918a],
  [9, 2, 11, 0x191ad], [9, 20, 11, 0x191b8], [10, 2, 11, 0x191c4], [10, 20, 11, 0x191ad],
  [11, 2, 11, 0x191cf],
  [13, 2, 14, 0x191d9], [13, 20, 14, 0x191e7], [14, 2, 11, 0x191f9], [14, 20, 11, 0x19202],
  [15, 2, 11, 0x1920e], [15, 20, 11, 0x191c4], [16, 2, 11, 0x19219], [16, 20, 11, 0x19227],
  [17, 2, 11, 0x19235], [17, 20, 11, 0x19244],
  [19, 2, 14, 0x19251], [19, 20, 14, 0x19261], [20, 2, 11, 0x19227], [20, 20, 11, 0x1926c],
  [22, 2, 14, 0x1927e], [22, 11, 11, 0x19287], [23, 2, 11, 0x192a2],
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
      [1, 2, 10, 0x1811f],
      [2, 6, 10, 0x18144], [2, 9, 11, 0x18148], [2, 20, 10, 0x18153], [2, 24, 11, 0x18157],
      [4, 10, 10, 0x18162], [5, 11, 14, 0x18177], [5, 21, 10, 0x18153], [5, 25, 14, 0x18181],
      [6, 14, 11, 0x18157], [7, 11, 11, 0x18185],
      [9, 1, 10, 0x18197], [9, 18, 14, 0x181a8],
      [11, 2, 14, 0x181bd], [12, 2, 11, 0x18185],
      [14, 2, 14, 0x181cd], [15, 2, 11, 0x181da], [16, 2, 11, 0x181e7], [17, 2, 11, 0x181f2],
      [19, 2, 14, 0x18202], [20, 2, 11, 0x1820f], [21, 2, 11, 0x181f2], [22, 2, 11, 0x1821d],
      [11, 22, 14, 0x18229], [12, 22, 11, 0x18237], [13, 22, 11, 0x18240], [14, 22, 11, 0x1824b],
      [15, 22, 11, 0x18258], [16, 22, 11, 0x18265],
      [18, 22, 14, 0x1826f], [19, 22, 11, 0x1827c], [20, 22, 11, 0x18289], [21, 22, 11, 0x18296],
      [22, 22, 11, 0x182a1],
    ],
  },
}
