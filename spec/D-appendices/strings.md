# Game strings

> **Status: written** (work-plan steps 4 and 6, [AUDIT.md](../AUDIT.md) §8; C24 done 2026-10-21).
> §2 the game texts the screens show, §3 the port's own texts, §4 the engine's messages by id, §5 the
> texts the profile data address, §6 what is still worded by the port. The addresses are normative;
> the strings themselves stay in the game files. Part D of the [specification](../README.md).

Per D1, game text is read from the player's files, never copied into the code or the spec: this
appendix lists each message with its address in each game's files. Quotations here identify a message;
they do not define it.

## 1. How to read a string

- A game string is a Turbo Pascal string: a length byte, then that many bytes of text (ASCII; the
  game prints capitals through its font, [rendering.md §5](../C-port/rendering.md#5-the-game-font)).
- **Addresses** are offsets of the **length byte** in the game's merged image: `START.EXE` unpacked and
  `GAME.OVR`'s overlays merged, the MZ header dropped (PoR: [addresses.md, "Notations"](addresses.md#notations),
  `image 0x…`; CotAB: the working image, [coab/README.md, "Working image"](../A-games/coab/README.md#working-image)).
  A reader that does not merge the overlays maps an image offset back to `START.EXE` or `GAME.OVR` by the
  overlay stubs ([containers.md](../A-games/engine/containers.md)).
- **The merged image** a reader builds (as `tools/mergeovr.py` does): the unpacked `START.EXE` load
  image; then, from the first 256-paragraph boundary at or past both the end of that image and the end
  of the program's stack (SS:SP of the EXEPACK header), each overlay's code from `GAME.OVR`, in the order
  of their file offsets, each starting on a paragraph and padded to one. An overlay is found by its stub
  in the image: a paragraph beginning `CD 3F 00 00`, then the overlay's file offset (32 bits), its code
  size, its fix-up size and its entry count (16 bits each), every entry at +0x20 + 5·*i* beginning
  `CD 3F` ([containers.md](../A-games/engine/containers.md)). The fix-ups and stub entries do not matter
  for text.
- **Reading**: the string at address *a* is the *n* = image[*a*] bytes that follow, each 0x20–0x7E; a
  conforming build treats anything else (past the end, a control byte) as "no text there".
- **Without the files**: without `START.EXE` (or an unreadable one) no game text can be read, and
  without `GAME.OVR` none of the overlay strings (every address at or past the overlays' base). A
  conforming build then shows a message as `#` and its address in hex capitals (`#1E8EC`), as a missing
  name shows `#n`, and goes on; a message a game has no address for shows as `#` and its id. The
  credits draw no lines. The parts that need `START.EXE` for their rules (combat, camp, shops, temples,
  creation, sound) refuse already and say which file to import
  ([B-model/files-and-detection.md](../B-model/files-and-detection.md)).
- Read by address in the reference implementation: everything in §2, §4 and §5 except what §6 lists,
  plus the CotAB start-up menu and demo texts (`START.EXE`, profile `startMenu`), the ending captions
  (`GAME.OVR` at the profile's `ending.cs` plus each caption's offset), the temple's service names
  (`T.templeNames`), and the class, race and alignment names where the profile's table map gives them
  ([B-model/records-and-tables.md](../B-model/records-and-tables.md)).
- **Which copy.** Both games keep a copy of a string per routine (each overlay has its own constants),
  so the same words often sit at several addresses. The address given is always the copy referenced by
  the routine that prints the line (a `mov di, offset; push cs|ds; push di` before the print call),
  found by searching the images for each reference (2026-10-21). The routine is given as PoR's Ghidra
  function and CotAB's image offset of the function start.

## 2. Game texts the screens show

Every address is **O**: referenced by the routine in the last column (2026-10-21). "—" means no
string of its own in that game: CotAB words it differently or builds it from parts (§4 gives CotAB's
pieces where the port prints the line). A text that is several strings printed in turn (a name between
them) is listed by its parts. Where the part C file quotes a game text it marks it *game text* and
points here.

| Text (identification only) | PoR image | CotAB image | Where it is used (part C) | Printed by (O) |
|---|---|---|---|---|
| "Camp:" | 0x3166B | 0x321B4 | camp prompt | PoR `FUN_3f81_1e6f`; CotAB 0x321CB |
| "Save View Magic Rest Alter Exit" | 0x0CCC8 | — | camp menu (PoR) | PoR `FUN_3f81_1e6f` |
| "Save View Magic Rest Alter Fix Exit" | — | 0x0B00A | camp menu (CotAB) | CotAB 0x321CB |
| "Cast Memorize Scribe Display Rest Exit" | 0x0CCF1 | 0x0B033 | magic menu | PoR `FUN_3f81_13f1`; CotAB 0x31275 |
| "Order Drop Speed Icon Pics Exit" | 0x0CD1A | 0x0B05C | alter menu | PoR `FUN_3f81_1c59`; CotAB 0x31AD8 |
| "Alter:" | 0x31420 | 0x31A97 | alter prompt | PoR `FUN_3f81_1c59`; CotAB 0x31AD8 |
| "Party Order:" | 0x30F50 | 0x315C4 | order prompt | PoR `FUN_3f81_1780`; CotAB 0x31604 |
| "has been selected" | 0x30F7E | 0x315F2 | order: selected | PoR `FUN_3f81_1780`; CotAB 0x31604 |
| "Drop from party?" | 0x310A2 | 0x31716 | alter drop question | PoR `FUN_3f81_18e5`; CotAB 0x31769 |
| "bids you farewell" | 0x310B4 | 0x31728 | alter drop: yes | PoR `FUN_3f81_18e5`; CotAB 0x31769 |
| "is dumped in a ditch" | 0x310C6 | 0x3173A | alter drop: yes, out of play | PoR `FUN_3f81_18e5`; CotAB 0x31769 |
| "Breathes A sigh of relief" | 0x310DB | 0x3174F | alter drop: no | PoR `FUN_3f81_18e5`; CotAB 0x31769 |
| "Game Speed =" | 0x31240 | 0x318B4 | speed prompt | PoR `FUN_3f81_1a97`; CotAB 0x3191B |
| " (0=fastest 9=slowest)" | 0x3124E | 0x318C2 | speed prompt, end | PoR `FUN_3f81_1a97`; CotAB 0x3191B |
| "Quit TO DOS" | 0x31672 | 0x321BA | camp save: quit question | PoR `FUN_3f81_1e6f`; CotAB 0x321CB |
| "cannot cast spells in this area" | 0x2FB12 | 0x300D6 | spell activity refused | PoR `FUN_3f81_036c`; CotAB 0x30140 |
| "is in no condition to" | 0x2FB32 | 0x300F6 | spell activity refused | PoR `FUN_3f81_036c`; CotAB 0x30140 |
| "has no spells memorized" | 0x2FC99 | 0x3025D | cast: none | PoR `FUN_3f81_04a1`; CotAB 0x30275 |
| "Spells " | 0x3B2D4 (also 0x393B3) | 0x409A4 (also 0x3E05A) | list prefix, with "in Memory", "in Spell Book", "on Scrolls", "to choose from", "to be memorized", "to be scribed" | PoR `FUN_4894_299c`; CotAB 0x409AC |
| "in Memory" | 0x3B279 | 0x40959 | cast list | PoR `FUN_4894_299c`; CotAB 0x409AC |
| "in Spell Book" | 0x3B283 | — | memorize list | PoR `FUN_4894_299c` |
| "on Scrolls" | 0x3B29B | 0x40979 | scribe list | PoR `FUN_4894_299c`; CotAB 0x409AC |
| "to choose from" | 0x3B2A6 | — | training spell choice | PoR `FUN_4894_299c` |
| "to be memorized" | 0x3B2B5 | — | memorize summary | PoR `FUN_4894_299c` |
| "to be scribed" | 0x3B2C5 | — | scribe summary | PoR `FUN_4894_299c` |
| "Memorize These Spells?" | 0x300CF | 0x306AA | memorize confirm | PoR `FUN_3f81_090a`; CotAB 0x306F5 |
| "Scribe These Spells?" | 0x302C9 | 0x308A9 | scribe confirm | PoR `FUN_3f81_0b5b`; CotAB 0x3094B |
| "You already know that spell" | 0x302F7 | 0x308D7 | scribe refusal | PoR `FUN_3f81_0b5b`; CotAB 0x3094B |
| "You are already scibing that spell" | 0x30313 | 0x308F3 | scribe refusal | PoR `FUN_3f81_0b5b`; CotAB 0x3094B |
| "You can not scribe that spell." | 0x30336 | 0x30916 | scribe refusal | PoR `FUN_3f81_0b5b`; CotAB 0x3094B |
| "has no copyable scrolls" | 0x302DF | 0x308BF | scribe: none | PoR `FUN_3f81_0b5b`; CotAB 0x3094B |
| "Funky--" | 0x306D0 | 0x30CB2 | display, unknown | PoR `FUN_3f81_0fbc`; CotAB 0x30DDA |
| " <No Spell Effects>" | 0x307AF | 0x30DC5 | display, none | PoR `FUN_3f81_0fbc`; CotAB 0x30DDA |
| "is a combat-only spell..." | 0x3F0DE | — | cast: combat-only | PoR `FUN_4e53_0c20` |
| "can't be cast here..." | — | 0x451DA | cast: combat-only (CotAB's, on the line under the spell's name) | CotAB 0x45251 (cs:126A at 0x452C2) |
| "Lose it?" | 0x3F0F8 | 0x451F0 | cast: combat-only, question | PoR `FUN_4e53_0c20`; CotAB 0x45251 |
| "Rest Time:" | 0x3BA43 | 0x414A8 | rest prompt | PoR `FUN_4b46_05f0`; CotAB 0x414B5 |
| "As you Leave the Shopkeeper says" | 0x1FBC0 | 0x1F6C9 | shop leave | PoR `FUN_2f70_053e`; CotAB 0x1F747 |
| "As you leave a priest says" | 0x1DDCE | 0x1D40E | temple leave | PoR `FUN_2d14_0d09`; CotAB 0x1D489 |
| "There is still treasure left." | 0x1EEFD | 0x1E753 | treasure leave | PoR `FUN_2e08_0ecd`; CotAB 0x1E7A3 |
| "Take:" | 0x1EDA0 | 0x1E5F6 | treasure take prompt | PoR `FUN_2e08_0d38`; CotAB 0x1E60E |
| "cast cure anyway:" | 0x1D140 | 0x1C6E2 | temple: not needed | PoR `FUN_2d14_0013`; CotAB 0x1C6F5 |
| " will only cost" | 0x1D1B6 | 0x1C758 | temple: price | PoR `FUN_2d14_00bf`; CotAB 0x1C7A1 |
| "pay for cure" | 0x1D1D5 | 0x1C777 | temple: price, end | PoR `FUN_2d14_00bf`; CotAB 0x1C7A1 |
| "is cured." | 0x1D1F5 | 0x1C797 | temple: done | PoR `FUN_2d14_00bf`; CotAB 0x1C7A1 |
| "No Gems or Jewelry" | 0x3DBB0 | 0x435E6 | appraise: none | PoR `FUN_4c2d_19b2`; CotAB 0x436B8 |
| "You have a fine collection of:" | 0x3DBF3 | 0x43629 | appraise | PoR `FUN_4c2d_19b2`; CotAB 0x436B8 |
| "The Gem is Valued at" | 0x3DC35 | 0x4366B | appraise: gem | PoR `FUN_4c2d_19b2`; CotAB 0x436B8 |
| "The Jewel is Valued at" | 0x3DC6A | 0x436A0 | appraise: jewel | PoR `FUN_4c2d_19b2`; CotAB 0x436B8 |
| "You can :" | 0x3DC5F | 0x43695 | appraise: choice | PoR `FUN_4c2d_19b2`; CotAB 0x436B8 |
| "OverLoaded" | 0x1F92E | 0x1F3A1 | take refused | PoR `FUN_2f70_0239`; CotAB 0x1F3AC |
| "Drop It?" | 0x3982E | 0x3EAA9 | items: drop | PoR `FUN_4894_0ef8`; CotAB 0x3EAB3 |
| "I'll give you" | 0x3A5CB | 0x3FC8F | items: sell offer | PoR `FUN_4894_1cee`; CotAB 0x3FCF2 |
| "Is It a Deal?" | 0x3A5F1, 0x3A830 | 0x3FCB5, 0x3FEF7 | items: deal | PoR `FUN_4894_1cee`; CotAB 0x3FCF2 |
| "Sold!" | 0x3A600 | 0x3FCC4 | items: sold | PoR `FUN_4894_1cee`; CotAB 0x3FCF2 |
| "For 200 gold pieces I'll identify your" | 0x3A808 | 0x3FECF | items: identify | PoR `FUN_4894_1f52`; CotAB 0x3FF59 |
| "Not Enough Money" | 0x3A83F | 0x3FF06 | items: no money | PoR `FUN_4894_1f52`; CotAB 0x3FF59 |
| "I can't tell anything new about your" | 0x3A850 | 0x3FF17 | items: identify, nothing | PoR `FUN_4894_1f52`; CotAB 0x3FF59 |
| "It looks like some sort of" | 0x3A876 | 0x3FF3D | items: identify, result | PoR `FUN_4894_1f52`; CotAB 0x3FF59 |
| "Must be Readied" | 0x39803 | 0x3EA7E | items: use unreadied | PoR `FUN_4894_0ef8`; CotAB 0x3EAB3 |
| "Nothing Happens..." | 0x2BC37 | 0x2B765 | items: use, nothing | PoR `FUN_3aae_116a`; CotAB 0x2B778 |
| "is a combat-only item..." | 0x3F10C | 0x45204 | items: use combat-only | PoR `FUN_4e53_0c20`; CotAB 0x45251 |
| "Trade with Whom?" | 0x3A058 | 0x3F630 | items: trade | PoR `FUN_4894_1734`; CotAB 0x3F64C |
| "is it Okay to lose it?" | 0x39698 | 0x3E3D9 | items: scroll warning | PoR `FUN_4894_0d70`; CotAB 0x3E3F1 |
| "uses an item" | 0x3A3B7 | 0x3F98F | items: use | PoR `FUN_4894_1a8a`; CotAB 0x3F9A8 |
| "Trade to?" | 0x3AA5A | 0x4012A | money: trade | PoR `FUN_4894_2156`; CotAB 0x4016E |
| "Select type of coin" | 0x3AA66, 0x3ADB8, 0x3CF8D | 0x40136, 0x40490, 0x42A64 | money: type | PoR `FUN_4894_2156`; CotAB 0x4016E |
| "How much" | 0x3AA7B, 0x3ADCD, 0x3CFA1 | 0x40153, 0x404AD, 0x42A80 | money: amount | PoR `FUN_4894_2156`; CotAB 0x4016E |
| "Continue Battle:" | 0x2292F | 0x226D2 | combat: continue | PoR `FUN_320c_0880`; CotAB 0x226E3 |
| "Flee:" | 0x22A91 | 0x22841 | combat: flee | PoR `FUN_320c_09df`; CotAB 0x22856 |
| "Move/Attack, Move Left =" | 0x22A74, 0x23B16 | 0x22824, 0x23A75 | combat: step prompt | PoR `FUN_320c_09df`; CotAB 0x22856 |
| "Your Teammate is Dying" | 0x22918 | 0x226BB | combat: dying | PoR `FUN_320c_0880`; CotAB 0x226E3 |
| "Not with that weapon" | 0x22DF0 | 0x22C1E | combat: wrong weapon | PoR `FUN_320c_0d45`; CotAB 0x22C33 |
| "Blocked" | 0x22A97 | — | combat: blocked | PoR `FUN_320c_09df` |
| "is bandaged" | 0x230B3 | 0x503A3 | combat: bandage | PoR `FUN_320c_0fff`; CotAB 0x503AF |
| "Attack Ally:" | 0x2D46A | 0x2D461 | combat: attack ally | PoR `FUN_3aae_2998`; CotAB 0x2D46F |
| "Aim:" | 0x2D57B | 0x2D572 | combat: aim | PoR `FUN_3aae_2aa0`; CotAB 0x2D577 |
| "Target" | 0x2D555, 0x2D8BF | 0x2D54C, 0x2D8CA | combat: target | PoR `FUN_3aae_2aa0`; CotAB 0x2D577 |
| "Begins Casting" | 0x2CEE5 | 0x2CCAE | combat: begins casting | PoR `FUN_3aae_2414`; CotAB 0x2CCBD |
| "Camp Only Spell" | 0x2CED5 | 0x2CC9E | combat: camp-only | PoR `FUN_3aae_2414`; CotAB 0x2CCBD |
| "Abort Spell?" | 0x3F134 | 0x45235 | combat: abort | PoR `FUN_4e53_0c20`; CotAB 0x45251 |
| "Guarding" | 0x0321D | 0x4F87A | combat: guarding | PoR `FUN_10ba_2686`; CotAB 0x4F883 |
| "The party has won." | 0x1E8EC | 0x1E106 | aftermath: won | PoR `FUN_2e08_0916`; CotAB 0x1E19C |
| "The monsters rejoice for the party has been destroyed" | 0x1F557 | 0x1EE32 | aftermath: destroyed | PoR `FUN_2e08_1527`; CotAB 0x1EE82 |
| "The END!" | 0x1C35D, 0x1F54E | — | aftermath / party killed banner | PoR `FUN_29c3_2775` |
| "The entire party is killed!" | 0x1C366 | 0x1B169 | party killed (outside battles) | PoR `FUN_29c3_2775`; CotAB 0x1B1A8 |
| "press <enter>/<return> to continue" | 0x1C382, 0x1E973, 0x1F345 | 0x1B185, 0x1E179, 0x1EBCB | continue prompt | PoR `FUN_29c3_2775`; CotAB 0x1B1A8 |
| "Press any key to continue" | 0x077DE, 0x1F58D | 0x0515E, 0x1EE68, 0x3CC6B | game over prompt | PoR `FUN_1709_0768`; CotAB 0x05178 |
| "Not Here" | 0x2F0DB | 0x2F7E6 | area refused | PoR `FUN_3e76_0989`; CotAB 0x2F7EF |
| "Locked." | 0x2F4C4 | 0x2FA87 | locked door | PoR `FUN_3e76_0d6d`; CotAB 0x2FA90 |
| "Bash" | 0x2F4AC | 0x2FA6F | locked door menu | PoR `FUN_3e76_0d6d`; CotAB 0x2FA90 |
| "Choose a function" | 0x318D3 | 0x3697A | party screen prompt | PoR `FUN_417f_0161`; CotAB 0x36A1C |
| "Quit to DOS" | 0x31926 | 0x369CD | party screen exit | PoR `FUN_417f_0161`; CotAB 0x36A1C |
| "Drop " | 0x336C2 | 0x38DC5 | party screen drop | PoR `FUN_417f_1f37`; CotAB 0x38E2A |
| " forever?" | 0x336C8 | 0x38DCB | party screen drop | PoR `FUN_417f_1f37`; CotAB 0x38E2A |
| "Are you sure?" | 0x336D3 | 0x38DD6 | party screen drop | PoR `FUN_417f_1f37`; CotAB 0x38E2A |
| "You dump" | 0x336E2 | 0x38DE5 | party screen drop: out of play | PoR `FUN_417f_1f37`; CotAB 0x38E2A |
| " bids you farewell." | 0x336F7 | 0x38DFA | party screen drop: yes | PoR `FUN_417f_1f37`; CotAB 0x38E2A |
| " breathes a sigh of relief." | 0x3370B | 0x38E0E | party screen drop: no | PoR `FUN_417f_1f37`; CotAB 0x38E2A |
| " can't be modified." | 0x3385E | 0x39059 | modify refused | PoR `FUN_417f_209f`; CotAB 0x39080 |
| "Modify character:" | 0x33872 | — | modify prompt | PoR `FUN_417f_209f` |
| "Is this icon ok?" | 0x3500B | 0x3A704 | icon editor | PoR `FUN_417f_382d`; CotAB 0x3A716 |
| "Save Which Game:" | 0x37915 | 0x3623A | save prompt | PoR `FUN_45c5_1d58`; CotAB 0x3631E |
| "Do you wish to train?" | 0x34174 | 0x3B52D | training question | PoR `FUN_417f_29ae`; CotAB 0x3B557 |
| "Congratulations..." | 0x3418B | 0x3B544 | training | PoR `FUN_417f_29ae`; CotAB 0x3B557 |

The engine's other messages are in §4, the texts the profile data address (effect and spell lines,
the credits, the monster-name lists) in §5. The script texts (ECL) are read from the scripts already ([ecl.md](../A-games/engine/ecl.md)); the port quotes a few
words of them only as match keys ([port-data.md](port-data.md) §3–§5).

## 3. Port texts

The port's own interface texts: normative, stated in the part C section that uses them, and indexed
here. *x*, *Name* and the like are filled in at run time. Texts quoted in part C and not listed here are
game texts (§2).

### 3.1 Games screen, import, title, update

| Text | Where |
|---|---|
| "GoldBox Rerolled" (heading and page title); "GoldBox Rerolled: *game*" (page title in a game) | [app-flow.md §2](../C-port/app-flow.md#2-start-up-and-the-games-screen) |
| "This port plays the SSI Gold Box games from the game files of your own copy (MS-DOS), …" | app-flow §2.2 |
| "imported", "not imported: choose its *FOLDER* folder", " · assets only", "early: being built, expect gaps" (CotAB's profile note) | app-flow §2.2 |
| Play, View, Import, Re-import, Remove, "Forget this game's files (characters and saves are kept)", "Choose a game folder", "Choose files", "For browsers without a folder picker" | app-flow §2.2 |
| "Loading *name*…", "Choose the *FOLDER* folder of *name*.", "Remove *name*'s game files from this browser? Its characters and saved games are kept, and come back when you import it again." | app-flow §2.2 |
| "Reading files…", "These are not the files of a game the port knows (*games*).", "These are *found* files, not *expected*: importing them as *found*.", "Found *n* *game* files, but not the full set (the .DAX files are needed).", "Saving *n* *game* files for offline use…" | [app-flow.md §3](../C-port/app-flow.md#3-importing-game-files) |
| "Press any key or tap to continue" (title); "Continue" (its accessible name) | [app-flow.md §4](../C-port/app-flow.md#4-the-title) |
| "A new version is available.", Reload, Later | [pwa-and-build.md §4](../C-port/pwa-and-build.md#4-the-service-worker) |
| the version line | [pwa-and-build.md §6](../C-port/pwa-and-build.md#6-the-version-stamp) |

### 3.2 Party screen

| Text | Where |
|---|---|
| "Party", "No characters in the party. Create or Add one.", "level *a*/*b* · AC *n* · *status*", "HP *hp* / *max*", "Select *name*", "View *name*" | [app-flow.md §5](../C-port/app-flow.md#5-the-party-screen) |
| "⇄ Games", "Switch game, import another, or remove one", "⚙ Settings", "Assets" | app-flow §5 |
| the groups **Play**, **Party**, **Files**, the port's functions' labels (Continue, Watch the demo, Export, Import, Exit; the original's functions are the game's, §4.1) and every second line (Continue "the autosave of *date*", Begin adventuring "with this party" / "add or create a character first", …) | app-flow §5 (table) |
| "*Name* has been created. Use Add to put them in the party.", "*Name* has been modified.", "*Name* joins the party.", "*Name* leaves the party (still available to Add).", "*Name* will be gone forever. Drop this character?", "*Name* has been dropped." | [screens.md §1](../C-port/screens.md#1-the-party-screens-functions) |
| "Create a character", Race, Gender, Class, Alignment, "Not open to a *Race*", "Not allowed for a *Class*", "Changing race, gender or class rolls the character again, as the original rolls after those choices. Alignment does not.", "*Class* is not open to a *Race*: now *Class*.", "*Alignment* is not allowed for a *Class*: now *Alignment*.", Reroll, Name, "up to 15 letters", Head, Body (the portrait; PoR shows its own, `portrait` §4.1), Cancel, Create (the icon's Head, Weapon, Size, Small, Large, parts and colours are the editor's words, §4.1), "Give the character a name." | [screens.md §1.1](../C-port/screens.md#11-create-character) |
| "Modify *Name*" (its Keep and Exit are the game's, §4.1); "Combat icon", "old: ready, action", "new: ready, action" | screens §1.2, §1.6 |
| "Add character", "*Race Class*, level *a*/*b*", Cancel | screens §1.3 |
| "Load saved game", "Autosave: *label*", "*x*: *label*", "(conflict copy, this browser's | another device's)", "(game files): *Name*'s party", "block *b* area *a*", "There are no saved games." | [screens.md §1.7](../C-port/screens.md#17-load-saved-game) |
| "Export saved game", "Slot *x* exported: unzip it into the game folder to play it in DOSBox.", "There are no saved games in this browser.", "Slot *x* already holds a saved game. Replace it?", "*Name* is already in the roster. Replace?", "Imported into slot *x*; use Load to play.", "Added to the roster: *names*.", " Skipped: missing *files*.", "Nothing imported.", "Nothing imported; missing *files*.", "Choose a SAVGAM file (A to J) with its CHRDAT files, characters (…), or a ZIP of them.", "Import failed: *message*" | [screens.md §1.8](../C-port/screens.md#18-export-and-import) |

### 3.3 Play screen

| Text | Where |
|---|---|
| Area, Encamp, Search, Look, Journal, Commissions, "The Adventurer's Journal: entries, proclamations, tavern tales (J)", "The City Council's commissions and progress (O)", "☰ Menu", "Save, settings, rules, quit (Esc)", "Leave demo", "Escape: back to the party screen", "Stop resting", Continue | [ui-contract.md §5](../C-port/ui-contract.md#5-the-command-bar) |
| the pad's names "Turn left", "Forward", "Turn right", "Turn around", "West", "North", "East", "South" | [ui-contract.md §4.4](../C-port/ui-contract.md#44-the-pad) |
| "*Facing* · *x*,*y* · *clock*", "Wilderness · *x*,*y* · facing *Facing* · *clock*", " · Searching" | [ui-contract.md §4.2](../C-port/ui-contract.md#42-the-view-region) |
| "Not here.", "Area map (click to enlarge)" | [ui-contract.md §4.3](../C-port/ui-contract.md#43-the-area-map) |
| the cards: "AC *n*", "HP *hp*/*max*", " (Helpless)", "✦ ", "×*n*", Quick, "Ready to train", the experience tooltips, the Quick tooltip | [ui-contract.md §4.1](../C-port/ui-contract.md#41-party-cards) |
| notes: "Blocked.", "Loaded: *label*.", "A new game: Begin Adventuring from the party screen.", "Game saved in slot *x*.", "The demo. Escape or Leave demo goes back to the party screen.", "Script error: *message*", "Combat error: *message*", "The game has ended here: ☰ Menu, Quit to the party screen, to start again." | [ui-contract.md §6.2](../C-port/ui-contract.md#62-the-ports-notes), [app-flow.md §7](../C-port/app-flow.md#7-play-new-game-load-continue) |
| "Save in which slot?", "*x*: *label* (*date*)", "*x*: empty", "*Name*'s party, block *b* area *a*", "(new area)", "(on the way)" | [storage.md §5](../C-port/storage.md#5-saved-games-and-the-autosave) |
| missing files: "… needs START.EXE …: re-import the *FOLDER* folder." (camp, shop, temple, training hall, wilderness, items, sound, captions) | the screens concerned |
| "Menu", "Back to the game", the entries and their second lines | [screens.md §2](../C-port/screens.md#2-the--menu) |

### 3.4 Panels

| Text | Where |
|---|---|
| the sheet: Equipped, Carried, "Nothing else.", the slot labels, "Ammunition", "Also readied", "not for this class", "Drag an item onto a name to give it:", "Encumbrance *n* of *m* coins", "Pick an item to ready, use, trade or drop it.", "Ready: …", "Unready: …", "no change to AC, THAC0, damage or movement", "Can't ready: …", "Traded to *Name*.", "That scroll is marked for scribing: use Trade to give it.", "Cast which spell?", "Cast *Spell* on:", "The item is used up.", Spells, "(combat)", "Only in combat.", Abilities, "*Ability*: heal whom?", "… cure whom?", "*Name* is not diseased. Cure anyway?", "Trade money", "Drop money", "How much *coin* will you *trade/drop*?", "On Quick: the computer plays *Name* in battle.", "Play by hand", "*Name* will be played by hand in battle.", "Space or Take control to play them yourself.", "Items need the ITEMS file and START.EXE: …" | [screens.md §3](../C-port/screens.md#3-the-character-sheet) |
| treasure: "Treasure", "Coins go to the one selected", "Coins", "Each coin counts 1 towards the load. …", Take, " slows them", "Share evenly", "Pool the party's coins", "Detect Magic (*Name*): magic items get a *", "Take all…", "Items", "usable by *names*", "no one in the party can use it", "better for *Name*: …", "cannot take things now", "Nothing left.", "Done", "*Name* takes …", "Shared; what nobody could carry is still here.", "Shared.", "The party's coins are pooled here.", "Magic items now show a *.", "A suggested split (not in the original): …", "leave it", "shared evenly", Confirm, Cancel, "No room for: *items*.", "These will be left behind:", "Leave them", "Go back" | [screens.md §4](../C-port/screens.md#4-treasure) |
| shops: "Buy", All, Weapons, Armour, Other, "Only what *Name* can use", Price, Weight, "If readied instead", "can't ready: …", "no change", "Not enough money", "Nothing here.", "*Name* buys *item*.", "*Name* has *n* gp in coins.", "The pool holds *coins*.", "Healing for *Name*:" | [screens.md §5](../C-port/screens.md#5-shops-and-temples) |
| camp: "The party makes camp...", "Magic:", "Spells in Memory:" and the other list prompts as the port words them, "Memorize", "Cleric spells", "Magic-User spells", "Level *L*", "*u* of *t* slots", "Pending: tap to clear", "No spells of this level in the book.", "*Name* cannot memorize any spells.", "*n* spells to learn: rest …", "Nothing pending.", "No free slot of that level.", "Clear pending", "Display: …", "The last character cannot leave the party here.", "Monster pictures and portraits are always shown here." | [screens.md §6](../C-port/screens.md#6-camp) |
| training hall: "*Name* is selected (choose from the party list).", "Choose a function:", "The party is full.", "The party needs at least one character.", "*Name* will become:", "Spells to choose from:" | [screens.md §7.6](../C-port/screens.md#76-training-hall) |
| journal, commissions, rules reference, debug, settings: every label and message given there | [screens.md](../C-port/screens.md) §8–§12, [ui-contract.md §9](../C-port/ui-contract.md#9-settings) |
| the account section | [accounts-and-sync.md §6](../C-port/accounts-and-sync.md#6-the-account-section) |

### 3.5 Battle screen

| Text | Where |
|---|---|
| the command row (the game's words, §4.1, in the port's row) with the port's UNDO and END TURN, "*Name*: Move Left = *n*", SLOWER, FASTER, END MOVE | [combat-ui.md §4](../C-port/combat-ui.md#4-the-command-row) |
| "Take control", "Magic: On", "Magic: Off", the two tooltips, "Debug" | combat-ui §4 |
| "Path: *n* steps, *c* of *L* movement. Tap the green square again to go.", "Can't get there (Move Left = *L*)", "Tap the yellow square again to cast there.", "*Name* (range *d*, ≈*p*% to hit, *dice*)", "there (range *d*)", " nobody in range" | [combat-ui.md §5](../C-port/combat-ui.md#5-input), §6 |
| the info box's words: "unhurt", "lightly wounded", "wounded", "badly wounded", "helpless", "coughing", "charmed", "animated", "running", "unconscious", "dying", "dead", "stoned", "gone"; "Round *n*" | [combat-ui.md §7](../C-port/combat-ui.md#7-information) |
| "*Name* is on Quick: the computer plays them. Space or TAKE CONTROL to play them yourself.", "Magic is On: …", "Magic is Off: …", "*names*: under your control again", "Nobody is on Quick", "Magic On: characters on Quick may cast spells", "Magic Off: characters on Quick will not cast spells" | [combat-ui.md §10](../C-port/combat-ui.md#10-quick-and-magic) |
| "Press Enter to continue", "Win this battle", "every enemy falls; experience and treasure as for a won fight", "Debug: battle skipped as won." | [combat-ui.md §8](../C-port/combat-ui.md#8-the-end-of-a-battle), [screens.md §12](../C-port/screens.md#12-debug) |

The original's prompts that the port rewords (for example "Healing for *Name*:",
"Magic:", the training hall's "Choose a function:" with a colon, "Nothing happens." for the game's
"Nothing Happens...") stay port texts (§6).

## 4. Engine messages

The messages the engine prints from shared procedures, by the id the profile's string table uses
(`strings`, [B-model/profile.md](../B-model/profile.md)): the address in each game and the routine that
prints it (**O**). A game without the message has no entry ("—"); a procedure that prints it there
shows `#id` (§1), which a conforming build never reaches. Where a line is assembled at run time the
pieces are the original's, in its order: the name, a space, the piece, as the original's print
routine joins them (for example the attack line: name, `attacks` or `backstabs`, the target,
`fromBehind` when it applies, `hittingFor`, the number, `point` or `points`, `ofDamage`). The trailing
spaces some prompts carry (the original's input routine prints after them) are dropped where the port
shows the prompt as a heading. CotAB's own wordings come with its addresses: `blocked` is "can't go
there", `lostDuel` "You have lost the fight.", and its share line is `hidesShare`, then `his` or `her`
by the gender byte (0 his), then `share`.

| Id | What | PoR image | printed by | CotAB image | printed by |
|---|---|---|---|---|---|
| `cough` | Stinking Cloud, saved | 0x42C1B | `FUN_5216_0ae7` | 0x4B8B5 | 0x4B8F7 |
| `nausea` | Stinking Cloud, not saved | 0x42C2B | `FUN_5216_0ae7` | 0x4B8C5 | 0x4B8F7 |
| `cloudPoisoned` | Cloudkill | — |  | 0x4B8E1 | 0x4B8F7 |
| `cloudKilled` | Cloudkill | — |  | 0x4B8ED | 0x4B8F7 |
| `battleBegins` | battle start | 0x26A8E | `FUN_34c7_1e31` | 0x268B8 | 0x268CB |
| `teammateDying` | round end | 0x22918 | `FUN_320c_0880` | 0x226BB | 0x226E3 |
| `continueBattle` | no enemy left | 0x2292F | `FUN_320c_0880` | 0x226D2 | 0x226E3 |
| `gameSpeed` | speed prompt | 0x31240 | `FUN_3f81_1a97` | 0x318B4 | 0x3191B |
| `speedRange` | speed prompt, end | 0x3124E | `FUN_3f81_1a97` | 0x318C2 | 0x3191B |
| `bandaged` | Bandage | 0x230B3 | `FUN_320c_0fff` | 0x503A3 | 0x503AF |
| `flee` | a step off the battlefield | 0x22A91 | `FUN_320c_09df` | 0x22841 | 0x22856 |
| `blocked` | a step that cannot be taken (CotAB: "can't go there") | 0x22A97 | `FUN_320c_09df` | 0x22847 | 0x22856 |
| `notWithWeapon` | Aim with a missile weapon | 0x22DF0 | `FUN_320c_0d45` | 0x22C1E | 0x22C33 |
| `attackAlly` | aiming at the own side | 0x2D46A | `FUN_3aae_2998` | 0x2D461 | 0x2D46F |
| `aim` | aim prompt | 0x2D57B | `FUN_3aae_2aa0` | 0x2D572 | 0x2D577 |
| `usesItem` | Use | 0x3A3B7 | `FUN_4894_1a8a` | 0x3F98F | 0x3F9A8 |
| `campOnlySpell` | Cast in combat | 0x2CED5 | `FUN_3aae_2414` | 0x2CC9E | 0x2CCBD |
| `beginsCasting` | Cast in combat | 0x2CEE5 | `FUN_3aae_2414` | 0x2CCAE | 0x2CCBD |
| `sweeps` | sweep attack | 0x2B95B | `FUN_3aae_0e82` | 0x2B486 | 0x2B48D |
| `backstabs` | attack line | 0x2AD12 | `FUN_3aae_02f9` | 0x2A7A1 | 0x2A868 |
| `slaysHelpless` | attack on the helpless | 0x2AD1E | `FUN_3aae_02f9` | 0x2A7AD | 0x2A868 |
| `attacks` | attack line | 0x2AD2D | `FUN_3aae_02f9` | 0x2A7BC | 0x2A868 |
| `fromBehind` | attack line | 0x2AD35 | `FUN_3aae_02f9` | 0x2A7C4 | 0x2A868 |
| `cruelBlow` | attack on the helpless | 0x2AD44 | `FUN_3aae_02f9` | 0x2A7D3 | 0x2A868 |
| `hittingFor` | attack line | 0x2AD58 | `FUN_3aae_02f9` | 0x2A7E7 | 0x2A868 |
| `point` | attack line | 0x2AD65 | `FUN_3aae_02f9` | 0x2A7F4 | 0x2A868 |
| `points` | attack line | 0x2AD6D | `FUN_3aae_02f9` | 0x2A7FC | 0x2A868 |
| `ofDamage` | attack line | 0x2AD76 | `FUN_3aae_02f9` | 0x2A805 | 0x2A868 |
| `andMisses` | attack line | 0x2AD80 | `FUN_3aae_02f9` | 0x2A80F | 0x2A868 |
| `lostSpell` | damage while casting | 0x2AD8B | `FUN_3aae_02f9` | 0x2A81A | 0x2A868 |
| `goesDown` | a fall | 0x2AD98 | `FUN_3aae_02f9` | 0x2A827 | 0x2A868 |
| `andIsDying` | a fall | 0x2ADA2 | `FUN_3aae_02f9` | 0x2A831 | 0x2A868 |
| `isKilled` | a fall | 0x2ADCF | `FUN_3aae_02f9` | 0x2A85E | 0x2A868 |
| `gotAway` | flight off the battlefield | 0x2B72F | `FUN_3aae_0c6a` | 0x2B250 | 0x2B26B |
| `escapeBlocked` | flight | 0x2B738 | `FUN_3aae_0c6a` | 0x2B259 | 0x2B26B |
| `turnsUndead` | Turn | 0x2BC10 | `FUN_3aae_116a` | 0x2B73E | 0x2B778 |
| `isTurned` | Turn | 0x2BC20 | `FUN_3aae_116a` | 0x2B74E | 0x2B778 |
| `isDestroyed` | Turn | 0x2BC2A | `FUN_3aae_116a` | 0x2B758 | 0x2B778 |
| `nothingHappens` | Turn | 0x2BC37 | `FUN_3aae_116a` | 0x2B765 | 0x2B778 |
| `abortSpell` | a cast without a target | 0x3F134 | `FUN_4e53_0c20` | 0x45235 | 0x45251 |
| `spellAborted` | a cast without a target | 0x3F142 | `FUN_4e53_0c20` | 0x45243 | 0x45251 |
| `castsASpell` | a monster casts | 0x41835 | `FUN_4e53_331a` | 0x4A3E8 | 0x4A3FD |
| `spellName` | a monster casts | 0x41843 | `FUN_4e53_331a` | 0x4A3F6 | 0x4A3FD |
| `alreadyTargeted` | target list | 0x2CB8D | `FUN_3aae_20c3` | 0x2C76B | 0x2C781 |
| `charmUnaffected` | Charm / Hold Person on the large | 0x3F6F4 | `FUN_4e53_11dd` | 0x45E85 | 0x45E9E |
| `fleesInPanic` | morale | 0x23340 | `FUN_3334_000f` | 0x230FC | 0x2310B |
| `forcedToFlee` | morale | 0x243FA | `FUN_3334_10d7` | 0x24422 | 0x2443F |
| `surrenders` | morale | 0x2440C | `FUN_3334_10d7` | 0x24434 | 0x2443F |
| `wonDuel` | aftermath | 0x1E8D5 | `FUN_2e08_0916` | 0x1E0EF | 0x1E19C |
| `foundTreasure` | aftermath | 0x1E913 | `FUN_2e08_0916` | 0x1E119 | 0x1E19C |
| `duelistReceives` | aftermath | 0x1E931 | `FUN_2e08_0916` | 0x1E137 | 0x1E19C |
| `experiencePoints` | aftermath | 0x1E960 | `FUN_2e08_0916` | 0x1E166 | 0x1E19C |
| `lostDuel` | aftermath (CotAB: "the fight") | 0x1E8BD | `FUN_2e08_0916` | 0x1E0D6 | 0x1E19C |
| `partyWon` | aftermath | 0x1E8EC | `FUN_2e08_0916` | 0x1E106 | 0x1E19C |
| `eachReceives` | aftermath | 0x1E947 | `FUN_2e08_0916` | 0x1E14D | 0x1E19C |
| `partyFled` | aftermath | 0x1E8FF | `FUN_2e08_0916` | 0x1E0C2 | 0x1E19C |
| `theEnd` | the party destroyed | 0x1F54E | `FUN_2e08_1527` | — |  |
| `monstersRejoice` | the party destroyed | 0x1F557 | `FUN_2e08_1527` | 0x1EE32 | 0x1EE82 |
| `hidesShare` | an NPC takes its share (CotAB: then his/her, " share.") | 0x1F329 | `FUN_2e08_12e8` | 0x1EBA8 | 0x1EBEE |
| `his` | CotAB share line | — |  | 0x1EBBA | 0x1EBEE |
| `share` | CotAB share line | — |  | 0x1EBBE | 0x1EBEE |
| `her` | CotAB share line | — |  | 0x1EBC6 | 0x1EBEE |
| `locked` | a locked door | 0x2F4C4 | `FUN_3e76_0d6d` | 0x2FA87 | 0x2FA90 |
| `noMonster` | LOAD_MONSTER | 0x36AF5 | `FUN_45c5_0ec4` | 0x3563D | 0x3565C |
| `bothWait` | encounter | 0x1BB04 | `FUN_29c3_1ef8` | 0x1A8E9 | 0x1A90D |
| `monstersFlee` | encounter | 0x1BB15 | `FUN_29c3_1ef8` | 0x1A8FA | 0x1A90D |
| `dies` | script DAMAGE | 0x21F21 | `FUN_2fea_20cc` | 0x21B85 | 0x21BD0 |
| `isHitFor` | script DAMAGE | 0x21F29 | `FUN_2fea_20cc` | 0x21B8D | 0x21BD0 |
| `pointsOfDamage` | script DAMAGE | 0x21F36 | `FUN_2fea_20cc` | 0x21B9A | 0x21BD0 |
| `riverStench` | PoR wilderness | 0x2EF54 | `FUN_3e76_0818` | — |  |
| `wrongClass` | Ready | 0x39DE0 | `FUN_4894_14d0` | 0x3F3D6 | 0x3F406 |
| `alreadyUsing` | Ready | 0x39DEC | `FUN_4894_14d0` | 0x3F3E2 | 0x3F406 |
| `handsFull` | Ready | 0x39DFB | `FUN_4894_14d0` | 0x3F3F1 | 0x3F406 |
| `cursed` | Unready | 0x39DD4 | `FUN_4894_14d0` | 0x3F3CA | 0x3F406 |
| `overloaded` | Trade | 0x3A069 | `FUN_4894_1734` | 0x3F641 | 0x3F64C |
| `consciousOnly` | training | 0x340DE | `FUN_417f_29ae` | 0x3B497 | 0x3B557 |
| `notThatClass` | training | 0x34115 | `FUN_417f_29ae` | 0x3B4CE | 0x3B557 |
| `notEnoughXp` | training | 0x34134 | `FUN_417f_29ae` | 0x3B4ED | 0x3B557 |
| `aLevel` | training | 0x34158 | `FUN_417f_29ae` | 0x3B511 | 0x3B557 |
| `trainingCosts` | training | 0x340FD | `FUN_417f_29ae` | 0x3B4B6 | 0x3B557 |
| `willBecome` | training | 0x3414A | `FUN_417f_29ae` | 0x3B503 | 0x3B557 |
| `andALevel` | training | 0x34167 | `FUN_417f_29ae` | 0x3B520 | 0x3B557 |
| `wishToTrain` | training | 0x34174 | `FUN_417f_29ae` | 0x3B52D | 0x3B557 |
| `congratulations` | training | 0x3418B | `FUN_417f_29ae` | 0x3B544 | 0x3B557 |
| `reviveMonster`, `reviveParty` | revived in place: a monster, a party member (after the name) | 0x439A8, 0x439BC | `FUN_5216_1869` | 0x4CF56, 0x4CF6A | 0x4CF77 |
| `sellOverloaded` | items: Sell, the platinum does not fit | 0x3A606 | `FUN_4894_1cee` | 0x3FCCA | 0x3FCF2 |
| `appraiseOverloaded` | appraisal sold, the platinum does not fit ("Pool" capitalised) | 0x3C4AB | `FUN_4c2d_0203` | 0x41F84 | 0x41FAC |
| `tradeHowMuch`, `tradeWillYou` | money Trade: "How much ", the coin word, "will you trade? " | 0x3AA7B, 0x3AA85 | `FUN_4894_2156` | 0x40153, 0x4015D | 0x4016E |
| `dropHowMuch`, `dropWillYou` | money Drop: "How much ", the coin word, "will you drop? " | 0x3ADCD, 0x3ADD7 | `FUN_4894_24a7` | 0x404AD, 0x404B7 | 0x404C7 |
| `takeSelectCoin`, `takeWillYou` | taking from the pool: the list's prompt; "will you take? " after `howMuch` and the coin word | 0x3CF8D, 0x3CFAB | `FUN_4c2d_0ceb` | 0x42A64, 0x42A8A | 0x42A9A |
| `coinCopper` … `coinJewelry` | the money prompts' coin words, by coin: "Copper ", "silver ", "electrum ", "Gold ", "Platinum ", "Gems ", "Jewelry " | 0x3CE52, 0x3CE4A, 0x3CE40, 0x3CE30, 0x3CE36, 0x3CE2A, 0x3CE5A | `FUN_4c2d_0b93` | 0x4292A, 0x42922, 0x42918, 0x42908, 0x4290E, 0x42902, 0x42932 | 0x4293B |
| `scrollOops` | a scroll its user cannot read, after the name | — |  | 0x3F9A2 | 0x3F9A8 |
| `pickNewClass` | dual-classing: the list's title | — |  | 0x5131D | 0x5135D |
| `doesntQualify` | dual-classing: no class allowed, after the name | — |  | 0x5132C | 0x5135D |
| `nowFirstLevel`, `nowFirstLevelEnd` | dual-classing done: name, this, the class name, the full stop | — |  | 0x51346, 0x5135B | 0x5135D |
| `isDrained` | energy drain | 0x2931F | `FUN_3723_2122` | — |  |
| `drainLevels` | energy drain | 0x2930F | `FUN_3723_2122` | — |  |
| `drainALevel` | energy drain | 0x29317 | `FUN_3723_2122` | — |  |
| `hasScribed` | rest | 0x3BE3B | `FUN_4b46_09e7` | 0x418B6 | 0x418C2 |
| `hasMemorized` | rest | 0x3BD77 | `FUN_4b46_0925` | 0x417F2 | 0x41800 |
| `partyHealed` | rest | 0x3BCB7 | `FUN_4b46_0871` | 0x41727 | 0x41741 |
| `interrupted` | rest | 0x3C0D9 | `FUN_4b46_0c9a` | — |  |
| `fallKilled` | damage outside combat | 0x4349A | `FUN_5216_1344` | 0x4CA60 | 0x4CA6A |
| `fallDown` | damage outside combat | 0x43461 | `FUN_5216_1344` | 0x4CA27 | 0x4CA6A |
| `getsBackUp` | revive | 0x439BC | `FUN_5216_1869` | 0x4CF6A | 0x4CF77 |
| `unCursed` | Remove Curse | 0x40A4E | `FUN_4e53_2540` | 0x47552 | 0x47575 |
| `itemUnCursed` | Remove Curse | 0x40A5B | `FUN_4e53_2540` | — |  |
| `miscasts` | CotAB miscast | — |  | 0x45226 | 0x45251 |
| `casts` | cast outside combat | 0x3F12E | `FUN_4e53_0c20` | 0x4522F | 0x45251 |
| `noEvilScum` | joining | — |  | 0x39E42 | 0x39E98 |
| `tooManyRangers` | joining | — |  | 0x39E66 | 0x39E98 |
| `toleratesNoEvil` | joining | — |  | 0x39E80 | 0x39E98 |
| `feelsBetter` | Lay on Hands | — |  | 0x40BEA | 0x40C07 |
| `handsUnaffected` | Lay on Hands | — |  | 0x40BF8 | 0x40C07 |
| `diseaseCured` | Cure Disease | — |  | 0x40D12 | 0x40D1C |
| `mustUnready` | Drop | 0x39660 | `FUN_4894_0d70` | 0x3E3A1 | 0x3E3F1 |
| `takeOverloaded` | Trade | 0x3A069 | `FUN_4894_1734` | 0x3F641 | 0x3F64C |
| `cantHalve` | Halve | 0x3A11C | `FUN_4894_17ed` | 0x3F6F4 | 0x3F705 |
| `moneyOverloaded` | money trade | 0x3C711 | `FUN_4c2d_044c` | 0x421F0 | 0x421FB |
| `takes` | damage line | 0x433E7 | `FUN_5216_1344` | 0x4C9AD | 0x4CA6A |
| `pointsOfDamageLine` | damage line | 0x433EE | `FUN_5216_1344` | 0x4C9B4 | 0x4CA6A |
| `takesOnePoint` | damage line | 0x43401 | `FUN_5216_1344` | 0x4C9C7 | 0x4CA6A |
| `fromFire` | damage line | 0x4341A | `FUN_5216_1344` | 0x4C9E0 | 0x4CA6A |
| `fromCold` | damage line | 0x43424 | `FUN_5216_1344` | 0x4C9EA | 0x4CA6A |
| `fromElectricity` | damage line | 0x4342E | `FUN_5216_1344` | 0x4C9F4 | 0x4CA6A |
| `fromAcid` | damage line | 0x4343F | `FUN_5216_1344` | 0x4CA05 | 0x4CA6A |
| `fromMagic` | damage line | 0x43449 | `FUN_5216_1344` | 0x4CA0F | 0x4CA6A |
| `unaffected` | add-effect negated | 0x437A8 | `FUN_5216_1656` | 0x4CD83 | 0x4CD91 |
| `avoidsIt` | save avoids | 0x281D2 | `FUN_3723_0fac` | 0x2824C | 0x28256 |
| `deadForever` | energy drain | 0x2932B | `FUN_3723_2122` | — |  |
| `drainKilled` | energy drain | 0x29348 | `FUN_3723_2122` | — |  |
| `isCured` | cure | 0x431D8 | `FUN_5216_1081` | 0x4C0F4 | 0x4C0FD |
| `howMuch` | money: amount (pool, take) | 0x3CFA1 | `FUN_4c2d_0ceb` | 0x42A80 | 0x42A9A |
| `noGems` | appraise | 0x3DBB0 | `FUN_4c2d_19b2` | 0x435E6 | 0x436B8 |
| `fineCollection` | appraise | 0x3DBF3 | `FUN_4c2d_19b2` | 0x43629 | 0x436B8 |
| `gemOne` | appraise | 0x3DBC3 | `FUN_4c2d_19b2` | 0x435F9 | 0x436B8 |
| `pieceOfJewelry` | appraise | 0x3DBCE | `FUN_4c2d_19b2` | 0x43604 | 0x436B8 |
| `gemsCount` | appraise | 0x3DBC8 | `FUN_4c2d_19b2` | 0x435FE | 0x436B8 |
| `piecesOfJewelry` | appraise | 0x3DBE0 | `FUN_4c2d_19b2` | 0x43616 | 0x436B8 |
| `gemValued` | appraise | 0x3DC35 | `FUN_4c2d_19b2` | 0x4366B | 0x436B8 |
| `gp` | appraise | 0x3DC4B | `FUN_4c2d_19b2` | 0x43681 | 0x436B8 |
| `jewelValued` | appraise | 0x3DC6A | `FUN_4c2d_19b2` | 0x436A0 | 0x436B8 |
| `youCan` | appraise | 0x3DC5F | `FUN_4c2d_19b2` | 0x43695 | 0x436B8 |
| `shopOverloaded` | shop Buy, treasure Take | 0x1F92E | `FUN_2f70_0239` | 0x1F3A1 | 0x1F3AC |
| `shopNoMoney` | shop Buy | 0x1FA4F | `FUN_2f70_0361` | 0x1F4C2 | 0x1F4D4 |
| `notBlind` | temple | 0x1D36C | `FUN_2d14_0249` | 0x1C911 | 0x1C92E |
| `notDiseased` | temple | 0x1D40F | `FUN_2d14_02ed` | 0x1C9B4 | 0x1C9D2 |
| `notPoisoned` | temple | 0x1D86E | `FUN_2d14_0751` | 0x1CF18 | 0x1CF3B |
| `notDead` | temple | 0x1D638 | `FUN_2d14_0510` | 0x1CCCE | 0x1CCE6 |
| `notCursed` | temple | 0x1D95E | `FUN_2d14_083a` | 0x1D008 | 0x1D024 |
| `notStoned` | temple | 0x1DA4A | `FUN_2d14_0928` | 0x1D0F4 | 0x1D112 |
| `cureAnyway` | temple | 0x1D140 | `FUN_2d14_0013` | 0x1C6E2 | 0x1C6F5 |
| `willOnlyCost` | temple | 0x1D1B6 | `FUN_2d14_00bf` | 0x1C758 | 0x1C7A1 |
| `goldPieces` | temple | 0x1D1C7 | `FUN_2d14_00bf` | 0x1C769 | 0x1C7A1 |
| `payForCure` | temple | 0x1D1D5 | `FUN_2d14_00bf` | 0x1C777 | 0x1C7A1 |
| `templeNoMoney` | temple | 0x1D1E3 | `FUN_2d14_00bf` | 0x1C785 | 0x1C7A1 |
| `templeCured` | temple | 0x1D1F5 | `FUN_2d14_00bf` | 0x1C797 | 0x1C7A1 |
| `take` | treasure | 0x1EDA0 | `FUN_2e08_0d38` | 0x1E5F6 | 0x1E60E |
| `makesCamp` | camp | 0x31633 | `FUN_3f81_1e6f` | 0x3217C | 0x321CB |
| `camp` | camp | 0x3166B | `FUN_3f81_1e6f` | 0x321B4 | 0x321CB |
| `quitToDos` | camp Save | 0x31672 | `FUN_3f81_1e6f` | 0x321BA | 0x321CB |
| `castAny` | spell activity | 0x2FB49 | `FUN_3f81_036c` | 0x3010D | 0x30140 |
| `memorizeAny` | spell activity | 0x2FB59 | `FUN_3f81_036c` | 0x3011D | 0x30140 |
| `scribeAny` | spell activity | 0x2FB69 | `FUN_3f81_036c` | 0x3012D | 0x30140 |
| `noCastHere` | spell activity | 0x2FB12 | `FUN_3f81_036c` | 0x300D6 | 0x30140 |
| `noCondition` | spell activity | 0x2FB32 | `FUN_3f81_036c` | 0x300F6 | 0x30140 |
| `noSpells` | Cast | 0x2FC99 | `FUN_3f81_04a1` | 0x3025D | 0x30275 |
| `combatOnlySpell` | Cast outside combat | 0x3F0DE | `FUN_4e53_0c20` | — |  |
| `loseIt` | Cast outside combat | 0x3F0F8 | `FUN_4e53_0c20` | 0x451F0 | 0x45251 |
| `memorizeThese` | Memorize | 0x300CF | `FUN_3f81_090a` | 0x306AA | 0x306F5 |
| `memorizeThese2` | Memorize | 0x30102 | `FUN_3f81_090a` | 0x306DD | 0x306F5 |
| `cannotMemorize` | Memorize | 0x300E7 | `FUN_3f81_090a` | 0x306C2 | 0x306F5 |
| `scribeThese` | Scribe | 0x302C9 | `FUN_3f81_0b5b` | 0x308A9 | 0x3094B |
| `scribeThese2` | Scribe | 0x30355 | `FUN_3f81_0b5b` | 0x30935 | 0x3094B |
| `noScrolls` | Scribe | 0x302DF | `FUN_3f81_0b5b` | 0x308BF | 0x3094B |
| `knowSpell` | Scribe | 0x302F7 | `FUN_3f81_0b5b` | 0x308D7 | 0x3094B |
| `scribingSpell` | Scribe | 0x30313 | `FUN_3f81_0b5b` | 0x308F3 | 0x3094B |
| `cannotScribe` | Scribe | 0x30336 | `FUN_3f81_0b5b` | 0x30916 | 0x3094B |
| `funky` | Display | 0x306D0 | `FUN_3f81_0fbc` | 0x30CB2 | 0x30DDA |
| `noSpellEffects` | Display | 0x307AF | `FUN_3f81_0fbc` | 0x30DC5 | 0x30DDA |
| `restTime` | Rest | 0x3BA43 | `FUN_4b46_05f0` | 0x414A8 | 0x414B5 |
| `alter` | Alter | 0x31420 | `FUN_3f81_1c59` | 0x31A97 | 0x31AD8 |
| `selected` | Alter Order | 0x30F7E | `FUN_3f81_1780` | 0x315F2 | 0x31604 |
| `dropFromParty` | Alter Drop | 0x310A2 | `FUN_3f81_18e5` | 0x31716 | 0x31769 |
| `bidsFarewell` | Alter Drop | 0x310B4 | `FUN_3f81_18e5` | 0x31728 | 0x31769 |
| `dumpedInDitch` | Alter Drop | 0x310C6 | `FUN_3f81_18e5` | 0x3173A | 0x31769 |
| `sighOfRelief` | Alter Drop | 0x310DB | `FUN_3f81_18e5` | 0x3174F | 0x31769 |
| `partyKilled` | the party destroyed outside battles | 0x1C366 | `FUN_29c3_2775` | 0x1B169 | 0x1B1A8 |
| `cantModify` | Modify | 0x3385E | `FUN_417f_209f` | 0x39059 | 0x39080 |
| `goldForYour` | Sell | 0x3A5DA | `FUN_4894_1cee` | 0x3FC9E | 0x3FCF2 |
| `illGiveYou` | Sell | 0x3A5CB | `FUN_4894_1cee` | 0x3FC8F | 0x3FCF2 |
| `mustBeReadied` | Use | 0x39803 | `FUN_4894_0ef8` | 0x3EA7E | 0x3EAB3 |
| `moveLeft` | battle step | 0x22A74 | `FUN_320c_09df` | 0x22824 | 0x22856 |
| `shopLeave` | shop Exit with money left | 0x1FBC0 | `FUN_2f70_053e` | 0x1F6C9 | 0x1F747 |
| `shopGoBack` | shop Exit with money left | 0x1FC13 | `FUN_2f70_053e` | 0x1F71C | 0x1F747 |
| `templeLeave` | temple Exit with money left | 0x1DDCE | `FUN_2d14_0d09` | 0x1D40E | 0x1D489 |
| `templeGoBack` | temple Exit with money left | 0x1DE19 | `FUN_2d14_0d09` | 0x1D459 | 0x1D489 |
| `treasureLeft` | treasure Exit | 0x1EEFD | `FUN_2e08_0ecd` | 0x1E753 | 0x1E7A3 |
| `treasureGoBack` | treasure Exit | 0x1EF1D | `FUN_2e08_0ecd` | 0x1E773 | 0x1E7A3 |
| `guarding` | Guard | 0x0321D | `FUN_10ba_2686` | 0x4F87A | 0x4F883 |
| `dropIt` | items: Drop | 0x3982E | `FUN_4894_0ef8` | 0x3EAA9 | 0x3EAB3 |
| `isItADeal` | items: Sell | 0x3A5F1 | `FUN_4894_1cee` | 0x3FCB5 | 0x3FCF2 |
| `sold` | items: Sell | 0x3A600 | `FUN_4894_1cee` | 0x3FCC4 | 0x3FCF2 |
| `identifyFor` | items: identify | 0x3A808 | `FUN_4894_1f52` | 0x3FECF | 0x3FF59 |
| `identifyDeal` | items: identify | 0x3A830 | `FUN_4894_1f52` | 0x3FEF7 | 0x3FF59 |
| `idNoMoney` | items: identify | 0x3A83F | `FUN_4894_1f52` | 0x3FF06 | 0x3FF59 |
| `nothingNew` | items: identify | 0x3A850 | `FUN_4894_1f52` | 0x3FF17 | 0x3FF59 |
| `looksLike` | items: identify | 0x3A876 | `FUN_4894_1f52` | 0x3FF3D | 0x3FF59 |
| `tradeWithWhom` | items: Trade | 0x3A058 | `FUN_4894_1734` | 0x3F630 | 0x3F64C |
| `okayToLose` | items: a marked scroll | 0x39698 | `FUN_4894_0d70` | 0x3E3D9 | 0x3E3F1 |
| `tradeTo` | money: Trade | 0x3AA5A | `FUN_4894_2156` | 0x4012A | 0x4016E |
| `selectCoin` | money: Trade | 0x3AA66 | `FUN_4894_2156` | 0x40136 | 0x4016E |
| `notHere` | Area refused | 0x2F0DB | `FUN_3e76_0989` | 0x2F7E6 | 0x2F7EF |
| `partyOrder` | Alter Order | 0x30F50 | `FUN_3f81_1780` | 0x315C4 | 0x31604 |

### 4.1 Menus

The original's menus are single strings of words handed to its menu routine; the port reads each one
by address (the profile's `menus`, [B-model/profile.md](../B-model/profile.md)) and splits it as the
original does (**O**, 2026-10-21):

- **The menu routine's rule** (PoR `FUN_53aa_00cb` called by the horizontal menu `FUN_53aa_03bd`;
  CotAB 0x5194A, menu 0x51C48): a word begins at every capital letter or digit (the set at
  `53aa:00AB`) and ends two characters before the next word begins; the key pressed, upper-cased, is
  compared with every character of the string and chooses the word that begins at the last match;
  Space returns at once; the caller acts on the key. So a word's hot key is its capital ("daYs" is Y),
  spaces only separate, and a run with no capital (CotAB's and PoR's "xxxx" in the icon editor, filled
  in at run time) is no word.
- **The ECL menu rule** (PoR `FUN_2fea_156d` called by `FUN_2fea_1684`; CotAB 0x21063, 0x2117A), for the
  engine's menus written with `~`: every capital or digit is first lowered by 0x20, then each `~` is
  dropped and the character after it raised and taken as that word's key ("~COMBAT ~WAIT" is shown
  "Combat Wait", keys C and W); the routine returns the index of the key among those keys.
- **In the port** each space-separated run with a capital or digit is one choice, labelled with the
  run in capitals (as the game's font shows it, [rendering.md §5](../C-port/rendering.md#5-the-game-font))
  on menus and in the game's own case on panels, its hot key that capital, underlined; a key chooses
  the last choice it is the hot key of. The code acts on the key as the original's caller does (by
  position for the rest prompt, whose keys differ between the games). A menu built from several
  strings (the combat commands, the Done submenu, the treasure menu, the locked door, the speed
  prompts) has one id per piece, joined as the routine joins them, each piece only where the routine
  adds it. The party screen's functions are one string per entry (the table PoR `DS:0619`, CotAB
  `DS:0553`, 0x2A bytes each), the key its first letter.
- **Unreadable**: a menu that cannot be read shows one choice, `#` and its address, with no key
  (choosing it does what Esc does); a single word the port asks for by its key shows `#` and the
  address with that key; a menu a game has no address for has no words.

| Id | What | PoR image | shown by | CotAB image | shown by |
|---|---|---|---|---|---|
| `main` | "Area Cast View Encamp Search Look" (the command bar's Area, Encamp, Search, Look) | 0x0CC76 | `FUN_3e76_0989` | 0x0AFB8 | 0x2F7EF |
| `camp` | camp menu (CotAB with Fix) | 0x0CCC8 | `FUN_3f81_1e6f` | 0x0B00A | 0x321CB |
| `magic` | Magic | 0x0CCF1 | `FUN_3f81_13f1` | 0x0B033 | 0x31275 |
| `alter` | Alter | 0x0CD1A | `FUN_3f81_1c59` | 0x0B05C | 0x31AD8 |
| `orderSelect`, `orderPlace` | Order: "Select Exit", "Place Exit" (`DS:0584`, CotAB `DS:04A6`, + 0x29·*k*) | 0x0CD44, 0x0CD6D | `FUN_3f81_1780` | 0x0B086, 0x0B0AF | 0x31604 |
| `campFaster`, `campSlower`, `campSpeedExit` | camp speed: " Faster" (speed > 0), " Slower" (< 9), " Exit" | 0x31265, 0x3126D, 0x31275 | `FUN_3f81_1a97` | 0x318D9, 0x318E1, 0x318E9 | 0x3191B |
| `rest` | duration prompt: start, days, hours, minutes, more, less, exit | 0x3BB39 | `FUN_4b46_0721` | 0x415AA | 0x415F1 |
| `yesNo` | every other Yes/No question | 0x44B4A | `FUN_53aa_10d1` | 0x52A2D | 0x52A54 |
| `shopLeaveYesNo`, `templeLeaveYesNo`, `treasureLeaveYesNo` | the leave questions' own "~Yes ~No" (the ECL `~` rule), after `shopGoBack`, `templeGoBack`, `treasureGoBack` | 0x1FBB7, 0x1DDC5, 0x1EEF4 | `FUN_2f70_053e`, `FUN_2d14_0d09`, `FUN_2e08_0ecd` | 0x1F6C0, 0x1D405, 0x1E74A | 0x1F747, 0x1D489, 0x1E7A3 |
| `listExit` | a vertical list's " Exit" (every list the port ends with Exit) | 0x44834 | `FUN_53aa_0d9a` | 0x52709 | 0x5270F |
| `shop`, `shopNoPool` | shop, with and without money in the pool | 0x1FB74, 0x1FB9B | `FUN_2f70_053e` | 0x1F67D, 0x1F6A4 | 0x1F747 |
| `temple`, `templeNoPool` | temple, the same | 0x1DD7F, 0x1DDA7 | `FUN_2d14_0d09` | 0x1D3BF, 0x1D3E7 | 0x1D489 |
| `templeHeal` | the cures list's "Heal Exit" | 0x1DB0D | `FUN_2d14_09d7` | 0x1D1B7 | 0x1D1C1 |
| `treasureMoney`, `treasureItems`, `treasureNone`, `treasureDetect`, `treasureExit` | treasure: "View Take Pool Share" (money), "View Take Pool" (items only), "View Pool Exit" (neither); then " Detect Exit" (items, Detect Magic ready) or " Exit" | 0x1EED0, 0x1EEE5, 0x1EEAE, 0x1EEC3, 0x1EEBD | `FUN_2e08_0ecd` | 0x1E726, 0x1E73B, 0x1E704, 0x1E719, 0x1E713 | 0x1E7A3 |
| `take` | treasure Take: "Money Items Exit" | 0x1EDA7 | `FUN_2e08_0d38` | 0x1E5FD | 0x1E60E |
| `appraiseGems`, `appraiseJewelry`, `appraiseExit`, `sell`, `sellKeep` | appraise: "  Gems", "  Jewelry", " Exit"; "Sell" or "Sell Keep" | 0x3DC12, 0x3DC19, 0x3DC23, 0x3DC50, 0x3DC55 | `FUN_4c2d_19b2` | 0x43648, 0x4364F, 0x43659, 0x43686, 0x4368B | 0x436B8 |
| `battleMove` … `battleQuickDone` | combat commands: "Move ", "View Aim ", "Use ", "Cast ", "Turn ", "Quick Done" | 0x226B9, 0x226BF, 0x226C9, 0x226CE, 0x226D4, 0x226DA | `FUN_320c_0666` | 0x2244B, 0x22451, 0x2245B, 0x22460, 0x22466, 0x2246C | 0x224B8 |
| `doneGuard` … `doneSpeedExit` | Done: "Guard ", "Delay Quit ", "Bandage ", "Speed Exit" | 0x22EBE, 0x22EC5, 0x22ED1, 0x22EDA | `FUN_320c_0e45` | 0x22CEC, 0x22CF3, 0x22CFF, 0x22D08 | 0x22D33 |
| `battleSlower`, `battleFaster`, `battleSpeedExit` | combat speed: "Slower " (< 9), "Faster " (> 0), "Exit" | 0x231A1, 0x231A9, 0x231B1 | `FUN_320c_10f6` | 0x22F15, 0x22F1D, 0x22F25 | 0x22F2A |
| `aim` | "Center Exit" (after "Next Prev Manual "): the target list's Exit | 0x2D56F | `FUN_3aae_2aa0` | 0x2D566 | 0x2D577 |
| `encounterParlay`, `encounterAdvance` | encounter: "~COMBAT ~WAIT ~FLEE ~PARLAY" / "… ~ADVANCE" | 0x1BACB, 0x1BAE7 | `FUN_29c3_1ef8` | 0x1A8B0, 0x1A8CC | 0x1A90D |
| `parlay` | "~HAUGHTY ~SLY ~NICE ~MEEK ~ABUSIVE" | 0x1C1D8 | `FUN_29c3_25cb` | 0x1AFE4 | 0x1B007 |
| `doorBash`, `doorPick`, `doorKnock`, `doorExit` | locked door: "Bash", " Pick", " Knock" (each when offered), " Exit" | 0x2F4AC, 0x2F4B1, 0x2F4B7, 0x2F4BE | `FUN_3e76_0d6d` | 0x2FA6F, 0x2FA74, 0x2FA7A, 0x2FA81 | 0x2FA90 |
| `itemReady` … `itemId` | items menu: "Ready", " Use", " Trade", " Drop", " Halve", " Join", " Sell", " Id" | 0x397C3, 0x397C9, 0x397CE, 0x397D5, 0x397DB, 0x397E2, 0x397E8, 0x397EE | `FUN_4894_0ef8` | 0x3EA3E, 0x3EA44, 0x3EA49, 0x3EA50, 0x3EA56, 0x3EA5D, 0x3EA63, 0x3EA69 | 0x3EAB3 |
| `viewTrade`, `viewDrop`, `viewExit` | the view menu's "Trade ", "Drop ", "Exit" | 0x393BB, 0x393C2, 0x393C8 | `FUN_4894_0ab3` | 0x3E062, 0x3E069, 0x3E07B | 0x3E0A0 |
| `partyCreate` … `partyExit` | the party screen's functions (Create New Character … Exit to DOS; CotAB adds Human Change Classes, `partyChangeClass`, offered in the training hall: [coab/chargen-and-progression.md §2](../A-games/coab/chargen-and-progression.md#2-dual-classing-o-0x5135d)) | 0x0CDD9 + 0x2A·*i* | `FUN_417f_0161` | 0x0B133, 0x0B15D, 0x0B187, 0x0B1B1, then 0x0B205 + 0x2A·*i* | 0x36A1C |
| `modify` | Modify: "Keep Exit" | 0x33885 | `FUN_417f_209f` | 0x39076 | 0x39080 |
| `portrait` | creation's portrait picker: "Head Body Keep" (the port shows Head and Body; CotAB has no portraits and keeps the port's words) | 0x34BC8 | `FUN_417f_33e7` | — |  |
| `iconMain`, `iconHeadWeapon`, `iconParts`, `iconEdit` | icon editor levels 1, 2, 3, 5 (`DS:07BF`, CotAB `DS:0723`, + 0x29·level) | 0x0CFA8, 0x0CFD1, 0x0CFFA, 0x0D04C | `FUN_417f_382d` | 0x0B32C, 0x0B355, 0x0B37E, 0x0B3D0 | 0x3A716 |
| `iconSmall`, `iconLarge`, `iconHair`, `iconFace` | the icon editor's "Small", "Large" (level 4), "Hair", "Face" (level 3's third word) | 0x34FD0, 0x34FD6, 0x34FDC, 0x34FE1 | `FUN_417f_382d` | 0x3A6BB, 0x3A6C1, 0x3A6DA, 0x3A6DF | 0x3A716 |

The two games' menus differ in three places: CotAB's camp has Fix
([A-games/coab/camp.md](../A-games/coab/camp.md)), its rest prompt reads "Rest Days Hours Mins Add
Subtract Exit" (D days, A more, S less; PoR "Rest   daYs Hours Mins   Inc Dec   Exit", Y, I, D), and its
icon editor's colours are "1st-color" and "2nd-color" (PoR "color-1", "color-2").

Validation: `web/test/gametext.test.ts` reads every menu address of both games, checks each string's
hash with the others (`text-hashes.json`) and that each splits into the hot keys the code acts on.

## 5. Texts in the profile data

Texts that belong to a game's data rather than to a shared procedure are image addresses in that data
(the handler maps of [B-model/vocabularies.md](../B-model/vocabularies.md), the title script, the ECL
map), each the copy the cited routine prints (**O**, found as in §1):

- **Effect lines** (`effects.handlers` and `items`): the parameters `msg`, `msgs`, `death`, `gazes`,
  `reflects`, `misses`, `lost`, `resists`, `fleeMsg`, `confused`, `berserkMsg`, `enraged`, `rays`,
  `gone` hold addresses; CotAB's handlers that are PoR's carry CotAB's own copy of the line (read at
  the routine of DS:6FC0 + 4·type). PoR's 82 prints "is paralyzed with fear" (0x28DC1, read by `FUN_3723_1ba8`),
  which the port used to word "is Paralyzed".
- **Named foes** (`names`): PoR's 18 and 26 compare the monster's name with the string[15] slots at
  `DS:0342` (4) and `DS:0382` (8), 47 with the 8 slots at `DS:0402`, of which only the first five hold
  text (OGRE … HILL GIANT; the other three match nothing, as in the original), 48 with two strings in
  its own segment (0x28498, 0x284A0).
- **Spell lines** (`spells.handlers`): `msg`, `unaffected`, `immuneMsg`, `itemMsg`, Fire Shield's
  `prompt`, `abort` and its options' lines; CotAB's inherited PoR spells carry CotAB's copies (read at
  the routine of DS:72BA + 4·id).
- **The camp Display names** (`effects.names`, effect type → address): PoR `FUN_3f81_0fbc`
  (Studying Manual of Bodily Health … Displaced), CotAB 0x30DDA, a list of its own (Dispel Evil, Faerie
  Fire, Fumbling, … Minor Globe of Invulnerability, protected from dragon breath, berserk).
- **The credits** (`title.credits.lines`: row, column, colour, address): PoR's 29 strings at `290c:004B`
  … (image 0x1910B …, [title-and-credits.md](../A-games/por/title-and-credits.md)), CotAB's at
  0x1811F … (printed by 0x182AD).
- **The wipe banner** (`ecl.wipeBanner`): PoR "The END!" 0x1C35D (`FUN_29c3_2775`); CotAB none.

Validation: `web/test/gametext.test.ts` builds the merged image (checked byte for byte against
`tools/unexepack.py` + `mergeovr.py`, the stubs aside), reads every address of §4 and §5 for both games
and compares each string's SHA-256 with `text-hashes.json` (the strings were checked against the
copies they replaced before those were removed).

## 6. Still worded by the port

- **Menu words the games have no string for** (§4.1): FIX in Pool of Radiance's camp (IMP-048);
  UP and DOWN for Alter → Order (IMP-030, the original moves the highlight with Home/End and places it);
  the battle row's UNDO and END TURN (Done → Quit, IMP-054), END MOVE and Take control, Magic: On/Off;
  CONTINUE and PRESS ENTER on a single-choice prompt; "Un" before Ready on a readied item; the sheet's
  "Trade money" and "Drop money" and the amount's OK; the party screen's Continue, Watch the demo,
  Export saved game, Import saved game and Exit (to the title, where the original's is "Exit to DOS");
  the rest prompt's selected field in brackets.
- The **list prompts the port rewords** ("Spells in Memory:", "Spells to be memorized: …"), the party
  screen's groups and second lines (IMP-073), the slot dialogs ("Save in which slot?"), the icon editor (IMP-017,
  no "Is this icon ok?"), the sheet's own lines, and every text of §3.
- Messages the original builds from pieces the port has not split ("*Name* has died", "Nothing to use",
  "Use:", "Cast from scroll:", "Target for", "*Name* reacts", "*Name* misses"): no string of their own
  was found in either image; they are port wordings of the original's lines.
