# Contributing to DevDesk

Thanks for helping improve DevDesk.

## Development setup

```bash
npm install
npm run dev
```

## Verification

Before opening a pull request, run:

```bash
npm run typecheck
npm run build
npm run test:engine-ipc
npm run smoke:engine-packaged
npm run verify:linux-package
```

## Guidelines

- Keep changes local-first and deterministic.
- Prefer small, focused commits.
- Update docs when behavior or release expectations change.
- If you touch the engine or packaging flow, verify the packaged smoke tests.
