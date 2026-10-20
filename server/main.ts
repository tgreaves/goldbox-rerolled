// GoldBox Rerolled server: the built app plus accounts and players' data (docs/server.md).
// Run with Node 24 or later: node server/main.ts
import { loadConfig } from './config.ts'
import { createApp } from './app.ts'

const config = loadConfig()
const app = await createApp(config)
const port = await app.listen()
console.log(`GoldBox Rerolled on http://${config.host}:${port}/ (data ${config.dataDir}, app ${config.webRoot}, sign-up ${config.signup}${config.cookieSecure ? '' : ', insecure cookies'}${config.trustProxy ? ', behind a proxy' : ''})`)

let stopping = false
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (stopping) process.exit(1)
    stopping = true
    console.log(`${sig}: stopping`)
    void app.close().then(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  })
}
