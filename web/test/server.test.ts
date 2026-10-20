// The sync server (../server, docs/server.md): accounts, sessions, isolation, validation, storage
// in the original formats, conflicts, quotas, export and the admin CLI. A real server on a random port.
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createApp, type App } from '../../server/app.ts'
import type { Config } from '../../server/config.ts'
import { unzip } from '../src/store/savefiles'
import { parseSave } from '../src/data/save'

const temps: string[] = []
function temp() {
  const d = mkdtempSync(join(tmpdir(), 'gbr-test-'))
  temps.push(d)
  return d
}
afterAll(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })

function webRoot() {
  const d = temp()
  writeFileSync(join(d, 'index.html'), '<!doctype html><title>x</title>')
  writeFileSync(join(d, 'sw.js'), 'self.addEventListener("fetch", () => {})')
  writeFileSync(join(d, 'manifest.webmanifest'), '{}')
  mkdirSync(join(d, 'assets'))
  writeFileSync(join(d, 'assets', 'index-abc123.js'), 'console.log(1)')
  return d
}

function config(over: Partial<Config> = {}): Config {
  return { port: 0, host: '127.0.0.1', dataDir: temp(), webRoot: webRoot(), cookieSecure: false, trustProxy: true, signup: 'open',
    maxUsers: 1000, quota: 20 * 1024 * 1024, sessionTtl: 24 * 3600 * 1000 * 30, scryptN: 1 << 10, logRequests: false, ...over }
}

let ipCounter = 0
/** A browser: its own cookie jar and (behind the trusted proxy) its own address. */
class Client {
  cookie = ''
  setCookie = ''
  ip = `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`
  base: string
  constructor(base: string) { this.base = base }
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { 'X-Forwarded-For': this.ip, ...headers }
    if (method !== 'GET' && !('X-GoldBox' in headers)) h['X-GoldBox'] = '1'
    if (body !== undefined) h['Content-Type'] ??= 'application/json'
    if (this.cookie) h.Cookie = this.cookie
    for (const k of Object.keys(h)) if (h[k] === '') delete h[k]
    const r = await fetch(this.base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
    const sc = r.headers.get('set-cookie')
    if (sc) { this.setCookie = sc; const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v }
    const type = r.headers.get('content-type') ?? ''
    const data = type.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer())
    return { status: r.status, data: data as any, headers: r.headers }
  }
  signup(user: string, password = 'a long password', extra = {}) { return this.req('POST', '/api/v1/signup', { user, password, ...extra }) }
  login(user: string, password = 'a long password') { return this.req('POST', '/api/v1/login', { user, password }) }
  me() { return this.req('GET', '/api/v1/me') }
  put(game: string, kind: string, id: string, base: number, files: { name: string; data: Uint8Array }[] = [], meta: object = {}) {
    return this.req('PUT', `/api/v1/games/${game}/${kind}/${encodeURIComponent(id)}`, { base, meta, files: files.map((f) => ({ name: f.name, data: Buffer.from(f.data).toString('base64') })) })
  }
  get(game: string, kind: string, id: string) { return this.req('GET', `/api/v1/games/${game}/${kind}/${encodeURIComponent(id)}`) }
}

let app: App
let base = ''
async function start(over: Partial<Config> = {}) {
  app = await createApp(config(over))
  base = `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}`
  return app
}
afterEach(async () => { await app?.close() })

const bytes = (n: number, seed = 1) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 7) & 0xff)

describe('server: public endpoints and headers', () => {
  beforeEach(() => start())
  it('reports health, config and a signed-out /me', async () => {
    const c = new Client(base)
    expect((await c.req('GET', '/api/v1/health')).data).toEqual({ ok: true })
    const cfg = (await c.req('GET', '/api/v1/config')).data
    expect(cfg).toMatchObject({ server: 'goldbox-rerolled', api: 1, signup: 'open', passwordMin: 10 })
    expect((await c.me()).data.user).toBeNull()
  })
  it('sends the security headers on API and static responses', async () => {
    const c = new Client(base)
    for (const p of ['/api/v1/me', '/', '/nope']) {
      const r = await c.req('GET', p)
      expect(r.headers.get('content-security-policy')).toContain("default-src 'self'")
      expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
      expect(r.headers.get('x-content-type-options')).toBe('nosniff')
      expect(r.headers.get('x-frame-options')).toBe('DENY')
      expect(r.headers.get('referrer-policy')).toBe('same-origin')
      expect(r.headers.get('permissions-policy')).toContain('camera=()')
      expect(r.headers.get('strict-transport-security')).toBeNull() // cookies not secure: plain HTTP
    }
  })
  it('serves the app with MIME types and PWA cache rules, and nothing outside it', async () => {
    const c = new Client(base)
    const index = await c.req('GET', '/')
    expect(index.headers.get('content-type')).toContain('text/html')
    expect(index.headers.get('cache-control')).toBe('no-cache')
    const sw = await c.req('GET', '/sw.js')
    expect(sw.headers.get('content-type')).toContain('text/javascript')
    expect(sw.headers.get('cache-control')).toBe('no-cache')
    expect((await c.req('GET', '/manifest.webmanifest')).headers.get('content-type')).toContain('application/manifest+json')
    expect((await c.req('GET', '/assets/index-abc123.js')).headers.get('cache-control')).toContain('immutable')
    const again = await c.req('GET', '/sw.js', undefined, { 'If-None-Match': sw.headers.get('etag')! })
    expect(again.status).toBe(304)
    for (const p of ['/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc/passwd', '/.hidden', '/assets/%00x', '/assets']) {
      expect((await c.req('GET', p)).status, p).toBe(404)
    }
  })
})

describe('server: HSTS and secure cookies', () => {
  it('marks the cookie Secure with the __Host- prefix and sends HSTS by default', async () => {
    await start({ cookieSecure: true })
    const c = new Client(base)
    const r = await c.signup('secure-one')
    expect(r.status).toBe(200)
    expect(r.headers.get('strict-transport-security')).toContain('max-age=')
    expect(c.setCookie).toMatch(/^__Host-gbr_session=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=\d+$/)
  })
})

describe('server: sign-up', () => {
  it('validates names and passwords, refuses reserved and taken names, case-insensitively', async () => {
    await start()
    const c = new Client(base)
    for (const [user, pw] of [['ab', 'a long password'], ['a b c', 'a long password'], ['x'.repeat(25), 'a long password'], ['../evil', 'a long password'], ['good-name', 'short']]) {
      expect((await new Client(base).signup(user, pw)).status, user).toBe(400)
    }
    expect((await new Client(base).signup('Admin')).data.error).toMatch(/reserved/)
    const r = await c.signup('Player_One')
    expect(r.status).toBe(200)
    expect(r.data.user).toBe('player_one')
    expect(r.data.recoveryCode).toMatch(/^([0-9A-Z]{4}-){4}[0-9A-Z]{4}$/)
    expect(c.setCookie).toMatch(/HttpOnly; SameSite=Lax/)
    expect(c.setCookie).not.toMatch(/Secure/)
    expect((await c.me()).data.user).toBe('player_one') // signed in straight away
    expect((await new Client(base).signup('PLAYER_ONE')).status).toBe(409)
    // only hashes on disk
    const acc = readFileSync(join(app.accounts.usersDir, 'player_one', 'account.json'), 'utf8')
    expect(acc).not.toContain('a long password')
    expect(acc).not.toContain(r.data.recoveryCode.replace(/-/g, ''))
  })
  it('needs the custom header and JSON', async () => {
    await start()
    const c = new Client(base)
    expect((await c.req('POST', '/api/v1/signup', { user: 'nohead', password: 'a long password' }, { 'X-GoldBox': '' })).status).toBe(403)
    expect((await c.req('POST', '/api/v1/signup', 'user=x', { 'Content-Type': 'application/x-www-form-urlencoded' })).status).toBe(415)
    expect((await c.req('POST', '/api/v1/signup', JSON.stringify({ user: 'big', password: 'x'.repeat(10_000) }))).status).toBe(413)
  })
  it('is closed with SIGNUP=off', async () => {
    await start({ signup: 'off' })
    expect((await new Client(base).req('GET', '/api/v1/config')).data.signup).toBe('off')
    expect((await new Client(base).signup('someone')).status).toBe(403)
  })
  it('takes single-use, expiring invite codes with SIGNUP=invite', async () => {
    await start({ signup: 'invite' })
    expect((await new Client(base).signup('noinvite')).status).toBe(403)
    expect((await new Client(base).signup('badinvite', 'a long password', { invite: 'AAAA-BBBB-CCCC-DDDD-EEEE' })).status).toBe(403)
    const { code } = await app.accounts.createInvite(7)
    expect((await new Client(base).signup('invited', 'a long password', { invite: code.toLowerCase() })).status).toBe(200)
    expect((await new Client(base).signup('second', 'a long password', { invite: code })).status).toBe(403)
    const old = await app.accounts.createInvite(-1)
    expect((await new Client(base).signup('late', 'a long password', { invite: old.code })).status).toBe(403)
  })
  it('limits sign-ups per address', async () => {
    await start()
    const c = new Client(base)
    for (let i = 0; i < 5; i++) expect((await c.signup(`spam${i}`)).status).toBe(200)
    const r = await c.signup('spam5')
    expect(r.status).toBe(429)
    expect(r.headers.get('retry-after')).toMatch(/^\d+$/)
    const other = new Client(base) // another address
    expect((await other.signup('fine')).status).toBe(200)
  })
  it('stops at MAX_USERS', async () => {
    await start({ maxUsers: 2 })
    expect((await new Client(base).signup('one')).status).toBe(200)
    expect((await new Client(base).signup('two')).status).toBe(200)
    expect((await new Client(base).signup('three')).status).toBe(503)
  })
})

describe('server: sign-in, sessions and passwords', () => {
  beforeEach(() => start())
  it('does not tell unknown names from wrong passwords, and limits attempts', async () => {
    await new Client(base).signup('alice')
    const c = new Client(base)
    const unknown = await c.login('nobody')
    const wrong = await c.login('alice', 'not the password')
    expect(unknown.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(unknown.data).toEqual(wrong.data)
    for (let i = 0; i < 9; i++) await new Client(base).login('alice', 'still wrong!!')
    const blocked = await new Client(base).login('alice')
    expect(blocked.status).toBe(429) // per account, from any address
    expect((await c.me()).data.user).toBeNull()
  })
  it('limits failures per address', async () => {
    const c = new Client(base)
    for (let i = 0; i < 20; i++) await c.login(`user${i}`, 'wrong password')
    expect((await c.login('user99', 'wrong password')).status).toBe(429)
  })
  it('signs in and out, with a fresh session id each time', async () => {
    const a = new Client(base)
    await a.signup('bobby')
    const first = a.cookie
    expect((await a.login('BOBBY')).status).toBe(200)
    expect(a.cookie).not.toBe(first)
    const stale = new Client(base); stale.cookie = first
    expect((await stale.me()).data.user).toBeNull() // the old id ended
    expect((await a.req('POST', '/api/v1/logout', {})).status).toBe(200)
    expect(a.cookie).toBe('')
    const reuse = new Client(base); reuse.cookie = (await (async () => { const b = new Client(base); await b.login('bobby'); return b.cookie })())
    expect((await reuse.me()).data.user).toBe('bobby')
  })
  it('changes the password and signs out everywhere else', async () => {
    const a = new Client(base), b = new Client(base)
    await a.signup('carol')
    await b.login('carol')
    expect((await a.req('POST', '/api/v1/password', { password: 'wrong one!!', newPassword: 'another long one' })).status).toBe(403)
    expect((await a.req('POST', '/api/v1/password', { password: 'a long password', newPassword: 'short' })).status).toBe(400)
    const r = await a.req('POST', '/api/v1/password', { password: 'a long password', newPassword: 'another long one' })
    expect(r.status).toBe(200)
    expect((await a.me()).data.user).toBe('carol')
    expect((await b.me()).data.user).toBeNull()
    expect(readdirSync(app.accounts.sessionsDir)).toHaveLength(1) // only the new one
    expect((await new Client(base).login('carol')).status).toBe(401)
    expect((await new Client(base).login('carol', 'another long one')).status).toBe(200)
  })
  it('recovers an account with its recovery code, once', async () => {
    const a = new Client(base)
    const { recoveryCode } = (await a.signup('dave')).data
    const r0 = new Client(base)
    expect((await r0.req('POST', '/api/v1/recover', { user: 'dave', code: 'AAAA-BBBB-CCCC-DDDD-EEEE', newPassword: 'a new long password' })).status).toBe(401)
    const r = await r0.req('POST', '/api/v1/recover', { user: 'Dave', code: recoveryCode.toLowerCase(), newPassword: 'a new long password' })
    expect(r.status).toBe(200)
    expect(r.data.recoveryCode).not.toBe(recoveryCode)
    expect((await r0.me()).data.user).toBe('dave')
    expect((await a.me()).data.user).toBeNull() // the other session ended
    expect((await new Client(base).login('dave', 'a new long password')).status).toBe(200)
    expect((await new Client(base).req('POST', '/api/v1/recover', { user: 'dave', code: recoveryCode, newPassword: 'yet another password' })).status).toBe(401)
    // a new code on request, with the password
    const fresh = await r0.req('POST', '/api/v1/recovery-code', { password: 'a new long password' })
    expect(fresh.data.recoveryCode).toMatch(/-/)
    expect((await new Client(base).req('POST', '/api/v1/recover', { user: 'dave', code: r.data.recoveryCode, newPassword: 'yet another password' })).status).toBe(401)
  })
  it('limits recovery attempts', async () => {
    await new Client(base).signup('erin')
    for (let i = 0; i < 5; i++) await new Client(base).req('POST', '/api/v1/recover', { user: 'erin', code: 'AAAA-BBBB-CCCC-DDDD-EEEE', newPassword: 'a new long password' })
    expect((await new Client(base).req('POST', '/api/v1/recover', { user: 'erin', code: 'AAAA-BBBB-CCCC-DDDD-EEEE', newPassword: 'a new long password' })).status).toBe(429)
  })
  it('locks a disabled account out and ends its sessions', async () => {
    const a = new Client(base)
    await a.signup('frank')
    await app.accounts.setDisabled('frank', true)
    expect((await a.me()).data.user).toBeNull()
    expect((await new Client(base).login('frank')).status).toBe(403)
    expect((await new Client(base).login('frank', 'wrong password!')).status).toBe(401) // locked only shows with the password
    await app.accounts.setDisabled('frank', false)
    expect((await new Client(base).login('frank')).status).toBe(200)
  })
})

describe('server: data', () => {
  beforeEach(() => start())
  it('needs a session, the header, and keeps users apart', async () => {
    const a = new Client(base), b = new Client(base)
    expect((await a.get('por', 'saves', 'A')).status).toBe(401)
    await a.signup('ann'); await b.signup('ben')
    expect((await a.put('por', 'saves', 'A', 0, [{ name: 'SAVGAMA.DAT', data: bytes(10) }], { label: 'mine' })).status).toBe(200)
    const noHeader = await a.req('PUT', '/api/v1/games/por/saves/B', { base: 0, meta: {}, files: [] }, { 'X-GoldBox': '' })
    expect(noHeader.status).toBe(403)
    expect((await b.get('por', 'saves', 'A')).status).toBe(404)
    expect((await b.req('GET', '/api/v1/games/por')).data.records).toEqual([])
    expect((await a.req('GET', '/api/v1/games/por')).data.records).toEqual([expect.objectContaining({ kind: 'saves', id: 'A', meta: { label: 'mine' } })])
    expect((await b.req('DELETE', '/api/v1/games/por/saves/A?base=0')).status).toBe(200) // nothing of b's to delete
    expect((await a.get('por', 'saves', 'A')).status).toBe(200)
  })
  it('refuses bad games, kinds, ids and file names', async () => {
    const a = new Client(base)
    await a.signup('gina')
    const bad = [
      ['..', 'saves', 'A'], ['%2e%2e', 'saves', 'A'], ['POR', 'saves', 'A'], ['por', 'x', 'A'], ['por', 'saves', 'K'],
      ['por', 'saves', '../A'], ['por', 'characters', 'A/B'], ['por', 'characters', '..'], ['por', 'characters', 'TOOLONGNAME'],
      ['por', 'characters', 'lower'], ['por', 'docs', 'other'], ['por', 'conflicts', 'UPPER'],
    ]
    for (const [g, k, id] of bad) expect([400, 404], `${g}/${k}/${id}`).toContain((await a.put(g, k, id, 0)).status)
    for (const name of ['../X.DAT', 'A/B.DAT', 'NOEXT', 'TOOLONGNAME.DAT', 'X.DATA', 'lower.dat', '.HIDDEN']) {
      expect((await a.put('por', 'saves', 'A', 0, [{ name, data: bytes(1) }])).status, name).toBe(400)
    }
    expect((await a.put('por', 'saves', 'A', 0, [{ name: 'A.DAT', data: bytes(1) }, { name: 'A.DAT', data: bytes(1) }])).status).toBe(400)
    expect((await a.req('PUT', '/api/v1/games/por/saves/A', { base: 0, meta: {}, files: [{ name: 'A.DAT', data: 'not base64!' }] })).status).toBe(400)
    expect((await a.req('PUT', '/api/v1/games/por/docs/party', { base: 0, meta: {}, files: [{ name: 'A.DAT', data: 'AA==' }] })).status).toBe(400)
    expect((await a.req('PUT', '/api/v1/games/por/saves/A', { base: -1, meta: {}, files: [] })).status).toBe(400)
    expect((await a.req('PUT', '/api/v1/games/por/saves/A', { base: 0, meta: { x: 'y'.repeat(20_000) }, files: [] })).status).toBe(400)
    // nothing was written anywhere
    expect(readdirSync(join(app.accounts.usersDir, 'gina'))).toEqual(['account.json'])
    expect(readdirSync(app.accounts.dataDir).sort()).toEqual(['invites', 'sessions', 'users'])
  })
  it('accepts a stem with the punctuation DOS names allow', async () => {
    const a = new Client(base)
    await a.signup('hank')
    const r = await a.put('por', 'characters', "O'BRI-#1", 0, [{ name: "O'BRI-#1.CHA", data: bytes(20) }])
    expect(r.status).toBe(200)
    expect([...(await a.get('por', 'characters', "O'BRI-#1")).data.files[0].data].length).toBeGreaterThan(0)
  })
  it('stores records byte for byte under their own names, with versions for conflicts', async () => {
    const a = new Client(base)
    await a.signup('iris')
    const files = [{ name: 'SAVGAMB.DAT', data: bytes(3000, 2) }, { name: 'CHRDATB1.SAV', data: bytes(285, 3) }, { name: 'CHRDATB1.ITM', data: new Uint8Array(0) }, { name: 'SAVGAMB.GBR', data: new TextEncoder().encode('{"x":1}') }]
    const r1 = await a.put('coab', 'saves', 'B', 0, files, { label: 'slot B', modifiedAt: 5 })
    expect(r1.status).toBe(200)
    const v1 = r1.data.updatedAt
    const dir = join(app.accounts.usersDir, 'iris', 'coab', 'saves', `B@${v1}`)
    for (const f of files) expect(new Uint8Array(readFileSync(join(dir, f.name)))).toEqual(f.data)
    const back = (await a.get('coab', 'saves', 'B')).data
    expect(back.files.map((f: { name: string; data: string }) => [f.name, Buffer.from(f.data, 'base64').equals(Buffer.from(files.find((x) => x.name === f.name)!.data))])).toEqual(files.map((f) => [f.name, true]))
    expect(back.meta).toEqual({ label: 'slot B', modifiedAt: 5 })
    // a writer that has not seen v1 is refused and told the current version
    const stale = await a.put('coab', 'saves', 'B', 0, files)
    expect(stale.status).toBe(409)
    expect(stale.data.updatedAt).toBe(v1)
    const r2 = await a.put('coab', 'saves', 'B', v1, files.slice(0, 1), { label: 'again' })
    expect(r2.status).toBe(200)
    expect(r2.data.updatedAt).toBeGreaterThan(v1)
    expect(existsSync(dir)).toBe(false) // the old version is gone
    expect((await a.req('DELETE', `/api/v1/games/coab/saves/B?base=${v1}`)).status).toBe(409)
    expect((await a.req('DELETE', `/api/v1/games/coab/saves/B?base=${r2.data.updatedAt}`)).status).toBe(200)
    expect((await a.get('coab', 'saves', 'B')).status).toBe(404)
    // documents are small JSON beside the folders
    expect((await a.put('coab', 'docs', 'party', 0, [], { stems: ['CHRDATA1'] })).status).toBe(200)
    expect(JSON.parse(readFileSync(join(app.accounts.usersDir, 'iris', 'coab', 'party.json'), 'utf8')).meta).toEqual({ stems: ['CHRDATA1'] })
  })
  it('enforces the storage quota with a clear error, counting replaced records once', async () => {
    await app.close()
    await start({ quota: 10_000 })
    const a = new Client(base)
    await a.signup('jack')
    const r1 = await a.put('por', 'saves', 'A', 0, [{ name: 'A.DAT', data: bytes(6000) }])
    expect(r1.status).toBe(200)
    const r2 = await a.put('por', 'saves', 'A', r1.data.updatedAt, [{ name: 'A.DAT', data: bytes(7000) }])
    expect(r2.status).toBe(200) // replacing frees the old copy
    const over = await a.put('por', 'saves', 'B', 0, [{ name: 'B.DAT', data: bytes(5000) }])
    expect(over.status).toBe(507)
    expect(over.data.error).toMatch(/quota/)
    expect((await a.me()).data.used).toBeGreaterThan(7000)
  })
  it('limits the size of a request', async () => {
    const a = new Client(base)
    await a.signup('kate')
    expect((await a.put('por', 'saves', 'A', 0, [{ name: 'A.DAT', data: new Uint8Array(1024 * 1024 + 1) }])).status).toBe(413)
  })
  it('serialises concurrent writes to one record: exactly one wins', async () => {
    const a = new Client(base)
    await a.signup('liam')
    const rs = await Promise.all([1, 2, 3, 4, 5].map((n) => a.put('por', 'saves', 'C', 0, [{ name: 'C.DAT', data: bytes(500, n) }])))
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1)
    expect(rs.filter((r) => r.status === 409)).toHaveLength(4)
    expect(readdirSync(join(app.accounts.usersDir, 'liam', 'por', 'saves')).filter((n) => n.startsWith('C@'))).toHaveLength(1)
  })
  it('exports everything as a ZIP in the original formats', async () => {
    const a = new Client(base)
    await a.signup('mona')
    await a.put('por', 'saves', 'A', 0, [{ name: 'SAVGAMA.DAT', data: bytes(100) }], { label: 'x' })
    await a.put('por', 'characters', 'ALIAS', 0, [{ name: 'ALIAS.CHA', data: bytes(285) }])
    await a.put('por', 'docs', 'settings', 0, [], { values: { 'poolrad.sound': 'off' } })
    const r = await a.req('GET', '/api/v1/export')
    expect(r.headers.get('content-type')).toBe('application/zip')
    expect(r.headers.get('content-disposition')).toMatch(/attachment; filename="goldbox-rerolled-mona-/)
    const files = await unzip(r.data)
    const names = files.map((f) => f.name)
    expect(names).toEqual(expect.arrayContaining(['README.txt', 'por/saves/A/SAVGAMA.DAT', 'por/saves/A/record.json', 'por/characters/ALIAS/ALIAS.CHA', 'por/settings.json']))
    expect(files.find((f) => f.name === 'por/characters/ALIAS/ALIAS.CHA')!.data).toEqual(bytes(285))
    expect((await new Client(base).req('GET', '/api/v1/export')).status).toBe(401)
  })
  it('deletes an account and all its data with the password', async () => {
    const a = new Client(base)
    await a.signup('nina')
    await a.put('por', 'saves', 'A', 0, [{ name: 'SAVGAMA.DAT', data: bytes(100) }])
    expect((await a.req('POST', '/api/v1/delete-account', { password: 'wrong password' })).status).toBe(403)
    expect((await a.req('POST', '/api/v1/delete-account', { password: 'a long password' })).status).toBe(200)
    expect(existsSync(join(app.accounts.usersDir, 'nina'))).toBe(false)
    expect(readdirSync(app.accounts.usersDir)).toEqual([])
    expect(readdirSync(app.accounts.sessionsDir)).toEqual([]) // its sessions too
    expect((await a.me()).data.user).toBeNull()
    const again = new Client(base)
    expect((await again.signup('nina')).status).toBe(200) // the name is free again
    expect((await again.get('por', 'saves', 'A')).status).toBe(404)
  })
})

const dir = process.env.POOLRAD ?? ''
describe.skipIf(!dir || !existsSync(join(dir, 'SAVGAMA.DAT')))('server: a real saved game', () => {
  it('keeps SAVGAMA.DAT and the CHRDAT files byte for byte, ready for DOSBox', async () => {
    await start()
    const a = new Client(base)
    await a.signup('olga')
    const dat = new Uint8Array(readFileSync(join(dir, 'SAVGAMA.DAT')))
    const files = [{ name: 'SAVGAMA.DAT', data: dat }]
    for (const s of parseSave(dat).party) for (const ext of ['SAV', 'ITM', 'SPC']) {
      const p = join(dir, `${s}.${ext}`)
      if (existsSync(p)) files.push({ name: `${s}.${ext}`, data: new Uint8Array(readFileSync(p)) })
    }
    const r = await a.put('por', 'saves', 'A', 0, files, { label: 'shipped' })
    const onDisk = join(app.accounts.usersDir, 'olga', 'por', 'saves', `A@${r.data.updatedAt}`)
    for (const f of files) expect(Buffer.compare(readFileSync(join(onDisk, f.name)), Buffer.from(f.data)), f.name).toBe(0)
  })
})

describe('admin CLI', () => {
  const run = (dataDir: string, args: string[], input = '') =>
    spawnSync(process.execPath, [join(import.meta.dirname, '..', '..', 'server', 'admin.ts'), ...args], { env: { ...process.env, DATA_DIR: dataDir }, input, encoding: 'utf8' })
  it('adds, lists, locks, resets, invites, prunes and removes', async () => {
    const d = temp()
    const add = run(d, ['add-user', 'Tristan'], 'a long password\n')
    expect(add.status, add.stderr).toBe(0)
    expect(add.stdout).toMatch(/Created tristan\. Recovery code .*: ([0-9A-Z]{4}-){4}[0-9A-Z]{4}/)
    expect(run(d, ['add-user', 'shorty'], 'short\n').status).toBe(1)
    expect(run(d, ['list-users']).stdout).toMatch(/^tristan /m)
    await start({ dataDir: d })
    const c = new Client(base)
    expect((await c.login('tristan')).status).toBe(200)
    expect(run(d, ['disable-user', 'tristan']).status).toBe(0)
    expect((await c.me()).data.user).toBeNull()
    expect((await new Client(base).login('tristan')).status).toBe(403)
    expect(run(d, ['list-users']).stdout).toMatch(/LOCKED/)
    run(d, ['enable-user', 'tristan'])
    expect(run(d, ['reset-password', 'tristan'], 'another long one\n').stdout).toMatch(/New recovery code/)
    expect((await new Client(base).login('tristan', 'another long one')).status).toBe(200)
    const inv = run(d, ['create-invite', '--days', '2'])
    expect(inv.stdout).toMatch(/Invite code .*: ([0-9A-Z]{4}-){4}[0-9A-Z]{4}/)
    expect(run(d, ['stats']).stdout).toMatch(/accounts\s+1 .*\n.*sessions\s+\d+ stored\n.*invites\s+1 open/)
    expect(run(d, ['prune']).stdout).toMatch(/Deleted \d+ expired sessions and 0 expired invites/)
    expect(run(d, ['remove-user', 'tristan']).stdout).toMatch(/Not deleted/)
    expect(run(d, ['remove-user', 'tristan', '--yes']).stdout).toMatch(/deleted/)
    expect(existsSync(join(d, 'users', 'tristan'))).toBe(false)
    expect(run(d, ['bogus']).status).toBe(2)
  })
})
