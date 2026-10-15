// Character creation (FUN_417f_056c) and the derived-statistics routines it calls.
// Tables are read at runtime from the data segment of the player's START.EXE; nothing from the
// game is embedded here. Behaviour, including the original's quirks, follows spec/chargen.md.

import { CHAR_SIZE } from '../data/character'

const DS = 0xc7c0 // data segment (paragraph 0x0C7C) in the START.EXE load image

export class Tables {
  private readonly img: Uint8Array
  constructor(image: Uint8Array) { this.img = image }
  b(off: number) { return this.img[DS + off] }
  s(off: number) { return (this.img[DS + off] << 24) >> 24 }
  w(off: number) { return this.img[DS + off] | (this.img[DS + off + 1] << 8) }
}

export const RACE_MENU = [1, 2, 3, 4, 5, 7] // Dwarf, Elf, Gnome, Half-Elf, Halfling, Human (Half-Orc never offered)
const CLERIC_MULTI = new Set([8, 9, 10, 11, 12])
const CLASS_BITS = [2, 16, 8, 64, 128, 1, 4, 32] // DS:05D6
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
  const n = t.b(0x3e17 + race * 12)
  return Array.from({ length: n }, (_, i) => t.b(0x3e18 + race * 12 + i))
}

/** Alignments offered for a class (DS:3FE7 + class·10: count, ids). */
export function alignmentsFor(t: Tables, cls: number): number[] {
  const n = t.b(0x3fe7 + cls * 10)
  return Array.from({ length: n }, (_, i) => t.b(0x3fe8 + cls * 10 + i))
}

/** Portrait record ids: head n (1-14) → HEAD3 record DS:286F[n], body n (1-12) → BODY3 record DS:287D[n]. */
export const headRecord = (t: Tables, n: number) => t.b(0x286f + n)
export const bodyRecord = (t: Tables, n: number) => t.b(0x287d + n)

/** Start a character: steps 1-6 of spec/chargen.md (race, gender, class, alignment, age). */
export function begin(t: Tables, rng: Rng, race: number, gender: number, cls: number, alignment: number): Uint8Array {
  const c = new Uint8Array(CHAR_SIZE)
  c[0x2e] = race
  c[0x2f] = cls
  c[0x9e] = gender
  c[0xa0] = alignment
  c[0xc0] = race === 1 || race === 3 || race === 5 ? 1 : 2
  c[0x2d] = 40
  c[0x6c] = 1
  c[0x73] = 1
  c[0xa9] = 50
  c[0xab] = rng(256)
  c[0xbb] = 1
  c[0xbc] = 1
  ;[0x91, 0xa2, 0xb3, 0xc4, 0xe6, 0xf7].forEach((v, i) => (c[0xc1 + i] = v))
  c[0x10d] = 1
  let bits = 0
  for (const k of COMPONENTS[cls]) {
    c[0x96 + k] = 1
    bits |= CLASS_BITS[k]
    c[0x2d] = Math.max(c[0x2d], t.b(0x3c7c + k * 11 + 1))
  }
  c[0xb0] = bits
  if (c[0x9c]) thiefSkills(t, c) // runs before abilities exist, so with DEX 0 (as the original)
  saves(t, c)
  // age: single class base + NdS; multi-class the maximum of one column
  let age: number
  if (cls < 8) {
    const o = 0x3e5b + race * 0x1c + cls * 4
    age = t.w(o) + roll(rng, t.b(o + 2), t.b(o + 3))
  } else {
    const o = 0x3e5b + race * 0x1c + (AGE_COLUMN[cls] ?? 0) * 4
    age = t.w(o) + t.b(o + 2) * t.b(o + 3)
  }
  c[0x30] = age & 0xff
  c[0x31] = age >> 8
  return c
}

/** Step 7: roll abilities, HP, gold and spells (repeated on "No" to "Keep this character?"). */
export function rollAbilities(t: Tables, rng: Rng, c: Uint8Array) {
  const race = c[0x2e], cls = c[0x2f], gender = c[0x9e]
  const age = c[0x30] | (c[0x31] << 8)
  const thr = (i: number) => t.w(0x3f31 + race * 10 + i * 2)
  const lim = 0x3da3 + race * 16
  c[0x16] = 0
  for (let a = 0; a < 6; a++) {
    // best of six 3d6 (the racial adjustments inside this loop are dead code in the original)
    c[0x10 + a] = 0
    for (let i = 0; i < 6; i++) c[0x10 + a] = Math.max(c[0x10 + a], roll(rng, 3, 6))
    let v = c[0x10 + a]
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
    v = Math.max(v, t.b(0x3f81 + cls * 6 + a))
    if (a === 2 && v < 13 && CLERIC_MULTI.has(cls)) v = 13
    c[0x10 + a] = v & 0xff
    if (a === 0 && v === 18 && c[0x98] > 0) {
      c[0x16] = Math.min(rng(100) + 1, t.b(lim + 4 + gender))
    }
  }
  c[0xa1] = 2
  c[0xa3] = 1
  c[0xa5] = 2
  c[0xaa] = 1
  c[0x72] = 12
  // gold, level-1 spell slots and known spells
  let gold = 0, classes = 0
  for (let k = 0; k < 8; k++) {
    if (!c[0x96 + k]) continue
    if (k === 0) c[0xb2] = 1
    else if (k === 5) c[0xb5] = 1
    gold += roll(rng, t.b(0x4263 + k * 2), t.b(0x4264 + k * 2))
    classes++
    if (k === 0) {
      wisdomBonus(c)
      for (let id = 1; id <= 0x38; id++) if (t.b(0x31fa + id * 16) === 0 && t.b(0x31fb + id * 16) === 1) c[0x32 + id] = 1
    } else if (k === 5) {
      c[0x3d] = c[0x44] = c[0x45] = c[0x47] = 1 // Detect Magic, Read Magic, Shield, Sleep
    }
  }
  const g = Math.floor((gold * 10) / classes)
  c[0x8e] = g & 0xff
  c[0x8f] = g >> 8
  // hit points (FUN_417f_4235, FUN_417f_3f31)
  const hpRoll = hitDice(t, rng, c)
  c[0xb1] = hpRoll & 0xff
  c[0x32] = hpRoll & 0xff
  const con = conBonus(t, c)
  if (con < 0 && Math.abs(con) + classes >= c[0x32]) c[0x32] = 1
  else c[0x32] = Math.trunc((c[0x32] + con) / classes) & 0xff
  c[0x11b] = c[0x32]
  c[0xb1] = Math.floor(c[0xb1] / classes)
  combatStats(c)
}

function hitDice(t: Tables, rng: Rng, c: Uint8Array): number {
  let sum = 0
  for (let k = 0; k < 8; k++) {
    if (!c[0x96 + k]) continue
    const sides = t.b(0x8be + k)
    let r = roll(rng, t.b(0x8b6 + k), sides)
    if (c[0x96 + k] === 1 && r < Math.floor((sides * 2) / 3)) r = Math.floor((sides * 2) / 3)
    sum += r
  }
  return sum & 0xff
}

function conBonus(t: Tables, c: Uint8Array): number {
  let b = 0
  for (let k = 0; k < 8; k++) {
    if (!c[0x96 + k]) continue
    b += t.s(0x408e + c[0x14])
    if (c[0x14] > 16 && c[0x2f] === 2) b++
    if (c[0x14] > 17 && c[0x2f] === 2) b++
  }
  return (b << 24) >> 24
}

function wisdomBonus(c: Uint8Array) {
  const wis = c[0x12]
  if (wis > 12 && c[0xb2]) c[0xb2]++
  if (wis > 13 && c[0xb2]) c[0xb2]++
  if (wis > 14 && c[0xb3]) c[0xb3]++
  if (wis > 15 && c[0xb3]) c[0xb3]++
  if (wis > 16 && c[0xb4]) c[0xb4]++
}

/** FUN_51cf_0255 */
function saves(t: Tables, c: Uint8Array) {
  for (let i = 0; i < 5; i++) {
    c[0x6d + i] = 20
    for (let k = 0; k < 8; k++) {
      if (c[0x96 + k] > 0) c[0x6d + i] = Math.min(c[0x6d + i], t.b(0x426e + k * 0x2d + c[0x96 + k] * 5 + i))
    }
  }
}

/** FUN_51cf_0329 */
function thiefSkills(t: Tables, c: Uint8Array) {
  for (let s = 1; s <= 8; s++) {
    const base = t.b(0x3cf3 + c[0x9c] * 8 + s)
    const race = t.s(0x3d3b + c[0x2e] * 8 + s)
    if (race < 0 && base < -race) c[0x76 + s] = 0
    else {
      let v = base + race
      if (s < 6) v += t.s(0x3d4e + c[0x13] * 5 + s)
      c[0x76 + s] = v & 0xff
    }
  }
}

/** Strength index (FUN_10ba_11ea): 3-18, then 18/xx bands 19-23, then 19-25 → 24-30. */
export function strIndex(c: Uint8Array): number {
  const s = c[0x10]
  if (s < 18) return s
  if (s === 18) {
    const p = c[0x16]
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
  for (let i = 0; i < 6; i++) c[0x115 + i] = c[0xa3 + i]
  const si = strIndex(c)
  c[0x111] = (c[0xa9] + dexAc(c[0x13])) & 0xff
  c[0x112] = (c[0xa9] - 2) & 0xff
  c[0x11c] = c[0x72]
  c[0x110] = c[0x2d]
  if (c[0xaa]) {
    c[0x110] = (c[0x110] + strToHit(si)) & 0xff
    c[0x119] = (c[0x119] + strDamage(si)) & 0xff
  }
  c[0x6b] = c[0x98] || 1
  let coins = 0
  for (let i = 0; i < 7; i++) coins += c[0x88 + 2 * i] | (c[0x89 + 2 * i] << 8)
  c[0x102] = coins & 0xff
  c[0x103] = coins >> 8
}

/** Set the name (≤ 15 characters, upper case, 0x20-0x7A). */
export function setName(c: Uint8Array, name: string) {
  const n = [...name.toUpperCase()].filter((ch) => ch >= ' ' && ch <= 'z').join('').slice(0, 15)
  c[0] = n.length
  for (let i = 0; i < 15; i++) c[1 + i] = i < n.length ? n.charCodeAt(i) : 0
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
    if (c[0x96 + k] <= 0) continue
    dice += c[0x96 + k]
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
    if (c[0x96 + k] <= 0) continue
    classes++
    sum += (c[0x96 + k] + (k === 4 || k === 7 ? 1 : 0)) * die[k]
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
  const lim = 0x3da3 + c[0x2e] * 16
  if (a === 0) return [t.b(lim + c[0x9e]), t.b(lim + 2 + c[0x9e])]
  return [t.b(lim + 4 + a * 2), t.b(lim + 5 + a * 2)]
}

/** One Modify step on field f (0-5 abilities, 6 HP) by +1 or -1, with the original's rules and quirks. */
export function modifyStep(t: Tables, c: Uint8Array, f: number, delta: 1 | -1) {
  if (f === 6) {
    const v = c[0x32] + delta
    if (v >= hpMin(t, c) && v <= hpMax(t, c)) c[0x32] = c[0x11b] = v
    return
  }
  const [lo, hi] = abilityRange(t, c, f)
  const classMin = t.b(0x3f81 + c[0x2f] * 6 + f)
  if (delta > 0) {
    if (c[0x10 + f] + 1 > hi) {
      const cap = t.b(0x3da3 + c[0x2e] * 16 + 4 + c[0x9e])
      if (f === 0 && c[0x10] === 18 && c[0x98] > 0 && c[0x16] < cap) c[0x16]++
    } else c[0x10 + f]++
  } else if (f === 0 && c[0x16] > 0) {
    c[0x16]--
  } else {
    const v = c[0x10 + f] - 1
    // quirk: dropping below the racial or the class minimum jumps to the racial minimum
    c[0x10 + f] = v < lo || v < classMin ? lo : v
  }
  if (f === 2 && c[0xb2]) {
    c[0xb2] = 1
    wisdomBonus(c)
  }
  if (f === 4) {
    const min = hpMin(t, c), max = hpMax(t, c)
    c[0x32] = c[0x11b] = Math.min(Math.max(c[0x32], min), max)
  }
  combatStats(c)
}
