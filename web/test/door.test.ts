// Locked doors: Bash, Pick and Knock (FUN_3e76_0d6d and friends, spec/architecture.md "Moving"); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { STEP } from '../src/data/geo'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('locked doors', () => {
  const m = new Map<string, Uint8Array>()
  if (have) for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  const files = new GameFiles(m)
  let offered: string[] = []
  let answer = 'BASH'
  const io = { print: () => {}, menu: async (items: string[]) => { offered = items; return Math.max(0, items.indexOf(answer)) },
    refresh: async () => {}, pause: async () => {}, sound: () => {}, picture: () => {}, sprite: () => {}, engine: async () => {},
    inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
  const game = async (seed: number) => {
    const dat = files.get('SAVGAMA.DAT')!
    const stems = parseSave(dat).party
    const e = new Engine(files, io, seed)
    e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
    stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
    await e.start()
    return e
  }
  type Door = { lockedDoor(kind: number): Promise<boolean>; doorTries: { bash: boolean; pick: boolean; knock: boolean } }

  it('bashes an ordinary locked door open on both sides', async () => {
    const e = await game(3)
    const g = e.geo!
    g.setPassage(e.x, e.y, e.facing, 2)
    for (const c of e.party()) { c[0x10] = 18; c[0x16] = 100 }
    answer = 'BASH'
    let ok = false
    for (let i = 0; i < 20 && !ok; i++) ok = await (e as unknown as Door).lockedDoor(2)
    expect(ok).toBe(true)
    expect(g.passage(e.x, e.y, e.facing)).toBe(1)
    const [dx, dy] = STEP[e.facing]
    if (e.x + dx >= 0 && e.x + dx <= 15 && e.y + dy >= 0 && e.y + dy <= 15) expect(g.passage(e.x + dx, e.y + dy, (e.facing + 2) % 4)).toBe(1)
  })

  it('takes Bash off the menu at a strong door when someone is too weak, and never offers Pick there twice', async () => {
    const e = await game(4)
    for (const c of e.party()) { c[0x10] = 12; c[0x16] = 0 }
    answer = 'BASH'
    expect(await (e as unknown as Door).lockedDoor(3)).toBe(false)
    expect((e as unknown as Door).doorTries.bash).toBe(false)
    const thief = e.party().some((c) => c[0x9c] > 0)
    answer = 'PICK'
    await (e as unknown as Door).lockedDoor(3)
    if (thief) {
      expect(offered).toContain('PICK')
      await (e as unknown as Door).lockedDoor(3)
      expect(offered).not.toContain('PICK')
    }
  })
})
