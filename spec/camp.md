---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Camp, rest, memorisation and time

Part of [[spec/README]].

## Encamp (O, `FUN_29c3_2dd3` → `FUN_3f81_1e6f`)

`E` while exploring (or ECL `PROGRAM 9`): run the area's `camp_menu` vector, then the camp menu; if the camp ended with an interruption, run `camp_confirmed` (scripts use it for encounters while camping).

Camp menu: **S**ave (then optionally quit), **V**iew character, **M**agic, **R**est, **A**lter (party options, `FUN_3f81_1c59`), Exit. Game mode `DS:49F3` = 2 while camping.

Magic menu (`FUN_3f81_13f1`): **C**ast (`3f81:1781`), **M**emorize (`3f81:090a`), **S**cribe (`3f81:0b5b`), **D**isplay (`3f81:0fbc`), **R**est.

## Memorize (O, `FUN_3f81_090a`)

- Pick a known spell (spell-known flags char[0x32 + id]) of a class/level with a free slot (`FUN_4e53_153c(class, level)` against slots char[0xB2..0xB7], see [[spec/progression]])
- It goes into the first empty memorised slot char[0x17..0x2B] as **`id + 0x80`** (pending); it becomes usable only after resting
- Leaving offers to clear pending choices (`FUN_4e53_1439`)

## Rest (O, `FUN_4b46_0c9a`)

Duration prompt (`FUN_4b46_0721`): "Rest  daYs Hours Mins  Inc Dec  Exit"; Mins steps by 5.

Each step = **5 minutes**:

1. Key press → "Stop Resting?"
2. Advance the rest timer (`FUN_4b46_047a(1, 5)`); every 5 steps redraw the clock
3. Delay (`FUN_4b46_03d5(1, 5)`)
4. **Healing** (`FUN_4b46_0871`): every 288 steps (1 day) each party member gains **1 HP** (`FUN_5216_175d`, not if the character has effect 0x32; Dying → Unconscious); message "The Whole Party Is Healed"
5. **Memorisation** (`FUN_4b46_0b0a`): each member has a countdown (`DS:6DCF + n`); when it reaches 0 and the member is not scribing (char[0x2C] = 0):
   - first finish one pending **scribe** from a scroll (`FUN_4b46_09e7`: carried scroll whose spell byte item[0x3C..0x3E] ≥ 0x81 → mark spell known char[0x32 + id] = 1, remove it from the scroll)
   - else finish one pending **memorisation** (`FUN_4b46_0925`: clear bit 7 of the first pending slot)
   - countdown = level of the next pending spell × 3 (i.e. **15 minutes per spell level**)
6. **Scribing timer** (`FUN_4b46_0bb2`): every 12 steps (1 hour) char[0x2C] counts down; at 0 the scribe completes as above
7. **Random encounter** check: if `B[0x5A4]` ≠ 0, a counter (`A[0x49FB]`) increments each step; when it reaches `B[0x5A4]` it resets and if d100 ≤ `B[0x5A6]` the rest ends: "The Party is rudely interrupted!" (returns "interrupted", which runs the area's `camp_confirmed` vector)

Scripts control encounters per area by setting `B[0x5A4]` (steps between checks) and `B[0x5A6]` (percent chance); the VM reset clears both.

## Time (O, `DS:6DC2`, carry table `DS:363A`)

Time vectors are seven words; each unit carries into the next by the ratios 10, 10, 6, 24, 30, 12:

| Index | Unit |
|---|---|
| 0 | 6-second segment |
| 1 | minute |
| 2 | 10 minutes |
| 3 | hour |
| 4 | day |
| 5 | month (30 days) |
| 6 | year (12 months) |

The same representation is used for the rest duration; the game clock and the effect-duration countdown (`0x4B5E3`, see [[spec/effects]]) advance alongside (**I** for the exact link).

## Open

- Alter menu, Scribe setup (how many hours char[0x2C] is set to), camp Cast
- Where the persistent game clock lives in the save (likely word array A)
