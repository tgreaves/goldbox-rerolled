// Secret of the Silver Blades played in its order (test/playtest.ts, `tour` without a jump): the pre-made
// party from the shipped start, made sturdy, explores area by area and goes on wherever the scripts take
// it (stairs, teleports, NEW_ECL), so every area it reaches is reached as a player reaches it. Logs the
// order in which areas are first entered. Needs SOTSB; SOTSB_CHAIN_STEPS (default 3000), SOTSB_CHAIN_SEEDS
// (default 1), SOTSB_CHAIN_FRESH=1 starts as New Game does (else from save A).
import { afterAll, describe, expect, it } from 'vitest'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SOTSB, POR, setGame } from '../src/games/profile'
import { loadFiles, play, type SaveFiles } from './playtest'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)
const steps = Number(process.env.SOTSB_CHAIN_STEPS ?? 3000)
const seeds = Number(process.env.SOTSB_CHAIN_SEEDS ?? 1)
const fresh = process.env.SOTSB_CHAIN_FRESH === '1'
// SOTSB_CHAIN_FROM=<dir>: go on from a save an earlier run left (SOTSB_CHAIN_SAVE=<dir> writes the last
// seed's last save there); SOTSB_CHAIN_GOAL=2/64,3/80 stops a run on reaching one of those areas;
// SOTSB_CHAIN_HINTS=<file.json> gives the tour squares to make for (PlayOptions.hints)
const goal = process.env.SOTSB_CHAIN_GOAL?.split(',')
function readSave(d: string): SaveFiles {
  const n = readdirSync(d).filter((f) => f.endsWith('.sav')).length
  const opt = (f: string) => (existsSync(join(d, f)) ? new Uint8Array(readFileSync(join(d, f))) : undefined)
  return { dat: new Uint8Array(readFileSync(join(d, 'game.dat'))), chars: Array.from({ length: n }, (_, i) => ({ sav: opt(`${i}.sav`)!, itm: opt(`${i}.itm`), spc: opt(`${i}.spc`) })) }
}
function writeSave(d: string, s: SaveFiles) {
  rmSync(d, { recursive: true, force: true })
  mkdirSync(d, { recursive: true })
  writeFileSync(join(d, 'game.dat'), s.dat)
  s.chars.forEach((c, i) => { writeFileSync(join(d, `${i}.sav`), c.sav); if (c.itm) writeFileSync(join(d, `${i}.itm`), c.itm); if (c.spc) writeFileSync(join(d, `${i}.spc`), c.spc) })
}

describe.skipIf(!have)('Secret of the Silver Blades played in its order', () => {
  afterAll(() => setGame(POR))
  it(`plays ${steps} steps from the start without breaking the game`, async () => {
    setGame(SOTSB)
    const files = loadFiles(SOTSB, dir)
    const failures: string[] = []
    for (let seed = Number(process.env.SOTSB_CHAIN_SEED0 ?? 1); seed < Number(process.env.SOTSB_CHAIN_SEED0 ?? 1) + seeds; seed++) {
      const from = process.env.SOTSB_CHAIN_FROM ? readSave(process.env.SOTSB_CHAIN_FROM) : undefined
      const hints = process.env.SOTSB_CHAIN_HINTS ? JSON.parse(readFileSync(process.env.SOTSB_CHAIN_HINTS, 'utf8')) : undefined
      const r = await play({ game: SOTSB, files, seed, steps, from, goal, hints, tour: true, hardy: true, fresh, watch: (process.env.SOTSB_CHAIN_WATCH ?? '0x4c4b,0x4c69,0x4c6b').split(',').map(Number), subAreas: [0x4c4b, 0x4c69, 0x4c6b], trace: !!process.env.PLAY_TRACE_FILE })
      const st = r.stats
      const sq = [...(r.squares ?? new Map<string, Set<number>>())].map(([k, v]) => `${k}:${v.size}`).join(' ')
      appendFileSync(process.env.SOTSB_CHAIN_LOG ?? '/dev/stdout', `seed ${seed}: ${r.steps} steps; areas in order ${[...st.areas].join(' ')}; squares ${sq}; ${st.battles} battles (${st.won} won, ${st.fled} fled, ${st.lost} lost); watched ${[...(r.watched ?? new Map<number, Set<number>>())].map(([a, v]) => `${a.toString(16)}: ${[...v].join(',')}`).join('; ')}; ${st.ended}${r.stuck.length ? `; stuck ${r.stuck.length}: ${r.stuck.slice(0, 3).join(' | ')}` : ''}\n`)
      failures.push(...r.failures.map((f) => `seed ${seed}: ${f}`))
      if (process.env.SOTSB_CHAIN_SQ) for (const [k, v] of r.squares ?? []) if (k.startsWith(process.env.SOTSB_CHAIN_SQ)) appendFileSync(process.env.SOTSB_CHAIN_LOG ?? '/dev/stdout', `  ${k}: ${[...v].sort((a, b) => a - b).map((q) => `${q & 15},${q >> 4}`).join(' ')}\n`)
      if (process.env.SOTSB_CHAIN_SAVE && r.lastSave) writeSave(process.env.SOTSB_CHAIN_SAVE, r.lastSave)
    }
    for (const f of failures) console.log(`FAIL ${f}`)
    expect(failures).toEqual([])
  }, 3600000)
})
