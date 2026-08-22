# Local data locations, backup, and export

DevDesk is **local-first**. Product data lives under Electron **userData**.

## Default userData paths

| OS | Typical path |
|----|----------------|
| Windows | `%APPDATA%\DevDesk` (e.g. `C:\Users\<you>\AppData\Roaming\DevDesk`) |
| Linux | `~/.config/DevDesk` |
| macOS (if added later) | `~/Library/Application Support/DevDesk` |

Override for testing:

```text
DevDesk.exe --user-data-dir=C:\path\to\profile
```

## Files

| Path (under userData) | Purpose |
|-----------------------|---------|
| `devdesk.db` | Primary SQLite store |
| `devdesk.db-wal` / `devdesk.db-shm` | WAL sidecars (normal while running) |
| `devdesk-store.json` | Legacy JSON; imported once when preferences are empty |
| `engine/` | Per-project engine indexes (`<projectId>.sqlite`) |
| `attachments/` | Bug attachment files (not fully packed in v1 JSON export) |
| Chromium caches | Electron runtime; safe to delete when the app is closed |

Schema: [data-model.md](./data-model.md). Export code: `apps/desktop/data/store/export.ts`.

## In-app export / import

Settings → Export / Import.

| Mode | Behavior |
|------|----------|
| **Export** | Versioned JSON of table rows (`EXPORT_VERSION` = store `DATA_VERSION`) |
| **Import · merge** | Upserts rows into the existing database |
| **Import · replace** | Replaces table contents after validation |

Before import, DevDesk writes `devdesk.db.backup-<timestamp>` next to the DB. If import fails, quit the app, replace `devdesk.db` with that backup, and remove stale `-wal`/`-shm` if needed.

### Attachments

Export includes attachment **metadata** (paths/sizes), not the files in `attachments/`. Copy that folder yourself for a full machine move.

## Manual backup

With the app **closed**:

1. Copy userData, or at least `devdesk.db` (+ WAL files if present), `engine/`, and `attachments/`
2. To restore: quit DevDesk, replace those files, relaunch

## Factory reset

Quit DevDesk, delete the userData directory, relaunch. A new empty `devdesk.db` is created.

## Privacy

No cloud sync, analytics, or accounts in the core product. Run history, notes, and bug snapshots can contain command output and absolute paths — treat userData as sensitive.

## Engine indexes

The engine indexes **text files under a project root**. UI “indexed size” is logical file bytes (`SUM(files.size_bytes)`), not only the SQLite file size.

| Metric | Meaning |
|--------|---------|
| Logical indexed bytes | `SUM(files.size_bytes)` |
| Searchable content bytes | UTF-8 stored for FTS |
| Physical DB bytes | On-disk `engine/<id>.sqlite` |

### Profiles

| Profile | Default | Includes |
|---------|---------|----------|
| `source-first` | **Yes** | Source/config; excludes planning HTML, `packages/landing/**`, docs-only languages, build artifacts |
| `source-docs` | No | Source + documentation languages |
| `full-text` | No | All languages the engine already supports |

Choice is saved per project on `engine_indexes.index_profile`. Optional `.devdeskignore` at the **project root** applies extra gitignore-style excludes after `.gitignore` and default skip dirs.

CLI (from a built engine):

```bash
npx devdesk-engine index /path/to/repo --full --profile source-first
npx devdesk-engine index /path/to/repo --full --profile full-text
```
