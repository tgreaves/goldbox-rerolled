# Accounts and sync

> **Status: stub, to be written** (work-plan step 3, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The optional server and the browser's side of it: the API, records and their meta, merge rules, data layout, security and configuration.

## Will contain

- the HTTP API, limits and status codes; records and the `meta` of each kind; sync and merge rules, the queue, conflict copies
- accounts: the name rule (3–24 of `a-z 0-9 _ -`, lower-cased, NFKC), reserved names, recovery and invite codes, scrypt parameters, sessions
- which settings sync, and that they are per game on the server while the browser keys are shared by every game (C22)
- data layout and configuration; deployment stays in [docs/server.md](../../docs/server.md)

## Sources to fold in

- [docs/server.md](../../docs/server.md) (design to configuration)
- `server/`, `web/src/store/sync.ts`, `account.ts`, `records.ts`, `api.ts`
- IMP-072
