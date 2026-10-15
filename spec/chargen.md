---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Character creation

Part of [[spec/README]]. Routine `FUN_417f_056c` (party screen "Create character"); the screen-by-screen flow, the menus and every record byte set are in [[spec/menus]] §3.

## Steps (O)

1. **Race**: Dwarf, Elf, Gnome, Half-Elf, Halfling, Human (menu entry 6 maps to Human; Half-Orc data exists but is not offered). Size byte char[0xC0]: 1 for Dwarf, Gnome, Halfling; 2 otherwise. Innate racial effects added with permanent duration:

   | Race | Innate effects ([[spec/effects]]) |
   |---|---|
   | Dwarf | 0x5A CON bonus to poison saves; 0x61 CON bonus to rod/staff/wand and spell saves; 0x1A +1 to hit orcs, goblins, hobgoblins (by monster name); 0x2F −4 to be hit by ogres, trolls, giants |
   | Elf | 0x6B 90% resistance to Sleep and Charm |
   | Gnome | 0x61 as above; 0x12 +1 to hit kobolds and goblins; 0x2F as dwarf; 0x30 −4 to be hit by bugbears and gnolls |
   | Half-Elf | 0x7C 30% resistance to Sleep and Charm |
   | Halfling | 0x5A, 0x61 as dwarf |
   | Human | none |

   Racial bonuses against monster types are matched by **monster name** strings in the engine (e.g. "ORC LEADER", "HILL GIANT").

2. **Gender**, **class** (by race only, no ability prerequisites: `DS:3E17 + race·12`; table in [[spec/menus]] §3.2), **alignment** (`DS:3FE7 + class·10`)
3. **Age** = `base + NdS` from `DS:3E5B + race·0x1C + class·4` (u16 base, u8 N, u8 S); multi-class uses the maximum (`base + N·S`) of the class column listed in the code
4. **Ability scores** (rerollable): for each stat roll **3d6 six times, keep the highest**, then:
   - racial adjustment: **never applied** (O, bug): the code tests the race-menu loop variable, which is always 7 after the menu, instead of char[0x2E]. The intended Dwarf CON +1 CHA −1, Elf DEX +1 CON −1, Halfling STR −1 DEX +1, Half-Orc STR +1 CON +1 CHA −2 are dead code; reproduce the original (no adjustment)
   - age adjustment against the race's thresholds (mature, middle-aged, old, venerable) at `DS:3F31 + race·10`: STR +1/−1/−2/−1, INT +1 at middle and venerable, WIS −1 if young then +1 at each of middle/old/venerable, DEX −2 old −1 venerable, CON −1 at each of middle/old/venerable
   - clamp to racial min/max (by gender for STR), then raise to class minimum
   - STR 18 with a Fighter level → exceptional strength `d100`, capped by race/gender
5. Defaults: current HP = max; char[0xA1]=2, [0xA3]=1, [0xA5]=2, [0xAA]=1 (natural attack, **I**), [0x72]=12
6. **Spells known** (flags at char[0x32 + spell id]): Clerics know every cleric level-1 spell; Magic-Users know Detect Magic (11), Read Magic (18), Shield (19), Sleep (21)
7. **Gold** = `10 × Σ roll(gold dice of each class) / classes` into the gold money word (char[0x8E])
8. **HP** = (level-1 roll of every class, each at least ⅔ of the die, + CON bonus) / classes, minimum 1 (see [[spec/progression]])

## Tables (O)

### Starting age `base + NdS`

| Race | Cleric | Fighter | Magic-User | Thief |
|---|---|---|---|---|
| Dwarf | 250 + 2d20 | 40 + 5d4 | – | 75 + 3d6 |
| Elf | 650 + 10d10 | 130 + 5d6 | 150 + 5d6 | 100 + 5d6 |
| Gnome | 300 + 3d12 | 60 + 5d4 | 100 + 2d12 | 80 + 5d4 |
| Half-Elf | 40 + 2d4 | 22 + 3d4 | 30 + 2d8 | 22 + 3d8 |
| Halfling | – | 20 + 3d4 | – | 40 + 2d4 |
| Human | 18 + 1d4 | 15 + 1d4 | 24 + 2d4 | 18 + 1d4 |

(Druid/Paladin/Ranger columns exist for humans: 18+1d4, 17+1d4, 20+1d4.)

### Age category thresholds (mature, middle-aged, old, venerable)

Dwarf 50/150/250/350, Elf 175/550/875/1200, Gnome 90/300/450/600, Half-Elf 40/100/175/250, Halfling 33/68/101/144, Half-Orc 15/30/45/60, Human 20/40/60/90.

### Racial ability limits (`DS:3DA3 + race·16`)

| Race | STR (M / F) | 18/xx max (M / F) | INT | WIS | DEX | CON | CHA |
|---|---|---|---|---|---|---|---|
| Dwarf | 8–18 / 8–17 | 99 / 0 | 3–18 | 3–18 | 3–17 | 12–19 | 3–16 |
| Elf | 3–18 / 3–16 | 75 / 0 | 8–18 | 3–18 | 7–19 | 6–18 | 8–18 |
| Gnome | 6–18 / 6–15 | 50 / 0 | 7–18 | 3–18 | 3–18 | 8–18 | 3–18 |
| Half-Elf | 3–18 / 3–17 | 90 / 0 | 4–18 | 3–18 | 6–18 | 6–18 | 3–18 |
| Halfling | 6–17 / 6–14 | 0 / 0 | 6–18 | 3–17 | 8–18 | 10–19 | 3–18 |
| Human | 3–18 / 3–18 | 100 / 50 | 3–18 | 3–18 | 3–18 | 3–18 | 3–18 |

### Class minimums (STR INT WIS DEX CON CHA, `DS:3F81 + class·6`)

Cleric 6 6 9 – – –; Druid – – 12 – – 15; Fighter 9 – 6 6 7 –; Paladin 13 9 12 – 9 17; Ranger – 13 14 – 14 –; Magic-User – 9 6 6 – –; Thief 6 6 – 9 – –; Monk 15 – 15 15 11 –.

### Starting gold dice (× 10 gp, `DS:4263`)

Cleric 3d6, Druid 3d6, Fighter 5d4, Paladin 5d4, Ranger 5d4, Magic-User 2d4, Thief 2d6, Monk 5d4.

## Open

- Where thief skills are recomputed with the real DEX (creation computes them before abilities exist, so with DEX 0)
