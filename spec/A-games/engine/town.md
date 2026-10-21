---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Shops, temples, items menu, treasure

> **Status: complete.** Normative. Part A of the [specification](../../README.md): the engine as
> Pool of Radiance defines it. Evidence marks as in the README (**G**: the GameFAQs guide, not
> checked in code). Curse of the Azure Bonds: [coab/tables.md](../coab/tables.md) (temple, money).

Item records, readying and derived statistics are in [records.md](records.md).

## How scripts open them (O)

There is no dedicated opcode. Scripts load the stock or treasure with `TREASURE` (0x27), set a flag in word array B, then run `COMBAT` (0x24). The COMBAT handler (`FUN_29c3_179b`) dispatches:

| Condition | Screen |
|---|---|
| `B[0x6D8]` (ECL 0x6E6C) = 1 | **shop** (`FUN_2f70_053e`); the flag is cleared |
| else `B[0x5C4]` (ECL 0x6DE2) = 1 | **temple** (`FUN_2d14_0d09`); the flag is cleared |
| else no monsters loaded | treasure/aftermath only (`FUN_2e08_1527`) |
| else | battle, then aftermath |

### Where they are (O, `tools/ecl.py` listings)

Every shop and temple script refuses service (jumps to a City Watch fight) while ECL 0x4AC0 > 0 (the party has attacked the watch). A shop runs `CLEAR_MONSTERS`, `TREASURE 0,0,0,0,0,0,0,<record>`, `SAVE 1 → 0x6E6C`, `SAVE 1 → 0x6EF6`, `SAVE 16 → 0x6E6D` (the last two are script-private, **I**: no engine code refers to B offsets 0x7EC or 0x6DA), `COMBAT`. A temple runs `CLEAR_MONSTERS`, `SAVE 1 → 0x6DE2`, `COMBAT`.

| Script, entry | Place | Opening text | Content |
|---|---|---|---|
| ECL3 #0 0xA233 | New Phlan general store | "THE SHOPKEEPER GREETS YOU AND OFFERS YOU ITEMS FOR SALE." | `ITEM3` record 54 |
| ECL3 #0 0xA837 | jeweller | "THE SHOPKEEPER OFFERS JEWELRY FOR SALE." | `ITEM3` record 52 |
| ECL3 #0 0xA8BE | arms and armour | "THE SHOP SPECIALIZES IN ARMS AND ARMOR." | `ITEM3` record 53 |
| ECL3 #0 0xA945 | silver shop | "THE SHOP SELLS SILVER ITEMS." | `ITEM3` record 55 |
| ECL3 #0 0xA064 / 0xA0BC / 0xA9D6 | temples of Tyr, Sune, Tempus | own greeting, then shared code at 0xAA16 "DO YOU SEEK HEALING?" | temple |
| ECL1 #18 | hidden temple of Ilmater (slums) | "WE PROVIDE HELP FOR THOSE WHO CAN REACH US." | temple |

All temples offer the same nine services at the same prices (the engine has one list). `TREASURE` prepends records, so a shop lists its stock in **reverse** record order; the lists below are in display order. Stock is never used up (Buy gives a copy).

**General store** (record 54): Brass Mirror 10, Silver Mirror 20, Flask of Oil ×1 1, Wooden Holy Symbol of Tyr 1, Iron Holy Symbol of Tempus 2, Silver Holy Symbol of Sune 50, Holy Water Vial ×1 25 gp.

**Jeweller** (record 52, all type 70, count 1; displayed most expensive first): Diamond Necklace 50000, Fine Opal Pendant 28500, Platinum Sphere 18500, Emerald Broach 8000, Gold Scarab 4500, Silver Dragon Statuette 2500, Jewelled Silver Wings 1050, Gold Lightning Figurine 650, Pearl Necklace 400, Gold Chain 100, Brass Dragon Figurine 75 gp.

**Arms and armour** (record 53), price gp / weight per unit, in display order (types 1–40, then 41, 42, 43, 44, 47, 46, arrows, 50–58, shield):

| Item | gp / wt | Item | gp / wt | Item | gp / wt |
|---|---|---|---|---|---|
| Battle Axe | 5 / 75 | Halberd | 9 / 175 | Long Sword | 15 / 60 |
| Hand Axe | 1 / 50 | Lucern Hammer | 7 / 150 | Short Sword | 8 / 35 |
| Bardiche | 7 / 125 | Hammer | 1 / 50 | Two-Handed Sword | 30 / 250 |
| Bec De Corbin | 6 / 100 | Javelin ×2 | 0 / 20 | Trident | 4 / 50 |
| Bill-Guisarme | 6 / 150 | Jo Stick | 1 / 40 | Voulge | 2 / 125 |
| Bo Stick | 1 / 15 | Mace | 8 / 100 | Composite Long Bow | 100 / 80 |
| Club | 1 / 30 | Morning Star | 5 / 125 | Composite Short Bow | 75 / 50 |
| Dagger | 2 / 10 | Partisan | 10 / 80 | Long Bow | 60 / 100 |
| Dart ×4 | 0 / 5 | Military Pick | 8 / 60 | Short Bow | 15 / 50 |
| Fauchard | 3 / 60 | Awl Pike | 3 / 80 | Sling | 0 / 2 |
| Fauchard-Fork | 8 / 80 | Quarrel ×20 | 0 / 3 | Light Crossbow | 12 / 50 |
| Flail | 3 / 150 | Ranseur | 4 / 50 | Arrow ×10 | 0 / 4 |
| Military Fork | 4 / 75 | Scimitar | 15 / 40 | Leather Armor | 5 / 150 |
| Glaive | 6 / 75 | Spear | 1 / 50 | Padded Armor | 4 / 100 |
| Glaive-Guisarme | 10 / 100 | Spetum | 3 / 50 | Studded Leather Armor | 15 / 200 |
| Guisarme | 5 / 80 | Quarter Staff | 1 / 50 | Ring Mail | 30 / 250 |
| Guisarme-Voulge | 7 / 150 | Bastard Sword | 25 / 100 | Scale Mail | 45 / 400 |
| | | Broad Sword | 10 / 75 | Chain Mail | 75 / 300 |
| | | | | Splint Mail | 80 / 400 |
| | | | | Banded Mail | 90 / 350 |
| | | | | Plate Mail | 400 / 450 |
| | | | | Shield | 15 / 100 |

**Silver shop** (record 55): Silver Mace 80, Silver Bastard Sword 250, Silver Broad Sword 100, Silver Long Sword 150, Silver Short Sword 80, Silver Two-Handed Sword 300, Silver Dagger ×1 20, Silver Arrow ×20 20, Silver Quarrel ×1 20, Silver Chain Mail 750, Silver Plate Mail 4000, Silver Ring 90, Fine Composite Long Bow 25000 gp. Silver items have the stats of their plain type ([records.md](records.md), type table).

Stacks are bought whole at the record's value: 10 arrows, 20 quarrels, 4 darts, 2 javelins and the sling cost nothing, which makes them the cheapest way to convert coins (see Money).

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

## Money (O, overlay `4c2d`, `FUN_4894_28be`)

Characters keep seven u16 words char[0x88..0x95]: copper, silver, electrum, gold, platinum, gems, jewelry. Each unit weighs 1 coin.

**The pool** is the treasure money table: seven int32 at DS:67F4 (same order), filled by `TREASURE` and by monster loot; DS:6DC0 = "pool holds money". Shops and temples **clear it on entry**. The treasure item list is DS:6810 (also the shop stock).

**Coin value** in gp (gems and jewelry excluded), for a character (`FUN_4894_28be`) or the pool (`FUN_4c2d_00a8`):

`G = (cp·1 + sp·10 + ep·100 + gp·200 + pp·1000 + 100) div 200` (units from DS:0D24; rounds to the nearest gp, halves up, so 1 ep counts as 1 gp and 1 sp as 0).

So 10 cp = 1 sp, 20 sp = 1 gp, 2 ep = 1 gp, 1 pp = 5 gp.

**Paying** a price P (Buy, Identify, temple services):
1. If P ≤ G(character): the character's cp, sp, ep, gp, pp are replaced by pp = (G − P) div 5 and gp = (G − P) mod 5 (`FUN_4c2d_0130`; gems and jewelry untouched).
2. Else if P ≤ G(pool): the same on the pool (`FUN_4c2d_0185`).
3. Else "Not enough money." Character and pool are never combined.

Buy and the temple read G(character) as u16 and both setters take a u16, so value above 65 535 gp is lost on any payment (the guide's 13 107-platinum bug; **Bug**: a conforming build reproduces the wrap).

**Pool** (`FUN_4c2d_0508`): every party member with char[0x84] = 0 (player character) or 0xB3 (NPC that handles money) adds all seven words to the pool and is zeroed.

**Share** (`FUN_4c2d_063a`):
1. n = number of members that may pool (as above). For each type: share = pool div n, rem = pool mod n.
2. For each member with char[0x84] < 0x80 (player characters only), for type jewelry down to copper: if the share fits (encumbrance + share ≤ capacity) add it, then add 1 from rem if that fits; otherwise add what fits and return the rest of the share to rem.
3. For type jewelry down to copper, while rem > 0: each party member in list order (NPCs included) takes min(rem, free capacity).
4. Whatever is left stays in the pool. The shares of 0xB3 NPCs are counted in n but never handed out, so they vanish (bug).

**Take** (`FUN_4c2d_0ceb`): lists the pool's non-empty types (jewelry first); choose one and an amount (input capped at the amount present). If that amount does not fit the character: "Overloaded" and nothing is taken (`FUN_4c2d_0a88`). Repeats until the pool is empty or Escape.

**Drop money** (view character, `FUN_4c2d_0a01`): the coins go to the pool in mode 1 (shop/temple) or 6 (treasure screen); anywhere else they are destroyed.

**Trade money** (view character, `FUN_4894_2156` → `FUN_4c2d_044c`): pick a recipient ("Trade to?"), a coin type and an amount ≤ holdings; refused with "Overloaded" if the recipient cannot carry it. The routine adds the weight back to the giver instead of the recipient; the next recalculation corrects both (I).

## Shop (O, `FUN_2f70_053e`)

1. Mode 1; pool cleared; the stock names are built.
2. Menu for the current character: "Buy View Take Pool Share Appraise Exit" when the pool holds money, else "Buy View Pool Appraise Exit". Home/End select the previous/next character.
3. **B**uy (`FUN_2f70_0361`): pick a stock item (B or Enter); price = item[0x3A]; pay as above; the copy goes to the buyer (`FUN_2f70_0239`: "OverLoaded" if the character cannot carry it, and the money is not taken); loop.
4. **V**iew: the character screen, whose items menu offers **S**ell and **I**d in this mode.
5. **T**ake, **P**ool, **S**hare, **A**ppraise as described in Money and Appraise.
6. **E**xit with money in the pool: "As you Leave the Shopkeeper says, "Excuse me but you have Left Some Money here." Do you want to go back and get your Money?" Yes stays; No leaves and the pool is lost.

**Sell** (`FUN_4894_1cee`, items menu; not for readied items, nor for NPCs in play):
1. offer = item[0x3A] div 2.
2. If count > 1: offer = (offer × count mod 65536) div 20. The code means to treat arrows and quarrels specially but tests `type = 73 and type = 28`, which never holds, so every stack sells at 1/40 of value per unit.
3. "I'll give you N gold pieces for your X. Is It a Deal?" Yes → "Sold!", the item is destroyed.
4. Payment: pp = offer div 5, gp = offer mod 5. If the pp do not fit: "Overloaded. Money will be put in pool."; the character takes as many pp as fit and the rest go to the pool's platinum. The gp are always added to the character.

**Identify** (`FUN_4894_1f52`): "For 200 gold pieces I'll identify your X. Is It a Deal?" Yes → pay 200 (character, else pool, else "Not Enough Money"). If item[0x35] = 0: "I can't tell anything new about your X" (the fee is still taken). Else item[0x35] = 0 and "It looks like some sort of <full name>".

## Temple (O, `FUN_2d14_0d09`)

Entry and menu as in the shop: mode 1, pool cleared, "Heal View Take Pool Share Appraise Exit" (pool has money) or "Heal View Pool Appraise Exit". Leaving with pooled money asks "As you leave a priest says, "Excuse me but you have left some money here" Do you want to go back and retrieve your money?"

**H**eal (`FUN_2d14_09d7`) lists the ten strings at DS:011A (41 bytes each; the tenth is "Exit") for the current character. A service whose condition fails first asks "<reason> cast cure anyway:" (Y/N, `FUN_2d14_0013`). Then "<service> will only cost N gold pieces. pay for cure?" (`FUN_2d14_00bf`): Yes pays as in Money or prints "Not enough money."; success prints "<name> is cured."

| Service | gp | Condition (else the reason) | Effect |
|---|---|---|---|
| Cure Blindness | 1000 | has effect 33 ("is not blind.") | remove effect 33 |
| Cure Disease | 1000 | has any of effects 31, 34, 43, 44, 50, 57 (DS:0114) ("is not Diseased.") | remove all six, silently (DS:681F = 1) |
| Cure Light Wounds | 100 | none | heal 1d8 through the heal routine `FUN_5216_175d` (force 0, `FUN_2d14_0401`): nothing for the Dead, Stoned, Running or anyone with mummy rot, though the fee is paid; Dying → Unconscious → revived (O) |
| Cure Serious Wounds | 350 | none | heal 2d8+1, the same way |
| Cure Critical Wounds | 600 | none | heal 3d8+3, the same way |
| Neutralize Poison | 1000 | has effect 55 ("is not poisoned.") | remove effects 55, 22, 15 |
| Raise Dead | 5500 | status Dead (6) or Animated (1) ("is not dead.") | see below |
| Remove Curse | 3500 | a cursed item (item[0x36]) or effect 36 ("is not cursed.") | runs the Remove Curse spell |
| Stone to Flesh | 2000 | status Stoned (7) ("is not stoned.") | status 0, in play, HP 1 (0x1DAD7) |

**Raise Dead** (`FUN_2d14_0510`): remove effects 32 (Animate Dead) and 55 (poison); HP 1, status 0, in play (0x1D725–0x1D739); if CON > 0, CON −1 (the guide names effect 31 instead of 32; the code passes 0x20). Then, with b = maxHP − char[0xB1] (0 if negative) and the new CON:
1. If CON < 14: max HP is unchanged.
2. Else t = Σ over class levels L > 0 of (fighter: L × (CON − 14); other classes: 2L if CON > 15, else L).
3. loss = b div t if t > 0, else b.
4. If CON < 17 or fighter level ≤ 0: maxHP −= loss.

Raise Dead always succeeds, also on elves (G).

## Items menu (O, `FUN_4894_0ef8`)

Opened from View (character screen) on the current character's item list. Each line shows "Yes"/"No" (readied) and the item name ([records.md](records.md), Display name). Options:

| Key | Option | Shown when |
|---|---|---|
| R | Ready / unready | always |
| U | Use | char[0x10D] (in play), area flag `A[0x1CA]` = 0, and mode 2/3/4, or mode 5 with combat record [2] set |
| T | Trade to another member | not combat, and the character is a PC, out of play or Animated (NPCs in play cannot) |
| D | Drop ("Your X will be gone forever. Drop It?") | always |
| H | Halve a stack | fewer than 16 items |
| J | Join stacks | always |
| S | Sell | shop/temple mode, same PC/NPC rule as Trade |
| I | Identify | shop/temple mode |

After each action the character's statistics are recalculated (`FUN_10ba_0bb8`) and the list is rebuilt.

- **Ready** (R): the rules in [records.md](records.md) (Ready / unready).
- **Available** test for T, D, S (`FUN_4894_0d70`): a readied item gives "Must be unreadied"; a scroll with a spell flagged for scribing asks "<name> was going to scribe from that scroll, is it Okay to lose it?".
- **Use** (U, `FUN_4894_1a8a`): the item must be readied ("Must be Readied"). A scroll (slot 11–14, G) opens its spell list for casting; another item with item[0x3D] > 0 and item[0x3E] < 0x80 casts spell item[0x3D] (minus 0x17 if > 0x38), printing "<name> uses an item". If the cast happens: scrolls lose that spell; otherwise, if item[0x3C] (charges) > 0, a stack (count > 1) loses one unit, a single item loses one charge and is destroyed at 0. Outside combat Use does not end the character's turn.
- **Trade** (T, `FUN_4894_1734`): "Trade with Whom?" (defaults to the last recipient, DS:471A); refused with "Overloaded" if the recipient has 16 items or not enough capacity; else the item moves to the end of the recipient's list.
- **Drop** (D): the item is destroyed (it does not go to the treasure pile, even on the treasure screen).
- **Halve** (H, `FUN_4894_17ed`): n = count div 2; n = 0 → "Can't halve that". Else a copy with count n, unreadied, is inserted after the item, which keeps count − n and its readied flag.
- **Join** (J, `FUN_4894_189d`): merges into the chosen item every other item with count > 0 and the same name words, type, plus, item[0x33], cursed flag and weight, and whose own item[0x3C] < 2. Properties 0x3C–0x3E are not compared with the target (the code compares each candidate with itself, bug), nor are value, readied flag or hidden-name bits. Counts add up to 255; at overflow the target is set to 255 and the remainder stays in the candidate, which becomes the new target for the rest of the scan. Absorbed items are destroyed. A non-stack item (count 0) absorbs stacks of its kind, starting from 0.
- **Sell** (S), **Id** (I): see Shop.

## Appraise (O, `FUN_4c2d_19b2`)

Gems and jewellery are kept as counts in money words char[0x92] (gems) and char[0x94] (jewellery). "No Gems or Jewelry" if both are 0; otherwise "You have a fine collection of: N Gems / N pieces of Jewelry" and a choice. Appraising one decrements its count and rolls its value:

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

rnd(n) = Turbo Pascal `Random(n)`, 0 … n − 1. "The Gem is Valued at N gp." / "The Jewel is Valued at N gp.", then "You can : Sell Keep", or only "Sell" if the character has 16 items or cannot carry 1 more coin.

- **Keep**: a new item, type 70, word n3 = 0x65 "Gem" or 0xD6 "Jewelry", weight 1, value = the roll, count 0, not hidden, appended to the item list. If the character has **no items at all** the new item is never linked in and is lost (bug). Sold later at a shop it fetches half the roll.
- Any other choice sells: value div 5 platinum to the character (`FUN_4c2d_0203`; beyond capacity the rest goes to the pool's platinum with "Overloaded. Money will be put in Pool."). The value mod 5 gp is lost.

## Treasure screen (O, `FUN_2e08_0ecd`)

Shown after combat and for a scripted `TREASURE` with no monsters (mode 6). Before it, NPCs able to take treasure each remove a share of the money ("<name> takes and hides his share.", `FUN_2e08_12e8`; G for the amount: up to 7 shares per NPC, cast to u8).

Menu, by what the pool and item list hold:

| Money | Items | Menu |
|---|---|---|
| yes | any | View Take Pool Share + suffix |
| no | yes | View Take Pool + suffix |
| no | no | View Pool Exit |

Suffix: " Detect Exit" if there are items and the current character has Detect Magic (spell 5 or 11) memorised, else " Exit".

- **T**ake (`FUN_2e08_0d38`): "Take: Money Items Exit"; goes straight to the only kind present. Money uses Take (Money section). Items: pick one (T or Enter); the character receives it unless "OverLoaded", and it leaves the pile.
- **P**ool, **S**hare: as in Money; here the pool is the treasure itself, so Pool adds the party's money to the pile.
- **D**etect: casts the character's memorised Detect Magic through the normal casting routine (so the memorised copy is used up, I); while any party member has effect 5, magic items show "*".
- **E**xit or Escape with treasure left: "There is still treasure left. Do you want to go back and claim your treasure?" Leaving frees the item list (`FUN_2e08_1527`, G); money left in the table stays until the next `CLEAR_MONSTERS`, `TREASURE` or shop/temple entry (I).

## View menu: money, Detect, scroll warning (O, decoded 2026-10-17)

- **View menu** `FUN_4894_0ab3` "View:": Items (if any), Spells (if any slot), **Trade** (any coins, not in combat `DS:49F3` = 5, and not an NPC in play that is not Animated), **Drop** (any coins; also in combat), Exit.
- **Trade money** `FUN_4894_2156`: "Trade to?" (party picker; the giver may pick itself), then "Select type of coin" (one row per non-zero type: name and amount), then "How much <coin>will you trade? " (`FUN_4c2d_0294`: digits, more than held becomes all held, Esc 0). The coin names in the prompt are "Copper ", "silver ", "electrum ", "Gold ", "Platinum ", "Gems ", "Jewelry ". If the recipient's encumbrance + n > capacity: "Overloaded"; otherwise the coins move. **Bug**: both encumbrance updates go to the giver (`4c2d:0020`, `003a`), so the recipient's c[0x102] is stale until recalculated (the port recalculates both). Loops back to the coin list while the giver has money.
- **Drop money** `FUN_4894_24a7`: the same list and "How much <coin>will you drop? "; `FUN_4c2d_0a01` takes the coins off the character, and only in mode 1 (shop, temple) or 6 (treasure screen) adds them to the pool `DS:67F4`; anywhere else they are gone.
- **Treasure Detect** (`FUN_2e08_0ecd`): with items on the screen and the current character holding Detect Magic ready (slot value 5 or 0x0B), the menu ends "Detect Exit". It casts through `FUN_4e53_0c20` without the "casts" line and uses up the memorised copy (`4e53:0EA7`); effect 5 makes every item name with plus > 0, save bonus > 0 or cursed show "* " (`FUN_10ba_0442`) while anyone in the party has it.
- **Scroll warning** `FUN_4894_0d70` (Items Trade, Drop and Sell; not Halve, Join or Use): a readied item gives "Must be unreadied"; a scroll (ITEMS slot 11–13) with a spell marked for scribing (bit 7 of item[0x3C..0x3E]) prints "<name> was going to scribe from that scroll" and asks "is it Okay to lose it?" (No cancels).

## Open

- The shop and temple "Pool" key is skipped while a local flag (passed to the menu and to View) is
  set; when that happens (**?**).
- Appraise: whether Escape at "Sell Keep" sells the gem (every key other than K does on the path
  seen).
- The Remove Curse spell handler used by the temple: not traced here.
- Confirm in DOSBox: the stack Sell price (value/2 × count / 20 for every stack), the vanishing share
  of 0xB3 NPCs in Share, and the lost gem when keeping it with an empty inventory.
