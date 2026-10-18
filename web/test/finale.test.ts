// Debug: the finale from ECL5 #7 (the inner tower of Valjevo Castle); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('finale', () => {
  for (const [label, addr] of [['ending', 0xa80e], ['fight', 0xa7dc]] as const) {
    it(`runs the ${label} and returns the party to New Phlan`, async () => {
      const m = new Map<string, Uint8Array>()
      for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
      const files = new GameFiles(m)
      const seen: string[] = []
      const text: string[] = []
      const io = { print: (t: string) => { if (t) text.push(t) }, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
        picture: () => {}, sprite: () => {}, engine: async (what: string) => { seen.push(what) }, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
      const dat = files.get('SAVGAMA.DAT')!
      const stems = parseSave(dat).party
      const e = new Engine(files, io, 1)
      e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
      stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
      await e.jump(5, 7, 1, 4, 1)
      const towerMap = e.geo
      await e.run(addr)
      if (!e.quit) await e.enter()
      if (label === 'fight') expect(seen).toContain('combat')
      expect(seen).toContain('ending')
      expect(text.some((t) => t.startsWith('KNOWING THAT TYRANTHRAXUS HAS FINALLY BEEN DEFEATED'))).toBe(true)
      expect([e.block, e.area]).toEqual([3, 0])
      expect(e.geo).not.toBeNull()
      expect(e.geo).not.toBe(towerMap) // New Phlan's map, loaded by its own on_enter
      expect([e.x, e.y]).toEqual([0, 4])
    })
  }
})
