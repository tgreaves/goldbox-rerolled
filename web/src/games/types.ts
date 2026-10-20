// What one Gold Box game is, for the parts of the port that differ between games
// (docs/multi-game.md). Step 1: identity, files and storage; record fields, tables, rules and the
// script VM join in later steps.
import type { CharFields } from './fields'
import type { TableMap } from './tables'
import type { EclMap } from './ecl'
import type { SaveFiles } from './files'
import type { GameRules } from './rules'
import type { JournalData } from './journal'
import type { ViewArt } from './view'
import type { TitleScript } from './title'
import type { SoundDriver } from './sound'
import type { TreasureRules } from './treasure'
import type { EffectRules } from './effectrules'
import type { EndingScript } from './ending'
import type { RulesText } from './rulestext'
import type { CharacterImport } from './imports'

export interface GameProfile {
  /** a short id ('por', 'coab', …): a new game adds its own; nothing in shared code tests it */
  id: string
  name: string
  /** the game's folder in the GOG release, named in the import help */
  folder: string
  /** the game's own configuration file, which identifies it among imported files */
  config: string
  /** files only this game has, used when the configuration file was left out */
  markers: string[]
  /** the minimum set for the port to start */
  required: string[]
  /** files the port keeps from an imported folder: names matching any of these (upper case) */
  keep: RegExp[]
  /** IndexedDB databases: the imported game files, and the player's roster and saves */
  stores: { files: string; user: string }
  /** image families the asset viewer shows, in order */
  imageFamilies: string[]
  /** character record layout */
  fields: CharFields
  /** START.EXE rules tables */
  tables: TableMap
  /** script VM memory map */
  ecl: EclMap
  /** character and save files */
  saves: SaveFiles
  /** rules that differ between games */
  rules: GameRules
  /** the printed journal the scripts refer to (null: none yet) */
  journal: JournalData | null
  /** one-line spell effects by id, written for the port */
  spellNotes: Record<number, string>
  /** the 3D view's floor and ground */
  view: ViewArt
  /** the title sequence and credits */
  title: TitleScript
  /** the sound driver in START.EXE */
  sound: SoundDriver
  /** the commissions panel (IMP-023): PoR's City Council quests, read from its script variables */
  commissions: boolean
  /** random treasure items */
  treasure: TreasureRules
  /** the effect system: event lists and area effects */
  effects: EffectRules
  /** the ending (PROGRAM 8) */
  ending: EndingScript
  /** the Rules reference's text */
  rulesText: RulesText
  /** characters this game takes from other games (CotAB: from PoR) */
  imports: CharacterImport[]
  /** false while the port can show the game's assets but not yet play it */
  playable: boolean
  /** a word on how far along the game is, shown when choosing it (null: complete) */
  note: string | null
}
