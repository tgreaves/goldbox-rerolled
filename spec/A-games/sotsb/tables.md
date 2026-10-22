# SotSB rules tables vs Curse of the Azure Bonds

> **Status: first pass (2026-10-22): addresses and strides of CotAB's table set.** Normative, except
> passages marked *informative*. Part A of the [specification](../../README.md): Secret of the Silver
> Blades (GOG 1.0). Read [coab/tables.md](../coab/tables.md) first: this file gives the differences
> from it. Evidence marks as in the README (**O**: the code that indexes the table, found by the same
> instruction pattern as CotAB's reader, plus the data; **I**: a data match, or the layout around it,
> without the reader traced). Addresses are DS offsets in the working image
> ([README.md](README.md#working-image)): **DS = paragraph 0x0DE2 = image 0xDE20**; "Ref" is an image
> offset. Each table's address, stride and reading rule are normative; the values are informative (D5)
> and are described here only as far as the rules need.

## 1. How the tables were found (informative)

Two searches over the working image, against CotAB's (DS 0xABE0): the first bytes of each CotAB table
searched for in SotSB's data segment; and each CotAB instruction that indexes a table (its opcode and
operand bytes, the 16-bit displacement a wildcard) searched for in SotSB's code, which gives the
displacement SotSB uses. Where both agree the table is **O** once the reader is read; a data match
alone is **I**. Most tables kept CotAB's order in the data segment, moved by a constant within a block:
the names block by about −0x12D, the rules block (THAC0 … saves) by about +0xDD2, but with gaps where a
table grew.

## 2. Address mapping

| Table (part B name) | CotAB DS | SotSB DS | Stride / form | Ref (SotSB) | Ev | Difference |
|---|---|---|---|---|---|---|
| `thac0` | 3E3A | **4C0C** | 19 bytes a class (CotAB 13) | 0x3A233 (`mov $0x13,%dx; mul`) | O | levels to 18: the cleric row goes on to 48, 48, 48, 50, 50, 50 |
| `classBits` | 3EA2 | **4C92** | 7 bytes (CotAB 8) | 0x3A27A, 0x56B37 | O | no monk entry |
| `trainerBits` | 3EAA | **4C99** | by class | 0x3DA71 | O | follows `classBits` directly; one entry fewer than CotAB's (the monk's, **I**) |
| `hitDiceCount` | 081A | **09B0** | 7 bytes (CotAB 8) | 0x3DABB | O | cleric 2, ranger 2, the rest 1 (CotAB cleric 1, **I**: what 2 means at level 1 is not traced) |
| `hitDiceSides` | 0822 | **09B7** | 7 bytes | 0x3DACC, 0x3DAE3 | O | d8 d8 d10 d10 d8 d4 d6, CotAB's without the monk |
| `hitDiceStop` | 3EBB | **4CA9** | 7 bytes | 0x3D89A, 0x3D99C, 0x3DA85 | O | CotAB's values (10, 15, 10, 10, 11, 12, 11) without the monk's 19 |
| `thiefBase` | 3EC0 | **4CAD** | 1-based, as CotAB's | (2 context matches) | O | CotAB's values |
| `thiefRace` | 3F20 | **4D3D** | | (2 context matches) | O | |
| `thiefDex` | 3F33 | **4D48** | row 5 | 0x57284 (`mov $5,%dx; mul`) | O | |
| `raceLimits` | 3F88 | **4D9D** | 16 bytes a race, 1-based | (6 context matches) | O | the rows of CotAB's races in SotSB's race order (§3); no Half-Orc row |
| `raceClasses` | 3FFA | **4DFF** | 14 bytes a race, 1-based | 0x39E98, 0x39F89, 0x57440, 0x576A0 | O | the same classes per race as CotAB's, renumbered (§3) |
| `startAge` | 404E | **4E45** | 0x1C | (6 context matches) | O | one race fewer before it |
| `ageing` | 4124 | **4EFF** | 10 | (2 context matches) | O | |
| `classMins` | 4174 | **4F45** | 6 | (14 context matches) | O | |
| `alignments` | 41DA | **4FAB** | 10 | 0x3A322, 0x3A3F9, 0x57537 | O | |
| `conHp` | 4281 | **5052** | | (1 context match) | I | CotAB's values |
| `xp` | 4293 | **5064** | **0xBB** bytes a class (CotAB 0x63), u32 by level | 0x3DF51 (`mov $0xbb,%dx; mul`, index (level + 1) × 4) | O | caps at **15** for cleric, fighter, paladin, ranger and magic-user (the "cannot reach" 0xFFFFFFFF from level 16; CotAB 10–12); the thief's entries finite to level 18 and 0 from level 19, which training refuses (0x3DF51–0x3DF64: the next level's entry 0 or below cannot be trained to), so the thief reaches 18 (O; the demi-human limits by race, class and prime requisite are a separate test, 0x3DE79–0x3DEF3); `levels` 19 (**I**, as THAC0) |
| `clericSlots` | 42BC | **50A1** | **7** bytes a level (CotAB 5), increments | 0x56D44 (`mov $7,%dx; mul`) | O | to cleric spell level 6 (first at level 11) |
| `paladinSlots` | 43E5 | **52D2** | 7 | 0x5679C (from level 9, as CotAB) | O | |
| `rangerSlots` | 4448 | **538D** | 7: druid columns 1–3, magic-user 4–5 | 0x56854, 0x56892 | O | |
| `muSlots` | 44AB | **5448** | 7 | 0x56960 (from level 2) | O | to magic-user spell level 7 (first at level 14) |
| `startGold` | 45B3 | **5589** | | | I | CotAB's dice |
| `saves` | 45BE | **5592** | **0x5A** bytes a class (CotAB 0x3C): 18 levels × 5 | 0x56F41 (`mov $0x5a,%dx; mul`) | O | the cleric row goes on to 5, 8, 9, 11, 10 and 4, 7, 8, 10, 9 |
| `raceNames` | 0E9E (10) | **0D71** | **9** bytes | (3 context matches) | O | new order (§3) |
| `classNames` | 0CB8 | **0B8B** | 27 | (7 context matches) | O | the same 17 names (Monk kept) |
| `alignmentNames` | 0EEE | **0DB9** | 17 | | I | |
| `statusNames` | 0FE2 | **0EAD** | 13 | | I | status 7 reads "Petrified" (CotAB "Stoned") |
| `genderNames` | 0F87 | **0E52** | 7 | | I | |
| `coinNames` | 0F95 | **0E60** | 11 | | I | |
| `coinValues` | 0CA4 | **0B40** | u32 | | I | CotAB's values |
| `templeNames` | 00E6 | **014C** | 41 | | I | the same ten services and Exit |
| `diseases` | 00DF | **1B3D** | 1-based, **4** entries (`diseaseCount`) | 0x226AC, 0x22721, 0x229AC, 0x229CD; Fix 0x3886B, 0x38C21 | O | not at the temple names' head as in CotAB: 31, 34, 43, 44, CotAB's six without 50 and 57 (which in CotAB are the Hot Fire Shield and engulf); Fix's Heal and Cure Disease remove them |
| `spellNames` | 27E8 (41) | **34AE** | **35** bytes | | I | ids to **116** (CotAB 100); unused ids are named "spell *n*" |
| `spellRecords` | 37DC | **449D** | 16 (`shl 4`) | 0x36676, 0x36E3D, 0x371EF | O | byte 1 the level: to 7; byte 0 (the spell class) takes other values than CotAB's (**?**) |
| `itemWords` | 1057 | **0F22** | 21 | | I | |
| `sky` | 0A8A | **0AA8** | | | I | CotAB's values |
| `viewPieces` | 0ADA | **0AD8** | | | I | |
| `fanDx2`, `fanDy2`, `fanDx1`, `fanDy1` | 0A12, 0A1A, 0A22, 0A2A | **0A0A, 0A12, 0A1A, 0A22** | 8 each | | I | |
| `wallDx`, `wallDy` | 2696, 269F | **1A90, 1A99** | | (56 context matches) | O | |
| `battleCells` | 26A4 | **1A9E** | 4 | (15 context matches) | O | |
| `gasCloud`, `killCloud` | 27D9, 27DD | **349F, 34A3** | | (11, 7 context matches) | O | |
| `furnishDx`, `furnishDy` | 034B, 034F | **03BF, 03C3** | | | I | at the same distance after the placement tables as in CotAB |
| `placeRing` … `placeAllow` | 02DC–0310 | **0350, 0360, 0370, 0374, 037C, 0384** | as CotAB | 0x2C24D, 0x2C26C (`placeAllow`, row 12) | O | CotAB's values |
| `frameTop` … `frameDivider` | 0B50–0C0B | absent | | 0x19D0, 0x1A90 | O | none: the frame routines draw fixed tiles ([assets.md §5](assets.md#5-fonts-tiles-frames)); the profile's `view.frame` is `bars` |
| `cursorX`, `cursorY`, `placeTerrain` | 0A4A, 0A6A, 0354 | absent | | | I | none: SotSB has no overland map picture (no BIGPIC #121, [assets.md §3](assets.md#3-bigpic-and-picture-o)) and no wilderness battlefields (no WILDCOM), which these serve |
| `randomItems` | 082E | **0A28** | u16 words, record *m* from word *m* (7 records, *m* = 1 + 8*j*) | 0x4FE65, 0x4FE9A, 0x4FEB9, 0x4FEE2 (the builder's copy) | O | the PoR form; [records.md §3.1](records.md#31-random-treasure-items-o-type-choice-0x1fb2f0x1fe2b-builder-0x4f6d2) |
| `scrollSpells` | – | **580C** | bytes: the cleric lists at +0x00 … +0x32, 10 a level, the magic-user lists at +0x50 … +0x92, 11 a level; entry 1 at offset + 1 | 0x4FC38 … 0x4FDA5 | O | new: PoR and CotAB compute a scroll's spell id (d*s* + offset) |

Tables CotAB had absent (`npcHeads`, the NPC bodies, `headRecords`, `bodyRecords`, `overlandMap`,
`overlandSpecials`, `overlandColumns`) are not looked for here.

## 3. Rule differences seen in the tables

- **Seven base classes in the rules tables** (**O**: the hit-point routine's class loop runs 0–6, 0x3D8DD
  … 0x3DA05): cleric, druid, fighter, paladin, ranger, magic-user, thief. The class-bits, hit-dice and
  stop-level tables have no monk entry, while the class-name table still lists Monk.
- **Races renumbered, no Half-Orc** (**O** for the tables, **I** for the record's race byte): the name
  table reads 0 a placeholder ("Tribble"), 1 Elf, 2 Half-Elf, 3 Dwarf, 4 Gnome, 5 Halfling, 6 Human,
  7 Monster; the race-limit and race-class rows follow that order and are CotAB's rows of the same races.
- **Higher levels**: experience to level 15 for the five capped classes, THAC0 and saves to level 18.
- **Spell levels**: slot rows of 7; cleric spells to level 6, magic-user to 7; spell ids to 116, among
  them Heal, Harm, Barkskin, Charm Person or Mammal and, from 109, Death Spell, Disintegrate, Globe of
  Invulnerability, Stone to Flesh, Flesh to Stone, Delayed Blast Fireball, Mass Invisibility, Power Word
  Stun.
- Money, coin values, the starting money dice, the temple's services and CON hit points are CotAB's.

## 4. Draft table map (informative)

The profile's map as the evidence above gives it; `?` entries are not found yet.

```ts
export const SOTSB_TABLES_DRAFT = {
  ds: 0xde20,
  classBits: t(0x4c92), trainerBits: t(0x4c99), hitDiceCount: t(0x09b0), hitDiceSides: t(0x09b7), hitDiceStop: t(0x4ca9),
  raceNames: t(0x0d71, 9), classNames: t(0x0b8b, 27), alignmentNames: t(0x0db9, 17), statusNames: t(0x0ead, 13),
  genderNames: t(0x0e52, 7), coinNames: t(0x0e60, 11), coinValues: t(0x0b40, 4),
  templeNames: t(0x014c, 41), diseases: t(0x1b3d) /* 4 entries */, randomItems: t(0x0a28), scrollSpells: t(0x580c), sky: t(0x0aa8),
  itemWords: t(0x0f22, 21), wallDx: t(0x1a90), wallDy: t(0x1a99), battleCells: t(0x1a9e, 4),
  spellNames: t(0x34ae, 35), spellRecords: t(0x449d, 16),
  thac0: t(0x4c0c, 19), thiefBase: t(0x4cad, 8), thiefRace: t(0x4d3d, 8), thiefDex: t(0x4d48, 5), raceLimits: t(0x4d9d, 16),
  raceClasses: t(0x4dff, 14), startAge: t(0x4e45, 0x1c), ageing: t(0x4eff, 10), classMins: t(0x4f45, 6), alignments: t(0x4fab, 10),
  conHp: t(0x5052), xp: { at: 0x5064, row: 0xbb, levels: 19 }, clericSlots: t(0x50a1, 7), muSlots: t(0x5448, 7),
  paladinSlots: t(0x52d2, 7), rangerSlots: t(0x538d, 7), startGold: t(0x5589, 2), saves: t(0x5592, 0x5a),
  fanDx1: t(0x0a1a), fanDy1: t(0x0a22), fanDx2: t(0x0a0a), fanDy2: t(0x0a12),
  gasCloud: t(0x349f), killCloud: t(0x34a3), furnishDx: t(0x03bf), furnishDy: t(0x03c3), viewPieces: t(0x0ad8),
  placeRing: t(0x0350, 4), placeOrient: t(0x0360, 4), placeVec: t(0x0370), placeOriginX: t(0x0374), placeOriginY: t(0x037c), placeAllow: t(0x0384, 12),
  // absent: frameTop … frameDivider (fixed tiles), cursorX, cursorY, placeTerrain (no overland)
}
```

## 5. Pointers for the procedures (informative)

Seen on the way, for the rules research to follow:

- The hit-point routine (around image 0x3D880) reads the levels at character **+0x111** (CotAB +0x109)
  and maximum HP near +0x1B5; the slot routine (0x56770–0x56D50) adds into pools at **+0x131, +0x138,
  +0x146** (CotAB +0x12C …): the record moved ([README.md](README.md), the 439-byte record).
- Slots stay CotAB's model (summed increments from a start level; paladin rows from 9, the ranger's split
  between the druid and magic-user pools), with seven spell levels a row.
- Caster level, dual-classing and the WIS bonus routine are not read yet.

## Open

- Byte 0 of the spell records (the spell class) and the meaning of `hitDiceCount`'s cleric 2.
- Each **I** row's reader.
