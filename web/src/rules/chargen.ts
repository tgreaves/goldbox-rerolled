// Character creation (FUN_417f_056c) and the derived-statistics routines it calls.
// Tables are read at runtime from the data segment of the player's START.EXE; nothing from the
// game is embedded here. Behaviour, including the original's quirks, follows spec/chargen.md.

import { R } from '../games/rules'
import { T } from '../games/tables'
import { F } from '../games/fields'

export class Tables {
  private readonly img: Uint8Array
  private readonly ds: number
  /** the active game's data segment unless given */
  constructor(image: Uint8Array, ds = T.ds) { this.img = image; this.ds = ds }
  b(off: number) { return this.img[this.ds + off] }
  s(off: number) { return (this.img[this.ds + off] << 24) >> 24 }
  w(off: number) { return this.img[this.ds + off] | (this.img[this.ds + off + 1] << 8) }
}

export const RACE_MENU = [1, 2, 3, 4, 5, 7] // Dwarf, Elf, Gnome, Half-Elf, Halfling, Human (Half-Orc never offered)
const CLERIC_MULTI = new Set([8, 9, 10, 11, 12])
/** component classes of each class id (0-7 single, 8-16 multi-class) */
export const COMPONENTS: number[][] = [[0], [1], [2], [3], [4], [5], [6], [7],
  [0, 2], [0, 2, 5], [0, 4], [0, 5], [0, 6], [2, 5], [2, 6], [2, 5, 6], [5, 6]]
/** age column used for each multi-class (maximum age of that column) */
const AGE_COLUMN: Record<number, number> = { 8: 0, 9: 0, 11: 0, 12: 0, 13: 5, 15: 5, 16: 5, 14: 2 }

export type Rng = (n: number) => number // 0..n-1
const roll = (rng: Rng, count: number, sides: number) => {
  let t = 0
  for (let i = 0; i < count; i++) t += rng(sides) + 1
  return t
}

/** Classes offered for a race (DS:3E17 + race·12: count, ids). */
export function classesFor(t: Tables, race: number): number[] {
  const o = T.raceClasses.at + race * T.raceClasses.row
  return Array.from({ length: t.b(o) }, (_, i) => t.b(o + 1 + i))
}

/** Alignments offered for a class (DS:3FE7 + class·10: count, ids). */
export function alignmentsFor(t: Tables, cls: number): number[] {
  const o = T.alignments.at + cls * T.alignments.row
  return Array.from({ length: t.b(o) }, (_, i) => t.b(o + 1 + i))
}

/** Portrait record ids: head n (1-14) → HEAD3 record DS:286F[n], body n (1-12) → BODY3 record DS:287D[n]. */
export const headRecord = (t: Tables, n: number) => t.b(T.headRecords.at + n)
export const bodyRecord = (t: Tables, n: number) => t.b(T.bodyRecords.at + n)

/** Start a character: steps 1-6 of spec/chargen.md (race, gender, class, alignment, age). */
export function begin(t: Tables, rng: Rng, race: number, gender: number, cls: number, alignment: number): Uint8Array {
  const c = new Uint8Array(F.size)
  c[F.race] = race
  c[F.cls] = cls
  c[F.gender] = gender
  c[F.alignment] = alignment
  c[F.iconSize] = race === 1 || race === 3 || race === 5 ? 1 : 2
  c[F.thac0Base] = 40
  c[F.sizeFlags] = 1
  c[F.hitDice] = 1
  c[F.acBase] = 50
  c[F.id] = rng(256)
  c[F.head] = 1
  c[F.body] = 1
  ;[0x91, 0xa2, 0xb3, 0xc4, 0xe6, 0xf7].forEach((v, i) => (c[F.iconColours + i] = v))
  c[F.inPlay] = 1
  let bits = 0
  for (const k of COMPONENTS[cls]) {
    c[F.levels + k] = 1
    bits |= t.b(T.classBits.at + k)
    c[F.thac0Base] = Math.max(c[F.thac0Base], t.b(T.thac0.at + k * T.thac0.row + 1))
  }
  c[F.itemMask] = bits
  if (c[F.levels + 6]) thiefSkills(t, c) // runs before abilities exist, so with DEX 0 (as the original)
  saves(t, c)
  // age: single class base + NdS; multi-class the maximum of one column
  let age: number
  if (cls < 8) {
    const o = T.startAge.at + race * T.startAge.row + cls * 4
    age = t.w(o) + roll(rng, t.b(o + 2), t.b(o + 3))
  } else {
    const o = T.startAge.at + race * T.startAge.row + (AGE_COLUMN[cls] ?? 0) * 4
    age = t.w(o) + t.b(o + 2) * t.b(o + 3)
  }
  c[F.age] = age & 0xff
  c[F.age + 1] = age >> 8
  return c
}

/** Step 7: roll abilities, HP, gold and spells (repeated on "No" to "Keep this character?"). */
export function rollAbilities(t: Tables, rng: Rng, c: Uint8Array) {
  const race = c[F.race], cls = c[F.cls], gender = c[F.gender]
  const age = c[F.age] | (c[F.age + 1] << 8)
  const thr = (i: number) => t.w(T.ageing.at + race * T.ageing.row + i * 2)
  const lim = T.raceLimits.at + race * T.raceLimits.row
  c[F.strPct] = 0
  for (let a = 0; a < 6; a++) {
    // best of six 3d6 (the racial adjustments inside this loop are dead code in the original)
    c[F.stat[a]] = 0
    for (let i = 0; i < 6; i++) c[F.stat[a]] = Math.max(c[F.stat[a]], roll(rng, 3, 6))
    let v = c[F.stat[a]]
    const older = (i: number) => age > thr(i)
    if (a === 0) {
      if (v && older(0)) v++
      if (v && older(1)) v--
      if (v && older(2)) v -= 2
      if (v && older(3)) v--
      v = Math.max(v, t.b(lim + gender))
      v = Math.min(v, t.b(lim + 2 + gender))
    } else {
      if (a === 1) { if (older(1)) v++; if (older(3)) v++ }
      if (a === 2) { if (age <= thr(0)) v--; if (older(1)) v++; if (older(2)) v++; if (older(3)) v++ }
      if (a === 3) { if (older(2)) v -= 2; if (older(3)) v-- }
      if (a === 4) { if (older(1)) v--; if (older(2)) v--; if (older(3)) v-- }
      v = Math.max(v, t.b(lim + 4 + a * 2))
      v = Math.min(v, t.b(lim + 5 + a * 2))
    }
    v = Math.max(v, t.b(T.classMins.at + cls * T.classMins.row + a))
    if (a === 2 && v < 13 && CLERIC_MULTI.has(cls)) v = 13
    c[F.stat[a]] = v & 0xff
    if (a === 0 && v === 18 && c[F.levels + 2] > 0) {
      c[F.strPct] = Math.min(rng(100) + 1, t.b(lim + 4 + gender))
    }
  }
  c[F.attacksBase] = 2
  c[F.natDice] = 1
  c[F.natSides] = 2
  c[F.strAdj] = 1
  c[F.baseMove] = 12
  // gold, level-1 spell slots and known spells
  let gold = 0, classes = 0
  for (let k = 0; k < 8; k++) {
    if (!c[F.levels + k]) continue
    if (k === 0) c[F.clericSlots] = 1
    else if (k === 5) c[F.muSlots] = 1
    gold += roll(rng, t.b(T.startGold.at + k * T.startGold.row), t.b(T.startGold.at + k * T.startGold.row + 1))
    classes++
    if (k === 0) {
      wisdomBonus(c)
      for (let id = 1; id <= R.spells.named; id++) if (t.b(T.spellRecords.at + id * T.spellRecords.row) === R.spells.cleric && t.b(T.spellRecords.at + id * T.spellRecords.row + 1) === 1) c[F.known + id] = 1
    } else if (k === 5) {
      c[F.known + 11] = c[F.known + 18] = c[F.known + 19] = c[F.known + 21] = 1 // Detect Magic, Read Magic, Shield, Sleep
    }
  }
  const g = Math.floor((gold * 10) / classes)
  c[F.money + 6] = g & 0xff
  c[F.money + 7] = g >> 8
  // hit points (FUN_417f_4235, FUN_417f_3f31)
  const hpRoll = hitDice(t, rng, c)
  c[F.hpRolled] = hpRoll & 0xff
  c[F.maxHp] = hpRoll & 0xff
  const con = conBonus(t, c)
  if (con < 0 && Math.abs(con) + classes >= c[F.maxHp]) c[F.maxHp] = 1
  else c[F.maxHp] = Math.trunc((c[F.maxHp] + con) / classes) & 0xff
  c[F.hp] = c[F.maxHp]
  c[F.hpRolled] = Math.floor(c[F.hpRolled] / classes)
  combatStats(c)
}

export function hitDice(t: Tables, rng: Rng, c: Uint8Array): number {
  if (R.hpModel === 'coab') return coabHitDice(t, rng, c, [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => c[F.levels + k] > 0)) & 0xff
  let sum = 0
  for (let k = 0; k < 8; k++) {
    if (!c[F.levels + k]) continue
    const sides = t.b(T.hitDiceSides.at + k)
    let r = roll(rng, t.b(T.hitDiceCount.at + k), sides)
    if (c[F.levels + k] === 1 && r < Math.floor((sides * 2) / 3)) r = Math.floor((sides * 2) / 3)
    sum += r
  }
  return sum & 0xff
}

/**
 * CotAB's hit-point roll (FUN 0x3b230) for the classes given, at their current levels: below the
 * class's stop level (DS:3EBB) the dice (the full count at level 1, one die after) rolled twice,
 * the higher kept; from the stop level the class's fixed hit points, which replace the sum so far
 * rather than add to it (the original's quirk, spec/coab/tables.md §3.4).
 */
export function coabHitDice(t: Tables, rng: Rng, c: Uint8Array, classes: number[]): number {
  let sum = 0
  for (const k of classes) {
    const L = c[F.levels + k]
    if (L < t.b(T.hitDiceStop.at + k)) {
      const n = L > 1 ? 1 : t.b(T.hitDiceCount.at + k), sides = t.b(T.hitDiceSides.at + k)
      sum += Math.max(roll(rng, n, sides), roll(rng, n, sides))
    } else sum = R.fixedHp[k] ?? 2
  }
  return sum
}

export function conBonus(t: Tables, c: Uint8Array): number {
  let b = 0
  for (let k = 0; k < 8; k++) {
    if (!c[F.levels + k]) continue
    b += t.s(T.conHp.at + c[F.stat[4]])
    if (c[F.stat[4]] > 16 && c[F.cls] === 2) b++
    if (c[F.stat[4]] > 17 && c[F.cls] === 2) b++
  }
  return (b << 24) >> 24
}

export function wisdomBonus(c: Uint8Array) {
  const wis = c[F.stat[2]]
  if (wis > 12 && c[F.clericSlots]) c[F.clericSlots]++
  if (wis > 13 && c[F.clericSlots]) c[F.clericSlots]++
  if (wis > 14 && c[F.clericSlots + 1]) c[F.clericSlots + 1]++
  if (wis > 15 && c[F.clericSlots + 1]) c[F.clericSlots + 1]++
  if (wis > 16 && c[F.clericSlots + 2]) c[F.clericSlots + 2]++
}

/** FUN_51cf_0255 */
export function saves(t: Tables, c: Uint8Array) {
  for (let i = 0; i < 5; i++) {
    c[F.saves + i] = 20
    for (let k = 0; k < 8; k++) {
      if (c[F.levels + k] > 0) c[F.saves + i] = Math.min(c[F.saves + i], t.b(T.saves.at + k * T.saves.row + c[F.levels + k] * 5 + i))
    }
  }
}

/** FUN_51cf_0329 */
export function thiefSkills(t: Tables, c: Uint8Array) {
  for (let s = 1; s <= 8; s++) {
    const base = t.b(T.thiefBase.at + c[F.levels + 6] * T.thiefBase.row + s)
    const race = t.s(T.thiefRace.at + c[F.race] * T.thiefRace.row + s)
    if (race < 0 && base < -race) c[F.thief + s - 1] = 0
    else {
      let v = base + race
      if (s < 6) v += t.s(T.thiefDex.at + c[F.stat[3]] * T.thiefDex.row + s)
      c[F.thief + s - 1] = v & 0xff
    }
  }
}

/** Strength index (FUN_10ba_11ea): 3-18, then 18/xx bands 19-23, then 19-25 → 24-30. */
export function strIndex(c: Uint8Array): number {
  const s = c[F.stat[0]]
  if (s < 18) return s
  if (s === 18) {
    const p = c[F.strPct]
    if (p === 0) return 18
    if (p <= 50) return 19
    if (p <= 75) return 20
    if (p <= 90) return 21
    if (p <= 99) return 22
    return 23
  }
  return s <= 25 ? s + 5 : s
}

function strToHit(i: number) {
  if (i <= 3) return -3
  if (i <= 5) return -2
  if (i <= 7) return -1
  if (i <= 16) return 0
  if (i <= 19) return 1
  if (i <= 22) return 2
  if (i <= 25) return 3
  if (i <= 27) return 4
  return i - 23
}

function strDamage(i: number) {
  if (i >= 1 && i <= 2) return -2
  if (i >= 3 && i <= 5) return -1
  if (i === 16) return 1
  if (i >= 17 && i <= 19) return i - 16
  if (i >= 20 && i <= 29) return i - 17
  if (i === 30) return 14
  return 0
}

function dexAc(d: number) {
  if (d <= 3) return -4
  if (d <= 6) return d - 7
  if (d <= 14) return 0
  if (d <= 18) return d - 14
  if (d <= 20) return 4
  if (d <= 23) return 5
  return 6
}

/** FUN_10ba_0bb8 for a character with no items (as at creation). */
export function combatStats(c: Uint8Array) {
  for (let i = 0; i < 6; i++) c[F.dice + i] = c[F.natDice + i]
  const si = strIndex(c)
  c[F.ac] = (c[F.acBase] + dexAc(c[F.stat[3]])) & 0xff
  c[F.acRear] = (c[F.acBase] - 2) & 0xff
  c[F.move] = c[F.baseMove]
  c[F.thac0] = c[F.thac0Base]
  if (c[F.strAdj]) {
    c[F.thac0] = (c[F.thac0] + strToHit(si)) & 0xff
    c[F.bonus] = (c[F.bonus] + strDamage(si)) & 0xff
  }
  c[F.sweep] = c[F.levels + 2] || 1
  let coins = 0
  for (let i = 0; i < 7; i++) coins += c[F.money + 2 * i] | (c[F.money + 2 * i + 1] << 8)
  c[F.load] = coins & 0xff
  c[F.load + 1] = coins >> 8
}

/** Set the name (≤ 15 characters, upper case, 0x20-0x7A). */
export function setName(c: Uint8Array, name: string) {
  const n = [...name.toUpperCase()].filter((ch) => ch >= ' ' && ch <= 'z').join('').slice(0, 15)
  c[F.name] = n.length
  for (let i = 0; i < 15; i++) c[F.name + 1 + i] = i < n.length ? n.charCodeAt(i) : 0
}

/** The file stem the original derives from the name: drop ` .*,?/\:;|`, cut to 8. */
export function fileStem(name: string) {
  return name.toUpperCase().replace(/[ .*,?/\\:;|]/g, '').slice(0, 8) || 'NONAME'
}

// ------------------------------------------------------------------ Modify (FUN_417f_209f)

/** FUN_417f_3fb3: lowest max HP Modify allows. */
export function hpMin(t: Tables, c: Uint8Array): number {
  let dice = 0, classes = 0
  for (let k = 0; k < 8; k++) {
    if (c[F.levels + k] <= 0) continue
    dice += c[F.levels + k]
    classes++
    if (k === 4 || k === 7) dice++
  }
  return withCon(t, c, dice, classes)
}

/** FUN_417f_408c: highest max HP Modify allows (levels × die size). */
export function hpMax(t: Tables, c: Uint8Array): number {
  const die = [8, 8, 10, 10, 8, 4, 6, 4]
  let sum = 0, classes = 0
  for (let k = 0; k < 8; k++) {
    if (c[F.levels + k] <= 0) continue
    classes++
    sum += (c[F.levels + k] + (k === 4 || k === 7 ? 1 : 0)) * die[k]
  }
  return withCon(t, c, sum & 0xff, classes)
}

function withCon(t: Tables, c: Uint8Array, v: number, classes: number) {
  const con = conBonus(t, c)
  if (con < 0 && Math.abs(con) + classes >= v) return 1
  return Math.trunc((v + con) / classes) & 0xff
}

/** Racial limits for ability a (0 STR … 5 CHA): [min, max] (STR by gender). */
export function abilityRange(t: Tables, c: Uint8Array, a: number): [number, number] {
  const lim = T.raceLimits.at + c[F.race] * T.raceLimits.row
  if (a === 0) return [t.b(lim + c[F.gender]), t.b(lim + 2 + c[F.gender])]
  return [t.b(lim + 4 + a * 2), t.b(lim + 5 + a * 2)]
}

/** One Modify step on field f (0-5 abilities, 6 HP) by +1 or -1, with the original's rules and quirks. */
export function modifyStep(t: Tables, c: Uint8Array, f: number, delta: 1 | -1) {
  if (f === 6) {
    const v = c[F.maxHp] + delta
    if (v >= hpMin(t, c) && v <= hpMax(t, c)) c[F.maxHp] = c[F.hp] = v
    return
  }
  const [lo, hi] = abilityRange(t, c, f)
  const classMin = t.b(T.classMins.at + c[F.cls] * T.classMins.row + f)
  if (delta > 0) {
    if (c[F.stat[f]] + 1 > hi) {
      const cap = t.b(T.raceLimits.at + c[F.race] * T.raceLimits.row + 4 + c[F.gender])
      if (f === 0 && c[F.stat[0]] === 18 && c[F.levels + 2] > 0 && c[F.strPct] < cap) c[F.strPct]++
    } else c[F.stat[f]]++
  } else if (f === 0 && c[F.strPct] > 0) {
    c[F.strPct]--
  } else {
    const v = c[F.stat[f]] - 1
    // quirk: dropping below the racial or the class minimum jumps to the racial minimum
    c[F.stat[f]] = v < lo || v < classMin ? lo : v
  }
  if (f === 2 && c[F.clericSlots]) {
    c[F.clericSlots] = 1
    wisdomBonus(c)
  }
  if (f === 4) {
    const min = hpMin(t, c), max = hpMax(t, c)
    c[F.maxHp] = c[F.hp] = Math.min(Math.max(c[F.maxHp], min), max)
  }
  combatStats(c)
}
