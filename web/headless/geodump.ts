// An area's map as text: passages (# closed, D locked door, L door that cannot be picked) and event bytes.
// node --import ./headless/node-ts.mjs headless/geodump.ts <game folder> <block> <area>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GeoMap } from '../src/data/geo'
import { readDax, unrle } from '../src/data/dax'

const [dir, block, area] = process.argv.slice(2)
const dax = readDax(new Uint8Array(readFileSync(join(dir, `GEO${block}.DAX`))))
const en = dax.entries.find((x) => x.id === Number(area))
if (!en) throw new Error(`no GEO${block} #${area}`)
const raw = unrle(dax.bytes.subarray(dax.base + en.offset, dax.base + en.offset + en.comp), en.raw)
const g = new GeoMap(raw), ch = '# DL'
for (let y = 0; y < 16; y++) {
  console.log(Array.from({ length: 16 }, (_, x) => '+' + ch[g.passage(x, y, 0)].repeat(2)).join('') + '+')
  console.log(Array.from({ length: 16 }, (_, x) => ch[g.passage(x, y, 3)] + (g.event(x, y) ? g.event(x, y).toString(16).padStart(2, '0') : '  ')).join('') + ch[g.passage(15, y, 1)] + ` ${y}`)
}
console.log(Array.from({ length: 16 }, (_, x) => '+' + ch[g.passage(x, 15, 2)].repeat(2)).join('') + '+')
