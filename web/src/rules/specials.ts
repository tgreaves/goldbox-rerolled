// Monster specials of effect event 14 (the AI's turn, before its attacks) that work on the battlefield:
// the breath bolt, thrown lightning, the area breaths, the eye rays and the gaze, with the AI target
// hook they share. Each is the original's procedure; the game profile (games/effectrules.ts) names it
// with its parameters for CotAB, PoR's handler switch (rules/effects.ts) calls it for type 88.
// PoR: spec/effects.md; CotAB: spec/coab/effects.md §2 and §7. CotAB addresses are image offsets.
import type { Effect } from '../data/effects'
import type { HandlerSpec } from '../games/effectrules'
import { F } from '../games/fields'
import { fx, has, removeEffect, removeType, type FxHost } from './effects'

const num = (p: HandlerSpec, k: string) => p[k] as number
const say = (h: FxHost, c: Uint8Array, msg: string) => h.print(`${h.name(c)} ${msg}`)
/** CotAB `e3:52` (0x4BE7C): a roll that also records the dice count (DS:6FB2) */
const dice = (h: FxHost, count: number, sides: number) => { fx.dice = count; return h.roll(count, sides) & 0xff }

/**
 * The AI target hook the specials call before acting: the spell target pick for the computer (CotAB
 * *DS:72BA(DS:7760, 1, spell); PoR's DS:6B84[0]), which sets the combatant's target. A host without
 * the battlefield (the tests' plain host) keeps the current target, else the nearest enemy.
 */
export async function hookTarget(h: FxHost, c: Uint8Array, spell: number): Promise<Uint8Array | null> {
  if (h.aimSpell) { await h.aimSpell(c, spell); return h.targetOf(c) }
  const t = h.targetOf(c)
  if (t && t[F.inPlay]) return t
  const near = h.enemiesNear(c, 255).filter((e) => e[F.inPlay])
  near.sort((a, b) => h.distance(c, a) - h.distance(c, b))
  return near[0] ?? null
}

/**
 * The breath bolt: PoR 88 (FUN_4e53_30d9, image 0x41609), CotAB 88 (0x499CD). After round 0 only on
 * d100 > `pct`. "Breathes!"; the hook for spell `spell` (Lightning Bolt) aims; the bolt starts on the
 * square next to the breather in that direction (x + sign(dx), y + sign(dy); one more where that lands
 * on x + 1 or y + 1, the far side of a 2×2 breather); invisibility goes; the flight (COMSPR cycle 19,
 * 4 frames, 50 ms); that square takes the bolt hit, then the bolt runs `len` squares (no first-bounce
 * bonus), both for the breather's max HP, a save vs `save` (breath) halving. Power above 0xFD counts
 * down, else the effect goes (3 breaths from 0xFF); the turn ends. CotAB first sets the damage type
 * 0x24 (`dmgType`), which the hit routine overwrites with 0x0C (O: 0x47977).
 */
export async function breathBolt(h: FxHost, eff: Effect, c: Uint8Array, p: HandlerSpec) {
  if (fx.round !== 0 && h.roll(1, 100) <= num(p, 'pct')) return
  if (p.dmgType !== undefined) fx.dmgType = num(p, 'dmgType')
  const at = h.cellOf?.(c)
  if (!at || !h.aimed || !h.boltHit || !h.bolt) return
  say(h, c, 'Breathes!')
  await h.aimSpell?.(c, num(p, 'spell'))
  let x = at.x + Math.sign(h.aimed.x - at.x), y = at.y + Math.sign(h.aimed.y - at.y)
  if (x === at.x + 1) x++
  if (y === at.y + 1) y++
  h.aimed = { x, y }
  await removeType(h, c, 25)
  h.flyCells?.(at, h.aimed, 19, 4, 50)
  h.boltHit(x, y, c[F.maxHp], num(p, 'save'))
  h.bolt(c, num(p, 'len'), c[F.maxHp], num(p, 'save'), false)
  if (eff.power > 0xfd) eff.power--
  else await removeEffect(h, c, eff)
  h.endTurn(c)
}

/**
 * CotAB 132 "throws lightning" (0x4A121): in rounds below `rounds` only; the hook for Lightning Bolt
 * aims (without a target the aim stays on the thrower's own square, which the first bolt then hits,
 * O); invisibility goes; the flight; the aimed square takes a bolt hit of `count`d`sides`, then a
 * bolt of `len` squares from there with a fresh roll, saves vs `save` (spell); the turn ends.
 */
export async function throwLightning(h: FxHost, _e: Effect, c: Uint8Array, p: HandlerSpec) {
  if (fx.round >= num(p, 'rounds')) return
  const at = h.cellOf?.(c)
  if (!at || !h.aimed || !h.boltHit || !h.bolt) return
  say(h, c, 'throws lightning')
  await h.aimSpell?.(c, num(p, 'spell'))
  await removeType(h, c, 25)
  h.flyCells?.(at, h.aimed, 19, 4, 50)
  h.boltHit(h.aimed.x, h.aimed.y, dice(h, num(p, 'count'), num(p, 'sides')), num(p, 'save'))
  h.bolt(c, num(p, 'len'), dice(h, num(p, 'count'), num(p, 'sides')), num(p, 'save'), false)
  h.endTurn(c)
}

/**
 * CotAB 90 acid breath (0x49C94) and 128 fire breath (0x49E74): the power is set to `uses` in round 0
 * and none are left at 0; the damage type `dmgType`; the hook for spell `spell` must find a target; the
 * area template (0x4573F, `width` lines of `len` squares towards the aimed square) lists who is hit, and
 * with `ownSide` the breath is held back when anyone listed is not an enemy of the breather (90 only).
 * "<msg>" with the pause; one frame of COMSPR cycle 18 flies to the first listed (30 ms); each listed
 * takes the breather's max HP, half on a save vs breath (type 3); power − 1; the turn ends.
 */
export async function breathArea(h: FxHost, eff: Effect, c: Uint8Array, p: HandlerSpec) {
  if (fx.round === 0) eff.power = num(p, 'uses')
  if (eff.power === 0) return
  fx.dmgType = num(p, 'dmgType')
  const at = h.cellOf?.(c)
  if (!at || !h.aimed || !h.fan) return
  let ok = await h.aimSpell?.(c, num(p, 'spell')) ?? false
  const hit = ok ? h.fan(c, h.aimed.x, h.aimed.y, num(p, 'width'), num(p, 'len')) : []
  // 0x49D0C: every one listed must be on the side opposite the breather's (0x4F5B4)
  if (num(p, 'ownSide') && hit.some((t) => t[F.side] !== (c[F.side] === 0 ? 1 : 0))) ok = false
  if (!ok || !hit.length) return
  h.print(`${h.name(c)} ${p.msg as string}`)
  const first = h.cellOf?.(hit[0])
  if (first) h.flyCells?.(at, first, 18, 1, 30)
  for (const t of hit) h.damage(t, c[F.maxHp], 2, h.save(t, 3, 0))
  eff.power = (eff.power - 1) & 0xff
  h.endTurn(c)
}

/**
 * CotAB 87 eye rays (0x2E842): the target is cleared and a new one found (the finder 0x2E394 with
 * forceNew, through the nested 0x2E711); then up to `shots` times while there is a target, the first
 * unused ray whose range (`ranges`, squares by 0x4F758) reaches it: disintegrate, stone, death (a save
 * of `saves`[i] or status `statuses`[i]: "is disintergrated", sic, "is Stoned", "is killed") and
 * wounding (`wound` = count, sides, plus: 2d8 + 1, no save, "wounds you"); each with one frame of COMSPR
 * cycle `frames`[i] + 13 flying to the target (0x2E6A9, 30 ms), and the finder keeping or replacing the
 * target after it. With no ray left in reach, the first unused of `spells` (Fear, Slow, Sleep) is cast
 * as the computer casts (0x45251). Each kind once a turn.
 */
export async function eyeRays(h: FxHost, _e: Effect, c: Uint8Array, p: HandlerSpec) {
  const list = (k: string) => p[k] as number[]
  const ranges = list('ranges'), saves = list('saves'), statuses = list('statuses'), frames = list('frames')
  const wound = list('wound'), spells = list('spells')
  const RAYS = ['fires a disintegrate ray', 'fires a stone to flesh ray', 'fires a death ray', 'wounds you'] // 2a55:427B…42E7
  const GONE = ['is disintergrated', 'is Stoned', 'is killed']
  let used = 0, left = num(p, 'shots')
  h.setRec(c, 0xa, 0)
  h.pickTarget?.(c, true)
  do {
    const t = h.targetOf(c)
    left--
    if (!t) return
    const d = h.distance(c, t)
    const r = ranges.findIndex((range, i) => d <= range && !(used & (1 << i)))
    if (r >= 0) {
      used |= 1 << r
      say(h, c, RAYS[r])
      const a = h.cellOf?.(c), b = h.cellOf?.(t)
      if (a && b) h.flyCells?.(a, b, frames[r] + 13, 1, 30)
      if (r < saves.length) { if (!h.save(t, saves[r], 0)) h.setStatus(t, statuses[r], `${h.name(t)} ${GONE[r]}`) }
      else h.damage(t, dice(h, wound[0], wound[1]) + wound[2], 0, false)
      h.pickTarget?.(c, false)
    } else {
      const k = spells.findIndex((_s, i) => !(used & (1 << (ranges.length + i))))
      if (k >= 0) { await h.castAs?.(c, spells[k]); used |= 1 << (ranges.length + k) }
    }
  } while (left > 0 && h.targetOf(c))
}

/**
 * CotAB 83 petrifying gaze (0x497CE): the target is cleared and the hook (spell `spell`) picks one;
 * none, nothing. "gazes..." and the spell bolt (cycle 18, 4 frames, 45 ms); with effect 0x7F the first
 * readied item of the target named `word` in any of its three name words (+0x2F…+0x31) reflects it
 * back; the victim saves vs petrification or is stoned.
 */
export async function gazeStone(h: FxHost, _e: Effect, c: Uint8Array, p: HandlerSpec) {
  h.setRec(c, 0xa, 0)
  const t = await hookTarget(h, c, num(p, 'spell'))
  if (!t) return
  say(h, c, 'gazes...')
  const a = h.cellOf?.(c), b = h.cellOf?.(t)
  if (a && b) h.flyCells?.(a, b, 18, 4, 45)
  else h.fly?.(c, t, 'gaze')
  let victim = t
  const word = num(p, 'word')
  if (has(h, c, 0x7f) && h.itemsOf(t).some((it) => it.ready && [0x2f, 0x30, 0x31].some((k) => it.raw[k] === word))) {
    say(h, t, 'reflects it!')
    if (a && b) h.flyCells?.(b, a, 18, 4, 45)
    else h.fly?.(t, c, 'gaze')
    victim = c
  }
  if (!h.save(victim, 1, 0)) h.setStatus(victim, 7, `${h.name(victim)} is Stoned`)
}
