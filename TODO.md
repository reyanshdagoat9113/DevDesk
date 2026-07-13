# DevDesk TODO

## Release baseline (v0.1.0)

- [x] Verify production build output loads in a packaged app.
- [x] Command search/filter, run history names, SQLite migration, WAL.
- [x] Command variables, presets, favorites, pinning.
- [x] Git status and Compose-aware Docker integration.
- [x] Notes, preferences, run history persistence.
- [x] Embedded terminals, project health checks, engine search.
- [x] Bug Recorder, export/import, tray actions, LLM context bundling.
- [x] Windows engine IPC path contract.
- [x] Native rebuild scripts (Node vs Electron) and engine IPC test command.
- [x] Windows + Linux release packaging targets and package verify.
- [x] Automated release gate + CI.
- [x] Install, data-location, release notes, and maintainer checklist docs.
- [x] Windows packaged QA record in `docs/manual-qa.md`.
- [x] Windows clean-profile backend workflow harness (`qa:clean-install:win`, 11/11 automated pass).

## Open (post-docs)

- [ ] Complete interactive packaged-app QA rows on Windows and Linux (task 15).
- [ ] Optional: Windows code signing; macOS packaging/notarization.
- [ ] Optional: auto-update channel decision.

## Maintenance backlog

- [ ] Broader E2E tests for critical packaged-app UI paths.
- [ ] Keep dependencies updated; run security audits.
- [ ] Profile indexing, search, and large-project performance.
- [ ] Improve error tracking and logging.
- [ ] Continue modularizing oversized main and renderer files.
