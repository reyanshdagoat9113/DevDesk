# DevDesk Engine

Fast local code-intelligence engine for DevDesk.

## Requirements

- Node.js 24.x is the release/test environment used for this repo.
- `better-sqlite3` is a native dependency, so it must be built or rebuilt for the active Node ABI.

## Setup

```bash
npm install
```

If you switch Node versions, restore `node_modules`, or see a `NODE_MODULE_VERSION` mismatch, rebuild the native dependency:

```bash
npm run rebuild:native
```

## Common commands

```bash
npm run test:run
npm run build
npm run build:rust
npm run build:all
```

## Notes

- `npm run test:run` should pass after the native module is rebuilt for the current Node runtime.
- The Rust scanner binary is copied by `npm run build:rust`.
