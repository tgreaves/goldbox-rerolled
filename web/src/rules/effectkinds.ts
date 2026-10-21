// Effect behaviours a game profile names for each effect type (games/effectrules.ts `handlers`, with their
// parameters), the current-stat routine and the item kinds. Named by what they do so later games reuse
// them; first transcribed from Pool of Radiance (spec/A-games/engine/effects.md §2, segment 3723) or from Curse of the
// Azure Bonds (spec/A-games/coab/effects.md §2, image offsets; its stat routine 0x4C389, item kinds 0x3F034).
// The handlers get (arg, effect, character): arg 1 is a removal. The originals do not know the event;
// the PoR behaviours apply each part on the event it means something for, as the port always has.
import type { Effect } from '../data/effects'
import { text, textOrNull } from '../data/gametext'
import type { Item } from '../data/items'
import type { HandlerSpec } from '../games/effectrules'
import { F } from '../games/fields'
import { R, classLevel, formerLevelsCount } from '../games/rules'
import { T } from '../games/tables'
import { Item as ItemRecord, ITEM_SIZE } from '../data/items'
import { addEffect, addRaw, deflect, drain, fire, fx, handle, has, healedLine, negate, rearm, removeEffect, removeFirst, removeType, restoreStr, runEffect, setStr, strDec, strKey, type FxHost } from './effects'
import { refillUses } from './abilities'
import { strDamageBonus } from './equip'
import { thiefSkills } from './chargen'
import { forget } from './magic'
import { breathArea, breathBolt, eyeRays, gazeStone, hookTarget, throwLightning } from './specials'

/**
 * A behaviour: the holder's effect record, the holder, removal (arg 1), the profile's parameters, and the
 * event the port runs it for (−1 for a removal or a direct run) with the effect type it runs as
 */
type Behaviour = (h: FxHost, eff: Effect, c: Uint8Array, removal: boolean, p: HandlerSpec, event: number, type: number) => void | Promise<void>

const s8 = (v: number) => (v << 24) >> 24
const num = (p: HandlerSpec, k: string) => p[k] as number
const list = (p: HandlerSpec, k: string) => p[k] as number[]
const say = (h: FxHost, c: Uint8Array, msg: string) => h.print(`${h.name(c)} ${msg}`)
/** a text parameter: the address of the game's string (spec/D-appendices/strings.md) */
const txt = (p: HandlerSpec, k: string) => text(p[k] as number)
/** a roll; with `keep`, through the dice routine that records the count (PoR FUN_5216_0e2e → DS:681C, CotAB 0x4BE7C) */
const rollKeeping = (h: FxHost, n: number, d: number, keep: unknown) => { if (keep) fx.dice = n; return h.roll(n, d) }
const flags = (c: Uint8Array | null) => (c && F.classFlags >= 0 ? c[F.classFlags] : 0)
/** the record's name equals one of the game's name strings at these addresses (Pascal string compare) */
const nameIs = (c: Uint8Array, names: number[]) => { const n = String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name])); return names.some((a) => textOrNull(a) === n) }
/** a spell record byte (DS:37DC + 16·id: +1 level, +8 save effect), when START.EXE is there */
function spellByte(h: FxHost, id: number, k: number): number | null {
  const t = h.tables?.()
  return t ? t.b(T.spellRecords.at + id * T.spellRecords.row + k) : null
}
/** the combatant nearest to c, of any side (the berserk search 11c:3e, I: ties to the earlier entry) */
function nearest(h: FxHost, c: Uint8Array): Uint8Array | null {
  let best: Uint8Array | null = null, d = Infinity
  for (const o of h.all()) {
    if (o === c || !o[F.inPlay]) continue
    const x = h.distance(c, o)
    if (x < d) { d = x; best = o }
  }
  return best
}
/** a victim held by an engulfer or hugger: `held` (0x3A, pw = its index) run at once, then the holder's marker */
function hold(h: FxHost, holder: Uint8Array, v: Uint8Array, held: number, marker: number, also?: () => void) {
  const e = addRaw(h, v, held, 0, h.indexOf(v), 0)
  const after = () => { also?.(); addRaw(h, holder, marker, 0, h.indexOf(v), 1) }
  const r = runEffect(h, held, e, v)
  return r ? r.then(after) : after()
}

export const BEHAVIOURS: Record<string, Behaviour> = {
  /** an empty handler (PoR 3723_319b, CotAB 0x29E21): the type is a marker others read, or nothing */
  none() {},

  // ---------------------------------------------------------------- first transcribed from PoR
  // (spec/A-games/engine/effects.md §2, segment 3723 unless said). The port runs each part on the event it means
  // something for (roll on 10, morale on 17, …); the originals change the globals whichever it is.

  /** 1, 2 Bless, Curse [10, 17]: the attack roll by `roll`; the morale by `morale` (lowered no further than 0) */
  rollMorale(_h, _e, _c, _r, p, event) {
    if (event === 10) fx.roll += num(p, 'roll')
    else if (event === 17) fx.morale = num(p, 'morale') < 0 ? Math.max(0, fx.morale + num(p, 'morale')) : fx.morale + num(p, 'morale')
  },
  /**
   * 3, 6 [4, 10] (013b, 01c3): against the target's monster type (+0x9F) `bonus` [type, n]: the roll on
   * 10, the damage otherwise; with `dmgType`, the damage type is set too, whatever the target (6: Fire
   * + Magic), else nothing happens without a match
   */
  vsTargetType(h, _e, c, _r, p, event) {
    const t = h.targetOf(c)
    const hit = t ? (p.bonus as number[][]).find(([k]) => k === t[F.monsterType]) : undefined
    if (!hit && p.dmgType === undefined) return
    const b = hit ? hit[1] : 0
    if (event === 10) fx.roll += b
    else { fx.dmg += b; if (p.dmgType !== undefined) fx.dmgType = num(p, 'dmgType') }
  },
  /** 4, 59 (removal; 0x373AF, 1472): `msg`, then effect `type` added raw (`duration`, `power`, `flag`) */
  expireInto(h, _e, c, removal, p) {
    if (!removal) return
    if (p.msg) say(h, c, txt(p, 'msg'))
    addRaw(h, c, num(p, 'type'), num(p, 'duration'), num(p, 'power'), num(p, 'flag'))
  },
  /**
   * 7 training complete (removal, 0x37463; spec/A-games/engine/effects.md row 7, §3): `msg`, the stat +1;
   * from `at`, effect `effect` for `duration` (power `power`, flag 1) and nothing more. Otherwise, from
   * `hpFrom` (CON 15), the hit points the higher stat gives, as the original computes them, in bytes:
   * a = max HP − the rolled HP; b = Σ over the class levels L > 0 of L·(stat − `hpFrom`) for class
   * `fighter`, L·2 for any other above `hpFrom`, L·1 at it; b = 1 if 0; a div b is added to max HP and HP,
   * unless the stat is `fighterOnlyFrom` (17) or more and the character has no `fighter` level.
   */
  statUp(h, _e, c, removal, p) {
    if (!removal) return
    const k = F.stat[num(p, 'stat')]
    say(h, c, txt(p, 'msg'))
    c[k] = (c[k] + 1) & 0xff
    const v = c[k]
    if (v >= num(p, 'at')) { addRaw(h, c, num(p, 'effect'), num(p, 'duration'), num(p, 'power'), 1); return }
    const from = num(p, 'hpFrom'), fighter = num(p, 'fighter')
    if (v < from) return
    const a = (c[F.maxHp] - c[F.hpRolled]) & 0xff
    let b = 0
    for (let i = 0; i < 8; i++) {
      const L = (c[F.levels + i] << 24) >> 24 // a signed byte (jle)
      if (L <= 0) continue
      b = (b + L * (i === fighter ? v - from : v > from ? 2 : 1)) & 0xff
    }
    if (b === 0) b = 1
    const gain = Math.trunc(a / b) & 0xff
    if (v >= num(p, 'fighterOnlyFrom') && ((c[F.levels + fighter] << 24) >> 24) <= 0) return
    c[F.maxHp] = (c[F.maxHp] + gain) & 0xff
    c[F.hp] = (c[F.hp] + gain) & 0xff
  },
  /** 8, 9, 45, 46 Protection from Evil / Good [11, 12] (0377, 03ac): the current character of an `alignments` alignment saves `save` better (on 12) */
  saveVsAlignment(h, _e, _c, _r, p, event) {
    const a = h.current()
    if (a && list(p, 'alignments').includes(a[F.alignment]) && event === 12) fx.save += num(p, 'save')
  },
  /**
   * 11 Charm Person [15, 17, 19] (0400): the first call (power bit 0x20 clear) marks the power, keeps the
   * old side in bit 6 and takes the charmer's (bit 7), computer control, morale 0xB3, no target; morale
   * `morale` on 17. Removal: the old side back, morale 0xB3 to 0
   */
  charmed(h, eff, c, removal, p, event) {
    if (removal) { c[F.side] = (eff.power >> 6) & 1; if (c[F.morale] === 0xb3) c[F.morale] = 0; return }
    if (!(eff.power & 0x20)) {
      eff.power = (eff.power + 0x20 + c[F.side] * 0x40) & 0xff
      c[F.side] = eff.power >> 7
      c[F.quick] = 1
      if (c[F.morale] < 0x80) c[F.morale] = 0xb3
      h.setRec(c, 0xa, 0)
    }
    if (event === 17) fx.morale = num(p, 'morale')
  },
  /** 12, 38 Enlarge, Strength (removal, 04ba): the STR an active record holds back, the strongest of `types` then takes over */
  restoreStrength(h, eff, c, removal, p) { if (removal) restoreStr(h, c, eff, list(p, 'types')) },
  /** 14 Friends (removal, 05d6): the stat back to the power */
  restoreStat(_h, eff, c, removal, p) { if (removal) c[F.stat[num(p, 'stat')]] = eff.power },
  /** 15 slow poison's damage (removal, 05eb): re-armed for `duration` (power `power`) unless suppressed; then above 1 HP, 1 point (type 0) */
  poisonTick(h, _e, c, removal, p, _ev, type) {
    if (removal && rearm(h, c, type, num(p, 'duration'), num(p, 'power')) && c[F.hp] > 1) { fx.dmgType = 0; h.damage(c, 1, 0, false) }
  },
  /** 17 Shield [6, 11, 12] (064e): AC no worse than `ac` (11), the save +`save` (12), the spell `spell` (Magic Missile) does nothing (6) */
  shield(_h, _e, c, _r, p, event) {
    if (event === 11) c[F.ac] = Math.max(c[F.ac], num(p, 'ac'))
    else if (event === 12) fx.save += num(p, 'save')
    else if (event === 6 && fx.spell === num(p, 'spell')) fx.dmg = 0
  },
  /**
   * 18, 26 [10] (0679, 0947) on the target, 47, 48 [16] (11f9, 0x384A6) on the attacker (`who`): of monster
   * type `monsterType`, with size flags & `sizeMask` (default all) = `size` when given, and named one of
   * `names`: the roll by `roll`
   */
  namedFoe(h, _e, c, _r, p) {
    const o = p.who === 'attacker' ? h.current() : h.targetOf(c)
    if (!o || o[F.monsterType] !== num(p, 'monsterType')) return
    if (p.size !== undefined && (o[F.sizeFlags] & ((p.sizeMask as number | undefined) ?? 0xff)) !== num(p, 'size')) return
    if (nameIs(o, list(p, 'names'))) fx.roll += num(p, 'roll')
  },
  /**
   * 21 Silence, 30 Stinking Cloud [11, 15] (0x3793F, 0x37C95): a spell being cast is lost, with `msg`
   * (only on `sayOn` when given); with `acWorse`, on 11 the rear AC that much worse (no worse than
   * `acFloor`) and the front AC the same
   */
  breakSpell(h, _e, c, _r, p, event) {
    if ((p.sayOn === undefined || event === p.sayOn) && h.rec(c, 2)) say(h, c, txt(p, 'msg'))
    h.setRec(c, 1, 0); h.setRec(c, 2, 0)
    if (p.acWorse !== undefined && event === 11) { c[F.acRear] = Math.max(num(p, 'acFloor'), c[F.acRear] - num(p, 'acWorse')); c[F.ac] = c[F.acRear] }
  },
  /** 22 Slow Poison (removal, 0x379A5): still poisoned (`poison`), `msg` and status 6; then `also` (the poison's damage) goes silently */
  async poisonEnds(h, _e, c, removal, p) {
    if (!removal) return
    if (has(h, c, num(p, 'poison'))) h.setStatus(c, 6, `${h.name(c)} ${txt(p, 'msg')}`)
    await removeType(h, c, num(p, 'also'), true)
  },
  /**
   * 23 Spiritual Hammer [19] (0x37A10): while it lasts the holder has the item `bytes` ([offset, value]
   * pairs: type 20, words 0x14 "Hammer" and 0xF3 "Spiritual", +1, handler 0x89), found by the bytes at
   * `match`; made with `msg` when missing and there is room (16); on removal it goes. AC again either way
   */
  conjuredItem(h, _e, c, removal, p) {
    const items = h.itemsOf(c)
    const bytes = p.bytes as number[][]
    const want = (o: number) => bytes.find(([k]) => k === o)![1]
    const mine = items.find((i) => list(p, 'match').every((o) => i.raw[o] === want(o)))
    if (removal) { if (mine) items.splice(items.indexOf(mine), 1) }
    else if (!mine && items.length < 16) {
      const r = new Uint8Array(ITEM_SIZE)
      for (const [o, v] of bytes) r[o] = v
      items.push(new ItemRecord(r))
      say(h, c, txt(p, 'msg'))
    }
    h.recalc(c)
  },
  /** 25 Invisibility [1, 16] (0918): untargetable (1) by a current character without `detect`; the roll by `roll` (16) */
  unseen(h, _e, _c, _r, p, event) {
    const cur = h.current()
    if (event === 1 && cur && !has(h, cur, num(p, 'detect'))) fx.untargetable = true
    else if (event === 16) fx.roll += num(p, 'roll')
  },
  /**
   * 28 Mirror Image [5, 6] (0x37BF0): against a single-target spell (not area), 1d(power + 1) > 1 takes
   * the damage away, "lost an image", power − 1; at 0 the record goes
   */
  async imageLost(h, eff, c, _r, p, event) {
    if ((event === 5 || event === 6) && fx.spell !== 0 && !fx.area && h.roll(1, eff.power + 1) > 1) {
      fx.dmg = 0
      say(h, c, txt(p, 'msg'))
      if (--eff.power <= 0) await removeEffect(h, c, eff)
    }
  },
  /** 29 Ray of Enfeeblement [4] (0a3d): the damage less its `part`th */
  damageCut(_h, _e, _c, _r, p, event) { if (event === 4) fx.dmg -= Math.floor(fx.dmg / num(p, 'part')) },
  /**
   * 32 Animate Dead (removal, 0x37D4B), unless suppressed: `msg` and status 6; the side back from the
   * power's high nibble, computer control, not undead, sweep the fighter level, base movement `move`,
   * morale 0xB3 to 0, monster type 0
   */
  collapse(h, eff, c, removal, p) {
    if (!removal || fx.noRearm) return
    h.setStatus(c, 6, `${h.name(c)} ${txt(p, 'msg')}`)
    c[F.side] = eff.power >> 4; c[F.quick] = 1; c[F.undead] = 0; c[F.sweep] = classLevel(c, 2) & 0xff; c[F.baseMove] = num(p, 'move')
    if (c[F.morale] === 0xb3) c[F.morale] = 0
    c[F.monsterType] = 0
  },
  /** 33 Cause Blindness, 36 Bestow Curse [10, 11, 12] (0bac, 0c15): the roll (10), both ACs (11, no better than 0), the save (12) by their amounts */
  penalty(_h, _e, c, _r, p, event) {
    if (event === 10) fx.roll += num(p, 'roll')
    else if (event === 11) { if (p.ac !== undefined) { c[F.ac] = Math.max(0, c[F.ac] + num(p, 'ac')); c[F.acRear] = Math.max(0, c[F.acRear] + num(p, 'ac')) } }
    else if (event === 12) fx.save += num(p, 'save')
  },
  /** 34 Cause Disease (0bcf): the handlers of `types` (43 and 44), as they would run */
  async runTypes(h, eff, c, removal, p, event) { for (const t of list(p, 'types')) await handle(h, t, eff, c, event, removal) },
  /** 35 Prayer's ally half (0c06): the save by `save` on 12, else the roll by `roll` */
  saveElseRoll(_h, _e, _c, _r, p, event) { if (event === 12) fx.save += num(p, 'save'); else fx.roll += num(p, 'roll') },
  /** 37 Blink [1, 16] (0c26): until it has acted (record +3 > 0), untargetable (1) and missed (16) */
  blink(h, _e, c, _r, _p, event) { if (h.rec(c, 3) > 0) { if (event === 1) fx.untargetable = true; else fx.roll = -1 } },
  /**
   * 39 Haste, 42 Slow [18] (0x37E7B, 10c1): the rate (half-attacks or movement) × `mul` or div `div`;
   * with `ages`, the first call sets that power bit, says `msg` and adds a year
   */
  attackRate(h, eff, c, _r, p) {
    if (p.ages !== undefined && !(eff.power & num(p, 'ages'))) {
      eff.power |= num(p, 'ages')
      say(h, c, txt(p, 'msg'))
      const a = (c[F.age] | (c[F.age + 1] << 8)) + 1
      c[F.age] = a & 0xff; c[F.age + 1] = a >> 8
    }
    if (p.mul !== undefined) fx.rate *= num(p, 'mul'); else fx.rate = Math.floor(fx.rate / num(p, 'div'))
  },

  /** 41 Protection from Normal Missiles [5] (1086): an attacker's weapon of plus 0 is deflected (FUN_3723_0fac) at `pct` %; 104 [5] (2901), 120 [5] (2bc8): any attacker, or one with a readied item of a type in `items` */
  deflect(h, _e, c, _r, p) {
    const a = h.current()
    if (p.plainWeapon) { const w = a ? h.weapon(a) : null; if (!w || w.raw[0x32] !== 0) return }
    if (p.items && !(a && h.itemsOf(a).some((it) => it.ready && list(p, 'items').includes(it.raw[0x2e])))) return
    deflect(h, c, num(p, 'pct'))
  },
  /**
   * 43 Cause Disease's STR (removal or a direct run, 0x3830E): on removal re-armed for `duration` (or
   * nothing when suppressed); above `floor`, `msg` and the stat −1; else `helpless` added for good
   */
  loseStrength(h, eff, c, removal, p, event, type) {
    if (!removal && event !== -1) return
    if (removal && !rearm(h, c, type, num(p, 'duration'), eff.power)) return
    if (c[F.stat[0]] > num(p, 'floor')) { say(h, c, txt(p, 'msg')); c[F.stat[0]]-- } else addRaw(h, c, num(p, 'helpless'), 0, 0xff, 0)
  },
  /** 44 Cause Disease's HP (removal or a direct run, 1168): re-armed for `duration`; below 2 HP `helpless` (once), else 1 point */
  loseHp(h, eff, c, removal, p, event, type) {
    if (!removal && event !== -1) return
    if (removal && !rearm(h, c, type, num(p, 'duration'), eff.power)) return
    if (c[F.hp] < 2) { if (!has(h, c, num(p, 'helpless'))) addRaw(h, c, num(p, 'helpless'), 0, 0xff, 0) } else h.damage(c, 1, 0, false)
  },
  /** 49 Prayer [10, 12] (12b2): the side of the power's `sideBit` gets +`save` (12) / +`roll` (else), the other side as much less */
  prayer(_h, eff, c, _r, p, event) {
    const side = eff.power & num(p, 'sideBit') ? 1 : 0
    const k = c[F.side] === side ? 1 : -1
    if (event === 12) fx.save += k * num(p, 'save'); else fx.roll += k * num(p, 'roll')
  },
  /** 50 mummy rot's healing, 62 regeneration (removal, 12fb, 14eb): re-armed for `duration`, then 1 HP (`force`: past what blocks healing) */
  regenerate(h, eff, c, removal, p, _ev, type) {
    if (removal && rearm(h, c, type, num(p, 'duration'), eff.power) && h.heal(c, 1, !!num(p, 'force'))) healedLine(h, c)
  },
  /** 56 [8, 19] (1363), 72 (1730): effect `type` added raw (`duration`, `power`, flag 0), with `below` only when d100 is below it */
  grant(h, _e, c, _r, p) {
    if (p.below !== undefined && !(h.roll(1, 100) < num(p, 'below'))) return
    addRaw(h, c, num(p, 'type'), num(p, 'duration'), num(p, 'power'), 0)
  },
  /**
   * 57 mummy rot's decay (removal, 0x385C9), unless suppressed: `msg`, the stat − `loss` (not below
   * `floor`); with uses left (power >> 4 above 1) re-armed one fewer for `duration`, else `death` and status 6
   */
  rot(h, eff, c, removal, p, _ev, type) {
    if (!removal || fx.noRearm) return
    const k = F.stat[num(p, 'stat')]
    say(h, c, txt(p, 'msg'))
    c[k] = Math.max(num(p, 'floor'), c[k] - num(p, 'loss'))
    if (eff.power >> 4 > 1) addRaw(h, c, type, num(p, 'duration'), eff.power - 0x10, 1)
    else h.setStatus(c, 6, `${h.name(c)} ${txt(p, 'death')}`)
  },
  /**
   * 61, 113 (PoR 1490, 2a28): whatever the event, damage of `type` loses `per` for each die of the dice
   * count (DS:681C) as a byte, put back up to the count when below it (so 1 − 2 wraps to 255 and stays);
   * with `save` the save is that much better; with `magic`, damage without that bit is negated
   * (FUN_3723_0000(0)). 61 is strong fire resistance (−2 a die, save +4, magic fire only), 113 −1 a die
   */
  resistPerDie(_h, _e, _c, _r, p) {
    if (!(fx.dmgType & num(p, 'type'))) return
    for (let i = 1; i <= fx.dice; i++) {
      fx.dmg = (fx.dmg - num(p, 'per')) & 0xff
      if (fx.dmg < fx.dice) fx.dmg = fx.dice
    }
    if (p.save === undefined) return
    fx.save += num(p, 'save')
    if (p.magic !== undefined && !(fx.dmgType & num(p, 'magic'))) negate(0)
  },
  /** 64–66, 70 [3] (FUN_3723_1545): the current character's active target saves vs 0 at `bonus` or gets `effect` (add-effect) and status 6 with `msg` */
  async poisonOnHit(h, _e, _c, _r, p) {
    const t = h.targetOf(h.current()!)
    if (!t || !t[F.inPlay]) return
    if (!h.save(t, 0, num(p, 'bonus'))) {
      await addEffect(h, t, num(p, 'effect'), 0, 0xff, 0)
      h.setStatus(t, 6, `${h.name(t)} ${txt(p, 'msg')}`)
    }
  },
  /**
   * 67–69 [2, 3] (FUN_3723_15eb): for `duration` minutes (or `roll` [n, d, add], rolled first), the
   * current character's active target saves vs 0 or, `msg` and the sparkle, gets `effect` (power
   * `power`); with `notRace`, not when the holder's target is of that race (68: elves)
   */
  async paralyseOnHit(h, _e, c, _r, p) {
    if (p.notRace !== undefined) { const t = h.targetOf(c); if (!t || t[F.race] === num(p, 'notRace')) return }
    const r = p.roll as number[] | undefined
    const duration = r ? h.roll(r[0], r[1]) + (r[2] ?? 0) : num(p, 'duration')
    const t = h.targetOf(h.current()!)
    if (!t || !t[F.inPlay]) return
    if (!h.save(t, 0, 0)) {
      if (h.announce) h.announce(t, txt(p, 'msg')); else say(h, t, txt(p, 'msg'))
      await addEffect(h, t, num(p, 'effect'), duration, num(p, 'power'), 0)
    }
  },
  /** 71 always hidden [1, 16] (171f): untargetable (1), else the roll by `roll` */
  hidden(_h, _e, _c, _r, p, event) { if (event === 1) fx.untargetable = true; else fx.roll += num(p, 'roll') },
  /**
   * 73 rake [2] (0x3E4B2, seg 3AAE): both hand-1 attacks hit an active target: hand 2 gets `attacks`
   * attacks of `dice`d`sides`, hand 1 none, `msg`, the attacks from hand 2, the turn ends
   */
  async rake(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (fx.hits[1] === 2 && t && t[F.inPlay]) {
      c[F.attacksLeft + 1] = num(p, 'attacks'); c[F.dice + 1] = num(p, 'dice'); c[F.sides + 1] = num(p, 'sides'); c[F.attacksLeft] = 0
      h.setRec(c, 4, 2) // the follow-up attack loop starts at hand 2
      say(h, c, txt(p, 'msg'))
      await h.attack(c, t)
      h.endTurn(c)
    }
  },
  /**
   * 74 grab and crush [13, 15] (3aae_3a86, PoR image 0x2E566): the victim at index power & 0x3F; while
   * both are active (not a removal), on 15 `attacks` attack of `dice`d`sides` from hand 1 and the turn
   * ends, then the record goes if the victim fell (its removal call lets the victim go). Otherwise
   * `held` goes from the victim, and, unless this is the record's own removal call, the record goes
   * with its call-on-removal flag cleared first (0x2E5C6), so the removal does not call back
   */
  async crush(h, eff, c, removal, p, event) {
    const v = h.byIndex(eff.power & 0x3f)
    if (!removal && event === 15 && v && v[F.inPlay] && c[F.inPlay]) {
      c[F.attacksLeft] = num(p, 'attacks'); c[F.dice] = num(p, 'dice'); c[F.sides] = num(p, 'sides')
      h.setRec(c, 4, 1)
      await h.attack(c, v)
      h.endTurn(c)
      if (!v[F.inPlay]) await removeEffect(h, c, eff)
    } else {
      if (v) await removeType(h, v, num(p, 'held'))
      if (!removal) { eff.flag = 0; await removeEffect(h, c, eff) }
    }
  },
  /**
   * 75 blood drain [13, 15] (PoR image 0x2899F): the victim at index power & 0x3F; while both are active
   * (not a removal), on 15 `msg`, 1d`sides` (type 0) to the victim and the turn ends; then, the victim
   * still active and the pool (duration >> 4) above the damage, the pool down by it (16 a point), else
   * the record goes (its removal call lets the victim go). Otherwise `held` goes from the victim, the
   * record too unless this is its own removal call (flag cleared first, 0x289FF), and a drainer still
   * active with its victim active is forced to flee (combat record +0x10 = 1, 0x28A37: sated)
   */
  async bloodDrain(h, eff, c, removal, p, event) {
    const v = h.byIndex(eff.power & 0x3f)
    if (!removal && event === 15 && v && v[F.inPlay] && c[F.inPlay]) {
      say(h, c, txt(p, 'msg'))
      const d = rollKeeping(h, 1, num(p, 'sides'), p.keep)
      fx.dmgType = 0
      h.damage(v, d, 0, false)
      h.endTurn(c)
      if (v[F.inPlay] && eff.duration >> 4 > d) eff.duration = (eff.duration - (d << 4)) & 0xffff
      else await removeEffect(h, c, eff)
    } else {
      if (v) await removeType(h, v, num(p, 'held'))
      if (!removal) { eff.flag = 0; await removeEffect(h, c, eff) }
      if (c[F.inPlay] && v && v[F.inPlay]) h.setRec(c, 0x10, 1)
    }
  },
  /** 76 stirge attach [2] (18b5): an active target: `drain` on the holder (duration `duration`, power its index, flag 1), `held` on it, its move gone */
  attach(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || !t[F.inPlay]) return
    addRaw(h, c, num(p, 'drain'), num(p, 'duration'), h.indexOf(t), 1)
    addRaw(h, t, num(p, 'held'), 0, 0, 0)
    h.setRec(t, 6, 0)
  },
  /** 77 hug [2] (0x38B65): an active target with STR below `maxStr`: `crush` on the holder (power its index, flag 1), `held` on it, `msg` */
  holdFast(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || !t[F.inPlay] || t[F.stat[0]] >= num(p, 'maxStr')) return
    addRaw(h, c, num(p, 'crush'), 0, h.indexOf(t), 1)
    addRaw(h, t, num(p, 'held'), 0, 0, 0)
    say(h, t, txt(p, 'msg'))
  },
  /** 78, 102 (removal, 19d9, 2866): back up with the current HP (or `full`: the maximum); blocked, re-armed for 1 (the power kept with `keepPower`, else 0) */
  revive(h, eff, c, removal, p, _ev, type) {
    if (removal && !h.revive(c, p.full ? c[F.maxHp] : c[F.hp])) addRaw(h, c, type, 1, p.keepPower ? eff.power : 0, 1)
  },

  /**
   * 81 fear aura [8] (0x38CDA): each active enemy in sight that fails a save vs `saveType`, by hit dice:
   * up to `hdUpTo[i]` gets `effects[i]` (power `power`) with `msgs[i]` (Hold, then Curse)
   */
  fearAura(h, _e, c, _r, p) {
    const upTo = list(p, 'hdUpTo'), effects = list(p, 'effects'), msgs = list(p, 'msgs').map(text)
    for (const e of h.enemiesNear(c, 255)) {
      if (!e[F.inPlay] || h.save(e, num(p, 'saveType'), 0)) continue
      const i = upTo.findIndex((m) => e[F.hitDice] <= m)
      if (i >= 0) { say(h, e, msgs[i]); addRaw(h, e, effects[i], 0, num(p, 'power'), 0) }
    }
  },
  /**
   * 82 paralysing aura [8] (0x38DD8): everyone else's records of the type go; then each active enemy saves
   * vs 0 at `bonus` when its side has `crowd` or more combatants in play (DS:6814[side]), +`raceBonus`
   * [race, n], or, `msg`, gets `effect` for `roll` [n, d] rounds (power `power`)
   */
  paralysingAura(h, _e, c, _r, p, _ev, type) {
    for (const o of h.all()) for (const e of h.effectsOf(o).filter((x) => x.type === type && o !== c)) h.effectsOf(o).splice(h.effectsOf(o).indexOf(e), 1)
    const [race, more] = list(p, 'raceBonus'), [n, d] = list(p, 'roll')
    for (const e of h.enemiesNear(c, 255)) {
      if (!e[F.inPlay]) continue
      const side = h.all().filter((o) => o[F.inPlay] && o[F.side] === e[F.side]).length
      const bonus = (side >= num(p, 'crowd') ? num(p, 'bonus') : 0) + (e[F.race] === race ? more : 0)
      if (!h.save(e, 0, bonus)) { say(h, e, txt(p, 'msg')); addRaw(h, e, num(p, 'effect'), h.roll(n, d), num(p, 'power'), 0) }
    }
  },
  /**
   * 83 petrifying gaze [14] (0x38EDD): at an active target, "gazes..."; a gazer with `reflectable` meets
   * a readied item of name word `word` (Mirror): "reflects it!", the gazer the victim; the victim saves vs
   * `save` or takes status `status` with `msg`
   */
  stoneGaze(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || !t[F.inPlay]) return
    say(h, c, txt(p, 'gazes'))
    h.fly?.(c, t, 'gaze')
    let victim = t
    if (has(h, c, num(p, 'reflectable')) && h.itemsOf(t).some((it) => it.ready && it.raw[0x31] === num(p, 'word'))) { say(h, t, txt(p, 'reflects')); h.fly?.(t, c, 'gaze'); victim = c }
    if (!h.save(victim, num(p, 'save'), 0)) h.setStatus(victim, num(p, 'status'), `${h.name(victim)} ${txt(p, 'msg')}`)
  },
  /**
   * 84 charm gaze [14] (0x390A7): at an active target, "Gazes..." with spell `spell` resolving; a failed
   * save vs `save` at `bonus` adds `effect` (power side << 7 | `power`, flag 1, the save negating) and runs it
   */
  async charmGaze(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || !t[F.inPlay]) return
    say(h, c, txt(p, 'gazes'))
    h.fly?.(c, t, 'gaze')
    fx.spell = num(p, 'spell')
    if (!h.save(t, num(p, 'save'), num(p, 'bonus'))) await addEffect(h, t, num(p, 'effect'), 0, (c[F.side] << 7) | num(p, 'power'), 1, 1, false, true)
    fx.spell = 0
  },
  /** 85, 86 energy drain [2, 3] (23a4, 23c2): an active target loses `levels` levels (FUN_3723_2122) */
  drainOnHit(h, _e, c, _r, p) { const t = h.targetOf(c); if (t && t[F.inPlay]) drain(h, t, num(p, 'levels')) },
  /**
   * 87 mummy rot on hit [2, 3] (0x3961C): a target without `heal` gets it (`healFor`, flag 1) and `rot`
   * (`rotFor`, power 1d6 uses << 4 | 0x0F, flag 1), `msg`
   */
  diseaseOnHit(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || has(h, t, num(p, 'heal'))) return
    addRaw(h, t, num(p, 'heal'), num(p, 'healFor'), 0, 1)
    addRaw(h, t, num(p, 'rot'), num(p, 'rotFor'), (h.roll(1, 6) << 4) + 0x0f, 1)
    say(h, t, txt(p, 'msg'))
  },
  /** 89 displacement [8, 16] (2490): combat start (8) clears the power bit `bit`; the first attack roll after (16) misses and sets it */
  displaced(_h, eff, _c, _r, p, event) {
    const bit = num(p, 'bit')
    if (event === 8) eff.power &= ~bit
    else if (event === 16 && !(eff.power & bit)) { fx.roll = -1; eff.power |= bit }
  },
  /** 90, 97 [12] (24d9, 268a): a save of a type in `saveTypes` better by CON: the bonus of the highest `bands` [CON, n] reached (none below) */
  conSave(_h, _e, c, _r, p) {
    if (!list(p, 'saveTypes').includes(fx.saveType)) return
    let b = 0
    for (const [con, n] of p.bands as number[][]) if (c[F.stat[4]] >= con) b = n
    fx.save += b
  },
  /** 91 [6] (0x39786): the spell `spell` (Magic Missile) does nothing, "is unaffected"; else damage of `mask` none */
  immuneSpell(h, _e, c, _r, p) {
    if (fx.spell === num(p, 'spell')) { fx.dmg = 0; say(h, c, txt(p, 'msg')) } else if (fx.dmgType & num(p, 'mask')) fx.dmg = 0
  },
  /** 93, 114, 118 [6] (25a2, 2a6d, 2b63): damage of `mask` halved */
  halveType(_h, _e, _c, _r, p) { if (fx.dmgType & num(p, 'mask')) fx.dmg = Math.floor(fx.dmg / 2) },
  /** 94, 115 [5] (25bc, 2a87): an attacker's weapon of a kind in `kinds` (ITEMS byte 7), or with `unarmed` none, does half */
  halveByWeaponKind(h, _e, _c, _r, p) {
    const a = h.current(), w = a ? h.weapon(a) : null
    if (w ? list(p, 'kinds').includes(h.weaponKind(w.raw[0x2e])) : !!p.unarmed) fx.dmg = Math.floor(fx.dmg / 2)
  },
  /** 95 delayed death (removal, 0x39840): still active, status 6 with `msg` */
  diesAtEnd(h, _e, c, removal, p) { if (removal && c[F.inPlay]) h.setStatus(c, 6, `${h.name(c)} ${txt(p, 'msg')}`) },
  /** 96 [5] (264b): no weapon, or one of plus 0 not named `word` (Silver), does nothing */
  needsMagicOrWord(h, _e, _c, _r, p) {
    const a = h.current(), w = a ? h.weapon(a) : null
    if (!w || (w.raw[0x32] <= 0 && w.raw[0x31] !== num(p, 'word'))) fx.dmg = 0
  },
  /** 98 [19] (2700): `hp` back each round, up to the maximum */
  healEachRound(_h, _e, c, _r, p) { c[F.hp] = Math.min(c[F.maxHp], c[F.hp] + num(p, 'hp')) },
  /**
   * 99 rally [8, 13] (2730): Dying, up `full` − combat record +0x0E; Unconscious, up `full`; back up with
   * that many HP: `after` for 1d4 + 1 (flag 1), and this record goes
   */
  async rally(h, eff, c, _r, p) {
    const full = num(p, 'full')
    const n = c[F.status] === 5 ? full - h.rec(c, 0xe) : c[F.status] === 4 ? full : 0
    if (n > 0 && h.revive(c, n)) { addRaw(h, c, num(p, 'after'), h.roll(1, 4) + 1, 0, 1); await removeEffect(h, c, eff) }
  },
  /** 100 troll death [13] (27d9): unless the killing damage was of `mask` (fire, acid), `effect` for `roll` [n, d] (flag 1) */
  unlessKilledBy(h, _e, c, _r, p) {
    const [n, d] = list(p, 'roll')
    if (!(fx.dmgType & num(p, 'mask'))) addRaw(h, c, num(p, 'effect'), h.roll(n, d), 0, 1)
  },
  /** 101 [5, 6] (2814): with none of `unless`, `effect` for `duration` (flag 1) */
  startUnless(h, _e, c, _r, p) {
    if (!list(p, 'unless').some((t) => has(h, c, t))) addRaw(h, c, num(p, 'effect'), num(p, 'duration'), 0, 1)
  },
  /** 103 vampire escape [13] (0x39AEF): no removal callback, `msg`, status `status` (fled), out of play */
  escapes(h, eff, c, _r, p) { eff.flag = 0; say(h, c, txt(p, 'msg')); c[F.status] = num(p, 'status'); c[F.inPlay] = 0 },
  /**
   * 105, 106 [6, 9] (2976, 2984 → FUN_3723_2915): an effect being added or magic damage is negated when
   * d100 ≤ `base` − 5 × (11 − the current character's best level of `classes`, at least 1)
   */
  magicResist(h, _e, _c, _r, p) {
    const a = h.current()
    const lvl = a ? Math.max(...list(p, 'classes').map((k) => a[F.levels + k]), 1) : 1
    const pct = num(p, 'base') - 5 * (11 - lvl)
    if ((fx.adding !== 0 || fx.dmgType & 8) && h.roll(1, 100) <= pct) negate(0)
  },
  /** 110, 112 [6, 9] (29d9, 2a11): damage of `mask` none (6); otherwise the effect being added is blocked (9) */
  immuneType(_h, _e, _c, _r, p, event) {
    if (!(fx.dmgType & num(p, 'mask'))) return
    if (event === 6) fx.dmg = 0; else negate(fx.adding)
  },
  /** 111, 125 [9, 12] (29f0, 2e08): the effects `types` blocked (9); a save of type `saveType` always made (12) */
  immunities(_h, _e, _c, _r, p, event) {
    if (event === 9) { for (const t of list(p, 'types')) negate(t) } else if (fx.saveType === num(p, 'saveType')) fx.save = 100
  },
  /** 116 [5] (2ae6): an attacker's magic weapon (plus above 0) does half */
  halveByPlus(h) { const a = h.current(), w = a ? h.weapon(a) : null; if (w && s8(w.raw[0x32]) > 0) fx.dmg = Math.floor(fx.dmg / 2) },
  /**
   * 117, 122 [5, 6] (2b20, 2d38): the current character's weapon (+0xCC) of item type `item` (holy water,
   * oil) does `roll` [n, d, add] (rolled keeping the count with `keep`); with `diceOn`, damage of that
   * type then gains the dice count, as a byte
   */
  vulnerableTo(h, _e, _c, _r, p) {
    const a = h.current(), w = a ? h.weapon(a) : null, [n, d, add] = list(p, 'roll')
    if (w && w.raw[0x2e] === num(p, 'item')) fx.dmg = (rollKeeping(h, n, d, p.keep) + add) & 0xff
    if (p.diceOn !== undefined && fx.dmgType & num(p, 'diceOn')) fx.dmg = (fx.dmg + fx.dice) & 0xff
  },
  /** 119 [5] (2b7d): no weapon or one of plus 0 does nothing, unless the attacker is race 0 with `hd` hit dice or more */
  needsEnchantment(h, _e, _c, _r, p) {
    const a = h.current(), w = a ? h.weapon(a) : null
    if ((!w || w.raw[0x32] === 0) && a && (a[F.race] > 0 || a[F.hitDice] < num(p, 'hd'))) fx.dmg = 0
  },
  /**
   * 121 acid spit [14] (0x39E4C): an active target closer than `range`, d100 ≤ `pct`: the turn ends, "Spits
   * Acid", `roll` [n, d] of `dmgType`, a save vs `save` halving; then this record and `also` go
   */
  async spitOnce(h, eff, c, _r, p) {
    const t = h.targetOf(c)
    if (t && t[F.inPlay] && h.roll(1, 100) <= num(p, 'pct') && h.distance(c, t) < num(p, 'range')) {
      const [n, d] = list(p, 'roll')
      h.endTurn(c)
      say(h, c, txt(p, 'msg'))
      h.fly?.(c, t, 'spit')
      fx.dmgType = num(p, 'dmgType')
      h.damage(t, rollKeeping(h, n, d, p.keep), 2, h.save(t, num(p, 'save'), 0))
      await removeEffect(h, c, eff)
      await removeType(h, c, num(p, 'also'))
    }
  },
  /** 123 [5] (2d88): no weapon nothing; a weapon of plus 0 half when named `word` (Silver), else nothing */
  halfForWord(h, _e, _c, _r, p) {
    const a = h.current(), w = a ? h.weapon(a) : null
    if (!w) fx.dmg = 0
    else if (w.raw[0x32] === 0) fx.dmg = w.raw[0x31] === num(p, 'word') ? Math.floor(fx.dmg / 2) : 0
  },
  /** 126 [0] (2e37): a target with a readied item named `words` (Mirror), or of `pairs` [word 0x30, word 0x31] (Holy Symbol), cannot be attacked */
  warded(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    const named = (it: { raw: Uint8Array }) => list(p, 'words').includes(it.raw[0x31]) || (p.pairs as number[][]).some(([a, b]) => it.raw[0x30] === a && it.raw[0x31] === b)
    if (t && h.itemsOf(t).some((it) => it.ready && named(it))) fx.untargetable = true
  },
  /** CotAB 141 (removal, 0x29C3F): the paladin's weekly Cure Disease uses back (rules/abilities.ts) */
  refillUses(_h, _e, c, removal) { if (removal) refillUses(c) },

  // ---------------------------------------------------------------- first transcribed from CotAB

  /** 3 [7] fighting snakes (0x2742C): the snakes take the attacks left; the turn ends */
  snakes(h, eff, c, removal, p, _ev, type) {
    if (removal) return // I: the original would remove itself again through its own callback
    const end = () => { say(h, c, txt(p, 'msg')); h.endTurn(c) }
    const left = (c[F.attacksLeft] + c[F.attacksLeft + 1]) & 0xff
    if (eff.power > left) { eff.power -= left; return end() }
    return removeFirst(h, c, type).then(end)
  },
  /** 4 [16] (0x274AF): an attacker of the flagged class misses more (Dispel Evil's defence) */
  attackerClass(h, _e, _c, _r, p) { if (flags(h.current()) & num(p, 'flag')) fx.roll += num(p, 'roll') },
  /** 18, 26 [10] (0x2779A, 0x27A4B): against a target of the flagged class, a better roll */
  targetClass(h, _e, c, _r, p) { if (flags(h.targetOf(c)) & num(p, 'flag')) fx.roll += num(p, 'roll') },
  /** 7 [11] (0x2752F): AC front and rear better by `add`, never past `cap` */
  acBoth(_h, _e, c, _r, p) {
    const add = num(p, 'add'), cap = num(p, 'cap')
    for (const o of [F.ac, F.acRear]) c[o] = c[o] < cap - add ? c[o] + add : cap
  },
  /**
   * 91 removal (0x28E09): the owner's zone of `cell` squares numbered power >> 4 lifts, "The air clears
   * a little..." first when there is one (the old cells back, a body's cell where one lies, the other
   * zones of the list drawn again); outside combat there are no zones (freed when combat ends)
   */
  liftZone(h, eff, c, removal, p) {
    if (!removal || !h.inCombat()) return
    h.clearCloud?.(c, eff.power, num(p, 'cell'), txt(p, 'msg'))
  },
  /** 13 [15] (0x276C9): the count runs out, then death */
  suffocate(h, eff, c, _r, p) {
    if (eff.power === 0) h.setStatus(c, 6, `${h.name(c)} ${txt(p, 'msg')}`)
    else eff.power--
  },
  /**
   * 10, 20 Resist Cold / Fire (PoR 03e1, 06e4; CotAB 20 0x277D0): whatever the event, damage of `type`
   * halved (as a byte) and the save `save` better; CotAB's 20 not on removal, PoR's also then (`onRemoval`)
   */
  resist(_h, _e, _c, removal, p) {
    if ((removal && !p.onRemoval) || !(fx.dmgType & num(p, 'type'))) return
    fx.dmg = (fx.dmg & 0xff) >> 1
    fx.save += num(p, 'save')
  },
  /** 25 [1, 16] Invisibility (0x27A16): an attacker without `detect` (0x18) can neither target nor hit well */
  invisibility(h, _e, _c, removal, p) {
    if (removal) return
    const a = h.current()
    if (!a || !has(h, a, num(p, 'detect'))) { fx.untargetable = true; fx.roll -= 4 }
  },
  /** CotAB 27 [7] (0x273C1, as 31, 51–53): ends the turn whenever it runs; with `event` (PoR 31, 51–53, 3723_133f) only on that event */
  endTurn(h, _e, c, _r, p, event) { if (p.event === undefined || event === p.event) h.endTurn(c) },
  /** 28 [5, 6] Mirror Image (0x27A8F): 1d((pw>>4)+1) > 1 against a single-target spell; pw − 1 per image */
  mirrorImage(h, eff, c, _r, p, _ev, type) {
    if (!(h.roll(1, (eff.power >> 4) + 1) > 1 && fx.spell > 0 && !fx.area)) return
    negate(0)
    say(h, c, txt(p, 'msg'))
    eff.power = (eff.power - 1) & 0xff
    if (eff.power === 0) return removeFirst(h, c, type).then(() => {})
  },
  /** 35 [21] Confusion (0x27D29): d100 (running away with `flee`, berserk with `berserk`), then a save vs spell at −2 ends it */
  async confusion(h, _e, c, _r, p, _ev, type) {
    const flee = num(p, 'flee'), berserk = num(p, 'berserk')
    const d = h.roll(1, 100)
    if (d >= 1 && d <= 10) {
      await removeFirst(h, c, type)
      h.setRec(c, 0x10, 1)
      c[F.quick] = 1
      if (c[F.morale] <= 0x7f) c[F.morale] = 0xb3
      h.setRec(c, 0xa, 0)
      await addEffect(h, c, flee, 10, 0, 1, 1, false, false, txt(p, 'fleeMsg'))
    } else if (d >= 11 && d <= 60) {
      say(h, c, txt(p, 'confused'))
      h.endTurn(c)
    } else if (d >= 61 && d <= 80) {
      // the berserk record holds the side to return to; it runs at once even if the add was blocked (no record then)
      await addEffect(h, c, berserk, 1, c[F.side], 1, 1, false, false, txt(p, 'berserkMsg'))
      const e = h.effectsOf(c).find((x) => x.type === berserk) ?? { type: berserk, duration: 1, power: c[F.side], flag: 1 }
      await runEffect(h, berserk, e, c)
    } else if (d >= 81 && d <= 100) say(h, c, txt(p, 'enraged'))
    if (h.save(c, 4, -2)) await removeFirst(h, c, type)
  },
  /** 37 [1, 16] (0x27ED0): with no initiative left, untargetable and unhittable (PoR: with some) */
  notReady(h, _e, c) { if (h.rec(c, 3) === 0) { fx.untargetable = true; fx.roll = -1 } },
  /** 47, 48 [16] (0x284A3, 0x284F2): attackers of a monster type and size miss more */
  attackerKind(h, _e, _c, _r, p) {
    const a = h.current()
    if (a && list(p, 'types').includes(a[F.monsterType]) && (a[F.sizeFlags] & 0x7f) === num(p, 'size')) fx.roll += num(p, 'roll')
  },
  /**
   * 50, 54 [12, 20] (0x28562, 0x28593): one damage type saves better (+2), the other doubles; 50 doubles
   * only unsaved fire (DS:6FC2), 54 reads DS:5D0B instead (? probably a bug), which is 0 in combat
   */
  weakTo(_h, _e, _c, _r, p) {
    if (fx.dmgType & num(p, 'saveOn')) fx.save += 2
    else if (fx.dmgType & num(p, 'double') && (!num(p, 'saved') || !fx.saved)) fx.dmg = (fx.dmg * 2) & 0xff
  },
  /** 57 [2] engulf (0x2E582): both hand-1 hits on an active target: `held` (0x3A), `suffocate` (0x0D, 2d4), the engulfer's `marker` */
  engulf(h, _e, c, _r, p) {
    const t = h.targetOf(c), held = num(p, 'held'), choke = num(p, 'suffocate')
    if (fx.hits[1] !== 2 || !t || !t[F.inPlay] || has(h, t, held) || has(h, t, choke)) return
    h.print(`${h.name(c)} ${txt(p, 'msg')}${h.name(t)}`)
    return hold(h, c, t, held, num(p, 'marker'), () => { addRaw(h, t, choke, 0, h.roll(2, 4), 0) })
  },
  /** 96 [2] hug (0x2ED5C): a roll of 18 or more holds the target (`held`, 0x3A), the hugger gets `marker` (0x90) */
  hug(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (s8(fx.roll) < 18 || !t) return
    h.print(`${h.name(c)} ${txt(p, 'msg')}${h.name(t)}`)
    return hold(h, c, t, num(p, 'held'), num(p, 'marker'))
  },
  /** 60 [5] (0x28628): no weapon or plus 0 does nothing, a plus below `full` half */
  magicWeapons(h, _e, _c, _r, p) {
    const a = h.current(), w = a ? h.weapon(a) : null
    if (!w || w.raw[0x32] === 0) fx.dmg = 0
    else if (s8(w.raw[0x32]) < num(p, 'full')) fx.dmg = (fx.dmg & 0xff) >> 1
  },
  /** 63 [6, 9] Minor Globe (0x2871A): a resolving spell below the level is negated */
  minorGlobe(h, _e, _c, _r, p) {
    if (fx.spell <= 0) return
    const lvl = spellByte(h, fx.spell, 1)
    if (lvl !== null && s8(lvl) < num(p, 'below')) negate(0)
  },
  /** 68 (direct) Feeblemind (0x288E5): INT and WIS 7; in combat the spell being cast is lost */
  feeblemind(h, _e, c, _r, p) {
    c[F.stat[1]] = 7
    c[F.stat[2]] = 7
    say(h, c, txt(p, 'msg'))
    if (!h.inCombat()) return
    h.setRec(c, 1, 0)
    const s = h.rec(c, 0)
    if (s > 0) { say(h, c, txt(p, 'lost')); forget(c, s); h.setRec(c, 0, 0) }
  },
  /** 69 [1] (0x28986): an attacker of the type without `detect` (0x18) cannot target; its roll is worse either way */
  untargetableBy(h, _e, _c, _r, p) {
    const a = h.current()
    if (!a || a[F.monsterType] !== num(p, 'type')) return
    if (!has(h, a, num(p, 'detect'))) fx.untargetable = true
    fx.roll += num(p, 'roll')
  },
  /** 73, 110, 135 [6] (0x28A22, 0x29502, 0x29B05): damage of the type negated */
  immune(h, _e, c, _r, p) {
    if (!(fx.dmgType & num(p, 'mask'))) return
    negate(0)
    if (num(p, 'say')) say(h, c, txt(p, 'msg'))
  },
  /** 75 [4, 10, 13] (0x28A6A): against the monster type 3·1d12 + 4 + the STR damage bonus (I), and +2 to hit */
  giantBane(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || t[F.monsterType] !== num(p, 'type')) return
    const str = strDamageBonus(c)
    fx.dmg = (3 * h.roll(1, 12) + 4 + str) & 0xff
    fx.roll += 2
  },
  /** 76 [4, 10] (0x28AC2): against the monster type, better to hit and more damage */
  bane(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (t && t[F.monsterType] === num(p, 'type')) { fx.roll += num(p, 'roll'); fx.dmg = (fx.dmg + num(p, 'dmg')) & 0xff }
  },
  /**
   * 77 [15] and 137 berserk (0x28B03, 0x29B30): computer control, morale 0xB3 (0xB2 for an NPC already
   * with its own), the nearest combatant becomes the target and the side the opposite of its; 77 only
   * in combat, with "goes berzerk". Removal: morale 0xB3 back to 0; side 0 (77) or the power (137).
   */
  berserk(h, eff, c, removal, p) {
    if (removal) {
      if (c[F.morale] === 0xb3) c[F.morale] = 0
      c[F.side] = num(p, 'restore') ? eff.power : 0
      return
    }
    c[F.quick] = 1
    c[F.morale] = c[F.morale] <= 0x7f || c[F.morale] === 0xb3 ? 0xb3 : 0xb2
    if (num(p, 'say') && !h.inCombat()) return
    h.setRec(c, 0xa, 0)
    const t = nearest(h, c)
    if (t) h.setTarget?.(c, t)
    if (num(p, 'say')) h.setRec(c, 1, 0)
    if (t) c[F.side] = t[F.side] ^ 1
    if (num(p, 'say')) say(h, c, txt(p, 'msg'))
  },
  /** 81 [5] (0x28CCF) */
  halve() { fx.dmg = (fx.dmg & 0xff) >> 1 },
  /** 82 [5, 6] (0x28CE0): fire or cold: a save vs spell; saved and the spell has a save effect, none, else half */
  fireColdSave(h, _e, c) {
    if (!(fx.dmgType & 3)) return
    if (h.save(c, 4, 0) && spellByte(h, fx.spell, 8)) fx.dmg = 0
    else fx.dmg = (fx.dmg & 0xff) >> 1
  },
  /** 84 [6] (0x28D31): electricity negated and +8 HP, past the maximum (a 1d8 is rolled and dropped: I, a bug) */
  absorbElectricity(h, _e, c) {
    if (!(fx.dmgType & 4)) return
    negate(0)
    h.roll(1, 8)
    c[F.hp] = (c[F.hp] + 8) & 0xff
  },
  /** 85 [5] (0x28D64): a piercing weapon (ITEMS byte 7 = 1) does 1 */
  piercingOne(h) {
    const a = h.current(), w = a ? h.weapon(a) : null
    if (w && h.weaponKind(w.type) === 1) fx.dmg = 1
  },
  /** 86 [14] acid spit (0x49B5E): within range, d100 ≤ pct: the spitter's max HP, half on a save vs breath */
  async spitAcid(h, _e, c, _r, p) {
    const t = await hookTarget(h, c, num(p, 'hook'))
    const d = h.roll(1, 100)
    if (!t || h.distance(c, t) >= num(p, 'range')) return
    if (d > num(p, 'pct')) { say(h, c, txt(p, 'misses')); return }
    say(h, c, txt(p, 'msg'))
    h.fly?.(c, t, 'spit')
    h.damage(t, c[F.maxHp], 2, h.save(t, 3, 0))
  },
  /** 103 [4] (0x293AD): a target without any of `lacks` takes 1d`sides` more */
  extraDamage(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (t && !list(p, 'lacks').some((x) => has(h, t, x))) fx.dmg = (fx.dmg + h.roll(1, num(p, 'sides'))) & 0xff
  },
  /** 122 [2] (0x29873): the target saves or is held for good (`effect` 0x34, pw 0xFF) */
  holdOnHit(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || h.save(t, num(p, 'save'), 0)) return
    addRaw(h, t, num(p, 'effect'), 0, 0xff, 0)
    say(h, t, txt(p, 'msg'))
  },
  /** 123 [2] (0x298ED): count d sides of the damage type to the target; with `active` (PoR 79, 80: 1a19, 1a4c) only to an active one, the type set only then */
  hitDamage(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (p.active && !(t && t[F.inPlay])) return
    fx.dmgType = num(p, 'dmgType')
    if (t) h.damage(t, rollKeeping(h, num(p, 'count'), num(p, 'sides'), p.keep), 0, false)
  },
  /** 126 [14] gaze (0x4A214): a new target; it saves vs petrification or is held (`effect` 0x34) for `minutes` */
  async gazeHold(h, _e, c, _r, p) {
    h.setRec(c, 0xa, 0)
    const t = await hookTarget(h, c, num(p, 'hook'))
    if (!t) return
    say(h, c, txt(p, 'gazes'))
    h.fly?.(c, t, 'gaze')
    if (h.save(t, 1, 0)) return
    addRaw(h, t, num(p, 'effect'), num(p, 'minutes'), 0xff, 0)
    say(h, t, txt(p, 'msg'))
  },
  /** 129 [6, 9] (0x29973): every effect added and all magic damage negated */
  magicResistance() { if (fx.adding !== 0 || fx.dmgType & 8) negate(0) },
  /** 130 [5] (0x29993): the named quarrel takes the target out of play (status 8), with event 13 */
  quarrelSlays(h, _e, c, _r, p) {
    const a = h.current(), w = a ? h.weapon(a) : null
    if (!w || w.type !== num(p, 'type') || w.raw[0x31] !== num(p, 'word')) return
    h.setStatus(c, 8, '')
    return fire(h, c, 13)
  },
  /** 131 [14] (0x4A001): adjacent, d100 ≤ pct: "Breathes Fire", fire damage, half on a save vs breath; the turn ends */
  async breatheFire(h, _e, c, _r, p) {
    const t = await hookTarget(h, c, num(p, 'hook'))
    if (h.roll(1, 100) > num(p, 'pct') || !t || h.distance(c, t) >= 2) return
    fx.dmgType = 1
    h.endTurn(c)
    say(h, c, txt(p, 'msg'))
    h.fly?.(c, t, 'spit')
    h.damage(t, num(p, 'dmg'), 2, h.save(t, 3, 0))
  },
  /** 83 [14] petrifying gaze through the AI target hook (0x497CE, rules/specials.ts) */
  gazeStone(h, e, c, _r, p) { return gazeStone(h, e, c, p) },
  /** 87 [14] eye rays (0x2E842) */
  eyeRays(h, e, c, _r, p) { return eyeRays(h, e, c, p) },
  /** 88 [14] the breath bolt (0x499CD; PoR's 88, FUN_4e53_30d9) */
  breathBolt(h, e, c, _r, p) { return breathBolt(h, e, c, p) },
  /** 90, 128 [14] the area breaths (0x49C94, 0x49E74) */
  breathArea(h, e, c, _r, p) { return breathArea(h, e, c, p) },
  /** 132 [14] thrown lightning (0x4A121) */
  throwLightning(h, e, c, _r, p) { return throwLightning(h, e, c, p) },
  /**
   * 133 [6] (0x29AA0), PoR 107–109, 124 [9] (2992, 29b6, 29cb, 2de4): the effects `types` blocked, with
   * `pct` only when d100 ≤ it; with `mask`, damage of that type negated too
   */
  blocks(h, _e, _c, _r, p) {
    if (p.pct !== undefined && h.roll(1, 100) > num(p, 'pct')) return
    for (const t of list(p, 'types')) negate(t)
    if (p.mask !== undefined && fx.dmgType & num(p, 'mask')) negate(0)
  },
  /** 134 [4] (0x29ACC): against a target of the flagged class (giants), + the holder's ranger level */
  rangerVsGiants(h, _e, c, _r, p) {
    if (flags(h.targetOf(c)) & num(p, 'flag')) fx.dmg = (fx.dmg + c[F.levels + 4]) & 0xff
  },
  /** 136 [7] (0x29B1C): no movement this turn; with `moveRate` (PoR 58 [18], 1452) the movement rate 0 too */
  noMove(h, _e, c, _r, p) { h.setRec(c, 6, 0); if (p.moveRate && fx.rateIsMove) fx.rate = 0 },
  /** 138 [22] (0x29C20): invisible (`effect` 25) from the start of combat */
  startInvisible(h, _e, c, _r, p) { addRaw(h, c, num(p, 'effect'), 0xff, 0xff, 0) },
  /**
   * 139, 144 [14] the engulfer's and the hugger's hold (0x2EB16, 0x2EC4C): while both are active, an
   * attack of 2d8 (`attacks` of them) on the victim, then the turn ends; otherwise (or on removal) the
   * victim is let go (`held` 0x3A, and `also`) and the marker goes.
   */
  async heldVictim(h, eff, c, removal, p) {
    const v = h.byIndex(eff.power)
    const free = async () => { if (v) { await removeFirst(h, v, num(p, 'held')); if (num(p, 'also')) await removeFirst(h, v, num(p, 'also')) } }
    if (removal || !c[F.inPlay] || !v || !v[F.inPlay]) {
      await free()
      if (!removal) { eff.flag = 0; await removeEffect(h, c, eff) }
      return
    }
    c[F.attacksLeft] = num(p, 'attacks'); c[F.attacksLeft + 1] = 0
    c[F.dice] = 2; c[F.sides] = 8
    h.setRec(c, 4, 1)
    await h.attack(c, v)
    h.endTurn(c)
    if (!v[F.inPlay]) { await removeFirst(h, c, num(p, 'marker')); await free() }
  },
  /** 142 (0x29C82) runs away; removal: morale and computer control back, no longer forced to flee */
  runsAway(h, _e, c, removal) {
    if (!removal) return
    if (c[F.morale] === 0xb3) { c[F.morale] = 0; c[F.quick] = 0 }
    h.setRec(c, 0x10, 0)
  },
  /** 143 [5] (0x29CC5): an adjacent attacker takes twice the damage as magic, "gets zapped" */
  zap(h, _e, c, _r, p) {
    const a = h.current()
    if (!a || h.distance(a, c) >= 2) return
    const dmg = fx.dmg, type = fx.dmgType
    fx.dmg = (fx.dmg * 2) & 0xff
    fx.dmgType = 8
    say(h, a, txt(p, 'msg'))
    h.damage(a, fx.dmg, 0, false)
    fx.dmg = dmg
    fx.dmgType = type
  },
  /** 145 [2] Dispel Evil's touch (0x29D69): a flagged target failing a save vs spell is gone; `removes` (4 and 0x91) leave the current character */
  async dispelEvil(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t) return
    if (!(flags(t) & num(p, 'flag')) || h.save(t, 4, 0)) { say(h, t, txt(p, 'resists')); return }
    h.setStatus(t, 8, `${h.name(t)} ${txt(p, 'msg')}`)
    const a = h.current() ?? c
    for (const t of list(p, 'removes')) await removeFirst(h, a, t)
  },
}

/** Run a profile-named item behaviour (rules/effects.ts itemHandler). */
export function itemBehave(h: FxHost, spec: HandlerSpec, c: Uint8Array, it: Item, ready: boolean): Promise<void> {
  const b = ITEM_BEHAVIOURS[spec.b]
  if (!b) throw new Error(`unknown item behaviour ${spec.b}`)
  return b(h, c, it, ready, spec)
}

/** Run a profile-named behaviour (rules/effects.ts handle). */
export function behave(h: FxHost, spec: HandlerSpec, eff: Effect, c: Uint8Array, removal: boolean, event = -1, type = eff.type): void | Promise<void> {
  const b = BEHAVIOURS[spec.b]
  if (!b) throw new Error(`unknown effect behaviour ${spec.b}`)
  return b(h, eff, c, removal, spec, event, type)
}

// ---------------------------------------------------------------- the current-stat routine
/**
 * CotAB 0x4C389 (`4aab:18d9`, char, stat 0 STR … 5 CHA): the current stat from the base one (+0x10 + 2i,
 * STR% +0x1D), readied items with item +0x3E above 0x80 (kind = & 0x7F, item +0x3D its value) and
 * effects; stored in the current stat (+0x11 + 2i, STR% +0x1C). CON also recomputes the maximum HP
 * with its bonus and keeps regeneration (0x3E) at CON 20+.
 * STR: kind 5 sets 18/00 (+0x3D 0) or 19–24, kind 8 (+0x3D 0) one more than the base below 18, kind 0x0D
 * makes it 3; effect 0x26 adds its power to STR up to 18 (fighters, paladins and rangers go on into
 * 18/xx, 10 % a point), 0x92 and 0x0C set it; the highest wins (18/xx by its percentage). INT: kind 8
 * +1, kind 0x0C makes it 7, 0x0D 3; WIS: kind 8 +1; Feeblemind (0x44) makes both 3 unless an item made
 * INT 7 or less. DEX: kind 2 +4/+2/+1 by the base, kind 8 +1, kind 0x0A −2. CON: kind 6 +1, kind 8 +1.
 * CHA: kind 6 −1, kind 8 +1, effect 0x0E adds its power. Kind 8 needs a base below 18.
 */
export function effectiveStat(h: FxHost, c: Uint8Array, stat: number): void | Promise<void> {
  const base = (k: number) => c[F.baseStat[k]]
  let cur = base(stat), pct = c[F.baseStrPct]
  let cand = 0, candPct = 0, override = 0xff
  const take = () => { if (cand > cur || (cand === 18 && candPct > pct)) { cur = cand; pct = candPct } } // 0x4C221
  const add = (n: number) => { cur = (cur + n) & 0xff }
  for (const it of h.itemsOf(c)) {
    if (it.raw[0x3e] <= 0x80 || !it.ready) continue
    const kind = it.raw[0x3e] & 0x7f, v = it.raw[0x3d]
    const plus1 = kind === 8 && v === stat && base(stat) < 18
    switch (stat) {
      case 0:
        if (kind === 5) { if (v === 0) { cand = 18; candPct = 100 } else if (v <= 6) cand = 18 + v }
        else if (plus1) { cand = base(0) + 1; candPct = 0 }
        else if (kind === 0x0d) override = 3
        take()
        break
      case 1: if (plus1) add(1); else if (kind === 0x0c) override = 7; else if (kind === 0x0d) override = 3; break
      case 2: if (plus1) add(1); break
      case 3: if (kind === 2) add(base(3) <= 6 ? 4 : base(3) <= 13 ? 2 : 1); else if (plus1) add(1); else if (kind === 0x0a) add(-2); break
      case 4: if (kind === 6 || plus1) add(1); break
      case 5: if (kind === 6) add(-1); else if (plus1) add(1); break
    }
  }
  const first = (type: number) => h.effectsOf(c).find((e) => e.type === type)
  /** 0x4C189: STR in an effect's power, 18/(p − 1) up to 101, else p − 100 */
  const decode = (e: Effect) => {
    const v = e.power & 0x7f
    if (v <= 0x65) { cand = 18; candPct = (v - 1) & 0xff } else { cand = v - 100; candPct = 0 }
  }
  switch (stat) {
    case 0: {
      const e38 = first(0x26)
      if (e38) {
        decode(e38)
        if (cur <= 18 && pct < 100) {
          cand = (cand + cur) & 0xff
          if (cand > 18) {
            const fighter = [2, 3, 4].some((k) => s8(c[F.levels + k]) > 0 || s8(c[F.prevLevels + k]) > 0)
            if (fighter) candPct = Math.min(100, ((cand - 18) * 10 + c[F.strPct]) & 0xff)
            cand = 18
          }
        }
        take()
      }
      for (const type of [0x92, 0x0c]) { const e = first(type); if (e) { decode(e); take() } }
      c[F.stat[0]] = override !== 0xff ? override : cur
      c[F.strPct] = override !== 0xff ? 0 : pct
      return
    }
    case 1: case 2:
      if (first(0x44) && override > 7) override = 3
      c[F.stat[stat]] = override !== 0xff ? override : cur
      return
    case 3: c[F.stat[3]] = cur; return
    case 5: { const e = first(0x0e); if (e) add(e.power); c[F.stat[5]] = cur; return }
    case 4: {
      conHitPoints(h, c, cur)
      c[F.stat[4]] = cur
      if (cur >= 20) { if (!first(0x3e)) addRaw(h, c, 0x3e, 0x3c, 0xff, 1); return }
      return removeFirst(h, c, 0x3e).then(() => {})
    }
  }
}

/**
 * The maximum HP from the rolled HP (+0x12C) and the CON bonus over each class's levels up to its
 * fixed-HP stop level (DS:3EBB), former dual-class levels too, divided by the classes with a level;
 * the current HP moves with it (0x4C72B…0x4C875, the bonus 0x4C26E). Without START.EXE nothing changes.
 */
function conHitPoints(h: FxHost, c: Uint8Array, con: number) {
  const t = h.tables?.()
  if (!t) return
  const stop = (k: number) => t.b(T.hitDiceStop.at + k)
  let acc = 0, n = 0
  const bonus = (k: number, lv: number) => {
    if (stop(k) <= lv) lv = (stop(k) - 1) & 0xff
    if (k === 4 && (c[F.hpLevel] === 0 || c[F.prevLevels + 4] === c[F.hpLevel])) lv = (lv + 1) & 0xff
    let per = 0
    if (k >= 2 && k <= 4) per = con >= 15 && con <= 19 ? con - 14 : con === 20 ? 5 : con >= 21 && con <= 23 ? 6 : con >= 24 && con <= 25 ? 7 : 0
    else per = con > 15 ? 2 : con === 15 ? 1 : 0
    acc = (acc + lv * per) & 0xff
  }
  const old = c[F.maxHp]
  c[F.maxHp] = c[F.hpRolled]
  for (let k = 0; k < 8; k++) {
    if (c[F.prevLevels + k] > 0) bonus(k, c[F.prevLevels + k])
    let lv = c[F.levels + k]
    if (lv > 0) n++
    if (stop(k) < lv) lv = stop(k)
    if (lv > c[F.hpLevel]) bonus(k, lv - c[F.hpLevel])
  }
  if (n) acc = Math.floor(acc / n) // the original divides by zero without a class
  c[F.maxHp] = (c[F.maxHp] + acc) & 0xff
  if (c[F.maxHp] > old) c[F.hp] = (c[F.hp] + c[F.maxHp] - old) & 0xff
  else if (c[F.maxHp] < old) { const d = old - c[F.maxHp]; c[F.hp] = c[F.hp] > d ? c[F.hp] - d : 0 }
}

// ---------------------------------------------------------------- readied items
/**
 * What readying (`ready`) or putting away an item with item +0x3E ≥ 0x80 does, named in the profile by
 * +0x3E & 0x7F (games/effectrules.ts `items`): PoR's item handler 128–139 (FUN_4894_14d0 →
 * FUN_5216_0000, spec/A-games/engine/effects.md "Item handlers"), CotAB's item kind (0x3F034, spec/A-games/coab/effects.md).
 * +0x3D is the item's value (an effect type, a stat, an alignment and damage).
 */
type ItemBehaviour = (h: FxHost, c: Uint8Array, it: Item, ready: boolean, p: HandlerSpec) => Promise<void>

export const ITEM_BEHAVIOURS: Record<string, ItemBehaviour> = {
  /**
   * PoR 128–130, 133, 134, 136, 138, 139 (2eda), CotAB kind 0 (the generic handler 147, 0x29A23 through
   * DS:759C and DS:720C): readying adds effect +0x3D raw (permanent, `power`, `flag`) and runs its handler
   * at once (with `outsideCombat`, only out of combat); putting it away removes the first of that type,
   * with `quietly` without its removal callback
   */
  async grantEffect(h, c, it, ready, p) {
    const v = it.raw[0x3d]
    if (!ready) {
      if (!p.quietly) { await removeFirst(h, c, v); return }
      const list = h.effectsOf(c), e = list.find((x) => x.type === v)
      if (e) list.splice(list.indexOf(e), 1)
      return
    }
    const e = addRaw(h, c, v, 0, num(p, 'power'), num(p, 'flag'))
    if (!p.outsideCombat || !h.inCombat()) await runEffect(h, v, e, c)
  },
  /**
   * PoR 131 Gauntlets of Ogre Power (0x3A187): readying tries STR `str`/`pct` (FUN_5216_115c), `msg` when
   * it raised it, and always adds `effect` (flag 1) holding the STR to restore; putting them away removes
   * the record of that STR (bug kept: at that STR now, the first record of the type, whatever it holds)
   */
  async strengthItem(h, c, _it, ready, p) {
    const str = num(p, 'str'), pct = num(p, 'pct'), type = num(p, 'effect')
    if (ready) {
      const { ok, pw } = setStr(h, c, str, pct)
      if (ok) say(h, c, txt(p, 'msg'))
      addRaw(h, c, type, 0, pw, 1)
      return
    }
    const atIt = c[F.stat[0]] === str && c[F.strPct] === pct
    const e = h.effectsOf(c).find((x) => x.type === type && (atIt || strKey(strDec(x.power)) === strKey([str, pct])))
    if (e) await removeEffect(h, c, e)
  },
  /**
   * PoR 132 (30a5), CotAB kind 4: +0x3D low nibble an alignment, high nibble damage: of another
   * alignment the item is put down and does that damage as magic; on readying, with `alsoUnready`
   * (CotAB) when putting it away too
   */
  async alignmentLocked(h, c, it, ready, p) {
    const v = it.raw[0x3d]
    if ((ready || p.alsoUnready) && (v & 0x0f) !== c[F.alignment]) { it.ready = false; fx.dmgType = 8; h.damage(c, v >> 4, 0, false) }
  },
  /** PoR 135 Boulder (0x3A364): readied with STR below `str`, it is put down with `msg` */
  async needsStrength(h, c, it, ready, p) { if (ready && c[F.stat[0]] < num(p, 'str')) { it.ready = false; h.print(txt(p, 'msg')) } },
  /** PoR 137 (317a), CotAB kind 9: putting it away ends effect `type` (Spiritual Hammer), and with it the item */
  async unreadyEnds(h, c, _it, ready, p) { if (!ready) await removeFirst(h, c, num(p, 'type')) },
  /** CotAB kind 1 Ring of Wizardry: the magic-user slots of levels 1–`levels` doubled; put away, worked out again from the class (the other ring forgotten, I: as the original) */
  async doubleSlots(h, c, _it, ready, p) {
    if (ready) for (let i = 0; i < num(p, 'levels'); i++) c[F.muSlots + i] = (c[F.muSlots + i] * 2) & 0xff
    else muSlotsAgain(h, c)
  },
  /**
   * CotAB kinds 2, 5, 6, 8, 0x0A–0x0D: the current-stat routine (0x4C389) for `stats` (0 STR … 5 CHA),
   * with `fromValue` for the stat +0x3D (when 5 or below); with `thief`, the thief skills again (0x50F5A)
   */
  async recomputeStats(h, c, it, _ready, p) {
    const stats = p.fromValue ? (it.raw[0x3d] <= 5 ? [it.raw[0x3d]] : []) : list(p, 'stats')
    for (const k of stats) await effectiveStat(h, c, k)
    if (p.thief) { const t = h.tables?.(); if (t) thiefSkills(t, c, h.itemsOf(c)) }
  },
}

/**
 * 0x3F0C0: the magic-user slots from the magic-user level alone (with the former dual-class level when
 * it counts): 1 first-level slot, then the increments of levels 2.. (DS:44AB); then memorised
 * magic-user spells beyond the slots of their level are forgotten.
 */
function muSlotsAgain(h: FxHost, c: Uint8Array) {
  const t = h.tables?.()
  if (!t) return
  const level = s8(c[F.levels + 5]) + (formerLevelsCount(c) ? s8(c[F.prevLevels + 5]) : 0)
  for (let i = 0; i < 5; i++) c[F.muSlots + i] = 0
  c[F.muSlots] = 1
  for (let L = 2; L <= level; L++) for (let i = 1; i <= 5; i++) c[F.muSlots + i - 1] = (c[F.muSlots + i - 1] + t.b(T.muSlots.at + L * T.muSlots.row + i)) & 0xff
  const held = [0, 0, 0, 0, 0, 0]
  for (let k = 0; k < F.memorisedCount; k++) {
    const id = c[F.memorised + k]
    if (!id) continue
    const rec = T.spellRecords.at + id * T.spellRecords.row
    if (t.b(rec) !== R.spells.magicUser) continue
    const lvl = t.b(rec + 1)
    held[lvl] = (held[lvl] ?? 0) + 1
    if (held[lvl] > c[F.muSlots + lvl - 1]) c[F.memorised + k] = 0
  }
}
