# DevDesk – Feature Expansion Specification (Agent-Ready)

This is a **single continuous Markdown file** you can paste into your IDE and hand to a coding agent.  
It describes each planned feature with: **goal, scope, steps, required npm packages (as plain text), IPC/API surface, file placement, and acceptance checks**.

**Important:** This file is Markdown only. Any “code-like” snippets below are written as *documentation examples* (still inside Markdown).  
DevDesk principles: **local-first, safe-by-default, fast UI, deterministic actions, secure IPC boundaries**.

---

## Baseline Context (updated 2026-07-12)

**Current DevDesk MVP (already exists):**
- Projects: add/edit/remove, type detection
- Command Vault: CRUD + run, tags
- Run History: live output streaming + viewer
- Project Notes: simple editor
- Docker: list/start/stop + logs, Windows/WSL fallback
- Preferences: editor/terminal selection
- Architecture: Renderer (React) → Preload API → Main process services (no direct Node in renderer)

**Implemented since the original specification:**
- Command search/filter by tag
- Run history shows names
- Production build verification
- Command variables, presets, chains, and triggers
- Embedded terminals and terminal tabs
- Project health checks, file search, Git workspace features, and engine indexing
- Markdown notes, tray actions, export/import, bug recording, and LLM context bundling

The feature specifications below are historical implementation reference. The
remaining work is release hardening and is tracked in
`LAUNCH-BLOCKERS-PLAN.md`.
- JSON store to SQLite migration

---

## How the Agent Should Use This File

Work feature-by-feature. For each feature:
1. Create/modify files as suggested.
2. Add required npm packages.
3. Add IPC handlers in Main + Preload bridge methods.
4. Update UI sections and wire actions to IPC.
5. Verify acceptance checks.

---

# Feature 1 — Global Command Palette (Keyboard-First UX)

## Goal
Add a global “command palette” (Raycast/VS Code style) that can trigger **any major action** in DevDesk without navigating panels.

## Why
DevDesk becomes *fast* and *keyboard-first*, and every feature becomes discoverable.

## Required npm packages
- cmdk
- fuse.js

## UI/UX scope
- Global shortcut: **Ctrl/Cmd + K**
- Modal overlay with search input
- Arrow-key navigation + Enter to run
- Grouped results:
  - Projects (open, open in editor, open terminal)
  - Vault Commands (run)
  - Containers (start/stop, view logs)
  - Navigation (jump to sections)
  - History (open recent run output)

## Data requirements
Palette needs fast access to:
- Project list (id, name, path, type)
- Vault command list (id, name, tags, project binding)
- Container list (id, name, status)
- Recent history list (id, label, status)

## Main process work (IPC)
Expose these IPC methods (names are suggestions; keep consistent with your existing style):
- projects:list
- commands:list
- containers:list
- history:listRecent
- projects:openInEditor
- terminal:createForProject
- commands:run
- docker:start
- docker:stop
- navigation:setSection (optional; could be renderer-only)

## Preload bridge
Expose a minimal safe API surface for each call above.

## Renderer work
- Add `CommandPaletteProvider` at app root
- Add palette UI component (cmdk)
- Build an action registry (in-memory list of palette actions)
- Use fuse.js to fuzzy-search titles + subtitles + tags

## Acceptance checks
- Palette opens in under ~100ms perceived time
- You can:
  - open a project
  - run a vault command
  - start/stop a container
  - open a recent run
  without touching the mouse

---

# Feature 2 — Embedded Project Terminals (Tabs per Project)

## Goal
Provide terminals inside DevDesk so users can keep work inside one app.

## Why
DevDesk becomes a true workspace, not just a launcher.

## Required npm packages
- xterm
- node-pty

## UI/UX scope
- Each Project page can open one or more terminal tabs
- Terminals start in the project directory
- Terminal tabs persist while the app is open
- Quick open terminal from command palette

## Main process work
Add a “terminal manager” that:
- Creates PTY sessions
- Streams output events to renderer
- Accepts input from renderer
- Handles resize events
- Cleans up sessions on close

## IPC surface
- terminal:create (with project path or project id)
- terminal:write
- terminal:resize
- terminal:close
- terminal:onData (event channel)
- terminal:onExit (event channel)

## Preload bridge
Expose terminal methods and event subscriptions in a safe, explicit way.

## Renderer work
- Add a Terminal UI component using xterm
- Wire keypresses to terminal:write
- Subscribe to terminal:onData and write to xterm

## Acceptance checks
- Multiple terminals can run simultaneously
- Output feels near real-time
- Works on Windows and WSL setups (your existing fallback logic should remain consistent)

---

# Feature 3 — Project Search & File Navigation (Fast Find + Preview)

## Goal
Search within a project and quickly open/preview files.

## Why
Turns DevDesk into a “project navigator” similar to lightweight IDE features.

## Required system tools (preferred)
- ripgrep (rg) for content search
- fd for file search
- bat for previews (optional but recommended)

(If bundling these is too heavy, support “use if installed” + show helpful instructions.)

## Required npm packages (optional helper)
- execa (recommended for reliable process spawning)

## UI/UX scope
- “Search in Project” panel:
  - text query input
  - results list (file + line preview)
  - click opens preview
- “Quick File Open”:
  - search filenames using fd
  - open preview instantly
- File preview:
  - show text content with basic formatting
  - optionally syntax highlighting later (Monaco can handle this too)

## Main process work
Create a search service that:
- Runs rg for content search (stream results)
- Runs fd for file listing/search
- Uses bat (or raw fs read) for preview

## IPC surface
- search:rg (query + project path)
- search:fd (query + project path)
- preview:file (file path)
- search:cancel (for long searches)

## Renderer work
- Add search UI in Project section
- Add quick-open integration in command palette
- Show preview panel (split view)

## Acceptance checks
- Searches stream results (don’t wait for full completion)
- Cancel works
- Preview opens quickly

---

# Feature 4 — Git Awareness Layer (Status + Diffs + Quick Commit)

## Goal
Show Git status per project and basic diffs.

## Why
DevDesk becomes a true “project dashboard” with visibility.

## Required npm packages
- simple-git
- monaco-editor (only if you want rich diff viewer inside DevDesk)

## UI/UX scope
Per project:
- Git status badge (clean/dirty)
- Ahead/behind indicator (optional)
- Changed files list
- Diff viewer for a selected file
- Quick commit modal:
  - commit message input
  - commit button
  - optional “stage all” toggle

## Main process work
Create Git service that:
- Reads status
- Lists changed files
- Produces diffs
- Executes commit workflow safely

## IPC surface
- git:status
- git:changedFiles
- git:diff
- git:commit
- git:stageAll (optional)

## Renderer work
- Add Git panel in Project view
- Add diff view area
- Add commit modal
- Add palette commands:
  - “Git: Show status”
  - “Git: Commit”

## Acceptance checks
- Git operations never freeze UI (use worker/async)
- Clear errors if repo isn’t initialized or git missing

---

# Feature 5 — Dev Stack Manager (Docker Upgrade)

## Goal
Upgrade containers into “dev stacks” linked to projects, with one-click start/stop and logs.

## Why
This matches your app vision: Project + Commands + Containers in one workspace.

## Required npm packages
- dockerode

## UI/UX scope
- In each project:
  - “Linked Containers” list
  - “Start Dev Stack” button
  - “Stop Dev Stack” button
  - Live logs viewer per container
- In Containers section:
  - show project links (which containers belong to which project)

## Data model changes
Add a project → containers link model:
- Each project can store a list of container identifiers (name or id)
- Later: optionally support docker-compose project name mapping

## Main process work
Extend Docker service:
- list containers
- start/stop container
- stream logs
- optional: compose up/down if compose exists

## IPC surface
- docker:list
- docker:start
- docker:stop
- docker:logs:subscribe
- docker:logs:unsubscribe
- docker:composeUp (optional)
- docker:composeDown (optional)

## Renderer work
- Add “Dev Stack” subsection in Project view
- Add container linking UI (simple add/remove container association)
- Add logs viewer UI (streaming)

## Acceptance checks
- Start stack starts all linked containers
- Logs stream live
- Confirmations for destructive actions remain in place

---

# Feature 6 — Command Vault Automation Engine (Variables + Triggers + Chains)

## Goal
Upgrade the Command Vault from “stored commands” to “automations”.

## Why
This is a unique DevDesk differentiator.

## Required npm packages
- none required (optional: a tiny templating helper, but can be done manually)

## New command capabilities
1) Variables:
- A command can declare variables and defaults
- On run, UI prompts user for values
- Values get injected into the script

2) Triggers:
- runOnProjectOpen
- runAfterContainersStart

3) Command chaining:
- Run A then B then C (stop chain on failure unless user overrides)

## Data model changes
Extend vault command entity to include:
- variables list (name, default, required flag)
- triggers (booleans)
- chain (list of command ids)

## Execution flow
- Resolve project context
- Resolve variables (prompt user)
- Expand template (replace placeholders)
- Execute command
- Stream output to history
- Persist run record with:
  - display name
  - resolved command
  - status
  - timestamps

## UI/UX scope
- Variables prompt modal before run
- “Automation” toggles on command edit screen
- “Chain editor” (simple list ordering)

## IPC surface
- commands:run (support passing resolved variables)
- commands:resolveTemplate (optional, but can be renderer-only)
- commands:runChain (optional helper)

## Acceptance checks
- Variable prompts always appear if needed
- Chain runs step-by-step and logs each step to history
- Triggers work reliably and predictably

---

# Feature 7 — Project Workspace Intelligence (Project Health Panel)

## Goal
Automatically analyze a project and suggest “next actions” (install deps, run dev, start containers, etc.).

## Why
This improves speed and reduces “what do I do next?” time.

## Required npm packages
- execa (recommended)

## What to detect (local heuristics)
- package manager:
  - detect lockfile (pnpm-lock, yarn.lock, package-lock)
- common scripts:
  - dev, start, build, test
- node version hints:
  - .nvmrc
- dependency presence:
  - node_modules exists? (warning if missing)
- docker hints:
  - docker-compose file exists? (optional)
- git presence:
  - .git folder exists? (optional)

## UI/UX scope
“Project Health” panel in project view:
- Status items (green/yellow/red)
- Suggested actions as buttons:
  - “Install dependencies”
  - “Run dev script”
  - “Start Dev Stack”
- Each suggested action can be run through:
  - embedded terminal OR existing command runner

## IPC surface
- project:inspect (returns a structured report)
- project:runSuggestedAction (optional; or reuse commands:run/terminal)

## Acceptance checks
- Report generation is fast and doesn’t block UI
- Suggestions are deterministic and safe-by-default

---

# Feature 8 — Project Notes → Dev Wiki (Markdown + Actions)

## Goal
Turn notes into a mini project wiki with Markdown rendering and action buttons.

## Why
Notes become actionable and reduce repeated setup friction.

## Required npm packages
- react-markdown
- remark-gfm

## UI/UX scope
Per project notes:
- Edit mode (textarea/editor)
- Preview mode (rendered markdown)
- GitHub-flavored markdown (checkboxes, tables)
- Inline “Run” buttons for command blocks

## Action block convention (Markdown)
Adopt a convention for runnable blocks in notes, for example:
- Code blocks tagged as “run”
- The UI shows a “Run” button for those blocks

The coding agent should implement:
- parsing of markdown for runnable blocks
- mapping them into “run this command” actions

## IPC surface
Reuse existing:
- commands:run OR terminal:create + terminal:write
Also store in history.

## Acceptance checks
- Notes render correctly
- Runnable blocks reliably execute and log to history

---

# Feature 9 — System Tray + Global Quick Actions

## Goal
Make DevDesk accessible without opening the main window (always-available workflow).

## Why
This is a key “desktop productivity app” quality.

## Required npm packages
- none (Electron APIs)

## UI/UX scope
Tray menu actions:
- Open DevDesk
- Open Command Palette
- Run last command
- Start last dev stack
- Open last project terminal

Global shortcuts (optional):
- Toggle DevDesk
- Open palette

## Main process work
- Create tray icon
- Build menu from dynamic state:
  - last project
  - last command
  - last stack
- Wire actions to existing IPC / internal functions

## Acceptance checks
- Tray works on Windows and macOS
- Actions are deterministic and safe

---

# Feature 10 — Notifications & Background Tasks

## Goal
Notify users when long tasks finish or fail; allow DevDesk to run work in background.

## Why
Users shouldn’t babysit the UI.

## Required npm packages
- none (Electron APIs)

## Notification triggers
- Command finished successfully
- Command failed
- Container stopped unexpectedly
- Long operation completed (indexing, scan, etc.)

## Background task approach
- Use async operations in Main
- Stream progress/output to renderer
- If renderer closed/minimized, still notify on completion

## Acceptance checks
- Notifications appear reliably
- No spam: only notify for meaningful events
- Notifications link back to relevant run/container details in the app

---

## Suggested Implementation Order (Recommended)

1) Global Command Palette  
2) Command Vault improvements (variables + search/filter)  
3) Embedded Terminals  
4) Dev Stack Manager improvements  
5) Project Search & File Navigation  
6) Project Notes → Dev Wiki  
7) Project Workspace Intelligence  
8) Git Awareness Layer  
9) Tray + Quick Actions  
10) Notifications + background polish

---

## Definition of Done (for each feature)
A feature is “done” when:
- IPC is implemented in Main + exposed via Preload
- Renderer calls the API (no direct Node access)
- UI is keyboard-friendly and deterministic
- Errors are surfaced clearly and safely
- Basic manual testing steps pass on Windows + WSL workflow

---
