// A Buy in New Phlan's arms shop, a cure in its temple and a training in its hall from PoR save A, as the original did it in DOSBox (spec/VALIDATION.md §4,
// tools/dosbox/scriptcheck.py): the headless runner's shop on its answers, and the buyer's encumbrance
// counting the coins paid out (FUN_2f70_0361: the copy given and char[0x102] recomputed, 0x1FA44, before
// the price is taken). Needs POOLRAD.
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadFolder, runScript, type Event } from '../headless/harness'
import { POR, setGame, wants } from '../src/games/profile'
import { GameFiles } from '../src/store/gamefiles'

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

/** save A with BROTHER SEAN (member 4) first, 1600 experience, 200 platinum and `hp` HP, the slums' wandering monsters off */
function seanFirst(hp?: number): GameFiles {
  const m = new Map<string, Uint8Array>()
  for (const n of readdirSync(dir)) if (wants(POR, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  for (const ext of ['SAV', 'ITM', 'SPC']) {
    const a = m.get(`CHRDATA1.${ext}`), b = m.get(`CHRDATA4.${ext}`)
    if (b) m.set(`CHRDATA1.${ext}`, b); else m.delete(`CHRDATA1.${ext}`)
    if (a) m.set(`CHRDATA4.${ext}`, a); else m.delete(`CHRDATA4.${ext}`)
  }
  const sean = m.get('CHRDATA1.SAV')!.slice()
  new DataView(sean.buffer).setUint32(0xac, 1600, true)
  new DataView(sean.buffer).setUint16(0x90, 200, true)
  if (hp !== undefined) sean[0x11b] = hp
  m.set('CHRDATA1.SAV', sean)
  const dat = m.get('SAVGAMA.DAT')!.slice(); dat[0x301] = 15; m.set('SAVGAMA.DAT', dat)
  return new GameFiles(m, POR)
}

describe.skipIf(!have)('PoR: the temple as the original runs it', () => {
  it('Cure Light Wounds for 100 gp: the list comes back, the encumbrance is not recomputed', async () => {
    setGame(POR)
    const files = seanFirst(5)
    const enc = (s: Uint8Array) => s[0x102] | (s[0x103] << 8)
    const before = enc(files.get('CHRDATA1.SAV')!)
    const ev: Event[] = []
    const r = await runScript({
      files, seed: 1, out: (e) => ev.push(e), saveAs: 'B',
      script: { game: 'por', town: true, camp: true, commands: [...'fblfrffrfflflf', 'e'], answers: [0, 'HEAL', 'CURE LIGHT WOUNDS', 0, 'EXIT', 'EXIT', 'SAVE', 'NO'] },
    })
    const lists = ev.filter((e) => e.event === 'menu' && e.prompt === 'BROTHER SEAN, how can we help you?')
    expect(lists.length).toBe(2) // FUN_2d14_09d7: the list again after the cure, until its Exit
    const sav = r.saved!.find((f) => f.name === 'CHRDATB1.SAV')!.data
    expect(sav[0x90] | (sav[0x91] << 8)).toBe(180) // 1002 gp in coins less 100
    expect(enc(sav)).toBe(before)
  })
})

describe.skipIf(!have)('PoR: training as the original does it', () => {
  it('BROTHER SEAN to cleric level 2: the 1000 gp paid stays in the encumbrance; icon slots by party order', async () => {
    setGame(POR)
    const files = seanFirst()
    const sean = files.get('CHRDATA1.SAV')!
    const enc = sean[0x102] | (sean[0x103] << 8)
    const r = await runScript({
      files, seed: 1, out: () => {}, saveAs: 'B',
      script: { game: 'por', hall: true, camp: true, commands: [...'fblfrffrfflffflffrffflfflf', 'e'], answers: [0, 0, 'TRAIN CHARACTER', 0, 'BEGIN ADVENTURING', 'SAVE', 'NO'] },
    })
    const sav = (n: number) => r.saved!.find((f) => f.name === `CHRDATB${n}.SAV`)!.data
    expect(sav(1)[0x96]).toBe(2) // cleric level 2
    expect(sav(1)[0x102] | (sav(1)[0x103] << 8)).toBe(enc) // not recomputed (638 in DOSBox)
    expect([1, 2, 3, 4, 5, 6].map((n) => sav(n)[0xbf])).toEqual([0, 1, 2, 3, 4, 5])
  })
})
