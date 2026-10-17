// ECL interpreter and exploration loop (spec/ecl.md, spec/architecture.md).
// A port of tools/eclvm.py; every opcode, including the original's quirks, follows spec/ecl.md.
// The interpreter is async: menus, input and screen refreshes await the front end (Io).

import type { GameFiles } from '../store/gamefiles'
import { GeoMap, STEP } from '../data/geo'
import { WallSets } from '../data/walls'
import { unpackText } from '../data/text'
import { Overland } from '../rules/overland'
import { Item, ItemTables, parseItems } from '../data/items'
import { parseEffects, type Effect } from '../data/effects'
import { SpellTables } from '../data/spells'
import { unexepack } from '../data/exepack'
import { randomTreasure } from '../rules/randitem'
import { advanceClock, HOUR, MINUTE } from '../rules/camp'
import { CHAR_SIZE } from '../data/character'
import { recalc } from '../rules/equip'

export const A0 = 0x4900
export const B0 = 0x6b00
export const C0 = 0x9700
export const CODE = 0x9900
const CODE_END = 0xb700

// engine-visible ECL variables (spec/ecl.md)
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
  /** Text for the text window; clear = PRINT_CLEAR / new screen of text. */
  print(text: string, clear: boolean): void
  /** A menu; resolves to the 0-based choice. `enter` = a one-item "press Enter" prompt. */
  menu(items: string[], opts?: { prompt?: string; vertical?: boolean }): Promise<number>
  inputNumber(): Promise<number>
  inputText(): Promise<string>
  /** Show a picture (null clears). */
  picture(p: { pic: number } | { head: number; body: number } | null): void
  /** Encounter sprite at a distance (0 nearest), or the picture once it is at distance 0. */
  sprite(sprite: number, picture: number, distance: number): void
  /** Bring the view up to date with position, map and wall sets (CALL 0x2C90, area entry). */
  refresh(): Promise<void>
  /** A sound effect by the original's number (FUN_18ae_00dc): 10 footstep, 7 bump, 11 script effect. */
  sound(n: number): void
  /** PAUSE: wait (game speed x 225 ms in the original). */
  pause(ms: number): Promise<void>
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
  /** set when the map or wall sets change, cleared by the front end */
  mapDirty = true
  private stop = false
  private pc = CODE
  private kind = new Uint8Array(33)
  private lo = new Uint8Array(33)
  private hi = new Uint8Array(33)
  private sbuf: string[] = new Array(33).fill('')
  private opstr = new Map<number, string>()
  private readonly files: GameFiles
  readonly io: Io
  private rng: () => number

  constructor(files: GameFiles, io: Io, seed = Date.now()) {
    this.files = files
    this.io = io
    this.walls = new WallSets(files, 1)
    let s = seed >>> 0 || 1
    this.rng = () => {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0
      return s / 4294967296
    }
  }

  // ---------------------------------------------------------------- state
  get facing() { return this.facing2 >> 1 }

  rand(n: number) { return Math.floor(this.rng() * n) }

  roll(count: number, sides: number) {
    let t = 0
    for (let i = 0; i < count; i++) t += this.rand(sides) + 1
    return sides ? t : 0
  }

  /** A new game: fresh variables, the given party, block 3 area 0 (New Phlan), as after "Begin". */
  newGame(party: Uint8Array[]) {
    this.A.fill(0); this.B.fill(0); this.C.fill(0)
    this.nodes = party.map((c) => c.slice())
    this.cur = this.savedCur = this.nodes[0]
    this.B[PARTY_SIZE - B0] = this.nodes.length
    this.setBlock(3)
    this.area = 0
    this.loadEcl(0)
    this.resetVm(false)
  }

  /** Resume from a save game (SAVGAM*.DAT layout, spec/savegame.md). */
  loadSave(d: Uint8Array, party: Uint8Array[]) {
    const w = (o: number, n: number) => {
      const out = new Uint16Array(n)
      for (let i = 0; i < n; i++) out[i] = d[o + 2 * i] | (d[o + 2 * i + 1] << 8)
      return out
    }
    this.A = w(1, 0x400); this.B = w(0x801, 0x400); this.C = w(0x1001, 0x200)
    this.code = d.slice(0x1401, 0x3201)
    this.x = d[0x3201]; this.y = d[0x3202]; this.facing2 = d[0x3203]
    this.speed = Math.min(this.A[0x49fc - A0], 9)
    this.nodes = party.map((c) => c.slice())
    this.cur = this.savedCur = this.nodes[0]
    this.setBlock(this.B[0x6e12 - B0])
    this.area = this.A[AREA_ID - A0]
    this.loadGeo(this.A[GEO_ID - A0])
    ;[0x4afa, 0x4afb, 0x4afc].forEach((a, i) => {
      const r = this.A[a - A0]
      if (r !== 0xffff) this.walls.load(i + 1, r)
    })
    // the VM is reset when play starts (FUN_29c3_32f8), keeping the saved per-area variables
    this.restoring = true
  }

  private restoring = false

  /** Party members (the list without loaded monsters). */
  party(): Uint8Array[] {
    return this.nodes.slice(0, this.B[PARTY_SIZE - B0] || this.nodes.length)
  }

  /**
   * The SAVGAM<x>.DAT image (13 137 bytes, spec/savegame.md), with the engine globals copied into
   * ECL variables first as FUN_45c5_1d58 does. stems: the character file stems for the party.
   */
  toSave(stems: string[]): Uint8Array {
    for (let s = 1; s <= 3; s++) {
      const r = this.walls.records[s]
      this.A[0x4afa + s - 1 - A0] = r
      this.A[0x4afd + s - 1 - A0] = r === 0xffff ? 0xffff : s
    }
    this.A[0x49fc - A0] = this.speed
    this.A[0x49ff - A0] = 3 // monster pictures and portraits on
    this.A[AREA_ID - A0] = this.area
    this.B[0x6e12 - B0] = this.block
    const d = new Uint8Array(13137)
    d[0] = this.block
    const put = (o: number, words: Uint16Array) => words.forEach((v, i) => { d[o + 2 * i] = v & 0xff; d[o + 2 * i + 1] = v >> 8 })
    put(1, this.A); put(0x801, this.B); put(0x1001, this.C)
    d.set(this.code.subarray(0, 0x1e00), 0x1401)
    const [wall, event] = this.square()
    d.set([this.x, this.y, this.facing2, wall, event], 0x3201)
    d[0x3206] = this.overland ? this.area - 23 : 1 // DS:49FA area kind: 1 map area, 2-4 wilderness
    d[0x3207] = 2
    d[0x3208] = stems.length
    stems.forEach((st, i) => {
      const o = 0x3209 + 41 * i
      d[o] = Math.min(st.length, 40)
      for (let j = 0; j < d[o]; j++) d[o + 1 + j] = st.charCodeAt(j)
    })
    return d
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
    if (!keep) {
      for (let a = 0x4a00; a < 0x4a20; a++) this.A[a - A0] = 0
      for (let a = 0x6e79; a <= 0x6e82; a++) this.B[a - B0] = 0
    }
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
    if (k === 0x18) return c[0x14]
    if (k === 0x9b) return c[0x6e]
    if (k === 0xa0) return s8(0x73)
    if (k >= 0xa5 && k <= 0xac) return c[0x76 + k - 0xa4]
    if (k === 0xb8) return c[0x84]
    if ([0xbb, 0xbd, 0xbf, 0xc1, 0xc3].includes(k)) return u16(0x88 + k - 0xbb)
    if (k === 0xd8) return s8(0xa0)
    if (k === 0xf7) return u16(0xb8)
    if (k === 0xf9) return c[0xba]
    if (k === 0x100) return c[0x10d] === 0 ? 0x80 : 1
    if (k === 0x10c) {
      if (c[0x10e] === 0 && c[0x10f] !== 0) return 0x80
      return c[0x10e] === 1 ? 0x81 : 0
    }
    if (k === 0x10d) return 0
    if (k === 0x11b) return c[0x11c]
    if (k === 0x2b1 || k === 0x2b4) return Math.max(0, this.nodes.indexOf(c))
    if (k === 0x2cf) {
      const cha = c[0x15]
      if (cha >= 8 && cha <= 12) return 25
      if (cha >= 18 && cha <= 25) return 60
      return ({ 3: 0, 4: 5, 5: 10, 6: 15, 7: 20, 13: 30, 14: 35, 15: 40, 16: 50, 17: 55 } as Record<number, number>)[cha] ?? 0
    }
    if (k === 0x312) return this.block
    return undefined
  }

  /** FUN_2fea_0a74 */
  private charWrite(k: number, v: number) {
    const c = this.cur
    if (k >= 0x20 && k <= 0x70) c[0x17 + k - 0x20] = v & 0xff
    else if (k === 0xb8) c[0x84] = (v > 0xb2 ? v - 0x32 : v) & 0xff
    else if ([0xbb, 0xbd, 0xbf, 0xc1, 0xc3].includes(k)) {
      c[0x88 + k - 0xbb] = v & 0xff
      c[0x89 + k - 0xbb] = v >> 8
    } else if (k === 0xf7) { c[0xb8] = v & 0xff; c[0xb9] = v >> 8 }
    else if (k === 0xf9) c[0xba] = v & 0xff
    else if (k === 0x100) {
      if (v > 0x7f) {
        c[0x10d] = 0
        if (v === 0x87) c[0x10c] = 7
      }
    } else if (k === 0x10c) {
      if (v === 0) { c[0x10e] = 0; c[0x10f] = 0 }
      else if (v === 0x80) { c[0x10e] = 0; c[0x10f] = 1 }
      else if (v === 0x81) { c[0x10e] = 1; c[0x10f] = 1 }
    } else if (k === 0x312) this.setBlock(v)
    else if ((k === 0x322 || k === 0x324 || k === 0x326) && v > 0x80) {
      this.walls.load((k - 0x320) / 2, v & 0x7f)
      this.mapDirty = true
    }
  }

  private readString(a: number): string {
    if (a === B0) return String.fromCharCode(...this.cur.subarray(1, 1 + this.cur[0]))
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
      this.cur[0] = n.length
      for (let i = 0; i < n.length; i++) this.cur[1 + i] = n.charCodeAt(i)
      return
    }
    for (const ch of s) this.write(a++, ch.charCodeAt(0))
    this.write(a, 0)
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

  private addr(i: number) { return (this.hi[i] << 8) | this.lo[i] }

  private val(i: number): number {
    const k = this.kind[i]
    if (k === 0) return this.lo[i]
    if (k === 1 || k === 3 || k === 0x80) return this.read(this.addr(i))
    if (k === 2 || k === 0x81) return this.addr(i)
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

  private async step() {
    const op = this.code[this.pc - CODE]
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
      case 0x04: this.readops(3); this.write(this.addr(3), this.val(1) + this.val(2)); break
      case 0x05: this.readops(3); this.write(this.addr(3), this.val(2) - this.val(1)); break
      case 0x06: {
        this.readops(3)
        if (this.val(2) === 0) throw new Error('DIVIDE by 0 (runtime error 200 in the original)')
        this.write(this.addr(3), Math.floor(this.val(1) / this.val(2)))
        break
      }
      case 0x07: this.readops(3); this.write(this.addr(3), this.val(1) * this.val(2)); break
      case 0x08: {
        this.readops(2)
        let m = this.val(1) & 0xff
        if (m < 255) m++
        this.write(this.addr(2), this.rand(m))
        break
      }
      case 0x09: {
        this.readops(2)
        if (this.kind[1] < 0x80) this.write(this.addr(2), this.val(1))
        else this.storeString(this.addr(2), this.sbuf[1])
        break
      }
      case 0x0a: {
        this.readops(1)
        this.restoreCur = true
        const n = this.val(1) & 0x7f
        if (n < this.nodes.length) this.cur = this.nodes[n]
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
          this.io.sound(10) // not in the original: a footstep as the sprite approaches (IMP-014)
          if (this.spriteNow) this.io.sprite(this.spriteNow.sprite, this.spriteNow.picture, this.B[SPRITE_DIST - B0])
        }
        break
      }
      case 0x0e: {
        this.readops(1)
        const n = this.val(1)
        if (n === 255) {
          this.spriteNow = null
          this.io.picture(null)
        } else if (this.B[PORTRAIT - B0] === 0xff) this.io.picture({ pic: n })
        else this.io.picture({ head: this.B[PORTRAIT - B0], body: n })
        break
      }
      case 0x0f: this.readops(2); this.write(this.addr(2), (await this.io.inputNumber()) & 0xffff); break
      case 0x10: {
        this.readops(2)
        const s = (await this.io.inputText()).toUpperCase().slice(0, 40) || ' '
        this.storeString(this.addr(2), s)
        break
      }
      case 0x11: this.readops(1); this.io.print(this.text(1), false); break
      case 0x12: this.readops(1); this.io.print(this.text(1), true); break
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
        this.write(head[0].addr, await this.io.menu(items, { vertical: true }))
        break
      }
      case 0x16: case 0x17: case 0x18: case 0x19: case 0x1a: case 0x1b: {
        this.readops(0)
        const flag = (['EQ', 'NE', 'LT', 'GT', 'LE', 'GE'] as const)[op - 0x16]
        if (!this.flags[flag]) {
          const next = this.code[this.pc - CODE]
          if (SKIP[next] !== undefined) this.readops(SKIP[next])
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
          t = (t + Math.floor((c[0x11b] + 5 * Math.max(c[0x111] - 60, 0) + 5 * Math.max(c[0x110] - 39, 0)
            + 8 * c[0x9b] + 4 * c[0x96]) / 10)) & 0xff
        }
        this.write(this.addr(1), t)
        break
      }
      case 0x1e: {
        this.readops(6)
        const sel = this.kind[1] === 1 ? this.addr(1) : this.val(1)
        const dest = [3, 4, 5, 6].map((i) => this.addr(i))
        let vals: number[]
        if (sel === 0) vals = [0, 0, 0, 0] // effects are not modelled yet
        else if (sel === 0x6ba7 || sel === 0x6c1b) {
          const off = sel === 0x6ba7 ? 0x79 : 0x11c
          const xs = this.nodes.map((c) => c[off])
          vals = [Math.min(...xs), Math.max(...xs), Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length), 0]
        } else break
        dest.forEach((d, i) => this.write(d, vals[i]))
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
        this.write(this.addr(1), +this.nodes.some((c) => c[0x2f] === 4 || c[0x2f] === 10))
        this.write(this.addr(2), 0)
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
        this.write(SURPRISE_RESULT, res)
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
        const p = this.val(2)
        for (const c of this.val(1) === 0 ? [this.cur] : this.nodes) {
          for (let j = 0; j < 7; j++) {
            const o = 0x88 + 2 * j
            const v = Math.floor(((c[o] | (c[o + 1] << 8)) * (100 - p)) / 100)
            c[o] = v & 0xff; c[o + 1] = v >> 8
          }
        }
        break
      }
      case 0x29: await this.encounterMenu(); break
      case 0x2a: this.readops(3); this.write(this.addr(3), this.read(this.addr(1) + (this.val(2) & 0xff))); break
      case 0x2b: {
        const { n, head } = this.variadic(2, 2)
        const items = Array.from({ length: n }, (_, i) => this.text(i + 1))
        this.write(head[0].addr, (await this.io.menu(items)) & 0xff)
        break
      }
      case 0x2c: {
        this.readops(6)
        const c = await this.io.menu(['HAUGHTY', 'SLY', 'NICE', 'MEEK', 'ABUSIVE'])
        this.write(this.addr(6), this.val(c + 1) & 0xff)
        break
      }
      case 0x2d: await this.call(); break
      case 0x2e: await this.damage(); break
      case 0x2f: case 0x30: {
        this.readops(3)
        const r = (op === 0x2f ? this.val(1) & this.val(2) : this.val(1) | this.val(2)) & 0xff
        this.setFlags(0, r)
        this.write(this.addr(3), r)
        break
      }
      case 0x31: this.readops(0); break
      case 0x32: {
        this.readops(1)
        // items are not loaded yet; FIND_ITEM reports "not found"
        this.clearFlags()
        this.flags.NE = 1
        break
      }
      case 0x33: this.readops(0); this.io.print('', false); break
      case 0x34: this.readops(1); break // passes game time; the clock is not modelled yet
      case 0x35: this.readops(3); this.write((this.addr(2) + this.val(3)) & 0xffff, this.val(1)); break
      case 0x36: this.readops(2); this.addNpc(this.val(1), this.val(2)); await this.io.refresh(); break
      case 0x37: this.loadWallsets(); break
      case 0x38: await this.program(); break
      case 0x39: {
        this.readops(1)
        const names = this.nodes.slice(0, this.B[PARTY_SIZE - B0] || this.nodes.length)
          .map((c) => String.fromCharCode(...c.subarray(1, 1 + c[0])))
        this.cur = this.nodes[await this.io.menu(names, { prompt: this.text(1), vertical: true })]
        break
      }
      case 0x3a: this.readops(0); await this.io.pause(this.speed * 225); break // PAUSE (FUN_1709_0dbe)
      case 0x3b: {
        this.readops(3)
        // the original writes both results to engine space (addr & 0xFF): they are lost
        break
      }
      case 0x3c: this.readops(1); break
      case 0x3d: this.readops(0); break
      default: throw new Hang(`no handler for opcode ${op.toString(16)} at ${this.pc.toString(16)}`)
    }
  }

  private spriteNow: { sprite: number; picture: number } | null = null

  private exit() {
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
    this.readops(3)
    const b = [1, 2, 3].map((i) => this.val(i) & 0xff)
    if (b[0] === 0x7f) this.walls.load(1, 0)
    else if (this.A[0x49e7 - A0] && this.A[0x49e8 - A0]) {
      this.walls.load(1, b[0])
      this.walls.load(3, b[2])
    } else b.forEach((r, i) => { if (r !== 0xff) this.walls.load(i + 1, r); else this.walls.clear(i + 1) })
    this.mapDirty = true
  }

  private async loadMonster() {
    this.readops(3)
    this.addMonsters(this.val(1), this.val(2), this.val(3))
  }

  /** LOAD_MONSTER: append copies of MON<block>CHA record `id` with their items and effects. */
  addMonsters(id: number, n: number, picture: number) {
    if (this.monsters >= 63) return
    const raw = this.files.record(`MON${this.block}CHA`, id)
    if (!raw) return
    const count = Math.max(n, 1)
    const items = this.files.record(`MON${this.block}ITM`, id)
    const spc = this.files.record(`MON${this.block}SPC`, id)
    for (let i = 0; i < count && this.monsters < 63; i++) {
      const m = this.monsterRecord(raw)
      m[0xbf] = this.iconSlot
      this.nodes.push(m)
      this.inventory.set(m, parseItems(items))
      this.effects.set(m, parseEffects(spc))
      this.combatPicture.set(m, picture)
      this.monsters++
    }
    this.iconSlot++
    this.monstersLoaded = true
  }

  /** A monster record as the loader leaves it (FUN_45c5_0ec4): icon size by race, random icon colours. */
  private monsterRecord(raw: Uint8Array) {
    const m = new Uint8Array(CHAR_SIZE)
    m.set(raw.subarray(0, CHAR_SIZE))
    const race = m[0x2e]
    if ([1, 3, 5].includes(race)) m[0xc0] = 1
    else if ([2, 4, 6, 7].includes(race)) m[0xc0] = 2
    const colour = () => { const d = this.roll(1, 6); return ((d + 8) << 4) + d }
    for (const k of [1, 2, 3]) m[0xc0 + k] = colour()
    m[0xc4] = 0xc4
    for (const k of [5, 6]) m[0xc0 + k] = colour()
    return m
  }

  /** DS:6DDE–6DE0: whether Bash, Pick and Knock are still offered at a locked door; all set again by every step */
  doorTries = { bash: true, pick: true, knock: true }

  /**
   * The locked-door menu (FUN_3e76_0d6d; spec/architecture.md, "Moving"). Passage 2 is an ordinary
   * locked door, 3 one that cannot be picked and needs great strength. Returns true when the party
   * gets through: Bash and Pick unlock the door on both sides (FUN_3e76_0109), Knock only lets the
   * party through this once. Every party entry tries in list order until one succeeds.
   */
  private async lockedDoor(kind: number): Promise<boolean> {
    const list = this.nodes
    const s8 = (v: number) => (v << 24) >> 24
    const hasClass = (k: number) => list.some((c) => s8(c[0x96 + k]) > 0)
    const knockCaster = () => list.find((c) => Array.from({ length: 21 }, (_, k) => c[0x17 + k]).includes(0x1f))
    const opts: [string, string][] = []
    if (this.doorTries.bash) opts.push(['BASH', 'b'])
    if (this.doorTries.pick && hasClass(6)) opts.push(['PICK', 'p'])
    if (this.doorTries.knock && (kind === 2 ? !!knockCaster() : hasClass(5))) opts.push(['KNOCK', 'k'])
    if (!opts.length) return false // FUN_3e76_0000: nothing left to try
    opts.push(['EXIT', 'e'])
    const k = opts[await this.io.menu(opts.map((o) => o[0]), { prompt: 'Locked.' })]?.[1]
    let ok = false
    if (k === 'b') ok = this.bashDoor(kind)
    else if (k === 'p') {
      // FUN_3e76_04df: each member rolls d100 against Open Locks (char[0x78]) while conscious; one try per door
      if (kind === 2) ok = list.some((c) => c[0x10c] === 0 && this.roll(1, 100) <= c[0x78])
      this.doorTries.pick = false
    } else if (k === 'k') {
      // FUN_3e76_0648: a member with Knock memorised casts it; the door is passed, not unlocked
      const c = knockCaster()
      if (c) { const at = Array.from({ length: 21 }, (_, j) => c[0x17 + j]).indexOf(0x1f); c[0x17 + at] = 0; ok = true }
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
      const str = c[0x10], pct = c[0x16]
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
   * ADD_NPC (handler 29c3:2B7E, loader FUN_45c5_1262): monster record `id` of this block joins the end
   * of the party (at most 8), with a random portrait for its class and gender; it becomes the current
   * character. Morale char[0x84] = (morale >> 1) | 0x80; id 0x18 is on the enemy side.
   */
  addNpc(id: number, morale: number) {
    const party = this.party()
    if (party.length <= 7) {
      const raw = this.files.record(`MON${this.block}CHA`, id)
      if (!raw) { this.io.print('Unable to load monster', false); return }
      const c = this.monsterRecord(raw)
      c[0xab] = this.rand(256)
      const classes = [0, 1, 2, 3, 4, 5, 6].filter((k) => ((c[0x96 + k] << 24) >> 24) > 0)
      const cls = classes.length ? classes[this.roll(1, classes.length) - 1] : 2
      const img = this.startImage
      if (img) {
        const tb = (o: number) => img[0xc7c0 + o]
        const g = c[0x9e]
        const body = cls === 0 ? 0x8d7 : cls === 5 ? 0x8eb : cls === 6 ? 0x8f5 : 0x8e1
        c[0xbc] = tb(body + g * 5 + this.roll(1, 5))
        c[0xbb] = tb(0x8c7 + g * 8 + this.roll(1, 8))
      }
      const n = party.length
      this.nodes.splice(n, 0, c)
      this.B[PARTY_SIZE - B0] = n + 1
      this.inventory.set(c, parseItems(this.files.record(`MON${this.block}ITM`, id)))
      this.effects.set(c, parseEffects(this.files.record(`MON${this.block}SPC`, id)))
      this.cur = c
    }
    // the handler then writes to whoever is current (unchanged when the party was full)
    this.cur[0x84] = (morale >> 1) | 0x80
    this.cur[0x10e] = id === 0x18 ? 1 : 0
    if (this.items) recalc(this.cur, this.itemsOf(this.cur), this.items)
  }

  private startImageCache: Uint8Array | null | undefined
  /** START.EXE's load image (data segment tables); null when missing. */
  get startImage(): Uint8Array | null {
    if (this.startImageCache === undefined) {
      const exe = this.files.get('START.EXE')
      try { this.startImageCache = exe ? unexepack(exe).image : null } catch { this.startImageCache = null }
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
    for (const c of this.party()) if (c !== me) c[0x10d] = 0
    this.duel = true
    this.duelist = me
    this.B[0x6de6 - B0] = copy ? 1 : 0
    if (!copy) return
    const r = me.slice()
    const nm = 'ROLF'
    r.fill(0, 0, 16)
    r[0] = nm.length
    for (let i = 0; i < nm.length; i++) r[1 + i] = nm.charCodeAt(i)
    r[0x10e] = 1; r[0x10f] = 1; r[0x84] = 0xb2
    this.nodes.push(r)
    this.combatPicture.set(r, 11) // FUN_2fea_1a6f: ROLF's combat icon is CPIC<block> #11 / #139
    this.inventory.set(r, this.itemsOf(me).map((it) => it.copy()))
    this.effects.set(r, [])
    this.monsters++
    this.monstersLoaded = true
  }

  private async combat() {
    this.readops(0)
    if (!this.monstersLoaded && !this.duel) {
      if (this.B[SHOP_FLAG - B0] === 1) {
        this.B[SHOP_FLAG - B0] = 0
        await this.io.engine('shop')
      } else if (this.B[TEMPLE_FLAG - B0] === 1) {
        this.B[TEMPLE_FLAG - B0] = 0
        await this.io.engine('temple')
      } else if (this.treasure.length || this.money.some((v) => v > 0)) await this.io.engine('treasure')
    } else {
      const names = this.nodes.slice(this.nodes.length - this.monsters)
        .map((m) => String.fromCharCode(...m.subarray(1, 1 + m[0])))
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
      if (this.duel) for (const c of this.party()) if (c[0x10c] <= 1) c[0x10d] = 1
    }
    this.duel = false
    this.duelist = null
    this.B[SEARCH_LOOK - B0] &= 1
  }

  private async encounterMenu() {
    this.readops(14)
    const moves = this.nodes.map((c) => c[0x11c])
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
      let c = await this.io.menu(['COMBAT', 'WAIT', 'FLEE', close ? 'PARLAY' : 'ADVANCE'])
      if (c === 3 && close) c = 4
      if (r[c] >= 5) return
      const act = ENCOUNTER[r[c]][c]
      let v: number
      if (act === 'wait') { this.io.print('Both sides wait.', false); continue }
      if (act === 'approach' || (act === 'parlay' && dist > 0)) {
        if (dist === 0) this.io.print('Both sides wait.', false)
        else { dist--; this.B[SPRITE_DIST - B0] = dist }
        continue
      }
      if (act === 'parlay') v = 3
      else if (act === 'flee') v = slow < f ? 1 : 2
      else if (act === 'pursue') v = fast < g ? 0 : 1
      else v = act
      if (v === 0) this.io.print('The monsters flee.', false)
      this.write(dest, v)
      return
    }
  }

  private async damage() {
    this.readops(5)
    const [flags, count, sides, bonus, save] = [1, 2, 3, 4, 5].map((i) => this.val(i) & 0xff)
    const party = this.nodes.slice(0, this.B[PARTY_SIZE - B0] || this.nodes.length)
    const dmg = () => bonus + this.roll(count, sides)
    const saved = (c: Uint8Array, kind: number, b: number) => {
      const r = this.roll(1, 20)
      if (r === 1) return false
      if (r === 20) return true
      return c[0x6d + kind] <= r + ((c[0x101] << 24) >> 24) + b
    }
    const hit = (c: Uint8Array) => {
      let r = this.roll(1, 20)
      if (r === 1) return false
      if (r === 20) r = 100
      return c[0x111] < r + save
    }
    const hurt = (c: Uint8Array, d: number) => { c[0x11b] = Math.max(c[0x11b] - d, 0) }
    if (!(flags & 0x80)) {
      for (let i = 0; i < flags; i++) {
        const c = party[this.rand(party.length)]
        if (hit(c)) hurt(c, dmg())
      }
    } else {
      const b = flags & 0x1f, kind = save & 7
      if (!(flags & 0x40)) {
        if (!(save & 0x80)) {
          const c = party[this.rand(party.length)]
          if (!saved(c, kind, b)) hurt(c, dmg())
        } else if (!(kind && saved(this.cur, kind - 1, b))) hurt(this.cur, dmg())
      } else {
        for (const c of party) if (flags & 0x20 || !saved(c, kind, b)) hurt(c, dmg())
      }
    }
    if (party.every((c) => c[0x11b] === 0)) {
      await this.io.engine('party dead')
      this.quit = true
    }
  }

  private async call() {
    this.readops(1)
    const a = this.addr(1)
    if (a === 0x2c90) await this.io.refresh()
    else if (a === 0xba03) {
      const r = this.regs.get(0x3de)
      if (r === 8) this.io.sound(10)
      else if (r === 10) this.io.sound(11)
    }
    else if (a === 0xc01e) {
      const [dx, dy] = STEP[this.facing]
      this.x = (this.x + dx) & 15
      this.y = (this.y + dy) & 15
    } else if (a === 0x8000 || a === 0x8001) this.setupDuel(a === 0x8000)
    // 0xBA03 sound, 0xC018 wall-ahead refresh and 0xC01B (dead in the DOS port) need nothing here
  }

  private async program() {
    this.readops(1)
    if (this.restoreCur) {
      this.cur = this.savedCur
      this.restoreCur = false
    }
    const n = this.val(1)
    if (n === 9) {
      const pc = this.pc
      await this.camp(false)
      this.pc = pc
    } else await this.io.engine(n === 0 ? 'party screen' : n === 8 ? 'ending' : `program ${n}`)
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
   * then enter. Map areas take a 16x16 position; overland areas (25-27) a wilderness position,
   * written to ECL 0x49C3/0x49C4 as the harbour script does before its boats leave.
   */
  async jump(block: number, area: number, x: number, y: number, facing = this.facing) {
    this.setBlock(block)
    this.A[AREA_ID - A0] = this.area
    this.area = area
    if (area >= 25 && area <= 27) {
      this.A[0x49c3 - A0] = x
      this.A[0x49c4 - A0] = y
      this.A[0x4a9e - A0] = 0 // not inside a lair: areas 25-27 hold the lair maps too (on_enter tests 255)
    } else {
      this.x = x & 15
      this.y = y & 15
    }
    this.facing2 = (facing & 3) * 2
    this.loadEcl(area)
    this.resetVm(false)
    this.stop = false
    this.stack = []
    await this.enter()
  }

  /** Overland travel (areas 25-27 once on_enter cleared ECL 0x49E6, spec/architecture.md). */
  get overland(): boolean {
    return this.A[NO_OVERLAND - A0] === 0 && this.area >= 25 && this.area <= 27
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
    return this.itemTableCache
  }

  /** Attach a member's item and effect files (CHRDAT*.ITM / .SPC) after newGame or loadSave. */
  attachFiles(i: number, itm?: Uint8Array, spc?: Uint8Array) {
    const node = this.nodes[i]
    if (!node) return
    this.inventory.set(node, parseItems(itm))
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
      if (Overland.river(t) && this.A[0x4aa2 - A0] === 0) this.io.print("The river's stench drives you back.", false)
      else if (!Overland.blocked(t)) {
        this.A[0x49c3 - A0] = x
        this.A[0x49c4 - A0] = y
        await advanceClock(this, 12, HOUR)
      }
    }
    await this.io.refresh()
    this.areaChanged = false
    await this.run(this.vectors[1])
    if (this.areaChanged) await this.enter()
    await this.io.refresh()
  }

  /** FUN_29c3_31b4: re-enter after an area change. */
  async enter() {
    for (;;) {
      this.areaChanged = false
      this.B[EDGE - B0] = 0
      await this.run(this.vectors[4])
      if (this.quit) return
      this.areaChanged = false
      await this.run(this.vectors[0])
      if (!this.areaChanged && !this.quit) await this.run(this.vectors[1])
      await this.io.refresh()
      if (!this.areaChanged || this.quit) return
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
    const n = this.party().length
    this.nodes.splice(n, 0, c)
    this.B[PARTY_SIZE - B0] = n + 1
    this.inventory.set(c, parseItems(itm))
    this.effects.set(c, parseEffects(spc))
    if (!this.cur) this.cur = this.savedCur = c
    return c
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
      if (c !== 'b') this.io.sound(10) // FUN_3e76_0989: quarter turns step, turning round is silent
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
        this.io.sound(10) // main loop: footstep when the position changed
      } else {
        blocked = p === 0 ? 1 : 2
        this.io.sound(7) // FUN_3e76_0d6d: bump, or the door held
      }
    }
    await this.io.refresh()
    if (blocked === 1) await this.io.engine('blocked')
    this.areaChanged = false
    await this.run(this.vectors[1])
    if (this.areaChanged) await this.enter()
    await this.io.refresh()
  }
}
