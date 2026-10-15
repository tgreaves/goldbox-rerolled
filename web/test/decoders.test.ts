// Checks the TypeScript decoders against the player's game files and the Python tools.
// Set POOLRAD to an extracted game folder; without it these tests are skipped.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readDax, daxRecords } from '../src/data/dax'
import { parseRecord } from '../src/data/image'
import { GeoMap } from '../src/data/geo'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)
const TOOLS = join(__dirname, '..', '..', 'tools')
const daxFiles = have ? readdirSync(dir).filter((n) => n.toUpperCase().endsWith('.DAX')).sort() : []

describe.skipIf(!have)('decoders', () => {
  it('decodes every DAX record to its stated size', () => {
    let records = 0
    for (const n of daxFiles) {
      const dax = readDax(new Uint8Array(readFileSync(join(dir, n))))
      for (const [id, d] of daxRecords(dax)) {
        expect(d.length, `${n} #${id}`).toBe(dax.entries.find((e) => e.id === id)!.raw)
        records++
      }
    }
    expect(records).toBe(1245)
  })

  it('decodes images exactly like tools/gfx.py', () => {
    // python: sha256 over every frame's pixel indices, per record
    const py = execFileSync('python3', ['-c', `
import sys, os, json, hashlib
sys.path.insert(0, ${JSON.stringify(TOOLS)})
import gfx
out = {}
for n in sorted(os.listdir(${JSON.stringify(dir)})):
    stem = n[:-4]
    fam = stem.rstrip('0123456789')
    if not n.upper().endswith('.DAX') or fam in ('ECL', 'GEO', 'WALLDEF', 'ITEM') or fam.startswith('MON'):
        continue
    for r, d in gfx.load(os.path.join(${JSON.stringify(dir)}, n)):
        try:
            kind, frames = gfx.parse_record(d, xor_frames=fam in ('PIC', 'FINAL'))
        except Exception:
            continue
        h = hashlib.sha256()
        for delay, img in frames:
            h.update(bytes(c for row in img.px for c in row))
        out['%s#%d' % (n, r)] = h.hexdigest()
print(json.dumps(out))
`], { maxBuffer: 1 << 26 }).toString()
    const expected: Record<string, string> = JSON.parse(py)
    let compared = 0
    for (const key of Object.keys(expected)) {
      const [n, id] = key.split('#')
      const dax = readDax(new Uint8Array(readFileSync(join(dir, n))))
      const d = daxRecords(dax).get(Number(id))!
      const fam = n.replace(/\d*\.DAX$/i, '').toUpperCase()
      const { frames } = parseRecord(d, fam === 'PIC' || fam === 'FINAL')
      const h = createHash('sha256')
      for (const f of frames) h.update(f.picture.pixels)
      expect(h.digest('hex'), key).toBe(expected[key])
      compared++
    }
    expect(compared).toBe(783)
  })

  it('reads every GEO map', () => {
    let maps = 0
    for (const n of daxFiles.filter((n) => n.toUpperCase().startsWith('GEO'))) {
      for (const [, d] of daxRecords(readDax(new Uint8Array(readFileSync(join(dir, n)))))) {
        const g = new GeoMap(d)
        expect(g.passage(0, 0, 0)).toBeGreaterThanOrEqual(0)
        maps++
      }
    }
    expect(maps).toBeGreaterThan(25)
  })
})
