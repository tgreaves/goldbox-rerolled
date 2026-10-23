---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Character creation, experience and training

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Evidence marks as in the README. Curse of the Azure Bonds:
> [coab/tables.md](../coab/tables.md) (the rules tables and their differences), [coab/records.md](../coab/records.md)
> (§10, creation effects); the engine model's procedures: [B-model/procedures.md](../../B-model/procedures.md) §1–§8.

Creation is `FUN_417f_056c` (party screen "Create character"; the menus it uses are the widgets of [input-and-menus.md](input-and-menus.md) §0); training is `FUN_417f_29ae`; the level-derived statistics `FUN_51cf_0000`. This file merges the former `chargen.md`, the creation section of `menus.md` and `progression.md`.

## Character creation (`FUN_417f_056c`)

### Sequence (O)

1. GetMem 0x11D, zero-fill, set the defaults in Record bytes, below.
2. **Race** list "Pick Race": Dwarf, Elf, Gnome, Half-Elf, Halfling, Human (entry 6 → race 7; Half-Orc never offered). Entries are `"  " + name`. Size byte char[0xC0] = 1 (Dwarf, Gnome, Halfling) else 2; innate racial effects added with permanent duration via `FUN_5216_0e52` (table below).
3. **Gender** list "Pick Gender": Male, Female (`DS:0FEC + 7i`) → char[0x9E] = 0/1.
4. **Class** list "Pick Class": from `DS:3E17 + race·12` (count, ids) — **race only, no ability prerequisites** (table below). Levels: 1 in every component class (char[0x96 + c]); char[0x73] = 1; thief skills `FUN_51cf_0329` if thief (runs before abilities exist, so the DEX term uses DEX 0; they are recomputed with the real DEX when the character joins a party, whose join runs `FUN_51cf_0000` ([input-and-menus.md](input-and-menus.md) §2.1; Derived statistics, below), and at every training); char[0x2D] = max over classes of `DS:3C7C[c·11 + 1]`; char[0xB0] = Σ class bits `DS:05D6` (Cleric 2, Druid 16, Fighter 8, Paladin 64, Ranger 128, MU 1, Thief 4, Monk 32); saving throws `FUN_51cf_0255`.
5. **Alignment** list "Pick Alignment": `DS:3FE7 + class·10` (table below) → char[0xA0].
6. **Age**: single class `base + NdS` (`DS:3E5B + race·0x1C + class·4`: u16 base, u8 N, u8 S). Multi-class: maximum `base + N·S` of one column: C/F, C/F/MU, C/MU, C/T → Cleric; F/MU, F/MU/T, MU/T → Magic-User; F/T → Fighter. Age is **not** re-rolled with the abilities.
7. Show the sheet (`FUN_4894_004a`, name blank). Roll loop:
   - each ability: best of six 3d6 rolls; then age adjustments (below), racial min/max clamp (STR min/max by gender), raise to class minimum (`DS:3F81 + class·6`, Class minimums below); WIS < 13 for a cleric multi-class (classes 8–12, set `417f:0525`) → 13; STR 18 with a Fighter level (char[0x98] > 0; Paladin/Ranger do not count) → char[0x16] = 1d100 capped by `DS:3DA7 + race·16 + gender`.
   - **Racial ability adjustments never apply** (bug): the code tests the race-menu loop variable `[bp-0x17]`, which is always 7 after the menu loop (`417f:1236`), not char[0x2E]. Dwarf CON+1 CHA−1, Elf DEX+1 CON−1, Halfling STR−1 DEX+1, Half-Orc STR+1 CON+1 CHA−2 are dead code. Reproduce: **no** racial adjustment.
   - HP, gold, spells, slots, natural attack (Record bytes, below); sheet panels redrawn (`FUN_4894_0608` also runs `FUN_10ba_0bb8`, so AC/THAC0/damage/movement are filled).
   - Yes/No "Keep this character? " (prompt 13). **N** re-rolls abilities, HP and gold (race, class, alignment, age kept). Abilities cannot be swapped or edited here (use Modify).
8. **Name**: "Character name: " (prompt 13), max **15**, characters 0x20–0x7A, upper-cased; repeated while empty.
9. **Portrait** (`FUN_417f_33e7`): frame rows 1–11, cols 28–38; head over body drawn at col 28, row 1 (`FUN_5523_04f9`). Menu "Head Body Keep": **H** next head (1–14, wraps to 1), **B** next body (1–12, wraps), **K** keep. No previous key; Esc does nothing. Head n → HEAD3.DAX record `DS:286F[n]` = 0, 8, 9, 13, 16, 18, 22, 34, 45, 51, 53, 57, 67, 68; body n → BODY3.DAX record `DS:287D[n]` = 1, 2, 3, 4, 7, 8, 18, 24, 26, 33, 35, 37 (file digit = `DS:5376`, which is 3 on the party screen). Stored in char[0xBB] / char[0xBC].
10. **Combat icon** editor ([input-and-menus.md](input-and-menus.md) §3.2).
11. Save to `<stem>.cha/.itm/.spc` + append to `charlist.txt` (`FUN_45c5_069e("", char)`), free the record. To play it the player must **Add** it.

Esc/Exit in any of the four lists abandons creation: the code jumps to `417f:1ECE`, past the FreeMem, so the record leaks (O).

**Dice (O).** Every NdS above is one call of the dice routine `FUN_5216_0de3(N, S)` (age at `417f:0f26`,
each 3d6 at `417f:122e`, gold at `417f:1c83`, hit points in `FUN_417f_4235`); the identity tag char[0xAB] is
`Random(256)` (`417f:0622`) and STR 18/xx is `Random(100) + 1` (`417f:14f3`). As dice requests
([B-model/host-contracts.md §6.1](../../B-model/host-contracts.md#61-the-rule-d2)), in order: (1, 256),
the age (N, S) for a single class (none for a multi-class), then per roll of step 7 six (3, 6) for each
ability in turn, with (1, 100) straight after STR's six when it came out 18 with a Fighter level, (N, S) of the starting gold per class
and (N, S) of the hit dice per class (CotAB: twice, the better kept). CotAB is the same at 0x37047
(tag), 0x37AC3 (age), 0x37E51 (3d6), 0x38152 (STR), 0x3894E (gold), 0x3B2B8/0x3B2CF (hit dice).

### Innate racial effects (O)

| Race | Innate effects ([effects.md](effects.md)) |
|---|---|
| Dwarf | 0x5A CON bonus to poison saves; 0x61 CON bonus to rod/staff/wand and spell saves; 0x1A +1 to hit orcs, goblins, hobgoblins (by monster name); 0x2F −4 to be hit by ogres, trolls, giants |
| Elf | 0x6B 90% resistance to Sleep and Charm |
| Gnome | 0x61 as above; 0x12 +1 to hit kobolds and goblins; 0x2F as dwarf; 0x30 −4 to be hit by bugbears and gnolls |
| Half-Elf | 0x7C 30% resistance to Sleep and Charm |
| Halfling | 0x5A, 0x61 as dwarf |
| Human | none |

Racial bonuses against monster types are matched by **monster name** strings in the engine (e.g. "ORC LEADER", "HILL GIANT").

### Age adjustments (O)

Age adjustment against the race's thresholds (mature, middle-aged, old, venerable) at `DS:3F31 + race·10`: STR +1/−1/−2/−1, INT +1 at middle and venerable, WIS −1 if young then +1 at each of middle/old/venerable, DEX −2 old −1 venerable, CON −1 at each of middle/old/venerable.

### Class and alignment availability (O)

The classes offered to race r are the list at `DS:3E17 + r·12` (a count, then up to 11 class ids,
in menu order); the alignments offered to class c the list at `DS:3FE7 + c·10` (a count, then up to
9 alignment ids, in menu order). The race menu itself is code ([B-model/procedures.md §7](../../B-model/procedures.md#7-creation-and-training-values)):
Half-Orc has a list but is never offered. Values, with the quirks they hold (Cleric/Thief may take
every alignment; thieves and their multi-classes never LG or CG):
[expected-values.md §6.1](../../D-appendices/expected-values.md#61-classes-and-alignments-ds3e17-ds3fe7).

### Tables (O)

#### Starting age `base + NdS`

For race r and base class c (0–6), `DS:3E5B + r·0x1C + c·4` holds u16 base, u8 count, u8 sides:
the starting age is base + count d sides (a multi-class character: the maximum of one column, step 6
of the sequence). Values: [expected-values.md §6.2](../../D-appendices/expected-values.md#62-starting-age-and-age-categories-ds3e5b-ds3f31).

#### Age category thresholds (mature, middle-aged, old, venerable)

Five u16 per race at `DS:3F31 + race·10`: the thresholds of the mature, middle-aged, old and
venerable categories, then a fifth value that nothing reads (O: no reader of DS:3F39 in the image; CotAB's DS:412C none either). Values:
[expected-values.md §6.2](../../D-appendices/expected-values.md#62-starting-age-and-age-categories-ds3e5b-ds3f31).

#### Racial ability limits (`DS:3DA3 + race·16`)

16 bytes per race: STR minimum (male, female), STR maximum (male, female), exceptional-strength cap
(male, female), then minimum and maximum of INT, WIS, DEX, CON and CHA;
values: [expected-values.md §6.3](../../D-appendices/expected-values.md#63-ability-limits-and-class-minimums-ds3da3-ds3f81).

#### Class minimums (STR INT WIS DEX CON CHA, `DS:3F81 + class·6`, O)

Six bytes per class (0 = no minimum); values: [expected-values.md §6.3](../../D-appendices/expected-values.md#63-ability-limits-and-class-minimums-ds3da3-ds3f81).

#### Starting gold dice (× 10 gp, `DS:4263`)

Two bytes per class (count, sides); values: [expected-values.md §6.4](../../D-appendices/expected-values.md#64-starting-gold-experience-and-hit-dice-ds4263-ds409b-ds08b6-ds08be).

### Record bytes set by creation (O unless marked)

| Offset | Value |
|---|---|
| all | 0 first |
| 0x00 | name (≤ 15, upper case) |
| 0x10–0x15, 0x16 | abilities, exceptional STR (0 unless STR 18 + Fighter) |
| 0x2D | 40, then max `DS:3C7C[class·11 + 1]` (= 60 − 20) |
| 0x2E, 0x2F, 0x30 | race, class, age |
| 0x32, 0x11B | max HP = current HP: `FUN_417f_4235` roll (Hit points per level, below) with CON bonus `FUN_417f_3f31`: `(roll + bonus) / classes`; negative bonus with `|bonus| + classes ≥ roll` → 1 |
| 0x33–0x6A | spells known: Cleric every level-1 cleric spell (`DS:31FA + 16·id`: class 0, level 1); Magic-User 11, 18, 19, 21 |
| 0x6C | 1 |
| 0x6D–0x71 | saves (`FUN_51cf_0255`) |
| 0x72 | 12 (base movement → char[0x11C]) |
| 0x73 | 1 |
| 0x77–0x7E | thief skills (see step 4 caveat) |
| 0x7F | effect list: racial innate effects, permanent |
| 0x8E | gold = `10 · Σ roll(DS:4263/4264 dice) / classes` (u16) |
| 0x96–0x9D | 1 for each component class |
| 0x9E, 0xA0 | gender, alignment |
| 0xA1 | 2 (one attack per round) |
| 0xA3, 0xA5 | 1, 2 → natural attack 1d2 (0xA7 bonus 0; second hand 0) |
| 0xA9 | 50 → base AC 10 (60 − AC), copied to char[0x111] by `FUN_10ba_0bb8` |
| 0xAA | 1 (STR to-hit/damage apply; not set for monsters) |
| 0xAB | Random(256): identity tag used by Add's duplicate check |
| 0xB0 | class-use bitmask |
| 0xB1 | HP roll / classes (before CON) |
| 0xB2 / 0xB5 | 1 cleric / magic-user level-1 slot; cleric WIS bonus `FUN_51cf_01af` |
| 0xBB, 0xBC | portrait head 1–14, body 1–12 (1, 1 by default) |
| 0xBD, 0xBE | combat icon head 0–13, weapon pose 0–31 (0, 0 by default) |
| 0xBF | combat-icon slot: 0 at creation, lowest free 0–7 when joining |
| 0xC0 | icon size 1 small / 2 large (race default; editable) |
| 0xC1–0xC6 | icon colours (low nibble colour-1, high nibble colour-2) for Body, Arm, Leg, Hair/Face, Shield, Weapon. Default `c | (c+8)<<4` with c = 1, 2, 3, 4, 6, 7 → 0x91, 0xA2, 0xB3, 0xC4, 0xE6, 0xF7 (identity) |
| 0x10C | 0 (Okay) |
| 0x10D | 1 (I: conscious/alive flag; cleared when knocked out, set on revival) |
| 0x110–0x11C | AC, THAC0, damage, movement, encumbrance from `FUN_10ba_0bb8` ([records.md, "Derived statistics"](records.md#derived-statistics-o-fun_10ba_0bb8)) |

Not set: experience 0, no items, char[0x84] = 0 (player character), char[0x10E] = 0.

## Experience table (O)

`DS:409B + class × 0x38 + k × 4`, u32. Entry `k` is the experience needed for level `k`; the trainer compares the character's experience with entry `level + 1`. 0xFFFFFFFF = cannot reach.

The caps that follow from the table (the last level with an entry other than 0xFFFFFFFF): cleric
6, fighter 8, magic-user 6, thief 9; druid, paladin, ranger and monk 1 (not playable). Values:
[expected-values.md §6.4](../../D-appendices/expected-values.md#64-starting-gold-experience-and-hit-dice-ds4263-ds409b-ds08b6-ds08be).

## Demi-human level limits (O, `FUN_417f_29ae`)

Training is refused ("Not Enough Experience" path skipped) when the character is at:

| Race | Class | Limit |
|---|---|---|
| Dwarf | Fighter | 7 (STR < 17), 8 (STR 17); 9 is not tested (0x34276) |
| Elf | Fighter | 5 (STR < 17), 6 (STR 17), 7 (STR 18) |
| Gnome | Fighter | 5 (STR < 18), 6 (STR 18) |
| Half-Elf | Cleric | 5 |
| Half-Elf | Fighter | 6 (STR < 17), 7 (STR 17), 8 (STR 18) |
| Halfling | Fighter | 4 (STR < 17), 5 (STR 17), 6 (STR 18) |

Only these fighter limits and the half-elf cleric limit are coded. The middle rows test STR = 17 exactly and the bottom rows STR < 17 (gnome: < 18), on char[0x10] without exceptional strength, so STR 19 and above behaves like 18. Every test is an equality (0x34270–0x34372): a class is refused at the level equal to its band's limit, or at the top limit whatever the ability (`cmp $7,level; je` for the elf), never above it, so a character above its band's limit (STR lowered after training) trains on (O). The dwarf has no top test, which the fighter's cap of 8 makes moot. A class at its limit is skipped; the character gets "Not Enough Experience" only if no other class qualifies. The guide's (7.7.3) elf and half-elf magic-user limits are above the game's cap of 6 and need no code.

## Training halls (O)

New Phlan's training hall is `ECL3` record 11. Each door stores a class mask in ECL **0x6DA8** (`B[0x550]`), prints "'WE TRAIN ONLY *class* HERE. DO YOU WANT TO TRAIN?'" and runs `PROGRAM 0` (the party screen, whose **T**rain entry is enabled only while 0x6DA8 ≠ 0 or the cheat is on, [input-and-menus.md](input-and-menus.md)):

| Hall | 0x6DA8 | Class bit it matches |
|---|---|---|
| Clerics | 114 (0x72) | 2 |
| Magic users | 113 (0x71) | 1 |
| Fighters | 120 (0x78) | 8 |
| Thieves | 116 (0x74) | 4 |

Class trainer bits (`DS:05DE`, the same values as the item class-use mask): Cleric 2, Druid 2, Fighter 8, Paladin 10, Ranger 10, Magic-User 1, Thief 4, Monk 6. Bits 0x10–0x40 of the hall masks match no class. A hall therefore trains only its own class: a multi-classed character visits one hall per class and pays at each (G agrees: "class-specific training hall", 7.4).

## Training (O, `FUN_417f_29ae`)

For the current character. "Cheat" means `DS:470C` ≠ 0 (below).

1. Status ≠ Okay and no cheat → "we only train conscious people", leave.
2. Coins worth < 1000 gp (`FUN_4894_28be`: cp, sp, ep, gp, pp converted to gold and rounded up; gems and jewelry do not count) and no cheat → "Training costs 1000 gp.", leave.
3. For each class c 0–7 with level L = char[0x96 + c] > 0:
   1. *all* += trainer bit of c
   2. at its demi-human limit (table above) → skip c
   3. T = XP table entry for level L + 1. T = 0 or 0xFFFFFFFF (game cap) → skip c. XP char[0xAC] < T and no cheat → skip c
   4. *eligible* += trainer bit of c
   5. N = entry for level L + 2. If N is a real threshold and XP ≥ N: *cap* = max(*cap*, N − 1)
4. If *cap* > 0: **XP = *cap***. This happens before the hall check and the confirmation, so pressing T with too much experience truncates it even in the wrong hall or when the player then declines.
5. No cheat: *all* AND 0x6DA8 = 0 → "We don't train that class here"; else *eligible* AND 0x6DA8 = 0 → "Not Enough Experience"; leave.
6. *train* = *eligible* AND 0x6DA8 (cheat: *eligible*).
7. Show the character, "*name* will become:", then one line per class in *train*: "    a level *L+1* *class*" for the first, "and a level *L+1* *class*" for the rest (class names `DS:0D38`, 27 bytes each).
8. "Do you wish to train? " — anything but **Y** leaves (XP stays truncated).
9. "Congratulations..."; unless cheat, take 1000 gp in coins (`FUN_417f_42ed`, below).
10. *k* = number of classes the character has. Each class in *train* gains a level; for each such class, if drained levels char[0x74] > 0: char[0x75] (drained HP) −= char[0x75] div char[0x74], then char[0x74] −= 1. So retraining a drained level also clears its drain record (G: "acts as a Restoration spell that requires both experience and money").
11. `FUN_51cf_0000`: slots, THAC0, attacks, saving throws, thief skills (sections below).
12. If the magic-user level (char[0x9B]) rose: pick one new spell (`FUN_4894_299c` mode 4 "Spells to choose from", select type 4), repeated until a spell is picked. The list holds every id 1–56 not yet known whose class and level have a slot (char[0xB1 + class·3 + level] > 0); for a cleric/magic-user the cleric spells are already known, so in practice it lists magic-user spells of the levels just reached. The pick sets char[0x32 + id] = 1. **Bug**: if the list is empty the loop ends with id 0 and writes char[0x32] = 1, i.e. **max HP := 1**, before step 13 adds the gain. A port should reproduce this or record the fix in IMPROVEMENTS.md (GoldBox Rerolled fixes it: IMP-028).
13. Hit points: R = `FUN_417f_4235(char, train)` (rolls for the trained classes only). char[0xB1] += max(1, R div *k*). C = `FUN_417f_3f31(char)` (CON bonus summed over **all** *k* classes). Gain = max(1, (R + C) div *k*), signed division truncating towards 0. Damage taken is kept: max HP += gain, current HP = max HP − (old max − old current). Both are bytes (wrap above 255).

Training takes no game time. One session gains at most one level per class. Nothing else is recomputed:
the items' recompute (`FUN_10ba_0bb8`) is not run, so the encumbrance char[0x102] keeps the coins just paid
and the item-adjusted figures wait for the next recompute (O: BROTHER SEAN trained in DOSBox with 200 pp,
1000 gp paid, saved with his encumbrance as loaded, 638; [VALIDATION.md](../../VALIDATION.md) §4).

### Payment (O, `FUN_417f_42ed(gp, char)`)

Coin values in copper (`DS:0D24`): cp 1, sp 10, ep 100, gp 200, pp 1000. The price is converted to copper (× 200).

1. For cp, sp, ep, gp, pp in that order, while something is owed: n = min(held, owed div value + 1); held −= n; owed −= n × value.
2. If overpaid, give the change back from pp down to cp: n = change div value; held += n; change −= n × value.

### Free training cheat (O, `FUN_417f_0161` at `417f:04ad`)

Pressing **J** on the party screen compares the first command-line parameter (`ParamStr(1)`) with "STING". If it matches: `DS:470C` = 1 and "I Understand, master...". Nothing is typed after J. `DS:470C` is reset to 0 every time the party screen is entered.

With the cheat, training skips the status, money, experience and hall checks and charges nothing; every class not at its game or demi-human cap gains a level at once. XP is still truncated as in step 4. The Train entry is enabled even outside a hall (G: guide 11.1 "J: train for free").

## Hit points per level (O)

`FUN_417f_4235`: for each class in the mask, roll `count × d(sides)` from `DS:08B6` / `DS:08BE`; when that class's level is 1, the roll is raised to at least `2·sides/3`. Training raises the levels before rolling, so the minimum applies only at character creation (the guide, 12.6.3, says the function "is also called for later levels"; true, but no level is 1 then).

(Values: [expected-values.md §6.4](../../D-appendices/expected-values.md#64-starting-gold-experience-and-hit-dice-ds4263-ds409b-ds08b6-ds08be).)

`FUN_417f_3f31` CON bonus, summed over every class the character has (`DS:408E[CON]`): CON 3 → −2, 4–6 → −1, 7–14 → 0, 15 → +1, 16–20 → +2 (entries above 20 are garbage); a pure Fighter (class 2) gets +1 more at CON 17 and +2 more at CON 18 and above.

Gain = `max(1, Σ rolls / classes)` to the raw counter char[0xB1]; HP gain = `max(1, (Σ rolls + CON bonus) / classes)`. Because the bonus counts all classes but the roll only the trained ones, a multi-class character's CON bonus is not the tabletop value (guide 13.1).

## Derived statistics (O, `FUN_51cf_0000`, run after creation and training)

- char[0x2D] = best over **all eight** classes of `DS:3C7C[class·11 + level]` (level read signed; a class without a level reads its level-0 row, 40 in every row) = **60 − base THAC0**, which the derived statistics turn into char[0x110] (O, [records.md, "Derived statistics"](records.md#derived-statistics-o-fun_10ba_0bb8) steps 4, 6 and 7: +0x110 from +0x2D at 0x1A04–0x1A0B, bare hands then add STR to-hit at 0x1A33–0x1A48, a weapon resets it to +0x2D plus its DEX missile and STR terms)
- char[0x73] = the highest class level, only ever raised (`41d56`: max of itself and each level; a level drain sets it itself)
- Fighter level ≥ 7: char[0xA1] = 3 (3 attacks per 2 rounds), else 2 (half-attacks per round, **I**)
- Cleric level ≥ 2: slots char[0xB2..0xB4] (spell levels 1–3) from `DS:40BC[level·3 + n]`, plus WIS bonus spells (`FUN_51cf_01af`); the cleric then knows every cleric spell of any level with a slot
- Magic-User level ≥ 2: slots char[0xB5..0xB7] from `DS:41D4[level·3 + n]`
- Level 1 slots are set at creation (cleric 0xB2 = 1, magic-user 0xB5 = 1)
- saving throws (`FUN_51cf_0255`, below), and thief skills (`FUN_51cf_0329`) when the character has thief levels

### Base THAC0 by level (60 − table value)

The byte at `DS:3C7C + class·11 + level` is 60 − THAC0; values: [expected-values.md §6.5](../../D-appendices/expected-values.md#65-thac0-spell-slots-and-saving-throws-ds3c7c-ds40bc-ds41d4-ds426e).

### Spell slots (spell levels 1 / 2 / 3)

Absolute counts per level, three bytes (spell levels 1–3) at `DS:40BC + level·3` (cleric) and
`DS:41D4 + level·3` (magic-user); values: [expected-values.md §6.5](../../D-appendices/expected-values.md#65-thac0-spell-slots-and-saving-throws-ds3c7c-ds40bc-ds41d4-ds426e).

## Saving throws (O, `FUN_51cf_0255`)

char[0x6D + i] = min over the character's classes of `DS:426E[class·0x2D + level·5 + i]` (start 20). Order: death/poison, petrification, rod/staff/wand, breath, spell.

Values: [expected-values.md §6.5](../../D-appendices/expected-values.md#65-thac0-spell-slots-and-saving-throws-ds3c7c-ds40bc-ds41d4-ds426e).

## Wisdom bonus spells (O, `FUN_51cf_01af`)

Only for spell levels where the cleric already has a slot: WIS 13 → +1 first-level, 14 → +1 more first-level, 15 → +1 second-level, 16 → +1 more second-level, 17 → +1 third-level.

## Thief skills (O, `FUN_51cf_0329`)

char[0x77..0x7E] = base(thief level) + racial adjustment (+ DEX adjustment for the first five); a negative racial adjustment larger than the base gives 0. Skills: pick pockets, open locks, find/remove traps, move silently, hide in shadows, hear noise, climb walls, read languages.

The base is the byte at `DS:3CF3 + level·8 + s` (s = 1–8, the skills in the order above); values:
[expected-values.md §6.6](../../D-appendices/expected-values.md#66-thief-skills-ds3cf3-ds3d3b).

Racial adjustments: signed bytes at `DS:3D3B + race·8 + (s − 1)`; values: [expected-values.md §6.6](../../D-appendices/expected-values.md#66-thief-skills-ds3cf3-ds3d3b).

DEX adjustments (PP OL F/RT MS HS, `DS:3D4E + DEX·5`): 9: −15 −10 −10 −20 −10; 10: **−19** −5 −10 −15 −5 (AD&D has −10; likely a data typo, reproduce it); 11: −5 0 −5 −10 0; 12: 0 0 0 −5 0; 13–15: 0; 16: 0 −5 0 0 0; 17: +5 +10 0 +5 +5; 18: +10 +15 +5 +10 +10.

## Combat experience (O, `FUN_2e08_0000`)

Experience from battles (the monsters' award values, money and magic items converted to experience, the division over the party and the class bonuses) is described with the aftermath of a battle: [combat-rules.md, "Experience"](combat-rules.md#experience-o-fun_2e08_0000) and ["Award"](combat-rules.md#award-o-fun_2e08_0355). Duels give `100 × char[0x73]` to the current character.

## Open

- ~~The fifth u16 of each race's age thresholds~~: never read, O (above).
- ~~How char[0x2D] reaches char[0x110]~~: the derived statistics (above, O).
