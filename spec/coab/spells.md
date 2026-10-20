# CotAB spell handlers: diff against PoR `spec/spells.md`

Part of [[spec/coab/README]]. Read from the CotAB image (2026-10-20). Marks: O seen in code/data, I inferred, ? not checked. Addresses are CotAB image offsets; handlers are in code segment 0x43F7 (image 0x43F70).

## 1. Dispatch and shared helpers (O)

- **Table**: filled at 0x4A4FF (PoR `4e53_3413`), far pointers at **DS:72BA + 4·id** for ids 0–100, each a thunk in segment 0xC2. PoR's table is DS:6B84. Entry 0 is the target hook (0x450BD outside combat, as PoR `4e53_0a91`; combat repoints it at 0x21E25 / 0x21E41).
- **Cast** 0x45251 (PoR `4e53_0c20`): at 0x45540 sets DS:6FB1 = id, calls the table entry, clears 6FB1 and 6FB7. Changes: the refusal outside combat says "can't be cast here..."; **new** (0x45373): a caster with effect 0x4A who rolls 1 on 1d2 "miscasts" and loses the spell.
- **Same as PoR**: Apply 0x44EEF (`08c3`), Duration 0x44E02 (`07d6`, byte-identical incl. its special cases), Bless filter 0x45C10 (`0f4f`), Cure Disease core 0x46FA7 (`228a`), dice, to-hit 0x4BCF5, remove-first "is Cured" 0x4C0FD, effect display, has-effect.
- **Changed helpers**: add-effect 0x4CD91 (an existing record of the same type with duration > 0 is always removed before the new one is added; PoR replaced only for a longer or permanent new one); heal 0x4CE85 (the mummy-rot 0x32 block without force is gone); save 0x4BDA1 also writes DS:6FC2; damage 0x4CA6A fires event 20.
- **Cloud occupant check** 0x4B8F7(c, flag), both clouds (PoR `5216_0ae7` had Stinking Cloud only): the callers are the round end (0x2272D, flag 0), a step (0x22BC4, 0x23E57, flag 1) and the two cloud spells (flag 1). On a 0x1E square with the flag set: unless 0x1F, 0x20, 0x6F or 0x7D (PoR also 0x1E), a save vs 0; the zone over the creature's square (0x4B7B3, list 7575) is made the current character, then add-effect 0x4CD91 with the line: saved 0x1E (1, FF) "starts to cough", else 0x1F (1d4 + 1, FF) "chokes and gags from nausea", and the record's handler at once (0x1F's is 0x273C1, which ends the turn); the current character back. Then, whatever the flag, on a 0x1C square the Cloudkill rule (row 91).
- **Pool targeting** (O, the combat target hook 0x2C781, target mode 5 at 0x2C7EA; 79 and 81 are the only mode-5 spells): the pool is L for spell 0x4F, else 2d4 rolled once; picks one at a time (`2c56c`); a pick already listed: the computer loses a point of the pool, a player gets "Already been targeted"; a new one is listed, the aim moves to its square and its cost is added (0x4F by size byte +0xDE: 1 → 1, 2 or 3 → 2, 4 → 4, else 0; otherwise by HD +0xE5: 0 or 1 → 1, 2 → 2, 3 → 4, else 8); from the second pick on, a total above the pool ends it with that pick listed; a cancel or an empty pool ends it too. The Hold loop's last-saves rule (79, 81) protects that last pick.
- **New helpers**: 0x45A94 the Hold loop (23, 49, 79, 81, 94; last to first; the bolt to every target but the last listed; the save, then the size rule (monster type +0x11A > 1 or size +0xDE > 1 saves, except for spell 94) overriding it, as PoR 1658 does; the effect is the record's, power L, negated by the save); 0x4573F(x0, y0, tx, ty, width, length) a beam/cone builder (steps from the caster towards the point, orthogonal 2 diagonal 3, to 2·length; side lines to the end moved by DS:0A22/0A2A for width ≥ 2, DS:0A12/0A1A for width ≥ 3; caster excluded; O, [[spec/coab/effects]] §7); 0x4C1D8(ch, str, pct) true if the new STR beats the **base** STR (+0x10, %+0x1D), power = str + 100, or pct + 1 when str = 18 (encoder 0x4C160).
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
| 34 | 4675b | **changed** (small) Stinking Cloud: 0x1E-byte zone; the 4 occupants de-duplicated (0x46B40: a later duplicate is zeroed), then the occupant check 0x4B8F7 with flag 1 on each |
| 35 | 46bcb | **changed** Strength: a class counts if level > 0 or former level > +0xE6; bonus MU 1d4 → cleric/thief 1d6 → fighter 1d8 (later wins; only a group that applies rolls, none leaves the bonus uninitialised); STR > 18 for fighter/paladin/ranger → 18/(% + 10·excess, cap 100), others 18; if it beats base: raw 0x26, Duration(35), pw bonus + 100, flag 1, STR recomputed; else nothing; no line either way |
| 36, 90 | 46d89 | same (memory clear 21 → 84 bytes); both class 3, so L = 12 |
| 41, 46 | 47154 | **changed** Dispel Magic: PoR's part (first-target bug kept), then DS:6FB7 = 1 and the 3×3 squares round the target point: Stinking (cell 0x1E) and Cloudkill (0x1C) zones are dispelled against the owner's magic-user level (with the dual-class part, f taken from the **current character**, 0x47096); success removes the owner's 0x28 / 0x5B, failure marks the zone resisted (for good: a resisted zone is never tried again); the squares in the order here, N, NE, E, SE, S, SW, W, NW (0x47297, each case changing one coordinate); a zone is matched where one of its squares is the square, for **both** lists through Stinking Cloud's table DS:27D9 (4 entries, or 9 for Cloudkill: entries 5–9 are DS:27DE–27E2, Cloudkill's first five), so a Cloudkill zone is only found from its own square, E, SE, S, N and NE (O, 0x47397: a quirk); chance as for effects, a byte |
| 43, 89 | 47575 | **changed** Remove Curse: removes 0x24; otherwise the first cursed item, readied or not, is **unreadied** (it stays cursed); if its +0x3E > 0x7F, DS:759C = 1 sends 0x4AB77 to the generic item handler 147 (0x29A23) with arg 1, whatever the item's kind (the first effect of type +0x3D goes), and all six stats are recomputed; "has an item un-cursed" |
| 47, 64 | 476f2 | same |
| 48, 55 | 478cc, 47c9e → 477eb | **changed** Haste/Slow: PoR's event-18 pass on each target after Apply is gone; the opposite effect still goes with "is Cured" (0x4C0FD) |
| 51 | 47c49 | **changed** Lightning Bolt: L d6 type 4, but the hit 0x478F6 (new argument: skips the creature the previous stop hit; bounces only in a map area and not twice running) and the path 0x479B4 (length 8 → 7 at 0x47C7F; charges the cost since the previous stop) changed, O ([[spec/coab/effects]] §7) |
| 56 | 47cd8 | same (XP stride 0x63) |
| 58 | 47edd | **new** Cure Serious Wounds: heal 2d8 + 1 |
| 59 | 47f27 | **changed** (item) Giant Strength: STR 21 via 0x4C1D8, raw **0x92**, 1d4×10 + 40, flag 1, STR recomputed |
| 60 | 47fac | same arguments; the path routine changed (as 51) |
| 66 | 480f5 | **new** Cause Serious Wounds: Apply 2d8 + 1, type 8, no touch roll, no save |
| 67 | 4814a | **new** Neutralize Poison: Animated target → nothing; poisoned (0x37): HP 0 → 1, remove 0x37, 0x16, 0x0F, "is unpoisoned", status 0 and in play; else "is unaffected" |
| 68 | 48240 | **new** Poison: Apply finds effect 0 (nothing, the save still rolled); then a 0x40 probe through event 9 on the **caster's combat target** (caster +0x18D → +0xA; DS:6FAD = 0x40, left set), and if not vetoed handler 0x40 run as the caster's with an uninitialised effect pointer: it is PoR's poison-on-hit, so the **current combatant's target** saves vs 0 or dies (the spell's own targets only roll a save) |
| 70 | 482ca | **new** Sticks to Snakes: first target's HD (+0xE5, signed) ≥ 6 → "<target> smashes them flat" (plain line); else Apply (effect 3, 2L, power L) and handler 3 run on the first target's first record of 3 |
| 71 | 48360 | **new** Cure Critical Wounds: heal 3d8 + 3 |
| 72 | 483a1 | **new** Cause Critical Wounds: Apply 3d8 + 3, type 8, touch, save vs 4 negates |
| 73 | 483e9 | **new** Dispel Evil: caster gets effect 4 through add-effect (duration L, power 0, flag 0, no line), then Apply → 0x91 (L, pw L) "is affected", self |
| 74 | 4844a | **new** Flame Strike: Apply 6d8, type 9, save vs 4 for half |
| 75 | 4848a | **new** Raise Dead: status 6 or 1, base CON (+0x18) > 0, race (+0x74) not 2 (elf); remove 0x20, 0x37 without re-arming; status 0, in play; base CON − 1, CON recomputed; HP 1; "is raised" (no survival roll) |
| 76 | 4856d | **new** Slay Living: a probe through event 9 with DS:6FAF (damage type) = 0x40 and DS:6FAE (damage) = 0x43 (damage zeroed → "is unaffected"; I: no CotAB event-9 handler zeroes it for this type, so it always passes); failed save vs 4 → status 6 "is slain"; saved → 2d8 + 1 (dice count kept), type 8, no save |
| 78 | 4862b | **new** Entangle: only where the area's outdoor word (A 0x1CC) is 0; each target saves vs 4 or gets 0x88 through add-effect (power 0, flag 0, negates; "is entangled"); **bug**: its duration is Duration(0x88), whose record bytes give 6 + 3·L with L uninitialised unless the caster gate or from-item applies |
| 79 | 486e7 → 45a94 | **new** Faerie Fire: effect 7, 4L, pw L, "is highlighted", bonus 0; targets bought from a pool of L by size (below); **the last listed target always counts as saved** (45b4d), no roll; humanoid/size rule applies |
| 80 | 48714 | **new** Invisibility to Animals: Apply → 0x45, 10 + L, "is invisible"; touch (a to-hit roll on the ally) |
| 81 | 4874c → 45a94 | **new** Charm Monsters: as 79 with a pool of 2d4 by HD (0–1 → 1, 2 → 2, 3 → 4, else 8, below 0 too); effect 0x0B, permanent, pw L only (I: an enemy caster charms to side 0); the 0x0B handler run on each target's first 0x0B record |
| 82 | 487dd | **new** Confusion: 2d8 rolled first, the target list cut to that many; each saves vs 4 or gets 0x23 through add-effect for 2 + L (power 0, flag 0, negates), "is confused" |
| 83 | 488a1 | **new** Dimension Door: a caster with 0x3A (held) looks at the combatants within 1 (553d8): one whose first 0x90 (else 0x8B) record's power is the caster's index loses its first 0x90 and its first 0x8B (their removal lets the victim go); the caster leaves its square and is placed on the aimed square (5680a; ?: whatever is there), "teleports" (plain line) |
| 84 | 48a52 | **new** Fear: the area template from the caster (width 3, length 6) replaces the target list; failed save vs 4 → 0x8E through add-effect for L (power 0, flag 1, negates), "runs in terror", and whatever that did: combat record +0x10 = 1 (fleeing), +0x198 = 1 (computer control), morale 0xB3 unless above 0x7F, combat target cleared; saved → "is unaffected" |
| 85 | 48bb2 | **new** Fire Shield: Hot (caster 0x32 "is protected" + 0x8F) or Cold (0x36 + 0x8F, **no line**) for 2 + L, power 0, flag 0; the computer (+0x198) picks Hot on 1d10 > 5; a player gets "flame type: " Hot / Cold, any other key "Abort spell? " Yes / No (Yes: nothing, the spell spent; No: asked again) |
| 86 | 48d66 | **new** Fumble: DS:6FAF = 0x40; failed save vs 4 → 0x1B "is clumsy", saved → 0x2A "is slowed", both through add-effect for L (power 0, flag 0) and their handler run with a null record (0x1B's ends the turn); **then Apply again** (a second save; on failure 0x1B is replaced with pw L, flag 1, "is clumsy"; saved, "is Unaffected") |
| 87 | 48e7b | **new** Ice Storm: Apply 3d10, type 0x0A, no save, area |
| 88 | 48ebe | **new** Minor Globe of Invulnerability: Apply → 0x3F, L, pw L, "is protected" |
| 91 | 48f05 | **new** Cloudkill: a clone of 34 with zone list 7579, owner effect 0x5B (L, pw n·16 + L, flag 1), 9 squares (DS:27DD: the square, then N clockwise), cell 0x1C, "Creates a poisonous cloud"; the occupants are **not** de-duplicated (a creature is checked once per square it covers); the occupant check: HD (+0xE5, signed) 0–4 die, 5 a save vs 0 at −4, 6 a save vs 0, a failure dies; 7 and up, or below 0, unaffected; dying: "is Poisoned", 0x37 raw (0, FF, 0), status 6 "is killed" (0x4BB2F). Effect 0x5B's removal (0x28E09) lifts the zone as 0x28's does. A body falling on a Cloudkill square replaces its cell with 0x1F (0x5671C keeps only 0x1E) |
| 92 | 494c0 | **new** Cone of Cold: the template from the caster (width 2, length max(1, L >> 1); corrected: L div 2, not (L + 1) div 2, O 0x494EB) replaces the target list; Apply with L d4 + L (dice count kept), type 0x0A, save half |
| 93 | 49562 | **new** Feeblemind: the first target's spell save (+0xE3) adjusted by its class (+0x75: cleric −1, magic-user +4, others +2) while Apply → 0x44 (permanent, negates, no line) runs and then handler 0x44 on its first 0x44 record, then restored |
| 95, 96, 97 | 4960e, 4963c, 4966a | **new** (class 3) Apply only: 0x49, 0x6D, 0x19, permanent, self |
| 98 | 49697 | **new** (class 3): the template (width 1, length 3); each listed creature: Damage with a fresh 6d6 (dice count kept) and the record's save mode (DS:3E04, 1: negates), saved unless its monster type (+0x11A) is 0x12; DS:6FAF untouched |
| 99 | 49761 | **new** (class 3): heal 2d4 + 2, "is Healed" |
| 100 | 4768b | **new** Bestow Curse: **does nothing** (its record has effect 0 and is not touch: Apply only rolls a save; a data bug) |

Dice: 0x4BE7C (roll, keeping the dice count in DS:6FB2 for the resistances) is used by 4, 15, 20, 47/64, 65, 66, 72, 74, 76, 87, 92, 98 (O, its callers).

## 3. Durations (O)

0x44E02 is byte-identical to PoR's: special cases 40 (1d6×10), 57 and 61 (5d4), 59 (1d4×10 + 40), 63 (2d10×10 in combat, else (1d10 + 10)×10), 67 (1440, dead in CotAB: Neutralize Poison never asks); otherwise record bytes 4 + 5·L (O for every new id, the records checked 2026-10-20). Entangle (78) asks for Duration(0x88), past the table: that record's bytes give 6 + 3·L (its class byte 6 leaves L uninitialised in 0x4F8BF unless the gate or an item gives 6; I: the port uses the cast's level). New: 69 10L, 70 2L, 73 L, 77 12, 79 4L, 80 10 + L, 82 2 + L, 84 L, 85 2 + L, 86 L, 88 L, 91 L, 94 L, 100 10L; 81, 93, 95–97 permanent.

## 4. Quirks to decide on (O)

- Cure Disease removes 0x32 and 0x39 as in PoR, but in CotAB 0x32 is the Hot Fire Shield.
- Faerie Fire and Charm Monsters: the last listed target always saves.
- Entangle's duration (Duration(0x88), level uninitialised).
- Bestow Curse does nothing.
- Poison acts on the caster's combat target, not the spell's targets.
- The uninitialised bonus in Strength and Hold Person (as in PoR).
- Dispel Magic matches Cloudkill zones through Stinking Cloud's square table.
- A gas cloud's zone number counts the caster's zones but the last one in the list (both games), so two zones can share a number and a lift (0x28, 0x5B) or a Dispel Magic can take the other one.
- Cloudkill (0x48F05) takes the cell under a 0x1E square from the first Stinking Cloud that laid it and a 0x1C square from the first other Cloudkill (neither 0x1E nor 0x1C); Stinking Cloud (0x4675B) has no 0x1C case, so a Stinking Cloud over Cloudkill keeps 0x1C as the cell under it; each lift draws only its own list again.

All are kept (rule 2), each said so in the code; the port's own simplifications are listed under port status.

## Port status

The port has a per-game spell handler map (`web/src/games/spellrules.ts`: id → kind and parameters), 2026-10-20. Ids the table marks "same" use PoR's kinds; 58, 66, 69, 71, 72, 74, 77, 80, 87, 88, 94, 95–97, 99 and 100 are expressed with existing kinds (heal, damage, apply, hold). Done since: the add-effect and heal helpers (§1) as effect rules data (`replaces`, `healBlock`), the base-STR rule for 12, 35 and 59 (`spells.strength`), and 12–15, 32 as parameters; 35's class rule (`counts`, `rollCounting`, `bonusPower`), 43/89 (`item: 'unready'`), 48/55 (`attacksAfter: 0`); 34 and 91 on the `cloud` kind (squares from START.EXE, T.gasCloud / T.killCloud; `dedupe`), the occupant check by the game's rule (`R.clouds`), 0x5B's removal (`liftZone`), 41/46's zone part (`zones` on the battle's `dispel`). Tests: `web/test/coabspells.test.ts`. The zone number and the cells a zone replaced are transcribed (2026-10-20: the caster's zones but the list's last; the cell under from another zone or the body list, the `cloud` kind's `replaced` and `firstZone`). 83 (`teleport`), 84 (`scare`, on the template `fan`), 85 (`flameShield`, through the host's `choose`/`ask`: the combat menu and confirm, the camp's menu), 86 (`saveOrElse`); 78 and 82 (`saveEach`), 79 and 81 (`hold` with `lastSaves`, `runAfter`, and `pool`, which the battle's target picker reads), Entangle's duration (`durations[78].record`), the Hold loop's save before the size rule (both games: the port skipped PoR's roll for a size-immune target); 67 (`curePoison`), 68 (`applyProbe`), 70 and 73 (`apply` with `immuneHd`, `runAfter`, `casterEffect`), 75 (`raise`), 76 (`slay`), the dice count for 4, 20, 65, 66, 72, 74, 87 (`recordDice`), 80's line. 92 and 98 (`beam`, on the template), 93 (`apply` with `saveShift`). Every id is now transcribed.

Inferred or open in the port (I / ?): Strength's bonus when no class applies (0, the original's is uninitialised); Entangle's L for Duration(0x88) (the cast's level); Poison with no combat target (nothing) and its blank effect record; the record a run-at-once handler gets after add-effect (the new one; the original looks up the first of the type, and for Fumble passes none); Raise Dead on the battlefield (the fallen are not put back on their square); Dimension Door to an occupied square (the port does not move the caster); Hold Person's bonus past 4 targets (the last bonus). A body still in use when a zone lifts: a body still down (the original tests its record's pointer).
