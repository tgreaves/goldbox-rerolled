# CotAB creation and progression vs Pool of Radiance

> **Status: complete as a set of differences.** Normative, except passages marked *informative*.
> Part A of the [specification](../../README.md): Curse of the Azure Bonds (GOG 1.0). Read
> [engine/chargen-and-progression.md](../engine/chargen-and-progression.md) first; the rules tables
> are in [tables.md](tables.md), the record bytes in [records.md](records.md). Addresses are image
> offsets in the working image ([README.md](README.md#working-image)); `DS:x` is image 0xABE0 + x.
> How the engine model parametrises it: [B-model/procedures.md §7.1, §7.2](../../B-model/procedures.md#71-the-recalculation).

CotAB keeps PoR's creation and training. What it changes: the recalculation after a level, the
magic-user's starting spells, and the new **dual-classing** for humans, with the former-level rule
the rest of the engine honours. Pool of Radiance has no dual-classing (no function or text for it in
its files; G: Lee, "dual-classing is not available").

## 1. The recalculation (O, 0x50836)

PoR's `FUN_51cf_0000` with these differences ([records.md §2.2](records.md#22-recomputed-on-loadimport-o-504703c6)
lists the same routine as `5047:03c6`; thunk `fe:25`; called by training 0x3BD91, joining
0x35625 and 0x35AF6, the level-restore effect 0x47E69, dual-classing 0x51691):

1. THAC0 (char+0x73) = the greatest `DS:3E3A[k·13 + L]` over **all eight classes**, L the class's
   level read signed, so a class without a level reads its level-0 row (PoR does the same, O at
   `41cf0`). Every level-0 row but the fighter's and the magic-user's holds 40, so a character's
   base is never below 40 (THAC0 20): the magic-user's 39 for levels 1–5 never shows.
2. The highest level (+0xE5) is only raised: max(+0xE5, every level) (PoR the same at 0x41D56).
3. Extra attacks: fighter or paladin above 6, ranger above 7 → +0x11C = 3. **It is never set back to
   2** (PoR sets 2 for a fighter below 7): creation and dual-classing set 2.
4. Spell slots (0x5047F, [tables.md §3.5](tables.md#35-spell-slots-o-fun-at-50480)), saves (0x50C6B),
   thief skills (0x50F5A) when the thief level (+0x10F) is above 0.
5. **The item class mask** (+0x12B) is worked out again: the sum of `DS:3EA2[k]` over the classes with
   a level, and over those with a former level (+0x111 + k) above 0 and below the highest level.
   Then each of the 13 readied items (+0x151) whose type's class byte (`DS:5D1D` + type·16, ITEMS
   byte 13) shares no bit with the mask and that is not cursed (+0x36 = 0) is put away (+0x34 = 0).
6. When former levels count (0x51841, [tables.md §3.7a](tables.md#37a-caster-level-o-0x4f8bf-thunk-edca-por-fun_10ba_26c2)):
   the extra attacks again from the former levels (0x50A3B), the THAC0 again with the former levels,
   and the thief skills again when there is a former thief level (+0x117 > 0).

Training (0x3B557, after the levels go up and the recalculation) gains hit points only when the
highest level (+0xE5) is above the change level +0xE6 (signed, 0x3BE45). +0xE6 is 0 for a created
character and the highest level for an imported one ([records.md §7.2](records.md#72-engine-conversion-o-323c14b3-caller-323c23f82481)),
whose next level passes it; it matters for a dual-class character (§2).

The magic-user's starting spells (creation 0x389B7, dual-classing 0x515F9) are Detect Magic (11),
Read Magic (18), **Enlarge (12)** and Sleep (21); PoR's are Detect Magic, Read Magic, Shield (19)
and Sleep. (The character loader 0x34660 grants PoR's four in its path for another game's record,
[records.md §7.5](records.md#75-hillsfar-brief-o-for-structure); unused by the port.)

The cleric's WIS bonus slots (0x50AF6, called by the slot routine at 0x50568 with 0) follow PoR's
`FUN_51cf_01af` and apply only with a cleric level (the cleric level with its former part,
f·+0x111 + +0x109): a paladin's cleric slots never get them. Called with 1 (dual-classing) it first
sets the cleric slots back to one first-level slot and adds the rows `DS:42BC[L·5 + n]` again.

## 2. Dual-classing (O, 0x5135D)

### Where

The party screen's function table (`DS:0553` + 0x2A·i, [strings.md §4.1](../../D-appendices/strings.md#41-menus))
has a fifth entry, "Human Change Classes" (0x0B1DB), hot key **H** (0x36CEF). It is shown, like
Train, only when the party screen is opened by a training hall's script (`B[0x550]` ≠ 0, or the
cheat 0x75A1; [engine/input-and-menus.md §2](../engine/input-and-menus.md#2-party-screen-fun_417f_0161)),
and then only when the current character is human (0x51822: race +0x74 = 7) and has no former class
(0x5171A: the first class 0–6, else 7, whose former level is not 0; none if that level is not above 0,
returning 0x11).

### Allowed classes (0x511AE)

The list "Pick New Class" (0x5131D) holds the race's classes (`DS:3FFA` + race·14: count, ids; for a
human cleric, fighter, magic-user, thief, paladin, ranger) in that order, keeping class *k* when:

1. *k* is not the current class (0x51776: the first class 0–6, else 7, whose level is not 0, if
   that level is above 0);
2. every ability *a* (0 STR … 5 CHA) whose minimum for the **current** class (`DS:4174` + class·6 + a)
   is 9 or more has a **base** value (+0x10 + 2a) of at least 15;
3. every ability whose minimum for class *k* is 9 or more has a base value of at least 17;
4. the alignment (+0x11B) is one of class *k*'s (`DS:41DA` + k·10: count, ids).

With no class left: "*Name*" and " doesn't qualify." (0x5132C) and the function ends. Otherwise the
list widget offers Select (0x5133F) and Exit; Exit ends it with nothing changed.

So a fighter needs STR 15 (its minima: STR 9, WIS 6, DEX 6, CON 7) and a paladin as the new class
STR, INT, WIS, CON and CHA 17 (minima 12, 9, 13, 9, 17).

### The change (0x51521)

On Select, with *k* the chosen class (found by comparing its name with `DS:0CB8` + 0x1B·k):

1. experience (+0x127, u32) := 0; attacks (+0x11C) := 2;
2. the former level of the current class (+0x111 + cur) := the current level (0x517D2: the level of
   the first class 0–6, else 7, whose level is not 0);
3. the change level +0xE6 := the highest level +0xE5; +0xE5 := 1;
4. the current class's level := 0; class *k*'s level := 1;
5. the 15 slot bytes +0x12D… := 0; *k* = cleric: the first-level cleric slot +0x12D := 1; *k* =
   magic-user: the first-level magic-user slot +0x137 := 1 and spells 11, 18, 12, 21 known (+0x78 + id);
   the rest of the spell book is kept;
6. the class byte +0x75 := *k*;
7. "*Name*" " is now a 1st level " (0x51346), the class name, "." (0x5135B);
8. the memorised spells (+0x1E, 84 bytes) := 0;
9. the recalculation 0x50836 (§1), the cleric slots from scratch 0x50AF6(1), saves 0x50C6B, thief
   skills 0x50F5A (unconditionally: a former thief's skills fall to the level-0 row);
10. every item of the character's list (+0x14D, next +0x2A), readied or not, whose class byte shares
    no bit with the new mask and that is not cursed, is put away.

Hit points, abilities, effects and money are unchanged.

### The former class afterwards (O)

Until the new class's level passes the former one (0x51841: the current level above +0xE6) the old
class gives nothing: no hit points from training (§1), and every former-level reading below is off.
From then on these read the former levels (each **O** at the address):

| What | Where | Rule |
|---|---|---|
| caster level | 0x4F8BF | the class's level plus its former level ([tables.md §3.7a](tables.md#37a-caster-level-o-0x4f8bf-thunk-edca-por-fun_10ba_26c2)) |
| spell slots | 0x504AC | a former level stands in for the class's own |
| THAC0, attacks, thief skills | 0x50A10 | §1 step 6 |
| item class mask | 0x50929 | a former level below the highest level counts (§1 step 5; not tied to 0x51841) |
| thief skills | 0x50F5A | the level f·former + current ([tables.md §3.8](tables.md#38-thief-skills-o-0x50f5a)) |
| PARTY_STRENGTH, ECL 0x7CC9 | 0x19B7E | the levels with their former parts ([ecl.md](ecl.md)) |
| CON hit points | 0x4C7B8 | [effects.md](effects.md) |
| strength spells | 0x46BF8 | [spells.md](spells.md) |
| paladin abilities | 0x3D530 (View) | a former paladin's Lay on Hands and Cure Disease ([records.md §10](records.md#10-creation-effects-and-paladin-abilities-o)) |
| the character's level lines | 0x38B07 (View), 0x3D87C | a former class is listed, with its former level, when that level is below the current level (0x517D2) |

## Open

- The former-level readings in combat (the sweep level, the backstab, Turn Undead) and the
  locked-door menu are listed in [combat.md](combat.md) once examined.
