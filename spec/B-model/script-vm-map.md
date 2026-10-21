# Script VM map

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The per-game description of the ECL virtual machine's memory and opcode differences, translated to one canonical numbering the shared interpreter runs on.

## Will contain

- regions of the A, B and C spaces per game; the translation to canonical numbering (`canonical`, `native`, `NOWHERE`)
- reads of B as a view of the current character, per game
- the opcode variants (nine today), skip and operand overrides, CALL targets and their sounds, the flags

## Sources to fold in

- [engine/ecl.md](../A-games/engine/ecl.md)
- [coab/ecl.md](../A-games/coab/ecl.md)
- [docs/multi-game.md](../../docs/multi-game.md) step 4
- `web/src/games/ecl.ts`
