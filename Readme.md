# DevDesk — Electron App Overview

A **local-first Electron desktop app for developers** that combines a **Project Manager**, **Command Vault**, and **Docker/Compose Manager** into one clean, fast workspace.

- **Tech stack:** Node.js + TypeScript (backend), TypeScript + React (frontend)
- **No AI, no cloud, no accounts**
- **Target platforms:** macOS + Windows (Linux later)

This document is intentionally **high-level**. It describes *what the app does* and *how pieces fit together*, without locking you into heavy schemas or file layouts.

---

## Purpose

DevDesk exists to remove daily developer friction:

- Jump into projects without remembering commands
- Reuse complex terminal commands safely
- Control Docker containers and compose stacks visually
- Keep a simple history of what you ran and when

If it saves even **5 minutes per day**, it’s doing its job.

---

## Core Principles

- **Local-first**: everything runs on your machine
- **Deterministic**: buttons do predictable things
- **Opinionated**: optimized for solo dev workflows
- **Safe by default**: destructive actions require intent
- **Fast UI**: keyboard-first, minimal clicks

---

## Core Features (The “Combo”)

### 1) Project Manager

**What it does**
- Add local project folders
- Automatically recognize project type from common files
- Acts as the “home screen” of the app

**Typical actions**
- Open project in editor (VS Code / Cursor)
- Open terminal in project directory
- Run a saved command in project context
- Show project notes (ports, URLs, reminders)

**Why it matters**
This removes the mental overhead of:
> “Where is this project and how do I start it again?”

---

### 2) Command Vault

**What it does**
- Store frequently used terminal commands
- Add short explanations for *future you*
- Tag, search, favorite, and reuse commands

**Command behavior**
- Can run globally or inside a selected project
- Supports simple variables (e.g. `{{container}}`)
- Can be linked to one or more projects as presets

**Example use cases**
- Docker cleanup commands
- Git recovery one-liners
- Rare WSL / system fix commands

---

### 3) Containers (Docker + Compose)

**What it does**
- List running and stopped containers
- Start, stop, restart containers
- View and follow logs
- Manage compose stacks per project

**Implementation approach**
- Uses Docker CLI under the hood
- If Docker isn’t installed, the app degrades gracefully

**Goal**
Replace “remembering Docker commands” with clear actions.

---

### 4) Run History

**What it does**
- Shows what commands were run
- Displays status (running / success / failed / stopped)
- Allows stopping long-running commands
- Provides access to logs/output
- Supports quick copy/export of output for sharing or debugging

**Why this exists**
So you never wonder:
> “Did I already run this?”  
> “Why did it fail last time?”

---


## How the App Works (High-Level)

- **Main process (Node.js + TypeScript)**
  - Runs commands
  - Talks to Docker
  - Reads the filesystem
  - Persists data locally

- **Renderer (TypeScript + React)**
  - Displays UI
  - Sends intent-based requests (run, stop, list, etc.)
  - Never accesses Node APIs directly

- **Preload layer**
  - Exposes a small, safe API to the renderer
  - Enforces security boundaries

---

## Safety & Trust

- Node APIs are isolated from the UI
- Commands marked as “dangerous” require confirmation
- Shell execution is explicit, not implicit
- All destructive actions are reversible where possible

This is a **developer tool**, not a background daemon.

---

## MVP Scope (Keep It Fun)

**Version 1 should include only:**
- Add and list projects
- Create and run saved commands
- See Docker containers and logs
- View and stop running commands
- View run history with output access
- Edit simple project notes (ports, URLs, reminders)

If V1 feels good, the app succeeds.

---

## Possible Future Enhancements (Optional)

- Command presets per project
- Port usage inspector
- Lightweight Git status per project
- Tray mode with quick actions
- Export/import configuration
- Profiles for different machines

None of these are required to ship.

---

## Non-Goals

- AI features or assistants
- Team collaboration
- Cloud sync
- Full terminal replacement
- Heavy analytics

Simplicity beats ambition.

---

## Definition of “Done” (V1)

- You can open DevDesk and immediately:
  - pick a project
  - run a command
  - manage a container
- No setup wizard required
- App feels fast and predictable
- You would *actually keep it installed*

---

## Final Note

DevDesk is not about doing *everything*.

It’s about becoming the **one place you open before the terminal**.

Build it slowly. Ship it early. Use it daily.
