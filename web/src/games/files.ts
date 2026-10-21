// Each game's character and save files (docs/multi-game.md, step 5). PoR: spec/A-games/engine/savegame.md and
// spec/A-games/engine/records.md; CotAB: spec/A-games/coab/records.md §1 and §5.

export interface SaveFiles {
  /** extensions of a character's item list (63-byte records) and effect list (9-byte records) */
  items: string
  effects: string
  /** extension of a roster character outside a saved game */
  roster: string
  /** SAVGAM<x>.DAT size */
  saveSize: number
  /** party count byte; the member stems (Pascal string[40] each) follow */
  partyAt: number
  /** wall-set slots 1–3 as (u16 record, u16 slot) pairs, or −1 when the save keeps them in A (PoR) */
  wallSetsAt: number
  /** the exported save's file name before `-<slot>.zip` (spec/C-port/storage.md §7.1); import takes any name */
  exportName: string
}

export const POR_FILES: SaveFiles = { items: 'ITM', effects: 'SPC', roster: 'CHA', saveSize: 13137, partyAt: 0x3208, wallSetsAt: -1, exportName: 'poolrad-save' }
export const COAB_FILES: SaveFiles = { items: 'SWG', effects: 'FX', roster: 'GUY', saveSize: 13149, partyAt: 0x3214, wallSetsAt: 0x3208, exportName: 'curse-save' }
