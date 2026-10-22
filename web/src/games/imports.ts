// Characters a game takes from another (docs/multi-game.md, step 8; spec/B-model/procedures.md §13): CotAB's
// "Pool" source in Add, the converter at 323c:14b3 (spec/A-games/coab/records.md §7), and SotSB's "Curse"
// source, the converter 0x405E3 (spec/A-games/sotsb/records.md §6). The record is copied field by field through
// both games' field maps; the rules below are the converters', CotAB's with its STR bug fixed (IMP-070).
import type { CharFields } from './fields'

/** A field and how many bytes of it to copy (arrays). */
export type Copy = [keyof CharFields, number]

export interface CharacterImport {
  /** the source game's id, and its name for the player */
  from: string
  label: string
  /** source files: roster characters (extension), save-slot characters (null: only the roster), the
   *  source's effect files (extension, found by the name's stem; null: not read), and the highest morale
   *  byte allowed (NPCs are refused) */
  roster: string
  saveSlot: RegExp | null
  effects: string | null
  maxMorale: number
  /** fields copied as they are */
  copy: Copy[]
  /** the name's trailing spaces and one leading space removed */
  trimName: boolean
  /** the source's race numbers in the target's (null: kept; a race not listed becomes 0) */
  raceMap: Record<number, number> | null
  /** the abilities: `race` the current ones clamped to the target's race limits (T.raceLimits), the base
   *  ones := them, exceptional STR to the race and sex cap (the original wrote the cap into base STR
   *  instead, IMP-070); `strMax` base and current copied, base STR lowered to the race and sex maximum */
  stats: 'race' | 'strMax'
  /** the target's level used by the HP recompute starts at the highest level (CotAB +0xE6 = +0xE5) */
  hpLevelFromHitDice: boolean
  /** spell ids forgotten (CotAB: 36, Animate Dead, is not a player spell) */
  forget: number[]
  /** the class mask and the derived statistics worked out again (5047:03c6); false: as copied */
  recompute: boolean
  /** effect types kept from the source's effect file */
  keepEffects: number[]
  /** innate effects added (permanent, power 0xFF) for a level above 0 in class `level`, or for the former
   *  class `former` (`misc86`) while former levels count; with `abilityUses` := 1 too */
  grants: { level: number; former: number; effect: number; abilityUses: boolean }[]
}

export const COAB_IMPORTS: CharacterImport[] = [{
  from: 'por', label: 'Pool of Radiance', roster: 'CHA', saveSlot: /^CHRDAT[A-J]\d\.SAV$/, effects: 'SPC', maxMorale: 0x7f,
  copy: [
    ['name', 16], ['race', 1], ['gender', 1], ['thac0Base', 1], ['cls', 1], ['age', 2], ['maxHp', 1], ['sweep', 1],
    ['sizeFlags', 1], ['saves', 5], ['baseMove', 1], ['hitDice', 1], ['drainLevels', 1], ['drainHp', 1], ['undead', 1],
    ['thief', 8], ['misc83', 1], ['morale', 1], ['npcShare', 1], ['misc86', 1], ['misc87', 1], ['levels', 8],
    ['monsterType', 1], ['alignment', 1], ['attacksBase', 2], ['natDice', 2], ['natSides', 2], ['natBonus', 2], ['acBase', 1],
    ['strAdj', 1], ['id', 1], ['xp', 4], ['itemMask', 1], ['hpRolled', 1], ['clericSlots', 3], ['muSlots', 3],
    ['xpBase', 2], ['xpPerHp', 1], ['head', 1], ['body', 1], ['iconHead', 1], ['iconBody', 1], ['iconSize', 1],
    ['iconColours', 6], ['hands', 1], ['saveBonus', 1], ['load', 2], ['status', 1], ['inPlay', 1], ['side', 1],
    ['thac0', 1], ['ac', 1], ['acRear', 1], ['attacksLeft', 2], ['dice', 2], ['sides', 2], ['bonus', 2], ['hp', 1], ['move', 1],
  ],
  trimName: false, raceMap: null, stats: 'race', hpLevelFromHitDice: true, forget: [36], recompute: true,
  keepEffects: [18, 26, 47, 48, 97, 107, 124], grants: [],
}]

// SotSB's "Curse" source in Add (0x3C645): CotAB's *.guy (0x3F5AD) through the converter 0x405E3 and the
// loader's tail (0x40E44–0x40EB8, 0x410DF–0x4115A); spec/A-games/sotsb/records.md §2, §6. No items and no
// effects are read (no .swg or .fx name in the image); money, memorised spells, encumbrance and the quick
// flag start at 0; the readied-item pointers (Move 0x34, 0x40CF5) are not kept, there being no items
export const SOTSB_IMPORTS: CharacterImport[] = [{
  from: 'coab', label: 'Curse of the Azure Bonds', roster: 'GUY', saveSlot: null, effects: null,
  maxMorale: 0xff, // I: no morale test seen on the Curse branch
  copy: [
    ['name', 16], ['thac0Base', 1], ['cls', 1], ['age', 2], ['maxHp', 1], ['sweep', 1], ['sizeFlags', 1], ['saves', 5],
    ['baseMove', 1], ['hitDice', 1], ['hpLevel', 1], ['drainLevels', 1], ['drainHp', 1], ['thief', 8], ['morale', 1],
    ['npcShare', 1], ['misc86', 1], ['misc87', 1], ['levels', 7], ['prevLevels', 7], ['gender', 1], ['alignment', 1],
    ['attacksBase', 2], ['natDice', 2], ['natSides', 2], ['natBonus', 2], ['acBase', 1], ['strAdj', 1], ['id', 1],
    ['xp', 4], ['itemMask', 1], ['hpRolled', 1], ['clericSlots', 5], ['druidSlots', 5], ['muSlots', 5], ['xpBase', 2],
    ['xpPerHp', 1], ['head', 1], ['body', 1], ['iconHead', 1], ['iconBody', 1], ['iconSize', 1], ['iconColours', 6],
    ['classFlags', 1], ['hands', 1], ['saveBonus', 1], ['status', 1], ['inPlay', 1], ['side', 1], ['thac0', 1], ['ac', 1],
    ['acRear', 1], ['attacksLeft', 2], ['dice', 2], ['sides', 2], ['bonus', 2], ['hp', 1], ['move', 1],
  ],
  trimName: true, // 0x40604–0x406B9
  raceMap: { 0: 7, 1: 3, 2: 1, 3: 4, 4: 2, 5: 5, 6: 7, 7: 6 }, // 0x40727–0x407AE: no half-orc
  stats: 'strMax', // Move 12 (0x406DD), STR % both; base STR to DS:4D9F[16·race + gender] (0x40E6A)
  hpLevelFromHitDice: false,
  forget: [36, 56, 63, 90, 96, 98, 100], // 0x407F8–0x40883 copies the other ids 1–100
  recompute: false, keepEffects: [],
  grants: [ // 0x410DF: the ranger's 0x69, the paladin's 8 and its Cure Disease use
    { level: 4, former: 4, effect: 0x69, abilityUses: false },
    { level: 3, former: 3, effect: 8, abilityUses: true },
  ],
}]
