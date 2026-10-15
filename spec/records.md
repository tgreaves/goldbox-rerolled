---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Characters, monsters, items

Part of [[spec/README]]. Decoder: `tools/chars.py`.

## One record for everyone (O)

Player characters, NPCs and monsters share one 0x11D (285)-byte record, each with an optional item list (63-byte records) and effect list (9-byte records):

| Source | Character | Items | Effects |
|---|---|---|---|
| Pre-made / saved characters | `CHRDATxn.SAV` | `CHRDATxn.ITM` | `CHRDATxn.SPC` |
| Monsters (record = monster id) | `MON<block>CHA.DAX` | `MON<block>ITM.DAX` | `MON<block>SPC.DAX` |

Validated: all 12 `CHRDAT*.SAV` and all 172 `MON*CHA` records are 285 bytes; all ITM records are multiples of 63, all SPC multiples of 9. The six pre-made characters and a sample monster decode to plausible AD&D values.

In memory the party (and monsters during combat) is a singly linked list of these records (`DS:5D96`, next pointer at +0x104); the current character is `DS:5D92`.

## Character record (0x11D bytes)

O = read by the character sheet (`FUN_4894_004a`, `050d`, `0608`, `0901`, `FUN_10ba_08ef`, `0973`); I = inferred from other code.

| Offset | Type | Field | |
|---|---|---|---|
| 0x00 | u8 + 15 chars | name (Pascal string) | O |
| 0x10–0x15 | u8 ×6 | STR, INT, WIS, DEX, CON, CHA | O |
| 0x16 | u8 | exceptional strength % (shown when STR = 18; 100 shown as "00") | O |
| 0x18–0x2C | u8 ×21 | memorised spells (spell ids, 0 = empty) | O (AI casting) |
| 0x2E | u8 | race (table below) | O |
| 0x2F | u8 | class (table below) | O |
| 0x30 | u16 | age | O |
| 0x32 | u8 | max HP | O |
| 0x6C | u8 | size/type flags; large if > 0x80 or `(v & 7) > 1` | O |
| 0x6D–0x71 | u8 ×5 | saving throws: death/poison, petrification, rod/staff/wand, breath, spell | O (storage), I (order, matches AD&D) |
| 0x79 | u8 | attribute averaged by `CHECK_PARTY` mode 0x6BA7 (**?**) | O |
| 0x84 | u8 | NPC morale; bit 7 set = NPC | O |
| 0x88 | u16 ×7 | money: copper, silver, electrum, gold, platinum, gems, jewelry | O |
| 0x96–0x9D | u8 ×8 | level in Cleric, Druid, Fighter, Paladin, Ranger, Magic-User, Thief, Monk | O |
| 0x9E | u8 | gender: 0 Male, 1 Female | O |
| 0xA0 | u8 | alignment (table below) | O |
| 0xAC | u32 | experience | O |
| 0xA3, 0xA5, 0xA7 | u8 | natural attack values used by AI weapon scoring (**?** exact meaning) | O |
| 0xB0 | u8 | class bitmask for item use (`ITEMS[t][13] & char[0xB0]`) | O |
| 0xBF | u8 | combat icon / picture id for monsters (**I**, set by `LOAD_MONSTER`) | O |
| 0xC8 | ptr | item list head (in memory) | O |
| 0xCC, 0xD0, 0xD4 | ptr | readied weapon, shield, armour | O |
| 0xF8, 0xFC | ptr | readied arrows, quarrels | O |
| 0x100 | u8 | free hands | O |
| 0x102 | u16 | encumbrance | O |
| 0x104 | ptr | next record (in memory) | O |
| 0x10C | u8 | status (table below) | O |
| 0x10E | u8 | flag set by `ADD_NPC` when id = 0x18 | O |
| 0x110 | u8 | 60 − THAC0 | O |
| 0x111 | u8 | 60 − AC (front) | O |
| 0x112 | u8 | 60 − AC (rear, used from behind) | O |
| 0x113, 0x114 | u8 | attacks remaining this round, hands 1/2 (**I**: reset per round) | O |
| 0x116, 0x118, 0x11A | u8 | second hand damage dice count, sides, bonus | O |
| 0x115, 0x117, 0x119 | u8, u8, s8 | damage dice count, sides, bonus | O |
| 0x11B | u8 | current HP | O |
| 0x11C | u8 | movement; the character sheet doubles it if effect 0x2A is present and halves it for 0x27 (conflicts with the spell table, see [[spec/spells]]) | O |

Pointer fields are stale in files and must be ignored on load.

### Enumerations (O, engine DS tables)

- **Race** (DS:0F03): 0 Monster, 1 Dwarf, 2 Elf, 3 Gnome, 4 Half-Elf, 5 Halfling, 6 Half-Orc, 7 Human
- **Class** (DS:0D38): 0 Cleric, 1 Druid, 2 Fighter, 3 Paladin, 4 Ranger, 5 Magic-User, 6 Thief, 7 Monk, 8 Cleric/Fighter, 9 Cleric/Fighter/Magic-User, 10 Cleric/Ranger, 11 Cleric/Magic-User, 12 Cleric/Thief, 13 Fighter/Magic-User, 14 Fighter/Thief, 15 Fighter/Magic-User/Thief, 16 Magic-User/Thief, 17 Monster
- **Alignment** (DS:0F53): LG, LN, LE, NG, TN, NE, CG, CN, CE (0–8)
- **Status** (DS:1047): 0 Okay, 1 Animated, 2 tempgone, 3 Running, 4 Unconscious, 5 Dying, 6 Dead, 7 Stoned
- ECL `PARTY_HAS_2F` (0x22) tests class 4 or 10, i.e. **party has a ranger**

## Item record (63 bytes)

| Offset | Type | Field | |
|---|---|---|---|
| 0x00 | u8 + 41 chars | display name cache (Pascal string; only `len` chars valid) | O |
| 0x2A | ptr | next item (in memory; linked list) | O |
| 0x2E | u8 | item type → `ITEMS` entry | O |
| 0x2F, 0x30, 0x31 | u8 ×3 | name words n1, n2, n3 (1-based into the word table, 0 = none) | O/I |
| 0x32 | u8 | plus (**I**) | I |
| 0x34 | u8 | readied flag | I |
| 0x37 | u16 | weight (coins) | I |
| 0x39 | u8 | count / charges (**I**) | I |
| 0x3A | u16 | value (gp) | I |
| 0x3C–0x3E | u8 ×3 | magical effects (**I**) | I |

Display name = words[n3−1], words[n2−1], words[n1−1], space-separated, skipping zeros (I: "Banded Mail" = n3 56 "Banded", n2 47 "Mail"). Weights and values of the sample items match AD&D (flail 150 / 3 gp, banded mail 350 / 90 gp, two-handed sword 250 / 30 gp).

### Name words (O)

255 words at DS:10BC, 21 bytes each (Pascal string). 0–46 weapons, 47–58 armour, 59–160 magic/mundane item nouns, 161–165 `+1`..`+5`, 166 `of`, 200–202 `-1`..`-3`, the rest adjectives and proper names (`Of Tyr`, `Flame Tongue`, `Cursed`, …).

## Item types (`ITEMS`, O for layout, I for fields)

`u16` header (0x7600), then 128 × 16 bytes indexed by item type:

| Byte | Field (I) | Flail (12) | Two-Handed Sword (38) |
|---|---|---|---|
| 0 | slot (0 weapon, 2 body armour, …) | 0 | 0 |
| 1 | hands | 1 | 2 |
| 2, 3 | damage dice vs large: count, sides | 2d4 | 3d6 |
| 4 | bonus vs large | 0 | 0 |
| 9, 10 | damage dice vs small/medium | 1d6 | 1d10 |
| 11 | bonus vs small/medium | +1 | 0 |
| 13 | class-use bitmask (AND with char[0xB0]) | 0x4A | 0x48 |
| 14 | weapon flags: 0x08 needs ammo, 0x01 arrows, 0x80 quarrels, 0x10 thrown | | |
| 12 | range (missile range bands = (range−1)/3) | | |
| 5–8, 14, 15 | **?** (attacks, AC for armour) | | |

## Effect record (9 bytes, I)

`u8 type, u16 duration, u8 power, u8 ?, ptr next`. Effect type numbers are referenced by engine checks (0x27 slow, 0x2A haste, inferred from movement). Full list **?**.
