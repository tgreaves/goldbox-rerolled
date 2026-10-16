// Random treasure items against tools/randitem.py with the same dice (spec/records.md); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { unexepack } from '../src/data/exepack'
import { randomTreasure } from '../src/rules/randitem'
import type { Item } from '../src/data/items'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)
const TOOLS = join(__dirname, '..', '..', 'tools')

describe.skipIf(!have)('random items', () => {
  it('builds the same records as the Python reference', () => {
    const exe = new Uint8Array(readFileSync(join(dir, 'START.EXE')))
    const image = unexepack(exe).image
    let seed = 12345
    const results: number[] = []
    const d = (sides: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const v = (seed % sides) + 1; results.push(v); return v }
    const list: Item[] = []
    randomTreasure(300, d, image, list)
    const tmp = mkdtempSync(join(tmpdir(), 'randitem-'))
    const su = join(tmp, 'su.exe')
    // the Python tool reads an unpacked START.EXE: a minimal MZ header (32 bytes, 2 paragraphs) + the image
    const hdr = new Uint8Array(32); hdr[0] = 0x4d; hdr[1] = 0x5a; hdr[8] = 2
    writeFileSync(su, Buffer.concat([Buffer.from(hdr), Buffer.from(image)]))
    const py = execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(TOOLS)})
import randitem as R
tab = R.Tables(${JSON.stringify(su)}, ${JSON.stringify(join(dir, 'ITEMS'))})
items, _ = R.treasure(tab, 300, R.Dice(results=json.loads(sys.stdin.read())), names=False)
print(json.dumps([list(bytes(it))[0x2e:0x3f] for it in items]))
`], { input: JSON.stringify(results), encoding: 'utf8' })
    const want = JSON.parse(py) as number[][]
    const got = list.map((it) => Array.from(it.raw.subarray(0x2e, 0x3f)))
    const bad = got.findIndex((g, i) => JSON.stringify(g) !== JSON.stringify(want[i]))
    expect(bad === -1 ? "" : `item ${bad}: got ${got[bad]} want ${want[bad]}`).toBe("")
  })
})
