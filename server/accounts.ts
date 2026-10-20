// Accounts, sessions, invites and recovery codes (docs/server.md, "Security model"). Shared by the
// server and the admin CLI; everything is files under DATA_DIR:
//   users/<name>/account.json   name, scrypt hash and salt, recovery-code hash, generation, disabled
//   sessions/<sha256 of token>.json   user, generation, expiry (the token itself is never stored)
//   invites/<sha256 of code>.json     expiry (single use: deleted when taken)
// A session is valid while its account exists, is not disabled and has the same generation: a
// password change, recovery, reset or disable bumps the generation and so ends every session.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { rename, rm, stat, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { KeyedLock, ensureDir, listDir, readJson, writeAtomic, wrapDisk } from './fsutil.ts'

export const NAME_RE = /^[a-z0-9_-]{3,24}$/
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 256
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'system', 'sysadmin', 'support', 'help', 'api', 'www', 'web', 'mail',
  'goldbox', 'goldbox-rerolled', 'rerolled', 'server', 'owner', 'moderator', 'staff', 'security',
  'null', 'undefined', 'anonymous', 'guest', 'me', 'you', 'login', 'logout', 'signup', 'signin',
  'register', 'account', 'accounts', 'users', 'user', 'health', 'config', 'export', 'privacy', 'ssi',
])

/** The account name as stored (lower case), or null when it is not an acceptable name. */
export function normaliseName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const n = raw.trim().toLowerCase()
  return NAME_RE.test(n) ? n : null
}
export const reservedName = (n: string) => RESERVED.has(n)

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string') return 'a password is needed'
  if ([...pw].length < PASSWORD_MIN) return `the password needs at least ${PASSWORD_MIN} characters`
  if (pw.length > PASSWORD_MAX) return 'the password is too long'
  return null
}

// ------------------------------------------------------------------ hashing

interface PwHash { alg: 'scrypt'; N: number; r: number; p: number; salt: string; hash: string }

const scrypt = (pw: string, salt: Buffer, N: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const opts: ScryptOptions = { N, r, p, maxmem: 256 * N * r + 1024 * 1024 }
    scryptCb(pw.normalize('NFKC'), salt, 64, opts, (err, key) => (err ? reject(err) : resolve(key)))
  })

/** At most two scrypt computations at once (each takes 32 MB at N = 2^15). */
let running = 0
const waiting: (() => void)[] = []
async function limited<T>(f: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => waiting.push(r))
  running++
  try { return await f() } finally { running--; waiting.shift()?.() }
}

export async function hashPassword(pw: string, N: number): Promise<PwHash> {
  const salt = randomBytes(16)
  const key = await limited(() => scrypt(pw, salt, N, 8, 1))
  return { alg: 'scrypt', N, r: 8, p: 1, salt: salt.toString('base64'), hash: key.toString('base64') }
}

export async function verifyPassword(pw: string, h: PwHash): Promise<boolean> {
  const key = await limited(() => scrypt(pw, Buffer.from(h.salt, 'base64'), h.N, h.r, h.p))
  const want = Buffer.from(h.hash, 'base64')
  return key.length === want.length && timingSafeEqual(key, want)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// ------------------------------------------------------------------ recovery and invite codes

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32

/** 20 symbols (100 bits) in groups of four. */
export function newCode(): string {
  const b = randomBytes(20)
  let s = ''
  for (let i = 0; i < 20; i++) s += ALPHABET[b[i] & 31]
  return s.match(/.{4}/g)!.join('-')
}

/** A code as typed: case, spaces and dashes do not matter; O reads as 0, I and L as 1. */
export function normaliseCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 64) return null
  const s = raw.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  return /^[0-9A-HJKMNP-TV-Z]{20}$/.test(s) ? s : null
}
const codeHash = (code: string) => sha256(`goldbox-code:${code}`)

// ------------------------------------------------------------------ accounts

export interface Account {
  v: 1
  name: string
  created: number
  pw: PwHash
  /** sha-256 of the current recovery code */
  recovery: string
  gen: number
  disabled?: boolean
}

export interface AccountsOptions { scryptN: number; sessionTtl: number; maxUsers: number }

export type CreateResult = { ok: true; recoveryCode: string } | { ok: false; reason: 'exists' | 'full' | 'reserved' | 'invalid' }

export class Accounts {
  readonly usersDir: string
  readonly sessionsDir: string
  readonly invitesDir: string
  private cache = new Map<string, { mtime: number; size: number; acc: Account }>()
  private sessions = new Map<string, Session>()
  private lock = new KeyedLock()
  private dummy: Promise<PwHash> | null = null
  readonly opts: AccountsOptions
  readonly dataDir: string

  constructor(dataDir: string, opts: AccountsOptions) {
    this.dataDir = dataDir
    this.opts = opts
    this.usersDir = join(dataDir, 'users')
    this.sessionsDir = join(dataDir, 'sessions')
    this.invitesDir = join(dataDir, 'invites')
  }

  async init() {
    for (const d of [this.dataDir, this.usersDir, this.sessionsDir, this.invitesDir]) await ensureDir(d)
  }

  userDir(name: string) { return join(this.usersDir, name) }
  private file(name: string) { return join(this.usersDir, name, 'account.json') }

  /** The account, re-read when its file changed (the admin CLI writes the same files). */
  async get(name: string): Promise<Account | null> {
    if (!NAME_RE.test(name)) return null
    const f = this.file(name)
    let st
    try { st = await stat(f) } catch { this.cache.delete(name); return null }
    const c = this.cache.get(name)
    if (c && c.mtime === st.mtimeMs && c.size === st.size) return c.acc
    const acc = await readJson<Account>(f)
    if (!acc) return null
    this.cache.set(name, { mtime: st.mtimeMs, size: st.size, acc })
    return acc
  }

  private async put(acc: Account) {
    await writeAtomic(this.file(acc.name), JSON.stringify(acc, null, 1))
    this.cache.delete(acc.name)
  }

  /** Change an account under its lock (read, modify, write atomically). */
  private update(name: string, f: (a: Account) => void | Promise<void>): Promise<Account | null> {
    return this.lock.run(`acc:${name}`, async () => {
      const acc = await this.get(name)
      if (!acc) return null
      const copy = structuredClone(acc)
      await f(copy)
      await this.put(copy)
      return copy
    })
  }

  async list(): Promise<string[]> {
    return (await listDir(this.usersDir)).filter((n) => NAME_RE.test(n)).sort()
  }

  async count(): Promise<number> {
    return (await this.list()).length
  }

  /** A new account. The name is taken atomically: the account directory is renamed into place. */
  create(rawName: string, password: string, opts: { ignoreLimit?: boolean } = {}): Promise<CreateResult> {
    return this.lock.run('create', async () => {
      const name = normaliseName(rawName)
      if (!name || passwordProblem(password)) return { ok: false, reason: 'invalid' }
      if (reservedName(name)) return { ok: false, reason: 'reserved' }
      if (await this.get(name)) return { ok: false, reason: 'exists' }
      if (!opts.ignoreLimit && (await this.count()) >= this.opts.maxUsers) return { ok: false, reason: 'full' }
      const recoveryCode = newCode()
      const acc: Account = { v: 1, name, created: Date.now(), pw: await hashPassword(password, this.opts.scryptN),
        recovery: codeHash(normaliseCode(recoveryCode)!), gen: 1 }
      const tmp = join(this.usersDir, `.new-${randomBytes(6).toString('hex')}`)
      try {
        await mkdir(tmp, { mode: 0o700 })
        await writeAtomic(join(tmp, 'account.json'), JSON.stringify(acc, null, 1))
        await rename(tmp, this.userDir(name))
      } catch (e) {
        await rm(tmp, { recursive: true, force: true }).catch(() => {})
        const code = (e as NodeJS.ErrnoException).code
        if (code === 'ENOTEMPTY' || code === 'EEXIST') return { ok: false, reason: 'exists' }
        wrapDisk(e)
      }
      return { ok: true, recoveryCode }
    })
  }

  /** Check a password; for unknown names the same work is done so timing does not tell. */
  async checkPassword(name: string | null, password: string): Promise<Account | null> {
    const acc = name ? await this.get(name) : null
    if (!acc) {
      this.dummy ??= hashPassword('not a real password', this.opts.scryptN)
      await verifyPassword(password, await this.dummy)
      return null
    }
    return (await verifyPassword(password, acc.pw)) ? acc : null
  }

  async checkRecovery(name: string | null, code: string | null): Promise<Account | null> {
    const acc = name ? await this.get(name) : null
    const h = Buffer.from(codeHash(code ?? 'x'), 'hex')
    const want = Buffer.from(acc?.recovery ?? '0'.repeat(64), 'hex')
    return acc && code && timingSafeEqual(h, want) ? acc : null
  }

  /** New password; every session of the account ends. */
  async setPassword(name: string, password: string): Promise<boolean> {
    const pw = await hashPassword(password, this.opts.scryptN)
    const ok = (await this.update(name, (a) => { a.pw = pw; a.gen++ })) !== null
    await this.dropSessions(name)
    return ok
  }

  /** A new recovery code (the old one stops working). */
  async newRecovery(name: string): Promise<string | null> {
    const code = newCode()
    return (await this.update(name, (a) => { a.recovery = codeHash(normaliseCode(code)!) })) ? code : null
  }

  async setDisabled(name: string, disabled: boolean): Promise<boolean> {
    const ok = (await this.update(name, (a) => {
      if (disabled) { a.disabled = true; a.gen++ } else delete a.disabled
    })) !== null
    if (ok && disabled) await this.dropSessions(name)
    return ok
  }

  /** Remove the account and all its data: renamed away at once, then deleted. */
  remove(name: string): Promise<boolean> {
    return this.lock.run(`acc:${name}`, async () => {
      if (!(await this.get(name))) return false
      const gone = join(this.usersDir, `.deleted-${randomBytes(6).toString('hex')}`)
      await rename(this.userDir(name), gone)
      this.cache.delete(name)
      await rm(gone, { recursive: true, force: true })
      await this.dropSessions(name)
      return true
    })
  }

  // ---------------------------------------------------------------- sessions

  private sessionFile(h: string) { return join(this.sessionsDir, `${h}.json`) }

  /** A new random session token (32 bytes); only its hash is kept. */
  async createSession(acc: Account): Promise<string> {
    const token = randomBytes(32).toString('base64url')
    const h = sha256(token)
    const s: Session = { user: acc.name, gen: acc.gen, created: Date.now(), expires: Date.now() + this.opts.sessionTtl }
    await writeAtomic(this.sessionFile(h), JSON.stringify(s))
    this.sessions.set(h, s)
    return token
  }

  /** The account a token belongs to, or null (unknown, expired, account gone, disabled or changed). */
  async session(token: string | undefined): Promise<Account | null> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
    const h = sha256(token)
    let s = this.sessions.get(h)
    if (!s) {
      s = (await readJson<Session>(this.sessionFile(h))) ?? undefined
      if (!s) return null
      this.sessions.set(h, s)
    }
    const now = Date.now()
    const acc = s.expires > now ? await this.get(s.user) : null
    if (!acc || acc.disabled || acc.gen !== s.gen) {
      this.sessions.delete(h)
      await unlink(this.sessionFile(h)).catch(() => {})
      return null
    }
    // renewed by use, written at most once a day
    if (s.expires - now < this.opts.sessionTtl - 24 * 3600 * 1000) {
      s.expires = now + this.opts.sessionTtl
      await writeAtomic(this.sessionFile(h), JSON.stringify(s)).catch(() => {})
    }
    return acc
  }

  /** Delete every stored session of an account (it is gone, locked, or its password changed). */
  async dropSessions(name: string) {
    for (const [h, s] of this.sessions) if (s.user === name) this.sessions.delete(h)
    for (const n of await listDir(this.sessionsDir)) {
      if (!n.endsWith('.json')) continue
      const f = join(this.sessionsDir, n)
      const s = await readJson<Session>(f).catch(() => null)
      if (s?.user === name) await unlink(f).catch(() => {})
    }
  }

  async endSession(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return
    const h = sha256(token)
    this.sessions.delete(h)
    await unlink(this.sessionFile(h)).catch(() => {})
  }

  // ---------------------------------------------------------------- invites

  async createInvite(days: number): Promise<{ code: string; expires: number }> {
    const code = newCode()
    const expires = Date.now() + days * 24 * 3600 * 1000
    await writeAtomic(join(this.invitesDir, `${codeHash(normaliseCode(code)!)}.json`), JSON.stringify({ created: Date.now(), expires }))
    return { code, expires }
  }

  /** Take an invite (single use). */
  async takeInvite(raw: unknown): Promise<boolean> {
    const code = normaliseCode(raw)
    if (!code) return false
    const f = join(this.invitesDir, `${codeHash(code)}.json`)
    const inv = await readJson<{ expires: number }>(f).catch(() => null)
    if (!inv) return false
    try { await unlink(f) } catch { return false } // someone else took it first
    return inv.expires > Date.now()
  }

  async invites(): Promise<{ expires: number }[]> {
    const out: { expires: number }[] = []
    for (const n of await listDir(this.invitesDir)) {
      if (!n.endsWith('.json')) continue
      const v = await readJson<{ expires: number }>(join(this.invitesDir, n)).catch(() => null)
      if (v) out.push(v)
    }
    return out
  }

  /** Delete expired or orphaned sessions and expired invites; returns how many of each. */
  async prune(): Promise<{ sessions: number; invites: number }> {
    let sessions = 0, invites = 0
    const now = Date.now()
    for (const n of await listDir(this.sessionsDir)) {
      if (!n.endsWith('.json')) continue
      const f = join(this.sessionsDir, n)
      const s = await readJson<Session>(f).catch(() => null)
      const acc = s ? await this.get(s.user) : null
      if (!s || s.expires <= now || !acc || acc.disabled || acc.gen !== s.gen) {
        await unlink(f).catch(() => {})
        this.sessions.delete(n.slice(0, -5))
        sessions++
      }
    }
    for (const n of await listDir(this.invitesDir)) {
      if (!n.endsWith('.json')) continue
      const f = join(this.invitesDir, n)
      const v = await readJson<{ expires: number }>(f).catch(() => null)
      if (!v || v.expires <= now) { await unlink(f).catch(() => {}); invites++ }
    }
    return { sessions, invites }
  }

  async sessionCount(): Promise<number> {
    return (await listDir(this.sessionsDir)).filter((n) => n.endsWith('.json')).length
  }
}

interface Session { user: string; gen: number; created: number; expires: number }

// ------------------------------------------------------------------ rate limiting (memory only)

/** At most `max` hits per key in a sliding window; nothing is written to disk. */
export class Limiter {
  private hits = new Map<string, number[]>()
  private readonly max: number
  private readonly window: number
  constructor(max: number, windowMs: number) {
    this.max = max
    this.window = windowMs
  }
  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => t > now - this.window)
    if (list.length) this.hits.set(key, list)
    else this.hits.delete(key)
    return list
  }
  /** Seconds until the key may try again, or 0. */
  blocked(key: string): number {
    const now = Date.now()
    const list = this.recent(key, now)
    return list.length >= this.max ? Math.ceil((list[0] + this.window - now) / 1000) : 0
  }
  hit(key: string) {
    const now = Date.now()
    const list = this.recent(key, now)
    list.push(now)
    this.hits.set(key, list)
    if (this.hits.size > 50_000) this.sweep(now)
  }
  reset(key: string) { this.hits.delete(key) }
  private sweep(now: number) {
    for (const k of [...this.hits.keys()]) this.recent(k, now)
    // still too many: drop the oldest keys
    for (const k of this.hits.keys()) { if (this.hits.size <= 40_000) break; this.hits.delete(k) }
  }
}
