// A Buy in New Phlan's arms shop from PoR save A, as the original did it in DOSBox (spec/VALIDATION.md §4,
// tools/dosbox/scriptcheck.py): the headless runner's shop on its answers, and the buyer's encumbrance
// counting the coins paid out (FUN_2f70_0361: the copy given and char[0x102] recomputed, 0x1FA44, before
// the price is taken). Needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { loadFolder, runScript, type Event } from '../headless/harness'
import { POR, setGame } from '../src/games/profile'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)
const walk = 'fblfrffrfflfffrffffffflfffff' // save A to the arms shop's door (block 3 area 0)

describe.skipIf(!have)('PoR: a Buy as the original makes it', () => {
  it('Hand Axe for 1 gp: the coins left are 1 gp and 2 pp, the encumbrance 538 + 50', async () => {
    setGame(POR)
    const ev: Event[] = []
    const r = await runScript({
      files: loadFolder(POR, dir), seed: 1, out: (e) => ev.push(e), saveAs: 'B',
      script: { game: 'por', town: true, camp: true, commands: [...walk, 'e'], answers: [0, 0, 'BUY', 1, 'EXIT', 'EXIT', 'SAVE', 'NO'] },
    })
    expect(ev.some((e) => e.event === 'menu' && (e.items as string[])[0] === 'BUY' && (e.keys as string[])?.[0] === 'B')).toBe(true)
    expect(ev.some((e) => e.event === 'menu' && e.vertical === true && /buys:$/.test(e.prompt as string))).toBe(true)
    const sav = r.saved!.find((f) => f.name === 'CHRDATB1.SAV')!.data
    const word = (o: number) => sav[o] | (sav[o + 1] << 8)
    expect([0, 1, 2, 3, 4].map((i) => word(0x88 + 2 * i))).toEqual([0, 0, 0, 1, 2]) // 12 gp in coins less 1
    expect(word(0x102)).toBe(588) // 500 in items + the axe's 50 + the 38 coins held before paying
  })
})
