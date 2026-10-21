# Expected values

> **Status: partial** (work-plan steps 5 and 6, [AUDIT.md](../AUDIT.md) §8). Informative. Part D
> of the [specification](../README.md). Written: the data dumps moved out of part A in step 5 (§1–§4).
> To come: the creation tables, CotAB's tables (now in [coab/tables.md](../A-games/coab/tables.md)
> beside their addresses), and decoded sizes and hashes for validation V1.

Per D5, values the game files hold are **informative** here: a builder reads them from the player's
files at the addresses part A gives (those addresses and reading rules are normative) and can check
its decoder against these values. Where a value disagrees with the player's file, the file wins
(a different release). Game text is not copied (D1): text blocks are given as a length and a
SHA-256 of their bytes.

## 1. Item types (`ITEMS`)

Source: the file `ITEMS` of Pool of Radiance (2050 bytes; SHA-256
`ece7dc8d8331c9b915b79c5963454bd5a4c3ab3b015844829b67016334eb0cf2`), type *t* at offset 2 + 16·*t*;
the field meanings are normative in [records.md, "Item types"](../A-games/engine/records.md#item-types-items-o).
Curse of the Azure Bonds' `ITEMS` (SHA-256 `8cc780af34edf7fa07068896fe45378d1ee7e4cc66cbdca116c60a94d0654577`)
differs; its changes are in [coab/records.md](../A-games/coab/records.md).

Every defined type (names from the shipped item records; G = from the guide only; S/M and L = damage vs small/medium and large; RoF ×2; AC in 60 − AC units):

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

## 2. The random-item array (`DS:0972`)

Source: PoR's data segment, 19 entries of eight u16 at `DS:0972` + 16·*e* (image 0xD132; the 304
bytes have SHA-256 `f7a4b175204b19fef24c0338300618539871655c46c73d56ddab2fa9e3a70fda`); the reading
rule is normative in [records.md, "Random items"](../A-games/engine/records.md#random-items).
Words 0x2F 0x30 0x31, then weight, value, 0x3C 0x3D 0x3E; "reached by" is the type whose magic table names the entry ([records.md, "Building the record"](../A-games/engine/records.md#building-the-record-o-fun_4c2d_1010t-item)):

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

## 3. Pool of Radiance credits and code wheel

- **Credits strings** (layout normative in
  [title-and-credits.md](../A-games/por/title-and-credits.md#credits-screen-o-290c0206-strings-290c004b01e2)):
  29 Pascal strings, `290c:004B`–`290c:0205` (image 0x1910B–0x192C5, 443 bytes), SHA-256
  `b4905f882b908d6a8a22b883b953df6959ca84cf7a887f07904927c915f8b66c`; the version line `290c:00BE`
  has 11 characters.
- **Code-wheel table** (`DS:0002`, 13 × 21 bytes = 273 bytes, image 0xC7C2), SHA-256
  `2958a597319c976ea4f156bebd0507fccaaae9564ae5a5008fc7f5d7952386d8`. Every word is 6 letters; the
  path strings are 9 characters, cycling solid, dash-dot, dotted with *r*; Dethek rune 2 is 0xFF
  (none) in every record except *r* = 0.

## 4. Pool of Radiance battlefield cells (`DS:2744`)

Source: 4 bytes per cell value at `DS:2744` + 4·cell (image 0xEF04); the byte meanings and the
image-slot loading are normative in [battlefield.md, "Cell table"](../A-games/engine/battlefield.md#cell-table-o-ds2744-4-bytes-per-cell-value).
"Image" names what the slot's picture shows (identification only).

| Cells | Image | Move | Sight |
|---|---|---|---|
| 0x01–0x16, 0x19 | dungeon wall and door pieces (slots 0–0x15, 0x18) | doors and partial pieces 0x05, 0x09, 0x0B, 0x0D, 0x0F, 0x11 enterable; the rest blocked | blocked pieces block |
| 0x17 | open ground (slot 0x16, blank) | yes | clear |
| 0x18 | slot 0x17 | yes | clear |
| 0x1A, 0x1B | rocks (RandCom 0, 1) | yes | clear |
| 0x1C | bone (RandCom 2) | yes | clear |
| 0x1D | potted flower (RandCom 3) | yes | clear |
| 0x1E | cloud (RandCom 4) | yes | clear |
| 0x1F | fallen body (RandCom 5) | yes | clear |
| 0x20–0x23 | tree crowns (Wild 0–3) | no | blocks |
| 0x24–0x27 | tree trunks, 0x27 = swamp tree (Wild 4–7) | yes | clear |
| 0x28, 0x29 | fallen logs (Wild 8, 9) | no | clear |
| 0x2A–0x2D | rocks and a boulder (Wild 10–13) | yes | clear |
| 0x2E–0x30 | grass tufts (Wild 14–16) | yes | clear |
| 0x31 | puddles (Wild 17) | yes | clear |
| 0x32, 0x33 | river, left and right bank (Wild 18, 19) | no | clear |
| 0x34, 0x35 | ford (Wild 20, 21) | yes | clear |
| 0x36 | open ground (Wild 22) | yes | clear |
| 0x37, 0x38 | shrubs (Wild 23, 24) | no | clear |
| 0x39 | low grass (Wild 25) | yes | clear |
| 0x3A, 0x3B | reeds (Wild 26, 27) | yes | clear |
| 0x3C | marsh weed (Wild 28) | no | clear |
| 0x3D–0x3F | cactus (Wild 29–31) | no | blocks |
| 0x40 | tall cactus base (Wild 32) | yes | clear |
| 0x41 | tall cactus top (Wild 33) | no | blocks |
