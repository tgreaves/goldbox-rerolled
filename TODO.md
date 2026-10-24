# To do

What is not yet done or not yet checked, across the games. Questions about the originals are kept in
[`spec/open-questions.md`](spec/open-questions.md) and each spec file's "Open" section; each game's step
log and status are in [`docs/multi-game.md`](docs/multi-game.md). An item leaves this list in the commit
that settles it.

## Next steps (2026-10-23, in order)

1. **SotSB in its order through block 3** (`sotsbchain.test.ts`, hints in `sotsbchain-hints.json`): block
   3 is reached in order since 2026-10-23 (3/80 from the shipped start; the riddles answered, the ruins'
   zone 8 kept, `spec/VALIDATION.md` §4). From the 3/80 save (`/home/tmg/sotsb-saves/3-80`,
   `SOTSB_CHAIN_FROM`): 3/81 and **3/82** are reached (saves in `/home/tmg/sotsb-saves/`; the harness's
   `forward`, `prefer` and flag-gated hints, `spec/VALIDATION.md` §4). Next: (a) the keys: the chain went
   through the dungeon mazes without the brass, silver and gold keys (walkthrough: 2/64 (12,15), 2/65
   (1,8), 2/66 (9,13); confirm in ECL2 #64–66), so rerun from `2-64` with hints for them; (b) 3/82 is a
   large maze over one map (position [0x4CFD]/[0x4CFE]); the harness needs a way to head for a place in
   it (walkthrough: east, south at (58,85), then always east to the gates, wall type 9 at (15,11)); the
   castle's three
   levels (3/96–3/99: the brass, silver and gold keys from the dungeon mazes, the passwords answered as
   the riddles are) and the Dreadlord; in order the glowing gate needs the well's 0x4C63. The anonymous
   GameFAQs walkthrough (`docs/environment.md`, references) gives the order and where each gate is. Then the final battle and the well in the
   browser from a chain save, in a visible window (Tristan watches browser runs: `headless: false`,
   `slowMo`), and the frost giants' village 3/81 drawn as its scripts load it. The end itself already plays
   from Debug jumps ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4, "Silver Blades played in its order").
2. **DOSBox comparisons still open** (by game below): PoR's camp menus and a battle with `scriptcheck.py`;
   CotAB's walk across an area boundary, the Hall of Training's screens and ECL4 #32's tavern door;
   SotSB's shop and training screens, a battle's summary with monsters and Fix's shortened rest.
3. **Small leads**: a used-up item's recount in the original (CotAB 0x3F9A8's caller); the undying
   harness's Charm (below, CotAB).

CotAB is played in its order from save A to the ending headless (`coabchain.test.ts`, `COAB_CHAIN=1`) and
its final battle and ending checked in the browser; PoR's, CotAB's and SotSB's saves, walks, shops, temple,
training, Memorize and rests agree with the originals in DOSBox where compared ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4).

## Waiting on Tristan

- Hosting for the accounts server (it is built and runs on the LAN; public deployment needs a host
  outside the home network, `docs/server.md`).
- The next game after Silver Blades (Pools of Darkness and the others need their GOG files unpacked
  outside the repository first; none are on the server yet).
- Whether to resume clean-room builds (work-plan step 8, on hold).

## Secret of the Silver Blades

- The Debug jump into an area whose wall sets an earlier script loads (the frost giants' village 3/81)
  shows the last area's wall sets or none; it loads the area's own map (IMP-025) but cannot know which
  wall sets the scripts on the way would load. Reached in order (sotsbchain), the mine levels 2/49–2/51
  draw with the wall sets their scripts load at every step (the play-test's view check); 3/81 is not
  yet reached that way.
- DOSBox, not yet compared: Fix's estimate when it shortens the rest (the weights' grouping, camp.md §3,
  **I**: a party with few wounds and many slots), SotSB's shop and training screens against the port's (not yet grabbed; the town's fights are behind
  doors or random, so a battle needs a route through a door or a rest encounter), a battle's summary with monsters
  (the outcome and treasure lines, read in the code of all three games, seen only without monsters).
- The vault's sync keeps the newer change and loses the other device's (documented,
  [`docs/server.md`](docs/server.md)); a conflict copy would need a design.
- Journal: entry 35's heading kept as printed ("Toom", probably "Tomb"); entry 72's map key has one
  illegible word.

## Curse of the Azure Bonds

- Its frame edge is an approximation ([`spec/C-port/rendering.md`](spec/C-port/rendering.md), Open).
- DOSBox: no walk across an area boundary yet. The ways out of the areas walked meet a question or a battle
  (Tilverton's are steps off the map's edge, B 0x6DD5, with the scripts' menus after), so a walk out needs
  those answers typed as the original's keys ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4).
- DOSBox, not yet compared: the Hall of Training's screens (2/1 (5,1) facing south, after a Yes/No).
- The undying harness (`playtest.ts`) strips Charm (11) from the party in battle without undoing what it
  set, so a member can leave a battle with an NPC's morale (≥ 0x80): its card then draws the combat picture
  of its id, none for a player character (seen on 6/67's chain save in the browser); the harness should end
  the charm as the game does.
- A used-up item (a potion's last charge, a wand's last use): the port now takes it away and works the
  record out again (item count 0x14C, hands 0x185), in camp and in battle (`spendUse`, `Battle.useItem`;
  spells.md, **I**). Use (0x3F9A8) returns a used flag and its caller spends the charge; that caller is not
  yet traced, so whether the original counts the items again (as after Scribe it does not) is open.
- ECL4 #32's tavern: a party that picks the lock east of (13,7) cannot leave ((14,7)'s west side is a wall,
  the bar puts it back where it came from); whether the original traps it too needs a DOSBox look
  ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4, "in its order").

## Pool of Radiance

- DOSBox comparisons, with `scriptcheck.py` (the port's answers typed as the original's keys; a shop's
  Buy, a training and a temple cure done, [`spec/VALIDATION.md`](spec/VALIDATION.md) §4): the camp's menus, a
  battle (its outcome follows the dice: a forced one, or one whose summary the dice cannot change),
  walks beyond save A's two areas; the two games' dice differ, so a script's random event must be kept
  out in both (ECL 0x4A80 for the slums; New Phlan's street event, ECL 0x9890, has no such switch yet).
- Register 0x035F needs a debugger ([`spec/A-games/engine/ecl.md`](spec/A-games/engine/ecl.md), Open).
- The Sell, Share, Appraise and arrow-weight checks were not run in DOSBox, by decision: they stay
  code-read ([`spec/open-questions.md`](spec/open-questions.md)).

