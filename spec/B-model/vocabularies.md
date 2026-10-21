# Behaviour vocabularies

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The named behaviours the profiles map game numbers onto: effect behaviours, item behaviours, spell handler kinds and monster specials, each with its parameters and the original handler it reproduces.

## Will contain

- effect behaviours (125 keys today) and their parameters; `EffectRules`: event order, area effects and radius, handlers, `removalStat`, items, `replaces`, `healBlock`
- item behaviours (by item byte 0x3E & 0x7F)
- spell handler kinds (37 today): `Term`, `Amount`, `Rolled`, durations, the `strength` rule, `aiTarget`
- monster specials (effect event 14: breath, eye rays, gaze) and the shared target hook
- one name per entry: the audit found *behaviour*, *handler* and *kind* used for the same thing

## Sources to fold in

- [engine/effects.md](../A-games/engine/effects.md) "Port status"; the "Port" sections of [coab/](../A-games/coab/README.md)
- `web/src/rules/effectkinds.ts`, `spellkinds.ts`, `specials.ts`; `web/src/games/effectrules.ts`, `spellrules.ts`
