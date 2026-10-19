---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Effects ("affects")

Part of [[spec/README]]. Produced by a delegated analysis of all 117 handler routines (Ghidra pseudocode plus direct disassembly where Ghidra failed); the Haste/Slow finding was re-verified by hand at 0x31E9C/0x31EBF. O/I markers as elsewhere.

Linear addresses throughout: linear = 0x10000 + img.bin offset, and seg:off = seg*16+off. Handler segment 3723 is linear 0x37230. DS = 0x1C7C, so DS-relative initialised data sits at img.bin offset 0xC7C0+x.

## 1. How handlers are invoked, and how they learn the event

**There is no current-event global.** The hook `FUN_5216_02fa(char, event)` (0x5245A) is a large `case event of` that calls `FUN_5216_0160(type, char)` for a **fixed list of effect types per event**. The table below was extracted from 0x5245A–0x52C15. A handler therefore "knows" its event only because it is listed under that event. Handlers listed under several events usually do something harmless at the events where it does not matter: for example Resist Fire adds +3 to the save roll at event 6, where nothing reads it.

`FUN_5216_0160` (0x522C0) does the following:
- If `char` has the type (`FUN_10ba_2199`), it dispatches to it.
- Otherwise, if the type is in the Pascal set at CS:0x140 = **{21, 45, 46, 49}** (Silence 15', PfE 10', PfG 10', Prayer), it searches every character in the list at DS:5D96 (linked by +0x104) for a holder.
  - In combat (DS:49F3 = 5), the holder only counts if `char` stands in the squares returned by `FUN_13db_003e`, using radius 6 for Prayer (0x31) and 1 for the others.
  - Outside combat, any holder counts.
- It then calls `FUN_5216_0000(arg=0, holder_effect, char, type)`. That routine jumps to the far pointer at DS:6828+4*type (filled at runtime, all zeros in the image). The handler is called `handler(arg, eff, char)`, where arg is at bp+6, eff at bp+8 and char at bp+C.

`arg` is 0 for hook calls. It is **1 for removal**: `FUN_5216_0026` (0x52186, remove effect) calls the handler with arg=1 only if `eff[4] ≠ 0`, then unlinks and frees the record. So **eff[4] is the "call me on removal/expiry" flag**. The removal at 0 HP (`FUN_5216_100a`) goes through `FUN_5216_0026` too (O), so a grabber or stirge that goes down frees its victim (74/75 → remove 58) and a charm ends. Handlers marked **R** below work only through this path (they have no hook entry). Many of them re-arm themselves to make periodic effects. The duration countdown at 0x4B5E3 does this: duration 0 = permanent; if elapsed < duration, it subtracts; otherwise it calls `FUN_5216_0026`, which runs the R callback.

For item handlers (128–139), the dispatcher is called with an **item pointer in place of eff**: the item's +0x3E byte is the handler type and +0x3D is its parameter. Arg 0 means readied, 1 means unreadied (see 0x3A10A, which uses `param_2+0x3d`; item 23 is created with +3D=0x17 and +3E=0x89).

### Event codes and call sites

| ev | fired on | site(s) | meaning / globals in play |
|---|---|---|---|
| 0 | attacker | 0x3BBDF | can-target check `FUN_3aae_1085` (0x3BB65, returns !681E): attacker's combat-rec target temporarily set; DS:681E=1 → cannot target |
| 1 | target | 0x3BB9E | same check, target side (DS:681E cleared just before) |
| 2 / 3 | attacker | 0x3C22E | after a hit with attack 1 / 2 (event = hand index+1), only if target still active (+0x10D) |
| 4 / 5 | attacker / target | 0x3ACFB / 0x3AD09 | melee damage rolled into DS:6818 (after backstab ×), DS:6819 reset to 0, before application |
| 6 | victim | 0x534BB in `FUN_5216_1344` (apply damage) | DS:6818 = damage, DS:6819 = damage type, DS:681C = dice count (set by dice `FUN_5216_0e2e`) |
| 7 | char | 0x322EC | start of turn |
| 8 | every char | 0x36BD5 | combat start (round counter DS:6DE3=0, DS:6822=0 just before) |
| 9 | target | 0x537DF in `FUN_5216_1656` | effect being added: DS:6817 = type; handler zeroing 6817 blocks it ("is Unaffected") |
| 10 / 16 | attacker / target | 0x52E55 / 0x52E62 in `FUN_5216_0cb7` (to-hit) | DS:6822 = fresh d20 (20 → 100); hit if 6822 ≥ 0 and 6822 + THAC0byte(+0x110) + side bonus ≥ AC arg. 16 is also fired at 0x52DE3 (`FUN_5216_0c4f`, roll vs +0x111) |
| 11 | target | 0x3C077 (melee), 0x4EEEB (spell attack) | after `FUN_10ba_0bb8` recomputes AC, **before** the to-hit roll |
| 12 | saver | 0x52F1A in `FUN_5216_0d63` (save) | DS:6816 = d20 + char+0x101 + bonus; DS:682A = save type (0 death/poison/para, 1 petri, 2 rod/staff/wand, 3 breath, 4 spell); success if save[0x6D+type] ≤ 6816 |
| 13 | char | 0x372FE (`FUN_3723_0058`, set status), 0x3B0DA | goes down / dies |
| 14 | attacker | 0x33EA6 | before melee loop (gaze/breath specials) |
| 15 | char | 0x3235C, 0x32736 | turn begins |
| 17 | char | 0x344AC, 0x344FF | morale check (DS:6825) |
| 18 | char | 0x3AB3E, 0x3B895 (DS:681D=0: DS:681A = half-attacks, result /2 via 0x3B932) and 0x3AC58 (DS:681D=1: DS:681A = 2×movement); also 0x50DA5 | rate modifiers |
| 19 | char | 0x3297C | round end |

### Shared globals and helpers

- Globals:
  - DS:6822 is the attack roll; DS:6823/6824 count hits per hand.
  - **DS:6816 is the save roll** (not 6822).
  - DS:6818 is damage. DS:6819 is the damage-type bitmask: **1 Fire, 2 Cold, 4 Electricity, 8 Magic, 0x10 Acid**. These come from the damage-message strings at 0x5341A–0x53450, chosen by `6819 & ~8` at 0x53544.
  - DS:681A is the rate value at event 18.
  - DS:681B is the spell being cast: set at 0x4F3DF before the spell routine runs, cleared at 0x4F3F1. Spell 15 = Magic Missile, inferred from PoR spell order; 84 sets 681B=10 alongside Charm Person.
  - DS:681C is the dice count. DS:681E means "untargetable". DS:681F suppresses re-arming in `FUN_3723_001f`. DS:6820 is set by area spells. DS:6826 is a scratch far pointer, usually the combat-record target (+0x108 → +0x0A).
- `FUN_3723_0000(t)` (0x37230): if t=0 **or** DS:6817=t, it sets DS:6818=0 and DS:6817=0. One call negates the damage (event 6) or blocks the effect being added (event 9).
- `FUN_3723_001f(dur, power, type, char)` (0x3724F): if DS:681F=0, it re-adds `type` (flag 1) and returns 1; otherwise it returns 0. This is the self-re-arm used by periodic R effects.
- `FUN_3723_0058(char, status, msg)` (0x37288): prints msg. Unless the char is already status 6/7/8, it sets status, clears can-act and HP, and fires event 13.
- `FUN_3723_0fac(pct, char)` (0x381DC): if the attacker has a weapon, distance > 1 and d100 ≤ pct, it prints "Avoids it", sets 6818=0, sets 6822=0xFF and decrements 6823 (missile deflection).
- `FUN_3723_101d(char)` (0x3824D): returns the attacker's ammo (`FUN_10ba_2e8b`), else its weapon (+0xCC). Item +0x32 = plus, +0x2E = type, +0x2F..0x31 = name-word indices; the word table is at DS:10A7, 0x15 bytes per entry (0x76 "Mirror", 0x98 "Holy Symbol", 0xB1 "Silver").
- `FUN_3723_1545(bonus, char)`: the target saves vs type 0 at the given bonus. On failure: "is Poisoned", add 55, status 6.
- `FUN_3723_15eb(dur, char)`: the target saves vs type 0. On failure: "is Paralyzed", add 52 (Hold) with duration dur and power 0x0C.
- `FUN_3723_2122(n, char)`: energy drain of n levels; details under 85/86.
- `FUN_3723_2915(base)`: magic resistance. pct = base − 5·(11 − `FUN_10ba_26c2(681B)`). If (6817 ≠ 0 or 6819&8) and d100 ≤ pct, it calls `FUN_3723_0000(0)`.
- `FUN_10ba_2637(char)` (0x131D7): **ends the turn** by clearing combat-record bytes 0, 3, 6 and 7.
- `FUN_5216_0e52(char, type, dur, power, flag)` adds an effect raw, with no de-duplication. Ghidra shows the arguments reversed: (flag, power, dur, type, char).
- `FUN_5216_1656(..., saved, saveNegates, msg)` fires event 9. If the effect is blocked, or saved and saveNegates=1, it prints "is Unaffected". Otherwise, if one already exists with old.dur > 0 and new.dur > old.dur, or new.dur = 0, it removes the old one; then it adds.
- `FUN_5216_1344(char, dmg, mode, saved)` sets 6818=dmg and fires event 6. If saved: mode 1 → 0 damage, mode 2 → half. Damage > 0 prints "takes N points of damage " ("takes 1 point of damage " for 1), in and out of combat. The kind matches 6819 & 0xF7 exactly: 1 "from Fire", 2 "from Cold", 4 "from Electricity", 0x10 "from Acid"; then "from Magic" if 6819 is 0 or 8. So combined types such as 0x0C (Shocking Grasp) name only the element, and 3 names nothing. Then the starburst (`10ba_1feb`), HP loss (`10ba_2228`), a lost spell for a caster in combat ("lost a spell"), and the down/dying/killed lines.
- `FUN_5216_175d(flag, amt, char)` heals. With flag=0, a char holding type 50 cannot be healed.
- `FUN_5216_1869(hp, char)` revives in place ("stands up and grins" / "gets back up"): status 0, HP=hp. It fails if the square is occupied.
- `FUN_5216_0de3(sides, count)` rolls count×d(sides). `FUN_5216_0e2e` does the same and also stores count in 681C.
- `FUN_1af8_0c10` is a Pascal string compare (ZF); the Ghidra `bVar5 = iVar3==0` lines are that flag.

## 2. Effect table

Ev = hook events; R = removal/expiry callback (eff[4]=1); D = invoked directly by other code. Pw = eff[3]. "Roll" = DS:6822, "save" = DS:6816, "dmg" = DS:6818.

| type | name | ev | behaviour | conf | handler |
|---|---|---|---|---|---|
| 1 / 0x01 | Bless | 10, 17 | roll +1; morale +5 | O | 3723_010d |
| 2 / 0x02 | Curse | 10, 17 | roll −1; morale −5 (floor 0) | O | 3723_011d |
| 3 / 0x03 | weapon bonus vs class 4 | 4, 10 | if attacker's target +0x9F = 4: roll +2, dmg +2 | O | 3723_013b |
| 4 / 0x04 | training start | R | prints "starts to train"; adds type 7 (dur 43200, pw FF, flag 1) | O (disasm) | 0x373AF |
| 5 / 0x05 | Detect Magic | – | marker, empty handler | O | 3723_319b |
| 6 / 0x06 | flaming weapon | 4, 10 | target +0x9F: 10→+1, 9/12→+2, 4→+3 to roll and dmg; sets 6819=9 (Fire+Magic) | O | 3723_01c3 |
| 7 / 0x07 | training complete | R | "is hardier"; CON +1. If CON ≥ 20, adds 62 (regen; dur 60, flag 1). Else, if CON ≥ 15, recomputes HP from class levels (+0x96..; fighter slot ×(CON−15), others ×1 or ×2) and adds it to max/cur HP (when CON ≥ 17 or fighter level > 0) | O/I (HP formula) | 0x37463 |
| 8 / 0x08, 45 / 0x2D | Protection from Evil (45 = 10' radius, area set) | 11, 12 | if current char (DS:5D92) alignment +0xA0 ∈ {2, 5, 8}: save +2, roll −2. **The roll −2 at ev 11 is overwritten**, because to-hit rerolls 6822 after ev 11 (0x3C077 → 0x3C1B3 → 0x52E32); only the save bonus works | O | 3723_0377 |
| 9 / 0x09, 46 / 0x2E | Protection from Good | 11, 12 | same for alignment ∈ {0, 3, 6} | O | 3723_03ac |
| 10 / 0x0A | Resist Cold | 6, 12 | if 6819&2: dmg/2, save +3 | O | 3723_03e1 |
| 11 / 0x0B | Charm Person | 15, 17, 19 | arg 0, first time (pw bit 0x20 clear): pw += 0x20 + side·0x40 (bit 6 saves the old side); side +0x10E := pw>>7 (charmer); +0x10F=1; if +0x84 < 0x80 then +0x84 := 0xB3; clears the combat target. Every call: morale := 100. Arg 1: side := bit 6; if +0x84 = 0xB3, set it to 0 | O | 3723_0400 |
| 12 / 0x0C, 38 / 0x26 | Enlarge, Strength | D/R | if pw < 0x80: STR/STR% := decode(pw) (`5216_110d`). Then among other 12/38 records, the one with the highest STR (and %) is made current: char STR := it, and its pw := encode(previous STR) (`5216_10e4`). Effect: the strongest active STR effect wins and the original STR is restored when all expire | O/I | 3723_04ba |
| 13 / 0x0D | Reduce | – | empty | O | 319b |
| 14 / 0x0E | Friends | D/R | CHA (+0x15) := pw; presumably pw holds the CHA to restore | O/I | 3723_05d6 |
| 15 / 0x0F | poison (slow) | R | re-arms (dur 10, flag 1) unless 681F; then, if HP > 1: 6819=0, 1 dmg (`1344`) | O | 3723_05eb |
| 16 / 0x10 | Read Magic | – | empty (checked directly at 0x4E98C) | O | 3723_0647 |
| 17 / 0x11 | Shield | 6, 11, 12 | AC no worse than 3 (+0x111 := max(+0x111, 57)); save +1; if 681B = 15 (Magic Missile) then dmg := 0 | O | 3723_064e |
| 18 / 0x12 | gnome racial attack | 10 | if target +0x9F = 1, size +0x6C = 1 and name ∈ {KOBOLD, KOBOLD LEADER, GOBLIN, GOBLIN LEADER} (DS:342..372): roll +1 | O | 3723_0679 |
| 19 / 0x13 | Find Traps | – | empty | O | 319b |
| 20 / 0x14 | Resist Fire | 6, 12 | if 6819&1: dmg/2, save +3 | O | 3723_06e4 |
| 21 / 0x15 | Silence 15' (area, r 1) | 15 | if casting (combat-rec[2] ≠ 0): "is silenced". Always clears combat-rec[1..2], cancelling the spell | O (disasm) | 0x3793F |
| 22 / 0x16 | Slow Poison | R | on expiry, if the char still has 55 (poisoned): "dies from poison", status 6. Then removes 15 silently (681F=1) | O (disasm) | 0x379A5 |
| 23 / 0x17 | Spiritual Hammer | 19 | arg 0: if the char has no item with type 0x14 and +0x31 = 0xF3, and holds < 16 items, creates a Hammer +1 (+0x3D=0x17, +0x3E=0x89 → item handler 137): "Gains an item". Arg 1: deletes the item. Then recomputes AC | O (disasm) | 0x37A10 |
| 24 / 0x18 | Detect Invisibility | – | marker, read by 25 | O | 319b |
| 25 / 0x19 | Invisibility | 1, 16 | if the attacker (5D92) lacks 24: 681E = 1 (untargetable). Roll −4. All 25 effects are removed from a char when it makes an attack roll (`5216_0fd2` at 0x53132) | O | 3723_0918 |
| 26 / 0x1A | dwarf racial attack | 10 | as 18, names {ORC, ORC LEADER, GOBLIN, GOBLIN LEADER, HOBGOBLIN, HOBGOBLIN CHIEF, GAGOOL, MACE} (DS:382..3F2): +1 per match | O | 3723_0947 |
| 27 / 0x1B | – | – | empty | O | 319b |
| 28 / 0x1C | Mirror Image | 5, 6 | roll 1d(pw+1). If > 1 **and 681B ≠ 0 (a spell is resolving) and 6820 = 0 (not area)**: dmg := 0, "lost an image", pw −1; at pw 0, removes itself. Melee (681B = 0) never consumes an image here | O (disasm) | 0x37BF0 |
| 29 / 0x1D | Ray of Enfeeblement | 4 | dmg −= dmg/4 | O | 3723_0a3d |
| 30 / 0x1E | Stinking Cloud | 11, 15 | if casting: "is coughing". Cancels the spell (rec[1..2] = 0); recomputes AC; rear AC +0x112 −2 (floor 0x32 = AC 10); front AC := rear | O (disasm) | 0x37C95 |
| 31 / 0x1F, 51 / 0x33, 52 / 0x34, 53 / 0x35 | helpless; Snake Charm; Hold Person; Sleep | 7 | `FUN_10ba_2637`: ends the turn at turn start | O | 3723_133f |
| 32 / 0x20 | Animate Dead | R | unless 681F: "collapses", status 6. Restores side := pw>>4, +0x10F=1, +0x76=0, +0x6B := +0x98, +0x72 = 0x0C, +0x84 0xB3 → 0, +0x9F := 0 | O (disasm) | 0x37D4B |
| 33 / 0x21 | Cause Blindness | 10, 11, 12 | roll −4; AC +0x111 and +0x112 −4 (4 worse); save −4 | O | 3723_0bac |
| 34 / 0x22 | Cause Disease | D | runs handlers 43 and 44 (same arg) | O | 3723_0bcf |
| 35 / 0x23 | Prayer (ally half) | D | save +1, roll +1 (called by 49) | O | 3723_0c06 |
| 36 / 0x24 | Bestow Curse | 10, 12 | roll −4, save −4 | O | 3723_0c15 |
| 37 / 0x25 | Blink | 1, 16 | if combat-rec[3] > 0 (not yet acted): 681E=1, roll := −1 (auto-miss) | O | 3723_0c26 |
| 39 / 0x27 | Haste | 18 | first call (pw bit 0x10 clear): sets the bit, "ages", age word +0x30 +1. Every call: 681A ×2 (half-attacks or movement) | O (disasm) | 0x37E7B |
| 40 / 0x28 | cloud zone | R | finds the DS:6DBB zone entry owned by char with id = pw>>4: "The air clears a little..."; restores 4 map tiles (or 0x1F if occupied), frees the 0x13-byte entry, redraws the other zones' tiles as 0x1E | O (disasm) | 0x37EF3 |
| 41 / 0x29 | Protection from Normal Missiles | 5 | if the attacker's missile/weapon has plus 0: `0fac(100)` (ranged only) | O | 3723_1086 |
| 42 / 0x2A | Slow | 18 | 681A /2 | O | 3723_10c1 |
| 43 / 0x2B | disease: STR | R/D | re-arms (dur 60). If STR > 3: "is weakened", STR −1. Else adds 31 (perm, pw FF) | O (disasm) | 0x3830E |
| 44 / 0x2C | disease: HP | R/D | re-arms (dur 10). If HP < 2: add 31 if absent. Else 1 dmg | O | 3723_1168 |
| 47 / 0x2F | dwarf/gnome defence vs giants | 16 | if the attacker has +0x9F = 1, size&0x7F = 2 and name ∈ {OGRE, OGRE LEADER, TROLL, FIRE GIANT, HILL GIANT, …} (DS:402..472): roll −4 per match | O | 3723_11f9 |
| 48 / 0x30 | gnome defence | 16 | if the attacker has +0x9F = 1 and name = BUGBEAR or GNOLL (CS strings 0x38498/0x384A0): roll −4 | O (disasm) | 0x384A6 |
| 49 / 0x31 | Prayer (area, r 6) | 10, 12 | if char side = (pw&0x10)>>4: calls 35 (+1/+1). Else roll −1, save −1 | O | 3723_12b2 |
| 50 / 0x32 | mummy rot: healing | R | re-arms (dur 14400); heals 1 HP (forced). Its presence blocks normal healing in `175d` | O | 3723_12fb |
| 54 / 0x36, 55 / 0x37 | – / poisoned marker | – | empty; 55 is checked by 22 and blocked by 111/125 | O | 1355 / 135c |
| 56 / 0x38 | permanent invisibility | 8, 19 | adds 25 (dur 1, pw 0x0C) with no de-dupe | O | 3723_1363 |
| 57 / 0x39 | mummy rot: decay | R | unless 681F: "Rots...", CHA −2 (floor 3). If pw>>4 > 1: pw −0x10, re-arms (dur 43200). Else "Dies rots away", status 6 | O (disasm) | 0x385C9 |
| 58 / 0x3A | held/attached | 18 | combat-rec[6] (move) := 0; if 681D (movement call): 681A := 0 | O | 3723_1452 |
| 59 / 0x3B | regen delay | R | adds 98 (perm, pw FF) | O | 3723_1472 |
| 60 / 0x3C | – | 5, 6 | empty | O | 319b |
| 61 / 0x3D | strong fire resistance | 6, 12 | if 6819&1: dmg −2 per die (floor = dice count 681C); save +4; if not Magic (6819&8 = 0), dmg := 0 | O | 3723_1490 |
| 62 / 0x3E | regeneration 1/hr | R | re-arms (dur 60); heals 1 | O | 3723_14eb |
| 63 / 0x3F | – | 1 | empty | O | 319b |
| 64 / 0x40 | poison on hit | 3 | target saves vs type 0 (+0) or dies (`1545`) | O | 3723_165d |
| 65 / 0x41 | poison on hit | 3 | same, save +4 | O | 3723_1671 |
| 66 / 0x42 | poison on hit | 3 | same, save +2 | O | 3723_1685 |
| 67 / 0x43 | paralysis on hit | 3 | save vs type 0 or Hold for 2d8 (`15eb`) | O | 3723_1699 |
| 68 / 0x44 | ghoul paralysis | 2, 3 | unless target race +0x2E = 2 (elf): Hold 63 | O | 3723_16bb |
| 69 / 0x45 | paralysis on hit | 3 | Hold for 1d9+10 | O | 3723_16e6 |
| 70 / 0x46 | poison on hit | 3 | death poison, save −2 | O | 3723_170b |
| 71 / 0x47 | always hidden | 1, 16 | 681E=1, roll −4 (no detect check) | O | 3723_171f |
| 72 / 0x48 | 95% invisibility | 8, 19 | if d100 < 96: adds 25 (dur 1) | O | 3723_1730 |
| 73 / 0x49 | rake | 2 | if 6823 = 2 (both hand-1 attacks hit) and the target is active: sets hand-2 attacks = 2 at 2d4 (+0x114/116/118), hand 1 = 0, "Rakes...", attacks (`FUN_3aae_1884`), ends turn | O (disasm) | 0x3E4B2 (seg 3AAE) |
| 74 / 0x4A | grab/crush | 13, 15 | victim = DS:65B9[pw]. If both active (arg 0): 1 attack 3d4 (+0x113=1, +0x115=3, +0x117=4) on the victim, ends turn; removes itself if the victim goes down. Else removes 58 from the victim and removes itself | O | 3aae_3a86 |
| 75 / 0x4B | blood drain | 13, 15 | victim = DS:65B9[pw]. If both active: "Sucks some Blood", 1d4 dmg (6819=0), ends turn; dur −= dmg·16; removes itself when dur>>4 ≤ dmg. Else removes 58 from the victim and removes itself; if both are still active, sets combat-rec[0x10]=1 | O (disasm) | 0x3899F |
| 76 / 0x4C | stirge attach | 2 | adds 75 to self (pw = victim index, dur 0xCF: about a 12-HP pool, flag 1); adds 58 to the target and runs it | O | 3723_18b5 |
| 77 / 0x4D | hug/hold | 2 | if target STR < 19: adds 74 to self (pw = victim index), 58 to target; "is held fast" | O (disasm) | 0x38B65 |
| 78 / 0x4E | revive | R | `1869(curHP)`; if blocked, re-arms (dur 1) | O | 3723_19d9 |
| 79 / 0x4F | fire on hit | 2, 3 | 2d10 to target, 6819=9 (Fire+Magic) | O | 3723_1a19 |
| 80 / 0x50 | acid on hit | 2 | 1d4 to target, 6819=0x10 (Acid) | O | 3723_1a4c |
| 81 / 0x51 | fear aura | 8 | each active enemy saves vs spell. Level/HD +0x73 of 0..3: Hold (pw 0x0C, dur 0) "is paralyzed with fear"; 4..5: Curse (type 2) "is weakened by fear"; a save negates | O (disasm) | 0x38CDA |
| 82 / 0x52 | paralysing aura | 8 | removes all type-82 effects from everyone, then each active enemy saves vs type 0 at +1 (if DS:6814[side] ≥ 6) +2 (if race 7), or Hold for 1d4 | O (disasm) | 0x38DD8 |
| 83 / 0x53 | petrifying gaze | 14 | "gazes...". If the gazer has 127 and the target has a readied item with name word 0x76 (Mirror): "reflects it!" and the gazer becomes the victim. Victim saves vs petrification (+0) or "is Stoned" (status 7) | O (disasm) | 0x38EDD |
| 84 / 0x54 | charm gaze | 14 | if the path is clear: "Gazes...", 681B=10. Target saves vs spell at −2; on failure adds 11 (pw = side<<7 \| 0x0C, flag 1, save negates) and runs it | O (disasm) | 0x390A7 |
| 85 / 0x55, 86 / 0x56 | energy drain 1 / 2 levels | 2, 3 | `2122(n)`. Prints "is drained a level" / "is drained n levels". An Animated (status 1) target "is dead forever" (status 8), max HP 0, done. Else n times, skipping once status is 8: +0x74 += 1; loss = max HP ÷ total levels; loss times: max HP, +0xB1 and HP −1 each if > 0, +0x75 +1 (a byte: wraps, IMP-067 stops it at 255). If +0x73 (signed) < 2: "is dead forever" (8), max HP 0, and for n = 2 the picked class's level is set to 0. Else the picked class loses a level, HP 0 and not dead → "is killed" (6), `FUN_51cf_0000` (derived stats). Then the class is picked again: +0x73 = its level, XP = the XP that level needs; recalc `FUN_10ba_0bb8`. Pick (`3723_2002`): over classes 0–7, a level ≥ the best so far wins if its XP need (DS:409B, 0 below level 2) is ≥ the best need or 0xFFFFFFFF, so the highest level, ties to the later class | O (disasm 0x29350–0x295D1, strings `3723:20DF–2118`) | 3723_23a4 / 23c2 |
| 87 / 0x57 | mummy rot on hit | 2, 3 | if the target lacks 50: adds 50 (dur 14400) and 57 (dur 43200, pw = (1d6<<4)+0x0F); "is Diseased" | O (disasm) | 0x3961C |
| 88 / 0x58 | (no handler) | 14 | listed in the hook but there is no table entry (see §3) | O | – |
| 89 / 0x59 | displacement | 8, 16 | at combat start (6DE3=0, 6822=0): clears pw bit 0x10. First attack roll against it in a combat: roll := −1 (miss) and sets the bit | O | 3723_2490 |
| 90 / 0x5A | CON poison save bonus | 12 | if save type 0: save + {CON 4-6:1, 7-10:2, 11-13:3, 14-17:4, 18-20:5} (uninitialised for CON < 4) | O | 3723_24d9 |
| 91 / 0x5B | MM and electricity immunity | 6 | if 681B = 15: dmg 0, "is unaffected". Else if 6819&4: dmg 0 | O (disasm) | 0x39786 |
| 92 / 0x5C | – | – | empty | O | 319b |
| 93 / 0x5D | fire half | 6 | 6819&1 → dmg/2 | O | 3723_25a2 |
| 94 / 0x5E | blunt/pierce half | 5 | if the attacker's weapon type flags (DS:5589+16·type) &0x81: dmg/2 | O/I (flag meaning) | 3723_25bc |
| 95 / 0x5F | delayed death | R | if active: "Falls dead", status 6 | O (disasm) | 0x39840 |
| 96 / 0x60 | silver/magic to hit | 5 | dmg := 0 unless the weapon has plus > 0 or name word +0x31 = 0xB1 (Silver) | O | 3723_264b |
| 97 / 0x61 | CON magic save bonus | 12 | as 90, for save types 2 and 4 | O | 3723_268a |
| 98 / 0x62 | regenerate 3/round | 19 | HP +3 (cap max HP) | O | 3723_2700 |
| 99 / 0x63 | rally | 8, 13 | if Dying (5): n = 6 − combat-rec[0x0E] (if < 6); if Unconscious (4): n = 6. If `1869(n)` succeeds: adds 95 (dur 1d4+1), removes itself | O | 3723_2730 |
| 100 / 0x64 | troll death | 13 | unless the killing damage was Fire (6819&1) or Acid (&0x10): adds 102 (dur 3d6) | O | 3723_27d9 |
| 101 / 0x65 | troll regen trigger | 5, 6 | if it has neither 98 nor 59: adds 59 (dur 3) | O | 3723_2814 |
| 102 / 0x66 | troll revive | R | `1869(maxHP)`; if blocked, re-arms (dur 1) | O | 3723_2866 |
| 103 / 0x67 | vampire escape | 13 | eff[4]=0; "Turns gaseous and escapes", status 3 (fled) via `5216_0f06` (HP kept) | O (disasm) | 0x39AEF |
| 104 / 0x68 | missile deflection 60% | 5 | `0fac(60)` | O | 3723_2901 |
| 105 / 0x69, 106 / 0x6A | magic resistance 50% / 15% | 6, 9 | `2915(base)` | O | 2976 / 2984 |
| 107 / 0x6B | elf resistance | 9 | if d100 ≤ 90: blocks 53 (Sleep) and 11 (Charm) | O | 3723_2992 |
| 108 / 0x6C | immune to sleep and charm | 9 | blocks 11 and 53 | O | 3723_29b6 |
| 109 / 0x6D | immune to Hold | 9 | blocks 52 | O | 3723_29cb |
| 110 / 0x6E | cold-effect immunity | 9 | if 6819&2: blocks the incoming effect (not the damage: not hooked at 6) | O | 3723_29d9 |
| 111 / 0x6F | immune to poison and paralysis | 9, 12 | blocks 55 and 52; save type 0 → save := 100 | O | 3723_29f0 |
| 112 / 0x70 | fire immunity | 6, 9 | if 6819&1: dmg 0 / blocks the effect | O | 3723_2a11 |
| 113 / 0x71 | fire resistance | 6 | if 6819&1: dmg −1 per die (floor = dice count) | O | 3723_2a28 |
| 114 / 0x72 | electricity half | 6 | 6819&4 → dmg/2 | O | 3723_2a6d |
| 115 / 0x73 | skeleton-type | 5 | weapon flags = 0 or &1 (slashing/piercing) → dmg/2 | O/I | 3723_2a87 |
| 116 / 0x74 | magic-weapon half | 5 | weapon plus > 0 → dmg/2 | O | 3723_2ae6 |
| 117 / 0x75 | holy-water vulnerable | 5 | attacker item type 0x55 (ITEMS: 1d1−1, range 4) → dmg := 1d6+1 | O/I (item identity) | 3723_2b20 |
| 118 / 0x76 | cold half | 6 | 6819&2 → dmg/2 | O | 3723_2b63 |
| 119 / 0x77 | +1 weapon needed | 5 | if the weapon is missing or plus 0, and (attacker race > 0 or attacker +0x73 < 4): dmg := 0 | O | 3723_2b7d |
| 120 / 0x78 | boulder deflection | 5 | item type 0x57/0x58 (1d8+8 / 1d12+8 hurled) → `0fac(50)` | O/I | 3723_2bc8 |
| 121 / 0x79 | acid spit | 14 | if d100 ≤ 25 and distance < 4: ends turn, "Spits Acid", 8d4 to the target, save vs breath halves; then removes itself and 80 | O (disasm) | 0x39E4C |
| 122 / 0x7A | fire-vulnerable | 5, 6 | item type 0x56 (ITEMS 2d6, thrown) → dmg := 3d8; if 6819&9: dmg += dice count | O | 3723_2d38 |
| 123 / 0x7B | silver-half | 5 | no weapon → 0; plus 0 and Silver → /2; plus 0 otherwise → 0 | O | 3723_2d88 |
| 124 / 0x7C | half-elf resistance | 9 | if d100 ≤ 30: blocks 11 and 53 | O | 3723_2de4 |
| 125 / 0x7D | undead immunities | 9, 12 | blocks 11, 53, 52, 55; save type 0 → 100 | O | 3723_2e08 |
| 126 / 0x7E | vampire aversion | 0 | if the target has a readied item with name word 0x76 (Mirror), or 0x98 (Holy Symbol) with +0x31 = 0xFC: 681E=1 (cannot attack it) | O | 3723_2e37 |
| 127 / 0x7F | gaze-reflectable marker | – | empty; read by 83 | O | 319b |
| 128-130, 133, 134, 136, 138, 139 | item: grant effect | item | ready: adds type item[0x3D] raw (pw 0x0C, dur 0, flag 0) and runs its handler at once with no effect record. Unready: removes the first record of that type, with no end callback (flag 0). 128 Ring of Feather Falling (27), 129 Ring of Fire Resistance (61), 133 Cloak of Displacement (89), 134 Cloak of Elvenkind (72), 136 Two-Handed Sword +1, +3 vs undead (3), 139 Ring of Invisibility (56); 56 and 72 add invisibility 25 (dur 1) at once | O | 3723_2eda |
| 131 / 0x83 | Gauntlets of Ogre Power | item | ready: `5216_115c(18, 100)`; if that raised STR, "is stronger". Always adds 38 (dur 0, flag 1) holding the encoded old STR, or the dormant 18/00 if STR was already higher. Unready: removes the 38 record that decodes to 18/00, then handler 38 restores STR. Bug: when STR is 18/00 at the time, it removes the first 38 record of any value | O (disasm) | 0x3A187 |
| 132 / 0x84 | alignment-locked item | item | ready: if item[0x3D]&0x0F ≠ alignment (char[0xA0]): unreadies it (no unready handler), deals item[0x3D]>>4 damage through `5216_1344` with 6819=8, so "takes N points of damage from Magic". Long Sword +3 0x52 (lawful evil, 5), Long Sword +2 0xF0 (lawful good, 15) | O | 3723_30a5 |
| 135 / 0x87 | giant-strength item | item | ready with STR < 19: unreadies it (+0x34=0), "Must have Giant Strength" | O (disasm) | 0x3A364 |
| 137 / 0x89 | Spiritual Hammer item | item | unready: removes effect 23 | O | 3723_317a |

## 3. Undeciphered, odd, and Haste/Slow

**Partly undeciphered**
- **7**: the exact HP recalculation (0x374B5–0x375A1) is a byte-arithmetic class-level loop; it is described above only approximately.
- **12/38**: the meaning of power bit 7 and the 110d/10e4 encoding is inferred.
- **82**: the role of the DS:6814[side] (≥ 6) save bonus is unknown.
- **6/3**: the creature classes behind +0x9F values 4/9/10/12 are unknown.
- **94/115**: reading item-type byte 9 as 0x80 = blunt, 1 = piercing, 0 = slashing is inferred from the ITEMS column. Mace, club, hammer and sling carry 0x80; dagger, spear, bows and quarrel carry 1; swords carry 0.

**Mismatch**
- Type **88** is dispatched at event 14 but has no handler. It is harmless unless a creature carries it.

**Engine quirks found**
- PfE/PfG's −2 to the attack roll is lost: it is applied at event 11, before 6822 is rolled.
- Mirror Image absorbs only targeted spells, never melee (681B = 0).
- Duplicate invisibility records accumulate from 56/72.
- 90/97 use an uninitialised local when CON < 4.

**Haste / Slow**
- Handler **39** (0x37E7B) **doubles** DS:681A: `shl` at 0x37ECD.
- Handler **42** (0x382F1) **halves** it: `shr` at 0x382F4.
- Event 18 feeds them both attack rate (681D=0, 0x3AB43/0x3B89A) and movement (681D=1, 0x3AC03 → combat-rec[6]).
- A second direct check at 0x31E9C agrees: 0x27 → movement `shl` at 0x31EB2; else 0x2A → `shr` at 0x31ED5.
- So **Haste = 0x27 and Slow = 0x2A**, matching the spell table.
- The character-sheet routine at 0x491AA has them reversed: 0x2A → `shl` at 0x491C0, 0x27 → `shr` at 0x491E1. That is a **display bug** in the original game: hasted characters show half movement and slowed ones double. It does not affect combat.
