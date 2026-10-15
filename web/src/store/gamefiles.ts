// The player's own game files, kept in IndexedDB so the app works offline after one import.
import { readDax, daxRecord, type Dax } from '../data/dax'

const DB = 'poolrad'
const STORE = 'files'

/** Files the port needs; anything else in the folder is ignored. */
export function wanted(name: string): boolean {
  const n = name.toUpperCase()
  return n.endsWith('.DAX') || n === 'ITEMS' || n === 'START.EXE' || /^CHRDAT.+\.(SAV|ITM|SPC)$/.test(n) || /^SAVGAM.\.DAT$/.test(n)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = f(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export class GameFiles {
  private daxCache = new Map<string, Dax>()
  readonly files: Map<string, Uint8Array>

  constructor(files: Map<string, Uint8Array>) {
    this.files = files
  }

  get(name: string): Uint8Array | undefined {
    return this.files.get(name.toUpperCase())
  }

  names(): string[] {
    return [...this.files.keys()].sort()
  }

  dax(name: string): Dax | undefined {
    const key = name.toUpperCase().replace(/\.DAX$/, '') + '.DAX'
    let d = this.daxCache.get(key)
    if (!d) {
      const bytes = this.files.get(key)
      if (!bytes) return undefined
      d = readDax(bytes)
      this.daxCache.set(key, d)
    }
    return d
  }

  record(name: string, id: number): Uint8Array | undefined {
    const d = this.dax(name)
    return d && daxRecord(d, id)
  }

  /** True when the minimum set for play is present. */
  complete(): boolean {
    return ['ECL1.DAX', 'GEO1.DAX', '8X8D1.DAX', 'WALLDEF1.DAX'].every((n) => this.files.has(n))
  }

  static async load(): Promise<GameFiles> {
    const db = await openDb()
    const keys = (await tx(db, 'readonly', (s) => s.getAllKeys())) as string[]
    const files = new Map<string, Uint8Array>()
    for (const k of keys) files.set(k, new Uint8Array(await tx<ArrayBuffer>(db, 'readonly', (s) => s.get(k))))
    db.close()
    return new GameFiles(files)
  }

  static async save(files: Map<string, Uint8Array>): Promise<void> {
    const db = await openDb()
    await tx(db, 'readwrite', (s) => s.clear())
    for (const [name, bytes] of files) {
      await tx(db, 'readwrite', (s) => s.put(bytes.slice().buffer, name))
    }
    db.close()
    if (navigator.storage?.persist) await navigator.storage.persist()
  }
}

/** Read the files chosen by the player (folder picker or multi-select), keeping the wanted ones. */
export async function readPicked(list: Iterable<File>): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>()
  for (const f of list) {
    if (wanted(f.name)) out.set(f.name.toUpperCase(), new Uint8Array(await f.arrayBuffer()))
  }
  return out
}
