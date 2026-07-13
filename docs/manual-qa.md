# Manual clean-install QA

**Version under test:** `0.1.0`  
**Plan reference:** launch-blocker task 5  
**Last updated:** 2026-07-13  

This checklist is for the **packaged release artifact** and clean userData profiles — not only unit tests.

Supported platforms for private beta: **Windows x64**, **Linux x64**. macOS is out of scope.

**Evidence rule:** `Pass` means the documented action was performed in this session with recorded evidence.  
Do **not** use `Pass*` substitutions.

---

## How to run a session

### Windows

1. Ensure artifacts exist under `release/` (`package:win` / `win-unpacked`).
2. Run automated companions, then the clean-profile harness:
   ```powershell
   npm run verify:win-package
   npm run smoke:engine-packaged
   npm run qa:clean-install:win
   ```
3. Report path: `release/clean-install-qa-report.json`
4. Optional GUI: launch with a clean profile:
   ```powershell
   $qaUser = Join-Path $env:TEMP "devdesk-qa-$(Get-Date -Format yyyyMMddHHmmss)"
   & .\release\win-unpacked\DevDesk.exe --user-data-dir=$qaUser
   ```

### Linux

1. Build AppImage/deb via `npm run package:linux` on a Linux host.
2. Run `npm run verify:linux-package`.
3. Execute the core workflow table interactively (or a Linux harness when added).
4. Record results in the Linux section below.

### Automated companions

| Check | Command | Windows (2026-07-13) | Linux |
|-------|---------|----------------------|-------|
| Unpacked package + engine + natives | `verify:win-package` / `verify:linux-package` | **Pass** | Pending host |
| Packaged engine index/search/stats | `smoke:engine-packaged` | **Pass** | Pending host |
| Clean-profile workflow harness | `qa:clean-install:win` | **Pass** (11/11) | N/A (Windows script) |
| Full automated gate | `release:gate` | **Pass** (prior) | CI matrix |

---

## Session log — Windows x64 (2026-07-13)

| Field | Value |
|-------|--------|
| Host | Windows 11 (`win32` x64) |
| Installer | `release/DevDesk-0.1.0-win-x64.exe` |
| Installer SHA-256 | `67d8db43a48fe4e52f1dd9decb2b81f9eddadc3b308fd58c40563b9547478b04` |
| Installer size | 204051434 bytes |
| Unpacked exe | `release/win-unpacked/DevDesk.exe` |
| Unpacked SHA-256 | `34e7935dee4ca0ae8dcf50d50d11eb8d6580dfb93246acd8147b8618fccd90cc` |
| Clean userData | temp profile via harness + `--user-data-dir` packaged launch |
| Evidence report | `release/clean-install-qa-report.json` and committed `docs/qa-evidence/clean-install-qa-windows-2026-07-13.json` |
| Harness summary | **11 passed, 0 failed, 0 skipped** |

### Core workflow results

| # | Workflow | Result | Evidence |
|---|----------|--------|----------|
| 1 | Launch packaged app first time | **Pass** | Step `11_packaged_launch`: exe started (`wasRunning: true`), `devdesk.db` created under clean `launchUserData` |
| 2 | Add / edit / pin / remove project | **Pass** | Step `01_project_lifecycle`: create → rename → pin → remove temp project; project retained for later steps |
| 3 | Create/run command (variables + failing) | **Pass** | Step `02_command_variables_and_fail`: variable resolve `cmd /c echo "clean-install-ok"` → success; `cmd /c exit 7` → `failed` in run history |
| 4 | Terminal open / resize / close | **Pass** | Step `03_terminal`: live `node-pty` session, resize 100×30, close |
| 5 | Health check + persisted history | **Pass** | Step `04_health`: 18 check items, run listed as latest |
| 6 | Engine index / search / Git | **Pass** | Step `05_engine`: index ok, search hit for `clean-install-qa`, git insights attempted after `git init` |
| 7 | Bug with attachment | **Pass** | Step `06_bug_attachment`: bug + file under `userData/attachments/…` |
| 8 | Export / import merge + replace | **Pass** | Step `07_export_import`: export counts written; merge+replace success; 2× `devdesk.db.backup-*`; attachment metadata warning recorded |
| 9 | Tray preference toggle | **Pass** | Step `08_tray_pref`: `trayEnabled` false then true in SQLite preferences |
| 10 | Docker present / missing | **Pass** | Step `09_docker`: daemon not running → `present: false`, `degradedOk: true` (graceful missing-Docker state) |
| 11 | Restart + persistence | **Pass** | Step `10_restart_persistence`: child process re-opened DB; project/bug/health rows present |

### Windows safety gate

| Check | Result |
|-------|--------|
| No unrecoverable startup crash on packaged launch | **Pass** |
| No DevTools required for renderer load | **Pass** (packaged binary) |
| Import creates DB backup before write | **Pass** (backup files in evidence) |
| nodeIntegration off / contextIsolation on | **Pass** (createWindow defaults; not re-broken this session) |

---

## Session log — Linux x64

| Field | Value |
|-------|--------|
| Host | Not available in this session (Windows primary machine) |
| Artifact | Targets configured: AppImage + deb (`package:linux`) |
| Status | **Execution pending on Linux host** |

### Core workflow results (template)

| # | Workflow | Result | Notes |
|---|----------|--------|-------|
| 1 | First launch | Pending | |
| 2 | Project CRUD + pin | Pending | |
| 3 | Commands + variables + fail | Pending | |
| 4 | Terminal tabs/resize/search | Pending | |
| 5 | Health check history | Pending | |
| 6 | Engine index/search/Git | Pending | `verify:linux-package` covers engine subset in CI |
| 7 | Bug + attachment | Pending | |
| 8 | Export/import merge+replace | Pending | |
| 9 | Tray actions | Pending | |
| 10 | Docker present/missing | Pending | |
| 11 | Restart persistence | Pending | |

---

## Known limitations

1. **Unsigned Windows installer** — SmartScreen may warn.  
2. **macOS not shipped.**  
3. **Linux interactive QA incomplete** — do not claim multi-platform manual QA complete.  
4. **Attachment binaries** — export stores metadata only; harness recorded the import warning.  
5. **Auto-update not enabled.**  
6. **Docker** — this host had client installed but daemon unavailable; missing-Docker path verified.  
7. **Tray UI chrome** — preference persistence verified; clicking a live tray icon is still GUI-only (task 15 depth).  
8. **Public-launch bar** — task 15 still requires installer/upgrade/uninstall matrix and no pending Linux rows.

### Failures found this session

None on Windows clean-profile harness (11/11 pass).

---

## Sign-off

| Role | Platform | Decision | Date |
|------|----------|----------|------|
| Engineering clean-profile harness + packaged launch | Windows x64 | **Task 5 Windows workflows complete** | 2026-07-13 |
| Engineering interactive Linux | Linux x64 | **Pending** | — |
| Public launch | All | **Not yet** (see task 15 + security tasks 7–14) | — |

**Label:** private beta / internal hardening — Windows task-5 workflows evidence-backed; Linux manual QA and public-launch trust still open.
