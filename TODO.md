# DevDesk TODO

## Release Baseline

- [x] Verify production build output loads in a packaged app.
- [x] Add command search/filter by tag.
- [x] Show command + project names in run history (not just ids).
- [x] Replace JSON store with SQLite using `better-sqlite3` (main process only).
- [x] One-time migration from `devdesk-store.json` to `devdesk.db`.
- [x] Add WAL mode + basic indexes for common queries.
- [x] Variables in commands (e.g. `{{container}}`).
- [x] Command presets per project.
- [x] Favorites/pinning for projects and commands.
- [x] Lightweight git status per project.
- [x] Compose stack awareness per project.
- [x] Docker container integration (list/start/stop/logs via CLI, Windows + WSL).
- [x] Notes, preferences, and run history persistence.

## Backlog / Post-Release

- [ ] Export/import config UI and file format.
- [ ] Tray quick actions.
- [ ] Context bundling for LLM workflows.

## Done

- [x] Base Electron + Vite setup.
- [x] shadcn/ui + Radix UI component wrappers.
- [x] Tailwind theme tokens and utilities.
- [x] Data model for projects, commands, containers, run history, notes, preferences.
- [x] JSON persistence in userData (`devdesk-store.json`).
- [x] SQLite persistence in userData (`devdesk.db`).
- [x] IPC handlers for projects/commands/history/notes/preferences.
- [x] Renderer wired to preload API (no mock data).
- [x] Command execution with run history + output streaming.
- [x] Notes editor (setup steps, todos, reminders).
- [x] Project launch preferences (editor/terminal + custom command).
- [x] Docker container integration (list/start/stop/logs via CLI, Windows + WSL).
- [x] Project removal UI + confirmation.
- [x] Command edit/delete.
- [x] Command presets picker and creation flow.
- [x] Project/command pinning.
- [x] Packaged engine resolution and smoke checks.
- [x] IPC integration smoke test for Electron ↔ engine.
