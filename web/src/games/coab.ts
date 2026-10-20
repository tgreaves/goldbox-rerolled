// Curse of the Azure Bonds (1989). Research: spec/coab/; status: docs/multi-game.md.
import type { GameProfile } from './types'
import { COAB_IMPORTS } from './imports'
import { COAB_RULES_TEXT } from './rulestext'
import { COAB_ENDING } from './ending'
import { COAB_EFFECTS } from './effectrules'
import { COAB_TREASURE } from './treasure'
import { COAB_SOUND } from './sound'
import { COAB_TITLE } from './title'
import { COAB_VIEW } from './view'
import { COAB_SPELL_NOTES } from './spellnotes'
import { COAB_FIELDS } from './fields'
import { COAB_TABLES } from './tables'
import { COAB_ECL } from './ecl'
import { COAB_FILES } from './files'
import { COAB_RULES } from './rules'

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
  saves: COAB_FILES,
  rules: COAB_RULES,
  journal: null,
  spellNotes: COAB_SPELL_NOTES,
  view: COAB_VIEW,
  title: COAB_TITLE,
  sound: COAB_SOUND,
  commissions: false,
  treasure: COAB_TREASURE,
  effects: COAB_EFFECTS,
  ending: COAB_ENDING,
  rulesText: COAB_RULES_TEXT,
  imports: COAB_IMPORTS,
  playable: true,
  note: 'early: being built, expect gaps (no sun or clouds yet, no journal, PoR-style rules reference)',
}
