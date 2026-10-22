# Records and tables

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

How the engine reaches a game's own data: the character record by **named fields** (the field map,
`F`), the rules tables of START.EXE by **named tables** (the table map, `T`), and the save files by
the profile's save layout. One procedure then serves every game: it reads `c[F.hp]` and
`T.thac0`, never `c[0x11B]` or `DS:3C7C`. What each field and table *means* in the original is
part A ([engine/records.md](../A-games/engine/records.md), [coab/records.md](../A-games/coab/records.md),
[coab/tables.md](../A-games/coab/tables.md)); this file says how a game names, locates and reads them.
The maps belong to the game profile ([profile.md](profile.md), fields `fields`, `tables`, `saves`).

## 1. Records stay native

1. A character, NPC or monster record is held in memory as a byte array **in its game's own layout**,
   exactly as the game's files hold it ([engine/records.md, "One record for everyone"](../A-games/engine/records.md#one-record-for-everyone-o)).
   There is no internal common model and no conversion on load or save.
2. Every access to a record field goes through the active game's field map (§2). Shared code MUST
   NOT use a raw record offset.
3. A record read from a game file and written back unchanged MUST be byte-identical; bytes the
   engine does not understand are carried along untouched. Pointer fields (item list, effect list,
   next, combat record) hold the original's stale far pointers in files; the port neither uses nor
   rewrites them, except where part A says the original writes them.
4. Items keep their 63-byte record and effects their 9-byte record in both games
   ([engine/records.md, "Item record"](../A-games/engine/records.md#item-record-63-bytes),
   ["Effect record"](../A-games/engine/records.md#effect-record-9-bytes-o)); they are read by the fixed
   offsets part A gives. A later game that changes either gets a field map of its own, built the same
   way as §2.
5. Where a game keeps **base and current** values (CotAB's abilities, [coab/records.md §2.1](../A-games/coab/records.md#21-base-vs-current-stats-o)),
   a permanent change (creation, Modify, a CON loss, the debug editor) writes both; a temporary
   change writes the current value only, and the game's stat routine
   ([procedures.md, "The current-stat routine"](procedures.md#11-the-current-stat-routine)) works it out
   again. In a game with one value per ability (PoR) the base and current fields are the same bytes,
   so both rules hold at once.
6. Port-only data never goes into a record: it goes in the `.GBR` sidecar ([C-port/storage.md](../C-port/storage.md)).

## 2. The field map (`CharFields`)

### 2.1 Rules

- A field is the **byte offset of its first element** in the record. A field the game does not have
  is **−1**; code that uses such a field MUST test it first and do what this spec says for a game
  without it (each case is named in [procedures.md](procedures.md)).
- `stat` and `baseStat` are lists of six offsets (STR, INT, WIS, DEX, CON, CHA), because CotAB
  interleaves base and current bytes; every other array is contiguous: element *i* at offset + *i*
  for byte arrays, + 2*i* for word arrays, + 4*i* for pointer arrays.
- Counts are part of the map: `size` (record length), `memorisedCount`, `knownCount`, `slotLevels`.
  Loops over memorised or known spells and over slot levels take their bound from the map.
- Multi-byte values are little-endian; "s8" marks a byte read as signed.
- Field names are the port's (normative for a builder who wants to share profiles with the
  reference; any names will do otherwise). Meanings and offsets are the originals' (**O**, part A).

### 2.2 The maps

Offsets in hexadecimal; counts in decimal. Part A references: PoR [engine/records.md, "Character record"](../A-games/engine/records.md#character-record-0x11d-bytes),
CotAB [coab/records.md §2](../A-games/coab/records.md#2-character-record-0x1a6--422-bytes) (which pairs every CotAB field with PoR's).

| Field | Size / type | Meaning | PoR | CotAB |
|---|---|---|---|---|
| `size` | count | record length in bytes | 285 (0x11D) | 422 (0x1A6) |
| `name` | 16 | Pascal string: length byte, then up to 15 characters | 0x00 | 0x00 |
| `stat` | 6 × byte | current (effective) STR INT WIS DEX CON CHA | 0x10 0x11 0x12 0x13 0x14 0x15 | 0x11 0x13 0x15 0x17 0x19 0x1B |
| `baseStat` | 6 × byte | base (permanent) abilities; PoR: the same bytes as `stat` | 0x10 0x11 0x12 0x13 0x14 0x15 | 0x10 0x12 0x14 0x16 0x18 0x1A |
| `strPct` | byte | current exceptional strength % | 0x16 | 0x1C |
| `baseStrPct` | byte | base exceptional strength %; PoR: the same byte | 0x16 | 0x1D |
| `memorised` | `memorisedCount` bytes | memorised spells: id = ready, id + 0x80 = still to be learned, 0 = empty | 0x17 | 0x1E |
| `memorisedCount` | count | memorised spell slots | 21 | 84 |
| `studyHours` | byte | PoR: scribing hours left; CotAB: hours left to finish learning | 0x2C | 0x72 |
| `thac0Base` | byte | 60 − base THAC0 of the best class | 0x2D | 0x73 |
| `race` | byte | race id (0 monster … 7 human) | 0x2E | 0x74 |
| `cls` | byte | class id 0–16 (single classes, then multi-classes) | 0x2F | 0x75 |
| `age` | u16 | age in years | 0x30 | 0x76 |
| `maxHp` | byte | maximum hit points | 0x32 | 0x78 |
| `known` | bytes | spells known: the byte at `known` + id is 1 (ids from 1, so element 0 is `maxHp`) | 0x32 | 0x78 |
| `knownCount` | count | highest spell id the known list covers | 56 | 100 |
| `sweep` | byte | fighter level for sweep attacks (else 1) | 0x6B | 0xDD |
| `sizeFlags` | byte | size/type flags; large if > 0x80 or (v & 7) > 1 | 0x6C | 0xDE |
| `saves` | 5 bytes | saving throws: death/poison, petrification, rod/staff/wand, breath, spell | 0x6D | 0xDF |
| `baseMove` | byte | base movement | 0x72 | 0xE4 |
| `hitDice` | s8 | highest class level (hit dice) | 0x73 | 0xE5 |
| `hpLevel` | s8 | the level a dual-class character changed class at (the HP recompute and the former-level rule use it) | −1 | 0xE6 |
| `abilityUses` | byte | the paladin's Cure Disease uses left | −1 | 0x191 |
| `classFlags` | byte | monster-class flags: 1 evil/extraplanar, 2 kobold/goblin kind, 4 orc/goblin kind, 8 giant class ([coab/effects.md §4](../A-games/coab/effects.md#4-monster-class-flags-char0x14b-o-0-in-every-player-character)); 0 in player characters | −1 | 0x14B |
| `drainLevels` | byte | levels lost to energy drain | 0x74 | 0xE7 |
| `drainHp` | byte | maximum HP those levels took | 0x75 | 0xE8 |
| `undead` | byte | undead class (turning) | 0x76 | 0xE9 |
| `thief` | 8 bytes | thief skills %: PP OL F/RT MS HS HN CW RL | 0x77 | 0xEA |
| `effects` | pointer | effect list head (stale in files) | 0x7F | 0xF2 |
| `misc83`, `misc86`, `misc87` | byte each | bytes of unknown use that the CotAB converter copies (**?**) | 0x83, 0x86, 0x87 | 0xF6, 0xF9, 0xFA |
| `morale` | byte | morale; bit 7 = NPC | 0x84 | 0xF7 |
| `npcShare` | byte | NPC treasure share | 0x85 | 0xF8 |
| `money` | 7 × u16 | copper, silver, electrum, gold, platinum, gems, jewelry | 0x88 | 0xFB |
| `levels` | 8 × s8 | class levels: cleric, druid, fighter, paladin, ranger, magic-user, thief, monk | 0x96 | 0x109 |
| `prevLevels` | 8 × s8 | former class levels of a dual-class character | −1 | 0x111 |
| `gender` | byte | 0 male, 1 female | 0x9E | 0x119 |
| `monsterType` | byte | monster type (racial handlers test it) | 0x9F | 0x11A |
| `alignment` | byte | alignment 0–8 | 0xA0 | 0x11B |
| `attacksBase` | 2 bytes | attacks per round × 2, hands 1 and 2 | 0xA1 | 0x11C |
| `natDice`, `natSides`, `natBonus` | 2 bytes each | natural attack per hand: dice count, sides, bonus | 0xA3, 0xA5, 0xA7 | 0x11E, 0x120, 0x122 |
| `acBase` | byte | base 60 − AC | 0xA9 | 0x124 |
| `strAdj` | byte | 1 = STR to-hit and damage adjustments apply | 0xAA | 0x125 |
| `id` | byte | random id for player characters, monster id for NPCs | 0xAB | 0x126 |
| `xp` | u32 | experience | 0xAC | 0x127 |
| `itemMask` | byte | class bitmask for item use (OR of `T.classBits` of the classes held) | 0xB0 | 0x12B |
| `hpRolled` | byte | hit points rolled, before CON | 0xB1 | 0x12C |
| `clericSlots`, `druidSlots`, `muSlots` | `slotLevels` bytes each | spell slots per spell level from level 1 | 0xB2, −1, 0xB5 | 0x12D, 0x132, 0x137 |
| `slotLevels` | count | spell levels per slot array | 3 | 5 |
| `xpBase`, `xpPerHp` | u16, byte | monster experience: base, per HP | 0xB8, 0xBA | 0x13C, 0x13E |
| `head`, `body` | byte each | portrait head and body | 0xBB, 0xBC | 0x13F, 0x140 |
| `iconHead`, `iconBody` | byte each | combat icon head and body | 0xBD, 0xBE | 0x141, 0x142 |
| `iconSlot` | byte | PoR: combat icon / picture id of a monster; CotAB: combat icon slot | 0xBF | 0x143 |
| `iconSize` | byte | icon size 1–4 | 0xC0 | 0x144 |
| `iconColours` | 6 bytes | icon part colours | 0xC1 | 0x145 |
| `itemCount` | byte | items carried | 0xC7 | 0x14C |
| `items` | pointer | item list head | 0xC8 | 0x14D |
| `readied` | 13 × pointer | readied items: slots 0–8, rings 9–10, arrows 11, quarrels 12 | 0xCC | 0x151 |
| `hands` | byte | hands in use | 0x100 | 0x185 |
| `saveBonus` | s8 | saving-throw bonus from readied items | 0x101 | 0x186 |
| `load` | u16 | encumbrance in coins | 0x102 | 0x187 |
| `next` | pointer | next record in the party list | 0x104 | 0x189 |
| `combat` | pointer | combat record | 0x108 | 0x18D |
| `status` | byte | 0 okay, 1 animated, 2 temporarily gone, 3 running, 4 unconscious, 5 dying, 6 dead, 7 stoned, 8 gone | 0x10C | 0x195 |
| `inPlay` | byte | can act (0 = out of play) | 0x10D | 0x196 |
| `side` | byte | 1 = monsters and hostile NPCs | 0x10E | 0x197 |
| `quick` | byte | computer-controlled | 0x10F | 0x198 |
| `thac0` | byte | 60 − THAC0 | 0x110 | 0x199 |
| `ac`, `acRear` | byte each | 60 − AC, front and rear | 0x111, 0x112 | 0x19A, 0x19B |
| `attacksLeft` | 2 bytes | attacks left this round, hands 1 and 2 | 0x113 | 0x19C |
| `dice`, `sides`, `bonus` | 2 bytes each | current damage per hand: dice count, sides, s8 bonus | 0x115, 0x117, 0x119 | 0x19E, 0x1A0, 0x1A2 |
| `hp` | byte | current hit points | 0x11B | 0x1A4 |
| `move` | byte | current movement | 0x11C | 0x1A5 |

The status names are read from the game (`T.statusNames`); the list in the table identifies them.
CotAB record byte 0x192 (set by the Hillsfar import) has no field: the script view reads it raw
([script-vm-map.md §4](script-vm-map.md#4-the-character-view-b)).

### 2.3 Checking a field map

A conforming build SHOULD check a game's field map against that game's own files: every pre-made
character (PoR `CHRDATA*.SAV`, CotAB `SAVE/CHRDATA1–6.SAV`) read through the map gives names,
levels, HP within their maximum, and statuses in range; and a record written back is identical
([VALIDATION.md](../VALIDATION.md) V2, V10).

## 3. The table map (`TableMap`)

### 3.1 Reading rule

1. Take the game's `START.EXE` and undo its EXEPACK compression
   ([engine/containers.md, "START.EXE"](../A-games/engine/containers.md#startexe-microsoft-exepack)); the
   result, **without** the MZ header, is the **load image**.
2. `ds` is the image offset of the data segment (the Turbo Pascal start-up's `mov dx,…; mov ds,dx`
   paragraph × 16: PoR 0xC7C0, CotAB 0xABE0, [coab/tables.md §1](../A-games/coab/tables.md#1-data-segment)).
3. Each table is a `TableRef { at, row }`: `at` is the DS offset of the table (of its entry 0 unless the
   table's line below says entries count from 1), `row` the size of one row where the table is indexed
   by a first key (class, race, level …), 0 where it is not. A table the game lacks has **`at` = −1**.
4. The byte for key *k*, index *i* is at image offset `ds + at + k · row + i`. Entry formats: byte,
   s8, u16 and u32 little-endian, and **Pascal strings** (a length byte, then the characters, in a
   field of `row` bytes).
5. The table map's addresses are normative; the values the tables hold are **informative** (D5):
   read them from the player's file, and check a decoder against
   [D-appendices/expected-values.md](../D-appendices/expected-values.md).

### 3.2 The maps

Addresses are DS offsets; "/ n" is the row size (decimal). "absent" is `at` = −1.

| Table | PoR | CotAB | Entry format and indexing (part A meaning) |
|---|---|---|---|
| `ds` | image 0xC7C0 | image 0xABE0 | the data segment's image offset |
| `classBits` | DS:05D6 | DS:3EA2 | byte per base class 0–7: item-use bit |
| `trainerBits` | DS:05DE | DS:3EAA | byte per base class: training-hall bit (halls match it against ECL 0x6DA8) |
| `hitDiceCount`, `hitDiceSides` | DS:08B6, DS:08BE | DS:081A, DS:0822 | byte per base class: hit dice count, sides |
| `hitDiceStop` | absent | DS:3EBB | byte per base class: the level from which hit points are fixed |
| `npcHeads` | DS:08C7 | absent | random NPC portrait heads, byte [gender · 8 + 1..8] |
| `npcBodiesCleric`, `…Fighter`, `…MagicUser`, `…Thief` | DS:08D7, 08E1, 08EB, 08F5 | absent | random NPC bodies by class group, byte [gender · 5 + 1..5] |
| `raceNames` | DS:0F03 / 10 | DS:0E9E / 10 | Pascal strings, entries 0–7 |
| `classNames` | DS:0D38 / 27 | DS:0CB8 / 27 | Pascal strings, class ids 0–16 (class 17 "monster" takes race 0's name) |
| `alignmentNames` | DS:0F53 / 17 | DS:0EEE / 17 | Pascal strings, 0–8 |
| `statusNames` | DS:1047 / 13 | DS:0FE2 / 13 | Pascal strings, statuses 0–8 |
| `genderNames` | DS:0FEC / 7 | DS:0F87 / 7 | Pascal strings, 0–1 |
| `coinNames` | DS:0FFA / 11 | DS:0F95 / 11 | Pascal strings, the seven money words |
| `coinValues` | DS:0D24 / 4 | DS:0CA4 / 4 | u32 × 5, copper … platinum, in units where gold is 200 |
| `frameTop`, `frameBottom`, `frameDivider` | absent | DS:0B50, DS:0BA0, DS:0B78 | byte per column 0–39: screen-frame tile (tile = `view.frame.tables.tile0` + value) |
| `frameLeft`, `frameRight` | absent | DS:0BE2, DS:0C0B | byte per row 0–23, as above |
| `cursorX`, `cursorY` | absent | DS:0A4A, DS:0A6A | byte per overland place (33): city cursor cell |
| `placeTerrain` | absent | DS:0354 | byte per overland place: terrain feature flags of its wilderness battlefield |
| `templeNames` | DS:011A / 41 | DS:00E6 / 41 | Pascal strings in menu order, the last "Exit" |
| `diseases` | DS:0113 | DS:00DF | byte, entries 1–6 at `at` + 1 … + 6: the disease effect types |
| `randomItems` | DS:0970 | DS:082E | u16 words; random-item record *m* starts at word *m* (byte `at` + 2*m*) |
| `scrollSpells` | absent | absent | bytes: a random scroll's spell ids by level, read at `at` + the profile's offset + a die (§14 of procedures.md, `scrollTable`); SotSB DS:580C |
| `sky` | DS:0C26 | DS:0A8A | 16 bytes: sky colours (eight, twice) |
| `itemWords` | DS:10BC / 21 | DS:1057 / 21 | Pascal strings, name word 1 at `at` (word *w* at `at` + (*w* − 1) · 21), 255 words |
| `wallDx`, `wallDy` | DS:2736, DS:273F | DS:2696, DS:269F | 9 × s8: direction vectors 0 N … 7 NW, 8 the square itself |
| `viewPieces` | DS:0C8C | DS:0ADA | the drawn view's piece tables, contiguous: 10 bytes first tile index, 10 widths, 10 heights (cells), 10 words base column, 10 words row, by kind 0–9 ([engine/maps-and-view.md, "Wall pieces"](../A-games/engine/maps-and-view.md#wall-pieces)) |
| `battleCells` | DS:2744 / 4 | DS:26A4 / 4 | 0x42 cells × 4 bytes: move, ?, sight, image slot |
| `headRecords`, `bodyRecords` | DS:286F, DS:287D | absent | byte per portrait number: HEAD3 / BODY3 record |
| `spellNames` | DS:2912 / 41 | DS:27E8 / 41 | Pascal strings, spell 1 at `at` (spell *id* at `at` + (*id* − 1) · 41) |
| `spellRecords` | DS:31FA / 16 | DS:37DC / 16 | 16-byte spell records, spell *id* at `at` + *id* · 16 ([engine/spells.md, "Tables"](../A-games/engine/spells.md#tables-o)) |
| `overlandMap` | DS:3648 | absent | 44 × 36 tile bytes |
| `overlandSpecials` | DS:0C36 / 6 | absent | the plot squares, 9 rows of 6 bytes |
| `overlandColumns` | DS:3C76 | absent | 5 bytes: area columns |
| `thac0` | DS:3C7C / 11 | DS:3E3A / 13 | byte [class · row + level]: 60 − THAC0 |
| `thiefBase` | DS:3CF3 / 8 | DS:3EC0 / 8 | byte [level · 8 + skill 1–8] |
| `thiefRace` | DS:3D3B / 8 | DS:3F20 / 8 | s8 [race · 8 + skill] |
| `thiefDex` | DS:3D4E / 5 | DS:3F33 / 5 | s8 [DEX · 5 + skill 1–5] |
| `raceLimits` | DS:3DA3 / 16 | DS:3F88 / 16 | 16 bytes a race: STR min and max by sex, the 18/xx cap by sex, then min and max of INT … CHA |
| `raceClasses` | DS:3E17 / 12 | DS:3FFA / 14 | count, then class ids |
| `startAge` | DS:3E5B / 28 | DS:404E / 28 | by race, per class column (4 bytes): u16 base, dice count, dice sides |
| `ageing` | DS:3F31 / 10 | DS:4124 / 10 | 5 × u16 by race: age-category thresholds |
| `classMins` | DS:3F81 / 6 | DS:4174 / 6 | 6 bytes a class id: ability minimums |
| `alignments` | DS:3FE7 / 10 | DS:41DA / 10 | count, then alignment ids, by class id |
| `conHp` | DS:408E | DS:4281 | s8 by CON: hit-point bonus |
| `xp` | DS:409B / 0x38, 14 levels | DS:4293 / 0x63, 13 levels | u32 [class · row + level · 4]; 0xFFFFFFFF = cannot reach |
| `clericSlots`, `muSlots` | DS:40BC / 3, DS:41D4 / 3 | DS:42BC / 5, DS:44AB / 5 | [level · row + column 1..row]: PoR absolute counts, CotAB increments |
| `paladinSlots`, `rangerSlots` | absent | DS:43E5 / 5, DS:4448 / 5 | CotAB increments; ranger columns 1–3 druid, 4–5 magic-user |
| `startGold` | DS:4263 / 2 | DS:45B3 / 2 | by base class: dice count, sides |
| `saves` | DS:426E / 45 | DS:45BE / 60 | byte [class · row + level · 5 + kind] |
| `fanDx1`, `fanDy1`, `fanDx2`, `fanDy2` | absent | DS:0A22, DS:0A2A, DS:0A12, DS:0A1A | 8 × s8 by direction: the area template's side-line offsets ([coab/effects.md §7](../A-games/coab/effects.md#7-the-target-hook-bolts-and-the-area-template-o-unless-marked)) |
| `gasCloud` | DS:290D | DS:27D9 | direction indices, entries from 1: Stinking Cloud's 4 squares |
| `killCloud` | absent | DS:27DD | direction indices, entries from 1: Cloudkill's 9 squares (overlapping `gasCloud`) |
| `placeRing`, `placeOrient`, `placeVec`, `placeOriginX`, `placeOriginY`, `placeAllow` | DS:02D2, 02E2, 02F2, 02F6, 02FE, 0306 | DS:02DC, 02EC, 02FC, 0300, 0308, 0310 | battle placement's scan ([engine/combat-rules.md, "Placement"](../A-games/engine/combat-rules.md#placement-o-fun_34c7_19f5-fun_34c7_1577-fun_34c7_1434)): ring directions and line orientations [4·F + ring], the line vectors' 8-way directions [d4], s8 line origins [4·(ring > 0) + d4], allowed columns [t·12 + row·2] |
| `furnishDx`, `furnishDy` | absent | DS:034B, DS:034F | s8, entries 1–4 (up, right, down, left): the chair cells beside a table |

**O** for every row: each address is the table that the cited part A routine indexes, and the
reference implementation's tests read every table of each game's own START.EXE through this map
(`web/test/tables.test.ts`). *Informative:* the coin-name table's DS:0F95 is its first length byte;
[coab/tables.md §2](../A-games/coab/tables.md#2-address-mapping-every-rules-table-in-the-data-segment)
cites DS:0F96, the first character.

### 3.3 Tables a game lacks

A procedure that needs a table tests `at` ≥ 0 and, when the table is absent, does what the game
without it does:

| Absent table | Then |
|---|---|
| `hitDiceStop` | no fixed hit points ([procedures.md §2](procedures.md#2-hit-points)) |
| `npcHeads`, `npcBodies*` | an NPC added by ADD_NPC keeps the portrait its record holds, and no class is picked for one (no draw) |
| `headRecords`, `bodyRecords` | no portrait picker at creation; portraits are the record's CHEAD/CBODY numbers |
| `overlandMap`, `overlandSpecials`, `overlandColumns` | no tile wilderness (the profile's `view.tileOverland` is empty) |
| `paladinSlots`, `rangerSlots` | no such slot sources (they are named only in the game's `rules.slots`) |
| `frame*` | the frame is the profile's fixed rope tiles (`view.frame.rope`) |
| `cursorX`, `cursorY` | no city cursor on the overland picture |
| `placeTerrain` | the game's `rules.wildBattle` does not use place flags |
| `fanDx1` … `fanDy2` | no area template; spell and special kinds that need it are not in that game's maps |
| `killCloud`, `furnishDx/Dy` | the game's `rules.clouds.kill` / `rules.mapField.furnish` are null |

Without START.EXE at all, nothing that reads a table can run: the port shows names as `#n`, and the
screens that need the tables (combat, camp, shops, temples, creation) say which file to import
([C-port/app-flow.md](../C-port/app-flow.md)).

### 3.4 Lengths that are rules

Table lengths that the original's code hard-codes are profile data, not table data: the number of
spells and named spells, spell levels (`rules.spells`), experience levels (`xp.levels`), the
temple's services (the length of `rules.temple`), the random-item records (indexed by the treasure
rules), and the 17 class ids (`rules.components`). The base classes are always eight
(cleric, druid, fighter, paladin, ranger, magic-user, thief, monk) and the races eight; a game with
more would need wider maps.

## 4. Save files (`SaveFiles`)

The save slot and character files keep their game's layout ([engine/savegame.md](../A-games/engine/savegame.md),
[coab/records.md §1 and §5](../A-games/coab/records.md#1-files-diff-vs-enginesavegamemd-files-and-engineinput-and-menusmd-character-files)).
The profile's `saves` says what differs:

| Field | Meaning | PoR | CotAB |
|---|---|---|---|
| `items` | extension of a character's item list file (63-byte records) | `ITM` | `SWG` |
| `effects` | extension of a character's effect list file (9-byte records) | `SPC` | `FX` |
| `roster` | extension of a roster character outside a saved game | `CHA` | `GUY` |
| `saveSize` | `SAVGAM<x>.DAT` size in bytes | 13 137 | 13 149 |
| `partyAt` | offset of the party count byte; the members' file stems (Pascal `string[40]` each) follow | 0x3208 | 0x3214 |
| `wallSetsAt` | offset of the wall-set slots 1–3 as (u16 record, u16 slot) pairs; −1 when the save keeps them in ECL A | −1 | 0x3208 |
| `exportName` | the port's exported save ZIP is `<exportName>-<x>.zip` ([C-port/storage.md §7.1](../C-port/storage.md#71-export)); port data | `poolrad-save` | `curse-save` |

A save is read and written through these values only; both shipped save files MUST load and save
back at their own size ([VALIDATION.md](../VALIDATION.md) V2). A CotAB save whose area word is 0
starts at the game's `ecl.areaZero` ([script-vm-map.md §6](script-vm-map.md#6-start-quit-and-other-flags)).

## 5. From the CotAB research: what a profile must hold

*Informative.* Moved from [coab/tables.md §4](../A-games/coab/tables.md#4-what-a-game-profile-must-hold),
where the CotAB research listed what the profile would need; each point is now a field of the
profile.

1. The DS base and the sound driver's segment and shift (`tables.ds`, [profile.md](profile.md) `sound`).
2. Every table address with its stride (§3.2), and the counts: spells 56/67 → 100, random-item
   records 19 → 7, temple services 10 → 11, top level 13 (`rules`, `tables.xp.levels`).
3. The spell-class encoding (PoR 0 cleric, 1 magic-user, 2 item; CotAB 0 cleric, 1 druid, 2 magic-user,
   3 item) and the slot layout (`rules.spells`, the field map's slot arrays).
4. The slot model: absolute per-level tables or increments from per-class start levels, and the
   learning rules ([procedures.md §1](procedures.md#1-spell-slots)).
5. Rules that live in code rather than tables: demi-human limits, extra attacks, the hit-point rule,
   starting money, the race menu, temple prices and services, the thief-skill item hooks
   ([procedures.md](procedures.md)).
6. Values the first port hard-coded and CotAB changes (class bits, trainer bits, sky colours, temple
   list): all read through `T` now.
7. Tables only PoR has: marked absent (§3.3).
8. The character record: the field map (§2).

### SotSB's maps (2026-10-22)

The character map `SOTSB_FIELDS` (439 bytes, spec/A-games/sotsb/records.md §2) adds `classCount`: the
class levels a record holds, 8 in PoR and CotAB, 7 in SotSB (no monk), which every loop over the levels
reads. `SOTSB_TABLES` follows spec/A-games/sotsb/tables.md §2; the frame, overland cursor and terrain
tables are absent until found; `diseases` is at DS:1B3D (4 entries), `randomItems` at DS:0A28 and the new
`scrollSpells` at DS:580C. The save files (`SOTSB_FILES`) add
`itemRecord` (a character's item file in 67-byte records, the last four bytes SotSB's +0x3F chain pointer,
written 0) and `codeSize` (0: no script code in the save; the area's record is loaded again).

## Open

- The meaning of `misc83`, `misc86`, `misc87` in PoR (copied by the CotAB converter, and never read in CotAB, O) and of byte 1 of a
  battlefield cell are **?** in part A; the maps only locate them.
