// SotSB's vault (spec/A-games/sotsb/records.md §5): VAULT.DAT's coins and items, and COMBAT opening it when a
// script has set A 0x4CFC (0x1F5C2), ahead of the shop.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Item } from '../src/data/items'
import { parseVault, vaultFile } from '../src/data/vault'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { POR, SOTSB, setGame, wants } from '../src/games/profile'

describe('the vault file', () => {
  it('reads and writes the coins (seven u32) and the items, a bundle with its scrolls', () => {
    const rec = (type: number, count: number) => { const r = new Uint8Array(67); r[0x2e] = type; r[0x39] = count; return r }
    const coins = new Uint8Array(28)
    new DataView(coins.buffer).setUint32(4 * 4, 70000, true) // platinum, beyond 16 bits
    const file = new Uint8Array([...coins, ...rec(0x1e, 10), ...rec(0x49, 1), ...rec(0x27, 0)])
    const v = parseVault(file, 67, 0x49)
    expect(v.money).toEqual([0, 0, 0, 0, 70000, 0, 0])
    expect(v.items.map((x) => x.type)).toEqual([0x1e, 0x49])
    expect(v.items[1].bundle.length).toBe(1)
    expect([...vaultFile(v, 67, 0x49)]).toEqual([...file])
  })
  it('no file yet: an empty vault', () => {
    expect(parseVault(undefined, 67, 0x49)).toEqual({ money: [0, 0, 0, 0, 0, 0, 0], items: [] })
    expect(vaultFile({ money: [1, 0, 0, 0, 0, 0, 0], items: [new Item(new Uint8Array(63))] }, 67, 0x49).length).toBe(28 + 67)
  })
})

const dir = process.env.SOTSB ?? ''
describe.skipIf(!dir || !existsSync(dir))('the vault in the script VM', () => {
  afterAll(() => setGame(POR))
  it('COMBAT with A 0x4CFC = 1 clears it and opens the vault, not a battle or a shop', async () => {
    setGame(SOTSB)
    const m = new Map<string, Uint8Array>()
    const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(SOTSB, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
    walk(dir)
    const screens: string[] = []
    const io = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {},
      picture: () => {}, sprite: () => {}, engine: async (w: string) => { screens.push(w) }, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
    const e = new Engine(new GameFiles(m, SOTSB), io, 1)
    e.newGame([])
    e.write(0x4afc, 1)
    e.write(0x6e6c, 1) // the shop flag too: the vault comes first
    const at = 0x9920
    ;[0x24, 0x00].forEach((b, i) => e.write(at + i, b)) // COMBAT, EXIT
    await e.run(at)
    expect(screens).toEqual(['vault'])
    expect(e.read(0x4afc)).toBe(0)
  })
})
