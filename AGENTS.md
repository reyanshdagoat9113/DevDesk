


# Repository Guidelines

## Project Structure & Module Organization
- `docs/`: Product and UI library documentation.
- `Readme.md`: Product overview and scope.
- `TODO.md`: Roadmap and implementation checklist.
- `CLAUDE.md`, `AGENTS.md`, `COMMANDS.md`: Working notes and rules.
- `Screenshot *.png`: Reference visuals.
- `components.json`: shadcn/ui CLI config (renderer UI components + Tailwind wiring).

## Build, Test, and Development Commands
- `npm run dev`: builds main/preload, starts Vite, then launches Electron.
- `npm run build`: builds main/preload and Vite renderer bundle.
- `npm run lint`, `npm run typecheck` are available.

## Coding Style & Naming Conventions
- When implementation resumes: TypeScript for main/renderer, 2-space indentation, PascalCase components, `useX` hooks, IPC channels in kebab-case.
- Keep preload APIs small and explicit when reintroduced.
- UI should use shadcn/ui wrappers in `apps/renderer/app/components/ui` with Radix primitives and `cn` from `apps/renderer/lib/utils.ts`.

## Testing Guidelines
- No test framework is configured yet.
- If adding tests, document the framework and add a `npm run test` script.

## Commit & Pull Request Guidelines
- Git history is minimal (single commit), so no established commit message convention yet.
- Suggested format: short imperative summary (e.g., "Add run history output viewer").
- PRs should include: clear description, screenshots for UI changes, and any manual test steps.

## Architecture Overview
- Target architecture remains Electron main process + preload bridge + renderer UI.
- Core features remain: projects, command vault, containers, run history, and project notes.
- Local-first: avoid cloud services, analytics, or background daemons.
- Renderer build output is `dist/renderer`; main process loads `../../renderer/index.html` in production.

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

