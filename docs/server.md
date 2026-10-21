# The server: accounts and players' data (IMP-072)

GoldBox Rerolled runs entirely in the browser. The optional server in [`server/`](../server) adds
accounts, so a player's **saved games and autosave, character roster and party, journal finds and
settings** are kept on the server as well and follow them to any browser they sign in on. It also
serves the built app, replacing `vite preview`.

The **game files are never uploaded** (copyright, size): each browser imports its own copy, as before.
Without the server (GitHub Pages, the single-file build, `npm run dev`) the Account section hides itself
and everything works as it always has.

## Design

- **Node 24, no dependencies.** TypeScript run directly by Node's type stripping (`node server/main.ts`);
  only `node:http`, `node:crypto` and `node:fs`.
- **Game-neutral.** Records are keyed by the game profile's id (`por`, `coab`, any later game) and hold
  the files the browser names, in each game's own formats and extensions. Nothing in the server knows a
  game.
- **The browser stays the master copy for play.** Every change is written to IndexedDB/localStorage
  first, exactly as before; the sync layer then sends it to the server. Offline, or signed out, the
  changes wait in a queue and go when the server is back.
- **Never lose a save.** When two devices changed the same save or character, the newer change wins and
  the other is kept as a **conflict copy**, listed in Settings → Account (Restore, Delete) and, for saves,
  on the Load screen.

### What syncs

| Record | Browser store | On the server |
|---|---|---|
| Saved games A–J and the autosave | IndexedDB `saves` | `saves/<slot>/`: `SAVGAM<x>.DAT`, each member's `CHRDAT<x><n>.SAV` with its item and effect files (`.ITM`/`.SPC`, CotAB `.SWG`/`.FX`), and `SAVGAM<x>.GBR` |
| Journal finds and commission offers | inside each save (`known`) | in that save's `.GBR` sidecar: they belong to the game state, so they travel with the saves |
| Roster characters | IndexedDB `characters` | `characters/<stem>/`: `<stem>.CHA` (CotAB `.GUY`) with its item and effect files |
| The party | IndexedDB `meta.party` | `party.json` |
| Settings (sound, font, borders, party layout, motion, text size, graphics) | localStorage | `settings.json`, per game |
| Conflict copies | IndexedDB `conflicts` | `conflicts/<id>/` |

The last game played and the imported game files stay per browser.

Settings are kept per game on the server, but the browser has one set of keys for every game
(`poolrad.sound` … in `web/src/store/account.ts`), so pulling one game's settings changes them for every
game in that browser. Whether that is intended is open (spec/AUDIT.md, C22).

### Sync rules (`web/src/store/sync.ts`)

Per game the browser keeps, in localStorage: the server version it last saw of each record (`base`), the
records it changed since (`dirty`, the queue, with the change time) and the characters it seeded from the
game files on first run.

- **Push** (after each change, debounced 1.5 s; every minute while changes wait; on reconnect): `PUT`
  with the base version. The server refuses a stale base with 409; the browser then fetches the server's
  record and resolves the clash.
- **Pull** (on start when signed in, on sign-in, on *Sync now*, when the tab becomes visible after 30 s,
  on reconnect): list the server's records and merge each:
  - changed on one side only: that side wins (a record gone from the server and unchanged in the
    browser was deleted on another device, and is deleted here);
  - changed on both: identical content is no clash; otherwise the **newer change wins** and, for saves
    and characters, the other becomes a conflict copy; for the party and settings the newer simply wins;
  - a change beats a deletion;
  - records in the browser from before signing in count as changed at their own time (a save's
    `savedAt`), so an older local save becomes a conflict copy rather than overwriting a newer one;
    characters seeded from the game files never beat the server's.
- **Another account on the same browser:** signing in as someone other than the last account replaces
  the browser's copy with that account's (after a warning that names any unsent changes). *Sign out and
  remove this browser's copy* is there for shared computers.

## API

Base `/api/v1/`. JSON in and out (`Content-Type: application/json`); files inside records are base64.
Every state-changing call (`POST`, `PUT`, `DELETE`) needs the header **`X-GoldBox: 1`** (CSRF: another
site cannot send a custom header without a CORS preflight, which is never granted). Errors are
`{ "error": "…" }` with a short, non-revealing message.

| Call | Body / result |
|---|---|
| `GET health` | `{ ok }` (200, or 503 when the data folder is unreachable): for monitoring |
| `GET config` | `{ server: "goldbox-rerolled", api: 1, signup, passwordMin, quota }` |
| `GET me` | config plus `{ user }` (null when signed out) and `used` bytes; the browser's probe |
| `POST signup` | `{ user, password, invite? }` → `{ user, recoveryCode }`, signed in |
| `POST login` | `{ user, password }` → `{ user }`, sets the session cookie |
| `POST logout` | ends the session |
| `POST recover` | `{ user, code, newPassword }` → `{ user, recoveryCode }` (a new code), signed in, every other session ended |
| `POST password` | `{ password, newPassword }`: new session, every other session ended |
| `POST recovery-code` | `{ password }` → `{ recoveryCode }`, the old one void |
| `POST delete-account` | `{ password }`: the account and all its data are deleted |
| `GET export` | everything kept for the account as a ZIP (original files plus `record.json` metadata) |
| `GET games/<game>` | `{ records: [{ kind, id, updatedAt, meta }] }` |
| `GET games/<game>/<kind>/<id>` | `{ kind, id, updatedAt, meta, files: [{ name, data }] }` or 404 |
| `PUT games/<game>/<kind>/<id>` | `{ base, meta, files }` → `{ updatedAt }`; 409 `{ updatedAt }` when `base` is not the current version (0: must not exist) |
| `DELETE games/<game>/<kind>/<id>?base=<n>` | 200, or 409 as for `PUT` |

Validation (`server/storage.ts`): game `^[a-z0-9][a-z0-9-]{0,31}$`; kinds `saves` (`A`–`J`, `AUTO`),
`characters` (a DOS stem: 1–8 of `A-Z 0-9 ! # $ % & ' ( ) + = @ ^ _ \` { } ~ - [ ]`), `conflicts`
(`[a-z0-9]{1,40}`), `docs` (`party`, `settings`, `journal`); file names are DOS 8.3 names from the same
characters. No dot, slash or backslash can reach a path. Limits: 64 files of 1 MB per record, 16 KB of
metadata, 500 records of a kind, 32 games, 8 MB per request (8 KB for the account calls), and the
per-account quota (507 with the space used when exceeded).

## Data layout

`DATA_DIR` (default `~/.local/share/goldbox-rerolled`, `/data` in Docker):

```
users/<name>/account.json                 name, scrypt hash and salt, recovery-code hash, generation, locked
users/<name>/<game>/saves/A.json          pointer: version (updatedAt), metadata, file names
users/<name>/<game>/saves/A@<version>/    SAVGAMA.DAT, CHRDATA1.SAV, CHRDATA1.ITM, …, SAVGAMA.GBR
users/<name>/<game>/characters/<stem>.json, <stem>@<version>/<stem>.CHA …
users/<name>/<game>/conflicts/<id>.json, <id>@<version>/
users/<name>/<game>/party.json, settings.json
sessions/<sha-256 of token>.json          user, generation, expiry
invites/<sha-256 of code>.json            expiry
```

The files in a version folder are the game's own, byte for byte: copy `saves/A@…/` into a DOSBox game
folder and the save loads there. Writes are atomic: each file is written to a temporary name, synced and
renamed; a record's new files go into a new version folder, then its pointer is replaced by rename, then
the old folder is deleted, so a reader (or a crash) sees the old record or the new one, never a mixture.
One account's writes are serialised; a full disk gives a clean 503 and the record stays queued in the
browser.

## Security model

- **Passwords:** scrypt (N = 2^15, r = 8, p = 1, 16-byte salt, 64-byte key; at most two at once), at
  least 10 characters. Unknown names cost the same time as wrong passwords, and sign-in errors do not say
  which (sign-up necessarily tells a taken name; it is rate-limited).
- **Recovery without email:** a 100-bit code shown once at sign-up (and after each recovery or on
  request); only its SHA-256 is stored. Name plus code sets a new password, ends every session and issues
  a new code. No email address is collected.
- **Sessions:** 32 random bytes, sent as an `HttpOnly; SameSite=Lax` cookie (`Secure` and the `__Host-`
  prefix unless `COOKIE_SECURE=0`); stored only as a SHA-256; 30 days, renewed by use. A new session id on
  every sign-in; a password change, recovery, admin reset or lock ends every session of the account.
- **CSRF:** the `X-GoldBox: 1` header on every state-changing call, plus JSON-only bodies.
- **Rate limits** (memory only, never written to disk): sign-in 20 failures per address and 10 per
  account in 15 minutes; sign-up 5 per address per hour; recovery 10 per address and 5 per account in 15
  minutes; password re-entry 10 per account in 15 minutes. With `TRUST_PROXY=1` the address is the last
  entry of `X-Forwarded-For` (one proxy in front).
- **Isolation:** every data path is built from the signed-in account's name and validated ids; there is
  no way to name another account's records.
- **Abuse limits:** `MAX_USERS`, the per-account `QUOTA_MB`, request size limits, `SIGNUP=invite|off`.
- **Headers on every response:** `Content-Security-Policy` (`default-src 'self'`; scripts from the app
  only; inline style attributes allowed; `data:`/`blob:` images, fonts and media; `frame-ancestors
  'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`,
  a minimal `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `-Resource-Policy: same-origin`, and
  `Strict-Transport-Security` when cookies are secure. Hashed bundles are cached for a year; `index.html`,
  `sw.js` and the manifest are revalidated, so the PWA updates.
- **Logs:** one line per request: method, path (record ids left out, no query string), status and time.
  Never addresses, bodies, cookies, tokens, passwords or codes.
- **Privacy (UK GDPR):** Settings → Account → Privacy says what is kept; *Download my data* exports it
  all; *Delete account* removes the account folder and its sessions at once.

## Configuration

| Variable | Default | |
|---|---|---|
| `PORT` | 8080 | |
| `HOST` | 0.0.0.0 | 127.0.0.1 behind a proxy on the same machine |
| `DATA_DIR` | `~/.local/share/goldbox-rerolled` (`$XDG_DATA_HOME/goldbox-rerolled`) | keep it outside the repository |
| `WEB_ROOT` | `web/dist` beside `server/` | the built app |
| `COOKIE_SECURE` | 1 | 0 only for plain HTTP on a LAN (also turns HSTS off) |
| `TRUST_PROXY` | 0 | 1 behind exactly one reverse proxy |
| `SIGNUP` | open | `open`, `invite` (codes from the admin CLI) or `off` (the form hides itself) |
| `MAX_USERS` | 1000 | |
| `QUOTA_MB` | 20 | per account |
| `SESSION_DAYS` | 30 | |
| `LOG_REQUESTS` | 1 | 0 for errors only |

## Running it

```sh
cd web && npm ci && npm run build && cd ..   # the app, into web/dist
COOKIE_SECURE=0 node server/main.ts           # http://localhost:8080/ (plain HTTP: insecure cookies)
```

Node 24.6 or later (type stripping on by default). Tests: `npx vitest run test/server.test.ts
test/sync.test.ts` from `web/` (a real server on a random port with a temporary data folder).

### Admin CLI

Run on the server, with the same environment variables (`DATA_DIR` at least) as the server; safe while
it runs.

```sh
node server/admin.ts add-user <name>            # password prompted twice (or the first line of stdin); prints a recovery code
node server/admin.ts reset-password <name>      # new password, signed out everywhere, new recovery code
node server/admin.ts disable-user <name>        # locked: cannot sign in, sessions end
node server/admin.ts enable-user <name>
node server/admin.ts remove-user <name> [--yes] # the account and all its data
node server/admin.ts list-users                 # name, created, LOCKED, storage used
node server/admin.ts create-invite [--days N]   # single-use sign-up code for SIGNUP=invite (default 7 days)
node server/admin.ts stats                      # accounts, sessions, open invites, storage
node server/admin.ts prune                      # delete expired sessions and invites
```

### systemd (without Docker)

[`server/goldbox-rerolled.service`](../server/goldbox-rerolled.service) is a user unit:

```sh
mkdir -p ~/.config/systemd/user
cp server/goldbox-rerolled.service ~/.config/systemd/user/   # check WorkingDirectory and Environment first
systemctl --user daemon-reload
systemctl --user enable --now goldbox-rerolled
sudo loginctl enable-linger $USER      # keep it running without a login session
journalctl --user -u goldbox-rerolled -f
```

After `git pull`: `cd web && npm ci && npm run build`, then `systemctl --user restart goldbox-rerolled`.

## Docker

The [`Dockerfile`](../Dockerfile) builds the app in a first stage (`npm ci && npm run build`) and runs
the server on `node:24.22.0-alpine3.24` as the unprivileged `node` user, with only `server/*.ts` and
`web/dist` in the image (no game files, no secrets). `DATA_DIR=/data` is a volume; configuration is by
environment variables; a `HEALTHCHECK` calls `/api/v1/health`. The root filesystem can be read-only: the
server writes only to `/data`.

```sh
docker build -t goldbox-rerolled .
docker run -d --name goldbox -p 127.0.0.1:8080:8080 -v goldbox-data:/data \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  -e COOKIE_SECURE=0 goldbox-rerolled          # COOKIE_SECURE=1 (the default) behind HTTPS
docker logs -f goldbox
```

[`docker-compose.yml`](../docker-compose.yml) is an **example to adapt**: the app with a named volume,
`COOKIE_SECURE=1`, `TRUST_PROXY=1`, read-only root, `no-new-privileges`, no capabilities, log rotation,
published on 127.0.0.1 only; and, under the `proxy` profile, Caddy as the HTTPS reverse proxy
([`deploy/Caddyfile`](../deploy/Caddyfile)).

```sh
docker compose up -d --build                                         # the app on 127.0.0.1:8080
DOMAIN=games.example.org docker compose --profile proxy up -d --build  # plus Caddy on 80/443 with a certificate
docker compose exec app node server/admin.ts list-users              # the admin CLI
docker compose logs -f app
```

**Updating:** `git pull && GIT_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build` (the volume keeps the data). `GIT_COMMIT` is the version shown at the foot of the game list and in Settings; the build context has no `.git`, so without it the page says "version unknown". Builds outside Docker read it from git and add "+ local changes" when the working tree differs.
**Backups of the volume:**

```sh
docker run --rm -v goldbox-rerolled_gbr-data:/data:ro -v "$PWD":/backup alpine \
  tar czf /backup/goldbox-data-$(date +%F).tgz -C /data .
```

(`docker volume ls` shows the volume's name; compose prefixes it with the project name.) Restore by
extracting into an empty volume while the app is stopped.

## Running it publicly

- **HTTPS in front.** Run a reverse proxy that terminates TLS and set `TRUST_PROXY=1`,
  `COOKIE_SECURE=1` (the default) and `HOST=127.0.0.1` (or publish the container port on 127.0.0.1
  only). Caddy does certificates by itself:

  ```
  games.example.org {
  	encode zstd gzip
  	request_body {
  		max_size 10MB
  	}
  	reverse_proxy 127.0.0.1:8080
  }
  ```

  nginx (with a certificate from certbot):

  ```nginx
  server {
      listen 443 ssl http2;
      server_name games.example.org;
      ssl_certificate     /etc/letsencrypt/live/games.example.org/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/games.example.org/privkey.pem;
      client_max_body_size 10m;
      location / {
          proxy_pass http://127.0.0.1:8080;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-For $remote_addr;   # one value: the client, as the app expects
          proxy_set_header X-Forwarded-Proto https;
      }
  }
  server { listen 80; server_name games.example.org; return 301 https://$host$request_uri; }
  ```

- **Exactly one proxy.** With `TRUST_PROXY=1` the last `X-Forwarded-For` entry is taken as the client;
  a second proxy (a CDN) in front would make every visitor look like that proxy to the rate limits.
- **Backups.** Everything is in `DATA_DIR`; copy it while the server runs (writes are atomic):
  `rsync -a --delete ~/.local/share/goldbox-rerolled/ backup-host:goldbox/` or
  `tar czf goldbox-$(date +%F).tgz -C ~/.local/share goldbox-rerolled`. Keep a few generations; deleted
  accounts stay in old backups until they age out (say so in your privacy note if you keep them long).
- **Updating.** `git pull`, rebuild the app (`npm ci && npm run build` in `web/`, or `docker compose up
  -d --build`), restart. Sessions and data carry over.
- **Housekeeping.** `node server/admin.ts prune` now and then (expired sessions and invites);
  `stats` for storage; watch `/api/v1/health`.
- **Where it runs.** Exposing a service from a home network opens that network to the internet: a
  vulnerability in the service, Node or the proxy would put every device behind the router within reach.
  A small VPS, or at least a separate VM or DMZ network segment with no route to the home LAN, is the
  safer home for a public instance.
- **Sign-up.** `SIGNUP=open` lets anyone make an account (limited per address, by `MAX_USERS` and by
  quota). `invite` with `create-invite` codes keeps it to people you choose; `off` closes it.
