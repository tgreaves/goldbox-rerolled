# Expected values

> **Status: partial** (work-plan steps 5 and 6, [AUDIT.md](../AUDIT.md) §8). Informative. Part D
> of the [specification](../README.md). Written: the data dumps moved out of part A in step 5 (§1–§6).
> To come: decoded sizes and hashes for validation V1.

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

## 5. Curse of the Azure Bonds rules tables

Source: CotAB's data segment (DS = image 0xABE0); the addresses, strides and reading rules are
normative in [coab/tables.md](../A-games/coab/tables.md). Values the CotAB file still gives beside
their address (class bits, trainer bits, sky colours, temple prices …) are not repeated here.

### 5.1 Experience (`DS:4293`)

u32 at DS:4293 + k·0x63 + L·4, the experience needed for level L; cap = the highest level with a
value (PoR's cap in brackets).

| Class | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | cap (PoR) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cleric | 1501 | 3001 | 6001 | 13001 | 27501 | 55001 | 110001 | 225001 | 450001 | – | – | **10** (6) |
| Fighter | 2001 | 4001 | 8001 | 18001 | 35001 | 70001 | 125001 | 250001 | 500001 | 750001 | 1000001 | **12** (8) |
| Paladin | 2751 | 5501 | 12001 | 24001 | 45001 | 95001 | 175001 | 350001 | 700001 | 1050001 | – | **11** (1) |
| Ranger | 2251 | 4501 | 10001 | 20001 | 40001 | 90001 | 150001 | 225001 | 325001 | 650001 | – | **11** (1) |
| Magic-User | 2501 | 5001 | 10001 | 22501 | 40001 | 60001 | 90001 | 135001 | 250001 | 375001 | – | **11** (6) |
| Thief | 1251 | 2501 | 5001 | 10001 | 20001 | 42501 | 70001 | 110001 | 160001 | 220001 | 440001 | **12** (9) |

### 5.2 THAC0 (`DS:3E3A`)

Byte 60 − THAC0 at DS:3E3A + k·13 + L, shown as THAC0; bold cells differ from PoR.

| L | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cleric, Druid, Monk | 20 | 20 | 20 | 18 | 18 | 18 | 16 | 16 | 16 | 14 | 14 | 14 |
| Fighter, Paladin, Ranger | 20 | **20** | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11 | 10 | 9 |
| Magic-User | **21** | **21** | **21** | **21** | **21** | 19 | 19 | 19 | 19 | 19 | 17 | 17 |
| Thief | 20 | 20 | 20 | 20 | 19 | 19 | 19 | 19 | 16 | 16 | 16 | 16 |

The bold cells differ from PoR (PoR fighter L2 = 19; PoR MU levels 1–5 = 20).

The bold cells differ from PoR (PoR fighter L2 = 19; PoR MU levels 1–5 = 20).

### 5.3 Spell slots (`DS:42BC`, `DS:43E5`, `DS:4448`, `DS:44AB`)

The slot counts the increments of [coab/tables.md §3.5](../A-games/coab/tables.md#35-spell-slots-o-fun-at-50480)
add up to, per class level.

Spells of levels 1–5, per class level:

| L | Cleric | MU | Paladin (cleric) | Ranger (druid / MU) |
|---|---|---|---|---|
| 1 | 1 0 0 0 0 | 1 0 0 0 0 | – | – |
| 2 | 2 0 0 0 0 | 2 0 0 0 0 | | |
| 3 | 2 1 0 0 0 | 2 1 0 0 0 | | |
| 4 | 3 2 0 0 0 | 3 2 0 0 0 | | |
| 5 | 3 3 1 0 0 | 4 2 1 0 0 | | |
| 6 | 3 3 2 0 0 | 4 2 2 0 0 | | |
| 7 | 3 3 2 1 0 | 4 3 2 1 0 | | |
| 8 | 3 3 3 2 0 | 4 3 3 2 0 | | 1 / 0 |
| 9 | 4 4 3 2 1 | 4 3 3 2 1 | 1 0 | 1 / 1 |
| 10 | 4 4 3 3 2 | 4 4 3 2 2 | 2 0 | 2 / 1 |
| 11 | – | 4 4 4 3 3 | 2 1 | 2 / 2 |

### 5.4 Saving throws (`DS:45BE`)

DS:45BE + k·0x3C + L·5 + i, in the order death, petrification, rod, breath, spell.

- Cleric: L1–3 10 13 14 16 15 · L4–6 9 12 13 15 14 · L7–9 7 10 11 13 12 · L10–12 6 9 10 12 11
- Fighter and Ranger: L1–2 14 15 16 17 17 · 3–4 13 14 15 16 16 · 5–6 11 12 13 13 14 · 7–8 10 11 12 12 13 · 9–10 8 9 10 9 11 · 11–12 7 8 9 8 10
- Paladin (fighter − 2): L1–2 12 13 14 15 15 · 3–4 11 12 13 14 14 · 5–6 9 9 11 11 12 · L7 8 9 10 10 11 · **L8 9 9 10 10 11** (data quirk: death save worse than at L7) · 9–10 6 7 8 7 9 · 11–12 5 6 7 6 8
- MU: L1–5 14 13 11 15 12 · 6–10 13 11 9 13 10 · 11–12 11 9 7 11 8
- Thief: L1–4 13 12 14 16 15 · 5–8 12 11 12 15 13 · 9–12 11 10 10 14 11
- 12 rows per class (levels 1–12). The unused L0 slot of class k+1 holds L12 of class k.

## 6. Pool of Radiance creation and progression tables

Source: PoR's data segment (image 0xC7C0 + x); the reading rules are normative in
[chargen-and-progression.md](../A-games/engine/chargen-and-progression.md).

### 6.1 Classes and alignments (`DS:3E17`, `DS:3FE7`)

| Race | Classes offered (menu order) |
|---|---|
| Dwarf | Fighter, Thief, Fighter/Thief |
| Elf | Fighter, Magic-User, Thief, Fighter/Magic-User, Fighter/Thief, Fighter/Magic-User/Thief, Magic-User/Thief |
| Gnome | Fighter, Thief, Fighter/Thief |
| Half-Elf | Cleric, Fighter, Magic-User, Thief, Cleric/Fighter, Cleric/Fighter/Magic-User, Cleric/Magic-User, Fighter/Magic-User, Fighter/Thief, Fighter/Magic-User/Thief, Magic-User/Thief |
| Halfling | Fighter, Thief, Fighter/Thief |
| Human | Cleric, Fighter, Magic-User, Thief |
| (Half-Orc, data only) | Cleric, Fighter, Thief, Cleric/Fighter, Cleric/Thief, Fighter/Thief |

| Class | Alignments |
|---|---|
| Cleric, Fighter, Magic-User, C/F, C/F/MU, C/MU, F/MU, Cleric/Thief | all nine (Cleric/Thief included, although AD&D would forbid LG/CG) |
| Thief, Fighter/Thief, Fighter/Magic-User/Thief, Magic-User/Thief | LN, LE, NG, TN, NE, CN, CE (no LG, no CG), in that menu order |
| (Druid / Paladin / Ranger / Monk, not offered) | LN NG TN NE CN / LG / all / all |

### 6.2 Starting age and age categories (`DS:3E5B`, `DS:3F31`)

| Race | Cleric | Fighter | Magic-User | Thief |
|---|---|---|---|---|
| Dwarf | 250 + 2d20 | 40 + 5d4 | – | 75 + 3d6 |
| Elf | 650 + 10d10 | 130 + 5d6 | 150 + 5d6 | 100 + 5d6 |
| Gnome | 300 + 3d12 | 60 + 5d4 | 100 + 2d12 | 80 + 5d4 |
| Half-Elf | 40 + 2d4 | 22 + 3d4 | 30 + 2d8 | 22 + 3d8 |
| Halfling | – | 20 + 3d4 | – | 40 + 2d4 |
| Human | 18 + 1d4 | 15 + 1d4 | 24 + 2d4 | 18 + 1d4 |

(Druid/Paladin/Ranger columns exist for humans: 18+1d4, 17+1d4, 20+1d4.)

Age thresholds (mature, middle-aged, old, venerable; the fifth u16 of each race, read by nothing
found, is Dwarf 450, Elf 1600, Gnome 750, Half-Elf 325, Halfling 199, Half-Orc 80, Human 120):
Dwarf 50/150/250/350, Elf 175/550/875/1200, Gnome 90/300/450/600, Half-Elf 40/100/175/250, Halfling 33/68/101/144, Half-Orc 15/30/45/60, Human 20/40/60/90.

### 6.3 Ability limits and class minimums (`DS:3DA3`, `DS:3F81`)

| Race | STR (M / F) | 18/xx max (M / F) | INT | WIS | DEX | CON | CHA |
|---|---|---|---|---|---|---|---|
| Dwarf | 8–18 / 8–17 | 99 / 0 | 3–18 | 3–18 | 3–17 | 12–19 | 3–16 |
| Elf | 3–18 / 3–16 | 75 / 0 | 8–18 | 3–18 | 7–19 | 6–18 | 8–18 |
| Gnome | 6–18 / 6–15 | 50 / 0 | 7–18 | 3–18 | 3–18 | 8–18 | 3–18 |
| Half-Elf | 3–18 / 3–17 | 90 / 0 | 4–18 | 3–18 | 6–18 | 6–18 | 3–18 |
| Halfling | 6–17 / 6–14 | 0 / 0 | 6–18 | 3–17 | 8–18 | 10–19 | 3–18 |
| Human | 3–18 / 3–18 | 100 / 50 | 3–18 | 3–18 | 3–18 | 3–18 | 3–18 |

Class minimums (STR INT WIS DEX CON CHA; – = 0):

Cleric 6 6 9 – – –; Druid – – 12 – – 15; Fighter 9 – 6 6 7 –; Paladin 13 9 12 – 9 17; Ranger – 13 14 – 14 –; Magic-User – 9 6 6 – –; Thief 6 6 – 9 – –; Monk 15 – 15 15 11 –.

Multi-class: C/F 9 – 9 – – –; C/F/MU 9 9 9 – – –; C/MU – 9 9 – – –; C/T – – 9 9 – –; F/MU 9 9 – – – –; F/T 9 – – 9 – –; F/MU/T 9 9 – 9 – –; MU/T – 9 – 9 – –; C/R – 13 14 – 14 –.

### 6.4 Starting gold, experience and hit dice (`DS:4263`, `DS:409B`, `DS:08B6`, `DS:08BE`)

Starting gold dice (× 10 gp): Cleric 3d6, Druid 3d6, Fighter 5d4, Paladin 5d4, Ranger 5d4, Magic-User 2d4, Thief 2d6, Monk 5d4.

Experience (`DS:409B + class·0x38 + level·4`, u32; – = 0xFFFFFFFF):

| Class | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Max |
|---|---|---|---|---|---|---|---|---|---|
| Cleric | 1 501 | 3 001 | 6 001 | 13 001 | 27 501 | – | – | – | 6 |
| Fighter | 2 001 | 4 001 | 8 001 | 18 001 | 35 001 | 70 001 | 125 001 | – | 8 |
| Magic-User | 2 501 | 5 001 | 10 001 | 22 501 | 40 001 | – | – | – | 6 |
| Thief | 1 251 | 2 501 | 5 001 | 10 001 | 20 001 | 42 501 | 70 001 | 110 001 | 9 |
| Druid, Paladin, Ranger, Monk | – | – | – | – | – | – | – | – | 1 |

Values equal the AD&D 1st edition tables; the caps are Pool of Radiance's.

Hit dice (count `DS:08B6`, sides `DS:08BE`, one byte per class):

| Class | Cleric | Druid | Fighter | Paladin | Ranger | Magic-User | Thief | Monk |
|---|---|---|---|---|---|---|---|---|
| Hit dice | 1d8 | 1d8 | 1d10 | 1d10 | 2d8 | 1d4 | 1d6 | 2d4 |

### 6.5 THAC0, spell slots and saving throws (`DS:3C7C`, `DS:40BC`, `DS:41D4`, `DS:426E`)

Base THAC0 by level (60 − table value):

| Class | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cleric, Druid, Monk | 20 | 20 | 20 | 18 | 18 | 18 | 16 | 16 | 16 | 14 |
| Fighter, Paladin, Ranger | 20 | 19 | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11 |
| Magic-User | 20 | 20 | 20 | 20 | 20 | 19 | 19 | 19 | 19 | 19 |
| Thief | 20 | 20 | 20 | 20 | 19 | 19 | 19 | 19 | 16 | 16 |

Spell slots (spell levels 1 / 2 / 3):

| Level | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Cleric | 1 / 0 / 0 | 2 / 0 / 0 | 2 / 1 / 0 | 3 / 2 / 0 | 3 / 3 / 1 | 3 / 3 / 2 |
| Magic-User | 1 / 0 / 0 | 2 / 0 / 0 | 2 / 1 / 0 | 3 / 2 / 0 | 4 / 2 / 1 | 4 / 2 / 2 |

Saving throws (death/poison, petrification, rod/staff/wand, breath, spell):

| Level | Cleric | Fighter | Magic-User | Thief |
|---|---|---|---|---|
| 1–2 | 10 13 14 16 15 | 14 15 16 17 17 | 14 13 11 15 12 | 13 12 14 16 15 |
| 3–4 | 10/9 13/12 14/13 16/15 15/14 (4+) | 13 14 15 16 16 | 14 13 11 15 12 | 13 12 14 16 15 |
| 5–6 | 9 12 13 15 14 | 11 12 13 13 14 | 14 13 11 15 12 (6: 13 11 9 13 10) | 12 11 12 15 13 |
| 7–8 | 7 10 11 13 12 | 10 11 12 12 13 | 13 11 9 13 10 | 12 11 12 15 13 |

(Cleric changes at 4 and 7, fighter at 3, 5, 7, magic-user at 6, thief at 5 — the AD&D 1st edition tables.)

### 6.6 Thief skills (`DS:3CF3`, `DS:3D3B`)

| Thief level | PP | OL | F/RT | MS | HS | HN | CW | RL |
|---|---|---|---|---|---|---|---|---|
| 1 | 30 | 25 | 20 | 15 | 10 | 10 | 85 | 0 |
| 2 | 35 | 29 | 25 | 21 | 15 | 10 | 86 | 0 |
| 3 | 40 | 33 | 30 | 27 | 20 | 15 | 87 | 0 |
| 4 | 45 | 37 | 35 | 33 | 25 | 15 | 88 | 20 |
| 5 | 50 | 42 | 40 | 40 | 31 | 20 | 90 | 25 |
| 6 | 55 | 47 | 45 | 47 | 37 | 20 | 92 | 30 |
| 7 | 60 | 52 | 50 | 55 | 43 | 25 | 94 | 35 |
| 8 | 65 | 57 | 55 | 62 | 49 | 25 | 96 | 40 |
| 9 | 70 | 62 | 60 | 70 | 56 | 30 | 98 | 45 |

Racial adjustments (`DS:3D3B + race·8`): Dwarf 0 +10 +15 0 0 0 −10 −5; Elf +5 −5 0 +5 +10 +5 0 0; Gnome 0 +5 +10 +5 +5 +10 −15 0; Half-Elf +10 0 0 0 +5 0 0 0; Halfling +5 +5 +5 +10 +15 +5 −15 −5; Half-Orc −5 +5 +5 0 0 +5 +5 −10; Human 0.
