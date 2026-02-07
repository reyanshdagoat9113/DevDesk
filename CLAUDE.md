# CLAUDE.md

## Common Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Architecture

DevDesk is an Electron app with a three-layer architecture:

- Main process: Node.js + TypeScript in `apps/desktop`. Handles IPC, command execution, persistence, and project detection.
- Renderer: TypeScript + React in `apps/renderer`. UI only.
- Preload: `apps/desktop/preload.ts` exposes a small, explicit API as `window.electronAPI`.

Implementation notes:
- IPC channels use kebab-case (e.g. `projects:add`, `commands:run`).
- Current data store is JSON in userData as `devdesk-store.json`. Schema lives in `apps/desktop/data/model.ts`.
- Planned migration to SQLite using `better-sqlite3` in userData as `devdesk.db` with WAL and a one-time JSON import.
- `reconcileRunHistory()` marks any "running" entries as "stopped" on startup.

## Current Feature Coverage

Implemented:
- Projects: add, edit, remove, open folder/editor/terminal, type detection.
- Preferences: editor/terminal selection with custom command support (`{path}`).
- Commands: create/edit/delete/run, tags + description, project binding + working directory.
- Run history: status + output streaming + output retrieval + clear.
- Notes: per-project setup steps/todos/reminders.
- Containers: list/start/stop/logs via Docker CLI with Windows + WSL fallback.

Not implemented yet:
- Command search/filter UI.
- Run history shows command + project names instead of ids.
- Production build verification.

## Key Constraints
- Local-first only. No cloud, no accounts, no AI.
- Safe by default. Destructive actions require confirmation.
- Platform targets: macOS + Windows (Linux post-MVP).

## Build Outputs
- Renderer output: `dist/renderer`
- Main/preload output: `dist/main`, `dist/preload` (tsc)
- Production loads `../../renderer/index.html` from main process build output.
