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
    expect(labels).toEqual(['Arms and armour', 'Boats', 'City Hall', 'Gateway', 'General store', 'Harbour master', 'Inn', 'Jeweller',
      'Silversmith', 'Tavern', 'Temple of Sune', 'Temple of Tempus', 'Temple of Tyr', 'Training halls'])
    expect(marks.find((l) => l.x === 4 && l.y === 4)?.label).toBe('City Hall')
    // each shop has its own kind, so its own icon
    expect(new Set(marks.filter((l) => /store|Jeweller|armour|Silver/.test(l.label)).map((l) => l.kind))).toEqual(new Set(['store', 'jeweller', 'armoury', 'silver']))
    expect(marks.find((l) => l.x === 11 && l.y === 3)?.detail).toBe('THE PRIESTS OF TYR WELCOME YOU TO THE TEMPLE.')
  })

  it('finds none in the slums', () => {
    expect(area(2, 20, 20)).toEqual([])
  })
})

// CotAB's Tilverton (block 2, area 1), its script read at its own code base and operand counts
const coab = process.env.COAB ?? ''
describe.skipIf(!coab || !existsSync(coab))("landmarks in Curse of the Azure Bonds", () => {
  it("finds Tilverton's training hall, shops, temple and tavern", async () => {
    const { readdirSync: rd, statSync } = await import('node:fs')
    const { Engine } = await import('../src/vm/engine')
    const { COAB, POR, setGame, wants } = await import('../src/games/profile')
    setGame(COAB)
    try {
      const m = new Map<string, Uint8Array>()
      const walkDir = (d: string) => { for (const n of rd(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walkDir(p); else if (wants(COAB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
      walkDir(coab)
      const files = new GameFiles(m, COAB)
      const io = { print: () => {}, menu: async (i: unknown[]) => i.length - 1, inputNumber: async () => 0, inputText: async () => 'X', picture: () => {}, sprite: () => {}, refresh: async () => {}, pause: async () => {}, sound: () => {}, engine: async () => {} }
      const e = new Engine(files, io as never, 1)
      e.newGame([files.get('CHRDATA1.SAV')!])
      const vm = e as unknown as { setBlock(b: number): void; loadEcl(r: number): void; resetVm(k: boolean): void }
      vm.setBlock(2); e.area = 1; vm.loadEcl(1); vm.resetVm(false)
      await Promise.race([e.enter(), new Promise((r) => setTimeout(r, 2000))])
      const record = (n: number) => { const raw = files.record('ECL2', n); if (!raw) return null; const c = new Uint8Array(0x1e00); c.set(raw.subarray(2, 2 + 0x1e00)); return c }
      const marks = landmarks(e.code, e.geo!, record)
      expect(new Set(marks.map((l) => l.label))).toEqual(new Set(['Training hall', 'Shop', 'Temple', 'Arms and armour', 'Tavern']))
      expect(marks.find((l) => l.x === 12 && l.y === 7)?.detail).toBe('WE HAVE A SELECTION OF THE FINEST CORMYR STEEL.')
    } finally {
      setGame(POR)
    }
  })
})
