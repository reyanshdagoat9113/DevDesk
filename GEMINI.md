# GEMINI.md - Developer Guide for DevDesk

This document provides a concise overview of the DevDesk project structure, coding standards, and common tasks for the Gemini CLI agent.

## Project Overview
DevDesk is a local-first Electron application for developers, integrating project management, command automation, Docker/container control, and lightweight git insights.

- **Tech Stack:** Electron, React, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Docs:** Start at `docs/README.md` (user guide, architecture, install, release).
- **Architecture:**
  - `apps/desktop/`: Main process (Node.js/TS). Handles system interaction, IPC, and persistence.
  - `apps/renderer/`: Renderer process (React/TS). Handles UI and user interaction.
  - `apps/desktop/preload.ts`: Preload script for secure IPC exposure.
  - `packages/engine/`: `devdesk-engine` workspace package (local code intelligence), packaged into app `resources/engine/`.
  - `packages/ipc-contracts/`: Shared IPC channel names.
  - `packages/landing/`: Public install page (not inside the desktop app).

## Common Commands

```powershell
# Development
npm run dev          # Build main/preload, start Vite, and launch Electron
npm run dev:renderer # Start only the Vite dev server

# Building
npm run build         # Build all components for production
npm run build:main    # Build main process (tsc)
npm run build:preload # Build preload script (tsc)
npm run build:renderer # Build renderer (vite)

# Testing (vitest)
npm run test:run          # Desktop (main process) tests
npm run test:renderer:run # Renderer tests
npm run test:engine       # Engine workspace tests
npm run test:engine-ipc   # Electron-to-engine IPC tests

# Release / verification
npm run release:gate           # Full gate: typecheck + lint + all tests + engine smoke
npm run smoke:engine-packaged  # Verify packaged engine path and real engine operations
npm run verify:win-package     # Build and smoke-test the Windows package
npm run verify:linux-package   # Build and smoke-test the Linux package
npm run package:win            # Windows NSIS installer under release/
npm run package:linux          # Linux x64 .deb under release/

# Native ABI (see docs/native-modules.md)
npm run rebuild:native:node     # Before Node-based tests
npm run rebuild:native:electron # Before running/packaging the app

# Quality & Type Safety
npm run lint          # Run ESLint
npm run lint:architecture
npm run typecheck     # Run TypeScript type checking
```

## Key Guidelines

### UI & Styling
- Use **Tailwind CSS** for all styling.
- Utilize **shadcn/ui** and **Radix UI** primitives located in `apps/renderer/app/components/ui`.
- Follow the existing design language (clean, fast, developer-centric).
- Use the `cn` utility from `apps/renderer/lib/utils.ts` for conditional classes.

### Code Structure
- **Main Process:**
  - Register IPC handlers in `apps/desktop/ipc/registerIpc.ts`.
  - Data models are in `apps/desktop/data/model.ts`.
  - Persistence logic is in `apps/desktop/data/store.ts`.
- **Renderer Process:**
  - Components are in `apps/renderer/app/components`.
  - Main sections are in `apps/renderer/app/sections`.
  - Layout components are in `apps/renderer/app/layout`.

### IPC Conventions
- Channel names live in `packages/ipc-contracts/src/channels.ts`.
- Handlers register in `apps/desktop/ipc/` and are exposed through `window.electronAPI`.
- Avoid direct Node access in the renderer.

### Data & Persistence
- SQLite (`better-sqlite3`) in Electron userData as `devdesk.db` (WAL).
- One-time import from `devdesk-store.json` when the preferences table is empty.
- Engine indexes: `userData/engine/*.sqlite`.

## Development Principles
1. **Local-first:** No cloud dependencies or external tracking.
2. **Safe by Default:** Confirm destructive actions (deletion, etc.).
3. **Deterministic:** Predictable UI behavior and command execution.
4. **Performance:** Ensure the UI remains responsive, especially during long-running commands.

## Current Release State (v0.1.2 private beta)
Product features are complete, including:
- Projects, Command Vault (variables/presets/chains/triggers), run history, notes
- Embedded terminals, health checks, git workspace, Docker/compose awareness
- Packaged engine (index/search/stats/Git insights) with smoke-verified operations
- SQLite-backed app persistence (one-time import from legacy JSON store)
- Export/import, tray quick actions, LLM context export, bug recorder
- Windows NSIS installer (unsigned); Linux x64 `.deb`

Remaining launch work (release-process only):
- Interactive packaged-app QA on Windows + Linux (`docs/manual-qa.md`)
- Optional: Windows code signing, auto-update decision; macOS deferred
