// Wall sets and the 8x8 tile bank (spec/A-games/engine/maps-and-view.md, "Wall sets", "Tile bank").
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, type Picture } from './image'

/** First tile id of each bank: 0 shared, 1-3 wall-set slots, 4 extra (DS:2722). */
const BANK_BASE = [1, 46, 116, 186, 256]
const REBASE_FROM = 45 // DS:272C
const SET_SIZE = 0x30c // 5 wall types x 156 bytes
/** Tiles are loaded with mask colour 13 (FUN_5924_003b → FUN_1464_0111(…, 13, 1, …)) */
export const TILE_MASK_COLOUR = 13
const TYPE_SIZE = 0x9c

/** Piece kinds: start, width, height in tiles (DS:0C8C/0C96/0CA0). */
export const PIECES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [2, 1, 4], [6, 1, 4], [10, 3, 4], [22, 2, 8], [38, 2, 8], [54, 7, 8], [110, 2, 11], [132, 2, 11], [154, 1, 2],
]

export interface WallSlot {
  /** WALLDEF record loaded into this slot (save game A 0x4AFA+i), 0xFFFF when filled by an earlier multi-set record */
  record: number
}

export class WallSets {
  /** 15 wall types x 156 tile ids, as in the engine's table at DS:6A58 */
  readonly table = new Uint8Array(3 * SET_SIZE)
  readonly banks: (Picture[] | undefined)[] = []
  /** per slot 1-3: WALLDEF record loaded there, 0xFFFF when empty or filled by a multi-set record (DS:6AAE + 4·slot) */
  readonly records = [0xffff, 0xffff, 0xffff, 0xffff]
  private readonly files: GameFiles
  private readonly block: number

  constructor(files: GameFiles, block: number) {
    this.files = files
    this.block = block
    this.banks[0] = tiles(files.record('8X8D1', 203))
  }

  /** FUN_55a0_0e08: load WALLDEF<block> record into slots starting at `slot`. */
  load(slot: number, record: number) {
    const def = this.files.record(`WALLDEF${this.block}`, record)
    // a record the file lacks (SotSB ECL2 #49–51 name record 2 after the two-set #1) leaves the slot as it is
    // (I: the DAX loader returns nothing for a missing id, as for ECL records, 0x88AC)
    if (!def) return
    const sets = Math.floor(def.length / SET_SIZE)
    const shift = BANK_BASE[slot] - BANK_BASE[1]
    for (let f = 0; f < sets && slot + f <= 3; f++) {
      this.records[slot + f] = 0xffff
      const dst = (slot + f - 1) * SET_SIZE
      for (let i = 0; i < SET_SIZE; i++) {
        const v = def[f * SET_SIZE + i]
        this.table[dst + i] = v >= REBASE_FROM ? (v + shift) & 0xff : v
      }
      const tileRecord = sets < 2 ? record : (record || 10) * 10 + f + 1
      this.banks[slot + f] = tiles(this.files.record(`8X8D${this.block}`, tileRecord))
    }
    this.records[slot] = record
  }

  /** LOAD_WALLSETS with 0xFF: the slot is marked empty. */
  clear(slot: number) {
    this.records[slot] = 0xffff
  }

  tile(id: number): Picture | undefined {
    for (let b = BANK_BASE.length - 1; b >= 0; b--) {
      if (id >= BANK_BASE[b]) return this.banks[b]?.[id - BANK_BASE[b]]
    }
    return undefined
  }

  /**
   * Assemble one piece of wall type `type` (1-15) as RGBA-ready indices.
   * Returns palette indices with -1 for transparent pixels (tile 0, or the mask colour 13).
   */
  piece(type: number, kind: number): { width: number; height: number; pixels: Int16Array } {
    const [start, w, h] = PIECES[kind]
    const pixels = new Int16Array(w * 8 * h * 8).fill(-1)
    const base = (type - 1) * TYPE_SIZE + start
    for (let i = 0; i < w * h; i++) {
      const id = this.table[base + i]
      if (!id) continue
      const t = this.tile(id)
      if (!t) continue
      const cx = (i % w) * 8
      const cy = Math.floor(i / w) * 8
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = t.pixels[y * t.width + x]
        pixels[(cy + y) * w * 8 + cx + x] = v === TILE_MASK_COLOUR ? -1 : v
      }
    }
    return { width: w * 8, height: h * 8, pixels }
  }
}

function tiles(record: Uint8Array | undefined): Picture[] | undefined {
  if (!record) return undefined
  return parseRecord(record).frames.map((f) => f.picture)
}
