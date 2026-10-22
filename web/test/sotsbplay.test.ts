// Secret of the Silver Blades played headless from the shipped save (test/playtest.ts): seeded random
// play through movement, scripts, battles, shops, temples, camp and training, with saves loaded back
// and the state checked after every step. Needs SOTSB. SOTSB_PLAY_SEEDS and SOTSB_PLAY_STEPS make the
// run longer (defaults 8 × 300); SOTSB_PLAY_TRACE=1 prints the whole game.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { SOTSB, POR, setGame } from '../src/games/profile'
import { loadFiles, play } from './playtest'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)
const seeds = Number(process.env.SOTSB_PLAY_SEEDS ?? 8)
const steps = Number(process.env.SOTSB_PLAY_STEPS ?? 300)
const first = Number(process.env.SOTSB_PLAY_FIRST ?? 1)

describe.skipIf(!have)('Secret of the Silver Blades played headless', () => {
  afterAll(() => setGame(POR))
  it(`plays ${seeds} seeds of ${steps} steps without breaking the game`, async () => {
    setGame(SOTSB)
    const files = loadFiles(SOTSB, dir)
    const failures: string[] = []
    for (let seed = first; seed < first + seeds; seed++) {
      const r = await play({ game: SOTSB, files, seed, steps, jump: seed % 2 === 0, fresh: seed % 4 === 3, trace: process.env.SOTSB_PLAY_TRACE === '1' })
      const st = r.stats
      console.log(`seed ${seed}${seed % 2 === 0 ? ' (jumped)' : seed % 4 === 3 ? ' (new game)' : ''}: ${r.steps} steps, ${st.areas.size} areas (${[...st.areas].join(' ')}), ${st.battles} battles (${st.won} won, ${st.fled} fled, ${st.lost} lost, ${st.rounds} rounds), ${st.saves} saves, ${st.menus} menus, screens ${[...st.screens].map(([k, v]) => `${k}×${v}`).join(' ')}; ${st.ended}${r.stuck.length ? `; stuck ${r.stuck.length}: ${r.stuck[0]}` : ''}`)
      failures.push(...r.failures)
    }
    expect(failures).toEqual([])
  }, 600000)
})
