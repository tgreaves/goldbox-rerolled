// Training (spec/A-games/engine/chargen-and-progression.md, FUN_417f_29ae) and the derived statistics after a level (FUN_51cf_0000).
import { R, slots, formerLevelsCount } from '../games/rules'
import { mayCast } from './magic'
import { T } from '../games/tables'
import { rollHitDice, conBonus, saves, thiefSkills, wisdomBonus, type Tables } from './chargen'
import type { Dice } from './dice'
import { CLASSES, COIN_VALUES } from '../data/character'
import { F } from '../games/fields'
import type { Item, ItemTables } from '../data/items'
import { msg } from '../games/strings'

/** Trainer bit per base class (T.trainerBits): halls match it against their mask (ECL 0x6DA8). */
const trainerBit = (t: Tables, k: number) => t.b(T.trainerBits.at + k)

const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0
const s8 = (v: number) => (v << 24) >> 24
export const setU32 = (c: Uint8Array, o: number, v: number) => { c[o] = v & 0xff; c[o + 1] = (v >> 8) & 0xff; c[o + 2] = (v >> 16) & 0xff; c[o + 3] = (v >>> 24) & 0xff }

/** Experience needed for `level` in base class k (T.xp, u32; 0xFFFFFFFF = cannot reach). */
export function xpFor(t: Tables, k: number, level: number): number {
  const o = T.xp.at + k * T.xp.row + level * 4
  return (t.w(o) | (t.w(o + 2) << 16)) >>> 0
}

/** Demi-human level limits (spec table); 255 = none. STR without exceptional strength. */
export function levelLimit(c: Uint8Array, k: number): number {
  const rule = R.levelLimits.find((x) => x.race === c[F.race] && x.cls === k)
  if (!rule) return 255
  const v = c[F.stat[rule.by]]
  return rule.limits[v < 17 ? 0 : v === 17 ? 1 : 2]
}

/** Coins worth in gp, rounded up (FUN_4894_28be for training). */
const coinsGp = (c: Uint8Array) => {
  const w = (i: number) => c[F.money + 2 * i] | (c[F.money + 2 * i + 1] << 8)
  return Math.ceil([0, 1, 2, 3, 4].reduce((t, i) => t + w(i) * COIN_VALUES[i], 0) / COIN_VALUES[3])
}

/** Payment (FUN_417f_42ed): take coins from copper up, change back from platinum down. */
export function payCoins(c: Uint8Array, gp: number) {
  const values = COIN_VALUES
  let owed = gp * values[3]
  const get = (i: number) => c[F.money + 2 * i] | (c[F.money + 2 * i + 1] << 8)
  const set = (i: number, v: number) => { c[F.money + 2 * i] = v & 0xff; c[F.money + 2 * i + 1] = (v >> 8) & 0xff }
  for (let i = 0; i < 5 && owed > 0; i++) {
    const n = Math.min(get(i), Math.floor(owed / values[i]) + 1)
    set(i, get(i) - n)
    owed -= n * values[i]
  }
  let change = -owed
  for (let i = 4; i >= 0 && change > 0; i--) {
    const n = Math.floor(change / values[i])
    set(i, get(i) + n)
    change -= n * values[i]
  }
}

export interface TrainCheck {
  ok: boolean
  message: string
  /** base classes that will gain a level */
  train: number[]
}

/**
 * Steps 1–6 of FUN_417f_29ae for the current character. Truncates excess experience (step 4),
 * as the original does, even when training is then refused or declined.
 */
export function checkTraining(t: Tables, c: Uint8Array, hallMask: number, cheat = false): TrainCheck {
  if (c[F.status] !== 0 && !cheat) return { ok: false, message: msg('consciousOnly'), train: [] }
  if (coinsGp(c) < R.trainingCost && !cheat) return { ok: false, message: msg('trainingCosts'), train: [] }
  let all = 0, eligible = 0, cap = 0
  const xp = u32(c, F.xp)
  const eligibleClasses: number[] = []
  for (let k = 0; k < 8; k++) {
    const L = c[F.levels + k]
    if (L <= 0) continue
    all |= trainerBit(t, k)
    if (L >= levelLimit(c, k)) continue
    const need = xpFor(t, k, L + 1)
    if (need === 0 || need === 0xffffffff) continue
    if (xp < need && !cheat) continue
    eligible |= trainerBit(t, k)
    eligibleClasses.push(k)
    const N = xpFor(t, k, L + 2)
    if (N !== 0 && N !== 0xffffffff && xp >= N) cap = Math.max(cap, N - 1)
  }
  if (cap > 0) setU32(c, F.xp, cap)
  if (!cheat) {
    if ((all & hallMask) === 0) return { ok: false, message: msg('notThatClass'), train: [] }
    if ((eligible & hallMask) === 0) return { ok: false, message: msg('notEnoughXp'), train: [] }
  }
  const train = eligibleClasses.filter((k) => cheat || (trainerBit(t, k) & hallMask) !== 0)
  return { ok: train.length > 0, message: train.length ? '' : msg('notEnoughXp'), train }
}

export function willBecome(c: Uint8Array, train: number[]): string[] {
  return train.map((k, i) => `${msg(i ? 'andALevel' : 'aLevel')}${c[F.levels + k] + 1} ${CLASSES[k]}`)
}

/** Steps 9–13: pay, gain levels, recompute, then hit points. Returns true if a new MU spell is due. */
export function train(t: Tables, dice: Dice, c: Uint8Array, classes: number[], cheat = false): boolean {
  if (!cheat) payCoins(c, R.trainingCost)
  const k = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => c[F.levels + i] > 0).length
  const oldMU = c[F.levels + 5]
  for (const cls of classes) {
    c[F.levels + cls]++
    if (c[F.drainLevels] > 0) {
      c[F.drainHp] -= Math.floor(c[F.drainHp] / c[F.drainLevels])
      c[F.drainLevels]--
    }
  }
  derive(t, c)
  // CotAB 0x3BE45: hit points only once the highest level passes the level kept at a dual-class
  // change (+0xE6, 0 for everyone else); PoR has no such byte
  if (F.hpLevel < 0 || s8(c[F.hitDice]) > s8(c[F.hpLevel])) levelHp(t, dice, c, classes, k)
  return c[F.levels + 5] > oldMU
}

/**
 * The hit points of one level gained (FUN_417f_29ae step 6): rolls for the classes that went up,
 * the CON bonus, both divided over the character's k classes; the wound is kept.
 */
export function levelHp(t: Tables, dice: Dice, c: Uint8Array, classes: number[], k = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => c[F.levels + i] > 0).length) {
  let rolled = 0
  rolled = rollHitDice(t, dice, c, classes)
  c[F.hpRolled] = (c[F.hpRolled] + Math.max(1, Math.trunc(rolled / Math.max(1, k)))) & 0xff
  const C = conBonus(t, c)
  const gain = Math.max(1, Math.trunc((rolled + C) / Math.max(1, k)))
  const damage = c[F.maxHp] - c[F.hp]
  c[F.maxHp] = (c[F.maxHp] + gain) & 0xff
  c[F.hp] = (c[F.maxHp] - damage) & 0xff
}

/** The highest level the game's tables allow in base class k (the experience table's cap; 1 where it has none). */
export function maxLevel(t: Tables, k: number): number {
  let max = 1
  for (let L = 2; L < T.xp.levels; L++) {
    const xp = xpFor(t, k, L)
    if (xp === 0 || xp === 0xffffffff) break
    max = L
  }
  return max
}

/**
 * FUN_51cf_0000 (CotAB 0x50836): THAC0, highest level, attacks, spell slots, cleric spells known, saves,
 * thief skills; CotAB also the item class mask and the former dual-class levels (R.recalc).
 * items: the character's, when known (CotAB's slots, saves and thief skills read the readied ones;
 * with `itemTables` the class mask puts away readied items it no longer allows).
 * Both originals take THAC0 over every class, a class without a level reading its level-0 row, and
 * only ever raise the highest level (char hit dice); a level drain sets it itself.
 */
export function derive(t: Tables, c: Uint8Array, items?: Item[], itemTables?: ItemTables) {
  const rc = R.recalc
  let thac = 0, high = s8(c[F.hitDice])
  for (let k = 0; k < 8; k++) {
    const L = s8(c[F.levels + k])
    thac = Math.max(thac, t.b(T.thac0.at + k * T.thac0.row + L))
    high = Math.max(high, L)
  }
  c[F.thac0Base] = thac
  c[F.hitDice] = high & 0xff
  const extra = (lv: (k: number) => number) => Object.entries(R.extraAttacks).some(([k, above]) => lv(Number(k)) > above)
  if (extra((k) => s8(c[F.levels + k]))) c[F.attacksBase] = 3
  else if (rc.attacksReset) c[F.attacksBase] = 2
  computeSlots(t, c, items)
  saves(t, c, items)
  if (s8(c[F.levels + 6]) > 0) thiefSkills(t, c, items)
  if (rc.classMask) {
    // 0x50929: a class counts with a level, or a former level below the highest level
    let mask = 0
    for (let k = 0; k < 8; k++) {
      const prev = F.prevLevels >= 0 ? s8(c[F.prevLevels + k]) : 0
      if (s8(c[F.levels + k]) > 0 || (prev > 0 && prev < s8(c[F.hitDice]))) mask = (mask + t.b(T.classBits.at + k)) & 0xff
    }
    c[F.itemMask] = mask
    if (items && itemTables) putAwayUnusable(c, items, itemTables, true)
  }
  if (formerLevelsCount(c)) {
    // 0x50A10: the former levels give their attacks, THAC0 and thief skills too
    const prev = (k: number) => s8(c[F.prevLevels + k])
    if (extra(prev)) c[F.attacksBase] = 3
    for (let k = 0; k < 8; k++) c[F.thac0Base] = Math.max(c[F.thac0Base], t.b(T.thac0.at + k * T.thac0.row + prev(k)))
    if (prev(6) > 0) thiefSkills(t, c, items)
  }
}

/** Items the character's class mask does not allow are put away, unless cursed (CotAB 0x509D1,
 *  0x516E6); `readiedOnly`: only the readied ones are looked at (the recalculation). */
export function putAwayUnusable(c: Uint8Array, items: Item[], itemTables: ItemTables, readiedOnly: boolean) {
  for (const it of items) {
    if (readiedOnly && !it.ready) continue
    if (((itemTables.baseOf(it)?.classes ?? 0) & c[F.itemMask]) === 0 && !it.cursed) it.ready = false
  }
}

/**
 * Spell slots from the game's slot sources (R.slots; PoR FUN_51cf_0000, CotAB FUN 0x50480): see games/rules.ts.
 * Then the game's slot-doubling item, if any (CotAB's Ring of Wizardry, 0x507C3).
 */
function computeSlots(t: Tables, c: Uint8Array, items?: Item[]) {
  const sl = R.slots
  const pool = { cleric: F.clericSlots, druid: F.druidSlots, mu: F.muSlots }
  if (sl.clear) for (const b of Object.values(pool)) if (b >= 0) for (let i = 0; i < F.slotLevels; i++) c[b + i] = 0
  const former = formerLevelsCount(c)
  for (const src of sl.sources) {
    // CotAB 0x504AC: a former dual-class level stands in for the class's own once it counts
    const L = former && c[F.prevLevels + src.cls] !== 0 ? s8(c[F.prevLevels + src.cls]) : s8(c[F.levels + src.cls])
    if (L <= 0) continue
    const table = T[src.table]
    if (src.first) c[pool[src.columns[0].pool]]++
    if (L < src.from) continue
    for (let row = src.add ? src.from : L; row <= L; row++) {
      src.columns.forEach((col, k) => {
        const at = pool[col.pool] + col.level - 1, v = t.b(table.at + row * table.row + k + 1)
        c[at] = src.add ? (c[at] + v) & 0xff : v
      })
    }
    if (src.cls === 0 && sl.wisdom === 'afterCleric') wisdomBonus(c)
  }
  for (const l of sl.learn) {
    if (!l.classes.some((k) => c[F.levels + k] > 0)) continue
    const cls = l.spellClass === 'cleric' ? R.spells.cleric : R.spells.druid
    if (l.all) { for (let id = 1; id <= R.spells.named; id++) if (t.b(T.spellRecords.at + id * T.spellRecords.row) === cls) c[F.known + id] = 1 }
    else learnWithSlots(t, c, cls)
  }
  const dbl = sl.doubler
  if (dbl) for (const it of items ?? []) if (it.raw[0x3e] === dbl.effect && it.ready) for (let i = 0; i < dbl.levels; i++) c[F.muSlots + i] = (c[F.muSlots + i] * 2) & 0xff
}

/** Every spell of a class whose level has a slot becomes known. */
function learnWithSlots(t: Tables, c: Uint8Array, cls: number) {
  for (let id = 1; id <= R.spells.named; id++) {
    const sc = t.b(T.spellRecords.at + id * T.spellRecords.row), lvl = t.b(T.spellRecords.at + id * T.spellRecords.row + 1)
    if (sc === cls && slots(c, cls, lvl) > 0) c[F.known + id] = 1
  }
}

/** Spells a new magic-user level may pick from: unknown spells whose class and level have a slot. */
export function newSpellChoices(t: Tables, c: Uint8Array): number[] {
  const out: number[] = []
  for (let id = 1; id <= R.spells.named; id++) {
    const cls = t.b(T.spellRecords.at + id * T.spellRecords.row), lvl = t.b(T.spellRecords.at + id * T.spellRecords.row + 1)
    if (c[F.known + id]) continue
    if (slots(c, cls, lvl) > 0 && mayCast(c, { cls })) out.push(id) // CotAB's list builder 0x449E4, mode 4
  }
  return out
}
