# Game strings

> **Status: partial** (work-plan steps 4 and 6, [AUDIT.md](../AUDIT.md) §8). §2 (the game texts the
> screens show, both games) and §3 (the port's own texts) are written; the full list of engine
> messages with their reading routines comes in step 6 with the C24 code task. The addresses are
> normative; the strings themselves stay in the game files. Part D of the
> [specification](../README.md).

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
- Already read by address in the reference implementation: the CotAB start-up menu and demo texts
  (`START.EXE`, profile `startMenu`), the ending captions (`GAME.OVR` at the profile's `ending.cs` plus
  each caption's offset), the temple's service names (`T.templeNames`), the class, race and alignment
  names where the profile's table map gives them ([B-model/records-and-tables.md](../B-model/records-and-tables.md)).
- Everything in §2 is still copied into the code (C24): a conforming build reads it from these
  addresses instead.

## 2. Game texts the screens show

Found by searching both images for each message as a Pascal string (2026-10-21); **I** until each is
confirmed at the routine that prints it (step 6). "—" means not found as a string of its own in that
game: CotAB words it differently or builds it from parts (to be resolved in step 6). A text that is
several strings printed in turn (a name between them) is listed by its parts. Where the part C file
quotes a game text it marks it *game text* and points here.

| Text (identification only) | PoR image | CotAB image | Where it is used (part C) |
|---|---|---|---|
| "Camp:" | 0x3166B | 0x321B4 | camp prompt |
| "Save View Magic Rest Alter Exit" | 0x0CCC8 | — | camp menu (PoR) |
| "Save View Magic Rest Alter Fix Exit" | — | 0x0B00A | camp menu (CotAB) |
| "Cast Memorize Scribe Display Rest Exit" | 0x0CCF1 | 0x0B033 | magic menu |
| "Order Drop Speed Icon Pics Exit" | 0x0CD1A | 0x0B05C | alter menu |
| "Alter:" | 0x31420 | 0x31A97 | alter prompt |
| "Party Order:" | 0x30F50 | 0x315C4 | order prompt |
| "has been selected" | 0x30F7E | 0x315F2 | order: selected |
| "Drop from party?" | 0x310A2 | 0x31716 | alter drop question |
| "bids you farewell" | 0x310B4 | 0x31728 | alter drop: yes |
| "is dumped in a ditch" | 0x310C6 | 0x3173A | alter drop: yes, out of play |
| "Breathes A sigh of relief" | 0x310DB | 0x3174F | alter drop: no |
| "Game Speed =" | 0x31240 | 0x318B4 | speed prompt |
| " (0=fastest 9=slowest)" | 0x3124E | 0x318C2 | speed prompt, end |
| "Quit TO DOS" | 0x31672 | 0x321BA | camp save: quit question (not shown by the port) |
| "cannot cast spells in this area" | 0x2FB12 | 0x300D6 | spell activity refused |
| "is in no condition to" | 0x2FB32 | 0x300F6 | spell activity refused |
| "has no spells memorized" | 0x2FC99 | 0x3025D | cast: none |
| "Spells " | 0x3B2D4 (**I**; also 0x393B3) | 0x409A4 (**I**; also 0x3E05A) | list prefix, with "in Memory", "in Spell Book", "on Scrolls", "to choose from", "to be memorized", "to be scribed" |
| "in Memory" | 0x3B279 | 0x40959 | cast list |
| "in Spell Book" | 0x3B283 | — | memorize list |
| "on Scrolls" | 0x3B29B | 0x40979 | scribe list |
| "to choose from" | 0x3B2A6 | — | training spell choice |
| "to be memorized" | 0x3B2B5 | — | memorize summary |
| "to be scribed" | 0x3B2C5 | — | scribe summary |
| "Memorize These Spells?" | 0x300CF | 0x306AA | memorize confirm |
| "Scribe These Spells?" | 0x302C9 | 0x308A9 | scribe confirm |
| "You already know that spell" | 0x302F7 | 0x308D7 | scribe refusal |
| "You are already scibing that spell" | 0x30313 | 0x308F3 | scribe refusal |
| "You can not scribe that spell." | 0x30336 | 0x30916 | scribe refusal |
| "has no copyable scrolls" | 0x302DF | 0x308BF | scribe: none |
| "Funky--" | 0x306D0 | 0x30CB2 | display, unknown |
| " <No Spell Effects>" | 0x307AF | 0x30DC5 | display, none |
| "is a combat-only spell..." | 0x3F0DE | — | cast: combat-only |
| "Lose it?" | 0x3F0F8 | 0x451F0 | cast: combat-only, question |
| "Rest Time:" | 0x3BA43 | 0x414A8 | rest prompt |
| "As you Leave the Shopkeeper says" | 0x1FBC0 | 0x1F6C9 | shop leave |
| "As you leave a priest says" | 0x1DDCE | 0x1D40E | temple leave |
| "There is still treasure left." | 0x1EEFD | 0x1E753 | treasure leave |
| "Take:" | 0x1EDA0 | 0x1E5F6 | treasure take prompt |
| "cast cure anyway:" | 0x1D140 | 0x1C6E2 | temple: not needed |
| " will only cost" | 0x1D1B6 | 0x1C758 | temple: price |
| "pay for cure" | 0x1D1D5 | 0x1C777 | temple: price, end |
| "is cured." | 0x1D1F5 | 0x1C797 | temple: done |
| "No Gems or Jewelry" | 0x3DBB0 | 0x435E6 | appraise: none |
| "You have a fine collection of:" | 0x3DBF3 | 0x43629 | appraise |
| "The Gem is Valued at" | 0x3DC35 | 0x4366B | appraise: gem |
| "The Jewel is Valued at" | 0x3DC6A | 0x436A0 | appraise: jewel |
| "You can :" | 0x3DC5F | 0x43695 | appraise: choice |
| "OverLoaded" | 0x1F92E | 0x1F3A1 | take refused |
| "Drop It?" | 0x3982E | 0x3EAA9 | items: drop |
| "I'll give you" | 0x3A5CB | 0x3FC8F | items: sell offer |
| "Is It a Deal?" | 0x3A5F1, 0x3A830 | 0x3FCB5, 0x3FEF7 | items: deal |
| "Sold!" | 0x3A600 | 0x3FCC4 | items: sold |
| "For 200 gold pieces I'll identify your" | 0x3A808 | 0x3FECF | items: identify |
| "Not Enough Money" | 0x3A83F | 0x3FF06 | items: no money |
| "I can't tell anything new about your" | 0x3A850 | 0x3FF17 | items: identify, nothing |
| "It looks like some sort of" | 0x3A876 | 0x3FF3D | items: identify, result |
| "Must be Readied" | 0x39803 | 0x3EA7E | items: use unreadied |
| "Nothing Happens..." | 0x2BC37 | 0x2B765 | items: use, nothing |
| "is a combat-only item..." | 0x3F10C | 0x45204 | items: use combat-only |
| "Trade with Whom?" | 0x3A058 | 0x3F630 | items: trade |
| "is it Okay to lose it?" | 0x39698 | 0x3E3D9 | items: scroll warning |
| "uses an item" | 0x3A3B7 | 0x3F98F | items: use |
| "Trade to?" | 0x3AA5A | 0x4012A | money: trade |
| "Select type of coin" | 0x3AA66, 0x3ADB8, 0x3CF8D | 0x40136, 0x40490, 0x42A64 | money: type |
| "How much" | 0x3AA7B, 0x3ADCD, 0x3CFA1 | 0x40153, 0x404AD, 0x42A80 | money: amount |
| "Continue Battle:" | 0x2292F | 0x226D2 | combat: continue |
| "Flee:" | 0x22A91 | 0x22841 | combat: flee |
| "Move/Attack, Move Left =" | 0x22A74, 0x23B16 | 0x22824, 0x23A75 | combat: step prompt |
| "Your Teammate is Dying" | 0x22918 | 0x226BB | combat: dying |
| "Not with that weapon" | 0x22DF0 | 0x22C1E | combat: wrong weapon |
| "Blocked" | 0x22A97 | — | combat: blocked |
| "is bandaged" | 0x230B3 | 0x503A3 | combat: bandage |
| "Attack Ally:" | 0x2D46A | 0x2D461 | combat: attack ally |
| "Aim:" | 0x2D57B | 0x2D572 | combat: aim |
| "Target" | 0x2D555, 0x2D8BF | 0x2D54C, 0x2D8CA | combat: target |
| "Begins Casting" | 0x2CEE5 | 0x2CCAE | combat: begins casting |
| "Camp Only Spell" | 0x2CED5 | 0x2CC9E | combat: camp-only |
| "Abort Spell?" | 0x3F134 | 0x45235 | combat: abort |
| "Guarding" | 0x0321D | 0x4F87A | combat: guarding |
| "The party has won." | 0x1E8EC | 0x1E106 | aftermath: won |
| "The monsters rejoice for the party has been destroyed" | 0x1F557 | 0x1EE32 | aftermath: destroyed |
| "The END!" | 0x1C35D, 0x1F54E | — | aftermath / party killed banner |
| "The entire party is killed!" | 0x1C366 | 0x1B169 | party killed (outside battles) |
| "press <enter>/<return> to continue" | 0x1C382, 0x1E973, 0x1F345 | 0x1B185, 0x1E179, 0x1EBCB | continue prompt |
| "Press any key to continue" | 0x077DE, 0x1F58D | 0x0515E, 0x1EE68, 0x3CC6B | game over prompt |
| "Not Here" | 0x2F0DB | 0x2F7E6 | area refused |
| "Locked." | 0x2F4C4 | 0x2FA87 | locked door |
| "Bash" | 0x2F4AC | 0x2FA6F | locked door menu |
| "Choose a function" | 0x318D3 | 0x3697A | party screen prompt |
| "Quit to DOS" | 0x31926 | 0x369CD | party screen exit |
| "Drop " | 0x336C2 | 0x38DC5 | party screen drop |
| " forever?" | 0x336C8 | 0x38DCB | party screen drop |
| "Are you sure?" | 0x336D3 | 0x38DD6 | party screen drop |
| "You dump" | 0x336E2 | 0x38DE5 | party screen drop: out of play |
| " bids you farewell." | 0x336F7 | 0x38DFA | party screen drop: yes |
| " breathes a sigh of relief." | 0x3370B | 0x38E0E | party screen drop: no |
| " can't be modified." | 0x3385E | 0x39059 | modify refused |
| "Modify character:" | 0x33872 | — | modify prompt |
| "Is this icon ok?" | 0x3500B | 0x3A704 | icon editor |
| "Save Which Game:" | 0x37915 | 0x3623A | save prompt |
| "Do you wish to train?" | 0x34174 | 0x3B52D | training question |
| "Congratulations..." | 0x3418B | 0x3B544 | training |

Credits text, the racial handlers' monster names and the rest of the engine's messages (about 190 in
the reference's `rules/`, `vm/`, `games/` and `ui/`) are still to be listed (step 6). The script texts
(ECL) are read from the scripts already ([ecl.md](../A-games/engine/ecl.md)); the port quotes a few
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
| the groups **Play**, **Party**, **Files** and every function's label and second line (Continue "the autosave of *date*", Begin adventuring "with this party" / "add or create a character first", …) | app-flow §5 (table) |
| "*Name* has been created. Use Add to put them in the party.", "*Name* has been modified.", "*Name* joins the party.", "*Name* leaves the party (still available to Add).", "*Name* will be gone forever. Drop this character?", "*Name* has been dropped." | [screens.md §1](../C-port/screens.md#1-the-party-screens-functions) |
| "Create a character", Race, Gender, Class, Alignment, "Not open to a *Race*", "Not allowed for a *Class*", "Changing race, gender or class rolls the character again, as the original rolls after those choices. Alignment does not.", "*Class* is not open to a *Race*: now *Class*.", "*Alignment* is not allowed for a *Class*: now *Alignment*.", Reroll, Name, "up to 15 letters", Head, Body, Weapon, Size, Small, Large, Body, Arm, Leg, Hair/Face, Shield, Weapon, "Colour 1", "Colour 2", Cancel, Create, "Give the character a name." | [screens.md §1.1](../C-port/screens.md#11-create-character) |
| "Modify *Name*", Exit, Keep; "Combat icon", "old: ready, action", "new: ready, action" | screens §1.2, §1.6 |
| "Add character", "*Race Class*, level *a*/*b*", Cancel | screens §1.3 |
| "Load saved game", "Autosave: *label*", "*x*: *label*", "(conflict copy, this browser's | another device's)", "(game files): *Name*'s party", "block *b* area *a*", "There are no saved games." | [screens.md §1.7](../C-port/screens.md#17-load-saved-game) |
| "Export saved game", "Slot *x* exported: unzip it into the game folder to play it in DOSBox.", "There are no saved games in this browser.", "Slot *x* already holds a saved game. Replace it?", "*Name* is already in the roster. Replace?", "Imported into slot *x*; use Load to play.", "Added to the roster: *names*.", " Skipped: missing *files*.", "Nothing imported.", "Nothing imported; missing *files*.", "Choose a SAVGAM file (A to J) with its CHRDAT files, characters (…), or a ZIP of them.", "Import failed: *message*" | [screens.md §1.8](../C-port/screens.md#18-export-and-import) |

### 3.3 Play screen

| Text | Where |
|---|---|
| Area, Encamp, Search, Look, "☰ Menu", "Journal, commissions, save, settings, rules, quit (Esc)", "Leave demo", "Escape: back to the party screen", "Stop resting", Continue | [ui-contract.md §5](../C-port/ui-contract.md#5-the-command-bar) |
| the pad's names "Turn left", "Forward", "Turn right", "Turn around", "West", "North", "East", "South" | [ui-contract.md §4.4](../C-port/ui-contract.md#44-the-pad) |
| "*Facing* · *x*,*y* · *clock*", "Wilderness · *x*,*y* · facing *Facing* · *clock*", " · Searching" | [ui-contract.md §4.2](../C-port/ui-contract.md#42-the-view-region) |
| "Not here.", "Area map (click to enlarge)" | [ui-contract.md §4.3](../C-port/ui-contract.md#43-the-area-map) |
| the cards: "AC *n*", "HP *hp*/*max*", " (Helpless)", "✦ ", "×*n*", Quick, "Ready to train", the experience tooltips, the Quick tooltip | [ui-contract.md §4.1](../C-port/ui-contract.md#41-party-cards) |
| notes: "Blocked.", "Loaded: *label*.", "A new game: Begin Adventuring from the party screen.", "Game saved in slot *x*.", "The demo. Escape or Leave demo goes back to the party screen.", "Script error: *message*", "Combat error: *message*", "The game has ended here. Go back to Assets to start again." | [ui-contract.md §6.2](../C-port/ui-contract.md#62-the-ports-notes), [app-flow.md §7](../C-port/app-flow.md#7-play-new-game-load-continue) |
| "Save in which slot?", "*x*: *label* (*date*)", "*x*: empty", "*Name*'s party, block *b* area *a*", "(new area)", "(on the way)" | [storage.md §5](../C-port/storage.md#5-saved-games-and-the-autosave) |
| missing files: "… needs START.EXE …: re-import the *FOLDER* folder." (camp, shop, temple, training hall, wilderness, items, sound, captions) | the screens concerned |
| "Menu", "Back to the game", the entries and their second lines | [screens.md §2](../C-port/screens.md#2-the--menu) |

### 3.4 Panels

| Text | Where |
|---|---|
| the sheet: Equipped, Carried, "Nothing else.", the slot labels, "Ammunition", "Also readied", "not for this class", "Drag an item onto a name to give it:", "Encumbrance *n* of *m* coins", "Pick an item to ready, use, trade or drop it.", "Ready: …", "Unready: …", "no change to AC, THAC0, damage or movement", "Can't ready: …", "Traded to *Name*.", "That scroll is marked for scribing: use Trade to give it.", "Cast which spell?", "Cast *Spell* on:", "The item is used up.", Spells, "(combat)", "Only in combat.", Abilities, "*Ability*: heal whom?", "… cure whom?", "*Name* is not diseased. Cure anyway?", "Trade money", "Drop money", "How much *coin* will you *trade/drop*?", "On Quick: the computer plays *Name* in battle.", "Play by hand", "*Name* will be played by hand in battle.", "Space or Take control to play them yourself.", "Items need the ITEMS file and START.EXE: …" | [screens.md §3](../C-port/screens.md#3-the-character-sheet) |
| treasure: "Treasure", "Coins go to the one selected", "Coins", "Each coin counts 1 towards the load. …", Take, " slows them", "Share evenly", "Pool the party's coins", "Detect Magic (*Name*): magic items get a *", "Take all…", "Items", "usable by *names*", "no one in the party can use it", "better for *Name*: …", "cannot take things now", "Nothing left.", "Done", "*Name* takes …", "Shared; what nobody could carry is still here.", "Shared.", "The party's coins are pooled here.", "Magic items now show a *.", "A suggested split (not in the original): …", "leave it", "shared evenly", Confirm, Cancel, "No room for: *items*.", "These will be left behind:", "Leave them", "Go back" | [screens.md §4](../C-port/screens.md#4-treasure) |
| shops: "Buy", All, Weapons, Armour, Other, "Only what *Name* can use", Price, Weight, "If readied instead", "can't ready: …", "no change", "Not enough money", "Nothing here.", "*Name* buys *item*.", "*Name* has *n* gp in coins.", "Take which?", "How much *coin*?", "The pool holds *coins*.", "Healing for *Name*:" | [screens.md §5](../C-port/screens.md#5-shops-and-temples) |
| camp: "The party makes camp...", "Magic:", "Spells in Memory:" and the other list prompts as the port words them, "Memorize", "Cleric spells", "Magic-User spells", "Level *L*", "*u* of *t* slots", "Pending: tap to clear", "No spells of this level in the book.", "*Name* cannot memorize any spells.", "*n* spells to learn: rest …", "Nothing pending.", "No free slot of that level.", "Clear pending", "Display: …", "The last character cannot leave the party here.", "Monster pictures and portraits are always shown here.", Fix and its messages | [screens.md §6](../C-port/screens.md#6-camp) |
| training hall: "*Name* is selected (choose from the party list).", "Choose a function:", "The party is full.", "The party needs at least one character.", "*Name* will become:", "Spells to choose from:" | [screens.md §7.6](../C-port/screens.md#76-training-hall) |
| journal, commissions, rules reference, debug, settings: every label and message given there | [screens.md](../C-port/screens.md) §8–§12, [ui-contract.md §9](../C-port/ui-contract.md#9-settings) |
| the account section | [accounts-and-sync.md §6](../C-port/accounts-and-sync.md#6-the-account-section) |

### 3.5 Battle screen

| Text | Where |
|---|---|
| VIEW, AIM, USE, CAST, TURN, GUARD, DELAY, BANDAGE, UNDO, QUICK, END TURN, SPEED (the original's words, the port's row), "*Name*: Move Left = *n*", SLOWER, FASTER, END MOVE | [combat-ui.md §4](../C-port/combat-ui.md#4-the-command-row) |
| "Take control", "Magic: On", "Magic: Off", the two tooltips, "Debug" | combat-ui §4 |
| "Path: *n* steps, *c* of *L* movement. Tap the green square again to go.", "Can't get there (Move Left = *L*)", "Tap the yellow square again to cast there.", "*Name* (range *d*, ≈*p*% to hit, *dice*)", "there (range *d*)", " nobody in range" | [combat-ui.md §5](../C-port/combat-ui.md#5-input), §6 |
| the info box's words: "unhurt", "lightly wounded", "wounded", "badly wounded", "helpless", "coughing", "charmed", "animated", "running", "unconscious", "dying", "dead", "stoned", "gone"; "Round *n*" | [combat-ui.md §7](../C-port/combat-ui.md#7-information) |
| "*Name* is on Quick: the computer plays them. Space or TAKE CONTROL to play them yourself.", "Magic is On: …", "Magic is Off: …", "*names*: under your control again", "Nobody is on Quick", "Magic On: characters on Quick may cast spells", "Magic Off: characters on Quick will not cast spells" | [combat-ui.md §10](../C-port/combat-ui.md#10-quick-and-magic) |
| "Press Enter to continue", "Win this battle", "every enemy falls; experience and treasure as for a won fight", "Debug: battle skipped as won." | [combat-ui.md §8](../C-port/combat-ui.md#8-the-end-of-a-battle), [screens.md §12](../C-port/screens.md#12-debug) |

The original's prompts that the port rewords (for example "Healing for *Name*:", "Take which?",
"Magic:", the training hall's "Choose a function:" with a colon, "Nothing happens." for the game's
"Nothing Happens...") are port texts until step 6 decides, per message, whether the port reads the
game's string instead (C24).

## 4. To come (step 6)

- message ids and their offsets per game (START.EXE, GAME.OVR), with the routine that prints each, for
  every engine message;
- the credits, the monster-name lists of the racial handlers; ruling C24 moves them from code to reads
  by address.
