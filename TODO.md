# TODO

## MVP Blockers (Implementation Order)
### 1) Dev workflow
- [x] [Easy] Ensure Electron loads the Vite dev server during `npm run electron:dev` (avoid relying on unset `NODE_ENV`).

### 2) Core plumbing (IPC)
- [x] [Medium] Define IPC channels for projects, commands, containers, history/output, and notes (`src/main/preload.ts`, `src/main/index.ts`).

### 3) Persistence
- [ ] [Medium] Add local persistence for projects, commands, run history, and notes (JSON or lightweight DB).

### 4) Command execution (hard)
- [ ] [Hard] Implement safe command execution with explicit user intent, streaming output, and cancellation.

### 5) Docker integration
- [ ] [Medium] Docker CLI integration (list/start/stop, logs) with graceful “not installed” state.

### 6) Project type detection
- [x] [Easy] Project type detection from marker files (node/python/rust/go).

## MVP Polish (Implementation Order)
### 1) UI/UX safety
- [ ] [Easy] Strong empty states and error banners aligned with “safe by default.”
- [ ] [Easy] Confirmations for destructive actions (stop container, kill command).

### 2) History output
- [ ] [Medium] Run history view with status, output viewer, and quick copy/export.

### 3) Project notes
- [ ] [Medium] Project notes view for ports/URLs/reminders.

## Post-MVP (Implementation Order)
### 1) Lightweight Git status
- [ ] [Easy] Lightweight Git status overview per project.

### 2) Project presets
- [ ] [Medium] Project presets (open editor + run commands + open URLs).

### 3) Import/export
- [ ] [Medium] Import/export of local configuration.

### 4) Command templates (hard)
- [ ] [Hard] Command templates with prompt variables (e.g., `{{container}}`, `{{port}}`).
