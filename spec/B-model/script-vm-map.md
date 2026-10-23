# Script VM map

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

How one ECL interpreter runs every game's scripts. The virtual machine itself (encoding, operand
kinds, memory, flags, every opcode, CALL targets) is part A: [engine/ecl.md](../A-games/engine/ecl.md)
for Pool of Radiance, [coab/ecl.md](../A-games/coab/ecl.md) for Curse of the Azure Bonds as
differences. This file is the **EclMap** of the game profile ([profile.md](profile.md), field
`ecl`): where each game's memory regions sit, how its addresses are translated to the one numbering
the interpreter uses, how B reads as the current character, and which opcodes a game handles its own
way.

## 1. Canonical numbering

1. The interpreter, and every part of the engine that names an ECL variable, uses **Pool of
   Radiance's numbering** (the canonical numbering): A at 0x4900, B at 0x6B00, C at 0x9700, code at
   0x9900. Shared code names variables by their PoR address (ECL 0x49E6, 0x6DC7 …), whatever the
   game.
2. A game whose regions sit elsewhere has its scripts' addresses **translated on the way in**, when
   an operand is used as an address (§2.2). Offsets inside a region are the same in every game
   described so far (**O**, [coab/ecl.md, "Memory map"](../A-games/coab/ecl.md#memory-map-o-0x200f3--0x208e6--0x20722)).
3. Engine registers (0xC04B … 0xC05F, 0x033D, 0x03DE, 0x00B8, 0x00B9 …) are the same in both games
   (**O**) and are never translated.
4. Profile fields that name an ECL variable (for example `rules.wildBattle.mapFlag`) give it in the
   canonical numbering.

## 2. Regions and translation

### 2.1 The regions

| Region | Size | PoR | CotAB |
|---|---|---|---|
| A (words) | 0x400 words | 0x4900–0x4CFF | 0x4B00–0x4EFF |
| B (words, with the character view) | 0x400 words | 0x6B00–0x6EFF | 0x7C00–0x7FFF |
| C (words) | 0x200 words | 0x9700–0x98FF | 0x7A00–0x7BFF |
| code (bytes) | 0x1E00 bytes | 0x9900–0xB6FF | 0x8000–0x9DFF |

The profile holds the four start addresses (`a`, `b`, `c`, `code`); the sizes are the engine's.
Region storage is a plain array per region; a save file holds the arrays in region order, so a
save's A word *n* is ECL A + *n* in either numbering ([engine/savegame.md](../A-games/engine/savegame.md)).

### 2.2 Translation

`canonical(g, a)`, for a game *g* and a 16-bit address *a* taken from a script:

1. If *a* lies in one of *g*'s regions, return the canonical start of that region plus the offset
   (*a* − *g*'s start). The regions are tested in the order A, B, C, code.
2. Otherwise, if *a* lies in one of the canonical regions (an address the game itself does not map),
   return **NOWHERE** (0xFFF0): an address no region or register uses, which reads 0 and ignores
   writes.
3. Otherwise return *a* (an engine register).

For PoR, `canonical` is the identity. `native(g, a)` is the inverse for the four regions (other
addresses unchanged); it is used only to print addresses in a game's own numbering (logs, tools,
error messages).

Translation applies to every operand the interpreter uses **as an address**: the variable operands
(kinds 1 and 3), string addresses (kind 0x81), the destinations of every instruction that writes,
the targets of GOTO, GOSUB, ON_GOTO and ON_GOSUB, and the five vectors (the GOTO operands at code +
0, 4, 8, 12, 16, read when the VM is reset). It does **not** apply to immediates (kinds 0 and 2) or
to CALL's operand, which is compared as a number (§7). A static reader of scripts (the landmark
walk, [C-port/exploration-view.md](../C-port/exploration-view.md)) translates the same operands.

## 3. Engine-visible variables

The variables the engine itself reads or writes are listed in part A
([engine/ecl.md, "Engine-visible variables"](../A-games/engine/ecl.md#engine-visible-variables-o-unless-marked);
[coab/ecl.md, "Engine-visible variables"](../A-games/coab/ecl.md#engine-visible-variables-o-engine-code-touching-the-word-meaning-i-where-it-rests-on-the-por-analog)).
In CotAB each of them is PoR's address + 0x200 (A) or + 0x1100 (B) (**O** for every row of the CotAB
table), so the engine reaches them in the canonical numbering through §2.2. Where CotAB gives a
variable a meaning PoR's does not have, the procedure that reads it is named in the profile with the
canonical address (CotAB's place ECL 0x4CA1 = canonical 0x4AA1, `rules.wildBattle.place`).

## 4. The character view (B)

Part of B is a view of the current character: reads of mapped offsets return a record field, writes
store the word and also write the field ([engine/ecl.md, "B as a view of the current character"](../A-games/engine/ecl.md#b-as-a-view-of-the-current-character-o-fun_2fea_07bc-read-fun_2fea_0a74-write)).
The offsets from B's start are the same in both games, and every mapped field is reached through the
field map ([records-and-tables.md §2](records-and-tables.md#2-the-field-map-charfields)).

### 4.1 Shared view

Reads and writes every game has (offset from B → field):

| Offset | Read | Write |
|---|---|---|
| 0x18 | `stat[4]` (CON) | — |
| 0x20–0x70 | the B word | `memorised` + (offset − 0x20) + `memorisedView` := low byte |
| 0x9B | `saves` + 1 | — |
| 0xA0 | `hitDice`, signed | — |
| 0xA5–0xAC | `thief` + (offset − 0xA5) | — |
| 0xB8 | `morale` | `morale` := v, less 0x32 when v > 0xB2 |
| 0xBB, 0xBD, 0xBF, 0xC1, 0xC3 | u16 `money` + (offset − 0xBB) | the same |
| 0xD8 | `alignment`, signed | — |
| 0xF7 | u16 `xpBase` | the same |
| 0xF9 | `xpPerHp` | the same |
| 0x100 | 0 when `loadPastEnd` and the flag is set (the read clears it); else 0x80 when `inPlay` = 0, else 1 | v ≥ 0x80: `inPlay` := 0, and v = 0x87 also `status` := 7 |
| 0x10C | 0x80 when `side` = 0 and `quick` ≠ 0; 0x81 when `side` = 1; else 0 | 0 → side 0, quick 0; 0x80 → 0, 1; 0x81 → 1, 1 |
| 0x10D | 0 (the original returns an uninitialised word, **?**; the port's choice) | — |
| 0x11B | `move` | — |
| 0x2B1, 0x2B4 | the current character's index in the party list (0-based) | — |
| 0x2CF | `rules.chaReaction`[CHA] | — |
| 0x312 | the current ECL block | switch block |
| 0x322, 0x324, 0x326 | the B word | v > 0x80: load wall set v & 0x7F into slot 1, 2, 3 |

The B words at 0x00 and 0x100 written as 0, then a LOAD_CHARACTER with bit 7, drop that character
(part A). Unmapped offsets read and write the B word.

### 4.2 Per-game view

| EclMap field | Meaning | PoR | CotAB | SotSB |
|---|---|---|---|---|
| `memorisedView` | `{ from, to, offset }`: a write to B + from … to lands at `memorised` + (offset − from) + `offset` | 0x20–0x70, 0 | 0x20–0x70, 1 (1-based) | 0x1B–0x65, 0 |
| `viewReads` | reads this game adds or changes, by offset (below) | none | 0x15, 0x72, 0x73, 0xD6, 0xE4, 0xC9 | 0x15, 0x19, 0x72, 0x73, 0x76, 0xAC, 0xC9–0xCC, 0xCF, 0xD0, 0xD6, 0x119 |
| `viewWrites` | writes this game adds: offset → a field, a byte or (`word`) a u16 | none | none | 0x119 → HP |
| `moneyWords` | money words from B + 0xBB, two bytes apart, read and written as the record's | 5 | 5 | 6 (to 0xC5) |
| `view100` | B + 0x100 read as in play (0x80 out, 1 in) or as the status byte; written `outOfPlay` (≥ 0x80 out of play, 0x87 stoned, 0 the second leave flag) or `okayInPlay` (1: Okay and in play) | in play, outOfPlay | in play, outOfPlay | status, okayInPlay (0x260CD, 0x265BD; so the second leave flag is never set) |
| `facingInA` | an A address answered with the facing instead of the array | null | null | 0x49EA (SotSB A 0x4BEA, 0x269A9) |

A `ViewRead` is one of:

- `{ field, index?, signed?, mask? }`: the byte at the field (element `index` of an array field;
  `stat` takes the `index`-th offset of its list), masked with `mask`, and sign-extended to 16 bits
  when `signed`;
- `{ raw, mask? }`: the record byte at offset `raw`, masked (for a byte with no field yet);
- `{ classLevel: k }`: the casting level of base class *k* with its former dual-class part
  ([procedures.md §4](procedures.md#4-caster-level)), low byte.

CotAB's entries (**O**, [coab/ecl.md, "B as a view"](../A-games/coab/ecl.md#b-as-a-view-of-the-current-character-o-read-0x201b4-write-0x2051f)):
0x15 `{ field: stat, index: 1 }` (INT); 0x72 `{ field: race, signed }`; 0x73 `{ field: cls, signed }`;
0xD6 `{ field: gender, signed }`; 0xE4 `{ raw: 0x192, mask: 1 }`; 0xC9 `{ classLevel: 5 }`.
A `viewReads` entry is consulted before the shared view.

## 5. Opcodes

### 5.1 Variants

The base handlers are PoR's ([engine/ecl.md, "Opcodes"](../A-games/engine/ecl.md#opcodes)). A game's
`ops` maps an opcode to a **variant** the engine implements in place of the base handler. Variants
are named by what they do:

| Variant | Operands | Does |
|---|---|---|
| `divideRemainder` | 3 | DIVIDE (dest := val 1 div val 2) and the remainder into B word 0x6E3F (canonical; CotAB 0x7F3F). The port writes 0 and 0 for a divisor of 0 (**I**: the original's Turbo Pascal division stops with run-time error 200, and no shipped script divides by 0) |
| `returnOrExit` | 0 | RETURN; with an empty GOSUB stack, EXIT |
| `passTime` | 2 | PASS_TIME count, unit: the game clock advanced *count* times by one *unit* and effects timed out, as camp's rest does ([engine/camp-and-time.md, "Advancing"](../A-games/engine/camp-and-time.md#advancing-fun_4b46_03d5count-unit)) |
| `findSpell` | 3 | FIND_SPELL id, dest index, dest member: over the party in order, the first memorised slot *i* (1-based) holding the id; dest index := *i* or 0xFF, dest member := that member's 0-based index, or party size − 1 when none |
| `protection` | 1 | the code-wheel check: the operand is read and nothing is asked (the port's departure IMP-068, [C-port/departures.md](../C-port/departures.md)) |
| `redrawScreen` | 0 | REDRAW_SCREEN: the frame, the current character and the current picture drawn again (the view marked changed, then the host's `refresh`) |
| `dropCharacter` | 0 | DROP_CHARACTER: the current character leaves the party (party size − 1); the member before it, or the first, becomes current |
| `findEffect` | 1 | FIND_EFFECT type: every flag cleared, then EQ := the current character has an effect of that type, NE := not |
| `destroyItems` | 1 | DESTROY_ITEMS type: every party member loses every item of that type; its statistics are worked out again |

| Game | `ops` |
|---|---|
| PoR | none |
| CotAB | 0x06 `divideRemainder`, 0x13 `returnOrExit`, 0x34 `passTime`, 0x3B `findSpell`, 0x3C `protection`, 0x3D `redrawScreen`, 0x3E `dropCharacter`, 0x3F `findEffect`, 0x40 `destroyItems` (**O**, [coab/ecl.md, "Opcodes"](../A-games/coab/ecl.md#opcodes)) |

An opcode with neither a base handler nor a variant stops the script with an error naming it (the
original hangs, part A).

### 5.2 The IF skip table

`IF_xx` skips the next instruction by the skip routine's own operand counts (part A,
[engine/ecl.md, "Flags and control flow"](../A-games/engine/ecl.md#flags-and-control-flow-o)). The
base table (PoR `FUN_2fea_1ea6`, **O**) is, operands skipped → opcodes:

| Skips | Opcodes |
|---|---|
| 1 | 0x01 0x02 0x0A 0x0E 0x11 0x12 0x1D 0x20 0x2D 0x32 0x34 0x36 0x38 0x39 0x3C |
| 2 | 0x03 0x08 0x09 0x0C 0x0F 0x10 0x1F 0x22 |
| 3 | 0x04 0x05 0x06 0x07 0x0B 0x21 0x28 0x2A 0x2F 0x30 0x35 0x37 0x3B |
| 4 | 0x14 0x23 |
| 5 | 0x2E |
| 6 | 0x1E 0x2C |
| 8 | 0x27 |
| 14 | 0x29 |
| (any other) | 1 |

A game's `skip` overrides entries: CotAB 0x0C → 3, 0x3F → 1, 0x40 → 1 (**O**).

### 5.3 Operand counts for static reading

A reader that walks scripts without running them (the landmark walk) needs each opcode's operand
count and, for the variadic ones, which operand holds the count of further operands. The base
table (the PoR handlers' reader calls, **O**): 0 operands for 0x00, 0x0D, 0x13, 0x16–0x1C, 0x24, 0x31,
0x33, 0x3A, 0x3D; 1 for 0x01, 0x02, 0x0A, 0x0E, 0x11, 0x12, 0x1D, 0x20, 0x2D, 0x32, 0x34, 0x38, 0x39,
0x3C; 2 for 0x03, 0x08, 0x09, 0x0F, 0x10, 0x22, 0x36; 3 for 0x04–0x07, 0x0B, 0x0C, 0x21, 0x28, 0x2A,
0x2F, 0x30, 0x35, 0x37, 0x3B; 4 for 0x14, 0x23; 5 for 0x2E; 6 for 0x1E, 0x2C; 8 for 0x27; 14 for
0x29; variadic: 0x15 (3 fixed, the count in operand 3), 0x25, 0x26 and 0x2B (2 fixed, the count in
operand 2). A game's `operands` overrides entries as `opcode → [fixed, count operand index]`:
CotAB 0x34 → 2, 0x3E → 0, 0x3F → 1, 0x40 → 1 (the handlers' reader counts, **O**, 0x1FA02). A count
operand that is not an immediate ends the walk there. Operand slots MUST hold 64 operands (the
original's tables, 0x40 bytes apart with slot 0 unused, read 64 back whole: [engine/ecl.md](../A-games/engine/ecl.md);
SotSB's ECL2 #51 has a 64-way ON_GOTO at 0x8728, CotAB a 33-way one).

### 5.4 Behaviour flags of shared opcodes

| EclMap field | Opcode | Meaning | PoR | CotAB |
|---|---|---|---|---|
| `twoSlotSkipsFF` | LOAD_WALLSETS | in two-slot mode (A 0x49E7 and 0x49E8 set), an operand of 0xFF leaves its slot as it is; false: it is loaded like any record | false (image 0x1A96D: no test) | true (0x19563, 0x19575) |
| `damageDespiteSave` | DAMAGE | flag bits with which a successful save still takes the damage (0: none) | 0 | 0x10 (0x1B22A; the bit is also part of the save bonus) |
| `loadPastEnd` | LOAD_CHARACTER | an index past the end of the list sets a flag that the next read of B + 0x100 returns as 0 and clears; the current character is unchanged | false | true (DS:8B87: 0x18B39, 0x20390) |
| `wipeBanner` | DAMAGE | the address of the text shown before "The entire party is killed!" when DAMAGE leaves nobody in play; null: none | 0x1C35D, "The END!" (`FUN_29c3_2775`) | null |
| `refreshAfterPicture` | CALL refresh | the view is drawn again over a picture once the area's walls are loaded, even if nothing else changed; false: only when the view changed | false (`FUN_29c3_2c90`) | true (0x1B7B2: flags DS:8B7C … 8B84, DS:47FB) |
| `pauseMs` | PAUSE, CALL frame | the wait is game speed × this many milliseconds | 225 (`FUN_1709_0dbe`) | 100 (0x1B15B, 0x57F9: Delay(DS:4FC2 · 100)) |
| `addNpc.enemyId` | ADD_NPC | the monster id that joins on the enemy side (char side := 1 for it, 0 for any other); null: the side byte is left as the record holds it | 0x18 (handler `29c3:2B7E`) | null (0x1B61A) |
| `addNpc.tag` | ADD_NPC | the identity tag (`id` field): `random` Random(256), `monster` the monster id | `random` (`FUN_45c5_1262`) | `monster` (0x35974) |
| `addNpc.loaderRolls` | ADD_NPC | the record is finished as LOAD_MONSTER's loader does: icon size by race, the five icon colours rolled (d6 each); false: kept as stored | true (`FUN_45c5_0ec4`) | false (0x3565C) |
| `addNpc.iconPicture` | ADD_NPC | the NPC's combat icon is the combat picture (`CPIC`) record of its monster id, as LOAD_MONSTER's picture; false: built from its icon parts | false | true (0x3599F → 0x56C50) |

ADD_NPC's draws, in order: the loader's colours (when `loaderRolls`), the tag (when `random`), then,
where the game has the NPC portrait tables (`T.npcHeads`, `T.npcBodies*`), the class pick (1, *k*)
among its *k* classes and the body (1, 5) and head (1, 8) of [engine/ecl.md](../A-games/engine/ecl.md)
(`FUN_45c5_1262`). CotAB makes none. With `iconPicture`, loading a saved game gives every member
whose morale byte is 0x80 or more (an NPC) the combat picture of its identity tag, which ADD_NPC set
to its monster id (CotAB's loader 0x35B75 at 0x36068, **O**); player characters' icons are built from
their parts. PoR's loader (`FUN_45c5_1602`) has no such branch: every icon is built.

The banner and every other message are game text: a conforming build reads them from the game's
files ([D-appendices/strings.md](../D-appendices/strings.md)); the reference implementation still
holds "The END!" as a string (the code task of [AUDIT.md](../AUDIT.md) §6.8, C24).

## 6. Start, quit and other flags

| EclMap field | Meaning | PoR | CotAB |
|---|---|---|---|
| `start` | where a new game's scripts start: ECL block and record | block 3, record 0 | block 2, record 1 (**I**: the start-up code sets block 2, record 1 is the block's first) |
| `areaZero` | a save whose area word is 0 starts at this record, with that record's script loaded (not restored), as the loader does; null: area 0 is an area | null | 1 (image 0x1C001–0x1C050) |
| `areaZeroBlock` | the block that start goes to as well; null: the save's | null | null |
| `blockFile` | `{ add, divide }`: the DAX file digit of the value written to B + 0x312 (the block), floor((v + add) / divide); a save writes the digit into B + 0x312 (and, in SotSB, its first byte) and a load takes the block from B + 0x312, whatever the scripts kept there (SotSB 0x4243A, 0x41F66) | { 0, 1 } | { 0, 1 } |
| `quitProgram` | the PROGRAM operand that ends the game (the engine stops and the host leaves play); null: none | null | 3 (DS:4FE0 = 1, then EXIT, 0x1BA7E) |
| `endingProgram` | the PROGRAM operand that plays the ending; null: none | 8 | 8 |
| `wallSetNone` | LOAD_WALLSETS operands meaning "no set" (one-slot mode: the slot emptied; two-slot: left) | [0xFF] | [0xFF] |
| `addExperience` | ADD_EP `{ party, one, gains, classes }` (the lines; the share amount ÷ the number of the first `classes` class levels above 0, to those in play); null: no such opcode | null | null |
| `damageRolls` | DAMAGE's dice: `once` (before the victims, the attack mode's next after each) or `perVictim` (before each victim's save or attack, the pick first) | once | once |
| `monsterFile` | the MON<n> file digit; null: the block's | null | null |
| `findSpellFirst` | FIND_SPELL's index of the first memorised slot | — | 1 |
| `destroyUnreadies` | DESTROY_ITEMS puts a readied item away (its handler, "It's Cursed!") before freeing it | false | false |
| `combatVault` | COMBAT with no monsters opens the vault when this A word is 1 (cleared first); null: none | null | null |
| `checkParty` | CHECK_PARTY by the selector's offset from B: `{ effect, equals, bytes, range, levels }` (spec/A-games/sotsb/ecl.md, "Handlers read"); null: the shared PoR selectors | null | null |

SotSB (spec/A-games/sotsb/ecl.md): `areaZero` 17 with `areaZeroBlock` 2 (0x21934), `blockFile` { 1, 2 }
(0x26763 → 0x6EB0: two values a file), no `endingProgram`, `wallSetNone` [0xFF, 0x7F] (0x1E812–0x1E949),
`addExperience` { 0x212D4, 0x21300, 0x21311, 6 } (0x21324), the variants `nothing` for PROTECTION
(0x3C) and `addExperience` for 0x41; `damageRolls` perVictim (0x208B2) (LOAD_MONSTER's difficulty scaling,
0x1DF9F, is the rules profile's `difficulty`, procedures.md), `monsterFile` 1 (0x4150D), `findSpellFirst` 0 (0x20E4D), `destroyUnreadies` (0x21276),
`combatVault` 0x4AFC (ECL 0x4CFC, 0x1F5C2) and `checkParty` (0x1F051).

PROGRAM's other operands are the engine's: 0 the party screen (training), `endingProgram` the ending, 9 camp (the
script then continues where it was); any other is handed to the host as `program n`
([host-contracts.md §2](host-contracts.md#2-the-script-host-io)).

## 7. CALL targets

CALL compares its operand's raw 16-bit value (low byte, high byte, never translated) with the
targets below ([engine/ecl.md, "CALL targets"](../A-games/engine/ecl.md#call-targets-o-fun_29c3_2ccf),
[coab/ecl.md, "CALL targets"](../A-games/coab/ecl.md#call-targets-o-0x1b773)).

| EclMap field | Effect | PoR | CotAB |
|---|---|---|---|
| `calls.refresh` | the square registers refreshed, and the view drawn again when it changed (or per `refreshAfterPicture`) | 0x2C90 | 0x2E10 |
| `calls.sound` | a sound effect chosen by engine register 0x3DE through `callSounds` | 0xBA03 | 0xB200 |
| `calls.frame` | the current picture's next frame, then a wait of speed × `pauseMs`; −1: none | −1 | 0x6803 |
| `callSounds` | `by`: register value → effect; `other`: the effect for any other value (null: none) | by {8: 10, 10: 11}, other null | by {8: 10, 10: 11}, other 10 (0x069B0: DS:25C2 = 10, DS:25C4 = 11) |

Targets every game shares (engine constants): 0x8000 duel and 0x8001 solo combat (part A), 0xC01E
step forward with wrap-around, 0xC018 and 0xC01B nothing (the wall-ahead register is computed on
read; 0xC01B is dead in the DOS port). Any other value does nothing.

## 8. Listing

*Informative:* the two games' EclMaps in full are the values in §2.1, §4.2, §5 and §6–7. A builder
writing a profile for a new game fills every field; there are no defaults.

## Open

- The value B + 0x10D reads (uninitialised in the original) and the divisor-0 case of
  `divideRemainder` are the port's choices (§4.1, §5.1); no shipped script depends on either.
