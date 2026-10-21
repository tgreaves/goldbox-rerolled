// The original's drawn 3D view (D6; spec/C-port/exploration-view.md §2) and the V9 harness. Part A's
// rules on made-up maps need no game files; the frames of the player's files (POOLRAD, COAB) are
// compared with the hashes in view-frames.json (no game art is kept: a hash of a frame says nothing
// of it), computed by this harness from the GOG files named there.
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { GeoMap } from '../src/data/geo'
import type { Picture } from '../src/data/image'
import { PART_A_TABLES, VIEW, drawView, viewCalls, viewWall, type ViewScene } from '../src/render/drawnview'
import { sceneOf, viewTables } from '../src/render/viewscene'
import { Engine, type Io } from '../src/vm/engine'
import { COAB, POR, setGame, type GameProfile } from '../src/games/profile'
import { parseSave } from '../src/data/save'
import { unexepack } from '../src/data/exepack'
import { loadFolder, runScript } from '../headless/harness'
import golden from './view-frames.json'

/** A map with the given walls: [x, y, side 0–3 (N E S W), type]. */
function map(walls: [number, number, number, number][]): GeoMap {
  const raw = new Uint8Array(1026)
  for (const [x, y, d, t] of walls) {
    const i = 2 + (d >> 1) * 256 + y * 16 + x
    raw[i] = d % 2 === 0 ? (raw[i] & 0x0f) | (t << 4) : (raw[i] & 0xf0) | t
  }
  return new GeoMap(raw)
}
const calls = (geo: GeoMap, x: number, y: number, f = 0, closed = false) => viewCalls(geo, x, y, f, closed).map((c) => [c.kind, c.type, c.col, c.row])

describe('the drawn view: what is drawn where (maps-and-view.md, "3D view renderer")', () => {
  it('draws nothing in the open', () => {
    expect(calls(map([]), 8, 8)).toEqual([])
  })

  it('draws the wall ahead (kind 6 at column 2) once from each side, as FUN_55a0_05fd does', () => {
    expect(calls(map([[8, 8, 0, 1]]), 8, 8)).toEqual([[6, 1, 2, 1], [6, 1, 2, 1]])
    expect(calls(map([[8, 7, 0, 4]]), 8, 8)).toEqual([[3, 4, 4, 3], [3, 4, 4, 3]])
    expect(calls(map([[8, 6, 0, 2]]), 8, 8)).toEqual([[0, 2, 5, 4], [0, 2, 5, 4]])
  })

  it('joins a run of far front walls with edge pieces (kind 9) between them', () => {
    expect(calls(map([[7, 6, 0, 1], [8, 6, 0, 1], [9, 6, 0, 1]]), 8, 8)).toEqual([
      [0, 1, 5, 4], [9, 1, 4, 4], [0, 1, 3, 4], // the left walk
      [0, 1, 5, 4], [9, 1, 6, 4], [0, 1, 7, 4], // the right walk
    ])
    // a run ending where the last wall's square has its left side closed: the edge piece still goes in
    expect(calls(map([[8, 6, 0, 2], [8, 6, 3, 5]]), 8, 8).slice(0, 2)).toEqual([[0, 2, 5, 4], [9, 2, 4, 4]])
  })

  it('places the side walls of each depth (kinds 1/2, 4/5, 7/8)', () => {
    expect(calls(map([[8, 8, 3, 3]]), 8, 8)).toEqual([[7, 3, 0, 0]])
    expect(calls(map([[8, 8, 1, 3]]), 8, 8)).toEqual([[8, 3, 9, 0]])
    expect(calls(map([[8, 7, 3, 3]]), 8, 8)).toEqual([[4, 3, 2, 1]])
    expect(calls(map([[8, 6, 3, 3]]), 8, 8)).toEqual([[1, 3, 4, 3]])
    expect(calls(map([[7, 6, 3, 3]]), 8, 8)).toEqual([[1, 3, 1, 3]]) // one column further out
    expect(calls(map([[9, 6, 1, 3]]), 8, 8)).toEqual([[2, 3, 9, 3]])
    expect(calls(map([[7, 7, 3, 3]]), 8, 8)).toEqual([[4, 3, -1, 1]]) // clipped when drawn
  })

  it('turns with the facing: east looks along +x', () => {
    expect(calls(map([[8, 8, 1, 1]]), 8, 8, 2)).toEqual([[6, 1, 2, 1], [6, 1, 2, 1]])
    expect(calls(map([[8, 8, 0, 1]]), 8, 8, 2)).toEqual([[7, 1, 0, 0]])
  })

  it('wraps coordinates by one map only, or finds no wall in areas with closed edges', () => {
    const geo = map([[15, 8, 0, 6], [0, 8, 0, 7]])
    expect(viewWall(geo, -1, 8, 0, false)).toBe(6)
    expect(viewWall(geo, -3, 8, 0, false)).toBe(6) // below 0 is 15, whatever the distance
    expect(viewWall(geo, 16, 8, 0, false)).toBe(7)
    expect(viewWall(geo, 19, 8, 0, false)).toBe(7) // above 15 is 0
    expect(viewWall(geo, -1, 8, 0, true)).toBe(0)
    expect(viewWall(geo, 15, 8, 0, true)).toBe(6)
  })

  it('composes bands, then pictures, then the pieces far to near, colour 13 of a tile leaving what is under it', () => {
    // wall type 1: every cell of every piece is tile 1, a tile whose left half is colour 13
    const table = new Uint8Array(15 * 156).fill(1, 0, 156)
    const tile: Picture = { width: 8, height: 8, x: 0, y: 0, pixels: new Uint8Array(64).map((_, i) => (i % 8 < 4 ? 13 : 4)) }
    const scene: ViewScene = {
      geo: map([[8, 8, 0, 1]]), table, tile: (id) => (id === 1 ? tile : undefined), x: 8, y: 8, facing2: 0, closed: false,
      tables: PART_A_TABLES, bands: [{ from: 0, to: 42, colour: 11 }, { from: 43, to: 87, colour: 6 }], overlays: [], tileMask: 13,
    }
    const f = drawView(scene)
    expect(f.length).toBe(VIEW * VIEW)
    expect(f[0]).toBe(11) // row 0 is above the kind-6 piece (rows 8–71)
    expect(f[87 * VIEW]).toBe(6)
    expect(f[8 * VIEW + 16]).toBe(11) // the piece's first cell, left half: the sky shows through
    expect(f[8 * VIEW + 20]).toBe(4)
    expect(f[50 * VIEW + 20]).toBe(4)
    expect(f[50 * VIEW + 16]).toBe(6) // the floor through the masked half
    expect(f[50 * VIEW + 72]).toBe(6) // right of the 7-cell piece (columns 2–8)
    // a sprite over it: colour 0 transparent, 13 black
    const sprite: Picture = { width: 8, height: 1, x: 0, y: 1, pixels: new Uint8Array([0, 13, 5, 0, 0, 0, 0, 0]) }
    const g = drawView({ ...scene, sprite })
    expect([g[8 * VIEW], g[8 * VIEW + 1], g[8 * VIEW + 2]]).toEqual([11, 0, 5])
  })
})

const games: [GameProfile, string][] = [[POR, process.env.POOLRAD ?? ''], [COAB, process.env.COAB ?? '']]
const quiet = { print: () => {}, menu: async () => 0, refresh: async () => {}, pause: async () => {}, sound: () => {}, picture: () => {},
  sprite: () => {}, engine: async () => {}, inputNumber: async () => 0, inputText: async () => '' } as unknown as Io
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

for (const [g, dir] of games) {
  const have = dir !== '' && existsSync(dir)
  describe.skipIf(!have)(`the drawn view in ${g.name} (V9)`, () => {
    it("reads the piece tables and direction vectors from START.EXE, as part A gives them", () => {
      setGame(g)
      const files = loadFolder(g, dir)
      expect(viewTables(unexepack(files.get('START.EXE')!).image)).toEqual(PART_A_TABLES)
    })

    it('renders every square and facing of each reference area the same as the reference frames', async () => {
      setGame(g)
      const files = loadFolder(g, dir)
      const ref = (golden as unknown as Record<string, { startExe: string; cases: { jump: number[] | null; block: number; area: number; frames: string }[] }>)[g.id]
      if (sha(files.get('START.EXE')!) !== ref.startExe) return // another release of the game: no reference frames
      for (const c of ref.cases) {
        const dat = files.get('SAVGAMA.DAT')!
        const e = new Engine(files, quiet, 1)
        e.loadSave(dat, parseSave(dat).party.map((s) => files.get(`${s}.SAV`)!))
        await e.start()
        if (c.jump) await e.jump(c.jump[0], c.jump[1], 8, 8, 0)
        expect([e.block, e.area]).toEqual([c.block, c.area])
        const all = createHash('sha256')
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) for (const f of [0, 2, 4, 6]) {
          e.x = x; e.y = y; e.facing2 = f
          all.update(drawView(sceneOf(e, files)!))
        }
        expect(all.digest('hex'), `block ${c.block} area ${c.area}: 1024 frames`).toBe(c.frames)
      }
    })

    it('renders the frame at the end of a headless run (the harness, host-contracts.md §8)', async () => {
      const files = loadFolder(g, dir)
      const events: { event: string; sha256?: string }[] = []
      const r = await runScript({ files, script: { game: g.id, answers: [0, 0, 0] }, out: (ev) => events.push(ev), frame: true })
      expect(r.frame?.indices.length).toBe(VIEW * VIEW)
      expect(events.find((ev) => ev.event === 'frame')?.sha256).toBe(r.frame!.sha256)
      expect(r.frame!.sha256).toBe(sha(r.frame!.indices))
    })
  })
}
