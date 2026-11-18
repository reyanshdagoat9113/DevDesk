# DevDesk TODO

Live work only. Completed 0.1.x product and launch-engineering items are in [ROADMAP.md](ROADMAP.md) and [docs/RELEASE-NOTES-0.1.6.md](docs/RELEASE-NOTES-0.1.6.md).

## Open (launch)

- [ ] Complete interactive packaged-app QA rows on Windows and Linux ([docs/manual-qa.md](docs/manual-qa.md))
- [ ] Independent external security review of IPC and shell execution paths (public launch bar; internal hardening shipped in v0.1.6 — [docs/beta-release-checklist.md](docs/beta-release-checklist.md))
- [ ] Decide / improve bug attachment backup and export story (currently metadata-only — [docs/data-locations.md](docs/data-locations.md))
- [ ] Optional: Windows code signing
- [ ] Optional: auto-update channel decision (or keep manual downloads)
- [ ] Optional later: macOS packaging / notarization (not claimed for 0.1)

## Maintenance & follow-ups

- [ ] Make [apps/desktop/ipc/ipc-contracts.test.ts](apps/desktop/ipc/ipc-contracts.test.ts) bidirectional so stale or unused entries in `@devdesk/ipc-contracts` fail CI
- [ ] Stream NDJSON from `scanRepository` in `packages/engine` instead of buffering stdout (currently bounded at 32 MB)
- [ ] Retire or update `scripts/gen-ipc-channels.mjs` (currently scans `ipcMain.handle` in `registerIpc.ts` only, out of sync with `handleTrusted` and `apps/desktop/ipc/handlers/`)
- [ ] Support GitHub Enterprise remotes in `parseGitRemote` (PR creation is currently disabled for GHE remotes)
- [ ] Audit `packages/landing`, CI workflows, and `scripts/` in the next maintenance sweep (skipped in the v0.1.2 sweep)
- [ ] Broader E2E coverage for critical packaged UI paths
- [ ] Dependency updates and security audits
- [ ] Profile indexing / search on large projects
- [ ] Improve error tracking and logging
- [ ] Keep splitting oversized main and renderer modules
