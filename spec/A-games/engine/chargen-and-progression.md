---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Experience, training and levels

Part of [[spec/README]].

## Experience table (O)

`DS:409B + class × 0x38 + k × 4`, u32. Entry `k` is the experience needed for level `k`; the trainer compares the character's experience with entry `level + 1`. 0xFFFFFFFF = cannot reach.

| Class | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Max |
|---|---|---|---|---|---|---|---|---|---|
| Cleric | 1 501 | 3 001 | 6 001 | 13 001 | 27 501 | – | – | – | 6 |
| Fighter | 2 001 | 4 001 | 8 001 | 18 001 | 35 001 | 70 001 | 125 001 | – | 8 |
| Magic-User | 2 501 | 5 001 | 10 001 | 22 501 | 40 001 | – | – | – | 6 |
| Thief | 1 251 | 2 501 | 5 001 | 10 001 | 20 001 | 42 501 | 70 001 | 110 001 | 9 |
| Druid, Paladin, Ranger, Monk | – | – | – | – | – | – | – | – | 1 |

Values equal the AD&D 1st edition tables; the caps are Pool of Radiance's.

## Demi-human level limits (O, `FUN_417f_29ae`)

Training is refused ("Not Enough Experience" path skipped) when the character is at:

| Race | Class | Limit |
|---|---|---|
| Dwarf | Fighter | 7 (STR < 17), 8 (STR 17), 9 (STR 18) |
| Elf | Fighter | 5 (STR < 17), 6 (STR 17), 7 (STR 18) |
| Gnome | Fighter | 5 (STR < 18), 6 (STR 18) |
| Half-Elf | Cleric | 5 |
| Half-Elf | Fighter | 6 (STR < 17), 7 (STR 17), 8 (STR 18) |
| Halfling | Fighter | 4 (STR < 17), 5 (STR 17), 6 (STR 18) |

Only these fighter limits and the half-elf cleric limit are coded. The middle rows test STR = 17 exactly and the bottom rows STR < 17 (gnome: < 18), on char[0x10] without exceptional strength, so STR 19 and above behaves like 18. A class at its limit is skipped; the character gets "Not Enough Experience" only if no other class qualifies. The guide's (7.7.3) elf and half-elf magic-user limits are above the game's cap of 6 and need no code.

## Training halls (O)

New Phlan's training hall is `ECL3` record 11. Each door stores a class mask in ECL **0x6DA8** (`B[0x550]`), prints "'WE TRAIN ONLY *class* HERE. DO YOU WANT TO TRAIN?'" and runs `PROGRAM 0` (the party screen, whose **T**rain entry is enabled only while 0x6DA8 ≠ 0 or the cheat is on, [[spec/menus]]):

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
12. If the magic-user level (char[0x9B]) rose: pick one new spell (`FUN_4894_299c` mode 4 "Spells to choose from", select type 4), repeated until a spell is picked. The list holds every id 1–56 not yet known whose class and level have a slot (char[0xB1 + class·3 + level] > 0); for a cleric/magic-user the cleric spells are already known, so in practice it lists magic-user spells of the levels just reached. The pick sets char[0x32 + id] = 1. **Bug**: if the list is empty the loop ends with id 0 and writes char[0x32] = 1, i.e. **max HP := 1**, before step 13 adds the gain. A port should reproduce this or record the fix in IMPROVEMENTS.md.
13. Hit points: R = `FUN_417f_4235(char, train)` (rolls for the trained classes only). char[0xB1] += max(1, R div *k*). C = `FUN_417f_3f31(char)` (CON bonus summed over **all** *k* classes). Gain = max(1, (R + C) div *k*), signed division truncating towards 0. Damage taken is kept: max HP += gain, current HP = max HP − (old max − old current). Both are bytes (wrap above 255).

Training takes no game time. One session gains at most one level per class.

### Payment (O, `FUN_417f_42ed(gp, char)`)

Coin values in copper (`DS:0D24`): cp 1, sp 10, ep 100, gp 200, pp 1000. The price is converted to copper (× 200).

1. For cp, sp, ep, gp, pp in that order, while something is owed: n = min(held, owed div value + 1); held −= n; owed −= n × value.
2. If overpaid, give the change back from pp down to cp: n = change div value; held += n; change −= n × value.

### Free training cheat (O, `FUN_417f_0161` at `417f:04ad`)

Pressing **J** on the party screen compares the first command-line parameter (`ParamStr(1)`) with "STING". If it matches: `DS:470C` = 1 and "I Understand, master...". Nothing is typed after J; [[spec/menus]] and [[spec/architecture]] describe it as typing STING, which is wrong. `DS:470C` is reset to 0 every time the party screen is entered.

With the cheat, training skips the status, money, experience and hall checks and charges nothing; every class not at its game or demi-human cap gains a level at once. XP is still truncated as in step 4. The Train entry is enabled even outside a hall (G: guide 11.1 "J: train for free").

## Hit points per level (O)

`FUN_417f_4235`: for each class in the mask, roll `count × d(sides)` from `DS:08B6` / `DS:08BE`; when that class's level is 1, the roll is raised to at least `2·sides/3`. Training raises the levels before rolling, so the minimum applies only at character creation (the guide, 12.6.3, says the function "is also called for later levels"; true, but no level is 1 then).

| Class | Cleric | Druid | Fighter | Paladin | Ranger | Magic-User | Thief | Monk |
|---|---|---|---|---|---|---|---|---|
| Hit dice | 1d8 | 1d8 | 1d10 | 1d10 | 2d8 | 1d4 | 1d6 | 2d4 |

`FUN_417f_3f31` CON bonus, summed over every class the character has (`DS:408E[CON]`): CON 3 → −2, 4–6 → −1, 7–14 → 0, 15 → +1, 16–20 → +2 (entries above 20 are garbage); a pure Fighter (class 2) gets +1 more at CON 17 and +2 more at CON 18 and above.

Gain = `max(1, Σ rolls / classes)` to the raw counter char[0xB1]; HP gain = `max(1, (Σ rolls + CON bonus) / classes)`. Because the bonus counts all classes but the roll only the trained ones, a multi-class character's CON bonus is not the tabletop value (guide 13.1).

## Derived statistics (O, `FUN_51cf_0000`, run after creation and training)

- char[0x2D] = best over classes of `DS:3C7C[class·11 + level]` = **60 − base THAC0** (then adjusted by STR etc. into char[0x110], **I**)
- char[0x73] = highest class level
- Fighter level ≥ 7: char[0xA1] = 3 (3 attacks per 2 rounds), else 2 (half-attacks per round, **I**)
- Cleric level ≥ 2: slots char[0xB2..0xB4] (spell levels 1–3) from `DS:40BC[level·3 + n]`, plus WIS bonus spells (`FUN_51cf_01af`); the cleric then knows every cleric spell of any level with a slot
- Magic-User level ≥ 2: slots char[0xB5..0xB7] from `DS:41D4[level·3 + n]`
- Level 1 slots are set at creation (cleric 0xB2 = 1, magic-user 0xB5 = 1)
- `FUN_51cf_0255` (**?**), and thief skills (`FUN_51cf_0329`) when the character has thief levels

### Base THAC0 by level (60 − table value)

| Class | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cleric, Druid, Monk | 20 | 20 | 20 | 18 | 18 | 18 | 16 | 16 | 16 | 14 |
| Fighter, Paladin, Ranger | 20 | 19 | 18 | 17 | 16 | 15 | 14 | 13 | 12 | 11 |
| Magic-User | 20 | 20 | 20 | 20 | 20 | 19 | 19 | 19 | 19 | 19 |
| Thief | 20 | 20 | 20 | 20 | 19 | 19 | 19 | 19 | 16 | 16 |

### Spell slots (spell levels 1 / 2 / 3)

| Level | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Cleric | 1 / 0 / 0 | 2 / 0 / 0 | 2 / 1 / 0 | 3 / 2 / 0 | 3 / 3 / 1 | 3 / 3 / 2 |
| Magic-User | 1 / 0 / 0 | 2 / 0 / 0 | 2 / 1 / 0 | 3 / 2 / 0 | 4 / 2 / 1 | 4 / 2 / 2 |

## Saving throws (O, `FUN_51cf_0255`)

char[0x6D + i] = min over the character's classes of `DS:426E[class·0x2D + level·5 + i]` (start 20). Order: death/poison, petrification, rod/staff/wand, breath, spell.

| Level | Cleric | Fighter | Magic-User | Thief |
|---|---|---|---|---|
| 1–2 | 10 13 14 16 15 | 14 15 16 17 17 | 14 13 11 15 12 | 13 12 14 16 15 |
| 3–4 | 10/9 13/12 14/13 16/15 15/14 (4+) | 13 14 15 16 16 | 14 13 11 15 12 | 13 12 14 16 15 |
| 5–6 | 9 12 13 15 14 | 11 12 13 13 14 | 14 13 11 15 12 (6: 13 11 9 13 10) | 12 11 12 15 13 |
| 7–8 | 7 10 11 13 12 | 10 11 12 12 13 | 13 11 9 13 10 | 12 11 12 15 13 |

(Cleric changes at 4 and 7, fighter at 3, 5, 7, magic-user at 6, thief at 5 — the AD&D 1st edition tables.)

## Wisdom bonus spells (O, `FUN_51cf_01af`)

Only for spell levels where the cleric already has a slot: WIS 13 → +1 first-level, 14 → +1 more first-level, 15 → +1 second-level, 16 → +1 more second-level, 17 → +1 third-level.

## Thief skills (O, `FUN_51cf_0329`)

char[0x77..0x7E] = base(thief level) + racial adjustment (+ DEX adjustment for the first five); a negative racial adjustment larger than the base gives 0. Skills: pick pockets, open locks, find/remove traps, move silently, hide in shadows, hear noise, climb walls, read languages.

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

DEX adjustments (PP OL F/RT MS HS, `DS:3D4E + DEX·5`): 9: −15 −10 −10 −20 −10; 10: **−19** −5 −10 −15 −5 (AD&D has −10; likely a data typo, reproduce it); 11: −5 0 −5 −10 0; 12: 0 0 0 −5 0; 13–15: 0; 16: 0 −5 0 0 0; 17: +5 +10 0 +5 +5; 18: +10 +15 +5 +10 +10.

## Combat experience (O, `FUN_2e08_0000`)

Summed over monsters (side 1) that did not flee (status ≠ Running):

- `xp += word[0xB8] + byte[0xBA] × byte[0xB1]` (base value + value per hit die/point, **I** on field names)
- the monster's 7 money words go into the treasure table (`DS:67F4`)
- its items go into the treasure list if they have a value (item[0x3A] ≠ 0), else with 30% chance (d10 < 4), at most 8 such drops
- plus a share of the treasure money converted to experience (Turbo Pascal real arithmetic, **?** exact rates), plus **400 × plus** for each magic item in the treasure
- Result distributed by `FUN_2e08_0355` (**?** split rule)
- Special case (non-combat resolution `DS:84D4` with `B[0x5CC]` set): `100 × char[0x73]` of the current character

## Open

- STR/DEX to-hit, damage and AC adjustments; where thief skills are rolled
