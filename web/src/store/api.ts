// The server's API (spec/C-port/accounts-and-sync.md §2) as seen from the browser. The fetch function is
// injectable so tests can run it against a real server in Node.
import { fromBase64, toBase64, type Kind, type Rec } from './records'

export class ApiError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : `server error ${status}`)
    this.status = status
    this.body = body
  }
  /** a problem with this one record (refused, too large), not with the connection */
  get recordProblem() { return this.status === 400 || this.status === 413 }
  get quota() { return this.status === 507 }
  get signedOut() { return this.status === 401 }
}

export interface ServerConfig { server: 'goldbox-rerolled'; api: number; signup: 'open' | 'invite' | 'off'; passwordMin: number; quota: number }
export interface Me extends ServerConfig { user: string | null; used?: number }
export interface Listed { kind: Kind; id: string; updatedAt: number; meta: Record<string, unknown> }
export interface Remote extends Rec { updatedAt: number }
export type PutResult = { ok: true; updatedAt: number } | { ok: false; conflict: number }

/** What the sync engine needs from the server. */
export interface RecordApi {
  list(game: string): Promise<Listed[]>
  get(game: string, kind: Kind, id: string): Promise<Remote | null>
  put(game: string, kind: Kind, id: string, base: number, rec: Rec): Promise<PutResult>
  remove(game: string, kind: Kind, id: string, base: number): Promise<PutResult>
}

export class HttpApi implements RecordApi {
  readonly base: string
  private readonly fetcher: typeof fetch
  constructor(base: string, fetcher: typeof fetch = (...a) => fetch(...a)) {
    this.base = base.endsWith('/') ? base : `${base}/`
    this.fetcher = fetcher
  }

  async call<T = Record<string, unknown>>(method: string, path: string, body?: unknown, ok: number[] = []): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = { 'X-GoldBox': '1' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const r = await this.fetcher(this.base + path, { method, headers, credentials: 'same-origin', cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body) })
    const type = r.headers.get('content-type') ?? ''
    const data = (type.includes('application/json') ? await r.json() : {}) as Record<string, unknown>
    if (!r.ok && !ok.includes(r.status)) throw new ApiError(r.status, data)
    return { status: r.status, data: data as T }
  }

  /** The server's settings and who is signed in; null when no GoldBox server answers here. */
  async me(): Promise<Me | null> {
    const r = await this.fetcher(this.base + 'me', { credentials: 'same-origin', cache: 'no-store' })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return null
    const v = (await r.json()) as Me
    return v && v.server === 'goldbox-rerolled' && v.api === 1 ? v : null
  }

  async list(game: string): Promise<Listed[]> {
    return (await this.call<{ records: Listed[] }>('GET', `games/${game}`)).data.records
  }

  async get(game: string, kind: Kind, id: string): Promise<Remote | null> {
    const r = await this.call<{ updatedAt: number; meta: Record<string, unknown>; files: { name: string; data: string }[] }>('GET', `games/${game}/${kind}/${encodeURIComponent(id)}`, undefined, [404])
    if (r.status === 404) return null
    return { updatedAt: r.data.updatedAt, meta: r.data.meta, files: r.data.files.map((f) => ({ name: f.name, data: fromBase64(f.data) })) }
  }

  async put(game: string, kind: Kind, id: string, base: number, rec: Rec): Promise<PutResult> {
    const r = await this.call<{ updatedAt: number }>('PUT', `games/${game}/${kind}/${encodeURIComponent(id)}`,
      { base, meta: rec.meta, files: rec.files.map((f) => ({ name: f.name, data: toBase64(f.data) })) }, [409])
    return r.status === 409 ? { ok: false, conflict: r.data.updatedAt } : { ok: true, updatedAt: r.data.updatedAt }
  }

  async remove(game: string, kind: Kind, id: string, base: number): Promise<PutResult> {
    const r = await this.call<{ updatedAt: number }>('DELETE', `games/${game}/${kind}/${encodeURIComponent(id)}?base=${base}`, undefined, [409])
    return r.status === 409 ? { ok: false, conflict: r.data.updatedAt } : { ok: true, updatedAt: 0 }
  }
}
