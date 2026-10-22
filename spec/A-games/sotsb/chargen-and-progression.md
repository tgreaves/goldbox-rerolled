# SotSB creation and progression vs Curse of the Azure Bonds

> **Status: first pass (2026-10-22).** Normative, except passages marked *informative*. Part A of the
> [specification](../../README.md): Secret of the Silver Blades (GOG 1.0). Read
> [coab/chargen-and-progression.md](../coab/chargen-and-progression.md) first; the tables are in
> [tables.md](tables.md), the record in [records.md](records.md). Addresses are offsets in the working
> image ([README.md](README.md#working-image)); `DS:x` = image 0xDE20 + x. Routines were matched to
> CotAB's as in [combat.md §1](combat.md#1-how-the-routines-were-found-informative).

SotSB keeps CotAB's procedures (the recalculation, the slot model, the hit-point rule, dual-classing)
over **seven classes** (no monk), **six races** (renumbered, no half-orc) and **seven spell levels**,
with these changes.

## 1. Creation (O, 0x391EA; the per-class part 0x3B0F0–0x3B21B)

For each of the character's classes with a level (loop 0–6):

- cleric: two first-level cleric slots (+0x132 := 2) and the cleric spells listed at `DS:580C[1..10]`
  known (byte +0x70 + id := 1, the list ending at a 0);
- magic-user: one first-level slot (+0x147 := 1) and **Detect Magic (11), Read Magic (18), Shield (19)
  and Sleep (21)** known (0x3B1C8–0x3B1E5): PoR's four. CotAB had Enlarge (12) for Shield; SotSB's
  dual-classing still gives Enlarge (§5);
- thief: **2d6** added to a byte that becomes the gold coins (+0x109) after the loop (0x3B1F1–0x3B213).

Nothing else gives money at creation: the starting-gold table `DS:5589` ([tables.md](tables.md)) has no
reader (O, no instruction refers to it; CotAB reads its own at 0x3893C) and the fixed 300 platinum of
CotAB is gone. So a new character has 2d6 gold if a thief, else none (**O** for the code; **I** that no
later step adds money). Base movement 12 (+0xED), two half-attacks (+0x121 := 2), as CotAB.

Races and classes offered: the race-class table `DS:4DFF` in SotSB's race order ([tables.md §3](tables.md#3-rule-differences-seen-in-the-tables)).
The level limits by race are the race-limit rows `DS:4D9D`, CotAB's rows of the same races (**I** for
the port's `levelLimits`, which must be re-keyed to the new race numbers).

## 2. Hit points (O, training 0x3DA40: 0x3DA54–0x3DB80)

CotAB's rule ([coab/tables.md §3.4](../coab/tables.md#34-hit-points-o-fun-at-3b230-called-by-chargen-at-389fb-and-by-training-at-3be67)) over classes 0–6: per class with
a level, below its stop level (`DS:4CA9`): the dice count is 1 once the level is above 1, else
`DS:09B0[k]`; the class's die (`DS:09B7[k]`) is rolled **twice and the higher kept**; plus the CON
bonus (0x3D6FD) × the count; at or past the stop level the sum is **replaced** by fighter or paladin 3,
cleric, ranger or thief 2, magic-user 1, and the druid nothing (the sum kept) (0x3DB21–0x3DB48); the
total divided by the number of classes. So the procedure is CotAB's; the table makes a **level-1 cleric
roll 2 dice** (`DS:09B0[0]` = 2, CotAB 1).

**Modify's hit-point limit** (0x3D855, called at 0x3BE89 and 0x3C2AF while abilities are changed): the
maximum HP a character may be given is the average over its classes of below the stop level L × (die
+ CON bonus) (cleric and druid die 8, fighter and paladin 10, ranger (L + 1) × (8 + bonus), magic-user
4, thief 6), at or past it a fixed value (cleric 72 + 2(L − stop + 1), druid 112, fighter, paladin and
ranger 88 + 2(…), magic-user 44 + (…), thief 60 + 2(…)) (O for the arithmetic; I for the reading).

## 3. Spell slots, the WIS and INT limits (O)

- Slots: CotAB's summed increments from a start level (cleric from 2, paladin rows from 9, ranger from 8,
  magic-user from 2), **seven columns** a row ([tables.md](tables.md)); the pools +0x132 (cleric),
  +0x139 (druid), +0x147 (magic-user) and the unexplained +0x140 ([records.md](records.md)). The slot
  routine is 0x56680 (CotAB 0x5047F).
- **The WIS bonus** (0x56CAC, CotAB 0x50AF6): CotAB's six steps (WIS > 12, > 13 a first-level, > 14,
  > 15 a second-level, > 16 a third-level, > 17 a fourth-level slot, each where the level has one), then
  **new**: WIS below 17 clears the sixth-level cleric slots (+0x137), below 18 the seventh-level (+0x138)
  (0x56E15–0x56E32).
- **New, the INT limit** (0x56E3E): INT (+0x13) below 12 clears the magic-user's sixth-level slots
  (+0x14C), below 14 the seventh-level (+0x14D).

## 4. Caster level (O, 0x559E6; CotAB 0x4F8BF)

| Spell class (`DS:449D` + 16·id, byte 0) | SotSB | CotAB |
|---|---|---|
| 0 cleric | max(f·former + cleric, f·former + **paladin**) | cleric, or paladin − 8 |
| 1 druid | max(0, f·former + ranger − 7) | ranger − 7 |
| 3 magic-user | max(f·former + magic-user, f·former + ranger − 8) | class 2: magic-user, or ranger − 8 |
| 4 item | 12 | class 3: 12 |

- The gate: no cleric level, no magic-user level and a ranger below 8 → 6 (CotAB also required a
  paladin below 9).
- Cast from an item (DS:8D99 ≠ 0) and not an item spell → 6.
- **The paladin's term has no −8**: a paladin casts cleric spells at its full level (**O**; I: a slip).
- Spell classes are **0, 1, 3, 4** (O from this routine and the list filter §6; CotAB 0, 1, 2, 3).

## 5. The recalculation and dual-classing (O)

- **The recalculation** 0x569E6 (CotAB 0x50836): THAC0 rows of 19 bytes over seven classes; then the
  attacks: **fighter or paladin above 6 → 3 half-attacks, above 12 → 4; ranger above 7 → 3, above
  14 → 4** (0x56A64–0x56AAB; CotAB had only the first step); the same with the former levels when they
  count (from 0x56C03); the item class mask from `DS:4C92`; the readied items checked as CotAB's.
- **Dual-classing** 0x57417 (CotAB 0x511AE…): the same rule and steps over classes 0–6; humans are race
  **6** (0x573C9; the current-class 0x57323, former-class 0x572CD and current-level 0x57379 tests all
  require it); the slot bytes cleared are 28 (four pools × 7, 0x5788B); a new magic-user gets Detect
  Magic, Read Magic, **Enlarge** and Sleep (0x578B6–0x578CF), unlike creation (§1); 0x573EB is "former
  levels count" (the current level above +0xEF).

## 6. The spell lists (O, 0x477F4; CotAB 0x43F8E)

CotAB's filter with SotSB's spell classes: cleric spells WIS > 8 and a cleric level or a paladin above
8 (or the former ones); druid spells WIS > 8 and a ranger above 6; magic-user spells (class 3) INT > 8
and a magic-user level or a ranger above 8 (current, or former when it counts; 0x478DA–0x47955), a human
in body armour in battle keeping only the ranger term (0x47910); **new**: in the cast lists (the filter's
flag) a **thief above level 10**, or a former thief above 10 when it counts, takes magic-user spells,
armour or not (0x47959–0x4797C); item spells (class 4) never. In the port: `casting.allowed` with
`castList` [thief, 10], set by the cast lists (camp, the sheet, battle; **I** for which lists the original
flags).

## 7. Training, thief skills, the import

- Training: the hit points of §2 after the levels go up (as CotAB's 0x3B557 → 0x3DA40). **No fee** (O):
  the image has no "Training costs" text and the training routine 0x3DA40 no money test where CotAB's
  is (0x3B5A2: the coin total against 1 000). The halls' class bits are `DS:4C99` (as CotAB's use).
- Thief skills: 0x57146, CotAB's 0x50F5A with two differences (O): no readied-item scan (CotAB's Gloves of
  Thievery and Gauntlets of Dexterity, item kinds 0x0B and 2, which SotSB lacks), and the bonus variable
  set to 0 at the start (0x57155), where CotAB's, never set, held 7; the clamp still takes it. The level
  is the class level with its former part (signed, `imul`).
- The CotAB import ([records.md §2](records.md#2-character-record-0x1b7--439-bytes)): base STR clamped to the race and sex limit
  (no bug), then a ranger gets effect 0x69 and a paladin effect 8 with Cure Disease uses +0x6D := 1.

## 8. Draft profile values (informative)

```ts
// SotSB, chargen and progression (spec/A-games/sotsb/chargen-and-progression.md)
spells: { records: 116, named: 116, book: 116 /* ? the book's length */, levels: 7, cleric: 0, druid: 1, magicUser: 3, item: 4, itemSpell: { mask: 0x7f, above: 0xff, minus: 0 } /* ? */ },
startSpells: [11, 18, 19, 21],            // creation 0x3B1C8 (dual-classing: 11, 18, 12, 21, 0x578B6)
startMoney: { coin: 3, fixed: null },      // ! the gold is 2d6 for a thief only: a new procedure (below)
hitPoints: { laterDice: 1, rolls: 2, firstLevelMin: null, fixed: [2, null, 3, 3, 2, 1, 2] },
extraAttacks: { 2: 6, 3: 6, 4: 7 },        // ! and a second step: 2 and 3 above 12, 4 above 14 → 4 (new procedure)
slots: {
  clear: true,
  sources: [ /* CotAB's four, with seven columns each: cleric 1–7 (0x50A1), paladin cleric 1–7 (0x52D2), ranger druid 1–3 + mu 4–5 (0x538D), mu 1–7 (0x5448) */ ],
  wisdom: 'afterCleric', wisBonus: [[12, 1], [13, 1], [14, 2], [15, 2], [16, 3], [17, 4]],
  // new: a level cleared below a WIS / INT: cleric 6 needs WIS 17, 7 WIS 18; magic-user 6 needs INT 12, 7 INT 14
  learn: [{ classes: [0, 3], spellClass: 'cleric', all: false }, { classes: [4], spellClass: 'druid', all: true }],
  doubler: null /* ? */,
},
casterTerms: { 0: [{ cls: 0, minus: 0 }, { cls: 3, minus: 0 }], 1: [{ cls: 4, minus: 7 }], 3: [{ cls: 5, minus: 0 }, { cls: 4, minus: 8 }] },
casterGate: { atLeast: { 0: 1, 5: 1, 4: 8 }, level: 6 },
dualClass: { race: 6, primeFrom: 9, oldAtLeast: 15, newAtLeast: 17 },
recalc: { attacksReset: false, classMask: true },
casting: { /* … combat.md */ allowed: { /* CotAB's, keyed 0, 1, 3; and 3 also a thief above 10 in the cast list */ } },
levelLimits: [ /* CotAB's rows, races renumbered: elf 1, half-elf 2, dwarf 3, gnome 4, halfling 5 */ ],
```

## 9. What the port needs beyond values

*Port status (2026-10-22):* done except the thief's magic-user list: `startMoney.byClass`,
`startClericSlots` 2, `extraAttacks` with two levels a class, `slots.limits`, `dualClass.spells`,
seven spell levels and the classes 0, 1, 3, 4 (`SOTSB_RULES`, [B-model/procedures.md §1, §3, §7](../../B-model/procedures.md#1-spell-slots)).
The start effects by race and class (0x39BAF, 0x39669) and the paladin's effects 0x6D and 0x6E (0x46597,
0x4673A) are in the profile (**O**); training is free and the thief skills take no item and no +7
(`trainingCost` 0, `thief`). Tests:
`test/sotsbrules.test.ts`.

- **Starting money**: a per-class amount (2d6 gold for a thief, nothing otherwise) where `startMoney`
  has one coin and either a fixed amount or the table's dice.
- **Extra attacks with two steps** (3 and 4 half-attacks): `extraAttacks` holds one level per class.
- **Spell levels cleared by WIS and INT** (§3) after the slots are worked out.
- The thief's magic-user list (§6) as an `allowed` term.
- Spell class codes 0, 1, 3, 4 and seven levels in every spell table and list.

## Open

- The third slot array +0x140.
- The cleric spells at creation (`DS:580C`): which ids (data, D5) and whether a druid gets any.
- Whether anything else gives a new character money.
