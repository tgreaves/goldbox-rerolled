# Clean-room builds

> **Status: complete** (work-plan step 7, [AUDIT.md](AUDIT.md) §8). A process document, informative,
> not part of the normative spec; kept out of the clean-room file sets. Part of the
> [specification](README.md). The runs themselves are work-plan step 8; their record is
> [VALIDATION.md §5](VALIDATION.md#5-clean-room-runs).

How to show that the specification is **enough to build GoldBox Rerolled from the spec and the
player's game files alone**. The author of a spec cannot test it by building from it: they carry the
code in their head and fill the gaps from memory, which hides real gaps and lets their own mistakes
pass for spec findings. A trustworthy test needs a builder who has only the spec. This document says
what that builder gets, what they must not have, what they build, how each build is compared with the
reference implementation, and how the findings come back into the spec. It follows the method of
[compunet-reborn's clean-room brief](https://github.com/tgreaves/compunet-reborn/blob/main/docs/spec/CLEANROOM.md).

## 1. What a valid run guarantees

1. **No memory contamination.** The builder is a fresh agent (or person) with no knowledge of this
   project, its code or any conversation about it.
2. **No source contamination.** The builder cannot read the reference implementation (`web/`,
   `server/`, `tools/`), the project's notes (`docs/`, `CLAUDE.md`), the repository's history, or any
   other Gold Box reimplementation. Its only references are the file set of §2 and the game files.
3. **Proof by comparison.** Every validation compares the build's output with the reference
   implementation's on the same input: hashes from the test-vector manifest, transcripts, frames,
   the server suites. "It works" is shown, not assumed.
4. **A findings log.** Every point where the spec is silent, ambiguous or wrong is logged against its
   section (§5.1). The log is the run's real deliverable.

## 2. The file sets

| Set | What | Given to the builder |
|---|---|---|
| **spec** | `spec/` as committed: README, parts A–D (with `D-appendices/test-vectors.json`), `CONFORMANCE.md`, `open-questions.md` | yes, except `VALIDATION.md` (the answers: what was found), `xref.md` (where the code is: an invitation to look), `AUDIT.md` (provenance, full of code paths and findings) and this file (meta) |
| **register** | `IMPROVEMENTS.md`, beside `spec/` (part C's [departures.md](C-port/departures.md) cites it) | yes |
| **golden hashes** | copies of `web/test/view-frames.json` (V9 frames) and `web/test/text-hashes.json` (game text by address) in `golden/`: hashes only, no game data | yes |
| **game files** | the player's GOG folders: Pool of Radiance (`POOLRAD`) and Curse of the Azure Bonds (`CURSE`), with their shipped saves; their `START.EXE` SHA-256 values are the manifest's `releases` | yes, read-only |
| **golden outputs** | the reference's full outputs of every F vector and every tape (`npm run vectors -- --golden <folder>`, [test-vectors.md §6](D-appendices/test-vectors.md#6-the-generator-and-the-golden-outputs-informative)): game data | **no**: kept by the reconciler, to diff a failing vector |
| **withheld** | `web/`, `server/`, `tools/`, `docs/`, `deploy/`, `CLAUDE.md`, the project `README.md`, `.git`, the deployed service and the public repository | no |

Links from the given files into withheld ones (`../docs/server.md`, `../CLAUDE.md`, the project
README) stay broken on purpose: the builder logs one only if it needed what was behind it.

**Setup** (from the repository root; `CR` any directory **outside** the repository):

```sh
CR=/tmp/goldbox-cleanroom
rm -rf "$CR" && mkdir -p "$CR/golden" "$CR/games"
rsync -a --exclude VALIDATION.md --exclude xref.md --exclude AUDIT.md --exclude CLEANROOM.md spec/ "$CR/spec/"
cp IMPROVEMENTS.md "$CR/"
cp web/test/view-frames.json web/test/text-hashes.json "$CR/golden/"
cp -r "$POOLRAD" "$CR/games/POOLRAD" && cp -r "$COAB" "$CR/games/CURSE" && chmod -R a-w "$CR/games"
git rev-parse HEAD > "$CR/SPEC-COMMIT.txt"
```

Check before starting: `ls "$CR"` shows exactly `IMPROVEMENTS.md`, `SPEC-COMMIT.txt`, `games`,
`golden`, `spec`; `ls "$CR/spec"` has no `VALIDATION.md`, `xref.md`, `AUDIT.md` or `CLEANROOM.md`;
`find "$CR" -name '*.ts' -o -name '*.py' -o -name .git` finds nothing.

## 3. Isolation rules

- The builder works in `$CR` only, in a **brand-new** session started there, never a continuation of
  one that has seen the repository.
- **No network to the project**: not the repository (`github.com/tgreaves/goldbox-rerolled`, forks,
  archives), not the deployed service (it serves the reference build), not search results about it.
  No other Gold Box reimplementation or decompilation either (the CotAB C# rebuild, editors, forum
  dumps): the spec and the game files are the only sources. A package registry for ordinary libraries
  is allowed.
- The builder works from the **committed** spec (`SPEC-COMMIT.txt`); nobody patches it mid-run.
- The builder is told to **log and assume**, never to look elsewhere. A build that succeeds by
  reading the reference proves nothing about the spec.
- In a driven run (a sub-agent whose transcript is kept), a transcript that shows any read outside
  `$CR`, or a fetch of a withheld source, makes the run **void**: it is restarted clean.
- Server runs: the reconciler starts the reference server **API-only** (`WEB_ROOT` an empty
  directory, so it serves no app), on a port of its own, with a fresh `DATA_DIR`. Check:
  `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:<port>/` must print 404.

## 4. The validations

From [AUDIT.md §8.1](AUDIT.md#81-clean-room-validations-that-are-practical). The builder builds what
the third column says; the reconciler compares as the last two say.

| # | Validation | The builder builds | Compared | How |
|---|---|---|---|---|
| V1 | Decoders | EXEPACK, overlays, DAX and RLE, the table map | the unpacked and merged images, every table, every DAX file's records | SHA-256 of the canonical listings: the F vectors `decode.image`, `tables.bytes`, `decode.dax` ([expected-values.md §7](D-appendices/expected-values.md#7-decoded-files-and-tables-v1)) |
| V2 | Save round trip | save load and write-back, both games | `SAVGAMA.DAT` and the `CHRDATA*` files written back | byte-identical except the never-read bytes ([storage.md §5](C-port/storage.md#5-saved-games-and-the-autosave)); the reconciler diffs the files |
| V3 | Headless script run | the script VM and the script host of [host-contracts.md §8](B-model/host-contracts.md#8-the-headless-harness) | the transcript | the F vectors `headless.run` without a battle: SHA-256 of the JSON lines |
| V4 | Script sweep | a sweep over every area from every third square, the menus answered by a seeded choice | interpreter errors, looping runs | no decode error and no missing opcode; the looping runs compared with [engine/ecl.md, "Validation"](A-games/engine/ecl.md#validation) |
| V5 | Seeded battle | combat, the AI, effects and spells, with the dice source | the event log | the F vectors `headless.run` with a battle (the tape replayed, the transcript hashed) and the E vectors `combat.*` |
| V6 | Battlefield generation | the wilderness and map-area generators | the 25 × 50 grid | the S and E vectors `battlefield.*` (rows in full), the F vectors `battlefield.area` |
| V7 | Random treasure | TREASURE's item builder | the 63-byte records | the F vectors `treasure.random` |
| V8 | Sound | the driver of [sound.md](A-games/engine/sound.md) | the port writes per tick | the F vectors `sound.driver`; the samples made from them by ear (their levels are informative) |
| V9 | View frame | the drawn view of [exploration-view.md §2](C-port/exploration-view.md#2-the-drawn-view-normative) | 88 × 88 indices per frame | the SHA-256 of each frame against `golden/view-frames.json` (1024 frames for each of eleven areas, both games) |
| V10 | Profile from the spec | CotAB's profile from part B and the CotAB files | the profile's values; the build on CotAB | the reconciler diffs the builder's values with the reference profile field by field; the build must pass every CotAB vector |
| V11 | Server from the spec | the accounts and sync server of [accounts-and-sync.md](C-port/accounts-and-sync.md) | the API's behaviour | the reference's server and sync suites run black-box against the builder's server (the note below) |
| V12 | Server API client | the client sync of accounts-and-sync §5 | sign-up, push, pull, conflicts, export | the builder's client against the reference server, API-only (§3); the reconciler checks the records it left in `DATA_DIR` |
| V13 | Visual build | the browser app, parts A and C | the look and the behaviour contract | a person goes through [CONFORMANCE.md](CONFORMANCE.md) with the build running, both games |

Besides these, the builder runs **every S and E vector** of the manifest (the procedures of part B:
the dice source, hit points, slots, saves, thief skills, caster level, joining, creation, training,
money, the line walker, spells, attacks, saves) and checks the game text it reads by address against
`golden/text-hashes.json`.

*Note on V11.* Today's suites start the reference server in-process and some cases read its data
folder and run its admin command line. A black-box mode (the server's address and data folder from the
environment, the white-box cases skipped) is a prerequisite of V11 (finding AP4,
[AUDIT.md §6.9](AUDIT.md#69-state-after-work-plan-step-1-2026-10-21)).

### 4.1 The plan: three runs

| Run | Stages | Validations, in order | File set |
|---|---|---|---|
| **1. Engine** | the decoders and tables; the saves; the profiles; the script VM and the headless harness; the rules procedures; battlefields, treasure, combat; the sound driver; the drawn view | V1, V2, V10, V4, V3, the S and E vectors, V6, V7, V5, V8, V9 | spec, register, golden hashes, both games' files |
| **2. Server** | the server; then a client for it | V11, V12 | spec and register only (the server never reads game files) |
| **3. Visual** | the browser app on run 1's engine | V13 | as run 1 |

Run 1 comes first because every later stage stands on it and its comparisons are exact. Within it the
order follows the dependencies: nothing decodes a script before the containers do, and a battle
transcript cannot match before the procedures it calls match their own vectors. Run 2 is the cheapest
strong test (black-box suites) and needs nothing of run 1. Run 3 is the only check of part C's
interface that needs no harness. After a large change to the spec, run 1 is repeated in full and the
other two where the change touches them.

## 5. The brief

Paste this to the fresh builder, with `$CR` filled in:

> You are building a program from a specification. Your **only** references are the files in
> `$CR`: `spec/` (start at `spec/README.md`), `IMPROVEMENTS.md`, the hash files in `golden/`, and the
> game files in `games/`, which you may read but not change. You **must not** read, search for, open
> or infer from any other source: no other code of this project, no other Gold Box reimplementation,
> no web pages about it. Where something you need is not in these files, that is a **finding**: do not
> look for it elsewhere; log it, make a documented assumption, and go on. A link into a file you do
> not have is a finding only if you needed what it pointed to.
>
> **Run 1 (engine).** Build, in a language of your choice that runs from the command line, the
> engine of parts A and B for both games, without a user interface: the decoders, the save files,
> both game profiles (write Curse of the Azure Bonds' from part B and its files), the script VM, the
> rules, combat, the sound driver and the drawn view. Expose the headless harness of
> `spec/B-model/host-contracts.md` §8 as a command (a script and answers in, a dice tape in or out, a
> transcript out) and a command that runs any vector of `spec/D-appendices/test-vectors.json` and
> prints its canonical output's SHA-256 (`test-vectors.md` §2–§4). Then report, vector by vector, pass
> or fail; the V9 frames against `golden/view-frames.json`; the game texts against
> `golden/text-hashes.json`; the save round trip; and a sweep of every area from every third square.
>
> **Findings log (the main deliverable).** Keep `$CR/FINDINGS.md` as you go: for every point where the
> spec is silent, ambiguous, contradictory, or contradicted by the game files or the vectors, write the
> section, what you needed, what you assumed, and whether the assumption then matched the vectors.
> Tag each finding as below. Be specific: quote the sentence, name the vector.
>
> Deliver the build, `FINDINGS.md`, and `RESULTS.md` (each validation, what passed, what did not).

Run 2's brief replaces the build paragraph with: "Build the accounts and sync server of
`spec/C-port/accounts-and-sync.md` (§1–§10) and run it on the port you are given; then build a client
of its §5 against the server at the address you are given (an API, not an app)." Run 3's: "Build the
browser app of part C on your run-1 engine; make it runnable by a person (one command, the game files
imported through the games screen) and write a HOW-TO-RUN."

### 5.1 Findings: format and tags

One entry per finding:

```
### CR<run>-<n> [TAG] <spec file> §<section>
Needed: …   Assumed: …   Outcome: matched / did not match <vector or validation> / not testable
```

| Tag | For |
|---|---|
| `[RULES]` | part A or B behaviour: a rule, a quirk, the order of the dice requests |
| `[DATA]` | formats, addresses, tables, reading rules, game text by address |
| `[HARNESS]` | the host contracts, the tape, the transcript, the vector format |
| `[UX]` | part C: a screen, a control, a text or a layout the builder had to invent |
| `[SERVER]` | accounts and sync |
| `[BUG]` | the spec plainly wrong: it contradicts the game files, a vector or itself |

## 6. Reconciling a run

The reconciler, with the repository, sorts each finding:

- **Genuine gaps**: things the builder could not determine from the spec. Fix the spec (one commit per
  finding or group, the message naming `CR<run>-<n>`), and record the finding and its fix in
  [VALIDATION.md §5](VALIDATION.md#5-clean-room-runs).
- **Non-issues**: assumptions that were right and that the spec supports: they confirm that a section
  reads clearly; count them.
- **Reference errors**: the builder followed the spec, the vector disagrees, and the binaries side with
  the builder: a bug of the reference implementation. Fix the code, regenerate the vectors
  (`npm run vectors -- --write`), note it in VALIDATION.md.
- **Failing vectors with no finding**: diff the builder's output with the golden output; the first
  divergence of a tape or the first differing transcript line names the section to read.

The run's row goes into VALIDATION.md §5 (date, spec commit, builder, file set, validations passed,
findings by tag). Logs are kept in `docs/cleanroom/` (outside the spec, so outside every clean-room
set), with no game text or data in them. Re-run after any significant change to the spec.
