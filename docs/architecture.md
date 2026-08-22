# Architecture

DevDesk is an Electron desktop app with a local performance engine. The renderer never talks to Node or the filesystem directly.

Related: [module-boundaries.md](./architecture/module-boundaries.md) · [data-model.md](./data-model.md) · [native-modules.md](./native-modules.md) · [packages/engine/ARCHITECTURE.md](../packages/engine/ARCHITECTURE.md)

## Process model

```text
┌─────────────────────────────────────────────────────────────┐
│  Renderer (apps/renderer)                                   │
│  React + Vite + shadcn/ui + Radix                           │
│  window.electronAPI only                                    │
└──────────────────────────▲──────────────────────────────────┘
                           │ contextBridge (apps/desktop/preload.ts)
┌──────────────────────────┴──────────────────────────────────┐
│  Main (apps/desktop)                                        │
│  IPC handlers → domain services → SQLite / child processes  │
│                                                             │
│  store  docker  git  terminal (node-pty)  health  bugs      │
│  engine spawn  tray  files  command runner                  │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
              ▼                               ▼
     userData/devdesk.db              resources/engine/
     (+ WAL, attachments,             devdesk-engine (Node +
      engine/*.sqlite)                optional Rust scanner)
```

| Process | Role |
|---------|------|
| **Main** | Persistence, IPC, Docker CLI, Git CLI, PTY, engine child process, tray |
| **Preload** | Small explicit `contextBridge` API; `nodeIntegration` off, `contextIsolation` on |
| **Renderer** | UI only |
| **Engine** | Index, FTS search, stats, Git insights; packaged to `resources/engine/` |

In development, Vite serves the renderer at `http://127.0.0.1:5180`. In production the main process loads `dist/renderer/index.html` (relative `./` assets).

## Repository layout

| Path | Package / role |
|------|----------------|
| `apps/desktop/` | Electron main, preload, IPC, SQLite store, services |
| `apps/renderer/` | React UI |
| `packages/engine/` | `devdesk-engine` — local code intelligence |
| `packages/ipc-contracts/` | `@devdesk/ipc-contracts` — channel name constants shared by main/preload |
| `packages/landing/` | `@devdesk/landing` — public install site (not shipped inside the app) |
| `scripts/` | Native rebuild, release gate, package verify, QA harnesses |
| `dist/` | Build output (`main`, `preload`, `renderer`) |
| `release/` | Installers and unpacked apps |

## IPC

Channels are kebab-case strings (`projects:add`, `commands:run`). The canonical list is `packages/ipc-contracts/src/channels.ts`, generated into usage via `npm run build:ipc-contracts`.

- **Invoke** — request/response (`ipcMain.handle`).
- **Events** — main → renderer (`runs:output`, `terminal:data`, `engine:indexing-started`, …).

Registration lives under `apps/desktop/ipc/`:

- `registerIpc.ts` — thin orchestrator
- `handlers/*` — domain registrars
- `runtimeState.ts` — in-memory maps (running processes, log subscriptions)
- `trustedIpc.ts` — sender checks

Keep new preload methods explicit. Do not expose Node or a generic `invoke(channel)` from the renderer.

## Persistence

Main process owns SQLite (`better-sqlite3`) at `userData/devdesk.db` with WAL and foreign keys.

- Schema: `apps/desktop/data/store/core.ts`
- Types: `apps/desktop/data/model.ts` (`DATA_VERSION` = export format)
- Legacy `devdesk-store.json` is imported once when the preferences table is empty
- `reconcileRunHistory()` marks leftover `running` rows `stopped` on startup

Engine indexes are **separate** SQLite files: `userData/engine/<projectId>.sqlite`.

## Command execution

Vault commands and chains run in the main process (`apps/desktop/system/runner.ts`) after variable resolution (`commands/variableResolver.ts`). Output is streamed on `runs:output` and stored on `run_history`.

Embedded terminals are a different path: `node-pty` sessions in `terminal/terminalManager.ts`, data on `terminal:data`.

Docker and Git call host CLIs. Missing Docker is a recoverable UI state, not a crash.

## Performance engine

`devdesk-engine` is TypeScript by default. Rust is used for directory scan, hashing, and heavy regex — not for SQLite, ranking, or IPC.

The desktop app spawns the packaged CLI under `resources/engine/` with Electron-built `better-sqlite3`. Paths in engine JSON use forward slashes; see the engine architecture doc for the path contract.

## Security defaults

- `nodeIntegration: false`, `contextIsolation: true`
- Preload surface is allowlisted methods, not raw `ipcRenderer`
- File APIs confine paths to the selected project root
- External URLs must be `https:` (or `http:` on localhost)
- Import replace backs up `devdesk.db` first
- Shell and Docker remove operations require explicit UI confirmation

Treat command strings and project paths as user intent. Do not add implicit background command execution.

## UI stack

Renderer uses Tailwind, shadcn-style wrappers in `apps/renderer/app/sections` and `components/ui`, and Radix primitives. Shared `cn()` lives in `apps/renderer/lib/utils.ts`. See [ui-libraries.md](./ui-libraries.md).

## Tests and packaging

| Layer | How |
|-------|-----|
| Desktop | Vitest (`vitest.desktop.config.ts`), Node ABI for `better-sqlite3` |
| Renderer | Vitest + Testing Library (`vitest.renderer.config.ts`) |
| Engine | Workspace Vitest + `cargo test --locked` |
| Engine IPC | `vitest.engine.config.ts` after an engine build |
| Packaged | `smoke:engine-packaged`, `verify:*-package`, Windows `qa:clean-install:win` |

Native modules must match the runtime ABI: Node for Vitest, Electron for `dev` / packaging. Details in [native-modules.md](./native-modules.md).
