# DevDesk Launch Blockers Plan

**Created:** 2026-07-12  
**Status:** Active  
**Scope:** Stabilize, package, and validate the existing DevDesk product for a
private beta or public release.

## Outcome

DevDesk should be releasable from a clean checkout on every supported platform,
with green automated validation, working native dependencies, tested packaged
artifacts, and documentation that matches the product.

This plan is intentionally release-focused. The major product features are
already implemented; new feature work should not delay this gate unless it
directly improves launch reliability.

## Blockers and Work Items

### 1. Fix the Windows engine IPC contract

**Status:** Done (2026-07-12)

**Observed issue:** The Electron-to-engine integration test fails on Windows
because the engine returns a normalized repository path using forward slashes,
while the test compares it with the native Windows path using backslashes.

**Path contract (chosen):**

- Absolute engine API paths (`repo`, `db`): canonical **forward-slash** form
  via engine `normalizePath` / desktop `toCanonicalEnginePath`.
- Search hit paths in IPC/UI: **project-relative** with `/`.
- Filesystem I/O: native separators (`toNativePath` / Node `path`).

Documented in `devdesk-engine/ARCHITECTURE.md` and `apps/desktop/engine/types.ts`.

**Tasks:**

- [x] Decide and document the path contract for engine API results.
- [x] Keep repository and database paths consistent across engine, IPC, and UI.
- [x] Update implementation and/or test expectations to use the chosen contract.
- [x] Add a Windows-specific regression assertion for repository and database paths.

**Acceptance:**

- `vitest.engine.config.ts` passes on Windows.
- Search results continue to use stable project-relative paths.
- The packaged engine smoke test remains green.

### 2. Repair the native test and smoke-test workflow

**Observed issue:** `npm run test:engine-ipc` calls the missing addon script
`ensure:native`. The packaged smoke command also invokes `electron-rebuild`,
which currently fails while rebuilding `node-pty` on Windows.

**Tasks:**

- Replace `ensure:native` with an existing, deterministic native setup command
  or add a correctly scoped script to the engine package.
- Separate Node-native dependency rebuilds from Electron-native rebuilds where
  their ABIs differ.
- Make the workflow rebuild both the app-level and linked engine-level
  `better-sqlite3` dependencies when required.
- Investigate the `node-pty` `GetCommitHash.bat` failure and pin or upgrade the
  dependency/toolchain if necessary.
- Document prerequisites for Windows native builds and CI runners.

**Acceptance:**

- A clean checkout can run the documented engine IPC and packaged smoke
  commands without manual node_modules repair.
- Native modules load under the intended Electron and Node runtimes.
- The workflow fails with an actionable error when a required compiler/tool is
  unavailable.

### 3. Establish supported release targets and artifacts

**Current state:** The build configuration defines Linux `AppImage` and `deb`
targets. The project has not yet demonstrated a signed, installable release
artifact for its intended Windows audience.

**Tasks:**

- Decide the first release platforms: Windows, Linux, and optionally macOS.
- Add explicit Electron Builder targets and artifact naming for each supported
  platform.
- Verify native modules and the bundled engine are included in each artifact.
- Configure application icons, metadata, versioning, and update/release notes.
- Add code-signing/notarization steps where applicable, or document the beta
  limitation if signing is deferred.
- Produce a versioned release artifact from a clean checkout.

**Acceptance:**

- Each claimed platform has an installable artifact.
- The artifact launches without dev tools and loads the renderer correctly.
- SQLite persistence, terminal creation, engine indexing, and Docker fallback
  behavior are checked in the packaged app.
- Artifact names and version numbers are suitable for distribution.

### 4. Add release-level automated validation

**Tasks:**

- Keep the existing typecheck, lint, desktop tests, renderer tests, engine
  tests, and engine smoke test in the release gate.
- Make the Electron IPC integration test green and include it in the gate.
- Add at least one packaged-app smoke path per supported platform.
- Add migration coverage for an older `devdesk-store.json` and older SQLite
  schema.
- Add regression coverage for native module loading and terminal startup.
- Add a CI workflow that runs the release gate on supported OS runners.

**Baseline commands:**

```text
npm run typecheck
npm run lint
npm run lint:architecture
npm run test:run
npm run test:renderer:run
npm run test:engine-ipc
npm run smoke:engine-packaged
```

**Acceptance:**

- All release-gate commands pass from a clean checkout.
- CI reports failures with enough context to diagnose platform-specific issues.
- No command depends on a previously repaired local `node_modules` directory.

### 5. Complete manual clean-install QA

Test the release artifact, not only the development app.

**Core workflow:**

- Launch the app for the first time.
- Add, edit, pin, and remove a project.
- Create and run a command, including variables and a failing command.
- Open a terminal, resize it, use tabs, search, and close it.
- Run a health check and inspect persisted history.
- Index a project, search it, open a result, and inspect Git insights.
- Create a bug with context and an attachment.
- Export data, import it using merge and replace modes, and verify recovery.
- Toggle tray behavior and exercise tray quick actions.
- Test Docker-present, Docker-missing, and WSL fallback states where relevant.
- Restart the app and confirm persistence and migration behavior.

**Acceptance:**

- The checklist is recorded for every supported platform.
- Failures are fixed or listed as explicit known limitations before release.
- No data-loss, unsafe IPC, or unrecoverable startup issue remains.

### 6. Synchronize release documentation

**Tasks:**

- Keep `Readme.md`, `TODO.md`, `ROADMAP.md`, and this plan consistent.
- Add installation and platform-support instructions.
- Add release notes describing the current feature set and limitations.
- Document native build prerequisites and troubleshooting.
- Document backup/export behavior and local data locations.
- Create a short beta/public-release checklist for future maintainers.

**Acceptance:**

- A new contributor can build, test, package, and troubleshoot the project
  without relying on historical plan files.
- No completed feature is still listed as an active backlog item.

## Suggested Execution Order

1. Fix the engine path contract and make the direct IPC test green.
2. Repair the native setup scripts and `node-pty` rebuild path.
3. Add the release gate and CI coverage.
4. Define supported platforms and produce clean artifacts.
5. Run manual packaged-app QA.
6. Publish synchronized documentation and release notes.

## Release Decision Gate

Do not call the project publicly launch-ready until all of the following are
true:

- The Windows engine IPC integration test passes.
- Native setup works from a clean checkout.
- Supported-platform artifacts build and launch.
- Packaged smoke tests and the documented release gate pass.
- Manual clean-install QA is complete.
- Installation, support, and known limitations are documented.

Until then, the appropriate label is **private beta / release candidate in
hardening**.
