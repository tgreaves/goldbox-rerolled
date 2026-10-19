// Character record fields by name (docs/multi-game.md, step 2). Records stay in their own game's
// byte layout; code reads `c[F.hp]` instead of `c[0x11b]`, and F holds the active game's offsets.
// PoR: spec/records.md. CotAB: spec/coab/records.md §2 (its "PoR" column pairs every field).
// Arrays give the offset of element 0; their lengths are the `…Count` fields.

export interface CharFields {
  /** record size: PoR 0x11D, CotAB 0x1A6 */
  size: number
  /** Pascal string, length byte then 15 characters */
  name: number
  /** current (effective) STR INT WIS DEX CON CHA; CotAB stores (base, current) pairs */
  stat: number[]
  /** base (permanent) stats, CotAB only; PoR has one value per stat, so this equals `stat` */
  baseStat: number[]
  /** current exceptional strength % */
  strPct: number
  /** base exceptional strength % (CotAB); PoR: the same byte as strPct */
  baseStrPct: number
  /** memorised spells: id = ready, id + 0x80 = still to be learned, 0 = empty */
  memorised: number
  memorisedCount: number
  /** PoR: scribing hours left; CotAB: hours left to finish learning spells */
  studyHours: number
  /** 60 − base THAC0 of the best class */
  thac0Base: number
  race: number
  cls: number
  /** u16 */
  age: number
  maxHp: number
  /** spells known: byte at known + id is 1 (ids from 1) */
  known: number
  knownCount: number
  /** fighter level for sweep attacks (else 1) */
  sweep: number
  /** size/type flags; large if > 0x80 or (v & 7) > 1 */
  sizeFlags: number
  /** 5 saving throws: death/poison, petrification, rod/staff/wand, breath, spell */
  saves: number
  baseMove: number
  /** highest class level (hit dice) */
  hitDice: number
  /** level the CotAB HP recompute uses for dual-class (CotAB only, −1 in PoR) */
  hpLevel: number
  /** levels lost to energy drain, and the max HP they took (Restoration and training give them back);
   *  CotAB: the converter copies PoR 0x74/0x75 here (I) */
  drainLevels: number
  drainHp: number
  undead: number
  /** 8 thief skills %: PP OL F/RT MS HS HN CW RL */
  thief: number
  /** effect list head (pointer, stale in files) */
  effects: number
  /** morale; bit 7 = NPC */
  morale: number
  /** NPC treasure share */
  npcShare: number
  /** 7 × u16: copper silver electrum gold platinum gems jewelry */
  money: number
  /** 8 class levels: cleric druid fighter paladin ranger magic-user thief monk */
  levels: number
  /** 8 previous class levels of a dual-class character (CotAB only, −1 in PoR) */
  prevLevels: number
  gender: number
  monsterType: number
  alignment: number
  /** attacks per round × 2, hands 1 and 2 */
  attacksBase: number
  /** natural attack, hands 1 and 2 (2 bytes each): dice count, dice sides, bonus */
  natDice: number
  natSides: number
  natBonus: number
  /** base 60 − AC */
  acBase: number
  /** 1 = STR to-hit/damage adjustments apply */
  strAdj: number
  /** random id for player characters, monster id for NPCs */
  id: number
  /** u32 */
  xp: number
  /** class bitmask for item use */
  itemMask: number
  /** hit dice / rolled HP counter */
  hpRolled: number
  /** spell slots per spell level, from level 1: cleric, druid (CotAB only, −1 in PoR), magic-user */
  clericSlots: number
  druidSlots: number
  muSlots: number
  slotLevels: number
  /** monster XP: u16 base, u8 per HP */
  xpBase: number
  xpPerHp: number
  /** portrait head and body, combat icon head and body */
  head: number
  body: number
  iconHead: number
  iconBody: number
  /** PoR: combat icon / picture id for monsters; CotAB: combat icon slot */
  iconSlot: number
  iconSize: number
  /** 6 icon colours */
  iconColours: number
  itemCount: number
  /** item list head (pointer) */
  items: number
  /** readied item pointers, 4 bytes each: slots 0–8, rings 9–10, arrows 11, quarrels 12 */
  readied: number
  hands: number
  /** s8 saving-throw bonus from readied items */
  saveBonus: number
  /** u16 encumbrance in coins */
  load: number
  next: number
  combat: number
  status: number
  inPlay: number
  /** enemy side: 1 monsters and hostile NPCs */
  side: number
  /** computer-controlled (Quick) */
  quick: number
  /** 60 − THAC0 */
  thac0: number
  /** 60 − AC, front and rear */
  ac: number
  acRear: number
  /** attacks left this round, hands 1 and 2 */
  attacksLeft: number
  /** current damage, hands 1 and 2 (2 bytes each): dice count, sides, s8 bonus */
  dice: number
  sides: number
  bonus: number
  hp: number
  move: number
}

const range = (at: number, step: number) => Array.from({ length: 6 }, (_, i) => at + i * step)

export const POR_FIELDS: CharFields = {
  size: 0x11d, name: 0x00, stat: range(0x10, 1), baseStat: range(0x10, 1), strPct: 0x16, baseStrPct: 0x16,
  memorised: 0x17, memorisedCount: 21, studyHours: 0x2c, thac0Base: 0x2d, race: 0x2e, cls: 0x2f, age: 0x30,
  maxHp: 0x32, known: 0x32, knownCount: 56, sweep: 0x6b, sizeFlags: 0x6c, saves: 0x6d, baseMove: 0x72,
  hitDice: 0x73, hpLevel: -1, drainLevels: 0x74, drainHp: 0x75, undead: 0x76, thief: 0x77, effects: 0x7f, morale: 0x84, npcShare: 0x85,
  money: 0x88, levels: 0x96, prevLevels: -1, gender: 0x9e, monsterType: 0x9f, alignment: 0xa0,
  attacksBase: 0xa1, natDice: 0xa3, natSides: 0xa5, natBonus: 0xa7, acBase: 0xa9, strAdj: 0xaa, id: 0xab,
  xp: 0xac, itemMask: 0xb0, hpRolled: 0xb1, clericSlots: 0xb2, druidSlots: -1, muSlots: 0xb5, slotLevels: 3,
  xpBase: 0xb8, xpPerHp: 0xba, head: 0xbb, body: 0xbc, iconHead: 0xbd, iconBody: 0xbe, iconSlot: 0xbf,
  iconSize: 0xc0, iconColours: 0xc1, itemCount: 0xc7, items: 0xc8, readied: 0xcc, hands: 0x100,
  saveBonus: 0x101, load: 0x102, next: 0x104, combat: 0x108, status: 0x10c, inPlay: 0x10d, side: 0x10e,
  quick: 0x10f, thac0: 0x110, ac: 0x111, acRear: 0x112, attacksLeft: 0x113, dice: 0x115, sides: 0x117,
  bonus: 0x119, hp: 0x11b, move: 0x11c,
}

export const COAB_FIELDS: CharFields = {
  size: 0x1a6, name: 0x00, stat: range(0x11, 2), baseStat: range(0x10, 2), strPct: 0x1c, baseStrPct: 0x1d,
  memorised: 0x1e, memorisedCount: 84, studyHours: 0x72, thac0Base: 0x73, race: 0x74, cls: 0x75, age: 0x76,
  maxHp: 0x78, known: 0x78, knownCount: 100, sweep: 0xdd, sizeFlags: 0xde, saves: 0xdf, baseMove: 0xe4,
  hitDice: 0xe5, hpLevel: 0xe6, drainLevels: 0xe7, drainHp: 0xe8, undead: 0xe9, thief: 0xea, effects: 0xf2, morale: 0xf7, npcShare: 0xf8,
  money: 0xfb, levels: 0x109, prevLevels: 0x111, gender: 0x119, monsterType: 0x11a, alignment: 0x11b,
  attacksBase: 0x11c, natDice: 0x11e, natSides: 0x120, natBonus: 0x122, acBase: 0x124, strAdj: 0x125, id: 0x126,
  xp: 0x127, itemMask: 0x12b, hpRolled: 0x12c, clericSlots: 0x12d, druidSlots: 0x132, muSlots: 0x137, slotLevels: 5,
  xpBase: 0x13c, xpPerHp: 0x13e, head: 0x13f, body: 0x140, iconHead: 0x141, iconBody: 0x142, iconSlot: 0x143,
  iconSize: 0x144, iconColours: 0x145, itemCount: 0x14c, items: 0x14d, readied: 0x151, hands: 0x185,
  saveBonus: 0x186, load: 0x187, next: 0x189, combat: 0x18d, status: 0x195, inPlay: 0x196, side: 0x197,
  quick: 0x198, thac0: 0x199, ac: 0x19a, acRear: 0x19b, attacksLeft: 0x19c, dice: 0x19e, sides: 0x1a0,
  bonus: 0x1a2, hp: 0x1a4, move: 0x1a5,
}

/** The active game's character fields; start-up (setGame) switches them. */
export const F: CharFields = { ...POR_FIELDS }

export function useFields(f: CharFields) {
  Object.assign(F, f)
}
