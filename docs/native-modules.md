# Native modules and rebuild workflow

DevDesk uses two native Node addons:

| Package | Runtime | When needed |
|---------|---------|-------------|
| `better-sqlite3` | Node (tests) and Electron (app / packaged engine) | Persistence + engine SQLite |
| `node-pty` | Electron only | Embedded terminals |

Node and Electron use different ABIs. Always rebuild against the runtime that will load the module.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run rebuild:native:node` | Ensure `better-sqlite3` loads under **Node** for the app and linked `devdesk-engine` |
| `npm run rebuild:native` | Rebuild `better-sqlite3` for **Electron** only (tests/smoke) |
| `npm run rebuild:native:electron` | Rebuild `better-sqlite3` + `node-pty` for **Electron** (dev / packaging) |
| `npm run test:engine-ipc` | Node-native ensure → engine build → engine IPC integration tests |
| `npm run smoke:engine-packaged` | Electron-native sqlite rebuild → main build → packaged engine smoke |

Engine package helper:

```bash
npm --prefix ../devdesk-addons/devdesk-engine run ensure:native
```

This only targets the engine package’s own `better-sqlite3` for the current Node process.

## Clean-checkout flow

```bash
npm install
npm run rebuild:native:node    # desktop + engine tests under Node
npm run test:run
npm run test:engine-ipc

npm run rebuild:native:electron
npm run dev                    # or package:* / smoke:engine-packaged
```

`smoke:engine-packaged` already runs `rebuild:native` (Electron `better-sqlite3` only) and does not require `node-pty`.

## Windows prerequisites

- **Node.js** 18+ (LTS recommended)
- **Visual Studio Build Tools** with workload **Desktop development with C++**
  (includes MSVC, Windows SDK)
- **Python 3** on `PATH` (node-gyp)
- **Git** (some native packages run git during configure; `node-pty` historically used `GetCommitHash.bat`)
- Optional for the engine Rust binary: **Rust** toolchain (`cargo`) when running `build:engine` / `build:all`

If rebuild fails, the scripts print an actionable error. Common fixes:

1. Open a new terminal after installing Build Tools so `cl.exe` is on `PATH`.
2. Prefer `npm run rebuild:native` over full Electron rebuild when only SQLite is needed.
3. Use `npm run rebuild:native:electron` only when terminals or packaging need `node-pty`.
4. Avoid mixing a Node rebuild into an Electron session without re-running the Electron rebuild before `npm run dev`.

## Linux / macOS

- Linux: `build-essential`, `python3`
- macOS: Xcode Command Line Tools (`xcode-select --install`)

## CI notes

- Run Node-targeted ensures before Vitest that loads `better-sqlite3` under Node.
- Run Electron-targeted rebuilds before packaged smoke or Electron launch.
- Prefer `-o better-sqlite3` (via `rebuild:native`) in jobs that do not exercise terminals, so `node-pty` compile failures do not block engine smoke.
