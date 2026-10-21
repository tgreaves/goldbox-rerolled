// Where each game's sound driver sits in START.EXE's load image (docs/multi-game.md, step 7). The
// driver is the same code in both games; CotAB's is moved by −0xBD (spec/A-games/coab/assets.md).

export interface SoundDriver {
  /** image offset of the driver's code segment */
  segment: number
  /** added to every PoR driver offset (variables, tables, command handlers) */
  shift: number
  /** whether the game's PlaySound has a transient mode: outside the sections that call it in full,
   *  it stops the effect after delay(10) (PoR FUN_18ae_00dc, DS:5374; spec/C-port/audio.md §3) */
  transient: boolean
}

/**
 * How a call site plays its effect, as the original's code around it does (spec/C-port/audio.md §3.1):
 * `full` inside a SetResident(0) section, where the effect plays to its end; `transient` elsewhere,
 * where a game with a transient mode cuts it off. A game without one plays every effect to its end.
 */
export type SoundMode = 'full' | 'transient'

export const POR_SOUND: SoundDriver = { segment: 0x8ae0, shift: 0, transient: true } // segment 0x18AE
// segment 0x0699 (O: 5211 of 5955 bytes equal at the shift); PlaySound 0x69B0 starts the effect and
// returns, with no delay and no stop: every effect plays to its end (O)
export const COAB_SOUND: SoundDriver = { segment: 0x6990, shift: -0xbd, transient: false }
