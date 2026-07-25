# DevDesk

[![Release gate](https://github.com/reyanshdagoat9113/DevDesk/actions/workflows/release-gate.yml/badge.svg?branch=main)](https://github.com/reyanshdagoat9113/DevDesk/actions/workflows/release-gate.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](docs/RELEASE-NOTES-0.1.0.md)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-lightgrey)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A local-first Electron desktop app for developers that combines a Project Manager, Command Vault, Docker controls, terminals, and local code search into one workspace.

## Status (2026-07-24)

**Private beta / release candidate in hardening** — product features for v0.1.0 are implemented; launch work is packaging, QA, and docs.

| Area | State |
|------|--------|
| Core product features | Implemented |
| Automated release gate + CI | Implemented (`npm run release:gate`) |
| Windows x64 installer | Implemented (unsigned) |
| Linux x64 AppImage/deb | Targets configured |
| macOS | Deferred |
| Manual QA | See [docs/manual-qa.md](docs/manual-qa.md) (Windows session + Linux template; interactive rows pending) |

Remaining launch work:
- Complete the remaining Windows interactive Pass* checks in [docs/manual-qa.md](docs/manual-qa.md).
- Complete Linux interactive QA rows in [docs/manual-qa.md](docs/manual-qa.md).
- Optional later: code signing (Windows), macOS packaging/notarization.

Native rebuild notes: [docs/native-modules.md](docs/native-modules.md).
Packaging notes: [docs/release.md](docs/release.md).
Manual QA: [docs/manual-qa.md](docs/manual-qa.md).

### Release notes

- [docs/RELEASE-NOTES-0.1.0.md](docs/RELEASE-NOTES-0.1.0.md)

### Docs map

| Doc | Topic |
|-----|--------|
| [docs/install.md](docs/install.md) | Install, platforms, uninstall |
| [docs/release.md](docs/release.md) | Packaging, gate, signing limits |
| [docs/native-modules.md](docs/native-modules.md) | Native rebuild prerequisites |
| [docs/data-locations.md](docs/data-locations.md) | userData paths, backup, export |
| [docs/manual-qa.md](docs/manual-qa.md) | Clean-install QA checklist |
| [docs/beta-release-checklist.md](docs/beta-release-checklist.md) | Maintainer release checklist |
| [docs/data-model.md](docs/data-model.md) | Data model overview |
| [docs/test-review-ledger.md](docs/test-review-ledger.md) | Test disposition / surface coverage ledger |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributor setup |

## Quick start (developers)

The performance engine lives in this monorepo at `packages/engine` (`devdesk-engine`). The old `devdesk-addons` repository is archived; do not use a sibling checkout.

Requires Node.js **22.12–24** (default **22**; see `.nvmrc`).

```bash
npm install
npm run rebuild:native:electron
npm run dev
```

Common commands:

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev app with Vite + Electron |
| `npm run build` | Production main/preload/renderer (+ engine prebuild) |
| `npm run release:gate` | Lint, typecheck, rust, unit/renderer/engine/engine-ipc, engine smoke |
| `npm run test:coverage` | V8 coverage reports (per-suite thresholds enforced) |
| `npm run package:win` / `package:linux` | Installable artifacts under `release/` |
| `npm run verify:win-package` / `verify:linux-package` | Packaged engine + native checks |

Windows native builds need Visual Studio C++ Build Tools, Python 3, and Git. See [docs/native-modules.md](docs/native-modules.md).

## Install (end users)

See [docs/install.md](docs/install.md). Short version:

- **Windows:** run `DevDesk-<version>-win-x64.exe` (SmartScreen may warn — unsigned beta).
- **Linux:** AppImage or deb from a Linux build host.
- **macOS:** not shipped in this beta.

## Features

- **Projects** — add, pin, open folder/IDE/terminal, type detection
- **Command Vault** — tags, variables, presets, pinning, live run history
- **Containers** — Docker list/start/stop/logs; graceful missing-Docker UX; WSL-aware
- **Terminals** — embedded tabs, resize, search, fullscreen
- **Health** — project + environment checks with history
- **Engine** — local index, search, stats, Git insights
- **Bugs** — context snapshots and attachments
- **Export/import** — merge or replace with DB backup
- **Tray** — optional tray quick actions
- **LLM context** — local context export helpers

## Data storage

- Primary: SQLite `devdesk.db` in Electron userData (WAL).
- Legacy: one-time import from `devdesk-store.json` when the DB is empty.
- Engine indexes: `userData/engine/*.sqlite`.
- Details: [docs/data-locations.md](docs/data-locations.md).

## Architecture (high level)

- **Main** — Node + TypeScript: IPC, store, Docker, terminals, engine spawn
- **Preload** — small explicit bridge (`contextIsolation`, no `nodeIntegration`)
- **Renderer** — React + Vite + shadcn/ui + Radix

## Non-goals

- Cloud sync, team collaboration, heavy analytics, full IDE replacement.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Prefer `npm run release:gate` before opening a PR.

## License

MIT — see [LICENSE](LICENSE).
