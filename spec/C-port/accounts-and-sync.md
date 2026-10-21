---
created: 2026-10-21
tags: [gold-box, spec, port]
---

# Accounts and sync

Part of the [specification](../README.md), part C: GoldBox Rerolled. **Normative.** The optional
server (IMP-072, [IMPROVEMENTS.md](../../IMPROVEMENTS.md)) and the browser's side of it: the HTTP API
v1, accounts and authentication, how the server stores records, the client's sync algorithm, the
Account section of the interface, the security headers, configuration and the admin CLI. A
compatible server or client can be written from this file; the browser's own storage is
[storage.md](storage.md). Running a server (systemd, Docker, a reverse proxy, backups) is the
operator's guide [docs/server.md](../../docs/server.md), which is informative.

Everything here is port behaviour, observed in the reference implementation (`server/`,
`web/src/store/sync.ts`, `account.ts`, `records.ts`, `api.ts`) and normative as written. "The server"
and "the client" are roles: a conforming server answers the API as §2–§4 and §7–§10 say, a
conforming client behaves as §5–§6 say.

## 1. Model

### 1.1 Principles

- **Optional.** Without a server (static hosting, the single-file build, a development server) the
  client finds none ([§5.11](#511-finding-the-server-and-the-status)), hides every account control,
  and works as [storage.md](storage.md) describes. Nothing in play needs the server.
- **Local first.** The browser is the master copy for play. Every change is written to the browser's
  stores first; the sync then sends it. Offline or signed out, changes wait in a queue.
- **Game-neutral server.** Records are grouped by the game profile's `id` (`por`, `coab`, any later
  game) and hold files the client names, in the game's own formats and extensions. Nothing in the
  server knows a game.
- **Never lose a save.** When two devices changed the same saved game or character, the newer change
  wins and the other is kept as a **conflict copy** ([§5.7](#57-resolving-a-clash)).
- **The game files are never uploaded.** Each browser imports its own copy.

### 1.2 Records

The unit of storage and sync is a **record**, named by a game, a **kind** and an **id**; the client
writes its key as `<kind>/<id>` (`saves/A`, `characters/ALIAS`, `docs/party`).

| Kind | Ids | Holds |
|---|---|---|
| `saves` | `A` … `J`, `AUTO` | a saved game; `AUTO` is the autosave |
| `characters` | a DOS stem: 1–8 characters from `A`–`Z`, `0`–`9` and ``! # $ % & ' ( ) + = @ ^ _ ` { } ~ - [ ]`` | a roster character |
| `conflicts` | `[a-z0-9]{1,40}` | a conflict copy of a save or a character |
| `docs` | `party`, `settings` | a document: metadata only, no files |

A record is `{ meta, files }`:

- `meta`: a JSON object, at most 16 384 bytes as `JSON.stringify` writes it, in UTF-8. The server keeps it
  verbatim and returns it in listings; its fields are the client's (§1.3).
- `files`: a list of `{ name, data }`, at most 64, each name unique, each at most 1 MiB. A name is a
  DOS 8.3 name in upper case: a stem as above, a dot, 1–3 of `A-Z 0-9`. `docs` records have no files.

The server gives every stored record a **version**, `updatedAt`: an integer, strictly increasing for
that record (`max(now in ms, previous + 1)`). A client names the version it last saw (`base`) when it
writes or deletes; `0` means "it must not exist yet" ([§4.3](#43-versions-and-conflicts)).

### 1.3 What each kind holds

The client's records (the reference client; another client MUST write these shapes to share an
account with it). `<items>`, `<effects>`, `<roster>` are the active game's `saves.items`,
`saves.effects`, `saves.roster` (PoR `ITM`, `SPC`, `CHA`; CotAB `SWG`, `FX`, `GUY`).

**`saves/<slot>`**:

| | |
|---|---|
| `meta.slot` | the slot letter `A`–`J`; the autosave writes `A` |
| `meta.label` | the label shown on Load ([storage.md §5](storage.md#5-saved-games-and-the-autosave)) |
| `meta.savedAt` | when the save was made, ms |
| `meta.members` | the members' stems in party order: the stem table of the `.DAT` where each matches the stem rule, otherwise `CHRDAT<slot><i>` |
| `meta.modifiedAt` | added by the push ([§5.5](#55-push)) |
| files | `SAVGAM<slot>.DAT`; for each member `m`: `m.SAV`, and `m.<items>`, `m.<effects>` when the character has them; `SAVGAM<slot>.GBR` when the save has journal finds ([storage.md §6](storage.md#6-journal-finds-and-the-gbr-sidecar)) |

The files are the game's own, byte for byte: a version folder copied into a DOSBox game folder
loads there. Reading a record back needs `SAVGAM<slot>.DAT` (`slot` from `meta.slot` when it is
`A`–`J`, else `A`) and every member's `.SAV`; otherwise the record is not usable and is not written
to the browser. A record `saves/<x>` is stored in slot *x* whatever its `meta.slot`; `saves/AUTO`
becomes the autosave.

**`characters/<stem>`**: `meta` is `{}` plus `modifiedAt`; files `<stem>.<roster>` (the character
record; required), `<stem>.<items>` and `<stem>.<effects>` when present, as a DOS install keeps a
roster character. A seeded character keeps its slot stem (`CHRDATA1.CHA`).

**`conflicts/<id>`**: the losing record's `meta` and `files`, with in `meta`: `conflictOf`
(`"saves"` or `"characters"`), `conflictId` (the record's id), `from` (`"browser"`: this browser's
version lost; `"server"`: the server's, from another device), `keptAt` (ms) and `modifiedAt` (the
losing change's time).

**`docs/party`**: `meta.stems`, the party as roster stems; **`docs/settings`**: `meta.values`, an
object of the synced localStorage keys that are set, each a string ([§5.9](#59-settings)); both with
`modifiedAt`. Journal finds have no document: they travel inside each save's `.GBR`.

## 2. HTTP API v1

### 2.1 Transport

- The API is served under **`/api/v1/`** on the same origin as the app; paths below are relative to
  it. The client computes the base as `new URL('api/v1/', document.baseURI)`, so an app served under
  a sub-path finds its API under the same sub-path (a proxy in front strips it).
- **JSON** in and out. A request body MUST have `Content-Type: application/json` (optionally with
  parameters), else 415; it MUST be a JSON object, else 400. Every JSON response has
  `Content-Type: application/json; charset=utf-8` and `Cache-Control: no-store`. File contents are
  base64 (standard alphabet, padded).
- **CSRF header.** Every request with a method other than `GET` and `HEAD` MUST carry
  **`X-GoldBox: 1`**, else 403 `missing X-GoldBox header`, checked before anything else. Another site
  cannot send a custom header without a CORS preflight, and the server never grants one (it sends no
  CORS headers). The reference client sends the header on every call except the `me` probe.
- **Session cookie** ([§3.3](#33-sessions-and-the-cookie)): the client sends requests with
  `credentials: 'same-origin'` and `cache: 'no-store'`.
- **Errors** are `{ "error": "<short message>" }`, plus the fields named below; messages are short
  and say nothing about other accounts. A 429 also carries the `Retry-After` header.
- Limits on requests: 8 KiB of body for the account calls, 8 MiB for a record `PUT` (a declared
  `Content-Length` above the limit is refused before reading, a body that grows past it while being
  read is cut off), 413 `too large`. Request timeout 30 s, headers 15 s, keep-alive 5 s.

### 2.2 Endpoints

| Method and path | Session | Body | 200 response |
|---|---|---|---|
| `GET health` | — | — | `{ ok: true }`; 503 `{ ok: false }` when `DATA_DIR` is not a reachable directory |
| `GET config` | — | — | the public configuration (below) |
| `GET me` | optional | — | the public configuration plus `user`, `used` |
| `POST signup` | — | `{ user, password, invite? }` | `{ user, recoveryCode }`; signed in |
| `POST login` | — | `{ user, password }` | `{ user }`; signed in |
| `POST logout` | optional | any or none | `{ user: null }`; signed out |
| `POST recover` | — | `{ user, code, newPassword }` | `{ user, recoveryCode }`; signed in |
| `POST password` | required | `{ password, newPassword }` | `{ user }`; signed in afresh |
| `POST recovery-code` | required | `{ password }` | `{ recoveryCode }` |
| `POST delete-account` | required | `{ password }` | `{ user: null, deleted: true }`; signed out |
| `GET export` | required | — | a ZIP ([§4.5](#45-the-data-export)) |
| `GET games/<game>` | required | — | `{ records: Listed[] }` |
| `GET games/<game>/<kind>/<id>` | required | — | `{ kind, id, updatedAt, meta, files: [{ name, data }] }` |
| `PUT games/<game>/<kind>/<id>` | required | `{ base, meta, files? }` | `{ updatedAt }` |
| `DELETE games/<game>/<kind>/<id>?base=<n>` | required | — | `{ deleted: true }` |

Any other path under `/api/v1/` is 404 `not found`; another method on a record path is 405 `method
not allowed`. "Required" means 401 `signed out` without a valid session.

### 2.3 Service

**Public configuration** (`config`, and the start of `me`):

```json
{ "server": "goldbox-rerolled", "api": 1, "signup": "open", "passwordMin": 10, "quota": 20971520 }
```

`signup` is `open`, `invite` or `off`; `passwordMin` the minimum password length in characters;
`quota` the per-account quota in bytes. **`me`** adds `user` (the signed-in account's name, or
`null`) and, when signed in, `used` (bytes the account's records take, [§4.4](#44-quota)). A client
recognises a GoldBox Rerolled server by `server` and `api`.

### 2.4 Account calls

Names are normalised as [§3.1](#31-names) says before anything else; codes as [§3.4](#34-recovery-and-invite-codes).
Each call is listed with its checks in order; the first that fails gives the response.

**`signup`**: 403 `sign-up is closed` when `SIGNUP=off` (before reading the body); the body; 429
when the address has used its sign-ups (every attempt that gets this far counts); 400 `names are 3
to 24 letters, digits, - or _`; 400 `that name is reserved`; 400 the password problem
([§3.2](#32-passwords)); 403 `an invite code is needed` (`SIGNUP=invite`, no `invite` string); 409
`that name is taken`; 503 `no new accounts can be made at the moment` (`MAX_USERS` reached); 403
`that invite code is not valid` (the invite is used up only when every check before it passed). Then
the account is made and signed in, and the response carries its first recovery code.

**`login`**: the body; 429 when the address, or the named account, has used its failures; 401
`wrong name or password` for an unknown name, a wrong password or a non-string password (counted as
a failure for the address and the name); 403 `this account is locked` (only after a correct
password); then the account's failure count is reset and a new session starts.

**`logout`**: ends the presented session (if any) and clears the cookie. Always 200.

**`recover`**: the body; 429 by address or name; 400 the problem with `newPassword`; 401 `wrong name
or recovery code` (a failure for the address and the name); 403 `this account is locked`; then the
password is set (every session of the account ends), a new recovery code replaces the old, a new
session starts, and the response carries the new code.

**`password`**: the session; the body; 400 the problem with `newPassword`; 429 when the account has
used its password re-entries; 403 `wrong password` (counted); then the password is set, every
session ends, and a new session starts for this browser.

**`recovery-code`**: the session; the body; the re-entered password as for `password`; then a new
code replaces the old.

**`delete-account`**: the session; the body; the re-entered password; then the account and all its
records are deleted at once, every session ends, and the cookie is cleared.

### 2.5 Records

`<game>` matches `^[a-z0-9][a-z0-9-]{0,31}$`; `<kind>` is one of the four kinds; `<id>` is
percent-decoded and then matched against its kind's rule ([§1.2](#12-records)). Anything else is
400 `bad request` (after the session check). The client percent-encodes ids
(`encodeURIComponent`).

**List** `GET games/<game>`: every record of that game, kinds in the order `saves`, `characters`,
`conflicts`, `docs`:

```ts
type Listed = { kind: string; id: string; updatedAt: number; meta: object }
```

A game the account has never written lists `[]`. A `docs` record's whole content is its `meta`, so
the listing carries it.

**Get** `GET games/<game>/<kind>/<id>`: the record with its files base64-encoded, or 404 `not found`.
A record replaced while it was being read also gives 404; the client asks again later.

**Put** `PUT games/<game>/<kind>/<id>`, body `{ base, meta, files }`:

- `base`: a safe integer ≥ 0, else 400; `meta`: an object (not an array) within 16 384 bytes (UTF-8),
  else 400; `files` (default `[]`): an array of at most 64 `{ name, data }`, else 400; a bad,
  repeated or non-8.3 name: 400 `bad file name`; `data` not padded base64: 400; a decoded file over
  1 MiB: 413 `too large`; files on a `docs` record: 400.
- `base` is not the record's current version (`0` when it does not exist): **409**
  `{ error: "conflict", updatedAt }`, the current version (`0` when there is none).
- The new record would take the account over its quota: **507**
  `{ error: "storage quota exceeded (<used> of <quota> MB used)", used, quota }` (bytes).
- A new record when its kind already has 500 records (`docs` exempt), or in a 33rd game: 507 `too many records`. A write that finds its account deleted while the request ran: **401**
  `signed out` (the account's folder is never recreated).
- Otherwise the record is replaced as a whole and the response is `{ updatedAt }`, its new version.

**Delete** `DELETE games/<game>/<kind>/<id>?base=<n>`: `base` a safe integer ≥ 0, else 400. A
record that does not exist: 200, whatever `base` is. `base` not the current version: 409
`{ error: "conflict", updatedAt }`. Otherwise the record is deleted: 200 `{ deleted: true }`.

### 2.6 Status codes

| Status | When | Client reaction ([§5.8](#58-refusals-and-failures)) |
|---|---|---|
| 200 | success | — |
| 400 | malformed request, invalid name, id, file name, meta, or password rule | for a record: refused, dropped from the queue |
| 401 | `signed out` (no valid session), or a wrong name / password / recovery code | the session is taken as ended |
| 403 | no `X-GoldBox` header; sign-up closed or invite missing or invalid; account locked; wrong re-entered password | shown |
| 404 | no such path or record | for a record: "absent" |
| 405 | wrong method on a record path, or a non-`GET`/`HEAD` request for an app file | — |
| 409 | stale `base` (`updatedAt` in the body), or a taken name at sign-up | for a record: a clash ([§5.7](#57-resolving-a-clash)) |
| 413 | body or file too large | for a record: refused, dropped from the queue |
| 415 | body not JSON | — |
| 429 | rate limit; `Retry-After` header and `retryAfter` (seconds) in the body | shown |
| 500 | `server error` (unexpected) | the operation stops, the queue stays |
| 503 | `the server could not store this just now` (disk full or I/O error; the record stays queued); `no new accounts can be made at the moment`; `health` failing | the operation stops, the queue stays |
| 507 | quota exceeded, or too many records | the push stops; the change stays queued |

## 3. Accounts and authentication

### 3.1 Names

An account name is the submitted string (at most 256 UTF-16 units) in Unicode NFKC form, with
surrounding white space removed and lower-cased; it
must then match **`^[a-z0-9_-]{3,24}$`**. Names are compared and stored in that form, so `Alice` and
`alice` are one account. Reserved (refused at sign-up and by the admin CLI): `admin`,
`administrator`, `root`, `system`, `sysadmin`, `support`, `help`, `api`, `www`, `web`, `mail`,
`goldbox`, `goldbox-rerolled`, `rerolled`, `server`, `owner`, `moderator`, `staff`, `security`,
`null`, `undefined`, `anonymous`, `guest`, `me`, `you`, `login`, `logout`, `signup`, `signin`,
`register`, `account`, `accounts`, `users`, `user`, `health`, `config`, `export`, `privacy`, `ssi`.

### 3.2 Passwords

- At least **10** and at most **256** characters, counted as Unicode code points of its NFKC form
  (the string that is hashed); a submitted string over 1 024 UTF-16 units is too long at once. The
  problems, as 400 messages: `a password is needed` (not a string), `the password needs at least 10
  characters`, `the password is too long`.
- Hashed with **scrypt** over the password in Unicode **NFKC** form: N = 2^15, r = 8, p = 1, a
  16-byte random salt per hash, a 64-byte key (memory limit 256·N·r + 1 MiB). At most two scrypt
  computations run at once; further ones wait.
- Stored as `{ alg: "scrypt", N, r, p, salt, hash }` (salt and key in base64), so the parameters can
  change for new hashes while old ones still verify. Comparison is constant-time.
- A sign-in for an unknown name verifies the password against a fixed dummy hash, so it costs the
  same time as a wrong password, and both give the same 401.

### 3.3 Sessions and the cookie

- A session token is **32 random bytes** in base64url without padding (43 characters). Only its
  SHA-256 (lower-case hex) is stored, as the session's file name ([§4.1](#41-data_dir-layout)). A
  presented token not of that form is ignored.
- A session is valid while it has not expired, its account exists and is not locked, and the
  account's **generation** equals the one recorded in the session. A password change, a recovery, an
  admin reset or a lock increments the generation and deletes the account's session files, so every
  session of the account ends.
- Lifetime `SESSION_DAYS` (default 30), **renewed by use**: a request with a session whose expiry is
  more than a day short of a full lifetime moves it to now + the lifetime (so the file is written at
  most once a day).
- Each sign-in (sign-up, login, recovery, password change) ends the session the request presented
  and starts a new one: a new token on every sign-in.
- **The cookie**: name `__Host-gbr_session`, or `gbr_session` when `COOKIE_SECURE=0`;
  `Set-Cookie: <name>=<token>; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=<lifetime in s>`
  (without `Secure` when `COOKIE_SECURE=0`). Signing out and deleting the account send the same
  attributes with an empty value and `Max-Age=0`. It is set at sign-in and sent again whenever use
  renews the session (at most once a day), so the browser keeps it as long as the server keeps the
  session. It is the only cookie.

### 3.4 Recovery and invite codes

- A code is **20 symbols** of the Crockford base-32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`
  (100 bits; each symbol is a random byte's low 5 bits), shown as five groups of four joined by `-`
  (`7K2M-…`).
- **As typed**: in NFKC form, upper-cased; white space and `-` removed; `O` read as `0`, `I` and `L` as `1`; then
  it must be 20 symbols of the alphabet, else it matches nothing. At most 64 characters are accepted.
- Stored only as SHA-256 hex of `goldbox-code:` + the normalised code.
- **Recovery code**: one per account, shown once at sign-up, after each recovery, and on request
  (`recovery-code`, after the password). Name plus code sets a new password ([§2.4](#24-account-calls)).
  No email address is collected; there is no other recovery.
- **Invite code** (`SIGNUP=invite`): made by the admin CLI, valid for a number of days (default 7),
  single use: taking it deletes it, and an expired one is deleted without being accepted.

### 3.5 Sign-up modes

`SIGNUP=open`: anyone may sign up, within the rate limit and `MAX_USERS`. `invite`: sign-up needs a
valid invite code. `off`: sign-up is refused and the client hides it. `MAX_USERS` counts existing
accounts (default 1000; 0 allows none); the admin CLI's `add-user` ignores it.

### 3.6 Rate limits

Counted in memory only, never written to disk, per key over a **sliding 15-minute window** (sign-up:
one hour). A key is refused while it has as many entries in the window as its limit; `retryAfter` is
the seconds until the oldest entry leaves the window.

| Counter | Key | Limit | Counted |
|---|---|---|---|
| sign-in | address | 20 / 15 min | failed logins |
| sign-in | account name | 10 / 15 min | failed logins; reset by a successful one |
| sign-up | address | 5 / hour | every sign-up attempt that passes the closed check and parses |
| recovery | address | 10 / 15 min | failed recoveries |
| recovery | account name | 5 / 15 min | failed recoveries |
| password re-entry | account | 10 / 15 min | wrong passwords on `password`, `recovery-code`, `delete-account` |

**The address** is the connection's peer address; with `TRUST_PROXY=1` it is the **last** entry of
`X-Forwarded-For` (the one the single proxy in front appended), the peer address when the header is
absent. When more than 50 000 keys are held, expired entries are swept and then the oldest keys
dropped down to 40 000.

## 4. Server storage

### 4.1 `DATA_DIR` layout

```
users/<name>/account.json                    the account
users/<name>/<game>/saves/<id>.json          a record's pointer
users/<name>/<game>/saves/<id>@<version>/    its files: SAVGAMA.DAT, CHRDATA1.SAV, … SAVGAMA.GBR
users/<name>/<game>/characters/<stem>.json, <stem>@<version>/
users/<name>/<game>/conflicts/<id>.json, <id>@<version>/
users/<name>/<game>/party.json, settings.json                   documents (pointer only)
sessions/<sha-256 hex of token>.json
invites/<sha-256 hex of "goldbox-code:" + code>.json
```

Directories are made with mode 0700 and files 0600. Every data path is built from the signed-in
account's name and validated game, kind and id; no request can name another account's records, and
no dot, slash or backslash can reach a path.

| File | Content |
|---|---|
| `account.json` | `{ v: 1, name, created (ms), pw: { alg, N, r, p, salt, hash }, recovery (hash hex), gen, disabled? }` |
| session | `{ user, gen, created, expires }` (ms) |
| invite | `{ created, expires }` (ms) |
| pointer `<id>.json` | `{ updatedAt, meta, files: [names], dir? }`: `dir` is `<id>@<updatedAt>`, the folder holding the files; absent for `docs` |

The files in a version folder are the game's own, byte for byte, under the names the client gave.

### 4.2 Atomic writes

- A file is written to a temporary name in the same folder (`.tmp-<random>`), synced to disk, and
  renamed over the target, so a reader sees the old content or the new, never a part.
- A record is replaced by writing its files into a temporary folder, renaming it to the new version
  folder, then replacing the pointer (atomically), then deleting the old version folder. A reader, or
  a crash, sees the old record or the new one, never a mixture; a crash may leave an unreferenced
  folder.
- An account is created by writing `account.json` into a temporary folder and renaming the folder to
  `users/<name>`; the rename failing because the name exists is "taken". An account is deleted by
  renaming its folder away (`users/.deleted-<random>`), then deleting that and its sessions.
- One account's record writes and deletions run one at a time; account creation runs one at a time
  overall. A full disk or an I/O error gives 503 and changes nothing.
- The admin CLI works on the same files while the server runs: the server re-reads `account.json`
  whenever its modification time or size changes.

### 4.3 Versions and conflicts

Optimistic concurrency, per record. A `PUT` or `DELETE` succeeds only when its `base` equals the
record's current `updatedAt` (`0` for a record that does not exist; deleting an absent record always
succeeds). Of two concurrent writes with the same `base`, exactly one wins; the other gets 409 with
the winner's version. The new version is `max(now in ms, current + 1)`. The server never merges: the
client resolves 409s ([§5.7](#57-resolving-a-clash)).

### 4.4 Quota

`used` is the total size of the files under the account's game folders (pointers and version
folders; `account.json` not counted), worked out from the disk once and then kept up to date. A
`PUT` is refused with 507 when `used` − (the replaced record's pointer and files) + (the new files +
the new pointer's JSON) exceeds `QUOTA_MB` MiB. Deletions free their space.

### 4.5 The data export

`GET export` answers `200` with `Content-Type: application/zip`, `Cache-Control: no-store`,
`Content-Disposition: attachment; filename="goldbox-rerolled-<name>-<YYYY-MM-DD>.zip"` (UTC date).
The ZIP ([storage.md §7.3](storage.md#73-zip-format)) holds, in this order:

- `README.txt`: three CRLF lines saying what the archive is: each saved game and character folder
  holds the original game files, to copy into the game folder for DOSBox; `record.json` beside them
  is the port's metadata; `party.json` and `settings.json` are the party and settings;
- for each game (sorted) and each record in listing order: a document as `<game>/<id>.json`, its
  `meta` as JSON indented by one space; any other record as `<game>/<kind>/<id>/<file>` for each of
  its files, then `<game>/<kind>/<id>/record.json`, `{ "updatedAt": …, "meta": … }` indented by one
  space.

## 5. Client sync

The client side of the contract. It runs per game, for the game open in the page: opening a game
starts that game's sync.

### 5.1 The local side

The sync sees the browser's data as records under the same keys as the server's
([storage.md](storage.md) for where each lives):

| Key | Browser data | As a record |
|---|---|---|
| `saves/A` … `saves/J`, `saves/AUTO` | a stored save in slot *x* or `auto` | [§1.3](#13-what-each-kind-holds) |
| `characters/<stem>` | a roster character | [§1.3](#13-what-each-kind-holds) |
| `conflicts/<id>` | a conflict copy | stored as the record itself |
| `docs/party` | `meta.party` | `{ meta: { stems }, files: [] }`; present when `meta.party` is set |
| `docs/settings` | the synced localStorage keys | `{ meta: { values }, files: [] }`; present when at least one is set |

Writing a record into the browser converts it back (a save to its slot, a character to the roster,
the party, the settings); a record that cannot be converted is not written. Removing one removes the
browser data.

### 5.2 Sync state

Per game, in localStorage under `goldbox.sync.<game id>`, as JSON:

```ts
{
  base: { [key]: number }     // the server version this browser last saw of each record
  dirty: { [key]: number }    // the queue: records changed here and not yet taken by the server, with the change's time (ms)
  seeded: { [key]: 1 }        // characters seeded from the game files, never synced yet
  errors: { [key]: string }   // records the server refused, with its message
  lastSync: number            // when the last pull finished (ms, 0: never)
  quotaFull?: boolean         // the last pass stopped at a full quota
}
```

It is saved after every change to it, so the queue survives a reload, going offline and signing out.
Missing fields read as empty.

### 5.3 Noting changes

Every write or deletion of the browser's data that a player's action causes reports its key: a save
or the autosave written, a roster character written or dropped, the party set, a conflict copy
deleted or restored, and `docs/settings` when the Settings panel closes with any synced key changed.
Writes made by the sync itself are not reported. For a reported key:

- a **change**: `dirty[key] = max(now, dirty[key] + 1)` (so a stamp only grows), and `seeded[key]`
  and `errors[key]` are removed;
- a **seed** (roster seeding, [storage.md §4](storage.md#4-roster-seeding)): `seeded[key] = 1`, only
  if the key has no `base` and is not dirty.

Changes are noted whether or not the browser is signed in, or a server exists.

### 5.4 When it runs

| Event | Action |
|---|---|
| a change noted while signed in | **flush** 1.5 s after the last change (debounced) |
| every 60 s while signed in with changes queued | flush |
| a game opened (probe first, [§5.11](#511-finding-the-server-and-the-status)) while signed in | **pull** |
| signing in, signing up, recovering | pull ([§5.10](#510-owners-switching-signing-out-forgetting)) |
| *Sync now* | pull |
| the tab becomes visible, signed in, more than 30 s since `lastSync` | pull |
| the browser's `online` event, signed in | pull |

After a pull the client fetches `me` again for `used`. Operations run one at a time, in order.

### 5.5 Push

**Flush**: clear `quotaFull`; go through the dirty keys **twice** (the second pass sends the
conflict copies the first one made), pushing each key at most once, stopping when `quotaFull` is
set.

**Push one key** (`stamp = dirty[key]`; nothing to do when absent; `base = base[key] ?? 0`):

1. The record exists in the browser: `PUT` it with `base` and `meta` = its meta plus
   **`modifiedAt: stamp`**. On 200: `base[key] = updatedAt`, remove `errors[key]`, and remove
   `dirty[key]` if it still equals `stamp` (a change made meanwhile stays queued). On 409: resolve
   ([§5.7](#57-resolving-a-clash)).
2. It does not: if the key has no `base`, it never reached the server: remove it from the queue.
   Otherwise `DELETE` with `base`. On 200: remove `base[key]` and the queue entry (as above). On 409:
   resolve with no local record.

### 5.6 Pull and merge

**Pull**: clear `quotaFull`; list the server's records for the game; for every key in the union of
the browser's keys, the server's, the dirty keys and the keys with a `base`, **merge** it (saving
the state after each); then push every key still dirty (stopping at a full quota); set `lastSync`.

**Merge one key**, with `L` the browser's record, `S` the server's listing entry, then
`d = dirty[key]`, `b = base[key]`:

1. **Never synced** (`L` exists, `d` and `b` absent): data from before signing in, or seeded.
   - If seeded: remove the seed mark; if `S` exists, **download** it and stop (a seeded character
     never beats the server's); otherwise `dirty[key] = 0`.
   - Otherwise `dirty[key]` = the record's own time: `meta.savedAt`, else `meta.modifiedAt`, else 0.
     So an old save from before signing in loses to a newer one on the server and becomes a conflict
     copy instead of overwriting it.
2. Remove any seed mark, and re-read `d`, `b`.
3. `S` exists:
   - `d` absent: download if `b ≠ S.updatedAt` or `L` is absent (changed on the server only, or
     missing here);
   - `d` set and `b = S.updatedAt`: push (changed here only);
   - `d` set and `b ≠ S.updatedAt`: **resolve** with `L` and `d` (changed on both sides).
4. `S` absent, `L` exists:
   - `d` absent and `b` set: deleted on another device: remove the browser's record and `base[key]`;
   - otherwise remove `base[key]`; if `d` is absent set it to the record's own time (as in 1); push.
5. Neither exists: remove `base[key]` and `dirty[key]`.

**Download** a key: a `docs` record is taken from the listing (its `meta`, no files); any other is
fetched with `GET` (a 404 changes nothing). If the key's queue entry changed while it was fetched,
nothing is written (the next flush decides); otherwise the record is written into the browser and
`base[key] = updatedAt`.

### 5.7 Resolving a clash

Called after a 409, or from the merge, with the browser's record `L` (or none, for a deletion) and
its `stamp`:

1. `GET` the server's record `R`. If there is none: remove `base[key]`; with no `L`, remove the queue
   entry and stop; else `PUT` `L` with `base` 0 (on 200 record the version and clear the entry) and
   stop.
2. `L` and `R` have **the same content**: equal `meta` ignoring every `modifiedAt` field at any depth
   (objects compared with their keys sorted), and the same files (same count; each name with the
   same bytes). No clash: `base[key] = R.updatedAt`, clear the entry, stop.
3. No `L` (deleted here, changed there): **a change beats a deletion**: take `R` (below).
4. The **newer change wins**: this browser's if `stamp > R.meta.modifiedAt` (a missing
   `modifiedAt` counts as 0; on a tie the server's wins).
5. For `saves` and `characters`, the loser is kept as a **conflict copy**: a new id (`c`, the time
   in base 36, up to six random base-36 digits), written in the browser as `conflicts/<id>` with the
   loser's files and its meta plus `conflictOf`, `conflictId`, `from` (`"server"` when the browser
   won, `"browser"` when it lost), `keptAt` (now) and `modifiedAt` (the losing change's time), and
   queued with `dirty = now`, so it reaches the server too. For `docs` the newer simply wins, with no
   copy.
6. The browser won: `PUT` `L` with `base = R.updatedAt` and `modifiedAt: stamp` (on 200 record the
   version and clear the entry; a further 409 leaves it queued). The server won: take `R`.

**Take** `R`: if the queue entry no longer equals `stamp`, do nothing; otherwise write `R` into the
browser, `base[key] = R.updatedAt`, clear the entry.

The Account section and Load show the copies ([storage.md §3.4](storage.md#34-conflict-copies)).
Restoring one is a change to the record it was copied from, and deletes the copy (a deletion,
synced).

### 5.8 Refusals and failures

- 400 or 413 for a record: the server will never take it. `errors[key]` = the message, and the key
  leaves the queue (until it changes again). The Account section counts these: "*n* not accepted by
  the server".
- 507: `quotaFull` is set, `errors[key]` = the message, the key stays queued, and the pass stops.
  The status then reads "Your storage on the server is full: delete conflict copies or saves you no
  longer need."
- 401: the operation stops; the client is signed out ("Your session ended: sign in again."). The
  queue stays.
- Anything else (network failure, 403, 429, 5xx): the operation stops and the queue stays. A network
  failure marks the client offline: "The server cannot be reached: changes wait in this browser."
  Other errors show the server's message.

### 5.9 Settings

The synced settings are eight localStorage keys: `poolrad.sound`, `poolrad.font`, `poolrad.frames`,
`poolrad.partylayout`, `poolrad.view`, `poolrad.motion`, `poolrad.textsize`, `poolrad.gfx`
([storage.md §8](storage.md#8-localstorage-keys)). Every other key stays in the browser.

- **Writing to the server**: `docs/settings` with `meta.values` = each of the eight that is set.
- **Writing into the browser**: each of the eight is set from `meta.values` when its value there is a
  string, and **removed** when it is absent. Then the text size, the party layout and the sound
  device apply at once; the view when the play screen is next opened; the motion choice is read when next used; the font and window borders apply
  when a game is next opened; the graphics mode after the next page load.
- **One set for every game (C22).** The server keeps a settings record per game
  (`users/<name>/<game>/settings.json`), but the browser has one set of these keys for every game.
  Each game's sync reads and writes the same keys, so the settings merged last, from whichever game,
  hold in that browser for every game; a change made while one game is open is sent as that game's
  settings only. This is the port's behaviour and is normative.

### 5.10 Owners: switching, signing out, forgetting

- **The owner** (`goldbox.account`) is whose data this browser holds: set to the account's name on
  every sign-in, sign-up or recovery.
- **Signing in as another account.** Before the request, when the typed name (trimmed, lower-cased)
  is not the owner, the client asks: "This browser holds *owner*'s saved games and characters[, with
  *n* changes not yet on the server that would be lost]. Signing in as *name* replaces them with that
  account's (*owner*'s stay on the server). Go on?". After the server accepts: every game's player
  database is deleted, every game's sync state is cleared, the owner is set, and a pull fetches the
  new account's records. The game files and the settings stay.
- **Sign out**: changes still queued are flushed first (when that fails they stay queued for the
  next sign-in); `POST logout` (a failure is ignored); the browser keeps its copy and its owner.
  "Signed out. This browser keeps its copy and works as before."
- **Sign out and remove this browser's copy** (for a shared computer), after "Sign out and remove
  this browser's saved games, characters and party for every game? What is on the server stays.": as
  sign out, then every game's player database and sync state and the owner are removed. "Signed out;
  this browser's copy is removed."
- **Delete account**, after the password and "Delete your account and all its data on the server?
  This cannot be undone.": `POST delete-account`; every game's sync state and the owner are removed;
  the browser's data stays, linked to no account. "Your account and its data on the server are
  deleted."

### 5.11 Finding the server and the status

- **Probe**: `GET me` (credentials included, no cache). A server is present when the response is
  2xx, JSON, with `server: "goldbox-rerolled"` and `api: 1`; then `user` says who is signed in. Any
  other answer means no server: every account control is hidden. A network failure leaves the
  client offline; the controls stay shown if the browser has an owner.
- The probe runs when the games screen opens and when a game is opened.
- The client's **status**: whether a server is present, its public configuration, the signed-in
  user, the owner, online or not, busy (an operation running), the number of queued keys, `lastSync`,
  the last error in words, the number of refused records, and `used`.

## 6. The Account section

Shown only when a server is present ([§5.11](#511-finding-the-server-and-the-status)): on the games
screen, in Settings, as a button beside Games and Settings on the party screen, and under ☰ in play.
The button reads "Sign in / create account" signed out, and "Account: *name* · offline | syncing… |
*n* to send | synced" signed in. Conflict copies are listed only when a game is open.

| State | Shows |
|---|---|
| signed out | "With an account your saved games, autosave, characters, party, journal finds and these settings are kept on this server and come to any browser you sign in on. Without one everything stays in this browser, as before."; "This browser holds *owner*'s data[ (*n* changes not on the server yet)]." when there is an owner; "The server cannot be reached just now." when offline; Name, Password, **Sign in**, **Create account** (not with `SIGNUP=off`), **Forgot password**, **Privacy** |
| create account | Name (3–24 of letters, digits, `-`, `_`), Password and Again (at least `passwordMin`), Invite code (with `SIGNUP=invite` only); **Create account**, Back; then the recovery code |
| forgot password | Name, Recovery code, New password and Again; **Set new password**, Back; then the new recovery code |
| recovery code | "Your recovery code:" and the code; "Keep it somewhere safe (a password manager, or on paper). With your name it sets a new password if you forget yours, and it is shown only now. There is no email recovery."; **I have kept it** |
| signed in | "Signed in as *name*[ (offline: changes wait in this browser)]." with "last synced *time*" or "syncing…", "*n* change(s) waiting" or "nothing waiting", "*n* not accepted by the server", "*used* of *quota* MB used"; the last error; **Sync now**, **Sign out**, **Sign out and remove this browser's copy**; the conflict copies; **Download my data** (a link to `export`), **Change password**, **New recovery code**, **Delete account**, **Privacy** |
| change password | Current password, New password and Again; "Signs you out on every other browser."; then "Password changed; other browsers are signed out." |
| new recovery code | Password; "A new recovery code; the old one stops working."; then the code |
| delete account | "This deletes your account and everything the server keeps for it (saved games, characters, settings, for every game). It cannot be undone. This browser keeps its own copy."; Password |
| privacy | what the server keeps (below) |

The signed-out, create-account and signed-in states end with "The game files (the DAX files,
`START.EXE` and the rest) are never uploaded: each browser needs its own import." Two password fields that differ give "The two passwords differ."
without a request. A server error is shown as its message. The section never redraws over a form
being filled in.

**Privacy** text: the server keeps the account name, the password and recovery code only as salted
hashes; the saved games and autosave, characters, party, journal finds and these settings, for each
game; while signed in, one session cookie (the only cookie, needed to sign in). No email address, no
tracking, analytics or adverts; the imported game files never leave the browser. Sign-in and sign-up
attempts are counted per network address in memory only, never written to disk, and forgotten
within the hour; the log notes the time, kind and result of requests, not the address or the data.
*Download my data* exports everything kept; *Delete account* removes it all from the server at once.
Questions go to whoever runs the server.

## 7. Serving the app and security headers

The server also serves the built app (`WEB_ROOT`) for every path outside `/api/v1/`.

- **Headers on every response** (API and files):

  | Header | Value |
  |---|---|
  | `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
  | `X-Content-Type-Options` | `nosniff` |
  | `X-Frame-Options` | `DENY` |
  | `Referrer-Policy` | `same-origin` |
  | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |
  | `Cross-Origin-Opener-Policy` | `same-origin` |
  | `Cross-Origin-Resource-Policy` | `same-origin` |
  | `Strict-Transport-Security` | `max-age=31536000`, only when `COOKIE_SECURE` is on |

  The app therefore MUST NOT need inline scripts, other origins, or `eval`; inline style attributes,
  `data:`/`blob:` images, fonts and media (window borders, the game font built in memory, downloads)
  are allowed.
- **Files**: `GET` and `HEAD` only (else 405 with `Allow: GET, HEAD`). The path is percent-decoded;
  a trailing `/` means `index.html`; a path with a NUL, a `..` segment or a segment starting with `.`
  is 404, as is anything outside `WEB_ROOT`, a folder, or a missing file (plain text `not found`).
  There is no fallback to `index.html`. When `WEB_ROOT/index.html` itself is missing, every miss is
  503 "The app is not built: run npm run build in web/.".
- **Caching**: files under `assets/` (content-hashed bundles) `Cache-Control: public,
  max-age=31536000, immutable`; everything else (`index.html`, `sw.js`, the manifest, the journal
  images) `no-cache`. Each file has `ETag: "<size in base 36>-<mtime in ms, base 36>"`; a matching
  `If-None-Match` gives 304.
- **Types** by extension: `.html` `text/html`, `.js`/`.mjs` `text/javascript`, `.css` `text/css`,
  `.json`/`.map` `application/json`, `.txt` `text/plain` (all `; charset=utf-8`),
  `.webmanifest` `application/manifest+json; charset=utf-8`, `.svg` `image/svg+xml`, `.png`
  `image/png`, `.jpg` `image/jpeg`, `.ico` `image/x-icon`, `.woff2` `font/woff2`, `.wasm`
  `application/wasm`; anything else `application/octet-stream`.

## 8. Configuration

The server is configured by environment variables only, read at start; an invalid value stops it
with a message.

| Variable | Default | Rule |
|---|---|---|
| `PORT` | `8080` | integer 0–65535 |
| `HOST` | `0.0.0.0` | the listening address; `127.0.0.1` behind a proxy on the same machine |
| `DATA_DIR` | `$XDG_DATA_HOME/goldbox-rerolled` when `XDG_DATA_HOME` is an absolute path, else `~/.local/share/goldbox-rerolled` | made absolute; outside the repository; `/data` in the Docker image |
| `WEB_ROOT` | `web/dist` beside `server/` | the built app |
| `COOKIE_SECURE` | on | `Secure` cookie, `__Host-` prefix and HSTS; off only for plain HTTP on a LAN |
| `TRUST_PROXY` | off | on behind exactly one reverse proxy ([§3.6](#36-rate-limits)) |
| `SIGNUP` | `open` | `open`, `invite` or `off`, any case |
| `MAX_USERS` | `1000` | integer 0–10 000 000 |
| `QUOTA_MB` | `20` | integer 1–100 000; MiB per account |
| `SESSION_DAYS` | `30` | integer 1–365 |
| `LOG_REQUESTS` | on | off: no per-request lines (errors are still logged) |

A flag is on for `1`, `true`, `yes` or `on` (any case), off for any other non-empty value, and its
default when unset or empty. The scrypt cost N = 2^15 is fixed. At start the server prints one line
(address, data folder, app folder, sign-up mode, and "insecure cookies" / "behind a proxy" when they
apply). SIGINT or SIGTERM closes it (exit 0, at most 5 s); a second signal exits at once with 1.

## 9. Admin CLI

`node server/admin.ts <command> [arguments]`, with the same environment as the server (`DATA_DIR`
at least); safe while the server runs. An error prints `error: <message>` and exits 1; an unknown
command prints the help and exits 2; no command, `help` or `--help` prints the help.

| Command | Effect |
|---|---|
| `add-user <name>` | creates an account (name rules and reserved names apply; `MAX_USERS` does not); the password is prompted twice at a terminal, else the first line of standard input; prints the recovery code |
| `reset-password <name>` | sets a new password (prompted as above): every session ends; prints a new recovery code |
| `disable-user <name>` | locks the account: it cannot sign in, its sessions end |
| `enable-user <name>` | unlocks it |
| `remove-user <name> [--yes]` | deletes the account and all its data, after a yes/no question at a terminal; without a terminal only with `--yes` |
| `list-users` | one line per account: name, creation date, `LOCKED`, storage used |
| `create-invite [--days N]` | prints a single-use invite code valid N days (1–365, default 7) and its expiry (UTC) |
| `stats` | the number of accounts (locked, the limit, the sign-up mode), stored sessions, open invites, storage used and the quota |
| `prune` | deletes expired or orphaned sessions (account gone, locked or changed) and expired invites, and says how many |

## 10. Logging

With `LOG_REQUESTS` on, one line per request: `<METHOD> <path> <status> <ms>ms`, where a record path
is shortened to `/api/v1/games/<game>/<kind>/…` (ids are character names) and any path to 200
characters; never the query string, addresses, bodies, cookies, tokens, passwords or codes. Errors
log `storage error <code>` or `error on <METHOD> <path>: <message>`.

## Validation

The conformance tests for this file, run against a real server on a random port with a temporary
data folder (from `web/`: `npx vitest run test/server.test.ts test/sync.test.ts`):

- `web/test/server.test.ts`: public endpoints and the headers (§2.3, §7); HSTS and the secure
  cookie (§3.3); sign-up checks, closed and invite modes, the address limit, `MAX_USERS` (§2.4, §3);
  sign-in, sessions, password change, recovery, locking (§3); data: sessions, the header and
  isolation, validation of games, kinds, ids and file names, byte-for-byte storage and versions, the
  quota, request size, concurrent writes, the export, account deletion, DOSBox-ready files (§2.5, §4);
  the admin CLI (§9).
- `web/test/sync.test.ts`: first sign-in, one-sided changes, clashes either way round, identical
  content, old local saves, seeded characters, settings and the party (§5.6, §5.7); deletions, the
  offline queue across a reload, refused records, a full quota, a lost session (§5.5, §5.8); records
  in the original formats (§1.3).

This file does not depend on them: they check it. Results go to [VALIDATION.md](../VALIDATION.md).

## Open

- Settings are one set per browser but one record per game on the server (§5.9, C22): documented as
  the behaviour; per-game settings would be a change of both sides.
