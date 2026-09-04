# Release packaging

Also see: [install.md](./install.md) · [beta-release-checklist.md](./beta-release-checklist.md) · [RELEASE-NOTES-0.1.5.md](./RELEASE-NOTES-0.1.5.md) · [manual-qa.md](./manual-qa.md)

## Platforms

| Platform | Artifacts | Status |
|----------|-----------|--------|
| Windows x64 | NSIS `.exe`, unpacked dir for smoke | Primary |
| Linux x64 | `.deb`, unpacked dir for smoke | Supported |
| macOS | — | Deferred |

Artifact names come from `package.json` `build.artifactName`:

```text
DevDesk-${version}-${os}-${arch}.${ext}
```

Examples: `DevDesk-0.1.5-win-x64.exe`, `DevDesk-0.1.5-linux-x64.deb`.

## GitHub Releases

Pushing a version tag (for example `v0.1.5`) runs `.github/workflows/publish-release.yml`. The workflow:

1. Checks the tag matches `package.json` `version`
2. Builds and verifies Windows and Linux packages on native runners
3. Writes SHA-256 checksum files
4. Publishes a **prerelease** with both installers

The landing page (`packages/landing`) must advertise an asset only after it is live. Set `available` on that artifact in `packages/landing/src/config/site.ts`, then `npm run landing:verify-downloads` before deploying the site.

## Release gate

From a clean checkout:

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
test:rust
test:run
test:renderer:run
test:engine
test:engine-ipc
smoke:engine-packaged
```

Coverage (optional locally; CI static lane publishes reports):

```bash
npm run test:coverage
```

### CI (`.github/workflows/release-gate.yml`)

| Lane | Matrix | Purpose |
|------|--------|---------|
| Static and coverage | Ubuntu, Node 22 | typecheck, lint, architecture, V8 coverage |
| Native and integration | Windows + Ubuntu × Node 22 + 24 | clean install, Node natives, desktop/renderer/engine/engine-ipc |
| Rust | Windows + Ubuntu | `cargo test --locked` |
| Package verification | Windows + Ubuntu, Node 22 | packaged engine smoke + unpack verify |

Host Node for development and packaging: **22.12–24** (default **22**). Ledger: [test-review-ledger.md](./test-review-ledger.md).

## Package on a clean checkout

```bash
npm install
npm run rebuild:native:electron
```

Windows:

```bash
npm run package:win
npm run package:win:dir
npm run verify:win-package
npm run qa:clean-install:win   # fresh NSIS + backend harness
```

Linux:

```bash
npm run package:linux
npm run package:linux:dir
npm run verify:linux-package
```

`qa:clean-install:win` does **not** drive the renderer. Interactive sign-off stays in [manual-qa.md](./manual-qa.md).

## What is bundled

- `dist/` main, preload, renderer
- Electron-native `better-sqlite3` and `node-pty` (asar-unpacked)
- Performance engine from `packages/engine/dist` → `resources/engine/`, plus Electron-built `better-sqlite3` and `commander` under `resources/engine/node_modules/`

The landing site is **not** inside the desktop app.

## Metadata

| Item | Value |
|------|--------|
| `appId` | `com.devdesk.app` |
| `productName` | `DevDesk` |
| Version | `package.json` → `version` |
| Icons | `build/icon.png` / `build/icon.ico` (`npm run icons:generate`) |

## Code signing (not in beta)

Private beta builds are **unsigned**:

- **Windows:** SmartScreen may warn. Authenticode (`CSC_LINK` / `CSC_KEY_PASSWORD`) is deferred.
- **macOS:** Not a 0.1 target.
- **Linux:** No signing required for deb in this beta.

Do not claim signed installers until secrets and CI are in place.

## Manual packaged checks

Full table: [manual-qa.md](./manual-qa.md). Minimum after install or unpacked launch:

1. App starts without DevTools and the renderer loads
2. A project survives restart (SQLite in userData)
3. Terminal tab opens
4. Engine index/search on a sample project
5. Docker missing still degrades cleanly

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
