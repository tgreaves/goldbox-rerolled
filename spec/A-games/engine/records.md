---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Characters, monsters, items

Part of the [specification](../../README.md), part A. Decoder: `tools/chars.py`.

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
| 0x17–0x2B | u8 ×21 | memorised spells: id = ready, id + 0x80 = pending until rest, 0 = empty | O |
| 0x2C | u8 | scribing hours remaining | O |
| 0x2E | u8 | race (table below) | O |
| 0x2F | u8 | class (table below) | O |
| 0x30 | u16 | age | O |
| 0x32 | u8 | max HP | O |
| 0x33–0x6A | u8 ×56 | spells known: char[0x32 + spell id] = 1 | O (character creation, training) |
| 0x6C | u8 | size/type flags; large if > 0x80 or `(v & 7) > 1` | O |
| 0x6D–0x71 | u8 ×5 | saving throws: death/poison, petrification, rod/staff/wand, breath, spell | O (storage), I (order, matches AD&D) |
| 0x74, 0x75 | u8, u8 | levels lost to energy drain, and the max HP they took (energy drain `FUN_3723_2122` adds; Restoration and training take back max HP ÷ levels) | O |
| 0x76 | u8 | undead type (monsters; turn undead table row) | O |
| 0x77–0x7E | u8 ×8 | thief skills % (PP, OL, F/RT, MS, HS, HN, CW, RL) | O |
| 0x2D | u8 | 60 − base THAC0 (best class) | O |
| 0x73 | u8 | highest class level | O |
| 0x84 | u8 | NPC morale; bit 7 set = NPC | O |
| 0x88 | u16 ×7 | money: copper, silver, electrum, gold, platinum, gems, jewelry | O |
| 0x96–0x9D | u8 ×8 | level in Cleric, Druid, Fighter, Paladin, Ranger, Magic-User, Thief, Monk | O |
| 0x9E | u8 | gender: 0 Male, 1 Female | O |
| 0xA0 | u8 | alignment (table below) | O |
| 0xAC | u32 | experience | O |
| 0x6B | u8 | fighter level (race > 0 and fighter level > 0), else 1; set by the stat recalculation, copied to combat record [5] (G: sweep-attack target limit) | O |
| 0x72 | u8 | base movement (12 for player characters) | O |
| 0xA1, 0xA2 | u8 | attacks per round × 2, hand 1 / hand 2 (fighters 3 from level 7); copied to 0x113/0x114 each round | O/I |
| 0xA3/0xA4, 0xA5/0xA6, 0xA7/0xA8 | u8 | natural (unarmed) attack, hand 1/hand 2: dice count, dice sides, bonus (player characters 1d2+0); copied to 0x115–0x11A by the recalculation | O |
| 0xA9 | u8 | base 60 − AC (50 = AC 10) | O |
| 0xAA | u8 | 1 = STR to-hit/damage adjustments apply (player characters) | O |
| 0xB1 | u8 | hit dice / HP-roll counter (monster XP uses it) | O/I |
| 0xB2–0xB4 | u8 ×3 | cleric spell slots, spell levels 1–3 | O |
| 0xB5–0xB7 | u8 ×3 | magic-user spell slots, spell levels 1–3 | O |
| 0xB0 | u8 | class bitmask for item use (`ITEMS[t][13] & char[0xB0]`): OR of 0x01 Magic-User, 0x02 Cleric, 0x04 Thief, 0x08 Fighter (pre-made characters: cleric 0x02, C/F/MU 0x0B, F/MU 0x09) | O |
| 0xBF | u8 | combat icon / picture id for monsters (**I**, set by `LOAD_MONSTER`) | O |
| 0xC7 | u8 | number of carried items (recounted by the recalculation; limit 16) | O |
| 0xC8 | ptr | item list head (in memory) | O |
| 0xCC + 4·slot | ptr ×9 | readied item per slot 0–8: 0xCC weapon, 0xD0 shield, 0xD4 body armour, 0xD8 gauntlets, 0xDC helm, 0xE0 belt/necklace, 0xE4 robe, 0xE8 cloak, 0xEC boots | O |
| 0xF0, 0xF4 | ptr | readied rings 1 and 2 | O |
| 0xF8, 0xFC | ptr | readied arrows, quarrels | O |
| 0x100 | u8 | hands in use (Σ `ITEMS[t][1]` over readied items; at most 2) | O |
| 0x101 | s8 | saving-throw bonus from readied items (item[0x33]), added to every save roll | O |
| 0x102 | u16 | encumbrance in coins | O |
| 0x104 | ptr | next record (in memory) | O |
| 0x10C | u8 | status (table below) | O |
| 0x10E | u8 | enemy side: 1 for monsters (171 of 172 monster records) and hostile NPCs (`ADD_NPC` id 0x18); 0 for the party. Picks the side's to-hit bonus (ECL 0x6E70 / 0x6E71) and movement bonus (0x6E72) | O |
| 0x110 | u8 | 60 − THAC0 | O |
| 0x111 | u8 | 60 − AC (front) | O |
| 0x112 | u8 | 60 − AC (rear, used from behind) | O |
| 0x113, 0x114 | u8 | attacks remaining this round, hands 1/2 (**I**: reset per round) | O |
| 0x116, 0x118, 0x11A | u8 | second hand damage dice count, sides, bonus | O |
| 0x115, 0x117, 0x119 | u8, u8, s8 | damage dice count, sides, bonus | O |
| 0x11B | u8 | current HP | O |
| 0x11C | u8 | movement; Haste (effect 0x27) doubles, Slow (0x2A) halves; the original character sheet displays this reversed (bug) | O |

Pointer fields are stale in files and must be ignored on load.

### Enumerations (O, engine DS tables)

- **Race** (DS:0F03): 0 Monster, 1 Dwarf, 2 Elf, 3 Gnome, 4 Half-Elf, 5 Halfling, 6 Half-Orc, 7 Human
- **Class** (DS:0D38): 0 Cleric, 1 Druid, 2 Fighter, 3 Paladin, 4 Ranger, 5 Magic-User, 6 Thief, 7 Monk, 8 Cleric/Fighter, 9 Cleric/Fighter/Magic-User, 10 Cleric/Ranger, 11 Cleric/Magic-User, 12 Cleric/Thief, 13 Fighter/Magic-User, 14 Fighter/Thief, 15 Fighter/Magic-User/Thief, 16 Magic-User/Thief, 17 Monster
- **Alignment** (DS:0F53): LG, LN, LE, NG, TN, NE, CG, CN, CE (0–8)
- **Status** (DS:1047): 0 Okay, 1 Animated, 2 tempgone, 3 Running, 4 Unconscious, 5 Dying, 6 Dead, 7 Stoned
- ECL `PARTY_HAS_2F` (0x22) tests class 4 or 10, i.e. **party has a ranger**

## Item record (63 bytes)

Same layout in character `.ITM` files, `ITEM<block>.DAX` (placed treasure and shop stock) and `MON<block>ITM.DAX`.

| Offset | Type | Field | |
|---|---|---|---|
| 0x00 | u8 + 41 chars | display name cache (Pascal string), rebuilt by the name routine below | O |
| 0x2A | ptr | next item (in memory; linked list) | O |
| 0x2E | u8 | item type → `ITEMS` entry | O |
| 0x2F, 0x30, 0x31 | u8 ×3 | name words n1, n2, n3 (1-based into the word table, 0 = none); displayed n3 n2 n1 | O |
| 0x32 | s8 | plus: to-hit and damage for weapons, AC for armour/shields/rings/bracers/cloaks | O |
| 0x33 | s8 | saving-throw bonus, applied only for items whose `ITEMS` AC descriptor is exactly 0x80 (rings of protection, cloaks of displacement, cursed necklace) | O |
| 0x34 | u8 | readied flag | O |
| 0x35 | u8 | hidden name words: bit (3 − n) set hides word n (0x04 n1, 0x02 n2, 0x01 n3); Identify clears it | O |
| 0x36 | u8 | cursed: cannot be unreadied (Remove Curse clears it, I) | O |
| 0x37 | u16 | weight in coins, **per unit** | O |
| 0x39 | u8 | count: 0 = single item that does not stack; ≥ 1 = stack (arrows, darts, potions, …). Weight and Sell price scale with it | O |
| 0x3A | u16 | value in gp: the Buy price; Sell offers half | O |
| 0x3C | u8 | property 1: charges / doses. Scrolls: 0x3C–0x3E hold up to three spell ids, bit 7 = flagged for scribing (the item cannot then be traded, dropped or sold without confirming "is it Okay to lose it?") | O |
| 0x3D | u8 | property 2: spell cast by Use (ids > 0x38 have 0x17 subtracted: 80–90 → item-only spells 57–67); or the effect / parameter for an item handler | O |
| 0x3E | u8 | property 3: ≥ 0x80 = item effect handler type (128–139, [effects.md](effects.md)) called on ready/unready; then the item cannot be Used | O |

Weights and values of shop items match the GameFAQs guide (9.2) and AD&D (flail 150 / 3 gp, banded mail 350 / 90 gp, two-handed sword 250 / 30 gp). A stack weighs item[0x37] × count (10 shop arrows of weight 4 weigh 40); the guide's per-arrow 0.4 does not match the shipped records (O, `FUN_10ba_0bb8` and `FUN_4894_275b`).

### Display name (O, `FUN_10ba_0442(char, item, col, row, inInventory, print)`)

```
s = ""
if inInventory: s += item.readied ? " Yes  " : " No   "        // the Ready column
if any party member has effect 5 (Detect Magic)
   and (item[0x32] > 0 or item[0x33] > 0 or item[0x36] != 0): s += "* "
if item.count > 0: s += str(count) + " "
mask = 0
for n in 1..3: if word[n] != 0 and not (item[0x35] >> (3-n)) & 1: mask |= 1 << (n-1)
plural = false
for n in 3 down to 1 where mask bit (n-1):
    s += WORDS[word[n]]
    if count < 2 or plural:                  s += " "
    elif plural_here(n): s += "s "; plural = true
    else:                                    s += " "
plural_here(n) = (1<<(n-1)) == mask                       // only visible word
              or (n == 1 and mask > 4 and type != 0x56)   // noun after an adjective
              or (n == 2 and mask bit 0 clear)
              or (n == 3 and type == 0x56)                // "Flasks of Oil"
              or (type in {0x49 arrow, 0x1C quarrel} and word n3 != 0xB1)
```

Negative-plus items show "*" only through the cursed flag. The string is stored in item[0x00] and printed in colour 10.

### Name words (O)

255 words at DS:10BC (word w at DS:10A7 + 21·w), 21 bytes each (Pascal string). Name bytes are 1-based (byte w is entry w − 1): weapons 1–47, armour 48–59, magic and mundane nouns 60–161, `+1`..`+5` 162–166, `of` 167, `-1`..`-3` 201–203, the rest adjectives and proper names (`Of Tyr`, `Flame Tongue`, `Cursed`, …). Word 0x65 is "Gem", 0xBA "Holding" (Bag of Holding test), 0xD6 "Jewelry".

## Item types (`ITEMS`, O)

File `ITEMS`: u16 header (0x7600, unused), then 128 × 16 bytes; loaded at DS:5580, so type t is at DS:5582 + 16·t.

| Byte | Field | Read by |
|---|---|---|
| 0 | slot: 0 weapon, 1 shield, 2 body armour, 3 gauntlets, 4 helm, 5 belt/necklace, 6 robe, 7 cloak, 8 boots, 9 ring, 10 miscellaneous (ammunition, potions, mirrors, holy symbols, jewellery), 11 magic-user scroll, 12 clerical scroll; other values are unique slot numbers that never conflict: 74, 75, 77 (bracers), 78 (both wand types), 80 (potions of giant strength), 81, 82, 83, 91 | ready, recalc (O) |
| 1 | hands needed (0–2) | ready, recalc (O) |
| 2, 3, 4 | damage vs large: dice count, sides, s8 bonus | combat (O, [combat-rules.md](combat-rules.md)) |
| 5 | missile attacks per round × 2 | combat round start (O, `FUN_3aae_0d23`) |
| 6 | AC descriptor: < 0x80 none; 0x80 = "AC from the item's plus" (misc or ring); 0x81 shield (+1); ≥ 0xB2 body/bracers AC in 60 − AC units (value − 0x80: 50 + armour bonus) | recalc (O) |
| 7 | damage type: 0 slashing, 1 piercing, 0x80 bashing | effects 94/115 (O) |
| 8 | 0x80 on most weapons, 0 elsewhere; no reader found | **?** |
| 9, 10, 11 | damage vs small/medium: dice count, sides, s8 bonus | recalc (O) |
| 12 | range in squares (> 1 = ranged weapon; bands `(range − 1)/3`) | combat (O) |
| 13 | class mask, AND with char[0xB0] (bits 0x10–0x80 for druid/monk/paladin/ranger per the guide; no such classes are playable) | ready, AI (O) |
| 14 | weapon flags: 0x01 fires arrows (char[0xF8]), 0x02 DEX missile to-hit applies, 0x04 STR to-hit and damage apply, 0x08 launcher/missile weapon (AI; needs 0x01/0x80 ammunition unless thrown or flags = 0x0A sling), 0x10 thrown, 0x80 fires quarrels (char[0xFC]) | recalc, combat (O) |
| 15 | always 0 | — |

Every defined type (names from the shipped item records; G = from the guide only; S/M and L = damage vs small/medium and large; RoF ×2):

| t | name | slot | hands | S/M | L | RoF | range | AC | class | flags |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | (unused) | 0 | 1 | 1d6 | 1d6 | | | | 0x48 | 0x01 |
| 1 | Battle Axe | 0 | 1 | 1d8 | 1d8 | | | | 0x48 | 0x04 |
| 2 | Hand Axe | 0 | 1 | 1d6 | 1d4 | 2 | 4 | | 0x68 | 0x14 |
| 3 | Bardiche | 0 | 2 | 2d4 | 3d4 | | | | 0x68 | 0x04 |
| 4 | Bec De Corbin | 0 | 2 | 1d8 | 1d6 | | | | 0x68 | 0x14 |
| 5 | Bill-Guisarme | 0 | 2 | 2d4 | 1d10 | | | | 0x68 | 0x01 |
| 6 | Bo Stick | 0 | 1 | 1d6 | 1d3 | | | | 0x68 | 0x04 |
| 7 | Club | 0 | 1 | 1d6 | 1d3 | 2 | 4 | | 0x7E | 0x14 |
| 8 | Dagger | 0 | 1 | 1d4 | 1d3 | | 1 | | 0x7D | 0x04 |
| 9 | Dart | 0 | 1 | 1d3 | 1d2 | 6 | 6 | | 0x5D | 0x10 |
| 10 | Fauchard | 0 | 2 | 1d6 | 1d8 | | | | 0x68 | 0x04 |
| 11 | Fauchard-Fork | 0 | 2 | 1d8 | 1d10 | | | | 0x68 | 0x04 |
| 12 | Flail | 0 | 1 | 1d6+1 | 2d4 | | | | 0x4A | 0x04 |
| 13 | Military Fork | 0 | 2 | 1d8 | 2d4 | | | | 0x68 | 0x04 |
| 14 | Glaive | 0 | 2 | 1d6 | 1d10 | | | | 0x68 | 0x04 |
| 15 | Glaive-Guisarme | 0 | 2 | 2d4 | 2d6 | | | | 0x68 | 0x04 |
| 16 | Guisarme | 0 | 2 | 2d4 | 1d8 | | | | 0x68 | 0x04 |
| 17 | Guisarme-Voulge | 0 | 2 | 2d4 | 2d4 | | | | 0x68 | 0x00 |
| 18 | Halberd | 0 | 2 | 1d10 | 2d6 | | | | 0x68 | 0x04 |
| 19 | Lucern Hammer | 0 | 2 | 2d4 | 1d6 | | | | 0x48 | 0x04 |
| 20 | Hammer | 0 | 1 | 1d4+1 | 1d4 | 2 | 4 | | 0x5A | 0x14 |
| 21 | Javelin | 0 | 1 | 1d6 | 1d6 | 2 | 7 | | 0x68 | 0x1A |
| 22 | Jo Stick | 0 | 1 | 1d6 | 1d4 | | | | 0x68 | 0x04 |
| 23 | Mace | 0 | 1 | 1d6+1 | 1d6 | | | | 0x4A | 0x04 |
| 24 | Morning Star | 0 | 1 | 2d4 | 1d6+1 | | | | 0x48 | 0x04 |
| 25 | Partisan | 0 | 2 | 1d6 | 1d6+1 | | | | 0x68 | 0x04 |
| 26 | Military Pick | 0 | 1 | 1d6+1 | 2d4 | | | | 0x48 | 0x04 |
| 27 | Awl Pike | 0 | 2 | 1d6 | 1d12 | | | | 0x68 | 0x04 |
| 28 | Quarrel | 10 | 0 | 1d4 | 1d4 | | | | 0x68 | 0x8A |
| 29 | Ranseur | 0 | 2 | 2d4 | 2d4 | | | | 0x68 | 0x04 |
| 30 | Scimitar | 0 | 1 | 1d8 | 1d8 | | | | 0x58 | 0x04 |
| 31 | Spear | 0 | 2 | 1d6 | 1d8 | 2 | 4 | | 0x78 | 0x14 |
| 32 | Spetum | 0 | 2 | 1d6+1 | 2d6 | | | | 0x68 | 0x04 |
| 33 | Quarter Staff | 0 | 2 | 1d6 | 1d6 | | | | 0x7B | 0x04 |
| 34 | Bastard Sword | 0 | 2 | 2d4 | 2d8 | | | | 0x48 | 0x04 |
| 35 | Broad Sword | 0 | 1 | 2d4 | 1d6+1 | | | | 0x4C | 0x04 |
| 36 | Long Sword | 0 | 1 | 1d8 | 1d12 | | | | 0x4C | 0x04 |
| 37 | Short Sword | 0 | 1 | 1d6 | 1d8 | | | | 0x4C | 0x04 |
| 38 | Two-Handed Sword | 0 | 2 | 1d10 | 3d6 | | | | 0x48 | 0x04 |
| 39 | Trident | 0 | 1 | 1d6+1 | 3d4 | | | | 0x48 | 0x04 |
| 40 | Voulge | 0 | 2 | 2d4 | 2d4 | | | | 0x68 | 0x04 |
| 41 | Composite Long Bow | 0 | 2 | 1d6 | 1d6 | 4 | 22 | | 0x48 | 0x0B |
| 42 | Composite Short Bow | 0 | 2 | 1d6 | 1d6 | 4 | 19 | | 0x48 | 0x0B |
| 43 | Long Bow | 0 | 2 | 1d6 | 1d6 | 4 | 22 | | 0x48 | 0x0B |
| 44 | Short Bow | 0 | 2 | 1d6 | 1d6 | 4 | 16 | | 0x48 | 0x0B |
| 45 | Fine Composite Long Bow (monster copies named Heavy Crossbow) | 0 | 2 | 1d6 | 1d6 | 4 | 20 | | 0x68 | 0x0F |
| 46 | Light Crossbow | 0 | 2 | 1d4 | 1d4 | 2 | 19 | | 0x68 | 0x8A |
| 47 | Sling | 0 | 1 | 1d4+1 | 1d6+1 | 2 | 21 | | 0x5C | 0x0A |
| 50 | Leather Armor | 2 | 0 | | | | | 52 (AC 8) | 0x5E | |
| 51 | Padded Armor | 2 | 0 | | | | | 52 (AC 8) | 0x4A | |
| 52 | Studded Leather Armor | 2 | 0 | | | | | 53 (AC 7) | 0x4A | |
| 53 | Ring Mail | 2 | 0 | | | | | 53 (AC 7) | 0x4A | |
| 54 | Scale Mail | 2 | 0 | | | | | 54 (AC 6) | 0x4A | |
| 55 | Chain Mail | 2 | 0 | | | | | 55 (AC 5) | 0x4A | |
| 56 | Splint Mail | 2 | 0 | | | | | 56 (AC 4) | 0x4A | |
| 57 | Banded Mail | 2 | 0 | | | | | 56 (AC 4) | 0x4A | |
| 58 | Plate Mail | 2 | 0 | | | | | 57 (AC 3) | 0x4A | |
| 59 | Shield | 1 | 1 | | | | | +1 | 0x5A | |
| 60 | (no instance) | 10 | 2 | | | | | | 0x7F | |
| 61 | Magic User Scroll | 11 | 2 | | | | | | 0x01 | |
| 62 | Clerical Scroll | 12 | 2 | | | | | | 0x02 | |
| 63 | Gauntlets (of Ogre Power) | 3 | 0 | | | | | | 0x7F | |
| 64 | (helm; no instance) | 4 | 0 | | | | | | 0x7F | |
| 65 | (belt/necklace; no instance) | 5 | 0 | | | | | | 0x7F | |
| 66 | (robe; no instance) | 6 | 0 | | | | | | 0x7F | |
| 67 | Cloak (Elvenkind; no AC) | 7 | 0 | | | | | | 0x7F | |
| 68 | Boots | 8 | 0 | | | | | | 0x7F | |
| 69 | Ring (Fire Resistance, Invisibility, plain) | 9 | 0 | | | | | | 0x7F | |
| 70 | miscellaneous, no hands (potions, Dust, holy symbols, statuettes, jewellery, kept gems, Bag of Holding) | 10 | 0 | | | | | | 0x7F | |
| 71 | miscellaneous, one hand (mirrors, holy symbols of Tyr/Sune/Tempus, potions) | 10 | 1 | | | | | | 0x7F | |
| 72 | miscellaneous, two hands (tapestry, brazier, rug, saddle) | 10 | 2 | | | | | | 0x7F | |
| 73 | Arrow | 10 | 0 | 1d6 | 1d6 | | | | 0x48 | 0x00 |
| 74 | Leather Holy Symbol (of Bane) | 74 | 0 | | | | | | 0x7F | |
| 75 | Brass Key | 75 | 1 | | | | | | 0x7F | |
| 76 | Cursed Necklace | 5 | 0 | | | | | from plus (−5) | 0x7F | |
| 77 | Bracers (AC 10 − plus) | 77 | 0 | | | | | 50 + plus | 0x7F | |
| 78 | Wand (Lightning, Paralyzation, Fireballs) | 78 | 1 | | | | 90 | | 0x01 | |
| 79 | Wand of Magic Missiles | 78 | 1 | | | | | | 0x7F | |
| 80, 81 | (no instance) | 80, 81 | 1 | | | | | | 0x7F | |
| 82 | Efreeti Bottle | 82 | 2 | | | | | | 0x7F | |
| 83 | (no instance; nobody can ready it) | 83 | 1 | | | | | | 0x00 | |
| 84 | Potion of Giant Strength | 80 | 1 | | | | | | 0x08 | |
| 85 | Holy Water Vial (damage via effect 117) | 0 | 1 | 1d1−1 | 1d1−1 | 2 | 4 | | 0x7F | 0x1A |
| 86 | Flask of Oil | 0 | 1 | 2d6 | 2d6 | 2 | 4 | | 0x7F | 0x1A |
| 87 | Boulder (STR 19+, effect 135) | 0 | 2 | 1d8+8 | 1d8+8 | 2 | 10 | | 0x08 | 0x1A |
| 88 | Large Boulder (G; no instance) | 0 | 2 | 1d12+8 | 1d12+8 | 2 | 20 | | 0x00 | 0x1A |
| 89 | (no instance; two-handed sword stats) | 0 | 2 | 1d10 | 3d6 | | | | 0x08 | 0x04 |
| 90 | Ring of Feather Falling | 9 | 0 | | | | | | 0x7F | |
| 91 | Pass (class mask 0: cannot be readied) | 91 | 0 | | | | | 60 | 0x00 | |
| 92 | Cloak of Displacement | 7 | 0 | | | | | from plus | 0x7F | |
| 93 | Ring of Protection | 9 | 0 | | | | | from plus | 0x7F | |
| 94, 95, 96 | (no instance; bows with STR bonus) | 0 | 2 | 1d6 | 1d6 | 4 | 22, 22, 16 | | 0x48 | 0x0F |
| 127 | (no instance; monster weapon?) | 0 | 1 | 2d20 | 2d20 | 40 | 60 | 54 | 0x7F | 0x0A |

Data quirks kept as shipped: Bec De Corbin has the thrown flag but range 0 (never ranged); Bill-Guisarme has "fires arrows"; Guisarme-Voulge lacks the STR flag; darts get neither STR nor DEX. Thieves (0x04) cannot ready bows or arrows (mask 0x48).

## Random items

The only source is ECL `TREASURE` (0x27) with item operand 0x80 + n (handler `29c3:19B0`, O). `FUN_4c2d_1010` has no other caller (one far call, through stub `008F:0061`, O). Monster loot is never random: the aftermath copies the monsters' own `MON<block>ITM` items ([combat-rules.md](combat-rules.md) Aftermath; O: value > 0 always taken; value 0 kept on d10 ≤ 3 unless 8 items, of any value, were already taken in this battle). Reference implementation: `tools/randitem.py` (builds the bytes from a list of dice results). dN = `roll(1, N)` = Random(N) + 1 (`FUN_5216_0de3`).

### Type choice (O, in the TREASURE handler)

```
for i in 1..n:                       // n = operand − 0x80; 0x80 makes nothing
    r1 = d100
    1–60:   r2 = d100
            1–47, 50–59: t = r2, but 45 → 0x3B Shield (no magic Fine Composite Bow)
            60–90:  d10: 1–4 0x24 Long, 5–7 0x23 Broad, 8 0x22 Bastard, 9 0x25 Short, 10 0x26 Two-Handed Sword
            91–94:  t = 0x49 Arrows;  95–97: 0x5D Ring of Protection;  98–100: 0x4D Bracers
            48, 49: t not assigned (Bug)
    61–85:  t = 0x3D magic-user scroll;  86–92: 0x3E clerical scroll
    93–98:  d16: 1–7 0x47 potion, 8–9 0x46 misc, 10 0x54 Giant Strength, 11–12 0x4E wand,
                 13–14 0x4F Wand of Magic Missiles, 15 0x5C Cloak of Displacement, 16 0x43 Cloak of Elvenkind
    99–100: t = 0x45 ring
    FUN_4c2d_1010(t, buf)            // buf: one 63-byte local, rebuilt from zero each time
    prepend a copy of buf to the treasure list DS:6810 (next = old head)
for every item now in the list: FUN_10ba_0442(DS:5D92, item, 0, 0, 0, 0)   // name cache item[0x00]
```

- **Per-call state** (O): t is an uninitialised local byte of the handler (`bp−0x65`). On r2 = 48 or 49 the previous item's type in the same `TREASURE` repeats, with fresh dice for that type (new plus, new spells, …). For the first item of a call t is stale stack (**?**); a value that matches no branch below gives a blank item (type t, every other byte 0, mask 6), which is G's "item with no name". G (9.4) says 48–49 always give that blank item.
- Items come out newest first, so the screen lists them in reverse generation order (O). The list is not cleared first: they go in front of anything already in it.
- Every range and die above matches G 9.4.

### Building the record (O, `FUN_4c2d_1010(t, item)`)

```
item[0..62] = 0;  item[0x35] = 6 (hide n1, n2);  item[0x2E] = t;  m = 0
if t in 1..0x3B or t in {0x49, 0x4D, 0x5D}:
    p = d20: 1–14 → 1, 15–19 → 2, 20 → 3                 // FUN_4c2d_0fd2
    item[0x32] = p;  P = 0xA1 + p                        // words 0xA2–0xA4 "+1" "+2" "+3"
    t = 0x15: d5, 5 → m = 0x90                           // Bug, see below
    name words, mask: table below
    item[0x33] = 0;  item[0x39] = 0;  weight, count: table below
    item[0x3A] = item[0x32] × k (16-bit)                 // after the bracers adjustment
elif t in {0x3D, 0x3E}: scroll, below
else: m from the magic table, below (types without an entry keep m = 0: blank item)
if m ≠ 0: overwrite from the random item array
```

Names (word numbers as in [Name words (O)](#name-words-o); displayed 0x31 0x30 0x2F; mask 4 hides 0x2F, mask 6 hides 0x2F and 0x30):

| t | 0x31 | 0x30 | 0x2F | 0x35 | unidentified → identified |
|---|---|---|---|---|---|
| 0x32, 0x33 | t | 0x31 Armor | P | 4 | Leather Armor → Leather Armor +1 |
| 0x34 | t | 0x32 Leather | P | 4 | Studded Leather → Studded Leather +1 |
| 0x35–0x3A | t | 0x30 Mail | P | 4 | Chain Mail → Chain Mail +1 |
| 0x49 | 0x3D Arrow | P | 0 | 6 | 10 Arrows → 10 Arrows +1 |
| 0x4D | 0x4F Bracers | 0xA7 of | AC word | 6 | Bracers → Bracers of AC 6 |
| 0x5D | 0x42 Ring | 0xE0 Of Protection | P | 6 | Ring → Ring Of Protection +1 |
| other (weapons, 0x1C, 0x3B) | t | P | 0 | 6 | Long Sword → Long Sword +1 |

Bracers: item[0x32] = 2p + 2 = 4, 6, 8 (AC 6, 4, 2 at 70/25/5 %), word 0xDD "AC 6", 0xDE "AC 4", 0xDC "AC 2". Shipped bracers have 0x30 = 0 ("Bracers AC 6"), so only random ones read "of".

Weight item[0x37] (per unit) and count item[0x39] (0 unless stated):

| weight | t |
|---|---|
| 1 | 0x5D |
| 10 | 8, 0x4D |
| 15 | 6 |
| 20 | 21 |
| 25 | 9 (count 5) |
| 30 | 7 |
| 35 | 37 |
| 40 | 22, 30 |
| 40 (count 10) | everything not listed: 0x1C quarrels, 0x49 arrows. A stack weighs 400; shop arrows weigh 4 each (Bug, I) |
| 50 | 2, 20, 29, 31, 32, 33, 39, 42, 44, 46, 59 |
| 60 | 10, 26, 36 |
| 75 | 1, 13, 14, 35 |
| 80 | 11, 16, 25, 27, 41, 47 (a later 47 → 1 test is dead) |
| 100 | 4, 15, 23, 34, 43, 45, 51 |
| 125 | 3, 24, 40 |
| 150 | 5, 12, 17, 19, 50 |
| 175 | 18 |
| 200 | 52 |
| 250 | 38, 53 |
| 300 | 55 |
| 350 | 57 |
| 400 | 54, 56 |
| 450 | 58 |

Value k per plus: 0x3B 2500; 0x1C, 0x49 150; 0x35, 0x36 3000; 0x37, 0x38 3500; 0x39 4000; 0x3A 5000; 0x4D 3000 (on 2p + 2: 12 000 / 18 000 / 24 000); every other type 2000.

**Scrolls** (t = 0x3D magic-user, 0x3E clerical):

```
n = d3
item[0x31] = 0xD1 "Magic User Scroll" / 0xD0 "Clerical Scroll";  item[0x30] = 0xD1 + n ("With n Spell(s)");  item[0x2F] = 0
item[0x32] = 1;  weight 25;  count 0;  value 0;  mask stays 6
for i in 1..n:
    L = d3
    MU:     L1 d13 + 8 (ids 9–21),  L2 d7 + 28 (29–35),  L3 d11 + 44 (45–55)
    cleric: L1 d8      (1–8),       L2 d7 + 21 (22–28),  L3 d9 + 35  (36–44)
    item[0x3B + i] = id;  value += 300 · L
```

Every level-1–3 spell of the class is possible (uniform within a level, duplicates allowed); never Restoration; the scribing bit is clear. Matches G.

**Magic table** (m = 1 + 8e indexes the array below):

| t | dice | m |
|---|---|---|
| 0x47 | d11 | 1–5 0x11 Healing, 6–8 0x01 Extra Healing, 9 0x19 Speed, 10 0x51 Keoghtum's Ointment, **11 none: blank** |
| 0x46 | d10 | 1–7 0x59 Necklace of Missiles, 8–10 0x89 Bag of Holding |
| 0x54 | | 0x09 Potion of Giant Strength |
| 0x4E | d3 + 1 | 2 0x41 Paralyzation, 3 0x71 Fireballs, **4 none: blank**; 0x31 Lightning cannot come up |
| 0x4F | | 0x39 Wand of Magic Missiles |
| 0x5C | | 0x61 Cloak of Displacement |
| 0x43 | | 0x91 Cloak of Elvenkind |
| 0x45 | d10 | 1 0x29 Feather Falling, 2–6 0x79 Fire Resistance, 7–10 0x81 Invisibility |
| 0x3F | | 0x49 Gauntlets of Ogre Power (the type choice never asks for 0x3F) |
| 0x15 | d5 = 5 | 0x90 (Bug: Javelin of Lightning is 0x69) |

A blank item (potion d11 = 11, wand d3 + 1 = 4) has type 0x47 / 0x4E, no name words, plus 0 and value 0, so its name is empty. G calls these "hard-to-predict"; the code makes them fixed and empty.

**Copy from the array** (m ≠ 0). W = u16 array at DS:0970, entry e (0–18) at DS:0972 + 16e:

```
item[0x2F + j] = low byte W[m + j], j = 0..2
item[0x32] = 1;  item[0x33] = 1          // m = 0x61: 2 and 2
item[0x37] = W[m + 3];  item[0x39] = 0;  item[0x3A] = W[m + 4]
item[0x3C + j] = low byte W[m + 5 + j], j = 0..2
```

Type, mask 6, cursed 0 and readied 0 stay as set. The save bonus only counts for AC descriptor 0x80 ([Item record (63 bytes)](#item-record-63-bytes)), so of these items only the Cloak of Displacement gets it (+2 saves, matching G; the shipped cloaks have 0). A random Ring of Protection gets 0x33 = 0 (G agrees).

Random item array (DS:0972, O; words 0x2F 0x30 0x31, then weight, value, 0x3C 0x3D 0x3E):

| m | words | identified name | weight | value | 0x3C | 0x3D | 0x3E | reached by |
|---|---|---|---|---|---|---|---|---|
| 0x01 | 187 167 64 | Potion of Extra (shipped: "Potion Extra Healing") | 1 | 800 | 3 | 3 | 0 | 0x47 |
| 0x09 | 239 167 64 | Potion of Giant Strength | 1 | 1100 | 1 | 82 | 0 | 0x54 |
| 0x11 | 185 167 64 | Potion of Healing | 1 | 400 | 1 | 85 | 0 | 0x47 |
| 0x19 | 173 167 64 | Potion of Speed | 1 | 450 | 1 | 80 | 0 | 0x47 |
| 0x21 | 240 167 65 | Scroll of Restoring Level(s) | 1 | 2100 | 56 | 56 | 0 | nothing |
| 0x29 | 238 167 66 | Ring of Feather Falling | 1 | 5000 | 0 | 27 | 128 | 0x45 |
| 0x31 | 157 167 69 | Wand of Lightning | 1 | 6000 | 20 | 51 | 0 | unreachable |
| 0x39 | 206 167 69 | Wand of Magic Missiles | 1 | 11000 | 30 | 88 | 0 | 0x4F |
| 0x41 | 225 167 69 | Wand of Paralyzation | 1 | 5000 | 20 | 84 | 0 | 0x4E |
| 0x49 | 226 167 100 | Gauntlets of Ogre Power | 10 | 15000 | 0 | 38 | 131 | 0x3F only |
| 0x51 | 0 111 182 | Keoghtum's Ointment | 1 | 10000 | 5 | 81 | 0 | 0x47 |
| 0x59 | 228 167 119 | Necklace of Missiles | 1 | 16000 | 20 | 87 | 0 | 0x46 |
| 0x61 | 170 167 88 | Cloak of Displacement | 25 | 17500 | 0 | 89 | 133 | 0x5C |
| 0x69 | 157 167 21 | Javelin of Lightning | 20 | 3000 | 1 | 83 | 0 | unreachable (typo) |
| 0x71 | 242 167 69 | Wand of Fireballs | 1 | 5000 | 20 | 47 | 0 | 0x4E |
| 0x79 | 205 167 66 | Ring of Fire Resistance | 1 | 5000 | 0 | 61 | 129 | 0x45 |
| 0x81 | 227 167 66 | Ring of Invisibility | 1 | 7500 | 0 | 56 | 139 | 0x45 |
| 0x89 | 186 167 73 | Bag of Holding | 150 | 25000 | 0 | 0 | 0 | 0x46 |
| 0x91 | 229 167 88 | Cloak of Elvenkind | 25 | 6000 | 0 | 72 | 134 | 0x43 |

Unidentified (mask 6) only 0x31 shows: "Potion", "Wand", "Ring", "Cloak", "Keoghtum's".

**The javelin bug** (O): m = 0x90 is one word before entry 0x91, so every field shifts by one. The item keeps type 0x15 (Javelin) and gets words 0, 229, 167 ("of" → identified "of Elvenkind"), plus 1, save 1, weight 88, value 25, 0x3C = 0x70 (low byte of 6000), 0x3D = 0, 0x3E = 72 (< 0x80, so no handler). It is fixed, not the "hard-to-predict" item in G.

All random items have plus ≥ 1 except blanks, so Detect Magic marks them. In a battle's treasure each gives 400 × plus experience ([combat-rules.md](combat-rules.md) Aftermath): 400 for scrolls and array items, 800 for the Cloak of Displacement, 1600–3200 for bracers (plus 4–8).

## Inventory and readying

### Capacity (O)

- At most **16 items** (`FUN_4894_275b`: char[0xC7] > 15 refuses another).
- Weight allowance `WA` (`FUN_10ba_13ab`) from the strength index `si` (`FUN_10ba_11ea`: STR 0–17 → STR; STR 18 with exceptional strength 0 → 18, 1–50 → 19, 51–75 → 20, 76–90 → 21, 91–99 → 22, 100 ("18/00") → 23; STR 19–25 → STR + 5):

| si | 1–3 | 4–5 | 6–7 | 8–11 | 12–13 | 14–15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WA | −350 | −250 | −150 | 0 | 100 | 200 | 350 | 500 | 750 | 1000 | 1250 | 1500 | 2000 | 3000 | 4000 | 5000 | 6000 | 7500 | 9000 | 12000 | 15000 |

- **Capacity** = WA + 1500 (`FUN_4c2d_0000`). An item (weight × max(1, count)) or money can be taken only if encumbrance + weight ≤ capacity ("Overloaded"/"OverLoaded" otherwise). The guide's "carry capacity" column is WA + 512, the unpenalised load.
- **Encumbrance** char[0x102] = Σ items (weight × count, count 0 counts as 1) + Σ all seven money words (each coin, gem and jewel weighs 1).
- **Bag of Holding**: a readied item whose word n1 (item[0x2F]) is 0xBA. Encumbrance becomes max(readied weight, total − 5000), i.e. up to 5000 coins of unreadied items and money weigh nothing.

### Ready / unready (O, `FUN_4894_14d0`, current character)

Unready (item readied):
1. If cursed (item[0x36] ≠ 0): "It's Cursed", nothing changes.
2. Else item[0x34] = 0; if item[0x3E] ≥ 0x80, call the item effect handler with "unreadied" ([effects.md](effects.md) 128–139).

Ready (item not readied): compute an error code; each later check overwrites the earlier one, so the message priority is Wrong Class > already using > hands full.
1. hands: `ITEMS[t][1] + char[0x100] > 2` → 3
2. slot 0–8 and char[0xCC + 4·slot] occupied → 2; slot 9 (ring) and the second ring pointer char[0xF4] occupied → 2 (so two rings, not three)
3. type 73 (arrow) and char[0xF8] occupied → 2; type 28 (quarrel) and char[0xFC] occupied → 2 (one stack of each)
4. `ITEMS[t][13] & char[0xB0] = 0` → 1
5. Result: 0 → item[0x34] = 1, then the item effect handler with "readied" if item[0x3E] ≥ 0x80 (the handler may undo it: Boulder without STR 19, alignment-locked weapon). 1 → "Wrong Class". 2 → "already using " + name of the item in that slot. 3 → "Your hands are full!", not printed for an auto-combat character in combat.

Consequences: slots 10 and above (misc items, potions, bracers, wands, keys) never conflict, so several can be readied as long as hands allow; a two-handed weapon (2) excludes a shield or any one-handed item; weapon + shield, or weapon + mirror/holy symbol, is the most a character holds; bows need no free hand for arrows (hands 0). Readied items cannot be traded, dropped or sold ("Must be unreadied"); only readied items can be Used ("Must be Readied"). After every items-menu action the stats below are recalculated.

### Derived statistics (O, `FUN_10ba_0bb8`)

Run after any change to items, money or effects (items menu, trade target, buying, the can-carry test). This is the only description of the routine; combat runs it at the start of every turn, before every attack on the target, and whenever equipment or effects change ([combat-rules.md, "Combat statistics"](combat-rules.md#combat-statistics-o-fun_10ba_0bb8)). All AC values are "60 − AC" (higher is better); THAC0 is "60 − THAC0".

1. Clear the 13 pointers char[0xCC..0xFF], char[0xC7] = 0, char[0x100] = 0, char[0x102] = 0, readied weight = 0.
2. For each item: char[0xC7] += 1; w = weight × count (if count > 0); char[0x102] += w. If readied: readied weight += w; slot 0–8 → char[0xCC + 4·slot] = item (the last one wins); slot 9 → char[0xF0] if empty, else char[0xF4] if empty; type 73 → char[0xF8]; type 28 → char[0xFC]; word n1 = 0xBA → Bag of Holding; char[0x100] += `ITEMS[t][1]`.
3. char[0x102] += the seven money words.
4. Natural attacks: char[0x115..0x11A] ← char[0xA3..0xA8]. Base values: char[0x111] ← char[0xA9], char[0x11C] ← char[0x72], char[0x110] ← char[0x2D]; char[0x101] = 0; AC components `dex, shield, misc, ring, body` = 0.
5. `dex` = DEX AC adjustment (table below).
6. No weapon readied: char[0x110] += STR to-hit, char[0x119] += STR damage (bare hands).
7. Weapon readied (`FUN_10ba_0000`, weapon W of type t):
   1. char[0x110] = char[0x2D]; if flags & 0x02: += DEX missile adjustment
   2. char[0x119] = `ITEMS[t][11]`; if flags & 0x04: char[0x110] += STR to-hit, char[0x119] += STR damage
   3. plus = W[0x32]; + quarrels' plus if flags & 0x80 and quarrels readied; + arrows' plus if flags & 0x01 and arrows readied
   4. char[0x119] += plus
   5. elf (race 2) with type 36, 37 or 41–44 (long sword, short sword, the four plain bows; not the Fine Composite Long Bow): plus += 1 (to-hit only)
   6. char[0x110] += plus; char[0x115] = `ITEMS[t][9]`, char[0x117] = `ITEMS[t][10]` (vs-large dice are substituted at attack time, [combat-rules.md](combat-rules.md))
8. For each readied item: armour movement, then AC (below).
9. If any readied body armour has plus > 0: `ring` = 0 (rings of protection do not stack with magic armour; bracers are not body armour).
10. Bag of Holding: char[0x102] = max(readied weight, char[0x102] − 5000) (0 if below 5000 before the max).
11. Encumbrance movement (below).
12. `body` = max(`body`, char[0xA9]); **front AC** char[0x111] = dex + shield + misc + ring + body.
13. **Rear AC** char[0x112] = body + misc + ring − 2 (no DEX, no shield, 2 worse).
14. char[0x6B] = fighter level if race ≠ 0 and fighter level > 0, else 1.

Hands-2 damage char[0x116/0x118/0x11A] always stays the natural second attack. Per-round attack counts are set at round start from char[0xA1]/[0xA2]; with a ranged weapon and ammunition (`FUN_10ba_2e8b`: thrown weapons are their own ammunition; slings need none) the missile attack count (×2 units) starts as max(2, `ITEMS[t][5]`), goes through effect hook 18 (Haste), and is then limited by the ammunition count (O, `FUN_3aae_0d23`; the final conversion `FUN_3aae_0e52` is not traced, I).

**AC per readied item** (`FUN_10ba_0282`), d = `ITEMS[t][6]`, p = item plus:
- d < 0x80: nothing
- slot 1 (shield): `shield` = (d & 0x7F) + p
- d = 0x80: slot 9 (ring): `ring` = max(ring, p); otherwise `misc` += p (Cloak of Displacement +2, Cursed Necklace −5); and char[0x101] += item[0x33]
- otherwise (body armour, bracers, any d > 0x80): if (d & 0x7F) + p > `body`: `body` = that, and if slot 2 and p > 0 the armour counts as magic (step 9)

So body armour and bracers do not stack: the better one sets the base AC; shield adds 1 + plus; DEX adds only to the front AC.

**Armour movement** (`FUN_10ba_01fb`, readied slot-2 items): weight ≤ 150 → char[0x72]; 151–399 → 9; ≥ 400 → 6; then if plus ≠ 0 and the result ≤ 9: + 3. (Leather/padded 12, studded/ring/chain/banded 9, scale/splint/plate 6; a negative plus also gets the +3, bug.)

**Encumbrance movement** (`FUN_10ba_03a0`): excess = char[0x102] − WA (floor 0); excess ≤ 512 → no limit; 513–768 → 9; 769–1024 → 6; > 1024 → 3; movement = min(current, limit). The guide's statement that the higher of armour and load limits applies is wrong: both only lower it. Haste and Slow are applied where movement is used ([combat-rules.md](combat-rules.md), [overland.md](overland.md)).

**Ability adjustments** (strength index `si` as above; DEX = char[0x13]):

| STR si | 1–3 | 4–5 | 6–7 | 8–16 | 17–19 | 20–22 | 23–25 | 26–27 | 28 | 29 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| to-hit (`FUN_10ba_1282`) | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 |

| STR si | 1–2 | 3–5 | 6–15 | 16 | 17 | 18 | 19–20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| damage (`FUN_10ba_1325`) | −2 | −1 | 0 | +1 | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 | +11 | +12 | +14 |

Both are 0 unless char[0xAA] ≠ 0: set for player characters and for 49 of the 172 monster records (fighters, ogre leader, vampires and other strong humanoids; O, data). G's "THAC0 is not recalculated for Strength" therefore holds only for the other 123. Monsters get weapon dice, AC and THAC0 from readied equipment like characters. Exceptional strength above 100 or STR > 25 leaves the index undefined (original reads stack garbage; a port can clamp).

| DEX | 1–3 | 4 | 5 | 6 | 7–14 | 15 | 16 | 17 | 18 | 19–20 | 21–23 | 24–25 | other |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AC (`FUN_10ba_10e6`) | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +4 | +5 | +6 | 0 |

| DEX | 0–2 | 3 | 4 | 5 | 6–15 | 16 | 17 | 18 | 19–20 | 21–23 | 24–25 | other |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| missile to-hit / initiative (`FUN_10ba_1168`) | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +3 | +4 | +5 | 0 |

Gauntlets of Ogre Power and Potions of Giant Strength act through Strength effect records (types 12/38, [effects.md](effects.md)) that overwrite char[0x10]/[0x16] while active; the recalculation then reads the new STR.

Worked example: a human fighter, STR 18/63, DEX 16, banded mail +1, shield, long sword +1: body = max(56 + 1, 50) = 57, shield = 1 + 0, dex = 2, ring = 0 (magic armour) → char[0x111] = 60 (AC 0), rear = 57 − 2 = 55 (AC 5); THAC0 byte = char[0x2D] + 2 (STR) + 1 = THAC0 − 3; damage 1d8 + 3 (STR) + 1; movement: banded 350 → 9, magic → 12.

## Effect record (9 bytes, I)

`u8 type, u16 duration (0 = permanent), u8 power, u8 call-on-removal flag, ptr next`. List head at char[0x7F]. Full type list in [effects.md](effects.md).
