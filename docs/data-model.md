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
- `ports`: string (multiline, one per line)
- `urls`: string (multiline, one per line)
- `reminders`: string (multiline)

### App Preferences
- `editor`: `{ id: string, command?: string }`
- `terminal`: `{ id: string, command?: string }`

## Persisted Store

Stored locally as a single versioned object in userData (`devdesk-store.json`):

- `version`: 1
- `projects`: Project[]
- `commands`: Command[]
- `runHistory`: RunHistoryEntry[]
- `notes`: Record<string, ProjectNotes>
- `preferences`: AppPreferences

Containers are fetched from Docker at runtime and are not persisted in the store.
