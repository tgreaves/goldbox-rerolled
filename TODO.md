# To do

What is not yet done or not yet checked, across the games. Questions about the originals are kept in
[`spec/open-questions.md`](spec/open-questions.md) and each spec file's "Open" section; each game's step
log and status are in [`docs/multi-game.md`](docs/multi-game.md). An item leaves this list in the commit
that settles it.

## Secret of the Silver Blades

- Casting in a battle, and Join/Halve on a real bundle of two or more scrolls, not yet exercised in the
  browser (unit tests cover both: `web/test/sotsbspells.test.ts`, `bundle.test.ts`).
- Its demi-human training limits by race, class and prime requisite (0x3DE79–0x3DEF3) not checked
  against the port.
- The patient search and the cloud laying taking both body marks (0x1C, 0x1E) is **I**
  ([`spec/A-games/sotsb/combat.md`](spec/A-games/sotsb/combat.md)).
- The vault's sync keeps the newer change and loses the other device's (documented,
  [`docs/server.md`](docs/server.md)); a conflict copy would need a design.
- Journal: entry 35's heading kept as printed ("Toom", probably "Tomb"); entry 72's map key has one
  illegible word.

## Curse of the Azure Bonds

- Its outdoor sky and clouds not yet compared with the original in DOSBox (only the starting room).
- Its frame edge is an approximation ([`spec/C-port/rendering.md`](spec/C-port/rendering.md), Open).

## Pool of Radiance

- Register 0x035F needs a debugger ([`spec/A-games/engine/ecl.md`](spec/A-games/engine/ecl.md), Open).
- The Sell, Share, Appraise and arrow-weight checks were not run in DOSBox, by decision: they stay
  code-read ([`spec/open-questions.md`](spec/open-questions.md)).

## Every game

- Escape does nothing in most of the port's menus (Aim, for instance; the hot keys work): a behaviour to
  decide ([`spec/C-port/ui-contract.md`](spec/C-port/ui-contract.md), Open).
