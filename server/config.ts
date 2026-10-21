// Server configuration, from environment variables only (spec/C-port/accounts-and-sync.md §8).
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export type SignupMode = 'open' | 'invite' | 'off'

export interface Config {
  port: number
  host: string
  /** where accounts, sessions and players' data live; outside the repository */
  dataDir: string
  /** the built app (web/dist) */
  webRoot: string
  /** Secure flag on the session cookie (and HSTS); off only for plain-HTTP use on a LAN */
  cookieSecure: boolean
  /** behind a reverse proxy: take the client address from X-Forwarded-For */
  trustProxy: boolean
  signup: SignupMode
  maxUsers: number
  /** per-user storage quota, bytes */
  quota: number
  /** session lifetime, ms, renewed by use */
  sessionTtl: number
  /** scrypt cost (2^15 in production; tests lower it) */
  scryptN: number
  /** log one line per request (method, path, status; never bodies, cookies or query strings) */
  logRequests: boolean
}

function flag(v: string | undefined, dflt: boolean): boolean {
  if (v === undefined || v === '') return dflt
  return /^(1|true|yes|on)$/i.test(v)
}

function int(v: string | undefined, dflt: number, min: number, max: number): number {
  if (v === undefined || v === '') return dflt
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`invalid number: ${v}`)
  return n
}

export function defaultDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME
  return join(xdg && xdg.startsWith('/') ? xdg : join(homedir(), '.local', 'share'), 'goldbox-rerolled')
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const signup = (env.SIGNUP ?? 'open').toLowerCase()
  if (signup !== 'open' && signup !== 'invite' && signup !== 'off') throw new Error(`SIGNUP must be open, invite or off (got ${signup})`)
  return {
    port: int(env.PORT, 8080, 0, 65535),
    host: env.HOST || '0.0.0.0',
    dataDir: resolve(env.DATA_DIR || defaultDataDir()),
    webRoot: resolve(env.WEB_ROOT || join(import.meta.dirname, '..', 'web', 'dist')),
    cookieSecure: flag(env.COOKIE_SECURE, true),
    trustProxy: flag(env.TRUST_PROXY, false),
    signup,
    maxUsers: int(env.MAX_USERS, 1000, 0, 10_000_000),
    quota: int(env.QUOTA_MB, 20, 1, 100_000) * 1024 * 1024,
    sessionTtl: int(env.SESSION_DAYS, 30, 1, 365) * 24 * 3600 * 1000,
    scryptN: 1 << 15,
    logRequests: flag(env.LOG_REQUESTS, true),
  }
}
