// Each game's character and save files (docs/multi-game.md, step 5). PoR: spec/A-games/engine/savegame.md and
// spec/A-games/engine/records.md; CotAB: spec/A-games/coab/records.md §1 and §5; SotSB: spec/A-games/sotsb/records.md §1, §3, §4.

export interface SaveFiles {
  /** extensions of a character's item list and effect list (9-byte records) */
  items: string
  effects: string
  /** the item record's size in a character's item file: 63 (PoR, CotAB), 67 (SotSB: a second chain pointer
   *  at +0x3F, kept as loaded; the DAX records stay 63) */
  itemRecord: number
  /** the item type whose joined items follow it in the file, chained at +0x3F (SotSB 0x49, "Bundle of" scrolls: 0x40486, 0x412B4); null: none */
  bundleType: number | null
  /** extension of a roster character outside a saved game */
  roster: string
  /** SAVGAM<x>.DAT size */
  saveSize: number
  /** the area's script code kept in the save after the A, B and C arrays (0x1E00 bytes; SotSB keeps none and
   *  loads the area's record again) */
  codeSize: number
  /** party count byte; the member stems (Pascal string[40] each) follow */
  partyAt: number
  /** wall-set slots 1–3 as (u16 record, u16 slot) pairs, or −1 when the save keeps them in A (PoR) */
  wallSetsAt: number
  /** the party's store the game keeps in its folder beside the saves (SotSB VAULT.DAT, records.md §5;
   *  data/vault.ts), synced as the record folder/<stem> (spec/C-port/accounts-and-sync.md); null: none */
  vault: string | null
  /** the exported save's file name before `-<slot>.zip` (spec/C-port/storage.md §7.1); import takes any name */
  exportName: string
}

export const POR_FILES: SaveFiles = { items: 'ITM', effects: 'SPC', itemRecord: 63, bundleType: null, roster: 'CHA', saveSize: 13137, codeSize: 0x1e00, partyAt: 0x3208, wallSetsAt: -1, vault: null, exportName: 'poolrad-save' }
export const COAB_FILES: SaveFiles = { items: 'SWG', effects: 'FX', itemRecord: 63, bundleType: null, roster: 'GUY', saveSize: 13149, codeSize: 0x1e00, partyAt: 0x3214, wallSetsAt: 0x3208, vault: null, exportName: 'curse-save' }
// 0x421CB / 0x419DD: CotAB's layout without the code buffer (5 469 = 13 149 − 0x1E00); .WHO/.STF/.SFX (0x3FE44)
export const SOTSB_FILES: SaveFiles = { items: 'STF', effects: 'SFX', itemRecord: 67, bundleType: 0x49, roster: 'WHO', saveSize: 5469, codeSize: 0, partyAt: 0x1414, wallSetsAt: 0x1408, vault: 'VAULT.DAT', exportName: 'blades-save' }
