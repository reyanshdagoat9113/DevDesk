# Data Model (MVP)

This is the current data model used by the app. It matches `apps/desktop/data/model.ts`.

## Core Entities

### Project
- `id`: unique id (string)
- `path`: filesystem path
- `name`: display name
- `type`: `node | python | rust | go | unknown`
- `icon`: display icon (string)

### Command
- `id`
- `name`
- `command`: shell command template
- `description?`
- `tags?`: string[]
- `projectId?`: string
- `workingDirectory?`: string (relative to project root)

### Container (runtime-only)
- `id`
- `name`
- `image`
- `state`: `running | stopped | paused`
- `ports`: string[]

### Run History Entry
- `id`
- `commandId`
- `projectId?`
- `status`: `running | success | failed | stopped`
- `startTime`: ISO string
- `endTime?`: ISO string
- `output?`: string

### Project Notes
- `projectId`
- `setupSteps`: string (multiline)
- `todos`: string (multiline)
- `reminders`: string (multiline)

### App Preferences
- `editor`: `{ id: string, command?: string }`
- `terminal`: `{ id: string, command?: string }`

## Persisted Store

Stored locally as a single versioned object in userData (`devdesk-store.json`):

- `version`: 2
- `projects`: Project[]
- `commands`: Command[]
- `runHistory`: RunHistoryEntry[]
- `notes`: Record<string, ProjectNotes>
- `preferences`: AppPreferences

Containers are fetched from Docker at runtime and are not persisted in the store.

## Planned SQLite Store (better-sqlite3)

The app will migrate to a local SQLite database for reliability and performance. The database
will live in the same userData directory as `devdesk-store.json`.

File:
- `devdesk.db`

Mode:
- WAL enabled for durability and concurrent reads.
- Single-writer from the main process.

Schema (initial mapping):

### projects
- `id` TEXT PRIMARY KEY
- `path` TEXT NOT NULL
- `name` TEXT NOT NULL
- `type` TEXT NOT NULL
- `icon` TEXT NOT NULL

### commands
- `id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `command` TEXT NOT NULL
- `description` TEXT
- `tags` TEXT (JSON array)
- `project_id` TEXT
- `working_directory` TEXT

### run_history
- `id` TEXT PRIMARY KEY
- `command_id` TEXT NOT NULL
- `project_id` TEXT
- `status` TEXT NOT NULL
- `start_time` TEXT NOT NULL
- `end_time` TEXT
- `output` TEXT

### notes
- `project_id` TEXT PRIMARY KEY
- `setup_steps` TEXT
- `todos` TEXT
- `reminders` TEXT

### preferences
- `id` TEXT PRIMARY KEY CHECK (id = 'app')
- `editor_id` TEXT NOT NULL
- `editor_command` TEXT
- `terminal_id` TEXT NOT NULL
- `terminal_command` TEXT

Indexes:
- `commands_project_id_idx` on `commands(project_id)`
- `run_history_project_id_idx` on `run_history(project_id)`
- `run_history_command_id_idx` on `run_history(command_id)`
- `run_history_start_time_idx` on `run_history(start_time)`

Migration strategy:
- On startup, if `devdesk.db` does not exist and `devdesk-store.json` does, import JSON into SQLite.
- Keep JSON as a backup for one or two releases, then optionally remove.
