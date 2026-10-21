# Host contracts and randomness

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The interfaces between the rules and whatever shows them (screen, test harness, headless runner), and the randomness rule that makes two builds comparable roll for roll.

## Will contain

- `Io` (the script host: 14 methods today), `CombatUi` (about 20 methods, queued messages, holds), the effect hosts in and out of combat
- entry points: new game, new demo, run demo; autosave points
- randomness (D2): every die goes through one injected source; the **dice tape** (the sequence of (count, sides) requests and their results) and how a run is recorded and replayed. The engine's own generator is informative
- the headless harness and its transcript format (text lines, menus offered, variable writes, area changes; the battle event log) used by [VALIDATION.md](../VALIDATION.md)

## Sources to fold in

- [AUDIT.md](../AUDIT.md) §5.3 (last paragraph), §6.7 D2, §8.1
- `web/src/vm/engine.ts` (`Io`), `web/src/rules/combat.ts` (`CombatUi`), `web/src/rules/worldfx.ts`
