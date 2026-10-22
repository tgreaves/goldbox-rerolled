# SotSB records and save files (diff against CotAB `coab/records.md`)

> **Status: first pass (2026-10-22).** Part A of the [specification](../../README.md): Secret of the
> Silver Blades, GOG 1.0. Read [coab/records.md](../coab/records.md) first (and through it
> [engine/records.md](../engine/records.md), [engine/savegame.md](../engine/savegame.md)). Evidence
> marks as in the spec README: **O** read in the SotSB binary or confirmed byte for byte in the shipped
> data; **I** inferred (data plausibility, the CotAB analogy); **?** open. Addresses are offsets in the
> working image `img.bin` ([README.md](README.md), "Working image"); DS = paragraph 0x0DE2, so `DS:x` =
> image 0xDE20 + x.

The key to this file is SotSB's own **CotAB → SotSB character converter**, the routine 0x405E3 nested in
the character loader 0x40F0C (called at 0x410DC on the "Curse" branch of "Add from where? Secret
Curse Exit", 0x3C645): it clears a 0x1B7-byte record (0x405F3) and moves each CotAB field to its SotSB
place, one `mov`/`Move` per field. Every row below with a CotAB column is **O** from that routine;
the other rows are settled by readers in the code or by the shipped data.

Key routines (O):

| Routine | Address | CotAB equivalent |
|---|---|---|
| Load game ("Load Which Game: ") | 0x419DD | `323c:37b5` |
| Save game | 0x421CB | `323c:3f5e` |
| Save one character (record 0x1B7, items 0x43, effects 9) | 0x3FFC6 | `323c:0dfc` |
| Load / import one character (SotSB or CotAB) | 0x40F0C | `323c:22a0` |
| CotAB record → SotSB record (nested in 0x40F0C) | 0x405E3 | `323c:14b3` (PoR → CotAB) |
| Delete roster files `NAME.who/.stf/.sfx` | 0x3FE53 | `323c:0c90` |
| Roster lists `*.who` (Secret), `*.guy` (Curse) | strings at 0x3F5AD | `323c:0465` |
| A 63-byte item from `ITEM<n>.DAX` into a 67-byte record (I: the `TREASURE` handler) | 0x1FA40 | `1885:1c84` |
| The vault (`vault.dat`) | 0x21CA0 | — |

---

## 1. Files

| | CotAB | SotSB |
|---|---|---|
| Roster character | `<stem>.GUY` (422) + `.SWG` (items, 63) + `.FX` (effects, 9) | `<stem>.WHO` (439) + `.STF` (items, **67**) + `.SFX` (effects, 9) (O: extension strings 0x3FE44–0x3FE52; sizes at 0x403B7, 0x4047D, 0x405B9) |
| Party in save slot x | `CHRDAT<x><n>.SAV/.SWG/.FX` | `CHRDAT<x><n>.SAV/.STF/.SFX` (O: `CHRDAT` 0x421C5, `.sav` 0x3FF41) |
| Saved game | `SAVGAM<x>.DAT`, 13 149 bytes | `SAVGAM<x>.DAT`, **5 469** bytes (§4) |
| Party storage | — | `vault.dat` (§5) |
| CotAB characters | — | read from CotAB's `*.guy` (the "Curse" choice, §6) |

The shipped pre-made party is `CHRDATA1–6.SAV` with `.SFX` for members 1, 2 and 4 and no item files:
they start without equipment (O, the files present).

## 2. Character record: 0x1B7 = 439 bytes

The same record for party members, NPCs and monsters (all 70 `MON1CHA` records and the six
`CHRDATA?.SAV` are 439 bytes, O).

| SotSB | Size | Field | CotAB | Ev. |
|---|---|---|---|---|
| 0x00 | 16 | name, Pascal string[15]; the converter trims trailing spaces and a leading space (0x40604–0x406B9) | 0x00 | O |
| 0x10 + 2i, 0x11 + 2i | 1, 1 | base, current stat i (STR INT WIS DEX CON CHA) | same (`Move` 12, 0x406DD) | O |
| 0x1C, 0x1D | 1, 1 | current, base exceptional STR % | same | O |
| 0x1E–0x68 | 75 | memorised spells (loops to 0x4A over +0x1E) | 0x1E–0x71 (84) | O (loop bound) / I (meaning as CotAB); not converted |
| 0x69 | 1 | hours left to finish learning (decremented hourly, 0x47563) | 0x72 | O; not converted |
| 0x6A | 1 | 60 − base THAC0 | 0x73 | O |
| 0x6B | 1 | race, **renumbered** (below) | 0x74 | O |
| 0x6C | 1 | class (PoR/CotAB table, DS:0B8B, 27 bytes each: Cleric … Monk, then the multi-classes) | 0x75 | O |
| 0x6D | 1 | the paladin's Cure Disease uses: set 1 for a paladin on import (0x4101C, 0x41143) and at creation (0x39FF0), tested and decremented when used (0x4670F, 0x46719) | 0x191 | O |
| 0x6E | 2 | age | 0x76 | O |
| 0x70 | 1 | max HP | 0x78 | O |
| 0x70 + id | 1 × 100 | spells known, byte[0x70 + id] = 1, ids 1–100; the converter copies only ids 1–35, 37–55, 57–62, 64–89, 91–95, 97, 99 and 44, and clears the rest (0x407F8–0x40883) | 0x78 + id | O |
| 0xE6 | 1 | sweep target limit | 0xDD | O |
| 0xE7 | 1 | size/type flags | 0xDE | O |
| 0xE8–0xEC | 5 | saving throws | 0xDF | O |
| 0xED | 1 | base movement | 0xE4 | O |
| 0xEE | 1 | hit dice / highest level | 0xE5 | O |
| 0xEF | 1 | level at the dual-class change | 0xE6 | O |
| 0xF0, 0xF1 | 1, 1 | levels and max HP lost to energy drain | 0xE7, 0xE8 | O |
| 0xF2 | 1 | undead type (12 readers, `cmpb $0`) | 0xE9 | I; not converted |
| 0xF3–0xFA | 8 | thief skills % | 0xEA | O |
| 0xFB | 4 | effect list head (cleared on import, 0x41035) | 0xF2 | O |
| 0xFF | 1 | morale; ≥ 0x80 = NPC | 0xF7 | O |
| 0x100 | 1 | NPC treasure share | 0xF8 | O |
| 0x101, 0x102 | 1, 1 | `misc86`, `misc87` (0x101 is tested against 3 and 4 on import, with the paladin and ranger levels, 0x41002, 0x410ED: ?) | 0xF9, 0xFA | O (copy) / ? |
| 0x103 | 2 × 7 | money cp sp ep gp pp gems jewelry (loops 0–6 over +0x103) | 0xFB | O (loop) / I; **not converted** |
| 0x111–0x117 | 7 | class levels Cleric Druid Fighter Paladin Ranger Magic-User Thief: **no monk** | 0x109 (8) | O (`Move` 7, 0x409FD) |
| 0x118–0x11E | 7 | previous class levels (dual-class) | 0x111 | O (`Move` 7) |
| 0x11F | 1 | gender | 0x119 | O |
| 0x120 | 1 | alignment | 0x11B | O |
| 0x121, 0x122 | 1, 1 | attacks per round × 2, hands | 0x11C | O |
| 0x123/0x124, 0x125/0x126, 0x127/0x128 | | natural attacks, hands 1/2: dice count, sides, bonus | 0x11E–0x123 | O |
| 0x129 | 1 | base 60 − AC | 0x124 | O |
| 0x12A | 1 | STR adjustments apply | 0x125 | O |
| 0x12B | 1 | id (picture `CPIC`) | 0x126 | O |
| 0x12C | 4 | experience | 0x127 | O |
| 0x130 | 1 | class mask for item use | 0x12B | O |
| 0x131 | 1 | rolled HP without CON bonus | 0x12C | O |
| 0x132–0x138 | 7 | cleric spell slots, levels 1–7 (the converter fills 1–5) | 0x12D–0x131 | O |
| 0x139–0x13F | 7 | druid spell slots (PAINE, a ranger 8, has one first-level slot) | 0x132–0x136 | O |
| 0x140–0x146 | 7 | a third slot array, not converted, empty in every pre-made character | — | ? |
| 0x147–0x14D | 7 | magic-user spell slots | 0x137–0x13B | O |
| 0x14E | 2 | XP award base (monsters) | 0x13C | O |
| 0x150 | 1 | XP per HP | 0x13E | O |
| 0x151, 0x152 | 1, 1 | portrait head, body | 0x13F, 0x140 | O |
| 0x153, 0x154 | 1, 1 | combat icon head, body/weapon | 0x141, 0x142 | O |
| 0x155 | 1 | combat icon slot (the pre-mades hold 0–5, their order in the party; not converted) | 0x143 | O (data) / I |
| 0x156 | 1 | icon size | 0x144 | O |
| 0x157–0x15C | 6 | icon colours | 0x145 | O |
| 0x15D | 1 | monster-class flags (read in the effect handlers' range) | 0x14B | I |
| 0x15E, 0x15F | 1, 1 | ? (0x15E has six readers; 0x15F none found) | — | ? |
| 0x160 | 1 | item count (tested against 0x10 and 0x0F) | 0x14C | O |
| 0x161 | 4 | item list head (cleared on import, 0x41026) | 0x14D | O |
| 0x165 + 4·s | 4 × 13 | readied items: slots 0–8, rings 1 and 2, arrows, quarrels (`Move` 0x34, 0x40CF5) | 0x151 | O |
| 0x199 | 1 | hands in use | 0x185 | O |
| 0x19A | 1 | save bonus from items | 0x186 | O |
| 0x19B | 2 | encumbrance | 0x187 | I; not converted |
| 0x19D | 4 | next record (cleared on import) | 0x189 | O |
| 0x1A1 | 4 | combat record pointer (cleared on import) | 0x18D | O |
| 0x1A5 | 1 | ? | — | ? |
| 0x1A6 | 1 | status | 0x195 | O |
| 0x1A7 | 1 | in play | 0x196 | O |
| 0x1A8 | 1 | side | 0x197 | O |
| 0x1A9 | 1 | computer-controlled / quick (26 readers) | 0x198 | I; not converted |
| 0x1AA | 1 | 60 − THAC0, current | 0x199 | O |
| 0x1AB, 0x1AC | 1, 1 | 60 − AC front, rear | 0x19A, 0x19B | O |
| 0x1AD, 0x1AE | 1, 1 | attacks left, hands 1/2 | 0x19C | O |
| 0x1AF–0x1B4 | 6 | current damage, hands 1/2: count, sides, bonus | 0x19E–0x1A3 | O |
| 0x1B5 | 1 | current HP | 0x1A4 | O |
| 0x1B6 | 1 | movement | 0x1A5 | O |

Not carried over from CotAB (O, not moved by the converter, and no SotSB place found): `misc83`
(CotAB 0xF6), the monster type (0x11A), the monk level (0x110) and its previous level (0x118), the
Hillsfar flag (0x192).

**Race** (DS:0D71, 9 bytes each, O): 0 Tribble, 1 Elf, 2 Half-Elf, 3 Dwarf, 4 Gnome, 5 Halfling, 6
Human, 7 Monster. There is no half-orc. The converter renumbers CotAB's races (PoR's table): dwarf 1
→ 3, elf 2 → 1, gnome 3 → 4, half-elf 4 → 2, halfling 5 → 5, human 7 → 6, half-orc 6 and 0 → 7
(0x40727–0x407AE).

**After the conversion** (O, 0x40E60–0x40EB8): base STR is lowered to the race and sex maximum
`DS:4D9F[16·race + gender]` when above it. (CotAB's own PoR import wrote that cap into base STR, its
bug, IMP-070; SotSB clamps.) Then current HP, movement. On the Curse branch the loader then adds
effect 0x69 to a ranger (ranger level > 0, or +0x101 = 4 and `164:57`) and effect 8 to a paladin
(paladin level > 0, or +0x101 = 3 and `164:57`), setting +0x6D := 1 (0x410DF–0x4115A).

### 2.1 The pre-made party (`CHRDATA1–6.SAV`, O)

| # | Name | Race / class | Levels | Max HP | XP | `.SFX` |
|---|---|---|---|---|---|---|
| 1 | Guy de Valois | Human paladin | 8 | 95 | 200 000 | 0x08 |
| 2 | PAINE | Human ranger | 8 | 74 | 200 000 | 0x69 |
| 3 | EPONA | Human fighter | 8 | 91 | 200 000 | — |
| 4 | MALACHITE | Dwarf fighter/thief | 7/8 | 58 | 100 000 | 0x2F, 0x1A, 0x61 |
| 5 | DOMINIC | Human cleric | 8 | 78 | 200 000 | — |
| 6 | MORGAINE | Human magic-user | 9 | 35 | 200 000 | — |

No member carries items or (but MALACHITE's 4 gp) money; nobody has spells memorised.

## 3. Items and effects

- **Item record: 67 bytes (0x43) in memory and in `.STF` files** (O, 0x4047D), CotAB's 63 plus a
  far pointer at **+0x3F**. The data files keep 63-byte records (`ITEM1–3.DAX`, `MON1ITM.DAX`: every
  record a multiple of 63, O); the item loader (0x1FA40, I: `TREASURE`) moves 63 bytes into a 67-byte record and clears +0x2A (next)
  and +0x3F (0x1FA54–0x1FA6A). Next pointer +0x2A, type +0x2E, count +0x39 as CotAB (O).
- **+0x3F**: a second chain. The character saver writes, after an item of type 0x49 (arrows), as many
  further 67-byte records as its count, following +0x3F (0x40486–0x404EC) (O for the writes; I that
  each arrow of a stack is its own record).
- **Effects** (`.SFX`): CotAB's 9-byte record unchanged: `u8 type, u16 duration, u8 power, u8 flag,
  ptr next` (O, 0x405B9; the shipped files decode so).
- `ITEMS` is 2 050 bytes as in PoR and CotAB (its contents not compared yet, ?).

## 4. `SAVGAM<x>.DAT`: 5 469 bytes

Written by 0x421CB, read by 0x419DD in the same order (O, each BlockWrite and BlockRead):

| Offset | Size | Content | vs CotAB |
|---|---|---|---|
| 0 | 1 | block digit `DS:7420` | same (CotAB `DS:5C08`) |
| 1 | 0x800 | ECL word array A (far ptr `DS:67C6`) | same |
| 0x801 | 0x800 | array B (`DS:67CA`) | same |
| 0x1001 | 0x400 | array C (`DS:67CE`) | same |
| — | — | **no ECL code buffer** | CotAB stores 0x1E00 bytes here |
| 0x1401 | 5 | `DS:89D7..89DB`: X, Y, facing, wall, square (I: as CotAB) | same |
| 0x1406 | 1 | previous game state `DS:67E8` | same |
| 0x1407 | 1 | game state `DS:67E7` | same |
| 0x1408 | 12 | 3 × (u16 wall-set record id `DS:89D8+4i`, u16 slot `DS:89DA+4i`), i = 1..3 | same |
| 0x1414 | 1 | party count | same |
| 0x1415 | 8 × 41 | member stems, Pascal string[40], `CHRDAT<x><n>` | same |

5 469 = 13 149 − 0x1E00 (O). Before writing: A[0x1F8] := `DS:67D6` (speed), A[0x1FE] := `DS:67ED`
+ 2·`DS:67EB`, B[0x624] := the block digit (O, 0x42413–0x42443); loading undoes them and sets B[0x67C]
:= 0 (0x41D8A–0x41DBE), as CotAB. Without the code buffer, the area's script is loaded again from
its `ECL<n>.DAX` record on load (I: not traced).

## 5. The vault (`vault.dat`)

A party store in the game folder (O, 0x21CA0–0x221A0; menu "View Take Pool Exit", 0x21C3B; "left in
the vault … will be gone forever", 0x43A56): 0x1C bytes from `DS:87AC`, seven u32 coin counts (I:
the order of the character's coins), then a list of 67-byte item records from the head `DS:87CE`.

## 6. Importing CotAB characters

"Add from where? Secret Curse Exit" (0x3C645): **Secret** lists SotSB's roster `*.who`, **Curse**
CotAB's `*.guy` (0x3F5AD). A CotAB record (0x1A6 bytes read, 0x41067) goes through the converter
0x405E3 (§2). The image has no `.swg` or `.fx` name, so a CotAB character's items and effects are
not read (O: no such strings); money, memorised spells, encumbrance and the quick flag start at 0.

## 7. Monsters

`MON1CHA.DAX` (70 records of 439 bytes), `MON1ITM.DAX` (items, multiples of 63), `MON1SPC.DAX`
(effects, multiples of 9): one monster block where CotAB had six (O, the DAX headers). The loader
and the NPC join were not traced (?).

## 8. The profile's field map (draft)

For `web/src/games/fields.ts`, in CotAB's keys (*informative*; the values are the table above):

```ts
// SotSB: 439-byte record (spec/A-games/sotsb/records.md §2)
size: 0x1b7, name: 0x00, stat: range(0x11, 2), baseStat: range(0x10, 2), strPct: 0x1c, baseStrPct: 0x1d,
memorised: 0x1e, memorisedCount: 75, studyHours: 0x69, thac0Base: 0x6a, race: 0x6b, cls: 0x6c, age: 0x6e,
maxHp: 0x70, known: 0x70, knownCount: 100, sweep: 0xe6, sizeFlags: 0xe7, saves: 0xe8, baseMove: 0xed,
hitDice: 0xee, hpLevel: 0xef, abilityUses: 0x6d, classFlags: 0x15d, drainLevels: 0xf0, drainHp: 0xf1,
undead: 0xf2, thief: 0xf3, effects: 0xfb, misc83: -1, misc86: 0x101, misc87: 0x102, morale: 0xff,
npcShare: 0x100, money: 0x103, levels: 0x111, prevLevels: 0x118, gender: 0x11f, monsterType: -1,
alignment: 0x120, attacksBase: 0x121, natDice: 0x123, natSides: 0x125, natBonus: 0x127, acBase: 0x129,
strAdj: 0x12a, id: 0x12b, xp: 0x12c, itemMask: 0x130, hpRolled: 0x131, clericSlots: 0x132,
druidSlots: 0x139, muSlots: 0x147, slotLevels: 7, xpBase: 0x14e, xpPerHp: 0x150, head: 0x151,
body: 0x152, iconHead: 0x153, iconBody: 0x154, iconSlot: 0x155, iconSize: 0x156, iconColours: 0x157,
itemCount: 0x160, items: 0x161, readied: 0x165, hands: 0x199, saveBonus: 0x19a, load: 0x19b,
next: 0x19d, combat: 0x1a1, status: 0x1a6, inPlay: 0x1a7, side: 0x1a8, quick: 0x1a9, thac0: 0x1aa,
ac: 0x1ab, acRear: 0x1ac, attacksLeft: 0x1ad, dice: 0x1af, sides: 0x1b1, bonus: 0x1b3, hp: 0x1b5,
move: 0x1b6,
```

The profile needs beyond CotAB's: 7 class levels (no monk), 7 spell levels and the third slot array
at 0x140 (?), the item record size 67 with the +0x3F chain (the port keeps 63 today), the files
`.WHO`/`.STF`/`.SFX`, a save without the code buffer, the vault, and the CotAB import (the converter
above, as data like `games/imports.ts`).

## Open

- The third spell-slot array 0x140–0x146 and the fields 0x15E, 0x15F, 0x1A5; whether 0x15D is the
  monster-class flags.
- +0x101's meaning (tested against 3 and 4 with the paladin and ranger on import).
- The +0x3F item chain's purpose beyond arrows.
- The area script's reload after loading a save (no code buffer in the file).
- The monster loader, the NPC join, random treasure and the joining rules: not traced in this pass.
- `ITEMS`: its 16-byte records against CotAB's.
