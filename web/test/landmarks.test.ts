// Landmarks read from area scripts (IMP-024) against the player's game files (POOLRAD).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { GeoMap } from '../src/data/geo'
import { landmarks } from '../src/rules/landmarks'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('landmarks', () => {
  const m = new Map<string, Uint8Array>()
  if (have) for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  const files = new GameFiles(m)
  const code = (b: number, r: number) => {
    const raw = files.record(`ECL${b}`, r)
    if (!raw) return null
    const c = new Uint8Array(0x1e00)
    c.set(raw.subarray(2, 2 + 0x1e00))
    return c
  }
  const area = (b: number, r: number, g: number) => landmarks(code(b, r)!, new GeoMap(files.record(`GEO${b}`, g)!), (n) => code(b, n))

  it('finds the services of New Phlan', () => {
    const marks = area(3, 0, 0)
    const labels = [...new Set(marks.map((l) => l.label))].sort()
    expect(labels).toEqual(['Arms and armour', 'Boats', 'City Hall', 'Gateway', 'Harbour master', 'Inn', 'Jeweller', 'Shop',
      'Silversmith', 'Tavern', 'Temple of Sune', 'Temple of Tempus', 'Temple of Tyr', 'Training halls'])
    expect(marks.find((l) => l.x === 4 && l.y === 4)?.label).toBe('City Hall')
    expect(marks.find((l) => l.x === 11 && l.y === 3)?.detail).toBe('THE PRIESTS OF TYR WELCOME YOU TO THE TEMPLE.')
  })

  it('finds none in the slums', () => {
    expect(area(2, 20, 20)).toEqual([])
  })
})
