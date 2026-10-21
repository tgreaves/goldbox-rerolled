// The test-vector generator (spec/D-appendices/test-vectors.md): runs every case of headless/vector-cases.ts
// through the reference implementation and checks it against, or writes, the committed manifest
// spec/D-appendices/test-vectors.json (hashes only where the output holds game data), and the generated
// sections of the spec that list the vectors and the tables. Plain Node 24, from web/:
//
//   node --import ./headless/node-ts.mjs headless/vectors-run.ts [--por <folder>] [--coab <folder>]
//        [--write] [--golden <folder>]
//
// (`npm run vectors -- …`). The folders default to $POOLRAD and $COAB; without one, that game's E and F
// vectors are kept from the manifest as they are (and not checked). --write regenerates the manifest and the
// spec sections; without it the run only compares and exits 1 on any difference. --golden writes the full
// outputs of the F vectors and every tape to a local folder, for comparing a clean-room build's outputs
// (they hold game data: keep them with the player's files, never in the repository).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CASES, TABLES, spanOf, type Case } from './vector-cases'
import { PROCEDURES, canonical, fromRuns, compute, entry, matches, sha256, startExeHash, type Folders, type Manifest, type Vector } from './vectors'
import { COAB_TABLES, POR_TABLES, type TableMap } from '../src/games/tables'
import { COAB_RULES, POR_RULES } from '../src/games/rules'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const MANIFEST = join(ROOT, 'spec', 'D-appendices', 'test-vectors.json')
const SPEC = {
  vectors: join(ROOT, 'spec', 'D-appendices', 'test-vectors.md'),
  addresses: join(ROOT, 'spec', 'D-appendices', 'addresses.md'),
  expected: join(ROOT, 'spec', 'D-appendices', 'expected-values.md'),
}
const RULES = { por: POR_RULES, coab: COAB_RULES }
const MAPS: Record<'por' | 'coab', TableMap> = { por: POR_TABLES, coab: COAB_TABLES }

/** Every case: the listed ones, each table's bytes, each DAX file of the folders given. */
export function allCases(folders: Folders, old: Manifest | null): Case[] {
  const out = [...CASES]
  for (const game of ['por', 'coab'] as const) {
    for (const t of TABLES[game]) {
      const s = spanOf(t, RULES[game])
      out.push({ id: `F-table-${game}-${t.table}`, game, procedure: 'tables.bytes', input: { table: t.table, from: s.from, length: s.length } })
    }
    const dir = folders[game]
    const files = dir ? readdirSync(dir).filter((n) => n.toUpperCase().endsWith('.DAX')).map((n) => n.toUpperCase()).sort()
      : (old?.vectors ?? []).filter((v) => v.game === game && v.procedure === 'decode.dax').map((v) => v.input.file as string)
    for (const f of files) out.push({ id: `F-dax-${game}-${f.replace(/\.DAX$/, '')}`, game, procedure: 'decode.dax', input: { file: f } })
  }
  return out
}

export function readManifest(): Manifest | null {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest : null
}

/** The manifest as written: one vector per line. */
export function formatManifest(m: Manifest): string {
  return `{\n "format": ${JSON.stringify(m.format)},\n "version": ${m.version},\n "releases": ${JSON.stringify(m.releases)},\n "vectors": [\n`
    + m.vectors.map((v) => '  ' + JSON.stringify(v)).join(',\n') + '\n ]\n}\n'
}

// ------------------------------------------------------------------ the spec sections

const hx = (n: number, w = 4) => n.toString(16).toUpperCase().padStart(w, '0')
const short = (v: unknown, max = 150) => { const s = JSON.stringify(v); return s.length <= max ? '`' + s.replace(/\|/g, '\\|') + '`' : `(${s.length} characters)` }

/** test-vectors.md: one table per procedure (the decoder and table vectors are in expected-values.md). */
function vectorSection(m: Manifest): string {
  const out: string[] = []
  const procs = [...new Set(m.vectors.map((v) => v.procedure))].filter((p) => p !== 'decode.dax' && p !== 'tables.bytes')
  for (const p of procs) {
    const d = PROCEDURES[p]
    const vs = m.vectors.filter((v) => v.procedure === p)
    out.push(`#### \`${p}\` (${d.kind})`, '', `Defined by [${d.spec.split('#')[0].split('/').pop()}](../${d.spec}).`, '',
      '| Vector | Input | Tape | Output |', '|---|---|---|---|')
    for (const v of vs) {
      const tape = v.tape ? `${fromRuns(v.tape).length} draws` : '–'
      const o = v.kind === 'F' ? `${v.bytes} bytes, SHA-256 \`${v.sha256}\`` : short(v.output)
      out.push(`| \`${v.id}\` | ${short(v.input, 200)} | ${tape} | ${o} |`)
    }
    out.push('')
  }
  return out.join('\n')
}

/** addresses.md: every table the table map names, both games. */
function tableSection(): string {
  const names = Object.keys(POR_TABLES).filter((k) => k !== 'ds')
  const out = ['| Table | PoR DS | PoR image | CotAB DS | CotAB image | Row | PoR entries | CotAB entries |', '|---|---|---|---|---|---|---|---|']
  for (const n of names) {
    const cell = (g: 'por' | 'coab') => {
      const r = (MAPS[g] as unknown as Record<string, { at: number; row: number }>)[n]
      return r.at < 0 ? ['absent', '–'] : [`DS:${hx(r.at)}`, `0x${hx(MAPS[g].ds + r.at, 5)}`]
    }
    const row = (g: 'por' | 'coab') => (MAPS[g] as unknown as Record<string, { at: number; row: number }>)[n].row
    const rows = [...new Set([row('por'), row('coab')].filter((_r, i) => (i ? cell('coab') : cell('por'))[0] !== 'absent'))]
    const ent = (g: 'por' | 'coab') => { const t = TABLES[g].find((x) => x.table === n); return t ? spanOf(t, RULES[g]).entries : '–' }
    out.push(`| \`${n}\` | ${cell('por').join(' | ')} | ${cell('coab').join(' | ')} | ${rows.map((r) => r || '–').join(' / ')} | ${ent('por')} | ${ent('coab')} |`)
  }
  return out.join('\n') + '\n'
}

/** expected-values.md: the decoder and table hashes. */
function hashSection(m: Manifest): string {
  const out: string[] = []
  const img = m.vectors.filter((v) => v.procedure === 'decode.image')
  out.push('| Game | Image | Bytes | SHA-256 |', '|---|---|---|---|')
  for (const v of img) out.push(`| ${v.game === 'por' ? 'PoR' : 'CotAB'} | ${v.input.merged ? 'merged (START.EXE unpacked, GAME.OVR\'s overlays placed)' : 'START.EXE unpacked'} | ${v.bytes} | \`${v.sha256}\` |`)
  out.push('', '#### Tables', '', 'The bytes of each table the table map names, from `at` + *from* for *bytes* bytes ([addresses.md, "Tables"](addresses.md#tables) gives the entries).', '',
    '| Game | Table | From | Bytes | SHA-256 |', '|---|---|---|---|---|')
  for (const v of m.vectors.filter((x) => x.procedure === 'tables.bytes')) out.push(`| ${v.game === 'por' ? 'PoR' : 'CotAB'} | \`${v.input.table}\` | ${v.input.from} | ${v.input.length} | \`${v.sha256}\` |`)
  out.push('', '#### DAX files', '', 'Per file: the decoded records in ascending id, one line each, `id size sha256` (decimal id and size, the SHA-256 of the decoded bytes in lower-case hex), each line ending in a line feed; the table gives the size and the SHA-256 of that listing.', '',
    '| Game | File | Listing bytes | SHA-256 of the listing |', '|---|---|---|---|')
  for (const v of m.vectors.filter((x) => x.procedure === 'decode.dax')) out.push(`| ${v.game === 'por' ? 'PoR' : 'CotAB'} | ${v.input.file} | ${v.bytes} | \`${v.sha256}\` |`)
  return out.join('\n') + '\n'
}

/** Replace the text between `<!-- generated:<name> -->` and `<!-- /generated:<name> -->`. */
export function splice(file: string, name: string, body: string): string {
  const s = readFileSync(file, 'utf8')
  const a = `<!-- generated:${name} -->`, b = `<!-- /generated:${name} -->`
  const i = s.indexOf(a), j = s.indexOf(b)
  if (i < 0 || j < i) throw new Error(`${file} has no ${a} … ${b}`)
  return s.slice(0, i + a.length) + '\n' + body + s.slice(j)
}

export const SECTIONS = (m: Manifest): [string, string, string][] => [
  [SPEC.vectors, 'vectors', vectorSection(m)],
  [SPEC.addresses, 'tables', tableSection()],
  [SPEC.expected, 'hashes', hashSection(m)],
]

// ------------------------------------------------------------------ main

function args(argv: string[]) {
  const o: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--write') o.write = true
    else if (a.startsWith('--') && i + 1 < argv.length) o[a.slice(2)] = argv[++i]
    else throw new Error('usage: vectors-run.ts [--por <folder>] [--coab <folder>] [--write] [--golden <folder>]')
  }
  return o
}

async function main() {
  const a = args(process.argv.slice(2))
  const dir = (v: string | true | undefined) => (typeof v === 'string' && v && existsSync(v) ? v : null)
  const folders: Folders = { por: dir(a.por ?? process.env.POOLRAD), coab: dir(a.coab ?? process.env.COAB) }
  const old = readManifest()
  const releases: Manifest['releases'] = { ...(old?.releases ?? {}) }
  for (const g of ['por', 'coab'] as const) {
    const d = folders[g]
    if (!d) continue
    const h = startExeHash((await import('../src/games/profile')).byId(g)!, d)
    if (!h) { folders[g] = null; continue }
    if (old?.releases[g] && old.releases[g].startExe !== h && !a.write) { console.error(`${g}: another release (START.EXE ${h}); its vectors are not compared`); folders[g] = null; continue }
    releases[g] = { startExe: h }
  }
  const golden = typeof a.golden === 'string' ? a.golden : null
  if (golden) mkdirSync(golden, { recursive: true })
  const vectors: Vector[] = []
  let bad = 0, checked = 0, kept = 0
  for (const c of allCases(folders, old)) {
    const p = PROCEDURES[c.procedure]
    const prev = old?.vectors.find((v) => v.id === c.id)
    if (p.kind !== 'S' && !folders[c.game]) {
      if (prev) { vectors.push(prev); kept++ }
      continue
    }
    let r: { output: unknown; tape: number[][] }
    try {
      r = await compute(c, folders, a.write || !prev?.tape ? undefined : prev.tape, c.seed ?? 1)
    } catch (err) { console.error(`${c.id}: ${(err as Error).message}`); bad++; continue }
    const v = entry(c.id, c.game, c.procedure, c.input, r as never)
    vectors.push(v)
    if (golden) {
      if (p.kind === 'F') { const b = canonical(r.output); writeFileSync(join(golden, `${c.id}.${r.output instanceof Uint8Array ? 'bin' : 'txt'}`), b) }
      if (v.tape) writeFileSync(join(golden, `${c.id}.tape.json`), JSON.stringify({ format: 'goldbox-dice-tape', version: 1, game: c.game, draws: fromRuns(v.tape) }) + '\n')
    }
    if (!a.write) {
      checked++
      if (!prev) { console.error(`${c.id}: not in the manifest`); bad++ }
      else if (!matches(prev, r.output)) { console.error(`${c.id}: differs from the manifest${prev.sha256 ? ` (${sha256(canonical(r.output))} ≠ ${prev.sha256})` : ''}`); bad++ }
    }
  }
  if (a.write) {
    const m: Manifest = { format: 'goldbox-test-vectors', version: 1, releases, vectors }
    writeFileSync(MANIFEST, formatManifest(m))
    for (const [file, name, body] of SECTIONS(m)) writeFileSync(file, splice(file, name, body))
    console.log(`wrote ${vectors.length} vectors (${kept} kept without their game's files) and the spec sections`)
  } else console.log(`${checked} vectors checked, ${kept} skipped without their game's files, ${bad} problems`)
  process.exit(bad ? 1 : 0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main()
