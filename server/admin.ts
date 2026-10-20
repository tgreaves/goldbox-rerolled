// Admin CLI (docs/server.md, "Admin CLI"). Works on DATA_DIR directly; safe while the server runs.
//   node server/admin.ts <command> [arguments]
import { createInterface } from 'node:readline'
import { loadConfig } from './config.ts'
import { Accounts, normaliseName, passwordProblem, reservedName } from './accounts.ts'
import { Storage } from './storage.ts'
import { duSize } from './fsutil.ts'

const HELP = `GoldBox Rerolled admin

  add-user <name>          create an account (password prompted, or the first line of stdin)
  reset-password <name>    set a new password; signs the user out everywhere, prints a new recovery code
  disable-user <name>      lock an account: it cannot sign in and its sessions end
  enable-user <name>       unlock it
  remove-user <name> [--yes]   delete an account and all its data
  list-users               names, created, locked, storage used
  create-invite [--days N] a single-use sign-up code (SIGNUP=invite), valid N days (default 7)
  stats                    accounts, sessions, invites, storage used
  prune                    delete expired sessions and invites

Settings come from the same environment variables as the server (DATA_DIR, ...).`

async function readPassword(prompt: string): Promise<string> {
  const stdin = process.stdin
  if (!stdin.isTTY) {
    const rl = createInterface({ input: stdin })
    for await (const line of rl) { rl.close(); return line }
    return ''
  }
  process.stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')
  return new Promise((resolve, reject) => {
    let pw = ''
    const onData = (s: string) => {
      for (const ch of s) {
        if (ch === '\r' || ch === '\n') { done(); resolve(pw); return }
        if (ch === '\u0003') { done(); reject(new Error('cancelled')); return }
        if (ch === '\u007f' || ch === '\b') pw = pw.slice(0, -1)
        else if (ch >= ' ') pw += ch
      }
    }
    const done = () => { stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); process.stdout.write('\n') }
    stdin.on('data', onData)
  })
}

async function newPassword(): Promise<string> {
  const pw = await readPassword('Password: ')
  const problem = passwordProblem(pw)
  if (problem) throw new Error(problem)
  if (process.stdin.isTTY && (await readPassword('Again: ')) !== pw) throw new Error('the passwords differ')
  return pw
}

function confirm(q: string): Promise<boolean> {
  if (!process.stdin.isTTY) return Promise.resolve(false)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(`${q} [y/N] `, (a) => { rl.close(); resolve(/^y(es)?$/i.test(a.trim())) }))
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`

async function main(argv: string[]) {
  const [cmd, ...args] = argv
  const config = loadConfig()
  const accounts = new Accounts(config.dataDir, { scryptN: config.scryptN, sessionTtl: config.sessionTtl, maxUsers: config.maxUsers })
  await accounts.init()
  const storage = new Storage(accounts.usersDir, config.quota)
  const need = async () => {
    const name = normaliseName(args[0])
    if (!name) throw new Error('give a name: 3 to 24 letters, digits, - or _')
    if (!(await accounts.get(name))) throw new Error(`no account ${name}`)
    return name
  }

  switch (cmd) {
    case 'add-user': {
      const name = normaliseName(args[0])
      if (!name) throw new Error('give a name: 3 to 24 letters, digits, - or _')
      if (reservedName(name)) throw new Error('that name is reserved')
      if (await accounts.get(name)) throw new Error(`${name} already exists`)
      const r = await accounts.create(name, await newPassword(), { ignoreLimit: true })
      if (!r.ok) throw new Error(`not created (${r.reason})`)
      console.log(`Created ${name}. Recovery code (give it to them; shown once): ${r.recoveryCode}`)
      break
    }
    case 'reset-password': {
      const name = await need()
      await accounts.setPassword(name, await newPassword())
      console.log(`Password changed; ${name} is signed out everywhere. New recovery code: ${await accounts.newRecovery(name)}`)
      break
    }
    case 'disable-user':
    case 'enable-user': {
      const name = await need()
      await accounts.setDisabled(name, cmd === 'disable-user')
      console.log(cmd === 'disable-user' ? `${name} is locked and signed out.` : `${name} can sign in again.`)
      break
    }
    case 'remove-user': {
      const name = await need()
      if (!args.includes('--yes') && !(await confirm(`Delete ${name} and all their saved games and characters?`))) {
        console.log('Not deleted (pass --yes when not at a terminal).')
        break
      }
      await accounts.remove(name)
      console.log(`${name} and their data are deleted.`)
      break
    }
    case 'list-users': {
      for (const name of await accounts.list()) {
        const a = await accounts.get(name)
        if (!a) continue
        console.log(`${name.padEnd(24)} created ${new Date(a.created).toISOString().slice(0, 10)}  ${a.disabled ? 'LOCKED ' : '       '} ${mb(await storage.used(name))}`)
      }
      break
    }
    case 'create-invite': {
      const i = args.indexOf('--days')
      const days = i >= 0 ? Number(args[i + 1]) : 7
      if (!Number.isFinite(days) || days <= 0 || days > 365) throw new Error('--days takes 1 to 365')
      const inv = await accounts.createInvite(days)
      console.log(`Invite code (single use, until ${new Date(inv.expires).toISOString().slice(0, 16).replace('T', ' ')} UTC): ${inv.code}`)
      break
    }
    case 'stats': {
      const names = await accounts.list()
      let locked = 0
      for (const n of names) if ((await accounts.get(n))?.disabled) locked++
      const now = Date.now()
      const invites = (await accounts.invites()).filter((v) => v.expires > now).length
      console.log(`accounts   ${names.length} (${locked} locked; limit ${config.maxUsers}, sign-up ${config.signup})`)
      console.log(`sessions   ${await accounts.sessionCount()} stored`)
      console.log(`invites    ${invites} open`)
      console.log(`storage    ${mb(await duSize(accounts.usersDir))} in ${accounts.usersDir} (quota ${mb(config.quota)} each)`)
      break
    }
    case 'prune': {
      const r = await accounts.prune()
      console.log(`Deleted ${r.sessions} expired sessions and ${r.invites} expired invites.`)
      break
    }
    default:
      console.log(HELP)
      if (cmd && cmd !== 'help' && cmd !== '--help') process.exitCode = 2
  }
}

main(process.argv.slice(2)).catch((e: Error) => {
  console.error(`error: ${e.message}`)
  process.exitCode = 1
})
