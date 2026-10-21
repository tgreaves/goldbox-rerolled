# Game files and detection

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

Which of the player's files the port needs and keeps, how it recognises which game a folder holds, and where it stores them.

## Will contain

- the required set and kept-file patterns per game; markers and the configuration file; the detection order (configuration file first, then markers)
- the browser stores per game (including Pool of Radiance's legacy names), the image families of the asset viewer

## Sources to fold in

- [docs/multi-game.md](../../docs/multi-game.md) step 1
- `web/src/games/profile.ts`, `por.ts`, `coab.ts`
