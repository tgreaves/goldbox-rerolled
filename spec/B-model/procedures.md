# Parametric procedures

> **Status: stub, to be written** (work-plan step 2, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

Each rules procedure that serves several games stated once, with its parameters, and for each game the binary routine its parameters come from.

## Will contain

- spell slots (sources, pools, `from`, `add`, wisdom, learn, doubler); hit points (`laterDice`, `rolls`, `firstLevelMin`, `fixed`); starting money
- casting in combat (`lostFrom`, `miscast`, `aiFirstSlot`); the bolt path (its five flags); clouds (`gas`, `kill`)
- caster terms, caster gate, dual class; thief skills; temple; joining
- battlefield generation: the wilderness passes (`river`, `treesBySize`, `treesOrLogs`, `scatterTerrain`, `scatterOdds`, `finishing`; `FlagValue`, `CellDie`, `RiverCourse`) and map fields (`cornerWallEnd`, `finishing`, `furnish`)
- random treasure picks (the `Pick` notation, overrides, plus, javelin, scrolls, magic)

## Sources to fold in

- [AUDIT.md](../AUDIT.md) §5.2
- `web/src/games/rules.ts`, `treasure.ts`
- [docs/multi-game.md](../../docs/multi-game.md) "Rules as data first"
