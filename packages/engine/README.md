# DevDesk Engine (`devdesk-engine`)

Local code-intelligence engine for DevDesk: index a repo, full-text/regex search, stats, Git insights. Lives at `packages/engine` and is linked via the root npm workspace.

Internals: [ARCHITECTURE.md](./ARCHITECTURE.md). Native ABI: [../../docs/native-modules.md](../../docs/native-modules.md).

## Setup (monorepo root)

```bash
npm install
npm run rebuild:native:node
npm --workspace devdesk-engine run build:all
```

Do **not** clone the archived `devdesk-addons` repository.

## Commands

From repo root:

```bash
npm --workspace devdesk-engine run build        # TypeScript
npm --workspace devdesk-engine run build:rust   # scanner binary → dist/
npm --workspace devdesk-engine run build:all
npm run test:engine
npm run test:engine-ipc
npm run test:rust
npm run smoke:engine-packaged
```

CLI (after build; JSON on stdout):

```bash
npx devdesk-engine ping
npx devdesk-engine index ./my-project
npx devdesk-engine index ./my-project --full --profile source-first
npx devdesk-engine search "useEffect" ./my-project
npx devdesk-engine search "TODO|FIXME" ./my-project --regex
npx devdesk-engine stats ./my-project
npx devdesk-engine git ./my-project
```

Index profiles: `source-first` (default), `source-docs`, `full-text`. See [docs/data-locations.md](../../docs/data-locations.md).

## Packaging

The desktop app copies `packages/engine/dist` to `resources/engine/` plus Electron-built `better-sqlite3` and `commander` under `resources/engine/node_modules/`.

`better-sqlite3` must match the runtime ABI: Node for tests, Electron for the app and packaged engine.

The Rust scanner is optional at runtime: TypeScript fallbacks exist, but `build:all` / packaging expect the binary in `dist/`.
