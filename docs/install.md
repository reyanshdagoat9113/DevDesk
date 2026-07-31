# Installation and platform support

**Product version:** `0.1.1` (private beta)
**Related:** [release.md](./release.md) · [native-modules.md](./native-modules.md) · [manual-qa.md](./manual-qa.md)

## Supported platforms

| Platform | Installer / package | Arch | Status |
|----------|---------------------|------|--------|
| Windows 10/11 | NSIS `.exe` (`DevDesk-0.1.1-win-x64.exe`) | x64 | Primary beta target |
| Linux | `.deb` (`DevDesk-0.1.1-linux-x64.deb`) | x64 | Supported |
| macOS | — | — | **Not available** in this beta |

## End-user install (binary)

### Windows

1. Download `DevDesk-<version>-win-x64.exe` from [GitHub Releases](https://github.com/reyanshdagoat9113/DevDesk/releases) (or the public install page once the `packages/landing` site is deployed).
2. Run the installer. You may see a **SmartScreen** warning because beta builds are **unsigned** — use “More info” → “Run anyway” only if you trust the build source.
3. Launch **DevDesk** from the Start Menu or desktop shortcut.
4. Optional portable-style test without installing: run `DevDesk.exe` from an unpacked `win-unpacked` directory.

### Linux

1. Download `DevDesk-*-linux-x64.deb` from [GitHub Releases](https://github.com/reyanshdagoat9113/DevDesk/releases).
2. Install it with `sudo dpkg -i DevDesk-*-linux-x64.deb` (or open it with your package installer).
3. If dependencies are reported as missing, run `sudo apt-get -f install` and retry the install.

### First launch

- No account or cloud setup is required.
- Data is stored only on the local machine (see [data-locations.md](./data-locations.md)).
- If you previously used a JSON store, the app imports `devdesk-store.json` into SQLite once when the database is empty.

## Developer install (from source)

A single DevDesk clone is enough. The performance engine is packaged as `packages/engine` (`devdesk-engine`) in the root npm workspace.

```bash
cd DevDesk
npm install
npm run rebuild:native:electron
npm run dev
```

### Prerequisites

| Tool | Windows | Linux | Why |
|------|---------|-------|-----|
| Node.js 22.12–24 (22 default; see `.nvmrc`) | Yes | Yes | App, tests, packaging |
| Visual Studio Build Tools (C++) | Yes | — | Native modules |
| `build-essential` + python3 | — | Yes | Native modules |
| Git | Yes | Yes | Some native package scripts |
| Rust (`cargo`) | For engine binary builds | Same | `npm run build:engine` |

Details and troubleshooting: [native-modules.md](./native-modules.md).

## Build release artifacts from source

```bash
npm run rebuild:native:electron
npm run package:win      # on Windows → release/*.exe
npm run package:linux    # on Linux → .deb
```

Verify:

```bash
npm run verify:win-package    # Windows
npm run verify:linux-package  # Linux
npm run release:gate          # full automated baseline
```

## Uninstall

- **Windows:** Settings → Apps → DevDesk, or the installer uninstaller. User data under `%APPDATA%\DevDesk` is **not** always removed; delete it manually if you want a clean slate.
- **Linux deb:** `sudo apt remove devdesk` (package name may vary by artifact metadata). Remove user data under `~/.config/DevDesk` if present.

## Known install limitations (beta)

- Windows builds are **unsigned**.
- No auto-update channel.
- No macOS builds.
- Docker features need Docker (or WSL Docker) installed separately; the app still runs without it.
