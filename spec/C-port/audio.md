# Audio

> **Status: stub, to be written** (work-plan step 4, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

Sound in the port: the original driver emulated from the player's files (part A, [engine/sound.md](../A-games/engine/sound.md)), device choice, and the cut-off rule.

## Will contain

- device choice and switching (IMP-015); the Tandy noise approximation
- the 0.1 s cut-off: which effects play in full. Ruling (C23): the port follows the original, by call site as [engine/sound.md](../A-games/engine/sound.md) §6 states; the code plays a fixed list of effect numbers and is to be checked and fixed
- additions (IMP-014)

## Sources to fold in

- `web/src/audio/sfx.ts`
- IMP-013, 014, 015
