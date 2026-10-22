---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Application flow

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative** (D4: the
behaviour contract). The top-level screens a player passes through, what each offers, and what moves
between them: start-up, the games screen and importing, the title, the party screen, play (new game,
load, continue, the autosave), the demo, the ending, the party destroyed, and every way back. The
panels inside these screens are in [screens.md](screens.md), the layout and input conventions in
[ui-contract.md](ui-contract.md).

Observed in the reference implementation (`web/src/main.ts`, `ui/title.ts`, `ui/party.ts`,
`ui/explore.ts`, `ui/ending.ts`, **O**) unless marked. Texts in quotation marks are the port's and
normative (listed in [strings.md §3](../D-appendices/strings.md#3-port-texts)) unless marked *game
text*.

## 1. The state machine

```
            ┌───────────── no game stored ─────────────┐
 start ─────┤                                          ▼
            └── last game stored ──► open(game) ◄── games screen ◄──────────────┐
                                        │  (Play / after an import)             │
                     playable? ─ no ──► asset viewer ── "Games and files…" ─────┤
                        │ yes                                                   │
                        ▼                                                       │
                      title ──(all screens shown, or skipped)──► party screen ──┤ "⇄ Games"
                        ▲                                          │  │  │  ▲    │
                        └──────────────── Exit (E) ────────────────┘  │  │  │    │
                                                                      │  │  │    │
             Begin (B) / Continue (O) / Load (L) ──► play ────────────┘  │  │    │
                         ☰ Quit · party destroyed · game over ──►────────┘  │    │
             Watch the demo (W) ──► demo ── Leave demo / Escape / its end ──┘    │
             Assets ──► asset viewer ── "◀ Party screen" ─► party screen         │
                                     └── "Games and files…" ─────────────────────┘
```

| State | Entered from | Leaves to |
|---|---|---|
| start-up | page load | open(game) or the games screen (§2.1) |
| games screen | start-up (no game stored), party screen "⇄ Games", asset viewer "Games and files…", Remove | open(game) by Play or after an import |
| open(game) | start-up, games screen | title (playable game) or asset viewer (assets only) |
| title | open(game), party screen Exit | party screen |
| party screen | title, play, demo, asset viewer | play, demo, title, games screen, asset viewer |
| play | party screen: Begin, Continue, Load | party screen |
| demo | party screen: Watch the demo | party screen |
| asset viewer | open(game) for an assets-only game, party screen Assets | party screen (when opened from it), games screen |

Panels (Settings, Account, the character sheet …) open over these screens and return to them; they
are not states of this machine. The ending ([§8](#8-the-ending)) and the party destroyed ([§9](#9-the-party-destroyed-and-the-game-over))
happen inside play.

## 2. Start-up and the games screen

### 2.1 Start-up

1. Apply the stored text size, party layout and graphics class ([ui-contract.md §9](ui-contract.md#9-settings)).
2. Register the offline app (PWA build; [pwa-and-build.md §4](pwa-and-build.md#4-the-service-worker)).
3. Open the game played last on this device (`goldbox.game`) when its files are stored; otherwise the
   first game of the profile list whose files are stored; otherwise show the **games screen**
   ([storage.md §2](storage.md#2-the-game-files-database)). A returning player therefore lands on the
   title of the game they played last.

**Opening a game** (`open`): remember it as the last game; start the account's sync for it when signed
in ([accounts-and-sync.md §5.4](accounts-and-sync.md#54-when-it-runs)); set the page title to
"GoldBox Rerolled: *game name*"; read the item name words from `START.EXE`; build the game font and
the frame tiles from `8X8D1` ([rendering.md](rendering.md) §4–§5); then the **title** for a playable
game, or the **asset viewer** for one that is not.

### 2.2 The games screen

Page title "GoldBox Rerolled". One centred column:

1. The heading "GoldBox Rerolled".
2. The explanation: "This port plays the SSI Gold Box games from the game files of your own copy
   (MS-DOS), for example the game's folder from the GOG release (the data files and `START.EXE`,
   which holds the sound effects and the rules tables). They stay on this device: nothing is
   uploaded, and after importing once the game works offline."
3. The **Account** box, when a server answers ([accounts-and-sync.md §6](accounts-and-sync.md#6-the-account-section));
   absent without a server.
4. One row per game the port knows, in profile order (Pool of Radiance, Curse of the Azure Bonds):
   the game's name, then in the quiet colour "imported", or "not imported: choose its *FOLDER*
   folder" (the profile's `folder`, `POOLRAD`, `CURSE`), then " · *note*" when the profile has one
   (CotAB: "early: being built, expect gaps"), then " · assets only" for a game that is not
   playable. Its buttons:

   | Button | Shown | Does |
   |---|---|---|
   | **Play** (main; **View** for an assets-only game) | imported | "Loading *name*…", then open(game) |
   | **Import** / **Re-import** | always (Re-import when imported) | "Choose the *FOLDER* folder of *name*.", then the folder picker (§3) |
   | **Remove** (quiet; tooltip "Forget this game's files (characters and saves are kept)") | imported | the confirmation "Remove *name*'s game files from this browser? Its characters and saved games are kept, and come back when you import it again." (OK / Cancel); on OK the game's files database is deleted ([storage.md §10](storage.md#10-removing-data)) and the screen redrawn |

5. **Choose a game folder** (the main action when no game is imported) and **Choose files**
   (tooltip "For browsers without a folder picker").
6. A status line (quiet) for the import's progress and errors (§3).
7. The version line at the foot ([pwa-and-build.md §6](pwa-and-build.md#6-the-version-stamp)).

First run: no game is imported, so the screen shows only the Import buttons and the two choosers,
with **Choose a game folder** as the main action.

## 3. Importing game files

The folder picker (or the file picker of **Choose files**) delivers a set of files; folders are
flattened. Then, with messages on the status line:

| Step | Status line |
|---|---|
| reading | "Reading files…" |
| no known game in the names ([B-model/files-and-detection.md](../B-model/files-and-detection.md)) | "These are not the files of a game the port knows (Pool of Radiance, Curse of the Azure Bonds)." Stop |
| a game other than the one whose Import was pressed | "These are *found* files, not *expected*: importing them as *found*." and carry on |
| a required file missing | "Found *n* *game* files, but not the full set (the .DAX files are needed)." Stop; nothing is stored |
| storing | "Saving *n* *game* files for offline use…" |
| done | open(game): the title of the imported game |

The kept files replace the game's store as a whole ([storage.md §2](storage.md#2-the-game-files-database)),
and persistent storage is requested. Nothing is uploaded, with or without an account.

## 4. The title

The game's title sequence from its profile (`title`, [B-model/profile.md](../B-model/profile.md)):
PoR [input-and-menus.md §1](../A-games/engine/input-and-menus.md#1-start-up-sequence) steps 4–6,
CotAB [coab/assets.md §7](../A-games/coab/assets.md#7-start-up-title-copy-protection-o).

- **Screens**: the `first` screens always; the `long` screens and the credits when line
  `title.configLine` of the game's configuration file (`POOL.CFG` line 5, `CURSE.CFG` line 4) starts
  with `F`, or when the file is missing. Each screen shows its `TITLE` records (the first sets the
  picture's size, the rest are drawn over it at their positions) for its time: PoR 5 s, 5 s, credits
  10 s; CotAB 5 s, 10 s, 10 s (sound 13 at the third), credits 10 s.
- **The PoR lightning** on the second screen: palette register 1 cycles 9, 11, 15, 11, 9, 1 with
  holds of 150, 100, 50, 100, 150 ms, two to four times a burst, a burst 0.5–2 s after the screen
  starts and then every 1–3 s (**I**: the original's rate depends on the CPU). Left out with reduced
  motion ([ui-contract.md §10](ui-contract.md#10-motion-focus-and-accessibility)). Its random draws
  are presentation only (D2).
- **The credits** are drawn on a 320 × 200 canvas: PoR's two rope boxes, CotAB's screen frame with
  its dividers ([rendering.md §4](rendering.md#4-frames)), and the credit lines in the game font in
  their colours (the lines: [title-and-credits.md](../A-games/por/title-and-credits.md), CotAB
  [coab/assets.md §7](../A-games/coab/assets.md#7-start-up-title-copy-protection-o); read by address, [strings.md §5](../D-appendices/strings.md#5-texts-in-the-profile-data);
  without `START.EXE` the frame alone).
- **Layout**: the picture centred, as large as fits (at most 96 % of the width), whole-pixel scaled,
  with "Press any key or tap to continue" below it (IMP-050).
- **Input**: any key, click or tap ends the current screen and shows the next; the screen also
  advances by itself when its time is up. After the last screen: the **party screen**. The first key
  or tap unlocks the sound.
- **Not shown**: the original's copy-protection checks (PoR's translation wheel, which the PoR
  binary accepts anything at, IMP-076, [title-and-credits.md](../A-games/por/title-and-credits.md);
  CotAB's, IMP-068) and CotAB's start-up menu (Play / Demo, IMP-074).

## 5. The party screen

The original's "Choose a function" screen ([input-and-menus.md §2](../A-games/engine/input-and-menus.md#2-party-screen-fun_417f_0161)),
regrouped (IMP-073). Each time it opens, the roster is seeded from the game files once
([storage.md §4](storage.md#4-roster-seeding)), then the roster, the party and the autosave are read
from the player's database.

**Layout** (one centred column, [ui-contract.md §3.3](ui-contract.md#33-the-party-screen-and-the-games-screen)):

1. A header: the game's name; on the right the **Account** button (only with a server,
   [accounts-and-sync.md §6](accounts-and-sync.md#6-the-account-section)), **⇄ Games** (tooltip
   "Switch game, import another, or remove one"), **⚙ Settings** and **Assets**.
2. **Party**: one card per member (portrait, combat icon; name; race and class; "level *a*/*b* · AC
   *n* · *status*"; an HP bar; "HP *hp* / *max*"), the current one highlighted; or "No characters in
   the party. Create or Add one."
3. A message line (game-text colour, a polite live region): each action's result.
4. The functions in three groups, each button with its label (hotkey letter underlined in the
   highlight colour) and a quiet second line: what it does, or, when disabled, why. The original's
   functions are labelled as its function table names them (*game text*, read by address,
   [strings.md §4.1](../D-appendices/strings.md#41-menus)); Continue, the demo, Export, Import and Exit
   are the port's.

| Group | Function (key) | Enabled when | Second line (enabled / disabled) | Does |
|---|---|---|---|---|
| **Play** | **Continue** (O), main action | shown only when an autosave exists | "the autosave of *date and time*" | play the autosave (§7) |
| | **BEGIN Adventuring** (B), main action when there is no autosave | the party is not empty | "with this party" / "add or create a character first" | a new game (§7) |
| | **Load Saved Game** (L) | always (IMP-019) | "slots A–J" | the load list ([screens.md §1.7](screens.md#17-load-saved-game)) |
| | **Watch the demo** (W) | shown only for a game with a demo (CotAB) | "the game's own demo" | the demo (§6) |
| **Party** | **Add Character to Party** (A) | fewer than 6 members and someone in the roster not in the party | "from your roster" / "the party is full" or "no one else in the roster" | [screens.md §1.3](screens.md#13-add-character) |
| | **Create New Character** (C) | `START.EXE` readable | "roll a new one" / "needs START.EXE: re-import the game" | [screens.md §1.1](screens.md#11-create-character) |
| | **Remove Character from Party** (R) | the party is not empty | "back to the roster" / "no one in the party" | [screens.md §1.4](screens.md#14-remove-and-drop) |
| | **View Character** (V) | the party is not empty | "the selected one" / "no one in the party" | [screens.md §1.5](screens.md#15-view-character) |
| | **Modify Character** (M) | the party is not empty and `START.EXE` readable | "abilities and hit points" / "no one in the party" | [screens.md §1.2](screens.md#12-modify-character) |
| | **Drop Character** (D) | the party is not empty | "delete for good" / "no one in the party" | [screens.md §1.4](screens.md#14-remove-and-drop) |
| **Files** | **Export saved game** (X) | always | "as the original's files" | [screens.md §1.8](screens.md#18-export-and-import) |
| | **Import saved game** (I) | always | "from the original or an export" | [screens.md §1.8](screens.md#18-export-and-import) |
| | **Exit** (E) | always | "to the title" | the title (§4) |

Train and Save, which this screen never offers at start-up, are left out; Exit goes to the title,
not to DOS. The training hall's party screen is a different screen, inside play
([screens.md §7.6](screens.md#76-training-hall)).

**Input**:

| Input | Action |
|---|---|
| a function's letter (any case) | that function, when enabled; a disabled letter does nothing |
| ArrowDown / ArrowUp | the next / previous party member becomes current (wrapping); the original's Home/End |
| a click or tap on a card | select it; on the current card, View |
| a click on a function | that function |
| ⇄ Games, Assets | the games screen, the asset viewer |
| ⚙ Settings | the Settings panel without the game speed row ([ui-contract.md §9](ui-contract.md#9-settings)) |

While a dialog is open the letters go to the dialog (Y/N, E/K, digits for list entries;
[ui-contract.md §7](ui-contract.md#7-dialogs)). When the sync brings new records from the server,
the screen reseeds and redraws (unless a dialog is open).

## 6. The demo

For a game whose profile has a demo (`startMenu.demo`: CotAB ECL1 #82, speed 9). Watch the demo (W)
replaces the original's start-up menu and its 30-second timer (IMP-074).

1. Play starts with fresh variables and no party ([B-model/host-contracts.md §3.1](../B-model/host-contracts.md#31-life-cycle),
   `newDemo`), the note "The demo. Escape or Leave demo goes back to the party screen." and the
   command bar holding only **Leave demo**. No pad, no Debug, no ☰.
2. The demo's script runs (`runDemo`). Menus and inputs answer at once (the first choice, 0, "")
   because the demo's key reads do not wait; pauses run (a key or tap cuts one short); a battle runs
   without "Continue Battle:" and without its aftermath, as the original's demo.
3. It ends at the script's end, or at once on **Leave demo** or Escape (the running pause is
   abandoned and the script stopped); either way back to the **party screen**. Nothing is saved, no
   journal entry is revealed, no autosave is written.

## 7. Play: new game, load, continue

| Start | From | Engine | First note |
|---|---|---|---|
| **new** | Begin adventuring | `newGame(party)`: fresh variables, the party copied in, the profile's start block and record, each member's item and effect files attached | "A new game: Begin Adventuring from the party screen." |
| **load** | a save chosen in Load | `loadSave(dat, party)` and the member files; the save's journal finds (`known`) restored | "Loaded: *label*." (`slot *x*, *label*`, `autosave, *label*`, `conflict copy of …`, `game-file save *x*`) |
| **continue** | Continue | as load, with the autosave | "Loaded: autosave, *label*." |

Then play begins (`start()`: the area's entry, [main-loop.md](../A-games/engine/main-loop.md)) and
the play screen ([ui-contract.md §3.1](ui-contract.md#31-exploring)) takes commands.

**Saving during play**: ☰ → Save, camp → Save, a training hall's Save: "Save in which slot?" with the
ten slots ([storage.md §5](storage.md#5-saved-games-and-the-autosave)); "Game saved in slot *x*."
Save anywhere is IMP-002.

**The autosave** (IMP-060, [storage.md §5](storage.md#5-saved-games-and-the-autosave)): written after
each finished action of the exploration loop (never while a script runs) when the party is not empty,
the game has not ended and it is not the demo, if the party's block and area differ from the last
autosave's ("new area") or 30 s have passed since the last attempt ("on the way"). A failed write is
ignored. **Continue** on the party screen and the top of the Load list read it.

**Leaving play**: ☰ → **Quit to the party screen** asks first, a panel "Quit" with "Quit to the party
screen? The game was last saved automatically *n* s ago; anything since then is lost unless you save
first." and **Yes** / **No** (No, Esc or ✕ go back to the game); Yes leaves without saving (the last
autosave is the way back, **Continue**). A game already over, or the demo, leaves at once. The view, its animation loop and the key
handlers stop; the party screen opens.

**Script and engine errors** are notes ("Script error: *message*", "Combat error: *message*"); play
stays usable. When the engine has quit (a script's quit, `engine.quit`), the note "The game has
ended here: ☰ Menu, Quit to the party screen, to start again." is shown and movement does nothing; ☰
still works.

## 8. The ending

PROGRAM 8 ([B-model/profile.md §3.5](../B-model/profile.md#35-the-ending-endingscript)) opens the
**ending panel** (IMP-036), a dialog over the play screen:

- the game's name as heading; a picture of 120 × 120 (PoR `FINAL<block>`; CotAB `PIC` and `BIGPIC`
  records at their own sizes) scaled up whole-pixel to at most 360 px and 80 % of the width; the
  captions below it, read from `GAME.OVR` by offset (D1: profile `ending`, [strings.md §2](../D-appendices/strings.md#2-game-texts-the-screens-show));
  a **Continue** button.
- **PoR** (`FUN_4804_02a4`, [por/ending.md](../A-games/por/ending.md)): caption group 1 with `FINAL`
  #1 and the animation #2 at (16, 32); #3 with the extra figures #4–#6 for the second to fourth member;
  group 2 with the animation #7 at (16, 0); group 3 with #8 played once; then a wait for Continue, a
  key or a click.
- **CotAB** (`0x3D02C`): the profile's steps, captions, pictures and "press a key" waits in order.
- Animation timing: a frame stays (game speed + 3) × its delay × 10 ms; an animation loops
  ((10 − speed) × 5) / 2 times. **A key, a click on the picture or Continue skips the current
  animation** (its last frame stays) or ends a wait; Escape does the same.
- Without `GAME.OVR` the captions read "The captions need GAME.OVR: re-import the *FOLDER* folder."
- When the panel closes, with no `ending.after` (PoR), the script goes on (PoR: the walk back to New
  Phlan). With one (CotAB, PROGRAM 8 at 0x1B9AD): its variables are set (ECL 0x4CFD, 0x7EA8 := 0xFF), every
  member is restored (HP at maximum, Okay, in play), the in-game party screen opens with **Begin** left out (the original switches its entry off)
  of its functions while `won` is set (0x36DCD; a party, not the demo) and its **Exit** offered in its
  place, the original's way out (**I**: the original's Exit quits to DOS itself); when it is left, the game's
  question "You've won. Save before quitting?" (0x1B92B) with Yes and No; Yes opens Save. Then the game
  ends as for "Quit TO DOS": the port's way out is the party screen ([screens.md §6.1](screens.md#61-the-camp-menu)).

## 9. The party destroyed and the game over

- **Outside battles** (DAMAGE leaves nobody in play, `engine('party dead')`): the engine's banner
  (PoR "The END!", *game text*) and "The entire party is killed!" (*game text*) in a new block, then a
  single-item menu "CONTINUE" with the prompt "Press any key to continue" (*game text*); on it, the
  **party screen** (IMP-035). Nothing is saved; the last autosave and saves remain.
- **In a battle** that the party loses (destroyed): the battle's summary ([combat-ui.md §8](combat-ui.md#8-the-end-of-a-battle)),
  then the same game-over prompt and the party screen.
- The original then runs the main loop with an empty party (**?**); the port's return to the party
  screen, where Load and Continue are, is IMP-035.

## 10. The asset viewer

The delivery-step-1 viewer, for checking the decoders against the player's files and for games that
are not yet playable:

- a list of the game's image families present in its files (profile `imageFamilies`) and **GEO**,
  as buttons (a drop-down on narrow screens); **◀ Party screen** when opened from the party screen;
  "*name* is in progress: its assets can be viewed, not yet played." for an assets-only game; "Sound
  needs START.EXE: re-import the *FOLDER* folder to include it." without `START.EXE`; **Games and
  files…** (the games screen);
- the chosen family's records: every image record's frames (animated ones animate, `PIC` and `FINAL`
  with their delta frames), labelled "*FILE* #*id*"; GEO records drawn as maps. Records that are not
  images are skipped.

The viewer is a tool and not part of the game; its layout is informative.

## 11. Update prompt

When a new version of the offline app is waiting, any screen shows the bar "A new version is
available." with **Reload** and **Later** ([pwa-and-build.md §4](pwa-and-build.md#4-the-service-worker)).
The page never reloads by itself; a player in a game should save (or rely on the autosave) before
Reload.

## Validation

- Headless Chromium against the reference (2026-10-21): first run on an empty profile (the games
  screen with the Account box), an import of PoR's files by **Choose files**, the title, the party
  screen with no party, Load of the game files' slot A, the play screen.
- [CONFORMANCE.md](../CONFORMANCE.md), "User interface", A1–A9.

## Open

- ~~PoR's translation-wheel screen~~: settled as IMP-076 ([departures.md §6](departures.md#6-departures-without-an-imp-row)).
- ~~Quit to the party screen asks nothing~~: it asks (Tristan, 2026-10-22).
