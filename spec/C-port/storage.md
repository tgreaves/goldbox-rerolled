# Storage

> **Status: stub, to be written** (work-plan step 3, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

What the port keeps in the browser and in files: the IndexedDB databases, stores and value shapes, the localStorage keys, the `.GBR` sidecar, ZIP export and import, roster seeding, autosave.

## Will contain

- databases and stores per game (the legacy `poolrad` names kept on purpose), keys and value shapes (`StoredSave` …)
- localStorage keys (`poolrad.*`, `goldbox.*`) and which are synced
- the `.GBR` sidecar: `format: "goldbox-rerolled-save"`, `version`, `known` (journal ids and commission offers)
- ZIP writer and reader rules; import of DOS folders; roster seeding (IMP-016); autosave (IMP-060)

## Sources to fold in

- `web/src/store/` (reference implementation)
- IMP-002, 006, 016, 060
