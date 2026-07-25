# Contributing to DevDesk

Thanks for helping improve DevDesk.

## Development setup

Clone this repository only. The performance engine is at `packages/engine` and is linked via the root npm workspace.

```bash
npm install
npm run rebuild:native:electron
npm run dev
```

Windows native builds need Visual Studio Build Tools (C++), Python 3, and Git.
See [docs/native-modules.md](docs/native-modules.md) and [docs/install.md](docs/install.md).

## Verification

Before opening a pull request, run:

```bash
npm run rebuild:native:node
npm run release:gate
```

When packaging changes:

- Windows: `npm run verify:win-package` (and optionally `npm run package:win`)
- Linux: `npm run verify:linux-package` (and optionally `npm run package:linux`)

Maintainer release steps: [docs/beta-release-checklist.md](docs/beta-release-checklist.md).  
Packaging details: [docs/release.md](docs/release.md).

## Guidelines

- Keep changes local-first and deterministic.
- Prefer small, focused commits.
- Update docs when behavior or release expectations change (install, data locations, release notes).
- If you touch the engine or packaging flow, verify the packaged smoke tests.
- Do not rebuild Electron natives for Node tests (or the reverse); use the scripts in `docs/native-modules.md`.
- Do not list completed launch items as open work in `TODO.md` / `ROADMAP.md`.
