// Character records, 0x11D bytes (spec/records.md)

import { F } from '../games/fields'

export const RACES = ['Monster', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling', 'Half-Orc', 'Human']
export const CLASSES = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk',
  'Cleric/Fighter', 'Cleric/Fighter/Magic-User', 'Cleric/Ranger', 'Cleric/Magic-User', 'Cleric/Thief',
  'Fighter/Magic-User', 'Fighter/Thief', 'Fighter/Magic-User/Thief', 'Magic-User/Thief', 'Monster']
export const ALIGNMENTS = ['Lawful Good', 'Lawful Neutral', 'Lawful Evil', 'Neutral Good', 'True Neutral',
  'Neutral Evil', 'Chaotic Good', 'Chaotic Neutral', 'Chaotic Evil']
export const STATUS = ['Okay', 'Animated', 'tempgone', 'Running', 'Unconscious', 'Dying', 'Dead', 'Stoned']
export const MONEY = ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum', 'Gems', 'Jewelry']
const BASE_CLASSES = CLASSES.slice(0, 8)

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
  const levels = BASE_CLASSES.map((cls, i) => ({ cls, level: d[F.levels + i] })).filter((l) => l.level > 0)
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
    gender: d[F.gender] ? 'Female' : 'Male',
    alignment: pick(ALIGNMENTS, d[F.alignment]),
    exp: (d[F.xp] | (d[F.xp + 1] << 8) | (d[F.xp + 2] << 16) | (d[F.xp + 3] << 24)) >>> 0,
    status: pick(STATUS, d[F.status]),
    money: MONEY.map((_, i) => u16(d, F.money + 2 * i)),
    npc: d[F.morale] >= 0x80,
    damage: `${d[F.dice]}d${d[F.sides]}${bonus ? (bonus > 0 ? '+' : '') + bonus : ''}`,
    movement: d[F.move],
  }
}
