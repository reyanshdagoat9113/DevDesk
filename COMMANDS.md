# Commands

## Development
- `npm run dev` - Rebuild natives for Electron, build main/preload, start Vite dev server, then launch Electron.
- `npm run dev:renderer` - Start Vite only.

## Build
- `npm run build` - Build engine (prebuild), main, preload, and renderer bundles.
- `npm run build:main` - Compile Electron main process TypeScript.
- `npm run build:preload` - Compile preload TypeScript.
- `npm run build:renderer` - Vite production build (outputs to `dist/renderer`).
- `npm run build:engine` - Build the `devdesk-engine` workspace package (TS + Rust scanner).

## Native modules (ABI)
- `npm run rebuild:native:node` - Rebuild `better-sqlite3` for the Node ABI (before Node-based tests).
- `npm run rebuild:native:electron` - Rebuild `better-sqlite3` + `node-pty` for the Electron ABI (before running/packaging).
- Details: `docs/native-modules.md`.

## Tests (vitest)
- `npm run test:run` - Desktop (main process) tests (`vitest.desktop.config.ts`; `pretest:run` rebuilds natives for Node).
- `npm run test:renderer:run` - Renderer tests (`vitest.renderer.config.ts`).
- `npm run test:engine` - Engine workspace tests.
- `npm run test:engine-ipc` - Electron-to-engine IPC tests (`vitest.engine.config.ts`).

## Quality
- `npm run lint` - ESLint for `apps/**/*.ts` and `apps/**/*.tsx`.
- `npm run lint:architecture` - Architecture rules check.
- `npm run typecheck` - TypeScript typecheck only.

## Release & packaging
- `npm run release:gate` - Full gate: typecheck + lint + all test suites + packaged-engine smoke. Run before PRs.
- `npm run package:win` / `npm run package:linux` - Installable artifacts under `release/`.
- `npm run package:win:dir` / `npm run package:linux:dir` - Unpacked directory builds.
- `npm run verify:win-package` / `npm run verify:linux-package` - Packaged engine + native checks.
- `npm run smoke:engine-packaged` - Packaged-engine smoke test.
- `npm run qa:clean-install:win` - Automated Windows clean-install QA (report under `release/`).
- `npm run icons:generate` - Regenerate app icons.
