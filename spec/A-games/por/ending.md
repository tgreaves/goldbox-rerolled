---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Ending (O, `FUN_4804_02a4`, animation helper `FUN_4804_0006`)

Part of the [specification](../../README.md), part A: Pool of Radiance. The ending sequence that ECL `PROGRAM 8` runs ([main-loop.md, "Built-in screens"](../engine/main-loop.md#built-in-screens-o)). Curse of the Azure Bonds: [coab/assets.md](../coab/assets.md).

Game mode 7 while it runs, then restored; pictures from `FINAL<block>` (records decoded with XOR frames), positions in pixels within a 120×120 area:
1. Text rows 17–19: "Mortally wounded, the dragon roars!" / "The spirit of Tyranthraxus flares up" / "from the dragon's body."
2. Record 1 at (0, 0); record 2 (88×88, 4 frames) animated at (16, 32) for `(10 − speed) × 5 / 2` cycles.
3. Record 3 at (0, 0); with 2+ in the party record 4 at (0, 88), 3+ record 5 at (104, 72), 4+ record 6 at (0, 72).
4. Six rows: Tyranthraxus's speech ("Fools, you have but slain the body" … "of you!""); record 7 animated at (16, 0) for the same number of cycles.
5. Four rows: "\"No Lord Bane!  I can still rule here!" … "Noooo..."; record 8 animated at (16, 0) once.
6. Three calls to `FUN_1709_0dbe`, then the view is redrawn and the script continues (PROGRAM acts as EXIT).

A frame stays up while the timer (`FUN_1709_0c3f`) has advanced by at most (speed + 3) × its delay; the helper counts a cycle each time the frame index wraps.
