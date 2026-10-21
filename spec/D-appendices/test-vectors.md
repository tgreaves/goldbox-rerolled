# Test vectors

> **Status: complete** (work-plan step 6, [AUDIT.md](../AUDIT.md) §8). Normative: a conforming build
> produces these outputs from these inputs. Part D of the [specification](../README.md).

Inputs and the outputs a conforming build must give for them, for the procedures of part B and the
validations V1, V3, V5–V8 of [CLEANROOM.md](../CLEANROOM.md#4-the-validations): the dice source
(D2), hit points, caster level, joining, the strength encoding, appraisal, the derived statistics (spell
slots, saving throws, thief skills, THAC0), creation, training, money, the battlefield generators,
spells on a battlefield (the bolt, the clouds), attacks, saving throws, random treasure, headless
script runs and battles, the sound driver, and the decoders. The vectors themselves are the file
[test-vectors.json](test-vectors.json) beside this one (the **manifest**); §5 lists them.

## 1. Kinds

| Kind | Needs | Output in the manifest |
|---|---|---|
| **S** synthetic | nothing: the input states every record, table and map | in full |
| **E** executable | the game's `START.EXE` (its tables, its spell records) and `GAME.OVR` (its texts); records and fields are made up | in full: rules values only, numbers, no game text |
| **F** files | the player's game files (saves, maps, DAX records) | SHA-256 and length of the canonical output (§3): no game data is in the manifest |

E and F vectors were computed with the game files whose `START.EXE` SHA-256 the manifest's `releases`
gives (the GOG releases, [por/README.md](../A-games/por/README.md), [coab/README.md](../A-games/coab/README.md));
with another release they do not apply.

## 2. The manifest

`test-vectors.json` is a JSON object: `format` `"goldbox-test-vectors"`, `version` 1, `releases`
(per game id, `{ "startExe": sha256 }`) and `vectors`, a list of objects:

| Member | Meaning |
|---|---|
| `id` | the vector's name: kind, procedure, game, number (`S-hp-coab-4`) |
| `kind` | `S`, `E` or `F` |
| `game` | the profile id: `por`, `coab` (the game whose profile, rules and tables apply) |
| `procedure` | which procedure (§4) |
| `input` | the procedure's input (§4) |
| `tape` | when the procedure rolls: the dice tape, as **runs**: `[count, sides, result, result …]` is that many draws of the request `(count, sides)` in a row; expanding every run in order gives the draws of [host-contracts.md §6.4](../B-model/host-contracts.md#64-the-tape-format) |
| `output` | S and E: the output |
| `sha256`, `bytes` | F: the SHA-256 (lower-case hex) and length of the canonical output |

**Checking a vector.** Answer the procedure's dice requests from the tape (a replaying source, §6.4): a
request that differs from the next draw, or a tape that runs out, is a **divergence**, and every draw
must have been used when the procedure returns. Then compare the output: for S and E, member for
member; for F, the SHA-256 of the canonical output.

## 3. Conventions

- **Records by field name.** A record input is an object of field names of the game's field map
  ([records-and-tables.md §2.2](../B-model/records-and-tables.md#22-the-maps)): a record of the game's
  layout, every byte 0, then each named field set: `name` a Pascal string; `stat` the six abilities;
  `money` seven u16; `age` u16 and `xp` u32 little-endian; a list sets consecutive bytes from the
  field (`levels`, `saves`, `attacksLeft` …); a number sets the byte.
- **Made-up tables.** An S input `tables` lists `[table, offset, bytes]`: the game's data segment is all
  zeros except those bytes at the table's address ([records-and-tables.md §3](../B-model/records-and-tables.md#3-the-table-map-tablemap))
  plus the offset.
- **Made-up maps.** A map is `walls` `[x, y, side 0–3 (N E S W), wall type]` (the GEO planes 0–1 nibble
  of that side), `doors` `[x, y, side, passage]` (plane 3's two bits of that side), `events` `[x, y,
  byte]` (plane 2); every other byte 0 ([maps-and-view.md](../A-games/engine/maps-and-view.md)).
- **Battlefield rows.** A battlefield is given as 25 strings, one per row, of 50 cells as two hex digits
  each.
- **Canonical output** (F, and how S and E outputs are compared): bytes as they are; anything else as
  its JSON text in UTF-8, as ECMAScript's `JSON.stringify` writes it with no indentation (members in
  the order §4 lists them, integers in decimal, strings with JSON's escapes).

## 4. Procedures

Each procedure names what it runs (the part B or part A section that defines it) and what its input
and output are.

| Procedure | Kind | Runs | Input | Output |
|---|---|---|---|---|
| `tape.replay` | S | a replaying dice source ([§6.4](../B-model/host-contracts.md#64-the-tape-format)) | `draws` (a tape's draws), `requests` | `refused` (the tape is refused before any request); `results`; `divergence` (the index of the request that diverged, or null) |
| `dice.random` | S | `Random(n)` as the request (1, n) − 1 ([§6.1](../B-model/host-contracts.md#61-the-rule-d2)) | `n`: a list | `values` |
| `line.walk` | S | the line walker of line of sight, bolts and the aim ([battlefield.md, "Line of sight and range"](../A-games/engine/battlefield.md#line-of-sight-and-range-o-fun_56c1_0422)): Bresenham, a straight step 2, a diagonal 3, the diagonal first when the error term is 0 | `from`, `to` | `steps`: each [x, y, cost so far, direction 0–7] |
| `hitPoints` | S | the hit-dice roll ([procedures.md §2](../B-model/procedures.md#2-hit-points)) for `classes` of a character with `levels` | `tables`, `levels`, `classes` | `sum` |
| `casterLevel` | S | [procedures.md §4](../B-model/procedures.md#4-caster-level) for a spell of class code `spellClass`, cast from an item with `fromItem` | `record`, `spellClass`, `fromItem` | `level` |
| `join` | S | [procedures.md §8](../B-model/procedures.md#8-joining-the-party) | `party` (records in list order), `candidate` | `joins`; else `refusal`: `silent`, `full`, `noEvilScum`, `tooManyRangers`, or `toleratesNoEvil` with `paladin` (the index of the paladin who speaks) |
| `strength.encoding` | S | the strength encoding of [procedures.md §12.3](../B-model/procedures.md#123-the-strength-spells) | `values`: [STR, %] | `encoded` (the byte), `decoded` |
| `money.appraise` | S | Appraise ([town.md, "Appraise"](../A-games/engine/town.md#appraise-o-fun_4c2d_19b2)) of one gem (5) or jewel (6) each | `kinds` | `values` in gp |
| `derive` | E | the derived statistics: THAC0, hit dice, attacks, spell slots ([§1](../B-model/procedures.md#1-spell-slots)), saving throws ([§6](../B-model/procedures.md#6-saving-throws)), thief skills ([§5](../B-model/procedures.md#5-thief-skills)) | `record` | `thac0Base`, `hitDice`, `attacksBase`, `saves`, `clericSlots`, `druidSlots` (CotAB), `muSlots`, `thief`, `known` (the spell ids known) |
| `creation` | E | creation steps 2–7 ([chargen-and-progression.md, "Sequence"](../A-games/engine/chargen-and-progression.md#sequence-o)): race, gender, class and alignment taken, then the abilities, money ([procedures.md §3](../B-model/procedures.md#3-starting-money)) and hit points rolled once | `race`, `gender`, `cls`, `alignment` | `id`, `age`, `stat`, `strPct`, `levels`, `hp`, `maxHp`, `hpRolled`, `money`, `itemMask`, then `derive`'s members |
| `training` | E | the derived statistics of `record`, then training ([procedures.md §2](../B-model/procedures.md#2-hit-points)) in `classes`, without the fee | `record`, `classes` | as `creation` |
| `money.coinValue` | E | the coins' value in gp, rounded to nearest ([town.md, "Money"](../A-games/engine/town.md#money-o-overlay-4c2d-fun_4894_28be)) | `money`: a list of seven-word purses | `gp` |
| `money.share` | E | Share ([town.md, "Money"](../A-games/engine/town.md#money-o-overlay-4c2d-fun_4894_28be)) with no items carried | `party`, `pool` | `money` (each member's seven words), `pool` |
| `battlefield.terrain` | S | PoR's overland tile → terrain flags ([battlefield.md, "Terrain flags"](../A-games/engine/battlefield.md#terrain-flags-o-fun_34c7_08a4)), tiles 0–255 | `read4AB3` (ECL 0x4AB3) | `flags`: 256 bytes as hex |
| `battlefield.wild` | S | the wilderness generator ([procedures.md §15.4](../B-model/procedures.md#154-battlefields)) from the terrain flags | `flags` | `rows` |
| `battlefield.map` | S | the map-area generator, PoR (no furnishing) | `map`, `x`, `y` (the party's square), `area` | `rows` |
| `battlefield.furnished` | E | the map-area generator with CotAB's furnishing (its offsets `T.furnishDx/Dy`) | as `battlefield.map` | `rows` |
| `combat.spell` | E | spells going off on a made-up battlefield (below), each at caster level `level` with the aimed square `aim`, in order | `fighters`, `walls`, `spells` [`caster`, `id`, `level`, `aim`] | below |
| `combat.attack` | E | the attack loop ([combat-rules.md, "Attack loop"](../A-games/engine/combat-rules.md#attack-loop-o-fun_3aae_1406attacker-target-from_behind)) of fighter p on q, not from behind, no missile, in order | `fighters`, `attacks` [p, q] | `made` (attacks made with hand 1), then below |
| `combat.save` | E | the saving throw ([combat-rules.md, "Saving throws"](../A-games/engine/combat-rules.md#saving-throws-o-fun_5216_0d63char-type-bonus)) of fighter f, kind 0–4, bonus | `fighters`, `saves` [f, kind, bonus] | `saved` |
| `treasure.random` | F | TREASURE 0x80 + `items` ([procedures.md §14](../B-model/procedures.md#14-random-treasure)): the items in the treasure list's order | `items` | the 63-byte records, concatenated |
| `battlefield.area` | F | the map-area generator on the game's own map: GEO file `geo`, record `record` | `geo`, `record`, `x`, `y`, `area` | the 1250 cells, row-major |
| `headless.run` | F | the headless run of `script` ([host-contracts.md §8](../B-model/host-contracts.md#8-the-headless-harness)) with the game folder's saves | `script` | the transcript: one JSON event per line, each line ending in a line feed |
| `sound.driver` | F | the sound driver ([sound.md §3](../A-games/engine/sound.md#3-timer-engine)) playing `effect` on `device` (`pc`, `tandy`), cut off at tick `cut` if given | `effect`, `device`, `cut` | per timer tick until the effect ends (or the cut, or 2400 ticks): PC speaker, the values written to port 0x42 then port 0x61's value; Tandy, the bytes written to the SN76489 |
| `decode.image`, `decode.dax`, `tables.bytes` | F | the decoders (V1): listed in [expected-values.md §7](expected-values.md#7-decoded-files-and-tables-v1) | | |

**The made-up battlefield** (`combat.*`). The game's engine with its executable and no save loaded
(every ECL variable 0); a 25 × 50 battlefield of cell 1, with cell 2 at each `walls` square `[x, y]`; a
cell table where cell 2 cannot be entered (move 0xFF) and blocks sight (2) and every other cell is open
ground (move 1, sight 0). The fighters in list order, each a record named `A`, `B`, `C` … with `inPlay`
1, `side`, `hp` and `maxHp` (default 200), `saves` (default 20 each), `ac` (default 50), `thac0`
(default 40), `attacksLeft` [`attacks` (default 2), 0], hand 1's `dice` [count, sides, bonus] (default
1d6 + 0); a zeroed combat record; at square `x`, `y`, size 1; monsters are those of side 1. The
output: `damage`, every call of the non-weapon damage routine (`FUN_5216_1344`) as [fighter index,
the damage passed, saved]; `hp`, each fighter's hit points after; `cells`, every square whose cell
changed as [x, y, cell]; `effects`, each fighter's effect records as [type, duration, power, flag].
Spell ids: Lightning Bolt 51, Stinking Cloud 34 (both games), Cloudkill 91 (CotAB).

## 5. The vectors

Generated from the manifest (the decoder and table vectors are in
[expected-values.md §7](expected-values.md#7-decoded-files-and-tables-v1)). An input or output too long
for the table is given by its length; the manifest has it in full.

<!-- generated:vectors -->
#### `tape.replay` (S)

Defined by [host-contracts.md](../B-model/host-contracts.md#64-the-tape-format).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-tape-por-1` | `{"draws":[[1,20,14],[2,6,7],[0,6,0],[1,100,63]],"requests":[[1,20],[2,6],[0,6],[1,100]]}` | – | `{"refused":false,"results":[14,7,0,63],"divergence":null}` |
| `S-tape-por-2` | `{"draws":[[1,20,14],[2,6,7]],"requests":[[1,20],[1,6]]}` | – | `{"refused":false,"results":[14],"divergence":1}` |
| `S-tape-por-3` | `{"draws":[[1,20,14]],"requests":[[1,20],[1,4]]}` | – | `{"refused":false,"results":[14],"divergence":1}` |
| `S-tape-por-4` | `{"draws":[[2,6,13]],"requests":[]}` | – | `{"refused":true}` |
| `S-tape-por-5` | `{"draws":[[0,6,1]],"requests":[]}` | – | `{"refused":true}` |
| `S-tape-por-6` | `{"draws":[[1,0,0],[3,1,3]],"requests":[[1,0],[3,1]]}` | – | `{"refused":false,"results":[0,3],"divergence":null}` |
| `S-tape-por-7` | `{"draws":[[1,1,0]],"requests":[]}` | – | `{"refused":true}` |

#### `dice.random` (S)

Defined by [host-contracts.md](../B-model/host-contracts.md#61-the-rule-d2).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-random-por-1` | `{"n":[1,2,6,100,256,0,32767]}` | 7 draws | `{"values":[0,0,5,33,246,0,19890]}` |

#### `line.walk` (S)

Defined by [battlefield.md](../A-games/engine/battlefield.md#line-of-sight-and-range-o-fun_56c1_0422).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-line-por-1` | `{"from":[0,0],"to":[4,2]}` | – | `{"steps":[[1,1,3,3],[2,1,5,2],[3,2,8,3],[4,2,10,2]]}` |
| `S-line-por-2` | `{"from":[4,2],"to":[0,0]}` | – | `{"steps":[[3,1,3,7],[2,1,5,6],[1,0,8,7],[0,0,10,6]]}` |
| `S-line-por-3` | `{"from":[5,5],"to":[5,0]}` | – | `{"steps":[[5,4,2,0],[5,3,4,0],[5,2,6,0],[5,1,8,0],[5,0,10,0]]}` |
| `S-line-por-4` | `{"from":[5,5],"to":[9,5]}` | – | `{"steps":[[6,5,2,2],[7,5,4,2],[8,5,6,2],[9,5,8,2]]}` |
| `S-line-por-5` | `{"from":[2,5],"to":[12,9]}` | – | `{"steps":[[3,5,2,2],[4,6,5,3],[5,6,7,2],[6,7,10,3],[7,7,12,2],[8,7,14,2],[9,8,17,3],[10,8,19,2],[11,9,22,3],[12,9,24,2]]}` |
| `S-line-por-6` | `{"from":[10,10],"to":[3,13]}` | – | `{"steps":[[9,10,2,6],[8,11,5,5],[7,11,7,6],[6,12,10,5],[5,12,12,6],[4,13,15,5],[3,13,17,6]]}` |
| `S-line-por-7` | `{"from":[0,0],"to":[6,6]}` | – | `{"steps":[[1,1,3,3],[2,2,6,3],[3,3,9,3],[4,4,12,3],[5,5,15,3],[6,6,18,3]]}` |
| `S-line-por-8` | `{"from":[7,3],"to":[7,3]}` | – | `{"steps":[]}` |

#### `hitPoints` (S)

Defined by [procedures.md](../B-model/procedures.md#2-hit-points).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-hp-por-1` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]]],"levels":[0,0,1,0,0,0,0,0],"classes":[2]}` | 1 draws | `{"sum":10}` |
| `S-hp-por-2` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]]],"levels":[0,0,1,0,0,0,0,0],"classes":[2]}` | 1 draws | `{"sum":6}` |
| `S-hp-por-3` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]]],"levels":[0,0,5,0,0,0,0,0],"classes":[2]}` | 1 draws | `{"sum":4}` |
| `S-hp-por-4` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]]],"levels":[1,0,1,0,0,1,0,0],"classes":[0,2,5]}` | 3 draws | `{"sum":20}` |
| `S-hp-por-5` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]]],"levels":[0,0,0,0,1,0,0,0],"classes":[4]}` | 1 draws | `{"sum":10}` |
| `S-hp-coab-1` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]],["hitDiceStop",0,[10,15,10,10,11,12,11,19]]],"levels":[0,0,1,0,0,0,0,0],"classes":[2]}` | 2 draws | `{"sum":10}` |
| `S-hp-coab-2` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]],["hitDiceStop",0,[10,15,10,10,11,12,11,19]]],"levels":[0,0,5,0,0,0,0,0],"classes":[2]}` | 2 draws | `{"sum":5}` |
| `S-hp-coab-3` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]],["hitDiceStop",0,[10,15,10,10,11,12,11,19]]],"levels":[0,0,0,0,3,0,0,0],"classes":[4]}` | 2 draws | `{"sum":3}` |
| `S-hp-coab-4` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]],["hitDiceStop",0,[10,15,10,10,11,12,11,19]]],"levels":[0,0,10,0,0,0,0,0],"classes":[2]}` | 0 draws | `{"sum":3}` |
| `S-hp-coab-5` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]],["hitDiceStop",0,[10,15,10,10,11,12,11,19]]],"levels":[10,0,9,0,0,0,0,0],"classes":[0,2]}` | 2 draws | `{"sum":9}` |
| `S-hp-coab-6` | `{"tables":[["hitDiceCount",0,[1,1,1,1,2,1,1,2]],["hitDiceSides",0,[8,8,10,10,8,4,6,4]],["hitDiceStop",0,[10,15,10,10,11,12,11,19]]],"levels":[5,0,10,0,0,0,0,0],"classes":[0,2]}` | 2 draws | `{"sum":3}` |

#### `casterLevel` (S)

Defined by [procedures.md](../B-model/procedures.md#4-caster-level).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-caster-por-1` | `{"record":{"levels":[5,0,0,0,0,0,0,0]},"spellClass":0}` | – | `{"level":5}` |
| `S-caster-por-2` | `{"record":{"levels":[0,0,0,0,0,3,4,0]},"spellClass":1}` | – | `{"level":3}` |
| `S-caster-por-3` | `{"record":{"levels":[0,0,7,0,0,0,0,0]},"spellClass":0}` | – | `{"level":0}` |
| `S-caster-por-4` | `{"record":{"levels":[0,0,0,0,0,3,0,0]},"spellClass":2}` | – | `{"level":12}` |
| `S-caster-por-5` | `{"record":{"levels":[0,0,0,0,0,8,0,0]},"spellClass":1,"fromItem":true}` | – | `{"level":6}` |
| `S-caster-por-6` | `{"record":{"levels":[4,0,0,0,0,0,0,0]},"spellClass":2,"fromItem":true}` | – | `{"level":12}` |
| `S-caster-coab-1` | `{"record":{"levels":[5,0,0,0,0,0,0,0]},"spellClass":0}` | – | `{"level":5}` |
| `S-caster-coab-2` | `{"record":{"levels":[0,0,0,10,0,0,0,0]},"spellClass":0}` | – | `{"level":2}` |
| `S-caster-coab-3` | `{"record":{"levels":[0,0,0,8,0,0,0,0]},"spellClass":0}` | – | `{"level":6}` |
| `S-caster-coab-4` | `{"record":{"levels":[0,0,0,0,9,0,0,0]},"spellClass":1}` | – | `{"level":2}` |
| `S-caster-coab-5` | `{"record":{"levels":[0,0,0,0,9,0,0,0]},"spellClass":2}` | – | `{"level":1}` |
| `S-caster-coab-6` | `{"record":{"levels":[0,0,9,0,0,0,0,0]},"spellClass":2}` | – | `{"level":6}` |
| `S-caster-coab-7` | `{"record":{"levels":[3,0,0,0,0,7,0,0]},"spellClass":2,"fromItem":true}` | – | `{"level":6}` |
| `S-caster-coab-8` | `{"record":{"race":7,"levels":[0,0,6,0,0,0,0,0],"prevLevels":[5,0,0,0,0,0,0,0],"hpLevel":5},"spellClass":0}` | – | `{"level":6}` |
| `S-caster-coab-9` | `{"record":{"race":7,"levels":[2,0,0,0,0,0,0,0],"prevLevels":[0,0,0,0,0,6,0,0],"hpLevel":1},"spellClass":2}` | – | `{"level":6}` |
| `S-caster-coab-10` | `{"record":{"race":7,"levels":[2,0,0,0,0,0,0,0],"prevLevels":[0,0,0,0,0,6,0,0],"hpLevel":2},"spellClass":2}` | – | `{"level":0}` |

#### `join` (S)

Defined by [procedures.md](../B-model/procedures.md#8-joining-the-party).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-join-por-1` | `{"party":[],"candidate":{"name":"A","id":65,"morale":0,"alignment":4,"levels":[0,0,1,0,0,0,0,0]}}` | – | `{"joins":true}` |
| `S-join-por-2` | (534 characters) | – | `{"joins":false,"refusal":"full"}` |
| `S-join-por-3` | (536 characters) | – | `{"joins":true}` |
| `S-join-por-4` | (686 characters) | – | `{"joins":false,"refusal":"full"}` |
| `S-join-por-5` | (242 characters) | – | `{"joins":false,"refusal":"silent"}` |
| `S-join-por-6` | (241 characters) | – | `{"joins":true}` |
| `S-join-por-7` | `{"party":[{"name":"A","id":65,"morale":0,"alignment":2,"levels":[0,0,1,0,0,0,0,0]}],"candidate":{"name":"B","id":66,"morale":0,"alignment":4,"levels":[0,0,0,1,0,0,0,0]}}` | – | `{"joins":true}` |
| `S-join-coab-1` | `{"party":[{"name":"A","id":65,"morale":0,"alignment":2,"levels":[0,0,1,0,0,0,0,0]}],"candidate":{"name":"B","id":66,"morale":0,"alignment":0,"levels":[0,0,0,1,0,0,0,0]}}` | – | `{"joins":false,"refusal":"noEvilScum"}` |
| `S-join-coab-2` | (315 characters) | – | `{"joins":false,"refusal":"tooManyRangers"}` |
| `S-join-coab-3` | (242 characters) | – | `{"joins":true}` |
| `S-join-coab-4` | (315 characters) | – | `{"joins":false,"refusal":"toleratesNoEvil","paladin":2}` |
| `S-join-coab-5` | `{"party":[{"name":"A","id":65,"morale":0,"alignment":4,"levels":[0,0,0,2,0,0,0,0]}],"candidate":{"name":"D","id":68,"morale":0,"alignment":7,"levels":[0,0,1,0,0,0,0,0]}}` | – | `{"joins":true}` |
| `S-join-coab-6` | (534 characters) | – | `{"joins":false,"refusal":"full"}` |
| `S-join-coab-7` | (388 characters) | – | `{"joins":false,"refusal":"noEvilScum"}` |

#### `strength.encoding` (S)

Defined by [procedures.md](../B-model/procedures.md#123-the-strength-spells).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-str-por-1` | `{"values":[[3,0],[17,0],[18,0],[18,1],[18,50],[18,100],[19,0],[25,0]]}` | – | `{"encoded":[103,117,1,2,51,101,119,125],"decoded":[[3,0],[17,0],[18,0],[18,1],[18,50],[18,100],[19,0],[25,0]]}` |

#### `money.appraise` (S)

Defined by [town.md](../A-games/engine/town.md#appraise-o-fun_4c2d_19b2).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-appraise-por-1` | `{"kinds":[5,5,5,5,6,6,6,6]}` | 12 draws | `{"values":[50,10,10,500,5154,6293,2124,2649]}` |
| `S-appraise-por-2` | `{"kinds":[6,6,6,6,6,6,5,5]}` | 14 draws | `{"values":[1491,655,240,633,1134,3681,50,50]}` |

#### `battlefield.terrain` (S)

Defined by [battlefield.md](../A-games/engine/battlefield.md#terrain-flags-o-fun_34c7_08a4).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-terrain-por-1` | `{"read4AB3":0}` | – | (524 characters) |
| `S-terrain-por-2` | `{"read4AB3":255}` | – | (524 characters) |

#### `battlefield.wild` (S)

Defined by [procedures.md](../B-model/procedures.md#154-battlefields).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-wild-por-1` | `{"flags":0}` | 3694 draws | (2585 characters) |
| `S-wild-por-2` | `{"flags":16}` | 3580 draws | (2585 characters) |
| `S-wild-por-3` | `{"flags":72}` | 3603 draws | (2585 characters) |
| `S-wild-por-4` | `{"flags":128}` | 3734 draws | (2585 characters) |
| `S-wild-coab-1` | `{"flags":0}` | 2705 draws | (2585 characters) |
| `S-wild-coab-2` | `{"flags":16}` | 2658 draws | (2585 characters) |
| `S-wild-coab-3` | `{"flags":72}` | 2734 draws | (2585 characters) |
| `S-wild-coab-4` | `{"flags":128}` | 1803 draws | (2585 characters) |

#### `battlefield.map` (S)

Defined by [procedures.md](../B-model/procedures.md#154-battlefields).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `S-mapfield-por-1` | (387 characters) | 1080 draws | (2585 characters) |
| `S-mapfield-por-2` | (388 characters) | 1098 draws | (2585 characters) |
| `S-mapfield-por-3` | `{"map":{"walls":[],"doors":[],"events":[]},"x":0,"y":0,"area":3}` | 576 draws | (2585 characters) |

#### `battlefield.furnished` (E)

Defined by [procedures.md](../B-model/procedures.md#154-battlefields).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-mapfield-coab-1` | (402 characters) | 15 draws | (2585 characters) |
| `E-mapfield-coab-2` | (402 characters) | 18 draws | (2585 characters) |
| `E-mapfield-coab-3` | `{"map":{"walls":[],"doors":[],"events":[]},"x":15,"y":15,"area":0}` | 0 draws | (2585 characters) |

#### `derive` (E)

Defined by [procedures.md](../B-model/procedures.md#1-spell-slots).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-derive-por-1` | `{"record":{"race":7,"cls":0,"levels":[5,0,0,0,0,0,0,0],"stat":[12,10,17,10,10,10]}}` | – | (208 characters) |
| `E-derive-por-2` | `{"record":{"race":7,"cls":0,"levels":[1,0,0,0,0,0,0,0],"stat":[12,10,18,10,10,10]}}` | – | `{"thac0Base":40,"hitDice":1,"attacksBase":2,"saves":[10,13,14,16,15],"clericSlots":[0,0,0],"muSlots":[0,0,0],"thief":[0,0,0,0,0,0,0,0],"known":[]}` |
| `E-derive-por-3` | `{"record":{"race":7,"cls":5,"levels":[0,0,0,0,0,6,0,0],"stat":[10,17,10,10,10,10]}}` | – | `{"thac0Base":41,"hitDice":6,"attacksBase":2,"saves":[13,11,9,13,10],"clericSlots":[0,0,0],"muSlots":[4,2,2],"thief":[0,0,0,0,0,0,0,0],"known":[]}` |
| `E-derive-por-4` | `{"record":{"race":5,"cls":6,"levels":[0,0,0,0,0,0,4,0],"stat":[10,10,10,17,10,10]}}` | – | (154 characters) |
| `E-derive-por-5` | `{"record":{"race":1,"cls":6,"levels":[0,0,0,0,0,0,1,0],"stat":[10,10,10,9,10,10]}}` | – | (153 characters) |
| `E-derive-por-6` | `{"record":{"race":7,"cls":2,"levels":[0,0,7,0,0,0,0,0],"stat":[17,10,10,10,10,10]}}` | – | `{"thac0Base":46,"hitDice":7,"attacksBase":3,"saves":[10,11,12,12,13],"clericSlots":[0,0,0],"muSlots":[0,0,0],"thief":[0,0,0,0,0,0,0,0],"known":[]}` |
| `E-derive-por-7` | `{"record":{"race":4,"cls":9,"levels":[3,0,3,0,0,3,0,0],"stat":[15,15,15,10,10,10]}}` | – | (182 characters) |
| `E-derive-por-8` | `{"record":{"race":2,"cls":15,"levels":[0,0,2,0,0,3,4,0],"stat":[15,15,10,16,10,10]}}` | – | (154 characters) |
| `E-derive-coab-1` | `{"record":{"race":7,"cls":0,"levels":[10,0,0,0,0,0,0,0],"stat":[12,10,18,10,10,10]}}` | – | (274 characters) |
| `E-derive-coab-2` | `{"record":{"race":7,"cls":3,"levels":[0,0,0,10,0,0,0,0],"stat":[17,10,14,10,15,17]}}` | – | (190 characters) |
| `E-derive-coab-3` | `{"record":{"race":7,"cls":4,"levels":[0,0,0,0,9,0,0,0],"stat":[16,14,14,10,15,10]}}` | – | (187 characters) |
| `E-derive-coab-4` | `{"record":{"race":1,"cls":2,"levels":[0,0,5,0,0,0,0,0],"stat":[17,10,10,10,17,10]}}` | – | (179 characters) |
| `E-derive-coab-5` | `{"record":{"race":5,"cls":6,"levels":[0,0,0,0,0,0,6,0],"stat":[10,10,10,17,10,10]}}` | – | (187 characters) |
| `E-derive-coab-6` | `{"record":{"race":7,"cls":5,"levels":[0,0,0,0,0,11,0,0],"stat":[10,18,10,10,19,10]}}` | – | (177 characters) |
| `E-derive-coab-7` | `{"record":{"race":7,"cls":2,"levels":[0,0,6,0,0,0,0,0],"prevLevels":[0,0,0,0,0,0,5,0],"hpLevel":5,"stat":[15,10,10,16,10,10]}}` | – | (187 characters) |
| `E-derive-coab-8` | `{"record":{"race":4,"cls":10,"levels":[6,0,0,0,6,0,0,0],"stat":[14,13,14,10,14,10]}}` | – | (250 characters) |

#### `creation` (E)

Defined by [chargen-and-progression.md](../A-games/engine/chargen-and-progression.md#sequence-o).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-creation-por-1` | `{"race":7,"gender":0,"cls":2,"alignment":0}` | 40 draws | (298 characters) |
| `E-creation-por-2` | `{"race":7,"gender":1,"cls":0,"alignment":4}` | 40 draws | (313 characters) |
| `E-creation-por-3` | `{"race":2,"gender":1,"cls":15,"alignment":7}` | 43 draws | (317 characters) |
| `E-creation-por-4` | `{"race":1,"gender":0,"cls":14,"alignment":3}` | 41 draws | (305 characters) |
| `E-creation-por-5` | `{"race":4,"gender":0,"cls":9,"alignment":0}` | 43 draws | (324 characters) |
| `E-creation-por-6` | `{"race":5,"gender":1,"cls":6,"alignment":8}` | 40 draws | (304 characters) |
| `E-creation-coab-1` | `{"race":7,"gender":0,"cls":3,"alignment":0}` | 41 draws | (333 characters) |
| `E-creation-coab-2` | `{"race":4,"gender":1,"cls":4,"alignment":3}` | 41 draws | (331 characters) |
| `E-creation-coab-3` | `{"race":7,"gender":1,"cls":0,"alignment":4}` | 41 draws | (346 characters) |
| `E-creation-coab-4` | `{"race":2,"gender":0,"cls":13,"alignment":5}` | 43 draws | (342 characters) |
| `E-creation-coab-5` | `{"race":1,"gender":0,"cls":2,"alignment":1}` | 41 draws | (330 characters) |

#### `training` (E)

Defined by [procedures.md](../B-model/procedures.md#2-hit-points).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-training-por-1` | `{"record":{"race":7,"cls":2,"levels":[0,0,1,0,0,0,0,0],"stat":[16,10,10,10,16,10],"hp":20,"maxHp":30,"hpRolled":28},"classes":[2]}` | 1 draws | (296 characters) |
| `E-training-por-2` | `{"record":{"race":7,"cls":2,"levels":[0,0,4,0,0,0,0,0],"stat":[16,10,10,10,16,10],"hp":20,"maxHp":30,"hpRolled":28},"classes":[2]}` | 1 draws | (296 characters) |
| `E-training-por-3` | `{"record":{"race":4,"cls":8,"levels":[2,0,2,0,0,0,0,0],"stat":[14,10,14,10,17,10],"hp":12,"maxHp":12,"hpRolled":11},"classes":[0,2]}` | 2 draws | (332 characters) |
| `E-training-por-4` | `{"record":{"race":7,"cls":5,"levels":[0,0,0,0,0,1,0,0],"stat":[10,17,10,10,6,10],"hp":3,"maxHp":4,"hpRolled":4},"classes":[5]}` | 1 draws | (292 characters) |
| `E-training-coab-1` | `{"record":{"race":7,"cls":2,"levels":[0,0,1,0,0,0,0,0],"stat":[16,10,10,10,16,10],"hp":20,"maxHp":30,"hpRolled":28},"classes":[2]}` | 2 draws | (329 characters) |
| `E-training-coab-2` | `{"record":{"race":7,"cls":2,"levels":[0,0,9,0,0,0,0,0],"stat":[16,10,10,10,16,10],"hp":20,"maxHp":30,"hpRolled":28},"classes":[2]}` | 0 draws | (328 characters) |
| `E-training-coab-3` | `{"record":{"race":7,"cls":4,"levels":[0,0,0,0,7,0,0,0],"stat":[16,14,14,10,15,10],"hp":40,"maxHp":50,"hpRolled":48},"classes":[4]}` | 2 draws | (341 characters) |
| `E-training-coab-4` | `{"record":{"race":7,"cls":3,"levels":[0,0,0,8,0,0,0,0],"stat":[17,10,14,10,15,17],"hp":50,"maxHp":50,"hpRolled":45},"classes":[3]}` | 2 draws | (340 characters) |

#### `dualclass` (E)

Defined by [procedures.md](../B-model/procedures.md#72-dual-classing).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-dualclass-coab-1` | `{"record":{"race":7,"cls":2,"levels":[0,0,7,0,0,0,0,0],"stat":[16,10,17,12,14,10],"baseStat":[16,10,17,12,14,10],"alignment":0,"xp":70000,"hp":50,"maxHp":50,"hpRolled":44},"to":0}` | – | (422 characters) |
| `E-dualclass-coab-2` | `{"record":{"race":7,"cls":5,"levels":[0,0,0,0,0,6,0,0],"stat":[17,15,10,14,12,10],"baseStat":[17,15,10,14,12,10],"alignment":4,"xp":70000,"hp":50,"maxHp":50,"hpRolled":44},"to":2}` | – | (407 characters) |
| `E-dualclass-coab-3` | `{"record":{"race":7,"cls":2,"levels":[0,0,5,0,0,0,0,0],"stat":[14,10,17,12,14,10],"baseStat":[14,10,17,12,14,10],"alignment":0,"xp":70000,"hp":50,"maxHp":50,"hpRolled":44},"to":0}` | – | (404 characters) |
| `E-dualclass-coab-4` | `{"record":{"race":7,"cls":0,"levels":[4,0,0,0,0,0,0,0],"stat":[17,10,16,17,12,10],"baseStat":[17,10,16,17,12,10],"alignment":4,"xp":70000,"hp":50,"maxHp":50,"hpRolled":44},"to":6}` | – | (446 characters) |

#### `money.coinValue` (E)

Defined by [town.md](../A-games/engine/town.md#money-o-overlay-4c2d-fun_4894_28be).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-coins-por-1` | `{"money":[[1,0,0,0,0,0,0],[0,1,0,0,0,0,0],[0,0,1,0,0,0,0],[0,0,0,1,0,0,0],[0,0,0,0,1,0,0],[99,0,0,0,0,0,0],[100,0,0,0,0,0,0],[123,45,67,89,10,5,5],[65535,65535,65535,65535,65535,0,0]]}` | – | `{"gp":[0,0,1,1,5,0,1,175,429582]}` |
| `E-coins-coab-1` | `{"money":[[1,0,0,0,0,0,0],[0,1,0,0,0,0,0],[0,0,1,0,0,0,0],[0,0,0,1,0,0,0],[0,0,0,0,1,0,0],[99,0,0,0,0,0,0],[100,0,0,0,0,0,0],[123,45,67,89,10,5,5],[65535,65535,65535,65535,65535,0,0]]}` | – | `{"gp":[0,0,1,1,5,0,1,175,429582]}` |

#### `money.share` (E)

Defined by [town.md](../A-games/engine/town.md#money-o-overlay-4c2d-fun_4894_28be).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-share-por-1` | (429 characters) | – | `{"money":[[25,2,0,19,2,1,1],[25,2,0,8,1,1,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[25,2,0,8,1,0,0]],"pool":[0,0,0,0,0,0,0]}` |
| `E-share-por-2` | (442 characters) | – | `{"money":[[1250,1632,728,635,250,4,1],[0,0,271,625,250,3,1],[1202,398,0,0,0,0,0],[1298,0,0,0,0,0,0],[0,220,501,625,250,3,1]],"pool":[0,0,0,0,0,0,0]}` |
| `E-share-coab-1` | (429 characters) | – | `{"money":[[25,2,0,19,2,1,1],[25,2,0,8,1,1,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[25,2,0,8,1,0,0]],"pool":[0,0,0,0,0,0,0]}` |

#### `combat.spell` (E)

Defined by [procedures.md](../B-model/procedures.md#15-combat-procedures).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-spell-por-1` | `{"fighters":[{"x":2,"y":5,"side":0},{"x":5,"y":5,"side":1,"saves":[30,30,30,30,30]}],"walls":[[9,5]],"spells":[{"caster":0,"id":51,"level":5,"aim":[5,5]}]}` | 3 draws | `{"damage":[[1,22,false],[1,22,false]],"hp":[200,156],"cells":[],"effects":[[],[]]}` |
| `E-spell-por-2` | (206 characters) | 3 draws | `{"damage":[[1,21,false],[2,21,true]],"hp":[200,179,190,200],"cells":[],"effects":[[],[],[],[]]}` |
| `E-spell-por-3` | `{"fighters":[{"x":2,"y":2,"side":0},{"x":6,"y":6,"side":1,"saves":[30,30,30,30,30]},{"x":9,"y":9,"side":1}],"spells":[{"caster":0,"id":51,"level":7,"aim":[6,6]}]}` | 3 draws | `{"damage":[[1,24,false],[2,24,false]],"hp":[200,176,176],"cells":[],"effects":[[],[],[]]}` |
| `E-spell-por-4` | `{"fighters":[{"x":2,"y":5,"side":0},{"x":6,"y":6,"side":1,"saves":[30,30,30,30,30]},{"x":5,"y":6,"side":1,"saves":[1,1,1,1,1]}],"walls":[[5,5]],"spells":[{"caster":0,"id":34,"level":4,"aim":[5,5]}]}` | 3 draws | `{"damage":[],"hp":[200,200,200],"cells":[[6,5,30],[5,6,30],[6,6,30]],"effects":[[[40,4,4,1]],[[31,5,255,0]],[[30,1,255,0]]]}` |
| `E-spell-por-5` | (276 characters) | 2 draws | (272 characters) |
| `E-spell-coab-1` | `{"fighters":[{"x":2,"y":5,"side":0},{"x":5,"y":5,"side":1,"saves":[30,30,30,30,30]}],"walls":[[9,5]],"spells":[{"caster":0,"id":51,"level":5,"aim":[5,5]}]}` | 2 draws | `{"damage":[[1,19,false]],"hp":[200,181],"cells":[],"effects":[[],[]]}` |
| `E-spell-coab-2` | (206 characters) | 4 draws | `{"damage":[[1,23,false],[2,23,true],[3,23,false]],"hp":[200,177,189,177],"cells":[],"effects":[[],[],[],[]]}` |
| `E-spell-coab-3` | `{"fighters":[{"x":2,"y":5,"side":0},{"x":6,"y":6,"side":1,"saves":[30,30,30,30,30]},{"x":5,"y":6,"side":1,"saves":[1,1,1,1,1]}],"walls":[[5,5]],"spells":[{"caster":0,"id":34,"level":4,"aim":[5,5]}]}` | 3 draws | `{"damage":[],"hp":[200,200,200],"cells":[[6,5,30],[5,6,30],[6,6,30]],"effects":[[[40,4,4,1]],[[31,3,255,0]],[[30,1,255,0]]]}` |
| `E-spell-coab-4` | (208 characters) | 0 draws | (186 characters) |
| `E-spell-coab-5` | `{"fighters":[{"x":2,"y":5,"side":0},{"x":11,"y":10,"side":1,"saves":[30,30,30,30,30]}],"spells":[{"caster":0,"id":34,"level":4,"aim":[10,10]},{"caster":0,"id":91,"level":9,"aim":[10,10]}]}` | 2 draws | (193 characters) |

#### `combat.attack` (E)

Defined by [combat-rules.md](../A-games/engine/combat-rules.md#attack-loop-o-fun_3aae_1406attacker-target-from_behind).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-attack-por-1` | `{"fighters":[{"x":4,"y":4,"side":0,"thac0":45,"attacks":2,"dice":[1,8,2]},{"x":5,"y":4,"side":1,"ac":55,"hp":30}],"attacks":[[0,1]]}` | 4 draws | `{"made":[2],"damage":[],"hp":[200,18],"cells":[],"effects":[[],[]]}` |
| `E-attack-por-2` | `{"fighters":[{"x":4,"y":4,"side":0,"thac0":45,"attacks":2,"dice":[1,8,2]},{"x":5,"y":4,"side":1,"ac":55,"hp":30}],"attacks":[[0,1],[1,0],[0,1]]}` | 6 draws | `{"made":[2,2,0],"damage":[],"hp":[193,30],"cells":[],"effects":[[],[]]}` |
| `E-attack-coab-1` | `{"fighters":[{"x":4,"y":4,"side":0,"thac0":45,"attacks":2,"dice":[1,8,2]},{"x":5,"y":4,"side":1,"ac":55,"hp":30}],"attacks":[[0,1]]}` | 4 draws | `{"made":[2],"damage":[],"hp":[200,17],"cells":[],"effects":[[],[]]}` |
| `E-attack-coab-2` | `{"fighters":[{"x":4,"y":4,"side":0,"thac0":45,"attacks":2,"dice":[1,8,2]},{"x":5,"y":4,"side":1,"ac":55,"hp":30}],"attacks":[[0,1],[1,0],[0,1]]}` | 7 draws | `{"made":[2,2,0],"damage":[],"hp":[191,20],"cells":[],"effects":[[],[]]}` |

#### `combat.save` (E)

Defined by [combat-rules.md](../A-games/engine/combat-rules.md#saving-throws-o-fun_5216_0d63char-type-bonus).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `E-save-por-1` | `{"fighters":[{"x":1,"y":1,"side":0,"saves":[10,13,14,16,15]},{"x":3,"y":1,"side":1,"saves":[14,15,16,17,17]}],"saves":[[0,0,0],[0,4,0],[1,3,2],[1,4,-3],[0,1,0],[1,2,5],[0,3,0],[1,0,0]]}` | 8 draws | `{"saved":[true,false,false,false,true,true,false,true]}` |
| `E-save-coab-1` | `{"fighters":[{"x":1,"y":1,"side":0,"saves":[10,13,14,16,15]},{"x":3,"y":1,"side":1,"saves":[14,15,16,17,17]}],"saves":[[0,0,0],[0,4,0],[1,3,2],[1,4,-3],[0,1,0],[1,2,5],[0,3,0],[1,0,0]]}` | 8 draws | `{"saved":[true,false,false,false,false,true,false,false]}` |

#### `treasure.random` (F)

Defined by [procedures.md](../B-model/procedures.md#14-random-treasure).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `F-treasure-por-1` | `{"items":1}` | 4 draws | 63 bytes, SHA-256 `2495df8ca007473b691c4ab61fae7c06fcabb683ce31fc305f7c8fd1d1a50d65` |
| `F-treasure-por-2` | `{"items":3}` | 17 draws | 189 bytes, SHA-256 `d00db8360381a4a7e4b7a3ae753f3b595853c7a496000317a0234b6b691caf2b` |
| `F-treasure-por-3` | `{"items":6}` | 23 draws | 378 bytes, SHA-256 `c3ae502830416ebf12d5f326535792b9c54a902661db9b92a438977bef6c09f3` |
| `F-treasure-por-4` | `{"items":10}` | 42 draws | 630 bytes, SHA-256 `643291eb82178a0bbfe189fbc368a2654744ec3f1ae528c054719a92a8b86613` |
| `F-treasure-coab-1` | `{"items":1}` | 3 draws | 63 bytes, SHA-256 `ee54596a5e63c93cd7e7e791889381e031ba2c2437bf33123a3cd1321eb5cae7` |
| `F-treasure-coab-2` | `{"items":3}` | 10 draws | 189 bytes, SHA-256 `c9a3d2947e065741bc533857a6daf65257f482047e4d612c9cc111fae63318a3` |
| `F-treasure-coab-3` | `{"items":6}` | 23 draws | 378 bytes, SHA-256 `39f6d1304af193379c99c3a7ebf892a94d0706a2878edf065a0bce6944fc9f1c` |
| `F-treasure-coab-4` | `{"items":10}` | 47 draws | 630 bytes, SHA-256 `2e516e664d42c57f204793b7f904b1d0a74610b74d0a6bb002bf08ba0e4d632b` |

#### `battlefield.area` (F)

Defined by [procedures.md](../B-model/procedures.md#154-battlefields).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `F-area-por-1` | `{"geo":"GEO2.DAX","record":20,"x":8,"y":8,"area":20}` | 865 draws | 1250 bytes, SHA-256 `20f6883567a208d899ade60a401d35c2f262b708e98a6c5c5a6ec9833e6d37fb` |
| `F-area-por-2` | `{"geo":"GEO1.DAX","record":18,"x":3,"y":12,"area":18}` | 824 draws | 1250 bytes, SHA-256 `012b9f1c892ed9e6e2330b184883b8ade6d217c36d280d10410a6253b66e3a13` |
| `F-area-por-3` | `{"geo":"GEO3.DAX","record":0,"x":15,"y":0,"area":0}` | 535 draws | 1250 bytes, SHA-256 `ed8a493e0aca8d303a39203ad29588c018101381c33bbc2478ed9a5fde8dcef1` |
| `F-area-coab-1` | `{"geo":"GEO2.DAX","record":1,"x":8,"y":8,"area":1}` | 18 draws | 1250 bytes, SHA-256 `7a84baa46b19ce46608c05b65c6fcc9ad6a9eb6c304b13ba9b1ca2b574850392` |
| `F-area-coab-2` | `{"geo":"GEO3.DAX","record":16,"x":5,"y":10,"area":16}` | 0 draws | 1250 bytes, SHA-256 `375ebdf7568aec5010a1fd390c4aaa127037b531ae56c9d7434df062a8eada61` |
| `F-area-coab-3` | `{"geo":"GEO4.DAX","record":32,"x":0,"y":15,"area":32}` | 8 draws | 1250 bytes, SHA-256 `7d8b5e48a37eb4aaaf84084a318e656cbf91aa85ef13b8cad703a372071c450e` |

#### `headless.run` (F)

Defined by [host-contracts.md](../B-model/host-contracts.md#8-the-headless-harness).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `F-run-por-1` | (243 characters) | 3718 draws | 19287 bytes, SHA-256 `1bd6b9a1e2c2879bc5e7c1459c9ba9dc2fd5190849940a61c20fd64fea9b4e53` |
| `F-run-por-2` | `{"script":{"game":"por","jump":[1,18,8,8,0],"commands":["f","f","r","f","f","l","f"],"answers":[0,0,0,0]}}` | 0 draws | 1782 bytes, SHA-256 `82882107ccd6e52b08a922f8dbb56e1f8c9f64d08478b29e9dc47100b8f811a9` |
| `F-run-por-3` | (293 characters) | 3735 draws | 9018 bytes, SHA-256 `52558eac75dd17c459446ae212dd641e9b66707f996aa9a4fd17559ac1d8f25d` |
| `F-run-por-4` | (281 characters) | 3820 draws | 12493 bytes, SHA-256 `d54028e92ed7d8e6f968c4b60a56a33543b20094a49b1262dcc077f8c631cdab` |
| `F-run-coab-1` | `{"script":{"game":"coab","commands":["l","l","f","f","r","f","f","l","f","s","L"],"answers":[0,0,0,0,0,0]}}` | 0 draws | 4899 bytes, SHA-256 `489a0ab813ad7bf07eb0611985a76ddbedebb45b2f740a4f22c66e279ca38a1a` |
| `F-run-coab-2` | (307 characters) | 0 draws | 2275 bytes, SHA-256 `1ad6253f6df396f8f91239b4f4c761706f692db54569ee4a9eb9b20e2b604cc3` |
| `F-run-coab-3` | (335 characters) | 4272 draws | 13170 bytes, SHA-256 `b5c04430f23ec86d099dc0658e80fa03403a8ce113d576cb16e66cb889ae241c` |

#### `sound.driver` (F)

Defined by [sound.md](../A-games/engine/sound.md#3-timer-engine).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `F-sound-por-1` | `{"effect":1,"device":"pc"}` | – | 9601 bytes, SHA-256 `934a19065caca4ffe42458a08ca9d6b93b9b33985515b9681b6059d2adc16f6a` |
| `F-sound-por-2` | `{"effect":1,"device":"tandy"}` | – | 43201 bytes, SHA-256 `935c59db9be8088ac5f9d2f02d32c82380ae5b5f9d9c3c759bfd39c20a957192` |
| `F-sound-por-3` | `{"effect":2,"device":"pc"}` | – | 2156 bytes, SHA-256 `6729da5655450afe5a51b1f91b6ce6fdc7d67ea57c10fa3a419dffad595c1ec7` |
| `F-sound-por-4` | `{"effect":2,"device":"tandy"}` | – | 8105 bytes, SHA-256 `ece02a87822da0ebbc052d49e7834630815daedf5a2a05f9ce474318d1c5260b` |
| `F-sound-por-5` | `{"effect":3,"device":"pc"}` | – | 317 bytes, SHA-256 `4aa6ee3c59b3d35af1cfd2bc419647e315b8743a7fe2873a6eddc2fa4871502b` |
| `F-sound-por-6` | `{"effect":3,"device":"tandy"}` | – | 2041 bytes, SHA-256 `4761099287c151bd40a57de769db8eb2f2983b2376b658b89f586336e2c3ead4` |
| `F-sound-por-7` | `{"effect":4,"device":"pc"}` | – | 1892 bytes, SHA-256 `b675fb74c571fbc3929b2d493b395cdb9a1007cc7eb9bdc3063f9512fb0371be` |
| `F-sound-por-8` | `{"effect":4,"device":"tandy"}` | – | 10127 bytes, SHA-256 `a5055a3c6c7681aaeb7e87dfa7f48571f4d08c7e74723aaae8c326da087252bf` |
| `F-sound-por-9` | `{"effect":5,"device":"pc"}` | – | 1722 bytes, SHA-256 `303d415b182022cc2449c397bcb1b6c6df203dd37cc3b78ec61ec36eaf7a3d3b` |
| `F-sound-por-10` | `{"effect":5,"device":"tandy"}` | – | 15457 bytes, SHA-256 `e99bd127451a63cc51383c52dd5d43b09707c5c3c45fcff411901831f1b36654` |
| `F-sound-por-11` | `{"effect":6,"device":"pc"}` | – | 1352 bytes, SHA-256 `1fa2382cc13fe59485a570aac8e1d564c6fc8b4e93039dcfd8f0758dfade23be` |
| `F-sound-por-12` | `{"effect":6,"device":"tandy"}` | – | 9641 bytes, SHA-256 `625030236ee5fd1dc648f7ebabc96ca51d7ade2e8c906f7e914565c52357c97c` |
| `F-sound-por-13` | `{"effect":7,"device":"pc"}` | – | 580 bytes, SHA-256 `3671b9c364ba71b86c57ad837e9960a5394740778615b522795be81400687dfb` |
| `F-sound-por-14` | `{"effect":7,"device":"tandy"}` | – | 841 bytes, SHA-256 `0d9edb5f3694e84d24b3b55499df2e6e2bddd5a04aa3fdfe32286e4d51e0ca1d` |
| `F-sound-por-15` | `{"effect":8,"device":"pc"}` | – | 5593 bytes, SHA-256 `91bafb050cd78c4c88e73fcdf4f9eec2ec210f9488c9ac18f9974ea25fa8b5bb` |
| `F-sound-por-16` | `{"effect":8,"device":"tandy"}` | – | 25235 bytes, SHA-256 `f368669eb4d0cf9ef28cf143853ff436299bf53633c0c4b6d265aaf36f07590e` |
| `F-sound-por-17` | `{"effect":9,"device":"pc"}` | – | 83 bytes, SHA-256 `d747a0d1321ef2617fedebec43d229bfc68e8daa25c712413ac525b6ca754cba` |
| `F-sound-por-18` | `{"effect":9,"device":"tandy"}` | – | 2441 bytes, SHA-256 `9ba3f16dc7f4018c4e153c75aba01691c09ca70149070d181db2d7c5451d98f3` |
| `F-sound-por-19` | `{"effect":10,"device":"pc"}` | – | 81 bytes, SHA-256 `4f17144cab4a14efbc0adfd8cbb267f46047430d5d82ab953f5a259769ddf88c` |
| `F-sound-por-20` | `{"effect":10,"device":"tandy"}` | – | 681 bytes, SHA-256 `af2edcad5f806d22fe20c0e8cf6abc90a1fe6a7b579586d5e90244232c20b011` |
| `F-sound-por-21` | `{"effect":11,"device":"pc"}` | – | 3030 bytes, SHA-256 `e9a5468bea0c49f191e66ffedd8537d6719b7da39350d6be539ed004e39bacdd` |
| `F-sound-por-22` | `{"effect":11,"device":"tandy"}` | – | 17391 bytes, SHA-256 `283924f2fbb83796f4dea51d7da20b67ea862f8f04a394e2e8b295abaa64901d` |
| `F-sound-por-23` | `{"effect":12,"device":"pc"}` | – | 272 bytes, SHA-256 `067dff8874a6dcf009b5b8029ef7d2b7b5b86e2e650c793a0e0f0f6b3888818b` |
| `F-sound-por-24` | `{"effect":12,"device":"tandy"}` | – | 1301 bytes, SHA-256 `9c8e124294acedc50bcb5335b9933286bd460391bdcb70d440d218d6595baad2` |
| `F-sound-por-25` | `{"effect":13,"device":"pc"}` | – | 1029 bytes, SHA-256 `4166c4091dbc59a3c7f0e3a0870d2341396eafc09a385ee47d44e7c182e77b1b` |
| `F-sound-por-26` | `{"effect":13,"device":"tandy"}` | – | 4861 bytes, SHA-256 `d9fd83d1b1a1e35aced3acb93c05cd712a15afede5a5c4caf5bc86090bfd3604` |
| `F-sound-por-27` | `{"effect":14,"device":"pc"}` | – | 288 bytes, SHA-256 `d1e2f9bdf7214d242a78923cacd7bf6d7604b809237a9cf4056deb119df71a9f` |
| `F-sound-por-28` | `{"effect":14,"device":"tandy"}` | – | 1041 bytes, SHA-256 `d7b5ea261c2f8e179e36defbae0597748a7dcb4cfed4462d20266c56dc1b17d5` |
| `F-sound-por-29` | `{"effect":15,"device":"pc"}` | – | 255 bytes, SHA-256 `b0dd5392297413e2ea252be8d5c16361d140adc1bd5aa0bb96f72eb035022f91` |
| `F-sound-por-30` | `{"effect":15,"device":"tandy"}` | – | 1161 bytes, SHA-256 `0482df856df0734507757d36c744df17bba22838dba794096e7e6d33cef86439` |
| `F-sound-por-31` | `{"effect":16,"device":"pc"}` | – | 977 bytes, SHA-256 `36a6278a7249a5a4f1f2ec257bd15f70ada5fa3a2148efa3c03f389f6ed530f6` |
| `F-sound-por-32` | `{"effect":16,"device":"tandy"}` | – | 4279 bytes, SHA-256 `b897e7965af2b582e4dce412b30b605271415c1f0aeda32ddc8df35ec8e8add8` |
| `F-sound-por-33` | `{"effect":17,"device":"pc"}` | – | 375 bytes, SHA-256 `d90095801bcbed17a790f216cd60d0cc230f71c3a711c449e194d15283131fba` |
| `F-sound-por-34` | `{"effect":17,"device":"tandy"}` | – | 1641 bytes, SHA-256 `f3b245892d47970e97ab5a7552a33bb864c3bfeeac770cb7452f6b82806a4fb0` |
| `F-sound-por-35` | `{"effect":18,"device":"pc"}` | – | 461 bytes, SHA-256 `79eecf983d4cfaae1544d628bcc4f30e4df2874e9b43e0a90941a0a455cf08f7` |
| `F-sound-por-36` | `{"effect":18,"device":"tandy"}` | – | 2461 bytes, SHA-256 `13e3b97573d5e67e0ab9457226775ca19aa3de62877b7519c6458ee2f448d3da` |
| `F-sound-por-37` | `{"effect":19,"device":"pc"}` | – | 750 bytes, SHA-256 `24fd86a55d7c617c306fef8eb155316e64b7047f6edc8312051b98d6f57954de` |
| `F-sound-por-38` | `{"effect":19,"device":"tandy"}` | – | 76914 bytes, SHA-256 `b3e75cc4b9d4b3cbaa10dcbce626c18fb1211c1509dda75df586d48ae5aa0e74` |
| `F-sound-por-39` | `{"effect":20,"device":"pc"}` | – | 146 bytes, SHA-256 `2ec3a8d6df7d38bd56dd7bf4c8bde14b0e87d0433c6021ffeea5e4bdd6a4082f` |
| `F-sound-por-40` | `{"effect":20,"device":"tandy"}` | – | 681 bytes, SHA-256 `caa8b6f70afc3b66f0b8572da249f51387a959243df6ef3cb637bb52e8246da4` |
| `F-sound-por-41` | `{"effect":21,"device":"pc"}` | – | 5 bytes, SHA-256 `db407f11d7ede59abaab0e98e097ff2dae10a048207b801745d7199ef19c2387` |
| `F-sound-por-42` | `{"effect":21,"device":"tandy"}` | – | 41 bytes, SHA-256 `ecf932c5761eb587ce273940afe79ce4ea2da755f7af14fa80996ed1f3bd93fb` |
| `F-sound-por-43` | `{"effect":7,"device":"pc","cut":20}` | – | 178 bytes, SHA-256 `0a3d201a8bdc95d69d3edc3a2ff86f165bbde7b065bcb64d93c6f880e4491b4d` |
| `F-sound-por-44` | `{"effect":9,"device":"pc","cut":20}` | – | 83 bytes, SHA-256 `d747a0d1321ef2617fedebec43d229bfc68e8daa25c712413ac525b6ca754cba` |
| `F-sound-por-45` | `{"effect":10,"device":"pc","cut":20}` | – | 81 bytes, SHA-256 `4f17144cab4a14efbc0adfd8cbb267f46047430d5d82ab953f5a259769ddf88c` |
| `F-sound-coab-1` | `{"effect":1,"device":"pc"}` | – | 9601 bytes, SHA-256 `934a19065caca4ffe42458a08ca9d6b93b9b33985515b9681b6059d2adc16f6a` |
| `F-sound-coab-2` | `{"effect":1,"device":"tandy"}` | – | 43201 bytes, SHA-256 `935c59db9be8088ac5f9d2f02d32c82380ae5b5f9d9c3c759bfd39c20a957192` |
| `F-sound-coab-3` | `{"effect":2,"device":"pc"}` | – | 2156 bytes, SHA-256 `6729da5655450afe5a51b1f91b6ce6fdc7d67ea57c10fa3a419dffad595c1ec7` |
| `F-sound-coab-4` | `{"effect":2,"device":"tandy"}` | – | 8105 bytes, SHA-256 `ece02a87822da0ebbc052d49e7834630815daedf5a2a05f9ce474318d1c5260b` |
| `F-sound-coab-5` | `{"effect":3,"device":"pc"}` | – | 317 bytes, SHA-256 `4aa6ee3c59b3d35af1cfd2bc419647e315b8743a7fe2873a6eddc2fa4871502b` |
| `F-sound-coab-6` | `{"effect":3,"device":"tandy"}` | – | 2041 bytes, SHA-256 `4761099287c151bd40a57de769db8eb2f2983b2376b658b89f586336e2c3ead4` |
| `F-sound-coab-7` | `{"effect":4,"device":"pc"}` | – | 1892 bytes, SHA-256 `b675fb74c571fbc3929b2d493b395cdb9a1007cc7eb9bdc3063f9512fb0371be` |
| `F-sound-coab-8` | `{"effect":4,"device":"tandy"}` | – | 10127 bytes, SHA-256 `a5055a3c6c7681aaeb7e87dfa7f48571f4d08c7e74723aaae8c326da087252bf` |
| `F-sound-coab-9` | `{"effect":5,"device":"pc"}` | – | 1722 bytes, SHA-256 `303d415b182022cc2449c397bcb1b6c6df203dd37cc3b78ec61ec36eaf7a3d3b` |
| `F-sound-coab-10` | `{"effect":5,"device":"tandy"}` | – | 15457 bytes, SHA-256 `e99bd127451a63cc51383c52dd5d43b09707c5c3c45fcff411901831f1b36654` |
| `F-sound-coab-11` | `{"effect":6,"device":"pc"}` | – | 1352 bytes, SHA-256 `1fa2382cc13fe59485a570aac8e1d564c6fc8b4e93039dcfd8f0758dfade23be` |
| `F-sound-coab-12` | `{"effect":6,"device":"tandy"}` | – | 9641 bytes, SHA-256 `625030236ee5fd1dc648f7ebabc96ca51d7ade2e8c906f7e914565c52357c97c` |
| `F-sound-coab-13` | `{"effect":7,"device":"pc"}` | – | 580 bytes, SHA-256 `3671b9c364ba71b86c57ad837e9960a5394740778615b522795be81400687dfb` |
| `F-sound-coab-14` | `{"effect":7,"device":"tandy"}` | – | 841 bytes, SHA-256 `0d9edb5f3694e84d24b3b55499df2e6e2bddd5a04aa3fdfe32286e4d51e0ca1d` |
| `F-sound-coab-15` | `{"effect":8,"device":"pc"}` | – | 5593 bytes, SHA-256 `91bafb050cd78c4c88e73fcdf4f9eec2ec210f9488c9ac18f9974ea25fa8b5bb` |
| `F-sound-coab-16` | `{"effect":8,"device":"tandy"}` | – | 25235 bytes, SHA-256 `f368669eb4d0cf9ef28cf143853ff436299bf53633c0c4b6d265aaf36f07590e` |
| `F-sound-coab-17` | `{"effect":9,"device":"pc"}` | – | 83 bytes, SHA-256 `d747a0d1321ef2617fedebec43d229bfc68e8daa25c712413ac525b6ca754cba` |
| `F-sound-coab-18` | `{"effect":9,"device":"tandy"}` | – | 2441 bytes, SHA-256 `9ba3f16dc7f4018c4e153c75aba01691c09ca70149070d181db2d7c5451d98f3` |
| `F-sound-coab-19` | `{"effect":10,"device":"pc"}` | – | 81 bytes, SHA-256 `4f17144cab4a14efbc0adfd8cbb267f46047430d5d82ab953f5a259769ddf88c` |
| `F-sound-coab-20` | `{"effect":10,"device":"tandy"}` | – | 681 bytes, SHA-256 `af2edcad5f806d22fe20c0e8cf6abc90a1fe6a7b579586d5e90244232c20b011` |
| `F-sound-coab-21` | `{"effect":11,"device":"pc"}` | – | 3030 bytes, SHA-256 `e9a5468bea0c49f191e66ffedd8537d6719b7da39350d6be539ed004e39bacdd` |
| `F-sound-coab-22` | `{"effect":11,"device":"tandy"}` | – | 17391 bytes, SHA-256 `283924f2fbb83796f4dea51d7da20b67ea862f8f04a394e2e8b295abaa64901d` |
| `F-sound-coab-23` | `{"effect":12,"device":"pc"}` | – | 272 bytes, SHA-256 `067dff8874a6dcf009b5b8029ef7d2b7b5b86e2e650c793a0e0f0f6b3888818b` |
| `F-sound-coab-24` | `{"effect":12,"device":"tandy"}` | – | 1301 bytes, SHA-256 `9c8e124294acedc50bcb5335b9933286bd460391bdcb70d440d218d6595baad2` |
| `F-sound-coab-25` | `{"effect":13,"device":"pc"}` | – | 1029 bytes, SHA-256 `4166c4091dbc59a3c7f0e3a0870d2341396eafc09a385ee47d44e7c182e77b1b` |
| `F-sound-coab-26` | `{"effect":13,"device":"tandy"}` | – | 4861 bytes, SHA-256 `d9fd83d1b1a1e35aced3acb93c05cd712a15afede5a5c4caf5bc86090bfd3604` |
| `F-sound-coab-27` | `{"effect":14,"device":"pc"}` | – | 288 bytes, SHA-256 `d1e2f9bdf7214d242a78923cacd7bf6d7604b809237a9cf4056deb119df71a9f` |
| `F-sound-coab-28` | `{"effect":14,"device":"tandy"}` | – | 1041 bytes, SHA-256 `d7b5ea261c2f8e179e36defbae0597748a7dcb4cfed4462d20266c56dc1b17d5` |
| `F-sound-coab-29` | `{"effect":15,"device":"pc"}` | – | 255 bytes, SHA-256 `b0dd5392297413e2ea252be8d5c16361d140adc1bd5aa0bb96f72eb035022f91` |
| `F-sound-coab-30` | `{"effect":15,"device":"tandy"}` | – | 1161 bytes, SHA-256 `0482df856df0734507757d36c744df17bba22838dba794096e7e6d33cef86439` |
| `F-sound-coab-31` | `{"effect":16,"device":"pc"}` | – | 977 bytes, SHA-256 `36a6278a7249a5a4f1f2ec257bd15f70ada5fa3a2148efa3c03f389f6ed530f6` |
| `F-sound-coab-32` | `{"effect":16,"device":"tandy"}` | – | 4279 bytes, SHA-256 `b897e7965af2b582e4dce412b30b605271415c1f0aeda32ddc8df35ec8e8add8` |
| `F-sound-coab-33` | `{"effect":17,"device":"pc"}` | – | 375 bytes, SHA-256 `d90095801bcbed17a790f216cd60d0cc230f71c3a711c449e194d15283131fba` |
| `F-sound-coab-34` | `{"effect":17,"device":"tandy"}` | – | 1641 bytes, SHA-256 `f3b245892d47970e97ab5a7552a33bb864c3bfeeac770cb7452f6b82806a4fb0` |
| `F-sound-coab-35` | `{"effect":18,"device":"pc"}` | – | 461 bytes, SHA-256 `79eecf983d4cfaae1544d628bcc4f30e4df2874e9b43e0a90941a0a455cf08f7` |
| `F-sound-coab-36` | `{"effect":18,"device":"tandy"}` | – | 2461 bytes, SHA-256 `13e3b97573d5e67e0ab9457226775ca19aa3de62877b7519c6458ee2f448d3da` |
| `F-sound-coab-37` | `{"effect":19,"device":"pc"}` | – | 750 bytes, SHA-256 `24fd86a55d7c617c306fef8eb155316e64b7047f6edc8312051b98d6f57954de` |
| `F-sound-coab-38` | `{"effect":19,"device":"tandy"}` | – | 97377 bytes, SHA-256 `335a6fec8e41b8a69b4d19d4e2fc3c5b457ad6919b3e72712f3acf099c662204` |
| `F-sound-coab-39` | `{"effect":20,"device":"pc"}` | – | 146 bytes, SHA-256 `2ec3a8d6df7d38bd56dd7bf4c8bde14b0e87d0433c6021ffeea5e4bdd6a4082f` |
| `F-sound-coab-40` | `{"effect":20,"device":"tandy"}` | – | 681 bytes, SHA-256 `caa8b6f70afc3b66f0b8572da249f51387a959243df6ef3cb637bb52e8246da4` |
| `F-sound-coab-41` | `{"effect":21,"device":"pc"}` | – | 5 bytes, SHA-256 `db407f11d7ede59abaab0e98e097ff2dae10a048207b801745d7199ef19c2387` |
| `F-sound-coab-42` | `{"effect":21,"device":"tandy"}` | – | 41 bytes, SHA-256 `ecf932c5761eb587ce273940afe79ce4ea2da755f7af14fa80996ed1f3bd93fb` |

#### `decode.image` (F)

Defined by [containers.md](../A-games/engine/containers.md#startexe-microsoft-exepack).

| Vector | Input | Tape | Output |
|---|---|---|---|
| `F-image-por-1` | `{"merged":false}` | – | 68592 bytes, SHA-256 `a42a57e68d3f7815831821cc9365bb917befda45a58e958544451fc7a878df8e` |
| `F-image-por-2` | `{"merged":true}` | – | 300288 bytes, SHA-256 `988ba408a83c04f6f28aea1448160753230ffecfd48573bce00fad3efa5f6c51` |
| `F-image-coab-1` | `{"merged":false}` | – | 62432 bytes, SHA-256 `f0ce4b2036e48151077bdc34f7afba48bd9d2032139871924b6854c4b5784ec1` |
| `F-image-coab-2` | `{"merged":true}` | – | 359504 bytes, SHA-256 `90b0cd7aee34879396944a109afa0810259643ba8168b8c0c0dede2784aa6100` |
<!-- /generated:vectors -->

## 6. The generator and the golden outputs (informative)

The reference implementation computes every vector: `web/headless/vectors.ts` (the procedures),
`vector-cases.ts` (the inputs) and `vectors-run.ts`, the command line (from `web/`:
`npm run vectors -- [--por <folder>] [--coab <folder>] [--write] [--golden <folder>]`, the folders
defaulting to `$POOLRAD` and `$COAB`). It records each tape from the reference generator, writes the
manifest and §5 (with `--write`), or replays every tape and compares (without). `--golden` writes the
full outputs of the F vectors and every tape to a local folder: the **golden outputs** a clean-room
run is compared with when a hash differs. They hold game data and stay with the player's files.
`web/test/vectors.test.ts` replays the manifest against the reference on every test run (the E and F
vectors skip without the game files).

The two other reference hash sets are kept with the tests: the V9 view frames
(`web/test/view-frames.json`, [exploration-view.md §2.3](../C-port/exploration-view.md#23-conformance))
and the game texts by address (`web/test/text-hashes.json`, [strings.md](strings.md)); a clean-room
run gets copies of both ([CLEANROOM.md §2](../CLEANROOM.md#2-the-file-sets)).

## Open

- The PoR sound driver's cut-off tick depends on the clock's phase (**I**, [audio.md §3](../C-port/audio.md#3-the-cut-off-rule)):
  the cut vectors fix it at 20 ticks.
