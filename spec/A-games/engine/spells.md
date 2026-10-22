---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Spells

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Evidence marks as in the README. *Informative:* reference extractor
> `tools/spells.py` (reads the unpacked `START.EXE`). Curse of the Azure Bonds:
> [coab/spells.md](../coab/spells.md).

## Tables (O)

- **Names**: DS:2912, 56 entries × 41 bytes (Pascal string). Spell id = index + 1
- **Records**: DS:31FA + id × 16 (engine code addresses fields as `DS:31FC + id*16` + n, i.e. from byte 2)
- Ids 57–67 are the item-only spells (class 2, level 6): their records follow id 56 in the same table, and they have no names (the names table ends at 56, where the records begin). Items reach them as item[0x3D] − 0x17

| Byte | Field | Evidence |
|---|---|---|
| 0 | class: 0 Cleric, 1 Magic-User | O (matches AD&D for all 56) |
| 1 | spell level | O (Restoration = 7) |
| 2, 3 | range = b2 + b3 × caster level; b2 = 0xFF → touch (needs to-hit roll) | O (`FUN_4e53_0729`, `FUN_4e53_08c3`) |
| 4, 5 | duration = b4 + b5 × caster level (units per spell, **I**) | I (values match AD&D) |
| 6 | target mode: 0 self, 4 one creature, 6/7 several, 8–11 area shapes, 31 silence, 240 special | O/I |
| 7 | side: 0 enemy, 1 self, 2 ally, 4 party. Outside combat it picks the targets: 1 the caster, 2 one picked ("Cast Spell on whom"), 4 the whole party; 0 is combat-only | O (`FUN_4e53_0a91`) |
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

- `FUN_4e53_331a` announces a cast: in combat "<name> Casts a Spell" with the pause, then "Spell: <name of spell>" on the status line; outside combat the caster's name and the verb on one row, the spell's name below, then the pause
- `FUN_3aae_2414(spell)`: refuses camp-only spells in combat; with cast time 0 casts immediately (`FUN_4e53_0c20`), otherwise stores the spell in the combat record [0] and lowers initiative by `time/3` (minimum 1); the spell goes off on the caster's later turn
- `FUN_3aae_1e16`: target selection, checking range (`FUN_3aae_37e4`), area templates and avoiding friendly fire for area spells (the AI rejects an area that would include its own side)
- `FUN_4e53_08c3`: for each target: touch spells roll to-hit vs AC; saving throw if byte 8 ≠ 0; immediate effect (`FUN_5216_1344`); then add the effect type with its duration (`FUN_5216_1656`)

### Casting outside combat (O, `FUN_4e53_0c20(spell, ?, from_memory)`)

Camp Cast and the explore-mode Cast command ([camp-and-time.md](camp-and-time.md)) call the shared routine directly; casting takes no game time (G: guide 8.1).

- Outside combat (`DS:49F3` ≠ 5) a spell whose record **byte 7 (side) = 0** is refused, whatever byte 11 says: "*spell* is a combat-only spell..." then "Lose it? ". **Y** removes it from memory (`FUN_10ba_148b`); either way nothing is cast. Knock (id 31, byte 11 = camp, side 0) is caught by this too; doors use their own Knock path ([main-loop.md](main-loop.md)).
- From an item (`DS:6DBF` set) the same test prints "That Item is a combat-only item..." and "Use it? "; **Y** sets the caller's used-up flag (**I**: the charge is spent).
- Byte 11 (where) is checked only in combat (`FUN_3aae_2414`).

## Memorisation, scribing and learning

Rules are in [camp-and-time.md](camp-and-time.md) (Memorize, Scribe, Rest) and [chargen-and-progression.md](chargen-and-progression.md) (slots per level, Wisdom bonus, the spell picked at each magic-user level). In short:

- A spell is cast from one of the 21 memorised slots char[0x17..0x2B]. Memorising picks a known spell (char[0x32 + id]) of a class and level with a free slot and stores id + 0x80 (pending); resting turns it into id.
- Rest time: 4 hours (6 if any pending spell is level 3) plus 15 minutes per spell level, for memorised and scribed spells together.
- Clerics know every cleric spell of each level they have a slot for. Magic-users start with Detect Magic, Read Magic, Shield and Sleep ([chargen-and-progression.md](chargen-and-progression.md)), learn one spell per magic-user level gained, and scribe more from scrolls (needs Read Magic to read them).
- Restoration (id 56, level 7) is never in a spell book and has no slot; it is used from scrolls only.

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

Ranges are in game squares. Durations are in **minutes**, the unit of effect records (O: the clock's effect time-out, [camp-and-time.md](camp-and-time.md)); 1 combat round = 1 minute, and the values match AD&D (Resist Cold 1 turn = 10 minutes per level, Strength and Slow Poison 1 hour per level; **I** that `FUN_5216_1656` applies them unscaled). Two "Detect Magic", "Protection From Evil/Good" and "Dispel Magic" entries exist because cleric and magic-user versions differ.

## Spell effects (O, segment 4e53)

### Dispatch

`FUN_4e53_3413` fills the far-pointer table `DS:6B84 + 4·id`. Entry 0 is the target-selection hook: `FUN_4e53_0a91` outside combat, `FUN_3aae_20c3` in combat ([combat-rules.md](combat-rules.md), Spell targets). `FUN_4e53_0c20` sets `DS:681B` = id, calls `[6B84 + 4·id]`, then clears `DS:681B` and `DS:6820`. Targets: count `DS:6C94`, far pointers at `DS:6C95 + 4·(i−1)`.

### Shared helpers

- **Apply** `FUN_4e53_08c3(spell, lvlOverride, removalFlag, dmg, dmgType, msg)`: `DS:6819` = dmgType when dmg > 0; level = lvlOverride or the caster level. For each non-nil target in order:
  1. byte 8 ≠ 0: saved = save(target, type = byte 9, bonus 0) (`FUN_5216_0d63`)
  2. touch (byte 2 = 0xFF): recompute AC, event 11, roll to hit against the front AC (`FUN_5216_0cb7(caster, target, target[0x111])`); a miss sets dmg = 0 and saved = 1
  3. dmg > 0: damage (`FUN_5216_1344(target, dmg, mode = byte 8, saved)`) — the **same roll for every target**
  4. byte 10 ≠ 0: add the effect (`FUN_5216_1656(target, effect, duration, power = level, removalFlag, byte 8, saved, msg)`)
- **Damage** `FUN_5216_1344`: `DS:6818` = dmg; effect event 6 (resistances, Shield and the like adjust it here, before the save); if saved, mode 1 → 0, mode 2 → dmg div 2; then HP loss.
- **HP loss** `FUN_10ba_2228`: over = dmg − HP. over > 9, or HP 0 on an Animated (status 1) target → Dead (6); over > 0 → Dying (5) with combat record [0xE] = over; exactly 0 → Unconscious (4).
  - **Bug**: the previous status is not checked, so a Dead or Stoned target at 0 HP hit for 1–9 becomes Dying (the guide's "raise the dead with damage spells", 11.2).
  - **Bug**: a Dying target hit again gets [0xE] = the new damage, not a running total.
  - Damage clears the victim's combat record [1]; if it had a spell queued, `FUN_10ba_148b` removes that spell from the **current character** (the attacker or caster), as in melee.
- **Add effect** `FUN_5216_1656`: refused ("is unaffected") if effect event 9 blocks it, or if saved **and byte 8 = 1** (saves of kind 2 and 3 never stop the effect itself). An existing effect of the same type is replaced only if the new duration is longer or 0; otherwise a duplicate is added.
- **Heal** `FUN_5216_175d(char, amount, force)`: statuses 0, 1, 4, 5 only; without force, blocked by effect 0x32 (mummy rot). HP += amount, capped at max. Dying → Unconscious; outside combat an Unconscious character is revived (handler 0x4E); in combat it stays down.
- **Caster level** `FUN_10ba_26c2`: class 0 → cleric level char[0x96], class 1 → magic-user level char[0x9B], class 2 (item-only spells) → 12; from an item (`DS:6DBF`), class 0/1 spells use 6.
- **Duration** `FUN_4e53_07d6`: byte 4 + byte 5 × level, in minutes, except: 40 → 1d6×10; 57, 61 → 5d4; 59 → 1d4×10 + 40; 63 → 2d10×10 in combat, else (1d10+10)×10; 67 → 1440.
- Dice `FUN_5216_0de3` return a byte (count 0 → 0); `FUN_5216_0e2e` also stores the count in `DS:681C` (read by the fire resistances 0x3D, 0x71 and handler 0x7A). The spell handlers that roll through it: 4 (10bd), 15 (1460), 20 (14e9), 47/64 (2744), 65 (306e); Burning Hands, Lightning Bolt and the Javelin roll without it, so the count left from an earlier roll stands (O, every far call to `00b0:004d` in 4e53). Damage types (`DS:6819`): 1 fire, 2 cold, 4 electric, 8 magic.

### Per spell

L = caster level; "1st" = only the first target is used.

| id | Spell | Routine | Immediate effect | Save | Targets | Notes |
|---|---|---|---|---|---|---|
| 1 | Bless | 100f → 0f4f | effect 0x01 | — | drops targets not on the caster's side; in combat also anyone with an enemy adjacent | |
| 2 | Curse | 1040 → 0f4f | effect 0x02 | — | enemies only | |
| 3 | Cure Light Wounds | 106b | heal 1d8 (no force); if it took, "is fully healed" / "is partially healed" (`FUN_10ba_234a`, also after regeneration 62 and mummy rot 50 heal), in and out of combat | — | 1st | no revive in combat |
| 4 | Cause Light Wounds | 10a7 | 1d8, type 8 | — | touch | |
| 5, 11, 18, 22, 29 | Detect Magic, Read Magic, Find Traps, Detect Invisibility | 10e9 | effect only | | | |
| 6, 7, 16, 17, 52, 53, 54 | protections | 1123 | effect only | | | |
| 8 / 24 | Resist Cold / Resist Fire | 1162 / 17e9 | effect only | | | |
| 9 | Burning Hands | 1190 | dmg = L, type 9 (fire + magic) | — | no touch roll | Resist Fire halves it |
| 10 | Charm Person | 11dd | effect 0x0B, power = L + caster side × 128, removal flag 1; handler runs at once | negates | 1st; unaffected if target[0x9F] > 1 or [0x6C] > 1 | morale 100 set in the handler |
| 12 | Enlarge | 12a5 | STR 18 with % by L: 1 → 0, 2 → 1, 3 → 51, 4 → 76, 5 → 91, 6 → 100; then effect 0x0C | — | 1st | **≠ guide**: L ≥ 7 not handled; the % keeps the stale `DS:4845` |
| 13 | Reduce | 136e | removes 0x0C on a failed save | negates | 1st | |
| 14 | Friends | 13d8 | CHA += 2d4 (cap 25); effect 0x0E, power = the **old** CHA, flag 1 | — | 1st | |
| 15 | Magic Missile | 1439 | (L div 2)d4 + (L div 2), type 8, one roll | — | one target | **≠ guide**: level 1 does 0, levels 2–3 one missile; scroll (L6) 3d4+3 |
| 19 | Shield | 1499 | effect 0x11 | | | the handler blocks Magic Missile (`DS:681B` = 15) |
| 20 | Shocking Grasp | 14c7 | L + 1d8, type 0x0C | — | touch | |
| 21 | Sleep | 151b | pool 4d4; cost by hit dice char[0x73]: 0–1 → 1, 2 → 2, 3 → 4, 4 → 6, 5 → 10 (race 0) else 20, ≥ 6 → 20. In list order skip Animated, already asleep (0x35) or cost > pool; else pool −= cost; then effect 0x35 | — | continues past creatures it cannot afford | undead and elves are refused later (event 9) but have already used pool |
| 23 / 49 | Hold Person | 1658 | effect 0x34; save bonus 1 target −2 (cleric) / −3 (MU), 2 → −1, 3–4 → 0 | negates (vs spell) | last to first | forced save if [0x9F] > 1 or [0x6C] > 1 |
| 25 | Silence 15' | 1822 | effect 0x15 | byte 8 = 3: never negates | | **≠ guide** |
| 26 | Slow Poison | 185b | only on a poisoned (0x37), not Animated target: HP 0 → 1, add 0x16 (power FF, flag 1), revive (0x4E), add 0x0F (dur 10) | | 1st | nothing on others |
| 27 | Snake Charm | 190f | ignores targeting: pool = caster's current HP; every combatant (both sides) of type [0x9F] = 0x0E with HP ≤ pool: pool −= HP; effect 0x33 | — | | permanent (duration bytes 0; guide: 4+1d4) |
| 28 | Spiritual Hammer | 19c3 | effect 0x17 (flag 1), handler creates the hammer | | | |
| 30 / 50 | Invisibility | 1a16 | effect 0x19 | | | |
| 31 | Knock | 1a4f | nothing | | | doors use their own path |
| 32 | Mirror Image | 1a8a | effect 0x1C, power = 1d4 images | | | |
| 33 | Ray of Enfeeblement | 1acc | effect 0x1D | negates | | |
| 34 | Stinking Cloud | 1b11 | see below | vs poison | 4 squares | |
| 35 | Strength | 1f41 | bonus MU 1d4, cleric or thief 1d6, fighter 1d8 (later checks override; other classes uninitialised); over 18: fighters 18/(% + 10 × excess, cap 100), others 18; effect 0x26 | — | 1st | |
| 36 | Animate Dead | 206f | ignores targeting: while L > 0, every dead (6) creature with [0x9F] = 0 on a free cell: power = L + old side × 16, joins the caster's side, AI on, undead type 2, [0x6B] = 0, move 6, spells cleared, [0x84] = 0xB2 (NPC) / 0xB3, type 4, L −1, revived at full HP; on success effect 0x20 (permanent, flag 1), status Animated | — | up to L | **bug**: L is spent and the target converted even if the revive fails |
| 37 | Cure Blindness | 2217 | removes the first 0x21 (`5216_1081`, "is Cured"), then "can see" with the sparkle | | 1st | |
| 38 | Cause Blindness | 225d | effect 0x21 | negates | touch | |
| 39 | Cure Disease | 232f → 228a | with 681F set: removes 0x22; 0x2B (then also the first 0x2C and 0x1F helpless); 0x32 (and the first 0x39). Each of 0x22, 0x2B, 0x32 says "is Cured". 0x2C and 0x1F stay unless 0x2B was there | | 1st | |
| 40 | Cause Disease | 234c | effect 0x22, 1d6×10 min, flag 1 | negates | touch | |
| 41 / 46 | Dispel Magic | 2385 | each effect with power < 0xFF: lvl = power & 0x0F; chance 50 + 5(L − lvl) if L > lvl, 50 − 2(lvl − L) if L < lvl, else 50; d100 ≤ chance removes it (end callbacks run); a pass that removed anything shows "is affected" with the sparkle | | **bug**: loops count times on the **first** target only | |
| 42 | Prayer | 24d6 | effect 0x31, power = L + side × 16 | | self | |
| 43 | Remove Curse | 2540 | removes 0x24 if present ("is Cured", then "is un-cursed"), else clears the cursed flag of the **first** cursed item ("'s item is un-cursed") | | 1st | |
| 44 / 45 | Bestow Curse / Blink | 2604 / 263d | effect 0x24 (touch, negates) / 0x25 | | | |
| 47 / 64 | Fireball / Necklace of Missiles | 266b | n = L (id 64: 1d3×2 + 1) d6, type 9, one roll; outdoors (ECL 0x49E6 = 0) radius 2 | half | area | |
| 48 / 55 | Haste / Slow | 2892 / 2c09 → 2764 | effect 0x27 / 0x2A on up to L targets of the caster's / the enemy side; a target with the opposite effect only loses it ("is Cured", `FUN_5216_1081`); Apply on the rest, then event 18 on each | — | | the L cap applies to both |
| 51 | Lightning Bolt | 2bb7 | L d6, type 0x0C, save vs spell for half per creature hit; path in [combat-rules.md](combat-rules.md) | half | line | |
| 56 | Restoration | 2c43 | if drained levels [0x74] > 0: hp = [0x75] / [0x74] added to max, current and [0xB1]; one level back to the class with the cheapest next level; XP raised to that level's minimum | | 1st | |
| 57 | Potion of Speed | 2e02 | removes Slow if present, else Haste for 5d4 | | | |
| 58 | Keoghtum's Ointment | 2e4d | **one of**: poisoned → removes 0x37 (and 0x16); else cure disease; only if neither applied, heal 1d4 + 8 | | | ≠ guide |
| 59 | Potion of Giant Strength | 2ee5 | STR 21, effect 0x26 for 1d4×10 + 40 | | | |
| 60 | Javelin of Lightning | 2f4d | first square 20 + 1d6, then a 3-square path at a flat 20 | half (vs spell) | | **bug**: later squares take 20 |
| 61 | Wand of Paralyzation | 2f99 | effect 0x34 for 5d4 | negates (vs paralysis) | | no humanoid or size check |
| 62 | Potion of Healing | 2fd0 | heal 2d4 + 2 | | | |
| 63 | Dust of Disappearance | 302a | effect 0x47; 2d10×10 in combat, (1d10+10)×10 outside | | | |
| 65 | Wand of Magic Missiles | 3058 | 2d4 + 2, type 8 | — | | not blocked by Shield (id ≠ 15) |
| 66 | (no-op item) | 3092 | nothing | | | |
| 67 | Manual of Bodily Health | 30a2 | effect 0x04, 1440 min, power FF, flag 1 | | | |

### Stinking Cloud (O, `FUN_4e53_1b11`, occupant routine `FUN_5216_0ae7`)

1. A 0x13-byte zone record joins the list at `DS:6DBB` (owner, next, 4 saved tiles, 4 flags, x, y, n).
2. The caster gets effect 0x28, duration L, power n × 16 + L.
3. Each of the 4 squares (offsets `DS:290D` through the direction tables) whose cell movement byte < 0xFF becomes cell 0x1E.
4. Each creature standing there gets `0ae7`, skipped if not in play, not on cell 0x1E, or already under 0x1E, 0x1F, 0x20 (animated), 0x6F or 0x7D. Save vs type 0: success "starts to cough", effect 0x1E for 1 round (power FF, handler runs); failure "chokes and gags from nausea", 0x1F helpless for 1d4 + 1 rounds (the turn ends).

`FUN_4e53_30d9` is the handler of effect 88, the breath bolt (O, [effects.md](effects.md) row 88): the Lightning Bolt routines `28bc`/`295b` for the breather's max HP (damage type 0x0C) over 10 squares from the square beside it, save vs breath for half, 3 uses; after round 0 a 50 % chance.

## Open

- ~~Effect handlers~~ see [effects.md](effects.md)
- ~~Haste/Slow~~ resolved: Haste (0x27) doubles attacks and movement, Slow (0x2A) halves them (combat code 0x31E9C/0x31EBF); the original character sheet shows them reversed (display bug)
- Immediate effects (damage spells, cures) in `FUN_5216_1344`
- ~~Spell memorisation and learning rules, spell slots per level~~ see [camp-and-time.md](camp-and-time.md) and [chargen-and-progression.md](chargen-and-progression.md)
- ~~Whether `FUN_5216_1656` scales spell durations~~: no, they are minutes ([camp-and-time.md](camp-and-time.md#open))
