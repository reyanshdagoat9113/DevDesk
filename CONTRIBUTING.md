# Contributing to DevDesk

Thanks for helping. Product overview: [Readme.md](Readme.md). Docs index: [docs/README.md](docs/README.md).

## Setup

Clone this repository only. The engine is `packages/engine` (`devdesk-engine`) in the root npm workspace.

**Node.js 22.12–24** (default **22**; `.nvmrc`). Root and engine share one `better-sqlite3` **v12**.

```bash
npm install
npm run rebuild:native:electron
npm run dev
```

Windows native builds need Visual Studio Build Tools (C++), Python 3, and Git.  
See [docs/native-modules.md](docs/native-modules.md) and [docs/install.md](docs/install.md).

Use `rebuild:native:node` before Node-based tests, and `rebuild:native:electron` before `dev` / packaging. Do not mix ABIs.

## Verification

Before opening a pull request:

```bash
npm run rebuild:native:node
npm run release:gate
```

Packaging changes:

- Windows: `npm run verify:win-package` (optionally `package:win`)
- Linux: `npm run verify:linux-package` (optionally `package:linux`)

Maintainer release steps: [docs/beta-release-checklist.md](docs/beta-release-checklist.md).

## Conventions

- TypeScript, 2-space indent, PascalCase components, `useX` hooks.
- IPC channels are kebab-case; add them to `packages/ipc-contracts/src/channels.ts`, not as one-off strings.
- Keep `apps/desktop/preload.ts` small and explicit.
- UI: shadcn wrappers in `apps/renderer/app/components/ui`, Radix primitives, `cn` from `apps/renderer/lib/utils.ts`.
- Domain logic stays in the owning folder ([docs/architecture/module-boundaries.md](docs/architecture/module-boundaries.md)).
- Local-first and deterministic. No cloud services or analytics.
- Treat shell execution as explicit user intent.

## Tests

| Suite | Command | Config |
|-------|---------|--------|
| Desktop (main) | `npm run test:run` | `vitest.desktop.config.ts` |
| Renderer | `npm run test:renderer:run` | `vitest.renderer.config.ts` |
| Engine | `npm run test:engine` | engine workspace |
| Engine IPC | `npm run test:engine-ipc` | `vitest.engine.config.ts` |
| Rust | `npm run test:rust` | `packages/engine/rust` |
| Coverage | `npm run test:coverage` | V8; floors are non-decreasing |

Add or update tests when behavior changes. Coverage policy: [docs/test-review-ledger.md](docs/test-review-ledger.md).

## Pull requests

- Short imperative titles (`Add run history output viewer`).
- Describe what changed and how you verified it.
- Screenshots for UI changes.
- Update docs when install, data, IPC, or release behavior changes.
- Do not list finished work as open in `TODO.md` / `ROADMAP.md`.

## Scripts

[COMMANDS.md](COMMANDS.md) lists npm scripts.
