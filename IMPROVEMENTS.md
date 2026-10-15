# Improvements over the original

Every deliberate departure from the 1988 DOS game goes here, so the port's behaviour can always be traced back to the original described in [`spec/`](spec/README.md).

- **Status**: planned, in progress, done
- **Toggle**: whether a setting restores the original behaviour (needed for anything that changes gameplay or difficulty)

| ID | Area | Improvement | Original behaviour | Toggle | Status |
|---|---|---|---|---|---|
| IMP-001 | Exploration | Real 3D view rendered from the GEO maps, with smooth movement and turning | 88×88 view assembled from pre-drawn 8×8 tiles ([`spec/maps.md`](spec/maps.md)) | Classic view later, once its spec gap is closed | in progress |
| IMP-002 | Saving | Save anywhere, plus quicksave | Saving only from the camp menu and the party screen ([`spec/camp.md`](spec/camp.md)) | Yes (changes difficulty) | planned |
| IMP-003 | Interface | Mouse and touch for every menu and screen; in the 3D view, an on-screen movement pad and tap zones (left third turns left, middle moves, right third turns right) | Keyboard only ([`spec/graphics.md`](spec/graphics.md), menu input loop) | No | in progress |
| IMP-004 | Interface | Responsive layout keeping the original arrangement (3D view, party roster to the right, text below, command line at the bottom); on narrow screens the panels stack | Fixed 320×200 screen ([`spec/graphics.md`](spec/graphics.md), "Screen layout") | No | in progress |
| IMP-005 | Platform | Runs offline as an installable web app or a single file; game files imported once and kept in the browser | DOS executable reading files from its folder | No | in progress |
| IMP-006 | Saving | Saves exported and imported as original `SAVGAM*.DAT` files | Files in the game folder | No | planned |
| IMP-007 | Exploration | 3D scene lit with ambient and directional light, a sky colour, a grey floor and distance fog. Walls use the nearest front-wall piece of each wall type (kind 6) as a texture | Flat background bands drawn by `FUN_55a0_0174` from colours at `DS:6A60–6A63` (source of those colours not yet traced); pre-drawn walls per distance | No | in progress |
| IMP-008 | Interface | Scrollable message log: each `PRINT_CLEAR` starts a new block instead of wiping the window, and the last 120 blocks are kept; short feedback for blocked moves ("Blocked.", "Locked.") | Six-line text window that clears; a bump sound only | No | in progress |
| IMP-009 | Interface | Party roster rows are clickable: select a character, click again for the character sheet in a dialog | Character chosen with keys; separate full-screen View | No | in progress |
| IMP-010 | Interface | Script menus become buttons in the command bar (first letter still the hotkey); one-item "PRESS <RETURN> OR BUTTON TO CONTINUE" prompts become a Continue button (Enter, Space, or a tap on the view); vertical menus become a tappable list | Keyboard-driven menu line on row 24 ([`spec/ecl.md`](spec/ecl.md), HMENU/VMENU) | No | in progress |
| IMP-011 | Exploration | Script-driven moves (e.g. Rolf's tour) animate between squares instead of jumping | Each `CALL 0x2C90` redraws the new square | No | in progress |
| IMP-012 | Interface | Script pauses (opcode 0x3A, game speed × 225 ms) can be skipped with a click, a tap on the view or any key | Pauses always run to the end | No | in progress |
| IMP-013 | Sound | Effects come from the original driver data in the player's `START.EXE`, emulated tick by tick with the PC speaker, and are played without pausing the game; on/off switch | `PlaySound` busy-waits about 0.1 s while a cut-off effect plays ([`spec/sound.md`](spec/sound.md)) | Sound on/off | done |
| IMP-014 | Sound | A footstep each time an encounter sprite approaches (e.g. Rolf walking up) | `APPROACH` redraws the sprite silently | Sound on/off | in progress |
| IMP-015 | Sound | Sound device chosen in the game (PC speaker, Tandy/PCjr, off), switchable at any time; the Tandy chip is emulated (approximate noise) | Chosen once in the installer, stored in `POOL.CFG` ('P' or 'T'); Ctrl-S mutes ([`spec/sound.md`](spec/sound.md)) | Is the setting | done |
| IMP-016 | Party | Created characters are kept in browser storage (the roster), seeded once with the characters from the imported files | Each character is written to  in the save directory and listed in  ([](spec/menus.md) §2.2) | No | done |
