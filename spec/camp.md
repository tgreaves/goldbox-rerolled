---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Camp, rest, memorisation and time

Part of [[spec/README]].

## Encamp (O, `FUN_29c3_2dd3` → `FUN_3f81_1e6f`)

`E` while exploring (or ECL `PROGRAM 9`): run the area's `camp_menu` vector, then the camp menu; if the camp ended with an interruption, run `camp_confirmed` (scripts use it for encounters while camping).

Camp menu: **S**ave (then optionally quit), **V**iew character, **M**agic, **R**est, **A**lter (party options, `FUN_3f81_1c59`), Exit. Game mode `DS:49F3` = 2 while camping.

Magic menu (`FUN_3f81_13f1`): **C**ast (`3f81:04a1`), **M**emorize (`3f81:090a`), **S**cribe (`3f81:0b5b`), **D**isplay (`3f81:0fbc`), **R**est (`3f81:077a`, which leads to the rest routine below).

**Cast** (O, `FUN_3f81_04a1`): runs only if the character can act (`FUN_3f81_036c(1)`). It lists the memorised spells (`FUN_4894_299c` list mode 1; none → "has no spells memorized"), and each pick is cast at once through the shared cast routine `FUN_4e53_0c20` (see [[spec/spells]]). The list repeats until closed.

## Alter (O, `FUN_3f81_1c59`)

Menu "Order Drop Speed Icon Pics Exit":

- **Order** (`FUN_3f81_1780`): "Party Order: Select Exit". The cursor keys move the highlight between characters. **S**elect a character ("has been selected") to switch to "Place Exit", where Home/End (keypad 7/1) move that character up or down the list (`FUN_3f81_14a9`, `FUN_3f81_1601`; **I** for which is which).
- **Drop** (`FUN_3f81_18e5`): "Drop from party?". On Y the character "bids you farewell", or "is dumped in a ditch" when char[0x10D] = 0 (**I**: dead or unconscious). They are removed from the party and the party display is redrawn. On N: "Breathes A sigh of relief". If the character is the only member, the prompt is "quit TO DOS:" instead.
- **Speed** (`FUN_3f81_1a97`): "Game Speed = n (0=fastest 9=slowest)". **F**aster/Up arrow lowers `DS:49E2`, **S**lower/Down raises it, within 0–9. Its uses:
  - standard pause `FUN_1709_0dbe` = Delay(speed × 225 ms)
  - typed text: while `DS:4A00` is set, each printed character waits speed × 10 ms
- **Icon**: the combat-icon editor (`FUN_417f_382d`), as on the party screen
- **Pics**: toggles "Monsters on/off" (`DS:49F6`) and "Portraits on/off" (`DS:49F5`). Each option shows the current state; **M** and **P** flip it.

## Memorize (O, `FUN_3f81_090a`)

- Pick a known spell (spell-known flags char[0x32 + id]) of a class/level with a free slot (`FUN_4e53_153c(class, level)` against slots char[0xB2..0xB7], see [[spec/progression]])
- It goes into the first empty memorised slot char[0x17..0x2B] as **`id + 0x80`** (pending); it becomes usable only after resting
- Leaving offers to clear pending choices (`FUN_4e53_1439`)

## Scribe (O, `FUN_3f81_0b5b`)

Copies magic-user spells from carried scrolls into the spell book. Only characters accepted by `FUN_4e53_164c(3)` can scribe (**I**: magic-user casters). Picking a spell only marks it; the copying happens while resting.

1. If spells are already marked: "Scribe These Spells?". **N** clears the marks (`0x4F9AC`); **Y** leaves the screen.
2. Pick a spell from the copyable scrolls (`FUN_4894_299c`, list mode 3). If the character has none: "has no copyable scrolls".
   - already known (char[0x32 + id]) → "You already know that spell"
   - already marked on any scroll → "You are already scibing that spell" (sic)
   - no spell slot of that class and level (char[0xB1 + class·3 + level] = 0) → "You can not scribe that spell."
   - otherwise mark the first scroll slot (item[0x3C..0x3E]) holding that spell by setting bit 7
3. Repeat until the list is closed, then confirm with "Scribe these spells?" (**N** clears the marks).

## Rest (O, `FUN_4b46_0c9a`)

Duration prompt (`FUN_4b46_0721`): "Rest  daYs Hours Mins  Inc Dec  Exit"; Mins steps by 5.

Each step = **5 minutes**:

1. Key press → "Stop Resting?"
2. Advance the rest timer (`FUN_4b46_047a(1, 5)`); every 5 steps redraw the clock
3. Delay (`FUN_4b46_03d5(1, 5)`)
4. **Healing** (`FUN_4b46_0871`): every 288 steps (1 day) each party member gains **1 HP** (`FUN_5216_175d`, not if the character has effect 0x32; Dying → Unconscious); message "The Whole Party Is Healed"
5. **Memorisation** (`FUN_4b46_0b0a`): each member has a countdown (`DS:6DCF + n`); when it reaches 0 and the member is not scribing (char[0x2C] = 0):
   - first finish one pending **scribe** from a scroll (`FUN_4b46_09e7`: carried scroll whose spell byte item[0x3C..0x3E] ≥ 0x81 → mark spell known char[0x32 + id] = 1, remove it from the scroll (`FUN_4e53_328a`), print "has scribed")
   - else finish one pending **memorisation** (`FUN_4b46_0925`: clear bit 7 of the first pending slot)
   - countdown = level of the next pending spell × 3 (i.e. **15 minutes per spell level**)
6. **Hourly block** (`FUN_4b46_0bb2`): every 12 steps (1 hour), a positive char[0x2C] counts down by one. While it is above 0, step 5 does nothing for that character. When it reaches 0, the countdown is restarted from the next pending scribe or memorisation, without learning anything that step. The code that sets char[0x2C] has not been found (**I**: a delay in hours, perhaps after a spell is cast)
7. **Random encounter** check: if `B[0x5A4]` ≠ 0, a counter (`DS:49FB`, an engine global) increments each step; when it reaches `B[0x5A4]` it resets and if d100 ≤ `B[0x5A6]` the rest ends: "The Party is rudely interrupted!" (returns "interrupted", which runs the area's `camp_confirmed` vector)

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

- What sets char[0x2C]
- Where the persistent game clock lives in the save (likely word array A)
