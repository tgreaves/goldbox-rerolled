---
created: 2026-10-22
tags: [reverse-engineering, gold-box, sotsb, spec]
---

# SotSB effects: diff against CotAB `coab/effects.md`

> **Status: first pass.** Normative where marked O. Part A of the [specification](../../README.md):
> Secret of the Silver Blades, GOG 1.0 (the working image of [README.md](README.md#working-image)). Read
> [engine/effects.md](../engine/effects.md), then [coab/effects.md](../coab/effects.md): this file lists what
> differs from CotAB's effect system. Evidence marks as in the [README](../../README.md#evidence-marks). The
> spell handlers that add these effects are in [spells.md](spells.md).

Read from the SotSB image (2026-10-22). Addresses are SotSB image offsets (DS = image 0xDE20).

## 1. Dispatch (O)

- **Handlers**: far pointers at **DS:87E6 + 4·type** for types 1–120 (CotAB DS:6FC0, 1–147), thunks in
  segment 0xA4, filled from 0x30A9C; types 83 and 104 are filled from the spell segment (0x113) with the
  same handler 0x4D9AE, as CotAB's eight slots at 0x4AA3A; types 114–119 are not filled. The empty handler is
  0x30A2F (CotAB 0x29E21).
- **Run one handler** 0x50CE3(type, char, record, arg): with DS:8DB8 set (CotAB DS:759C), the item path
  through **DS:89C6** (type 120, CotAB's 147 at DS:720C); else `*DS:87E6(4·type)`.
- **Fire an event** 0x50D26(char, event): each event's types in a fixed order (§2); CotAB 0x4AEC4.
- **Remove** 0x50966 (CotAB 0x4ABBA): the callback when eff[4] ≠ 0, then unlink; after the removal of
  **0x0E** CHA is worked out again, after **0x0C, 0x26, 0x71** STR (CotAB 0x0C, 0x26, 0x92) (0x50A69–0x50A98).
- **Add-effect** 0x52988, **remove the first of a type** with "is Cured" 0x51D17, **find** 0x55428, **save**
  0x519F7, **damage** 0x52644 and **heal** 0x52A7F are CotAB's routines ([spells.md §1](spells.md#1-dispatch-and-shared-helpers-o)).
- **The set-status routine** 0x508C0 (CotAB 0x4AAC4); **taking a combatant off the field** 0x51BA5 (CotAB
  0x4BF57), ending with going down.
- **Going down** 0x51CA9 (CotAB 0x4C05B): for i = 1..14 the remove routine with a null record (the first of
  the type) for **DS:0A99[i] = 3, 11, 21, 23, 27, 30, 31, 51, 52, 53, 91, 106, 107, 111** (CotAB 19 types); then,
  as CotAB, one holding 0x4D (77, berserk) whose morale (+0xFF) is 0xB3 goes back to side 0 (+0x1A8 := 0).
- **The morale check's removal** 0x51D0B (CotAB 0x4C0BD) is an **empty** routine: the morale check
  (0x2A869) calls it and nothing is removed; a creature that turns to flee loses nothing either (CotAB
  0x4A, 0x4B) (O).
- **Invisibility ends** 0x51C71: removes **every** record of 25, one at a time until none is left (CotAB
  removes the type's records as PoR).
- **Helpless** 0x539D5 (CotAB 0x4DC2B): any of DS:1B39[1..4] = **0x1F, 0x33, 0x34, 0x35**, CotAB's set.

## 2. Event lists (O, 0x50D26)

The lists are sorted by type (CotAB's are in no order); events 13 and 16 have no case (CotAB 13: 99, 100, 75;
16: 25, 71, 37, 47, 48, 89, 4), event 23 neither (CotAB 74, never fired). Event 6 calls 0x50AA1 first (I: the
damage-type set-up).

| event | SotSB types | CotAB types |
|---|---|---|
| 1 | 25, 37, 69 | 37, 25, 71, 69 |
| 2 | 65, 86, 88 | 79, 80, 145, 57, 96, 122, 123 |
| 3 | 64, 65, 86, 88 | 64, 65, 66, 67, 70, 79, 87 |
| 4 | 29, 66, 75, 105, 32 | 29, 6, 103, 75, 76, 134 |
| 5 | 28, 41, 60, 90, 103, 112 | 28, 41, 104, 120, 101, 115, 116, 119, 94, 117, 60, 81, 82, 85, 130, 143 |
| 6 | 6, 10, 17, 20, 28, 61, 63, 57, 73, 79, 93, 98 | 113, 61, 10, 20, 105, 106, 112, 114, 118, 17, 93, 101, 28, 110, 73, 82, 84, 129, 133, 135, 63 |
| 7 | 3, 27, 31, 51, 52, 53 | 51, 52, 53, 31, 3, 27, 136 |
| 8 | 56, 82, 89, 108 | 99, 82, 89, 72, 56 |
| 9 | 18, 28, 63, 76, 79, 92, 95, 96, 99 | 105, 106, 107, 108, 109, 110, 111, 112, 124, 125, 63, 129 |
| 10 | 1, 2, 7, 26, 33, 36, 49, 75 | 1, 2, 33, 36, 49, 6, 18, 26, 75, 76 |
| 11 | 4, 8, 9, 13, 17, 30, 33, 45, 46, 47, 48, 71, 74 | 33, 17, 8, 9, 45, 46, 30, 7 |
| 12 | 8, 9, 10, 13, 17, 20, 33, 36, 45, 46, 49, 50, 54, 61, 78, 94 | 8, 9, 10, 17, 20, 33, 36, 45, 46, 49, 61, 111, 125, 97, 50, 54 |
| 14 | 58, 67, 70, 80, 81, 83, 104, 107 | 83, 88, 121, 86, 87, 90, 126, 128, 131, 132, 139 |
| 15 | 3, 5, 11, 21, 27, 30, 77, 106, 25, 37, 47, 48, 69, 89 | 21, 30, 11, 13, 77 |
| 17 | 1, 2, 11 | 1, 2, 11 |
| 18 | 39, 42 | 39, 42, 58 |
| 19 | 11, 23, 56, 100 | 98, 23, 72, 56, 11 |
| 20 | 50, 54 | 50, 54 |
| 21 | 35 | 35 |
| 22 | 39, 42, 74 | 138 |

Event 15 takes CotAB's 16's turn-start types too (25, 37, 47, 48, 69, 89; I: the two lists merged).

## 3. Handlers by type

The type numbers are partly CotAB's and partly renumbered: the spells add 0x6F where CotAB's add 0x8E
(Fear), 0x70 for 0x8F (spell 85), 0x71 for 0x92 (STR set), and the going-down list names 106, 107, 111 where
CotAB names 136, 137, 142. Each row gives the CotAB type whose handler the SotSB handler matches, by the
routines it calls (mapped between the games), its constants and the events it answers (O: the same calls and
constants; I: a close match, the score after it; ?: the best of weak matches, or a tie between handlers of the
same shape); "same number" where SotSB keeps CotAB's number. A match names CotAB's procedure; its parameters
(the damage type of a resist, a monster class, a text) are to be read per type.

| type | handler | events | CotAB's handler |
|---|---|---|---|
| 1 | 0x2D3D9 | 10, 17 | 1 (?, 0.70) — same number |
| 2 | 0x2D3F1 | 10, 17 | 2 (I, 0.90) — same number |
| 3 | 0x2D42F | 7, 15 | 3 (O) — same number |
| 4 | 0x2D4C4 | 11 | 7 (?, 0.70) |
| 5 | 0x30A2F | 15 | empty |
| 6 | 0x2D4E7 | 6 | 135 (I, 0.90) |
| 7 | 0x2D506 | 10 | 18 (?, 0.70) |
| 8 | 0x2D543 | 11, 12 | 8 (I, 0.96) — same number |
| 9 | 0x2D580 | 11, 12 | 9 (I, 0.96) — same number |
| 10 | 0x2D5BD | 6, 12 | 20 (O) |
| 11 | 0x2D5E8 | 15, 17, 19 | 11 (I, 0.90) — same number |
| 12 | 0x2D6D3 | — | ambiguous: the shape of CotAB 12, 14, 16, 38 (?) |
| 13 | 0x2D6DC | 11, 12 | 9 (I, 0.85) |
| 14 | 0x2D6FC | — | ambiguous: the shape of CotAB 12, 14, 16, 38 (?) |
| 15 | 0x2D705 | — | 15 (I, 0.90) — same number |
| 16 | 0x2D78C | — | ambiguous: the shape of CotAB 12, 14, 16, 38 (?) |
| 17 | 0x2D795 | 6, 11, 12 | 17 (I, 0.94) — same number |
| 18 | 0x2D7CE | 9 | 124 (I, 0.97) |
| 19 | 0x30A2F | — | empty |
| 20 | 0x2D7FA | 6, 12 | 20 (O) — same number |
| 21 | 0x2D825 | 15 | 21 (I, 0.90) — same number |
| 22 | 0x2D8AA | — | 22 (?, 0.82) — same number |
| 23 | 0x2D93A | 19 | 23 (?, 0.76) — same number |
| 24 | 0x30A2F | — | empty |
| 25 | 0x2DB33 | 1, 15 | 25 (O) — same number |
| 26 | 0x2DB68 | 10 | 18 (?, 0.70) |
| 27 | 0x2D3A4 | 7, 15 | 27 (O) — same number |
| 28 | 0x2DBB3 | 5, 6, 9 | 28 (?, 0.81) — same number |
| 29 | 0x2DC8D | 4 | 29 (I, 0.90) — same number |
| 30 | 0x2DCBF | 11, 15 | 30 (I, 0.97) — same number |
| 31 | 0x2D3A4 | 7 | 27 (O) |
| 32 | 0x2DDBB | 4 | 145 (?, 0.50) |
| 33 | 0x2DE81 | 10, 11, 12 | 9 (?, 0.72) |
| 34 | 0x2DEB2 | — | 34 (I, 0.94) — same number |
| 35 | 0x2DF1D | 21 | 35 (I, 0.97) — same number |
| 36 | 0x2E0E9 | 10, 12 | ambiguous: the shape of CotAB 20, 50, 54 (?) |
| 37 | 0x2E102 | 1, 15 | 37 (?, 0.63) — same number |
| 38 | 0x2D6D3 | — | ambiguous: the shape of CotAB 12, 14, 16, 38 (?) |
| 39 | 0x2E132 | 18, 22 | 39 (?, 0.74) — same number |
| 40 | 0x2E1C6 | — | 40 (?, 0.71) — same number |
| 41 | 0x2E515 | 5 | 41 (I, 0.94) — same number |
| 42 | 0x2E559 | 18, 22 | 58 (O) |
| 43 | 0x2E58F | — | 43 (I, 0.90) — same number |
| 44 | 0x2E624 | — | 44 (I, 0.91) — same number |
| 45 | 0x2D543 | 11, 12 | 8 (I, 0.96) |
| 46 | 0x2D580 | 11, 12 | 9 (I, 0.96) |
| 47 | 0x2E6CE | 11, 15 | ambiguous: the shape of CotAB 20, 37, 50, 54 (?) |
| 48 | 0x2E6F3 | 11, 15 | ambiguous: the shape of CotAB 20, 37, 50, 54 (?) |
| 49 | 0x2E718 | 10, 12 | 49 (?, 0.70) — same number |
| 50 | 0x2E76D | 12, 20 | 50 (I, 0.90) — same number |
| 51 | 0x2D3A4 | 7 | 27 (O) |
| 52 | 0x2D3A4 | 7 | 27 (O) |
| 53 | 0x2D3A4 | 7 | 27 (O) |
| 54 | 0x2E7A8 | 12, 20 | 50 (I, 0.90) |
| 55 | 0x2E7E3 | — | ambiguous: the shape of CotAB 12, 14, 16, 38 (?) |
| 56 | 0x2E7EC | 8, 19 | 56 (?, 0.80) — same number |
| 57 | 0x2E838 | 6 | 135 (?, 0.80) |
| 58 | 0x2E892 | 14 | 83 (?, 0.83) |
| 59 | 0x2EA57 | — | ambiguous: the shape of CotAB 12, 14, 16, 38 (?) |
| 60 | 0x2EA60 | 5 | 60 (O) — same number |
| 61 | 0x2EAA4 | 6, 12 | 61 (I, 0.94) — same number |
| 62 | 0x2EB07 | — | 62 (I, 0.96) — same number |
| 63 | 0x2EB5C | 6, 9 | 63 (I, 0.90) — same number |
| 64 | 0x2EC79 | 3 | 64 (I, 0.90) — same number |
| 65 | 0x2ECA9 | 2, 3 | 79 (?, 0.55) |
| 66 | 0x2ED56 | 4 | 103 (?, 0.43) |
| 67 | 0x2F1C4 | 14 | 131 (?, 0.80) |
| 68 | 0x2F2EC | — | 68 (I, 0.98) — same number |
| 69 | 0x2F3B4 | 1, 15 | 25 (O) |
| 70 | 0x2F414 | 14 | 126 (?, 0.74) |
| 71 | 0x2F53F | 11 | 7 (?, 0.70) |
| 72 | 0x2F56B | — | ambiguous: the shape of CotAB 12, 14, 16, 38 (?) |
| 73 | 0x2F574 | 6 | 135 (I, 0.90) |
| 74 | 0x2F595 | 11, 22 | ambiguous: the shape of CotAB 20, 37, 50, 54 (?) |
| 75 | 0x2F5C7 | 4, 10 | 75 (?, 0.42) — same number |
| 76 | 0x2F627 | 9 | ambiguous: the shape of CotAB 1, 4, 10, 12 (?) |
| 77 | 0x2F63D | 15 | 77 (O) — same number |
| 78 | 0x2F7A4 | 12 | ambiguous: the shape of CotAB 20, 50, 54 (?) |
| 79 | 0x2F7B9 | 6, 9 | 129 (?, 0.55) |
| 80 | 0x2F8BC | 14 | 128 (?, 0.79) |
| 81 | 0x2F9EC | 14 | 86 (?, 0.84) |
| 82 | 0x2FB66 | 8 | 89 (?, 0.29) |
| 83 | 0x4D9AE | 14 | 90 (?, 0.85) |
| 84 | 0x30A2F | — | empty handler (0x30A2F) |
| 85 | 0x30A2F | — | empty handler (0x30A2F) |
| 86 | 0x2FC86 | 2, 3 | 64 (?, 0.70) |
| 87 | 0x30A2F | — | empty handler (0x30A2F) |
| 88 | 0x2FCA3 | 2, 3 | 79 (?, 0.60) |
| 89 | 0x2FCC4 | 8, 15 | 89 (?, 0.67) — same number |
| 90 | 0x2FD17 | 5 | 115 (I, 0.94) |
| 91 | 0x2FD7E | — | 91 (?, 0.71) — same number |
| 92 | 0x2FFE6 | 9 | 109 (?, 0.70) |
| 93 | 0x2FFFE | 6 | 135 (?, 0.60) |
| 94 | 0x3001F | 12 | 97 (I, 0.98) |
| 95 | 0x300A7 | 9 | 107 (?, 0.72) |
| 96 | 0x300D5 | 9 | 108 (?, 0.64) |
| 97 | 0x300F4 | — | 142 (?, 0.74) |
| 98 | 0x30175 | 6 | 135 (?, 0.60) |
| 99 | 0x30196 | 9 | 109 (?, 0.52) |
| 100 | 0x301E1 | 19 | 23 (?, 0.50) |
| 101 | 0x30A2F | — | empty handler (0x30A2F) |
| 102 | 0x30A2F | — | empty handler (0x30A2F) |
| 103 | 0x30683 | 5 | 119 (?, 0.62) |
| 104 | 0x4D9AE | 14 | 90 (?, 0.85) |
| 105 | 0x306E2 | 4 | 103 (?, 0.49) |
| 106 | 0x30749 | 15 | 27 (O) |
| 107 | 0x30767 | 14 | 137 (O) |
| 108 | 0x30887 | 8 | 56 (?, 0.67) |
| 109 | 0x30A2F | — | empty handler (0x30A2F) |
| 110 | 0x308B4 | — | 141 (?, 0.70) |
| 111 | 0x30905 | — | 142 (O: Fear adds 0x6F where CotAB adds 0x8E) |
| 112 | 0x30956 | 5 | 143 (O: spell 85 adds 0x70 where CotAB adds 0x8F) |
| 113 | 0x309ED | — | 146 (O: the STR-set type 0x71 of Giant Strength 59 and the stat routine; a handler where CotAB has none) |
| 114 | — | — | none in the table (not filled) |
| 115 | — | — | none in the table (not filled) |
| 116 | — | — | none in the table (not filled) |
| 117 | — | — | none in the table (not filled) |
| 118 | — | — | none in the table (not filled) |
| 119 | — | — | none in the table (not filled) |
| 120 | 0x30A38 | — | 147 (O: the dispatcher's item path DS:89C6, CotAB DS:720C) |

## 4. Item kinds 0x44133 (O)

By item +0x3E & 0x7F: **0** the generic handler (the item's effect run at once, its argument from the
readying flag); **1** a slot routine through +0x14B and the memorised slots, testing spell-record bytes 3 and 5
(I: CotAB's Ring of Wizardry, kind 1); **3** and **5** STR
worked out again (stat 0); **9** the Spiritual Hammer: put away, its 0x17 removed. CotAB's kinds 2 (DEX, thief
skills), 4 (alignment), 6 (CON, CHA), 8 (a stat +1) and 0x0A–0x0D are gone.

## 5. The current-stat routine 0x51F80 (O)

CotAB's 0x4C389 with the STR-set type **0x71** (CotAB 0x92): STR added 0x26, STR set 0x71 and 0x0C,
feeblemind 0x44 (INT and WIS to 3), CHA added 0x0E, CON 20 regeneration 0x3E (added raw, 0xFF, flag 1;
removed below 20).

## 6. The cloud occupant check 0x51512 (O)

CotAB's 0x4B8F7 with SotSB's cells: on the gas cell a creature with neither **0x1F** nor **0x63** (CotAB 0x1F,
0x20, 0x6F, 0x7D) saves vs 0: success "starts to cough" (0x1E through add-effect, its handler at once), failure
"chokes and gags from nausea" (0x1F, 1d4, its handler at once); on the kill cell the hit-dice bands as CotAB's,
"is Poisoned" (0x37 raw) and status 6 "is killed", the save at −4 in the second band.

## 7. The profile's effect rules (draft)

```ts
// web/src/games/effectrules.ts, SotSB (spec/A-games/sotsb/effects.md)
const SOTSB_IDS: EffectIds = {
  ...COAB_IDS,
  goingDown: [3, 11, 21, 23, 27, 30, 31, 51, 52, 53, 91, 106, 107, 111], // 0x51CA9: DS:0A9A[1..14]
  downRejoins: { effect: 0x4d, morale: 0xb3 },
  moraleRemoves: [], fleeRemoves: [], // 0x51D0B is empty; the flight removes nothing
  helpless: [0x1f, 0x33, 0x34, 0x35], // 0x539D5
  stat: { strAdd: 0x26, strSet: [0x71, 0x0c], feebleminded: 0x44, chaAdd: 0x0e, regenerate: 0x3e },
}
export const SOTSB_EFFECTS: EffectRules = {
  events: {
    1: [25, 37, 69], 2: [65, 86, 88], 3: [64, 65, 86, 88], 4: [29, 66, 75, 105, 32],
    5: [28, 41, 60, 90, 103, 112], 6: [6, 10, 17, 20, 28, 61, 63, 57, 73, 79, 93, 98],
    7: [3, 27, 31, 51, 52, 53], 8: [56, 82, 89, 108], 9: [18, 28, 63, 76, 79, 92, 95, 96, 99],
    10: [1, 2, 7, 26, 33, 36, 49, 75], 11: [4, 8, 9, 13, 17, 30, 33, 45, 46, 47, 48, 71, 74],
    12: [8, 9, 10, 13, 17, 20, 33, 36, 45, 46, 49, 50, 54, 61, 78, 94],
    14: [58, 67, 70, 80, 81, 83, 104, 107], 15: [3, 5, 11, 21, 27, 30, 77, 106, 25, 37, 47, 48, 69, 89],
    17: [1, 2, 11], 18: [39, 42], 19: [11, 23, 56, 100], 20: [50, 54], 21: [35], 22: [39, 42, 74],
  },
  removalStat: { 0x0e: [5], 0x0c: [0], 0x26: [0], 0x71: [0] },
  items: { 0: { b: 'grantEffect' }, 1: { b: 'doubleSlots' }, 3: { b: 'recomputeStats', stats: [0] },
    5: { b: 'recomputeStats', stats: [0] }, 9: { b: 'unreadyEnds', type: 0x17 } },
  // handlers: CotAB's behaviours under SotSB's numbers, as §3 (to be confirmed per type before use)
  ...
}
```

The cloud rules (`R.clouds`): the gas cell 0x1D, the kill cell 0x1B, immune [0x1F, 0x63].

## Open

- §3's rows marked I and ?: read each handler (the parameters of the matched behaviours, and the types whose
  match is weak: 32, 65, 66, 67, 70, 75, 79, 82, 88, 92, 93, 95–100, 103, 105, 108, 110).
- What runs at events 13 and 16 now (nothing in the switch; their callers may be gone).
- The monster specials (event 14: 58, 67, 70, 80, 81, 83, 104, 107) against CotAB's `rules/specials.ts`.
- The computer's movement probe on clouds (CotAB 0x237FB) with SotSB's cells.
