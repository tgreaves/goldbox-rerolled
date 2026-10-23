---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Combat rules

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Curse of the Azure Bonds: [coab/combat.md](../coab/combat.md); the
> engine model's combat procedures: [B-model/procedures.md §15](../../B-model/procedures.md#15-combat-procedures).

Everything needed to run a battle: start, rounds, player and computer actions, attack resolution, status, end of battle and rewards. Spell effects are in [spells.md](spells.md) and [effects.md](effects.md). Three companion files complete it: the battle grid and its generators in [battlefield.md](battlefield.md), the computer's side in [combat-ai.md](combat-ai.md), and what is drawn in [combat-visuals.md](combat-visuals.md); the conventions below apply to all four.

## Conventions

Each rule carries an evidence mark as in the [README](../../README.md#evidence-marks): **O**, **I**,
**?**, **G** (Stephen Lee's guide v2.00, [por/README.md, "External reference"](../por/README.md#external-reference),
not checked in code) or **Bug**. A conforming build reproduces every **Bug** unless part C specifies a
departure ([C-port/departures.md](../../C-port/departures.md)).

- Addresses are Ghidra `seg_off` names in the merged image. The guide's IDA segments map to ours by overlay: 1DFA → 2e08, 21FE → 320c, 2326 → 3334, 24B9 → 34c7, 2715 → 3723, 2AA0 → 3aae, 3E45 → 4e53, 4208 → 5216, 46B3 → 56c1, 4771 → 577f, executable 00BA → 10ba. Offsets inside a segment are identical.
- `c[x]` is a byte of the 0x11D-byte character/monster record ([records.md](records.md)); `R[x]` is a byte of its 22-byte combat record (pointer at c[0x108]).
- Distances are in squares. The engine measures them in half-squares: a straight step costs 2, a diagonal step 3 (see [battlefield.md, "Line of sight and range"](battlefield.md#line-of-sight-and-range-o-fun_56c1_0422)). "Distance" in this file is that cost divided by 2, rounded down.
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

1. A script runs ECL `COMBAT` with monsters loaded by `LOAD_MONSTER` ([ecl.md](ecl.md)). Scripts set the per-battle variables first: surprise 0x6DCB, morale 0x6DC6, side to-hit bonuses 0x6E70/0x6E71, party movement bonus 0x6E72, no-items flag 0x6DE3, duel flag 0x6DE6.
2. Battlefield built and combatants placed ([Starting a battle](#starting-a-battle), [battlefield.md](battlefield.md)).
3. Rounds until one side has nobody able to act ([Battle flow (O)](#battle-flow-o)). In each round every combatant gets initiative; the highest acts first and spends its whole move and all its attacks before the next one acts.
4. Aftermath: survivors, experience, treasure, outcome in ECL 0x6DC7 ([Aftermath (`FUN_2e08_1527`)](#aftermath-fun_2e08_1527)).

## Dice (O, `FUN_5216_0de3`)

`roll(count, sides) = Σ count × (Random(sides) + 1)` using the Turbo Pascal RNG (`FUN_1af8_11c0`). A conforming build need not reproduce the Turbo Pascal sequence: every die comes from the injected dice source, and the order of the requests is the one this spec describes ([spec README, "Randomness: the dice tape"](../../README.md#randomness-the-dice-tape-d2)). `FUN_5216_0e2e` does the same and also stores the dice count in `DS:681C` (used by per-die damage reduction effects). The sum is a byte; there is no overflow check (G).

## Starting a battle

### ECL `COMBAT` entry (O, `FUN_29c3_179b`)

1. If no monsters are loaded and no duel is set up, `COMBAT` is a shop, temple or treasure screen instead ([ecl.md](ecl.md)).
2. `d` = how far monsters can stand in front of the party (`FUN_2fea_0482(x, y, facing)`, 0–2, blocked by walls); if `d` < ECL 0x6DC1 (encounter distance), 0x6DC1 = `d`.
3. Battle (`FUN_320c_007a`), then aftermath (`FUN_2e08_1527`).
4. Clear the duel flag `DS:84D4`, set the game mode back (4 in map areas, 3 elsewhere), clear the "Look requested" bit of ECL 0x6DCA, redraw the normal view.

### Surprise (O)

- ECL 0x6DCB: bit 0 = party surprised, bit 1 = monsters surprised. The `SURPRISE` opcode can produce 0, 1 or 2, never 3 ([ecl.md](ecl.md)); scripts may write 3 directly.
- Applied only to the first round's initiative (−6 for every combatant whose side bit is set, [Round start (`FUN_3aae_0000`)](#round-start-fun_3aae_0000)). `FUN_320c_007a` clears 0x6DCB right after the first round's initiative rolls, so it never applies again.
- With both bits set both sides take −6; this differs from "no surprise" only through the clamping to 0 (G says both-surprised behaves as neither; the code penalises both).
- Surprise also changes the pre-battle encounter menu, which is script-side ([ecl.md](ecl.md) `ENCOUNTER_MENU`).

### Battle start order (O, `FUN_34c7_1e31`)

1. "A battle begins..."; ECL 0x6E33 (party attacked allies) = 0; body count `DS:6715` = 0; ECL 0x6DC6 clamped to ≤ 100.
2. Grid and terrain (`FUN_34c7_1244`, then map-area or wilderness generator: [battlefield.md](battlefield.md)).
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

Each side is placed in a block of map squares ("square" = one map square, drawn as a slanted 7 × 5 parallelogram of cells, [battlefield.md, "Map areas: squares → cells (`FUN_34c7_0810`)"](battlefield.md#map-areas-squares--cells-fun_34c7_0810)). Placement uses square-local cells (col 0–10, row 0–5) converted to arena cells by

```
X = 22 + col + 6·bx + 5·by        Y = 10 + row + 5·by        // (bx, by) = square offset from the party's square
```

1. Count combatants in play per side. Front-line length `lim[s] = (in_play[s] + 1) / 2`.
2. Party block (0, 0). Enemy block = D squares in the facing direction, D = ECL 0x6DC1 (encounter distance 0–2, already clamped to the open squares ahead): `(dx8[f]·D, dy8[f]·D)` with `dx8 = 0,1,1,1,0,−1,−1,−1`, `dy8 = −1,−1,0,1,1,1,0,−1` (`DS:2736/273F`). Monsters therefore always start in front of the party, never at the sides or behind (G).
3. Orientation per side: F0 = facing / 2 for the party, F1 = the opposite for the enemy.
4. Allowed cells per side and ring: `allow[s][ring][row][col] = T[t][row].min ≤ col ≤ T[t][row].max`, with t = F[s] for rings 0, 2, 3 and t = 4 for ring 1. Table `DS:0306` (5 entries × 6 rows of [min, max]; [1, 0] = empty row; CotAB `DS:0310`, the same values; profile `T.placeAllow`):

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

**Scan for a free cell (`FUN_34c7_1577`, 0x261E7; CotAB 0x26010, the same code).** Fills lines across the square, front line first; each call restarts it (O, the state machine below):

- Line direction vectors on the slanted grid: `V[j]` = the 8-way direction `DS:02F2[j]` = 7, 2, 3, 6, i.e. `V0 = (−1,−1)` (map north), `V1 = (+1,0)`, `V2 = (+1,+1)` (map south), `V3 = (−1,0)`, with `d4 = DS:02E2[4·F + ring] / 2` selecting the orientation, recomputed at every candidate (`DS:02E2` = 00 00 02 06 | 02 02 00 04 | 04 04 02 06 | 06 06 04 00, indexed by F then ring).
- Line origin O (square-local): ring 0 columns {5, 4, 5, 6} and rows {3, 2, 2, 3} for d4 = 0–3; rings 1+: columns {3, 8, 7, 2}, rows {0, 2, 5, 3} (`DS:02F6`, `DS:02FE`).
- Line `step` starts at O + step·V[(d4+2) mod 4]; candidates: the origin (count := 1), then alternately origin + k·V[(d4+1) mod 4] and origin + k·V[(d4+3) mod 4] for k = 1, 2, …, the count raised for each before its tests.
- A candidate is **outside** when its column is outside 0–10 or its row outside 0–5 (0x263FE).
- A line ends (0x26429) when a candidate is outside in exactly one axis, or when the count reaches `lim[s]` in the scan's **first line** or exceeds 11 in any other. The first-line flag is set at the scan's start and cleared only when that line ends, so a ring entered before the first line ended still uses `lim`. The candidate that ends the line is still tried if it is not outside, so the front line holds `lim` combatants.
- When a line ends: step + 1; then the party side only (`DS:4658` = 0), facing east or west (F odd), ring 0, at step 1: the second line is skipped (step + 1, left empty) in the wilderness, or in a map area when any of the three edges of the party's square towards `DS:02D2[4·F + 1..3]` is not a wall (0x2646D–0x2651B).
- A candidate outside in **both** axes moves to the next ring at once, mid-line included (0x26542): the square behind (ring 1), then the two side squares (rings 2, 3), directions `DS:02D2[4·F + ring]` = F0: S, W, E; F1: W, S, N; F2: N, W, E; F3: E, N, S, each square the side's own square plus that direction. In a map area a ring is skipped when the edge of the **side's own square** (the party's map square plus the side's block offset) in that direction is a wall (`FUN_34c7_01ad` = 1; a door or open edge allows it). No ring left: fail.
- The tables are START.EXE's (profile `T.placeRing`, `placeOrient`, `placeVec`, `placeOriginX/Y`, `placeAllow`; CotAB at DS:02DC, 02EC, 02FC, 0300, 0308, 0310, the same values).
- The map-area test: PoR `DS:49FA` ≤ 1 (the area kind); CotAB `DS:4FD3` ≠ 3 (3 is the overland state, set when ECL 0x4BE6 = 0, [coab/assets.md](../coab/assets.md); I: that this is the same test as the map generator's ECL 0x4BE6).

**Cell test (`FUN_34c7_1434`).** The allow bit is set; no other combatant on the whole footprint (`FUN_577f_0cb9`); the worst ground cell under the footprint is not 0 (off the arena) and not impassable (`DS:2744[4·cell]` ≠ 0xFF). On success the position (`DS:5F27/5F28 + 4i`) is written and the allow bit cleared.

**Footprints** (`FUN_577f_0000`, table `DS:2844`): the position is the top-left cell; size 1 = 1 × 1, 2 = 1 wide × 2 tall, 3 = 2 wide × 1 tall, 4 = 2 × 2. A creature of size > 1 counts as Large for weapon damage.

Example, empty arena, 6 party members (O, simulated): facing N, front line (27,13) (28,13) (26,13), second line (28,14) (29,14) (27,14); facing S, front (27,12) (26,12) (28,12), second (26,11) (25,11) (27,11). Monsters at D = 1, facing N, 8 of them: (22,7) (21,7) (23,7) (20,7), then (21,6) (20,6) (22,6) (19,6). With D = 0 they share the party's square.

The party's order in the party list is its marching order: the first members take the front line (G: put the best-armoured fighters in the top half, the protected caster third from last).

### Combat icons (O)

Party members use icon slots 0–7 (c[0xBF], assigned on joining, [input-and-menus.md](input-and-menus.md)); monsters get slots from 8 up as `LOAD_MONSTER` loads their `CPIC` icons. Icons are drawn with the combatant's facing R[9] (`FUN_58af_04fc`). The terrain icon sets are `DUNGCOM`/`WILDCOM`/`RANDCOM` ([battlefield.md, "Cell table (O, `DS:2744`, 4 bytes per cell value)"](battlefield.md#cell-table-o-ds2744-4-bytes-per-cell-value)).

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
2. Primary attacks c[0x113] ([Attacks per round (O, `FUN_3aae_0d23`)](#attacks-per-round-o-fun_3aae_0d23)); secondary attacks c[0x114] = `half(event18(c[0xA2]))`.
3. R[5] = c[0x6B] (sweeps).
4. Initiative R[3]: if the combatant cannot act (c[0x10D] = 0) → 0. Else `d6 + DEX reaction adj` (`FUN_10ba_1168`), at least 1; then −6 if its side is surprised (bit `side+1` of ECL 0x6DCB); a value below 0 or above 20 becomes 0. Haste and Slow do not change initiative (G, consistent with code).
5. R[6] = movement in half-squares ([Movement points (O, `FUN_3aae_0123`)](#movement-points-o-fun_3aae_0123)).

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

1. Advance game time by one unit (`FUN_4b46_03D5(1,1)`); effect durations count down by 1, so effect durations in combat are in rounds (expiry callbacks run here, [effects.md](effects.md)).
2. Round counter `DS:6DE3` + 1 (a byte: it wraps after 255 rounds, G; anything keyed to round 0 then happens again).
3. Recompute the enemy side's remaining HP percentage (`FUN_3aae_2879`, used by morale).
4. For every combatant: effect event 19; Stinking Cloud check (`FUN_5216_0ae7`); if Dying: R[0xE] + 1, and at R[0xE] ≥ 10 status Dead.
5. If any party member is Dying: message "Your Teammate is Dying".
6. Recount sides; redraw. Done if either side has nobody in play.
7. If the party has someone in play and the enemy side has nobody: prompt "Continue Battle:"; Y keeps the battle going with no enemies (useful for bandaging, curing and buffing, G), anything else ends it. (`DS:49F4` would skip the prompt but is always 0: a demo flag never set, cleared at start-up `0x26FDB`; CotAB's DS:4FD5 does skip it in its demo, [`coab/ecl.md`, "Start-up menu and demo"](../coab/ecl.md#start-up-menu-and-demo-o).)

### Aftermath (`FUN_2e08_1527`)

All arithmetic is integer (longint). ECL variable 0x6DE3 (word B[0x5C6], "next battle gives no items") is unrelated to the round counter `DS:6DE3`.

Order (O):

1. ECL 0x6DC7 = 0, `DS:443A` = 0 ("enemies were beaten"), game mode 6.
2. Results (`FUN_2e08_04c9`), which also awards experience.
3. Cleanup (`FUN_2e08_11ac`).
4. If the party survived (or it was a duel): NPC shares (`FUN_2e08_12e8`), summary (`FUN_2e08_0916`), treasure menu (`FUN_2e08_0ecd`), then every item left in the treasure list is freed (lost). The money table `DS:67F4` is not cleared here (**?** whether coins left behind reappear in the next treasure).
5. Party destroyed: ECL 0x6DC7 = 0x80, "The END!", "The monsters rejoice for the party has been destroyed", "Press any key to continue".
6. Always: `DS:4A00` = 1 (0x1F6B1: the slow-text flag, below), and ECL 0x6E70, 0x6E71, 0x6E72, 0x6DE3, 0x6DE6 = 0. Scripts set them again before each `COMBAT`.

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
| fled | not defeated, nobody Okay/Animated, someone Running | Running → Okay; every other party entry (Unconscious, Dying, Dead, Stoned, Gone) is made current and removed from the party with all its items (`FUN_417f_3291`, party size − 1), which makes the entry before it current, or the new head when it was the first (SotSB 0x23CCC → 0x3CAA4, O) | 0x81 |
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

No level-cap check here (training enforces caps, [chargen-and-progression.md](chargen-and-progression.md)). The summary (`FUN_2e08_0916`) shows the share before the bonus or division: "The party has won." / "The party has fled." (shown as 0) / "The party has found Treasure!", or "You have won/lost the duel.", then "Each character receives N experience points." ("The duelist receives …"). Layout: a rope-framed window over the whole screen (`FUN_13f1_02e8`, cells 1–38 × 1–22, style 0), the outcome at row 1, the treasure line at row 3, "Each character receives N" at row 5 and "experience points." at row 7 (colour 10), then the bottom-line prompt "press <enter>/<return> to continue" (O).

#### Cleanup (O, `FUN_2e08_11ac`)

ECL 0x6DC8 = 0. Each entry that is a monster (R[0x13] = 1) or on side 1: if it is not in play, ECL 0x6DC8 + 1 (so 0x6DC8 counts enemies defeated or fled, I); then it is removed from the list with its items. Other entries just lose their combat record. A party member still charmed onto side 1 at this point is removed as an enemy, with its items (**Bug**): nothing ends charm before the cleanup, Charm Person (11) being undone only by its removal handler, on expiry or going down (O for the cleanup test; I for the absence: no removal of type 11 found elsewhere). Last, the head of the list becomes the current character (0x1F316: DS:5D92 := DS:5D96; CotAB 0x1EB96, DS:6520 := DS:6524; SotSB 0x24878, DS:7D38 := DS:7D3C), so after every battle the first member is current, whoever was current in it (O). When the party fled, the members left behind were removed one by one with the current set to each (0x1E757, `FUN_417f_3291`), which this overrides. The port does the same (`afterCleanup`, `rules/combat.ts`); a saved selection (DS:4430) that was removed becomes the head as well, where the original would keep a freed record (I; IMP-082).

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

If the combatant cannot act (c[0x10D] = 0) the turn ends. If a spell is queued in R[0], R[0] is cleared and the spell cast now (`FUN_4e53_0c20(spell, announce 1, auto 0)`, 0x22412, targets chosen at this moment), and the turn ends. R[0] is cleared **before** the cast, so damage the caster takes from its own spell (a bounced Lightning Bolt) loses nothing; the computer's turn does not clear it first ([combat-ai.md](combat-ai.md)). Otherwise the menu (`FUN_320c_0666`) repeats until an action ends the turn. Event 15 fires again each time the menu is built.

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
| Weapon hit or miss line | the line, sound 7 (hit) or 9 (all missed), then the message pause; no flash (see [combat-visuals.md](combat-visuals.md)) | speed × 225 ms |
| Sparkle / starburst | `FUN_10ba_1feb`: an effect took hold (speed + 1 cycles of 4 frames × 70 ms, sound 4) or spell/effect damage (one cycle, sound 3, then the pause) | (speed + 1) × 280 ms / 280 ms + speed × 225 ms |
| Before an attack | `3aae:1937` Delay(100) after the target is set | 100 ms |
| Step | each step plays the footstep (sound 10) in transient mode, which waits `delay(10)` before cutting it off ([sound.md](sound.md) §6); with sound off there is no wait, so the redraw sets the pace | ≈ 100 ms |
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
3. Cell 0 (outside the 25 × 50 arena): "Flee:" Y/N. Y → flee attempt ([Fleeing (O, `FUN_3aae_0c6a`)](#fleeing-o-fun_3aae_0c6a)); N → stay.
4. Cell movement byte `DS:2744[cell·4]` > R[6] → "Blocked" (the byte is 1 for open cells and 0xFF for obstacles, so this only rejects obstacles).
5. Otherwise: attacks of opportunity from enemies being left (`FUN_3aae_08b2`); if still in play, the step itself (`FUN_3aae_0712`); Stinking Cloud check; if now helpless, the turn ends.

When the loop ends with fewer than 2 half-squares left, R[6] = 0.

Melee by moving (`FUN_320c_0d45`): refused with "Not with that weapon" if a non-throwable ranged weapon is readied. Attacking an ally asks "Attack Ally:" (`FUN_3aae_2998`); confirming sets ECL 0x6E33 = 1 and makes allied NPCs hostile (G). A physical attack by an ally on a charmed creature breaks the charm (G). Then target = defender, sweep attempt ([Sweep (O, `FUN_3aae_0e82`)](#sweep-o-fun_3aae_0e82)); if no sweep, engage (`FUN_3aae_17f6`) and attack (`FUN_3aae_1884`).

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

**Manual** (`FUN_3aae_2dfa`): a cursor from the aimer moved with the arrow keys (48 N, 49 NE, 4D E, 51 SE, 50 S, 4F SW, 4B W, 47 NW), clamped to 0..49 × 0..24. Each move shows "Range = cost/2" when line of sight (range 0xFF, terrain on) reaches the cell, then "(Use Cursor keys)". A cell can be targeted when line of sight reaches it, ⌊cost/2⌋ ≤ rng, its movement byte ≠ 0xFF, and its occupant passes Can target; mode 1 also needs a combatant other than self and the missile rules above; an empty cell only with allowEmpty. The occupant (O, 0x2DA74–0x2DB03): the combatant on the cell (`DS:65B9` + 4·index); with none, on cell 0x1F, the body: the 7-byte records `DS:66D6` + 7i, i = 1..`DS:6715` (far pointer +0, x +4, y +5), the **last** one on the cursor's square, whatever its status (the loop does not stop at a match). So a spell (mode 0) can be aimed at a body; mode 1 refuses one (no combatant and cell 0x1F, 0x2DB84), so a weapon cannot. The port: `Battle.aimEntries` lists those bodies after the combatants, by distance, and `playerAim` leaves them unpicked. Enter or T confirms (mode 1 then runs Target); E or 0 exits; C centres.

### Target finder for the AI

`FUN_3aae_37e4`: see [combat-ai.md, "Target finder"](combat-ai.md#target-finder-o-fun_3aae_37e4char-range-skipcheck-forcenew).

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
3. A projectile animates to that square; sound 262A for Fireball (47), 2624 for Lightning Bolt (51), else 2618 ([sound.md](sound.md)).
4. Call the handler `DS:6B84[id]`. Outside combat, spells with byte 7 = 0 give "is a combat-only spell... Lose it?" (byte 7, not 11).

### Spell handlers in combat (O, segment 4e53 handler table)

- **Bless** (`0f4f`/`100f`): drop targets not on the caster's side and, for spell 1 only, any target with an enemy within 1 square. **Curse** (`1040`): enemies only, no adjacency rule.
- **Haste / Slow** (`2764`): the caster's side (Haste) or the enemy side (Slow), in list order (nearest the centre first), up to the caster's level in targets. A target holding the opposite effect loses its first record of it with "is Cured", said before the removal (`FUN_5216_1081`; Haste passes 0x2A, Slow 0x27), and is not affected, but uses a slot. Apply (`08c3`) then runs over the targets left, and only after it event 18 fires on each of them (stub `00b0:002f`): Haste's first call ages the target, and the doubled `DS:681A` is not kept (O, 2764–2882).
- **Sleep** (`151b`): pool = 4d4. Nearest first; cost by hit dice char[0x73]: 0–1 → 1, 2 → 2, 3 → 4, 4 → 6, 5 → 10 (race 0, else 20), ≥ 6 or negative → 20. Skip status 1 (animated) and creatures already under effect 0x35. Affect if pool ≥ cost, pool −= cost; smaller creatures later can still fit. All sides.
- **Hold Person** (`1658`): save bonus by number of targets: 1 → −2 (cleric spell 23) / −3 (magic-user spell 49); 2 → −1; 3–4 → 0. Immune (save forced) if char[0x9F] > 1 or char[0x6C] > 1 (which includes the large bit 0x80, contrary to the guide). Targets are processed last to first.
- **Stinking Cloud** (`1b11`): ignores the radius-1 list; the cloud covers the aimed square and its E, SE and S neighbours (`DS:290D` = {8, 2, 3, 4}), the aimed square being the upper left. The zone is a 19-byte record appended to the list at `DS:6DBB` (+0 owner, +4 next, +8 + i the cell found on square i, +0xC + i laid, +0x10/+0x11 the aimed square, +0x12 the number). Its number is the count of the caster's zones in the list **except the last one** (1b61: the loop stops at the node without a successor), so the first two zones both get 0; the caster gets 0x28 for L rounds, power number × 16 + L (byte), flag 1 (before the squares). A square holding a cell other than 0 whose movement byte (`DS:2744` + 4·cell) is not 0xFF is laid (0x1E). The cell kept for it is what was there, except: on a 0x1E square, the cell any other zone of the list found on a square of its own laid there, unless that is 0x1E (all zones looked at, the last match wins); on a 0x1F square, the cell of the last body record (`DS:66DA + 7n`) at that square. Then the line, the view, and each square's occupant (the combat map, also on unlaid squares) gets `FUN_5216_0ae7`, square by square (a 2×2 creature once per square it covers) (O, 1b11–1f34). The AI's friendly-fire test uses a 3×3 around the target, which does not match (I).
- **Fireball** (`266b`): level d6 (or `2·d3 + 1` d6 for spell 64), damage type 9, save for half. If ECL 0x49E6 = 0 (outdoors) the area is re-scanned at radius 2, else radius 3. The AI's test always uses 3. No "needs 3 enemies" rule exists in the code.
- **Lightning Bolt** (`2bb7` → `295b`): damage roll(L, 6) once; each creature hit saves vs spell (type 4) for half (`28bc`).
  1. Hit the creature on the aimed square.
  2. remaining = 2·len half-squares (`295b(len, dmg, save, bonus)` at 0x40E8B: Lightning Bolt passes 8, its roll, 4 and 1 at 0x4111A; the breath bolt of effect 88 10, max HP, 3 and 0); the line runs from the target square towards target + sign·(target − caster)·remaining.
  3. Step until a new creature, a cell 0 (stop), a cell with movement byte > 1, or cost ≥ remaining; hit the creature there.
  4. remaining −= the line's cumulative cost at each stop (bug: passing several creatures shortens the bolt).
  5. At a blocking cell the new origin is the wall cell and sign = −sign: the bolt comes straight back through the caster, not at the angle of incidence; the last-hit memory is cleared, so creatures can be hit twice.
  6. On the first bounce only, with `bonus`, if the wall-to-caster cost ≤ 8, 8 more half-squares are spent.
  7. The line walker (`FUN_46c1_01a0` init, `FUN_46c1_02cc` step) is Bresenham on the major axis: error 2·minor − major, a diagonal step when the error is ≥ 0 (so a tie goes diagonal first); the 26-byte record carries the cumulative cost as a byte (+2 straight, +3 diagonal). The step stops at the end point without moving.
  8. Every stop calls `28bc` on the cell reached, which hits whatever creature stands there (so a 2×2 creature can be hit again when the bolt stops on its second cell) and reports a bounce when the cell's movement byte is 0xFF. A cell value 0 (off the field) ends the bolt.
- **Magic Missile** (`1439`): damage `roll(L >> 1, 4) + (L >> 1)`, type 8, so a level-1 caster does 0 (the guide says (L+1)/2 × (1d4+1); confirm in play).

### Cast (O, `FUN_3aae_2414(var result, auto, spell)`)

Called by the player's Cast (0x224F2: auto 0, spell 0) and the computer's spell choice (0x2399B: auto 1, [combat-ai.md, "Spells and items"](combat-ai.md#spells-and-items-o-fun_3334_02ebc-spell-pri)); item Use does not come here, so items have no casting time.

1. No spell given: choose from the memorised list (`FUN_4894_299c`).
2. Spell byte 11 = 0 (camp only): "Camp Only Spell", nothing happens, result 0: the player's menu comes back, the computer's turn goes on to its weapons.
3. auto = 0: the screen is redrawn for the caster (`FUN_10ba_2b88`, `FUN_43e0_007f`, `FUN_10ba_09e3`).
4. `t` = casting time (byte 12) / 3. `t` = 0: cast now (`FUN_4e53_0c20(spell, 1, auto)`) and end the turn (`FUN_10ba_2637`).
5. Otherwise "Begins Casting", R[0] = spell, initiative R[3] −= `t` if it is above `t` (signed), else 1. Result 1: the turn ends but the combatant stays in the order ([Turn order (`FUN_320c_0131`)](#turn-order-fun_320c_0131)), so it is picked again once its lowered initiative is the highest left, at once if it still is. Then the player's turn ([Player turn (O, `FUN_320c_031a`)](#player-turn-o-fun_320c_031a)) or the computer's ([combat-ai.md](combat-ai.md)) casts the queued spell, its targets chosen then.
6. What stops it on the way:
   - Damage (weapon or spell, dmg > 0) clears R[1] and the queued spell: "lost a spell", and one copy is forgotten from the **current** character's list, not the caster's (**Bug**, [Hit points and status](#hit-points-and-status)). Nothing is cast and the caster, still with initiative, gets a normal turn later in the round, without Cast (R[1] = 0).
   - Anything that ends its turn through `FUN_10ba_2637` before it is picked again (Hold, Sleep, Snake Charm, effect 31 at event 7; going down, `FUN_577f_0e11`) clears R[0]: nothing is cast and the spell stays memorised.
   - Round start clears R[0] for everyone, but a caster always comes up again in the same round (its initiative is at least 1), so only those clear it in practice.
   - Fleeing, Delay and Guard cannot be chosen meanwhile: the next turn casts first.

#### The spell going off (O, `FUN_4e53_0c20(var result, announce, auto, spell)`)

In combat (DS:49F3 = 5):

1. Loop: if announce ≠ 0 and the spell is not from an item (DS:6DBF = 0): "*name* Casts a Spell" and "Spell: *spell*" (`FUN_4e53_331a`, whose verb argument "casts" is not shown in combat). Then the target hook (`DS:6B84` entry 0, `FUN_3aae_20c3` in combat) with `auto`: 1 lets the computer choose (see "AI targets" below), 0 the player's Aim.
2. Targets chosen: the caster turns and the bolt flies, `FUN_10b0_005c`, the spell is forgotten (`FUN_10ba_148b`, unless from an item), then its handler (`DS:6B84 + 4·id`, DS:681B = spell).
3. No target: auto = 0: "Abort Spell?"; Yes: "Spell Aborted", forgotten (unless from an item); **No: back to 1**, announced and aimed again. auto ≠ 0: "Spell Aborted" and forgotten at once.

The callers: the player's queued cast (announce 1, auto 0), Cast with `t` = 0 (1, the caller's auto), the computer's queued cast (1, 1), Use (`FUN_4894_1a8a`, 0x3A51D: announce 0, auto = the user's Quick flag c[0x10F], DS:6DBF = 1, so not forgotten either). AI targets for a friendly spell (byte 14 = 0, `FUN_3aae_20c3` 0x2C94B): the caster itself; for Cure Light Wounds (spell 3) the patient finder `FUN_3aae_1bf8` ([combat-ai.md, "Spells and items"](combat-ai.md#spells-and-items-o-fun_3334_02ebc-spell-pri)), and none means no target, so the spell is aborted. The spell leaves the memorised list only when it actually goes off or is aborted. Spell effects and targeting: [spells.md](spells.md).

### Turn undead

See [Turn undead (O, `FUN_3aae_116a`)](#turn-undead-o-fun_3aae_116a).

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

   `FUN_5216_0f06(char, status, msg)` (0x43066; CotAB 0x4BF57, stub `e3:5c`), taking a combatant off the
   field (O): nothing at all, the message included, for one already out of play; else the view scrolls to
   it (`577f_1298`), the message with its pause, in-play := 0, the status, HP := 0 unless the status is 3;
   its icon taken off and the field redrawn (no fall, no skull), the turn ended (`FUN_10ba_2637`), then
   going down (`FUN_5216_100a`, 0x43129). No event 13. Callers: this flight (0x2B7D1), the morale
   surrender (0x245B1, status 4) and effect 103 (0x29B26); CotAB 0x2B2F2 and 0x245D9.

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
   - backstab ([Backstab (O, `FUN_3aae_2574`)](#backstab-o-fun_3aae_2574)): `target[0x112] − 2`
   - else if target R[0xF] > 1, the direction from attacker to target equals the target's facing (attacker straight behind) and target R[0x12] > 4: from behind
   - from behind (by that test or by the caller): `target[0x112]`, else `target[0x111]`
6. Range penalty for missile weapons (`FUN_3aae_1b1e`): `band = (ITEMS[weapon][12] − 1) / 3`, d = distance: d > band → AC byte + 2; d > 2·band → a further + 3. With no ranged weapon nothing changes.
7. Attack type for messages: 0 normal, 1 from behind, 2 backstab.
8. For hand h = R[4] down to 1, while c[0x112+h] > 0 and the target is still in play: c[0x112+h] − 1, R[4] = h, attack count + 1, to-hit roll; on a hit (or if the target has become helpless) hit count + 1, damage (`FUN_3aae_0191`), apply ([Hit points and status](#hit-points-and-status)), then effect event h+1 (2 or 3, "after hit") on the attacker if the target is still in play.
9. No hit at all: "and Misses".
10. done = no attacks left in either hand; R[5] (sweeps) = 0.

### Backstab (O, `FUN_3aae_2574`)

(CotAB's differs: [coab/combat.md, "The backstab"](../coab/combat.md#the-backstab-o-0x2ce27-damage-0x2a6e2).) All of:

- attacker thief level c[0x9C] > 0
- no body armour, or armour item type 50 (Leather Armor). G also lists elven chain; the code accepts only type 50, and PoR has no elven chain at all (no name word of the 255 at DS:10BC and no item in any ITEM*.DAX or MON*ITM.DAX is one, O; CotAB's Elfin Chain Mail and its own rule: [coab/combat.md](../coab/combat.md))
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
| dwarf, gnome racial | effects 26, 18 by monster name ([effects.md](effects.md)) | O |
| side bonus | ECL 0x6E70 / 0x6E71, set by scripts per battle (e.g. Kobold Caves, G) | O |
| range | +2 / +5 AC at medium / long range | O |
| rear | rear AC (no DEX, no shield, −2), backstab −2 more | O |
| invisible target | −4 (effect 25 at event 16) | O |
| Bless, Curse, Prayer, Blindness, Bestow Curse | ±1, ±4 ([effects.md](effects.md)) | O |

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
2. If the target is out of play: "goes down", "and is Dying" or "is killed"; effects that end at 0 HP are removed (`FUN_5216_100a`: the first record of each of DS:0C14[1..16] = 7, 11, 30, 31, 32, 51, 52, 53, 54, 58, 59, 95, 98, 137, 74, 75, in that order, through `FUN_5216_0026` with a null record, O); effect event 13; fall graphic (`FUN_577f_0e11`: the skull, COMSPR 11, over every footprint cell (see [combat-visuals.md](combat-visuals.md)), sound 5 and the message pause; a party entry, R[0x13] = 0, then lies there as a body, its cell set to 0x1F unless it is a cloud 0x1E and the old cell kept in `DS:66D6 + 7n`; a monster leaves nothing, the redraw removes the picture), initiative, movement, queued spell and guard cleared (`FUN_577f_0e11`).

Non-weapon damage (spells, traps, effects) goes through `FUN_5216_1344`, which fires event 6 (damage type in `DS:6819`), halves or zeroes on a save, and applies the same thresholds ([effects.md](effects.md)).

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

Character bytes 0x6D–0x71 hold save targets: death/poison/paralysis, petrification/polymorph, rod/staff/wand, breath weapon, spell (tables in [chargen-and-progression.md](chargen-and-progression.md)).

```
r = d20
if r == 1: fail;  if r == 20: succeed            // before any modifier
DS:6816 = r + char[0x101] + bonus; DS:682A = type
effects(char, 12)                                 // may change DS:6816
success if char[0x6D + type] <= DS:6816
```

## Effects hook (O, `FUN_5216_02fa(char, event)`)

A switch over 20 event codes, each firing a fixed list of effect types (targeting, after hit, damage, turn start, effect added, to-hit, saving throw, death, morale, rate, round end). Full event table and all handlers in [effects.md](effects.md).

## Combat statistics (O, `FUN_10ba_0bb8`)

The statistics routine and the ability adjustments it uses (STR to-hit and damage, DEX AC, DEX reaction for initiative and missile to-hit) are described once, in [records.md, "Derived statistics"](records.md#derived-statistics-o-fun_10ba_0bb8). In combat it runs at the start of every turn, before every attack on the target, and whenever equipment or effects change.

## Turn undead (O, `FUN_3aae_116a`)

1. "turns undead..."; R[0x11] = 1 (once per battle).
2. `count` = d12, `minimum` = 6, `r` = d20 (one roll for the whole attempt).
3. Column: cleric level c[0x96] 1–8 → that level; 9–13 → 9; anything else → 10.
4. Repeat while a target exists, `count` > 0 and nothing has failed:
   - target (`FUN_3aae_1351`): among enemies in sight (`FUN_10ba_2433(c, 255)`), not already turned (R[0x10] = 0), with undead type c[0x76] > 0, the lowest type; ties go to the first in the sight list (I: nearest first)
   - `v = DS:0447[type · 10 + column]`; `r < |v|` → failure, stop
   - `v ≥ 1`: "is turned", R[0x10] = 1 (it flees, [combat-ai.md](combat-ai.md)); `v ≤ 0`: "Is destroyed", status Gone (8), out of play
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

## Known original bugs affecting combat

A conforming build reproduces these unless part C specifies a departure (O unless marked).

| Bug | Where |
|---|---|
| Interrupting a spell removes the spell from the attacker's memorised list, not the caster's; the caster keeps it | `FUN_3aae_02f9` → `FUN_10ba_148b` |
| A negative damage total wraps to 255 (I) | `FUN_3aae_0191` |
| Protection from Evil/Good −2 to hit is overwritten (only the save bonus works) | [effects.md](effects.md) |
| Mirror Image absorbs only targeted spells, never weapons | [effects.md](effects.md) |
| Haste/Slow shown reversed on the character sheet (combat uses the right values) | [effects.md](effects.md) |
| A diagonal step with exactly 2 half-squares left forfeits the remaining movement | `FUN_3aae_0712` |
| Opportunity attackers get one attack even when they have none left | `FUN_3aae_08b2` |
| Round counter is a byte; round-0 rules recur after 256 rounds (G) | `DS:6DE3` |
| Elf bow bonus misses the Fine Composite Long Bow; racial name lists miss GOBLIN GUARD, HOBGOBLIN LDR, GRISHNAK (G, O for the elf list) | `FUN_10ba_0000`, effects 18/26 |
| Experience divisor can be 0 (crash) when only Animated members remain (I) | `FUN_2e08_0000` |
| NPC treasure share truncated to 8 bits; Share truncated to 16 bits; "takes and hides his share" shown even when nothing was taken | `FUN_2e08_12e8`, `FUN_4c2d_063a` |
| Monsters drop their remembered party target every pass of the attack loop (side test inverted, I) | `FUN_3334_0b3c` |
| AI Cure Light Wounds accepted whenever an enemy is adjacent, even with nobody wounded; it is then begun and aborted ("Spell Aborted", forgotten) | `FUN_3334_02eb`, `FUN_3aae_20c3` |
| The computer's queued spell goes off with R[0] still set, so damage from its own spell ("lost a spell") costs it a second copy; the player's turn clears R[0] first | `FUN_3334_000f` 0x2347C, `FUN_320c_031a` 0x22412 |
| Script-placed treasure items give experience unless something was thrown in the battle (I) | `FUN_2e08_0000` |
| Results loops read the next pointer of a record they just freed | `FUN_2e08_04c9` |
| Bodies: `FUN_577f_10a7` restores the saved cell at the new position (I) | `FUN_577f_10a7` |

## Open

- ~~Where the treasure money table `DS:67F4` is cleared~~: by FillChar(DS:67F4, 0x1C, 0) in CLEAR_MONSTERS (opcode 0x1C, 0x1AEA6), on entering a temple (0x1DE66) and a shop (0x1FC5C); never after a battle, whose aftermath adds to it (0x1E136) (O).
- ~~`DS:4A00` set after every battle~~: the slow-text flag: its only reader, the text writer's character loop (0x777B), waits `Delay(DS:49E2 × 10)` ms a character while it is set; set by PRINT_CLEAR (0x1A64D) and ENCOUNTER_MENU (0x1BB39) while they print, after a battle (0x1F6B1) and at start-up (0x26FB1), and cleared when those two finish (0x1A6C6, 0x1C1CA), so after a battle the next text prints letter by letter (O). The port prints at once (part C).
- ~~Whether elven chain counts as leather for backstabs~~: PoR has none (above, O). ~~Whether charm is undone before the post-battle cleanup~~: no ("Cleanup", **Bug**).
- ~~Overland tile meanings~~: [battlefield.md, "Terrain flags"](battlefield.md#terrain-flags-o-fun_34c7_08a4) (I, from the art).

Answered since the first draft: spell targeting and area templates ("Aim": the picker `FUN_3aae_1e16` and the scan `FUN_56c1_0909`; "Spell targets", `FUN_3aae_20c3`) and the per-spell effects in combat ("Spell handlers in combat"; [spells.md](spells.md), "Per spell").
