# Working environment

What a new working session needs: the machine, the game files, the reverse-engineering tools
(REA, objdump) and how to test. The working rules are in [`../CLAUDE.md`](../CLAUDE.md); this file
holds only the setup they assume.

## Picking up the work

1. Read [`../CLAUDE.md`](../CLAUDE.md) (rules, method, where things are), then
   [`../spec/README.md`](../spec/README.md) (the spec's conventions).
2. What to do: [`../TODO.md`](../TODO.md) ("Next steps", then everything open by game, and what waits
   on Tristan); "Where the work stands" in `CLAUDE.md`; questions about the originals in
   [`../spec/open-questions.md`](../spec/open-questions.md).
3. Point the tests at the game files (below) and run them once from `web/` before changing anything.

## The development server

Most of the work has been done on one Linux machine on Tristan's LAN (the Mac is the other place,
below):

| | |
|---|---|
| Repository | `/home/tmg/pool-of-radiance-re`, remote `https://github.com/tgreaves/goldbox-rerolled` (public), branch `main` |
| Push | over HTTPS with the `gh` login as credential helper; there is no SSH key on the server |
| Size | 4 cores (AVX2), 7.4 GB RAM, 61 GB disk (upgraded 2026-10-20; it froze once at ~3 GB) |
| Node | 24 (`server/` runs `.ts` directly; `web/` builds with Vite 8, tests with Vitest 5) |
| Python | 3.14; the tools in `tools/` use only the standard library (`tools/dosbox/egaframe.py` also Pillow) |
| Disassembly | `objdump` (binutils) for the 16-bit code; REA with Ghidra for decompiling (below) |
| DOSBox | DOSBox Staging 0.83.0 in `~/opt/dosbox-staging-linux-x86_64-0.83.0-7b400/` and NASM 3.01 in `~/opt/nasm/usr/bin/`, for `tools/dosbox/` (below); both installed without root on 2026-10-22 |
| Browser | Playwright (a `web/` dev dependency) with its headless Chromium in `~/.cache/ms-playwright` |
| Docker | installed, for trying the server image (`../docker-compose.yml`) |
| App and accounts server | systemd user service `goldbox-rerolled.service` (`~/.config/systemd/user/`): `node server/main.ts` on port 8080, all interfaces, open sign-up, plain HTTP (`COOKIE_SECURE=0`). It serves the built app from `web/dist`, so `npm run build` updates it at once; after a change under `server/`, `systemctl --user restart goldbox-rerolled`. From the workstation: `http://192.168.1.21:8080`. Data in `~/.local/share/goldbox-rerolled` |
| LAN preview | with the service stopped, `npm run build && npx vite preview --host --port 8080` in `web/` (the app alone, no accounts) |

Resource limits, learnt the hard way: never run Vitest or Vite with `--root /` (it froze the server
on 2026-10-15); run one Vitest at a time; close REA's Ghidra sessions (`close_binary`) when done;
no unbounded background jobs.

## Game files

Never in the repository (`.gitignore` keeps them out). The tests and tools find them through
environment variables; tests that need a game skip without it.

| Game | Folder on the server | Variable | Source |
|---|---|---|---|
| Pool of Radiance (PC 1.3) | `/home/tmg/poolrad-files` | `POOLRAD` | GOG Mac installer `pool_of_radiance_enUS_1_3_31236.pkg` |
| Curse of the Azure Bonds (1.0) | `/home/tmg/coab-files` | `COAB` | GOG Mac installer `curse_of_the_azure_bonds_enUS_1_0_31854.pkg` (in `/home/tmg`); includes the Manual, Cluebook and Adventurer's Journal PDFs and `COPYCURS.EXE` |
| Secret of the Silver Blades | `/home/tmg/sotsb-files` (Mac: `~/Downloads/BLADES`) | `SOTSB` | GOG installer `secret_of_the_silver_blades_enUS_1_0_33010.pkg`; unpacked 2026-10-21; research started 2026-10-22 (`spec/A-games/sotsb/`) |

```sh
cd web
POOLRAD=/home/tmg/poolrad-files COAB=/home/tmg/coab-files SOTSB=/home/tmg/sotsb-files npx vitest run
```

On Tristan's Mac the folders are `~/Downloads/POOLRAD`, `~/Downloads/CURSE` and `~/Downloads/BLADES`
(SotSB's game files sit directly in the package's `game/` folder, not in a sub-folder).

On another machine: the GOG Mac `.pkg` files are DOSBox wrappers round the DOS games. Unpack with
`python3 tools/xar_extract.py GAME.pkg OUTDIR`, then the `Scripts` member is a gzip cpio archive
whose `payload/Contents/Resources/game/<FOLDER>/` is the game folder (`POOLRAD`, `CURSE`, …).

The headless playthrough harness takes extra variables (`POR_PLAY_SEEDS`, `POR_PLAY_STEPS`,
`COAB_PLAY_SEEDS`, `COAB_PLAY_STEPS`, `…_TRACE`, `…_FIRST`); see `web/test/porplay.test.ts`,
`coabplay.test.ts` and `web/headless/harness.ts`.

## Reverse engineering

### The executables

`START.EXE` is EXEPACK-packed and `GAME.OVR` holds Borland overlays (Turbo Pascal). Before any
disassembler sees the whole engine:

```sh
python3 tools/unexepack.py START.EXE out/START.unpacked.EXE                   # unpack
python3 tools/mergeovr.py out/START.unpacked.EXE GAME.OVR out/merged.EXE        # overlays merged in: stubs → JMP FAR, fixups as relocations
```

Addresses in the spec are `FUN_seg_off` (Ghidra's names in the merged PoR image) or image offsets
for CotAB; `spec/D-appendices/` has the address index. Output of these tools contains game code, so
it stays outside the repository (`out/` is ignored).

### REA (Ghidra through MCP)

Decompiling was done with **REA**, an MCP server that drives Ghidra (and rizin), used from Claude
Code. On the dev server it is registered for the user (`~/.claude.json`) and in this repository's
[`../.mcp.json`](../.mcp.json):

| | |
|---|---|
| Server | `npx -y rea-agents@6.5.0 mcp` (stdio) |
| Ghidra | 12.1.4 at `/home/tmg/opt/ghidra_12.1.4_PUBLIC` (`GHIDRA_INSTALL_DIR`) |
| Java | Temurin JDK 21.0.12.1 at `/home/tmg/opt/jdk-21.0.12.1+1` (`JAVA_HOME`) |
| rizin | `/home/tmg/opt/rizin/bin/rizin` (`REA_RIZIN_COMMAND`) |
| Skill | `reverse-engineer-anything` in `~/.claude/skills/` (how to use REA's tools; from the REA package) |

`.mcp.json` reads those three paths from the environment and falls back to the dev server's, so on
another machine export `GHIDRA_INSTALL_DIR`, `JAVA_HOME` and `REA_RIZIN_COMMAND` before starting
Claude Code. REA does not install Ghidra or Java itself. `npx -y rea-agents@6.5.0 doctor --client claude_code --json` checks
the setup; `setup --client claude_code --dry-run --json`, then `--yes`, registers the server and
installs the matching skill. Restart Claude Code afterwards so the tools appear.

How it was used: open the merged image (`open_binary`), then `procedure_pseudo_code`,
`procedure_callers`/`xrefs`, `search_strings`, `read_bytes`; name routines as they are understood.
Close the session when finished: Ghidra's JVM is the largest process on the server. For a quick look, `objdump -D -b
binary -m i8086` on the unpacked image is lighter and was used for most table reading.

REA is optional. Every finding is already in `spec/` with its address, and the port does not need it;
it is needed only to answer a new question about the original.

### The originals in DOSBox

`tools/dosbox/` runs an original game unattended in DOSBox Staging: keys typed by its `AUTOTYPE`,
screens grabbed with F12 by a small resident program, the saves it writes kept; `viewcheck.py`
compares the drawn view with the port's. How to get each game into play, and the requirements, are
in [`../tools/dosbox/README.md`](../tools/dosbox/README.md):

```sh
export DOSBOX=~/opt/dosbox-staging-linux-x86_64-0.83.0-7b400/dosbox NASM=~/opt/nasm/usr/bin/nasm
python3 tools/dosbox/viewcheck.py por /home/tmg/poolrad-files
```

There is no debugger: DOSBox Staging's release builds have none, and DOSBox-X (which has one) is not
installed. Questions that need one (PoR's register 0x035F, `TODO.md`) stay open.

## References outside the repository

- Stephen S. Lee's GameFAQs guide to Pool of Radiance (PC 1.3), v2.00 (April 2026), with a
  technical analysis of the engine (§12) and a bug list:
  [GameFAQs](https://gamefaqs.gamespot.com/pc/564785-pool-of-radiance/faqs/73869); a local copy is
  at `/home/tmg/poolrad-reference/gamefaqs-lee-v2.00.md` (not committed: its copyright)
- Simeon Pilgrim's C# CotAB rebuild, [github.com/simeonpilgrim/coab](https://github.com/simeonpilgrim/coab):
  no licence, so only a pointer to where to look (rule 5 in `CLAUDE.md`); not cloned on the server
- Journals: Pool of Radiance Wiki and Gold Box Wiki transcriptions (CC BY-SA, credited in the README);
  SotSB's transcribed from the archive.org scan of its printed Adventurer's Journal (`web/src/data/sotsb-journal.json`)

## Tristan's Mac

The 2026-10-22 session (Silver Blades, the first DOSBox checks) ran on Tristan's Mac:

- Game folders `~/Downloads/POOLRAD`, `~/Downloads/CURSE`, `~/Downloads/BLADES` (above).
- Git's own network operations do not work there: [`../transfer-repo.sh`](../transfer-repo.sh) pushes
  `main` to GitHub (fast-forward only) or fetches it, as a bundle through a throw-away Docker
  container with the host's SSH agent forwarded (Docker Desktop's `/run/host-services/ssh-auth.sock`;
  the remote there is `git@github.com:…`). On the server, plain `git push` works.
- Browser checks used Playwright with Chrome (Playwright from `web/node_modules`; a fork's worktree
  symlinks it, never commits it). DOSBox Staging 0.83 (`/opt/homebrew/bin/dosbox-staging`) and NASM 3.02
  (`/opt/homebrew/bin/nasm`) are installed, so `tools/dosbox/` runs as on the server
  (`DOSBOX=/opt/homebrew/bin/dosbox-staging NASM=/opt/homebrew/bin/nasm`); several instances can run at
  once (each run copies the game).
- The app and accounts server runs there too, for quick testing: the launchd agent
  `~/Library/LaunchAgents/org.goldbox-rerolled.plist` (from `server/goldbox-rerolled.plist`, [server.md](server.md),
  "launchd (macOS)"), on `http://127.0.0.1:8080/` only, plain HTTP, data in `~/.local/share/goldbox-rerolled`,
  log `/tmp/goldbox-rerolled.log`. It serves `web/dist`: `npm run build` updates it; restart it after a change
  under `server/` with `launchctl kickstart -k gui/$(id -u)/org.goldbox-rerolled`.
- Editor swap files (`*.swp`) are ignored by `.gitignore` since one was committed by mistake.

## Browser play-testing

Done with short throw-away Playwright scripts (not committed) against `vite preview`, headless
Chromium at desktop and phone sizes, the game folder imported through the folder picker; the
observations are recorded in `spec/C-port/` (`app-flow.md`, `screens.md`, `ui-contract.md`).
In an environment with Chromium elsewhere, pass `executablePath` to `chromium.launch` rather than
running `playwright install`.
