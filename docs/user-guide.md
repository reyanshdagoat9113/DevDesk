# DevDesk user guide

DevDesk is a local-first workspace: projects, saved commands, terminals, Docker, Git, and code search on one machine. Nothing is sent to a cloud account.

This guide describes the **0.1.2** desktop app. For installers see [install.md](./install.md). For where files live see [data-locations.md](./data-locations.md).

## Workspace

The left rail is the main navigation:

| Section | Purpose |
|---------|---------|
| **Projects** | Folders you manage: open, pin, health, notes, Git, files |
| **Commands** | Command Vault plus automation (chains and triggers) |
| **Engine** | Local index, full-text search, stats, Git insights |
| **Containers** | Docker list, start/stop, logs (optional; app runs without Docker) |
| **History** | Output of vault commands and chains |
| **Terminal** | Embedded shells (node-pty + xterm) |

The header holds the current **project context**. Many actions (run command, index, Git, notes) use that project unless you pick another.

**Quick Launcher** (`Ctrl+K` / `Cmd+K`) searches projects, commands, history, containers, and navigation from anywhere.

## Projects

1. **Add Project** and pick a folder (or type a path). On Windows you can also add a **WSL** distro path.
2. DevDesk detects type from files in the root: Node, Python, Rust, Go, or unknown.
3. Pin projects you use often; pinned items sort first in lists and the launcher.

From a project you can:

- Open the folder, your configured editor, or an external terminal.
- Link Docker containers and start / stop / restart the **dev stack**.
- Run a **health** inspection (lockfile, deps, Git, Compose file, suggested actions).
- Keep **notes** (markdown with preview and task checkboxes; fenced `bash:run` / `sh:run` blocks can run as commands).
- Browse and search files, then open in the editor (line/column when the editor supports it).
- Use the **Git** panel: branch, dirty files, file diff, commit all (`git add -A`), push, open a pull-request URL.

Removing a project only removes it from DevDesk. It does not delete the folder.

## Command Vault

Save shell commands once, bind them to a project or keep them global, then run them from the vault or the launcher.

- **Tags** — multi-select filters, including untagged.
- **Presets** — one-click common scripts for Node, Python, Rust, and Go.
- **Pin** — keep favorites at the top.
- **Working directory** — optional override; otherwise the bound project path is used.
- **Ad-hoc run** — run a one-off command without saving it.

Runs stream into **History**. You can stop a running command. Failed runs stay in history with output.

### Variables

Templates use `{{...}}` and are resolved just before spawn:

| Token | Resolves to |
|-------|-------------|
| `{{project.name}}` | Project name |
| `{{project.path}}` | Absolute project path |
| `{{project.type}}` | `node`, `python`, `rust`, `go`, or `unknown` |
| `{{container.name}}` | First linked container name |
| `{{container.names}}` | All linked container names, space-separated |
| `{{env.NAME}}` | Process environment variable `NAME` |
| `{{input}}` | Prompt at run time |
| `{{input:label}}` | Named prompt |
| `{{input:name:default}}` | Named prompt with default |

Unresolved `{{input}}` values open a prompt. Substituted values are shell-escaped. The **resolved** command (not the template) is stored on the history row.

## Automation

On the Commands workspace:

- **Chains** — ordered steps (saved commands), optional delay, per-step variable overrides, stop-on-failure. Progress and per-step output go to History.
- **Triggers** — run a chain on `onStartup`, `onProjectOpen`, or `afterContainerStart`. Optional confirmation before a destructive chain.

Triggers are local only. There is no cron / `onSchedule` event in this beta.

## Terminals

The Terminal section hosts interactive shells in the project (or a chosen) directory.

- New tab, resize with the pane, search (`Ctrl+F` in the terminal), clickable links.
- `Ctrl+\`` / `Cmd+\`` — open or focus Terminal from other sections (does not steal keys from an input or from xterm itself).
- `F11` — fullscreen the terminal workspace.
- Copy / paste: `Ctrl+Shift+C` / `Ctrl+Shift+V` in the terminal.

Sessions last while the app is open. They are not restored after quit.

## Containers

Needs the Docker CLI (Docker Desktop or a running daemon). If Docker is missing or stopped, DevDesk still launches and shows a recoverable message.

You can list containers, start / stop / restart / pause / unpause, remove (with confirmation), and subscribe to **live logs**. Compose project/service labels are shown when present. Health checks detect `docker-compose.yml` / `compose.yml` in a project; there is no separate Compose-up UI beyond running those commands from the vault or a terminal.

## Performance Engine

Indexes **text files under the selected project**. Indexes live in userData (`engine/<projectId>.sqlite`), not in the repo.

1. Pick a project and an **index scope**, then Index / Reindex.
2. Search with plain text or regex.
3. Open a hit in the editor.
4. Stats and Git insights (hotspots / recent churn) are available when Git is present.

| Profile | Default | What it indexes |
|---------|---------|-----------------|
| `source-first` | Yes | Source and config; skips docs-only, landing HTML, build artifacts |
| `source-docs` | No | Source plus documentation languages |
| `full-text` | No | All languages the engine already supports |

Ignore rules: engine scan honors `.gitignore` and common build dirs. An optional `.devdeskignore` at the **project root** applies extra gitignore-style excludes.

Clearing an index deletes that project’s engine database, not `devdesk.db`.

## History

Vault and chain runs appear here with status (`running`, `success`, `failed`, `stopped`), timestamps, and output. Clear or delete rows from the UI. On app start, any row still marked `running` is reconciled to `stopped`.

## Bugs

`Ctrl+Shift+B` / `Cmd+Shift+B` opens the recorder for the current project.

A report can include expected/actual result, steps, notes, a **context snapshot** (recent commands, environment, health, containers), and file **attachments**. Attachments are stored under userData `attachments/` — they are **not** packed into JSON export (metadata only).

## Settings

Preferences (gear):

- **Editor** — VS Code, Cursor, and similar, or a custom command using `{path}` (and line/column when the editor supports `--goto`).
- **Terminal** — external terminal command for “open in terminal”.
- **Tray** — optional tray icon with quick actions (open window, recent projects, last command, last dev stack, quit).

**Export / Import** writes a versioned JSON dump of the SQLite tables. Import can **merge** or **replace**. A `devdesk.db.backup-<timestamp>` file is created next to the database before import.

**LLM context** builds a local file bundle (project files + notes) you can copy into another tool. DevDesk does not call any AI API.

## Keyboard shortcuts

`?` in the sidebar opens the same list.

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+K` | Quick Launcher |
| `Ctrl/Cmd+\`` | New or focus terminal |
| `Ctrl/Cmd+Shift+B` | Report a bug |
| `F11` | Terminal fullscreen |
| `?` | Shortcut help |

There is no OS-wide hotkey in this beta; shortcuts work while DevDesk is focused.

## Privacy and safety

- No accounts, analytics, or cloud sync in the core product.
- Command output, paths, and bug snapshots live on disk — treat userData as sensitive.
- Destructive actions (remove project, replace import, remove container) ask for confirmation.
- Shell execution is explicit: you run a command, chain, runnable note, or terminal.
