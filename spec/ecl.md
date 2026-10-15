---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# ECL virtual machine

Part of [[spec/README]]. Disassembler: `tools/ecl.py`. Status markers: **O** observed in code, **I** inferred, **?** unknown.

## Loading (O)

- `ECL<block>.DAX` record *area*; first 2 bytes (`88 13` in every record) skipped
- Remainder copied into a zero-filled 0x1E00-byte buffer mapped at virtual **0x9900–0xB6FF**
- VM reset (`FUN_2fea_01b6`): PC = 0x9900, GOSUB stack emptied, compare flags cleared, text defaults set; unless restoring a save, words 0x4A00–0x4A1F and 0x6E79–0x6E81 are zeroed (per-area variables)

## Vectors (O)

The code starts with five 4-byte `GOTO` instructions. The engine reads their targets; it does not execute them.

| Slot | Address | Name in `ecl.py` | Run by the engine |
|---|---|---|---|
| 0 | 0x9900 | `on_move` | after each command, before the move is applied; scripts use it for area exits by facing |
| 1 | 0x9904 | `on_step` | after the move is applied; scripts dispatch on the square's event byte |
| 2 | 0x9908 | `camp_menu` | player presses Encamp |
| 3 | 0x990C | `camp_confirmed` | after `camp_menu`, if the engine's confirmation succeeds |
| 4 | 0x9910 | `on_enter` | on entering the area |

A vector pointing at 0x9914 (first byte after the table) is the common "nothing" case.

## Execution (O, `FUN_29c3_3171`)

```
run(start): PC = start; stop = false
  while !stop && !quit:
    prev_op = op; op = mem[PC]; dispatch(op)
```

- Each handler advances PC itself
- `EXIT` and `NEW_ECL` set `stop`

## Instruction encoding (O, `FUN_2fea_0000`)

```
instruction := opcode:u8 operand* 
operand     := kind:u8 payload
```

| kind | Payload | Value when read (`FUN_2fea_0136`) |
|---|---|---|
| 0x00 | `lo` | immediate byte `lo` |
| 0x01 | `lo hi` | `mem_read(hi<<8 | lo)` (variable) |
| 0x02 | `lo hi` | immediate word `hi<<8 | lo` |
| 0x03 | `lo hi` | `mem_read(hi<<8 | lo)` (as 0x01) |
| 0x80 | `len` then `len` bytes | inline string, 6-bit packed (below) |
| 0x81 | `lo hi` | string variable at address |
| other | `lo` | treated as one-byte payload; read value undefined (only 2 sites in data, both suspected data-in-code) |

- After the operands, PC += 1 (so the next instruction begins right after the last operand)
- Address operands (jump targets, destinations) use `hi<<8 | lo` regardless of kind
- **Variadic opcodes**: read k fixed operands, the last being a count N, then N more operands

### Packed text (O, `FUN_2fea_1153`, `FUN_2fea_06d3`)

- `len` bytes → 6-bit codes, big-endian bit order, 4 codes per 3 bytes
- Code 0 is skipped; code < 0x20 → ASCII `code+0x40` (`@`, `A`–`Z`, `[`…`_`); otherwise ASCII `code` (space, digits, punctuation)

## Memory map (O, `FUN_2fea_06fb`, `0e0c`, `0c77`)

| Address range | Kind | Notes |
|---|---|---|
| 0x4900–0x4CFF | word array A | game state; 0x4A00–0x4A1F per area |
| 0x6B00–0x6EFF | word array B | some reads are computed (`FUN_2fea_07bc`), writes have side effects (`FUN_2fea_0a74`) (**?** details) |
| 0x9700–0x98FF | word array C | scratch |
| 0x9900–0xB6FF | bytes | the ECL code itself; writable |
| other | engine registers | see below |

Strings in arrays A/B/C are sequences of words terminated by 0, one character per word.

### Engine registers (O)

| Address | Read | Write |
|---|---|---|
| 0xC04B | party X | party X (redraw) |
| 0xC04C | party Y | party Y (redraw) |
| 0xC04D | facing 0–3 (N,E,S,W) | facing, 0–3 (stored ×2), reduced mod 4 |
| 0xC04E | wall type ahead | — |
| 0xC04F | current square's event byte (map plane 2) | — |
| 0xC059, 0xC05F | — | two display parameters (**?**) |
| 0x00B1, 0x00FB, 0x00FC | engine words | ignored |
| 0x033D | facing ×2 | — |
| 0x03DE, 0x00B8, 0x00B9 | — | engine words (**?**) |

## Flags and control flow (O)

- `COMPARE a, b` (handler calls `FUN_2fea_18eb(b, a)`) clears then sets six flags, unsigned: EQ `a==b`, NE `a!=b`, LT `a<b`, GT `a>b`, LE `a<=b`, GE `a>=b`. Strings are compared instead when either operand kind ≥ 0x80 (`FUN_2fea_1815`). `AND`/`OR` set the same flags comparing 0 with the result.
- `IF_xx` (0x16–0x1B): if the flag is clear, skip the next instruction (`FUN_2fea_1ea6`, using its own operand-count table)
- The skip table disagrees with the handlers for 0x0C (skips 2, reads 3) and 0x36 (skips 1, reads 2), and treats variadic opcodes as 0 operands. A faithful reimplementation must reproduce this for scripts that IF-skip those opcodes.
- `GOSUB` pushes the return PC on a linked stack; `RETURN` pops it (with an empty stack it falls through)

## Opcodes

Count = fixed operands; `+N` = variadic. Validated: every opcode appears in data; reachability from vectors covers 97.8% of ECL bytes with no decode errors.

| Op | Name | Count | Semantics | |
|---|---|---|---|---|
| 00 | EXIT | 0 | stop; frees GOSUB stack; resets text cursor | O |
| 01 | GOTO | 1 | PC = addr | O |
| 02 | GOSUB | 1 | push return; PC = addr | O |
| 03 | COMPARE | 2 | set flags | O |
| 04–07 | ADD, SUBTRACT, DIVIDE, MULTIPLY | 3 | `dest = a+b`, `b-a`, `a/b`, `a*b` | O |
| 08 | RANDOM | 2 | `dest = random(0..max)` (max 255 means 0..254) | O |
| 09 | SAVE | 2 | `dest = value` (string if kind ≥ 0x80) | O |
| 0A | LOAD_CHARACTER | 1 | select party member n&0x7F as current; bit 7 forces redraw | O |
| 0B | LOAD_MONSTER | 3 | load monster id, count copies, picture; max 63 monsters | O |
| 0C | SETUP_MONSTER | 3 | sprite, max distance, picture; distance = min(max, clear squares ahead) | O |
| 0D | APPROACH | 0 | distance -= 1 and redraw sprite | O |
| 0E | PICTURE | 1 | show picture n; 255 = clear | O |
| 0F | INPUT_NUMBER | 2 | number input → dest | O |
| 10 | INPUT_STRING | 2 | string input (≤40) → dest | O |
| 11 | PRINT | 1 | print string/number in text window | O |
| 12 | PRINT_CLEAR | 1 | clear text window, then print | O |
| 13 | RETURN | 0 | pop GOSUB | O |
| 14 | COMPARE_AND | 4 | EQ = (a==b && c==d) | O |
| 15 | VMENU | 3+N | vertical menu: dest, prompt, N, N item strings | O |
| 16–1B | IF_EQ … IF_GE | 0 | conditional skip | O |
| 1C | CLEAR_MONSTERS | 0 | monster count = 0, clear treasure list and money table | O |
| 1D | PARTY_STRENGTH | 1 | dest = Σ over party of a weighted sum of 5 stats /10 | O (stats **?**) |
| 1E | CHECK_PARTY | 6 | op1 selects: 0x6BA7 → min/max/average of find/remove traps (char[0x79]); 0x6C1B → of movement (char[0x11C]); 0 → per-member test via `FUN_10ba_2199` (has effect op2); results stored to op3–op6 | O |
| 1F | — | — | no handler (skip table says 2); never used | O |
| 20 | NEW_ECL | 1 | load ECL record n and its map, stop | O |
| 21 | LOAD_AREA | 3 | load GEO record a (255/127 = keep); c = sound/music (**?**) | O/I |
| 22 | PARTY_HAS_RANGER | 2 | dest1 = 1 if any member's class is Ranger or Cleric/Ranger; dest2 = 0 | O |
| 23 | SURPRISE | 4 | d6 surprise rolls → result 0–3 at 0x6DCB | O/I |
| 24 | COMBAT | 0 | start combat with loaded monsters | I |
| 25 | ON_GOTO | 2+N | index, N, N targets | O |
| 26 | ON_GOSUB | 2+N | as ON_GOTO with push | O |
| 27 | TREASURE | 8 | 7 money amounts; item record (≥0x80 = random d100 tables) | O/I |
| 28 | ROB | 3 | target (0 = current, else all), money %, items | I |
| 29 | ENCOUNTER_MENU | 14 | sprite/distance setup, 3 range texts, 5 reaction branches | O/I |
| 2A | GET_TABLE | 3 | `dest = mem[base + index]` | O |
| 2B | HMENU | 2+N | horizontal menu: dest, N, N strings | O |
| 2C | PARLAY | 6 | 5-way talk menu, chosen value → dest | O |
| 2D | CALL | 1 | native routine selected by address (table below) | O |
| 2E | DAMAGE | 5 | dice damage to random members, saving throw | O/I |
| 2F | AND | 3 | `dest = a & b`; flags vs 0 | O |
| 30 | OR | 3 | `dest = a | b`; flags vs 0 | O |
| 31 | REDRAW | 0 | if a picture/sprite is showing (`DS:84E3`), redraw the 3D view and clear the flag | O |
| 32 | FIND_ITEM | 1 | EQ = any party member carries item type t | O |
| 33 | NEWLINE | 0 | text cursor to next line | O |
| 34 | DELAY | 1 | pause (`FUN_4B46_03D5(1, n)`, same routine as the combat round delay) | O/I |
| 35 | SAVE_TABLE | 3 | `mem[base + index] = value` | O |
| 36 | ADD_NPC | 2 | add NPC id with morale | O |
| 37 | LOAD_WALLSETS | 3 | load WALLDEF records into slots 1–3 | O |
| 38 | PROGRAM | 1 | built-in mode: 0 = party/training hall screen, 8 = ending sequence, 9 = encamp (see [[spec/architecture]]) | O |
| 39 | WHO | 1 | prompt, player picks current character | O |
| 3A | CLEAR_BOX | 0 | clear text box | O |
| 3B | FIND_IN_CHAR_LIST | 3 | for each member, scan char bytes 0x18–0x69 for a value → index, member count. The range overruns the 21 memorised-spell slots into race/class/age (original behaviour) | O |
| 3C | PRINT_LIST | 1 | print entries `mem[addr+i]` (as values+1) one per line until a value of 0 or 0xFF; advances the text cursor | O/I |
| 3D | CLEAR_TOP | 0 | clear the upper text region (rows 1–15) and set `DS:84DE` (next print starts lower) | O/I |

## CALL targets (O, `FUN_29c3_2ccf`)

The DOS port maps former C64 machine-code entry points to native routines:

| Address | Effect |
|---|---|
| 0x2C90 | refresh square registers (`0xC04F`) and redraw the view if anything changed |
| 0x8000 | one-on-one duel: all other party members cannot act (char[0x10D] = 0); a copy of the current character named **ROLF** (stats and items copied, AI-controlled, enemy side, morale 0xB2) joins the monsters; sets `DS:84D4`, `B[0x5CC]` = 1 |
| 0x8001 | solo combat: as 0x8000 without the copy (`B[0x5CC]` = 0) |
| 0xBA03 | play one of two sounds depending on engine register 0x3DE (8 or 10) |
| 0xC018 | recompute "wall ahead" (`0xC04E`), map areas only |
| 0xC01E | move the party one square forward (with wrap-around) and refresh square registers |

After a 0x8000/0x8001 fight the aftermath awards `100 × char[0x73]` experience to the current character (see [[spec/progression]]).
