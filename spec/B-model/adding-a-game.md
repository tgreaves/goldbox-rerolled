# Adding a game

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The method for bringing another Gold Box game onto the engine: unpack and merge the executable, find its data segment, diff it against the Pool of Radiance spec, write its profile, test the profile against the game's own files, sweep its scripts.

## Will contain

- the steps, with the tools each uses and what each step must produce
- what a new game should need: only its profile and any genuinely new procedure, named by what it does

## Sources to fold in

- [CLAUDE.md, "Method for a new game or table"](../../CLAUDE.md#method-for-a-new-game-or-table)
- [docs/multi-game.md, "Adding a game"](../../docs/multi-game.md#adding-a-game)
