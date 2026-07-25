# Rules:
1. For UI changes, try to use tailwind, shadcn and radix wherever you can and should.

# Repository Guidelines

## Project Structure & Module Organization
- `apps/desktop/`: Electron main + preload + IPC + data store (SQLite) + Docker/terminal/git services.
- `apps/renderer/`: React renderer UI.
- `packages/engine/`: `devdesk-engine` workspace package (local code intelligence; packaged into app `resources/engine/`).
- `docs/`: Install, release, QA, data-model, and native-module documentation.
- `scripts/`: Build, native-rebuild, release-gate, packaging-verify, and QA automation scripts.
- `Readme.md`: Product overview and current status.
- `TODO.md` / `ROADMAP.md`: Roadmap and implementation checklist.
- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `COMMANDS.md`: Working notes and rules.
- `components.json`: shadcn/ui CLI config (renderer UI components + Tailwind wiring).
- `dist/`: build output (main/preload and renderer). `release/`: packaged artifacts.

## Build, Test, and Development Commands
- `npm run dev`: rebuilds natives for Electron, builds main/preload, starts Vite, then launches Electron.
- `npm run build`: builds engine (prebuild), main/preload, and Vite renderer bundle.
- `npm run lint`, `npm run lint:architecture`, `npm run typecheck`.
- Tests: `npm run test:run` (desktop), `npm run test:renderer:run`, `npm run test:engine`, `npm run test:engine-ipc` (vitest); `npm run test:rust` (cargo).
- Coverage: `npm run test:coverage` (V8; per-suite thresholds active and non-decreasing). Ledger: `docs/test-review-ledger.md`.
- `npm run release:gate`: full gate (typecheck + lint + rust + all test suites + packaged-engine smoke). Run before PRs.
- Node: `>=22.12.0 <25` (default 22 via `.nvmrc`); one `better-sqlite3` v12 across root and engine.
- Packaging: `npm run package:win` / `package:linux`; verification: `npm run verify:win-package` / `verify:linux-package`.
- Native ABI: `npm run rebuild:native:node` before Node tests, `npm run rebuild:native:electron` before running/packaging the app (see `docs/native-modules.md`).

## Coding Style & Naming Conventions
- TypeScript for main/renderer, 2-space indentation, PascalCase components, `useX` hooks, IPC channels in kebab-case.
- Keep preload APIs small and explicit in `apps/desktop/preload.ts`.
- UI should use shadcn/ui wrappers in `apps/renderer/app/components/ui` with Radix primitives and `cn` from `apps/renderer/lib/utils.ts`.

## Testing Guidelines
- Vitest is configured with separate configs: `vitest.desktop.config.ts`, `vitest.renderer.config.ts`, `vitest.engine.config.ts`; the engine workspace has its own test suite.
- Rebuild natives for Node ABI before running tests (`npm run rebuild:native:node`; `pretest:run` handles this for `test:run`).
- Add or update tests for behavior changes; `npm run release:gate` must pass before opening a PR.

## Commit & Pull Request Guidelines
- Use short, imperative commit summaries (e.g., "Add run history output viewer").
- PRs should include: clear description, screenshots for UI changes, and any manual test steps.
- Update docs when behavior or release expectations change.

## Architecture Overview
- Electron main process + preload bridge + renderer UI, plus a local performance engine (`devdesk-engine`) spawned from packaged `resources/engine/`.
- Persistence: local SQLite (`better-sqlite3`) in userData as `devdesk.db` with WAL. One-time import from legacy `devdesk-store.json` when the DB is empty.
- Engine indexes: `userData/engine/*.sqlite`.
- Core features: projects, command vault (variables/presets/chains/triggers), containers, embedded terminals, run history, health checks, git workspace, notes, bugs, export/import, tray, LLM context export.
- Local-first: avoid cloud services, analytics, or background daemons.
- Renderer build output is `dist/renderer`; main process loads `../../renderer/index.html` in production.

## Current Status (v0.1.0 private beta)
- Product features are complete; the release gate and CI are in place.
- Remaining launch work is release-process only: interactive packaged-app QA on Windows + Linux (`docs/manual-qa.md`), Linux host verification, optional Windows code signing, macOS deferred.

## Security & Configuration Tips
- Keep `nodeIntegration` disabled and `contextIsolation` enabled (already set).
- Treat shell execution as explicit user intent; avoid implicit command runs.
