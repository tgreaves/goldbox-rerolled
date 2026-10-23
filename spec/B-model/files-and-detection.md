# Game files and detection

> **Status: complete** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative, except passages
> marked *informative*. Part B of the [specification](../README.md).

Which of the player's files the port needs and keeps, how it recognises which game a set of files
belongs to, and where it keeps them. The import screen and its messages are part C
([C-port/app-flow.md](../C-port/app-flow.md)); the browser databases' layout is
[C-port/storage.md](../C-port/storage.md). The files themselves are part A
([engine/containers.md](../A-games/engine/containers.md), [por/README.md, "Files"](../A-games/por/README.md#files),
[coab/assets.md §2](../A-games/coab/assets.md#2-inventory)).

## 1. Detection

The player gives the port a folder (a folder picker, subfolders included) or a set of files. File
names are compared **upper-cased**, and only the base name counts (subfolders are flattened: CotAB
keeps its pre-made party and first save in `SAVE/`).

1. Drop every file that **no** known game keeps (§2).
2. The game is the first in the list of games (PoR, then CotAB; a later game appends itself) whose
   **configuration file** (`config`) is among the names.
3. Failing that, the first game with any of its **markers** (`markers`: files only it has) among the
   names.
4. Failing that, the files are not a game the port knows: nothing is imported.
5. Of the remaining files, keep those the detected game keeps (§2).
6. The import is complete only if every **required** file (§2) is present; otherwise nothing is
   stored and the player is told which set is incomplete.

| Game | `config` | `markers` (why: [coab/assets.md §2](../A-games/coab/assets.md#2-inventory)) |
|---|---|---|
| PoR | `POOL.CFG` | `GEO1.DAX`, `SQRPACI.DAX`, `BACPAC.DAX` (CotAB has no GEO1, SQRPACI or BACPAC) |
| CotAB | `CURSE.CFG` | `SKY.DAX`, `BIGPIC1.DAX`, `TILES.DAX` (new in CotAB) |

A new game's markers MUST be files that no earlier game in the list has, and its configuration
file's name MUST differ from theirs. A player who asked to import one game and gave another's files
gets the files imported as the game they are (part C says how this is shown).

## 2. Required and kept files

`keep` is a list of patterns over the upper-cased name (regular expressions, anchored as written);
a file is kept when any pattern matches. `required` is the minimum set for the port to start.

| Game | `keep` | `required` |
|---|---|---|
| PoR | `\.DAX$`, `^ITEMS$`, `^START\.EXE$`, `^GAME\.OVR$`, `^POOL\.CFG$`, `^CHRDAT.+\.(SAV\|ITM\|SPC)$`, `^SAVGAM.\.DAT$` | `ECL1.DAX`, `GEO1.DAX`, `8X8D1.DAX`, `WALLDEF1.DAX` |
| CotAB | `\.DAX$`, `^ITEMS$`, `^START\.EXE$`, `^GAME\.OVR$`, `^CURSE\.CFG$`, `\.(GUY\|SWG\|FX)$`, `^CHRDAT.+\.SAV$`, `^SAVGAM.\.DAT$` | `ECL1.DAX`, `GEO2.DAX`, `8X8D1.DAX`, `WALLDEF2.DAX`, `SKY.DAX` |

What each kept file is for, and what happens without it:

| File | Used for | Without it |
|---|---|---|
| `*.DAX` | everything the game draws and runs (scripts, maps, walls, pictures, monsters, items of encounters) | the required ones block the import; a missing optional family shows nothing for it |
| `START.EXE` | the rules tables (the table map), names, spell records, the sound driver, the start-up menu's strings, every game text read by address | names show as `#n`, messages as `#` and their address, the credits without lines; combat, camp, shops, temples, creation and sound cannot run, and say which file to import |
| `ITEMS` | the item types table ([engine/records.md, "Item types"](../A-games/engine/records.md#item-types-items-o)) | combat, camp, shops and temples cannot run |
| `GAME.OVR` | the ending's captions ([profile.md §3.5](profile.md#35-the-ending-endingscript)) and the overlay strings: most engine messages ([D-appendices/strings.md](../D-appendices/strings.md)) | the ending shows no captions and says so; a message from an overlay shows as `#` and its address ([strings.md §1](../D-appendices/strings.md#1-how-to-read-a-string)) |
| the configuration file | the long-intro flag ([profile.md §3.2](profile.md#32-the-title-titlescript)) | the long intro is shown |
| `CHRDAT*`, `*.GUY/.SWG/.FX` | the game's own characters: the pre-made party and roster ([records-and-tables.md §4](records-and-tables.md#4-save-files-savefiles)) | no pre-made characters to add |
| `SAVGAM?.DAT` | the game's own save slots, offered by the party screen's Load | none offered |

How the kept characters and saves are offered (seeding the roster, the save list) is part C
([C-port/storage.md](../C-port/storage.md)).

## 3. Per-game stores

Each game has two browser databases, named in its profile (`stores`):

| Store | Holds | PoR | CotAB |
|---|---|---|---|
| `files` | the kept game files: one object store `files`, key the upper-cased file name, value the file's bytes | `poolrad` | `goldbox-coab` |
| `user` | the player's roster, party, saves and autosave ([C-port/storage.md](../C-port/storage.md)) | `poolrad-user` | `goldbox-coab-user` |

PoR keeps the names it had before there was more than one game, so existing imports and saves stay
where they are; a new game's names are `goldbox-<id>` and `goldbox-<id>-user`.

- **Saving** an import replaces the game's stored files with the new set (the store is cleared
  first), then asks the browser to keep the site's storage persistent.
- **Removing** a game deletes its `files` database only: its characters and saves stay, and come back
  when it is imported again.
- A game is **stored** when every required file is in its `files` store (checked by the keys alone).
- At start-up the port opens the game played last if it is stored, else the first stored game in the
  list, else the import screen ([C-port/app-flow.md](../C-port/app-flow.md)).

## 4. The asset viewer's families

`imageFamilies` lists the DAX families the asset viewer shows, in order; a family the player's files
lack is left out, and GEO maps follow when present ([C-port/screens.md](../C-port/screens.md)).

| Game | `imageFamilies` |
|---|---|
| PoR | TITLE, PIC, FINAL, SPRIT, HEAD, BODY, CHEAD, CBODY, CPIC, ICON, COMSPR, SQRPACI, BACPAC, DUNGCOM, WILDCOM, RANDCOM, 8X8D |
| CotAB | TITLE, BIGPIC, SKY, PIC, SPRIT, HEAD, BODY, CHEAD, CBODY, CPIC, COMSPR, DUNGCOM, WILDCOM, RANDCOM, TILES, 8X8D |

A family name stands for its numbered files (`PIC1.DAX` … `PIC8.DAX`); the record formats are part A
([engine/graphics.md](../A-games/engine/graphics.md)).

**Which numbered file.** A picture of a family is read from `<family><block>` unless the profile's
`pictureFiles` names a fixed file for it: a list of `{ family, digit, records }` (records null: every
record), the first match winning. The 3D view's pictures and sprites, the combat icons and the ending
read through it.

| Game | `pictureFiles` |
|---|---|
| PoR, CotAB | none |
| SotSB | SPRIT → 1; PIC 0x06, 0x3B, 0x3C, 0x42, 0x45, 0x47, 0x59 → 4; PIC 0x01, 0x11, 0x4D, 0x1B → 5; CPIC → 1 ([sotsb/assets.md §1](../A-games/sotsb/assets.md#1-graphics-inventory-o)) |

## 5. What is not imported

*Informative.* The GOG release's macOS package (`.pkg`) is not read: the player gives the game's
folder or its files ([C-port/overview.md](../C-port/overview.md)). Nothing from the game files is
uploaded: an account syncs the player's characters and saves, never the game files
([C-port/accounts-and-sync.md](../C-port/accounts-and-sync.md)).
