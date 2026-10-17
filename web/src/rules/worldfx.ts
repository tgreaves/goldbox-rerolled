// The effect host outside combat: what effect handlers reach when the clock times effects out while
// exploring, camping or travelling (FUN_4b46_0000 → FUN_5216_0026), and when items are used from the
// character sheet. Combat-only parts (records, distance, attacks) answer as "not in combat".
import type { Engine } from '../vm/engine'
import { damageText, fire, fx, type FxHost } from './effects'
import { recalc } from './equip'

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
  name(c: Uint8Array) { return String.fromCharCode(...c.subarray(1, 1 + c[0])) }
  all() { return this.e.party() }
  inCombat() { return false }
  distance() { return 0 }
  targetOf() { return null }
  current() { return this.e.cur ?? null }
  endTurn() {}
  rec() { return 0 }
  setRec() {}
  setStatus(c: Uint8Array, status: number, msg: string) {
    if ([6, 7, 8].includes(c[0x10c])) return
    this.print(msg)
    c[0x10c] = status
    if (status !== 0 && status !== 1) { c[0x10d] = 0; c[0x11b] = 0; this.e.io.sound(5) } // FUN_577f_0e11 outside combat
  }
  /** FUN_5216_1344 outside combat: no dying count, 0 HP is unconscious, past −9 is dead */
  damage(c: Uint8Array, dmg: number, mode: number, saved: boolean) {
    fx.dmg = dmg
    void fire(this, c, 6)
    let d = fx.dmg
    if (saved) d = mode === 1 ? 0 : mode === 2 ? d >> 1 : d
    if (d <= 0) return
    this.print(damageText(this.name(c), d, fx.dmgType)) // FUN_5216_1344 prints outside combat too
    const left = c[0x11b] - d
    if (left > 0) { c[0x11b] = left; return }
    this.setStatus(c, left < -9 ? 6 : 4, left < -9 ? `${this.name(c)} is killed` : `${this.name(c)} goes down`)
  }
  save(c: Uint8Array, type: number, bonus: number) {
    const r = this.e.roll(1, 20)
    if (r === 1) return false
    if (r === 20) return true
    fx.save = r + ((c[0x101] << 24) >> 24) + bonus
    fx.saveType = type
    void fire(this, c, 12)
    return c[0x6d + type] <= fx.save
  }
  heal(c: Uint8Array, amount: number, force: boolean) {
    if (![0, 1, 4, 5].includes(c[0x10c])) return
    if (!force && this.e.effectsOf(c).some((f) => f.type === 0x32)) return
    c[0x11b] = Math.min(c[0x32], c[0x11b] + amount)
    if (c[0x11b] > 0 && (c[0x10c] === 4 || c[0x10c] === 5)) { c[0x10c] = 0; c[0x10d] = 1 }
  }
  revive(c: Uint8Array, hp: number) {
    c[0x10c] = 0; c[0x10d] = 1; c[0x11b] = Math.min(hp, c[0x32])
    this.print(`${this.name(c)} gets back up`)
    return true
  }
  recalc(c: Uint8Array) { if (this.e.items) recalc(c, this.e.itemsOf(c), this.e.items) }
  enemiesNear() { return [] }
  byIndex(i: number) { return this.e.party()[i] ?? null }
  indexOf(c: Uint8Array) { return Math.max(0, this.e.party().indexOf(c)) }
  async attack() {}
  weapon(c: Uint8Array) { const t = this.e.items; return this.e.itemsOf(c).find((it) => it.ready && t?.baseOf(it)?.slot === 0) ?? null }
  weaponKind(type: number) { return this.e.items?.base[type]?.kind ?? 0 }
}
