# DevDesk - Electron App Overview

A local-first Electron desktop app for developers that combines a Project Manager, Command Vault, and Docker/Compose Manager into one clean, fast workspace.

## Status (2026-01-30)

Implemented:
- Electron shell + Vite renderer, shadcn/ui + Radix components.
- JSON persistence in userData (`devdesk-store.json`).
- Projects: add, detect type, open folder/IDE/terminal.
- Preferences for editor/terminal (custom command support).
- Command Vault: create/run/stop commands with tags + description.
- Run history with live output streaming + full output viewer.
- Project notes (ports/URLs/reminders).

In progress:
- Docker container integration (UI present, IPC stubbed).
- Command edit/delete + search UI.
- Project removal UI.
- Production build verification.

## Quick Start

- `npm run dev` - build main/preload, start Vite, launch Electron.
- `npm run build` - build main/preload and renderer bundle.

## Purpose

DevDesk exists to remove daily developer friction:
- Jump into projects without remembering commands.
- Reuse complex terminal commands safely.
- Control Docker containers and compose stacks visually.
- Keep a simple history of what you ran and when.

If it saves even 5 minutes per day, it is doing its job.

## Core Principles

- Local-first: everything runs on your machine.
- Deterministic: buttons do predictable things.
- Opinionated: optimized for solo dev workflows.
- Safe by default: destructive actions require intent.
- Fast UI: keyboard-first, minimal clicks.

## Core Features (The Combo)

### 1) Project Manager
- Add local project folders and detect project type.
- Open in editor/terminal or reveal in file explorer.
- Acts as the home screen of the app.

### 2) Command Vault
- Store frequently used terminal commands.
- Add descriptions and tags.
- Run commands in project context.

### 3) Containers (Docker + Compose)
- List running and stopped containers.
- Start, stop, and view logs.
- Graceful fallback when Docker is missing.

### 4) Run History
- Shows what commands were run.
- Displays status (running / success / failed / stopped).
- Allows stopping long-running commands.
- Provides access to output for sharing or debugging.

### 5) Project Notes
- Lightweight notes for ports, URLs, and reminders tied to a project.

## How the App Works (High-Level)

- Main process (Node.js + TypeScript)
  - Runs commands.
  - Talks to Docker.
  - Reads the filesystem.
  - Persists data locally.

- Renderer (TypeScript + React)
  - Displays UI.
  - Sends intent-based requests (run, stop, list, etc.).
  - Never accesses Node APIs directly.

- Preload layer
  - Exposes a small, safe API to the renderer.
  - Enforces security boundaries.

## Data Storage

Data lives in a single JSON store in the Electron userData directory:
- File: `devdesk-store.json`
- Schema: `apps/desktop/data/model.ts`

Containers are runtime-only and not persisted.

## MVP Scope (Target)

- Add and list projects.
- Create and run saved commands.
- See Docker containers and logs.
- View and stop running commands.
- View run history with output access.
- Edit simple project notes (ports, URLs, reminders).

## Possible Future Enhancements (Optional)

- Command presets per project.
- Port usage inspector.
- Lightweight Git status per project.
- Tray mode with quick actions.
- Export/import configuration.
- Profiles for different machines.

## Non-Goals

- AI features or assistants.
- Team collaboration.
- Cloud sync.
- Full terminal replacement.
- Heavy analytics.

## Definition of Done (V1)

- You can open DevDesk and immediately:
  - pick a project
  - run a command
  - manage a container
- No setup wizard required.
- App feels fast and predictable.
- You would actually keep it installed.

## Final Note

DevDesk is not about doing everything. It is about becoming the one place you open before the terminal.
