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
- The data store is JSON in userData as `devdesk-store.json`. Schema lives in `apps/desktop/data/model.ts`.
- `reconcileRunHistory()` marks any "running" entries as "stopped" on startup.

## Current Feature Coverage

Implemented:
- Projects: add, remove (IPC), open folder/editor/terminal, type detection.
- Preferences: editor/terminal selection with custom command support (`{path}`).
- Commands: create, run, stop, tags + description.
- Run history: status + output streaming + output retrieval.
- Notes: per-project ports/urls/reminders.

Not implemented yet:
- Docker integration (containers IPC is stubbed).
- Command edit/delete and search UI.
- Project removal UI.

## Key Constraints
- Local-first only. No cloud, no accounts, no AI.
- Safe by default. Destructive actions require confirmation.
- Platform targets: macOS + Windows (Linux post-MVP).

## Build Outputs
- Renderer output: `dist/renderer`
- Main/preload output: `dist/main`, `dist/preload` (tsc)
- Production loads `../../renderer/index.html` from main process build output.
