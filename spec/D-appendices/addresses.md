# Address index

> **Status: complete** (work-plan steps 5 and 6, [AUDIT.md](../AUDIT.md) §8). Informative. Part D of
> the [specification](../README.md). The notations; the routines behind part B's procedures and maps
> (both games); every START.EXE table of the table map (both games); every PoR routine part A cites,
> with its CotAB equivalent where one is named; the PoR routines only parts B and C cite; every CotAB
> address parts A–C cite.

## Notations

| Notation | Meaning |
|---|---|
| `seg:off`, `FUN_seg_off` | PoR: Ghidra address and function name in the merged image (START.EXE unpacked, GAME.OVR overlays merged; load segment 0x1000; linear = seg · 16 + off) |
| `0x2555D` | CotAB: offset in the working image (START.EXE unpacked, overlays merged; [coab/README.md, "Working image"](../A-games/coab/README.md#working-image)) |
| `ssss:oooo` in CotAB files | the image paragraph and offset (`4aab:0523` = image 0x4AFD3) |
| `image 0x…` in PoR files | an offset in PoR's merged image (`0x4245A` = `FUN_5216_02fa`) |
| bare `0x5245A` in PoR's effects.md and sound.md | a Ghidra linear address: image + 0x10000 |
| `DS:x` | offset *x* in the game's data segment: PoR image 0xC7C0 + *x*, CotAB image 0xABE0 + *x* ([B-model/records-and-tables.md §3.1](../B-model/records-and-tables.md#31-reading-rule)) |
| ECL `0x49F2` | a script address in the game's own numbering; part B and the engine use PoR's (canonical) numbering ([B-model/script-vm-map.md §1](../B-model/script-vm-map.md#1-canonical-numbering)) |
| `A[x]`, `B[x]` | byte offset *x* into the word array behind ECL A or B (ECL address = base + *x* / 2) |
| handler `3723_xxxx` | a PoR effect handler in segment 3723 (linear 0x37230 + *x*) |

## Routines behind part B's procedures

| Procedure (part B) | PoR | CotAB |
|---|---|---|
| spell slots ([procedures.md §1](../B-model/procedures.md#1-spell-slots)) | `FUN_51cf_0000`; WIS bonus `FUN_51cf_01af` | 0x50480; Ring of Wizardry 0x507C3 |
| hit points (§2) | `FUN_417f_4235` (creation), `FUN_417f_29ae` (training) | 0x3B230 (creation 0x389FB, training 0x3BE67) |
| starting money (§3) | creation, `DS:4263` | 0x388DB–0x389EA |
| caster level (§4) | `FUN_10ba_26c2` | 0x4F8BF (gate 0x4F8C5), former levels 0x51841 |
| thief skills (§5) | `FUN_51cf_0329` | 0x50F5A |
| saving throws (§6) | `FUN_51cf_0255` | 0x50C6B |
| race menu (§7) | `FUN_417f_056c` | 0x3708F |
| joining (§8) | Add (`FUN_417f_0161`) | 0x36848 + 0x3648..0x3A24 |
| temple (§9) | `FUN_2d14_0d09`, heal `FUN_2d14_09d7`, Raise Dead `FUN_2d14_0510` | 0x1CB35 …, Heal 0x1CBF6–0x1CCC5 |
| paladin abilities (§10) | — | View menu 0x3D530 + 0x35F0 / 0x3655 / 0x36D7 / 0x37EC; refill 0x27350 + 0x28EF |
| current-stat routine (§11) | — | 0x4C389 (`4aab:18d9`), HP 0x4C72B–0x4C875 |
| add effect, remove, heal (§12) | `FUN_5216_1656`, `FUN_5216_0e52`, `FUN_5216_0026`, `FUN_5216_175d` | 0x4CD91, 0x4ABBA, 0x4CE85 |
| STR rule (§12.3) | `FUN_5216_115c`, encoding `FUN_5216_10e4` / `110d` | 0x4C1D8, 0x4C160 |
| character import (§13) | — | `323c:14b3`, then `5047:03c6` |
| random treasure (§14) | TREASURE 29c3:19B0, `FUN_4c2d_1010` | 0x1A5A3–0x1A6E2, 0x42D97 |
| casting (§15.1) | `FUN_3aae_2414`, `FUN_4e53_0c20`, `FUN_3aae_02f9`, `FUN_3334_0545` | 0x2CCBD, 0x45251 (miscast 0x45373), 0x2AA62 / 0x4CC3C, 0x236CB |
| bolt (§15.2) | `FUN_4e53_28bc`, `FUN_4e53_295b` | 0x478F6, 0x479B4 |
| clouds (§15.3) | `FUN_5216_0ae7`, Stinking Cloud `FUN_4e53_1b11` | 0x4B8F7, 0x4675B, Cloudkill 0x48F05 |
| battlefields (§15.4) | `FUN_34c7_1e31`, wilderness `FUN_34c7_11b4` (flags `08a4`, river `0bde`/`0b97`, trees `0d13`, scatter `0e9e`, finishing `0000`), map areas `FUN_34c7_0810` | 0x25CC0, wilderness 0x25C58 (river 0x25690/0x2563C, trees 0x2579B, scatter 0x25ADA/0x25932), map areas 0x2555D, furnishing 0x24D63 |
| demo (§16) | — | 0x17F–0x352, 0x1C001–0x1C084, flag DS:4FD5 |

## Routines behind the maps

| Map (part B) | PoR | CotAB |
|---|---|---|
| event dispatch ([vocabularies.md §2](../B-model/vocabularies.md#2-the-effect-system-effectrules)) | `FUN_5216_02fa` (image 0x4245A), per type `FUN_5216_0160`, handler call `FUN_5216_0000` | 0x4AEC4, 0x4AD2A, 0x4AB77 |
| effect handlers | table at DS:6828 + 4 · type, segment 3723 | DS:6FC0 + 4 · type (filled at 0x29E28, 0x4AA3A) |
| item handlers | `FUN_4894_14d0` → handlers 128–139 | 0x3F034 (kinds), generic 147 at 0x29A23 |
| spell handlers ([vocabularies.md §4](../B-model/vocabularies.md#4-spell-kinds)) | DS:6B84 + 4 · id, filled by `FUN_4e53_3413`; durations `FUN_4e53_07d6` | DS:72BA, filled at 0x4A4FF; durations 0x44E02 |
| item spells | `FUN_4894_1a8a` (0x3A468) | 0x3F9F1 (0x3FA0D) |
| script VM ([script-vm-map.md](../B-model/script-vm-map.md)) | memory `FUN_2fea_06fb` / `0e0c` / `0c77`, view `FUN_2fea_07bc` / `0a74`, skip `FUN_2fea_1ea6`, CALL `FUN_29c3_2ccf` | memory 0x200F3 / 0x208E6 / 0x20722, view 0x201B4 / 0x2051F, reader 0x1FA02, CALL 0x1B773 |
| title, credits ([profile.md §3.2](../B-model/profile.md#32-the-title-titlescript)) | 290c:06AD (lightning), credits `290c:0206` | title 0x18702, credits 0x182AD |
| ending (§3.5) | `FUN_4804_02a4` | 0x3D02C |
| sky art (§3.1) | — | 0x53824 |
| frames | `FUN_13f1_0000` | 0x1330, 0x1403 |

## Tables

Every table the table map names ([B-model/records-and-tables.md §3.2](../B-model/records-and-tables.md#32-the-maps),
which gives each entry's format and meaning), both games: the DS offset of the table (of its entry 0, or
of entry 1 where the entries say "from 1"), the image offset (the data segment's image offset + DS
offset: PoR 0xC7C0, CotAB 0xABE0), the row size where the table is indexed by a first key, and the
entries the procedures read. Generated from the reference's table map and the test-vector generator's
table list (`web/headless/vector-cases.ts`, [test-vectors.md §6](test-vectors.md#6-the-generator-and-the-golden-outputs-informative));
the SHA-256 of each table's bytes is in [expected-values.md §7](expected-values.md#7-decoded-files-and-tables-v1).

<!-- generated:tables -->
| Table | PoR DS | PoR image | CotAB DS | CotAB image | Row | PoR entries | CotAB entries |
|---|---|---|---|---|---|---|---|
| `classBits` | DS:05D6 | 0x0CD96 | DS:3EA2 | 0x0EA82 | – | 8 base classes | 8 base classes |
| `trainerBits` | DS:05DE | 0x0CD9E | DS:3EAA | 0x0EA8A | – | 8 base classes | 8 base classes |
| `hitDiceCount` | DS:08B6 | 0x0D076 | DS:081A | 0x0B3FA | – | 8 base classes | 8 base classes |
| `hitDiceSides` | DS:08BE | 0x0D07E | DS:0822 | 0x0B402 | – | 8 base classes | 8 base classes |
| `hitDiceStop` | absent | – | DS:3EBB | 0x0EA9B | – | – | 8 base classes |
| `npcHeads` | DS:08C7 | 0x0D087 | absent | – | – | 2 genders × 8, from 1 | – |
| `npcBodiesCleric` | DS:08D7 | 0x0D097 | absent | – | – | 2 genders × 5, from 1 | – |
| `npcBodiesFighter` | DS:08E1 | 0x0D0A1 | absent | – | – | 2 genders × 5, from 1 | – |
| `npcBodiesMagicUser` | DS:08EB | 0x0D0AB | absent | – | – | 2 genders × 5, from 1 | – |
| `npcBodiesThief` | DS:08F5 | 0x0D0B5 | absent | – | – | 2 genders × 5, from 1 | – |
| `raceNames` | DS:0F03 | 0x0D6C3 | DS:0E9E | 0x0BA7E | 10 | 8 races × 10 | 8 races × 10 |
| `classNames` | DS:0D38 | 0x0D4F8 | DS:0CB8 | 0x0B898 | 27 | 17 class ids × 27 | 17 class ids × 27 |
| `alignmentNames` | DS:0F53 | 0x0D713 | DS:0EEE | 0x0BACE | 17 | 9 × 17 | 9 × 17 |
| `statusNames` | DS:1047 | 0x0D807 | DS:0FE2 | 0x0BBC2 | 13 | 9 × 13 | 9 × 13 |
| `genderNames` | DS:0FEC | 0x0D7AC | DS:0F87 | 0x0BB67 | 7 | 2 × 7 | 2 × 7 |
| `coinNames` | DS:0FFA | 0x0D7BA | DS:0F95 | 0x0BB75 | 11 | 7 × 11 | 7 × 11 |
| `coinValues` | DS:0D24 | 0x0D4E4 | DS:0CA4 | 0x0B884 | 4 | 5 × u32 | 5 × u32 |
| `frameTop` | absent | – | DS:0B50 | 0x0B730 | – | – | 40 columns |
| `frameBottom` | absent | – | DS:0BA0 | 0x0B780 | – | – | 40 columns |
| `frameLeft` | absent | – | DS:0BE2 | 0x0B7C2 | – | – | 24 rows |
| `frameRight` | absent | – | DS:0C0B | 0x0B7EB | – | – | 24 rows |
| `frameDivider` | absent | – | DS:0B78 | 0x0B758 | – | – | 40 columns |
| `cursorX` | absent | – | DS:0A4A | 0x0B62A | – | – | 33 places |
| `cursorY` | absent | – | DS:0A6A | 0x0B64A | – | – | 33 places |
| `placeTerrain` | absent | – | DS:0354 | 0x0AF34 | – | – | 33 places (I) |
| `templeNames` | DS:011A | 0x0C8DA | DS:00E6 | 0x0ACC6 | 41 | 10 × 41 (the services, then Exit) | 11 × 41 (the services, then Exit) |
| `diseases` | DS:0113 | 0x0C8D3 | DS:00DF | 0x0ACBF | – | 6, from 1 | 6, from 1 |
| `randomItems` | DS:0970 | 0x0D130 | DS:082E | 0x0B40E | – | 19 records × 8 u16, word m = 8j + 1 | 7 records × 8 u16, word m = 8j + 1 |
| `scrollSpells` | absent | – | absent | – | – | – | – |
| `sky` | DS:0C26 | 0x0D3E6 | DS:0A8A | 0x0B66A | – | 16 | 16 |
| `itemWords` | DS:10BC | 0x0D87C | DS:1057 | 0x0BC37 | 21 | 255 words × 21, from word 1 | 255 words × 21, from word 1 |
| `wallDx` | DS:2736 | 0x0EEF6 | DS:2696 | 0x0D276 | – | 9 directions | 9 directions |
| `wallDy` | DS:273F | 0x0EEFF | DS:269F | 0x0D27F | – | 9 directions | 9 directions |
| `battleCells` | DS:2744 | 0x0EF04 | DS:26A4 | 0x0D284 | 4 | 0x42 cells × 4 | 0x42 cells × 4 |
| `headRecords` | DS:286F | 0x0F02F | absent | – | – | heads 1–14 | – |
| `bodyRecords` | DS:287D | 0x0F03D | absent | – | – | bodies 1–12 | – |
| `spellNames` | DS:2912 | 0x0F0D2 | DS:27E8 | 0x0D3C8 | 41 | 56 named spells × 41, from spell 1 | 100 named spells × 41, from spell 1 |
| `spellRecords` | DS:31FA | 0x0F9BA | DS:37DC | 0x0E3BC | 16 | 67 spell records × 16, from spell 1 | 100 spell records × 16, from spell 1 |
| `overlandMap` | DS:3648 | 0x0FE08 | absent | – | – | 44 × 36 tiles | – |
| `overlandSpecials` | DS:0C36 | 0x0D3F6 | absent | – | 6 | 9 × 6 | – |
| `overlandColumns` | DS:3C76 | 0x10436 | absent | – | – | 5 | – |
| `thac0` | DS:3C7C | 0x1043C | DS:3E3A | 0x0EA1A | 11 / 13 | 8 classes × 11 (levels 1–10) | 8 classes × 13 (levels 1–12) |
| `thiefBase` | DS:3CF3 | 0x104B3 | DS:3EC0 | 0x0EAA0 | 8 | levels 1–9 × 8 skills | levels 1–12 × 8 skills |
| `thiefRace` | DS:3D3B | 0x104FB | DS:3F20 | 0x0EB00 | 8 | 8 races × 8 skills | 8 races × 8 skills |
| `thiefDex` | DS:3D4E | 0x1050E | DS:3F33 | 0x0EB13 | 5 | DEX 0–25 × 5 skills | DEX 0–25 × 5 skills |
| `raceLimits` | DS:3DA3 | 0x10563 | DS:3F88 | 0x0EB68 | 16 | 8 races × 16 | 8 races × 16 |
| `raceClasses` | DS:3E17 | 0x105D7 | DS:3FFA | 0x0EBDA | 12 / 14 | 8 races × 12 | 8 races × 14 |
| `startAge` | DS:3E5B | 0x1061B | DS:404E | 0x0EC2E | 28 | 8 races × 7 columns × 4 | 8 races × 7 columns × 4 |
| `ageing` | DS:3F31 | 0x106F1 | DS:4124 | 0x0ED04 | 10 | 8 races × 5 u16 | 8 races × 5 u16 |
| `classMins` | DS:3F81 | 0x10741 | DS:4174 | 0x0ED54 | 6 | 17 class ids × 6 | 17 class ids × 6 |
| `alignments` | DS:3FE7 | 0x107A7 | DS:41DA | 0x0EDBA | 10 | 17 class ids × 10 | 17 class ids × 10 |
| `conHp` | DS:408E | 0x1084E | DS:4281 | 0x0EE61 | – | CON 0–25 | CON 0–25 |
| `xp` | DS:409B | 0x1085B | DS:4293 | 0x0EE73 | 56 / 99 | 8 classes × 14 levels × u32 | 8 classes × 0x63 (13 levels × u32 read) |
| `clericSlots` | DS:40BC | 0x1087C | DS:42BC | 0x0EE9C | 3 / 5 | levels 1–9 × 3 | levels 1–11 × 5 |
| `muSlots` | DS:41D4 | 0x10994 | DS:44AB | 0x0F08B | 3 / 5 | levels 1–9 × 3 | levels 1–11 × 5 |
| `paladinSlots` | absent | – | DS:43E5 | 0x0EFC5 | 5 | – | levels 9–11 × 5 |
| `rangerSlots` | absent | – | DS:4448 | 0x0F028 | 5 | – | levels 8–11 × 5 |
| `startGold` | DS:4263 | 0x10A23 | DS:45B3 | 0x0F193 | 2 | 8 base classes × 2 | 8 base classes × 2 |
| `saves` | DS:426E | 0x10A2E | DS:45BE | 0x0F19E | 45 / 60 | 8 classes × 45 (levels 0–8 × 5) | 8 classes × 60 (levels 1–12 × 5) |
| `fanDx1` | absent | – | DS:0A22 | 0x0B602 | – | – | 8 directions |
| `fanDy1` | absent | – | DS:0A2A | 0x0B60A | – | – | 8 directions |
| `fanDx2` | absent | – | DS:0A12 | 0x0B5F2 | – | – | 8 directions |
| `fanDy2` | absent | – | DS:0A1A | 0x0B5FA | – | – | 8 directions |
| `gasCloud` | DS:290D | 0x0F0CD | DS:27D9 | 0x0D3B9 | – | 4 squares, from 1 | 4 squares, from 1 |
| `killCloud` | absent | – | DS:27DD | 0x0D3BD | – | – | 9 squares, from 1 |
| `furnishDx` | absent | – | DS:034B | 0x0AF2B | – | – | 4 sides, from 1 |
| `furnishDy` | absent | – | DS:034F | 0x0AF2F | – | – | 4 sides, from 1 |
| `viewPieces` | DS:0C8C | 0x0D44C | DS:0ADA | 0x0B6BA | – | 10 kinds × (3 bytes + 2 words) | 10 kinds × (3 bytes + 2 words) |
| `placeRing` | DS:02D2 | 0x0CA92 | DS:02DC | 0x0AEBC | 4 | 4 orientations × 4 rings | 4 orientations × 4 rings |
| `placeOrient` | DS:02E2 | 0x0CAA2 | DS:02EC | 0x0AECC | 4 | 4 orientations × 4 rings | 4 orientations × 4 rings |
| `placeVec` | DS:02F2 | 0x0CAB2 | DS:02FC | 0x0AEDC | – | 4 line vectors | 4 line vectors |
| `placeOriginX` | DS:02F6 | 0x0CAB6 | DS:0300 | 0x0AEE0 | – | 2 (ring 0, rings 1+) × 4 | 2 (ring 0, rings 1+) × 4 |
| `placeOriginY` | DS:02FE | 0x0CABE | DS:0308 | 0x0AEE8 | – | 2 (ring 0, rings 1+) × 4 | 2 (ring 0, rings 1+) × 4 |
| `placeAllow` | DS:0306 | 0x0CAC6 | DS:0310 | 0x0AEF0 | 12 | 5 × 6 rows × [first, last] | 5 × 6 rows × [first, last] |
<!-- /generated:tables -->

## Routines part A cites

Every PoR routine named `FUN_seg_off` (or `seg_off`) in part A, with its image offset
((seg − 0x1000)·16 + off), the part A files that cite it (engine files by name, `por/` and
`coab/` by path), and the CotAB routine where a CotAB file or part B names its equivalent. An empty
CotAB cell means not yet named, not absent; "(in 0x…)" gives the routine that contains a CotAB
address the spec cites inside a routine. Generated from the part A files on 2026-10-21 (the list
follows their citations; a routine cited later is added here with them).

| PoR | Image | Cited in | CotAB |
|---|---|---|---|
| `FUN_1000_34ab` | 0x034AB | camp-and-time |  |
| `FUN_10b0_005c` | 0x00B5C | combat-rules |  |
| `FUN_10ba_0000` | 0x00BA0 | combat-rules, records |  |
| `FUN_10ba_01fb` | 0x00D9B | combat-rules, records |  |
| `FUN_10ba_0282` | 0x00E22 | records |  |
| `FUN_10ba_03a0` | 0x00F40 | combat-rules, records |  |
| `FUN_10ba_0442` | 0x00FE2 | records, town |  |
| `FUN_10ba_0767` | 0x01307 | graphics, input-and-menus |  |
| `FUN_10ba_08ef` | 0x0148F | records |  |
| `FUN_10ba_0973` | 0x01513 | combat-visuals |  |
| `FUN_10ba_09e3` | 0x01583 | combat-rules, combat-visuals |  |
| `FUN_10ba_0b73` | 0x01713 | combat-rules |  |
| `FUN_10ba_0bb8` | 0x01758 | coab/records, chargen-and-progression, combat-rules, effects, records, town | 0x4DC70 |
| `FUN_10ba_0fe2` | 0x01B82 | combat-visuals |  |
| `FUN_10ba_10e6` | 0x01C86 | records |  |
| `FUN_10ba_1168` | 0x01D08 | combat-rules, records |  |
| `FUN_10ba_11ea` | 0x01D8A | combat-rules, records |  |
| `FUN_10ba_1282` | 0x01E22 | records |  |
| `FUN_10ba_1325` | 0x01EC5 | records |  |
| `FUN_10ba_13ab` | 0x01F4B | records |  |
| `FUN_10ba_148b` | 0x0202B | coab/combat, combat-rules, spells | 0x4E570 |
| `FUN_10ba_1509` | 0x020A9 | camp-and-time |  |
| `FUN_10ba_1693` | 0x02233 | combat-rules |  |
| `FUN_10ba_16ec` | 0x0228C | combat-rules |  |
| `FUN_10ba_1816` | 0x023B6 | graphics |  |
| `FUN_10ba_1892` | 0x02432 | combat-visuals |  |
| `FUN_10ba_19de` | 0x0257E | combat-visuals |  |
| `FUN_10ba_1a29` | 0x025C9 | combat-visuals |  |
| `FUN_10ba_1feb` | 0x02B8B | combat-rules, combat-visuals, effects, sound |  |
| `FUN_10ba_2199` | 0x02D39 | effects |  |
| `FUN_10ba_2228` | 0x02DC8 | combat-rules, effects, spells |  |
| `FUN_10ba_234a` | 0x02EEA | spells |  |
| `FUN_10ba_23b7` | 0x02F57 | combat-rules |  |
| `FUN_10ba_23db` | 0x02F7B | combat-rules, effects |  |
| `FUN_10ba_2433` | 0x02FD3 | combat-rules |  |
| `FUN_10ba_255b` | 0x030FB | combat-rules |  |
| `FUN_10ba_2637` | 0x031D7 | combat-rules, effects |  |
| `FUN_10ba_2686` | 0x03226 | combat-rules |  |
| `FUN_10ba_26c2` | 0x03262 | coab/tables, effects, spells | 0x4F8BF |
| `FUN_10ba_27d9` | 0x03379 | camp-and-time, combat-rules |  |
| `FUN_10ba_2b88` | 0x03728 | combat-rules, combat-visuals |  |
| `FUN_10ba_2e03` | 0x039A3 | combat-rules |  |
| `FUN_10ba_2e8b` | 0x03A2B | combat-rules, effects, records |  |
| `FUN_13db_003e` | 0x03DEE | effects |  |
| `FUN_13f1_0000` | 0x03F10 | input-and-menus | 0x1330 |
| `FUN_13f1_02e8` | 0x041F8 | combat-rules, input-and-menus, por/title-and-credits |  |
| `FUN_1428_002a` | 0x042AA | input-and-menus |  |
| `FUN_1464_007b` | 0x046BB | graphics |  |
| `FUN_1464_0111` | 0x04751 | graphics |  |
| `FUN_1464_02a5` | 0x048E5 | graphics |  |
| `FUN_1464_08d4` | 0x04F14 | graphics, maps-and-view |  |
| `FUN_1464_0d71` | 0x053B1 | graphics |  |
| `FUN_1464_15c7` | 0x05C07 | overland |  |
| `FUN_1464_1b52` | 0x06192 | maps-and-view, overland |  |
| `FUN_1464_1e5c` | 0x0649C | graphics, input-and-menus, overland |  |
| `FUN_1464_2632` | 0x06C72 | maps-and-view |  |
| `FUN_1464_2a0d` | 0x0704D | combat-visuals |  |
| `FUN_1709_0626` | 0x076B6 | graphics, input-and-menus |  |
| `FUN_1709_0768` | 0x077F8 | graphics |  |
| `FUN_1709_09e3` | 0x07A73 | input-and-menus |  |
| `FUN_1709_0c3f` | 0x07CCF | graphics, por/ending |  |
| `FUN_1709_0dbe` | 0x07E4E | camp-and-time, combat-rules, ecl, por/ending |  |
| `FUN_1709_0dd3` | 0x07E63 | graphics |  |
| `FUN_1802_0425` | 0x08445 | input-and-menus |  |
| `FUN_1802_050f` | 0x0852F | containers |  |
| `FUN_1802_0716` | 0x08736 | containers |  |
| `FUN_1802_094a` | 0x0896A | ecl |  |
| `FUN_1899_0000` | 0x08990 | camp-and-time, sound |  |
| `FUN_18ae_00dc` | 0x08BBC | main-loop |  |
| `FUN_1af8_0c10` | 0x0BB90 | effects |  |
| `FUN_1af8_11c0` | 0x0C140 | combat-rules |  |
| `FUN_290c_0206` | 0x192C6 | input-and-menus | 0x182AD |
| `FUN_290c_0627` | 0x196E7 | input-and-menus |  |
| `FUN_298d_00fd` | 0x199CD | input-and-menus |  |
| `FUN_29c3_179b` | 0x1B3CB | combat-rules, town |  |
| `FUN_29c3_2ccf` | 0x1C8FF | ecl, sound | 0x1B773 |
| `FUN_29c3_2dd3` | 0x1CA03 | camp-and-time, main-loop | 0x1B8E4 |
| `FUN_29c3_3171` | 0x1CDA1 | ecl | 0x1BE57 |
| `FUN_29c3_31b4` | 0x1CDE4 | main-loop, savegame | 0x1BEC7 |
| `FUN_29c3_32f8` | 0x1CF28 | input-and-menus, main-loop, sound | 0x1BFA8 |
| `FUN_2d14_0013` | 0x1D153 | town |  |
| `FUN_2d14_00bf` | 0x1D1FF | town |  |
| `FUN_2d14_0401` | 0x1D541 | town |  |
| `FUN_2d14_0510` | 0x1D650 | town |  |
| `FUN_2d14_09d7` | 0x1DB17 | town |  |
| `FUN_2d14_0d09` | 0x1DE49 | town |  |
| `FUN_2e08_0000` | 0x1E080 | chargen-and-progression, combat-rules |  |
| `FUN_2e08_0355` | 0x1E3D5 | chargen-and-progression, combat-rules |  |
| `FUN_2e08_04c9` | 0x1E549 | combat-rules, ecl |  |
| `FUN_2e08_0916` | 0x1E996 | combat-rules |  |
| `FUN_2e08_0d38` | 0x1EDB8 | town |  |
| `FUN_2e08_0ecd` | 0x1EF4D | combat-rules, town |  |
| `FUN_2e08_11ac` | 0x1F22C | combat-rules, ecl |  |
| `FUN_2e08_12e8` | 0x1F368 | combat-rules, town |  |
| `FUN_2e08_1527` | 0x1F5A7 | combat-rules, ecl, town |  |
| `FUN_2f70_0239` | 0x1F939 | town |  |
| `FUN_2f70_0361` | 0x1FA61 | town |  |
| `FUN_2f70_053e` | 0x1FC3E | town |  |
| `FUN_2fea_0000` | 0x1FEA0 | ecl | 0x1FA02 |
| `FUN_2fea_0136` | 0x1FFD6 | ecl | 0x1FB38 |
| `FUN_2fea_01b6` | 0x20056 | ecl, main-loop, maps-and-view | 0x1FBB8 |
| `FUN_2fea_0482` | 0x20322 | combat-rules |  |
| `FUN_2fea_054e` | 0x203EE | graphics, maps-and-view, overland |  |
| `FUN_2fea_06d3` | 0x20573 | ecl | 0x200CB |
| `FUN_2fea_06fb` | 0x2059B | ecl | 0x200F3 |
| `FUN_2fea_07bc` | 0x2065C | ecl | 0x201B4 |
| `FUN_2fea_0a74` | 0x20914 | ecl | 0x2051F |
| `FUN_2fea_0c77` | 0x20B17 | ecl | 0x20722 |
| `FUN_2fea_0e0c` | 0x20CAC | ecl | 0x208E6 |
| `FUN_2fea_1153` | 0x20FF3 | ecl | 0x20C49 |
| `FUN_2fea_1815` | 0x216B5 | ecl |  |
| `FUN_2fea_1a6f` | 0x2190F | combat-rules |  |
| `FUN_2fea_1ea6` | 0x21D46 | ecl | 0x219A2 |
| `FUN_2fea_229a` | 0x2213A | combat-rules |  |
| `FUN_320c_0000` | 0x220C0 | combat-rules, combat-visuals |  |
| `FUN_320c_007a` | 0x2213A | combat-rules |  |
| `FUN_320c_0131` | 0x221F1 | combat-rules |  |
| `FUN_320c_01f6` | 0x222B6 | combat-rules |  |
| `FUN_320c_031a` | 0x223DA | coab/combat, combat-rules | 0x2213E (the queued cast; PoR 0x22412) |
| `FUN_320c_0666` | 0x22726 | combat-rules |  |
| `FUN_320c_0880` | 0x22940 | camp-and-time, combat-rules |  |
| `FUN_320c_09df` | 0x22A9F | battlefield, combat-rules | 0x22ADD (in 0x22856) |
| `FUN_320c_0d45` | 0x22E05 | combat-rules |  |
| `FUN_320c_0e45` | 0x22F05 | combat-rules |  |
| `FUN_320c_0fff` | 0x230BF | combat-rules |  |
| `FUN_320c_10f6` | 0x231B6 | combat-rules |  |
| `FUN_320c_122b` | 0x232EB | combat-rules |  |
| `FUN_3334_000f` | 0x2334F | coab/combat, combat-ai, combat-rules | 0x23238 (the queued cast; PoR 0x2347C) |
| `FUN_3334_01c7` | 0x23507 | combat-ai |  |
| `FUN_3334_0203` | 0x23543 | combat-ai |  |
| `FUN_3334_0255` | 0x23595 | combat-ai |  |
| `FUN_3334_02eb` | 0x2362B | coab/combat, combat-ai, combat-rules, spells | 0x23471 |
| `FUN_3334_03e4` | 0x23724 | coab/spells, combat-ai | 0x2356A |
| `FUN_3334_0545` | 0x23885 | coab/combat, combat-ai, combat-rules | 0x236CB |
| `FUN_3334_0675` | 0x239B5 | battlefield, combat-ai | 0x237FB |
| `FUN_3334_07f2` | 0x23B32 | combat-ai |  |
| `FUN_3334_0b3c` | 0x23E7C | combat-ai, combat-rules |  |
| `FUN_3334_0f4f` | 0x2428F | combat-ai |  |
| `FUN_3334_0fc1` | 0x24301 | combat-ai, combat-rules, input-and-menus |  |
| `FUN_3334_10d7` | 0x24417 | combat-ai |  |
| `FUN_3334_128d` | 0x245CD | combat-ai |  |
| `FUN_3334_13ca` | 0x2470A | combat-ai |  |
| `FUN_34c7_0000` | 0x24C70 | coab/combat, battlefield |  |
| `FUN_34c7_012b` | 0x24D9B | battlefield | 0x24F96 |
| `FUN_34c7_01ad` | 0x24E1D | coab/combat, battlefield, combat-rules | 0x25018 |
| `FUN_34c7_0221` | 0x24E91 | coab/combat, battlefield | 0x24CD6 |
| `FUN_34c7_02ba` | 0x24F2A | battlefield |  |
| `FUN_34c7_0377` | 0x24FE7 | battlefield |  |
| `FUN_34c7_040f` | 0x2507F | battlefield |  |
| `FUN_34c7_0615` | 0x25285 | battlefield |  |
| `FUN_34c7_0810` | 0x25480 | coab/combat, battlefield, combat-rules | 0x2555D |
| `FUN_34c7_08a4` | 0x25514 | battlefield, por/README | 0x25621 |
| `FUN_34c7_0b97` | 0x25807 | battlefield | 0x2563C |
| `FUN_34c7_0bde` | 0x2584E | coab/combat, battlefield | 0x25690 |
| `FUN_34c7_0d13` | 0x25983 | coab/combat, battlefield | 0x2579B |
| `FUN_34c7_0e9e` | 0x25B0E | coab/combat, battlefield | 0x25ADA |
| `FUN_34c7_11b4` | 0x25E24 | battlefield, ecl | 0x25C58 |
| `FUN_34c7_1244` | 0x25EB4 | battlefield, combat-rules |  |
| `FUN_34c7_12e1` | 0x25F51 | battlefield, combat-rules |  |
| `FUN_34c7_1434` | 0x260A4 | combat-rules |  |
| `FUN_34c7_1577` | 0x261E7 | battlefield, combat-rules |  |
| `FUN_34c7_19f5` | 0x26665 | battlefield, combat-rules |  |
| `FUN_34c7_1e31` | 0x26AA1 | battlefield, combat-rules | 0x25CC0 |
| `FUN_36c1_002d` | 0x26C3D | combat-visuals, input-and-menus, main-loop |  |
| `FUN_3723_0000` | 0x27230 | effects |  |
| `FUN_3723_001f` | 0x2724F | effects |  |
| `FUN_3723_0058` | 0x27288 | combat-visuals, effects |  |
| `FUN_3723_010d` | 0x2733D | effects |  |
| `FUN_3723_011d` | 0x2734D | effects |  |
| `FUN_3723_013b` | 0x2736B | effects |  |
| `FUN_3723_01c3` | 0x273F3 | effects |  |
| `FUN_3723_0377` | 0x275A7 | effects |  |
| `FUN_3723_03ac` | 0x275DC | effects |  |
| `FUN_3723_03e1` | 0x27611 | effects |  |
| `FUN_3723_0400` | 0x27630 | effects |  |
| `FUN_3723_04ba` | 0x276EA | effects |  |
| `FUN_3723_05d6` | 0x27806 | effects |  |
| `FUN_3723_05eb` | 0x2781B | effects |  |
| `FUN_3723_0647` | 0x27877 | effects |  |
| `FUN_3723_064e` | 0x2787E | effects |  |
| `FUN_3723_0679` | 0x278A9 | effects |  |
| `FUN_3723_06e4` | 0x27914 | effects |  |
| `FUN_3723_0918` | 0x27B48 | effects |  |
| `FUN_3723_0947` | 0x27B77 | effects |  |
| `FUN_3723_0a3d` | 0x27C6D | effects |  |
| `FUN_3723_0bac` | 0x27DDC | effects |  |
| `FUN_3723_0bcf` | 0x27DFF | effects |  |
| `FUN_3723_0c06` | 0x27E36 | effects |  |
| `FUN_3723_0c15` | 0x27E45 | effects |  |
| `FUN_3723_0c26` | 0x27E56 | effects |  |
| `FUN_3723_0cc3` | 0x27EF3 | effects |  |
| `FUN_3723_0fac` | 0x281DC | effects |  |
| `FUN_3723_101d` | 0x2824D | effects |  |
| `FUN_3723_1086` | 0x282B6 | effects |  |
| `FUN_3723_10c1` | 0x282F1 | effects |  |
| `FUN_3723_1168` | 0x28398 | effects |  |
| `FUN_3723_11f9` | 0x28429 | effects |  |
| `FUN_3723_12b2` | 0x284E2 | effects |  |
| `FUN_3723_12fb` | 0x2852B | effects |  |
| `FUN_3723_133f` | 0x2856F | effects |  |
| `FUN_3723_1363` | 0x28593 | effects |  |
| `FUN_3723_1452` | 0x28682 | effects |  |
| `FUN_3723_1472` | 0x286A2 | effects |  |
| `FUN_3723_1490` | 0x286C0 | effects |  |
| `FUN_3723_14eb` | 0x2871B | effects |  |
| `FUN_3723_1545` | 0x28775 | effects |  |
| `FUN_3723_15eb` | 0x2881B | effects |  |
| `FUN_3723_165d` | 0x2888D | effects |  |
| `FUN_3723_1671` | 0x288A1 | effects |  |
| `FUN_3723_1685` | 0x288B5 | effects |  |
| `FUN_3723_1699` | 0x288C9 | effects |  |
| `FUN_3723_16bb` | 0x288EB | effects |  |
| `FUN_3723_16e6` | 0x28916 | effects |  |
| `FUN_3723_170b` | 0x2893B | effects |  |
| `FUN_3723_171f` | 0x2894F | effects |  |
| `FUN_3723_1730` | 0x28960 | effects |  |
| `FUN_3723_18b5` | 0x28AE5 | effects |  |
| `FUN_3723_19d9` | 0x28C09 | camp-and-time, effects |  |
| `FUN_3723_1a19` | 0x28C49 | effects |  |
| `FUN_3723_1a4c` | 0x28C7C | effects |  |
| `FUN_3723_1cad` | 0x28EDD | combat-visuals |  |
| `FUN_3723_2002` | 0x29232 | effects |  |
| `FUN_3723_2122` | 0x29352 | effects, records |  |
| `FUN_3723_23a4` | 0x295D4 | effects |  |
| `FUN_3723_2490` | 0x296C0 | effects |  |
| `FUN_3723_24d9` | 0x29709 | effects |  |
| `FUN_3723_25a2` | 0x297D2 | effects |  |
| `FUN_3723_25bc` | 0x297EC | effects |  |
| `FUN_3723_264b` | 0x2987B | effects |  |
| `FUN_3723_268a` | 0x298BA | effects |  |
| `FUN_3723_2700` | 0x29930 | effects |  |
| `FUN_3723_2730` | 0x29960 | effects |  |
| `FUN_3723_27d9` | 0x29A09 | effects |  |
| `FUN_3723_2814` | 0x29A44 | effects |  |
| `FUN_3723_2866` | 0x29A96 | effects |  |
| `FUN_3723_2901` | 0x29B31 | effects |  |
| `FUN_3723_2915` | 0x29B45 | effects |  |
| `FUN_3723_2992` | 0x29BC2 | effects |  |
| `FUN_3723_29b6` | 0x29BE6 | effects |  |
| `FUN_3723_29cb` | 0x29BFB | effects |  |
| `FUN_3723_29d9` | 0x29C09 | effects |  |
| `FUN_3723_29f0` | 0x29C20 | effects |  |
| `FUN_3723_2a11` | 0x29C41 | effects |  |
| `FUN_3723_2a28` | 0x29C58 | effects |  |
| `FUN_3723_2a6d` | 0x29C9D | effects |  |
| `FUN_3723_2a87` | 0x29CB7 | effects |  |
| `FUN_3723_2ae6` | 0x29D16 | effects |  |
| `FUN_3723_2b20` | 0x29D50 | effects |  |
| `FUN_3723_2b63` | 0x29D93 | effects |  |
| `FUN_3723_2b7d` | 0x29DAD | effects |  |
| `FUN_3723_2bc8` | 0x29DF8 | effects |  |
| `FUN_3723_2c1c` | 0x29E4C | combat-visuals |  |
| `FUN_3723_2d38` | 0x29F68 | effects |  |
| `FUN_3723_2d88` | 0x29FB8 | effects |  |
| `FUN_3723_2de4` | 0x2A014 | effects |  |
| `FUN_3723_2e08` | 0x2A038 | effects |  |
| `FUN_3723_2e37` | 0x2A067 | effects |  |
| `FUN_3723_2eda` | 0x2A10A | effects |  |
| `FUN_3723_30a5` | 0x2A2D5 | effects |  |
| `FUN_3723_317a` | 0x2A3AA | effects |  |
| `FUN_3723_319b` | 0x2A3CB | effects |  |
| `FUN_3aae_0000` | 0x2AAE0 | combat-rules |  |
| `FUN_3aae_0123` | 0x2AC03 | combat-rules, ecl |  |
| `FUN_3aae_0191` | 0x2AC71 | combat-rules |  |
| `FUN_3aae_02f9` | 0x2ADD9 | coab/combat, combat-rules, combat-visuals | 0x2AA62 (in 0x2A868) |
| `FUN_3aae_0627` | 0x2B107 | combat-rules |  |
| `FUN_3aae_0712` | 0x2B1F2 | combat-ai, combat-rules, combat-visuals, sound | 0x2AC98 |
| `FUN_3aae_08b2` | 0x2B392 | combat-ai, combat-rules |  |
| `FUN_3aae_0c6a` | 0x2B74A | combat-ai, combat-rules |  |
| `FUN_3aae_0d23` | 0x2B803 | combat-rules, records |  |
| `FUN_3aae_0e52` | 0x2B932 | records |  |
| `FUN_3aae_0e82` | 0x2B962 | combat-rules |  |
| `FUN_3aae_1085` | 0x2BB65 | combat-ai, combat-rules, effects |  |
| `FUN_3aae_116a` | 0x2BC4A | combat-rules, combat-visuals |  |
| `FUN_3aae_1351` | 0x2BE31 | combat-rules |  |
| `FUN_3aae_1406` | 0x2BEE6 | combat-rules, combat-visuals, sound |  |
| `FUN_3aae_17f6` | 0x2C2D6 | combat-rules |  |
| `FUN_3aae_1884` | 0x2C364 | combat-ai, combat-rules, combat-visuals, effects |  |
| `FUN_3aae_1b1e` | 0x2C5FE | combat-rules |  |
| `FUN_3aae_1bf8` | 0x2C6D8 | coab/combat, combat-ai, combat-rules | 0x2C34E |
| `FUN_3aae_1e16` | 0x2C8F6 | combat-rules, spells |  |
| `FUN_3aae_20c3` | 0x2CBA3 | coab/effects, combat-rules, effects, spells |  |
| `FUN_3aae_2414` | 0x2CEF4 | coab/combat, combat-ai, combat-rules, spells | 0x2CCBD |
| `FUN_3aae_2574` | 0x2D054 | combat-rules |  |
| `FUN_3aae_263d` | 0x2D11D | combat-ai |  |
| `FUN_3aae_26b0` | 0x2D190 | combat-visuals, sound |  |
| `FUN_3aae_2879` | 0x2D359 | battlefield, combat-ai, combat-rules |  |
| `FUN_3aae_2908` | 0x2D3E8 | combat-ai, combat-rules |  |
| `FUN_3aae_2998` | 0x2D478 | combat-rules |  |
| `FUN_3aae_2aa0` | 0x2D580 | combat-rules |  |
| `FUN_3aae_2c3d` | 0x2D71D | combat-rules |  |
| `FUN_3aae_2dfa` | 0x2D8DA | combat-rules |  |
| `FUN_3aae_3558` | 0x2E038 | combat-rules |  |
| `FUN_3aae_37e4` | 0x2E2C4 | combat-ai, combat-rules, spells |  |
| `FUN_3aae_3a86` | 0x2E566 | effects |  |
| `FUN_3aae_3b93` | 0x2E673 | combat-ai, combat-rules, input-and-menus |  |
| `FUN_3e76_0109` | 0x2E869 | main-loop |  |
| `FUN_3e76_0236` | 0x2E996 | main-loop |  |
| `FUN_3e76_0294` | 0x2E9F4 | main-loop |  |
| `FUN_3e76_04df` | 0x2EC3F | main-loop |  |
| `FUN_3e76_0648` | 0x2EDA8 | main-loop |  |
| `FUN_3e76_068d` | 0x2EDED | main-loop |  |
| `FUN_3e76_073b` | 0x2EE9B | camp-and-time, main-loop, sound |  |
| `FUN_3e76_0818` | 0x2EF78 | camp-and-time, ecl, main-loop, overland |  |
| `FUN_3e76_0989` | 0x2F0E9 | camp-and-time, main-loop, sound |  |
| `FUN_3e76_0d6d` | 0x2F4CD | main-loop, maps-and-view, sound |  |
| `FUN_3f81_0000` | 0x2F810 | camp-and-time |  |
| `FUN_3f81_0159` | 0x2F969 | camp-and-time |  |
| `FUN_3f81_019c` | 0x2F9AC | camp-and-time |  |
| `FUN_3f81_0214` | 0x2FA24 | camp-and-time |  |
| `FUN_3f81_025c` | 0x2FA6C | camp-and-time |  |
| `FUN_3f81_036c` | 0x2FB7C | camp-and-time |  |
| `FUN_3f81_04a1` | 0x2FCB1 | camp-and-time |  |
| `FUN_3f81_05a4` | 0x2FDB4 | camp-and-time |  |
| `FUN_3f81_077a` | 0x2FF8A | camp-and-time |  |
| `FUN_3f81_0824` | 0x30034 | camp-and-time |  |
| `FUN_3f81_090a` | 0x3011A | camp-and-time |  |
| `FUN_3f81_0b5b` | 0x3036B | camp-and-time |  |
| `FUN_3f81_0fbc` | 0x307CC | camp-and-time |  |
| `FUN_3f81_13f1` | 0x30C01 | camp-and-time |  |
| `FUN_3f81_14a9` | 0x30CB9 | camp-and-time |  |
| `FUN_3f81_1601` | 0x30E11 | camp-and-time |  |
| `FUN_3f81_1780` | 0x30F90 | camp-and-time |  |
| `FUN_3f81_18e5` | 0x310F5 | camp-and-time |  |
| `FUN_3f81_1a97` | 0x312A7 | camp-and-time |  |
| `FUN_3f81_1c59` | 0x31469 | camp-and-time |  |
| `FUN_3f81_1e6f` | 0x3167F | camp-and-time, town |  |
| `FUN_417f_0161` | 0x31951 | chargen-and-progression, input-and-menus, main-loop, town |  |
| `FUN_417f_056c` | 0x31D5C | chargen-and-progression | 0x3708F (in 0x36FA2) |
| `FUN_417f_2033` | 0x33823 | input-and-menus |  |
| `FUN_417f_209f` | 0x3388F | input-and-menus |  |
| `FUN_417f_29ae` | 0x3419E | chargen-and-progression, input-and-menus | 0x3BE67 (the call to 0x3B230) |
| `FUN_417f_3291` | 0x34A81 | combat-rules, input-and-menus |  |
| `FUN_417f_33e7` | 0x34BD7 | chargen-and-progression |  |
| `FUN_417f_382d` | 0x3501D | camp-and-time, combat-visuals, input-and-menus |  |
| `FUN_417f_3f31` | 0x35721 | chargen-and-progression |  |
| `FUN_417f_3fb3` | 0x357A3 | input-and-menus |  |
| `FUN_417f_408c` | 0x3587C | input-and-menus |  |
| `FUN_417f_4235` | 0x35A25 | chargen-and-progression | 0x3B230 |
| `FUN_417f_42ed` | 0x35ADD | chargen-and-progression |  |
| `FUN_43e0_007f` | 0x33E7F | combat-rules |  |
| `FUN_45c5_0010` | 0x35C60 | input-and-menus |  |
| `FUN_45c5_01b8` | 0x35E08 | input-and-menus |  |
| `FUN_45c5_032f` | 0x35F7F | input-and-menus |  |
| `FUN_45c5_0482` | 0x360D2 | input-and-menus |  |
| `FUN_45c5_069e` | 0x362EE | coab/records, chargen-and-progression, input-and-menus | 0x331BC |
| `FUN_45c5_0aec` | 0x3673C | coab/records, input-and-menus, savegame | 0x34660 |
| `FUN_45c5_0ec4` | 0x36B14 | ecl |  |
| `FUN_45c5_1262` | 0x36EB2 | coab/records, ecl | 0x3593D |
| `FUN_45c5_1446` | 0x37096 | input-and-menus, savegame |  |
| `FUN_45c5_1602` | 0x37252 | coab/records, input-and-menus, savegame | 0x35B75 |
| `FUN_45c5_1d58` | 0x379A8 | coab/records, camp-and-time, input-and-menus, savegame | 0x3631E |
| `FUN_46c1_01a0` | 0x36DB0 | combat-rules |  |
| `FUN_46c1_02cc` | 0x36EDC | combat-rules |  |
| `FUN_4804_0006` | 0x38046 | por/ending |  |
| `FUN_4804_02a4` | 0x382E4 | main-loop, town, por/ending | 0x3D02C |
| `FUN_4804_06b3` | 0x386F3 | ecl, main-loop, overland, savegame |  |
| `FUN_4894_004a` | 0x3898A | chargen-and-progression, records |  |
| `FUN_4894_0608` | 0x38F48 | chargen-and-progression |  |
| `FUN_4894_0ab3` | 0x393F3 | camp-and-time, combat-rules, combat-visuals, input-and-menus, town |  |
| `FUN_4894_0d70` | 0x396B0 | town |  |
| `FUN_4894_0ef8` | 0x39838 | combat-rules, town |  |
| `FUN_4894_14d0` | 0x39E10 | records |  |
| `FUN_4894_1734` | 0x3A074 | town |  |
| `FUN_4894_17ed` | 0x3A12D | town |  |
| `FUN_4894_189d` | 0x3A1DD | town |  |
| `FUN_4894_1a8a` | 0x3A3CA | combat-ai, combat-rules, town | 0x3F9A8 (spell 0x3FA0D) |
| `FUN_4894_1cee` | 0x3A62E | town |  |
| `FUN_4894_1f52` | 0x3A892 | town |  |
| `FUN_4894_2156` | 0x3AA96 | town |  |
| `FUN_4894_24a7` | 0x3ADE7 | town |  |
| `FUN_4894_275b` | 0x3B09B | records |  |
| `FUN_4894_27df` | 0x3B11F | camp-and-time, input-and-menus |  |
| `FUN_4894_28be` | 0x3B1FE | chargen-and-progression, town |  |
| `FUN_4894_299c` | 0x3B2DC | camp-and-time, chargen-and-progression, combat-rules |  |
| `FUN_4b46_0000` | 0x3B460 | camp-and-time |  |
| `FUN_4b46_02f2` | 0x3B752 | camp-and-time |  |
| `FUN_4b46_03a3` | 0x3B803 | camp-and-time |  |
| `FUN_4b46_03d5` | 0x3B835 | camp-and-time, ecl, overland |  |
| `FUN_4b46_047a` | 0x3B8DA | camp-and-time |  |
| `FUN_4b46_05f0` | 0x3BA50 | camp-and-time |  |
| `FUN_4b46_0721` | 0x3BB81 | camp-and-time |  |
| `FUN_4b46_0871` | 0x3BCD1 | camp-and-time |  |
| `FUN_4b46_0925` | 0x3BD85 | camp-and-time |  |
| `FUN_4b46_09e7` | 0x3BE47 | camp-and-time |  |
| `FUN_4b46_0b0a` | 0x3BF6A | camp-and-time |  |
| `FUN_4b46_0bb2` | 0x3C012 | camp-and-time |  |
| `FUN_4b46_0c9a` | 0x3C0FA | camp-and-time |  |
| `FUN_4c2d_0000` | 0x3C2D0 | records |  |
| `FUN_4c2d_00a8` | 0x3C378 | town |  |
| `FUN_4c2d_0130` | 0x3C400 | town |  |
| `FUN_4c2d_0185` | 0x3C455 | town |  |
| `FUN_4c2d_0203` | 0x3C4D3 | town |  |
| `FUN_4c2d_0294` | 0x3C564 | town |  |
| `FUN_4c2d_044c` | 0x3C71C | town |  |
| `FUN_4c2d_0508` | 0x3C7D8 | town |  |
| `FUN_4c2d_063a` | 0x3C90A | combat-rules, town |  |
| `FUN_4c2d_0a01` | 0x3CCD1 | town |  |
| `FUN_4c2d_0a88` | 0x3CD58 | town |  |
| `FUN_4c2d_0ceb` | 0x3CFBB | town |  |
| `FUN_4c2d_0fd2` | 0x3D2A2 | records |  |
| `FUN_4c2d_1010` | 0x3D2E0 | coab/records, ecl, records | 0x42D97 |
| `FUN_4c2d_19b2` | 0x3DC82 | town |  |
| `FUN_4e53_044e` | 0x3E97E | camp-and-time |  |
| `FUN_4e53_051c` | 0x3EA4C | camp-and-time |  |
| `FUN_4e53_0729` | 0x3EC59 | combat-ai, combat-rules, spells |  |
| `FUN_4e53_07d6` | 0x3ED06 | spells | 0x44E02 |
| `FUN_4e53_08c3` | 0x3EDF3 | combat-rules, spells | 0x44EEF |
| `FUN_4e53_0a91` | 0x3EFC1 | coab/spells, combat-rules, spells | 0x450BD |
| `FUN_4e53_0c20` | 0x3F150 | coab/combat, coab/spells, camp-and-time, combat-ai, combat-rules, combat-visuals, sound, spells, town | 0x45251 |
| `FUN_4e53_1658` | 0x3FB88 | combat-visuals, sound |  |
| `FUN_4e53_1b11` | 0x40041 | spells | 0x4675B |
| `FUN_4e53_266b` | 0x40B9B | combat-visuals |  |
| `FUN_4e53_295b` | 0x40E8B | combat-visuals | 0x479B4 |
| `FUN_4e53_30d9` | 0x41609 | combat-visuals, effects, spells |  |
| `FUN_4e53_323d` | 0x4176D | camp-and-time, combat-ai |  |
| `FUN_4e53_328a` | 0x417BA | camp-and-time |  |
| `FUN_4e53_331a` | 0x4184A | combat-rules, spells |  |
| `FUN_4e53_3413` | 0x41943 | coab/spells, spells | 0x4A4FF |
| `FUN_51cf_0000` | 0x41CF0 | camp-and-time, chargen-and-progression, effects, input-and-menus | 0x5047F |
| `FUN_51cf_01af` | 0x41E9F | camp-and-time, chargen-and-progression |  |
| `FUN_51cf_0255` | 0x41F45 | chargen-and-progression | 0x50C6B |
| `FUN_51cf_0329` | 0x42019 | chargen-and-progression | 0x50F5A |
| `FUN_5216_0000` | 0x42160 | effects | 0x4AB77 |
| `FUN_5216_0026` | 0x42186 | camp-and-time, effects, records | 0x4ABBA |
| `FUN_5216_0160` | 0x422C0 | effects | 0x4AD2A |
| `FUN_5216_02fa` | 0x4245A | coab/effects, combat-rules, effects | 0x4AEC4 |
| `FUN_5216_0ae7` | 0x42C47 | coab/spells, combat-rules, spells | 0x4B8F7 |
| `FUN_5216_0c4f` | 0x42DAF | combat-rules, effects |  |
| `FUN_5216_0cb7` | 0x42E17 | combat-rules, effects, spells | 0x4BCF5 |
| `FUN_5216_0d63` | 0x42EC3 | combat-rules, effects, spells | 0x4BDA1 |
| `FUN_5216_0de3` | 0x42F43 | coab/combat, battlefield, camp-and-time, chargen-and-progression, combat-rules, effects, records, spells | 0x4BE7C |
| `FUN_5216_0e2e` | 0x42F8E | combat-rules, effects, spells |  |
| `FUN_5216_0e52` | 0x42FB2 | chargen-and-progression, effects, records |  |
| `FUN_5216_0f06` | 0x43066 | combat-ai, combat-rules, effects |  |
| `FUN_5216_0fd2` | 0x43132 | combat-rules, effects |  |
| `FUN_5216_100a` | 0x4316A | combat-rules, effects |  |
| `FUN_5216_1041` | 0x431A1 | combat-ai |  |
| `FUN_5216_1081` | 0x431E1 | combat-rules, spells |  |
| `FUN_5216_10e4` | 0x43244 | effects | 0x4C160 |
| `FUN_5216_110d` | 0x4326D | effects |  |
| `FUN_5216_115c` | 0x432BC | effects | 0x4C1D8 |
| `FUN_5216_1344` | 0x434A4 | coab/combat, combat-rules, combat-visuals, effects, spells | 0x4CA6A |
| `FUN_5216_1656` | 0x437B6 | combat-visuals, effects, records, spells | 0x4CD91 |
| `FUN_5216_175d` | 0x438BD | camp-and-time, effects, spells, town | 0x4CE85 |
| `FUN_5216_1869` | 0x439C9 | camp-and-time, effects |  |
| `FUN_53aa_03bd` | 0x43E5D | camp-and-time, graphics, input-and-menus |  |
| `FUN_53aa_0d9a` | 0x4483A | input-and-menus |  |
| `FUN_53aa_10d1` | 0x44B71 | input-and-menus |  |
| `FUN_54cf_0000` | 0x44CF0 | overland |  |
| `FUN_54cf_00c7` | 0x44DB7 | maps-and-view |  |
| `FUN_54cf_012f` | 0x44E1F | maps-and-view |  |
| `FUN_54cf_016d` | 0x44E5D | camp-and-time, maps-and-view |  |
| `FUN_54fa_0000` | 0x44FA0 | overland |  |
| `FUN_5523_00a2` | 0x452D2 | graphics |  |
| `FUN_5523_04f9` | 0x45729 | chargen-and-progression |  |
| `FUN_5523_0708` | 0x45938 | graphics |  |
| `FUN_55a0_0000` | 0x45A00 | main-loop, maps-and-view |  |
| `FUN_55a0_0155` | 0x45B55 | input-and-menus, maps-and-view |  |
| `FUN_55a0_0174` | 0x45B74 | maps-and-view |  |
| `FUN_55a0_0211` | 0x45C11 | maps-and-view |  |
| `FUN_55a0_0350` | 0x45D50 | battlefield, maps-and-view |  |
| `FUN_55a0_047b` | 0x45E7B | battlefield, maps-and-view |  |
| `FUN_55a0_057a` | 0x45F7A | maps-and-view |  |
| `FUN_55a0_05f3` | 0x45FF3 | maps-and-view |  |
| `FUN_55a0_05fd` | 0x45FFD | coab/assets, maps-and-view | 0x53EC0 |
| `FUN_55a0_0e08` | 0x46808 | ecl, maps-and-view |  |
| `FUN_55a0_10c7` | 0x46AC7 | maps-and-view |  |
| `FUN_56c1_0000` | 0x46C10 | effects |  |
| `FUN_56c1_002e` | 0x46C3E | combat-rules |  |
| `FUN_56c1_01a0` | 0x46DB0 | battlefield, combat-visuals |  |
| `FUN_56c1_02cc` | 0x46EDC | battlefield |  |
| `FUN_56c1_0422` | 0x47032 | battlefield, combat-rules |  |
| `FUN_56c1_057b` | 0x4718B | combat-rules |  |
| `FUN_56c1_0909` | 0x47519 | combat-ai, combat-rules, spells |  |
| `FUN_577f_0000` | 0x477F0 | combat-rules |  |
| `FUN_577f_00e3` | 0x478D3 | combat-visuals |  |
| `FUN_577f_0105` | 0x478F5 | combat-visuals |  |
| `FUN_577f_03a0` | 0x47B90 | combat-rules, graphics |  |
| `FUN_577f_04be` | 0x47CAE | combat-rules |  |
| `FUN_577f_06e9` | 0x47ED9 | graphics |  |
| `FUN_577f_0af8` | 0x482E8 | combat-visuals |  |
| `FUN_577f_0cb9` | 0x484A9 | combat-rules |  |
| `FUN_577f_0e11` | 0x48601 | combat-rules, combat-visuals, sound |  |
| `FUN_577f_10a7` | 0x48897 | combat-rules |  |
| `FUN_58af_00f1` | 0x48BE1 | overland |  |
| `FUN_58af_01c8` | 0x48CB8 | combat-visuals, input-and-menus |  |
| `FUN_58af_04fc` | 0x48FEC | combat-rules, combat-visuals, graphics, overland |  |
| `FUN_5924_003b` | 0x4927B | graphics, maps-and-view |  |
| `FUN_5924_015d` | 0x4939D | maps-and-view |  |

## PoR routines parts B and C cite

The PoR routines that parts B and C name and part A does not (part A's are in the table above), with
their image offsets and the citing files (`B/` part B, `C/` part C). Generated by
`tools/specaddresses.py` from the spec's citations.

<!-- generated:bc-por -->
| PoR | Image | Cited in |
|---|---|---|
| `FUN_29c3_2775` | 0x1C3A5 | B/script-vm-map |
| `FUN_29c3_2c90` | 0x1C8C0 | B/script-vm-map |
| `FUN_4e53_228a` | 0x407BA | B/vocabularies |
| `FUN_4e53_28bc` | 0x40DEC | B/procedures |
| `FUN_4e53_295b` | 0x40E8B | B/procedures |
<!-- /generated:bc-por -->

## CotAB addresses

Every CotAB image offset the CotAB files of part A, part B and part C cite (five-digit offsets, and the
`ssss:oooo` paragraph forms of the CotAB files converted), with the citing files, the section of the
first citation (which says what is there), and the PoR routine where the table above pairs one. Some are
routines, some places inside one (a call, a test, a table read), as the citing text says. Generated by
`tools/specaddresses.py`: an address in part B or C counts as CotAB's when a CotAB file cites it too, or
when its table column or sentence names CotAB.

<!-- generated:coab -->
| CotAB | Cited in | First cited in | PoR |
|---|---|---|---|
| 0x01330 | coab/ecl | coab/ecl: Opcodes |  |
| 0x01466 | coab/ecl | coab/ecl: Opcodes |  |
| 0x057F9 | coab/ecl | coab/ecl: CALL targets |  |
| 0x061EA | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x066DC | coab/ecl | coab/ecl: B as a view of the current character |  |
| 0x06700 | coab/ecl | coab/ecl: Opcodes |  |
| 0x069B0 | coab/ecl, B/script-vm-map | coab/ecl: CALL targets |  |
| 0x0B00A | coab/camp | coab/camp: 1. Fix |  |
| 0x0B1DB | coab/chargen-and-progression | coab/chargen-and-progression: Where |  |
| 0x16310 | coab/tables | coab/tables: 1. Data segment |  |
| 0x180D0 | coab/assets | coab/assets: 7. Start-up, title, copy protection |  |
| 0x182AD | coab/assets, B/profile | coab/assets: 7. Start-up, title, copy protection | `FUN_290c_0206` |
| 0x18702 | coab/assets, coab/ecl | coab/assets: 7. Start-up, title, copy protection |  |
| 0x18850 | coab/ecl | coab/ecl: CotAB ECL virtual machine: diff against PoR `engine/ecl.md |  |
| 0x188A0 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1893B | coab/ecl | coab/ecl: Opcodes |  |
| 0x18958 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1896D | coab/ecl | coab/ecl: Opcodes |  |
| 0x189EA | coab/ecl | coab/ecl: Opcodes |  |
| 0x18A5D | coab/ecl | coab/ecl: Opcodes |  |
| 0x18A6A | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x18A8D | coab/ecl | coab/ecl: Opcodes |  |
| 0x18AEB | coab/ecl | coab/ecl: Opcodes |  |
| 0x18B39 | coab/ecl, B/script-vm-map | coab/ecl: B as a view of the current character |  |
| 0x18BCD | coab/ecl | coab/ecl: B as a view of the current character |  |
| 0x18C06 | coab/ecl | coab/ecl: B as a view of the current character |  |
| 0x18C19 | coab/ecl | coab/ecl: Opcodes |  |
| 0x18C3E | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x18C65 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x18CB0 | coab/tables | coab/tables: 2. Address mapping (every rules table in the data segment) |  |
| 0x18CB5 | coab/ecl | coab/ecl: Opcodes |  |
| 0x19085 | coab/ecl | coab/ecl: Opcodes |  |
| 0x190C3 | coab/assets, coab/ecl | coab/assets: 5. BIGPIC uses |  |
| 0x190E5 | coab/ecl | coab/ecl: Open |  |
| 0x190EA | coab/ecl | coab/ecl: CALL targets |  |
| 0x190F3 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x19101 | coab/assets | coab/assets: 5. BIGPIC uses |  |
| 0x191A0 | coab/ecl | coab/ecl: Open |  |
| 0x191AE | coab/ecl | coab/ecl: Opcodes |  |
| 0x191F4 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1926C | coab/ecl | coab/ecl: Opcodes |  |
| 0x19308 | coab/ecl | coab/ecl: Opcodes |  |
| 0x19356 | coab/ecl | coab/ecl: Flags and control flow |  |
| 0x1935C | coab/ecl | coab/ecl: Opcodes |  |
| 0x193C1 | coab/ecl | coab/ecl: Flags and control flow |  |
| 0x19437 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1944E | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x19491 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1949F | coab/ecl | coab/ecl: CALL targets |  |
| 0x194F5 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x19509 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x19527 | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x1954F | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1955B | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x19563 | coab/ecl, B/script-vm-map | coab/ecl: Opcodes |  |
| 0x19575 | coab/ecl, B/script-vm-map | coab/ecl: Opcodes |  |
| 0x19620 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1968F | coab/ecl | coab/ecl: Opcodes |  |
| 0x196ED | coab/ecl | coab/ecl: Opcodes |  |
| 0x19739 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1978B | coab/ecl | coab/ecl: Instruction encoding |  |
| 0x19904 | coab/ecl | coab/ecl: Opcodes |  |
| 0x19936 | coab/ecl | coab/ecl: Instruction encoding |  |
| 0x19A90 | coab/ecl | coab/ecl: Opcodes |  |
| 0x19AF9 | coab/ecl | coab/ecl: Opcodes |  |
| 0x19B7E | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x19C09 | coab/ecl | coab/ecl: Opcodes |  |
| 0x19C0B | coab/ecl | coab/ecl: Opcodes |  |
| 0x19CA4 | coab/ecl | coab/ecl: Opcodes |  |
| 0x19ECE | coab/ecl | coab/ecl: Opcodes |  |
| 0x19F6E | coab/ecl | coab/ecl: Opcodes |  |
| 0x1A034 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1A056 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1A0E9 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1A2B2 | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x1A30A | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1A335 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1A35D | coab/ecl | coab/ecl: Instruction encoding |  |
| 0x1A3CA | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x1A3ED | coab/ecl, coab/records | coab/ecl: Opcodes |  |
| 0x1A4D4 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x1A5A3 | coab/ecl, coab/records, B/procedures | coab/ecl: Random treasure types |  |
| 0x1A6E2 | coab/ecl, coab/records | coab/ecl: Random treasure types |  |
| 0x1A7C6 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1A90D | coab/ecl | coab/ecl: Opcodes |  |
| 0x1AA5C | coab/ecl | coab/ecl: Opcodes |  |
| 0x1AA96 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1ABB8 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1ABC4 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B007 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B0A6 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B15B | coab/ecl, B/script-vm-map | coab/ecl: Start-up menu and demo |  |
| 0x1B1A8 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B22A | coab/ecl, B/script-vm-map | coab/ecl: Opcodes |  |
| 0x1B2C0 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B329 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B398 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B506 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B52A | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B55F | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B588 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B5CF | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B61A | coab/ecl, B/script-vm-map | coab/ecl: Opcodes |  |
| 0x1B683 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B773 | coab/ecl, B/script-vm-map | coab/ecl: Opcodes | `FUN_29c3_2ccf` |
| 0x1B7B2 | coab/ecl, B/script-vm-map | coab/ecl: CALL targets |  |
| 0x1B7B9 | coab/assets | coab/assets: Background: the main change |  |
| 0x1B7DA | coab/assets | coab/assets: Background: the main change |  |
| 0x1B7EB | coab/assets | coab/assets: Background: the main change |  |
| 0x1B7FF | coab/assets | coab/assets: Background: the main change |  |
| 0x1B8E4 | coab/ecl | coab/ecl: Engine entry points | `FUN_29c3_2dd3` |
| 0x1B92B | coab/ecl, B/profile, C/app-flow | coab/ecl: Opcodes |  |
| 0x1B94E | coab/ecl | coab/ecl: Opcodes |  |
| 0x1B9AD | B/profile, C/app-flow | B/profile: 3.5 The ending (`EndingScript`) |  |
| 0x1B9C2 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1BA7E | coab/ecl, B/script-vm-map | coab/ecl: Start-up menu and demo |  |
| 0x1BA8F | coab/ecl | coab/ecl: Opcodes |  |
| 0x1BAC1 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1BAF5 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1BB49 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1BBF2 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x1BE57 | coab/ecl | coab/ecl: Engine entry points | `FUN_29c3_3171` |
| 0x1BE86 | coab/ecl | coab/ecl: VM state |  |
| 0x1BEC7 | coab/ecl | coab/ecl: Engine entry points | `FUN_29c3_31b4` |
| 0x1BEF9 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1BF0C | coab/ecl | coab/ecl: Vectors |  |
| 0x1BF5D | coab/ecl | coab/ecl: Vectors |  |
| 0x1BF6C | coab/ecl | coab/ecl: Vectors |  |
| 0x1BFA8 | coab/ecl | coab/ecl: Engine entry points | `FUN_29c3_32f8` |
| 0x1BFD5 | coab/ecl | coab/ecl: CALL targets |  |
| 0x1BFED | coab/ecl | coab/ecl: Loading |  |
| 0x1BFFA | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1C001 | B/profile, B/script-vm-map | B/profile: 3.3 The start-up menu and demo (`StartMenu`) |  |
| 0x1C050 | coab/ecl, B/script-vm-map | coab/ecl: Loading |  |
| 0x1C057 | coab/ecl | coab/ecl: CALL targets |  |
| 0x1C061 | coab/ecl | coab/ecl: Vectors |  |
| 0x1C069 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1C0FA | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1C127 | coab/ecl | coab/ecl: Vectors |  |
| 0x1C147 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1C158 | coab/ecl | coab/ecl: Vectors |  |
| 0x1C1A0 | coab/ecl | coab/ecl: Vectors |  |
| 0x1C1C8 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1C1D5 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1C22F | coab/ecl | coab/ecl: Vectors |  |
| 0x1C26B | coab/assets | coab/assets: 1. Containers |  |
| 0x1C378 | coab/assets, coab/ecl | coab/assets: 7. Start-up, title, copy protection |  |
| 0x1C422 | coab/assets | coab/assets: 7. Start-up, title, copy protection |  |
| 0x1C5B3 | coab/assets | coab/assets: 7. Start-up, title, copy protection |  |
| 0x1C987 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CA58 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CB07 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CB35 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CB53 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CB84 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CBA2 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CBD5 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CBF6 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CC34 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CCC5 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CD61 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1CFA5 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1D0CA | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1D0EB | B/procedures | B/procedures: 9. Temple |  |
| 0x1D112 | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1D15E | coab/tables | coab/tables: 3.11 Temple |  |
| 0x1D6E0 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1D819 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1D912 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1DC36 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1DD03 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1DD2F | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1DF24 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1E19C | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1E7A3 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1EAA7 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1EAB3 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1EBEE | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1EE82 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1EE98 | coab/ecl, B/profile | coab/ecl: Start-up menu and demo |  |
| 0x1EEA0 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1EEAC | coab/ecl, B/profile | coab/ecl: Start-up menu and demo |  |
| 0x1EF4E | coab/ecl, B/profile | coab/ecl: Start-up menu and demo |  |
| 0x1EFB6 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1F01E | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1F03F | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1F04F | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x1F0F6 | coab/ecl, B/procedures | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1F531 | coab/ecl, B/procedures | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1FA02 | coab/ecl, B/script-vm-map | coab/ecl: Engine entry points | `FUN_2fea_0000` |
| 0x1FB38 | coab/ecl | coab/ecl: Engine entry points | `FUN_2fea_0136` |
| 0x1FBB8 | coab/ecl | coab/ecl: Engine entry points | `FUN_2fea_01b6` |
| 0x1FBDC | coab/assets, coab/ecl | coab/assets: Open |  |
| 0x1FBF7 | coab/ecl | coab/ecl: Loading |  |
| 0x1FC34 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1FC4A | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1FCDC | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1FD01 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x1FD3C | coab/ecl | coab/ecl: Engine entry points |  |
| 0x1FF13 | coab/ecl | coab/ecl: Opcodes |  |
| 0x1FFB7 | coab/ecl | coab/ecl: Open |  |
| 0x1FFBB | coab/ecl | coab/ecl: CALL targets |  |
| 0x2002E | coab/ecl | coab/ecl: CALL targets |  |
| 0x20063 | coab/ecl | coab/ecl: Open |  |
| 0x200A7 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x200CB | coab/ecl | coab/ecl: Engine entry points | `FUN_2fea_06d3` |
| 0x200F3 | coab/ecl, B/script-vm-map | coab/ecl: Engine entry points | `FUN_2fea_06fb` |
| 0x2014E | coab/ecl | coab/ecl: B as a view of the current character |  |
| 0x201B4 | coab/ecl, B/script-vm-map | coab/ecl: Engine entry points | `FUN_2fea_07bc` |
| 0x20357 | coab/records | coab/records: 11. Open |  |
| 0x20390 | coab/ecl, B/script-vm-map | coab/ecl: B as a view of the current character |  |
| 0x2051F | coab/ecl, B/script-vm-map | coab/ecl: Engine entry points | `FUN_2fea_0a74` |
| 0x20722 | coab/assets, coab/ecl, B/script-vm-map | coab/assets: Background: the main change | `FUN_2fea_0c77` |
| 0x20749 | coab/assets, coab/ecl | coab/assets: Background: the main change |  |
| 0x207A3 | coab/ecl | coab/ecl: B as a view of the current character |  |
| 0x207EE | coab/ecl | coab/ecl: Engine registers |  |
| 0x20846 | coab/ecl | coab/ecl: CALL targets |  |
| 0x208C2 | coab/assets | coab/assets: Open |  |
| 0x208D4 | coab/assets | coab/assets: Open |  |
| 0x208DB | coab/ecl | coab/ecl: Engine registers |  |
| 0x208E6 | coab/ecl, B/script-vm-map | coab/ecl: Engine entry points | `FUN_2fea_0e0c` |
| 0x20981 | coab/ecl | coab/ecl: Engine registers |  |
| 0x20A24 | coab/ecl | coab/ecl: Engine registers |  |
| 0x20A2D | coab/ecl | coab/ecl: Engine entry points |  |
| 0x20C49 | coab/ecl | coab/ecl: Engine entry points | `FUN_2fea_1153` |
| 0x20DF1 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x214D1 | coab/ecl | coab/ecl: CALL targets |  |
| 0x2156A | coab/ecl | coab/ecl: CALL targets |  |
| 0x219A2 | coab/ecl | coab/ecl: Engine entry points | `FUN_2fea_1ea6` |
| 0x21D30 | coab/ecl | coab/ecl: Opcodes |  |
| 0x21E25 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x21E41 | coab/effects, coab/spells | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x21EA9 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x2209E | coab/combat, coab/effects | coab/combat: Casting |  |
| 0x2213E | coab/combat | coab/combat: Casting | `FUN_320c_031a` |
| 0x22412 | coab/combat | coab/combat: Casting | `FUN_320c_031a` |
| 0x225D4 | coab/combat | coab/combat: The former class in battle |  |
| 0x2272D | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x227EF | coab/ecl, B/profile | coab/ecl: Start-up menu and demo |  |
| 0x22A3F | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x22ADD | coab/combat, B/procedures | coab/combat: Cell table | `FUN_320c_09df` |
| 0x22B2C | coab/combat, B/procedures | coab/combat: Cell table |  |
| 0x22BC4 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x230C0 | coab/ecl | coab/ecl: Opcodes |  |
| 0x23238 | coab/combat | coab/combat: Casting | `FUN_3334_000f` |
| 0x2330B | coab/combat | coab/combat: The former class in battle |  |
| 0x23471 | coab/combat | coab/combat: Casting | `FUN_3334_02eb` |
| 0x2347C | coab/combat | coab/combat: Casting | `FUN_3334_000f` |
| 0x2356A | coab/combat, coab/spells, B/procedures | coab/combat: Casting | `FUN_3334_03e4` |
| 0x23651 | coab/spells, B/procedures | coab/spells: 1. Dispatch and shared helpers |  |
| 0x236CB | coab/combat, B/procedures | coab/combat: Casting | `FUN_3334_0545` |
| 0x236E4 | coab/combat | coab/combat: Casting |  |
| 0x237FB | coab/combat, B/procedures | coab/combat: Cell table | `FUN_3334_0675` |
| 0x238DA | coab/combat, B/procedures | coab/combat: Cell table |  |
| 0x238EE | coab/combat | coab/combat: The computer's probe on clouds |  |
| 0x239BA | coab/combat | coab/combat: The computer's probe on clouds |  |
| 0x239BD | coab/combat | coab/combat: The computer's probe on clouds |  |
| 0x23A4E | coab/combat | coab/combat: The computer's probe on clouds |  |
| 0x23A51 | coab/combat | coab/combat: The computer's probe on clouds |  |
| 0x23A91 | coab/combat | coab/combat: The computer's movement |  |
| 0x23CDD | coab/combat | coab/combat: The computer's movement |  |
| 0x23D8C | coab/combat | coab/combat: The computer's movement |  |
| 0x23E57 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x24434 | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x2443F | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x2445C | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x24533 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x2459C | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x2466C | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x2485C | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x24912 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x24C90 | coab/ecl | coab/ecl: Opcodes |  |
| 0x24CD6 | coab/combat | coab/combat: Map-area generator | `FUN_34c7_0221` |
| 0x24D63 | coab/combat, B/procedures | coab/combat: Furnishing |  |
| 0x24E90 | B/procedures | B/procedures: 9.1 Shop prices |  |
| 0x24F96 | coab/combat | coab/combat: Map-area generator | `FUN_34c7_012b` |
| 0x25018 | coab/combat | coab/combat: Map-area generator | `FUN_34c7_01ad` |
| 0x25373 | coab/combat, B/procedures | coab/combat: Map-area generator |  |
| 0x25385 | B/procedures | B/procedures: 9.1 Shop prices |  |
| 0x25386 | coab/combat | coab/combat: Map-area generator |  |
| 0x25467 | coab/combat, B/procedures | coab/combat: Map-area generator |  |
| 0x2555D | coab/combat, B/procedures | coab/combat: Battlefield | `FUN_34c7_0810` |
| 0x25621 | coab/combat, coab/ecl | coab/combat: Wilderness generator | `FUN_34c7_08a4` |
| 0x2563C | coab/combat | coab/combat: River | `FUN_34c7_0b97` |
| 0x25690 | coab/combat, coab/ecl | coab/combat: Wilderness generator | `FUN_34c7_0bde` |
| 0x2579B | coab/combat, coab/ecl | coab/combat: Wilderness generator | `FUN_34c7_0d13` |
| 0x25932 | coab/combat | coab/combat: Scatter |  |
| 0x2593F | B/profile | B/profile: 3.5 The ending (`EndingScript`) |  |
| 0x25A08 | coab/combat | coab/combat: Blank ground |  |
| 0x25ADA | coab/combat, coab/ecl | coab/combat: Wilderness generator | `FUN_34c7_0e9e` |
| 0x25BA5 | coab/combat | coab/combat: Blank ground |  |
| 0x25C58 | coab/combat, coab/ecl | coab/combat: Battlefield | `FUN_34c7_11b4` |
| 0x25C78 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x25C84 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x25C90 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x25CA8 | coab/combat, coab/ecl | coab/combat: Battlefield |  |
| 0x25CB0 | coab/combat, coab/ecl | coab/combat: Battlefield |  |
| 0x25CB8 | coab/combat | coab/combat: Battlefield |  |
| 0x25CC0 | coab/README, coab/combat, coab/ecl, B/procedures | coab/README: Curse of the Azure Bonds (CotAB) | `FUN_34c7_1e31` |
| 0x25D70 | coab/combat | coab/combat: Battlefield |  |
| 0x26010 | coab/combat | coab/combat: Placement |  |
| 0x2648E | coab/combat | coab/combat: Battlefield |  |
| 0x268CB | coab/combat | coab/combat: Battlefield |  |
| 0x2697F | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x26985 | coab/combat | coab/combat: Battlefield |  |
| 0x26A1A | coab/effects | coab/effects: 1. Dispatch |  |
| 0x26A50 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x26A94 | coab/assets | coab/assets: 1. Containers |  |
| 0x26AA4 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x26AA9 | coab/assets | coab/assets: 7. Start-up, title, copy protection |  |
| 0x26B13 | coab/ecl | coab/ecl: VM state |  |
| 0x26B6B | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x26B98 | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x26EE7 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x26FDB | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x26FE5 | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x26FF6 | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x270B5 | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) |  |
| 0x27135 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x272F0 | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x27350 | coab/records | coab/records: 10. Creation effects and paladin abilities |  |
| 0x27369 | B/vocabularies | B/vocabularies: 1.1 The shared globals |  |
| 0x273C1 | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers |  |
| 0x2742C | B/vocabularies | B/vocabularies: 3.7 Holding, draining, engulfing |  |
| 0x274AF | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x2752F | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x276C9 | B/vocabularies | B/vocabularies: 3.5 Effects that last, end or re-arm |  |
| 0x2779A | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x277D0 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x27A16 | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x27A4B | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x27A8F | B/vocabularies | B/vocabularies: 3.4 Targeting and protection |  |
| 0x27BEE | coab/combat | coab/combat: The former class in battle |  |
| 0x27D29 | B/vocabularies | B/vocabularies: 3.6 Charm, morale and control |  |
| 0x27ED0 | B/vocabularies | B/vocabularies: 3.1 Markers and turn control |  |
| 0x284A3 | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x284F2 | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x28562 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x28593 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x28628 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x2871A | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x288D9 | coab/combat | coab/combat: Casting |  |
| 0x288E5 | coab/combat, coab/tables, B/vocabularies | coab/combat: Casting |  |
| 0x2896F | coab/combat | coab/combat: Casting |  |
| 0x28986 | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x28A22 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x28A28 | coab/effects | coab/effects: 3. Globals |  |
| 0x28A5E | coab/combat, coab/effects | coab/combat: Casting |  |
| 0x28A6A | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x28AC2 | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x28B03 | B/vocabularies | B/vocabularies: 3.6 Charm, morale and control |  |
| 0x28B94 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x28CCF | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x28CE0 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x28D31 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x28D64 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x28E09 | coab/spells, B/vocabularies | coab/spells: 2. Per spell id |  |
| 0x293AD | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x29502 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x29873 | B/vocabularies | B/vocabularies: 3.8 On-hit effects |  |
| 0x298ED | B/vocabularies | B/vocabularies: 3.8 On-hit effects |  |
| 0x29973 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x29993 | coab/effects, B/vocabularies | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x299F4 | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x29A23 | coab/spells, B/vocabularies | coab/spells: 2. Per spell id |  |
| 0x29AA0 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x29AB8 | coab/effects | coab/effects: 3. Globals |  |
| 0x29ACC | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x29B05 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x29B1C | B/vocabularies | B/vocabularies: 3.1 Markers and turn control |  |
| 0x29B30 | B/vocabularies | B/vocabularies: 3.6 Charm, morale and control |  |
| 0x29C20 | B/vocabularies | B/vocabularies: 3.5 Effects that last, end or re-arm |  |
| 0x29C31 | coab/ecl | coab/ecl: Opcodes |  |
| 0x29C3F | B/vocabularies | B/vocabularies: 3.5 Effects that last, end or re-arm |  |
| 0x29C79 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x29C82 | B/vocabularies | B/vocabularies: 3.6 Charm, morale and control |  |
| 0x29CC5 | B/vocabularies | B/vocabularies: 3.8 On-hit effects |  |
| 0x29D69 | B/vocabularies | B/vocabularies: 3.8 On-hit effects |  |
| 0x29E21 | B/vocabularies | B/vocabularies: 3.1 Markers and turn control |  |
| 0x29E28 | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x2A6E2 | coab/combat, B/procedures | coab/combat: The backstab |  |
| 0x2A74C | coab/combat | coab/combat: The backstab |  |
| 0x2AA62 | coab/combat, B/procedures | coab/combat: Casting | `FUN_3aae_02f9` |
| 0x2AAB4 | coab/combat | coab/combat: Casting |  |
| 0x2AB72 | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x2AC98 | coab/combat, coab/tables, B/procedures | coab/combat: Cell table | `FUN_3aae_0712` |
| 0x2AD05 | coab/combat, B/procedures | coab/combat: Cell table |  |
| 0x2AD64 | B/procedures | B/procedures: 15.5 Battlefield movement |  |
| 0x2AD78 | coab/combat, B/procedures | coab/combat: Cell table |  |
| 0x2B0CC | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x2B778 | coab/combat | coab/combat: The former class in battle |  |
| 0x2B7EE | coab/combat | coab/combat: The former class in battle |  |
| 0x2C2F7 | coab/ecl | coab/ecl: Opcodes |  |
| 0x2C34E | coab/combat | coab/combat: Casting | `FUN_3aae_1bf8` |
| 0x2C56C | coab/effects, B/procedures, B/vocabularies | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x2C642 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x2C781 | coab/effects, coab/spells | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x2C7EA | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers |  |
| 0x2CA1B | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x2CAB6 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x2CB5D | coab/ecl | coab/ecl: Engine entry points |  |
| 0x2CCBD | coab/combat, B/procedures | coab/combat: Casting | `FUN_3aae_2414` |
| 0x2CDA1 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x2CE27 | coab/combat, B/procedures | coab/combat: The backstab |  |
| 0x2CF0C | coab/combat | coab/combat: The backstab |  |
| 0x2D141 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x2D4D0 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x2D4FA | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x2DBB3 | B/vocabularies | B/vocabularies: 3.4 Targeting and protection |  |
| 0x2E394 | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x2E582 | B/vocabularies | B/vocabularies: 3.7 Holding, draining, engulfing |  |
| 0x2E842 | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x2E892 | B/vocabularies | B/vocabularies: 5. Monster specials and the target hook |  |
| 0x2EA60 | B/vocabularies | B/vocabularies: 3.3 Damage resistances and immunities |  |
| 0x2EB16 | B/vocabularies | B/vocabularies: 3.7 Holding, draining, engulfing |  |
| 0x2EC4C | B/vocabularies | B/vocabularies: 3.7 Holding, draining, engulfing |  |
| 0x2ED5C | B/vocabularies | B/vocabularies: 3.7 Holding, draining, engulfing |  |
| 0x2F185 | coab/combat | coab/combat: The former class in battle |  |
| 0x2F1C4 | B/vocabularies | B/vocabularies: 3.9 Monster specials (event 14) |  |
| 0x2F252 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x2F697 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x2F7FC | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x2F853 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x2F8BC | B/vocabularies | B/vocabularies: 3.9 Monster specials (event 14) |  |
| 0x2FEA0 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x2FEF5 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x2FF2B | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x2FFD6 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x30056 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x300A0 | coab/tables | coab/tables: 3.7a Caster level |  |
| 0x30573 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x3059B | coab/ecl | coab/ecl: Engine entry points |  |
| 0x3065C | coab/ecl | coab/ecl: Engine entry points |  |
| 0x306E2 | B/vocabularies | B/vocabularies: 3.2 Attack and damage modifiers |  |
| 0x308B4 | B/vocabularies | B/vocabularies: 3.5 Effects that last, end or re-arm |  |
| 0x30B17 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x30CAC | coab/ecl | coab/ecl: Engine entry points |  |
| 0x30DDA | B/vocabularies | B/vocabularies: 2. The effect system (`EffectRules`) |  |
| 0x30FF3 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x3191B | C/screens | C/screens: 6.8 Alter |  |
| 0x31B6D | C/screens | C/screens: 1.6 The combat icon editor |  |
| 0x31CA2 | coab/camp | coab/camp: 1. Fix |  |
| 0x31CC2 | coab/camp | coab/camp: 1. Fix |  |
| 0x31D46 | coab/ecl | coab/ecl: Engine entry points |  |
| 0x31D7D | coab/camp | coab/camp: 1. Fix |  |
| 0x31E2F | coab/camp | coab/camp: 1. Fix |  |
| 0x31E8D | coab/camp | coab/camp: 1. Fix |  |
| 0x31FD3 | coab/camp | coab/camp: 1. Fix |  |
| 0x31FE7 | coab/camp | coab/camp: 1. Fix |  |
| 0x32020 | coab/camp | coab/camp: 1. Fix |  |
| 0x32096 | coab/camp | coab/camp: 1. Fix |  |
| 0x320D8 | coab/README, coab/camp, B/procedures, C/screens | coab/README: Curse of the Azure Bonds (CotAB) |  |
| 0x32118 | coab/camp | coab/camp: 1. Fix |  |
| 0x321CB | coab/camp, coab/ecl | coab/camp: 1. Fix |  |
| 0x322D0 | C/screens | C/screens: 6.1 The camp menu |  |
| 0x3243B | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x3244B | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) |  |
| 0x3280D | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x32825 | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) |  |
| 0x33050 | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) |  |
| 0x33136 | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x331BC | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) | `FUN_45c5_069e` |
| 0x3376E | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x33873 | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) |  |
| 0x33CE2 | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x33E47 | coab/effects | coab/effects: 9. No level drain |  |
| 0x33E5B | coab/effects | coab/effects: 9. No level drain |  |
| 0x33EA4 | coab/records | coab/records: 11. Open |  |
| 0x33EE3 | coab/records | coab/records: 11. Open |  |
| 0x33EF8 | coab/records | coab/records: 11. Open |  |
| 0x33F00 | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x340E4 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x342F5 | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) |  |
| 0x34569 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x34573 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x345FD | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x34611 | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x34640 | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x34660 | coab/chargen-and-progression, coab/records | coab/chargen-and-progression: 1. The recalculation | `FUN_45c5_0aec` |
| 0x34741 | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x34786 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x34795 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x347B8 | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x3482B | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x3484B | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x348F5 | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x349F8 | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x34A08 | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x34BC1 | coab/records | coab/records: 7.5 Hillsfar (brief, O for structure) |  |
| 0x34D87 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x351B7 | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x351D9 | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x35229 | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x35283 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x3531C | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x3537B | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x3546C | coab/records | coab/records: 4. Effects: `.FX` (CotAB) vs `.SPC` (PoR) |  |
| 0x3554A | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x3561A | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x35625 | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x35630 | coab/records | coab/records: 6. Monsters (`MON<n>CHA/ITM/SPC.DAX`, diff vs engine/records.md "One record for everyone") |  |
| 0x3565C | coab/ecl, coab/records, B/script-vm-map | coab/ecl: Opcodes |  |
| 0x357EF | coab/records | coab/records: 4. Effects: `.FX` (CotAB) vs `.SPC` (PoR) |  |
| 0x358CF | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x3593D | coab/ecl, coab/records | coab/ecl: Opcodes | `FUN_45c5_1262` |
| 0x35974 | coab/ecl, coab/records, B/script-vm-map | coab/ecl: Opcodes |  |
| 0x35999 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x3599F | coab/ecl, B/script-vm-map | coab/ecl: Opcodes |  |
| 0x359CA | coab/ecl, coab/records | coab/ecl: Opcodes |  |
| 0x35AF6 | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x35B75 | coab/records, B/script-vm-map | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) | `FUN_45c5_1602` |
| 0x35EEB | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x35F08 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x35FA5 | coab/records | coab/records: 5. `SAVGAM<x>.DAT`: 13 149 bytes (diff vs engine/savegame.md) |  |
| 0x36032 | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x36068 | coab/records, B/script-vm-map | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x360CB | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x3614A | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x3631E | coab/ecl, coab/records | coab/ecl: Opcodes | `FUN_45c5_1d58` |
| 0x36351 | coab/records | coab/records: 5. `SAVGAM<x>.DAT`: 13 149 bytes (diff vs engine/savegame.md) |  |
| 0x363EF | coab/records | coab/records: 5. `SAVGAM<x>.DAT`: 13 149 bytes (diff vs engine/savegame.md) |  |
| 0x36563 | coab/records | coab/records: 5. `SAVGAM<x>.DAT`: 13 149 bytes (diff vs engine/savegame.md) |  |
| 0x36821 | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x36848 | coab/records, B/procedures | coab/records: 9. Joining the party |  |
| 0x36850 | coab/ecl, C/screens | coab/ecl: Start-up menu and demo |  |
| 0x36A1C | coab/assets, coab/ecl | coab/assets: 7. Start-up, title, copy protection |  |
| 0x36A6C | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x36CEF | coab/chargen-and-progression | coab/chargen-and-progression: Where |  |
| 0x36DCD | coab/ecl, C/app-flow, C/departures | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x36DD5 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x3708F | B/procedures | B/procedures: 7. Creation and training values | `FUN_417f_056c` |
| 0x371F6 | coab/records | coab/records: 10. Creation effects and paladin abilities |  |
| 0x37647 | coab/records | coab/records: 10. Creation effects and paladin abilities |  |
| 0x3764E | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x378D7 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x388DB | B/procedures | B/procedures: 3. Starting money |  |
| 0x389B7 | coab/chargen-and-progression, B/procedures | coab/chargen-and-progression: 1. The recalculation |  |
| 0x389EA | B/procedures | B/procedures: 3. Starting money |  |
| 0x38B07 | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x38C70 | coab/records | coab/records: 2.1 Base vs current stats |  |
| 0x38E56 | B/procedures | B/procedures: 12.4 The camp's Fix |  |
| 0x39DFE | coab/README, coab/records | coab/README: Open |  |
| 0x39E98 | coab/records | coab/records: CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md) |  |
| 0x39EFD | coab/records | coab/records: 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files") |  |
| 0x3A275 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x3A468 | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers |  |
| 0x3B0F0 | B/procedures | B/procedures: 3. Starting money |  |
| 0x3B230 | B/procedures | B/procedures: 2. Hit points | `FUN_417f_29ae` |
| 0x3B2ED | coab/tables, B/procedures | coab/tables: 3.4 Hit points |  |
| 0x3B314 | coab/tables | coab/tables: 3.4 Hit points |  |
| 0x3B557 | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x3BD5D | coab/effects | coab/effects: 9. No level drain |  |
| 0x3BD76 | coab/effects | coab/effects: 9. No level drain |  |
| 0x3BD91 | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x3BE45 | coab/chargen-and-progression, B/procedures | coab/chargen-and-progression: 1. The recalculation |  |
| 0x3BF10 | B/profile | B/profile: 3.5 The ending (`EndingScript`) |  |
| 0x3BF78 | coab/assets | coab/assets: 8. Config, video, palette, sound |  |
| 0x3C6A2 | coab/assets | coab/assets: 8. Config, video, palette, sound |  |
| 0x3C77B | coab/assets | coab/assets: 8. Config, video, palette, sound |  |
| 0x3D02C | coab/ecl, B/profile, C/app-flow | coab/ecl: Opcodes | `FUN_4804_02a4` |
| 0x3D34D | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x3D378 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x3D459 | coab/assets | coab/assets: 5. BIGPIC uses |  |
| 0x3D530 | coab/chargen-and-progression, coab/records, B/procedures | coab/chargen-and-progression: The former class afterwards |  |
| 0x3D87C | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x3DBC7 | coab/assets | coab/assets: Open |  |
| 0x3E0BA | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x3ED5C | coab/assets | coab/assets: Open |  |
| 0x3F034 | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x3F29A | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x3F40D | coab/effects | coab/effects: 6. Item kinds 0x3F034 |  |
| 0x3F54A | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x3F57D | coab/effects | coab/effects: 6. Item kinds 0x3F034 |  |
| 0x3F7B5 | B/procedures | B/procedures: 9.1 Shop prices |  |
| 0x3F9A2 | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x3F9A8 | coab/chargen-and-progression, coab/spells, B/procedures | coab/chargen-and-progression: The former class afterwards | `FUN_4894_1a8a` |
| 0x3F9A9 | coab/tables | coab/tables: 3.7a Caster level |  |
| 0x3F9F1 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x3FA0D | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers | `FUN_4894_1a8a` |
| 0x3FADB | coab/chargen-and-progression, B/procedures | coab/chargen-and-progression: The former class afterwards |  |
| 0x3FBE6 | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x3FC17 | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x409AC | coab/assets | coab/assets: Open |  |
| 0x40AA9 | coab/assets | coab/assets: Open |  |
| 0x40BC4 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x40E37 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x40EBE | coab/ecl | coab/ecl: Opcodes |  |
| 0x411B7 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x4129A | coab/ecl | coab/ecl: Opcodes |  |
| 0x412AD | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x41317 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x415AA | coab/camp | coab/camp: 2. Rest |  |
| 0x415F1 | coab/camp | coab/camp: 2. Rest |  |
| 0x41647 | coab/ecl | coab/ecl: Opcodes |  |
| 0x41709 | coab/ecl | coab/ecl: Opcodes |  |
| 0x41741 | coab/camp | coab/camp: 1. Fix |  |
| 0x41ADE | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x41B6A | coab/camp | coab/camp: 1. Fix |  |
| 0x41B8F | coab/camp | coab/camp: 1. Fix |  |
| 0x41CEA | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x41D56 | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x4245A | coab/effects, B/vocabularies | coab/effects: Event → types, in the order called |  |
| 0x42D5F | coab/records | coab/records: 8. Random treasure items |  |
| 0x42D97 | coab/ecl, coab/records, coab/tables, B/procedures | coab/ecl: Random treasure types | `FUN_4c2d_1010` |
| 0x43F70 | coab/spells | coab/spells: CotAB spell handlers: diff against PoR `engine/spells.md |  |
| 0x43F8E | coab/chargen-and-progression, B/procedures | coab/chargen-and-progression: The former class afterwards |  |
| 0x449E4 | coab/chargen-and-progression, B/procedures | coab/chargen-and-progression: The former class afterwards |  |
| 0x44E02 | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers | `FUN_4e53_07d6` |
| 0x44EEF | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers | `FUN_4e53_08c3` |
| 0x450BD | coab/spells | coab/spells: 1. Dispatch and shared helpers | `FUN_4e53_0a91` |
| 0x45251 | coab/combat, coab/effects, coab/spells, B/procedures, B/vocabularies | coab/combat: Casting | `FUN_4e53_0c20` |
| 0x45373 | coab/combat, coab/spells, B/vocabularies | coab/combat: Casting |  |
| 0x45540 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x4556B | coab/combat | coab/combat: Casting |  |
| 0x455E6 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x45627 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x45672 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x4573F | coab/effects, coab/spells, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x458F0 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x45A94 | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers |  |
| 0x45C10 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x45F75 | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x4606E | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x460AA | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x46115 | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x4614A | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x466B8 | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x4675B | coab/spells, B/vocabularies | coab/spells: 4. Quirks of the original | `FUN_4e53_1b11` |
| 0x46B40 | coab/spells | coab/spells: 2. Per spell id |  |
| 0x46BCB | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x46BF8 | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x46D74 | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x46FA7 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x47096 | coab/spells | coab/spells: 2. Per spell id |  |
| 0x47154 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x47297 | coab/spells | coab/spells: 2. Per spell id |  |
| 0x47397 | coab/spells | coab/spells: 2. Per spell id |  |
| 0x47575 | B/procedures, B/vocabularies | B/procedures: 9. Temple |  |
| 0x477EB | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x478F6 | coab/effects, coab/spells, B/procedures | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x47977 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x479B4 | coab/effects, coab/spells, B/procedures | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) | `FUN_4e53_295b` |
| 0x47C01 | coab/effects, B/procedures | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x47C49 | coab/effects, B/vocabularies | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x47C7F | coab/spells, B/procedures | coab/spells: 2. Per spell id |  |
| 0x47CFC | coab/effects | coab/effects: 9. No level drain |  |
| 0x47D3B | coab/effects | coab/effects: 9. No level drain |  |
| 0x47E69 | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x47F27 | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x47FB0 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x4814A | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x48240 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x4848A | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x4856D | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x48580 | coab/effects | coab/effects: 3. Globals |  |
| 0x4862B | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x487DD | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x488A1 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x48A52 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x48A8C | coab/effects, B/vocabularies | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x48BB2 | B/vocabularies | B/vocabularies: 4.2 Shared kinds |  |
| 0x48D66 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x48D79 | coab/effects | coab/effects: 3. Globals |  |
| 0x48F05 | coab/spells, B/vocabularies | coab/spells: 4. Quirks of the original |  |
| 0x494C0 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x494EB | coab/spells | coab/spells: 2. Per spell id |  |
| 0x49522 | coab/effects, B/vocabularies | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x49697 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x496D1 | coab/effects, B/vocabularies | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x497CE | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x499CD | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x499EC | coab/effects | coab/effects: 3. Globals |  |
| 0x49B5E | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x49C94 | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x49CBB | coab/effects | coab/effects: 3. Globals |  |
| 0x49E74 | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x49E96 | coab/effects | coab/effects: 3. Globals |  |
| 0x4A001 | B/vocabularies | B/vocabularies: 3.9 Monster specials (event 14) |  |
| 0x4A121 | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x4A214 | B/vocabularies | B/vocabularies: 3.9 Monster specials (event 14) |  |
| 0x4A3FD | coab/combat | coab/combat: Casting |  |
| 0x4A4FF | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers | `FUN_4e53_3413` |
| 0x4AA3A | coab/effects, B/vocabularies | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x4AAC4 | coab/effects, B/host-contracts, B/procedures, B/vocabularies | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x4AAEE | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x4AB2D | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x4AB77 | coab/effects, coab/spells | coab/effects: 1. Dispatch | `FUN_5216_0000` |
| 0x4ABBA | coab/effects, B/procedures | coab/effects: 1. Dispatch | `FUN_5216_0026` |
| 0x4AD01 | coab/records | coab/records: 7.2 Engine conversion |  |
| 0x4AD0A | coab/effects | coab/effects: 1. Dispatch |  |
| 0x4AD2A | coab/effects | coab/effects: 1. Dispatch | `FUN_5216_0160` |
| 0x4AEC4 | coab/effects, B/vocabularies | coab/effects: 1. Dispatch | `FUN_5216_02fa` |
| 0x4AFD3 | coab/effects | coab/effects: CotAB effects: diff against PoR `engine/effects.md |  |
| 0x4B7B3 | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x4B8F7 | coab/spells, B/procedures | coab/spells: 1. Dispatch and shared helpers | `FUN_5216_0ae7` |
| 0x4BB2F | coab/spells | coab/spells: 2. Per spell id |  |
| 0x4BC7E | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x4BCF5 | coab/spells | coab/spells: 1. Dispatch and shared helpers | `FUN_5216_0cb7` |
| 0x4BD60 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x4BDA1 | coab/spells, B/vocabularies | coab/spells: 1. Dispatch and shared helpers | `FUN_5216_0d63` |
| 0x4BE31 | coab/camp, coab/combat | coab/camp: 1. Fix |  |
| 0x4BE7C | coab/spells, B/vocabularies | coab/spells: 2. Per spell id | `FUN_5216_0de3` |
| 0x4C023 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x4C05B | coab/effects, B/vocabularies | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x4C0BD | coab/effects | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x4C0FD | coab/spells | coab/spells: 1. Dispatch and shared helpers |  |
| 0x4C160 | coab/spells | coab/spells: 1. Dispatch and shared helpers | `FUN_5216_10e4` |
| 0x4C1D8 | coab/spells, B/procedures | coab/spells: 1. Dispatch and shared helpers | `FUN_5216_115c` |
| 0x4C221 | coab/effects | coab/effects: 5. The current-stat routine 0x4C389 (`4aab:18d9`, char, stat) |  |
| 0x4C389 | coab/effects, coab/records, B/procedures | coab/effects: 1. Dispatch |  |
| 0x4C700 | coab/records | coab/records: 2.1 Base vs current stats |  |
| 0x4C72B | B/procedures | B/procedures: 11. The current-stat routine |  |
| 0x4C743 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4C761 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4C7B8 | coab/chargen-and-progression, coab/records | coab/chargen-and-progression: The former class afterwards |  |
| 0x4C875 | B/procedures | B/procedures: 11. The current-stat routine |  |
| 0x4CA6A | coab/spells | coab/spells: 1. Dispatch and shared helpers | `FUN_5216_1344` |
| 0x4CAB2 | coab/effects | coab/effects: 1. Dispatch |  |
| 0x4CC3C | coab/combat, B/procedures | coab/combat: Casting |  |
| 0x4CC8A | coab/combat | coab/combat: Casting |  |
| 0x4CD49 | B/vocabularies | B/vocabularies: 4.3 The battle's kinds |  |
| 0x4CD91 | coab/spells, B/procedures | coab/spells: 1. Dispatch and shared helpers | `FUN_5216_1656` |
| 0x4CE0A | B/procedures | B/procedures: 12.1 Adding and removing effects |  |
| 0x4CE85 | coab/camp, coab/spells, coab/tables, B/procedures | coab/camp: 1. Fix | `FUN_5216_175d` |
| 0x4D1EE | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4D70D | coab/records, B/procedures | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4D748 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4D7E8 | coab/camp, coab/ecl, coab/effects, B/vocabularies | coab/camp: 1. Fix |  |
| 0x4DC70 | coab/ecl, coab/records | coab/ecl: Start-up menu and demo | `FUN_10ba_0bb8` |
| 0x4DC9E | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4DCA5 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4DCEC | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4DD5F | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4DDB8 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4DDD5 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4DE42 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4DE70 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4DEEF | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4DEFF | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4DF16 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4DFEE | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x4E0BC | coab/combat | coab/combat: The former class in battle |  |
| 0x4E2CF | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4E381 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x4E570 | coab/combat | coab/combat: Casting | `FUN_10ba_148b` |
| 0x4E5EC | coab/ecl | coab/ecl: Opcodes |  |
| 0x4E8BF | coab/effects, B/vocabularies | coab/effects: 8. Going down 0x4C05B (`e3:66`, `4aab:15ab`, char) |  |
| 0x4F395 | coab/ecl, coab/effects | coab/ecl: Opcodes |  |
| 0x4F5B4 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x4F758 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x4F8BF | coab/chargen-and-progression, coab/spells, coab/tables, B/procedures | coab/chargen-and-progression: 1. The recalculation | `FUN_10ba_26c2` |
| 0x4F8C5 | coab/tables, B/procedures | coab/tables: 3.7a Caster level |  |
| 0x4FA79 | coab/ecl | coab/ecl: Opcodes |  |
| 0x4FBB6 | coab/camp, coab/ecl | coab/camp: 1. Fix |  |
| 0x4FE10 | coab/assets | coab/assets: Open |  |
| 0x5047F | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation | `FUN_51cf_0000` |
| 0x50480 | coab/effects, B/procedures | coab/effects: 6. Item kinds 0x3F034 |  |
| 0x504AC | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x50568 | coab/chargen-and-progression, coab/tables, B/procedures | coab/chargen-and-progression: 1. The recalculation |  |
| 0x507C3 | coab/effects, coab/tables, B/procedures | coab/effects: 6. Item kinds 0x3F034 |  |
| 0x50836 | coab/README, coab/chargen-and-progression, coab/records, coab/tables, B/procedures | coab/README: Curse of the Azure Bonds (CotAB) |  |
| 0x5089F | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x508C4 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x50929 | coab/chargen-and-progression, coab/records | coab/chargen-and-progression: The former class afterwards |  |
| 0x50952 | coab/records | coab/records: 2. Character record: 0x1A6 = 422 bytes |  |
| 0x50978 | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x5098A | coab/records | coab/records: 2.2 Recomputed on load/import |  |
| 0x509CA | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x509EC | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x50A10 | coab/chargen-and-progression | coab/chargen-and-progression: The former class afterwards |  |
| 0x50A3B | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x50AF6 | coab/chargen-and-progression, coab/tables, B/procedures | coab/chargen-and-progression: 1. The recalculation |  |
| 0x50C4B | coab/chargen-and-progression, coab/tables | coab/chargen-and-progression: 1. The recalculation |  |
| 0x50C60 | coab/chargen-and-progression, coab/tables | coab/chargen-and-progression: 1. The recalculation |  |
| 0x50C6B | coab/chargen-and-progression, coab/records, coab/tables, B/procedures | coab/chargen-and-progression: 1. The recalculation | `FUN_51cf_0255` |
| 0x50F5A | coab/chargen-and-progression, coab/effects, coab/records, coab/tables, B/procedures | coab/chargen-and-progression: 1. The recalculation | `FUN_51cf_0329` |
| 0x511AE | coab/chargen-and-progression, B/procedures | coab/chargen-and-progression: Allowed classes (0x511AE) |  |
| 0x5131D | coab/chargen-and-progression | coab/chargen-and-progression: Allowed classes (0x511AE) |  |
| 0x5132C | coab/chargen-and-progression | coab/chargen-and-progression: Allowed classes (0x511AE) |  |
| 0x5133F | coab/chargen-and-progression | coab/chargen-and-progression: Allowed classes (0x511AE) |  |
| 0x51346 | coab/chargen-and-progression | coab/chargen-and-progression: The change (0x51521) |  |
| 0x5135B | coab/chargen-and-progression | coab/chargen-and-progression: The change (0x51521) |  |
| 0x5135D | coab/README, coab/chargen-and-progression, coab/combat, B/procedures | coab/README: Curse of the Azure Bonds (CotAB) |  |
| 0x51521 | coab/chargen-and-progression | coab/chargen-and-progression: The change (0x51521) |  |
| 0x515F9 | coab/chargen-and-progression, B/procedures | coab/chargen-and-progression: 1. The recalculation |  |
| 0x51691 | coab/chargen-and-progression | coab/chargen-and-progression: 1. The recalculation |  |
| 0x516DF | coab/records | coab/records: 3. Items (diff vs engine/records.md "Item record", "Item types") |  |
| 0x5171A | coab/chargen-and-progression | coab/chargen-and-progression: Where |  |
| 0x51776 | coab/chargen-and-progression | coab/chargen-and-progression: Allowed classes (0x511AE) |  |
| 0x517D2 | coab/chargen-and-progression, coab/ecl | coab/chargen-and-progression: The change (0x51521) |  |
| 0x51822 | coab/chargen-and-progression | coab/chargen-and-progression: Where |  |
| 0x51841 | coab/chargen-and-progression, coab/combat, coab/ecl, coab/tables, B/procedures | coab/chargen-and-progression: 1. The recalculation |  |
| 0x5194A | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x51A39 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x51C48 | coab/assets, coab/ecl | coab/assets: 4. Overland: no tile map |  |
| 0x51D81 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x51DFA | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x51E1F | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x51E52 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x51E8B | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x51E9D | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x51F18 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x51F9B | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x52027 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x52BD5 | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x52BDC | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x52BFE | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x52C2D | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x52C64 | coab/assets | coab/assets: Background: the main change |  |
| 0x52C98 | coab/assets | coab/assets: Background: the main change |  |
| 0x52CCC | coab/assets | coab/assets: Background: the main change |  |
| 0x52D0A | coab/assets | coab/assets: Background: the main change |  |
| 0x52D50 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x52D62 | coab/ecl | coab/ecl: Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog) |  |
| 0x52D75 | coab/assets | coab/assets: Open |  |
| 0x52DE0 | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x52E0A | coab/ecl | coab/ecl: Opcodes |  |
| 0x52EEB | coab/assets | coab/assets: 2. Inventory |  |
| 0x52F03 | coab/assets | coab/assets: 2. Inventory |  |
| 0x532B4 | coab/assets | coab/assets: Sprites and pictures |  |
| 0x532E0 | coab/assets | coab/assets: Sprites and pictures |  |
| 0x5354D | coab/assets | coab/assets: Sprites and pictures |  |
| 0x53605 | coab/ecl | coab/ecl: Opcodes |  |
| 0x53606 | coab/assets | coab/assets: 1. Containers |  |
| 0x5360C | coab/assets, coab/ecl, coab/records | coab/assets: 4. Overland: no tile map |  |
| 0x5367A | coab/assets | coab/assets: 4. Overland: no tile map |  |
| 0x536A0 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x536AF | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x537E4 | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x53805 | coab/ecl | coab/ecl: Start-up menu and demo |  |
| 0x53824 | coab/assets, B/profile, C/exploration-view | coab/assets: Background: the main change |  |
| 0x53AD4 | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x53C13 | coab/combat | coab/combat: Map-area generator |  |
| 0x53D42 | coab/assets, coab/combat, coab/ecl, B/profile | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x53E45 | coab/combat, coab/ecl | coab/combat: Map-area generator |  |
| 0x53EC0 | coab/assets | coab/assets: GEO and WALLDEF: unchanged | `FUN_55a0_05fd` |
| 0x54679 | coab/assets | coab/assets: 1. Containers |  |
| 0x546C5 | coab/assets, coab/ecl, coab/records | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x54914 | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x5492C | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x549AD | coab/assets, coab/ecl | coab/assets: GEO and WALLDEF: unchanged |  |
| 0x54B00 | coab/ecl | coab/ecl: Opcodes |  |
| 0x54B33 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x54CA5 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x54D4C | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x54EF1 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x5504A | coab/combat | coab/combat: The computer's movement |  |
| 0x553D8 | coab/effects | coab/effects: 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147) |  |
| 0x556B0 | coab/ecl | coab/ecl: Opcodes |  |
| 0x557AC | coab/assets | coab/assets: 8. Config, video, palette, sound |  |
| 0x5580C | coab/assets | coab/assets: 8. Config, video, palette, sound |  |
| 0x55BB5 | coab/effects | coab/effects: 7. The target hook, bolts and the area template (O unless marked) |  |
| 0x563B4 | coab/combat | coab/combat: The computer's probe on clouds |  |
| 0x5671C | coab/spells | coab/spells: 2. Per spell id |  |
| 0x56C4C | coab/assets | coab/assets: 2. Inventory |  |
| 0x56C50 | coab/assets, coab/ecl, B/script-vm-map | coab/assets: 2. Inventory |  |
| 0x56E15 | B/procedures | B/procedures: 1. Spell slots |  |
| 0x56E3E | B/procedures | B/procedures: 1. Spell slots |  |
| 0x578B6 | B/procedures | B/procedures: 7. Creation and training values |  |
| 0x579C5 | coab/assets | coab/assets: GEO and WALLDEF: unchanged |  |
<!-- /generated:coab -->

## Open

- CotAB routines that no file cites yet have no row; a later CotAB section adds its addresses here by
  running the tool.
