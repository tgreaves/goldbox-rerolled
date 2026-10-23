// Secret of the Silver Blades toured headless (test/playtest.ts, `tour`): every area of every block entered
// by the debug jump with a sturdy party, which then walks to every square it can reach, fighting, shopping and
// camping on the way, while every picture, sprite and combat icon asked for and the drawn view at every step
// are checked against the files. Needs SOTSB; SOTSB_TOUR_STEPS (default 400) and SOTSB_TOUR_SEEDS (default 1)
// per area; SOTSB_TOUR_AREAS=2/64,3/80 tours only those.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { SOTSB, POR, setGame } from '../src/games/profile'
import { loadFiles, play } from './playtest'
import { GeoMap } from '../src/data/geo'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)
const steps = Number(process.env.SOTSB_TOUR_STEPS ?? 400)
const seeds = Number(process.env.SOTSB_TOUR_SEEDS ?? 1)
const only = process.env.SOTSB_TOUR_AREAS?.split(',')

describe.skipIf(!have)('Secret of the Silver Blades toured headless', () => {
  afterAll(() => setGame(POR))
  it(`tours every area for ${steps} steps without breaking the game`, async () => {
    setGame(SOTSB)
    const files = loadFiles(SOTSB, dir)
    const failures: string[] = []
    for (let block = 1; block <= 3; block++) {
      for (const { id: area } of files.dax(`ECL${block}`)?.entries ?? []) {
        if (only && !only.includes(`${block}/${area}`)) continue
        // the demo's record runs in demo mode only (demo.test.ts)
        const demo = SOTSB.startMenu?.demo
        if (demo && demo.block === block && demo.record === area) continue
        // the open square nearest the middle of the area's map (any square where there is none)
        const raw = files.record(`GEO${block}`, area)
        let x = 7, y = 7
        if (raw) {
          const g = new GeoMap(raw)
          let best = 99
          for (let q = 0; q < 256; q++) {
            const qx = q & 15, qy = q >> 4, dist = Math.abs(qx - 7.5) + Math.abs(qy - 7.5)
            if ([0, 1, 2, 3].some((d) => g.passage(qx, qy, d) !== 0) && dist < best) { best = dist; x = qx; y = qy }
          }
        }
        for (let seed = 1; seed <= seeds; seed++) {
          const r = await play({ game: SOTSB, files, seed: block * 1000 + area * 10 + seed, steps, tour: true, jumpTo: { block, area, x, y } })
          const st = r.stats
          const sq = [...(r.squares ?? new Map<string, Set<number>>())].map(([k, v]) => `${k}:${v.size}`).join(' ')
          console.log(`${block}/${area} seed ${seed}: ${r.steps} steps, squares ${sq}, ${st.battles} battles (${st.won} won, ${st.fled} fled, ${st.lost} lost), screens ${[...st.screens].map(([k, v]) => `${k}×${v}`).join(' ')}; ${st.ended}${r.stuck.length ? `; stuck ${r.stuck.length}: ${r.stuck[0]}` : ''}`)
          failures.push(...r.failures.map((f) => `${block}/${area}: ${f}`))
        }
      }
    }
    for (const f of failures) console.log(`FAIL ${f}`)
    expect(failures).toEqual([])
  }, 3600000)
})
