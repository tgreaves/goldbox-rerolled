// The battle screen: the battlefield in the view panel, combat menus in the command bar, movement by
// arrow keys or by tapping a neighbouring cell, aiming from a list or by tapping (IMP-033).
import type { Engine } from '../vm/engine'
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, type Picture } from '../data/image'
import { buildIcon } from '../render/icon'
import { CombatView, type Figure } from '../render/combatview'
import { fight, type AimEntry, type Battle, type CombatUi, type Fighter } from '../rules/combat'

export interface BattleScreen {
  engine: Engine
  files: GameFiles
  canvas: HTMLCanvasElement
  menu(items: string[], opts?: { prompt?: string; vertical?: boolean }): Promise<number>
  print(text: string): void
  view(c: Uint8Array): Promise<void>
  sound(n: number): void
  /** set while a step or aim waits for a tap or key; the screen routes input here */
  input: { key?: (e: KeyboardEvent) => boolean; tap?: (e: MouseEvent) => void }
  refreshRoster(): void
  /** dismiss a menu that a key or tap answered instead */
  cancelMenu(): void
}

const KEY_DIRS: Record<string, number> = {
  ArrowUp: 0, '8': 0, PageUp: 1, '9': 1, ArrowRight: 2, '6': 2, PageDown: 3, '3': 3,
  ArrowDown: 4, '2': 4, End: 5, '1': 5, ArrowLeft: 6, '4': 6, Home: 7, '7': 7,
}

export async function runBattle(s: BattleScreen) {
  const e = s.engine
  let battle: Battle | null = null
  let view: CombatView | null = null
  let focus = { row: 12, col: 25 }
  let marks: { row: number; col: number; colour: string }[] = []
  let acting: Fighter | null = null
  const icons = new Map<Uint8Array, { icon: Picture | null; action: Picture | null }>()
  const iconOf = (f: Fighter) => {
    let v = icons.get(f.c)
    if (!v) {
      if (f.monster && e.combatPicture.has(f.c)) {
        const id = e.combatPicture.get(f.c) ?? 0
        const pic = (r: number) => { const raw = s.files.record(`CPIC${e.block}`, r); try { return raw ? parseRecord(raw).frames[0].picture : null } catch { return null } }
        v = { icon: pic(id), action: pic(id + 128) }
      } else v = { icon: buildIcon(s.files, f.c, false), action: buildIcon(s.files, f.c, true) }
      icons.set(f.c, v)
    }
    return v
  }
  const draw = () => {
    if (!battle || !view) return
    const figures: Figure[] = battle.fighters.filter((f) => battle!.inPlay(f)).map((f) => {
      const ic = iconOf(f)
      return { row: f.y, col: f.x, icon: ic.icon, action: ic.action, side: f.c[0x10e] ? 1 : 0, left: f.r[9] >= 5 && f.r[9] <= 7 } as Figure
    })
    const act = acting ? figures[battle.fighters.filter((f) => battle!.inPlay(f)).indexOf(acting)] : undefined
    view.draw(battle.bf, battle.cells, figures, focus, [...marks, ...(acting ? [{ row: acting.y, col: acting.x, colour: '#f2c94c' }] : [])], act)
  }
  const ui: CombatUi = {
    print: (t) => s.print(t),
    redraw: (f) => {
      if (f) { acting = f; focus = { row: f.y, col: f.x } }
      draw()
      s.refreshRoster()
    },
    pause: (ms = 120) => new Promise((r) => setTimeout(r, ms)),
    menu: (items, opts) => s.menu(items, opts),
    step: (f, left) => new Promise((resolve) => {
      marks = []
      for (let d = 0; d < 8; d++) {
        const [dx, dy] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][d]
        marks.push({ row: f.y + dy, col: f.x + dx, colour: '#4c8bd6' })
      }
      draw()
      let settled = false
      const done = (v: number | 'end' | 'undo', fromMenu = false) => {
        if (settled) return
        settled = true
        s.input = {}
        marks = []
        if (!fromMenu) s.cancelMenu()
        resolve(v)
      }
      s.input = {
        key: (ev) => {
          if (ev.key in KEY_DIRS) { done(KEY_DIRS[ev.key]); return true }
          if (ev.key === 'Enter') { done('end'); return true }
          if (ev.key === 'Escape') { done('undo'); return true }
          return false
        },
        tap: (ev) => {
          const cell = view!.cellAt(ev, focus)
          const dx = cell.col - f.x, dy = cell.row - f.y
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return
          const d = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].findIndex(([x, y]) => x === Math.sign(dx) && y === Math.sign(dy))
          done(d)
        },
      }
      void s.menu(['END MOVE', 'UNDO'], { prompt: `Move/Attack, Move Left = ${left}` }).then((i) => done(i === 0 ? 'end' : 'undo', true))
    }),
    aim: (f, entries, prompt, allowCell) => new Promise<AimEntry | null>((resolve) => {
      const ok = entries.filter((x) => x.ok)
      marks = ok.map((x) => ({ row: x.y, col: x.x, colour: '#e05050' }))
      draw()
      let settled = false
      const finish = (v: AimEntry | null, fromMenu = false) => {
        if (settled) return
        settled = true
        s.input = {}
        marks = []
        if (!fromMenu) s.cancelMenu()
        draw()
        resolve(v)
      }
      s.input = {
        tap: (ev) => {
          const cell = view!.cellAt(ev, focus)
          const hit = ok.find((x) => x.f && x.f.y === cell.row && x.f.x === cell.col)
          if (hit) finish(hit)
          else if (allowCell) finish({ f: null, x: cell.col, y: cell.row, cost: battle!.cost(f.x, f.y, cell.col, cell.row), ok: true })
        },
      }
      const labels = ok.map((x) => `${x.f ? String.fromCharCode(...x.f.c.subarray(1, 1 + x.f.c[0])) : 'there'} (range ${x.cost >> 1})`)
      void s.menu([...labels, 'EXIT'], { prompt: ok.length ? prompt : `${prompt} nobody in range`, vertical: true })
        .then((i) => finish(i < ok.length ? ok[i] : null, true))
    }),
    confirm: async (prompt) => (await s.menu(['YES', 'NO'], { prompt })) === 0,
    view: (c) => s.view(c),
    sound: (n) => s.sound(n),
    pick: async (prompt, items) => {
      if (!items.length) return -1
      const i = await s.menu([...items, 'EXIT'], { prompt, vertical: true })
      return i < items.length ? i : -1
    },
  }
  s.canvas.hidden = false
  // the window grows with the space the battle screen gets (IMP-033)
  const resize = new ResizeObserver(() => {
    const r = s.canvas.getBoundingClientRect()
    if (view?.fit(r.width, r.height)) draw()
  })
  try {
    const result = await fight(e, ui, (b) => {
      battle = b
      view = new CombatView(s.canvas, s.files, !!e.overland)
      const r = s.canvas.getBoundingClientRect()
      view.fit(r.width, r.height)
      resize.observe(s.canvas)
      focus = { row: b.fighters[0]?.y ?? 12, col: b.fighters[0]?.x ?? 25 }
      draw()
    })
    for (const m of result.messages) s.print(m)
    return result
  } finally {
    resize.disconnect()
    s.canvas.hidden = true
    s.input = {}
  }
}
