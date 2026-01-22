# Repository Guidelines

## Project Structure & Module Organization
- `src/main/`: Electron main process (Node.js + TypeScript). Creates the window and handles IPC/system access.
- `src/main/preload.ts`: Preload bridge that exposes a small, whitelisted API to the renderer.
- `src/renderer/`: React UI (TypeScript). Entry is `src/renderer/main.tsx` and the main view is `src/renderer/App.tsx`.
- `src/renderer/index.css`: Global styles for the renderer.
- `dist/`: Build output for main and renderer bundles.
- Root config files: `vite.config.ts`, `tsconfig.json` (renderer), `tsconfig.main.json` (main).

## Build, Test, and Development Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start Vite dev server for the renderer.
- `npm run electron:dev`: Run Electron with the Vite dev server (hot reload).
- `npm run build`: Compile main process TypeScript and build the renderer bundle.
- `npm run preview`: Preview the built renderer (Vite).

## Coding Style & Naming Conventions
- Language: TypeScript for both main and renderer.
- Indentation: 2 spaces (match existing files).
- Naming: React components use PascalCase (`App`), hooks with `useX`, and IPC channels are kebab-case (`run-command`).
- Keep preload API small and explicit; add new channels to both `preload.ts` and main handlers.

## Testing Guidelines
- No test framework is configured yet.
- If adding tests, document the framework and add a `npm run test` script.

## Commit & Pull Request Guidelines
- Git history is minimal (single commit), so no established commit message convention yet.
- Suggested format: short imperative summary (e.g., "Add run history output viewer").
- PRs should include: clear description, screenshots for UI changes, and any manual test steps.

## Architecture Overview
- Three layers: main process (system access), preload bridge (IPC whitelist), and renderer (UI only).
- Core features include projects, command vault, containers, run history with output access, and project notes.
- Local-first: avoid cloud services, analytics, or background daemons.

## MVP Scope
- Add and list projects.
- Create and run saved commands.
- See Docker containers and logs.
- View and stop running commands.
- View run history with output access.
- Edit simple project notes (ports, URLs, reminders).

## Security & Configuration Tips
- Keep `nodeIntegration` disabled and `contextIsolation` enabled (already set).
- Treat shell execution as explicit user intent; avoid implicit command runs.
