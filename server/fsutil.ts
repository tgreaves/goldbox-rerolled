// File helpers: atomic writes (temp file, fsync, rename), a per-key write lock, and disk errors
// turned into one clear error the API reports without detail.
import { open, rename, rm, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'

/** A storage failure the client should see as "the server could not store it" (disk full, I/O). */
export class StorageError extends Error {
  readonly code: string
  constructor(code: string) {
    super(`storage: ${code}`)
    this.code = code
  }
}

const DISK = new Set(['ENOSPC', 'EDQUOT', 'EIO', 'EROFS', 'EMFILE', 'ENFILE'])

export function wrapDisk(e: unknown): never {
  const code = (e as NodeJS.ErrnoException)?.code
  if (code && DISK.has(code)) throw new StorageError(code)
  throw e
}

/** Write a file so readers see the old content or the new, never a part: temp file, fsync, rename. */
export async function writeAtomic(path: string, data: Uint8Array | string, mode = 0o600): Promise<void> {
  const tmp = join(dirname(path), `.tmp-${randomBytes(6).toString('hex')}`)
  try {
    const fh = await open(tmp, 'wx', mode)
    try {
      await fh.writeFile(data)
      await fh.sync()
    } finally {
      await fh.close()
    }
    await rename(tmp, path)
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {})
    wrapDisk(e)
  }
}

export async function ensureDir(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true, mode: 0o700 })
  } catch (e) {
    wrapDisk(e)
  }
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export async function listDir(path: string): Promise<string[]> {
  try {
    return await readdir(path)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

/** Total size in bytes of the files under a directory. */
export async function duSize(path: string): Promise<number> {
  let total = 0
  let entries
  try {
    entries = await readdir(path, { withFileTypes: true })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 0
    throw e
  }
  for (const e of entries) {
    const p = join(path, e.name)
    if (e.isDirectory()) total += await duSize(p)
    else if (e.isFile()) total += (await stat(p)).size
  }
  return total
}

/** Serialise async work per key (one user's writes run one after another). */
export class KeyedLock {
  private tails = new Map<string, Promise<unknown>>()
  run<T>(key: string, f: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve()
    const next = prev.then(f, f)
    const tail = next.catch(() => {})
    this.tails.set(key, tail)
    void tail.then(() => { if (this.tails.get(key) === tail) this.tails.delete(key) })
    return next
  }
}
