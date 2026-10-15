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

## Open

- HP dice per class (`FUN_417f_4235`) and CON bonus table (`FUN_417f_3f31`)
- Experience awards per monster (`FUN_2e08_0000`)
- Thief skills, turn undead table, spell slots per level
