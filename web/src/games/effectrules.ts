// Each game's effect system as data (docs/multi-game.md): which effect types answer each event, in the
// original's order, and which effects reach their neighbours. PoR: the dispatcher FUN_5216_02fa
// (image 0x4245A), spec/effects.md; CotAB: 0x4AEC4 (events 0–23), spec/coab/effects.md.

export interface EffectRules {
  /** event → the effect types that respond, in the order the original calls them */
  events: Record<number, number[]>
  /** effects that also act for characters near their holder, and how far in combat (default 1) */
  area: number[]
  areaRadius: Record<number, number>
  /**
   * Handlers that differ from PoR's: effect type → a behaviour named in rules/effectkinds.ts, with its
   * parameters. Types not listed run PoR's handler (rules/effects.ts).
   */
  handlers: Record<number, HandlerSpec>
  /** effect types whose removal recomputes a stat (0 STR … 5 CHA) through the game's stat routine */
  removalStat: Record<number, number[]>
  /** what readying an item with item +0x3E ≥ 0x80 does (ItemProcedure) */
  items: ItemProcedure
  /**
   * When adding an effect (with its message, event 9 first) takes out a record of the same type already
   * there: `longerOrPermanent` (PoR FUN_5216_1656) a timed old record when the new one lasts longer, any
   * old record when the new one is permanent, else both stay; `anyTimed` (CotAB 0x4CD91) any old record
   * with a duration left, whatever the new one's, while a permanent old record stays beside the new one
   */
  replaces: 'longerOrPermanent' | 'anyTimed'
  /** effect types whose presence stops unforced healing (PoR FUN_5216_175d: mummy rot 0x32; CotAB 0x4CE85: none) */
  healBlock: number[]
}

/**
 * Readying an item with item +0x3E ≥ 0x80: `handlers`, a handler per +0x3E value 128–139 (PoR
 * FUN_4894_14d0 → FUN_5216_0000); `kinds`, the item's kind runs the stat routine and its own
 * procedure (CotAB 0x3F034, with the generic handler 147 for kind 0).
 */
export type ItemProcedure = 'handlers' | 'kinds'

/** A behaviour key (rules/effectkinds.ts) and its parameters. */
export interface HandlerSpec {
  b: string
  [param: string]: string | number | number[]
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
  handlers: {},
  removalStat: {},
  items: 'handlers',
  replaces: 'longerOrPermanent',
  healBlock: [0x32],
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
  areaRadius: { 49: 6 },  // changed and new handlers (DS:6FC0 + 4·type, filled at 0x29E28 and 0x4AA3A); spec/coab/effects.md §2
  handlers: {
    3: { b: 'snakes' }, // 0x2742C
    4: { b: 'attackerClass', flag: 1, roll: -7 }, // 0x274AF (Dispel Evil's defence)
    7: { b: 'acBoth', add: 2, cap: 0x3c }, // 0x2752F
    12: { b: 'none' }, 14: { b: 'none' }, 38: { b: 'none' }, 146: { b: 'none' }, // 0x276B7, 0x27705, 0x29E21: the stat comes from 0x4C389
    13: { b: 'suffocate' }, // 0x276C9
    18: { b: 'targetClass', flag: 2, roll: 1 }, // 0x2779A (gnomes)
    20: { b: 'resist', type: 1, save: 3 }, // 0x277D0
    25: { b: 'invisibility' }, // 0x27A16
    26: { b: 'targetClass', flag: 4, roll: 1 }, // 0x27A4B (dwarves)
    27: { b: 'endTurn' }, // 0x273C1, shared with 31, 51, 52, 53
    28: { b: 'mirrorImage' }, // 0x27A8F
    35: { b: 'confusion' }, // 0x27D29
    37: { b: 'notReady' }, // 0x27ED0
    47: { b: 'attackerKind', types: [2, 10], size: 2, roll: -4 }, // 0x284A3
    48: { b: 'attackerKind', types: [1], size: 2, roll: -4 }, // 0x284F2
    50: { b: 'weakTo', saveOn: 2, double: 1, saved: 1 }, // 0x28562: cold +2 save, unsaved fire ×2
    54: { b: 'weakTo', saveOn: 1, double: 2, saved: 0 }, // 0x28593: fire +2 save, cold ×2 (DS:5D0B, 0 in combat)
    57: { b: 'engulf' }, // 0x2E582
    60: { b: 'magicWeapons', none: 3 }, // 0x28628: plus 0 nothing, below 3 half
    63: { b: 'minorGlobe', below: 4 }, // 0x2871A
    68: { b: 'feeblemind' }, // 0x288E5
    69: { b: 'untargetableBy', type: 19, roll: -4 }, // 0x28986
    73: { b: 'immune', mask: 0x20, say: 1 }, // 0x28A22
    75: { b: 'giantBane', type: 3 }, // 0x28A6A
    76: { b: 'bane', type: 8, roll: 3, dmg: 3 }, // 0x28AC2
    77: { b: 'berserk', say: 1, restore: 0 }, // 0x28B03
    81: { b: 'halve' }, // 0x28CCF
    82: { b: 'fireColdSave' }, // 0x28CE0
    84: { b: 'absorbElectricity' }, // 0x28D31
    85: { b: 'piercingOne' }, // 0x28D64
    91: { b: 'none' }, // 0x28E09: lifts a zone of the list DS:7579, which the port does not make
    // the monster specials [14] (rules/specials.ts); `hook`/`spell`: the spell whose computer target
    // pick (*DS:72BA) chooses the target. PoR's 87 (mummy rot) and 90 (CON poison bonus) mean other things.
    83: { b: 'gazeStone', spell: 0x41, word: 0x76 }, // 0x497CE
    86: { b: 'spitAcid', range: 7, pct: 30, hook: 0x41 }, // 0x49B5E
    // 0x2E842: disintegrate, stone, death, wounding by reach, then Fear, Slow, Sleep
    87: { b: 'eyeRays', shots: 4, ranges: [2, 3, 4, 5], saves: [3, 1, 0], statuses: [8, 7, 6], frames: [5, 10, 5, 5], wound: [2, 8, 1], spells: [0x54, 0x37, 0x15] },
    88: { b: 'breathBolt', pct: 50, spell: 0x33, len: 10, save: 3, dmgType: 0x24 }, // 0x499CD
    90: { b: 'breathArea', uses: 3, dmgType: 0x30, spell: 0x3d, width: 1, len: 6, ownSide: 1, msg: 'breathes acid' }, // 0x49C94
    128: { b: 'breathArea', uses: 3, dmgType: 0x21, spell: 0x3d, width: 3, len: 9, ownSide: 0, msg: 'breathes fire' }, // 0x49E74
    132: { b: 'throwLightning', rounds: 4, spell: 0x33, count: 16, sides: 6, len: 10, save: 4 }, // 0x4A121
    96: { b: 'hug' }, // 0x2ED5C
    103: { b: 'extraDamage', lacks: [0x14, 0x36, 0x3d], sides: 6 }, // 0x293AD
    110: { b: 'immune', mask: 2, say: 0 }, // 0x29502
    122: { b: 'holdOnHit', save: 0 }, // 0x29873
    123: { b: 'hitDamage', count: 2, sides: 8, dmgType: 0x0a }, // 0x298ED
    126: { b: 'gazeHold', minutes: 60, hook: 0x41 }, // 0x4A214
    129: { b: 'magicResistance' }, // 0x29973
    130: { b: 'quarrelSlays', type: 0x1c, word: 0x87 }, // 0x29993
    131: { b: 'breatheFire', pct: 50, dmg: 7, hook: 0x41 }, // 0x4A001
    133: { b: 'blocks', types: [0x8e, 0x1d, 0x44], mask: 0x40 }, // 0x29AA0
    134: { b: 'rangerVsGiants', flag: 8 }, // 0x29ACC
    135: { b: 'immune', mask: 4, say: 0 }, // 0x29B05
    136: { b: 'noMove' }, // 0x29B1C
    137: { b: 'berserk', say: 0, restore: 1 }, // 0x29B30
    138: { b: 'startInvisible' }, // 0x29C20
    139: { b: 'heldVictim', marker: 0x8b, attacks: 2, also: 0x0d }, // 0x2EB16
    142: { b: 'runsAway' }, // 0x29C82
    143: { b: 'zap' }, // 0x29CC5
    144: { b: 'heldVictim', marker: 0x90, attacks: 1, also: 0 }, // 0x2EC4C
    145: { b: 'dispelEvil', flag: 1 }, // 0x29D69
    // 147 (0x29A23, also DS:720C), the generic item handler, runs for items only: rules/effectkinds.ts itemKind
  },
  // remove 0x4ABBA: CHA after 0x0E, STR after 0x0C, 0x26, 0x92
  removalStat: { 0x0e: [5], 0x0c: [0], 0x26: [0], 0x92: [0] },
  items: 'kinds',
  replaces: 'anyTimed', // 0x4CE0A: found, and its duration word > 0
  healBlock: [], // 0x4CE85: the 0x32 test is gone (0x32 is the Hot Fire Shield in CotAB)
}
