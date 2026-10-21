// The HTTP server: the built app and the JSON API under /api/v1/ (spec/C-port/accounts-and-sync.md §2).
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { stat } from 'node:fs/promises'
import type { Config } from './config.ts'
import { Accounts, Limiter, normaliseCode, normaliseName, passwordProblem, reservedName, PASSWORD_MIN, type Account } from './accounts.ts'
import { FILE_RE, GAME_RE, KINDS, LIMITS, Storage, isKind, type Meta, type RecordFile } from './storage.ts'
import { StorageError } from './fsutil.ts'
import { securityHeaders, serveStatic } from './static.ts'
import { zip } from './zip.ts'

export const API = '/api/v1/'
const SMALL_BODY = 8 * 1024
/** a record: up to 64 files of 1 MB, base64 (4/3) plus JSON */
const RECORD_BODY = 8 * 1024 * 1024
const MINUTE = 60_000

class HttpError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>
  constructor(status: number, error: string, extra: Record<string, unknown> = {}) {
    super(error)
    this.status = status
    this.body = { error, ...extra }
  }
}

export interface App {
  server: Server
  accounts: Accounts
  storage: Storage
  listen(port?: number, host?: string): Promise<number>
  close(): Promise<void>
}

export async function createApp(config: Config): Promise<App> {
  const accounts = new Accounts(config.dataDir, { scryptN: config.scryptN, sessionTtl: config.sessionTtl, maxUsers: config.maxUsers })
  await accounts.init()
  const storage = new Storage(accounts.usersDir, config.quota)
  const cookieName = config.cookieSecure ? '__Host-gbr_session' : 'gbr_session'

  // memory-only counters (spec/C-port/accounts-and-sync.md §3.6)
  const limits = {
    loginIp: new Limiter(20, 15 * MINUTE),
    loginUser: new Limiter(10, 15 * MINUTE),
    signupIp: new Limiter(5, 60 * MINUTE),
    recoverIp: new Limiter(10, 15 * MINUTE),
    recoverUser: new Limiter(5, 15 * MINUTE),
    reauthUser: new Limiter(10, 15 * MINUTE),
  }

  const publicConfig = () => ({ server: 'goldbox-rerolled', api: 1, signup: config.signup, passwordMin: PASSWORD_MIN, quota: config.quota })

  function clientIp(req: IncomingMessage): string {
    if (config.trustProxy) {
      // one reverse proxy in front: the address it appended is the last one
      const xff = req.headers['x-forwarded-for']
      const last = (Array.isArray(xff) ? xff.join(',') : xff ?? '').split(',').map((s) => s.trim()).filter(Boolean).pop()
      if (last) return last
    }
    return req.socket.remoteAddress ?? '?'
  }

  function cookieToken(req: IncomingMessage): string | undefined {
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const i = part.indexOf('=')
      if (i > 0 && part.slice(0, i).trim() === cookieName) return part.slice(i + 1).trim()
    }
    return undefined
  }

  function setCookie(res: ServerResponse, token: string | null) {
    const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', ...(config.cookieSecure ? ['Secure'] : [])]
    res.setHeader('Set-Cookie', token
      ? `${cookieName}=${token}; ${attrs.join('; ')}; Max-Age=${Math.floor(config.sessionTtl / 1000)}`
      : `${cookieName}=; ${attrs.join('; ')}; Max-Age=0`)
  }

  function send(res: ServerResponse, status: number, body: unknown) {
    const text = JSON.stringify(body)
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text) })
    res.end(text)
  }

  async function readBody(req: IncomingMessage, limit: number): Promise<Record<string, unknown>> {
    const type = req.headers['content-type'] ?? ''
    if (!/^application\/json\s*(;|$)/i.test(type)) throw new HttpError(415, 'JSON expected')
    const declared = Number(req.headers['content-length'] ?? 0)
    if (declared > limit) throw new HttpError(413, 'too large')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += (chunk as Buffer).length
      if (size > limit) throw new HttpError(413, 'too large')
      chunks.push(chunk as Buffer)
    }
    let v: unknown
    try { v = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HttpError(400, 'bad request') }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'bad request')
    return v as Record<string, unknown>
  }

  function limited(l: Limiter, key: string) {
    const wait = l.blocked(key)
    if (wait) throw new HttpError(429, 'too many attempts; try again later', { retryAfter: wait })
  }

  async function signIn(res: ServerResponse, req: IncomingMessage, acc: Account) {
    await accounts.endSession(cookieToken(req)) // a fresh session id on every sign-in
    setCookie(res, await accounts.createSession(acc))
  }

  async function requireUser(req: IncomingMessage, res: ServerResponse): Promise<Account> {
    const token = cookieToken(req)
    const acc = await accounts.session(token, () => setCookie(res, token!)) // renewed: the cookie too
    if (!acc) throw new HttpError(401, 'signed out')
    return acc
  }

  /** Re-entered password for account changes (password, deletion, new recovery code). */
  async function reauth(acc: Account, pw: unknown) {
    limited(limits.reauthUser, acc.name)
    if (typeof pw !== 'string' || !(await accounts.checkPassword(acc.name, pw))) {
      limits.reauthUser.hit(acc.name)
      throw new HttpError(403, 'wrong password')
    }
  }

  function decodeFiles(raw: unknown): RecordFile[] {
    if (!Array.isArray(raw) || raw.length > LIMITS.files) throw new HttpError(400, 'bad request')
    const seen = new Set<string>()
    return raw.map((f) => {
      const { name, data } = (f ?? {}) as { name?: unknown; data?: unknown }
      if (typeof name !== 'string' || !FILE_RE.test(name) || seen.has(name)) throw new HttpError(400, 'bad file name')
      seen.add(name)
      if (typeof data !== 'string' || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new HttpError(400, 'bad request')
      const bytes = new Uint8Array(Buffer.from(data, 'base64'))
      if (bytes.length > LIMITS.fileBytes) throw new HttpError(413, 'too large')
      return { name, data: bytes }
    })
  }

  // ---------------------------------------------------------------- routes

  async function api(req: IncomingMessage, res: ServerResponse, path: string, query: URLSearchParams) {
    const method = req.method ?? 'GET'
    const write = method !== 'GET' && method !== 'HEAD'
    // CSRF: other sites cannot send a custom header without a CORS preflight, which is never granted
    if (write && req.headers['x-goldbox'] !== '1') throw new HttpError(403, 'missing X-GoldBox header')
    const seg = path.split('/')

    if (path === 'health' && method === 'GET') {
      const ok = await stat(config.dataDir).then((s) => s.isDirectory(), () => false)
      return send(res, ok ? 200 : 503, { ok })
    }
    if (path === 'config' && method === 'GET') return send(res, 200, publicConfig())
    if (path === 'me' && method === 'GET') {
      const token = cookieToken(req)
      const acc = await accounts.session(token, () => setCookie(res, token!))
      return send(res, 200, { ...publicConfig(), user: acc?.name ?? null, used: acc ? await storage.used(acc.name) : undefined })
    }
    if (path === 'login' && method === 'POST') {
      const body = await readBody(req, SMALL_BODY)
      const ip = clientIp(req)
      const name = normaliseName(body.user)
      limited(limits.loginIp, ip)
      if (name) limited(limits.loginUser, name)
      const acc = typeof body.password === 'string' ? await accounts.checkPassword(name, body.password) : null
      if (!acc) {
        limits.loginIp.hit(ip)
        if (name) limits.loginUser.hit(name)
        throw new HttpError(401, 'wrong name or password')
      }
      if (acc.disabled) throw new HttpError(403, 'this account is locked')
      limits.loginUser.reset(acc.name)
      await signIn(res, req, acc)
      return send(res, 200, { user: acc.name })
    }
    if (path === 'logout' && method === 'POST') {
      await accounts.endSession(cookieToken(req))
      setCookie(res, null)
      return send(res, 200, { user: null })
    }
    if (path === 'signup' && method === 'POST') {
      if (config.signup === 'off') throw new HttpError(403, 'sign-up is closed')
      const body = await readBody(req, SMALL_BODY)
      const ip = clientIp(req)
      limited(limits.signupIp, ip)
      limits.signupIp.hit(ip)
      const name = normaliseName(body.user)
      if (!name) throw new HttpError(400, 'names are 3 to 24 letters, digits, - or _')
      if (reservedName(name)) throw new HttpError(400, 'that name is reserved')
      const problem = passwordProblem(body.password)
      if (problem) throw new HttpError(400, problem)
      if (config.signup === 'invite' && typeof body.invite !== 'string') throw new HttpError(403, 'an invite code is needed')
      if (await accounts.get(name)) throw new HttpError(409, 'that name is taken')
      if ((await accounts.count()) >= config.maxUsers) throw new HttpError(503, 'no new accounts can be made at the moment')
      if (config.signup === 'invite' && !(await accounts.takeInvite(body.invite))) throw new HttpError(403, 'that invite code is not valid')
      const made = await accounts.create(name, body.password as string)
      if (!made.ok) {
        throw made.reason === 'exists' ? new HttpError(409, 'that name is taken') : new HttpError(503, 'no new accounts can be made at the moment')
      }
      await signIn(res, req, (await accounts.get(name))!)
      return send(res, 200, { user: name, recoveryCode: made.recoveryCode })
    }
    if (path === 'recover' && method === 'POST') {
      const body = await readBody(req, SMALL_BODY)
      const ip = clientIp(req)
      const name = normaliseName(body.user)
      limited(limits.recoverIp, ip)
      if (name) limited(limits.recoverUser, name)
      const problem = passwordProblem(body.newPassword)
      if (problem) throw new HttpError(400, problem)
      const acc = await accounts.checkRecovery(name, normaliseCode(body.code))
      if (!acc) {
        limits.recoverIp.hit(ip)
        if (name) limits.recoverUser.hit(name)
        throw new HttpError(401, 'wrong name or recovery code')
      }
      if (acc.disabled) throw new HttpError(403, 'this account is locked')
      await accounts.setPassword(acc.name, body.newPassword as string) // every session ends
      const code = await accounts.newRecovery(acc.name)
      await signIn(res, req, (await accounts.get(acc.name))!)
      return send(res, 200, { user: acc.name, recoveryCode: code })
    }
    if (path === 'password' && method === 'POST') {
      const acc = await requireUser(req, res)
      const body = await readBody(req, SMALL_BODY)
      const problem = passwordProblem(body.newPassword)
      if (problem) throw new HttpError(400, problem)
      await reauth(acc, body.password)
      await accounts.setPassword(acc.name, body.newPassword as string) // signs out everywhere
      await signIn(res, req, (await accounts.get(acc.name))!)
      return send(res, 200, { user: acc.name })
    }
    if (path === 'recovery-code' && method === 'POST') {
      const acc = await requireUser(req, res)
      const body = await readBody(req, SMALL_BODY)
      await reauth(acc, body.password)
      return send(res, 200, { recoveryCode: await accounts.newRecovery(acc.name) })
    }
    if (path === 'delete-account' && method === 'POST') {
      const acc = await requireUser(req, res)
      const body = await readBody(req, SMALL_BODY)
      await reauth(acc, body.password)
      await accounts.remove(acc.name)
      storage.forget(acc.name)
      setCookie(res, null)
      return send(res, 200, { user: null, deleted: true })
    }
    if (path === 'export' && method === 'GET') {
      const acc = await requireUser(req, res)
      const body = await exportZip(acc.name)
      const day = new Date().toISOString().slice(0, 10)
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Cache-Control': 'no-store', 'Content-Length': body.length,
        'Content-Disposition': `attachment; filename="goldbox-rerolled-${acc.name}-${day}.zip"` })
      return res.end(body)
    }
    if (seg[0] === 'games' && seg.length === 2 && method === 'GET') {
      const acc = await requireUser(req, res)
      const game = seg[1]
      if (!GAME_RE.test(game)) throw new HttpError(400, 'bad request')
      return send(res, 200, { records: await storage.list(acc.name, game) })
    }
    if (seg[0] === 'games' && seg.length === 4) {
      const acc = await requireUser(req, res)
      const [, game, kind] = seg
      let id: string
      try { id = decodeURIComponent(seg[3]) } catch { throw new HttpError(400, 'bad request') }
      if (!GAME_RE.test(game) || !isKind(kind) || !KINDS[kind].test(id)) throw new HttpError(400, 'bad request')
      if (method === 'GET') {
        const r = await storage.get(acc.name, game, kind, id)
        if (!r) throw new HttpError(404, 'not found')
        return send(res, 200, { ...r, files: r.files.map((f) => ({ name: f.name, data: Buffer.from(f.data).toString('base64') })) })
      }
      if (method === 'PUT') {
        const body = await readBody(req, RECORD_BODY)
        const base = body.base
        if (typeof base !== 'number' || !Number.isSafeInteger(base) || base < 0) throw new HttpError(400, 'bad request')
        const meta = body.meta
        if (!meta || typeof meta !== 'object' || Array.isArray(meta) || JSON.stringify(meta).length > LIMITS.metaBytes) throw new HttpError(400, 'bad request')
        const files = decodeFiles(body.files ?? [])
        if (kind === 'docs' && files.length) throw new HttpError(400, 'bad request')
        const r = await storage.put(acc.name, game, kind, id, base, meta as Meta, files)
        if (r.ok) return send(res, 200, { updatedAt: r.updatedAt })
        if (r.reason === 'conflict') throw new HttpError(409, 'conflict', { updatedAt: r.updatedAt })
        if (r.reason === 'quota') throw new HttpError(507, `storage quota exceeded (${mb(r.used)} of ${mb(r.quota)} MB used)`, { used: r.used, quota: r.quota })
        throw new HttpError(507, 'too many records')
      }
      if (method === 'DELETE') {
        const base = Number(query.get('base') ?? 'x')
        if (!Number.isSafeInteger(base) || base < 0) throw new HttpError(400, 'bad request')
        const r = await storage.remove(acc.name, game, kind, id, base)
        if (r.ok) return send(res, 200, { deleted: true })
        throw new HttpError(409, 'conflict', { updatedAt: r.updatedAt })
      }
      throw new HttpError(405, 'method not allowed')
    }
    throw new HttpError(404, 'not found')
  }

  /** Every record of the account, in the original file formats, one folder per game and record. */
  async function exportZip(user: string): Promise<Buffer> {
    const enc = new TextEncoder()
    const files: { name: string; data: Uint8Array }[] = [{ name: 'README.txt', data: enc.encode(
      'GoldBox Rerolled: everything the server keeps for this account.\r\n' +
      'Each saved game and character folder holds the original game files (copy them into the game folder for DOSBox);\r\n' +
      'record.json beside them is the port\'s metadata. party.json and settings.json are the party and settings.\r\n') }]
    for (const game of await storage.games(user)) {
      for (const l of await storage.list(user, game)) {
        if (l.kind === 'docs') { files.push({ name: `${game}/${l.id}.json`, data: enc.encode(JSON.stringify(l.meta, null, 1)) }); continue }
        const r = await storage.get(user, game, l.kind, l.id)
        if (!r) continue
        const dir = `${game}/${l.kind}/${l.id}`
        for (const f of r.files) files.push({ name: `${dir}/${f.name}`, data: f.data })
        files.push({ name: `${dir}/record.json`, data: enc.encode(JSON.stringify({ updatedAt: r.updatedAt, meta: r.meta }, null, 1)) })
      }
    }
    return zip(files)
  }

  // ---------------------------------------------------------------- server

  const server = createServer(async (req, res) => {
    const started = Date.now()
    securityHeaders(res, config)
    let path = '/'
    if (config.logRequests) res.once('finish', () => console.log(`${req.method} ${logPath(path)} ${res.statusCode} ${Date.now() - started}ms`))
    try {
      const url = new URL(req.url ?? '/', 'http://x')
      path = url.pathname
      if (path.startsWith(API)) await api(req, res, path.slice(API.length), url.searchParams)
      else await serveStatic(req, res, path, config.webRoot)
    } catch (e) {
      if (res.headersSent) { res.destroy(); return }
      if (e instanceof HttpError) {
        if (e.status === 429) res.setHeader('Retry-After', String(e.body.retryAfter ?? 60))
        send(res, e.status, e.body)
      } else if (e instanceof StorageError) {
        console.error(`storage error ${e.code}`)
        send(res, 503, { error: 'the server could not store this just now' })
      } else {
        console.error(`error on ${req.method} ${logPath(path)}: ${(e as Error)?.message ?? e}`)
        send(res, 500, { error: 'server error' })
      }
    }
  })
  server.requestTimeout = 30_000
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5_000

  return {
    server, accounts, storage,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, () => resolve((server.address() as { port: number }).port))
      })
    },
    close() {
      return new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections() })
    },
  }
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(1)

/** A path for the log: record ids (character names) left out, no query string. */
function logPath(p: string): string {
  const m = /^\/api\/v1\/games\/([^/]+)\/([^/]+)\/.+$/.exec(p)
  return m ? `/api/v1/games/${m[1]}/${m[2]}/…` : p.length > 200 ? p.slice(0, 200) + '…' : p
}
