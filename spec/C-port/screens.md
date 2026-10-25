---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Screens

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative** (D4): each
screen and panel of the port, its elements, states (enabled, disabled with the reason, selected,
pending), inputs, texts and results, and the original behaviour it presents (part A). Layout classes,
colours by role, dialog conventions and the general input map are in [ui-contract.md](ui-contract.md);
the flow between the top-level screens in [app-flow.md](app-flow.md); the battle screen in
[combat-ui.md](combat-ui.md).

Observed in the reference implementation (`web/src/ui/`, **O**) unless marked. The rules behind every
button are part A's and part B's procedures: a panel changes how a choice is made, never what it does.
Texts in quotation marks are the port's and normative ([strings.md §3](../D-appendices/strings.md#3-port-texts))
unless marked *game text* (read by address, [strings.md §2](../D-appendices/strings.md#2-game-texts-the-screens-show)).
*Name* stands for a character's name as the record holds it (capitals).

**Menu words.** Every menu's words below (SAVE VIEW MAGIC …, YES NO, the lists' EXIT, a panel's Keep
and Exit) are the game's, read by address and split by the original's rule, in capitals on menus and
in the game's case on panels, each with the game's hot key underlined and answering its key
([strings.md §4.1](../D-appendices/strings.md#41-menus)); they are *game text* and may differ between
the games (CotAB's camp has Fix, its rest prompt Add and Subtract). Words the games have no string for
are the port's and are listed in [strings.md §6](../D-appendices/strings.md#6-still-worded-by-the-port).

## 1. The party screen's functions

The screen, its groups and when each function is enabled: [app-flow.md §5](app-flow.md#5-the-party-screen).
The functions open these dialogs ([ui-contract.md §7](ui-contract.md#7-dialogs)); their results go to
the screen's message line.

### 1.1 Create character

One panel instead of the original's question sequence (IMP-040; rules
[chargen-and-progression.md, "Character creation"](../A-games/engine/chargen-and-progression.md#character-creation-fun_417f_056c)).
A wide panel "Create a character" with three sections side by side (one column below about 900 px):

| Section | Elements |
|---|---|
| choices | **Race**: one button per race of the game's race menu (profile `raceMenu`). **Gender**: Male, Female. **Class**: every class any race may take, a class the chosen race may not take greyed out with the tooltip "Not open to a *Race*". **Alignment**: the nine alignments, those the class forbids greyed with "Not allowed for a *Class*". The chosen button of each row is highlighted. Below: "Changing race, gender or class rolls the character again, as the original rolls after those choices. Alignment does not." and the last notice |
| abilities | STR, INT, WIS, DEX, CON, CHA and HP, each with **−** and **+**, the value (STR 18 with exceptional strength as "18/*nn*", 00 for 100) and the allowed range "*min*–*max*" (Modify's ranges, [input-and-menus.md §3.1](../A-games/engine/input-and-menus.md#31-modify-fun_417f_209f-o)); then "AC *n* · THAC0 *n* · Age *n* · *n* gold"; **Reroll** (R) |
| looks | **Name** (up to 15 characters, placeholder "up to 15 letters"); the portrait (head over body) with Head and Body ◀ ▶ (PoR's words, strings.md §4.1 `portrait`) (both directions, wrapping 1–14 and 1–12) and their numbers; the combat icon in its ready and action poses with Head ◀ ▶ (0–13), Weapon ◀ ▶ (0–31), Size (Small/Large), the six parts (Body, Arm, Leg, Hair/Face, Shield, Weapon) and two rows of 16 EGA swatches, **Colour 1** and **Colour 2**, for the selected part. A game without portraits (CotAB) still shows the portrait controls (**?**: CotAB's creation shows the icon instead, [coab/tables.md](../A-games/coab/tables.md)) |

Footer: **Cancel** and **Create** (main).

**Behaviour.** The panel opens with race human (7), the first gender, the race's first class and that
class's first alignment, rolled. Changing race, gender or class starts again and rolls (keeping the
name and the looks; the icon size follows the race, small for dwarves, gnomes and halflings, until the
player sets it). A class the new race cannot take is replaced by its first allowed class, with the
notice "*Class* is not open to a *Race*: now *Class*."; an alignment the new class forbids by its
first allowed one, with "*Alignment* is not allowed for a *Class*: now *Alignment*." Changing the
alignment does not roll. **Reroll** (or R outside the name field) rolls the abilities and HP again and
clears the Modify flag. **−**/**+** step a value as Modify does, set the Modify flag (char[0x85] = 1,
as Modify's Keep), set HP to max HP and recompute AC, THAC0 and damage.

**Create** with an empty name keeps the panel open with "Give the character a name." and focuses the
name field; otherwise the name is taken in capitals with characters outside space…z dropped, the
character is built, stored in the roster under its file stem ([storage.md §3.1](storage.md#31-characters))
with its starting effects, and **not** added to the party (as the original): "*Name* has been
created. Use Add to put them in the party." **Cancel**, ✕ or Escape discard it.

The dice: every roll comes from the page's one dice source, the same as the engine's (D2,
[B-model/host-contracts.md §6.2](../B-model/host-contracts.md#62-where-the-dice-are-rolled)), with the
original's requests in the original's order ([chargen-and-progression.md](../A-games/engine/chargen-and-progression.md)).

### 1.2 Modify character

Only for a character with no experience; otherwise the message "*Name* can't be modified." (*game
text*). A panel "Modify *Name*" (IMP-018; rules [input-and-menus.md §3.1](../A-games/engine/input-and-menus.md#31-modify-fun_417f_209f-o)):
a table of STR, INT, WIS, DEX, CON, CHA and HP, each row with **−**, the value, **+** and its range;
the selected row is highlighted. Footer **Exit** (E) and **Keep** (K, main), the game's "Keep Exit".

- A click on a row selects it; **−**/**+** step that field by the original's rules (the STR
  percentile, the racial and class minimum quirk, HP between its minimum and maximum).
- Keys: ArrowDown or 2 next field, ArrowUp or 8 previous (wrapping), ArrowRight or 6 +1, ArrowLeft or 4
  −1.
- **Keep**: the Modify flag set, HP = max HP, the derived statistics recomputed, stored; "*Name* has
  been modified." **Exit**, ✕ or Escape restore every value.

### 1.3 Add character

A table "Add character" of the roster characters not in the party (IMP-087), a row a character: Name,
Race, Class (the initials of each class, C/F/MU; the full name as the cell's title), Level (*a*/*b*),
HP (current/maximum), AC; then Status when any listed character's status byte is not 0, and Save, the
slot letter, when any was seeded from a save slot that came with the game (roster key `CHRDAT<X><n>`,
[storage.md §4](storage.md#4-roster-seeding): PoR's A and J hold the same six names). A click or tap
anywhere on a row picks it; the name is a button, focused first, for the keyboard. Below 480 px wide
the header is hidden and each row is a card: the name on its own line, then race, class and the
labelled figures ("Level 1/1", "HP 7/7", "AC 4", "Save A"). With no one to add it says "No characters
to add." **Cancel** closes it. Choosing one checks the joining rules ([B-model/procedures.md](../B-model/procedures.md),
`R.join`): a refusal is shown as the message ("The party is full.", "paladins do not join with evil
scum", "too many rangers in party", "*Name* will tolerate no evil!", *game text*); a character already
in the party is refused silently. Otherwise it joins at the end and becomes current: "*Name* joins the
party."

### 1.4 Remove and Drop

- **Remove** takes the current member out of the party (the roster keeps it, IMP-032): "*Name* leaves
  the party (still available to Add)."
- **Drop** asks "*Name* will be gone forever. Drop this character?" (**Yes** main, **No**); on Yes the
  character is deleted from the roster and the party: "*Name* has been dropped." (The original asks
  twice and deletes no file, [input-and-menus.md §2](../A-games/engine/input-and-menus.md#2-party-screen-fun_417f_0161);
  the roster is the port's file store, IMP-016.)

### 1.5 View character

The short sheet: the name; "*Gender* *Race* · age *n*", the alignment, "*Class* · level *a*/*b*"; the
six abilities, then HP "*hp* / *max*", AC, THAC0, Damage, Movement, Status, Experience; the seven
coins. **Close**. (In play the full sheet, §3, is used.)

### 1.6 The combat icon editor

The original's editor ([input-and-menus.md §3.2](../A-games/engine/input-and-menus.md#32-combat-icon-editor-fun_417f_382d-also-from-camp-alter-o))
as one panel "Combat icon" (IMP-017): the old and new icons, each in the ready and action poses
("old: ready, action", "new: ready, action"), drawn in the battle palette as the original's editor
swaps EGA registers 0 and 8 while it runs ([combat-visuals.md, "Palette"](../A-games/engine/combat-visuals.md#palette-o);
SotSB, which never swaps, in the plain palette);
Head ◀ ▶ (0–13), Weapon ◀ ▶ (0–31), Size (Small/Large);
the six parts and the two colour swatches for the selected part; **Exit** (E) restores,
**Keep** (K, main) keeps. The labels are the editor's own words: Head and Weapon (its level 2), the
parts of level 3 (Body, Arm, Leg, Hair/Face, Shield, Weapon; Hair and Face are the words it puts in
place of "xxxx"), Size and the colours of level 1 (PoR "color-1", "color-2"; CotAB "1st-color",
"2nd-color"), Small and Large, Keep and Exit of level 5. The creation panel's icon section (§1.1) uses
the same words.

It opens from camp **Alter → Icon** on the selected character, as in both originals (PoR
`FUN_3f81_1c59` → `FUN_417f_382d`; CotAB's Alter 0x31B6D → its editor in the overlay at 0x36850, **O**);
Keep redraws the party cards. Creation has the same controls inline (§1.1). (UI2, resolved 2026-10-21.)

### 1.7 Load saved game

A list "Load saved game" (IMP-019, IMP-060, IMP-072), each entry "*title* — *note*", with **Exit**:

1. the autosave: "Autosave: *label*" — its date and time;
2. the browser's slots A–J that hold a save: "*x*: *label*" — date and time;
3. conflict copies of saves: "*x* (conflict copy, this browser's | another device's): *label*", or
   "Autosave (conflict copy, …)" — date and time;
4. the game files' own saves whose party files are all present: "*x* (game files): *Name*'s party" —
   "block *b* area *a*".

No entries: the message "There are no saved games." Choosing one starts play
([app-flow.md §7](app-flow.md#7-play-new-game-load-continue)).

### 1.8 Export and import

**Export saved game** (IMP-006, [storage.md §7](storage.md#7-export-and-import)): a list "Export saved
game" of the browser's slots, "*x*: *label* — *date and time*"; the chosen slot is downloaded as
`<saves.exportName>-<x>.zip` ([storage.md §7.1](storage.md#71-export)): "Slot *x* exported: unzip it into the game folder to play it in DOSBox." No
saves: "There are no saved games in this browser."

**Import saved game**: the browser's file chooser (several files; `.zip`, `.dat`, `.sav`, the game's
item, effect and roster extensions, `.txt`, and the extensions of characters another game can
import). Loose files and the files inside ZIPs are taken together:

- saved games `SAVGAM<x>.DAT` with their `CHRDAT` files (and `.GBR`): a slot already holding a save
  asks "Slot *x* already holds a saved game. Replace it?";
- roster characters (`<name>.CHA/.ITM/.SPC` with `charlist.txt`; CotAB's `.GUY/.SWG/.FX`) and, in
  CotAB, Pool of Radiance characters converted as the original's Add does ([coab/records.md §7](../A-games/coab/records.md#7-por--cotab-transfer)):
  a name already in the roster asks "*Name* is already in the roster. Replace?".

Results: "Imported into slot *x*, *y*; use Load to play." and/or "Added to the roster: *names*.", with
" Skipped: missing *files*." when files were missing; "Nothing imported." when everything was declined;
with nothing usable: "Nothing imported; missing *files*." or "Choose a SAVGAM file (A to J) with its
CHRDAT files, characters (.*CHA* with .*ITM* and .*SPC* and charlist.txt), or a ZIP of them." (the
game's extensions); on an error "Import failed: *message*".

## 2. The ☰ menu

Opened by **☰ Menu** or Escape while exploring (IMP-057). A panel "Menu" with one button per entry,
each with a quiet second line; **Back to the game** at the foot. In the parchment look (IMP-094,
[app-flow.md §2.2](app-flow.md#22-the-games-screen)) inside the game's frame: the heading in red ink with
a ◆, each entry a ruled row with its name in red small capitals and the second line in ink, **Back to
the game** a charcoal plaque lettered in gold; the panels it opens are the game's EGA windows.

| Entry | Shown | Second line |
|---|---|---|
| **Journal** | the game has a journal | "*n* found", or what the journal holds: "entries, proclamations and tavern tales" (PoR) / "entries and tavern tales" (CotAB) / "entries" (SotSB) |
| **Commissions** (with "•" when due) | the game has commissions (PoR) | "a reward is waiting", or "the City Council's commissions and progress" |
| **Sign in / create account** or **Account: …** | a server answers | "keep your saves on the server and play on any device" / "your saves on the server, sync, password" |
| **Save** | always | "any time, slots A–J" |
| **Settings** | always | "speed, sound, font, borders, motion, text size, graphics" |
| **Rules reference** | always | "classes, races, abilities, combat numbers, spells" |
| **Debug** | always | "not part of the game" |
| **Quit to the party screen** | always | asks Yes/No first ([app-flow.md §7](app-flow.md#7-play-new-game-load-continue)), except after the game ended or in the demo |

A choice closes the menu and runs the entry: §8, §9, [accounts-and-sync.md §6](accounts-and-sync.md#6-the-account-section),
the slot menu ([app-flow.md §7](app-flow.md#7-play-new-game-load-continue)), [ui-contract.md §9](ui-contract.md#9-settings),
§10, §12, [app-flow.md §7](app-flow.md#7-play-new-game-load-continue). Save in the demo does nothing.

## 3. The character sheet

The original's View screen and its items menu ([town.md, "Items menu"](../A-games/engine/town.md#items-menu-o-fun_4894_0ef8),
"View menu") in one wide panel (IMP-041, IMP-027, IMP-062, IMP-058). Opened by a tap on the current
card, V or C, camp View, a shop's or temple's or treasure's View, and the battle's View (with
`combat` set: no spells, no money trade).

### 3.1 Layout

- **Head**: the combat icon; the name; "*Gender* *Race* · age *n* · *Alignment*", "*Class* · level
  *a*/*b* · *Status*". On Quick (not an NPC): "On Quick: the computer plays *Name* in battle." and
  **Play by hand** (outside battles; it clears Quick: "*Name* will be played by hand in battle.") or
  "Space or Take control to play them yourself." (in a battle).
- **Abilities and numbers** (left, or above on narrow screens): STR … CHA; HP "*hp* / *max*", AC,
  THAC0, Damage, Movement, Experience with " · *left* to level *L* *Class* (*needed*)" or " · highest
  level reached"; the seven coins. Each label's tooltip explains it (IMP-058,
  [port-data.md §9](../D-appendices/port-data.md#9-interface-tooltips)).
- **Equipment** (right): **Equipped**, one cell per slot in this order: Weapon, Shield, Armour,
  Gauntlets, Helm, Belt/Necklace, Robe, Cloak, Boots, Ring, Ring, then any other readied item
  ("Ammunition" for arrows and bolts, else "Also readied"); an empty slot shows "—". A cursed item
  whose curse is known is in the NPC colour. **Carried**: the unreadied items, each with "not for this
  class" when the class cannot use it and its weight; "Nothing else." when none. The drag strip "Drag
  an item onto a name to give it:" with the other members' names (with a hovering pointer only).
  "Encumbrance *load* of *capacity* coins" with a bar (high above three quarters).
- Without the `ITEMS` file or `START.EXE`: "Items need the ITEMS file and START.EXE: re-import the
  *FOLDER* folder."
- Then the selected item's preview and actions (§3.2–§3.4), the **Spells** section (§3.5), the
  **Abilities** section (§3.6), the money buttons (§3.7), and **Close**.

### 3.2 Selecting an item

A tap on an equipped or carried item selects it (a second tap deselects). The preview shows its name,
"*slot* · *n* hand(s) · weight *w*[ · not usable by this class]" and what readying or unreadying it
would change, worked out on copies with the original's rules: "Ready: AC 4 → 2, THAC0 …" or "Unready:
…", "no change to AC, THAC0, damage or movement", or "Can't ready: *reason*" / "Can't unready:
*reason*" (*game text* reasons). With nothing selected: "Pick an item to ready, use, trade or drop
it."

### 3.3 Item actions

Buttons for the selected item, letters in the original's order, the hotkey letter highlighted
(IMP-027): **Ready**/**Unready** (R), **Use** (U, not in a shop, temple, treasure screen or the vault, as
the original's game modes allow it; SotSB's vault in DOSBox), **Trade** (T, when the party has another member),
**Drop** (D), **Halve** (H), **Join** (J), and in a shop or temple **Sell** (S) and **Id** (I). Each
runs the original's routine ([town.md, "Items menu"](../A-games/engine/town.md#items-menu-o-fun_4894_0ef8));
its message stays on the sheet (highlight colour) and the item stays selected where it still exists.

| Action | Flow (questions are *game text*) |
|---|---|
| Ready / Unready | the item's handlers run (Gauntlets of Ogre Power, alignment-bound weapons …); their messages and the reason when refused |
| Trade | "Must be unreadied" for a readied item; a scroll marked for scribing first asks "*Name* was going to scribe from that scroll / is it Okay to lose it?" (Yes / No); then "Trade with Whom?" with the other members and Exit; result "Traded to *Name*." or the refusal |
| Drop | the same unready and scribing checks; "Your *item* will be gone forever. Drop It?" Yes / No |
| Sell (shop, temple) | not for a readied item, nor an NPC in play ("NPCs cannot sell"); the scribing check; "I'll give you *n* gold pieces for your *item*. Is It a Deal?" Yes / No; then "Sold!" or the money message |
| Id (shop, temple) | "For 200 gold pieces I'll identify your *item*. Is It a Deal?"; "Not Enough Money", "I can't tell anything new about your *item*", or "It looks like some sort of *item*" |
| Halve, Join | at once; Join with nothing to join: "Nothing to join." |
| Use | §3.4 |

### 3.4 Use (outside battles)

The original's Use (`FUN_4894_1a8a`): an unreadied item says "Must be Readied"; an item with no spell
"Nothing happens."; with several spells (a scroll) "Cast which spell?" lists them with Exit; a
combat-only spell asks "That Item is a combat-only item... Use it?" (Yes uses it up: "The item is used
up."); a spell on one target asks "Cast *Spell* on:" with the party and Exit; then "*Name* uses an
item" goes to the log, the spell is cast by the original's rules (D2 dice), its messages go to the log
and the sheet, and a charge or scroll spell is spent.

### 3.5 Spells (casting outside battles)

IMP-062: the original's Cast (camp and main menu, `FUN_3f81_04a1`) on the sheet. Shown outside
battles when the character has spells ready: a **Spells** heading and one button per ready spell,
"*Spell*" with "×*n*" for repeats, its tooltip what the spell does (IMP-058). Combat-only spells
(side byte 0) are shown greyed with "(combat)" and "Only in combat. …". The whole row is greyed with the
reason "cannot cast spells in this area" (ECL 0x49E5 ≠ 0) or "*Name* is in no condition to cast any
spells" (not Okay), *game text*. A tap casts: on the caster, on the party, or, for a spell on one
target, "Cast *Spell* on:" with the party and **Cancel**. Messages go to the log and the sheet.

### 3.6 Class abilities

For CotAB's paladin ([coab/records.md §10](../A-games/coab/records.md#10-creation-effects-and-paladin-abilities-o)),
outside battles: an **Abilities** heading with **Lay on Hands** and **Cure Disease** when available
([B-model/procedures.md](../B-model/procedures.md), `rules/abilities`). A tap asks "*Ability*: heal
whom?" or "… cure whom?" with the party and **Cancel**; Cure Disease on someone not diseased asks
"*Name* is not diseased. Cure anyway?" (OK / Cancel). Results go to the log and the sheet.

### 3.7 Money

**Trade money** (not in battles, nor for an NPC in play) and **Drop money**, shown when the character
has coins (the original's View menu, [town.md, "View menu: money, Detect, scroll warning"](../A-games/engine/town.md#view-menu-money-detect-scroll-warning-o-decoded-2026-10-17)):
Trade asks "Trade to?" (the party, Exit), then both ask "Select type of coin" (each coin type held
with its amount, Exit), then "How much *coin* will you *trade/drop*?" with a number (default all) and
**OK** / **Exit**. While coins remain the coin list comes back, as the original loops. In a shop,
temple or treasure screen dropped coins go to the pool.

## 4. Treasure

After a won battle (the view shows `PIC<block>` #1, the chest) and for a script's treasure without
monsters: the original's treasure screen ([town.md, "Treasure screen"](../A-games/engine/town.md#treasure-screen-o-fun_2e08_0ecd))
as one wide panel "Treasure" (IMP-056, IMP-029). When there is neither money nor an item the panel is
skipped.

| Part | Content |
|---|---|
| party | one button per member: name, a load bar (highlight above 90 %), "*load*/*capacity* · move *n* · *k*/16 items"; tooltip "Coins go to the one selected"; the selected member is the current character |
| Coins | "Each coin counts 1 towards the load. Take gives the selected character the amount; Share splits all coins evenly; Pool gathers the party's coins here." Then per coin type present: the name, the amount, a number field (default all) and **Take**, with " slows them" when taking it all would lower the selected member's movement |
| actions | **Share evenly** (with coins), **Pool the party's coins**, **Detect Magic (*Name*): magic items get a \*** (when a member who is Okay has Detect Magic ready and there are items), **Take all…** (with coins or items) |
| Items | a table Item / Weight / Give to: each item's name with "usable by *names*" or "no one in the party can use it", and "better for *Name*: AC 5→3, …" for each member who can use it and would gain by readying it; per member a button with the first word of the name: greyed with the reason when they cannot take it ("OverLoaded", "cannot take things now" for one not Okay, the item limit), dashed when they cannot use it, "↓" and the highlight colour when it would slow them |
| — | "Nothing left." when everything is taken; the last message; **Done** |

Results: "*Name* takes *n* *coins*.", "*Name* takes *item*.", "Shared; what nobody could carry is
still here." or "Shared.", "The party's coins are pooled here.", "Magic items now show a *."; refusals
as the game words them ("OverLoaded").

**Take all…** (not in the original): a suggested split, "A suggested split (not in the original): each
item to someone who can use it and gains most, else to whoever has most room; coins shared evenly as
Share does. Change anything, then confirm." — one drop-down per item ("leave it" or a member) and the
coins "shared evenly"; **Confirm** gives each item as chosen (high indices first, each by the normal
take rule; those that no longer fit are reported "No room for: *items*.", else "Done.") and then runs
Share; **Cancel** returns. The split's rule is [B-model/procedures.md](../B-model/procedures.md)
(`proposeSplit`): per item, among members who can use it and are Okay, the one whose readying gain
is largest; else the member with the most spare capacity.

**Done** with something left shows "These will be left behind:" and the list, with **Leave them**
(main) and **Go back**; the original's question is "There is still treasure left. Do you want to go back
and claim your treasure?" (*game text*). Leaving clears the treasure. Without the panel (a build MAY
offer the original's menus) the treasure menu is the game's pieces as part A: VIEW TAKE POOL SHARE
(money), VIEW TAKE POOL (items only) or VIEW POOL EXIT, then DETECT EXIT or EXIT; TAKE with both asks
MONEY ITEMS EXIT.

## 5. Shops and temples

Opened by a script's COMBAT with the shop or temple flag ([B-model/host-contracts.md §2](../B-model/host-contracts.md#2-the-script-host-io)).
They use the play screen: text in the log, menus on the command bar, the cards to choose whose turn
it is (IMP-029). The pool (the money laid down here) starts empty.

### 5.1 The menus

Each round prints "*Name* has *n* gp in coins." (a new block) and offers (*game text*, the original's
order): shop BUY VIEW [TAKE] POOL [SHARE] APPRAISE EXIT; temple HEAL VIEW [TAKE] POOL [SHARE] APPRAISE
EXIT (TAKE and SHARE only while the pool holds money). VIEW opens the sheet (§3) with Sell and Id.
Without `ITEMS` or `START.EXE`: "The shop needs the ITEMS file and START.EXE: re-import the *FOLDER*
folder." (and "The temple needs …").

### 5.2 Buy

One wide panel "Buy" (IMP-042; buying is the original's, [town.md, "Shop"](../A-games/engine/town.md#shop-o-fun_2f70_053e)):

- the party as buttons (the buyer is highlighted; a tap changes buyer and current character);
- "*Name* has **n** gp in coins · *m* gp in the pool · carrying *load* of *capacity*";
- filters **All**, **Weapons**, **Armour**, **Other**, and the box "Only what *Name* can use";
- a table: Item (with "not for this class"), Price, Weight, "If readied instead" (what readying it in
  place of the same-slot item would change, or "can't ready: *reason*", "no change"), **Buy** — greyed
  with the reason ("OverLoaded" and the other take refusals, "Not enough money" when neither the buyer's
  coins nor the pool cover it); "Nothing here." when the filter leaves nothing;
- the last message ("*Name* buys *item*.", also printed in the log; "Not enough money."); **Done**.

Weapons are items of slot 0 and the ammunition types; armour slots 1–9; the rest Other.

### 5.3 Heal

The temple's services from the game's table (names read from `START.EXE`, PoR nine, CotAB ten; kinds
and prices from the profile), as a vertical list "Healing for *Name*:" with EXIT (from the list's
"Heal Exit"). A service the
character does not need asks "*Name* is not blind. cast cure anyway:" (and "is not Diseased.", "is not
poisoned.", "is not dead.", "is not cursed.", "is not stoned."); then "*Service* will only cost *n* gold
pieces. pay for cure?"; "Not enough money." or the cure and "*Name* is cured." All *game text*; the
procedure is [town.md, "Temple"](../A-games/engine/town.md#temple-o-fun_2d14_0d09).

### 5.4 Take, Pool, Share, Appraise

- **TAKE**: "Select type of coin" lists the coin types in the pool (largest first) with EXIT; then "How much
  *coin* will you take?" and a number; the take rule's message (the game's words, strings.md §4).
- **POOL**, **SHARE**: at once, then "The pool holds *coins*." (or "nothing").
- **APPRAISE** ([town.md, "Appraise"](../A-games/engine/town.md#appraise-o-fun_4c2d_19b2)): "No Gems or
  Jewelry", or "You have a fine collection of: *g* Gems, *j* pieces of Jewelry" with GEMS (when there
  are gems) / JEWELRY (when there is jewelry) / EXIT; one is taken and valued ("The Gem is Valued at *n* gp."); "You can :" SELL, or SELL KEEP when
  it can be carried (IMP-028: a kept gem is always added).

### 5.5 Leaving

EXIT with money in the pool asks the game's question ("As you Leave the Shopkeeper says, "Excuse me
but you have Left Some Money here." Do you want to go back and get your Money?", the temple's with a
priest); Yes returns to the menu, No leaves and the pool is lost, as the original.

### 5.6 The vault (SotSB)

A script's COMBAT with its vault flag set ([B-model/script-vm-map.md](../B-model/script-vm-map.md), `combatVault`)
opens the vault: VAULT.DAT's coins and items become the pool, a line "In the vault: …" (or "The vault is
empty.", the port's), and the game's menu "View", " Take" while the vault holds anything, " Pool Exit"
(*game text*, SotSB 0x21EC5). View opens the sheet with **Deposit** for Drop (the game's word): an item
goes into the vault at once, as the original's (no question; DOSBox), coins with
**Deposit money**; Take and Pool as the treasure screen's. Exit writes the pool back to the vault's file
([storage.md §3.2](storage.md#32-the-party-and-the-seed-flag)); the coins stay in the pool as in the
original (**I**: 0x222C3 frees only the item list).

## 6. Camp

Encamp, PROGRAM 9 (an inn's rest) and scripts open the camp ([camp-and-time.md](../A-games/engine/camp-and-time.md));
the view shows `PIC<block>` #29, the campfire, animated. On entry and exit pending memorisations
without the time to learn them are cleared. "The party makes camp..." starts a new block.

### 6.1 The camp menu

"Camp:" and the game's camp menu (*game text*): CotAB's SAVE VIEW MAGIC REST ALTER FIX EXIT; Pool
of Radiance's SAVE VIEW MAGIC REST ALTER EXIT with the port's FIX before EXIT (IMP-048). Save is the
slot menu; View the sheet (§3); Exit leaves. The cards choose the current
character. Without `START.EXE` and `ITEMS`: "The camp needs START.EXE and ITEMS: re-import the
*FOLDER* folder."

After Save (or a cancelled save) comes the original's question "Quit TO DOS" YES NO (*game text*;
PoR `FUN_3f81_1e6f`, CotAB 0x322D0): Yes ends the game there and goes to the party screen, the port's
way out (there is no DOS); No goes back to the camp menu.

### 6.2 Magic

"Magic:" CAST MEMORIZE SCRIBE DISPLAY REST EXIT. Each spell activity first checks the character
("cannot cast spells in this area", "*Name* is in no condition to *cast any spells / memorize spells /
scribe any scrolls*", *game text*).

### 6.3 Cast

"Spells in Memory:" as a vertical list of the ready spells in capitals, each with what it does (IMP-058),
and EXIT; "*Name* has no spells memorized". A combat-only spell: "*Spell* is a combat-only spell..."
and "Lose it?" (Yes forgets it). A spell on one target: "Cast *Spell* on:" with the party and EXIT.
The list returns after each cast.

### 6.4 Memorize

One wide panel "Memorize" (IMP-043; the rule is `FUN_3f81_090a`'s):

- the casters of the party who are Okay, as buttons (selects the current character);
- per spell class the character has slots in ("Cleric spells", "Druid spells", "Magic-User spells",
  the class's name from the game's spell classes; a SotSB ranger's druid slots read "Druid"), per level "Level
  *L*" with "*used* of *total* slots": the slots as chips, **ready** (game-text colour), **pending**
  (highlight, "✕", tap to clear; tooltip "Pending: tap to clear") and **empty** (dashed); below, that
  level's book spells the character knows as "+ *Spell*" buttons (tooltip: what it does), greyed when
  no slot of that level is free; "No spells of this level in the book." when none;
- "*Name* cannot memorize any spells." for a non-caster;
- "*n* spells to learn: rest *h* h *m* min to memorize them (Rest in the camp menu)." or "Nothing
  pending.";
- messages ("No free slot of that level."); **Clear pending** (when any) and **Done**.

### 6.5 Scribe

The original's lists ([camp-and-time.md, "Scribe"](../A-games/engine/camp-and-time.md#scribe-o-fun_3f81_0b5b)):
"Spells to be scribed: …" with "Scribe These Spells?"; "Spells on Scrolls:" with "(MARKED)" for marked
ones and EXIT; "You already know that spell", "You are already scibing that spell", "You can not scribe
that spell.", "*Name* has no copyable scrolls" (all *game text*).

### 6.6 Display

"Display: *names*" or "Display: <No Spell Effects>" (a new block): the effects named as the original's
Display names them (`FUN_3f81_0fbc`: a spell's name for the spell effects, the fixed names otherwise,
"Funky--*n*" for a spell effect without a spell). The cards' effect badges use the same names.

### 6.7 Rest

The duration prompt "Rest Time: *dd*:*hh*:*mm*" (*game text*) with the game's seven words: PoR REST
DAYS HOURS MINS INC DEC EXIT (DAYS on Y), CotAB REST DAYS HOURS MINS ADD SUBTRACT EXIT (IMP-030).
DAYS, HOURS and MINS select the field, shown in brackets ("00:04:[15]"; MINS at first); the fourth
and fifth words change it by a step (a day, an hour, 5 minutes); REST starts, EXIT leaves. Each change
redraws the prompt's line in the log rather than adding one, as the original redraws its line (a menu
asked `again`, explore's `menu`); so do "Camp:" and "Magic:" when they come back with nothing printed
since. The time
starts at the longest preparation time of the party; days at most 99. REST runs the rest loop ([camp-and-time.md, "Rest loop"](../A-games/engine/camp-and-time.md#rest-loop-o-fun_4b46_0c9a))
quickly, the cards and location line refreshed every hour of game time, with **Stop resting** on the
command bar; messages (healing, spells learned, an encounter) go to the log. An interrupted rest
leaves the camp (`campInterrupted`).

### 6.8 Alter

"Alter:" ORDER DROP SPEED ICON PICS EXIT:

- **ORDER**: "Party Order: Select" (the game's prompt and "Select Exit") with the party and EXIT, then
  "*Name* has been selected" with UP, DOWN (the port's words) and EXIT from the game's "Place Exit"
  (IMP-030; dragging a card does the same, IMP-065).
- **DROP**: the last member: "The last character cannot leave the party here." (IMP-031); otherwise
  "Drop from party?" Yes: "*Name* bids you farewell" or "*Name* is dumped in a ditch"; No: "Breathes A
  sigh of relief" (*game text*).
- **SPEED**: "Game Speed = *n* (0=fastest 9=slowest)" with FASTER (above 0), SLOWER (below 9), EXIT,
  as the original offers them (`FUN_3f81_1a97`, CotAB 0x3191B).
- **ICON**: the combat icon editor (§1.6) on the selected character.
- **PICS**: "Monster pictures and portraits are always shown here." (IMP-031: the original's toggles
  are not offered).

### 6.9 Fix

CotAB's own command ([coab/camp.md §1](../A-games/coab/camp.md#1-fix-o-0x320d8); the procedure with
the profile's cures, [B-model/procedures.md §12.4](../B-model/procedures.md#124-the-camps-fix)); in
Pool of Radiance the port's word and the same procedure with Cure Light Wounds alone (IMP-048). With
no wounds nothing happens. Otherwise the party rests at once, without the duration prompt or a Stop
button, as long as the clerics' slots would take to learn again (shortened when the wounds are
small), and is then healed by the dice of their memorised cures and of one cure per slot, in party
order. Nothing is cast or used up. The rest's own lines (natural healing, spells learnt, an encounter)
go to the log, and an interrupted rest leaves the camp. The original prints nothing of its own; the
port then says what Fix did (IMP-086): "No one needs healing." with no wounds; "The party rests *2 hours
15 minutes* and heals *n* hit points." when it healed (the minutes actually rested); otherwise "No one in
the party can heal: Fix needs healing spells memorised or a cleric with spell slots." Nothing is added
after an interrupted rest.

## 7. Script screens

Most of the game's town and dungeon "screens" are scripts: text in the log, menus on the command bar,
pictures in the view ([ui-contract.md §6](ui-contract.md#6-the-text-log)). The port adds nothing to
them except where listed here.

### 7.1 Encounters

The encounter menu (ENCOUNTER_MENU) is the game's: COMBAT, WAIT, FLEE, PARLAY or ADVANCE; the sprite
approaches in the view (IMP-020, IMP-021, IMP-014, [exploration-view.md §3](exploration-view.md#35-encounter-sprites)).
Parley and the other choices are script menus.

### 7.2 Locked doors

A move into a locked door offers the original's "Locked." menu (Bash, Pick, Knock, Exit; *game text*,
[maps-and-view.md, "Movement"](../A-games/engine/maps-and-view.md#movement-o-fun_3e76_0d6d-fun_55a0_0350)).
A move into a wall plays the bump and adds the note "Blocked." (IMP-008).

### 7.3 Pictures and portraits

[exploration-view.md §5](exploration-view.md#5-pictures-and-the-picture-layer).

### 7.4 Shops, temples, inns, taverns, City Hall

Shops and temples: §5. An inn's rest is the camp (§6) through PROGRAM 9. Taverns, the City Clerk, the
harbour master and the like are script text and menus; what they reveal for the Journal and the
Commissions panel is noted in the log (§8, §9). The area map marks them (IMP-024,
[exploration-view.md §6.2](exploration-view.md#62-landmarks)).

### 7.5 The treasure chest

§4.

### 7.6 Training hall

PROGRAM 0 opens the original's party screen inside the game (IMP-032;
[input-and-menus.md §2](../A-games/engine/input-and-menus.md#2-party-screen-fun_417f_0161),
[chargen-and-progression.md, "Training"](../A-games/engine/chargen-and-progression.md#training-o-fun_417f_29ae)),
in the play screen: each round prints "*Name* is selected (choose from the party list)." (a new
block) and offers "Choose a function:" with the party screen's functions as the game names them
(CREATE NEW CHARACTER, DROP CHARACTER, MODIFY CHARACTER, TRAIN CHARACTER, in CotAB HUMAN CHANGE CLASSES
when the selected character may change class, VIEW CHARACTER, ADD CHARACTER TO PARTY, REMOVE CHARACTER FROM PARTY, SAVE CURRENT GAME, BEGIN ADVENTURING; each on its first letter,
named below by that word); the cards
select the character. Load is not offered (this screen never empties the party).

| Function | Behaviour |
|---|---|
| CREATE | the creation panel (§1.1), with the engine's dice; the character goes to the roster: "*Name* has been created. Use Add to put them in the party." |
| DROP | not the last member ("The party needs at least one character."); "*Name* will be gone forever. Drop this character?"; "*Name* has been dropped." (the roster keeps a copy only if it had one) |
| MODIFY | as §1.2, then the items recomputed |
| TRAIN | the training check; refused with the game's message; else "*Name* will become:" and the new levels, "Do you wish to train?" YES NO, "Congratulations...", and for a magic-user with new spells "Spells to choose from:" (IMP-028 when the list is empty) |
| HUMAN (CotAB) | dual-classing ([procedures.md §7.2](../B-model/procedures.md#72-dual-classing)): offered for a human who never changed class; no class allowed: "*Name* doesn't qualify."; else "Pick New Class" and a vertical list of the allowed classes, then Exit; a class: the change, "*Name* is now a 1st level *Class*." and the cards redrawn; Exit: nothing |
| VIEW | the sheet (§3) |
| ADD | the party full ("The party is full."); else the roster list (§1.3) |
| REMOVE | not the last member; the character is written to the roster with its items and effects: "*Name* leaves the party (still available to Add)." |
| SAVE | the slot menu |
| BEGIN | back to the game; the view comes back |

Without `START.EXE`: "The party screen needs START.EXE: re-import the *FOLDER* folder."

## 8. The Journal

IMP-055; data and reveal rules in [port-data.md §4](../D-appendices/port-data.md#4-the-journal), storage
of the finds in [storage.md §6](storage.md#6-journal-finds-and-the-gbr-sidecar). A wide panel
"Journal":

- tabs, each only when the game's journal has that kind: **Entries (*n* of *N*)**, **Proclamations
  (*n* of *N*)** (PoR), **Tavern tales (*n* of *N*)** (PoR, CotAB), **Background (*N*)** (CotAB, SotSB,
  always shown in full); with "Show everything" on the counts are "(*n*)";
- the tab's finds in order (proclamations by numeral): "Journal entry *n*" (": *title*" after it when
  the entry has its printed heading, SotSB) with its paragraphs and
  its scans (alt text "Map from journal entry *n*"); "Proclamation *id*" with the journal's preface;
  "Tavern tale *n*"; or the tab's empty text ([port-data.md §4.3](../D-appendices/port-data.md#43-empty-tab-texts));
- the box "Show everything, like the printed journal (some entries are false; the original asked you
  not to read ahead)" (not kept between openings of the game);
- the credit "Text and maps from the *source name*, CC BY-SA." linking to the source (new tab); "and
  maps" only when an entry has scans, ", CC BY-SA" only when the source has a licence (not SotSB's);
  **Close**.

## 9. Commissions

PoR only (profile `commissions`; IMP-023, IMP-039; data and states [port-data.md §5](../D-appendices/port-data.md#5-the-commissions-panel)).
A panel "Commissions":

- one row per listed commission or deed: the state ("Reward due", "Summoned" in the highlight colour,
  "Open" in game-text colour, "Failed", "Closed" quiet) and the title, with its detail ("Go and see
  *who*", "Reward waiting: see the City Clerk", "The rescue was bungled") and its progress line;
- none yet: "No commissions yet. The City Clerk in City Hall awards them.";
- "Graveyard bounty: *n* undead slain and not yet paid for. See the City Clerk." when owed;
- "Proclamations to read in the Adventurer's Journal: *list*." once the proclamation wall was read;
- **Close**.

The **☰ Menu** button and the menu's entry carry a highlight "•" while a reward is due, someone has
summoned the party, or a bounty is owed.

## 10. Rules reference

IMP-058. A wide panel "Rules reference" with tabs **Basics**, **Classes**, **Combat**, **Spells**,
**Keys** (the last tab chosen is kept while the page lives): Basics, Classes, Combat and Keys show the
profile's `rulesText` as entry–text pairs ([port-data.md §2](../D-appendices/port-data.md#2-rules-reference));
Spells lists, per caster class and level ("*Class* level *L*"), each book spell with its composed
description ([port-data.md §1](../D-appendices/port-data.md#1-spell-notes)); without `START.EXE`:
"The spell list needs START.EXE among the game files." **Close**.

## 11. Settings and Account

[ui-contract.md §9](ui-contract.md#9-settings) and [accounts-and-sync.md §6](accounts-and-sync.md#6-the-account-section).
The Account section also opens as its own panel from the party screen's Account button and from ☰.

## 12. Debug

IMP-025, not part of the game. A panel "Debug" with "Not part of the game. Now: block *b*, area *a*,
*x*,*y* facing *Facing*" (or "wilderness *x*,*y*"):

- **Edit characters…** (outside battles; "abilities, HP, experience, levels, money, items");
- the finale, when the profile has one (both games): **Play the ending** and **Fight *foe*** with its note
  ([port-data.md §6](../D-appendices/port-data.md#6-debug-jumps-and-finale)): jump to its square, run
  its script at `ending` or `fight`, then re-enter the area unless the game ended; notes "Debug: the
  ending, as after *foe* falls." / "Debug: the battle with *foe*.";
- the profile's jumps as buttons;
- a jump form: Block (from 1), Area (from 0; no upper bound, as SotSB has areas past 63: the record
  check below refuses what is not there), X (0–43), Y (0–35), Facing, **Jump**; for a game with a tile
  wilderness "For areas *list* (wilderness), X and Y are the area's own position (0–12 across)." A
  jump to an area that does not exist: "There is no area *a* in block *b*."; else "Debug: jumping to
  block *b*, area *a*." and the engine's `jump` ([B-model/host-contracts.md §3.1](../B-model/host-contracts.md#31-life-cycle));
- **Close**.

In a battle the panel offers only **Win this battle** ("every enemy falls; experience and treasure as
for a won fight"): every enemy falls, the battle's pending question is answered, the aftermath runs as
a win ("Debug: battle skipped as won."). The **Debug** button on the battle's command bar opens it
(not in the demo).

**Edit character**: "Debug, not part of the game. Derived values (THAC0, saves, AC, spell slots) are
worked out again on Apply." The party as buttons; a form of Name (15), Status, Alignment, Gender, Age
(1–999); STR … CHA (3–25), STR % (0–100, kept only at STR 18); HP (0–max), Max HP (1–255), Experience
(0–99 999 999); each class level (0 up to the game's cap, "(max *n*)"); the seven coins (0–65 535);
**Apply**. Raising a level the character has rolls its hit points as training does and brings
experience up to that level's minimum; lowering one leaves max HP. Buttons **Heal fully**, **Clear
effects (*n*)**, **Ready memorised spells**, **Learn every magic-user spell**; **Add item**: a weapon,
armour or shield type (types 1–59 but 48, 49 and the game's scroll types) with a plus 0–3, or one of
the game's scrolls ("Mage Scroll (random spells)", "Cler Scroll (random spells)") with its spells rolled
as the treasure builder rolls them (the plus ignored); identified ("No room: 16 items is the most a
character can carry."). Types without a name in the game's ITEMS are left out. Each action's message; the derived statistics recomputed with the
original rules.

## Validation

- Headless Chromium against the reference (2026-10-21, PoR game-file save A): the ☰ menu, Settings,
  the sheet, the area map, the camp menu texts as listed.
- [CONFORMANCE.md](../CONFORMANCE.md), "User interface".

## Open

- The engine messages quoted as *game text* are read by address (C24 done,
  [strings.md](../D-appendices/strings.md)); what the port still words itself is strings.md §6.
