// Battle placement (PoR FUN_34c7_1577, CotAB 0x26010; spec/A-games/engine/combat-rules.md "Placement"):
// the scan's front line holds `lim` combatants; in a map area a ring whose edge from the side's own
// square is a wall is skipped, so nobody is placed past it; the party's second line is skipped facing
// east or west unless walls close the square. Needs POOLRAD and COAB.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { GameFiles } from '../src/store/gamefiles'
import { Engine, type Io } from '../src/vm/engine'
import { Battle, type CombatUi } from '../src/rules/combat'
import { Battlefield, ROWS, COLS, cellTable } from '../src/rules/battlefield'
import { COAB, POR, setGame, wants, type GameProfile } from '../src/games/profile'
import { F } from '../src/games/fields'

function load(dir: string, g: GameProfile) {
  setGame(g)
  const m = new Map<string, Uint8Array>()
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (wants(g, n)) m.set(n.toUpperCase(), new Uint8Array(readFileSync(p))) } }
  walk(dir)
  return new GameFiles(m, g)
}

type Edges = ((x: number, y: number, d: number) => number) | null

/** `party` and `monsters` combatants in an open arena, placed facing `facing` (0 N … 3 W) */
function placed(files: GameFiles, party: number, monsters: number, facing: number, distance: number, edges: Edges) {
  const e = new Engine(files, { print: () => {}, menu: async () => 0 } as unknown as Io, 1)
  const cells = cellTable(e.startImage!)
  const open = cells.findIndex((c, i) => i > 0 && c.move === 1)
  const bf = new Battlefield(false)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) bf.set(r, c, open)
  const b = new Battle(e, { print: () => {}, redraw: () => {}, pause: async () => {}, sound: () => {} } as unknown as CombatUi, bf, cells)
  e.nodes = Array.from({ length: party + monsters }, (_, i) => {
    const c = new Uint8Array(F.size)
    c[F.inPlay] = 1; c[F.status] = 0; c[F.hp] = c[F.maxHp] = 10; c[F.sizeFlags] = 1
    c[F.side] = i < party ? 0 : 1
    c[F.morale] = i < party ? 0 : 0xff
    return c
  })
  e.x = 7; e.y = 7
  b.setup(party, facing, distance, edges)
  return b.fighters.map((f) => [f.x, f.y, f.size])
}

const games: [string, GameProfile, string][] = [['PoR', POR, process.env.POOLRAD ?? ''], ['CotAB', COAB, process.env.COAB ?? '']]
for (const [name, g, dir] of games) {
  describe.skipIf(!dir || !existsSync(dir))(`${name} placement`, () => {
    afterAll(() => setGame(POR))
    const files = dir && existsSync(dir) ? load(dir, g) : null

    it('the spec\'s example: six facing north, a front line of three; eight monsters a square ahead', () => {
      setGame(g)
      const at = placed(files!, 6, 8, 0, 1, null)
      expect(at.slice(0, 6).map(([x, y]) => [x, y])).toEqual([[27, 13], [28, 13], [26, 13], [28, 14], [29, 14], [27, 14]])
      expect(at.slice(6).map(([x, y]) => [x, y])).toEqual([[22, 7], [21, 7], [23, 7], [20, 7], [21, 6], [20, 6], [22, 6], [19, 6]])
    })

    it('in a map area a walled ring is skipped: nobody stands past the wall', () => {
      setGame(g)
      // 30 monsters facing south from the party (F 2 for the enemy: rings N, W, E of its square, placeRing)
      const sq = (bx: number, by: number) => ([x, y, size]: number[]) => size > 0 && y - 10 - 5 * by >= 0 && y - 10 - 5 * by <= 4 &&
        x - 22 - 6 * bx - 5 * by >= 0 && x - 22 - 6 * bx - 5 * by <= 10
      const open = placed(files!, 1, 30, 0, 1, () => 0).slice(1)
      // the enemy square is (0, -1) from the party at (7, 7): wall its north edge (map (7, 6), d 0)
      const walled = placed(files!, 1, 30, 0, 1, (x, y, d) => (x === 7 && y === 6 && d === 0 ? 1 : 0)).slice(1)
      expect(open.some(sq(0, -2))).toBe(true) // ring 1, north of the enemy's square
      expect(walled.some(sq(0, -2))).toBe(false)
    })

    it('facing east the party skips its second line unless walls close its square', () => {
      setGame(g)
      const wild = placed(files!, 6, 0, 1, 0, null)
      const openMap = placed(files!, 6, 0, 1, 0, () => 0)
      const closed = placed(files!, 6, 0, 1, 0, (x, y) => (x === 7 && y === 7 ? 1 : 0))
      expect(openMap).toEqual(wild)
      expect(closed).not.toEqual(wild)
    })
  })
}
