// The effect host outside combat: what effect handlers reach when the clock times effects out while
// exploring, camping or travelling (FUN_4b46_0000 → FUN_5216_0026), and when items are used from the
// character sheet. Combat-only parts (records, distance, attacks) answer as "not in combat".
import type { Engine } from '../vm/engine'
import { damageText, fire, fx, setStatusOf, type FxHost } from './effects'
import { recalc } from './equip'
import { heal as healChar } from './camp'
import { F } from '../games/fields'
import { Tables } from './chargen'
import { msg, ask, menu } from '../games/strings'

export class WorldHost implements FxHost {
  private readonly e: Engine
  private readonly out: (text: string) => void
  constructor(e: Engine, out?: (text: string) => void) {
    this.e = e
    this.out = out ?? ((t) => e.io.print(t, false))
  }
  effectsOf(c: Uint8Array) { return this.e.effectsOf(c) }
  itemsOf(c: Uint8Array) { return this.e.itemsOf(c) }
  print(t: string) { this.out(t) }
  roll(n: number, s: number) { return this.e.roll(n, s) }
  name(c: Uint8Array) { return String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name])) }
  all() { return this.e.party() }
  inCombat() { return false }
  distance() { return 0 }
  targetOf() { return null }
  current() { return this.e.cur ?? null }
  endTurn() {}
  rec() { return 0 }
  setRec() {}
  setStatus(c: Uint8Array, status: number, msg: string) {
    if (setStatusOf(this, c, status, msg)) this.e.io.sound(5, 'full') // FUN_577f_0e11 outside combat
  }
  /** FUN_5216_1344 outside combat: no dying count, 0 HP is unconscious, past −9 is dead */
  damage(c: Uint8Array, dmg: number, mode: number, saved: boolean) {
    fx.dmg = dmg
    void fire(this, c, 6)
    if (!saved) void fire(this, c, 20) // CotAB 0x4CAB2: damage not saved
    let d = fx.dmg
    if (saved) d = mode === 1 ? 0 : mode === 2 ? d >> 1 : d
    if (d <= 0) return
    this.print(damageText(this.name(c), d, fx.dmgType)) // FUN_5216_1344 prints outside combat too
    const left = c[F.hp] - d
    if (left > 0) { c[F.hp] = left; return }
    // FUN_5216_1344 (CotAB 0x4CAB2) sets the status itself: not the set-status routine, no going down, no event 13
    if ([6, 7, 8].includes(c[F.status])) return
    this.print(left < -9 ? `${this.name(c)} ${msg('fallKilled')}` : `${this.name(c)} ${msg('fallDown')}`)
    c[F.status] = left < -9 ? 6 : 4
    c[F.inPlay] = 0; c[F.hp] = 0
    this.e.io.sound(5, 'full')
  }
  save(c: Uint8Array, type: number, bonus: number) {
    fx.saved = true // CotAB DS:6FC2, as the combat save
    const r = this.e.roll(1, 20)
    if (r === 1) return (fx.saved = false)
    if (r === 20) return (fx.saved = true)
    fx.save = r + ((c[F.saveBonus] << 24) >> 24) + bonus
    fx.saveType = type
    void fire(this, c, 12)
    return (fx.saved = c[F.saves + type] <= fx.save)
  }
  heal(c: Uint8Array, amount: number, force: boolean) {
    return healChar(c, this.e.effectsOf(c), amount, force, false)
  }
  revive(c: Uint8Array, hp: number) {
    c[F.status] = 0; c[F.inPlay] = 1; c[F.hp] = Math.min(hp, c[F.maxHp])
    this.print(`${this.name(c)} ${msg('getsBackUp')}`)
    return true
  }
  recalc(c: Uint8Array) { if (this.e.items) recalc(c, this.e.itemsOf(c), this.e.items) }
  tables() { return this.e.startImage ? new Tables(this.e.startImage) : null }
  enemiesNear() { return [] }
  byIndex(i: number) { return this.e.party()[i] ?? null }
  indexOf(c: Uint8Array) { return Math.max(0, this.e.party().indexOf(c)) }
  async attack() {}
  weapon(c: Uint8Array) { const t = this.e.items; return this.e.itemsOf(c).find((it) => it.ready && t?.baseOf(it)?.slot === 0) ?? null }
  weaponKind(type: number) { return this.e.items?.base[type]?.kind ?? 0 }
  choose(prompt: string, items: string[]) { return this.e.io.menu(items, { prompt }) }
  /** a Yes/No question, the game's "Yes No" (PoR FUN_53aa_10d1, CotAB 0x52A54) */
  async ask(prompt: string) { return (await ask((l, o) => this.e.io.menu(l, o), menu('yesNo'), { prompt })) === 'Y' }
}
