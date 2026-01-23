# Rules 
1. If todo.md is mentioned in a prompt and if it is said so to finish dash task mentioned in todo.md, once completed kindly put the task as completed in todo.md. 
2. Keep the current organized folder and file structure.


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server
npm run build            # Build main process TypeScript and bundle renderer
```

## Architecture

DevDesk is an Electron app with a three-layer architecture:

### Process Boundaries

- **Main Process** (`src/main/`): Node.js + TypeScript. Has full system access. Runs shell commands, talks to Docker CLI, reads filesystem, persists data.
- **Renderer Process** (`src/renderer/`): TypeScript + React. UI only. Cannot access Node APIs directly. Sends intent-based requests via IPC.
- **Preload Layer** (`src/main/preload.ts`): Context bridge that exposes a whitelist of safe APIs to the renderer. Enforces security boundaries.

Implementation note: keep `src/main/index.ts` as a thin bootstrap and put most main-process logic into submodules (e.g., `src/main/app/`, `src/main/projects/`) to avoid a single large entry file.

### Communication Flow

```
Renderer (React UI)
    → window.electronAPI.send()
    → IPC (via preload)
    → Main Process handlers
    → System (Docker CLI, shell, fs)
```

The preload layer only exposes channels explicitly listed in the `validChannels` array. New IPC channels must be added to both the preload script and main process handlers.

### Core Features

1. **Project Manager**: Auto-detects project type (node/python/rust/go) from presence of package.json, pyproject.toml, Cargo.toml, go.mod
2. **Command Vault**: Stores terminal commands with variables support (`{{container}}` syntax). Can run globally or in project context.
3. **Containers**: Docker CLI wrapper. Lists, starts, stops containers. Must gracefully degrade if Docker not installed.
4. **Run History**: Tracks command execution status (running/success/failed/stopped). Allows stopping long-running commands and viewing output.
5. **Project Notes**: Lightweight notes for ports, URLs, and reminders tied to a project.

### Key Constraints

- **Local-first only**: No cloud, no accounts, no AI
- **Safe by default**: Destructive actions require user confirmation
- **Platform targets**: macOS + Windows (Linux is post-MVP)
- **Don't overbuild**: MVP is defined in README. Future enhancements are explicitly optional.

### MVP Scope

- Add and list projects
- Create and run saved commands
- See Docker containers and logs
- View and stop running commands
- View run history with output access
- Edit simple project notes (ports, URLs, reminders)

### TypeScript Configuration

Two separate configs:
- `tsconfig.json` → Renderer (React, ESNext with bundler module resolution)
- `tsconfig.main.json` → Main process (CommonJS for Electron, outputs to `dist/main/`)

### Building

The build process:
1. Compiles main process TypeScript to `dist/main/`
2. Vite bundles renderer and builds to `dist/renderer/`
3. Preload script is bundled separately

### Non-Goals

Do not add: AI features, team collaboration, cloud sync, full terminal replacement, heavy analytics. These are explicitly called out as anti-patterns in the README.
