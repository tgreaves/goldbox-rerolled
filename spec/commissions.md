---
created: 2026-10-16
tags: [reverse-engineering, gold-box, spec]
---

# Commissions and proclamations

The engine has no quest system. Commissions, rewards and the proclamations are kept in ordinary ECL variables in the A array (global and saved with the game, [[spec/savegame]]), and the scripts set and test them. The City Hall clerk is `ECL3` record 8; the proclamation walls outside City Hall are in `ECL3` record 0. All of this is observed from the scripts (O).

## Commission table (ECL 0x4AA6–0x4ABF)

26 byte-sized entries, one per commission or reward. Value conventions:

| Value | Meaning |
|---|---|
| 254 | finished, reward due (set by the script of the area where it was done) |
| 255 | rewarded and closed; never offered again |
| other | not done; some entries use intermediate values (e.g. 0x4AA9 = 128: the Bivant rescue was bungled) |

| Entry | Variable | Commission or reward |
|---|---|---|
| 0 | 0x4AA6 | Norris the Gray eliminated (bonus) |
| 1 | 0x4AA7 | Sokal Keep on Thorn Island cleared |
| 2 | 0x4AA8 | area next to the evil temple cleared |
| 3 | 0x4AA9 | heir of House Bivant rescued |
| 4–9 | 0x4AAA–0x4AAF | documents handed in (discourses, descriptions, maps, histories, records, "of small value") |
| 10 | 0x4AB0 | Podal Plaza auction: find out what the weapon is |
| 11 | 0x4AB1 | Valhingen Graveyard menace ended |
| 12 | 0x4AB2 | thieves in Kovel Mansion |
| 13 | 0x4AB3 | Stojanow River pollution ended |
| 14 | 0x4AB4 | Cadorna's diplomatic mission done swiftly |
| 15 | 0x4AB5 | lizardmen stopped |
| 16 | 0x4AB6 | kobold tribe stopped |
| 17 | 0x4AB7 | nomads stopped |
| 18 | 0x4AB8 | Cadorna's payment for the textile house treasure |
| 19 | 0x4AB9 | the gate taken |
| 20 | 0x4ABA | Tyranthraxus defeated: the quest is over |
| 21 | 0x4ABB | slums west of City Hall cleared: a **counter**. The slums script (`ECL2` #20, 0xB69C) adds 1 after each won fight, set-piece or random, and sets 254 when it reaches 25 |
| 22 | 0x4ABC | unused (empty handler) |
| 23 | 0x4ABD | Temple of Bane: keep what you found |
| 24 | 0x4ABE | Cadorna declared a traitor |
| 25 | 0x4ABF | the traitor Cadorna dead |

Summons use their own variables, with 254 = summoned (go and see them) and 255 = briefing given: 0x4A97 Cadorna's textile-house treasure, 0x4A98 Cadorna's message to Zhentil Keep, 0x4A99 Lord Urslingen, 0x4A9A the council meeting, 0x4A9B Bishop Braccio. 0x4AC2 = 255 closes the library (documents) offer.

## The clerk's visit (`ECL3` #8, 0x9BB8)

1. **Graveyard bounty.** For each of 7 undead types, kills so far (ECL 0x4A39 + i) are compared with kills already paid for (0x4A8F + i); the difference is paid and the paid count is updated.
2. **Rewards.** Every table entry at 254 is paid in order: the clerk's line for it, treasure from the reward tables at code 0xB5ED, 0xB604, 0xB61B, 0xB632 (and item 51 for Bivant's trinkets), then the entry is set to 255. Entries 0, 1, 10, 11, 12, 13, 15, 16, 17 and 21 also add 1 to the **city progress** counter 0x4AC1.
3. **Clearing bounties.** The library, Podal Plaza and Cadorna textile house each pay once for being cleared (0x4A31 bits 5–6, 0x4AE7 = 254, 0x4AE6 = 254).
4. **Graveyard commission.** Offered with an enchanted weapon once 0x4AC1 ≥ 4, entry 11 is open, party strength ≥ 19 and the weapon has not been given (0x4A96 ≠ 255).
5. **Offers.** Lists every commission still open, in a fixed order; several need Sokal Keep (entry 1 = 255) first. A second visit only repeats the offers (0x4A06).
6. If the quest is over (entry 20 = 255) the end sequence runs instead.

## Proclamations (`ECL3` #0, 0xAC25)

Outside City Hall the walls tell the player which numbered proclamations to read in the printed Adventurer's Journal; the texts themselves are only in the journal. The numbers depend on the city progress counter 0x4AC1:

| 0x4AC1 | Proclamations |
|---|---|
| 0 | LXIV, LXXVIII, CIX and LIX |
| 1 | CI |
| 2 | CXXVI and CX |
| 3 | CXXXIV |
| 4 | CLIV |
| 5 | CXIV |
| 6 | CCIV |
| 7 | CXXIX |
| 8 | CCI |
| 9 | CXIV |
