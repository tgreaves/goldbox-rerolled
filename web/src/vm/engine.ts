// ECL interpreter and exploration loop (spec/A-games/engine/ecl.md, spec/A-games/engine/main-loop.md).
// A port of tools/eclvm.py; every opcode, including the original's quirks, follows spec/A-games/engine/ecl.md.
// The interpreter is async: menus, input and screen refreshes await the front end (Io).

import { R, classLevel, formerLevelsCount } from '../games/rules'
import { installNames } from '../data/character'
import { installText, text } from '../data/gametext'
import { msg, menu as gameMenu, ask, items as menuItems, type MenuOpts } from '../games/strings'
import { canonical, native, viewRead, type EclVariant } from '../games/ecl'
import { game } from '../games/profile'
import type { SoundMode } from '../games/sound'
import { T } from '../games/tables'
import { parseSave } from '../data/save'
import type { GameFiles } from '../store/gamefiles'
import { GeoMap, STEP } from '../data/geo'
import { WallSets } from '../data/walls'
import { unpackText } from '../data/text'
import { Overland } from '../rules/overland'
import { Item, ItemTables, characterItems, parseItems } from '../data/items'
import { parseEffects, type Effect } from '../data/effects'
import { SpellTables } from '../data/spells'
import { unexepack } from '../data/exepack'
import { randomTreasure } from '../rules/randitem'
import { advanceClock, HOUR, MINUTE } from '../rules/camp'
import { F } from '../games/fields'
import { recalc, unreadyItem } from '../rules/equip'
import { WorldHost } from '../rules/worldfx'
import { fire, fx } from '../rules/effects'
import type { DemoMode } from '../games/startup'
import { generator, random, type Dice } from '../rules/dice'

export const A0 = 0x4900
export const B0 = 0x6b00
export const C0 = 0x9700
export const CODE = 0x9900
const CODE_END = 0xb700

// engine-visible ECL variables (spec/A-games/engine/ecl.md)
const AREA_ID = 0x49f2, PREV_X = 0x49f0, PREV_Y = 0x49f1, GEO_ID = 0x49c5, NO_OVERLAND = 0x49e6, NO_ITEM_USE = 0x49e5
const CANCEL_MOVE = 0x6dc9, SEARCH_LOOK = 0x6dca, SURPRISE_RESULT = 0x6dcb, EDGE = 0x6dd5
const OUTCOME = 0x6dc7, DEFEATED = 0x6dc8, SPRITE_MAX = 0x6dc0, SPRITE_DIST = 0x6dc1
const REST_INTERVAL = 0x6dd2, REST_CHANCE = 0x6dd3, PORTRAIT = 0x6de1, TEMPLE_FLAG = 0x6de2
const SHOP_FLAG = 0x6e6c, PARTY_SIZE = 0x6e3e

/** Operand counts used by the IF skip routine FUN_2fea_1ea6 (others skip one byte). */
const SKIP: Record<number, number> = {}
for (const [n, ops] of [
  [1, [0x01, 0x02, 0x0a, 0x0e, 0x11, 0x12, 0x1d, 0x20, 0x2d, 0x32, 0x34, 0x36, 0x38, 0x39, 0x3c]],
  [2, [0x03, 0x08, 0x09, 0x0c, 0x0f, 0x10, 0x1f, 0x22]],
  [3, [0x04, 0x05, 0x06, 0x07, 0x0b, 0x21, 0x28, 0x2a, 0x2f, 0x30, 0x35, 0x37, 0x3b]],
  [4, [0x14, 0x23]], [5, [0x2e]], [6, [0x1e, 0x2c]], [8, [0x27]], [14, [0x29]],
] as [number, number[]][]) for (const o of ops) SKIP[o] = n

/** ENCOUNTER_MENU reactions: code -> choice (0 COMBAT, 1 WAIT, 2 FLEE, 3 ADVANCE, 4 PARLAY) -> action. */
type Act = number | 'wait' | 'approach' | 'parlay' | 'flee' | 'pursue'
const ENCOUNTER: Act[][] = [
  [1, 1, 'flee', 1, 1],
  [1, 'wait', 2, 'approach', 'parlay'],
  ['pursue', 0, 0, 0, 0],
  [1, 'approach', 2, 'approach', 'parlay'],
  [1, 'parlay', 2, 'parlay', 'parlay'],
]

export interface Io {
  /** Text for the text window; clear = PRINT_CLEAR / new screen of text. `run` is given by PRINT and
   *  PRINT_CLEAR only: true when the text goes on along the line a PRINT left open (only PRINT_CLEAR and
   *  NEWLINE move the cursor to a new line, SotSB 0x1E593, CotAB 0x1926C); any other text starts a line. */
  print(text: string, clear: boolean, run?: boolean): void
  /** A menu; resolves to the 0-based choice. `enter` = a one-item "press Enter" prompt. */
  menu(items: string[], opts?: MenuOpts): Promise<number>
  inputNumber(): Promise<number>
  inputText(): Promise<string>
  /** Show a picture (null clears). */
  picture(p: { pic: number } | { big: number } | { head: number; body: number } | null): void
  /** Encounter sprite at a distance (0 nearest), or the picture once it is at distance 0. */
  sprite(sprite: number, picture: number, distance: number): void
  /**
   * The view is drawn again over whatever the scripts put in it: a picture, its animation, an
   * encounter sprite. The original does this on CALL 0x2C90 (the 3D view), at the end of every move
   * (FUN_3e76_0d6d), on turning and on entering an area.
   */
  clearView?(): void
  /** Bring the view up to date with position, map and wall sets (CALL 0x2C90, area entry). */
  refresh(): Promise<void>
  /** A sound effect by the original's number (FUN_18ae_00dc): 10 footstep, 7 bump, 11 script effect;
   *  `mode` as the original's call site plays it (spec/C-port/audio.md §3) */
  sound(n: number, mode: SoundMode): void
  /** CLEAR_TOP (FUN_29c3_2b14): blank the view (true) until the script exits (false). */
  clearTop?(on: boolean): void
  /** PRINT_LIST (FUN_29c3_2e7d): raw font glyphs, in the cleared view at a text cell, or inline in the text. */
  glyphs?(codes: number[], at: { col: number; row: number } | null): void
  /** The river cleansing (FUN_4804_06b3(1)): the polluted river tiles recolour as the view moves down it. */
  river?(): Promise<void>
  /** PAUSE: wait (game speed × the game's pause step: PoR 225 ms, CotAB 100 ms). */
  pause(ms: number): Promise<void>
  /** CALL frame (CotAB 0x6803): the current picture's next frame, the script stepping its animation */
  nextFrame?(): void
  /** Engine screens that are not implemented yet (combat, shops, camp ...). */
  engine(what: string, info?: Record<string, unknown>): Promise<void>
}

export class Hang extends Error {}

export class Engine {
  A = new Uint16Array(0x400)
  B = new Uint16Array(0x400)
  C = new Uint16Array(0x200)
  code = new Uint8Array(0x1e00)
  nodes: Uint8Array[] = []
  /** each member's items (the .ITM records), keyed by character record */
  readonly inventory = new Map<Uint8Array, Item[]>()
  /** combat picture (CPIC<block> record) of each loaded monster, from LOAD_MONSTER's third operand */
  readonly combatPicture = new Map<Uint8Array, number>()
  /** each member's active effects (the .SPC records) */
  readonly effects = new Map<Uint8Array, Effect[]>()
  cur!: Uint8Array
  savedCur!: Uint8Array
  restoreCur = false
  /**
   * DS:84D3 / DS:84D2 (CotAB DS:8B6D / 8B6C): set by a script writing 0 to B 0x6B00 / B 0x6C00 (0x20931,
   * 0x20A39); with both set, LOAD_CHARACTER with bit 7 drops the current character (0x19F92)
   */
  private leaveFlags = [false, false]
  block = 1
  area = 0
  geo: GeoMap | null = null
  walls: WallSets
  x = 0
  y = 0
  facing2 = 0
  regs = new Map<number, number>()
  flags = { EQ: 0, NE: 0, LT: 0, GT: 0, LE: 0, GE: 0 }
  stack: number[] = []
  vectors = [CODE + 0x14, CODE + 0x14, CODE + 0x14, CODE + 0x14, CODE + 0x14]
  monsters = 0
  /** DS:84D4: a duel or solo fight set up by CALL 0x8000 / 0x8001; `duelist` is who fights */
  duel = false
  duelist: Uint8Array | null = null
  monstersLoaded = false
  iconSlot = 8
  /** the treasure money table (DS:67F4): the pool in shops, temples and the treasure screen */
  money = [0, 0, 0, 0, 0, 0, 0]
  /** the treasure item list (DS:6810): shop stock or the treasure pile */
  treasure: Item[] = []
  /** game speed 0 (fastest) to 9 (DS:49E2; saved as ECL 0x49FC); 4 in both shipped saves */
  speed = 4
  areaChanged = false
  quit = false
  /** the demo mode (games/startup.ts) while the demo runs, else null: its flags change a few procedures */
  demo: DemoMode | null = null
  /** set when the map or wall sets change, cleared by the front end */
  mapDirty = true
  private stop = false
  private pc = CODE
  // operand slots 1..64: the original's kind, HI and LO tables are 0x40 bytes apart with slot 0 unused,
  // so operand 64 lands in the next table's slot 0 and reads back whole (SotSB ON_GOTO 0x1F8B5: HI at
  // DS:9029 + i, LO at DS:9069 + i; ECL2 #51 0x8728 has 64 targets)
  private kind = new Uint8Array(65)
  private lo = new Uint8Array(65)
  private hi = new Uint8Array(65)
  private sbuf: string[] = new Array(33).fill('')
  private opstr = new Map<number, string>()
  private readonly files: GameFiles
  readonly io: Io
  /** the injected dice source (spec/B-model/host-contracts.md §6): every draw of the rules goes through `roll` */
  dice: Dice
  /** observers for the headless transcript (host-contracts.md §8): opcode stores, and each area entry done */
  trace: { store?(address: number, value: number): void; entered?(): void } = {}

  /** `dice`: the host's dice source, or a seed for the reference generator (informative, §6.3) */
  constructor(files: GameFiles, io: Io, dice: Dice | number = Date.now()) {
    this.files = files
    this.io = io
    this.walls = new WallSets(files, 1)
    void this.startImage // the game's name and coin tables (installNames)
    installText(files.get('START.EXE'), files.get('GAME.OVR')) // its messages, by address
    this.dice = typeof dice === 'number' ? generator(dice) : dice
  }

  // ---------------------------------------------------------------- state
  get facing() { return this.facing2 >> 1 }

  /** Turbo Pascal Random(n): the request (1, n) − 1 (host-contracts.md §6.1), so a tape sees it */
  rand(n: number) { return random(this, n) }

  /** one request to the dice source: the sum of `count` dice of `sides` faces */
  roll(count: number, sides: number) { return this.dice.roll(count, sides) }

  /** A new game: fresh variables, the given party, block 3 area 0 (New Phlan), as after "Begin". */
  newGame(party: Uint8Array[]) {
    this.A.fill(0); this.B.fill(0); this.C.fill(0)
    for (const [a, v] of R.newGame) this.write(a, v) // SotSB 0x2CB1D, 0x2CB28: the difficulty, the map flag
    this.nodes = party.map((c) => c.slice())
    this.cur = this.savedCur = this.nodes[0]
    this.B[PARTY_SIZE - B0] = this.nodes.length
    const { block, area } = game().ecl.start
    this.setBlock(block)
    this.area = area
    this.loadEcl(area)
    this.resetVm(false)
  }

  /**
   * The demo (games/startup.ts; CotAB image 0x1F6–0x20E, 0x1BFFA): fresh variables, no party (the
   * script brings its own NPCs), the demo's block and record at the demo's game speed.
   */
  newDemo(d: DemoMode) {
    this.A.fill(0); this.B.fill(0); this.C.fill(0)
    this.nodes = []
    this.cur = this.savedCur = new Uint8Array(F.size) // nobody is current until an NPC joins (DS:6520 nil)
    this.demo = d
    this.speed = d.speed
    this.setBlock(d.block)
    this.area = d.record
    this.loadEcl(d.record)
    this.resetVm(false)
  }

  /**
   * The demo's run (CotAB 0x1C061–0x1C084): the record's on_enter, then every member leaves the party
   * (0x3A275(1, 1) until the list is empty). Nothing else of the game loop runs: no moving, camping or
   * saving.
   */
  async runDemo() {
    await this.run(this.vectors[4])
    for (const c of this.nodes) { this.inventory.delete(c); this.effects.delete(c) }
    this.nodes = []
    this.monsters = 0
    this.monstersLoaded = false
    this.B[PARTY_SIZE - B0] = 0
  }

  /** Resume from a save game (SAVGAM*.DAT layout, spec/A-games/engine/savegame.md). */
  loadSave(d: Uint8Array, party: Uint8Array[]) {
    const w = (o: number, n: number) => {
      const out = new Uint16Array(n)
      for (let i = 0; i < n; i++) out[i] = d[o + 2 * i] | (d[o + 2 * i + 1] << 8)
      return out
    }
    this.A = w(1, 0x400); this.B = w(0x801, 0x400); this.C = w(0x1001, 0x200)
    const pos = 0x1401 + game().saves.codeSize
    this.code = d.slice(0x1401, pos)
    this.x = d[pos]; this.y = d[pos + 1]; this.facing2 = d[pos + 2]
    this.speed = Math.min(this.A[0x49fc - A0], 9)
    this.nodes = party.map((c) => c.slice())
    this.cur = this.savedCur = this.nodes[0]
    // the block: B + 0x312 where it is the file digit (PoR, CotAB); else the save's first byte, the digit itself
    // (SotSB DS:7420, written first by 0x421CB)
    if (game().ecl.blockFile.divide === 1) this.setBlockValue(this.B[0x6e12 - B0])
    else this.setBlock(d[0])
    this.area = this.A[AREA_ID - A0]
    this.loadGeo(this.A[GEO_ID - A0])
    parseSave(d).wallSets.forEach((r, i) => { if (r !== 0xffff) this.walls.load(i + 1, r) })
    // the VM is reset when play starts (FUN_29c3_32f8), keeping the saved per-area variables
    this.restoring = true
    this.wallsLoaded = true // CotAB's loader sets DS:47FB (0x1C057)
    // a save without the code buffer (SotSB): the area's script is loaded again from its record (I: 0x419DD not traced)
    if (!game().saves.codeSize && this.area) this.loadEcl(this.area)
    const zero = game().ecl.areaZero
    if (this.area === 0 && zero !== null) {
      if (game().ecl.areaZeroBlock !== null) this.setBlock(game().ecl.areaZeroBlock!) // a start-of-game save: the first area's script, loaded
      this.area = zero // (then reset as any load is, 0x1C05C: portrait selector, vectors, saved per-area variables)
      this.loadEcl(zero)
    }
    // CotAB's loader (0x35B75, at 0x36068): an NPC (morale byte 0x80 or more) gets the combat picture
    // of its identity tag, which ADD_NPC set to its monster id; a player character's icon is built
    if (game().ecl.addNpc.iconPicture) for (const c of this.nodes) if (c[F.morale] >= 0x80) this.combatPicture.set(c, c[F.id])
  }

  private restoring = false

  /** Party members (the list without loaded monsters). */
  party(): Uint8Array[] {
    // the party size (ECL 0x6E3E), but never the monsters loaded after the party
    const n = this.nodes.length - this.monsters
    return this.nodes.slice(0, Math.min(this.B[PARTY_SIZE - B0] || n, n))
  }

  /**
   * The SAVGAM<x>.DAT image (the game's layout: PoR 13 137 bytes, spec/A-games/engine/savegame.md), with the engine globals copied into
   * ECL variables first as FUN_45c5_1d58 does. stems: the character file stems for the party.
   */
  toSave(stems: string[]): Uint8Array {
    const L = game().saves
    // PoR keeps the wall sets in A[0x4AFA..0x4AFF] (FUN_45c5_1d58); a save with its own wall-set field has
    // no such copy (CotAB 323c:41a3, SotSB 0x42413: spec/A-games/coab/records.md §5), and there those words
    // are the scripts' (CotAB ECL 0x4CFD, the game won, refuses Begin: 0x36DCD)
    if (L.wallSetsAt < 0) for (let s = 1; s <= 3; s++) {
      const r = this.walls.records[s]
      this.A[0x4afa + s - 1 - A0] = r
      this.A[0x4afd + s - 1 - A0] = r === 0xffff ? 0xffff : s
    }
    this.A[0x49fc - A0] = this.speed
    this.A[0x49ff - A0] = 3 // monster pictures and portraits on
    this.A[AREA_ID - A0] = this.area
    if (game().ecl.blockFile.divide === 1) this.B[0x6e12 - B0] = this.block // else B keeps the scripts' value
    const d = new Uint8Array(L.saveSize)
    d[0] = this.block
    const put = (o: number, words: Uint16Array) => words.forEach((v, i) => { d[o + 2 * i] = v & 0xff; d[o + 2 * i + 1] = v >> 8 })
    put(1, this.A); put(0x801, this.B); put(0x1001, this.C)
    if (L.codeSize) d.set(this.code.subarray(0, L.codeSize), 0x1401)
    const pos = 0x1401 + L.codeSize
    const [wall, event] = this.square()
    d.set([this.x, this.y, this.facing2, wall, event], pos)
    if (L.wallSetsAt < 0) d[pos + 5] = this.overland ? this.area - 23 : 1 // DS:49FA area kind: 1 map area, 2-4 wilderness
    else {
      // CotAB: the previous game state (I: 4 the 3D view, 3 the overland map), and the wall sets
      d[pos + 5] = this.A[NO_OVERLAND - A0] ? 4 : 3
      for (let s = 1; s <= 3; s++) {
        const r = this.walls.records[s], o = L.wallSetsAt + 4 * (s - 1)
        d[o] = r & 0xff; d[o + 1] = r >> 8; d[o + 2] = s; d[o + 3] = 0
      }
    }
    d[pos + 6] = 2
    d[L.partyAt] = stems.length
    stems.forEach((st, i) => {
      const o = L.partyAt + 1 + 41 * i
      d[o] = Math.min(st.length, 40)
      for (let j = 0; j < d[o]; j++) d[o + 1 + j] = st.charCodeAt(j)
    })
    return d
  }

  /** the block from the value scripts and saves keep in B + 0x312 (EclMap.blockFile) */
  private setBlockValue(v: number) {
    const f = game().ecl.blockFile
    this.setBlock(Math.floor((v + f.add) / f.divide))
  }

  private setBlock(b: number) {
    this.block = b
    this.walls = new WallSets(this.files, b)
    this.mapDirty = true
  }

  private loadGeo(rid: number) {
    const raw = this.files.record(`GEO${this.block}`, rid)
    this.geo = raw ? new GeoMap(raw) : null
    this.mapDirty = true
  }

  private loadEcl(rid: number) {
    const raw = this.files.record(`ECL${this.block}`, rid)
    if (!raw) throw new Error(`no ECL record ${rid} in block ${this.block}`)
    this.code = new Uint8Array(0x1e00)
    this.code.set(raw.subarray(2, 2 + 0x1e00))
  }

  /** FUN_2fea_01b6 */
  private resetVm(keep: boolean) {
    this.stack = []
    this.leaveFlags = [false, false] // 0x20066, 0x2006B
    this.clearFlags()
    this.vectors = [0, 1, 2, 3, 4].map((i) => {
      const save = this.pc
      this.pc = CODE + 4 * i
      this.readops(1)
      this.pc = save
      return this.addr(1)
    })
    this.iconSlot = 8
    this.B[PORTRAIT - B0] = 0xff
    this.B[REST_INTERVAL - B0] = this.B[REST_CHANCE - B0] = 0
    this.A[NO_ITEM_USE - A0] = 0
    this.A[NO_OVERLAND - A0] = 1
    this.regs.set(0xc059, 0x41) // floor and horizon keys back to their defaults (DS:6F68, 6F69)
    this.regs.set(0xc05f, 9)
    if (!keep) {
      for (let a = 0x4a00; a < 0x4a20; a++) this.A[a - A0] = 0
      for (let a = 0x6e79; a <= 0x6e82; a++) this.B[a - B0] = 0
    }
  }

  /**
   * The 3D view's background colours, EGA indices (FUN_54cf_016d → FUN_55a0_0174): the sky from
   * DS:0C26 by ECL 0x49FD, or 0x49FE when the party's square has event bit 7; the horizon line and
   * band from register 0xC05F, the floor from 0xC059 (FUN_54cf_00c7, 00fb, 012f).
   */
  /** The sky picture the view shows now (games/view.ts skyArt): its SKY record and view pixel position. */
  get skyArt(): { record: number; x: number; y: number } | null {
    const art = game().view.skyArt
    if (!art || this.backdrop.sky !== art.daySky) return null
    if (this.geo && this.geo.event(this.x & 15, this.y & 15) > 0x7f) return null // the square's own sky
    const h = this.read(0x49c9) // the clock's hour word (ECL 0x4BC9 in CotAB)
    const r = art.rules.find((x) => x.facing2 === this.facing2 && h >= x.hours[0] && h <= x.hours[1])
    return r ? { record: r.record, x: (r.col[0] + r.col[1] * h) * 8, y: (r.row[0] + r.row[1] * h) * 8 } : null
  }

  get backdrop(): { sky: number; line: number; band: number; floor: number } {
    const img = this.startImage
    const outdoor = this.geo ? this.geo.event(this.x & 15, this.y & 15) > 0x7f : false
    const i = this.read(outdoor ? 0x49fe : 0x49fd) & 7
    const sky = img ? img[T.ds + T.sky.at + i] : 0 // T.sky, eight colours twice over (needs START.EXE)
    const h = (this.regs.get(0xc05f) ?? 0xe8) & 0xff, f = (this.regs.get(0xc059) ?? 0xdb) & 0xff
    const line = h === 8 || h === 0x41 ? 0 : 15
    const band = h === 8 ? 8 : 7
    const floor = game().view.floor ?? (f === 0x0b ? 8 : f === 6 ? 1 : 6)
    return { sky, line, band, floor }
  }

  private clearFlags() {
    this.flags = { EQ: 0, NE: 0, LT: 0, GT: 0, LE: 0, GE: 0 }
  }

  /** Wall ahead and event byte (engine registers 0xC04E, 0xC04F). */
  square(): [number, number] {
    if (!this.geo) return [0, 0]
    return [this.geo.wall(this.x, this.y, this.facing), this.geo.event(this.x, this.y)]
  }

  // --------------------------------------------------------------- memory
  read(a: number): number {
    if (a === game().ecl.facingInA) return this.facing
    if (a >= A0 && a < 0x4d00) return this.A[a - A0]
    if (a >= B0 && a < 0x6f00) {
      const v = this.charRead(a - B0)
      return v ?? this.B[a - B0]
    }
    if (a >= C0 && a < CODE) return this.C[a - C0]
    if (a >= CODE && a < CODE_END) return this.code[a - CODE]
    switch (a) {
      case 0xc04b: return this.x
      case 0xc04c: return this.y
      case 0xc04d: return this.facing
      case 0xc04e: return this.square()[0]
      case 0xc04f: return this.square()[1]
      case 0x033d: return this.facing2
    }
    return this.regs.get(a) ?? 0 // undefined in the original
  }

  /** An opcode's store to an ECL variable: the write, seen by `trace.store` (the headless transcript, host-contracts.md §8). */
  private store(a: number, v: number) {
    this.write(a, v)
    this.trace.store?.(a, v & 0xffff)
  }

  write(a: number, v: number) {
    v &= 0xffff
    if (a >= A0 && a < 0x4d00) this.A[a - A0] = v
    else if (a >= B0 && a < 0x6f00) {
      this.B[a - B0] = v
      this.charWrite(a - B0, v)
    } else if (a >= C0 && a < CODE) this.C[a - C0] = v
    else if (a >= CODE && a < CODE_END) this.code[a - CODE] = v & 0xff
    else if (a === 0xc04b) this.x = v & 0xff
    else if (a === 0xc04c) this.y = v & 0xff
    else if (a === 0xc04d) this.facing2 = (v % 4) * 2
    else if ([0xc059, 0xc05f, 0x3de, 0xb8, 0xb9].includes(a)) this.regs.set(a, v)
  }

  /** B as a view of the current character (FUN_2fea_07bc). */
  private charRead(k: number): number | undefined {
    const c = this.cur
    const u16 = (o: number) => c[o] | (c[o + 1] << 8)
    const s8 = (o: number) => ((c[o] << 24) >> 24) & 0xffff
    const extra = game().ecl.viewReads[k]
    if (extra) return viewRead(extra, c)
    if (k === 0x18) return c[F.stat[4]]
    if (k === 0x9b) return c[F.saves + 1]
    if (k === 0xa0) return s8(F.hitDice)
    if (k >= 0xa5 && k <= 0xac) return c[F.thief + k - 0xa5]
    if (k === 0xb8) return c[F.morale]
    if (k >= 0xbb && k < 0xbb + 2 * game().ecl.moneyWords && !((k - 0xbb) & 1)) return u16(F.money + k - 0xbb)
    if (k === 0xd8) return s8(F.alignment)
    if (k === 0xf7) return u16(F.xpBase)
    if (k === 0xf9) return c[F.xpPerHp]
    if (k === 0x100) {
      if (game().ecl.view100.read === 'status') return c[F.status]
      const past = game().ecl.loadPastEnd && this.loadedPastEnd
      this.loadedPastEnd = false
      return past ? 0 : c[F.inPlay] === 0 ? 0x80 : 1
    }
    if (k === 0x10c) {
      if (c[F.side] === 0 && c[F.quick] !== 0) return 0x80
      return c[F.side] === 1 ? 0x81 : 0
    }
    if (k === 0x10d) return 0
    if (k === 0x11b) return c[F.move]
    if (k === 0x2b1 || k === 0x2b4) return Math.max(0, this.nodes.indexOf(c))
    if (k === 0x2cf) return R.chaReaction[c[F.stat[5]]] ?? 0
    if (k === 0x312) return game().ecl.blockFile.divide === 1 ? this.block : undefined
    return undefined
  }

  /** ADD_EP everyone, amount (SotSB 0x21324; EclMap.addExperience). */
  private async addExperience() {
    this.readops(2)
    const p = game().ecl.addExperience
    if (!p) return
    const all = this.val(1) !== 0, amount = this.val(2)
    const nameOf = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
    this.io.print(all ? text(p.party) : text(p.one) + nameOf(this.cur) + text(p.gains), false)
    for (const c of all ? this.party() : [this.cur]) {
      let n = 0
      for (let k = 0; k < p.classes; k++) if (((c[F.levels + k] << 24) >> 24) > 0) n++
      if (!n || !c[F.inPlay]) continue // no class level: the original divides by 0 (Bug, not met in play)
      const to = (((c[F.xp] | (c[F.xp + 1] << 8) | (c[F.xp + 2] << 16) | (c[F.xp + 3] << 24)) >>> 0) + Math.floor(amount / n)) >>> 0
      c[F.xp] = to & 0xff; c[F.xp + 1] = (to >> 8) & 0xff; c[F.xp + 2] = (to >> 16) & 0xff; c[F.xp + 3] = to >>> 24
    }
  }

  /** FUN_2fea_0a74 */
  /** The current character leaves the party (CotAB DROP_CHARACTER 0x3A275, PoR FUN_417f_3291(1, 0)); the one before becomes current. */
  private leaveParty() {
    const i = this.nodes.indexOf(this.cur)
    if (i < 0 || i >= this.party().length) return
    this.nodes.splice(i, 1)
    this.B[PARTY_SIZE - B0] = Math.max(0, this.B[PARTY_SIZE - B0] - 1)
    this.cur = this.nodes[Math.max(0, i - 1)] ?? this.cur
    this.savedCur = this.cur
  }
  private charWrite(k: number, v: number) {
    const c = this.cur
    const E = game().ecl, mv = E.memorisedView, extra = E.viewWrites[k]
    if (k === 0 && v === 0) this.leaveFlags[0] = true
    if (extra) {
      const at = F[extra.field] as number
      c[at] = v & 0xff
      if (extra.word) c[at + 1] = v >> 8
    } else if (k >= mv.from && k <= mv.to) c[F.memorised + k - mv.from + mv.offset] = v & 0xff
    else if (k === 0xb8) c[F.morale] = (v > 0xb2 ? v - 0x32 : v) & 0xff
    else if (k >= 0xbb && k < 0xbb + 2 * E.moneyWords && !((k - 0xbb) & 1)) {
      c[F.money + k - 0xbb] = v & 0xff
      c[F.money + k - 0xbb + 1] = v >> 8
    } else if (k === 0xf7) { c[F.xpBase] = v & 0xff; c[F.xpBase + 1] = v >> 8 }
    else if (k === 0xf9) c[F.xpPerHp] = v & 0xff
    else if (k === 0x100) {
      if (E.view100.write === 'okayInPlay') { if (v === 1) { c[F.status] = 0; c[F.inPlay] = 1 } }
      else {
        if (v === 0) this.leaveFlags[1] = true
        if (v > 0x7f) {
          c[F.inPlay] = 0
          if (v === 0x87) c[F.status] = 7
        }
      }
    } else if (k === 0x10c) {
      if (v === 0) { c[F.side] = 0; c[F.quick] = 0 }
      else if (v === 0x80) { c[F.side] = 0; c[F.quick] = 1 }
      else if (v === 0x81) { c[F.side] = 1; c[F.quick] = 1 }
    } else if (k === 0x312) this.setBlockValue(v)
    else if ((k === 0x322 || k === 0x324 || k === 0x326) && v > 0x80) {
      this.walls.load((k - 0x320) / 2, v & 0x7f)
      this.mapDirty = true
    }
  }

  private readString(a: number): string {
    if (a === B0) return String.fromCharCode(...this.cur.subarray(F.name + 1, F.name + 1 + this.cur[F.name]))
    const valid = (a >= A0 && a < 0x4d00) || (a >= B0 && a < 0x6f00) || (a >= C0 && a < CODE) || (a >= CODE && a < CODE_END)
    if (!valid) return ''
    let s = ''
    for (let i = 0; i < 255; i++) {
      const v = this.read(a + i) & 0xff
      if (!v) break
      s += String.fromCharCode(v)
    }
    return s
  }

  private storeString(a: number, s: string) {
    if (a === B0) {
      const n = s.slice(0, 15)
      this.cur[F.name] = n.length
      for (let i = 0; i < n.length; i++) this.cur[F.name + 1 + i] = n.charCodeAt(i)
      return
    }
    for (const ch of s) this.store(a++, ch.charCodeAt(0))
    this.store(a, 0)
  }

  // ------------------------------------------------------------- operands
  /** FUN_2fea_0000, entered with PC on the opcode byte. */
  private readops(n: number) {
    let k = 0
    this.opstr.clear()
    for (let i = 1; i <= n; i++) {
      const p = this.pc - CODE
      this.kind[i] = this.code[p + 1]
      this.lo[i] = this.code[p + 2]
      this.pc += 2
      if ([1, 2, 3, 0x81].includes(this.kind[i])) {
        this.hi[i] = this.code[this.pc - CODE + 1]
        this.pc += 1
      }
      if (this.kind[i] === 0x80) {
        k++
        const q = this.pc - CODE + 1
        this.sbuf[k] = unpackText(this.code.subarray(q, q + this.lo[i]))
        this.pc += this.lo[i]
        this.opstr.set(i, this.sbuf[k])
      } else if (this.kind[i] === 0x81) {
        k++
        this.sbuf[k] = this.readString(this.addr(i))
        this.opstr.set(i, this.sbuf[k])
      }
    }
    this.pc += 1
  }

  /** an operand as an address: the game's own numbering translated to the engine's (games/ecl.ts) */
  private addr(i: number) { return canonical(game().ecl, (this.hi[i] << 8) | this.lo[i]) }

  private val(i: number): number {
    const k = this.kind[i]
    if (k === 0) return this.lo[i]
    if (k === 1 || k === 3 || k === 0x80) return this.read(this.addr(i))
    if (k === 2) return (this.hi[i] << 8) | this.lo[i] // an immediate number
    if (k === 0x81) return this.addr(i)
    return 0
  }

  private text(i: number) { return this.opstr.get(i) ?? String(this.val(i)) }

  /** Variadic opcodes: fixed operands, then N more read into slots 1..N. */
  private variadic(fixed: number, countIndex: number) {
    this.readops(fixed)
    const n = this.val(countIndex) & 0xff
    const head = Array.from({ length: fixed }, (_, j) => ({
      addr: this.addr(j + 1),
      str: this.opstr.get(j + 1),
    }))
    this.pc -= 1
    this.readops(n)
    return { n, head }
  }

  private setFlags(a: number | string, b: number | string) {
    const f = this.flags
    f.EQ = +(a === b); f.NE = +(a !== b); f.LT = +(a < b)
    f.GT = +(a > b); f.LE = +(a <= b); f.GE = +(a >= b)
  }

  // -------------------------------------------------------------- running
  /** FUN_29c3_3171 */
  async run(start: number) {
    this.pc = start
    this.stop = false
    let steps = 0
    while (!this.stop && !this.quit) {
      if (++steps > 200000) throw new Error(`runaway script at ${this.pc.toString(16)}`)
      await this.step()
    }
  }

  /** the last instruction started (for error messages) */
  private lastPc = 0

  private async step() {
    const op = this.code[this.pc - CODE]
    if (op !== undefined) this.lastPc = this.pc
    const v = game().ecl.ops[op]
    if (v) return this.variant(v)
    switch (op) {
      case 0x00: this.readops(0); this.exit(); break
      case 0x01: this.readops(1); this.pc = this.addr(1); break
      case 0x02: this.readops(1); this.stack.push(this.pc); this.pc = this.addr(1); break
      case 0x03: {
        this.readops(2)
        if (this.kind[1] >= 0x80 || this.kind[2] >= 0x80) this.setFlags(this.sbuf[1], this.sbuf[2])
        else this.setFlags(this.val(1), this.val(2))
        break
      }
      case 0x04: this.readops(3); this.store(this.addr(3), this.val(1) + this.val(2)); break
      case 0x05: this.readops(3); this.store(this.addr(3), this.val(2) - this.val(1)); break
      case 0x06: {
        this.readops(3)
        if (this.val(2) === 0) throw new Error('DIVIDE by 0 (runtime error 200 in the original)')
        this.store(this.addr(3), Math.floor(this.val(1) / this.val(2)))
        break
      }
      case 0x07: this.readops(3); this.store(this.addr(3), this.val(1) * this.val(2)); break
      case 0x08: {
        this.readops(2)
        let m = this.val(1) & 0xff
        if (m < 255) m++
        this.store(this.addr(2), this.rand(m))
        break
      }
      case 0x09: {
        this.readops(2)
        if (this.kind[1] < 0x80) this.store(this.addr(2), this.val(1))
        else this.storeString(this.addr(2), this.sbuf[1])
        break
      }
      case 0x0a: {
        this.readops(1)
        this.restoreCur = true
        const n = this.val(1) & 0x7f
        if (n < this.nodes.length) this.cur = this.nodes[n]
        this.loadedPastEnd = n >= this.nodes.length
        // 0x19F92: with bit 7 and both leave flags, the current character leaves the party (an NPC's
        // farewell, e.g. ECL3 #0 0xAD56): not restored at EXIT if it was the saved one (DS:4430 := 0)
        if (this.val(1) & 0x80 && this.leaveFlags[0] && this.leaveFlags[1]) {
          if (this.savedCur === this.cur) this.restoreCur = false
          this.leaveParty()
          this.leaveFlags = [false, false]
        }
        break
      }
      case 0x0b: await this.loadMonster(); break
      case 0x0c: {
        this.readops(3)
        this.B[SPRITE_MAX - B0] = this.val(2)
        this.B[SPRITE_DIST - B0] = Math.min(this.val(2), this.ahead())
        this.spriteNow = { sprite: this.val(1), picture: this.val(3) }
        this.io.sprite(this.val(1), this.val(3), this.B[SPRITE_DIST - B0])
        break
      }
      case 0x0d: {
        this.readops(0)
        if (this.B[SPRITE_DIST - B0]) {
          this.B[SPRITE_DIST - B0]--
          this.io.sound(10, 'transient') // not in the original: a footstep as the sprite approaches (IMP-014), cut as PoR's footsteps
          if (this.spriteNow) this.io.sprite(this.spriteNow.sprite, this.spriteNow.picture, this.B[SPRITE_DIST - B0])
        }
        break
      }
      case 0x0e: {
        this.readops(1)
        const n = this.val(1)
        if (n !== 255) this.pictureDrawn = true
        if (n === 255) {
          this.spriteNow = null
          this.io.picture(null)
        } else if (this.B[PORTRAIT - B0] === 0xff) {
          const big = game().view.bigFrom
          this.io.picture(big !== null && n >= big ? { big: n } : { pic: n }) // CotAB: full-width BIGPIC from 0x78
        }
        else this.io.picture({ head: this.B[PORTRAIT - B0], body: n })
        break
      }
      case 0x0f: this.readops(2); this.store(this.addr(2), (await this.io.inputNumber()) & 0xffff); break
      case 0x10: {
        this.readops(2)
        const s = (await this.io.inputText()).toUpperCase().slice(0, 40) || ' '
        this.storeString(this.addr(2), s)
        break
      }
      // PRINT goes on from the cursor, PRINT_CLEAR from (1, 17) of a cleared window (SotSB 0x1E5FD, CotAB
      // 0x192D6); the text routine moves to the next row only past the right edge (SotSB 0x5B29)
      case 0x11: this.readops(1); this.io.print(this.text(1), false, this.cursor.open); this.cursor = { col: 1, row: 17, open: true }; break
      case 0x12: this.readops(1); this.io.print(this.text(1), true, false); this.cursor = { col: 1, row: 17, open: true }; break
      case 0x13: this.readops(0); if (this.stack.length) this.pc = this.stack.pop()!; break
      case 0x14: {
        this.readops(4)
        this.clearFlags()
        if (this.val(1) === this.val(2) && this.val(3) === this.val(4)) this.flags.EQ = 1
        else this.flags.NE = 1
        break
      }
      case 0x15: {
        const { n, head } = this.variadic(3, 3)
        const items = Array.from({ length: n }, (_, i) => this.text(i + 1))
        if (head[1].str) this.io.print(head[1].str, true)
        this.store(head[0].addr, await this.io.menu(items, { vertical: true }))
        break
      }
      case 0x16: case 0x17: case 0x18: case 0x19: case 0x1a: case 0x1b: {
        this.readops(0)
        const flag = (['EQ', 'NE', 'LT', 'GT', 'LE', 'GE'] as const)[op - 0x16]
        if (!this.flags[flag]) {
          const next = this.code[this.pc - CODE]
          const n = game().ecl.skip[next] ?? SKIP[next]
          if (n !== undefined) this.readops(n)
          else this.pc += 1
        }
        break
      }
      case 0x1c: {
        this.readops(0)
        this.monsters = 0; this.monstersLoaded = false; this.iconSlot = 8
        this.money = [0, 0, 0, 0, 0, 0, 0]
        this.treasure = []
        break
      }
      case 0x1d: {
        this.readops(1)
        let t = 0
        for (const c of this.nodes) {
          t = (t + Math.floor((c[F.hp] + 5 * Math.max(c[F.ac] - 60, 0) + 5 * Math.max(c[F.thac0] - 39, 0)
            + 8 * (classLevel(c, 5) & 0xff) + 4 * (classLevel(c, 0) & 0xff)) / 10)) & 0xff // levels with any dual-class part (CotAB)
        }
        this.store(this.addr(1), t)
        break
      }
      case 0x1e: {
        this.readops(6)
        const sel = this.kind[1] === 1 ? this.addr(1) : this.val(1)
        const dest = [3, 4, 5, 6].map((i) => this.addr(i))
        const cp = game().ecl.checkParty
        if (cp) { this.checkPartyStats(cp, dest); break }
        let vals: number[]
        // selector 0: does anyone have effect e (FUN_10ba_2199)? Used with 0x13 Find Traps
        if (sel === 0) { const e = this.val(2) & 0xff; vals = [0, 0, 0, +this.nodes.some((c) => this.effectsOf(c).some((x) => x.type === e))] }
        else if (sel === 0x6ba7 || sel === 0x6c1b) {
          const off = sel === 0x6ba7 ? F.thief + 2 : F.move
          const xs = this.nodes.map((c) => c[off])
          vals = [Math.min(...xs), Math.max(...xs), Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length), 0]
        } else break
        dest.forEach((d, i) => this.store(d, vals[i]))
        break
      }
      case 0x20: {
        this.readops(1)
        this.A[AREA_ID - A0] = this.area
        this.area = this.val(1)
        this.loadEcl(this.area)
        this.resetVm(false)
        this.stop = true
        this.areaChanged = true
        break
      }
      case 0x21: {
        this.wallsLoaded = true
        this.readops(3)
        const b1 = this.val(1) & 0xff
        if (b1 !== 0xff && b1 !== 0x7f && this.A[NO_OVERLAND - A0]) {
          this.A[GEO_ID - A0] = b1
          this.loadGeo(b1)
          this.B[CANCEL_MOVE - B0] = 0
        }
        break
      }
      case 0x22: {
        this.readops(2)
        this.store(this.addr(1), +this.nodes.some((c) => c[F.cls] === 4 || c[F.cls] === 10))
        this.store(this.addr(2), 0)
        break
      }
      case 0x23: {
        this.readops(4)
        const v = [1, 2, 3, 4].map((i) => this.val(i) & 0xff)
        const s8 = (n: number) => ((n & 0xff) << 24) >> 24
        const a = s8(v[3] + 2 - v[0]), b = s8(v[1] + 2 - v[2])
        const r1 = this.roll(1, 6), r2 = this.roll(1, 6)
        let res = 0
        if (r1 <= a) res = r2 <= b ? 3 : 1
        if (r2 <= b) res = 2
        this.store(SURPRISE_RESULT, res)
        break
      }
      case 0x24: await this.combat(); break
      case 0x25: case 0x26: {
        this.readops(2)
        const i = this.val(1) & 0xff, n = this.val(2) & 0xff
        this.pc -= 1
        this.readops(n)
        if (i < n) {
          if (op === 0x26) this.stack.push(this.pc)
          this.pc = this.addr(i + 1)
        }
        break
      }
      case 0x27: {
        this.readops(8)
        this.money = [1, 2, 3, 4, 5, 6, 7].map((i) => this.val(i))
        const n = this.val(8) & 0xff
        if (n < 0x80) {
          // ITEM<block> record, each item prepended (so the list ends up reversed)
          for (const it of parseItems(this.files.record(`ITEM${this.block}`, n))) this.treasure.unshift(it)
        } else if (n !== 0xff && this.startImage) randomTreasure(n - 0x80, (sides) => this.roll(1, sides), this.startImage, this.treasure)
        break
      }
      case 0x28: {
        this.readops(3)
        // ROB (FUN_29c3_1db1): the third operand is never read
        const p0 = this.val(2) & 0xff
        for (const c of (this.val(1) & 0xff) === 0 ? [this.cur] : this.nodes) {
          for (let j = 0; j < 7; j++) {
            const o = F.money + 2 * j
            const v = Math.floor(((c[o] | (c[o + 1] << 8)) * (100 - p0)) / 100)
            c[o] = v & 0xff; c[o + 1] = v >> 8
          }
          // items (FUN_2fea_1df0): heavy ones are harder to take, and the lower chance carries on down the list
          const items = this.itemsOf(c)
          let p = p0
          for (const it of [...items]) {
            const w = it.raw[0x37] | (it.raw[0x38] << 8)
            if (w > 255) p = p > 90 ? p - 90 : 0
            else if (w > 24) p = p > 50 ? p - 50 : 0
            if (this.roll(1, 100) <= p) items.splice(items.indexOf(it), 1)
          }
          if (this.items) recalc(c, items, this.items) // IMP-049: the original leaves the stats of a stolen readied item
        }
        break
      }
      case 0x29: await this.encounterMenu(); break
      case 0x2a: this.readops(3); this.store(this.addr(3), this.read(this.addr(1) + (this.val(2) & 0xff))); break
      case 0x2b: {
        const { n, head } = this.variadic(2, 2)
        const items = Array.from({ length: n }, (_, i) => this.text(i + 1))
        this.store(head[0].addr, (await this.io.menu(items)) & 0xff)
        break
      }
      case 0x2c: {
        this.readops(6)
        // the game's "~HAUGHTY ~SLY ~NICE ~MEEK ~ABUSIVE" (FUN_29c3_25cb, CotAB 0x1B007), by the ECL menu rule
        const w = menuItems(gameMenu('parlay'))
        const c = await this.io.menu(w.labels, { keys: w.keys })
        this.store(this.addr(6), this.val(c + 1) & 0xff)
        break
      }
      case 0x2d: await this.call(); break
      case 0x2e: await this.damage(); break
      case 0x2f: case 0x30: {
        this.readops(3)
        const r = (op === 0x2f ? this.val(1) & this.val(2) : this.val(1) | this.val(2)) & 0xff
        this.setFlags(0, r)
        this.store(this.addr(3), r)
        break
      }
      case 0x31: // REDRAW (FUN_29c3_2aa2): the view again, if the encounter drawer drew over it
        this.readops(0)
        if (this.spriteNow) { this.spriteNow = null; this.io.picture(null) }
        break
      case 0x32: { // FIND_ITEM: EQ if anyone carries an item of the type
        this.readops(1)
        const t = this.val(1) & 0xff
        const found = this.nodes.some((c) => this.itemsOf(c).some((it) => it.type === t))
        this.clearFlags()
        if (found) this.flags.EQ = 1
        else this.flags.NE = 1
        break
      }
      case 0x33: // NEWLINE: ends the line; on an empty one, a blank line
        this.readops(0)
        if (!this.cursor.open) this.io.print('\u00a0', false)
        this.cursor = { col: 1, row: this.cursor.row + 1, open: false }
        break
      case 0x34: this.readops(1); break // DELAY: the one use (ECL7) waits 0 minutes
      case 0x35: this.readops(3); this.store((this.addr(2) + this.val(3)) & 0xffff, this.val(1)); break
      case 0x36: this.readops(2); this.addNpc(this.val(1), this.val(2)); await this.io.refresh(); break
      case 0x37: this.loadWallsets(); break
      case 0x38: await this.program(); break
      case 0x39: {
        this.readops(1)
        const names = this.nodes.slice(0, this.B[PARTY_SIZE - B0] || this.nodes.length)
          .map((c) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name])))
        this.cur = this.nodes[await this.io.menu(names, { prompt: this.text(1), vertical: true })]
        break
      }
      case 0x3a: this.readops(0); await this.io.pause(this.speed * game().ecl.pauseMs); break // PAUSE (FUN_1709_0dbe, CotAB 0x1B15B)
      case 0x3b: {
        this.readops(3)
        // the original writes both results to engine space (addr & 0xFF): they are lost
        break
      }
      case 0x3c: { // PRINT_LIST (FUN_29c3_2e7d): font glyphs byte + 1, up to 0 or 0xFF
        this.readops(1)
        const codes: number[] = []
        for (let a = this.addr(1); codes.length < 80; a++) {
          const b = this.read(a) & 0xff
          if (b === 0 || b === 0xff) break
          codes.push(b + 1)
        }
        if (this.topCleared && this.cursor.row > 13) this.cursor = { col: 2, row: 5, open: false }
        this.io.glyphs?.(codes, this.topCleared ? { col: this.cursor.col, row: this.cursor.row } : null)
        this.cursor = { col: this.cursor.col + codes.length, row: this.cursor.row + 1, open: false }
        break
      }
      case 0x3d: this.readops(0); this.topCleared = true; this.io.clearTop?.(true); break // CLEAR_TOP (FUN_29c3_2b14)
      default: throw new Hang(op === undefined ? `jump outside the script to ${native(game().ecl, this.pc).toString(16)} from the instruction at ${native(game().ecl, this.lastPc).toString(16)}` : `no handler for opcode ${op.toString(16)} at ${native(game().ecl, this.pc).toString(16)}`)
    }
  }

  private spriteNow: { sprite: number; picture: number } | null = null
  /** the view drawn again: pictures and encounter sprites go (see Io.clearView) */
  /** a PICTURE was drawn since the view was (CotAB DS:8B7C) */
  private pictureDrawn = false
  /** the last LOAD_CHARACTER was past the end of the list (CotAB DS:8B87) */
  private loadedPastEnd = false
  /** LOAD_AREA or LOAD_WALLSETS has run in this area (CotAB DS:47FB) */
  private wallsLoaded = false
  private clearPictures() {
    this.pictureDrawn = false
    this.spriteNow = null
    this.drawnView = this.viewKey()
    this.io.clearView?.()
  }
  /** where the view was last drawn from, for CALL 0x2C90's "if anything changed" */
  private drawnView = ''
  private viewKey() { return `${this.block}:${this.area}:${this.x}:${this.y}:${this.facing2}:${this.overland ? this.wildPosition.join(',') : ''}` }
  /** CLEAR_TOP's DS:84DE: PRINT_LIST then draws in the view */
  private topCleared = false
  /** the text cursor, as far as PRINT_LIST and NEWLINE need it */
  private cursor = { col: 1, row: 17, open: false }

  private exit() {
    if (this.topCleared) { this.topCleared = false; this.io.clearTop?.(false) } // DS:84DE
    this.cursor = { col: 1, row: 17, open: false }
    if (this.restoreCur) {
      this.cur = this.savedCur
      this.restoreCur = false
    }
    this.stop = true
    this.stack = []
  }

  private ahead(): number {
    if (this.A[NO_OVERLAND - A0] === 0 || !this.geo) return 2
    let x = this.x, y = this.y, n = 0
    while (n < 2 && this.geo.passage(x, y, this.facing) === 1) {
      const [dx, dy] = STEP[this.facing]
      x = (x + dx) & 15; y = (y + dy) & 15; n++
    }
    return n
  }

  private loadWallsets() {
    this.wallsLoaded = true
    this.readops(3)
    const b = [1, 2, 3].map((i) => this.val(i) & 0xff)
    if (b[0] === 0x7f) this.walls.load(1, 0)
    else if (this.A[0x49e7 - A0] && this.A[0x49e8 - A0]) {
      const none = game().ecl.wallSetNone
      for (const i of [0, 2]) if (!none.includes(b[i]) || !game().ecl.twoSlotSkipsFF) this.walls.load(i + 1, b[i])
    } else b.forEach((r, i) => { if (!game().ecl.wallSetNone.includes(r)) this.walls.load(i + 1, r); else this.walls.clear(i + 1) })
    this.mapDirty = true
  }

  private async loadMonster() {
    this.readops(3)
    this.addMonsters(this.val(1), this.val(2), this.val(3))
  }

  /** CHECK_PARTY by the selector's offset from B (SotSB 0x1F051, games/ecl.ts `checkParty`). */
  private checkPartyStats(cp: NonNullable<ReturnType<typeof game>['ecl']['checkParty']>, dest: number[]) {
    const s8 = (v: number) => (v << 24) >> 24
    const s = this.kind[1] === 1 ? (this.addr(1) - B0) & 0xffff : (this.val(1) - game().ecl.b) & 0xffff
    const v2 = this.val(2) & 0xff
    const party = this.party()
    const byteOf = (field: keyof typeof F, index: number) => {
      const f = F[field] as number | number[]
      return Array.isArray(f) ? f[index] : f + index
    }
    let min = 0xff, max = 0, sum = 0, count = 0, found = 0
    // unsigned bytes against min 0xFF and max 0 (0x1F212); class levels signed, so min (0xFF = −1) moves only
    // below −1 and stays 0xFF in play, and only levels of at least operand 2 count for min and max (0x1F3CF)
    const stats = (val: (c: Uint8Array) => number, signed = false, from = 0) => {
      for (const c of party) {
        const v = val(c)
        count++; sum += v
        if (signed) {
          if (v < from) continue
          if (v < s8(min)) min = v & 0xff
          if (v > s8(max)) max = v & 0xff
        } else { if (v < min) min = v; if (v > max) max = v }
      }
    }
    if (s === cp.effect) { found = +party.some((c) => this.effectsOf(c).some((x) => x.type === v2)); min = max = 0 }
    else if (cp.equals[s]) { const off = byteOf(cp.equals[s], 0); found = +party.some((c) => c[off] === v2) }
    else if (cp.bytes[s]) { const off = byteOf(...cp.bytes[s]); stats((c) => c[off]) }
    else if (s >= cp.range.from && s <= cp.range.to) { const off = byteOf(cp.range.field, s - cp.range.from); stats((c) => c[off]) }
    else if (cp.levels[s] !== undefined) {
      const k = cp.levels[s], minLevel = s8(v2)
      stats((c) => {
        let L = s8(c[F.levels + k])
        if (F.prevLevels >= 0 && s8(c[F.prevLevels + k]) > L && formerLevelsCount(c)) L = s8(c[F.prevLevels + k])
        return L
      }, true, minLevel)
    } else return
    const avg = count ? Math.trunc(sum / count) & 0xff : 0 // the 'equals' case leaves it unset (0 here)
    ;[min & 0xff, max & 0xff, avg, s8(found) & 0xffff].forEach((v, i) => this.store(dest[i], v))
  }

  /** LOAD_MONSTER: append copies of MON<block>CHA record `id` with their items and effects. */
  addMonsters(id: number, n: number, picture: number) {
    if (this.monsters >= 63) return
    const raw = this.files.record(`MON${game().ecl.monsterFile ?? this.block}CHA`, id)
    if (!raw) return
    const count = Math.max(n, 1)
    const items = this.files.record(`MON${game().ecl.monsterFile ?? this.block}ITM`, id)
    const spc = this.files.record(`MON${game().ecl.monsterFile ?? this.block}SPC`, id)
    for (let i = 0; i < count && this.monsters < 63; i++) {
      const m = this.monsterRecord(raw)
      this.scaleForDifficulty(m)
      m[F.iconSlot] = this.iconSlot
      this.nodes.push(m)
      this.inventory.set(m, parseItems(items))
      this.effects.set(m, parseEffects(spc))
      this.combatPicture.set(m, picture)
      this.monsters++
    }
    this.iconSlot++
    this.monstersLoaded = true
  }

  /**
   * The difficulty (R.difficulty; SotSB LOAD_MONSTER 0x1DF9F–0x1E036): a side-1 monster's HP and max HP
   * × (level + 2) div 4 as bytes, for a level 0–4; both 1 when either comes to 0.
   */
  private scaleForDifficulty(m: Uint8Array) {
    const d = R.difficulty
    if (!d || m[F.side] !== 1) return
    const lv = this.read(d.variable)
    if (lv > 4) return
    m[F.hp] = Math.floor((m[F.hp] * (lv + 2)) / 4) & 0xff
    m[F.maxHp] = Math.floor((m[F.maxHp] * (lv + 2)) / 4) & 0xff
    if (!m[F.hp] || !m[F.maxHp]) { m[F.hp] = 1; m[F.maxHp] = 1 }
  }

  /** A record as stored in MON<block>CHA, the record's size taken (CotAB's loader 0x3565C). */
  private storedRecord(raw: Uint8Array) {
    const m = new Uint8Array(F.size)
    m.set(raw.subarray(0, F.size))
    return m
  }

  /** A monster record as the loader leaves it (FUN_45c5_0ec4): icon size by race, random icon colours. */
  private monsterRecord(raw: Uint8Array) {
    const m = this.storedRecord(raw)
    const race = m[F.race]
    if ([1, 3, 5].includes(race)) m[F.iconSize] = 1
    else if ([2, 4, 6, 7].includes(race)) m[F.iconSize] = 2
    const colour = () => { const d = this.roll(1, 6); return ((d + 8) << 4) + d }
    for (const k of [1, 2, 3]) m[F.iconColours + k - 1] = colour()
    m[F.iconColours + 3] = 0xc4
    for (const k of [5, 6]) m[F.iconColours + k - 1] = colour()
    return m
  }

  /** DS:6DDE–6DE0: whether Bash, Pick and Knock are still offered at a locked door; all set again by every step */
  doorTries = { bash: true, pick: true, knock: true }

  /**
   * The locked-door menu (FUN_3e76_0d6d; spec/A-games/engine/main-loop.md, "Moving"). Passage 2 is an ordinary
   * locked door, 3 one that cannot be picked and needs great strength. Returns true when the party
   * gets through: Bash and Pick unlock the door on both sides (FUN_3e76_0109), Knock only lets the
   * party through this once. Every party entry tries in list order until one succeeds.
   */
  private async lockedDoor(kind: number): Promise<boolean> {
    const list = this.nodes
    const s8 = (v: number) => (v << 24) >> 24
    // CotAB 0x2F185: a former class counts once its levels do
    const hasClass = (k: number) => list.some((c) => s8(c[F.levels + k]) > 0 || (formerLevelsCount(c) && s8(c[F.prevLevels + k]) > 0))
    const knockCaster = () => list.find((c) => Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k]).includes(0x1f))
    // the game's pieces, each when it applies: "Bash", " Pick", " Knock", then " Exit"
    const words = [...(this.doorTries.bash ? gameMenu('doorBash') : []), ...(this.doorTries.pick && hasClass(6) ? gameMenu('doorPick') : []),
      ...(this.doorTries.knock && (kind === 2 ? !!knockCaster() : hasClass(5)) ? gameMenu('doorKnock') : [])]
    if (!words.length) return false // FUN_3e76_0000: nothing left to try
    const k = (await ask((l, o) => this.io.menu(l, o), [...words, ...gameMenu('doorExit')], { prompt: msg('locked').trimEnd() })).toLowerCase()
    let ok = false
    if (k === 'b') ok = this.bashDoor(kind)
    else if (k === 'p') {
      // FUN_3e76_04df: each member rolls d100 against Open Locks (char[0x78]) while conscious; one try per door
      if (kind === 2) ok = list.some((c) => c[F.status] === 0 && this.roll(1, 100) <= c[F.thief + 1])
      this.doorTries.pick = false
    } else if (k === 'k') {
      // FUN_3e76_0648: a member with Knock memorised casts it; the door is passed, not unlocked
      const c = knockCaster()
      if (c) { const at = Array.from({ length: F.memorisedCount }, (_, j) => c[F.memorised + j]).indexOf(0x1f); c[F.memorised + at] = 0; ok = true }
    }
    if (ok && k !== 'k' && this.geo) {
      const [dx, dy] = STEP[this.facing]
      this.geo.setPassage(this.x, this.y, this.facing, 1)
      const nx = this.x + dx, ny = this.y + dy
      if (nx >= 0 && nx <= 15 && ny >= 0 && ny <= 15) this.geo.setPassage(nx, ny, (this.facing + 2) % 4, 1)
    }
    return ok
  }

  /**
   * Bash (FUN_3e76_0294): every party entry in turn, by STR (char[0x10], percentile char[0x16]).
   * Ordinary door: STR 3–7 d6 = 1, 8–15 d6 ≤ 2, 16–17 d6 ≤ 3, 18/01–50 d6 ≤ 3, 18/51–99 d6 ≤ 4,
   * 18/00 d6 ≤ 5; STR 19 and above never succeed (bug, kept). Door 3: 18/91–99 d6 = 1, 18/00 d6 ≤ 2,
   * 19–20 d6 ≤ 3, 21–22 d6 ≤ 4, 23 d6 ≤ 5, 24 d8 ≤ 7, 25 always; anyone weaker takes Bash off the menu.
   */
  private bashDoor(kind: number): boolean {
    for (const c of this.nodes) {
      const str = c[F.stat[0]], pct = c[F.strPct]
      const d6 = () => this.roll(1, 6)
      let ok = false
      if (kind === 3) {
        if (str === 18 && pct >= 91 && pct <= 99) ok = d6() === 1
        else if (str === 18 && pct === 100) ok = d6() <= 2
        else if (str === 19 || str === 20) ok = d6() <= 3
        else if (str === 21 || str === 22) ok = d6() <= 4
        else if (str === 23) ok = d6() <= 5
        else if (str === 24) ok = this.roll(1, 8) <= 7
        else if (str === 25) ok = true
        else this.doorTries.bash = false
      } else {
        if (str >= 3 && str <= 7) ok = d6() === 1
        else if (str >= 8 && str <= 15) ok = d6() <= 2
        else if (str === 16 || str === 17) ok = d6() <= 3
        else if (str === 18 && pct <= 50) ok = d6() <= 3
        else if (str === 18 && pct <= 99) ok = d6() <= 4
        else if (str === 18 && pct === 100) ok = d6() <= 5
      }
      if (ok) return true
    }
    return false
  }

  /**
   * ADD_NPC (PoR handler 29c3:2B7E, loader FUN_45c5_1262; CotAB 0x1B61A, 0x3593D): monster record `id`
   * of this block joins the end of the party (at most 8) and becomes the current character; morale
   * char[0x84] = (morale >> 1) | 0x80. What else the game does is its `ecl.addNpc`: the loader's
   * icon rolls, the identity tag, the enemy side for one monster id; and, where the game has the NPC
   * portrait tables, a random portrait for a class among its levels and its gender.
   */
  addNpc(id: number, morale: number) {
    const party = this.party()
    const how = game().ecl.addNpc
    if (party.length <= 7) {
      const raw = this.files.record(`MON${game().ecl.monsterFile ?? this.block}CHA`, id)
      if (!raw) { this.io.print(msg('noMonster'), false); return }
      const c = how.loaderRolls ? this.monsterRecord(raw) : this.storedRecord(raw)
      c[F.id] = how.tag === 'random' ? this.rand(256) : id
      const img = this.startImage
      if (img && T.npcHeads.at >= 0) {
        const classes = [0, 1, 2, 3, 4, 5, 6].filter((k) => ((c[F.levels + k] << 24) >> 24) > 0)
        const cls = classes.length ? classes[this.roll(1, classes.length) - 1] : 2
        const tb = (o: number) => img[T.ds + o]
        const g = c[F.gender]
        const body = cls === 0 ? T.npcBodiesCleric : cls === 5 ? T.npcBodiesMagicUser : cls === 6 ? T.npcBodiesThief : T.npcBodiesFighter
        c[F.body] = tb(body.at + g * 5 + this.roll(1, 5))
        c[F.head] = tb(T.npcHeads.at + g * 8 + this.roll(1, 8))
      }
      // in the demo a few NPCs take another picture (SotSB 0x4181F; startup.ts npcPictures)
      if (how.iconPicture) this.combatPicture.set(c, this.demo?.npcPictures.find(([m]) => m === id)?.[1] ?? id)
      const n = party.length
      this.nodes.splice(n, 0, c)
      this.B[PARTY_SIZE - B0] = n + 1
      this.inventory.set(c, parseItems(this.files.record(`MON${game().ecl.monsterFile ?? this.block}ITM`, id)))
      this.effects.set(c, parseEffects(this.files.record(`MON${game().ecl.monsterFile ?? this.block}SPC`, id)))
      this.cur = c
    }
    // the handler then writes to whoever is current (unchanged when the party was full)
    this.cur[F.morale] = (morale >> 1) | 0x80
    if (how.enemyId !== null) this.cur[F.side] = id === how.enemyId ? 1 : 0
    if (this.items) recalc(this.cur, this.itemsOf(this.cur), this.items)
  }

  private startImageCache: Uint8Array | null | undefined
  /** START.EXE's load image (data segment tables); null when missing. */
  get startImage(): Uint8Array | null {
    if (this.startImageCache === undefined) {
      const exe = this.files.get('START.EXE')
      try { this.startImageCache = exe ? unexepack(exe).image : null } catch { this.startImageCache = null }
      if (this.startImageCache) installNames(this.startImageCache)
    }
    return this.startImageCache
  }

  /**
   * CALL 0x8000 (duel) / 0x8001 (solo combat): everyone but the current character sits out
   * (char[0x10D] = 0). For a duel a copy of the current character named ROLF, with its items,
   * joins the monsters on computer control (enemy side, morale 0xB2) and ECL 0x6DE6 = 1.
   */
  setupDuel(copy: boolean) {
    const me = this.cur
    for (const c of this.party()) if (c !== me) c[F.inPlay] = 0
    this.duel = true
    this.duelist = me
    this.B[0x6de6 - B0] = copy ? 1 : 0
    if (!copy) return
    const r = me.slice()
    const nm = 'ROLF'
    r.fill(0, F.name, F.name + 16)
    r[F.name] = nm.length
    for (let i = 0; i < nm.length; i++) r[F.name + 1 + i] = nm.charCodeAt(i)
    r[F.side] = 1; r[F.quick] = 1; r[F.morale] = 0xb2
    this.nodes.push(r)
    this.combatPicture.set(r, 11) // FUN_2fea_1a6f: ROLF's combat icon is CPIC<block> #11 / #139
    this.inventory.set(r, this.itemsOf(me).map((it) => it.copy()))
    this.effects.set(r, [])
    this.monsters++
    this.monstersLoaded = true
  }

  /** COMBAT as a script makes it, outside a script (the headless runner's `combat`, host-contracts.md §8.1) */
  async combatNow() { await this.combat() }

  private async combat() {
    this.readops(0)
    const vault = game().ecl.combatVault
    if (!this.monstersLoaded && !this.duel) {
      if (vault !== null && this.read(vault) === 1) {
        this.write(vault, 0)
        await this.io.engine('vault') // SotSB 0x1F5C2 → 0x21C90
      } else if (this.B[SHOP_FLAG - B0] === 1) {
        this.B[SHOP_FLAG - B0] = 0
        await this.io.engine('shop')
      } else if (this.B[TEMPLE_FLAG - B0] === 1) {
        this.B[TEMPLE_FLAG - B0] = 0
        await this.io.engine('temple')
      } else if (this.treasure.length || this.money.some((v) => v > 0)) await this.io.engine('treasure')
    } else {
      const names = this.nodes.slice(this.nodes.length - this.monsters)
        .map((m) => String.fromCharCode(...m.subarray(F.name + 1, F.name + 1 + m[F.name])))
      await this.io.engine('combat', { monsters: [...new Set(names)].join(', '), count: names.length })
      if (this.monstersLoaded) {
        // no battle screen (headless): the party is treated as winning
        this.B[OUTCOME - B0] = 0
        this.B[DEFEATED - B0] = this.monsters
        this.nodes.splice(this.nodes.length - this.monsters)
        this.monsters = 0
        this.monstersLoaded = false
        for (const a of [0x6de3, 0x6de6, 0x6e70, 0x6e71, 0x6e72]) this.B[a - B0] = 0
      }
      if (this.duel) for (const c of this.party()) if (c[F.status] <= 1) c[F.inPlay] = 1
    }
    this.duel = false
    this.duelist = null
    this.B[SEARCH_LOOK - B0] &= 1
  }

  private async encounterMenu() {
    this.readops(14)
    const moves = this.nodes.map((c) => c[F.move])
    const slow = Math.min(...moves), fast = Math.max(...moves)
    const r = [5, 6, 7, 8, 9].map((i) => this.val(i) & 0xff)
    const texts = [10, 11, 12].map((i) => this.opstr.get(i) ?? '')
    const f = this.val(13), g = this.val(14), dest = this.addr(4)
    const sprite = this.val(1), picture = this.val(3)
    let dist = Math.min(this.val(2), this.ahead())
    this.B[SPRITE_DIST - B0] = dist
    this.spriteNow = { sprite, picture }
    for (let guard = 0; guard < 100; guard++) {
      this.io.sprite(sprite, picture, dist)
      const t = [0, 1, 2].map((j) => texts[(dist + j) % 3]).find((s) => s)
      if (t) this.io.print(t, true)
      const close = dist === 0 || this.A[NO_OVERLAND - A0] === 0
      // the game's "~COMBAT ~WAIT ~FLEE ~PARLAY" or "… ~ADVANCE" (FUN_29c3_1ef8, CotAB 0x1A90D), by the ECL menu rule
      const w = menuItems(gameMenu(close ? 'encounterParlay' : 'encounterAdvance'))
      let c = await this.io.menu(w.labels, { keys: w.keys })
      if (c === 3 && close) c = 4
      if (r[c] >= 5) return
      const act = ENCOUNTER[r[c]][c]
      let v: number
      if (act === 'wait') { this.io.print(msg('bothWait'), false); continue }
      if (act === 'approach' || (act === 'parlay' && dist > 0)) {
        if (dist === 0) this.io.print(msg('bothWait'), false)
        else { dist--; this.B[SPRITE_DIST - B0] = dist }
        continue
      }
      if (act === 'parlay') v = 3
      else if (act === 'flee') v = slow < f ? 1 : 2
      else if (act === 'pursue') v = fast < g ? 0 : 1
      else v = act
      if (v === 0) this.io.print(msg('monstersFlee'), false)
      this.store(dest, v)
      return
    }
  }

  /**
   * DAMAGE (PoR 0x1C3A5, CotAB 0x1B1A8, spec/A-games/engine/ecl.md row 2E): one damage roll for every victim of a
   * save mode, rolled again after each attack in attack mode; the dead are skipped; "dies." when the
   * damage exceeds HP + 10; the press-Enter prompt always. CotAB's flag 0x10 hurts despite a save.
   */
  private async damage() {
    this.readops(5)
    const [flags, count, sides, bonus, save] = [1, 2, 3, 4, 5].map((i) => this.val(i) & 0xff)
    const size = this.B[PARTY_SIZE - B0] & 0xff
    const roll = () => (this.roll(count, sides) & 0xff) + bonus // the dice sum is a byte
    const each = game().ecl.damageRolls === 'perVictim' // SotSB: a roll per victim, after the pick
    let dmg = each ? 0 : roll()
    const despite = (flags & game().ecl.damageDespiteSave) !== 0
    const host = new WorldHost(this)
    const s8 = (v: number) => (v << 24) >> 24
    // the save (0x42EC3 / 0x4BDA1): 1 fails, 20 succeeds, else the effects' event 12, byte compare
    const saved = (c: Uint8Array, kind: number, b: number) => {
      fx.saved = true // CotAB DS:6FC2 (0x4BDA1): set while event 12 runs, then the outcome
      const r = this.roll(1, 20)
      if (r === 1) return (fx.saved = false)
      if (r === 20) return (fx.saved = true)
      fx.save = r + s8(c[F.saveBonus]) + b
      fx.saveType = kind
      void fire(host, c, 12)
      return (fx.saved = c[F.saves + kind] <= (fx.save & 0xff))
    }
    // the attack (0x42DAF / 0x4BC8D): 1 misses, 20 counts 100, the effects' event 16, against AC
    const hit = (c: Uint8Array) => {
      let r = this.roll(1, 20)
      if (r <= 1) return false
      if (r === 20) r = 100
      fx.roll = r
      void fire(host, c, 16)
      if (fx.roll < 0) return false
      return s8(fx.roll) + save > c[F.ac]
    }
    // the victim (0x21F6C / 0x21BD0): the message decided first, then the damage (a byte) applied
    const said: string[] = []
    const hurt = (c: Uint8Array) => {
      if (c[F.status] === 6) return
      const name = String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))
      said.push(c[F.hp] + 10 < dmg ? `${name}${msg('dies').trimEnd()}` : `${name}${msg('isHitFor')}${dmg}${msg('pointsOfDamage')}`)
      const d = dmg & 0xff
      const left = Math.max(c[F.hp] - d, 0), over = Math.max(d - c[F.hp], 0)
      if (over > 9 || (left === 0 && c[F.status] === 1)) c[F.status] = 6
      else if (over > 0) c[F.status] = 5
      else if (left === 0) c[F.status] = 4
      if (c[F.status] !== 0 && c[F.status] !== 1) { c[F.hp] = 0; c[F.inPlay] = 0 } else c[F.hp] = left
    }
    const member = (k: number) => this.nodes[Math.max(0, k - 1)] // the k-th from the list head
    const pick = flags & 0x40 ? 0 : this.roll(1, size || 1) // rolled even when it is not used
    if (!(flags & 0x80)) {
      for (let i = 0; i < flags; i++) {
        if (each) dmg = roll()
        const c = member(this.roll(1, size || 1))
        if (c && hit(c)) hurt(c)
        if (!each) dmg = roll()
      }
    } else {
      const b = flags & 0x1f, kind = save & 7
      const fate = (c: Uint8Array, k: number) => { if (!saved(c, k, b) || despite) hurt(c) }
      if (flags & 0x40) {
        for (const c of [...this.nodes]) { if (each) dmg = roll(); if (flags & 0x20) hurt(c); else fate(c, kind) } // the whole list
      } else if (save & 0x80) {
        if (each) dmg = roll()
        if (kind === 0) hurt(this.cur)
        else fate(this.cur, kind - 1)
      } else {
        if (each) dmg = roll()
        const c = member(pick)
        if (c) fate(c, kind)
      }
    }
    for (const t of said) this.io.print(t, false)
    if (!this.nodes.some((c) => c[F.inPlay] !== 0)) {
      const banner = game().ecl.wipeBanner
      if (banner !== null) this.io.print(text(banner), false)
      await this.io.engine('party dead')
      this.quit = true
      return
    }
    await this.io.menu(['PRESS ENTER'], {})
  }

  /** Opcodes a game handles its own way (games/ecl.ts; CotAB: spec/A-games/coab/ecl.md, "Opcodes"). */
  private async variant(v: EclVariant) {
    switch (v) {
      case 'divideRemainder': { // DIVIDE, plus the remainder in B 0x6E3F (CotAB 0x7F3F)
        this.readops(3)
        const b = this.val(2)
        this.store(this.addr(3), b ? Math.floor(this.val(1) / b) : 0)
        this.B[0x6e3f - B0] = b ? this.val(1) % b : 0
        break
      }
      case 'returnOrExit': // RETURN; with nothing to return to, EXIT
        this.readops(0)
        if (this.stack.length) this.pc = this.stack.pop()!
        else this.exit()
        break
      case 'passTime': // PASS_TIME count, unit: the clock words as camp uses them
        this.readops(2)
        await advanceClock(this, this.val(1), this.val(2))
        break
      case 'findSpell': { // FIND_SPELL id, dest index (1-based, 0xFF none), dest member (n − 1 if none)
        this.readops(3)
        const id = this.val(1) & 0xff
        const party = this.party()
        let at = 0xff, who = party.length - 1
        for (let m = 0; m < party.length && at === 0xff; m++) {
          for (let i = 1; i <= F.memorisedCount; i++) if (party[m][F.memorised + i - 1] === id) { at = i - 1 + game().ecl.findSpellFirst; who = m; break }
        }
        this.store(this.addr(2), at)
        this.store(this.addr(3), who)
        break
      }
      case 'protection': // the code-wheel check; the port asks nothing (IMP-068)
        this.readops(1)
        break
      case 'redrawScreen':
        this.readops(0)
        this.mapDirty = true
        await this.io.refresh()
        break
      case 'dropCharacter': this.readops(0); this.leaveParty(); break
      case 'nothing': this.readops(0); break // SotSB PROTECTION (0x2116D): an empty handler
      case 'addExperience': await this.addExperience(); break
      case 'findEffect': { // EQ when the current character has the effect, else NE
        this.readops(1)
        const has = this.effectsOf(this.cur).some((x) => x.type === (this.val(1) & 0xff))
        this.flags = { EQ: has ? 1 : 0, NE: has ? 0 : 1, LT: 0, GT: 0, LE: 0, GE: 0 }
        break
      }
      case 'destroyItems': { // every item of a type leaves the party
        this.readops(1)
        const type = this.val(1) & 0xff
        const keep = this.cur
        for (const c of this.party()) {
          const items = this.itemsOf(c)
          this.cur = c
          for (let k = items.length - 1; k >= 0; k--) {
            const it = items[k]
            if (it.type !== type) continue
            // SotSB 0x21276: a readied one is put away first ("It's Cursed!" and left readied if cursed)
            if (game().ecl.destroyUnreadies && it.ready && this.items) {
              const why = await unreadyItem(new WorldHost(this), c, items, it, this.items)
              if (why) this.io.print(why, false)
            }
            items.splice(k, 1)
          }
          if (this.items) recalc(c, items, this.items)
        }
        this.cur = keep
        break
      }
    }
  }

  private async call() {
    this.readops(1)
    const a = (this.hi[1] << 8) | this.lo[1] // a number, not a script address
    const calls = game().ecl.calls
    if (a === calls.refresh) { // the square registers, and the 3D view drawn again (over any picture) if anything changed
      const pictured = game().ecl.refreshAfterPicture && this.wallsLoaded && this.pictureDrawn
      if (pictured || this.viewKey() !== this.drawnView) this.clearPictures()
      await this.io.refresh()
    }
    else if (a === calls.sound) {
      const { by, other } = game().ecl.callSounds
      const n = by[this.regs.get(0x3de) ?? -1] ?? other
      if (n !== null) this.io.sound(n, 'transient') // FUN_29c3_2ccf: outside any SetResident(0) section
    }
    else if (a === 0xc01e) {
      const [dx, dy] = STEP[this.facing]
      this.x = (this.x + dx) & 15
      this.y = (this.y + dy) & 15
    } else if (a === 0x8000 || a === 0x8001) this.setupDuel(a === 0x8000)
    else if (a === calls.frame) { // CotAB 0x6803: the current picture's next frame, then Delay(speed · 100) (0x57F9)
      this.io.nextFrame?.()
      await this.io.pause(this.speed * game().ecl.pauseMs)
    }
    // 0xBA03 sound, 0xC018 wall-ahead refresh and 0xC01B (dead in the DOS port) need nothing here
  }

  private async program() {
    this.readops(1)
    if (this.restoreCur) {
      this.cur = this.savedCur
      this.restoreCur = false
    }
    const n = this.val(1)
    // PoR 0x1CA40 (CotAB 0x1B94E): 0 (the party screen) and 8 (the ending) return and the script goes on;
    // 9 (camp) and CotAB's 3 (quit: DS:4FE0 = 1) then act as EXIT (0x19C31); other values do nothing
    if (n === game().ecl.quitProgram) this.quit = true
    else if (n === 9) {
      const pc = this.pc
      await this.camp(false)
      this.pc = pc
    } else if (n === 0 || n === game().ecl.endingProgram) { await this.io.engine(n === 0 ? 'party screen' : 'ending'); return }
    else return
    this.stop = true
    this.stack = []
  }

  // ---------------------------------------------------------- game loop
  /** Start of play (FUN_29c3_32f8): reset the VM if resuming a save, then run on_enter. */
  async start() {
    if (this.restoring) {
      this.resetVm(true)
      this.restoring = false
    }
    this.areaChanged = false
    await this.run(this.vectors[4])
    await this.io.refresh()
    if (this.areaChanged) await this.enter()
  }

  /**
   * Debug jump (IMP-025, not in the original): switch block and area as a script's NEW_ECL would,
   * then enter. Map areas take a 16x16 position; the tile wilderness areas (`view.tileOverland`,
   * PoR's 25-27) a wilderness position, written to ECL 0x49C3/0x49C4 as the harbour script does
   * before its boats leave.
   */
  async jump(block: number, area: number, x: number, y: number, facing = this.facing) {
    this.setBlock(block)
    this.A[AREA_ID - A0] = this.area
    this.area = area
    if (game().view.tileOverland.includes(area)) {
      this.A[0x49c3 - A0] = x
      this.A[0x49c4 - A0] = y
      this.A[0x4a9e - A0] = 0 // not inside a lair: areas 25-27 hold the lair maps too (on_enter tests 255)
    } else {
      this.x = x & 15
      this.y = y & 15
      // the map of the area's own number, where there is one: the scripts on the way load it (SotSB's
      // mine levels 2/49–2/51 have it loaded by 2/48's, and LOAD_AREA loads only with ECL 0x49E6 set,
      // SotSB 0x1E81E), which a jump skips; the area's own LOAD_AREA, if any, replaces it
      if (this.files.record(`GEO${block}`, area)) {
        this.A[NO_OVERLAND - A0] = 1
        this.A[GEO_ID - A0] = area
        this.loadGeo(area)
      }
    }
    this.facing2 = (facing & 3) * 2
    this.loadEcl(area)
    this.resetVm(false)
    this.stop = false
    this.stack = []
    await this.enter()
  }

  /** Overland travel (areas 25-27 once on_enter cleared ECL 0x49E6, spec/A-games/engine/main-loop.md). */
  get overland(): boolean {
    return this.A[NO_OVERLAND - A0] === 0 && game().view.tileOverland.includes(this.area)
  }

  /** CotAB's overland city cursor: the cell (8-pixel units on the screen) of place A[0x4CA1], or null. */
  get cityCursor(): [number, number] | null {
    const img = this.startImage
    if (!img || T.cursorX.at < 0) return null
    const i = this.A[0x4aa1 - A0] & 0xff // ECL 0x4CA1 in CotAB's numbering
    return [img[T.ds + T.cursorX.at + i], img[T.ds + T.cursorY.at + i]]
  }

  /** Wilderness position as the guide numbers it: the area's own x plus 13 columns per area after 25. */
  get wildPosition(): [number, number] {
    return [this.A[0x49c3 - A0] + 13 * (this.area - 25), this.A[0x49c4 - A0]]
  }

  private overlandRules: Overland | null | undefined
  private spellTableCache: SpellTables | null | undefined
  /** Spell names and records (START.EXE); null when missing. */
  get spells(): SpellTables | null {
    if (this.spellTableCache === undefined) this.spellTableCache = SpellTables.load(this.files.get('START.EXE'))
    return this.spellTableCache
  }

  private itemTableCache: ItemTables | null | undefined
  /** Base item table and name words (ITEMS, START.EXE); null when either file is missing. */
  get items(): ItemTables | null {
    if (this.itemTableCache === undefined) this.itemTableCache = ItemTables.load(this.files.get('ITEMS'), this.files.get('START.EXE'))
    // item names carry "* " while anyone has Detect Magic (effect 5), as FUN_10ba_0442 checks on every name
    if (this.itemTableCache) this.itemTableCache.detect = this.party().some((c) => this.effectsOf(c).some((e) => e.type === game().effects.ids.detectMagic))
    return this.itemTableCache
  }

  /** Attach a member's item and effect files (CHRDAT*.ITM / .SPC) after newGame or loadSave. */
  attachFiles(i: number, itm?: Uint8Array, spc?: Uint8Array) {
    const node = this.nodes[i]
    if (!node) return
    this.inventory.set(node, characterItems(itm))
    this.effects.set(node, parseEffects(spc))
  }

  effectsOf(node: Uint8Array): Effect[] {
    let list = this.effects.get(node)
    if (!list) this.effects.set(node, (list = []))
    return list
  }

  itemsOf(node: Uint8Array): Item[] {
    let list = this.inventory.get(node)
    if (!list) this.inventory.set(node, (list = []))
    return list
  }

  /** Overland map and rules from START.EXE; null when the player's files lack it. */
  get wild(): Overland | null {
    if (this.overlandRules === undefined) this.overlandRules = Overland.fromStartExe(this.files.get('START.EXE'))
    return this.overlandRules
  }

  /**
   * One overland move (FUN_3e76_0989 then FUN_3e76_0d6d): the cursor key sets the facing to
   * N/E/S/W, on_move may cancel it or change area, FUN_3e76_0818 moves the party unless the
   * square is blocked, then on_step runs. A move takes 12 hours (the clock is not modelled yet).
   */
  async travel(dir: number) {
    this.facing2 = (dir & 3) * 2
    this.B[EDGE - B0] = 0
    this.areaChanged = false
    await this.run(this.vectors[0])
    if (this.areaChanged) { await this.enter(); return }
    if (this.B[CANCEL_MOVE - B0] >= 0xff) this.B[CANCEL_MOVE - B0] = 0
    else if (this.wild) {
      const w = this.wild
      const [dx, dy] = w.step(this.facing2)
      const x = Math.max(0, Math.min(15, this.A[0x49c3 - A0] + dx))
      const y = Math.max(0, Math.min(35, this.A[0x49c4 - A0] + dy))
      const t = w.map[y * 44 + w.column(this.area, x)]
      if (Overland.river(t) && this.A[0x4aa2 - A0] === 0) this.io.print(msg('riverStench'), false)
      else if (!Overland.blocked(t)) {
        this.A[0x49c3 - A0] = x
        this.A[0x49c4 - A0] = y
        await advanceClock(this, 12, HOUR)
      }
    }
    this.clearPictures() // FUN_3e76_0d6d: after the move, the picture and the encounter sprite go
    await this.io.refresh()
    this.areaChanged = false
    await this.run(this.vectors[1])
    if (this.areaChanged) await this.enter()
    await this.io.refresh()
  }

  /** FUN_29c3_31b4: re-enter after an area change. */
  async enter() {
    for (;;) {
      this.clearPictures() // a new area: its view, not the last area's pictures
      this.wallsLoaded = false
      this.areaChanged = false
      this.B[EDGE - B0] = 0
      await this.run(this.vectors[4])
      if (this.quit) return
      // an area change made by on_enter itself (the victory script's NEW_ECL #0 back to New Phlan):
      // enter the new area properly, so its on_enter loads its map and walls (I: the original's
      // FUN_29c3_31b4 clears the flag here; how it then shows the new area is not found)
      if (this.areaChanged) continue
      // FUN_29c3_31b4 step 3: the Stojanow clears once the pyramid's sorcerer is beaten (FUN_4804_06b3(1))
      if (this.overland && this.area === 26 && this.read(0x4ab3) === 0xfe && this.read(0x4aa2) === 0) await this.io.river?.()
      this.areaChanged = false
      await this.run(this.vectors[0])
      if (!this.areaChanged && !this.quit) await this.run(this.vectors[1])
      await this.io.refresh()
      if (!this.areaChanged || this.quit) { if (!this.quit) this.trace.entered?.(); return }
    }
  }

  /** Alter → Order: move a party member up (−1) or down (+1). */
  moveMember(i: number, dir: number) {
    const n = this.party().length, j = i + dir
    if (j < 0 || j >= n) return
    ;[this.nodes[i], this.nodes[j]] = [this.nodes[j], this.nodes[i]]
  }

  /** Party screen → Add: a character joins the end of the party (before any monsters). */
  addMember(sav: Uint8Array, itm?: Uint8Array, spc?: Uint8Array) {
    const c = sav.slice()
    // SotSB 0x40FF4 (R.addRefill): a paladin's ability uses set as the roster loader reads the record
    const r = R.addRefill
    if (r && F.abilityUses >= 0 && ((((c[F.levels + r.cls]) << 24) >> 24) > 0 || (F.misc86 >= 0 && c[F.misc86] === r.cls && formerLevelsCount(c)))) c[F.abilityUses] = r.value
    const n = this.party().length
    this.nodes.splice(n, 0, c)
    this.B[PARTY_SIZE - B0] = n + 1
    this.inventory.set(c, characterItems(itm))
    this.effects.set(c, parseEffects(spc))
    if (!this.cur) this.cur = this.savedCur = c
    return c
  }

  /**
   * An entry leaves the list as the original's remove-current routine takes it (PoR FUN_417f_3291, SotSB
   * 0x3CAA4, called with the entry made current: the aftermath's flight 0x23CCC and clean-up 0x23D25):
   * when it is the current one, the entry before it becomes current, or the new head when it was the
   * first; the party size is left to the caller (the aftermath counts the list again). Its items and
   * effects go with it.
   */
  removeEntry(c: Uint8Array) {
    const i = this.nodes.indexOf(c)
    if (i < 0) return
    this.nodes.splice(i, 1)
    this.inventory.delete(c)
    this.effects.delete(c)
    const next = this.nodes[Math.max(0, i - 1)]
    if (next && this.cur === c) {
      if (this.savedCur === c) this.savedCur = next
      this.cur = next
    }
  }

  /** Alter → Drop: the member leaves the party for good. */
  dropMember(c: Uint8Array) {
    const i = this.nodes.indexOf(c)
    if (i < 0) return
    this.nodes.splice(i, 1)
    this.inventory.delete(c)
    this.effects.delete(c)
    if (this.B[PARTY_SIZE - B0]) this.B[PARTY_SIZE - B0]--
    if (this.cur === c) this.cur = this.savedCur = this.nodes[0]
  }

  /** After a battle: no monsters loaded any more (the aftermath removed them from the list). */
  monstersCleared() {
    this.monsters = 0
    this.monstersLoaded = false
  }

  /** set by the camp screen when a rest is interrupted by an encounter */
  campInterrupted = false
  /** rest-encounter step counter (DS:49FB): not saved, kept between rests and areas */
  restSteps = 0

  /**
   * Encamp (FUN_29c3_2dd3): camp_menu (sets the rest-encounter odds), the camp screen, then
   * camp_confirmed when a rest was interrupted (scripts start the wandering-monster fight there).
   */
  async camp(enterAfter = true) {
    this.areaChanged = false
    await this.run(this.vectors[2])
    this.campInterrupted = false
    await this.io.engine('camp')
    if (this.campInterrupted) {
      this.campInterrupted = false
      await this.io.refresh()
      await this.run(this.vectors[3])
    }
    if (enterAfter && this.areaChanged) await this.enter()
  }

  /** One exploration command in a map area: f, l, r, b (turn round), s (search), L (look), e (encamp). */
  async command(c: string) {
    if (c === 'l' || c === 'r' || c === 'b') {
      this.facing2 = (this.facing2 + ({ l: 6, r: 2, b: 4 } as Record<string, number>)[c]) % 8
      if (c !== 'b') this.io.sound(10, 'transient') // FUN_3e76_0989: quarter turns step, turning round is silent
      this.clearPictures() // the view is drawn for the new facing
      await this.io.refresh()
      return
    }
    if (c === 's') { this.B[SEARCH_LOOK - B0] ^= 1; return }
    if (c === 'e') {
      await this.camp()
      return
    }
    if (c === 'L') {
      await advanceClock(this, 10, MINUTE) // Look takes 10 minutes (FUN_3e76_0989)
      const keep = this.B[SEARCH_LOOK - B0] & 1
      this.B[SEARCH_LOOK - B0] = 1
      this.areaChanged = false
      await this.run(this.vectors[1])
      if (this.areaChanged) await this.enter()
      this.B[SEARCH_LOOK - B0] = keep
      await this.io.refresh()
      return
    }
    // forward: FUN_3e76_068d flags a move off the map edge, then on_move, the move, on_step
    this.B[EDGE - B0] = 0
    if (this.geo && this.geo.passage(this.x, this.y, this.facing)) {
      const [dx, dy] = STEP[this.facing]
      if (this.x + dx < 0 || this.x + dx > 15 || this.y + dy < 0 || this.y + dy > 15) this.B[EDGE - B0] = 1
    }
    this.areaChanged = false
    await this.run(this.vectors[0])
    if (this.areaChanged) { await this.enter(); return }
    this.A[PREV_X - A0] = this.x
    this.A[PREV_Y - A0] = this.y
    let blocked = 0
    if (this.B[CANCEL_MOVE - B0] >= 0xff) this.B[CANCEL_MOVE - B0] = 0
    else if (this.geo) {
      const p = this.geo.passage(this.x, this.y, this.facing)
      // a locked door offers Bash, Pick and Knock first (FUN_3e76_0d6d); success walks on as a normal step
      const through = p === 1 || ((p === 2 || p === 3) && await this.lockedDoor(p))
      if (through) {
        this.doorTries = { bash: true, pick: true, knock: true }
        const [dx, dy] = STEP[this.facing]
        this.x = (this.x + dx) & 15
        this.y = (this.y + dy) & 15
        await advanceClock(this, this.B[SEARCH_LOOK - B0] & 1 ? 10 : 1, MINUTE) // FUN_3e76_073b
        this.io.sound(10, 'transient') // main loop: footstep when the position changed
      } else {
        blocked = p === 0 ? 1 : 2
        this.io.sound(7, 'transient') // FUN_3e76_0d6d: bump, or the door held
      }
    }
    this.clearPictures() // FUN_3e76_0d6d: after the move, the picture and the encounter sprite go
    await this.io.refresh()
    if (blocked === 1) await this.io.engine('blocked')
    this.areaChanged = false
    await this.run(this.vectors[1])
    if (this.areaChanged) await this.enter()
    await this.io.refresh()
  }
}
