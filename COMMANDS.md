# Commands

Root `package.json` scripts. Native ABI notes: [docs/native-modules.md](docs/native-modules.md).

## Development

| Script | What it does |
|--------|----------------|
| `npm run dev` | Electron natives → main/preload → Vite → Electron |
| `npm run dev:renderer` | Vite only (`http://127.0.0.1:5180`) |

## Build

| Script | What it does |
|--------|----------------|
| `npm run build` | Main, preload, renderer (`prebuild` builds IPC contracts + engine) |
| `npm run build:main` | `tsc -p tsconfig.main.json` → `dist/main` |
| `npm run build:preload` | `tsc -p tsconfig.preload.json` → `dist/preload` |
| `npm run build:renderer` | Vite production → `dist/renderer` |
| `npm run build:engine` | `devdesk-engine` TypeScript + Rust scanner |
| `npm run build:ipc-contracts` | Shared IPC channel package |
| `npm run icons:generate` | Refresh `build/icon.png` / `build/icon.ico` |

## Native modules

| Script | ABI | Modules |
|--------|-----|---------|
| `npm run rebuild:native:node` | Node | `better-sqlite3` (app + engine) |
| `npm run rebuild:native` | Electron | `better-sqlite3` only |
| `npm run rebuild:native:electron` | Electron | `better-sqlite3` + `node-pty` |

Use Node rebuilds before Vitest; Electron rebuilds before `dev` / `package:*`.

## Tests

| Script | Suite |
|--------|--------|
| `npm run test:run` | Desktop main-process (`pretest:run` ensures Node natives) |
| `npm run test:renderer:run` | Renderer |
| `npm run test:engine` | Engine workspace |
| `npm run test:engine-ipc` | Engine child-process IPC |
| `npm run test:rust` | `cargo test --locked` in `packages/engine/rust` |
| `npm run test:coverage` | Desktop + renderer + engine V8 reports |
| `npm run smoke:engine-packaged` | Packaged engine index/search/stats smoke |

Watch variants: `npm test` and `npm run test:renderer` (no `:run`).

## Quality

| Script | What it does |
|--------|----------------|
| `npm run lint` | ESLint on `apps/**/*.ts(x)` |
| `npm run lint:architecture` | Folder/boundary rules |
| `npm run typecheck` | `tsc --noEmit` (IPC contracts built first) |
| `npm run release:gate` | typecheck + lint + rust + all tests + packaged-engine smoke |
| `npm run report:file-sizes` | Largest source files (maintainability) |

## Packaging

| Script | What it does |
|--------|----------------|
| `npm run package:win` / `package:linux` | NSIS `.exe` or `.deb` under `release/` |
| `npm run package:win:dir` / `package:linux:dir` | Unpacked app |
| `npm run verify:win-package` / `verify:linux-package` | Engine + native unpack checks |
| `npm run qa:clean-install:win` | Fresh Windows package + backend harness → `release/clean-install-qa-report.json` |
| `npm run test:production` | Launch Electron against the current `dist/` |

## Landing page (`packages/landing`)

| Script | What it does |
|--------|----------------|
| `npm run landing:dev` | Vite dev server |
| `npm run landing:build` / `landing:start` | Production build / Node static server |
| `npm run landing:verify-downloads` | HEAD-check GitHub Release assets |
| `npm run landing:lint` / `landing:typecheck` | Landing-only checks |
| `npm run landing:assets` / `landing:verify-assets` | Generated brand assets |
| `npm run landing:shots` | Capture product screenshots after a renderer build |
