// Shop, temple and treasure screens (spec/town.md), run when a script's COMBAT finds the shop or
// temple flag set, or treasure without monsters. They use the exploration screen's menus and text.
import type { Engine } from '../vm/engine'
import { parseCharacter } from '../data/character'
import type { Item } from '../data/items'
import { canTakeItem, recalc } from '../rules/equip'
import { castOutside } from '../rules/magic'

const memorisedReady = (c: Uint8Array) => Array.from({ length: 21 }, (_, k) => c[0x17 + k]).filter((v) => v > 0 && v < 0x80)
import { appraiseGem, appraiseJewel, COINS, coinValue, keepAsItem, moneyOf, pay, poolAll, receive, share, take, takeOne } from '../rules/money'

export interface TownUi {
  engine: Engine
  menu(items: string[], opts?: { prompt?: string; vertical?: boolean }): Promise<number>
  print(text: string, clear?: boolean): void
  inputNumber(): Promise<number>
  /** the shop's Buy as one panel (IMP-042); without it Buy is the original's list */
  buy?(): Promise<void>
  /** the treasure after a battle as one panel (IMP-056); without it the original's menus */
  treasurePanel?(): Promise<void>
  /** open the current character's sheet (items menu with Sell/Id in shops) and wait for it to close */
  view(mode: 'shop' | 'temple' | 'treasure'): Promise<void>
  refresh(): void
}

const yes = async (ui: TownUi, prompt: string) => (await ui.menu(['YES', 'NO'], { prompt })) === 0

function party(e: Engine) {
  return e.party().map((c) => ({ c, items: e.itemsOf(c) }))
}

function cur(e: Engine) {
  return { c: e.cur, items: e.itemsOf(e.cur), name: parseCharacter(e.cur).name }
}

function moneyLine(m: number[]) {
  return COINS.map((n, i) => (m[i] ? `${m[i]} ${n}` : '')).filter(Boolean).join(', ') || 'nothing'
}

/** Take from the pool (FUN_4c2d_0ceb): pick a kind present, then an amount. */
async function takeMoney(ui: TownUi) {
  const e = ui.engine
  for (;;) {
    const kinds = [6, 5, 4, 3, 2, 1, 0].filter((i) => e.money[i] > 0)
    if (!kinds.length) return
    const k = await ui.menu([...kinds.map((i) => `${e.money[i]} ${COINS[i].toUpperCase()}`), 'EXIT'], { prompt: 'Take which?', vertical: true })
    if (k >= kinds.length) return
    ui.print(`How much ${COINS[kinds[k]]}?`, false)
    const n = await ui.inputNumber()
    const t = e.items!
    const m = take(e.cur, e.itemsOf(e.cur), e.money, kinds[k], n, t)
    if (m) ui.print(m, false)
    ui.refresh()
  }
}

/** Appraise (FUN_4c2d_19b2): one gem or jewel at a time; Sell (platinum) or Keep (an item). */
async function appraise(ui: TownUi) {
  const e = ui.engine, t = e.items!
  const { c, items } = cur(e)
  const m = moneyOf(c)
  if (!m[5] && !m[6]) { ui.print('No Gems or Jewelry', false); return }
  ui.print(`You have a fine collection of: ${m[5]} Gems, ${m[6]} pieces of Jewelry`, true)
  const opts = [...(m[5] ? ['GEMS'] : []), ...(m[6] ? ['JEWELRY'] : []), 'EXIT']
  const pick = opts[await ui.menu(opts)]
  if (pick === 'EXIT') return
  const kind = pick === 'GEMS' ? 5 : 6
  takeOne(c, kind)
  const value = kind === 5 ? appraiseGem(e.roll(1, 100)) : appraiseJewel(e.roll(1, 100), (n) => e.rand(n))
  ui.print(kind === 5 ? `The Gem is Valued at ${value} gp.` : `The Jewel is Valued at ${value} gp.`, false)
  const canKeep = items.length < 16 && canTakeItem(c, items, keepProbe()) === ''
  const choice = await ui.menu(canKeep ? ['SELL', 'KEEP'] : ['SELL'], { prompt: 'You can :' })
  if (canKeep && choice === 1) {
    keepAsItem(items, kind, value)
    recalc(c, items, t)
  } else {
    // value div 5 platinum; value mod 5 gp is lost (original)
    const msg = receive(c, items, e.money, value - (value % 5), t, false)
    if (msg) ui.print(msg, false)
  }
  ui.refresh()
}

function keepProbe(): Item {
  // a 1-coin item for the "can carry one more" test
  return { weight: 1, count: 0 } as unknown as Item
}

async function pooling(ui: TownUi, k: 'pool' | 'share') {
  const e = ui.engine, t = e.items!
  if (k === 'pool') poolAll(party(e), e.money, t)
  else share(party(e), e.money, t)
  ui.print(`The pool holds ${moneyLine(e.money)}.`, false)
  ui.refresh()
}

/** Shop (FUN_2f70_053e). */
export async function shop(ui: TownUi) {
  const e = ui.engine, t = e.items
  if (!t) { ui.print('The shop needs the ITEMS file and START.EXE: re-import the POOLRAD folder.', false); return }
  e.money = [0, 0, 0, 0, 0, 0, 0]
  for (;;) {
    const has = e.money.some((v) => v > 0)
    const opts = has ? ['BUY', 'VIEW', 'TAKE', 'POOL', 'SHARE', 'APPRAISE', 'EXIT'] : ['BUY', 'VIEW', 'POOL', 'APPRAISE', 'EXIT']
    const { name, c } = cur(e)
    ui.print(`${name} has ${coinValue(moneyOf(c))} gp in coins.`, true)
    const o = opts[await ui.menu(opts)]
    if (o === 'BUY' && ui.buy) await ui.buy()
    else if (o === 'BUY') {
      for (;;) {
        const stock = e.treasure
        const i = await ui.menu([...stock.map((it) => `${t.name(it)} — ${it.value} gp`), 'EXIT'], { prompt: `${cur(e).name} buys:`, vertical: true })
        if (i >= stock.length) break
        const it = stock[i], buyer = cur(e)
        const why = canTakeItem(buyer.c, buyer.items, it)
        if (why) { ui.print(why === 'Overloaded' ? 'OverLoaded' : why, false); continue }
        if (!pay(buyer.c, e.money, it.value, t, buyer.items)) { ui.print('Not enough money.', false); continue }
        const copy = it.copy()
        buyer.items.push(copy)
        recalc(buyer.c, buyer.items, t)
        ui.print(`${buyer.name} buys ${t.name(copy)}.`, false)
        ui.refresh()
      }
    } else if (o === 'VIEW') await ui.view('shop')
    else if (o === 'TAKE') await takeMoney(ui)
    else if (o === 'POOL' || o === 'SHARE') await pooling(ui, o === 'POOL' ? 'pool' : 'share')
    else if (o === 'APPRAISE') await appraise(ui)
    else {
      if (e.money.some((v) => v > 0) && await yes(ui, 'As you Leave the Shopkeeper says, "Excuse me but you have Left Some Money here." Do you want to go back and get your Money?')) continue
      e.money = [0, 0, 0, 0, 0, 0, 0]
      ui.print('', true)
      return
    }
  }
}

/** Temple services (DS:011A): name, price, condition, effect. */
const SERVICES: { name: string; gp: number }[] = [
  { name: 'Cure Blindness', gp: 1000 }, { name: 'Cure Disease', gp: 1000 }, { name: 'Cure Light Wounds', gp: 100 },
  { name: 'Cure Serious Wounds', gp: 350 }, { name: 'Cure Critical Wounds', gp: 600 }, { name: 'Neutralize Poison', gp: 1000 },
  { name: 'Raise Dead', gp: 5500 }, { name: 'Remove Curse', gp: 3500 }, { name: 'Stone to Flesh', gp: 2000 },
]
const DISEASES = [31, 34, 43, 44, 50, 57]

/** Temple (FUN_2d14_0d09). */
export async function temple(ui: TownUi) {
  const e = ui.engine, t = e.items
  if (!t) { ui.print('The temple needs the ITEMS file and START.EXE: re-import the POOLRAD folder.', false); return }
  e.money = [0, 0, 0, 0, 0, 0, 0]
  for (;;) {
    const has = e.money.some((v) => v > 0)
    const opts = has ? ['HEAL', 'VIEW', 'TAKE', 'POOL', 'SHARE', 'APPRAISE', 'EXIT'] : ['HEAL', 'VIEW', 'POOL', 'APPRAISE', 'EXIT']
    const { name, c } = cur(e)
    ui.print(`${name} has ${coinValue(moneyOf(c))} gp in coins.`, true)
    const o = opts[await ui.menu(opts)]
    if (o === 'HEAL') await heal(ui)
    else if (o === 'VIEW') await ui.view('temple')
    else if (o === 'TAKE') await takeMoney(ui)
    else if (o === 'POOL' || o === 'SHARE') await pooling(ui, o === 'POOL' ? 'pool' : 'share')
    else if (o === 'APPRAISE') await appraise(ui)
    else {
      if (e.money.some((v) => v > 0) && await yes(ui, 'As you leave a priest says, "Excuse me but you have left some money here" Do you want to go back and retrieve your money?')) continue
      e.money = [0, 0, 0, 0, 0, 0, 0]
      ui.print('', true)
      return
    }
  }
}

/** Heal (FUN_2d14_09d7): the nine services for the current character. */
async function heal(ui: TownUi) {
  const e = ui.engine, t = e.items!
  const { c, items, name } = cur(e)
  const fx = e.effectsOf(c)
  const has = (types: number[]) => fx.some((f) => types.includes(f.type))
  const remove = (types: number[]) => { for (let i = fx.length - 1; i >= 0; i--) if (types.includes(fx[i].type)) fx.splice(i, 1) }
  const i = await ui.menu([...SERVICES.map((s) => s.name.toUpperCase()), 'EXIT'], { prompt: `Healing for ${name}:`, vertical: true })
  if (i >= SERVICES.length) return
  const s = SERVICES[i]
  const status = c[0x10c]
  const reason = [
    has([33]) ? '' : 'is not blind.',
    has(DISEASES) ? '' : 'is not Diseased.',
    '', '', '',
    has([55]) ? '' : 'is not poisoned.',
    status === 6 || status === 1 ? '' : 'is not dead.',
    items.some((x) => x.cursed) || has([36]) ? '' : 'is not cursed.',
    status === 7 ? '' : 'is not stoned.',
  ][i]
  if (reason && !await yes(ui, `${name} ${reason} cast cure anyway:`)) return
  if (!await yes(ui, `${s.name} will only cost ${s.gp} gold pieces. pay for cure?`)) return
  if (!pay(c, e.money, s.gp, t, items)) { ui.print('Not enough money.', false); return }
  const hp = (n: number) => { c[0x11b] = Math.min(c[0x32], c[0x11b] + n) }
  switch (i) {
    case 0: remove([33]); break
    case 1: remove(DISEASES); break
    case 2: if (!reason) hp(e.roll(1, 8)); break
    case 3: hp(e.roll(2, 8) + 1); break
    case 4: hp(e.roll(3, 8) + 3); break
    case 5: remove([55, 22, 15]); break
    case 6: if (!reason) raiseDead(e, c); break
    case 7: remove([36]); for (const x of items) x.raw[0x36] = 0; break
    case 8: if (!reason) { c[0x10c] = 0; c[0x11b] = 1 } break
  }
  recalc(c, items, t)
  ui.print(`${name} is cured.`, false)
  ui.refresh()
}

/** Raise Dead (FUN_2d14_0510): HP 1, CON −1, maximum HP loss by class levels and CON. */
function raiseDead(e: Engine, c: Uint8Array) {
  const fx = e.effectsOf(c)
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].type === 32 || fx[i].type === 55) fx.splice(i, 1)
  c[0x11b] = 1
  c[0x10c] = 0
  if (c[0x14] > 0) c[0x14]--
  const con = c[0x14]
  if (con < 14) return
  const b = Math.max(0, c[0x32] - c[0xb1])
  let t = 0
  for (let k = 0; k < 8; k++) {
    const L = c[0x96 + k]
    if (L <= 0) continue
    t += k === 2 ? L * (con - 14) : con > 15 ? 2 * L : L
  }
  const loss = t > 0 ? Math.floor(b / t) : b
  if (con < 17 || c[0x98] <= 0) c[0x32] = Math.max(1, c[0x32] - loss)
}

/** Treasure screen (FUN_2e08_0ecd), after a fight or a scripted TREASURE without monsters. */
export async function treasure(ui: TownUi) {
  const e = ui.engine, t = e.items
  if (ui.treasurePanel && t && (e.money.some((v) => v > 0) || e.treasure.length)) {
    await ui.treasurePanel()
    e.treasure = []
    ui.print('', true)
    return
  }
  for (;;) {
    const money = e.money.some((v) => v > 0), items = e.treasure.length > 0
    if (money || items) {
      const parts = [money ? moneyLine(e.money) : '', items && t ? e.treasure.map((it) => t.name(it)).join(', ') : ''].filter(Boolean)
      ui.print(`Treasure: ${parts.join('; ')}.`, true)
    }
    // FUN_2e08_0ecd: " Detect" when there are items and the current character has Detect Magic ready (5 or 11)
    const detect = items ? memorisedReady(e.cur).find((id) => id === 5 || id === 11) : undefined
    const opts = [...(money ? ['VIEW', 'TAKE', 'POOL', 'SHARE'] : items ? ['VIEW', 'TAKE', 'POOL'] : ['VIEW', 'POOL']), ...(detect ? ['DETECT'] : []), 'EXIT']
    const o = opts[await ui.menu(opts)]
    if (o === 'DETECT' && detect && e.spells) {
      // cast without the "casts" line; the memorised copy is used up (4e53:0EA7)
      const out = await castOutside(e, e.cur, e.spells.get(detect)!, [e.cur])
      for (const m of out.slice(1)) ui.print(m, false)
      ui.refresh()
      continue
    }
    if (o === 'VIEW') await ui.view('treasure')
    else if (o === 'TAKE') {
      const kinds = [...(money ? ['MONEY'] : []), ...(items ? ['ITEMS'] : [])]
      const k = kinds.length === 1 ? kinds[0] : kinds[await ui.menu([...kinds, 'EXIT'], { prompt: 'Take:' })]
      if (k === 'MONEY') await takeMoney(ui)
      else if (k === 'ITEMS' && t) {
        for (;;) {
          if (!e.treasure.length) break
          const i = await ui.menu([...e.treasure.map((it) => t.name(it)), 'EXIT'], { prompt: `${cur(e).name} takes:`, vertical: true })
          if (i >= e.treasure.length) break
          const it = e.treasure[i], who = cur(e)
          const why = canTakeItem(who.c, who.items, it)
          if (why) { ui.print('OverLoaded', false); continue }
          e.treasure.splice(i, 1)
          who.items.push(it)
          recalc(who.c, who.items, t)
          ui.refresh()
        }
      }
    } else if (o === 'POOL' || o === 'SHARE') { if (t) await pooling(ui, o === 'POOL' ? 'pool' : 'share') }
    else {
      if ((e.money.some((v) => v > 0) || e.treasure.length) && await yes(ui, 'There is still treasure left. Do you want to go back and claim your treasure?')) continue
      e.treasure = []
      ui.print('', true)
      return
    }
  }
}
