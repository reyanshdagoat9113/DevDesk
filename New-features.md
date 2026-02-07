# DevDesk – Feature Expansion Spec (Agent-Friendly)

This document translates the feature roadmap into **implementation-ready specifications**
for coding agents (Codex, Kimi Code, etc.).

The goal is to provide:
- Clear feature scope
- Responsibilities per process (Renderer / Main / Preload)
- Suggested libraries
- Expected data flows
- Acceptance criteria

DevDesk remains **local-first, offline, deterministic, and secure**.

---

# Table of Contents

1. Global Command Palette
2. Embedded Project Terminals
3. Project Search & File Navigation
4. Git Awareness Layer
5. Dev Stack Manager (Docker Upgrade)
6. Command Vault Automation Engine
7. Project Workspace Intelligence
8. Project Notes → Dev Wiki
9. System Tray + Global Quick Actions
10. Notifications & Background Tasks

---

# 1. Global Command Palette

## Goal
Provide a universal keyboard-first interface to execute actions across the app.

## Libraries
- cmdk (React)
- fuse.js (fuzzy search)

## Renderer Responsibilities
Create `CommandPaletteProvider`:
- Global hotkey: `Cmd/Ctrl + K`
- Overlay modal using cmdk
- Show grouped commands:
  - Projects
  - Commands
  - Containers
  - Navigation
  - History

## Main Process Responsibilities
Expose IPC endpoints:
- `projects:list`
- `commands:list`
- `containers:list`
- `history:listRecent`
- `projects:openInEditor`
- `terminal:openProjectTerminal`
- `commands:run`
- `containers:start/stop`

## Command Model
```ts
type PaletteCommand = {
  id: string
  title: string
  subtitle?: string
  icon?: string
  action: () => Promise<void>
}
```
