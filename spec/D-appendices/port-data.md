# Port data

> **Status: stub, to be written** (work-plan step 6, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

Data the port needs that the game files do not hold (D5: normative): spell notes, the rules reference text, landmark text patterns, the commissions panel, the journal's schema and empty-tab texts, debug jumps, UI labels.

## Will contain

- each data set, its schema and its values or the rule that derives them

## Sources to fold in

- [AUDIT.md](../AUDIT.md) §4
- `web/src/games/spellnotes.ts`, `rulestext.ts`, `landmarkrules.ts`, `journal.ts`, `debug.ts`; `web/src/rules/commissions.ts`, `journal.ts`
