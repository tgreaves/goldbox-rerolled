// A walk for the DOSBox comparisons (tools/dosbox/README.md, "Saves and long walks"), found with the
// headless runner: from a save and an optional opening, it adds moves (f, or a turn then f) one at a time,
// keeping only those after which nothing but the walk happens (no menu, text, picture, sprite or
// screen but a bump), preferring squares not yet visited and new areas. The original is then typed
// the moves alone.
//
//   node --import ./headless/node-ts.mjs headless/walk.ts --files <game folder> [--save X] [--moves N]
//        [--seed n] [--start <moves>]
//
// --moves: how many to add (default 48); --seed: the choice between equals (default 1); --start: an
// opening walked first, which may show anything. Prints the walk and the squares and areas it covers.
import { loadFolder, runScript, type Event } from './harness'
import { POR } from '../src/games/profile'

const argv = process.argv.slice(2)
const opt = (k: string, d: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
const files = loadFolder(POR, opt('--files', ''))
const save = opt('--save', 'A'), want = Number(opt('--moves', '48'))
let seed = Number(opt('--seed', '1'))
const choose = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff

const quiet = (e: Event) => ['area', 'command', 'write', 'end', 'sound', 'frame'].includes(e.event) ||
  (e.event === 'picture' && e.picture === null) || (e.event === 'text' && e.text === '') || (e.event === 'screen' && e.what === 'blocked')
/** the opening's events, which are not judged */
let skip = 0
async function run(moves: string) {
  const ev: Event[] = []
  const r = await runScript({ files, script: { game: 'por', save, answers: [], commands: [...moves] }, seed: 1, frame: true, out: (e) => ev.push(e) })
  const f = ev.find((e) => e.event === 'frame') as { block: number; area: number; x: number; y: number } | undefined
  return { ok: r.end === 'script' && ev.slice(skip).every(quiet), area: f ? `${f.block}:${f.area}` : '?', at: f ? `${f.block}:${f.area}:${f.x},${f.y}` : '?', ev }
}

let walk = opt('--start', '')
const first = await run(walk)
skip = first.ev.length - 2 // less the frame and the end
let at = first.at
const seen = new Map([[at, 1]])
const areas = new Set([first.area])
for (let added = 0; added < want; ) {
  const options: { m: string; at: string; area: string; score: number }[] = []
  for (const m of ['f', 'lf', 'rf', 'bf']) {
    const t = await run(walk + m)
    if (!t.ok || t.at === at) continue
    options.push({ m, at: t.at, area: t.area, score: (areas.has(t.area) ? 0 : 30) + 10 - 6 * (seen.get(t.at) ?? 0) - 2 * (m.length - 1) - (m === 'bf' ? 4 : 0) + 5 * choose() })
  }
  if (!options.length) break
  const best = options.sort((p, q) => q.score - p.score)[0]
  walk += best.m; added += best.m.length; at = best.at
  seen.set(at, (seen.get(at) ?? 0) + 1)
  areas.add(best.area)
}
console.log(JSON.stringify({ walk, moves: walk.length, end: at, squares: seen.size, areas: [...areas] }))
