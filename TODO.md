# To do

What is not yet done or not yet checked, across the games. Questions about the originals are kept in
[`spec/open-questions.md`](spec/open-questions.md) and each spec file's "Open" section; each game's step
log and status are in [`docs/multi-game.md`](docs/multi-game.md). An item leaves this list in the commit
that settles it.

## Next steps (2026-10-23, in order)

1. **More DOSBox comparisons** with `tools/dosbox/` where the port's behaviour rests on **I** items
   (`spec/open-questions.md`): `viewcheck.py --moves` walks, saves written by the original compared
   with the port's (`run.py` keeps every file the game changes), SotSB beyond its view. PoR's walks,
   saves and rests are done (2026-10-23, `spec/VALIDATION.md` §4).
2. **Play-throughs** of CotAB and SotSB beyond the opening (headless harness first, then the browser),
   fixing what they find. CotAB (2026-10-23): every area toured headless and its towns, hall, shop,
   temple, overland edge, camp and a battle with spells checked in the browser
   ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4); still to do, the quest chain in its order (not by
   jumps) and the final battle to its end in the browser.

## Waiting on Tristan

- Hosting for the accounts server (it is built and runs on the LAN; public deployment needs a host
  outside the home network, `docs/server.md`).
- The next game after Silver Blades (Pools of Darkness and the others need their GOG files unpacked
  outside the repository first; none are on the server yet).
- Whether to resume clean-room builds (work-plan step 8, on hold).

## Secret of the Silver Blades

- The Debug jump into an area whose wall sets an earlier script loads (the mine levels 2/49–2/51, the
  frost giants' village 3/81) shows the last area's wall sets or none; it loads the area's own map
  (IMP-025) but cannot know which wall sets the scripts on the way would load.
- The vault's sync keeps the newer change and loses the other device's (documented,
  [`docs/server.md`](docs/server.md)); a conflict copy would need a design.
- Journal: entry 35's heading kept as printed ("Toom", probably "Tomb"); entry 72's map key has one
  illegible word.

## Curse of the Azure Bonds

- Its frame edge is an approximation ([`spec/C-port/rendering.md`](spec/C-port/rendering.md), Open).
- DOSBox: no walk across an area boundary yet (every way out of the areas walked meets a question or a
  battle), and no rest that memorises a spell ([`spec/VALIDATION.md`](spec/VALIDATION.md) §4).
- ECL6 #69's phase spiders ask for CPIC6 #66, which no file holds, so their icon slot is empty (O, 0x2371);
  what the original's battlefield draws for an empty slot (nothing, as the port, or memory at 0000:0000) needs
  a DOSBox look ([`spec/A-games/coab/assets.md`](spec/A-games/coab/assets.md) §4).

## Pool of Radiance

- DOSBox comparisons beyond save A's two areas, and of anything with a menu, a shop or a battle: a walk
  is typed blind, so it needs the port's answers turned into the original's keys, and the two games'
  dice differ (a script's random event must be kept out in both, as ECL 0x4A80 does for the slums;
  `tools/dosbox/README.md`, "Long PoR walks, saves compared").
- Register 0x035F needs a debugger ([`spec/A-games/engine/ecl.md`](spec/A-games/engine/ecl.md), Open).
- The Sell, Share, Appraise and arrow-weight checks were not run in DOSBox, by decision: they stay
  code-read ([`spec/open-questions.md`](spec/open-questions.md)).

