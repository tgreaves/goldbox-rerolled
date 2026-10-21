# GoldBox Rerolled: overview

> **Status: stub, to be written** (work-plan step 4, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

What the port is and what a conforming build must do: the requirements, the constraints, and the conformance rules for part C.

## Will contain

- requirements R1–R7 (browser online and offline, saves and the original formats, the 3D view, modernised graphics and interface, responsive layout, departures tracked)
- constraints: no game data in the repository or the build; the original memory model is the game state; no network at run time (except the optional server)
- what conformance means: rules faithful to part A, saves byte-compatible, departures only as [departures.md](departures.md) lists them; the behaviour contract of D4

## Sources to fold in

- [docs/requirements.md](../../docs/requirements.md) (requirements and constraints; its architecture sketch stays provenance)
