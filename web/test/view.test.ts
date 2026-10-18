// Pictures go when the original draws the view again (CALL 0x2C90, after a move, on turning, on
// entering an area); needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { parseSave } from '../src/data/save'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

function setup() {
  const m = new Map<string, Uint8Array>()
  for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  const files = new GameFiles(m)
  const log: string[] = []
  const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
    picture: (p: unknown) => log.push(p ? 'picture' : 'picture off'), sprite: () => log.push('sprite'), clearView: () => log.push('clear'),
    engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
  const dat = files.get('SAVGAMA.DAT')!
  const stems = parseSave(dat).party
  const e = new Engine(files, io, 1)
  e.loadSave(dat, stems.map((s) => files.get(`${s}.SAV`)!))
  stems.forEach((s, i) => e.attachFiles(i, files.get(`${s}.ITM`), files.get(`${s}.SPC`)))
  return { e, log }
}

describe.skipIf(!have)('the view drawn again', () => {
  it("clears the City Hall guard when the party leaves (CALL 0x2C90, ECL3 #8)", async () => {
    const { e, log } = setup()
    await e.jump(3, 8, 4, 4, 0) // the party has stepped into the hall
    log.length = 0
    await e.run(0xb444) // DO YOU LEAVE? → yes: back to (4, 5), CALL 0x2C90, EXIT
    expect(log).toContain('clear')
    // CALL 0x2C90 with nothing changed draws nothing: a picture stays
    log.length = 0
    await e.run(0xb456)
    expect(log).not.toContain('clear')
  })

  it('clears pictures on a move and a turn', async () => {
    const { e, log } = setup()
    await e.start()
    log.length = 0
    await e.command('l')
    expect(log[0]).toBe('clear')
    log.length = 0
    await e.command('f')
    expect(log).toContain('clear')
  })
})
