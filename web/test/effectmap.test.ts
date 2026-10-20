// Each game's effect handler map (games/effectrules.ts) is complete: every type of the original's handler
// table, and every effect type the game's data can add (its event lists, its spells' records and
// handler parameters, its monsters' and characters' effect records, the effects its items grant), names
// an existing behaviour (rules/effectkinds.ts). Needs POOLRAD and COAB for the data part.
import { afterAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readDax, daxRecords } from '../src/data/dax'
import { parseItems } from '../src/data/items'
import { parseEffects } from '../src/data/effects'
import { SpellTables } from '../src/data/spells'
import { COAB, POR, setGame, type GameProfile } from '../src/games/profile'
import { BEHAVIOURS } from '../src/rules/effectkinds'

/** the effect type fields of the spell kinds' parameters (games/spellrules.ts) */
const SPELL_EFFECT_KEYS = ['effect', 'opposite', 'remove', 'owner', 'casterEffect', 'probe', 'heldBy']
const SPELL_EFFECT_LISTS = ['removes', 'releases']

function spellParamTypes(g: GameProfile): number[] {
  const out: number[] = []
  const walk = (v: unknown, key = '') => {
    if (Array.isArray(v)) {
      if (SPELL_EFFECT_LISTS.includes(key) && v.every((x) => typeof x === 'number')) out.push(...(v as number[]))
      else if (key === 'effects') for (const e of v as unknown[][]) out.push(e[0] as number) // Fire Shield's [type, line]
      else v.forEach((x) => walk(x))
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (SPELL_EFFECT_KEYS.includes(k) && typeof x === 'number') out.push(x)
      else walk(x, k)
    }
  }
  walk(g.spells.handlers)
  return out
}

/** the types the original's handler table has: PoR FUN_5216_0000 1–127 (128–139 are item handlers); CotAB DS:6FC0 1–146 (147 runs for items only) */
const TABLE: [GameProfile, number][] = [[POR, 127], [COAB, 146]]

describe('effect handler maps', () => {
  afterAll(() => setGame(POR))
  for (const [g, last] of TABLE) {
    it(`${g.id}: every type of the original's table names an existing behaviour`, () => {
      for (let t = 1; t <= last; t++) {
        const spec = g.effects.handlers[t]
        expect(spec, `${g.id} type ${t}`).toBeDefined()
        expect(BEHAVIOURS[spec.b], `${g.id} type ${t}: ${spec.b}`).toBeTypeOf('function')
      }
      for (const t of Object.keys(g.effects.handlers).map(Number)) expect(t, `${g.id} has no type ${t}`).toBeLessThanOrEqual(last)
    })
  }

  it('CotAB names the same entries as PoR where its handler is the same', () => {
    for (const t of [1, 2, 6, 8, 10, 11, 15, 17, 21, 22, 30, 34, 44, 64, 67, 79, 99, 105, 111, 125]) expect(COAB.effects.handlers[t], `type ${t}`).toBe(POR.effects.handlers[t])
  })

  it('PoR\'s handlers that wait for something are the async behaviours (the old POR_WAITS)', () => {
    // 88 waits through the breath bolt's promise (rules/specials.ts), its behaviour only passes it on
    const waits = Object.entries(POR.effects.handlers).filter(([t, s]) => BEHAVIOURS[s.b].constructor.name === 'AsyncFunction' || Number(t) === 88).map(([t]) => Number(t))
    expect(waits).toEqual([22, 28, 34, 64, 65, 66, 67, 68, 69, 70, 73, 74, 75, 84, 88, 99, 121])
  })
})

const dirs: [GameProfile, string][] = [[POR, process.env.POOLRAD ?? ''], [COAB, process.env.COAB ?? '']]
for (const [g, dir] of dirs) {
  describe.skipIf(!dir || !existsSync(dir))(`${g.id}: the effect types its data can add`, () => {
    afterAll(() => setGame(POR))
    it('each has a handler', () => {
      setGame(g)
      const found = new Map<number, string>()
      const add = (t: number, src: string) => { if (t !== 0 && !found.has(t)) found.set(t, src) } // 0: an empty record
      for (const [ev, types] of Object.entries(g.effects.events)) for (const t of types) add(t, `event ${ev}`)
      const files: string[] = []
      const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else files.push(p) } }
      walk(dir)
      const start = files.find((p) => /START\.EXE$/i.test(p))
      const book = start ? SpellTables.load(new Uint8Array(readFileSync(start))) : null
      for (const s of book?.spells ?? []) add(s.effect, `spell ${s.id}`)
      for (const t of spellParamTypes(g)) add(t, 'a spell kind')
      // the item handlers that grant effect +0x3D: PoR 128–130, 133, 134, 136, 138, 139; CotAB kind 0
      const grants = (it: { raw: Uint8Array }) => it.raw[0x3e] >= 0x80 &&
        (g.effects.items === 'kinds' ? (it.raw[0x3e] & 0x7f) === 0 : [128, 129, 130, 133, 134, 136, 138, 139].includes(it.raw[0x3e]))
      for (const p of files) {
        const n = p.toUpperCase(), short = p.slice(dir.length + 1)
        const read = (d: Uint8Array, src: string) => {
          if (/SPC|\.FX$/.test(n)) for (const e of parseEffects(d)) add(e.type, src)
          if (/ITM|ITEM\d|\.SWG$/.test(n)) for (const it of parseItems(d)) if (grants(it)) add(it.raw[0x3d], `${src} item`)
        }
        const b = new Uint8Array(readFileSync(p))
        if (n.endsWith('.DAX') && /SPC|ITM|ITEM\d/.test(n)) for (const [id, d] of daxRecords(readDax(b))) read(d, `${short} #${id}`)
        else if (/\.(SPC|FX|ITM|SWG)$/.test(n)) read(b, short)
      }
      expect(found.size).toBeGreaterThan(40)
      for (const [t, src] of found) {
        const spec = g.effects.handlers[t]
        expect(spec, `${g.id} type ${t} (${src})`).toBeDefined()
        expect(BEHAVIOURS[spec.b], `${g.id} type ${t} (${src}): ${spec.b}`).toBeTypeOf('function')
      }
    })
  })
}
