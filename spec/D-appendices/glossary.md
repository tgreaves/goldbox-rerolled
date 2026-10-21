# Glossary

> **Status: complete** (work-plan steps 5 and 6, [AUDIT.md](../AUDIT.md) §8). Normative. Part D of
> the [specification](../README.md). The terms of part A (step 5), part B, part C and the companion
> documents (step 6).

One meaning for each term. Where the spec or the original's own texts use another word for the same
thing, it is listed with the term. Terms are those of Pool of Radiance (PoR) unless marked CotAB
(Curse of the Azure Bonds).

## Addresses and files

| Term | Meaning |
|---|---|
| **block** | a group of areas sharing one file per family: `ECL<b>.DAX`, `GEO<b>.DAX` …; the current block digit is `DS:5376` (CotAB `DS:5C08`). PoR has blocks 1–8, CotAB 1–6 ([main-loop.md](../A-games/engine/main-loop.md#areas-and-blocks-observed)) |
| **DAX file**, **record** | the container of all adventure data: records by id, each RLE-packed ([containers.md](../A-games/engine/containers.md#dax-archives)). "Record *n*" without a family means the ECL record |
| **DS** | the game's data segment: PoR paragraph 0x0C7C (image 0xC7C0), CotAB 0x0ABE (image 0xABE0); `DS:x` is offset *x* in it ([addresses.md](addresses.md#notations)) |
| **image**, **merged image**, **working image** | `START.EXE` unpacked with `GAME.OVR`'s overlays merged and the MZ header dropped; image offsets are the CotAB address notation, and `image 0x…` in PoR files ([coab/README.md](../A-games/coab/README.md#working-image)) |
| **linear address** | Ghidra's address for PoR: segment·16 + offset with the load segment 0x1000, so linear = image + 0x10000 (used bare in [effects.md](../A-games/engine/effects.md) and [sound.md](../A-games/engine/sound.md)) |
| **segment** (`seg:off`, `FUN_seg_off`) | PoR: a Ghidra segment of the merged image; image paragraph = segment − 0x1000. CotAB's `ssss:oooo` is the image paragraph itself |
| **stem** | the file-name stem of a character's files: the name without the characters of the table `DS:0D1A` (space, `.`, `*`, `,`, `?`, `/`, `\`, `:`, `;`, `\|`), first 8 characters ([input-and-menus.md §2.2](../A-games/engine/input-and-menus.md#22-character-files-o-fun_45c5_069e-fun_1802_0425)) |
| **roster** | the characters on disk outside the party: PoR `charlist.txt` and `<stem>.CHA/.ITM/.SPC`, CotAB `*.guy/.swg/.fx` |
| **save slot** | one of the letters A–J of a saved game (`SAVGAM<x>.DAT` and its `CHRDAT<x><n>` files); not a spell slot or an icon slot |

## Places and scripts

| Term | Meaning |
|---|---|
| **area** | a place with one script: ECL record *n* of the current block, with GEO record *n* as its map when it has one. The current area is `DS:84DC` (ECL 0x49F2) |
| **area kind** | `DS:49FA`: 1 a map area, 2–4 the three wilderness areas 25–27 in overland travel. Not the game mode |
| **map area** | an area drawn as the 3D view on a 16 × 16 GEO map (area kind 1); battles there use `DungCom` |
| **wilderness**, **overland** | PoR's tile map of areas 25–27, travelled with the overland view (area kind 2–4, game mode 3, [overland.md](../A-games/engine/overland.md)); battles there use `WildCom`. CotAB's overland is a picture with a cursor and a script menu ([coab/assets.md](../A-games/coab/assets.md) §4) |
| **lair** | a GEO map loaded inside a wilderness area (ECL 0x4A9E = 255) |
| **ECL**, **script** | the bytecode in an area's ECL record, run by the VM ([ecl.md](../A-games/engine/ecl.md)) |
| **vector** | one of the five entry points at the start of a script: `on_move`, `on_step`, `camp_menu`, `camp_confirmed`, `on_enter` |
| **ECL address**, **ECL variable** | a 16-bit address in the VM's space: A 0x4900–0x4CFF, B 0x6B00–0x6EFF, C 0x9700–0x98FF, code 0x9900–0xB6FF (PoR's numbering, canonical in part B); engine registers outside them |
| **engine-visible variable** | an ECL variable the engine itself reads or writes ([ecl.md](../A-games/engine/ecl.md#engine-visible-variables-o-unless-marked)); all others are script-private |
| **scenario variable** | a script variable whose meaning a reader of the game's state needs ([por/README.md](../A-games/por/README.md#scenario-variables)) |
| **wall set**, **wall type**, **wall-set slot** | a `WALLDEF` record's pieces; the wall type a GEO square's side names; one of the three slots a script loads wall sets into |
| **game mode** | `DS:49F3`: 0 party screen, 1 shop or temple, 2 camp, 3 wilderness, 4 map, 5 combat, 6 after combat, 7 ending ([town.md](../A-games/engine/town.md#game-modes-o-ds49f3)) |
| **game speed** | `DS:49E2`, 0–9 (Alter → Speed); pauses and animations scale with it |

## Characters

| Term | Meaning |
|---|---|
| **character record** | the 285-byte record shared by player characters, NPCs and monsters (CotAB 422 bytes); `char[x]` or `c[x]` is its byte *x* |
| **party list** | the linked list at `DS:5D96` (CotAB `DS:6524`): the party, and after `LOAD_MONSTER` also the loaded monsters |
| **party** | the player characters and NPCs at the head of the party list (count `B[0x67C]`, ECL 0x6E3E) |
| **current character** | the record at `DS:5D92` (CotAB `DS:6520`): the one a menu, a script's B view or a handler acts on |
| **NPC** | a character record with char[0x84] ≥ 0x80 (its morale byte); joined by `ADD_NPC`, played by the computer |
| **in play** | char[0x10D] ≠ 0: able to act. Cleared when a character is knocked out, killed or leaves the battle |
| **enemy side**, **side** | char[0x10E]: 0 the party's side, 1 the enemy's |
| **status** | char[0x10C]: 0 Okay, 1 Animated, 2 tempgone, 3 Running, 4 Unconscious, 5 Dying, 6 Dead, 7 Stoned (8, dead forever, set by energy drain) |
| **creature class** | a monster record's byte +0x9F (4 undead, 2 giants …), tested by weapon and racial effects ([effects.md §3](../A-games/engine/effects.md#3-formulas-creature-classes-odd-cases-and-hasteslow)) |
| **quick** | char[0x10F] ≠ 0: the computer plays the character in combat (Quick, NPCs, monsters) |
| **spell slot** | a count of spells of one level a class may memorise (char[0xB2..0xB7]); not a save slot |
| **icon slot** | one of the combat-icon slots: 0–7 the party (char[0xBF]), 8 and up the monster pictures |

## Effects

| Term | Meaning |
|---|---|
| **effect** ("affect" in the original's texts and the guide) | a 9-byte record on a character's effect list: type, duration, power, removal flag ([records.md](../A-games/engine/records.md#effect-record-9-bytes-o)) |
| **effect type** | the record's byte 0, 1–139 in PoR (1–147 in CotAB): which handler runs |
| **event** | a numbered moment at which the engine calls the handlers listed for it (PoR 0–19, CotAB 0–23, [effects.md §1](../A-games/engine/effects.md#1-how-handlers-are-invoked-and-how-they-learn-the-event)) |
| **handler** | the original's routine for one effect type, item kind or spell id. Part B calls a build's equivalent a **behaviour** (effects, items) or a **kind** (spells) |
| **power** (Pw) | an effect record's byte 3, the handler's parameter |
| **removal call** | the handler call with argument 1 when a record with byte 4 ≠ 0 is removed or expires |
| **dormant** | a strength record (types 12, 38) whose power has bit 7 set: it does not restore its value when it ends |
| **item kind** | an item's +0x3E ≥ 0x80: the item handler called when it is readied or unreadied |
| **duration** | in minutes of game time; 0 = permanent |

## Combat

| Term | Meaning |
|---|---|
| **battlefield**, **grid** | the 25 × 50 cells of a battle ([battlefield.md](../A-games/engine/battlefield.md)) |
| **cell**, **cell value** | one position of the grid and the value stored there, an index into the cell table (`DS:2744`) |
| **square** | a map square (16 × 16 GEO) or, in a battle, a cell; distances are in squares |
| **half-square** | the engine's unit of distance and movement: a straight step 2, a diagonal step 3 |
| **combat record** | the 22-byte record of a combatant during a battle, `R[x]` ([combat-rules.md](../A-games/engine/combat-rules.md#combat-record-22-bytes-o-unless-marked)) |
| **round**, **turn** | a round gives every combatant one turn, in initiative order; one round is one minute of game time |
| **the pool** | the treasure money table `DS:67F4` and the treasure list `DS:6810` that a battle or a script fills; also a shop's stock |
| **morale** | char[0x84] & 0x7F of an NPC or monster, tested when its side takes losses ([combat-ai.md](../A-games/engine/combat-ai.md)) |

## The specification

| Term | Meaning |
|---|---|
| **the original** | the game as released (PoR DOS 1.3, CotAB GOG 1.0); its binaries and data are the authority for part A |
| **conforming build** | a build that meets the README's conformance rules; "a conforming build …" in part A states the rule for an item the original leaves undefined |
| **the port**, **GoldBox Rerolled**, **the reference implementation** | this project's build (`web/`, `server/`); part A does not describe it, parts B and C do |
| **departure**, **improvement**, **IMP** | a deliberate difference from the original, with an id IMP-*nnn* in [IMPROVEMENTS.md](../../IMPROVEMENTS.md) and its section in part C ([departures.md](../C-port/departures.md)) |
| **profile** | a game's data in part B: fields, tables, script map, rules values and procedure choices ([profile.md](../B-model/profile.md)); "configuration" is not used |
| **dice tape** | the sequence of (count, sides) requests and their results of a run (D2, [README](../README.md#randomness-the-dice-tape-d2)) |
| **O**, **I**, **?**, **G**, **Bug** | the evidence marks ([README](../README.md#evidence-marks)) |
| **informative** | text that explains, or lists values a builder reads elsewhere (the game files, another section); everything else is normative |

## The engine model (part B)

| Term | Meaning |
|---|---|
| **game profile** | everything one game needs that is not shared code: identity, files, field map, table map, script map, rules, handler maps, presentation data ([profile.md](../B-model/profile.md)); made active by `setGame` |
| **F**, **C**, **P** (value kinds) | where a profile value comes from: read from the player's **f**iles at run time, a value of the original's **c**ode the profile holds, or written for the **p**ort ([profile.md §1.1](../B-model/profile.md#11-where-a-value-comes-from)); not the evidence marks |
| **field map** (`F`) | the byte offset of each named character-record field in the game's layout; −1 where the game has no such field ([records-and-tables.md §2](../B-model/records-and-tables.md#2-the-field-map-charfields)) |
| **table map** (`T`), **table ref** | the DS offset (`at`) and row size (`row`) of each named START.EXE table; `at` = −1 for a table the game lacks (an **absent table**) ([records-and-tables.md §3](../B-model/records-and-tables.md#3-the-table-map-tablemap)) |
| **rules** (`R`) | the game's rules values and procedure choices ([procedures.md](../B-model/procedures.md)) |
| **parametric procedure** | one procedure for every game, its differences as parameters in the profile ([procedures.md](../B-model/procedures.md)); a **paired procedure** is one written twice because the games' procedures differ in kind, the profile naming which runs ([adding-a-game.md §4](../B-model/adding-a-game.md#4-what-is-still-a-paired-procedure)) |
| **records kept native** | records are held and written in the game's own layout; port-only data goes in sidecar files ([records-and-tables.md §1](../B-model/records-and-tables.md#1-records-stay-native)) |
| **canonical numbering** | ECL addresses as PoR numbers them; a game's own addresses are translated by region to it ([script-vm-map.md §1](../B-model/script-vm-map.md#1-canonical-numbering)) |
| **character view** | the B space read as the current character's record through the view map: shared entries, then per-game ones ([script-vm-map.md §4](../B-model/script-vm-map.md#4-the-character-view-b)) |
| **opcode variant**, **behaviour flag** | an opcode whose encoding or meaning differs by game, named in the script map; a flag of a shared opcode that changes one detail ([script-vm-map.md §5](../B-model/script-vm-map.md#5-opcodes)) |
| **behaviour**, **effect behaviour**, **item behaviour** | a build's procedure for an effect type or item kind, named in the handler maps with its parameters ([vocabularies.md §3](../B-model/vocabularies.md#3-effect-behaviours)) |
| **spell kind** | a build's procedure for a spell id, with parameters, in the spell map ([vocabularies.md §4](../B-model/vocabularies.md#4-spell-kinds)) |
| **handler map** | a game's map from effect type, item kind or spell id to a behaviour or kind and its parameters ([vocabularies.md §6](../B-model/vocabularies.md#6-the-effect-handler-maps), [§7](../B-model/vocabularies.md#7-the-spell-handler-maps)) |
| **monster special** | a behaviour on event 14 that gives a monster its attack form (breath, gaze …) ([vocabularies.md §5](../B-model/vocabularies.md#5-monster-specials-and-the-target-hook)) |
| **script host** (`Io`), **combat host** (`CombatUi`), **effect host** (`FxHost`) | the interfaces through which the rules ask a screen for text, menus, input, pictures, sound and waits ([host-contracts.md](../B-model/host-contracts.md)) |
| **hand-over** | the script host's `engine(what)`: the rules give the screen a built-in screen to run (shop, temple, camp, combat …) and wait for it |
| **dice source**, **request** | the one injected source of every game-changing random draw; a request `(count, sides)` is answered with the sum of the dice ([host-contracts.md §6](../B-model/host-contracts.md#6-randomness-the-dice-source)) |
| **recording**, **replaying**, **divergence** | writing a run's dice tape; answering a run from a recorded tape; a request that differs from the tape's next draw, or a tape that runs out, which stops the run ([host-contracts.md §6.4](../B-model/host-contracts.md#64-the-tape-format)) |
| **headless run**, **transcript**, **answers** | a run with no screen whose hosts answer from a list of answers and write a transcript of JSON events; two conforming builds give the same transcript for the same files, script and tape ([host-contracts.md §8](../B-model/host-contracts.md#8-the-headless-harness)) |
| **required files**, **kept files**, **markers** | the files without which a game is not imported; the files the port keeps of a game; the files only that game has, by which it is recognised ([files-and-detection.md](../B-model/files-and-detection.md)) |
| **store** | a browser database the port keeps per game: `files` (the game files) and `user` (the player's data) ([files-and-detection.md §3](../B-model/files-and-detection.md#3-per-game-stores)) |

## The port (part C)

| Term | Meaning |
|---|---|
| **games screen**, **party screen**, **play screen** | the list of games with Import; a game's start screen with Play, Party and Files; the screen of exploring and battles ([app-flow.md](../C-port/app-flow.md)) |
| **behaviour contract** | the normative part of the interface: every screen, its states, controls, keys, texts and what each does, and its layout in words per screen class (D4, [ui-contract.md](../C-port/ui-contract.md)) |
| **screen class** | the play screen's layout by window shape: wide (row or column), narrow, phone landscape ([ui-contract.md §3](../C-port/ui-contract.md#3-screen-classes)) |
| **party card**, **sheet** | a party member's box on the play screen; the character panel a card opens ([ui-contract.md §4.1](../C-port/ui-contract.md#41-party-cards), [screens.md](../C-port/screens.md)) |
| **panel** | a modal dialog of the play screen (sheet, shop, camp, treasure …), with a ✕ and Escape to close ([ui-contract.md §7](../C-port/ui-contract.md#7-dialogs)) |
| **command bar**, **☰ menu**, **pad** | the row of commands under the view; the menu of everything else (Save, Journal, Settings …); the on-screen movement buttons ([ui-contract.md §4–§5](../C-port/ui-contract.md#5-the-command-bar)) |
| **text log**, **block**, **port note** | the scrolling text of the play screen; the text of one game screen in it; a line the port adds, shown in the quiet colour ([ui-contract.md §6](../C-port/ui-contract.md#6-the-text-log)) |
| **colour role** | a use of colour (game text, highlight, frame …) mapped to one EGA colour ([ui-contract.md §2](../C-port/ui-contract.md#2-colours-as-roles)) |
| **drawn view**, **3D view** (Enhanced) | the original's 88 × 88 view drawn as it draws it (View = Original, the conformance target, D6); the port's WebGL view (View = Enhanced (3D)) ([exploration-view.md §1](../C-port/exploration-view.md#1-the-two-views)) |
| **slide** | the 3D view's animated step or turn (IMP-001); the drawn view has none |
| **area map**, **landmark** | the overhead map beside the view; a marked place on it, found by the landmark patterns ([exploration-view.md](../C-port/exploration-view.md), [port-data.md §3](port-data.md#3-landmark-patterns)) |
| **journal**, **find** (`known`) | the port's Journal panel (IMP-055); an id the game's own text has revealed, kept with the save ([storage.md §6](../C-port/storage.md#6-journal-finds-and-the-gbr-sidecar)) |
| **autosave** | the save the port writes after actions, its own record `auto`, never one of the slots A–J (IMP-060, [storage.md §5](../C-port/storage.md#5-saved-games-and-the-autosave)) |
| **sidecar**, **`.GBR`** | a file beside a game's own save files holding port-only data (journal finds), so the original files stay byte-compatible ([storage.md §6](../C-port/storage.md#6-journal-finds-and-the-gbr-sidecar)) |
| **export**, **import** (of saves) | the ZIP of a player's saves and roster in the games' own formats, and reading one back ([storage.md §7](../C-port/storage.md#7-export-and-import)); not the import of game files |
| **account**, **record**, **version**, **conflict copy** | the optional server's user; its unit of storage (`<kind>/<id>`, `{ meta, files }`); the record's `updatedAt`; the copy kept when two devices changed the same save ([accounts-and-sync.md §1](../C-port/accounts-and-sync.md#1-model)) |
| **sync**, **push**, **pull** | sending the local changes to the server and merging the server's into the browser ([accounts-and-sync.md §5](../C-port/accounts-and-sync.md#5-client-sync)) |
| **offline app**, **single-file build**, **version line** | the installable web app with its service worker; the build as one HTML file; the running version shown on the games screen and in Settings ([pwa-and-build.md](../C-port/pwa-and-build.md)) |

## Validation (companion documents)

| Term | Meaning |
|---|---|
| **test vector**, **manifest** | an input and the output a conforming build gives for it; the committed file of them ([test-vectors.md](test-vectors.md)) |
| **S**, **E**, **F** (vector kinds) | needs nothing; needs the game's executable, output in full; needs the player's files, output as a hash ([test-vectors.md §1](test-vectors.md#1-kinds)) |
| **golden output** | the reference implementation's full output for an F vector, made locally from the player's files, never committed |
| **clean-room run** | a build by a builder who has only the spec and the game files, compared with the reference ([CLEANROOM.md](../CLEANROOM.md)) |
| **finding** | a point where a clean-room builder found the spec silent, ambiguous or wrong, logged with its section and tag |
| **V1–V13** | the validations of a clean-room run ([CLEANROOM.md](../CLEANROOM.md)) |
| **load-bearing detail** | a detail that still gives a working game when built wrong, so only a deliberate check finds it ([CONFORMANCE.md](../CONFORMANCE.md)) |
