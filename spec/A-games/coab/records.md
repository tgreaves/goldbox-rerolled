# CotAB records and save files (diff against PoR engine/records.md + engine/savegame.md)

> **Status: complete as a set of differences.** Normative. Part A of the
> [specification](../../README.md): Curse of the Azure Bonds, GOG 1.0 (engine "v1.3"). Read
> [engine/records.md](../engine/records.md) and [engine/savegame.md](../engine/savegame.md) first.
> Evidence marks as in the README (**O**: read in the CotAB binary or confirmed byte for byte in the
> shipped data; **I** also covers data plausibility and the PoR analogy). The engine model's field
> maps are [B-model/records-and-tables.md](../../B-model/records-and-tables.md). *Informative:*
> decoder `tools/coab/records_coab.py`.
 The C# rebuild (coab-ref) was used only to find code; every O below cites a CotAB address.

Addresses: `SSSS:OOOO` = overlay paragraph : offset in the merged image `coab/img.bin` (image offset = SSSS·16 + OOOO), e.g. `323c:14b3` = img 0x33873. DS = 0x0ABE, so `DS:x` = img 0xABE0 + x. Turbo Pascal runtime is seg 0x8F7 (`8f7:1925` BlockRead, `8f7:192c` BlockWrite, `8f7:18bb` Close, `8f7:1aaf` Move, `8f7:023f` GetMem, `8f7:0254` FreeMem).

Key routines (all O):

| Routine | Address | PoR equivalent |
|---|---|---|
| Load game | `323c:37b5` | `FUN_45c5_1602` |
| Save game | `323c:3f5e` | `FUN_45c5_1d58` |
| Save one character (`stem` = "" → roster file) | `323c:0dfc` | `FUN_45c5_069e` |
| Load / import one character (CotAB, PoR or Hillsfar) | `323c:22a0` | `FUN_45c5_0aec` |
| PoR record → CotAB record (nested in 22a0) | `323c:14b3` | — |
| Hillsfar transfer onto an existing record (nested) | `323c:1f35` | — |
| Delete roster files `NAME.guy/.swg/.fx` | `323c:0c90` | — |
| Roster file list (`Add` menu) | `323c:0465` → `323c:008b` | `charlist.txt` |
| Load monster record (`MON<n>CHA/SPC/ITM`) | `323c:329c`; NPC join `323c:357d` | `LOAD_MONSTER` / `FUN_45c5_1262` |
| Party menu "Add from where? Curse Pool Hillsfar Exit" | `3685:3648` | Add (`417f`) |
| Derived stats recalc | `4d05:0c20` | `FUN_10ba_0bb8` |
| Class bonuses (THAC0, attacks, saves, thief skills, class mask) | `5047:03c6` | — |
| Effective stat from base + items/effects | `4aab:18d9` | — |
| ITEMS loader | `26a5:0665` | — |

---

## 1. Files (diff vs engine/savegame.md "Files" and engine/input-and-menus.md "Character files")

| | PoR | CotAB |
|---|---|---|
| Roster character | `<stem>.CHA` (285) + `.ITM` + `.SPC`, indexed by `charlist.txt` | `<stem>.GUY` (422) + `.SWG` (items, 63 each) + `.FX` (effects, 9 each). **No charlist**: the Add list is a directory scan of `*.guy` (O, `323c:0465`, patterns at `323c:044d`: `*.guy *.cha *.sav *.hil`) |
| Party in save slot x | `CHRDAT<x><n>.SAV/.ITM/.SPC` | `CHRDAT<x><n>.SAV/.SWG/.FX` (O, `323c:0dfc` with stem `CHRDAT`+x+n, extension strings at `323c:0d76` `.guy` `.sav`, `0df3` `.swg`, `0df8` `.fx`) |
| World state | `SAVGAM<x>.DAT` 13 137 | `SAVGAM<x>.DAT` **13 149** (§5) |

Stem rule (O, `05bd:061a`): remove every character of `" .*,?/\:;|"` (table `DS:0C9A`, 10 entries) from the name, keep the first 8, upper-case.

Save one character (O, `323c:0dfc`):
1. Needed bytes = 0x1A6 + 63·items + 9·effects; if more than DiskFree: "Can't save. No room on this disk." / "Lose character?" / "Ok  Try another disk".
2. Stem "" → `NAME.guy`, asks "Overwrite NAME? " / "New file name: " (8 chars) if it exists; stem given → `<stem>.sav`, no prompt.
3. Write the 0x1A6 record as in memory (pointers included).
4. Delete `<stem>.swg`; if the item list is non-empty, write each item (63 bytes, in list order). Same for `<stem>.fx` with 9-byte effects. Empty lists → no file (as PoR).

A character lives in exactly one place (O): after `SaveGame` writes `CHRDAT<x><n>.*` it calls `323c:0c90` for every member (deletes `NAME.guy/.swg/.fx`, `323c:4461`); `LoadGame` does the same after loading the party (`323c:3c72`). PoR instead edits `charlist.txt`.

Loading one character (O, `323c:22a0(name, char, …)`, import source `DS:759E`: 0 Curse, 1 Pool, 2 Hillsfar, set by `3685:36ad..36c3`):
- Curse: BlockRead 0x1A6 into the record; clear item head +0x14D, effect head +0xF2, combat ptr +0x18D, next +0x189.
- Pool: GetMem 0x11D, read the PoR record, convert (`323c:14b3`, §7), free.
- Hillsfar: 0xBC-byte record (§7.5).
- Stem for the side files: Curse = file name minus its 4-char extension (`323c:2df7`); Pool/Hillsfar = stem of the character's name (`323c:2e19`).
- `<stem>.swg`: 63-byte items appended until a short read; each item's next (+0x2A) cleared (`323c:2e69..2f85`).
- `<stem>.fx`: 9-byte effects, next (+5) cleared (`323c:2fbb..30d7`).
- Pool only: `<stem>.spc` (the PoR effect file), keeping only effect types in the set at `323c:2280` = {18, 26, 47, 48, 97, 107, 124} (`323c:318a`, set test `8f7:0d77`) — the permanent racial effects (gnome/dwarf attack bonuses, dwarf/gnome vs giants, gnome defence, CON save bonus, elf and half-elf resistance; PoR spec/effects numbering, same ids).
- Then recalc `4d05:0c20` and class bonuses `5047:03c6` (`323c:325a`, `3265`).

Add-menu list (O, `323c:008b`, parameters from `DS:0508/050B/0511`): a file is listed if its size equals {0x1A6, 0x11D, 0xBC}[source], its name (Pascal string at {0, 0, 4}) is not already in the party, and the byte at {0xF7, 0x84, 0x13} is ≤ 0x7F (NPCs hidden; Hillsfar skips this test). Pool lists both `*.cha` and `*.sav`, i.e. **PoR save-slot characters `CHRDAT??.SAV` can be imported directly**; they are labelled with "from saved game " (string at `323c:007b`, I for the exact format). Paladin/evil, ranger-count and 6-PC/8-member checks follow in `3685` (strings at `3685:35ae..3647`, I for the rule details).

In memory (O): party list head `DS:6524`, current character `DS:6520`, next pointer at +0x189 (PoR `DS:5D96`, `DS:5D92`, +0x104).

---

## 2. Character record: 0x1A6 = 422 bytes

Same record for party members, NPCs and monsters (all 81 `MON<n>CHA` records and all six `CHRDATA?.SAV` are 422 bytes, O).

Column "PoR" = source offset in the 285-byte PoR record as copied by the converter `323c:14b3` (O for every row that has one: each is a `mov`/`Move` from PoR+x to CotAB+y in that routine). Status: **same** offset, **moved**, **new** in CotAB, **changed** meaning/format.

| CotAB | Size | Field | PoR | Status | Ev. |
|---|---|---|---|---|---|
| 0x00 | 16 | name, Pascal string[15] | 0x00 | same | O |
| 0x10 + 2i | 1 | **base** stat i (i = 0..5: STR INT WIS DEX CON CHA) | 0x10 + i | changed: pairs | O |
| 0x11 + 2i | 1 | **current** (effective) stat i; read by all rules (STR index `4d05:127f` reads +0x11/+0x1C; bend bars `2ef1:0342`) | (copy) | new | O |
| 0x1C | 1 | current exceptional STR % | 0x16 | moved | O |
| 0x1D | 1 | base exceptional STR % | 0x16 | new | O |
| 0x1E–0x71 | 84 | memorised spells: id, ≥ 0x80 = still being learned, 0 = empty (`2fda:018b` clears all ≥ 0x80 over 0..0x53) | 0x17–0x2B (21) | changed (4× larger), **not converted** | O |
| 0x72 | 1 | hours left to finish learning spells; decremented hourly, 0 → done (`40ea:0c3e..0c54`); set from the pending spell levels (`2fda:0155`) | (0x2C scribing) | changed, not converted | O/I |
| 0x73 | 1 | 60 − base THAC0 (best class) | 0x2D | moved | O |
| 0x74 | 1 | race (PoR table) | 0x2E | moved | O |
| 0x75 | 1 | class (PoR table) | 0x2F | moved | O |
| 0x76 | 2 | age | 0x30 | moved | O |
| 0x78 | 1 | max HP | 0x32 | moved | O |
| 0x79–0xDC | 100 | spells known: byte[0x78 + id] = 1, ids 1–100 | 0x33–0x6A (56) | changed (100), first 56 copied | O |
| 0xDD | 1 | sweep target limit (fighter level) | 0x6B | moved | O |
| 0xDE | 1 | size/type flags | 0x6C | moved | O |
| 0xDF–0xE3 | 5 | saving throws | 0x6D–0x71 | moved | O |
| 0xE4 | 1 | base movement | 0x72 | moved | O (recalc `4d05:0eaf`) |
| 0xE5 | 1 | hit dice / highest level | 0x73 | moved | O (`5047:042f`) |
| 0xE6 | 1 | level used by the HP recompute for dual-class (converter sets = 0xE5) | — | new | O (copy) / I (use, `4aab:1d08`) |
| 0xE7, 0xE8 | 1, 1 | levels lost to energy drain, and the max HP they took (I: the converter copies PoR 0x74/0x75 here, whose meaning is O in [engine/records.md](../engine/records.md)) | 0x74, 0x75 | moved | O (copy) |
| 0xE9 | 1 | undead type | 0x76 | moved | O (copy) |
| 0xEA–0xF1 | 8 | thief skills % (PP OL F/RT MS HS HN CW RL) | 0x77–0x7E | moved | O (copy) / I (order) |
| 0xF2 | 4 | effect list head (stale in files) | 0x7F | moved | O (`323c:23c6`) |
| 0xF6 | 1 | ? | 0x83 | moved | O (copy) |
| 0xF7 | 1 | morale; ≥ 0x80 = NPC | 0x84 | moved | O (`323c:3ca8`, list test) |
| 0xF8 | 1 | NPC treasure share | 0x85 | moved | O (copy) / I |
| 0xF9, 0xFA | 1, 1 | ? | 0x86, 0x87 | moved | O (copy) |
| 0xFB | 2 × 7 | money cp sp ep gp pp gems jewelry (each counts 1 toward encumbrance) | 0x88 | moved, **not converted** | O (`4d05:0df2`) |
| 0x109–0x110 | 8 | class levels (Cleric Druid Fighter Paladin Ranger MU Thief Monk) | 0x96–0x9D | moved | O |
| 0x111–0x118 | 8 | previous class levels (dual-class) | — | new | O (`5047:04e2`, `4aab:1cb1`) |
| 0x119 | 1 | gender | 0x9E | moved | O |
| 0x11A | 1 | monster type | 0x9F | moved | O (copy) |
| 0x11B | 1 | alignment | 0xA0 | moved | O |
| 0x11C, 0x11D | 1, 1 | attacks per round × 2, hands 1/2 (set to 3 for fighter > 6, paladin > 6, ranger > 7) | 0xA1, 0xA2 | moved | O (`5047:0454`) |
| 0x11E/0x11F, 0x120/0x121, 0x122/0x123 | 1 each | natural attack hand 1/2: dice count, sides, bonus | 0xA3–0xA8 | moved | O (`4d05:0e20`) |
| 0x124 | 1 | base 60 − AC | 0xA9 | moved | O (`4d05:0e9f`) |
| 0x125 | 1 | STR adjustments apply (PCs) | 0xAA | moved | O (`4d05:1331`) |
| 0x126 | 1 | id: random 0–255 for PCs, monster id for NPCs (picture `CPIC`) | 0xAB | moved | O (`323c:35b4`, `3ccd`) |
| 0x127 | 4 | experience | 0xAC | moved | O |
| 0x12B | 1 | class mask for item use (recomputed, §2.2) | 0xB0 | moved | O (`5047:04b9`) |
| 0x12C | 1 | rolled HP without CON bonus (HP recompute starts from it, `4aab:1c93`) | 0xB1 | moved | O |
| 0x12D–0x131 | 5 | cleric spell slots L1–5 | 0xB2–0xB4 → 0x12D–0x12F | changed (5 levels) | O |
| 0x132–0x136 | 5 | druid spell slots L1–5 (I) | — | new | I |
| 0x137–0x13B | 5 | magic-user spell slots L1–5 | 0xB5–0xB7 → 0x137–0x139 | changed | O |
| 0x13C | 2 | XP award base (monsters) | 0xB8 | moved | O (copy) / I (Fire Knife 350 + 8/HP) |
| 0x13E | 1 | XP per HP | 0xBA | moved | O / I |
| 0x13F, 0x140 | 1, 1 | portrait head, body | 0xBB, 0xBC | moved | O: written only (the PoR import copies them, 0x340E4; character set-up stores 1 and 1, 0x34D87) and never read; CotAB shows no character portrait (its HEAD/BODY records are NPC portraits for PICTURE, [ecl.md](ecl.md)) |
| 0x141, 0x142 | 1, 1 | combat icon head, body/weapon | 0xBD, 0xBE | moved | O (copy) / I |
| 0x143 | 1 | combat icon slot (assigned on joining) | (0xBF) | changed, not converted | O (`323c:35d9`, `3cd7`) |
| 0x144 | 1 | icon size | 0xC0 | moved | O |
| 0x145–0x14A | 6 | icon colours | 0xC1–0xC6 | moved | O |
| 0x14B | 1 | ? (read in `2735`, 0 in all files) | — | new | ? |
| 0x14C | 1 | item count (recounted by the recalc; limit 16, I) | 0xC7 | moved | O (`4d05:0c55`) |
| 0x14D | 4 | item list head | 0xC8 | moved | O |
| 0x151 + 4·s | 4 × 9 | readied item per slot 0–8 | 0xCC | moved | O (`4d05:0d0f`) |
| 0x175, 0x179 | 4, 4 | rings 1, 2 | 0xF0, 0xF4 | moved | O |
| 0x17D, 0x181 | 4, 4 | arrows (type 0x49), quarrels (0x1C) | 0xF8, 0xFC | moved | O |
| 0x185 | 1 | hands in use | 0x100 | moved | O |
| 0x186 | 1 | save bonus from items | 0x101 | moved | O |
| 0x187 | 2 | encumbrance | 0x102 | moved | O |
| 0x189 | 4 | next record | 0x104 | moved | O |
| 0x18D | 4 | combat record pointer | 0x108 | moved | O (`323c:23d5`) |
| 0x191 | 1 | once-per-period ability counter (set 1 at chargen `3685:0dfe`, tested `3d53:3694`, decremented `3d53:3907`, written `2735:2929`; the paladins have 1) | — | new | I |
| 0x192 | 1 | ? (set 1 by the Hillsfar path `323c:21a9`) | — | new | ? |
| 0x193, 0x194 | | unused in code | — | new | O (no reference) |
| 0x195 | 1 | status (PoR table + 8 Gone) | 0x10C | moved | O |
| 0x196 | 1 | in play | 0x10D | moved | O |
| 0x197 | 1 | side (0 party, 1 enemy) | 0x10E | moved | O |
| 0x198 | 1 | computer-controlled / quick fight | 0x10F | moved, **not converted** | I (26 refs) |
| 0x199 | 1 | 60 − THAC0 (current) | 0x110 | moved | O (`4d05:0ec6`) |
| 0x19A, 0x19B | 1, 1 | 60 − AC front, rear | 0x111, 0x112 | moved | O |
| 0x19C, 0x19D | 1, 1 | attacks left hands 1/2 | 0x113, 0x114 | moved | O (copy) |
| 0x19E/0x19F, 0x1A0/0x1A1, 0x1A2/0x1A3 | | current damage hand 1/2: count, sides, bonus | 0x115–0x11A | moved | O |
| 0x1A4 | 1 | current HP | 0x11B | moved | O |
| 0x1A5 | 1 | movement | 0x11C | moved | O |

Shift summary for implementers: 0x00–0x0F same; stats become (base, current) pairs to 0x1D; 0x2D–0x32 +0x46; 0x33–0x6A +0x46 into a 100-byte array; 0x6B–0x87 +0x72/+0x73; 0x88–0x9D +0x73; 0x9E–0xB1 +0x7B; 0xB2–0xB7 split into 5-level arrays; 0xB8–0xC6 +0x84; 0xC7–0x104 +0x85; 0x108 +0x85; 0x10C–0x11C +0x89. Pointer fields are stale in files and cleared on load (O).

### 2.1 Base vs current stats (O)

Chargen (`3685`) writes each stat into +0x11+2i and STR% into +0x1C, then copies +0x11+2i → +0x10+2i and +0x1C → +0x1D (`3685:2420..2457`). `4aab:18d9(char, stat)` recomputes the current value from the base (+0x10+2i, +0x1D) plus readied items/effects and stores +0x11 / +0x1C (`4aab:1c50..1c74`). The STR index (`4d05:127f`) and all checks read current (+0x11, +0x1C). So an implementation keeps base = permanent, current = effective. Note the STR% pair is the other way round (current first).

### 2.2 Recomputed on load/import (O, `5047:03c6`)

- 0x73 = max over classes of THAC0 table `DS:3E3A + 13·class + level` (levels 0–12):
  cleric/druid/monk 40 40 40 40 42 42 42 44 44 44 46 46 46; fighter 39 40 40 42 43 … 51; paladin/ranger 40 40 40 42 43 … 51; MU 39×6, 41×5, 43 43; thief 40×5, 41×4, 44×4 (60 − THAC0).
- 0xE5 = max class level; 0x11C = 3 if fighter > 6, paladin > 6 or ranger > 7.
- saves (`5047:07fb`), thief skills if thief level > 0 (`5047:0aea`).
- 0x12B = Σ `DS:3EA2[class]` over classes with a level (or a previous level below 0xE5): cleric 0x02, druid 0x10, fighter 0x08, paladin 0x40, ranger 0x40, MU 0x01, thief 0x04, monk 0x20 (PoR guessed druid/monk/paladin/ranger bits; these are the values).
- every readied item whose `ITEMS[t][13] & 0x12B` = 0 and not cursed is unreadied (`5047:051a..0595`).

### 2.3 Pre-made party (`SAVE/CHRDATA1–6.SAV`, decoded by `records_coab.py`, O)

| # | Name | Race / class | Levels | STR | HP | THAC0 | XP | Spells | `.FX` |
|---|---|---|---|---|---|---|---|---|---|
| 1 | MATHEW | M human paladin LG 20 | Pal 5 | 18/00 | 49 | 16 | 25 000 | — | 8 Prot. from Evil |
| 2 | MARK | M human paladin LG 19 | Pal 5 | 18/53 | 51 | 16 | 25 000 | — | 8 |
| 3 | TRAVIS | M dwarf F/T TN 60 | F4/T5 | 18/12 | 34 | 17 | 12 500 | — | 97, 26, 47 |
| 4 | LEDERA | M elf F/MU LG 180 | F4/MU4 | 18/25 | 28 | 17 | 12 500 | MU slots 3/2, 8 known | 107 |
| 5 | SHARA | F human cleric LG 19 | C5 | 17 | 29 | 18 | 25 000 | slots 5/5/2, 23 known | — |
| 6 | PHILIPPE | F human MU LG 28 | MU5 | 18 | 27 | 20 | 25 000 | slots 4/2/1, 9 known | — |

All have base = current stats, 300 pp and nothing else, no items (no `.SWG` files), nothing memorised, AC 10 base / 7–8 with DEX, natural 1d2 + STR. This is exactly the shape the PoR converter produces (300 pp, no items, racial effects only), I. All `.FX` effects are permanent (duration 0, power 0xFF).

---

## 3. Items (diff vs engine/records.md "Item record", "Item types")

- **Record: unchanged, 63 bytes, same fields** (O): loaders read 0x3F-byte blocks (`323c:2ec3`, monster `323c:350f`, treasure `1885:1c84`); next pointer +0x2A (`323c:2f5c`); recalc reads type +0x2E, readied +0x34, weight +0x37, count +0x39 (`4d05:0c9c..0d85`); cursed +0x36 and readied in the class check (`5047:057c`). Shipped `ITEM2.DAX` records decode to "Banded Mail +1 (300, 3000 gp)", "Long Sword +1 (75, 2000)", scrolls with three spell ids at 0x3C–0x3E, "Ioun Stone" with handler 136 at 0x3E (O, data).
- **Storage**: per character in `<stem>.SWG` (roster `NAME.SWG`, save `CHRDAT<x><n>.SWG`), not inside the `.SAV` (O, §1). The shipped party has none.
- **`ITEMS`** (O, `26a5:0665..06d2`): open, Seek(2) over the u16 header (0x7600, same as PoR), BlockRead 0x810 into `DS:5D10`; type t at `DS:5D10 + 16t` (PoR `DS:5582`), same 16 fields. File identical in size (2050). Differences from PoR:
  - byte 13 (class mask) gains bit 0x80 on 76 types (no class sets 0x80 in `DS:3EA2`, so no effect, ?);
  - 8 dagger: range 1 → 0; 9 dart: flags 0x10 → 0x1A (DEX to-hit, launcher); 44 short bow, 73 arrow: mask 0x48 → 0xCC (thieves may use them);
  - 60–62 scrolls: hands 2 → 0; 61 MU scroll mask 0x01 → 0x05 (thieves); 66 robe mask 0x7F → 0x01 (Robe of Powerlessness/Vermin, MU only); 83 mask 0 → 0xFF; 84/87/89 mask 0x08 → 0xC8;
  - new types (names from shipped instances, I): 94 Drow Mace (slot 0, hands 0, 1d6+1/1d6, bashing), 95 Elfin Chain Mail and 96 Drow Chain Mail (slot 2, AC byte 183 = AC 5), 97 Drow Long Sword (1d8/1d12), 98 Spine (thrown, RoF 12/2, range 18), 99 Ring of Wizardry (slot 9, MU), 100 Dart of Hornets Nest (RoF 28/2, range 6), 101 Staff Sling (2 hands, range 24).
- **`ITEM<n>.DAX`** (O, `1885:1b9d`, string `1885:1b7a` "ITEM" + block + ".dax"): ECL TREASURE with item operand < 0x80 loads record id = operand and splits it into 63-byte items, added to the treasure list `DS:6FA6`; same as PoR. Record sizes 126–3654 (= 58 items, shop stock), all multiples of 63 (O).
- **Name words**: 255 × 21-byte Pascal strings at `DS:1057` for word 1 (PoR `DS:10BC`), 40 entries changed (O, data): e.g. 72 Dragon Breath, 82 Elfin Chain, 83 Wizardry, 108 Ioun Stone, 127 Dragon Slayer, 130 Frost Brand, 145 Flask of Oil, 160 Drow, 175 Spine; abbreviations 208 "Clrc Scroll", 209 "MU Scroll", 213 "Prot. Scroll", 224 "Of Prot.". The full list is read from `DS:1057` (D5).

---

## 4. Effects: `.FX` (CotAB) vs `.SPC` (PoR)

Same 9-byte record (O): `u8 type, u16 duration (0 = permanent), u8 power, u8 call-on-removal flag, ptr next` — next at +5 cleared on load (`323c:30ac`, monsters `323c:342f`), head at char+0xF2 (PoR +0x7F). Only the extension changed. Shipped: paladins `08 0000 FF 00`, dwarf `61/1A/2F`, elf `6B` (O). The type list itself grows in CotAB (Dracolich carries 110, 119, 122, 123, 125–135): [effects.md](effects.md).

---

## 5. `SAVGAM<x>.DAT`: 13 149 bytes (diff vs engine/savegame.md)

Read by `323c:37b5`, written by `323c:3f5e` in the same order (O):

| Offset | Size | Content | vs PoR |
|---|---|---|---|
| 0 | 1 | block digit `DS:5C08` | same (PoR `DS:5376`) |
| 1 | 0x800 | ECL word array A (far ptr `DS:4FB2`) | same size |
| 0x801 | 0x800 | array B (`DS:4FB6`) | same |
| 0x1001 | 0x400 | array C (`DS:4FBA`) | same |
| 0x1401 | 0x1E00 | ECL code buffer (`DS:4FBE`) | same |
| 0x3201 | 5 | `DS:7229..722D`: X, Y, facing, wall, square (I: as PoR) | same |
| 0x3206 | 1 | `DS:4FD4` previous game state | **changed** (PoR area kind `DS:49FA`) |
| 0x3207 | 1 | `DS:4FD3` game state (I: 2 = camping, the slot prompt allows Esc then, `323c:3f91`) | same role (PoR `DS:49F3`) |
| 0x3208 | 12 | 3 × (u16 wall-set record id `DS:722A+4i`, u16 slot `DS:722C+4i`), i = 1..3 | **new** (PoR stored these in A[0x4AFA..0x4AFF]) |
| 0x3214 | 1 | party count | moved (PoR 0x3208) |
| 0x3215 | 8 × 41 | member stems, Pascal string[40], `CHRDAT<x><n>`; slots past the count are stack garbage | moved (PoR 0x3209) |

13 149 = 13 137 + 12 (O, both arithmetic and `SAVGAMA.DAT`).

Before writing (O, `323c:41a3..41d3`): A[0x1F8] = speed `DS:4FC2`; A[0x1FE] = `DS:4FD7`·2 + `DS:4FD8` (pictures, animations); B[0x624] = block digit. The wall-set copy into A that PoR does is gone. The slot prompt also checks DiskFree ("Can't save. No room on this disk.", `323c:402f`).

Loading (O, `323c:37b5`): lists A–J that exist ("Load Which Game: "); reads the fields above; `DS:4FD7` = A[0x1FE] >> 1, `DS:4FD8` = A[0x1FE] & 1, `DS:4FC2` = A[0x1F8], B[0x67C] = 0; for each stem with an existing `<stem>.sav` (`323c:3be5`): allocate 0x1A6, `323c:22a0` (Curse source), add to the party (`323c:360a`); delete every member's roster files; load combat icons (PCs, morale < 0x80) or `CPIC` by id (+0x126); block digit = B[0x624]; if A[0x1CC] ≠ 0 (map area) and the saved state ≠ 0: 3D map A[0x18A] (if slot 1 record > 0) and the wall sets with record > 0 (`536a:1025(record, slot)`); A[0x1CC] = 0 → overland picture 0x79 (`52e0:080c`); finally `DS:4FD4` = `DS:4FD3`, `DS:4FD3` = 0.

Shipped `SAVGAMA.DAT` (O): block 2, position (7, 13) facing 0, states 0/0, wall slots (0, 1), (−1, −1), (−1, −1), party `CHRDATA1–6`, speed 4, pictures 3, A[0x1CC] = 1, B[0x624] = 2, ECL buffer all zero: a start-of-game save; area 0 makes the loader start at record 1 with its script loaded (O, [ecl.md, "Loading"](ecl.md#loading-o)).

---

## 6. Monsters (`MON<n>CHA/ITM/SPC.DAX`, diff vs engine/records.md "One record for everyone")

- `MON<n>CHA` record = the 422-byte character record (all 81 records in blocks 1–6, O); `MON<n>ITM` multiples of 63, `MON<n>SPC` multiples of 9 (O). All decode with RLE variant 0 (as PoR).
- `323c:329c(id, char)`: filename "MON" + block digit `DS:5C08` + "CHA"/"SPC"/"ITM" + ".dax" (strings `323c:3270`), copy 0x1A6 bytes, effects (9) then items (63) relinked; "Unable to load monster" if the CHA record is missing. `323c:357d` (NPC join): party ≤ 7, +0x126 = monster id, icon slot assigned, picture `CPIC` by id.
- Files carry the same field roles as PoR monsters: morale 0x80/0xB2 at +0xF7, side 1 at +0x197 (helpers: CYNTHIA, GRENDEL, RUSTLE side 0), XP base/per-HP at +0x13C/+0x13E, 60 − THAC0 at +0x73. The picture id that PoR kept at 0xBF is not used; CotAB picks `CPIC` by monster id (+0x126) (O).
- *Informative:* `tools/coab/records_coab.py --mon <game folder> [n]` lists every monster record.

---

## 7. PoR → CotAB transfer

### 7.1 COPYCURS.EXE (O, unpacked Turbo Pascal, not EXEPACKed: 232 relocations; image = file + 0x3C0)

A file copier, no conversion. Menu "Move characters where?": PoR → Hillsfar, PoR → CotAB, CotAB → Hillsfar, Hillsfar → CotAB, Quit. Each asks the FROM and TO drive/path (defaults `A:\SAVE`, `C:\POOLRAD`, `C:\CURSE\SAVE`, `C:\HILLSFAR`, or "Full DOS path"), confirms "OK to copy characters from X to Y?", then for each file matching the patterns copies it byte for byte in 256-byte blocks (`copycurs.img:13f8..148b`, "Out of room in …" on a short write). Patterns: PoR → Hillsfar `*.CHA`; **PoR → CotAB `*.CHA` and `*.SPC`** (strings at 0x17F6/0x17FC, two calls of the copier `0x151e` at 0x18A8/0x18D1); CotAB → Hillsfar `*.GUY`; Hillsfar → CotAB `*.HIL`. **`.ITM` is never copied.** File names are kept.

### 7.2 Engine conversion (O, `323c:14b3`; caller `323c:23f8..2481`)

The player picks "Pool" in Add; the file (`*.cha`, or a PoR save-slot `*.sav`) must be 285 bytes with [0x84] ≤ 0x7F. Then, with P = PoR record and C = the caller's CotAB record, zeroed first (FillChar 0x1A6, `323c:2381`):

1. C[0x74] = P[0x2E] (race), C[0x119] = P[0x9E] (gender), C[0x00..0x0F] = P[0x00..0x0F] (name).
2. For i = 0..5: v = P[0x10+i]; clamp to the race/sex limits (below); C[0x10+2i] = C[0x11+2i] = v.
   Limits table `DS:3F88 + 16·race` (O, image bytes): [0/1] STR min M/F, [2/3] STR max M/F, [4/5] STR% max M/F, [6,7] INT min/max, [8,9] WIS, [10,11] DEX, [12,13] CON, [14,15] CHA. Check order: raise to min, then lower to max.

   | race | STR M | STR F | STR% max M/F | INT | WIS | DEX | CON | CHA |
   |---|---|---|---|---|---|---|---|---|
   | 1 dwarf | 8–18 | 8–17 | 99 / 0 | 3–18 | 3–18 | 3–17 | 12–19 | 3–16 |
   | 2 elf | 3–18 | 3–16 | 75 / 0 | 8–18 | 3–18 | 7–19 | 6–18 | 8–18 |
   | 3 gnome | 6–18 | 6–15 | 50 / 0 | 7–18 | 3–18 | 3–18 | 8–18 | 3–18 |
   | 4 half-elf | 3–18 | 3–17 | 90 / 0 | 4–18 | 3–18 | 6–18 | 6–18 | 3–18 |
   | 5 halfling | 6–17 | 6–14 | 0 / 0 | 6–18 | 3–17 | 8–18 | 10–19 | 3–18 |
   | 6 half-orc | 6–18 | 6–18 | 99 / 75 | 3–17 | 3–14 | 3–17 | 13–19 | 3–12 |
   | 7 human | 3–18 | 3–18 | 100 / 50 | 3–18 | 3–18 | 3–18 | 3–18 | 3–18 |

   (Race 0 row is `0 5 10 0 5 5 10 15 5 10 10 15 20 10 12 12`.)
3. C[0x1C] = P[0x16] (STR%, **not clamped**). Then **Bug (O, `323c:1922..196c`)**: `if limit.STR%max[sex] > C[0x10] then C[0x10] = limit.STR%max[sex]` — it compares the cap with **base STR** and writes the cap into base STR. Since every cap > 0 exceeds 18, base STR becomes the cap for human (M 100, F 50), half-orc (99 / 75), and male dwarf 99, elf 75, gnome 50, half-elf 90; female dwarves/elves/gnomes/half-elves and halflings are unaffected. Current STR (+0x11, copied in step 2) stays correct. The next `4aab:18d9(char, 0)` (STR items/effects changing, e.g. the Strength-related cases in `3d53:1c90..1e97`, effect handlers in `43f7`) would copy it into current STR (I). Example: PoR THRENDER GRONE (dwarf, STR 17) → base STR 99. A port should clamp C[0x1C] instead (Fix), or keep the bug behind a flag (`convert_por(faithful=True)` in the script).
4. C[0x1D] = P[0x16].
5. C[0x73] = P[0x2D]; C[0x75] = P[0x2F]; C[0x76] (u16) = P[0x30]; C[0x78] = P[0x32].
6. C[0x79..0xB0] = P[0x33..0x6A] (56 known-spell flags); C[0x9C] = 0 — spell 36 (Animate Dead) is forgotten.
7. C[0xDD] = P[0x6B]; C[0xDE] = P[0x6C]; C[0xDF..0xE3] = P[0x6D..0x71]; C[0xE4] = P[0x72]; C[0xE5] = P[0x73]; C[0xE6] = C[0xE5]; C[0xE7] = P[0x74]; C[0xE8] = P[0x75]; C[0xE9] = P[0x76]; C[0xEA..0xF1] = P[0x77..0x7E].
8. C[0xF6..0xFA] = P[0x83..0x87] (morale/NPC byte at C[0xF7]).
9. **Money: C[0x103] (platinum, u16) = 300; all other coins, gems and jewelry 0** (`323c:1b40`; PoR money discarded).
10. C[0x109..0x110] = P[0x96..0x9D] (levels kept as they are; no level cap or XP change in this path).
11. C[0x11A] = P[0x9F]; C[0x11B] = P[0xA0]; C[0x11C..0x11D] = P[0xA1..0xA2]; C[0x11E..0x11F] = P[0xA3..0xA4]; C[0x120..0x121] = P[0xA5..0xA6]; C[0x122..0x123] = P[0xA7..0xA8]; C[0x124] = P[0xA9]; C[0x125] = P[0xAA]; C[0x126] = P[0xAB]; C[0x127] (u32) = P[0xAC]; C[0x12B] = P[0xB0]; C[0x12C] = P[0xB1].
12. Spell slots, j = 1..3: C[0x12C+j] = P[0xB1+j] (cleric L1–3); C[0x136+j] = P[0xB4+j] (MU L1–3).
13. C[0x13C] (u16) = P[0xB8]; C[0x13E] = P[0xBA]; C[0x13F] = P[0xBB]; C[0x140] = P[0xBC]; C[0x141] = P[0xBD]; C[0x142] = P[0xBE]; C[0x144] = P[0xC0]; C[0x145..0x14A] = P[0xC1..0xC6].
14. C[0x14C] = P[0xC7]; C[0x151..0x184] = P[0xCC..0xFF] (13 stale readied pointers; harmless, the recalc clears them).
15. C[0x185] = P[0x100]; C[0x186] = P[0x101]; C[0x187] (u16) = P[0x102].
16. C[0x195] = P[0x10C] (status: dead stays dead); C[0x196] = P[0x10D]; C[0x197] = P[0x10E]; C[0x199] = P[0x110]; C[0x19A..0x19B] = P[0x111..0x112]; C[0x19C..0x19D] = P[0x113..0x114]; C[0x19E..0x19F] = P[0x115..0x116]; C[0x1A0..0x1A1] = P[0x117..0x118]; C[0x1A2..0x1A3] = P[0x119..0x11A]; C[0x1A4] = P[0x11B] (current HP kept); C[0x1A5] = P[0x11C].

Not converted (left 0, O by absence from `323c:14b3`): memorised spells and scribing (P 0x17–0x2C), money, P[0xBF], P[0x10F] (AI flag), dual-class previous levels, CotAB 0x72, 0x132–0x136, 0x14B, 0x191–0x194.

### 7.3 After the record (O)

1. Items: the PoR `.ITM` file is never opened. `<namestem>.swg` is looked for (none exists for a PoR character), so **the character arrives with no items**.
2. Effects: `<namestem>.fx` (normally none), then `<namestem>.spc`, keeping only types {18, 26, 47, 48, 97, 107, 124}. The stem is built from the character's name, so for a PoR save-slot import (`CHRDATA1.SAV`) the slot's `CHRDATA1.SPC` is not read (I: the file name differs from the name stem); a roster `.CHA` whose stem matches does get its racial effects.
3. Recalc `4d05:0c20`: pointers cleared, item count 0, encumbrance = 300 (the platinum), AC/THAC0/damage/movement rebuilt from base values.
4. Class bonuses `5047:03c6`: THAC0 from the table (P[0x2D] is overwritten), attacks, saves, thief skills, class mask.
5. Joining rules in `3685` (paladin vs evil, ≤ 3 rangers, 6 PCs / 8 members), then icon slot and combat icon.

Net effect, PoR → CotAB: name, stats (race-clamped; STR% unclamped; base STR bug), race/class/age/gender/alignment, levels, XP, max/current HP, rolled HP, known spells (minus Animate Dead), spell slots L1–3, thief skills, status, icons and portrait kept; items, money (→ 300 pp), memorised spells and non-racial effects lost.

The engine model's import procedure is [B-model/procedures.md §13](../../B-model/procedures.md#13-character-import); GoldBox Rerolled fixes step 3's bug (IMP-070, [C-port/departures.md](../../C-port/departures.md)).

### 7.4 CotAB → its own files

Characters made or saved in CotAB are written as `.guy/.swg/.fx` (§1). A CotAB character is not written back in PoR format (O: no 285-byte writer).

### 7.5 Hillsfar (brief, O for structure)

Source 2: 0xBC-byte `*.hil`, name at +4, NPC test skipped. `323c:1f35` merges onto an existing `NAME.guy` (or a PoR `NAME.cha` converted as above) if one exists (`PlayerFileExists`, `323c:13ae`), raising stats to the Hillsfar values and creating items for Hillsfar gains (necklace/wand/ring entries built at `323c:2648..`); otherwise builds a new level-1 character. Not specified further (see `323c:248b..2801`; Open).

---

## 8. Random treasure items (O, builder 0x42D97, type choice 0x1A5A3–0x1A6E2)

Same procedure as PoR's (`FUN_4c2d_1010`, [engine/records.md, "Random items"](../engine/records.md#random-items)), different tables; the engine model states it once with each game's tables ([B-model/procedures.md §14](../../B-model/procedures.md#14-random-treasure)).

- **Type choice**: as [ecl.md, "Random treasure types"](ecl.md#random-treasure-types-o-0x1a5a30x1a6e2); r2 48/49 gives 0x3B (PoR repeats the previous type), r1 93–98 a d15 over 0x47/0x54/0x4F, r1 99–100 0x3B.
- **Plus** (0x42D5F): d20, 1–14 +1, 15–20 +2; no +3, so bracers are AC 6 or AC 4 only.
- **Names, weights (incl. type 9 count 5; unlisted 40 with count 10), values (plus × k)**: identical to PoR.
- **Javelin** (type 0x15, d5 = 5): record 0x31, the real Javelin of Lightning (PoR's 0x90 is one word short, a bug).
- **Scrolls**: d3 spells, each level d5: MU 1 d13+8, 2 d7+28, 3 d11+44, 4 d9+80, 5 d4+90; cleric 1 d8, 2 d7+21, **3 d8+36** (Animate Dead 36 never), 4 d5+65, 5 d6+70 (Cure Serious Wounds 58 never, I: an oversight); value 300 × level each.
- **Magic records**: 0x3F, 0x43 → 0x29; 0x4E, 0x4F → 0x21; 0x54, 0x5C → 0x09; 0x47 d8 1–5 → 0x11, 6–8 → 0x01; anything else blank. Records at DS:0830 + 16k (word m = 1 + 8k from DS:082E), 7 of them: Potion Extra Healing, Giant Strength, Healing, Speed (unreachable), Wand of Magic Missiles, Gauntlets of Ogre Power, Javelin of Lightning; plus and save bonus always 1. Their +0x3D are CotAB spell ids (3, 59, 3, 48, 15, 38, 51).
- So TREASURE can only make types 0x47, 0x54, 0x4F from the magic group.

## 9. Joining the party (O, Add at image 0x36848 + 0x3648..0x3A24)
Strings at 0x36848 + 0x35AE: "Add from where? ", "Curse Pool Hillsfar Exit", "Add a character: ", "paladins do not join with evil scum", "too many rangers in party", " will tolerate no evil!".
- An empty party takes the first character with no checks.
- Otherwise the party is scanned: player characters (morale < 0x80), rangers (+0x10D > 0), whether anyone is evil (alignment 2/5/8, i.e. (a + 1) mod 3 = 0) and the last paladin (+0x10C > 0) in list order. Same name and same id (+0x126) → already in the party (no message).
- Refused, in this order of messages: a paladin when anyone is evil ("paladins do not join with evil scum", with a double pause); a ranger when there are 3 already ("too many rangers in party"); an evil character when a paladin is present ("<paladin> will tolerate no evil!"). Party full (6 player characters, or 8 members for an NPC) → no message.
- PoR has only the size limits. The engine model's joining procedure: [B-model/procedures.md §8](../../B-model/procedures.md#8-joining-the-party).

## 10. Creation effects and paladin abilities (O)
- **Innate effects** at creation (0x371F6, 0x37647), permanent, power 0xFF: halfling 0x61; dwarf 0x61, 0x1A, 0x2F; gnome 0x61, 0x12, 0x2F, 0x30; elf 0x6B; half-elf 0x7C; then paladin 8 (protection from evil), ranger and cleric/ranger 0x86 (giant-class damage). PoR's dwarf and halfling 0x5A is gone (its CON save bonus moved into the saves routine, [tables.md](tables.md) §3.6a). A paladin starts with **+0x191 = 1**.
- **Lay on Hands** (View menu "Heal", availability 0x3D530 + 0x35F0: class 3 or a counting former paladin, not in combat, status Okay, no effect 0x8C; use + 0x36D7): "Heal whom?", heals 2 × paladin level (status 0/1/4/5 and HP below max; dying → unconscious), "feels better" / "is unaffected", then effect 0x8C for 1440 minutes, even when nothing was healed.
- **Cure Disease** (View menu "Cure", + 0x3655: as above but +0x191 > 0; use + 0x37EC): "Cure whom?"; not diseased → "is not diseased", "cure anyway:" (No spends nothing); removes one of each disease effect DS:082A (31, 34, 43, 44, 50, 57), +0x191 − 1, adds effect 0x8D for 10080 minutes with the removal call unless present, "is cured". The removal of 0x8D (0x27350 + 0x28EF) sets +0x191 = (paladin level − 1) div 5 + 1.
- Paladins do not turn undead (the Turn command needs a cleric level).

## 11. Open

- 0xF6, 0xF9, 0xFA, 0x14B, 0x192 meanings (copied, rarely read).
- 0x191 exact use (I: once-per-period ability counter).
- Exact effect of the base-STR bug in play (which events call `4aab:18d9` for an imported character before anything resets base STR) — trace `3d53:1c90..1e97` and the `43f7` callers.
- Bit 0x80 added to ITEMS class masks.
- Druid slots at 0x132 (no druid in play).
- The Hillsfar transfer (§7.5) beyond its structure: `323c:248b..2801` not traced.
