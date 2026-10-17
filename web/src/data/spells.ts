// Spell tables (spec/spells.md): names at DS:2912 (56 × 41-byte Pascal strings) and 16-byte records
// at DS:31FA + id × 16, read from the player's START.EXE. Spell id = 1..56.
import { unexepack } from './exepack'

const DS = 0xc7c0

export interface Spell {
  id: number
  name: string
  /** 0 cleric, 1 magic-user, 2 item only */
  cls: number
  level: number
  /** range = r0 + r1 × caster level; r0 = 0xFF touch */
  range: [number, number]
  /** duration = d0 + d1 × caster level (minutes) */
  duration: [number, number]
  /** target mode: 0 self, 4 one, 6/7 several, 8–11 area, 31 silence, 240 special */
  target: number
  /** side: 0 enemy (combat-only outside), 1 self, 2 ally, 4 party */
  side: number
  /** 0 none, 1 negates, 2 half, 3 special */
  save: number
  saveType: number
  /** effect type added to targets (0 = immediate only) */
  effect: number
  /** 0 camp only, 1 combat only, 2 both */
  where: number
  castTime: number
  aiPriority: number
  aiHostile: number
  area: number
}

export class SpellTables {
  readonly spells: Spell[] = [] // index = id − 1

  constructor(image: Uint8Array) {
    // 57–67 are the item-only spells (class 2): records follow on, with no names (the names table holds 56)
    for (let id = 1; id <= 67; id++) {
      const n = DS + 0x2912 + (id - 1) * 41
      const r = image.subarray(DS + 0x31fa + id * 16, DS + 0x31fa + id * 16 + 16)
      this.spells.push({
        id, name: id <= 56 ? String.fromCharCode(...image.subarray(n + 1, n + 1 + image[n])) : '',
        cls: r[0], level: r[1], range: [r[2], r[3]], duration: [r[4], r[5]], target: r[6], side: r[7],
        save: r[8], saveType: r[9], effect: r[10], where: r[11], castTime: r[12], aiPriority: r[13], aiHostile: r[14], area: r[15],
      })
    }
  }

  static load(startExe: Uint8Array | undefined): SpellTables | null {
    if (!startExe) return null
    try { return new SpellTables(unexepack(startExe).image) } catch { return null }
  }

  get(id: number): Spell | undefined {
    return this.spells[(id & 0x7f) - 1]
  }
}
