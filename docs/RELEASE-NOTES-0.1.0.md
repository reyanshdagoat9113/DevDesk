# DevDesk v0.1.0 — private beta release notes

**Date:** 2026-07-12  
**Label:** Private beta / release candidate in hardening  

## Highlights

DevDesk is a local-first desktop workspace for developers:

- **Projects** — add, pin, open in editor/folder/terminal, type detection  
- **Command Vault** — saved commands with tags, variables, presets, pinning, run history  
- **Containers** — Docker list/start/stop/logs with Windows + WSL fallback  
- **Terminals** — embedded tabs, resize, search, fullscreen  
- **Health** — project and environment health checks with history  
- **Engine** — local index, full-text search, stats, Git insights  
- **Bugs** — recorder with context snapshots and attachments  
- **Export/import** — merge or replace with pre-import DB backup  
- **Tray** — optional tray and quick actions  
- **LLM context** — local context bundling for export  

## Platforms

| Platform | Artifact | Notes |
|----------|----------|--------|
| Windows x64 | `DevDesk-0.1.0-win-x64.exe` (NSIS) | Primary; **unsigned** (SmartScreen may warn) |
| Linux x64 | AppImage + deb | Package targets ready |
| macOS | — | Not shipped |

## Validation

- Automated: `npm run release:gate` (typecheck, lint, architecture, unit/renderer/engine-ipc tests, packaged engine smoke)
- Packaged smokes: `verify:win-package` / `verify:linux-package`
- Manual checklist: [manual-qa.md](./manual-qa.md)

## Known limitations

1. Windows installers are **not code-signed**.  
2. **macOS** builds and notarization are deferred.  
3. **Auto-update** is not enabled.  
4. Bug **attachment binaries** are not included in v1 export payloads (metadata only).  
5. Linux **interactive** QA may lag Windows; complete [manual-qa.md](./manual-qa.md) Linux rows before claiming full multi-platform GA.  
6. Docker features require Docker (or compatible setup) on the host.  
7. Native rebuilds require a C/C++ toolchain ([native-modules.md](./native-modules.md)).

## Install / data

- Install: [install.md](./install.md)  
- Packaging: [release.md](./release.md)  
- Data locations and backup: [data-locations.md](./data-locations.md)  

## Upgrade notes

- Fresh install creates `devdesk.db` under userData.  
- Existing `devdesk-store.json` is imported once when the SQLite DB has no preferences.  
- Older SQLite schemas receive additive column migrations on startup (`variables`, pins, `resolved_command`, …).
