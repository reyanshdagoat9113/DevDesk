# Rules 
1. If todo.md is mentioned in a prompt and if it is said so to finish dash task mentioned in todo.md, once completed kindly put the task as completed in todo.md. 
2. Keep the current organized folder and file structure.
3. While committing changes, if a task in TODO.md has been completed, mention it. For example, "completed X task from TODO.md." Then add the task's description and then mention other things in the commit.


# CLAUDE.md


## Common Commands

```bash
# No runtime/build commands yet; implementation code has been removed.
```

## Architecture

DevDesk is intended to be an Electron app with a three-layer architecture when implementation resumes:

### Process Boundaries

- **Main Process**: Node.js + TypeScript. Full system access. Runs commands, talks to Docker CLI, reads filesystem, persists data.
- **Renderer Process**: TypeScript + React. UI only. Cannot access Node APIs directly. Sends intent-based requests via IPC.
- **Preload Layer**: Context bridge that exposes a whitelist of safe APIs to the renderer. Enforces security boundaries.

Implementation note: keep the main entry thin and push logic into submodules to avoid a single large file.

### Communication Flow

```
Renderer (React UI)
    → window.electronAPI (via preload)
    → IPC handlers
    → Main Process handlers
    → System (Docker CLI, shell, fs)
```

The preload layer should only expose explicitly defined channels. New IPC channels must be added to both the preload script and main process handlers.

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
- Renderer config (React, ESNext with bundler module resolution)
- Main process config (CommonJS for Electron)

### Building

The build process:
1. Compile main process TypeScript
2. Bundle renderer
3. Bundle preload script

### Non-Goals

Do not add: AI features, team collaboration, cloud sync, full terminal replacement, heavy analytics. These are explicitly called out as anti-patterns in the README.
