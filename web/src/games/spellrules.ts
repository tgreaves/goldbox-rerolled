// Spell handlers per game: each spell id names a handler kind (a procedure in rules/spellkinds.ts or the
// battle's own, named by what it does) and its parameters, as the original's handler table does
// (PoR DS:6B84 + 4·id, filled by FUN_4e53_3413; CotAB DS:72BA, filled at 0x4A4FF). Every id a game has is
// listed, so no game is the default. spec/A-games/engine/spells.md "Per spell"; spec/A-games/coab/spells.md §2.

/**
 * A count, a bonus or a fixed amount: a number, the caster level 'L', 'L/2' (L div 2), '(L+1)/2', or a
 * rolled count {roll: [n, d], mul, add} (Necklace of Missiles' 1d3 × 2 + 1).
 */
export type Term = number | 'L' | 'L/2' | '(L+1)/2' | { roll: [number, number]; mul?: number; add?: number }

/** n d d + plus, with n and plus as terms; plus 'n' adds the dice count again (CotAB's Magic Missile). */
export interface Amount { n: Term; d: number; plus?: Term | 'n' }

/** roll(n, d) × mul + add: a duration in minutes (FUN_4e53_07d6's special cases). */
export interface Rolled { n: number; d: number; mul?: number; add?: number }

/** A handler kind and its parameters. */
export interface SpellSpec {
  k: string
  /** the line on each creature the effect took (FUN_5216_1656's message) */
  /** the line said for each target: the address of the game's string, or the addresses of its pieces joined (spec/D-appendices/strings.md §5) */
  msg?: number | number[]
  /** the cast sound in combat (default 2) */
  sound?: number
  /** the computer's target for a friendly spell: 'woundedNear', the most hurt adjacent ally, else itself */
  aiTarget?: 'woundedNear'
  [param: string]: unknown
}

export interface SpellRules {
  handlers: Record<number, SpellSpec>
  /**
   * How the STR spells (Enlarge, Strength, Giant Strength) take: `setCurrent` (PoR FUN_5216_115c) sets
   * the current STR when that raises it and adds the effect either way; `overBase` (CotAB 0x4C1D8) adds
   * it only when the new STR beats the base STR, and the current STR is worked out again (0x4C389)
   */
  strength: 'setCurrent' | 'overBase'
  /**
   * FUN_4e53_07d6's special cases by id (else record bytes 4 + 5 × L); `outside` when it differs out of
   * combat; `record`: another spell record's bytes 4 + 5 × L (CotAB Entangle's Duration(0x88))
   */
  durations: Record<number, (Rolled & { outside?: Rolled }) | { record: number }>
}

const each = (ids: number[], spec: SpellSpec) => Object.fromEntries(ids.map((id) => [id, spec]))

// ---------------------------------------------------------------- Pool of Radiance
/** PoR FUN_4e53_07d6 (CotAB 0x44E02 is byte-identical). */
const DURATIONS: SpellRules['durations'] = {
  40: { n: 1, d: 6, mul: 10 },
  57: { n: 5, d: 4 }, 61: { n: 5, d: 4 },
  59: { n: 1, d: 4, mul: 10, add: 40 },
  63: { n: 2, d: 10, mul: 10, outside: { n: 1, d: 10, mul: 10, add: 100 } },
  67: { n: 0, d: 0, add: 1440 },
}

/** Sleep's cost by hit dice (FUN_4e53_151b): 0–1 → 1 … 4 → 6; 5 → 10 for race 0, else 20; above, or below 0, 20. */
const SLEEP = { k: 'sleep', pool: { n: 4, d: 4 }, effect: 0x35, msg: 0x3fa3e, hdCost: [1, 1, 2, 4, 6], hd5: [10, 20], other: 20 }

export const POR_SPELLS: SpellRules = {
  durations: DURATIONS,
  strength: 'setCurrent',
  handlers: {
    1: { k: 'applySide', side: 'ally', notEngaged: 1, msg: 0x3f534 }, // 100f → 0f4f
    2: { k: 'applySide', side: 'enemy', msg: 0x3f566 }, // 1040 → 0f4f
    3: { k: 'heal', amount: { n: 1, d: 8 }, aiTarget: 'woundedNear' }, // 106b
    // the dice through FUN_5216_0e2e, which keeps the count in DS:681C for the resistances (61, 113, 122):
    // 4, 15, 20, 47/64 (266b), 65; 9, 51, 60 roll without it
    4: { k: 'damage', amount: { n: 1, d: 8 }, dmgType: 8, recordDice: 1 }, // 10a7
    ...each([5, 11, 18, 22, 29], { k: 'apply', msg: 0x3f60d }), // 10e9
    ...each([6, 7, 16, 17, 52, 53, 54], { k: 'apply', msg: 0x3f646 }), // 1123
    8: { k: 'apply', msg: 0x3f680 }, // 1162
    9: { k: 'damage', amount: { n: 0, d: 0, plus: 'L' }, dmgType: 9 }, // 1190
    10: { k: 'charm', sideMul: 128, msg: 0x3f702 }, // 11dd
    12: { k: 'enlarge', levels: [[18, 0], [18, 0], [18, 1], [18, 51], [18, 76], [18, 91], [18, 100]], effect: 0x0c, msg: 0x3f7c9 }, // 12a5
    13: { k: 'reduce', effect: 0x0c, saveType: 4, msg: 0x3f88d }, // 136e
    14: { k: 'friends', amount: { n: 2, d: 4 }, cap: 25, effect: 0x0e, msg: 0x3f8fc }, // 13d8
    15: { k: 'damage', amount: { n: 'L/2', d: 4, plus: 'L/2' }, dmgType: 8, recordDice: 1 }, // 1439
    19: { k: 'apply', msg: 0x3f9bd }, // 1499
    20: { k: 'damage', amount: { n: 1, d: 8, plus: 'L' }, dmgType: 0x0c, recordDice: 1 }, // 14c7
    21: SLEEP, // 151b
    23: { k: 'hold', bonus: [-2, -1, 0], effect: 0x34, sizeImmune: 1, msg: 0x3fb80 }, // 1658
    24: { k: 'apply', msg: 0x3fd07 }, // 17e9
    25: { k: 'apply', msg: 0x3fd46 }, // 1822
    26: { k: 'slowPoison', msg: 0x3fd7f }, // 185b
    27: { k: 'charmByHp', monsterType: 0x0e, effect: 0x33, msg: 0x3fe34 }, // 190f
    28: { k: 'applyTo', to: 'caster', flag: 1, runNow: 1 }, // 19c3
    ...each([30, 50], { k: 'apply', msg: 0x3ff39 }), // 1a16
    63: { k: 'apply', msg: 0x4154d }, // 302a
    31: { k: 'apply' }, // 1a4f: Knock does nothing here (no effect type)
    32: { k: 'images', amount: { n: 1, d: 4 }, effect: 0x1c }, // 1a8a
    33: { k: 'apply', msg: 0x3fff0 }, // 1acc
    // 1b11, DS:290D: a square already gassed takes the cell another Stinking Cloud found there
    34: { k: 'cloud', dirs: 'gasCloud', count: 4, cell: 0x1e, owner: 0x28, replaced: [{ cell: 0x1e, zones: 0x1e, not: [0x1e] }], msg: 0x40029 },
    35: { k: 'strengthByClass', bonus: [{ cls: [5], d: 4 }, { cls: [0, 6], d: 6 }, { cls: [2], d: 8 }], pctClasses: [2], effect: 0x26, msg: 0x40465 }, // 1f41
    36: { k: 'animateDead', effect: 0x20, msg: 0x40593 }, // 206f
    37: { k: 'cure', effect: 0x21, msg: 0x4073f }, // 2217
    38: { k: 'apply', msg: 0x40784 }, // 225d
    39: { k: 'cureDisease' }, // 232f → 228a
    40: { k: 'apply', flag: 1, msg: 0x40870 }, // 234c
    ...each([41, 46], { k: 'dispel', msg: 0x408a9 }), // 2385
    42: { k: 'applyTo', to: 'caster', sideShift: 4, msg: 0x409fb }, // 24d6
    43: { k: 'removeCurse', effect: 0x24 }, // 2540
    44: { k: 'apply', msg: 0x40b23 }, // 2604
    45: { k: 'apply', msg: 0x40b61 }, // 263d
    47: { k: 'damage', amount: { n: 'L', d: 6 }, dmgType: 9, recordDice: 1, look: 1, outdoorRadius: 2, sound: 11 }, // 266b
    48: { k: 'hasteSlow', side: 'ally', opposite: 0x2a, attacksAfter: 1, msg: 0x40db8 }, // 2892 → 2764
    49: { k: 'hold', bonus: [-3, -1, 0], effect: 0x34, sizeImmune: 1, msg: 0x3fb80 },
    51: { k: 'bolt', amount: { n: 'L', d: 6 }, saveType: 4, sound: 8 }, // 2bb7
    55: { k: 'hasteSlow', side: 'enemy', opposite: 0x27, attacksAfter: 1, msg: 0x4112f }, // 2c09 → 2764
    56: { k: 'restore', msg: 0x41167 }, // 2c43
    57: { k: 'toggle', remove: 0x2a, effect: 0x27, power: 12, msg: 0x41328 }, // 2e02
    58: { k: 'ointment', amount: { n: 1, d: 4, plus: 8 }, msg: 0x41373 }, // 2e4d
    59: { k: 'setStrength', str: 21, pct: 0, effect: 0x26, msg: 0x41409 }, // 2ee5
    60: { k: 'damage', amount: { n: 1, d: 6, plus: 20 }, dmgType: 0x0c }, // 2f4d (its 3-square path not yet)
    61: { k: 'apply', rollDuration: { n: 5, d: 4 } }, // 2f99
    62: { k: 'heal', amount: { n: 2, d: 4, plus: 2 } }, // 2fd0
    64: { k: 'damage', amount: { n: { roll: [1, 3], mul: 2, add: 1 }, d: 6 }, dmgType: 9, recordDice: 1 }, // 266b
    65: { k: 'damage', amount: { n: 2, d: 4, plus: 2 }, dmgType: 8, recordDice: 1 }, // 3058
    66: { k: 'apply' }, // 3092: nothing
    67: { k: 'applyTo', to: 'first', duration: 1440, power: 0xff, flag: 1, msg: 0x415c7 }, // Manual of Bodily Health
  },
}

// ---------------------------------------------------------------- Curse of the Azure Bonds
/**
 * CotAB's table (DS:72BA): ids 1–56 are PoR's spells, most with the same handler (spec/A-games/coab/spells.md
 * §2, "same"); 57–67 keep PoR's item spells where the record matches; 58 and 66–100 are its own.
 * Every id is transcribed (spec/A-games/coab/spells.md §2; what is inferred: spec/B-model/vocabularies.md §8.3).
 */
/** PoR's handler of each id with `msg` replaced by another game's copy of the text */
const retext = (msgs: Record<number, number>): Record<number, SpellSpec> =>
  Object.fromEntries(Object.entries(msgs).map(([id, msg]) => [id, { ...POR_SPELLS.handlers[Number(id)], msg }]))
const POR_HANDLERS_1_57 = Object.fromEntries(Object.entries(POR_SPELLS.handlers).filter(([id]) => Number(id) <= 57 || [60, 61, 62, 63, 64, 65].includes(Number(id))))

export const COAB_SPELLS: SpellRules = {
  // 0x44E02 is PoR's; Entangle's handler asks for Duration(0x88), past the table: 6 + 3·L (a bug kept)
  durations: { ...DURATIONS, 78: { record: 0x88 } },
  strength: 'overBase',
  handlers: {
    ...POR_HANDLERS_1_57,
    // PoR's lines with CotAB's own copy of the text, each read at the routine of DS:72BA + 4·id
    ...retext({ 1: 0x45cc5, 21: 0x46269, 2: 0x45cf7, 5: 0x45d9e, 6: 0x45dd7, 7: 0x45dd7, 8: 0x45e11, 10: 0x45e93, 11: 0x45d9e, 16: 0x45dd7, 17: 0x45dd7, 18: 0x45d9e, 19: 0x461e8, 22: 0x45d9e, 23: 0x463ac, 24: 0x46405, 25: 0x46444, 26: 0x4647d, 27: 0x46532, 29: 0x45d9e, 30: 0x46637, 33: 0x4670a, 36: 0x46d7d, 37: 0x46f2c, 38: 0x46f71, 40: 0x4705d, 42: 0x474ff, 44: 0x4767a, 45: 0x476b8, 49: 0x463ac, 50: 0x46637, 52: 0x45dd7, 53: 0x45dd7, 54: 0x45dd7, 56: 0x47ccc, 57: 0x47e92, 63: 0x4807f }),
    // 45f75 Enlarge: 18/00 … 18/100 by level as PoR to 6, then 19–22; past 11 the reset 18/00 (DS:4CCD/4CCE)
    12: { k: 'enlarge', levels: [[18, 0], [18, 0], [18, 1], [18, 51], [18, 76], [18, 91], [18, 100], [19, 0], [20, 0], [21, 0], [22, 0], [22, 0]], beyond: [18, 0], effect: 0x0c, msg: 0x45f5b, unaffected: 0x45f67 },
    13: { ...POR_SPELLS.handlers[13], silent: 1, msg: 0x46099 }, // 460aa: no "is Cured"; STR worked out again (0x4C389)
    14: { k: 'applyTo', to: 'first', power: { n: 2, d: 4 }, flag: 1, stat: 5, msg: 0x4613e }, // 4614a: no CHA write, no cap
    15: { k: 'damage', amount: { n: '(L+1)/2', d: 4, plus: 'n' }, dmgType: 8, recordDice: 1 }, // 46191: (L+1) div 2 missiles
    32: { k: 'images', amount: { n: 1, d: 4 }, levelShift: 4, msg: 0x466aa }, // 466b8: Apply, power (1d4 << 4) | L
    // 46bcb Strength: a class counts with a level or a former level past +0xE6; only its die is rolled;
    // fighters, paladins and rangers into 18/xx; power = bonus + 100, no line (0x26, stat routine 0x4C389)
    35: { k: 'strengthByClass', bonus: [{ cls: [5], d: 4 }, { cls: [0, 6], d: 6 }, { cls: [2], d: 8 }], pctClasses: [2, 3, 4], effect: 0x26, counts: 'levelOrFormer', rollCounting: 1, bonusPower: 100 },
    34: { ...POR_SPELLS.handlers[34], dedupe: 1, msg: 0x46743 }, // 4675b: 0x1E-byte zone (DS:7575, cells DS:27D9), each occupant once
    // 47154: PoR's part, then the zones round the aimed square against their owner's magic-user level;
    // Cloudkill's matched through DS:27D9 read on for 9 entries (quirk kept)
    ...each([41, 46], { ...POR_SPELLS.handlers[41], msg: 0x47148, zones: [{ cell: 0x1e, owner: 0x28, dirs: 'gasCloud', count: 4 }, { cell: 0x1c, owner: 0x5b, dirs: 'gasCloud', count: 9 }] }),
    43: { k: 'removeCurse', effect: 0x24, item: 'unready', itemMsg: 0x4755f }, // 47575
    48: { ...POR_SPELLS.handlers[48], attacksAfter: 0, msg: 0x478c2 }, // 478cc → 477eb: no event-18 pass
    55: { ...POR_SPELLS.handlers[55], attacksAfter: 0, msg: 0x47c94 }, // 47c9e → 477eb
    51: { ...POR_SPELLS.handlers[51] }, // 47c49: the bolt routines' differences are R.bolt
    // 0x4BE7C keeps the dice count (DS:6FB2) for 4 (45d68), 20 (46222), 65 (480ba) as PoR's do, and 66, 72, 74, 87
    58: { k: 'heal', amount: { n: 2, d: 8, plus: 1 } }, // 47edd Cure Serious Wounds
    59: { k: 'setStrength', str: 21, pct: 0, effect: 0x92, msg: 0x47f1b }, // 47f27, by the base-STR rule (strength)
    66: { k: 'damage', amount: { n: 2, d: 8, plus: 1 }, dmgType: 8, recordDice: 1 }, // 480f5 Cause Serious Wounds
    // 494c0 Cone of Cold: the template, width 2, max(1, L div 2) squares; Apply's L d4 + L, type 0x0A, half
    92: { k: 'beam', width: 2, len: 'L/2', minLen: 1, amount: { n: 'L', d: 4, plus: 'L' }, dmgType: 0x0a, recordDice: 1 },
    // 49562 Feeblemind: the spell save moved by class (cleric −1, magic-user +4, others +2) while Apply runs
    93: { k: 'apply', saveShift: { save: 4, byClass: { 0: -1, 5: 4 }, other: 2 }, runAfter: 'first' },
    // 49697 (class 3): the template, width 1, 3 squares; 6d6 each, only monster type 0x12 (others negate)
    98: { k: 'beam', width: 1, len: 3, amount: { n: 6, d: 6 }, perTarget: 1, recordDice: 1, onlyType: 0x12 },
    // 488a1 Dimension Door; aimEmpty: the Aim menu's flag (spell ≠ 0x53) is 0, so the cursor takes no occupied square (0x2DB7D)
    83: { k: 'teleport', heldBy: 0x3a, releases: [0x90, 0x8b], msg: 0x48897, aimEmpty: 1 },
    84: { k: 'scare', width: 3, len: 6, saveType: 4, effect: 0x8e, msg: 0x48a35, unaffected: 0x48a44 }, // 48a52 Fear
    // 48bb2 Fire Shield: "flame type: " Hot (0x32 + 0x8F) or Cold (0x36 + 0x8F), the computer Hot on 1d10 > 5
    85: { k: 'flameShield', prompt: 0x48b79, abort: 0x48b9d, aiPick: { d: 10, above: 5 },
      options: [{ name: 'Hot', effects: [[0x32, 0x48b8f], [0x8f, 0]] }, { name: 'Cold', effects: [[0x36, 0], [0x8f, 0]] }] },
    // 48d66 Fumble: clumsy (0x1B) or, saved, slowed (0x2A), run at once; then Apply (flag 1)
    86: { k: 'saveOrElse', dmgType: 0x40, saveType: 4, fail: { effect: 0x1b, msg: 0x48d52 }, pass: { effect: 0x2a, msg: 0x48d5c }, flag: 1, msg: 0x48d52 },
    78: { k: 'saveEach', effect: 0x88, saveType: 4, msg: 0x4861e, outdoorsOnly: 1 }, // 4862b Entangle
    // 486e7 Faerie Fire, 4874c Charm Monsters: the Hold loop 0x45A94 (bonus 0) over the targets bought
    // from a pool (0x2C7EA): L by size (1 → 1, 2–3 → 2, 4 → 4, else 0), 2d4 by hit dice (0–1 → 1, 2 → 2, 3 → 4, else 8)
    79: { k: 'hold', bonus: [0, 0, 0], sizeImmune: 1, lastSaves: 1, msg: 0x486d8, pool: { size: 'L', by: 'sizeFlags', costs: [0, 1, 2, 2, 4], other: 0 } },
    81: { k: 'hold', bonus: [0, 0, 0], sizeImmune: 1, lastSaves: 1, runAfter: 'each', msg: 0x48741, pool: { size: { roll: [2, 4] }, by: 'hitDice', costs: [1, 1, 2, 4], other: 8 } },
    82: { k: 'saveEach', effect: 0x23, saveType: 4, msg: 0x487d1, upTo: { n: 2, d: 8 } }, // 487dd Confusion
    67: { k: 'curePoison', effect: 0x37, removes: [0x37, 0x16, 0x0f], msg: 0x4812e, unaffected: 0x4813c }, // 4814a
    // 48240 Poison: Apply (effect 0: only the save), then the 0x40 probe on the caster's combat target
    68: { k: 'applyProbe', probe: 0x40 },
    70: { k: 'apply', immuneHd: 6, immuneMsg: 0x482b8, runAfter: 'first' }, // 482ca Sticks to Snakes (3, 2L)
    73: { k: 'apply', casterEffect: 4, msg: 0x483dd }, // 483e9 Dispel Evil: 4 on the caster, then 0x91
    75: { k: 'raise', statuses: [6, 1], races: [2], removes: [0x20, 0x37], msg: 0x48480 }, // 4848a Raise Dead
    76: { k: 'slay', probe: 0x43, probeType: 0x40, saveType: 4, msg: 0x48556, amount: { n: 2, d: 8, plus: 1 }, dmgType: 8, unaffected: 0x4855f }, // 4856d
    69: { k: 'apply', msg: 0x45dd7 }, // 45de4
    71: { k: 'heal', amount: { n: 3, d: 8, plus: 3 } }, // 48360 Cure Critical Wounds
    72: { k: 'damage', amount: { n: 3, d: 8, plus: 3 }, dmgType: 8, recordDice: 1 }, // 483a1 Cause Critical Wounds (touch, negates)
    74: { k: 'damage', amount: { n: 6, d: 8 }, dmgType: 9, recordDice: 1 }, // 4844a Flame Strike (half)
    77: { k: 'apply', msg: 0x45d9e }, // 45daa
    80: { k: 'apply', msg: 0x48707 }, // 48714 Invisibility to Animals (touch)
    87: { k: 'damage', amount: { n: 3, d: 10 }, dmgType: 0x0a, recordDice: 1 }, // 48e7b Ice Storm
    88: { k: 'apply', msg: 0x48eb1 }, // 48ebe Minor Globe
    // 48f05 Cloudkill (DS:7579, DS:27DD): a gassed square takes the cell from the first Stinking Cloud that
    // found one there, a Cloudkill square from the first other Cloudkill, neither 0x1E nor 0x1C
    91: { k: 'cloud', dirs: 'killCloud', count: 9, cell: 0x1c, owner: 0x5b, firstZone: 1, msg: 0x48eeb,
      replaced: [{ cell: 0x1e, zones: 0x1e, not: [0x1e, 0x1c] }, { cell: 0x1c, zones: 0x1c, not: [0x1e, 0x1c] }] },
    89: { k: 'removeCurse', effect: 0x24, item: 'unready', itemMsg: 0x4755f }, // 47575 Remove Curse
    90: { ...POR_SPELLS.handlers[36], msg: 0x46d7d }, // 46d89 Animate Dead
    94: { k: 'hold', bonus: [-3, -1, 0], effect: 0x34, sizeImmune: 0, msg: 0x463ac }, // 463b4 → 45a94 (I: the magic-user bonus)
    ...each([95, 96, 97], { k: 'apply' }), // 4960e, 4963c, 4966a
    99: { k: 'heal', amount: { n: 2, d: 4, plus: 2 }, msg: 0x49757 }, // 49761
    100: { k: 'apply' }, // 4768b Bestow Curse: does nothing (effect 0, not touch)
  },
}

// ---------------------------------------------------------------- Secret of the Silver Blades
/** SotSB's "is " (DS:1B4D), the first piece of most of its lines (spec/A-games/sotsb/spells.md §1) */
const IS = 0xf96d
/** "is " and a word (DS pieces, image addresses: DS = image 0xDE20) */
const is = (word: number): number[] => [IS, word]
const AFFECTED = is(0xfb6d), PROTECTED = is(0xfd6d), UNAFFECTED = is(0xfc6d), CHARMED = is(0x101e9), HEALED = is(0xfa6d)
const HELD = is(0x107ff), INVISIBLE = is(0x4a09a)
const lines = (ids: number[], t: Record<string, unknown>) => Object.fromEntries(ids.map((id) => [id, t]))

/** SotSB's lines for the handlers that are CotAB's (each read at the handler of DS:8A8E + 4·id, spells.md §3) */
const SOTSB_TEXT: Record<number, Record<string, unknown>> = {
  1: { msg: is(0x1006d) }, 2: { msg: is(0x10093) }, 5: { msg: AFFECTED }, 8: { msg: is(0x101c3) },
  ...lines([6, 7, 16, 17, 52, 53, 54, 69, 88, 95], { msg: PROTECTED }),
  ...lines([11, 18, 22, 29, 41, 46, 73, 77], { msg: AFFECTED }),
  13: { msg: 0x49ae5 }, 14: { msg: is(0x1025b) }, 19: { msg: is(0x102cd) }, 21: { msg: [0x49cc1, 0x10825] },
  ...lines([23, 49, 94], { msg: HELD }), 24: { msg: is(0x1033f) }, 25: { msg: is(0x10365) },
  30: { msg: INVISIBLE }, 50: { msg: INVISIBLE }, 31: { msg: 0x4a0dd }, 32: { msg: is(0x1046f) }, 33: { msg: is(0x10495) },
  37: { msg: 0x4a9bd }, 38: { msg: is(0x1052d) }, 40: { msg: is(0x10553) }, 42: { msg: is(0x1078d) },
  43: { itemMsg: 0x4af55 }, 89: { itemMsg: 0x4af55 }, 44: { msg: 0x4b070 }, 45: { msg: is(0x105c5) },
  48: { msg: is(0x10611) }, 57: { msg: is(0x10611) }, 55: { msg: is(0x10683) }, 61: { msg: is(0x4b907) }, 62: { msg: HEALED },
  67: { msg: is(0x4bac9), unaffected: is(0x4bad4) }, 79: { msg: is(0x10ad1) }, 80: { msg: is(0x103fd) },
  81: { msg: CHARMED }, 82: { msg: is(0x10579) }, 99: { msg: HEALED },
}

export const SOTSB_SPELLS: SpellRules = {
  // 0x48797: CotAB's cases but 0x3F and 0x43, and Slow Poison's (26) 3780
  durations: { 40: DURATIONS[40], 57: DURATIONS[57], 61: DURATIONS[61], 59: DURATIONS[59], 26: { n: 0, d: 0, add: 3780 } },
  strength: 'overBase',
  /**
   * DS:8A8E + 4·id, ids 0–117 (spec/A-games/sotsb/spells.md §3): CotAB's handlers with SotSB's own lines,
   * then the changed and new ones, with SotSB's cells and effect types (gas 0x1D, kill 0x1B; Fear 0x6F,
   * Fire Shield 0x70, the STR set 0x71)
   */
  handlers: {
    ...Object.fromEntries(Object.entries(COAB_SPELLS.handlers).map(([id, h]) => [id, { ...h, ...SOTSB_TEXT[Number(id)] }])),
    // 498d1 Charm Person: a race of 7 (monster) or above unless the immunity flag 2; Apply, 11 at once
    10: { ...COAB_SPELLS.handlers[10], refuse: { race: 7, unlessFlag: 2 }, msg: CHARMED, unaffected: UNAFFECTED },
    96: { ...COAB_SPELLS.handlers[10], refuse: { race: 7, unlessFlag: 2 }, msg: CHARMED, unaffected: [IS, 0x4cefa, 0x101e9] }, // 4ceff
    // 499af Enlarge: by caster level, 23 for level 0 and past 11; through the add-effect routine
    12: { k: 'enlarge', levels: [[23, 0], [18, 0], [18, 1], [18, 51], [18, 76], [18, 91], [18, 100], [19, 0], [20, 0], [21, 0], [22, 0], [22, 0]], beyond: [23, 0], effect: 0x0c, viaAdd: 1, msg: is(0x1020f), unaffected: UNAFFECTED },
    26: { k: 'slowPoison', direct: 1, msg: AFFECTED }, // 49ed9
    27: { k: 'charmByHp', classFlag: 0x10, effect: 0x33, msg: CHARMED }, // 49f73: the snake class flag, not already charmed
    34: { ...COAB_SPELLS.handlers[34], cell: 0x1d, replaced: [{ cell: 0x1d, zones: 0x1d, not: [0x1d] }], msg: 0x4a1ad }, // 4a1c5
    35: { ...COAB_SPELLS.handlers[35], pctClasses: [2, 4] }, // 4a62c: fighters and rangers into 18/xx
    // 4a84e Heal (36; 90, named Barkskin, shares it)
    ...each([36, 90], { k: 'healAll', diseases: [31, 34, 43, 44], blind: 0x21, feeble: 0x44, die: 4, curedMsg: is(0x4a826), blindMsg: is(0x4a82c), feebleMsg: 0x4a83c, msg: HEALED }),
    ...each([41, 46], { ...COAB_SPELLS.handlers[41], msg: AFFECTED, zones: [{ cell: 0x1d, owner: 0x28, dirs: 'gasCloud', count: 4 }, { cell: 0x1b, owner: 0x5b, dirs: 'gasCloud', count: 9 }] }), // 4ab37
    56: { k: 'harm', effect: 0x22, dmgType: 8, die: 4, msg: is(0x10553) }, // 4b702
    59: { k: 'setStrength', str: 21, pct: 0, effect: 0x71, msg: [0xfe6d, 0x1110d] }, // 4b82f "gains Giant Strength"
    63: { k: 'younger', die: 4, floor: 18, floorMsg: 0x4b9a4, msg: 0x4b9b8 }, // 4b9c8
    70: { ...COAB_SPELLS.handlers[70], immuneMsg: 0x4bc6c, castMsg: 0x4bc52 }, // 4bc7e
    75: { k: 'raise', statuses: [6, 1], races: [1], removes: [0x37], msg: is(0x4be62) }, // 4be69: not an elf (race 1)
    76: { ...COAB_SPELLS.handlers[76], probe: 0xff, immuneFlag: 8, msg: is(0x4bf1c), unaffected: UNAFFECTED }, // 4bf22
    78: { k: 'none' }, // 4bffb: empty
    83: { k: 'teleport', heldBy: 0, releases: [], msg: 0x4c1c0, aimEmpty: 1 }, // 4c1ca: the caster to the aimed square, "teleports" (no holds released); no occupied square (0x3434B)
    // 4cd49 Feeblemind: the spell save (+0xEC) moved by the class byte, hit dice and race; a class not listed
    // is not affected; then the effect's record runs at once, else "is unaffected" (0x4CD3E); the save put back
    93: { k: 'apply', save: 4, saveRules: [{ classes: [0, 8, 12], add: -1 }, { classes: [4], hd: [[8, 8, 1], [9, 127, 2]] },
      { classes: [3], hd: [[9, 127, 4]] }, { classes: [5, 13, 15, 16], race: [6, 4, 2] }, { classes: [9, 10, 11], add: 2 }], unaffected: [IS, 0x4cd3e] },
    84: { ...COAB_SPELLS.handlers[84], effect: 0x6f, msg: 0x4c253, unaffected: UNAFFECTED }, // 4c263
    85: { k: 'flameShield', prompt: 0x4c393, abort: 0x4c3b4, aiPick: { d: 10, above: 5 }, // 4c3c9
      options: [{ name: 'Hot', effects: [[0x32, is(0x4c3a9)], [0x70, 0]] }, { name: 'Cold', effects: [[0x36, 0], [0x70, 0]] }] },
    86: { ...COAB_SPELLS.handlers[86], fail: { effect: 0x1b, msg: is(0x10449) }, pass: { effect: 0x2a, msg: is(0x10683) }, msg: is(0x4c575) }, // 4c57c
    91: { ...COAB_SPELLS.handlers[91], cell: 0x1b, msg: 0x4c71f, replaced: [{ cell: 0x1d, zones: 0x1d, not: [0x1d, 0x1b] }, { cell: 0x1b, zones: 0x1b, not: [0x1d, 0x1b] }] }, // 4c739
    98: { k: 'heal', amount: { n: 1, d: 8 } }, // 4d015 Cure Light Wounds (druid)
    ...each([101, 102, 103, 104, 105, 106, 107, 108, 109], { k: 'none' }), // 4970d: empty
    // 4d0e5 Death Spell: 4d20 of hit dice, costs by HD, immunity flag 8
    110: { k: 'slayByPool', probeType: 0x40, pool: { n: 4, d: 20 }, costs: [1, 2, 8, 8, 16, 16], hd6: [0x33, 16, 20], other: 0xa2, immuneFlag: 8, msg: 0x4d0da },
    111: { k: 'saveOrStatus', probeType: 0x40, probe: 0xff, saveType: 4, status: 6, msg: 0x4d203 }, // 4d211 Disintegrate
    112: { k: 'apply', msg: PROTECTED }, // 4d27c Globe of Invulnerability
    113: { k: 'stoneToFlesh', msg: is(0x4d2b5), notMsg: is(0x4d2c8) }, // 4d2d5
    114: { k: 'saveOrStatus', probeType: 0x40, probe: 0xff, saveType: 4, status: 7, msg: is(0x4d4c8) }, // 4d4d8 Flesh to Stone
    // 4d590 Delayed Blast Fireball (?: when its zone goes off is not read; the port's choice: Fireball's blast at once)
    // 4d590: the delay asked (CS:5D4F, up to 50 segments); none: Apply at once (0x48846, L d6 + L, type 9);
    // else the zone (list DS:8D8D) and effect 100, which goes off as 0x301E1
    115: { ...COAB_SPELLS.handlers[47], k: 'delayedBlast', amount: { n: 'L', d: 6, plus: 'L' }, prompt: 0x4d54f, most: 50,
      cell: 0x1a, owner: 0x64, not: [0x1d, 0x1b, 0x1a], msg: 0x4d571 },
    116: { k: 'apply', msg: is(0x103fd) }, // 4d838 Mass Invisibility
    117: { k: 'stun', bands: [[1, 30, 4, 4], [31, 60, 2, 4], [61, 90, 1, 4]], msg: is(0x11003) }, // 4d8ed Power Word Stun
  },
}
