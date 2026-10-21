// Characters a game takes from another (docs/multi-game.md, step 8): CotAB's "Pool" source in Add,
// the converter at 323c:14b3 (spec/A-games/coab/records.md §7). The record is copied field by field through
// both games' field maps; the rules below are the converter's, with its STR bug fixed (IMP-070).
import type { CharFields } from './fields'

/** A field and how many bytes of it to copy (arrays). */
export type Copy = [keyof CharFields, number]

export interface CharacterImport {
  /** the source game's id, and its name for the player */
  from: string
  label: string
  /** source files: roster characters (extension) and save-slot characters, the source record size,
   *  and the highest morale byte allowed (NPCs are refused) */
  roster: string
  saveSlot: RegExp
  maxMorale: number
  /** fields copied as they are */
  copy: Copy[]
  /** stats clamped to the target's race limits (T.raceLimits); exceptional STR to the race and sex cap
   *  (the original wrote the cap into base STR instead, IMP-070) */
  clampStats: boolean
  /** the target's level used by the HP recompute starts at the highest level (CotAB +0xE6 = +0xE5) */
  hpLevelFromHitDice: boolean
  /** spell ids forgotten (CotAB: 36, Animate Dead, is not a player spell) */
  forget: number[]
  /** effect types kept from the source's effect file (only when it is found by the name's stem) */
  keepEffects: number[]
}

export const COAB_IMPORTS: CharacterImport[] = [{
  from: 'por', label: 'Pool of Radiance', roster: 'CHA', saveSlot: /^CHRDAT[A-J]\d\.SAV$/, maxMorale: 0x7f,
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
  clampStats: true, hpLevelFromHitDice: true, forget: [36], keepEffects: [18, 26, 47, 48, 97, 107, 124],
}]
