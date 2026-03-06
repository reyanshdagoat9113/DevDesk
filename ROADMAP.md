# DevDesk Development Roadmap

> A comprehensive implementation guide for evolving DevDesk from MVP to a complete developer workspace platform.

**Last Updated:** 2026-03-02  
**Current Phase:** Phase 2 Complete → Phase 3.1 Next

---

## Legend

- ✅ Complete
- 🚧 In Progress
- ⏳ Ready to Start
- 📋 Planned
- 🔮 Future Consideration

---

## Phase 0: Foundation ✅ COMPLETE

Core infrastructure and MVP features. This phase is fully complete.

| Feature | Status | Notes |
|---------|--------|-------|
| Electron + Vite architecture | ✅ | Main + Preload + Renderer processes |
| shadcn/ui + Tailwind CSS | ✅ | Design system with dark/light themes |
| SQLite persistence | ✅ | `better-sqlite3` with WAL mode, migrated from JSON |
| Project management | ✅ | Add/edit/remove, type detection (node/python/rust/go) |
| Command Vault | ✅ | CRUD, tags, run with history |
| Run History | ✅ | Live output streaming, viewer, clear |
| Project Notes | ✅ | Simple text editor per project |
| Docker integration | ✅ | List/start/stop/logs, Windows + WSL support |
| App Preferences | ✅ | Editor + terminal selection |
| Global Command Palette | ✅ | Cmd/Ctrl+K with fuzzy search via fuse.js |

---

## Phase 1: Production Readiness 🚧 START HERE

**Goal:** Ship a stable, distributable application.

### 1.1 Production Build Verification ✅
**Priority:** Critical Blocker  
**Effort:** 1-2 hours  
**Dependencies:** None

**Status:** COMPLETED

**Issues Fixed:**
1. **Vite base path** - Changed from absolute `/` to relative `./` for production file loading
2. **isDev detection** - Fixed `app.isPackaged` check to properly respect `NODE_ENV`
3. **Electron version** - Downgraded from v40 to v33 for stability
4. **Native modules** - Rebuilt `better-sqlite3` for Electron 33
5. **SQLite compatibility migration** - Added startup schema patching for legacy DBs missing `commands.variables` and `run_history.resolved_command`

**Test Command:**
```bash
npm run build
NODE_ENV=production npm run test:production
```

**Tasks:**
- [x] Verify `npm run build` completes without errors
- [x] Test packaged app launches correctly
- [x] Verify all IPC calls work in production (not just dev)
- [x] Check that renderer loads correct HTML file path
- [x] Validate SQLite database path in production
- [x] Add compatibility migration for existing SQLite installs created before new columns
- [ ] Test on Windows (primary target) - Pending Windows environment
- [ ] Test WSL path handling in production build - Pending

**Acceptance Criteria:**
- `npm run build` produces working executable
- App launches without dev tools
- All CRUD operations work
- Database persists between sessions

---

### 1.2 Command Variables ✅ **COMPLETE**
**Priority:** High  
**Effort:** 2-3 hours  
**Dependencies:** None

Enable dynamic values in commands using template syntax.  
**Planning Doc:** `docs/planning/phase-1.2-command-variables.md`

**Template Syntax:**
```
{{project.name}}     → Project name
{{project.path}}     → Absolute project path
{{project.type}}     → Project type (node/python/etc)
{{container.name}}   → Linked container name (first)
{{env.NAME}}         → Environment variable
{{input}}            → Prompt user at runtime
```

**Implementation Plan:**

1. **Data Model** (`apps/desktop/data/model.ts`)
   ```typescript
   interface CommandVariable {
     name: string
     default?: string
     required: boolean
     description?: string
   }
   
   // Extend Command type
   interface Command {
     // ... existing fields
     variables?: CommandVariable[]
   }
   ```

2. **Variable Resolver Service** (`apps/desktop/commands/variableResolver.ts`)
   - Parse command string for `{{variable}}` patterns
   - Resolve built-in variables (project, container)
   - Prompt for `{{input}}` variables
   - Handle environment variable lookup

3. **UI: Variable Prompt Modal** (`apps/renderer/app/components/`)
   - Show when running command with unresolved variables
   - Input fields for each required variable
   - Remember last used values per command

4. **IPC Integration**
   - Modify `commands:run` to accept optional `variables` map
   - Resolve variables before spawning process

**Acceptance Criteria:**
- Commands with `{{project.name}}` resolve correctly
- User is prompted for `{{input}}` variables
- Variable values appear in run history (resolved command)
- Works with existing command palette

---

### 1.3 Favorites / Pinning ✅ **COMPLETE**
**Priority:** Medium-High  
**Effort:** 2-3 hours  
**Dependencies:** None

Quick access to frequently used projects and commands.

**Features:**
- Star/pin projects (appears at top of list)
- Star/pin commands (appears at top of vault)
- Persist pin state in SQLite

**Database Schema:**
```sql
ALTER TABLE projects ADD COLUMN is_pinned BOOLEAN DEFAULT 0;
ALTER TABLE commands ADD COLUMN is_pinned BOOLEAN DEFAULT 0;
ALTER TABLE projects ADD COLUMN pinned_at TEXT;
ALTER TABLE commands ADD COLUMN pinned_at TEXT;
```

**UI Changes:**
- Star icon on project cards
- Star icon in command vault rows
- "Pinned" section at top of each list
- Palette shows pinned items first

**Status:** COMPLETED

---

## Phase 2: Enhanced Command Vault ✅ COMPLETE

**Goal:** Transform Command Vault into a powerful automation system.

### 2.1 Command Presets by Project Type ✅ **COMPLETE**
**Priority:** High  
**Effort:** 3-4 hours  
**Dependencies:** 1.2 (variables recommended)

Auto-suggest common commands based on project type detection.

**Status:** COMPLETED

**Implemented:**
- Renderer preset library for Node, Python, Rust, and Go projects
- Project-aware preset picker in Command Vault via an `Add Preset` action
- One-click preset command creation bound to the selected project
- Duplicate-aware preset state so already-added commands are clearly marked

**Preset Library:**
```typescript
const PROJECT_PRESETS: Record<ProjectType, CommandPreset[]> = {
  node: [
    { name: 'Install', command: 'npm install', icon: 'Package' },
    { name: 'Dev', command: 'npm run dev', icon: 'Play' },
    { name: 'Build', command: 'npm run build', icon: 'Hammer' },
    { name: 'Test', command: 'npm test', icon: 'CheckCircle' },
    { name: 'Lint', command: 'npm run lint', icon: 'AlertCircle' },
  ],
  python: [
    { name: 'Install', command: 'pip install -r requirements.txt' },
    { name: 'Run', command: 'python main.py' },
    { name: 'Test', command: 'pytest' },
  ],
  rust: [
    { name: 'Build', command: 'cargo build' },
    { name: 'Run', command: 'cargo run' },
    { name: 'Test', command: 'cargo test' },
    { name: 'Check', command: 'cargo check' },
  ],
  go: [
    { name: 'Run', command: 'go run .' },
    { name: 'Build', command: 'go build' },
    { name: 'Test', command: 'go test ./...' },
    { name: 'Mod Tidy', command: 'go mod tidy' },
  ],
}
```

**UI:** "Add Preset" button in Command Vault opens preset picker.

---

### 2.2 Advanced Tag Filtering ✅ **COMPLETE**
**Priority:** Medium  
**Effort:** 1-2 hours  
**Dependencies:** None

Enhanced tag system for command organization.

**Status:** COMPLETED

**Implemented:**
- Multi-select tag cloud filters in Command Vault
- Dedicated `Untagged` filter with command counts
- Quick tag assignment toggles on command detail views
- Active filter feedback with one-click filter reset

**Features:**
- Multi-select tag filter in vault
- Tag cloud visualization
- Quick tag assignment (click to toggle)
- "Untagged" filter

---

### 2.3 Command Chains ✅ **COMPLETE**
**Priority:** High  
**Effort:** 4-6 hours  
**Dependencies:** 1.2 (variables), 2.1 (presets)

Run multiple commands sequentially with dependency handling.

**Status:** COMPLETED

**Implemented:**
- SQLite-backed command chain model with CRUD IPC handlers
- Chain editor UI with step ordering, delays, and per-step variable overrides
- `Add to Chain` action from saved commands into the chain editor flow
- Chain run progress UI with live per-step statuses and history-backed step output

**Data Model:**
```typescript
interface CommandChain {
  id: string
  name: string
  description?: string
  projectId?: string  // Bound to project or global
  steps: ChainStep[]
  stopOnFailure: boolean
  parallel: boolean  // Future: run steps in parallel
}

interface ChainStep {
  id: string
  commandId: string
  variables?: Record<string, string>
  condition?: string  // Future: skip if condition not met
  delayMs?: number    // Delay before running this step
}
```

**UI Components:**
- Chain editor (drag-drop reorder)
- "Add to Chain" button on commands
- Chain run progress UI
- Per-step output in history

**IPC Additions:**
- `chains:run(chainId, projectId?)`
- `chains:create`, `chains:update`, `chains:delete`
- `chains:list`

---

### 2.4 Command Triggers ✅ **COMPLETE**
**Priority:** Medium  
**Effort:** 3-4 hours  
**Dependencies:** 2.3 (chains)

Automatic command execution based on events.

**Status:** COMPLETED

**Implemented:**
- Persistent trigger registry with project-scoped and global trigger support
- Main-process automation event bus for startup, project-open, and container-start events
- Optional trigger confirmation prompts before chain execution
- Trigger management UI wired into the Automation workspace

**Trigger Types:**
- `onProjectOpen` - Run when project is selected
- `afterContainerStart` - Run when linked containers start
- `onStartup` - Run when DevDesk launches
- `onSchedule` - Cron-like scheduling (future)

**Implementation:**
- Event bus in main process
- Trigger registry per project
- User confirmation for destructive triggers (optional)

---

## Phase 3: Embedded Terminals

**Goal:** Keep developers inside DevDesk with integrated terminal sessions.

### 3.1 Terminal Manager Service 📋
**Priority:** High  
**Effort:** 3-4 hours  
**Dependencies:** None

**Packages:** `node-pty`, `xterm`

Main process service for PTY management.

**Architecture:**
```
Main Process:
  TerminalManager
    ├── sessions: Map<terminalId, PTY>
    ├── create(sessionId, cwd, shell?)
    ├── write(sessionId, data)
    ├── resize(sessionId, cols, rows)
    ├── close(sessionId)
    └── events: data, exit, error
```

**IPC Handlers:**
- `terminal:create(projectId?)` → returns terminalId
- `terminal:write(terminalId, data)`
- `terminal:resize(terminalId, cols, rows)`
- `terminal:close(terminalId)`
- Events: `terminal:data`, `terminal:exit`

---

### 3.2 Terminal UI Component 📋
**Priority:** High  
**Effort:** 3-4 hours  
**Dependencies:** 3.1

XTerm.js integration with theming.

**Features:**
- Fit addon (auto-resize to container)
- WebLinks addon (clickable URLs)
- Search addon (Ctrl+F in terminal)
- Copy/paste support
- Theme matching app theme

**Component Structure:**
```typescript
// apps/renderer/app/components/Terminal/Terminal.tsx
interface TerminalProps {
  terminalId: string
  onClose?: () => void
  className?: string
}
```

---

### 3.3 Terminal Tabs in Projects 📋
**Priority:** Medium  
**Effort:** 2-3 hours  
**Dependencies:** 3.2

Tab interface for multiple terminals per project.

**UI Design:**
- Tab bar above terminal area
- "+" button for new terminal
- Terminal runs in project root by default
- Persist terminals while app is open

---

### 3.4 Palette Terminal Shortcuts 📋
**Priority:** Low  
**Effort:** 1-2 hours  
**Dependencies:** 3.1

Command palette integration.

**Actions:**
- "Open terminal in [Project Name]"
- "Close all terminals"
- "Focus terminal"

---

## Phase 4: Project Intelligence

**Goal:** Automated project analysis with actionable suggestions.

### 4.1 Project Health Inspector 📋
**Priority:** Medium  
**Effort:** 3-4 hours  
**Dependencies:** None

Analyze project state and detect issues.

**Detections:**
```typescript
interface ProjectHealthReport {
  projectId: string
  analyzedAt: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'cargo' | 'go'
  hasNodeModules?: boolean
  hasLockfile?: boolean
  hasDockerCompose?: boolean
  hasGit?: boolean
  nodeVersion?: string  // From .nvmrc or package.json
  availableScripts?: string[]  // From package.json
  missingDeps?: boolean
  suggestions: HealthSuggestion[]
}

interface HealthSuggestion {
  id: string
  type: 'warning' | 'info' | 'success'
  message: string
  action?: {
    label: string
    command?: string
    chainId?: string
  }
}
```

**IPC:**
- `project:inspect(projectId)` → returns health report

---

### 4.2 Suggested Actions Panel 📋
**Priority:** Medium  
**Effort:** 2-3 hours  
**Dependencies:** 4.1

Display health suggestions as actionable buttons.

**UI:**
- Panel in project view (collapsible)
- One-click run for suggestions
- "Dismiss" per suggestion
- "Refresh" to re-analyze

---

### 4.3 Script Auto-Detection 📋
**Priority:** Low  
**Effort:** 2 hours  
**Dependencies:** 4.1

Parse project files for available scripts.

**Sources:**
- `package.json` → `scripts` object
- `Makefile` → targets
- `docker-compose.yml` → services
- `Cargo.toml` → `[[bin]]` sections

---

### 4.4 Health Indicators 📋
**Priority:** Low  
**Effort:** 2 hours  
**Dependencies:** 4.1

Visual status indicators on project cards.

- 🟢 Healthy: All checks pass
- 🟡 Warning: Action suggested
- 🔴 Critical: Missing deps or errors

---

## Phase 5: File Search & Navigation

**Goal:** Fast project file discovery and navigation.

### 5.1 File Indexer Service ✅
**Priority:** High  
**Effort:** 3-4 hours  
**Dependencies:** None

**Packages:** `fast-glob` or `fdir`

Build and maintain file index per project.

**Architecture:**
```typescript
interface FileIndex {
  projectId: string
  projectPath: string
  files: string[]  // Relative paths
  lastIndexedAt: string
  isIndexing: boolean
}
```

**Index Strategy:**
- Lazy build on first search
- Incremental updates (watch mode - future)
- Manual "Refresh Index" button
- Cap at 200k files with warning

**Ignore Rules:**
- Always: `.git/`, `node_modules/`, `dist/`, `build/`, `.next/`, `out/`, `.turbo/`, `.cache/`, `.venv/`, `target/`
- Parse `.gitignore` if exists

---

### 5.2 Path Security Layer ✅
**Priority:** Critical  
**Effort:** 1-2 hours  
**Dependencies:** None

Prevent path traversal attacks.

**Validation:**
```typescript
function validateProjectPath(
  projectRoot: string,
  relativePath: string
): string | null {
  // Reject absolute paths
  if (path.isAbsolute(relativePath)) return null
  
  // Resolve and normalize
  const resolved = path.resolve(projectRoot, relativePath)
  
  // Ensure within project boundary
  const relative = path.relative(projectRoot, resolved)
  if (relative.startsWith('..')) return null
  
  return resolved
}
```

---

### 5.3 File Browsing IPC ✅
**Priority:** Medium  
**Effort:** 2 hours  
**Dependencies:** 5.2

Directory listing endpoint.

**IPC:**
- `files:list(projectId, dir?)` → returns entries
  ```typescript
  interface FileEntry {
    name: string
    relativePath: string
    kind: 'file' | 'directory'
    size?: number
    modifiedAt?: string
  }
  ```

---

### 5.4 File Search IPC ✅
**Priority:** High  
**Effort:** 3 hours  
**Dependencies:** 5.1, 5.3

Fuzzy file search.

**IPC:**
- `files:search(projectId, query, limit?)` → returns matches
  - Use Fuse.js for fuzzy matching
  - Limit to 50 results
  - Sort by relevance

---

### 5.5 Open in Editor with Line/Col ✅
**Priority:** Medium  
**Effort:** 1-2 hours  
**Dependencies:** None

Extend existing editor opening.

**IPC:**
- `files:openInEditor(projectId, relativePath, line?, column?)`

**Editor Support:**
- VS Code: `code --goto <file>:<line>:<col>`
- Others: Best effort (open file, ignore line/col)

---

### 5.6 Palette File Search Mode ✅
**Priority:** Medium  
**Effort:** 2-3 hours  
**Dependencies:** 5.4

Command palette integration.

**Flow:**
1. Palette: "Find file..."
2. Select project (if not in project context)
3. Type to search files
4. Enter to open in editor

---

## Phase 6: Git Awareness

**Goal:** Git status visibility and basic operations.

### 6.1 Git Service 📋
**Priority:** High  
**Effort:** 2-3 hours  
**Dependencies:** None

**Packages:** `simple-git`

Wrapper around git operations.

**Architecture:**
```typescript
// apps/desktop/git/gitService.ts
class GitService {
  async getStatus(projectPath: string): Promise<GitStatus>
  async getChangedFiles(projectPath: string): Promise<ChangedFile[]>
  async getDiff(projectPath: string, filePath?: string): Promise<string>
  async commit(projectPath: string, message: string, files?: string[]): Promise<void>
  async stage(projectPath: string, files: string[]): Promise<void>
}
```

---

### 6.2 Git Status Panel 📋
**Priority:** High  
**Effort:** 2 hours  
**Dependencies:** 6.1

UI component showing repository state.

**Display:**
- Branch name
- Ahead/behind count (if remote)
- Clean/dirty indicator
- Number of modified/added/deleted files

---

### 6.3 Changed Files List 📋
**Priority:** Medium  
**Effort:** 2 hours  
**Dependencies:** 6.1

List of working directory changes.

**Features:**
- File tree view
- Status badges (M, A, D, ??)
- Checkboxes for selective staging
- "Stage All" / "Unstage All"

---

### 6.4 Diff Viewer 📋
**Priority:** Medium  
**Effort:** 3-4 hours  
**Dependencies:** 6.1

Show file diffs.

**Options:**
1. **Simple:** Preformatted text diff
2. **Rich:** Monaco Editor diff view (optional)

**Features:**
- Syntax highlighting
- Line numbers
- Side-by-side or inline view

---

### 6.5 Quick Commit UI 📋
**Priority:** Medium  
**Effort:** 2-3 hours  
**Dependencies:** 6.3

Commit workflow.

**UI:**
- Commit message input
- Staged files list
- "Commit" button
- Error display

---

### 6.6 Palette Git Commands 📋
**Priority:** Low  
**Effort:** 1-2 hours  
**Dependencies:** 6.1

Command palette shortcuts.

- "Git: Show Status"
- "Git: Commit"
- "Git: View Diff"
- "Git: Stage All"

---

## Phase 7: Dev Stack Manager

**Goal:** Container orchestration linked to projects.

### 7.1 Container ↔ Project Linking ✅
**Priority:** High  
**Effort:** 2-3 hours  
**Dependencies:** None

Extend existing container model.

**Database:**
```sql
-- Already exists in schema: projects.linked_container_names
-- Just need UI to manage it
```

**UI:**
- Multi-select in project settings
- "Link Container" dropdown
- Visual badges on project card showing linked containers

---

### 7.2 Dev Stack Controls 🚧
**Priority:** Medium  
**Effort:** 2 hours  
**Dependencies:** 7.1

One-click stack operations.

**Buttons:**
- "Start Dev Stack" → Start all linked containers
- "Stop Dev Stack" → Stop all linked containers
- "Restart Dev Stack"

**Status Notes:**
- Start/Stop implemented
- Restart all linked containers still pending

---

### 7.3 Container Logs Viewer 🚧
**Priority:** Medium  
**Effort:** 3-4 hours  
**Dependencies:** None

Stream container logs in UI.

**IPC:**
- `docker:logs:subscribe(containerId)`
- `docker:logs:unsubscribe(containerId)`
- Event: `docker:logs:data`

**UI:**
- Tabbed log viewer per container
- Search/filter within logs
- Auto-scroll toggle
- Clear logs button

**Status Notes:**
- Live log streaming implemented (`docker:logs:subscribe`/`unsubscribe`)
- Advanced viewer features (search/filter/toggles) still pending

---

### 7.4 Docker Compose Support 📋
**Priority:** Low  
**Effort:** 3-4 hours  
**Dependencies:** 7.2

Detect and manage compose projects.

**Features:**
- Auto-detect `docker-compose.yml` in project root
- "Compose Up" / "Compose Down" buttons
- Parse compose file for service names
- Link services to project automatically

---

## Phase 8: Dev Wiki (Enhanced Notes)

**Goal:** Rich, actionable project documentation.

### 8.1 Markdown Renderer 📋
**Priority:** Medium  
**Effort:** 2-3 hours  
**Dependencies:** None

**Packages:** `react-markdown`, `remark-gfm`

Render notes as GitHub-flavored markdown.

**Features:**
- Headers, lists, tables
- Checkboxes (`- [ ]` tasks)
- Code blocks with syntax highlighting
- Links, images

---

### 8.2 Edit ↔ Preview Toggle 📋
**Priority:** Low  
**Effort:** 1-2 hours  
**Dependencies:** 8.1

Tab interface for notes.

- "Edit" tab: Plain textarea (current behavior)
- "Preview" tab: Rendered markdown
- "Split" view (optional): Side-by-side

---

### 8.3 Runnable Code Blocks 📋
**Priority:** Medium  
**Effort:** 3-4 hours  
**Dependencies:** 8.1

Execute code blocks directly from notes.

**Markdown Convention:**
````markdown
```bash:run
npm run dev
```
````

**UI:**
- "Run" button appears on `bash:run`, `sh:run` blocks
- Click runs command in project's terminal
- Output goes to run history

---

### 8.4 Task Checkboxes 📋
**Priority:** Low  
**Effort:** 2 hours  
**Dependencies:** 8.1

Interactive checkboxes in preview mode.

- Click to toggle `- [ ]` ↔ `- [x]`
- Auto-save to notes
- Progress indicator (X of Y tasks complete)

---

## Phase 9: System Integration

**Goal:** DevDesk feels like a native desktop app.

### 9.1 System Tray Icon 📋
**Priority:** Medium  
**Effort:** 2-3 hours  
**Dependencies:** None

Electron tray integration.

**Features:**
- Show icon in system tray
- Right-click context menu
- Click to toggle window visibility

---

### 9.2 Tray Context Menu 📋
**Priority:** Medium  
**Effort:** 2 hours  
**Dependencies:** 9.1

Dynamic menu based on recent activity.

**Menu Items:**
- Open DevDesk
- ─────────────
- Recent Projects (last 3)
- ─────────────
- Run Last Command
- Start Last Dev Stack
- ─────────────
- Quit

---

### 9.3 Global Hotkeys 📋
**Priority:** Low  
**Effort:** 2 hours  
**Dependencies:** 9.1

System-wide shortcuts.

**Default Bindings:**
- `Cmd/Ctrl+Shift+D` → Toggle DevDesk window
- `Cmd/Ctrl+Shift+P` → Open Command Palette

**Settings:** Allow customization in preferences.

---

## Phase 10: Notifications & Polish

**Goal:** Background awareness without babysitting.

### 10.1 Desktop Notifications 📋
**Priority:** Medium  
**Effort:** 2-3 hours  
**Dependencies:** None

Electron notifications API.

**Triggers:**
- Command finished successfully
- Command failed
- Container stopped unexpectedly
- Long operation completed (>30s)

**Content:**
- Title: "DevDesk: Command Complete"
- Body: "[Command Name] finished in [Project Name]"
- Action: Click to open run output

---

### 10.2 Background Task Handling 📋
**Priority:** Low  
**Effort:** 2 hours  
**Dependencies:** 10.1

Keep tasks running when minimized.

**Features:**
- Commands continue when window hidden
- Notification on completion
- Progress indicator in tray icon (if possible)

---

### 10.3 Export / Import Configuration 📋
**Priority:** Low  
**Effort:** 3-4 hours  
**Dependencies:** None

Data portability for backup/restore.

**Export:**
- SQLite database dump
- JSON export of all entities
- Exclude: run history output (optional)

**Import:**
- Merge or replace existing data
- Validation of imported data

**UI:**
- Settings → Export Data
- Settings → Import Data

---

## Technical Debt & Maintenance

### Continuous
- [ ] Keep dependencies updated
- [ ] Security audits (`npm audit`)
- [ ] Performance profiling
- [ ] Error tracking/logging improvements

### Code Quality
- [ ] Add automated tests (none currently)
- [ ] E2E tests for critical paths
- [ ] TypeScript strict mode compliance
- [ ] Documentation updates

---

## Dependency Graph

```
Phase 1: Foundation
    │
    ├──► 1.2 Variables ─────┬──► 2.3 Chains ────┬──► 2.4 Triggers
    │                       │                    │
    └──► 1.3 Favorites      └──► 2.1 Presets     └──► 7.2 Stack Controls

    │
    └──► 3.1 Terminal Manager ───┬──► 3.2 Terminal UI ───► 3.3 Terminal Tabs
                                 │
                                 └──► 3.4 Palette Shortcuts

    │
    └──► 5.1 File Indexer ───┬──► 5.4 File Search ───► 5.6 Palette Files
                              │
                              └──► 5.2 Path Security ───► 5.3 File Browse

    │
    └──► 6.1 Git Service ───┬──► 6.2 Status Panel ───► 6.3 Changed Files
                             │                          │
                             └──► 6.4 Diff Viewer ◄─────┘
                             │
                             └──► 6.5 Quick Commit

    │
    └──► 4.1 Health Inspector ───► 4.2 Suggested Actions
                                   │
                                   └──► 4.3 Script Detection
                                   │
                                   └──► 4.4 Health Indicators

Phase 7: Dev Stack (extends existing Docker)
    │
    ├──► 7.1 Container Links ───► 7.2 Stack Controls
    │                             │
    └──► 7.3 Logs Viewer          └──► 7.4 Compose Support

Phase 8: Dev Wiki
    │
    ├──► 8.1 Markdown Renderer ───► 8.2 Edit/Preview Toggle
    │                               │
    └──► 8.3 Runnable Blocks        └──► 8.4 Task Checkboxes

Phase 9: System Integration
    │
    ├──► 9.1 Tray Icon ───► 9.2 Tray Menu
    │
    └──► 9.3 Global Hotkeys

Phase 10: Polish
    │
    ├──► 10.1 Notifications ───► 10.2 Background Tasks
    │
    └──► 10.3 Export/Import
```

---

## Release Milestones

### v1.0 - Production Ready
**Features:** 1.1 (Build verify + DB compatibility migration)  
**Goal:** Stable, distributable app

### v1.1 - Command Power
**Features:** 1.2, 1.3, 2.1, 2.2  
**Goal:** Variables, favorites, presets

### v1.2 - Automation
**Features:** 2.3, 2.4  
**Goal:** Chains and triggers

### v1.3 - Terminal
**Features:** 3.x  
**Goal:** In-app terminals

### v1.4 - Intelligence
**Features:** 4.x, 5.x  
**Goal:** Smart suggestions, file search

### v1.5 - Git
**Features:** 6.x  
**Goal:** Full git workflow

### v1.6 - Dev Stack
**Features:** 7.x  
**Goal:** Container orchestration

### v1.7 - Wiki
**Features:** 8.x  
**Goal:** Rich documentation

### v2.0 - Platform
**Features:** 9.x, 10.x  
**Goal:** Native feel, notifications, portability

---

## Quick Reference: Next 3 Tasks

1. **Terminal Manager Service** (3-4 hrs)
   - Add PTY session lifecycle in the main process
   - Wire IPC for create/write/resize/close
   - Stream terminal output to the renderer

2. **Terminal UI Component** (3-4 hrs)
   - Integrate XTerm.js with theme support
   - Add fit/search/weblinks addons
   - Support copy/paste and resizing

3. **Dev Stack Restart Action** (1-2 hrs)
   - Add "Restart Dev Stack" operation for linked containers
   - Surface result summary alongside Start/Stop

---

*This roadmap is a living document. Update as priorities shift or new requirements emerge.*
