import { readFileSync } from 'node:fs'
import { GeoMap } from '../src/data/geo'
import { readDax, unrle } from '../src/data/dax'
const [file, id, x0, x1, y0, y1] = process.argv.slice(2)
const dax = readDax(new Uint8Array(readFileSync(file)))
const en = dax.entries.find((x) => x.id === Number(id))!
const g = new GeoMap(unrle(dax.bytes.subarray(dax.base + en.offset, dax.base + en.offset + en.comp), en.raw))
for (let y = Number(y0); y <= Number(y1); y++) for (let x = Number(x0); x <= Number(x1); x++) console.log(x, y, 'NESW', [0, 1, 2, 3].map((d) => g.passage(x, y, d)).join(','), 'ev', g.event(x, y).toString(16))
