// The player's own data: the character roster (as original CHRDAT files) and the current party.
// Kept in IndexedDB, separate from the imported game files, one database per game
// (GameProfile.stores.user) so each game has its own roster and saves.
import type { GameFiles } from './gamefiles'
import { game } from '../games/profile'

const CHARS = 'characters'
const META = 'meta'
const SAVES = 'saves'

export interface StoredCharacter {
  /** file stem as the original names it, e.g. CHRDATA1 */
  stem: string
  sav: Uint8Array
  itm?: Uint8Array
  spc?: Uint8Array
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(game().stores.user, 2)
    req.onupgradeneeded = () => {
      for (const name of [CHARS, META, SAVES]) {
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

export async function listCharacters(): Promise<StoredCharacter[]> {
  const keys = (await run(CHARS, 'readonly', (s) => s.getAllKeys())) as string[]
  const out: StoredCharacter[] = []
  for (const k of keys.sort()) {
    const v = await run<{ sav: ArrayBuffer; itm?: ArrayBuffer; spc?: ArrayBuffer }>(CHARS, 'readonly', (s) => s.get(k))
    out.push({ stem: k, sav: new Uint8Array(v.sav), itm: arr(v.itm), spc: arr(v.spc) })
  }
  return out
}

export async function saveCharacter(c: StoredCharacter) {
  await run(CHARS, 'readwrite', (s) => s.put({ sav: buf(c.sav), itm: buf(c.itm), spc: buf(c.spc) }, c.stem))
}

export async function deleteCharacter(stem: string) {
  await run(CHARS, 'readwrite', (s) => s.delete(stem))
}

export async function getParty(): Promise<string[]> {
  return ((await run(META, 'readonly', (s) => s.get('party'))) as string[] | undefined) ?? []
}

export async function setParty(stems: string[]) {
  await run(META, 'readwrite', (s) => s.put(stems, 'party'))
}

/** First run: copy the characters from the imported game files into the roster. */
export async function seedRoster(files: GameFiles) {
  if ((await run(META, 'readonly', (s) => s.get('seeded'))) === true) return
  for (const name of files.names()) {
    const m = /^(CHRDAT.+)\.SAV$/.exec(name)
    if (!m) continue
    await saveCharacter({ stem: m[1], sav: files.get(name)!, itm: files.get(`${m[1]}.${game().saves.items}`), spc: files.get(`${m[1]}.${game().saves.effects}`) })
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

export async function listSaves(): Promise<SavedGame[]> {
  const out: SavedGame[] = []
  for (const slot of 'ABCDEFGHIJ') {
    const v = await run<{ dat: ArrayBuffer; chars: { sav: ArrayBuffer; itm?: ArrayBuffer; spc?: ArrayBuffer }[]; label: string; savedAt: number; known?: string[] } | undefined>(SAVES, 'readonly', (s) => s.get(slot))
    if (v) out.push({ slot, dat: new Uint8Array(v.dat), label: v.label, savedAt: v.savedAt, known: v.known,
      chars: v.chars.map((c) => ({ sav: new Uint8Array(c.sav), itm: arr(c.itm), spc: arr(c.spc) })) })
  }
  return out
}

export async function writeSave(g: SavedGame) {
  await run(SAVES, 'readwrite', (s) => s.put({ dat: buf(g.dat), label: g.label, savedAt: g.savedAt, known: g.known,
    chars: g.chars.map((c) => ({ sav: buf(c.sav), itm: buf(c.itm), spc: buf(c.spc) })) }, g.slot))
}

/** The autosave (IMP-060): its own record, beside slots A–J; written on area changes and before battles. */
export async function writeAutosave(g: SavedGame) {
  await run(SAVES, 'readwrite', (s) => s.put({ dat: buf(g.dat), label: g.label, savedAt: g.savedAt, known: g.known,
    chars: g.chars.map((c) => ({ sav: buf(c.sav), itm: buf(c.itm), spc: buf(c.spc) })) }, 'auto'))
}

export async function readAutosave(): Promise<SavedGame | null> {
  const v = await run<{ dat: ArrayBuffer; chars: { sav: ArrayBuffer; itm?: ArrayBuffer; spc?: ArrayBuffer }[]; label: string; savedAt: number; known?: string[] } | undefined>(SAVES, 'readonly', (s) => s.get('auto'))
  if (!v) return null
  return { slot: 'A', dat: new Uint8Array(v.dat), label: v.label, savedAt: v.savedAt, known: v.known,
    chars: v.chars.map((c) => ({ sav: new Uint8Array(c.sav), itm: arr(c.itm), spc: arr(c.spc) })) }
}
