# To do

What is not yet done or not yet checked, across the games. Questions about the originals are kept in
[`spec/open-questions.md`](spec/open-questions.md) and each spec file's "Open" section; each game's step
log and status are in [`docs/multi-game.md`](docs/multi-game.md). An item leaves this list in the commit
that settles it.

## Next steps (2026-10-23, in order)

1. **More DOSBox comparisons** with `tools/dosbox/` where the port's behaviour rests on **I** items
   (`spec/open-questions.md`): `viewcheck.py --moves` walks, saves written by the original compared
   with the port's (`run.py` keeps every file the game changes). PoR's walks, saves and rests are done,
   and SotSB's saves (the opening, the mines) and walks (the town, the ruins into the town, the temple
   level) (2026-10-23, `spec/VALIDATION.md` §4).
2. **Play-throughs** of CotAB and SotSB beyond the opening (headless harness first, then the browser),
   fixing what they find. SotSB in its order (2026-10-23, `sotsbchain.test.ts`): the town, the ruins'
   street zones, the mine's levels 0–10 and, through level 10's street maze (route hints from its
   tables), the hole into 2/64, then 2/65, 2/66 and 2/68, reached as the scripts route them; still to do,
   from 2/66 into block 3 (3/80 by event 31 south; a run there ended its game 501 times with no battle
   lost, cause not traced), block 3 and the Dreadlord, and the final battle and the well's message in the browser
   ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4, "Silver Blades played in its order").
   CotAB (2026-10-23): every area toured headless and its towns, hall, shop,
   temple, overland edge, camp and a battle with spells checked in the browser
   ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4); the chain in its order (`coabchain.test.ts`) reaches
   Yulash, Zhentil Keep, Myth Drannor and 6/69 from save A; still to do, Dracandros' tower (6/64–6/67)
   and the ending by the chain, and the final battle to its end in the browser.

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
- A potion used up in camp (its last charge) leaves the record's item count (0x14C) and hands (0x185) as
  they were in the port (`coabchain.test.ts` seed 2, 5/50); Use (0x3F9A8) returns a used flag and its
  caller spends the charge, not yet traced: whether the original then counts the items again, as after
  Scribe it does not (camp-and-time.md, Rest), is open.
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

