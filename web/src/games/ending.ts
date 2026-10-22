// Each game's ending (PROGRAM 8), as data (docs/multi-game.md). The ending is overlay code: its captions
// are Pascal strings in GAME.OVR, read at run time by offset; nothing of the game's text is stored.

/**
 * A picture step: record `record` of `file` + the block number. `animate`: its frames cycled `loops` times
 * (default ((10 − speed) × 5) / 2, FUN_4804_0006); `at`: drawn at that position over the picture shown
 * (else it replaces it, the window taking its size); `fromParty`: only with at least that many members.
 */
export interface EndingPicture { file: 'PIC' | 'BIGPIC' | 'FINAL'; record: number; animate?: boolean; loops?: number; at?: [number, number]; fromParty?: number }

export type EndingStep =
  | { text: number[] }                                                         // captions, replacing the last
  | { picture: EndingPicture }
  | { wait: true }                                                             // "Press any key to continue."

export interface EndingScript {
  /** offset in GAME.OVR of the overlay segment that holds the captions (the strings' offsets count from it) */
  cs: number
  steps: EndingStep[]
}

const fin = (record: number, at: [number, number], more: Partial<EndingPicture> = {}): EndingStep => ({ picture: { file: 'FINAL', record, at, ...more } })

// FUN_4804_02a4: the dragon (FINAL 1, its death animated in 2), the party (3, a figure for each member
// past the first in 4–6), Tyranthraxus speaking (7) and his fall (8, once)
export const POR_ENDING: EndingScript = {
  cs: 0x2069d, // merged image 0x38040
  steps: [
    { text: [0x114, 0x138, 0x15d] }, fin(1, [0, 0]), fin(2, [16, 32], { animate: true }),
    fin(3, [0, 0]), fin(4, [0, 88], { fromParty: 2 }), fin(5, [104, 72], { fromParty: 3 }), fin(6, [0, 72], { fromParty: 4 }),
    { text: [0x17b, 0x19f, 0x1c4, 0x1eb, 0x20b, 0x230] }, fin(7, [16, 0], { animate: true }),
    { text: [0x239, 0x260, 0x288, 0x29b] }, fin(8, [16, 0], { animate: true, loops: 1 }),
    { wait: true },
  ],
}

// image 0x3D02C: captions in the text window, PIC 74, 75 and the animated 77 by the routine 0x3CA89,
// PIC 65, then BIGPIC 122 (the night village), "Press any key" between them
export const COAB_ENDING: EndingScript = {
  cs: 0x2593f, // merged image 0x3BF10
  steps: [
    { text: [0xc87, 0xcb6, 0xceb, 0xd21] }, { wait: true },
    { text: [0xd76, 0xda7, 0xde0, 0xe15] }, { picture: { file: 'PIC', record: 0x4a, animate: true } }, { wait: true },
    { text: [0xe4f, 0xe81, 0xebb, 0xef2] }, { picture: { file: 'PIC', record: 0x4b, animate: true } }, { wait: true },
    { text: [0xeff, 0xf2d, 0xf62, 0xf95] }, { picture: { file: 'PIC', record: 0x4d, animate: true } }, { picture: { file: 'PIC', record: 0x41 } },
    { text: [0xf9b, 0xfc2, 0xff7, 0x102a] }, { wait: true },
    { picture: { file: 'BIGPIC', record: 122 } },
    { text: [0x104e, 0x1083, 0x10be, 0x10f4] }, { wait: true },
  ],
}
