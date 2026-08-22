# `@devdesk/ipc-contracts`

Runtime-neutral list of Electron IPC channel names used by DevDesk main and preload.

- Source: `src/channels.ts`
- Build: `npm run build:ipc-contracts` (also part of `prebuild` / `pretypecheck`)
- No Electron imports — safe for any process that needs the string constants

Add new channels here first, then wire handlers and preload. Do not invent ad-hoc channel strings in feature code.
