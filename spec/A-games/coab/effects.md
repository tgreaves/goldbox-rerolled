# CotAB effects: diff against PoR `engine/effects.md`

> **Status: complete as a set of differences.** Normative. Part A of the
> [specification](../../README.md): Curse of the Azure Bonds. Read [engine/effects.md](../engine/effects.md)
> first; types not listed here behave as there. Evidence marks as in the README. The engine model's
> behaviours, specials and CotAB's handler map are [B-model/vocabularies.md](../../B-model/vocabularies.md)
> (§3, §5, §6), the current-stat routine [B-model/procedures.md §11](../../B-model/procedures.md#11-the-current-stat-routine).

Read from the CotAB image (2026-10-20). CotAB Ghidra-style `SSSS:OOOO` is the image paragraph itself (`4aab:0523` = image 0x4AFD3).

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

**Same as PoR** (structure identical, globals translated): 1 2 5 6 8/45 9/46 10 11 15 16 17 19 21 24 29 30 31/51/52/53 33 34 36 39 41 42 43 44 49 55 56 58 59 61 62 64 65 66 67 70 71 72 78 79 80 89 92 93 94 97 98 99 100 101 102 104–118 120 124 125 127; 88 too but for a dead store (below). Small changes: 20 and 25 act only when arg = 0; 22, 32, 95 call the far set-status routine; 40 has a 0x1E-byte zone record at DS:7575; 32's sweep uses the fighter level with its dual-class part.

**Changed or new** (event in brackets):

- **74** empty (0x28A5E: PoR's grab and crush is gone; event 23 lists it but never fires). Stats and saves: **3** [7] fighting snakes (pw −= attacks left, removed when that empties it; turn ends). **4** [16] attacker with +0x14B & 1 → roll −7 (Dispel Evil's defence). **7** [11] AC front/rear +2, capped 0x3C. **12/38, 14, 146** empty: removal recomputes the stat (§1); PoR wrote the stat from the power. **13** [15] suffocation: pw 0 → status 6 "Suffocates", else pw −1. **35** [21] Confusion, d100: 1–10 "runs away" (removes 35, rec[0x10] = 1, computer control, morale 0xB3, target cleared, adds 0x8E for 10); 11–60 "is confused", turn ends; 61–80 "goes berserk" (adds 0x89 with pw = own side and runs it); 81–100 "is enraged"; then a save vs type 4 at −2 removes 35. **50** [12, 20] cold → save +2; fire unsaved (DS:6FC2 = 0) → damage ×2. **54** [12, 20] fire → save +2; cold with DS:5D0B = 0 → ×2 (5D0B: probably a bug for 6FC2, ?). **68** (direct) Feeblemind: current INT and WIS := 7, "is stupid"; in combat the spell being cast is lost.
- Combat modifiers: **18** [10] target +0x14B & 2 → roll +1 (PoR's name list gone). **26** [10] target +0x14B & 4 → roll +1. **27** [7] ends the turn. **28** roll 1d((pw>>4)+1), pw −1 per image lost. **37** applies when rec[3] = 0 (PoR > 0). **47** [16] attacker monster type ∈ {2, 10} and size & 0x7F = 2 → roll −4. **48** [16] monster type 1 and size 2 → roll −4. **60** [5] weapon missing or plus 0 → 0; plus < 3 → /2. **63** [6, 9] Minor Globe: a resolving spell of level < 4 → negated. **69** [1] attacker monster type 19 without 0x18 → untargetable; roll −4 either way. **73** [6] damage type & 0x20 → negated, "is unaffected". **75** [4, 10, 13] target monster type 3 → damage 3·1d12 + 4 + STR bonus (I); roll +2. **76** [4, 10] target type 8 → roll +3, damage +3. **81** [5] damage /2. **82** [5, 6] fire or cold → save vs type 4: saved and the spell's save effect ≠ 0 → 0, else /2. **84** [6] electricity → negated; HP +8 (a 1d8 rolled and discarded, I: bug). **85** [5] piercing weapon (ITEMS kind 1, I) → damage 1. **103** [4] target without 0x14, 0x36, 0x3D → +1d6. **110** [6] full cold immunity. **129** [6, 9] 100% magic resistance (adding, or damage type & 8 → negated). **133** [6] blocks 0x8E, 0x1D, 0x44; damage type & 0x40 → negated. **134** [4] target +0x14B & 8 (giant class) → damage + the holder's ranger level. **135** [6] electricity → negated. **136** [7] combat-rec[6] (movement) := 0. **143** [5] adjacent attacker takes 2 × the damage as type 8 ("gets zapped").
- On-hit: **57** [2] engulf (both hand-1 hits, target active without 0x3A and 0x0D: "engulfs", target 0x3A (pw = its index, run at once) and 0x0D (pw 2d4), engulfer 0x8B). **96** [2] hug on roll ≥ 18 (target 0x3A, hugger 0x90). **122** [2] save vs 0 or Hold 0x34 (permanent, pw 0xFF), "is paralyzed". **123** [2] 2d8 of damage type 0x0A. **130** [5] quarrel with name word 0x87 → target gone (status 8). **145** [2] Dispel Evil touch: target +0x14B & 1 failing a save vs 4 → status 8 "is dispelled", and effects 4 and 0x91 leave the attacker; else "resists dispel evil".
- Monster specials [14] (the hook = the AI's spell target pick `*DS:72BA(&DS:7760, 1, spell)`, §7): **83** petrifying gaze (0x497CE): target cleared, the hook for spell 0x41; none, nothing. "gazes..." (no pause), the spell bolt (`19de(18)`, 4 frames, 45 ms); with 0x7F on the gazer, the target's first readied item with name word 0x76 in any of +0x2F, +0x30, +0x31 "reflects it!" (flight back) and the gazer is the victim (PoR looks at +0x31 only); save vs 1 or status 7 "is Stoned". **86** spit acid (0x49B5E; the hook for 0x41, within 7, d100 ≤ 30; damage = the spitter's max HP, half on a save vs 3). **87** eye rays (0x2E842): the target cleared and a new one found (`2e711(1)`: the finder 0x2E394(c, 0xFF, 0, forceNew), then a line-of-sight call whose result is unused); up to 4 times while there is a target, the first unused of: distance (0x4F758) ≤ 2 "fires a disintegrate ray", save vs 3 or status 8 "is disintergrated" (sic); ≤ 3 "fires a stone to flesh ray", save vs 1 or 7 "is Stoned"; ≤ 4 "fires a death ray", save vs 0 or 6 "is killed"; ≤ 5 "wounds you" (the beholder's name), 2d8 + 1 (`e3:52`, no save, damage type left as it is); each with one frame of `19de(k + 13)` (k 5, or 10 for stone) flying to the target at 30 ms (`2e6a9`) and `2e711(0)` (keep the target if still valid, else a new one) after it; otherwise the first unused of the spells 0x54 Fear, 0x37 Slow, 0x15 Sleep (kinds 0x10/0x20/0x40) through the cast routine 0x45251 (`c2:39(spell, ai 1, announce 1, &ok)`). **88** "Breathes!" (0x499CD): PoR's 88 ([engine/effects.md](../engine/effects.md) row 88) with DS:6FAF := 0x24 first, a dead store: the hit routine sets 0x0C (0x47977) and clears it after; the bolt routines are CotAB's (§7). No CotAB monster carries it. **90** acid breath (0x49C94): DS:7760 := 0; round 0 (DS:75A7) sets pw := 3; pw 0 → nothing; DS:6FAF := 0x30; the hook for 0x3D (range 6); with a target the area template 0x4573F(x, y, aim, width 1, length 6); any listed combatant whose side (+0x197) is not the breather's opposite (0x4F5B4) cancels it, as does an empty list; "breathes acid", one frame of `19de(18)` to the first listed (30 ms), each listed takes max HP, half on a save vs 3; pw − 1; the turn ends. **91** a second cloud zone. **126** gaze (the hook for 0x41; save vs 1 or Hold 0x34 for 60, "is paralyzed"). **128** fire breath (0x49E74): as 90 without the DS:7760 reset and the own-side check; DS:6FAF := 0x21, the template with width 3 and length 9, "breathes fire". **131** (the hook for 0x41) d100 ≤ 50 and adjacent: "Breathes Fire", 7 damage, half on a save vs 3. **132** "throws lightning" (0x4A121): in rounds 0–3 only (DS:75A7 < 4); the pause; the hook for 0x33 (Lightning Bolt; its ok flag unread, so without a target the aim stays on the thrower's own square and the first bolt hits it); invisibility goes (0x4C023); `19de(19)`, flight to the aim (4 frames, 50 ms); 0x478F6 on the aimed square with 16d6 (`e3:52`), then 0x479B4(10, a fresh 16d6, save 4, bonus 0); the turn ends. **139** the engulfer's hold (2 attacks of 2d8 on the victim while both are active).
- Holds and markers: **77** [15] and **137** berserk (computer control, morale 0xB3/0xB2, nearest combatant as target, side := its side XOR 1, "goes berzerk"; removal: 77 side 0, 137 side := pw). **140** (0x8C) Lay on Hands used (marker). **141** (0x8D) removal: the paladin's Cure Disease uses ([records.md](records.md) §10). **142** (0x8E) runs away; removal: morale 0xB3 → 0, computer control off, rec[0x10] := 0. **144** (0x90) the hugger's hold.
- **147** (0x93) the generic item handler, also DS:720C: ready → add raw effect item[0x3D] (duration 0, power 0xFF, flag 1), run at once outside combat; unready → remove the first of that type with its callback. Item +0x3E now: 0x80 = grant effect +0x3D; 0x81 and up = stat or ability kinds (& 0x7F) for the effective-stat routine and 0x3F034. PoR's item handlers 128–139 do not exist in CotAB. Spiritual Hammer (23) makes its item with +0x3E = 0xA0.

## 3. Globals

| PoR | CotAB | name in part B ([vocabularies.md §1.1](../../B-model/vocabularies.md#11-the-shared-globals)) |
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

## 7. The target hook, bolts and the area template (O unless marked)

**Target hook** `*DS:72BA`: in combat 0x2C781 (`2a55:2231`, set at 0x21E41; `c2:34` outside), CotAB's
`FUN_3aae_20c3(spell, ai, &ok)`: ok := 1, the list DS:744E (count) / DS:744F (pointers) emptied, DS:6FB7 := 0,
the aim DS:7573/7574 := the caster's square; then by mode (spell byte 6 & 0xF) as PoR's, through the picker
0x2C56C (PoR `1e16`, I: not compared line by line), with a mode 5 of its own; a failed pick sets ok := 0.
The specials call it with ai = 1 for spell 0x33 (Lightning Bolt: range 4 + level, mode 8), 0x3D (range 6, one
pick, effect 0x34, so helpless targets are refused) or 0x41 (range 12, one pick). The finder sets the
target (combat record +0xA), which 83, 86, 126 and 131 read afterwards.

**Bolt hit** 0x478F6(x, y, dmg, save, last, &bounce), against PoR's `28bc`: the creature on the cell is hit
unless it is `last` (the one the previous stop hit); bounce := the cell has movement 0xFF, **and** ECL
A[0x1CC] (0x4BE6, the map-area word) = 1, **and** the flag was 0 (never twice in a row), else 0. Damage type
0x0C, a save of `save` halves (mode 2), `19de(19)`, the type back to 0.

**Bolt path** 0x479B4(len, dmg, save, bonus), against PoR's `295b` ([engine/combat-rules.md](../engine/combat-rules.md), Lightning Bolt): the
same walk, plus: crossing a cell of movement 1 clears the bounce flag; `last` goes to the hit and is
replaced after it; the length is charged with the cost added since the previous stop (PoR: the line's whole
cost at every stop). After a bounce the new line's cost starts at 0 while the previous stop's cost is
kept, so the next difference wraps below zero as a byte and ends the bolt (a quirk, 0x47C01). Lightning
Bolt (0x47C49): 0x478F6(aim, L d6, 4, 0), then 0x479B4(**7**, the same roll, 4, 1); PoR 8. Javelin of
Lightning (0x47FB0): 20 + 1d6 on the aim, then 0x479B4(3, 20, 4, 0).

**Area template** 0x4573F(x0, y0, x1, y1, width, len) (nested: 0x455E6 sets the line, 0x45627 clamps,
0x45672 collects). The line walker 0x54CA5/0x54D4C (PoR's, plus +0x17 = the direction of the last step,
from DS:255A) runs from (x0, y0) to (x1, y1), keeping each step's direction; while its cost is below 2·len
and (x1, y1) lies in 1..48 × 1..23, the end moves on by those directions in turn (DS:2696/269F; +2 straight,
+3 diagonal). The end is clamped to 0..49 × 0..24 and brought back by the line-of-sight routine 11c:39
(0x54EF1) to where sight stops; its range argument is an uninitialised word (bp−0x78, ?; a conforming build sets no
limit). The creatures met on that line (0x55BB5) are listed in order; once one is met a second time (a 2×2
creature's second cell) a flag is set that is never cleared, and nobody further is listed (a quirk, 0x458F0).
Width 2 adds those on the line to the end + (DS:0A22, DS:0A2A)[d], width 3 also to the end + (DS:0A12,
DS:0A1A)[d], d the direction of the step onto the last creature listed on the first line (unset without
one, ?; a conforming build takes the last step's); these lines are not cut by sight. The list (DS:744E/744F) leaves
out the current combatant (DS:6520). Three spell handlers call it too (0x48A8C, 0x49522, 0x496D1).

## Open

- Damage type 0x20 (breath, **I**) and 0x40 (**?**), §3.
- The area template's two uninitialised values (the range of the sight cut, the direction without a
  creature on the first line), §7: **?** in the original, the build's choice stated there.
