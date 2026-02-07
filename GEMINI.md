# GEMINI.md - Developer Guide for DevDesk

This document provides a concise overview of the DevDesk project structure, coding standards, and common tasks for the Gemini CLI agent.

## Project Overview
DevDesk is a local-first Electron application for developers, integrating project management, command automation, and Docker container control.

- **Tech Stack:** Electron, React, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Architecture:** 
  - `apps/desktop/`: Main process (Node.js/TS). Handles system interaction, IPC, and persistence.
  - `apps/renderer/`: Renderer process (React/TS). Handles UI and user interaction.
  - `apps/desktop/preload.ts`: Preload script for secure IPC exposure.

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

# Quality & Type Safety
npm run lint          # Run ESLint
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
- Use kebab-case for IPC channels (e.g., `projects:add`, `commands:run`).
- Define types in `apps/renderer/app/types/electron.d.ts` for the `window.electronAPI` bridge.

### Data & Persistence
- Currently uses a JSON store: `devdesk-store.json` in Electron's `userData`.
- Future plan: Migrate to SQLite (`better-sqlite3`).

## Development Principles
1. **Local-first:** No cloud dependencies or external tracking.
2. **Safe by Default:** Confirm destructive actions (deletion, etc.).
3. **Deterministic:** Predictable UI behavior and command execution.
4. **Performance:** Ensure the UI remains responsive, especially during long-running commands.

## Current Focus Areas (TODO)
- Command search/filter implementation.
- Improving Run History display (show names instead of IDs).
- Migrating persistence from JSON to SQLite (`better-sqlite3`).
- Production build verification and packaging.
