---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Combat rules

Part of [[spec/README]]. Everything needed to run a battle: start, rounds, player and computer actions, attack resolution, status, end of battle and rewards. Spell effects are in [[spec/spells]] and [[spec/effects]]; the battlefield terrain generator is at the end of this file.

## Conventions

Each rule carries a source marker:

| Marker | Meaning |
|---|---|
| O | read in the engine code (address given) |
| G | from Stephen Lee's GameFAQs guide v2.00 ([[spec/README]], External references), not checked in code |
| I | inferred from code and data, not proven |
| ? | unknown |

**Bug** marks behaviour of the original that looks unintended. An authentic port reproduces it; a port with fixes should log the change.

- Addresses are Ghidra `seg_off` names in the merged image. The guide's IDA segments map to ours by overlay: 1DFA → 2e08, 21FE → 320c, 2326 → 3334, 24B9 → 34c7, 2715 → 3723, 2AA0 → 3aae, 3E45 → 4e53, 4208 → 5216, 46B3 → 56c1, 4771 → 577f, executable 00BA → 10ba. Offsets inside a segment are identical.
- `c[x]` is a byte of the 0x11D-byte character/monster record ([[spec/records]]); `R[x]` is a byte of its 22-byte combat record (pointer at c[0x108]).
- Distances are in squares. The engine measures them in half-squares: a straight step costs 2, a diagonal step 3 (see Line of sight). "Distance" in this file is that cost divided by 2, rounded down.
- `B[x]` is the word array behind ECL variables 0x6B00+ (byte offset x = 2·(var − 0x6B00)); `A[x]` the one behind 0x4900+.

### Combat record (22 bytes, O unless marked)

| Byte | Meaning |
|---|---|
| 0 | spell queued for later this round (0 = none) |
| 1 | may cast this round (cleared by any damage) |
| 2 | may use items this round (AI only) |
| 3 | initiative (signed; 0 = cannot act or already acted) |
| 4 | hand of the attack in progress (1 or 2) |
| 5 | sweeps left this round (copy of c[0x6B]) |
| 6 | movement left, in half-squares |
| 7 | guarding |
| 8 | has attacked this round |
| 9 | facing 0–7 (0 = north, clockwise) |
| 0xA–0xD | far pointer to the current target |
| 0xE | negative HP while Dying |
| 0xF | number of attackers that engaged this combatant since its last turn or move |
| 0x10 | turned by a cleric (flees) |
| 0x11 | has used turn undead this battle |
| 0x12 | accumulated angle of those attackers relative to the facing (mod 8) |
| 0x13 | 1 = monster (list entry after the party) |
| 0x14 | fleeing (failed morale) |
| 0x15 | AI movement preference |

## Overview

1. A script runs ECL `COMBAT` with monsters loaded by `LOAD_MONSTER` ([[spec/ecl]]). Scripts set the per-battle variables first: surprise 0x6DCB, morale 0x6DC6, side to-hit bonuses 0x6E70/0x6E71, party movement bonus 0x6E72, no-items flag 0x6DE3, duel flag 0x6DE6.
2. Battlefield built and combatants placed ([[#Starting a battle]], [[#Battlefield (O, `FUN_34c7_1e31`)]]).
3. Rounds until one side has nobody able to act ([[#Battle flow (O)]]). In each round every combatant gets initiative; the highest acts first and spends its whole move and all its attacks before the next one acts.
4. Aftermath: survivors, experience, treasure, outcome in ECL 0x6DC7 ([[#Aftermath (`FUN_2e08_1527`)]]).

## Dice (O, `FUN_5216_0de3`)

`roll(count, sides) = Σ count × (Random(sides) + 1)` using the Turbo Pascal RNG (`FUN_1af8_11c0`). A browser port needs its own RNG; exact sequence reproduction is not required. `FUN_5216_0e2e` does the same and also stores the dice count in `DS:681C` (used by per-die damage reduction effects). The sum is a byte; there is no overflow check (G).

## Starting a battle

### ECL `COMBAT` entry (O, `FUN_29c3_179b`)

1. If no monsters are loaded and no duel is set up, `COMBAT` is a shop, temple or treasure screen instead ([[spec/ecl]]).
2. `d` = how far monsters can stand in front of the party (`FUN_2fea_0482(x, y, facing)`, 0–2, blocked by walls); if `d` < ECL 0x6DC1 (encounter distance), 0x6DC1 = `d`.
3. Battle (`FUN_320c_007a`), then aftermath (`FUN_2e08_1527`).
4. Clear the duel flag `DS:84D4`, set the game mode back (4 in map areas, 3 elsewhere), clear the "Look requested" bit of ECL 0x6DCA, redraw the normal view.

### Surprise (O)

- ECL 0x6DCB: bit 0 = party surprised, bit 1 = monsters surprised. The `SURPRISE` opcode can produce 0, 1 or 2, never 3 ([[spec/ecl]]); scripts may write 3 directly.
- Applied only to the first round's initiative (−6 for every combatant whose side bit is set, [[#Round start (`FUN_3aae_0000`)]]). `FUN_320c_007a` clears 0x6DCB right after the first round's initiative rolls, so it never applies again.
- With both bits set both sides take −6; this differs from "no surprise" only through the clamping to 0 (G says both-surprised behaves as neither; the code penalises both).
- Surprise also changes the pre-battle encounter menu, which is script-side ([[spec/ecl]] `ENCOUNTER_MENU`).

### Battle start order (O, `FUN_34c7_1e31`)

1. "A battle begins..."; ECL 0x6E33 (party attacked allies) = 0; body count `DS:6715` = 0; ECL 0x6DC6 clamped to ≤ 100.
2. Grid and terrain (`FUN_34c7_1244`, then map-area or wilderness generator: [[#Battlefield (O, `FUN_34c7_1e31`)]]).
3. Combat records (`FUN_34c7_12e1`), below.
4. Placement (`FUN_34c7_19f5`), below.
5. View origin: grid header [2], [3] = position of the first list entry (party member 1) − 3, so the 7 × 7 view is centred on it.
6. Effect event 8 for every list entry; enemy HP percentage (`FUN_3aae_2879`); game mode 5. The battlefield item list `DS:6810` additions from thrown weapons start empty (`DS:5D9A` = nil).

### Combat records (O, `FUN_34c7_12e1`)

For each list entry in order (party first, then monsters in load order), after a stat recompute:

- allocate a zeroed 22-byte record; R[0x13] = 1 if its position in the list is beyond the party size (ECL 0x6E3E)
- facing R[9] = `DS:02F2[party facing / 2]` = {N 7, E 2, S 3, W 6}: the party's map facing drawn on the slanted combat grid. Enemy side (c[0x10E] = 1): R[9] + 4 mod 8. Everyone on a side faces the same way.
- allied monsters (side 0, R[0x13] = 1) with morale c[0x84] & 0x7F = 0 or > 102: c[0x84] = ECL 0x6DC6 + 0x80

### Placement (O, `FUN_34c7_19f5`, `FUN_34c7_1577`, `FUN_34c7_1434`)

Each side is placed in a block of map squares ("square" = one map square, drawn as a slanted 7 × 5 parallelogram of cells, [[#Map areas: squares → cells (`FUN_34c7_0810`)]]). Placement uses square-local cells (col 0–10, row 0–5) converted to arena cells by

```
X = 22 + col + 6·bx + 5·by        Y = 10 + row + 5·by        // (bx, by) = square offset from the party's square
```

1. Count combatants in play per side. Front-line length `lim[s] = (in_play[s] + 1) / 2`.
2. Party block (0, 0). Enemy block = D squares in the facing direction, D = ECL 0x6DC1 (encounter distance 0–2, already clamped to the open squares ahead): `(dx8[f]·D, dy8[f]·D)` with `dx8 = 0,1,1,1,0,−1,−1,−1`, `dy8 = −1,−1,0,1,1,1,0,−1` (`DS:2736/273F`). Monsters therefore always start in front of the party, never at the sides or behind (G).
3. Orientation per side: F0 = facing / 2 for the party, F1 = the opposite for the enemy.
4. Allowed cells per side and ring: `allow[s][ring][row][col] = T[t][row].min ≤ col ≤ T[t][row].max`, with t = F[s] for rings 0, 2, 3 and t = 4 for ring 1. Table `DS:0306` (5 entries × 6 rows of [min, max]; [1, 0] = empty row):

| t | row 0 | row 1 | row 2 | row 3 | row 4 | row 5 |
|---|---|---|---|---|---|---|
| 0 (N) | – | – | – | 2–9 | 3–10 | 4–10 |
| 1 (E) | 0–2 | 0–3 | 1–4 | 2–5 | 3–6 | 4–7 |
| 2 (S) | 0–6 | 0–7 | 1–8 | – | – | – |
| 3 (W) | 3–6 | 4–7 | 5–8 | 6–9 | 7–10 | 8–10 |
| 4 (all) | 0–6 | 0–7 | 1–8 | 2–9 | 3–10 | 4–10 |

   A side uses the half of its square away from the other side (the party facing north takes the south half, the enemy the north half of its square). Rings 2 and 3 also use the half table (I: possibly an oversight).
5. For each list entry in order: store it as combatant index i (`DS:65B9[i]`), icon size = c[0x6C] & 7, find the first acceptable cell (`FUN_34c7_1577`, below; each call restarts the scan, cells already used fail the test).
   - Found, and it can act: occupy the cell.
   - Found, but it cannot act (party member down before the battle): icon size 0 (no occupancy, no icon) and, outside duels, a body is laid down: record `DS:66D6 + 7n` (+0 far pointer, +4 x, +5 y, +6 original cell), cell = 0x1F (fallen body, walkable).
   - Not found, monster: dropped from the battle and from the list (`FUN_417f_3291`); the next entry reuses index i. If there is no room for a requested opponent it simply does not appear (G).
   - Not found, party member: icon size 0, keeps its index, not removed.
6. Rebuild the occupancy map `DS:60DB` (50 × 25 combatant indices) and screen positions (`FUN_577f_03a0`).

**Scan for a free cell (`FUN_34c7_1577`).** Fills lines across the square, front line first:

- Line direction vectors on the slanted grid: `V0 = (−1,−1)` (map north), `V1 = (+1,0)`, `V2 = (+1,+1)` (map south), `V3 = (−1,0)`, with `d4 = DS:02E2[4·F + ring] / 2` selecting the orientation (`DS:02E2` = 00 00 02 06 | 02 02 00 04 | 04 04 02 06 | 06 06 04 00, indexed by F then ring).
- Line origin O (square-local): ring 0 columns {5, 4, 5, 6} and rows {3, 2, 2, 3} for d4 = 0–3; rings 1+: columns {3, 8, 7, 2}, rows {0, 2, 5, 3} (`DS:02F6`, `DS:02FE`).
- Line `step` starts at O + step·V[(d4+2) mod 4]; candidates: the origin, then alternately origin + k·V[(d4+1) mod 4] and origin + k·V[(d4+3) mod 4] for k = 1, 2, …
- A line ends when a candidate is outside 0–10 in exactly one axis, or when the count reaches `lim[s]` (first line) or exceeds 11 (later lines); the ending candidate is still tried if in range. So the front line holds at most `lim` combatants.
- Party facing east or west (F odd), ring 0: the second line (step 1) is skipped (left empty) in the wilderness, or in a map area if any of the three neighbour squares in `DS:02D2` is open.
- A candidate outside in both axes moves to the next ring (up to 3): the square behind (ring 1), then the two side squares (rings 2, 3), directions `DS:02D2[4·F + ring]` = F0: S, W, E; F1: W, S, N; F2: N, W, E; F3: E, N, S. In a map area a ring is skipped when the wall between squares is solid (`FUN_34c7_01ad` = 1; I: the check uses the previous ring's square, possibly a bug). No ring left: fail.

**Cell test (`FUN_34c7_1434`).** The allow bit is set; no other combatant on the whole footprint (`FUN_577f_0cb9`); the worst ground cell under the footprint is not 0 (off the arena) and not impassable (`DS:2744[4·cell]` ≠ 0xFF). On success the position (`DS:5F27/5F28 + 4i`) is written and the allow bit cleared.

**Footprints** (`FUN_577f_0000`, table `DS:2844`): the position is the top-left cell; size 1 = 1 × 1, 2 = 1 wide × 2 tall, 3 = 2 wide × 1 tall, 4 = 2 × 2. A creature of size > 1 counts as Large for weapon damage.

Example, empty arena, 6 party members (O, simulated): facing N, front line (27,13) (28,13) (26,13), second line (28,14) (29,14) (27,14); facing S, front (27,12) (26,12) (28,12), second (26,11) (25,11) (27,11). Monsters at D = 1, facing N, 8 of them: (22,7) (21,7) (23,7) (20,7), then (21,6) (20,6) (22,6) (19,6). With D = 0 they share the party's square.

The party's order in the party list is its marching order: the first members take the front line (G: put the best-armoured fighters in the top half, the protected caster third from last).

### Combat icons (O)

Party members use icon slots 0–7 (c[0xBF], assigned on joining, [[spec/menus]]); monsters get slots from 8 up as `LOAD_MONSTER` loads their `CPIC` icons. Icons are drawn with the combatant's facing R[9] (`FUN_58af_04fc`). The terrain icon sets are `DUNGCOM`/`WILDCOM`/`RANDCOM` ([[#Cell table (O, `DS:2744`, 4 bytes per cell value)]]).

## Battle flow (O)

Entry: ECL `COMBAT` → `FUN_29c3_179b` → battle `FUN_320c_007a` → aftermath `FUN_2e08_1527`.

```
game mode DS:49F3 = 5
battle start (FUN_34c7_1e31): "A battle begins...", ECL 0x6E33 = 0, build field, place, effect event 8
done = (party in-play count DS:6814 == 0 or enemy count DS:6815 == 0)
while not done:
    recount sides (FUN_10ba_23db)
    for each combatant c (list order): round_start(c)        // FUN_3aae_0000
    ECL 0x6DCB (surprise) = 0
    while (c = pick_next()): take_turn(c)                    // FUN_320c_0131, FUN_320c_01f6
    round_end(&done)                                         // FUN_320c_0880
cleanup (FUN_320c_0000): free Stinking Cloud zones, restore palette
```

### Round start (`FUN_3aae_0000`)

For every combatant, whether or not it can act:

1. R[0] = 0 (no queued spell), R[1] = 1 (may cast), R[2] = 1 (may use items), R[8] = 0, R[4] = 2.
2. Primary attacks c[0x113] ([[#Attacks per round (O, `FUN_3aae_0d23`)]]); secondary attacks c[0x114] = `half(event18(c[0xA2]))`.
3. R[5] = c[0x6B] (sweeps).
4. Initiative R[3]: if the combatant cannot act (c[0x10D] = 0) → 0. Else `d6 + DEX reaction adj` (`FUN_10ba_1168`), at least 1; then −6 if its side is surprised (bit `side+1` of ECL 0x6DCB); a value below 0 or above 20 becomes 0. Haste and Slow do not change initiative (G, consistent with code).
5. R[6] = movement in half-squares ([[#Movement points (O, `FUN_3aae_0123`)]]).

### Turn order (`FUN_320c_0131`)

Each pick walks the whole list and rolls a fresh d100 for every combatant. The new best is taken when `init > best`, or when `init == best` and the d100 is at least the best d100 so far. So ties go to the higher d100, and an exact d100 tie to the later list entry (monsters come after the party). No combatant with initiative > 0 → the round is over.

A combatant is picked again whenever its initiative is still the highest > 0, which is how Delay (initiative 1) and spells with casting time (initiative lowered) work.

### Turn (`FUN_320c_01f6`)

1. R[0xF] = 0, R[0x12] = 0 (attack engagement counters), R[7] = 0 (guard ends).
2. Effect event 7 (turn start). Helplessness effects (Hold, Sleep, Snake Charm, effect 31) end the turn here by clearing initiative.
3. If initiative ≤ 0: return. If initiative = 20 it becomes 19 (Alt-Q uses 20 as a marker, below).
4. Current character `DS:5D92` = c; centre the view on it; recompute stats (`FUN_10ba_0bb8`); print its line.
5. Effect event 15.
6. If initiative is still > 0: computer AI (`FUN_3334_000f`) if c[0x10F] ≠ 0, else the player menu (`FUN_320c_031a`).

The turn is over when the action routine clears initiative (`FUN_10ba_2637`: initiative, queued spell, guard flag and movement all 0), or when it leaves initiative > 0 to be picked again later in the round (Delay, spell casting time).

### Round end (`FUN_320c_0880`)

1. Advance game time by one unit (`FUN_4b46_03D5(1,1)`); effect durations count down by 1, so effect durations in combat are in rounds (expiry callbacks run here, [[spec/effects]]).
2. Round counter `DS:6DE3` + 1 (a byte: it wraps after 255 rounds, G; anything keyed to round 0 then happens again).
3. Recompute the enemy side's remaining HP percentage (`FUN_3aae_2879`, used by morale).
4. For every combatant: effect event 19; Stinking Cloud check (`FUN_5216_0ae7`); if Dying: R[0xE] + 1, and at R[0xE] ≥ 10 status Dead.
5. If any party member is Dying: message "Your Teammate is Dying".
6. Recount sides; redraw. Done if either side has nobody in play.
7. If the party has someone in play and the enemy side has nobody: prompt "Continue Battle:"; Y keeps the battle going with no enemies (useful for bandaging, curing and buffing, G), anything else ends it. (`DS:49F4` would skip the prompt but is always 0.)

### Aftermath (`FUN_2e08_1527`)

All arithmetic is integer (longint). ECL variable 0x6DE3 (word B[0x5C6], "next battle gives no items") is unrelated to the round counter `DS:6DE3`.

Order (O):

1. ECL 0x6DC7 = 0, `DS:443A` = 0 ("enemies were beaten"), game mode 6.
2. Results (`FUN_2e08_04c9`), which also awards experience.
3. Cleanup (`FUN_2e08_11ac`).
4. If the party survived (or it was a duel): NPC shares (`FUN_2e08_12e8`), summary (`FUN_2e08_0916`), treasure menu (`FUN_2e08_0ecd`), then every item left in the treasure list is freed (lost). The money table `DS:67F4` is not cleared here (**?** whether coins left behind reappear in the next treasure).
5. Party destroyed: ECL 0x6DC7 = 0x80, "The END!", "The monsters rejoice for the party has been destroyed", "Press any key to continue".
6. Always: `DS:4A00` = 1 (**?**), and ECL 0x6E70, 0x6E71, 0x6E72, 0x6DE3, 0x6DE6 = 0. Scripts set them again before each `COMBAT`.

#### Results (O, `FUN_2e08_04c9`)

Party entries are the list entries before the first with R[0x13] = 1.

```
noXP = 0 (DS:84D5); defeated = 1 (DS:49FF); fled = 0 (DS:443B); won = 0 (DS:84DA)
for each party entry: if status == Running: fled = 1
if duel (DS:84D4): defeated = 0 → duel branch
for each party entry:
    if (status in {Okay, Animated, Running} or ECL 0x6DE6 == 1) and side 0 and not NPC (c[0x84] < 0x80): defeated = 0
    if status in {Okay, Animated}: won = 1; fled = 0
    if c[0x10D] == 0 or status == Animated: noXP += 1
if won: share = experience(); award(share)
```

| Outcome | Condition | What happens to party entries | ECL 0x6DC7 |
|---|---|---|---|
| won | someone Okay or Animated | Running → Okay (back in play); Dying → Unconscious; Unconscious with HP > 0 → Okay | 0 |
| fled | not defeated, nobody Okay/Animated, someone Running | Running → Okay; every other party entry (Unconscious, Dying, Dead, Stoned, Gone) is removed from the party with all its items (`FUN_417f_3291`, party size − 1) | 0x81 |
| destroyed | no non-NPC party-side member Okay, Animated or Running | every party entry removed; party size 0 | 0x80 |
| duel | `DS:84D4` set | see below | 0 (also when lost) |

NPCs alone do not keep the party alive. The exception is ECL 0x6DE6 = 1, which scripts set for fights that must not end the game: then nobody standing, running or destroyed leaves the party "not defeated", the win branch's status changes apply (Dying → Unconscious, Unconscious with HP → Okay) and no experience is given. Example: the inn brawl (`ECL3` #0, 0xA696) loads four groups of 11, 11, 11 and 13 brawlers (types from tables at 0xB622/0xB628 chosen by party strength), sets no loot (0x6DE3 = 1), 0x6DE6 = 1 and morale 50, then walks list entries 41–53 with `LOAD_CHARACTER` setting 0x6C0C = 0x80 and 0x6BB8 = 178: most of the last group fight on the party's side under computer control, as NPCs. A battle where every monster ran away counts as won with no loot ("The party has found Treasure!" if scripts added treasure).

After any battle the view shows `PIC<block>` record 1, the treasure chest, while the results and treasure menus run (game mode 6, `FUN_10ba_27d9`, O). In a duel the copy named ROLF is drawn with `CPIC<block>` record 11 / 139 (`FUN_2fea_1a6f`, icon slot `DS:6F83`, O).

Duel branch: every in-play, Okay, non-enemy entry gets the duel experience; then entries that are Okay or Animated are put back in play (the bystanders who sat out) and Dying → Unconscious. Running is not reset, Unconscious with HP > 0 is not revived, and a lost duel never ends the game.

#### Experience (O, `FUN_2e08_0000`)

1. Duel with ECL 0x6DE6 ≠ 0: share = current character's hit dice c[0x73] × 100 (16-bit). No loot, no division. Done.
2. Otherwise, for each list entry with c[0x10E] = 1 (enemy side) and status ≠ Running, whatever its status (dead, unconscious and still-standing enemies all count; charmed monsters, now on side 0, do not, G agrees):
   - `DS:443A` = 1
   - its money is added to the treasure money table `DS:67F4` (u32 per coin type)
   - total += word c[0xB8] + c[0xB1] × c[0xBA] (base award + per-HP award × max HP before modifiers). The product is a signed 16-bit multiply, so a product ≥ 32768 counts as negative (**Bug**, cannot happen with shipped data, I)
   - items, unless ECL 0x6DE3 = 1: an item with value item[0x3A] > 0 is always taken; a value-0 item is dropped if 8 items have already been taken in this battle, else kept on d10 ≤ 3 (30 %, matching G's "lost 70 % of the time"). Kept items are copied, unreadied, and put at the head of the treasure list `DS:6810`
3. Money: total += cp / 200 + sp / 20 + ep / 2 + gp + 5·pp + 250·gems + 2200·jewelry (integer division per coin type). This uses the whole money table, so money a script put there before the battle (ECL `TREASURE`) also gives experience.
4. Items: for each item in the treasure list from the head up to (not including) `DS:5D9A`, total += 400 × plus if item[0x32] > 0. Nothing else gives item experience in combat. `DS:5D9A` marks the newest of the party's own thrown or fired items recovered into the list, so those give no experience. Items a script put in the list before the battle are excluded only if something was thrown (**Bug**, I).
5. share = total / (party size ECL 0x6E3E − noXP). If nobody is eligible the divisor is 0 and the original crashes with a runtime error (**Bug**, I: needs a won battle with only Animated members in play).

#### Award (O, `FUN_2e08_0355`)

Every list entry in play (c[0x10D] ≠ 0) and not Animated receives, so in practice the Okay members only (Running, Unconscious and Dying are out of play at this point). Monsters still in the list receive it harmlessly.

| Class c[0x2F] | Experience added to c[0xAC] |
|---|---|
| 0 Cleric | share + share/10 if WIS > 15 |
| 2 Fighter | share + share/10 if STR > 15 |
| 5 Magic-User | share + share/10 if INT > 15 |
| 6 Thief | share + share/10 if DEX > 15 |
| 8, 10–14, 16 (two classes) | share / 2 |
| 9, 15 (three classes) | share / 3 |
| 1, 3, 4, 7 | share |

No level-cap check here (training enforces caps, [[spec/progression]]). The summary (`FUN_2e08_0916`) shows the share before the bonus or division: "The party has won." / "The party has fled." (shown as 0) / "The party has found Treasure!", or "You have won/lost the duel.", then "Each character receives N experience points." ("The duelist receives …").

#### Cleanup (O, `FUN_2e08_11ac`)

ECL 0x6DC8 = 0. Each entry that is a monster (R[0x13] = 1) or on side 1: if it is not in play, ECL 0x6DC8 + 1 (so 0x6DC8 counts enemies defeated or fled, I); then it is removed from the list with its items. Other entries just lose their combat record. A party member still charmed onto side 1 at this point is removed as an enemy (**?** whether the charm is undone first).

#### NPC shares (O, `FUN_2e08_12e8`)

- `npc` = Σ (c[0x85] & 7) over Okay NPCs (c[0x84] ≥ 0x80); `total` = npc + 1 for every other party entry (including dead ones).
- If npc > 0, for each coin type with money: `per = (pool / total)` truncated to 8 bits (**Bug**: 3000 gp over 6 shares gives 244, not 500); pool −= per × npc. The NPCs' cut simply disappears (G).
- Each Okay NPC with c[0x85] ≠ 0 prints "NAME takes and hides his share.", even when nothing was taken (**Bug**). NPCs never take items.

#### Treasure menu (O, `FUN_2e08_0ecd`)

Menu, rebuilt each pass: with money "View Take Pool Share", with only items "View Take Pool", with neither "View Pool Exit"; " Detect" is added when there are items and the current character has Detect Magic (spell 5 or 11) memorised.

| Key | Action |
|---|---|
| V | view the current character |
| T | Take: "Money Items Exit" (straight to the one that exists). Money: choose a coin type and amount for the current character. Items: pick from the list; refused with "OverLoaded" if the character already has 16 items or the weight would exceed allowance + 1500 |
| P | pool: every member with c[0x84] ∈ {0, 0xB3} puts all their coins into the treasure |
| S | share: coins split evenly over members with c[0x84] ∈ {0, 0xB3}, per type from jewelry down to copper, up to each one's capacity; remainders go one by one, leftovers to anyone with room. Per-member amounts are truncated to 16 bits (**Bug**), and 0xB3 members count in the divisor but get nothing in the first pass (**Bug**) |
| D | cast Detect Magic on the treasure |
| Home / End | previous / next character |
| E, Esc | leave; if money or items remain: "There is still treasure left.  Do you want to go back and claim your treasure?" Yes returns to the menu |

Anything not taken is lost when the menu closes (items freed; G).

## Player turn (O, `FUN_320c_031a`)

If the combatant cannot act (c[0x10D] = 0) the turn ends. If a spell is queued in R[0], it is cast now (`FUN_4e53_0c20`, targets chosen at this moment) and the turn ends. Otherwise the menu (`FUN_320c_0666`) repeats until an action ends the turn. Event 15 fires again each time the menu is built.

### Main menu

| Key | Shown when | Action | Routine |
|---|---|---|---|
| M Move | R[6] > 0 | move / attack by moving, below | `FUN_320c_09df` |
| V View | always | character sheet; readying or removing items (even armour) is free; attacks recomputed afterwards | `FUN_4894_0ab3`, `FUN_3aae_0d23` |
| A Aim | always | choose a target and attack, or just look around | `FUN_3aae_3558` |
| U Use | c[0xC7] > 0 (has items) | use an item | `FUN_4894_0ef8` |
| C Cast | a memorised spell exists, R[1] = 1, and area flag ECL 0x49E5 = 0 | cast a spell | `FUN_3aae_2414` |
| T Turn | cleric level c[0x96] > 0 and R[0x11] = 0 | turn undead, ends the turn | `FUN_3aae_116a` |
| Q Quick | always | autocombat for this character: c[0x10F] = 1 (and drop the target if it is an ally); the AI plays this turn | `FUN_320c_122b`, `FUN_3334_000f` |
| D Done | always | submenu below | `FUN_320c_0e45` |
| Space | hidden | clear c[0x10F] for every party member who is not an NPC (c[0x84] < 0x80) | |
| Alt-M (code 0x32) | hidden | toggle "Magic On/Off" `DS:6E30` (status line "Magic On" / "Magic Off", the turn goes on): whether party members on Quick may cast. Off at every battle start (`FUN_34c7_1e31`). In this menu extended keys are on, so '2' becomes keypad Down and does nothing; during a computer-run turn (`FUN_3334_0fc1`, raw ReadKey) '2' or Alt-M toggle (O). AI spell casting (`FUN_3334_0545`) needs R[1], a ready spell, an NPC/monster or Magic On, and enemies still in play; the area's no-magic flag 0x49E5 is not tested there | |
| Alt-Q (code 0x10) | hidden | autocombat for every combatant in the list; this one's initiative is set to 20 so it is picked again at once and played by the AI | |
| − or Alt-X (code 0x2D) | hidden | cheat, only with the `STING` command-line option: "The Gods intervene!", every enemy-side combatant becomes Dead and leaves the field (`FUN_3aae_3b93`); otherwise "That doesn't work" | |

The key reader returns the ASCII code, or the scan code for extended keys, so 0x32 is both '2' and Alt-M, 0x2D both '−' and Alt-X, 0x10 Alt-Q (and Ctrl-P). G documents the Alt forms.

### Pacing (O)

All waits scale with the game speed `DS:49E2` (0 fastest … 9 slowest, 4 in the shipped saves; changed by Done → Speed or camp Alter → Speed). The timer is DOS time in hundredths of a second; `Delay(ms)` is the Turbo Pascal CRT routine (`0A40:029C`).

| Wait | Where | Length |
|---|---|---|
| Message pause | `FUN_1709_0dbe` = Delay(speed × 225 ms); after combat messages printed with the pause flag (`FUN_10ba_16ec`, most call sites pass 1) and status-line messages (`FUN_10ba_1693`) | speed × 225 ms |
| Weapon hit or miss line | the line, sound 7 (hit) or 9 (all missed), then the message pause; no flash (see [[#Combat visuals]]) | speed × 225 ms |
| Sparkle / starburst | `FUN_10ba_1feb`: an effect took hold (speed + 1 cycles of 4 frames × 70 ms, sound 4) or spell/effect damage (one cycle, sound 3, then the pause) | (speed + 1) × 280 ms / 280 ms + speed × 225 ms |
| Before an attack | `3aae:1937` Delay(100) after the target is set | 100 ms |
| Step | each step plays the footstep (sound 10) in transient mode, which waits `delay(10)` before cutting it off ([[spec/sound]] §6); with sound off there is no wait, so the redraw sets the pace | ≈ 100 ms |
| Fall | `FUN_577f_0e11`: the skull on the combatant's cells, sound 5, then the message pause | speed × 225 ms |

At speed 0 only the fixed parts remain (hit flash 280 ms, steps); at speed 9 a message holds about 2 s and a hit about 2.8 s.

### Done submenu (`FUN_320c_0e45`)

| Key | Shown when | Action |
|---|---|---|
| G Guard | no ranged weapon readied, or it is throwable | end the turn, R[7] = 1, "Guarding" (`FUN_10ba_2686`) |
| D Delay | always | initiative = 1; the combatant is picked again after everyone with higher initiative |
| Q Quit | always | end the turn doing nothing |
| B Bandage | some party member is Dying | the first Dying party member in list order (R[0x13] = 0, side 0) becomes Unconscious, R[0xE] = 0, "is bandaged"; no range or sight limit; ends the turn (`FUN_320c_0fff`) |
| S Speed | always | game speed `DS:49E2` 0–9: S(lower) +1, F(aster) −1 (`FUN_320c_10f6`) |
| E Exit | always | back to the main menu |

### Move (`FUN_320c_09df`)

Prompt "Move/Attack, Move Left = n" with n = R[6] / 2. Loops while R[6] > 1 and the key is not Enter.

| Key | Effect |
|---|---|
| Arrows, Home, PgUp, End, PgDn (keypad) | step: Up 0 N, PgUp 1 NE, Right 2 E, PgDn 3 SE, Down 4 S, End 5 SW, Left 6 W, Home 7 NW |
| Escape | undo the whole move: movement and position restored to what they were when Move was chosen, facing restored |

For a step in direction d:

1. Look at the target cell (`FUN_577f_04be`).
2. A combatant there: melee attack on it (`FUN_320c_0d45`, below); the Move command ends. This works on any combatant, including one that cannot be targeted with Aim (blinked, G).
3. Cell 0 (outside the 25 × 50 arena): "Flee:" Y/N. Y → flee attempt ([[#Fleeing (O, `FUN_3aae_0c6a`)]]); N → stay.
4. Cell movement byte `DS:2744[cell·4]` > R[6] → "Blocked" (the byte is 1 for open cells and 0xFF for obstacles, so this only rejects obstacles).
5. Otherwise: attacks of opportunity from enemies being left (`FUN_3aae_08b2`); if still in play, the step itself (`FUN_3aae_0712`); Stinking Cloud check; if now helpless, the turn ends.

When the loop ends with fewer than 2 half-squares left, R[6] = 0.

Melee by moving (`FUN_320c_0d45`): refused with "Not with that weapon" if a non-throwable ranged weapon is readied. Attacking an ally asks "Attack Ally:" (`FUN_3aae_2998`); confirming sets ECL 0x6E33 = 1 and makes allied NPCs hostile (G). A physical attack by an ally on a charmed creature breaks the charm (G). Then target = defender, sweep attempt ([[#Sweep (O, `FUN_3aae_0e82`)]]); if no sweep, engage (`FUN_3aae_17f6`) and attack (`FUN_3aae_1884`).

### Aim (O, `FUN_3aae_3558(char, rng, mode, allowEmpty, &done, &buf)`)

The combat menu calls it as (char, 0xFF, mode 1, allowEmpty 0); spells call it through `FUN_3aae_1e16` as (caster, spell range, mode 0, allowEmpty).

**Shared primitives**
- **Scan** `FUN_56c1_0909(x, y, range, dirmode, size, grid)`: every combatant with an icon (`DS:5F2A+4i` > 0, both sides and the aimer) whose footprint is reached by line of sight (`FUN_56c1_0422`, terrain on) at cost ≤ 2·range+1, testing every pair of footprint cells and keeping the lowest cost. Creatures never block sight. Result: [index, cost in half-squares, direction] records at `DS:671B + 3(n−1)`, count `DS:671A`. Direction = first d in 0..7 (0 N, 1 NE, …, 7 NW) whose 90° cone contains the target (callers pass 0xFF, so no cone filter).
- **Sort** `FUN_56c1_002e`: exchange sort over i < j, swapping when cost[j] < cost[i], or costs equal and dir[j] < dir[i] and dir[j] mod 2 ≤ dir[i] mod 2: nearest first, orthogonal before diagonal. Reproduce the loop exactly.
- **Distance** in squares = ⌊cost/2⌋; "within r" = cost ≤ 2r+1, so range 1 covers all 8 neighbours. `FUN_10ba_255b(char, target)` measures with terrain ignored (grid[6] = 1).
- **Nearest enemies** `FUN_10ba_2433(char, r)`: the scan, keeping the opposite side (`FUN_10ba_23b7`), copied nearest first to `DS:6DE4[1..n]`; returns n.
- **Can target** `FUN_3aae_1085(target, char)`: nil → false; self → true; else fire effect event 1 on the target and, if `DS:681E` is still 0, event 0 on the char with the target set; result is `DS:681E` = 0 (invisibility, blink and the like stop it).

**Range**: rng = 0xFF → `ITEMS[weapon][12] − 1`, or 1 without a weapon; 0 or 0xFF → 1. A bow with range 22 reaches 21 squares, a hand axe (4) reaches 3, melee weapons 1.

**Loop**
1. Candidates: the scan from the aimer at range 127 with terrain (line of sight required), all sides including the aimer, sorted. The cursor starts on entry 1, the aimer (cost 0).
2. If the current entry fails Can target, step in the last direction and repeat.
3. Menu (`FUN_3aae_2aa0`): "Range = ⌊cost/2⌋" (terrain ignored) and the target's details, then **Target Next Prev Manual Center Exit**, prompt "Aim:". Target is offered only if distance ≤ rng and: spells (mode 0) always; weapons (mode 1) never on self; melee weapons yes; missile weapons (`ITEMS[t][12]` > 1, `FUN_10ba_2e03`) only with ammunition (`FUN_10ba_2e8b`: thrown 0x10 uses itself, 0x01 arrows char[0xF8], 0x80 quarrels char[0xFC], flags exactly 0x0A (sling) needs none) and either no enemy adjacent (`2433(char, 1)` = 0) or a thrown STR weapon (`ITEMS[t][14] & 0x14` = 0x14: hand axe, club, hammer, spear).
4. Keys: N +1, P −1 (wrapping), M Manual, T Target, C centre view; E or 0 exits. After M and T the list is rebuilt. Other keys repeat the last step (I).

**Target** (`FUN_3aae_2c3d`)
1. Mode 1, target not an enemy, aimer not under computer control: "Attack Ally:" (`FUN_3aae_2998`). Yes sets `DS:6DE2` = 1 and ECL 0x6E33 = 1, and every status-0 NPC (char[0x84] ≥ 0x80) in the party joins side 1 with its target cleared.
2. buf = {target, x, y}.
3. Mode 1: a fighter's sweep against 0-hit-dice creatures if it applies (`FUN_3aae_0e82`), ending the turn; otherwise `FUN_3aae_17f6`, the ammunition from `2e8b` (nil when a thrown STR weapon is used at distance 1: a melee blow), then the attack `FUN_3aae_1884(char, target, ammo, 0, &done)`.

**Manual** (`FUN_3aae_2dfa`): a cursor from the aimer moved with the arrow keys (48 N, 49 NE, 4D E, 51 SE, 50 S, 4F SW, 4B W, 47 NW), clamped to 0..49 × 0..24. Each move shows "Range = cost/2" when line of sight (range 0xFF, terrain on) reaches the cell, then "(Use Cursor keys)". A cell can be targeted when line of sight reaches it, ⌊cost/2⌋ ≤ rng, its movement byte ≠ 0xFF, and its occupant (a combatant, or a body record from `DS:66D6` on cell 0x1F) passes Can target; mode 1 also needs a combatant other than self and the missile rules above; an empty cell only with allowEmpty. Enter or T confirms (mode 1 then runs Target); E or 0 exits; C centres.

### Target finder for the AI (O, `FUN_3aae_37e4(char, range, skipCheck, forceNew)`)

1. forceNew = 0 and the current target (combat record +0xA) is an enemy, in play (char[0x10D]) and passes Can target: keep it, with **no range or line-of-sight check**. Otherwise clear it.
2. Up to 2 passes × 20 tries: n = `2433(char, range)`, pick `roll(1, n)` (uniformly random, not the nearest). Accept if Can target passes, or skipCheck and grid[6] set. A rejected entry is zeroed; a pass ends when all are zero.
3. Pass 2 sets grid[6] = 1 (terrain ignored), only when forceNew = 0. Clear grid[6]; return whether a target was found.

AI melee uses (char, 0xFF, 1, 0) (`FUN_3334_01c7`); spells use (caster, spell range, 0, 1).

### Spell targets (O, `FUN_3aae_20c3(spell, ai, &ok)`)

`DS:6B84[0]` points here in combat (set at `FUN_2fea_229a`), to `FUN_4e53_0a91` outside combat. Output: target list `DS:6C95 + 4(i−1)`, count `DS:6C94`, area flag `DS:6820`, centre `DS:6DB9`/`6DBA`.

**Picker** `FUN_3aae_1e16(spell, ai, allowEmpty, buf)`:
- Player: Aim(caster, spell range, mode 0, allowEmpty); the caster's target = the pick.
- AI, non-hostile spell (spell byte 14 = 0): self, except Cure Light Wounds (id 3, `FUN_3aae_1bf8`): the same-side ally among the 8 neighbours and its own cell (I) with HP below maximum and the lowest HP; itself if below half HP; an adjacent dying ally (body, status not 6/7/8) is preferred unless a living candidate has HP < 8.
- AI, hostile spell: up to 20 × finder(caster, range, 0, 1); reject the pick if the spell has an area (byte 15 > 0) and a scan of that radius around the target contains anyone not on the enemy side (the caster's own side, including itself), or if the target is helpless (`FUN_10ba_0b73`) and the spell's effect (byte 10) is one of `DS:286B` {51, 52, 53, 31}.

**Modes** by spell byte 6 & 0xF:

| Mode | Targets |
|---|---|
| 0 (bytes 0, 240) | the caster |
| 0xF (Silence, 31) | picker with allowEmpty = 0; the single creature |
| 8–14 | picker with allowEmpty = 1, then everyone within radius `mode & 7` of the aimed square (scan size 1, line of sight from the centre, so walls block); `DS:6820` = 1 |
| 4, 6, 7 | N = (mode & 3) + 1 separate picks (1, 3, 4) |

Separate picks use allowEmpty = 0; Exit or a failed pick uses up a slot; a duplicate gives "Already been targeted" and a retry for players (the AI loses the slot); no targets at all → not ok. The Silence fallback for a nil target uses radius `(mode & 0xF) >> 4` = 0 (bug, unreachable since allowEmpty = 0).

Area shapes (any footprint cell within the radius counts):

```
r0 (8, bolt)  r1 (9)   r2 (10)    r3 (11)
                ###      ###       ###
     X          #X#     #####     #####
                ###     ##X##    #######
                        #####    ###X###
                         ###     #######
                                  #####
                                   ###
```

**Range** (`FUN_4e53_0729`): r = byte 2 + byte 3 × level (cleric level char[0x96], magic-user char[0x9B], class 2 → 12, item `DS:6DBF` → 6), truncated to a byte; r = 0 with mode ≠ 0 → 1; r = 0xFF (touch) → 1. Touch spells roll to hit (`FUN_4e53_08c3`, event 11, `FUN_5216_0cb7` against AC char[0x111]).

**Casting** (`FUN_4e53_0c20`)
1. Loop on the target pick. On failure players get "Abort Spell?"; Yes → "Spell Aborted" and the memorised spell is lost (not when cast from an item). The AI aborts directly.
2. The caster turns to the first direction whose cone contains the centre.
3. A projectile animates to that square; sound 262A for Fireball (47), 2624 for Lightning Bolt (51), else 2618 ([[spec/sound]]).
4. Call the handler `DS:6B84[id]`. Outside combat, spells with byte 7 = 0 give "is a combat-only spell... Lose it?" (byte 7, not 11).

### Spell handlers in combat (O, segment 4e53 handler table)

- **Bless** (`0f4f`/`100f`): drop targets not on the caster's side and, for spell 1 only, any target with an enemy within 1 square. **Curse** (`1040`): enemies only, no adjacency rule.
- **Haste / Slow** (`2764`): the caster's side (Haste) or the enemy side (Slow), in list order (nearest the centre first), up to the caster's level in targets. A target holding the opposite effect loses it (`FUN_5216_1081`; Haste passes 0x2A, Slow 0x27) and is not affected, but uses a slot.
- **Sleep** (`151b`): pool = 4d4. Nearest first; cost by hit dice char[0x73]: 0–1 → 1, 2 → 2, 3 → 4, 4 → 6, 5 → 10 (race 0, else 20), ≥ 6 or negative → 20. Skip status 1 (animated) and creatures already under effect 0x35. Affect if pool ≥ cost, pool −= cost; smaller creatures later can still fit. All sides.
- **Hold Person** (`1658`): save bonus by number of targets: 1 → −2 (cleric spell 23) / −3 (magic-user spell 49); 2 → −1; 3–4 → 0. Immune (save forced) if char[0x9F] > 1 or char[0x6C] > 1 (which includes the large bit 0x80, contrary to the guide). Targets are processed last to first.
- **Stinking Cloud** (`1b11`): ignores the radius-1 list; the cloud covers the aimed square and its E, SE and S neighbours (`DS:290D` = {8, 2, 3, 4}), the aimed square being the upper left. Cells with movement byte ≠ 0xFF become 0x1E, the old cell saved in 19-byte records at `DS:6DBB`; each occupant of the 4 cells gets `FUN_5216_0ae7` (a 2×2 creature may be hit once per cell, I). The AI's friendly-fire test uses a 3×3 around the target, which does not match (I).
- **Fireball** (`266b`): level d6 (or `2·d3 + 1` d6 for spell 64), damage type 9, save for half. If ECL 0x49E6 = 0 (outdoors) the area is re-scanned at radius 2, else radius 3. The AI's test always uses 3. No "needs 3 enemies" rule exists in the code.
- **Lightning Bolt** (`2bb7` → `295b`): damage roll(L, 6) once; each creature hit saves vs spell (type 4) for half (`28bc`).
  1. Hit the creature on the aimed square.
  2. remaining = 16 half-squares; the line runs from the target square towards target + sign·(target − caster)·remaining.
  3. Step until a new creature, a cell 0 (stop), a cell with movement byte > 1, or cost ≥ remaining; hit the creature there.
  4. remaining −= the line's cumulative cost at each stop (bug: passing several creatures shortens the bolt).
  5. At a blocking cell the new origin is the wall cell and sign = −sign: the bolt comes straight back through the caster, not at the angle of incidence; the last-hit memory is cleared, so creatures can be hit twice.
  6. On the first bounce only, if the wall-to-caster cost ≤ 8, 8 more half-squares are spent.
  7. The line walker (`FUN_46c1_01a0` init, `FUN_46c1_02cc` step) is Bresenham on the major axis: error 2·minor − major, a diagonal step when the error is ≥ 0 (so a tie goes diagonal first); the 26-byte record carries the cumulative cost as a byte (+2 straight, +3 diagonal). The step stops at the end point without moving.
  8. Every stop calls `28bc` on the cell reached, which hits whatever creature stands there (so a 2×2 creature can be hit again when the bolt stops on its second cell) and reports a bounce when the cell's movement byte is 0xFF. A cell value 0 (off the field) ends the bolt.
- **Magic Missile** (`1439`): damage `roll(L >> 1, 4) + (L >> 1)`, type 8, so a level-1 caster does 0 (the guide says (L+1)/2 × (1d4+1); confirm in play).

### Cast (`FUN_3aae_2414`)

1. No spell given: choose from the memorised list (`FUN_4894_299c`).
2. Spell byte 11 = 0 (camp only): "Camp Only Spell", nothing happens.
3. `t` = casting time (byte 12) / 3. `t` = 0: cast now (`FUN_4e53_0c20`) and end the turn.
4. Otherwise "Begins Casting", R[0] = spell, initiative −= `t` (at least 1). The turn ends but the combatant stays in the order; when it is picked again the queued spell goes off and its targets are chosen then.
5. Any damage taken before that clears R[1] and the queued spell ("lost a spell", [[#Hit points and status]]).

The spell leaves the memorised list only when it actually goes off (`FUN_4e53_0c20` → `FUN_10ba_148b`). Spell effects and targeting: [[spec/spells]].

### Turn undead

See [[#Turn undead (O, `FUN_3aae_116a`)]].

## Movement (O)

### Movement points (O, `FUN_3aae_0123`)

```
m = c[0x11C]                                   // movement from FUN_10ba_0bb8
if c[0x10E] == 0: m += ECL 0x6E72              // party side only
if m < 1 or m > 96: m = 1
R[6] = event18(2·m)                            // effect event 18 with DS:681D = 1: Haste ×2, Slow ÷2, held (58) → 0
```

c[0x11C] itself (`FUN_10ba_0bb8`):

1. Start from base movement c[0x72].
2. Each readied body armour (`FUN_10ba_01fb`): weight ≤ 150 → c[0x72]; 151–399 → 9; ≥ 400 → 6; then +3 if the armour has a magical plus and the result is ≤ 9. This replaces the value, so it can raise as well as lower it. Leather (150) and padded (100) give full movement; studded, ring, chain, banded give 9; scale, splint, plate give 6 (matches G's table, including padded armour's 12).
3. Encumbrance (`FUN_10ba_03a0`): `excess = max(0, c[0x102] − allowance(STR))`; excess 0–512 → no change, 513–768 → 9, 769–1024 → 6, more → 3; the result only lowers c[0x11C].

Weight allowance by translated strength index s (`FUN_10ba_11ea`/`13ab`; s = STR for 3–18, 18/01–50 → 19, /51–75 → 20, /76–90 → 21, /91–99 → 22, 18/00 → 23, 19–25 → 24–30):

| s | 1–3 | 4–5 | 6–7 | 8–11 | 12–13 | 14–15 | 16 | 17–21 | 22–26 | 27 | 28–30 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| allowance | −350 | −250 | −150 | 0 | 100 | 200 | 350 | 500 + 250·(s−17) | 2000 + 1000·(s−22) | 7500 | 9000 + 3000·(s−28) |

So an average character carries 512 coins of weight free, and G's "extra coins" bands (1–256 → 9, 257–512 → 6, 513+ → 3) count from allowance + 512. G says monsters' movement is not reduced by armour; the code applies the same rule to everyone, so this presumably comes from their item weights (**?**).

### Steps (O, `FUN_3aae_0712(c, dir)`)

1. Cost = 3 for a diagonal (odd dir), 2 otherwise. If cost > R[6]: R[6] = 0 and nothing moves (a combatant with 2 half-squares left loses them by trying a diagonal).
2. R[6] −= cost; position += `(DS:2736[dir], DS:273F[dir])`.
3. The view recentres for computer-controlled movers that leave it.
4. R[0xF] = R[0x12] = 0 (moving clears the engagement counters, so a backstab set-up is lost).
5. Guards: every adjacent enemy with R[7] set that is not helpless loses R[7] and attacks the mover once through the normal attack routine, front AC (`FUN_3aae_0627`). Only one guard reaction per guard per guarding.
6. If the mover went down or became helpless, R[6] = 0.

### Attacks of opportunity (O, `FUN_3aae_08b2(c, dir)`)

Before each step:

1. List the enemies adjacent to c (`FUN_10ba_2433(c, 1)`); remove those that will still be adjacent after the step.
2. For each remaining enemy e while c is in play, skip it if it is helpless, cannot target c (effect events 0/1 via `FUN_3aae_1085`: invisibility without Detect Invisibility, Blink, vampire aversion), or is attached to a victim (effects 0x4A grab, 0x4B blood drain).
3. e attacks if its initiative is still > 0 (it has not acted this round) or its R[0xF] = 0; otherwise only if c lies in one of the five directions around e's facing (facing −2 … +2, `FUN_56c1_057b`).
4. The attack: hand = 2 if e has secondary attacks left, else 1; if that hand has no attacks left it gets 1. Then the normal attack routine with **from behind** set (rear AC, "(from behind)"). e's own target pointer is restored afterwards.

Leaving melee therefore costs an attack at rear AC from each enemy left behind, even from enemies that already used their attacks (G: up to +7 effective).

### Fleeing (O, `FUN_3aae_0c6a`)

Fleeing is stepping off the arena (cell 0 in Move, or the AI moving a fleeing creature off the edge).

1. No enemy in sight (`FUN_10ba_2433(c, 255)` finds none): success.
2. Else compare `own = movement(c)/2` with `fast` = the highest `movement/2` of all enemies in play (`FUN_3aae_2908`, no sight check; ECL 0x6E72 counts only for party-side combatants): fast < own → success; equal → d2 = 1 (50 %); greater → failure.
3. Success: "Got Away", status Running (3), out of play, HP kept (`FUN_5216_0f06`). Failure: "Escape is blocked". Either way the turn ends.

Running party members count as survivors; the aftermath turns them back to Okay. If every party member still in the battle runs, the outcome is "fled" (0x81) and members left Dying, Unconscious or Dead are lost.

## Attacks per round (O, `FUN_3aae_0d23`)

c[0xA1] and c[0xA2] hold attacks per round × 2 for the primary and secondary attack (fighters 3 from level 7, i.e. 3/2). Computed at round start and again after View:

```
prev = c[0x113]
x2 = c[0xA1]
ranged = has ranged weapon (FUN_10ba_2e03) and a damaging missile (FUN_10ba_2e8b: arrows for a bow,
         quarrels for a crossbow, the weapon itself if thrown)
if ranged: x2 = max(2, ITEMS[weapon][5])         // rate of fire × 2: bows 4 (2/round), darts 6
x2 = event18(x2)                                 // DS:681D = 0: Haste ×2, Slow ÷2
n = (x2 + (DS:6DE3 odd ? 1 : 0)) / 2              // round counter 0, 1, 2…: 3/2 gives 1, 2, 1, 2…
if ranged and missile: n = min(n, max(1, missile count c.item[0x39]))
if R[8] == 0 or n < prev or (n < 2·prev and not ranged): c[0x113] = n
```

The last line only matters mid-round (after View): a combatant that has already attacked cannot gain attacks by swapping weapons, except a melee user up to less than double. Secondary attacks (round start only): `c[0x114] = (event18(c[0xA2]) + odd) / 2`. If a creature has secondary attacks, they are used before the primary ones (G; the attack loop runs hand 2 first).

## Attack sequence (O, `FUN_3aae_1884` → `FUN_3aae_1406`)

### Engagement and facing (O, `FUN_3aae_17f6`, `FUN_3aae_1884`)

Before a melee attack from the menu, the AI or a guard, `engage(attacker, target)` (`FUN_3aae_17f6`):

- target R[0xF] += 1
- `diff` = angle between the target's facing and the direction from the target to the attacker, folded to 0–4 (45° steps); target R[0x12] = (R[0x12] + diff) mod 8

`attack(attacker, target, from_behind, missile)` (`FUN_3aae_1884`):

1. If target R[0xF] < 3 and not `from_behind`: the target turns to face the attacker (R[9] = direction from target to attacker). So the first two attackers each turn the target; from the third on it keeps facing the second.
2. The attacker faces the target; attacker R[0xA–0xD] = target.
3. Missile animation for a missile, or for a readied sling (item type 47).
4. If the attacker has any attacks left (c[0x113] or c[0x114] > 0): run the attack loop (`FUN_3aae_1406`) with current character = attacker.
5. Missile consumption, if a missile item was used: count c.item[0x39] −= attacks made with hand 1 (`DS:6E2D`) when the count is > 0. When the count reaches 0 (or the item was a single thrown weapon, count 0): a throwable weapon other than the Spiritual Hammer (item[0x3E] = 0x89) is copied to the battlefield item list `DS:6810` (picked up with the treasure after the battle, I) and removed from the inventory; spent arrows and quarrels are just removed. Stats recomputed.
6. If the loop reported "done", the attacker's turn ends.

### Attack loop (O, `FUN_3aae_1406(attacker, target, from_behind)`)

1. Hit counters `DS:6823/6824` = 0, attack counters `DS:6E2D/6E2E` = 0, attacker R[8] = 1.
2. **Helpless target** (effects 31, 51, 52, 53; `FUN_10ba_0b73`): sound; damage = target HP + 5 ("slays helpless … with one cruel blow"), which leaves the target Dying at −5 (G); remove the attacker's invisibility; both attack counts = 0; done. No roll, no counting of the hand.
3. **Large target** (`c[0x6C] > 0x80` or `(c[0x6C] & 7) > 1`, i.e. declared large or an icon taller or wider than one square) and attacker has a readied weapon: hand-1 dice become `ITEMS[t]` bytes 2/3 and the bonus changes by `ITEMS[t][4] − ITEMS[t][11]`. Unarmed and natural attacks are not changed. (The change lasts until the next stat recompute.)
4. Target stats recomputed, effect event 11 on the target.
5. AC byte:
   - backstab ([[#Backstab (O, `FUN_3aae_2574`)]]): `target[0x112] − 2`
   - else if target R[0xF] > 1, the direction from attacker to target equals the target's facing (attacker straight behind) and target R[0x12] > 4: from behind
   - from behind (by that test or by the caller): `target[0x112]`, else `target[0x111]`
6. Range penalty for missile weapons (`FUN_3aae_1b1e`): `band = (ITEMS[weapon][12] − 1) / 3`, d = distance: d > band → AC byte + 2; d > 2·band → a further + 3. With no ranged weapon nothing changes.
7. Attack type for messages: 0 normal, 1 from behind, 2 backstab.
8. For hand h = R[4] down to 1, while c[0x112+h] > 0 and the target is still in play: c[0x112+h] − 1, R[4] = h, attack count + 1, to-hit roll; on a hit (or if the target has become helpless) hit count + 1, damage (`FUN_3aae_0191`), apply ([[#Hit points and status]]), then effect event h+1 (2 or 3, "after hit") on the attacker if the target is still in play.
9. No hit at all: "and Misses".
10. done = no attacks left in either hand; R[5] (sweeps) = 0.

### Backstab (O, `FUN_3aae_2574`)

All of:

- attacker thief level c[0x9C] > 0
- no body armour, or armour item type 50 (Leather Armor). G also lists elven chain; the code accepts only type 50 (**?** whether elven chain uses that type)
- no weapon, or weapon type 7 (Club), 8 (Dagger), 35 (Broad Sword), 36 (Long Sword) or 37 (Short Sword)
- target R[0xF] > 1 and the attacker stands straight behind the target's facing

Because the target turns towards each of its first two attackers, in practice the thief must be the third (or later) attacker this round, standing opposite the second (G: "attack twice before the backstab"). Effect: AC byte = rear − 2 (+2 to hit on top of the rear AC) and damage × (thief level / 4 + 2): ×2 at levels 1–3, ×3 at 4–7, ×4 at 8–11, ×5 at 12–15 (O; G's 1–4/5–8 bands are off by one).

### Sweep (O, `FUN_3aae_0e82`)

Fighters' multiple attacks against creatures of under 1 HD:

1. Conditions: c[0x113] < R[5] (more sweeps than attacks), target hit dice c[0x73] = 0, distance 1.
2. n = number of adjacent enemies with c[0x73] = 0. No sweep if n ≤ c[0x113]. n = min(n, R[5]).
3. "sweeps"; the chosen target goes first; each of n adjacent 0-HD enemies is engaged and attacked with c[0x113] = 1.
4. The turn ends.

c[0x6B] = fighter level for characters with fighter levels, 1 for everyone else; monsters (race 0) always get 1, so they never sweep (`FUN_10ba_0bb8`). R[5] is cleared by any attack, so a sweep is only possible as the first attack of the round.

## To-hit (O, `FUN_5216_0cb7(ac_byte, target, attacker)`)

```
remove attacker's invisibility (effect 25)          // FUN_5216_0fd2
r = roll(1, 20)
if r <= 1: miss
if r == 20: r = 100
effects(attacker, 10); effects(target, 16)      // may change r; r < 0 forces a miss
bonus = attacker[0x10E] ? B[0x6E0] : B[0x6E2]    // ECL 0x6E70 for the enemy side, 0x6E71 for the party (signed)
hit = r >= 0 and ac_byte <= r + attacker[0x110] + bonus
```

With `ac_byte = 60 − AC` and `attacker[0x110] = 60 − THAC0` this is the AD&D rule `d20 ≥ THAC0 − AC − bonus`. There are no critical hits (G). Natural 20 always hits unless an effect sets r negative (Blink, displacement, G).

### THAC0 and AC building blocks (summary)

| Item | Effect | Source |
|---|---|---|
| base | c[0x2D] (best class), or monster value | O |
| weapon plus | to-hit and damage; bow + arrow and crossbow + quarrel pluses add | O `FUN_10ba_0000` |
| STR | to-hit and damage for weapons with ITEMS flag 4 and for unarmed attacks, only if c[0xAA] ≠ 0 (characters, 49 monster records) | O |
| DEX | to-hit for weapons with ITEMS flag 2 (missile) | O |
| elf | +1 to hit with Long Sword, Short Sword, Composite Long/Short Bow, Long/Short Bow (types 36, 37, 41–44); not the Fine Composite Long Bow (45) | O |
| dwarf, gnome racial | effects 26, 18 by monster name ([[spec/effects]]) | O |
| side bonus | ECL 0x6E70 / 0x6E71, set by scripts per battle (e.g. Kobold Caves, G) | O |
| range | +2 / +5 AC at medium / long range | O |
| rear | rear AC (no DEX, no shield, −2), backstab −2 more | O |
| invisible target | −4 (effect 25 at event 16) | O |
| Bless, Curse, Prayer, Blindness, Bestow Curse | ±1, ±4 ([[spec/effects]]) | O |

## Damage (O, `FUN_3aae_0191(hand, target, attacker)`)

```
dmg = roll(attacker[0x114 + h], attacker[0x116 + h]) + attacker[0x118 + h]     // h = hand 1 or 2
if backstab: dmg *= attacker[0x9C] / 4 + 2      // 0x9C = thief level
DS:6819 = 0 (no damage type)
effects(attacker, 4); effects(target, 5)        // e.g. Ray of Enfeeblement, weapon immunities
```

Hand 1 uses the fields shown on the character sheet (0x115/0x117/0x119). The sum is stored in a byte and the "below 0" check compares unsigned, so a negative total (e.g. 1d2 − 2 rolling 1) becomes 255 damage (**Bug**, I: needs a weapon or creature with a negative total, rare).

## Hit points and status

### Applying weapon damage (O, `FUN_3aae_02f9`, `FUN_10ba_2228`)

Message: attacker "Attacks" / "-Backstabs-" / "slays helpless", target name, "(from behind)" for type 1, then "Hitting for N point(s) of damage", "with one cruel blow" or "and Misses".

`inflict(target, dmg)` (`FUN_10ba_2228`):

```
if HP >= dmg: HP' = HP - dmg; over = 0  else: HP' = 0; over = dmg - HP
if over > 9 or (HP' == 0 and status == Animated): status = Dead (6)
elif over > 0: status = Dying (5); in combat R[0xE] = over        // −1 … −9
elif HP' == 0: status = Unconscious (4)
if status not Okay/Animated: c[0x10D] = 0, HP = 0, side count − 1, initiative 0
else HP = HP'
```

HP is unsigned; negative HP exists only as R[0xE]. Then, in `FUN_3aae_02f9`:

1. If dmg > 0: R[1] = 0 (no more casting this round). If a spell is queued (R[0] > 0): "lost a spell", R[0] = 0, and `FUN_10ba_148b(spell)` removes one copy of that spell from the memorised list of the **current character**, which during an attack is the attacker, not the caster (**Bug**, O: the interrupted caster keeps the spell memorised; an attacker who has the same spell memorised loses it).
2. If the target is out of play: "goes down", "and is Dying" or "is killed"; effects that end at 0 HP are removed (`FUN_5216_100a`: 7, 11, 30–32, 51–54, 58, 59, 74, 75, 95, 98, 137); effect event 13; fall graphic (`FUN_577f_0e11`: the skull, COMSPR 11, over every footprint cell (see [[#Combat visuals]]), sound 5 and the message pause; a party entry, R[0x13] = 0, then lies there as a body, its cell set to 0x1F unless it is a cloud 0x1E and the old cell kept in `DS:66D6 + 7n`; a monster leaves nothing, the redraw removes the picture), initiative, movement, queued spell and guard cleared (`FUN_577f_0e11`).

Non-weapon damage (spells, traps, effects) goes through `FUN_5216_1344`, which fires event 6 (damage type in `DS:6819`), halves or zeroes on a save, and applies the same thresholds ([[spec/effects]]).

### Statuses in combat

| Status | In play | Rules |
|---|---|---|
| Okay (0), Animated (1) | yes | Animated: dies at 0 HP; computer controlled; can be turned as a zombie (G) |
| Running (3) | no | fled the field; HP kept; Okay again after the battle |
| Unconscious (4) | no | HP 0; Okay after a won battle only if HP > 0 (a cure in combat raises HP but not consciousness, G) |
| Dying (5) | no | R[0xE] = negative HP, +1 per round end, Dead at 10; Bandage or any cure → Unconscious; a won battle → Unconscious |
| Dead (6), Stoned (7), Gone (8) | no | Gone = destroyed by turning, level drain of Animated, or similar |

Attacks on combatants that are out of play are not possible through Aim (I); the helpless rule does not apply to them.

### Bandage

See the Done submenu. Bandaging sets R[0xE] = 0 and status Unconscious; HP stays 0.

## Attack vs AC without an attacker (O, `FUN_5216_0c4f(bonus, target)`)

Used by ECL `DAMAGE` (traps): `r = d20` (1 fails, 20 → 100), `effects(target, 16)`, hit if `target[0x111] < r + bonus`.

## Saving throws (O, `FUN_5216_0d63(char, type, bonus)`)

Character bytes 0x6D–0x71 hold save targets: death/poison/paralysis, petrification/polymorph, rod/staff/wand, breath weapon, spell (tables in [[spec/progression]]).

```
r = d20
if r == 1: fail;  if r == 20: succeed            // before any modifier
DS:6816 = r + char[0x101] + bonus; DS:682A = type
effects(char, 12)                                 // may change DS:6816
success if char[0x6D + type] <= DS:6816
```

## Effects hook (O, `FUN_5216_02fa(char, event)`)

A switch over 20 event codes, each firing a fixed list of effect types (targeting, after hit, damage, turn start, effect added, to-hit, saving throw, death, morale, rate, round end). Full event table and all handlers in [[spec/effects]].

## Combat statistics (O, `FUN_10ba_0bb8`)

Recomputed at the start of every turn, before every attack on the target, and whenever equipment or effects change:

1. Clear the 13 readied-item pointers (char[0xCC + 4·slot]); walk the item list: count items (char[0xC7]); encumbrance char[0x102] = Σ weight × max(1, count) + Σ coins; for readied items (item[0x34]): slot = `ITEMS[type][0]` (0–8 → char[0xCC + 4·slot]; 9 = ring → char[0xF0] then [0xF4]); arrows (type 73) → char[0xF8], quarrels (type 28) → char[0xFC]; hands used += `ITEMS[type][1]`
2. A readied item with name word n1 = 0xBA (Bag of Holding) reduces encumbrance by 5000, not below the weight of readied items
3. Copy base values: damage dice char[0x115..0x11A] ← natural attack char[0xA3..0xA8] (count/sides/bonus per hand; 1d2 unarmed by default); AC char[0x111] ← char[0xA9]; movement char[0x11C] ← char[0x72]; 60−THAC0 char[0x110] ← char[0x2D]; save bonus char[0x101] ← 0
4. No weapon readied: STR to-hit (`FUN_10ba_1282`) and damage (`FUN_10ba_1325`) added to the natural attack
5. Readied weapon (`FUN_10ba_0000`): char[0x110] = base + DEX adj if `ITEMS[t][14] & 2` + STR to-hit if `& 4` + plus (+ arrow or quarrel plus, + elf +1); hand-1 dice = `ITEMS[t]` bytes 9/10; bonus = byte 11 + STR damage if `& 4` + plus (the elf +1 is to-hit only)
6. Every readied item: armour movement (`FUN_10ba_01fb`, [[#Movement points (O, `FUN_3aae_0123`)]]) and AC components (`FUN_10ba_0282`: DEX, shield, miscellaneous, ring, armour or bracers; also save bonuses)
7. Bag of Holding adjustment, then encumbrance movement (`FUN_10ba_03a0`)
8. char[0x111] = Σ components (the armour component is the better of armour and base AC; the ring component is dropped when magical body armour is worn); **rear AC** char[0x112] = armour + miscellaneous + ring − 2 (no DEX, no shield)
9. char[0x6B] = fighter level if > 0 and the race is not Monster, else 1 (sweeps)

Monsters get weapon dice, AC and THAC0 from readied equipment like characters. STR adjustments (to-hit and damage alike) need char[0xAA] ≠ 0: set for player characters and for 49 of the 172 monster records (fighters, ogre leader, vampires and other strong humanoids; O, data). G's "THAC0 is not recalculated for Strength" therefore holds only for the other 123.

### Ability adjustments (O)

STR to-hit (`FUN_10ba_1282`) and damage (`FUN_10ba_1325`), both only if char[0xAA] is set, on the combined strength index from `FUN_10ba_11ea` (3–18, then 18/xx bands, then giant strength): ≤3 → −3, 4–5 → −2, 6–7 → −1, 8–16 → 0, 17–19 → +1, 20–22 → +2, 23–25 → +3, 26–27 → +4, 28–30 → +5/+6/+7 (AD&D STR table).

DEX, in "60 − AC" units (higher is better) (`FUN_10ba_10e6`): ≤3 → −4, 4–6 → −3/−2/−1, 7–14 → 0, 15–18 → +1…+4, 19–20 → +4, 21–23 → +5, 24–25 → +6.

DEX reaction, added to initiative and to missile to-hit (`FUN_10ba_1168`): <3 → −4, 3–5 → −3…−1, 6–15 → 0, 16–18 → +1…+3, 19–20 → +3, 21–23 → +4, 24–25 → +5.

## Turn undead (O, `FUN_3aae_116a`)

1. "turns undead..."; R[0x11] = 1 (once per battle).
2. `count` = d12, `minimum` = 6, `r` = d20 (one roll for the whole attempt).
3. Column: cleric level c[0x96] 1–8 → that level; 9–13 → 9; anything else → 10.
4. Repeat while a target exists, `count` > 0 and nothing has failed:
   - target (`FUN_3aae_1351`): among enemies in sight (`FUN_10ba_2433(c, 255)`), not already turned (R[0x10] = 0), with undead type c[0x76] > 0, the lowest type; ties go to the first in the sight list (I: nearest first)
   - `v = DS:0447[type · 10 + column]`; `r < |v|` → failure, stop
   - `v ≥ 1`: "is turned", R[0x10] = 1 (it flees, [[#Computer-controlled combatants (O, `FUN_3334_000f`)]]); `v ≤ 0`: "Is destroyed", status Gone (8), out of play
   - `minimum` − 1 (if > 0); `count` − 1; if `count` reached 0 while `minimum` > 0 and this target was a D* (v < 0), `count` = 1 (keep going)
5. "Nothing Happens..." if nothing was affected. Recount sides, end the turn.

So against D* undead at least 6 are destroyed if that many are in sight (G says 6 + d6 instead of d12; the code gives max(d12, 6)). The turning cleric needs line of sight (G and O).

| Undead type (char[0x76]) | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9–13 | L14+ |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 7 | 4 | T | T | D | D | D* | D* | D* |
| 2 | 13 | 10 | 7 | T | T | D | D | D | D* | D* |
| 3 | 16 | 13 | 10 | 4 | T | T | D | D | D | D* |
| 4 | 19 | 16 | 13 | 7 | 4 | T | T | D | D | D* |
| 5 | 20 | 19 | 16 | 10 | 7 | 4 | T | T | D | D |
| 6 | – | 20 | 19 | 13 | 10 | 7 | 4 | T | T | D |
| 7 | – | – | 20 | 16 | 13 | 10 | 7 | 4 | T | D |
| 8 | – | – | – | 20 | 16 | 13 | 10 | 7 | 4 | T |
| 9 | – | – | – | – | 20 | 16 | 13 | 10 | 7 | T |
| 10 | – | – | – | – | – | 20 | 16 | 13 | 10 | 4 |

T = value 1 (automatic turn), D = 0, D* = −1 (both automatic destroy), – = 99 (impossible). Types 1–10 are skeleton, zombie, ghoul, shadow, wight, ghast, wraith, mummy, spectre, vampire (G). Animated party members are turnable as zombies (G).

## Computer-controlled combatants (O, `FUN_3334_000f`)

Used for monsters, NPCs and party members in quick combat (c[0x10F] ≠ 0).

```
done = keyscan()                                   // FUN_3334_0fc1, below
if c[0x10D] == 0: end turn
p = R[0x15]; if p == 0 or p > 4 or d4 == 1: p = (d8 == 8) ? 4 + d2 : d4;  R[0x15] = p
if not done: done = morale()                       // FUN_3334_10d7; a surrender ends the turn
if R[0x14] and not R[0x10]: "flees in panic"
if done: return
if use_item():  end turn; return                   // FUN_3334_03e4 (before the queued spell)
if R[0] > 0: cast queued spell (FUN_4e53_0c20); end turn; return
if turn_undead(): end turn; return                 // FUN_3334_0203: R[0x11] = 0, cleric level > 0, a target exists
if cast_spell(): return                            // FUN_3334_0545
choose_weapons()                                   // FUN_3334_13ca
done = keyscan()
while not done:
    if find_target(c, 255, any=1) and R[3] > 0: done = melee_missile_loop()   // FUN_3aae_37e4, FUN_3334_0b3c
    else: done = finish_round()                                                 // FUN_3334_0f4f
```

A fleeing creature still goes through item use, queued spell, turn undead and spell casting (nothing checks R[0x14] there; I: oversight).

### Target finder (O, `FUN_3aae_37e4(c, range, any, clear)`)

- Keep the current target if `clear` = 0 and it is an enemy in play that `FUN_3aae_1085` accepts (effect events 1 on the target and 0 on c: invisibility, Blink, vampire aversion; not a sight check).
- Else up to two passes: n = enemies within `range` in sight (`FUN_10ba_2433`); up to 20 random picks among them; accept the first that `FUN_3aae_1085` accepts. Pass 2 ignores terrain for sight (grid header [6] = 1) and with `any` = 1 accepts anyone, so the AI always finds some enemy on the field to walk towards.

### Morale (O, `FUN_3334_10d7`)

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

### Spells and items (O, `FUN_3334_02eb(c, spell, pri)`)

A spell (or item power) is accepted when:

1. AI priority (spell byte 13) ≥ `pri`.
2. Byte 14 (hostile) = 0 and spell ≠ 3: accept at once (buffs; no target check).
3. Spell 3 (Cure Light Wounds): accept if `FUN_3aae_1bf8` finds a patient: a wounded ally in the 8 neighbouring cells or its own cell (lowest HP; itself if under half HP), preferred if its HP < 8, else a body (cell 0x1F) of a fallen ally. If none, it **falls through** to the hostile test, so CLW is "accepted" whenever an enemy is adjacent (**Bug**, I).
4. Enemies within range `byte2 + byte3·caster level` (`FUN_4e53_0729`; touch counts as 1): none → reject.
5. Area spell (byte 15 > 0): for each enemy in range, list the combatants within radius `area` of it (`FUN_56c1_0909`); if any of them is not an enemy (including the caster) → reject. So the AI never risks friendly fire, and there is no minimum enemy count (G's "3 enemies for Fireball" is not in the code).

Item use (`FUN_3334_03e4`): needs R[2], enemies left and ECL 0x49E5 = 0. Passes = d7, priority 7, 6, …; each pass takes the first readied item (not a scroll-type slot 11–13, item[0x3E] < 0x80) whose power item[0x3D] (minus 0x17 if > 0x38) is accepted; used via `FUN_4894_1a8a`.

Spell casting (`FUN_3334_0545`): needs R[1], a memorised spell, and either an NPC/monster (c[0x84] > 0x7F) or "Magic On" (`DS:6E30`); passes = d7 with priority 7, 6, …, each pass 3 random picks from the memorised list; the first accepted is cast (`FUN_3aae_2414`).

### Weapon choice (O, `FUN_3334_128d`, `FUN_3334_13ca`)

Score (byte arithmetic): `dice × sides` (small/medium) + 8·plus (if > 0) + 2·bonus (if > 0); holy water (type 0x55) against an undead target scores 8; flag 8 (AI ranged) adds `2·(rate×2 − 1)`; one-handed +3. Score 0 for too many hands, an alignment-locked weapon (item[0x3E] = 0x84) of the wrong alignment, the Javelin of Lightning (item[0x3D] = 0x53) or any cursed item. Large-target dice are ignored.

1. Natural attack scores `A3·A5 (+2·A7 if > 0)`; ranged best starts at 1; only items usable by the class (`ITEMS[t][13] & c[0xB0]`).
2. Ranged weapon chosen iff its score > melee score / 2, it has ammunition (arrows, quarrels, or itself if thrown) and (it is a throwable melee weapon or no enemy is adjacent). Otherwise the best melee weapon (or the natural attack).
3. Swap if the current weapon differs and is not cursed; then fix hands (drop a non-cursed shield if hands are short) and ready the best shield (plus + 1) if a hand is free.
   - Candidates (O): every item usable by the class; a weapon with flag 8 or 0x10 competes for ranged (start score 1), one without flag 8 for melee (start score the natural attack), so a throwable melee weapon is in both. The hands test in the score is c[0x100] (minus the readied weapon's and shield's hands) + hands > 3.
   - Ammunition (O): the weapon itself with flag 0x10; with flag 8, arrows (char+0xF8) for flag 1 and quarrels (char+0xFC) for flag 0x80; flags exactly 0x0A need none. "Throwable melee" means range > 1 and flags & 0x14 = 0x14.
   - Hands (O): after readying, if c[0x100] > 2 a cursed shield unreadies the new weapon, otherwise the shield goes; if c[0x100] < 2 and the shield is not already the best (or cursed), the best shield is readied.

### Melee / missile loop (O, `FUN_3334_0b3c`)

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

### Movement (O, `FUN_3334_07f2`, probe `FUN_3334_0675`)

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

### Keyboard during AI turns (O, `FUN_3334_0fc1`)

'2' or Alt-M toggles "Magic On/Off"; Space returns control (c[0x10F] = 0 for every non-NPC, non-Animated member; the current one gets initiative 20 and its turn continues manually); '−' or Alt-X runs the STING cheat.

## Battlefield (O, `FUN_34c7_1e31`)

1. Load combat icon set: `DUNGCOM` when `DS:49FA` = 1 (map area), otherwise `WILDCOM`/`RANDCOM` (`FUN_34c7_1244`)
2. Allocate the grid: 0x4E9 bytes = 7-byte header + **25 rows × 50 columns** (`cell = grid[7 + row·50 + col]`); header [2],[3] = view origin (first party member's position − 3)
3. Build terrain: map areas `FUN_34c7_0810`, wilderness `FUN_34c7_11b4` (**?**)
4. Create a 22-byte combat record per list entry (`FUN_34c7_12e1`); entries after the first `B[0x67C]` (party size) are monsters (record [0x13] = 1); record [9] = facing from `DS:02F2[party facing / 2]`, monsters face the opposite way; monsters with morale byte 0 or > 102 get `B[0x58C]` (encounter morale) + NPC bit
5. Place combatants (`FUN_34c7_19f5`): deployment zones per side from `DS:0306` (12 bytes per direction: 6 rows of [min col, max col]); `FUN_34c7_1577` finds a free spot; a monster that cannot be placed is removed; party members who cannot act are laid down as bodies (cell set to 0x1F, original cell remembered in `DS:66D6`)
6. Effect hook 8 for everyone, `FUN_3aae_2879`, game mode `DS:49F3` = 5

### Wilderness battlefields (O, `FUN_34c7_11b4`)

1. Fill all 1250 cells with cell 0x17 (open ground)
2. Terrain type `DS:465A` = overland tile at `DS:3648 + y·44 + x + region·13`, with x = `A[byte 0x186]` (ECL 0x49C3), y = `A[byte 0x188]` (ECL 0x49C4), region 0/1/2 for area kind `DS:49FA` = 2/3/4 (areas 25–27)
3. Classify the tile into feature flags (`FUN_34c7_08a4`, below)
4. Run the river, tree and scatter passes, then the finishing pass shared with map areas

`DS:3648` is the overland map of the three wilderness regions (13 columns each, rows of 44 bytes; values are overland tile ids, **I**).

#### Terrain flags (O, `FUN_34c7_08a4`)

A hard-coded range table maps the overland tile id to a flag byte. The names are inferred from what each flag makes the passes generate:

| Bit | Inferred meaning | Effect |
|---|---|---|
| 0x01 | plain | none of its own |
| 0x02 | rocky | rocks 45/255, tufts 10/255 |
| 0x04 | light woods | trees 3 %, rocks 25/255 |
| 0x08 | forest | trees 7 % |
| 0x10 | river | river 75 % |
| 0x20 | stream | river 35 % |
| 0x40 | swamp | trees 4 % (swamp trees and logs), marsh plants 30/255, tufts 5/255, puddles possible |
| 0x80 | arid | no trees; cactus 15/255, tufts 25/255, rocks 10/255 |

| Tile ids | Flags |
|---|---|
| 1–2, 0x28–0x29, 0x2B, 0x4F–0x56, 0x5B–0x5C, 0xF1 | 0x01 |
| 0xA8–0xB1 | 0x21 |
| 0xB9, 0xBC–0xC0 | 0x11 |
| 3–4, 6–9, 0x13–0x15, 0x17–0x19 (first match wins) | 0x03 |
| 7, 0x0A–0x12, 0x16, 0x1A–0x24, 0xC9–0xD0 | 0x02 |
| 0xD1–0xD5 | 0x12 |
| 0x25, 0x39, 0x40, 0x9A–0x9E, 0xA4–0xA5, 0xB4, 0xEF–0xF0, 0xF3, 0xFA, 0xFC | 0x04 |
| 0x27–0x2C, 0x99, 0x9F | 0x05 |
| 0x2D–0x2E, 0x33–0x38, 0x43–0x4D, 0x5D–0x61 | 0x44 |
| 0xB5–0xB8, 0xBA, 0xC1–0xC8 | 0x14 |
| 0x2F–0x32, 0x62–0x65, 0xF2 | 0x40 |
| 0x26 | 0x41 |
| 0xB2–0xB3 | 0x60 |
| 0x3A–0x3C, 0x41–0x42 | 0x48 |
| 0x3D–0x3F, 0x79–0x7C, 0x87–0x89, 0x8B, 0x8D, 0x90–0x93, 0x95, 0x97–0x98, 0xA0–0xA2, 0xA6–0xA7, 0xD6–0xD8, 0xEE | 0x08 |
| 0x57–0x5A, 0xA3, 0xE0 | 0x88 |
| 0x7C–0x7D, 0x8A, 0x8C, 0x8E–0x8F, 0x94, 0x96 | 0x09 |
| 0x7E–0x85, 0xE5–0xE7 | 0x28 |
| 0xD9–0xDF | 0x18 |
| 0x4E, 0xF5, 0xE8–0xE9 | 0x20 |
| 0x6D, 0xF4–0xF6 | 0x80 |
| 0x6E–0x71, 0x73–0x78 | 0x81 |
| 0x66–0x6C, 0x72 | 0x90 |
| 0xE1–0xE4, 0xEA–0xED | 0xA0 |
| anything else (including 0) | not set: the original returns an uninitialised byte; use 0 |

The tests run in the order listed, so the first matching row wins. If the result has bit 0x80 and ECL word `A` 0x4AB3 (byte offset 0x366) is 0xFF, the value becomes `(flags + 0x80) | 1`, which clears 0x80 and sets 0x01 (**I**: a story state that changes the arid terrain).

#### River pass (O, `FUN_34c7_0bde`)

Runs if d100 ≤ 75 (flag 0x10) or ≤ 35 (flag 0x20).

- Start column = `34 − 5d4`, then decreased until `(col + 2) mod 7 = 0` (so 12, 19 or 26)
- For each row 0–24, while the column is below 50: set (row, col) = 0x32 and (row, col+1) = 0x33 (the two water banks); 1 in 20 rows becomes a ford (0x34, 0x35); then col + 1. The river runs diagonally down and to the right.
- A crossing is always added: row `r = 16 − d9`, fords at (r, start + r) and (r + 1, start + r + 1)

#### Tree pass (O, `FUN_34c7_0d13`)

Chance per cell: 1 %; flag 0x04 → 3 %; 0x40 → 4 %; 0x08 → 7 %; 0x80 → 0 (later tests override earlier ones). For every cell in rows 1–24 where the cell and the cell above are both open ground, roll d100 ≤ chance:

- size = d10 ≤ 8 → `(d10 + 1) / 2` (1–4), else `4 + d2` (5–6); with flag 0x40, size = `3 + d3`
- cell = `0x23 + size` (trunks 0x24–0x27, logs 0x28–0x29); for size < 5 the cell above = `0x1F + size` (crown 0x20–0x23)

#### Scatter pass (O, `FUN_34c7_0e9e`)

Parameters: `a` = 0, `b` = 15, `c` = 0, `d` = 40. Flag 0x02 → b 45, d 10; 0x04 → b 25; 0x40 → d 5, c 30; 0x80 → a 15, d 25, b 10. For every open-ground cell roll `r` = d255:

| r | Result |
|---|---|
| ≤ a | cactus: d4 = 4 and the cell above is open → tall cactus (0x40, with top 0x41 above); d4 < 4 → 0x3C + d4 |
| ≤ a + 6 | shrub or low grass `0x36 + d3` |
| ≤ a + 6 + b | rocks `0x29 + d4` |
| ≤ a + 6 + b + c | marsh plant `0x39 + (d10 − 1) / 3` |
| ≤ a + 6 + b + c + d | grass tuft `0x2D + d4`; a 4 (puddle 0x31) stays only with flag 0x40, otherwise `0x2D + d3` |
| higher | nothing |

### Cell table (O, `DS:2744`, 4 bytes per cell value)

| Byte | Meaning |
|---|---|
| 0 | movement: 1 = enterable, 0xFF = blocked (**I**: values fit the images; reader not yet traced) |
| 1 | eye height used by line of sight (0 for every cell) |
| 2 | sight block: 2 = blocks line of sight, 0 = see-through |
| 3 | image slot to draw |

Image slots are filled at battle start (`FUN_34c7_1244`): `DungCom` (25 images) or `WildCom` (34 images) into slots from 0, then `RandCom` (6 images) into slots 0x22–0x27. Cells 0x00–0x1F are the map-area set and cells 0x20–0x41 the wilderness set; cells 0x1A–0x1F are shared (RandCom).

| Cells | Image | Move | Sight |
|---|---|---|---|
| 0x01–0x16, 0x19 | dungeon wall and door pieces (slots 0–0x15, 0x18) | doors and partial pieces 0x05, 0x09, 0x0B, 0x0D, 0x0F, 0x11 enterable; the rest blocked | blocked pieces block |
| 0x17 | open ground (slot 0x16, blank) | yes | clear |
| 0x18 | slot 0x17 | yes | clear |
| 0x1A, 0x1B | rocks (RandCom 0, 1) | yes | clear |
| 0x1C | bone (RandCom 2) | yes | clear |
| 0x1D | potted flower (RandCom 3) | yes | clear |
| 0x1E | cloud (RandCom 4) | yes | clear |
| 0x1F | fallen body (RandCom 5) | yes | clear |
| 0x20–0x23 | tree crowns (Wild 0–3) | no | blocks |
| 0x24–0x27 | tree trunks, 0x27 = swamp tree (Wild 4–7) | yes | clear |
| 0x28, 0x29 | fallen logs (Wild 8, 9) | no | clear |
| 0x2A–0x2D | rocks and a boulder (Wild 10–13) | yes | clear |
| 0x2E–0x30 | grass tufts (Wild 14–16) | yes | clear |
| 0x31 | puddles (Wild 17) | yes | clear |
| 0x32, 0x33 | river, left and right bank (Wild 18, 19) | no | clear |
| 0x34, 0x35 | ford (Wild 20, 21) | yes | clear |
| 0x36 | open ground (Wild 22) | yes | clear |
| 0x37, 0x38 | shrubs (Wild 23, 24) | no | clear |
| 0x39 | low grass (Wild 25) | yes | clear |
| 0x3A, 0x3B | reeds (Wild 26, 27) | yes | clear |
| 0x3C | marsh weed (Wild 28) | no | clear |
| 0x3D–0x3F | cactus (Wild 29–31) | no | blocks |
| 0x40 | tall cactus base (Wild 32) | yes | clear |
| 0x41 | tall cactus top (Wild 33) | no | blocks |

The two-cell objects (trees, tall cactus) put the obstacle in the upper cell and leave the lower cell walkable.

### Line of sight and range (O, `FUN_56c1_0422`)

`los(grid, &range, &x1, &y1, x0, y0)` walks a Bresenham line from (x0, y0) towards (x1, y1) (`FUN_56c1_01a0` sets it up, `FUN_56c1_02cc` steps it):

- each straight step costs 2, each diagonal step 3 (distance in half squares; a diagonal counts 1½)
- a second Bresenham line interpolates eye height between the two ends' cell byte 1 (always 0 in practice)
- the walk stops at a cell whose sight byte exceeds the eye height, unless grid header byte 6 is set (then terrain is ignored; it is 0 after setup)
- it also stops once the cost exceeds `2 × range + 1`

Returns true if the target was reached, with `range` set to the cost; otherwise false, with (x1, y1) set to the blocking cell. The step direction (0–7) is kept from `DS:25C1[(sy + 1)·3 + sx + 1]` (**I**).

### Map areas: squares → cells (`FUN_34c7_0810`)

All of this subsection is **O**. Called from `FUN_34c7_1244` when `DS:49FA` = 1 (otherwise `FUN_34c7_11b4`), right after the grid is allocated with `GetMem(0x4E9)` (not cleared) and header bytes [4] = 0, [5] = 1, [6] = 0 are set. Reference implementation: `tools/battlefield.py`.

**Orientation.** The party's facing (`DS:6AAF`) is never read: the grid is always north-up, with columns running east and rows running south. Each map square is a parallelogram sheared one column right per row. Facing only matters later, for the combatants' facing and deployment zones.

#### Driver

```
X, Y = DS:6AAD, DS:6AAE                     // party square, signed bytes
for dy in -2..2:                            // outer loop
  for dx in -6..6:                          // inner loop
    x, y = X+dx, Y+dy                       // no wrap-around
    W = classify(x, y, 6); N = classify(x, y, 0); E = classify(x, y, 2)
    stamp_floor_west(); stamp_north(); stamp_nw(); stamp_ne()   // 02ba, 0377, 040f, 0615
finish()                                    // 0000, below
```

`plot(c, r, piece)` (`FUN_34c7_0221`) writes `piece + 1` to `grid[dy·5 + 10 + r][dx·6 + dy·5 + 21 + c]`, skipped if the row is outside 0–24 or the column outside 0–49. The tables below give the cell values (`piece + 1`) at block offsets (r, c). The party's square has its block origin at row 10, column 21.

#### Edge classes (`FUN_34c7_012b`, `FUN_34c7_01ad`)

Direction `d` is 0 N, 2 E, 4 S, 6 W; the neighbour across is `(x + DS:2736[d], y + DS:273F[d])`.

```
edge(x, y, d):                              // 012b: one side of the edge
  if 0 ≤ x ≤ 15 and 0 ≤ y ≤ 15:
    if passage(x, y, d) == 0: return 1      // FUN_55a0_0350 (stub 3d5:2f)
    if walltype(x, y, d) == 0: return 0     // FUN_55a0_047b (stub 3d5:2a)
    return 3
  return (y == DS:6AAE and d in {2, 6}) ? 0 : 1
classify(x, y, d) = edge(x, y, d) | edge(nx, ny, (d + 4) mod 8)   // 01ad
```

Classes: 0 open, 1 wall, 3 door. A door is any wall side whose passage value is not 0, so passable walls and locked doors (2, 3) both count. Since 1 | 3 = 3, a door seen from either side makes a door. Off-map edges are walls, except the east and west edges of squares on the party's own row. The game's movement code wraps coordinates at 0–15, but this code never wraps.

#### Floor and west edge (`FUN_34c7_02ba`)

```
for r in 2..4, c in 0..5: cell 0x17           // floor
if W == 1: for r in 2..4: (r, r−1) = 0x05; (r, r) = 0x04; (r, r+1) = 0x0E
if W == 3: (2, 1) = 0x09; (4, 5) = 0x01       // door posts; the middle stays floor
```

#### North edge (`FUN_34c7_0377`)

`N == 1`: (0, 3) = (0, 4) = 0x06 and (1, 3) = (1, 4) = 0x0B. Otherwise all four cells are 0x17. A door on the north edge looks open here; only the corner pieces show it.

#### North-west corner (`FUN_34c7_040f`), cells (0,1) (0,2) (1,1) (1,2)

`f` = 1 when `classify(x, y−1, 6)` = 0 and `classify(x−1, y, 0)` = 0 (the corner's other two arms are open).

| Cell | Rule (first match) |
|---|---|
| (0,1) | N=0: W=0 → 17, W=3 → 0E, W=1 → f ? 01 : 0E. N≠0: W=0 → f ? 10 : 06, W≠0 → f ? 13 : 03 |
| (0,2) | N=0 → 17, N=3 → 12, N=1 → 06 |
| (1,1) | W=0: N=0 → 17, else f ? 11 : 0B. W=3 → f ? 15 : 08. W=1 → f ? 02 : 04 |
| (1,2) | W≠1: N=0 → 17, N=3 → 18, N=1 → 0B. W=1: N=0 → 0E, N=3 → 16, N=1 → 07 |

#### North-east corner (`FUN_34c7_0615`), cells (0,5) (0,6) (1,5) (1,6)

`g7 = classify(x, y−1, 2)` (east edge of the north neighbour), `g8 = classify(x+1, y, 0)` (north edge of the east neighbour).

| Cell | Rule (first match) |
|---|---|
| (0,5) | N=0: g7=1 → 05, else 17. N=3 → 10. N=1 → 06 |
| (0,6) | N=0: g7=0 → 17; g7=3 → (E=0 and g8≠0) ? 19 : 02; g7=1 → (E=0 and g8≠0) ? 0C : 04. N≠0: E≠0 → 0A; g8≠0 → 06; g7=0 → 12; else 14 |
| (1,5) | N=0 → 17, N=3 → 11, N=1 → 0B |
| (1,6) | N=0: g7=0 → 17; E≠0 → 05; g8=0 → 09; else 0D. N≠0: E≠0 → 0F; g8=0 → 18; else 0B |

The E class is only used here. No routine draws an east or south edge: square x+1's west edge is the same edge as square x's east edge (`classify` ORs both sides), and the next row's north edge does the same for south edges. The south edges of the last row (dy = 2) are never drawn.

#### Coverage and order

- A block writes rows 2–4 at columns 0–5 and rows 0–1 at columns 1–6. Column 0 of rows 0–1 is the previous block's column 6, and blocks never overlap, so the only overwrite is the west-edge pieces on top of the floor.
- For dx = −6, column 0 of rows 0–1 falls left of grid column 0, and for dx = 6, column 6 of rows 2–4 falls right of column 49, so every one of the 1250 cells gets written. This is checked by `tools/battlefield.py` on New Phlan (GEO3 #0 at (15,1)) and on GEO2 #20 at (9,6).
- Every edge of an off-map square is a wall, so it becomes a closed block. The exception is the party's row, where east and west edges are open (the north edge stays a wall), so the party's row carries on as an open corridor past the east or west map border (New Phlan at (15,1): rows 10–14 open from column 28 to 49). The north and south map borders are always walls.

#### Finishing pass (`FUN_34c7_0000`)

Columns 0–49 outer, rows 0–24 inner. On each cell whose image slot `DS:2747[cell·4]` = 0x16 (only cell 0x17), roll `FUN_5216_0de3(1, 100)`:

- 98 → 0x1A
- 99 → 0x1B
- 100 → if area `DS:84DC` ≠ 10 and another d100 = 1, then d10 ≤ 6 → bone 0x1C, else potted flower 0x1D
- 1–97 → no change

Wilderness battlefields also run this pass.

## Known original bugs affecting combat

Reproduce these in an authentic port (O unless marked).

| Bug | Where |
|---|---|
| Interrupting a spell removes the spell from the attacker's memorised list, not the caster's; the caster keeps it | `FUN_3aae_02f9` → `FUN_10ba_148b` |
| A negative damage total wraps to 255 (I) | `FUN_3aae_0191` |
| Protection from Evil/Good −2 to hit is overwritten (only the save bonus works) | [[spec/effects]] |
| Mirror Image absorbs only targeted spells, never weapons | [[spec/effects]] |
| Haste/Slow shown reversed on the character sheet (combat uses the right values) | [[spec/effects]] |
| A diagonal step with exactly 2 half-squares left forfeits the remaining movement | `FUN_3aae_0712` |
| Opportunity attackers get one attack even when they have none left | `FUN_3aae_08b2` |
| Round counter is a byte; round-0 rules recur after 256 rounds (G) | `DS:6DE3` |
| Elf bow bonus misses the Fine Composite Long Bow; racial name lists miss GOBLIN GUARD, HOBGOBLIN LDR, GRISHNAK (G, O for the elf list) | `FUN_10ba_0000`, effects 18/26 |
| Experience divisor can be 0 (crash) when only Animated members remain (I) | `FUN_2e08_0000` |
| NPC treasure share truncated to 8 bits; Share truncated to 16 bits; "takes and hides his share" shown even when nothing was taken | `FUN_2e08_12e8`, `FUN_4c2d_063a` |
| Monsters drop their remembered party target every pass of the attack loop (side test inverted, I) | `FUN_3334_0b3c` |
| AI Cure Light Wounds accepted whenever an enemy is adjacent, even with nobody wounded (I) | `FUN_3334_02eb` |
| Script-placed treasure items give experience unless something was thrown in the battle (I) | `FUN_2e08_0000` |
| Results loops read the next pointer of a record they just freed | `FUN_2e08_04c9` |
| Bodies: `FUN_577f_10a7` restores the saved cell at the new position (I) | `FUN_577f_10a7` |

## Still open

- Spell targeting and area templates (`FUN_3aae_1e16`, `FUN_3aae_20c3`, `FUN_56c1_0909`) and the per-spell immediate effects (damage, healing, target limits) in segment 4e53
- Where the treasure money table `DS:67F4` is cleared; `DS:4A00` set after every battle
- Whether elven chain counts as leather for backstabs; whether charm is undone before the post-battle cleanup
- Overland tile meanings (which ids are roads, towns, water), to label the terrain flag table

## Combat visuals

Marks: **O** observed in code, **I** inferred, **?** unknown. "speed" is the game speed `DS:49E2` (0–9). Sound numbers as in [[spec/sound]] §7.

### Building blocks

**Icon table** (O): `DS:5E5A + 8·slot + 4·sub`, 26 slots of 24×24 icons; sub 0 normal, sub 1 "action". `FUN_58af_01c8(name, record, slot)` loads `record` into sub 0 and `record + 0x80` into sub 1 (colour 0 transparent, I). At game init (`FUN_36c1_002d`) COMSPR 0–11 go into slots 13–24 and COMSPR 25 into slot 25:

| slot | COMSPR | use |
|---|---|---|
| 13 | 0 / 128 | arrow N / S |
| 14 | 1 / 129 | arrow NE / SE |
| 15 | 2 / 130 | arrow E / W |
| 16 | 3 / 131 | spinning axe, club, hammer |
| 17 | 4 / 132 | flask |
| 18 | 5 / 133 | spell bolt (every spell and gaze) |
| 19 | 6 / 134 | lightning |
| 20 | 7 / 135 | boulder (default missile) |
| 21 | 8 / 136 | sling stone |
| 22 | 9 / 137 | sparkle: an effect took hold |
| 23 | 10 / 138 | starburst: spell or effect damage; acid spit |
| 24 | 11 / 139 | skull: a combatant falls |
| 25 | 25 / 153 | cursor tile (sub 0 only) |

Monster `CPIC` icons take slots 8 and up; more than 5 monster types would overwrite slot 13 onwards (**?**, no check found).

**Drawing a combatant** `FUN_577f_0af8(c, dir, action, noDraw)` (O): scroll to c if needed (margin 3); erase its cells when the facing half changes or action/noDraw is set; R[9] = dir; draw icon c[0xBF] with sub = action. `FUN_58af_04fc` mirrors the icon when dir ≥ 4 (S, SW, W, NW), so only two facings show. Status never changes the icon (asleep, held, charmed look the same). Walking never changes R[9] (`FUN_3aae_0712`).

**Animation buffer** `DS:6E36`, 4 frames (O): `FUN_10ba_1892(slot, sub, k, mirror)` copies an icon into frame k, mirrored if asked; `FUN_10ba_19de(slot)` builds the standard cycle **sub 0, sub 0 mirrored, sub 1 mirrored, sub 1**.

**Projectile flight** `FUN_10ba_1a29(x1, y1, x2, y2, frames, delay)` (O unless marked): a Bresenham line in thirds of a cell (8-pixel steps) from 3·(x1, y1) to 3·(x2, y2) (line walker `FUN_56c1_01a0`/`02cc`), about 3·max(|Δx|, |Δy|) steps (I); no flight when both ends are the same cell. Before it the view stays when both ends are visible, else centres on the midpoint when |Δx| and |Δy| ≤ 6; a projectile leaving the 7×7 window scrolls it 3 cells. Each step draws frame f at the step, presents, Delay(delay), restores the background, f = (f + 1) mod frames. With delay 0 a step is drawn only on cell-aligned positions and the final frame stays (the aim cursor). The final frame is drawn at the target.

**Effect display** `FUN_10ba_1feb(target, good, msg)` (O): outside combat only msg and the pause. In combat: SetResident(0); frames = `19de(22)` sparkle if good, `19de(23)` starburst if not; scroll to the target; sound 4 (good) or 3; msg printed **without** a pause; frames 0–3 at the target's top-left cell, 70 ms each, for speed + 1 cycles (good) or 1 cycle (not good); SetResident(10); the message pause only when there was one cycle (always for damage; for good only at speed 0).

### Weapon attacks (O, `FUN_3aae_1884`)

1. A target that turns (R[0xF] < 3 and not from behind) is redrawn facing the attacker.
2. The attacker faces the target and shows its **action frame**; Delay(100).
3. Missile flight, if any (below).
4. The attack loop `FUN_3aae_1406`: no flash. A hit plays sound 7 (transient), an all-miss line sound 9, a helpless slay sound 7; each result line ends with the message pause.
5. The attacker returns to frame 0.

### Falls: the skull (O, `FUN_577f_0e11`)

Any combatant of either side that goes out of play (weapon damage `3aae_02f9`, spell/effect damage `5216_1344`, status changes `3723_0058`, turned undead "is destroyed" `3aae_116a`): scroll to it, erase its cells, draw the **skull** (slot 24, COMSPR 11) on every footprint cell; a party entry (R[0x13] = 0) then gets a body record and cell 0x1F (unless it is cloud 0x1E); sound 5 and the message pause; the skull is erased and the view redrawn, so party members show the 0x1F body (RandCom 5) and monsters leave nothing. `3723_0058` pauses once more afterwards. Outside combat only sound 5 and the pause.

### Sparkle and starburst (O)

- **Sparkle**, (speed + 1) × 280 ms, sound 4, on each target (never the caster): from `FUN_5216_1656` after adding an effect whose message is not empty ("falls asleep", "is held", "is charmed", "is blinking", "is Speedy", ...; "is unaffected" gets none), and direct calls: Cure Blindness, Dispel Magic, Remove Curse, healing potions/ointment ("is Healed"), turn undead "is turned", monster paralysis. Cure Light Wounds has none.
- **Starburst**, 280 ms, sound 3, then the pause, on each target that takes damage > 0 after its save (`FUN_5216_1344`, "takes N points of damage"): every damaging spell, breath, spit and poison. The skull follows if the target is now out of play.

### Missiles and spell flights (O)

**Weapon missiles** `FUN_3aae_26b0(attacker, target, item)`, once per attack action:

| item type | frames | frames, delay |
|---|---|---|
| 9 Dart, 21 Javelin, 28 Quarrel, 31 Spear, 73 Arrow | by direction: N 0, NE 1, E 2, SE 129, S 128, SW 129 mirrored, W 130, NW 1 mirrored | 1, 10 ms |
| 2 Hand Axe, 7 Club, 20 Hammer | `19de(16)` | 4, 50 ms |
| 85 Holy Water, 86 Oil | `19de(17)` | 4, 50 ms |
| 47 Sling | 8, 136 | 2, 20 ms |
| anything else | 7, 135 | 2, 20 ms |

Sound 6, the flight, sound 12.

**Spell flight** (`FUN_4e53_0c20`, combat only): frames `19de(18)`; the caster turns to the aim point and shows its action frame; sound 11 (Fireball), 8 (Lightning Bolt) or 2; flight caster → aim point, 4 frames, 30 ms; caster back to frame 0; then the handler. Self-targeted spells have no flight. Extras:
- **Hold Person** (`4e53_1658`): sound 2 and a bolt to each target but the last-listed one before its save (I, likely a bug).
- **Lightning Bolt** (`4e53_295b`/`28bc`), breath bolt (`4e53_30d9`), Javelin of Lightning: frames `19de(19)`, each segment (bounces included) flown at 50 ms; each creature hit gets the starburst.
- **Fireball** (`4e53_266b`): no burst graphic; the view centres on the aim point, each target gets its starburst.
- **Stinking Cloud**: "Creates a noxious cloud" without a pause, a redraw showing the cloud cells (RandCom 4), then the pause.
- **Gazes** (`3723_1cad`, `1e77`): the spell bolt, 4 frames, 45 ms ("reflects it!" adds a return flight). **Acid spit** (`3723_2c1c`): COMSPR 10 alone at 30 ms, then the starburst.

### Palette (O)

Drawing the combat screen frame (`FUN_10ba_2b88`, at battle start and after casting or using an item) calls `FUN_577f_00e3`: on EGA (`DS:4A1E` = 1) palette register 0 := colour 8 and register 8 := colour 0 (`FUN_1464_2a0d(reg, colour)`, INT 10h AX=1000h; colours ≥ 8 are sent as colour + 8, the intensity bit). Black shows as dark grey and dark grey as black: dungeon floors are dark grey, the mortar between stones black. The cleanup `FUN_320c_0000` → `FUN_577f_0105` restores both registers. The combat-icon editor (`FUN_417f_382d`) and the View screen (`FUN_4894_0ab3`) swap and restore the same way.

### Cursor tile (O)

COMSPR 25, an opaque grey bevelled square, is drawn under the combatant whose turn it is (every turn start, AI or player; removed at turn end), under a caster who "Begins Casting", and under the current target in Aim; Next/Prev slides it to the new target (a flight with delay 0).

### Absent (O)

No Fireball or area burst graphic, no Magic Missile sprite, no sparkle on the caster, no icon change for Sleep/Hold/Charm, no blinking of the active combatant; "Continue Battle:" is text only; `1feb` effects draw at a big monster's top-left cell only, the skull on every cell.
