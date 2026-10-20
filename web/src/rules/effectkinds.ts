// Effect behaviours a game profile can name (games/effectrules.ts `handlers`, with their parameters),
// the current-stat routine and the item kinds. First transcribed from Curse of the Azure Bonds
// (spec/coab/effects.md §2; its stat routine 0x4C389, item kinds 0x3F034), named by what they do so later
// games reuse them. These handlers get (arg, effect, character): arg 1 is a removal, and they do not know
// the event, so the behaviours ignore it as CotAB's do. Addresses are CotAB image offsets.
import type { Effect } from '../data/effects'
import type { Item } from '../data/items'
import type { HandlerSpec } from '../games/effectrules'
import { F } from '../games/fields'
import { R, formerLevelsCount } from '../games/rules'
import { T } from '../games/tables'
import { addEffect, addRaw, fire, fx, has, negate, removeEffect, removeFirst, runEffect, type FxHost } from './effects'
import { strDamageBonus } from './equip'
import { thiefSkills } from './chargen'
import { forget } from './magic'
import { breathArea, breathBolt, eyeRays, gazeStone, hookTarget, throwLightning } from './specials'

type Behaviour = (h: FxHost, eff: Effect, c: Uint8Array, removal: boolean, p: HandlerSpec) => void | Promise<void>

const s8 = (v: number) => (v << 24) >> 24
const num = (p: HandlerSpec, k: string) => p[k] as number
const list = (p: HandlerSpec, k: string) => p[k] as number[]
const say = (h: FxHost, c: Uint8Array, msg: string) => h.print(`${h.name(c)} ${msg}`)
const flags = (c: Uint8Array | null) => (c && F.classFlags >= 0 ? c[F.classFlags] : 0)
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
/** a victim held by an engulfer or hugger: 0x3A (held, pw = its index) run at once, then the holder's marker */
function hold(h: FxHost, holder: Uint8Array, v: Uint8Array, marker: number, also?: () => void) {
  const e = addRaw(h, v, 0x3a, 0, h.indexOf(v), 0)
  const after = () => { also?.(); addRaw(h, holder, marker, 0, h.indexOf(v), 1) }
  const r = runEffect(h, 0x3a, e, v)
  return r ? r.then(after) : after()
}

export const BEHAVIOURS: Record<string, Behaviour> = {
  none() {},

  /** 3 [7] fighting snakes (0x2742C): the snakes take the attacks left; the turn ends */
  snakes(h, eff, c, removal) {
    if (removal) return // I: the original would remove itself again through its own callback
    const end = () => { say(h, c, 'is fighting with snakes'); h.endTurn(c) }
    const left = (c[F.attacksLeft] + c[F.attacksLeft + 1]) & 0xff
    if (eff.power > left) { eff.power -= left; return end() }
    return removeFirst(h, c, 3).then(end)
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
   * a little..." when there was one (the old cells back, a body's cell where one lies, the other zones of
   * the list drawn again); outside combat there are no zones (freed when combat ends)
   */
  liftZone(h, eff, c, removal, p) {
    if (!removal || !h.inCombat()) return
    const z = h.clearCloud?.(c, eff.power, num(p, 'cell'))
    if (z) h.print('The air clears a little...')
  },
  /** 13 [15] (0x276C9): the count runs out, then death */
  suffocate(h, eff, c) {
    if (eff.power === 0) h.setStatus(c, 6, `${h.name(c)} Suffocates`)
    else eff.power--
  },
  /** 20 (0x277D0): damage of the type halved and its save better, whichever event; not on removal */
  resist(_h, _e, _c, removal, p) {
    if (removal || !(fx.dmgType & num(p, 'type'))) return
    fx.dmg = (fx.dmg & 0xff) >> 1
    fx.save += num(p, 'save')
  },
  /** 25 [1, 16] Invisibility (0x27A16): an attacker without 0x18 can neither target nor hit well */
  invisibility(h, _e, _c, removal) {
    if (removal) return
    const a = h.current()
    if (!a || !has(h, a, 0x18)) { fx.untargetable = true; fx.roll -= 4 }
  },
  /** 27 [7] (0x273C1, as 31, 51–53) */
  endTurn(h, _e, c) { h.endTurn(c) },
  /** 28 [5, 6] Mirror Image (0x27A8F): 1d((pw>>4)+1) > 1 against a single-target spell; pw − 1 per image */
  mirrorImage(h, eff, c) {
    if (!(h.roll(1, (eff.power >> 4) + 1) > 1 && fx.spell > 0 && !fx.area)) return
    negate(0)
    say(h, c, 'lost an image')
    eff.power = (eff.power - 1) & 0xff
    if (eff.power === 0) return removeFirst(h, c, 0x1c).then(() => {})
  },
  /** 35 [21] Confusion (0x27D29): d100, then a save vs spell at −2 ends it */
  async confusion(h, _e, c) {
    const d = h.roll(1, 100)
    if (d >= 1 && d <= 10) {
      await removeFirst(h, c, 0x23)
      h.setRec(c, 0x10, 1)
      c[F.quick] = 1
      if (c[F.morale] <= 0x7f) c[F.morale] = 0xb3
      h.setRec(c, 0xa, 0)
      await addEffect(h, c, 0x8e, 10, 0, 1, 1, false, false, 'runs away')
    } else if (d >= 11 && d <= 60) {
      say(h, c, 'is confused')
      h.endTurn(c)
    } else if (d >= 61 && d <= 80) {
      // 0x89 holds the side to return to; it runs at once even if the add was blocked (no record then)
      await addEffect(h, c, 0x89, 1, c[F.side], 1, 1, false, false, 'goes berserk')
      const e = h.effectsOf(c).find((x) => x.type === 0x89) ?? { type: 0x89, duration: 1, power: c[F.side], flag: 1 }
      await runEffect(h, 0x89, e, c)
    } else if (d >= 81 && d <= 100) say(h, c, 'is enraged')
    if (h.save(c, 4, -2)) await removeFirst(h, c, 0x23)
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
  /** 57 [2] engulf (0x2E582): both hand-1 hits on an active target: held (0x3A), suffocating (0x0D, 2d4) */
  engulf(h, _e, c) {
    const t = h.targetOf(c)
    if (fx.hits[1] !== 2 || !t || !t[F.inPlay] || has(h, t, 0x3a) || has(h, t, 0x0d)) return
    h.print(`${h.name(c)} engulfs ${h.name(t)}`)
    return hold(h, c, t, 0x8b, () => { addRaw(h, t, 0x0d, 0, h.roll(2, 4), 0) })
  },
  /** 96 [2] hug (0x2ED5C): a roll of 18 or more holds the target (0x3A), the hugger gets 0x90 */
  hug(h, _e, c) {
    const t = h.targetOf(c)
    if (s8(fx.roll) < 18 || !t) return
    h.print(`${h.name(c)} hugs ${h.name(t)}`)
    return hold(h, c, t, 0x90)
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
  feeblemind(h, _e, c) {
    c[F.stat[1]] = 7
    c[F.stat[2]] = 7
    say(h, c, 'is stupid')
    if (!h.inCombat()) return
    h.setRec(c, 1, 0)
    const s = h.rec(c, 0)
    if (s > 0) { say(h, c, 'lost a spell'); forget(c, s); h.setRec(c, 0, 0) }
  },
  /** 69 [1] (0x28986): an attacker of the type without 0x18 cannot target; its roll is worse either way */
  untargetableBy(h, _e, _c, _r, p) {
    const a = h.current()
    if (!a || a[F.monsterType] !== num(p, 'type')) return
    if (!has(h, a, 0x18)) fx.untargetable = true
    fx.roll += num(p, 'roll')
  },
  /** 73, 110, 135 [6] (0x28A22, 0x29502, 0x29B05): damage of the type negated */
  immune(h, _e, c, _r, p) {
    if (!(fx.dmgType & num(p, 'mask'))) return
    negate(0)
    if (num(p, 'say')) say(h, c, 'is unaffected')
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
    if (num(p, 'say')) say(h, c, 'goes berzerk')
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
    if (d > num(p, 'pct')) { say(h, c, 'Spits Acid and Misses'); return }
    say(h, c, 'Spits Acid')
    h.fly?.(c, t, 'spit')
    h.damage(t, c[F.maxHp], 2, h.save(t, 3, 0))
  },
  /** 103 [4] (0x293AD): a target without any of `lacks` takes 1d`sides` more */
  extraDamage(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (t && !list(p, 'lacks').some((x) => has(h, t, x))) fx.dmg = (fx.dmg + h.roll(1, num(p, 'sides'))) & 0xff
  },
  /** 122 [2] (0x29873): the target saves or is held for good (0x34, pw 0xFF) */
  holdOnHit(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t || h.save(t, num(p, 'save'), 0)) return
    addRaw(h, t, 0x34, 0, 0xff, 0)
    say(h, t, 'is paralyzed')
  },
  /** 123 [2] (0x298ED): count d sides of the damage type to the target */
  hitDamage(h, _e, c, _r, p) {
    fx.dmgType = num(p, 'dmgType')
    const t = h.targetOf(c)
    if (t) h.damage(t, h.roll(num(p, 'count'), num(p, 'sides')), 0, false)
  },
  /** 126 [14] gaze (0x4A214): a new target; it saves vs petrification or is held (0x34) for `minutes` */
  async gazeHold(h, _e, c, _r, p) {
    h.setRec(c, 0xa, 0)
    const t = await hookTarget(h, c, num(p, 'hook'))
    if (!t) return
    say(h, c, 'gazes...')
    h.fly?.(c, t, 'gaze')
    if (h.save(t, 1, 0)) return
    addRaw(h, t, 0x34, num(p, 'minutes'), 0xff, 0)
    say(h, t, 'is paralyzed')
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
    say(h, c, 'Breathes Fire')
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
  /** 133 [6] (0x29AA0): blocks some effects, and damage of a type */
  blocks(_h, _e, _c, _r, p) {
    for (const t of list(p, 'types')) negate(t)
    if (fx.dmgType & num(p, 'mask')) negate(0)
  },
  /** 134 [4] (0x29ACC): against a target of the flagged class (giants), + the holder's ranger level */
  rangerVsGiants(h, _e, c, _r, p) {
    if (flags(h.targetOf(c)) & num(p, 'flag')) fx.dmg = (fx.dmg + c[F.levels + 4]) & 0xff
  },
  /** 136 [7] (0x29B1C): no movement this turn */
  noMove(h, _e, c) { h.setRec(c, 6, 0) },
  /** 138 [22] (0x29C20): invisible (25) from the start of combat */
  startInvisible(h, _e, c) { addRaw(h, c, 0x19, 0xff, 0xff, 0) },
  /**
   * 139, 144 [14] the engulfer's and the hugger's hold (0x2EB16, 0x2EC4C): while both are active, an
   * attack of 2d8 (`attacks` of them) on the victim, then the turn ends; otherwise (or on removal) the
   * victim is let go (0x3A, and `also`) and the marker goes.
   */
  async heldVictim(h, eff, c, removal, p) {
    const v = h.byIndex(eff.power)
    const free = async () => { if (v) { await removeFirst(h, v, 0x3a); if (num(p, 'also')) await removeFirst(h, v, num(p, 'also')) } }
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
  zap(h, _e, c) {
    const a = h.current()
    if (!a || h.distance(a, c) >= 2) return
    const dmg = fx.dmg, type = fx.dmgType
    fx.dmg = (fx.dmg * 2) & 0xff
    fx.dmgType = 8
    say(h, a, 'gets zapped')
    h.damage(a, fx.dmg, 0, false)
    fx.dmg = dmg
    fx.dmgType = type
  },
  /** 145 [2] Dispel Evil's touch (0x29D69): a flagged target failing a save vs spell is gone; 4 and 0x91 leave */
  async dispelEvil(h, _e, c, _r, p) {
    const t = h.targetOf(c)
    if (!t) return
    if (!(flags(t) & num(p, 'flag')) || h.save(t, 4, 0)) { say(h, t, 'resists dispel evil'); return }
    h.setStatus(t, 8, `${h.name(t)} is dispelled`)
    const a = h.current() ?? c
    await removeFirst(h, a, 4)
    await removeFirst(h, a, 0x91)
  },
}

/** Run a profile-named behaviour (rules/effects.ts handle). */
export function behave(h: FxHost, spec: HandlerSpec, eff: Effect, c: Uint8Array, removal: boolean): void | Promise<void> {
  const b = BEHAVIOURS[spec.b]
  if (!b) throw new Error(`unknown effect behaviour ${spec.b}`)
  return b(h, eff, c, removal, spec)
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
 * CotAB 0x3F034: what readying (or putting away) an item with item +0x3E ≥ 0x80 does, by its kind
 * (+0x3E & 0x7F). Kind 0 runs the generic item handler 147 (0x29A23, through DS:759C and DS:720C):
 * readying adds effect +0x3D (permanent, power 0xFF, removal flag 1) and runs it at once outside combat;
 * putting it away removes the first of that type. 1 Ring of Wizardry: magic-user slots of levels 1–3
 * doubled, or worked out again from the class (the other ring forgotten, I: as the original). 2, 0x0A
 * DEX (and thief skills for 2), 5 STR, 6 CON and CHA, 8 the stat +0x3D, 0x0C INT, 0x0D STR and INT,
 * 0x0B thief skills; 4 an alignment-locked weapon (+0x3D: alignment, damage << 4); 9 putting it away
 * ends Spiritual Hammer (0x17).
 */
export async function itemKind(h: FxHost, c: Uint8Array, it: Item, ready: boolean) {
  const v = it.raw[0x3d]
  const thief = () => { const t = h.tables?.(); if (t) thiefSkills(t, c, h.itemsOf(c)) } // 0x50F5A
  switch (it.raw[0x3e] & 0x7f) {
    case 0:
      if (!ready) { await removeFirst(h, c, v); break }
      { const e = addRaw(h, c, v, 0, 0xff, 1); if (!h.inCombat()) await runEffect(h, v, e, c) }
      break
    case 1:
      if (ready) for (let i = 0; i < 3; i++) c[F.muSlots + i] = (c[F.muSlots + i] * 2) & 0xff
      else muSlotsAgain(h, c)
      break
    case 2: await effectiveStat(h, c, 3); thief(); break
    case 4: // also when putting it away, as the original
      if ((v & 0x0f) !== c[F.alignment]) { it.ready = false; fx.dmgType = 8; h.damage(c, v >> 4, 0, false) }
      break
    case 5: await effectiveStat(h, c, 0); break
    case 6: await effectiveStat(h, c, 4); await effectiveStat(h, c, 5); break
    case 8: if (v <= 5) await effectiveStat(h, c, v); break
    case 9: if (!ready) await removeFirst(h, c, 0x17); break
    case 0x0a: await effectiveStat(h, c, 3); break
    case 0x0b: thief(); break
    case 0x0c: await effectiveStat(h, c, 1); break
    case 0x0d: await effectiveStat(h, c, 0); await effectiveStat(h, c, 1); break
  }
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
