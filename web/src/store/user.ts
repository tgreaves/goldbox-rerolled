// The player's own data: the character roster (as original CHRDAT files) and the current party.
// Kept in IndexedDB, separate from the imported game files, one database per game
// (GameProfile.stores.user) so each game has its own roster and saves. Every change is reported to
// the sync layer (store/changes.ts, IMP-072), which sends it to the server when signed in.
import type { GameFiles } from './gamefiles'
import { game } from '../games/profile'
import { localChanged } from './changes'
import { charToRec, recToChar, recToSave, saveToRec, splitKey, type Rec } from './records'
import type { LocalSide } from './sync'

const CHARS = 'characters'
const META = 'meta'
const SAVES = 'saves'
/** conflict copies kept by the sync (IMP-072): records as the server holds them */
const CONFLICTS = 'conflicts'

export interface StoredCharacter {
  /** file stem as the original names it, e.g. CHRDATA1 */
  stem: string
  sav: Uint8Array
  itm?: Uint8Array
  spc?: Uint8Array
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(game().stores.user, 3)
    req.onupgradeneeded = () => {
      for (const name of [CHARS, META, SAVES, CONFLICTS]) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const req = f(db.transaction(store, mode).objectStore(store))
    req.onsuccess = () => { resolve(req.result); db.close() }
    req.onerror = () => { reject(req.error); db.close() }
  }))
}

const buf = (u?: Uint8Array) => (u ? u.slice().buffer : undefined)
const arr = (b?: ArrayBuffer) => (b ? new Uint8Array(b) : undefined)

interface StoredSave { dat: ArrayBuffer; chars: { sav: ArrayBuffer; itm?: ArrayBuffer; spc?: ArrayBuffer }[]; label: string; savedAt: number; known?: string[] }

async function readChar(stem: string): Promise<StoredCharacter | null> {
  const v = await run<{ sav: ArrayBuffer; itm?: ArrayBuffer; spc?: ArrayBuffer } | undefined>(CHARS, 'readonly', (s) => s.get(stem))
  return v ? { stem, sav: new Uint8Array(v.sav), itm: arr(v.itm), spc: arr(v.spc) } : null
}
const putChar = (c: StoredCharacter) => run(CHARS, 'readwrite', (s) => s.put({ sav: buf(c.sav), itm: buf(c.itm), spc: buf(c.spc) }, c.stem))

export async function listCharacters(): Promise<StoredCharacter[]> {
  const keys = (await run(CHARS, 'readonly', (s) => s.getAllKeys())) as string[]
  const out: StoredCharacter[] = []
  for (const k of keys.sort()) {
    const c = await readChar(k)
    if (c) out.push(c)
  }
  return out
}

export async function saveCharacter(c: StoredCharacter) {
  await putChar(c)
  localChanged(`characters/${c.stem}`)
}

export async function deleteCharacter(stem: string) {
  await run(CHARS, 'readwrite', (s) => s.delete(stem))
  localChanged(`characters/${stem}`)
}

export async function getParty(): Promise<string[]> {
  return ((await run(META, 'readonly', (s) => s.get('party'))) as string[] | undefined) ?? []
}

export async function setParty(stems: string[]) {
  await run(META, 'readwrite', (s) => s.put(stems, 'party'))
  localChanged('docs/party')
}

/** First run: copy the characters from the imported game files into the roster (those not there yet). */
export async function seedRoster(files: GameFiles) {
  if ((await run(META, 'readonly', (s) => s.get('seeded'))) === true) return
  const have = new Set((await run(CHARS, 'readonly', (s) => s.getAllKeys())) as string[])
  for (const name of files.names()) {
    const m = /^(CHRDAT.+)\.SAV$/.exec(name)
    if (!m || have.has(m[1])) continue
    await putChar({ stem: m[1], sav: files.get(name)!, itm: files.get(`${m[1]}.${game().saves.items}`), spc: files.get(`${m[1]}.${game().saves.effects}`) })
    localChanged(`characters/${m[1]}`, 'seed')
  }
  await run(META, 'readwrite', (s) => s.put(true, 'seeded'))
}

/** A saved game: the original SAVGAM<x>.DAT image plus each party member's files. */
export interface SavedGame {
  slot: string
  dat: Uint8Array
  chars: { sav: Uint8Array; itm?: Uint8Array; spc?: Uint8Array }[]
  label: string
  savedAt: number
  /** commissions the clerk has offered (port-only: the original does not record them, IMP-023) */
  known?: string[]
}

async function readSave(key: string, slot: string): Promise<SavedGame | null> {
  const v = await run<StoredSave | undefined>(SAVES, 'readonly', (s) => s.get(key))
  if (!v) return null
  return { slot, dat: new Uint8Array(v.dat), label: v.label, savedAt: v.savedAt, known: v.known,
    chars: v.chars.map((c) => ({ sav: new Uint8Array(c.sav), itm: arr(c.itm), spc: arr(c.spc) })) }
}
const putSave = (key: string, g: SavedGame) => run(SAVES, 'readwrite', (s) => s.put({ dat: buf(g.dat), label: g.label, savedAt: g.savedAt, known: g.known,
  chars: g.chars.map((c) => ({ sav: buf(c.sav), itm: buf(c.itm), spc: buf(c.spc) })) }, key))

export async function listSaves(): Promise<SavedGame[]> {
  const out: SavedGame[] = []
  for (const slot of 'ABCDEFGHIJ') {
    const g = await readSave(slot, slot)
    if (g) out.push(g)
  }
  return out
}

export async function writeSave(g: SavedGame) {
  await putSave(g.slot, g)
  localChanged(`saves/${g.slot}`)
}

/**
 * The autosave (IMP-060): its own record, beside slots A–J. The play screen writes it after an action,
 * never inside a script: on an area change, otherwise at most every 30 seconds (spec/C-port/storage.md §5).
 */
export async function writeAutosave(g: SavedGame) {
  await putSave('auto', g)
  localChanged('saves/AUTO')
}

export async function readAutosave(): Promise<SavedGame | null> {
  return readSave('auto', 'A')
}

// ------------------------------------------------------------------ conflict copies (IMP-072)

export interface ConflictCopy {
  id: string
  /** what it is a copy of: a save slot (A–J, AUTO) or a roster character's stem */
  of: 'saves' | 'characters'
  ofId: string
  /** whose version lost: this browser's, or the server's (from another device) */
  from: 'browser' | 'server'
  keptAt: number
  label: string
  save?: SavedGame
  character?: StoredCharacter
}

function toCopy(id: string, r: Rec): ConflictCopy | null {
  const of = r.meta.conflictOf, ofId = String(r.meta.conflictId ?? '')
  if (of !== 'saves' && of !== 'characters') return null
  const base = { id, of, ofId, from: r.meta.from === 'server' ? 'server' : 'browser', keptAt: Number(r.meta.keptAt ?? 0) } as const
  if (of === 'saves') {
    const save = recToSave(r)
    return save ? { ...base, label: save.label, save } : null
  }
  const character = recToChar(ofId, r)
  if (!character) return null
  const sav = character.sav
  return { ...base, label: String.fromCharCode(...sav.subarray(1, 1 + sav[0])), character }
}

export async function listConflicts(): Promise<ConflictCopy[]> {
  const keys = (await run(CONFLICTS, 'readonly', (s) => s.getAllKeys())) as string[]
  const out: ConflictCopy[] = []
  for (const k of keys) {
    const r = await run<Rec | undefined>(CONFLICTS, 'readonly', (s) => s.get(k))
    const c = r && toCopy(k, r)
    if (c) out.push(c)
  }
  return out.sort((a, b) => b.keptAt - a.keptAt)
}

export async function deleteConflict(id: string) {
  await run(CONFLICTS, 'readwrite', (s) => s.delete(id))
  localChanged(`conflicts/${id}`)
}

/** Put a conflict copy back in its place (replacing what is there now) and drop the copy. */
export async function restoreConflict(c: ConflictCopy) {
  if (c.save) {
    if (c.ofId === 'AUTO') await writeAutosave(c.save)
    else await writeSave({ ...c.save, slot: c.ofId })
  } else if (c.character) await saveCharacter(c.character)
  await deleteConflict(c.id)
}

// ------------------------------------------------------------------ the sync's view (no change reports)

/** The active game's IndexedDB records as the sync layer sees them (store/sync.ts). */
export const userLocal: LocalSide = {
  async keys() {
    const saves = (await run(SAVES, 'readonly', (s) => s.getAllKeys())) as string[]
    const chars = (await run(CHARS, 'readonly', (s) => s.getAllKeys())) as string[]
    const conflicts = (await run(CONFLICTS, 'readonly', (s) => s.getAllKeys())) as string[]
    const party = await run(META, 'readonly', (s) => s.get('party'))
    return [
      ...saves.map((k) => `saves/${k === 'auto' ? 'AUTO' : k}`),
      ...chars.map((k) => `characters/${k}`),
      ...conflicts.map((k) => `conflicts/${k}`),
      ...(party !== undefined ? ['docs/party'] : []),
    ]
  },
  async get(key) {
    const [kind, id] = splitKey(key)
    if (kind === 'saves') {
      const g = await readSave(id === 'AUTO' ? 'auto' : id, id === 'AUTO' ? 'A' : id)
      return g ? saveToRec(g) : null
    }
    if (kind === 'characters') {
      const c = await readChar(id)
      return c ? charToRec(c) : null
    }
    if (kind === 'conflicts') return (await run<Rec | undefined>(CONFLICTS, 'readonly', (s) => s.get(id))) ?? null
    if (key === 'docs/party') {
      const p = await run<string[] | undefined>(META, 'readonly', (s) => s.get('party'))
      return p === undefined ? null : { meta: { stems: p }, files: [] }
    }
    return null
  },
  async put(key, rec) {
    const [kind, id] = splitKey(key)
    if (kind === 'saves') {
      const g = recToSave(rec)
      if (g) await putSave(id === 'AUTO' ? 'auto' : id, id === 'AUTO' ? g : { ...g, slot: id })
    } else if (kind === 'characters') {
      const c = recToChar(id, rec)
      if (c) await putChar(c)
    } else if (kind === 'conflicts') {
      await run(CONFLICTS, 'readwrite', (s) => s.put({ meta: rec.meta, files: rec.files.map((f) => ({ name: f.name, data: f.data.slice() })) }, id))
    } else if (key === 'docs/party') {
      const stems = Array.isArray(rec.meta.stems) ? rec.meta.stems.filter((x): x is string => typeof x === 'string') : []
      await run(META, 'readwrite', (s) => s.put(stems, 'party'))
    }
  },
  async remove(key) {
    const [kind, id] = splitKey(key)
    if (kind === 'saves') await run(SAVES, 'readwrite', (s) => s.delete(id === 'AUTO' ? 'auto' : id))
    else if (kind === 'characters') await run(CHARS, 'readwrite', (s) => s.delete(id))
    else if (kind === 'conflicts') await run(CONFLICTS, 'readwrite', (s) => s.delete(id))
    else if (key === 'docs/party') await run(META, 'readwrite', (s) => s.delete('party'))
  },
}

/** Remove the player's data of every game from this browser (signing out with "forget", or another account). */
export function forgetUserData(dbNames: string[]): Promise<void[]> {
  return Promise.all(dbNames.map((n) => new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(n)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })))
}
