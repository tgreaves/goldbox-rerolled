// The player's own game files, kept in IndexedDB so the app works offline after one import.
// Each game has its own database (GameProfile.stores.files).
import { readDax, daxRecord, type Dax } from '../data/dax'
import { detect, GAMES, POR, wants, type GameProfile } from '../games/profile'

const STORE = 'files'

/** Files some game needs; anything else in the folder is ignored. */
export function wanted(name: string): boolean {
  return GAMES.some((g) => wants(g, name))
}

function openDb(game: GameProfile): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(game.stores.files, 1)
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
  /** the game these files are from */
  readonly game: GameProfile

  constructor(files: Map<string, Uint8Array>, game: GameProfile = detect(files.keys()) ?? POR) {
    this.files = files
    this.game = game
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

  /**
   * A picture record of a family in a block: from `<family><block>`, or the fixed file the game's
   * picture loaders name for it (profile `pictureFiles`; SotSB 0x596CE, 0x5D59E).
   */
  picture(family: string, block: number, id: number): Uint8Array | undefined {
    const f = this.game.pictureFiles.find((p) => p.family === family && (p.records === null || p.records.includes(id)))
    return this.record(`${family}${f ? f.digit : block}`, id)
  }

  /** True when the minimum set for play is present. */
  complete(): boolean {
    return this.game.required.every((n) => this.files.has(n))
  }

  /** True when a game's stored files are enough to start it, without reading them. */
  static async stored(game: GameProfile): Promise<boolean> {
    const db = await openDb(game)
    const keys = new Set((await tx(db, 'readonly', (s) => s.getAllKeys())) as string[])
    db.close()
    return game.required.every((n) => keys.has(n))
  }

  static async load(game: GameProfile): Promise<GameFiles> {
    const db = await openDb(game)
    const keys = (await tx(db, 'readonly', (s) => s.getAllKeys())) as string[]
    const files = new Map<string, Uint8Array>()
    for (const k of keys) files.set(k, new Uint8Array(await tx<ArrayBuffer>(db, 'readonly', (s) => s.get(k))))
    db.close()
    return new GameFiles(files, game)
  }

  /** Only some of a game's stored files (the games screen's covers read TITLE.DAX alone); null when none is stored */
  static async loadSome(game: GameProfile, names: string[]): Promise<GameFiles | null> {
    const db = await openDb(game)
    const files = new Map<string, Uint8Array>()
    for (const k of names) {
      const v = await tx<ArrayBuffer | undefined>(db, 'readonly', (s) => s.get(k))
      if (v) files.set(k, new Uint8Array(v))
    }
    db.close()
    return files.size ? new GameFiles(files, game) : null
  }

  /** Forget a game's imported files (its roster and saves are kept, in their own database). */
  static async remove(game: GameProfile): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(game.stores.files)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve() // another tab holds it open; it goes when that tab closes
    })
  }

  /** Replace a game's stored files with these. */
  static async save(game: GameProfile, files: Map<string, Uint8Array>): Promise<void> {
    const db = await openDb(game)
    await tx(db, 'readwrite', (s) => s.clear())
    for (const [name, bytes] of files) {
      await tx(db, 'readwrite', (s) => s.put(bytes.slice().buffer, name))
    }
    db.close()
    if (navigator.storage?.persist) await navigator.storage.persist()
  }
}

/**
 * Read the files chosen by the player (folder picker or multi-select): work out which game they are
 * from, then keep the ones that game uses. Subfolders are flattened (CotAB keeps its pre-made party
 * and first save in SAVE/).
 */
export async function readPicked(list: Iterable<File>): Promise<{ game?: GameProfile; files: Map<string, Uint8Array> }> {
  const all = [...list].filter((f) => wanted(f.name))
  const game = detect(all.map((f) => f.name))
  const out = new Map<string, Uint8Array>()
  if (game) for (const f of all) {
    if (wants(game, f.name)) out.set(f.name.toUpperCase(), new Uint8Array(await f.arrayBuffer()))
  }
  return { game, files: out }
}
