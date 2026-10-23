# SotSB camp: differences from Curse of the Azure Bonds

> **Status: first pass (2026-10-22).** Normative, except passages marked *informative*. Part A of the
> [specification](../../README.md): Secret of the Silver Blades (GOG 1.0). Read
> [coab/camp.md](../coab/camp.md) first (and through it [engine/camp-and-time.md](../engine/camp-and-time.md)).
> Addresses are offsets in the working image ([README.md](README.md#working-image)); `DS:x` = image
> 0xDE20 + x. Routines were matched to CotAB's as in [combat.md §1](combat.md#1-how-the-routines-were-found-informative).

## 1. Menus (O)

| Menu | SotSB (image) | CotAB |
|---|---|---|
| camp | "Save View Magic Rest Alter Fix Exit" (0xE1F8) | the same |
| magic | "Cast Memorize Scribe Display Rest Exit" (0xE221) | the same |
| alter | "Order Drop Speed Icon **Level** Exit" (0xE249) | "Order Drop Speed Icon **Pics** Exit" |
| level (new) | "Novice Squire Veteran Adept Champion" (0xE272) | — |
| rest | "Rest Days Hours Mins Add Subtract Exit" (0x46F2B) | the same |

The camp screen is 0x38FAF (CotAB 0x321CB, "The party makes camp...", 0x38F66). **Save** (0x390BE–0x39125,
O; DOSBox): A word 0x278 (ECL 0x4A3C) += 1 before the save; behind it a test of the count against 30
(0x390D2) is jumped over (0x390D8 `jmp 0x390F7`), so the code it guards (0x390DA–0x390F2: a call, the
quit 0x6EF:0 on its answer, the count back to 0) never runs; then the save 0xF8:0x57 and
"Quit to DOS" Yes No (CS 0x30CE; Y quits). CotAB's Save (0x322BF) has neither. The port: `saveCounter`
([B-model/records-and-tables.md §4](../../B-model/records-and-tables.md#4-save-files-savefiles)), the
camp's Save and the save-anywhere of IMP-002 count; the question follows as the original's ([C-port/screens.md §6.1](../../C-port/screens.md#61-the-camp-menu)). Neither the camp
menu nor Alter's (0x37C92) prints a prompt: the image has no "Camp:" or "Alter:" (O; the port's
`camp` and `alter` strings are empty).

## 2. Alter → Level (O, 0x37C92–0x37D3D)

New: the difficulty ([combat.md §5](combat.md#5-difficulty-o)). The menu (DS:0x452, a horizontal menu
with the current level highlighted, DS:8A61 := level + 1) takes N, S, V, A or C and sets A word 0x3E8
(ECL 0x4CF4) to 0–4; any other answer keeps it (the port: Escape, `MenuOpts.cancel`). The Pics choice of CotAB's Alter is gone (**I**: the
NPC portrait switch; not looked for elsewhere).

## 3. Fix (O, 0x38E56)

CotAB's Fix ([coab/camp.md §1](../coab/camp.md#1-fix-o-0x320d8)) in outline (wounds 0x38247, the
memorised cures 0x3802C, the rest estimate 0x382A1, the silent rest, the slots' cures 0x38161, the
sharing 0x38692) with more cures and a second pass for conditions:

1. **The memorised cures** (0x3802C) read the 75 memorised slots (+0x1E, to index 0x4A) of every Okay
   member: Cure Light Wounds (3) and the druid's Cure Light Wounds (98) add 1d8, Cure Serious Wounds
   (58) 2d8 + 1, Cure Critical Wounds (71) 3d8 + 3, **Heal (36) 4d8 + 5** and counts a Heal; and it
   counts, adding nothing to the pool, Neutralize Poison (67), Raise Dead (75), Remove Curse (43 and
   89), Stone to Flesh (113), Cure Blindness (37) and Cure Disease (39) (0x38075–0x38131). Spell ids are
   SotSB's ([tables.md](tables.md), names at DS:34AE + 35·(id − 1)).
2. **The rest estimate** (0x382A1) adds terms for the new slot levels: per Okay member **with WIS above 3**
   (+0x15, 0x3831C; a member below it is passed over as one not Okay), first-level
   cleric slots (+0x132) × 15 minutes, a druid term (+0x13A, the druid's second-level slots; its count joins
   the first-level cures' count, 0x3835B) × 30, fourth-, fifth- and sixth-level
   cleric slots (+0x135, +0x136, +0x137) × 60, 75 and 90; the base time 240 for level 1 (and the druid
   term), 360 for levels 4–5, **480 for level 6**; the estimate's weights 0x1B, 0x1B, 0x22/0x4E and 0x5A
   (**I** for the exact grouping, which follows CotAB's shape). Seen in DOSBox (2026-10-23): a level-8 cleric
   with slots 5 5 4 3 and four memorised Cure Light Wounds, three members wounded: Fix rested 10 h 15 =
   360 + 5 × 15 + 3 × 60 minutes, the estimate not shortening it (O for those terms; the port had read the
   druid term from the cleric's first-level slots, 2 h 30 more).
3. If the rest is not interrupted: the slots' cures (0x38161), then **the conditions** (0x387CE), then
   the sharing of the pool (0x38692), the roster redrawn, the rest vector restored; then a second
   estimate and silent rest (0x38D11, 0x384BC) and, if not interrupted, the conditions again.
4. **The conditions** (0x387CE, **O**, read in full): for each member in party order (the list from
   DS:7D3C, link +0x19D), with a per-member mark cleared, each test in this order, each only while its
   count is above 0, printing the member's name and the message (CS strings 0x38746–0x387C0):
   - Heal (count of 36), when the member has effect 0x44 (feeblemind): 0x44, 0x21 (blindness) and each
     of the four diseases (DS:1B3D[1..4]) removed, the member marked, "is healed", the count − 1;
   - Stone to Flesh (113), status 7: Okay, in play, HP 1, "is changed back to flesh", − 1 (0x388CC);
   - Neutralize Poison (67), effect 0x37: HP 1 if 0; 0x37, 0x16 and 0x0F removed; in play, Okay, "is
     detoxified", − 1 (0x38923);
   - Raise Dead (75), status 6 and race (+0x6B) neither 2 nor 1 (half-elf, elf): 0x37 removed, HP 1,
     Okay, in play, CON (+0x19) − 1 if above 0; with CON 14 or more the maximum HP above the rolled HP
     (+0x70 − +0x131) divided by the CON units (each class with a level: fighter, paladin and ranger
     level × (CON − 14), the others the level, twice above CON 15; bytes) is subtracted unless CON is
     17 or more and the fighter level is not above 0 (and not above +0xEF); "has been raised from the
     dead", − 1 (0x389DD–0x38B94);
   - Remove Curse (43, 89), effect 0x24: the spell's handler `113:4d` on the member (DS:8C67), "is
     relieved of a curse", − 1 (0x38B98);
   - Cure Disease (39), unless marked: each disease removed; if any was, the member marked, `145:8e`
     (the member, 0) and "is cured of disease"; **the count is not lowered** (0x38BF1);
   - Cure Blindness (37), unless marked, when the member has 0x21: 0x21 removed **from the selected
     character** (DS:7D38), "regains sight" with that character's name; the count is not lowered
     (0x38C99, **Bug**: the member tested is not the one cured).

   A count is spent only on a member who needs it. The second pass (0x38D11, O) counts the members still
   in need: dead and not an elf or half-elf, petrified, cursed (0x24), poisoned (0x37), feebleminded
   (0x44; then neither of the next two), blind (0x21), 0x22. The second estimate (0x384BC, O) sums over
   the Okay members the slots that cure each (Raise Dead: cleric level 5; Stone to Flesh: magic-user
   level 6; the curse: magic-user level 4 and cleric level 3; poison: cleric 4; feeblemind: cleric 6;
   blindness and 0x22: cleric 3) and takes Σ min(slots, need) × 75, 90, 45, 60, 90, 45, 45 minutes
   (as hours, tens and minutes, DS:8DA2/8DA0/8D9E) for the silent rest (`10c:2f`); not interrupted, the
   condition pass again with the counts the first left (they are not counted again).

What it comes to: SotSB's Fix also cures with the clerics' memorised condition spells, without casting
or forgetting them (I: the slots stay, as CotAB's).

## 4. Rest, memorise, scribe, the clock

- The rest prompt and the rest loop are CotAB's (0x46DA8 at 0.97 of CotAB's 0x4142A; 0x4751F against
  0x41AA3; "Your repose is suddenly interrupted!" 0x475E1; "The Whole Party Is Healed" 0x470AC) (O for the
  strings, I for the rest).
- Memorise and scribe take seven spell levels ([chargen-and-progression.md](chargen-and-progression.md))
  (**I**).
- The clock is CotAB's ([ecl.md](ecl.md), PASS_TIME) (**I**).
- A spell that cannot be cast in camp asks "Lose it?" ([combat.md §11](combat.md#11-casting-o-0x48a53)).

## 4a. The temple (O, 0x22FA5)

A town service, described here for its kinship with Fix. The menus are CotAB's ("Heal View Take Pool
Share Appraise Exit" 0x2319F, without money "Heal View Pool Appraise Exit" 0x231C7); Heal prints
"*Name*, how can we help you?" (0x22F83) and lists the ten services (`templeNames`, "Heal Exit" 0x22F9B).
**No price is asked or paid, and there is no "cure anyway?"**: each service cures, or says why not,
in a line "*Name* *line*" (0x151:0x84), on the current character (DS:7D38):

| Service | Routine | Does |
|---|---|---|
| Cure Blindness | 0x225F6 | effect 0x21: off, "can see!"; else "is not blind" |
| Cure Disease | 0x22683 | any of the four diseases (DS:1B3E): "is cured" (DS:0x142), each removed first-of-type, STR worked out again; else "is not Diseased" |
| Cure Light / Serious / Critical Wounds, Heal | 0x227E1 (1–4) | "is healed"; status 6 "must be raised from dead", 7 "can only be healed by a stonemason", 8 "is not here" (no healing); full HP "has no need of healing" (none); else 1d8, 2d8 + 1, 3d8 + 3, or (Heal) max − HP − 1d4 as a byte, through the heal routine; Heal also takes off 0x21, 0x44 and the diseases ("is cured", then "is fully healed" instead of "is healed") and works out INT and WIS again |
| Neutralize Poison | 0x22D12 | effect 0x37: HP 0 → 1, 0x37, 0x16, 0x0F off, in play, status 0, "is no longer poisoned"; else "is not poisoned" |
| Raise Dead | 0x22AA7 | status 6 only ("is not dead yet"); an elf (race 1) "cannot be raised"; else "is ressurected": 0x37 off, HP 1, Okay, in play, the current CON −1 and the maximum HP loss of [B-model/procedures.md §9](../../B-model/procedures.md#9-temple) with fighters, paladins and rangers weighing by CON |
| Remove Curse | 0x22E26 | a cursed item (+0x36) or effect 0x24: the Remove Curse spell (DS:8C67 := the character, `113:4d`), "rejoices.  The curse has been lifted!"; else "is not cursed" |
| Stone to Flesh | 0x22F0B | status 7: Okay, in play, HP 1, "is turned to flesh"; else "is not petrified" |

Port: `R.templeHeal` `{ mode: 'free', raise }`, `ui/town.ts` `freeCure`; `test/temple.test.ts`.

## 5. Draft profile values (informative)

```ts
// SotSB, camp (spec/A-games/sotsb/camp.md)
fix: { cures: [{ spell: 3, level: 1, dice: 1, sides: 8, bonus: 0, minutes: 15, base: 240, group: 0, weight: 27 },
  { spell: 98, level: 1, dice: 1, sides: 8, bonus: 0, minutes: 30 /* I: the druid term */, base: 240, group: 0, weight: 27 },
  { spell: 58, level: 4, dice: 2, sides: 8, bonus: 1, minutes: 60, base: 360, group: 1, weight: 34 },
  { spell: 71, level: 5, dice: 3, sides: 8, bonus: 3, minutes: 75, base: 360, group: 1, weight: 78 },
  { spell: 36, level: 6, dice: 4, sides: 8, bonus: 5, minutes: 90, base: 480, group: 2, weight: 90 }], start: 14 /* ? */,
  // new: the condition cures (§3), by spell id
  conditions: { 36: 'heal', 113: 'stoneToFlesh', 67: 'neutralizePoison', 75: 'raiseDead', 43: 'removeCurse', 89: 'removeCurse', 39: 'cureDisease', 37: 'cureBlindness' } },
alterLevel: { variable: 0x4cf4, start: 2, menu: 0x0e272 },  // with the difficulty of combat.md §5
```

## 6. What the port needs beyond values

*Port status (2026-10-22):* done. `rules.fix` holds the five cures and the condition pass as data
(`fix.conditions`, [B-model/procedures.md §12.4](../../B-model/procedures.md#124-the-camps-fix);
rules/camp.ts `fixConditions`, Raise Dead's loss shared with the temple); Alter → Level sets
`R.difficulty`'s variable through the game's `alterLevel` menu (ui/camp.ts; the port names the
current level in the prompt where the original highlights it); the second rest and condition pass
(`fix.second`, `secondRest`). Not done: the fighter-level test against +0xEF in Raise Dead's loss (a non-fighter
with a negative dual-class byte only). Tests: `test/sotsbrules.test.ts`.

## Open

- The rest estimate's exact grouping (§3.2); the druid term's slot (+0x13A is the druid's second level
  by [records.md](records.md)'s map: ?).
- What `145:8e` does after Cure Disease (I: a recalculation); what effect 0x22 is.
- Memorise and scribe with seven levels, the Pics choice's removal, read in full.
