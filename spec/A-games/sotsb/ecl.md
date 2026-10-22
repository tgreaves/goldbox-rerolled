---
created: 2026-10-22
tags: [reverse-engineering, gold-box, sotsb, spec]
---

# SotSB ECL virtual machine: diff against CotAB `coab/ecl.md`

> **Status: first pass.** Normative where marked O. Part A of the [specification](../../README.md):
> Secret of the Silver Blades, GOG 1.0 (`START.EXE` + `GAME.OVR`, the working image of
> [README.md](README.md#working-image)). Read [engine/ecl.md](../engine/ecl.md), then
> [coab/ecl.md](../coab/ecl.md): this file lists what differs from CotAB's VM; anything not mentioned
> is taken to behave as CotAB's (I where only the handler's shape was compared). Evidence marks as in
> the spec README.

Addresses are **image offsets** into `sotsb/img.bin`. DS = image paragraph 0x0DE2 (DS:x = image
0xDE20 + x). The VM's overlay segment starts at image 0x1DB30 (CS); `gobjdump` shows near calls from
the dispatcher 0x10000 too high (it does not wrap the 64 KB segment): the handler addresses below are
corrected.

*Informative:* the listings come from a scratch copy of `tools/coab/ecl_coab.py` with SotSB's two
opcode changes; 22 records in ECL1–3, **0 decode errors** ([Decoder status](#decoder-status)).

## In brief

- Same **address spaces** as CotAB: A 0x4B00–0x4EFF, B 0x7C00–0x7FFF, C 0x7A00–0x7BFF, code
  0x8000–0x9DFF (the classifier 0x26011, CotAB 0x200F3) (O). The operand encoding, the `88 13` record
  header, the five vectors (code starting with five `GOTO`; "nothing" at 0x8014) and the 0x1E00-byte
  code buffer are CotAB's (O: every record decodes with CotAB's reader; the largest is ECL1 #32, 7 676
  bytes).
- **Opcodes 0x00–0x41** (no 0x1F): one new, **0x41 ADD_EP**; **0x3C PROTECTION** is an empty handler
  that reads no operand. Every other opcode reads the operand counts CotAB's does (O, below).
- The **character view through B** follows SotSB's 439-byte record and gains entries
  ([below](#b-as-a-view-of-the-current-character-o-read-0x260cd-write-0x265bd)).
- **PROGRAM** knows only 0 and 9: no ending (8) and no quit (3) (O).
- A **start-up menu** "Secret of the Silver Blades" / Play / Demo as CotAB's; a new game starts at
  **record 17** (block 2), the demo at record 3 (block 1) (O).

## Engine entry points (O)

| What | SotSB image | CotAB |
|---|---|---|
| dispatcher (cmp/call chain on DS:8F63, opcodes 0x00–0x41) | 0x214B0 | 0x1BBF2 |
| operand reader (count) | stub `7d:2a` | `4c:2a` (0x1FA02) |
| operand value / address | stubs `7d:25`, `7d:4d` | `4c:25`, `4c:4d` |
| address classifier | 0x26011 | 0x200F3 |
| B view read / write | 0x260CD / 0x265BD | 0x201B4 / 0x2051F |
| engine register read / write | 0x2698E / 0x267D7 | 0x208E6 / 0x20722 |
| IF skip (opcode lists, skip n operands through 0x25910) | 0x27864 | 0x219A2 |
| new game / load: the area to start | 0x21934 | 0x1BFED |

The handler of each opcode (O, from the dispatcher; CotAB's in brackets): 00 0x1DB30 (0x188A0), 01
0x1DBC6, 02 0x1DBE5, 03 0x1DBFC, 04–07 0x1DC79, 08 0x1DD1C, 09 0x1DD7A, 0A 0x1DDC8, 0B 0x1DF3E, 0C
0x1DEA2, 0D 0x1E398, 0E 0x1E3D8, 0F 0x1E4D5, 10 0x1E51B, 11/12 0x1E593, 13 0x1E62F, 14 0x1E682, 15
0x1EAE9, 16–1B 0x1E6E4, 1C 0x1EE44, 1D 0x1EEAC, 1E 0x1F051, 20 0x1E75C, 21/37 0x1E7CF, 22 0x1F42C, 23
0x1F4C8, 24 0x1F590, 25/26 0x1F8B5, 27 0x1F96D, 28 0x1FF01, 29 0x20041, 2A 0x1EA3F, 2B 0x1ECB3, 2C
0x2073E, 2D 0x20EF6, 2E 0x208B2, 2F/30 0x1E9D0, 31 0x20C36, 32 0x207DD, 33 0x20C91, 34 0x20C5C, 35
0x1EA9D, 36 0x20D77, 38 0x210C6, 39 0x20D11, 3A 0x20886, 3B 0x20DEA, 3C 0x2116D, 3D 0x20CBC, 3E
0x21174, 3F 0x211A7, 40 0x211F8, **41 0x21324**.

## Opcode names in the image (O)

The image keeps the developers' names of the opcodes, 66 Pascal strings at image 0x5D7F0–0x5DA39, in
opcode order with no entry for 0x1F: EXIT, GOTO, GOSUB, COMPARE, ADD, SUBTRAT, DIVIDE, MULTIPLY,
RANDOM, SAVE, LOAD CHARACTER, LOAD MONSTER, SETUP MONSTER, APPROACH, PICTURE, INPUT NUMBER, INPUT
STRING, PRINT, PRINTCLEAR, RETURN, COMPARE AND, VERTICAL MENU, IF =, IF <>, IF <, IF >, IF <=, IF >=,
CLEARMONSTERS, PARTYSTRENGTH, CHECKPARTY, *(0x20)* NEWECL, LOAD FILES, LOAD PIECES, PARTY SURPRISE,
SURPRISE, COMBAT, ON GOTO, ON GOSUB, TREASURE, ROB, ENCOUNTER MENU, GETTABLE, HORIZONTAL MENU, PARLAY,
CALL, DAMAGE, AND, OR, SPRITE OFF, FIND ITEM, PRINT RETURN, ECL CLOCK, SAVE TABLE, ADD NPC, PROGRAM,
WHO, DELAY, SPELL, PROTECTION, CLEAR BOX, DUMP, FIND SPECIAL, DESTROY ITEMS, **ADD EP**, and a 66th,
"BULLSHIT", for 0x42, which has no handler. The spec keeps PoR's names (`LOAD_AREA` for LOAD FILES,
`LOAD_WALLSETS` for LOAD PIECES, `PARTY_HAS_RANGER` for PARTY SURPRISE, `REDRAW` for SPRITE OFF,
`NEWLINE` for PRINT RETURN, `PASS_TIME` for ECL CLOCK, `PAUSE` for DELAY, `FIND_SPELL` for SPELL,
`REDRAW_SCREEN` for CLEAR BOX, `DROP_CHARACTER` for DUMP, `FIND_EFFECT` for FIND SPECIAL).

## Opcodes

Operand counts are the arguments of the operand reader in each handler (O, both games read the same
way). Against CotAB:

| Op | Name | SotSB operands | CotAB | Notes |
|---|---|---|---|---|
| 0x3C | PROTECTION | **0** (the handler is `push bp; mov bp,sp; mov sp,bp; pop bp; retf`, 0x2116D) | 1 | does nothing; no script uses it (O). The IF skip still counts 1 operand for it (below) |
| 0x41 | **ADD_EP** | **2**: `everyone`, `amount` (word) | — | new (0x21324), below |
| 0x38 | PROGRAM | 1 | 1 | only 0 and 9 handled (below) |
| others | | as CotAB | | the same counts for 0x00–0x40 (O, every handler read) |

Handlers whose code differs from CotAB's beyond the compiler's one-instruction epilogue, **not yet
read** (**?**): 0x0B LOAD_MONSTER (357 instructions against 306), 0x0E PICTURE, 0x1E CHECK_PARTY (352
against 199), 0x20 NEW_ECL, 0x21/0x37 LOAD_AREA and LOAD_WALLSETS (one handler, 168 against 131), 0x24
COMBAT, 0x27 TREASURE (576 against 389), 0x2E DAMAGE, 0x39 WHO, 0x3B FIND_SPELL, 0x3D REDRAW_SCREEN,
0x40 DESTROY_ITEMS. The others have CotAB's shape (I: same operand use and calls, not compared line by
line).

### 0x41 ADD_EP (O, 0x21324)

`ADD_EP everyone, amount`: DS:8F75 := 0x11, DS:8F74 := 1; then

- `everyone` ≠ 0: prints "Congratulations the party gains experience!" (CS:0x37A4, image 0x212D4) in the
  text window (`c5d:62a`), then for every member of the
  party list (DS:7D3C, next at +0x19D): n := how many of the class level bytes +0x111…+0x116 are above
  0 (signed), share := amount div n; if +0x1A7 ≠ 0 (I: in play), the dword experience +0x12C += share.
- `everyone` = 0: the current character (DS:7D38) only, the same share rule and test: "Congratulations
  " (CS:0x37D0) + the name + " gains experience!" (CS:0x37E1).

A character with no class level above 0 divides by 0 (**Bug**, I: the CPU's divide fault; no such
character exists in play). Used 40 times in the data (`ADD_EP #1, #20000` and the like).

### 0x38 PROGRAM (O, 0x210C6)

Restores the saved current character first, as CotAB. Then by value: **0** — DS:67F6 := 0, the party
screen (`ef:25`), DS:67F6 := 1, and unless DS:8A52 = 9 or A[0x4BE6] / A[0x4C38] is set the view is
redrawn (`151:e3`); **9** — camp (0x2105B, PC kept), then, unless A[0x4C38] (A + 0x270) is set, EXIT
(0x1DB30). **Any other value does nothing**: no case 8 (the ending) and no case 3 (CotAB's quit). The
data use 0 (ECL1 #16 0x8C92) and **3** (ECL1 #3 0x82E3, the demo's record), which therefore does
nothing in SotSB (O).

### Flags and control flow (O)

The IF skip routine (0x27864) skips by CotAB's lists, with **0x41 added to the two-operand list**; 0x3C
stays in the one-operand list although its handler now reads none (a skip after an IF would take one
operand too many; no script has PROTECTION). Over the data no IF is followed by an opcode whose skip
count disagrees with its handler.

## Memory map (O)

### B as a view of the current character (O, read 0x260CD, write 0x265BD)

B offset k (word index: address − 0x7C00) → field of SotSB's record (CotAB's field in brackets):

| k | read | write | CotAB |
|---|---|---|---|
| 0 | | v = 0: DS:A4B7 := 1 (the first leave flag) | the same (DS:8B6D) |
| 0x15, 0x18, **0x19** | +0x13, +0x19, **+0x1B** | | +0x13, +0x19; 0x19 new |
| 0x1B–0x65 | | char[0x1E + (k − 0x1B)] (the memorised spells view) | 0x20–0x70 → the memorised spells |
| 0x72, 0x73, **0x76** | +0x6B, +0x6C, **+0x70** | | +0x74, +0x75 |
| 0x9B, 0xA0, 0xAC | +0xE9, +0xEE, +0xF2 | | +0xE0, +0xE5, +0xE9 |
| 0xB8 | +0xFF | +0xFF (v > 0xB2: v − 0x32) | +0xF7 |
| 0xBB–0xC3, **0xC5** | +0x103 … +0x10B, **+0x10D** (words) | the same | 0xBB–0xC3 → +0xFB … +0x103; 0xC5 new: a sixth money word |
| 0xC9, **0xCA, 0xCB, 0xCC, 0xCF, 0xD0** | a class level with its former part (`164:57`): +0x11D/+0x116, +0x118/+0x111, +0x11E/+0x117, +0x11A/+0x113, +0x11B/+0x114, +0x11C/+0x115 | | only 0xC9 (+0x116/+0x10E) |
| 0xD6, 0xD8 | +0x11F, +0x120 | | +0x119, +0x11B |
| 0xE4 | — | — | +0x192 bit 0 (the Hillsfar flag): gone |
| 0xF7, 0xF9 | +0x14E (word), +0x150 | the same | +0x13C, +0x13E |
| 0x100 | +0x1A6 | **v = 1: +0x1A6 := 0, +0x1A7 := 1** (I: Okay and in play) | +0x196; v ≥ 0x80 out of play, 0x87 stoned, 0 the second leave flag |
| 0x10C | +0x1A8, +0x1A9 | 0 → 0, 0; 0x80 → 0, 1; 0x81 → 1, 1 | +0x197, +0x198, the same values |
| **0x119** | +0x1B5 | +0x1B5 | new |
| 0x11B | +0x1B6 | | +0x1A5 |
| 0x2CF, 0x33E | +0x1B, +0x67C | | the same |
| 0x312, 0x322–0x326 | | as CotAB | |

**The NPC farewell is dead in SotSB** (O for the writers, by byte search): LOAD_CHARACTER (0x1DDC8) drops
the current character with bit 7 only when both DS:A4B6 and DS:A4B7 are set (0x1DE57–0x1DE63, as PoR's
0x19F92 and CotAB's), but nothing ever sets DS:A4B6: B+0x100 written 0 no longer sets a flag, and the
only other references are clears (0x1DE94, 0x25AD9). The data's two farewells use DROP_CHARACTER
(0x3E) instead.

### Engine registers (O)

Writes (0x267D7) as CotAB's list: 0xC04B, 0xC04C → DS:89D7, DS:89D8 (party x, y); 0xC04D → the facing;
**0xC059 → DS:8F4C, 0xC05F → DS:8F4D** (the view band colours); 0xD022 (0x10BA after − 0xBF68); 0x03DE →
DS:A4B0, 0x00B8 → DS:A4B2, 0x00B9 → DS:A4B4. Reads (0x2698E): 0xC04B–0xC04F from DS:89D7–89DB (0xC04D
halved when A[0x4BE6] is set), 0x00B1, 0x00FB, 0x00FC, 0x033D, 0x035F as CotAB (0x035F:
nothing set, the value undefined).

**The scripts write 0xC05A, which nothing handles**: every band setting in the data is the pair
`SAVE #n, [0xC059]` / `SAVE #m, [0xC05A]` (e.g. ECL1 0x8014/0x801A), where PoR and CotAB write 0xC059 and
0xC05F; 0xC05A − 0xBF68 = 0xF2 has no case, so the second colour is never set by a script (O; I: a
script slip; the view keeps its last or default band). Registers used by the data: 0xC04B 161, 0xC04C
175, 0xC04D 161, 0xC04E 52, 0xC04F 72, 0xC059 5, 0xC05A 5, 0x03DE 4.

**A[0x4BEA] reads DS:89D9** (the facing byte) instead of the A array (0x269A9, O; CotAB reads the
array).

## CALL targets (O, 0x20EF6)

The handler compares (target − 0x7FFF) as a word:

| Target | Meaning | CotAB |
|---|---|---|
| 0x2DCB | refresh the square: DS:89DB := `17e:3e`(DS:89D7, DS:89D8) (the square's event); if any of the flags DS:A4C6, A4C9, A4CB, A4CC, A4CE is set, a redraw (`6ef:4c4`, `174:25`, `151:e8`), the flags cleared and DS:89DA := `17e:34`(x, y, facing) (the wall ahead) | 0x2E10 |
| 0xB203 | sound: register 0x03DE = 8 → the effect at DS:19DA, 10 → DS:19DC, else DS:19DA (`7e4:20`); initially 10 and 11 | 0xB200 |
| 0xC01E | step forward (`7d:9d`) | the same |
| 0xC018 | wall ahead: when A[0x4BE6] = 0, DS:89DA := `17e:34`(x, y, facing) | the same |
| 0x6803 | the next picture frame | the same |
| (none) | CotAB's 0x8000 duel and 0x8001 solo combat are gone | |

Used: 0x2DCB 144 times, 0xB203 6, 0xC01E 2.

## Start-up and new game (O)

The image starts with "May 18,1990" and the start-up menu "Secret of the Silver Blades" / "Play Demo"
(image 0x40–0x88), as CotAB's. Key D (DS:59A2 = 0x44) sets **DS:67E9 := 1, the demo flag** (0x266).
New game or load (0x21934): when A[0x4BF2] is 0, with the demo flag `19d:0`(1), the area DS:A4C2 := **3**
and DS:7420 := 1; else DS:7420 := 2, the area := **0x11 = 17** and the current character recomputed
(`151:2a`); otherwise the saved area. Record 17 is in ECL2 (block 2), record 3 in ECL1 (block 1)
(O, the records' files). A[0x4BE6] = 0 sets the game mode DS:67E7 := 3, as CotAB's 0x4BE6 test
(I: the same meaning).

## Decoder status

| Block | Records | Code bytes | Instructions | Reachable |
|---|---|---|---|---|
| ECL1 | 5 (3, 16, 32, 33, 34) | 30 730 | 3 507 | 95.3% |
| ECL2 | 10 (17, 48–52, 64–66, 68) | 60 784 | 6 702 | 94.0% |
| ECL3 | 7 (80–82, 96–99) | 46 404 | 5 113 | 97.6% |
| **all** | **22** | **137 918** | **15 322** | **95.5%, 0 decode errors** |

- 71 unreached gaps (6 208 bytes): 57 decode cleanly in a linear sweep, 14 do not (I: GET_TABLE data or
  text).
- Operand kinds in the data: 0x00 7 480, 0x01 12 417, 0x02 52, 0x03 56 (kind 3 is used, unlike CotAB),
  0x80 2 100, 0x81 104.
- Opcodes never used: 0x1D PARTY_STRENGTH, 0x22 PARTY_HAS_RANGER, 0x23 SURPRISE, 0x31 REDRAW, 0x3C
  PROTECTION, 0x3F FIND_EFFECT. ADD_EP is used 40 times, DROP_CHARACTER twice, PROGRAM twice.

## The profile (draft)

*Informative:* what `web/src/games/ecl.ts` would need, as data (fields CotAB has unchanged are left
out; the record offsets wait for SotSB's field map):

```ts
export const SOTSB_ECL: EclMap = {
  a: 0x4b00, b: 0x7c00, c: 0x7a00, code: 0x8000,
  // the memorised view starts at B+0x1B (CotAB 0x20) into char[0x1E]: a new parameter (start, count 75)
  viewReads: { /* 0x19, 0x76, 0xc5, 0xca–0xd0, 0x119 new; 0xe4 gone; offsets per the table above */ },
  ops: { /* CotAB's variants, plus */ 0x3c: 'nothing', 0x41: 'addExperience' },
  skip: { /* CotAB's */ 0x41: 2 },        // 0x3C keeps a skip of 1 though it reads none
  operands: { 0x34: [2], 0x3c: [0], 0x3e: [0], 0x3f: [1], 0x40: [1], 0x41: [2] },
  calls: { refresh: 0x2dcb, sound: 0xb203, frame: 0x6803 },
  callSounds: { by: { 8: 10, 10: 11 }, other: 10 },
  start: { block: 2, area: 17 }, areaZero: 17,   // the demo: block 1, record 3
  quitProgram: null,                              // PROGRAM 3 does nothing; no PROGRAM 8
  // B+0x100 written 1 makes the character Okay and in play; no second leave flag (the farewell is dead)
}
```

The port would need: an `addExperience` opcode variant (ADD_EP, with the message addresses and the
share rule as parameters), PROTECTION as a no-op, the memorised view's start as a parameter, B-view
writes as data (0x100 and 0x119 differ), the second leave flag as profile data (absent here), the
0xC05A write dropped (an unknown register: the port's NOWHERE), and A[0x4BEA] read from the facing.

## Found while running the scripts in the port (2026-10-22)

- **The block written by scripts is not the file digit** (O): the B-view write of 0x312 (ECL 0x7F12,
  0x2675A) calls 0x6EB0, which keeps the old digit in DS:7421 and sets the DAX file digit DS:7420 :=
  (v + 1) div 2: values 1 and 2 are ECL1, 3 and 4 ECL2, 5 and 6 ECL3 (the scripts write 2 before
  `NEW_ECL #33`, 4 before `NEW_ECL #64`). 0x6ECE puts the old digit back. The save's first byte is that
  digit (0x421CB writes DS:7420 first); B + 0x312 keeps the scripts' value.
- **NEW_ECL** (0x1E75C): A + 0x1E4 := the current record, DS:A4C2 := the operand, then the loader 0x25C3C
  ("Loading...Please Wait", `ECL` + DS:7420 + `.dax`), which retries while the record's size is below 2
  (as PoR's): a record missing from the file loops (O).
- **LOAD_PIECES** (0x1E7CF): 0x7F means "no set" as 0xFF does, in every mode (0x1E812–0x1E949); in one-slot
  mode such a slot is emptied (DS:89DC + 4·slot := 0xFFFF) (O).
- The scripts of ECL2 #49–51 load WALLDEF2 records 1 and 2 where record 1 holds two sets and there is no
  record 2: what the original's loader does with the missing record is not traced (**?**; the port leaves
  the slot as it is).

## Open

- The changed handlers listed under [Opcodes](#opcodes) (CHECK_PARTY, TREASURE, LOAD_MONSTER, LOAD_AREA,
  COMBAT, DAMAGE …) are not yet read (**?**).
- What `19d:0`(1) does for the demo, and DS:7420's values 1 and 2 (**?**).
- The meanings of the new record bytes the view reaches (+0x1B, +0x70, +0x1B5) wait for SotSB's record
  map (**?**).
