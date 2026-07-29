# DevDesk v0.1.1 — Windows engine reliability fix

**Date:** 2026-07-29
**Label:** Private beta / release candidate in hardening

## Fixed

- The packaged Windows engine now resolves its bundled, Electron-compatible dependencies before app-level or inherited module paths. This prevents an incompatible native SQLite module from being selected when the engine starts.
- Windows package verification now explicitly exercises the engine's native SQLite binding and the same Electron child-process (`fork`) route used by the desktop app.

## Validation

- `npm run typecheck`
- Windows NSIS package build
- Packaged engine version, index, search, stats, native SQLite, and fork-launch verification

## Platforms

| Platform | Artifact | Notes |
|----------|----------|-------|
| Windows x64 | `DevDesk-0.1.1-win-x64.exe` (NSIS) | Primary; unsigned private-beta build |
| Linux x64 | Not republished in this release | Existing targets remain configured |
| macOS | Not shipped | Deferred |

## Known limitations

- Windows installers are not code-signed.
- Auto-update and macOS packaging are not enabled.
- Linux interactive QA remains a separate release requirement.
