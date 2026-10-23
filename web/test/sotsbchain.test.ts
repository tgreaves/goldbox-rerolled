// Secret of the Silver Blades played in its order (test/playtest.ts, `tour` without a jump): the pre-made
// party from the shipped start, made sturdy, explores area by area and goes on wherever the scripts take
// it (stairs, teleports, NEW_ECL), so every area it reaches is reached as a player reaches it. Logs the
// order in which areas are first entered. Needs SOTSB; SOTSB_CHAIN_STEPS (default 3000), SOTSB_CHAIN_SEEDS
// (default 1), SOTSB_CHAIN_FRESH=1 starts as New Game does (else from save A).
import { afterAll, describe, expect, it } from 'vitest'
import { appendFileSync, existsSync } from 'node:fs'
import { SOTSB, POR, setGame } from '../src/games/profile'
import { loadFiles, play } from './playtest'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)
const steps = Number(process.env.SOTSB_CHAIN_STEPS ?? 3000)
const seeds = Number(process.env.SOTSB_CHAIN_SEEDS ?? 1)
const fresh = process.env.SOTSB_CHAIN_FRESH === '1'

describe.skipIf(!have)('Secret of the Silver Blades played in its order', () => {
  afterAll(() => setGame(POR))
  it(`plays ${steps} steps from the start without breaking the game`, async () => {
    setGame(SOTSB)
    const files = loadFiles(SOTSB, dir)
    const failures: string[] = []
    for (let seed = Number(process.env.SOTSB_CHAIN_SEED0 ?? 1); seed < Number(process.env.SOTSB_CHAIN_SEED0 ?? 1) + seeds; seed++) {
      const r = await play({ game: SOTSB, files, seed, steps, tour: true, hardy: true, fresh, watch: (process.env.SOTSB_CHAIN_WATCH ?? '0x4c4b').split(',').map(Number), subAreas: [0x4c4b], trace: !!process.env.PLAY_TRACE_FILE })
      const st = r.stats
      const sq = [...(r.squares ?? new Map<string, Set<number>>())].map(([k, v]) => `${k}:${v.size}`).join(' ')
      appendFileSync(process.env.SOTSB_CHAIN_LOG ?? '/dev/stdout', `seed ${seed}: ${r.steps} steps; areas in order ${[...st.areas].join(' ')}; squares ${sq}; ${st.battles} battles (${st.won} won, ${st.fled} fled, ${st.lost} lost); watched ${[...(r.watched ?? new Map<number, Set<number>>())].map(([a, v]) => `${a.toString(16)}: ${[...v].join(',')}`).join('; ')}; ${st.ended}${r.stuck.length ? `; stuck ${r.stuck.length}: ${r.stuck.slice(0, 3).join(' | ')}` : ''}\n`)
      failures.push(...r.failures.map((f) => `seed ${seed}: ${f}`))
    }
    for (const f of failures) console.log(`FAIL ${f}`)
    expect(failures).toEqual([])
  }, 3600000)
})
