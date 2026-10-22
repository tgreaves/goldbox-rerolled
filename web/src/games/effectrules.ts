// Each game's effect system as data (docs/multi-game.md): which effect types answer each event, in the
// original's order, and which effects reach their neighbours. PoR: the dispatcher FUN_5216_02fa
// (image 0x4245A), spec/A-games/engine/effects.md; CotAB: 0x4AEC4 (events 0–23), spec/A-games/coab/effects.md.

export interface EffectRules {
  /** event → the effect types that respond, in the order the original calls them */
  events: Record<number, number[]>
  /** effects that also act for characters near their holder, and how far in combat (default 1) */
  area: number[]
  areaRadius: Record<number, number>
  /**
   * Every effect type's handler (PoR FUN_5216_0000's table, CotAB DS:6FC0 + 4·type): a behaviour named in
   * rules/effectkinds.ts, with its parameters. A game's types that are the same as another game's name
   * the same behaviour with the same parameters (CotAB's are PoR's but for the changed ones).
   */
  handlers: Record<number, HandlerSpec>
  /** effect types whose removal recomputes a stat (0 STR … 5 CHA) through the game's stat routine */
  removalStat: Record<number, number[]>
  /**
   * What readying (or putting away) an item with item +0x3E ≥ 0x80 does, by +0x3E & 0x7F: PoR's item
   * handlers 128–139 (FUN_4894_14d0 → FUN_5216_0000), CotAB's item kinds (0x3F034); an item behaviour
   * in rules/effectkinds.ts (ITEM_BEHAVIOURS) with its parameters; none listed, nothing
   */
  items: Record<number, HandlerSpec>
  /**
   * When adding an effect (with its message, event 9 first) takes out a record of the same type already
   * there: `longerOrPermanent` (PoR FUN_5216_1656) a timed old record when the new one lasts longer, any
   * old record when the new one is permanent, else both stay; `anyTimed` (CotAB 0x4CD91) any old record
   * with a duration left, whatever the new one's, while a permanent old record stays beside the new one
   */
  replaces: 'longerOrPermanent' | 'anyTimed'
  /** the camp Display window's fixed names by effect type: addresses of the game's strings (PoR FUN_3f81_0fbc, CotAB 0x30DDA) */
  names: Record<number, number>
  /** effect types whose presence stops unforced healing (PoR FUN_5216_175d: mummy rot 0x32; CotAB 0x4CE85: none) */
  healBlock: number[]
  /** the effect types the shared procedures add, test or remove by what they are */
  ids: EffectIds
}

/**
 * Effect types named by what they are, for the procedures outside the handlers that add, test or
 * remove them (the handlers' own types are their parameters). Each game gives its own numbers.
 */
export interface EffectIds {
  /** items in the party's hands show as magic (Detect Magic) */
  detectMagic: number
  /** scrolls can be read (Read Magic; PoR FUN_4e53_044e) */
  readMagic: number
  /** invisible: ends when the holder attacks or breathes */
  invisible: number
  /** the gas cloud's effects on a creature that saved (coughing) or did not (nauseated, helpless) */
  coughing: number
  nauseated: number
  /** movement doubled / halved (the battle's movement, PoR FUN_3aae_0d23) */
  hasted: number
  slowed: number
  /** poisoned, Slow Poison, and the slowed poison's tick */
  poisoned: number
  slowPoison: number
  poisonTick: number
  blind: number
  cursed: number
  /** an animated dead (Raise Dead takes it away) */
  animated: number
  /** a gazer whose gaze a readied item of its word turns back */
  gazeReflectable: number
  /** helpless: may be slain and makes no attack of opportunity; "(Helpless)" on the combat card (PoR FUN_10ba_09e3) */
  helpless: number[]
  /**
   * the records taken off a combatant that goes down (PoR FUN_5216_100a, CotAB 0x4C05B): the first of
   * each type, in this order, through the removal routine
   */
  goingDown: number[]
  /**
   * then (CotAB 0x4C05B → 0x4F395): one holding `effect` whose morale byte is `morale` goes back to
   * side 0; null: nothing
   */
  downRejoins: { effect: number; morale: number } | null
  /**
   * the records the computer's morale check takes off first, the first of each type (PoR FUN_3334_10d7
   * through FUN_5216_1041, CotAB 0x2443F through 0x4C0BD), and those it takes off one that turns to flee
   */
  moraleRemoves: number[]
  fleeRemoves: number[]
  /** a combatant holding one of these (grabbing, draining blood) makes no attack of opportunity */
  noOpportunity: number[]
  /** Cure Disease (PoR FUN_4e53_228a): each group's first type, then its partners when the first went */
  diseases: number[][]
  /** the STR records whose active one holds the STR to restore (PoR FUN_5216_115c) */
  strength: number[]
  /**
   * the current-stat routine's types (CotAB 0x4C389): STR added, STR set, INT and WIS to 3, CHA added,
   * CON 20 regeneration; null for a game without the routine (PoR)
   */
  stat: { strAdd: number; strSet: number[]; feebleminded: number; chaAdd: number; regenerate: number } | null
}

/** PoR's (spec/A-games/engine/effects.md §2, each at the routine cited) */
const POR_IDS: EffectIds = {
  detectMagic: 5, // FUN_10ba_0442: "* " on item names
  readMagic: 0x10, // FUN_4e53_044e
  invisible: 25,
  coughing: 0x1e, nauseated: 0x1f, // FUN_5216_0ae7, the gas cloud
  hasted: 0x27, slowed: 0x2a, // the battle's movement
  poisoned: 0x37, slowPoison: 0x16, poisonTick: 0x0f, // Slow Poison 185b, temple FUN_2d14_0d09
  blind: 0x21, cursed: 0x24, // temple FUN_2d14_0d09
  animated: 0x20, // FUN_2d14_0510
  gazeReflectable: 0x7f,
  helpless: [0x1f, 0x33, 0x34, 0x35], // FUN_10ba_09e3
  goingDown: [7, 11, 30, 31, 32, 51, 52, 53, 54, 58, 59, 95, 98, 137, 74, 75], // FUN_5216_100a: DS:0C14[1..16]
  downRejoins: null,
  moraleRemoves: [74, 75], // DS:0C24[1..2]
  fleeRemoves: [0x4a, 0x4b], // 0x24574
  noOpportunity: [0x4a, 0x4b], // grab, blood drain
  diseases: [[0x22], [0x2b, 0x2c, 0x1f], [0x32, 0x39]], // FUN_4e53_228a
  strength: [12, 38], // FUN_5216_115c
  stat: null,
}

/**
 * CotAB's: PoR's numbers where the type is unchanged (spec/A-games/coab/effects.md §2). Cure Disease is
 * PoR's routine byte for byte (0x46FA7), 0x32 and 0x39 included though they are the Hot Fire Shield and
 * engulf in CotAB (spec/A-games/coab/spells.md). `helpless` is PoR's list (0x4DC2B: DS:27CC[1..4]) and
 * so is `noOpportunity` (0x2B08D, 0x2B0A7), though CotAB's 75 is Giant bane and 74 is dead.
 */
const COAB_IDS: EffectIds = {
  ...POR_IDS,
  // 0x4C05B: DS:0A32[1..19]; against PoR's, 13, 21, 23, 136, 139, 144 added, 54, 74, 75 gone
  goingDown: [7, 11, 13, 21, 23, 30, 31, 32, 51, 52, 53, 58, 59, 95, 98, 136, 137, 139, 144],
  downRejoins: { effect: 0x4d, morale: 0xb3 }, // 0x4F395: a berserk NPC (77) back with the party
  // 0x4C0BD: DS:0A46[1..4]; fleeRemoves stays PoR's 0x4A, 0x4B (0x2459C), dead and Giant bane in CotAB
  moraleRemoves: [13, 58, 139, 144],
  stat: { strAdd: 0x26, strSet: [0x92, 0x0c], feebleminded: 0x44, chaAdd: 0x0e, regenerate: 0x3e }, // 0x4C389
}

/** A behaviour key (rules/effectkinds.ts) and its parameters. */
export interface HandlerSpec {
  b: string
  [param: string]: string | number | number[] | number[][] | string[]
}

const each = (types: number[], spec: HandlerSpec) => Object.fromEntries(types.map((t) => [t, spec]))

/**
 * `n` name slots of the game's string[15] array at image address `at` (16 bytes each), as the named-foe
 * handlers compare them; a slot that holds no text matches nothing
 */
const slots = (at: number, n: number) => Array.from({ length: n }, (_, i) => at + 16 * i)

/** PoR's handler of each type with `msg` replaced by another game's copy of the text */
const retext = (msgs: Record<number, number>): Record<number, HandlerSpec> =>
  Object.fromEntries(Object.entries(msgs).map(([t, msg]) => [t, { ...POR_HANDLERS[Number(t)], msg }]))

/**
 * PoR's handlers by type (spec/A-games/engine/effects.md §2; segment 3723 unless an image offset is
 * given). Text parameters (`msg`, `msgs`, `death`, `names`) are image addresses of the game's strings,
 * each the one the cited routine prints (spec/D-appendices/strings.md §5).
 */
const POR_HANDLERS: Record<number, HandlerSpec> = {
  ...each([5, 13, 16, 19, 24, 27], { b: 'none' }), // 319b (16: 0647; 24 is read by 25)
  1: { b: 'rollMorale', roll: 1, morale: 5 }, // 010d Bless
  2: { b: 'rollMorale', roll: -1, morale: -5 }, // 011d Curse
  3: { b: 'vsTargetType', bonus: [[4, 2]] }, // 013b
  4: { b: 'expireInto', msg: 0x2739f, type: 7, duration: 43200, power: 0xff, flag: 1 }, // 0x373AF
  6: { b: 'vsTargetType', bonus: [[10, 1], [9, 2], [12, 2], [4, 3]], dmgType: 9 }, // 01c3 flaming weapon
  7: { b: 'statUp', stat: 4, msg: 0x27458, at: 20, effect: 62, duration: 60, power: 0xff, hpFrom: 15, fighter: 2, fighterOnlyFrom: 17 }, // 0x37463
  ...each([8, 45], { b: 'saveVsAlignment', alignments: [2, 5, 8], save: 2 }), // 0377 Protection from Evil
  ...each([9, 46], { b: 'saveVsAlignment', alignments: [0, 3, 6], save: 2 }), // 03ac Protection from Good
  10: { b: 'resist', type: 2, save: 3, onRemoval: 1 }, // 03e1 Resist Cold
  11: { b: 'charmed', morale: 100 }, // 0400 Charm Person
  ...each([12, 38], { b: 'restoreStrength', types: [12, 38] }), // 04ba Enlarge, Strength
  14: { b: 'restoreStat', stat: 5 }, // 05d6 Friends
  15: { b: 'poisonTick', duration: 10, power: 0xff }, // 05eb
  17: { b: 'shield', ac: 57, save: 1, spell: 15 }, // 064e Shield: no Magic Missile
  18: { b: 'namedFoe', who: 'target', monsterType: 1, size: 1, roll: 1, names: slots(0x0cb02, 4) }, // 0679 (DS:342)
  20: { b: 'resist', type: 1, save: 3, onRemoval: 1 }, // 06e4 Resist Fire
  21: { b: 'breakSpell', msg: 0x27933 }, // 0x3793F Silence
  22: { b: 'poisonEnds', poison: 55, msg: 0x27994, also: 15 }, // 0x379A5 Slow Poison
  // 0x37A10 Spiritual Hammer: type 20, words 0x14 "Hammer" 0xF3 "Spiritual", +1, effect 0x17, item handler 0x89
  23: { b: 'conjuredItem', bytes: [[0x2e, 20], [0x30, 0x14], [0x31, 0xf3], [0x32, 1], [0x3d, 0x17], [0x3e, 0x89]], match: [0x2e, 0x31], msg: 0x27a02 },
  25: { b: 'unseen', detect: 24, roll: -4 }, // 0918 Invisibility
  26: { b: 'namedFoe', who: 'target', monsterType: 1, size: 1, roll: 1, names: slots(0x0cb42, 8) }, // 0947 (DS:382)
  28: { b: 'imageLost', msg: 0x27be2 }, // 0x37BF0 Mirror Image
  29: { b: 'damageCut', part: 4 }, // 0a3d Ray of Enfeeblement
  30: { b: 'breakSpell', msg: 0x27c89, sayOn: 15, acWorse: 2, acFloor: 0x32 }, // 0x37C95 Stinking Cloud
  ...each([31, 51, 52, 53], { b: 'endTurn', event: 7 }), // 133f helpless, Snake Charm, Hold, Sleep
  32: { b: 'collapse', msg: 0x27d41, move: 12 }, // 0x37D4B Animate Dead
  33: { b: 'penalty', roll: -4, ac: -4, save: -4 }, // 0bac Cause Blindness
  34: { b: 'runTypes', types: [43, 44] }, // 0bcf Cause Disease
  35: { b: 'saveElseRoll', save: 1, roll: 1 }, // 0c06 Prayer's ally half
  36: { b: 'penalty', roll: -4, save: -4 }, // 0c15 Bestow Curse
  37: { b: 'blink' }, // 0c26 Blink
  39: { b: 'attackRate', ages: 0x10, msg: 0x27e76, mul: 2 }, // 0x37E7B Haste
  40: { b: 'liftZone', cell: 0x1e, msg: 0x27ed8 }, // 0x37EF3 the Stinking Cloud's zone (FUN_3723_0cc3)
  41: { b: 'deflect', pct: 100, plainWeapon: 1 }, // 1086 Protection from Normal Missiles
  42: { b: 'attackRate', div: 2 }, // 10c1 Slow
  43: { b: 'loseStrength', duration: 60, floor: 3, msg: 0x28302, helpless: 31 }, // 0x3830E
  44: { b: 'loseHp', duration: 10, helpless: 31 }, // 1168
  47: { b: 'namedFoe', who: 'attacker', monsterType: 1, size: 2, sizeMask: 0x7f, roll: -4, names: slots(0x0cbc2, 8) }, // 11f9 (DS:402)
  48: { b: 'namedFoe', who: 'attacker', monsterType: 1, roll: -4, names: [0x28498, 0x284a0] }, // 0x384A6
  49: { b: 'prayer', sideBit: 0x10, save: 1, roll: 1 }, // 12b2 Prayer
  50: { b: 'regenerate', duration: 14400, force: 1 }, // 12fb mummy rot's healing
  ...each([54, 55, 60, 63], { b: 'none' }), // 1355, 135c, 319b (55: the poisoned marker)
  56: { b: 'grant', type: 25, duration: 1, power: 0x0c }, // 1363 permanent invisibility
  57: { b: 'rot', stat: 5, loss: 2, floor: 3, duration: 43200, msg: 0x285b2, death: 0x285ba }, // 0x385C9 mummy rot's decay
  58: { b: 'noMove', moveRate: 1 }, // 1452 held
  59: { b: 'expireInto', type: 98, duration: 0, power: 0xff, flag: 0 }, // 1472 regeneration delay
  61: { b: 'resistPerDie', type: 1, per: 2, magic: 8, save: 4 }, // 1490 strong fire resistance
  62: { b: 'regenerate', duration: 60, force: 0 }, // 14eb regeneration
  64: { b: 'poisonOnHit', bonus: 0, effect: 55, msg: 0x2875f }, // 165d → 1545
  65: { b: 'poisonOnHit', bonus: 4, effect: 55, msg: 0x2875f }, // 1671
  66: { b: 'poisonOnHit', bonus: 2, effect: 55, msg: 0x2875f }, // 1685
  67: { b: 'paralyseOnHit', roll: [2, 8], effect: 52, power: 0x0c, msg: 0x2880e }, // 1699 → 15eb
  68: { b: 'paralyseOnHit', duration: 63, notRace: 2, effect: 52, power: 0x0c, msg: 0x2880e }, // 16bb ghoul
  69: { b: 'paralyseOnHit', roll: [1, 9, 10], effect: 52, power: 0x0c, msg: 0x2880e }, // 16e6
  70: { b: 'poisonOnHit', bonus: -2, effect: 55, msg: 0x2875f }, // 170b
  71: { b: 'hidden', roll: -4 }, // 171f
  72: { b: 'grant', type: 25, duration: 1, power: 0x0c, below: 96 }, // 1730 95 % invisibility
  73: { b: 'rake', attacks: 2, dice: 2, sides: 4, msg: 0x2e4a9 }, // 0x3E4B2
  74: { b: 'crush', attacks: 1, dice: 3, sides: 4, held: 58 }, // 3aae_3a86
  75: { b: 'bloodDrain', sides: 4, held: 58, msg: 0x2898e, keep: 1 }, // 0x3899F
  76: { b: 'attach', drain: 75, duration: 0xcf, held: 58 }, // 18b5 stirge
  77: { b: 'holdFast', maxStr: 19, crush: 74, held: 58, msg: 0x28b58 }, // 0x38B65
  78: { b: 'revive', full: 0, keepPower: 1 }, // 19d9
  79: { b: 'hitDamage', count: 2, sides: 10, dmgType: 9, active: 1, keep: 1 }, // 1a19 fire on hit
  80: { b: 'hitDamage', count: 1, sides: 4, dmgType: 0x10, active: 1, keep: 1 }, // 1a4c acid on hit
  81: { b: 'fearAura', saveType: 4, hdUpTo: [3, 5], effects: [52, 2], power: 0x0c, msgs: [0x28caf, 0x28cc6] }, // 0x38CDA
  82: { b: 'paralysingAura', bonus: 1, crowd: 6, raceBonus: [7, 2], effect: 52, roll: [1, 4], power: 0x0c, msg: 0x28dc1 }, // 0x38DD8
  83: { b: 'stoneGaze', reflectable: 127, word: 0x76, save: 1, status: 7, gazes: 0x28ebd, reflects: 0x28ec6, msg: 0x28ed3 }, // 0x38EDD (word 0x76 "Mirror")
  84: { b: 'charmGaze', spell: 10, save: 4, bonus: -2, effect: 11, power: 0x0c, gazes: 0x29093 }, // 0x390A7
  85: { b: 'drainOnHit', levels: 1 }, // 23a4
  86: { b: 'drainOnHit', levels: 2 }, // 23c2
  87: { b: 'diseaseOnHit', heal: 50, healFor: 14400, rot: 57, rotFor: 43200, msg: 0x29610 }, // 0x3961C mummy rot
  88: { b: 'breathBolt', pct: 50, spell: 51, len: 10, save: 3, msg: 0x415ff }, // FUN_4e53_30d9 (image 0x41609)
  89: { b: 'displaced', bit: 0x10 }, // 2490
  90: { b: 'conSave', saveTypes: [0], bands: [[4, 1], [7, 2], [11, 3], [14, 4], [18, 5]] }, // 24d9
  91: { b: 'immuneSpell', spell: 15, mask: 4, msg: 0x29778 }, // 0x39786: Magic Missile and electricity
  92: { b: 'none' }, // 319b
  93: { b: 'halveType', mask: 1 }, // 25a2
  94: { b: 'halveByWeaponKind', kinds: [0x80, 1] }, // 25bc blunt or piercing
  95: { b: 'diesAtEnd', msg: 0x29835 }, // 0x39840
  96: { b: 'needsMagicOrWord', word: 0xb1 }, // 264b (0xB1 "Silver")
  97: { b: 'conSave', saveTypes: [2, 4], bands: [[4, 1], [7, 2], [11, 3], [14, 4], [18, 5]] }, // 268a
  98: { b: 'healEachRound', hp: 3 }, // 2700
  99: { b: 'rally', full: 6, after: 95 }, // 2730
  100: { b: 'unlessKilledBy', mask: 0x11, effect: 102, roll: [3, 6] }, // 27d9 troll death
  101: { b: 'startUnless', unless: [98, 59], effect: 59, duration: 3 }, // 2814
  102: { b: 'revive', full: 1, keepPower: 0 }, // 2866
  103: { b: 'escapes', msg: 0x29ad5, status: 3 }, // 0x39AEF
  104: { b: 'deflect', pct: 60 }, // 2901
  105: { b: 'magicResist', base: 50, classes: [0, 5] }, // 2976
  106: { b: 'magicResist', base: 15, classes: [0, 5] }, // 2984
  107: { b: 'blocks', types: [53, 11], pct: 90 }, // 2992 elves: Sleep, Charm
  108: { b: 'blocks', types: [11, 53] }, // 29b6
  109: { b: 'blocks', types: [52] }, // 29cb Hold
  110: { b: 'immuneType', mask: 2 }, // 29d9
  111: { b: 'immunities', types: [55, 52], saveType: 0 }, // 29f0 poison, paralysis
  112: { b: 'immuneType', mask: 1 }, // 2a11
  113: { b: 'resistPerDie', type: 1, per: 1 }, // 2a28
  114: { b: 'halveType', mask: 4 }, // 2a6d
  115: { b: 'halveByWeaponKind', kinds: [0, 1], unarmed: 1 }, // 2a87
  116: { b: 'halveByPlus' }, // 2ae6
  117: { b: 'vulnerableTo', item: 0x55, roll: [1, 6, 1], keep: 1 }, // 2b20 holy water
  118: { b: 'halveType', mask: 2 }, // 2b63
  119: { b: 'needsEnchantment', hd: 4 }, // 2b7d
  120: { b: 'deflect', pct: 50, items: [0x57, 0x58] }, // 2bc8 hurled boulders
  121: { b: 'spitOnce', pct: 25, range: 4, roll: [8, 4], dmgType: 0x10, save: 3, also: 80, keep: 1, msg: 0x29e41 }, // 0x39E4C
  122: { b: 'vulnerableTo', item: 0x56, roll: [3, 8, 0], diceOn: 9, keep: 1 }, // 2d38 oil
  123: { b: 'halfForWord', word: 0xb1 }, // 2d88 Silver
  124: { b: 'blocks', types: [11, 53], pct: 30 }, // 2de4 half-elves
  125: { b: 'immunities', types: [11, 53, 52, 55], saveType: 0 }, // 2e08 undead
  126: { b: 'warded', words: [0x76], pairs: [[0x98, 0xfc]] }, // 2e37 Mirror, Holy Symbol
  127: { b: 'none' }, // 319b: read by 83
}

export const POR_EFFECTS: EffectRules = {
  events: {
    0: [126], 1: [63, 37, 25, 71], 2: [85, 86, 87, 68, 79, 80, 76, 73, 77],
    3: [64, 65, 66, 67, 68, 69, 70, 79, 85, 86, 87], 4: [29, 3, 6],
    5: [28, 41, 104, 120, 101, 115, 116, 119, 123, 96, 94, 60, 122, 117],
    6: [113, 61, 122, 60, 91, 10, 20, 105, 106, 112, 114, 118, 17, 93, 101, 28],
    7: [51, 52, 53, 31], 8: [99, 81, 82, 89, 72, 56], 9: [105, 106, 107, 108, 109, 110, 111, 112, 124, 125],
    10: [1, 2, 33, 36, 49, 3, 6, 18, 26], 11: [33, 17, 8, 9, 45, 46, 30],
    12: [8, 9, 10, 17, 20, 33, 36, 45, 46, 49, 61, 111, 125, 90, 97], 13: [99, 100, 103, 75, 74],
    14: [83, 84, 88, 121], 15: [21, 30, 74, 75, 11], 16: [25, 71, 37, 47, 48, 89], 17: [1, 2, 11], 18: [39, 42, 58],
    19: [98, 23, 72, 56, 11],
  },
  area: [21, 45, 46, 49],
  areaRadius: { 49: 6 },
  handlers: POR_HANDLERS,
  removalStat: {},
  // PoR's item handlers 128–139 (spec/A-games/engine/effects.md "Item handlers"), by +0x3E − 0x80
  items: {
    ...each([0, 1, 2, 5, 6, 8, 10, 11], { b: 'grantEffect', power: 0x0c, flag: 0, quietly: 1 }), // 2eda: 128–130, 133, 134, 136, 138, 139
    3: { b: 'strengthItem', str: 18, pct: 100, effect: 38, msg: 0x2a17b }, // 131 Gauntlets of Ogre Power (0x3A187)
    4: { b: 'alignmentLocked' }, // 132 (30a5)
    7: { b: 'needsStrength', str: 19, msg: 0x2a34b }, // 135 Boulder (0x3A364)
    9: { b: 'unreadyEnds', type: 23 }, // 137 Spiritual Hammer (317a)
  },
  replaces: 'longerOrPermanent',
  names: { 4: 0x306d8, 7: 0x306f9, 27: 0x3071f, 31: 0x3072c, 35: 0x30735, 44: 0x3073c, 50: 0x3074a, 54: 0x30760, 55: 0x30769,
    59: 0x30772, 61: 0x3077f, 71: 0x3078f, 72: 0x30799, 89: 0x307a5 },
  healBlock: [0x32],
  ids: POR_IDS,
}

export const COAB_EFFECTS: EffectRules = {
  events: {
    0: [], 1: [37, 25, 71, 69], 2: [79, 80, 145, 57, 96, 122, 123], 3: [64, 65, 66, 67, 70, 79, 87],
    4: [29, 6, 103, 75, 76, 134], 5: [28, 41, 104, 120, 101, 115, 116, 119, 94, 117, 60, 81, 82, 85, 130, 143],
    6: [113, 61, 10, 20, 105, 106, 112, 114, 118, 17, 93, 101, 28, 110, 73, 82, 84, 129, 133, 135, 63],
    7: [51, 52, 53, 31, 3, 27, 136], 8: [99, 82, 89, 72, 56], 9: [105, 106, 107, 108, 109, 110, 111, 112, 124, 125, 63, 129],
    10: [1, 2, 33, 36, 49, 6, 18, 26, 75, 76], 11: [33, 17, 8, 9, 45, 46, 30, 7],
    12: [8, 9, 10, 17, 20, 33, 36, 45, 46, 49, 61, 111, 125, 97, 50, 54], 13: [99, 100, 75],
    14: [83, 88, 121, 86, 87, 90, 126, 128, 131, 132, 139], 15: [21, 30, 11, 13, 77], 16: [25, 71, 37, 47, 48, 89, 4],
    17: [1, 2, 11], 18: [39, 42, 58], 19: [98, 23, 72, 56, 11],
    // new: 20 damage not saved (0x4CAB2), 21 a turn begins (0x2209E), 22 combat starts (0x26A1A);
    // 23 (type 74) is never fired
    20: [50, 54], 21: [35], 22: [138], 23: [74],
  },
  area: [21, 45, 46, 49],
  areaRadius: { 49: 6 },
  // PoR's handlers, then the changed and new ones (DS:6FC0 + 4·type, filled at 0x29E28 and 0x4AA3A); spec/A-games/coab/effects.md §2
  handlers: {
    ...POR_HANDLERS,
    // PoR's handlers whose text CotAB keeps, with CotAB's own copy of it (each read at the routine of
    // DS:6FC0 + 4·type; the on-hit poison and paralysis lines at the shared 0x28757 and 0x287FE)
    ...retext({ 21: 0x277f5, 22: 0x27856, 23: 0x278c5, 30: 0x27b2c, 32: 0x27be4, 39: 0x27ef0, 40: 0x27f52, 43: 0x2837c,
      64: 0x28741, 65: 0x28741, 66: 0x28741, 67: 0x287f1, 70: 0x28741, 95: 0x2914b, 121: 0x2973b }),
    3: { b: 'snakes', msg: 0x27414 }, // 0x2742C
    4: { b: 'attackerClass', flag: 1, roll: -7 }, // 0x274AF (Dispel Evil's defence)
    7: { b: 'acBoth', add: 2, cap: 0x3c }, // 0x2752F
    12: { b: 'none' }, 14: { b: 'none' }, 38: { b: 'none' }, 146: { b: 'none' }, // 0x276B7, 0x27705, 0x29E21: the stat comes from 0x4C389
    13: { b: 'suffocate', msg: 0x276be }, // 0x276C9
    18: { b: 'targetClass', flag: 2, roll: 1 }, // 0x2779A (gnomes)
    20: { b: 'resist', type: 1, save: 3 }, // 0x277D0
    25: { b: 'invisibility', detect: 0x18 }, // 0x27A16
    26: { b: 'targetClass', flag: 4, roll: 1 }, // 0x27A4B (dwarves)
    // 0x273C1 (thunk 0x64:0x2F at DS:6FC0 + 4·type): ends the turn whenever it runs, also run at once
    27: { b: 'endTurn' }, 31: { b: 'endTurn' }, 51: { b: 'endTurn' }, 52: { b: 'endTurn' }, 53: { b: 'endTurn' },
    28: { b: 'mirrorImage', msg: 0x27a81 }, // 0x27A8F
    35: { b: 'confusion', flee: 0x8e, berserk: 0x89, fleeMsg: 0x27cfb, confused: 0x27d05, berserkMsg: 0x27d11, enraged: 0x27d1e }, // 0x27D29
    37: { b: 'notReady' }, // 0x27ED0
    47: { b: 'attackerKind', types: [2, 10], size: 2, roll: -4 }, // 0x284A3
    48: { b: 'attackerKind', types: [1], size: 2, roll: -4 }, // 0x284F2
    50: { b: 'weakTo', saveOn: 2, double: 1, saved: 1 }, // 0x28562: cold +2 save, unsaved fire ×2
    54: { b: 'weakTo', saveOn: 1, double: 2, saved: 0 }, // 0x28593: fire +2 save, cold ×2 (DS:5D0B, 0 in combat)
    57: { b: 'engulf', held: 0x3a, suffocate: 0x0d, marker: 0x8b, msg: 0x2e579 }, // 0x2E582
    60: { b: 'magicWeapons', full: 3 }, // 0x28628: plus 0 nothing, below 3 half
    63: { b: 'minorGlobe', below: 4 }, // 0x2871A
    68: { b: 'feeblemind', msg: 0x288ce, lost: 0x288d8 }, // 0x288E5
    69: { b: 'untargetableBy', type: 19, detect: 0x18, roll: -4 }, // 0x28986
    73: { b: 'immune', mask: 0x20, say: 1, msg: 0x28a14 }, // 0x28A22
    74: { b: 'none' }, // 0x28A5E: an empty handler (PoR's grab and crush; the type is dead in CotAB, event 23 never fires)
    75: { b: 'giantBane', type: 3 }, // 0x28A6A
    76: { b: 'bane', type: 8, roll: 3, dmg: 3 }, // 0x28AC2
    77: { b: 'berserk', say: 1, restore: 0, msg: 0x28af6 }, // 0x28B03
    81: { b: 'halve' }, // 0x28CCF
    82: { b: 'fireColdSave' }, // 0x28CE0
    84: { b: 'absorbElectricity' }, // 0x28D31
    85: { b: 'piercingOne' }, // 0x28D64
    91: { b: 'liftZone', cell: 0x1c, msg: 0x28dee }, // 0x28E09: lifts the owner's Cloudkill zone (list DS:7579)
    // the monster specials [14] (rules/specials.ts); `hook`/`spell`: the spell whose computer target
    // pick (*DS:72BA) chooses the target. PoR's 87 (mummy rot) and 90 (CON poison bonus) mean other things.
    83: { b: 'gazeStone', spell: 0x41, word: 0x76, gazes: 0x497ae, reflects: 0x497b7, msg: 0x497c4 }, // 0x497CE
    86: { b: 'spitAcid', range: 7, pct: 30, hook: 0x41, misses: 0x49b48, msg: 0x49b3d }, // 0x49B5E
    // 0x2E842: disintegrate, stone, death, wounding by reach, then Fear, Slow, Sleep
    87: { b: 'eyeRays', shots: 4, ranges: [2, 3, 4, 5], saves: [3, 1, 0], statuses: [8, 7, 6], frames: [5, 10, 5, 5], wound: [2, 8, 1], spells: [0x54, 0x37, 0x15], rays: [0x2e7cb, 0x2e7f6, 0x2e81b, 0x2e837], gone: [0x2e7e4, 0x2e811, 0x2e82d] },
    88: { b: 'breathBolt', pct: 50, spell: 0x33, len: 10, save: 3, dmgType: 0x24, msg: 0x499c3 }, // 0x499CD
    90: { b: 'breathArea', uses: 3, dmgType: 0x30, spell: 0x3d, width: 1, len: 6, ownSide: 1, msg: 0x49c86 }, // 0x49C94
    128: { b: 'breathArea', uses: 3, dmgType: 0x21, spell: 0x3d, width: 3, len: 9, ownSide: 0, msg: 0x49e66 }, // 0x49E74
    132: { b: 'throwLightning', rounds: 4, spell: 0x33, count: 16, sides: 6, len: 10, save: 4, msg: 0x4a110 }, // 0x4A121
    96: { b: 'hug', held: 0x3a, marker: 0x90, msg: 0x2ed56 }, // 0x2ED5C
    103: { b: 'extraDamage', lacks: [0x14, 0x36, 0x3d], sides: 6 }, // 0x293AD
    110: { b: 'immune', mask: 2, say: 0 }, // 0x29502
    122: { b: 'holdOnHit', save: 0, effect: 0x34, msg: 0x29866 }, // 0x29873
    123: { b: 'hitDamage', count: 2, sides: 8, dmgType: 0x0a }, // 0x298ED
    126: { b: 'gazeHold', minutes: 60, hook: 0x41, effect: 0x34, gazes: 0x4a1fe, msg: 0x4a207 }, // 0x4A214
    129: { b: 'magicResistance' }, // 0x29973
    130: { b: 'quarrelSlays', type: 0x1c, word: 0x87 }, // 0x29993
    131: { b: 'breatheFire', pct: 50, dmg: 7, hook: 0x41, msg: 0x49ff3 }, // 0x4A001
    133: { b: 'blocks', types: [0x8e, 0x1d, 0x44], mask: 0x40 }, // 0x29AA0
    134: { b: 'rangerVsGiants', flag: 8 }, // 0x29ACC
    135: { b: 'immune', mask: 4, say: 0 }, // 0x29B05
    136: { b: 'noMove' }, // 0x29B1C
    137: { b: 'berserk', say: 0, restore: 1 }, // 0x29B30
    138: { b: 'startInvisible', effect: 0x19 }, // 0x29C20
    139: { b: 'heldVictim', marker: 0x8b, attacks: 2, held: 0x3a, also: 0x0d }, // 0x2EB16
    142: { b: 'runsAway' }, // 0x29C82
    143: { b: 'zap', msg: 0x29cb9 }, // 0x29CC5
    144: { b: 'heldVictim', marker: 0x90, attacks: 1, held: 0x3a, also: 0 }, // 0x2EC4C
    145: { b: 'dispelEvil', flag: 1, removes: [4, 0x91], resists: 0x29d55, msg: 0x29d48 }, // 0x29D69
    140: { b: 'none' }, // 0x29E21: Lay on Hands' wait (R.paladin)
    141: { b: 'refillUses' }, // 0x29C3F: Cure Disease's week (R.paladin)
    // 147 (0x29A23, also DS:720C), the generic item handler, runs for items only: `items[0]`
  },
  // remove 0x4ABBA: CHA after 0x0E, STR after 0x0C, 0x26, 0x92
  removalStat: { 0x0e: [5], 0x0c: [0], 0x26: [0], 0x92: [0] },
  // the item kinds (0x3F034, spec/A-games/coab/effects.md)
  items: {
    0: { b: 'grantEffect', power: 0xff, flag: 1, outsideCombat: 1 }, // the generic handler 147 (0x29A23)
    1: { b: 'doubleSlots', levels: 3 }, // Ring of Wizardry
    2: { b: 'recomputeStats', stats: [3], thief: 1 }, // DEX and thief skills
    4: { b: 'alignmentLocked', alsoUnready: 1 },
    5: { b: 'recomputeStats', stats: [0] }, // STR 18/00 or 19–24
    6: { b: 'recomputeStats', stats: [4, 5] },
    8: { b: 'recomputeStats', fromValue: 1 }, // the stat +0x3D, +1 below 18
    9: { b: 'unreadyEnds', type: 0x17 }, // Spiritual Hammer
    0x0a: { b: 'recomputeStats', stats: [3] },
    0x0b: { b: 'recomputeStats', stats: [], thief: 1 }, // thief skills
    0x0c: { b: 'recomputeStats', stats: [1] },
    0x0d: { b: 'recomputeStats', stats: [0, 1] },
  },
  replaces: 'anyTimed', // 0x4CE0A: found, and its duration word > 0
  names: { 4: 0x30cba, 7: 0x30cc6, 27: 0x30cd2, 31: 0x30cdb, 35: 0x30ce4, 44: 0x30ced, 50: 0x30cfb, 54: 0x30d0b, 55: 0x30d1c,
    59: 0x30d25, 61: 0x30d32, 63: 0x30d42, 68: 0x30d61, 69: 0x30d6b, 71: 0x30d80, 72: 0x30d8a, 73: 0x30d96, 77: 0x30db3, 89: 0x30dbb },
  healBlock: [], // 0x4CE85: the 0x32 test is gone (0x32 is the Hot Fire Shield in CotAB)
  ids: COAB_IDS,
}
