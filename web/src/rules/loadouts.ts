// Spell sets (IMP-098): a character's memorised spells kept under a name, and the last set planned, so
// the same spells can be memorised again with one choice after they have been cast. Not in the
// original. Applying a set memorises, by the game's own rule (rules/camp.ts `memorise`: a free slot of
// the spell's class and level), each spell of the set the character has not already memorised or
// pending; the rest needed to learn them is the ordinary camp rest. Kept per character name in the
// save's .GBR sidecar (spec/C-port/storage.md §6, field `loadouts`).
import type { Spell, SpellTables } from '../data/spells'
import { bookSpell } from '../games/rules'
import { knows, memorise, memorised } from './camp'
import { mayCast } from './magic'

export interface SpellSet { name: string; spells: number[] }
/** one character's sets: `last`, the spells planned the last time Memorize closed with spells pending */
export interface CharacterSets { last?: number[]; sets: SpellSet[] }
export type Loadouts = Record<string, CharacterSets>

/** at most this many named sets a character */
export const MAX_SETS = 6

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x) && x > 0 && x < 0x80) : [])

/** The sidecar's `loadouts`, checked: anything malformed is left out. */
export function readLoadouts(v: unknown): Loadouts {
  const out: Loadouts = {}
  if (!v || typeof v !== 'object') return out
  for (const [name, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as { last?: unknown; sets?: unknown }
    const sets = (Array.isArray(r.sets) ? r.sets : []).flatMap((s): SpellSet[] =>
      s && typeof s === 'object' && typeof (s as SpellSet).name === 'string' ? [{ name: (s as SpellSet).name.slice(0, 24), spells: ids((s as SpellSet).spells) }] : [])
    const last = ids(r.last)
    out[name] = { ...(last.length ? { last } : {}), sets: sets.slice(0, MAX_SETS) }
  }
  return out
}

/** The spells a character has memorised or pending, by id, in slot order. */
export function plannedSpells(c: Uint8Array): number[] {
  return memorised(c).filter((v) => v).map((v) => v & 0x7f)
}

/** "Sleep ×2, Magic Missile" */
export function setText(spells: number[], st: SpellTables): string {
  const counts = new Map<number, number>()
  for (const id of spells) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].map(([id, n]) => `${st.get(id)?.name ?? `spell ${id}`}${n > 1 ? ` ×${n}` : ''}`).join(', ')
}

/**
 * Memorise what `spells` holds beyond what the character already has memorised or pending. A spell
 * the character no longer knows, may not cast now, or has no free slot for is skipped and named.
 */
export function applySet(c: Uint8Array, spells: number[], st: SpellTables): { added: number; skipped: string[] } {
  const have = new Map<number, number>()
  for (const id of plannedSpells(c)) have.set(id, (have.get(id) ?? 0) + 1)
  let added = 0
  const skipped: string[] = []
  for (const id of spells) {
    const n = have.get(id) ?? 0
    if (n > 0) { have.set(id, n - 1); continue }
    const s: Spell | undefined = st.get(id)
    if (!s || !bookSpell(s) || !knows(c, id) || !mayCast(c, s) || !memorise(c, s, st)) { skipped.push(s?.name ?? `spell ${id}`); continue }
    added++
  }
  return { added, skipped }
}
