---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Shops, temples, items menu, treasure

Part of [[spec/README]].

## How scripts open them (O)

There is no dedicated opcode. Scripts load the stock or treasure with `TREASURE` (0x27), set a flag in word array B, then run `COMBAT` (0x24). The COMBAT handler (`FUN_29c3_179b`) dispatches:

| Condition | Screen |
|---|---|
| `B[0x6D8]` = 1 | **shop** (`FUN_2f70_053e`); the flag is cleared |
| else `B[0x5C4]` = 1 | **temple** (`FUN_2d14_0d09`); the flag is cleared |
| else no monsters loaded | treasure/aftermath only (`FUN_2e08_1527`) |
| else | battle, then aftermath |

## Game modes (O, `DS:49F3`)

| Value | Mode | Set by |
|---|---|---|
| 0 | party / training hall screen | `FUN_417f_0161` |
| 1 | shop or temple | `FUN_2d14_0d09`, `FUN_2f70_053e` |
| 2 | camp | `FUN_3f81_1e6f` |
| 3 | wilderness travel (areas 25–27) | main loop |
| 4 | map exploration | main loop |
| 5 | combat | battle setup |
| 6 | after combat | `FUN_2e08_1527` |
| 7 | ending | `FUN_4804_02a4` |

## Shop (O, `FUN_2f70_053e`)

Menu (per character): **B**uy, **V**iew, **T**ake (from the money pool), **P**ool money, **S**hare money, **A**ppraise gems/jewellery, **E**xit. Leaving with pooled money left: "As you Leave the Shopkeeper says, \"Excuse me but you have Left Some Money here.\" Do you want to go back and get your Money?"

- **Stock** = the treasure item list (`DS:6810`) loaded by the script's `TREASURE`
- **Buy** (`FUN_2f70_0361`): price = item value (item[0x3A], gp); paid from the character's money if enough (`FUN_4894_28be` totals it), otherwise from the pool (`DS:67F4`); "Not Enough Money" otherwise; the item is copied to the buyer (`FUN_2f70_0239`, fails if overloaded)
- **Sell** and **Id** appear in the items menu while in mode 1 (below)

## Temple (O, `FUN_2d14_0d09`)

Menu: **H**eal, **V**iew, **T**ake, **P**ool, **S**hare, **A**ppraise, **E**xit (same money-left warning, priest version).

Heal services (`FUN_2d14_09d7`, names at DS:011A, 41 bytes each), for the current character:

| Service | Price (gp) | Effect |
|---|---|---|
| Cure Blindness | 1000 | remove effect 0x21 |
| Cure Disease | 1000 | remove disease effect |
| Cure Light Wounds | 100 | heal 1d8 |
| Cure Serious Wounds | 350 | heal 2d8+1 |
| Cure Critical Wounds | 600 | heal 3d8+3 |
| Neutralize Poison | 1000 | remove poison |
| Raise Dead | 5500 | only if Dead or Animated: remove effects 0x20 and 0x37, HP 1, status Okay, CON −1; recompute max HP if CON > 13 (loses part of the CON bonus) |
| Remove Curse | 3500 | remove curse |
| Stone to Flesh | 2000 | restore a Stoned character |

A confirmation is asked when the character doesn't need the service (`FUN_2d14_0013`); payment by `FUN_2d14_00bf(price)`.

## Items menu (O, `FUN_4894_0ef8`)

Options shown depend on mode and the character:

| Key | Option | Shown when |
|---|---|---|
| R | Ready / unready | always |
| U | Use | character can act, not in area flag `A[0x1CA]`, and mode camp/wilderness/map, or combat if allowed |
| T | Trade to another member | not an NPC (or not able to act), not in combat |
| D | Drop ("Your X will be gone forever. Drop It?") | always |
| H | Halve a stack | fewer than 16 items |
| J | Join stacks | always |
| S | Sell | shop mode, not an NPC |
| I | Identify | shop mode |

- **Sell** (`FUN_4894_1cee` → offer routine at 0x4A62E): "I'll give you N gold pieces for your X. Is It a Deal?"; if overloaded, "Money will be put in pool"
- **Identify** (`FUN_4894_1f52`): "For 200 gold pieces I'll identify your X"; reveals hidden name words (item[0x35]); "I can't tell anything new about your X" if nothing is hidden

## Appraise (O, `FUN_4c2d_19b2`)

Gems and jewellery are kept as counts in money words char[0x92] (gems) and char[0x94] (jewellery). Appraising one rolls its value:

| d100 | Gem value (gp) |
|---|---|
| 1–25 | 10 |
| 26–50 | 50 |
| 51–70 | 100 |
| 71–90 | 500 |
| 91–99 | 1000 |
| 100 | 5000 |

| d100 | Jewellery value (gp) |
|---|---|
| 1–10 | 100 + rnd(900) |
| 11–20 | 200 + rnd(1000) |
| 21–40 | 300 + rnd(1500) |
| 41–50 | 500 + rnd(2500) |
| 51–70 | 1000 + rnd(5000) |
| 71–90 | 2000 + rnd(6000) |
| 91–100 | 2000 + rnd(10000) |

Then **K**eep (becomes an item of type 0x46, name word 0x65 "Gem" or 0xD6 "Jewelry", value as rolled; refused if overloaded or 16 items) or sell: `value / 5` added to the character's money (`FUN_4c2d_0203`, **I** platinum, 1 pp = 5 gp).

## Treasure screen (O, `FUN_2e08_0ecd`)

After combat or a scripted `TREASURE` with no monsters: **V**iew, **T**ake items, **P**ool, **S**hare, **D**etect (magic), **E**xit; leaving with treasure on the ground asks to confirm.
