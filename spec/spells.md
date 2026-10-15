---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Spells

Part of [[spec/README]]. Extractor: `tools/spells.py` (reads the unpacked `START.EXE`).

## Tables (O)

- **Names**: DS:2912, 56 entries × 41 bytes (Pascal string). Spell id = index + 1
- **Records**: DS:31FA + id × 16 (engine code addresses fields as `DS:31FC + id*16` + n, i.e. from byte 2)

| Byte | Field | Evidence |
|---|---|---|
| 0 | class: 0 Cleric, 1 Magic-User | O (matches AD&D for all 56) |
| 1 | spell level | O (Restoration = 7) |
| 2, 3 | range = b2 + b3 × caster level; b2 = 0xFF → touch (needs to-hit roll) | O (`FUN_4e53_0729`, `FUN_4e53_08c3`) |
| 4, 5 | duration = b4 + b5 × caster level (units per spell, **I**) | I (values match AD&D) |
| 6 | target mode: 0 self, 4 one creature, 6/7 several, 8–11 area shapes, 31 silence, 240 special | O/I |
| 7 | side: 0 enemy, 1 self, 2 ally, 4 party | I |
| 8 | saving throw effect: 0 none, 1 negates, 2 half, 3 special | O (`FUN_5216_1344`) |
| 9 | save category (index into char bytes 0x6D–0x71) | O (`FUN_5216_0d63`) |
| 10 | effect type applied to targets (0 = immediate only) | O (`FUN_5216_1656`) |
| 11 | where: 0 camp only, 1 combat only, 2 both | O (`FUN_3aae_2414` refuses 0 in combat) |
| 12 | casting time; initiative is reduced by `time / 3` (0 → cast at once) | O |
| 13 | AI priority (spell considered when pass priority ≤ this) | O (`FUN_3334_02eb`) |
| 14 | AI: hostile spell (aim at enemies); Cure Light Wounds (id 3) is special-cased to heal | O |
| 15 | area radius for area spells (template drawn by `FUN_56c1_0909`) | O |

Range when casting from an item (`DS:6DBF` set) uses caster level 6.

## Casting (O)

- `FUN_3aae_2414(spell)`: refuses camp-only spells in combat; with cast time 0 casts immediately (`FUN_4e53_0c20`), otherwise stores the spell in the combat record [0] and lowers initiative by `time/3` (minimum 1); the spell goes off on the caster's later turn
- `FUN_3aae_1e16`: target selection, checking range (`FUN_3aae_37e4`), area templates and avoiding friendly fire for area spells (the AI rejects an area that would include its own side)
- `FUN_4e53_08c3`: for each target: touch spells roll to-hit vs AC; saving throw if byte 8 ≠ 0; immediate effect (`FUN_5216_1344`); then add the effect type with its duration (`FUN_5216_1656`)

## Spell list

| id | name | class | lvl | range | duration | target | side | save | vs | effect | where | time | AI pri | AI off | area |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bless | Cleric | 1 | 6+0/lvl | 6+0/lvl | 10 | 4 | - | spell | 0x01 | both | 10 | 2 | 0 | 0 |
| 2 | Curse | Cleric | 1 | 6+0/lvl | 6+0/lvl | 10 | 0 | - | spell | 0x02 | combat | 10 | 3 | 1 | 0 |
| 3 | Cure Light Wounds | Cleric | 1 | 0+0/lvl | 0+0/lvl | 4 | 2 | - | spell | 0x00 | both | 5 | 1 | 0 | 0 |
| 4 | Cause Light Wounds | Cleric | 1 | touch | 0+0/lvl | 4 | 0 | - | spell | 0x00 | combat | 5 | 2 | 1 | 0 |
| 5 | Detect Magic | Cleric | 1 | 3+0/lvl | 10+0/lvl | 0 | 1 | - | spell | 0x05 | both | 1 | 0 | 0 | 0 |
| 6 | Protection From Evil | Cleric | 1 | 0+0/lvl | 0+3/lvl | 4 | 2 | - | spell | 0x08 | both | 4 | 1 | 0 | 0 |
| 7 | Protection from Good | Cleric | 1 | 0+0/lvl | 0+3/lvl | 4 | 2 | - | spell | 0x09 | both | 4 | 2 | 0 | 0 |
| 8 | Resist Cold | Cleric | 1 | 0+0/lvl | 0+10/lvl | 4 | 2 | - | spell | 0x0A | both | 10 | 0 | 0 | 0 |
| 9 | Burning Hands | Magic-User | 1 | 0+0/lvl | 0+0/lvl | 4 | 0 | - | spell | 0x00 | combat | 1 | 4 | 1 | 0 |
| 10 | Charm Person | Magic-User | 1 | 12+0/lvl | 0+0/lvl | 4 | 0 | negates | spell | 0x0B | combat | 1 | 6 | 1 | 0 |
| 11 | Detect Magic | Magic-User | 1 | 0+0/lvl | 0+2/lvl | 0 | 1 | - | spell | 0x05 | both | 1 | 0 | 0 | 0 |
| 12 | Enlarge | Magic-User | 1 | 0+2/lvl | 0+10/lvl | 4 | 2 | - | spell | 0x0C | both | 1 | 0 | 0 | 0 |
| 13 | Reduce | Magic-User | 1 | 0+2/lvl | 0+10/lvl | 4 | 2 | negates | spell | 0x0D | both | 1 | 0 | 1 | 0 |
| 14 | Friends | Magic-User | 1 | 0+0/lvl | 0+1/lvl | 0 | 1 | - | spell | 0x0E | camp | 1 | 0 | 0 | 0 |
| 15 | Magic Missile | Magic-User | 1 | 6+4/lvl | 0+0/lvl | 4 | 0 | - | spell | 0x00 | combat | 1 | 6 | 1 | 0 |
| 16 | Protection From Evil | Magic-User | 1 | 0+0/lvl | 0+2/lvl | 4 | 2 | - | spell | 0x08 | both | 1 | 1 | 0 | 0 |
| 17 | Protection From Good | Magic-User | 1 | 0+0/lvl | 0+2/lvl | 4 | 2 | - | spell | 0x09 | both | 1 | 2 | 0 | 0 |
| 18 | Read Magic | Magic-User | 1 | 0+0/lvl | 0+2/lvl | 0 | 1 | - | spell | 0x10 | camp | 10 | 0 | 0 | 0 |
| 19 | Shield | Magic-User | 1 | 0+0/lvl | 0+5/lvl | 0 | 1 | - | spell | 0x11 | both | 1 | 3 | 0 | 0 |
| 20 | Shocking Grasp | Magic-User | 1 | touch | 0+0/lvl | 4 | 0 | - | spell | 0x00 | combat | 1 | 4 | 1 | 0 |
| 21 | Sleep | Magic-User | 1 | 3+4/lvl | 0+5/lvl | 9 | 0 | - | spell | 0x35 | combat | 1 | 7 | 1 | 1 |
| 22 | Find Traps | Cleric | 2 | 0+0/lvl | 30+0/lvl | 0 | 1 | - | spell | 0x13 | camp | 5 | 0 | 0 | 0 |
| 23 | Hold Person | Cleric | 2 | 6+0/lvl | 4+1/lvl | 6 | 0 | negates | spell | 0x34 | combat | 5 | 7 | 1 | 0 |
| 24 | Resist Fire | Cleric | 2 | 0+0/lvl | 0+10/lvl | 4 | 2 | - | spell | 0x14 | both | 5 | 2 | 0 | 0 |
| 25 | Silence, 15' Radius | Cleric | 2 | 12+0/lvl | 0+2/lvl | 31 | 0 | special | spell | 0x15 | combat | 5 | 4 | 1 | 1 |
| 26 | Slow Poison | Cleric | 2 | 0+0/lvl | 0+60/lvl | 4 | 2 | - | spell | 0x16 | both | 1 | 0 | 0 | 0 |
| 27 | Snake Charm | Cleric | 2 | 3+0/lvl | 0+0/lvl | 240 | 0 | - | spell | 0x33 | combat | 5 | 0 | 1 | 0 |
| 28 | Spiritual Hammer | Cleric | 2 | 3+0/lvl | 0+1/lvl | 0 | 1 | - | spell | 0x17 | both | 5 | 1 | 0 | 0 |
| 29 | Detect Invisibility | Magic-User | 2 | 0+4/lvl | 0+5/lvl | 0 | 1 | - | spell | 0x18 | both | 2 | 1 | 0 | 0 |
| 30 | Invisibility | Magic-User | 2 | 0+0/lvl | 0+0/lvl | 4 | 2 | - | spell | 0x19 | both | 2 | 2 | 0 | 0 |
| 31 | Knock | Magic-User | 2 | 0+0/lvl | 0+0/lvl | 0 | 0 | - | spell | 0x00 | camp | 1 | 0 | 0 | 0 |
| 32 | Mirror Image | Magic-User | 2 | 0+0/lvl | 0+2/lvl | 0 | 1 | - | spell | 0x1C | both | 2 | 3 | 0 | 0 |
| 33 | Ray of Enfeeblement | Magic-User | 2 | 1+1/lvl | 0+1/lvl | 4 | 0 | negates | spell | 0x1D | combat | 2 | 2 | 1 | 0 |
| 34 | Stinking Cloud | Magic-User | 2 | 3+0/lvl | 0+1/lvl | 9 | 0 | special | death/poison | 0x1E | combat | 2 | 7 | 1 | 1 |
| 35 | Strength | Magic-User | 2 | 0+0/lvl | 0+60/lvl | 0 | 2 | - | spell | 0x26 | camp | 10 | 0 | 0 | 0 |
| 36 | Animate Dead | Cleric | 3 | 1+0/lvl | 0+0/lvl | 240 | 4 | - | spell | 0x20 | both | 10 | 2 | 0 | 0 |
| 37 | Cure Blindness | Cleric | 3 | 0+0/lvl | 0+0/lvl | 4 | 2 | - | spell | 0x00 | both | 10 | 0 | 0 | 0 |
| 38 | Cause Blindness | Cleric | 3 | touch | 0+0/lvl | 4 | 0 | negates | spell | 0x21 | combat | 10 | 3 | 1 | 0 |
| 39 | Cure Disease | Cleric | 3 | 0+0/lvl | 0+0/lvl | 0 | 2 | - | spell | 0x00 | camp | 100 | 0 | 0 | 0 |
| 40 | Cause Disease | Cleric | 3 | touch | 0+0/lvl | 4 | 0 | negates | spell | 0x22 | combat | 100 | 4 | 1 | 0 |
| 41 | Dispel Magic | Cleric | 3 | 6+0/lvl | 0+0/lvl | 9 | 2 | - | spell | 0x00 | both | 4 | 5 | 1 | 1 |
| 42 | Prayer | Cleric | 3 | 0+0/lvl | 0+1/lvl | 0 | 1 | - | spell | 0x31 | both | 6 | 6 | 0 | 0 |
| 43 | Remove Curse | Cleric | 3 | 0+0/lvl | 0+0/lvl | 4 | 2 | - | spell | 0x00 | both | 6 | 0 | 0 | 0 |
| 44 | Bestow Curse | Cleric | 3 | touch | 0+10/lvl | 4 | 0 | negates | spell | 0x24 | combat | 6 | 4 | 1 | 0 |
| 45 | Blink | Magic-User | 3 | 0+0/lvl | 0+1/lvl | 0 | 1 | - | spell | 0x25 | combat | 1 | 2 | 0 | 0 |
| 46 | Dispel Magic | Magic-User | 3 | 12+0/lvl | 0+1/lvl | 9 | 2 | - | spell | 0x00 | both | 3 | 2 | 1 | 1 |
| 47 | Fireball | Magic-User | 3 | 10+1/lvl | 0+0/lvl | 11 | 0 | half | spell | 0x00 | combat | 3 | 7 | 1 | 3 |
| 48 | Haste | Magic-User | 3 | 6+0/lvl | 3+1/lvl | 10 | 4 | - | spell | 0x27 | both | 3 | 3 | 0 | 0 |
| 49 | Hold Person | Magic-User | 3 | 12+0/lvl | 0+2/lvl | 7 | 0 | negates | spell | 0x34 | combat | 3 | 6 | 1 | 0 |
| 50 | Invisibility, 10' Radius | Magic-User | 3 | 0+0/lvl | 0+0/lvl | 9 | 4 | - | spell | 0x19 | both | 3 | 1 | 0 | 0 |
| 51 | Lightning Bolt | Magic-User | 3 | 4+1/lvl | 0+0/lvl | 8 | 0 | half | spell | 0x00 | combat | 3 | 7 | 1 | 0 |
| 52 | Protection From Evil, 10' Radius | Magic-User | 3 | 0+0/lvl | 0+2/lvl | 4 | 2 | - | spell | 0x2D | both | 3 | 1 | 0 | 0 |
| 53 | Protection From Good, 10' Radius | Magic-User | 3 | 0+0/lvl | 0+2/lvl | 4 | 2 | - | spell | 0x2E | both | 3 | 2 | 0 | 0 |
| 54 | Protection From Normal Missiles | Magic-User | 3 | 0+0/lvl | 0+10/lvl | 4 | 2 | - | spell | 0x29 | both | 3 | 3 | 0 | 0 |
| 55 | Slow | Magic-User | 3 | 9+1/lvl | 3+1/lvl | 10 | 0 | - | spell | 0x2A | combat | 3 | 5 | 1 | 0 |
| 56 | Restoration | Cleric | 7 | 0+0/lvl | 0+0/lvl | 4 | 2 | - | spell | 0x00 | both | 6 | 0 | 0 | 0 |

Ranges are in game squares; durations are in the engine's units (rounds for most combat spells). Two "Detect Magic", "Protection From Evil/Good" and "Dispel Magic" entries exist because cleric and magic-user versions differ.

## Open

- Effect type handlers (`FUN_5216_02fa` dispatch) and what each effect does per event
- Haste/Slow: spell table gives Haste effect 0x27 and Slow 0x2A, but the character sheet doubles movement for 0x2A and halves it for 0x27; `FUN_10ba_2199` semantics need checking
- Immediate effects (damage spells, cures) in `FUN_5216_1344`
- Spell memorisation and learning rules, spell slots per level
