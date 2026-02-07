# Rules:
1. For UI changes, try to use tailwind, shadcn and radix wherever you can and should.

# Repository Guidelines

## Project Structure & Module Organization
- `apps/desktop/`: Electron main + preload + IPC + data store.
- `apps/renderer/`: React renderer UI.
- `docs/`: Product and UI library documentation.
- `Readme.md`: Product overview and current status.
- `TODO.md`: Roadmap and implementation checklist.
- `CLAUDE.md`, `AGENTS.md`, `COMMANDS.md`: Working notes and rules.
- `Screenshot *.png`: Reference visuals.
- `components.json`: shadcn/ui CLI config (renderer UI components + Tailwind wiring).
- `dist/`: build output (main/preload and renderer).

## Build, Test, and Development Commands
- `npm run dev`: builds main/preload, starts Vite, then launches Electron.
- `npm run build`: builds main/preload and Vite renderer bundle.
- `npm run lint`, `npm run typecheck` are available.

## Coding Style & Naming Conventions
- TypeScript for main/renderer, 2-space indentation, PascalCase components, `useX` hooks, IPC channels in kebab-case.
- Keep preload APIs small and explicit in `apps/desktop/preload.ts`.
- UI should use shadcn/ui wrappers in `apps/renderer/app/components/ui` with Radix primitives and `cn` from `apps/renderer/lib/utils.ts`.

## Testing Guidelines
- No test framework is configured yet.
- If adding tests, document the framework and add a `npm run test` script.

## Commit & Pull Request Guidelines
- Use short, imperative commit summaries (e.g., "Add run history output viewer").
- PRs should include: clear description, screenshots for UI changes, and any manual test steps.

## Architecture Overview
- Electron main process + preload bridge + renderer UI is implemented.
- Current persistence: local JSON in userData as `devdesk-store.json`.
- Planned persistence: local SQLite using `better-sqlite3` in userData as `devdesk.db` with WAL.
- Core features: projects, command vault, containers, run history, and project notes.
- Local-first: avoid cloud services, analytics, or background daemons.
- Renderer build output is `dist/renderer`; main process loads `../../renderer/index.html` in production.

## Current MVP Status
- Implemented: projects add/edit/remove, command create/edit/delete/run, run history with output + clear, notes editing, app preferences, Docker containers with Windows + WSL fallback.
- Pending: command search/filter, run history shows command + project names, production build verification.

## Security & Configuration Tips
- Keep `nodeIntegration` disabled and `contextIsolation` enabled (already set).
- Treat shell execution as explicit user intent; avoid implicit command runs.
