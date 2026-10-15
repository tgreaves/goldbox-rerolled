// Wall-set assembly against the player's game files (POOLRAD), using save A's wall sets.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { WallSets } from '../src/data/walls'
import { parseSave, saveBlock, saveGeo, saveWallSets } from '../src/data/save'
import { GeoMap } from '../src/data/geo'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

function load(): GameFiles {
  const m = new Map<string, Uint8Array>()
  for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  return new GameFiles(m)
}

describe.skipIf(!have)('wall sets', () => {
  it('builds every wall texture used by save A\'s map', () => {
    const files = load()
    const save = parseSave(files.get('SAVGAMA.DAT')!)
    const block = saveBlock(save)
    expect(block).toBe(2)
    const walls = new WallSets(files, block)
    saveWallSets(save).forEach((r, i) => r !== 0xffff && walls.load(i + 1, r))
    const geo = new GeoMap(files.record(`GEO${block}`, saveGeo(save))!)
    const used = new Set<number>()
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) for (let d = 0; d < 4; d++) {
      const t = geo.wall(x, y, d)
      if (t) used.add(t)
    }
    expect(used.size).toBeGreaterThan(3)
    for (const t of used) {
      const p = walls.piece(t, 6)
      expect(p.width).toBe(56)
      expect(p.height).toBe(64)
      const opaque = p.pixels.filter((v) => v >= 0).length
      expect(opaque, `wall type ${t}`).toBeGreaterThan(56 * 64 * 0.25)
    }
  })

  it('loads multi-set wall records into consecutive slots', () => {
    const files = load()
    const walls = new WallSets(files, 3)
    walls.load(1, 0) // WALLDEF3 record 0 holds three sets, tiles in 8X8D3 records 101-103
    for (let t = 1; t <= 15; t++) expect(walls.piece(t, 6).pixels.some((v) => v >= 0)).toBe(true)
  })
})
