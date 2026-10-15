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

## Training (O, `FUN_417f_29ae`)

- Needs status Okay and at least 1000 gp (`FUN_4894_28be` totals money), unless free training (`DS:470C`)
- Class trainer bits (`DS:05DE`): Cleric 2, Druid 2, Fighter 8, Paladin 10, Ranger 10, Magic-User 1, Thief 4, Monk 6. The hall trains classes in the script-set mask `B[0x550]` ("We don't train that class here")
- Experience above what is needed is **capped at one point below the following level's threshold**, so one training session gains at most one level per class
- On "Y": pay 1000 gp (`FUN_417f_42ed`); every eligible class gains a level; if the thief/other spell-related byte pair 0x74/0x75 is non-zero it is reduced (**?**); `FUN_51cf_0000` updates derived stats
- If the magic-user level rose, the player picks a new spell to learn (`FUN_4894_299c`), marked in the spell-known list at char[0x32 + spell] (**I**)
- **HP gain**: roll `FUN_417f_4235(classes)`, divide by number of classes (min 1), add CON bonus (`FUN_417f_3f31`) and divide again; max and current HP both rise by that amount. A byte at char[0xB1] accumulates the raw roll (**?**)

## Hit points per level (O)

`FUN_417f_4235`: for each class gaining a level, roll `count × d(sides)` from `DS:08B6` / `DS:08BE`; when the class was level 1, the roll is raised to at least `2·sides/3`.

| Class | Cleric | Druid | Fighter | Paladin | Ranger | Magic-User | Thief | Monk |
|---|---|---|---|---|---|---|---|---|
| Hit dice | 1d8 | 1d8 | 1d10 | 1d10 | 2d8 | 1d4 | 1d6 | 2d4 |

`FUN_417f_3f31` CON bonus, per class the character has (`DS:408E[CON]`): CON 3 → −2, 4–6 → −1, 7–14 → 0, 15 → +1, 16–18 → +2; a pure Fighter (class 2) gets +1 more at CON 17 and +2 more at CON 18.

Gain = `max(1, Σ rolls / classes)` to the raw counter char[0xB1]; HP gain = `max(1, (Σ rolls + CON bonus) / classes)`.

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

## Combat experience (O, `FUN_2e08_0000`)

Summed over monsters (side 1) that did not flee (status ≠ Running):

- `xp += word[0xB8] + byte[0xBA] × byte[0xB1]` (base value + value per hit die/point, **I** on field names)
- the monster's 7 money words go into the treasure table (`DS:67F4`)
- its items go into the treasure list if they have a value (item[0x3A] ≠ 0), else with 30% chance (d10 < 4), at most 8 such drops
- plus a share of the treasure money converted to experience (Turbo Pascal real arithmetic, **?** exact rates), plus **400 × plus** for each magic item in the treasure
- Result distributed by `FUN_2e08_0355` (**?** split rule)
- Special case (non-combat resolution `DS:84D4` with `B[0x5CC]` set): `100 × char[0x73]` of the current character

## Open

- Thief skills (`FUN_51cf_0329`), WIS bonus spells (`FUN_51cf_01af`), STR to-hit/damage adjustments
