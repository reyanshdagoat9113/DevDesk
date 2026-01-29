# DevDesk TODO

## Now
- [ ] Define data model for projects, commands, containers, run history, notes.
- [ ] Wire renderer to preload API (replace mock data).
- [ ] Implement IPC handlers for CRUD + run/stop commands.
- [ ] Add persistence layer (local JSON or sqlite).
- [ ] Verify renderer build output loads in production.

## Next
- [ ] Projects: add/remove, type detection, open in editor/terminal.
- [ ] Command Vault: create/run/stop, tags, search.
- [ ] Containers: list/start/stop/logs with graceful Docker-missing state.
- [ ] Run History: store output, status, view output.
- [ ] Notes: edit/save ports, URLs, reminders per project.

## Later
- [ ] Variables in commands (e.g. {{container}}).
- [ ] Favorites/pinning for projects and commands.
- [ ] Export/import config.
- [ ] Tray quick actions.

## Done
- [x] Base Electron + Vite setup.
- [x] shadcn/ui + Radix UI component wrappers.
- [x] Tailwind theme tokens and utilities.
