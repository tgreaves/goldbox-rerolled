// The browser's sync layer (src/store/sync.ts, records.ts, api.ts) against a real server: merge
// rules, conflict copies, the offline queue, deletions, seeded characters, refusals and the codec.
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, type App } from '../../server/app.ts'
import { HttpApi } from '../src/store/api'
import { Sync, type LocalSide, type SyncState } from '../src/store/sync'
import { charToRec, recToChar, recToSave, saveToRec, sameRec, type Rec } from '../src/store/records'
import { COAB, POR, setGame } from '../src/games/profile'

const temps: string[] = []
afterAll(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })

let app: App
let base = ''
async function start(quota = 20 * 1024 * 1024) {
  const dataDir = mkdtempSync(join(tmpdir(), 'gbr-sync-'))
  const webRoot = mkdtempSync(join(tmpdir(), 'gbr-web-'))
  temps.push(dataDir, webRoot)
  mkdirSync(join(webRoot, 'assets'))
  writeFileSync(join(webRoot, 'index.html'), 'x')
  app = await createApp({ port: 0, host: '127.0.0.1', dataDir, webRoot, cookieSecure: false, trustProxy: false, signup: 'open',
    maxUsers: 100, quota, sessionTtl: 3600_000, scryptN: 1 << 10, logRequests: false })
  base = `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}`
  await app.accounts.create('player', 'a long password')
}
beforeEach(() => start())
afterEach(() => app.close())

/** One browser: an in-memory store, its saved sync state, a clock and a connection that can drop. */
function browser() {
  let cookie = ''
  let offline = false
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    if (offline) throw new TypeError('fetch failed')
    const headers = new Headers(init.headers)
    if (cookie) headers.set('Cookie', cookie)
    const r = await fetch(url, { ...init, headers })
    const sc = r.headers.get('set-cookie')
    if (sc) cookie = sc.split(';')[0]
    return r
  }) as typeof fetch
  const api = new HttpApi(`${base}/api/v1/`, fetcher)
  const store = new Map<string, Rec>()
  const local: LocalSide = {
    keys: async () => [...store.keys()],
    get: async (k) => store.get(k) ?? null,
    put: async (k, r) => { store.set(k, r) },
    remove: async (k) => { store.delete(k) },
  }
  let saved: SyncState | null = null
  let t = 1_000
  let n = 0
  const changed: string[] = []
  const make = () => new Sync({ game: 'por', api, local, state: { load: () => saved && structuredClone(saved), save: (s) => { saved = structuredClone(s) } },
    now: () => t, newId: () => `copy${++n}`, changed: (k) => changed.push(...k) })
  const b = {
    api, store, changed,
    sync: make(),
    at(time: number) { t = time; return b },
    set offline(v: boolean) { offline = v },
    /** the page reloads: a new engine from the saved state */
    reload() { b.sync = make() },
    write(key: string, rec: Rec) { store.set(key, rec); b.sync.noteChange(key) },
    remove(key: string) { store.delete(key); b.sync.noteChange(key) },
    login: () => api.call('POST', 'login', { user: 'player', password: 'a long password' }),
  }
  return b
}

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 13 + seed) & 0xff)
const save = (slot: string, seed: number, savedAt = 0): Rec => ({ meta: { slot, label: `save ${seed}`, savedAt, members: [] }, files: [{ name: `SAVGAM${slot}.DAT`, data: bytes(200, seed) }] })
const char = (stem: string, seed: number): Rec => ({ meta: {}, files: [{ name: `${stem}.CHA`, data: bytes(285, seed) }] })
const seedOf = (r: Rec | null | undefined) => r?.files[0]?.data[0]

describe('sync: merging', () => {
  it('sends a browser\'s existing data on first sign-in and brings it to another browser', async () => {
    const a = browser(), b = browser()
    a.store.set('saves/A', save('A', 1, 500))
    a.store.set('characters/ALIAS', char('ALIAS', 2))
    a.store.set('docs/party', { meta: { stems: ['ALIAS'] }, files: [] })
    await a.login()
    await a.sync.pull()
    expect(a.sync.pending()).toBe(0)
    await b.login()
    await b.sync.pull()
    for (const k of ['saves/A', 'characters/ALIAS', 'docs/party']) expect(sameRec(b.store.get(k)!, a.store.get(k)!), k).toBe(true)
    expect(b.changed.sort()).toEqual(['characters/ALIAS', 'docs/party', 'saves/A'])
  })
  it('takes a change made on one side only', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.at(2000).write('saves/B', save('B', 3, 2000))
    await a.sync.flush()
    await b.sync.pull()
    expect(seedOf(b.store.get('saves/B'))).toBe(seedOf(save('B', 3)))
    b.at(3000).write('saves/B', save('B', 4, 3000))
    await b.sync.flush()
    await a.sync.pull()
    expect(seedOf(a.store.get('saves/B'))).toBe(seedOf(save('B', 4)))
    expect([...a.store.keys()].filter((k) => k.startsWith('conflicts/'))).toEqual([])
  })
  it('on a clash keeps the newer change and the older as a conflict copy, either way round', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.at(1000).write('saves/C', save('C', 5, 1000))
    await a.sync.flush()
    await b.sync.pull()
    // both change C; A's change is older but reaches the server first
    a.at(2000).write('saves/C', save('C', 6, 2000))
    b.at(3000).write('saves/C', save('C', 7, 3000))
    await a.sync.flush()
    await b.sync.flush()
    expect(seedOf(b.store.get('saves/C'))).toBe(seedOf(save('C', 7)))
    const copyB = b.store.get('conflicts/copy1')!
    expect(copyB.meta).toMatchObject({ conflictOf: 'saves', conflictId: 'C', from: 'server' })
    expect(seedOf(copyB)).toBe(seedOf(save('C', 6)))
    expect(b.sync.pending()).toBe(0)
    // A hears of it: the newer save and the copy of its own
    await a.sync.pull()
    expect(seedOf(a.store.get('saves/C'))).toBe(seedOf(save('C', 7)))
    expect(seedOf(a.store.get('conflicts/copy1'))).toBe(seedOf(save('C', 6)))
    // now the other way: B's change is older and arrives second
    a.at(5000).write('characters/X', char('X', 8))
    await a.sync.flush()
    await b.sync.pull()
    b.at(5500).write('characters/X', char('X', 9))
    a.at(6000).write('characters/X', char('X', 10))
    await a.sync.flush()
    await b.sync.flush()
    expect(seedOf(b.store.get('characters/X'))).toBe(seedOf(char('X', 10)))
    const copy = [...b.store.entries()].find(([k, v]) => k.startsWith('conflicts/') && v.meta.conflictId === 'X')![1]
    expect(copy.meta.from).toBe('browser')
    expect(seedOf(copy)).toBe(seedOf(char('X', 9)))
  })
  it('makes no copy when both sides hold the same thing', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.store.set('saves/D', save('D', 11, 100))
    b.store.set('saves/D', save('D', 11, 100))
    await a.sync.pull()
    await b.sync.pull()
    expect([...b.store.keys()].some((k) => k.startsWith('conflicts/'))).toBe(false)
  })
  it('keeps an old save from before signing in as a copy when the server has a newer one', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.at(9000).write('saves/E', save('E', 12, 9000))
    await a.sync.flush()
    b.store.set('saves/E', save('E', 13, 100)) // made offline long ago, never synced
    await b.sync.pull()
    expect(seedOf(b.store.get('saves/E'))).toBe(seedOf(save('E', 12)))
    expect(seedOf(b.store.get('conflicts/copy1'))).toBe(seedOf(save('E', 13)))
  })
  it('lets the server\'s characters beat the ones seeded from the game files, without copies', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.write('characters/CHRDATA1', char('CHRDATA1', 20)) // played on, then synced
    await a.sync.flush()
    b.store.set('characters/CHRDATA1', char('CHRDATA1', 21))
    b.sync.noteChange('characters/CHRDATA1', 'seed')
    b.store.set('characters/CHRDATA2', char('CHRDATA2', 22))
    b.sync.noteChange('characters/CHRDATA2', 'seed')
    await b.sync.pull()
    expect(seedOf(b.store.get('characters/CHRDATA1'))).toBe(seedOf(char('CHRDATA1', 20)))
    expect([...b.store.keys()].some((k) => k.startsWith('conflicts/'))).toBe(false)
    await a.sync.pull()
    expect(seedOf(a.store.get('characters/CHRDATA2'))).toBe(seedOf(char('CHRDATA2', 22))) // new on the server
  })
  it('settles settings and the party by the newer change, without copies', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.at(100).write('docs/settings', { meta: { values: { 'poolrad.sound': 'off' } }, files: [] })
    await a.sync.flush()
    await b.sync.pull()
    a.at(200).write('docs/settings', { meta: { values: { 'poolrad.sound': 'tandy' } }, files: [] })
    b.at(300).write('docs/settings', { meta: { values: { 'poolrad.sound': 'pc' } }, files: [] })
    await a.sync.flush()
    await b.sync.flush()
    await a.sync.pull()
    expect(a.store.get('docs/settings')!.meta.values).toEqual({ 'poolrad.sound': 'pc' })
    expect([...a.store.keys(), ...b.store.keys()].some((k) => k.startsWith('conflicts/'))).toBe(false)
  })
  it('carries the vault (folder/VAULT, VAULT.DAT) to another browser; the newer change wins, without copies', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    const vault = (seed: number): Rec => ({ meta: {}, files: [{ name: 'VAULT.DAT', data: bytes(0x1c + 67, seed) }] })
    a.at(100).write('folder/VAULT', vault(1))
    await a.sync.flush()
    await b.sync.pull()
    expect(seedOf(b.store.get('folder/VAULT'))).toBe(seedOf(vault(1)))
    a.at(200).write('folder/VAULT', vault(2))
    b.at(300).write('folder/VAULT', vault(3))
    await a.sync.flush()
    await b.sync.flush()
    await a.sync.pull()
    expect(seedOf(a.store.get('folder/VAULT'))).toBe(seedOf(vault(3)))
    expect([...a.store.keys(), ...b.store.keys()].some((k) => k.startsWith('conflicts/'))).toBe(false)
  })
})

describe('sync: deletions and the queue', () => {
  it('passes deletions on, but a change beats a deletion', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.write('characters/GONE', char('GONE', 1))
    a.write('characters/KEPT', char('KEPT', 2))
    await a.sync.flush()
    await b.sync.pull()
    a.remove('characters/GONE')
    await a.sync.flush()
    await b.sync.pull()
    expect(b.store.has('characters/GONE')).toBe(false)
    // B changes KEPT while A deletes it
    a.remove('characters/KEPT')
    b.at(5000).write('characters/KEPT', char('KEPT', 3))
    await a.sync.flush()
    await b.sync.flush()
    await a.sync.pull()
    expect(seedOf(a.store.get('characters/KEPT'))).toBe(seedOf(char('KEPT', 3)))
  })
  it('queues changes while offline, across a reload, and sends them later', async () => {
    const a = browser(), b = browser()
    await a.login(); await b.login()
    a.offline = true
    a.write('saves/F', save('F', 30, 10))
    a.write('characters/OFF', char('OFF', 31))
    await expect(a.sync.flush()).rejects.toThrow()
    expect(a.sync.pending()).toBe(2)
    a.reload()
    expect(a.sync.pending()).toBe(2)
    a.offline = false
    await a.sync.flush()
    expect(a.sync.pending()).toBe(0)
    await b.sync.pull()
    expect(seedOf(b.store.get('saves/F'))).toBe(seedOf(save('F', 30)))
  })
  it('notes a record the server refuses and goes on with the rest', async () => {
    const a = browser()
    await a.login()
    a.write('characters/lower', char('lower', 1)) // not a DOS name
    a.write('characters/GOOD', char('GOOD', 2))
    await a.sync.flush()
    expect(a.sync.pending()).toBe(0)
    expect(Object.keys(a.sync.state.errors)).toEqual(['characters/lower'])
    expect((await a.api.list('por')).map((l) => l.id)).toEqual(['GOOD'])
  })
  it('stops at a full quota and keeps the changes queued', async () => {
    await app.close()
    await start(1000)
    const a = browser()
    await a.login()
    a.write('saves/G', { meta: { slot: 'G' }, files: [{ name: 'SAVGAMG.DAT', data: bytes(5000, 1) }] })
    await a.sync.flush()
    expect(a.sync.state.quotaFull).toBe(true)
    expect(a.sync.pending()).toBe(1)
  })
  it('needs a session', async () => {
    const a = browser()
    a.write('saves/A', save('A', 1))
    await expect(a.sync.flush()).rejects.toThrow(/signed out/)
    expect(a.sync.pending()).toBe(1)
  })
})

describe('records: the original formats', () => {
  afterEach(() => setGame(POR))
  it('round-trips a saved game with its sidecar, naming files as the original does', () => {
    setGame(POR)
    const g = { slot: 'C', dat: bytes(300, 1), label: 'L', savedAt: 7, known: ['journal:3'],
      chars: [{ sav: bytes(285, 2), itm: bytes(63, 3), spc: undefined }, { sav: bytes(285, 4), itm: undefined, spc: bytes(9, 5) }] }
    const r = saveToRec(g)
    expect(r.files.map((f) => f.name)).toEqual(['SAVGAMC.DAT', 'CHRDATC1.SAV', 'CHRDATC1.ITM', 'CHRDATC2.SAV', 'CHRDATC2.SPC', 'SAVGAMC.GBR'])
    const back = recToSave(r)!
    expect(back).toEqual(g)
  })
  it('uses each game\'s own extensions for roster characters', () => {
    setGame(COAB)
    const c = { stem: 'ALIAS', sav: bytes(400, 1), itm: bytes(10, 2), spc: bytes(9, 3) }
    const r = charToRec(c)
    expect(r.files.map((f) => f.name)).toEqual(['ALIAS.GUY', 'ALIAS.SWG', 'ALIAS.FX'])
    expect(recToChar('ALIAS', r)).toEqual(c)
    setGame(POR)
    expect(charToRec(c).files.map((f) => f.name)).toEqual(['ALIAS.CHA', 'ALIAS.ITM', 'ALIAS.SPC'])
  })
})
