# Behaviour vocabularies

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

The named procedures a game profile maps its numbers onto: what each effect type, readied item and
spell id of a game does is the **name** of a procedure in a shared vocabulary plus that game's
**parameters**. The original's behaviour per type and per spell is part A
([engine/effects.md §2](../A-games/engine/effects.md#2-effect-table), [engine/spells.md, "Per spell"](../A-games/engine/spells.md#per-spell),
[coab/effects.md §2](../A-games/coab/effects.md#2-handlers-ds6fc0--4type-filled-at-0x29e28-plus-8-slots-at-0x4aa3a-types-1147),
[coab/spells.md §2](../A-games/coab/spells.md#2-per-spell-id)); this file is the **vocabulary
contract**: every name, its parameters, the events it acts on, what it does, and which original
handlers it transcribes. §6 and §7 are the two games' maps.

**Terms** (one word each): the original's routine is a **handler**; the port's procedure for an
effect type is an **effect behaviour** (key `b`), for a readied item an **item behaviour** (key
`b`), for a spell id a **spell kind** (key `k`). The monster **specials** of event 14 are effect
behaviours that need the battlefield (§5). Names are the port's and normative for a builder who
shares profiles with the reference; behaviour is what matters.

**Text parameters.** `msg`, `names` and similar parameters quote the game's own messages and monster
names to identify them. They are game text: a conforming build reads them from the game's files
([D-appendices/strings.md](../D-appendices/strings.md), D1). The reference implementation still holds
them as strings ([AUDIT.md](../AUDIT.md) §6.8, C24). A line is printed as "*name* *msg*" (a message
starting with an apostrophe joins the name directly: "*name*'s …").

## 1. The behaviour contract

1. A behaviour is called with: the host (§1.2), the holder's effect record (type, duration, power,
   flag), the holder, whether this is the record's **removal** (the original's argument 1), the
   parameters from the profile, the **event** being fired (−1 for a removal or a direct run) and the
   effect type it runs as.
2. The originals' handlers do not know the event: each changes the shared globals whatever event
   it is listed under. A behaviour applies each part **on the event it means something for** (the
   attack roll on 10, the save on 12, …); every entry below lists those events in brackets. Where an
   original's part acts on an event where something reads it, the behaviour does too.
3. A behaviour that waits for something (an attack, a removal with a callback, an effect added
   through event 9) completes before the event's chain goes on to the next type; every other
   behaviour runs synchronously, so the save, damage and attack routines see the whole chain.
4. An unknown behaviour name in a profile is an error.

### 1.1 The shared globals

The original's globals during one dispatch chain (PoR DS:6816–6826, CotAB the same set; **O**,
[engine/effects.md, "Shared globals and helpers"](../A-games/engine/effects.md#shared-globals-and-helpers)):

| Global | Original | Meaning |
|---|---|---|
| `roll` | DS:6822 | the attack roll (−1: a miss) |
| `save`, `saveType` | DS:6816, DS:682A | the save roll and its type (0 death/poison/paralysis, 1 petrification, 2 rod/staff/wand, 3 breath, 4 spell) |
| `dmg`, `dmgType` | DS:6818, DS:6819 | damage and its type bits: 1 fire, 2 cold, 4 electricity, 8 magic, 0x10 acid (CotAB also 0x20, 0x40 and others its handlers test) |
| `rate`, `rateIsMove` | DS:681A, DS:681D | the rate at event 18 (half-attacks, or movement) |
| `spell` | DS:681B | the spell resolving (0: none) |
| `dice` | DS:681C (CotAB DS:6FB2) | the dice count of the last roll made through the counting dice routine |
| `untargetable` | DS:681E | the target cannot be targeted |
| `noRearm` | DS:681F | periodic effects do not re-arm on removal |
| `area` | DS:6820 | an area spell is resolving |
| `adding` | DS:6817 | the effect type being added (event 9); 0 blocks it |
| `morale` | DS:6825 | the morale value at event 17 |
| `hits` | DS:6823/6824 | hits per hand this attack |
| `round` | DS:6DE3 | the combat round |
| `saved` | CotAB DS:6FC2 | the last save succeeded (set by every save, 1 while its event 12 runs) |

Shared helpers the entries use: **negate(t)** (`FUN_3723_0000`, CotAB 0x27369: when *t* = 0 or *t* is
the effect being added, damage := 0 and the add is blocked); **re-arm** (`FUN_3723_001f`: unless
`noRearm`, add the type again raw, flag 1, and report true); **deflect(pct)** (`FUN_3723_0fac`: an
attacker with a missile weapon more than 1 square away is deflected on d100 ≤ pct: "*name* Avoids
it", damage 0, roll −1, one hit fewer); **drain(n)** (`FUN_3723_2122`, part A: energy drain of *n*
levels; the lost-HP counter stops at 255, IMP-067); **add** and **add raw**, **remove**
([procedures.md §12.1](procedures.md#121-adding-and-removing-effects)); **remove first** (the oldest
record of a type, with its callback); **remove one** ("*name* is Cured", then remove first).
"Counting dice" is the dice routine that records the count (PoR `FUN_5216_0e2e`, CotAB 0x4BE7C);
a parameter `keep` makes a behaviour's roll go through it.

### 1.2 The host

A behaviour reaches the world only through the effect host (`FxHost`,
[host-contracts.md §5](host-contracts.md#5-the-effect-host-fxhost)): in combat the battle, outside it
the world host, whose combat-only parts answer "not in combat" (no target, distance 0, no attack).

## 2. The effect system (`EffectRules`)

The module `effects` of the profile:

| Field | Meaning |
|---|---|
| `events` | event → the effect types that respond, **in the order the original calls them** |
| `area` | types that also act for characters near their holder |
| `areaRadius` | type → radius in combat (default 1) |
| `handlers` | type → `{ b, …parameters }`, for every type of the original's handler table |
| `removalStat` | type → the stats the current-stat routine works out again after its removal |
| `items` | +0x3E & 0x7F → an item behaviour, for items with +0x3E ≥ 0x80 |
| `replaces` | the add-effect rule: `longerOrPermanent` or `anyTimed` ([procedures.md §12.1](procedures.md#121-adding-and-removing-effects)) |
| `healBlock` | effect types that stop unforced healing ([procedures.md §12.2](procedures.md#122-healing)) |
| `ids` | the effect types the shared procedures add, test or remove, named by what they are (`poisoned`, `blind`, `helpless` …, the current-stat routine's `stat` or null); each game's own numbers |
| `names` | effect type → the address of its name in the camp Display window (PoR `FUN_3f81_0fbc`, CotAB 0x30DDA; [D-appendices/strings.md §5](../D-appendices/strings.md#5-texts-in-the-profile-data)) |

Text parameters of the handler and spell maps (`msg`, `msgs`, `death`, `names` and the others strings.md §5 lists) are image addresses of the game's strings, each the copy the cited routine prints; where the tables below quote the words, they identify the line (D1), the profile holds the address.

**Firing an event** on a character (PoR `FUN_5216_02fa`, CotAB 0x4AEC4): for each type of the event's
list in order, the character's first record of that type; or, for an `area` type it does not hold,
the first holder of that type in the party-and-monsters list who (in combat) is within its radius
of the character; or nothing. The behaviour named for the type then runs with that record.
**Running a record** directly (a "run at once") is the same call with event −1.

**The event lists** are part A's, normative from there: PoR events 0–19 and CotAB events 0–23 in
[coab/effects.md, "Event → types, in the order called"](../A-games/coab/effects.md#event--types-in-the-order-called)
(PoR's column reproduces the list at image 0x4245A; [engine/effects.md, "Event codes and call sites"](../A-games/engine/effects.md#event-codes-and-call-sites)
says where each is fired). Both games: `area` [21, 45, 46, 49], `areaRadius` {49: 6}. Events 20 (damage
not saved, after event 6), 21 (a turn begins with no spell queued, after event 15) and 22 (combat
starts, after event 8 for each character) are fired by the shared code for every game; PoR lists
nothing for them. Event 23 (CotAB: type 74) is never fired.

**Readying an item** with +0x3E ≥ 0x80 runs the item behaviour for +0x3E & 0x7F after readying (and
after putting it away, with `ready` false); no entry: nothing (PoR `FUN_4894_14d0`, CotAB 0x3F034). An
item +0x3E past PoR's 139 has no handler in PoR's table (its entries from 140 are not handlers, **I**).

## 3. Effect behaviours

118 effect behaviours. Each entry: the name, its parameters, [events], what it does, and the
original handlers it transcribes (PoR handler segment 3723 offsets or image offsets; CotAB image
offsets). "Target" is the holder's combat target (combat record +0x0A); "attacker" is the current
character.

### 3.1 Markers and turn control

- **`none`** — does nothing: the type is a marker other handlers read, or empty. PoR 3723_319b (5, 13, 16, 19, 24, 27, 54, 55, 60, 63, 92, 127); CotAB 0x29E21 and its empty handlers (12, 14, 38, 74, 140, 146).
- **`endTurn`** (`event`?) [7] — ends the holder's turn; with `event` only on that event. PoR 31, 51, 52, 53 (3723_133f, event 7); CotAB 27, 31, 51–53 (0x273C1, whenever it runs, also run at once).
- **`noMove`** (`moveRate`?) [7, 18] — the holder has no movement this turn (combat record +6 := 0); with `moveRate`, on event 18 the movement rate is 0 too. PoR 58 held (1452, moveRate 1); CotAB 136 (0x29B1C).
- **`notReady`** [1, 16] — while the holder has no initiative left (record +3 = 0): untargetable and roll −1. CotAB 37 (0x27ED0).
- **`blink`** [1, 16] — until the holder has acted (record +3 > 0): untargetable (1), roll −1 (16). PoR 37 (0c26).

### 3.2 Attack and damage modifiers

- **`rollMorale`** (`roll`, `morale`) [10, 17] — the attack roll += `roll` (10); the morale += `morale`, lowered no further than 0 (17). PoR 1 Bless, 2 Curse (010d, 011d).
- **`vsTargetType`** (`bonus` [[type, n]], `dmgType`?) [4, 10] — against a target whose monster type matches an entry: roll += n (10), damage += n (other events); with `dmgType` the damage type is set whatever the target. PoR 3, 6 (013b, 01c3).
- **`namedFoe`** (`who` target or attacker, `monsterType`, `size`?, `sizeMask`?, `roll`, `names`) [10, 16] — against `who` of that monster type, with size flags & `sizeMask` (default all) = `size` when given, and named one of `names` (game text): roll += `roll`. PoR 18, 26 on the target (0679 DS:342, 0947 DS:382); 47, 48 on the attacker (11f9 DS:402, 0x384A6).
- **`targetClass`** (`flag`, `roll`) [10] — a target with that monster-class flag (`classFlags`): roll += `roll`. CotAB 18, 26 (0x2779A, 0x27A4B).
- **`attackerClass`** (`flag`, `roll`) [16] — an attacker with that class flag: roll += `roll`. CotAB 4 (0x274AF).
- **`attackerKind`** (`types`, `size`, `roll`) [16] — an attacker of a monster type in `types` with size flags & 0x7F = `size`: roll += `roll`. CotAB 47, 48 (0x284A3, 0x284F2).
- **`untargetableBy`** (`type`, `detect`, `roll`) [1] — an attacker of monster type `type`: untargetable unless it has effect `detect`; roll += `roll` either way. CotAB 69 (0x28986).
- **`unseen`** (`detect`, `roll`) [1, 16] — untargetable (1) by an attacker without effect `detect`; roll += `roll` (16). PoR 25 Invisibility (0918).
- **`invisibility`** (`detect`) [1, 16] — not on removal: an attacker without `detect` cannot target, and roll −4. CotAB 25 (0x27A16).
- **`hidden`** (`roll`) [1, 16] — untargetable (1), else roll += `roll`. PoR 71 (171f).
- **`penalty`** (`roll`, `ac`?, `save`) [10, 11, 12] — roll (10), both ACs no better than 0 (11, with `ac`), save (12) by their amounts. PoR 33 Cause Blindness, 36 Bestow Curse (0bac, 0c15).
- **`saveElseRoll`** (`save`, `roll`) [12, other] — save += `save` on 12, else roll += `roll`. PoR 35 (0c06).
- **`prayer`** (`sideBit`, `save`, `roll`) [10, 12] — the side the power's `sideBit` names gets +`save` (12) or +`roll` (else), the other side as much less. PoR 49 (12b2).
- **`saveVsAlignment`** (`alignments`, `save`) [12] — the current character of one of `alignments`: save += `save`. PoR 8/45, 9/46 Protection from Evil / Good (0377, 03ac).
- **`shield`** (`ac`, `save`, `spell`) [6, 11, 12] — AC no worse than `ac` (11), save += `save` (12), spell `spell` (Magic Missile) does no damage (6). PoR 17 (064e).
- **`damageCut`** (`part`) [4] — damage −= ⌊damage / `part`⌋. PoR 29 Ray of Enfeeblement (0a3d).
- **`acBoth`** (`add`, `cap`) [11] — both ACs better by `add`, never past `cap`. CotAB 7 (0x2752F).
- **`bane`** (`type`, `roll`, `dmg`) [4, 10] — against a target of monster type `type`: roll += `roll`, damage += `dmg` (byte). CotAB 76 (0x28AC2).
- **`giantBane`** (`type`) [4, 10, 13] — against a target of monster type `type`: damage := 3·1d12 + 4 + the STR damage bonus (byte, **I**), roll += 2. CotAB 75 (0x28A6A).
- **`rangerVsGiants`** (`flag`) [4] — a target with that class flag: damage += the holder's ranger level (byte). CotAB 134 (0x29ACC).
- **`extraDamage`** (`lacks`, `sides`) [4] — a target without any effect of `lacks`: damage += 1d`sides`. CotAB 103 (0x293AD).
- **`displaced`** (`bit`) [8, 16] — combat start clears power bit `bit`; the first attack roll after (16) misses and sets it. PoR 89 (2490).
- **`attackRate`** (`mul`? or `div`, `ages`?, `msg`?) [18] — the rate × `mul` or div `div`; with `ages`, the first call sets that power bit, says `msg` and adds a year to the age. PoR 39 Haste, 42 Slow (0x37E7B, 10c1).
- **`deflect`** (`pct`, `plainWeapon`?, `items`?) [5] — deflect(`pct`); with `plainWeapon` only an attacker's weapon of plus 0; with `items` only an attacker with a readied item of one of those types. PoR 41, 104, 120 (1086, 2901, 2bc8).

### 3.3 Damage resistances and immunities

- **`halve`** [5] — damage halved (byte). CotAB 81 (0x28CCF).
- **`halveType`** (`mask`) [6] — damage of a type in `mask` halved. PoR 93, 114, 118 (25a2, 2a6d, 2b63).
- **`halveByWeaponKind`** (`kinds`, `unarmed`?) [5] — an attacker's weapon of an ITEMS kind (byte 7: 0 slashing, 1 piercing, 0x80 bashing) in `kinds`, or with `unarmed` no weapon: half. PoR 94, 115 (25bc, 2a87).
- **`halveByPlus`** [5] — an attacker's magic weapon (plus > 0): half. PoR 116 (2ae6).
- **`halfForWord`** (`word`) [5] — no weapon: nothing; a weapon of plus 0: half when its name word +0x31 is `word` (Silver), else nothing. PoR 123 (2d88).
- **`needsMagicOrWord`** (`word`) [5] — no weapon, or one of plus 0 not named `word`: no damage. PoR 96 (264b).
- **`needsEnchantment`** (`hd`) [5] — no weapon or one of plus 0: no damage, unless the attacker is race 0 with `hd` hit dice or more. PoR 119 (2b7d).
- **`magicWeapons`** (`full`) [5] — no weapon or plus 0: no damage; plus below `full`: half. CotAB 60 (0x28628).
- **`piercingOne`** [5] — a piercing weapon (ITEMS kind 1, **I**): damage 1. CotAB 85 (0x28D64).
- **`resist`** (`type`, `save`, `onRemoval`?) [every event] — damage of `type` halved as a byte and save += `save`, both only when the damage type has `type`; not on removal unless `onRemoval`. PoR 10, 20 (03e1, 06e4, onRemoval); CotAB 20 (0x277D0).
- **`resistPerDie`** (`type`, `per`, `save`?, `magic`?) [every event] — damage of `type`: for each die of the dice count, damage := (damage − `per`) as a byte, raised back to the count when below it; with `save` the save += `save`, and with `magic` damage without that bit is negated. PoR 61 (1490: per 2, save 4, magic 8), 113 (2a28: per 1).
- **`immuneSpell`** (`spell`, `mask`) [6] — spell `spell`: no damage, "is unaffected"; else damage of `mask`: none. PoR 91 (0x39786).
- **`immuneType`** (`mask`) [6, 9] — damage of `mask`: none (6); otherwise (9) the effect being added is blocked. PoR 110, 112 (29d9, 2a11).
- **`immune`** (`mask`, `say`) [6] — damage of `mask` negated, with `say` "is unaffected". CotAB 73, 110, 135 (0x28A22, 0x29502, 0x29B05).
- **`immunities`** (`types`, `saveType`) [9, 12] — the effects `types` blocked (9); a save of `saveType` always made (12). PoR 111, 125 (29f0, 2e08).
- **`blocks`** (`types`, `pct`?, `mask`?) [6, 9] — the effects `types` blocked, with `pct` only on d100 ≤ `pct`; with `mask`, damage of that type negated too. PoR 107–109, 124 (2992, 29b6, 29cb, 2de4); CotAB 133 (0x29AA0).
- **`magicResist`** (`base`, `classes`) [6, 9] — an effect being added, or magic damage, is negated on d100 ≤ `base` − 5 × (11 − the current character's best level of `classes`, at least 1). PoR 105, 106 (2976, 2984 → 3723_2915).
- **`magicResistance`** [6, 9] — every effect added and all magic damage negated. CotAB 129 (0x29973).
- **`minorGlobe`** (`below`) [6, 9] — a resolving spell of level (spell record byte 1, signed) below `below` is negated. CotAB 63 (0x2871A).
- **`weakTo`** (`saveOn`, `double`, `saved`) [12, 20] — damage of `saveOn`: save += 2; else damage of `double`: × 2 as a byte (with `saved` only when the save failed). CotAB 50, 54 (0x28562, 0x28593: 54 reads DS:5D0B instead of the saved flag, 0 in combat, **?** a bug; the profile gives it saved 0).
- **`fireColdSave`** [5, 6] — fire or cold: a save vs spell; saved and the spell's save byte (record +8) set: none, else half. CotAB 82 (0x28CE0).
- **`absorbElectricity`** [6] — electricity negated and HP += 8 past the maximum (byte; a 1d8 is rolled and dropped, **I**: a bug). CotAB 84 (0x28D31).
- **`conSave`** (`saveTypes`, `bands` [[CON, n]]) [12] — a save of a type in `saveTypes` gets the bonus of the highest band reached by CON (none below the first). PoR 90, 97 (24d9, 268a).
- **`vulnerableTo`** (`item`, `roll` [n, d, add], `diceOn`?, `keep`?) [5, 6] — the current character's weapon of ITEMS type `item` (holy water, oil) does `roll` (counting dice with `keep`) + add as a byte; with `diceOn`, damage of that type then gains the dice count as a byte. PoR 117, 122 (2b20, 2d38).
- **`unlessKilledBy`** (`mask`, `effect`, `roll` [n, d]) [13] — unless the killing damage had a type in `mask`: `effect` raw for `roll` (flag 1). PoR 100 troll (27d9).

### 3.4 Targeting and protection

- **`warded`** (`words`, `pairs`) [0] — a target with a readied item named one of `words` (+0x31), or with name words (+0x30, +0x31) one of `pairs`, cannot be attacked. PoR 126 (2e37: Mirror, Holy Symbol).
- **`imageLost`** [5, 6] — against a single-target spell (spell ≠ 0, not an area), 1d(power + 1) > 1: no damage, "lost an image", power − 1, the record goes at 0. PoR 28 (0x37BF0).
- **`mirrorImage`** [5, 6] — 1d((power >> 4) + 1) > 1 against a single-target spell: negated, "lost an image", power − 1 (byte), the first record goes at 0. CotAB 28 (0x27A8F).

### 3.5 Effects that last, end or re-arm

- **`expireInto`** (`type`, `duration`, `power`, `flag`, `msg`?) [removal] — `msg`, then `type` added raw. PoR 4 (0x373AF), 59 (1472).
- **`statUp`** (`stat`, `msg`, `at`, `effect`, `duration`, `power`, `hpFrom`, `fighter`, `fighterOnlyFrom`) [removal] — `msg`, the stat + 1; from `at`, `effect` raw for `duration` (power `power`, flag 1) and nothing more; otherwise from `hpFrom` the hit-point gain of [engine/effects.md](../A-games/engine/effects.md) row 7 (byte sums over the class levels, class `fighter` by stat − `hpFrom`, the others 2 or 1; none from `fighterOnlyFrom` without a `fighter` level), added to max HP and HP. PoR 7 (0x37463).
- **`restoreStrength`** (`types`) [removal] — an active STR record (power < 0x80) restores the STR it holds; the strongest other record of `types` then takes over ([procedures.md §12.3](procedures.md#123-the-strength-spells)). PoR 12, 38 (04ba).
- **`restoreStat`** (`stat`) [removal] — the stat := the power. PoR 14 Friends (05d6).
- **`poisonTick`** (`duration`, `power`) [removal] — re-armed for `duration`; then above 1 HP, 1 point of damage (type 0). PoR 15 (05eb).
- **`poisonEnds`** (`poison`, `msg`, `also`) [removal] — still poisoned (`poison`): status 6 with `msg`; then `also` goes without re-arming. PoR 22 Slow Poison (0x379A5).
- **`loseStrength`** (`duration`, `floor`, `msg`, `helpless`) [removal, direct] — on removal re-armed for `duration` (nothing when suppressed); above `floor` STR: `msg` and STR − 1; else `helpless` raw, permanent. PoR 43 (0x3830E).
- **`loseHp`** (`duration`, `helpless`) [removal, direct] — re-armed for `duration`; below 2 HP `helpless` once, else 1 point of damage. PoR 44 (1168).
- **`runTypes`** (`types`) [as listed] — the behaviours of `types` run with this record. PoR 34 Cause Disease (0bcf).
- **`regenerate`** (`duration`, `force`) [removal] — re-armed for `duration`, then 1 HP healed (`force`: past what blocks healing) with the healed line. PoR 50, 62 (12fb, 14eb).
- **`rot`** (`stat`, `loss`, `floor`, `duration`, `msg`, `death`) [removal] — unless suppressed: `msg`, the stat − `loss` (not below `floor`); with uses left (power >> 4 > 1) re-armed one fewer, else `death` and status 6. PoR 57 (0x385C9).
- **`grant`** (`type`, `duration`, `power`, `below`?) [8, 19] — `type` raw (flag 0), with `below` only on d100 < `below`. PoR 56, 72 (1363, 1730).
- **`startUnless`** (`unless`, `effect`, `duration`) [5, 6] — with none of `unless`, `effect` raw (flag 1). PoR 101 (2814).
- **`startInvisible`** (`effect`) [22] — `effect` raw from the start of combat (duration 0xFF, power 0xFF). CotAB 138 (0x29C20).
- **`healEachRound`** (`hp`) [19] — HP += `hp`, up to the maximum. PoR 98 (2700).
- **`revive`** (`full`, `keepPower`) [removal] — back up with the current HP (`full`: the maximum); when that fails, re-armed for 1 (power kept with `keepPower`, else 0). PoR 78, 102 (19d9, 2866).
- **`rally`** (`full`, `after`) [8, 13] — dying: up `full` − combat record +0x0E; unconscious: up `full`; revived with that many HP: `after` for 1d4 + 1 (flag 1), and this record goes. PoR 99 (2730).
- **`diesAtEnd`** (`msg`) [removal] — still in play: status 6 with `msg`. PoR 95 (0x39840).
- **`escapes`** (`msg`, `status`) [13] — no removal callback, `msg`, status `status`, out of play. PoR 103 (0x39AEF).
- **`collapse`** (`msg`, `move`) [removal] — unless suppressed: `msg` and status 6; the side back from the power's high nibble, computer control, not undead, sweep := the fighter level, base movement `move`, morale 0xB3 → 0, monster type 0. PoR 32 Animate Dead (0x37D4B).
- **`suffocate`** [15] — power 0: status 6 "Suffocates", else power − 1. CotAB 13 (0x276C9).
- **`refillUses`** [removal] — the paladin's Cure Disease uses refilled ([procedures.md §10](procedures.md#10-class-abilities)). CotAB 141 (0x29C3F).
- **`liftZone`** (`cell`) [removal] — in combat, the owner's cloud zone of `cell` squares numbered power >> 4 lifts with "The air clears a little..." when there is one: the old cells back (a body's cell where one lies), the other zones of the same list drawn again. PoR 40 (0x37EF3, cell 0x1E); CotAB 91 (0x28E09, cell 0x1C).

### 3.6 Charm, morale and control

- **`charmed`** (`morale`) [15, 17, 19] — the first call (power bit 0x20 clear) marks the power, keeps the old side in bit 6, takes the charmer's (bit 7), computer control, morale 0xB3 (when below 0x80), no target; morale := `morale` on 17. Removal: the old side back, morale 0xB3 → 0. PoR 11 Charm Person (0400).
- **`berserk`** (`say`, `restore`) [15] — computer control, morale 0xB3 (0xB2 for an NPC with its own); with `say` only in combat: no target, then the nearest combatant becomes the target (**I**: ties to the earlier entry), the side the opposite of its, "goes berzerk" (sic). Removal: morale 0xB3 → 0; side 0, or the power with `restore`. CotAB 77, 137 (0x28B03, 0x29B30).
- **`confusion`** (`flee`, `berserk`) [21] — d100: 1–10 the record goes, forced to flee (record +0x10 = 1), computer control, morale 0xB3, no target, `flee` added for 10 with "runs away"; 11–60 "is confused", the turn ends; 61–80 `berserk` added for 1 with power the side and "goes berserk", then run at once; 81–100 "is enraged"; then a save vs spell at −2 removes the record. CotAB 35 (0x27D29).
- **`runsAway`** [removal] — morale 0xB3 → 0 and computer control off; no longer forced to flee. CotAB 142 (0x29C82).
- **`fearAura`** (`saveType`, `hdUpTo`, `effects`, `power`, `msgs`) [8] — each enemy in sight in play that fails a save vs `saveType`: by hit dice, up to `hdUpTo[i]` gets `effects[i]` raw with `msgs[i]`. PoR 81 (0x38CDA).
- **`paralysingAura`** (`bonus`, `crowd`, `raceBonus` [race, n], `effect`, `roll`, `power`, `msg`) [8] — everyone else's records of this type go; then each enemy in play saves vs 0 at `bonus` if its side has `crowd` or more in play (`DS:6814[side]`), + n for that race, or gets `effect` for `roll` rounds with `msg`. PoR 82 (0x38DD8).
- **`breakSpell`** (`msg`, `sayOn`?, `acWorse`?, `acFloor`?) [11, 15] — a spell being cast is lost, with `msg` (only on `sayOn`); with `acWorse`, on 11 the rear AC that much worse (no worse than `acFloor`) and the front AC the same. PoR 21 Silence, 30 Stinking Cloud (0x3793F, 0x37C95).
- **`feeblemind`** [direct] — INT and WIS := 7, "is stupid"; in combat the spell being cast is lost ("lost a spell", forgotten). CotAB 68 (0x288E5).

### 3.7 Holding, draining, engulfing

- **`attach`** (`drain`, `duration`, `held`) [2] — an active target: `drain` raw on the holder (power the target's list index, flag 1), `held` raw on the target, its movement gone. PoR 76 stirge (18b5).
- **`holdFast`** (`maxStr`, `crush`, `held`, `msg`) [2] — an active target with STR below `maxStr`: `crush` on the holder (power its index, flag 1), `held` on it, `msg`. PoR 77 (0x38B65).
- **`crush`** (`attacks`, `dice`, `sides`, `held`) [13, 15] — the victim at index power & 0x3F; while both are in play (not a removal), on 15 `attacks` attack of `dice`d`sides` from hand 1, the turn ends, the record goes if the victim fell. Otherwise `held` goes from the victim and, unless this is the record's own removal, the record goes with its callback flag cleared first. PoR 74 (3aae_3a86).
- **`bloodDrain`** (`sides`, `held`, `msg`, `keep`) [13, 15] — the victim at index power & 0x3F; while both are in play, on 15 `msg`, 1d`sides` (type 0, counting dice) to the victim, the turn ends; the victim still in play and the pool (duration >> 4) above the damage: pool − damage (16 a point), else the record goes. Otherwise as `crush`, and a drainer still in play with its victim in play is forced to flee (sated). PoR 75 (0x3899F).
- **`engulf`** (`held`, `suffocate`, `marker`) [2] — both hand-1 hits on an active target without `held` and `suffocate`: "engulfs", `held` raw on the target (power its index, run at once), `suffocate` raw (power 2d4), the engulfer's `marker` (power the index, flag 1). CotAB 57 (0x2E582).
- **`hug`** (`held`, `marker`) [2] — an attack roll of 18 or more: "hugs", `held` on the target, `marker` on the hugger. CotAB 96 (0x2ED5C).
- **`heldVictim`** (`marker`, `attacks`, `held`, `also`) [14] — the victim at index power: while both are in play, `attacks` attacks of 2d8 on it, the turn ends, and the marker goes when it fell; otherwise (or on removal) the victim is let go (`held` and `also` removed) and the record goes (callback flag cleared). CotAB 139, 144 (0x2EB16, 0x2EC4C).
- **`snakes`** [7] — not on removal: the attacks left are taken from the power; while power remains, "is fighting with snakes" and the turn ends; when it runs out the record goes. CotAB 3 (0x2742C).

### 3.8 On-hit effects

- **`poisonOnHit`** (`bonus`, `effect`, `msg`) [3] — the attacker's active target saves vs 0 at `bonus` or gets `effect` (add, permanent, power 0xFF) and status 6 with `msg`. PoR 64–66, 70 (3723_1545).
- **`paralyseOnHit`** (`duration` or `roll` [n, d, add], `effect`, `power`, `msg`, `notRace`?) [2, 3] — for `duration` (or `roll`, rolled first) the attacker's active target saves vs 0 or, `msg` with the sparkle, gets `effect`; with `notRace` not when the target is of that race. PoR 67–69 (3723_15eb).
- **`drainOnHit`** (`levels`) [2, 3] — an active target loses `levels` levels (drain). PoR 85, 86 (23a4, 23c2).
- **`diseaseOnHit`** (`heal`, `healFor`, `rot`, `rotFor`, `msg`) [2, 3] — a target without `heal` gets it (`healFor`, flag 1) and `rot` (`rotFor`, power 1d6 << 4 | 0x0F, flag 1), `msg`. PoR 87 mummy rot (0x3961C).
- **`hitDamage`** (`count`, `sides`, `dmgType`, `active`?, `keep`?) [2] — `count`d`sides` of `dmgType` to the target; with `active` only to one in play (the type set only then). PoR 79, 80 (1a19, 1a4c); CotAB 123 (0x298ED).
- **`holdOnHit`** (`save`, `effect`) [2] — the target saves vs `save` or gets `effect` raw for good (power 0xFF), "is paralyzed". CotAB 122 (0x29873).
- **`rake`** (`attacks`, `dice`, `sides`, `msg`) [2] — both hand-1 attacks hit an active target: hand 2 gets `attacks` attacks of `dice`d`sides`, hand 1 none, `msg`, the attacks from hand 2, the turn ends. PoR 73 (0x3E4B2).
- **`quarrelSlays`** (`type`, `word`) [5] — the attacker's weapon of ITEMS type `type` named `word` takes the holder out of play (status 8), then event 13. CotAB 130 (0x29993).
- **`zap`** [5] — an adjacent attacker takes twice the damage as magic, "gets zapped". CotAB 143 (0x29CC5).
- **`dispelEvil`** (`flag`, `removes`) [2] — a target with that class flag failing a save vs spell: status 8 "is dispelled", and the effects `removes` leave the attacker; else "resists dispel evil". CotAB 145 (0x29D69).
- **`conjuredItem`** (`bytes` [[offset, value]], `match`, `msg`) [19] — while the effect lasts the holder carries the item `bytes` (found by the bytes at offsets `match`): made with `msg` when missing and there is room (16 items); removed on removal; the statistics again either way. PoR 23 Spiritual Hammer (0x37A10).

### 3.9 Monster specials (event 14)

Gazes, breaths and spits that act before the monster's attacks; those that need the battlefield are §5.

- **`stoneGaze`** (`reflectable`, `word`, `save`, `status`, `msg`) [14] — at an active target, "gazes..." and the gaze flight; a gazer with effect `reflectable` meeting a readied item named `word` (+0x31): "reflects it!", the gazer becomes the victim; the victim saves vs `save` or takes status `status` with `msg`. PoR 83 (0x38EDD).
- **`charmGaze`** (`spell`, `save`, `bonus`, `effect`, `power`) [14] — at an active target, "Gazes..." with spell `spell` resolving; a failed save vs `save` at `bonus` adds `effect` (power side << 7 | `power`, flag 1, negating save) and runs it. PoR 84 (0x390A7).
- **`spitOnce`** (`pct`, `range`, `roll`, `dmgType`, `save`, `also`, `keep`) [14] — an active target closer than `range`, d100 ≤ `pct`: the turn ends, "Spits Acid", `roll` of `dmgType` halved by a save vs `save`; then this record and `also` go. PoR 121 (0x39E4C).
- **`spitAcid`** (`range`, `pct`, `hook`) [14] — the hook (spell `hook`) picks the target; within `range`, d100 ≤ `pct`: "Spits Acid", the spitter's maximum HP, half on a save vs breath; else "Spits Acid and Misses". CotAB 86 (0x49B5E).
- **`breatheFire`** (`pct`, `dmg`, `hook`) [14] — the hook picks the target; d100 ≤ `pct` and adjacent: fire, the turn ends, "Breathes Fire", `dmg` halved by a save vs breath. CotAB 131 (0x4A001).
- **`gazeHold`** (`minutes`, `hook`, `effect`) [14] — no target, then the hook picks one; "gazes..."; a failed save vs petrification gives `effect` raw for `minutes` (power 0xFF), "is paralyzed". CotAB 126 (0x4A214).
- **`gazeStone`**, **`eyeRays`**, **`breathBolt`**, **`breathArea`**, **`throwLightning`** — §5.

### 3.10 Item behaviours

Seven item behaviours, called after readying (`ready`) or putting away an item with +0x3E ≥ 0x80;
+0x3D is the item's value (an effect type, a stat, an alignment and damage).

- **`grantEffect`** (`power`, `flag`, `quietly`?, `outsideCombat`?) — ready: effect +0x3D raw (permanent, `power`, `flag`) and its behaviour run at once (with `outsideCombat` only out of combat); put away: the first record of that type removed (with `quietly` without its callback). PoR 128–130, 133, 134, 136, 138, 139 (2eda: power 0x0C, flag 0, quietly); CotAB kind 0, the generic handler 147 (0x29A23: power 0xFF, flag 1, outsideCombat).
- **`strengthItem`** (`str`, `pct`, `effect`, `msg`) — ready: try STR `str`/`pct` (setCurrent rule), `msg` when it rose, and always `effect` (flag 1) holding the STR to restore; put away: the record of that STR removed (bug kept: at that STR now, the first record of the type, whatever it holds). PoR 131 Gauntlets of Ogre Power (0x3A187).
- **`alignmentLocked`** (`alsoUnready`?) — +0x3D low nibble an alignment, high nibble damage: on readying (with `alsoUnready` also on putting away), a character of another alignment puts it down and takes that damage as magic. PoR 132 (30a5); CotAB kind 4.
- **`needsStrength`** (`str`, `msg`) — readied with STR below `str`: put down with `msg`. PoR 135 Boulder (0x3A364).
- **`unreadyEnds`** (`type`) — put away: effect `type` ends (Spiritual Hammer, and with it the item). PoR 137 (317a); CotAB kind 9.
- **`doubleSlots`** (`levels`) — ready: the magic-user slots of levels 1..`levels` doubled; put away: worked out again from the magic-user level alone (with the former level when it counts: one first-level slot, then the increments of levels 2.., `T.muSlots`), and memorised magic-user spells beyond their level's slots forgotten (**I**: the other ring forgotten, as the original). CotAB kind 1 Ring of Wizardry.
- **`recomputeStats`** (`stats`, `fromValue`?, `thief`?) — the current-stat routine for `stats` (with `fromValue`, for the stat +0x3D when ≤ 5); with `thief`, the thief skills again. CotAB kinds 2, 5, 6, 8, 0x0A–0x0D.

## 4. Spell kinds

### 4.1 The spell map (`SpellRules`)

The module `spells` of the profile:

| Field | Meaning |
|---|---|
| `handlers` | spell id → `{ k, msg?, sound?, aiTarget?, …parameters }` for **every** id the game has (as the original's handler table: PoR DS:6B84 + 4·id filled by `FUN_4e53_3413`, CotAB DS:72BA filled at 0x4A4FF); an unlisted id adds the spell's effect as `apply` does |
| `strength` | the STR rule: `setCurrent` or `overBase` ([procedures.md §12.3](procedures.md#123-the-strength-spells)) |
| `durations` | the special cases of the duration routine by id (PoR `FUN_4e53_07d6`; CotAB 0x44E02 is byte-identical) |

Common parameters: `msg` the line on each creature the effect took (with the sparkle in combat);
`sound` the cast sound in combat (default 2); `aiTarget: woundedNear` the computer's target for a
friendly spell (the most hurt adjacent ally, else itself).

**Terms and amounts.** A `Term` is a number, `L` (the caster level), `L/2` (L div 2), `(L+1)/2`, or a
rolled count `{ roll: [n, d], mul?, add? }` (= roll(n, d) × mul + add). An `Amount` is `{ n, d, plus? }`:
roll(term n, d) + term plus, where `plus: n` adds the dice count again (CotAB's Magic Missile). The
counting-dice parameter `recordDice` makes the roll record its count (DS:681C) for the resistances.

**Durations** in minutes: the special case, or the spell record's d0 + d1 × L. A `Rolled` case is
roll(n, d) × mul + add, with `outside` used out of combat; a `record` case takes d0 and d1 from that
other spell record (bytes 4 and 5) read from START.EXE. Both games: 40 → 1d6 × 10; 57, 61 → 5d4; 59 →
1d4 × 10 + 40; 63 → 2d10 × 10 (outside combat 1d10 × 10 + 100); 67 → 1 440. CotAB adds 78 → record 0x88
(Entangle's handler asks for Duration(0x88), past the table: 6 + 3·L, a bug kept; **I**: at the cast's
level).

**Item spells** (`rules.spells.itemSpell { mask, above, minus }`): the spell an item casts with Use
is +0x3D & `mask`, less `minus` when above `above` (PoR `FUN_4894_1a8a`, 0x3A468: 0xFF, 0x38, 0x17,
because its item spells are records 0x39–0x43 stored as 0x50–0x5A; CotAB 0x3FA0D: 0x7F, none). A
scroll casts each of its spells (+0x3C..0x3E & 0x7F, non-zero); another item casts its +0x3D when
+0x3E < 0x80. A cast from a scroll clears that spell; a charged stack loses a unit, a single item a
charge (gone at 0).

### 4.2 Shared kinds

Twenty kinds that work the same in and out of combat (they reach the world through the host).

- **`applyTo`** (`to` caster or first, `effect`?, `power`?, `sideShift`?, `flag`, `duration`?, `runNow`?, `stat`?) — the spell's effect (or `effect`) on the caster or the first target through the add-effect procedure: power L, or `power` (a number or a rolled amount), or L + (caster's side << `sideShift`); a fixed `duration` if given; `runNow` runs it at once; `stat` is worked out again on the caster afterwards. PoR 28 Spiritual Hammer (19c3), 42 Prayer (24d6), 67 Manual of Bodily Health; CotAB 14 Friends (0x4614A).
- **`enlarge`** (`levels` [[STR, %]] by L, `beyond`?, `effect`, `msg`, `unaffected`?) — the first target's STR from the table by caster level; past it `beyond`, or the last entry; the game's STR rule decides. PoR 12 (12a5); CotAB 12 (0x45F75).
- **`reduce`** (`effect`, `saveType`, `silent`?) — on a failed save, one record of `effect` ends ("is Cured", or with `silent` without it), then `msg`. PoR 13 (136e); CotAB 13 (0x460AA).
- **`friends`** (`amount`, `cap`, `effect`) — CHA + the amount (capped at `cap`); the effect holds the old CHA. PoR 14 (13d8).
- **`slowPoison`** — only on a poisoned target (0x37) not Animated: 0 HP becomes 1, 0x16 added (flag 1, with the line), the target revived, 0x0F raw for 10. PoR 26 (185b).
- **`strengthByClass`** (`bonus` [{ cls, d }], `pctClasses`, `effect`, `counts`?, `rollCounting`?, `bonusPower`?) — a die per class group; the last group that applies wins; PoR rolls every die first, with `rollCounting` only an applying group rolls (none applies: 0, **I**); a class applies with a level > 0 (PoR, unsigned) or with `counts: levelOrFormer` a level > 0 or a former level above `hpLevel` (signed); over 18 the classes `pctClasses` get 18/(% + 10 × excess, at most 100), others 18; with `bonusPower` the effect's power is bonus + that. PoR 35 (1f41); CotAB 35 (0x46BCB).
- **`setStrength`** (`str`, `pct`, `effect`) — STR `str`/`pct` as the effect by the game's STR rule. PoR 59 (2ee5); CotAB 59 (0x47F27).
- **`curePoison`** (`effect`, `removes`, `unaffected`) — an Animated first target: nothing; a poisoned one: 0 HP becomes 1, `removes` taken out without re-arming, the line, status 0 and in play; anyone else `unaffected`. CotAB 67 (0x4814A).
- **`raise`** (`statuses`, `races`, `removes`) — a first target of a status in `statuses`, base CON > 0, not of `races`: `removes` without re-arming, status 0 and in play, base CON − 1 (the current CON worked out again), HP 1, the line; no survival roll (**?**: on the battlefield the port puts no fallen body back on its square). CotAB 75 (0x4848A).
- **`slay`** (`probe`, `probeType`, `saveType`, `amount`, `dmgType`, `unaffected`) — a probe: event 9 with damage `probe` of type `probeType`; zeroed: `unaffected`; else a failed save is status 6 with the line, a saved one takes the amount (type `dmgType`, counting dice, no save). CotAB 76 (0x4856D).
- **`flameShield`** (`prompt`, `abort`, `aiPick` { d, above }, `options` [{ name, effects [[type, line]] }]) — the caster picks an option (the computer the first when 1d`d` > `above`, else the second; a player from the menu `prompt`) and gets its effects through the add-effect procedure (power 0, flag 0, each with its line; '' none); a player who picks neither is asked `abort` (yes: lost), else asked again. CotAB 85 (0x48BB2; IMP-071: the menus always return a choice).
- **`animateDead`** (`effect`) — ignores targeting: every dead creature of monster type 0, while L lasts: side the caster's, computer control, undead 2, sweep 0, base move 6, memorised spells cleared, morale 0xB2/0xB3, monster type 4, combat record +0x0A..0x0D cleared; L − 1 even when its square is taken (bug kept); revived at full HP, `effect` added (power L + old side << 4, flag 1, the line), status 1. PoR 36 (206f); CotAB 90.
- **`cure`** (`effect`) — one record of `effect` removed ("is Cured"), then the line with the sparkle. PoR 37 Cure Blindness (2217).
- **`cureDisease`** — `FUN_4e53_228a` without re-arming: one 0x22 ("is Cured"); one 0x2B ("is Cured") with the first 0x2C and 0x1F; one 0x32 ("is Cured") with the first 0x39. PoR 39 (232f → 228a).
- **`dispel`** — on the first target, one pass per target (bug kept): each effect of power < 0xFF still there goes on d100 ≤ chance (L against its power & 0x0F: L > lv 50 + 5(L − lv), L < lv 50 − 2(lv − L), else 50); the line once per pass that removed something. PoR 41, 46 (2385). The battle's `dispel` adds CotAB's zones (§4.3).
- **`removeCurse`** (`effect`, `item`?, `itemMsg`?) — one record of `effect` ("is Cured", then "is un-cursed"); else the first cursed item: PoR clears its curse byte; with `item: unready` it stays cursed but is put down, and when its +0x3E > 0x7F the generic item handler runs as a removal (the first record of type +0x3D goes) and all six stats are worked out again; then `itemMsg` (default "'s item is un-cursed"). PoR 43 (2540); CotAB 43, 89 (0x47575).
- **`restore`** — one drained level back: HP + ⌊drainHp / drainLevels⌋, the class whose next level needs the least experience (within its level limit) + 1 and experience raised to that level's need; the statistics again; the line. PoR 56 (2c43).
- **`toggle`** (`remove`, `effect`, `power`) — one record of `remove` ends ("is Cured"), else `effect` added at `power`. PoR 57 Potion of Speed (2e02).
- **`ointment`** (`amount`) — one poison (0x37) ends, with the first 0x16 without re-arming; else Cure Disease; else the amount healed with the line. PoR 58 Keoghtum's Ointment (2e4d).
- **`images`** (`amount`, `effect`?, `levelShift`?) — the effect with the amount as its power (with `levelShift`: (amount << shift) | L); with `msg` added through the add-effect procedure (CotAB), else raw (PoR). PoR 32 (1a8a); CotAB 32 (0x466B8).

### 4.3 The battle's kinds

Eighteen kinds that need the battlefield (in combat; outside combat they add the spell's effect at
power L through the add-effect procedure, §4.4). Targets are those the target picker returned
([engine/combat-rules.md, "Spell targets"](../A-games/engine/combat-rules.md#spell-targets-o-fun_3aae_20c3spell-ai-ok)).

- **`apply`** (`flag`?, `rollDuration`?, `immuneHd`?, `immuneMsg`?, `casterEffect`?, `saveShift`?, `runAfter`?) — Apply (PoR `FUN_4e53_08c3`, CotAB 0x44EEF): per target a touch roll for touch spells (range byte 0xFF; a miss: "*caster* misses"), the save, the spell's effect at power L (flag `flag`; duration `rollDuration` per target). Before it: `immuneHd`, a first target with that many hit dice only says `immuneMsg`; `casterEffect`, the caster first gets that effect (power 0, no line); `saveShift` `{ save, byClass, other }` moves the first target's save byte by its class while the spell resolves. After: `runAfter` first or each runs the targets' first record of the effect at once. Many ids in both games.
- **`applySide`** (`side` ally or enemy, `notEngaged`?) — the spell's effect only on targets of the caster's side (not next to an enemy, with `notEngaged`) or of the other side. PoR 1 Bless, 2 Curse (0f4f).
- **`applyProbe`** (`probe`) — `apply`, then on the caster's combat target event 9 with effect `probe` being added; unless blocked, `probe`'s behaviour runs as the caster's with a blank record (**I**: none without a combat target). CotAB 68 Poison (0x48240).
- **`heal`** (`amount`) — the first target healed by the amount (no revive in combat); the healed line, or `msg`. PoR 3, 62; CotAB 58, 71, 99.
- **`damage`** (`amount`, `dmgType`, `recordDice`?, `look`?) — one roll for every target; per target a touch roll for touch spells, damage type `dmgType`, the save byte's mode (half or negates); `look` centres the view on the aim point. PoR 4, 9, 15, 20, 47, 60, 64, 65; CotAB 66, 72, 74, 87.
- **`beam`** (`width`, `len`, `minLen`?, `amount`, `dmgType`?, `perTarget`?, `recordDice`?, `onlyType`?) — who stands in the area template from the caster towards the aimed square (`width` lines of max(`minLen`, `len`) squares) takes the amount (one roll, or `perTarget` a roll each); the spell's save, or with `onlyType` none: a creature of another monster type counts as saved. CotAB 92 Cone of Cold (0x494C0), 98 (0x49697).
- **`sleep`** (`pool`, `effect`, `hdCost`, `hd5`, `other`) — a pool of hit dice (amount), targets nearest first; the Animated, the asleep and the too costly skipped; cost by hit dice: `hdCost[hd]` for 0–4, at 5 `hd5[0]` for race 0 else `hd5[1]`, above or below 0 `other`; `effect` added at power L with the line. PoR 21 (151b).
- **`hold`** (`bonus` [1, 2, more targets], `effect`?, `sizeImmune`, `lastSaves`?, `runAfter`?, `pool`?) — last to first, a save bonus by the number of targets (**I**: CotAB's Hold Person leaves it uninitialised past 4); before each save but the last-listed target's, sound 2 and a bolt flight to it (**I**: a bug); with `sizeImmune` only man-sized or smaller can be held; with `lastSaves` the last-listed target counts as saved; the effect (or the spell's) at power L with negating save; `runAfter` each target's record at once. `pool` `{ size, by, costs, other }` makes the target picker buy targets from a pool (size a term; each pick costs `costs[target's byte by]`, else `other`; the pick that goes over still counts and ends it from the second on; a cancel or an empty pool ends it; the computer picking one again loses a point). PoR 23, 49 (1658); CotAB 79, 81, 94 (the Hold loop 0x45A94, the picker 0x2C7EA).
- **`saveEach`** (`effect`, `saveType`, `outdoorsOnly`?, `upTo`?) — each target saves vs `saveType`; the effect (power 0, flag 0, negated by the save) with the line; `outdoorsOnly`: nothing in a map area (ECL 0x49E6 ≠ 0); `upTo`: only that many targets (rolled first). CotAB 78 Entangle (0x4862B), 82 Confusion (0x487DD).
- **`saveOrElse`** (`dmgType`, `saveType`, `fail`, `pass`, `flag`) — damage type `dmgType` while the first target saves: a failure gets `fail`'s effect, a success `pass`'s (power 0, flag 0, the line), its first record run at once; then damage type 0 and `apply` with `flag`. CotAB 86 Fumble (0x48D66).
- **`scare`** (`width`, `len`, `saveType`, `effect`, `unaffected`) — who stands in the area template saves; a failure gets the effect (power 0, flag 1, negates) with the line and flees (record +0x10 = 1, computer control, morale 0xB3 unless above 0x7F, no target); a success `unaffected`. CotAB 84 Fear (0x48A52).
- **`teleport`** (`heldBy`, `releases`) — a caster held (`heldBy`) frees itself from each adjacent combatant whose first `releases[0]` (else `releases[1]`) record holds it; then it moves to the aimed square (**?**: the port only to a free square) and the line. CotAB 83 Dimension Door (0x488A1).
- **`charm`** (`sideMul`) — only man-sized or smaller ("is unaffected" else): the spell's effect at power L + caster's side × `sideMul`, flag 1, negating save, run at once, the line. PoR 10 Charm Person (11dd).
- **`charmByHp`** (`monsterType`, `effect`) — ignores targeting: creatures of `monsterType` while the caster's HP lasts get `effect` at power L. PoR 27 Snake Charm (190f).
- **`bolt`** (`amount`, `saveType`) — the aimed square takes the bolt hit, then the bolt path of `rules.bolt.lightning` squares with the bounce bonus ([procedures.md §15.2](procedures.md#152-the-bolt)). PoR 51 (2bb7); CotAB 51 (0x47C49).
- **`hasteSlow`** (`side`, `opposite`, `attacksAfter`) — up to L targets of the caster's side or the other, in list order; one holding `opposite` loses its first record ("is Cured") and is dropped but uses a slot; the effect on the rest; with `attacksAfter`, event 18 fires on each of them afterwards (Haste's first call ages them there). PoR 48, 55 (2764); CotAB 48, 55 (0x477EB, no event 18).
- **`cloud`** (`dirs` or `cells`, `count`, `cell`, `owner`, `replaced`, `firstZone`?, `dedupe`?) — the zone's number is how many zones of its kind the caster owns, the list's last not counted; the caster gets `owner` raw (duration L, power number × 16 + L, flag 1); the squares are `count` direction indices from entry 1 of `T[dirs]` through `T.wallDx/Dy` (8 = the square itself) from the aimed square; a square with a cell other than 0 that is not a wall is laid with `cell`, keeping the cell it found, except a square of a `replaced` kind takes the cell another zone of that kind found there (not one of `not`; the last such zone, or with `firstZone` the first), and a body's square the cell under the last body there; the line (no pause), the redraw, a hold of speed × 225 ms, then the occupant check on whoever stands on each square in order (with `dedupe` each creature once) ([procedures.md §15.3](procedures.md#153-clouds)). PoR 34 (1b11); CotAB 34 (0x4675B), 91 (0x48F05).
- **`dispel`** (`zones`?) — the shared `dispel`; then with `zones` each square of the 3×3 round the aimed square (here, N, NE, E, SE, S, SW, W, NW): on a cell of a listed zone kind, each zone of that kind not yet resisted with one of its squares there rolls d100 against the chance of L against its owner's magic-user level (with the former level when the **current** character's count, a byte): success removes the owner's `owner` record of the zone's number (lifting it), failure marks the zone resisted for good. CotAB 41, 46 (0x47154; Cloudkill's zones matched through Stinking Cloud's table read on for 9 entries, a quirk kept).

### 4.4 Casting outside combat

Outside combat (PoR `FUN_4e53_0c20` with the out-of-combat hook, [engine/spells.md, "Casting outside combat"](../A-games/engine/spells.md#casting-outside-combat-o-fun_4e53_0c20spell--from_memory)):
the miscast check (`rules.casting.miscast`), the spell forgotten unless from an item, "*caster*
casts *spell*.", then: `heal` heals the first target by the amount and always prints the healed
line, reviving the unconscious; a shared kind runs as in combat on the world host; any battle kind
adds the spell's effect to each target at power L through the add-effect procedure with its line.
The targets' statistics are worked out again after.

## 5. Monster specials and the target hook

The specials of event 14 that need the battlefield (**O** unless marked;
[engine/effects.md §2](../A-games/engine/effects.md#2-effect-table) row 88,
[coab/effects.md §2 and §7](../A-games/coab/effects.md#7-the-target-hook-bolts-and-the-area-template-o-unless-marked)).

**The target hook.** Before acting, a special calls the computer's spell target pick for a spell
(PoR DS:6B84[0] = `FUN_3aae_20c3(spell, ai 1, &ok)`; CotAB `*DS:72BA(DS:7760, 1, spell)`), which aims
and sets the combatant's target. A host without the battlefield keeps the current target if it is
in play, else takes the nearest enemy in play.

**The area template** (CotAB 0x4573F, `fan`: from the caster towards (x, y), `width` lines, `len`
squares): as [coab/effects.md §7](../A-games/coab/effects.md#7-the-target-hook-bolts-and-the-area-template-o-unless-marked);
the port's choices where the original reads unset memory: the line-of-sight range is unlimited
(**?**), and the side lines use the last step's direction when no creature was found on the first
line (**?**). The current combatant is never listed.

- **`breathBolt`** (`pct`, `spell`, `len`, `save`, `dmgType`?) — after round 0 only on d100 > `pct`; with `dmgType` that type first (CotAB's dead store: the hit sets 0x0C). "Breathes!"; the hook for `spell` aims; the bolt starts on the square next to the breather in that direction (x + sign(dx), y + sign(dy); one more where that is x + 1 or y + 1, the far side of a 2×2 breather); invisibility (25) goes; the flight (COMSPR cycle 19, 4 frames, 50 ms); that square takes the bolt hit, then the bolt runs `len` squares (no bounce bonus), both for the breather's maximum HP, a save vs `save` halving; power above 0xFD counts down, else the record goes (three breaths from 0xFF); the turn ends. PoR 88 (`FUN_4e53_30d9`, image 0x41609); CotAB 88 (0x499CD).
- **`throwLightning`** (`rounds`, `spell`, `count`, `sides`, `len`, `save`) — in rounds below `rounds` only: "throws lightning"; the hook aims (without a target the aim stays on the thrower's own square, which the first bolt then hits, **O**); invisibility goes; the flight; the aimed square takes a bolt hit of `count`d`sides` (counting dice), then a bolt of `len` squares from there with a fresh roll, saves vs `save`; the turn ends. CotAB 132 (0x4A121).
- **`breathArea`** (`uses`, `dmgType`, `spell`, `width`, `len`, `ownSide`, `msg`) — round 0 sets the power to `uses`; none left: nothing; damage type `dmgType`; the hook must find a target; the template lists who is hit; with `ownSide` the breath is held back when anyone listed is not on the side opposite the breather's; "*name* `msg`", one frame of COMSPR cycle 18 flies to the first listed (30 ms); each listed takes the breather's maximum HP, half on a save vs breath; power − 1; the turn ends. CotAB 90 (0x49C94), 128 (0x49E74).
- **`eyeRays`** (`shots`, `ranges`, `saves`, `statuses`, `frames`, `wound`, `spells`) — the target is cleared and a new one found (the finder over the whole field, forcing a new target); then up to `shots` times while there is a target: the first unused ray whose range reaches it: disintegrate, stone, death (a save of `saves[i]` or status `statuses[i]`: "is disintergrated" (sic), "is Stoned", "is killed") and wounding (`wound` = count, sides, plus, no save, "wounds you"); each with one frame of COMSPR cycle `frames[i]` + 13 flying to the target (30 ms), the finder keeping or replacing the target after it; with no ray in reach, the first unused of `spells` is cast as the computer casts. Each kind once a turn. CotAB 87 (0x2E842).
- **`gazeStone`** (`spell`, `word`) — the target is cleared and the hook picks one; none: nothing. "gazes..." and the spell bolt (cycle 18, 4 frames, 45 ms); with effect 0x7F on the gazer, the target's first readied item named `word` in any of its three name words reflects it back and the gazer is the victim; the victim saves vs petrification or is stoned. CotAB 83 (0x497CE).

## 6. The effect handler maps

*The two games' `effects.handlers` (kind **C**).* PoR's map covers its handler table's types 1–127
(`FUN_5216_0000`); CotAB's covers 1–146 (DS:6FC0 + 4·type) and starts from PoR's entries, overriding
the changed ones ("same" = PoR's entry with the same parameters). Type 147, the generic item handler,
runs for items only (item map kind 0). Text parameters are quoted game text (see the introduction).
Hexadecimal values are effect types, item types, name words, flags and masks; others are decimal.

| Type | PoR | CotAB |
|---|---|---|
| 1 | `rollMorale` roll 1; morale 5 | same |
| 2 | `rollMorale` roll -1; morale -5 | same |
| 3 | `vsTargetType` bonus [[4, 2]] | `snakes` |
| 4 | `expireInto` msg "starts to train"; type 7; duration 43200; power 0xFF; flag 1 | `attackerClass` flag 1; roll -7 |
| 5 | `none` | same |
| 6 | `vsTargetType` bonus [[10, 1], [9, 2], [12, 2], [4, 3]]; dmgType 9 | same |
| 7 | `statUp` stat 4; msg "is hardier"; at 20; effect 0x3E; duration 60; power 0xFF; hpFrom 15; fighter 2; fighterOnlyFrom 17 | `acBoth` add 2; cap 0x3C |
| 8 | `saveVsAlignment` alignments [2, 5, 8]; save 2 | same |
| 9 | `saveVsAlignment` alignments [0, 3, 6]; save 2 | same |
| 10 | `resist` type 2; save 3; onRemoval 1 | same |
| 11 | `charmed` morale 100 | same |
| 12 | `restoreStrength` types [0x0C, 0x26] | `none` |
| 13 | `none` | `suffocate` |
| 14 | `restoreStat` stat 5 | `none` |
| 15 | `poisonTick` duration 10; power 0xFF | same |
| 16 | `none` | same |
| 17 | `shield` ac 57; save 1; spell 15 | same |
| 18 | `namedFoe` who "target"; monsterType 1; size 1; roll 1; names ["KOBOLD", "KOBOLD LEADER", "GOBLIN", "GOBLIN LEADER"] | `targetClass` flag 2; roll 1 |
| 19 | `none` | same |
| 20 | `resist` type 1; save 3; onRemoval 1 | `resist` type 1; save 3 |
| 21 | `breakSpell` msg "is silenced" | same |
| 22 | `poisonEnds` poison 0x37; msg "dies from poison"; also 0x0F | same |
| 23 | `conjuredItem` bytes [[46, 20], [48, 20], [49, 243], [50, 1], [61, 23], [62, 137]]; match [46, 49]; msg "Gains an item" | same |
| 24 | `none` | same |
| 25 | `unseen` detect 0x18; roll -4 | `invisibility` detect 0x18 |
| 26 | `namedFoe` who "target"; monsterType 1; size 1; roll 1; names ["ORC", "ORC LEADER", "GOBLIN", "GOBLIN LEADER", "HOBGOBLIN", "HOBGOBLIN CHIEF", "GAGOOL", "MACE"] | `targetClass` flag 4; roll 1 |
| 27 | `none` | `endTurn` |
| 28 | `imageLost` | `mirrorImage` |
| 29 | `damageCut` part 4 | same |
| 30 | `breakSpell` msg "is coughing"; sayOn 15; acWorse 2; acFloor 0x32 | same |
| 31 | `endTurn` event 7 | `endTurn` |
| 32 | `collapse` msg "collapses"; move 12 | same |
| 33 | `penalty` roll -4; ac -4; save -4 | same |
| 34 | `runTypes` types [0x2B, 0x2C] | same |
| 35 | `saveElseRoll` save 1; roll 1 | `confusion` flee 0x8E; berserk 0x89 |
| 36 | `penalty` roll -4; save -4 | same |
| 37 | `blink` | `notReady` |
| 38 | `restoreStrength` types [0x0C, 0x26] | `none` |
| 39 | `attackRate` ages 0x10; msg "ages"; mul 2 | same |
| 40 | `liftZone` cell 0x1E | same |
| 41 | `deflect` pct 100; plainWeapon 1 | same |
| 42 | `attackRate` div 2 | same |
| 43 | `loseStrength` duration 60; floor 3; msg "is weakened"; helpless 31 | same |
| 44 | `loseHp` duration 10; helpless 31 | same |
| 45 | `saveVsAlignment` alignments [2, 5, 8]; save 2 | same |
| 46 | `saveVsAlignment` alignments [0, 3, 6]; save 2 | same |
| 47 | `namedFoe` who "attacker"; monsterType 1; size 2; sizeMask 127; roll -4; names ["OGRE", "OGRE LEADER", "TROLL", "FIRE GIANT", "HILL GIANT", "FROST GIANT", "STONE GIANT"] | `attackerKind` types [2, 0x0A]; size 2; roll -4 |
| 48 | `namedFoe` who "attacker"; monsterType 1; roll -4; names ["BUGBEAR", "GNOLL"] | `attackerKind` types [1]; size 2; roll -4 |
| 49 | `prayer` sideBit 0x10; save 1; roll 1 | same |
| 50 | `regenerate` duration 14400; force 1 | `weakTo` saveOn 2; double 1; saved 1 |
| 51 | `endTurn` event 7 | `endTurn` |
| 52 | `endTurn` event 7 | `endTurn` |
| 53 | `endTurn` event 7 | `endTurn` |
| 54 | `none` | `weakTo` saveOn 1; double 2; saved 0 |
| 55 | `none` | same |
| 56 | `grant` type 0x19; duration 1; power 0x0C | same |
| 57 | `rot` stat 5; loss 2; floor 3; duration 43200; msg "Rots..."; death "Dies rots away" | `engulf` held 0x3A; suffocate 0x0D; marker 0x8B |
| 58 | `noMove` moveRate 1 | same |
| 59 | `expireInto` type 0x62; duration 0; power 0xFF; flag 0 | same |
| 60 | `none` | `magicWeapons` full 3 |
| 61 | `resistPerDie` type 1; per 2; magic 8; save 4 | same |
| 62 | `regenerate` duration 60; force 0 | same |
| 63 | `none` | `minorGlobe` below 4 |
| 64 | `poisonOnHit` bonus 0; effect 0x37; msg "is Poisoned" | same |
| 65 | `poisonOnHit` bonus 4; effect 0x37; msg "is Poisoned" | same |
| 66 | `poisonOnHit` bonus 2; effect 0x37; msg "is Poisoned" | same |
| 67 | `paralyseOnHit` roll [2, 8]; effect 0x34; power 0x0C; msg "is Paralyzed" | same |
| 68 | `paralyseOnHit` duration 63; notRace 2; effect 0x34; power 0x0C; msg "is Paralyzed" | `feeblemind` |
| 69 | `paralyseOnHit` roll [1, 9, 10]; effect 0x34; power 0x0C; msg "is Paralyzed" | `untargetableBy` type 0x13; detect 0x18; roll -4 |
| 70 | `poisonOnHit` bonus -2; effect 0x37; msg "is Poisoned" | same |
| 71 | `hidden` roll -4 | same |
| 72 | `grant` type 0x19; duration 1; power 0x0C; below 96 | same |
| 73 | `rake` attacks 2; dice 2; sides 4; msg "Rakes..." | `immune` mask 0x20; say 1 |
| 74 | `crush` attacks 1; dice 3; sides 4; held 0x3A | `none` |
| 75 | `bloodDrain` sides 4; held 0x3A; msg "Sucks some Blood"; keep 1 | `giantBane` type 3 |
| 76 | `attach` drain 0x4B; duration 207; held 0x3A | `bane` type 8; roll 3; dmg 3 |
| 77 | `holdFast` maxStr 19; crush 0x4A; held 0x3A; msg "is held fast" | `berserk` say 1; restore 0 |
| 78 | `revive` full 0; keepPower 1 | same |
| 79 | `hitDamage` count 2; sides 10; dmgType 9; active 1; keep 1 | same |
| 80 | `hitDamage` count 1; sides 4; dmgType 0x10; active 1; keep 1 | same |
| 81 | `fearAura` saveType 4; hdUpTo [3, 5]; effects [0x34, 2]; power 0x0C; msgs ["is paralyzed with fear", "is weakened by fear"] | `halve` |
| 82 | `paralysingAura` bonus 1; crowd 6; raceBonus [7, 2]; effect 0x34; roll [1, 4]; power 0x0C; msg "is Paralyzed" | `fireColdSave` |
| 83 | `stoneGaze` reflectable 0x7F; word 0x76; save 1; status 7; msg "is Stoned" | `gazeStone` spell 65; word 0x76 |
| 84 | `charmGaze` spell 10; save 4; bonus -2; effect 0x0B; power 0x0C | `absorbElectricity` |
| 85 | `drainOnHit` levels 1 | `piercingOne` |
| 86 | `drainOnHit` levels 2 | `spitAcid` range 7; pct 30; hook 65 |
| 87 | `diseaseOnHit` heal 0x32; healFor 14400; rot 0x39; rotFor 43200; msg "is Diseased" | `eyeRays` shots 4; ranges [2, 3, 4, 5]; saves [3, 1, 0]; statuses [8, 7, 6]; frames [5, 10, 5, 5]; wound [2, 8, 1]; spells [84, 55, 21] |
| 88 | `breathBolt` pct 50; spell 51; len 10; save 3 | `breathBolt` pct 50; spell 51; len 10; save 3; dmgType 0x24 |
| 89 | `displaced` bit 0x10 | same |
| 90 | `conSave` saveTypes [0]; bands [[4, 1], [7, 2], [11, 3], [14, 4], [18, 5]] | `breathArea` uses 3; dmgType 0x30; spell 61; width 1; len 6; ownSide 1; msg "breathes acid" |
| 91 | `immuneSpell` spell 15; mask 4 | `liftZone` cell 0x1C |
| 92 | `none` | same |
| 93 | `halveType` mask 1 | same |
| 94 | `halveByWeaponKind` kinds [128, 1] | same |
| 95 | `diesAtEnd` msg "Falls dead" | same |
| 96 | `needsMagicOrWord` word 0xB1 | `hug` held 0x3A; marker 0x90 |
| 97 | `conSave` saveTypes [2, 4]; bands [[4, 1], [7, 2], [11, 3], [14, 4], [18, 5]] | same |
| 98 | `healEachRound` hp 3 | same |
| 99 | `rally` full 6; after 0x5F | same |
| 100 | `unlessKilledBy` mask 0x11; effect 0x66; roll [3, 6] | same |
| 101 | `startUnless` unless [98, 59]; effect 0x3B; duration 3 | same |
| 102 | `revive` full 1; keepPower 0 | same |
| 103 | `escapes` msg "Turns gaseous and escapes"; status 3 | `extraDamage` lacks [0x14, 0x36, 0x3D]; sides 6 |
| 104 | `deflect` pct 60 | same |
| 105 | `magicResist` base 50; classes [0, 5] | same |
| 106 | `magicResist` base 15; classes [0, 5] | same |
| 107 | `blocks` types [0x35, 0x0B]; pct 90 | same |
| 108 | `blocks` types [0x0B, 0x35] | same |
| 109 | `blocks` types [0x34] | same |
| 110 | `immuneType` mask 2 | `immune` mask 2; say 0 |
| 111 | `immunities` types [0x37, 0x34]; saveType 0 | same |
| 112 | `immuneType` mask 1 | same |
| 113 | `resistPerDie` type 1; per 1 | same |
| 114 | `halveType` mask 4 | same |
| 115 | `halveByWeaponKind` kinds [0, 1]; unarmed 1 | same |
| 116 | `halveByPlus` | same |
| 117 | `vulnerableTo` item 0x55; roll [1, 6, 1]; keep 1 | same |
| 118 | `halveType` mask 2 | same |
| 119 | `needsEnchantment` hd 4 | same |
| 120 | `deflect` pct 50; items [0x57, 0x58] | same |
| 121 | `spitOnce` pct 25; range 4; roll [8, 4]; dmgType 0x10; save 3; also 0x50; keep 1 | same |
| 122 | `vulnerableTo` item 0x56; roll [3, 8, 0]; diceOn 9; keep 1 | `holdOnHit` save 0; effect 0x34 |
| 123 | `halfForWord` word 0xB1 | `hitDamage` count 2; sides 8; dmgType 0x0A |
| 124 | `blocks` types [0x0B, 0x35]; pct 30 | same |
| 125 | `immunities` types [0x0B, 0x35, 0x34, 0x37]; saveType 0 | same |
| 126 | `warded` words [0x76]; pairs [[0x98, 0xFC]] | `gazeHold` minutes 60; hook 65; effect 0x34 |
| 127 | `none` | same |
| 128 | — | `breathArea` uses 3; dmgType 0x21; spell 61; width 3; len 9; ownSide 0; msg "breathes fire" |
| 129 | — | `magicResistance` |
| 130 | — | `quarrelSlays` type 0x1C; word 0x87 |
| 131 | — | `breatheFire` pct 50; dmg 7; hook 65 |
| 132 | — | `throwLightning` rounds 4; spell 51; count 16; sides 6; len 10; save 4 |
| 133 | — | `blocks` types [0x8E, 0x1D, 0x44]; mask 0x40 |
| 134 | — | `rangerVsGiants` flag 8 |
| 135 | — | `immune` mask 4; say 0 |
| 136 | — | `noMove` |
| 137 | — | `berserk` say 0; restore 1 |
| 138 | — | `startInvisible` effect 0x19 |
| 139 | — | `heldVictim` marker 0x8B; attacks 2; held 0x3A; also 0x0D |
| 140 | — | `none` |
| 141 | — | `refillUses` |
| 142 | — | `runsAway` |
| 143 | — | `zap` |
| 144 | — | `heldVictim` marker 0x90; attacks 1; held 0x3A; also 0 |
| 145 | — | `dispelEvil` flag 1; removes [4, 0x91] |
| 146 | — | `none` |

### 6.1 The item maps

`effects.items`, by item +0x3E & 0x7F (the item's +0x3E in brackets). PoR: the item handlers 128–139 of its table; CotAB: the item kinds of 0x3F034, kind 0 the generic handler 147.

| +0x3E & 0x7F | PoR | CotAB |
|---|---|---|
| 0 (0x80) | `grantEffect` power 0x0C; flag 0; quietly 1 | `grantEffect` power 0xFF; flag 1; outsideCombat 1 |
| 1 (0x81) | `grantEffect` power 0x0C; flag 0; quietly 1 | `doubleSlots` levels 3 |
| 2 (0x82) | `grantEffect` power 0x0C; flag 0; quietly 1 | `recomputeStats` stats [3]; thief 1 |
| 3 (0x83) | `strengthItem` str 18; pct 100; effect 0x26; msg "is stronger" | — |
| 4 (0x84) | `alignmentLocked` | `alignmentLocked` alsoUnready 1 |
| 5 (0x85) | `grantEffect` power 0x0C; flag 0; quietly 1 | `recomputeStats` stats [0] |
| 6 (0x86) | `grantEffect` power 0x0C; flag 0; quietly 1 | `recomputeStats` stats [4, 5] |
| 7 (0x87) | `needsStrength` str 19; msg "Must have Giant Strength" | — |
| 8 (0x88) | `grantEffect` power 0x0C; flag 0; quietly 1 | `recomputeStats` fromValue 1 |
| 9 (0x89) | `unreadyEnds` type 0x17 | `unreadyEnds` type 0x17 |
| 10 (0x8A) | `grantEffect` power 0x0C; flag 0; quietly 1 | `recomputeStats` stats [3] |
| 11 (0x8B) | `grantEffect` power 0x0C; flag 0; quietly 1 | `recomputeStats` stats []; thief 1 |
| 12 (0x8C) | — | `recomputeStats` stats [1] |
| 13 (0x8D) | — | `recomputeStats` stats [0, 1] |

## 7. The spell handler maps

*The two games' `spells.handlers` (kind **C**).* Every id each game has is listed. CotAB's map starts from PoR's entries for ids 1–57 and 60–65 and overrides the changed ones ("same" = PoR's entry); 58 and 66–100 are its own. PoR has no ids above 67; ids a game lacks show —.

| Id | PoR | CotAB |
|---|---|---|
| 1 | `applySide` side "ally"; notEngaged 1; msg "is Blessed" | same |
| 2 | `applySide` side "enemy"; msg "is Cursed" | same |
| 3 | `heal` amount {n: 1, d: 8}; aiTarget "woundedNear" | same |
| 4 | `damage` amount {n: 1, d: 8}; dmgType 8; recordDice 1 | same |
| 5 | `apply` msg "is affected" | same |
| 6 | `apply` msg "is protected" | same |
| 7 | `apply` msg "is protected" | same |
| 8 | `apply` msg "is cold-resistant" | same |
| 9 | `damage` amount {n: 0, d: 0, plus: "L"}; dmgType 9 | same |
| 10 | `charm` sideMul 128; msg "is charmed" | same |
| 11 | `apply` msg "is affected" | same |
| 12 | `enlarge` levels [[18, 0], [18, 0], [18, 1], [18, 51], [18, 76], [18, 91], [18, 100]]; effect 0x0C; msg "is stronger" | `enlarge` levels [[18, 0], [18, 0], [18, 1], [18, 51], [18, 76], [18, 91], [18, 100], [19, 0], [20, 0], [21, 0], [22, 0], [22, 0]]; beyond [18, 0]; effect 0x0C; msg "is stronger"; unaffected "is unaffected" |
| 13 | `reduce` effect 0x0C; saveType 4; msg "has been reduced" | `reduce` effect 0x0C; saveType 4; msg "has been reduced"; silent 1 |
| 14 | `friends` amount {n: 2, d: 4}; cap 0x19; effect 0x0E; msg "is friendly" | `applyTo` to "first"; power {n: 2, d: 4}; flag 1; stat 5; msg "is friendly" |
| 15 | `damage` amount {n: "L/2", d: 4, plus: "L/2"}; dmgType 8; recordDice 1 | `damage` amount {n: "(L+1)/2", d: 4, plus: "n"}; dmgType 8; recordDice 1 |
| 16 | `apply` msg "is protected" | same |
| 17 | `apply` msg "is protected" | same |
| 18 | `apply` msg "is affected" | same |
| 19 | `apply` msg "is shielded" | same |
| 20 | `damage` amount {n: 1, d: 8, plus: "L"}; dmgType 0x0C; recordDice 1 | same |
| 21 | `sleep` pool {n: 4, d: 4}; effect 0x35; msg "falls asleep"; hdCost [1, 1, 2, 4, 6]; hd5 [10, 20]; other 20 | same |
| 22 | `apply` msg "is affected" | same |
| 23 | `hold` bonus [-2, -1, 0]; effect 0x34; sizeImmune 1; msg "is held" | same |
| 24 | `apply` msg "is fire resistant" | same |
| 25 | `apply` msg "is silenced" | same |
| 26 | `slowPoison` msg "is affected" | same |
| 27 | `charmByHp` monsterType 0x0E; effect 0x33; msg "is charmed" | same |
| 28 | `applyTo` to "caster"; flag 1; runNow 1 | same |
| 29 | `apply` msg "is affected" | same |
| 30 | `apply` msg "is invisible" | same |
| 31 | `apply` | same |
| 32 | `images` amount {n: 1, d: 4}; effect 0x1C | `images` amount {n: 1, d: 4}; levelShift 4; msg "is duplicated" |
| 33 | `apply` msg "is weakened" | same |
| 34 | `cloud` dirs "gasCloud"; count 4; cell 0x1E; owner 0x28; replaced [{cell: 0x1E, zones: 0x1E, not: [0x1E]}]; msg "Creates a noxious cloud" | `cloud` dirs "gasCloud"; count 4; cell 0x1E; owner 0x28; replaced [{cell: 0x1E, zones: 0x1E, not: [0x1E]}]; msg "Creates a noxious cloud"; dedupe 1 |
| 35 | `strengthByClass` bonus [{cls: [5], d: 4}, {cls: [0, 6], d: 6}, {cls: [2], d: 8}]; pctClasses [2]; effect 0x26; msg "is stronger" | `strengthByClass` bonus [{cls: [5], d: 4}, {cls: [0, 6], d: 6}, {cls: [2], d: 8}]; pctClasses [2, 3, 4]; effect 0x26; counts "levelOrFormer"; rollCounting 1; bonusPower 100 |
| 36 | `animateDead` effect 0x20; msg "is animated" | same |
| 37 | `cure` effect 0x21; msg "can see" | same |
| 38 | `apply` msg "is blind" | same |
| 39 | `cureDisease` | same |
| 40 | `apply` flag 1; msg "is diseased" | same |
| 41 | `dispel` msg "is affected" | `dispel` msg "is affected"; zones [{cell: 0x1E, owner: 0x28, dirs: "gasCloud", count: 4}, {cell: 0x1C, owner: 0x5B, dirs: "gasCloud", count: 9}] |
| 42 | `applyTo` to "caster"; sideShift 4; msg "is praying" | same |
| 43 | `removeCurse` effect 0x24 | `removeCurse` effect 0x24; item "unready"; itemMsg "has an item un-cursed" |
| 44 | `apply` msg "has been cursed!" | same |
| 45 | `apply` msg "is blinking" | same |
| 46 | `dispel` msg "is affected" | `dispel` msg "is affected"; zones [{cell: 0x1E, owner: 0x28, dirs: "gasCloud", count: 4}, {cell: 0x1C, owner: 0x5B, dirs: "gasCloud", count: 9}] |
| 47 | `damage` amount {n: "L", d: 6}; dmgType 9; recordDice 1; look 1; outdoorRadius 2; sound 11 | same |
| 48 | `hasteSlow` side "ally"; opposite 0x2A; attacksAfter 1; msg "is Hasted" | `hasteSlow` side "ally"; opposite 0x2A; attacksAfter 0; msg "is Hasted" |
| 49 | `hold` bonus [-3, -1, 0]; effect 0x34; sizeImmune 1; msg "is held" | same |
| 50 | `apply` msg "is invisible" | same |
| 51 | `bolt` amount {n: "L", d: 6}; saveType 4; sound 8 | same |
| 52 | `apply` msg "is protected" | same |
| 53 | `apply` msg "is protected" | same |
| 54 | `apply` msg "is protected" | same |
| 55 | `hasteSlow` side "enemy"; opposite 0x27; attacksAfter 1; msg "is Slowed" | `hasteSlow` side "enemy"; opposite 0x27; attacksAfter 0; msg "is Slowed" |
| 56 | `restore` msg "is restored" | same |
| 57 | `toggle` remove 0x2A; effect 0x27; power 0x0C; msg "is Speedy" | same |
| 58 | `ointment` amount {n: 1, d: 4, plus: 8}; msg "is Healed" | `heal` amount {n: 2, d: 8, plus: 1} |
| 59 | `setStrength` str 21; pct 0; effect 0x26; msg "is stronger" | `setStrength` str 21; pct 0; effect 0x92; msg "is stronger" |
| 60 | `damage` amount {n: 1, d: 6, plus: 20}; dmgType 0x0C | same |
| 61 | `apply` rollDuration {n: 5, d: 4} | same |
| 62 | `heal` amount {n: 2, d: 4, plus: 2} | same |
| 63 | `apply` msg "is invisible" | same |
| 64 | `damage` amount {n: {roll: [1, 3], mul: 2, add: 1}, d: 6}; dmgType 9; recordDice 1 | same |
| 65 | `damage` amount {n: 2, d: 4, plus: 2}; dmgType 8; recordDice 1 | same |
| 66 | `apply` | `damage` amount {n: 2, d: 8, plus: 1}; dmgType 8; recordDice 1 |
| 67 | `applyTo` to "first"; duration 1440; power 0xFF; flag 1; msg "is Reading" | `curePoison` effect 0x37; removes [0x37, 0x16, 0x0F]; msg "is unpoisoned"; unaffected "is unaffected" |
| 68 | — | `applyProbe` probe 0x40 |
| 69 | — | `apply` msg "is protected" |
| 70 | — | `apply` immuneHd 6; immuneMsg "smashes them flat"; runAfter "first" |
| 71 | — | `heal` amount {n: 3, d: 8, plus: 3} |
| 72 | — | `damage` amount {n: 3, d: 8, plus: 3}; dmgType 8; recordDice 1 |
| 73 | — | `apply` casterEffect 4; msg "is affected" |
| 74 | — | `damage` amount {n: 6, d: 8}; dmgType 9; recordDice 1 |
| 75 | — | `raise` statuses [6, 1]; races [2]; removes [0x20, 0x37]; msg "is raised" |
| 76 | — | `slay` probe 0x43; probeType 0x40; saveType 4; msg "is slain"; amount {n: 2, d: 8, plus: 1}; dmgType 8; unaffected "is unaffected" |
| 77 | — | `apply` msg "is affected" |
| 78 | — | `saveEach` effect 0x88; saveType 4; msg "is entangled"; outdoorsOnly 1 |
| 79 | — | `hold` bonus [0, 0, 0]; sizeImmune 1; lastSaves 1; msg "is highlighted"; pool {size: "L", by: "sizeFlags", costs: [0, 1, 2, 2, 4], other: 0} |
| 80 | — | `apply` msg "is invisible" |
| 81 | — | `hold` bonus [0, 0, 0]; sizeImmune 1; lastSaves 1; runAfter "each"; msg "is charmed"; pool {size: {roll: [2, 4]}, by: "hitDice", costs: [1, 1, 2, 4], other: 8} |
| 82 | — | `saveEach` effect 0x23; saveType 4; msg "is confused"; upTo {n: 2, d: 8} |
| 83 | — | `teleport` heldBy 0x3A; releases [0x90, 0x8B]; msg "teleports" |
| 84 | — | `scare` width 3; len 6; saveType 4; effect 0x8E; msg "runs in terror"; unaffected "is unaffected" |
| 85 | — | `flameShield` prompt "flame type: "; abort "Abort spell?"; aiPick {d: 10, above: 5}; options [{name: "Hot", effects: [[0x32, "is protected"], [0x8F, ""]]}, {name: "Cold", effects: [[0x36, ""], [0x8F, ""]]}] |
| 86 | — | `saveOrElse` dmgType 0x40; saveType 4; fail {effect: 0x1B, msg: "is clumsy"}; pass {effect: 0x2A, msg: "is slowed"}; flag 1; msg "is clumsy" |
| 87 | — | `damage` amount {n: 3, d: 10}; dmgType 0x0A; recordDice 1 |
| 88 | — | `apply` msg "is protected" |
| 89 | — | `removeCurse` effect 0x24; item "unready"; itemMsg "has an item un-cursed" |
| 90 | — | `animateDead` effect 0x20; msg "is animated" |
| 91 | — | `cloud` dirs "killCloud"; count 9; cell 0x1C; owner 0x5B; firstZone 1; msg "Creates a poisonous cloud"; replaced [{cell: 0x1E, zones: 0x1E, not: [0x1E, 0x1C]}, {cell: 0x1C, zones: 0x1C, not: [0x1E, 0x1C]}] |
| 92 | — | `beam` width 2; len "L/2"; minLen 1; amount {n: "L", d: 4, plus: "L"}; dmgType 0x0A; recordDice 1 |
| 93 | — | `apply` saveShift {save: 4, byClass: {0: -1, 5: 4}, other: 2}; runAfter "first" |
| 94 | — | `hold` bonus [-3, -1, 0]; effect 0x34; sizeImmune 0; msg "is held" |
| 95 | — | `apply` |
| 96 | — | `apply` |
| 97 | — | `apply` |
| 98 | — | `beam` width 1; len 3; amount {n: 6, d: 6}; perTarget 1; recordDice 1; onlyType 0x12 |
| 99 | — | `heal` amount {n: 2, d: 4, plus: 2}; msg "is Healed" |
| 100 | — | `apply` |

## 8. Notes moved from part A

*Informative.* The status notes that part A's files kept on the port (moved here in work-plan step 2,
as [AUDIT.md](../AUDIT.md) §1 asks). They record what was checked and transcribed, and what is still
inferred or approximated; the normative content is §1–§7. Paths are the reference implementation's;
section numbers inside a note (§1, §5 …) are those of the part A file it came from.

### 8.1 From engine/effects.md, "Port status" (2026-10-20)

Each type's handler is a behaviour with parameters in the profile (`web/src/games/effectrules.ts`
`handlers`, item handlers in `items` by +0x3E − 0x80; behaviours in `web/src/rules/effectkinds.ts`).
The port runs each part of a handler on the event it means something for (the attack roll on 10, the
save on 12…), where the original changes the globals whatever the event; that is harmless where nothing
reads them, but not everywhere.

**Port differences found** while making the map (checked in the binary) and since transcribed
(2026-10-20, `web/test/porhandlers.test.ts`):
- 10 / 20 Resist Cold / Fire (03e1, 06e4): whatever the event (removal included), damage of the type
  is halved as a byte and the save +3, both only when 6819 has the type; the port had given the +3 at
  every event-12 save. CotAB's 20 (`resist`, 0x277D0) is this procedure, except on removal.
- 61 (1490): only against fire: per die of the count, the damage loses 2 as a byte and is put back up
  to the count when below it (1 − 2 wraps to 255, which passes); then save +4, and fire without the
  magic bit goes through `FUN_3723_0000(0)`. 113 (2a28) the same with 1 a die and no save.
- 117 / 122 (2b20, 2d38): the holy water or oil is the current character's weapon (+0xCC), not any
  readied item; their rolls go through `FUN_5216_0e2e`, so the count becomes 1 or 3; 122 then adds
  the count to fire or magic damage.
- The handlers rolling through `FUN_5216_0e2e` keep the dice count (DS:681C): 75 (1835), 79 (1a37),
  80 (1a6a), 117 (2b52), 121 (2ce8), 122 (2d6a) (`keep` in the profile).
- An item +0x3E past 139 has no handler in the original's table (its entries from 140 on are not
  handlers: 140 → 0x3EFC1, 141 → 0x0470, I); the port's switch granted the effect, the map does
  nothing (no item in the game's files has one).

### 8.2 From coab/effects.md, "Port status" (2026-10-20)

Done (`web/src/games/effectrules.ts` names a behaviour per type with its parameters, `web/src/rules/effectkinds.ts`
holds them; `test/effectkinds.test.ts`):

- Event lists and area set (profile data). Events 20 (the combat and world damage routines, after event
  6 when not saved), 21 (turn start, after event 15 when not casting) and 22 (combat start, after event 8
  for each character) are fired in both games; PoR lists nothing for them. DS:6FC2 is `fx.saved`, set by
  the combat and world saves as 0x4BDA1 does (1 while event 12 runs).
- Monster-class flags as the field `classFlags` (+0x14B; PoR −1).
- Handlers 3, 4, 7, 12/14/38/146 (empty), 13, 18, 20, 25, 26, 27, 28, 35, 37, 47, 48, 50, 54, 57, 60, 63,
  68, 69, 73, 75, 76, 77, 81, 82, 84, 85, 86, 91 (empty: no zone of its list exists), 96, 103, 110, 122,
  123, 126, 129, 130, 131, 133, 134, 135, 136, 137, 138, 139, 142, 143, 144, 145; 140 (empty) and 141
  (refills the paladin's uses). The rest name PoR's entries, the same behaviour with the same
  parameters (the "same as PoR" list); every type 1–146 has an entry (`test/effectmap.test.ts`).
- The monster specials of event 14 (`web/src/rules/specials.ts`, `test/specials.test.ts`): 83, 87, 88, 90,
  128, 132, with PoR's 88; 83, 86, 126 and 131 take their target through the hook. The combat host gives
  them the battlefield: the hook is the port's spell target pick for the computer, the bolt routines
  (one procedure, the games' differences as `R.bolt` flags; Lightning Bolt uses it too, 7 squares in CotAB), the area
  template (offsets `T.fanDx1`…), flights between cells, the finder and the computer's cast.
- Removal recomputes CHA (0x0E) and STR (0x0C, 0x26, 0x92) through the current-stat routine (§5).
- Readying and putting away items through the item kinds (§6), each kind an item behaviour in the
  profile's `items` map, kind 0 the generic handler 147; the slot routine's Ring of Wizardry doubling
  (training's `derive` takes the items when the caller has them).
- 60 (0x28628) halves a weapon of plus 1 or 2: the profile's threshold had the wrong name (fixed 2026-10-20).

Not yet, or approximated:

- The hook's picker 0x2C56C and the finder 0x2E394 are taken to be PoR's (I); the eye rays' spells go
  through the port's cast, which has 0x45251's own check since 2026-10-21 (with effect 0x4A, 1 in 2 "miscasts", 0x45373). The template's
  sight range and side-line direction where the original reads unset memory (§7, ?). Berserk's
  nearest-combatant search (11c:3e) takes the first of equal distance (I).
- 130 takes the target out of play through the host's status call. `e3:66` is the going-down removal
  0x4C05B ([coab/effects.md §8](../A-games/coab/effects.md#8-going-down-0x4c05b-e366-4aab15ab-char-o)),
  the profile's `effects.ids.goingDown` and `downRejoins` (2026-10-22), run after the battle's "goes down"
  lines and by the host's status call, as the original's set-status routine (0x4AAC4) does.

Done since (checked 2026-10-21): the three spell handlers that call the area template (0x48A8C,
0x49522, 0x496D1) are those of 84, 92 and 98, transcribed as the kinds `scare` and `beam` (§4.3); the
ECL DAMAGE save sets DS:6FC2 (`fx.saved`) as the combat and world saves do.

### 8.3 From coab/spells.md, "Port status"

The port has a per-game spell handler map (`web/src/games/spellrules.ts`: id → kind and parameters), 2026-10-20. Ids the table marks "same" use PoR's kinds; 58, 66, 69, 71, 72, 74, 77, 80, 87, 88, 94, 95–97, 99 and 100 are expressed with existing kinds (heal, damage, apply, hold). Done since: the add-effect and heal helpers (§1) as effect rules data (`replaces`, `healBlock`), the base-STR rule for 12, 35 and 59 (`spells.strength`), and 12–15, 32 as parameters; 35's class rule (`counts`, `rollCounting`, `bonusPower`), 43/89 (`item: 'unready'`), 48/55 (`attacksAfter: 0`); 34 and 91 on the `cloud` kind (squares from START.EXE, T.gasCloud / T.killCloud; `dedupe`), the occupant check by the game's rule (`R.clouds`), 0x5B's removal (`liftZone`), 41/46's zone part (`zones` on the battle's `dispel`). Tests: `web/test/coabspells.test.ts`. The zone number and the cells a zone replaced are transcribed (2026-10-20: the caster's zones but the list's last; the cell under from another zone or the body list, the `cloud` kind's `replaced` and `firstZone`). 83 (`teleport`), 84 (`scare`, on the template `fan`), 85 (`flameShield`, through the host's `choose`/`ask`: the combat menu and confirm, the camp's menu), 86 (`saveOrElse`); 78 and 82 (`saveEach`), 79 and 81 (`hold` with `lastSaves`, `runAfter`, and `pool`, which the battle's target picker reads), Entangle's duration (`durations[78].record`), the Hold loop's save before the size rule (both games: the port skipped PoR's roll for a size-immune target); 67 (`curePoison`), 68 (`applyProbe`), 70 and 73 (`apply` with `immuneHd`, `runAfter`, `casterEffect`), 75 (`raise`), 76 (`slay`), the dice count for 4, 20, 65, 66, 72, 74, 87 (`recordDice`), 80's line. 92 and 98 (`beam`, on the template), 93 (`apply` with `saveShift`). Every id is now transcribed.

Inferred or open in the port (I / ?): Strength's bonus when no class applies (0, the original's is uninitialised); Entangle's L for Duration(0x88) (the cast's level); Poison with no combat target (nothing) and its blank effect record; the record a run-at-once handler gets after add-effect (the new one; the original looks up the first of the type, and for Fumble passes none); Raise Dead on the battlefield (the fallen are not put back on their square); Dimension Door to an occupied square (the port does not move the caster); Hold Person's bonus past 4 targets (the last bonus). A body still in use when a zone lifts: a body still down (the original tests its record's pointer).

## Open

- ~~PoR 82's save bonus from DS:6814[side] and the creature classes behind PoR's +0x9F values 4, 9,
  10, 12~~ answered in part A ([engine/effects.md §3](../A-games/engine/effects.md#3-formulas-creature-classes-odd-cases-and-hasteslow)):
  the +1 applies only when the saver's side has 6 or more combatants in play, which `paralysingAura`
  now tests (`crowd`, AUDIT §6.9 PA3 resolved); the class values are parameters already.
- The three CotAB spell handlers that call the area template (0x48A8C, 0x49522, 0x496D1) are those of
  84 Fear, 92 Cone of Cold and 98, the kinds `scare` and `beam`; the template's unset-memory cases are
  the port's choices (§5).
- The set-status routine's redraws after the fall (PoR `FUN_10ba_17e3`, the roster `FUN_10ba_0767`;
  CotAB 0x4E8BF, 0x4D7E8) are the host's screen refresh; `FUN_10ba_17e3` / 0x4E8BF is not identified (?).
