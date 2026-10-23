# Host contracts and randomness

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

The rules (the script VM, the exploration loop, combat, effects, camp, town) run **headless**: they
reach the player only through interfaces that a host implements. The browser's screens are one host
(part C); a test harness or a command-line runner is another. This file defines those interfaces,
the engine's public entry points, timing, and the one injected source of dice that makes two builds
comparable roll for roll (D2). A conforming build MAY organise its code differently, but its rules
MUST make the same requests of their host, in the same order, with the same results.

## 1. Layers

| Layer | Contract it offers | Contract it uses |
|---|---|---|
| the engine (ECL VM and exploration loop) | §3 | the script host `Io` (§2), the dice source (§6) |
| combat (`fight`) | §4.1 | the combat host `CombatUi` (§4.2), the engine, the dice source |
| effects and spells | the behaviours ([vocabularies.md](vocabularies.md)) | the effect host `FxHost` (§5) |
| screens (part C) | `Io`, `CombatUi` | §3, §4.1 |

The rules MUST NOT read the clock, the DOM, storage or any random source other than §6, and MUST
NOT depend on how long a host takes to answer.

## 2. The script host (`Io`)

The engine calls `Io` while scripts and the exploration loop run. Methods that return a promise are
**waits**: the engine does nothing else until the host answers. Methods marked optional MAY be absent;
the engine then does nothing for that call.

| Method | Called when | The host MUST |
|---|---|---|
| `print(text, clear, run?)` | PRINT, PRINT_CLEAR, NEWLINE, engine messages | show the text in the text window; `clear` starts a new screen of text (PRINT_CLEAR, a new menu screen). `run` comes with PRINT and PRINT_CLEAR only: true when the text goes on along the line the last PRINT left open, which the host MUST then continue (no line break). PRINT leaves the cursor after its text; only PRINT_CLEAR, NEWLINE and the end of the script start a line (O: CotAB 0x1926C, SotSB 0x1E593 set the cursor for PRINT_CLEAR only; the text routine, SotSB 0x58B9, goes to the next row only past the right edge, 0x5B29). Any other text starts a line |
| `menu(items, { prompt?, vertical? })` → index | HMENU, VMENU, ENCOUNTER_MENU, yes/no questions, the "PRESS ENTER" prompt (one item) | offer the items (vertical: a list) with the prompt and resolve to the 0-based choice. While a demo with `keysWait` false runs, resolve at once with 0 |
| `inputNumber()` → number | INPUT_NUMBER | read a number, 0–65 535 (non-digits dropped, empty 0); in a no-wait demo, 0 at once |
| `inputText()` → string | INPUT_STRING | read a line of text; in a no-wait demo, "" at once |
| `picture(p)` | PICTURE, portraits, the view restored | show `{ pic }` (`PIC<block>` record), `{ big }` (`BIGPIC<block>` record), `{ head, body }` (a portrait), or clear the picture (null) |
| `sprite(sprite, picture, distance)` | the encounter sprite (APPROACH, LOAD_MONSTER) | draw sprite record `sprite` at distance 0 (nearest) to 2, or the picture once it is at distance 0 |
| `clearView()` (optional) | after every move, turn and area entry, and on CALL refresh when the view changed | drop whatever scripts put over the view (picture, its animation, the sprite) |
| `refresh()` → done | CALL refresh, area entry, after moves and turns, REDRAW_SCREEN | bring the view up to date with the position, facing, map and wall sets (the engine's state, §3.2), then resolve |
| `sound(n, mode)` | a sound effect of the original's number; `mode` `full` or `transient`, as the original's call site plays it | play it, cut off when `mode` is `transient` and the game has a transient mode ([C-port/audio.md §3](../C-port/audio.md#3-the-cut-off-rule)); 10 footstep, 7 bump, 11 the script effect, all transient |
| `clearTop(on)` (optional) | CLEAR_TOP | blank the view (true) until the script exits (false) |
| `glyphs(codes, at)` (optional) | PRINT_LIST | draw raw font glyphs at a text cell of the cleared view, or inline in the text (`at` null) |
| `river()` → done (optional) | the river cleansing, on entering the cleansed overland area | play the cleansing ([engine/overland.md, "River cleansing"](../A-games/engine/overland.md#river-cleansing-o-fun_4804_06b3)) |
| `pause(ms)` → done | PAUSE, CALL frame | wait `ms` milliseconds (game speed × `ecl.pauseMs`, §7); a host MAY let a key cut it short (IMP-012) |
| `nextFrame()` (optional) | CALL frame | show the current picture's next frame (wrapping to the first) |
| `engine(what, info?)` → done | the engine hands over a built-in screen | run that screen (below) and resolve when it is done |

`engine(what)` values:

| `what` | When | The host MUST |
|---|---|---|
| `combat` (`info`: `monsters` names, `count`) | COMBAT with monsters loaded (or a duel) | run the battle (`fight`, §4.1) and its aftermath, then resolve. A host that resolves without fighting (headless) leaves the engine to treat the party as having won: the monsters leave the list, ECL 0x6DC7 := 0, 0x6DC8 := their number |
| `shop`, `temple`, `treasure` | COMBAT with no monsters, by the shop flag (ECL 0x6E6C), the temple flag (0x6DE2), or money or items in the treasure | run that screen on the engine's treasure money and items ([engine/town.md](../A-games/engine/town.md)) |
| `camp` | Encamp, PROGRAM 9 | run the camp screen; a rest interrupted by an encounter sets the engine's `campInterrupted` |
| `party screen` | PROGRAM 0 | the party screen from inside a script (training, [engine/input-and-menus.md §2](../A-games/engine/input-and-menus.md#2-party-screen-fun_417f_0161)) |
| `ending` | PROGRAM 8 | the game's ending ([profile.md §3.5](profile.md#35-the-ending-endingscript)) |
| `program n` | any other PROGRAM operand (not `ecl.quitProgram`) | nothing the original does is known for it; resolve |
| `party dead` | DAMAGE left nobody in play | "The entire party is killed!" and the game-over flow ([C-port/app-flow.md](../C-port/app-flow.md)); the engine has set `quit` |
| `blocked` | a forward move into a wall (after the bump sound) | MAY show a short note (the port's "Blocked.", IMP-008); the original only plays the bump |

A script error (an opcode with no handler, a jump outside the script) stops the run with an error
that names the address in the game's own numbering ([script-vm-map.md §2.2](script-vm-map.md#22-translation));
a host shows it and stays usable.

## 3. The engine's entry points

### 3.1 Life cycle

| Entry point | Does |
|---|---|
| `new Engine(files, io, dice?)` | an engine over the game's files and a script host; `dice` is the host's dice source (§6), or a number that seeds the reference generator (informative, §6.3) |
| `newGame(party)` | fresh variables (A, B, C zeroed), the party copied in, block and record `ecl.start`, the VM reset |
| `loadSave(dat, party)` | a `SAVGAM<x>.DAT` image and its party: variables, code, position and facing, speed (ECL 0x49FC, at most 9), block (B 0x6E12), area (A 0x49F2), GEO (A 0x49C5), wall sets; a save of area 0 in a game with `ecl.areaZero` loads that record's script instead ([script-vm-map.md §6](script-vm-map.md#6-start-quit-and-other-flags)). The VM is reset when play starts, keeping the saved per-area variables |
| `attachFiles(i, itm, spc)` | member *i*'s item and effect files |
| `start()` | play begins (`FUN_29c3_32f8`): the VM reset if resuming, `on_enter`, `refresh`, and the area entry if `on_enter` changed area |
| `toSave(stems)` | the save image in the game's layout, the engine's globals first copied into ECL variables as the original's save does ([engine/savegame.md](../A-games/engine/savegame.md)) |
| `newDemo(demo)` | fresh variables, no party (nobody current until an NPC joins), the demo's block, record and speed |
| `runDemo()` | the demo record's `on_enter`, then every member leaves; nothing else of the loop runs, nothing is saved |
| `jump(block, area, x, y, facing)` | the Debug panel's jump (IMP-025): as NEW_ECL to that block and area, then the area entry; a tile-wilderness area takes a wilderness position (ECL 0x49C3/0x49C4, 0x4A9E := 0); another area with a `GEO<block>` record of its number has that map loaded first (ECL 0x49C5 := the area, 0x49E6 := 1), which its own LOAD_AREA may replace |

### 3.2 Exploration

| Entry point | Does |
|---|---|
| `command(c)` | one map-area command: `f` forward, `l`/`r` quarter turns (footstep sound), `b` turn round (silent), `s` toggle search, `L` look (10 minutes, `on_step` with search set), `e` encamp ([engine/main-loop.md, "Command menu"](../A-games/engine/main-loop.md#command-menu-o-fun_3e76_0989), "Moving") |
| `travel(dir)` | one overland move on the tile wilderness (12 hours) |
| `enter()` | the area entry loop after an area change (`FUN_29c3_31b4`) |
| `camp(enterAfter)` | Encamp: `camp_menu`, the camp screen, `camp_confirmed` after an interrupted rest |
| `party()`, `addMember`, `dropMember`, `moveMember` | the party list without loaded monsters; Add, Drop and Order |
| `read(a)`, `write(a, v)` | an ECL variable in the canonical numbering |
| state | `block`, `area`, `x`, `y`, `facing2`, `geo`, `walls`, `speed` (0–9), `cur` (the current character), `money` and `treasure` (the treasure pool), `quit`, `areaChanged`, `mapDirty`, `demo`, `campInterrupted` |
| view state | `backdrop` (sky, horizon line and band, floor colours), `skyArt` ([profile.md §3.1](profile.md#31-the-view-viewart)), `overland`, `cityCursor`, `wildPosition` |
| tables | `startImage` (START.EXE's load image or null), `spells`, `items` (ITEMS and name words; names carry "* " while anyone has Detect Magic, effect 5), `wild` |

Autosave points and what is stored are part C ([C-port/storage.md](../C-port/storage.md)); the
engine never saves on its own. A host MUST NOT save while a script is running (between commands
only).

## 4. Combat

### 4.1 Entry

`fight(engine, ui, onReady?)` runs one battle for the engine's loaded monsters: it builds the
battlefield ([procedures.md §15.4](procedures.md#154-battlefields)), places the combatants, calls
`onReady(battle)` (for the host's view), runs the rounds with the surprise value (ECL 0x6DCB, then
cleared) and returns the battle with the aftermath (`share`, `survived`, the messages), or, in a demo
without aftermath, after only the clean-up. Outcomes: `won`, `fled`, `destroyed`, `spared` (nobody won
or fled but ECL 0x6DE6 = 1 kept the party from being destroyed). It needs START.EXE and ITEMS.

### 4.2 The combat host (`CombatUi`)

Presentation calls are **queued**: the rules go on at once, and the host shows each in order, each
held as asked; the rules wait only on the calls that return a promise. The battle's outcome MUST NOT
depend on the queue.

| Method | Kind | Meaning |
|---|---|---|
| `print(text, hold?)` | queued | a combat message; the next is shown only after `hold` (`{ ms, flash? }`: milliseconds, and a combatant to flash meanwhile, the hit display). Default hold: speed × 225 ms |
| `settle()` (optional) | wait | resolves once everything queued has been shown and held |
| `fall(cells, ms, who?)` (optional) | queued | the skull on these cells, sound 5, then a hold of `ms` |
| `pose(f, action)` (optional) | queued | the combatant in its action frame (true) or normal frame |
| `flight(from, to, how)` (optional) | queued | a missile or spell flies cell to cell: `how` = `{ frames, delay, sounds? }` (COMSPR frames, ms per 8-pixel step, the sounds before and after) |
| `effect(f, kind, cycles, holdAfter)` (optional) | queued | the sparkle (an effect took hold) or the starburst (spell or effect damage) at a combatant |
| `redraw(focus?)` | immediate | draw the battlefield as it is now, centred on `focus` when given |
| `show()` (optional) | queued | redraw the battlefield at this point of the queue (the cloud cells) |
| `hold(ms)` (optional) | queued | a pause before what follows |
| `look(at)` (optional) | queued | centre the view on a cell |
| `pause(ms?)` | wait | wait (a host MAY let a key cut it short) |
| `menu(items, { prompt? })` → index | wait | a combat menu |
| `step(f, left)` → direction 0–7, `end` or `undo` | wait | one step of the player's MOVE with `left` movement |
| `command(f, items, prompt, left)` (optional) → direction, `end`, `undo` or `{ choice }` | wait | the command menu with movement live at the same time (IMP-053); without it the player chooses MOVE first, as the original |
| `aim(f, entries, prompt, allowCell, area?)` → entry or null | wait | pick a target among entries (nearest first; each `{ f, x, y, cost, ok, note? }`), or a cell when `allowCell`; `area(x, y)` previews an area spell's squares; null = exit |
| `confirm(prompt)` → boolean | wait | a yes/no question ("Continue Battle:", "Abort spell?") |
| `view(c)` | wait | the character sheet for a combatant (View), returning when closed |
| `sound(n, mode)` | immediate | a sound effect, `mode` as for the script host (§2) |
| `pick(prompt, items, notes?)` → index | wait | a spell or item list; −1 = exit |

The pacing of part A ([engine/combat-rules.md, "Pacing"](../A-games/engine/combat-rules.md#pacing-o))
is the holds the rules ask for; the battle screen is part C ([C-port/combat-ui.md](../C-port/combat-ui.md)).

## 5. The effect host (`FxHost`)

What effect behaviours and spell kinds reach ([vocabularies.md §1.2](vocabularies.md#12-the-host)).
Two implementations: the **battle** (in combat) and the **world host** (exploring, camping,
travelling, the character sheet), whose combat-only parts answer as "not in combat".

| Member | Battle | World host |
|---|---|---|
| `effectsOf(c)`, `itemsOf(c)` | the engine's lists | the same |
| `print(text)` | a combat message (default hold) | the text window, or the caller's message list |
| `roll(n, s)` | the dice source | the dice source |
| `name(c)` | the record's name | the same |
| `all()` | every combatant (party then monsters) | the party |
| `inCombat()` | true | false |
| `distance(a, b)` | squares between their footprints | 0 |
| `targetOf(c)`, `setTarget?` | the combatant's target (combat record +0x0A) | none |
| `current()` | the current combatant (DS:5D92) | the engine's current character |
| `endTurn(c)` | ends its turn | nothing |
| `rec(c, i)`, `setRec(c, i, v)` | combat record byte *i* (clearing +0x0A clears the target) | 0, nothing |
| `setStatus(c, status, msg)` | the set-status routine (PoR `FUN_3723_0058`, CotAB 0x4AAC4): the message; unless already 6, 7 or 8, the status, out of play with 0 HP, going down (`effects.ids.goingDown`, `downRejoins`), event 13, then the fall | the same; the fall is sound 5 |
| `damage(c, dmg, mode, saved)` | the damage routine of part A (event 6, then event 20 when not saved; mode 1 none on a save, 2 half) | the same without the dying count: 0 HP or below is unconscious ("goes down"), below −9 dead ("is killed"); the damage line is printed outside combat too |
| `save(c, type, bonus)` | the save routine (1 fails, 20 succeeds, else d20 + item bonus + bonus, event 12, against the stored save; sets `saved`) | the same |
| `heal(c, n, force)` | the heal procedure in combat (no revive) | the heal procedure (revives the unconscious) |
| `revive(c, hp)` | up with min(hp, max) HP when its square is free ("gets back up", a monster "stands up and grins"); false when taken | up with min(hp, max) HP, "gets back up" |
| `recalc(c)` | the derived statistics | the same |
| `tables()` | START.EXE's tables or null | the same |
| `enemiesNear(c, range)` | enemies in sight within range, nearest first | none |
| `byIndex(i)`, `indexOf(c)` | the combatant list | the party list |
| `attack(a, t)` | one attack sequence | nothing |
| `weapon(c)`, `weaponKind(type)` | the readied weapon, or the ammunition the current attacker fires; ITEMS byte 7 | the readied weapon; the same |
| `sparkle?`, `announce?`, `fly?`, `flyCells?` | the presentation of §4.2 | absent: lines printed plainly |
| `clearCloud?`, `blastZone?`, `aimed`, `cellOf?`, `aimSpell?`, `pickTarget?`, `castAs?`, `boltHit?`, `bolt?`, `fan?` | the battlefield (clouds and the delayed blast, the aimed square, cells, the target hook, the computer's cast, the bolt, the area template) | absent |
| `choose?(prompt, items)`, `ask?(prompt)` | the combat menu and confirm | the script host's menu (Yes/No for `ask`) |

## 6. Randomness: the dice source

### 6.1 The rule (D2)

Every random draw that can change the game state comes from **one injected dice source**, whose
only operation is a **request** `(count, sides)` answered with the sum of `count` dice of `sides`
faces (each 1..`sides`). A request with `count` 0 or `sides` 0 is answered 0 and is still a request.
A Turbo Pascal `Random(n)` draw of the original is the request `(1, n)` minus 1.

The procedures of this specification make their requests in the order they are written, which is
the original's order of calls where observed (part A and [procedures.md](procedures.md) state where
the original rolls a die whose result it then drops: such a request MUST still be made). The sequence
of requests and results of a run is its **dice tape**.

### 6.2 Where the dice are rolled

Every rules module takes its dice from the engine's source: the script VM (RANDOM is `(1, m)` − 1
with *m* = operand & 0xFF, plus 1 below 255; DAMAGE; TREASURE; the encounter and door rolls; ADD_NPC's
portrait), combat (initiative, attacks, damage, saves, morale, the AI, the battlefield generators),
effects and spells, camp (rest encounters), town (temple cures, appraisal), training and character
creation.

| Draw | Status |
|---|---|
| everything above, in the reference's `Engine.roll` | conforming (the reference's tests replace it with scripted dice) |
| `Engine.rand(n)` (RANDOM, a new NPC's id, appraisal's jewels, the training hall's creation, the debug editor) | conforming: `Random(n)` is the request `(1, n)` − 1 made through `Engine.roll` (`rules/dice.ts` `random`); `Random(0)` is the request `(1, 0)`, answered 0, and gives 0 |
| character creation on the party screen (`ui/party.ts`) and in a training hall | conforming: the page has one dice source (`main.ts`), which party-screen creation and every engine the page starts draw from; creation makes the original's requests ([engine/chargen-and-progression.md, "Dice"](../A-games/engine/chargen-and-progression.md#sequence-o)) |
| the title's lightning (`ui/title.ts`), the river cleansing's pixel choice (`ui/explore.ts`), the sound effects' cut-off phase (`audio/sfx.ts`) | presentation only: `Math.random` (informative); the original's river pass is `Random(4)`, which the port leaves off the tape as presentation |
| the sync client's record ids (`store/sync.ts`) | not a dice draw (part C), `Math.random` |

These four are the only `Math.random` calls in the reference implementation (`web/test/dice.test.ts`
checks that no other appears).

### 6.3 The generator (informative)

The original uses Turbo Pascal's `Random` (`FUN_1af8_11c0` in PoR). The reference implementation
seeds a 32-bit xorshift (`s ^= s << 13; s ^= s >>> 17; s ^= s << 5`, unsigned; seed 0 becomes 1;
the default seed is the clock), takes u = s / 2³², and answers a request `(count, sides)` as the sum
of `count` values ⌊u · sides⌋ + 1 (`rules/dice.ts` `generator`); `Random(n)` is a request like any
other (§6.1). Neither is part of the contract: two conforming builds are compared by their tapes, not
their generators.

### 6.4 The tape format

A recorded tape (for [VALIDATION.md](../VALIDATION.md) and [D-appendices/test-vectors.md](../D-appendices/test-vectors.md))
is a JSON document:

```json
{ "format": "goldbox-dice-tape", "version": 1, "game": "por", "draws": [[1, 20, 14], [2, 6, 7], [1, 100, 63]] }
```

`draws` lists every request in order as `[count, sides, result]`. **Recording**: the source appends
each request and its answer. **Replaying**: the source answers each request with the next entry's
result; a request whose count or sides differ from the entry's is a **divergence**: the run MUST stop
and report the entry's index and both requests. A tape that runs out is a divergence too. A tape
with an entry that no dice can give (a result outside `count`…`count · sides`, or not 0 for a count
or sides of 0) is refused before the run. A request of the original that the port leaves out as
presentation (§6.2) is not on the tape.
*Informative:* the reference implementation's recorder and player are `TapeRecorder` and
`TapePlayer` in `web/src/rules/dice.ts`; its unit tests also feed scripted dice through the same
injection point (`Engine.roll`).

## 7. Timing

All of the original's waits scale with the **game speed** (0 fastest … 9 slowest; ECL 0x49FC in a
save; 4 in both shipped saves; the demo's own speed while it runs): PAUSE and CALL frame wait speed ×
`ecl.pauseMs` (PoR 225 ms, CotAB 100 ms), combat messages speed × 225 ms by default, and the other
combat waits of part A's "Pacing". The rules only ask for waits (`pause`, holds); a host performs
them, MAY shorten them on a key (IMP-012) and MAY run them at zero length (headless). The game's
outcome MUST NOT depend on how long a wait lasted.

## 8. The headless harness

A conforming build SHOULD offer a headless runner for the validations of [VALIDATION.md](../VALIDATION.md)
(V3 script runs, V5 seeded battles, V9 view frames): a script host and a combat host that answer from a list of
answers, a dice source fed from a tape, and a **transcript** of what the rules asked for. Two builds
that are fed the same game files, script and tape MUST produce the same transcript, line for line.

### 8.1 The run

A **script** is a JSON object:

| Member | Meaning |
|---|---|
| `game` | the profile id (`por`, `coab`) |
| `save` | the save slot letter: `SAVGAM<x>.DAT` and its party's files from the game folder (default `A`) |
| `jump` | optional `[block, area, x, y, facing]`: the debug jump (§3.1) after play starts |
| `camp` | optional `true`: run the camp screen on the answers (below) |
| `town` | optional `true`: run the shop and the temple on the answers (below) |
| `hall` | optional `true`: run a training hall's party screen on the answers, its Train (the current character) and Begin (below) |
| (option) `frame` | render the drawn view at the end of the run (V9, below) |
| (option) `saveAs` | a slot letter: save the game there, as the Save command writes it, at the camp's Save or else at the end of the run |
| `commands` | what the player does, in order (below) |
| `answers` | the answers, taken in order by every question either host is asked |

The run loads the save (`loadSave`, the party's item and effect files attached), starts play
(`start`), makes the jump if any, then does each command until the commands end or the game quits:

| Command | Does |
|---|---|
| `f`, `l`, `r`, `b`, `s`, `L`, `e` | `command(c)` (§3.2) |
| `travel d` | `travel(d)` on the tile wilderness |
| `monsters id count picture` | loads `count` monsters of record `id` of `MON<block>CHA` as LOAD_MONSTER does |
| `combat` | COMBAT, as a script makes it, with the monsters loaded (an error without any) |
| `cur n` | makes the party's n-th member (from 1) the current character, as Home/End do (`FUN_4894_27df`) |

**Answers.** A menu (of either host, a spell or item list too) takes a 0-based index (−1 = exit in
a spell or item list) or the text of an item (compared trimmed); INPUT_NUMBER a number 0–65 535;
INPUT_STRING a string; a battle step a direction 0–7, `"end"` or `"undo"`; an aim the index of a
target in the list offered (nearest first) or `null`; a yes/no question `true` or `false`. An
answer of the wrong kind ends the run with an error; when the answers run out the run ends there.

**The hosts.** Waits (`pause`, holds) take no time; `refresh` and the presentation calls do nothing.
`engine("combat")` runs the battle (`fight`, §4.1) with the combat host answering from the list
for each party member the player controls (the computer plays the monsters and those on Quick);
nothing follows it (no treasure screen). With `camp`, `engine("camp")` runs the camp screen
(the port's `ui/camp.ts`, with the original's lists and no Memorize panel) on the answers; a
rest runs to its end at once, and Save saves into the `saveAs` option's slot (the save counter first
where the game keeps one, `saves.saveCounter`). `engine("treasure")`, COMBAT without monsters, runs
the aftermath with the party alone (`treasureAftermath`, [A-games/engine/combat-rules.md, Aftermath](../A-games/engine/combat-rules.md#aftermath-fun_2e08_1527)):
its experience is given and its summary transcribed (`summary`); the treasure screen is not. With `town`,
`engine("shop")` and `engine("temple")` run the port's `ui/town.ts` on the answers, with the original's
menus and lists (no Buy panel; View does nothing). With `hall`, `engine("party screen")` runs the party
screen's Train and Begin as the play screen's hall does (any other function is an error). Every other `engine(what)` hand-over (shops and
temples without `town`, the vault, camp without `camp`, the party screen, the ending) is transcribed and
resolves at once.

### 8.2 The transcript

JSON lines, one event per line: an object whose `event` member names the event, then its fields in
the order listed.

| Event | Fields |
|---|---|
| `text` | `text`, `clear` (each `print`) |
| `menu` | `items`, `prompt`, `answer` (the index given), and where the menu has them `keys` (each item's hot keys, `''` for none) and `vertical` (`true`: a list taken with Home, End and Enter): script menus, combat menus, spell and item lists. `tools/dosbox/scriptcheck.py` types the answers into the original from these |
| `input` | `kind`, then: `number`, `text`: `answer`; `step`: `left` (movement left), `answer`; `aim`: `prompt`, `targets` (each `name`, `x`, `y`, `ok`), `answer`; `confirm`: `prompt`, `answer` |
| `picture` | `picture`: the `picture` argument (`{pic}`, `{big}`, `{head, body}` or null) |
| `sprite` | `sprite`, `picture`, `distance` |
| `sound` | `n`, `mode` (the script host's and the combat host's `sound`; the sounds of presentation calls are not transcribed) |
| `area` | `block`, `area`, `x`, `y`, `facing2`: once when play has started, and after each area entry (§3.2 `enter`) |
| `write` | `address` (canonical), `value`: every store an opcode makes to an ECL variable, in order (writes by the rules, such as combat's outcome or the clock, are not transcribed) |
| `command` | `command`: each script command, before it runs |
| `screen` | `what`, `info` (null when none): each `engine(what)` hand-over |
| `combat` | `text`, `round` (the battle's round counter, 0 in the first round), `current` (the current combatant's name, null before anyone acts): each combat message; at the end of the battle `outcome` (ECL 0x6DC7), `survived`, `round` |
| `save` | `slot` (the `saveAs` option's, or null): the camp's Save |
| `summary` | `messages` (the summary's lines), `share`: after a `screen` `treasure` |
| `frame` | `block`, `area`, `x`, `y`, `facing2`, `sprite` (the sprite on show: `sprite`, `picture`, `distance`, or null), `sha256` (of the frame's indices; null where there is no 3D view): with the frame option, after the run, before `end` |
| `end` | `reason`: `script` (the commands are done), `quit` (the game ended), `answers` (with `waiting`: the question unanswered, `kind` and its `items`, `prompt` or `left`), `divergence` or `error` (with `message`) |

Presentation-only calls (`pose`, `flight`, `effect`, `fall`, holds) are not transcribed.

### 8.3 The view frame (V9)

With the frame option the run ends by drawing the original's view of the engine's state as
[C-port/exploration-view.md §2](../C-port/exploration-view.md#2-the-drawn-view-normative) specifies
it: 88 × 88 EGA indices, row-major, of the party's square and facing, with the encounter sprite the
scripts left on show (the last `sprite` not followed by a `picture` or `clearView`, and not at
distance 0 with a picture). The frame is compared by the SHA-256 of its 7744 index bytes; a PNG
through the EGA palette is a convenience. A run that ends in a tile wilderness, or without a map, has
no frame.

*Informative:* the reference runner is `web/headless/` (`harness.ts`, and `run.ts`, the command line:
`node --import ./headless/node-ts.mjs headless/run.ts --files <folder> --script <script.json>
[--tape <tape.json> | --seed <n>] [--record <tape.json>] [--out <transcript.jsonl>] [--frame <view.png>
[--scale <n>]] [--save <dir> [--slot <x>]]`, plain Node 24
with its type stripping; `npm run headless -- …` in `web/`). Without a tape it rolls the reference
generator (seed 1 unless given) and `--record` writes the tape it made. `--save` saves the game at the
end of the run (or at the camp's Save, with `camp`) in slot `--slot` (default B) as the port's Save does and writes the files under the
original's names (`SAVGAM<x>.DAT`, `CHRDAT<x><n>.*`) to the folder, to set beside what the original
writes for the same play ([VALIDATION.md §4](../VALIDATION.md#4-sweeps-play-tests-and-reference-hashes); `tools/dosbox/savecompare.py`). Transcripts and tapes contain
game text and stay with the player's files. The play-test harness `web/test/playtest.ts` is a
different tool: it plays at random to look for broken states.

## Open

- None.
