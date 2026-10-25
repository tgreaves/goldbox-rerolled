---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Battle screen

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative** (D4): the battle
screen that presents the original's combat ([combat-rules.md](../A-games/engine/combat-rules.md),
[battlefield.md](../A-games/engine/battlefield.md), [combat-ai.md](../A-games/engine/combat-ai.md),
[combat-visuals.md](../A-games/engine/combat-visuals.md)) through the combat host
([B-model/host-contracts.md §4.2](../B-model/host-contracts.md#42-the-combat-host-combatui)): the
battlefield window and its scrolling, what is drawn, the command row, the input, aiming and targets,
the information shown, the end of a battle, the pacing and the Quick controls (IMP-033, IMP-037,
IMP-044, IMP-052, IMP-053, IMP-054, IMP-058, IMP-059). Observed in the reference implementation
(`web/src/ui/combat.ts`, `render/combatview.ts`, the player turn of `rules/combat.ts`, **O**). Colours
and sizes are informative; texts in quotation marks are the port's ([strings.md §3](../D-appendices/strings.md#3-port-texts))
unless marked *game text*.

## 1. Layout

The battle takes the view region; the area map, the pad and the location line are hidden; the cards
and the text log stay; the command bar holds the combat commands with **Take control**, **Magic** and
**Debug** ([ui-contract.md §3.2](ui-contract.md#32-battles) for each screen class). In the W row
layout the battlefield spans the whole width under the cards (IMP-064). The original's screen: a 7 × 7
cell battlefield on the left, the acting combatant's side panel on the right, the text below
([graphics.md, "Screen layout"](../A-games/engine/graphics.md#screen-layout-o-for-coordinates-passed-in-code-i-for-roles)).
The port shows every party member's card instead of the side panel; the cards keep the panel's
content (HP colours, AC, weapon, "(Helpless)", [ui-contract.md §4.1](ui-contract.md#41-party-cards)).

## 2. The battlefield window

- **The field** is the original's 25 rows × 50 columns ([battlefield.md](../A-games/engine/battlefield.md));
  one cell is a 24 × 24 tile. The window shows part of it.
- **Size**: as many cells as fit, about 56 CSS px a cell: *rows* = round(height / 56) limited to
  7 … 25, *cols* = round(*rows* × width / height) limited to 7 … 50, never fewer than the original's 7
  × 7 (IMP-033). The window is recomputed when the region's size changes. The picture of *cols* × 24 by
  *rows* × 24 logical pixels is scaled to fit the region (contain, centred, black bars).
- **Origin**: centred on the **focus** cell, clamped so the window stays inside the field.
- **Focus**: the acting combatant whenever the rules redraw for it (each turn and step); the cell a
  `look` names (the AI's target, an aimed square); the midpoint of a flight while it flies, then back.
  At the start: the first combatant.

## 3. What is drawn

In this order, each frame of the window ([combat-visuals.md](../A-games/engine/combat-visuals.md)):

1. the ground in colour 0, which the battle palette shows as dark grey;
2. the tiles: cell values through the cell table to tile images from `DUNGCOM` #1 or, for a
   wilderness field, `WILDCOM` #1 (from tile 0), and `RANDCOM` #1 (from tile 0x22);
3. the **cursor tile** (`COMSPR` #25) under the combatant whose turn it is;
4. the **combatants**: the party's built combat icons ([rendering.md §6](rendering.md#6-combat-icons)),
   monsters' `CPIC` records from their icon slot, read in the block they were loaded in (*id* ready, *id* +
   128 action; an empty slot draws nothing, `Engine.combatIcon`); the action frame while the rules
   pose them; mirrored when facing S, SW, W or NW; colour 0 transparent, colour 13 opaque black; a
   combatant out of play disappears, except one whose skull is still queued, which stays where it
   stood until its skull is shown;
5. **sprites** over the field: missiles and spell flights, the sparkle (`COMSPR` 9), the starburst
   (10), the skull (11), from `COMSPR` 0–11 and their +128 mirrors;
6. the port's **marks**: every square the acting character can reach with its movement left, lightly
   filled blue, or red where an enemy stands next to it (a step away from there draws a blow, IMP-084);
   the eight neighbours outlined blue; a planned walk's squares outlined blue, its end green, and the
   steps that may draw a blow filled red (IMP-083); an enemy tapped once outlined yellow (IMP-083); for a
   party member played by hand, the free square straight behind each enemy a melee blow would strike
   from behind, dashed yellow (IMP-084: the enemy engaged twice already, so it will not turn, and its
   summed angle plus the 4 of a blow from behind over 4, [combat-rules.md, "Engagement and
   facing"](../A-games/engine/combat-rules.md#engagement-and-facing-o-fun_3aae_17f6-fun_3aae_1884));
   the targets in reach outlined red during Aim; an area spell's squares filled red and the aimed
   square outlined yellow (IMP-044, IMP-059).
7. **health bars** (IMP-084): over every combatant standing, a thin bar on a dark track across the top
   of its square(s): the party's share of HP exactly, a monster's only in the info box's bands (full,
   above two thirds, above one third, below), green from half up, yellow from a quarter, red below.
8. **numbers over heads** (IMP-085), over the square(s) of the one struck, rising and fading over
   about 1.3 s (only fading with reduced motion, ui-contract.md): a weapon's hit or a spell's damage
   shows "−*n*", the damage its message names, with that message, its sound (7 for a hit) and the
   starburst (the rules tell the screen, `CombatUi.struck`, before the HP is taken off); a blow that
   misses shows "MISS" (white) with "and Misses" and sound 9. Any other change of HP (a script's
   DAMAGE, an effect, healing) shows with the next message as the change since the message before.
   Damage is yellow on an enemy, red on the party; healing "+*n*" green. The number, its message and its sound show
   together: a notice or a sound the rules give right after a message joins that message's job, shown
   before its pause; any other sound waits its turn behind the queued animations rather than playing
   ahead of them.

Every picture is drawn with the battle palette: in PoR and CotAB EGA colours 0 and 8 swapped (black
shows dark grey, dark grey black), as the original sets it for the combat screen ([combat-visuals.md, "Palette"](../A-games/engine/combat-visuals.md#palette-o));
in SotSB the plain palette, which its original never changes ([sotsb/assets.md §6.2](../A-games/sotsb/assets.md#62-palette-o)).
The profile's `view.combatSwap` says which.
Missile and spell flights move in 8-pixel steps along a Bresenham line on a grid of thirds of a cell,
*delay* ms per step (at least 8) as the rules give them ([combat-visuals.md, "Missiles and spell flights"](../A-games/engine/combat-visuals.md#missiles-and-spell-flights-o));
the sparkle and starburst cycle their frames 70 ms each at the combatant's top-left cell; the skull
stands on every cell the combatant covered, with sound 5, for the hold the rules ask.

## 4. The command row

The rules offer the original's menu (`FUN_320c_031a`, [combat-rules.md, "Player turn"](../A-games/engine/combat-rules.md))
with two changes: MOVE is not a command while movement is live (IMP-053), and the Done submenu's
choices sit in the same row (IMP-054). Buttons in this order, each only when the condition holds.
The labels are the game's words read by address, in capitals with the game's hot key
([strings.md §4.1](../D-appendices/strings.md#41-menus): the pieces "Move ", "View Aim ", "Use ",
"Cast ", "Turn ", "Quick Done" and the Done submenu's "Guard ", "Delay Quit ", "Bandage ", "Speed Exit");
UNDO (key N) and END TURN (key E) are the port's:

| Command | Shown when | Original | Does |
|---|---|---|---|
| **VIEW** | always | View | the character sheet in battle mode ([screens.md §3](screens.md#3-the-character-sheet)); afterwards the attacks are worked out again |
| **AIM** | always | Aim | §6 |
| **USE** | the character carries items | Use | "Use:" lists the readied usable items (spell items and scrolls) with EXIT; a scroll then "Cast from scroll:" with what each spell does; "Nothing to use"; the item's spell is cast at once and the turn ends |
| **CAST** | Okay, the area allows casting (ECL 0x49E5 = 0), spells ready | Cast | "Cast:" lists the ready spells with what each does (IMP-058) and EXIT; "Camp Only Spell" (*game text*) refuses one; a spell with casting time "Begins Casting" and goes off when the caster is picked again; else it is cast now |
| **TURN** | a cleric level and not yet turned this battle | Turn | turn undead |
| **GUARD** | no non-throwing missile weapon readied | Done → Guard | "*Name* is Guarding" (*game text*), the turn ends |
| **DELAY** | always | Done → Delay | picked again after everyone with higher initiative |
| **BANDAGE** | a party member is Dying | Done → Bandage | the first Dying member is bandaged, "*Name* is bandaged"; the turn ends |
| **UNDO** | the character has stepped since its last other action | (Escape) | back to where those steps began, with their movement |
| **QUICK** | always | Quick | §10 |
| **END TURN** | always | Done → Quit | the turn ends |
| **SPEED** | always | Done → Speed | "Game Speed = *n* (0=fastest 9=slowest)" with SLOWER (below 9), FASTER (above 0), EXIT, the game's "Slower ", "Faster ", "Exit" (`FUN_320c_10f6`) |

The prompt is "*Name*: Move Left = *n*" while the character has movement left (more than one half
step), with movement live (§5); otherwise "*Name*:" and the row alone. A build without live movement
offers MOVE first and the step prompt "Move/Attack, Move Left = *n*" (*game text*) with END MOVE and
UNDO, as the original.

Beside the row: **All on Quick** / **Take control**, one button (tooltip "Shift-Q. The computer plays
the whole party until you take control", or while a party member who is not an NPC is on Quick
"Space. Every character on Quick comes back under your control"; §10), **Magic: On** / **Magic: Off**
(frame colour when On; tooltip "Alt-M. Characters on Quick may cast spells; click to stop them" or
"Alt-M. Characters on Quick will not cast spells; click to allow it") and **Debug** (not in the demo,
[screens.md §12](screens.md#12-debug)).

Computer-controlled turns (monsters, NPCs, Quick characters) show no row; the screen shows their
actions as they happen (§9).

### 4.1 The action bar (IMP-083)

Above the command row, while a party member played by hand waits for a command: one button per
memorised spell ("✦ *Name*", "×*n*" for repeats), when CAST is offered, and one per item the rules'
Use would list (readied, with charges, or a scroll: "◆ *Name*"), when USE is offered; hidden when there
are none. A button chooses CAST (or USE) and answers the rules' list with its own line, so the spell
or item goes through `playerCast` / `playerUse` unchanged (a spell the list does not offer, armour for
instance, leaves the list to the player as before); targets are then picked as §6 says.

## 5. Input

While a player character's command row or step waits:

| Input | Action |
|---|---|
| ArrowUp, 8 / PageUp, 9 / ArrowRight, 6 / PageDown, 3 / ArrowDown, 2 / End, 1 / ArrowLeft, 4 / Home, 7 | one step N / NE / E / SE / S / SW / W / NW: into an enemy it attacks, off the field it asks "Flee:" (*game text*), into an ally it asks "Attack Ally:", into a blocked square "Blocked" (the rules, [combat-rules.md, "Move"](../A-games/engine/combat-rules.md#move-fun_320c_09df)) |
| a tap or click on a neighbouring square | the same step |
| a tap on a farther free square | plans the cheapest walk within the movement left (IMP-044): its squares outlined, "Path: *n* steps, *c* of *L* movement. Tap the green square again to go." in the log; out of reach: "Can't get there (Move Left = *L*)" |
| a second tap on the planned square | walks the plan step by step through the normal rules; a step that is stopped (an attack of opportunity, a guard, a cloud, a pause from the rules) ends the walk |
| a tap on an enemy (a party member played by hand, AIM offered) | its information (§7), outlined in yellow, and "Tap *Name* again to attack."; a second tap chooses AIM and answers it with that enemy (IMP-083); when Aim does not offer it, "*Name* is out of reach for *Name* with the weapon readied." and the command row comes back. A neighbouring enemy is attacked by the first tap, as a step into it |
| a tap on the acting character (played by hand) | its commands in a ring round it (the command row's own choices, IMP-084), with ✕ in the middle; a choice is that command; ✕, Escape or a tap elsewhere closes the ring |
| a press on the acting character, then a drag | plans the walk to the square under the pointer as it moves, as a farther tap does, "… Let go to walk it."; letting go walks it; letting go on the character drops it (IMP-083) |
| a tap on any other combatant | its information (§7) |
| Escape | drops a plan; with none, undoes the steps since the last other action (UNDO) |
| Enter | ends the steps (only in the classic step mode, where the menu is END MOVE / UNDO) |
| a command's letter, a click on it | that command ([ui-contract.md §6.3](ui-contract.md#63-menus-and-prompts)); digits are directions while movement is live |
| Space (focus not on a button or field, no step waiting) | **Take control** (the original's hidden key, `FUN_3334_0fc1`) |
| Shift-Q (focus not in a field) | **All on Quick** (the port's, IMP-088) |
| Alt-M; 2 when no step or aim waits | **Magic** on or off (the original's hidden Alt-M and the "2" read during computer turns) |
| any key, click or tap | ends a running hold early (§9) |

**Walk planning**: the cost of a step is 2 half-squares straight and 3 diagonal (the rules' movement
costs); the plan marks in red the squares where a step may draw a blow (an enemy left behind,
[combat-rules.md, "Attacks of opportunity"](../A-games/engine/combat-rules.md#attacks-of-opportunity-o-fun_3aae_08b2c-dir);
a guard beside the next square, "Steps" 5), and the log adds "; *n* enemy blows may fall on the way
(red)" (an enemy that cannot target the mover does not strike, hence "may"); the plan is the cheapest path over squares that are passable and free for the combatant's
size, at most the movement left (when several paths tie, any one of them; the reference's Dijkstra
search keeps the first found). The reachable squares (§3) use the same costs.

With a hovering mouse, moving over the battlefield shows the information of the combatant under the
pointer (§7), and during an area spell's aim the area under it (§6).

## 6. Aiming and targets

**Aim** (`FUN_3aae_3558`): the candidates are every combatant in sight and every body the original's
Manual cursor finds (the last body on a body square nobody stands on, [combat-rules.md,
"Manual"](../A-games/engine/combat-rules.md#aim-o-fun_3aae_3558char-rng-mode-allowempty-done-buf)), nearest first; those the
character can attack (in weapon range, targetable, with ammunition for a missile weapon, no adjacent
enemy unless the weapon is thrown) are offered:

- outlined red on the battlefield;
- as a vertical list "Aim:" (or "Aim: nobody in range"), each "*Name* (range *d*, ≈*p*% to hit, *dice*)",
  and EXIT (the original slides its cursor from target to target with Next/Prev, which the list
  replaces, IMP-033);
- a tap on an outlined target picks it; the list picks it; EXIT or Escape on the list cancels.

An ally picked asks "Attack Ally:" first. The odds are worked out from the attack rules without the
temporary spell bonuses, hence "≈" (IMP-058, `hitOdds`).

**Spell targets** (`FUN_3aae_20c3`): "Target for *Spell*:" with the candidates in range ("*Name* (range
*d*)", a body "*Name* (body, range *d*)"; a weapon never takes a body; a spell with `aimEmpty`, Dimension Door in CotAB and SotSB, lists no one, as the original's cursor takes no occupied square for it); for a spell that may target a square, any square can be tapped ("there (range *d*)"). An **area
spell** (Fireball, Stinking Cloud …) previews the squares it would cover, filled red with the aimed
square in yellow, as the pointer moves over the field or on a first tap ("Tap the yellow square again
to cast there."); a second tap on the same square casts (IMP-059). The original draws its template
only for the aimed square.

## 7. Information

- **The info box** (IMP-044, IMP-058): over the battlefield near the pointer, "*Name*: *condition*"
  in the game-text colour for the party and the enemy colour for enemies. Party: "HP *hp*/*max*", the
  status word when not Okay, and "helpless" (effects 31, 51–53), "coughing" (0x1E), "charmed" (0x0B).
  Monsters only roughly: "unhurt", "lightly wounded" (above two thirds), "wounded" (above one third),
  "badly wounded", or the status word, with the same extras. While a party member acts by hand and
  points at an enemy: " · ≈*p*% to hit, *dice*", and " · open from behind" when a blow from straight
  behind would strike its rear (§3, IMP-084). It hides when the pointer leaves the field.
- **The turn strip** (IMP-044): along the bottom of the battlefield, "Round *n*" then the combatant
  acting now (highlighted) and every other combatant in play that still has initiative to act this
  round, highest initiative first; allies in the game-text colour, enemies in the enemy colour.
- **The cards** stay up to date after every step and action; the Quick badge shows who the computer
  plays.

## 8. The end of a battle

1. When the enemies are gone and the party is not, the rules ask "Continue Battle:" (Yes / No, *game
   text*; not in a demo that says so).
2. Once everything queued has been shown, the battle's summary (outcome, experience, treasure: the
   aftermath's messages, *game text*, [combat-rules.md, "Aftermath"](../A-games/engine/combat-rules.md#aftermath-fun_2e08_1527))
   is printed as a new block in the text log while the battlefield stays in view, then a single-item
   prompt "Press Enter to continue" with **Continue** (IMP-052). The original shows a framed window
   over the whole screen with "press <enter>/<return> to continue".
3. Then: after a won or spared battle with survivors, the view shows the chest (`PIC<block>` #1) and
   the **treasure** panel opens ([screens.md §4](screens.md#4-treasure)); a lost battle goes to the
   game over ([app-flow.md §9](app-flow.md#9-the-party-destroyed-and-the-game-over)); a demo battle
   without aftermath returns to its script.
4. The battlefield, the info box and the turn strip go; the view comes back.

An error inside the battle is shown as the note "Combat error: *message*" and the game goes on.

## 9. Pacing

The original's pacing by game speed ([combat-rules.md, "Pacing"](../A-games/engine/combat-rules.md#pacing-o)),
as holds the rules ask of the host (IMP-037):

- **Messages** go to the text log in order; each is held for its hold (default speed × 225 ms) before
  the next is shown. The rules do not wait for the screen except where they need an answer; the
  outcome never depends on the queue ([B-model/host-contracts.md §4.2](../B-model/host-contracts.md#42-the-combat-host-combatui)).
- **Flights, sparkle, starburst, the skull and poses** are queued with the messages, in the rules'
  order.
- **Each step** of a combatant waits 100 ms after its footstep, whether or not sound is on (IMP-037;
  the original's pace came from the cut-off of the footstep sound).
- **A key, click or tap ends the current hold** (IMP-037, IMP-012); flights run their course.

## 10. Quick and Magic

IMP-054. The original's hidden controls, made visible:

- **QUICK** puts the character on computer control (char `quick` = 1, kept in the record between
  battles). The log says "*Name* is on Quick: the computer plays them. Space or TAKE CONTROL to play
  them yourself." and, when the character has spells ready, "Magic is On: they may cast spells
  (Alt-M or MAGIC to stop)." or "Magic is Off: they will not cast spells (Alt-M or MAGIC to allow).";
  the computer plays the rest of the turn. The card shows the **Quick** badge.
- **All on Quick** (Shift-Q; IMP-088): every party member in play who is not an NPC goes on Quick
  ("All on Quick: the computer plays the party. Space or TAKE CONTROL to play them yourself.", then
  the Magic line when any of them has spells ready; "Everyone is already on Quick" when none was
  left). If a character is waiting at their turn's command prompt, the prompt is left with nothing
  chosen and the computer plays the rest of that turn (`Battle.quickAll`, `atTurnPrompt`); a
  character in the middle of a choice (a target, a spell) finishes it and then hands over.
- **Take control** (Space): every party member on Quick comes back under the player's control:
  "*names*: under your control again" or "Nobody is on Quick".
- All on Quick and Take control are one button: **All on Quick** while no party member is on Quick,
  **Take control** (frame colour) while any is.
- **Magic** (Alt-M, "2"): whether party members on Quick may cast; off at the start of every battle
  (`FUN_34c7_1e31`): "Magic On: characters on Quick may cast spells" / "Magic Off: characters on Quick
  will not cast spells".
- Outside battles the character sheet offers **Play by hand** to clear Quick
  ([screens.md §3.1](screens.md#31-layout)).

## Validation

- The rules behind the screen: `web/test/combat.test.ts`, `battlefield.test.ts`, `ux.test.ts` (the
  hit odds).
- [CONFORMANCE.md](../CONFORMANCE.md), "User interface", the battle items.

## Open

- ~~The battle's View and the palette~~: the original's View screen restores the normal palette in
  battle (`FUN_4894_0ab3` at 0x393FA: in game mode 5 it calls the restore `FUN_577f_0105`, and swaps
  back on leaving at 0x39649, **O**), so the port's sheet in the normal palette is as the original
  (UI6, 2026-10-21).
