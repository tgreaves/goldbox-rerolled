# Records and tables

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

How the engine reaches the game's own data: the character record by named fields, and the START.EXE tables by named table maps, so one procedure serves every game.

## Will contain

- the field map (`CharFields`): each field's offset, size, meaning, base/current pairs, arrays and counts, per game; the rule that code reaches fields by name
- the table map (`TableMap`): each table's DS address, row size, entry format, the absent marker (−1), the image offset of DS
- tables a game lacks and what the engine does then
- "records stay native": records are kept in each game's own layout and written back byte-compatible

## Sources to fold in

- [AUDIT.md](../AUDIT.md) §5.3
- [coab/tables.md](../A-games/coab/tables.md) §2 and §4
- [docs/multi-game.md](../../docs/multi-game.md) "Records stay native"
- `web/src/games/fields.ts`, `tables.ts`
