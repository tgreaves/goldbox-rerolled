// Curse of the Azure Bonds (1989). Research: spec/coab/. Assets only until the later steps of
// docs/multi-game.md make it playable.
import type { GameProfile } from './types'
import { COAB_FIELDS } from './fields'
import { COAB_TABLES } from './tables'
import { COAB_ECL } from './ecl'

export const COAB: GameProfile = {
  id: 'coab',
  name: 'Curse of the Azure Bonds',
  folder: 'CURSE',
  config: 'CURSE.CFG',
  // no GEO1/WALLDEF1/HEAD1/BODY1, no SQRPACI; SKY, BIGPIC and TILES are new (spec/coab/assets.md)
  markers: ['SKY.DAX', 'BIGPIC1.DAX', 'TILES.DAX'],
  required: ['ECL1.DAX', 'GEO2.DAX', '8X8D1.DAX', 'WALLDEF2.DAX', 'SKY.DAX'],
  wanted(name) {
    const n = name.toUpperCase()
    // roster NAME.GUY/.SWG/.FX, party files CHRDAT<x><n>.SAV/.SWG/.FX (spec/coab/records.md §1);
    // GAME.OVR holds the overlay code, kept for the tables later steps read
    return n.endsWith('.DAX') || n === 'ITEMS' || n === 'START.EXE' || n === 'GAME.OVR' || n === 'CURSE.CFG' ||
      /\.(GUY|SWG|FX)$/.test(n) || /^CHRDAT.+\.SAV$/.test(n) || /^SAVGAM.\.DAT$/.test(n)
  },
  stores: { files: 'goldbox-coab', user: 'goldbox-coab-user' },
  imageFamilies: ['TITLE', 'BIGPIC', 'SKY', 'PIC', 'SPRIT', 'HEAD', 'BODY', 'CHEAD', 'CBODY', 'CPIC',
    'COMSPR', 'DUNGCOM', 'WILDCOM', 'RANDCOM', 'TILES', '8X8D'],
  fields: COAB_FIELDS,
  tables: COAB_TABLES,
  ecl: COAB_ECL,
  playable: false,
}
