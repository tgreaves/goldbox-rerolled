// Each game's effect system as data (docs/multi-game.md): which effect types answer each event, in the
// original's order, and which effects reach their neighbours. PoR: the dispatcher FUN_5216_02fa
// (image 0x4245A), spec/effects.md; CotAB: 0x4AEC4 (events 0–23), spec/coab/effects.md.

export interface EffectRules {
  /** event → the effect types that respond, in the order the original calls them */
  events: Record<number, number[]>
  /** effects that also act for characters near their holder, and how far in combat (default 1) */
  area: number[]
  areaRadius: Record<number, number>
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
}
