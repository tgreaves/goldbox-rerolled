// Players' data on disk (spec/C-port/accounts-and-sync.md §4). Nothing here knows a game: records are
// keyed by the game profile's id and hold the files the client names, in the game's own formats.
//
//   users/<name>/<game>/saves/<slot>.json            pointer: version, metadata, file names
//   users/<name>/<game>/saves/<slot>@<version>/      SAVGAMx.DAT, CHRDATxn.SAV/… , SAVGAMx.GBR
//   users/<name>/<game>/characters/<stem>.json, <stem>@<version>/
//   users/<name>/<game>/conflicts/<id>.json, <id>@<version>/
//   users/<name>/<game>/party.json, settings.json   (documents: metadata only)
//
// A record is replaced by writing its files into a new version directory, then the pointer
// (atomically), then deleting the old directory: a reader sees the old record or the new one.
import { rename, rm, readFile, mkdir, stat } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { KeyedLock, duSize, ensureDir, listDir, readJson, writeAtomic, wrapDisk } from './fsutil.ts'

export const GAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/
/** DOS file-name characters (no dot, slash, backslash, space, wildcard or quote) */
const STEM = "[A-Z0-9!#$%&'()+=@^_`{}~\\-\\[\\]]{1,8}"
export const FILE_RE = new RegExp(`^${STEM}\\.[A-Z0-9]{1,3}$`)
export const KINDS = {
  saves: /^(?:[A-J]|AUTO)$/,
  characters: new RegExp(`^${STEM}$`),
  conflicts: /^[a-z0-9]{1,40}$/,
  docs: /^(?:party|settings)$/,
} as const
export type Kind = keyof typeof KINDS
export const isKind = (k: string): k is Kind => Object.hasOwn(KINDS, k)

export const LIMITS = { files: 64, fileBytes: 1024 * 1024, metaBytes: 16 * 1024, records: 500, games: 32 }

export type Meta = Record<string, unknown>
export interface RecordFile { name: string; data: Uint8Array }
export interface Listed { kind: Kind; id: string; updatedAt: number; meta: Meta }
export interface Full extends Listed { files: RecordFile[] }

interface Pointer { updatedAt: number; meta: Meta; dir?: string; files: string[] }

export type PutResult =
  | { ok: true; updatedAt: number }
  | { ok: false; reason: 'conflict'; updatedAt: number }
  | { ok: false; reason: 'quota'; used: number; quota: number }
  | { ok: false; reason: 'gone' }
  | { ok: false; reason: 'limit' }

export class Storage {
  private lock = new KeyedLock()
  private usage = new Map<string, number>()
  readonly usersDir: string
  readonly quota: number

  constructor(usersDir: string, quota: number) {
    this.usersDir = usersDir
    this.quota = quota
  }

  private gameDir(user: string, game: string) { return join(this.usersDir, user, game) }
  private kindDir(user: string, game: string, kind: Kind) {
    return kind === 'docs' ? this.gameDir(user, game) : join(this.gameDir(user, game), kind)
  }

  /** Bytes used by a user's data (cached; worked out once from the disk). */
  async used(user: string): Promise<number> {
    let u = this.usage.get(user)
    if (u === undefined) {
      u = 0
      for (const g of await listDir(join(this.usersDir, user))) if (GAME_RE.test(g)) u += await duSize(join(this.usersDir, user, g))
      this.usage.set(user, u)
    }
    return u
  }
  forget(user: string) { this.usage.delete(user) }

  private async readPointer(user: string, game: string, kind: Kind, id: string): Promise<Pointer | null> {
    return readJson<Pointer>(join(this.kindDir(user, game, kind), `${id}.json`))
  }

  async list(user: string, game: string): Promise<Listed[]> {
    const out: Listed[] = []
    for (const kind of Object.keys(KINDS) as Kind[]) {
      for (const n of await listDir(this.kindDir(user, game, kind))) {
        if (!n.endsWith('.json')) continue
        const id = n.slice(0, -5)
        if (!KINDS[kind].test(id)) continue
        const p = await this.readPointer(user, game, kind, id)
        if (p) out.push({ kind, id, updatedAt: p.updatedAt, meta: p.meta })
      }
    }
    return out
  }

  async games(user: string): Promise<string[]> {
    return (await listDir(join(this.usersDir, user))).filter((g) => GAME_RE.test(g)).sort()
  }

  async get(user: string, game: string, kind: Kind, id: string): Promise<Full | null> {
    const p = await this.readPointer(user, game, kind, id)
    if (!p) return null
    const files: RecordFile[] = []
    for (const name of p.files) {
      try {
        files.push({ name, data: new Uint8Array(await readFile(join(this.kindDir(user, game, kind), p.dir!, name))) })
      } catch {
        return null // replaced between reading the pointer and the files: the client asks again
      }
    }
    return { kind, id, updatedAt: p.updatedAt, meta: p.meta, files }
  }

  /** Replace a record if its version is still `base` (0: it must not exist yet). */
  put(user: string, game: string, kind: Kind, id: string, base: number, meta: Meta, files: RecordFile[]): Promise<PutResult> {
    return this.lock.run(user, async () => {
      const dir = this.kindDir(user, game, kind)
      const cur = await this.readPointer(user, game, kind, id)
      const curVer = cur?.updatedAt ?? 0
      if (base !== curVer) return { ok: false, reason: 'conflict', updatedAt: curVer }
      // the account may have been deleted since the request was checked: never recreate its folder
      if (!(await stat(join(this.usersDir, user, 'account.json')).then(() => true, () => false))) return { ok: false, reason: 'gone' }
      if (!cur) {
        if (kind !== 'docs' && (await listDir(dir)).filter((n) => n.endsWith('.json')).length >= LIMITS.records) return { ok: false, reason: 'limit' }
        const games = await this.games(user)
        if (!games.includes(game) && games.length >= LIMITS.games) return { ok: false, reason: 'limit' }
      }
      const updatedAt = Math.max(Date.now(), curVer + 1)
      const p: Pointer = { updatedAt, meta, files: files.map((f) => f.name) }
      if (kind !== 'docs') p.dir = `${id}@${updatedAt}`
      const oldSize = cur ? await this.recordSize(dir, id, cur) : 0
      const newSize = files.reduce((a, f) => a + f.data.length, 0) + Buffer.byteLength(JSON.stringify(p))
      const used = await this.used(user)
      if (used - oldSize + newSize > this.quota) return { ok: false, reason: 'quota', used, quota: this.quota }

      await ensureDir(dir)
      if (p.dir) {
        const tmp = join(dir, `.${p.dir}.tmp-${randomBytes(4).toString('hex')}`)
        try {
          await mkdir(tmp, { mode: 0o700 })
          for (const f of files) await writeAtomic(join(tmp, f.name), f.data)
          await rename(tmp, join(dir, p.dir))
        } catch (e) {
          await rm(tmp, { recursive: true, force: true }).catch(() => {})
          wrapDisk(e)
        }
      }
      try {
        await writeAtomic(join(dir, `${id}.json`), JSON.stringify(p))
      } catch (e) {
        if (p.dir) await rm(join(dir, p.dir), { recursive: true, force: true }).catch(() => {})
        throw e
      }
      if (cur?.dir && cur.dir !== p.dir) await rm(join(dir, cur.dir), { recursive: true, force: true }).catch(() => {})
      this.usage.set(user, used - oldSize + newSize)
      return { ok: true, updatedAt }
    })
  }

  /** Delete a record if its version is still `base` (deleting what is not there succeeds). */
  remove(user: string, game: string, kind: Kind, id: string, base: number): Promise<{ ok: true } | { ok: false; updatedAt: number }> {
    return this.lock.run(user, async () => {
      const dir = this.kindDir(user, game, kind)
      const cur = await this.readPointer(user, game, kind, id)
      if (!cur) return { ok: true }
      if (cur.updatedAt !== base) return { ok: false, updatedAt: cur.updatedAt }
      const size = await this.recordSize(dir, id, cur)
      await rm(join(dir, `${id}.json`), { force: true })
      if (cur.dir) await rm(join(dir, cur.dir), { recursive: true, force: true }).catch(() => {})
      const used = this.usage.get(user)
      if (used !== undefined) this.usage.set(user, Math.max(0, used - size))
      return { ok: true }
    })
  }

  /** Bytes a record takes: its files and its pointer, as the disk total counts them. */
  private async recordSize(dir: string, id: string, p: Pointer): Promise<number> {
    const pointer = await stat(join(dir, `${id}.json`)).then((s) => s.size, () => 0)
    return pointer + (p.dir ? await duSize(join(dir, p.dir)) : 0)
  }
}
