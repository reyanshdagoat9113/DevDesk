# DevDesk Engine (`devdesk-engine`)

Fast local code-intelligence engine for DevDesk. Lives in the monorepo at `packages/engine` and is linked via the root npm workspace.

## Setup (from monorepo root)

```bash
npm install
npm run rebuild:native:node      # Node ABI for tests
npm --workspace devdesk-engine run build:all
```

Do **not** clone a separate `devdesk-addons` repository.

## Common commands

From monorepo root:

```bash
npm --workspace devdesk-engine run build
npm --workspace devdesk-engine run build:rust
npm --workspace devdesk-engine run build:all
npm run test:engine
npm run test:engine-ipc
npm run smoke:engine-packaged
```

From this package directory (optional):

```bash
npm run rebuild:native
npm run build:all
npm run test:run
```

## Notes

- `better-sqlite3` must match the runtime ABI (Node for tests, Electron for the app/packaged engine). Use root scripts in `docs/native-modules.md`.
- The Rust scanner is produced by `build:rust` and copied into `dist/`.
- Packaging copies `packages/engine/dist` into app `resources/engine/` (plus runtime deps under `resources/engine/node_modules/`).
