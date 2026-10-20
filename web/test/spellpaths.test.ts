// Lightning Bolt path and bounce, Stinking Cloud squares, the line walker (spec/combat.md, spec/spells.md).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles, wanted } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, Line, type CombatUi, type Fighter } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, type CellInfo } from '../src/rules/battlefield'
import { removeEffect, removeType } from '../src/rules/effects'

describe('line walker', () => {
  it('steps Bresenham with 2 per straight and 3 per diagonal step', () => {
    const l = new Line(0, 0, 4, 2)
    const cells: [number, number, number][] = []
    while (l.step()) cells.push([l.x, l.y, l.cost])
    expect(cells).toEqual([[1, 1, 3], [2, 1, 5], [3, 2, 8], [4, 2, 10]]) // diagonal first when the error term is 0
  })
})

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe.skipIf(!have)('spell paths', () => {
  const m = new Map<string, Uint8Array>()
  if (have) for (const n of readdirSync(dir)) if (wanted(n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(join(dir, n))))
  const files = new GameFiles(m)
  const io = { print: () => {}, menu: async () => 0 } as unknown as Io
  const OPEN = 1, WALL = 2
  const cells: CellInfo[] = Array.from({ length: 0x42 }, (_, i) => ({ move: i === WALL ? 0xff : 1, sight: i === WALL ? 2 : 0, image: 0 }))
  const setup = () => {
    const e = new Engine(files, io, 7)
    const printed: string[] = []
    const ui = { print: (t: string) => printed.push(t), redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi
    const bf = new Battlefield(false)
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, OPEN)
    const b = new Battle(e, ui, bf, cells)
    const add = (x: number, y: number, side: number, name: string) => {
      const c = new Uint8Array(0x11d)
      c[0] = name.length; for (let i = 0; i < name.length; i++) c[1 + i] = name.charCodeAt(i)
      c[0x10d] = 1; c[0x10e] = side; c[0x11b] = c[0x32] = 200
      for (let i = 0; i < 5; i++) c[0x6d + i] = 30 // never saves
      const f: Fighter = { c, r: new Uint8Array(22), x, y, size: 1, index: b.fighters.length, monster: side === 1, target: null }
      b.fighters.push(f)
      return f
    }
    const hits: string[] = []
    b.damageSync = (c: Uint8Array) => { hits.push(String.fromCharCode(...c.subarray(1, 1 + c[0]))) }
    return { e, b, bf, add, hits, printed }
  }

  it('bounces a Lightning Bolt straight back off a wall and hits the target twice', async () => {
    const { e, b, bf, add, hits } = setup()
    const caster = add(2, 5, 0, 'MAGE')
    add(5, 5, 1, 'ORC')
    bf.set(5, 9, WALL)
    b.aimed = { x: 5, y: 5 }
    await b.applySpell(caster, e.spells!.get(51)!, 5, [])
    expect(hits).toEqual(['ORC', 'ORC'])
  })

  it('stops a bolt at each new creature and shortens it by the cumulative cost', async () => {
    const { e, b, add, hits } = setup()
    const caster = add(2, 5, 0, 'MAGE')
    add(5, 5, 1, 'A')
    add(8, 5, 1, 'B')
    add(11, 5, 1, 'C') // 6 past B, cost 12 ≥ the 10 left after B
    b.aimed = { x: 5, y: 5 }
    await b.applySpell(caster, e.spells!.get(51)!, 5, [])
    expect(hits).toEqual(['A', 'B'])
  })

  it('covers 4 squares with a Stinking Cloud and lifts it when the caster’s effect ends', async () => {
    const { e, b, bf, add, printed } = setup()
    const caster = add(2, 5, 0, 'MAGE')
    const orc = add(6, 6, 1, 'ORC')
    bf.set(5, 5, WALL)
    b.aimed = { x: 5, y: 5 }
    await b.applySpell(caster, e.spells!.get(34)!, 4, [])
    expect([bf.get(5, 5), bf.get(5, 6), bf.get(6, 6), bf.get(6, 5)]).toEqual([WALL, 0x1e, 0x1e, 0x1e])
    const zone = e.effectsOf(caster.c).find((x) => x.type === 0x28)!
    expect(zone.duration).toBe(4)
    expect(zone.power).toBe(0x04) // zone 0: the caster's zones counted, the list's last not counted (1b61)
    expect(e.effectsOf(orc.c).some((x) => x.type === 0x1f)).toBe(true) // never saves: helpless
    await removeType(b, caster.c, 0x28)
    expect(printed).toContain('The air clears a little...')
    expect([bf.get(5, 6), bf.get(6, 6), bf.get(6, 5)]).toEqual([OPEN, OPEN, OPEN])
  })

  it('numbers a caster\'s clouds as the original counts them, and an overlapping cloud keeps the cell under the other (1b11, FUN_3723_0cc3)', async () => {
    const { e, b, bf, add, printed } = setup()
    const caster = add(2, 5, 0, 'MAGE')
    const other = add(2, 9, 0, 'OTHER')
    const pw = (c: typeof caster) => e.effectsOf(c.c).filter((x) => x.type === 0x28).map((x) => x.power)
    const cast = async (f: typeof caster, x: number, y: number) => { b.aimed = { x, y }; await b.applySpell(f, e.spells!.get(34)!, 3, []) }
    await cast(caster, 10, 10) // A
    await cast(caster, 11, 10) // B: A is the list's last, not counted
    await cast(other, 20, 10)
    await cast(caster, 30, 10) // A counted, B counted, the other's last
    expect(pw(caster)).toEqual([0x03, 0x03, 0x23])
    // B's squares (11, 10) and (11, 11) were A's: B keeps the open cell A found there
    expect([bf.get(10, 11), bf.get(11, 11), bf.get(10, 12)]).toEqual([0x1e, 0x1e, 0x1e])
    printed.length = 0
    // B's record ends first: the first zone of the caster numbered 0 is A, which lifts
    await removeEffect(b, caster.c, e.effectsOf(caster.c).filter((x) => x.type === 0x28)[1])
    expect(printed).toEqual(['The air clears a little...'])
    // A's squares back to open, B's drawn again over them
    expect([bf.get(10, 10), bf.get(11, 10), bf.get(10, 11), bf.get(11, 11), bf.get(10, 12)]).toEqual([OPEN, OPEN, 0x1e, 0x1e, 0x1e])
    await removeType(b, caster.c, 0x28)
    expect([bf.get(10, 11), bf.get(11, 11), bf.get(10, 12), bf.get(10, 30)]).toEqual([OPEN, OPEN, OPEN, OPEN])
    printed.length = 0
    await removeType(b, caster.c, 0x28) // nothing left: no line
    expect(printed).toEqual([])
  })
})
