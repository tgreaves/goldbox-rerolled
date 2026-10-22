// Character creation (FUN_417f_056c) and the derived-statistics routines it calls.
// Tables are read at runtime from the data segment of the player's START.EXE; nothing from the
// game is embedded here. Behaviour, including the original's quirks, follows spec/A-games/engine/chargen-and-progression.md.

import { R, classLevel } from '../games/rules'
import type { Item } from '../data/items'
import type { Effect } from '../data/effects'
import { T } from '../games/tables'
import { F, classIndices } from '../games/fields'
import { random, type Dice } from './dice'

export class Tables {
  private readonly img: Uint8Array
  private readonly ds: number
  /** the active game's data segment unless given */
  constructor(image: Uint8Array, ds = T.ds) { this.img = image; this.ds = ds }
  b(off: number) { return this.img[this.ds + off] }
  s(off: number) { return (this.img[this.ds + off] << 24) >> 24 }
  w(off: number) { return this.img[this.ds + off] | (this.img[this.ds + off + 1] << 8) }
}

// Every draw is a request to the dice source (spec/B-model/host-contracts.md §6): the original rolls
// its NdS through the dice routine (PoR FUN_5216_0de3, CotAB 0x4BE31), one request (N, S) each, and
// takes the identity tag and STR 18/xx from Random (FUN_1af8_11c0, CotAB 0x8F7:0x15EA): (1, n) − 1.

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

/** Start a character: steps 2-6 of spec/A-games/engine/chargen-and-progression.md, "Sequence" (race, gender, class, alignment, age). */
export function begin(t: Tables, dice: Dice, race: number, gender: number, cls: number, alignment: number): Uint8Array {
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
  c[F.id] = random(dice, 256) // PoR 417f:0622, CotAB 0x37047
  c[F.head] = 1
  c[F.body] = 1
  ;[0x91, 0xa2, 0xb3, 0xc4, 0xe6, 0xf7].forEach((v, i) => (c[F.iconColours + i] = v))
  c[F.inPlay] = 1
  // CotAB: a paladin starts with one Cure Disease use (0x3764B)
  if (R.paladin && F.abilityUses >= 0 && R.components[cls]?.includes(3)) c[F.abilityUses] = R.paladin.cureDisease.initial
  let bits = 0
  for (const k of R.components[cls]) {
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
    age = t.w(o) + dice.roll(t.b(o + 2), t.b(o + 3))
  } else {
    const o = T.startAge.at + race * T.startAge.row + (R.ageColumns[cls] ?? 0) * 4
    age = t.w(o) + t.b(o + 2) * t.b(o + 3)
  }
  c[F.age] = age & 0xff
  c[F.age + 1] = age >> 8
  return c
}

/** Step 7: roll abilities, HP, gold and spells (repeated on "No" to "Keep this character?"). */
export function rollAbilities(t: Tables, dice: Dice, c: Uint8Array) {
  const race = c[F.race], cls = c[F.cls], gender = c[F.gender]
  const age = c[F.age] | (c[F.age + 1] << 8)
  const thr = (i: number) => t.w(T.ageing.at + race * T.ageing.row + i * 2)
  const lim = T.raceLimits.at + race * T.raceLimits.row
  c[F.strPct] = 0
  for (let a = 0; a < 6; a++) {
    // best of six 3d6 (the racial adjustments inside this loop are dead code in the original)
    c[F.stat[a]] = 0
    for (let i = 0; i < 6; i++) c[F.stat[a]] = Math.max(c[F.stat[a]], dice.roll(3, 6))
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
    if (a === 2 && v < 13 && R.clericMultis.includes(cls)) v = 13
    c[F.stat[a]] = v & 0xff
    if (a === 0 && v === 18 && c[F.levels + 2] > 0) {
      c[F.strPct] = Math.min(random(dice, 100) + 1, t.b(lim + 4 + gender)) // PoR 417f:14f3, CotAB 0x38152
    }
  }
  c[F.attacksBase] = 2
  c[F.natDice] = 1
  c[F.natSides] = 2
  c[F.strAdj] = 1
  c[F.baseMove] = 12
  // gold, level-1 spell slots and known spells
  let gold = 0, classes = 0
  for (let k = 0; k < F.classCount; k++) {
    if (!c[F.levels + k]) continue
    if (k === 0) c[F.clericSlots] = 1
    else if (k === 5) c[F.muSlots] = 1
    gold += dice.roll(t.b(T.startGold.at + k * T.startGold.row), t.b(T.startGold.at + k * T.startGold.row + 1))
    classes++
    if (k === 0) {
      wisdomBonus(c)
      for (let id = 1; id <= R.spells.named; id++) if (t.b(T.spellRecords.at + id * T.spellRecords.row) === R.spells.cleric && t.b(T.spellRecords.at + id * T.spellRecords.row + 1) === 1) c[F.known + id] = 1
    } else if (k === 5) {
      for (const id of R.startSpells) c[F.known + id] = 1
    }
  }
  const m = R.startMoney, g = m.fixed ?? Math.floor((gold * 10) / classes)
  c[F.money + 2 * m.coin] = g & 0xff
  c[F.money + 2 * m.coin + 1] = g >> 8
  // hit points (FUN_417f_4235, FUN_417f_3f31)
  const hpRoll = hitDice(t, dice, c)
  c[F.hpRolled] = hpRoll & 0xff
  c[F.maxHp] = hpRoll & 0xff
  const con = conBonus(t, c)
  if (con < 0 && Math.abs(con) + classes >= c[F.maxHp]) c[F.maxHp] = 1
  else c[F.maxHp] = Math.trunc((c[F.maxHp] + con) / classes) & 0xff
  c[F.hp] = c[F.maxHp]
  c[F.hpRolled] = Math.floor(c[F.hpRolled] / classes)
  combatStats(c)
  keepBase(c)
}

/** The innate effects of a new character (R.startEffects): race first, then class; permanent, power 0xFF. */
export function startEffects(c: Uint8Array): Effect[] {
  const types = [...(R.startEffects.race[c[F.race]] ?? []), ...(R.startEffects.cls[c[F.cls]] ?? [])]
  return types.map((type) => ({ type, duration: 0, power: 0xff, flag: 0 }))
}

export function hitDice(t: Tables, dice: Dice, c: Uint8Array): number {
  return rollHitDice(t, dice, c, classIndices().filter((k) => c[F.levels + k] > 0)) & 0xff
}

/**
 * The hit dice of the classes given, at their current levels, by the game's rules (R.hitPoints): the
 * class's dice (`laterDice` dice after level 1 where set), the best of `rolls` rolls, at least the
 * level-1 minimum; from the class's stop level (T.hitDiceStop) the fixed amount, replacing the sum so
 * far (CotAB's quirk, spec/A-games/coab/tables.md §3.4). PoR FUN_417f_4235 / training; CotAB FUN 0x3b230.
 */
export function rollHitDice(t: Tables, dice: Dice, c: Uint8Array, classes: number[]): number {
  const hp = R.hitPoints
  let sum = 0
  for (const k of classes) {
    const L = c[F.levels + k]
    if (hp.fixed && T.hitDiceStop.at >= 0 && L >= t.b(T.hitDiceStop.at + k)) { const f = hp.fixed[k]; if (f !== null && f !== undefined) sum = f; continue }
    const n = L > 1 && hp.laterDice !== null ? hp.laterDice : t.b(T.hitDiceCount.at + k), sides = t.b(T.hitDiceSides.at + k)
    let r = dice.roll(n, sides)
    for (let i = 1; i < hp.rolls; i++) r = Math.max(r, dice.roll(n, sides))
    if (hp.firstLevelMin && L === 1) r = Math.max(r, Math.floor((sides * hp.firstLevelMin[0]) / hp.firstLevelMin[1]))
    sum += r
  }
  return sum
}

/**
 * The base (permanent) abilities follow the current ones after creation, Modify, Raise Dead's CON
 * loss or an edit (CotAB keeps both, spec/A-games/coab/records.md §2.1; in PoR they are the same bytes).
 */
export function keepBase(c: Uint8Array) {
  for (let i = 0; i < 6; i++) c[F.baseStat[i]] = c[F.stat[i]]
  c[F.baseStrPct] = c[F.strPct]
}

export function conBonus(t: Tables, c: Uint8Array): number {
  let b = 0
  for (let k = 0; k < F.classCount; k++) {
    if (!c[F.levels + k]) continue
    b += t.s(T.conHp.at + c[F.stat[4]])
    if (c[F.stat[4]] > 16 && c[F.cls] === 2) b++
    if (c[F.stat[4]] > 17 && c[F.cls] === 2) b++
  }
  return (b << 24) >> 24
}

/** The WIS bonus cleric slots (PoR FUN_51cf_01af, CotAB 0x50AF6; R.slots.wisBonus): each step a slot more, if that level has one. */
export function wisdomBonus(c: Uint8Array) {
  const wis = c[F.stat[2]]
  for (const [above, level] of R.slots.wisBonus) if (wis > above && c[F.clericSlots + level - 1]) c[F.clericSlots + level - 1]++
}

/** The first readied item whose handler effect (item +0x3E, ≥ 0x80) is one of `effects`; its effect. */
function readiedEffect(items: Item[] | undefined, effects: number[]): number | null {
  for (const it of items ?? []) {
    const e = it.raw[0x3e]
    if (e > 0x80 && it.raw[0x34] && effects.includes(e & 0x7f)) return e & 0x7f
  }
  return null
}

/** FUN_51cf_0255 (CotAB 0x50C6B, with its CON bonus on one save; items: the readied ones, if known) */
export function saves(t: Tables, c: Uint8Array, items?: Item[]) {
  for (let i = 0; i < 5; i++) {
    c[F.saves + i] = 20
    for (let k = 0; k < F.classCount; k++) {
      if (c[F.levels + k] > 0) c[F.saves + i] = Math.min(c[F.saves + i], t.b(T.saves.at + k * T.saves.row + c[F.levels + k] * 5 + i))
    }
  }
  const sc = R.saveCon
  if (sc) {
    const con = c[F.stat[4]]
    const band = (bands: [number, number][]) => bands.find(([hi]) => con <= hi)?.[1] ?? 0
    let add = con >= 19 ? band(sc.all) : 0
    if ((sc.races.includes(c[F.race]) || readiedEffect(items, [sc.itemEffect]) !== null) && con >= sc.from && con <= 18) add = band(sc.bands)
    c[F.saves + sc.save] = (c[F.saves + sc.save] + add) & 0xff
  }
}

/** FUN_51cf_0329 (CotAB 0x50F5A: the dual-class level, a bonus on every skill, the thief items) */
export function thiefSkills(t: Tables, c: Uint8Array, items?: Item[]) {
  const th = R.thief
  const s8 = (v: number) => (v << 24) >> 24
  let L = th.dualClass ? s8(classLevel(c, 6) & 0xff) : c[F.levels + 6]
  let bonus = th.bonus
  const item = readiedEffect(items, [th.gloves?.effect, th.gauntlets?.effect].filter((x): x is number => x !== undefined))
  let gauntlets = th.gauntlets !== null && item === th.gauntlets.effect
  const gloves = th.gloves !== null && item === th.gloves.effect
  if (gauntlets && L < th.gauntlets!.minLevel) { L = th.gauntlets!.minLevel; gauntlets = false }
  const level = L
  for (let s = 1; s <= 8; s++) {
    if (gloves) {
      const to = th.gloves!.raise[s]
      if (to !== undefined) { if (L < to) { L = to; bonus = 0 } else bonus = th.gloves!.bonus }
    }
    const base = t.b(T.thiefBase.at + L * T.thiefBase.row + s)
    const race = t.s(T.thiefRace.at + c[F.race] * T.thiefRace.row + s)
    let v: number
    if (race < 0 && base < (th.clampWithBonus ? bonus : 0) - race) v = 0
    else {
      v = base + race + bonus
      if (s < 6) v += t.s(T.thiefDex.at + c[F.stat[3]] * T.thiefDex.row + s)
    }
    if (gauntlets) v += th.gauntlets!.bonus
    c[F.thief + s - 1] = v & 0xff
    L = level
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
  for (let k = 0; k < F.classCount; k++) {
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
  for (let k = 0; k < F.classCount; k++) {
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
  keepBase(c)
}
