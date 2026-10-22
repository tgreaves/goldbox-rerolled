# Port data

> **Status: complete** for the data sets of the game profile (work-plan steps 2 and 6,
> [AUDIT.md](../AUDIT.md) §8; checked against the code after C24, 2026-10-21: every text and pattern of
> the spell notes, rules reference, landmark patterns, debug jumps, commissions and tooltips is here).
> Normative (D5): data the port needs that the game files do not hold. Part D of the
> [specification](../README.md).

Each data set below is written for the port (kind **P**, [B-model/profile.md §1.1](../B-model/profile.md#11-where-a-value-comes-from)):
its schema, and its values or the rule that derives them. Values here are normative: a conforming
build holds the same values (it MAY word its own interface text differently only where part C says
so). Data that **is** in the game files is not here: it is read from them (D1, D5).

## 1. Spell notes

`spellNotes`: spell id → one line that summarises the spell's effect as the port runs it, shown in
the spell lists and the Rules reference. PoR's notes; CotAB uses PoR's for ids 1–56 and has none yet
for its own spells (a missing note shows nothing).

| Id | Note |
|---|---|
| 1 | Allies not yet in melee: +1 to hit and better morale. |
| 2 | Enemies: −1 to hit and worse morale. |
| 3 | Heals 1d8 hit points. |
| 4 | Touch: 1d8 damage. |
| 5 | Magic items show a * in item lists. |
| 6 | Better AC and saving throws against evil creatures. |
| 7 | Better AC and saving throws against good creatures. |
| 8 | Halves cold damage; better saves against cold. |
| 9 | Fire damage equal to the caster's level. |
| 10 | A humanoid fights on your side. |
| 11 | Magic items show a * in item lists. |
| 12 | Strength 18 (exceptional strength by level). |
| 13 | Ends an Enlarge. |
| 14 | Charisma +2d4 while it lasts. |
| 15 | Unerring magic damage: (level ÷ 2)d4 + level ÷ 2. Blocked by Shield. |
| 16 | Better AC and saving throws against evil creatures. |
| 17 | Better AC and saving throws against good creatures. |
| 18 | Lets a magic-user read scrolls to scribe them. |
| 19 | AC no worse than 3, +1 on saves, and no damage from Magic Missile. |
| 20 | Touch: 1d8 + level electrical damage. |
| 21 | Puts 4d4 hit dice of low-level creatures to sleep, weakest first. Undead and elves resist. |
| 22 | Finds traps. |
| 23 | Holds up to 4 humanoids still: they are helpless. |
| 24 | Halves fire damage; +3 on saves against fire. |
| 25 | Creatures in the area cannot cast spells. |
| 26 | Keeps a poisoned character alive while it lasts. |
| 27 | Charms snakes with as many hit points as the caster has. |
| 28 | A magic hammer to fight with, while it lasts. |
| 29 | Shows invisible creatures. |
| 30 | Cannot be targeted; −4 to be hit while it lasts. Ends on attacking. |
| 31 | Opens locked doors (doors offer Knock themselves). |
| 32 | 1d4 images take hits meant for the caster. |
| 33 | Target does a quarter less damage. |
| 34 | A cloud on 4 squares: creatures in it are helpless or choking (save vs poison). |
| 35 | Strength +1d4 to +1d8 by class. |
| 36 | Raises dead bodies as zombies on your side. |
| 37 | Cures blindness. |
| 38 | Touch: blind (−4 to hit, AC and saves). |
| 39 | Cures disease. |
| 40 | Touch: disease. |
| 41 | Removes magic effects on the target; better chances against lower-level magic. |
| 42 | Allies +1 to hit and saves, enemies −1. |
| 43 | Lifts a curse, or frees a cursed item. |
| 44 | Touch: −4 to hit and saves. |
| 45 | Hard to hit until the caster has acted each round. |
| 46 | Removes magic effects on the target; better chances against lower-level magic. |
| 47 | Level d6 fire damage to everything in the area; save for half. |
| 48 | Twice the attacks and movement for up to level allies. Ages them a year. |
| 49 | Holds up to 4 humanoids still: they are helpless. |
| 50 | Everyone near the caster becomes invisible. |
| 51 | Level d6 electrical damage along a line that bounces off walls; save for half. |
| 52 | Better AC and saving throws against evil creatures, for those near the caster. |
| 53 | Better AC and saving throws against good creatures, for those near the caster. |
| 54 | No harm from non-magical missiles. |
| 55 | Half the attacks and movement for up to level enemies. |
| 56 | Gives back a level lost to energy drain. |
| 57 | Haste, or ends Slow. |
| 58 | Cures poison or disease, else heals 1d4 + 8. |
| 59 | Strength 21. |
| 60 | 20 + 1d6 electrical damage along a line; save for half. |
| 61 | Holds a target still (save vs paralysis). |
| 62 | Heals 2d4 + 2 hit points. |
| 63 | Everyone near becomes invisible. |
| 64 | A fireball: several d6 of fire damage; save for half. |
| 65 | Magic Missile: 2d4 + 2 magic damage. |
| 67 | Constitution and hit points improve over a day of reading. |

## 2. Rules reference

`rulesText`: `{ basics, classes, combat, keys }`, each a list of (entry, text) in order: what the
printed rule book told players, in short, for the game as the port runs it. Shown by the Rules
reference panel ([C-port/screens.md](../C-port/screens.md)) with the spell notes.

### 2.1 Pool of Radiance

**basics**

| Entry | Text |
|---|---|
| Abilities | STR, INT, WIS, DEX, CON and CHA run from 3 to 18 (higher with magic). Each class needs certain ones; high scores give bonuses (see the tooltips on the character sheet). |
| Hit points | At 0 a character is unconscious; below 0 dying, losing one more each round until dead at −10. Bandage a dying character in combat, or heal them. |
| Armour class (AC) | Lower is better: 10 unarmoured, 5 chain mail, 3 plate, lower with shields, magic and dexterity. |
| THAC0 | The d20 roll needed to hit AC 0. To hit AC 4 with THAC0 15 you need 11 or more. It improves with level. |
| Saving throws | A d20 roll against death, petrification, wands, breath or spells; a success halves or avoids the harm. |
| Experience and levels | Experience comes from defeated monsters, treasure and commissions. With enough, train at a training hall (it costs money) to gain a level. |
| Load and movement | Everything carried is weighed in coins, each coin counting 1. Heavy loads lower movement; too much and nothing more can be picked up. |
| Resting and spells | Spells are memorised in camp and need rest to learn: the more spells, the longer. Resting also heals 1 hit point a day per character. Monsters may interrupt. |
| Time | Moving, searching and resting pass time; effects such as spells run out with it. |
| Commissions and the journal | The City Council in New Phlan hands out commissions: clear a block, find something, deliver something. Journal entries, proclamations and tavern tales the game mentions are in ☰ → Journal. |

**classes**

| Entry | Text |
|---|---|
| Fighter | The best at fighting: best THAC0, most hit points, any weapon and armour, exceptional strength, more attacks from level 7. |
| Cleric | Heals and protects: cleric spells (all known; chosen at camp), turns undead, blunt weapons only, any armour. Wisdom 13+ gives extra spells. |
| Magic-User | Powerful spells learned from scrolls (Read Magic, then Scribe at camp), few hit points, no armour, daggers, darts and staves. |
| Thief | Opens locks, finds and removes traps, climbs, hides; backstabs from behind for extra damage; leather armour. |
| Multi-class | Demi-humans can be two or three classes at once: experience is split between them, and they use the best of each (a fighter/magic-user wears armour and still casts). |
| Races | Humans: any class, no level limits. Dwarves, elves, gnomes, half-elves and halflings: infravision, resistances, level limits in some classes; elves resist Sleep and Charm. |
| Alignment | Law and chaos, good and evil: some items (alignment-locked swords) refuse the wrong alignment. |

**combat**

| Entry | Text |
|---|---|
| Turns | Everyone acts in order of initiative, rolled each round. On a character's turn the commands appear; while they have movement left, step with the arrow keys or a tap on a neighbouring square. |
| Moving | A straight step costs 2, a diagonal 3, from the movement shown. Leaving an enemy's side lets it strike first. Walking into an enemy attacks it; off the edge of the field you are asked whether to flee. |
| Aim | Attack a target in range with the readied weapon; the list shows the chance to hit and the damage dice. From behind is easier; thieves backstab. Missiles need ammunition and cannot be fired with an enemy adjacent (thrown weapons can). |
| Cast | Spells with a casting time start now and go off later in the round ("Begins Casting"); damage before then loses the spell. |
| Guard, Delay, End turn | Guard: strike the first enemy that comes adjacent. Delay: act after everyone faster. End turn: do nothing more. |
| Quick and Magic | Quick lets the computer play a character until you press Space or Take control (or Play by hand on the sheet). Magic On lets characters on Quick cast spells. |
| Dying | A character at −1 to −9 hit points is dying and dies at −10; Bandage (any party member, any distance) or healing stops it. |
| After the battle | Experience is shared among those still standing; treasure and the monsters' money can be taken, shared or pooled. |

**keys**

| Entry | Text |
|---|---|
| Exploring | Arrow keys or 8/4/6/2: move and turn · A area map · C or V the current character's sheet (cast spells there) · E encamp · S search · L look · Esc ☰ menu |
| Menus | The highlighted letter, or 1–9, picks a choice; Enter or Space continues a "press Enter" prompt |
| Combat | Arrows or the numeric keypad: step · Esc: undo steps · Space: take back characters on Quick · Alt-M: Magic On/Off |
| Panels | Esc or ✕ closes |


### 2.2 Curse of the Azure Bonds

PoR's lists with these changes:

- **basics**: PoR's without "Commissions and the journal", then a last entry **Level limits**:
  "Cleric 10, fighter 12, paladin 11, ranger 11, magic-user 11, thief 12; demi-humans lower in some classes."
- **classes**: PoR's, with **Multi-class** and **Races** replaced, then **Paladin**, **Ranger**, **Dual-class**:

| Entry | Text |
|---|---|
| Multi-class | Demi-humans can be two or three classes at once (half-elves also cleric/ranger): experience is split between them, and they use the best of each. |
| Races | Humans: any class, no level limits. Dwarves, elves, gnomes, half-elves and halflings: infravision, resistances, level limits in some classes (elves and half-elves as magic-users too). Half-elves may be rangers. |
| Paladin | A holy fighter: STR 12, INT 9, WIS 13, CON 9 and CHA 17 at least, lawful good only. Fights as a fighter (3 attacks per 2 rounds from level 7) and is protected from evil. Lays on hands once a day (2 hit points a level) and cures disease once a week, more often from levels 6 and 11 (both on the character sheet). Cleric spells from level 9, cast at level − 8. Will not join a party with an evil member, nor take one in. |
| Ranger | A woodland fighter: STR 13, INT 13, WIS 14, CON 14 at least, good alignment. Fights as a fighter (3 attacks per 2 rounds from level 8) and adds the ranger level to damage against giant-class creatures. Druid spells from level 8 (cast at level − 7), magic-user spells from level 9 (level − 8). Three rangers at most in a party. |
| Dual-class | A human may change class: the old class's abilities come back once the new class's level passes the old one. |

- **combat**, **keys**: PoR's.

### 2.3 Secret of the Silver Blades

`SOTSB_RULES_TEXT`. The numbers are SotSB's own, and `test/rulestext.test.ts` checks them against the
profile and the game's tables:
- the level limits against the experience table;
- the paladin's and ranger's minimums against `classMins`;
- the extra attacks, the starting money and the cast limits against `R`;
- the difficulty names against the Level menu (0xE272);
- the bundle limit against `R.itemJoin`.

- **basics**: PoR's without "Commissions and the journal", with two entries replaced, then five more:

| Entry | Text |
|---|---|
| Experience and levels | Experience comes from defeated monsters and treasure. With enough, train at a training hall (it costs money) to gain a level. |
| Resting and spells | PoR's, then: Clerics reach sixth-level spells (WIS 17 for sixth-level slots), magic-users seventh-level (INT 12 for sixth, 14 for seventh). |
| Level limits | Cleric 15, fighter 15, paladin 15, ranger 15, magic-user 15, thief 18; demi-humans lower in some classes. |
| Difficulty | Camp → Alter → Level: Novice, Squire, Veteran (a new game's), Adept or Champion. Monsters have half their hit points at Novice, the usual at Veteran and half again at Champion. |
| The temple | The temples heal, cure and raise without asking a price. Elves cannot be raised from the dead. |
| The vault | The vault keeps money and items for the party between visits: an item dropped there is deposited (Deposit), and View and Take bring things back. |
| Scroll bundles | Join on a scroll ties scrolls into a bundle of up to 10; Halve splits a bundle in two. A bundle of n scrolls weighs n × n. |

- **classes**: CotAB's, with five entries replaced, then two more:

| Entry | Text |
|---|---|
| Races | Humans: any class, no racial level limits. Dwarves, elves, gnomes, half-elves and halflings: infravision, resistances, level limits in some classes (elves and half-elves as magic-users too); elves cannot be raised from the dead. Half-elves may be rangers. |
| Cleric | Heals and protects: cleric spells (all known; chosen at camp), blunt weapons only, any armour. Wisdom 13+ gives extra spells. Clerics do not turn undead in this game. |
| Fighter | The best at fighting: best THAC0, most hit points, any weapon and armour, exceptional strength, 3 attacks per 2 rounds from level 7 and 2 a round from level 13. |
| Paladin | CotAB's, with "(3 attacks per 2 rounds from level 7, 2 from 13)" and "Cleric spells from level 9, cast at the full paladin level." |
| Ranger | CotAB's, with "(3 attacks per 2 rounds from level 8, 2 from 15)". |
| Money | A new character starts with nothing but a thief's 2d6 gold pieces. |
| Importing | Characters from Curse of the Azure Bonds can be imported from the party screen; their items stay behind, and they start with no money and no spells memorised. |

- **combat**, **keys**: PoR's.

## 3. Landmark patterns

`landmarks` (`LandmarkRules`): what the area map's landmarks look for in a square's script text
(upper-case, as the scripts print it). The walk that collects each square's text, and the order in
which squares are classified (shop, temple, training, inn, places), are part C
([C-port/exploration-view.md](../C-port/exploration-view.md)); the script structure they hang on (the
shop and temple flags ECL 0x6E6C and 0x6DE2, PROGRAM 0 training and 9 rest) is the engine's.

| Field | Meaning |
|---|---|
| `first` | places named in a square's text, checked before anything else: `{ re, kind, label }` |
| `shops` | a shop told apart by its shopkeeper's line (none matching: a plain "Shop") |
| `god` | the temple's god, from its priests' line: the first capture group |
| `places` | places named in their text, checked after shops, temples, training and inns |

PoR:

| Field | Pattern | Kind | Label |
|---|---|---|---|
| first | `\bTAVERN\b` | tavern | Tavern |
| shops | `JEWELRY` | jeweller | Jeweller |
| shops | `ARMS AND ARMOR` | armoury | Arms and armour |
| shops | `SILVER` | silver | Silversmith |
| shops | `OFFERS YOU ITEMS FOR SALE` | store | General store |
| god | `(?:PRIESTS\|PRIESTESS \w+) OF (\w+)` | | |
| places | `CITY HALL` | hall | City Hall |
| places | `HARBOR MASTER` | harbour | Harbour master |
| places | `BOARD A BOAT` | harbour | Boats |
| places | `GATEWAY` | gate | Gateway |

CotAB: PoR's, except `first` is `\bTAVERN\b|\bBARTENDER\b` → tavern, Tavern; and `shops` starts with
`CORMYR STEEL` → armoury, Arms and armour (Tilverton's arms dealers sell "the finest Cormyr steel"),
then PoR's four.

The patterns quote a few words of game text as match keys; they are not copies of messages.

## 4. The journal

`journal` (`JournalData` or null): the printed Adventurer's Journal the scripts refer to by number.
A game without one has null and no Journal entry in the menu.

### 4.1 Schema

| Field | Type | Meaning |
|---|---|---|
| `source` | record of strings | the transcription's name, a note, the source pages by section, the licence (`license`, absent when the text is not under one) |
| `preface` | string | the journal's opening text (shown first) |
| `journal` | `{ n, title?, text, images[] }[]` | numbered entries; `title` the entry's printed heading where the source keeps it; `images` are file names of scans shown with the entry |
| `proclamations` | `{ id, text }[]` | proclamations by roman-numeral id |
| `tales` | `{ n, text }[]` | numbered tavern tales |
| `background` | `{ title, text }[]` (optional) | sections read from the start, not revealed by scripts |
| `empty` | `{ journal?, proclamations?, tales? }` | what each tab says while nothing in it has been found |

### 4.2 Content and sources

The journal text is a transcription of the printed journal, credited in the project README: PoR's and
CotAB's are third-party transcriptions used under CC BY-SA 3.0; SotSB's was transcribed for the port
from a scan of the printed journal, by Tristan's decision (CLAUDE.md rule 4: the journal is of use
only with the game, which the player supplies). It is the one exception to "no game data in the
repository" and is not part of this specification's text:

| Game | Source | Content |
|---|---|---|
| PoR | Pool of Radiance Wiki (Fandom): Journal Entries, Proclamations, Tavern Tales pages; the journal text only, the wiki's commentary left out | 58 entries, 18 proclamations, 23 tales; 14 map and picture scans (`JE4_Map`, `JE10_Map`, `JE15`, `JE22_Map`, `JE26`, `JE28`, `JE29`, `JE35`, `JE37_1`–`JE37_3`, `JE41`, `JE42`, `JE58`) |
| CotAB | Gold Box Wiki (Fandom), "Curse of the Azure Bonds/Journal": the journal text only (the rules appendices left out), lines joined into paragraphs and a few lost apostrophes restored | 59 entries (eight are only a picture in the printed journal and say so), 62 tales, 4 background sections, no proclamations |
| SotSB | the printed Adventurer's Journal (SSI, 1990), transcribed from a scan (archive.org); the entries, the opening story and the bestiary (the rules sections, glossary and appendices left out); the printed spelling kept, only scanning errors corrected | 72 entries with their printed headings (the four rumours, 6, 8, 20, 30, have none; twelve, 1, 32, 35, 36, 38, 41, 45, 49, 52, 66, 68, 72, are only a map and say so), 2 background sections ("How the Heroes Arrive", "Creatures of the Forgotten Realms"), no tales or proclamations |

A builder takes the same text from the same sources (or from the player's printed journal) into this
schema.

### 4.3 Empty-tab texts

| Game | Tab | Text |
|---|---|---|
| PoR | journal | Nothing yet. Papers, books and maps found on your travels are copied in here. |
| PoR | proclamations | Nothing yet. The proclamations are posted on the walls of City Hall. |
| PoR | tales | Nothing yet. Listen in the taverns of New Phlan. |
| CotAB | journal | Nothing yet. What you learn on your travels is copied in here. |
| CotAB | tales | Nothing yet. Listen in the taverns. |
| SotSB | journal | Nothing yet. What you learn on your travels is copied in here. |

### 4.4 What reveals an entry

Every screen of game text the scripts print (the whole screen, so a number printed separately is
caught) is scanned, upper-cased, for:

- `ENTR(?:Y|IES)\s*(\d+(?:(?:[\s,]|AND)+\d+)*)`: each number that is an entry → id `journal:<n>`
  ("AS ENTRY 30", "UNDER ENTRIES 23 AND 14", "(ENTRY 33)"; SotSB prints "AND YOU RECORD IT AS JOURNAL
  ENTRY " from a subroutine, then the number, literal or from a table: ECL1 record 16's 0x9B58 holds
  the rumours 6, 8, 20, 30, its 0x9B5C the old man's tales 12, 17, 51, 54, O);
- `TAVERN TALE\s*#?\s*(\d+)` → `tale:<n>` ("YOU OVERHEAR TAVERN TALE 7", CotAB "TAVERN TALE #12");
- `PROCLAMATIONS?\s*([IVXLCDM]+(?:(?:[\s,]|AND)+[IVXLCDM]+)*)`: each numeral that is a proclamation →
  `proc:<id>` ("PROCLAMATION CI.", "PROCLAMATIONS LXIV, LXXVIII, CIX, AND LIX.").

Only ids the game's journal has count; each is revealed once. The message log notes "Journal entry
*n* is in your Journal.", "Proclamation *id* is in your Journal." or, for a tale, "Tavern tale *n*:
" and the tale's text. Proclamations are ordered by their numeral's value. Nothing is revealed while
the demo runs. The revealed ids are kept with the save in the `.GBR` sidecar
([C-port/storage.md](../C-port/storage.md)).

## 5. The commissions panel

Shown when the profile's `commissions` is true (PoR), read from the script variables of
[A-games/por/commissions.md](../A-games/por/commissions.md). The commission table is ECL 0x4AA6 + *i*
(254 finished and reward due, 255 closed).

### 5.1 Commissions

Each: a title; **offers**, the start of the clerk's (or another script's) offer text, which marks it
known when a printed text (a leading quote dropped) starts with one; the table **entries** whose
rewards belong to it; an optional **summons** variable (254: go and see someone, 255 briefed) with
who to see; optional **started** and **progress** rules.

| Id | Title | Offers | Entries | Summons / started / progress |
|---|---|---|---|---|
| slums | Clear the slums west of City Hall | THE SLUMS IMMEDIATELY TO OUR WEST | 21 | progress: entry 21 below 25 → "*n* of 25 fights won in the slums" |
| sokal | Clear Sokal Keep on Thorn Island | SOKAL KEEP ON THORN ISLAND | 1 | |
| documents | Bring in books, maps and records of old Phlan | THE COUNCIL IS OFFERING A REWARD FOR BOOKS | 4–9 | progress: entries 4–9 at 254 or more name the documents handed in ("Handed in: " discourses, descriptions, maps, histories, records, papers of small value); closed when ECL 0x4AC2 = 255 |
| podal | Find out what weapon is being auctioned in Podal Plaza | A WEAPON OF GREAT POWER IS TO BE AUCTIONED | 10 | started: ECL 0x4AB0 = 1 |
| textile | Cadorna's family treasure in the textile house | JUNIOR COUNCILMAN CADORNA HAS A SPECIAL COMMISSION | 18 | summons 0x4A97: Junior Councilman Cadorna (east door of the clerk) |
| braccio | Report to Bishop Braccio at the Temple of Tyr | YOU ARE SUMMONED BY THE BISHOP | 23 | summons 0x4A9B: Bishop Braccio at Tyr's temple |
| kovel | Clean out the thieves in Kovel Mansion | A LARGE GROUP OF THIEVES OPERATES | 12 | started: ECL 0x4A45 > 0; progress: 0 < 0x4A45 < 21 → "*n* of 21 thieves beaten" |
| nomads | Stop the nomads joining the enemy | FIND THE NOMADS | 17 | |
| kobolds | Stop the kobold tribe joining the enemy | A LARGE TRIBE OF KOBOLDS | 16 | |
| river | End the river's pollution | FIND THE SOURCE OF THE RIVER'S POLLUTION | 13 | |
| lizardmen | Stop the lizardmen joining the enemy | A TRIBE OF LIZARDMEN | 15 | |
| bivant | Rescue the heir of House Bivant | THE HEIR TO THE HOUSE OF BIVANT | 3 | started: ECL 0x4A8C = 255; failed when entry 3 = 128 ("The rescue was bungled") |
| graveyard | End the Valhingen Graveyard menace | I HAVE BEEN AUTHORIZED TO GIVE YOU AN ENCHANTED WEAPON | 11 | started: ECL 0x4A96 = 255; progress: the sum of ECL 0x4A39 … 0x4A3F (the 7 undead counters) → "*n* undead destroyed so far" |
| zhentil | Deliver Cadorna's message to Zhentil Keep | LORD CADORNA HAS A DELICATE DIPLOMATIC MISSION; WE NEED YOU TO DELIVER A MESSAGE TO THE ZHENTIL KEEP | 14 | summons 0x4A98: Lord Cadorna (south door of the clerk) |
| gate | Take the gate and hold it | LORD URSLINGEN WISHES URGENTLY | 19 | summons 0x4A99: Lord Urslingen (south door of Cadorna's old quarters) |
| assault | Lead the attack on the enemy stronghold | YOU ARE SUMMONED TO A SPECIAL COUNCIL MEETING | 20 | summons 0x4A9A: the council (the city guards show the way) |

The offer lines are a few words of game text used as match keys (D1 allows them as identification).

### 5.2 The report

A commission is listed when it is known (offered in this session or in a save's sidecar), any of its
entries is non-zero, its summons is non-zero, or its started rule holds. Its state, in this order:
**reward** (an entry is 254: "Reward waiting: see the City Clerk"); **failed** (bivant only); **summoned**
(summons 254: "Go and see *who*"); **closed** (every entry 255, documents: 0x4AC2 = 255); else **open**
with its progress. Then the deeds that are not offered as commissions, listed once earned (254
reward, 255 closed): entry 0 "Norris the Gray eliminated", 2 "The area next to the evil temple
cleared", 24 "Cadorna exposed as a traitor", 25 "The traitor Cadorna dead". Then the clearing bounties
the clerk pays once (rewards): "The library cleared" when (ECL 0x4A31 & 96) = 96 and 0x4AC2 ≠ 255;
"Podal Plaza cleared" when 0x4AE7 = 254; "The Cadorna textile house cleared" when 0x4AE6 = 254. Lines
are sorted reward, summoned, open, failed, closed.

The **graveyard bounty** is Σ over the 7 undead types of max(0, kills ECL 0x4A39 + *i* − paid 0x4A8F + *i*).
The **proclamations** line (once the proclamation wall, a text starting "PROCLAMATIONS ARE POSTED ON
THE WALLS", has been seen) names the proclamations of the current council notice, ECL 0x4AC1 =
0 … 9: "LXIV, LXXVIII, CIX and LIX", "CI", "CXXVI and CX", "CXXXIV", "CLIV", "CXIV", "CCIV", "CXXIX",
"CCI", "CXIV"; 10 or more: none.

## 6. Debug jumps and finale

`debug` (`DebugTools`): the port's Debug panel (IMP-025, not part of the game).

| Field | Meaning |
|---|---|
| `jumps` | `{ label, to: [block, area, x, y, facing] }`; tile-wilderness positions as the game's own scripts write them |
| `finale` | the end of the game as its script runs it: `{ foe, at: [block, area, x, y, facing], fight, ending, note }`: jump to `at`, then run the script at `fight` (the final battle) or `ending` (what follows a win), and re-enter the area; null: not worked out |

PoR jumps: "Wilderness: west boat landing (20,29)" [7, 26, 7, 29, 0]; "Wilderness: north side of the
bay (26,27)" [7, 26, 13, 27, 0]; "Wilderness: east boat landing (35,29)" [8, 27, 9, 29, 0]; "New Phlan:
end of the pier (15,1)" [3, 0, 15, 1, 3] (the wilderness positions as the harbour script ECL3 #0
writes them). PoR finale: foe Tyranthraxus, at [5, 7, 1, 4, 1] (ECL5 #7, Valjevo Castle's inner
tower), fight 0xA7DC (sets up and starts the battle with monster 66), ending 0xA80E (the victory
flags, PROGRAM 8, the walk back to New Phlan), note "the end of the game as its script runs it (ECL5
#7): after the final battle is won, or that battle (the guards and the NPCs' vote are skipped)".

CotAB jumps: "Tilverton: the Windlord's Inn (6,12)" [2, 1, 6, 12, 0]. CotAB finale: foe Tyranthraxus, at
[6, 67, 5, 2, 0] (ECL6 #67, the temple of Bane's throne room, off the battle's square (6,1) and column 6,
where on_enter plays the voice scene), fight 0xAB80 (native 0x9280: Tyranthraxus, the margoyle and the
high priest, fought again while ECL 0x7EC7 > 128), ending 0xACE7 (native 0x93E7: PROGRAM 8), note "the
end of the game as its script runs it (ECL6 #67): after the final battle is won, or that battle (the
bonds scene before it is skipped)"; addresses canonical (native + 0x1900).

## 7. View choices

The port's own values in the view dressing ([B-model/profile.md §3.1](../B-model/profile.md#31-the-view-viewart)):
CotAB's ground picture uses its rows 32–48 (the least foreshortened, nearest the viewer) repeated
twice along a square on the WebGL floor (IMP-069); the window-border rule (the most common tile of
each side of the screen frame). The original's placement is part A
([coab/assets.md §3](../A-games/coab/assets.md#3-3d-view)).

## 8. Interface labels

Labels the screens use that are not game text (part C defines where they appear):

| Labels | Values |
|---|---|
| readied slots 0–8 | Weapon, Shield, Armour, Gauntlets, Helm, Belt/Necklace, Robe, Cloak, Boots; 9 Ring; 11–13 Scroll; others Other |
| facings | North, East, South, West |
| caster classes | Cleric (CL), Druid (DR), Magic-User (MU), for the spell classes the game has |
| base classes on cards and sheets | Cleric, Druid, Fighter, Paladin, Ranger, Magic-User, Thief, Monk |
| continue prompts recognised | "PRESS <RETURN> OR BUTTON TO CONTINUE", "PRESS <ENTER>/<RETURN> TO CONTINUE" (game text the port matches to show a Continue button) |

*Known gap:* the base-class names duplicate START.EXE's class-name table, which the port should read
instead (`T.classNames`; [AUDIT.md](../AUDIT.md) §4).

## 9. Interface tooltips

`TIPS` (IMP-058): what the 1988 numbers mean, shown as tooltips on the character sheet's labels and
the cards' AC ([C-port/screens.md §3.1](../C-port/screens.md#31-layout), [C-port/ui-contract.md §4.1](../C-port/ui-contract.md#41-party-cards)).
Port-authored, the same in every game.

| Label | Text |
|---|---|
| STR | Strength: to-hit and damage bonuses at 17 and above, and how much can be carried. Fighters can have 18/01 to 18/00. |
| INT | Intelligence: magic-users need it. |
| WIS | Wisdom: clerics with 13 or more get extra spells. |
| DEX | Dexterity: better AC and missile to-hit at 15 and above. |
| CON | Constitution: extra hit points per level at 15 and above. |
| CHA | Charisma: how people react to the party. |
| HP | Hit points: at 0 a character is down; below that, dying, and dead at −10. |
| AC | Armour class: lower is better. 10 is unarmoured, 0 is excellent, below 0 takes magic. |
| THAC0 | To Hit Armour Class 0: the d20 roll needed to hit AC 0. To hit AC n you need THAC0 − n or more. Lower is better. |
| Damage | Damage dice with the readied weapon (or fists) against man-sized foes. |
| Movement | Squares per combat round. Heavy loads cut it. |
| Experience | Experience points: train at a training hall when there are enough for the next level. |
| Load | Everything carried, weighed in coins (each coin counts 1). Heavier loads lower movement. |

*Known gap:* the texts describe Pool of Radiance's rules (WIS bonus spells from 13, the CON bonus from
15); a game whose tables differ should have its own set in its profile.

## 10. Landmark icons

The area map's icon per landmark kind (IMP-024): shop 🏪, store 🛒, jeweller 💎, armoury 🛡,
silver 🥈, temple ⛪, inn 🛏, tavern 🍺, hall 🏛, training ⚔, harbour ⚓, gate 🚪. The classification
that gives the kinds is [C-port/exploration-view.md §6.2](../C-port/exploration-view.md#62-landmarks).
