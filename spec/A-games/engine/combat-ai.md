---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Computer-controlled combatants (O, `FUN_3334_000f`)

Part of the [specification](../../README.md), part A. How monsters, NPCs and party members on Quick fight (`FUN_3334_000f`). Conventions (evidence marks, `c[x]`, `R[x]`, distances, the combat record) are those of [combat-rules.md](combat-rules.md#conventions).

Used for monsters, NPCs and party members in quick combat (c[0x10F] ≠ 0).

```
done = keyscan()                                   // FUN_3334_0fc1, below
if c[0x10D] == 0: end turn
p = R[0x15]; if p == 0 or p > 4 or d4 == 1: p = (d8 == 8) ? 4 + d2 : d4;  R[0x15] = p
if not done: done = morale()                       // FUN_3334_10d7; a surrender ends the turn
if R[0x14] and not R[0x10]: "flees in panic"
if done: return
if use_item():  end turn; return                   // FUN_3334_03e4 (before the queued spell)
if R[0] > 0: cast queued spell (FUN_4e53_0c20(spell, 1, 1), R[0] still set); end turn; return
if turn_undead(): end turn; return                 // FUN_3334_0203: R[0x11] = 0, cleric level > 0, a target exists
if cast_spell(): return                            // FUN_3334_0545
choose_weapons()                                   // FUN_3334_13ca
done = keyscan()
while not done:
    if find_target(c, 255, any=1) and R[3] > 0: done = melee_missile_loop()   // FUN_3aae_37e4, FUN_3334_0b3c
    else: done = finish_round()                                                 // FUN_3334_0f4f
```

A fleeing creature still goes through item use, queued spell, turn undead and spell casting (nothing checks R[0x14] there; I: oversight).

## Target finder (O, `FUN_3aae_37e4(char, range, skipCheck, forceNew)`)

"Can target" is `FUN_3aae_1085` ([combat-rules.md, "Aim"](combat-rules.md#aim-o-fun_3aae_3558char-rng-mode-allowempty-done-buf)): effect events 1 on the target and 0 on the chooser (invisibility, Blink, vampire aversion); it is not a sight check.

1. forceNew = 0 and the current target (combat record +0xA) is an enemy, in play (char[0x10D]) and passes Can target: keep it, with **no range or line-of-sight check**. Otherwise clear it.
2. Up to 2 passes × 20 tries: n = `2433(char, range)`, pick `roll(1, n)` (uniformly random, not the nearest). Accept if Can target passes, or skipCheck and grid[6] set. A rejected entry is zeroed; a pass ends when all are zero.
3. Pass 2 sets grid[6] = 1 (terrain ignored), only when forceNew = 0. Clear grid[6]; return whether a target was found.

AI melee uses (char, 0xFF, 1, 0) (`FUN_3334_01c7`); spells use (caster, spell range, 0, 1).

So with skipCheck = 1 the AI always finds some enemy on the field to walk towards, in sight or not.

## Morale (O, `FUN_3334_10d7`)

```
R[0x14] = 0; remove effects 0x4A, 0x4B (grab, blood drain) via FUN_5216_1041
if R[0x10] (turned by a cleric): R[0x14] = 1, "is forced to flee"; return
if c[0x84] < 0x80: return                              // party characters never check morale
m = (c[0x84] & 0x7F)·2, 0 if > 102; event 17 (Bless +5, Curse −5, Charm = 100)
lost = 100 − 100·HP / maxHP
if m != 0 and m >= lost: return                        // passes on its own HP
m = DS:6E2F (enemy side's HP %); event 17
if m != 0 and m >= 100 − ECL 0x6DC6 and c[0x10E] != 0: return     // enemy side only: passes on the group's HP
if fastest enemy (FUN_3aae_2908) <= own movement/2: R[0x14] = 1 (flee); remove 0x4A, 0x4B
elif INT c[0x11] > 5: "Surrenders" → status Unconscious (4), HP 0, out of play (FUN_5216_0f06); end turn
else: fight on
```

- `DS:6E2F` (`FUN_3aae_2879`, at battle start and every round end) = `(20·ΣHP / ΣmaxHP)·5` over side-1 combatants (HP counted only for those in play): the enemy side's remaining HP in steps of 5 %.
- In practice (G): hostile monsters, whose own morale byte is 0xFF (m = 0 → skip), fail once the enemy side has lost more than ECL 0x6DC6 % of its total HP. Allied NPCs and monsters check their own HP. No randomness.
- Morale is re-evaluated every turn; fleeing is not sticky.
- A surrendered monster counts as defeated (experience and loot, G agrees); one that ran off the field does not.
- When an encounter sets no morale, the last value of ECL 0x6DC6 stays (G).

## Spells and items (O, `FUN_3334_02eb(c, spell, pri)`)

A spell (or item power) is accepted when:

1. AI priority (spell byte 13) ≥ `pri`.
2. Byte 14 (hostile) = 0 and spell ≠ 3: accept at once (buffs; no target check).
3. Spell 3 (Cure Light Wounds, the spell id is in the code): accept if `FUN_3aae_1bf8` finds a patient. The finder looks at the 9 cells `DS:2736`/`DS:273F` (the 8 neighbours, then its own): an occupant of the caster's side (c[0x10E]) with HP c[0x11B] < max c[0x32] is taken when its HP is below the best so far (start 0xFF, so the first on a tie) or when it is the caster itself under half its maximum; on a body cell (0x1F) with no occupant, the body (list `DS:66D6` + 7n, count `DS:6715`) lying there whose status is not 6–8 (any side; the last listed). The patient is the wounded combatant if its HP is below 8 or there is no body, else the body. If none, it **falls through** to the hostile test, so CLW is "accepted" whenever an enemy is in reach (touch: adjacent) (**Bug**, O), and then aborted when it goes off ("Spell Aborted", forgotten).
4. Enemies within range `byte2 + byte3·caster level` (`FUN_4e53_0729`; touch counts as 1): none → reject.
5. Area spell (byte 15 > 0): for each enemy in range, list the combatants within radius `area` of it (`FUN_3334_0255` → `FUN_56c1_0909`); if any of them is not an enemy (including the caster) → reject at once, whatever the other enemies. So the AI never risks friendly fire, and there is no minimum enemy count (G's "3 enemies for Fireball" is not in the code).

Item use (`FUN_3334_03e4`): needs R[2], enemies left and ECL 0x49E5 = 0. Passes = d7, priority 7, 6, …; each pass takes the first readied item (not a scroll-type slot 11–13, item[0x3E] < 0x80) whose power item[0x3D] (minus 0x17 if > 0x38) is accepted; used via `FUN_4894_1a8a`.

Spell casting (`FUN_3334_0545`): the list is every memorised slot c[0x17..0x2B] that is not 0, a spell still to be learned (id + 0x80) included (with R[1] = 0 the list is empty); passes = d7 is rolled whatever follows (0x238E7); then it needs a non-empty list, either an NPC/monster (c[0x84] > 0x7F) or "Magic On" (`DS:6E30`), and enemies in play; passes with priority 7, 6, …, each up to 3 random picks from the list; the first accepted is begun (`FUN_3aae_2414(auto 1)`) and its result returned, so a camp-only spell refused there lets the turn go on. A pick of a spell still to be learned reads its record past the end of the spell table (I: unpredictable; the port turns it down, IMP-075).

## Weapon choice (O, `FUN_3334_128d`, `FUN_3334_13ca`)

Score (byte arithmetic): `dice × sides` (small/medium) + 8·plus (if > 0) + 2·bonus (if > 0); holy water (type 0x55) against an undead target scores 8; flag 8 (AI ranged) adds `2·(rate×2 − 1)`; one-handed +3. Score 0 for too many hands, an alignment-locked weapon (item[0x3E] = 0x84) of the wrong alignment, the Javelin of Lightning (item[0x3D] = 0x53) or any cursed item. Large-target dice are ignored.

1. Natural attack scores `A3·A5 (+2·A7 if > 0)`; ranged best starts at 1; only items usable by the class (`ITEMS[t][13] & c[0xB0]`).
2. Ranged weapon chosen iff its score > melee score / 2, it has ammunition (arrows, quarrels, or itself if thrown) and (it is a throwable melee weapon or no enemy is adjacent). Otherwise the best melee weapon (or the natural attack).
3. Swap if the current weapon differs and is not cursed; then fix hands (drop a non-cursed shield if hands are short) and ready the best shield (plus + 1) if a hand is free.
   - Candidates (O): every item usable by the class; a weapon with flag 8 or 0x10 competes for ranged (start score 1), one without flag 8 for melee (start score the natural attack), so a throwable melee weapon is in both. The hands test in the score is c[0x100] (minus the readied weapon's and shield's hands) + hands > 3.
   - Ammunition (O): the weapon itself with flag 0x10; with flag 8, arrows (char+0xF8) for flag 1 and quarrels (char+0xFC) for flag 0x80; flags exactly 0x0A need none. "Throwable melee" means range > 1 and flags & 0x14 = 0x14.
   - Hands (O): after readying, if c[0x100] > 2 a cursed shield unreadies the new weapon, otherwise the shield goes; if c[0x100] < 2 and the shield is not already the best (or cursed), the best shield is readied.

## Melee / missile loop (O, `FUN_3334_0b3c`)

```
effect event 14 (gaze, breath and spit specials)
repeat (at most 20 tries, then finish_round):
    while fleeing (R[0x14]) and movement left and 0 < init < 20: step()
    reach = weapon ? ITEMS[t][12] − 1 : 1   (0 or 255 → 1)
    keep the current target if it is in play, on side 1 (**Bug**, I: should test "enemy of c";
         monsters therefore drop their party target each pass), passes FUN_3aae_1085, in sight and within reach
    else: n = enemies within reach; none → step towards the 37e4 target (or finish_round if none)
          else pick one at random; if a non-throwable missile weapon is readied and an enemy is adjacent:
          re-choose weapons and restart
    attack: sweep if possible (ends turn), else engage + attack (FUN_3aae_1884) with the missile item
            (arrows, quarrels, or the thrown weapon; nil for a throwable used at distance 1)
```

Missile users never shoot with an enemy adjacent; they switch to melee. A cursed missile weapon with an enemy adjacent can loop forever (**Bug**, I).

## Movement (O, `FUN_3334_07f2`, probe `FUN_3334_0675`)

1. No movement left or initiative ≤ 0 → finish round. A single-class magic-user (class 5) that is not fleeing never advances (finish round).
2. Base direction: towards the target (`FUN_3aae_263d`: the first direction 0–7 whose 90° cone from the neighbouring cell contains the target). Fleeing: R[0x15] = d2 and the direction is the party's battle facing (`DS:02F2[party facing / 2]`), reversed for party-side fleers: everyone runs towards their own side's back.
3. Try the base direction plus the offsets of preference p in order, first success wins:

| p | tries (0 ahead, ±1 = ±45°, ±2 = ±90°, 4 = back) |
|---|---|
| 1 | 0, −1, −2, +1, +2 |
| 2 | 0, +1, +2, −1, −2 |
| 3 | −1, +1, 0, −2, +2 |
| 4 | +1, −1, 0, +2, −2 |
| 5 | 0, −1, −2, −3, 4 |
| 6 | 0, +1, +2, +3, 4 |

   Probe: fail off the arena (a fleeing creature then makes the escape roll, [[#Fleeing (O, `FUN_3aae_0c6a`)]]), on an occupied cell, or when the cell cost byte ≥ R[6]; need = 2 (straight) or 3 (diagonal) half-squares; a Stinking Cloud cell (0x1E) is refused unless the creature has effect 0x20, 0x1E, 0x6F or 0x7D (vulnerable creatures avoid clouds, G).
4. Backtracking: if no direction works, or the chosen one reverses the previous step, a stall counter + 1 and p = p mod 6 + 1; at 2 stalls the target is dropped, at 3 the movement ends.
5. The step itself goes through attacks of opportunity (`FUN_3aae_08b2`) and `FUN_3aae_0712` (guards), then the Stinking Cloud check.

`finish_round` (`FUN_3334_0f4f`): helpless, ranged weapon readied, or initiative 0 → end the turn; otherwise guard. So melee AI that cannot reach anyone guards; missile users never guard.

## Keyboard during AI turns (O, `FUN_3334_0fc1`)

'2' or Alt-M toggles "Magic On/Off"; Space returns control (c[0x10F] = 0 for every non-NPC, non-Animated member; the current one gets initiative 20 and its turn continues manually); '−' or Alt-X runs the STING cheat.
