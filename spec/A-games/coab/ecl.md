---
created: 2026-10-19
tags: [reverse-engineering, gold-box, coab, spec]
---

# CotAB ECL virtual machine: diff against PoR `engine/ecl.md`

> **Status: complete as a set of differences.** Normative. Part A of the
> [specification](../../README.md): Curse of the Azure Bonds, GOG 1.0 (`START.EXE` + `GAME.OVR`
> merged). Read [engine/ecl.md](../engine/ecl.md) first: this file lists what differs from it, plus
> everything needed to implement the CotAB VM; anything not mentioned behaves as in PoR. The engine
> model's map of both games' script memory is [B-model/script-vm-map.md](../../B-model/script-vm-map.md).
> Evidence marks as in the README.

Addresses are **image offsets** into `coab/img.bin` (overlay segment in brackets: `1885:xxxx` = image 0x18850 + xxxx; Ghidra segment = paragraph + 0x1000, so `1885:xxxx` is `FUN_2885_xxxx`). DS = image paragraph 0x0ABE (DS:x = image 0xABE0 + x; O: the clock-modulus table DS:3E2C sits at image 0xEA0C). PoR handler addresses are `29c3:xxxx` as in the PoR spec.

*Informative:* disassembler `tools/coab/ecl_coab.py`. 25 records in ECL1–6, **0 decode errors**, 96.7% of code bytes reachable (see [Decoder status](#decoder-status)).

## Why `tools/ecl.py` fails on CotAB (O)

1. **Code base moved**: CotAB maps the code at **0x8000** (PoR 0x9900). `ecl.py` uses `BASE = 0x9900`, so every vector (0x80xx) falls outside its walk window; for ECL2–6 it silently prints only the vector lines. In ECL1 record 80 the `camp_menu` vector is 0x9BF4, which `ecl.py` decodes 0x1900 bytes off, hence "bad opcode 81 at 9C67".
2. **New opcodes 0x3E, 0x3F, 0x40** (and changed operand counts for 0x34, see table). These are used in the data (`DESTROY_ITEMS` 13 times, `DROP_CHARACTER` 5, `FIND_EFFECT` 2, `PASS_TIME` 2).
3. Operand encoding, record header (`88 13`), DAX container and RLE are **unchanged**.

## Engine entry points (O)

| What | CotAB image | (seg:off) | PoR |
|---|---|---|---|
| run loop `run(start)` | 0x1BE57 | 1885:3607 | 29c3:3171 |
| dispatcher (cmp/call chain, opcodes 0x00–0x40) | 0x1BBF2 | 1885:33A2 | 29c3:2f2d |
| operand reader (count in AL) | 0x1FA02 | 1f9d:0032 | 2fea:0000 |
| numeric value of operand i | 0x1FB38 | 1f9d:0168 | 2fea:0136 |
| `make_word(lo, hi)` = hi<<8 \| lo | 0x200A7 | 1f9d:06d7 | — |
| VM reset / read vectors | 0x1FBB8 | 1f9d:01e8 | 2fea:01b6 |
| load `ECL<game_area>` record | 0x1FD3C | 1f9d:036c | — |
| address classifier | 0x200F3 | 1f9d:0723 | 2fea:06fb |
| B-array mapped read / write | 0x201B4 / 0x2051F | 1f9d:07e4 / 0b4f | 2fea:07bc / 0a74 |
| mem write (addr, value) | 0x20722 | 1f9d:0d52 | 2fea:0c77 |
| mem read (addr) | 0x208E6 | 1f9d:0f16 | 2fea:0e0c |
| string write (addr, str) | 0x20A2D | 1f9d:105d | — |
| packed-text decoder (len, k) | 0x20C49 | 1f9d:1279 | 2fea:1153 |
| 6-bit code → ASCII | 0x200CB | 1f9d:06fb | 2fea:06d3 |
| load string variable into buffer k | 0x20DF1 | 1f9d:1421 | — |
| IF skip routine | 0x219A2 | 1f9d:1fd2 | 2fea:1ea6 |
| area entry (on_enter, then on_move, on_step) | 0x1BEC7 | 1885:3677 | — |
| adventure main loop | 0x1BFA8 | 1885:3758 | — |
| camp (`camp_menu`, camp screen, `camp_confirmed`) | 0x1B8E4 | 1885:3094 | — |

Calls into overlays go through VROOMM stubs that the merge already patched into `jmp far` (`EA off seg`); resolve `lcall stub:off` by reading the 5 bytes at the stub. A disassembly must also fix objdump's near-call targets in segments that cross a 64 KB boundary (segment 1f9d does).

## VM state (O)

| Item | CotAB | PoR |
|---|---|---|
| PC | DS:4FCD (word) | DS:49ED |
| code buffer far ptr | DS:4FBE, 0x1E00 bytes (alloc 0x26B13) | DS:49DE |
| byte at virtual a | `buf[a − 0x8000]` (`es:[di−0x8000]`, 0x1BE86) | `buf[a − 0x9900]` |
| current / previous opcode | DS:7619 / DS:7618 | — |
| stop flag / quit (game over) flag | DS:47F8 / DS:4FE0 | — |
| compare flags EQ NE LT GT LE GE | DS:7612..7617 | DS:6F78..6F7D |
| GOSUB stack | linked list, head far ptr DS:760A, 6-byte nodes {PC, next} | linked |
| operand tables (index 1..63) | kind DS:769F+i, HI DS:76DF+i, LO DS:771F+i | 7005 / 7045 / 7085 |
| string buffers (Pascal, 256 B) | DS:7662 + k·0x100, k = 1, 2, … (DS:7762, 7862) | DS:6FC8 + k·0x100 |
| vectors | DS:4FC3, 4FC5, 4FC7, 4FC9, 4FCB | — |
| current character / party list head | DS:6520 / DS:6524 (far ptrs; next = char[0x189]) | DS:5D92 / 5D96 |
| char saved by engine (restored at EXIT/PROGRAM if DS:47FA) | DS:47FF | DS:4436 |

## Loading (O)

- **New game or load (0x1BFED–0x1C050)**: the area to load is A[0x4BF2]; if it is 0 the game starts at record **1** (record 82, the demo, when DS:4FD5 ≠ 0: [Start-up menu and demo (O)](#start-up-menu-and-demo-o)) and loads its script, otherwise a load restores the saved script buffer (DS:47FB = 1). The shipped `SAVGAMA.DAT` names area 0 with an empty buffer, so a new game begins at ECL2 record 1. Then the reset (0x1FBB8) and `on_enter`.

- `ECL<n>.DAX` where n = DS:5C08 (block digit); record id = area id (CotAB blocks: ECL1 80–82, ECL2 1–4, ECL3 16–18 21, ECL4 32–35 37, ECL5 48–51 53, ECL6 64 66 67 69)
- 0x1FD3C: zero the 0x1E00 buffer, show "Loading...Please Wait", retry until size ≥ 2, copy record bytes 2.. to the buffer start; all records start `88 13`, largest 7622 code bytes (fits 0x1E00)
- Code occupies virtual **0x8000–0x9DFF** (classifier 0x200F3)
- Reset 0x1FBB8: PC = 0x8000 (0x1FBF7), GOSUB stack freed, flags cleared, icon slot DS:761D = 8, `B[0x7EE1]` = 0xFF, `B[0x7ED2]` = `B[0x7ED3]` = 0, `A[0x4BE5]` = 0, reads the 5 vectors with the normal operand reader, `A[0x4BE6]` = 1; unless restoring a save (DS:4FDB ≠ 0) zero **0x4C00–0x4C1F** and **0x7F79–0x7F82**. Same set as PoR, addresses shifted (below). Also DS:7602 = 0x41, DS:7603 = 0x09 (engine registers 0xC059/0xC05F defaults)

## Start-up menu and demo (O)

The main program's loop (image 0x11F–0x352, main segment, CS = paragraph 0) and DS:4FD5, the demo flag. The engine model's demo flags are [B-model/procedures.md §16](../../B-model/procedures.md#16-demo-mode); PoR has no menu and no demo (no "Demo" in its START.EXE or GAME.OVR); its DS:49F4 is the same flag's vestige: cleared at start-up (0x26FDB) and tested once, before "Continue Battle:" (0x22A3F), never set.

**The menu.** After the title sequence (0x18702, skipped when ParamStr(1) = `STING`, 0x169–0x17A) the menu routine **0x51C48** (`lcall 0x104:0x2A`) shows the Pascal strings at **CS:0006** "Curse of the Azure Bonds v1.3 " (title, colour 13) and **CS:0025** "Play Demo" (choices; the call's other colours are 10 and 15, I: plain and highlighted), image 0x06 and 0x25; the answer goes to DS:47F6.
- Choices: 0x5194A splits the string into runs of the characters in its set at 0x51A39 (digits and letters); a key is matched against the string's capitals (0x51F18–0x51F9B), so **P** and **D**. Enter returns the highlighted choice's key (0x51E9D), Escape returns 0 (0x51E8B).
- **Timeout**: with DS:72B0/72B2 (a dword) non-zero the routine returns DS:72B4 once that long has passed without a key (0x51E1F–0x51E52). The time is 0x5668: INT 21h/2Ch as h·360000 + m·6000 + s·100 + hundredths, so the unit is **1/100 s**. The first menu: **3000 (30 s), key 'D'** (0x17F–0x18B); after a demo: **1000 (10 s), 'D'** (0x2D1–0x2DD); both cleared after the call (0x1B6–0x1BE, 0x308–0x310). An unattended game therefore runs the demo after 30 s and repeats it.
- **D** sets DS:4FD5 = 1 (0x1C3–0x1CA; the repeat menu sets it to 0 or 1, 0x315–0x31F); any other answer plays.

**The loop (0x1F6–0x352).** Copy protection (0x1C378) unless ParamStr(2) equals the string at DS:8C94 (**?**) or the demo is on (0x1D9–0x1F1, and 0x32C–0x344). Demo: DS:5C08 = **1** (block) and DS:4FC2 = **9** (game speed, the slowest), else block 2 (0x1F6–0x20E). Then 0x36850 (screen and memory set-up); **the party screen 0x36A1C only when not the demo** (0x22F); 0x536A0, 0x53805, 0x18850, then the game 0x1BFA8, then 0x26A50, 0x27135. Not the demo: round again. Demo: the title sequence again (0x2C7), the keys flushed (0x6952), the menu with the 10 s timeout, round again.

**DS:4FD5 sites** (every test of the flag; those reachable in the demo are the behaviour a demo must reproduce):

| Address | Routine | In the demo |
|---|---|---|
| 0x1CA, 0x31F | main loop | set by the menu's D |
| 0x1EA, 0x33D | main loop | no copy protection |
| 0x1F6 | main loop | block 1, speed 9 |
| 0x22F | main loop | no party screen: the demo starts with an empty party |
| 0x2BD | main loop | after the game: title, menu again |
| **0x1BFFA** | new game (0x1BFA8) | area 0 starts at record **0x52 = 82** (not 1), and the party recompute 0x4D7E8 is skipped |
| **0x1C069** | new game | after `on_enter`: `0x3A275(1, 1)` (drop the current character) until the party list DS:6524 is empty, then return: **no main loop** (no moving, camping, saving); the demo is ECL1 #82's `on_enter` alone |
| **0x6819** | key read 0x6812 | `KeyPressed ? ReadKey : 0`: **key reads never wait**. Menus (0x51C48) poll KeyPressed themselves and still wait (I: the demo shows none) |
| 0x5514 | text input 0x53F6 | stops after one key read (I: an empty answer); not reached by the demo |
| **0x227EF** | round end (combat) | **"Continue Battle:" is not asked** when the enemy side is gone: the battle ends |
| **0x1EE98** | after a battle 0x1EE82 | the outcome 0x1DC36 (who won, DS:4FE0 "party destroyed") is skipped |
| **0x1EEAC** | after a battle | after the clean-up 0x1EAA7 (monsters and side-1 entries leave the list) everything to 0x1F04F is skipped: the members' recompute (0x4DC70), the destroyed-party path (0x1EFB6), freeing the item list at DS:6FA6, and the rest below |
| 0x1EF4E | after a battle | (reached only outside the demo) NPC shares 0x1EBEE, the summary and experience 0x1E19C ("The party has won.", "Each character receives…", "press <enter>/<return> to continue"), treasure 0x1E7A3 |
| 0x1DD2F | outcome 0x1DC36 | unreachable in the demo (its one caller, 0x1EEA0, is skipped) |
| 0x36DD5 | party screen 0x36A1C, Begin | Begin with an empty party allowed; unreachable in the demo (0x22F) |
| 0x26EE7 | start-up 0x26AA4 | cleared |

There is no key test that ends the demo (O: no other reader of DS:4FD5; the key read returns what was pressed and nothing compares it in the demo's path, I). A key pressed during it is read by whatever reads keys: Ctrl-S toggles the sound (0x6841), and in combat the AI turn's keys (I).

**The demo's script, ECL1 #82** (922 bytes; on_enter 0x8014, the other vectors EXIT):
1. `LOAD_AREA 127, 127, 127` (no map), `REDRAW_SCREEN`, `PICTURE 80`; **`ADD_NPC` 85, 88, 90 with morale 100**: RUSTLE, CYNTHIA and GRENDEL (MON1CHA; control byte 0x198 = 1, morale 0xFF: the computer plays them).
2. Pages of text with four `PAUSE`s each (PAUSE = Delay(DS:4FC2 · 100 ms), 0x1B15B → 0x57F9, so 3.6 s a page at speed 9): "ON YOUR WAY TO THE TOWN OF TILVERTON YOU ARE AMBUSHED…", "THE SYMBOLS ENSNARE YOUR WILL LIKE METAL BONDS…", then `PICTURE 121` (BIGPIC) "YOUR ONLY HOPE IS TO SEARCH THE FORGOTTEN REALMS…".
3. `REDRAW_SCREEN`, `PICTURE 29`, "NOWHERE IN THE REALMS IS COMPLETELY SAFE…", **eleven `CALL 0x6803`** (the next frame of the picture, then the same Delay: these are the only uses of 0x6803 in the game).
4. `SAVE 0 → 0x4BE6` (overland state), `CLEAR_MONSTERS`, 0x7F70 = 250, 0x7F71 = 8, 0x7ECB = 2, **two BLACK DRAGONs** (MON1CHA 53, picture 53), `COMBAT` with the computer on both sides, two `PAUSE`s.
5. `SAVE 1 → 0x4BE6`, `PICTURE 1` "WHILE THE RISK OF ADVENTURE IS GREAT…", `PICTURE 123` "BUT THE ULTIMATE PRIZE IS NOT GOLD OR POWER…", "YOUR ENEMIES ARE PREPARED…", four `PAUSE`s each.
6. **`PROGRAM 3`**: DS:4FE0 = 1 (quit), then EXIT (0x1BA7E; ECL1 #82 is its only use). Then the party is dropped (0x1C069) and the loop shows the title and the menu again.

The demo's battle (O): the grid builder 0x25CC0 loads `DungCom` when A 0x1CC (ECL 0x4BE6) is set, else `WildCom` (strings at 0x25CA8/0x25CB0), then `RandCom`; with 0x4BE6 = 0 it takes the wilderness generator 0x25C58: every cell 0x17 (open ground), terrain type DS:4A2C = A byte 0x342 (ECL 0x4CA1, the overland place), its feature flags from the place table **DS:0354** (0x25621; PoR used a range table over overland tiles), then the passes 0x25690 (river), 0x2579B (trees and logs) and 0x25ADA (scatter), all three CotAB's own procedures, and **no finishing pass** ([combat.md](combat.md)). The demo never sets 0x4CA1, so it fights on place 0's terrain (flags 0: no river, trees and logs at 10 %, then grass, pebbles and rocks). Every CotAB battle with 0x4BE6 = 0 (the overland) is built this way. Port: done (`R.wildBattle`, `T.placeTerrain`, `R.wildField`; until 2026-10-20 the port ran PoR's passes, whose finishing pass put RandCom's table 0x1A and chair 0x1B on the field).

## Vectors (O)

Same five slots and semantics as PoR; code starts with five `GOTO` (in CotAB data the operand is kind 1, `01 01 lo hi`); the reset stores `make_word(lo,hi)` regardless of kind. The "nothing" target is now **0x8014**.

| Slot | Address | Stored at | Run by |
|---|---|---|---|
| 0 on_move | 0x8000 | DS:4FC3 | main loop before a move (0x1C1A0), and after area entry (0x1BF5D) |
| 1 on_step | 0x8004 | DS:4FC5 | after the move (0x1C22F), on Look/Search with `B[0x7ECA]` = 1 (0x1C158), after area entry (0x1BF6C) |
| 2 camp_menu | 0x8008 | DS:4FC7 | Encamp ('E', 0x1C127) and `PROGRAM 9`, via 0x1B8E4 |
| 3 camp_confirmed | 0x800C | DS:4FC9 | after the camp screen (0x321CB) returns set |
| 4 on_enter | 0x8010 | DS:4FCB | area entry 0x1BF0C, and new game/load 0x1C061 |

## Instruction encoding (O, reader 0x1FA02)

**Unchanged from PoR.** opcode, then n operands `kind lo [hi | text]`:

| kind | bytes | numeric value (0x1FB38) | string (into buffer k) |
|---|---|---|---|
| 0x00 | kind lo | lo | — |
| 0x01, 0x03 | kind lo hi | mem_read(hi<<8\|lo) | — |
| 0x02 | kind lo hi | hi<<8\|lo | — |
| 0x80 | kind len, len packed bytes | mem_read(stale_hi<<8\|len) | decoded text (len 0 → empty, no bytes) |
| 0x81 | kind lo hi | hi<<8\|lo | **string variable** at hi<<8\|lo copied in by 0x20DF1 |
| other | kind lo | undefined | — |

- After the last operand PC += 1. HI is written only for kinds 1, 2, 3, 0x81 (stale HI otherwise, as PoR)
- Variadic opcodes (0x15, 0x25, 0x26, 0x2B): read k fixed operands, `dec PC`, read N = value of the count operand more operands (O: 0x1978B, 0x19936, 0x1A35D)
- Packed text (0x20C49): identical to PoR: 6-bit codes MSB-first, 4 per 3 bytes, code 0 skipped, code ≤ 0x1F → +0x40 (0x200CB), else itself. The decoder advances PC itself
- String variable load (0x20DF1): A/B/C: one character per word until a 0 word; **B address 0x7C00 exactly: the current character's name** (char[0], Pascal); code area: bytes until 0; engine registers: empty
- Kinds in the shipped data: 0x00 6830, 0x01 10060, 0x02 37, 0x80 2902, 0x81 131; kind 3 never occurs

## Memory map (O, 0x200F3 / 0x208E6 / 0x20722)

| Range | Kind | Storage | PoR range |
|---|---|---|---|
| **0x4B00–0x4EFF** | word array A | far DS:4FB2 (0x800 bytes), offset (n−0x4B00)·2 | 0x4900–0x4CFF |
| **0x7C00–0x7FFF** | word array B (+ character view) | far DS:4FB6 (0x800 bytes), offset (n−0x7C00)·2 | 0x6B00–0x6EFF |
| **0x7A00–0x7BFF** | word array C | far DS:4FBA (0x400 bytes) | 0x9700–0x98FF |
| **0x8000–0x9DFF** | code bytes (write stores low byte) | DS:4FBE | 0x9900–0xB6FF |
| anything else | engine registers (below) | — | same |

Translation rule for PoR addresses: A `0x49xx/0x4Axx` → `0x4Bxx/0x4Cxx` (+0x200); B `0x6Bxx–0x6Exx` → `0x7Cxx–0x7Fxx` (+0x1100). Offsets inside A and B are the same as PoR wherever checked (O for every row of [Engine-visible variables](#engine-visible-variables-o-engine-code-touching-the-word-meaning-i-where-it-rests-on-the-por-analog)).

### Side effects of A writes (0x20722, O)

| Address | Effect | PoR |
|---|---|---|
| 0x4BFD, 0x4BFE | DS:8B84 = 1 (I: redraw request, consumed by CALL 0x2E10) | 0x49FD/FE → DS:84E8 |
| **0x4BE6** | if the value changes: DS:4FD4 = DS:4FD3; DS:4FD3 = 3 if new value 0, else 4 (I: 4 = 3D dungeon view, 3 = overland/wilderness) | new |

### B as a view of the current character (O, read 0x201B4, write 0x2051F)

Offsets relative to 0x7C00 (identical to PoR's offsets from 0x6B00); the character record is the CotAB 0x1A6-byte one at DS:6520, so the char offsets differ from PoR. A write always stores the B word first (0x207A3), then applies the mapping. Unmapped reads return the B word.

| B addr | off | Read | Write | vs PoR |
|---|---|---|---|---|
| 0x7C00 | 0x00 | buffer | value 0 sets DS:8B6D | same (PoR DS:84D3) |
| 0x7C15 | 0x15 | char[0x13] | — | **new** |
| 0x7C18 | 0x18 | char[0x19] | — | PoR char[0x14] |
| 0x7C20–0x7C70 | 0x20–0x70 | buffer | char[n − 0x7C01] = low byte (char[0x1F..0x6F], spell list base char[0x1E], 1-based) | PoR char[0x17+…] |
| 0x7C72 | 0x72 | char[0x74] signed | — | **new** (I: race) |
| 0x7C73 | 0x73 | char[0x75] signed | — | **new** (I: class) |
| 0x7C9B | 0x9B | char[0xE0] | — | PoR char[0x6E] |
| 0x7CA0 | 0xA0 | char[0xE5] signed | — | PoR char[0x73] |
| 0x7CA5–0x7CAC | 0xA5–0xAC | char[0xE9 + (off − 0xA4)] = char[0xEA..0xF1] (thief skills) | — | PoR [0x77..0x7E] |
| 0x7CB8 | 0xB8 | char[0xF7] | char[0xF7] = v (−0x32 if v > 0xB2) | PoR [0x84] |
| 0x7CBB…0x7CC3 (odd) | 0xBB…0xC3 | words char[0xFB], [0xFD], [0xFF], [0x101], [0x103] | same | PoR [0x88..0x90] |
| 0x7CC9 | 0xC9 | f(char)·char[0x116] + char[0x10E], f = FUN 0x51841 (signed bytes): the magic-user level with its dual-class part (O, [tables.md](tables.md) §3.7a) | — | **new** |
| 0x7CD6 | 0xD6 | char[0x119] signed | — | **new** |
| 0x7CD8 | 0xD8 | char[0x11B] signed | — | PoR [0xA0] |
| 0x7CE4 | 0xE4 | char[0x192] & 1 | — | **new** |
| 0x7CF7 | 0xF7 | word char[0x13C] | same | PoR [0xB8] |
| 0x7CF9 | 0xF9 | char[0x13E] | same | PoR [0xBA] |
| 0x7D00 | 0x100 | 1 if char[0x196] ≠ 0 else 0x80; **0 if DS:8B87 = 1** (LOAD_CHARACTER 0x18B39 sets it when the index is past the end of the list, else clears it; the current character is then unchanged), and every read clears DS:8B87 (0x20390) | v ≥ 0x80: char[0x196] = 0, v = 0x87 also char[0x195] = 7; v = 0 sets DS:8B6C | DS:8B87 part new |
| 0x7D0C | 0x10C | 0x80 if [0x197]=0 and [0x198]≠0; 0x81 if [0x197]=1; else 0 | 0 → 0,0; 0x80 → 0,1; 0x81 → 1,1 into [0x197],[0x198] | PoR [0x10E],[0x10F] |
| 0x7D0D | 0x10D | undefined | — | same |
| 0x7D1B | 0x11B | char[0x1A5] (movement) | — | PoR [0x11C] |
| 0x7EB1, 0x7EB4 | 0x2B1, 0x2B4 | party position of current char (0x2014E) | — | same |
| 0x7ECF | 0x2CF | CHA table on char[0x1B], same values as PoR | — | same |
| 0x7F12 | 0x312 | block digit DS:5C08 | switch block (0x066DC) | same |
| 0x7F22/24/26 | 0x322/4/6 | buffer | v > 0x80: load wall set v & 0x7F into slot 1/2/3 (0x546C5) | same |
| 0x7F3E | 0x33E | party size (B word itself) | — | same |

Writing 0 to 0x7C00 and 0 to 0x7D00 sets DS:8B6D and DS:8B6C; a following `LOAD_CHARACTER` with bit 7 set then **removes that character from the party** (0x18BCD–0x18C06: both flags → `drop_character(1,0)` at 0x3A275). (O for the code path; I for the intent. PoR has the same path with DS:84D2/84D3.)

### Engine registers (O)

Same as PoR. Read 0x20981–0x20A24, write 0x207EE–0x208DB.

| Address | Read | Write |
|---|---|---|
| 0xC04B | party X DS:7229 (signed) | X, sets redraw DS:8B82 |
| 0xC04C | party Y DS:722A | Y, redraw |
| 0xC04D | facing DS:722B >> 1 | (v mod 4)·2, redraw |
| 0xC04E | wall ahead DS:722C | — |
| 0xC04F | square event byte DS:722D | — |
| 0xC059, 0xC05F | undefined | DS:7602, DS:7603, sets DS:8B81 |
| 0xD022 | — | ignored |
| 0x00B1, 0x00FB, 0x00FC | DS:7608, 7604, 7606 | ignored |
| 0x033D | facing ×2 (DS:722B) | — |
| 0x035F, others | undefined | ignored |
| 0x03DE, 0x00B8, 0x00B9 | — | DS:8B66, 8B68, 8B6A (0x3DE selects the CALL 0xB200 sound) |

Used by the data: 0xC04B 151, 0xC04C 119, 0xC04D 131, 0xC04E 22, 0xC04F 62, 0x03DE 15. 0x033D and 0x035F (PoR overland) are not used.

## Engine-visible variables (O: engine code touching the word; meaning I where it rests on the PoR analog)

Found by sweeping `les DS:4FB2/4FB6; …es:[di+off]` in the full disassembly. "PoR" = same offset in PoR.

| CotAB | Code (examples) | Meaning | PoR |
|---|---|---|---|
| 0x4BC3, 0x4BC4 | 0x25C78, 0x25C84 | overland x, y (I) | 0x49C3/C4 |
| 0x4BC5 | 0x194F5 (LOAD_AREA) | current GEO record | 0x49C5 |
| 0x4BC6–0x4BCC | 0x412AD, 0x41317 | game clock, 7 words; carry moduli 10, 10, 6, 24, 30, 12, 256 (DS:3E2C, normaliser 0x411B7) (I: rounds, minutes ×1, ×10, hours, days, months, years) | — |
| 0x4BE5 | 0x1FC4A | area flag (no item use) | 0x49E5 |
| 0x4BE6 | 29 sites | 1 = 3D/dungeon mode, 0 = overland; also drives DS:4FD3 (above) | 0x49E6 |
| 0x4BE7, 0x4BE8 | 0x1954F, 0x1955B | LOAD_WALLSETS two-slot mode | 0x49E7/E8 |
| 0x4BF0, 0x4BF1 | 0x1C1C8, 0x1C1D5 | party X, Y before the move | 0x49F0/F1 |
| 0x4BF2 | 0x1944E | current area id (NEW_ECL writes the old one from DS:8B78) | 0x49F2 |
| 0x4BFB | 0x2F853 | ≠ 0: Area command 'A' answers "Not Here" (I) | 0x49FB |
| 0x4BFC, 0x4BFF | 0x35F08, 0x35EEB | save-game copies (I) | 0x49FC/FF |
| 0x4BFD, 0x4BFE | 0x52D62, 0x52D50 | redraw (write side effect) | 0x49FD/FE |
| 0x4C00–0x4C1F | 0x1FCDC | per-area, zeroed on entry | 0x4A00–1F |
| 0x4CA1 | 0x25C90, 0x52BDC | the party's place on the overland: the map cursor's index into DS:0A4A/0A6A and the wilderness battlefield's terrain DS:4A2C; scripts set it (O) | — |
| 0x4CFD | 0x1B9C2 (=0xFF at PROGRAM 8), 0x36DCD | the game is won: set by PROGRAM 8; the party screen's B goes on only with no current character, 0x4CFD = 0 or DS:4FD5 ≠ 0 (O); no script uses it | — |
| 0x4CFF | 0x3D34D, 0x51D81 | animate the current picture once: the menu input loop 0x51C48 animates while it is set, its frames not waiting their delays (0x51D81, 0x51DFA), and clears it on return (0x52027); the ending sets it around PIC 0x4D (0x3D34D, 0x3D378) (O) | — |
| 0x7EA8 | 0x34573, 0x36A6C (training) | trainable class mask (I) | 0x6DA8 |
| 0x7EC0, 0x7EC1 | 0x18C3E, 0x18C65 | encounter sprite max / current distance | 0x6DC0/C1 |
| 0x7EC6 | 0x24533 | encounter morale (I) | 0x6DC6 |
| 0x7EC7 | 0x1DF24 | outcome of last COMBAT (I) | 0x6DC7 |
| 0x7EC8 | 0x1EAB3 | enemies defeated (I) | 0x6DC8 |
| 0x7EC9 | 0x19509, 0x2F7FC | ≥ 0xFF cancels the move (I) | 0x6DC9 |
| 0x7ECA | 0x1C0FA, 0x1C147 | bit 0 search, bit 1 look; COMBAT keeps bit 0 only (0x1A30A) | 0x6DCA |
| 0x7ECB | 0x21EA9 | SURPRISE result | 0x6DCB |
| 0x7ED2, 0x7ED3 | 0x1FC34, 0x41CEA | rest-encounter interval / chance | 0x6DD2/D3 |
| 0x7ED5 | 0x1BEF9, 0x2F697 | edge-exit flag | 0x6DD5 |
| 0x7EE1 | 0x190F3 | portrait selector (0xFF = plain PIC) | 0x6DE1 |
| 0x7EE2 | 0x1A0E9 | temple flag for COMBAT | 0x6DE2 |
| 0x7EE3 | 0x1D819 | the next battle gives no items: the aftermath skips each combatant's items when 1 (0x1D819 → 0x1D912), cleared after battle (0x1F03F) (O) | 0x6DE3 |
| 0x7EE6 | 0x1DD03 | duel flag | 0x6DE6 |
| 0x7F12 | 0x360CB | block digit (mapped) | 0x6E12 |
| 0x7F33 | 0x2697F, 0x2D4D0 | the party attacked an ally: 1 after "Attack Ally:" is answered Y (0x2D4D0), then the NPCs of morale > 0x7F change side (0x2D4FA); cleared at battle start (0x2697F) (O); PoR's 0x6E33 | — |
| 0x7F3E | 17 sites | party size | 0x6E3E |
| **0x7F3F** | 0x18A6A | **remainder of the last DIVIDE** (written to the buffer directly) | new |
| 0x7F6C | 0x1A056 | shop flag for COMBAT | 0x6E6C |
| 0x7F6D | 0x1F0F6, 0x1F531 | the shop's price factor (canonical 0x6E6D, which PoR's engine never reads): the listing and Buy take the item's value shifted by it, 1 → ÷ 16, 2 → ÷ 8, 4 → ÷ 4, 8 → ÷ 2, 32 → × 2, 64 → × 4, 128 → × 8; another factor lists the value and leaves Buy's price unset (bp−8, **Bug**) (O) | — |
| 0x7F70–0x7F72 | 0x1F01E, 0x4BD60 | to-hit / movement bonuses for next battle (I) | 0x6E70–72 |
| 0x7F79–0x7F82 | 0x1FD01 | scratch, zeroed by NEW_ECL | 0x6E79–82 |

## Flags and control flow

- COMPARE, AND/OR flags: unchanged (handlers identical to PoR) (O)
- `IF_xx`: identical handler (0x193C1); flag clear → skip routine 0x219A2 (O)
- **Skip table (0x219A2) changes** (O): **0x0C moved from 2 to 3 operands** (PoR bug fixed); **0x3F, 0x40 added with 1**; 0x3B, 0x3C keep 3 and 1; 0x3E/0x3D/0x3A (0 operands) skip the opcode byte

  | Skips | Opcodes |
  |---|---|
  | 1 | 01 02 0A 0E 11 12 1D 20 2D 32 34 36 38 39 3C 3F 40 |
  | 2 | 03 08 09 0F 10 1F 22 |
  | 3 | 04–07 0B 0C 21 28 2A 2F 30 35 37 3B |
  | 4 | 14 23 |
  | 5 | 2E |
  | 6 | 1E 2C |
  | 8 | 27 |
  | 14 | 29 |
  | opcode byte only | all others, incl. variadic 15 25 26 2B |

  Remaining mismatches with the handlers: **0x34** (skips 1, reads 2) and **0x36** (skips 1, reads 2). No shipped script has either after an IF (checked by `ecl_coab.py --stats`: 0 cases over all reachable code).
- `RETURN` with an empty stack now **calls EXIT** (0x19356) instead of falling through (O)

## Opcodes

n = operand count passed to the reader in the handler (O for every row). Status: **=** instruction sequence identical to PoR modulo addresses (normalised diff); **≈** same algorithm with small changes; **Δ** changed semantics; **new**. Handlers are in overlay 1885.

| Op | PoR | CotAB name | n | Handler (image / 1885:) | PoR handler | St | Notes |
|---|---|---|---|---|---|---|---|
| 00 | EXIT | EXIT | 0 | 0x188A0 / 0050 | 29c3:0001 | ≈ | restores DS:47FF char if DS:47FA; stop; free GOSUB stack; cursor (1,17) (DS:65BA/65BB); if DS:8B7E redraws the frame (0x01466). PoR's text-window box clears are gone (O) |
| 01 | GOTO | GOTO | 1 | 0x1893B / 00EB | 00F4 | = | target = make_word(lo,hi), any kind |
| 02 | GOSUB | GOSUB | 1 | 0x18958 / 0108 | 0111 | = | |
| 03 | COMPARE | COMPARE | 2 | 0x1896D / 011D | 0126 | = | string compare if either kind ≥ 0x80 |
| 04–07 | ADD SUB DIV MUL | same | 3 | 0x189EA / 019A | 01A3 | ≈ | **DIVIDE also stores the remainder in B word 0x7F3F** (0x18A5D–0x18A6A, direct buffer store). SUBTRACT still dest = val2 − val1 |
| 08 | RANDOM | RANDOM | 2 | 0x18A8D / 023D | 0234 | = | |
| 09 | SAVE | SAVE | 2 | 0x18AEB / 029B | 0292 | = | strings via 0x20A2D; to 0x7C00 copies max 15 chars into the character name |
| 0A | LOAD_CHARACTER | LOAD_CHARACTER | 1 | 0x18B39 / 02E9 | 02E0 | ≈ | as PoR (index val & 0x7F; bit 7 + DS:8B6C/8B6D → drop char). **New: DS:8B87 = 1 if the index is past the end, else 0** (read back through B 0x7D00) |
| 0B | LOAD_MONSTER | LOAD_MONSTER | 3 | 0x18CB5 / 0465 | 0450 | = | |
| 0C | SETUP_MONSTER | SETUP_MONSTER | 3 | 0x18C19 / 03C9 | 03B4 | = | (skip table now right) |
| 0D | APPROACH | APPROACH | 0 | 0x19085 / 0835 | 0817 | = | |
| 0E | PICTURE | PICTURE | 1 | 0x190C3 / 0873 | 0856 | Δ | 255: restore view. Portrait selector 0x7EE1 = 0xFF: **id ≥ 0x78 → `BIGPIC<block>` record id** (0x5360C, string "bigpic" at 0x53605), else `PIC<block>` record into DS:7246 drawn at (3,3) (0x52E0A); 0x7EE1 ≠ 0xFF: head/body portrait (0x1FF13) |
| 0F | INPUT_NUMBER | INPUT_NUMBER | 2 | 0x191AE / 095E | 0951 | ≈ | one extra constant argument to the input routine; unused in data |
| 10 | INPUT_STRING | INPUT_STRING | 2 | 0x191F4 / 09A4 | 0994 | ≈ | idem (input row 10) |
| 11 | PRINT | PRINT | 1 | 0x1926C / 0A1C | 0A09 | ≈ | idem (extra constant args to the text routine) |
| 12 | PRINT_CLEAR | PRINT_CLEAR | 1 | 0x1926C | 0A09 | ≈ | shares 11's handler |
| 13 | RETURN | RETURN | 0 | 0x19308 / 0AB8 | 0A9F | Δ | empty stack → EXIT |
| 14 | COMPARE_AND | COMPARE_AND | 4 | 0x1935C / 0B0C | 0AED | = | |
| 15 | VMENU | VMENU | 3+N | 0x19739 / 0EE9 | 0F08 | ≈ | count = val 3; also clears DS:8B80 |
| 16–1B | IF_xx | IF_xx | 0 | 0x193C1 / 0B71 | 0B52 | = | |
| 1C | CLEAR_MONSTERS | CLEAR_MONSTERS | 0 | 0x19A90 / 1240 | 125D | = | |
| 1D | PARTY_STRENGTH | PARTY_STRENGTH | 1 | 0x19AF9 / 12A9 | 12C6 | Δ | Σ over list of (HP char[0x1A4] + 5·max(char[0x19A]−60,0) + 5·max(char[0x199]−39,0) + 8·L1 + 4·L2) div 10 (byte, wraps), with **L1 = f·char[0x116] + char[0x10E], L2 = f·char[0x111] + char[0x109]**, f = FUN 0x51841(char) (stub `fe:52`): 1 when 0x517D2(char), a human's first non-zero current class level (0 for other races), is above char[0xE6], the level at the change, else 0 (O): the former levels count only once the new class has passed them; the per-character sum is divided by 10 (0x19C09) and added as a byte (0x19C0B) |
| 1E | CHECK_PARTY | CHECK_PARTY | 6 | 0x19CA4 / 1454 | 1435 | Δ | s = (kind 1 ? address : value) − 0x7FFF. s = 0x8001 (selector 0): found = any member has effect val 2 (0x4F395). s = 0xA5..0xAC (signed compare): min/max/avg of thief skill char[0xE9 + s − 0xA4]. s = 0x9F: of movement char[0x1A5]. Outputs: op3 ← min, op4 ← max, op5 ← avg (signed div), op6 ← found. **The only use in the data (`CHECK_PARTY [0x7CA5], …`, ECL4 record 32, 0x8A42) gives s = 0xFCA6 and writes nothing** (O); selectors expected by the code would be 0x80A4–0x80AB / 0x809E |
| 1F | — | — | (2) | none | none | = | no handler (PC never advances); skip table says 2 |
| 20 | NEW_ECL | NEW_ECL | 1 | 0x19437 / 0BE7 | 0BD1 | ≈ | 0x4BF2 = old area (DS:8B78), DS:8B78 = n, load (0x1FD3C), reset (0x1FBB8), stop, DS:47F9 = 1. The loading message moved into the loader |
| 21 | LOAD_AREA | LOAD_AREA | 3 | 0x19491 / 0C41 | 0C74 | ≈ | val1 ∉ {0x7F, 0xFF} and 0x4BE6 ≠ 0: 0x4BC5 = val1, load GEO (0x549AD), 0x7EC9 = 0. val3 ≠ 0xFF, 0x4BE6 = 0, DS:72A4 ≠ 0x50: **BIGPIC 0x79** as backdrop (0x5360C) (PoR: BACPAC). Shares handler with 37 |
| 22 | PARTY_HAS_RANGER | PARTY_HAS_RANGER | 2 | 0x19ECE / 167E | 1629 | = | unused in data |
| 23 | SURPRISE | SURPRISE | 4 | 0x19F6E / 171E | 16C9 | = | unused in data |
| 24 | COMBAT | COMBAT | 0 | 0x1A034 / 17E4 | 179B | ≈ | no monsters (DS:8B83 = 0 and DS:8B70 = 0): shop if 0x7F6C = 1, temple if 0x7EE2 = 1, else treasure; then redraw (3D if 0x4BE6 ≠ 0). Battle path calls 0x21D30, 0x24C90, 0x230C0, 0x2C2F7, 0x556B0, 0x54B00, then treasure 0x1D6E0; overland redraw uses BIGPIC 0x79. Ends: DS:4FD3 = 4/3, 0x7ECA &= 1 |
| 25 | ON_GOTO | ON_GOTO | 2+N | 0x1A335 / 1AE5 | 18F8 | = | |
| 26 | ON_GOSUB | ON_GOSUB | 2+N | 0x1A335 | 18F8 | = | |
| 27 | TREASURE | TREASURE | 8 | 0x1A3ED / 1B9D | 19B0 | Δ | money ops 1–7 → DS:6F8A (dwords). op 8 < 0x80: `ITEM<block>` record = list of 63-byte items, each prepended (DS:6FA6); missing record → message and exit to DOS (0x06700). 0xFF none. 0x80+k: k random items, **new type table** below |
| 28 | ROB | ROB | 3 | 0x1A7C6 / 1F76 | 1DB1 | = | |
| 29 | ENCOUNTER_MENU | ENCOUNTER_MENU | 14 | 0x1A90D / 20BD | 1EF8 | ≈ | 97% identical; the menu-variant test now uses 0x4BE6 and DS:72A4 (0x1AA5C–0x1AA96) instead of PoR's distance test: the choice of the PARLAY or ADVANCE menu is PoR's (0x1ABB8, 0x1ABC4); two display flags differ: the picture is animated only when DS:8B7C and DS:8B7D are set, A 0x4BE6 ≠ 0 (a map area) and the picture DS:72A4 ≠ 0x50 (PoR: DS:84E0 and DS:84E1), and the text window is cleared before the text only in a map area (O) |
| 2A | GET_TABLE | GET_TABLE | 3 | 0x1968F / 0E3F | 0E5E | = | |
| 2B | HMENU | HMENU | 2+N | 0x19904 / 10B4 | 10D1 | = | count = val 2 |
| 2C | PARLAY | PARLAY | 6 | 0x1B007 / 27B7 | 25CB | = | |
| 2D | CALL | CALL | 1 | 0x1B773 / 2F23 | 2CCF | Δ | target = make_word(lo,hi) − 0x7FFF; new target table below |
| 2E | DAMAGE | DAMAGE | 5 | 0x1B1A8 / 2958 | 2775 | Δ | as PoR (one roll for all victims of a save mode is PoR's too) plus **flags bit 4 (0x10): a successful save still takes the damage** (0x1B22A, 0x1B2C0, 0x1B329, 0x1B398; the bit is also part of the save bonus); on a wipe no "The END!" (the frame is redrawn, 0x01330), then "The entire party is killed!" and a 3 s delay. Used with bit 4 in ECL5 at 0x8251, 0x83C2, 0x8D55, 0x8E31 |
| 2F | AND | AND | 3 | 0x19620 / 0DD0 | 0DEF | = | |
| 30 | OR | OR | 3 | 0x19620 | 0DEF | = | |
| 31 | REDRAW | REDRAW | 0 | 0x1B506 / 2CB6 | 2AA2 | = | (+ DS:759A = 1) |
| 32 | FIND_ITEM | FIND_ITEM | 1 | 0x1B0A6 / 2856 | 266A | = | |
| 33 | NEWLINE | NEWLINE | 0 | 0x1B55F / 2D0F | 2AEB | = | |
| 34 | DELAY | **PASS_TIME** | **2** | 0x1B52A / 2CDA | 2AC1 | Δ | PoR read 1 operand with an uninitialised index. CotAB: clock routine 0x4129A(count = val1, unit = val2): `count` times add 1 to clock word 0x4BC6+unit and normalise, then 0x40EBE(count, unit), the effects' time-out. The moduli (DS:3E2C: 10, 10, 6, 24, 30, 12, 256, PoR's DS:363A) and the rest menu (0x41647–0x41709: D unit 4, H unit 3, M adds 5 to unit 1) make unit 1 minutes, 2 ten minutes, 3 hours, 4 days, 5 months, 6 years, unit 0 the 6-second segment (O). Data: `PASS_TIME [0x4C06], #4` in ECL1 records 80 and 81 (travel, days) |
| 35 | SAVE_TABLE | SAVE_TABLE | 3 | 0x196ED / 0E9D | 0EBC | = | |
| 36 | ADD_NPC | ADD_NPC | 2 | 0x1B61A / 2DCA | 2B7E | Δ | load NPC val1 (0x3593D); morale char[0xF7] = (val2 >> 1) \| 0x80; recompute (0x4DC70, 0x4D7E8). **PoR's "enemy side for id 0x18" is gone**: the side byte stays as the record holds it. 0x3593D (nothing with 8 in the party, DS:4FB6 + 0x67C) loads the record with the monster loader 0x3565C, which keeps it as stored (no icon size, no icon colours rolled), sets the identity tag char[0x126] = val1 (0x35974, PoR Random(256)), joins it to the party (0x359CA: icon slot char[0x143]) and loads its combat icon from `CPIC` record val1 into that slot (0x3599F → 0x56C50). No class pick and no portrait (no NPC portrait tables): **no draws** at all (O: no call of Random 0x8F7:0x15EA or the dice routine on the path) |
| 37 | LOAD_WALLSETS | LOAD_WALLSETS | 3 | 0x19491 | 0C74 | ≈ | as PoR (0x7F → slot 1 set 0; otherwise 0xFF empties a slot), except that with 0x4BE7 and 0x4BE8 set (ops 1 and 3 only) **an operand of 0xFF is skipped, leaving its slot as it is** (0x19563, 0x19575; PoR has no test there) |
| 38 | PROGRAM | PROGRAM | 1 | 0x1B94E / 30FE | 2E10 | Δ | restores DS:47FF char first; 0 and 8 return and the script goes on, as PoR's (O). 0: training/party screen (0x36850, 0x36A1C). **3: quit (DS:4FE0 = 1) then EXIT (new)**. 8: ending (0x3D02C), 0x4CFD = 0xFF, 0x7EA8 = 0xFF, every member HP = max (char[0x1A4] = char[0x78]), char[0x195] = 0, char[0x196] = 1, then "You've won. Save before quitting?" (cs string 0x1B92B); Y → 0x3631E; exit to DOS (0x06700). 9: camp (0x1B8E4), PC restored, EXIT |
| 39 | WHO | WHO | 1 | 0x1B5CF / 2D7F | 2B33 | = | |
| 3A | PAUSE | PAUSE | 0 | 0x1B15B / 290B | 271F | Δ | DS:4FCD += 1, then Delay(DS:4FC2 · 100 ms) (0x57F9); PoR waits speed × 225 ms |
| 3B | FIND_IN_CHAR_LIST | **FIND_SPELL** | 3 | 0x1B683 / 2E33 | 2C03 | Δ | **fixed**: destinations are full word addresses (make_word). For each party member scan char[0x1E+i], i = 1..100, for val1. dest2 = i (1-based) of the first hit, 0xFF if none; dest3 = 0-based party index of that member (n−1 if none) |
| 3C | PRINT_LIST | **PROTECTION** | 1 | 0x1BA8F / 323F | 2E7D | Δ | **copy-protection code-wheel check** (0x1C378: "Align the espruar and dethek runes / shown below, on translation wheel / like this:"); operand read but unused; then 0x4FA79. Data: once (ECL1 record 80, 0x9B6F) |
| 3D | CLEAR_TOP | **REDRAW_SCREEN** | 0 | 0x1B588 / 2D38 | 2B14 | Δ | redraw frame (0x01466), recompute and show current char (0x4D7E8, 0x4FBB6), redraw current PIC (DS:724C) at (3,3) (0x52E0A); DS:8B88 = 0, DS:8B7A = 1. Data: before NEW_ECL in block changes |
| 3E | — | **DROP_CHARACTER** | 0 | 0x1BAC1 / 3271 | — | new | remove current character from the party and free its icon (0x3A275(1,0) unlinks DS:6520 from the list at DS:6524); new current = previous member; DS:47FF = it; recompute (0x4D7E8). Data: 5 uses (ECL3 #17 #18, ECL5 #48 #51, ECL6 #66), e.g. after "…SUCKED INTO THE SPHERE AND GONE FOREVER" |
| 3F | — | **FIND_EFFECT** | 1 | 0x1BAF5 / 32A5 | — | new | clear all flags; EQ = current character has effect val1 (0x4F395, same test CHECK_PARTY uses), else NE. Data: `FIND_EFFECT #20` twice (ECL5 #50) |
| 40 | — | **DESTROY_ITEMS** | 1 | 0x1BB49 / 32F9 | — | new | every party member: free every item with type item[0x2E] = val1 (list char[0x14D], next item[0x2A], 0x4E5EC), then recompute (0x4DC70). Data: types 94, 96, 97 (13 uses) |
| ≥ 41 | — | — | — | none | — | | no handler (hangs) |

Names in bold are this file's names (no CotAB-specific names exist in the PoR spec).

### CALL targets (O, 0x1B773)

Compared value = target − 0x7FFF, so the effective target address is:

| Target | Effect | PoR |
|---|---|---|
| **0x2E10** | refresh square registers (event 0x53E45), and if `LOAD_AREA/WALLSETS` ran (DS:47FB) and any redraw flag (DS:8B7C/7F/82/84/81) is set: redraw view, clear the flags, recompute wall ahead (0x1B7B2). DS:8B7C is set by `PICTURE` (0x190EA) and a portrait (0x2002E), 8B82 by party X/Y writes (0x20846), 8B84 by the sky words 0x4BFD/E (0x20749), 8B81 by the VM reset (0x1FBDC), 8B7F at 0x1FFBB; DS:47FB by `LOAD_AREA`/`LOAD_WALLSETS` (0x1949F) and a load (0x1C057), cleared on area entry (0x1BFD5). So a picture stays until the next 0x2E10 | was 0x2C90 | was 0x2C90 |
| 0x8000 | duel (0x2156A(1)) | same |
| 0x8001 | solo combat (0x2156A(0)) | same |
| **0xB200** | sound: register 0x3DE = 8 → DS:25C2, 10 → DS:25C4, else DS:25C2 (0x069B0); the initial values are effect 10 and 11 (O, data) | was 0xBA03 |
| 0xC01E | step forward (0x214D1) | same |
| 0xC018 | wall ahead, only when 0x4BE6 = 0 (0x53D42) | same (map areas only) |
| **0x6803** | **new**: draw the next frame of the current picture (frames at DS:7246, count byte DS:7246, current DS:7247, wraps to 1) at (3,3), then 0x057F9: Delay(DS:4FC2 · 100 ms), the game speed (O). Only the demo uses it | — |
| 0xC01B | — (removed) | dead C64 tile check |

Data use: 0x2E10 ×124, 0xB200 ×19, 0xC01E ×13, 0x6803 ×11 (all with a kind-1 operand). 0x8000, 0x8001, 0xC018 unused.

### Random treasure types (O, 0x1A5A3–0x1A6E2)

Per item: r1 = d100.

- r1 1–60: r2 = d100: 1–47 and 50–59 → type r2, **except 45 → 0x3B**; 60–90 → d10: 1–4 0x24, 5–7 0x23, 8 0x22, 9 0x25, 10 0x26; 91–94 → 0x49; 95–97 → 0x5D; 98–100 → 0x4D; **48–49 → 0x3B** (PoR's "type unset" bug fixed)
- r1 61–85 → 0x3D; 86–92 → 0x3E; 93–98 → d15: 1–9 0x47, 10 0x54, 11–15 0x4F; 99–100 → 0x3B

Then 0x42D97(type, item) builds the 63-byte record, which is prepended to the treasure list (DS:6FA6). (The builder and the item types: [records.md §8](records.md#8-random-treasure-items-o-builder-0x42d97-type-choice-0x1a5a30x1a6e2).)

## Decoder status

*Informative:* `tools/coab/ecl_coab.py` (`python3 tools/coab/ecl_coab.py ECLn.DAX [rec]`) lists reachable code; `--stats` summarises.

| Block | Records | Code bytes | Instructions | Reachable |
|---|---|---|---|---|
| ECL1 | 3 | 16028 | 1610 | 95.3% |
| ECL2 | 4 | 24373 | 2213 | 99.0% |
| ECL3 | 4 | 24781 | 2874 | 96.3% |
| ECL4 | 5 | 26760 | 2858 | 99.1% |
| ECL5 | 5 | 24651 | 2419 | 93.1% |
| ECL6 | 4 | 21737 | 2209 | 96.4% |
| **all** | **25** | **138330** | **14183** | **96.7%, 0 decode errors** |

- 95 unreached gaps (4628 bytes): 75 decode cleanly as instructions in a linear sweep (dead code), 20 do not (I: data tables for GET_TABLE, or text)
- Every variadic count in the data is a constant; no operand kind outside {0, 1, 2, 0x80, 0x81}
- Opcodes never used: 0x0F INPUT_NUMBER, 0x22 PARTY_HAS_RANGER, 0x23 SURPRISE (and 0x1F)
- No IF is followed by an opcode whose skip count disagrees with its handler
- Address operands: A 2266, B 3009, C 37, code 4081, engine registers 500

## Open

- ~~PARTY_STRENGTH's f, ENCOUNTER_MENU's condition, 0x4CA1, 0x4CFD, 0x4CFF, 0x7F33, 0x7F6D, 0x7EE3, the
  PASS_TIME units~~: answered in the tables above (2026-10-22).
- ~~DS:8B62~~: the encounter display state (PoR's DS:84C8): [0] a sprite is on show (0x1FFB7), [1] a
  picture (0x20063, PICTURE 0x190E5); +0x1A/+0x1B (DS:8B7C/7D) are ENCOUNTER_MENU's flags. Clearing [0]
  and [1] (EXIT, reset, NEW_ECL, COMBAT, PROTECTION; 0x191A0) means nothing is drawn over the view (O).
