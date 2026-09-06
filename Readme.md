# DevDesk

[![Release gate](https://github.com/reyanshdagoat9113/DevDesk/actions/workflows/release-gate.yml/badge.svg?branch=main)](https://github.com/reyanshdagoat9113/DevDesk/actions/workflows/release-gate.yml)
[![Version](https://img.shields.io/badge/version-0.1.5-blue)](docs/RELEASE-NOTES-0.1.5.md)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-lightgrey)](docs/install.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Local-first Electron desktop workspace for developers: project manager, command vault, embedded terminals, Docker controls, Git actions, and on-disk code search — without accounts or cloud sync.

## Status

**v0.1.5 private beta** (2026-09-04). Product features for this line are implemented. Remaining launch work is interactive packaged-app QA, optional Windows Authenticode signing, and macOS (deferred).

| Area | State |
|------|--------|
| Core product | Implemented — see [docs/user-guide.md](docs/user-guide.md) |
| Automated release gate + CI | `npm run release:gate` and `.github/workflows/release-gate.yml` |
| Windows x64 NSIS installer | Shipped, **unsigned** (SmartScreen may warn) |
| Linux x64 `.deb` | Shipped |
| macOS | Not shipped |
| Manual QA | Automated Windows clean-install harness green; interactive Windows + Linux rows still open in [docs/manual-qa.md](docs/manual-qa.md) |

Release notes: [docs/RELEASE-NOTES-0.1.5.md](docs/RELEASE-NOTES-0.1.5.md) · [0.1.4](docs/RELEASE-NOTES-0.1.4.md) · [0.1.3](docs/RELEASE-NOTES-0.1.3.md) · [0.1.2](docs/RELEASE-NOTES-0.1.2.md) · [0.1.1](docs/RELEASE-NOTES-0.1.1.md) · [0.1.0](docs/RELEASE-NOTES-0.1.0.md)

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

## Stack

| Layer | Technologies |
|-------|----------------|
| Desktop shell | Electron 33, TypeScript |
| Main process | Node, `better-sqlite3` (WAL), `node-pty`, IPC handlers |
| Preload | `contextBridge` → `window.electronAPI` (`nodeIntegration` off) |
| Renderer | React 19, Vite 6, Tailwind CSS, shadcn/ui, Radix, xterm |
| Engine | `devdesk-engine` (TypeScript + optional Rust scanner), FTS SQLite indexes |
| Shared contracts | `@devdesk/ipc-contracts` (npm workspace) |
| Landing (optional) | `@devdesk/landing` — separate Vite site, not bundled in the installer |
| Tests | Vitest (desktop / renderer / engine), `cargo test` for Rust |
| Packaging | electron-builder → Windows NSIS + Linux `.deb` under `release/` |

## Prerequisites

| Tool | Required for | Notes |
|------|--------------|--------|
| **Node.js 22.12–24** | App, tests, packaging | Engines: `>=22.12.0 <25`. Local pin: `.nvmrc` (`22.23.1`). CI also exercises Node 24. |
| **npm** | Install / scripts | Uses root workspaces (`packages/*`) |
| **C/C++ toolchain** | Native modules | Windows: VS Build Tools (Desktop C++) + Python 3. Linux: `build-essential` + `python3`. |
| **Git** | App Git features + some native builds | Must be on `PATH` |
| **Rust (`cargo`)** | Engine binary / `test:rust` / packaging smoke | Needed for `npm run build:engine` and release gate |
| **Docker** (optional) | Container UI | App runs without Docker; container features need a daemon |

See [docs/native-modules.md](docs/native-modules.md) and [docs/install.md](docs/install.md).

## Install (end users)

See [docs/install.md](docs/install.md). Short version:

- **Windows 10/11 x64:** `DevDesk-0.1.5-win-x64.exe` from [GitHub Releases](https://github.com/reyanshdagoat9113/DevDesk/releases). Unsigned — SmartScreen may warn.
- **Linux x64:** `DevDesk-0.1.5-linux-x64.deb`.
- **macOS:** not in this beta.

All data stays on the machine ([docs/data-locations.md](docs/data-locations.md)).

## Setup (developers)

The performance engine is `packages/engine` in this repo. Do **not** clone the archived `devdesk-addons` tree.

```bash
npm install
npm run rebuild:native:electron   # better-sqlite3 + node-pty for Electron
npm run dev
```

`npm run dev` rebuilds Electron natives, builds main/preload, starts Vite on `http://127.0.0.1:5180`, then launches Electron.

Before Node-based Vitest suites:

```bash
npm run rebuild:native:node
```

Do not mix Node and Electron ABIs without rebuilding — `better-sqlite3` / `node-pty` will fail to load.

## Run

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev app (Vite renderer + Electron) |
| `npm run dev:renderer` | Vite only (`127.0.0.1:5180`) |
| `npm run build` | IPC contracts + engine prebuild, then main / preload / renderer → `dist/` |
| `npm run test:production` | Launch Electron against current `dist/` |
| `npm run package:win` / `package:linux` | Installers under `release/` |
| `npm run verify:win-package` / `verify:linux-package` | Unpacked engine + native checks |
| `npm run landing:dev` | Optional public install page (`packages/landing`) |

Full script list: [COMMANDS.md](COMMANDS.md).

## Test

| Suite | Command |
|-------|---------|
| Desktop (main) | `npm run test:run` |
| Renderer | `npm run test:renderer:run` |
| Engine | `npm run test:engine` |
| Engine IPC | `npm run test:engine-ipc` |
| Rust | `npm run test:rust` |
| Coverage (all) | `npm run test:coverage` |
| Full release gate | `npm run release:gate` |

`release:gate` runs typecheck, lint, architecture lint, Rust tests, all Vitest suites, and packaged-engine smoke. Run it before opening a PR.

## Repository structure

```text
DevDesk/
├── apps/
│   ├── desktop/          # Electron main, preload, IPC, SQLite, Docker/Git/PTY services
│   └── renderer/         # React UI (Vite root)
├── packages/
│   ├── engine/           # devdesk-engine — local index / search (TS + rust/)
│   ├── ipc-contracts/    # Shared IPC channel constants
│   └── landing/          # Public install site (not shipped inside the app)
├── scripts/              # Native rebuild, release gate, package verify, QA harnesses
├── docs/                 # User + contributor documentation
├── build/                # App icons and packaging resources
├── dist/                 # Build output (gitignored)
└── release/              # Installers / unpacked apps (gitignored)
```

Process model and boundaries: [docs/architecture.md](docs/architecture.md).

## Environment variables

The desktop app is local-first and does **not** require API keys or a `.env` file to run. `.env` / `.env.*` are gitignored for local tooling only.

| Name | Where | Purpose |
|------|--------|---------|
| `NODE_ENV=production` | Main process | Forces non-dev mode even when unpackaged |
| `VITE_SITE_URL` | `packages/landing` only | Canonical origin for SEO/OG tags (falls back to the GitHub repo URL) |
| `npm_execpath` | Scripts | Used by Node helper scripts to locate npm (set by npm itself) |

Useful runtime flag (not an env var):

```text
DevDesk.exe --user-data-dir=C:\path\to\profile
```

Isolates Electron `userData` for clean-install / QA testing. Default data paths: [docs/data-locations.md](docs/data-locations.md).

## Architecture

Electron **main** (`apps/desktop`) owns IPC, SQLite (`devdesk.db` in userData, WAL), Docker, Git, PTYs, and engine spawn. **Preload** exposes `window.electronAPI`. The **renderer** is React + Vite + shadcn/ui. The **engine** is a packaged local indexer under `resources/engine/`.

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
| [COMMANDS.md](COMMANDS.md) | npm script reference |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm run release:gate` before opening a PR.

## License

MIT — [LICENSE](LICENSE).
