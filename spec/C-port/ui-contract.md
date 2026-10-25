---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# User interface contract

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative** as a behaviour
contract (decision D4): the screen classes and what each holds where, the panels, the command bar,
the complete input map, the text log, dialog conventions, focus, motion and the settings. Exact CSS,
pixel sizes and colour values are **informative** (they describe the reference implementation);
[CONFORMANCE.md](../CONFORMANCE.md) checks the look. Each screen's own states and texts are in
[screens.md](screens.md), the flow between screens in [app-flow.md](app-flow.md), the battle screen
in [combat-ui.md](combat-ui.md).

Everything here is observed in the reference implementation (`web/src/ui/`, `web/src/style.css`,
`web/src/main.ts`, **O**) unless marked; **?** marks an open point, and a **known deviation** is a
place where the reference implementation does not yet do what this file requires.

Texts in quotation marks are the port's own and normative unless marked *game text*: game text is
read from the player's files by address ([D-appendices/strings.md](../D-appendices/strings.md),
decision D1). Every port-authored text is also listed in
[strings.md §3](../D-appendices/strings.md#3-port-texts).

## 1. Principles

- **The original's commands, by mouse, touch and keys** (R5). Every action of the original is
  reachable by pointer alone, and by keyboard alone with the original's keys as the default
  bindings. Nothing needs a hover: what a hover shows, a tap shows too.
- **Presentation only.** The screens draw what the engine and rules report through the host
  contracts ([B-model/host-contracts.md](../B-model/host-contracts.md)) and turn input into the
  original's choices. Where a panel offers a shortcut (Take all, a planned walk, Fix, a drag), it
  runs the original's procedures step by step and changes no rule.
- **Responsive** (R6): the layout adapts to the window (§3) instead of scaling a 320 × 200 picture;
  the original's pictures are drawn with whole-pixel scaling ([rendering.md](rendering.md)).
- **The classic look** (IMP-057): the EGA palette for every colour (§2), square corners, the game's
  own 8 × 8 font and frame tiles by default (two settings switch them off). The exceptions take the
  colours of the games' boxes: the games screen (IMP-093, [app-flow.md §2.2](app-flow.md#22-the-games-screen)),
  and, inside the game's frame, the party screen and the ☰ menu (IMP-094), the port's paper pages
  (Journal, Rules reference, Commissions, the ending, Load; IMP-095), the party screen's tools and the
  Debug panels (IMP-096). The play screen, battles, the character sheet, camp, shops, treasure and the
  scripts' screens stay EGA.

## 2. Colours as roles

Every colour on screen has a role. The roles are normative; the reference colours (EGA indices,
[rendering.md §3](rendering.md#3-palettes)) are informative.

| Role | Reference | Used for |
|---|---|---|
| ground | EGA 0 black | page, panels, buttons |
| line | EGA 8 dark grey | button borders, rules between blocks |
| text | EGA 15 white | headings, labels, the selected row |
| quiet | EGA 7 light grey | hints, explanations, disabled reasons, the port's notes in the text log |
| game text | EGA 10 light green | game text in the log, values on sheets and cards, HP at full (the original's colour 10) |
| highlight | EGA 14 yellow | hotkey letters, the main action (a filled button with black text), the current card or choice (border), hurt HP (the original's "yellow when hurt", `FUN_10ba_0973`), pending spells, messages inside panels |
| frame | EGA 11 light cyan | panel borders with Borders = Plain, the location line, the Magic On button, the experience bar |
| NPC | EGA 13 light magenta | NPC names on cards, the Quick badge (the original's highlight/NPC colour) |
| enemy | light red, EGA 12 `#ff5555` | enemies in the turn strip and the info box, the status of a fallen character |
| spells | light blue, EGA 9 `#5555ff` | the spell line on cards |

The translucent fills of the battlefield (reachable squares blue, area-spell squares red), the
selected row tints and the area map's colours ([exploration-view.md §6](exploration-view.md#6-the-area-map))
are the port's and informative.

## 3. Screen classes

The play screen (exploring and battles) has three classes, chosen by the window's shape. The other
screens (games screen, party screen, panels) are single columns that reflow (§3.3–§3.5).

| Class | When (reference breakpoints) | Precedence |
|---|---|---|
| **Phone landscape** (L) | landscape orientation and window height ≤ 520 CSS px | first |
| **Narrow** (N) | width ≤ 760 px, or aspect ratio ≤ 4 : 5 (portrait phones, tall windows) | second |
| **Wide** (W) | everything else | — |

**The surround** (IMP-095): the page behind the play screen is charcoal (`#262626`). Where the window
is wider than 17 : 10 (and over 520 px high), the play screen keeps at most that shape (165 dvh wide),
centred, black inside, with a gold edge either side (a 1-px gold line, 3 px of charcoal, a 1-px darker
gold line); the screen's layout inside is the class's own.

Within W the **Party** setting (§9) chooses the **row** layout (default, IMP-064) or the **column**
layout (the original's arrangement); the column layout has a **very wide** variant at width ≥ 1200 px
and aspect ratio ≥ 4 : 3. A conforming build MAY use other breakpoints as long as a portrait phone
gets N, a phone held sideways L, and a laptop or desktop window W.

### 3.1 Exploring

Six regions: the **view** (§4.2), the **party** cards (§4.1), the **area map** (§4.3), the **text
log** (§6), the **command bar** (§5) and the **pad** (§4.4).

| Class | Arrangement |
|---|---|
| W, row | The party cards in one row across the top, members 1–6 left to right, equal widths, scrolling sideways when they do not fit. Below, the view on the left as a square (about half the height) and the area map on its right, filling the rest of the width at the view's height. Below, the text log across the full width, taking the remaining height. At the bottom the command bar on the left and the pad on the right |
| W, column | The view on the left as a square (about 60 % of the height). On its right a column: the cards stacked, above the area map (the map keeps at least about 40 % of the column). The text log across the full width below; the command bar and pad at the bottom |
| W, column, very wide | as W column, but the cards and the map stand side by side in the right column, the map a square as tall as the view |
| N | The view across the top, nearly square (at most about half the height). Below it a band (about 12 em): the six mini cards in two columns of three on the left, the whole party at once, a small area map on the right. Below, the text log, taking the remaining height. At the bottom the command bar, four buttons to a row stretched across the width, and under it the pad as a row of its own across the width |
| L | The view on the left, a square as tall as the screen (at most half the width). On the right, top to bottom: the mini cards in three columns of two (at most about 44 % of the height), the text log, the command bar and the pad. **The area map is hidden** and **Area** is on the command bar (IMP-061) |

On N and L the cards are **mini cards** (about 0.6 of the text size): the name, the HP bar and the HP
line as "*hp*/*max*" (no "HP" label), nothing else; the portrait, combat icon, AC, experience bar,
weapon, spells and badges are a tap away on the sheet. A name too long for the card is clipped
within it. In the W row the cards are smaller (three quarters of the text size): the name takes the
top line and wraps to a second rather than being cut, AC stands beside HP at the line's right end, the
weapon may take two lines, the combat icon overlaps the portrait's lower right corner (or takes the
portrait's place in a game without portraits), and the spell line is left out.

### 3.2 Battles

The view region shows the battlefield ([combat-ui.md](combat-ui.md)); the area map, the pad and the
location line are hidden; the command bar holds the combat commands with **Take control**, **Magic**
and **Debug** (IMP-033, IMP-054).

| Class | Arrangement |
|---|---|
| W, row | the cards row across the top; the battlefield across the full width; the text log (at most about a fifth of the height); the command bar |
| W, column | the battlefield on the left; on the right a wider column of cards (about 22–30 em; 26–34 em with large text) |
| N | the battlefield on top (nearly square, at most about half the height), a short band of cards that scrolls, the text log, the command bar |
| L | the battlefield on the left; on the right a column (at least 14 em, at most 40 % of the width) of cards, text and commands |

### 3.3 The party screen and the games screen

Single centred columns ([app-flow.md §2](app-flow.md#22-the-games-screen),
[§4](app-flow.md#5-the-party-screen)): the games screen at most about 40 em wide; the party screen
at most about 60 em, with its header, the party cards in as many columns as fit (each at least
about 17 em), a one-line message area, and the function groups (buttons in as many columns as fit,
each at least about 13 em).

### 3.4 Panels

Panels are modal dialogs (§7) at most about 46 em wide and 90 % of the height; **wide** panels
(creation, sheet, shop Buy, treasure, Memorize, rules reference) up to about 76 em and 97 % of the
width. Their content scrolls inside.

### 3.5 Other breakpoints (informative)

| When | Change |
|---|---|
| width ≤ 900 px | character creation: its three sections in one column |
| width ≤ 760 px | character sheet: abilities above the equipment instead of beside |
| width ≤ 700 px | asset viewer: the family list becomes a drop-down |
| width ≤ 640 px | shop Buy: the "If readied instead" column is hidden |
| width ≤ 600 px | rules reference: entry above its text |
| width ≤ 30 em | account forms: labels above the fields |
| no hover (touch) | the sheet's drag strip is hidden (the Trade button remains) |
| coarse pointer | every button, number and text field at least 44 CSS px high (IMP-060) |

## 4. Regions of the play screen

### 4.1 Party cards

One card per party member, in party order (IMP-045, IMP-061, IMP-063):

| Part | Content |
|---|---|
| portrait | head over body (`HEAD3`/`BODY3` through the game's portrait tables); none in a game without portraits (CotAB) |
| combat icon | the ready pose ([rendering.md §6](rendering.md#6-combat-icons)); for an NPC that fights under a combat picture (CotAB's and SotSB's ADD_NPC), that picture's first frame, a 48-pixel one fitted to the 24 × 24 cell, as on the battlefield |
| name | in the NPC colour for an NPC |
| AC | "AC *n*" (tooltip: what AC means, [port-data.md §9](../D-appendices/port-data.md#9-interface-tooltips)) |
| HP bar | HP as a share of max HP; highlight colour below half; empty when down |
| experience bar | progress to the next level for the class that levels soonest: the one experience total against each class's table, from the current level's threshold to the next (IMP-063); highlight colour when a training hall would train them now; full at every class's level cap. Tooltip: "*xp* XP: *left* to level *L* *Class* (*needed*)", "*xp* XP: ready to train as a level *L* *Class*", or "Every class is at its highest level" |
| HP line | "HP *hp*/*max*" (game-text colour at full, highlight when hurt), or the status word when not Okay or Animated, then " (Helpless)" when the character has effect 0x1F, 0x33, 0x34 or 0x35 (the original's side panel, `FUN_10ba_09e3`) |
| weapon | the readied weapon's name |
| spells | "✦ " and the memorised spells ready to cast, repeats as "*Name* ×*n*" |
| badges | **Quick** when on computer control (not for NPCs; tooltip "The computer plays them in battle. Open their sheet and choose Play by hand, or press Space / Take control in a battle"); one badge per active effect, named as camp Display names them ([screens.md §6.6](screens.md#66-display)); **Ready to train** |

**States**: *current* (highlight border, tinted ground: the engine's current character); *hurt* (HP
line in highlight); *down* (dimmed); *dragging* and *drop here* (§8.4).

**Input**: a click or tap selects the member (makes it current); on the current card it opens the
character sheet ([screens.md §3](screens.md#3-the-character-sheet)); the tooltip says "Select
*name*" or "View *name*". While a shop, temple, treasure, camp or training-hall screen runs, a tap
selects whose turn it is (IMP-029). While a script runs or a menu waits outside those screens, taps
on cards are ignored. Outside battles a card can be dragged onto another's place (§8.4).

### 4.2 The view region

Holds one of: the 3D view ([exploration-view.md](exploration-view.md)), the tile wilderness
([exploration-view.md §4](exploration-view.md#4-the-wilderness-views)) or the battlefield; over it
the picture layer (pictures, portraits, BIGPIC, the cleared view) and, in CotAB, the sky layer
([exploration-view.md §5](exploration-view.md#5-pictures-and-the-picture-layer)). A picture
replaces the whole view, as in the original: around a square picture the region is black.

The **location line** sits in the view's bottom left corner (frame colour):

- in a map area: "*Facing* · *x*,*y* · *clock*[ · Searching]", the position left out where the area
  refuses the area map (ECL 0x49FB ≠ 0), as the original's status line hides it
  ([camp-and-time.md, "Status line"](../A-games/engine/camp-and-time.md#status-line-o-fun_1000_34ab));
- in the tile wilderness: "Wilderness · *x*,*y* · facing *Facing* · *clock*[ · Searching]".

*Facing* is North, East, South or West ([port-data.md §8](../D-appendices/port-data.md#8-interface-labels));
*clock* is the original's status-line time.

### 4.3 The area map

On screen beside the view in W and N (IMP-022): the area's whole 16 × 16 map, redrawn on every move
([exploration-view.md §6](exploration-view.md#6-the-area-map)). Where the area refuses the map (ECL
0x49FB ≠ 0) and in either wilderness the region says "Not here." instead. A click or tap opens the
large view (the **Area** command). With a hovering pointer the tooltip is the landmark's text under
the pointer, else "Area map (click to enlarge)".

### 4.4 The pad

Four buttons (IMP-003, IMP-026) beside the command bar while exploring; hidden in battles and the
demo; greyed and inert while a script runs or a menu waits.

| Button | Map area: label, accessible name | Tile wilderness |
|---|---|---|
| left | ⟲ "Turn left" | ◀ "West" |
| up | ▲ "Forward" | ▲ "North" |
| right | ⟳ "Turn right" | ▶ "East" |
| down | ▼ "Turn around" | ▼ "South" |

## 5. The command bar

The bottom row of the play screen. One of these sets at a time:

| Context | Contents |
|---|---|
| exploring, nothing pending | **Area** (class L only), **Encamp**, **Search** (drawn "on", highlight border, while searching), **Look**, **☰ Menu** (followed by a highlight "•" when a commission reward or summons waits, PoR) |
| a script menu | its items as buttons ([§6.3](#63-menus-and-prompts)) |
| a single-item prompt | one wide main button |
| a vertical menu | nothing (the list is in the text log) |
| resting in camp | **Stop resting** |
| the demo | **Leave demo** only (tooltip "Escape: back to the party screen") |
| a battle | the combat commands ([combat-ui.md §4](combat-ui.md#4-the-command-row)), **Take control** (while anyone is on Quick), **Magic: On/Off**, **Debug** |

Every command shows its label with its hotkey letter (the first) in the highlight colour. **View**
and **Area** are not on the bar while exploring (IMP-061): a card opens the sheet, the map is on
screen; the keys V and A still work, and Area is on the bar in class L. **Cast** is not on the bar
(IMP-062): the key C opens the current character's sheet, which casts. Everything that is not a game
command is behind **☰ Menu** (IMP-057, [screens.md §2](screens.md#2-the--menu); tooltip "Journal,
commissions, save, settings, rules, quit (Esc)").

The original's command line ("Area Cast View Encamp Search Look", [main-loop.md, "Command menu"](../A-games/engine/main-loop.md#command-menu-o-fun_3e76_0989))
is thus split: Encamp, Search, Look on the bar; Area on the map; View on the cards; Cast on the sheet.

## 6. The text log

The original's six-line text window as a scrolling log (IMP-008).

### 6.1 Blocks

- Each **screen** of text is a block: `print(text, clear)` with `clear` (PRINT_CLEAR, a new menu
  screen) starts a new block. A block is created at its first line, so an empty clear leaves no
  trace.
- Each text is a line, except a PRINT with `run` ([host-contracts.md](../B-model/host-contracts.md),
  `print`): it is added to the line the last PRINT left open, so a text a script prints in pieces
  (SotSB's "A SIGN OVER THIS DOOR READS " "'" "HALL OF TRAINING" ".'") reads as one line.
- At most **120** blocks are kept; the oldest goes first.
- The newest block is at full brightness, the earlier ones dimmed (IMP-057). The log scrolls to its
  end on every line; the player may scroll back.
- Game text is in the game-text colour, the port's notes (§6.2) in the quiet colour (italic with
  the modern font).
- Raw font glyphs (PRINT_LIST without a cleared view: the rune passwords) are drawn inline, white
  on black, at the text's height.

### 6.2 The port's notes

Lines the port adds, never game text: "Blocked." (a forward move into a wall, IMP-008, after the
original's bump sound); "Loaded: *label*."; "A new game: Begin Adventuring from the party screen.";
"Game saved in slot *x*."; the journal notes ([port-data.md §4.4](../D-appendices/port-data.md#44-what-reveals-an-entry));
"Debug: …" lines; "Script error: *message*" and "Combat error: *message*" (the screen stays usable);
and the messages of missing files ("… needs START.EXE …"). "Not Here." for a refused Area command is
the original's answer (*game text*). The full list: [strings.md §3](../D-appendices/strings.md#3-port-texts).

### 6.3 Menus and prompts

`Io.menu(items, { prompt, vertical })`:

- The **prompt** goes into the log (game text).
- **Horizontal** menus: one button per item on the command bar, the label as the game gives it,
  its first letter the hotkey (IMP-010). Focus goes to the first button.
- **One item**: the main action, a wide filled button. The continue prompts the games use
  ("PRESS <RETURN> OR BUTTON TO CONTINUE", "PRESS <ENTER>/<RETURN> TO CONTINUE", CotAB's "PRESS BUTTON
  OR RETURN TO CONTINUE.", *game text*, matched
  exactly, [port-data.md §8](../D-appendices/port-data.md#8-interface-labels)) are labelled
  **Continue**.
- **Vertical** menus (VMENU, spell and item lists, save slots): full-width buttons at the end of the
  current block; the command bar is empty meanwhile. An item MAY have a quiet second line (what a
  spell does, IMP-058).
- While a menu waits the pad is disabled and the exploration commands are ignored.

**Answering** (equivalent): a click or tap on the item; its first letter (the first item whose label
starts with it, case ignored); a digit 1–9 for the *n*-th item; for a single item also Enter, Space,
or a tap on the view. A menu has no cancel of its own: the game's Exit item, where the game has one,
is the way out.

**Input fields** (INPUT_NUMBER, INPUT_STRING, amounts): a field at the end of the current block with
**OK**; Enter submits. A number field accepts up to 6 characters; on reading, non-digits are dropped,
empty is 0, and the value is at most 65 535. A text field takes up to 40 characters, shown in
capitals. The entered text is echoed into the log.

### 6.4 Pauses and "press any key"

Script pauses (PAUSE, CALL frame) and the battle's holds last game speed × the game's unit
([B-model/host-contracts.md §7](../B-model/host-contracts.md#7-timing)). **A key, click or tap ends
the current pause** (IMP-012, IMP-037) when no menu waits; that key does nothing else. The original's
"press any key" points are menus of one item (above).

## 7. Dialogs

Every panel is a modal dialog with the same conventions (IMP-057):

- a **✕** button in its top corner ("Close (Esc)"); Escape closes it too, as does its own footer
  button (Close, Done, Back to the game);
- one dialog at a time; while one is open the play screen ignores its own keys and commands (the
  battle's input routing aside, [combat-ui.md §5](combat-ui.md#5-input));
- inside a dialog, buttons with a hotkey answer to it: **Y**/**N** for Yes/No, **E**/**K** for
  Exit/Keep, **R** for Reroll; on the party screen a digit 1–9 picks the *n*-th entry of a list;
- a Yes/No question has **Yes** as the main action; closing it by ✕ or Escape answers No; a list
  closed by ✕ or Escape answers Cancel or Exit;
- **Escape backs out of menus the same way** (the play screen's menu line and lists, IMP-081): it
  chooses the menu's **Exit** (the game's own word, as its aim menu has it), answers **No** when the
  menu is the game's Yes and No, continues a **one-choice** prompt, and for a menu the original leaves
  on any other key (Alter's level, the Save slot question) gives no choice. A menu with none of these
  (a story choice, the spells a level brings) ignores Escape. In a battle, while moving, Escape drops a
  planned path or undoes the last step ([combat-ui.md §5](combat-ui.md#5-input));
- an action's result appears inside the panel (highlight colour) and the panel stays open; panels
  that change state as you work (sheet, shop, treasure, Memorize) redraw in place, and the cards with
  them.

## 8. Input map

Keys are `KeyboardEvent.key` values. A key with Ctrl, Meta or Alt held is ignored unless listed; a
key typed into a text field belongs to the field. Every key, click and tap also unlocks the browser's
audio (sound may start only after a gesture). **Ctrl-S** turns the sound off and on again on every
screen, as the original ([audio.md §2](audio.md#2-device-choice)).

### 8.1 Exploring (nothing pending, no dialog, no script running)

| Input | Action |
|---|---|
| ArrowUp, 8 | forward (tile wilderness: north) |
| ArrowLeft, 4 | turn left (wilderness: west) |
| ArrowRight, 6 | turn right (wilderness: east) |
| ArrowDown, 2 | turn around (wilderness: south) |
| A | Area: the large area map, or the note "Not Here." |
| V, C | the current character's sheet (C: casting is there, IMP-062) |
| E | Encamp |
| S | Search on or off |
| L | Look |
| Escape | the ☰ menu |
| pad buttons | as the arrows |
| tap on the 3D view | left third: turn left; middle: forward; right third: turn right (IMP-003) |
| tap on the wilderness view | one step towards the tap: along the axis on which the tap is furthest from the party's square (IMP-026) |
| click or tap on the area map | the large area map |
| tap on a card | select; on the current card, its sheet (§4.1) |
| drag a card onto another | reorder the party (§8.4) |

A movement key or pad button pressed **while the view still slides** from the previous step ends
the slide at once and takes the new step as soon as that step's scripts are done (IMP-066); holding
a key repeats as fast as the scripts allow. Other commands wait for the step to finish.

### 8.2 While a script runs

| Input | Action |
|---|---|
| any key; a click or tap on the view | ends a running pause (§6.4) |
| a menu's letters, digits, Enter or Space, taps | answer the menu (§6.3) |
| movement keys | queued behind a finishing slide (above); otherwise ignored |

### 8.3 The demo (IMP-074)

| Input | Action |
|---|---|
| Escape; **Leave demo** | leaves the demo for the party screen at once |
| any other key; a click or tap on the view | ends a running pause |

No pad, no Debug, no ☰ ([app-flow.md §6](app-flow.md#6-the-demo)).

### 8.4 Drags

- **Party order** (IMP-065): outside battles, and not while a script runs or a menu waits, a card
  dropped on another card's place moves that member there one step at a time by Alter → Order's rule
  ([camp-and-time.md, "Alter"](../A-games/engine/camp-and-time.md#alter-o-fun_3f81_1c59)). The
  dragged card is dimmed, the card under it outlined. On touch screens Alter → Order is the way.
- **Give an item** (IMP-059): on the character sheet, a carried item dropped on a name in the strip
  "Drag an item onto a name to give it:" is traded to that member by the Trade rules
  ([screens.md §3.3](screens.md#33-item-actions)). Only with a hovering pointer.

### 8.5 Controllers (IMP-090)

A gamepad with the browser's standard mapping works on every screen without screen code of its own
(`ui/gamepad.ts`): it is read every animation frame while one is connected (from its
`gamepadconnected`, i.e. the first button pressed on it), and turned into the keys the screens already
answer, sent as `keydown` events from the focused element (Space from the page body).

| Control | Sends | Then |
|---|---|---|
| D-pad, left stick (past half way) | ArrowUp / Down / Left / Right; two together the diagonals PageUp (up-right), PageDown (down-right), End (down-left), Home (up-left), the battle's ([combat-ui.md §5](combat-ui.md#5-input)) | an arrow that no screen takes (no `preventDefault`) moves the focus to the nearest visible control that way (distance along the direction plus twice the distance across); a diagonal nobody takes does nothing |
| A | a click on the focused control; with none focused (or a text field), Enter | |
| B | Escape (§7) | if no screen takes it and a dialog is open, the dialog closes as the browser's Escape would (`requestClose`, else its `cancel` event and `close`) |
| X | Space | |
| Y | "v" (the character) | |
| LB / RB | the previous / next control in page order | |
| Right stick | scrolls the open dialog, else the page | |
| Start | ☰ (the Menu button) when it is shown and no dialog is open; otherwise as B | |
| Select | the battle's **All on Quick** / **Take control** button when shown ([combat-ui.md §10](combat-ui.md#10-quick-and-magic)) | |

The controls reachable are the visible, enabled ones of the open dialog, else of the page. With nothing
focused, the first one is the game's menu (the prompt's first choice), else a primary button, else the
first in page order. Directions and LB / RB repeat when held: after 380 ms, then every 150 ms. While the
controller is in use the focused control has a 3 px ring in the accent colour (`.pad :focus`); a mouse,
touch or real key press ends it. Settings shows a **Controller** row (§9).

### 8.6 Other contexts

Battles: [combat-ui.md §5](combat-ui.md#5-input). Games screen, title, party screen, ending:
[app-flow.md](app-flow.md) §2–§7.

## 9. Settings

One Settings panel (IMP-046): ☰ → Settings in play, ⚙ Settings on the party screen. A change applies
at once (Graphics after a reload). Each setting is kept per browser in localStorage
([storage.md §8](storage.md#8-localstorage-keys)) and written only when the player changes it (an
untouched browser uses the defaults). With an account the settings travel with it
([accounts-and-sync.md §5.9](accounts-and-sync.md#59-settings)): the panel reports a change when it
closes.

| Row | Choices (default first) | Key and values | Effect |
|---|---|---|---|
| **Game speed** (in a game only) | **Faster**, the value, **Slower**; 0–9; hint "0 fastest, 9 slowest: how long messages and hits hold in combat and scripts" | none: game state, saved with the game | ECL 0x49FC, the same value as Alter → Speed and combat Speed |
| **Sound** | **PC speaker**, **Tandy / PCjr**, **Off**; without `START.EXE` the row says "needs START.EXE among the game files" | `poolrad.sound`: `pc`, `tandy`, `off` | the device ([audio.md §2](audio.md#2-device-choice)); choosing PC speaker or Tandy plays effect 10 as a sample |
| **Font** (when the game font was built) | **Original 8×8**, **Modern** | `poolrad.font`: `original`, `modern` | IMP-038, [rendering.md §5](rendering.md#5-the-game-font) |
| **Borders** (when the frame tiles were built) | **Original**, **Plain** | `poolrad.frames`: `original`, `modern` | IMP-051, [rendering.md §4](rendering.md#4-frames) |
| **View** (when the browser has WebGL 2) | **Original**, **Enhanced (3D)** | `poolrad.view`: `original`, `enhanced`; unset: `enhanced` | the original's drawn view, or the WebGL view (D6, IMP-001, [exploration-view.md §1](exploration-view.md#1-the-two-views)); applies at once, in play too; without WebGL 2 always the drawn view |
| **Party** | **Row across the top**, **Column beside the view** | `poolrad.partylayout`: `top`, `side` | IMP-064, §3 |
| **Motion** | **Full**, **Reduced (no flashing)**; unset: the system's reduced-motion preference | `poolrad.motion`: `full`, `reduced` | §10 |
| **Screen** | **Clean**, **Scanlines**, **CRT** | `poolrad.screen`: `off`, `scanlines`, `crt`; unset: `off` | IMP-089: an overlay over the page and over every open dialog (`body::after`, `dialog[open]::after`, `pointer-events: none`): Scanlines a dark line (32 %) every 3 px; CRT a slightly darker line, an RGB phosphor grille (1 px stripes, 5 %), corners darkened from 55 % of the way out, canvases at saturate 1.15 / contrast 1.06 / brightness 1.06 and a faint glow on text. Nothing flickers or moves |
| **Text size** | **Normal**, **Large** | `poolrad.textsize`: `normal`, `large` | text of the play screen, party screen, panels and title at 1.2 × (game font 16 → 24 px) |
| **Graphics** | **Pixel (original)**, **Sharp (even pixels, soft fit)** | `poolrad.gfx`: `pixel`, `sharp` | IMP-047, [rendering.md §2](rendering.md#2-scaling); read once per page load. While the stored choice differs from the running one: "The graphics change takes effect when the page reloads." **Reload now** "(save first if you are in a game)" |

Then **Controller** (IMP-090, nothing to choose): the name of the connected controller and what its
buttons do (§8.5), or "none connected: plug one in or press a button on it".

Below the rows: the **Account** section when a server answers
([accounts-and-sync.md §6](accounts-and-sync.md#6-the-account-section)), the version line
([pwa-and-build.md §6](pwa-and-build.md#6-the-version-stamp)) and **Done**. The settings are one set
for every game ([storage.md §8](storage.md#8-localstorage-keys)).

## 10. Motion, focus and accessibility

- **Reduced motion** (Motion = Reduced, or unset with the system preference "reduce") leaves out the
  title's lightning and the river cleansing's partial passes (IMP-057). The view's slides, the sprite
  glide and the battle's flights still run (they carry information) and a key cuts them short.
- **Focus**: a new horizontal menu focuses its first button, a new input field takes focus, a panel
  focuses its first control (creation: the name). The keyboard focus is the highlight border.
- **Names for assistive technology**: the text log is a polite live region "Messages"; the regions
  are "3D view", "Party", "Area map", "Commands", "Movement"; the pad buttons and colour swatches have
  names; the title screen is a button "Continue".
- Game-font text is drawn at whole multiples of 8 px and without font smoothing
  ([rendering.md §5](rendering.md#5-the-game-font)).

## Validation

- [CONFORMANCE.md](../CONFORMANCE.md), "User interface": a person goes through it with the build
  running, in each class (W row, W column, N, L), with a mouse, with touch and with the keyboard only.
- Observed in the reference with headless Chromium at 1400 × 900 (W row), 1300 × 850, 1000 × 800,
  400 × 820 (N) and 820 × 400 (L), PoR's game-file save A (2026-10-21).

## Open

- The party screen's 600-px rule hides columns of a member table that no longer exists (the members
  are cards since IMP-045): dead CSS ([AUDIT.md](../AUDIT.md) §6.9, UI7).
