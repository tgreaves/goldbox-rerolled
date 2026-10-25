// Shop, temple and treasure screens (spec/A-games/engine/town.md), run when a script's COMBAT finds the shop or
// temple flag set, or treasure without monsters. They use the exploration screen's menus and text.
import { game } from '../games/profile'
import { R, type TempleService } from '../games/rules'
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
import { appraiseGem, appraiseJewel, COINS, coinPrompt, coinValue, keepAsItem, moneyOf, pay, buy, poolAll, priceStock, receive, share, shopPrice, take, takeOne } from '../rules/money'
import { msg, hasMsg, menu, ask, type MenuOpts } from '../games/strings'
import { effectiveStat } from '../rules/effectkinds'
import { WorldHost } from '../rules/worldfx'
import { yes, list } from './camp'

/** A leave question with its routine's own "~Yes ~No" (the ECL menu rule, strings.md §4.1). */
const leaveYes = async (ui: Pick<TownUi, 'menu'>, prompt: string, id: 'shopLeaveYesNo' | 'templeLeaveYesNo' | 'treasureLeaveYesNo') =>
  (await ask((l, o) => ui.menu(l, o), menu(id), { prompt })) === 'Y'

export interface TownUi {
  engine: Engine
  menu(items: string[], opts?: MenuOpts): Promise<number>
  print(text: string, clear?: boolean): void
  inputNumber(): Promise<number>
  /**
   * The shop as one window (IMP-042, IMP-099, IMP-100): buying, the pool, Appraise and View in it, the
   * command bar not used; 'view' to open the sheet (Sell, Id), then the window again. Without it the
   * original's menus.
   */
  shopWindow?(desk: TownDesk): Promise<'view' | 'done'>
  /** the temple as one window (IMP-097, IMP-099, IMP-100), as the shop's */
  templeWindow?(desk: TownDesk): Promise<'view' | 'done'>
  /** the treasure after a battle as one panel (IMP-056); without it the original's menus */
  treasurePanel?(): Promise<void>
  /** SotSB's vault as the treasure panel (IMP-099): 'deposit' for the sheet's Deposit, then the panel again */
  vaultPanel?(): Promise<'deposit' | 'done'>
  /** open the current character's sheet (items menu with Sell/Id in shops) and wait for it to close */
  view(mode: 'shop' | 'temple' | 'treasure' | 'vault'): Promise<void>
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

/** Appraise one gem (5) or jewel (6) of the current character (FUN_4c2d_19b2): taken from their coins and valued; whether it could be kept as an item. */
function appraiseOne(e: Engine, kind: 5 | 6): { value: number; canKeep: boolean } {
  const { c, items } = cur(e)
  takeOne(c, kind)
  const value = kind === 5 ? appraiseGem(e.roll(1, 100)) : appraiseJewel(e.roll(1, 100), (n) => e.rand(n))
  return { value, canKeep: items.length < 16 && canTakeItem(c, items, keepProbe()) === '' }
}

/** The piece appraised kept (an item) or sold (value div 5 platinum; value mod 5 gp is lost, as the original); the refusal, if any. */
function settleAppraised(e: Engine, kind: 5 | 6, value: number, keep: boolean): string {
  const t = e.items!, { c, items } = cur(e)
  if (keep) { keepAsItem(items, kind, value); recalc(c, items, t); return '' }
  return receive(c, items, e.money, value - (value % 5), t, false, 'appraiseOverloaded') || ''
}

/** Appraise (FUN_4c2d_19b2): one gem or jewel at a time; Sell (platinum) or Keep (an item). */
async function appraise(ui: TownUi) {
  const e = ui.engine
  const m = moneyOf(cur(e).c)
  if (!m[5] && !m[6]) { ui.print(msg('noGems'), false); return }
  ui.print(`${msg('fineCollection')} ${m[5]}${msg(m[5] === 1 ? 'gemOne' : 'gemsCount')}, ${m[6]}${msg(m[6] === 1 ? 'pieceOfJewelry' : 'piecesOfJewelry')}`, true)
  // the game's "  Gems", "  Jewelry" (each when there is one) and " Exit"
  const pick = await ask((l, o) => ui.menu(l, o), [...(m[5] ? menu('appraiseGems') : []), ...(m[6] ? menu('appraiseJewelry') : []), ...menu('appraiseExit')])
  if (pick !== 'G' && pick !== 'J') return
  const kind = pick === 'G' ? 5 : 6
  const { value, canKeep } = appraiseOne(e, kind)
  ui.print(`${msg(kind === 5 ? 'gemValued' : 'jewelValued')}${value}${msg('gp')}`, false)
  // "Sell Keep", or "Sell" when it cannot be kept
  const choice = await ask((l, o) => ui.menu(l, o), menu(canKeep ? 'sellKeep' : 'sell'), { prompt: msg('youCan').trimEnd() })
  const refused = settleAppraised(e, kind, value, canKeep && choice === 'K')
  if (refused) ui.print(refused, false)
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
  if (ui.shopWindow) return inWindow(ui, 'shop', ui.shopWindow)
  for (;;) {
    const has = e.money.some((v) => v > 0)
    const { name, c } = cur(e)
    ui.print(`${name} has ${coinValue(moneyOf(c))} gp in coins.`, true)
    const o = await ask((l, op) => ui.menu(l, op), menu(has ? 'shop' : 'shopNoPool'))
    if (o === 'B') {
      for (;;) {
        const stock = priceStock(e.treasure)
        const price = (it: Item) => shopPrice((a) => e.read(a), it.value)
        const i = await list(ui, stock.map((it) => `${t.name(it)} — ${price(it)} gp`), { prompt: `${cur(e).name} buys:` })
        if (i >= stock.length) break
        const it = stock[i], buyer = cur(e)
        const r = buy(buyer.c, buyer.items, e.money, price(it), it, t)
        if ('refused' in r) { ui.print(r.refused === 'noMoney' ? msg('shopNoMoney') : r.refused === 'overloaded' ? msg('shopOverloaded') : r.refused, false); continue }
        ui.print(`${buyer.name} buys ${t.name(r.copy)}.`, false)
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
  if (ui.templeWindow) return inWindow(ui, 'temple', ui.templeWindow)
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

/** why `kind` is not needed for `c` (the game's "is not blind." … line), '' when it is */
function reasonFor(e: Engine, kind: TempleService, c: Uint8Array): string {
  const fx = e.effectsOf(c), items = e.itemsOf(c), status = c[F.status], I = game().effects.ids
  const has = (types: number[]) => fx.some((f) => types.includes(f.type))
  return {
    blind: has([I.blind]) ? '' : msg('notBlind'),
    disease: has(diseases(e.startImage!)) ? '' : msg('notDiseased'),
    clw: '', csw: '', ccw: '', heal: '',
    poison: has([I.poisoned]) ? '' : msg('notPoisoned'),
    raise: status === 6 || status === 1 ? '' : msg('notDead'),
    curse: items.some((x) => x.cursed) || has([I.cursed]) ? '' : msg('notCursed'),
    stone: status === 7 ? '' : msg('notStoned'),
  }[kind]
}
const healPrompt = (name: string) => hasMsg('templeHowHelp') ? `${name}${msg('templeHowHelp')}` : `Healing for ${name}:`

/** The game's questions before service `i` for the current character: "cure anyway" when it is not needed, then the price (priced temples). */
function cureQuestions(e: Engine, i: number): string[] {
  if (R.templeHeal.mode === 'free') return []
  const s = services(e.startImage!)[i], { c, name } = cur(e), reason = reasonFor(e, s.kind, c)
  return [...(reason ? [`${name} ${reason} ${msg('cureAnyway').trimEnd()}`] : []),
    `${s.name}${msg('willOnlyCost')}${s.gp}${msg('goldPieces')} ${msg('payForCure').trimEnd()}`]
}

/** Heal (FUN_2d14_09d7): the game's services (PoR nine, CotAB ten) for the current character, the list
 *  coming back after each service, cured or not, until its Exit (PoR 0x1DD3D–0x1DD4B). */
async function heal(ui: TownUi) {
  const e = ui.engine
  const cures = services(e.startImage!)
  for (;;) {
    // the list's line is the game's "Heal Exit": a cure is chosen from the list (Heal or Enter), or Exit
    const ex = menu('templeHeal').find((w) => w.key === 'E') ?? { text: 'Exit', key: 'E' }
    const i = await ui.menu([...cures.map((x) => x.name.toUpperCase()), ex.text.toUpperCase()], { prompt: healPrompt(cur(e).name), vertical: true, keys: [...cures.map(() => ''), ex.key] })
    if (i >= cures.length) return
    let go = true
    for (const q of cureQuestions(e, i)) if (!(go = await yes(ui, q))) break
    if (go) await performCure(ui, i)
  }
}

/** Service `i` for the current character once its questions are answered yes: the payment, the cure, the game's lines. */
async function performCure(ui: TownUi, i: number) {
  const e = ui.engine, t = e.items!
  const cures = services(e.startImage!), DISEASES = diseases(e.startImage!), I = game().effects.ids
  const { c, items, name } = cur(e)
  const fx = e.effectsOf(c)
  const remove = (types: number[]) => { for (let i = fx.length - 1; i >= 0; i--) if (types.includes(fx[i].type)) fx.splice(i, 1) }
  const s = cures[i], kind = s.kind
  if (R.templeHeal.mode === 'free') { await freeCure(ui, s, R.templeHeal.raise); ui.refresh(); return }
  const reason = reasonFor(e, kind, c)
  if (!pay(c, e.money, s.gp)) { ui.print(msg('templeNoMoney'), false); return }
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
  // no items' recompute after a cure: the encumbrance keeps the fee paid (PoR in DOSBox, a Cure Light
  // Wounds: char[0x102] as loaded); Remove Curse, which may free a readied item, is recomputed (I)
  if (kind === 'curse') recalc(c, items, t)
  ui.print(`${name} ${msg('templeCured')}`, false)
  ui.refresh()
}

/**
 * What the shop and temple windows (IMP-100) do through the rules: the same steps as the menus above,
 * their lines returned to the window instead of printed to the log.
 */
export interface TownDesk {
  /** the temple's question for the current character ("*Name*, how can we help you?") */
  healHeading(): string
  /** the temple's services for the current character: name, price ("free" in SotSB), why not needed */
  services(): { name: string; price: string; note: string }[]
  /** the game's questions before service `i` (each must be answered yes) */
  cureQuestions(i: number): string[]
  /** service `i` after its questions: the game's lines */
  cure(i: number): Promise<string[]>
  /** the current character's gems and pieces of jewelry */
  gems(): { gems: number; jewels: number }
  /** one gem (5) or jewel (6) appraised: its value, the game's line, whether it can be kept */
  appraise(kind: 5 | 6): { value: number; line: string; canKeep: boolean }
  /** the piece sold or kept; the refusal, if any */
  settle(kind: 5 | 6, value: number, keep: boolean): string
  /** the game's question on leaving with money in the pool (Yes goes back); null when the pool is empty */
  leaveQuestion(): string | null
}

/** The shop or temple in its window: View opens the sheet, then the window again; the pool is emptied on leaving, as the menus do. */
async function inWindow(ui: TownUi, where: 'shop' | 'temple', open: (d: TownDesk) => Promise<'view' | 'done'>) {
  const e = ui.engine
  const lines = (f: (cap: TownUi) => Promise<void>) => async () => {
    const out: string[] = []
    await f({ ...ui, engine: e, print: (t: string) => { if (t) out.push(t) } })
    return out
  }
  const d: TownDesk = {
    healHeading: () => healPrompt(cur(e).name),
    services: () => {
      const { c } = cur(e), free = R.templeHeal.mode === 'free'
      return services(e.startImage!).map((s) => ({ name: s.name, price: free ? 'free' : `${s.gp} gp`, note: reasonFor(e, s.kind, c).trim() }))
    },
    cureQuestions: (i) => cureQuestions(e, i),
    cure: (i) => lines((cap) => performCure(cap, i))(),
    gems: () => { const m = moneyOf(cur(e).c); return { gems: m[5], jewels: m[6] } },
    appraise: (kind) => {
      const r = appraiseOne(e, kind)
      return { ...r, line: `${msg(kind === 5 ? 'gemValued' : 'jewelValued')}${r.value}${msg('gp')}` }
    },
    settle: (kind, value, keep) => { const r = settleAppraised(e, kind, value, keep); ui.refresh(); return r },
    leaveQuestion: () => e.money.some((v) => v > 0)
      ? (where === 'shop' ? `${msg('shopLeave').trim()} ${msg('shopGoBack')}` : `${msg('templeLeave').trim()} ${msg('templeGoBack')}`) : null,
  }
  while (await open(d) === 'view') await ui.view(where)
  e.money = [0, 0, 0, 0, 0, 0, 0]
  ui.print('', true)
}

/**
 * A free temple's service (SotSB 0x22FA5 → 0x225F6 … 0x22F0B): no question, no price; the cure, or the
 * game's line saying why not, "<name> <line>" (0x151:0x84). Effects come off first-of-type, as the remove
 * routine with no record does; INT, WIS (Heal) and STR (Cure Disease) are worked out again (0x145:0x8E).
 */
async function freeCure(ui: TownUi, s: { kind: TempleService; spell?: number }, raise: { notRaces: number[]; removes: number[]; fighters: number[] }) {
  const e = ui.engine, t = e.items!
  const { c, items, name } = cur(e)
  const fx = e.effectsOf(c), I = game().effects.ids, DISEASES = diseases(e.startImage!)
  const h = new WorldHost(e, (m) => ui.print(m, false))
  const has = (type: number) => fx.some((f) => f.type === type)
  const takeOff = (type: number) => { const j = fx.findIndex((f) => f.type === type); if (j < 0) return false; fx.splice(j, 1); return true }
  const say = (id: Parameters<typeof msg>[0]) => ui.print(`${name} ${msg(id).trim()}`, false)
  const levels: Partial<Record<TempleService, number>> = { clw: 1, csw: 2, ccw: 3, heal: 4 }
  switch (s.kind) {
    case 'blind': if (takeOff(I.blind)) say('templeCanSee'); else say('notBlind'); break // 0x225F6
    case 'disease': { // 0x22683
      if (!DISEASES.some(has)) { say('notDiseased'); break }
      say('templeIsCured')
      for (const d of DISEASES) takeOff(d)
      await effectiveStat(h, c, 0)
      break
    }
    case 'clw': case 'csw': case 'ccw': case 'heal': { // 0x227E1 with the level 1–4
      let level = levels[s.kind]!, line: Parameters<typeof msg>[0] = 'templeHealed', cured = false, amount = 0
      if (c[F.status] === 6) { level = 0; line = 'templeMustRaise' }
      if (c[F.status] === 7) { level = 0; line = 'templeStonemason' }
      if (c[F.status] === 8) { level = 0; line = 'templeNotHere' }
      const full = c[F.hp] === c[F.maxHp]
      if (full) line = 'templeNoNeed'
      if (!full) {
        if (level === 1) amount = e.roll(1, 8)
        else if (level === 2) amount = e.roll(2, 8) + 1
        else if (level === 3) amount = e.roll(3, 8) + 3
        else if (level === 4) amount = (c[F.maxHp] - c[F.hp] - e.roll(1, 4)) & 0xff // as CotAB's Heal, a byte
      }
      if (level === 4) {
        if (takeOff(I.blind)) cured = true
        if (I.stat && takeOff(I.stat.feebleminded)) cured = true
        for (const d of DISEASES) if (takeOff(d)) cured = true
        if (cured) say('templeIsCured')
        if (!full && cured) line = 'templeFullyHealed'
        await effectiveStat(h, c, 1); await effectiveStat(h, c, 2)
      }
      if (!full && level) healChar(c, fx, amount, false)
      say(line)
      break
    }
    case 'poison': { // 0x22D12
      if (!has(I.poisoned)) { say('notPoisoned'); break }
      if (c[F.hp] === 0) c[F.hp] = 1
      for (const x of [I.poisoned, I.slowPoison, I.poisonTick]) takeOff(x)
      c[F.inPlay] = 1; c[F.status] = 0
      say('templeNoLongerPoisoned')
      break
    }
    case 'raise': { // 0x22AA7
      if (c[F.status] !== 6) { say('notDead'); break }
      if (raise.notRaces.includes(c[F.race])) { say('templeCannotRaise'); break }
      say('templeResurrected')
      for (const x of raise.removes) takeOff(x)
      c[F.hp] = 1; c[F.status] = 0; c[F.inPlay] = 1
      raiseDeadHp(c, raise.fighters, false)
      break
    }
    case 'curse': // 0x22E26: a cursed item or the curse effect: the game's Remove Curse (DS:8C67 := the character)
      if (!items.some((x) => x.cursed) && !has(I.cursed)) { say('notCursed'); break }
      if (s.spell !== undefined) for (const l of await spellOn(e, c, s.spell)) ui.print(l, false)
      say('templeCurseLifted')
      break
    case 'stone': // 0x22F0B
      if (c[F.status] !== 7) { say('notStoned'); break }
      c[F.status] = 0; c[F.inPlay] = 1; c[F.hp] = 1
      say('templeTurnedToFlesh')
      break
  }
  recalc(c, items, t)
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

/** Take (FUN_2e08_0d38, CotAB 0x1E60E): "Money Items Exit", or straight to the one there is; from the pile (money table and item list). */
async function takeFromPile(ui: TownUi, money: boolean, items: boolean) {
  const e = ui.engine, t = e.items
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
}

/**
 * The vault (SotSB 0x21C90; spec/A-games/sotsb/records.md §5): the caller has put VAULT.DAT's coins and items in
 * the pile (the treasure money table and item list). "View", " Take" while it holds money or items, " Pool
 * Exit" (0x21EC5): View is the character sheet whose Drop is Deposit (game mode 8, 0x4357E), money and items
 * going into the pile; Take and Pool as the treasure screen's. Exit leaves; the caller writes the pile back.
 */
export async function vault(ui: TownUi) {
  const e = ui.engine, t = e.items
  if (ui.vaultPanel && t) {
    for (;;) {
      if (await ui.vaultPanel() === 'deposit') { await ui.view('vault'); continue }
      ui.print('', true)
      return
    }
  }
  for (;;) {
    const money = e.money.some((v) => v > 0), items = e.treasure.length > 0
    const parts = [money ? moneyLine(e.money) : '', items && t ? e.treasure.map((it) => t.name(it)).join(', ') : ''].filter(Boolean)
    ui.print(parts.length ? `In the vault: ${parts.join('; ')}.` : 'The vault is empty.', true)
    const words = [...menu('vaultView'), ...(money || items ? menu('vaultTake') : []), ...menu('vaultPoolExit')]
    const o = await ask((l, op) => ui.menu(l, op), words)
    if (o === 'V') await ui.view('vault')
    else if (o === 'T') await takeFromPile(ui, money, items)
    else if (o === 'P') { if (t) await pooling(ui, 'pool') }
    else { ui.print('', true); return }
  }
}

/** Treasure screen (FUN_2e08_0ecd), after a fight or a scripted TREASURE without monsters. */
export async function treasure(ui: TownUi) {
  const e = ui.engine, t = e.items
  // SotSB's aftermath comes here only when the pile holds money or items (0x24D30; R.battleSummary)
  if (R.battleSummary.treasureScreen === 'whenPile' && !e.money.some((v) => v > 0) && !e.treasure.length) return
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
    else if (o === 'T') await takeFromPile(ui, money, items)
    else if (o === 'P' || o === 'S') { if (t) await pooling(ui, o === 'P' ? 'pool' : 'share') }
    else {
      if ((e.money.some((v) => v > 0) || e.treasure.length) && await leaveYes(ui, `${msg('treasureLeft').trim()} ${msg('treasureGoBack')}`, 'treasureLeaveYesNo')) continue
      e.treasure = []
      ui.print('', true)
      return
    }
  }
}
