# Data model

Canonical TypeScript types: `apps/desktop/data/model.ts`.  
Export version: `DATA_VERSION` (currently **5**), also `EXPORT_VERSION` in `apps/desktop/data/store/export.ts`.

OS paths and backup behavior: [data-locations.md](./data-locations.md).

## Stores

| Store | Location | Notes |
|-------|----------|--------|
| SQLite `devdesk.db` | Electron userData | Primary; WAL; main process is the only writer |
| Legacy `devdesk-store.json` | Same folder | Imported once when the preferences table is empty |
| Engine indexes | `userData/engine/<projectId>.sqlite` | Separate DBs; not mixed into `devdesk.db` rows except metadata |
| Bug attachments | `userData/attachments/` | Files on disk; export stores metadata only |

Containers from Docker are **runtime-only**. Linked names are stored on the project.

## Entities

### Project

`id`, `path` (unique), `name`, `type` (`node | python | rust | go | unknown`), `icon`, `linkedContainerNames`, optional `isPinned` / `pinnedAt`.

### Command

`id`, `name`, `command`, optional `description`, `tags`, `projectId`, `workingDirectory`, `variables[]`, optional pin fields.

Variable tokens are documented in [user-guide.md](./user-guide.md).

### Chain / trigger

- **Chain:** ordered `steps` (`commandId`, optional variables, `delayMs`), `stopOnFailure`, `parallel` (unused in UI today).
- **Trigger:** `chainId`, `event` (`onProjectOpen | afterContainerStart | onStartup`), `enabled`, `requireConfirmation`.

### Run history

`commandId`, optional `projectId`, `status` (`running | success | failed | stopped`), timestamps, `output`, `resolvedCommand`. Startup reconciliation turns leftover `running` into `stopped`. List queries omit `output` (loaded on demand via `history:output`) and paginate (default 200, max 500). Persisted output is capped to the first 64 KiB plus last 512 KiB of the stream.

### Notes

Per project: `setupSteps`, `todos`, `reminders` (markdown strings). Legacy `ports` / `urls` merge into `setupSteps` when setup is empty.

### Preferences

`editor` / `terminal` (`id` + optional `command` with `{path}`), `trayEnabled`.

### Engine metadata (in `devdesk.db`)

- `engine_indexes` — `dbPath`, `lastIndexed`, `fileCount`, `indexProfile` (`source-first | source-docs | full-text`)
- `engine_search_sessions` — last query/result JSON per project

Indexed file content lives in the engine SQLite, not here.

### Health

Runs + items: category `system | project | runtime`, status `pass | warning | fail | skipped`.

### Bugs

Reports (severity/status), context snapshots (JSON blobs of recent activity), attachments (`kind`, `fileName`, `filePath`, `fileSize`).

## SQLite tables

Created in `apps/desktop/data/store/core.ts`:

`projects`, `commands`, `chains`, `triggers`, `run_history`, `notes`, `preferences`, `engine_indexes`, `engine_search_sessions`, `health_check_runs`, `health_check_items`, `bug_reports`, `bug_context_snapshots`, `bug_attachments`.

### Compatibility

`ensureSchemaCompatibility` adds columns older DBs may lack:

- `commands.variables`, `commands.is_pinned`, `commands.pinned_at`
- `projects.is_pinned`, `projects.pinned_at`
- `run_history.resolved_command`
- `engine_indexes.index_profile`

### Init sequence

1. Open/create `devdesk.db`, enable WAL + foreign keys
2. `createSchema` + `ensureSchemaCompatibility`
3. If no preferences row, import normalized JSON from `devdesk-store.json` or write defaults

Corrupt DB files are renamed `devdesk.db.corrupt-<timestamp>` when open fails.

## Export format

In-app export is a versioned JSON document of table rows. Import supports **merge** (upsert) and **replace** (after a `devdesk.db.backup-*` copy). Attachment **binaries** are not embedded.
