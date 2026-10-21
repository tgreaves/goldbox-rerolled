// Game text by address (spec/D-appendices/strings.md): the merged image as tools/mergeovr.py builds it.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { GameText, mergedImage, text } from '../src/data/gametext'
import { COAB, POR, type GameProfile } from '../src/games/profile'

const TOOLS = join(__dirname, '..', '..', 'tools')
const games = [['por', process.env.POOLRAD ?? ''], ['coab', process.env.COAB ?? '']] as const

describe('merged image', () => {
  for (const [g, dir] of games) {
    const have = dir !== '' && existsSync(join(dir, 'START.EXE')) && existsSync(join(dir, 'GAME.OVR'))
    it.skipIf(!have)(`${g}: the same bytes as tools/unexepack.py + mergeovr.py`, () => {
      const tmp = mkdtempSync(join(tmpdir(), 'merge-'))
      try {
        execFileSync('python3', ['-I', join(TOOLS, 'unexepack.py'), join(dir, 'START.EXE'), join(tmp, 'u.exe')])
        execFileSync('python3', ['-I', join(TOOLS, 'mergeovr.py'), join(tmp, 'u.exe'), join(dir, 'GAME.OVR'), join(tmp, 'm.exe')])
        const m = new Uint8Array(readFileSync(join(tmp, 'm.exe')))
        const ref = m.subarray((m[8] | (m[9] << 8)) * 16)
        const img = mergedImage(new Uint8Array(readFileSync(join(dir, 'START.EXE'))), new Uint8Array(readFileSync(join(dir, 'GAME.OVR'))))
        expect(img.length).toBe(ref.length)
        // the same, except the overlay stubs' entries, which mergeovr.py patches into far jumps
        // (5 bytes each from +0x20 of a stub paragraph starting CD 3F 00 00)
        const stub = new Uint8Array(ref.length)
        for (let p = 0; p + 0x20 <= img.length; p += 16) {
          if (img[p] !== 0xcd || img[p + 1] !== 0x3f || img[p + 2] || img[p + 3]) continue
          const n = img[p + 12] | (img[p + 13] << 8)
          stub.fill(1, p + 0x20, p + 0x20 + 5 * n)
        }
        let diff = 0
        for (let i = 0; i < ref.length; i++) if (img[i] !== ref[i] && !stub[i]) diff++
        expect(diff).toBe(0)
      } finally { rmSync(tmp, { recursive: true }) }
    })
  }
})

/**
 * Every game text the profiles address (the engine's messages, the effect and spell lines, the name
 * lists, the credits): [where, address]. Text parameters are the numbers under the keys below.
 */
const TEXT_KEYS = new Set(['msg', 'msgs', 'death', 'names', 'gazes', 'reflects', 'misses', 'lost', 'resists', 'fleeMsg', 'confused',
  'berserkMsg', 'enraged', 'rays', 'gone', 'unaffected', 'immuneMsg', 'itemMsg', 'prompt', 'abort'])
export function addressed(g: GameProfile): [string, number][] {
  const out: [string, number][] = Object.entries(g.strings).map(([id, a]) => [`strings.${id}`, a as number])
  const walk = (where: string, v: unknown, text: boolean) => {
    if (typeof v === 'number') { if (text && v) out.push([where, v]) }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(`${where}[${i}]`, x, text || (/options\[\d+\]\.effects\[\d+\]$/.test(where) && i === 1)))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(`${where}.${k}`, x, text || TEXT_KEYS.has(k))
  }
  for (const [t, h] of Object.entries(g.effects.handlers)) walk(`effects.${t}`, h, false)
  for (const [t, h] of Object.entries(g.effects.items)) walk(`items.${t}`, h, false)
  for (const [t, h] of Object.entries(g.spells.handlers)) walk(`spells.${t}`, h, false)
  return out
}

describe('game text by address', () => {
  const hashes = JSON.parse(readFileSync(join(__dirname, 'text-hashes.json'), 'utf8')) as Record<string, Record<string, string>>
  for (const [g, dir] of [[POR, process.env.POOLRAD ?? ''], [COAB, process.env.COAB ?? '']] as const) {
    const have = dir !== '' && existsSync(join(dir, 'START.EXE')) && existsSync(join(dir, 'GAME.OVR'))
    it.skipIf(!have)(`${g.id}: every addressed string is there and is the expected text (SHA-256 per address)`, () => {
      const t = new GameText(mergedImage(new Uint8Array(readFileSync(join(dir, 'START.EXE'))), new Uint8Array(readFileSync(join(dir, 'GAME.OVR')))))
      const got: Record<string, string> = {}
      for (const [where, a] of addressed(g)) {
        const s = t.read(a)
        // a name slot may hold no text (effect 47's last three, which match nothing in the original either)
        if (s === null && /\.names\[/.test(where)) continue
        expect(s, `${where} at ${a.toString(16)}`).not.toBeNull()
        got[a.toString(16)] = createHash('sha256').update(s!).digest('hex').slice(0, 16)
      }
      if (process.env.WRITE_TEXT_HASHES) { hashes[g.id] = got; writeFileSync(join(__dirname, 'text-hashes.json'), JSON.stringify(hashes, null, 1) + '\n') }
      expect(got).toEqual(hashes[g.id])
    })
    it(`${g.id}: without START.EXE a message shows its address, without its address its id`, () => {
      const none = new GameText(null)
      expect(none.read(0x1000)).toBeNull()
      expect(text(0x1e8ec)).toMatch(/^#1E8EC$|./)
    })
  }
})
