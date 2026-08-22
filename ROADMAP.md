# DevDesk roadmap

**Last updated:** 2026-08-22  
**Current line:** v0.1.2 private beta — feature-complete for the shipped workspace; launch QA still open

This file is the **live** plan. Historical implementation specs (phases 0–10 as originally written) are in `New-features.md`, `Plans-for-features.md`, and `docs/planning/`. Do not treat those as the task queue.

## Shipped in 0.1.x

| Area | In the product |
|------|----------------|
| Foundation | Electron + Vite, shadcn/ui, SQLite WAL, command palette |
| Projects | CRUD, pin, type detection, WSL paths, file search, editor/folder/terminal |
| Command Vault | CRUD, tags, presets, variables, pin, ad-hoc run, history streaming |
| Automation | Chains, triggers (`onStartup`, `onProjectOpen`, `afterContainerStart`) |
| Terminals | Tabs, resize, search, fullscreen, `node-pty` |
| Health & notes | Inspector, check history, markdown preview, tasks, runnable fences |
| Git | Status, changed files, file diff, commit all, push, PR URL, palette actions |
| Containers | List/start/stop/logs, linked stacks, Compose labels, missing-Docker UX |
| Engine | Index profiles, FTS/regex search, stats, Git insights, packaged spawn |
| Desktop | Tray, export/import with DB backup, bug recorder, local LLM bundle |
| Release engineering | Native rebuild scripts, release gate, CI, Windows NSIS, Linux deb, tag publish |

## Open (launch)

Tracked in [TODO.md](TODO.md) and [docs/beta-release-checklist.md](docs/beta-release-checklist.md):

- Interactive packaged-app QA rows on Windows and Linux ([docs/manual-qa.md](docs/manual-qa.md))
- Optional: Windows Authenticode signing
- Optional: auto-update channel (or keep “manual downloads only”)
- macOS packaging and notarization — **deferred**, not a 0.1 claim

## Later (not blocking beta)

These are real gaps, not leftover “planned” phases from the old roadmap:

| Idea | Notes |
|------|--------|
| Selective Git staging | Commits currently `git add -A` |
| Richer container log search | Live stream exists; in-log filter is thin |
| Parallel chain steps / `onSchedule` triggers | Sequential chains and three event types only |
| Engine watch / incremental-on-save | Manual index / reindex today |
| OS-wide hotkeys | Shortcuts work only while focused |
| Desktop notifications | Command/container completion toasts |
| Export of bug attachment **files** | JSON export is metadata-only |
| Broader packaged E2E | UI paths still mostly manual QA |

## Platforms

| Platform | Intent |
|----------|--------|
| Windows x64 | Primary |
| Linux x64 (deb) | Supported |
| macOS | Deferred |

## Principles (do not regress)

- Local-first: no accounts, analytics, or required network services
- Explicit shell: no implicit command runs
- Confirm destructive actions
- Renderer stays UI-only; main owns Node and natives
