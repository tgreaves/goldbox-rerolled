# CotAB camp: differences from Pool of Radiance

> **Status: complete as a set of differences.** Normative. Part A of the
> [specification](../../README.md): Curse of the Azure Bonds. Evidence marks as in the README.

Differences from [engine/camp-and-time.md](../engine/camp-and-time.md); anything not listed works as
there. Addresses are CotAB image offsets ([README.md, "Working image"](README.md#working-image));
DS = image 0xABE0. The camp's menus and their words are in
[D-appendices/strings.md §4.1](../../D-appendices/strings.md#41-menus).

## 1. Fix (O, 0x320D8)

The camp screen 0x321CB shows **"Save View Magic Rest Alter Fix Exit"** (DS:042A, image 0x0B00A) and
dispatches on the key as Pool of Radiance's camp (S, V, M, R, A as there), with **F** calling
0x320D8 with the camp's *interrupted* flag (the other commands but Fix also set DS:72AE = 1, **?**).
Fix casts nothing, uses up nothing and prints nothing of its own. It works out how much healing the
clerics' cures could give, rests as long as learning them again would take, and shares the healing
out. Step by step:

1. *interrupted* := 0, the pool := 0 (a word).
2. **Wounds** (0x31E2F): Σ over every party member (in the list at DS:6524, whatever its status) of
   max HP (+0x78) − HP (+0x1A4), a 16-bit sum. If it is 0, return.
3. **The memorised cures** (0x31CC2): for each member whose status (+0x195) is 0 (Okay, 0x31CA2), for
   each of the 84 memorised slots +0x1E … +0x71 in order: Cure Light Wounds (3) adds 1d8 to the pool,
   Cure Serious Wounds (58) 2d8 + 1, Cure Critical Wounds (71) 3d8 + 3 (dice 0x4BE31; a slot still to be
   learnt, id + 0x80, matches none). The spells stay memorised.
4. Wounds again (0x31E2F); if 0, redraw the roster and return (it cannot be 0 here: nothing was healed).
5. Save the rest-time vector DS:7580 (7 words, PoR DS:6DC2; +2 minutes, +4 ten-minutes, +6 hours,
   +8 days) in a local copy.
6. **The rest** (0x31E8D). Per member, in list order, with three minute counts L1, L4, L5 and an
   estimate E that are **not** reset per member:
   - if the member is Okay: L1 = 15 × its first-level cleric slots (+0x12D), L4 = 60 × its
     fourth-level slots (+0x130), L5 = 75 × its fifth-level slots (+0x131), and the slot totals S1,
     S4, S5 grow by those slot counts. A member who is not Okay keeps the previous member's L1, L4, L5
     (and adds nothing to S1, S4, S5);
   - t = 0; if L1 > 0: t = 240 and E += 0x1B (27); if L4 + L5 > 0: t = 360 and E += 0x4E (78) when L5
     > 0, else 0x22 (34); then t += L1 + L4 + L5;
   - the rest time T = the largest t.

   E starts as an uninitialised local (its first `add` reads the stack). The word there is the last
   argument pushed by the `Move` call just before (0x32118: the count, 14), so E starts at **14**
   (**I**: an interrupt between that call and 0x31E8D could change it). Then, if the wounds (0x31E2F
   once more) are below E: k = E div wounds, **kept as a byte**, and T := T div k (0x31FD3; **Bug**:
   when E div wounds is a multiple of 256, k = 0 and the division faults). The vector is set from T:
   hours = T div 60, ten-minutes = (T mod 60) div 10, minutes = T mod 10 (0x31FE7).
7. **Rest** (0x41B8F with 0, the silent rest): no window, no prompt, no "Stop Resting?" key check and
   no time display; otherwise the rest loop of
   [camp-and-time.md, "Rest loop"](../engine/camp-and-time.md#rest-loop-o-fun_4b46_0c9a): 5-minute
   steps, the clock and effects, natural healing ("The Whole Party Is Healed" at 24 hours, 0x41741),
   the members' pending spells, and the encounter check, which ends it as interrupted ("Your repose
   is suddenly interrupted!", 0x41B6A). A rest time of 0 rests not at all. The result is
   *interrupted*.
8. If not interrupted: **the slots' cures** (0x31D7D): S1 rolls of 1d8, then S4 of 2d8 + 1, then S5
   of 3d8 + 3, each added to the pool; then **shared out** (0x32020): for each member in list order,
   need = max HP − HP (a word); if need > pool, need = pool; if need ≥ 1, the heal routine 0x4CE85
   (the member, need **as a byte** (0x32096), not forced: Okay, Animated, Unconscious or Dying only;
   [camp-and-time.md, "Healing"](../engine/camp-and-time.md#healing-o-fun_5216_175dchar-amount--1-force--0))
   and, when it heals, pool −= need. Then redraw the roster (0x4D7E8) and 0x4FBB6 (**?**).
9. Restore the rest-time vector from the copy.

An interrupted Fix ends the camp as an interrupted Rest does (the camp loop leaves when the flag is
set; `camp_confirmed` follows, [ecl.md](ecl.md)).

What it comes to: each Okay cleric's first-level slots count as Cure Light Wounds, its fourth and
fifth as Cure Serious and Critical, whatever it has memorised; the cures it has memorised count as
well, once; the party rests the 4 or 6 hours and 15 minutes per slot level a full re-memorisation
would take (less when the wounds are small against the estimate), and is healed by the dice.
Pool of Radiance has no Fix ([camp-and-time.md, "Camp menu"](../engine/camp-and-time.md#camp-menu-o-ds0508));
GoldBox Rerolled offers this procedure there with Pool of Radiance's one cure (IMP-048,
[C-port/departures.md](../../C-port/departures.md)); the profile's `rules.fix` holds the cures, their
dice, levels, minutes, base and weights ([B-model/procedures.md §12.4](../../B-model/procedures.md#124-the-camps-fix)).

## 2. Rest

- The duration prompt 0x415F1: **"Rest Days Hours Mins Add Subtract Exit"** (image 0x415AA): **D**
  selects days (PoR's "daYs" took Y), **A** and Up add, **S** and Down subtract; otherwise as PoR's
  ([camp-and-time.md, "Duration prompt"](../engine/camp-and-time.md#duration-prompt-o-fun_4b46_0721-display-fun_4b46_05f0)).
- The rest loop 0x41B8F takes a flag: 1 for the camp's Rest (window, prompt, the time shown, the
  "Stop Resting? " key check), 0 for Fix (none of those).
- An encounter interrupts with "Your repose is suddenly interrupted!" (0x41B6A; PoR "The Party is
  rudely interrupted!").
