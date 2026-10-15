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

## Saving throws (O)

Character bytes 0x6D–0x71 hold save targets: death/poison/paralysis, petrification/polymorph, rod/staff/wand, breath weapon, spell (tables in [[spec/progression]]). Roll (`FUN_5216_0d63`): `DS:6816 = d20 + char[0x101] + bonus`, effect hook 12 may modify it; success if `char[0x6D + type] ≤ DS:6816`.

## Effects hook (O, `FUN_5216_02fa(char, event)`)

A switch over 20 event codes, each firing a fixed list of effect types (targeting, after hit, damage, turn start, effect added, to-hit, saving throw, death, morale, rate, round end). Full event table and all handlers in [[spec/effects]]. The saving-throw roll is `DS:6816 = d20 + char[0x101] + bonus`, success if `save ≤ roll`.

## Combat statistics (O, `FUN_10ba_0bb8`)

Recomputed whenever equipment or effects change:

1. Clear the 13 readied-item pointers (char[0xCC + 4·slot]); walk the item list: count items (char[0xC7]); encumbrance char[0x102] = Σ weight × max(1, count) + Σ coins; for readied items (item[0x34]): slot = `ITEMS[type][0]` (0–8 → char[0xCC + 4·slot]; 9 = ring → char[0xF0] then [0xF4]); arrows (type 73) → char[0xF8], quarrels (type 28) → char[0xFC]; hands used += `ITEMS[type][1]`
2. A readied item with name word n1 = 0xBA (Bag of Holding) reduces encumbrance by 5000, not below the weight of readied items
3. Copy base values: damage dice char[0x115..0x11A] ← natural attack char[0xA3..0xA8] (count/sides/bonus per hand; 1d2 unarmed by default); AC char[0x111] ← char[0xA9]; movement char[0x11C] ← char[0x72]; 60−THAC0 char[0x110] ← char[0x2D]
4. AC components: DEX (`FUN_10ba_10e6`), armour, shield, rings etc. (`FUN_10ba_0282` per readied item); weapons apply dice/bonuses (`FUN_10ba_01fb`); unarmed adds STR to-hit (`FUN_10ba_1282`) and damage (`FUN_10ba_1325`)
5. char[0x111] = Σ components (with the base/armour component the maximum of the two); **rear AC** char[0x112] = armour + magic components − 2 (no DEX, no shield)
6. char[0x6B] = fighter level, or 1 for non-fighters and monsters (copied to combat record [5])

### Ability adjustments (O)

STR to-hit (`FUN_10ba_1282`, only if char[0xAA] is set, i.e. not monsters), on the combined strength index from `FUN_10ba_11ea` (3–18, then 18/xx bands, then giant strength): ≤3 → −3, 4–5 → −2, 6–7 → −1, 8–16 → 0, 17–19 → +1, 20–22 → +2, 23–25 → +3, 26–27 → +4, 28–30 → +5/+6/+7 (AD&D STR table).

DEX, in "60 − AC" units (higher is better) (`FUN_10ba_10e6`): ≤3 → −4, 4–6 → −3/−2/−1, 7–14 → 0, 15–18 → +1…+4, 19–20 → +4, 21–23 → +5, 24–25 → +6.

DEX reaction, added to initiative (`FUN_10ba_1168`): <3 → −4, 3–5 → −3…−1, 6–15 → 0, 16–18 → +1…+3, 19–20 → +3, 21–23 → +4, 24–25 → +5.

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

## Player turn (O, `FUN_320c_031a`)

If the combatant cannot act (char[0x10D] = 0) the turn ends. If a spell is queued in combat record [0], it is cast now (`FUN_4e53_0c20`) and the turn ends. Otherwise the menu (`FUN_320c_0666`) repeats until an action ends the turn:

| Key | Action | Routine |
|---|---|---|
| M | Move | `FUN_320c_09df` |
| V | View character (ready/swap items; recomputes attacks) | `FUN_4894_0ab3` |
| A | Aim: choose target and attack | `FUN_3aae_3558` |
| U | Use item | `FUN_4894_0ef8` |
| C | Cast spell | `FUN_3aae_2414` |
| T | Turn undead | `FUN_3aae_116a` |
| Q | Quick: set char[0x10F] and let the AI play this turn | `FUN_320c_122b`, `FUN_3334_000f` |
| D | Delay | `FUN_320c_0e45` |
| 2 | Toggle "magic on/off" for auto characters (`DS:6E30`) | |
| Space | Clear quick mode for all non-NPC members | |
| Ctrl-P (0x10) | Quick mode for everyone, end turn | |
| − | `FUN_3aae_3b93` (**?**) | |

## Turn undead (O, `FUN_3aae_116a`)

- One d20 roll `r` for the whole attempt; up to **d12** undead affected (AD&D uses 2d6); combat record [0x11] = 1 (cleric has turned this battle)
- Column = cleric level 1–8; 9–13 → 9; 14+ → 10
- Targets chosen by `FUN_3aae_1351` (nearest undead, **I**); for each: `v = DS:0447[undead_type · 10 + column]` with undead type = char[0x76]
  - `r < |v|` → stop (failure)
  - `v ≥ 1` → turned: combat record [0x10] = 1 (flees), message
  - `v ≤ 0` → destroyed: status 8, cannot act
- "Nothing happens" message if no target was affected

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

T = value 1 (automatic turn), D = 0, D* = −1 (both automatic destroy), – = 99 (impossible). Matches the AD&D 1st edition table (types 1–10 = skeleton … vampire, **I**).

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

If combat record [1] is set: collect the non-zero memorised spells in char[0x17..0x2B] (21 slots). Allowed for monsters/NPCs, or for party members when magic is on. Up to d7 passes × 3 random picks with falling priority; first spell accepted by `FUN_3334_02eb` is cast (`FUN_3aae_2414`).

### Weapon choice (`FUN_3334_13ca`)

- Free hands char[0x100] are reduced by hands used by readied weapon (char[0xCC]) and shield (char[0xD0])
- Scan carried items usable by class (`ITEMS[t][13] & char[0xB0]`): weapons (slot 0) scored by `FUN_3334_128d`; ranged weapons are those with `ITEMS[t][14]` bit 0x08 (needs ammo: bit 0x01 arrows from char[0xF8], 0x80 quarrels from char[0xFC]) or 0x10 (thrown); shields (slot 1) scored by plus
- Natural attack score = char[0xA5] × char[0xA3] (+ 2 × char[0xA7] if positive)
- Prefer the best ranged weapon if it beats half the best melee score, has ammo, and no enemy is adjacent; ready it (`FUN_4894_14d0`); ready a shield if hands allow

### Melee / missile loop (`FUN_3334_0b3c`)

Effect hook 14; up to 20 attempts: keep the current target (combat record [10..13]) if it is still a valid enemy and in line of sight and within weapon range (`FUN_56c1_0422`, below), else pick a random nearby enemy (`DS:6DE4` list); step towards it (`FUN_3334_07f2`) or attack it (`FUN_3aae_1884` → attack sequence). Missile users avoid shooting when an enemy is adjacent.

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

For every map square at `(X+dx, Y+dy)`, `dx ∈ −6..6`, `dy ∈ −2..2` (X, Y = party position; north is up):

```
col = dx·6 + dy·5 + 21 + c      // c = 0..6
row = dy·5 + 10 + r             // r = 0..4
grid[row][col] = icon + 1       // only if 0 ≤ col < 50 and 0 ≤ row < 25
```

The `+dy·5` skew produces the slanted Gold Box combat view; adjacent squares share a column.

Each square edge is classified by `FUN_34c7_012b`/`01ad` (both sides of the edge, OR-ed): **0 open, 1 wall, 3 door** (passage value 0 → wall; wall present but passable → door). Off-map edges are walls, except east/west edges on the party's own row. `FUN_34c7_02ba`, `0377`, `040f`, `0615` stamp floor (icon 0x16), wall and door pieces into the block according to the west/north/east edge classes and the neighbouring squares (piece ids are listed in those routines).

Finishing pass (`FUN_34c7_0000`): on every open-ground cell (image slot `DS:2747[cell·4]` = 0x16) roll d100: 98 → rocks 0x1A, 99 → rocks 0x1B, 100 → (if the current area ≠ 10 and another d100 = 1) d10 ≤ 6 → bone 0x1C, 7–10 → potted flower 0x1D. Wilderness battlefields run this pass too.

## Still open

- Overland tile meanings (which ids are roads, towns, water), to label the flag table
- Player combat menu and actions (`FUN_320c_031a`)
- AI scoring helpers (`FUN_3334_02eb`, `FUN_3334_128d`) and movement step (`FUN_3334_07f2`)
- Spell casting and spell effects (spell list in character bytes 0x18–0x69, **I**)
- Experience and treasure awards after combat
