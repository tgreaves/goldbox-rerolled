// The test vectors (spec/D-appendices/test-vectors.md): every vector of the committed manifest
// spec/D-appendices/test-vectors.json replayed against the reference implementation, tape and output.
// S vectors need nothing; E and F vectors need the game's files (POOLRAD, COAB) of the release the
// manifest names, and skip otherwise. Also checks that the spec's generated sections are the manifest's.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { compute, matches, startExeHash, type Folders, type Vector } from '../headless/vectors'
import { CASES } from '../headless/vector-cases'
import { MANIFEST, SECTIONS, readManifest, splice } from '../headless/vectors-run'
import { COAB, POR } from '../src/games/profile'

const m = readManifest()!
const dir = (v: string | undefined) => (v && existsSync(v) ? v : null)
const folders: Folders = { por: dir(process.env.POOLRAD), coab: dir(process.env.COAB) }
// a folder of another release does not apply
for (const g of [POR, COAB]) {
  const d = folders[g.id as keyof Folders]
  if (d && startExeHash(g, d) !== m.releases[g.id]?.startExe) folders[g.id as keyof Folders] = null
}

async function check(vs: Vector[]) {
  const bad: string[] = []
  for (const v of vs) {
    try {
      const r = await compute(v, folders, v.tape)
      if (!matches(v, r.output)) bad.push(`${v.id}: output differs`)
    } catch (err) { bad.push(`${v.id}: ${(err as Error).message}`) }
  }
  expect(bad).toEqual([])
}

describe('test vectors', () => {
  it('the manifest is version 1 and names the releases', () => {
    expect(m).toMatchObject({ format: 'goldbox-test-vectors', version: 1 })
    expect(Object.keys(m.releases).sort()).toEqual(['coab', 'por'])
    expect(new Set(m.vectors.map((v) => v.id)).size).toBe(m.vectors.length)
    expect(readFileSync(MANIFEST, 'utf8')).not.toMatch(/"text":/) // transcripts are hashed, never stored
  })

  it('every listed case is in the manifest with its input', () => {
    for (const c of CASES) expect(m.vectors.find((v) => v.id === c.id)?.input, c.id).toEqual(c.input)
  })

  it('replays every S vector (no game files)', async () => {
    const s = m.vectors.filter((v) => v.kind === 'S')
    expect(s.length).toBeGreaterThan(60)
    await check(s)
  })

  it.skipIf(!folders.por)('replays every PoR E and F vector', async () => { await check(m.vectors.filter((v) => v.kind !== 'S' && v.game === 'por')) }, 120000)
  it.skipIf(!folders.coab)('replays every CotAB E and F vector', async () => { await check(m.vectors.filter((v) => v.kind !== 'S' && v.game === 'coab')) }, 120000)

  it('the spec\'s generated sections are the manifest\'s', () => {
    for (const [file, name, body] of SECTIONS(m)) expect(readFileSync(file, 'utf8'), `${file} ${name}`).toBe(splice(file, name, body))
  })
})
