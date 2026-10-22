---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Exploration view

Part of the [specification](../README.md), part C: GoldBox Rerolled. What the view region shows
while exploring: the 3D view, encounter sprites, pictures and BIGPIC pictures, the sky and ground,
both wildernesses (PoR's tiles, CotAB's map picture), and the area map beside it.

**Normative status (decision D6).** The original's drawn view ([§2](#2-the-drawn-view-normative)) is
the **conformance target**, pixel-exact for a given map, wall sets, position, facing and time. The
port's WebGL view ([§3](#3-the-webgl-view-optional)) is an **optional enhancement**: a build MAY offer
it, and when it does it MUST preserve what §3.6 lists, checked within the tolerance given there. The
area map (§6) and the wilderness views (§4) are normative as written. Observed in the reference
implementation (`web/src/render/drawnview.ts`, `render/viewscene.ts`, `render/world.ts`,
`ui/explore.ts`, `ui/areamap.ts`, `rules/landmarks.ts`, `games/view.ts`, **O**) unless marked.

## 1. The two views

| | Drawn view (§2) | WebGL view (§3) |
|---|---|---|
| status | REQUIRED, the conformance target | OPTIONAL enhancement |
| picture | the original's 88 × 88 frame, built from the wall sets' tiles by the original's painter's algorithm | a perspective scene of the map's walls textured with the wall sets' art |
| moves and turns | the frame is redrawn in one go, as the original | slides (IMP-001, IMP-066) |
| sprites | the original's frame per distance at its fixed place | the nearest frame standing in the scene (IMP-020, IMP-021) |
| check | pixel-exact against the original (V9) | tolerance against the drawn view (§3.6) |
| setting | View: **Original** (default) | View: **Enhanced (3D)** |

A build that offers both MUST let the player choose with the setting **View**: **Original** (the
drawn view) or **Enhanced (3D)** (the WebGL view), **Original by default**, because it is the
original's own picture and the conformance target ([ui-contract.md §9](ui-contract.md#9-settings),
key `poolrad.view`). A change applies at once, in play: the other view is drawn at the party's position
with the sprite on show. Both views draw the same moments (every refresh, §7) and answer the same
calls of the script host ([B-model/host-contracts.md](../B-model/host-contracts.md)): `refresh`,
`clearView`, `sprite`, `picture`, `clearTop`; the picture layer (§5) lies over either.

## 2. The drawn view (normative)

### 2.1 What it draws

The original's view, as [maps-and-view.md, "3D view renderer"](../A-games/engine/maps-and-view.md#3d-view-renderer-o-fun_55a0_05fd-fun_55a0_0211)
specifies it (and CotAB's differences, [coab/assets.md §3](../A-games/coab/assets.md#3-3d-view)), in
this order into an 88 × 88 frame of EGA indices:

1. **Background bands** across the frame, view rows inclusive, from the profile's `view.bands`
   ([B-model/profile.md §3.1](../B-model/profile.md#31-the-view-viewart)): PoR sky 0–42, horizon line
   43, band 44–45, floor 46–87 ([maps-and-view.md, "Background colours"](../A-games/engine/maps-and-view.md#3d-view-renderer-o-fun_55a0_05fd-fun_55a0_0211));
   CotAB (EGA) sky 0–43, colour 0 at 44–45, floor (8) 46–87. The colours are the engine's backdrop:
   the sky from the sky table by ECL 0x49FD (0x49FE when the party's square has event bit 7), the line,
   band and floor from registers 0xC05F and 0xC059, the profile's `view.floor` in their place where set.
2. **Pictures over the bands** (CotAB): by day outdoors the sun (`SKY` #251) or the cloud strip (#250)
   at the place the hour and facing give (`view.skyArt`), then always the ground picture (`SKY` #252)
   at view (0, 40) (`view.ground.at`); colour 13 of each is left undrawn
   ([coab/assets.md §3](../A-games/coab/assets.md#background-the-main-change-o-0x53824--ovr0310184)).
3. **The walls**, depth 2, then 1, then 0, exactly in the order and at the cells of
   [maps-and-view.md, "Drawing order"](../A-games/engine/maps-and-view.md#drawing-order-painters-algorithm):
   the two front-wall walks at depth 2 with their edge pieces, the side walls, the half-walks of depths 1
   and 0; the view's own wall lookup (wrapping by one map; nothing outside the map in the profile's
   `view.closedEdges` areas, 0 and 10 in both games); each piece cell by cell, clipped to the 11 × 11
   cells, tile 0 skipped and tile colour 13 leaving what is under it. The piece tables and direction
   vectors are read from `START.EXE` (`T.viewPieces`, `T.wallDx`, `T.wallDy`,
   [B-model/records-and-tables.md](../B-model/records-and-tables.md)); without it, part A's values.
4. **The encounter sprite** on show, if any: frame *distance* + 1 of its `SPRIT<block>` record (the last
   frame if the record has fewer), at its header (x, y) cells, colour 0 left undrawn, colour 13 drawn as
   black ([graphics.md, "Encounter sprites"](../A-games/engine/graphics.md#encounter-sprites-o)).

The inputs are the area's GEO record, the three loaded wall sets, the party's x, y and facing, the area
number, the backdrop, in CotAB the hour (ECL 0x4BC9), and the sprite on show. The output is 88 × 88
EGA indices.

### 2.2 Presentation

- The frame fills the view region as a square (as large as the region allows), scaled by the Graphics
  setting ([rendering.md §2](rendering.md#2-scaling)): Pixel, the 88 × 88 canvas stretched with
  nearest-neighbour sampling; Sharp, the frame enlarged 4 × by whole pixels and the last stretch
  smoothed. The region around it is black. The palette is the EGA one
  ([rendering.md §3](rendering.md#3-palettes)).
- It is drawn again at every refresh (§7): after each move and turn, on area entry, on CALL refresh and
  REDRAW_SCREEN, and when the sprite changes. There are no slides: as the original, the new frame
  replaces the old, and a refresh resolves at once.
- **Encounter sprites** are part of the frame (§2.1 step 4): APPROACH, the encounter menu's Advance and
  LOAD_MONSTER redraw the frame with the new distance's frame of the record, so a nearer sprite replaces
  the farther one (the original redraws the view first, `FUN_2fea_054e`). At distance 0 with a picture,
  the picture replaces the view (§5). `clearView` and a picture remove the sprite. IMP-014's footstep (a
  sound) applies to both views.
- CotAB's sun, clouds and ground are drawn into the frame; the separate sky layer of §5 is the WebGL
  view's.
- A tap on the frame's left third turns left, the middle steps forward, the right third turns right,
  as on the WebGL view ([ui-contract.md §4.4](ui-contract.md#44-the-pad)).
- Pictures, portraits, BIGPIC and the cleared view are drawn over it (§5).
- The original's **overhead map** (Area drawn in the view's place, [maps-and-view.md, "Overhead map"](../A-games/engine/maps-and-view.md#overhead-map-o-fun_55a0_0000))
  is replaced by the area map panel (IMP-022, §6).

### 2.3 Conformance

For each (GEO, wall sets, x, y, facing, area, backdrop, hour, sprite) the 88 × 88 index image MUST
equal the original's, pixel for pixel (V9 of [AUDIT.md §8.1](../AUDIT.md#81-clean-room-validations-that-are-practical)).

**The V9 harness.** The headless runner's frame option ([B-model/host-contracts.md §8.3](../B-model/host-contracts.md#83-the-view-frame-v9))
renders the frame at the end of a run (a save, a debug jump, commands) and gives the SHA-256 of its
7744 index bytes, or a PNG. Two builds fed the same files and script MUST give the same hash.

**Reference frames.** The reference implementation's frames (its harness implementing part A) are
recorded as hashes, never as pictures: `web/test/view-frames.json` holds, for each game's GOG release
(identified by its `START.EXE` hash), the SHA-256 of the 1024 frames of an area (squares y 0–15, x 0–15
in that order, facings N, E, S, W at each, the frames' index bytes concatenated) for eleven areas: the
area of save A, and after a debug jump from it to (8, 8) facing north, PoR's areas 3/0 (New Phlan,
closed edges), 1/18, 2/9, 6/1, 8/13 and CotAB's 3/16, 4/32, 5/50, 6/64. A clean-room build computes the
same from the player's files. Frames of the original itself, its screen memory dumped in DOSBox Staging (the view at screen pixels
24–111), check the reference: 7 frames of save A's area (block 2 area 20: (15,4) facing W, S, E, N; (14,4)
W, W after a step into a wall, N) equal the reference's frames at the same squares, 0 of 7 744 pixels
differing (2026-10-22, [VALIDATION.md §4](../VALIDATION.md#4-sweeps-play-tests-and-reference-hashes)).
Other areas need routes from save A, as the original has no jump.

## 3. The WebGL view (optional)

The reference implementation's view (IMP-001, IMP-007, IMP-020, IMP-021, IMP-066, IMP-069): a
three-dimensional scene drawn with WebGL (three.js). Its numbers are informative except where §3.6
makes them a requirement; a build MAY choose others that keep §3.6.

### 3.1 Geometry

- One world unit is one map square; the map's 16 × 16 squares lie in the x–z plane, square (x, y)
  covering x … x + 1 and y … y + 1 (y grows southwards).
- **Walls**: for every square and each of its four sides whose wall type is not 0, one vertical quad
  1 unit wide and **64 / 56 ≈ 1.143** units high (the proportions of the kind-6 piece, 56 × 64
  pixels), standing on the floor, set 0.002 inside the square's edge and facing into the square. A
  wall is visible only from inside its own square's side, so a wall between two squares is drawn
  twice, once from each side, each with its own type, as the GEO record gives each side
  ([maps-and-view.md, "GEO record"](../A-games/engine/maps-and-view.md#geo-record-o)).
- **Floor**: one plane over the whole map at height 0.
- **Sky**: the scene's background colour; there is no ceiling.
- The scene is rebuilt whenever the engine reports a new map or new wall sets (`mapDirty`).

### 3.2 Textures and colours

- **Wall texture** of a wall type: its kind-6 piece (the wall directly ahead, 7 × 8 tiles = 56 × 64
  pixels) built from the tile bank; tile 0 cells and colour-13 pixels transparent (alpha test 0.5),
  so the sky colour shows through as in the original. One texture per wall type, nearest-neighbour
  filtered (Pixel) or linear on the 4× enlarged texture (Sharp), no mipmaps.
- **Sky and fog colour**: the original's sky colour (the same value as §2.1 step 1).
- **Floor colour**: the original's floor colour (§2.1); CotAB's ground picture instead: `SKY` #252
  rows 32–48 (its least foreshortened rows, nearest the viewer) as a texture, repeated once per square
  across and twice per square along the z axis (profile `view.ground`, [port-data.md §7](../D-appendices/port-data.md#7-view-choices)).
- **Light**: an ambient white light of intensity 1.6 and a directional white light of 1.4 from
  (0.4, 1, 0.7); materials are Lambertian.
- **Fog**: linear, from 3 to 9 units, in the sky colour.

### 3.3 Camera

- Perspective, vertical field of view **70°**, near 0.05, far 40 units; the aspect follows the view
  region.
- Eye height: half the wall height (≈ 0.571).
- Position: **0.35 units behind the square's centre**, opposite the facing (so the side walls of the
  current square are in view, as in the original's depth-0 pieces); looking along the facing, no
  pitch or roll. Yaw = −facing × 90°.
- Renderer: no antialiasing, device pixel ratio at most 2.

### 3.4 Slides

- A move or turn slides the camera from its pose to the new one in **180 ms**, eased with
  3k² − 2k³; a turn takes the shorter way round.
- A pose more than 1.5 units away (wrapping across the map's edge, a jump, a teleport) is reached at
  once; so is a refresh with nothing changed, which therefore does not wait (IMP-066). A new map
  (area change) is drawn without a slide.
- A movement key pressed during a slide ends it at once (IMP-066,
  [ui-contract.md §8.1](ui-contract.md#81-exploring-nothing-pending-no-dialog-no-script-running)).
- Script-driven moves (CALL 0x2C90, a guided tour) slide the same way (IMP-011).
- The engine's `refresh()` resolves when the slide has finished, so the scripts of a step run after
  its slide.

### 3.5 Encounter sprites

IMP-020, IMP-021. The sprite stands in the scene instead of being pasted at a fixed place:

- **Frame**: the record's first frame (the nearest and most detailed) at every distance;
  perspective makes it smaller. Colour 0 transparent, colour 13 opaque black.
- **Size**: 0.016 units per sprite pixel (a 40-pixel orc is about 0.64, half a wall's height).
- **Placement**: a flat card facing the party, its opaque pixels' bounding box centred on the line of
  sight, its lowest opaque row (the drop shadow) on the floor.
- **Depth** from the eye along the facing: 0.65 + *distance* × *step*, where *step* = clamp((*open*
  + 0.85 − 0.8) / 2, 0, 1) and *open* (0–2) counts the open squares ahead of the party before the
  first wall. Distances 0–2 are thus spread over the room in front of the first wall in view, so each
  approach step shows and the sprite never stands beyond that wall (a script may place an encounter
  beyond a door, which is still a drawn wall).
- **Glide**: when the same encounter's distance changes (APPROACH, the encounter menu's Advance), it
  moves to the new depth linearly in **450 ms**. Each APPROACH step that brings it nearer also plays
  the footstep, effect 10 (IMP-014, [audio.md §5](audio.md#5-additions)).
- At distance 0 with a picture, the picture replaces the view (§5): the encounter's `PIC` or the
  portrait of head ECL 0x6DE1 and that body.

### 3.6 What it must preserve (the tolerance)

(In the reference the WebGL view is the View setting's **Enhanced (3D)**.)


A WebGL (or other) 3D view conforms when, for every position, facing and time, it:

1. **shows the same walls**: every wall piece the drawn view draws for the position is visible in the
   3D view in the corresponding part of the picture, and no wall the drawn view leaves out at depths
   0–2 appears there;
2. **uses the original art**: each wall type's own wall art (from the player's wall sets), with the
   original's transparent parts showing the sky colour;
3. **keeps the original's colours**: the sky and floor colours of §2.1 (CotAB's ground picture), the
   EGA palette;
4. **keeps position and facing exact**: the camera stands in the party's square looking along the
   facing when no slide is running; a slide never delays a script's effect beyond its end;
5. **keeps encounter distances**: a sprite at distance 0, 1, 2 appears in front of the first wall,
   visibly nearer at each smaller distance, in the encounter's own art;
6. **gives pictures precedence**: a picture, portrait, BIGPIC or cleared view replaces the 3D view as
   it replaces the drawn view.

**Tolerance check** (V9, **I**: the numbers are provisional, to be calibrated when the harness
exists): render the 3D view at rest into a square image, divide it and the drawn view's 88 × 88 frame
into the original's 11 × 11 grid of tile cells, classify each cell as wall (more than half its pixels
from wall art) or not; the classifications MUST agree in at least 90 % of the cells, and every cell
that the drawn view fills with a depth-0 or depth-1 piece MUST be wall in the 3D render.

## 4. The wilderness views

### 4.1 Pool of Radiance: the tile wilderness

Areas `view.tileOverland` (PoR 25–27) use the original's 5 × 5 tile view ([overland.md](../A-games/engine/overland.md),
IMP-026) instead of the 3D view:

- A 120 × 120 picture of 5 × 5 tiles of 24 × 24: tile *id* (1–255) is frame *id* − 1 of `SQRPACI` #1
  (ids 1–128) or #2 (129–255), the window as `Overland.window` places it around the party
  ([overland.md, "The view"](../A-games/engine/overland.md#the-view-o-fun_54cf_0000-fun_54fa_0000)).
  It fills the view region as a square, whole-pixel scaled.
- The party marker: `ICON` records 0, 128, 1, 129, 2, 130 in turn, one more each redraw, colour 0
  transparent, mirrored when facing south or west.
- Encounter sprites: the middle frame (frame 2) drawn flat at its header position, as the original
  (`FUN_2fea_054e`); pictures as §5.
- The **river cleansing** (`Io.river`, [overland.md, "River cleansing"](../A-games/engine/overland.md#river-cleansing-o-fun_4804_06b3)):
  nine partial passes, each recolouring one matching pixel in four of the cleansed river tiles, while
  the window moves down the river (150 ms a step), then a full pass and the view at (23, 25), then two
  pauses of game speed × 225 ms. With reduced motion the partial passes are left out (IMP-057). After
  a load with the river cleansed (ECL 0x4AA2 ≠ 0) the tiles are drawn recoloured. The partial passes'
  random choices are presentation only (D2).
- The pad and the arrows are compass directions ([ui-contract.md §4.4](ui-contract.md#44-the-pad));
  a tap on the view steps towards the tap. Each step is the original's 12 hours.
- Without `START.EXE` (the overland tables): "Wilderness" and "The wilderness map needs START.EXE
  from the game files: re-import the *FOLDER* folder." in the view, and a move
  answers "Wilderness travel needs START.EXE: re-import the *FOLDER* folder."

### 4.2 Curse of the Azure Bonds: the map picture

CotAB has no tile wilderness ([coab/assets.md §4](../A-games/coab/assets.md#4-overland-no-tile-map-o)):
its overland is `BIGPIC1` #121 (profile `view.overlandPicture`) driven by the scripts' menus.

- The picture (304 × 120) fills the view region's width, keeping its shape, black above and below.
- The **city cursor**: an 8 × 8 white block at cell (`T.cursorX`, `T.cursorY` of ECL 0x4CA1), drawn at
  (x·8 − 8, y·8 − 8) on the picture (the original draws the picture at screen (8, 8)); it blinks,
  about 0.5 s on and 0.3 s off, while that picture is shown.
- Travel is the scripts' menus (ENTER CITY, JOURNEY ON …); while such a menu waits, movement keys
  and the pad are ignored as for any pending menu ([ui-contract.md §6.3](ui-contract.md#63-menus-and-prompts)).

## 5. Pictures and the picture layer

Script pictures are drawn over the view in a square layer (88 × 88 logical pixels unless stated),
whole-pixel scaled, with black around them (a picture replaces the view, as in the original).

| `Io.picture` | Drawn |
|---|---|
| `{ pic }` | `PIC<block>` record: frame 1, then, for an animated record, the next frame after *delay* × 100 ms (at least 50 ms), wrapping to frame 1; frames after the first are XOR deltas ([graphics.md, "Animation"](../A-games/engine/graphics.md#animation-o)) |
| `{ big }` | `BIGPIC<block>` record (CotAB ids ≥ 0x78) at its own size, full width (§4.2 for #121) |
| `{ head, body }` | the portrait: `HEAD<block>` at (0, 0), `BODY<block>` at (0, 40) |
| null | the layer cleared, its animation and the sprite removed |

- **CALL frame** (CotAB 0x6803, `nextFrame`): the shown `PIC` steps one frame (wrapping) and its
  animation stops.
- **CLEAR_TOP** (`clearTop`): a 120 × 120 black square over the view (the original blanks the 15 × 15
  cells of the view and its frame) until the script ends; **PRINT_LIST** glyphs (`glyphs(codes,
  at)`) are drawn on it at text cell (col, row), white; without a cleared view they go inline into the
  text log.
- **clearView** (after moves, turns, area entry): the layer, its animation and the sprite go.
- After a won battle the layer shows `PIC<block>` #1 (the chest) while the treasure panel is open;
  the camp shows #29 (the campfire) animated.
- **The sky layer** (CotAB, profile `view.skyArt`), WebGL view only: the sun or clouds by the rules of
  §2.1 step 2, a flat layer over the 3D picture in the original's 88 × 88 coordinates with colour 13
  transparent, hidden in a tile wilderness and under a picture. The drawn view has them in its frame.

## 6. The area map

IMP-022, IMP-024. A top-down plan of the whole area, beside the view (and in its large view, the
**Area** command). The original's Area command instead swaps the view for an 11 × 11 window of walls
only ([maps-and-view.md, "Overhead map"](../A-games/engine/maps-and-view.md#overhead-map-o-fun_55a0_0000)).

### 6.1 Drawing

- **Shown** when the area allows it (ECL 0x49FB = 0), there is a GEO map and the party is not in a
  wilderness; otherwise "Not here." (the panel) or the note "Not Here." (the Area command, *game
  text*).
- **Grid**: 16 × 16 squares of 24 px (a 385 × 385 canvas), scaled to fit its region (contain); ground
  black (EGA 0).
- **Walls**: each side with a wall type ≠ 0 is a line along that edge of the square (width
  max(2, square / 6)), coloured by the side's passability ([maps-and-view.md, "Movement"](../A-games/engine/maps-and-view.md#movement-o-fun_3e76_0d6d-fun_55a0_0350)):
  0 (a wall) light grey (EGA 7, `#aaaaaa`); 1 (a door that opens, or an opened door) light blue (EGA 9,
  `#5555ff`); 2 or 3 (a locked door) yellow (EGA 14, `#ffff55`). A door unlocked during play changes colour at the next redraw.
- **No fog of war**: every wall is shown, explored or not, as the original's overhead map (the
  engine keeps no visited squares).
- **Party**: a yellow (EGA 14) triangle in the party's square pointing in the facing.
- **Landmarks** (§6.2): their icons centred in their squares, under the party marker.
- Redrawn on every refresh.

### 6.2 Landmarks

The port reads the area's script statically to find what each square is (IMP-024). Port-authored
rules, normative; the text patterns per game are [port-data.md §3](../D-appendices/port-data.md#3-landmark-patterns).

1. **Handlers.** The script's `on_step` vector (the GOTO at code + 4) leads to a dispatch: follow
   GOTOs (and IF branches) from it, at most 300 instructions, to the first ON_GOTO or ON_GOSUB; the
   largest such list gives the handler address of each event number.
2. **Walk.** For each square whose event number *e* = event byte & 0x7F is not 0 and has a handler,
   walk the handler (once per event): every instruction reachable from it, following GOTO, GOSUB,
   ON_GOTO and ON_GOSUB targets, a path ending at EXIT, RETURN, GOTO or NEW_ECL unless that
   instruction follows an IF; at most 400 instructions. Collect: the texts of its string operands
   longer than 3 characters (not SAVE's), the SAVE instructions (value, canonical address), the
   PROGRAM operands, and the NEW_ECL targets. Operand decoding is [ecl.md](../A-games/engine/ecl.md)'s
   with the game's operand variants ([B-model/script-vm-map.md](../B-model/script-vm-map.md)).
3. **Classify**, first match wins, on all the collected texts joined:
   1. a `first` pattern → its kind and label;
   2. a SAVE of 1 into the temple flag (ECL 0x6DE2) → **temple**, "Temple of *God*" with the god
      from the `god` pattern (capitalised), else "Temple";
   3. a SAVE of 1 into the shop flag (ECL 0x6E6C) → the first matching `shops` pattern, else **shop**
      "Shop";
   4. PROGRAM 0 → **training** "Training hall";
   5. PROGRAM 9 and the text "REST" → **inn** "Inn";
   6. a `places` pattern;
   7. a NEW_ECL to a record whose `on_enter` (walked from code + 16, at most 2000 instructions) or
      whose step handlers contain PROGRAM 0 → **training** "Training halls"; whose texts contain "CITY
      HALL" → **hall** "City Hall".
4. **Tooltip text**: the first sentence of the first collected text (a leading quote dropped), or the
   label.

Icons (port data):

| Kind | Icon | Kind | Icon |
|---|---|---|---|
| shop | 🏪 | inn | 🛏 |
| store | 🛒 | tavern | 🍺 |
| jeweller | 💎 | hall | 🏛 |
| armoury | 🛡 | training | ⚔ |
| silver | 🥈 | harbour | ⚓ |
| temple | ⛪ | gate | 🚪 |

An unreadable script gives no landmarks. The list is worked out once per area (script and map).

### 6.3 The large view

The **Area** command (A, a tap on the map, the bar's Area in class L): a panel "Area" with the map at
its full size, a legend (one line per distinct label: its icon and label), a tooltip with the
landmark's text under a hovering pointer, and **Close**. Where the map is refused, the note "Not
Here." instead.

### 6.4 In the asset viewer

The same drawing without a party: squares that carry an event are shaded blue (EGA 1, `#0000aa`) and there are no
landmarks.

## 7. When the view is updated

A **refresh** (`Io.refresh`, after every move and turn, area entry, CALL refresh, REDRAW_SCREEN):

1. a new map or new wall sets rebuild the WebGL scene (no slide);
2. in a tile-wilderness area the wilderness view (§4.1) is shown and redrawn; otherwise the drawn view
   draws its frame (§2.1), or the WebGL view's colours are set from the engine's backdrop and it goes to
   the party's position and facing (§3.4's slide);
3. the sky layer, the area map, the cards and the location line are redrawn;
4. the refresh resolves when the view is at rest.

## Validation

- V9 ([AUDIT.md §8.1](../AUDIT.md#81-clean-room-validations-that-are-practical)): the drawn view by
  the harness and the reference frames (§2.3); `web/test/drawnview.test.ts` checks part A's placements
  on made-up maps (each depth's front and side walls, the edge pieces, the facing, the one-map wrap and
  closed edges, the composition and the sprite's colours), the piece tables read from both games'
  `START.EXE`, the reference frames and the harness's frame. The browser's drawn frame equals the
  harness's at the same position (checked in headless Chromium, PoR and CotAB, 2026-10-21). The 3D view
  by §3.6's check: not automated (it needs WebGL); compared by eye at the same positions.
- The landmark walk: `web/test/landmarks.test.ts` (PoR's New Phlan services, none in the slums,
  Tilverton's training hall, shops, temple and tavern); the picture clearing on moves:
  `web/test/view.test.ts`.

## Open

- §3.6's tolerance numbers are provisional, and its check is not automated.
- Reference frames from the original for areas other than save A's (§2.3; save A's match).
