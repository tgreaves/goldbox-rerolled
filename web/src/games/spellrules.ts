// Spell handlers per game: each spell id names a handler kind (a procedure in rules/spellkinds.ts or the
// battle's own, named by what it does) and its parameters, as the original's handler table does
// (PoR DS:6B84 + 4·id, filled by FUN_4e53_3413; CotAB DS:72BA, filled at 0x4A4FF). Every id a game has is
// listed, so no game is the default. spec/spells.md "Per spell"; spec/coab/spells.md §2.

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
  msg?: string
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
const SLEEP = { k: 'sleep', pool: { n: 4, d: 4 }, effect: 0x35, msg: 'falls asleep', hdCost: [1, 1, 2, 4, 6], hd5: [10, 20], other: 20 }

export const POR_SPELLS: SpellRules = {
  durations: DURATIONS,
  strength: 'setCurrent',
  handlers: {
    1: { k: 'applySide', side: 'ally', notEngaged: 1, msg: 'is Blessed' }, // 100f → 0f4f
    2: { k: 'applySide', side: 'enemy', msg: 'is Cursed' }, // 1040 → 0f4f
    3: { k: 'heal', amount: { n: 1, d: 8 }, aiTarget: 'woundedNear' }, // 106b
    4: { k: 'damage', amount: { n: 1, d: 8 }, dmgType: 8 }, // 10a7
    ...each([5, 11, 18, 22, 29], { k: 'apply', msg: 'is affected' }), // 10e9
    ...each([6, 7, 16, 17, 52, 53, 54], { k: 'apply', msg: 'is protected' }), // 1123
    8: { k: 'apply', msg: 'is cold-resistant' }, // 1162
    9: { k: 'damage', amount: { n: 0, d: 0, plus: 'L' }, dmgType: 9 }, // 1190
    10: { k: 'charm', sideMul: 128, msg: 'is charmed' }, // 11dd
    12: { k: 'enlarge', levels: [[18, 0], [18, 0], [18, 1], [18, 51], [18, 76], [18, 91], [18, 100]], effect: 0x0c, msg: 'is stronger' }, // 12a5
    13: { k: 'reduce', effect: 0x0c, saveType: 4, msg: 'has been reduced' }, // 136e
    14: { k: 'friends', amount: { n: 2, d: 4 }, cap: 25, effect: 0x0e, msg: 'is friendly' }, // 13d8
    15: { k: 'damage', amount: { n: 'L/2', d: 4, plus: 'L/2' }, dmgType: 8 }, // 1439
    19: { k: 'apply', msg: 'is shielded' }, // 1499
    20: { k: 'damage', amount: { n: 1, d: 8, plus: 'L' }, dmgType: 0x0c }, // 14c7
    21: SLEEP, // 151b
    23: { k: 'hold', bonus: [-2, -1, 0], effect: 0x34, sizeImmune: 1, msg: 'is held' }, // 1658
    24: { k: 'apply', msg: 'is fire resistant' }, // 17e9
    25: { k: 'apply', msg: 'is silenced' }, // 1822
    26: { k: 'slowPoison', msg: 'is affected' }, // 185b
    27: { k: 'charmByHp', monsterType: 0x0e, effect: 0x33, msg: 'is charmed' }, // 190f
    28: { k: 'applyTo', to: 'caster', flag: 1, runNow: 1 }, // 19c3
    ...each([30, 50, 63], { k: 'apply', msg: 'is invisible' }), // 1a16, 302a
    31: { k: 'apply' }, // 1a4f: Knock does nothing here (no effect type)
    32: { k: 'images', amount: { n: 1, d: 4 }, effect: 0x1c }, // 1a8a
    33: { k: 'apply', msg: 'is weakened' }, // 1acc
    34: { k: 'cloud', dirs: 'gasCloud', count: 4, cell: 0x1e, owner: 0x28, msg: 'Creates a noxious cloud' }, // 1b11, DS:290D
    35: { k: 'strengthByClass', bonus: [{ cls: [5], d: 4 }, { cls: [0, 6], d: 6 }, { cls: [2], d: 8 }], pctClasses: [2], effect: 0x26, msg: 'is stronger' }, // 1f41
    36: { k: 'animateDead', effect: 0x20, msg: 'is animated' }, // 206f
    37: { k: 'cure', effect: 0x21, msg: 'can see' }, // 2217
    38: { k: 'apply', msg: 'is blind' }, // 225d
    39: { k: 'cureDisease' }, // 232f → 228a
    40: { k: 'apply', flag: 1, msg: 'is diseased' }, // 234c
    ...each([41, 46], { k: 'dispel', msg: 'is affected' }), // 2385
    42: { k: 'applyTo', to: 'caster', sideShift: 4, msg: 'is praying' }, // 24d6
    43: { k: 'removeCurse', effect: 0x24 }, // 2540
    44: { k: 'apply', msg: 'has been cursed!' }, // 2604
    45: { k: 'apply', msg: 'is blinking' }, // 263d
    47: { k: 'damage', amount: { n: 'L', d: 6 }, dmgType: 9, recordDice: 1, look: 1, outdoorRadius: 2, sound: 11 }, // 266b
    48: { k: 'hasteSlow', side: 'ally', opposite: 0x2a, attacksAfter: 1, msg: 'is Hasted' }, // 2892 → 2764
    49: { k: 'hold', bonus: [-3, -1, 0], effect: 0x34, sizeImmune: 1, msg: 'is held' },
    51: { k: 'bolt', amount: { n: 'L', d: 6 }, saveType: 4, sound: 8 }, // 2bb7
    55: { k: 'hasteSlow', side: 'enemy', opposite: 0x27, attacksAfter: 1, msg: 'is Slowed' }, // 2c09 → 2764
    56: { k: 'restore', msg: 'is restored' }, // 2c43
    57: { k: 'toggle', remove: 0x2a, effect: 0x27, power: 12, msg: 'is Speedy' }, // 2e02
    58: { k: 'ointment', amount: { n: 1, d: 4, plus: 8 }, msg: 'is Healed' }, // 2e4d
    59: { k: 'setStrength', str: 21, pct: 0, effect: 0x26, msg: 'is stronger' }, // 2ee5
    60: { k: 'damage', amount: { n: 1, d: 6, plus: 20 }, dmgType: 0x0c }, // 2f4d (its 3-square path not yet)
    61: { k: 'apply', rollDuration: { n: 5, d: 4 } }, // 2f99
    62: { k: 'heal', amount: { n: 2, d: 4, plus: 2 } }, // 2fd0
    64: { k: 'damage', amount: { n: { roll: [1, 3], mul: 2, add: 1 }, d: 6 }, dmgType: 9, recordDice: 1 }, // 266b
    65: { k: 'damage', amount: { n: 2, d: 4, plus: 2 }, dmgType: 8 }, // 3058
    66: { k: 'apply' }, // 3092: nothing
    67: { k: 'applyTo', to: 'first', duration: 1440, power: 0xff, flag: 1, msg: 'is Reading' }, // Manual of Bodily Health
  },
}

// ---------------------------------------------------------------- Curse of the Azure Bonds
/**
 * CotAB's table (DS:72BA): ids 1–56 are PoR's spells, most with the same handler (spec/coab/spells.md
 * §2, "same"); 57–67 keep PoR's item spells where the record matches; 58 and 66–100 are its own.
 * Every id is transcribed (spec/coab/spells.md §2 and its port status, which lists what is inferred).
 */
const POR_HANDLERS_1_57 = Object.fromEntries(Object.entries(POR_SPELLS.handlers).filter(([id]) => Number(id) <= 57 || [60, 61, 62, 63, 64, 65].includes(Number(id))))

export const COAB_SPELLS: SpellRules = {
  // 0x44E02 is PoR's; Entangle's handler asks for Duration(0x88), past the table: 6 + 3·L (a bug kept)
  durations: { ...DURATIONS, 78: { record: 0x88 } },
  strength: 'overBase',
  handlers: {
    ...POR_HANDLERS_1_57,
    // 45f75 Enlarge: 18/00 … 18/100 by level as PoR to 6, then 19–22; past 11 the reset 18/00 (DS:4CCD/4CCE)
    12: { k: 'enlarge', levels: [[18, 0], [18, 0], [18, 1], [18, 51], [18, 76], [18, 91], [18, 100], [19, 0], [20, 0], [21, 0], [22, 0], [22, 0]], beyond: [18, 0], effect: 0x0c, msg: 'is stronger', unaffected: 'is unaffected' },
    13: { ...POR_SPELLS.handlers[13], silent: 1 }, // 460aa: no "is Cured"; STR worked out again (0x4C389)
    14: { k: 'applyTo', to: 'first', power: { n: 2, d: 4 }, flag: 1, stat: 5, msg: 'is friendly' }, // 4614a: no CHA write, no cap
    15: { k: 'damage', amount: { n: '(L+1)/2', d: 4, plus: 'n' }, dmgType: 8, recordDice: 1 }, // 46191: (L+1) div 2 missiles
    32: { k: 'images', amount: { n: 1, d: 4 }, levelShift: 4, msg: 'is duplicated' }, // 466b8: Apply, power (1d4 << 4) | L
    // 46bcb Strength: a class counts with a level or a former level past +0xE6; only its die is rolled;
    // fighters, paladins and rangers into 18/xx; power = bonus + 100, no line (0x26, stat routine 0x4C389)
    35: { k: 'strengthByClass', bonus: [{ cls: [5], d: 4 }, { cls: [0, 6], d: 6 }, { cls: [2], d: 8 }], pctClasses: [2, 3, 4], effect: 0x26, counts: 'levelOrFormer', rollCounting: 1, bonusPower: 100 },
    34: { ...POR_SPELLS.handlers[34], dedupe: 1 }, // 4675b: 0x1E-byte zone (DS:7575, cells DS:27D9), each occupant once
    // 47154: PoR's part, then the zones round the aimed square against their owner's magic-user level;
    // Cloudkill's matched through DS:27D9 read on for 9 entries (quirk kept)
    ...each([41, 46], { ...POR_SPELLS.handlers[41], zones: [{ cell: 0x1e, owner: 0x28, dirs: 'gasCloud', count: 4 }, { cell: 0x1c, owner: 0x5b, dirs: 'gasCloud', count: 9 }] }),
    43: { k: 'removeCurse', effect: 0x24, item: 'unready', itemMsg: 'has an item un-cursed' }, // 47575
    48: { ...POR_SPELLS.handlers[48], attacksAfter: 0 }, // 478cc → 477eb: no event-18 pass
    55: { ...POR_SPELLS.handlers[55], attacksAfter: 0 }, // 47c9e → 477eb
    51: { ...POR_SPELLS.handlers[51] }, // 47c49: the bolt routines' differences are R.bolt
    // 0x4BE7C keeps the dice count (DS:6FB2) for 4 (45d68), 20 (46222), 65 (480ba), 66, 72, 74, 87
    ...Object.fromEntries([4, 20, 65].map((id) => [id, { ...POR_SPELLS.handlers[id], recordDice: 1 }])),
    58: { k: 'heal', amount: { n: 2, d: 8, plus: 1 } }, // 47edd Cure Serious Wounds
    59: { k: 'setStrength', str: 21, pct: 0, effect: 0x92, msg: 'is stronger' }, // 47f27, by the base-STR rule (strength)
    66: { k: 'damage', amount: { n: 2, d: 8, plus: 1 }, dmgType: 8, recordDice: 1 }, // 480f5 Cause Serious Wounds
    // 494c0 Cone of Cold: the template, width 2, max(1, L div 2) squares; Apply's L d4 + L, type 0x0A, half
    92: { k: 'beam', width: 2, len: 'L/2', minLen: 1, amount: { n: 'L', d: 4, plus: 'L' }, dmgType: 0x0a, recordDice: 1 },
    // 49562 Feeblemind: the spell save moved by class (cleric −1, magic-user +4, others +2) while Apply runs
    93: { k: 'apply', saveShift: { save: 4, byClass: { 0: -1, 5: 4 }, other: 2 }, runAfter: 'first' },
    // 49697 (class 3): the template, width 1, 3 squares; 6d6 each, only monster type 0x12 (others negate)
    98: { k: 'beam', width: 1, len: 3, amount: { n: 6, d: 6 }, perTarget: 1, recordDice: 1, onlyType: 0x12 },
    83: { k: 'teleport', heldBy: 0x3a, releases: [0x90, 0x8b], msg: 'teleports' }, // 488a1 Dimension Door
    84: { k: 'scare', width: 3, len: 6, saveType: 4, effect: 0x8e, msg: 'runs in terror', unaffected: 'is unaffected' }, // 48a52 Fear
    // 48bb2 Fire Shield: "flame type: " Hot (0x32 + 0x8F) or Cold (0x36 + 0x8F), the computer Hot on 1d10 > 5
    85: { k: 'flameShield', prompt: 'flame type: ', abort: 'Abort spell?', aiPick: { d: 10, above: 5 },
      options: [{ name: 'Hot', effects: [[0x32, 'is protected'], [0x8f, '']] }, { name: 'Cold', effects: [[0x36, ''], [0x8f, '']] }] },
    // 48d66 Fumble: clumsy (0x1B) or, saved, slowed (0x2A), run at once; then Apply (flag 1)
    86: { k: 'saveOrElse', dmgType: 0x40, saveType: 4, fail: { effect: 0x1b, msg: 'is clumsy' }, pass: { effect: 0x2a, msg: 'is slowed' }, flag: 1, msg: 'is clumsy' },
    78: { k: 'saveEach', effect: 0x88, saveType: 4, msg: 'is entangled', outdoorsOnly: 1 }, // 4862b Entangle
    // 486e7 Faerie Fire, 4874c Charm Monsters: the Hold loop 0x45A94 (bonus 0) over the targets bought
    // from a pool (0x2C7EA): L by size (1 → 1, 2–3 → 2, 4 → 4, else 0), 2d4 by hit dice (0–1 → 1, 2 → 2, 3 → 4, else 8)
    79: { k: 'hold', bonus: [0, 0, 0], sizeImmune: 1, lastSaves: 1, msg: 'is highlighted', pool: { size: 'L', by: 'sizeFlags', costs: [0, 1, 2, 2, 4], other: 0 } },
    81: { k: 'hold', bonus: [0, 0, 0], sizeImmune: 1, lastSaves: 1, runAfter: 'each', msg: 'is charmed', pool: { size: { roll: [2, 4] }, by: 'hitDice', costs: [1, 1, 2, 4], other: 8 } },
    82: { k: 'saveEach', effect: 0x23, saveType: 4, msg: 'is confused', upTo: { n: 2, d: 8 } }, // 487dd Confusion
    67: { k: 'curePoison', effect: 0x37, removes: [0x37, 0x16, 0x0f], msg: 'is unpoisoned', unaffected: 'is unaffected' }, // 4814a
    // 48240 Poison: Apply (effect 0: only the save), then the 0x40 probe on the caster's combat target
    68: { k: 'applyProbe', probe: 0x40 },
    70: { k: 'apply', immuneHd: 6, immuneMsg: 'smashes them flat', runAfter: 'first' }, // 482ca Sticks to Snakes (3, 2L)
    73: { k: 'apply', casterEffect: 4, msg: 'is affected' }, // 483e9 Dispel Evil: 4 on the caster, then 0x91
    75: { k: 'raise', statuses: [6, 1], races: [2], removes: [0x20, 0x37], msg: 'is raised' }, // 4848a Raise Dead
    76: { k: 'slay', probe: 0x43, probeType: 0x40, saveType: 4, msg: 'is slain', amount: { n: 2, d: 8, plus: 1 }, dmgType: 8, unaffected: 'is unaffected' }, // 4856d
    69: { k: 'apply', msg: 'is protected' }, // 45de4
    71: { k: 'heal', amount: { n: 3, d: 8, plus: 3 } }, // 48360 Cure Critical Wounds
    72: { k: 'damage', amount: { n: 3, d: 8, plus: 3 }, dmgType: 8, recordDice: 1 }, // 483a1 Cause Critical Wounds (touch, negates)
    74: { k: 'damage', amount: { n: 6, d: 8 }, dmgType: 9, recordDice: 1 }, // 4844a Flame Strike (half)
    77: { k: 'apply', msg: 'is affected' }, // 45daa
    80: { k: 'apply', msg: 'is invisible' }, // 48714 Invisibility to Animals (touch)
    87: { k: 'damage', amount: { n: 3, d: 10 }, dmgType: 0x0a, recordDice: 1 }, // 48e7b Ice Storm
    88: { k: 'apply', msg: 'is protected' }, // 48ebe Minor Globe
    91: { k: 'cloud', dirs: 'killCloud', count: 9, cell: 0x1c, owner: 0x5b, msg: 'Creates a poisonous cloud' }, // 48f05 Cloudkill (DS:7579, DS:27DD)
    89: { k: 'removeCurse', effect: 0x24, item: 'unready', itemMsg: 'has an item un-cursed' }, // 47575 Remove Curse
    90: POR_SPELLS.handlers[36], // 46d89 Animate Dead
    94: { k: 'hold', bonus: [-3, -1, 0], effect: 0x34, sizeImmune: 0, msg: 'is held' }, // 463b4 → 45a94 (I: the magic-user bonus)
    ...each([95, 96, 97], { k: 'apply' }), // 4960e, 4963c, 4966a
    99: { k: 'heal', amount: { n: 2, d: 4, plus: 2 }, msg: 'is Healed' }, // 49761
    100: { k: 'apply' }, // 4768b Bestow Curse: does nothing (effect 0, not touch)
  },
}
