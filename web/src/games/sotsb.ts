// Secret of the Silver Blades (1990). Research: spec/A-games/sotsb/; status: docs/multi-game.md.
// The record, tables, script VM, saves, presentation and sound, its own rules, spells and effects (2026-10-22),
// each read in its binary; playable at an early stage (docs/multi-game.md lists what remains).
import type { GameProfile } from './types'
import { SOTSB_RULES_TEXT } from './rulestext'
import { SOTSB_EFFECTS } from './effectrules'
import { SOTSB_SPELLS } from './spellrules'
import { COAB_LANDMARKS } from './landmarkrules'
import { SOTSB_TREASURE } from './treasure'
import { SOTSB_IMPORTS } from './imports'
import { SOTSB_SOUND } from './sound'
import { SOTSB_TITLE } from './title'
import { SOTSB_STARTUP } from './startup'
import { SOTSB_VIEW } from './view'
import { SOTSB_FIELDS } from './fields'
import { SOTSB_TABLES } from './tables'
import { SOTSB_ECL } from './ecl'
import { SOTSB_FILES } from './files'
import { SOTSB_RULES } from './rules'
import { SOTSB_STRINGS, SOTSB_MENUS } from './stringtable'

export const SOTSB: GameProfile = {
  id: 'sotsb',
  name: 'Secret of the Silver Blades',
  folder: 'BLADES',
  config: 'BLADES.CFG',
  // SOUND.DAX (the music) is SotSB's alone; GEO1/WALLDEF1 and SKY/BIGPIC it shares with PoR and CotAB
  // (spec/A-games/sotsb/README.md, "Files and DAX families")
  markers: ['SOUND.DAX', 'SKY.DAX', 'BIGPIC1.DAX', 'GEO1.DAX', 'WALLDEF1.DAX'],
  required: ['ECL1.DAX', 'GEO1.DAX', '8X8D1.DAX', '8X8D5.DAX', 'WALLDEF1.DAX', 'SKY.DAX'],
  // roster NAME.WHO/.STF/.SFX, party files CHRDAT<x><n>.SAV/.STF/.SFX (spec/A-games/sotsb/records.md §1);
  // vault.dat the party's store (§5)
  keep: [/\.DAX$/, /^ITEMS$/, /^START\.EXE$/, /^GAME\.OVR$/, /^BLADES\.CFG$/, /\.(WHO|STF|SFX)$/, /^CHRDAT.+\.SAV$/, /^SAVGAM.\.DAT$/, /^VAULT\.DAT$/],
  stores: { files: 'goldbox-sotsb', user: 'goldbox-sotsb-user' },
  imageFamilies: ['TITLE', 'BIGPIC', 'SKY', 'PIC', 'SPRIT', 'CHEAD', 'CBODY', 'CPIC', 'COMSPR', 'DUNGCOM', '8X8D'],
  fields: SOTSB_FIELDS,
  tables: SOTSB_TABLES,
  ecl: SOTSB_ECL,
  saves: SOTSB_FILES,
  // SotSB's rules (games/rules.ts SOTSB_RULES); CotAB's spells, effects and landmarks stand in where not yet read (?)
  rules: SOTSB_RULES,
  journal: null,
  spellNotes: {},
  view: SOTSB_VIEW,
  title: SOTSB_TITLE,
  startMenu: SOTSB_STARTUP,
  sound: SOTSB_SOUND,
  // the engine's messages and menus, CotAB's found by text in SotSB's image (I; games/stringtable.ts)
  strings: SOTSB_STRINGS,
  menus: SOTSB_MENUS,
  commissions: false,
  treasure: SOTSB_TREASURE,
  spells: SOTSB_SPELLS,
  landmarks: COAB_LANDMARKS,
  debug: { jumps: [], finale: null },
  // the CotAB effect system with no camp Display names (they are addresses in CotAB's image)
  effects: SOTSB_EFFECTS,
  // PROGRAM has no ending in SotSB (spec/A-games/sotsb/ecl.md, PROGRAM)
  ending: { cs: 0, steps: [], after: null },
  rulesText: SOTSB_RULES_TEXT,
  // Add's "Curse": CotAB's .GUY characters (spec/A-games/sotsb/records.md §6)
  imports: SOTSB_IMPORTS,
  playable: true,
  note: 'early: being built, expect gaps',
}
