// Pool of Radiance (1988), the port's first game.
import type { GameProfile } from './types'
import { POR_RULES_TEXT } from './rulestext'
import { POR_ENDING } from './ending'
import { POR_EFFECTS } from './effectrules'
import { POR_SPELLS } from './spellrules'
import { POR_LANDMARKS } from './landmarkrules'
import { POR_TREASURE } from './treasure'
import { POR_SOUND } from './sound'
import { POR_TITLE } from './title'
import { POR_VIEW } from './view'
import { POR_SPELL_NOTES } from './spellnotes'
import { POR_FIELDS } from './fields'
import { POR_TABLES } from './tables'
import { POR_ECL } from './ecl'
import { POR_FILES } from './files'
import { POR_RULES } from './rules'
import { POR_JOURNAL } from './journal'

export const POR: GameProfile = {
  id: 'por',
  name: 'Pool of Radiance',
  folder: 'POOLRAD',
  config: 'POOL.CFG',
  markers: ['GEO1.DAX', 'SQRPACI.DAX', 'BACPAC.DAX'],
  required: ['ECL1.DAX', 'GEO1.DAX', '8X8D1.DAX', 'WALLDEF1.DAX'],
  keep: [/\.DAX$/, /^ITEMS$/, /^START\.EXE$/, /^GAME\.OVR$/, /^POOL\.CFG$/, /^CHRDAT.+\.(SAV|ITM|SPC)$/, /^SAVGAM.\.DAT$/],
  // the names used before there was more than one game, so existing imports and saves stay where they are
  stores: { files: 'poolrad', user: 'poolrad-user' },
  imageFamilies: ['TITLE', 'PIC', 'FINAL', 'SPRIT', 'HEAD', 'BODY', 'CHEAD', 'CBODY', 'CPIC',
    'ICON', 'COMSPR', 'SQRPACI', 'BACPAC', 'DUNGCOM', 'WILDCOM', 'RANDCOM', '8X8D'],
  fields: POR_FIELDS,
  tables: POR_TABLES,
  ecl: POR_ECL,
  saves: POR_FILES,
  rules: POR_RULES,
  journal: POR_JOURNAL,
  spellNotes: POR_SPELL_NOTES,
  view: POR_VIEW,
  title: POR_TITLE,
  sound: POR_SOUND,
  commissions: true,
  treasure: POR_TREASURE,
  spells: POR_SPELLS,
  landmarks: POR_LANDMARKS,
  effects: POR_EFFECTS,
  ending: POR_ENDING,
  rulesText: POR_RULES_TEXT,
  imports: [],
  playable: true,
  note: null,
}
