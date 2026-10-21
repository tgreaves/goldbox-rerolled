# Glossary

> **Status: partial** (work-plan steps 5 and 6, [AUDIT.md](../AUDIT.md) §8). Normative. Part D of
> the [specification](../README.md). Written: the terms part A uses (step 5, 2026-10-21). To come:
> the terms of parts B and C.

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
