---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Camp, rest, memorisation and time

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Evidence marks as in the README (**G**: the GameFAQs guide, not
> checked in code). Curse of the Azure Bonds: [coab/tables.md](../coab/tables.md),
> [coab/spells.md](../coab/spells.md).

Function names are Ghidra names in the merged image. The guide's section 12.6.3 lists the same functions under its own segment numbers (its "Segment 2F73" is our `3f81`, "3B38" is `4b46`); the offsets agree.

Two variables share the number 0x49FB: ECL word **0x49FB** (array A, automap and coordinate display) and the engine global **`DS:49FB`** (rest-encounter step counter). They are unrelated.

## Encamp (O, `FUN_29c3_2dd3` → `FUN_3f81_1e6f`)

Reached by `E` in a map area or in the wilderness command menu ([main-loop.md](main-loop.md)), or by ECL `PROGRAM 9` (inns and other scripted rests).

1. Run the area's **`camp_menu`** vector. Scripts use it to set the rest-encounter interval and chance, ECL **0x6DD2** / **0x6DD3** (below). If they set nothing, both are 0 from the last `NEW_ECL` and rest is never interrupted.
2. Camp screen (`FUN_3f81_1e6f`, below), which returns an *interrupted* flag.
3. If interrupted: redraw, then run **`camp_confirmed`** (scripts start the wandering-monster fight there).
4. `FUN_54cf_016d` (redraw, **I**); clear the "saved" flag `DS:557D` ([input-and-menus.md](input-and-menus.md)).

Camp screen:

1. Save the game mode `DS:49F3` and set it to **2** (camp). Clear the healing step counter `DS:6DD8` and the rest-time vector `DS:6DC2` (7 words). Redraw the view (`FUN_10ba_27d9`): in game mode 2 it shows **`PIC<block>` record 29**, the campfire (two frames, animated by the menu loop); in mode 6 (combat results) it shows record 1.
2. Print "The party makes camp..." and pause.
3. **Clear every member's pending spells** (`FUN_3f81_0214`): memorised slots ≥ 0x80 → 0, char[0x2C] = 0, bit 7 cleared on every scroll spell byte. The same is done again when leaving, so pending memorisations and scribes live only inside one camp session.
4. Menu loop (below) until **E**xit / Esc, or until a rest was interrupted.
5. On leaving: clear pending spells again, `DS:6DB5` = `DS:6DB7` = 0 (the last spell target, below; 0x317C9), restore `DS:49F3`, redraw.

## Camp menu (O, `DS:0508`)

Prompt "Camp: ", horizontal menu **"Save View Magic Rest Alter Exit"** (`FUN_53aa_03bd`, colours 13/10/15). Every option is always offered. There is no **Fix** command (the guide, 2.6, lists it as a later-game feature; Curse of the Azure Bonds has one, [coab/camp.md](../coab/camp.md) §1, which GoldBox Rerolled offers here too, IMP-048 in [C-port/departures.md](../../C-port/departures.md)) and no Level option. Home/End change the current character (`FUN_4894_27df`) and redraw the roster, as on the party screen.

| Key | Action |
|---|---|
| S | Save: the party-screen save routine `FUN_45c5_1d58` (slot menu A–J, Esc cancels, [savegame.md](savegame.md)). Then "Quit TO DOS " Yes/No, asked even after a cancelled save; **Y** exits to DOS (`FUN_1899_0000`) |
| V | View the current character (`FUN_4894_0ab3`, the character sheet) |
| M | Magic menu |
| R | Rest (`FUN_3f81_077a`, the same routine as Magic → Rest) |
| A | Alter |
| E / Esc | leave the camp |

Area restrictions come only from ECL variables, never from the menu:

| Variable | Effect in camp |
|---|---|
| ECL 0x49E5 ≠ 0 | Cast refused: "cannot cast spells in this area". Memorise and Scribe still work |
| ECL 0x6DD2, 0x6DD3 | rest-encounter interval and chance (set by `camp_menu`) |
| ECL 0x49FB ≠ 0 | nothing in camp; outside it the Area command answers "Not Here" and the status line hides the coordinates (below) |

## Magic menu (O, `FUN_3f81_13f1`, `DS:0531`)

**"Cast Memorize Scribe Display Rest Exit"**: **C**ast `3f81:04a1`, **M**emorize `3f81:090a`, **S**cribe `3f81:0b5b`, **D**isplay `3f81:0fbc`, **R**est `3f81:077a`. It loops until Exit/Esc or an interrupted rest.

### Spell-activity check (O, `FUN_3f81_036c(activity)`)

Run first by Cast (1), Memorise (2) and Scribe (3), for the current character:

1. Cast only: ECL 0x49E5 ≠ 0 → "cannot cast spells in this area"
2. Status Animated (1), or char[0x10D] = 0 (cannot act) → "*name* is in no condition to " + "cast any spells" / "memorize spells" / "scribe any scrolls"
3. Otherwise allowed

### Cast (O, `FUN_3f81_04a1`)

Also the explore-mode **C**ast command. `DS:6DB5` = `DS:6DB7` = 0, then repeat until the list is closed:

1. List the ready spells (`FUN_4894_299c` mode 0 "Spells in Memory": slots with 0 < byte < 0x80). None → "has no spells memorized".
2. Cast the pick at once with `FUN_4e53_0c20(spell, 0, from_memory = 1)`; see [spells.md, "Casting outside combat"](spells.md#casting-outside-combat-o-fun_4e53_0c20spell--from_memory).

### Memorize (O, `FUN_3f81_090a`)

1. Spell-activity check (2).
2. If the character has pending spells, list them (mode 5 "Spells to be memorized") and ask **"Memorize These Spells? "**. **Y** leaves the screen and keeps them; **N** clears them (`FUN_3f81_0159`) and continues.
3. Show the remaining slots (`FUN_3f81_05a4`): "*name* can memorize:", then a "Cleric Spells:" and a "Magic-User Spells:" row with one number per spell level 1–3 (blank where there is no slot of that level; a row only if that class has a slot). With **no slot at all**: "*name* cannot memorize any spells", leave.
4. Pick from the spell book (mode 1 "Spells in Spell Book": every id 1–55 with char[0x32 + id] ≠ 0; Restoration, id 56, is never listed). Exit → step 6.
5. If `FUN_3f81_025c(class, level)` > 0: store **id + 0x80** in the first empty slot (char[0x17 + k] = 0) and sort the 21 slots ascending by `byte & 0x7F` (`FUN_3f81_0824`; empty slots sort first). A pick without a free slot is ignored silently. Back to step 3.
6. If anything was picked, list the pending spells and ask **"Memorize these spells? "**; **N** clears all pending spells.

Free slots = char[0xB1 + class·3 + level] − (memorised slots, ready **or pending**, whose spell has that class and level), where class is spell record byte 0 (0 cleric, 1 magic-user) and level byte 1. Slot counts come from class level and Wisdom ([chargen-and-progression.md](chargen-and-progression.md)); Intelligence adds none (O: no INT term in `FUN_51cf_01af`; G: guide 7.5.2). A cleric's spell book holds every cleric spell of each level it has a slot for (set by `FUN_51cf_0000`); a magic-user's holds only the spells chosen at creation and training, or scribed.

A pending spell (id + 0x80) cannot be cast, counts against the slots, and becomes ready during rest (below).

### Scribe (O, `FUN_3f81_0b5b`)

Copies spells from carried scrolls into the spell book. Picking only marks the spell; the copying happens while resting.

1. Spell-activity check (3). Any class may enter; the slot check below does the filtering.
2. If spells are already marked: list them (mode 6 "Spells to be scribed") and ask "Scribe These Spells? ". **N** clears the marks (`FUN_3f81_019c`); **Y** leaves.
3. Pick from the readable scrolls (mode 3 "Spells on Scrolls", `FUN_4e53_051c`). None → "has no copyable scrolls".
   - already known (char[0x32 + id]) → "You already know that spell"
   - already marked on any scroll → "You are already scibing that spell" (sic)
   - no slot of that class and level (char[0xB1 + class·3 + level] = 0) → "You can not scribe that spell."
   - otherwise set bit 7 on the first scroll byte (item[0x3C..0x3E]) holding that spell
4. Repeat until the list is closed, then confirm "Scribe these spells? " (**N** clears the marks).

Readable scrolls (O, `FUN_4e53_044e`, `FUN_4e53_323d`):

- A scroll is an item whose type has `ITEMS` byte 0 in 11–13. Type 61 (byte 0 = 11, class mask 1) is the magic-user scroll, type 62 (12, mask 2) the cleric scroll.
- Its spells are listed only while its hidden-name byte item[0x35] = 0. Building the list clears item[0x35] for good when the current character has effect 0x10 (**Read Magic**), or has a cleric level and the scroll is a cleric scroll.
- So a magic-user needs Read Magic active, or an already identified scroll, to scribe.

### Display (O, `FUN_3f81_0fbc`)

Window titled "Display": one line per effect on the current character (list at char[0x7F]), or " <No Spell Effects>".

- Effect types 1, 2, 5, 8–14, 16, 17, 19–25, 28, 29, 32–34, 36–39, 41, 42, 45, 46, 49, 51–53 show the name of the first spell (id 1–56) whose record byte 10 is that type; with no match, "Funky--*type*".
- Fixed names: 4 "Studying Manual of Bodily Health", 7 "Training with Manual of Bodily Health", 27 "Feather Fall", 31 "Helpless", 35 "Prayer", 44 "Cause Disease", 50 "Dreaded Mummy Disease", 54 "Repulsed", 55 "Poisoned", 59 "Regenerating", 61 "Fire Resistance", 71 "Invisible", 72 "Camouflaged", 89 "Displaced".
- Other types are not listed.

## Alter (O, `FUN_3f81_1c59`)

Menu "Order Drop Speed Icon Pics Exit":

- **Order** (`FUN_3f81_1780`): "Party Order: Select Exit". The cursor keys move the highlight between characters. **S**elect a character ("has been selected") to switch to "Place Exit", where Home/End (keypad 7/1) move that character up or down the list (`FUN_3f81_14a9`, `FUN_3f81_1601`; **I** for which is which).
- **Drop** (`FUN_3f81_18e5`): "Drop from party?". On Y the character "bids you farewell", or "is dumped in a ditch" when char[0x10D] = 0 (**I**: dead or unconscious). They are removed from the party and the party display is redrawn. On N: "Breathes A sigh of relief". If the character is the only member, the prompt is "quit TO DOS:" instead.
- **Speed** (`FUN_3f81_1a97`): "Game Speed = n (0=fastest 9=slowest)". **F**aster/Up arrow lowers `DS:49E2`, **S**lower/Down raises it, within 0–9. Its uses:
  - standard pause `FUN_1709_0dbe` = Delay(speed × 225 ms)
  - typed text: while `DS:4A00` is set, each printed character waits speed × 10 ms
- **Icon**: the combat-icon editor (`FUN_417f_382d`), as on the party screen
- **Pics**: toggles "Monsters on/off" (`DS:49F6`) and "Portraits on/off" (`DS:49F5`). Each option shows the current state; **M** and **P** flip it.

## Rest

### Preparation time (O, `FUN_3f81_0000(char)`)

Over one character's pending memorised slots (byte ≥ 0x80) and marked scroll bytes (≥ 0x80) on scrolls it carries:

| Quantity | Value |
|---|---|
| base hours, stored in **char[0x2C]** | 0 if nothing is pending; 4 if anything is; **6** if any pending spell (memorise or scribe) has level ≥ 3 |
| preparation minutes (returned) | 60 × base + 15 × (sum of the levels of all pending spells) |

The guide's table (8.1) continues with 8/10/12 hours for spell levels 5–9. Pool of Radiance has no such levels, and the code only distinguishes ≤ 2 from > 2.

### Rest command (O, `FUN_3f81_077a`)

1. Compute every member's preparation time (this sets each char[0x2C]); take the **maximum** m.
2. Preset the rest time `DS:6DC2`: hours = m div 60, ten-minutes = (m mod 60) div 10, minutes = m mod 10. Days are not touched (normally 0).
3. Rest (`FUN_4b46_0c9a`, below). Its result is the camp's *interrupted* flag.
4. Clear the rest-time vector; redraw.

The duration prompt therefore opens on exactly the time the slowest member needs; the player may change it.

### Duration prompt (O, `FUN_4b46_0721`, display `FUN_4b46_05f0`)

- "Rest Time:" then `DD:HH:MM` (days, hours, 10 × tens + minutes, two digits each). The selected field is white (15), the others green (10).
- Menu **"Rest   daYs Hours Mins   Inc Dec   Exit"**; the start field is Mins.

| Key | Effect |
|---|---|
| R, Enter | start resting |
| Y / H / M | select days / hours / minutes |
| Left / Right | select the next larger / smaller field (wraps) |
| I, Up | Mins +5 minutes; Hours +1; Days +1 |
| D, Down | Mins −5 minutes; Hours −1; Days −1 (borrowing from larger units; when nothing is left to borrow, the whole time becomes 0) |
| E, Esc | leave without resting |

After every change the vector is normalised (carry table under Game clock) and **days are capped at 99** (`FUN_4b46_03a3`; months are folded into days first). The guide's "99 hours" is wrong.

### Rest loop (O, `FUN_4b46_0c9a`)

Setup: each member's learning countdown `DS:6DCF + n` (n = 1-based party position) = 0; a local hour-tick = 0; every member flagged for effect time-out (`DS:471E`, 72 bytes = 1); draw the window and the time; `DS:6DDA` = 1 (messages print one row lower); duration prompt. If not started, finish.

While any of the minutes, ten-minutes, hours or days of the rest time is non-zero, one **step = 5 minutes**:

1. If a key was pressed: "Stop Resting? " Yes/No. **Y** ends the rest (not an interruption).
2. Rest time −= 5 minutes (`FUN_4b46_047a(5, 1)`). Every 5th step, redraw the time.
3. **Game clock += 5 minutes** (`FUN_4b46_03d5(5, 1)`); this also ticks effect durations by 5 minutes.
4. **Healing** (`FUN_4b46_0871`): `DS:6DD8` += 1. At **288** (24 hours): heal each member by 1 HP, print "The Whole Party Is Healed" (always), redraw the roster if anyone changed, `DS:6DD8` = 0.
5. **Learning countdowns** (`FUN_4b46_0b0a`), for each member n: countdown −= 1 (a byte: 0 wraps to 255). If it is now 0 **and** char[0x2C] = 0: *finish one spell*, then countdown = 3 × the level of the next pending spell (0 if none).
6. **Base hours** (`FUN_4b46_0bb2`): hour-tick += 1. At 12 (one hour): hour-tick = 0, and for each member with char[0x2C] > 0: char[0x2C] −= 1; when it reaches 0, countdown = 3 × the level of the first pending spell (nothing is learnt yet).
7. **Encounter check**: if ECL **0x6DD2** > 0: `DS:49FB` += 1. When `DS:49FB` ≥ 0x6DD2: `DS:49FB` = 0 and roll d100 (`FUN_5216_0de3(1, 100)`). If the roll ≤ ECL **0x6DD3**: redraw, "The Party is rudely interrupted!", pause, and end the rest as **interrupted**.

Finally erase the window and set `DS:6DDA` = 0.

*Finish one spell* (scribes before memorisations):

1. Scribe (`FUN_4b46_09e7`): the first marked byte (> 0x80) on a scroll, in inventory order, scroll slots 1–3: char[0x32 + id] = 1, remove the spell from the scroll, print "*name* has scribed *spell*". Removal (`FUN_4e53_328a`): clear the last of item[0x3C..0x3E] holding that id, and decrement name word item[0x30] (210 "With 1 Spell", 211 "With 2 Spells", 212 "With 3 Spells"); when it drops below 210 the scroll is deleted from the inventory (`FUN_10ba_1509`).
2. Only if no scribe was pending, memorise (`FUN_4b46_0925`): the first slot ≥ 0x80 in slot order loses bit 7; print "*name* has memorized *spell*".
3. The next spell is found the same way (scribes first); its level sets the countdown.

Resulting timing for one character: the base hours, then each spell 15 minutes × its level later, scribes first. In a rest of exactly the preparation time, the last spell completes in the final step. Stopping a rest keeps the spells learnt so far; resting again recomputes char[0x2C], so the base hours are paid again. An interrupted rest ends the camp, which clears whatever is still pending.

| Counter | Reset |
|---|---|
| `DS:6DD8` (healing, 5-minute steps) | camp entry only: rests within one camp add up towards the 24 hours |
| `DS:6DCF + n`, hour-tick | start of each rest |
| `DS:49FB` (encounter steps) | program start and each check. It carries over between rests, camps and areas, and is not saved |

### Healing (O, `FUN_5216_175d(char, amount = 1, force = 0)`)

- Only status Okay, Animated, Unconscious or Dying (set `5216:173D` = {0, 1, 4, 5}); Dead, Stoned, Running and tempgone are skipped.
- Blocked when the character has effect **0x32** (mummy rot), which heals 1 HP every 10 days on its own ([effects.md](effects.md)).
- HP += 1, capped at max HP.
- If char[0x10D] = 0 afterwards: Dying → Unconscious; an Unconscious character outside combat (game mode DS:49F3 ≠ 5) runs effect 0x4E (revive) as a removal call (0x43985): its handler `FUN_3723_19d9` calls `FUN_5216_1869(current HP)`, which sets status Okay, **char[0x10D] = 1** (back in play) and HP, with no test of the HP (**O**, 0x439FF–0x43A14; CotAB the same, heal 0x4CE85, revive 0x4CFAD/0x4CFB6; [effects.md](effects.md)).

Natural healing is therefore **1 HP per character per 24 hours of rest**, whatever the class, level or Constitution.

### Encounter parameters

| ECL | Meaning |
|---|---|
| 0x6DD2 | steps (5 minutes each) between checks; 0 = never interrupted |
| 0x6DD3 | chance in percent per check |

Both are zeroed by every `NEW_ECL`, so an area's `camp_menu` sets them each time the party camps, often per square. Example, block 1 area 18: 2 steps / 16 %, but 0 on the squares with event 132 or 138, and 1 step / 99 % while flag 0x4A34 ≥ 64. An interrupted rest runs `camp_confirmed`, which normally loads monsters and starts a fight. The guide gives each area's resting rules (section 6, "Resting:").

## Game clock (O)

### Storage

Seven words in ECL array A, so they are saved with it ([savegame.md](savegame.md)):

| ECL | Unit | Range |
|---|---|---|
| 0x49C6 | segment (6 s) | 0–9, never used |
| 0x49C7 | minute | 0–9 |
| 0x49C8 | ten minutes ("turn") | 0–5 |
| 0x49C9 | hour | 0–23 |
| 0x49CA | day | 0–29 |
| 0x49CB | month | 0–11 |
| 0x49CC | year | 0–255 (see the aging bug) |

Carry table `DS:363A`: 10, 10, 6, 24, 30, 12, 256. The rest-time vector `DS:6DC2` (7 words, same units) is an engine global and is not saved.

Arrays A, B and C are zero-filled at program start, so a new game starts at 00:00 on day 0, month 0, year 0. The shipped saves read 10:50 and 10:56 on day 0.

### Advancing (`FUN_4b46_03d5(count, unit)`)

1. Copy the seven words. `count` times: the unit's word += 1, then normalise (`FUN_4b46_02f2`).
2. Normalise: for units 0–5 in order, if the word ≥ its limit, subtract the limit once and add 1 to the next unit. Year (unit 6) ≥ 256: **every party member's age (char[0x30]) += 1**; the year is left as it is. After 256 years every advance ages everyone (guide 13.1: "1 year every minute").
3. Write the words back, then time out effects by the same amount (below).

| What | Advance | Where |
|---|---|---|
| step forward in a map area | 1 minute; **10 minutes** while Search is on (ECL 0x6DCA bit 0) | `FUN_3e76_073b` |
| step in the wilderness | **12 hours** (after storing the new 0x49C3/0x49C4) | `FUN_3e76_0818` |
| Look (map area or wilderness) | 10 minutes | `FUN_3e76_0989` |
| combat round | 1 minute at the end of each round | `FUN_320c_0880` |
| rest | 5 minutes per step | above |
| ECL `DELAY` (0x34) | an undefined number of minutes (uninitialised operand index); used once in the data | [ecl.md](ecl.md) |

Turning, menus, shops, temples, training and casting outside combat take no time. Scripts may also write the clock words directly (some add 2 to the hour or set it to 0, 14 or 18); such a write is only normalised at the next advance, one carry per unit.

### Effect time-out (`FUN_4b46_0000(count, unit)`)

1. Convert to minutes: count × the product of the limits below the unit (unit 1 = minutes). Units 0 and 6 are not handled properly but are never used.
2. Repeat in chunks of `min(remaining, 10)` minutes. For each party member and each of its effects with duration ≠ 0 (0 = permanent): if chunk < duration, duration −= chunk; otherwise remove the effect (`FUN_5216_0026`, which runs its removal callback, [effects.md](effects.md)). In combat the round end advances the clock by 1 minute while the monsters are linked into the party list, so their effects time out the same way (I).

Effect durations are therefore in **minutes** (1 combat round = 1 minute). An effect expires at the first chunk that reaches its remaining time, up to 9 minutes early on a long advance.

The per-member flags `DS:471E + n` only let the camp skip members without timed effects; a conforming build MAY process every member every time (the result is the same).

### Status line (O, `FUN_1000_34ab`)

The line under the view shows `x,y facing HH:MM`, followed by " camping" while `DS:49F3` = 2, else " search" while Search is on:

- x, y: the party position; in the wilderness the overland 0x49C3/0x49C4, with x + 13 for area kind 3 and x + 26 for kind 4 (the global column). Left out while ECL **0x49FB** ≠ 0.
- HH = 0x49C9; MM = 10 × 0x49C8 + 0x49C7; two digits each.

Day, month and year are never shown (G: "no in-game way to know how much time has elapsed").

### Day and night

The engine reads the hour only for the status line (O). The scripts treat **hour ≥ 14 as night** (O, `COMPARE [0x49C9], #14`; G: "the sun rises at 00:00 and sets at 14:00"). In their movement vectors they set the sky colour 0x49FD to 11 by day and 8 by night; New Phlan's shops and city hall are closed at night in the same way (G, guide 6.2.2; **I** that every such check uses hour 14). A few scripts use other hours (5, 17) or store the hour to time events (the Valjevo Castle alarm, 0x4A62/0x4A63).

## Variables

| Address | Meaning |
|---|---|
| ECL 0x49C6–0x49CC | game clock |
| ECL 0x6DD2, 0x6DD3 | rest-encounter interval (steps) and chance (%) |
| ECL 0x49E5 | no spellcasting in this area |
| `DS:49F3` | game mode, 2 = camp |
| `DS:49FB` | rest-encounter step counter |
| `DS:6DC2` | rest-time vector (7 words) |
| `DS:6DCF + n` | learning countdown per member (5-minute steps) |
| `DS:6DD8` | healing step counter |
| `DS:6DDA` | 1 while resting (message row offset) |
| char[0x17..0x2B] | memorised spells; id + 0x80 = pending |
| char[0x2C] | base preparation hours still to rest |
| item[0x3C..0x3E] | scroll spells; bit 7 = marked for scribing |

## Open

- ~~`DS:6DB5`/`DS:6DB7`~~: a far pointer to the last character picked as a spell's target outside combat: the picker `FUN_4e53_0a91` (0x3EFC7) sets it to the caster when empty, opens the party picker `FUN_10ba_2c48(1, &DS:6DB5)` on it for a one-target spell and keeps the choice; a cancelled pick empties the target list. Cleared at Cast (0x2FCC2), on leaving the camp (0x317C9) and at 0x41960, so within one Cast the picker reopens on the last target (O). The port starts each pick at its default (presentation).
- ~~Whether durations are scaled~~: no: `FUN_5216_1656` passes the duration word to `FUN_5216_0e52`, which stores it at eff+1 (0x43042), and the time-out subtracts minutes from it (O).
- Exact screen rows and colours of the camp windows (the routines are named above)
