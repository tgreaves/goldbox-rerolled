# Address index

> **Status: partial** (work-plan steps 5 and 6, [AUDIT.md](../AUDIT.md) §8). Informative. Part D of
> the [specification](../README.md). Written: the notations, the routines that part B's procedures
> and maps cite (both games), and every PoR routine part A cites with its CotAB equivalent where
> part A names one (step 5). To come: the tables (part A's `DS:` addresses), and the CotAB
> routines that have no PoR equivalent.

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
