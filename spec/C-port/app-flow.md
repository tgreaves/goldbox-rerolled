# Application flow

> **Status: stub, to be written** (work-plan step 4, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The screens a player passes through and what moves them between: the games screen, importing files, the title, the party screen, play, the demo, the ending, the party destroyed.

## Will contain

- every top-level state and its transitions, with the triggers (keys, taps, timers, script events)
- first run, returning player, game switch, update prompt

## Sources to fold in

- `web/src/main.ts`, `web/src/ui/party.ts`, `title.ts`, `ending.ts`
- IMP-005, 035, 036, 060, 072, 073, 074 in [IMPROVEMENTS.md](../../IMPROVEMENTS.md)
