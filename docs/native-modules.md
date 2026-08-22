# Native modules and rebuild workflow

DevDesk uses two native Node addons. Node and Electron have **different ABIs** — rebuild for the runtime that will `require()` the module.

| Package | Loaded by | When |
|---------|-----------|------|
| `better-sqlite3` | Node (tests) and Electron (app + packaged engine) | Persistence and engine SQLite |
| `node-pty` | Electron only | Embedded terminals |

Root and `devdesk-engine` must stay on the same `better-sqlite3` **v12** (do not nest a second major in the lockfile).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run rebuild:native:node` | `better-sqlite3` for **Node** (app + linked engine) |
| `npm run rebuild:native` | `better-sqlite3` for **Electron** only (smoke / CI jobs without PTY) |
| `npm run rebuild:native:electron` | `better-sqlite3` + `node-pty` for **Electron** (dev and packaging) |
| `npm run test:engine-ipc` | Node natives → engine build → IPC integration tests |
| `npm run smoke:engine-packaged` | Electron sqlite rebuild → main build → packaged engine smoke |

Engine-only helper:

```bash
npm --workspace devdesk-engine run ensure:native
```

That only targets the engine package’s `better-sqlite3` for the current Node process.

## Clean-checkout flow

```bash
npm install
npm run rebuild:native:node    # desktop + engine tests under Node
npm run test:run
npm run test:engine-ipc

npm run rebuild:native:electron
npm run dev                    # or package:* / smoke:engine-packaged
```

`smoke:engine-packaged` already runs `rebuild:native` (Electron sqlite only) and does not need `node-pty`.

`npm run dev` and `package:*` run `rebuild:native:electron` themselves.

## Windows prerequisites

- **Node.js** 22.12–24 (default 22; `.nvmrc`)
- **Visual Studio Build Tools** with **Desktop development with C++** (MSVC + Windows SDK)
- **Python 3** on `PATH` (node-gyp)
- **Git** (some native packages shell out to git)
- Optional: **Rust** toolchain when running `build:engine` / `test:rust`

If rebuild fails:

1. Open a new terminal after installing Build Tools so `cl.exe` is on `PATH`.
2. Prefer `rebuild:native` when only SQLite is needed (skips `node-pty`).
3. Use `rebuild:native:electron` for terminals and packaging.
4. After a Node-targeted rebuild, run the Electron rebuild again before `npm run dev`.

## Linux / macOS

- Linux: `build-essential`, `python3`
- macOS: Xcode Command Line Tools (`xcode-select --install`) — app packaging for macOS is still deferred

## CI

- Node-targeted ensure before Vitest that loads `better-sqlite3` under Node
- Electron-targeted rebuild before packaged smoke or Electron launch
- Jobs that do not exercise terminals should use `rebuild:native` so a `node-pty` compile failure does not block engine smoke
- Native/integration CI: Windows + Linux, Node 22 and 24; packaging jobs: Node 22 only
- Rust: `npm run test:rust` (`cargo test --locked` in `packages/engine/rust`)
