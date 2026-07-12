# Data model

Canonical TypeScript types live in `apps/desktop/data/model.ts` (`DATA_VERSION` is the store export version).

## Persistence (current)

| Store | Location | Notes |
|-------|----------|--------|
| SQLite `devdesk.db` | Electron userData | Primary store; WAL; single-writer main process |
| Legacy `devdesk-store.json` | Same userData | Imported once when preferences table is empty |
| Engine indexes | `userData/engine/<projectId>.sqlite` | Performance engine |
| Bug attachments | `userData/attachments/` | Files on disk |

See [data-locations.md](./data-locations.md) for OS paths and backup/export behavior.

## Core entities

### Project
- `id`, `path`, `name`, `type` (`node | python | rust | go | unknown`), `icon`
- `linkedContainerNames`, optional `isPinned` / `pinnedAt`

### Command
- `id`, `name`, `command`, optional `description`, `tags`, `projectId`, `workingDirectory`
- optional `variables`, `isPinned` / `pinnedAt`

### Run history
- `id`, `commandId`, optional `projectId`, `status`, `startTime`, `endTime`, `output`
- optional `resolvedCommand`

### Project notes
- `projectId`, `setupSteps`, `todos`, `reminders`

### Preferences
- `editor` / `terminal` (`id`, optional `command`)
- `trayEnabled`

### Bugs / health / automation
- Bug reports, context snapshots, attachments
- Health check runs
- Command chains and triggers

Containers from Docker are **runtime-only** (not persisted as the source of truth).

## SQLite tables (overview)

Created in `apps/desktop/data/store/core.ts` (`createSchema`), including:

- `projects`, `commands`, `chains`, `triggers`, `run_history`, `notes`, `preferences`
- `engine_indexes`, `engine_search_sessions`
- `health_check_runs` (and related)
- `bug_reports`, `bug_context_snapshots`, `bug_attachments`

### Schema compatibility

`ensureSchemaCompatibility` adds missing columns for older DBs:

- `commands.variables`, `commands.is_pinned`, `commands.pinned_at`
- `projects.is_pinned`, `projects.pinned_at`
- `run_history.resolved_command`

### JSON → SQLite migration

On init (`initializeDatabaseAt` / `ensureDbInitialized`):

1. Open/create `devdesk.db`, enable WAL + foreign keys  
2. `createSchema` + `ensureSchemaCompatibility`  
3. If no preferences row exists, import normalized JSON from `devdesk-store.json` (or write defaults)

Legacy note fields `ports` / `urls` merge into `setupSteps` when setup steps are empty (`normalizeNotes`).

## Export format

In-app export produces a versioned JSON document of table rows (`export.ts`).  
Import supports **merge** and **replace**, with a `devdesk.db.backup-*` file created first.  
Attachment **files** are not embedded in the export payload (metadata only).
