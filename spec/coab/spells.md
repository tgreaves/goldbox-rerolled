# CotAB spell handlers: diff against PoR `spec/spells.md`

Part of [[spec/coab/README]]. Read from the CotAB image (2026-10-20). Marks: O seen in code/data, I inferred, ? not checked. Addresses are CotAB image offsets; handlers are in code segment 0x43F7 (image 0x43F70).

## 1. Dispatch and shared helpers (O)

- **Table**: filled at 0x4A4FF (PoR `4e53_3413`), far pointers at **DS:72BA + 4·id** for ids 0–100, each a thunk in segment 0xC2. PoR's table is DS:6B84. Entry 0 is the target hook (0x450BD outside combat, as PoR `4e53_0a91`; combat repoints it at 0x21E25 / 0x21E41).
- **Cast** 0x45251 (PoR `4e53_0c20`): at 0x45540 sets DS:6FB1 = id, calls the table entry, clears 6FB1 and 6FB7. Changes: the refusal outside combat says "can't be cast here..."; **new** (0x45373): a caster with effect 0x4A who rolls 1 on 1d2 "miscasts" and loses the spell.
- **Same as PoR**: Apply 0x44EEF (`08c3`), Duration 0x44E02 (`07d6`, byte-identical incl. its special cases), Bless filter 0x45C10 (`0f4f`), Cure Disease core 0x46FA7 (`228a`), dice, to-hit 0x4BCF5, remove-first "is Cured" 0x4C0FD, effect display, has-effect.
- **Changed helpers**: add-effect 0x4CD91 (an existing record of the same type with duration > 0 is always removed before the new one is added; PoR replaced only for a longer or permanent new one); heal 0x4CE85 (the mummy-rot 0x32 block without force is gone); save 0x4BDA1 also writes DS:6FC2; damage 0x4CA6A fires event 20.
- **New helpers**: 0x45A94 the Hold loop (23, 49, 79, 81, 94); 0x4573F(x0, y0, tx, ty, width, length) a beam/cone builder (steps from the caster towards the point, orthogonal 2 diagonal 3, to 2·length; side lines to the end moved by DS:0A22/0A2A for width ≥ 2, DS:0A12/0A1A for width ≥ 3; caster excluded; O, [[spec/coab/effects]] §7); 0x4C1D8(ch, str, pct) true if the new STR beats the **base** STR (+0x10, %+0x1D), power = str + 100, or pct + 1 when str = 18 (encoder 0x4C160).
- Globals: PoR 6C94/6C95 → 744E/744F (target count, list); 6DB9/6DBA → 7573/7574 (target x, y); 6DBB → 7575 (Stinking Cloud zones), new 7579 (Cloudkill zones); 6DBF → 757D (from item). Zone record 0x13 → 0x1E bytes (x +0x1A, y +0x1B, n +0x1C, new "resisted" +0x1D, per-square flags +0x10).

## 2. Per spell id

"same" = identical structure with globals and fields translated (the effect types they add may themselves have changed meaning, [[spec/coab/effects]]).

| id | handler | CotAB |
|---|---|---|
| 1, 2 | 45cd0, 45d01 | same (Bless, Curse) |
| 3 | 45d2c | same (heal 1d8) |
| 4 | 45d68 | same (1d8, type 8, touch) |
| 5, 11, 18, 22, 29, 77 | 45daa | same: Apply, "is affected"; 77 druid Detect Magic (effect 5, 12) |
| 6, 7, 16, 17, 52, 53, 54, 69 | 45de4 | same: Apply, "is protected"; 69 cleric Prot. Evil 10' (0x2D, 10L) |
| 8, 9, 19, 20, 24, 25, 26, 28, 30/50, 31, 33, 37, 38, 39, 40, 42, 44, 45, 57, 61, 62, 63, 65 | | same |
| 10 | 45e9e | same |
| 12 | 45f75 | **changed** Enlarge: STR by L as PoR for 1–6, then 7→19, 8→20, 9→21, 10–11→22, else 18/00; only if it beats base STR (0x4C1D8): "is stronger", raw 0x0C (Duration(12), pw encoded, flag 1), STR recomputed; else "is unaffected", no effect |
| 13 | 460aa | **changed** Reduce: a failed save vs 4 removes 0x0C (no "is Cured"), STR recomputed, "has been reduced" |
| 14 | 4614a | **changed** Friends: Apply with power 2d4 (flag 1), CHA recomputed (no direct write, no cap) |
| 15 | 46191 | **changed** Magic Missile: n = (L + 1) div 2 missiles, n d4 + n, type 8 (PoR's level-1 zero fixed) |
| 21, 27 | 46276, 4653d | same |
| 23, 49, 94 | 463b4 → 45a94 | same rule (bonus by number of targets); the humanoid/size immunity is skipped only for 94 (Hold Monsters) |
| 32 | 466b8 | **changed** Mirror Image: power = (1d4 << 4) \| L |
| 34 | 4675b | **changed** (small) Stinking Cloud: 0x1E-byte zone; the 4 occupants de-duplicated |
| 35 | 46bcb | **changed** Strength: a class counts if level > 0 or former level > +0xE6; bonus MU 1d4 → cleric/thief 1d6 → fighter 1d8 (later wins); STR > 18 for fighter/paladin/ranger → 18/(% + 10·excess, cap 100), others 18; if it beats base: raw 0x26, Duration(35), pw bonus + 100, flag 1, STR recomputed; else nothing |
| 36, 90 | 46d89 | same (memory clear 21 → 84 bytes); both class 3, so L = 12 |
| 41, 46 | 47154 | **changed** Dispel Magic: PoR's part (first-target bug kept), then DS:6FB7 = 1 and the 3×3 squares round the target point: Stinking (cell 0x1E) and Cloudkill (0x1C) zones are dispelled against the owner's magic-user level (with the dual-class part, f taken from the **current character**, 0x47096); success removes the owner's 0x28 / 0x5B, failure marks the zone resisted |
| 43, 89 | 47575 | **changed** Remove Curse: removes 0x24; otherwise the first cursed item is **unreadied** (it stays cursed), its handler run with arg 1 if +0x3E > 0x7F, all six stats recomputed, "has an item un-cursed" |
| 47, 64 | 476f2 | same |
| 48, 55 | 478cc, 47c9e → 477eb | **changed** Haste/Slow: PoR's event-18 pass on each target after Apply is gone |
| 51 | 47c49 | **changed** Lightning Bolt: L d6 type 4, but the hit 0x478F6 (new argument: skips the creature the previous stop hit; bounces only in a map area and not twice running) and the path 0x479B4 (length 8 → 7 at 0x47C7F; charges the cost since the previous stop) changed, O ([[spec/coab/effects]] §7) |
| 56 | 47cd8 | same (XP stride 0x63) |
| 58 | 47edd | **new** Cure Serious Wounds: heal 2d8 + 1 |
| 59 | 47f27 | **changed** (item) Giant Strength: STR 21 via 0x4C1D8, raw **0x92**, 1d4×10 + 40, flag 1, STR recomputed |
| 60 | 47fac | same arguments; the path routine changed (as 51) |
| 66 | 480f5 | **new** Cause Serious Wounds: Apply 2d8 + 1, type 8, no touch roll, no save |
| 67 | 4814a | **new** Neutralize Poison: Animated target → nothing; poisoned (0x37): HP 0 → 1, remove 0x37, 0x16, 0x0F, "is unpoisoned", status 0 and in play; else "is unaffected" |
| 68 | 48240 | **new** Poison: Apply finds effect 0 (nothing, the save still rolled); then a 0x40 probe through event 9 on the **caster's combat target**, and if not vetoed handler 0x40 (save vs 0 or die) on the caster with an uninitialised effect pointer |
| 70 | 482ca | **new** Sticks to Snakes: target HD (+0xE5) ≥ 6 → "smashes them flat"; else Apply (effect 3, 2L, power L) and run handler 3 |
| 71 | 48360 | **new** Cure Critical Wounds: heal 3d8 + 3 |
| 72 | 483a1 | **new** Cause Critical Wounds: Apply 3d8 + 3, type 8, touch, save vs 4 negates |
| 73 | 483e9 | **new** Dispel Evil: caster gets effect 4 (L, flag 0), then Apply → 0x91 (L, pw L), self |
| 74 | 4844a | **new** Flame Strike: Apply 6d8, type 9, save vs 4 for half |
| 75 | 4848a | **new** Raise Dead: status 6 or 1, base CON > 0, not an elf; remove 0x20, 0x37; status 0, in play; base CON − 1, CON recomputed; HP 1; "is raised" (no survival roll) |
| 76 | 4856d | **new** Slay Living: a probe (dmgType 0x40) through event 9 (zeroed → "is unaffected"); failed save vs 4 → status 6 "is slain"; saved → 2d8 + 1, type 8 |
| 78 | 4862b | **new** Entangle: only where the area's outdoor word (A 0x1CC) is 0; each target saves vs 4 or gets 0x88 ("is entangled"); **bug**: its duration is Duration(0x88), whose record bytes give 6 + 3·L with L uninitialised unless the caster gate or from-item applies |
| 79 | 486e7 → 45a94 | **new** Faerie Fire: effect 7, 4L, pw L, "is highlighted"; targets bought from a pool of L by size; **the last listed target always counts as saved** (45b4d); humanoid/size rule applies |
| 80 | 48714 | **new** Invisibility to Animals: Apply → 0x45, 10 + L; touch (a to-hit roll on the ally) |
| 81 | 4874c → 45a94 | **new** Charm Monsters: as 79 with a pool of 2d4 by HD (0–1 → 1, 2 → 2, 3 → 4, else 8); effect 0x0B, permanent, pw L only (I: an enemy caster charms to side 0); the 0x0B handler run on each |
| 82 | 487dd | **new** Confusion: up to 2d8 targets; each saves vs 4 or gets 0x23 for 2 + L, "is confused" |
| 83 | 488a1 | **new** Dimension Door: releases engulf/hug holds (0x90/0x8B on the caster's holders), moves the caster to the target square, "teleports" |
| 84 | 48a52 | **new** Fear: beam (width 3, length 6); failed save vs 4 → 0x8E for L, "runs in terror", flee state; saved → "is unaffected" |
| 85 | 48bb2 | **new** Fire Shield: Hot (caster 0x32 + 0x8F) or Cold (0x36 + 0x8F) for 2 + L; the AI picks with 1d10 > 5 Hot; a player chooses, or "Abort spell?" |
| 86 | 48d66 | **new** Fumble: failed save vs 4 → 0x1B "is clumsy", saved → 0x2A Slow, both for L and run; **then Apply again** (a second save; on failure 0x1B is replaced with pw L, flag 1) |
| 87 | 48e7b | **new** Ice Storm: Apply 3d10, type 0x0A, no save, area |
| 88 | 48ebe | **new** Minor Globe of Invulnerability: Apply → 0x3F, L, pw L, "is protected" |
| 91 | 48f05 | **new** Cloudkill: a clone of 34 with zone list 7579, owner effect 0x5B (L, pw n·16 + L, flag 1), 9 squares (DS:27DD), cell 0x1C; occupants: HD 0–4 die, 5 save vs 0 at −4, 6 save, else poisoned and killed; 7+ unaffected |
| 92 | 494c0 | **new** Cone of Cold: beam (width 2, length max(1, (L + 1) >> 1)); L d4 + L, type 0x0A, save half |
| 93 | 49562 | **new** Feeblemind: the target's spell save (+0xE3) adjusted (cleric −1, magic-user +4, others +2) while Apply → 0x44 (permanent, negates) runs, then restored |
| 95, 96, 97 | 4960e, 4963c, 4966a | **new** (class 3) Apply only: 0x49, 0x6D, 0x19, permanent, self |
| 98 | 49697 | **new** (class 3): beam (width 1, length 3), 6d6 to monster type 0x12 only |
| 99 | 49761 | **new** (class 3): heal 2d4 + 2, "is Healed" |
| 100 | 4768b | **new** Bestow Curse: **does nothing** (its record has effect 0 and is not touch: Apply only rolls a save; a data bug) |

## 3. Durations (O)

0x44E02 is byte-identical to PoR's: special cases 40 (1d6×10), 57 and 61 (5d4), 59 (1d4×10 + 40), 63 (2d10×10 in combat, else (1d10 + 10)×10), 67 (1440, dead in CotAB: Neutralize Poison never asks); otherwise record bytes 4 + 5·L. New: 69 10L, 70 2L, 73 L, 77 12, 79 4L, 80 10 + L, 82 2 + L, 84 L, 85 2 + L, 86 L, 88 L, 91 L, 94 L, 100 10L; 81, 93, 95–97 permanent.

## 4. Quirks to decide on (O)

- Cure Disease removes 0x32 and 0x39 as in PoR, but in CotAB 0x32 is the Hot Fire Shield.
- Faerie Fire and Charm Monsters: the last listed target always saves.
- Entangle's duration (Duration(0x88), level uninitialised).
- Bestow Curse does nothing.
- Poison acts on the caster's combat target, not the spell's targets.
- The uninitialised bonus in Strength and Hold Person (as in PoR).

## Port status

The port has a per-game spell handler map (`web/src/games/spellrules.ts`: id → kind and parameters), 2026-10-20. Ids the table marks "same" use PoR's kinds; 58, 66, 69, 71, 72, 74, 77, 80, 87, 88, 94, 95–97, 99 and 100 are expressed with existing kinds (heal, damage, apply, hold). Not yet transcribed: the changed handlers (12–15, 32, 34, 35, 41/46, 43/89, 48/55, 59's base-STR rule) and the new kinds (67, 68, 70, 73, 75, 76, 78, 79, 81–86, 91–93, 98), plus the changed add-effect and heal helpers (§1).
