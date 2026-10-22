# Parametric procedures

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

Each rules procedure whose games differ is stated **once** here, with its parameters; the game's
profile holds the parameters (`rules` = `GameRules` unless another module is named) and, for each
game, the routine of the original they come from. What the procedure does in the original, step by
step, is part A; where this file says "as part A", it adds only how the parameters enter. All
parameter values are kind **C** ([profile.md §1.1](profile.md#11-where-a-value-comes-from)) unless
marked.

Conventions: `L` is a class level, read as a signed byte; `roll(n, s)` and `dN` are requests to the
dice source in the order written ([host-contracts.md §6](host-contracts.md#6-randomness-the-dice-source));
"as a byte" means the result is taken modulo 256 at that point, as the original stores it.

## 1. Spell slots

**Original:** PoR `FUN_51cf_0000` (absolute tables), CotAB 0x50480 (summed increments)
([engine/chargen-and-progression.md, "Spell slots"](../A-games/engine/chargen-and-progression.md#spell-slots-spell-levels-1--2--3),
[coab/tables.md §3.5](../A-games/coab/tables.md#35-spell-slots-o-fun-at-50480)).
Run by the derived-statistics routine after creation, training, a level drain or restore, an import
and Ready/Unready.

Parameters (`slots`):

| Parameter | Meaning |
|---|---|
| `clear` | every slot of every pool is set to 0 first |
| `sources[]` | in order: `cls` (base class), `table` (`clericSlots`, `muSlots`, `paladinSlots`, `rangerSlots` of the table map), `from` (first table row used), `first` (one first-level slot when the class has a level), `add` (rows are added, else the class's own level's row is set), `columns[]` (table column *k* + 1 → `{ pool: cleric \| druid \| mu, level }`) |
| `wisdom` | `afterCleric`: the WIS bonus right after the source of class 0, so the paladin's rows (a later source) never get it (both games: PoR `FUN_51cf_01af`, CotAB 0x50568 → 0x50AF6, which returns at once without a cleric level) |
| `learn[]` | `{ classes, spellClass, all }`: when any of `classes` has a level, the spells of `spellClass` become known: all of them (`all`), or those whose level has a slot |
| `doubler` | `{ effect, levels }`: a readied item whose +0x3E equals `effect` doubles the magic-user slots of levels 1..`levels` (as a byte); null: none |

Procedure:

```
if clear: every pool's slotLevels bytes := 0
for src in sources:
    L := (former levels count (§4) and prevLevels[src.cls] ≠ 0) ? prevLevels[src.cls] : levels[src.cls]   (signed)
    if L ≤ 0: next source
    if src.first: pool(src.columns[0].pool)[level 1] += 1
    if L < src.from: next source                       (no WIS bonus after it either)
    for row in (src.add ? src.from .. L : L .. L):
        for k, col in src.columns:
            v := T[src.table][row · row size + k + 1]
            slot := pool(col.pool)[col.level]
            slot := src.add ? (slot + v) as a byte : v
    if src.cls = 0 and wisdom = afterCleric: WIS bonus
for l in learn: if any class of l.classes has a level:
    for id in 1 .. spells.named with spell class l.spellClass (record byte 0):
        known[id] := 1 if l.all, or if the slots of its class and level (record byte 1) > 0
if doubler: for each readied item with +0x3E = doubler.effect: muSlots[1..levels] := ×2 as a byte
```

The WIS bonus is `wisBonus`, [WIS above, cleric level] steps, each adding a slot of that level if it
already has one: PoR (`FUN_51cf_01af`) [12, 1], [13, 1], [14, 2], [15, 2], [16, 3]; CotAB (0x50AF6) the
same and [17, 4]. A pool missing from the
game (`druidSlots` = −1) is never named by its sources. The slot array of a spell class is the one
whose code `rules.spells` gives (cleric, druid, magic-user); a class code without a pool has no
slots.

| Game | Values |
|---|---|
| PoR | clear false; sources: cleric `clericSlots` from 2, first false, set, columns cleric 1–3; magic-user (5) `muSlots` from 2, first false, set, columns mu 1–3; wisdom afterCleric; learn: classes [0] cleric, with slots; doubler null |
| CotAB | clear true; sources: cleric `clericSlots` from 2, first, add, cleric 1–5; paladin (3) `paladinSlots` from 9, add, cleric 1–5; ranger (4) `rangerSlots` from 8, add, columns druid 1, druid 2, druid 3, mu 1, mu 2; magic-user (5) `muSlots` from 2, first, add, mu 1–5; wisdom afterCleric; learn: classes [0, 3] cleric with slots, classes [4] druid all; doubler { effect 0x81, levels 3 } (Ring of Wizardry, 0x507C3) |

*Known gap:* CotAB's cleric learning skips spell 36 (Animate Dead), which is class 3 in CotAB and
so never matches; the rule needs no exception. Creation's level-1 slots are set by the creation
sequence of part A for the cleric and magic-user classes (one first-level slot each); the reference
implementation names those two classes in code (0 and 5), which holds for both games.

## 2. Hit points

**Original:** PoR creation `FUN_417f_4235` and training `FUN_417f_29ae`; CotAB 0x3B230 (called by
creation 0x389FB and training 0x3BE67) ([engine/chargen-and-progression.md, "Hit points per level"](../A-games/engine/chargen-and-progression.md#hit-points-per-level-o),
[coab/tables.md §3.4](../A-games/coab/tables.md#34-hit-points-o-fun-at-3b230-called-by-chargen-at-389fb-and-by-training-at-3be67)).

Parameters (`hitPoints`): `laterDice` (the dice count after level 1, null: the class's count every
level), `rolls` (roll the dice this many times and keep the best), `firstLevelMin` ([a, b]: at level 1
at least ⌊sides · a / b⌋; null: no minimum), `fixed` (per base class, the amount from the class's
stop level `T.hitDiceStop`; null: never fixed).

The **hit-dice roll** for a list of base classes (ascending):

```
sum := 0
for k in classes:
    L := levels[k]
    if fixed ≠ null and T.hitDiceStop present and L ≥ hitDiceStop[k]:
        sum := fixed[k]                        (replaces the sum so far: CotAB's quirk, O)
        next class
    n := (L > 1 and laterDice ≠ null) ? laterDice : hitDiceCount[k];  s := hitDiceSides[k]
    r := roll(n, s);  repeat rolls − 1 times: r := max(r, roll(n, s))
    if firstLevelMin and L = 1: r := max(r, ⌊s · a / b⌋)
    sum += r
```

Creation rolls for every class the character has, then applies CON and divides by the number of
classes as part A says. Training rolls for the classes that went up: the rolled HP (`hpRolled`)
gains max(1, ⌊rolled / k⌋) and the maximum gains max(1, ⌊(rolled + CON bonus) / k⌋), *k* the number
of classes with a level before training, the wound kept (maximum − current unchanged).

| Game | Values |
|---|---|
| PoR | laterDice null, rolls 1, firstLevelMin [2, 3], fixed null |
| CotAB | laterDice 1, rolls 2, firstLevelMin null, fixed [2, 2, 3, 3, 2, 1, 2, 2] (cleric, druid **I**, fighter, paladin, ranger, magic-user, thief, monk **I**) |

The CON bonus (`T.conHp`, with the fighter's extra points at CON 17 and 18) is part A's and the same
in both games. CotAB's maximum HP is also worked out again by its current-stat routine when CON
changes (§11).

## 3. Starting money

**Original:** PoR creation ([engine/chargen-and-progression.md, "Starting gold"](../A-games/engine/chargen-and-progression.md#starting-gold-dice--10-gp-ds4263)),
CotAB 0x388DB–0x389EA ([coab/tables.md §3.10](../A-games/coab/tables.md#310-starting-money-o-chargen-388db389ea)).

Parameters (`startMoney`): `coin` (index into the money words, 0 copper … 4 platinum) and `fixed`
(an amount, or null).

For each class the new character has, in ascending order, `roll(count, sides)` from `T.startGold` is
requested and summed (always, also when `fixed` is set: the original rolls and drops them). The money
word `coin` := `fixed`, or else ⌊sum × 10 / number of classes⌋. PoR: coin 3 (gold), fixed null.
CotAB: coin 4 (platinum), fixed 300. A character imported into a game with `fixed` set gets that
amount and nothing else (§13).

## 4. Caster level

**Original:** PoR `FUN_10ba_26c2`, CotAB 0x4F8BF with the former-level rule 0x51841
([coab/tables.md §3.7a](../A-games/coab/tables.md#37a-caster-level-o-0x4f8bf-thunk-edca-por-fun_10ba_26c2)).

Parameters: `casterTerms` (spell class code → terms `{ cls, minus }`), `casterGate`
(`{ atLeast: base class → minimum level, level }` or null), `dualClass` (non-null: former levels can count; §7.2).

- **Former levels count** (`formerLevelsCount(c)`): `dualClass` is set, the game has `prevLevels`
  and `hpLevel`, the character is of `dualClass.race` (human, 7), and its current level in the first class (in base
  class order 0–7) that has a level, read signed, is greater than `hpLevel` (signed). Then a class's
  level for casting is `levels[k] + prevLevels[k]` (both signed); else `levels[k]`.
- **The caster level** of a character for spell *s*:
  1. If `casterGate` is set and every class named in `atLeast` has a current level (signed) below its
     minimum: `casterGate.level` (for every spell).
  2. Else, if `casterTerms` has the spell's class code: the greatest of 0 and, over its terms, the
     class's casting level − `minus`.
  3. Else (item and monster spells): 12.
  4. Cast from an item and the spell's class is not the item class: 6, whatever the above gave.

| Game | Values |
|---|---|
| PoR | terms: cleric (0) [cleric − 0], magic-user (1) [magic-user − 0]; gate null; dualClass null |
| CotAB | terms: cleric (0) [cleric − 0, paladin − 8], druid (1) [ranger − 7], magic-user (2) [magic-user − 0, ranger − 8]; gate { cleric ≥ 1, magic-user ≥ 1, paladin ≥ 9, ranger ≥ 8 } → 6 (0x4F8C5); dualClass set (§7.2) |

The script view's `{ classLevel: k }` reads the casting level of class *k*
([script-vm-map.md §4.2](script-vm-map.md#42-per-game-view)).

## 5. Thief skills

**Original:** PoR `FUN_51cf_0329`, CotAB 0x50F5A ([engine/chargen-and-progression.md, "Thief skills"](../A-games/engine/chargen-and-progression.md#thief-skills-o-fun_51cf_0329),
[coab/tables.md §3.8](../A-games/coab/tables.md#38-thief-skills-o-0x50f5a)). Run by the derived
statistics when the character has a thief level, and by readying or removing a thief item (the item
behaviour `recomputeStats` with `thief`).

Parameters (`thief`): `dualClass` (the level includes the former thief level, §4), `bonus` (added to
every skill), `clampWithBonus` (the race clamp compares with the bonus), `gloves`
(`{ effect, raise: skill → level, bonus }` or null), `gauntlets` (`{ effect, minLevel, bonus }` or null).

```
L := dualClass ? casting-style thief level (§4) as a signed byte : levels[thief]
b := bonus
item := the first readied item with +0x3E > 0x80 whose +0x3E & 0x7F is gloves.effect or gauntlets.effect
if item is the gauntlets and L < minLevel: L := minLevel and the gauntlets add nothing
for skill s in 1..8:
    if item is the gloves and raise[s] exists: if L < raise[s]: L := raise[s], b := 0  else b := gloves.bonus
    base := thiefBase[L · 8 + s];  race := thiefRace[race · 8 + s]  (signed)
    if race < 0 and base < (clampWithBonus ? b : 0) − race: v := 0
    else: v := base + race + b, and for s ≤ 5 also + thiefDex[DEX · 5 + s]
    if the gauntlets count: v += gauntlets.bonus
    thief[s] := v as a byte;  L := the level before the gloves
```

| Game | Values |
|---|---|
| PoR | dualClass false, bonus 0, clampWithBonus false, gloves null, gauntlets null |
| CotAB | dualClass true, bonus 7 (the original's uninitialised variable, left at 7 by the saves routine; **O** by the shipped characters), clampWithBonus true, gloves { effect 0x0B, raise {PP 5, OL 7}, bonus 5 }, gauntlets { effect 0x02, minLevel 4, bonus 10 } |

## 6. Saving throws

**Original:** PoR `FUN_51cf_0255`, CotAB 0x50C6B ([engine/chargen-and-progression.md, "Saving throws"](../A-games/engine/chargen-and-progression.md#saving-throws-o-fun_51cf_0255),
[coab/tables.md §3.6a](../A-games/coab/tables.md#36a-saves-the-con-bonus-o-0x50c6b)).

Each of the five saves := 20, then the minimum over the classes with a level of
`T.saves[class · row + level · 5 + kind]`. Then, with `saveCon` set (`{ save, races, itemEffect,
from, bands, all }`):

```
CON := current CON
add := CON ≥ 19 ? bonus of the first band of `all` whose highest CON ≥ CON : 0
if (race in races or a readied item has +0x3E > 0x80 with & 0x7F = itemEffect) and from ≤ CON ≤ 18:
    add := bonus of the first band of `bands` whose highest CON ≥ CON
saves[save] := (saves[save] + add) as a byte
```

PoR: null. CotAB: save 0, races [1, 5] (dwarf, halfling), itemEffect 6 (Girdle of the Dwarves), from 4,
bands [6 → 1, 10 → 2, 13 → 3, 17 → 4, 18 → 5], all [20 → 1, 22 → 2, 24 → 3, 25 → 4]. Added to the stored
number, this makes the save harder (**I**: a bug of the original, kept; the shipped TRAVIS shows it).

## 7. Creation and training values

Values the original holds as code, the same procedure in both games (part A,
[engine/chargen-and-progression.md](../A-games/engine/chargen-and-progression.md); CotAB
[coab/records.md §10](../A-games/coab/records.md#10-creation-effects-and-paladin-abilities-o),
[coab/tables.md §3](../A-games/coab/tables.md#3-rule-differences-with-values)):

| Parameter | Meaning | PoR | CotAB |
|---|---|---|---|
| `raceMenu` | races offered at creation, in menu order (PoR `FUN_417f_056c`, CotAB 0x3708F) | 1, 2, 3, 4, 5, 7 (half-orc never) | the same |
| `components` | base classes of each class id 0–16 | [0] … [7], then 8 [0, 2], 9 [0, 2, 5], 10 [0, 4], 11 [0, 5], 12 [0, 6], 13 [2, 5], 14 [2, 6], 15 [2, 5, 6], 16 [5, 6] | the same |
| `ageColumns` | the starting-age column a multi-class uses (single classes use their own id) | 8, 9, 11, 12 → 0; 13, 15, 16 → 5; 14 → 2 | the same |
| `clericMultis` | multi-classes with a cleric part, whose WIS is raised to at least 13 | 8, 9, 10, 11, 12 | the same |
| `startSpells` | spells a new magic-user knows (creation; CotAB's dual-classing too) | 11, 18, 19, 21 (Detect Magic, Read Magic, Shield, Sleep; creation, linear 0x334DF) | 11, 18, **12**, 21 (Detect Magic, Read Magic, Enlarge, Sleep; creation 0x389B7, dual-classing 0x515F9) |
| `startEffects` | innate effects of a new character, permanent, power 0xFF, flag 0: by race, then by class id | race 1 [0x5A, 0x61, 0x1A, 0x2F], 2 [0x6B], 3 [0x61, 0x12, 0x2F, 0x30], 4 [0x7C], 5 [0x5A, 0x61]; class none | race 1 [0x61, 0x1A, 0x2F], 2 [0x6B], 3 [0x61, 0x12, 0x2F, 0x30], 4 [0x7C], 5 [0x61]; class 3 [8], 4 [0x86], 10 [0x86] |
| `levelLimits` | demi-human limits: `{ race, cls, by, limits }`: the ability `by` (0 STR, 1 INT) sets the band: below 17, at 17, at 18 or more (18/xx counts as 18); no rule: no limit | dwarf F 7/8/9, elf F 5/6/7, gnome F 5/5/6, half-elf F 6/7/8, halfling F 4/5/6, half-elf C 5/5/5 (all by STR) | PoR's, plus elf MU by INT 9/10/11, half-elf ranger by STR 6/7/8, half-elf MU by INT 6/7/8 |
| `extraAttacks` | base class → the level above which it gets 3 attacks per 2 rounds (`attacksBase` 3; below it 2 where `recalc.attacksReset`, §7.1) | fighter > 6 | fighter > 6, paladin > 6, ranger > 7 |
| `trainingCost` | the training fee in gp | 1 000 | 1 000 |
| `chaReaction` | the reaction value scripts read at B + 0x2CF, by CHA 0–25 | 0 0 0 0 5 10 15 20 25 25 25 25 25 30 35 40 50 55 60 60 60 60 60 60 60 60 | the same |

The paladin's Cure Disease starts at `paladin.cureDisease.initial` uses when the class has a paladin
part (§10).

### 7.1 The recalculation

**Original:** PoR `FUN_51cf_0000`, CotAB 0x50836 (O; [engine/chargen-and-progression.md, "Derived
statistics"](../A-games/engine/chargen-and-progression.md#derived-statistics-o-fun_51cf_0000-run-after-creation-and-training),
[coab/chargen-and-progression.md §1](../A-games/coab/chargen-and-progression.md#1-the-recalculation-o-0x50836)).
Run after training, a level drain or restore, an import, joining and dual-classing.

Parameters (`recalc`): `attacksReset` (below the extra-attack level the attacks are set to 2),
`classMask` (the item class mask is worked out again).

```
thac0Base := max over k = 0..7 of T.thac0[k · row + levels[k]]   (signed level; a class without a level reads its level-0 row)
hitDice := max(hitDice, every levels[k])                          (raised, never lowered; a drain sets it itself)
if some extraAttacks class k has levels[k] > its level: attacksBase := 3
else if attacksReset: attacksBase := 2
spell slots (§1); saves (§6); thief skills (§5) when levels[thief] > 0
if classMask:
    itemMask := Σ (byte) T.classBits[k] over k with levels[k] > 0, or 0 < prevLevels[k] < hitDice
    every readied item whose base classes ∧ itemMask = 0 and that is not cursed is put away
if former levels count (§4):
    if some extraAttacks class k has prevLevels[k] > its level: attacksBase := 3
    thac0Base := max(thac0Base, max over k of T.thac0[k · row + prevLevels[k]])
    thief skills (§5) when prevLevels[thief] > 0
```

| Game | Values |
|---|---|
| PoR | attacksReset true, classMask false (the mask is set at creation only) |
| CotAB | attacksReset false (only ever raised to 3), classMask true |

### 7.2 Dual-classing

**Original:** CotAB's party-screen function "Human Change Classes" (0x5135D, eligibility 0x511AE;
[coab/chargen-and-progression.md §2](../A-games/coab/chargen-and-progression.md#2-dual-classing-o-0x5135d)).
PoR has none (G: Lee, "dual-classing is not available"; no such function or string in its files).

Parameters (`dualClass`, null: no dual-classing): `race` (who may), `primeFrom`, `oldAtLeast`,
`newAtLeast` (the ability rule).

- **Offered** (in the party screen a training hall opens) when the character is of `race` and has
  no former class (every `prevLevels` byte, in the 0–6 then 7 scan, is 0).
- **Allowed classes**: the race's class list (`T.raceClasses`), in its order, keeping class *k* when
  *k* is not the current class (the first class 0–6 whose level is not 0, if above 0; else 7); every
  ability *a* with `T.classMins[cur][a] ≥ primeFrom` has base value ≥ `oldAtLeast`; every ability
  with `T.classMins[k][a] ≥ primeFrom` has base value ≥ `newAtLeast`; and the alignment is in
  `T.alignments[k]`. None: "*Name* doesn't qualify." and nothing changes.
- **The change** to class *k*: experience 0; `attacksBase` 2; `prevLevels[cur]` := the current
  level; `hpLevel` := `hitDice`, then `hitDice` := 1; `levels[cur]` := 0, `levels[k]` := 1; every slot
  of every pool 0; *k* = cleric: cleric slot 1 := 1; *k* = magic-user: magic-user slot 1 := 1 and
  `startSpells` known (the spell book is otherwise kept); the class byte := *k*; the memorised
  spells cleared; the recalculation (§7.1); saves (§6); thief skills (§5) whatever the classes, so a
  former thief's fall to the level-0 row; every item (readied or not) the new mask does not allow
  and not cursed is put away. Hit points stay. "*Name* is now a 1st level *Class*."
- **After it**: training gains hit points only while `hitDice` > `hpLevel` (signed; §2's caller,
  CotAB 0x3BE45), so none until the new class passes the old level. From then on the former levels
  count (§4): casting levels, spell slots (§1), THAC0, attacks, thief skills and the item mask
  (§7.1), the backstab (§15.6), the Turn command and Turn Undead, the sweep level and the
  locked-door menu ([coab/combat.md, "The former class in battle"](../A-games/coab/combat.md#the-former-class-in-battle-o)),
  and the class shows with its level on the character's lines.

| Game | Values |
|---|---|
| PoR | null |
| CotAB | race 7 (human), primeFrom 9, oldAtLeast 15, newAtLeast 17 |

## 8. Joining the party

**Original:** PoR Add (party size only, [engine/input-and-menus.md §2.1](../A-games/engine/input-and-menus.md#21-add-character-o));
CotAB 0x36848 + 0x3648..0x3A24 ([coab/records.md §9](../A-games/coab/records.md#9-joining-the-party-o-add-at-image-0x36848--0x36480x3a24)).

Parameters (`join`): `pcs` (player characters at most), `members` (members at most, NPCs included),
`maxRangers` (or null), `evil` (alignments that count as evil), `paladins` (the paladin rules apply).

A character *c* asks to join a party:

1. An empty party takes it with no checks.
2. Already in the party (same name and same `id`): refused, nothing said.
3. A player character (morale < 0x80) when the party has `pcs` player characters, or an NPC when it
   has `members` members: refused, "The party is full."
4. With `paladins`: a paladin (paladin level > 0) when anyone in the party is evil: refused,
   "paladins do not join with evil scum".
5. With `maxRangers`: a ranger when the party has that many rangers: refused, "too many rangers in party".
6. With `paladins`: an evil character when the party has a paladin: refused, "*name* will tolerate no
   evil!", *name* the last paladin in list order.

PoR: pcs 6, members 8, maxRangers null, evil none, paladins false. CotAB: 6, 8, 3, [2, 5, 8], true. The
messages of 4–6 are game text (D1, [D-appendices/strings.md §4](../D-appendices/strings.md#4-engine-messages):
`noEvilScum`, `tooManyRangers`, `toleratesNoEvil`); "The party is full." is the port's wording (neither
image holds it; [strings.md §3.4](../D-appendices/strings.md#34-panels)). Test vectors:
[test-vectors.md, `join`](../D-appendices/test-vectors.md#4-procedures).

## 9. Temple

**Original:** PoR `FUN_2d14_0d09` / `FUN_2d14_09d7` ([engine/town.md, "Temple"](../A-games/engine/town.md#temple-o-fun_2d14_0d09)),
CotAB [coab/tables.md §3.11](../A-games/coab/tables.md#311-temple-o).

Parameter `temple`: the healing services in the order of the game's name table `T.templeNames`
(entry *i* names service *i*; the table's last entry is Exit), each `{ kind, gp }`; the prices are
code immediates.

| Kind | Applies when (else "*name* … cast cure anyway:") | Does |
|---|---|---|
| `blind` | has effect 33 ("is not blind.") | removes every effect 33 |
| `disease` | has a disease effect `T.diseases[1..6]` ("is not Diseased.") | removes them all |
| `clw`, `csw`, `ccw` | always | heals 1d8, 2d8 + 1, 3d8 + 3 through the heal procedure (§12.2) |
| `heal` | always | heals (max HP − HP − 1d4) as a byte; removes 33, the diseases and 68; INT and WIS := their base values |
| `poison` | has effect 55 ("is not poisoned.") | removes 55, 22 and 15 |
| `raise` | status 6 or 1 ("is not dead.") | Raise Dead as part A (HP 1, CON − 1 also in the base, the HP loss by levels and CON) |
| `curse` | a cursed item or effect 36 ("is not cursed.") | removes 36; every item's curse byte (+0x36) := 0 |
| `stone` | status 7 ("is not stoned.") | status 0, in play, HP 1 |

The fee is asked ("… will only cost *n* gold pieces. pay for cure?") and paid first, whether or not
the cure then does anything. PoR: blind 1 000, disease 1 000, clw 100, csw 350, ccw 600, poison 1 000,
raise 5 500, curse 3 500, stone 2 000. CotAB: the same with heal 5 000 after ccw. The effect types the cures remove are the profile's
`effects.ids` (`blind`, `poisoned` with `slowPoison` and `poisonTick`, `cursed`, Raise Dead's
`animated` and `poisoned`; CotAB's Heal also `stat.feebleminded`), the diseases START.EXE's table.

### 9.1 Shop prices

**Original:** PoR's shop charges an item's value ([engine/town.md](../A-games/engine/town.md)); CotAB's
listing (0x1F0F6) and Buy (0x1F531) shift it by a factor the scripts set ([coab/ecl.md](../A-games/coab/ecl.md), 0x7F6D).
Parameter `shopPrice` `{ variable, shifts }` or null: the price is the value shifted by `shifts`[the word
at `variable`] bits (negative: right), as a 16-bit word; a factor not in `shifts` prices at the value
(IMP-078: the original's Buy leaves the price unset); null, the value.

| Game | Values |
|---|---|
| PoR | null |
| CotAB | variable 0x6E6D (ECL 0x7F6D), shifts 1: −4, 2: −3, 4: −2, 8: −1, 32: 1, 64: 2, 128: 3 |

## 10. Class abilities

**Original:** CotAB's paladin, View menu 0x3D530 + 0x35F0 … ([coab/records.md §10](../A-games/coab/records.md#10-creation-effects-and-paladin-abilities-o)).
Parameter `paladin`: `{ layOnHands: { perLevel, effect, minutes }, cureDisease: { effect, minutes,
levelsPerUse, initial } }` or null (PoR).

A character is a paladin for these abilities when its class is 3, or it has a former paladin level
and former levels count (§4). Outside combat and with status 0:

- **Lay on Hands**, offered while the paladin has no effect `layOnHands.effect`: heals `perLevel` ×
  paladin casting level through the heal procedure, only for a target of status 0, 1, 4 or 5 below its
  maximum ("*target* feels better" when HP changed, else "*target* is unaffected"); then the paladin
  gets `effect` raw for `minutes` (power 0, flag 0), whether or not it healed.
- **Cure Disease**, offered while `abilityUses` > 0: removes one record of each disease type
  (`T.diseases[1..6]`) from the target, `abilityUses` − 1, and unless present adds `cureDisease.effect`
  for `minutes` with flag 1 ("*target* is cured"). That effect's removal (the behaviour `refillUses`)
  sets `abilityUses` := ⌊(paladin level − 1) / `levelsPerUse`⌋ + 1.

CotAB: perLevel 2, effect 0x8C, 1 440 minutes; effect 0x8D, 10 080 minutes, levelsPerUse 5, initial 1.

## 11. The current-stat routine

**Original:** CotAB 0x4C389 (`4aab:18d9`), with the CON hit-point recompute 0x4C72B–0x4C875
([coab/effects.md §5](../A-games/coab/effects.md#5-the-current-stat-routine-0x4c389-4aab18d9-char-stat-o)).
PoR has none: its handlers set and restore the stats themselves. It runs when a game's
`effects.removalStat` names the removed type (§12.1), and from the item behaviour `recomputeStats`,
the spell kinds `strengthByClass`, `setStrength`, `enlarge` under `overBase`, `raise`, `removeCurse`
and `applyTo` with `stat`.

For stat *i* (0 STR … 5 CHA), starting from the base value (and the base STR %):

1. Readied items with +0x3E > 0x80 (kind = & 0x7F, value = +0x3D), in list order:
   - STR: kind 5 sets a candidate 18/100 (value 0) or 18 + value (1–6); kind 8 with value 0 and base
     STR below 18 the base + 1; kind 0x0D overrides to 3. A candidate replaces the running STR when it
     is higher (18 compared by its %).
   - INT: kind 8 (value 1, base below 18) +1; kind 0x0C overrides to 7; 0x0D overrides to 3. WIS: kind 8
     +1. DEX: kind 2 +4 (base ≤ 6), +2 (≤ 13), else +1; kind 8 +1; kind 0x0A −2. CON: kind 6 +1, kind 8
     +1. CHA: kind 6 −1, kind 8 +1. ("Kind 8" adds 1 to the stat its value names, only below 18.)
2. Effects (the first record of each type):
   - STR: 0x26 holds a bonus in its power (decoded: power & 0x7F ≤ 0x65 → 18/(p − 1), else p − 100);
     when STR is at most 18 with % below 100 the bonus is added; above 18 the excess goes into the %
     at 10 a point (up to 100) for a character with a fighter, paladin or ranger level (current or
     former), and STR stays 18; then 0x92 and 0x0C set candidates from their power. The highest wins.
     The result, or the item override with % 0, is stored.
   - INT, WIS: Feeblemind (0x44) makes them 3 unless an item already made INT 7 or less.
   - CHA: 0x0E adds its power.
   - CON: the maximum HP is worked out again from `hpRolled` and the CON bonus over each class's
     levels up to its stop level (`T.hitDiceStop`), former dual-class levels too, divided by the number
     of classes with a level (as a byte; nothing without START.EXE), and the current HP moves by the
     same amount (not below 0); then at CON 20 or more the character has regeneration 0x3E (added for
     60 with power 0xFF, flag 1, if missing), else it loses it.
3. The result is stored in the current stat (and STR %).

## 12. Effect procedures

### 12.1 Adding and removing effects

**Original:** PoR add `FUN_5216_1656`, raw add `FUN_5216_0e52`, remove `FUN_5216_0026`; CotAB 0x4CD91,
0x4ABBA ([engine/effects.md §1](../A-games/engine/effects.md#1-how-handlers-are-invoked-and-how-they-learn-the-event)).

- **Add through the event** (*type, duration, power, flag, save mode, saved, run now, message*): the
  effect being added (DS:6817) := type; event 9 fires on the target; if a handler cleared it, or the
  target saved and the save mode is 1 (negates): "*name* is Unaffected", nothing added. Else an old
  record of the same type is taken out by the game's rule `effects.replaces`:
  `longerOrPermanent` (PoR `FUN_5216_1656`): a timed old record when the new one lasts longer, or any
  old record when the new one is permanent (duration 0), else both stay; `anyTimed` (CotAB 0x4CE0A):
  any old record with a duration left, whatever the new one's, while a permanent old record stays
  beside the new one. Then the record is added; a non-empty message is shown (in combat with the
  sparkle); with *run now* the new record's handler runs at once (**I**: the original runs the first
  record of the type).
- **Add raw**: the record is appended, nothing fires.
- **Remove** a record: its handler runs with the removal argument when its flag is set, the record
  goes, then for each stat that `effects.removalStat` lists for its type the current-stat routine runs
  (§11). PoR: none. CotAB: 0x0E → CHA; 0x0C, 0x26, 0x92 → STR.

### 12.2 Healing

**Original:** PoR `FUN_5216_175d`, CotAB 0x4CE85 ([engine/camp-and-time.md, "Healing"](../A-games/engine/camp-and-time.md#healing-o-fun_5216_175dchar-amount--1-force--0)).
Parameter `effects.healBlock`: effect types whose presence stops healing that is not forced.

Healing *n*: nothing unless status is 0, 1, 4 or 5; nothing when not forced and the character has an
effect of a `healBlock` type; HP := min(max HP, (HP + *n*) as a byte); a character out of play who
was dying becomes unconscious, and an unconscious one is revived (status 0, in play) unless in combat.
PoR: [0x32] (mummy rot). CotAB: none (0x32 is the Hot Fire Shield there).

### 12.3 The strength spells

Parameter `spells.strength` (the module `spells`), the rule for Enlarge, Strength and Giant Strength:

- `setCurrent` (PoR `FUN_5216_115c`): STR is set to the new STR/% when that is not weaker than now
  (18 compared by %), with the spell's line; the effect is added raw either way, its power the encoded
  STR to restore later (or the new STR, dormant, bit 7, when it was weaker); an active STR record
  already there turns dormant holding the current STR. Removal restores (behaviour `restoreStrength`).
  Encoding: 18/p is p + 1, other STR is STR + 100, as a 7-bit value.
- `overBase` (CotAB 0x4C1D8): only a new STR above the **base** STR, or 18 with a % above the base %
  whatever the base STR, adds the effect (power the encoded new STR, or the kind's own power, flag 1)
  with the line, and the current STR is worked out again (§11); otherwise the kind's `unaffected` line,
  if any, and nothing is added.

### 12.4 The camp's Fix

**Original:** CotAB 0x320D8 ([coab/camp.md §1](../A-games/coab/camp.md#1-fix-o-0x320d8)); Pool of Radiance
has none, the port offers the same procedure there (IMP-048). Parameter `rules.fix`: `{ cures: { spell,
level, dice, sides, bonus, minutes, base, group, weight }[], start }`.

With the party's wounds W (Σ max HP − HP, 16 bits) above 0: the pool gets each Okay member's memorised
`spell`s rolled (`dice`d`sides` + `bonus`, member by member, slot by slot); per member in list order the
minutes `level`-slots × `minutes` of each cure are worked out for an Okay member (and kept for one who
is not), the member's time is the largest `base` among the cures with minutes, plus all the minutes, and
the estimate E (from `start`) grows by the largest `weight` present in each `group`; the rest time is the
longest member time, divided by (E div W) & 0xFF when W < E and that is not 0. The party rests that
long silently (the rest steps of [camp-and-time.md](../A-games/engine/camp-and-time.md#rest-loop-o-fun_4b46_0c9a)),
and unless interrupted the pool gets one roll of each cure per Okay member's slot of its level, all of
the first cure first, and is shared out in party order: each member's need (capped at the pool, as a
byte to the heal procedure, §12.2), the pool reduced when the heal does anything.

CotAB: Cure Light Wounds (3) level 1, 1d8, 15 minutes, base 240, group 0, weight 27; Cure Serious
Wounds (58) level 4, 2d8 + 1, 60, 360, group 1, 34; Cure Critical Wounds (71) level 5, 3d8 + 3, 75,
360, group 1, 78; start 14. PoR (IMP-048): Cure Light Wounds alone, as CotAB's.

## 13. Character import

**Original:** CotAB's "Pool" import, the converter `323c:14b3` with `5047:03c6` after it
([coab/records.md §7](../A-games/coab/records.md#7-por--cotab-transfer)). Module `imports`: a list of
`CharacterImport`, empty for PoR.

| Field | Meaning | CotAB |
|---|---|---|
| `from`, `label` | the source game's id, and its name for the player | `por`, Pool of Radiance |
| `roster`, `saveSlot` | source files: roster characters by extension; save-slot characters by name pattern | `CHA`; `CHRDAT[A-J][0-9].SAV` |
| `maxMorale` | the highest morale byte accepted (NPCs refused) | 0x7F |
| `copy` | fields copied as they are, each with its byte count | below |
| `clampStats` | stats clamped to the target's race limits | true |
| `hpLevelFromHitDice` | the target's `hpLevel` := its `hitDice` | true |
| `forget` | spell ids unlearned | [36] |
| `keepEffects` | effect types kept from the source's effect file (when found by the name's stem) | 18, 26, 47, 48, 97, 107, 124 |

CotAB's `copy` list (field, bytes): name 16, race 1, gender 1, thac0Base 1, cls 1, age 2, maxHp 1, sweep 1,
sizeFlags 1, saves 5, baseMove 1, hitDice 1, drainLevels 1, drainHp 1, undead 1, thief 8, misc83 1,
morale 1, npcShare 1, misc86 1, misc87 1, levels 8, monsterType 1, alignment 1, attacksBase 2, natDice 2,
natSides 2, natBonus 2, acBase 1, strAdj 1, id 1, xp 4, itemMask 1, hpRolled 1, clericSlots 3, muSlots 3,
xpBase 2, xpPerHp 1, head 1, body 1, iconHead 1, iconBody 1, iconSize 1, iconColours 6, hands 1,
saveBonus 1, load 2, status 1, inPlay 1, side 1, thac0 1, ac 1, acRear 1, attacksLeft 2, dice 2, sides 2,
bonus 2, hp 1, move 1.

A record is accepted when its size is the source game's record size and its morale ≤ `maxMorale`.
Conversion:

1. A blank target record; each `copy` field copied byte for byte through both games' field maps (a
   field −1 in either game is skipped).
2. Known spells: `known + id` copied for ids 1 up to the smaller `knownCount`; then each `forget` id := 0.
3. Each ability from the source; with `clampStats` raised to the race's minimum, then lowered to its
   maximum (STR by sex: `raceLimits` + sex and + 2 + sex; others + 4 + 2*i* and + 5 + 2*i*). Exceptional
   STR clamped to the race and sex cap (`raceLimits` + 4 + sex). The base abilities := the current ones.
   (The original writes the cap into base STR instead; IMP-070 fixes it, [C-port/departures.md](../C-port/departures.md).)
4. With `hpLevelFromHitDice`: `hpLevel` := `hitDice`.
5. Money: the target's `startMoney` when fixed (CotAB 300 platinum); no items (`itemCount` 0).
6. `itemMask` := OR of `T.classBits` over the classes with a level; then the derived statistics
   (THAC0, highest level, attacks, slots, saves, thief skills).
7. Effects: the source's effect records of a `keepEffects` type, if its effect file was found.

## 14. Random treasure

**Original:** PoR the TREASURE handler 29c3:19B0 and `FUN_4c2d_1010`; CotAB 0x1A5A3 and 0x42D97
([engine/records.md, "Random items"](../A-games/engine/records.md#random-items),
[coab/records.md §8](../A-games/coab/records.md#8-random-treasure-items-o-builder-0x42d97-type-choice-0x1a5a30x1a6e2)).
Module `treasure` (`TreasureRules`).

**The `Pick` notation.** A pick is a number (that value), `prev` (the previous item's type in this
TREASURE, 0 for the first), `roll` (the enclosing band's own die result), or `{ die, plus?, bands }`:
roll 1d`die`, add `plus`, and take the first band `[high, pick]` with result ≤ high (the last band
if none), then resolve its pick with that result as its own roll. `rollOverride` replaces a `roll`
result (45 → 0x3B in both games).

TREASURE with operand 0x80 + *n* makes *n* items: for each, the type := `type` resolved, then the
record is built and **prepended** to the treasure list. The builder is part A's (`FUN_4c2d_1010`; its
name words, weights, counts and value factors are the same constants in both games, **O**); the
profile supplies:

| Field | Meaning | PoR | CotAB |
|---|---|---|---|
| `type` | the type choice | d100: ≤ 60 → (d100: ≤ 47 roll, ≤ 49 prev, ≤ 59 roll, ≤ 90 D10, ≤ 94 0x49, ≤ 97 0x5D, ≤ 100 0x4D); ≤ 85 0x3D; ≤ 92 0x3E; ≤ 98 (d16: ≤ 7 0x47, ≤ 9 0x46, 10 0x54, ≤ 12 0x4E, ≤ 14 0x4F, 15 0x5C, 16 0x43); ≤ 100 0x45 | d100: ≤ 60 → (d100: ≤ 47 roll, ≤ 49 0x3B, ≤ 59 roll, ≤ 90 D10, ≤ 94 0x49, ≤ 97 0x5D, ≤ 100 0x4D); ≤ 85 0x3D; ≤ 92 0x3E; ≤ 98 (d15: ≤ 9 0x47, 10 0x54, ≤ 15 0x4F); ≤ 100 0x3B |
| (D10) | | d10: ≤ 4 0x24, ≤ 7 0x23, 8 0x22, 9 0x25, 10 0x26 | the same |
| `plus` | the plus of weapons and armour: a die and bands | d20: ≤ 14 +1, ≤ 19 +2, 20 +3 | d20: ≤ 14 +1, ≤ 20 +2 |
| `javelin` | `{ type, die, on, record }`: a javelin of `type` that rolls `on` on 1d`die` becomes random record `record` | 0x15, d5 = 5 → 0x90 (one word short of the Javelin of Lightning: the original's bug, kept) | 0x15, d5 = 5 → 0x31 |
| `scrollLevelDie`, `scrollSpells` | a scroll's spells: each level 1d`die`, then per level [sides, offset]: id = 1d`sides` + offset | d3; MU [13, 8] [7, 28] [11, 44]; cleric [8, 0] [7, 21] [9, 35] | d5; MU [13, 8] [7, 28] [11, 44] [9, 80] [4, 90]; cleric [8, 0] [7, 21] [8, 36] [5, 65] [6, 70] |
| `magic` | type → the random-item record (word index into `T.randomItems`; 0 a blank item), a pick | 0x47 (d11: ≤ 5 0x11, ≤ 8 0x01, 9 0x19, 10 0x51, 11 0); 0x46 (d10: ≤ 7 0x59, ≤ 10 0x89); 0x54 0x09; 0x4E (d3 + 1: 1 → 0, 2 → 0x41, 3 → 0x71, 4 → 0); 0x4F 0x39; 0x5C 0x61; 0x43 0x91; 0x45 (d10: 1 → 0x29, ≤ 6 0x79, ≤ 10 0x81); 0x3F 0x49 | 0x3F 0x29, 0x43 0x29, 0x4E 0x21, 0x4F 0x21, 0x54 0x09, 0x5C 0x09, 0x47 (d8: ≤ 5 0x11, ≤ 8 0x01) |
| `plusTwo` | records whose plus and save bonus are 2 (else 1) | [0x61] (Cloak of Displacement) | none |

The dice requests come in the order the builder makes them: the type's dice, then for a weapon or
armour the plus and (javelins) the javelin die, for a scroll the spell count (d3) and each spell's
level and id, for a magic type its pick.

## 15. Combat procedures

### 15.1 Casting

**Original:** the cast routine PoR `FUN_3aae_2414` / CotAB 0x2CCBD, the spell going off
`FUN_4e53_0c20` / 0x45251, the lost spell on damage `FUN_3aae_02f9` + `FUN_5216_1344` / 0x2AA62 +
0x4CC3C, the computer's choice `FUN_3334_0545` / 0x236CB
([engine/combat-rules.md, "Cast"](../A-games/engine/combat-rules.md#cast-o-fun_3aae_2414var-result-auto-spell),
[coab/combat.md, "Casting"](../A-games/coab/combat.md#casting-o)). Parameters (`casting`):

| Parameter | Meaning | PoR | CotAB |
|---|---|---|---|
| `lostFrom` | whose memorised list loses the queued spell when damage interrupts a caster: `current`, the current character's (PoR's forget takes no character: during an attack that is the attacker, a bug kept), or `target`, the interrupted caster's | `current` | `target` |
| `miscast` | `{ effect, sides }`: before a spell goes off (in and out of combat, from an item too), a caster with that effect who rolls 1 on 1d`sides` "miscasts": the spell does nothing and stays memorised; null: no check | null | { 0x4A, 2 } |
| `aiFirstSlot` | the first memorised slot the computer's spell choice reads | 0 | 1 (slot 0 never chosen) |
| `aiItemSpell` | `{ above, minus }`: the computer's item choice judges an item's power item[0x3D] as spell power − `minus` when above `above`, whatever the game's Use then casts | { 0x38, 0x17 } (`FUN_3334_03e4`) | { 0x38, 0x17 } (0x23651) |
| `allowed` | who may cast, by spell class: the filter of the player's cast list (in and out of battle), the memorise list (known spells) and the training's new-spell list. `{ stat, above, any, armoured }`: ability `stat` (0 STR … 5 CHA, current) above `above`; then a term [class, level] passes with the class's level above it or, when former levels count (§4), the former level; `any` null: no term needed. `armoured` `{ race, any, formerWith }`: in battle, for a character of `race` with body armour readied, only those terms pass, a former one only with a level, current or former, in `formerWith`. A spell class with no entry: never. Null: no filter | null (`FUN_4894_299c` lists every memorised or known spell) | cleric spells { WIS > 8, cleric > 0 or paladin > 8 }; druid { WIS > 8, ranger > 6 }; magic-user { INT > 8, no term; armoured { human, ranger > 8, formerWith magic-user } }; item spells never (0x43F8E, from the list builder 0x449E4) |
| `scrollReaders` | who reads a scroll: `{ classes, thief }`: one of `classes` as the current or former class (the first class 0–6, else 7, with a level, current or former) or with a level in one; else a level in `thief.cls` above `thief.above` and the request (1, 100) at most `thief.chance`; else "*Name* oops!", nothing cast (in battle the turn ends). Null: no test | null | { classes [magic-user, cleric], thief { thief, above 9, 75 } } (0x3FADB) |

**The computer's item use** (PoR `FUN_3334_03e4`, CotAB 0x2356A, the same procedure; **O**), tried
before the queued spell ([engine/combat-ai.md](../A-games/engine/combat-ai.md#computer-controlled-combatants-o-fun_3334_000f)):
the request (1, 7) for the number of passes comes first, always; then nothing happens without R[2],
without an enemy in play, or with ECL 0x49E5 ≠ 0. Pass *k* (from 0) at priority 7 − *k* walks the
item list in order and takes the first item that is not a scroll (ITEMS slot 11–13), has item[0x3E]
< 0x80, is readied and has a power > 0 whose spell (`aiItemSpell`) the spell test accepts at that
priority; the chosen item is used by the game's Use (PoR `FUN_4894_1a8a`, CotAB 0x3F9A8: its spell by
`spells.itemSpell`, a unit or a charge spent, "uses an item", no casting time, not announced, the
computer aiming), and the turn ends. So CotAB's computer can judge an item by one spell and cast
another (a power above 0x38).

The rest of casting is part A and the same in both games. The computer's Cure Light Wounds patient
test is the spell map's `aiTarget: woundedNear` ([vocabularies.md §4.1](vocabularies.md#41-the-spell-map-spellrules)).

### 15.2 The bolt

**Original:** the hit PoR `FUN_4e53_28bc` / CotAB 0x478F6, the path `FUN_4e53_295b` / 0x479B4
([engine/combat-rules.md](../A-games/engine/combat-rules.md), [coab/effects.md §7](../A-games/coab/effects.md#7-the-target-hook-bolts-and-the-area-template-o-unless-marked)).
One procedure, used by Lightning Bolt (the spell kind `bolt`), the breath bolt and thrown lightning.
Parameters (`bolt`):

| Flag | Meaning | PoR | CotAB |
|---|---|---|---|
| `lightning` | Lightning Bolt's length in squares | 8 (0x4111A) | 7 (0x47C7F) |
| `skipLast` | a stop does not hit the creature the previous stop hit | false | true |
| `mapAreaOnly` | the bolt bounces only in a map area (ECL 0x49E6 = 1) | false | true |
| `noRepeatBounce` | not twice without crossing a cell of movement 1 between | false | true |
| `chargeSinceLast` | each stop costs what the line added since the previous stop; false: the line's whole cost so far, every stop (PoR's bug) | false | true |

**The hit** on a cell (*damage*, *save type*, *last*): the creature on the cell (its top-left or any
cell of its footprint) is hit unless `skipLast` and it is *last*: damage type 0x0C, a save of *save
type* halves (mode 2). The cell bounces when it is not 0, its movement byte is 0xFF, and the flags
allow (`mapAreaOnly`, `noRepeatBounce` while the bounced flag is set).

**The path** (*caster*, *len*, *damage*, *save type*, *bounce bonus*); nothing when the caster stands
on the aimed square:

```
origin := aimed square;  last := its occupant;  sign := +1;  first := bounce bonus
remaining := 2·len as a byte (half-squares);  bounced := false;  prev := 0
while remaining > 0:
    line := from origin towards origin + sign·(origin − caster)·remaining   (line walker: 2 straight, 3 diagonal)
    loop:
        step the line until it ends, reaches an occupant other than last, a cell 0, a cell of
            movement > 1, or its cost ≥ remaining; crossing a cell of movement 1 clears bounced
        last := the occupant there (or none);  a cell 0 ends the bolt (remaining := 0)
        the segment flies as lightning (COMSPR cycle 6, 4 frames, 50 ms)
        bounce := hit(the cell, damage, save, previous last, bounced);  bounced := bounce
        if bounce: origin := that cell (and the aim);  walk a line back to the caster;
            if first and that line's cost ≤ 8: the current line's cost += 8
            sign := −sign;  first := false;  last := none
        spent := chargeSinceLast ? (line cost − prev) as a byte : line cost;  prev := line cost
        remaining := spent < remaining ? remaining − spent : 0
        if bounce or remaining = 0: leave the loop
```

The bolt comes straight back through the caster (the original's bug: not at the angle of
incidence). With `chargeSinceLast`, the first stop after a bounce is charged a wrapped negative
amount as a byte, which ends the bolt (**O**, 0x47C01). Lightning Bolt hits the aimed square first
and then runs the path with the bounce bonus.

### 15.3 Clouds

**Original:** the occupant check PoR `FUN_5216_0ae7`, CotAB 0x4B8F7 (a flag: 1 when moving or from a
cast, 0 at round end) ([engine/spells.md, "Stinking Cloud"](../A-games/engine/spells.md#stinking-cloud-o-fun_4e53_1b11-occupant-routine-fun_5216_0ae7),
[coab/spells.md](../A-games/coab/spells.md)). Parameters (`clouds`):

- `gas` `{ cell, immune, roundEnd, apply }`: a creature in play with any footprint cell on a `cell`
  square and no effect of a type in `immune` saves vs 0: success "starts to cough" (effect 0x1E for
  1 round), failure "chokes and gags from nausea" (0x1F for 1d4 + 1). Checked when moving and from a
  cast; at round end too when `roundEnd`. With `apply`: through the add-effect procedure (event 9, its
  line with the sparkle), the zone's owner made the current character meanwhile, then the new record's
  handler at once; else added raw with the line, and a failure ends the creature's turn.
- `kill` `{ cell, save, bands, poison }` or null: a creature on a `cell` square, by its hit dice
  (signed): the first band `[lowest, highest, bonus]` that holds them; a band with bonus null dies
  without a save, else a failed save vs `save` at that bonus: "is Poisoned", `poison` added raw
  (permanent, power 0xFF), then status 6 "is killed". Checked at every check, round end included.
- `probe` `{ immune, turned, save, below? }` in `gas` and `kill`: the computer's movement probe (PoR
  `FUN_3334_0675`, CotAB 0x237FB), after a step has passed the cost test, refuses a `cell` square
  unless the mover holds an effect of a type in `immune`, or (`turned`) its combat record +0x10 is set
  (turned, forced to flee), or (`save` not null) it saves vs `save`, the probe's own draw; with
  `below`, only a mover whose hit dice (signed) are below it is refused.

| Game | Values |
|---|---|
| PoR | gas { 0x1E, immune [0x1E, 0x1F, 0x20, 0x6F, 0x7D], probe { [0x20, 0x1E, 0x6F, 0x7D], turned false, save null }, roundEnd true, apply false }; kill null |
| CotAB | gas { 0x1E, immune [0x1F, 0x20, 0x6F, 0x7D], probe { [0x20, 0x1E, 0x6F, 0x7D, 0x81, 0x3F], turned true, save 0 }, roundEnd false, apply true }; kill { 0x1C, save 0, bands [0–4 no save], [5, −4], [6, 0], poison 0x37, probe { [0x81, 0x6F, 0x85, 0x7D], turned true, save null, below 7 } } (hit dice 7 and up, or below 0, unaffected) |

The clouds' squares and zones are the spell kind `cloud` ([vocabularies.md §4.3](vocabularies.md#43-the-battles-kinds)).

### 15.4 Battlefields

**Original:** the grid builder PoR `FUN_34c7_1e31` / CotAB 0x25CC0, the generators in
[engine/battlefield.md](../A-games/engine/battlefield.md) and [coab/combat.md, "Battlefield"](../A-games/coab/combat.md#battlefield-o-0x25cc0).
The grid is 25 rows × 50 columns of cell values; the cell table is `T.battleCells`.

**Which field** (`wildBattle`), in order: a map area (`geo` loaded) takes the map-area generator
unless the rule below applies; then

- `{ kind: overlandTile }` (PoR `FUN_34c7_11b4`): on the tile wilderness (an overland area, the party
  travelling), the wilderness field from the terrain flags of the overland tile the party stands on;
- `{ kind: placeFlags, mapFlag, place }` (CotAB 0x25CC0): whenever ECL `mapFlag` (canonical) is 0, the
  wilderness field from the terrain flags `T.placeTerrain[ECL place & 0xFF]`;
- otherwise the map-area generator; with no map at all, the wilderness field of tile 1.

PoR: overlandTile. CotAB: placeFlags, mapFlag 0x49E6 (CotAB's 0x4BE6), place 0x4AA1 (CotAB's 0x4CA1).

**The overland tile's terrain flags** (PoR `FUN_34c7_08a4`, **O**, [engine/battlefield.md, "Terrain flags"](../A-games/engine/battlefield.md#terrain-flags-o-fun_34c7_08a4)):
the first row whose tile ranges hold the tile gives the flags (none: 0, where the original returns an
uninitialised byte); then flag 0x80 with ECL 0x4AB3 = 0xFF becomes (flags + 0x80) | 1. This table is
part of the `overlandTile` procedure (the same for any game that has PoR's tile wilderness).

**Wilderness field** (`wildField`: `{ fill, blank, passes }`): every cell := `fill`; then each pass in
order. `blank` lists the cells drawn as blank ground (image slot 0x16), which the passes may change.
Passes that visit every cell scan **columns outer, rows inner** (both originals).

Shared notation:

- `FlagValue { base, steps, under? }`: start at `base`; for each step `[flag, op, n]` whose flag is
  set, `=` sets the value to *n*, `+` adds *n*; then with `under [a, b]` a value below *a* becomes *b*.
- `CellDie [base, sides]`: the cell `base` + 1d`sides` (`sides` 0: `base`, no die).
- `RiverCourse { chance, from, count, sides, every, offset }`: 1d100 is rolled (always); the river runs
  when it is ≤ the chance (a FlagValue); its start column is `from` − `count`·d`sides` (each die its
  own request), then lowered until (column + `offset`) mod `every` = 0; it moves one column right per row.

Passes:

| Pass | Parameters | Does |
|---|---|---|
| `river` | `course`, `cells` [two CellDie], `fordDie`, `pairs`, `ford` [dr, dc, cell][], `crossing` { from, die } or null, `edge` `spill` or `clip` | per row while the column is on the field: the two `cells` at (row, col) and (row, col + 1) (with `clip` the second only when col < 49, its die not rolled otherwise); then 1d`fordDie` (always rolled): 1, or with `pairs` an odd number of fords so far, makes a ford: each `ford` cell at (row + dr, col + dc). With `spill` the grid is one flat array, so a cell past column 49 lands in the next row's column 0 (PoR); with `clip` it is dropped. After the river, if no ford was made and `crossing` is set: r := `from` − 1d`die`, fords at row r (column start + r) and r + 1 (start + r + 1) |
| `treesBySize` | `chance` FlagValue, `swamp` flag, `trunk`, `crown` | from row 1: a blank cell under a blank cell, 1d100 ≤ chance: r := 1d10, size := r ≤ 8 ? ⌊(r + 1)/2⌋ : 4 + 1d2; with flag `swamp` size := 3 + 1d3 (the earlier dice still rolled); the cell := `trunk` + size, and for size < 5 the cell above := `crown` + size |
| `treesOrLogs` | `skip` flag, `chance` FlagValue, `log`, `crown`, `trunk` CellDie | nothing with flag `skip`; from row 1: a blank cell under a blank cell, 1d100 ≤ chance: 1d100 ≤ chance again → the cell := `log`; else the cell above := `crown`, then the cell := `trunk` |
| `scatterTerrain` | FlagValues `a`, `b`, `c`, `d`; `shrubs`, `cactus`, `tallCactus` [low, high], `shrub`, `rocks` CellDie, `marsh`, `tuft`, `puddleFlag` | every blank cell: r := 1d255; r ≤ a: k := 1d4, k = 4 with a blank cell above → `tallCactus` (low here, high above), k < 4 → `cactus` + k; else ≤ a + shrubs → `shrub`; ≤ … + b → `rocks`; ≤ … + c → `marsh` + ⌊(1d10 − 1)/3⌋; ≤ … + d → k := 1d4: k = 4 without `puddleFlag` → `tuft` + 1d3, else `tuft` + k |
| `scatterOdds` | `score` FlagValue, `die`, `odds` [{ from, to, odds[] }], `cells` CellDie[] | the score picks the odds row with from ≤ score ≤ to (none: nothing); every blank cell: r := 1d`die`; the first band *i* whose running sum of odds ≥ r sets `cells[i]` |
| `finishing` | none | the finishing pass of part A (`FUN_34c7_0000`): every cell 0x17 or 0x36: 1d100 = 98 → 0x1A, 99 → 0x1B, 100 and (area ≠ 10) and 1d100 = 1 → 1d10 ≤ 6 ? 0x1C : 0x1D |

| Game | `wildField` |
|---|---|
| PoR | fill 0x17, blank [0x17, 0x36]; river { course: chance (0; 0x20 = 35; 0x10 = 75), from 34, 5d4, every 7, offset 2; cells [0x32], [0x33]; fordDie 20; pairs; ford (0, 0) 0x34, (0, 1) 0x35; crossing { 16, d9 }; spill }; treesBySize { chance (1; 0x02 = 1, 0x04 = 3, 0x40 = 4, 0x08 = 7, 0x80 = 0), swamp 0x40, trunk 0x23, crown 0x1F }; scatterTerrain { a (0; 0x80 = 15), b (15; 0x02 = 45, 0x04 = 25, 0x80 = 10), c (0; 0x40 = 30), d (40; 0x02 = 10, 0x40 = 5, 0x80 = 25), shrubs 6, cactus 0x3C, tallCactus [0x40, 0x41], shrub [0x36, 3], rocks [0x29, 4], marsh 0x39, tuft 0x2D, puddleFlag 0x40 }; finishing |
| CotAB | fill 0x17, blank [0x17, 0x36]; river { course as PoR's; cells [0x3B, 2], [0x3D, 2]; fordDie 20; no pairs; ford (0, 1) 0x40, (1, 1) 0x41; crossing null; clip }; treesOrLogs { skip 0x80, chance (10; 0x02 + −5, 0x04 + −2, 0x40 + 5, 0x08 + 10; under 0 → 1), log [0x29, 2], crown [0x1F, 5], trunk [0x24, 5] }; scatterOdds { score (50; 0x10 + 10, 0x20 + 30, 0x40 + 20, 0x04 + −10, 0x02 + −20, 0x80 + −50), d100, odds −30..9 [0, 0, 0, 30, 15], 10..29 [0, 1, 5, 20, 10], 30..69 [0, 2, 5, 10, 5], 70..89 [10, 2, 10, 10, 1], 90..110 [15, 5, 15, 10, 1]; cells [0x39, 2], [0x2F, 2], [0x2B, 4], [0x36, 3], [0x31, 4] }; no finishing pass (it would put tables and chairs outdoors in CotAB's RandCom) |

**Map-area field** (`mapField`: `{ cornerWallEnd, finishing, furnish }`; PoR `FUN_34c7_0810`, CotAB
0x2555D, one procedure, [engine/battlefield.md, "Map areas"](../A-games/engine/battlefield.md#map-areas-squares--cells-fun_34c7_0810)):
13 × 5 map squares around the party, each a sheared 6 × 5 block of cells, as part A. The parameters:

- `cornerWallEnd`: the north-east corner's top-right cell where the square's north and east are
  open, the edge north of the corner (the east edge of the square to the north) is a wall and the
  east square's north is open (PoR 0x04,
  the 0x03 + 1 at image 0x25373; CotAB 0x08, the 0x07 + 1 at 0x25467).
- `finishing`: the finishing pass over the whole field afterwards (PoR true, CotAB false).
- `furnish` `{ flag, blank, table: [cell, die, atMost], chair: [cell, die, atMost] }` or null (CotAB
  0x24D63; [coab/combat.md, "Furnishing"](../A-games/coab/combat.md#furnishing-o-0x24d63)): after each square,
  if it is a **room** (a wall on some side; not two opposite walls alone; no door) whose map byte (GEO
  plane 2; outside 0–15: 0 in areas 0 and 10, else the coordinate wrapped to the far edge) has `flag`:
  each blank interior cell of its block (columns 2–3, rows 2–4 of the square) takes `table` when
  1d`die` ≤ `atMost`, and then each blank neighbour at `T.furnishDx/Dy` entries 1–4 takes `chair` the
  same way. PoR null; CotAB { 0x40, [0x17, 0x36], [0x1A, d10, 5], [0x1B, d10, 9] }.

### 15.5 Battlefield movement

**Original:** PoR the Move command `FUN_320c_09df`, the step routine `FUN_3aae_0712`, the computer's
probe `FUN_3334_0675`; CotAB 0x22ADD, 0x2AC98, 0x237FB ([engine/combat-rules.md, "Move"](../A-games/engine/combat-rules.md#move-fun_320c_09df),
[engine/combat-ai.md, "Movement"](../A-games/engine/combat-ai.md#movement-o-fun_3334_07f2-probe-fun_3334_0675),
[coab/combat.md, "Cell table"](../A-games/coab/combat.md#cell-table-o-ds26a4-4-bytes-a-cell)).

A step in direction *d* onto a cell of move byte *m* (`T.battleCells` byte 0) **costs** *m* × 3
half-squares for a diagonal (*d* odd) and *m* × 2 otherwise, as a byte (**O**: CotAB 0x2AD05–0x2AD64;
PoR's step routine takes 3 and 2 without reading the byte, the same since every PoR cell is 1 or 0xFF).
`battleMove: { test, shortStep }`:

- **Move** (the player, each step): an occupant attacks, a cell 0 asks "Flee:"; then "Blocked" when the
  tested value is more than the movement left R[6]: with `test` `byte` the cell's byte (which only
  rejects 0xFF), with `cost` the step's cost (0xFF for a 0xFF cell). Otherwise the attacks of
  opportunity, then the step routine.
- **The step routine**: when the cost is more than R[6], R[6] := 0 and, with `shortStep` `stay`, nothing
  moves; with `move` the step is made anyway. Otherwise R[6] −= cost. Then the move, the engagement
  counters cleared, the guards (part A).
- **The computer's probe** (each direction it tries, in its preference order): refused off the arena,
  on an occupied or 0xFF cell, when the tested value (as for Move) is **as much as or more than** R[6],
  or when the cost is more than R[6] (and on a cloud cell it fears); a refused direction passes to the
  next preference.

| Game | `battleMove` | Source |
|---|---|---|
| PoR | test `byte`, shortStep `stay` | `FUN_320c_09df` (byte > R[6]), `FUN_3334_0675` (byte ≥ R[6]; R[6] ≥ need), `FUN_3aae_0712` (short: R[6] := 0, no move) |
| CotAB | test `cost`, shortStep `move` | 0x22B2C (cost > R[6] → "Blocked"), 0x238DA (cost ≥ R[6] → refused), 0x2AD78 (short: R[6] := 0, then the move) |

So in CotAB the player cannot enter a cell that costs more than is left, the computer needs strictly
more than the cost, and the step routine's short branch is reached by neither (**I**: no other caller
found). The battle screen's planned walk and reachable squares (part C) use the same costs.

### 15.6 The backstab

**Original:** PoR `FUN_3aae_2574` (damage `FUN_3aae_0191`), CotAB 0x2CE27 (damage 0x2A6E2)
([engine/combat-rules.md, "Backstab"](../A-games/engine/combat-rules.md#backstab-o-fun_3aae_2574),
[coab/combat.md, "The backstab"](../A-games/coab/combat.md#the-backstab-o-0x2ce27-damage-0x2a6e2)).

Parameters (`backstab`): `armour` (the one body-armour type allowed; null: no test), `weapons` (the
weapon types allowed; no weapon always is), `notLarge` (the target's size flags & 0x7F must be ≤ 1),
`minus`.

A backstab when the attacker's thief level with its former part (§4) is above 0, the armour and
weapon tests pass, the target is not large where `notLarge`, R[0xF] > 1 and the attacker stands
straight behind the target's facing. Damage × (((L − `minus`) as a 16-bit word) div 4 + 2), L that
level.

| Game | Values |
|---|---|
| PoR | armour 50 (Leather Armor), weapons 7, 8, 35, 36, 37, notLarge false, minus 0 |
| CotAB | armour null, weapons 0x61, 7, 8, 35, 36, 37, notLarge true, minus 1 |

## 16. Demo mode

The demo's flags (`startMenu.demo`, [profile.md §3.3](profile.md#33-the-start-up-menu-and-demo-startmenu))
are read by the procedures they change, while the engine runs a demo:

- `keysWait` false: every key read takes a key that is waiting and never waits for one; a text
  input returns after one read (the host contract, [host-contracts.md §2](host-contracts.md#2-the-script-host-io));
- `continueBattle` false: a battle whose enemy side is gone does not ask "Continue Battle:";
- `aftermath` false: after a battle only the monsters leave the list (no outcome, experience, shares
  or treasure); the party size and the battle variables (ECL 0x6E70–0x6E72, 0x6DE3, 0x6DE6) are reset.

Nothing is saved, and the party is disbanded after the demo's script ends
([host-contracts.md §3](host-contracts.md#3-the-engines-entry-points)).

## 17. Notes moved from part A

*Informative.* The "Port" notes of [coab/combat.md](../A-games/coab/combat.md), moved here in
work-plan step 2; the normative content is §15. Paths are the reference implementation's.

### 17.1 Battlefields (from coab/combat.md, "Battlefield")

`rules/battlefield.ts` `mapBattlefield(geo, x, y, roll, area, spec, img)`: one map-area generator for
both games, `R.mapField` naming the differences as data: `cornerWallEnd` (PoR 0x04, CotAB 0x08),
`finishing` (PoR's pass afterwards, not CotAB) and `furnish` (CotAB: flag 0x40, blank cells, table
0x1A on d10 ≤ 5, chair 0x1B on d10 ≤ 9, the chair offsets read from START.EXE as `T.furnishDx` /
`T.furnishDy`; PoR null). Tested cell for cell, and die for die, against a statement-by-statement
transcription of 0x2555D and the routines it calls on real GEO maps (`test/mapfield.test.ts`); PoR's
map fields are unchanged (`test/battlefield.test.ts`).

`rules/battlefield.ts` `wildField(flags, roll, spec)`: one driver (fill, then the passes the profile
lists, `R.wildField`), the passes named by what they do; CotAB: `river`, `treesOrLogs`,
`scatterOdds`, no finishing pass; PoR: `river`, `treesBySize`, `scatterTerrain`, `finishing`. The river
is one procedure for both games (the course, two cells a row, the d20 after them, a ford procedure with
its cells as offsets): CotAB's numbers are the halves by d2, no pairs, no crossing and `edge: 'clip'`.
Shared as data: the flag arithmetic (`FlagValue`: a base, then set or add per flag) and the river's
course. Tested cell for cell against this transcription with scripted dice (`test/wildfield.test.ts`).

### 17.2 Casting (from coab/combat.md, "Casting")

`rules/combat.ts`: `beginCast` (both casts), `castSpell(f, s, { fromItem, auto, announce })` (both
0x45251 / `FUN_4e53_0c20`), `inflict` (lost spell), `aiCast` / `aiAccepts` / `patient`; the profile's
`R.casting`: `lostFrom` (PoR 'current', CotAB 'target'), `miscast` (CotAB { effect 0x4A, 1d2 }, PoR
null), `aiFirstSlot` (PoR 0, CotAB 1). Cure Light Wounds' patient test is the spell map's
`aiTarget: 'woundedNear'` (games/spellrules.ts), not a spell id. Feeblemind is the effect kind
`feeblemind` (rules/effectkinds.ts). Tests: `test/casting.test.ts`, both games.

## Open

- CotAB's druid and monk fixed hit points (2) are **I** (no druid or monk in play).
