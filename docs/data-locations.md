# Local data locations, backup, and export

DevDesk is **local-first**. All product data lives on the user’s machine under the Electron **userData** directory.

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

## Files and folders

| Path (under userData) | Purpose |
|-----------------------|---------|
| `devdesk.db` | Primary SQLite store (projects, commands, history, notes, prefs, bugs, health, engine index metadata, …) |
| `devdesk.db-wal` / `devdesk.db-shm` | SQLite WAL sidecars (normal while the app is running) |
| `devdesk-store.json` | Legacy JSON store; imported once into SQLite when the DB has no preferences yet |
| `engine/` | Per-project engine SQLite indexes (`<projectId>.sqlite`) |
| `attachments/` | Bug report attachment files (on disk; not fully included in v1 JSON export payload) |
| Chromium caches (`Cache`, `Code Cache`, `GPUCache`, …) | Electron runtime caches; safe to delete when the app is closed |

Schema and entity overview: [data-model.md](./data-model.md).  
Export implementation: `apps/desktop/data/store/export.ts`.

## In-app export / import

Use the app **Export / Import** UI (Settings / dialog):

| Mode | Behavior |
|------|----------|
| **Export** | Writes a versioned JSON document of table rows (`EXPORT_VERSION` matches store data version). |
| **Import · merge** | Upserts imported rows into the existing database. |
| **Import · replace** | Replaces table contents with the backup (after validation). |

### Safety

- Before import, DevDesk creates a file backup next to the DB:
  `devdesk.db.backup-<timestamp>`
- If import fails after backup, restore by closing the app and replacing `devdesk.db` with the backup file (also remove stale `-wal`/`-shm` if needed).

### Attachment limitation (v1)

Export records **bug attachment metadata** (paths/sizes) but does **not** pack binary files from `attachments/`. Import may warn that external files will be missing. Copy the `attachments/` folder manually if you need a full machine migration.

## Manual backup checklist

With the app **closed**:

1. Copy the entire userData folder, **or** at least:
   - `devdesk.db` (+ `-wal`/`-shm` if present)
   - `engine/`
   - `attachments/` (optional)
   - `devdesk-store.json` (if still present)
2. Store the copy offline.
3. To restore: close DevDesk, replace those files, relaunch.

## Wipe / factory reset

1. Quit DevDesk completely.
2. Delete the userData directory (paths above).
3. Relaunch — a new empty `devdesk.db` is created.

## Privacy

- No cloud sync, analytics, or accounts in the core product.
- Command output and project paths may appear in run history and bug context snapshots — treat userData as sensitive.

## Engine index scope (what gets searched)

The Performance Engine indexes **text files under a project root**. Indexed size in the UI is the sum of file `size_bytes` (logical), not only the SQLite file size.

| Metric | Meaning |
|--------|---------|
| Logical indexed bytes | `SUM(files.size_bytes)` |
| Searchable content bytes | UTF-8 bytes stored for FTS (`SUM(LENGTH(CAST(content AS BLOB)))`) |
| Physical DB bytes | On-disk `engine/<id>.sqlite` size |

### Profiles

| Profile | Default | Includes |
|---------|---------|----------|
| `source-first` | **Yes** | Source/config languages; excludes planning HTML, `packages/landing/**`, pure markdown/HTML languages, build artifacts |
| `source-docs` | No | Source + documentation languages; still drops landing/build artifacts |
| `full-text` | No | All languages the engine already supports (plus optional ignore file) |

In the app: open a project’s **Performance Engine** panel and use **Index scope** before Index / Reindex. The choice is saved per project with the index metadata.

CLI:

```bash
npx devdesk-engine index /path/to/repo --full --profile source-first
npx devdesk-engine index /path/to/repo --full --profile full-text
```

### `.devdeskignore`

Optional gitignore-style file at the **project root**. Applied after the Rust scan (which already honors `.gitignore` and default dirs like `node_modules` / `dist`). Checked in for this monorepo at the repository root.

Maintainability baseline (largest source files by line count):

```bash
npm run report:file-sizes
npm run report:file-sizes:json -- 40
```

Related plan: [planning/codebase-size-optimization-plan.html](./planning/codebase-size-optimization-plan.html).
