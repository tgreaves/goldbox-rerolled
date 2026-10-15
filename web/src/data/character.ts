// Character records, 0x11D bytes (spec/records.md)

export const RACES = ['Monster', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling', 'Half-Orc', 'Human']
export const CLASSES = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk',
  'Cleric/Fighter', 'Cleric/Fighter/Magic-User', 'Cleric/Ranger', 'Cleric/Magic-User', 'Cleric/Thief',
  'Fighter/Magic-User', 'Fighter/Thief', 'Fighter/Magic-User/Thief', 'Magic-User/Thief', 'Monster']
export const ALIGNMENTS = ['Lawful Good', 'Lawful Neutral', 'Lawful Evil', 'Neutral Good', 'True Neutral',
  'Neutral Evil', 'Chaotic Good', 'Chaotic Neutral', 'Chaotic Evil']
export const STATUS = ['Okay', 'Animated', 'tempgone', 'Running', 'Unconscious', 'Dying', 'Dead', 'Stoned']
export const MONEY = ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum', 'Gems', 'Jewelry']
const BASE_CLASSES = CLASSES.slice(0, 8)

export const CHAR_SIZE = 0x11d

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
  const levels = BASE_CLASSES.map((cls, i) => ({ cls, level: d[0x96 + i] })).filter((l) => l.level > 0)
  const bonus = (d[0x119] << 24) >> 24
  return {
    raw: d,
    name: String.fromCharCode(...d.subarray(1, 1 + d[0])),
    stats: { STR: d[0x10], INT: d[0x11], WIS: d[0x12], DEX: d[0x13], CON: d[0x14], CHA: d[0x15] },
    strPct: d[0x16],
    race: pick(RACES, d[0x2e]),
    cls: pick(CLASSES, d[0x2f]),
    age: u16(d, 0x30),
    hpMax: d[0x32],
    hp: d[0x11b],
    ac: 60 - d[0x111],
    thac0: 60 - d[0x110],
    levels,
    gender: d[0x9e] ? 'Female' : 'Male',
    alignment: pick(ALIGNMENTS, d[0xa0]),
    exp: (d[0xac] | (d[0xad] << 8) | (d[0xae] << 16) | (d[0xaf] << 24)) >>> 0,
    status: pick(STATUS, d[0x10c]),
    money: MONEY.map((_, i) => u16(d, 0x88 + 2 * i)),
    npc: d[0x84] >= 0x80,
    damage: `${d[0x115]}d${d[0x117]}${bonus ? (bonus > 0 ? '+' : '') + bonus : ''}`,
    movement: d[0x11c],
  }
}
