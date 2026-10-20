# CotAB effects: diff against PoR `spec/effects.md`

Part of [[spec/coab/README]]. Read from the CotAB image (2026-10-20); machine-readable lists in the port's `web/src/games/effectrules.ts`. Marks: O seen in code/data, I inferred, ? unknown. CotAB Ghidra-style `SSSS:OOOO` is the image paragraph itself (`4aab:0523` = image 0x4AFD3).

## 1. Dispatch (O)

- **Event dispatcher** 0x4AEC4 (`4aab:0414`, thunk `e3:34`): `case event` → per-type call for each listed type, as PoR's FUN_5216_02fa; events **0–23** (PoR 0–19).
- **Per-type call** 0x4AD2A: area set `4aab:025a` = {21, 45, 46, 49} (as PoR); combat radius 6 for type 0x31, else 1.
- **Handler call** 0x4AB77: if DS:759C ≠ 0, the far pointer DS:720C (handler 0x93, the generic item handler); else DS:6FC0 + 4·type, called as (arg, eff, char).
- **Remove** 0x4ABBA: as PoR (callback if eff[4] ≠ 0, unlink from char+0xF2, next at +5, 9-byte records), then **type 0x0E → recompute CHA; 0x0C, 0x26, 0x92 → recompute STR** (`4aab:18d9`, the effective-stat routine).
- **New events**: 20 damage not saved (apply-damage 0x4CAB2: event 6, then saved → mode 1 none / mode 2 half, else event 20); 21 a turn begins with combat-rec[0] = 0 (0x2209E, after event 15); 22 combat starts, after event 8 for each character (0x26A1A); 23 never fired (type 74 is dead).

### Event → types, in the order called

| ev | PoR (0x4245A) | CotAB |
|---|---|---|
| 0 | 126 | – |
| 1 | 63 37 25 71 | 37 25 71 69 |
| 2 | 85 86 87 68 79 80 76 73 77 | 79 80 145 57 96 122 123 |
| 3 | 64 65 66 67 68 69 70 79 85 86 87 | 64 65 66 67 70 79 87 |
| 4 | 29 3 6 | 29 6 103 75 76 134 |
| 5 | 28 41 104 120 101 115 116 119 123 96 94 60 122 117 | 28 41 104 120 101 115 116 119 94 117 60 81 82 85 130 143 |
| 6 | 113 61 122 60 91 10 20 105 106 112 114 118 17 93 101 28 | 113 61 10 20 105 106 112 114 118 17 93 101 28 110 73 82 84 129 133 135 63 |
| 7 | 51 52 53 31 | 51 52 53 31 3 27 136 |
| 8 | 99 81 82 89 72 56 | 99 82 89 72 56 |
| 9 | 105–112 124 125 | the same + 63 129 |
| 10 | 1 2 33 36 49 3 6 18 26 | 1 2 33 36 49 6 18 26 75 76 |
| 11 | 33 17 8 9 45 46 30 | the same + 7 |
| 12 | 8 9 10 17 20 33 36 45 46 49 61 111 125 90 97 | 8 9 10 17 20 33 36 45 46 49 61 111 125 97 50 54 |
| 13 | 99 100 103 75 74 | 99 100 75 |
| 14 | 83 84 88 121 | 83 88 121 86 87 90 126 128 131 132 139 |
| 15 | 21 30 74 75 11 | 21 30 11 13 77 |
| 16 | 25 71 37 47 48 89 | the same + 4 |
| 17 / 18 / 19 | 1 2 11 / 39 42 58 / 98 23 72 56 11 | the same |
| 20 / 21 / 22 / 23 | – | 50 54 / 35 / 138 / 74 |

## 2. Handlers (DS:6FC0 + 4·type, filled at 0x29E28 plus 8 slots at 0x4AA3A; types 1–147)

**Same as PoR** (structure identical, globals translated): 1 2 5 6 8/45 9/46 10 11 15 16 17 19 21 24 29 30 31/51/52/53 33 34 36 39 41 42 43 44 49 55 56 58 59 61 62 64 65 66 67 70 71 72 78 79 80 89 92 93 94 97 98 99 100 101 102 104–118 120 124 125 127. Small changes: 20 and 25 act only when arg = 0; 22, 32, 95 call the far set-status routine; 40 has a 0x1E-byte zone record at DS:7575; 83 first picks its own target through the AI hook `*DS:72BA` and exits without one; 32's sweep uses the fighter level with its dual-class part.

**Changed or new** (event in brackets):

- Stats and saves: **3** [7] fighting snakes (pw −= attacks left, removed when that empties it; turn ends). **4** [16] attacker with +0x14B & 1 → roll −7 (Dispel Evil's defence). **7** [11] AC front/rear +2, capped 0x3C. **12/38, 14, 146** empty: removal recomputes the stat (§1); PoR wrote the stat from the power. **13** [15] suffocation: pw 0 → status 6 "Suffocates", else pw −1. **35** [21] Confusion, d100: 1–10 "runs away" (removes 35, rec[0x10] = 1, computer control, morale 0xB3, target cleared, adds 0x8E for 10); 11–60 "is confused", turn ends; 61–80 "goes berserk" (adds 0x89 with pw = own side and runs it); 81–100 "is enraged"; then a save vs type 4 at −2 removes 35. **50** [12, 20] cold → save +2; fire unsaved (DS:6FC2 = 0) → damage ×2. **54** [12, 20] fire → save +2; cold with DS:5D0B = 0 → ×2 (5D0B: probably a bug for 6FC2, ?). **68** (direct) Feeblemind: current INT and WIS := 7, "is stupid"; in combat the spell being cast is lost.
- Combat modifiers: **18** [10] target +0x14B & 2 → roll +1 (PoR's name list gone). **26** [10] target +0x14B & 4 → roll +1. **27** [7] ends the turn. **28** roll 1d((pw>>4)+1), pw −1 per image lost. **37** applies when rec[3] = 0 (PoR > 0). **47** [16] attacker monster type ∈ {2, 10} and size & 0x7F = 2 → roll −4. **48** [16] monster type 1 and size 2 → roll −4. **60** [5] weapon missing or plus 0 → 0; plus < 3 → /2. **63** [6, 9] Minor Globe: a resolving spell of level < 4 → negated. **69** [1] attacker monster type 19 without 0x18 → untargetable; roll −4 either way. **73** [6] damage type & 0x20 → negated, "is unaffected". **75** [4, 10, 13] target monster type 3 → damage 3·1d12 + 4 + STR bonus (I); roll +2. **76** [4, 10] target type 8 → roll +3, damage +3. **81** [5] damage /2. **82** [5, 6] fire or cold → save vs type 4: saved and the spell's save effect ≠ 0 → 0, else /2. **84** [6] electricity → negated; HP +8 (a 1d8 rolled and discarded, I: bug). **85** [5] piercing weapon (ITEMS kind 1, I) → damage 1. **103** [4] target without 0x14, 0x36, 0x3D → +1d6. **110** [6] full cold immunity. **129** [6, 9] 100% magic resistance (adding, or damage type & 8 → negated). **133** [6] blocks 0x8E, 0x1D, 0x44; damage type & 0x40 → negated. **134** [4] target +0x14B & 8 (giant class) → damage + the holder's ranger level. **135** [6] electricity → negated. **136** [7] combat-rec[6] (movement) := 0. **143** [5] adjacent attacker takes 2 × the damage as type 8 ("gets zapped").
- On-hit: **57** [2] engulf (both hand-1 hits, target active without 0x3A and 0x0D: "engulfs", target 0x3A (pw = its index, run at once) and 0x0D (pw 2d4), engulfer 0x8B). **96** [2] hug on roll ≥ 18 (target 0x3A, hugger 0x90). **122** [2] save vs 0 or Hold 0x34 (permanent, pw 0xFF), "is paralyzed". **123** [2] 2d8 of damage type 0x0A. **130** [5] quarrel with name word 0x87 → target gone (status 8). **145** [2] Dispel Evil touch: target +0x14B & 1 failing a save vs 4 → status 8 "is dispelled", and effects 4 and 0x91 leave the attacker; else "resists dispel evil".
- Monster specials [14]: **86** spit acid (within 7, d100 ≤ 30; damage = the spitter's max HP, half on a save vs 3). **87** eye rays (up to 4 a turn, each once: disintegrate ≤ 2 squares, stone ≤ 3, death ≤ 4, wounds ≤ 5). **88** "Breathes!" (damage type 0x24). **90** acid breath (3 uses, area shape 6, aborts if its own side is in the area; max HP, half on a save vs 3). **91** a second cloud zone. **126** gaze (save vs 1 or Hold 0x34 for 60, "is paralyzed"). **128** fire breath (3 uses, shape 9, damage type 0x21). **131** d100 ≤ 50 and adjacent: "Breathes Fire", 7 damage, half on a save vs 3. **132** "throws lightning": two 16d6 bolts. **139** the engulfer's hold (2 attacks of 2d8 on the victim while both are active).
- Holds and markers: **77** [15] and **137** berserk (computer control, morale 0xB3/0xB2, nearest combatant as target, side := its side XOR 1, "goes berzerk"; removal: 77 side 0, 137 side := pw). **140** (0x8C) Lay on Hands used (marker). **141** (0x8D) removal: the paladin's Cure Disease uses ([[spec/coab/records]] §9). **142** (0x8E) runs away; removal: morale 0xB3 → 0, computer control off, rec[0x10] := 0. **144** (0x90) the hugger's hold.
- **147** (0x93) the generic item handler, also DS:720C: ready → add raw effect item[0x3D] (duration 0, power 0xFF, flag 1), run at once outside combat; unready → remove the first of that type with its callback. Item +0x3E now: 0x80 = grant effect +0x3D; 0x81 and up = stat or ability kinds (& 0x7F) for the effective-stat routine and 0x3F034. PoR's item handlers 128–139 do not exist in CotAB. Spiritual Hammer (23) makes its item with +0x3E = 0xA0.

## 3. Globals

| PoR | CotAB | port `fx` |
|---|---|---|
| 6816 | 6FAC | save |
| 6817 | 6FAD | adding |
| 6818 | 6FAE | dmg |
| 6819 | 6FAF | dmgType |
| 681A / 681B / 681C | 6FB0 / 6FB1 / 6FB2 | rate / spell / dice |
| 681D / 681E / 681F / 6820 | 6FB4 / 6FB5 / 6FB6 / 6FB7 | rateIsMove / untargetable / noRearm / area |
| 6822 | 6FB9 | roll |
| 6823 / 6824 | 6FBA / 6FBB | hits[1] / hits[2] |
| 6825 | 6FBC | morale |
| 682A | 6FC1 | saveType |
| – | 6FC2 | new: the save succeeded |

Damage types: 1 fire, 2 cold, 4 electricity, 8 magic, 0x10 acid, new 0x20 breath (I), 0x40 (?).

## 4. Monster-class flags char+0x14B (O; 0 in every player character)

| bit | read by | meaning |
|---|---|---|
| 1 | 4 (attacker: roll −7), 145 (dispellable) | evil or extraplanar (I) |
| 2 | 18 | kobold/goblin kind (gnome bonus), replacing PoR's names |
| 4 | 26 | orc/goblin kind (dwarf bonus) |
| 8 | 134 | giant class (ranger bonus) |

Records with the flags (MON*CHA): ETTIN 0x08; BUGBEAR, 0x0C; TROLL, OGRE, TYRANTHRAXUS 0x0E; EFREETI, SALAMANDER, HELL HOUND 0x01.

## 5. The current-stat routine 0x4C389 (`4aab:18d9`, char, stat) (O)

The current value (+0x11 + 2i, STR% +0x1C) from the base (+0x10 + 2i, STR% +0x1D), the readied items with
+0x3E above 0x80 (kind = +0x3E & 0x7F, value +0x3D; "kind 8" needs a base below 18) and the effects:

| stat | items | effects |
|---|---|---|
| STR | kind 5: +0x3D 0 → 18/00, 1–6 → 19–24; kind 8 (+0x3D 0): base + 1; kind 0x0D: 3 | 0x26 adds its power (as STR in an effect's power: ≤ 101 → 18/(p−1), else p − 100) to STR when below 18/00, capped at 18, with fighters, paladins and rangers (level or former level) going on into 18/xx at 10 % a point over the current STR%; 0x92, then 0x0C set it. The best wins (`4aab:1771`: higher STR, or 18 with a higher %: an 18/xx beats 19, a quirk) |
| INT | kind 8 (+0x3D 1) +1; kind 0x0C: 7; kind 0x0D: 3 | Feeblemind 0x44: 3 unless an item made it 7 or less |
| WIS | kind 8 (+0x3D 2) +1 | 0x44: 3 |
| DEX | kind 2 +4 (base ≤ 6) / +2 (≤ 13) / +1; kind 8 (+0x3D 3) +1; kind 0x0A −2 | – |
| CON | kind 6 +1; kind 8 (+0x3D 4) +1; then max HP := rolled HP (+0x12C) + the CON bonus over every class's levels up to its fixed-HP stop level (DS:3EBB) above +0xE6, and former dual-class levels (rangers one more), divided by the classes with a level; the current HP moves by the change. CON 20+ keeps regeneration 0x3E (60 min, flag 1), else removes it (whose removal re-arms it, as PoR's 62) | – |
| CHA | kind 6 −1; kind 8 (+0x3D 5) +1 | 0x0E adds its power |

Called by the removal routine (§1), the item routine 0x3F034 and the temple's Heal (INT and WIS).

## 6. Item kinds 0x3F034 (O)

Ready (after +0x34 := 1) and Unready (after +0x34 := 0, not cursed) of an item with +0x3E ≥ 0x80
(0x3F40D…0x3F57D) call 0x3F034(item, readying), which reads the character from DS:6520. By kind: **0**
the generic handler 147 (DS:759C := 1, so the handler call takes DS:720C): ready → add raw +0x3D
(0, 0xFF, flag 1) and, outside combat (DS:4FD3 ≠ 5), run it; unready → remove the first of that type.
**1** Ring of Wizardry: ready doubles magic-user slots of levels 1–3; unready works them out from the
magic-user level (with the former one when it counts, `fe:52`) as 1 + the increments of DS:44AB, then
forgets memorised magic-user spells past the slots (the other ring and the ranger's slots are
forgotten too, a quirk). The slot routine 0x50480 also doubles them for each readied ring (0x507C3).
**2** DEX, then thief skills (0x50F5A); **4** alignment-locked weapon (+0x3D low nibble the alignment,
else unreadied and +0x3D >> 4 magic damage; also on Unready); **5** STR; **6** CON and CHA; **8** the
stat +0x3D; **9** unready ends Spiritual Hammer (0x17); **0x0A** DEX; **0x0B** thief skills; **0x0C**
INT; **0x0D** STR and INT.

## Port status (2026-10-20)

Done (`web/src/games/effectrules.ts` names a behaviour per type with its parameters, `web/src/rules/coabeffects.ts`
holds them; `test/coabeffects.test.ts`):

- Event lists and area set (profile data). Events 20 (the combat and world damage routines, after event
  6 when not saved), 21 (turn start, after event 15 when not casting) and 22 (combat start, after event 8
  for each character) are fired in both games; PoR lists nothing for them. DS:6FC2 is `fx.saved`, set by
  the combat and world saves as 0x4BDA1 does (1 while event 12 runs).
- Monster-class flags as the field `classFlags` (+0x14B; PoR −1).
- Handlers 3, 4, 7, 12/14/38/146 (empty), 13, 18, 20, 25, 26, 27, 28, 35, 37, 47, 48, 50, 54, 57, 60, 63,
  68, 69, 73, 75, 76, 77, 81, 82, 84, 85, 86, 91 (empty: no zone of its list exists), 96, 103, 110, 122,
  123, 126, 129, 130, 131, 133, 134, 135, 136, 137, 138, 139, 142, 143, 144, 145; 141 refills the
  paladin's uses (as before). The rest run PoR's handler (the "same as PoR" list).
- Removal recomputes CHA (0x0E) and STR (0x0C, 0x26, 0x92) through the current-stat routine (§5).
- Readying and putting away items through the item kinds (§6), with handler 147; the slot routine's
  Ring of Wizardry doubling (training's `derive` takes the items when the caller has them).

Not yet, or approximated:

- **Event 14 is not fired** by the port's combat AI in either game (PoR's 0x33EA6, before the melee loop),
  so the monster specials (PoR 83, 84, 88, 121; CotAB 86, 126, 131, 139, 144, …) are written but dormant.
  Firing it changes PoR's combat and is a step of its own.
- **87** eye rays, **88** breath, **90** acid breath, **128** fire breath, **132** lightning: not
  transcribed (`unported`, which does nothing; PoR's 87 and 90 mean other things and must not run).
  They need area templates (shapes 6, 9) and bolt paths in the combat host, and disintegration.
- The AI target hook `*DS:72BA` that 86, 126, 131 (and 83) call is not transcribed: the port keeps the
  current target, else the nearest enemy (I). Berserk's nearest-combatant search (11c:3e) takes the
  first of equal distance (I). Sounds (`ed:8e`) of the specials are not played.
- 130 takes the target out of play through the host's status call; CotAB's own death clean-up `e3:66`
  is not transcribed.
- CotAB's add-with-message 0x4CD92 replaces an old record of the type whenever it has a duration; the
  port's `addEffect` keeps PoR's rule (only for a longer or permanent one).
- The ECL DAMAGE save (engine.ts) does not set DS:6FC2.
