# Module Boundaries

## Desktop
- `apps/desktop/data` owns persistence, normalization, and schema migration.
- `apps/desktop/ipc` owns Electron IPC handlers and runtime orchestration.
  - Prefer domain registrars under `apps/desktop/ipc/handlers/*` (one domain per module).
  - Shared in-memory maps live in `apps/desktop/ipc/runtimeState.ts`.
  - `registerIpc.ts` should shrink toward a thin orchestrator that calls domain registrars.
- `apps/desktop/engine` owns file indexing, search, and engine runtime integration.
- `apps/desktop/git` owns git-specific runtime and service logic.
- `apps/desktop/files` owns file listing, search, and editor/reveal helpers.
- `apps/desktop/projects` owns project classification and discovery helpers.

## Renderer
- `apps/renderer/app` owns React composition, feature screens, dialogs, and hooks.
- `apps/renderer/app/components/ui` contains reusable low-level UI primitives only.
- `apps/renderer/app/sections` contains feature-level page sections and should stay thin.

## Rules
- Keep domain logic close to the domain folder.
- Extract shared code only when it is used in more than one place.
- Avoid generic filenames such as `helpers.ts`, `misc.ts`, and `temp.ts`.
- Prefer thin orchestration files over catch-all modules.
- Keep new files aligned to feature or runtime ownership, not arbitrary utility buckets.
