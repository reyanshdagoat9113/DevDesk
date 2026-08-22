# Module boundaries

High-level process model: [../architecture.md](../architecture.md). Architecture lint: `npm run lint:architecture` (`scripts/check-architecture.mjs`).

## Desktop (`apps/desktop`)

| Folder | Owns |
|--------|------|
| `data/` | Persistence, normalization, schema, export/import |
| `ipc/` | Electron IPC: `handlers/*` (one domain per file), `runtimeState.ts`, thin `registerIpc.ts` |
| `engine/` | Spawn packaged engine, index/search/stats/git insights |
| `git/` | Git CLI wrapper, diff, commit, push, PR URL |
| `files/` | List/search inside a project, editor/reveal helpers |
| `projects/` | Type detection and related helpers |
| `commands/` | Variable detect/resolve |
| `system/` | Command process runner |
| `terminal/` | `node-pty` session manager |
| `health/` + `projectIntelligence/` | Environment and project health |
| `bugs/` | Attachments and context snapshots |
| `tray/` | Tray icon and menu |
| `llm/` | Local context bundle |
| `preload.ts` | `contextBridge` API only |

## Renderer (`apps/renderer`)

| Folder | Owns |
|--------|------|
| `app/sections/` | Feature screens (keep thin) |
| `app/components/` | Feature widgets and dialogs |
| `app/components/ui/` | Low-level shadcn/Radix primitives only |
| `app/layout/` | App chrome, shortcuts help |
| `app/lib/` | Pure UI helpers (`appShell`, markdown) |
| `lib/utils.ts` | `cn()` |

## Packages

| Package | Owns |
|---------|------|
| `packages/engine` | Indexer CLI and Rust scanner — not Docker, tray, or UI |
| `packages/ipc-contracts` | Channel name constants — no Electron imports |
| `packages/landing` | Public install site — not loaded by the desktop app |

## Rules

- Keep domain logic in the domain folder.
- Extract shared code only when a second caller exists.
- Avoid catch-all names (`helpers.ts`, `misc.ts`, `temp.ts`).
- Prefer thin orchestration files.
- Renderer must not import `apps/desktop` or Node builtins.
- New IPC channels go through `@devdesk/ipc-contracts`, then preload, then UI.
