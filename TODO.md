# DevDesk TODO

## Now
- [x] Verify production build output loads in a packaged app.
- [x] Add command search/filter by tag.
- [x] Show command + project names in run history (not just ids).
- [ ] Replace JSON store with SQLite using `better-sqlite3` (main process only).
- [ ] One-time migration from `devdesk-store.json` to `devdesk.db`.
- [ ] Add WAL mode + basic indexes for common queries.

## Next
- [ ] Variables in commands (e.g. {{container}}).
- [ ] Command presets per project.
- [ ] Favorites/pinning for projects and commands.
- [ ] Export/import config.

## Later
- [ ] Tray quick actions.
- [ ] Compose stack awareness per project.
- [ ] Lightweight git status per project.

## Done
- [x] Base Electron + Vite setup.
- [x] shadcn/ui + Radix UI component wrappers.
- [x] Tailwind theme tokens and utilities.
- [x] Data model for projects, commands, containers, run history, notes, preferences.
- [x] JSON persistence in userData (`devdesk-store.json`).
- [x] IPC handlers for projects/commands/history/notes/preferences.
- [x] Renderer wired to preload API (no mock data).
- [x] Command execution with run history + output streaming.
- [x] Notes editor (setup steps, todos, reminders).
- [x] Project launch preferences (editor/terminal + custom command).
- [x] Docker container integration (list/start/stop/logs via CLI, Windows + WSL).
- [x] Project removal UI + confirmation.
- [x] Command edit/delete.
