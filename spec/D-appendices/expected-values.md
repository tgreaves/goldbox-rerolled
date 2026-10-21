# Expected values

> **Status: complete** (work-plan steps 5 and 6, [AUDIT.md](../AUDIT.md) §8). Informative. Part D
> of the [specification](../README.md). The data dumps moved out of part A (§1–§6: rules values as
> numbers, game text and art as hashes) and the V1 hashes of the decoded images, every table and every
> DAX file of both games (§7).

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

## 7. Decoded files and tables (V1)

SHA-256 of what the decoders of part A produce from the GOG releases' files (the test-vector manifest's
`releases`, [test-vectors.md §1](test-vectors.md#1-kinds)), for checking a decoder without the data:
the unpacked and merged images ([containers.md](../A-games/engine/containers.md)), every table of the
table map, and every DAX file's records ([containers.md, "DAX archives"](../A-games/engine/containers.md#dax-archives)).
They are the F vectors `decode.image`, `tables.bytes` and `decode.dax` of
[test-vectors.json](test-vectors.json), generated with the rest (`npm run vectors`).

<!-- generated:hashes -->
| Game | Image | Bytes | SHA-256 |
|---|---|---|---|
| PoR | START.EXE unpacked | 68592 | `a42a57e68d3f7815831821cc9365bb917befda45a58e958544451fc7a878df8e` |
| PoR | merged (START.EXE unpacked, GAME.OVR's overlays placed) | 300288 | `988ba408a83c04f6f28aea1448160753230ffecfd48573bce00fad3efa5f6c51` |
| CotAB | START.EXE unpacked | 62432 | `f0ce4b2036e48151077bdc34f7afba48bd9d2032139871924b6854c4b5784ec1` |
| CotAB | merged (START.EXE unpacked, GAME.OVR's overlays placed) | 359504 | `90b0cd7aee34879396944a109afa0810259643ba8168b8c0c0dede2784aa6100` |

#### Tables

The bytes of each table the table map names, from `at` + *from* for *bytes* bytes ([addresses.md, "Tables"](addresses.md#tables) gives the entries).

| Game | Table | From | Bytes | SHA-256 |
|---|---|---|---|---|
| PoR | `classBits` | 0 | 8 | `552a06951337332960056979bd0eaa753d903680ee037d290e90ca4464f85a16` |
| PoR | `trainerBits` | 0 | 8 | `e2903da7b3c332cf567bf77a770945173cea295edea03201eb93c4f1f592c09d` |
| PoR | `hitDiceCount` | 0 | 8 | `d3fe1dedaad1fa23e97734812216792967cd3fc05e4da3ec905abc57328b2047` |
| PoR | `hitDiceSides` | 0 | 8 | `6bd513799abfe8479052a90c844f47f055ea4ac71070b19011e2cca870eeb5de` |
| PoR | `npcHeads` | 1 | 16 | `f99a320dd2141948744fa8629008f9b2ab2298d7dff8f833b7a31f599a6f8759` |
| PoR | `npcBodiesCleric` | 1 | 10 | `4ba9bcd6f027d164e8fec83682f9fb224cb44f9c11f5e70f028e20a2bb4e2ba9` |
| PoR | `npcBodiesFighter` | 1 | 10 | `915648ed8ae49e5a78099cc0451ca9f6ec90217ed6fe762bf5b7cfae181ffcdd` |
| PoR | `npcBodiesMagicUser` | 1 | 10 | `66d98d5765e89a981859c4ec7b8f747fe6591e1d1569d8f1b14cd5122819d948` |
| PoR | `npcBodiesThief` | 1 | 10 | `145256530bd1f6b807f64976133298694b0630b655646a6880447df19a5ca966` |
| PoR | `raceNames` | 0 | 80 | `59d396ec1eef70b35f80cf363ae7cfd747c63b18fa8345adb892381d299d17e4` |
| PoR | `classNames` | 0 | 459 | `7e33e5eaa6dd4f7f05c0a459f0953a069e0c5ba15b18d3a6ef48ba8ddba19278` |
| PoR | `alignmentNames` | 0 | 153 | `1db01146bcf5946e560f0fe2466cc62a2a8bab0df6099ef836011f1c31a106bd` |
| PoR | `statusNames` | 0 | 117 | `c345546ee86a370a9ac0ed524f898e6ad86826d6898e43ef066022973e788635` |
| PoR | `genderNames` | 0 | 14 | `331495f04dd40a8709dd4d6bc6a28a0984bfb2771ee112c66a2f323338c14f6a` |
| PoR | `coinNames` | 0 | 77 | `055967c96bf8967f9b8cd8713cd5bf1a4456b7c72f4c20dc6e341b863f00c1de` |
| PoR | `coinValues` | 0 | 20 | `a8ea85906ef0e7b501c9f1cf77c9924314b9bfb62846d856d8a9568c1a85319f` |
| PoR | `templeNames` | 0 | 410 | `5de9ecd7b33d26571e9e00a1e6626a978bff5dad515d245432b1f35c6437c835` |
| PoR | `diseases` | 1 | 6 | `7eca5b53946b1a7f1cdc09ce71b366d51d787d2353a113b16adfc7564b200e86` |
| PoR | `randomItems` | 2 | 304 | `1bd15ad93fed8e835110941fbd2e33a7c65542645891b16400d89ffce320a09e` |
| PoR | `sky` | 0 | 16 | `7cdeedcb7be4531a6e29c8bb53ea465a9d9b18bcba4fa296a745a96283ff27b0` |
| PoR | `itemWords` | 0 | 5355 | `4059508e5191b134e49e936ca975cb705afc502e005a23c9805b24255f8c77d6` |
| PoR | `wallDx` | 0 | 9 | `1b7e28c966795b6ec5f41c88185b2271d29b3f6fea35ef15c3c70bb77e0bca84` |
| PoR | `wallDy` | 0 | 9 | `8331a79aebc0185dae7d0e0d161cc6256cf30c7e03c1d78a72af306a8e8a43bf` |
| PoR | `viewPieces` | 0 | 70 | `439f69253bc8097c9bd594b2974c322929a1d79df74eac4c6bc89ab2979cb416` |
| PoR | `battleCells` | 0 | 264 | `e08721e6a4ecb3c1c92fac8d66ab127b663185b8c71668b9af047955bfd602b7` |
| PoR | `headRecords` | 1 | 14 | `21f55503dd2f005d2a5e37880674a7c5f75dbe33454f3e683034033fe21b0fd3` |
| PoR | `bodyRecords` | 1 | 12 | `c2a4653fda4e4df3638036d20723cd84a66d0aaf96552b3ad717852f6a3f0117` |
| PoR | `spellNames` | 0 | 2296 | `e89eb40791ab58d4fc96727b72734166092da802e4cddf90f7c6080c715fe097` |
| PoR | `spellRecords` | 16 | 1072 | `4790807bcee4392c49212141de79816f812bdd4067f7af337112aa45042ee364` |
| PoR | `overlandMap` | 0 | 1584 | `56ebac6c209297431ce4fd8f61059077f97ce56244d3c8ccfd4900d07be7b6ab` |
| PoR | `overlandSpecials` | 0 | 54 | `f0e807550fed4090e3e0e191eaff44423b05d8cc28b2d5e771d35e1f572a72af` |
| PoR | `overlandColumns` | 0 | 5 | `4b2c54fe81babebfb39b15b15deee0721fa1be015a0de17fa2aa8cddfc8586a9` |
| PoR | `thac0` | 0 | 88 | `d17698021f7953cdea12893a0fdc284ae9cb3760fbef4678996bae52f0117e49` |
| PoR | `thiefBase` | 9 | 72 | `e02137d3a682615803618eb622e0e5826a27f78ec084c1c320aed37aae72c102` |
| PoR | `thiefRace` | 1 | 64 | `e4f3658606ce903268ad1b9d0c4d7ed343346cdba8cbbd0bfc80010076b7211e` |
| PoR | `thiefDex` | 1 | 130 | `c639f4547c3e349d6c4a1da1779595d03704066065894ed16550b6b4a4728a72` |
| PoR | `raceLimits` | 0 | 128 | `81a4b43e8bdc50aecb0dd4a3411e65fa3bb8804cb4e8392e74d8e7c0fae75ccc` |
| PoR | `raceClasses` | 0 | 96 | `81159cca6e6c8c5a2741353dc205b1538a73a9e70cbbd6d61e0395c74ab72f62` |
| PoR | `startAge` | 0 | 224 | `26aceb7848d4287f16d17514875a5d04943b490df02f871a317489b7d102eb19` |
| PoR | `ageing` | 0 | 80 | `708eee963ede5d9f0fa7bca2b8cc7a388143e3ce21d58766748df8df34ec16b2` |
| PoR | `classMins` | 0 | 102 | `843bb9980f60b3813756fd6f96eeac2cfde6d4b3fbe24b601775ad8fa5eeb9aa` |
| PoR | `alignments` | 0 | 170 | `68dcb2bb8755329c982fbb52375d9eba2086ccf489bc3aec174768517d23e44c` |
| PoR | `conHp` | 0 | 26 | `1d32c42265434c4fa5c12e2ccbac200a5fdde2ae57c37c5679d76672fc4389ad` |
| PoR | `xp` | 0 | 448 | `153a147132cd8586b35114dda3a56fca3e0423fda68a0ddd687e496097850cb1` |
| PoR | `clericSlots` | 4 | 27 | `dfd0c1759ff13551f372b352db3da21a477f19ec661a76382fcbc4064e343c07` |
| PoR | `muSlots` | 4 | 27 | `8e39e4993ff16f412b2e47a62bb2822568ee96b9e7152aa4fccafc54b2069afc` |
| PoR | `startGold` | 0 | 16 | `d80b831d196d6c4f647ecc0826de6d8c43007dc631d0d1b6a5f2c1bf0273d9b4` |
| PoR | `saves` | 0 | 360 | `22ca3548b4a0a35ab14f03d8960d88deea34e5941fcd035fdca32d46eb13a07b` |
| PoR | `gasCloud` | 1 | 4 | `41a2d45961e5cee85030438f783bb49ef9abb204cab02ef36435adbabede8cb4` |
| CotAB | `classBits` | 0 | 8 | `28f184aa988e9a2a7232da0e3d7015772d7511312e3ddac1f53e7f702a9e6be5` |
| CotAB | `trainerBits` | 0 | 8 | `f0ae14bd1af077753317f181d45a79a326e7380fcbf603f6ce8cedf00917f3f8` |
| CotAB | `hitDiceCount` | 0 | 8 | `d3fe1dedaad1fa23e97734812216792967cd3fc05e4da3ec905abc57328b2047` |
| CotAB | `hitDiceSides` | 0 | 8 | `6bd513799abfe8479052a90c844f47f055ea4ac71070b19011e2cca870eeb5de` |
| CotAB | `hitDiceStop` | 0 | 8 | `8d862a36fdf7b4c4f538aff0157c5ddcbae5dea6cc863a6767470ba97aec1160` |
| CotAB | `raceNames` | 0 | 80 | `59d396ec1eef70b35f80cf363ae7cfd747c63b18fa8345adb892381d299d17e4` |
| CotAB | `classNames` | 0 | 459 | `7e33e5eaa6dd4f7f05c0a459f0953a069e0c5ba15b18d3a6ef48ba8ddba19278` |
| CotAB | `alignmentNames` | 0 | 153 | `1db01146bcf5946e560f0fe2466cc62a2a8bab0df6099ef836011f1c31a106bd` |
| CotAB | `statusNames` | 0 | 117 | `c345546ee86a370a9ac0ed524f898e6ad86826d6898e43ef066022973e788635` |
| CotAB | `genderNames` | 0 | 14 | `331495f04dd40a8709dd4d6bc6a28a0984bfb2771ee112c66a2f323338c14f6a` |
| CotAB | `coinNames` | 0 | 77 | `055967c96bf8967f9b8cd8713cd5bf1a4456b7c72f4c20dc6e341b863f00c1de` |
| CotAB | `coinValues` | 0 | 20 | `a8ea85906ef0e7b501c9f1cf77c9924314b9bfb62846d856d8a9568c1a85319f` |
| CotAB | `frameTop` | 0 | 40 | `2cf5c05c958653cb24ec7c66822487d98a77c5fcc6c5fec802ee90f00896c1d3` |
| CotAB | `frameBottom` | 0 | 40 | `cbd1c8f639b662b154882b22e092aa495851a9eb18689f18e76cc82f118e6054` |
| CotAB | `frameDivider` | 0 | 40 | `51cf729bf065d94db0059f64378a9beb072e581b8054385afbf14eb72108662d` |
| CotAB | `frameLeft` | 0 | 24 | `5e518d10ff58e6250b0e0cbbb065c4cf287f1db46d467d5c99b8e4b920f4c2b1` |
| CotAB | `frameRight` | 0 | 24 | `d53af6b19fe75f6a67d718739df2640f686651ff18c61485b0ddc31a1394e9fb` |
| CotAB | `cursorX` | 0 | 33 | `ace190e250cfb9773cd1ad6539b17d2b4e041fc0497ce081698fe7dc549a8503` |
| CotAB | `cursorY` | 0 | 33 | `5e1529512967f9debd6208d3739af9f145b20e681ffc0cc15a4224e3d82bc483` |
| CotAB | `placeTerrain` | 0 | 33 | `ede1667a76c4284f5510171999a9a30cffcef04d9027c61bacf6227961f6cdec` |
| CotAB | `templeNames` | 0 | 451 | `431e455ff63aea4d752c69013c07a35d895e4338613b4187c298ca0fb30cf8c6` |
| CotAB | `diseases` | 1 | 6 | `bcc921519cc99822f97cb1e3a964813ad497714f651b23176a73994f4948b320` |
| CotAB | `randomItems` | 2 | 112 | `10bfe3bcbc4079e6d43a9aa388a0f5d1be5c65381c3e30d8ec72275e78f7cf6f` |
| CotAB | `sky` | 0 | 16 | `0810d61cad4464243dadeb745b1812cb695527ee358356450bde20a9a92bfc9b` |
| CotAB | `itemWords` | 0 | 5355 | `59dacb06174b2262f7d16009ac4deec9e07cb536b01586e87e042ebcdbb1e59d` |
| CotAB | `wallDx` | 0 | 9 | `1b7e28c966795b6ec5f41c88185b2271d29b3f6fea35ef15c3c70bb77e0bca84` |
| CotAB | `wallDy` | 0 | 9 | `8331a79aebc0185dae7d0e0d161cc6256cf30c7e03c1d78a72af306a8e8a43bf` |
| CotAB | `viewPieces` | 0 | 70 | `439f69253bc8097c9bd594b2974c322929a1d79df74eac4c6bc89ab2979cb416` |
| CotAB | `battleCells` | 0 | 264 | `9c6fb2c658234847a67dbd07eca86e2d492c96142d95326b715991a50330cc8e` |
| CotAB | `spellNames` | 0 | 4100 | `8648725556e01ec346f63d9f35492c20f3275f2cca5f167a90d059d5280ca5c2` |
| CotAB | `spellRecords` | 16 | 1600 | `41ac8114241943e0d8c1ced49275f29b8d04d14e46a79f7f1e1c6ae50d38b1e6` |
| CotAB | `thac0` | 0 | 104 | `08965bd70d1670b0406b362560de8bda946d33c7baa5f773a8b3761eade881ae` |
| CotAB | `thiefBase` | 9 | 96 | `1ea263110b43feb790f09cee6cef79ebba8c271d2f383544fe64cc1abce7ccfe` |
| CotAB | `thiefRace` | 1 | 64 | `2e1ff4c55d7c7d39135d486326485f7fe131c96c294a8777d7de0563f56d5138` |
| CotAB | `thiefDex` | 1 | 130 | `c639f4547c3e349d6c4a1da1779595d03704066065894ed16550b6b4a4728a72` |
| CotAB | `raceLimits` | 0 | 128 | `81a4b43e8bdc50aecb0dd4a3411e65fa3bb8804cb4e8392e74d8e7c0fae75ccc` |
| CotAB | `raceClasses` | 0 | 112 | `4e3f4dc29226de9f9a6dd173826bfb74b53d487e39df36522454949091fd3517` |
| CotAB | `startAge` | 0 | 224 | `7528cfa5c6fde8efdcfc5b1ac56c80d2a5e93dff7222e25a03603e9988408e44` |
| CotAB | `ageing` | 0 | 80 | `708eee963ede5d9f0fa7bca2b8cc7a388143e3ce21d58766748df8df34ec16b2` |
| CotAB | `classMins` | 0 | 102 | `62220f4d4d589637cad5347a4db0325a72c96213d3327014ffd7c105c1549926` |
| CotAB | `alignments` | 0 | 170 | `71693bdb1a722afc86f404d38ff98ac126a840c72a5c9b90a7018b47008beb40` |
| CotAB | `conHp` | 0 | 26 | `26d708ee2d557a1fe1607ddd1b14e24d45b6de0139328da1a94c32ce03fdb6b4` |
| CotAB | `xp` | 0 | 792 | `931544572b4939562b2bb7231f2670270989f1e36feb7985ecd3eabc364685a3` |
| CotAB | `clericSlots` | 6 | 55 | `ada2418c6554e879dba840ae5a5469317dba5995c19dbc588c548e0401347d69` |
| CotAB | `muSlots` | 6 | 55 | `a9c2e1286b106c60912ab38c5ce2ed6b87fdf16d8d64e2bd861ba2bc2582148c` |
| CotAB | `paladinSlots` | 46 | 15 | `eca7c0d9c137dc74f7a65f868e5405d3cfe636b7cf07f89ac0bb77c8b8538130` |
| CotAB | `rangerSlots` | 41 | 20 | `3724f3c9bd9ae31afed84ff223513539a88e81751e337677974172228942dbc4` |
| CotAB | `startGold` | 0 | 16 | `d80b831d196d6c4f647ecc0826de6d8c43007dc631d0d1b6a5f2c1bf0273d9b4` |
| CotAB | `saves` | 5 | 480 | `75786fbcce24caa5b656924b1f3dd933802a031aaef1cac532382e562dacda87` |
| CotAB | `fanDx1` | 0 | 8 | `28f61e347a7bf816a186f07480ff65d96766347050f30177ec03b825fc55466c` |
| CotAB | `fanDy1` | 0 | 8 | `e31403e30fd7ed39ac6226535a50e07e25783a3022408e63dca78ae46cbfde7e` |
| CotAB | `fanDx2` | 0 | 8 | `39b7309e238fe92db02d3bfc2af0574184ff17c111d2b3cbd717c7bd302ce23d` |
| CotAB | `fanDy2` | 0 | 8 | `f331c25044999bf9e29ac61368a0fcdfc3ca909f943c683109e929e9d8395c71` |
| CotAB | `gasCloud` | 1 | 4 | `16e4aae72e4d740d2e7748138af300202773e1c37e6accd3367cc17417c68bef` |
| CotAB | `killCloud` | 1 | 9 | `ba551e82a756a0bd7da068f6ea745e9a914dc76d32a8714f04535b7b454bba45` |
| CotAB | `furnishDx` | 1 | 4 | `199ef7c84450ff1d1df9a9ca42add325d5ad67f1a1b5ff952d61a309397dfc1e` |
| CotAB | `furnishDy` | 1 | 4 | `d31878eb7602500a4cfbb48a94945810e716b11c38be43481788e01ef825512f` |

#### DAX files

Per file: the decoded records in ascending id, one line each, `id size sha256` (decimal id and size, the SHA-256 of the decoded bytes in lower-case hex), each line ending in a line feed; the table gives the size and the SHA-256 of that listing.

| Game | File | Listing bytes | SHA-256 of the listing |
|---|---|---|---|
| PoR | 8X8D1.DAX | 438 | `bcc4aedf2777755d9e7c44eb48f69eb8c13854346a7aa1447ba04b1f12da00bc` |
| PoR | 8X8D2.DAX | 434 | `8b204078da708ce8f6f266dc25b2c931e0317678a0f23d854d39f038124057f9` |
| PoR | 8X8D3.DAX | 438 | `8b4ce2f5d16b6c128c9ac945f417aedd1c6653e9cd1debc8d70402302fae6260` |
| PoR | 8X8D4.DAX | 509 | `2780d692c4cf95c6e8b7b82fb72e3c600b636ff72defbd4ef16d3c154fa3cd5b` |
| PoR | 8X8D5.DAX | 220 | `622538b92e50651075890c4e894334a8a26465a294de995a3f02903211588db6` |
| PoR | 8X8D6.DAX | 361 | `e3ebb6d147e1956a20db3ab3f910149b030466d9ae8925389c923b6cec5e34e6` |
| PoR | 8X8D7.DAX | 361 | `fbfa76be38f68ed93c98b19adabe11add281199133ae91dc7ef9a45321b9daa9` |
| PoR | 8X8D8.DAX | 508 | `c2d1c1d7d8a661201a55d3bdab69c39c0525df00ed10b65e2aeb9c664a99db2d` |
| PoR | BACPAC.DAX | 73 | `aa254e7525ce9ac458772561c314aedd980a979baf683931f4f8734d1af4a2bc` |
| PoR | BODY1.DAX | 217 | `ed2f3161e6c03b1f3d09e9044294075cee0ce89cfe3c455a398d86aba89fdadc` |
| PoR | BODY2.DAX | 434 | `801f9fc961b85aa9d5e15f2e1bafb31da9fd089080f2cd4e860152a22fa19a64` |
| PoR | BODY3.DAX | 1161 | `ff1fcceb5696b9dc716b2d9aab01df266052b6ceaded42475997dcad8ea9bdd0` |
| PoR | BODY4.DAX | 216 | `28e1efd4b7f9c2ff1e857b010c907c26607d189670e020f8ebeba2d37a9a11a4` |
| PoR | BODY5.DAX | 434 | `a778255b6af2b53809950227bcb63416f4a7d53551269cebb63bb6f0b57143c9` |
| PoR | BODY6.DAX | 360 | `c7933783b7c92e10d1b1580a84c3065e177a0ab104c9ccd583d7d9c4cb285828` |
| PoR | BODY7.DAX | 289 | `5920cb7204592a0ed211f0aa97151df1977c546947f9e40344ac590c7364a708` |
| PoR | BODY8.DAX | 217 | `b337422623a1458ed84d290d16021edd0609af5b25852504b2cca01017a054a0` |
| PoR | CBODY.DAX | 9270 | `60d858870d59fc02dfd6b60e89ee23ed1b375c243264f0bfdd998bacf657d47f` |
| PoR | CHEAD.DAX | 4050 | `2a9f92d755a9310d9963c9b6e602e4f09cee717dda2dff9fc8d8b3f7a8654f86` |
| PoR | COMSPR.DAX | 1875 | `f0efc45deffc982f417ec314968e64c82663d3dd69e2fccbd0e717db3106a5aa` |
| PoR | CPIC1.DAX | 1587 | `c89da95030e276fe5e48fad794724a21ff6a3c8d383b9896239f2f05080b695b` |
| PoR | CPIC2.DAX | 2746 | `97b480ce6569169db048945087b9f5ab848ddcd95c9e6c06cee898cc4a832c52` |
| PoR | CPIC3.DAX | 1015 | `45bff00ab1ec3c72f7a1c6695ae94009e37ce8b987f4bec835ec08deb5c5a141` |
| PoR | CPIC4.DAX | 3186 | `4e9689926e5920abfe218e0c23b14a3e2a1a7fa825af6feaeabd65200bcfb5ca` |
| PoR | CPIC5.DAX | 1452 | `a3908be029f45a5e0fa7bf01b8bcf3c4b62bc24285ea8f69ba714138035cda0b` |
| PoR | CPIC6.DAX | 2177 | `f62f1e210faf7ef1f3bd6f45bde99790bb7b25b5c30208b1ca3618a78825a1ae` |
| PoR | CPIC7.DAX | 1593 | `e8fdb95b36fbea1a9fa90ba87c078ec80138883596befa32c7e445232ca8f70a` |
| PoR | CPIC8.DAX | 2033 | `061162e372035e90a76f7d8224f5b496e01b328293287ad89dc94ee3387462ee` |
| PoR | DUNGCOM.DAX | 72 | `3695a80b38e515b48f183efca419b35d53d13c86e26cdba68ad76fed99c324b2` |
| PoR | ECL1.DAX | 146 | `974112812de65843bb4c4ad250e76d9e1097fbf2338a7994f3df5636c8f2a95d` |
| PoR | ECL2.DAX | 218 | `c1caa43cb8fd27f541f398463c2ebbd10297c5c811454ad61d6cca8c4191b96b` |
| PoR | ECL3.DAX | 290 | `3bbbf78a06ead179c7f0dcb3aa7f9e99c6631de36139492ba585f8a23d78ce70` |
| PoR | ECL4.DAX | 218 | `d3af2d478c51d04da199e71491992d1c2f503e0e4f9162a7eefc1fba307e9348` |
| PoR | ECL5.DAX | 360 | `0a673d40686c0db2c6d54ea3849b3081c2d79a750a6baad61572e42c26f6e287` |
| PoR | ECL6.DAX | 291 | `66ff7307929ccbee3f7e1b9e0e386c3cb13a77d74dadf2aec98ab708f32d3240` |
| PoR | ECL7.DAX | 292 | `6a368cf57e0f25fe39972843da4c825546ebe5259d59ab58371a053775581111` |
| PoR | ECL8.DAX | 292 | `096f7869ac684c3ed4b31edd212ec9b59934dfbaf014a28505f21e8b0c2973f2` |
| PoR | FINAL5.DAX | 576 | `fd33aca445e8e9ce5f187d1d07260c8e1a118ba3976d608ee9de85e31f128cc3` |
| PoR | GEO1.DAX | 219 | `e57eade8d0d46efe048e4904e044a09c351afeb313ae9f25a19e9e4c30834d3d` |
| PoR | GEO2.DAX | 218 | `564b65b08ac73beaf858ff8121b4564b03e93ff2b3ebca54495b8b91285dd30b` |
| PoR | GEO3.DAX | 145 | `ee57e4ff9b0dd96885f30c747241168a88dc0698612ed180841f71233341f2fc` |
| PoR | GEO4.DAX | 218 | `e759dd904030191b4ca9ba31df6cda3750c10224b04ae740e942296c0cadc47b` |
| PoR | GEO5.DAX | 360 | `6450d1f8b34788d681fd0ba1abca65c507406d8c05a30e34262afad699aecedc` |
| PoR | GEO6.DAX | 218 | `194f7aafb17925bae65d3d266de9a037ab4e67ca9a4300303b618521649609d0` |
| PoR | GEO7.DAX | 292 | `93444a553f9fd9df0068fadfc6c5bb4a6c74bda5b9f6a8fcd214cd5cf183a65a` |
| PoR | GEO8.DAX | 438 | `170106aaf24d90411dd2f92be0b7599af3cef45ebf6358f259e72125ee707eea` |
| PoR | HEAD1.DAX | 218 | `e1d3d0b246b438f9bee2275be3f5e5f6233691681dbe1aa4de2331a9cad82338` |
| PoR | HEAD2.DAX | 363 | `d2482389f3f13acaedb382f6331eebec7e01991e72bde35a606303a638a2f887` |
| PoR | HEAD3.DAX | 1530 | `bf493a02f60d3fcad8dc7c6395b35e509fe8ee4a6fbcd4dea5bd44ae510502c5` |
| PoR | HEAD4.DAX | 218 | `a9e3783149e63966b3a8b703506d4661b1c330e3eeb90dec7870ecf31df99ca7` |
| PoR | HEAD5.DAX | 802 | `e5c80f5a5ac56fcd49c3acda0c17fc7f868719ab40a0189c817709524c184b3e` |
| PoR | HEAD6.DAX | 507 | `5d170aaa9961fdf79c392ca12e83d58abc9418a1a24fad082d5b6441a74fa79a` |
| PoR | HEAD7.DAX | 729 | `ee8f8023b58ac2ba44a7a58b71d932fe5b515668b69144fc58e5680597ed55a5` |
| PoR | HEAD8.DAX | 219 | `7929a843d9159e04c1851d3d2091f71a54186ea51fb5f7670332d70039abc3f9` |
| PoR | ICON.DAX | 432 | `c68e6c5523ccce60abebae0f2e70a0c8e965d8746e35cfc07ca2a6aeff20cc82` |
| PoR | ITEM1.DAX | 499 | `c8fcb67a079b49959bba8cb40c64ac43f28d70d149abd4ee2cd52eedc6729312` |
| PoR | ITEM2.DAX | 568 | `22fa8710c0fbeaba6d28a8ac0c8a9b2e6d4736a45efc59ab1b6aa29d7258273a` |
| PoR | ITEM3.DAX | 721 | `5c666c28552e60dc9c20ad93238d7479583be80a28317bc219a928adb3fbb56b` |
| PoR | ITEM4.DAX | 719 | `2c826b010199cfc0ee37d9c675dd62fc99258f1f69d4d7074f4e44afb4a23455` |
| PoR | ITEM5.DAX | 287 | `86bfef4da8a2c4b12afb76fd175035dbd34d77db7200661a2da8b6e63c812fd1` |
| PoR | ITEM6.DAX | 71 | `7c3f678e183ccde0e62165ae353d4af0e5c3f67177c0e14dc71c6ca56fe121dd` |
| PoR | ITEM7.DAX | 72 | `c9578e364899978f559e4bd6b7afcd0133c9e8d2a9ab5956b228c0640ea68b67` |
| PoR | ITEM8.DAX | 357 | `11c60ae6f1831206718b6f4f0bdcb31cd079d21bef64d8411181b694861f9275` |
| PoR | MON1CHA.DAX | 1073 | `3753667e35a6fed3053756d6125eec277c4f9485ac3a42cebb82fb69cc02955f` |
| PoR | MON1ITM.DAX | 928 | `bf0535258dac31486b87d928c8685d7128e5bc82306257c85cddb7ca78351028` |
| PoR | MON2CHA.DAX | 2007 | `576d9d4bc55159e059fa3d75c6d60db5812f6732830a2b4adb2371a82ec655d8` |
| PoR | MON2ITM.DAX | 1355 | `3c95b024fa07a0f06c248b702eedab16a22d4883a50d9405d2cc238a71ad9a32` |
| PoR | MON2SPC.DAX | 283 | `d644878face3dcdd9b10ae975a2ee5e34a5502cc0ef9cc1ed73d2960fed7257b` |
| PoR | MON3CHA.DAX | 1449 | `6c26fe7cfb077f5653d2da32dc6dcc1474a83444ddb6716c426518e8cfd19f12` |
| PoR | MON3ITM.DAX | 1303 | `52b804cd2ad9819bf6e717df67e533410dd991a9441382b12e097c02a3bdc1ed` |
| PoR | MON4CHA.DAX | 1871 | `01373c185972a174da1d2ee06621fba63599ecd1fa48befdb157679a84a335ce` |
| PoR | MON4ITM.DAX | 569 | `fcea52dd812032ee93eed65da58c8722f242fe15ecbb5e9a43a297b2a73d0314` |
| PoR | MON4SPC.DAX | 1134 | `00cffdb04dc9d35686be6feb9f031abdc1d951c4fbc09ed3257bb5e5d4fa153f` |
| PoR | MON5CHA.DAX | 1368 | `eb64a559b584ed3b8fa12a861d062c1bde6fafb4dcf5f4c8362f8be7cd7c4c36` |
| PoR | MON5ITM.DAX | 863 | `d45b07083d99883061602ddf2f7a04863c1436df7e7164b4579cd1ca989698d2` |
| PoR | MON5SPC.DAX | 565 | `6c4c44ec9a28f4c4de4251d0aa76a6002d1da08d9047f8933615022f3b5b4b1f` |
| PoR | MON6CHA.DAX | 1590 | `86174c8a481bf5c4b310331afb17580d1484c9079fb962759631145cf63873dc` |
| PoR | MON6ITM.DAX | 794 | `aab7f3c9169128f30eeec3db216d32636f2c07c6f7aad68a3f9258a5fd7176b9` |
| PoR | MON6SPC.DAX | 425 | `bc62adab7176df34b0dc0c9f9703d717590c21504d797b7e5c79b5e35f6942fe` |
| PoR | MON7CHA.DAX | 1727 | `681b14763c1577809dc8b1e3b393faa20c360060be258a598584c6e07d52626a` |
| PoR | MON7ITM.DAX | 1292 | `cc70014c3fd22753019e6264a8249af85357330ec3def4aaa6467d8fb7cd9d3b` |
| PoR | MON7SPC.DAX | 140 | `775609430e29b5b2fd93ef66ed51def99a5d8aec4c82901eff2915de9e6a9cb4` |
| PoR | MON8CHA.DAX | 1300 | `661e408486a8678d22f24d51d4b8d3b49967e5f2013700bb9f7d2f90dd99c04d` |
| PoR | MON8ITM.DAX | 429 | `47e13e8cbfbffaa62c41cdc030d2742fa0be398eee96a8a05ad8a91ae7b51b6c` |
| PoR | MON8SPC.DAX | 427 | `ad3a91707f083856139bdf85146eda830d52635d096b1113778de55086f4779a` |
| PoR | PIC1.DAX | 511 | `bd6edc5b01d33c1ec0e655691ab2d172b4e471ccb23d8acb7f5c0b86f219ba75` |
| PoR | PIC2.DAX | 953 | `bd16a9f4de3b8aa1863613d7caa0065485be4ea90f5f8ed5eb499d1a3b7f49ef` |
| PoR | PIC3.DAX | 220 | `6834f9f3cc9342f83f2e0215966dd0ffeaacada35b2ec43965204b82a0c4d343` |
| PoR | PIC4.DAX | 1252 | `ff258b8b197429442f84e18921c36b4d27b66dc6c918203b6cdfb00d3fd439d9` |
| PoR | PIC5.DAX | 733 | `53ac75f81d877ed432e7fc61fc44b0d2197228b27c980fc674ea991c3e5b7b7b` |
| PoR | PIC6.DAX | 1030 | `aa091f0abd0d6d38ce63c4638238fac3653ba46d975ff3b891fb07e0a0fede4a` |
| PoR | PIC7.DAX | 1029 | `bfcceb314068c7bc9d03c0c52acc74b044419a6c323ce2812ad76b7338dae30f` |
| PoR | PIC8.DAX | 1030 | `e5e32b45d25d6549f27ba877e5f470b472ecc2462ce0be7df79856126f520a21` |
| PoR | RANDCOM.DAX | 72 | `657589b526add8b836c5ba9d817533ed935d96d4fbfce2d670af26d47e8fdc10` |
| PoR | SPRIT1.DAX | 360 | `2ce5f3b73cc3a789fd14b7bbce201b11775fabadc188075311ded60ede06c812` |
| PoR | SPRIT2.DAX | 1090 | `3b1ead3f6ae34f10cf3d170e4a37de0f00c113a455c27a496cdb2b3859a0fd30` |
| PoR | SPRIT3.DAX | 510 | `80906b6f98f84393664f69386003a3365ebe08b70517e10cf798a048d3460cb7` |
| PoR | SPRIT4.DAX | 876 | `3be60f79dbe466764b7da8f15ddd4361483512d58f4830da891a8ee838896ab5` |
| PoR | SPRIT5.DAX | 803 | `835b42030b91812edca865fc0dfe90e0aff1d686c2180060ddb66167504cfe34` |
| PoR | SPRIT6.DAX | 1025 | `efd7b4674235077e627fd9e04ffbb7c66d53aea02a6438165b69074940449656` |
| PoR | SPRIT7.DAX | 875 | `859553e6eec52ca86c12eaf64c2f43ef60bfa6849654ad3fb992322e75b6ca1f` |
| PoR | SPRIT8.DAX | 878 | `6221d85c38a51350261e059fcbc26b5010c7a249ff78d72b197a22fe955208fc` |
| PoR | SQRPACI.DAX | 146 | `01b7814196af31c8bbc63605ec28f0f9c3129795cd0ea25ddbb2b3108964eee7` |
| PoR | TITLE.DAX | 146 | `4541aca7ffc48deb8fc32adcb5201429a080221343594cf8eed4a09eb5bc6f5f` |
| PoR | WALLDEF1.DAX | 213 | `7b8f8002faed2cbcc3238c6e01f17ffedd4d0170a6620471f133067a60e18cca` |
| PoR | WALLDEF2.DAX | 428 | `b3b8f37edf3ade2d83faf198442d55324ff0f19024605b87570f462efffb9969` |
| PoR | WALLDEF3.DAX | 285 | `55cd4a96bd4cccf1b10fb3b25520e0b61275e58d2523b88bbcbaeead147176a7` |
| PoR | WALLDEF4.DAX | 429 | `dd15e7f642a6244543b7cceef3b2928a5e3efa3ef4a0430d5084cd5868a1c936` |
| PoR | WALLDEF5.DAX | 144 | `40c72a5b3a5cb017945fa779b70948c878fe5888fbfee63242924323d5ffb549` |
| PoR | WALLDEF6.DAX | 356 | `4d4cb3d771d8a626356673a49fb3e9f3cae0332eb22673c99b007c33eeff8edd` |
| PoR | WALLDEF7.DAX | 356 | `848448576e6808383f5ce998d5967fa0daf21abaff8c56b27945fa9cee71f941` |
| PoR | WALLDEF8.DAX | 501 | `9dc64e2b8e1a4f99b0e51e1512056c0618b36d9fc561c949a18a35f6621d9dc0` |
| PoR | WILDCOM.DAX | 72 | `894100b9eb0b0718ece82b721cf867dda46dca238e1d2a9020dc1c5bc3080670` |
| CotAB | 8X8D1.DAX | 222 | `bf2553c5bfe49af20f999e2d85eec710bbb7372ba43414622cac8acc05f3b8e6` |
| CotAB | 8X8D2.DAX | 288 | `80e7d6cc5fbafccff273a300b9fae9e478abfc05b205618af8831000fe976eb9` |
| CotAB | 8X8D3.DAX | 288 | `f3106224a04fe8380871016cae5737fadd63ec7cae7c27e75d4c854d6799837d` |
| CotAB | 8X8D4.DAX | 362 | `d6fc736172a6e229f257b75073d930220e9a706a56c354493e3d76241ba68b3e` |
| CotAB | 8X8D5.DAX | 293 | `c606e4ee3e2ddf84610d536e152552af7adde1197cd9a4ae21642c8f3f9c0a37` |
| CotAB | 8X8D6.DAX | 366 | `221998aafcf70b67eedbfaf48782cf5520ab6af3e498f55da91a40d5083221bd` |
| CotAB | BIGPIC1.DAX | 150 | `31e07ad81630c52105ed7476f35a6d345c95f357757fa4e9103da535c68682ca` |
| CotAB | BIGPIC2.DAX | 75 | `340d6e05e5de416955bfba14352f4f8002285c02e5a2bd44fb02f42287b5f2b0` |
| CotAB | BIGPIC6.DAX | 75 | `2fed22983e2193dc09ca5782790eb7ad6e15cb8c4a7c8c262bcf6db553b70543` |
| CotAB | BODY2.DAX | 577 | `5636f58b2153cc3c2cd649c985f419b1e1666399ab911b48b57a5f402797f080` |
| CotAB | BODY3.DAX | 437 | `9823775b2e16dee3bd4c33e241812282cacea4cb15a458bb577ddb4cc36a556c` |
| CotAB | BODY4.DAX | 511 | `dc0b50488c630fc392e3bc6cfdabf80be82f85d68ad6b0e03805877b191b017f` |
| CotAB | BODY5.DAX | 437 | `378d5b907836c56adcd762b4b442394c985778061efdc0511c4c3305747c6b22` |
| CotAB | BODY6.DAX | 292 | `968055e97957e96cbf38e30e5233bcc06e0d5bef2b2accb61a7aa957e80c3258` |
| CotAB | CBODY.DAX | 9270 | `60d858870d59fc02dfd6b60e89ee23ed1b375c243264f0bfdd998bacf657d47f` |
| CotAB | CHEAD.DAX | 4050 | `2a9f92d755a9310d9963c9b6e602e4f09cee717dda2dff9fc8d8b3f7a8654f86` |
| CotAB | COMSPR.DAX | 1875 | `f0efc45deffc982f417ec314968e64c82663d3dd69e2fccbd0e717db3106a5aa` |
| CotAB | CPIC1.DAX | 2612 | `56ec7c6c426e3daa6803b663e6799232558bacab3275335710dfded621c16df2` |
| CotAB | CPIC2.DAX | 1585 | `37b4025537d38ac9e00ba85f05b9b99455cc6fb08d99f23cd9b1127e57fc395d` |
| CotAB | CPIC3.DAX | 2032 | `bbdf191338c141be292b0353d4c3e36936c7adfc695d342a8a71b1c63785a2a3` |
| CotAB | CPIC4.DAX | 1884 | `650d13c7ddc50e1d2258f97240dea11a6077c3fa6489b409c4e867143214f74e` |
| CotAB | CPIC5.DAX | 1891 | `4ff251c8686d86ebf671aea7d94d32ef5bfed881e3cce44383bd84f62b049127` |
| CotAB | CPIC6.DAX | 1305 | `43b67c523e2d83e5d8da6f8442df47aaaf93c35ebd259c870cb80136d0773200` |
| CotAB | DUNGCOM.DAX | 72 | `f6f5dcb1f9cf75d33ce7c52da010652011a1661db2e972b7f075ff67121a3e44` |
| CotAB | ECL1.DAX | 218 | `175cbc5e47fcaeaa73c1d45f1420edbf1b97733d5f566c5e7240488fa085e117` |
| CotAB | ECL2.DAX | 288 | `d3110cf972610765f813b9c573dee8831cc97f0c260f102071c763c2e5245ccf` |
| CotAB | ECL3.DAX | 292 | `d398425b823e382f9f054154ffee31b84548e2b54b1738cb3171a24b1095f027` |
| CotAB | ECL4.DAX | 365 | `50cb04ee31b706c5533e0f41a5493e5919d62cdd8786220874ddde82b285344d` |
| CotAB | ECL5.DAX | 364 | `a52dae5bbbb6c84aebd25fbdbd6d7e5b85d2ce23dc0dd009e33702ad20c074f1` |
| CotAB | ECL6.DAX | 292 | `7c71b5964dbe69b2e260e19b9be36f24154acab9fb0caff9ac271be3631da836` |
| CotAB | GEO2.DAX | 216 | `c1f9b79ef0668a73fd4f49c031a7219919a18e7627080452b8d2cd707e7b1d7c` |
| CotAB | GEO3.DAX | 219 | `87f3a5cad9cdbd53bbc07b22b517c6cdef6d67bf4e2d2b14c9fb0a284c84432e` |
| CotAB | GEO4.DAX | 219 | `a0e3421c7ddfab6ec1f6f4a57b39e105e1df1672d06cedf6cff59da87b97c94b` |
| CotAB | GEO5.DAX | 219 | `e8478e1f3dca14e6f12eb6ed12b2551aac3c6d30d48aaeb8af38610085bc5829` |
| CotAB | GEO6.DAX | 292 | `7cd91bd93ade023b1d06492f406b9b30fa8db4e08ad930f22caaa2a9695647b3` |
| CotAB | HEAD2.DAX | 721 | `2de8f00c5cd5f38b59958dc0d8eb0da76b34b9b2fadf1f2ac44887214c276727` |
| CotAB | HEAD3.DAX | 656 | `248d2d3abbf9dea18536c8d0d3a6358d3787a189fceec3ac5ca6aae78fb8ebfd` |
| CotAB | HEAD4.DAX | 730 | `90cbc98c25e3393fb2ee9400a91d5c274d124e95b8e6b3d98b4cceae19d34ebc` |
| CotAB | HEAD5.DAX | 437 | `50358c645926d1caf86af92e0cdfb888e0d490332d2c0375576d7613a890bfc8` |
| CotAB | HEAD6.DAX | 365 | `e9c1d9d7e33ee5b16d749a37ec598db2706c185efa811199382cc89c276e9d4e` |
| CotAB | ITEM1.DAX | 72 | `6cf4845be09c232532efc1ebf8e8664c9531aff90dfef1a94c6579def984a770` |
| CotAB | ITEM2.DAX | 356 | `51ffa98e261e1ead8f201d1c65ab8f4427c719dff06b19df7b2f003cd95518cf` |
| CotAB | ITEM3.DAX | 144 | `38892f0b580250c04733d4e6cbecdf9a00cc51b30db82b2cf6e79d4614e76bae` |
| CotAB | ITEM4.DAX | 287 | `fa883efc5b0187ab04acdaaefc4b74ff964ccb49cc6002acd7ba685898fd7be1` |
| CotAB | ITEM5.DAX | 287 | `51924793ea6f2eee66599b357cf3a79105b608c2c8bd4c74c1db57ee694138dd` |
| CotAB | ITEM6.DAX | 216 | `fbe68f0a96ef8ce40a1e5b5a0b0a7f72ef7077655aebf7de7c1d1c078bfa09e5` |
| CotAB | MON1CHA.DAX | 1294 | `701aee6f2a25eb2f2802aa84368afd1992a2859fc1356966e3acf9c67e09f592` |
| CotAB | MON1ITM.DAX | 788 | `cbc5857c6caa29417fc954da706963ee447cbb63cad4ee3de2ab27ec5f67fe24` |
| CotAB | MON1SPC.DAX | 142 | `6e3b840720d5a960848a5b76fd534328d1cde6f593e8a34bd24e462cd27a6923` |
| CotAB | MON2CHA.DAX | 854 | `6aa386937fa4ddd810abac95d13f15f308e2b456100ca14ae4daa4dfd16a532c` |
| CotAB | MON2ITM.DAX | 497 | `7a2b1167e87028546b6a11229a5be1ec9b0e88c254ba4ddd2e14c255ca70c018` |
| CotAB | MON2SPC.DAX | 70 | `3a7ddd48b28d4712917a9008d61b927498e86530a2a4989f0e2120d1def50d86` |
| CotAB | MON3CHA.DAX | 1008 | `53acdc4913c38f56c3d5e2265043d08bbae73f1564ee02a04014e3fa340c9503` |
| CotAB | MON3ITM.DAX | 648 | `c492b296e144ff036dc906e050db95a59d6816209603c76651268e18fa912d8e` |
| CotAB | MON3SPC.DAX | 708 | `53e5239c25fc2570798a1b74cbbd05e0055683b7e17d6b04b966b0931a6d12ec` |
| CotAB | MON4CHA.DAX | 935 | `8be42a278f7542684d761ba4f6b4deaa37129fe62ae6a5f82e4e502d89204733` |
| CotAB | MON4ITM.DAX | 503 | `0d6f5a03b670c12d6872cad5b1bbc4f3569fa355f83874e626112879fc55cb83` |
| CotAB | MON4SPC.DAX | 355 | `7c73105d464f7d747bae2e438855e96a823c33d9cfc741036d859fc3f9f763cc` |
| CotAB | MON5CHA.DAX | 936 | `4663852f6fabd488456f6b177a9c9c470837850417dfa5955931402aa6cd4b3f` |
| CotAB | MON5ITM.DAX | 432 | `d12a2cdbee8f6f6d811b69716a013eb4c48a883be1795c5f2ace025139fa7cf0` |
| CotAB | MON5SPC.DAX | 849 | `5438fd394b03aa8189c96376c01babcb21c04e5d806cc136c9ba0196e1206af9` |
| CotAB | MON6CHA.DAX | 792 | `feafa9b1dbda7400f64a1745e35f4dfc4852cef13476d56cd68d41f0caeea72d` |
| CotAB | MON6ITM.DAX | 288 | `d96ef7536a97b7f4e82e558a498c28ef20916014405948338ae6ab2bacfcd205` |
| CotAB | MON6SPC.DAX | 637 | `777a02cf88089bfe2924d8b1da17d620859de9e2c32d8126b8289f1c4835ccce` |
| CotAB | PIC1.DAX | 219 | `d747ea62dbb384d5bc01fa5ebe199569253768c995909ba522465e8acc84ec5e` |
| CotAB | PIC2.DAX | 658 | `2af67941d42bb49e5c712457f1af76a059aebe783cfc8f1aa29eb57f3978fb52` |
| CotAB | PIC3.DAX | 658 | `5a68f6e69aca2c2e47366f92bbb3af925b5513af0685bc0240e4f426d5c3bd1b` |
| CotAB | PIC4.DAX | 881 | `3848221c2490f934c42c0aaf00af584dc956259b351757ea26915ae91e78de73` |
| CotAB | PIC5.DAX | 660 | `68c5408c0deae9de6ff591728156a9a0b3bfa8da4a5f12636dfdcdc22b41317a` |
| CotAB | PIC6.DAX | 1030 | `c7d4c7e5588bb89045959ffe31922b4d9adf38d476394058215475567e51ba2e` |
| CotAB | RANDCOM.DAX | 72 | `e80397fc11bfd7c88b026a9fbfc3a6fae29d4cdae042e2bd3625431dba08c467` |
| CotAB | SKY.DAX | 220 | `2f0679601c7480003c677aadbdcfe798e89231c1e4396c8b41b2470e1566b2b6` |
| CotAB | SPRIT1.DAX | 360 | `2ce5f3b73cc3a789fd14b7bbce201b11775fabadc188075311ded60ede06c812` |
| CotAB | SPRIT2.DAX | 360 | `78d3f0678f666425a728deb595b990cf8f1d3c5025f8e2694f4a128eb7e8bd90` |
| CotAB | SPRIT3.DAX | 511 | `02a13b51a0c07b2fb33c6c04d37ce984e201a5bb346e5f2eeb00d2b677ef01b1` |
| CotAB | SPRIT4.DAX | 1021 | `38b3dd4df732c6a87c8d25a51986cbc116dafa6a9f5f49f629e90cb3ec2455ca` |
| CotAB | SPRIT5.DAX | 584 | `c3f69b929bbd238561dcca6ce8b8a008599dcb3550abc1d720453723b0179d60` |
| CotAB | SPRIT6.DAX | 511 | `92d9fa82be3a12f37604d4e6975c5e654bba8fb0da52c42822d084c6709afbc7` |
| CotAB | TILES.DAX | 144 | `0e3ab23da097d418873d29b7faf9080540e4b251c76ef851d03a73baa0fb4f07` |
| CotAB | TITLE.DAX | 292 | `b27f9f14db3aff7d7c543590b83c6f52e1bb8794a8a2b555f16987d51c987e21` |
| CotAB | WALLDEF2.DAX | 284 | `06a98aacab8b1f98568eb3b4ac791e2737ee426d99ac828b8d439acacf1aa8de` |
| CotAB | WALLDEF3.DAX | 284 | `6b69085343680145cdbf84343dd7e7a480b89876e0b5b4106f84d4b07a29a363` |
| CotAB | WALLDEF4.DAX | 357 | `eb9f529615d25ca971e3345b1e67567fe6085b0fe9fa76b548a554db60fb2fbd` |
| CotAB | WALLDEF5.DAX | 216 | `fc301b6cf06dddac064ef914efd33e6d27dff49300dd3e5e2fde07b87443f1e7` |
| CotAB | WALLDEF6.DAX | 288 | `f2b88ad42a6225f016fc6544ac36bc2f8d9c9a3ae92db48bda3ad8c35bd1e8b2` |
| CotAB | WILDCOM.DAX | 72 | `8f1b7991fb50303904dcdacf2f14e064ecbe1234a1897dd5171e2135b49ea636` |
<!-- /generated:hashes -->
