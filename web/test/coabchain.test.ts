// Curse of the Azure Bonds played in its story's order from the shipped save (TODO.md, Next steps 2):
// no Debug jump; the tour's walk (every square of an area, a sturdy party) and the scripts' own exits.
// Long: runs only with COAB_CHAIN=1 (COAB_CHAIN_STEPS, COAB_CHAIN_SEEDS); the route goes to
// out/ccoab/route-<seed>.txt.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { COAB, POR, setGame } from '../src/games/profile'
import { loadFiles, play } from './playtest'

const dir = process.env.COAB ?? ''
const on = process.env.COAB_CHAIN === '1' && dir !== '' && existsSync(dir)
const steps = Number(process.env.COAB_CHAIN_STEPS ?? 20000)
const seeds = Number(process.env.COAB_CHAIN_SEEDS ?? 1)

describe.skipIf(!on)('Curse of the Azure Bonds in its order', () => {
  afterAll(() => setGame(POR))
  it('plays from the shipped save without a jump', async () => {
    setGame(COAB)
    const files = loadFiles(COAB, dir)
    const failures: string[] = []
    mkdirSync('../out/ccoab', { recursive: true })
    const first = Number(process.env.COAB_CHAIN_SEED ?? 1)
    for (let seed = first; seed < first + seeds; seed++) {
      const r = await play({ game: COAB, files, seed, steps, tour: true, undying: true, trace: process.env.COAB_CHAIN_TRACE === '1' })
      writeFileSync(`../out/ccoab/route-${seed}.txt`, [`${r.steps} steps; ${r.stats.battles} battles (${r.stats.won} won, ${r.stats.fled} fled, ${r.stats.lost} lost); ${r.stats.ended}`, ...r.stuck.map((s) => `stuck: ${s}`), ...r.failures.map((f) => `FAIL ${f}`), ...r.route].join('\n') + '\n')
      failures.push(...r.failures)
    }
    expect(failures).toEqual([])
  }, 6 * 3600000)
})
