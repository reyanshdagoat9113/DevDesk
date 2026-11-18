# Interactive packaged-app QA — Windows x64, v0.1.6

Manual checklist for the 12 Windows interactive rows in [../manual-qa.md](../manual-qa.md), plus behaviour added in v0.1.4–v0.1.6. Automated harness evidence does **not** count toward these rows. Only record **Pass** for steps you performed and observed in the packaged UI.

## Session

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Host (Windows build, WSL distro, Docker Desktop version) | |
| Artifact | `DevDesk-0.1.6-win-x64.exe` |
| Installer SHA-256 | |
| Install method (NSIS install / `win-unpacked` + `--user-data-dir`) | |
| userData path used | |

**Setup**

- Use a clean profile: either a fresh NSIS install with no existing `%APPDATA%\DevDesk`, or launch `win-unpacked\DevDesk.exe --user-data-dir=<new temp dir>`.
- Have ready: one ordinary Git repo on Windows, one Git repo inside a WSL distro, and (for row 10) Docker Desktop that you can start and stop.
- Result values: **Pass**, **Fail**, or **Blocked** (with a reason). Leave nothing blank at sign-off.

---

## Priority checks (do these first)

### Row 12 — WSL project: embedded terminal opens at the project path

| # | Action | Expected | Result | Notes |
|---|--------|----------|--------|-------|
| 12.1 | **Add Project** → choose the WSL option → pick a repo inside your distro (e.g. `/home/<you>/code/app`) | Project is added and shown as a WSL project | | |
| 12.2 | Select it and open an embedded terminal (Terminal section or ``Ctrl+` ``) | A shell tab opens without error | | |
| 12.3 | Run `pwd` | Prints the project's Linux path, **not** `/mnt/c/...` or `~` | | |
| 12.4 | Repeat with a project path containing a space | `pwd` is still the project path | | |
| 12.5 | Use **Open in Terminal** (external) on the same project | External terminal also starts in the project path | | |

### Lifecycle (v0.1.5)

| # | Action | Expected | Result | Notes |
|---|--------|----------|--------|-------|
| L.1 | In Settings, enable the tray icon, then close the main window with the title-bar **X** | Window hides; app keeps running in the tray | | |
| L.2 | Restore the window from the tray | Same window and state come back | | |
| L.3 | With the app running, launch DevDesk again (Start menu or exe) | No second instance; the existing window is focused or restored | | |
| L.4 | Start a long-running vault command (e.g. `ping -t localhost`), then choose tray **Quit** | App exits; Task Manager shows no leftover `ping`/shell processes | | |
| L.5 | Disable the tray icon in Settings, then close the window | App quits (no hidden instance left running) | | |

### Command project save (v0.1.6)

| # | Action | Expected | Result | Notes |
|---|--------|----------|--------|-------|
| C.1 | Create a vault command attached to project A and save it | Command shows project A | | |
| C.2 | Edit it, switch the project to B **without** picking a subdirectory, then Save | Command now shows project B; runs in B's folder | | |
| C.3 | Edit again and clear the project, working directory and description, then Save | Fields stay cleared after reopening | | |

### Engine schema guard (v0.1.6)

| # | Action | Expected | Result | Notes |
|---|--------|----------|--------|-------|
| E.1 | Index a project, then quit DevDesk | Index completes | | |
| E.2 | With any SQLite tool, open `<userData>\engine\<projectId>.sqlite` and run `UPDATE schema_version SET version = version + 1;` | Write succeeds | | |
| E.3 | Relaunch and open search or stats for that project | Readable error saying the index was created by a newer DevDesk version and to re-index — no raw SQLite error, no crash | | |
| E.4 | Clear the index or re-index the project | Indexing recovers and search works again | | |

---

## Standard interactive rows

| Row | Action | Expected | Result | Notes |
|-----|--------|----------|--------|-------|
| 1 | Install (accept the SmartScreen warning) and launch; click through each sidebar section | Window loads with no blank screen or console-error dialogs; every section renders | | |
| 2 | Add a Windows project, edit its name, pin and unpin it, then remove it (confirm) | Each change shows immediately; removal asks for confirmation | | |
| 3a | Create a command with a variable (e.g. `echo {{name}}`), run it and fill in the prompt | Output streams live and shows the substituted value | | |
| 3b | Run a failing command (e.g. `exit 1`) | Run is marked failed and kept in History | | |
| 3c | From the run output, use **Open in History** | History opens on that run with the command and project names shown | | |
| 4 | Open 2+ terminal tabs, resize the pane, search with `Ctrl+F`, copy/paste with `Ctrl+Shift+C/V`, close a tab | All work; a closed tab's process exits | | |
| 5 | Run a project health check, then open health history; use search/filter/sort and open a run's output | History lists the run; filters work; output is focused on the chosen run | | |
| 6 | Index a project, search for a known string, open a result, view stats and Git insights | Result opens at the right file; stats and Git data match the repo | | |
| 7 | `Ctrl+Shift+B` → fill in a bug → attach a file via the picker → save; reopen it | Context snapshot and attachment are present | | |
| 8a | Settings → Export; then Import the file in **merge** mode | Merge preview and result are correct; a `devdesk.db.backup-*` file is created | | |
| 8b | Import the same file in **replace** mode (confirm) | Data matches the export; backup created; confirmation shown first | | |
| 9 | Tray toggle on; use each tray quick action (open window, recent project, run last command, last dev stack) | Each action works; tray run-last runs the last command | | |
| 10a | With Docker running: open Containers, start/stop a container, follow live logs | List, actions and logs work; Compose labels show where present | | |
| 10b | Stop Docker Desktop and reopen Containers | Clear "Docker not available" state, no crash or endless spinner | | |
| 10c | With Windows Docker unavailable but Docker in WSL, reopen Containers | WSL fallback lists the containers | | |
| 11 | Quit fully and relaunch | Projects, commands, history, notes, preferences and tray setting all persist | | |
| 12 | See the priority section above | | | |

---

## Sign-off

| Row | Result |
|-----|--------|
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |
| 6 | |
| 7 | |
| 8 | |
| 9 | |
| 10 | |
| 11 | |
| 12 | |
| Lifecycle (L) | |
| Command save (C) | |
| Engine guard (E) | |

A row passes only if all of its sub-steps pass. Copy the 12 row results into the Windows interactive table in [../manual-qa.md](../manual-qa.md), and file an issue for every Fail.
