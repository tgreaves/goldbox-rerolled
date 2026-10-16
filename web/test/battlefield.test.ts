// Map-area battlefield builder against tools/battlefield.py (spec/combat.md); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { readDax, daxRecords } from '../src/data/dax'
import { GeoMap } from '../src/data/geo'
import { mapBattlefield, COLS, ROWS } from '../src/rules/battlefield'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)
const TOOLS = join(__dirname, '..', '..', 'tools')

describe.skipIf(!have)('battlefield', () => {
  for (const [file, rec, x, y] of [['GEO3.DAX', 0, 15, 1], ['GEO2.DAX', 20, 9, 6]] as const) {
    it(`matches the Python reference for ${file} #${rec} at ${x},${y}`, () => {
      const out = execFileSync('python3', [join(TOOLS, 'battlefield.py'), join(dir, file), String(rec), String(x), String(y)], { encoding: 'utf8' })
      const rows = out.split('\n').filter((l) => /^\s*\d+ /.test(l)).map((l) => l.trim().split(/\s+/).slice(1).map((v) => (v === '..' ? 0x17 : parseInt(v, 16))))
      expect(rows).toHaveLength(ROWS)
      const geo = new GeoMap([...daxRecords(readDax(new Uint8Array(readFileSync(join(dir, file)))))].find(([id]) => id === rec)![1])
      const bf = mapBattlefield(geo, x, y, () => 1, 0)
      for (let r = 0; r < ROWS; r++) expect(Array.from(bf.cells.subarray(r * COLS, r * COLS + COLS)), `row ${r}`).toEqual(rows[r])
    })
  }
})
