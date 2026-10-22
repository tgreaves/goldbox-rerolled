// Dual-classing: CotAB's "Human Change Classes" (0x5135D, offered by the party screen a training hall
// opens, 0x36A1C), spec/A-games/coab/chargen-and-progression.md and spec/B-model/procedures.md §7.2. The profile's
// R.dualClass says who may and the ability rule; a game without it (PoR) never offers the function.
import { R } from '../games/rules'
import { F } from '../games/fields'
import { T } from '../games/tables'
import { CLASSES } from '../data/character'
import type { Item, ItemTables } from '../data/items'
import { alignmentsFor, classesFor, saves, thiefSkills, type Tables } from './chargen'
import { derive, putAwayUnusable, setU32 } from './training'

const s8 = (v: number) => (v << 24) >> 24
/** what the class routines return for "none" (0x5171A, 0x51776) */
export const NO_CLASS = 0x11

/** 0x51776: the first class (0–6) whose level is not 0, if that level is above 0 (else class 7's). */
export function currentClass(c: Uint8Array): number {
  let k = 0
  while (k < 7 && c[F.levels + k] === 0) k++
  return s8(c[F.levels + k]) > 0 ? k : NO_CLASS
}

/** 0x5171A: the same over the former levels: the class a dual-class character left. */
export function formerClass(c: Uint8Array): number {
  if (F.prevLevels < 0) return NO_CLASS
  let k = 0
  while (k < 7 && c[F.prevLevels + k] === 0) k++
  return s8(c[F.prevLevels + k]) > 0 ? k : NO_CLASS
}

/** 0x517D2: the level of the first class (0–6) whose level is not 0 (else class 7's). */
export function currentLevel(c: Uint8Array): number {
  let k = 0
  while (k < 7 && c[F.levels + k] === 0) k++
  return c[F.levels + k]
}

/**
 * Whether the party screen offers the function for this character (0x36A93): the game has
 * dual-classing, the character is of its race (0x51822), and has never changed class (0x5171A).
 */
export function offersChangeClass(c: Uint8Array): boolean {
  const d = R.dualClass
  return d !== null && F.prevLevels >= 0 && c[F.race] === d.race && formerClass(c) === NO_CLASS
}

/** The abilities a class requires at least `min` in (its minima at or above the profile's prime level). */
function primesMet(t: Tables, c: Uint8Array, cls: number, min: number): boolean {
  const d = R.dualClass!
  for (let a = 0; a < 6; a++) {
    if (t.b(T.classMins.at + cls * T.classMins.row + a) < d.primeFrom) continue
    if (c[F.baseStat[a]] < min) return false
  }
  return true
}

/**
 * 0x511AE: whether the character may change to class `k` (one of the race's classes): not the
 * current class; the current class's prime abilities at the old level and the new class's at the
 * new (base abilities); an alignment the new class allows.
 */
export function canChangeTo(t: Tables, c: Uint8Array, k: number): boolean {
  const d = R.dualClass
  if (!d) return false
  const cur = currentClass(c)
  if (k === cur) return false
  if (!primesMet(t, c, cur, d.oldAtLeast)) return false
  if (!primesMet(t, c, k, d.newAtLeast)) return false
  return alignmentsFor(t, k).includes(c[F.alignment])
}

/** The "Pick New Class" list (0x513C2): the race's classes in its table order, those allowed. */
export function changeClassChoices(t: Tables, c: Uint8Array): number[] {
  return classesFor(t, c[F.race]).filter((k) => canChangeTo(t, c, k))
}

/**
 * 0x51521: the change itself. Experience 0, 2 attacks; the old class's level is kept as its former
 * level and the highest level (+0xE5) as the change level (+0xE6), the highest level then 1; the old
 * class's level 0, the new one's 1; every spell slot cleared, a new cleric or magic-user given the
 * first-level slot (and a magic-user the starting spells); the class byte; the memorised spells
 * cleared; then the recalculation, saves and thief skills (these always, so a former thief's fall to
 * the level-0 row), and every item the new class mask does not allow put away unless cursed.
 */
export function changeClass(t: Tables, c: Uint8Array, k: number, items?: Item[], itemTables?: ItemTables) {
  setU32(c, F.xp, 0)
  c[F.attacksBase] = 2
  const level = currentLevel(c)
  const cur = currentClass(c)
  c[F.prevLevels + cur] = level
  c[F.hpLevel] = c[F.hitDice]
  c[F.hitDice] = 1
  c[F.levels + cur] = 0
  c[F.levels + k] = 1
  for (const pool of [F.clericSlots, F.druidSlots, F.muSlots]) if (pool >= 0) for (let i = 0; i < F.slotLevels; i++) c[pool + i] = 0
  if (k === 0) c[F.clericSlots] = 1
  else if (k === 5) {
    c[F.muSlots] = 1
    for (const id of R.dualClass?.spells ?? R.startSpells) c[F.known + id] = 1
  }
  c[F.cls] = k
  for (let i = 0; i < F.memorisedCount; i++) c[F.memorised + i] = 0
  // 0x5168A: the recalculation 0x50836; the cleric slots again from scratch (0x50AF6 with 1, the
  // same result here); saves 0x50C6B; thief skills 0x50F5A
  derive(t, c, items, itemTables)
  saves(t, c, items)
  thiefSkills(t, c, items)
  if (items && itemTables) putAwayUnusable(c, items, itemTables, false)
}

/** The class's name as the game spells it (T.classNames). */
export const className = (k: number) => CLASSES[k] ?? `#${k}`
