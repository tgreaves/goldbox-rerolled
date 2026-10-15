// The player's own data: the character roster (as original CHRDAT files) and the current party.
// Kept in IndexedDB, separate from the imported game files.
import type { GameFiles } from './gamefiles'

const DB = 'poolrad-user'
const CHARS = 'characters'
const META = 'meta'

export interface StoredCharacter {
  /** file stem as the original names it, e.g. CHRDATA1 */
  stem: string
  sav: Uint8Array
  itm?: Uint8Array
  spc?: Uint8Array
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(CHARS)
      req.result.createObjectStore(META)
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
    await saveCharacter({ stem: m[1], sav: files.get(name)!, itm: files.get(`${m[1]}.ITM`), spc: files.get(`${m[1]}.SPC`) })
  }
  await run(META, 'readwrite', (s) => s.put(true, 'seeded'))
}
