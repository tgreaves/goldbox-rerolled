// Curse of the Azure Bonds toured headless (test/playtest.ts, `tour`): every area of every block entered
// by the debug jump with a sturdy party, which then walks to every square it can reach, fighting, shopping and
// camping on the way, while every picture, sprite and combat icon asked for and the drawn view at every step
// are checked against the files. Needs COAB; COAB_TOUR_STEPS (default 400) and COAB_TOUR_SEEDS (default 1)
// per area; COAB_TOUR_AREAS=2/1,4/32 tours only those, COAB_TOUR_TRACE=1 prints the game.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COAB, POR, setGame } from '../src/games/profile'
import { loadFiles, play } from './playtest'
import { GeoMap } from '../src/data/geo'

const dir = process.env.COAB ?? ''
const have = dir !== '' && existsSync(dir)
const steps = Number(process.env.COAB_TOUR_STEPS ?? 400)
const seeds = Number(process.env.COAB_TOUR_SEEDS ?? 1)
const only = process.env.COAB_TOUR_AREAS?.split(',')

describe.skipIf(!have)('Curse of the Azure Bonds toured headless', () => {
  afterAll(() => setGame(POR))
  it(`tours every area for ${steps} steps without breaking the game`, async () => {
    setGame(COAB)
    const files = loadFiles(COAB, dir)
    const failures: string[] = []
    for (let block = 1; block <= 9; block++) {
      for (const { id: area } of files.dax(`ECL${block}`)?.entries ?? []) {
        if (only && !only.includes(`${block}/${area}`)) continue
        // the demo's record runs in demo mode only (demo.test.ts)
        const demo = COAB.startMenu?.demo
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
          const r = await play({ game: COAB, files, seed: block * 1000 + area * 10 + seed, steps, tour: true, jumpTo: { block, area, x, y }, trace: process.env.COAB_TOUR_TRACE === '1' })
          const st = r.stats
          const sq = [...(r.squares ?? new Map<string, Set<number>>())].map(([k, v]) => `${k}:${v.size}`).join(' ')
          console.log(`${block}/${area} seed ${seed}: ${r.steps} steps, squares ${sq}, ${st.battles} battles (${st.won} won, ${st.fled} fled, ${st.lost} lost), screens ${[...st.screens].map(([k, v]) => `${k}×${v}`).join(' ')}; ${st.ended}${r.stuck.length ? `; stuck ${r.stuck.length}: ${r.stuck[0]}` : ''}`)
          failures.push(...r.failures.map((f) => `${block}/${area}: ${f}`))
        }
      }
    }
    // combat icons the scripts ask for that the block's CPIC file lacks (the original reads CPIC by the
    // block digit DS:5C08 too, 0x56E91): ECL1 #80's forest patrols pick monsters from a table whose icons
    // are in other blocks' files, and a few fixed fights do the same; what the original shows is open (TODO.md)
    const MISSING = /no picture CPIC #((33|49|50|51|52|56|57|161|177|178|179|180|184|185) in block 1|(32|160) in block 3|(19|20|21|147|148|149) in block 4|(66|194) in block 6)\b/
    const missing = failures.filter((f) => MISSING.test(f)), rest = failures.filter((f) => !MISSING.test(f))
    if (missing.length) console.log(`pictures the block's files lack: ${[...new Set(missing.map((f) => f.match(MISSING)![0]))].join('; ')}`)
    for (const f of rest) console.log(`FAIL ${f}`)
    expect(rest).toEqual([])
  }, 3600000)
})
