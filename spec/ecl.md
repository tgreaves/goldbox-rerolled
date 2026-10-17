---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# ECL virtual machine

Part of [[spec/README]]. Disassembler: `tools/ecl.py`. Status markers: **O** observed in code, **I** inferred, **?** unknown.

## Loading (O)

- `ECL<block>.DAX` record *area*; first 2 bytes (`88 13` in every record) skipped
- Remainder copied into a zero-filled 0x1E00-byte buffer mapped at virtual **0x9900–0xB6FF**
- VM reset (`FUN_2fea_01b6`): PC = 0x9900, GOSUB stack emptied, compare flags cleared, text defaults set; unless restoring a save, words 0x4A00–0x4A1F and 0x6E79–0x6E82 are zeroed (per-area variables); it also resets 0x6DE1, 0x6DD2, 0x6DD3, 0x49E5 and sets 0x49E6 = 1 (see `NEW_ECL`)

## Vectors (O)

The code starts with five 4-byte `GOTO` instructions. The engine reads their targets; it does not execute them.

| Slot | Address | Name in `ecl.py` | Run by the engine |
|---|---|---|---|
| 0 | 0x9900 | `on_move` | when the player tries to move, before the move; also after every area entry. Scripts use it for exits by facing, or set 0x6DC9 to cancel the move |
| 1 | 0x9904 | `on_step` | after the move attempt (even if blocked), on Look, and after area entry; scripts dispatch on the square's event byte |
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

The reader fills an operand table: kind at `DS:7005+i`, first payload byte **LO** at `DS:7085+i`, second byte **HI** at `DS:7045+i`. String operands are decoded into their own buffers, numbered by string operand within the call (`DS:6FC8 + k·0x100`, k = 1, 2, …).

| kind | Payload | Value as a number (`FUN_2fea_0136`) | As a string |
|---|---|---|---|
| 0x00 | `lo` | immediate byte `lo` | — |
| 0x01 | `lo hi` | `mem_read(hi<<8 | lo)` | — |
| 0x02 | `lo hi` | immediate word `hi<<8 | lo` | — |
| 0x03 | `lo hi` | `mem_read(hi<<8 | lo)` | — |
| 0x80 | `len`, then `len` packed bytes | `mem_read(stale_hi<<8 | len)` (nonsense; never used) | inline text |
| 0x81 | `lo hi` | immediate word `hi<<8 | lo` | string variable at `hi<<8 | lo` |
| other | `lo` | undefined | — |

- After the operands, PC += 1, so the next instruction begins right after the last operand
- **HI is only written for kinds 1, 2, 3 and 0x81.** An address operand is always `HI<<8 | LO`, so a kind-0 operand used as an address picks up the HI byte left by an earlier instruction
- **Variadic opcodes** read k fixed operands (the last is a count N), step PC back by one, then read N more operands into slots 1..N (overwriting the fixed ones, and restarting the string buffer count)
- Ghidra lists this compiler's far-call parameters in reverse push order; the operand orders in this file come from the push sequences in the assembly

### Packed text (O, `FUN_2fea_1153`, `FUN_2fea_06d3`)

- `len` bytes → 6-bit codes, big-endian bit order, 4 codes per 3 bytes
- Code 0 is skipped; code < 0x20 → ASCII `code+0x40` (`@`, `A`–`Z`, `[`…`_`); otherwise ASCII `code` (space, digits, punctuation)

## Memory map (O, `FUN_2fea_06fb`, read `FUN_2fea_0e0c`, write `FUN_2fea_0c77`)

Every address in arrays A, B and C holds one **16-bit word** (address *n* is word *n − base*); the code area is bytes.

| Address range | Kind | Storage |
|---|---|---|
| 0x4900–0x4CFF | word array A | far buffer `DS:49D2`, byte offset `(n − 0x4900)·2`; game state, 0x4A00–0x4A1F per area |
| 0x6B00–0x6EFF | word array B | far buffer `DS:49D6`, byte offset `(n − 0x6B00)·2`; part of it is a view of the current character (below) |
| 0x9700–0x98FF | word array C | far buffer `DS:49DA`; scratch |
| 0x9900–0xB6FF | bytes | the ECL code itself; writable (a write stores the low byte) |
| anything else | engine registers | see below; unlisted addresses read as an undefined value and ignore writes |

Strings in arrays A/B/C are sequences of words terminated by 0, one character per word.

**Notation used in the other spec files:** `A[0x1CA]`, `B[0x6D8]` and similar with values below 0x800 are **byte offsets** into the buffer, so the ECL address is base + offset/2 (`B[0x6D8]` = ECL 0x6E6C). Values written as 0x49xx/0x4Axx or 0x6Bxx–0x6Exx are ECL addresses.

### Side effects of A writes (O)

- 0x49FD, 0x49FE: also set `DS:84E8` (**I**: forces a redraw)

### B as a view of the current character (O, `FUN_2fea_07bc` read, `FUN_2fea_0a74` write)

The B array keeps the C64 layout of the character record at 0x6B00. Some addresses are redirected to the DOS record of the current character (`DS:5D92`); all other B addresses are plain storage. A write always also stores the word in the B buffer; a read of a mapped address ignores the buffer.

| ECL address | Read returns | Write does |
|---|---|---|
| 0x6B00 | buffer | value 0 sets `DS:84D3` (**?**) |
| 0x6B18 | char[0x14] CON | — |
| 0x6B20–0x6B70 | buffer (not mapped) | char[0x17 + (n − 0x6B20)] = low byte: memorised spells and spell-known flags |
| 0x6B9B | char[0x6E] (second saving throw) | — |
| 0x6BA0 | char[0x73] highest level (signed) | — |
| 0x6BA5–0x6BAC | thief skills char[0x77..0x7E] | — |
| 0x6BB8 | char[0x84] NPC morale | char[0x84] = v (minus 0x32 if v > 0xB2) |
| 0x6BBB, BD, BF, C1, C3 | money words char[0x88], [0x8A], [0x8C], [0x8E], [0x90] (copper … platinum) | same |
| 0x6BD8 | char[0xA0] alignment (signed) | — |
| 0x6BF7 | word char[0xB8] (**?**) | same |
| 0x6BF9 | char[0xBA] (**?**) | same |
| 0x6C00 | 0x80 if char[0x10D] = 0 (cannot act), else 1 | v ≥ 0x80: char[0x10D] = 0, and v = 0x87 also sets status char[0x10C] = 7 (Stoned); v = 0 sets `DS:84D2` (**?**) |
| 0x6C0C | 0x80 if char[0x10E] = 0 and char[0x10F] ≠ 0; 0x81 if char[0x10E] = 1; else 0 | 0 → [0x10E]=0,[0x10F]=0; 0x80 → 0,1; 0x81 → 1,1 |
| 0x6C0D | undefined (the original returns an uninitialised word) | — |
| 0x6C1B | char[0x11C] movement | — |
| 0x6DB1, 0x6DB4 | position of the current character in the party (0-based) | — |
| 0x6DCF | CHA table: CHA 3→0, 4→5, 5→10, 6→15, 7→20, 8–12→25, 13→30, 14→35, 15→40, 16→50, 17→55, 18–25→60 (**I**: reaction/loyalty %) | — |
| 0x6E12 | current block digit `DS:5376` | switch block (`FUN_1802_094a(3, v)`) |
| 0x6E22, 0x6E24, 0x6E26 | buffer | v > 0x80: load wall set v & 0x7F into slot 1, 2, 3 (`FUN_55a0_0e08`) |
| 0x6E3E | party size (same word as the buffer) | — |

### Engine-visible variables (O unless marked)

Variables the engine itself reads or writes, so a port must give them meaning. Everything else in A, B and C is script-private.

| ECL address | Meaning | Spec |
|---|---|---|
| 0x49C3, 0x49C4 | overland x, y (wilderness) | [[spec/combat]] |
| 0x49C5 | current GEO record (restored on load) | [[spec/savegame]] |
| 0x49E5 | area flag: no item Use / no AI item use | [[spec/town]], [[spec/combat]] |
| 0x49E6 | ≠ 0: areas 25–27 behave as map areas instead of overland travel | [[spec/architecture]] |
| 0x49E7, 0x49E8 | both ≠ 0: `LOAD_WALLSETS` loads only operands 1 and 3 (slots 1 and 3), so a two-set record in slot 1 keeps slot 2. Block 4 and 5 scripts set both before using two-set records such as WALLDEF5 #24 | this file |
| 0x49F0, 0x49F1 | party X, Y before the last move | [[spec/architecture]] |
| 0x49F2 | current area id (written by `NEW_ECL`) | this file |
| 0x49FB | ≠ 0: the Area (overhead map) command answers "Not Here" | [[spec/architecture]] |
| 0x49FC | game speed copy (save) | [[spec/savegame]] |
| 0x49FD, 0x49FE | written values force a redraw (**?** meaning) | above |
| 0x49FF | monster/portrait toggles copy (save) | [[spec/savegame]] |
| 0x4A00–0x4A1F | per-area variables, zeroed on area entry | this file |
| 0x4AA2 | if ≠ 0 on load, run `FUN_4804_06b3` (**?**) | [[spec/savegame]] |
| 0x4AB3 | 0xFF changes arid wilderness terrain | [[spec/combat]] |
| 0x4AFA–0x4AFF | wall-set record ids and slots (save) | [[spec/savegame]] |
| 0x6DA8 | trainable class mask for the training hall | [[spec/progression]] |
| 0x6DC0, 0x6DC1 | encounter sprite maximum and current distance | below |
| 0x6DC7 | outcome of the last `COMBAT`: 0 won, 0x80 party defeated, 0x81 party fled (`FUN_2e08_1527`, `FUN_2e08_04c9`) | [[spec/combat]] |
| 0x6DC8 | after a battle: number of enemy-side combatants (char[0x10E] = 1) left unable to act, counted while `FUN_2e08_11ac` removes them (**I**: enemies defeated) | [[spec/combat]] |
| 0x6DC9 | set to ≥ 0xFF by `on_move` to cancel the move (the engine then resets it to 0) | [[spec/architecture]] |
| 0x6DCA | bit 0 = Search mode, bit 1 = Look requested | [[spec/architecture]] |
| 0x6DCB | SURPRISE result | below |
| 0x6DC6 | encounter morale | [[spec/combat]] |
| 0x6DD2, 0x6DD3 | rest-encounter interval (steps) and chance % | [[spec/camp]] |
| 0x6DD5 | 1 when the attempted move would leave the 16×16 map (set before `on_move`; cleared on area entry); scripts use it for edge exits | [[spec/architecture]] |
| 0x6DE1 | portrait selector | [[spec/graphics]] |
| 0x6DE2 | temple flag for `COMBAT` | [[spec/town]] |
| 0x6DE6 | duel flag (`CALL 0x8000`) | [[spec/progression]] |
| 0x6E12 | block digit | above |
| 0x6E3E | party size | above |
| 0x6E6C | shop flag for `COMBAT` | [[spec/town]] |
| 0x6DE3 | cleared after every battle (**?**) | [[spec/combat]] |
| 0x6E70 | to-hit bonus for the enemy side (char[0x10E] = 1) in the next battle | [[spec/combat]] |
| 0x6E71 | to-hit bonus for the party side | [[spec/combat]] |
| 0x6E72 | combat movement bonus for the party side (`FUN_3aae_0123`) | [[spec/combat]] |
| 0x6E79–0x6E82 | scratch, zeroed by every `NEW_ECL` | this file |

0x6DE3, 0x6DE6 and 0x6E70–0x6E72 are all reset to 0 at the end of every battle, so scripts set them just before `COMBAT`.

### Engine registers (O)

| Address | Read | Write |
|---|---|---|
| 0xC04B | party X | party X (redraw) |
| 0xC04C | party Y | party Y (redraw) |
| 0xC04D | facing 0–3 (N,E,S,W) | facing, 0–3 (stored ×2), reduced mod 4 |
| 0xC04E | wall type ahead | — |
| 0xC04F | current square's event byte (map plane 2) | — |
| 0xC059, 0xC05F | — | two display parameters (**?**) |
| 0x00B1, 0x00FB, 0x00FC | engine words `DS:6F6E`, `6F6A`, `6F6C` | ignored |
| 0x033D | facing ×2 (0–7, so overland scripts can use 8 directions) | — |
| anything else (e.g. 0x035F) | undefined (an uninitialised local) | ignored |
| 0x03DE, 0x00B8, 0x00B9 | — | engine words (**?**) |

## Flags and control flow (O)

- `COMPARE a, b` clears then sets six flags (`DS:6F78..6F7D`), unsigned: EQ `a==b`, NE `a!=b`, LT `a<b`, GT `a>b`, LE `a<=b`, GE `a>=b`, where a is operand 1. Strings are compared instead when either operand kind ≥ 0x80 (`FUN_2fea_1815`). `AND`/`OR` set the same flags comparing 0 with the result.
- `IF_xx` (0x16–0x1B): if the flag is clear, skip the next instruction (`FUN_2fea_1ea6`, using its own operand-count table)
- The skip routine has its own operand-count table (the VM PC is `DS:49ED`):

  | Skips | Opcodes |
  |---|---|
  | 1 operand | 01 02 0A 0E 11 12 1D 20 2D 32 34 36 38 39 3C |
  | 2 | 03 08 09 0C 0F 10 1F 22 |
  | 3 | 04–07 0B 21 28 2A 2F 30 35 37 3B |
  | 4 | 14 23 |
  | 5 | 2E |
  | 6 | 1E 2C |
  | 8 | 27 |
  | 14 | 29 |
  | just the opcode byte | everything else, including the variadic 15, 25, 26, 2B |

  It disagrees with the handlers for 0x0C (skips 2, reads 3) and 0x36 (skips 1, reads 2), and skipping a variadic opcode lands inside its operands. A faithful reimplementation should copy this table, but no shipped script puts any of these opcodes directly after an IF (checked over all reachable code), so the mismatches never trigger.
- `GOSUB` pushes the return PC on a linked stack; `RETURN` pops it (with an empty stack it falls through)

## Opcodes

Operands are numbered from 1. *val n* is the numeric value of operand n, *addr n* its address (`HI<<8 | LO`), *str n* its text. Handlers are in segment 29c3. Every opcode appears in the data; the disassembler reaches 97.8% of ECL bytes with no decode errors, and the interpreter (`tools/eclvm.py`) runs every area on every square without error ([[#Validation]]).

### Control flow

| Op | Name | Operands | Semantics | |
|---|---|---|---|---|
| 00 | EXIT | — | stop; free the GOSUB stack; text cursor to (1, 17); if `LOAD_CHARACTER` was used, the current character reverts to the one saved by the engine (`DS:4436`) | O |
| 01 | GOTO | addr 1 | PC = target | O |
| 02 | GOSUB | addr 1 | push the PC after the instruction; jump | O |
| 13 | RETURN | — | pop; with an empty stack, fall through | O |
| 16–1B | IF_EQ … IF_GE | — | if the flag is clear, skip the next instruction (table above) | O |
| 25 | ON_GOTO | val 1 index, val 2 N, then N addresses | both bytes; if index < N jump to target index (0-based), else fall through | O |
| 26 | ON_GOSUB | as ON_GOTO | push the PC after the whole instruction, then jump | O |
| 1F, ≥ 3E | — | — | no handler: PC never advances and the game hangs. Never used | O |

### Data and arithmetic

| Op | Name | Operands | Semantics | |
|---|---|---|---|---|
| 03 | COMPARE | val 1, val 2 | flags from **val 1 ? val 2**, unsigned (IF_LT ⇔ op1 < op2). If either kind ≥ 0x80, compare the 1st and 2nd *string* buffers instead (Pascal order: bytewise, shorter prefix is less, case-sensitive). All 25 string compares in the data are string against string | O |
| 04 | ADD | val 1, val 2, addr 3 | dest = (a + b) & 0xFFFF | O |
| 05 | SUBTRACT | val 1, val 2, addr 3 | dest = **b − a** | O |
| 06 | DIVIDE | val 1, val 2, addr 3 | dest = a div b; b = 0 aborts the game (runtime error 200) | O |
| 07 | MULTIPLY | val 1, val 2, addr 3 | dest = (a · b) & 0xFFFF | O |
| 08 | RANDOM | val 1 max (byte), addr 2 | m = max + 1 unless max = 255; dest = Random(m), i.e. 0..max (0..254 for 255) | O |
| 09 | SAVE | val/str 1, addr 2 | number: write; string: store one character per word plus a 0 terminator (at 0x6B00: the current character's name, max 15). Storing an **empty** string also overwrites the next 255 words with stack garbage in the original | O |
| 14 | COMPARE_AND | val 1–4 | clear all flags; EQ = (a = b and c = d), else NE | O |
| 2A | GET_TABLE | addr 1 base, val 2 index, addr 3 | dest = mem[base + (index & 0xFF)] | O |
| 2F | AND | val 1, val 2, addr 3 | r = (a & b) & 0xFF; flags from compare(0, r); dest = r | O |
| 30 | OR | as AND | with a \| b | O |
| 35 | SAVE_TABLE | val 1 value, addr 2 base, val 3 index | mem[base + index] = value (full 16-bit index) | O |

### Text and input

| Op | Name | Operands | Semantics | |
|---|---|---|---|---|
| 11 | PRINT | val/str 1 | numbers as unsigned decimal; word-wrapped into the text window (columns 1–38, rows 17–22) from the cursor; a full window waits for a key and clears | O |
| 12 | PRINT_CLEAR | as PRINT | cursor to (1, 17) and clear the window first | O |
| 33 | NEWLINE | — | column 1, next row | O |
| 3A | PAUSE | — | wait game speed × 225 ms (`FUN_1709_0dbe`; speed 0–9 from the Alter menu, so 0–2 s). Scripts use it to pace animation, e.g. an encounter sprite approaching, or each step of Rolf's tour. Earlier versions of this spec called it CLEAR_BOX | O |
| 3D | CLEAR_TOP | — | clear columns 1–15, rows 1–15; the next PRINT_LIST starts at (2, 5) | O |
| 3C | PRINT_LIST | addr 1 | draw raw font glyphs `(mem[a+i] + 1) & 0xFF` along one row in colour 15 until a value of 0 or 0xFF, then move to the next row | O |
| 0F | INPUT_NUMBER | (op 1 unused), addr 2 | up to 6 digits, re-prompted until valid and ≤ 65536; dest = value & 0xFFFF | O |
| 10 | INPUT_STRING | (op 1 unused), addr 2 | up to 40 characters 0x20–0x7A, Enter or Esc ends; uppercased; empty becomes " "; stored as a string | O |
| 15 | VMENU | addr 1, str 2 prompt, N, N items | prompt printed like PRINT_CLEAR, items as a vertical list; dest = 0-based choice (word) | O |
| 2B | HMENU | addr 1, N, N items | horizontal menu on row 24; each item's first letter is its hotkey; with one item Enter also works (and "PRESS <RETURN> OR BUTTON TO CONTINUE" is shown as "PRESS <ENTER>/<RETURN> TO CONTINUE"); dest = 0-based choice (byte) | O |
| 2C | PARLAY | val 1–5, addr 6 | menu HAUGHTY / SLY / NICE / MEEK / ABUSIVE; dest = the **value** given for the chosen attitude (val c+1 & 0xFF), not the index | O |
| 39 | WHO | str 1 prompt | the player picks a party member, who becomes the current character; nothing is stored | O |

### Party and characters

All of these walk the party list `DS:5D96`, which **also holds loaded monsters** after `LOAD_MONSTER` (see [[#Monsters in the party list]]).

| Op | Name | Operands | Semantics | |
|---|---|---|---|---|
| 0A | LOAD_CHARACTER | val 1 | current character = list entry (val & 0x7F), 0-based; unchanged past the end. Marks the engine to restore its own selection at EXIT/PROGRAM | O |
| 1D | PARTY_STRENGTH | addr 1 | Σ over the list of `(HP + 5·max(char[0x111] − 60, 0) + 5·max(char[0x110] − 39, 0) + 8·MU level + 4·Cleric level) div 10`, in a byte that wraps | O |
| 1E | CHECK_PARTY | op 1 selector, val 2 effect, addr 3–6 min, max, avg, found | selector 0: found = 1 if a member has effect val 2 (min/max/avg = 0). Selector address 0x6BA7: min/max/average of char[0x79] (find/remove traps); 0x6C1B: of movement char[0x11C]; found = 0. Other selectors write nothing | O |
| 22 | PARTY_HAS_RANGER | addr 1, addr 2 | dest1 = 1 if any member's class is Ranger (4) or Cleric/Ranger (10); **dest2 is always 0**. Scripts feed both into SURPRISE | O |
| 32 | FIND_ITEM | val 1 type | EQ if any member carries an item of that type (item[0x2E]), else NE; other flags cleared | O |
| 36 | ADD_NPC | val 1 id, val 2 morale | add NPC id to the party; morale char[0x84] = (val 2 >> 1) \| 0x80; enemy-side flag char[0x10E] = 1 only for id 0x18. Handler `29c3:2B7E`, loader `FUN_45c5_1262`: nothing is added with 8 in the party, but morale and side are still written to the current character; the record, items and effects come from `MON<block>CHA/ITM/SPC` like `LOAD_MONSTER` (`FUN_45c5_0ec4`: icon size char[0xC0] 1 for races 1/3/5 and 2 for 2/4/6/7, icon colours char[0xC1..0xC3], [0xC5..0xC6] = (d6 + 8)·16 + d6, char[0xC4] = 0xC4); char[0xAB] = Random(256); a random class among its levels (none → 2) picks the portrait body char[0xBC] from `DS:08D7` (cleric), `08EB` (magic-user), `08F5` (thief) or `08E1` (others) at gender·5 + d5, and the head char[0xBB] from `DS:08C7` at gender·8 + d8; the NPC joins the end of the party and becomes current | O |
| 3B | FIND_IN_CHAR_LIST | val 1, addr 2, addr 3 | meant to find a value in char bytes 0x18–0x69. **Broken**: it keeps both destinations as bytes, so the results go to engine addresses (`addr & 0xFF`) and are discarded; it only ever scans the first list entry. The one use (`#31, [0x6E7D], [0x6E7E]`) therefore leaves its variables unchanged | O |
| 28 | ROB | val 1 target (0 = current, else everyone), val 2 percent p, (op 3 unused) | each money word = trunc(v·(100 − p)/100). Items: for each item in turn, p is first lowered **in place** (weight > 255: −90; weight > 24: −50; floor 0), then d100 ≤ p takes it; later items inherit the lowered p. A taken item is freed (whole stack, readied or not), not added to any treasure. No message, and the stats are not recomputed (the port does, IMP-049) | O |
| 2E | DAMAGE | val 1 flags, val 2 dice count, val 3 dice sides, val 4 bonus, val 5 save/attack | damage = bonus + count d sides, rerolled per victim (handler 29c3:2775). Flags bit 7 clear: flags = number of attacks, each on a random member, hitting if d20 (1 misses, 20 → 100) + val 5 > char[0x111]. Bit 7 set: save bonus = flags & 0x1F, save type = val 5 & 7, and:<br>– bit 6 clear, val 5 bit 7 clear: one random member, damaged unless the save succeeds<br>– bit 6 clear, val 5 bit 7 set: the current character, save type (val 5 & 7) − 1, no save if that is 0<br>– bit 6 set: every member; with bit 5 set no save is allowed<br>If nobody can act afterwards, the game ends (`DS:49FF`) | O |

### Monsters, encounters and treasure

| Op | Name | Operands | Semantics | |
|---|---|---|---|---|
| 0B | LOAD_MONSTER | val 1 record, val 2 count (0 → 1), val 3 icon record | nothing if 63 monsters are loaded. Load `MON<block>CHA` record, its combat icon (`CPIC` record) into the next icon slot (from 8), and **append** count copies (with items and effects) to the party list | O |
| 1C | CLEAR_MONSTERS | — | monster count 0, icon slot 8, money table and treasure list cleared. Does **not** unlink monsters from the party list | O |
| 0C | SETUP_MONSTER | val 1 sprite, val 2 max distance, val 3 picture | 0x6DC0 = max; distance 0x6DC1 = min(max, open squares ahead, at most 2; always 2 outdoors); draw the `SPRIT` frame for that distance, or the picture at distance 0 | O |
| 0D | APPROACH | — | if distance > 0: distance − 1, redraw | O |
| 0E | PICTURE | val 1 | 255: restore the 3D view. Otherwise show `PIC` record n, or, when portrait selector 0x6DE1 ≠ 0xFF, a head/body portrait (head 0x6DE1, body n) | O |
| 23 | SURPRISE | val 1–4 (bytes) | a = v4 + 2 − v1, b = v2 + 2 − v3 (signed bytes); two d6 rolls r1, r2. Result 0; r1 ≤ a → 1 (or 3 if also r2 ≤ b); then r2 ≤ b → 2. So **3 never comes out**. Written to 0x6DCB | O |
| 29 | ENCOUNTER_MENU | 14, below | stores 0–3 in addr 4; never jumps | O |
| 24 | COMBAT | — | without loaded monsters: shop if 0x6E6C = 1, temple if 0x6DE2 = 1 (flag cleared), else the treasure screen. Otherwise the battle and its aftermath ([[spec/combat]]), which sets the outcome 0x6DC7 | O |
| 27 | TREASURE | val 1–7 money, val 8 items | money table = the seven values. Items: < 0x80 load `ITEM<block>` record (63-byte items, **prepended** so they end up reversed; a missing record halts the game); 0xFF none; 0x80–0xFE that many random items from the table below | O |

**ENCOUNTER_MENU** operands: 1 sprite, 2 max distance, 3 picture, **4 destination**, 5–9 reaction codes for COMBAT, WAIT, FLEE, ADVANCE, PARLAY, 10–12 texts for distance 0, 1, 2, 13 flee threshold f, 14 pursuit threshold g.

1. Party movement range: slowest and fastest char[0x11C] over the list (×2 with Haste, ÷2 with Slow).
2. Distance = min(op 2, open squares ahead ≤ 2), drawn as in SETUP_MONSTER.
3. Loop: print the first non-empty text starting from the current distance (wrapping). Menu COMBAT / WAIT / FLEE / PARLAY at distance 0 or outdoors, otherwise COMBAT / WAIT / FLEE / ADVANCE (PARLAY counts as choice 4). Act on code r = op(5 + choice):

| r | COMBAT | WAIT | FLEE | ADVANCE | PARLAY |
|---|---|---|---|---|---|
| 0 | 1 | 1 | slowest < f ? 1 : 2 | 1 | 1 |
| 1 | 1 | "Both sides wait." | 2 | approach | 3 at distance 0, else approach |
| 2 | fastest < g ? 0 : 1 | 0 | 0 | 0 | 0 |
| 3 | 1 | approach | 2 | approach | 3 at distance 0, else approach |
| 4 | 1 | 3 at distance 0, else approach | 2 | 3 at distance 0, else approach | 3 at distance 0, else approach |
| ≥ 5 | leave without writing | | | | |

Stored values: **0** the monsters flee ("The monsters flee."), **1** combat, **2** the party escapes, **3** parlay. "Approach" lowers the distance and loops ("Both sides wait." at distance 0). Scripts follow with `ON_GOTO [dest], 4, …`.

**Random treasure**: the `TREASURE` handler (`29c3:19B0`) picks each item's type with d100 rolls, calls `FUN_4c2d_1010(type, item)` to build the 63-byte record, and prepends the record to the treasure list. After the last item it rebuilds every list item's display name. **48–49 on the second d100 leave the type unset, so the previous item's type repeats.** The full algorithm, with the dice, the bytes set for each outcome, the random item array at DS:0972 and its bugs, is in [[spec/records#Random items]] (O).

### Monsters in the party list

`LOAD_MONSTER` appends monsters to the same list as the party, so PARTY_STRENGTH, CHECK_PARTY, FIND_ITEM, PARTY_HAS_RANGER, ROB (target ≠ 0) and ENCOUNTER_MENU include any loaded monsters. Monsters carry the enemy-side flag char[0x10E] = 1 (171 of the 172 monster records). They stay in the list until a battle's aftermath removes them (`FUN_2e08_11ac`), so a script that loads monsters and then avoids the fight (parlay, flee) leaves them counted by these opcodes until the next `COMBAT` (**I**: no other place that unlinks them has been found).

### World and engine

| Op | Name | Operands | Semantics | |
|---|---|---|---|---|
| 20 | NEW_ECL | val 1 area | 0x49F2 = old area; load `ECL<block>` record n; VM reset (vectors; flags; stack; icon slot 8; 0x6DE1 = 0xFF; 0x6DD2 = 0x6DD3 = 0; 0x49E5 = 0; **0x49E6 = 1**; unless restoring a save, 0x4A00–0x4A1F and 0x6E79–0x6E82 = 0); stop; signal an area change | O |
| 21 | LOAD_AREA | val 1 GEO record, (op 2 unused), val 3 | if val 1 ∉ {0x7F, 0xFF} and 0x49E6 ≠ 0: 0x49C5 = val 1, load the GEO record, 0x6DC9 = 0. If val 3 ≠ 0xFF and 0x49E6 = 0: load the `BACPAC` backdrop | O |
| 37 | LOAD_WALLSETS | val 1–3 | 0x7F: clear to set 0 in slot 1. If 0x49E7 and 0x49E8 are both set: load val 1 → slot 1, val 3 → slot 3. Else for each slot: 0xFF empties it, otherwise load that `WALLDEF<block>` record (one record may fill several slots) | O |
| 2D | CALL | addr 1 | native routine, table below | O |
| 31 | REDRAW | — | if an encounter sprite is showing, redraw the 3D view | O |
| 34 | DELAY | val ? | **passes game time** (the rest-loop clock routine `FUN_4b46_03d5`), not a pause. Its operand is read with an uninitialised index, so the amount is undefined; used once in the data (`DELAY #1`, ECL7 record 17), where in practice it passes 0 minutes, so nothing happens (**I**); the port does nothing | O |
| 38 | PROGRAM | val 1 | 0 party/training-hall screen; 8 ending; 9 camp (runs `camp_menu`, the camp screen, then `camp_confirmed` if the camp was interrupted), then acts as EXIT | O |

## CALL targets (O, `FUN_29c3_2ccf`)

The DOS port maps former C64 machine-code entry points to native routines:

| Address | Effect |
|---|---|
| 0x2C90 | refresh square registers (`0xC04F`) and redraw the view if anything changed |
| 0x8000 | one-on-one duel: all other party members cannot act (char[0x10D] = 0); a copy of the current character named **ROLF** (stats and items copied, AI-controlled, enemy side, morale 0xB2) joins the monsters; sets `DS:84D4`, `B[0x5CC]` = 1 (byte offset 0x5CC of the word-per-variable block at `DS:49D6` = ECL 0x6DE6) |
| 0x8001 | solo combat: as 0x8000 without the copy (`B[0x5CC]` = 0) |
| 0xBA03 | play one of two sounds depending on engine register 0x3DE (8 or 10) |
| 0xC018 | recompute "wall ahead" (`0xC04E`), map areas only |
| 0xC01B | nothing in the DOS port. The overland scripts (areas 25–27) call it and then read engine address 0x035F as the destination tile; that address is unmapped and returns an undefined value, so this C64 tile check is dead code (**I**: overland legality is done natively by `FUN_3e76_0818`) |
| 0xC01E | move the party one square forward (with wrap-around) and refresh square registers |

After a 0x8000/0x8001 fight the aftermath awards `100 × char[0x73]` experience to the current character (see [[spec/progression]]).

## Validation

`tools/eclvm.py` implements this file, quirks included, on top of a save game; `tools/eclsweep.py` runs it over every area of the shipped scripts:

- all 29 ECL records in the 8 blocks: enter the area, then from every square and facing (1,024 starts per area) attempt a move, running `on_move` and `on_step`, with menus answered at random
- 29,696 runs: no decode errors and no missing handlers. With every menu answered "first option", 101 runs loop forever; each one checked is a genuine in-game loop (for example, re-opening the same empty cabinet in area 14 of block 3)
- the variables the scripts touch were checked against the engine-visible table above; the remaining ones are script-private
- with edge exits modelled (0x6DD5), 2 runs fail: block 1 area 24 on its second map (GEO 31) has open south-edge squares (4,15) and (11,15) whose exit table entry is 255. Walking off there would make the original try to load ECL record 255, and its loader retries forever (**I**: a bug in the original, or squares never reached in play; unconfirmed)
- the sweep starts every area from the shipped save's variables, so area-specific story state is not explored
- not yet compared against the running original (DOSBox)
