// Character records in the active game's layout (spec/A-games/engine/records.md; CotAB spec/A-games/coab/records.md §2)

import { F } from '../games/fields'
import { T, type TableRef } from '../games/tables'

// The names come from the game's own START.EXE tables (installNames); until then they show as #n.
export const RACES: string[] = []
export const CLASSES: string[] = []
export const ALIGNMENTS: string[] = []
export const STATUS: string[] = []
export const GENDERS: string[] = []
export const MONEY: string[] = []
/** coin values (T.coinValues): copper, silver, electrum, gold, platinum in units where gold is 200 */
export const COIN_VALUES: number[] = []

/** Fill the name lists from START.EXE's load image (T.raceNames … T.coinNames). */
export function installNames(image: Uint8Array) {
  const read = (t: TableRef, n: number) => Array.from({ length: n }, (_, i) => {
    const o = T.ds + t.at + i * t.row
    return String.fromCharCode(...image.subarray(o + 1, o + 1 + image[o]))
  })
  const fill = (list: string[], names: string[]) => list.splice(0, list.length, ...names)
  fill(RACES, read(T.raceNames, 8))
  fill(CLASSES, [...read(T.classNames, 17), RACES[0]]) // class 17, monsters, takes race 0's name
  fill(ALIGNMENTS, read(T.alignmentNames, 9))
  fill(STATUS, read(T.statusNames, 9))
  fill(GENDERS, read(T.genderNames, 2))
  fill(MONEY, read(T.coinNames, 7))
  const u32 = (o: number) => (image[o] | (image[o + 1] << 8) | (image[o + 2] << 16) | (image[o + 3] << 24)) >>> 0
  COIN_VALUES.splice(0, COIN_VALUES.length, ...Array.from({ length: 5 }, (_, i) => u32(T.ds + T.coinValues.at + i * T.coinValues.row)))
}

const pick = (t: string[], i: number) => t[i] ?? `#${i}`
const u16 = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8)

export interface Character {
  raw: Uint8Array
  name: string
  stats: { STR: number; INT: number; WIS: number; DEX: number; CON: number; CHA: number }
  strPct: number
  race: string
  cls: string
  age: number
  hpMax: number
  hp: number
  ac: number
  thac0: number
  levels: { cls: string; level: number }[]
  gender: string
  alignment: string
  exp: number
  status: string
  money: number[]
  npc: boolean
  damage: string
  movement: number
}

export function parseCharacter(d: Uint8Array): Character {
  const levels = Array.from({ length: 8 }, (_, i) => ({ cls: pick(CLASSES, i), level: d[F.levels + i] })).filter((l) => l.level > 0)
  const bonus = (d[F.bonus] << 24) >> 24
  return {
    raw: d,
    name: String.fromCharCode(...d.subarray(F.name + 1, F.name + 1 + d[F.name])),
    stats: { STR: d[F.stat[0]], INT: d[F.stat[1]], WIS: d[F.stat[2]], DEX: d[F.stat[3]], CON: d[F.stat[4]], CHA: d[F.stat[5]] },
    strPct: d[F.strPct],
    race: pick(RACES, d[F.race]),
    cls: pick(CLASSES, d[F.cls]),
    age: u16(d, F.age),
    hpMax: d[F.maxHp],
    hp: d[F.hp],
    ac: 60 - d[F.ac],
    thac0: 60 - d[F.thac0],
    levels,
    gender: pick(GENDERS, d[F.gender]),
    alignment: pick(ALIGNMENTS, d[F.alignment]),
    exp: (d[F.xp] | (d[F.xp + 1] << 8) | (d[F.xp + 2] << 16) | (d[F.xp + 3] << 24)) >>> 0,
    status: pick(STATUS, d[F.status]),
    money: Array.from({ length: 7 }, (_, i) => u16(d, F.money + 2 * i)),
    npc: d[F.morale] >= 0x80,
    damage: `${d[F.dice]}d${d[F.sides]}${bonus ? (bonus > 0 ? '+' : '') + bonus : ''}`,
    movement: d[F.move],
  }
}
