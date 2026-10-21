# The game profile

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The `GameProfile` that describes one game to the shared engine: every top-level field with its meaning, unit and source (a binary address, a table, or the rule that derives it), and a listing of each game's values.

## Will contain

- every top-level field (31 today): `id`, `name`, `folder`, `note`, `playable`, `config`, `markers`, `required`, `keep`, `stores`, `imageFamilies`, `fields`, `tables`, `ecl`, `saves`, `rules`, `journal`, `spellNotes`, `rulesText`, `view`, `title`, `startMenu`, `sound`, `commissions`, `treasure`, `spells`, `effects`, `landmarks`, `debug`, `ending`, `imports`
- for each: meaning, unit, whether it is read from the game files (with the address, informative value) or authored for the port (normative value), per D5
- the rule that shared code never branches on the game: a difference is data in the profile, or a named procedure the profile selects ([procedures.md](procedures.md))
- the per-game listing for Pool of Radiance and Curse of the Azure Bonds

## Sources to fold in

- [AUDIT.md](../AUDIT.md) §5.1
- `web/src/games/types.ts` and the JSDoc of every profile module (reference implementation)
- [docs/multi-game.md, "The game profile"](../../docs/multi-game.md#the-game-profile), "Where a game is described"
