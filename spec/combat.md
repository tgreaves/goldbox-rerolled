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
bonus = attacker[0x10E] ? B[0x6E0] : B[0x6E2]    // per-side modifier (word array B byte offsets 0x6E0/0x6E2); cleared after every battle, so set by scripts per encounter
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

## Battle flow (O)

Entry: ECL `COMBAT` → `FUN_29c3_179b` → battle `FUN_320c_007a` → aftermath `FUN_2e08_1527`.

```
setup battlefield and place combatants            // FUN_34c7_1e31 (?)
done = (party count DS:6814 == 0 or monster count DS:6815 == 0)
while not done:
    for each combatant c: round_start(c)          // FUN_3aae_0000
    while (c = pick_next()): take_turn(c)          // FUN_320c_0131, FUN_320c_01f6
    round_end(&done)                               // FUN_320c_0880
cleanup                                            // FUN_320c_0000
```

Each combatant has a 22-byte combat record at char+0x108 (fields: [3] initiative, [4] current attack hand, [5] copy of char[0x6B], [6] moves, [0xE] dying counter, [0x13] = 1 for monsters; others **?**).

### Round start (`FUN_3aae_0000`)

- Reset per-round attack counts (`FUN_3aae_0d23`), effect hook 18
- Initiative: `0` if the combatant cannot act (char[0x10D] = 0); else `d6 + mod` (`FUN_10ba_1168`, **I** DEX reaction), minimum 1; **−6 if its side is surprised** (bit `side+1` of B word at byte offset 0x596, i.e. ECL 0x6DCB set by `SURPRISE`); values < 0 or > 20 become 0

### Turn order (`FUN_320c_0131`)

Next combatant = highest initiative > 0; ties broken by a fresh d100 roll each pick.

### Turn (`FUN_320c_01f6`)

Effect hooks 7 and 15; then the player's combat menu (`FUN_320c_031a`) or, if char[0x10F] ≠ 0, the computer AI (`FUN_3334_000f`).

### Round end (`FUN_320c_0880`)

Delay (`FUN_4B46_03D5`, same as ECL 0x34), round counter `DS:6DE3` +1, `FUN_3aae_2879` (**?**), effect hook 19 and `FUN_5216_0ae7` for every combatant; a **Dying** combatant becomes **Dead** after 10 rounds. Battle ends when either side has no one left (with a yes/no prompt in one case, **?**).

### Aftermath (`FUN_2e08_1527`)

1. `FUN_2e08_04c9`: decide survival; Running → Okay, Dying → Unconscious, Unconscious with HP > 0 → Okay; total experience into `DS:84D6` (`FUN_2e08_0000`) and distribute (`FUN_2e08_0355`)
2. `FUN_2e08_11ac`: remove monsters from the shared list
3. `FUN_2e08_12e8`: NPCs (char[0x84] ≥ 0x80) take a share of the money table (shares = char[0x85] & 7)
4. `FUN_2e08_0916`: experience message; `FUN_2e08_0ecd`: treasure menu (View, Take, Pool, Share, Detect, Exit)
5. If the party was destroyed: "The monsters rejoice for the party has been destroyed"

## Computer-controlled combatants (O, `FUN_3334_000f`)

Used for monsters, NPCs and party members in quick-combat (char[0x10F] ≠ 0).

```
if key pressed (FUN_3334_0fc1):
    '2'   toggle "magic on/off" for auto party members (DS:6E30)
    space return control: char[0x10F] = 0 for every non-NPC, non-animated party member; end this turn
    '-'   FUN_3aae_3b93 (?)
C[0x15] = movement preference: kept unless 0 or > 4 or 1-in-4; else d8 == 8 ? 4 + d2 : d4
morale check (FUN_3334_10d7)                    → may flee / surrender
if C[0] (queued spell): cast it (FUN_4e53_0c20)
elif use magic item (FUN_3334_03e4)
elif turn undead (FUN_3334_0203)
elif cast spell (FUN_3334_0545)
else:
    choose and ready weapons (FUN_3334_13ca)
    repeat until turn over:
        if target reachable this turn (FUN_3aae_37e4): melee/missile loop (FUN_3334_0b3c)
        else: move or guard (FUN_3334_0f4f)
```

### Morale (`FUN_3334_10d7`), monsters and NPCs only (char[0x84] ≥ 0x80)

1. `m = (char[0x84] & 0x7F) * 2`, 0 if > 102; effect hook 17 may change it
2. If `m < 100 − 100·HP/maxHP` or `m == 0`: second check against a side-wide value (`DS:6E2F`, hook 17) and `100 − B[0x58C]`; if it fails (or the combatant is a monster):
   - outnumbered (`FUN_3aae_2908` > moves/2) and INT (char[0x11]) > 5 → message and end turn (**I** surrender)
   - otherwise **flee**: combat record [0x14] = 1, add effects 0x4A and 0x4B

### Magic items (`FUN_3334_03e4`)

Only if combat record [2] is set, enemies remain, and area flag `A[0x1CA]` is 0. Up to d7 passes with falling priority (7, 6, …) over carried items whose spell byte (item[0x3D], minus 0x17 if > 0x38) is usable, item[0x3E] < 0x80 and readied (item[0x34]); `FUN_3334_02eb(priority, spell)` decides. Use via `FUN_4894_1a8a`.

### Turn undead (`FUN_3334_0203`)

If combat record [0x11] = 0, cleric level (char[0x96]) > 0 and `FUN_3aae_1351` finds targets → `FUN_3aae_116a`.

### Spells (`FUN_3334_0545`)

If combat record [1] is set: collect the non-zero memorised spells in char[0x18..0x2C] (21 slots). Allowed for monsters/NPCs, or for party members when magic is on. Up to d7 passes × 3 random picks with falling priority; first spell accepted by `FUN_3334_02eb` is cast (`FUN_3aae_2414`).

### Weapon choice (`FUN_3334_13ca`)

- Free hands char[0x100] are reduced by hands used by readied weapon (char[0xCC]) and shield (char[0xD0])
- Scan carried items usable by class (`ITEMS[t][13] & char[0xB0]`): weapons (slot 0) scored by `FUN_3334_128d`; ranged weapons are those with `ITEMS[t][14]` bit 0x08 (needs ammo: bit 0x01 arrows from char[0xF8], 0x80 quarrels from char[0xFC]) or 0x10 (thrown); shields (slot 1) scored by plus
- Natural attack score = char[0xA5] × char[0xA3] (+ 2 × char[0xA7] if positive)
- Prefer the best ranged weapon if it beats half the best melee score, has ammo, and no enemy is adjacent; ready it (`FUN_4894_14d0`); ready a shield if hands allow

### Melee / missile loop (`FUN_3334_0b3c`)

Effect hook 14; up to 20 attempts: keep the current target (combat record [10..13]) if it is still a valid enemy and reachable by path-finding (`FUN_56c1_0422` on the battlefield map `DS:6716`) within weapon range, else pick a random nearby enemy (`DS:6DE4` list); step towards it (`FUN_3334_07f2`) or attack it (`FUN_3aae_1884` → attack sequence). Missile users avoid shooting when an enemy is adjacent.

## Battlefield (O, `FUN_34c7_1e31`)

1. Load combat icon set: `DUNGCOM` when `DS:49FA` = 1 (map area), otherwise `WILDCOM`/`RANDCOM` (`FUN_34c7_1244`)
2. Allocate the grid: 0x4E9 bytes = 7-byte header + **25 rows × 50 columns** (`cell = grid[7 + row·50 + col]`); header [2],[3] = view origin (first party member's position − 3)
3. Build terrain: map areas `FUN_34c7_0810`, wilderness `FUN_34c7_11b4` (**?**)
4. Create a 22-byte combat record per list entry (`FUN_34c7_12e1`); entries after the first `B[0x67C]` (party size) are monsters (record [0x13] = 1); record [9] = facing from `DS:02F2[party facing / 2]`, monsters face the opposite way; monsters with morale byte 0 or > 102 get `B[0x58C]` (encounter morale) + NPC bit
5. Place combatants (`FUN_34c7_19f5`): deployment zones per side from `DS:0306` (12 bytes per direction: 6 rows of [min col, max col]); `FUN_34c7_1577` finds a free spot; a monster that cannot be placed is removed; party members who cannot act are laid down as bodies (cell set to 0x1F, original cell remembered in `DS:66D6`)
6. Effect hook 8 for everyone, `FUN_3aae_2879`, game mode `DS:49F3` = 5

### Map areas: squares → cells (`FUN_34c7_0810`)

For every map square at `(X+dx, Y+dy)`, `dx ∈ −6..6`, `dy ∈ −2..2` (X, Y = party position; north is up):

```
col = dx·6 + dy·5 + 21 + c      // c = 0..6
row = dy·5 + 10 + r             // r = 0..4
grid[row][col] = icon + 1       // only if 0 ≤ col < 50 and 0 ≤ row < 25
```

The `+dy·5` skew produces the slanted Gold Box combat view; adjacent squares share a column.

Each square edge is classified by `FUN_34c7_012b`/`01ad` (both sides of the edge, OR-ed): **0 open, 1 wall, 3 door** (passage value 0 → wall; wall present but passable → door). Off-map edges are walls, except east/west edges on the party's own row. `FUN_34c7_02ba`, `0377`, `040f`, `0615` stamp floor (icon 0x16), wall and door pieces into the block according to the west/north/east edge classes and the neighbouring squares (piece ids are listed in those routines).

Finishing pass (`FUN_34c7_0000`): on every floor cell (icon property `DS:2747[icon·4] == 0x16`) roll d100: 98 → icon 0x1A, 99 → 0x1B, 100 → (if area type ≠ 10 and another d100 = 1) d10 ≤ 6 → 0x1C, 7–10 → 0x1D.

## Still open

- Wilderness terrain generator (`FUN_34c7_11b4`); icon property table `DS:2747`; path-finding (`FUN_56c1_0422`)
- Player combat menu and actions (`FUN_320c_031a`)
- AI scoring helpers (`FUN_3334_02eb`, `FUN_3334_128d`) and movement step (`FUN_3334_07f2`)
- Spell casting and spell effects (spell list in character bytes 0x18–0x69, **I**)
- Experience and treasure awards after combat
- Saving throw roll, effect types
