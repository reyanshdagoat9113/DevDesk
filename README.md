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
npm run build
npm run build:rust
npm run build:all
```

## Notes

- The Rust scanner binary is copied by `npm run build:rust`.
- Engine tests are currently being reworked and will be reintroduced later.
