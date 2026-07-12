# DevDesk - Electron App Overview

A local-first Electron desktop app for developers that combines a Project Manager, Command Vault, and Docker/Compose Manager into one clean, fast workspace.

## Status (2026-07-12)

DevDesk is in late MVP / pre-release beta. The core product is implemented and
the main validation suite is green, but public launch is still gated by release
engineering, cross-platform packaging, and one Windows engine IPC contract test.

Implemented:
- Electron shell + Vite renderer, shadcn/ui + Radix components.
- SQLite persistence in userData (`devdesk.db`) with one-time migration from `devdesk-store.json`.
- Projects: add, edit, remove, detect type, pin, open folder/IDE/terminal.
- Preferences for editor/terminal (custom command support).
- Command Vault: create/edit/delete/run commands with tags, descriptions, variables, project binding, working directory, presets per project, and command/project pinning.
- Run history with live output streaming + full output viewer + clear history.
- Project notes (setup steps/todos/reminders).
- Docker containers: list/start/stop/logs with Windows + WSL fallback and compose-aware labeling.
- Git summaries per project, including lightweight working-tree status.
- Embedded terminals with tabs, fullscreen, resize, search, and web links.
- Project health inspection and persisted environment health checks.
- Bug Recorder with context snapshots, attachments, search, and resolution flow.
- Engine-backed project indexing, full-text search, stats, and Git insights.
- Export/import UI, tray quick actions, and LLM context bundling.
- Linux release packaging configuration (`AppImage` + `deb`) and packaged engine smoke tests.

Remaining launch work:
- Resolve the Windows engine IPC path-format contract test.
- Repair the stale `test:engine-ipc` native setup command.
- Make native-module rebuild and packaged smoke checks reliable on Windows.
- Validate and publish signed release artifacts for the supported platforms.
- Run manual end-to-end QA on clean environments and update release documentation.

## Quick Start

- `npm run dev` - build main/preload, start Vite, launch Electron.
- `npm run build` - build main/preload and renderer bundle.
- `npm run smoke:engine-packaged` - verify packaged engine resolution and a real index/search/stats flow.
- `npm run verify:linux-package` - build and smoke-test the Linux release package.
- `npm run typecheck` - validate TypeScript without emitting files.
- `npm run lint` - run ESLint across main and renderer code.
- `npm run test:run` / `npm run test:renderer:run` - run desktop and renderer tests.

See [LAUNCH-BLOCKERS-PLAN.md](LAUNCH-BLOCKERS-PLAN.md) for the current release plan.

## Purpose

DevDesk exists to remove daily developer friction:
- Jump into projects without remembering commands.
- Reuse complex terminal commands safely.
- Control Docker containers and compose stacks visually.
- Keep a simple history of what you ran and when.

If it saves even 5 minutes per day, it is doing its job.

## Core Principles

- Local-first: everything runs on your machine.
- Deterministic: buttons do predictable things.
- Opinionated: optimized for solo dev workflows.
- Safe by default: destructive actions require intent.
- Fast UI: keyboard-first, minimal clicks.

## Core Features (The Combo)

### 1) Project Manager
- Add local project folders and detect project type.
- Open in editor/terminal or reveal in file explorer.
- Pin important projects.
- Acts as the home screen of the app.

### 2) Command Vault
- Store frequently used terminal commands.
- Add descriptions, tags, and variables.
- Bind commands to a project or run globally.
- Support project-relative working directories.
- Create preset commands per project type.

### 3) Containers (Docker + Compose)
- List running and stopped containers.
- Start, stop, and view logs.
- Show compose metadata when available.
- Graceful fallback when Docker is missing; Windows + WSL support.

### 4) Run History
- Shows what commands were run.
- Displays status (running / success / failed / stopped).
- Shows command and project names.
- Allows stopping long-running commands.
- Provides access to output for sharing or debugging.

### 5) Project Notes
- Lightweight notes for setup steps, todos, and reminders tied to a project.

### 6) Git Snapshot
- Lightweight per-project git status summary.
- Surface branch and working-tree health in the UI.
- Load repository insights when available.

## How the App Works (High-Level)

- Main process (Node.js + TypeScript)
  - Runs commands.
  - Talks to Docker.
  - Reads the filesystem.
  - Persists data locally in SQLite.

- Renderer (TypeScript + React)
  - Displays UI.
  - Sends intent-based requests (run, stop, list, etc.).
  - Never accesses Node APIs directly.

- Preload layer
  - Exposes a small, safe API to the renderer.
  - Enforces security boundaries.

## Data Storage

Current: data lives in a local SQLite database in the Electron userData directory.
- File: `devdesk.db`
- Schema: `apps/desktop/data/model.ts`
- Migration: one-time import from `devdesk-store.json` if the DB does not exist
- Mode: WAL enabled, single-writer from the main process
- No backend required; app remains local-first

Engine indexing also uses SQLite under the userData `engine/` directory.

## MVP Scope (Target)

- Add and list projects.
- Create and run saved commands.
- See Docker containers and logs.
- View and stop running commands.
- View run history with output access.
- Edit simple project notes (setup steps, todos, reminders).

## Possible Future Enhancements (Optional)

See the backlog above for post-release items.

## Non-Goals

- AI features or assistants.
- Team collaboration.
- Cloud sync.
- Full terminal replacement.
- Heavy analytics.

## Definition of Done (V1)

- You can open DevDesk and immediately:
  - pick a project
  - run a command
  - manage a container
- No setup wizard required.
- App feels fast and predictable.
- You would actually keep it installed.

## Final Note

DevDesk is not about doing everything. It is about becoming the one place you open before the terminal.
