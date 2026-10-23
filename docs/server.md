# The server: an operator's guide (IMP-072)

GoldBox Rerolled runs entirely in the browser. The optional server in [`server/`](../server) adds
accounts, so a player's **saved games and autosave, character roster and party, journal finds and
settings** are kept on the server as well and follow them to any browser they sign in on. It also
serves the built app, replacing `vite preview`. The **game files are never uploaded**: each browser
imports its own copy. Without the server (static hosting, the single-file build, `npm run dev`) the
Account section hides itself and everything works as before.

This guide is about running one. The contract (the HTTP API, accounts, sessions and recovery codes,
the data layout, the sync rules, the security headers, every configuration variable and the admin
commands) is specified in [spec/C-port/accounts-and-sync.md](../spec/C-port/accounts-and-sync.md);
the browser's own storage in [spec/C-port/storage.md](../spec/C-port/storage.md); the Docker image's
contract in [spec/C-port/pwa-and-build.md](../spec/C-port/pwa-and-build.md#7-the-docker-image).

The server is Node 24 with no dependencies: TypeScript run directly by Node's type stripping, using
only `node:http`, `node:crypto` and `node:fs`.

## Running it

```sh
cd web && npm ci && npm run build && cd ..   # the app, into web/dist
COOKIE_SECURE=0 node server/main.ts           # http://localhost:8080/ (plain HTTP: insecure cookies)
```

Node 24.6 or later (type stripping on by default). Tests: `npx vitest run test/server.test.ts
test/sync.test.ts` from `web/` (a real server on a random port with a temporary data folder).

## Configuration

Environment variables only; the full list with defaults and rules is in the spec,
[accounts-and-sync.md §8](../spec/C-port/accounts-and-sync.md#8-configuration). The ones an operator
usually sets:

- `DATA_DIR`: where accounts and players' data live (default `~/.local/share/goldbox-rerolled`;
  `/data` in Docker). Keep it outside the repository and back it up.
- `COOKIE_SECURE=0` only for plain HTTP on a LAN (it also turns HSTS off); leave the default behind
  HTTPS.
- `HOST`: the listening address, `127.0.0.1` unless set (so a plain `node server/main.ts` is reachable
  only from the same machine); `0.0.0.0` to serve a LAN, as the systemd unit does.
- `TRUST_PROXY=1` (with `HOST` left at `127.0.0.1`) behind one reverse proxy on the same machine.
- `SIGNUP` (`open`, `invite`, `off`), `MAX_USERS`, `QUOTA_MB` (per account), `SESSION_DAYS`.
- `LOG_REQUESTS=0` to log errors only.

## Data layout

Everything is in `DATA_DIR`: `users/<name>/` (the account and its records, one folder per game),
`sessions/` and `invites/` (hashed). The format is specified in
[accounts-and-sync.md §4](../spec/C-port/accounts-and-sync.md#4-server-storage). Two things matter
for operating it:

- The files in a record's version folder are the game's own, byte for byte: copy
  `users/<name>/<game>/saves/A@…/` into a DOSBox game folder and the save loads there. Secret of the
  Silver Blades' vault is the record `folder/VAULT` (`users/<name>/sotsb/folder/VAULT@…/VAULT.DAT`),
  which goes into the game folder the same way.
- The `folder` kind (added for the vault) takes nothing new from a client: its ids are DOS stems as
  for characters, and its files pass the same name, size, count, record and quota limits as every
  other record (`web/test/server.test.ts`, "keeps a game-folder file").
- Every write is atomic (temporary file, sync, rename; a new version folder, then the pointer), so
  copying the folder while the server runs gives a consistent backup of each record.

## Admin CLI

Run on the server with the same environment variables (`DATA_DIR` at least) as the server; safe
while it runs. What each command does is in
[accounts-and-sync.md §9](../spec/C-port/accounts-and-sync.md#9-admin-cli).

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

## systemd (without Docker)

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

## launchd (macOS)

For quick local testing on a Mac, [`server/goldbox-rerolled.plist`](../server/goldbox-rerolled.plist) is a
launchd agent: loopback only (`HOST=127.0.0.1`), plain HTTP, open sign-up, started at login.

```sh
sed "s#/path/to/goldbox-rerolled#$PWD#" server/goldbox-rerolled.plist > ~/Library/LaunchAgents/org.goldbox-rerolled.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/org.goldbox-rerolled.plist
launchctl kickstart -k gui/$(id -u)/org.goldbox-rerolled   # restart after a change under server/
launchctl bootout gui/$(id -u)/org.goldbox-rerolled        # stop and unload
tail -f /tmp/goldbox-rerolled.log
```

It serves `web/dist`, so `npm run build` in `web/` updates it at once. Check the node path in the
file (`which node`).

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

**Updating:** `git pull && GIT_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build` (the
volume keeps the data). `GIT_COMMIT` is the version shown at the foot of the game list and in
Settings; the build context has no `.git`, so without it the page says "version unknown". Builds
outside Docker read it from git and add "+ local changes" when the working tree differs
([pwa-and-build.md §6](../spec/C-port/pwa-and-build.md#6-the-version-stamp)).

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
- **At the root of the host.** The app finds its API relative to the page, but the server serves it
  at `/` and its cookie is for `/`: under a sub-path, the proxy must remove the prefix.
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
- **Privacy (UK GDPR).** Settings → Account → Privacy tells players what is kept
  ([accounts-and-sync.md §6](../spec/C-port/accounts-and-sync.md#6-the-account-section)); *Download my
  data* exports it all; *Delete account* removes the account folder and its sessions at once. The log
  holds one line per request without addresses, record ids or bodies.
