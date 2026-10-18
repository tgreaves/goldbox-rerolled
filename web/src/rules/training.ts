// Training (spec/progression.md, FUN_417f_29ae) and the derived statistics after a level (FUN_51cf_0000).
import { conBonus, saves, thiefSkills, wisdomBonus, type Rng, type Tables } from './chargen'
import { CLASSES } from '../data/character'

/** Trainer bit per base class (DS:05DE): halls match it against their mask (ECL 0x6DA8). */
export const TRAINER_BITS = [2, 2, 8, 10, 10, 1, 4, 6]

const u32 = (c: Uint8Array, o: number) => (c[o] | (c[o + 1] << 8) | (c[o + 2] << 16) | (c[o + 3] << 24)) >>> 0
const setU32 = (c: Uint8Array, o: number, v: number) => { c[o] = v & 0xff; c[o + 1] = (v >> 8) & 0xff; c[o + 2] = (v >> 16) & 0xff; c[o + 3] = (v >>> 24) & 0xff }

/** Experience needed for `level` in base class k (DS:409B, u32; 0xFFFFFFFF = cannot reach). */
export function xpFor(t: Tables, k: number, level: number): number {
  const o = 0x409b + k * 0x38 + level * 4
  return (t.w(o) | (t.w(o + 2) << 16)) >>> 0
}

/** Demi-human level limits (spec table); 255 = none. STR without exceptional strength. */
export function levelLimit(c: Uint8Array, k: number): number {
  const race = c[0x2e], str = c[0x10]
  if (k === 2) {
    const band = (lo: number, mid: number, hi: number) => (str < 17 ? lo : str === 17 ? mid : hi)
    if (race === 1) return band(7, 8, 9)
    if (race === 2) return band(5, 6, 7)
    if (race === 3) return str < 18 ? 5 : 6
    if (race === 4) return band(6, 7, 8)
    if (race === 5) return band(4, 5, 6)
  }
  if (k === 0 && race === 4) return 5
  return 255
}

/** Coins worth in gp, rounded up (FUN_4894_28be for training). */
const coinsGp = (c: Uint8Array) => {
  const w = (i: number) => c[0x88 + 2 * i] | (c[0x89 + 2 * i] << 8)
  return Math.ceil((w(0) + w(1) * 10 + w(2) * 100 + w(3) * 200 + w(4) * 1000) / 200)
}

/** Payment (FUN_417f_42ed): take coins from copper up, change back from platinum down. */
export function payCoins(c: Uint8Array, gp: number) {
  const values = [1, 10, 100, 200, 1000]
  let owed = gp * 200
  const get = (i: number) => c[0x88 + 2 * i] | (c[0x89 + 2 * i] << 8)
  const set = (i: number, v: number) => { c[0x88 + 2 * i] = v & 0xff; c[0x89 + 2 * i] = (v >> 8) & 0xff }
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
  if (c[0x10c] !== 0 && !cheat) return { ok: false, message: 'we only train conscious people', train: [] }
  if (coinsGp(c) < 1000 && !cheat) return { ok: false, message: 'Training costs 1000 gp.', train: [] }
  let all = 0, eligible = 0, cap = 0
  const xp = u32(c, 0xac)
  const eligibleClasses: number[] = []
  for (let k = 0; k < 8; k++) {
    const L = c[0x96 + k]
    if (L <= 0) continue
    all |= TRAINER_BITS[k]
    if (L >= levelLimit(c, k)) continue
    const T = xpFor(t, k, L + 1)
    if (T === 0 || T === 0xffffffff) continue
    if (xp < T && !cheat) continue
    eligible |= TRAINER_BITS[k]
    eligibleClasses.push(k)
    const N = xpFor(t, k, L + 2)
    if (N !== 0 && N !== 0xffffffff && xp >= N) cap = Math.max(cap, N - 1)
  }
  if (cap > 0) setU32(c, 0xac, cap)
  if (!cheat) {
    if ((all & hallMask) === 0) return { ok: false, message: "We don't train that class here", train: [] }
    if ((eligible & hallMask) === 0) return { ok: false, message: 'Not Enough Experience', train: [] }
  }
  const train = eligibleClasses.filter((k) => cheat || (TRAINER_BITS[k] & hallMask) !== 0)
  return { ok: train.length > 0, message: train.length ? '' : 'Not Enough Experience', train }
}

export function willBecome(c: Uint8Array, train: number[]): string[] {
  return train.map((k, i) => `${i ? 'and' : '    '} a level ${c[0x96 + k] + 1} ${CLASSES[k]}`)
}

/** Steps 9–13: pay, gain levels, recompute, then hit points. Returns true if a new MU spell is due. */
export function train(t: Tables, rng: Rng, c: Uint8Array, classes: number[], cheat = false): boolean {
  if (!cheat) payCoins(c, 1000)
  const k = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => c[0x96 + i] > 0).length
  const oldMU = c[0x9b]
  for (const cls of classes) {
    c[0x96 + cls]++
    if (c[0x74] > 0) {
      c[0x75] -= Math.floor(c[0x75] / c[0x74])
      c[0x74]--
    }
  }
  derive(t, c)
  levelHp(t, rng, c, classes, k)
  return c[0x9b] > oldMU
}

/**
 * The hit points of one level gained (FUN_417f_29ae step 6): rolls for the classes that went up,
 * the CON bonus, both divided over the character's k classes; the wound is kept.
 */
export function levelHp(t: Tables, rng: Rng, c: Uint8Array, classes: number[], k = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => c[0x96 + i] > 0).length) {
  let R = 0
  for (const cls of classes) {
    let sum = 0
    for (let i = 0; i < t.b(0x8b6 + cls); i++) sum += rng(t.b(0x8be + cls)) + 1
    R += sum
  }
  c[0xb1] = (c[0xb1] + Math.max(1, Math.trunc(R / Math.max(1, k)))) & 0xff
  const C = conBonus(t, c)
  const gain = Math.max(1, Math.trunc((R + C) / Math.max(1, k)))
  const damage = c[0x32] - c[0x11b]
  c[0x32] = (c[0x32] + gain) & 0xff
  c[0x11b] = (c[0x32] - damage) & 0xff
}

/** The highest level the game's tables allow in base class k (the experience table's cap; 1 where it has none). */
export function maxLevel(t: Tables, k: number): number {
  let max = 1
  for (let L = 2; L <= 13; L++) {
    const xp = xpFor(t, k, L)
    if (xp === 0 || xp === 0xffffffff) break
    max = L
  }
  return max
}

/** FUN_51cf_0000: THAC0, highest level, attacks, spell slots, cleric spells known, saves, thief skills. */
export function derive(t: Tables, c: Uint8Array) {
  let thac = 0, high = 0
  for (let k = 0; k < 8; k++) {
    const L = c[0x96 + k]
    if (L <= 0) continue
    thac = Math.max(thac, t.b(0x3c7c + k * 11 + L))
    high = Math.max(high, L)
  }
  c[0x2d] = thac
  c[0x73] = high
  c[0xa1] = c[0x98] >= 7 ? 3 : 2
  if (c[0x96] >= 2) {
    for (let n = 1; n <= 3; n++) c[0xb1 + n] = t.b(0x40bc + c[0x96] * 3 + n)
    wisdomBonus(c)
  }
  if (c[0x96] > 0) {
    for (let id = 1; id <= 0x38; id++) {
      const cls = t.b(0x31fa + id * 16), lvl = t.b(0x31fb + id * 16)
      if (cls === 0 && lvl >= 1 && lvl <= 3 && c[0xb1 + lvl] > 0) c[0x32 + id] = 1
    }
  }
  if (c[0x9b] >= 2) for (let n = 1; n <= 3; n++) c[0xb4 + n] = t.b(0x41d4 + c[0x9b] * 3 + n)
  saves(t, c)
  if (c[0x9c]) thiefSkills(t, c)
}

/** Spells a new magic-user level may pick from: unknown spells whose class and level have a slot. */
export function newSpellChoices(t: Tables, c: Uint8Array): number[] {
  const out: number[] = []
  for (let id = 1; id <= 56; id++) {
    const cls = t.b(0x31fa + id * 16), lvl = t.b(0x31fb + id * 16)
    if (c[0x32 + id] || lvl < 1 || lvl > 3) continue
    if (c[0xb1 + cls * 3 + lvl] > 0) out.push(id)
  }
  return out
}
