---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Combat rules

Part of [[spec/README]]. Covers what has been traced so far; combat flow (initiative, AI, movement, spells) is still open.

## Dice (O, `FUN_5216_0de3`)

`roll(count, sides) = Σ count × (Random(sides) + 1)` using the Turbo Pascal RNG (`FUN_1af8_11c0`). A browser port needs its own RNG; exact sequence reproduction is not required.

## Attack sequence (O, `FUN_3aae_1406(target, attacker, from_behind)`)

1. If the target is helpless (`FUN_10ba_0b73`): automatic kill, "with one cruel blow" (damage = target HP + 5)
2. If the attacker has a readied weapon and the target is **large** (`target[0x6C] > 0x80` or `(target[0x6C] & 7) > 1`), the attacker's damage dice become the weapon type's large-target dice: `ITEMS[type]` bytes 2–4 replace count/sides, and the bonus changes by `(large bonus [4]) − (small bonus [11])`
3. Target AC byte: `target[0x111]` (front), or `target[0x112]` (rear) when attacking from behind; for a **backstab** (`FUN_3aae_2574`) use `target[0x112] − 2`
4. AC modifiers (`FUN_3aae_1b1e`): for missile weapons, with `band = (ITEMS[type][12] − 1) / 3` and `d` = distance: `d > band` → AC byte +2; `d > 2·band` → +3 more
5. For each hand h = 2, 1 while `attacker[0x112 + h]` attacks remain: decrement, roll to-hit; on a hit roll damage and print "Hitting for N points of damage"; stop when the target drops
6. If no attack hit: "and Misses"

## To-hit (O, `FUN_5216_0cb7(ac_byte, target, attacker)`)

```
r = roll(1, 20)
if r <= 1: miss
if r == 20: r = 100
effects(attacker, 10); effects(target, 16)      // may change r
bonus = attacker[0x10E] ? B[0x6E0] : B[0x6E2]    // side modifier, word array B (I: difficulty)
hit = r >= 0 and ac_byte <= r + attacker[0x110] + bonus
```

With `ac_byte = 60 − AC` and `attacker[0x110] = 60 − THAC0` this is the AD&D rule `d20 ≥ THAC0 − AC − bonus`.

## Damage (O, `FUN_3aae_0191(hand, target, attacker)`)

```
dmg = roll(attacker[0x114 + h], attacker[0x116 + h]) + attacker[0x118 + h]     // h = hand 1 or 2
if backstab: dmg *= attacker[0x9C] / 4 + 2      // 0x9C = thief level
effects(attacker, 4); effects(target, 5)
```

Hand 1 uses the fields shown on the character sheet (0x115/0x117/0x119).

## Attack vs AC without an attacker (O, `FUN_5216_0c4f(bonus, target)`)

Used by ECL `DAMAGE` (traps): `r = d20` (1 fails, 20 → 100), `effects(target, 16)`, hit if `target[0x111] < r + bonus`.

## Saving throws (O for storage, I for roll)

Character bytes 0x6D–0x71 hold save targets in the order: death/poison/paralysis, petrification/polymorph, rod/staff/wand, breath weapon, spell. Values match the AD&D tables (best of each class for multi-class). The roll is presumably `d20 ≥ value` (**I**; routine not yet traced).

## Effects hook (O, `FUN_5216_02fa(char, event)`)

Called at fixed points with event codes: 4 (attacker after damage), 5 (target after damage), 10 (attacker before to-hit), 11 (start of attack), 13 (death/drop), 16 (target before to-hit or save). It walks the character's effect list (9-byte records) and applies type-specific code. Effect types and handlers: **?**

## Still open

- Combat setup, battlefield map, initiative and turn order
- Monster AI and movement, fleeing and morale
- Spell casting and spell effects (spell list in character bytes 0x18–0x69, **I**)
- Experience and treasure awards after combat
- Saving throw roll, effect types
