# Improvements over the original

Every deliberate departure from the 1988 DOS game is listed here, so the port's behaviour can always be traced back to the original described in [`spec/`](spec/README.md). The rules of the game are otherwise the original's, bugs included unless they are listed under [Original bugs fixed](#original-bugs-fixed).

IDs are stable: the code refers to them. Status is *done* unless marked. **Setting** means a switch restores the original behaviour.

## Original bugs fixed

Only bugs that destroy the player's money, items or characters are fixed. Every other known bug of the original is kept on purpose and documented where it happens (e.g. [`spec/combat.md`](spec/combat.md), "Bugs").

| ID | Fix | Original |
|---|---|---|
| IMP-028 | A payment reads all of a character's coins | Reads the value as 16 bits and loses anything above 65 535 gp ([`spec/town.md`](spec/town.md), "Money") |
| IMP-028 | A gem or jewel kept after appraisal is always added | Lost when the character carries no items ([`spec/town.md`](spec/town.md), "Appraise") |
| IMP-028 | A magic-user level with no new spell to choose leaves max HP alone | Sets max HP to 1 ([`spec/progression.md`](spec/progression.md)) |
| IMP-031 | Alter → Drop refuses to drop the last character | Offers to quit to DOS ([`spec/camp.md`](spec/camp.md), "Alter") |
| IMP-049 | After ROB takes items, the victims' AC, THAC0 and damage are recomputed | A stolen readied item keeps counting until something else recomputes them (`FUN_2fea_1df0`, [`spec/ecl.md`](spec/ecl.md), ROB) |

A switch back to the original behaviour is planned for IMP-028.

Related: IMP-034 brought the Lightning Bolt path and bounce, Stinking Cloud squares, the AI's weapon choice and the rake/hug follow-ups in line with the original, bugs included (a bolt shortened by its cumulative cost at each creature, coming straight back off a wall). Its one departure: "The air clears a little..." is not printed when a cloud caster's effect runs out after the battle, as the cloud went with the battlefield (the original prints it whenever effect 0x28 expires; **I** whether it does without a cloud, [`spec/effects.md`](spec/effects.md)).

## Screen and layout

| ID | Change | Original |
|---|---|---|
| IMP-004 | Responsive layout keeping the original arrangement (view, party to the right, text below, commands at the bottom); on wide screens the area map sits beside the roster, on narrow ones the panels stack. *In progress* | Fixed 320 × 200 screen ([`spec/graphics.md`](spec/graphics.md), "Screen layout") |
| IMP-045 | The party as cards. Party screen: portrait, combat icon, race and class, levels, AC, status, HP bar. During play: portrait, icon, name, AC, HP bar, HP or status, readied weapon, spells ready to cast, active effects (named as camp Display names them) and "Ready to train". A tap selects, a second tap opens the sheet (IMP-009) | A list of names; while playing, rows of name, AC and HP; in combat a side panel for the one acting: name, "Hitpoints" (light green at full, yellow when hurt), AC, readied weapon, then its status or "(Helpless)" (`FUN_10ba_09e3`). The cards keep those colours and "(Helpless)" ([`spec/graphics.md`](spec/graphics.md), "Party roster") |
| IMP-008 | Scrollable message log: each `PRINT_CLEAR` starts a new block (last 120 kept); short notes for blocked moves ("Blocked.", "Locked."). *In progress* | A six-line window that clears; a bump sound only |
| IMP-022 | The area map is always on screen and updated on every move; click it for the large view. It shows the whole 16 × 16 map with open and locked doors in their own colours; "Not here." where the original refuses the map | Area swaps the 3D view for an 11 × 11 window round the party, walls only ([`spec/maps.md`](spec/maps.md), "Overhead map") |
| IMP-024 | Landmarks on the area map, read from the area's script: shops by kind (general store 🛒, arms and armour 🛡, jeweller 💎, silversmith 🥈), temples by god, inn, taverns, City Hall, harbour, training halls, gateway; the square's text as a tooltip, a legend on the large map | Walls only; the printed manual has a map of New Phlan |
| IMP-038 | The interface uses the game's own 8 × 8 font, built in the browser from the player's `8X8D1.DAX` (#201) and drawn at 16 px; capitals only, like the original. **Setting**: modern font | All text from the 8 × 8 glyphs on the 40 × 25 grid ([`spec/graphics.md`](spec/graphics.md), "Font") |
| IMP-047 | Sharp scaling: every picture is enlarged 4× by whole pixels, so each original pixel stays an even square, and only the last stretch to the screen is smoothed; applies after a reload. (Scale2x was tried and dropped: it smears the EGA art into blobs.) **Setting**: Pixel (default) | The 320 × 200 EGA pixels |
| IMP-050 | The title screens show "Press any key or tap to continue" below the picture | No prompt ([`spec/menus.md`](spec/menus.md), "Start-up sequence") |
| IMP-051 | The panels (view, party, map, text, dialogs) are framed with the original's rope border: the yellow corner square and red rope tiles of `8X8D1` #202 (20–22), built in the browser from the player's file and stretched around panels of any size; the panels touch and share their dividing lines, so each is drawn once. **Setting**: Borders, Original rope (default) or Plain | The same tiles around the fixed 40 × 25-cell screen layout, with a yellow square where frames meet (`FUN_13f1_0000`, frame style 0) |
| IMP-052 | The after-battle summary (outcome, treasure, experience) is its own block in the text window, with a Continue button, while the battlefield stays in view | A framed window over the whole screen, "press <enter>/<return> to continue" (`FUN_2e08_0916`, [`spec/combat.md`](spec/combat.md), "Aftermath") |
| IMP-046 | One Settings panel (command bar and party screen): game speed, sound device, font, text size (normal or large), graphics | Speed in camp Alter or combat Done; sound device in the installer's `POOL.CFG`; one font and size |

## Controls

| ID | Change | Original |
|---|---|---|
| IMP-003 | Mouse and touch everywhere; in the 3D view a movement pad and tap zones (left third turns left, middle moves, right third turns right). *In progress* | Keyboard only |
| IMP-010 | Script menus are buttons (the first letter is still the hotkey); one-item "PRESS <RETURN>" prompts are a Continue button (Enter, Space or a tap); vertical menus are tappable lists. *In progress* | A keyboard menu line on row 24 ([`spec/ecl.md`](spec/ecl.md), HMENU/VMENU) |
| IMP-012 | Script pauses (game speed × 225 ms) can be cut short with a click, tap or key. *In progress* | Pauses always run to the end |
| IMP-029 | In shops, temples and the treasure screen the roster picks whose turn it is; stock, services and the pile are tappable lists | Home/End select the character; key-driven lists |
| IMP-026 | The 5 × 5 wilderness view fills the view panel; the pad shows compass arrows, and a tap towards a side of the party walks that way | Keyboard only; a 120-pixel view ([`spec/overland.md`](spec/overland.md)) |

## Exploration and presentation

| ID | Change | Original |
|---|---|---|
| IMP-001 | A real 3D view built from the GEO maps, with smooth movement and turning. *In progress*; a classic view may follow | An 88 × 88 view assembled from pre-drawn tiles ([`spec/maps.md`](spec/maps.md)) |
| IMP-007 | The 3D scene has ambient and directional light, a sky colour, a grey floor and distance fog; walls use the nearest front-wall piece of each wall type as a texture. *In progress* | Flat background bands (`FUN_55a0_0174`, colours at `DS:6A60–6A63`) and pre-drawn walls per distance |
| IMP-011 | Script-driven moves (e.g. Rolf's tour) animate between squares. *In progress* | Each `CALL 0x2C90` jumps to the new square |
| IMP-020 | Encounter sprites stand in the 3D scene beyond the centre of their square, never beyond the first wall in view; near walls the distances are spread so each step still shows. The most detailed frame is used at every distance, shrunk by perspective | A smaller frame per distance at a fixed spot in the 88-pixel view ([`spec/graphics.md`](spec/graphics.md), "Encounter sprites") |
| IMP-021 | A sprite stepping closer (`APPROACH`, Advance) glides to its new place over 0.45 s | Redrawn with the next frame in one go |
| IMP-035 | When the party is destroyed (in or out of combat), "The END!" is followed by Continue, which returns to the start to load a game | "Press any key", then the main loop with an empty party (**?** what follows, [`spec/combat.md`](spec/combat.md), "Results") |
| IMP-036 | The ending plays in a dialog: the `FINAL` pictures scaled up, captions below; a click or key skips an animation | Full-screen pictures and text ([`spec/architecture.md`](spec/architecture.md), "Ending") |

## Characters and party

| ID | Change | Original |
|---|---|---|
| IMP-040 | Character creation on one screen: race, gender, class and alignment as buttons (forbidden choices greyed out with the reason), the rolled abilities and HP with Reroll and −/+ within the Modify ranges, AC, THAC0, age and gold, and the name, portrait (both directions) and combat icon beside them. Changing race, gender or class rolls again; alignment does not | One question at a time; roll until kept; portrait forward only; Modify a separate command ([`spec/chargen.md`](spec/chargen.md), [`spec/menus.md`](spec/menus.md)) |
| IMP-017 | The combat icon editor is one panel: head, weapon and size with arrows, each part's two colours from a 16-colour palette, old and new icons side by side | Nested menus and a closing "Is this icon ok?" ([`spec/menus.md`](spec/menus.md) §4.2) |
| IMP-018 | Modify shows every ability with −/+ and its allowed range; arrow keys still work | A cursor on the character sheet ([`spec/menus.md`](spec/menus.md) §4.1) |
| IMP-041 | The character sheet shows equipment by slot (weapon, shield, armour, gauntlets, helm, belt/necklace, robe, cloak, boots, two rings, ammunition, other) beside the carried items; items the class cannot use are marked; picking one shows what readying or unreadying it would change (AC, THAC0, damage, movement) or why it cannot be done; encumbrance as a bar | View, then Items: one key-driven list with a Yes/No ready column ([`spec/town.md`](spec/town.md), "Items menu") |
| IMP-027 | The items menu's actions (Ready, Use, Trade, Drop, Halve, Join; Sell and Id in shops) are buttons on the sheet, with letters in the original's order; Use asks for the spell and target with buttons | A key-driven menu |
| IMP-016 | Created characters are kept in browser storage (the roster), seeded once with the characters in the imported files | `<name>.cha/.itm/.spc` files and `charlist.txt` ([`spec/menus.md`](spec/menus.md) §2.2) |
| IMP-019 | Load is always available on the start-up party screen and lists browser saves and the saves that came with the game files | Load only while the party is empty ([`spec/menus.md`](spec/menus.md) §2) |
| IMP-032 | A training hall opens the full party screen (Create, Drop, Modify, Train, View, Add, Remove, Save, Begin); Remove keeps the character in the roster; Load is not offered there, as that screen never empties the party | Load only with an empty party, which Remove and Drop can reach |

## Town and camp

| ID | Change | Original |
|---|---|---|
| IMP-042 | A shop's Buy is one panel: choose the buyer, filter the stock (weapons, armour, other, usable only), see price, weight, whether the class can use it and what readying it instead of the current item would change; Buy greyed out with the reason (no room, overloaded, cannot pay). Buying itself is the original's | A list of names and prices for the current character ([`spec/town.md`](spec/town.md), "Shops") |
| IMP-043 | Memorize is one panel: each class and level shows its slots (ready, pending, empty) beside that level's spells in the book; a tap memorises, pending ones can be cleared, and the rest needed is shown as you go | The spell book picked one at a time, then "Memorize these spells?" ([`spec/camp.md`](spec/camp.md)) |
| IMP-030 | Resting runs quickly with a Stop button; the rest time is set with +/− for days, hours and minutes; Alter → Order moves a character with buttons | A real-time countdown until a key is pressed; Home/End and cursor keys |
| IMP-048 | **Fix** in the camp menu, from *Curse of the Azure Bonds* on: the clerics cast Cure Light Wounds on the most wounded, memorise it again and rest just long enough to learn it, until everyone is healed or nobody can heal; resting can still be interrupted. Every step uses the original rules | Healing by hand: Memorize, Rest, Cast for each wound; Fix arrived with the later Gold Box games |
| IMP-031 | Alter: Icon points to the party screen's editor; Pics (monsters and portraits off) is not offered (the Drop fix is under [bugs](#original-bugs-fixed)) | [`spec/camp.md`](spec/camp.md), "Alter" |
| IMP-023 | A Commissions panel: each commission offered (open, summoned with who to see, reward due, failed, closed), one-off deeds, the unpaid graveyard bounty and the proclamation numbers once read; a dot on the button when something is waiting. Offers seen are kept with browser saves | No quest log: only the City Clerk reports, and proclamations are numbers to look up in the printed journal ([`spec/commissions.md`](spec/commissions.md)) |
| IMP-039 | The panel shows progress where the game keeps a count: slum fights won (of 25), Kovel Mansion thieves beaten (of 21), undead destroyed, documents handed in | As IMP-023 |

## Combat

| ID | Change | Original |
|---|---|---|
| IMP-033 | The battle screen (drawing the original's combat visuals: action poses, missiles, spell bolts, sparkle, starburst, skull, cursor tile) takes the view and the area map's place, the roster a wider side column; as many cells as fit (at least 7 × 7) with the original tiles and icons, centred on whoever acts; commands are buttons; moving by keys or a tap on a neighbouring square; Aim lists the targets in range or takes a tap on the battlefield; area spells take a tap on any square. *In progress* | A 7 × 7-cell battlefield (168 × 168 pixels) on the left, keyboard menus and a cursor; Aim's Next/Prev slides the cursor tile from target to target, which the target list replaces ([`spec/combat.md`](spec/combat.md)) |
| IMP-044 | A tap further away plans the cheapest walk within the movement left and shows its cost; a second tap walks it through the normal rules. Pointing at or tapping a combatant shows its condition (exact HP for the party, a rough word for monsters, plus helpless, coughing, charmed). A strip shows the round and who still acts, highest initiative first | One step per key; nothing beyond the messages; no turn order shown |
| IMP-037 | The original pacing by game speed (messages, missile and spell flights, sparkle and starburst, the skull, [`spec/combat.md`](spec/combat.md), "Pacing" and "Combat visuals"), but a click, tap or key cuts a wait short; each step waits 0.1 s with or without sound | Waits run to the end; with sound off, steps had no wait and their pace depended on the PC |

## Sound

| ID | Change | Original |
|---|---|---|
| IMP-013 | Effects from the original driver data in the player's `START.EXE`, emulated tick by tick, played without pausing the game | `PlaySound` busy-waits about 0.1 s ([`spec/sound.md`](spec/sound.md)) |
| IMP-015 | The sound device (PC speaker, Tandy/PCjr, off) can be changed at any time in Settings; the Tandy chip is emulated (noise approximate). **Setting** | Chosen once in the installer (`POOL.CFG`); Ctrl-S mutes |
| IMP-014 | A footstep each time an encounter sprite approaches. *In progress* | `APPROACH` is silent |

## Saving and platform

| ID | Change | Original |
|---|---|---|
| IMP-002 | Save anywhere: Save in the command bar writes slot A–J in the original layout. *In progress* (quicksave to come; changes difficulty, so a setting is planned) | Saving only from camp and the party screen ([`spec/camp.md`](spec/camp.md)) |
| IMP-006 | Saves export and import as the original files: Export writes `SAVGAM<x>.DAT` and each member's `CHRDAT<x><n>.SAV/.ITM/.SPC` in one ZIP; Import takes them loose or zipped (a DOSBox folder works) and asks before replacing a slot; it also takes roster characters, `<name>.CHA/.ITM/.SPC` with `charlist.txt`, into the roster | Files in the game folder |
| IMP-005 | Runs offline as an installable web app or a single file; the game files are imported once and kept in the browser. *In progress* | A DOS program reading its folder |

## Development

| ID | Change | Original |
|---|---|---|
| IMP-025 | A Debug menu: jump to the wilderness landings, New Phlan's pier, or any block, area and position, as a script's `NEW_ECL` would (anything scripts do on the way is skipped; a jump to the wilderness clears the inside-a-lair flag). During a battle it offers only **Win this battle**: every enemy falls at once and the aftermath runs as for a won fight (experience, treasure, the scripts see a win). Not part of the game | Developer cheats only (`START STING`, [`spec/architecture.md`](spec/architecture.md)) |
