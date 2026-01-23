# TODO

## MVP Blockers
### Easy
- [x] Ensure Electron loads the Vite dev server during `npm run electron:dev` (avoid relying on unset `NODE_ENV`).
- [x] Project type detection from marker files (node/python/rust/go).

### Medium
- [ ] Define IPC channels for projects, commands, containers, history/output, and notes (`src/main/preload.ts`, `src/main/index.ts`).
- [ ] Add local persistence for projects, commands, run history, and notes (JSON or lightweight DB).
- [ ] Docker CLI integration (list/start/stop, logs) with graceful “not installed” state.

### Hard
- [ ] Implement safe command execution with explicit user intent, streaming output, and cancellation.

## MVP Polish
### Easy
- [ ] Strong empty states and error banners aligned with “safe by default.”
- [ ] Confirmations for destructive actions (stop container, kill command).

### Medium
- [ ] Run history view with status, output viewer, and quick copy/export.
- [ ] Project notes view for ports/URLs/reminders.

## Post-MVP
### Easy
- [ ] Lightweight Git status overview per project.

### Medium
- [ ] Project presets (open editor + run commands + open URLs).
- [ ] Import/export of local configuration.

### Hard
- [ ] Command templates with prompt variables (e.g., `{{container}}`, `{{port}}`).
