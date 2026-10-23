// The headless runner's command line (spec/B-model/host-contracts.md §8): plain Node 24 with its own
// TypeScript type stripping, no build step:
//
//   node --import ./headless/node-ts.mjs headless/run.ts --files <game folder> --script <script.json>
//        [--tape <tape.json> | --seed <n>] [--record <tape.json>] [--out <transcript.jsonl>]
//        [--frame <view.png> [--scale <n>]] [--save <dir> [--slot <x>]]
//
// (from web/, or `npm run headless -- …`). The game files are read from the player's folder and
// nothing of them is written anywhere but the transcript and the tape the run is asked for (and, with
// --frame, the drawn view at the end of the run as a PNG: V9, spec/C-port/exploration-view.md §2.3; with
// --save, the game saved at the end in slot --slot, default B, as the original's files, to compare
// with what the original writes: spec/VALIDATION.md §4).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { byId } from '../src/games/profile'
import { loadFolder, runScript, type Event, type Script } from './harness'
import { framePng } from './frame'
import type { Tape } from '../src/rules/dice'

const USAGE = 'usage: run.ts --files <game folder> --script <script.json> [--tape <tape.json> | --seed <n>] [--record <tape.json>] [--out <transcript.jsonl>] [--frame <view.png> [--scale <n>]] [--save <dir> [--slot <x>]]'

function args(argv: string[]): Record<string, string> {
  const o: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--') || i + 1 >= argv.length) throw new Error(USAGE)
    o[a.slice(2)] = argv[++i]
  }
  return o
}

async function main() {
  let a: Record<string, string>
  try { a = args(process.argv.slice(2)) } catch (err) { console.error((err as Error).message); process.exit(2) }
  if (!a.files || !a.script) { console.error(USAGE); process.exit(2) }
  const script = JSON.parse(readFileSync(a.script, 'utf8')) as Script
  const g = byId(script.game)
  if (!g) { console.error(`the script's game "${script.game}" is not one the port knows`); process.exit(2) }
  const tape = a.tape ? JSON.parse(readFileSync(a.tape, 'utf8')) as Tape : undefined
  if (tape && tape.game !== g.id) { console.error(`the tape is for ${tape.game}, the script for ${g.id}`); process.exit(2) }
  const lines: string[] = []
  const out = (e: Event) => {
    const line = JSON.stringify(e)
    if (a.out) lines.push(line)
    else process.stdout.write(line + '\n')
  }
  const r = await runScript({ files: loadFolder(g, a.files), script, tape, seed: a.seed ? Number(a.seed) : undefined, out, frame: !!a.frame, saveAs: a.save ? (a.slot ?? 'B') : undefined })
  if (a.out) writeFileSync(a.out, lines.join('\n') + '\n')
  if (a.frame) {
    if (r.frame) writeFileSync(a.frame, framePng(r.frame, Math.max(1, Number(a.scale ?? 1) | 0)))
    else console.error('no 3D view at the end of the run (no map, or a tile wilderness): no frame written')
  }
  if (a.save && r.saved) {
    mkdirSync(a.save, { recursive: true })
    for (const f of r.saved) writeFileSync(join(a.save, f.name), f.data)
  }
  if (a.record) writeFileSync(a.record, JSON.stringify(r.tape) + '\n')
  process.exit(r.end === 'error' || r.end === 'divergence' ? 1 : 0)
}

void main()
