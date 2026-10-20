// Training (spec/progression.md, FUN_417f_29ae) and the derived statistics after a level (FUN_51cf_0000).
import { R, slots } from '../games/rules'
import { T } from '../games/tables'
import { coabHitDice, conBonus, saves, thiefSkills, wisdomBonus, type Rng, type Tables } from './chargen'
import { CLASSES, COIN_VALUES } from '../data/character'
import { F } from '../games/fields'
import type { Item } from '../data/items'

/** Trainer bit per base class (T.trainerBits): halls match it against their mask (ECL 0x6DA8). */
const trainerBit = (t: Tables, k: number) => t.b(T.trainerBits.at + k)

const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0
const setU32 = (c: Uint8Array, o: number, v: number) => { c[o] = v & 0xff; c[o + 1] = (v >> 8) & 0xff; c[o + 2] = (v >> 16) & 0xff; c[o + 3] = (v >>> 24) & 0xff }

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
  if (c[F.status] !== 0 && !cheat) return { ok: false, message: 'we only train conscious people', train: [] }
  if (coinsGp(c) < R.trainingCost && !cheat) return { ok: false, message: `Training costs ${R.trainingCost} gp.`, train: [] }
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
    if ((all & hallMask) === 0) return { ok: false, message: "We don't train that class here", train: [] }
    if ((eligible & hallMask) === 0) return { ok: false, message: 'Not Enough Experience', train: [] }
  }
  const train = eligibleClasses.filter((k) => cheat || (trainerBit(t, k) & hallMask) !== 0)
  return { ok: train.length > 0, message: train.length ? '' : 'Not Enough Experience', train }
}

export function willBecome(c: Uint8Array, train: number[]): string[] {
  return train.map((k, i) => `${i ? 'and' : '    '} a level ${c[F.levels + k] + 1} ${CLASSES[k]}`)
}

/** Steps 9–13: pay, gain levels, recompute, then hit points. Returns true if a new MU spell is due. */
export function train(t: Tables, rng: Rng, c: Uint8Array, classes: number[], cheat = false): boolean {
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
  levelHp(t, rng, c, classes, k)
  return c[F.levels + 5] > oldMU
}

/**
 * The hit points of one level gained (FUN_417f_29ae step 6): rolls for the classes that went up,
 * the CON bonus, both divided over the character's k classes; the wound is kept.
 */
export function levelHp(t: Tables, rng: Rng, c: Uint8Array, classes: number[], k = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => c[F.levels + i] > 0).length) {
  let rolled = 0
  if (R.hpModel === 'coab') rolled = coabHitDice(t, rng, c, classes)
  else for (const cls of classes) {
    let sum = 0
    for (let i = 0; i < t.b(T.hitDiceCount.at + cls); i++) sum += rng(t.b(T.hitDiceSides.at + cls)) + 1
    rolled += sum
  }
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
 * FUN_51cf_0000: THAC0, highest level, attacks, spell slots, cleric spells known, saves, thief skills;
 * items: the character's, when known (CotAB's slots, saves and thief skills read the readied ones).
 */
export function derive(t: Tables, c: Uint8Array, items?: Item[]) {
  let thac = 0, high = 0
  for (let k = 0; k < 8; k++) {
    const L = c[F.levels + k]
    if (L <= 0) continue
    thac = Math.max(thac, t.b(T.thac0.at + k * T.thac0.row + L))
    high = Math.max(high, L)
  }
  c[F.thac0Base] = thac
  c[F.hitDice] = high
  c[F.attacksBase] = Object.entries(R.extraAttacks).some(([k, above]) => c[F.levels + Number(k)] > above) ? 3 : 2
  if (R.slotModel === 'absolute') absoluteSlots(t, c)
  else incrementSlots(t, c, items)
  saves(t, c, items)
  if (c[F.levels + 6]) thiefSkills(t, c, items)
}

/** PoR (FUN_51cf_0000): cleric and magic-user slots from level 2 straight from the tables; WIS bonus; clerics know every cleric spell with a slot. */
function absoluteSlots(t: Tables, c: Uint8Array) {
  if (c[F.levels] >= 2) {
    for (let n = 1; n <= F.slotLevels; n++) c[F.clericSlots + n - 1] = t.b(T.clericSlots.at + c[F.levels] * T.clericSlots.row + n)
    wisdomBonus(c)
  }
  if (c[F.levels] > 0) learnWithSlots(t, c, R.spells.cleric)
  if (c[F.levels + 5] >= 2) for (let n = 1; n <= F.slotLevels; n++) c[F.muSlots + n - 1] = t.b(T.muSlots.at + c[F.levels + 5] * T.muSlots.row + n)
}

/**
 * CotAB (FUN 0x50480, spec/coab/tables.md §3.5): every slot from zero, summing per-level increments.
 * Cleric and magic-user: 1 first-level slot, then levels 2.. of their rows. Paladin: levels 9.. of
 * its row into the cleric slots. Ranger: levels 8.. of its row, columns 1–3 into druid slots and 4–5
 * into magic-user levels 1–2. Then the WIS bonus (I: as PoR's); clerics and paladins know the cleric
 * spells they have slots for, rangers every druid spell.
 */
function incrementSlots(t: Tables, c: Uint8Array, items?: Item[]) {
  const n = 5
  for (let i = 0; i < 3 * n; i++) c[F.clericSlots + i] = 0
  const add = (table: { at: number; row: number }, from: number, level: number, put: (col: number, v: number) => void) => {
    for (let L = from; L <= level; L++) for (let col = 1; col <= n; col++) put(col, t.b(table.at + L * table.row + col))
  }
  const cl = c[F.levels], pal = c[F.levels + 3], rng = c[F.levels + 4], mu = c[F.levels + 5]
  if (cl > 0) { c[F.clericSlots]++; add(T.clericSlots, 2, cl, (col, v) => (c[F.clericSlots + col - 1] += v)) }
  if (pal > 0) add(T.paladinSlots, 9, pal, (col, v) => (c[F.clericSlots + col - 1] += v))
  if (rng > 0) add(T.rangerSlots, 8, rng, (col, v) => (col <= 3 ? (c[F.druidSlots + col - 1] += v) : (c[F.muSlots + col - 4] += v)))
  if (mu > 0) { c[F.muSlots]++; add(T.muSlots, 2, mu, (col, v) => (c[F.muSlots + col - 1] += v)) }
  wisdomBonus(c)
  if (cl > 0 || pal > 0) learnWithSlots(t, c, R.spells.cleric)
  if (rng > 0) for (let id = 1; id <= R.spells.named; id++) if (t.b(T.spellRecords.at + id * T.spellRecords.row) === R.spells.druid) c[F.known + id] = 1
  // 0x507C3: each readied Ring of Wizardry (item +0x3E = 0x81) doubles the magic-user slots of levels 1–3
  for (const it of items ?? []) if (it.raw[0x3e] === 0x81 && it.ready) for (let i = 0; i < 3; i++) c[F.muSlots + i] = (c[F.muSlots + i] * 2) & 0xff
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
    if (slots(c, cls, lvl) > 0) out.push(id)
  }
  return out
}
