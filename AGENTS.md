# Rules 
1. If todo.md is mentioned in a prompt and if it is said so to finish dash task mentioned in todo.md, once completed kindly put the task as completed in todo.md.
2. Keep the current organized folder and file structure.
3. While committing changes, if a task in TODO.md has been completed, mention it. For example, "completed X task from TODO.md." Then add the task's description and then mention other things in the commit.


# Repository Guidelines

## Project Structure & Module Organization
- `docs/`: Product and UI library documentation.
- `Readme.md`: Product overview and scope.
- `TODO.md`: Roadmap and implementation checklist.
- `CLAUDE.md`, `AGENTS.md`, `COMMANDS.md`: Working notes and rules.
- `Screenshot *.png`: Reference visuals.

## Build, Test, and Development Commands
- No runtime/build commands are defined right now. Execution code has been removed for a fresh restart. Add scripts when implementation resumes.

## Coding Style & Naming Conventions
- When implementation resumes: TypeScript for main/renderer, 2-space indentation, PascalCase components, `useX` hooks, IPC channels in kebab-case.
- Keep preload APIs small and explicit when reintroduced.

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

