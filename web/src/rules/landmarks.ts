// Landmarks on the area map (IMPROVEMENTS.md IMP-024): shops, temples, inns and the like, found by
// reading the area's ECL script statically. Each map square carries an event number (GEO plane 2);
// the script's on_step vector dispatches on it with one ON_GOTO, so each event's handler can be
// walked and classified from what it does (spec/ecl.md, spec/town.md).
import type { GeoMap } from '../data/geo'
import { unpackText } from '../data/text'

const CODE = 0x9900

/** Operand count per opcode, and which operand (0-based) holds a count of further operands. */
const OPS: Record<number, [number, number?]> = {
  0x00: [0], 0x01: [1], 0x02: [1], 0x03: [2], 0x04: [3], 0x05: [3], 0x06: [3], 0x07: [3], 0x08: [2], 0x09: [2],
  0x0a: [1], 0x0b: [3], 0x0c: [3], 0x0d: [0], 0x0e: [1], 0x0f: [2], 0x10: [2], 0x11: [1], 0x12: [1], 0x13: [0],
  0x14: [4], 0x15: [3, 2], 0x16: [0], 0x17: [0], 0x18: [0], 0x19: [0], 0x1a: [0], 0x1b: [0], 0x1c: [0], 0x1d: [1],
  0x1e: [6], 0x20: [1], 0x21: [3], 0x22: [2], 0x23: [4], 0x24: [0], 0x25: [2, 1], 0x26: [2, 1], 0x27: [8], 0x28: [3],
  0x29: [14], 0x2a: [3], 0x2b: [2, 1], 0x2c: [6], 0x2d: [1], 0x2e: [5], 0x2f: [3], 0x30: [3], 0x31: [0], 0x32: [1],
  0x33: [0], 0x34: [1], 0x35: [3], 0x36: [2], 0x37: [3], 0x38: [1], 0x39: [1], 0x3a: [0], 0x3b: [3], 0x3c: [1], 0x3d: [0],
}
const GOTO = 0x01, GOSUB = 0x02, SAVE = 0x09, NEW_ECL = 0x20, ON_GOTO = 0x25, ON_GOSUB = 0x26, PROGRAM = 0x38
const ENDS = new Set([0x00, 0x13, GOTO, NEW_ECL]) // EXIT, RETURN, GOTO, NEW_ECL
const isIf = (op: number) => op >= 0x16 && op <= 0x1b

interface Operand { kind: number; word: number; text?: string }
interface Instr { op: number; ops: Operand[]; next: number }

function decode(code: Uint8Array, pc: number): Instr | null {
  const at = (a: number) => code[a - CODE]
  const op = at(pc)
  const spec = OPS[op]
  if (!spec || pc < CODE || pc - CODE >= code.length) return null
  const ops: Operand[] = []
  let p = pc
  const read = (n: number) => {
    for (let i = 0; i < n; i++) {
      const kind = at(p + 1), lo = at(p + 2)
      p += 2
      if ([1, 2, 3, 0x81].includes(kind)) { p += 1; ops.push({ kind, word: lo | (at(p) << 8) }) }
      else if (kind === 0x80) { ops.push({ kind, word: lo, text: unpackText(code.subarray(p + 1 - CODE, p + 1 - CODE + lo)) }); p += lo }
      else ops.push({ kind, word: lo })
    }
  }
  read(spec[0])
  if (spec[1] !== undefined) {
    const c = ops[spec[1]]
    if (c.kind !== 0 && c.kind !== 2) return null
    read(c.word)
  }
  return { op, ops, next: p + 1 }
}

const constant = (o: Operand | undefined) => (o && (o.kind === 0 || o.kind === 2) ? o.word : undefined)
const address = (o: Operand | undefined) => (o && (o.kind === 1 || o.kind === 3) ? o.word : undefined)

/** Everything reachable from `start` (all branches), up to `limit` instructions. */
function walk(code: Uint8Array, start: number, limit = 400) {
  const seen = new Set<number>()
  const queue = [start]
  const out = { texts: [] as string[], saves: [] as [number, number][], programs: [] as number[], newEcl: [] as number[], dispatch: [] as number[][] }
  while (queue.length && seen.size < limit) {
    let pc = queue.shift()!
    let prev = -1
    while (!seen.has(pc) && seen.size < limit) {
      seen.add(pc)
      const ins = decode(code, pc)
      if (!ins) break
      const { op, ops } = ins
      for (const o of ops) if (o.text && o.text.length > 3 && op !== SAVE) out.texts.push(o.text)
      if (op === SAVE) { const v = constant(ops[0]), a = address(ops[1]); if (v !== undefined && a !== undefined) out.saves.push([a, v]) }
      if (op === PROGRAM) out.programs.push(constant(ops[0]) ?? -1)
      if (op === NEW_ECL) { const n = constant(ops[0]); if (n !== undefined) out.newEcl.push(n) }
      if (op === GOTO || op === GOSUB) queue.push(ops[0].word)
      if (op === ON_GOTO || op === ON_GOSUB) {
        const targets = ops.slice(2).map((o) => o.word)
        out.dispatch.push(targets)
        queue.push(...targets)
      }
      if (ENDS.has(op) && !isIf(prev)) break
      prev = op
      pc = ins.next
    }
  }
  return out
}

/** Handlers per event number: the largest ON_GOTO reachable from on_step (vector 1). */
function handlers(code: Uint8Array): number[] {
  const v = decode(code, CODE + 4)
  if (!v || v.op !== GOTO) return []
  // the dispatch itself only, so stop before descending into the handlers it lists
  const seen = new Set<number>()
  const queue = [v.ops[0].word]
  let best: number[] = []
  while (queue.length && seen.size < 300) {
    let pc = queue.shift()!
    let prev = -1
    while (!seen.has(pc) && seen.size < 300) {
      seen.add(pc)
      const ins = decode(code, pc)
      if (!ins) break
      if (ins.op === ON_GOTO || ins.op === ON_GOSUB) {
        const t = ins.ops.slice(2).map((o) => o.word)
        if (t.length > best.length) best = t
        break
      }
      if (ins.op === GOTO) queue.push(ins.ops[0].word)
      if (ENDS.has(ins.op) && !isIf(prev)) break
      prev = ins.op
      pc = ins.next
    }
  }
  return best
}

export type Kind = 'shop' | 'store' | 'jeweller' | 'armoury' | 'silver' | 'temple' | 'inn' | 'tavern' | 'hall' | 'training' | 'harbour' | 'gate'
export interface Landmark { x: number; y: number; kind: Kind; label: string; detail: string }

export const ICONS: Record<Kind, string> = {
  shop: '🏪', store: '🛒', jeweller: '💎', armoury: '🛡', silver: '🥈', temple: '⛪', inn: '🛏', tavern: '🍺', hall: '🏛', training: '⚔', harbour: '⚓', gate: '🚪',
}

/** First sentence of the square's text, as the game prints it. */
const sentence = (t: string) => t.replace(/^'/, '').split(/(?<=[.!?])\s/)[0].trim()

function classify(w: ReturnType<typeof walk>, door: ((n: number) => Kind | null)): { kind: Kind; label: string } | null {
  const all = w.texts.join(' ')
  const has = (re: RegExp) => re.test(all)
  if (has(/\bTAVERN\b/)) return { kind: 'tavern', label: 'Tavern' }
  if (w.saves.some(([a, v]) => a === 0x6de2 && v === 1)) {
    const god = /(?:PRIESTS|PRIESTESS \w+) OF (\w+)/.exec(all)?.[1]
    return { kind: 'temple', label: god ? `Temple of ${god[0]}${god.slice(1).toLowerCase()}` : 'Temple' }
  }
  if (w.saves.some(([a, v]) => a === 0x6e6c && v === 1)) {
    // the four New Phlan shops (spec/town.md), told apart by the shopkeeper's line
    if (has(/JEWELRY/)) return { kind: 'jeweller', label: 'Jeweller' }
    if (has(/ARMS AND ARMOR/)) return { kind: 'armoury', label: 'Arms and armour' }
    if (has(/SILVER/)) return { kind: 'silver', label: 'Silversmith' }
    if (has(/OFFERS YOU ITEMS FOR SALE/)) return { kind: 'store', label: 'General store' }
    return { kind: 'shop', label: 'Shop' }
  }
  if (w.programs.includes(0)) return { kind: 'training', label: 'Training hall' }
  if (w.programs.includes(9) && has(/REST/)) return { kind: 'inn', label: 'Inn' }
  if (has(/CITY HALL/)) return { kind: 'hall', label: 'City Hall' }
  if (has(/HARBOR MASTER|BOARD A BOAT/)) return { kind: 'harbour', label: has(/HARBOR MASTER/) ? 'Harbour master' : 'Boats' }
  if (has(/GATEWAY/)) return { kind: 'gate', label: 'Gateway' }
  for (const n of w.newEcl) {
    const k = door(n)
    if (k) return { kind: k, label: k === 'training' ? 'Training halls' : 'City Hall' }
  }
  return null
}

/**
 * Landmarks of the current area. `record(n)` returns another ECL record of the block (code from
 * byte 2), so doors leading to a training hall or City Hall can be recognised by their destination.
 */
export function landmarks(code: Uint8Array, geo: GeoMap, record: (n: number) => Uint8Array | null): Landmark[] {
  const h = handlers(code)
  if (!h.length) return []
  const doors = new Map<number, Kind | null>()
  const door = (n: number): Kind | null => {
    if (!doors.has(n)) {
      const c = record(n)
      let k: Kind | null = null
      if (c) {
        const w = walk(c, CODE + 4 * 4, 2000) // from on_enter, reaching the area's handlers
        const steps = handlers(c).map((t) => walk(c, t))
        if (steps.some((s) => s.programs.includes(0)) || w.programs.includes(0)) k = 'training'
        else if ([w, ...steps].some((s) => s.texts.some((t) => /CITY HALL/.test(t)))) k = 'hall'
      }
      doors.set(n, k)
    }
    return doors.get(n)!
  }
  const byEvent = new Map<number, { kind: Kind; label: string; detail: string } | null>()
  const out: Landmark[] = []
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ev = geo.event(x, y) & 127
    if (!ev || ev >= h.length) continue
    if (!byEvent.has(ev)) {
      const w = walk(code, h[ev])
      const c = classify(w, door)
      byEvent.set(ev, c && { ...c, detail: w.texts.length ? sentence(w.texts[0]) : c.label })
    }
    const c = byEvent.get(ev)
    if (c) out.push({ x, y, ...c })
  }
  return out
}
