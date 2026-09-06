# DevDesk Test Report

Date: 2026-09-06 ~16:28 IST (Asia/Calcutta)
Machine: reyanshCoder
Path: C:/Users/dagoa/Code/DevDesk
Branch: dev
Runtime: Node v24.12.0; Cargo 1.94.0

## Note on commands used

Bare package-manager script wrappers were blocked by Auto-review on this host
(executable content could not be bound to this review). Suites were run via
full-path Node invoking local Vitest / tsc, plus cargo for Rust:

- pretest native rebuild: scripts/ensure-native-modules.mjs
- desktop: vitest --config ./vitest.desktop.config.ts run
- renderer: vitest --config ./vitest.renderer.config.ts run
- engine: vitest run in packages/engine
- engine-ipc: tsc -p packages/engine/tsconfig.json then vitest --config ./vitest.engine.config.ts run
- rust: cargo test --locked --manifest-path packages/engine/rust/Cargo.toml
- coverage:* : same configs with --coverage (desktop, renderer, engine separately)

## Results summary

| Suite | Result | Files | Tests | Duration | Notes |
|---|---|---|---|---|---|
| Desktop (test:run) | PASS | 38/38 | 350/350 | ~17.0s | stderr from expected export fail-closed cases |
| Renderer (test:renderer:run) | PASS | 25/25 | 93/93 | ~37.0s | Vite CJS deprecation warning only |
| Engine (test:engine) | PASS | 7/7 | 34/34 | ~5.7s | git LF/CRLF warning on temp file |
| Engine IPC (test:engine-ipc) | PASS | 1/1 | 1/1 | ~1.6s | after engine tsc build |
| Rust (test:rust) | PASS | n/a | 18/18 | ~0.05s (+2.4s compile) | cargo available |

Grand total: 496 JS/TS tests passed + 18 Rust tests; 0 failed; 0 skipped.

### Failure details

None. All suites exited 0.

Expected stderr (not failures) during desktop export/import tests:
- [export] Failed to insert row 0 into projects: NOT NULL constraint failed: projects.path
- [export] Failed to insert row 0 into bug_reports: FOREIGN KEY constraint failed

These assert fail-closed / FK rejection behavior.

## Coverage summary (fresh runs, 2026-09-06)

Prior reports in coverage/ were from 2026-07-25; refreshed today.

| Area | Lines | Statements | Functions | Branches |
|---|---|---|---|---|
| Desktop | 44.98% (6187/13753) | 44.98% | 78.36% | 75.37% |
| Renderer | 45.19% (7990/17679) | 45.19% | 29.76% | 63.61% |
| Engine | 76.51% (2069/2704) | 76.51% | 73.78% | 68.62% |

### Critical / low-coverage areas

Desktop (IPC / storage / vault / related):
- apps/desktop/ipc/registerIpc.ts — 0% (~3k lines) largest gap
- apps/desktop/ipc/handlers/* — 0% (git, history, notes, preferences, shell, llm, index)
- apps/desktop/data/store/commands.ts — 0% command vault CRUD/pin untested
- apps/desktop/data/store/automation.ts — 0%
- apps/desktop/data/store/notes.ts — 0%
- apps/desktop/data/store/settings.ts — 0%
- apps/desktop/data/store/projects.ts — ~40% (delete/cascade only)
- apps/desktop/data/store/history.ts — ~51%
- apps/desktop/data/store/export.ts — ~83% (import atomicity covered)
- apps/desktop/files/fileService.ts — ~49%
- apps/desktop/git/service.ts — ~74%
- apps/desktop/llm/bundler.ts — 0%
- apps/desktop/tray/trayManager.ts — 0%
- preload/index/createWindow — 0% (bootstrap; lower unit-test priority)

Renderer:
- ContainersSection.tsx — ~7% (Docker UI)
- CommandChainsPanel / CommandTriggersPanel — ~10-13%
- GitWorkspacePanel / GitDiffViewer — ~6-7%
- ExportImportDialog.tsx — ~43%
- BugRecorderPanel / BugReportDetail — ~6-11%
- VariablePromptModal — ~13%
- EngineSection / ProjectHealthPanel — ~5-10%

Engine:
- src/workers/client.ts — ~25%
- src/runner.ts — 0% (utilityProcess shim)
- src/capabilities/git-insights.ts — ~43%

## Recommended new tests (not added)

1. apps/desktop/data/store/commands.test.ts (HIGH, small) — CRUD + toggleCommandPin + missing-id paths, mirroring projects.test.ts in-memory SQLite pattern. Clears command-vault store gap.
2. notes.test.ts / settings.test.ts (MEDIUM, small) — same store mock pattern for remaining 0% store modules.
3. IPC handler smoke tests under apps/desktop/ipc/handlers/*.test.ts (HIGH, medium) — mock deps; assert channel wiring + happy/error paths without full Electron.
4. Docker IPC + ContainersSection (HIGH) — beyond dockerLogStreams: start/stop/list + renderer empty/error states.
5. ExportImportDialog renderer test (MEDIUM) — merge vs replace + error toast (store import already covered).
6. GitWorkspacePanel / GitDiffViewer (MEDIUM) — status/diff empty, conflict, success fixtures.
7. Automation store + CommandChains/Triggers panels (MEDIUM) — step ordering, stop-on-failure.
8. Engine workers/client.ts (MEDIUM) — message/timeout/error with mocked worker.

## Tests added

None. A focused commands.test.ts was clearly warranted, but writing/copying the file onto the Windows machine was blocked by Auto-review. Recommend adding it locally using the projects.test.ts pattern.

## Success criteria

- [x] Ran all five suites (desktop, renderer, engine, engine-ipc, rust)
- [x] Pass/fail counts reported — all pass
- [x] Failure details — N/A
- [x] Coverage run individually + gaps summarized
- [x] Recommended tests only; no app code modified; no commit/push/clone
