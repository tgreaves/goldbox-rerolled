// Shop, temple and treasure screens (spec/A-games/engine/town.md), run when a script's COMBAT finds the shop or
// temple flag set, or treasure without monsters. They use the exploration screen's menus and text.
import { game } from '../games/profile'
import { R } from '../games/rules'
import { T } from '../games/tables'
import type { Engine } from '../vm/engine'
import { parseCharacter } from '../data/character'
import { F } from '../games/fields'
import type { Item } from '../data/items'
import { canTakeItem, recalc } from '../rules/equip'
import { castOutside, spellOn } from '../rules/magic'
import { diseaseTypes } from '../rules/abilities'
import { heal as healChar, raiseDeadHp } from '../rules/camp'

const memorisedReady = (c: Uint8Array) => Array.from({ length: F.memorisedCount }, (_, k) => c[F.memorised + k]).filter((v) => v > 0 && v < 0x80)
import { appraiseGem, appraiseJewel, COINS, coinPrompt, coinValue, keepAsItem, moneyOf, pay, poolAll, priceStock, receive, share, shopPrice, take, takeOne } from '../rules/money'
import { msg, menu, ask, type MenuOpts } from '../games/strings'
import { yes, list } from './camp'

/** A leave question with its routine's own "~Yes ~No" (the ECL menu rule, strings.md §4.1). */
const leaveYes = async (ui: Pick<TownUi, 'menu'>, prompt: string, id: 'shopLeaveYesNo' | 'templeLeaveYesNo' | 'treasureLeaveYesNo') =>
  (await ask((l, o) => ui.menu(l, o), menu(id), { prompt })) === 'Y'

export interface TownUi {
  engine: Engine
  menu(items: string[], opts?: MenuOpts): Promise<number>
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
    const k = await list(ui, kinds.map((i) => `${e.money[i]} ${COINS[i].toUpperCase()}`), { prompt: msg('takeSelectCoin').trimEnd() })
    if (k >= kinds.length) return
    ui.print(`${msg('howMuch')}${coinPrompt(kinds[k])}${msg('takeWillYou')}`.trimEnd(), false)
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
  if (!m[5] && !m[6]) { ui.print(msg('noGems'), false); return }
  ui.print(`${msg('fineCollection')} ${m[5]}${msg(m[5] === 1 ? 'gemOne' : 'gemsCount')}, ${m[6]}${msg(m[6] === 1 ? 'pieceOfJewelry' : 'piecesOfJewelry')}`, true)
  // the game's "  Gems", "  Jewelry" (each when there is one) and " Exit"
  const pick = await ask((l, o) => ui.menu(l, o), [...(m[5] ? menu('appraiseGems') : []), ...(m[6] ? menu('appraiseJewelry') : []), ...menu('appraiseExit')])
  if (pick !== 'G' && pick !== 'J') return
  const kind = pick === 'G' ? 5 : 6
  takeOne(c, kind)
  const value = kind === 5 ? appraiseGem(e.roll(1, 100)) : appraiseJewel(e.roll(1, 100), (n) => e.rand(n))
  ui.print(`${msg(kind === 5 ? 'gemValued' : 'jewelValued')}${value}${msg('gp')}`, false)
  const canKeep = items.length < 16 && canTakeItem(c, items, keepProbe()) === ''
  // "Sell Keep", or "Sell" when it cannot be kept
  const choice = await ask((l, o) => ui.menu(l, o), menu(canKeep ? 'sellKeep' : 'sell'), { prompt: msg('youCan').trimEnd() })
  if (canKeep && choice === 'K') {
    keepAsItem(items, kind, value)
    recalc(c, items, t)
  } else {
    // value div 5 platinum; value mod 5 gp is lost (original)
    const msg = receive(c, items, e.money, value - (value % 5), t, false, 'appraiseOverloaded')
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
  if (!t) { ui.print(`The shop needs the ITEMS file and START.EXE: re-import the ${game().folder} folder.`, false); return }
  e.money = [0, 0, 0, 0, 0, 0, 0]
  for (;;) {
    const has = e.money.some((v) => v > 0)
    const { name, c } = cur(e)
    ui.print(`${name} has ${coinValue(moneyOf(c))} gp in coins.`, true)
    const o = await ask((l, op) => ui.menu(l, op), menu(has ? 'shop' : 'shopNoPool'))
    if (o === 'B' && ui.buy) await ui.buy()
    else if (o === 'B') {
      for (;;) {
        const stock = priceStock(e.treasure)
        const price = (it: Item) => shopPrice((a) => e.read(a), it.value)
        const i = await list(ui, stock.map((it) => `${t.name(it)} — ${price(it)} gp`), { prompt: `${cur(e).name} buys:` })
        if (i >= stock.length) break
        const it = stock[i], buyer = cur(e)
        const why = canTakeItem(buyer.c, buyer.items, it)
        if (why) { ui.print(why === msg('takeOverloaded') ? msg('shopOverloaded') : why, false); continue }
        if (!pay(buyer.c, e.money, price(it), t, buyer.items)) { ui.print(msg('shopNoMoney'), false); continue }
        const copy = it.copy()
        buyer.items.push(copy)
        recalc(buyer.c, buyer.items, t)
        ui.print(`${buyer.name} buys ${t.name(copy)}.`, false)
        ui.refresh()
      }
    } else if (o === 'V') await ui.view('shop')
    else if (o === 'T') await takeMoney(ui)
    else if (o === 'P' || o === 'S') await pooling(ui, o === 'P' ? 'pool' : 'share')
    else if (o === 'A') await appraise(ui)
    else {
      if (e.money.some((v) => v > 0) && await leaveYes(ui, `${msg('shopLeave').trim()} ${msg('shopGoBack')}`, 'shopLeaveYesNo')) continue
      e.money = [0, 0, 0, 0, 0, 0, 0]
      ui.print('', true)
      return
    }
  }
}

/** Temple services: names from the game's table (T.templeNames), kinds and prices from its rules. */
function services(img: Uint8Array) {
  return R.temple.map((x, i) => {
    const o = T.ds + T.templeNames.at + i * T.templeNames.row
    return { ...x, name: String.fromCharCode(...img.subarray(o + 1, o + 1 + img[o])) }
  })
}
const diseases = diseaseTypes

/** Temple (FUN_2d14_0d09). */
export async function temple(ui: TownUi) {
  const e = ui.engine, t = e.items
  if (!t || !e.startImage) { ui.print(`The temple needs the ITEMS file and START.EXE: re-import the ${game().folder} folder.`, false); return }
  e.money = [0, 0, 0, 0, 0, 0, 0]
  for (;;) {
    const has = e.money.some((v) => v > 0)
    const { name, c } = cur(e)
    ui.print(`${name} has ${coinValue(moneyOf(c))} gp in coins.`, true)
    const o = await ask((l, op) => ui.menu(l, op), menu(has ? 'temple' : 'templeNoPool'))
    if (o === 'H') await heal(ui)
    else if (o === 'V') await ui.view('temple')
    else if (o === 'T') await takeMoney(ui)
    else if (o === 'P' || o === 'S') await pooling(ui, o === 'P' ? 'pool' : 'share')
    else if (o === 'A') await appraise(ui)
    else {
      if (e.money.some((v) => v > 0) && await leaveYes(ui, `${msg('templeLeave').trim()} ${msg('templeGoBack')}`, 'templeLeaveYesNo')) continue
      e.money = [0, 0, 0, 0, 0, 0, 0]
      ui.print('', true)
      return
    }
  }
}

/** Heal (FUN_2d14_09d7): the game's services (PoR nine, CotAB ten) for the current character. */
async function heal(ui: TownUi) {
  const e = ui.engine, t = e.items!
  const { c, items, name } = cur(e)
  const fx = e.effectsOf(c)
  const has = (types: number[]) => fx.some((f) => types.includes(f.type))
  const remove = (types: number[]) => { for (let i = fx.length - 1; i >= 0; i--) if (types.includes(fx[i].type)) fx.splice(i, 1) }
  const cures = services(e.startImage!), DISEASES = diseases(e.startImage!), I = game().effects.ids
  // the list's line is the game's "Heal Exit": a cure is chosen from the list (Heal or Enter), or Exit
  const ex = menu('templeHeal').find((w) => w.key === 'E') ?? { text: 'Exit', key: 'E' }
  const i = await ui.menu([...cures.map((x) => x.name.toUpperCase()), ex.text.toUpperCase()], { prompt: `Healing for ${name}:`, vertical: true, keys: [...cures.map(() => ''), ex.key] })
  if (i >= cures.length) return
  const s = cures[i], kind = s.kind
  const status = c[F.status]
  const reason = {
    blind: has([I.blind]) ? '' : msg('notBlind'),
    disease: has(DISEASES) ? '' : msg('notDiseased'),
    clw: '', csw: '', ccw: '', heal: '',
    poison: has([I.poisoned]) ? '' : msg('notPoisoned'),
    raise: status === 6 || status === 1 ? '' : msg('notDead'),
    curse: items.some((x) => x.cursed) || has([I.cursed]) ? '' : msg('notCursed'),
    stone: status === 7 ? '' : msg('notStoned'),
  }[kind]
  if (reason && !await yes(ui, `${name} ${reason} ${msg('cureAnyway').trimEnd()}`)) return
  if (!await yes(ui, `${s.name}${msg('willOnlyCost')}${s.gp}${msg('goldPieces')} ${msg('payForCure').trimEnd()}`)) return
  if (!pay(c, e.money, s.gp, t, items)) { ui.print(msg('templeNoMoney'), false); return }
  // the cures go through the heal routine (PoR FUN_2d14_0401 → FUN_5216_175d, CotAB 0x1CB35 → 0x4CE85):
  // nothing for the dead, the stoned or (PoR) mummy rot, though the fee is paid; someone unconscious is revived
  const hp = (n: number) => { healChar(c, fx, n, false) }
  switch (kind) {
    case 'blind': remove([I.blind]); break
    case 'disease': remove(DISEASES); break
    case 'clw': hp(e.roll(1, 8)); break
    case 'csw': hp(e.roll(2, 8) + 1); break
    case 'ccw': hp(e.roll(3, 8) + 3); break
    case 'heal': // CotAB (image 0x1CBF6): max HP − HP − 1d4 as a byte (0x1CC34), so, with the heal routine's
      // byte sum, HP becomes max − 1d4 even from nearly full; blindness, the diseases, feeblemind (0x44) go;
      // INT and WIS are worked out again from the base values (I: items and effects not re-added)
      hp((c[F.maxHp] - c[F.hp] - e.roll(1, 4)) & 0xff)
      remove([I.blind, ...DISEASES, ...(I.stat ? [I.stat.feebleminded] : [])])
      c[F.stat[1]] = c[F.baseStat[1]]; c[F.stat[2]] = c[F.baseStat[2]]
      break
    case 'poison': remove([I.poisoned, I.slowPoison, I.poisonTick]); break
    case 'raise': if (!reason) raiseDead(e, c); break
    // the game's Remove Curse handler (PoR 0x1DA41 → FUN_4e53_2540, CotAB 0x1D0EB → 0x47575): the curse effect, else the first cursed item
    case 'curse': if (s.spell !== undefined) for (const l of await spellOn(e, c, s.spell)) ui.print(l, false); break
    case 'stone': if (!reason) { c[F.status] = 0; c[F.inPlay] = 1; c[F.hp] = 1 } break // PoR 0x1DAD7: Okay, in play, 1 HP
  }
  recalc(c, items, t)
  ui.print(`${name} ${msg('templeCured')}`, false)
  ui.refresh()
}

/** Raise Dead (FUN_2d14_0510): HP 1, CON −1, maximum HP loss by class levels and CON (rules/camp.ts). */
function raiseDead(e: Engine, c: Uint8Array) {
  const fx = e.effectsOf(c)
  const I = game().effects.ids
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].type === I.animated || fx[i].type === I.poisoned) fx.splice(i, 1)
  c[F.hp] = 1
  c[F.status] = 0
  c[F.inPlay] = 1 // back in play (PoR 0x1D739, CotAB 0x1CDCF)
  raiseDeadHp(c, [2], true)
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
    // the game's pieces: "View Take Pool Share" (money), "View Take Pool" (items), else "View Pool Exit";
    // then " Detect Exit" or " Exit"
    const words = money || items ? [...menu(money ? 'treasureMoney' : 'treasureItems'), ...menu(detect ? 'treasureDetect' : 'treasureExit')] : menu('treasureNone')
    const o = await ask((l, op) => ui.menu(l, op), words)
    if (o === 'D' && detect && e.spells) {
      // cast without the "casts" line; the memorised copy is used up (4e53:0EA7)
      const out = await castOutside(e, e.cur, e.spells.get(detect)!, [e.cur])
      for (const m of out.slice(1)) ui.print(m, false)
      ui.refresh()
      continue
    }
    if (o === 'V') await ui.view('treasure')
    else if (o === 'T') {
      // Take (FUN_2e08_0d38, CotAB 0x1E60E): "Money Items Exit", or straight to the one there is
      const k = money && items ? await ask((l, op) => ui.menu(l, op), menu('take'), { prompt: msg('take').trimEnd() }) : money ? 'M' : 'I'
      if (k === 'M') await takeMoney(ui)
      else if (k === 'I' && t) {
        for (;;) {
          if (!e.treasure.length) break
          const i = await list(ui, e.treasure.map((it) => t.name(it)), { prompt: `${cur(e).name} takes:` })
          if (i >= e.treasure.length) break
          const it = e.treasure[i], who = cur(e)
          const why = canTakeItem(who.c, who.items, it)
          if (why) { ui.print(msg('shopOverloaded'), false); continue }
          e.treasure.splice(i, 1)
          who.items.push(it)
          recalc(who.c, who.items, t)
          ui.refresh()
        }
      }
    } else if (o === 'P' || o === 'S') { if (t) await pooling(ui, o === 'P' ? 'pool' : 'share') }
    else {
      if ((e.money.some((v) => v > 0) || e.treasure.length) && await leaveYes(ui, `${msg('treasureLeft').trim()} ${msg('treasureGoBack')}`, 'treasureLeaveYesNo')) continue
      e.treasure = []
      ui.print('', true)
      return
    }
  }
}
