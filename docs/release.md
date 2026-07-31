# DevDesk release packaging

Also see: [install.md](./install.md) · [RELEASE-NOTES-0.1.1.md](./RELEASE-NOTES-0.1.1.md) · [beta-release-checklist.md](./beta-release-checklist.md) · [data-locations.md](./data-locations.md)

## Supported platforms (private beta)

| Platform | Artifacts | Status |
|----------|-----------|--------|
| **Windows x64** | NSIS installer (`.exe`), unpacked dir for smoke | Primary |
| **Linux x64** | deb, unpacked dir for smoke | Supported |
| **macOS** | — | Deferred (no target/signing/notarization yet) |

Version and artifact names come from `package.json`:

```text
DevDesk-${version}-${os}-${arch}.${ext}
```

Example: `DevDesk-0.1.1-win-x64.exe`, `DevDesk-0.1.1-linux-x64.deb`.

## Release gate (automated)

From a clean checkout of DevDesk:

```bash
npm install
npm run rebuild:native:node
npm run release:gate
```

`release:gate` runs:

```text
typecheck
lint
lint:architecture
test:rust             # cargo test --locked (packages/engine/rust)
test:run              # includes migration, native load, terminal unit tests
test:renderer:run
test:engine
test:engine-ipc
smoke:engine-packaged
```

Coverage (V8; per-suite non-decreasing thresholds active in vitest configs):

```bash
npm run test:coverage
```

Platform package smokes (CI per OS, Node 22 packaging lane):

```bash
npm run verify:win-package    # Windows
npm run verify:linux-package  # Linux
```

Windows clean-profile backend integration and packaged-startup evidence:

```bash
npm run qa:clean-install:win
# → release/clean-install-qa-report.json
```

The command creates a fresh Windows package before testing it. It does not drive the renderer UI; interactive Windows and Linux sign-off remains tracked in `manual-qa.md`.

### CI topology (`.github/workflows/release-gate.yml`)

| Lane | Matrix | Purpose |
|------|--------|---------|
| Static and coverage | Ubuntu, Node 22 | typecheck, lint, architecture, V8 coverage reports |
| Native and integration | Windows + Ubuntu × Node 22 + 24 | clean install, Node-native rebuild, desktop/renderer/engine/engine-ipc tests |
| Rust | Windows + Ubuntu | `cargo test --locked` (+ locked build) |
| Package verification | Windows + Ubuntu, Node 22 | packaged engine smoke + unpacked package verify |

Supported host Node for development and packaging: **22.12–24** (default **22**, see `.nvmrc`). Review ledger: [test-review-ledger.md](./test-review-ledger.md).

## Clean-checkout packaging

```bash
npm install
npm run rebuild:native:electron
npm run icons:generate   # optional if build/icon.* already committed
```

### Windows host

```bash
npm run package:win          # NSIS installer under release/
npm run package:win:dir      # unpacked app for verification
npm run verify:win-package   # engine + native unpack checks
```

### Linux host

```bash
npm run package:linux
npm run package:linux:dir
npm run verify:linux-package
```

Native rebuild prerequisites: [native-modules.md](./native-modules.md).

## What is bundled

- App main/preload/renderer under `dist/`
- Electron-native `better-sqlite3` and `node-pty` (asar-unpacked)
- Packaged performance engine under `resources/engine/` from `packages/engine/dist` (workspace package), with Electron-built `better-sqlite3` and `commander` under `resources/engine/node_modules/`

## Icons and metadata

| Item | Value |
|------|--------|
| `appId` | `com.devdesk.app` |
| `productName` | `DevDesk` |
| Version | `package.json` → `version` |
| Icon source | `build/icon.png` / `build/icon.ico` (from logo via `npm run icons:generate`) |

## Code signing (deferred for beta)

Private beta builds are **unsigned**:

- **Windows:** SmartScreen may warn on first launch. Authenticode signing is deferred until a release certificate is available (`CSC_LINK` / `CSC_KEY_PASSWORD` with electron-builder).
- **macOS:** Not a first-release target; Developer ID + notarization deferred.
- **Linux:** No code signing is required for deb distribution in beta.

Do not claim “signed installers” until signing secrets and CI are configured.

## Manual packaged-app checks

Full checklist and session results: [manual-qa.md](./manual-qa.md).

After installing or running the unpacked binary:

1. App launches without DevTools and loads the renderer.
2. Projects persist after restart (SQLite in userData).
3. Terminal tab opens (`node-pty`).
4. Engine index/search works for a sample project.
5. Docker missing/present states still degrade gracefully.

## Release notes template

```markdown
## DevDesk vX.Y.Z (private beta)

### Platforms
- Windows x64 installer
- Linux x64 deb

### Known limitations
- Installers are unsigned (Windows SmartScreen may warn)
- macOS builds not provided
- Auto-update not enabled
```
