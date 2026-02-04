# DevDesk TODO

## Now
- [ ] Verify production build output loads in a packaged app.
- [ ] Implement Docker container integration (list/start/stop/logs via Docker CLI).
- [ ] Add project removal UI + confirmation.
- [ ] Add command edit/delete and basic search/filter by tag.
- [ ] Show command + project names in run history (not just ids).

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
- [x] Notes editor (ports, URLs, reminders).
- [x] Project launch preferences (editor/terminal + custom command).
