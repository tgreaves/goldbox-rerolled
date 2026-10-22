# GoldBox Rerolled: how to work here

Standing preferences and method for anyone (human or AI assistant) working in this repository. They
apply to every change. The setup they assume (game files, test variables, REA/Ghidra, the
development server, references kept outside the repository) is in
[`docs/environment.md`](docs/environment.md): read it first in a new session.

## Goal

One engine for **every** SSI Gold Box game, each game's own rules respected (Pool of Radiance's
tighter level caps, Curse of the Azure Bonds' paladins and rangers, and so on). Pool of Radiance (PoR)
came first and is playable; Curse of the Azure Bonds (CotAB) is being added. The design is in
[`docs/multi-game.md`](docs/multi-game.md).

## Rules

1. **Data-driven first.** Nothing is hard-coded that can come from the game's own files, a lookup
   table or the game profile. In order of preference:
   - read it from the player's game files (START.EXE tables through `T`, DAX records, ITEMS);
   - otherwise put it in the game's profile (`web/src/games/`) as data: fields, tables, ECL map,
     save layout, rules values;
   - only where a game's *procedure* differs, write both procedures in `rules/` and let the profile
     name which one applies. Never branch on the game deep in shared code (`if (coab) …`).
   - Standing goal (Tristan, 2026-10-20): **one engine for every Gold Box game, fully data-driven,
     no hard-coded alternative paths.** Every change should move towards it: prefer one parametric
     procedure over per-game implementations, keep profiles as data (no functions in them where data
     will do), and keep `docs/multi-game.md` ("Where a game is described", "Tracking to the goal")
     current: it says where each game's configuration lives and what is still hard-coded.
   - Design for games beyond Pool of Radiance and Curse of the Azure Bonds: name procedures by what
     they do, never by a game; a new game should need only its profile and any genuinely new procedure.
2. **Faithful to the original.** Rules and scripts behave as the original's code does, including its
   quirks. Before "fixing" anything that looks odd, check the original binary: often it is what the
   game does. Every deliberate departure goes in [`IMPROVEMENTS.md`](IMPROVEMENTS.md) (next IMP
   number) **in the same commit**.
3. **Evidence.** Spec statements are marked **O** (observed in the binary or data), **I** (inferred)
   or **?** (unknown), with the routine or address that shows it (the full legend, with **G** and
   **Bug**, is in `spec/README.md`). Code comments cite the routine
   (`FUN_seg_off`, or image offsets for CotAB) and the spec section.
4. **No game data in the repository.** Game files, their extracted art and text, and tool output that
   contains them stay local. (The journal text is the exception: CC BY-SA, credited in the README.)
5. **Reference code.** Simeon Pilgrim's C# CotAB rebuild has no licence: use it only to find where to
   look; confirm everything in the binaries; never copy its code or text.
6. **Saves stay compatible.** Records stay in each game's native layout; the original's save files
   must load and be written back byte-compatible. Port-only data goes in sidecar files (`.GBR`).

## Commits

- No `Co-Authored-By` lines and no mention of Claude or other AI tools in commit messages.
- A commit only after `npm run build` succeeds and the tests pass (`web/`, see below).
- Standing rule (Tristan, 2026-10-22): **always** keep the spec, `IMPROVEMENTS.md` and the README(s) up to date
  with every change, in the same commit; check all three before committing, even for a fidelity fix.
- One commit per step of a plan, with a message saying what changed and why; push to `main`.
- Keep the spec, `docs/multi-game.md`, the READMEs and `IMPROVEMENTS.md` in step with the code.

## Testing

From inside `web/` (never with `--root /`):

```sh
POOLRAD=/path/to/POOLRAD COAB=/path/to/CURSE npx vitest run
```

Tests that need game files skip without them. Each game's tests check its profile against its own
files (field maps against the pre-made characters, table maps against START.EXE, the script sweep
over every area). PoR's tests must stay green through every change.

The development server is small (7.4 GB RAM; it froze once at about 3 GB): run one vitest at a time,
close disassemblers (REA's Ghidra sessions) after use, no unbounded background jobs.

## Method for a new game or table

1. Unpack START.EXE (`tools/unexepack.py`), merge overlays (`tools/mergeovr.py`), disassemble with
   objdump. Find the data segment from the Turbo Pascal start-up (`mov dx,…; mov ds,dx`).
2. Diff against the PoR spec (`spec/A-games/engine/`): write findings to `spec/A-games/<game>/`, with
   addresses for both games; what the profile must hold goes in part B (`spec/B-model/`).
3. Add the game's profile in `web/src/games/` (fields, tables, ECL map, save files, rules), test it
   against the game's own files, then make the code read it.
4. Run the headless script sweep over every area and square; it must show no interpreter errors.

## Where things are

- `spec/`: the specification, the single normative source the port can be rebuilt from (start at
  `spec/README.md`: conventions, evidence marks, the dice-tape rule, the index of every file).
  Part A `spec/A-games/`: the original games (`engine/` as PoR defines it, `por/` what is PoR's own,
  `coab/` CotAB as differences); part B `spec/B-model/`: the engine model (profile, procedures,
  vocabularies, host contracts); part C `spec/C-port/`: the port's own design (UI, 3D view, storage,
  sync); part D `spec/D-appendices/`. `spec/AUDIT.md` is the Phase 1 audit and work plan
  (provenance). Links are plain Markdown; `python3 tools/speclinks.py` checks them all
- `tools/`: Python decoders and the headless interpreter; `tools/coab/`: CotAB extractors
- `web/src/games/`: game profiles: `fields.ts` (character record), `tables.ts` (START.EXE tables),
  `ecl.ts` (script VM map and opcode variants), `files.ts` (saves), `rules.ts` (rules values and
  procedure choices), `spellrules.ts` / `effectrules.ts` (spell and effect handler maps), `por.ts` / `coab.ts`
- `docs/multi-game.md`: the multi-game design and its step-by-step status
- `server/`: the optional accounts and sync server (Node 24, no dependencies; game-neutral: records keyed by
  the profile id, files in each game's own formats); `web/src/store/sync.ts`, `account.ts`: the browser's side;
  `docs/server.md`: design, API, security, deployment (systemd, Docker); its tests are `web/test/server.test.ts`
  and `sync.test.ts`

## Where the work stands (2026-10-22)

- Pool of Radiance plays start to finish; Curse of the Azure Bonds is playable at an early stage
  (all 8 steps of `docs/multi-game.md` done, dual-classing included), not yet played through in a
  browser. About 420 tests pass; long headless playthroughs (24 × 1000 steps) show no failures.
- The spec is the normative source (decisions D1–D6 in `spec/README.md`); steps 1–7 of its work plan
  (`spec/AUDIT.md` §8) are done. Step 8, the clean-room rebuilds that validate it, is **on hold** by
  Tristan's choice (token and session limits): do not start one unasked.
- Current focus: bug fixes and gaps (`spec/open-questions.md`, the backlog in `docs/multi-game.md`).
- Not yet done: comparison with the original running in DOSBox; browser play-through of CotAB and
  of much of the newer UI.
- Secret of the Silver Blades: research started 2026-10-22 (`spec/A-games/sotsb/`: records, tables, script
  VM, assets); a first profile (`games/sotsb.ts`, viewable, not playable; its rules, spells and effects are
  CotAB's until researched). Tests take `SOTSB` (the game folder) like POOLRAD and COAB.
- `server/` (accounts and sync) is built but not deployed. It is meant to become a public service
  with open sign-up, so treat every change there as internet-facing (`docs/server.md`, "Running it publicly").
