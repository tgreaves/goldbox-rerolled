// Secret of the Silver Blades played in its order (test/playtest.ts, `tour` without a jump): the pre-made
// party from the shipped start, made sturdy and undying, explores area by area, walls included (`walls`:
// SotSB's scripts move the party through walls), its memory kept per sub-area (the ruins' zone, the mine's
// level and sub-level), and goes on wherever the scripts take it (stairs, teleports, NEW_ECL), so every
// area it reaches is reached as a player reaches it. Logs the
// order in which areas are first entered. Needs SOTSB; SOTSB_CHAIN_STEPS (default 3000), SOTSB_CHAIN_SEEDS
// (default 1), SOTSB_CHAIN_FRESH=1 starts as New Game does (else from save A).
import { afterAll, describe, expect, it } from 'vitest'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SOTSB, POR, setGame } from '../src/games/profile'
import { loadFiles, play, type Flag, type SaveFiles } from './playtest'
import { parseSave } from '../src/data/save'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(dir)
const steps = Number(process.env.SOTSB_CHAIN_STEPS ?? 3000)
const seeds = Number(process.env.SOTSB_CHAIN_SEEDS ?? 1)
const fresh = process.env.SOTSB_CHAIN_FRESH === '1'
// SOTSB_CHAIN_FROM=<dir>: go on from a save an earlier run left (SOTSB_CHAIN_SAVE=<dir> writes the last
// seed's last save there); SOTSB_CHAIN_GOAL=2/64,3/80 stops a run on reaching one of those areas;
// SOTSB_CHAIN_HINTS=<file.json> gives the tour squares to make for (PlayOptions.hints; by default
// sotsbchain-hints.json: the mine's level 10, each pocket's wall on the shortest way to the hole into 2/64,
// worked out from 2/51's tables 0x9B55-0x9C09 and the hole's walls, VALIDATION.md §4)
const goal = process.env.SOTSB_CHAIN_GOAL?.split(',')
// the menu answers a player who knows the story gives (PlayOptions.prefer), each read in the scripts: the
// Frost Giants' village (ECL3 #81) door's BASH (0x8276), the king's TALK (0x9281) and AGREE TO HELP (0x93E6),
// the guards' CASTLE (0x9A23)
const PREFER = ['BASH', 'TALK', 'AGREE TO HELP', 'CASTLE', 'ATTACK', 'SEARCH']
// the story's gates (PlayOptions.gates): the mines (block 2) only with the Amulet of Eldamar (A 0x4C53, the
// old red dragon's lair in the ruins' zone 9, ECL1 #32 0x918C) and the Well cleared (0x4C63, its ancient
// red dragon, ECL1 #33 0x8CF2); block 3 only with the dungeon mazes' brass, silver and gold keys (0x4CDE,
// 0x4CDF, 0x4CE0: ECL2 #64 0x94F3, #65 0x91C8, #66 0x9569), which need the amulet, and Oswulf's staff (0x4C86,
// which Derf in the Temple of Tyr makes from the eight pieces, ECL2 #52 0x8B0D; the castle's gate in 3/82 asks
// for it, "NONE MAY PASS WITHOUT MY STAFF!", 0x9507)
const GATES: { block: number; flags: Flag[] }[] = [
  { block: 2, flags: [[0x4c53, 255], [0x4c63, 255]] },
  { block: 3, flags: [[0x4cde, 255], [0x4cdf, 255], [0x4ce0, 255], [0x4c86, 1]] },
]
function readSave(d: string): SaveFiles {
  // a save the run wrote in the game's own files (saveAt: SAVGAMA.DAT and the party's stems)
  if (!existsSync(join(d, 'game.dat')) && existsSync(join(d, 'SAVGAMA.DAT'))) {
    const dat = new Uint8Array(readFileSync(join(d, 'SAVGAMA.DAT')))
    const L = SOTSB.saves
    const opt = (f: string) => (existsSync(join(d, f)) ? new Uint8Array(readFileSync(join(d, f))) : undefined)
    return { dat, chars: parseSave(dat).party.map((st) => ({ sav: opt(`${st}.SAV`)!, itm: opt(`${st}.${L.items}`), spc: opt(`${st}.${L.effects}`) })) }
  }
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
    // the run's lines to SOTSB_CHAIN_LOG, else the test's output (not /dev/stdout, which a pipe or socket cannot open)
    const log = (line: string) => { if (process.env.SOTSB_CHAIN_LOG) appendFileSync(process.env.SOTSB_CHAIN_LOG, line); else process.stdout.write(line) }
    const failures: string[] = []
    for (let seed = Number(process.env.SOTSB_CHAIN_SEED0 ?? 1); seed < Number(process.env.SOTSB_CHAIN_SEED0 ?? 1) + seeds; seed++) {
      const from = process.env.SOTSB_CHAIN_FROM ? readSave(process.env.SOTSB_CHAIN_FROM) : undefined
      const hints = JSON.parse(readFileSync(process.env.SOTSB_CHAIN_HINTS ?? join(import.meta.dirname, 'sotsbchain-hints.json'), 'utf8'))
      // SOTSB_CHAIN_SAVEAT=2/64,2/66 (dir SOTSB_CHAIN_SAVEAT_DIR): the game saved, in its own files, on first entering each
      const saveAt = process.env.SOTSB_CHAIN_SAVEAT ? { areas: process.env.SOTSB_CHAIN_SAVEAT.split(','), dir: process.env.SOTSB_CHAIN_SAVEAT_DIR ?? '/tmp' } : undefined
      const r = await play({ game: SOTSB, files, seed, steps, from, goal, hints, saveAt, tour: true, undying: true, walls: true, forward: process.env.SOTSB_CHAIN_FORWARD === '1', prefer: PREFER, gates: process.env.SOTSB_CHAIN_GATES === '0' ? undefined : GATES, fresh, watch: (process.env.SOTSB_CHAIN_WATCH ?? '0x4c4b,0x4c69,0x4c6b').split(',').map(Number), subAreas: [0x4c4b, 0x4c69, 0x4c6b], trace: !!process.env.PLAY_TRACE_FILE })
      const st = r.stats
      const sq = [...(r.squares ?? new Map<string, Set<number>>())].map(([k, v]) => `${k}:${v.size}`).join(' ')
      log(`seed ${seed}: ${r.steps} steps; areas in order ${[...st.areas].join(' ')}; squares ${sq}; ${st.battles} battles (${st.won} won, ${st.fled} fled, ${st.lost} lost); watched ${[...(r.watched ?? new Map<number, Set<number>>())].map(([a, v]) => `${a.toString(16)}: ${[...v].join(',')}`).join('; ')}; ${st.ended}${r.stuck.length ? `; stuck ${r.stuck.length}: ${r.stuck.slice(0, 3).join(' | ')}` : ''}\n`)
      failures.push(...r.failures.map((f) => `seed ${seed}: ${f}`))
      // the route's notable moments (losses with the last texts, reloads, saves), SOTSB_CHAIN_ROUTE=n lines
      if (process.env.SOTSB_CHAIN_ROUTE) for (const l of r.route.filter((l) => /lost|stuck|win|saved|gate|=/.test(l)).slice(0, Number(process.env.SOTSB_CHAIN_ROUTE))) log(`  route ${l}\n`)
      if (process.env.SOTSB_CHAIN_SQ) for (const [k, v] of r.squares ?? []) if (k.startsWith(process.env.SOTSB_CHAIN_SQ)) log(`  ${k}: ${[...v].sort((a, b) => a - b).map((q) => `${q & 15},${q >> 4}`).join(' ')}\n`)
      // a seed that reached a goal writes SOTSB_CHAIN_SAVE, the others SOTSB_CHAIN_SAVE.seed<n>
      const reached = !!goal?.some((g) => r.stats.areas.has(g))
      if (process.env.SOTSB_CHAIN_SAVE && r.lastSave) writeSave(process.env.SOTSB_CHAIN_SAVE + (reached ? '' : `.seed${seed}`), r.lastSave)
    }
    for (const f of failures) console.log(`FAIL ${f}`)
    expect(failures).toEqual([])
  }, Number(process.env.SOTSB_CHAIN_TIMEOUT ?? 3600000)) // SOTSB_CHAIN_TIMEOUT ms, for runs past an hour
})
