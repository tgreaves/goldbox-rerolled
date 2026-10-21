// Curse of the Azure Bonds (1989). Research: spec/A-games/coab/; status: docs/multi-game.md.
import type { GameProfile } from './types'
import { COAB_IMPORTS } from './imports'
import { COAB_RULES_TEXT } from './rulestext'
import { COAB_ENDING } from './ending'
import { COAB_EFFECTS } from './effectrules'
import { COAB_SPELLS } from './spellrules'
import { COAB_LANDMARKS } from './landmarkrules'
import { COAB_DEBUG } from './debug'
import { COAB_TREASURE } from './treasure'
import { COAB_SOUND } from './sound'
import { COAB_STRINGS } from './stringtable'
import { COAB_TITLE } from './title'
import { COAB_STARTUP } from './startup'
import { COAB_VIEW } from './view'
import { COAB_SPELL_NOTES } from './spellnotes'
import { COAB_FIELDS } from './fields'
import { COAB_TABLES } from './tables'
import { COAB_ECL } from './ecl'
import { COAB_FILES } from './files'
import { COAB_RULES } from './rules'
import { COAB_JOURNAL } from './journal'

export const COAB: GameProfile = {
  id: 'coab',
  name: 'Curse of the Azure Bonds',
  folder: 'CURSE',
  config: 'CURSE.CFG',
  // no GEO1/WALLDEF1/HEAD1/BODY1, no SQRPACI; SKY, BIGPIC and TILES are new (spec/A-games/coab/assets.md)
  markers: ['SKY.DAX', 'BIGPIC1.DAX', 'TILES.DAX'],
  required: ['ECL1.DAX', 'GEO2.DAX', '8X8D1.DAX', 'WALLDEF2.DAX', 'SKY.DAX'],
  // roster NAME.GUY/.SWG/.FX, party files CHRDAT<x><n>.SAV/.SWG/.FX (spec/A-games/coab/records.md §1); GAME.OVR holds
  // the overlay code (the ending's captions)
  keep: [/\.DAX$/, /^ITEMS$/, /^START\.EXE$/, /^GAME\.OVR$/, /^CURSE\.CFG$/, /\.(GUY|SWG|FX)$/, /^CHRDAT.+\.SAV$/, /^SAVGAM.\.DAT$/],
  stores: { files: 'goldbox-coab', user: 'goldbox-coab-user' },
  imageFamilies: ['TITLE', 'BIGPIC', 'SKY', 'PIC', 'SPRIT', 'HEAD', 'BODY', 'CHEAD', 'CBODY', 'CPIC',
    'COMSPR', 'DUNGCOM', 'WILDCOM', 'RANDCOM', 'TILES', '8X8D'],
  fields: COAB_FIELDS,
  tables: COAB_TABLES,
  ecl: COAB_ECL,
  saves: COAB_FILES,
  rules: COAB_RULES,
  journal: COAB_JOURNAL,
  spellNotes: COAB_SPELL_NOTES,
  view: COAB_VIEW,
  title: COAB_TITLE,
  startMenu: COAB_STARTUP,
  sound: COAB_SOUND,
  strings: COAB_STRINGS,
  commissions: false,
  treasure: COAB_TREASURE,
  spells: COAB_SPELLS,
  landmarks: COAB_LANDMARKS,
  debug: COAB_DEBUG,
  effects: COAB_EFFECTS,
  ending: COAB_ENDING,
  rulesText: COAB_RULES_TEXT,
  imports: COAB_IMPORTS,
  playable: true,
  note: 'early: being built, expect gaps',
}
