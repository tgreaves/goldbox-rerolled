// Automatic sync between the browser's stores and the server (spec/C-port/accounts-and-sync.md, §5 "Client sync"). The browser
// copy is always written first and stays the offline cache; this engine keeps, per game:
//   base[key]   the server version this browser last saw of each record
//   dirty[key]  when the browser changed a record the server has not taken yet (the queue)
//   seeded[key] characters copied from the game files on first run (they never beat the server's)
// Merging: a record changed on one side only takes that side; changed on both, the newer change
// wins and the other is kept as a conflict copy (saves and characters), so no save is lost.
import { ApiError, type Listed, type RecordApi, type Remote } from './api'
import { keyOf, sameRec, splitKey, type Kind, type Rec } from './records'

export interface LocalSide {
  /** every record key present in the browser ("saves/A", "characters/ALIAS", "docs/party", …) */
  keys(): Promise<string[]>
  get(key: string): Promise<Rec | null>
  put(key: string, rec: Rec): Promise<void>
  remove(key: string): Promise<void>
}

export interface SyncState {
  base: Record<string, number>
  dirty: Record<string, number>
  seeded: Record<string, 1>
  /** records the server refused (named, too large), with its reason */
  errors: Record<string, string>
  lastSync: number
  quotaFull?: boolean
}

export interface StateStore { load(): SyncState | null; save(s: SyncState): void }

export const emptyState = (): SyncState => ({ base: {}, dirty: {}, seeded: {}, errors: {}, lastSync: 0 })

/** Kinds whose losing side is kept as a conflict copy. */
const COPIED: Kind[] = ['saves', 'characters']

export interface SyncOptions {
  game: string
  api: RecordApi
  local: LocalSide
  state: StateStore
  now?: () => number
  newId?: () => string
  /** records the merge changed in the browser */
  changed?: (keys: string[]) => void
}

export class Sync {
  readonly game: string
  private readonly api: RecordApi
  private readonly local: LocalSide
  private readonly store: StateStore
  private readonly now: () => number
  private readonly newId: () => string
  private readonly onChanged: (keys: string[]) => void
  readonly state: SyncState
  private chain: Promise<unknown> = Promise.resolve()
  private touched = new Set<string>()

  constructor(o: SyncOptions) {
    this.game = o.game
    this.api = o.api
    this.local = o.local
    this.store = o.state
    this.now = o.now ?? Date.now
    this.newId = o.newId ?? (() => `c${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 6).toString(36)}`)
    this.onChanged = o.changed ?? (() => {})
    this.state = { ...emptyState(), ...(o.state.load() ?? {}) }
  }

  private save() { this.store.save(this.state) }

  /** The browser changed a record (or, with 'seed', filled it from the game files). */
  noteChange(key: string, how: 'change' | 'seed' = 'change') {
    const s = this.state
    if (how === 'seed') {
      if (!(key in s.base) && s.dirty[key] === undefined) s.seeded[key] = 1
    } else {
      s.dirty[key] = Math.max(this.now(), (s.dirty[key] ?? 0) + 1)
      delete s.seeded[key]
      delete s.errors[key]
    }
    this.save()
  }

  pending(): number { return Object.keys(this.state.dirty).length }

  /** One operation at a time. */
  private run<T>(f: () => Promise<T>): Promise<T> {
    const next = this.chain.then(f, f)
    this.chain = next.catch(() => {})
    return next
  }

  private report() {
    if (!this.touched.size) return
    const keys = [...this.touched]
    this.touched.clear()
    this.onChanged(keys)
  }

  private clean(key: string, stamp: number | undefined) {
    if (this.state.dirty[key] === stamp) delete this.state.dirty[key]
  }

  /** Send every queued change. Throws when the server cannot be reached (the queue stays). */
  flush(): Promise<void> {
    return this.run(async () => {
      try {
        this.state.quotaFull = false
        const done = new Set<string>()
        // a second pass sends the conflict copies the first one made
        for (let pass = 0; pass < 2; pass++) {
          for (const key of Object.keys(this.state.dirty)) {
            if (this.state.quotaFull || done.has(key)) continue
            done.add(key)
            await this.pushKey(key)
          }
        }
      } finally { this.save(); this.report() }
    })
  }

  /** Fetch the server's records and merge them with the browser's, then send what is left. */
  pull(): Promise<void> {
    return this.run(async () => {
      try {
        const s = this.state
        s.quotaFull = false
        const server = new Map((await this.api.list(this.game)).map((l) => [keyOf(l.kind, l.id), l]))
        const keys = new Set([...(await this.local.keys()), ...server.keys(), ...Object.keys(s.dirty), ...Object.keys(s.base)])
        for (const key of keys) {
          await this.mergeKey(key, server.get(key))
          this.save()
        }
        for (const key of Object.keys(s.dirty)) {
          if (s.quotaFull) break
          await this.pushKey(key)
        }
        s.lastSync = this.now()
      } finally { this.save(); this.report() }
    })
  }

  private async mergeKey(key: string, S: Listed | undefined) {
    const s = this.state
    const L = await this.local.get(key)
    if (L && s.dirty[key] === undefined && !(key in s.base)) {
      // in the browser, never synced: data from before signing in (or the first-run seed)
      if (s.seeded[key]) {
        delete s.seeded[key]
        if (S) return this.download(key, S, undefined)
        s.dirty[key] = 0
      } else s.dirty[key] = intrinsicTime(L)
    }
    delete s.seeded[key]
    const d = s.dirty[key], b = s.base[key]
    if (S) {
      if (d === undefined) { if (b !== S.updatedAt || !L) await this.download(key, S, undefined) }
      else if (b === S.updatedAt) await this.pushKey(key)
      else await this.guard(key, () => this.resolve(key, L, d))
    } else if (L) {
      if (d === undefined && b !== undefined) {
        // deleted on another device
        await this.local.remove(key)
        delete s.base[key]
        this.touched.add(key)
      } else {
        delete s.base[key]
        if (s.dirty[key] === undefined) s.dirty[key] = intrinsicTime(L)
        await this.pushKey(key)
      }
    } else {
      delete s.base[key]
      delete s.dirty[key]
    }
  }

  private async download(key: string, S: Listed, stamp: number | undefined) {
    const [kind, id] = splitKey(key)
    const R: Remote | null = kind === 'docs' ? { updatedAt: S.updatedAt, meta: S.meta, files: [] } : await this.api.get(this.game, kind, id)
    if (!R) return
    if (this.state.dirty[key] !== stamp) return // changed in the browser meanwhile: the next flush decides
    await this.local.put(key, R)
    this.state.base[key] = R.updatedAt
    this.touched.add(key)
  }

  /** Record-level refusals are noted and dropped from the queue; a full quota stops the pass. */
  private async guard(key: string, f: () => Promise<void>) {
    try {
      await f()
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      if (e.recordProblem) { this.state.errors[key] = e.message; delete this.state.dirty[key] }
      else if (e.quota) { this.state.quotaFull = true; this.state.errors[key] = e.message }
      else throw e
    }
  }

  private pushKey(key: string): Promise<void> {
    return this.guard(key, async () => {
      const s = this.state
      const stamp = s.dirty[key]
      if (stamp === undefined) return
      const [kind, id] = splitKey(key)
      const local = await this.local.get(key)
      const base = s.base[key] ?? 0
      if (local) {
        const r = await this.api.put(this.game, kind, id, base, { meta: { ...local.meta, modifiedAt: stamp }, files: local.files })
        if (r.ok) { s.base[key] = r.updatedAt; this.clean(key, stamp); delete s.errors[key] }
        else await this.resolve(key, local, stamp)
      } else {
        if (!(key in s.base)) { this.clean(key, stamp); return } // never reached the server
        const r = await this.api.remove(this.game, kind, id, base)
        if (r.ok) { delete s.base[key]; this.clean(key, stamp) }
        else await this.resolve(key, null, stamp)
      }
    })
  }

  /** Both sides changed: the newer change wins; the other is kept as a conflict copy. */
  private async resolve(key: string, local: Rec | null, stamp: number) {
    const s = this.state
    const [kind, id] = splitKey(key)
    const R = await this.api.get(this.game, kind, id)
    if (!R) {
      delete s.base[key]
      if (!local) { this.clean(key, stamp); return }
      const r = await this.api.put(this.game, kind, id, 0, { meta: { ...local.meta, modifiedAt: stamp }, files: local.files })
      if (r.ok) { s.base[key] = r.updatedAt; this.clean(key, stamp) }
      return
    }
    if (local && sameRec(local, R)) { s.base[key] = R.updatedAt; this.clean(key, stamp); return }
    if (!local) { await this.take(key, R, stamp); return } // a change beats a deletion
    const localWins = stamp > Number(R.meta.modifiedAt ?? 0)
    if (COPIED.includes(kind)) {
      const loser = localWins ? R : local
      const cid = this.newId()
      const ck = keyOf('conflicts', cid)
      await this.local.put(ck, { meta: { ...loser.meta, conflictOf: kind, conflictId: id, from: localWins ? 'server' : 'browser', keptAt: this.now(),
        modifiedAt: localWins ? Number(R.meta.modifiedAt ?? 0) : stamp }, files: loser.files })
      s.dirty[ck] = this.now()
      this.touched.add(ck)
    }
    if (localWins) {
      const r = await this.api.put(this.game, kind, id, R.updatedAt, { meta: { ...local.meta, modifiedAt: stamp }, files: local.files })
      if (r.ok) { s.base[key] = r.updatedAt; this.clean(key, stamp) }
    } else await this.take(key, R, stamp)
  }

  private async take(key: string, R: Remote, stamp: number) {
    if (this.state.dirty[key] !== stamp) return
    await this.local.put(key, R)
    this.state.base[key] = R.updatedAt
    this.clean(key, stamp)
    this.touched.add(key)
  }

  /** Forget everything about the server (another account, or the browser's data removed). */
  reset() {
    Object.assign(this.state, emptyState())
    this.save()
  }
}

/** How old a record is when the browser has no change time for it. */
function intrinsicTime(r: Rec): number {
  const t = Number(r.meta.savedAt ?? r.meta.modifiedAt ?? 0)
  return Number.isFinite(t) ? t : 0
}
