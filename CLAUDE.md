# CLAUDE.md

## Common Commands

```bash
npm run dev            # Rebuild natives for Electron, build main/preload, start Vite + Electron
npm run build          # Production build (engine prebuild + main/preload/renderer)
npm run lint           # ESLint over apps/**
npm run typecheck      # TypeScript typecheck
npm run test:run       # Desktop (main-process) unit tests (vitest)
npm run test:renderer:run
npm run test:engine    # Engine workspace tests
npm run test:engine-ipc
npm run release:gate   # Full gate: typecheck + lint + all test suites + packaged-engine smoke
npm run package:win    # Windows NSIS installer under release/
npm run verify:win-package
```

Native module note: `better-sqlite3` and `node-pty` must match the runtime ABI. Use `npm run rebuild:native:node` before Node-based tests and `npm run rebuild:native:electron` before running/packaging the app. See `docs/native-modules.md`.

## Architecture

DevDesk is a local-first Electron app in an npm-workspaces monorepo:

- Main process: Node.js + TypeScript in `apps/desktop`. IPC, command execution, persistence, Docker, terminals (node-pty), git, engine spawn.
- Renderer: TypeScript + React + Vite + shadcn/ui in `apps/renderer`. UI only.
- Preload: `apps/desktop/preload.ts` exposes a small, explicit API as `window.electronAPI`.
- Engine: `packages/engine` (`devdesk-engine` workspace package) — local code intelligence (index, search, stats, Git insights). Packaged into app `resources/engine/` from `packages/engine/dist`.

Implementation notes:
- IPC channels use kebab-case (e.g. `projects:add`, `commands:run`). Canonical names: `packages/ipc-contracts`. Registration: `apps/desktop/ipc/registerIpc.ts`.
- Persistence is SQLite via `better-sqlite3` in userData as `devdesk.db` (WAL mode). Schema lives in `apps/desktop/data/model.ts`; store logic in `apps/desktop/data/store.ts`.
- Legacy JSON store (`devdesk-store.json`) is imported once when the DB is empty.
- Engine indexes live under `userData/engine/*.sqlite`.
- `reconcileRunHistory()` marks any "running" entries as "stopped" on startup.

## Current Feature Coverage (v0.1.2 — feature complete)

- Projects: add/edit/remove/pin, open folder/editor/terminal, type detection.
- Preferences: editor/terminal selection with custom command support (`{path}`).
- Command Vault: CRUD, tags + filtering, variables, presets by project type, pinning, chains, triggers.
- Run history: status + live output streaming + retrieval + clear, command/project names shown.
- Embedded terminals: tabs, resize, search, fullscreen (node-pty + xterm).
- Health: project + environment checks with history.
- Notes: per-project markdown notes with preview and task checkboxes.
- Containers: list/start/stop/logs via Docker CLI with Windows + WSL fallback; compose awareness.
- Git: status panel, changed files, quick commit, push, PR creation, palette commands.
- Engine: local index/search/stats/Git insights via packaged `devdesk-engine`.
- Bugs: context snapshots and attachments.
- Export/import (merge or replace, DB backup), tray quick actions, LLM context export.
- Global Command Palette (Cmd/Ctrl+K) with fuzzy search.

Remaining launch work (release-process, not code): interactive packaged-app QA on Windows + Linux (`docs/manual-qa.md`), optional Windows code signing, macOS deferred. See `TODO.md`, `ROADMAP.md`, and `docs/beta-release-checklist.md`. Docs index: `docs/README.md`.

## Key Constraints
- Local-first only. No cloud, no accounts, no AI services.
- Safe by default. Destructive actions require confirmation.
- Platform targets: Windows (unsigned NSIS) + Linux (x64 `.deb`). macOS deferred.

## Build Outputs
- Renderer output: `dist/renderer`
- Main/preload output: `dist/main`, `dist/preload` (tsc)
- Engine output: `packages/engine/dist` (copied to app `resources/engine/` at package time)
- Production loads `../../renderer/index.html` from main process build output.
- Installable artifacts land under `release/`.
