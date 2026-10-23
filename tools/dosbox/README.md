# Running the originals in DOSBox

A harness that runs an original Gold Box game unattended in DOSBox Staging, types keys into it and
keeps what it shows and writes, so the port can be compared with the real game
([`spec/VALIDATION.md`](../../spec/VALIDATION.md) §4). Nothing here contains game data; the game is
copied from the player's folder for each run and the copy is thrown away.

| File | What |
|---|---|
| `grab.asm` | `GRAB.COM`, a small resident program: F12 writes the screen on show (EGA planes from the CRTC start address, attribute palette, DAC) to `FRAMEnn.EGA` in the game's folder |
| `run.py` | one unattended run: copy the game, build `GRAB.COM`, a `RUN.BAT` with `AUTOTYPE` and `START STING`, DOSBox headless (`SDL_VIDEODRIVER=dummy`), then the frames (with a PNG of each) and every file the game changed |
| `egaframe.py` | a dump as a PNG, its 88 × 88 view (pixels 24–111), and that view compared with a port frame |
| `viewcheck.py` | the drawn-view check from save A, PoR, CotAB or SotSB: five frames (as loaded, four left turns, a step) against the headless runner's; with `--moves`, a scripted walk with a frame after each move |

## Requirements

- **DOSBox Staging** (0.83.0 used on the server: the Linux release tarball unpacked in `~/opt`, no
  root needed); `$DOSBOX` or `--dosbox` points at its `dosbox`. Its `AUTOTYPE` types the keys.
- **NASM** to build `GRAB.COM` (3.01 on the server: `apt-get download nasm` and `dpkg -x` into
  `~/opt/nasm`, no root needed); `$NASM` or `--nasm`.
- Python 3 with Pillow (PNG), and Node 24 for the port's side of `viewcheck.py`.

```sh
export DOSBOX=~/opt/dosbox-staging-linux-x86_64-0.83.0-7b400/dosbox NASM=~/opt/nasm/usr/bin/nasm
python3 tools/dosbox/viewcheck.py por  /home/tmg/poolrad-files      # 5 of 5 frames equal
python3 tools/dosbox/viewcheck.py coab /home/tmg/coab-files
python3 tools/dosbox/viewcheck.py sotsb /home/tmg/sotsb-files
python3 tools/dosbox/viewcheck.py por /home/tmg/poolrad-files --moves fblfrffrfffffffrfffblfff   # 25 of 25
python3 tools/dosbox/run.py --game /home/tmg/poolrad-files --out out/run1 \
        --keys "x enter l a f12 left f12" --wait 5 --pace 2.5 --seconds 45
```

## Getting into play

Keys are `AUTOTYPE` button names (`AUTOTYPE -list` in DOSBox), typed from `--wait` seconds after
start at `--pace` seconds apart while the game runs; a key typed before the game is ready is lost, so
the pace is generous. Grab with `f12` to see where a run got to.

- **Pool of Radiance**: `START STING` skips the title and credits. The translation wheel follows,
  and this release accepts any word (`x enter`); then the party screen: `l a` loads save A and play
  starts at once.
- **Curse of the Azure Bonds**: `START STING` skips the title; `p` chooses Play at the Play/Demo
  menu (it starts the demo by itself after 30 s). The code wheel follows: this release accepts any
  character **except the right one** (the branch at image 0x1C627 is inverted,
  [`spec/A-games/coab/assets.md`](../../spec/A-games/coab/assets.md) §7), so `numbersign enter`
  (`#`, never an answer) always passes. Then `l a b` (Load, A, Begin) and two `enter`s for the
  opening's "press Enter" screens. CotAB keeps its saves in `SAVE\`.
- **Secret of the Silver Blades**: `--args Hoop` (its `STING`) skips the title; `p` for Play; no
  code wheel. The party screen is a highlighted list moved with `down` (Load is the third row, `enter`,
  `enter` for slot A; Begin is then five rows down). Save A is the game's start: nine `enter`s, the
  treasure left with `e n`, three more `enter`s. The game flushes keys typed while it is busy, so type
  it at `--pace 5`. Its arrows move the party only after `m` (Move); outside Move, Up and Down change the
  current character. The game is copied to `C:\SAVE`, its configured save path.

The games run at DOSBox's default cycles. To force an outcome, `--patch FILE:OFFSET:HEX` writes bytes into the copy (an overlay
routine's bytes are found in `GAME.OVR` by searching for them; offsets in the merged image differ).
The rest-counter check (PoR save A, New Phlan) forces the rest-encounter chance and the game speed in
the copied save, whose ECL code buffer the game runs from (save offset 0x1401 = ECL 0x9900): the camp
script's `SAVE 24 → 0x6DD3` at ECL 0x9A42 has its value at 0x9A44 = save offset **0x1545**, and the game
speed is A byte 0x1F8 = save offset **0x1F9**:

```sh
python3 tools/dosbox/run.py --game /home/tmg/poolrad-files --out out/rest \
        --patch SAVGAMA.DAT:0x1545:64 --patch SAVGAMA.DAT:0x1F9:00 \
        --keys "x enter l a e r h i r e e r h i r f12" --wait 5 --pace 4 --seconds 120
```

Rest one hour, leave camp, camp, rest one hour: the orcs come at 12:50, the 24th five-minute step
overall (interval 24 steps), so the step counter `DS:49FB` carries over between camps.

## Walks with pauses, other saves, saves compared

`viewcheck.py --moves` takes `e` after a move for each "press Enter" pause it brings up (a square's
text): the port answers 0, the original is typed P, that one-item menu's key, and one P more after
every move. P does nothing at the main menu (Enter there would choose Area and draw the overhead
map), so a pause the original's dice give and the port's do not, such as Tilverton's random rumours,
cannot shift the walk. `--save X` starts from save X (PoR, CotAB). The headless runner's transcript
shows which menus a walk meets; a short script that tries the port's moves breadth first finds
walks with no other questions on the way. A walk is typed in one `AUTOTYPE` line, so keep it to
about 15 moves.

To put both sides somewhere else, let the port write the save: `headless/run.ts --script` with a
`jump` and `--save <folder>/SAVE --slot B` writes `SAVGAMB.DAT` and the party files into a copy of the
game folder, the original loads it (`p numbersign enter l b b` in CotAB) and so does the port
(`"save": "B"`).

The saves themselves: the original saves only from the camp menu (CotAB `e s <slot>`), so the port's
side camps too (the headless `e`, which runs the area's `camp_menu` and its rest-encounter odds),
then `--save` writes its files under the original's names; compare them byte by byte. Expected
differences: the bytes past each party stem in `SAVGAM<x>.DAT` (stack garbage in the original), the
record and effect list pointers in `.SAV` and `.FX` (memory addresses), CotAB's inert 0x3206 and
whatever the two sides' dice decided.

## How GRAB.COM works

F12 (scan code 58h) is taken from INT 09h and never reaches the game. The dump runs at the next
keyboard call (INT 16h), timer tick (the games take INT 08h for their sound but hand on to the old
handler every 13 ticks) or DOS idle call (INT 28h), when InDOS allows; it switches to its own PSP for
the file, reads the four planes through the Graphics Controller's read map in read mode 0 and puts
the Graphics Controller back as it was. The machine is DOSBox's default `svga_s3`, whose EGA
registers can be read back.
