# Installation and platform support

**Product version:** 0.1.5 (private beta)
**Related:** [user-guide.md](./user-guide.md) · [release.md](./release.md) · [native-modules.md](./native-modules.md) · [data-locations.md](./data-locations.md)

## Supported platforms

| Platform | Package | Arch | Status |
|----------|---------|------|--------|
| Windows 10/11 | NSIS `DevDesk-0.1.5-win-x64.exe` | x64 | Primary |
| Linux (Debian/Ubuntu family) | `DevDesk-0.1.5-linux-x64.deb` | x64 | Supported |
| macOS | — | — | Not shipped |

Downloads: [GitHub Releases](https://github.com/reyanshdagoat9113/DevDesk/releases). Checksums ship as SHA-256 files on the same release.

## End-user install

### Windows

1. Download `DevDesk-<version>-win-x64.exe`.
2. Run the installer. **SmartScreen** may warn because beta builds are **unsigned** — “More info” → “Run anyway” only if you trust the source.
3. Launch **DevDesk** from the Start Menu or desktop shortcut.
4. Portable check without installing: `release\win-unpacked\DevDesk.exe` (from a local package) or the unpacked artifact from CI.

### Linux

1. Download `DevDesk-*-linux-x64.deb`.
2. `sudo dpkg -i DevDesk-*-linux-x64.deb` (or open it in your package installer).
3. If dependencies are missing: `sudo apt-get -f install`, then retry.

### First launch

- No account or network setup.
- Data stays on the machine ([data-locations.md](./data-locations.md)).
- A previous JSON store (`devdesk-store.json`) is imported into SQLite once when the database has no preferences row.
- Docker is optional. Container features need Docker Desktop or a running daemon; everything else works without it.
- Git features need `git` on `PATH`. Editor/terminal “open” actions use Preferences.

How to use the workspace: [user-guide.md](./user-guide.md).

## Developer install (from source)

One clone is enough. The engine is `packages/engine`.

```bash
cd DevDesk
npm install
npm run rebuild:native:electron
npm run dev
```

Requires **Node.js 22.12–24** (default 22; `.nvmrc`).

| Tool | Windows | Linux | Why |
|------|---------|-------|-----|
| Node.js 22.12–24 | Yes | Yes | App, tests, packaging |
| Visual Studio Build Tools (C++) | Yes | — | Native modules |
| `build-essential` + python3 | — | Yes | Native modules |
| Git | Yes | Yes | App Git features + some native scripts |
| Rust (`cargo`) | For engine binary builds | Same | `npm run build:engine` |

Details: [native-modules.md](./native-modules.md). Contributor flow: [../CONTRIBUTING.md](../CONTRIBUTING.md).

## Build installers from source

```bash
npm run rebuild:native:electron
npm run package:win      # Windows host → release/*.exe
npm run package:linux    # Linux host → .deb
```

```bash
npm run verify:win-package    # Windows
npm run verify:linux-package  # Linux
npm run release:gate          # full automated baseline
```

## Uninstall

- **Windows:** Settings → Apps → DevDesk, or the installer uninstaller. `%APPDATA%\DevDesk` is **not** always removed — delete it for a clean slate.
- **Linux:** `sudo apt remove devdesk` (package name follows electron-builder metadata). Remove `~/.config/DevDesk` if you want user data gone.

## Known limits (beta)

- Windows builds are unsigned.
- No auto-update channel — install a newer GitHub Release by hand.
- No macOS builds.
- Bug attachment **files** are not inside JSON export (copy `attachments/` yourself).
