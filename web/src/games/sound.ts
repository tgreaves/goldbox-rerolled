// Where each game's sound driver sits in START.EXE's load image (docs/multi-game.md, step 7). The
// driver is the same code in both games; CotAB's is moved by −0xBD (spec/coab/assets.md).

export interface SoundDriver {
  /** image offset of the driver's code segment */
  segment: number
  /** added to every PoR driver offset (variables, tables, command handlers) */
  shift: number
}

export const POR_SOUND: SoundDriver = { segment: 0x8ae0, shift: 0 } // segment 0x18AE
export const COAB_SOUND: SoundDriver = { segment: 0x6990, shift: -0xbd } // segment 0x0699 (O: 5211 of 5955 bytes equal at the shift)
