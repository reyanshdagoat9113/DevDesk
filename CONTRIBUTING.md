# Contributing to DevDesk

Thanks for helping improve DevDesk.

## Development setup

```bash
npm install
npm run rebuild:native:electron
npm run dev
```

Windows native builds need Visual Studio Build Tools (C++), Python 3, and Git.
See [docs/native-modules.md](docs/native-modules.md).

## Verification

Before opening a pull request, run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run test:renderer:run
npm run test:engine-ipc
npm run smoke:engine-packaged
```

On Linux, also run `npm run verify:linux-package` when packaging changes.

## Guidelines

- Keep changes local-first and deterministic.
- Prefer small, focused commits.
- Update docs when behavior or release expectations change.
- If you touch the engine or packaging flow, verify the packaged smoke tests.
- Do not rebuild Electron natives for Node tests (or the reverse); use the scripts in `docs/native-modules.md`.
