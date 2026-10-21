# Conformance checklist

> **Status: complete** (work-plan steps 4 and 7, [AUDIT.md](AUDIT.md) §8). Normative as a checklist.
> Part of the [specification](README.md).

A self-audit to run against a finished build: did it build the **right** thing? A build can pass its
own tests and play well while quietly diverging from the original or from part C, because the details
that diverge still give a working game. These are the **load-bearing details**; nothing errors when
they are wrong, so only a deliberate check finds them. Items marked **⚠** are the ones known to have
been got wrong in practice, in this project's own reference implementation (the finding or commit
that corrected it is named): the easiest ones to get plausibly wrong.

## How to use it

Go through it with the build running and the player's game files imported (both games where an item
names one). Each item is answered by **looking** or **running**, not by reading code: the interface
items (A–J) with the build on screen; the rules and engine items (K–R) by running the build's test
vectors and headless harness ([D-appendices/test-vectors.md](D-appendices/test-vectors.md),
[B-model/host-contracts.md §8](B-model/host-contracts.md#8-the-headless-harness)) or by playing to the
place the item names. Check the layout items in each screen class of
[ui-contract.md §3](C-port/ui-contract.md#3-screen-classes): a wide window with the party as a row and
as a column, a portrait phone (or a window at most 760 px wide), a phone held sideways (a landscape
window at most 520 px high); and each input path: mouse, touch, keyboard only.

## User interface (D4)

### A. Flow ([app-flow.md](C-port/app-flow.md))

- [ ] **A1** First run with nothing imported: the games screen lists every game with Import, and
      **Choose a game folder** is the main action; the version line is at the foot.
- [ ] **A2** Importing a folder of the wrong game imports it as that game and says so; an incomplete
      folder stores nothing and says what is missing.
- [ ] **A3** A returning player lands on the title of the game played last.
- [ ] **A4** The title advances on any key or tap and by itself; "Press any key or tap to continue" is
      under the picture; with Motion = Reduced there is no lightning.
- [ ] **A5** ⚠ The party screen shows exactly three groups, **Play**, **Party**, **Files**, with the
      functions of [app-flow.md §5](C-port/app-flow.md#5-the-party-screen); no Train, no Save; each
      button has its second line, and a disabled one says why.
- [ ] **A6** ⚠ **Continue** appears only when an autosave exists and is then the main action; **Load**
      is always enabled and lists the autosave first.
- [ ] **A7** CotAB: **Watch the demo** runs the demo; Escape or **Leave demo** returns to the party
      screen at once; nothing is saved (no autosave appears afterwards).
- [ ] **A8** ☰ → **Quit to the party screen** returns to the party screen; **Continue** then resumes
      from the autosave.
- [ ] **A9** A party destroyed outside a battle shows the game's two lines, a single Continue, then the
      party screen.

### B. Layout per screen class ([ui-contract.md §3](C-port/ui-contract.md#3-screen-classes))

- [ ] **B1** Wide, row: the cards in one row across the top, the view a square on the left with the
      area map beside it, the text log full width, the commands and pad at the bottom.
- [ ] **B2** Wide, column: the view on the left, the cards above the map on the right.
- [ ] **B3** Narrow: the view on top, then cards beside a small map, then the text, then the commands.
- [ ] **B4** ⚠ Phone landscape: the view on the left, everything else on the right; **no area map**,
      and **Area** is on the command bar.
- [ ] **B5** Battles: the battlefield replaces the view and the map; in the wide row layout it spans
      the whole width under the cards; no pad, no location line.
- [ ] **B6** On a touch screen every control is at least 44 px high.

### C. Command bar and input ([ui-contract.md §5](C-port/ui-contract.md#5-the-command-bar), [§8](C-port/ui-contract.md#8-input-map))

- [ ] **C1** ⚠ Exploring, the bar holds **Encamp, Search, Look, ☰ Menu** (and Area only in phone
      landscape): no View, no Cast, no Area elsewhere.
- [ ] **C2** The keys A, V, C, E, S, L and the arrows (and 8/4/6/2) do what [§8.1](C-port/ui-contract.md#81-exploring-nothing-pending-no-dialog-no-script-running)
      says; Escape opens ☰.
- [ ] **C3** A tap on the left, middle and right thirds of the 3D view turns left, moves, turns right.
- [ ] **C4** A tap on a card selects it; a tap on the current card opens its sheet.
- [ ] **C5** Holding a movement key moves as fast as the scripts allow (the slide is cut short).
- [ ] **C6** A key or tap cuts a script pause short; a single-item prompt answers to Enter, Space or a
      tap on the view.
- [ ] **C7** A menu answers to its first letters and to digits 1–9.
- [ ] **C8** Every panel has a ✕ and closes with Escape.

### D. Text log ([ui-contract.md §6](C-port/ui-contract.md#6-the-text-log))

- [ ] **D1** Each new screen of game text starts a block; earlier blocks are dimmed; the log scrolls
      back.
- [ ] **D2** The port's notes ("Blocked." …) look different from game text (the quiet colour).
- [ ] **D3** The game's continue prompts appear as one wide **Continue** button.

### E. Screens ([screens.md](C-port/screens.md))

- [ ] **E1** Creation on one screen: forbidden classes and alignments greyed with the reason; changing
      race, gender or class rerolls, alignment does not.
- [ ] **E2** The sheet shows equipment by slot and the carried items; picking an item shows what
      readying it would change; the actions are buttons in the original's order.
- [ ] **E3** The treasure panel: per-member give buttons greyed with the reason; **Take all…** proposes
      a split that can be changed; leaving with treasure left asks first.
- [ ] **E4** Buy: filters, "If readied instead", Buy greyed with the reason.
- [ ] **E5** Memorize: ready, pending and empty slots per level; the rest needed is shown.
- [ ] **E6** Camp Alter → Icon opens the combat-icon editor on the selected character (UI2 resolved).
- [ ] **E7** The Journal reveals entries only when the game's text names them; "Show everything"
      shows all.
- [ ] **E8** PoR: the Commissions panel lists offered commissions with their state; ☰ shows a dot
      when a reward is due.
- [ ] **E9** Settings has exactly the rows of [ui-contract.md §9](C-port/ui-contract.md#9-settings);
      Graphics asks for a reload; the version line is there.

### F. Battle ([combat-ui.md](C-port/combat-ui.md))

- [ ] **F1** ⚠ The window shows at least 7 × 7 cells and more when there is room, centred on whoever
      acts.
- [ ] **F2** ⚠ No MOVE command while movement is live: the arrows, a tap on a neighbour or a planned
      walk take steps; Escape undoes them.
- [ ] **F3** One command row with the Done choices (GUARD, DELAY, BANDAGE when someone is dying,
      UNDO after steps, QUICK, END TURN, SPEED).
- [ ] **F4** Reachable squares are lightly filled; an area spell previews its squares and casts on a
      second tap.
- [ ] **F5** Aim lists only valid targets, nearest first, with "≈" odds.
- [ ] **F6** **Take control** appears only while someone is on Quick; **Magic** shows On or Off and
      starts Off in every battle.
- [ ] **F7** The summary is a block in the text log with one Continue, the battlefield still in view.
- [ ] **F8** A key or tap cuts a combat message's hold short.

### G. The look ([rendering.md](C-port/rendering.md))

- [ ] **G1** ⚠ Every colour is an EGA colour used by its role ([ui-contract.md §2](C-port/ui-contract.md#2-colours-as-roles));
      corners are square.
- [ ] **G2** ⚠ Borders = Original rope: the panels are framed with the game's own tiles (PoR's yellow
      squares and red rope, CotAB's white frame), each dividing line drawn once.
- [ ] **G3** ⚠ Font = Original 8×8: all play-screen and panel text is the game's font, capitals only,
      sharp at 16 px (24 px large).
- [ ] **G4** Graphics = Pixel: pictures are hard-edged blocks; Sharp: even, slightly soft squares.
- [ ] **G5** The battlefield shows black as dark grey and dark grey as black (the battle palette).

### H. The views ([exploration-view.md](C-port/exploration-view.md))

- [ ] **H1** ⚠ The drawn view matches the original pixel for pixel (V9): the build's frame hashes equal
      the reference frames (`view-frames.json`, 1024 frames each of eleven areas, both games; a
      clean-room build has it in its golden hashes), and its frame at the end of a headless run equals
      the one its play screen shows at that position. (The reference had no drawn view at all until
      UI1.)
- [ ] **H2** With the 3D view: the same walls as the drawn view, the walls' own art, the original's
      sky and floor colours, an encounter sprite in front of the first wall and nearer at each
      approach.
- [ ] **H5** ⚠ Settings → View offers Original (the default in a new browser) and Enhanced (3D); a change
      applies at once in play, at the same position, with the sprite on show; the drawn view has no
      slides, shows CotAB's sun, clouds and ground in its frame, and an approaching sprite's smaller
      frames at its fixed place.
- [ ] **H6** The drawn view scales with Graphics (Pixel: hard blocks; Sharp: even soft squares), black
      around it, and a tap on its thirds turns or steps as on the 3D view.
- [ ] **H3** The area map shows the whole area, doors in their colours, the party's arrow, the
      landmarks; "Not here." where the original refuses Area.
- [ ] **H4** PoR wilderness: the 5 × 5 tile view, compass pad, the party icon animating; CotAB
      overland: the map picture with the blinking city cursor.

### I. Sound ([audio.md](C-port/audio.md))

- [ ] **I1** Changing Sound plays a sample; Off is silent; Tandy sounds different from PC speaker.
- [ ] **I2** ⚠ PoR: footsteps and the bump are short; the sparkle, the skull and spell sounds play to
      their end. CotAB: every effect plays to its end. (The reference cut by effect number, not by call
      site, until C23 and UI8: see O1.)

### J. Departures ([departures.md](C-port/departures.md))

- [ ] **J1** ⚠ Every departure the build makes is in departures.md, and none other: list what the
      build does differently from the original (from its own notes) and check each against the list.

## Rules and engine

### K. Data-driven, game text by address ([B-model/](B-model/), D1)

- [ ] **K1** ⚠ Every text the build shows that is in the game's files is read from them by address
      ([strings.md](D-appendices/strings.md)); none is a copy in the build. Check: patch one letter of
      a message, a spell line and a menu word in a copy of `START.EXE` / `GAME.OVR`, import it, and see
      the change on screen; and the build's texts read by address match the text hashes. (About 190
      engine messages, the credits and the name lists were copies until C24; the revive lines and the
      money prompts still were after it, AP1, AP2.)
- [ ] **K2** ⚠ No procedure branches on the game: what differs is profile data or a procedure the
      profile names ([adding-a-game.md](B-model/adding-a-game.md)). Check: CotAB's ADD_NPC makes no draw
      and does not put monster 0x18 on the enemy side (EM4); CotAB's battles away from a map use the
      wilderness generator with CotAB's own passes and no finishing pass (`d3180b3`, `df1b288`); the
      debug jump's wilderness areas come from the profile, not PoR's 25–27.
- [ ] **K3** Every table is read through the table map from the player's `START.EXE`; a table the
      game lacks (`at` = −1) behaves as [records-and-tables.md §3.3](B-model/records-and-tables.md#33-tables-a-game-lacks)
      says; the V1 table hashes match ([expected-values.md §7](D-appendices/expected-values.md#7-decoded-files-and-tables-v1)).
- [ ] **K4** Records stay in each game's layout: CotAB's 422-byte record with its own offsets, the
      field map's −1 fields never written; a PoR character imported into CotAB as
      [procedures.md §13](B-model/procedures.md#13-character-import) says.

### L. Dice (D2)

- [ ] **L1** ⚠ Every draw that can change the game goes through the one injected dice source: record a
      tape of a battle and replay it, and the transcript is the same line for line. (Party-screen
      creation used the browser's own random numbers, EM1; RANDOM, a new NPC's id and appraisal's
      jewels drew past the source, EM2.)
- [ ] **L2** ⚠ Draws the original makes and then drops are still made: the starting-money dice of a
      game with a fixed amount (CotAB), both of CotAB's hit-point rolls, the computer's item d7 every
      turn (EM11). Check: the `creation`, `hitPoints` and `headless.run` battle vectors pass.
- [ ] **L3** The order of requests is the original's: every S, E and F vector passes, and a replayed
      tape never diverges.
- [ ] **L4** `Random(n)` is the request (1, n) − 1; presentation draws (the title's lightning, the
      river cleansing's pixels, the sound cut-off phase) are not on the tape.

### M. Rules as the original, quirks kept ([README](README.md#how-to-read-this-spec), rule 1)

- [ ] **M1** ⚠ The original's bugs are reproduced unless [IMPROVEMENTS.md](../IMPROVEMENTS.md), "Original
      bugs fixed", lists a fix: interrupting a spell takes it from the attacker's memory, not the
      caster's; Protection from Evil gives only its save bonus; a Lightning Bolt comes straight back off
      a wall and is shortened by its cumulative cost at each creature (IMP-034); a diagonal step with
      exactly 2 half-squares left ends the move ([combat-rules.md, "Known original bugs"](A-games/engine/combat-rules.md#known-original-bugs-affecting-combat)).
- [ ] **M2** ⚠ Only the listed fixes are made (IMP-028, IMP-031, IMP-048, IMP-049, IMP-075), and each
      one as written: a payment reads all the coins, a kept gem is always added, a magic-user level with
      no spell to choose keeps its maximum HP, Alter → Drop refuses the last character.
- [ ] **M3** ⚠ CotAB's quirks: from a class's stop level the fixed hit points **replace** the sum so
      far; the CON bonus on the death save is **added** to the stored number (a harder save); every thief
      skill gets the leftover bonus 7; Cloudkill's zones are matched through Stinking Cloud's table read
      on for nine entries ([procedures.md](B-model/procedures.md), the `hitPoints` and `derive` vectors).
- [ ] **M4** ⚠ Effect handlers compute what the original computes: effect 7's CON hit-point gain and
      effect 62's power 0xFF (PA2); effect 82's save bonus only for a side of six or more (PA3); energy
      drain's level and HP loss (`e03f4ff`); Haste and Slow "Cured" the opposite effect (`fbfd583`); grab
      and blood drain let go once (`dc7e7ce`); PoR handlers 10, 20, 61, 113, 117, 122 and the spells
      that keep the dice count (`186434b`, `4285aef`).
- [ ] **M5** ⚠ The event lists run each type's handlers in the original's order for the game
      (`a27e80e`); ECL DAMAGE rolls once for every victim and CotAB's flag 0x10 still damages on a save
      (`af55eaf`).
- [ ] **M6** ⚠ Battlefields: a CotAB cell costs its byte 0 (× 3 diagonally, × 2 straight) and the
      attacks of opportunity come before the step's cost test (EM5); PoR's wilderness passes and CotAB's
      map-area generator with its furnishing are the originals' (`79626cf`, `e764eeb`); the
      `battlefield.*` vectors pass.
- [ ] **M7** ⚠ Gas clouds: a caster's zones are numbered as the original counts them and an
      overlapping cloud keeps the cell the other found (`4ca4614`); the `combat.spell` cloud vectors
      pass.
- [ ] **M8** ⚠ The computer uses items in combat (`FUN_3334_03e4`, CotAB 0x2356A), and its spell
      choice keeps the original's quirks (Cure Light Wounds accepted with an enemy adjacent and nobody
      hurt, then aborted) (EM11).
- [ ] **M9** Game speed scales every wait as the original: script pauses speed × 225 ms in PoR and
      × 100 ms in CotAB, combat messages, hit and miss flashes, step waits (`6c2389e`); the outcome never
      depends on a wait's length.

### N. Saves and storage ([C-port/storage.md](C-port/storage.md))

- [ ] **N1** ⚠ The original's save files load and are written back byte-compatible (V2): load the
      shipped `SAVGAMA.DAT` of each game, save to a slot, export, and compare: identical except the
      never-read bytes (item records keep their stale pointer bytes, effect next pointers are 0, PA1).
- [ ] **N2** Port-only data (the journal finds) is in the `.GBR` sidecar only, never in the original's
      records; a save without a sidecar loads with no finds.
- [ ] **N3** The autosave is its own record, written after an action of the exploration loop (an area
      change or 30 s since the last), never while a script runs and never into A–J; the demo writes
      nothing.
- [ ] **N4** The export ZIP is named for the game (PoR `poolrad-save-…`, CotAB `curse-save-…`, SY8) and
      import reads a ZIP of any name.

### O. Sound ([C-port/audio.md](C-port/audio.md))

- [ ] **O1** ⚠ The cut-off is by **call site**, not by effect number: in PoR a hit, a miss, the bump,
      the footsteps and the script's CALL sound are cut short, and everything else plays to its end;
      CotAB cuts nothing. (The reference cut by effect number, so PoR's CALL sound played in full and
      CotAB's 7, 9, 10 and 13 were cut: C23, UI8.)
- [ ] **O2** The `sound.driver` vectors pass (the port writes per tick, both devices, both games);
      Ctrl-S mutes and unmutes as in the originals.

### P. Scripts ([B-model/script-vm-map.md](B-model/script-vm-map.md))

- [ ] **P1** A sweep of every area from every third square runs with no interpreter error, both games
      (V4); the `headless.run` vectors pass (V3).
- [ ] **P2** The script variables are read and written in the canonical numbering through each game's
      regions; CotAB's opcode variants are its own (DIVIDE by 0 writes 0 and 0 in CotAB, stops PoR).
- [ ] **P3** ⚠ ADD_NPC: in PoR monster 0x18 joins on the enemy side and a class is picked for the
      random portrait; in CotAB neither, and no draw (EM4).

### Q. Title, start-up and ending

- [ ] **Q1** ⚠ PoR's title sequence keeps the original's timings, lightning and credits (`bfc28e1`);
      CotAB's start-up menu, its demo and the ending captions read from its files.
- [ ] **Q2** The translation wheel is not asked (IMP-068 for CotAB, IMP-076 for PoR); both are in
      [departures.md](C-port/departures.md).

### R. Accounts and sync, when the build has a server ([C-port/accounts-and-sync.md](C-port/accounts-and-sync.md))

- [ ] **R1** ⚠ A session renewed by use sends its cookie again, so an active player is not signed out
      one lifetime after signing in (SY2).
- [ ] **R2** The reference's server and sync suites pass against the build's server (V11); the
      client syncs against the reference server's API alone (V12).
- [ ] **R3** Two devices changing the same save: the newer change wins and the other is kept as a
      conflict copy; nothing is lost ([§5.7](C-port/accounts-and-sync.md#57-resolving-a-clash)).
