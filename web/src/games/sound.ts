// Where each game's sound driver sits in START.EXE's load image (docs/multi-game.md, step 7). The
// driver is the same code in every game, moved: CotAB's by −0xBD (spec/A-games/coab/assets.md), SotSB's data
// and code by different amounts (spec/A-games/sotsb/assets.md §6.3).

export interface SoundDriver {
  /** image offset of the driver's code segment */
  segment: number
  /** added to PoR's offsets of the driver's variables and channel and frequency tables */
  data: number
  /** added to PoR's offsets of its command handlers (the targets of its jump table) */
  code: number
  /** the effect tables (CS offsets): per effect four words, a channel's data or 0 */
  tables: { pc: number; tandy: number }
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

export const POR_SOUND: SoundDriver = { segment: 0x8ae0, data: 0, code: 0, tables: { pc: 0x55f, tandy: 0x607 }, transient: true } // segment 0x18AE
// segment 0x0699 (O: 5211 of 5955 bytes equal at the shift); PlaySound 0x69B0 starts the effect and
// returns, with no delay and no stop: every effect plays to its end (O)
export const COAB_SOUND: SoundDriver = { segment: 0x6990, data: -0xbd, code: -0xbd, tables: { pc: 0x4a2, tandy: 0x54a }, transient: false }
// spec/A-games/sotsb/assets.md §6.3: CotAB's driver in the segment of image 0x7E40; its variables PoR's − 0xBF
// (the start routines 0xB654, 0xB6C0), its command handlers PoR's + 0x20D2 (the jump table CS:0x162), the PC
// table at CS:0x04A0 (13 effects) and the Tandy table at CS:0x0508 (O). PlaySound 0x7E60 as CotAB's, AdLib on the PC speaker
export const SOTSB_SOUND: SoundDriver = { segment: 0x7e40, data: -0xbf, code: 0x20d2, tables: { pc: 0x4a0, tandy: 0x508 }, transient: false }
