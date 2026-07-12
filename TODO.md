# DevDesk TODO

## Release Baseline

- [x] Verify production build output loads in a packaged app.
- [x] Add command search/filter by tag.
- [x] Show command and project names in run history.
- [x] Replace JSON persistence with SQLite and migrate existing installs.
- [x] Add WAL mode and indexes for common queries.
- [x] Add command variables, presets, favorites, and pinning.
- [x] Add Git status and Compose-aware Docker integration.
- [x] Add notes, preferences, and run history persistence.
- [x] Add embedded terminals, project health checks, and engine search.
- [x] Add Bug Recorder, export/import, tray actions, and LLM context bundling.

## Launch Blockers

- [x] Fix the Windows engine IPC path-format contract test.
- [x] Replace the stale `test:engine-ipc` `ensure:native` step with a valid native setup command.
- [x] Make `node-pty` and `better-sqlite3` rebuilds reliable on Windows and CI.
- [x] Define supported release platforms and produce/test their artifacts.
- [ ] Add release smoke tests and manual QA evidence for clean installations.
- [ ] Update release notes, installation instructions, and known limitations.

## Maintenance Backlog

- [ ] Add end-to-end tests for critical packaged-app paths.
- [ ] Keep dependencies updated and run security audits.
- [ ] Profile indexing, search, and large-project performance.
- [ ] Improve error tracking and logging.
- [ ] Continue modularizing oversized main and renderer files.
