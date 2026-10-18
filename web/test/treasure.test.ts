// The "Take all" suggestion after a battle (IMP-056); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { buildItem } from '../src/rules/randitem'
import { proposeSplit } from '../src/rules/treasure'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('treasure split', () => {
  it('gives each item to someone who can use it, never past the carrying limits', () => {
    const m = new Map<string, Uint8Array>()
    for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
    const files = new GameFiles(m)
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, {} as Io, 1)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
    const t = e.items!
    const party = e.party().map((c) => ({ c, items: e.itemsOf(c) }))
    const sword = buildItem(36, () => 1, e.startImage!) // long sword: fighters, not the cleric or magic-user only
    const plate = buildItem(58, () => 1, e.startImage!)
    const plan = proposeSplit(party, [sword, plate], t, () => 0)
    for (const [i, k] of plan) {
      expect(k).toBeGreaterThanOrEqual(0)
      const it = [sword, plate][i]
      expect((t.baseOf(it)!.classes & party[k].c[0xb0]) !== 0).toBe(true)
    }
    // a party member with no room gets nothing
    const full = party.map((p) => ({ c: p.c, items: Array.from({ length: 16 }, () => sword.copy()) }))
    expect([...proposeSplit(full, [plate], t, () => 0).values()]).toEqual([-1])
  })
})
