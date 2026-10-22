---
created: 2026-10-22
tags: [reverse-engineering, gold-box, sotsb, spec]
---

# SotSB spell handlers: diff against CotAB `coab/spells.md`

> **Status: first pass.** Normative where marked O. Part A of the [specification](../../README.md):
> Secret of the Silver Blades, GOG 1.0 (the working image of [README.md](README.md#working-image)). Read
> [engine/spells.md](../engine/spells.md), then [coab/spells.md](../coab/spells.md): this file lists what
> differs from CotAB's handlers. Evidence marks as in the [README](../../README.md#evidence-marks). The spell
> ids, names, levels and records are in [tables.md](tables.md); the effect types the handlers add are in
> [effects.md](effects.md), several of them renumbered.

Read from the SotSB image (2026-10-22). Addresses are SotSB image offsets (DS = image 0xDE20).

## 1. Dispatch and shared helpers (O)

- **Table**: far pointers at **DS:8A8E + 4·id** for ids 0–117 (CotAB DS:72BA, 0–100), each a thunk in
  segment 0x113 jumping into code segment 0x4780 (image 0x47800); filled at 0x4DFA4 (entry 0, the target
  hook, also at 0x27C8C for combat, as CotAB's 0x21E1F). The cast routine calls `*DS:8A8E(4·id)` at
  0x48DCC and 0x48F17 (CotAB 0x45405, 0x45550).
- **Names**: the name of id *n* is row *n* − 1 of DS:34AE (35 bytes a row, [tables.md](tables.md)); ids without a
  spell are named "spell *n*" (57, 59–65, 95, 97, 99, 101–109).
- **Helpers** (each CotAB's, found by matching the routines the handlers call; O where the constants are
  the same):

  | SotSB | CotAB | Routine |
  |---|---|---|
  | 0x48846 | 0x44EEF | Apply (the same constants and calls) |
  | 0x48797 | 0x44E02 | Duration (changed, §2) |
  | 0x52988 | 0x4CD91 | add-effect |
  | 0x52A7F | 0x4CE85 | heal: one call and the constants 0x4E, 1 fewer than CotAB's (I: the revive through handler 0x4E is gone) |
  | 0x519F7 | 0x4BDA1 | save |
  | 0x52644 | 0x4CA6A | damage |
  | 0x51A86 | 0x4BE31 | dice |
  | 0x51D17 | 0x4C0FD | remove the first record of a type, "is Cured" |
  | 0x50966 | 0x4ABBA | remove ([effects.md §1](effects.md#1-dispatch-o)) |
  | 0x51F80 | 0x4C389 | the current-stat routine ([effects.md §5](effects.md#5-the-current-stat-routine-0x51f80-o)) |
  | 0x55428 | 0x4F395 | find an effect |
  | 0x559E6 | 0x4F8BF | the caster level, by spell id: the handlers and Duration take L from it themselves |
  | 0x51DD4 | 0x4C1D8 | a new STR beats the base STR |
  | 0x508C0 | 0x4AAC4 | the set-status routine |
  | 0x51512 | 0x4B8F7 | the cloud occupant check ([effects.md §6](effects.md#6-the-cloud-occupant-check-0x51512-o)) |

- **Messages** are built from data-segment pieces: "is " (DS:1B4D) and a word ("Affected" DS:1D4D, "Protected"
  DS:1F4D, "Charmed" DS:23C9, "Healed" DS:1C4D, "Unaffected" DS:1E4D …) joined by the string routines (0xCBFA
  copy, 0xCC87 append), then printed by 0x5429F. CotAB passes one code-segment string. That is the only
  difference in most handlers (§3, "same").
- **Battlefield cells** of the clouds moved: Stinking Cloud 0x1D (CotAB 0x1E), Cloudkill 0x1B (CotAB 0x1C), and a
  new 0x1A for Delayed Blast Fireball's zone (34, 41/46, 91, 115).

## 2. Duration 0x48797 (O)

Duration(id): id 26 (0x1A) → 3780; 40 (0x28) → 1d6 × 10; 57 and 61 (0x39, 0x3D) → 5d4; 59 (0x3B) → 1d4 × 10 +
40; any other → L × record byte +5 + record byte +4 (DS:449D + 16·id), L = 0x559E6(id). CotAB's cases for 0x3F
and 0x43 are gone and id 26's is new; CotAB takes L as an argument.

## 3. Per spell id

"same" = the same constants and the same called routines as CotAB's handler, the message now built from
pieces (§1) (O); "same, calls differ" = the same constants, one or two more calls than the text needs (I);
"changed" and "new" are described. The effect types named are SotSB's ([effects.md](effects.md)).

| id | handler | SotSB |
|---|---|---|
| 3, 4, 13, 15, 20, 28, 31, 37, 39, 44, 47, 51, 58, 60, 64, 65, 66, 68, 71, 72, 74, 87, 92, 97, 100 | | same, as CotAB to the instruction's shape (O) |
| 1, 2, 5, 6, 7, 8, 11, 14, 16, 17, 18, 19, 21, 22, 23, 24, 25, 29, 30, 32, 33, 38, 40, 43, 45, 48, 49, 50, 52, 53, 54, 55, 57, 61, 62, 69, 73, 77, 79, 80, 81, 82, 88, 89, 94, 95, 99 | | same (O) |
| 67, 76, 86 | 4badf, 4bf22, 4c57c | same constants, calls differ (I: not read) |
| 0 | 48a53 | the out-of-combat target hook: one constant more than CotAB's (I: not read) |
| 9 | 4989e | Burning Hands: one more damage-type constant (9) than CotAB (I) |
| 34 | 4a1c5 | Stinking Cloud: zone cell 0x1D (CotAB 0x1E); the occupant check 0x51512 |
| 35 | 4a62c | Strength: one constant fewer than CotAB (I: not read) |
| 91 | 4c739 | Cloudkill: cell 0x1B (CotAB 0x1C), Stinking Cloud's 0x1D for the shared test |
| 10 | 498d1 | **changed** Charm Person: the target's race byte (+0x6B) and the caster level are tested first (+0x6B = 7: unaffected, I: the monster race); then Apply "is Charmed" and the first 11 record's handler at once; else "is Unaffected" |
| 12 | 499af | **changed** Enlarge: the STR by caster level 1–11 (the cases of 0x559E6), only if it beats the base STR (0x51DD4); 0x0C added through **add-effect** with "is Enlarged" (Duration(12), CotAB a raw add), STR recomputed; else "is Unaffected" |
| 26 | 49ed9 | **changed** Slow Poison: a poisoned (0x37) target: HP 0 → 1, status Okay (+0x1A6 := 0) and in play (+0x1A7 := 1) directly, Apply "is Affected", 0x0F raw (0xFF, flag 1); CotAB's Animated test and handler 0x4E are gone |
| 27 | 49f73 | **changed** Snake Charm: tests in play and effect 0x33 (CotAB 0x0E) before Apply "is Charmed" (I: not traced further) |
| 36, 90 | 4a84e | **new** Heal (36; 90 shares the handler although its name row is "Barkskin", O): the four diseases DS:1B3E [31, 34, 43, 44] each removed first-of-type, "is cured" and STR recomputed if any went (0x4A7BD); 0x21 removed: "is no longer blind"; 0x44 removed: "regains intellect", INT and WIS recomputed; then 1d4: heal (max HP − HP − d) unless HP + d > max (then 0), unforced: "is Healed" (HP ends at max − 1d4, CotAB's temple Heal quirk) |
| 41, 46 | 4ab37 | **changed** Dispel Magic: CotAB's, with the cells 0x1B (Cloudkill), 0x1D (Stinking Cloud) and 0x1A (the delayed blast) (I: the square order and the zone lists not re-read) |
| 42 | 4aef6 | **changed** Prayer: Apply with the caster level, "is Affected by Prayer"; CotAB's save constant (4) gone (I) |
| 56 | 4b702 | **new** Harm: the first target gets 0x22 (disease) through add-effect, "is Diseased"; then damage HP − 1d4 (type 0), so HP ends at 1d4 (a target with HP ≤ 1d4: the word wraps, I) |
| 59 | 4b82f | **changed** Giant Strength (item): STR 21 if it beats the base, "gains Giant Strength", raw **0x71** (CotAB 0x92) for 1d4 × 10 + 40, flag 1, STR recomputed |
| 63 | 4b9c8 | **new** (item; CotAB's 63 another): the character becomes 1d4 years younger, not below 18: "is now 18 years old" or "becomes younger" (I: the age word) |
| 70 | 4bc7e | **changed** Sticks to Snakes: the first target's hit dice (+0xEE) ≥ 6: "smashes them flat"; else "turns sticks into snakes", Apply (effect 3, the caster level) and handler 3 at once |
| 75 | 4be69 | **changed** Raise Dead: status 6 or 1, race (+0x6B) not 1 (the elf in SotSB's numbering), the base CON tested; removes 0x37 only (CotAB 0x20 and 0x37), Okay and in play, CON recomputed, HP 1, "is raised" |
| 78 | 4bffb | **changed** Faerie Fire: an empty handler (nothing happens, O) |
| 83 | 4c1ca | **changed** Dimension Door: rewritten on the battlefield routines (0x5CA98, 0x5C362, 0x5CF6A, 0x5CA20, 0x5CA48, 0x5C7C9): the caster "teleports" to the aimed square (I: CotAB's `teleport` kind) |
| 84 | 4c263 | **changed** Fear: adds **0x6F** where CotAB adds 0x8E (the run-away handler, [effects.md](effects.md)) |
| 85 | 4c3c9 | **changed** Fire Shield: **0x70** where CotAB has 0x8F |
| 93 | 4cd49 | **changed** Feeblemind: the race and the classes (+0xEE, hit dice by class bands, I) decide who is affected; Apply, handler 0x44 at once; else "is unaffected"; writes +0xEC |
| 96 | 4ceff | **new** Charm Person or Mammal: Charm Person's procedure (10), "is not Charmed" for a refusal |
| 98 | 4d015 | **new** Cure Light Wounds (druid): heal 1d8 unforced, then 0x555D5 (I: the line) |
| 101–109 | 4970d | empty handlers (the slots have no spell) |
| 110 | 4d0e5 | **new** Death Spell: a pool of 4d20; targets by hit dice bands (eight cases) take their cost from it; each one paid for gets status 6 "drops dead" through the set-status routine (I: the bands' values not transcribed) |
| 111 | 4d211 | **new** Disintegrate: the event-9 probe (DS:A7D4 = the veto), then a save vs 4; failed: status 6 "disintegrates" (set-status) |
| 112 | 4d27c | **new** Globe of Invulnerability: Apply "is Protected" |
| 113 | 4d2d5 | **new** Stone to Flesh: a stoned (status 7) target: Okay, in play, HP 1, "is no longer a statue"; in combat (DS:67E7 = 5) put back on the battlefield; else "is not stoned."; a further branch: "is Unaffected", or Apply (I) |
| 114 | 4d4d8 | **new** Flesh to Stone: the event-9 probe, a save vs 4; failed: status 7 "is turned to stone" (set-status) |
| 115 | 4d590 | **new** Delayed Blast Fireball: asks "Blast Delay in segments (1-50)? ", lays a cell-0x1A zone (an effect added raw, 100, flag 1, holds the delay; the zone's +0x1A/+0x1B/+0x1C its square and count, as CotAB's clouds), "Sets a delayed blast fireball." (I: when it goes off, effects.md) |
| 116 | 4d838 | **new** Mass Invisibility: every target (in combat the targets around the aim, 0x556D0) gets Apply "is Invisible (spell)" |
| 117 | 4d8ed | **new** Power Word Stun: by the target's HP: 1–30 → 4d4, 31–60 → 2d4, 61–90 → 1d4 rounds, more → nothing; added through add-effect with "is STUNNED" (I: the effect type) |

## 4. The profile's spell map (draft)

`web/src/games/spellrules.ts` would take CotAB's map for the ids marked "same", and for the others (kinds as
the port names them; parameters to be confirmed where marked I above):

```ts
// SotSB: CotAB's handlers but these (spec/A-games/sotsb/spells.md §3)
const SOTSB_SPELL_CHANGES = {
  10: { k: 'charm', race: 7, msg: /* "is Charmed" */ 0, unaffected: /* "is Unaffected" */ 0 },
  12: { k: 'strength', table: 'enlarge', overBase: true, via: 'addEffect', effect: 0x0c },
  26: { k: 'slowPoison', revive: 'direct' },
  36: { k: 'healAll', diseases: [31, 34, 43, 44], blind: 0x21, feeble: 0x44, dice: [1, 4], to: 'maxLess' },
  56: { k: 'harm', effect: 0x22, dice: [1, 4] },
  59: { k: 'strength', str: 21, raw: 0x71, duration: { n: 1, d: 4, times: 10, plus: 40 } },
  63: { k: 'younger', dice: [1, 4], floor: 18 },
  75: { k: 'raise', statuses: [6, 1], races: [1], removes: [0x37] },
  78: { k: 'none' },
  84: { k: 'scare', effect: 0x6f },
  85: { k: 'flameShield', effect: 0x70 },
  90: { k: 'healAll' /* the Heal handler */ },
  96: { k: 'charm', race: 7 },
  98: { k: 'heal', amount: { n: 1, d: 8 } },
  110: { k: 'slay', pool: { n: 4, d: 20 }, status: 6 },
  111: { k: 'saveOrElse', probe: true, save: 4, status: 6 },
  112: { k: 'apply' },
  113: { k: 'stoneToFlesh' },
  114: { k: 'saveOrElse', probe: true, save: 4, status: 7 },
  115: { k: 'delayedBlast', cell: 0x1a, maxDelay: 50 },
  116: { k: 'apply', all: true },
  117: { k: 'stun', bands: [[1, 30, 4, 4], [31, 60, 2, 4], [61, 90, 1, 4]] },
  ...Object.fromEntries([101, 102, 103, 104, 105, 106, 107, 108, 109].map((id) => [id, { k: 'none' }])),
}
```

New kinds the port would need: `healAll` (Heal), `harm`, `younger`, `stoneToFlesh`, `delayedBlast`, `stun`, and
the Death Spell pool on `slay`; `saveOrElse` takes the event-9 probe as a parameter. The texts are DS pieces,
so the profile's message parameters become pairs (or the port's `say` joins "is " and a word).

## Open

- The handlers marked I in §3 (0, 9, 27, 35, 41/46, 42, 67, 76, 83, 86, 93, 110, 113, 115, 117): read them as CotAB's
  were (coab/spells.md §2), with their constants.
- When a delayed blast fireball goes off, and its damage.
- Why id 90 (named Barkskin) shares Heal's handler.
- Spells 57, 59–65, 95, 97, 99 (the item and unnamed ids): which items cast them (ITEMS +0x3D).
