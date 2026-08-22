# Plans for features (historical)

> **Archive.** Implementation plans for [New-features.md](New-features.md). The work is in v0.1.x.  
> **Live plan:** [ROADMAP.md](ROADMAP.md) · [TODO.md](TODO.md) · [docs/beta-release-checklist.md](docs/beta-release-checklist.md)

Do not treat the steps below as the current task queue. Remaining launch work is interactive packaged QA, optional signing/macOS, and maintenance.

---

# Task 1: Global Command Palette

## Goal
Add a universal keyboard-first palette (Cmd/Ctrl+K) to navigate and trigger common actions across DevDesk (projects, commands, containers, navigation, history) while staying local-first, deterministic, and safe.

## Scope (Task 1)
- Open/close palette via `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux) from anywhere in the renderer.
- Search + execute grouped actions:
  - Projects: open project section, open in editor, open in terminal, open folder.
  - Commands: run a saved command (bound project or pick project if global).
  - Containers: start/stop/restart/pause/unpause (no destructive remove in palette for v1).
  - Navigation: switch between main tabs/sections.
  - History: jump to History tab and optionally focus/select a run.

## Non-goals (Defer)
- OS-wide hotkey + tray integration (belongs to tasks 9/10).
- Embedded terminal, file navigation, git intelligence (tasks 2-4).
- Editing entities inside palette beyond navigation/run (optional later).

## Dependencies
- Add packages:
  - `cmdk` for the command UI.
  - `fuse.js` for fuzzy search across multiple entity types.
- Optional (preferred): add a shadcn-style Command wrapper under `apps/renderer/app/components/ui` that composes `cmdk` with the existing `Dialog` wrapper.

## Data + IPC Plan

### Reuse existing APIs first (ship MVP)
Current preload API already exposes these (see `apps/desktop/preload.ts`):
- `getProjects()` (IPC: `projects:get`)
- `getCommands()` (IPC: `commands:get`)
- `getContainers()` (IPC: `containers:get`)
- `getRunHistory()` (IPC: `history:get`)
- `openProjectInEditor(id)` (IPC: `projects:open-editor`)
- `openProjectInTerminal(id)` (IPC: `projects:open-terminal`)
- `openProjectFolder(id)` (IPC: `projects:open-folder`)
- `runCommand(commandId, projectId?)` (IPC: `commands:run`)
- container actions `containers:start/stop/restart/pause/unpause`

This is sufficient to implement the palette UI without Main/Preload changes.

### Efficiency upgrade (recommended)
`history:get` returns `runHistory` entries that include `output` (potentially very large). The palette only needs metadata.

Add IPC endpoint:
- `history:listRecent(limit?: number)` -> return recent runs with NO output payload.
  - Shape: `{ id, commandId, projectId, status, startTime, endTime? }[]`

Optional spec-alignment aliases (keep existing endpoints for compatibility):
- `projects:list` -> alias of `projects:get`
- `commands:list` -> alias of `commands:get`
- `containers:list` -> alias of `containers:get`
- `terminal:openProjectTerminal` -> alias of `projects:open-terminal`
- `projects:openInEditor` -> alias of `projects:open-editor`

Update preload types (`apps/renderer/app/types/electron.d.ts`) and bridge (`apps/desktop/preload.ts`) only if new endpoints are added.

## Renderer Architecture

### Component placement
- Add `apps/renderer/app/components/CommandPaletteProvider.tsx` (or `CommandPalette.tsx` + hook) and mount it near the root of `apps/renderer/app/App.tsx` so it can access:
  - `projects`, `commands`, `containers`, `history` (or `history:listRecent` results)
  - navigation state: `activeTab`, `setActiveTab`
  - existing action handlers in `App.tsx` (run command, open editor/terminal/folder, container actions)

### Keyboard handling (safe)
- Register a `keydown` listener:
  - Trigger when `(metaKey || ctrlKey) && key.toLowerCase() === 'k'`.
  - Do not trigger when focused element is editable:
    - `input`, `textarea`, `select`, or `contentEditable`.
  - Call `preventDefault()` only when toggling the palette.
- Close rules:
  - `Escape` closes.
  - Selecting an item closes (even if action errors; surface error separately).

### Search model
- Normalize palette items in a `useMemo`:
  - `id` (stable)
  - `group` (Projects/Commands/Containers/Navigation/History)
  - `title`
  - `subtitle`
  - `keywords` (tags, project name, container image, status)
  - `action(): Promise<void>`
- Fuzzy ranking:
  - Use `Fuse` across all items; keys: `title`, `subtitle`, `keywords`.
  - Cap results (e.g. 50) and cap history input set (e.g. 20-50).
  - Use `useDeferredValue(query)` (or a small debounce) if needed.

### Grouped rendering
- Render in stable order:
  1) Navigation
  2) Projects
  3) Commands
  4) Containers
  5) History

### Action rules (safety + UX)
- Projects:
  - Only pass `project.id` to main for open editor/terminal/folder.
- Commands:
  - If `command.projectId` exists: run immediately via `window.electronAPI.runCommand(command.id)`.
  - If command is global (no `projectId`): require a second step to pick a project, then run via `runCommand(command.id, project.id)`.
  - No free-form shell entry in palette for v1.
- Containers:
  - Expose start/stop/restart/pause/unpause only.

### Error handling
- Wrap every `action()` with try/catch:
  - Show a short user-facing message (existing `Alert` pattern or a minimal toast).
  - Avoid stack traces in the UI.

### UI integration
- Prefer existing shadcn/Radix patterns:
  - Use the existing `Dialog` wrapper (`apps/renderer/app/components/ui/Dialog.tsx`) for the modal.
  - Add a cmdk wrapper component under `apps/renderer/app/components/ui` to centralize Tailwind styling.

## Main Process Plan (only if adding new endpoints)

### `history:listRecent`
- Add handler in `apps/desktop/ipc/registerIpc.ts`:
  - Read store, take first N entries (default 20-50, cap at 100).
  - Return entries without `output`.

### Aliases (optional)
- Implement spec-named endpoints as thin wrappers to existing ones; validate ids and cap limits.

## Preload Plan (only if adding new endpoints)
- Extend `ElectronAPI`:
  - `listRecentHistory(limit?: number)` -> `ipcRenderer.invoke('history:listRecent', limit)`.
- Update both:
  - `apps/desktop/preload.ts`
  - `apps/renderer/app/types/electron.d.ts`

## Security Considerations
- Palette triggers only already-allowed actions; no new generic IPC.
- Do not pass raw filesystem paths from renderer to main for privileged actions.
- Avoid returning large outputs to the palette.

## Performance Considerations
- Do not index run output.
- Bound result counts and rebuild Fuse index only when datasets change.

## Acceptance Criteria
- `Cmd/Ctrl+K` opens palette; `Esc` closes; Enter runs selection; arrow keys navigate.
- Search stays responsive with hundreds of items.
- Project open editor/terminal/folder works.
- Command runs; global commands require a project selection step.
- Container actions work.
- Palette does not require transferring/processing run output.

## Implementation Steps (Safe Order)
1. Add deps (`cmdk`, `fuse.js`) and a minimal palette modal UI.
2. Build palette items from in-memory state already loaded in `apps/renderer/app/App.tsx`.
3. Add grouped rendering, keyboard toggle, and action execution with error surfacing.
4. Add global-command project-pick sub-flow.
5. Add `history:listRecent` + preload bridge and switch palette history to lightweight data.
6. Run `npm run lint` and `npm run typecheck`.

## Manual Test Checklist
- Ctrl/Cmd+K does not trigger while typing in inputs/textareas.
- Palette opens from each tab; navigation actions land correctly.
- Project actions open editor/terminal/folder.
- Project-bound command runs and appears in History.
- Global command prompts for project and runs after selection.
- Large history outputs do not freeze palette open/search.

---

# Task 3: Project Search & File Navigation

## Note About Spec Completeness
`New-features.md` currently lists Task 3 in the table of contents but does not include a Task 3 section yet. The plan below treats Task 3 as:
- fast, keyboard-friendly file name navigation within a project
- optional lightweight content search (defer if not required)
- safe opening of files in the user’s configured editor

## Goal
Help users quickly find and open files inside a project (local or WSL) without leaving DevDesk, while keeping filesystem access constrained to known projects.

## Scope (MVP)
- File navigation by project:
  - browse folders (incremental) and list files for a selected directory
  - quick-open search by filename/path (fuzzy)
- Open file in external editor (preferred) using existing editor preference.
- Works for both Windows paths and WSL UNC project paths (`\\wsl.localhost\...`).
- Reasonable performance for medium/large repos (skip common heavy dirs).

## Non-goals (Defer)
- Full in-app file preview/editor.
- Full-text indexed search (ripgrep-like) across gigantic repos.
- Git-aware ignore fidelity identical to `git status` (basic ignore is fine for v1).
- Refactor/rename operations.

## Dependencies
- Renderer:
  - Reuse existing palette UI (cmdk) or add a dedicated “Files” view under Projects.
- Main (recommended libs):
  - `fast-glob` or `fdir` for fast directory traversal.
  - `ignore` to apply `.gitignore` plus a small default ignore set.

## Data + IPC Plan (Safe-by-Default)

### Principle
Renderer passes only `projectId` and relative paths/queries.
Main resolves to absolute paths using the stored `project.path` and validates boundaries.

### IPC endpoints
- `files:list` (args: `{ projectId: string, dir?: string }`)
  - Returns direct children of `dir` (default root): `{ name, relativePath, kind: 'file'|'dir' }[]`
  - Apply ignores (see below) and cap results (e.g. 2,000 entries) with a `truncated: boolean` flag.

- `files:search` (args: `{ projectId: string, query: string, limit?: number }`)
  - Returns fuzzy matches by path/name: `{ relativePath, kind, score? }[]` (no file contents)
  - Uses a cached file list/index per project for speed.

- `files:openInEditor` (args: `{ projectId: string, relativePath: string, line?: number, column?: number }`)
  - Opens editor at the file. For VS Code, prefer `code --goto <file>:<line>:<col>`.
  - For other editors, fall back to opening the project and revealing the file if supported; otherwise open the file path.

Optional (later):
- `files:searchContent` (args: `{ projectId, query, glob?, limit? }`) implemented via ripgrep when available.

### Ignore rules (MVP)
- Always ignore: `.git/`, `node_modules/`, `dist/`, `build/`, `.next/`, `out/`, `.turbo/`, `.cache/`.
- If `.gitignore` exists, apply it (best-effort) for search/list.

## Main Process Design

### Path safety
- Resolve `projectId` -> `project.path` using the store.
- For any `relativePath` input:
  - reject absolute paths
  - normalize and resolve: `resolved = path.resolve(projectRoot, relativePath)`
  - enforce boundary: `resolved` must be within `projectRoot` (case-insensitive on win32)
  - reject `..` traversal attempts

### Indexing strategy (fast + deterministic)
- Maintain an in-memory cache per project:
  - `fileList: string[]` of relative file paths
  - `lastIndexedAt` and `projectPathKey` to invalidate on project path change
- Index build triggers:
  - on first search
  - on explicit “Refresh index” action
  - optionally on interval (defer)
- Keep index bounded:
  - cap maximum files (e.g. 200k) and show a warning if exceeded.

### WSL considerations
- UNC file traversal (`\\wsl.localhost\...`) may be slower; avoid deep indexing unless requested.
- Provide a “Search uses index (may take time first run)” hint in UI.

## Preload API
Expose a minimal surface in `apps/desktop/preload.ts` and types in `apps/renderer/app/types/electron.d.ts`:
- `listProjectFiles(projectId, dir?)`
- `searchProjectFiles(projectId, query, limit?)`
- `openProjectFileInEditor(projectId, relativePath, line?, column?)`

No generic filesystem bridge.

## Renderer UX Plan

### Option A (recommended): integrate into existing Command Palette
- Add a “Files” mode/page inside `CommandPalette`:
  - `Find file in <project>` (requires selecting a project first)
  - show search results as you type
  - Enter opens in editor

### Option B: add a “Files” subview in Projects
- In `ProjectsSection`, add an “Explore” action:
  - left: folder tree (lazy loaded via `files:list`)
  - right: file list + search input
  - open file button / double click

### UX details
- Always display relative paths (stable) and show full path on hover.
- Show truncation indicators (e.g. “Showing first 2,000 items”).
- Provide “Reindex/Refresh” button for the file search index.

## Performance Considerations
- Avoid sending huge lists over IPC:
  - cap list/search results
  - prefer incremental listing (`files:list`) over full tree transfer
- In renderer, avoid storing massive arrays in state if not needed; paginate/virtualize if file lists get large.

## Security Considerations
- All filesystem operations are scoped to known projects by id.
- Boundary checks prevent path traversal and arbitrary file access.
- No file contents returned in MVP search endpoints.

## Acceptance Criteria
- User can browse a project’s directories and see files.
- User can search by filename/path and open a file in the configured editor.
- `relativePath` inputs cannot escape the project root.
- Works for both Windows and WSL projects.
- Search/list remain responsive on typical repos; heavy directories are ignored.

## Implementation Steps (Safe Order)
1. Main: implement path resolution + boundary guard helpers.
2. Main: add `files:list` IPC with ignore + caps.
3. Main: add indexing + `files:search` IPC.
4. Main: add `files:openInEditor` using existing editor preference logic.
5. Preload: expose typed APIs.
6. Renderer: add UI (Palette “Files” mode or Projects “Explore” view).
7. Manual test + `npm run lint` + `npm run typecheck`.

## Manual Test Checklist
- Browse project root: ignores `.git` and `node_modules`.
- Attempt to open `..\\..\\Windows\\System32` via relativePath: rejected.
- Search for a known file; open in editor lands on correct file.
- WSL project: list/search works and open in editor works (at least VS Code).
