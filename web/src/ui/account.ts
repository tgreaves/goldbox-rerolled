// Settings → Account (IMP-072): sign in, create an account, recover a forgotten password, the sync
// status and conflict copies, and the account's own management (password, recovery code, data
// export, deletion, privacy). Shown only when a GoldBox Rerolled server answers beside the app.
import {
  accountStatus, changePassword, deleteAccount, exportUrl, newRecoveryCode, onAccountStatus, ownerClash, recover,
  signIn, signOut, signUp, syncNow, type AccountStatus,
} from '../store/account'
import { deleteConflict, listConflicts, restoreConflict, type ConflictCopy } from '../store/user'
import { escape } from './sheet'

type Mode = 'view' | 'signup' | 'recover' | 'password' | 'newcode' | 'delete' | 'privacy' | 'code'
/** survives the settings panel redrawing itself */
const ui: { mode: Mode; message: string; code: string } = { mode: 'view', message: '', code: '' }

const PRIVACY = `<h3>Privacy</h3>
  <p>When you have an account, this server keeps:</p>
  <ul>
    <li>your account name, and your password and recovery code only as salted hashes;</li>
    <li>your saved games and autosave, characters, party, journal finds and the settings shown here, for each game;</li>
    <li>while you are signed in, one session cookie (the only cookie; it is needed to sign in).</li>
  </ul>
  <p>No email address, no tracking, analytics or adverts. The imported game files (the DAX files, <code>START.EXE</code> and the rest) never leave this browser.
  To limit sign-in and sign-up attempts the server counts them per network address in memory only: never written to disk, forgotten within the hour.
  Its log notes the time, kind and result of requests, not your address or your data.</p>
  <p>You can download everything kept for you (<em>Download my data</em>) and delete your account, which removes it all from the server straight away.
  Questions about this server go to whoever runs it.</p>`

const mb = (n = 0) => (n / 1024 / 1024).toFixed(1)
const when = (t: number) => (t ? new Date(t).toLocaleString() : 'never')

function field(label: string, name: string, type = 'text', auto = '', extra = '') {
  return `<label class="acct-field"><span>${label}</span><input name="${name}" type="${type}" autocomplete="${auto}" ${extra}></label>`
}

function render(s: AccountStatus, gameOpen = true): string {
  if (s.available !== true) return ''
  const min = s.config?.passwordMin ?? 10
  const head = `<h3>Account</h3>`
  const msg = ui.message ? `<p class="message" role="status">${escape(ui.message)}</p>` : ''
  const note = `<p class="muted">The game files (the DAX files, <code>START.EXE</code> and the rest) are never uploaded: each browser needs its own import.</p>`
  const back = `<button type="button" data-mode="view">Back</button>`
  switch (ui.mode) {
    case 'code':
      return `${head}<p>Your recovery code:</p><p class="acct-code"><strong>${escape(ui.code)}</strong></p>
        <p class="muted">Keep it somewhere safe (a password manager, or on paper). With your name it sets a new password if you forget yours, and it is shown only now. There is no email recovery.</p>
        <div class="nc-opts"><button type="button" class="primary" data-mode="view">I have kept it</button></div>`
    case 'privacy':
      return `${head}${PRIVACY}<div class="nc-opts">${back}</div>`
    case 'signup':
      return `${head}${msg}<form class="acct" data-form="signup">
        ${field('Name', 'user', 'text', 'username', 'required minlength="3" maxlength="24" pattern="[A-Za-z0-9_\\-]{3,24}"')}
        ${field('Password', 'password', 'password', 'new-password', `required minlength="${min}"`)}
        ${field('Again', 'again', 'password', 'new-password', `required minlength="${min}"`)}
        ${s.config?.signup === 'invite' ? field('Invite code', 'invite', 'text', 'off', 'required') : ''}
        <p class="muted">A name of 3 to 24 letters, digits, - or _; a password of at least ${min} characters. No email address is asked for: you will be shown a recovery code to keep instead.</p>
        <div class="nc-opts"><button class="primary">Create account</button>${back}</div></form>${note}`
    case 'recover':
      return `${head}${msg}<form class="acct" data-form="recover">
        ${field('Name', 'user', 'text', 'username', 'required')}
        ${field('Recovery code', 'code', 'text', 'off', 'required')}
        ${field('New password', 'password', 'password', 'new-password', `required minlength="${min}"`)}
        ${field('Again', 'again', 'password', 'new-password', `required minlength="${min}"`)}
        <p class="muted">The recovery code you were shown when the account was made (or last recovered). It sets a new password, signs you out everywhere else and gives you a new code.</p>
        <div class="nc-opts"><button class="primary">Set new password</button>${back}</div></form>`
    case 'password':
      return `${head}${msg}<form class="acct" data-form="password">
        ${field('Current password', 'current', 'password', 'current-password', 'required')}
        ${field('New password', 'password', 'password', 'new-password', `required minlength="${min}"`)}
        ${field('Again', 'again', 'password', 'new-password', `required minlength="${min}"`)}
        <p class="muted">Signs you out on every other browser.</p>
        <div class="nc-opts"><button class="primary">Change password</button>${back}</div></form>`
    case 'newcode':
      return `${head}${msg}<form class="acct" data-form="newcode">
        ${field('Password', 'current', 'password', 'current-password', 'required')}
        <p class="muted">A new recovery code; the old one stops working.</p>
        <div class="nc-opts"><button class="primary">New recovery code</button>${back}</div></form>`
    case 'delete':
      return `${head}${msg}<form class="acct" data-form="delete">
        <p>This deletes your account and everything the server keeps for it (saved games, characters, settings, for every game). It cannot be undone. This browser keeps its own copy.</p>
        ${field('Password', 'current', 'password', 'current-password', 'required')}
        <div class="nc-opts"><button class="primary">Delete my account</button>${back}</div></form>`
  }
  if (!s.user) {
    return `${head}${msg}
      <p class="muted">With an account your saved games, autosave, characters, party, journal finds and these settings are kept on this server and come to any browser you sign in on. Without one everything stays in this browser, as before.</p>
      ${s.owner ? `<p class="muted">This browser holds ${escape(s.owner)}'s data${s.pending ? ` (${s.pending} changes not on the server yet)` : ''}.</p>` : ''}
      ${s.online ? '' : '<p class="message">The server cannot be reached just now.</p>'}
      <form class="acct" data-form="signin">
        ${field('Name', 'user', 'text', 'username', 'required')}
        ${field('Password', 'password', 'password', 'current-password', 'required')}
        <div class="nc-opts"><button class="primary">Sign in</button>${s.config?.signup !== 'off' ? '<button type="button" data-mode="signup">Create account</button>' : ''}<button type="button" data-mode="recover">Forgot password</button><button type="button" data-mode="privacy">Privacy</button></div>
      </form>${note}`
  }
  const bits = [
    s.busy ? 'syncing…' : `last synced ${when(s.lastSync)}`,
    s.pending ? `${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : 'nothing waiting',
    ...(s.refused ? [`${s.refused} not accepted by the server`] : []),
    ...(s.used !== undefined && s.config ? [`${mb(s.used)} of ${mb(s.config.quota)} MB used`] : []),
  ]
  return `${head}${msg}
    <p>Signed in as <strong>${escape(s.user)}</strong>${s.online ? '' : ' (offline: changes wait in this browser)'}. <span class="muted">${bits.join(' · ')}</span></p>
    ${s.error ? `<p class="message">${escape(s.error)}</p>` : ''}
    <div class="nc-opts"><button type="button" data-act="sync">Sync now</button><button type="button" data-act="signout">Sign out</button><button type="button" data-act="forget" title="For a shared computer">Sign out and remove this browser's copy</button></div>
    ${gameOpen ? '<div class="acct-conflicts"></div>' : ''}
    <div class="nc-opts acct-manage"><a class="button" href="${escape(exportUrl())}" download>Download my data</a><button type="button" data-mode="password">Change password</button><button type="button" data-mode="newcode">New recovery code</button><button type="button" data-mode="delete">Delete account</button><button type="button" data-mode="privacy">Privacy</button></div>
    ${note}`
}

function conflictsHtml(list: ConflictCopy[]): string {
  if (!list.length) return ''
  return `<h3>Conflict copies</h3>
    <p class="muted">Kept when this browser and another device changed the same thing: the newer change took its place, the other is here. Saved games among them can also be played from Load.</p>
    <ul class="acct-copies">${list.map((c) => `<li><span>${c.of === 'saves' ? (c.ofId === 'AUTO' ? 'Autosave' : `Slot ${escape(c.ofId)}`) : 'Character'}: ${escape(c.label)}
      <small class="muted">${c.from === 'browser' ? "this browser's version" : "the other device's version"}, kept ${when(c.keptAt)}</small></span>
      <span class="nc-opts"><button type="button" data-restore="${escape(c.id)}" title="Put it back in its place, replacing what is there now">Restore</button><button type="button" data-drop="${escape(c.id)}">Delete</button></span></li>`).join('')}</ul>`
}

/** Fill the Account section of the settings panel and keep it current. */
/** `gameOpen` false on the game list: no game's data to show, so no conflict copies there. */
export function mountAccount(el: HTMLElement, gameOpen = true) {
  let copies: ConflictCopy[] = []
  const draw = () => {
    el.innerHTML = render(accountStatus(), gameOpen)
    const box = el.querySelector<HTMLElement>('.acct-conflicts')
    if (box) void listConflicts().then((l) => { copies = l; box.innerHTML = conflictsHtml(l) }).catch(() => {})
  }
  const stop = onAccountStatus(() => {
    if (!el.isConnected) { stop(); return }
    // never redraw over a form being filled in
    if (ui.mode === 'view' && !el.querySelector('form.acct input:focus') && !hasInput(el)) draw()
  })
  const go = (mode: Mode, message = '') => { ui.mode = mode; ui.message = message; draw() }
  const busy = async (f: () => Promise<void>) => {
    el.querySelectorAll('button').forEach((b) => { b.disabled = true })
    try { await f() } catch (e) { ui.message = (e as Error).message || 'That did not work.'; draw() }
  }

  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (!b || b.type === 'submit') return
    const d = b.dataset
    if (d.mode) go(d.mode as Mode)
    else if (d.act === 'sync') void busy(async () => { await syncNow(); go('view') })
    else if (d.act === 'signout') void busy(async () => { await signOut(false); go('view', 'Signed out. This browser keeps its copy and works as before.') })
    else if (d.act === 'forget') {
      if (!confirm("Sign out and remove this browser's saved games, characters and party for every game? What is on the server stays.")) return
      void busy(async () => { await signOut(true); go('view', "Signed out; this browser's copy is removed.") })
    } else if (d.restore || d.drop) {
      const c = copies.find((x) => x.id === (d.restore ?? d.drop))
      if (!c) return
      if (d.restore && !confirm(`Put this copy back${c.of === 'saves' ? ` in ${c.ofId === 'AUTO' ? 'the autosave' : `slot ${c.ofId}`}` : ''}, replacing what is there now?`)) return
      if (d.drop && !confirm('Delete this conflict copy?')) return
      void busy(async () => { if (d.restore) await restoreConflict(c); else await deleteConflict(c.id); go('view') })
    }
  })

  el.addEventListener('submit', (e) => {
    const form = (e.target as HTMLElement).closest<HTMLFormElement>('form.acct')
    if (!form) return
    e.preventDefault()
    const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? ''
    const kind = form.dataset.form
    if ((kind === 'signup' || kind === 'recover' || kind === 'password') && v('password') !== v('again')) {
      ui.message = 'The two passwords differ.'
      el.querySelector('.message')?.remove()
      form.insertAdjacentHTML('beforebegin', `<p class="message" role="status">${ui.message}</p>`)
      return
    }
    const clashOk = () => {
      const clash = ownerClash(v('user'))
      return !clash || confirm(`This browser holds ${clash.owner}'s saved games and characters${clash.pending ? `, with ${clash.pending} changes not yet on the server that would be lost` : ''}. Signing in as ${v('user').trim().toLowerCase()} replaces them with that account's (${clash.owner}'s stay on the server). Go on?`)
    }
    if ((kind === 'signin' || kind === 'signup' || kind === 'recover') && !clashOk()) return
    void busy(async () => {
      if (kind === 'signin') { await signIn(v('user'), v('password')); go('view') }
      else if (kind === 'signup') { ui.code = await signUp(v('user'), v('password'), v('invite') || undefined); go('code') }
      else if (kind === 'recover') { ui.code = await recover(v('user'), v('code'), v('password')); go('code') }
      else if (kind === 'password') { await changePassword(v('current'), v('password')); go('view', 'Password changed; other browsers are signed out.') }
      else if (kind === 'newcode') { ui.code = await newRecoveryCode(v('current')); go('code') }
      else if (kind === 'delete') {
        if (!confirm('Delete your account and all its data on the server? This cannot be undone.')) { draw(); return }
        await deleteAccount(v('current'))
        go('view', 'Your account and its data on the server are deleted.')
      }
    })
  })

  if (ui.mode === 'code' && !ui.code) ui.mode = 'view'
  if (ui.mode !== 'code') { ui.mode = 'view'; ui.message = '' }
  draw()
}

function hasInput(el: HTMLElement) {
  return [...el.querySelectorAll<HTMLInputElement>('form.acct input')].some((i) => i.value !== '')
}

/** The account's short label for a button: "Sign in" or the name, with the sync state. */
export function accountLabel(s: AccountStatus = accountStatus()): string {
  if (!s.user) return 'Sign in / create account'
  const state = !s.online ? 'offline' : s.busy ? 'syncing…' : s.pending ? `${s.pending} to send` : 'synced'
  return `Account: ${s.user} · ${state}`
}

/**
 * A button that opens the account (IMP-072): shown only when a server answers, its label kept current
 * (signed out it invites signing in; signed in it shows the name and sync state).
 */
export function accountButton(btn: HTMLButtonElement, dialog: HTMLDialogElement, gameOpen = true) {
  const show = (s: AccountStatus) => {
    btn.hidden = s.available !== true
    btn.textContent = accountLabel(s)
    btn.classList.toggle('primary', !s.user)
  }
  show(accountStatus())
  const stop = onAccountStatus((s) => { if (!btn.isConnected) { stop(); return } show(s) })
  btn.addEventListener('click', () => openAccount(dialog, gameOpen))
}

/** The account in a dialog of its own. */
export function openAccount(dialog: HTMLDialogElement, gameOpen = true) {
  if (dialog.open) return
  ui.mode = 'view'; ui.message = ''
  dialog.innerHTML = `<section class="account-sec" aria-label="Account"></section><form method="dialog"><button>Close</button></form>`
  mountAccount(dialog.querySelector<HTMLElement>('.account-sec')!, gameOpen)
  dialog.showModal()
}
