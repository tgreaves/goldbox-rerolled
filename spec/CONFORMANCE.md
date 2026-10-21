# Conformance checklist

> **Status: stub, to be written** (work-plan step 7, [AUDIT.md](AUDIT.md) §8). Normative as a checklist once written.
> Part of the [specification](README.md).

A self-audit to run against a finished build: did it build the right thing? It targets the load-bearing details that still give a working game if wrong, and covers the look of the interface (D4), which part C states only as a behaviour contract.

## Will contain

- rules and saves: byte-compatible save round trip, departures only as listed
- the party screen groups, the command bar contents, autosave rules, the battle screen, the title and ending
- the look per screen class: frames, palette, font, pixel scaling

## Sources to fold in

- [AUDIT.md](AUDIT.md) §7, §8.1 (V13)
