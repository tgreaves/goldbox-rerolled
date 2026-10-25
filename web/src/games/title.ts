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
  /** the title screen with the game's name, shown as the game's cover on the games screen (IMP-093) */
  cover: { record: number; x: number; y: number }[]
  /** music through the title (SotSB 0x1D631: SOUND.DAX record 2, song 0, stopped as the title ends, 0x1D12F) */
  music?: { file: string; record: number; song: number }
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
  cover: [{ record: 2, x: 0, y: 0 }], // the name over the wall
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
  cover: [{ record: 2, x: 0, y: 0 }, { record: 3, x: 48, y: 88 }], // the name; #4 over it is the Forgotten Realms logo
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

// spec/A-games/sotsb/assets.md §4 (0x1D631): TITLE #1, #2, then #3 at (16, 40) and #4 at (40, 40), each logo
// with the castle behind, over #2; the waits are 15, 50, 50 and 60 (I: seconds); no lightning, no code wheel; the
// title music plays meanwhile (games/sound.ts). Nothing reads BLADES.CFG line 5 (0x2B4A), so all of it is `first`
export const SOTSB_TITLE: TitleScript = {
  first: [
    { pictures: [{ record: 1, x: 0, y: 0 }], ms: 15000 },
    { pictures: [{ record: 2, x: 0, y: 0 }], ms: 50000 },
    { pictures: [{ record: 2, x: 0, y: 0 }, { record: 3, x: 16, y: 40 }], ms: 50000 },
    { pictures: [{ record: 2, x: 0, y: 0 }, { record: 4, x: 40, y: 40 }], ms: 60000 },
  ],
  long: [],
  configLine: 4,
  cover: [{ record: 2, x: 0, y: 0 }, { record: 4, x: 40, y: 40 }], // the name; #3 is the Forgotten Realms logo
  music: { file: 'SOUND', record: 2, song: 0 },
  credits: {
    ms: 80000,
    // 0x1BBA: tile 0x137 along rows 1 and 23 with edge tiles between (I: drawn here as one box of the game's border)
    frame: { boxes: [[0, 1, 39, 23]] },
    // 0x1D35C: 540:35d(col, row, colour, 0, text), texts at CS = image 0x1D0C0
    lines: [
      [0, 7, 5, 0x1d15b], [3, 2, 5, 0x1d177], [4, 2, 14, 0x1d195], [4, 22, 5, 0x1d1a1], [5, 2, 14, 0x1d1b1],
      [7, 2, 5, 0x1d1d2], [8, 2, 14, 0x1d1f4], [9, 2, 14, 0x1d215], [10, 22, 14, 0x1d235], [11, 2, 5, 0x1d240],
      [11, 22, 14, 0x1d252], [12, 2, 14, 0x1d25c], [13, 2, 14, 0x1d27d], [14, 2, 14, 0x1d29f], [15, 2, 14, 0x1d2bc],
      [16, 2, 14, 0x1d2cb], [16, 22, 5, 0x1d2d6], [17, 22, 14, 0x1d2e5], [19, 2, 5, 0x1d2f3], [19, 12, 14, 0x1d2fd],
      [20, 2, 14, 0x1d316], [21, 2, 14, 0x1d339],
    ],
  },
}
