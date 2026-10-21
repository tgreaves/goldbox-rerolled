# Game strings

> **Status: stub, to be written** (work-plan step 6, [AUDIT.md](../AUDIT.md) §8). The addresses are normative; the strings themselves stay in the game files.
> Part of the [specification](../README.md).

Per D1, game text is read from the player's files, never copied into the code or the spec: this appendix lists each message the engine prints with its id and its address in each game's files.

## Will contain

- message ids and their offsets per game (START.EXE, GAME.OVR), with the routine that prints each
- the credits, the monster-name lists of the racial handlers, the engine messages (about 190 today in `rules/`, `vm/`, `games/`, `ui/town.ts`, `ui/camp.ts`); ruling C24 moves them from code to reads by address

## Sources to fold in

- [AUDIT.md](../AUDIT.md) §4, §6.4 C24
- `web/src/games/title.ts`, `ending.ts`, `startup.ts` (which already read by offset)
