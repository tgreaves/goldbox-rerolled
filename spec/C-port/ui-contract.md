# User interface contract

> **Status: stub, to be written** (work-plan step 4, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The behaviour contract for the whole interface (D4): what each screen class contains, its states, its controls and keys, its texts, and its layout described in words. Exact CSS and pixel values are informative; [CONFORMANCE.md](../CONFORMANCE.md) checks the look.

## Will contain

- layout classes and where they switch (today 600, 700, 760 px or aspect ≤ 4:5, 900, 1200 px and ≥ 4:3, landscape ≤ 520 px high, coarse pointer): what is where in each, in words
- panels and their frames; the command bar (Area, Encamp, Search, Look, ☰) and the ☰ menu; the party cards; the text log
- the input map: keys, taps, drags, the movement pad, Escape; what is enabled when, and the reason shown when not
- the texts the port adds, as normative strings (game text is read from the files, D1)

## Sources to fold in

- `web/src/ui/explore.ts`, `web/src/style.css` (reference implementation)
- IMP-003, 004, 008, 010, 012, 029, 045, 046, 051, 057, 060, 061, 064, 065, 066
