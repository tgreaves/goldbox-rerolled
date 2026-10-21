---
created: 2026-10-15
tags: [reverse-engineering, gold-box, spec]
---

# Combat visuals

Part of the [specification](../../README.md), part A. What the original draws during a battle: action poses, missiles and spell flights, sparkle and starburst, the skull, the side panel, the palette and the cursor. Conventions (evidence marks, `c[x]`, `R[x]`, distances, the combat record) are those of [combat-rules.md](combat-rules.md#conventions).


Marks: **O** observed in code, **I** inferred, **?** unknown. "speed" is the game speed `DS:49E2` (0–9). Sound numbers as in [sound.md](sound.md) §7.

## Building blocks

**Icon table** (O): `DS:5E5A + 8·slot + 4·sub`, 26 slots of 24×24 icons; sub 0 normal, sub 1 "action". `FUN_58af_01c8(name, record, slot)` loads `record` into sub 0 and `record + 0x80` into sub 1 (colour 0 transparent, I). At game init (`FUN_36c1_002d`) COMSPR 0–11 go into slots 13–24 and COMSPR 25 into slot 25:

| slot | COMSPR | use |
|---|---|---|
| 13 | 0 / 128 | arrow N / S |
| 14 | 1 / 129 | arrow NE / SE |
| 15 | 2 / 130 | arrow E / W |
| 16 | 3 / 131 | spinning axe, club, hammer |
| 17 | 4 / 132 | flask |
| 18 | 5 / 133 | spell bolt (every spell and gaze) |
| 19 | 6 / 134 | lightning |
| 20 | 7 / 135 | boulder (default missile) |
| 21 | 8 / 136 | sling stone |
| 22 | 9 / 137 | sparkle: an effect took hold |
| 23 | 10 / 138 | starburst: spell or effect damage; acid spit |
| 24 | 11 / 139 | skull: a combatant falls |
| 25 | 25 / 153 | cursor tile (sub 0 only) |

Monster `CPIC` icons take slots 8 and up; more than 5 monster types would overwrite slot 13 onwards (**?**, no check found).

**Drawing a combatant** `FUN_577f_0af8(c, dir, action, noDraw)` (O): scroll to c if needed (margin 3); erase its cells when the facing half changes or action/noDraw is set; R[9] = dir; draw icon c[0xBF] with sub = action. `FUN_58af_04fc` mirrors the icon when dir ≥ 4 (S, SW, W, NW), so only two facings show. Status never changes the icon (asleep, held, charmed look the same). Walking never changes R[9] (`FUN_3aae_0712`).

**Animation buffer** `DS:6E36`, 4 frames (O): `FUN_10ba_1892(slot, sub, k, mirror)` copies an icon into frame k, mirrored if asked; `FUN_10ba_19de(slot)` builds the standard cycle **sub 0, sub 0 mirrored, sub 1 mirrored, sub 1**.

**Projectile flight** `FUN_10ba_1a29(x1, y1, x2, y2, frames, delay)` (O unless marked): a Bresenham line in thirds of a cell (8-pixel steps) from 3·(x1, y1) to 3·(x2, y2) (line walker `FUN_56c1_01a0`/`02cc`), about 3·max(|Δx|, |Δy|) steps (I); no flight when both ends are the same cell. Before it the view stays when both ends are visible, else centres on the midpoint when |Δx| and |Δy| ≤ 6; a projectile leaving the 7×7 window scrolls it 3 cells. Each step draws frame f at the step, presents, Delay(delay), restores the background, f = (f + 1) mod frames. With delay 0 a step is drawn only on cell-aligned positions and the final frame stays (the aim cursor). The final frame is drawn at the target.

**Effect display** `FUN_10ba_1feb(target, good, msg)` (O): outside combat only msg and the pause. In combat: SetResident(0); frames = `19de(22)` sparkle if good, `19de(23)` starburst if not; scroll to the target; sound 4 (good) or 3; msg printed **without** a pause; frames 0–3 at the target's top-left cell, 70 ms each, for speed + 1 cycles (good) or 1 cycle (not good); SetResident(10); the message pause only when there was one cycle (always for damage; for good only at speed 0).

## Weapon attacks (O, `FUN_3aae_1884`)

1. A target that turns (R[0xF] < 3 and not from behind) is redrawn facing the attacker.
2. The attacker faces the target and shows its **action frame**; Delay(100).
3. Missile flight, if any (below).
4. The attack loop `FUN_3aae_1406`: no flash. A hit plays sound 7 (transient), an all-miss line sound 9, a helpless slay sound 7; each result line ends with the message pause.
5. The attacker returns to frame 0.

## Falls: the skull (O, `FUN_577f_0e11`)

Any combatant of either side that goes out of play (weapon damage `3aae_02f9`, spell/effect damage `5216_1344`, status changes `3723_0058`, turned undead "is destroyed" `3aae_116a`): scroll to it, erase its cells, draw the **skull** (slot 24, COMSPR 11) on every footprint cell; a party entry (R[0x13] = 0) then gets a body record and cell 0x1F (unless it is cloud 0x1E); sound 5 and the message pause; the skull is erased and the view redrawn, so party members show the 0x1F body (RandCom 5) and monsters leave nothing. `3723_0058` pauses once more afterwards. Outside combat only sound 5 and the pause.

## Sparkle and starburst (O)

- **Sparkle**, (speed + 1) × 280 ms, sound 4, on each target (never the caster): from `FUN_5216_1656` after adding an effect whose message is not empty ("falls asleep", "is held", "is charmed", "is blinking", "is Speedy", ...; "is unaffected" gets none), and direct calls: Cure Blindness, Dispel Magic, Remove Curse, healing potions/ointment ("is Healed"), turn undead "is turned", monster paralysis. Cure Light Wounds has none.
- **Starburst**, 280 ms, sound 3, then the pause, on each target that takes damage > 0 after its save (`FUN_5216_1344`, "takes N points of damage"): every damaging spell, breath, spit and poison. The skull follows if the target is now out of play.

## Missiles and spell flights (O)

**Weapon missiles** `FUN_3aae_26b0(attacker, target, item)`, once per attack action:

| item type | frames | frames, delay |
|---|---|---|
| 9 Dart, 21 Javelin, 28 Quarrel, 31 Spear, 73 Arrow | by direction: N 0, NE 1, E 2, SE 129, S 128, SW 129 mirrored, W 130, NW 1 mirrored | 1, 10 ms |
| 2 Hand Axe, 7 Club, 20 Hammer | `19de(16)` | 4, 50 ms |
| 85 Holy Water, 86 Oil | `19de(17)` | 4, 50 ms |
| 47 Sling | 8, 136 | 2, 20 ms |
| anything else | 7, 135 | 2, 20 ms |

Sound 6, the flight, sound 12.

**Spell flight** (`FUN_4e53_0c20`, combat only): frames `19de(18)`; the caster turns to the aim point and shows its action frame; sound 11 (Fireball), 8 (Lightning Bolt) or 2; flight caster → aim point, 4 frames, 30 ms; caster back to frame 0; then the handler. Self-targeted spells have no flight. Extras:
- **Hold Person** (`4e53_1658`): sound 2 and a bolt to each target but the last-listed one before its save (I, likely a bug).
- **Lightning Bolt** (`4e53_295b`/`28bc`), breath bolt (`4e53_30d9`), Javelin of Lightning: frames `19de(19)`, each segment (bounces included) flown at 50 ms; each creature hit gets the starburst.
- **Fireball** (`4e53_266b`): no burst graphic; the view centres on the aim point, each target gets its starburst.
- **Stinking Cloud**: "Creates a noxious cloud" without a pause, a redraw showing the cloud cells (RandCom 4), then the pause.
- **Gazes** (`3723_1cad`, `1e77`): the spell bolt, 4 frames, 45 ms ("reflects it!" adds a return flight). **Acid spit** (`3723_2c1c`): COMSPR 10 alone at 30 ms, then the starburst.

## Side panel (O, `FUN_10ba_09e3`)

Columns 23–38, from row 1: the combatant's name; "Hitpoints" (colour 10) with the HP at column 33 in light green (10) at full HP, yellow (14) below it (`FUN_10ba_0973`); "AC" (10) with the AC at column 26; the readied weapon's name, wrapped (`FUN_10ba_0fe2`); then, for one out of the fight (char[0x10D] = 0), its status word from `DS:1047` ("Okay", "Animated", "tempgone", "Running", "Unconscious", "Dying", "Dead", "Stoned", "Gone") in white, else "(Helpless)" in white if it has effect 0x33, 0x34, 0x35 or 0x1F (`DS:286C`).

## Palette (O)

Drawing the combat screen frame (`FUN_10ba_2b88`, at battle start and after casting or using an item) calls `FUN_577f_00e3`: on EGA (`DS:4A1E` = 1) palette register 0 := colour 8 and register 8 := colour 0 (`FUN_1464_2a0d(reg, colour)`, INT 10h AX=1000h; colours ≥ 8 are sent as colour + 8, the intensity bit). Black shows as dark grey and dark grey as black: dungeon floors are dark grey, the mortar between stones black. The cleanup `FUN_320c_0000` → `FUN_577f_0105` restores both registers. The combat-icon editor (`FUN_417f_382d`) and the View screen (`FUN_4894_0ab3`) swap and restore the same way.

## Cursor tile (O)

COMSPR 25, an opaque grey bevelled square, is drawn under the combatant whose turn it is (every turn start, AI or player; removed at turn end), under a caster who "Begins Casting", and under the current target in Aim; Next/Prev slides it to the new target (a flight with delay 0).

## Absent (O)

No Fireball or area burst graphic, no Magic Missile sprite, no sparkle on the caster, no icon change for Sleep/Hold/Charm, no blinking of the active combatant; "Continue Battle:" is text only; `1feb` effects draw at a big monster's top-left cell only, the skull on every cell.
