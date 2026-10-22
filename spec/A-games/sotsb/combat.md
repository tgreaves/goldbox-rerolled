# SotSB combat: differences from Curse of the Azure Bonds

> **Status: first pass (2026-10-22).** Normative, except passages marked *informative*. Part A of the
> [specification](../../README.md): Secret of the Silver Blades (GOG 1.0). Read
> [coab/combat.md](../coab/combat.md) first (and through it [engine/combat-rules.md](../engine/combat-rules.md),
> [engine/battlefield.md](../engine/battlefield.md), [engine/combat-ai.md](../engine/combat-ai.md)):
> this file gives the differences. Addresses are offsets in the working image
> ([README.md](README.md#working-image)); `DS:x` = image 0xDE20 + x. Evidence marks as in the spec README.

## 1. How the routines were found (informative)

Each CotAB routine cited in [coab/combat.md](../coab/combat.md) was matched to SotSB's by its
normalised instruction sequence (opcodes and operand shapes, numbers and call targets masked), then
the two were compared instruction by instruction. "As CotAB" below means the comparison found only
relocated addresses and record offsets (the 439-byte record, [records.md](records.md)); every other
difference is listed. A routine marked **O** was compared or read in full.

| Subject | CotAB | SotSB | |
|---|---|---|---|
| grid builder | 0x25CC0 | 0x2B94B | changed (§2) |
| map-area generator | 0x2555D | 0x2B875 | as CotAB, identical sequence (O) |
| its corner and edge routines | 0x2508C, 0x25131, 0x251AE, 0x25386 | 0x2B3A4, 0x2B449, 0x2B4C6, 0x2B69E | identical (O) |
| `classify`, `edge` | 0x25018, 0x24F96 | 0x2B330, 0x2B2AE | as CotAB (O) |
| furnishing | 0x24D63 | 0x2B084 | as CotAB, its cell numbers (§3) (O) |
| wilderness generator | 0x25C58 (+ river, trees, scatter) | 0x2B939 | **empty** (§2) |
| combat records | 0x25D70 | 0x2B9BF | as CotAB (I: compared, not read line by line) |
| placement scan | 0x26010 | 0x2BC60 | as CotAB (I) |
| battle start | 0x2648E | 0x2C0DC | changed (§4) |
| step routine | 0x2AC98 | 0x31757 | as CotAB (O) |
| the computer's movement and probe | 0x237FB | 0x29C5B | changed effect numbers (§6) |
| direction cone | 0x5504A | 0x5B803 | identical (O) |
| cell classifier | 0x563B4 | 0x5CAF0 | identical (O) |
| backstab | 0x2CE27 | 0x337E3 | changed (§7) |
| damage with the backstab multiplier | 0x2A6E2 | 0x311AC | as CotAB (O at 0x31232) |
| set-status routine | 0x4AAC4 | **0x508C0** | changed (§8) |
| going down | 0x4C05B | 0x51CA9 | as CotAB, its own list (§8) (O) |
| taking a combatant off the field | 0x4BF57 | 0x51BA5 | identical (O) |
| morale | 0x2443F | 0x2A84C | changed (§9) |
| the computer's turn | 0x23238 | 0x29592 | changed: no Turn Undead (§10) |
| spell choice | 0x236CB | 0x29AE4 | as CotAB: slots from 1 (O) |
| target finder | 0x2E394 | 0x34C51 | changed (§9) |
| target picker | 0x2C56C | 0x32DDC | as CotAB in outline (I: not compared line by line) |
| the spell going off | 0x45251 | 0x48A53 | changed (§11) |
| the berserk search | 0x553D8 | 0x5BB91 | similar (I: 0.75 of the sequence in common) |
| dice | 0x4BE31 | 0x51A86 | identical (O) |

## 2. The battlefield: map areas only (O)

The grid builder 0x2B94B tests A word 0x1CC (ECL 0x4BE6, the map flag) as CotAB's: when it is set it
loads `DungCom` (string `CS:0x943` = image 0x2B943, record 1, its loader argument 0x20; CotAB 0x19) and
nothing else, allocates the grid (0x4E9 bytes, header bytes 4, 5, 6 = 0, 1, 0, as CotAB) and runs the
map-area generator 0x2B875; when it is clear it runs **0x2B939, an empty procedure** (sub sp; ret).
There is no `WildCom` and no `RandCom` ([assets.md](assets.md)), and no river, tree or scatter pass.

The flag is always set: a new game fills the A array with 0 and then sets A 0x1CC := 1 (0x2CB28,
0x2CF58, beside A 0x3E8 := 2, §5), and no script writes ECL 0x4BE6 (the decoded ECL1–3, [ecl.md](ecl.md)).
So every battle in SotSB is fought on a map-area field (**O** for the code and the scripts; **I** that no
other path clears it). The wilderness generator's grid would be the allocation's unset memory.

## 3. The cell table (O, DS:1A9E, 4 bytes a cell)

31 cells, 0x00–0x1E, then an end entry (0x1F: 0, 0, 0xFF, 0xFF). Cells 0x00–0x19 are CotAB's
map-area set; 0x1A–0x1E are cost 1, sight clear, image slots 0x19–0x1D (CotAB: 0x1A table at cost 2,
0x1B chair, 0x1C blue cloud, 0x1D blank, 0x1E green cloud, slots 0x22–0x26 of `RandCom`). The images
come from `DungCom`'s 30 tiles ([assets.md](assets.md)). The furnishing 0x2B084 still writes 0x1A
(table) and 0x1B (chair) in flagged rooms with CotAB's dice and tests (O); in SotSB they are `DungCom`
images 0x19 and 0x1A, with the cost of an ordinary floor cell (**I** for what they depict). The
battle start marks a fallen body with cell 0x1C (CotAB 0x1F) and a petrified combatant (status 7)
with 0x1E (0x2C42C–0x2C469, new) (**O** for the writes, **I** for the images).

The gas and kill clouds are SotSB's `gasCloud`/`killCloud` tables (DS:349F, DS:34A3,
[tables.md](tables.md)); their cell numbers are not re-read here (?).

## 4. The battle start (O in outline, 0x2C0DC)

CotAB's 0x2648E with these differences:

- The party's half for placement is (the number of members on side 0 + 1) div 2, counted over the list
  (0x2C1AA–0x2C1FE), where CotAB took the party size byte.
- The divisions of the placement origin are signed (`idiv`).
- Combat icon slots start at 0x48 (CotAB 0xFF as "none").
- **No event 22**: CotAB fires event 22 (combat starts) for each character (0x26A0C); SotSB instead
  clears each member's combat record +0x11 and calls a routine with the character (0x2C69B–0x2C6AF, **?**).
- After the records, each member's status and in-play bytes are passed to a routine (`19a:25`,
  0x2C6DB–0x2C723, **?**: I: the icon or roster state for the battle).

## 5. Difficulty (O)

SotSB adds a difficulty level, A word 0x3E8 (ECL 0x4CF4): 0 Novice, 1 Squire, 2 Veteran, 3 Adept,
4 Champion; a new game sets 2 (0x2CB1D). It is chosen in the camp's Alter → **Level** ([camp.md](camp.md)).
LOAD_MONSTER (0x1DF9C–0x1E036) scales each monster it loads for side 1: when the difficulty is 0–4, its
HP (+0x1B5) and max HP (+0x70) := value × (difficulty + 2) div 4, as bytes, and 1 when that gives 0. So
Novice gives half the hit points, Veteran the file's, Champion one and a half times. Scripts read it
too (`MULTIPLY [0x4CF4], #12, …` and `#5` in ECL1–3, 35 uses, [ecl.md](ecl.md)).

## 6. The computer's movement and its cloud probe (O, 0x29C5B)

The step routine 0x31757 is CotAB's (cost × 3 diagonally, × 2 straight; `imul` for CotAB's shifts).
The probe 0x29C5B keeps CotAB's structure and order; its tests name **SotSB's effect numbers**, which
are not CotAB's:

- a gas square is refused unless the mover has effect 0x1E, 0x3F, 0x39 or 0x63, or is turned (combat
  record +0x10), or saves vs 0 (`145:3e`, a draw of the probe's own) (0x29D53–0x29DCA);
- a kill-cloud square is refused to a mover whose hit dice (+0xEE, signed) are below 7 unless it has
  effect 0x63 or is turned; no save (0x29DE5–0x29E1A). CotAB tested 0x81, 0x6F, 0x85 and 0x7D there.

What those numbers are in SotSB's effect table is for the effects research (**?**; the going-down list
below is renumbered the same way).

## 7. The backstab (O, 0x337E3)

CotAB's rule ([coab/combat.md, "The backstab"](../coab/combat.md#the-backstab-o-0x2ce27-damage-0x2a6e2)),
with:

- the thief test on +0x117 (thief level) and +0x11E (former thief level) with 0x573EB (former levels
  count);
- the weapon: none, or **type 3, 4, or 17–19** (`cmp 0x10 < type < 0x14`). SotSB's `ITEMS` is
  reordered against CotAB's: its rows 3, 4 and 17–19 are CotAB's 7 (Club), 8 (Dagger) and 35–37 (the
  swords) with small changes (O, the two files compared); CotAB's 0x61 entry has no counterpart here;
- **new**: the target must be within reach, `0x55870`(attacker, target) below 2 (0x33889, **I**: the
  distance routine);
- the position test is a far call (`151:110` = 0x56428) returning the attacker's direction, compared
  with the target's facing (combat record +9) (0x338AC–0x338B9);
- the multiplier (0x31232–0x31254) is CotAB's: (L − 1) div 4 + 2, L = f·former thief + thief level.

**Item types are renumbered throughout** (O for two of them): the recalculation takes the readied
arrows by type **0x1E** (0x54DE3, into +0x191) and the quarrels by type **0x0C** (0x54DFF, into +0x195)
(CotAB 0x49, 0x1C). The other item types the profile names (holy water, oil, the elf's weapons, the
flight groups, the plural rule) are not re-read here (**?**).

## 8. The set-status routine and going down (O)

- **Set-status, 0x508C0** (`(char, status, msg)`): CotAB's 0x4AAC4 step for step (the message first; the
  6/7/8 test; status +0x1A6, in-play +0x1A7 := 0, HP +0x1B5 := 0; going down 0x51CA9; the fall when out
  of play; the pause; the message area cleared; the roster unless in battle, game mode DS:67E7 = 5),
  **except that it fires no event 13**: CotAB's `push 0xD; call 0x4AEC4` after the going-down removal
  is gone (0x50929 → 0x5092C).
- **Going down, 0x51CA9**: CotAB's loop over its own list, the first record of each type of
  **DS:0A99[1..14] = 3, 11, 21, 23, 27, 30, 31, 51, 52, 53, 91, 106, 107, 111**, then the berserk return
  (effect 0x4D found and morale +0xFF = 0xB3 → side +0x1A8 := 0) (0x51CC5–0x51CFF).
- **Taking a combatant off the field, 0x51BA5**: identical to CotAB's 0x4BF57.

## 9. Morale and the target finder

- **Morale, 0x2A84C** (O): R[0x14] := 0, then the morale removal through `145:61` = **0x51D0B, an empty
  procedure**: nothing is removed (CotAB 0x4C0BD removed 13, 58, 139, 144). Turned → flees; party
  members (morale < 0x80) pass; the HP and group tests as CotAB's with signed arithmetic; then the
  fastest enemy (`c9:8e`) against half its own movement (`151:101`, signed): no faster enemy → R[0x14]
  := 1 (flee) with **no removal** (CotAB removed 0x4A and 0x4B); else an INT (+0x13) above 5
  surrenders ("Surrenders", the take-off routine `151:cf`).
- **The target finder, 0x34C51** (I: read in part): CotAB's 0x2E394 with one addition: a chooser with
  effect **0x5B** whose combatant at slot DS:8DC9 is the one picked, on the first pass's first try
  (counter 0x13), takes it (0x34D47–0x34D85). (I: a forced target, such as a taunt or charm; the slot's
  meaning is not traced.)

## 10. No turning undead (O)

SotSB has no Turn Undead. The player's battle menu reads "Move View Aim Use Cast Quick Done" (image
0x28886; CotAB "… Cast Turn Quick Done", 0x22457); the computer's turn 0x29592 goes from morale
(0x2A84C), item use (0x29989), the queued spell (`113:39`) straight to its spell choice (0x29AE4) and the
weapons (0x2AAE4), with no turn routine between (CotAB 0x2330B); and the image holds no "is destroyed"
(CotAB 0x3CE23). The former-cleric rules of CotAB's Turn ([coab/combat.md, "The former class in
battle"](../coab/combat.md#the-former-class-in-battle-o)) have nothing to apply to.

## 11. Casting (O, 0x48A53)

CotAB's 0x45251 with these differences:

- **No miscast roll.** In its place: a caster with effect **0x44** (SotSB's number) casting other than
  from an item (DS:8D99, the from-an-item flag, = 0) casts nothing, silently: no line, no target, no
  effect, nothing forgotten (0x48D64–0x48D86; CotAB: effect 0x4A, 1 in 2, "miscasts").
- **"can't be cast here... Lose it?"** (CS strings 0x48B75, 0x48B8B): a spell that cannot be cast where
  the caster is now asks whether to lose it; Y (0x59) forgets it (0x48D40–0x48D58, **I** for when it is
  asked).
- The rest (the target hook, forgetting on going off or abort) as CotAB's (I).

## 12. Draft profile values (informative)

The `GameRules` fields of [B-model/procedures.md §15](../../B-model/procedures.md#15-combat-procedures)
as the evidence above gives them; `/* ? */` where not read.

```ts
// SotSB, combat (spec/A-games/sotsb/combat.md)
wildBattle: { kind: 'placeFlags', mapFlag: 0x49e6, place: 0x4aa1 }, // the flag is always 1: every battle a map area
wildField: { fill: 0, blank: [], passes: [] },                     // 0x2B939 does nothing
mapField: { cornerWallEnd: 0x08, finishing: false, furnish: { flag: 0x40, blank: [0x17, 0x36] /* ? the blank cells */, table: [0x1a, 10, 5], chair: [0x1b, 10, 9] } },
battleMove: { test: 'cost', shortStep: 'move' },                   // 0x31757 as CotAB's
clouds: { gas: { cell: 0x1e /* ? */, immune: [/* ? renumbered */], probe: { immune: [0x1e, 0x3f, 0x39, 0x63], turned: true, save: 0 }, roundEnd: false, apply: true },
          kill: { cell: 0x1c /* ? */, save: 0, bands: [/* ? */], poison: 0 /* ? */, probe: { immune: [0x63], turned: true, save: null, below: 7 } } },
backstab: { armour: null, weapons: [3, 4, 17, 18, 19], notLarge: true, minus: 1 },  // + within reach (new)
casting: { lostFrom: 'target' /* I */, miscast: null, aiFirstSlot: 1, aiItemSpell: { above: 0x38, minus: 0x17 } /* ? */,
           aiPick: { tries: 1, areaCheck: false } /* I */ },
itemTypes: { arrows: 0x1e, quarrels: 0x0c, /* the rest ? (ITEMS reordered) */ },
// effects.ids (games/effectrules.ts):
goingDown: [3, 11, 21, 23, 27, 30, 31, 51, 52, 53, 91, 106, 107, 111], downRejoins: { effect: 0x4d, morale: 0xb3 },
moraleRemoves: [], fleeRemoves: [],
```

## 13. What the port needs beyond values

- **Difficulty**: a new rule (`R.difficulty`: the variable ECL 0x4CF4, the five names, the start value 2,
  the HP scale (difficulty + 2) / 4 for side-1 monsters at LOAD_MONSTER) and the Alter → Level menu.
- **No event 13 in the set-status routine**: a profile flag on `setStatusOf` (PoR and CotAB fire it).
- **No Turn Undead**: the battle menu without Turn and the computer's turn without the turn step, as
  profile data (CotAB's `R` has no switch for it yet).
- **The silent "no cast" effect** in place of the miscast roll (`casting.miscast` with no die and no
  line), and the "Lose it?" question.
- **The backstab's reach test**.
- The finder's forced-target case (effect 0x5B).
- Renumbered effect and item types throughout the profile.

## Open

- SotSB's effect numbers (0x1E, 0x39, 0x3F, 0x44, 0x5B, 0x63 above; the going-down list) against
  CotAB's: for the effects research.
- The gas and kill clouds' cells and bands; the item types beyond arrows and quarrels.
- The battle start's two new calls (§4); the picker and the berserk search compared in full.
