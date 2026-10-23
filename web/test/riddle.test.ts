// Engine.comparedAhead: the words the next instructions COMPARE with, read without running them, which the
// play-test harness answers an INPUT_STRING with. SotSB's second dungeon maze, 2/65: the stairs at (13,9)
// going west raise "THE IMAGE OF A RAVING MADMAN", ANSWER or FIGHT, then "YOU FEED IT, IT LIVES, YOU GIVE IT
// SOMETHING TO DRINK, IT DIES!"; a wrong word sends the party back to the Well of Knowledge. Needs SOTSB.
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { POR, SOTSB, setGame } from '../src/games/profile'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'
import { loadFiles } from './playtest'

const dir = process.env.SOTSB ?? ''

describe.skipIf(!dir || !existsSync(dir))('a riddle answered from the script', () => {
  afterAll(() => setGame(POR))
  it('SotSB 2/65: the stairs take FIRE, and the run goes on as it was', async () => {
    setGame(SOTSB)
    const files = loadFiles(SOTSB, dir)
    const dat = files.get('SAVGAMA.DAT')!
    const printed: string[] = [], asked: string[][] = []
    let e!: Engine
    const stub: Partial<Io> = {
      print: (t: string) => { printed.push(t) },
      menu: async (items: string[]) => Math.max(0, items.indexOf('ANSWER')),
      inputNumber: async () => 0,
      inputText: async () => { const w = e.comparedAhead(); asked.push(w); return w[0] ?? '' },
    }
    // every other host call does nothing (pictures, sounds, hand-overs)
    const io = new Proxy(stub, { get: (t, k) => (k in t ? t[k as keyof Io] : () => undefined) }) as Io
    e = new Engine(files, io, 1)
    e.loadSave(dat, parseSave(dat).party.map((st) => files.get(`${st}.SAV`)!.slice()))
    await e.start()
    await e.jump(2, 65, 13, 9, 3)
    await e.command('f')
    expect(asked).toEqual([['FIRE']])
    expect(printed.join(' ')).toContain('THE IMAGE DISPERSES')
    expect(printed.join(' ')).not.toContain('BACK AT THE WELL')
    expect([e.block, e.area]).toEqual([2, 65])
  })
})
