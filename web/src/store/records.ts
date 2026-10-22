// The records the sync layer moves between the browser and the server (spec/C-port/accounts-and-sync.md, §1.2 "Records" and §1.3):
// metadata plus files named and laid out as the original game writes them, using the active game's
// own extensions (PoR .ITM/.SPC/.CHA, CotAB .SWG/.FX/.GUY), so the server stays game-neutral.
import { game } from '../games/profile'
import { parseSave } from '../data/save'
import { parseSidecarFields, sidecar } from './savefiles'
import type { SavedGame, StoredCharacter } from './user'

export type Kind = 'saves' | 'characters' | 'conflicts' | 'docs'
export interface RecFile { name: string; data: Uint8Array }
export interface Rec { meta: Record<string, unknown>; files: RecFile[] }

/** The server's rules for a file name (8.3, DOS characters, upper case) and for a stem. */
const STEM = "[A-Z0-9!#$%&'()+=@^_`{}~\\-\\[\\]]{1,8}"
export const FILE_RE = new RegExp(`^${STEM}\\.[A-Z0-9]{1,3}$`)
export const STEM_RE = new RegExp(`^${STEM}$`)

export const keyOf = (kind: Kind, id: string) => `${kind}/${id}`
export function splitKey(key: string): [Kind, string] {
  const i = key.indexOf('/')
  return [key.slice(0, i) as Kind, key.slice(i + 1)]
}

/** A saved game: SAVGAM<x>.DAT, each member's .SAV and item and effect files, and the .GBR sidecar. */
export function saveToRec(g: SavedGame): Rec {
  const S = game().saves
  let stems: string[] = []
  try { stems = parseSave(g.dat).party } catch { /* named by position below */ }
  const members = g.chars.map((_, i) => (stems[i] && STEM_RE.test(stems[i]) ? stems[i] : `CHRDAT${g.slot}${i + 1}`))
  const files: RecFile[] = [{ name: `SAVGAM${g.slot}.DAT`, data: g.dat }]
  g.chars.forEach((c, i) => {
    files.push({ name: `${members[i]}.SAV`, data: c.sav })
    if (c.itm) files.push({ name: `${members[i]}.${S.items}`, data: c.itm })
    if (c.spc) files.push({ name: `${members[i]}.${S.effects}`, data: c.spc })
  })
  const extra = sidecar(g)
  if (extra) files.push(extra)
  return { meta: { slot: g.slot, label: g.label, savedAt: g.savedAt, members }, files }
}

export function recToSave(r: Rec): SavedGame | null {
  const S = game().saves
  const file = (n: string) => r.files.find((f) => f.name === n)?.data
  const slot = typeof r.meta.slot === 'string' && /^[A-J]$/.test(r.meta.slot) ? r.meta.slot : 'A'
  const dat = file(`SAVGAM${slot}.DAT`)
  const members = Array.isArray(r.meta.members) ? r.meta.members.filter((m): m is string => typeof m === 'string') : []
  if (!dat) return null
  const chars = members.map((m) => ({ sav: file(`${m}.SAV`)!, itm: file(`${m}.${S.items}`), spc: file(`${m}.${S.effects}`) }))
  if (chars.some((c) => !c.sav)) return null
  return { slot, dat, chars, label: String(r.meta.label ?? ''), savedAt: Number(r.meta.savedAt ?? 0), ...parseSidecarFields(file(`SAVGAM${slot}.GBR`)) }
}

/** A roster character as a DOS install keeps it: <stem>.CHA (CotAB .GUY) with its item and effect files. */
export function charToRec(c: StoredCharacter): Rec {
  const S = game().saves
  const files: RecFile[] = [{ name: `${c.stem}.${S.roster}`, data: c.sav }]
  if (c.itm) files.push({ name: `${c.stem}.${S.items}`, data: c.itm })
  if (c.spc) files.push({ name: `${c.stem}.${S.effects}`, data: c.spc })
  return { meta: {}, files }
}

export function recToChar(stem: string, r: Rec): StoredCharacter | null {
  const S = game().saves
  const file = (n: string) => r.files.find((f) => f.name === n)?.data
  const sav = file(`${stem}.${S.roster}`)
  return sav ? { stem, sav, itm: file(`${stem}.${S.items}`), spc: file(`${stem}.${S.effects}`) } : null
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => k !== 'modifiedAt').sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'null'
}

/** Same content (the change time aside)? */
export function sameRec(a: Rec, b: Rec): boolean {
  if (stable(a.meta) !== stable(b.meta) || a.files.length !== b.files.length) return false
  const byName = new Map(b.files.map((f) => [f.name, f.data]))
  return a.files.every((f) => {
    const o = byName.get(f.name)
    return !!o && o.length === f.data.length && o.every((x, i) => x === f.data[i])
  })
}

export function toBase64(d: Uint8Array): string {
  let s = ''
  for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(s: string): Uint8Array {
  const b = atob(s)
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}
