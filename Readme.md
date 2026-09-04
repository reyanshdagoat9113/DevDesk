# DevDesk

[![Release gate](https://github.com/reyanshdagoat9113/DevDesk/actions/workflows/release-gate.yml/badge.svg?branch=main)](https://github.com/reyanshdagoat9113/DevDesk/actions/workflows/release-gate.yml)
[![Version](https://img.shields.io/badge/version-0.1.4-blue)](docs/RELEASE-NOTES-0.1.4.md)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-lightgrey)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Local-first desktop workspace for developers: projects, a command vault, terminals, Docker, Git, and on-disk code search — without accounts or cloud sync.

## Status

**v0.1.4 private beta** (2026-09-04). Product features for this line are implemented. Remaining launch work is interactive packaged-app QA, optional Windows Authenticode signing, and macOS (deferred).

| Area | State |
|------|--------|
| Core product | Implemented — see [docs/user-guide.md](docs/user-guide.md) |
| Automated release gate + CI | `npm run release:gate` and `.github/workflows/release-gate.yml` |
| Windows x64 NSIS installer | Shipped, **unsigned** (SmartScreen may warn) |
| Linux x64 `.deb` | Shipped |
| macOS | Not shipped |
| Manual QA | Automated Windows clean-install harness green; interactive Windows + Linux rows still open in [docs/manual-qa.md](docs/manual-qa.md) |

Release notes: [docs/RELEASE-NOTES-0.1.4.md](docs/RELEASE-NOTES-0.1.4.md) · [0.1.3](docs/RELEASE-NOTES-0.1.3.md) · [0.1.2](docs/RELEASE-NOTES-0.1.2.md) · [0.1.1](docs/RELEASE-NOTES-0.1.1.md) · [0.1.0](docs/RELEASE-NOTES-0.1.0.md)

## Features

- **Projects** — add, pin, type detection (Node / Python / Rust / Go), WSL paths, open folder / editor / terminal
- **Command Vault** — tags, presets, variables (`{{project.path}}`, `{{input}}`, …), pinning, live run history
- **Automation** — command chains and event triggers (startup, project open, container start)
- **Terminals** — embedded tabs, resize, search, fullscreen (`node-pty` + xterm)
- **Containers** — Docker list / start / stop / logs; Compose labels; app still runs if Docker is missing
- **Git** — status, changed files, file diff, commit all, push, PR URL
- **Health & notes** — project/environment checks; markdown notes with tasks and runnable `bash:run` blocks
- **Engine** — local index, full-text / regex search, stats, Git insights
- **Bugs** — context snapshots and attachments
- **Export / import** — merge or replace, with a SQLite backup first
- **Tray & launcher** — optional tray; `Ctrl/Cmd+K` command palette
- **LLM context** — local file bundle only (no AI API)

Non-goals: cloud sync, team collaboration, analytics, replacing a full IDE.

## Install (end users)

See [docs/install.md](docs/install.md). Short version:

- **Windows 10/11 x64:** `DevDesk-0.1.4-win-x64.exe` from [GitHub Releases](https://github.com/reyanshdagoat9113/DevDesk/releases). Unsigned — SmartScreen may warn.
- **Linux x64:** `DevDesk-0.1.4-linux-x64.deb`.
- **macOS:** not in this beta.

All data stays on the machine ([docs/data-locations.md](docs/data-locations.md)).

## Quick start (developers)

The performance engine is `packages/engine` in this repo. Do not clone the archived `devdesk-addons` tree.

Requires **Node.js 22.12–24** (default **22**; `.nvmrc`).

```bash
npm install
npm run rebuild:native:electron
npm run dev
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite renderer + Electron (rebuilds Electron natives first) |
| `npm run build` | Engine prebuild + main / preload / renderer |
| `npm run release:gate` | Typecheck, lint, Rust, all Vitest suites, packaged-engine smoke |
| `npm run test:coverage` | V8 coverage (per-suite floors in vitest configs) |
| `npm run package:win` / `package:linux` | Installers under `release/` |
| `npm run verify:win-package` / `verify:linux-package` | Unpacked engine + native checks |

Windows native builds need Visual Studio C++ Build Tools, Python 3, and Git. See [docs/native-modules.md](docs/native-modules.md).

Before tests under Node: `npm run rebuild:native:node`. Mixing Node and Electron ABIs without rebuilding will fail to load `better-sqlite3` or `node-pty`.

## Architecture

Electron **main** (Node + TypeScript) owns IPC, SQLite (`devdesk.db` in userData, WAL), Docker, Git, PTYs, and engine spawn. **Preload** exposes `window.electronAPI`. The **renderer** is React + Vite + shadcn/ui. The **engine** is a packaged local indexer.

Details: [docs/architecture.md](docs/architecture.md).

## Docs

Full index: [docs/README.md](docs/README.md).

| Doc | Topic |
|-----|--------|
| [docs/user-guide.md](docs/user-guide.md) | Using the app |
| [docs/install.md](docs/install.md) | Install, platforms, uninstall |
| [docs/architecture.md](docs/architecture.md) | Process model and packages |
| [docs/release.md](docs/release.md) | Packaging, CI, signing limits |
| [docs/native-modules.md](docs/native-modules.md) | Native ABI rebuilds |
| [docs/data-locations.md](docs/data-locations.md) | userData, backup, export |
| [docs/data-model.md](docs/data-model.md) | SQLite entities |
| [docs/manual-qa.md](docs/manual-qa.md) | Clean-install QA |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributor setup |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm run release:gate` before opening a PR.

## License

MIT — [LICENSE](LICENSE).
