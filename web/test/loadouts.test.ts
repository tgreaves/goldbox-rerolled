// Spell sets (IMP-098): applying a set memorises what is missing by the game's own rule, skipping what has
// no free slot; the sets survive a save's .GBR sidecar. Needs POOLRAD for the spell tables.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { POR, setGame, wants } from '../src/games/profile'
import { F } from '../src/games/fields'
import { memorised } from '../src/rules/camp'
import { parseSave } from '../src/data/save'
import { applySet, plannedSpells, readLoadouts, setText } from '../src/rules/loadouts'
import { parseSidecar, sidecar } from '../src/store/savefiles'

const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
  picture: () => {}, sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
const por = process.env.POOLRAD ?? ''

describe('spell sets: reading', () => {
  it('keeps well-formed sets and drops the rest', () => {
    const l = readLoadouts({ DARKSTAR: { last: [21, 21, 999, 'x'], sets: [{ name: 'Sleepers', spells: [21] }, { nope: 1 }, 'bad'] }, BROKEN: 7 })
    expect(l).toEqual({ DARKSTAR: { last: [21, 21], sets: [{ name: 'Sleepers', spells: [21] }] } })
    expect(readLoadouts(null)).toEqual({})
  })

  it('travel in the save sidecar and come back unchanged', () => {
    const loadouts = { DARKSTAR: { last: [21], sets: [{ name: 'Sleepers', spells: [21, 19] }] } }
    const f = sidecar({ slot: 'B', dat: new Uint8Array(), chars: [], label: '', savedAt: 0, known: ['journal:1'], sidecar: { rest: { loadouts } } })!
    const back = parseSidecar(f.data)
    expect(back.known).toEqual(['journal:1'])
    expect(readLoadouts(back.extra?.rest.loadouts)).toEqual(loadouts)
  })
})

describe.skipIf(!por || !existsSync(por))('spell sets: applying (PoR)', () => {
  const party = () => {
    setGame(POR)
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(por)) { const p = join(por, n); if (!statSync(p).isDirectory() && wants(POR, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) }
    const files = new GameFiles(m, POR)
    const e = new Engine(files, io, 1)
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    return e
  }

  it('memorises the missing spells into free slots and names what does not fit', async () => {
    const e = party()
    await e.start()
    const st = e.spells!
    // a first-level magic-user: one slot of level 1, knowing Detect Magic, Read Magic, Shield and Sleep
    const mu = e.party().find((c) => c[F.levels + 5] === 1 && c[F.levels] === 0 && c[F.levels + 2] === 0)!
    for (let k = 0; k < F.memorisedCount; k++) mu[F.memorised + k] = 0
    const r = applySet(mu, [21, 19], st)
    expect(r).toEqual({ added: 1, skipped: [st.get(19)!.name] })
    expect(memorised(mu).filter((v) => v)).toEqual([21 + 0x80]) // pending, learnt by resting
    expect(plannedSpells(mu)).toEqual([21])
    // already planned: nothing more
    expect(applySet(mu, [21], st)).toEqual({ added: 0, skipped: [] })
    expect(setText([21, 21, 19], st)).toBe(`${st.get(21)!.name} ×2, ${st.get(19)!.name}`)
  })
})
