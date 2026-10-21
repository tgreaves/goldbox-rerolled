# Address index

> **Status: partial** (work-plan step 6, [AUDIT.md](../AUDIT.md) §8). Informative. Part D of the
> [specification](../README.md). Written so far: the notations, and the routines that part B's
> procedures and maps cite, for both games. To come: every routine and table part A cites.

## Notations

| Notation | Meaning |
|---|---|
| `seg:off`, `FUN_seg_off` | PoR: Ghidra address and function name in the merged image (START.EXE unpacked, GAME.OVR overlays merged; load segment 0x1000; linear = seg · 16 + off) |
| `0x2555D` | CotAB: offset in the working image (START.EXE unpacked, overlays merged; [coab/README.md, "Working image"](../A-games/coab/README.md#working-image)) |
| `ssss:oooo` in CotAB files | the image paragraph and offset (`4aab:0523` = image 0x4AFD3) |
| `image 0x…` in PoR files | an offset in PoR's merged image (`0x4245A` = `FUN_5216_02fa`) |
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
