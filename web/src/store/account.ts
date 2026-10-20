// The browser's side of accounts and automatic sync (IMP-072, docs/server.md). Hidden when no
// GoldBox Rerolled server answers beside the app (GitHub Pages, the single-file build, `vite dev`).
// Every change goes to the browser's stores first; when signed in it is then sent to the server,
// queued while offline. Signing in (and starting the app signed in) merges the server's records.
// The imported game files are never uploaded.
import { GAMES, type GameProfile } from '../games/profile'
import { ApiError, HttpApi, type ServerConfig } from './api'
import { onLocalChange } from './changes'
import { Sync, type LocalSide, type SyncState } from './sync'
import { forgetUserData, userLocal } from './user'
import type { Rec } from './records'

/** Browser settings that travel with the account (the rest, like the last game played, stay per device). */
export const SYNCED_SETTINGS = ['poolrad.sound', 'poolrad.font', 'poolrad.frames', 'poolrad.partylayout', 'poolrad.motion', 'poolrad.textsize', 'poolrad.gfx']
const OWNER_KEY = 'goldbox.account'
const stateKey = (g: string) => `goldbox.sync.${g}`

export interface AccountStatus {
  /** a GoldBox Rerolled server answers here (null: not known yet) */
  available: boolean | null
  config: ServerConfig | null
  user: string | null
  /** whose data this browser holds (the last account signed in here) */
  owner: string | null
  online: boolean
  busy: boolean
  pending: number
  lastSync: number
  /** last problem, in words */
  error: string
  /** records the server refused */
  refused: number
  used?: number
}

const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* this page only */ } },
  del(k: string) { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

const settingsLocal: LocalSide = {
  async keys() { return SYNCED_SETTINGS.some((k) => ls.get(k) !== null) ? ['docs/settings'] : [] },
  async get() {
    const values: Record<string, string> = {}
    for (const k of SYNCED_SETTINGS) { const v = ls.get(k); if (v !== null) values[k] = v }
    return Object.keys(values).length ? { meta: { values }, files: [] } : null
  },
  async put(_key: string, rec: Rec) {
    const values = (rec.meta.values ?? {}) as Record<string, unknown>
    for (const k of SYNCED_SETTINGS) {
      const v = values[k]
      if (typeof v === 'string') ls.set(k, v)
      else ls.del(k)
    }
    for (const f of settingsListeners) f()
  },
  async remove() { for (const k of SYNCED_SETTINGS) ls.del(k); for (const f of settingsListeners) f() },
}

/** The browser's records: IndexedDB for the active game, plus the synced settings. */
const local: LocalSide = {
  async keys() { return [...(await userLocal.keys()), ...(await settingsLocal.keys())] },
  get: (k) => (k === 'docs/settings' ? settingsLocal.get(k) : userLocal.get(k)),
  put: (k, r) => (k === 'docs/settings' ? settingsLocal.put(k, r) : userLocal.put(k, r)),
  remove: (k) => (k === 'docs/settings' ? settingsLocal.remove(k) : userLocal.remove(k)),
}

const statusListeners = new Set<(s: AccountStatus) => void>()
const pulledListeners = new Set<(keys: string[]) => void>()
const settingsListeners = new Set<() => void>()

let api: HttpApi | null = null
let sync: Sync | null = null
let status: AccountStatus = { available: null, config: null, user: null, owner: ls.get(OWNER_KEY), online: true, busy: false, pending: 0, lastSync: 0, error: '', refused: 0 }
let flushTimer: ReturnType<typeof setTimeout> | undefined
let started = false

function emit(patch: Partial<AccountStatus> = {}) {
  status = { ...status, ...patch, pending: sync?.pending() ?? 0, lastSync: sync?.state.lastSync ?? 0, refused: Object.keys(sync?.state.errors ?? {}).length }
  for (const f of statusListeners) f(status)
}

export const accountStatus = () => status
export function onAccountStatus(f: (s: AccountStatus) => void) { statusListeners.add(f); return () => { statusListeners.delete(f) } }
/** The merge changed records in this browser (redraw the roster, saves, …). */
export function onPulled(f: (keys: string[]) => void) { pulledListeners.add(f); return () => { pulledListeners.delete(f) } }
/** Settings came from the server (apply them). */
export function onSettingsPulled(f: () => void) { settingsListeners.add(f); return () => { settingsListeners.delete(f) } }

function stateStore(game: string) {
  return {
    load: (): SyncState | null => { try { return JSON.parse(ls.get(stateKey(game)) ?? 'null') as SyncState | null } catch { return null } },
    save: (s: SyncState) => ls.set(stateKey(game), JSON.stringify(s)),
  }
}

/** Problems in words; also notes a lost session or connection. */
function trouble(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.signedOut) { emit({ user: null }); return 'Your session ended: sign in again.' }
    return e.message
  }
  emit({ online: false })
  return 'The server cannot be reached: changes wait in this browser.'
}

async function guarded(f: () => Promise<void>) {
  emit({ busy: true })
  try {
    await f()
    emit({ busy: false, online: true, error: sync?.state.quotaFull ? 'Your storage on the server is full: delete conflict copies or saves you no longer need.' : '' })
  } catch (e) {
    emit({ busy: false, error: trouble(e) })
  }
}

/** Called once a game is open: sync that game's records. */
export async function startAccount(g: GameProfile) {
  api ??= new HttpApi(new URL('api/v1/', document.baseURI).href)
  sync = new Sync({ game: g.id, api, local, state: stateStore(g.id), changed: (keys) => { for (const f of pulledListeners) f(keys) } })
  if (!started) {
    started = true
    onLocalChange((key, how) => {
      sync?.noteChange(key, how)
      emit()
      if (status.user) scheduleFlush()
    })
    addEventListener('online', () => { if (status.user) void syncNow() })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && status.user && Date.now() - (sync?.state.lastSync ?? 0) > 30_000) void syncNow()
    })
    setInterval(() => { if (status.user && (sync?.pending() ?? 0) > 0) void flushNow() }, 60_000)
  }
  emit()
  await probe()
  if (status.user) await syncNow()
}

/** Ask the server who is signed in. */
export async function probe() {
  try {
    const me = await api!.me()
    if (!me) { emit({ available: false, user: null }); return }
    emit({ available: true, online: true, config: me, user: me.user, used: me.used })
  } catch {
    // offline: keep showing the account this browser belongs to
    emit({ available: status.owner ? true : status.available ?? false, online: false })
  }
}

function scheduleFlush() {
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flushNow(), 1500)
}

export function flushNow() { return guarded(async () => { await sync?.flush() }) }

export function syncNow() {
  return guarded(async () => {
    await sync?.pull()
    const me = await api!.me().catch(() => null)
    if (me) emit({ used: me.used, config: me })
  })
}

/** Signing in as someone else replaces this browser's copy: who owns it now, and how much is unsent. */
export function ownerClash(name: string): { owner: string; pending: number } | null {
  const n = name.trim().toLowerCase()
  return status.owner && status.owner !== n ? { owner: status.owner, pending: sync?.pending() ?? 0 } : null
}

async function forgetAll() {
  await forgetUserData(GAMES.map((g) => g.stores.user))
  for (const g of GAMES) ls.del(stateKey(g.id))
  sync?.reset()
}

async function signedIn(user: string) {
  if (status.owner && status.owner !== user) await forgetAll()
  ls.set(OWNER_KEY, user)
  emit({ user, owner: user, error: '' })
  for (const f of pulledListeners) f([])
  await syncNow()
}

async function post<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  return (await api!.call<T>('POST', path, body)).data
}

export async function signIn(user: string, password: string) {
  const r = await post<{ user: string }>('login', { user, password })
  await signedIn(r.user)
}

/** A new account; returns its recovery code (shown once). */
export async function signUp(user: string, password: string, invite?: string): Promise<string> {
  const r = await post<{ user: string; recoveryCode: string }>('signup', { user, password, invite })
  await signedIn(r.user)
  return r.recoveryCode
}

/** A forgotten password: the recovery code sets a new one; returns the next recovery code. */
export async function recover(user: string, code: string, newPassword: string): Promise<string> {
  const r = await post<{ user: string; recoveryCode: string }>('recover', { user, code, newPassword })
  await signedIn(r.user)
  return r.recoveryCode
}

export async function changePassword(password: string, newPassword: string) {
  await post('password', { password, newPassword })
}

export async function newRecoveryCode(password: string): Promise<string> {
  return (await post<{ recoveryCode: string }>('recovery-code', { password })).recoveryCode
}

/** Sign out; with forget, this browser's copy of the player's data (every game) is removed too. */
export async function signOut(forget = false) {
  if (status.user && (sync?.pending() ?? 0) > 0) await flushNow()
  await post('logout', {}).catch(() => {})
  if (forget) {
    await forgetAll()
    ls.del(OWNER_KEY)
  }
  emit({ user: null, owner: forget ? null : status.owner })
  if (forget) for (const f of pulledListeners) f([])
}

/** Delete the account and everything the server keeps for it. This browser's copy stays, unlinked. */
export async function deleteAccount(password: string) {
  await post('delete-account', { password })
  for (const g of GAMES) ls.del(stateKey(g.id))
  sync?.reset()
  ls.del(OWNER_KEY)
  emit({ user: null, owner: null })
}

export const exportUrl = () => (api ? `${api.base}export` : '')

