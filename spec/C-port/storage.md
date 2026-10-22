---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Storage

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative.** Everything the
port keeps in the browser, and the files it reads and writes: the IndexedDB databases, the
localStorage keys, the saved games and the autosave, the roster and the party, the `.GBR` sidecar,
and export and import as ZIP or loose files. The byte layouts of the original's files are part A's
([savegame.md](../A-games/engine/savegame.md), [records.md](../A-games/engine/records.md),
[coab/records.md](../A-games/coab/records.md) §1); this file is the port's storage contract. How the
same data moves to and from a server is in [accounts-and-sync.md](accounts-and-sync.md).

Everything here is port behaviour, observed in the reference implementation (`web/src/store/`) and
normative as written. A value that comes from the game profile is named by its profile field
(`stores.files`, `saves.items` …, [B-model/profile.md](../B-model/profile.md)).

## 1. What is kept where

| Data | Where | Section |
|---|---|---|
| The player's game files (DAX archives, `START.EXE` …) | IndexedDB, the game's database `stores.files` | [§2](#2-the-game-files-database) |
| Roster characters, the party, saved games A–J, the autosave, conflict copies | IndexedDB, the game's database `stores.user` | [§3](#3-the-players-database) |
| Journal finds and commission offers | inside each saved game (`known`); in files, the `.GBR` sidecar | [§6](#6-journal-finds-and-the-gbr-sidecar) |
| Settings, the last game played, the account owner, sync bookkeeping | localStorage, one set of keys per browser | [§8](#8-localstorage-keys) |
| The app itself, for offline use | the service worker's cache | [pwa-and-build.md](pwa-and-build.md#4-the-service-worker) |

Each game has **two databases of its own**, so each has its own files, roster and saves; nothing in
them is shared between games. The localStorage keys are shared by every game ([§8](#8-localstorage-keys)).
Nothing in this file needs a network connection.

Every IndexedDB object store uses **out-of-line keys** (the key is given with each `put`; no key
path, no indexes). Binary values are `ArrayBuffer`s unless this file says otherwise. When IndexedDB
cannot be opened (storage blocked) the operation fails and the screen reports it; localStorage
failures are caught and ignored, so a setting then lasts for the page only.

### Database names

| Game | `stores.files` | `stores.user` |
|---|---|---|
| Pool of Radiance (`por`) | `poolrad` | `poolrad-user` |
| Curse of the Azure Bonds (`coab`) | `goldbox-coab` | `goldbox-coab-user` |

PoR keeps the names it had before there was more than one game, on purpose: imports and saves made
then stay where they are. A new game's profile names its own two databases, different from every
other game's.

## 2. The game files database

Database `stores.files`, **version 1**, one object store **`files`**:

| Key | Value |
|---|---|
| the file name in upper case, without any folder (`ECL1.DAX`, `START.EXE`, `CHRDATA1.SAV` …) | the file's bytes |

- **Import.** The player picks a folder (directory picker) or files. The game is detected from the
  names ([B-model/files-and-detection.md](../B-model/files-and-detection.md)) and the files that game
  keeps (profile `keep`, matched on the upper-case name) are retained; folders are flattened (CotAB
  keeps its pre-made party and first save in `SAVE/`). If any of the game's `required` files is
  missing the import stops with "Found *n* *game* files, but not the full set (the .DAX files are
  needed)." and nothing is stored. Otherwise the store is **cleared**, every kept file is written,
  and the browser is asked to make the site's storage persistent (`navigator.storage.persist()`,
  where it exists). A re-import therefore replaces a game's files as a whole.
- **Imported.** A game counts as imported when every `required` name is a key of its store; the
  values are not read for this.
- **Remove** (games screen) deletes the whole database; a deletion blocked by another open tab
  completes when that tab closes. The roster and saves are in the other database and stay: "Remove
  *game*'s game files from this browser? Its characters and saved games are kept, and come back when
  you import it again."
- **Never uploaded**, with or without an account ([accounts-and-sync.md](accounts-and-sync.md)).
- **Start-up** opens the game played last on this device (`goldbox.game`, [§8](#8-localstorage-keys))
  when its files are stored, otherwise the first game of the profile list whose files are stored,
  otherwise the games screen.

The save slots that came with the game (`SAVGAM<x>.DAT` and the `CHRDAT` files it names) are read
from this store and never copied into the player's database: Load lists them, read-only, after the
browser's own saves ([§5](#5-saved-games-and-the-autosave)).

## 3. The player's database

Database `stores.user`, **version 3**, four object stores:

| Store | Key | Value |
|---|---|---|
| `characters` | the character's file stem (`ALIAS`, `CHRDATA1` …) | `{ sav, itm?, spc? }` ([§3.1](#31-characters)) |
| `meta` | `party` | `string[]`: the party as roster stems, in order |
| | `seeded` | `true` once the roster has been seeded ([§4](#4-roster-seeding)) |
| `saves` | `A` … `J` | a stored save ([§3.3](#33-stored-saves)) |
| | `auto` | the autosave, the same shape |
| `conflicts` | the copy's id (`[a-z0-9]{1,40}`) | `{ meta, files }` ([§3.4](#34-conflict-copies)) |

**Upgrades.** On `upgradeneeded` each of the four stores that does not exist yet is created; nothing
is migrated. Version 1 had `characters` and `meta`, version 2 added `saves`, version 3 `conflicts`,
so an older database opens with its contents intact.

### 3.1 Characters

`{ sav: ArrayBuffer, itm?: ArrayBuffer, spc?: ArrayBuffer }`:

- `sav`: the character record exactly as the game writes it (PoR 285 bytes, CotAB 422): the bytes of
  a roster file `<stem>.CHA` / `.GUY` or of a slot file `CHRDAT<x><n>.SAV`
  ([records.md, "Character record"](../A-games/engine/records.md#character-record-0x11d-bytes),
  [coab/records.md](../A-games/coab/records.md) §2);
- `itm`: the item file (63-byte item records, in list order), absent when there is none;
- `spc`: the effect file (9-byte records), likewise.

The key is the stem the original uses: the name without `` .*,?/\:;|``, its first 8 characters, in
upper case ([input-and-menus.md §2.2](../A-games/engine/input-and-menus.md#22-character-files-o-fun_45c5_069e-fun_1802_0425)).
Two characters with the same stem replace each other, as in the original. The roster lists the keys
in sort order. **Drop character** deletes the entry.

### 3.2 The party and the seed flag

`meta.party` is the party the party screen shows: roster stems, at most 6. Stems
no longer in the roster are dropped when it is read. `meta.vault` (SotSB) is the vault's file, VAULT.DAT's
bytes as the original writes it in its folder: one per game, outside the save slots, written each time the
vault screen is left; until then the imported folder's VAULT.DAT, if any, is read. It is synced as
`folder/VAULT` ([accounts-and-sync.md §1.3](accounts-and-sync.md#13-what-each-kind-holds)). `meta.seeded` is written `true` after the first
seeding; deleting the database clears it, so seeding runs again.

### 3.3 Stored saves

```ts
{
  dat: ArrayBuffer          // SAVGAM<x>.DAT exactly (PoR 13 137 bytes, CotAB 13 149)
  chars: { sav: ArrayBuffer; itm?: ArrayBuffer; spc?: ArrayBuffer }[]   // per member, in party order
  label: string             // shown on Load (§5)
  savedAt: number           // when it was written, ms since 1970
  known?: string[]          // journal finds and commission offers (§6)
  sidecar?: { rest: object; version?: number }   // the .GBR's other fields and a newer version, kept (§6)
}
```

The members' stems are not stored separately: they are the stem table inside `dat`
([savegame.md](../A-games/engine/savegame.md#savgamxdat-layout-o)), and `chars[i]` belongs to the
*i*-th stem. The slot letter is the key. The autosave is the key `auto`, and wherever a slot letter
is needed it is slot `A`: its `dat` names the stems `CHRDATA1` …, and in a record its files are named
for slot A ([accounts-and-sync.md §1.3](accounts-and-sync.md#13-what-each-kind-holds)).

### 3.4 Conflict copies

`{ meta: object, files: { name: string; data: Uint8Array }[] }` (these hold `Uint8Array`s): a sync
record exactly as [accounts-and-sync.md, "Records"](accounts-and-sync.md#12-records) defines it,
with the conflict fields of [§5.7](accounts-and-sync.md#57-resolving-a-clash) in `meta`. Only the sync
makes them. The Account section lists them newest first (by `keptAt`) with **Restore** and **Delete**;
a copy of a save is also offered on Load. Restore asks "Put this copy back in slot *x* | in the
autosave, replacing what is there now?" (for a character without the slot clause), writes the copy in
place of the current save, autosave or character, then deletes the copy. A copy whose record cannot
be read back (a save without its `.DAT` or a member's `.SAV`, a character without its roster file)
is not listed.

## 4. Roster seeding

IMP-016 ([IMPROVEMENTS.md](../../IMPROVEMENTS.md)). Each time the party screen opens, and after each
sync merge that changed records:

1. if `meta.seeded` is `true`, stop;
2. for every stored game file `CHRDAT<rest>.SAV` whose stem `CHRDAT<rest>` is not a roster key yet:
   store it as a roster character, with `CHRDAT<rest>.<saves.items>` and `.<saves.effects>` when
   those files exist, and report it to the sync as a **seed**, not a change (a seeded character never
   wins over the server's copy, [accounts-and-sync.md §5.3](accounts-and-sync.md#53-noting-changes));
3. set `meta.seeded = true`.

So the characters of the save slots that came with the game (PoR's `CHRDATA1`–`6` and `CHRDATJ…`,
CotAB's pre-made party) are in the roster from the first run, under their slot stems.

## 5. Saved games and the autosave

**Slots.** Ten slots `A`–`J` (IMP-002). Saving (☰ → Save, camp → Save, or Save in a training hall's
party menu) asks "Save in which slot?", each slot shown as `<x>: <label> (<date and time>)` or
`<x>: empty`, then writes:

- `dat`: the engine's state in the game's `SAVGAM<x>.DAT` layout, with the party stems
  `CHRDAT<x>1` … `CHRDAT<x><n>`;
- per member: its record, and its items and effects as files (an empty list gives no file);
- `label`: `<first member's name>'s party, block <b> area <a>`;
- `savedAt`: now; `known`: every id found so far in this play ([§6](#6-journal-finds-and-the-gbr-sidecar)).

The write replaces the slot; then "Game saved in slot *x*.". The demo saves nothing (IMP-074).

**Autosave** (IMP-060): its own record, key `auto`, never one of A–J. It is written after each
action of the exploration loop has finished (never while a script runs), when the party is not
empty, the game has not ended and it is not the demo, and either the party's block and area differ
from the last autosave's or 30 seconds have passed since the last one was attempted. Its label is
`<first member's name>'s party, block <b> area <a> (new area | on the way)`; its party stems are
`CHRDATA1` … A failed write (storage full or unavailable) is ignored and the game goes on.

**Load** lists, in this order: the autosave ("Autosave: *label*"), the slots A–J that hold a save
("*x*: *label*"), conflict copies of saves ("*x* | Autosave (conflict copy, this browser's | another
device's): *label*"), and the game files' own `SAVGAM<x>.DAT` whose party files are all present
("*x* (game files): *name*'s party"), each with its date, or its block and area for the game files'
saves. **Continue** on the party screen loads the autosave and is offered only when there is one.
Loading brings the save's `known` back into play.

The bytes written, and loading, are part A's ([savegame.md](../A-games/engine/savegame.md)): a save
written by the port and loaded by the original, or the other way round, is the same game. Of the
bytes the original never reads, the effect records' next pointers and the stem table after each
Pascal string and beyond the party count are written as 0; an item record is written as it is held,
its stale next pointer included (as read from the file, 0 in an item made in play). A loaded save
written back is therefore byte-for-byte the same except those bytes (moved here from part A's
savegame.md, 2026-10-21; [records-and-tables.md §1](../B-model/records-and-tables.md#1-records-stay-native) rule 3).

## 6. Journal finds and the `.GBR` sidecar

**`known`.** The port remembers what the game's own text has revealed, for the Journal (IMP-055)
and the Commissions panel (IMP-023, PoR). It is a set of strings, kept in the order found:

| Id | Revealed by | Meaning |
|---|---|---|
| `journal:<n>` | "…ENTRY *n*", "ENTRIES *n* AND *m*", "(ENTRY *n*)" on a screen | journal entry *n* of the game's journal data |
| `tale:<n>` | "TAVERN TALE *n*", "TAVERN TALE #*n*" | tavern tale *n* |
| `proc:<roman>` | "PROCLAMATION *CI*.", "PROCLAMATIONS *LXIV, …*" | proclamation *roman* (PoR) |
| `proclamations` | a text starting "PROCLAMATIONS ARE POSTED ON THE WALLS" | the proclamation wall has been read (PoR) |
| a commission id: `slums`, `sokal`, `documents`, `podal`, `textile`, `braccio`, `kovel`, `nomads`, `kobolds`, `river`, `lizardmen`, `bivant`, `graveyard`, `zhentil`, `gate`, `assault` | a text starting with that commission's offer | the clerk has offered it (PoR) |

Only entries the game's journal data has are added. The matching rules and the port-authored data
behind them (the offers, the journal) belong to the screens ([screens.md](screens.md)) and the port
data ([D-appendices/port-data.md](../D-appendices/port-data.md)). For storage the ids are opaque
strings, and a reader keeps ids it does not know.

**Where it is kept.** In the browser, as `known` of the stored save ([§3.3](#33-stored-saves)). In a
server record and in an exported ZIP, as the sidecar **`SAVGAM<x>.GBR`** beside `SAVGAM<x>.DAT`: the
original files are never extended, and the original game never opens this one.

**The sidecar** is one JSON object in UTF-8, written without whitespace:

```json
{"format":"goldbox-rerolled-save","version":1,"known":["journal:30","slums","proc:CI"]}
```

| Field | Type | Rule |
|---|---|---|
| `format` | string | `"goldbox-rerolled-save"`; a file with any other value (or not JSON) is ignored |
| `version` | number | `1` (`SIDECAR_VERSION`), the version the writer knows; see the version rule below |
| `known` | string[] | the `known` list; elements that are not strings are dropped on reading |

- It is written only when `known` is not empty or there are kept fields (below): a save without
  finds has no `.GBR`, and a save without one (or with an unreadable one) loads with an empty list.
- **Matching** is by name only: `SAVGAM<x>.GBR` belongs to the `SAVGAM<x>.DAT` with the same slot
  letter in the same set of files (one ZIP, one choice of files, one server record).

**The version rule.** A reader takes every field it knows (`format`, `version`, `known`) and keeps
every other field as it is. A missing `version`, or one not above the reader's own, reads as the
reader's. One above it is still loaded, never refused: the play screen's log says once, after
"Loaded: …", "This save's port data (.GBR) comes from a newer GoldBox Rerolled: what this version
does not know is kept as it is." The kept fields and a newer version travel with the saved game
(the stored save's `sidecar`, [§3.3](#33-stored-saves); the load and every save made from it) and are
written back unchanged, the known fields after them and `version` the larger of the two, so data
that a newer build wrote survives a save in an older one. The original files are untouched either
way.

## 7. Export and import

IMP-006: a saved game moves between the port, DOSBox and another browser as the original's files.

### 7.1 Export

Party screen → **Export saved game** lists the slots A–J that hold a save ("There are no saved
games in this browser." when none; the autosave is not offered) and downloads, for the one chosen, a
ZIP named **`<saves.exportName>-<x>.zip`** (PoR `poolrad-save-<x>.zip`, CotAB `curse-save-<x>.zip`;
[B-model/records-and-tables.md](../B-model/records-and-tables.md)) holding, in this order:

1. `SAVGAM<x>.DAT`;
2. for each member *i*, with `stem` the *i*-th stem of the `.DAT` (`CHRDAT<x><i>` if the table is
   shorter): `<stem>.SAV`, `<stem>.<saves.items>` and `<stem>.<saves.effects>` (PoR `.ITM` / `.SPC`,
   CotAB `.SWG` / `.FX`). The item and effect files are **always written**, zero bytes long when the
   character has none (the original reads them to the end of the file, so an empty file is an empty
   list);
3. `SAVGAM<x>.GBR` when `known` is not empty.

Names are at the root of the ZIP, without folders. Then: "Slot *x* exported: unzip it into the game
folder to play it in DOSBox."

### 7.2 Import

Party screen → **Import saved game** takes any number of files: ZIPs, whose entries join the set,
and loose files (the picker offers `.zip`, `.dat`, `.sav`, `.txt`, the game's item, effect and roster
extensions, and those of the games it imports characters from). Every name is taken without its
folder and compared in upper case; a ZIP's own name does not matter (an export of
any game, including the earlier `poolrad-save-<x>.zip` of every game, is read). Three things are looked for:

1. **Saved games.** Each `SAVGAM<x>.DAT` (*x* in A–J): its party stems are read from it; for each,
   `<STEM>.SAV` is required and `<STEM>.<saves.items>` and `.<saves.effects>` are taken when present.
   A `.DAT` that does not parse is skipped ("SAVGAM*x*.DAT (not a saved game)"); a missing `.SAV`
   skips the save and is reported. The save gets the label `<first member's name>'s party
   (imported)`, `savedAt` now, and `known` from `SAVGAM<x>.GBR` when present, and goes into slot *x*;
   when that slot holds a save the player is asked "Slot *x* already holds a saved game. Replace it?".
2. **Roster characters** as a DOS install keeps them: with `CHARLIST.TXT` present, the stems of the
   names it lists (one per line, stem rule of [§3.1](#31-characters)); otherwise every
   `<stem>.<saves.roster>` (PoR `.CHA`, CotAB `.GUY`). The roster file must be at least one character
   record long and only that record's bytes are kept; `.<saves.items>` and `.<saves.effects>` are
   taken when present. A listed stem without a usable file is reported missing.
3. **Characters from another game** the active game takes (profile `imports`; CotAB takes PoR's):
   that game's roster files and the save-slot files matching its slot pattern, those the import
   accepts, converted as the original's Add converts them ([coab/records.md](../A-games/coab/records.md)
   §7, [B-model/procedures.md](../B-model/procedures.md)). A roster file brings its old effect file
   `<stem>.SPC` along when that stem is the name's stem. Each is added under the stem of its name,
   unless step 2 found that stem already.

Every character found goes into the roster; one whose stem is there already is replaced only after
"*name* is already in the roster. Replace?". The result is one message: "Imported into slot *x*, *y*;
use Load to play." and/or "Added to the roster: *names*.", followed by " Skipped: missing *files*."
when something was missing; when nothing was found, "Nothing imported; missing *files*." or the hint
"Choose a SAVGAM file (A to J) with its CHRDAT files, characters (.*roster* with .*items* and
.*effects*[ and charlist.txt]), or a ZIP of them." (the charlist clause for PoR's `.CHA` only); and
"Import failed: *reason*" when a ZIP cannot be read.

### 7.3 ZIP format

**Writer** (this export, and the server's data export, [accounts-and-sync.md §4.5](accounts-and-sync.md#45-the-data-export)):
PKZIP 2.0 with every entry **stored** (method 0): no compression, data descriptors, extra fields,
comments or ZIP64. Local header: signature `0x04034B50`, version needed 20, flags 0, method 0, the
DOS time and date of writing in local time, CRC-32 (reflected polynomial `0xEDB88320`), compressed
size = size, name length, extra length 0, then the name and the data. The central directory has one
entry per file in the same order (version made by 20, version needed 20, the same fields, the local
header's offset), then the end record (`0x06054B50`, disk numbers 0, the entry counts, the
directory's size and offset, comment length 0). The server's writer sets flag `0x0800` (UTF-8 names)
in both headers, the browser's sets no flag; the names are ASCII, so both read the same everywhere.

**Reader**: finds the end record by searching back from 22 bytes before the end for `0x06054B50`
("not a ZIP file" when there is none); reads as many central directory entries as it gives ("damaged
ZIP file" for an entry without `0x02014B50`); takes each entry's data at its local header offset + 30
+ the *local* header's name and extra lengths, as many bytes as the central directory's compressed
size. Names ending in `/` (folders) are skipped. Method 0 is copied; method 8 (deflate) is inflated
where the browser has `DecompressionStream('deflate-raw')`; anything else fails with "*name*:
unsupported compression". CRCs are not checked; encryption, ZIP64 and multi-disk archives are not
supported.

## 8. localStorage keys

Every key the port uses. Values are strings; a missing or unrecognised value means the default (the
first value listed). "Synced" keys travel with an account
([accounts-and-sync.md §5.9](accounts-and-sync.md#59-settings)); nothing else does.

| Key | Values | What | Synced |
|---|---|---|---|
| `poolrad.sound` | `pc`, `tandy`, `off` | sound device (IMP-046; the original's `POOL.CFG` choice) | yes |
| `poolrad.font` | `original`, `modern` | the game's 8 × 8 font for the interface, or a modern font (IMP-038) | yes |
| `poolrad.frames` | `original`, `modern` | window borders from the game's frame tiles, or plain ones (IMP-051) | yes |
| `poolrad.partylayout` | `top`, `side` | party cards in a row across the top, or a column beside the view (IMP-064) | yes |
| `poolrad.view` | `original`, `enhanced` | the 3D view: the original's drawn view, or the WebGL view (IMP-001, D6) | yes |
| `poolrad.motion` | unset, `full`, `reduced` | reduced motion (IMP-057); unset follows the system's `prefers-reduced-motion` | yes |
| `poolrad.textsize` | `normal`, `large` | text size | yes |
| `poolrad.gfx` | `pixel`, `sharp` | picture scaling (IMP-047); read once per page load, so a change applies after a reload | yes |
| `goldbox.game` | a profile id (`por`, `coab`) | the game played last on this device; written whenever a game is opened | no |
| `goldbox.account` | an account name | whose data this browser holds: the last account signed in here ([accounts-and-sync.md §5.10](accounts-and-sync.md#510-owners-switching-signing-out-forgetting)) | no |
| `goldbox.sync.<game id>` | JSON | that game's sync bookkeeping ([accounts-and-sync.md §5.2](accounts-and-sync.md#52-sync-state)) | no |

- A setting is written when the player changes it in Settings, not before: an untouched browser has
  none of the `poolrad.*` keys.
- **One set of settings for every game.** The `poolrad.*` keys (the PoR-era prefix serves every
  game) are read by whichever game is open; there are no per-game setting keys. With an account each
  game's settings record on the server holds these same keys, so the settings last merged from any
  game apply to every game in that browser (AUDIT C22; [accounts-and-sync.md §5.9](accounts-and-sync.md#59-settings)).
- The game speed is not a browser setting: it is part of the game state, saved with the game.
- sessionStorage is not used.

## 9. Other browser storage

- **Cache Storage**, used by the service worker for the app's own files
  ([pwa-and-build.md](pwa-and-build.md#4-the-service-worker)); never game files or player data.
- **Persistent storage** is requested after each game import ([§2](#2-the-game-files-database)); the
  port works whether or not the browser grants it.
- **Cookies**: only the server's session cookie, when there is a server
  ([accounts-and-sync.md §3.3](accounts-and-sync.md#33-sessions-and-the-cookie)).

## 10. Removing data

| Action | Removes | Keeps |
|---|---|---|
| Games screen → Remove | the game's `stores.files` database | its `stores.user` database, all of localStorage |
| Party screen → Drop character | that roster entry | everything else |
| Account → Sign out and remove this browser's copy | every game's `stores.user` database, every `goldbox.sync.*`, `goldbox.account` | the game files, the `poolrad.*` settings, `goldbox.game` |
| Signing in as an account other than `goldbox.account` | every game's `stores.user` database and every `goldbox.sync.*`; the new account's records are then fetched | as above |
| Account → Delete account | every `goldbox.sync.*`, `goldbox.account` | all IndexedDB data: the browser's copy stays, linked to no account |

## Validation

- `web/test/savefiles.test.ts`: the save round trip (a loaded save written back byte-identical
  except the never-read bytes), the sidecar, export and import naming, both games' extensions.
- `web/test/sync.test.ts`, "records: the original formats": a saved game with its sidecar as a
  record, roster characters under each game's extensions.
- Results are recorded in [VALIDATION.md](../VALIDATION.md).

## Open

- ~~The sidecar's `version`~~: the version rule (§6), 2026-10-22.
