# CotAB rules tables vs the PoR port

Curse of the Azure Bonds (GOG 1.0), unpacked load image `coab/img.bin`. Script: `agents/tables_coab.py` (prints every table below, with PoR's values beside them where they exist; full output in `agents/tables_out.txt`). Helpers: `agents/xref.py c|p ADDR[-ADDR]` (operand cross-references from `full.dis`), `agents/ctx.sh c|p ADDR` (disassembly around an address).

Evidence: **O** = seen in the CotAB binary (the code that indexes the table plus the data); **I** = inferred (data match, naming, or the reference rebuild used only as a pointer and then checked in the data); **?** = not verified.

## 1. Data segment

- **O** CotAB is Turbo Pascal. The entry point (image 0x2F) starts with `lcall 08F7:0000`, the System unit's init. At image 0x8F70 that init does `mov dx,0ABEh; mov ds,dx`. So **DS = paragraph 0x0ABE = image 0xABE0** (PoR: 0x0C7C = image 0xC7C0). `find_ds()` in the script checks this.
- **O** The reference listing's `seg600:xxxx` offsets equal these DS offsets (`aBless` at seg600:27E8 is the "Bless" string at DS:27E8). Its `unk_1xxxx` names are DS offset + 0x16310.
- Initialised data runs to about DS:47EA (System variables start there). Above that is BSS, i.e. runtime variables. The PoR port's runtime addresses (DS:49xx, 5Dxx, 67xx–6Fxx, 84xx) are **not tables** and are not mapped here.
- Watch for `push cs; mov di,imm` string arguments in the disassembly: those are code-segment strings, not DS (for example 32eb1 `mov $0xa8a,%di` is a CS string, not the sky table).

## 2. Address mapping (every DS table the port reads, or hard-codes from START.EXE)

"Ref" = an instruction that indexes the table (image offset). "hc" = the port hard-codes the values in TypeScript, so a game profile has to supply them.

| PoR DS | Port use | CotAB DS | Format / stride | Ref PoR → CotAB | Ev | Notes |
|---|---|---|---|---|---|---|
| 05D6 | CLASS_BITS (hc) | **3EA2** | 8 bytes [k] | 32543 → 378d7, 50978 (summed into char+0x12B) | O | Ranger = 0x40, the same as paladin (PoR 0x80) |
| 05DE | TRAINER_BITS (hc) | **3EAA** | 8 bytes [k] | 35a4f → 3b25d, 3b62a | O | 2,2,8,**0x10,0x20**,1,4,**4** (PoR 2,2,8,0A,0A,1,4,6) |
| 08B6 / 08BE | hit dice count/sides | **081A / 0822** | 8 + 8 bytes | 35a60 → 3b28d / 3b2b3 | O | values unchanged; the count is used only at level 1 (§3.4) |
| — | — | **3EBB** (new) | 8 bytes [k] | 3b271, 3ae47 | O | level from which HD stop: 10,15,10,10,11,12,11,19 |
| 08C7, 08D7/E1/EB/F5 | random NPC head/body icons | absent | — | 37053 → none | I | CotAB NPCs use CPIC pictures by monster id ("CPIC" strings at 0x18cb0 and others) |
| 0970 | random-item 8-word records | **082E** | u16 words, record m = 8j+1 | 3daff → 4354b | O | only **7** records (PoR 19); contents differ |
| 011A | temple names (hc prices) | **00E6** | 41-byte Pascal strings | 1db64 `add $0xF1` → 1d20e `add $0xBD` (index from 1) | O | 11 entries: **Heal** added after CCW; prices are code immediates (§3.11) |
| 0C26 | SKY (hc) | **0A8A** | 16 bytes | 44ea3 → 52d55 | O | 0,15,**4**,11,13,**2**,9,14 ×2 (PoR 0,15,12,11,13,10,9,14) |
| 0C36 | overland plot squares | absent | — | — | I | PoR wilderness only |
| 0900–095F | overland cleansing frames (hc) | absent | — | — | I | PoR only |
| 0C6C / 0C7C | colour remap (image.ts) | **0ABA / 0ACA** | 16 + 16 bytes | 45645/4564a → 532bb/532c0 | O | identical (identity; identity with 13→0). CotAB adds three more at 0B20/0B30/0B40 |
| 0C8C/0C96/0CA0 | wall piece start/width/height | **0ADA/0AE4/0AEE** | 10 bytes each | 45c1e.. → 53ae1, 53af5, 53b0e | O | identical |
| 0D1A | filename stem chars (hc) | **0C9A** | 10 chars `" .*,?/\:;|"` | 08485 (`0xD19`+i) → 0622a (`0xC99`+i) | O | identical |
| 0D24 | coin values UNITS (hc) | **0CA4** | 5 × u32 | 35b24 → 3b377 | O | identical 1,10,100,200,1000 |
| 0D38 | class names (spec) | **0CB8** | 17 × 27 bytes | → 3750c etc. | O | same 17 names/order |
| 10BC | item name words | **1057** (accessed as 1042 + i·21) | 255 × 21 | 011bc `add $0x10A7` → 4d690 `add $0x1042` | O | 255 words; 38 changed (dump) |
| 2722 / 272C | wall-set banks / rebase | **2682 / 268C** | 5 words / 5 words | 468ca, 469d0 → 547c4, 548ca | O | identical values |
| 2736 / 273F | dx / dy | **2696 / 269F** | 9 + 9 signed | 028d6.. → 2504b.. | O | identical |
| 2744 | battlefield cell table | **26A4** | 0x42 × 4 bytes | 2619a → 25fc3, 2db53 | O | **values differ**: byte 0 is a move cost 1/2/4 or FF; byte 1 is now 1/2 (§3.12) |
| 286F / 287D | portrait head/body → HEAD3/BODY3 record | absent | — | 45786 → none | I | chargen portraits are CHEAD/CBODY with the record = char field directly (32e9d char+0x141..0x143) |
| 290D | Stinking Cloud cells (hc) | **27D9** | bytes (8,2,3,4 at +1) | 27fa2 → 2801c | O | identical; Cloudkill directions follow at 27DD |
| 2912 | spell names | **27E8** (accessed as 27BF + id·41) | **100** × 41 | 308fe `add $0x28E9` → 30f11 `add $0x27BF` | O | ids 1–100 (PoR 1–56 named) |
| 31FA | spell records | **37DC** + id·16 | 16 bytes, **same field layout** | → 3008e, 5057f `add $0x37DC` | O | class byte meaning changed (§3.7) |
| 3648 | overland map 44×36 | absent | — | — | I | PoR only |
| 3C76 | overland area columns | absent | — | — | I | PoR only |
| 3C7C | THAC0 k·11 + L | **3E3A** | **k·13 + L** (levels 0–12) | 32507 → 3789b, 50871 | O | store = 60 − THAC0 |
| 3CF3 | thief base L·8 + s | **3EC0** | L·8 + s (s 1–8, L 1–12) | → 510c6 | O | |
| 3CF5 | icon part colours (hc) | **3EC2** [1..6] | 6 bytes | 31d9c → 32f90, 34d27 | O | identical 1,2,3,4,6,7 |
| 3D3B | thief race adj r·8 + s | **3F20** | signed | → 51080 | O | identical |
| 3D4E | thief DEX adj DEX·5 + s | **3F33** | signed, s 1–5 | → 51158 (DEX at char+0x17) | O | identical |
| 3DA3 | race ability limits r·16 | **3F88** | 16 bytes | → 33915, 3801d | O | identical |
| 3E17 | classes per race r·12 | **3FFA** | **r·14**: count + 13 ids | → 37479 (`mul 0x0E`) | O | adds Ranger, Paladin, Cleric/Ranger |
| 3E5B | starting age r·0x1C + c·4 | **404E** | w base, count, sides; 7 columns | → 37aa9 | O | adds Human paladin/ranger |
| 3F31 | ageing thresholds r·10 | **4124** | 5 words | → 37f2e | O | identical |
| 3F81 | class ability minimums c·6 | **4174** | 6 bytes × 17 | → 380dc, 39419.. | O | paladin/ranger changed |
| 3FE7 | alignments c·10 | **41DA** | count + ids | → 3790d | O | ranger now LG/NG/CG |
| 408E | CON HP bonus [CON] | **4281** | signed bytes | → 3ae6b (CON at char+0x19) | O | identical 3–18 |
| 409B | XP k·0x38 + L·4 | **4293** | **k·0x63 + L·4**, u32 | → 3b7e6 (`mul 0x63`) | O | levels 0–12; caps §3.2 |
| 40BC | cleric slots (absolute) | **42BC** | **increments**, L·5 + n | → 5053e | O | different model (§3.5) |
| 41D4 | MU slots (absolute) | **44AB** | increments, L·5 + n | → 5079a | O | |
| — | — | **43E5** (new) | paladin increments L·5 + n | 50609 | O | levels 9+ |
| — | — | **4448** (new) | ranger increments L·5 + n | 506c4, 50705 | O | n 1–3 druid, n 4–5 MU; levels 8+ |
| 4263 | starting gold dice | **45B3** | k·2 (count, sides) | → 3893c | O | identical, but the result is **discarded** (§3.10) |
| 426E | saves k·0x2D + L·5 + i | **45BE** | **k·0x3C + L·5 + i** | → 50d38 (`mul 0x3C`) | O | levels 1–12 |
| code 18AE | sound driver segment | **0699** (image 0x6990) | — | byte match | O | the whole driver is moved by −0xBD: every PoR driver offset (V_*, jump targets, PC/TY tables, pointers inside tables) − 0xBD. 5211 of 5955 bytes equal at that shift; the effect data was not checked (?) |

Also checked: race names DS:0E9E (10 bytes × 8), alignment names DS:0EEE (17 × 9), gender DS:0F87, coin names DS:0F96 (O). ITEMS is the same format and size (128 × 16 + 2), but byte 13 now has 0x80 set on every weapon (no CotAB class uses bit 0x80), and the MU-scroll mask 01 becomes 05 (I, data only).

## 3. Rule differences (with values)

Character record: CotAB's is 0x1A6 bytes. Class levels are at char+0x109+k (former, dual-class levels at +0x111+k), STR +0x11, INT +0x13, DEX +0x17, CON +0x19, race +0x74, class +0x75, coins +0xFB.. (cp, sp, ep, gp, pp), XP +0x127, slots +0x12D.. (O for every field named here, from the code above). That is another agent's area, but every rule below uses these fields.

### 3.1 Classes and races (O)
- Same 8 base classes and 17 class ids/names. Race menu in code: 1–5 and 7 (Half-Orc not offered), the same as PoR (O, 3708f–370e6).
- **Paladin and Ranger are playable**: Human gets Cleric, Fighter, MU, Thief, **Paladin, Ranger**. Half-Elf adds **Ranger** and **Cleric/Ranger**. Other races are unchanged. Druid and Monk have no XP table (not playable).
- Paladin minimums: STR 12, INT 9, WIS 13, CON 9, CHA 17 (PoR had STR 13 / WIS 12). Ranger minimums: STR 13, INT 13, WIS 14, CON 14 (PoR STR 0). Alignment: paladin LG only; ranger (and C/R) LG, NG, CG.

### 3.2 Experience and level caps (O, DS:4293 + k·0x63 + L·4)
| Class | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | cap (PoR) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cleric | 1501 | 3001 | 6001 | 13001 | 27501 | 55001 | 110001 | 225001 | 450001 | – | – | **10** (6) |
| Fighter | 2001 | 4001 | 8001 | 18001 | 35001 | 70001 | 125001 | 250001 | 500001 | 750001 | 1000001 | **12** (8) |
| Paladin | 2751 | 5501 | 12001 | 24001 | 45001 | 95001 | 175001 | 350001 | 700001 | 1050001 | – | **11** (1) |
| Ranger | 2251 | 4501 | 10001 | 20001 | 40001 | 90001 | 150001 | 225001 | 325001 | 650001 | – | **11** (1) |
| Magic-User | 2501 | 5001 | 10001 | 22501 | 40001 | 60001 | 90001 | 135001 | 250001 | 375001 | – | **11** (6) |
| Thief | 1251 | 2501 | 5001 | 10001 | 20001 | 42501 | 70001 | 110001 | 160001 | 220001 | 440001 | **12** (9) |

"–" is 0xFFFFFFFF (cleric, paladin, ranger, MU at 11 or 12) or 0 (fighter and thief at 13). The 99-byte class stride holds 13 XP dwords, followed by that class's spell-increment rows (§3.5). The port's `maxLevel()` loop (L 2..13) works if its stride and top level come from the profile.

Demi-human limits are still code, not a table (O, 3b631–3b7c4; STR char+0x11, INT char+0x13; STR 18/xx counts as 18). New rows are marked \*:

| Race | Class | Limit |
|---|---|---|
| Dwarf | Fighter | 7 (STR<17), 8 (17), 9 (18) |
| Elf | Fighter | 5 / 6 / 7 |
| Elf | MU\* | 9 (INT<17), 10 (17), 11 (18) |
| Gnome | Fighter | 5 (STR<18), 6 |
| Half-Elf | Cleric | 5 |
| Half-Elf | Fighter and Ranger\* | 6 / 7 / 8 |
| Half-Elf | MU\* | 6 (INT<17), 7 (17), 8 (18) |
| Halfling | Fighter | 4 / 5 / 6 |

### 3.3 THAC0 (O, DS:3E3A + k·13 + L, shown as THAC0)
| L | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cleric, Druid, Monk | 20 | 20 | 20 | 18 | 18 | 18 | 16 | 16 | 16 | 14 | 14 | 14 |
| Fighter, Paladin, Ranger | 20 | **20** | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11 | 10 | 9 |
| Magic-User | **21** | **21** | **21** | **21** | **21** | 19 | 19 | 19 | 19 | 19 | 17 | 17 |
| Thief | 20 | 20 | 20 | 20 | 19 | 19 | 19 | 19 | 16 | 16 | 16 | 16 |

The bold cells differ from PoR (PoR fighter L2 = 19; PoR MU levels 1–5 = 20).

Extra attacks (O, 508b4–508ee, again for former levels at 50a3b): fighter level > 6, **paladin > 6, ranger > 7** → char+0x11C = 3 (3/2 attacks).

### 3.4 Hit points (O, FUN at 3b230; called by chargen at 389fb and by training at 3be67)
- For each class in the mask: if level < DS:3EBB[k], roll **count** dice, but count = 1 once the level is above 1. Roll that dice expression **twice and keep the higher**. PoR instead rolls count dice every level, with a minimum of 2/3 of the maximum at level 1.
- Once the level reaches DS:3EBB[k] (C 10, F 10, P 10, R 11, MU 12, T 11): fixed fighter/paladin 3, cleric/ranger/thief 2, MU 1. **Quirk**: the fixed value *replaces* the running sum instead of adding to it.
- CON bonus DS:4281: same as PoR for 3–18. CON 19–25 read +2 (those entries alias the cleric XP level 0/1 dwords).

### 3.5 Spell slots (O, FUN at 50480)
A different model from PoR. Slots are recomputed from zero as **cumulative increments** over levels, into 15 bytes at char+0x12D: cleric levels 1–5, druid levels 1–5 (+0x132), MU levels 1–5 (+0x137). Slot index = char+0x12C + spellclass·5 + level.
- Cleric: +1 first-level slot, then for L = 2..level add DS:42BC[L·5 + n], n = 1..5. The cleric then knows every class-0 spell with a slot, **except id 36**.
- Paladin: for L = 9..level add DS:43E5[L·5 + n] to the cleric slots, then knows the cleric spells.
- Ranger: for L = 8..level add DS:4448[L·5 + n]: n 1–3 to druid slots, n 4–5 to MU levels 1–2. The ranger knows **every** class-1 (druid) spell.
- MU: +1 first-level slot, then L = 2..level add DS:44AB[L·5 + n].
- The WIS bonus routine still follows (call 50af6). Not re-derived here (?).

Resulting slots (level 1–5 spells):

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

Levels 1–6 equal PoR's absolute tables.

### 3.6 Saving throws (O, DS:45BE + k·0x3C + L·5 + i; order death, petrify, rod, breath, spell)
- Cleric: L1–3 10 13 14 16 15 · L4–6 9 12 13 15 14 · L7–9 7 10 11 13 12 · L10–12 6 9 10 12 11
- Fighter and Ranger: L1–2 14 15 16 17 17 · 3–4 13 14 15 16 16 · 5–6 11 12 13 13 14 · 7–8 10 11 12 12 13 · 9–10 8 9 10 9 11 · 11–12 7 8 9 8 10
- Paladin (fighter − 2): L1–2 12 13 14 15 15 · 3–4 11 12 13 14 14 · 5–6 9 9 11 11 12 · L7 8 9 10 10 11 · **L8 9 9 10 10 11** (data quirk: death save worse than at L7) · 9–10 6 7 8 7 9 · 11–12 5 6 7 6 8
- MU: L1–5 14 13 11 15 12 · 6–10 13 11 9 13 10 · 11–12 11 9 7 11 8
- Thief: L1–4 13 12 14 16 15 · 5–8 12 11 12 15 13 · 9–12 11 10 10 14 11
- 12 rows per class (levels 1–12). The unused L0 slot of class k+1 holds L12 of class k.

### 3.7 Spells (O)
- **100 ids** (PoR 56 named + 57–67 item-only). Names: DS:27BF + id·41. Records: DS:37DC + id·16, 16-byte layout unchanged (cls, lvl, range r0/r1, duration d0/d1, target, side, save, saveType, effect, where, castTime, aiPriority, aiHostile, area).
- **The class byte changed meaning**: 0 cleric, **1 druid, 2 magic-user, 3 item/monster only** (PoR: 0 cleric, 1 MU, 2 item). Ids 1–56 keep their PoR names and ids. PoR's MU spells (9–21, 29–35, 45–55) change class 1 → 2. **Animate Dead (36)** becomes class 3, level 7. AI priority (byte 13) is retuned on many spells; Prayer side 1 → 4; Blink side 1 → 0.
- Ids 57–67 reused. 58 Cure Serious Wounds, 66 Cause Serious Wounds and 67 Neutralize Poison are cleric level 4. The rest stay unnamed class 3.
- New player spells:
  - Cleric 4: 58 Cure Serious Wounds, 66 Cause Serious Wounds, 67 Neutralize Poison, 68 Poison, 69 Protection Evil 10' Radius, 70 Sticks to Snakes
  - Cleric 5: 71 Cure Critical Wounds, 72 Cause Critical Wounds, 73 Dispel Evil, 74 Flame Strike, 75 Raise Dead, 76 Slay Living
  - Druid 1: 77 Detect Magic, 78 Entangle, 79 Faerie Fire, 80 Invisibility to Animals
  - MU 4: 81 Charm Monsters, 82 Confusion, 83 Dimension Door, 84 Fear, 85 Fire Shield, 86 Fumble, 87 Ice Storm, 88 Minor Globe Of Invulnerability, 89 Remove Curse, 100 Bestow Curse
  - MU 5: 91 Cloud Kill, 92 Cone of Cold, 93 Feeblemind, 94 Hold Monsters
  - Class 3: 90 Animate Dead (level 5); unnamed 57, 59–65, 95–99
- Castable totals by class and level: cleric 8/7/8/6/6 (+ Restoration, class 0 level 7), druid 4, MU 13/7/11/10/4.
- Full record dump: `tables_out.txt`, section "Spells".

### 3.7a Caster level (O, 0x4F8BF, thunk `ed:ca`; PoR FUN_10ba_26c2)
Argument: spell id; caster DS:6520. Levels read signed; f = FUN 0x51841 (a human whose first class with a level has passed char+0xE6, the level at the class change: then former levels char+0x111+k count, added to the current ones).
1. Gate (0x4F8C5): no cleric and no magic-user level, paladin < 9 and ranger < 8 → **6** for every spell (current levels only).
2. By the spell's class byte (DS:37DC + 16·id): cleric → max(cleric, paladin − 8); druid → max(ranger − 7, 0) (the druid level is never read); magic-user → max(magic-user, ranger − 8); item/monster (3) → 12.
3. From an item (DS:757D set by the item-use routine 0x3F9A9, for scrolls and wands) and class ≠ 3 → 6.
Slots are pooled by spell class (0x300A0: char+0x12C + class·5 + level − memorised of that class and level), so a paladin's cleric spells use the cleric slots and a ranger's the druid/magic-user ones. A readied item with effect 0x81 adds slots (0x507C3; I: Ring of Wizardry, not yet in the port).

### 3.8 Thief skills (O, 0x50F5A)
- Level L = byte(f·former thief + thief level) (f: FUN 0x51841, §3.7a); the base table runs to level 12 (rows 1–9 as PoR; row 0 differs in OL, 19 vs 10, and is read for L = 0).
- The first readied item (list char+0x14D, readied +0x34) whose effect byte +0x3E is > 0x80 and whose effect is 0x0B **Gloves of Thievery** or 0x02 **Gauntlets of Dexterity** (only one can count):
  - Gauntlets: L < 4 → L = 4 and no bonus; else +10 on every skill after the clamp.
  - Gloves: for PP (s 1), L < 5 → L = 5 and bonus 0, else bonus 5; for OL (s 2) the same with 7; later skills keep that bonus.
- Per skill: race r (DS:3F20); if r < 0 and base < bonus − r → 0; else base + r + bonus, then DEX (DS:3F33, skills 1–5). L is restored after each skill.
- **The bonus variable is never initialised**: without gloves it holds what the saves routine left there, 7, so every skill gets **+7**. Confirmed by the shipped TRAVIS (dwarf thief 5, DEX 17): stored 62 69 62 52 43 27 87 27 = the formula + 7. The port adds it (profile `thief.bonus`).
- Run by creation, the recalculation (also for a former thief when f = 1), dual-classing, and readying or removing those items. In the port: creation and training so far; the item hooks need the items passed (later, with CotAB's item effect handlers).

### 3.6a Saves: the CON bonus (O, 0x50C6B)
After the table minimum: dwarves, halflings, or anyone with a readied effect-6 item (Girdle of the Dwarves): save 0 += 1 (CON 4–6), 2 (7–10), 3 (11–13), 4 (14–17), 5 (18); everyone with CON 19–20 +1, 21–22 +2, 23–24 +3, 25 +4. This is **added to the stored save number**, so it makes the death/poison save harder (I: a bug; the intent was surely a bonus). Confirmed by TRAVIS: table 12, stored 16 (CON 16). All six shipped characters recompute exactly. A stray test after the class loop uses the former level of class 7 (monk), dead in practice.

### 3.9 Ability limits, ages, ageing
Unchanged from PoR except the new Human paladin (17+1d4) and ranger (20+1d4) start ages (O). Race limits DS:3F88 and thresholds DS:4124 are byte-identical to PoR.

### 3.10 Starting money (O, chargen 388db–389ea)
The gold dice DS:45B3 (same values as PoR) are still rolled, so the RNG is consumed, but the sum is never stored. Every new character gets `char+0x103 = 300`, the 5th coin word = **300 platinum**.

### 3.11 Temple (O)
Services DS:00E6: Cure Blindness, Cure Disease, CLW, CSW, CCW, **Heal**, Neutralize Poison, Raise Dead, Remove Curse, Stone to Flesh, Exit. Price immediates in the temple code (1c691–1d15e): 1000, 1000, 100, 350, 600, **5000 (Heal)**, 5500, 1000, 3500, 2000. The service each price belongs to comes from code order, which matches PoR's prices (I).

**Heal** (O, image 0x1CBF6–0x1CCC5): asks to pay 5000 ("Y"), then heals max HP − current HP − 1d4 (through the heal routine `e3:84`); removes effect 0x21 (blindness), the six disease effects of DS:00DF[1..6] (31, 34, 43, 44, 50, 57, the same list as PoR's DS:0113[1..6]) and 0x44 (ghoul paralysis); then recomputes INT and WIS from their base values (`4aab:18D9`, stats 1 and 2: undoes feeblemind). PoR's temple has no Heal.

### 3.12 Combat tables (O)
- Battlefield cells DS:26A4: byte 0 is 1, 2 or 4 (a move cost) or FF; byte 1 is 1 or 2 (PoR always 0); byte 2 is sight; byte 3 is image. Several outdoor cells (0x24, 0x28–0x2B, 0x30–0x3F) changed passability and cost. The port's `cellTable()` reads bytes 0, 2 and 3 and treats byte 0 as "1 enterable". CotAB's costs need the move code (other agent).
- Stinking Cloud and Cloudkill cell lists, dx/dy: identical.

### 3.13 Items
- ITEMS: the same 128 × 16 format. Name words: 255, 38 changed (Dragon Breath, Ioun Stone, Frost Brand, Elfin Chain, Gloves, Thievery, …).
- The random-item record table (DS:082E) holds 7 records (PoR 19), so the TREASURE random-type logic must be CotAB's own (other agent, ?).
- The item class mask follows DS:3EA2: rangers use paladin-flagged (0x40) items.

## 4. What a game profile must hold

1. DS base (or derive it from the TP startup, as `find_ds()` does) and the sound-driver segment plus offset delta (PoR 18AE/0, CotAB 0699/−0xBD).
2. Every table address in §2 and its **stride**: THAC0 11 → 13, XP 0x38 → 0x63, saves 0x2D → 0x3C, race-classes 12 → 14, item words, spell names and records bases. Also the counts: spells 56/67 → 100, random-item records 19 → 7, temple services 10 → 11, top level 13 (loop bound).
3. Spell-class encoding (PoR 0 cl / 1 MU / 2 item; CotAB 0 cl / 1 druid / 2 MU / 3 item) and slot layout (PoR 2 × 3 at char+0xB2; CotAB 3 × 5 at char+0x12D).
4. The slot model: absolute per-level tables (PoR) or cumulative increments with per-class start levels (CotAB: cleric and MU from 2, paladin 9, ranger 8), plus the auto-learn rules (cleric skips id 36; ranger learns all druid spells; paladin learns cleric spells).
5. Rules that live in code, not tables: demi-human limits (§3.2), extra-attack thresholds (F > 6, P > 6, R > 7), the HP rule (PoR: count × die, 2/3 minimum at L1; CotAB: count only at L1, best of two, HD-cap table plus fixed per-class HP with the replace quirk), starting money (PoR gold dice × 10 shared across classes; CotAB 300 pp, dice rolled and discarded), the race menu, temple prices and services, thief-skill item hooks.
6. Values the PoR port hard-codes and CotAB changes: CLASS_BITS (ranger 0x40), TRAINER_BITS (P 0x10, R 0x20, monk 4), SKY colours, temple list and prices, RACE_MENU (same), COMPONENTS (same 17), cell-table semantics. Values that are the same and can stay shared: coins, filename characters, part colours, cloud cells, remap tables, wall pieces and banks.
7. Tables that exist only in PoR: the overland map and plot squares (3648, 0C36, 3C76, 0900–095F), the NPC random icon tables (08C7–08F5) and the portrait record maps (286F/287D). The profile needs to mark them optional.
8. The character record layout differs completely (0x11D-style PoR offsets vs CotAB 0x1A6 bytes). Every rules routine needs a field map from the profile, or a common internal model.
