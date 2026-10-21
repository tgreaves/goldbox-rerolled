# Conformance checklist

> **Status: partial** (work-plan step 7, [AUDIT.md](AUDIT.md) §8). Normative as a checklist. The user
> interface items (below) were started with part C's UI files in step 4; rules, saves and the rest come
> in step 7.
> Part of the [specification](README.md).

A self-audit to run against a finished build: did it build the right thing? It targets the
load-bearing details that still give a working game if wrong, and covers the look of the interface
(D4), which part C states only as a behaviour contract.

## How to use it

Go through it with the build running and the player's game files imported (both games where an item
names one). Each item is answered by **looking**, not by reading code. Check the layout items in each
screen class of [ui-contract.md §3](C-port/ui-contract.md#3-screen-classes): a wide window with the
party as a row and as a column, a portrait phone (or a window at most 760 px wide), a phone held
sideways (a landscape window at most 520 px high); and each input path: mouse, touch, keyboard only.
Items marked **⚠** are details that are easy to get plausibly wrong.

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
- [ ] **E6** ⚠ Camp Alter → Icon opens the combat-icon editor (the reference does not yet, UI2).
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
      the reference frames of `web/test/view-frames.json` (1024 frames each of eleven areas, both games),
      and its frame at the end of a headless run equals the one its play screen shows at that position.
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
      their end. CotAB: every effect plays to its end (the reference cuts some, C23).

### J. Departures ([departures.md](C-port/departures.md))

- [ ] **J1** ⚠ Every departure the build makes is in departures.md, and none other: list what the
      build does differently from the original (from its own notes) and check each against the list.

## To come (step 7)

- rules and saves: byte-compatible save round trip, departures only as listed;
- autosave rules, the title and ending in detail;
- AUDIT §7, §8.1 (V13).
