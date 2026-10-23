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
      const r = await play({ game: COAB, files, seed, steps, tour: true, undying: true, saveAt: process.env.COAB_CHAIN_SAVE_AT ? { areas: process.env.COAB_CHAIN_SAVE_AT.split(','), dir: `../out/ccoab/saves-${seed}` } : undefined, trace: process.env.COAB_CHAIN_TRACE === '1' })
      writeFileSync(`../out/ccoab/${process.env.COAB_CHAIN_OUT ?? ''}route-${seed}.txt`, [`${r.steps} steps; ${r.stats.battles} battles (${r.stats.won} won, ${r.stats.fled} fled, ${r.stats.lost} lost); ${r.stats.ended}`, ...r.stuck.map((s) => `stuck: ${s}`), ...r.failures.map((f) => `FAIL ${f}`), ...r.route].join('\n') + '\n')
      // the game's own gap: ECL5 #51's dark elves are set up with the portrait selector 0x7EE1 = 49 and approach
      // after it is back at 0xFF, so their close-up is PIC5 #49, which the file lacks; the original loads the
      // picture at distance 0 with the selector of that moment (0x20022) and shows none either
      const known = /no picture PIC #49 in block 5\b/
      failures.push(...r.failures.filter((f) => !known.test(f)))
    }
    expect(failures).toEqual([])
  }, 6 * 3600000)
})
