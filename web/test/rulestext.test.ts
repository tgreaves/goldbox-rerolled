// The Rules reference's numbers against each game's profile and tables (games/rulestext.ts): the level
// limits from the experience table, the paladin's and ranger's minimums, extra attacks, starting money,
// the difficulty names and the bundle limit. Needs COAB / SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, SOTSB, setGame, wants, type GameProfile } from '../src/games/profile'
import { T } from '../src/games/tables'
import { R } from '../src/games/rules'
import { Tables } from '../src/rules/chargen'
import { maxLevel } from '../src/rules/training'
import { RACES, installNames } from '../src/data/character'
import type { RulesText } from '../src/games/rulestext'

function tables(game: GameProfile, dir: string) {
  setGame(game)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(game, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  const e = new Engine(new GameFiles(m, game), {} as Io, 1)
  installNames(e.startImage!)
  return { t: new Tables(e.startImage!), img: e.startImage! }
}

const entry = (text: RulesText, key: string) => [...text.basics, ...text.classes].find((x) => x[0] === key)?.[1] ?? ''
/** "Cleric 15, fighter 15, …" → { cleric: 15, … } */
const limits = (s: string) => Object.fromEntries([...s.matchAll(/([A-Za-z-]+) (\d+)/g)].map((m) => [m[1].toLowerCase(), Number(m[2])]))
/** the class's ability minimums in the text: "STR 12, INT 9, …" */
const mins = (s: string) => Object.fromEntries([...s.matchAll(/(STR|INT|WIS|DEX|CON|CHA) (\d+)/g)].map((m) => [m[1], Number(m[2])]))
const STATS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA']
const CLASS_KEYS: [string, number][] = [['cleric', 0], ['fighter', 2], ['paladin', 3], ['ranger', 4], ['magic-user', 5], ['thief', 6]]

function checkClasses(game: GameProfile, dir: string) {
  const { t } = tables(game, dir)
  const text = game.rulesText
  const caps = limits(entry(text, 'Level limits'))
  for (const [name, k] of CLASS_KEYS) expect([name, caps[name]]).toEqual([name, maxLevel(t, k)])
  for (const [name, k] of [['Paladin', 3], ['Ranger', 4]] as const) {
    const want = Object.fromEntries(STATS.map((s, a) => [s, t.b(T.classMins.at + k * T.classMins.row + a)]).filter(([, v]) => v))
    expect([name, mins(entry(text, name))]).toEqual([name, want])
  }
  expect(entry(text, 'Paladin')).toContain(`(${R.paladin!.layOnHands.perLevel} hit points a level)`)
  expect(entry(text, 'Ranger')).toContain(`${['No', 'One', 'Two', 'Three', 'Four'][R.join.maxRangers!]} rangers at most`)
}

describe('the Rules reference against the profile and tables', () => {
  afterAll(() => setGame(POR))
  it.skipIf(!process.env.COAB || !existsSync(process.env.COAB))('Curse of the Azure Bonds', () => checkClasses(COAB, process.env.COAB!))
  it.skipIf(!process.env.SOTSB || !existsSync(process.env.SOTSB))('Secret of the Silver Blades', () => {
    checkClasses(SOTSB, process.env.SOTSB!)
    const { img } = tables(SOTSB, process.env.SOTSB!)
    const text = SOTSB.rulesText
    // extra attacks: above 6 and 12 (fighter, paladin), above 7 and 14 (ranger)
    const [f, p, r] = [R.extraAttacks[2], R.extraAttacks[3], R.extraAttacks[4]]
    expect(entry(text, 'Fighter')).toContain(`from level ${f[0] + 1} and 2 a round from level ${f[1] + 1}`)
    expect(entry(text, 'Paladin')).toContain(`from level ${p[0] + 1}, 2 from ${p[1] + 1}`)
    expect(entry(text, 'Ranger')).toContain(`from level ${r[0] + 1}, 2 from ${r[1] + 1}`)
    const [n, sides] = R.startMoney.byClass![6]
    expect(entry(text, 'Money')).toContain(`${n}d${sides} gold`)
    expect(R.turnUndead).toBe(false)
    expect(entry(text, 'Cleric')).toContain('do not turn undead')
    // the free temple and who cannot be raised
    expect(R.templeHeal.mode).toBe('free')
    const raise = R.templeHeal.mode === 'free' ? R.templeHeal.raise.notRaces : []
    expect(RACES[raise[0]]).toBe('Elf')
    expect(entry(text, 'The temple')).toContain('Elves cannot be raised')
    // the difficulty names: the Level menu (0xE272)
    const at = 0xe272, names = String.fromCharCode(...img.subarray(at + 1, at + 1 + img[at])).split(' ')
    expect(names.length).toBe(5)
    for (const w of names) expect(entry(text, 'Difficulty')).toContain(w)
    expect(entry(text, 'Scroll bundles')).toContain(`up to ${R.itemJoin.bundle!.limit}`)
    // the spell-level ability limits (R.slots.limits): WIS 17 sixth cleric, INT 12 / 14 magic-user
    const lim = R.slots.limits
    const need = (pool: string, level: number) => lim.find((x) => x.pool === pool && x.level === level)!.atLeast
    expect(entry(text, 'Resting and spells')).toContain(`WIS ${need('cleric', 6)} for sixth-level slots`)
    expect(entry(text, 'Resting and spells')).toContain(`INT ${need('mu', 6)} for sixth, ${need('mu', 7)} for seventh`)
  })
})
